"use client";

/**
 * Phase 2 - the worker workspace.
 *
 * Everything recorded about one worker's onboarding on a single surface: masked identity, every
 * packet he has ever had with its derived progress, the module completion currently in effect
 * across all of them, and what remains outstanding.
 *
 * The distinction this surface exists to make visible is between a PACKET's completion and the
 * worker's EFFECTIVE completion. A module completed in an earlier packet stays in effect until
 * something supersedes it, so "what does this worker still owe" is not answerable from any single
 * packet. The server answers it; this surface shows both answers side by side so an operator is
 * not left inferring one from the other.
 */

import Link from "next/link";
import {
  getOnboardingAdminWorker,
  onboardingAdminInvestigationPath,
  onboardingAdminPacketPath,
} from "@/lib/workforce/onboardingAdminApi";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "../adminPermissions";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import {
  OnboardingAdminField,
  OnboardingAdminFieldList,
  OnboardingAdminPanel,
  OnboardingAdminTimestamp,
} from "../panels/DetailPanel";
import {
  OnboardingAdminPacketStateBadge,
  OnboardingAdminProgressBar,
} from "../panels/StatusPresentation";
import { OnboardingAdminSummary } from "../panels/SummaryPanel";
import { OnboardingAdminWorkerContextHeader } from "../panels/WorkerContextHeader";

export default function OnboardingAdminWorkerWorkspace({
  candidateId,
}: {
  candidateId: string;
}) {
  const session = useSession();
  const { canReadAudit } = useOnboardingAdminPermissions(session);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdminWorker(candidateId),
    [candidateId],
  );

  return (
    <OnboardingAdminShell
      title={data?.worker.displayName ?? "Worker"}
      subtitle="Everything recorded about this worker's onboarding. Module completion carries forward between packets, so what he still owes is not the same question as what any one packet is missing."
      backHref="/onboarding/workers"
      backLabel="Worker search"
      context={
        data ? (
          <OnboardingAdminWorkerContextHeader
            worker={data.worker}
            showInvestigationLink={canReadAudit}
          />
        ) : undefined
      }
      actions={
        data && canReadAudit ? (
          <Link
            className="oba-btn"
            href={onboardingAdminInvestigationPath(data.worker.candidateId)}
          >
            Investigate history
          </Link>
        ) : undefined
      }
    >
      {loading ? <OnboardingAdminLoading label="Loading worker" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <OnboardingAdminSummary
            figures={[
              { label: "Packets on record", value: data.packets.length },
              {
                label: "Modules currently in effect",
                value: data.effectiveCompletion.length,
                hint: "Across every packet",
              },
              {
                label: "Modules still outstanding",
                value: data.outstandingModuleKeys.length,
                hint: "Not satisfied by any effective completion",
              },
            ]}
          />

          <OnboardingAdminPanel
            title="Packets"
            description="Newest first. Progress is derived from recorded module completion."
          >
            {data.packets.length === 0 ? (
              <OnboardingAdminEmpty
                title="This worker has no onboarding packet."
                detail="Onboarding is invoked by another workflow; until one invokes it, there is nothing to show."
              />
            ) : (
              <table className="oba-table">
                <thead>
                  <tr>
                    <th scope="col">Packet</th>
                    <th scope="col">State</th>
                    <th scope="col">Progress</th>
                    <th scope="col">Invoked by</th>
                    <th scope="col">Opened</th>
                    <th scope="col">Open to worker</th>
                  </tr>
                </thead>
                <tbody>
                  {data.packets.map((packet) => (
                    <tr key={packet.packetId}>
                      <td>
                        <Link
                          className="oba-btn oba-btn-link"
                          href={onboardingAdminPacketPath(packet.packetId)}
                        >
                          Version {packet.packetVersion}
                        </Link>
                      </td>
                      <td>
                        <OnboardingAdminPacketStateBadge state={packet.packetState} />
                      </td>
                      <td>
                        <OnboardingAdminProgressBar progress={packet.progress} />
                      </td>
                      <td className="oba-cell-detail">
                        {packet.invocation
                          ? `${packet.invocation.callerWorkflow} · ${packet.invocation.invocationReason}`
                          : "—"}
                      </td>
                      <td>
                        <OnboardingAdminTimestamp value={packet.createdAt} />
                      </td>
                      <td>{packet.openToWorker ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </OnboardingAdminPanel>

          <OnboardingAdminPanel
            title="Module completion in effect"
            description="The completion currently governing this worker, whichever packet recorded it."
          >
            {data.effectiveCompletion.length === 0 ? (
              <OnboardingAdminEmpty title="No module completion is in effect for this worker." />
            ) : (
              <table className="oba-table">
                <thead>
                  <tr>
                    <th scope="col">Module</th>
                    <th scope="col">Qualifier</th>
                    <th scope="col">In effect since</th>
                  </tr>
                </thead>
                <tbody>
                  {data.effectiveCompletion.map((record) => (
                    <tr key={`${record.moduleKey}:${record.qualifier}`}>
                      <td>
                        <span className="oba-module-number">{record.moduleNumber}</span>
                        <span className="oba-module-title">{record.title}</span>
                      </td>
                      <td className="oba-cell-detail">{record.qualifier}</td>
                      <td>
                        <OnboardingAdminTimestamp value={record.effectiveFrom} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </OnboardingAdminPanel>

          <OnboardingAdminPanel title="Outstanding">
            <OnboardingAdminFieldList>
              <OnboardingAdminField
                label="Modules not satisfied"
                value={
                  data.outstandingModuleKeys.length === 0
                    ? "Nothing outstanding"
                    : data.outstandingModuleKeys.join(", ")
                }
              />
              <OnboardingAdminField
                label="Administrative functions available to you here"
                value={
                  data.actions.length === 0
                    ? "None registered"
                    : data.actions.map((action) => action.title).join(", ")
                }
              />
            </OnboardingAdminFieldList>
          </OnboardingAdminPanel>
        </>
      ) : null}
    </OnboardingAdminShell>
  );
}
