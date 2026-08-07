"use client";

/**
 * Phase 2 - the reusable audit trail viewer.
 *
 * Chronological, filterable, showing actor, action, outcome, and timestamp, and never a
 * protected value. It renders the trail as the server shaped it and adds no interpretation:
 *
 *  - The action filter offers the actions present in the UNFILTERED trail, supplied by the
 *    server, so a filter once applied can still be changed.
 *  - `detail` is displayed verbatim because the sink's contract is that it is a non-sensitive
 *    classification code. There is nothing here to redact, and redacting would imply that
 *    something needing redaction had been recorded.
 */

import type {
  OnboardingAdminAudit,
  OnboardingAdminAuditRequest,
} from "@/lib/workforce/onboardingAdminApi";
import { OnboardingAdminPanel, OnboardingAdminTimestamp } from "./DetailPanel";
import { OnboardingAdminPager } from "./PagerControls";
import { OnboardingAdminEmpty } from "../OnboardingAdminNotice";

const ACTOR_LABELS: Record<string, string> = {
  WORKER: "Worker",
  MW4H: "Staff",
  SYSTEM: "System",
};

export function OnboardingAdminAuditTrailPanel({
  title = "Audit trail",
  description,
  audit,
  request,
  onRequest,
}: {
  title?: string;
  description?: string;
  audit: OnboardingAdminAudit;
  request: OnboardingAdminAuditRequest;
  onRequest: (next: OnboardingAdminAuditRequest) => void;
}) {
  return (
    <OnboardingAdminPanel
      title={title}
      description={
        description ??
        "Every recorded event, in order, with the actor and the outcome. No protected value is ever recorded here."
      }
      actions={
        <label className="oba-inline-field">
          <span className="oba-label">Action</span>
          <select
            className="oba-input"
            value={request.action ?? ""}
            onChange={(event) =>
              onRequest({ ...request, action: event.target.value || null, page: 1 })
            }
          >
            <option value="">All actions</option>
            {audit.availableActions.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {audit.events.length === 0 ? (
        <OnboardingAdminEmpty
          title="No recorded events match this filter."
          detail="Clear the filter to see the whole trail."
        />
      ) : (
        <table className="oba-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Outcome</th>
              <th scope="col">Actor</th>
              <th scope="col">Module</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audit.events.map((event, index) => (
              <tr key={`${event.occurredAt}-${event.action}-${index}`}>
                <td>
                  <OnboardingAdminTimestamp value={event.occurredAt} />
                </td>
                <td>{event.action.replace(/_/g, " ")}</td>
                <td>
                  <span
                    className={
                      event.outcome === "REFUSED"
                        ? "oba-badge oba-badge-refused"
                        : "oba-badge oba-badge-complete"
                    }
                  >
                    {event.outcome}
                  </span>
                </td>
                <td>
                  {ACTOR_LABELS[event.actorType] ?? event.actorType}
                  {event.actorId ? ` (${event.actorId})` : ""}
                </td>
                <td>{event.moduleKey ?? "—"}</td>
                <td className="oba-cell-detail">{event.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <OnboardingAdminPager
        page={audit.page}
        pageSize={audit.pageSize}
        total={audit.total}
        onPage={(page) => onRequest({ ...request, page })}
        label="events"
      />
    </OnboardingAdminPanel>
  );
}
