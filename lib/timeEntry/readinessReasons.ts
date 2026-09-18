import type { WorkingTimesheetReadiness } from "./workingTimesheetApi";

/**
 * TE-S3 turn the server's readiness verdict into sentences an operator can act on.
 *
 * PRESENTATION ONLY. This decides no rule and recomputes nothing: the backend already said whether the
 * worksheet is ready and exactly what is outstanding. All this does is name each blocker in the words
 * the operator would use, so the screen never has to interpret the verdict for itself.
 *
 * The blockers keep the server's three categories rather than being flattened into one list. A
 * forgotten worker, an ambiguous saved draft and an unallocated overtime figure need three different
 * human responses, and collapsing them would hide which response is called for.
 */
export function describeReadinessBlockers(
  readiness: WorkingTimesheetReadiness,
  workerNameById: (candidateId: string) => string,
): string[] {
  const reasons: string[] = [];

  for (const worker of readiness.unaccountedWorkers) {
    reasons.push(
      `${worker.workerName} has no time entered and has not been reviewed for this week.`,
    );
  }

  for (const conflict of readiness.dataConflicts) {
    const name = workerNameById(conflict.candidateId);
    reasons.push(
      conflict.kind === "AMBIGUOUS_DRAFT"
        ? `${name} has more than one saved draft for this week, so the saved time is ambiguous.`
        : `${name} has saved time but is no longer on this week's dispatched roster.`,
    );
  }

  for (const entry of readiness.incompleteEntries) {
    const name = workerNameById(entry.candidateId);
    if (entry.kind === "WEEKLY_OT_NOT_FULLY_ALLOCATED") {
      reasons.push(
        `${name}'s overtime is not fully allocated across job rows${
          entry.detail ? ` (${entry.detail})` : ""
        }.`,
      );
      continue;
    }
    reasons.push(
      `${name} has worked hours on job row ${
        (entry.jobRowIndex ?? 0) + 1
      } with no Customer Job selected.`,
    );
  }

  return reasons;
}

/**
 * The single sentence describing where the worksheet stands.
 *
 * `NOT_STARTED` is worded separately from `INCOMPLETE` because a sheet nobody has touched is a
 * different situation from one whose entered work has a problem, and the operator's next action differs.
 */
export function describeReadinessState(readiness: WorkingTimesheetReadiness): string {
  switch (readiness.state) {
    case "READY":
      return "This working timesheet is complete and ready for approvals.";
    case "NOT_STARTED":
      return "No time has been entered for this working timesheet yet.";
    default:
      return `${readiness.accountedWorkerCount} of ${readiness.rosterWorkerCount} workers accounted for.`;
  }
}
