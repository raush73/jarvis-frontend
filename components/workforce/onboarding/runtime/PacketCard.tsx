"use client";

/**
 * Phase 1 - per-packet summary card.
 *
 * One component, used on the dashboard and on the packet selection surface. Everything on
 * it - purpose, module count, how many are complete, status, last activity - is
 * server-supplied.
 */

import Link from "next/link";
import {
  packetPath,
  resumePath,
  type OnboardingRuntimePacket,
} from "@/lib/workforce/onboardingRuntimeApi";
import { OnboardingPacketStatusBadge } from "./OnboardingStatusBadge";
import OnboardingProgress from "./OnboardingProgress";

type Props = {
  packet: OnboardingRuntimePacket;
  /** Show the resume action. Suppressed on surfaces whose whole purpose is choosing. */
  showResume?: boolean;
};

export function formatActivity(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PacketCard({ packet, showResume = true }: Props) {
  const lastActivity = formatActivity(packet.lastActivityAt);

  return (
    <article className="ob-packet-card" data-invocation-id={packet.invocationId}>
      <div className="ob-packet-card-head">
        <div>
          <h2 className="ob-packet-card-title">Onboarding</h2>
        </div>
        <OnboardingPacketStatusBadge
          packetState={packet.packetState}
          complete={packet.completion.complete}
        />
      </div>

      <OnboardingProgress completion={packet.completion} />

      <dl className="ob-packet-card-facts">
        <div>
          <dt>Sections</dt>
          <dd>{packet.completion.requiredCount}</dd>
        </div>
        <div>
          <dt>Still to do</dt>
          {/*
            The count the SERVER says is his, not sections minus completions. A section waiting
            on our team is incomplete and is not something he can do anything about, and
            counting it here would hand him a task that does not exist.
          */}
          <dd>
            {packet.workerOutstandingCount > 0 ? packet.workerOutstandingCount : "Nothing"}
          </dd>
        </div>
        {packet.awaitingAdministrativeActionCount > 0 ? (
          <div>
            <dt>Waiting on us</dt>
            <dd>{packet.awaitingAdministrativeActionCount}</dd>
          </div>
        ) : null}
        {lastActivity ? (
          <div>
            <dt>Last activity</dt>
            <dd>{lastActivity}</dd>
          </div>
        ) : null}
      </dl>

      <div className="wf-btn-row">
        <Link className="wf-btn wf-btn-secondary wf-btn-sm" href={packetPath(packet.invocationId)}>
          See all sections
        </Link>
        {showResume && packet.resume ? (
          <Link className="wf-btn wf-btn-primary wf-btn-sm" href={resumePath(packet.resume)}>
            {packet.completion.completeCount > 0 ? "Pick up where I left off" : "Get started"}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default PacketCard;
