"use client";

/**
 * Phase 2 - the administrative packet workspace.
 *
 * The packet detail view: what onboarding required of this worker, how much of it is recorded,
 * what remains, who invoked it, and its full audit trail. This is the surface a module's
 * administrative panel mounts into once its own phase registers one, which is why the module
 * table here selects a module and hands it to the review panel rather than rendering module
 * content itself.
 *
 * Every figure on this surface is the server's: the packet's state, its derived progress, its
 * outstanding set, and whether it is still open to the worker. Nothing is recomputed here,
 * because a second computation of packet completeness would be a second authority on it.
 */

import { useState } from "react";
import Link from "next/link";
import {
  getOnboardingAdminPacket,
  getOnboardingAdminPacketAudit,
  getOnboardingAdminWorker,
  onboardingAdminWorkerPath,
} from "@/lib/workforce/onboardingAdminApi";
import type { OnboardingAdminAuditRequest } from "@/lib/workforce/onboardingAdminApi";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "../adminPermissions";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
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
import { OnboardingAdminPacketModuleTable } from "../panels/PacketModulePanel";
import { OnboardingAdminReviewPanel } from "../panels/ReviewPanel";
import { OnboardingAdminAuditTrailPanel } from "../panels/AuditTrailPanel";
import { OnboardingAdminWorkerContextHeader } from "../panels/WorkerContextHeader";

export default function OnboardingAdminPacketWorkspace({ packetId }: { packetId: string }) {
  const session = useSession();
  const { canReadAudit } = useOnboardingAdminPermissions(session);
  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);
  const [auditRequest, setAuditRequest] = useState<OnboardingAdminAuditRequest>({ page: 1 });

  const packet = useOnboardingAdminResource(
    () => getOnboardingAdminPacket(packetId),
    [packetId],
  );

  // The worker projection supplies the canonical masked worker context and the processing
  // actions this operator holds for this worker. It is a separate read because it is a separate
  // authorization, and it is audited separately.
  const candidateId = packet.data?.candidateId ?? null;
  const worker = useOnboardingAdminResource(
    () => getOnboardingAdminWorker(candidateId as string),
    [candidateId],
    { enabled: candidateId !== null },
  );

  const audit = useOnboardingAdminResource(
    () => getOnboardingAdminPacketAudit(packetId, auditRequest),
    [packetId, auditRequest],
    { enabled: canReadAudit },
  );

  const selectedModule =
    packet.data?.modules.find((module) => module.moduleKey === selectedModuleKey) ?? null;

  return (
    <OnboardingAdminShell
      title={
        packet.data ? `Packet version ${packet.data.packetVersion}` : "Packet"
      }
      subtitle="What onboarding required of this worker, and what is recorded against it."
      backHref={
        packet.data ? onboardingAdminWorkerPath(packet.data.candidateId) : "/onboarding/packets"
      }
      backLabel={packet.data ? "Worker" : "Packet search"}
      context={
        worker.data ? (
          <OnboardingAdminWorkerContextHeader
            worker={worker.data.worker}
            showWorkerLink
            showInvestigationLink={canReadAudit}
          />
        ) : undefined
      }
    >
      {packet.loading ? <OnboardingAdminLoading label="Loading packet" /> : null}
      {packet.error ? (
        <OnboardingAdminErrorNotice error={packet.error} onRetry={packet.reload} />
      ) : null}

      {packet.data ? (
        <>
          <OnboardingAdminPanel
            title="Packet"
            description="State and progress as the framework derived them."
            actions={
              <Link
                className="oba-btn oba-btn-quiet"
                href={onboardingAdminWorkerPath(packet.data.candidateId)}
              >
                Open worker
              </Link>
            }
          >
            <OnboardingAdminFieldList>
              <OnboardingAdminField
                label="State"
                value={<OnboardingAdminPacketStateBadge state={packet.data.packetState} />}
              />
              <OnboardingAdminField
                label="Progress"
                value={<OnboardingAdminProgressBar progress={packet.data.progress} />}
              />
              <OnboardingAdminField
                label="Outstanding modules"
                value={
                  packet.data.outstandingModuleKeys.length === 0
                    ? "None"
                    : packet.data.outstandingModuleKeys.join(", ")
                }
              />
              <OnboardingAdminField
                label="Open to worker"
                value={packet.data.openToWorker ? "Yes" : "No"}
                hint={
                  packet.data.executed
                    ? "Executed"
                    : packet.data.administrativelyFinalized
                      ? "Administratively finalized"
                      : undefined
                }
              />
              <OnboardingAdminField
                label="Opened"
                value={<OnboardingAdminTimestamp value={packet.data.createdAt} />}
              />
              <OnboardingAdminField
                label="Last change"
                value={<OnboardingAdminTimestamp value={packet.data.updatedAt} />}
              />
            </OnboardingAdminFieldList>
          </OnboardingAdminPanel>

          <OnboardingAdminPanel
            title="Invocation"
            description="Onboarding is invoked by another workflow and records why."
          >
            <OnboardingAdminFieldList>
              <OnboardingAdminField
                label="Invoking workflow"
                value={packet.data.invocation?.callerWorkflow ?? null}
              />
              <OnboardingAdminField
                label="Reason"
                value={packet.data.invocation?.invocationReason ?? null}
              />
              <OnboardingAdminField label="Kind" value={packet.data.invocation?.kind ?? null} />
              <OnboardingAdminField
                label="Invoked"
                value={<OnboardingAdminTimestamp value={packet.data.invocation?.createdAt ?? null} />}
              />
            </OnboardingAdminFieldList>
          </OnboardingAdminPanel>

          <OnboardingAdminPanel
            title="Required modules"
            description="Composed by the framework for this worker. Select a module to open its review."
          >
            <OnboardingAdminPacketModuleTable
              modules={packet.data.modules}
              onOpenModule={(moduleKey) =>
                setSelectedModuleKey((current) => (current === moduleKey ? null : moduleKey))
              }
            />
          </OnboardingAdminPanel>

          {selectedModule && worker.data ? (
            <OnboardingAdminReviewPanel
              worker={worker.data.worker}
              packet={packet.data}
              module={selectedModule}
              actions={worker.data.actions}
              onExecuted={() => {
                packet.reload();
                audit.reload();
              }}
            />
          ) : null}

          {canReadAudit ? (
            audit.error ? (
              <OnboardingAdminErrorNotice error={audit.error} onRetry={audit.reload} />
            ) : audit.data ? (
              <OnboardingAdminAuditTrailPanel
                title="Packet audit trail"
                audit={audit.data}
                request={auditRequest}
                onRequest={setAuditRequest}
              />
            ) : (
              <OnboardingAdminLoading label="Loading audit trail" />
            )
          ) : null}
        </>
      ) : null}
    </OnboardingAdminShell>
  );
}
