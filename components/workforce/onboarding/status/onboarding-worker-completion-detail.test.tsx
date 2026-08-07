/**
 * Phase 3A - the worker's own completion drill-down.
 *
 * Two claims under test, and they pull in opposite directions on purpose. The worker must
 * reach the SAME presentation the administrative workspace reaches, because Section 11 says
 * one panel serves both and two panels would eventually disagree. He must NOT reach the same
 * data, because the projections are audience-scoped and sharing a component is not sharing a
 * grant.
 *
 * So: same rows, same markup, his own route - and nothing on the surface through which he
 * could ask for anyone else's.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/workforce/onboardingStatusApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingStatusApi")>();
  return {
    ...actual,
    getOnboardingWorkerCompletionDetail: vi.fn(),
    getOnboardingCompletionDetail: vi.fn(),
  };
});

const { getOnboardingWorkerCompletionDetail, getOnboardingCompletionDetail } =
  await import("@/lib/workforce/onboardingStatusApi");
const { default: OnboardingWorkerCompletionDetail } = await import(
  "./OnboardingWorkerCompletionDetail"
);
const { default: OnboardingCompletionDetailList } = await import(
  "./OnboardingCompletionDetailList"
);
const { fixtureCompletionFact, fixtureStatus, fixtureOutcome, NOT_YET_PUBLISHED } =
  await import("./statusTestFixtures");

type Detail = Awaited<ReturnType<typeof getOnboardingWorkerCompletionDetail>>;

function detail(overrides: Partial<Detail> = {}): Detail {
  return {
    candidateId: "cand_status_fixture",
    audience: "WORKER",
    published: NOT_YET_PUBLISHED,
    generatedAt: "2026-03-01T12:00:00.000Z",
    modules: [
      fixtureCompletionFact(),
      fixtureCompletionFact({
        moduleKey: "FIXTURE_BETA",
        moduleNumber: "F2",
        title: "Fixture Beta",
        status: fixtureStatus("NOT_STARTED"),
        completedAt: null,
      }),
    ],
    ...overrides,
  };
}

describe("the worker completion drill-down", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingWorkerCompletionDetail).mockResolvedValue(detail());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders every row the worker projection supplied", async () => {
    render(<OnboardingWorkerCompletionDetail />);

    expect(await screen.findByText(/F1 Fixture Alpha/)).toBeTruthy();
    expect(screen.getByText(/F2 Fixture Beta/)).toBeTruthy();
  });

  it("reads the worker route and never the staff drill-down", async () => {
    render(<OnboardingWorkerCompletionDetail />);
    await screen.findByText(/F1 Fixture Alpha/);

    // The staff endpoint is behind a grant a worker does not hold. Sharing the component must
    // not have quietly shared the read.
    expect(getOnboardingWorkerCompletionDetail).toHaveBeenCalledTimes(1);
    expect(getOnboardingWorkerCompletionDetail).toHaveBeenCalledWith();
    expect(getOnboardingCompletionDetail).not.toHaveBeenCalled();
  });

  it("produces the same markup the shared component produces for the same rows", async () => {
    const { container } = render(<OnboardingWorkerCompletionDetail />);
    await screen.findByText(/F1 Fixture Alpha/);
    const worker = container.querySelector(".obs-detail-list")?.innerHTML;

    cleanup();
    const shared = render(
      <OnboardingCompletionDetailList modules={detail().modules} />,
    ).container.querySelector(".obs-detail-list")?.innerHTML;

    // Identical presentation is the whole point of the shared panel. If these diverge, the
    // worker runtime has grown a second way of describing the same record.
    expect(worker).toBeTruthy();
    expect(worker).toBe(shared);
  });

  it("renders the status the server labelled, not one it worked out", async () => {
    vi.mocked(getOnboardingWorkerCompletionDetail).mockResolvedValue(
      detail({
        modules: [
          fixtureCompletionFact({
            status: fixtureStatus("EXCEPTION_OUTSTANDING"),
            recordedOutcome: fixtureOutcome("DECLINED"),
          }),
        ],
      }),
    );

    render(<OnboardingWorkerCompletionDetail />);

    // A recorded decline is an OUTCOME, not a gap, and the words are the server's.
    expect(await screen.findByText("Needs attention")).toBeTruthy();
    expect(screen.getByText(/Declined/)).toBeTruthy();
  });

  it("renders nothing when the worker has no onboarding recorded", async () => {
    vi.mocked(getOnboardingWorkerCompletionDetail).mockResolvedValue(
      detail({ modules: [] }),
    );

    const { container } = render(<OnboardingWorkerCompletionDetail />);

    await waitFor(() => expect(getOnboardingWorkerCompletionDetail).toHaveBeenCalled());
    expect(container.querySelector(".obs-detail-panel")).toBeNull();
  });

  it("stays silent rather than breaking his dashboard when the read fails", async () => {
    vi.mocked(getOnboardingWorkerCompletionDetail).mockRejectedValue(
      new Error("status unavailable"),
    );

    const { container } = render(<OnboardingWorkerCompletionDetail />);

    await waitFor(() => expect(getOnboardingWorkerCompletionDetail).toHaveBeenCalled());
    expect(container.querySelector(".obs-detail-panel")).toBeNull();
    expect(container.textContent).not.toMatch(/error|unavailable/i);
  });

  it("offers no control that would imply the worker can act on an administrative step", async () => {
    const { container } = render(<OnboardingWorkerCompletionDetail />);
    await screen.findByText(/F1 Fixture Alpha/);

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});
