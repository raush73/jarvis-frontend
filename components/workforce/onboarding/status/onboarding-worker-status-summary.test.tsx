/**
 * Phase 3 - the worker's "with our team" panel.
 *
 * The claim under test is an honesty requirement, not a layout one. A worker who has finished
 * his part of a section and is waiting on MW4H must be told so, must not be shown an internal
 * module key while being told it, and must not be offered a way to perform an act that is not
 * his to perform.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/workforce/onboardingStatusApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingStatusApi")>();
  return { ...actual, getOnboardingWorkerStatus: vi.fn() };
});

const { getOnboardingWorkerStatus } = await import(
  "@/lib/workforce/onboardingStatusApi"
);
const { default: OnboardingWorkerStatusSummary } = await import(
  "./OnboardingWorkerStatusSummary"
);
const { SERVER_STATUS_LABELS, fixtureProgress } = await import("./statusTestFixtures");

type WorkerStatus = Awaited<ReturnType<typeof getOnboardingWorkerStatus>>;

function workerStatus(awaiting: string[]): WorkerStatus {
  return {
    candidateId: "cand_status_fixture",
    audience: "WORKER",
    awaitingAdministrativeAction: awaiting,
    generatedAt: "2026-03-01T12:00:00.000Z",
    packets: [
      {
        packetId: "pkt_status_fixture",
        invocationId: "inv_status_fixture",
        packetVersion: 1,
        packetState: "IN_PROGRESS",
        progress: fixtureProgress(1, 2),
        outstandingModuleKeys: ["FIXTURE_ALPHA"],
        active: true,
        modules: [
          {
            moduleKey: "FIXTURE_ALPHA",
            moduleNumber: "F1",
            title: "Fixture Alpha",
            position: 1,
            status: {
              state: "WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION",
              label:
                SERVER_STATUS_LABELS.WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION,
              outstanding: true,
            },
            recordedOutcome: null,
            stepsDeclared: 1,
            stepsSatisfied: 1,
            workerActionable: false,
            awaitingAdministrativeAction: true,
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("worker status summary", () => {
  it("names the section waiting on MW4H in the worker's own words", async () => {
    vi.mocked(getOnboardingWorkerStatus).mockResolvedValue(
      workerStatus(["FIXTURE_ALPHA"]),
    );

    render(<OnboardingWorkerStatusSummary />);

    expect(await screen.findByText("Fixture Alpha")).toBeTruthy();
    expect(screen.getByText(/now with our team/)).toBeTruthy();
    // The key identifies the section on the wire. It is not what he reads.
    expect(screen.queryByText("FIXTURE_ALPHA")).toBeNull();
  });

  it("offers him no way to perform the act that is ours", async () => {
    vi.mocked(getOnboardingWorkerStatus).mockResolvedValue(
      workerStatus(["FIXTURE_ALPHA"]),
    );

    render(<OnboardingWorkerStatusSummary />);

    await screen.findByText("Fixture Alpha");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("says nothing at all when nothing is waiting on us", async () => {
    vi.mocked(getOnboardingWorkerStatus).mockResolvedValue(workerStatus([]));

    const { container } = render(<OnboardingWorkerStatusSummary />);

    await waitFor(() => expect(getOnboardingWorkerStatus).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("stays silent rather than breaking his dashboard when the read fails", async () => {
    vi.mocked(getOnboardingWorkerStatus).mockRejectedValue(new Error("unavailable"));

    const { container } = render(<OnboardingWorkerStatusSummary />);

    await waitFor(() => expect(getOnboardingWorkerStatus).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("counts sections without naming one it was not given a title for", async () => {
    vi.mocked(getOnboardingWorkerStatus).mockResolvedValue(
      workerStatus(["FIXTURE_ALPHA", "FIXTURE_UNKNOWN"]),
    );

    render(<OnboardingWorkerStatusSummary />);

    expect(await screen.findByText(/You have finished 2 sections/)).toBeTruthy();
    expect(screen.getByText("A section you have completed")).toBeTruthy();
    expect(screen.queryByText("FIXTURE_UNKNOWN")).toBeNull();
  });
});
