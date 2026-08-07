"use client";

/**
 * Phase 2 - the investigation navigation foundation.
 *
 * The read-only reconstruction: for one worker, every packet, every version of every module's
 * completion with both effective dates, and the whole audit trail, navigable from one place.
 *
 * FOUNDATION ONLY, and the distinction matters. This surface establishes how an investigation is
 * NAVIGATED - the timeline, the drill-down into a module's version chain, the trail alongside it.
 * It implements no investigation behaviour: no finding, no determination, no correction, no
 * conclusion is recorded here, and there is no control on this surface that writes anything. A
 * later phase supplies that behaviour, and it will mount into this navigation.
 *
 * The whole surface is one audited read. Reconstructing a worker's history is itself an act worth
 * recording, and the server records it.
 */

import { useState } from "react";
import Link from "next/link";
import type { OnboardingAdminAuditRequest } from "@/lib/workforce/onboardingAdminApi";
import {
  getOnboardingAdminInvestigation,
  onboardingAdminPacketPath,
  onboardingAdminWorkerPath,
} from "@/lib/workforce/onboardingAdminApi";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel, OnboardingAdminTimestamp } from "../panels/DetailPanel";
import {
  OnboardingAdminPacketStateBadge,
  OnboardingAdminProgressBar,
} from "../panels/StatusPresentation";
import { OnboardingAdminSummary } from "../panels/SummaryPanel";
import { OnboardingAdminHistoryTable } from "../panels/HistoryTable";
import { OnboardingAdminAuditTrailPanel } from "../panels/AuditTrailPanel";
import { OnboardingAdminWorkerContextHeader } from "../panels/WorkerContextHeader";
import { OnboardingAdminReviewPanel } from "../panels/ReviewPanel";

export default function OnboardingAdminInvestigation({
  candidateId,
}: {
  candidateId: string;
}) {
  const [request, setRequest] = useState<OnboardingAdminAuditRequest>({ page: 1 });
  const [openModuleKey, setOpenModuleKey] = useState<string | null>(null);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdminInvestigation(candidateId, request),
    [candidateId, request],
  );

  const openModule =
    data?.timeline.find((entry) => entry.moduleKey === openModuleKey) ?? null;

  return (
    <OnboardingAdminShell
      title="Investigation"
      subtitle="A read-only reconstruction of what this worker did, when, and what was recorded. Nothing on this surface alters anything."
      backHref={onboardingAdminWorkerPath(candidateId)}
      backLabel="Worker"
      context={
        data ? (
          <OnboardingAdminWorkerContextHeader
            worker={data.worker}
            showWorkerLink
            showInvestigationLink={false}
          />
        ) : undefined
      }
    >
      {loading ? <OnboardingAdminLoading label="Reconstructing history" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <OnboardingAdminSummary
            figures={[
              { label: "Packets", value: data.packets.length },
              {
                label: "Modules with recorded history",
                value: data.timeline.length,
              },
              { label: "Recorded events", value: data.audit.total },
            ]}
          />

          <OnboardingAdminPanel
            title="Packets"
            description="Every packet this worker has had, oldest change last."
          >
            {data.packets.length === 0 ? (
              <OnboardingAdminEmpty title="This worker has no packet to reconstruct." />
            ) : (
              <table className="oba-table">
                <thead>
                  <tr>
                    <th scope="col">Packet</th>
                    <th scope="col">State</th>
                    <th scope="col">Progress</th>
                    <th scope="col">Opened</th>
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
                      <td>
                        <OnboardingAdminTimestamp value={packet.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </OnboardingAdminPanel>

          <OnboardingAdminPanel
            title="Module timeline"
            description="Every module with recorded completion, in governed order. Open one to see each version, including superseded ones."
          >
            {data.timeline.length === 0 ? (
              <OnboardingAdminEmpty
                title="No module completion has been recorded for this worker."
                detail="There is history to reconstruct only once something has been recorded."
              />
            ) : (
              <table className="oba-table">
                <thead>
                  <tr>
                    <th scope="col">Module</th>
                    <th scope="col">Versions</th>
                    <th scope="col">In effect</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Governance</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((entry) => (
                    <tr
                      key={entry.moduleKey}
                      className={entry.moduleKey === openModuleKey ? "oba-row-selected" : undefined}
                    >
                      <td>
                        <span className="oba-module-number">{entry.moduleNumber}</span>
                        <span className="oba-module-title">{entry.title}</span>
                      </td>
                      <td>{entry.versions.length}</td>
                      <td>{entry.currentlyEffectiveCount}</td>
                      <td>
                        {entry.registered ? (
                          "Yes"
                        ) : (
                          <span className="oba-field-absent">No longer registered</span>
                        )}
                      </td>
                      <td className="oba-cell-detail">{entry.governanceSection ?? "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="oba-btn oba-btn-link"
                          onClick={() =>
                            setOpenModuleKey((current) =>
                              current === entry.moduleKey ? null : entry.moduleKey,
                            )
                          }
                        >
                          {entry.moduleKey === openModuleKey ? "Close" : "Open history"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </OnboardingAdminPanel>

          {openModule ? (
            <>
              <OnboardingAdminPanel
                title={`${openModule.moduleNumber} · ${openModule.title}`}
                description="Every recorded version. Superseded records are preserved, never overwritten."
              >
                <OnboardingAdminHistoryTable versions={openModule.versions} />
              </OnboardingAdminPanel>

              <OnboardingAdminReviewPanel
                worker={data.worker}
                packet={null}
                module={null}
                history={openModule}
              />
            </>
          ) : null}

          <OnboardingAdminAuditTrailPanel
            title="Audit trail"
            description="Every recorded event for this worker, across every packet, including refused attempts."
            audit={data.audit}
            request={request}
            onRequest={setRequest}
          />
        </>
      ) : null}
    </OnboardingAdminShell>
  );
}
