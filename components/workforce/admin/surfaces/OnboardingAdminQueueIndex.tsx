"use client";

/**
 * Phase 2 - the registered queue index.
 *
 * Lists the queues this operator may open. The list comes entirely from what modules registered
 * and what grants the operator holds, so a queue he cannot work is absent rather than shown and
 * refused on entry.
 */

import Link from "next/link";
import {
  listOnboardingAdminQueues,
  onboardingAdminQueuePath,
} from "@/lib/workforce/onboardingAdminApi";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel } from "../panels/DetailPanel";

export default function OnboardingAdminQueueIndex() {
  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => listOnboardingAdminQueues(),
    [],
  );

  return (
    <OnboardingAdminShell
      title="Queues"
      subtitle="Work grouped the way the module that owns it declared. You see the queues your administrative functions cover."
      backHref="/onboarding"
      backLabel="Dashboard"
    >
      {loading ? <OnboardingAdminLoading label="Loading queues" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data && data.length === 0 ? (
        <OnboardingAdminEmpty
          title="No queues are available to you."
          detail="Either no module has registered a queue yet, or none of the registered queues fall within an administrative function you hold."
        />
      ) : null}

      {data && data.length > 0 ? (
        <OnboardingAdminPanel title="Registered queues">
          <table className="oba-table">
            <thead>
              <tr>
                <th scope="col">Queue</th>
                <th scope="col">Module</th>
                <th scope="col">Orientation</th>
                <th scope="col">Governance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((queue) => (
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
                  <td>
                    {queue.moduleNumber} · {queue.moduleTitle}
                  </td>
                  <td>
                    {queue.orientation === "PACKET" ? "Whole packet" : "Single module"}
                    {/*
                      The module's declaration, reported as a declaration. Claiming itself
                      belongs to the phase that introduces the assignment record, so this
                      says what the queue declared and offers no control that would claim.
                    */}
                    {queue.claimable ? (
                      <span className="oba-field-absent">Claimed before working</span>
                    ) : null}
                  </td>
                  <td className="oba-cell-detail">{queue.governanceSection}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </OnboardingAdminPanel>
      ) : null}
    </OnboardingAdminShell>
  );
}
