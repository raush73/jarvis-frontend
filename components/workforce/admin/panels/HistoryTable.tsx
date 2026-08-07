"use client";

/**
 * Phase 2 - effective-dated record display, with BOTH dates.
 *
 * A completion record is appended and its predecessor is stamped; nothing is overwritten. This
 * table shows that: every version, its effective date, and the date it was superseded, with
 * the currently-effective one marked. An administrative surface that showed only the current
 * version could not explain what was true before it, which is precisely what an investigation
 * exists to answer.
 */

import type { OnboardingAdminCompletionVersion } from "@/lib/workforce/onboardingAdminApi";
import { OnboardingAdminTimestamp } from "./DetailPanel";
import { OnboardingAdminEmpty } from "../OnboardingAdminNotice";

const ACTOR_LABELS: Record<string, string> = {
  WORKER: "Worker",
  MW4H: "Staff",
  SYSTEM: "System",
};

export function OnboardingAdminHistoryTable({
  versions,
  emptyTitle = "No completion has been recorded for this module.",
  emptyDetail = "The worker has not completed it, and nothing has been recorded on his behalf.",
  onOpenPacket,
}: {
  versions: readonly OnboardingAdminCompletionVersion[];
  emptyTitle?: string;
  emptyDetail?: string;
  onOpenPacket?: (packetId: string) => void;
}) {
  if (versions.length === 0) {
    return <OnboardingAdminEmpty title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <table className="oba-table">
      <thead>
        <tr>
          <th scope="col">Version</th>
          <th scope="col">Qualifier</th>
          <th scope="col">Effective from</th>
          <th scope="col">Superseded</th>
          <th scope="col">Recorded by</th>
          <th scope="col">Packet</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((version) => (
          <tr
            key={version.completionId}
            className={version.currentlyEffective ? "oba-row-current" : undefined}
          >
            <td>
              {version.currentlyEffective ? (
                <span className="oba-badge oba-badge-complete">Currently effective</span>
              ) : (
                <span className="oba-badge oba-badge-superseded">Superseded</span>
              )}
            </td>
            <td>{version.qualifier}</td>
            <td>
              <OnboardingAdminTimestamp value={version.effectiveFrom} />
            </td>
            <td>
              {version.supersededAt ? (
                <OnboardingAdminTimestamp value={version.supersededAt} />
              ) : (
                <span className="oba-field-absent">Not superseded</span>
              )}
            </td>
            <td>
              {ACTOR_LABELS[version.recordedByType] ?? version.recordedByType}
              {version.recordedById ? ` (${version.recordedById})` : ""}
            </td>
            <td>
              {onOpenPacket ? (
                <button
                  type="button"
                  className="oba-btn oba-btn-link"
                  onClick={() => onOpenPacket(version.packetId)}
                >
                  Open packet
                </button>
              ) : (
                version.packetId
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
