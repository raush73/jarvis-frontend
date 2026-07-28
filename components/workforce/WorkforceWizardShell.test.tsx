import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WORKER_SESSION_INVALID_CODE,
  WorkerSessionExpiredError,
  WorkforceApiError,
} from "@/lib/workforce/workforceApi";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import WorkforceWizardShell from "./WorkforceWizardShell";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

/** Anything unique to the stage body, used to prove the stage is or is not rendered. */
const STAGE_CONTENT = "Do you have your own equipment?";

function renderShell(props: Record<string, unknown> = {}) {
  return render(
    <WorkforceWizardShell slug="ppe" onSave={async () => {}} {...props}>
      <p>{STAGE_CONTENT}</p>
    </WorkforceWizardShell>,
  );
}

describe("WorkforceWizardShell", () => {
  beforeEach(() => {
    localStorage.clear();
    replace.mockClear();
    push.mockClear();
    saveWorkerSession({
      token: "original-token",
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      applicationSessionId: "apps_durable",
      candidateId: null,
    });
  });

  afterEach(cleanup);

  it("renders the stage normally when nothing has failed", () => {
    renderShell();

    expect(screen.getByText(STAGE_CONTENT)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save & Continue" })).toBeTruthy();
  });

  /* ------------------------------------------------------------------ */
  /*  C4D: an ended session is explained, not hidden                     */
  /* ------------------------------------------------------------------ */

  describe("when the stage reports an expired session", () => {
    it("explains that the secure session expired", () => {
      renderShell({ stageError: new WorkerSessionExpiredError() });

      expect(screen.getByRole("alert").textContent).toContain(
        "Your secure application session expired.",
      );
    });

    /**
     * The defect this replaces: the stage rendered blank and looked like a step the worker
     * had simply not filled in yet.
     */
    it("does not render an empty-looking stage behind the failure", () => {
      renderShell({ stageError: new WorkerSessionExpiredError() });

      expect(screen.queryByText(STAGE_CONTENT)).toBeNull();
      expect(screen.queryByRole("button", { name: "Save & Continue" })).toBeNull();
    });

    it("offers a new application without claiming this one can be resumed", () => {
      renderShell({ stageError: new WorkerSessionExpiredError() });

      const alert = screen.getByRole("alert").textContent ?? "";
      expect(screen.getByRole("button", { name: "Start a new application" })).toBeTruthy();
      expect(alert).toContain("cannot be reopened from this device");
      expect(alert.toLowerCase()).not.toContain("resume");
    });

    it("stays on the screen instead of silently bouncing to the entry page", () => {
      renderShell({ stageError: new WorkerSessionExpiredError() });

      expect(replace).not.toHaveBeenCalled();
    });

    it("words a rejected session differently from one that ran out", () => {
      renderShell({
        stageError: new WorkerSessionExpiredError(WORKER_SESSION_INVALID_CODE),
      });

      expect(screen.getByRole("alert").textContent).toContain(
        "Your secure application session is no longer valid.",
      );
    });

    it("shows no field-validation errors alongside the session failure", () => {
      renderShell({
        stageError: new WorkerSessionExpiredError(),
        // A stage whose fields are also incomplete must not blame the worker for it.
        loading: false,
      });

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(1);
      expect(alerts[0].querySelector(".wf-error-list")).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Ordinary load failures                                             */
  /* ------------------------------------------------------------------ */

  describe("when the stage fails to load for another reason", () => {
    it("reports the backend message rather than rendering silently", () => {
      renderShell({ stageError: new WorkforceApiError("The registry is unavailable.", 500) });

      expect(screen.getByRole("alert").textContent).toContain(
        "The registry is unavailable.",
      );
    });

    it("explains an unrecognised failure in plain language", () => {
      renderShell({ stageError: new Error("socket hang up") });

      expect(screen.getByRole("alert").textContent).toContain(
        "We could not load this step.",
      );
    });
  });
});
