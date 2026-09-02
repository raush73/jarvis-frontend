/**
 * Phase 1 - the worker onboarding runtime.
 *
 * The claims proven here are the phase's acceptance criteria, in the same terms:
 *
 *  - Two fixture modules render and complete through the runtime, in and out of order,
 *    with NO runtime code change between them.
 *  - An unknown or unassigned module slug is refused rather than rendered.
 *  - A worker resumes exactly where he left off, including mid-module.
 *  - Progress, packet, and module visualization derive from server-recorded status, and a
 *    differently composed packet changes the denominator with no change here.
 *  - No business module exists, and nothing in this suite names one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useParams: () => ({}),
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

vi.mock("@/lib/workforce/onboardingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/onboardingApi")>();
  return { ...actual, completeOnboardingModule: vi.fn() };
});

// Phase 3. The dashboard now asks the status authority what is waiting on MW4H.
vi.mock("@/lib/workforce/onboardingStatusApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingStatusApi")>();
  return {
    ...actual,
    getOnboardingWorkerStatus: vi.fn(),
    getOnboardingWorkerCompletionDetail: vi.fn(),
  };
});

const {
  getOnboardingRuntime,
  getOnboardingPacket,
  getRuntimeModuleDraft,
  saveRuntimeModuleDraft,
} = await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, onboardingWorkerFetch, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const { getOnboardingWorkerStatus, getOnboardingWorkerCompletionDetail } = await import(
  "@/lib/workforce/onboardingStatusApi"
);

const { OnboardingRuntimeProvider, useOnboardingRuntime } = await import(
  "./OnboardingRuntimeContext"
);
const { default: OnboardingModuleHost } = await import("./OnboardingModuleHost");
const { default: OnboardingDashboard } = await import("./OnboardingDashboard");
const { default: OnboardingPacketView } = await import("./OnboardingPacketView");
const {
  registerOnboardingModuleRenderer,
  resetOnboardingModuleRenderers,
} = await import("./moduleRegistry");
const {
  INVOCATION_ID,
  fixtureModule,
  fixturePacket,
  fixtureRuntime,
  fixtureStatus,
  step,
  twoModulePacket,
  RESTART_CLOSED,
  RESTART_RE_ENTERABLE,
} = await import("./runtimeTestFixtures");

/**
 * Two fixture module renderers, defined ENTIRELY in this file. Registering them is the only
 * thing that makes them renderable; no runtime file mentions either.
 */
function registerFixtureRenderers(): void {
  registerOnboardingModuleRenderer("FIXTURE_ALPHA", ({ draft, setValue, complete }) => (
    <div data-testid="alpha-renderer">
      <label className="wf-field">
        <span className="wf-label">Your alpha answer</span>
        <input
          className="wf-input"
          aria-label="Alpha answer"
          value={String(draft.alphaAnswer ?? "")}
          onChange={(event) => setValue("alphaAnswer", event.target.value)}
        />
      </label>
      <button type="button" onClick={() => void complete()}>
        Finish Alpha
      </button>
    </div>
  ));

  registerOnboardingModuleRenderer("FIXTURE_BETA", ({ step, draft, setValue, complete }) => (
    <div data-testid="beta-renderer">
      <label className="wf-field">
        <span className="wf-label">Your beta answer</span>
        <input
          className="wf-input"
          aria-label={`Beta ${step.slug}`}
          value={String(draft[step.slug] ?? "")}
          onChange={(event) => setValue(step.slug, event.target.value)}
        />
      </label>
      <button type="button" onClick={() => void complete()}>
        Finish Beta
      </button>
    </div>
  ));
}

function renderWithRuntime(ui: React.ReactNode) {
  return render(<OnboardingRuntimeProvider>{ui}</OnboardingRuntimeProvider>);
}

/**
 * The same packet as the SERVER reports it once FIXTURE_ALPHA is recorded complete.
 *
 * Every field is stated as a fixture VALUE, including the action the server now offers on a
 * completed module, so what these suites prove is that the runtime renders the server's answer
 * rather than that it can reproduce the server's reasoning.
 */
function completedAlphaPacket() {
  return twoModulePacket({
    modules: [
      fixtureModule({
        moduleKey: "FIXTURE_ALPHA",
        title: "Fixture Alpha",
        position: 1,
        status: "COMPLETE",
        steps: [step("one", "Alpha question one", true)],
        resumeStepSlug: "one",
        actionable: false,
        restart: RESTART_RE_ENTERABLE,
        workerAction: "EDIT",
        derivedStatus: fixtureStatus({
          state: "COMPLETE",
          label: "Complete",
          outstanding: false,
          workerActionable: false,
        }),
      }),
      fixtureModule({
        moduleKey: "FIXTURE_BETA",
        title: "Fixture Beta",
        position: 2,
        steps: [step("first", "Beta question one"), step("second", "Beta question two")],
        resumeStepSlug: "first",
      }),
    ],
  });
}

beforeEach(() => {
  localStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: "candidate-fixture-1",
  });
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
    packetId: "pkt-fixture-1",
    moduleKey: "FIXTURE_ALPHA",
    data: {},
    updatedAt: null,
  });
  vi.mocked(saveRuntimeModuleDraft).mockImplementation(async (_i, _m, data) => ({
    packetId: "pkt-fixture-1",
    moduleKey: "FIXTURE_ALPHA",
    data,
    updatedAt: new Date().toISOString(),
  }));
  vi.mocked(completeOnboardingModule).mockResolvedValue({
    moduleKey: "FIXTURE_ALPHA",
    completionId: "cmp-1",
    effectiveFrom: new Date().toISOString(),
    versionCreated: true,
    alreadyComplete: false,
    completion: { complete: false, requiredCount: 2, completeCount: 1 },
    nextModuleKey: "FIXTURE_BETA",
  });
  // Nothing waiting on MW4H unless a test says otherwise, so the dashboard's Phase 3 panel
  // stays silent and these Phase 1 assertions keep testing what they were written to test.
  vi.mocked(getOnboardingWorkerStatus).mockResolvedValue({
    candidateId: "candidate-fixture-1",
    audience: "WORKER",
    packets: [],
    awaitingAdministrativeAction: [],
    generatedAt: new Date().toISOString(),
  });
  vi.mocked(getOnboardingWorkerCompletionDetail).mockResolvedValue({
    candidateId: "candidate-fixture-1",
    audience: "WORKER",
    published: {
      state: "NOT_YET_PUBLISHED",
      publishedAt: null,
      packetId: null,
      packetVersion: null,
      label: "Onboarding has not published a completion",
    },
    modules: [],
    generatedAt: new Date().toISOString(),
  });
  registerFixtureRenderers();
});

afterEach(() => {
  cleanup();
  resetOnboardingModuleRenderers();
  vi.clearAllMocks();
});

// ==========================================================================
// Fixture modules render through the runtime unchanged
// ==========================================================================

describe("hosting fixture modules", () => {
  it("renders a registered fixture module with no runtime code change", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    expect(await screen.findByTestId("alpha-renderer")).toBeTruthy();
    // The step heading comes from the MODULE's declared step, not from the runtime.
    expect(
      screen.getByRole("heading", { name: "Alpha question one" }),
    ).toBeTruthy();
  });

  it("renders a SECOND fixture module through the same runtime, unchanged", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-beta"
        stepSlug="first"
      />,
    );

    expect(await screen.findByTestId("beta-renderer")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Beta question one" })).toBeTruthy();
  });

  it("reports an unregistered module plainly rather than rendering a blank section", async () => {
    resetOnboardingModuleRenderers();
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-unrendered-module="FIXTURE_ALPHA"]'),
      ).toBeTruthy();
    });
  });

  it("passes the module its own captured input and records answers back", async () => {
    vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
      packetId: "pkt-fixture-1",
      moduleKey: "FIXTURE_ALPHA",
      data: { alphaAnswer: "already here" },
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    const input = (await screen.findByLabelText("Alpha answer")) as HTMLInputElement;
    expect(input.value).toBe("already here");

    fireEvent.change(input, { target: { value: "changed" } });
    expect((screen.getByLabelText("Alpha answer") as HTMLInputElement).value).toBe(
      "changed",
    );
  });

  it("completes a module through its own endpoint and re-reads the projection", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    vi.mocked(getOnboardingPacket).mockResolvedValue(completedAlphaPacket());

    fireEvent.click(await screen.findByText("Finish Alpha"));

    await waitFor(() => {
      // Addressed to the module, and stating the packet the answers were captured in, so
      // completion cannot be recorded against a packet this session has moved off.
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledWith("FIXTURE_ALPHA", {
        invocationId: INVOCATION_ID,
      });
    });

    // The projection is re-read rather than patched locally: status, progress, next module,
    // and resume target all changed on the server. ONE PACKET IS RE-READ, not the worker's
    // whole onboarding history, which is the same read a packet with many historical packets
    // behind it would otherwise pay for.
    await waitFor(() => {
      expect(vi.mocked(getOnboardingPacket)).toHaveBeenCalledWith(INVOCATION_ID);
    });
    expect(vi.mocked(getOnboardingRuntime).mock.calls.length).toBe(1);
  });

  /**
   * FINISHING A SECTION DOES NOT WALK THE WORKER OUT OF THE WORKSPACE.
   *
   * The container used to send him back to "Your sections" on every ordinary completion. In
   * practice that took him away from whatever the section had just put in front of him - a
   * confirmation, a copy of his own record, a result he had not read yet - and made moving
   * through onboarding a series of returns to a menu. The rail is the navigation; leaving is
   * something he chooses.
   */
  it("keeps the worker in the workspace once a module completes", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
    vi.mocked(getOnboardingPacket).mockResolvedValue(completedAlphaPacket());

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    fireEvent.click(await screen.findByText("Finish Alpha"));

    // The completion is recorded and the packet is brought up to date, and that is all that
    // happens: no navigation of any kind, to his sections or anywhere else.
    await waitFor(() => {
      expect(vi.mocked(getOnboardingPacket)).toHaveBeenCalledWith(INVOCATION_ID);
    });
    expect(push).not.toHaveBeenCalled();
  });

  /**
   * The case that made the old behaviour a defect rather than a preference.
   *
   * A section whose completion leaves something the worker must still read, keep or
   * acknowledge has to be able to show it to him. Under the old rule the container decided to
   * leave and the content went with it; now nothing needs to ask permission to stay.
   */
  it("leaves required post-act content on screen after completion", async () => {
    registerOnboardingModuleRenderer("FIXTURE_TERMINAL", ({ complete }) => (
      <div data-testid="terminal-renderer">
        <button type="button" onClick={() => void complete()}>
          Finish Terminal
        </button>
      </div>
    ));
    vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
      packetId: "pkt-fixture-1",
      moduleKey: "FIXTURE_TERMINAL",
      data: {},
      updatedAt: null,
    });
    const packet = fixturePacket({
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_TERMINAL",
          title: "Fixture Terminal",
          steps: [step("one", "The only question")],
          resumeStepSlug: "one",
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));
    vi.mocked(getOnboardingPacket).mockResolvedValue(packet);

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-terminal"
        stepSlug="one"
      />,
    );

    fireEvent.click(await screen.findByText("Finish Terminal"));

    // The completion is recorded and the packet is brought up to date exactly as before.
    // What does not happen is the worker being taken off the content he was left with.
    await waitFor(() => {
      expect(vi.mocked(getOnboardingPacket)).toHaveBeenCalledWith(INVOCATION_ID);
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("terminal-renderer")).toBeTruthy();
  });

  it("records nothing about where the browser went next", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
    vi.mocked(getOnboardingPacket).mockResolvedValue(completedAlphaPacket());

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    fireEvent.click(await screen.findByText("Finish Alpha"));

    // WHERE THE WORKER GOES IS NOT PART OF WHAT IS RECORDED. The completion request carries
    // the module and its packet, and nothing about the screen he sees afterwards.
    await waitFor(() => {
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledWith("FIXTURE_ALPHA", {
        invocationId: INVOCATION_ID,
      });
    });
  });
});

// ==========================================================================
// The packet projection, kept current without a browser reload (QA-L5-FUNC-1)
// ==========================================================================

/**
 * A worker write performed through the ONE shared transport, by a caller the runtime knows
 * nothing about.
 *
 * This is how a module that completes through its OWN governed endpoint - a certification, an
 * execution - reaches the runtime: it does not. The transport says a write succeeded, and the
 * runtime re-reads. Nothing here names a module, and nothing about the write is inspected.
 */
async function writeThroughTheSharedTransport(path: string): Promise<void> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ ok: true, value: {} }),
    })),
  );
  try {
    await onboardingWorkerFetch(path, { method: "POST", body: {} });
  } finally {
    vi.unstubAllGlobals();
  }
}

describe("keeping the packet projection current", () => {
  it("re-reads the packet after a module's own governed write, with no browser reload", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
    vi.mocked(getOnboardingPacket).mockResolvedValue(completedAlphaPacket());

    const view = renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    await screen.findByTestId("alpha-renderer");
    // Nothing has been written, so nothing is re-read. A refresh on every navigation would
    // be a request per screen for an answer that had not changed.
    expect(vi.mocked(getOnboardingPacket)).not.toHaveBeenCalled();
    expect(screen.getByText("0 of 2 sections complete")).toBeTruthy();

    await act(async () => {
      await writeThroughTheSharedTransport(
        "/workforce/onboarding/modules/fixture-alpha/some-governed-act",
      );
    });

    // Client-side navigation to another screen of the same packet.
    view.rerender(
      <OnboardingRuntimeProvider>
        <OnboardingModuleHost
          invocationId={INVOCATION_ID}
          moduleSlug="fixture-beta"
          stepSlug="first"
        />
      </OnboardingRuntimeProvider>,
    );

    // The rail and the progress counter now say what the SERVER says, without an F5, and
    // one packet was re-read rather than the worker's entire runtime.
    await waitFor(() => {
      expect(screen.getByText("1 of 2 sections complete")).toBeTruthy();
    });
    expect(vi.mocked(getOnboardingPacket)).toHaveBeenCalledWith(INVOCATION_ID);
    expect(vi.mocked(getOnboardingRuntime).mock.calls.length).toBe(1);

    const rail = document.querySelector('[data-module-key="FIXTURE_ALPHA"]');
    expect(rail?.querySelector('[data-state="COMPLETE"]')).toBeTruthy();
  });

  it("re-reads the packet when the worker lands on his sections after a write", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
    vi.mocked(getOnboardingPacket).mockResolvedValue(completedAlphaPacket());

    const view = renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );
    await screen.findByTestId("alpha-renderer");

    await act(async () => {
      await writeThroughTheSharedTransport(
        "/workforce/onboarding/modules/fixture-alpha/some-governed-act",
      );
    });

    view.rerender(
      <OnboardingRuntimeProvider>
        <OnboardingPacketView invocationId={INVOCATION_ID} />
      </OnboardingRuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("1 of 2 sections complete")).toBeTruthy();
    });
    const card = document.querySelector('[data-module-key="FIXTURE_ALPHA"]');
    expect(card?.getAttribute("data-worker-action")).toBe("EDIT");
    expect(vi.mocked(getOnboardingRuntime).mock.calls.length).toBe(1);
  });

  it("asks for nothing when no write has happened", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    await screen.findByText("Your sections");
    expect(vi.mocked(getOnboardingPacket)).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// Routing
// ==========================================================================

describe("module routing", () => {
  it("refuses a module slug that is not in the worker's packet", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-not-assigned"
        stepSlug="one"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="NOT_ROUTABLE"]')).toBeTruthy();
    });
    expect(screen.queryByTestId("alpha-renderer")).toBeNull();
  });

  it("refuses a step the module never declared", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="invented"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="NOT_ROUTABLE"]')).toBeTruthy();
    });
    expect(screen.queryByTestId("alpha-renderer")).toBeNull();
  });

  it("refuses a packet the worker does not hold", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId="inv-someone-else"
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="NOT_ROUTABLE"]')).toBeTruthy();
    });
  });

  it("puts an unknown packet identifier to the server and renders its refusal", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
    vi.mocked(getOnboardingPacket).mockRejectedValue(
      new OnboardingApiError("Not yours", 403, "INVOCATION_NOT_OWNED_BY_WORKER"),
    );

    renderWithRuntime(<OnboardingPacketView invocationId="inv-someone-else" />);

    // The identifier was already unreachable. Asking the server anyway is what puts the
    // attempt in the audit trail rather than leaving it as a client-side dead end.
    await waitFor(() => {
      expect(vi.mocked(getOnboardingPacket)).toHaveBeenCalledWith("inv-someone-else");
    });
    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="NOT_AUTHORIZED"]')).toBeTruthy();
    });
  });
});

// ==========================================================================
// Resume
// ==========================================================================

describe("resume", () => {
  it("offers a resume action pointing at the server's resume target", async () => {
    const packet = twoModulePacket({
      resume: {
        invocationId: INVOCATION_ID,
        moduleKey: "FIXTURE_BETA",
        moduleSlug: "fixture-beta",
        stepSlug: "second",
      },
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingDashboard />);

    const link = (await screen.findByText(
      "Continue where I left off",
    )) as HTMLAnchorElement;
    // Mid-module: the second step of the second module, exactly as the server resolved it.
    expect(link.getAttribute("href")).toBe(
      `/workforce/onboarding/${INVOCATION_ID}/fixture-beta/second`,
    );
  });

  it("resumes mid-module rather than at the start of the module", async () => {
    const packet = twoModulePacket({
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_BETA",
          title: "Fixture Beta",
          steps: [
            step("first", "Beta question one", true),
            step("second", "Beta question two", false),
          ],
          resumeStepSlug: "second",
          // The SERVER's answer for a module already under way, in the ratified vocabulary.
          workerAction: "CONTINUE",
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    const link = (await screen.findByText("Continue")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/fixture-beta/second");
  });

  it("offers no resume action once everything is complete", async () => {
    const packet = fixturePacket({
      packetState: "DERIVED_COMPLETE",
      active: false,
      resume: null,
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_ALPHA",
          status: "COMPLETE",
          actionable: false,
          restart: RESTART_RE_ENTERABLE,
          steps: [step("one", "Alpha question one", true)],
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingDashboard />);

    expect(await screen.findByText("Your onboarding is complete")).toBeTruthy();
    expect(screen.queryByText("Continue where I left off")).toBeNull();
  });

  it("keeps unsaved answers when the worker navigates between steps", async () => {
    vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
      packetId: "pkt-fixture-1",
      moduleKey: "FIXTURE_BETA",
      data: {},
      updatedAt: null,
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    const { rerender } = renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-beta"
        stepSlug="first"
      />,
    );

    fireEvent.change(await screen.findByLabelText("Beta first"), {
      target: { value: "typed but not saved" },
    });

    // Moving to the module's next step must not re-read and discard the draft.
    rerender(
      <OnboardingRuntimeProvider>
        <OnboardingModuleHost
          invocationId={INVOCATION_ID}
          moduleSlug="fixture-beta"
          stepSlug="second"
        />
      </OnboardingRuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Beta second")).toBeTruthy();
    });
  });
});

// ==========================================================================
// Out-of-order completion
// ==========================================================================

describe("out-of-order completion", () => {
  it("renders a later module complete and an earlier one outstanding", async () => {
    const packet = fixturePacket({
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_ALPHA",
          title: "Fixture Alpha",
          position: 1,
          status: "PENDING",
        }),
        fixtureModule({
          moduleKey: "FIXTURE_BETA",
          title: "Fixture Beta",
          position: 2,
          status: "COMPLETE",
          actionable: false,
          restart: RESTART_RE_ENTERABLE,
          steps: [step("first", "Beta question one", true)],
          derivedStatus: fixtureStatus({
            state: "COMPLETE",
            label: "Complete",
            outstanding: false,
            workerActionable: false,
          }),
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    await screen.findByText("Fixture Alpha");
    const alpha = document.querySelector('[data-module-key="FIXTURE_ALPHA"]');
    const beta = document.querySelector('[data-module-key="FIXTURE_BETA"]');

    // Position in the list decides nothing. Each card shows its own recorded status, in the
    // state the server derived for it.
    expect(alpha?.querySelector('[data-state="NOT_STARTED"]')).toBeTruthy();
    expect(beta?.querySelector('[data-state="COMPLETE"]')).toBeTruthy();
  });

  it("offers re-entry into a completed module, and says what re-entry does", async () => {
    const packet = fixturePacket({
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_ALPHA",
          status: "COMPLETE",
          actionable: false,
          restart: RESTART_RE_ENTERABLE,
          steps: [step("one", "Alpha question one", true)],
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-restart-posture="RE_ENTERABLE"]'),
      ).toBeTruthy();
    });
    expect(screen.getByText(/does not erase what you supplied before/i)).toBeTruthy();
  });

  it("does not offer an action on a module the server marked unavailable", async () => {
    const packet = fixturePacket({
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_ALPHA",
          status: "BLOCKED",
          actionable: false,
          restart: RESTART_CLOSED,
          // A governed dependency is unsatisfied, so the server names no action at all.
          workerAction: "NONE",
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    const card = await waitFor(() => {
      const found = document.querySelector('[data-module-key="FIXTURE_ALPHA"]');
      expect(found).toBeTruthy();
      return found as Element;
    });
    expect(card.querySelector("a")).toBeNull();
  });
});

// ==========================================================================
// Status and action are different things (QA-L5-UX-3)
// ==========================================================================

/**
 * A packet screen answers three questions about each section, and they are not the same
 * question: what it is, where it stands, and what the worker may do about it.
 *
 * Every module below states its action as a fixture VALUE, because the action is the SERVER's
 * answer. Nothing in the runtime works out that a completed section happens to be re-enterable
 * or that an outstanding one happens to be reachable - it is told, and it renders what it was
 * told. That is what keeps the screen from offering a worker something the server would refuse.
 */
describe("status, and the action beside it", () => {
  async function openPacketWith(modules: ReturnType<typeof fixtureModule>[]) {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [fixturePacket({ modules })] }),
    );
    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);
    await screen.findByText("Your sections");
  }

  function card(moduleKey: string): Element {
    const found = document.querySelector(`[data-module-key="${moduleKey}"]`);
    if (!found) throw new Error(`no card for ${moduleKey}`);
    return found;
  }

  /** The one control the card offers, if it offers one. */
  function action(moduleKey: string): HTMLAnchorElement | null {
    return card(moduleKey).querySelector("[data-module-action]");
  }

  it("says the ratified word for each thing the server says he may do", async () => {
    await openPacketWith([
      fixtureModule({
        moduleKey: "FIXTURE_ALPHA",
        title: "Nothing entered yet",
        position: 1,
        status: "PENDING",
        workerAction: "ENTER",
      }),
      fixtureModule({
        moduleKey: "FIXTURE_BETA",
        title: "Part way through",
        position: 2,
        // The RECORD is still pending - being part way through is the status authority's
        // answer, not a fifth record state - and the action follows the authority.
        status: "PENDING",
        steps: [step("first", "Beta question one", true), step("second", "Beta two")],
        resumeStepSlug: "second",
        workerAction: "CONTINUE",
        derivedStatus: fixtureStatus({ state: "IN_PROGRESS", label: "In progress" }),
      }),
      fixtureModule({
        moduleKey: "FIXTURE_GAMMA",
        title: "Finished, and his to change",
        position: 3,
        status: "COMPLETE",
        actionable: false,
        restart: RESTART_RE_ENTERABLE,
        workerAction: "EDIT",
        derivedStatus: fixtureStatus({
          state: "COMPLETE",
          label: "Complete",
          outstanding: false,
          workerActionable: false,
        }),
      }),
      fixtureModule({
        moduleKey: "FIXTURE_DELTA",
        title: "With our staff",
        position: 4,
        status: "PENDING",
        actionable: false,
        restart: RESTART_CLOSED,
        workerAction: "VIEW",
        derivedStatus: fixtureStatus({
          state: "WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION",
          label: "With our team",
          workerActionable: false,
          awaitingAdministrativeAction: true,
        }),
      }),
    ]);

    expect(action("FIXTURE_ALPHA")?.textContent).toBe("Enter Info");
    expect(action("FIXTURE_BETA")?.textContent).toBe("Continue");
    expect(action("FIXTURE_GAMMA")?.textContent).toBe("Edit Info");
    expect(action("FIXTURE_DELTA")?.textContent).toBe("View Info");
  });

  it("shows the status as a statement, and never as the thing he presses", async () => {
    await openPacketWith([
      fixtureModule({
        moduleKey: "FIXTURE_ALPHA",
        title: "Fixture Alpha",
        status: "COMPLETE",
        actionable: false,
        restart: RESTART_RE_ENTERABLE,
        workerAction: "EDIT",
        derivedStatus: fixtureStatus({
          state: "COMPLETE",
          label: "Complete",
          outstanding: false,
          workerActionable: false,
        }),
      }),
    ]);

    const alpha = card("FIXTURE_ALPHA");
    // THE NAME, THE STATUS AND THE ACTION ARE THREE THINGS. The status says where the section
    // stands; it is not a link, not a button, and not inside the one control on the card.
    expect(alpha.querySelector(".ob-module-card-title")?.textContent).toBe("Fixture Alpha");
    const status = alpha.querySelector('[data-state="COMPLETE"]') as HTMLElement;
    expect(status.textContent).toBe("Complete");
    expect(status.closest("a")).toBeNull();
    expect(status.closest("button")).toBeNull();
    expect(status.querySelector("[data-module-action]")).toBeNull();

    // And the one control says what pressing it does, rather than repeating the status.
    const control = action("FIXTURE_ALPHA") as HTMLAnchorElement;
    expect(control.textContent).toBe("Edit Info");
    expect(alpha.querySelectorAll("[data-module-action]")).toHaveLength(1);
  });

  it("offers no way in where the server closed the module, however complete it is", async () => {
    await openPacketWith([
      fixtureModule({
        moduleKey: "FIXTURE_ALPHA",
        title: "Fixture Alpha",
        status: "COMPLETE",
        actionable: false,
        // A packet that has left the worker's hands. The record stands; changing it does not.
        restart: RESTART_CLOSED,
        workerAction: "NONE",
        derivedStatus: fixtureStatus({
          state: "COMPLETE",
          label: "Complete",
          outstanding: false,
          workerActionable: false,
        }),
      }),
    ]);

    // He is still told where it stands. He is simply not offered an edit the server would
    // refuse, and the card does not infer one from the module being complete.
    expect(card("FIXTURE_ALPHA").querySelector('[data-state="COMPLETE"]')).toBeTruthy();
    expect(action("FIXTURE_ALPHA")).toBeNull();
    expect(card("FIXTURE_ALPHA").querySelector("a")).toBeNull();
  });

  it("names no module anywhere in deciding any of it", async () => {
    // THE SAME SERVER ANSWER, ON A MODULE KEY THIS FILE INVENTED. If any of the vocabulary
    // above were reached by recognising a section, an unknown one could not be offered it.
    await openPacketWith([
      fixtureModule({
        moduleKey: "FIXTURE_NEVER_SEEN_BEFORE",
        title: "Something new",
        status: "COMPLETE",
        actionable: false,
        restart: RESTART_RE_ENTERABLE,
        workerAction: "EDIT",
        derivedStatus: fixtureStatus({
          state: "COMPLETE",
          label: "Complete",
          outstanding: false,
          workerActionable: false,
        }),
      }),
    ]);

    expect(action("FIXTURE_NEVER_SEEN_BEFORE")?.textContent).toBe("Edit Info");
  });

  it("lets the worker onto a completed section the server left open to him", async () => {
    await openPacketWith([
      fixtureModule({
        moduleKey: "FIXTURE_ALPHA",
        title: "Fixture Alpha",
        moduleSlug: "fixture-alpha",
        status: "COMPLETE",
        actionable: false,
        restart: RESTART_RE_ENTERABLE,
        steps: [step("one", "Alpha question one", true)],
        resumeStepSlug: "one",
        workerAction: "EDIT",
        derivedStatus: fixtureStatus({
          state: "COMPLETE",
          label: "Complete",
          outstanding: false,
          workerActionable: false,
        }),
      }),
    ]);

    // The rail agrees with the card, because both read the same server answer.
    expect(action("FIXTURE_ALPHA")?.getAttribute("href")).toBe(
      `/workforce/onboarding/${INVOCATION_ID}/fixture-alpha/one`,
    );
  });
});

// ==========================================================================
// Server-derived visualization
// ==========================================================================

describe("progress, packet, and module visualization", () => {
  /**
   * GLOBAL INCOMPLETENESS IS NOT WORK THE WORKER STILL OWES.
   *
   * The card used to show "Outstanding" as required minus complete. A section finished by the
   * worker and waiting on MW4H is incomplete and is not his, so that arithmetic told a worker
   * who had done everything asked of him that he had tasks left. The count is the server's,
   * derived from the same status authority that words the section rows.
   */
  it("counts only what the server says is the worker's, not what is globally incomplete", async () => {
    const packet = fixturePacket({
      completion: { complete: false, requiredCount: 4, completeCount: 2 },
      workerOutstandingCount: 0,
      awaitingAdministrativeActionCount: 1,
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingDashboard />);

    const card = await waitFor(() => {
      const found = document.querySelector(".ob-packet-card");
      expect(found).toBeTruthy();
      return found as Element;
    });
    const facts = card.querySelector(".ob-packet-card-facts")?.textContent ?? "";

    // Two sections are incomplete. Neither is his, and he is told so rather than being
    // handed the number 2.
    expect(facts).toContain("Still to do");
    expect(facts).toContain("Nothing");
    expect(facts).toContain("Waiting on us");
    expect(facts).not.toContain("Outstanding");
  });

  it("shows no internal reason for the packet on any worker surface", async () => {
    const packet = fixturePacket();
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    // The reason a packet exists is a statement by the calling workflow to Jarvis, and reads
    // like one - "QA_WORKER_EXPERIENCE_LAUNCH" is not something to put in front of a worker.
    // It is no longer on the runtime contract at all, so there is nothing here to leak.
    expect(packet).not.toHaveProperty("invocationReason");

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    await screen.findByText("Your sections");
    expect(document.querySelector(".ob-packet-card-purpose")).toBeNull();
  });

  it("renders the server's numerator and denominator without recomputing them", async () => {
    const packet = fixturePacket({
      modules: [
        fixtureModule({ moduleKey: "FIXTURE_ALPHA", status: "COMPLETE" }),
        fixtureModule({ moduleKey: "FIXTURE_BETA", status: "PENDING" }),
      ],
      // A denominator that disagrees with the number of cards proves the runtime reads it
      // rather than counting the list it happens to be rendering.
      completion: { complete: false, requiredCount: 7, completeCount: 3 },
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    expect(await screen.findByText("3 of 7 sections complete")).toBeTruthy();
  });

  it("changes the displayed denominator when the server composes a different packet, with no client change", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          fixturePacket({
            completion: { complete: false, requiredCount: 2, completeCount: 0 },
          }),
        ],
      }),
    );
    const first = renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);
    expect(await screen.findByText("0 of 2 sections complete")).toBeTruthy();
    first.unmount();

    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          fixturePacket({
            completion: { complete: false, requiredCount: 5, completeCount: 0 },
          }),
        ],
      }),
    );
    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);
    expect(await screen.findByText("0 of 5 sections complete")).toBeTruthy();
  });

  it("shows the whole obligation, including modules not yet reachable", async () => {
    const packet = fixturePacket({
      modules: [
        fixtureModule({ moduleKey: "FIXTURE_ALPHA", title: "Fixture Alpha" }),
        fixtureModule({
          moduleKey: "FIXTURE_BETA",
          title: "Fixture Beta",
          status: "BLOCKED",
          actionable: false,
          restart: RESTART_CLOSED,
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    expect(await screen.findByText("Fixture Alpha")).toBeTruthy();
    expect(screen.getByText("Fixture Beta")).toBeTruthy();
  });

  it("renders the steps the module declared, and which are already answered", async () => {
    const packet = twoModulePacket({
      modules: [
        fixtureModule({
          moduleKey: "FIXTURE_BETA",
          title: "Fixture Beta",
          steps: [
            step("first", "Beta question one", true),
            step("second", "Beta question two", false),
          ],
          resumeStepSlug: "second",
        }),
      ],
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-beta"
        stepSlug="second"
      />,
    );

    await screen.findByTestId("beta-renderer");
    expect(screen.getByText("Question 2 of 2")).toBeTruthy();
    expect(
      document.querySelector('[data-step-slug="first"]')?.className,
    ).toContain("is-done");
  });

  it("asks for a selection only when more than one packet is still active", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [fixturePacket()] }),
    );
    const single = renderWithRuntime(<OnboardingDashboard />);
    await screen.findByText("Your onboarding");
    expect(screen.queryByText("Choose which one to look at")).toBeNull();
    single.unmount();

    // One live packet and one finished one. There is only one packet he could work in, so
    // asking him to choose would be presenting a choice that is not a choice - while his
    // finished packet is still listed, because it is still his record.
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          fixturePacket({ invocationId: "inv-1", bound: true }),
          fixturePacket({ invocationId: "inv-2", bound: false, active: false }),
        ],
      }),
    );
    const mixed = renderWithRuntime(<OnboardingDashboard />);
    await screen.findByText("Your onboarding");
    expect(screen.queryByText("Choose which one to look at")).toBeNull();
    expect(document.querySelector('[data-invocation-id="inv-2"]')).toBeTruthy();
    mixed.unmount();

    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          fixturePacket({ invocationId: "inv-1", bound: true }),
          fixturePacket({ invocationId: "inv-2", bound: false, active: true }),
        ],
      }),
    );
    renderWithRuntime(<OnboardingDashboard />);
    expect(await screen.findByText("Choose which one to look at")).toBeTruthy();
  });

  it("renders nothing-assigned as a normal state rather than an error", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [] }));

    renderWithRuntime(<OnboardingDashboard />);

    expect(await screen.findByText("You have no onboarding to complete")).toBeTruthy();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("offers the shared completion drill-down, fed by the worker status projection", async () => {
    vi.mocked(getOnboardingWorkerCompletionDetail).mockResolvedValue({
      candidateId: "candidate-fixture-1",
      audience: "WORKER",
      published: {
        state: "NOT_YET_PUBLISHED",
        publishedAt: null,
        packetId: null,
        packetVersion: null,
        label: "Onboarding has not published a completion",
      },
      modules: [
        {
          moduleKey: "FIXTURE_ALPHA",
          moduleNumber: "F1",
          title: "Fixture Alpha",
          status: { state: "COMPLETE", label: "Complete", outstanding: false },
          recordedOutcome: null,
          completedAt: "2026-03-01T11:00:00.000Z",
        },
      ],
      generatedAt: new Date().toISOString(),
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime());

    renderWithRuntime(<OnboardingDashboard />);

    // Reachable from the worker runtime, and rendered by the shared Phase 3 panel rather
    // than by anything the runtime words for itself.
    const panel = await screen.findByTestId("worker-completion-detail");
    expect(panel.querySelector(".obs-detail-list")).toBeTruthy();
    expect(panel.textContent).toContain("F1 Fixture Alpha");
    expect(panel.textContent).toContain("Complete");
  });
});

// ==========================================================================
// Accessibility
// ==========================================================================

describe("accessibility", () => {
  it("exposes progress as a labelled progressbar", async () => {
    const packet = fixturePacket({
      completion: { complete: false, requiredCount: 4, completeCount: 1 },
    });
    vi.mocked(getOnboardingRuntime).mockResolvedValue(fixtureRuntime({ packets: [packet] }));

    renderWithRuntime(<OnboardingPacketView invocationId={INVOCATION_ID} />);

    const bar = await screen.findByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
    expect(bar.getAttribute("aria-valuetext")).toBe("1 of 4 sections complete");
  });

  it("names the packet rail and marks the current module as the current step", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    const rail = await screen.findByRole("navigation", {
      name: "Sections of your onboarding",
    });
    expect(rail).toBeTruthy();
    expect(
      rail.querySelector('[data-module-key="FIXTURE_ALPHA"]')?.getAttribute("aria-current"),
    ).toBe("step");
  });

  it("names the step rail within a module", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-beta"
        stepSlug="first"
      />,
    );

    expect(
      await screen.findByRole("navigation", { name: "Questions in Fixture Beta" }),
    ).toBeTruthy();
  });

  it("gives every runtime screen a single top-level heading", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    await screen.findByTestId("alpha-renderer");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("marks packet sections with accessible section headings", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [fixturePacket()] }),
    );

    renderWithRuntime(<OnboardingDashboard />);

    const section = await waitFor(() => {
      const found = document.querySelector('[aria-labelledby="ob-outstanding"]');
      expect(found).toBeTruthy();
      return found as Element;
    });
    expect(section.querySelector("#ob-outstanding")?.textContent).toBe("In progress");
  });
});

// ==========================================================================
// No business module exists
// ==========================================================================

describe("phase boundary", () => {
  it("registers no module renderer by default", async () => {
    resetOnboardingModuleRenderers();
    const { resolveOnboardingModuleRenderer } = await import("./moduleRegistry");

    // The registry is empty until a module capsule registers itself, exactly like the
    // server registry. This phase ships no business module.
    expect(resolveOnboardingModuleRenderer("FIXTURE_ALPHA")).toBeUndefined();
    expect(resolveOnboardingModuleRenderer("ANY_MODULE")).toBeUndefined();
  });
});

// ==========================================================================
// The leave guard
// ==========================================================================

/**
 * The runtime seam a module uses to protect state the draft cycle does not carry.
 *
 * Everything below is proven with FIXTURES, exactly as the rest of this suite is, and for the
 * same reason: the seam is generic, so a proof that depended on a real module would be proving
 * something else. The runtime holds one guard, consults it before a transition, and does
 * nothing else - it does not save, discard, complete, or inspect whatever the module is
 * protecting, and none of the tests here can tell what that is.
 */

/** Registers a guard that always blocks and records that it was asked. */
function Guarding({ id, log }: { id: string; log: string[] }) {
  const { registerLeaveGuard } = useOnboardingRuntime();
  useEffect(
    () =>
      registerLeaveGuard(() => {
        log.push(id);
        return "BLOCK";
      }),
    [id, log, registerLeaveGuard],
  );
  return <span data-testid={`guarding-${id}`} />;
}

/** A bench for registration, disposal, and asking to leave, with no module in sight. */
function GuardBench({ log }: { log: string[] }) {
  const { leaveGuardActive, requestLeave } = useOnboardingRuntime();
  const [mounted, setMounted] = useState<string[]>([]);

  return (
    <div>
      <span data-testid="guard-active">{String(leaveGuardActive)}</span>
      <button type="button" onClick={() => setMounted((now) => [...now, "A"])}>
        mount A
      </button>
      <button type="button" onClick={() => setMounted((now) => [...now, "B"])}>
        mount B
      </button>
      <button
        type="button"
        onClick={() => setMounted((now) => now.filter((id) => id !== "A"))}
      >
        unmount A
      </button>
      <button type="button" onClick={() => requestLeave(() => log.push("LEFT"))}>
        leave
      </button>
      {mounted.map((id) => (
        <Guarding key={id} id={id} log={log} />
      ))}
    </div>
  );
}

describe("the generic leave guard", () => {
  it("runs the transition immediately when no module has registered a guard", () => {
    const log: string[] = [];
    renderWithRuntime(<GuardBench log={log} />);

    expect(screen.getByTestId("guard-active").textContent).toBe("false");
    fireEvent.click(screen.getByText("leave"));

    // Synchronously, in the click itself: an unguarded transition is not deferred, queued,
    // or made asynchronous by the seam existing.
    expect(log).toEqual(["LEFT"]);
  });

  it("consults a registered guard instead, and leaves when it blocks", () => {
    const log: string[] = [];
    renderWithRuntime(<GuardBench log={log} />);

    fireEvent.click(screen.getByText("mount A"));
    expect(screen.getByTestId("guard-active").textContent).toBe("true");

    fireEvent.click(screen.getByText("leave"));
    expect(log).toEqual(["A"]);
  });

  it("holds only the newest guard", () => {
    const log: string[] = [];
    renderWithRuntime(<GuardBench log={log} />);

    fireEvent.click(screen.getByText("mount A"));
    fireEvent.click(screen.getByText("mount B"));
    fireEvent.click(screen.getByText("leave"));

    expect(log).toEqual(["B"]);
  });

  it("does not let a departing module's cleanup clear its successor's guard", () => {
    const log: string[] = [];
    renderWithRuntime(<GuardBench log={log} />);

    fireEvent.click(screen.getByText("mount A"));
    fireEvent.click(screen.getByText("mount B"));
    // A goes away AFTER B registered. Its disposer is identity-checked, so it clears
    // nothing - without that, B would be silently unprotected from here on.
    fireEvent.click(screen.getByText("unmount A"));

    expect(screen.getByTestId("guard-active").textContent).toBe("true");
    fireEvent.click(screen.getByText("leave"));
    expect(log).toEqual(["B"]);
  });

  it("stops guarding once the guarding module is gone", () => {
    const log: string[] = [];
    renderWithRuntime(<GuardBench log={log} />);

    fireEvent.click(screen.getByText("mount A"));
    fireEvent.click(screen.getByText("unmount A"));

    expect(screen.getByTestId("guard-active").textContent).toBe("false");
    fireEvent.click(screen.getByText("leave"));
    expect(log).toEqual(["LEFT"]);
  });
});

describe("navigation consults the leave guard", () => {
  /** Consulted count, the decision to give, and the continuation a block retained. */
  let consulted = 0;
  let decision: "LEAVE" | "BLOCK" = "BLOCK";
  let retained: (() => void) | null = null;

  function GuardedFixture() {
    const { registerLeaveGuard } = useOnboardingRuntime();
    useEffect(
      () =>
        registerLeaveGuard(({ proceed }) => {
          consulted += 1;
          if (decision === "LEAVE") return "LEAVE";
          retained = proceed;
          return "BLOCK";
        }),
      [registerLeaveGuard],
    );
    return <div data-testid="guarded-renderer" />;
  }

  beforeEach(() => {
    consulted = 0;
    decision = "BLOCK";
    retained = null;
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
  });

  async function openGuarded(moduleSlug: string, stepSlug: string) {
    registerOnboardingModuleRenderer(
      moduleSlug === "fixture-alpha" ? "FIXTURE_ALPHA" : "FIXTURE_BETA",
      () => <GuardedFixture />,
    );
    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug={moduleSlug}
        stepSlug={stepSlug}
      />,
    );
    await screen.findByTestId("guarded-renderer");
    // The module's registration happens in its effect, and the navigation around it reacts to
    // that registration. Settle both before pressing anything, so what is being asserted is
    // the seam's behaviour rather than a race between a mount and a click.
    await act(async () => {});
  }

  it("asks before Save & finish later, and does not navigate when blocked", async () => {
    await openGuarded("fixture-alpha", "one");

    fireEvent.click(screen.getByText("Save & finish later"));

    expect(consulted).toBe(1);
    await waitFor(() => expect(push).not.toHaveBeenCalled());
  });

  it("asks before Back", async () => {
    await openGuarded("fixture-beta", "second");

    fireEvent.click(screen.getByText("Back"));

    expect(consulted).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("asks before Save & Continue", async () => {
    await openGuarded("fixture-beta", "first");

    fireEvent.click(screen.getByText("Save & Continue"));

    expect(consulted).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("asks before a jump from the packet rail", async () => {
    await openGuarded("fixture-alpha", "one");

    fireEvent.click(screen.getByRole("link", { name: "Fixture Beta" }));

    expect(consulted).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("performs the retained transition when the module releases it", async () => {
    await openGuarded("fixture-alpha", "one");
    fireEvent.click(screen.getByText("Save & finish later"));
    expect(retained).not.toBeNull();

    // The module has made its decision - whatever that meant to it - and hands the
    // navigation back. The guard is not consulted a second time.
    (retained as unknown as () => void)();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/workforce/onboarding"));
    expect(consulted).toBe(1);
  });

  it("permits the transition outright when the guard leaves", async () => {
    decision = "LEAVE";
    await openGuarded("fixture-alpha", "one");

    fireEvent.click(screen.getByText("Save & finish later"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/workforce/onboarding"));
  });

  it("leaves an unguarded module's navigation exactly as it was", async () => {
    // The delivered fixture renderers register no guard at all, which is every module the
    // runtime had before this seam existed.
    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );
    await screen.findByTestId("alpha-renderer");

    fireEvent.click(screen.getByText("Save & finish later"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/workforce/onboarding"));

    // And the rail is still an ordinary link: nothing intercepted it, so nothing routed it.
    // The capture listener stands in for the browser following the href, which jsdom does
    // not implement; it runs before the rail's own handler and changes nothing about it.
    push.mockClear();
    const swallow = (event: Event): void => event.preventDefault();
    document.addEventListener("click", swallow, true);
    fireEvent.click(screen.getByRole("link", { name: "Fixture Beta" }));
    document.removeEventListener("click", swallow, true);
    expect(push).not.toHaveBeenCalled();
  });
});
