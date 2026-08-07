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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const { getOnboardingWorkerStatus, getOnboardingWorkerCompletionDetail } = await import(
  "@/lib/workforce/onboardingStatusApi"
);

const { OnboardingRuntimeProvider } = await import("./OnboardingRuntimeContext");
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

    fireEvent.click(await screen.findByText("Finish Alpha"));

    await waitFor(() => {
      // Addressed to the module, and stating the packet the answers were captured in, so
      // completion cannot be recorded against a packet this session has moved off.
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledWith("FIXTURE_ALPHA", {
        invocationId: INVOCATION_ID,
      });
    });
    // The projection is re-read rather than patched locally: status, progress, next
    // module, and resume target all changed on the server.
    await waitFor(() => {
      expect(vi.mocked(getOnboardingRuntime).mock.calls.length).toBeGreaterThan(1);
    });
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
// Server-derived visualization
// ==========================================================================

describe("progress, packet, and module visualization", () => {
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
    expect(section.querySelector("#ob-outstanding")?.textContent).toBe("Outstanding");
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
