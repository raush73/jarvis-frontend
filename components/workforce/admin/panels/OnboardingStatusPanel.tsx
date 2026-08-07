"use client";

/**
 * Phase 3 - the administrative status panel.
 *
 * The single read authority's answer for one worker, inside the Phase 2 workspace. It reads
 * the administrative projection and renders it: the published-completion indicator, and one
 * row per module with the status and any governed recorded outcome.
 *
 * It is a PANEL, mounted into the existing shell. Phase 3 builds no second workspace, no
 * second navigation, and no second packet renderer; the workspace gains a panel and loses
 * nothing.
 *
 * Two things it does not do. It does not fall back to the Phase 2 packet projection when
 * the read is refused - an operator who may not read status is told so, rather than shown a
 * status assembled from somewhere else. And it renders no control: this surface reports
 * where a worker stands and offers no way to change it, because there is no way to change it.
 */

import {
  getOnboardingAdministrativeStatus,
  type OnboardingAdministrativePacketStatus,
} from "@/lib/workforce/onboardingStatusApi";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel } from "./DetailPanel";
import { OnboardingAdminPacketStateBadge } from "./StatusPresentation";
import OnboardingCompletionIndicator from "@/components/workforce/onboarding/status/OnboardingCompletionIndicator";
import OnboardingCompletionDetailList from "@/components/workforce/onboarding/status/OnboardingCompletionDetailList";
import OnboardingPacketProgress from "@/components/workforce/onboarding/status/OnboardingPacketProgress";

export function OnboardingAdminStatusPanel({ candidateId }: { candidateId: string }) {
  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdministrativeStatus(candidateId),
    [candidateId],
  );

  return (
    <OnboardingAdminPanel
      title="Onboarding status"
      description="Read from the onboarding status authority. The same status this worker sees, and the same words."
      actions={
        data ? (
          <OnboardingCompletionIndicator published={data.published} />
        ) : undefined
      }
    >
      {loading ? <OnboardingAdminLoading label="Loading status" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data && data.packets.length === 0 ? (
        <OnboardingAdminEmpty
          title="No onboarding status to report."
          detail="Nothing has been invoked for this worker, so there is nothing to derive a status from."
        />
      ) : null}

      {data
        ? data.packets.map((packet) => (
            <OnboardingAdminStatusPacket key={packet.packetId} packet={packet} />
          ))
        : null}
    </OnboardingAdminPanel>
  );
}

function OnboardingAdminStatusPacket({
  packet,
}: {
  packet: OnboardingAdministrativePacketStatus;
}) {
  return (
    <div className="oba-status-packet" data-packet-id={packet.packetId}>
      <div className="oba-status-packet-head">
        <span className="oba-module-title">Version {packet.packetVersion}</span>
        <OnboardingAdminPacketStateBadge state={packet.packetState as never} />
      </div>

      <OnboardingPacketProgress progress={packet.progress} noun="modules" />

      {/*
        The SHARED drill-down, not a table of this panel's own. Implementation plan Section 11
        requires the completion detail panel to be "used identically by the worker runtime and
        the administrative workspace", and a second table here would be a second way of saying
        the same thing - free, the first time either changed, to say it differently.

        The rows are the administrative projection's own fields, picked rather than
        transformed. Nothing is computed here and nothing is hidden here: what an operator may
        not see is already absent from the projection, and what he may see he sees.
      */}
      <OnboardingCompletionDetailList
        modules={packet.modules.map((module) => ({
          moduleKey: module.moduleKey,
          moduleNumber: module.moduleNumber,
          title: module.title,
          status: module.status,
          recordedOutcome: module.recordedOutcome,
          completedAt: module.completedAt,
        }))}
        emptyMessage="This packet has no modules recorded against it."
      />
    </div>
  );
}

export default OnboardingAdminStatusPanel;
