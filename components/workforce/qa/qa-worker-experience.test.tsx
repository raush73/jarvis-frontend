/**
 * QA-L3 - the staff QA persona launcher, and the real worker handoff it performs.
 *
 * The QA-L2 client and the delivered consume client are stubbed at their boundaries; the handoff
 * chain BETWEEN them is the real one, and the worker session it establishes is written by the
 * delivered helper into the delivered keys. What these prove:
 *
 *  - The directory is the SERVER'S. Every persona on screen came from the response, no persona is
 *    named in this frontend, and the launch is offered for whatever the server returned.
 *  - EXACTLY TWO SCOPES ARE OFFERED, AND NEITHER IS PRESELECTED. The launch cannot be submitted
 *    until the operator has said which experience he means (owner judgment call JC-1), and what
 *    travels to the server is a candidate and that chosen scope - nothing else, and no module.
 *  - A launch cannot be submitted twice while one is in flight.
 *  - The entry token reaches no URL, no storage, no rendered text and no error message.
 *  - The delivered consume and the delivered worker session are what establish worker identity.
 *  - The staff session survives the handoff, and survives a failed one.
 *  - The worker tab is opened on the invocation the server returned: at the MODULE ROOT for the
 *    surgical scope, and at the PACKET ROOT for the complete packet.
 *  - Every refusal - a disabled facility, a missing grant, a worker who is not test-classified, a
 *    refused entry link, a session that did not establish - produces a safe notice and no cleanup.
 *  - There is no production-worker search, no arbitrary module, no arbitrary invocation kind, no
 *    module list composing the packet, and no destructive control anywhere on the surface.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/qa/worker-experience",
}));

vi.mock("@/lib/workforce/qaWorkerExperienceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/qaWorkerExperienceApi")>();
  return {
    ...actual,
    listQaTestWorkers: vi.fn(),
    launchQaWorkerExperience: vi.fn(),
    reEnterQaWorkerExperience: vi.fn(),
  };
});

vi.mock("@/lib/workforce/workforceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/workforceApi")>();
  return { ...actual, consumeWorkforceLink: vi.fn() };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const {
  listQaTestWorkers,
  launchQaWorkerExperience,
  reEnterQaWorkerExperience,
  QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION,
} = await import("@/lib/workforce/qaWorkerExperienceApi");
const { consumeWorkforceLink } = await import("@/lib/workforce/workforceApi");
const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");
const { saveWorkerSession } = await import("@/lib/workforce/workerSession");
const { fixtureSession } = await import("@/components/workforce/admin/adminTestFixtures");
const { default: QaWorkerExperienceLauncher } = await import(
  "./QaWorkerExperienceLauncher"
);

const LAUNCH_GRANT = QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION;
const STAFF_TOKEN_KEY = "jp_accessToken";
const WORKER_TOKEN_KEY = "jp_workerSession";
const CANDIDATE = "cand_qa_alpha";
const INVOCATION = "inv_qa_alpha";
const ENTRY_TOKEN = "qa-entry-token-2f7b91c4e0";

/**
 * Two personas whose names appear NOWHERE in the implementation.
 *
 * Deliberately not the intended QA personas: if this surface only worked for the names someone
 * remembered, this fixture would fail, which is the whole check on a hardcoded roster.
 */
const DIRECTORY = [
  {
    candidateId: CANDIDATE,
    displayName: "Fixture, Alpha",
    workerClassification: "TEST",
  },
  {
    candidateId: "cand_qa_beta",
    displayName: "Fixture, Beta",
    workerClassification: "TEST",
  },
];

function launchResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: CANDIDATE,
    invocationId: INVOCATION,
    scope: "PAYROLL_PAYMENT" as const,
    workerEntryToken: ENTRY_TOKEN,
    expiresAt: "2026-08-28T18:00:00.000Z",
    ...overrides,
  };
}

/**
 * What the server returns for a session-only re-entry.
 *
 * NO `invocationId` AND NO `scope`, mirroring the server contract exactly. The screen therefore has
 * nothing to build an invocation route from even if a future edit tried to.
 */
function reEntryResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: CANDIDATE,
    workerEntryToken: ENTRY_TOKEN,
    expiresAt: "2026-08-28T18:00:00.000Z",
    ...overrides,
  };
}

/** The delivered consume, as it behaves: it establishes the session itself. */
function consumeAcceptsAndEstablishes() {
  return vi.fn(async () => {
    saveWorkerSession({
      token: "worker-session-jwt",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      applicationSessionId: "app_session_qa_alpha",
      candidateId: CANDIDATE,
    });
    return {
      authenticated: true as const,
      applicationSessionId: "app_session_qa_alpha",
      candidateId: CANDIDATE,
      requestedIntent: { category: "COMPLETE_ONBOARDING", recognized: true },
      session: {
        token: "worker-session-jwt",
        tokenType: "Bearer" as const,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    };
  });
}

/** A tab handle as `window.open` returns one. */
function tabStub() {
  return { location: { href: "" }, close: vi.fn() };
}

let openedTab: ReturnType<typeof tabStub>;
let openWindow: ReturnType<typeof vi.fn>;

/** The persona radios only: the scope radios share the page and must not be caught by accident. */
function personaRadios() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="qa-persona"]'),
  );
}

function scopeRadios() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="qa-scope"]'),
  );
}

async function chooseFirstPersona() {
  // The scope radios are on the page before the directory answers, so waiting for "a radio" would
  // race the persona list. This waits for the SERVER'S list specifically.
  await waitFor(() => expect(personaRadios().length).toBeGreaterThan(0));
  fireEvent.click(personaRadios()[0]);
}

/** Chooses a scope the way an operator does: by clicking its radio on the page. */
function chooseScope(scope: string) {
  const radio = document.getElementById(`qa-scope-${scope}`);
  if (!radio) throw new Error(`No scope choice is offered for ${scope}`);
  fireEvent.click(radio);
}

/** Both choices, in the order an operator makes them. */
async function choose(scope: string) {
  await chooseFirstPersona();
  chooseScope(scope);
}

/**
 * The LAUNCH button specifically.
 *
 * ANCHORED ON `Launch` BECAUSE THE RE-ENTRY BUTTON ALSO ENDS IN "as this test worker". The two acts
 * are deliberately worded in parallel for an operator, so a test selector has to distinguish them
 * on the verb - and a helper that matched both would silently start asserting the wrong act.
 */
function launchButton() {
  return screen.getByRole("button", { name: /^Launch .*as this test worker$/ });
}

/** The RE-ENTRY button specifically, by its exact ratified wording. */
function reEnterButton() {
  return screen.getByRole("button", { name: "Re-enter as this test worker" });
}

/** The scope the LAUNCHED panel reports, read off the outcome and not off the chooser. */
function reportedScope() {
  const label = Array.from(document.querySelectorAll("dt.oba-field-label")).find(
    (node) => node.textContent === "Launch scope",
  );
  return (
    label?.parentElement?.querySelector(".oba-field-value")?.firstChild?.textContent ?? ""
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(STAFF_TOKEN_KEY, "staff-token");
  session.mockReturnValue(fixtureSession([LAUNCH_GRANT]));
  vi.mocked(listQaTestWorkers).mockResolvedValue(DIRECTORY);
  vi.mocked(launchQaWorkerExperience).mockResolvedValue(launchResponse());
  vi.mocked(reEnterQaWorkerExperience).mockResolvedValue(reEntryResponse());
  vi.mocked(consumeWorkforceLink).mockImplementation(consumeAcceptsAndEstablishes());
  openedTab = tabStub();
  openWindow = vi.fn(() => openedTab);
  vi.stubGlobal("open", openWindow);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

/* --------------------------------------------------------------- the directory */

describe("the QA persona directory", () => {
  it("renders the workers the server returned, with the safe fields only", async () => {
    render(<QaWorkerExperienceLauncher />);

    expect(await screen.findByText("Fixture, Alpha")).toBeTruthy();
    expect(screen.getByText("Fixture, Beta")).toBeTruthy();
    expect(screen.getAllByText("TEST").length).toBe(2);
    expect(screen.getByText(CANDIDATE)).toBeTruthy();
    expect(vi.mocked(listQaTestWorkers)).toHaveBeenCalledTimes(1);
  });

  it("offers a launch for whichever workers the server returned", async () => {
    vi.mocked(listQaTestWorkers).mockResolvedValue([
      {
        candidateId: "cand_qa_unexpected",
        displayName: "Nobody, Expected",
        workerClassification: "TEST",
      },
    ]);

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledWith(
        "cand_qa_unexpected",
        "PAYROLL_PAYMENT",
      ),
    );
  });

  it("reports an empty directory as empty rather than as a fault", async () => {
    vi.mocked(listQaTestWorkers).mockResolvedValue([]);

    render(<QaWorkerExperienceLauncher />);

    expect(await screen.findByText("No test workers are classified.")).toBeTruthy();
    expect(personaRadios().length).toBe(0);
  });

  it("reports a refused directory read safely", async () => {
    vi.mocked(listQaTestWorkers).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        message: "The QA worker experience launcher is disabled",
      }),
    );

    render(<QaWorkerExperienceLauncher />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("The QA worker experience launcher is disabled"),
    ).toBeTruthy();
    expect(personaRadios().length).toBe(0);
  });
});

/* ------------------------------------------------------------- authorization */

describe("authorization, as this surface reflects it", () => {
  it("reads nothing and offers nothing without the effective grant", async () => {
    session.mockReturnValue(fixtureSession([]));

    render(<QaWorkerExperienceLauncher />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.getByText(/The QA worker experience launcher is not available to you/),
    ).toBeTruthy();
    await waitFor(() => expect(vi.mocked(listQaTestWorkers)).not.toHaveBeenCalled());
  });

  it("does not treat the admin role as the grant", async () => {
    session.mockReturnValue(
      fixtureSession([], { isAdmin: true, roles: ["admin"], hasPermission: () => true }),
    );

    render(<QaWorkerExperienceLauncher />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(vi.mocked(listQaTestWorkers)).not.toHaveBeenCalled());
  });

  it("asks an unauthenticated operator to sign in, and reads nothing", async () => {
    session.mockReturnValue(
      fixtureSession([LAUNCH_GRANT], { authenticated: false, permissions: [] }),
    );

    render(<QaWorkerExperienceLauncher />);

    expect(await screen.findByText("Sign in to continue.")).toBeTruthy();
    await waitFor(() => expect(vi.mocked(listQaTestWorkers)).not.toHaveBeenCalled());
  });
});

/* ------------------------------------------------------------------ the launch */

describe("the launch scope, which the operator must choose", () => {
  it("offers exactly two scopes and preselects neither (JC-1)", async () => {
    render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    const scopes = scopeRadios();
    expect(scopes.length).toBe(2);
    expect(scopes.map((radio) => radio.value).sort()).toEqual([
      "COMPLETE_PACKET",
      "PAYROLL_PAYMENT",
    ]);
    // NOTHING IS CHOSEN FOR HIM. A preselected scope would be a defaulted request wearing the
    // appearance of a decision, which is the one thing JC-1 forbids.
    expect(scopes.some((radio) => radio.checked)).toBe(false);
  });

  it("describes each scope in words, and names no internal invocation vocabulary", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    const text = container.textContent ?? "";
    expect(text).toContain("Payroll Payment only");
    expect(text).toContain("Complete onboarding packet");
    expect(text).toContain("There is no default.");
    for (const internal of ["NAMED_MODULES", "NAMED_WORKFLOW", "invocation kind", "moduleKey"]) {
      expect(text).not.toContain(internal);
    }
  });

  it("cannot be launched before a worker is chosen", async () => {
    render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");
    chooseScope("PAYROLL_PAYMENT");

    expect(launchButton().hasAttribute("disabled")).toBe(true);
    fireEvent.click(launchButton());

    expect(vi.mocked(launchQaWorkerExperience)).not.toHaveBeenCalled();
  });

  it("cannot be launched before a scope is chosen, and sends no scope on its own", async () => {
    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    expect(launchButton().hasAttribute("disabled")).toBe(true);
    fireEvent.click(launchButton());

    // A chosen worker is not enough. There is no scope to fall back on, so nothing is requested.
    expect(vi.mocked(launchQaWorkerExperience)).not.toHaveBeenCalled();
  });

  it("sends the surgical scope, and only what the operator chose", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledWith(
        CANDIDATE,
        "PAYROLL_PAYMENT",
      ),
    );
    // Two arguments, and neither of them is a module, a module list or an invocation kind.
    expect(vi.mocked(launchQaWorkerExperience).mock.calls[0]).toEqual([
      CANDIDATE,
      "PAYROLL_PAYMENT",
    ]);
  });

  it("sends the complete-packet scope, with no module list of its own (QA-L5-R2)", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledWith(
        CANDIDATE,
        "COMPLETE_PACKET",
      ),
    );
    // WHAT THE PACKET CONTAINS IS NEVER ASKED FOR HERE. The request is a worker and a scope; the
    // production registry decides the modules, their order and their number.
    expect(vi.mocked(launchQaWorkerExperience).mock.calls[0]).toEqual([
      CANDIDATE,
      "COMPLETE_PACKET",
    ]);
    expect(vi.mocked(launchQaWorkerExperience).mock.calls[0].length).toBe(2);
  });

  it("sends the last scope the operator chose, and never both", async () => {
    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();
    chooseScope("COMPLETE_PACKET");
    chooseScope("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledTimes(1),
    );
    expect(vi.mocked(launchQaWorkerExperience).mock.calls[0][1]).toBe("PAYROLL_PAYMENT");
  });

  it("names the chosen scope on the act itself", async () => {
    render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    expect(launchButton().textContent).toBe("Launch as this test worker");
    chooseScope("COMPLETE_PACKET");
    expect(launchButton().textContent).toBe(
      "Launch Complete onboarding packet as this test worker",
    );
    chooseScope("PAYROLL_PAYMENT");
    expect(launchButton().textContent).toBe(
      "Launch Payroll Payment only as this test worker",
    );
  });

  it("cannot be submitted twice while one launch is in flight", async () => {
    let release: (value: ReturnType<typeof launchResponse>) => void = () => {};
    vi.mocked(launchQaWorkerExperience).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");

    fireEvent.click(launchButton());
    fireEvent.click(screen.getByRole("button", { name: "Launching…" }));
    fireEvent.click(screen.getByRole("button", { name: "Launching…" }));

    expect(screen.getByRole("button", { name: "Launching…" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledTimes(1);

    release(launchResponse());
    await waitFor(() => expect(vi.mocked(consumeWorkforceLink)).toHaveBeenCalledTimes(1));
  });
});

/* ----------------------------------------------------------------- the handoff */

describe("the real worker handoff", () => {
  it("consumes the entry token through the delivered magic-link flow", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(consumeWorkforceLink)).toHaveBeenCalledWith(
        ENTRY_TOKEN,
        "COMPLETE_ONBOARDING",
      ),
    );
  });

  it("establishes the delivered worker session and keeps the staff session", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBe("worker-session-jwt"),
    );
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("opens the worker tab on the invocation the server returned, at the module root", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(openedTab.location.href).toContain(
        `/workforce/onboarding/${INVOCATION}/payroll-payment`,
      ),
    );
    // Opened empty, inside the click, so a popup blocker allows it.
    expect(openWindow).toHaveBeenCalledWith("about:blank", "_blank");
  });

  it("puts the entry token in no URL, no storage and nothing rendered", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    await screen.findByText(INVOCATION);

    expect(openedTab.location.href).not.toContain(ENTRY_TOKEN);
    expect(openWindow.mock.calls.flat().join(" ")).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(window.localStorage)).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(window.sessionStorage)).not.toContain(ENTRY_TOKEN);
    expect(document.cookie).not.toContain(ENTRY_TOKEN);
    expect(container.innerHTML).not.toContain(ENTRY_TOKEN);
  });

  it("reports what was launched without offering a token or a second run of it", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(await screen.findByText(INVOCATION)).toBeTruthy();
    // The scope the SERVER reported for the run it composed, in the operator's words.
    expect(reportedScope()).toBe("Payroll Payment only");
    const manual = screen.getByRole("link", { name: "Open the worker experience" });
    expect(manual.getAttribute("href")).toBe(
      `/workforce/onboarding/${INVOCATION}/payroll-payment`,
    );
    expect(manual.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("offers the operator the link himself when the browser blocks the tab", async () => {
    openWindow.mockReturnValue(null);

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(await screen.findByText(/This browser blocked the new tab/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open the worker experience" }).getAttribute("href"),
    ).toBe(`/workforce/onboarding/${INVOCATION}/payroll-payment`);
  });
});

/* -------------------------------------------------- the complete packet handoff */

describe("a complete-packet handoff", () => {
  beforeEach(() => {
    vi.mocked(launchQaWorkerExperience).mockResolvedValue(
      launchResponse({ scope: "COMPLETE_PACKET" }),
    );
  });

  it("runs the SAME real chain: link consumed and worker session established", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(consumeWorkforceLink)).toHaveBeenCalledWith(
        ENTRY_TOKEN,
        "COMPLETE_ONBOARDING",
      ),
    );
    await waitFor(() =>
      expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBe("worker-session-jwt"),
    );
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("opens the worker tab on the PACKET ROOT and not inside a module", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(openedTab.location.href.endsWith(`/workforce/onboarding/${INVOCATION}`)).toBe(
        true,
      ),
    );
    // The packet overview, where a real worker with a packet starts. Landing him inside one module
    // would skip the surface packet QA exists to exercise.
    expect(openedTab.location.href).not.toContain("payroll-payment");
    expect(openWindow).toHaveBeenCalledWith("about:blank", "_blank");
  });

  it("names the packet scope in the outcome, and no module inside it", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");
    fireEvent.click(launchButton());

    expect(await screen.findByText(INVOCATION)).toBeTruthy();
    expect(reportedScope()).toBe("Complete onboarding packet");
    expect(
      screen
        .getByRole("link", { name: "Open the worker experience" })
        .getAttribute("href"),
    ).toBe(`/workforce/onboarding/${INVOCATION}`);

    // NO MODULE IS NAMED, COUNTED OR LISTED ANYWHERE ON THE SURFACE. Which modules the packet
    // holds is answered by the server and rendered by the worker runtime (owner ruling QA-L5-R2).
    const text = container.textContent ?? "";
    for (const absent of [
      "EMPLOYMENT_ELIGIBILITY",
      "FEDERAL_TAX",
      "EMERGENCY_CONTACT",
      "Federal Tax",
      "Emergency Contact",
      "State Tax",
      "Benefits",
      "Final Review",
      "4 modules",
    ]) {
      expect(text).not.toContain(absent);
    }
  });

  it("opens no tab at all when the entry link is refused", async () => {
    vi.mocked(consumeWorkforceLink).mockResolvedValue({
      authenticated: false,
      reason: "INVALID_LINK",
    });

    render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");
    fireEvent.click(launchButton());

    expect(await screen.findByText("The worker entry link was not accepted.")).toBeTruthy();
    expect(openedTab.location.href).toBe("");
    expect(openedTab.close).toHaveBeenCalled();
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("follows the SERVER'S scope for the destination, not the operator's ask", async () => {
    // If the server composed something narrower than was asked for, the browser goes where the
    // server actually composed. The ask never decides the route.
    vi.mocked(launchQaWorkerExperience).mockResolvedValue(
      launchResponse({ scope: "PAYROLL_PAYMENT" }),
    );

    render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");
    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(
        openedTab.location.href.endsWith(
          `/workforce/onboarding/${INVOCATION}/payroll-payment`,
        ),
      ).toBe(true),
    );
  });
});

/* ---------------------------------------------------------------- the refusals */

describe("a refused or failed launch", () => {
  it("reports a refused launch safely, and consumes nothing", async () => {
    vi.mocked(launchQaWorkerExperience).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        message: "A QA worker experience may only be launched for a test worker",
      }),
    );

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("A QA worker experience may only be launched for a test worker"),
    ).toBeTruthy();
    expect(vi.mocked(consumeWorkforceLink)).not.toHaveBeenCalled();
    expect(openedTab.close).toHaveBeenCalled();
  });

  it("distinguishes a disabled facility from an unauthorized operator", async () => {
    vi.mocked(launchQaWorkerExperience).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        message: "The QA worker experience launcher is disabled",
      }),
    );

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(
      await screen.findByText("The QA worker experience launcher is disabled"),
    ).toBeTruthy();
  });

  it("says nothing was removed when the run was created but the link failed", async () => {
    vi.mocked(launchQaWorkerExperience).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 503,
        message:
          "The QA worker experience was prepared but no worker entry link could be created",
      }),
    );

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(await screen.findByText(/nothing was removed/)).toBeTruthy();
  });

  it("reports a refused entry link safely, keeping the staff session", async () => {
    vi.mocked(consumeWorkforceLink).mockResolvedValue({
      authenticated: false,
      reason: "INVALID_LINK",
    });

    const { container } = render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(await screen.findByText("The worker entry link was not accepted.")).toBeTruthy();
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
    expect(container.innerHTML).not.toContain(ENTRY_TOKEN);
    expect(openedTab.close).toHaveBeenCalled();
  });

  it("reports a session that did not establish, and undoes nothing", async () => {
    // Accepted, but nothing was stored: the delivered reader finds no session.
    vi.mocked(consumeWorkforceLink).mockResolvedValue({
      authenticated: true,
      applicationSessionId: "app_session_qa_alpha",
      candidateId: CANDIDATE,
      requestedIntent: null,
      session: {
        token: "worker-session-jwt",
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());

    expect(
      await screen.findByText("No worker session was established in this browser."),
    ).toBeTruthy();
    expect(screen.getByText(/nothing was removed/)).toBeTruthy();
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("allows another NEW launch after a failure, and never a repair of the old one", async () => {
    vi.mocked(consumeWorkforceLink).mockResolvedValueOnce({
      authenticated: false,
      reason: "INVALID_LINK",
    });

    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");
    fireEvent.click(launchButton());
    await screen.findByText("The worker entry link was not accepted.");

    fireEvent.click(launchButton());

    await waitFor(() =>
      expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledTimes(2),
    );
    // Both calls are the same request: a candidate and a scope, and never an invocation to resume.
    expect(vi.mocked(launchQaWorkerExperience).mock.calls).toEqual([
      [CANDIDATE, "PAYROLL_PAYMENT"],
      [CANDIDATE, "PAYROLL_PAYMENT"],
    ]);
  });
});

/* ---------------------------------------------------------- what is not there */

/* ------------------------------------------------------------------- re-entry */

describe("the session-only re-entry act", () => {
  it("renders with its ratified wording", async () => {
    render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    expect(
      screen.getByRole("button", { name: "Re-enter as this test worker" }),
    ).toBeTruthy();
  });

  it("enables on a worker selection ALONE, with no launch scope chosen", async () => {
    render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    // Disabled with nothing selected...
    expect((reEnterButton() as HTMLButtonElement).disabled).toBe(true);

    await chooseFirstPersona();

    // ...and enabled by the worker alone. NO SCOPE WAS CHOSEN, and the launch button proves it is
    // still waiting for one - which is what makes this a genuinely different precondition rather
    // than the same one worded differently.
    expect((reEnterButton() as HTMLButtonElement).disabled).toBe(false);
    expect(scopeRadios().every((radio) => !radio.checked)).toBe(true);
    expect((launchButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls re-entry and NEVER the launch", async () => {
    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());
    await waitFor(() =>
      expect(vi.mocked(reEnterQaWorkerExperience)).toHaveBeenCalledTimes(1),
    );

    // THE ZERO-PACKET GUARANTEE AT THE UI LAYER: the launch client, which is what composes a
    // packet version, was never reached.
    expect(vi.mocked(reEnterQaWorkerExperience)).toHaveBeenCalledWith(CANDIDATE);
    expect(vi.mocked(launchQaWorkerExperience)).not.toHaveBeenCalled();
  });

  it("sends no scope, even after the operator has chosen one for a launch", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("COMPLETE_PACKET");

    fireEvent.click(reEnterButton());
    await waitFor(() =>
      expect(vi.mocked(reEnterQaWorkerExperience)).toHaveBeenCalledTimes(1),
    );

    // A scope selected on the page does not leak into an act that composes nothing.
    expect(vi.mocked(reEnterQaWorkerExperience).mock.calls[0]).toEqual([CANDIDATE]);
    expect(vi.mocked(launchQaWorkerExperience)).not.toHaveBeenCalled();
  });

  it("establishes the worker session through the SAME delivered handoff a launch uses", async () => {
    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());
    await screen.findByText("Re-entered");

    // The SAME delivered consume, with the SAME recognized intent, and the session written by the
    // DELIVERED helper under the DELIVERED key. No second authentication path exists.
    expect(vi.mocked(consumeWorkforceLink)).toHaveBeenCalledWith(
      ENTRY_TOKEN,
      "COMPLETE_ONBOARDING",
    );
    expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBeTruthy();
    // And the staff session in this tab is untouched.
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("navigates the worker tab to /workforce/onboarding and to no invocation route", async () => {
    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());
    await screen.findByText("Re-entered");

    expect(openWindow).toHaveBeenCalled();
    // Resolved against this application's own origin by the delivered tab helper, exactly as a
    // launch destination is.
    expect(new URL(openedTab.location.href).pathname).toBe("/workforce/onboarding");
    // NO INVOCATION SEGMENT AND NO MODULE SEGMENT. The application's normal runtime discovers the
    // worker's outstanding packet; this screen never chooses one for him.
    expect(openedTab.location.href).not.toContain(INVOCATION);
    expect(openedTab.location.href).not.toContain("payroll-payment");
    expect(openedTab.location.href).not.toContain(ENTRY_TOKEN);
  });

  it("reports no invocation and no scope on its result, and says nothing was created", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());
    const panel = await screen.findByText("Re-entered");
    const outcome = panel.closest(".oba-panel") ?? container;
    const text = outcome.textContent ?? "";

    expect(text).not.toContain(INVOCATION);
    expect(text).not.toContain(ENTRY_TOKEN);
    // The operator is told plainly what did NOT happen, which is the whole reason he chose this
    // act over a launch.
    expect(container.textContent).toContain(
      "This creates NO new onboarding packet and no new onboarding run",
    );
  });

  it("puts the entry token in no rendered text, no URL and no storage", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());
    await screen.findByText("Re-entered");

    expect(container.textContent ?? "").not.toContain(ENTRY_TOKEN);
    expect(container.innerHTML).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(localStorage)).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(ENTRY_TOKEN);
    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href") ?? "").not.toContain(ENTRY_TOKEN);
    }
  });

  it("cannot be submitted twice while one is in flight", async () => {
    let release: (value: unknown) => void = () => undefined;
    vi.mocked(reEnterQaWorkerExperience).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as Promise<ReturnType<typeof reEntryResponse>>,
    );

    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    // The SAME node, clicked three times in the same tick. Re-querying would miss it: the label
    // becomes "Re-entering…" immediately, which is the courtesy - the ref inside the component is
    // the actual guard, and that is what this exercises.
    const button = reEnterButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(vi.mocked(reEnterQaWorkerExperience)).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    release(reEntryResponse());
    await screen.findByText("Re-entered");
  });

  it("shows a useful QA error when re-entry is refused, and reports no launch", async () => {
    vi.mocked(reEnterQaWorkerExperience).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "FORBIDDEN",
        message: "A QA worker experience may only be re-entered as a test worker",
      }),
    );

    render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());

    // Its OWN outcome panel, with the server's own sentence - not the launch's panel.
    await screen.findByText("Re-entry outcome");
    expect(
      screen.getByText("A QA worker experience may only be re-entered as a test worker"),
    ).toBeTruthy();
    expect(screen.queryByText("Re-entered")).toBeNull();
    expect(screen.queryByText("Launch outcome")).toBeNull();
    // The tab that was opened optimistically is closed again.
    expect(openedTab.close).toHaveBeenCalled();
  });

  it("tells the operator truthfully that nothing was created when a handoff fails", async () => {
    // A refused entry link. For a LAUNCH this notice reports a run standing in the worker's
    // history; for a RE-ENTRY there is no run, and saying otherwise would contradict the guarantee
    // the panel above it just made.
    vi.mocked(consumeWorkforceLink).mockResolvedValue({
      authenticated: false as const,
      reason: "INVALID_LINK",
    } as never);

    const { container } = render(<QaWorkerExperienceLauncher />);
    await chooseFirstPersona();

    fireEvent.click(reEnterButton());
    await screen.findByText("Re-entry outcome");

    const text = container.textContent ?? "";
    expect(text).toContain(
      "No onboarding run and no packet were created, and this worker's existing onboarding is untouched.",
    );
    expect(text).not.toContain("The QA run was created and is still in this worker's history");
  });

  it("keeps its result state entirely separate from the launch's", async () => {
    render(<QaWorkerExperienceLauncher />);
    await choose("PAYROLL_PAYMENT");

    // A launch first...
    fireEvent.click(launchButton());
    await screen.findByText("Launched");
    expect(screen.queryByText("Re-entered")).toBeNull();

    // ...then a re-entry, which reports itself and clears nothing of the launch's.
    fireEvent.click(reEnterButton());
    await screen.findByText("Re-entered");
    expect(screen.getByText("Launched")).toBeTruthy();

    // The launch panel still reports its invocation; the re-entry panel reports none.
    const reEntryPanel = screen.getByText("Re-entered").closest(".oba-panel");
    expect(reEntryPanel?.textContent ?? "").not.toContain(INVOCATION);
    const launchPanel = screen.getByText("Launched").closest(".oba-panel");
    expect(launchPanel?.textContent ?? "").toContain(INVOCATION);
  });

  it("is not offered at all to a caller without the sensitive grant", async () => {
    session.mockReturnValue(fixtureSession([]));

    render(<QaWorkerExperienceLauncher />);

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Re-enter as this test worker" }),
      ).toBeNull(),
    );
    expect(vi.mocked(reEnterQaWorkerExperience)).not.toHaveBeenCalled();
  });
});

describe("what this surface deliberately does not offer", () => {
  it("has no free-text field to name a worker, a packet or an invocation", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    expect(container.querySelectorAll("input:not([type='radio'])").length).toBe(0);
    expect(container.querySelectorAll("select, textarea").length).toBe(0);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("offers no module choice, no arbitrary scope and no earlier run", async () => {
    const { container } = render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    const text = container.textContent ?? "";
    for (const absent of [
      "Resume",
      "resume",
      "Reopen",
      "Reset",
      "Delete",
      "Employment Eligibility",
      "Federal Tax",
      "Emergency Contact",
    ]) {
      expect(text).not.toContain(absent);
    }
    // TWO CHOICES ON THE PAGE AND NO OTHERS: which test worker, and which of the two authorized
    // experiences. Every radio belongs to one of those two groups.
    const radios = screen.getAllByRole("radio");
    const groups = new Set(radios.map((radio) => radio.getAttribute("name")));
    expect([...groups].sort()).toEqual(["qa-persona", "qa-scope"]);
    expect(scopeRadios().length).toBe(2);
    expect(personaRadios().length).toBe(DIRECTORY.length);
  });

  it("offers exactly two acts - the launch and the ratified re-entry - and no third", async () => {
    render(<QaWorkerExperienceLauncher />);
    await screen.findByText("Fixture, Alpha");

    // STILL AN EXHAUSTIVE COUNT, so a third act added to this screen without a governance
    // decision behind it fails here exactly as a second one used to.
    expect(screen.getAllByRole("button").length).toBe(2);
    expect(launchButton()).toBeTruthy();
    expect(reEnterButton()).toBeTruthy();
  });
});

/* ----------------------------------------------------------------- boundaries */

describe("the boundaries this surface keeps", () => {
  const file = readFileSync(join(__dirname, "QaWorkerExperienceLauncher.tsx"), "utf8");
  const source = file.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("names no QA persona and no worker identifier", () => {
    for (const forbidden of [
      "seed-worker",
      "James",
      "Hardin",
      "Robert",
      "Trevino",
      "William",
      "Grant,",
      "Charles",
      "Webb",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("handles no token and writes no storage", () => {
    for (const forbidden of [
      "workerEntryToken",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
      "console.",
      "saveWorkerSession",
      "consumeWorkforceLink",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("contains no destructive or repairing act", () => {
    for (const forbidden of [
      "delete",
      "Delete",
      "reset",
      "Reset",
      "rollback",
      "purge",
      "clearWorkerSession",
      "clearWorkerAuth",
      "clearAccessToken",
      "forceComplete",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("names no module, no module list and no invocation vocabulary (QA-L5-R2)", () => {
    // The two authorized SCOPES are named here, because the operator has to be told in words what
    // he is choosing between. Nothing else about the packet may be: a module key, a module list, a
    // count or an order in this file would be a second registry in the browser.
    for (const forbidden of [
      "EMPLOYMENT_ELIGIBILITY",
      "FEDERAL_TAX",
      "EMERGENCY_CONTACT",
      "STATE_TAX",
      "BENEFITS",
      "FINAL_REVIEW",
      "moduleKey",
      "moduleSlug",
      "modulePath",
      "packetPath",
      "NAMED_MODULES",
      "NAMED_WORKFLOW",
      "workflowKey",
      "requirementReason",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("takes the authorized scope set from the server's contract, and defines none (QA-L5-R1)", () => {
    // The set is IMPORTED and iterated. A local array of scopes here could drift from the closed
    // set the server enforces, and could quietly grow a third.
    expect(source).toContain("QA_WORKER_EXPERIENCE_SCOPES");
    expect(source).toContain("QA_WORKER_EXPERIENCE_SCOPES.map");
    expect(source).not.toMatch(/QA_WORKER_EXPERIENCE_SCOPES\s*=/);
    expect(source).not.toMatch(/\[\s*"PAYROLL_PAYMENT"/);
    expect(source).not.toMatch(/\[\s*"COMPLETE_PACKET"/);
  });

  it("supplies no scope on the operator's behalf (JC-1)", () => {
    // The state starts null and no default is written anywhere: not in `useState`, not as a
    // fallback on the way out.
    expect(source).toContain("useState<QaWorkerExperienceScope | null>(null)");
    expect(source).not.toMatch(/useState[^\n]*"PAYROLL_PAYMENT"/);
    expect(source).not.toMatch(/useState[^\n]*"COMPLETE_PACKET"/);
    expect(source).not.toMatch(/scope\s*(\?\?|\|\|)\s*"/);
  });
});
