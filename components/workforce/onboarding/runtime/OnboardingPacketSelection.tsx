"use client";

/**
 * Phase 1 - packet selection.
 *
 * Rendered only where MORE THAN ONE packet is available to the worker. Where exactly one
 * is available, the dashboard never mounts this and the worker simply proceeds - being
 * asked to choose from a list of one is a choice that is not a choice.
 *
 * The runtime never invents a packet and never chooses one on a governed basis. It renders
 * what the server offered, and marks which one the server has him working in.
 */

import PacketCard from "./PacketCard";
import type { OnboardingRuntimePacket } from "@/lib/workforce/onboardingRuntimeApi";

type Props = {
  packets: OnboardingRuntimePacket[];
};

export function OnboardingPacketSelection({ packets }: Props) {
  return (
    <section className="wf-section ob-selection" aria-labelledby="ob-selection-title">
      <h2 className="wf-section-title" id="ob-selection-title">
        Choose which one to look at
      </h2>
      <p className="wf-section-note">
        You have more than one set of onboarding on file. You are currently working in the
        one marked below; the others are here so you can look back over them.
      </p>
      <div className="ob-packet-list">
        {packets.map((packet) => (
          <div
            key={packet.invocationId}
            className={`ob-selection-item ${packet.bound ? "is-current" : ""}`}
          >
            {packet.bound ? (
              <p className="wf-eyebrow" data-current-packet={packet.invocationId}>
                Currently working here
              </p>
            ) : null}
            <PacketCard packet={packet} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default OnboardingPacketSelection;
