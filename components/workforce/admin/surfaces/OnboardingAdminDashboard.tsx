"use client";

/**
 * Phase 2 - the administrative dashboard.
 *
 * What is outstanding, by category, for this operator. The categories are the modules that
 * registered administrative work, so this surface has no list of onboarding categories in it and
 * gains one the moment a module phase registers a queue.
 *
 * Two empty states are told apart on purpose, because they mean opposite things to the person
 * reading them: no module has registered administrative work at all, versus work exists but none
 * of it is his. The server distinguishes them; this surface repeats the distinction.
 */

import Link from "next/link";
import { getOnboardingAdminDashboard, onboardingAdminQueuePath } from "@/lib/workforce/onboardingAdminApi";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel } from "../panels/DetailPanel";
import { OnboardingAdminSummary } from "../panels/SummaryPanel";

export default function OnboardingAdminDashboard() {
  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdminDashboard(),
    [],
  );

  return (
    <OnboardingAdminShell
      title="Workforce Onboarding"
      subtitle="Outstanding administrative work, by category, for the functions you are authorized to perform."
    >
      {loading ? <OnboardingAdminLoading label="Loading outstanding work" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <OnboardingAdminSummary
            figures={[
              {
                label: "Items awaiting administrative action",
                value: data.outstandingCount,
                hint: "Across every queue you may open",
              },
              {
                label: "Categories of work",
                value: data.categories.length,
                hint: "One per module that registered work",
              },
              // Phase 3. A DIFFERENT fact from the two above, which count administrative
              // queue items. This counts the workers behind them who still owe onboarding,
              // and the server reads it from the status authority - the same authority
              // behind the drill-down an operator opens from here, so the figure and the
              // detail cannot tell him two different things.
              {
                label: "Workers with onboarding outstanding",
                value: data.onboardingStatus.workersWithOnboardingOutstanding,
                hint: `Of ${data.onboardingStatus.workersInScope} on your queues · derived from completion records`,
              },
            ]}
          />

          {data.noRegisteredWork ? (
            <OnboardingAdminEmpty
              title="No onboarding module has registered administrative work yet."
              detail="This workspace is the surface those modules will register into. As each module is implemented, its queues and processing controls appear here without this page changing."
            />
          ) : data.noAuthorizedWork ? (
            <OnboardingAdminEmpty
              title="No administrative work is assigned to your functions."
              detail="Registered work exists, but none of it belongs to an administrative function you hold a grant for. Administrative access is granted per function."
            />
          ) : (
            data.categories.map((category) => (
              <OnboardingAdminPanel
                key={category.moduleKey}
                title={`${category.moduleNumber} · ${category.moduleTitle}`}
                description={`${category.outstandingCount} item${
                  category.outstandingCount === 1 ? "" : "s"
                } outstanding`}
              >
                <table className="oba-table">
                  <thead>
                    <tr>
                      <th scope="col">Queue</th>
                      <th scope="col">Outstanding</th>
                      <th scope="col">Orientation</th>
                      <th scope="col">Governance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.queues.map((queue) => (
                      <tr key={queue.queueKey}>
                        <td>
                          <Link
                            className="oba-btn oba-btn-link"
                            href={onboardingAdminQueuePath(queue.queueKey)}
                          >
                            {queue.title}
                          </Link>
                          <span className="oba-field-absent">{queue.description}</span>
                        </td>
                        <td>{queue.outstandingCount}</td>
                        <td>{queue.orientation === "PACKET" ? "Whole packet" : "Single module"}</td>
                        <td className="oba-cell-detail">{queue.governanceSection}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OnboardingAdminPanel>
            ))
          )}
        </>
      ) : null}
    </OnboardingAdminShell>
  );
}
