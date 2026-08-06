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
  const outstanding = packet.completion.requiredCount - packet.completion.completeCount;
  const lastActivity = formatActivity(packet.lastActivityAt);

  return (
    <article className="ob-packet-card" data-invocation-id={packet.invocationId}>
      <div className="ob-packet-card-head">
        <div>
          <h2 className="ob-packet-card-title">Onboarding</h2>
          {/*
            The calling workflow's own statement of why this packet exists. The runtime
            does not invent a purpose, because it did not decide the packet was required.
          */}
          <p className="ob-packet-card-purpose">{packet.invocationReason}</p>
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
          <dt>Outstanding</dt>
          <dd>{outstanding > 0 ? outstanding : "None"}</dd>
        </div>
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
