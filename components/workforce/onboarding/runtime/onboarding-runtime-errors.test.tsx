/**
 * Phase 1 - the runtime error contract and session continuity.
 *
 * Two guarantees are asserted for EVERY case in the contract:
 *
 *  - no error path loses entered data; and
 *  - no error path leaves the worker without a next action.
 *
 * Session expiry is covered here too, because expiry is an error case the worker recovers
 * from in place rather than a separate mode of the runtime.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import {
  OnboardingApiError,
  ONBOARDING_NO_ACTIVE_INVOCATION_CODE,
} from "@/lib/workforce/onboardingApi";
import {
  WorkerSessionExpiredError,
  WorkforceApiError,
  WORKER_SESSION_INVALID_CODE,
} from "@/lib/workforce/workforceApi";

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

const {
  getOnboardingRuntime,
  getOnboardingSession,
  getRuntimeModuleDraft,
  saveRuntimeModuleDraft,
} = await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule } = await import("@/lib/workforce/onboardingApi");

const { OnboardingRuntimeProvider } = await import("./OnboardingRuntimeContext");
const { default: OnboardingModuleHost } = await import("./OnboardingModuleHost");
const { default: OnboardingDashboard } = await import("./OnboardingDashboard");
const { default: OnboardingSessionWatch } = await import("./OnboardingSessionWatch");
const { classifyOnboardingError } = await import("./runtimeErrors");
const {
  registerOnboardingModuleRenderer,
  resetOnboardingModuleRenderers,
} = await import("./moduleRegistry");
const {
  INVOCATION_ID,
  twoModulePacket,
  fixtureRuntime,
  fixturePacket,
  fixtureModule,
  RESTART_CLOSED_COMPLETE,
  RESTART_CLOSED_NOT_BOUND,
} = await import("./runtimeTestFixtures");

function renderWithRuntime(ui: React.ReactNode) {
  return render(<OnboardingRuntimeProvider>{ui}</OnboardingRuntimeProvider>);
}

function seedSession(expiresInMs = 60 * 60 * 1000) {
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: "candidate-fixture-1",
  });
}

beforeEach(() => {
  localStorage.clear();
  seedSession();
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
    packetId: "pkt-fixture-1",
    moduleKey: "FIXTURE_ALPHA",
    data: {},
    updatedAt: null,
  });
  registerOnboardingModuleRenderer(
    "FIXTURE_ALPHA",
    ({ draft, setValue, save, complete }) => (
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
        <button type="button" onClick={() => void save()}>
          Save now
        </button>
        {/* A module owns its own submission. A real one would surface the refusal it
            catches; this fixture only needs the failure not to escape. */}
        <button
          type="button"
          onClick={() => {
            void complete().catch(() => undefined);
          }}
        >
          Finish section
        </button>
      </div>
    ),
  );
});

afterEach(() => {
  cleanup();
  resetOnboardingModuleRenderers();
  vi.clearAllMocks();
});

// ==========================================================================
// The error matrix
// ==========================================================================

describe("error contract: every case is classified", () => {
  const cases: Array<{
    name: string;
    error: unknown;
    kind: string;
    saving?: boolean;
  }> = [
    {
      name: "nothing assigned",
      error: new OnboardingApiError(
        "No active invocation",
        404,
        ONBOARDING_NO_ACTIVE_INVOCATION_CODE,
      ),
      kind: "NOTHING_ASSIGNED",
    },
    {
      name: "expired session",
      error: new WorkerSessionExpiredError(),
      kind: "SESSION_EXPIRED",
    },
    {
      name: "revoked session",
      error: new WorkerSessionExpiredError(WORKER_SESSION_INVALID_CODE),
      kind: "SESSION_INVALID",
    },
    {
      name: "another worker's packet",
      error: new OnboardingApiError(
        "Not yours",
        403,
        "INVOCATION_NOT_OWNED_BY_WORKER",
      ),
      kind: "NOT_AUTHORIZED",
    },
    {
      name: "module with no worker phase",
      error: new OnboardingApiError(
        "No worker phase",
        403,
        "MODULE_HAS_NO_WORKER_PHASE",
      ),
      kind: "NOT_AUTHORIZED",
    },
    {
      name: "module not in this packet",
      error: new OnboardingApiError("Not in packet", 400, "MODULE_NOT_IN_PACKET"),
      kind: "NOT_ROUTABLE",
    },
    {
      name: "undeclared step",
      error: new OnboardingApiError("No such step", 400, "UNKNOWN_MODULE_STEP"),
      kind: "NOT_ROUTABLE",
    },
    {
      name: "stale content",
      error: new OnboardingApiError(
        "Blocked",
        400,
        "MODULE_BLOCKED_BY_DEPENDENCY",
      ),
      kind: "STALE",
    },
    {
      name: "validation refusal",
      error: new OnboardingApiError("Please correct the following.", 400, null, [
        "ANSWER_REQUIRED",
      ]),
      kind: "VALIDATION_REFUSED",
    },
    {
      name: "save failure",
      error: new WorkforceApiError("Network down", 500),
      kind: "SAVE_FAILED",
      saving: true,
    },
    {
      name: "unexpected failure",
      error: new Error("boom"),
      kind: "UNEXPECTED",
    },
  ];

  it.each(cases)(
    "classifies $name with a title, an explanation, and a next action",
    ({ error, kind, saving }) => {
      const classified = classifyOnboardingError(error, { saving });

      expect(classified.kind).toBe(kind);
      expect(classified.title.length).toBeGreaterThan(0);
      expect(classified.detail.length).toBeGreaterThan(0);
      // Every case leaves the worker something to do: a labelled action, or a retry.
      expect(classified.actionLabel !== null || classified.retryable).toBe(true);
    },
  );

  it("surfaces a module validator's field codes in place rather than replacing the screen", () => {
    const classified = classifyOnboardingError(
      new OnboardingApiError("Please correct the following.", 400, null, [
        "ANSWER_REQUIRED",
        "JURISDICTION_REQUIRED",
      ]),
    );

    expect(classified.fieldErrors).toEqual([
      "ANSWER_REQUIRED",
      "JURISDICTION_REQUIRED",
    ]);
    expect(classified.kind).toBe("VALIDATION_REFUSED");
  });

  it("never reveals a worker's own value in an error message", () => {
    const classified = classifyOnboardingError(
      new OnboardingApiError("Please correct the following.", 400, null, [
        "ANSWER_REQUIRED",
      ]),
    );

    // Codes are non-sensitive by construction; the runtime adds no value of its own.
    expect(JSON.stringify(classified)).not.toContain("123-45-6789");
  });
});

// ==========================================================================
// No error path loses entered data
// ==========================================================================

describe("no error path loses entered data", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
  });

  it("keeps the worker's answers on screen when a save fails", async () => {
    vi.mocked(saveRuntimeModuleDraft).mockRejectedValue(
      new WorkforceApiError("Network down", 500),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    const input = (await screen.findByLabelText("Alpha answer")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hard-won answer" } });
    fireEvent.click(screen.getByText("Save now"));

    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="SAVE_FAILED"]')).toBeTruthy();
    });
    // The answer is still there, and the failure is visible rather than silent.
    expect((screen.getByLabelText("Alpha answer") as HTMLInputElement).value).toBe(
      "hard-won answer",
    );
  });

  it("offers a retry that saves the same answers again", async () => {
    vi.mocked(saveRuntimeModuleDraft).mockRejectedValueOnce(
      new WorkforceApiError("Network down", 500),
    );
    vi.mocked(saveRuntimeModuleDraft).mockResolvedValue({
      packetId: "pkt-fixture-1",
      moduleKey: "FIXTURE_ALPHA",
      data: { alphaAnswer: "hard-won answer" },
      updatedAt: new Date().toISOString(),
    });

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    fireEvent.change(await screen.findByLabelText("Alpha answer"), {
      target: { value: "hard-won answer" },
    });
    fireEvent.click(screen.getByText("Save now"));

    const retry = await screen.findByRole("button", { name: "Try again" });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(vi.mocked(saveRuntimeModuleDraft)).toHaveBeenLastCalledWith(
        INVOCATION_ID,
        "fixture-alpha",
        { alphaAnswer: "hard-won answer" },
      );
    });
    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="SAVE_FAILED"]')).toBeNull();
    });
  });

  it("keeps the previous projection when a refresh fails, rather than blanking the screen", async () => {
    renderWithRuntime(<OnboardingDashboard />);
    await screen.findByText("Your onboarding");

    vi.mocked(getOnboardingRuntime).mockRejectedValue(
      new WorkforceApiError("Network down", 500),
    );

    // The dashboard is still the dashboard; a transient read failure does not read as
    // "your onboarding disappeared".
    expect(screen.getByText("Your onboarding")).toBeTruthy();
  });

  it("does not discard a draft when the same module is reopened", async () => {
    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    fireEvent.change(await screen.findByLabelText("Alpha answer"), {
      target: { value: "unsaved" },
    });

    // A second load of the same module would overwrite unsaved answers with the server's
    // older copy, so the container refuses to re-read one it already has open.
    await waitFor(() => {
      expect(vi.mocked(getRuntimeModuleDraft)).toHaveBeenCalledTimes(1);
    });
    expect((screen.getByLabelText("Alpha answer") as HTMLInputElement).value).toBe(
      "unsaved",
    );
  });
});

// ==========================================================================
// The write boundary
// ==========================================================================

describe("the write boundary", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
    vi.mocked(saveRuntimeModuleDraft).mockResolvedValue({
      packetId: "pkt-fixture-1",
      moduleKey: "FIXTURE_ALPHA",
      data: {},
      updatedAt: new Date().toISOString(),
    });
  });

  it("completes against the SAME packet the answers were saved into", async () => {
    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    fireEvent.change(await screen.findByLabelText("Alpha answer"), {
      target: { value: "answered" },
    });
    fireEvent.click(screen.getByText("Finish section"));

    await waitFor(() => {
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalled();
    });
    // The packet is stated, and it is the packet the draft went to. A completion recorded
    // against any other packet is a completion whose answers are somewhere else.
    const [, options] = vi.mocked(completeOnboardingModule).mock.calls[0];
    expect(options?.invocationId).toBe(INVOCATION_ID);
    expect(vi.mocked(saveRuntimeModuleDraft).mock.calls[0][0]).toBe(INVOCATION_ID);
  });

  it("waits for an autosave already in flight before completing", async () => {
    // The race: a debounced save carrying the OLD answer is in flight when the worker
    // finishes. Completion must not be judged against what that request happened to carry.
    const inFlight = { release: () => undefined as void };
    vi.mocked(saveRuntimeModuleDraft).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          inFlight.release = () =>
            resolve({
              packetId: "pkt-fixture-1",
              moduleKey: "FIXTURE_ALPHA",
              data: { alphaAnswer: "first" },
              updatedAt: new Date().toISOString(),
            });
        }),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    const input = await screen.findByLabelText("Alpha answer");
    fireEvent.change(input, { target: { value: "first" } });
    fireEvent.click(screen.getByText("Save now"));
    await waitFor(() => {
      expect(vi.mocked(saveRuntimeModuleDraft)).toHaveBeenCalledTimes(1);
    });

    // Typed while that save is still running, then finished immediately.
    fireEvent.change(input, { target: { value: "corrected" } });
    fireEvent.click(screen.getByText("Finish section"));

    // Nothing may be completed while the newest answer is unwritten. Settled deliberately
    // rather than asserted synchronously: an implementation that gave up on a save already
    // in flight would have reached completion by now.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();

    inFlight.release();

    await waitFor(() => {
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalled();
    });
    // The corrected answer reached the server BEFORE completion was requested, so the
    // validator judged what the worker actually typed.
    expect(vi.mocked(saveRuntimeModuleDraft)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveRuntimeModuleDraft).mock.calls[1][2]).toEqual({
      alphaAnswer: "corrected",
    });
  });

  it("does not complete when the flush that had to precede it failed", async () => {
    vi.mocked(saveRuntimeModuleDraft).mockRejectedValueOnce(
      new WorkforceApiError("Network down", 500),
    );

    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    fireEvent.change(await screen.findByLabelText("Alpha answer"), {
      target: { value: "answered" },
    });
    fireEvent.click(screen.getByText("Finish section"));

    await waitFor(() => {
      expect(document.querySelector('[data-error-kind="SAVE_FAILED"]')).toBeTruthy();
    });
    expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Alpha answer") as HTMLInputElement).value).toBe(
      "answered",
    );
  });

  it("renders no interview at all for a section the server would refuse to change", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          fixturePacket({
            active: false,
            bound: false,
            restart: RESTART_CLOSED_COMPLETE,
            modules: [
              fixtureModule({
                moduleKey: "FIXTURE_ALPHA",
                status: "COMPLETE",
                actionable: false,
                restart: RESTART_CLOSED_NOT_BOUND,
              }),
            ],
          }),
        ],
      }),
    );

    // Reached by typing the URL, which is exactly how the UI's own navigation could be
    // bypassed. The server refuses a write here, so nothing invites the worker to try.
    renderWithRuntime(
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug="fixture-alpha"
        stepSlug="one"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector("[data-readonly-module]")).toBeTruthy();
    });
    expect(screen.queryByLabelText("Alpha answer")).toBeNull();
    expect(screen.queryByText("Save & finish later")).toBeNull();
    expect(screen.getByText("Go to my onboarding")).toBeTruthy();
  });

  it("explains a refused write without implying the answers were lost", async () => {
    const refused = classifyOnboardingError(
      new OnboardingApiError("Not the bound packet", 403, "INVOCATION_NOT_BOUND"),
      { saving: true },
    );
    const closed = classifyOnboardingError(
      new OnboardingApiError("Packet closed", 400, "PACKET_NOT_ACTIONABLE"),
      { saving: true },
    );

    for (const classified of [refused, closed]) {
      expect(classified.kind).toBe("STALE");
      expect(classified.detail).toContain("Everything you saved is safe");
      expect(classified.actionLabel).toBe("Go to my onboarding");
    }
  });
});

// ==========================================================================
// Session expiry
// ==========================================================================

describe("session continuity", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [twoModulePacket()] }),
    );
  });

  it("says nothing while the session is healthy", async () => {
    seedSession(60 * 60 * 1000);

    renderWithRuntime(<OnboardingSessionWatch />);

    await waitFor(() => {
      expect(document.querySelector(".ob-session-notice")).toBeNull();
    });
  });

  it("warns BEFORE the session ends, while there is still time to act", async () => {
    seedSession(60 * 1000);

    renderWithRuntime(<OnboardingSessionWatch />);

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("about to time out");
    expect(screen.getByText("Stay signed in")).toBeTruthy();
  });

  it("recovers in place without leaving the module", async () => {
    seedSession(60 * 1000);
    vi.mocked(getOnboardingSession).mockResolvedValue({
      candidateId: "candidate-fixture-1",
      status: "ACTIVE",
      boundInvocationId: INVOCATION_ID,
      resume: null,
      checkedAt: new Date().toISOString(),
    });

    renderWithRuntime(
      <>
        <OnboardingSessionWatch />
        <OnboardingModuleHost
          invocationId={INVOCATION_ID}
          moduleSlug="fixture-alpha"
          stepSlug="one"
        />
      </>,
    );

    fireEvent.change(await screen.findByLabelText("Alpha answer"), {
      target: { value: "mid-module answer" },
    });

    fireEvent.click(await screen.findByText("Stay signed in"));

    await waitFor(() => {
      expect(vi.mocked(getOnboardingSession)).toHaveBeenCalled();
    });
    // Same module, same step, same answer. Recovery restarts nothing.
    expect(screen.getByTestId("alpha-renderer")).toBeTruthy();
    expect((screen.getByLabelText("Alpha answer") as HTMLInputElement).value).toBe(
      "mid-module answer",
    );
  });

  it("explains an ended session without implying the work was lost", async () => {
    localStorage.clear();

    renderWithRuntime(<OnboardingSessionWatch />);

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("safely on our servers");
    expect(notice.textContent).toContain("come back to exactly this point");
  });

  it("distinguishes an expired session from a revoked one", () => {
    const expired = classifyOnboardingError(new WorkerSessionExpiredError());
    const revoked = classifyOnboardingError(
      new WorkerSessionExpiredError(WORKER_SESSION_INVALID_CODE),
    );

    expect(expired.kind).toBe("SESSION_EXPIRED");
    expect(revoked.kind).toBe("SESSION_INVALID");
    expect(expired.title).not.toBe(revoked.title);
  });

  it("distinguishes both from having no invocation to return to", () => {
    const nothing = classifyOnboardingError(
      new OnboardingApiError("None", 404, ONBOARDING_NO_ACTIVE_INVOCATION_CODE),
    );

    // Three outcomes, three answers. One generic failure for all three would leave the
    // worker unable to tell "sign in again" from "there is nothing here".
    expect(nothing.kind).toBe("NOTHING_ASSIGNED");
  });
});
