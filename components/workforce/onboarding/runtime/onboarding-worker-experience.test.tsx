/**
 * Worker experience corrections - identity, and a section he finished.
 *
 * TWO WORKER-FACING FACTS ARE PROVEN HERE, both discovered in Gate 10C-E3 QA:
 *
 *  - WHOSE onboarding is open. A module page named the section and never the worker, so two
 *    open tabs were indistinguishable. The name must come from the session-backed identity
 *    projection and from nothing the browser can choose, because the one failure this
 *    display must never have is labelling one worker's screen with another's name.
 *
 *  - WHETHER A COMPLETED SECTION SUCCEEDED. A worker who had just signed his payroll payment
 *    authorization was told the section "is not the one you are working on right now. Finish
 *    the current one first." He had finished it. That sentence is about outstanding work, and
 *    there was none.
 *
 * The corrections live in the SHARED runtime shell, so they are proven through it with
 * fixture modules rather than through any one business module. NO REAL WORKER'S DATA IS USED
 * ANYWHERE IN THIS FILE: the names, banks and account numbers below are invented for the
 * test, and the QA personas' records are not read, referenced or reachable from here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";

const push = vi.fn();
const replace = vi.fn();

/*
  A ROUTE THAT NAMES A DIFFERENT WORKER.

  Deliberately hostile: the route parameters carry another candidate's id, which is exactly
  what a shared or hand-edited link would carry. Nothing in the identity path is allowed to
  read it.
*/
const OTHER_WORKER_CANDIDATE_ID = "candidate-fixture-someone-else";
const OTHER_WORKER_NAME = "Dana Other";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useParams: () => ({ candidateId: OTHER_WORKER_CANDIDATE_ID }),
}));

vi.mock("@/lib/workforce/onboardingRuntimeApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingRuntimeApi")>();
  return {
    ...actual,
    getOnboardingRuntime: vi.fn(),
    getOnboardingSession: vi.fn(),
    getRuntimeModuleDraft: vi.fn(),
    saveRuntimeModuleDraft: vi.fn(),
    getOnboardingPacket: vi.fn(),
  };
});

vi.mock("@/lib/workforce/workerPortalApi", () => ({
  getWorkerPortalIdentity: vi.fn(),
}));

const { getOnboardingRuntime, getRuntimeModuleDraft } = await import(
  "@/lib/workforce/onboardingRuntimeApi"
);
const { getWorkerPortalIdentity } = await import("@/lib/workforce/workerPortalApi");

const { OnboardingRuntimeProvider } = await import("./OnboardingRuntimeContext");
const { default: OnboardingModuleHost } = await import("./OnboardingModuleHost");
const { registerOnboardingModuleRenderer, resetOnboardingModuleRenderers } = await import(
  "./moduleRegistry"
);
const {
  INVOCATION_ID,
  fixtureModule,
  fixturePacket,
  fixtureRuntime,
  fixtureStatus,
  step,
  RESTART_CLOSED,
  RESTART_CLOSED_NOT_BOUND,
  RESTART_OUTSTANDING,
} = await import("./runtimeTestFixtures");

/** The worker whose session is open. Invented for this suite. */
const SESSION_WORKER_NAME = "Riley Fixture";
const SESSION_CANDIDATE_ID = "candidate-fixture-1";

/*
  Invented captured answers, used to prove a completed section renders NONE of them.

  They are shaped like the values a payroll section captures precisely so that finding any of
  them in the completed screen would be a real exposure and not a coincidence.
*/
const FAKE_ROUTING_NUMBER = "123456789";
const FAKE_ACCOUNT_NUMBER = "9876543210";

function renderWithRuntime(ui: React.ReactNode) {
  return render(<OnboardingRuntimeProvider>{ui}</OnboardingRuntimeProvider>);
}

function seedSession() {
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: SESSION_CANDIDATE_ID,
  });
}

/** A packet whose one section is the payroll payment section, in whatever state is asked. */
function payrollPacket(
  overrides: Partial<import("@/lib/workforce/onboardingRuntimeApi").OnboardingRuntimeModule> = {},
) {
  return fixturePacket({
    modules: [
      fixtureModule({
        moduleKey: "PAYROLL_PAYMENT",
        title: "Payroll Payment",
        moduleSlug: "payroll-payment",
        steps: [step("review", "Review and authorize", true)],
        resumeStepSlug: "review",
        ...overrides,
      }),
    ],
  });
}

/** The payroll section as it stands after a successful authorization. */
function completedPayrollPacket(restart = RESTART_CLOSED_NOT_BOUND) {
  return payrollPacket({
    status: "COMPLETE",
    actionable: false,
    workerAction: "VIEW",
    restart,
    derivedStatus: fixtureStatus({
      state: "COMPLETE",
      label: "Complete",
      outstanding: false,
      workerActionable: false,
    }),
  });
}

function openPayroll(stepSlug = "review") {
  return renderWithRuntime(
    <OnboardingModuleHost
      invocationId={INVOCATION_ID}
      moduleSlug="payroll-payment"
      stepSlug={stepSlug}
    />,
  );
}

const identityLine = () => document.querySelector("[data-ob-worker-identity]");

beforeEach(() => {
  localStorage.clear();
  seedSession();
  vi.mocked(getWorkerPortalIdentity).mockResolvedValue({
    candidateId: SESSION_CANDIDATE_ID,
    displayName: SESSION_WORKER_NAME,
  });
  // Captured answers exist on the server. A completed section must still render none of them.
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
    packetId: "pkt-fixture-1",
    moduleKey: "PAYROLL_PAYMENT",
    data: {
      routingNumber: FAKE_ROUTING_NUMBER,
      accountNumber: FAKE_ACCOUNT_NUMBER,
    },
    updatedAt: new Date().toISOString(),
  });
  registerOnboardingModuleRenderer("PAYROLL_PAYMENT", ({ draft }) => (
    <div data-testid="payroll-renderer">
      <label className="wf-field">
        <span className="wf-label">Account number</span>
        <input
          className="pp-input"
          aria-label="Account number"
          defaultValue={String(draft.accountNumber ?? "")}
        />
      </label>
    </div>
  ));
});

afterEach(() => {
  cleanup();
  resetOnboardingModuleRenderers();
  vi.clearAllMocks();
});

// ==========================================================================
// Correction 1 - whose onboarding is open
// ==========================================================================

describe("authenticated worker identity", () => {
  it("names the authenticated worker between the eyebrow and the section title", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [payrollPacket()] }),
    );

    openPayroll();

    // The worker's own name, on the page that is capturing his banking details.
    expect(await screen.findByText(SESSION_WORKER_NAME)).toBeTruthy();

    /*
      THE ORDER IS THE POINT. Onboarding, then the worker, then the section - so the page
      reads as one hierarchy. Asserted as document order within the header rather than by
      styling, which is what the Owner ruling actually requires.
    */
    const header = document.querySelector(".wf-head") as HTMLElement;
    const lines = Array.from(header.children).map((node) => node.className);
    expect(lines.indexOf("wf-eyebrow")).toBeLessThan(lines.indexOf("wf-worker-identity"));
    expect(lines.indexOf("wf-worker-identity")).toBeLessThan(lines.indexOf("wf-title"));

    // The identity line names the worker and does NOT restate the section.
    expect(identityLine()?.textContent).toBe(SESSION_WORKER_NAME);
    expect(identityLine()?.textContent).not.toContain("Payroll Payment");
    // And the section title is still the page's own heading.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Payroll Payment");
  });

  it("takes the name from the session-backed projection and never from the route", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [payrollPacket()] }),
    );

    openPayroll();
    await screen.findByText(SESSION_WORKER_NAME);

    /*
      THE CLIENT TELLS THE SERVER NOTHING ABOUT WHO TO ANSWER ABOUT.

      The identity read is called with no arguments at all, so there is no candidate id, no
      route parameter and no query value it could have been steered by: the server resolves
      the worker from his own bound session or the read fails.
    */
    expect(vi.mocked(getWorkerPortalIdentity)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getWorkerPortalIdentity).mock.calls[0]).toEqual([]);

    // The route named a different candidate. Neither his id nor a name for him appears.
    expect(document.body.textContent).not.toContain(OTHER_WORKER_CANDIDATE_ID);
    expect(document.body.textContent).not.toContain(OTHER_WORKER_NAME);
  });

  it("keeps naming the same worker as he moves between sections", async () => {
    const packet = fixturePacket({
      modules: [
        fixtureModule({
          moduleKey: "PAYROLL_PAYMENT",
          title: "Payroll Payment",
          moduleSlug: "payroll-payment",
          position: 1,
          steps: [step("review", "Review and authorize")],
          resumeStepSlug: "review",
        }),
        fixtureModule({
          moduleKey: "FIXTURE_BETA",
          title: "Fixture Beta",
          position: 2,
          steps: [step("one", "Beta question")],
          resumeStepSlug: "one",
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [packet] }),
    );

    const view = openPayroll();
    await screen.findByText(SESSION_WORKER_NAME);

    view.rerender(
      <OnboardingRuntimeProvider>
        <OnboardingModuleHost
          invocationId={INVOCATION_ID}
          moduleSlug="fixture-beta"
          stepSlug="one"
        />
      </OnboardingRuntimeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Fixture Beta"),
    );
    // Same worker, same name, on a different section.
    expect(identityLine()?.textContent).toBe(SESSION_WORKER_NAME);
  });

  it("says nothing at all when no display name can be read", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [payrollPacket()] }),
    );
    // A worker with no name on file. Null is the projection's own answer, not an error.
    vi.mocked(getWorkerPortalIdentity).mockResolvedValue({
      candidateId: SESSION_CANDIDATE_ID,
      displayName: null,
    });

    openPayroll();

    // The section still renders in full. An unreadable name is not a broken page.
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    // NO placeholder and NO element. A guessed identity is the one thing worse than none.
    expect(identityLine()).toBeNull();
    expect(document.body.textContent).not.toContain(OTHER_WORKER_NAME);
  });

  it("fails safe when the identity read is refused outright", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [payrollPacket()] }),
    );
    vi.mocked(getWorkerPortalIdentity).mockRejectedValue(new Error("refused"));

    openPayroll();

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(identityLine()).toBeNull();
    expect(document.body.textContent).not.toContain(OTHER_WORKER_NAME);
  });
});

// ==========================================================================
// Correction 2 - a section he finished
// ==========================================================================

/** The exact sentence a completed section must never carry. */
const UNFINISHED_WORK_COPY = /not the one you are working on right now/i;
const FINISH_CURRENT_COPY = /Finish the current one first/i;

describe("a successfully completed section", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [completedPayrollPacket()] }),
    );
  });

  it("does not tell the worker to go and finish work he has already finished", async () => {
    openPayroll();

    await waitFor(() =>
      expect(document.querySelector("[data-module-complete]")).not.toBeNull(),
    );

    /*
      THE DEFECT ITSELF.

      `PACKET_NOT_CURRENTLY_BOUND` is the server's reason for anything not writable, and a
      FINISHED packet is not writable - so the section the worker had just authorized was
      given the sentence meant for a packet he had set aside half-done.
    */
    expect(document.body.textContent).not.toMatch(UNFINISHED_WORK_COPY);
    expect(document.body.textContent).not.toMatch(FINISH_CURRENT_COPY);
  });

  it("confirms the section succeeded and is on file", async () => {
    openPayroll();

    const panel = (await waitFor(() => {
      const found = document.querySelector("[data-module-complete]");
      expect(found).not.toBeNull();
      return found;
    })) as HTMLElement;

    // Named, so he knows WHICH section succeeded.
    expect(panel.textContent).toContain("Payroll Payment complete");
    // Saved, recorded, and not his to do again.
    expect(panel.textContent).toMatch(/saved/i);
    expect(panel.textContent).toMatch(/recorded successfully/i);
    expect(panel.textContent).toMatch(/on file with MW4H/i);
    expect(panel.textContent).toMatch(/do not need to enter it again/i);
    // Announced, so it reaches a worker who is not looking at that part of the page.
    expect(panel.getAttribute("role")).toBe("status");
  });

  it("stays read-only, with no input and no act to reach", async () => {
    openPayroll();

    await waitFor(() =>
      expect(document.querySelector("[data-module-complete]")).not.toBeNull(),
    );

    // Still read-only. Completion changed the WORDS and nothing about what may be written.
    expect(document.querySelector("[data-readonly-module]")).not.toBeNull();
    expect(
      screen.getByText(/shown for reference only. Nothing here can be changed now/i),
    ).toBeTruthy();

    // The module renderer never mounts, so there is no field and no control to submit.
    expect(screen.queryByTestId("payroll-renderer")).toBeNull();
    expect(document.querySelector("input")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    // The way onward is a link back, exactly as the delivered read-only path offered.
    expect(document.querySelector("[data-ob-return-to-packet]")).not.toBeNull();
  });

  it("renders none of the captured banking values it is confirming", async () => {
    openPayroll();

    await waitFor(() =>
      expect(document.querySelector("[data-module-complete]")).not.toBeNull(),
    );

    /*
      The confirmation states that the record is ON FILE and never what is in it. The draft
      the server returned for this section holds both values below, and neither reaches the
      screen - because the section content is not rendered at all, which is a stronger
      guarantee than a summary that chose which digits to hide.
    */
    const markup = document.body.innerHTML;
    expect(markup).not.toContain(FAKE_ROUTING_NUMBER);
    expect(markup).not.toContain(FAKE_ACCOUNT_NUMBER);
    expect(markup).not.toMatch(/ending in\s*\d/i);
  });
});

// ==========================================================================
// The guards the correction must NOT have weakened
// ==========================================================================

describe("sections that are genuinely not the worker's to do now", () => {
  it("still tells an unfinished section's worker to finish the current one first", async () => {
    // NOT complete, and its packet is not the bound one. The original sentence is correct
    // here, and this is the case the correction had to leave alone.
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          payrollPacket({
            status: "PENDING",
            actionable: false,
            workerAction: "NONE",
            restart: RESTART_CLOSED_NOT_BOUND,
            derivedStatus: fixtureStatus({ state: "IN_PROGRESS", label: "In progress" }),
          }),
        ],
      }),
    );

    openPayroll();

    expect(await screen.findByText(UNFINISHED_WORK_COPY)).toBeTruthy();
    expect(document.querySelector("[data-module-complete]")).toBeNull();
    expect(document.querySelector("[data-readonly-module]")).not.toBeNull();
    expect(screen.queryByTestId("payroll-renderer")).toBeNull();
  });

  it("still says a blocked section is waiting on another one", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          payrollPacket({
            status: "BLOCKED",
            actionable: false,
            workerAction: "NONE",
            restart: RESTART_CLOSED,
            derivedStatus: fixtureStatus({ state: "BLOCKED", label: "Blocked" }),
          }),
        ],
      }),
    );

    openPayroll();

    expect(await screen.findByText(/waiting on another section/i)).toBeTruthy();
    expect(document.querySelector("[data-module-complete]")).toBeNull();
  });

  it("still says a submitted packet is no longer open, even once complete", async () => {
    // Completion does not overrule this: "submitted and no longer open here" is true of a
    // finished section too, and it is not a statement about unfinished work.
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          completedPayrollPacket({
            posture: "CLOSED",
            createsNewVersion: false,
            destroysCapturedData: false,
            reason: "PACKET_NO_LONGER_OPEN_TO_WORKER",
          }),
        ],
      }),
    );

    openPayroll();

    expect(await screen.findByText(/no longer open for changes here/i)).toBeTruthy();
    // And he is still told, plainly, that the section succeeded.
    expect(document.querySelector("[data-module-complete]")).not.toBeNull();
  });

  it("leaves an outstanding section fully editable", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [payrollPacket({ restart: RESTART_OUTSTANDING })],
      }),
    );

    openPayroll();

    // The section he is meant to be filling in is untouched by any of this.
    expect(await screen.findByTestId("payroll-renderer")).toBeTruthy();
    expect(document.querySelector("[data-module-complete]")).toBeNull();
    expect(document.querySelector("[data-readonly-module]")).toBeNull();
    expect(document.body.textContent).not.toMatch(UNFINISHED_WORK_COPY);
  });
});
