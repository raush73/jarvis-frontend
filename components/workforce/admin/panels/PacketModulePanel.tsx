"use client";

/**
 * Phase 2 - administrative module completion presentation.
 *
 * The packet's required module set with each module's status, its governed citation, when its
 * completion was recorded, and whether its administrative phase has occurred. All of it is
 * recorded fact from the server; the table decides only the ordering the server already gave it
 * and the labels.
 *
 * Nothing here names a module. The rows are whatever the packet was composed of, so this table
 * presents a packet of two fixture modules and a packet of fifteen governed ones identically.
 */

import type { OnboardingAdminModule } from "@/lib/workforce/onboardingAdminApi";
import { OnboardingAdminTimestamp } from "./DetailPanel";
import { OnboardingAdminModuleStatusBadge } from "./StatusPresentation";
import { OnboardingAdminEmpty } from "../OnboardingAdminNotice";

export function OnboardingAdminPacketModuleTable({
  modules,
  onOpenModule,
}: {
  modules: readonly OnboardingAdminModule[];
  /** Mount point for a module's own administrative panel, when one is registered. */
  onOpenModule?: (moduleKey: string) => void;
}) {
  if (modules.length === 0) {
    return (
      <OnboardingAdminEmpty
        title="This packet requires no modules."
        detail="Nothing was composed into it."
      />
    );
  }

  return (
    <table className="oba-table">
      <thead>
        <tr>
          <th scope="col">Module</th>
          <th scope="col">Status</th>
          <th scope="col">Required because</th>
          <th scope="col">Completed</th>
          <th scope="col">Administrative phase</th>
          <th scope="col">Governance</th>
        </tr>
      </thead>
      <tbody>
        {modules.map((module) => (
          <tr key={module.moduleKey} className={module.outstanding ? "oba-row-outstanding" : undefined}>
            <td>
              <span className="oba-module-number">{module.moduleNumber}</span>
              {onOpenModule ? (
                <button
                  type="button"
                  className="oba-btn oba-btn-link"
                  onClick={() => onOpenModule(module.moduleKey)}
                >
                  {module.title}
                </button>
              ) : (
                <span className="oba-module-title">{module.title}</span>
              )}
              {module.requiredQualifier ? (
                <span className="oba-module-qualifier">{module.requiredQualifier}</span>
              ) : null}
            </td>
            <td>
              <OnboardingAdminModuleStatusBadge status={module.status} />
            </td>
            <td>{module.requirementReason.replace(/_/g, " ").toLowerCase()}</td>
            <td>
              <OnboardingAdminTimestamp value={module.completedAt} />
            </td>
            <td>
              {module.mw4hPhaseNature === null ? (
                <span className="oba-field-absent">None declared</span>
              ) : module.mw4hPhaseRecorded ? (
                <>
                  <span className="oba-badge oba-badge-complete">Recorded</span>
                  <OnboardingAdminTimestamp value={module.mw4hPhaseRecordedAt} />
                </>
              ) : (
                <span className="oba-badge oba-badge-pending">
                  {module.mw4hPhaseGatesCompletion ? "Required, outstanding" : "Outstanding"}
                </span>
              )}
            </td>
            <td className="oba-cell-detail">{module.governanceSection ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
