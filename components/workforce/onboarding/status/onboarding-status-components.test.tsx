/**
 * Phase 3 - status visualization component suite.
 *
 * These components exist to make one thing true: a worker and an operator looking at the
 * same record read the same words. The suite therefore tests almost nothing about markup and
 * a great deal about AUTHORITY - that the words on screen are the server's, that no component
 * recomputes a completion, and that an absent publication never reads as a negative one.
 *
 * The recurring technique below is the contradictory fixture: a projection whose fields do
 * not agree with each other, sent to a component to see which one it believes. A component
 * that derives locally will "correct" the server and fail. That is a far stronger check than
 * a consistent fixture, which any implementation passes.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { OnboardingStatusChip } from "./OnboardingStatusChip";
import { OnboardingRecordedOutcomeNote } from "./OnboardingRecordedOutcomeNote";
import { OnboardingModuleStatus } from "./OnboardingModuleStatus";
import { OnboardingPacketProgress } from "./OnboardingPacketProgress";
import { OnboardingCompletionIndicator } from "./OnboardingCompletionIndicator";
import { OnboardingStatusTile } from "./OnboardingStatusTile";
import { OnboardingStatusCell } from "./OnboardingStatusCell";
import { OnboardingCompletionDetailList } from "./OnboardingCompletionDetailList";
import {
  ALL_RECORDED_OUTCOMES,
  ALL_STATUS_STATES,
  NOT_YET_PUBLISHED,
  PUBLISHED_COMPLETE,
  SERVER_OUTCOMES,
  SERVER_STATUS_LABELS,
  SERVER_WORK_LABELS,
  fixtureCompletionFact,
  fixtureConsumerStatus,
  fixtureModuleStatus,
  fixtureOutcome,
  fixtureProgress,
  fixtureStatus,
} from "./statusTestFixtures";

afterEach(cleanup);

/* --------------------------------------------------------------- status chip */

describe("status chip", () => {
  it("renders the server's words for every status state", () => {
    for (const state of ALL_STATUS_STATES) {
      render(<OnboardingStatusChip status={fixtureStatus(state)} />);
      const chip = document.querySelector(`[data-state="${state}"]`);

      expect(chip?.textContent).toBe(SERVER_STATUS_LABELS[state]);
      cleanup();
    }
  });

  it("shows no internal vocabulary to the reader", () => {
    for (const state of ALL_STATUS_STATES) {
      render(<OnboardingStatusChip status={fixtureStatus(state)} />);
      const chip = document.querySelector(`[data-state="${state}"]`);

      // The enum is a machine hook on the attribute; it is never the sentence a person reads.
      expect(chip?.textContent).not.toMatch(/_|MW4H|PACKET|MODULE/);
      cleanup();
    }
  });

  it("says what the server said even when the label disagrees with the state", () => {
    // A component that worded status for itself would render "Complete" here.
    render(
      <OnboardingStatusChip
        status={{ state: "COMPLETE", label: "Still with our team", outstanding: true }}
      />,
    );

    expect(screen.getByText("Still with our team")).toBeTruthy();
    expect(screen.queryByText("Complete")).toBeNull();
  });

  it("takes outstanding from the projection rather than inferring it from the state", () => {
    render(
      <OnboardingStatusChip
        status={{ state: "COMPLETE", label: "Complete", outstanding: true }}
      />,
    );

    expect(
      document.querySelector('[data-state="COMPLETE"][data-outstanding="true"]'),
    ).toBeTruthy();
  });
});

/* ----------------------------------------------------------- recorded outcomes */

describe("recorded outcomes", () => {
  it("renders every governed outcome as an outcome, with its explanation", () => {
    for (const outcome of ALL_RECORDED_OUTCOMES) {
      render(<OnboardingRecordedOutcomeNote outcome={fixtureOutcome(outcome)} />);

      expect(screen.getByText(SERVER_OUTCOMES[outcome].label)).toBeTruthy();
      expect(screen.getByText(SERVER_OUTCOMES[outcome].detail)).toBeTruthy();
      cleanup();
    }
  });

  it("never renders a governed outcome as an empty gap", () => {
    for (const outcome of ALL_RECORDED_OUTCOMES) {
      render(
        <OnboardingModuleStatus
          status={fixtureModuleStatus({
            state: "COMPLETE",
            recordedOutcome: fixtureOutcome(outcome),
          })}
        />,
      );
      const rendered = document.querySelector(`[data-outcome="${outcome}"]`);

      expect(rendered).toBeTruthy();
      expect(rendered?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      // A decline is a determination. Nothing here may read as a step left undone.
      expect(rendered?.textContent).not.toMatch(/missing|skipped|not provided|—/i);
      cleanup();
    }
  });

  it("renders nothing at all when a completion carries no governed outcome", () => {
    const { container } = render(<OnboardingRecordedOutcomeNote outcome={null} />);

    expect(container.textContent).toBe("");
  });
});

/* -------------------------------------------------------------- module status */

describe("module status", () => {
  it("tells a worker his part is done without offering him the administrative act", () => {
    render(
      <OnboardingModuleStatus
        status={fixtureModuleStatus({
          state: "WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION",
        })}
      />,
    );

    expect(
      screen.getByText(
        SERVER_STATUS_LABELS.WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Nothing further is needed from you/)).toBeTruthy();
    // A fact, never a control: the act belongs to MW4H.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("gives the worker runtime and the administrative workspace identical status", () => {
    // The worker's module card renders through OnboardingModuleStatus; the workspace's
    // module table renders through OnboardingStatusCell. Different densities, and that is
    // allowed - but from one projection they must not say two different things.
    const status = fixtureModuleStatus({
      state: "COMPLETE",
      recordedOutcome: fixtureOutcome("DECLINED"),
    });
    const chipText = () =>
      document.querySelector(".obs-chip")?.textContent ?? "MISSING";
    const outcomeText = () =>
      document.querySelector("[data-outcome]")?.textContent ?? "MISSING";

    render(<OnboardingModuleStatus status={status} />);
    const worker = { chip: chipText(), outcome: outcomeText() };
    cleanup();
    render(<OnboardingStatusCell status={status} />);
    const operator = { chip: chipText(), outcome: outcomeText() };

    expect(worker.chip).toBe(operator.chip);
    expect(worker.chip).toBe(SERVER_STATUS_LABELS.COMPLETE);
    // The operator's cell abbreviates the outcome's explanation; both still name it.
    expect(worker.outcome).toContain(SERVER_OUTCOMES.DECLINED.label);
    expect(operator.outcome).toContain(SERVER_OUTCOMES.DECLINED.label);
  });

  it("suppresses the outcome's sentence where a row is too narrow, not the outcome", () => {
    render(
      <OnboardingModuleStatus
        status={fixtureModuleStatus({
          state: "COMPLETE",
          recordedOutcome: fixtureOutcome("NOT_REQUIRED"),
        })}
        showOutcomeDetail={false}
      />,
    );

    expect(screen.queryByText(SERVER_OUTCOMES.NOT_REQUIRED.detail)).toBeNull();
  });
});

/* ------------------------------------------------------------------- progress */

describe("packet progress", () => {
  it("counts what the server counted", () => {
    render(<OnboardingPacketProgress progress={fixtureProgress(2, 5)} />);

    expect(screen.getByText(/2 of 5 steps complete/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuemax")).toBe("5");
  });

  it("believes the server's completeness rather than recomputing it from the counts", () => {
    // Counts that look complete, a server that says otherwise. The server wins.
    render(
      <OnboardingPacketProgress
        progress={{ complete: false, requiredCount: 3, completeCount: 3, derived: true }}
      />,
    );

    expect(screen.getByText(/3 of 3 steps complete/)).toBeTruthy();
    expect(document.querySelector('[data-complete="false"]')).toBeTruthy();
  });

  it("names the things it is counting in the reader's own terms", () => {
    render(<OnboardingPacketProgress progress={fixtureProgress(0, 1)} noun="modules" />);

    expect(screen.getByText(/0 of 1 modules complete/)).toBeTruthy();
  });

  it("says on screen that progress is derived, so no one reads it as an editable field", () => {
    render(<OnboardingPacketProgress progress={fixtureProgress(1, 4)} />);

    expect(screen.getByText(/derived from recorded completion/)).toBeTruthy();
  });

  it("does not divide by zero when a packet requires nothing", () => {
    render(<OnboardingPacketProgress progress={fixtureProgress(0, 0)} />);

    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(document.querySelector(".obs-progress-fill")?.getAttribute("style")).toContain(
      "0%",
    );
  });
});

/* ------------------------------------------------------- published completion */

describe("published completion", () => {
  it("renders an absent publication as an absence, never as a negative", () => {
    render(<OnboardingCompletionIndicator published={NOT_YET_PUBLISHED} />);
    const text = screen.getByText(NOT_YET_PUBLISHED.label).textContent ?? "";

    expect(text).not.toMatch(/incomplete|not complete|failed|ineligible|denied/i);
    expect(document.querySelector('[data-state="NOT_YET_PUBLISHED"]')).toBeTruthy();
  });

  it("keeps an absent publication distinct from onboarding work being outstanding", () => {
    render(
      <OnboardingCompletionIndicator
        published={NOT_YET_PUBLISHED}
        work="OUTSTANDING"
        workLabel={SERVER_WORK_LABELS.OUTSTANDING}
      />,
    );
    const absence = screen.getByText(NOT_YET_PUBLISHED.label);
    const work = screen.getByText(SERVER_WORK_LABELS.OUTSTANDING);

    // Two facts, two elements. A consumer cannot conflate them by reading one string.
    expect(absence).not.toBe(work);
  });

  it("never claims completion from work being finished", () => {
    render(
      <OnboardingCompletionIndicator
        published={NOT_YET_PUBLISHED}
        work="ALL_MODULES_COMPLETE"
        workLabel={SERVER_WORK_LABELS.ALL_MODULES_COMPLETE}
      />,
    );

    // Every module recorded complete is still not a published completion.
    expect(document.querySelector('[data-state="PUBLISHED_COMPLETE"]')).toBeNull();
    expect(screen.getByText(NOT_YET_PUBLISHED.label)).toBeTruthy();
  });

  it("would render a Phase 15 publication verbatim, without inventing one", () => {
    // Proves the component reports what it is given. Nothing in Phase 3 supplies this.
    render(<OnboardingCompletionIndicator published={PUBLISHED_COMPLETE} />);

    expect(screen.getByText(PUBLISHED_COMPLETE.label)).toBeTruthy();
  });
});

/* ------------------------------------------------- embeddable consumer surfaces */

describe("dashboard tile", () => {
  it("presents a consumer projection and offers no decision", () => {
    render(<OnboardingStatusTile status={fixtureConsumerStatus()} />);

    expect(screen.getByText("Onboarding")).toBeTruthy();
    expect(screen.getByText(SERVER_WORK_LABELS.IN_PROGRESS)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("carries no module content and no sensitive value for any consuming audience", () => {
    for (const audience of ["RECRUITING", "VETTING", "PRE_DISPATCH"] as const) {
      const { container } = render(
        <OnboardingStatusTile status={fixtureConsumerStatus({ audience })} />,
      );

      // The tile can only render what the projection carries, and the projection carries
      // completion facts alone. Nothing here reaches module content.
      expect(container.textContent).not.toMatch(/\d{3}-\d{2}-\d{4}|FIXTURE_|moduleKey/);
      cleanup();
    }
  });

  it("offers navigation only where the consumer supplies its own destination", () => {
    render(<OnboardingStatusTile status={fixtureConsumerStatus()} href="/somewhere" />);

    expect(screen.getByRole("link", { name: "Open onboarding" })).toBeTruthy();
  });
});

describe("queue cell", () => {
  it("keeps a governed outcome legible at row density", () => {
    render(
      <OnboardingStatusCell
        status={fixtureModuleStatus({
          state: "COMPLETE",
          recordedOutcome: fixtureOutcome("FEDERALLY_DERIVED"),
        })}
      />,
    );

    expect(screen.getByText(SERVER_STATUS_LABELS.COMPLETE)).toBeTruthy();
    expect(screen.getByText(SERVER_OUTCOMES.FEDERALLY_DERIVED.label)).toBeTruthy();
    expect(screen.queryByText(SERVER_OUTCOMES.FEDERALLY_DERIVED.detail)).toBeNull();
  });

  it("marks outstanding rows from the projection, not from the state", () => {
    render(
      <OnboardingStatusCell
        status={fixtureModuleStatus({ state: "COMPLETE", outstanding: true })}
      />,
    );

    expect(document.querySelector('.obs-cell[data-outstanding="true"]')).toBeTruthy();
  });
});

/* ------------------------------------------------------------- completion detail */

describe("completion detail", () => {
  it("renders exactly the rows the server sent, in the order it sent them", () => {
    render(
      <OnboardingCompletionDetailList
        modules={[
          fixtureCompletionFact({ moduleKey: "FIXTURE_BETA", title: "Fixture Beta" }),
          fixtureCompletionFact({ moduleKey: "FIXTURE_ALPHA", title: "Fixture Alpha" }),
        ]}
      />,
    );
    const rows = Array.from(document.querySelectorAll("[data-module-key]")).map((row) =>
      row.getAttribute("data-module-key"),
    );

    expect(rows).toEqual(["FIXTURE_BETA", "FIXTURE_ALPHA"]);
  });

  it("hides nothing, because a module a caller may not see is already absent", () => {
    const { container } = render(
      <OnboardingCompletionDetailList
        modules={[fixtureCompletionFact({ status: fixtureStatus("EXCEPTION_OUTSTANDING") })]}
      />,
    );

    expect(container.querySelectorAll("[data-module-key]").length).toBe(1);
    expect(screen.getByText(SERVER_STATUS_LABELS.EXCEPTION_OUTSTANDING)).toBeTruthy();
  });

  it("states an empty drill-down plainly rather than rendering a bare list", () => {
    render(<OnboardingCompletionDetailList modules={[]} />);

    expect(screen.getByText(/No onboarding steps are recorded/)).toBeTruthy();
  });
});
