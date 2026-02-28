"use client";

/**
 * EventSpineTimelineSnapshot — UI-Only Mock Component
 * 
 * Displays a read-only vertical timeline of mock events.
 * No persistence, no backend, no real data wiring.
 * 
 * Props:
 * - mode: "full" | "compact"
 * - contextLabel: string (e.g., "Employee Timeline", "Order Vetting Context")
 * - workerName: string (mock ok)
 * - orderRef: string (mock ok)
 */

interface SpineEvent {
  type: string;
  at: string;
  title: string;
  detail?: string;
  entity: "order" | "worker" | "timesheet";
  actor: "system" | "internal" | "worker" | "customer";
}

// Mock event data (self-contained)
const MOCK_EVENTS: SpineEvent[] = [
  {
    type: "order.created",
    at: "2026-01-15T09:00:00Z",
    title: "Order Created",
    detail: "New order opened for Industrial Millwright project",
    entity: "order",
    actor: "internal",
  },
  {
    type: "candidate.added_to_order",
    at: "2026-01-16T10:30:00Z",
    title: "Candidate Added",
    detail: "Worker added to candidate pool via Jarvis match",
    entity: "worker",
    actor: "system",
  },
  {
    type: "customer.approval_required",
    at: "2026-01-17T14:00:00Z",
    title: "Customer Approval Required",
    detail: "Candidate submitted for customer pre-approval",
    entity: "order",
    actor: "internal",
  },
  {
    type: "approval.package.generated",
    at: "2026-01-18T08:15:00Z",
    title: "Approval Package Generated",
    detail: "Tier 2 approval package sent to customer",
    entity: "order",
    actor: "system",
  },
  {
    type: "worker.dispatched",
    at: "2026-01-20T11:00:00Z",
    title: "Worker Dispatched",
    detail: "Dispatch confirmed for start date 2026-01-27",
    entity: "worker",
    actor: "internal",
  },
  {
    type: "timesheet.created",
    at: "2026-01-27T06:00:00Z",
    title: "Timesheet Created",
    detail: "Week 1 timesheet initialized",
    entity: "timesheet",
    actor: "system",
  },
  {
    type: "timesheet.submitted",
    at: "2026-02-02T17:30:00Z",
    title: "Timesheet Submitted",
    detail: "Worker submitted 40 hours for approval",
    entity: "timesheet",
    actor: "worker",
  },
  {
    type: "timesheet.approved",
    at: "2026-02-03T09:00:00Z",
    title: "Timesheet Approved",
    detail: "Customer approved timesheet for payment",
    entity: "timesheet",
    actor: "customer",
  },
];

// Entity badge colors
const ENTITY_COLORS: Record<string, { bg: string; text: string }> = {
  order: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" },
  worker: { bg: "rgba(139, 92, 246, 0.15)", text: "#a78bfa" },
  timesheet: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" },
};

// Actor badge colors
const ACTOR_COLORS: Record<string, { bg: string; text: string }> = {
  system: { bg: "rgba(99, 102, 241, 0.15)", text: "#818cf8" },
  internal: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" },
  worker: { bg: "rgba(139, 92, 246, 0.15)", text: "#a78bfa" },
  customer: { bg: "rgba(34, 197, 94, 0.15)", text: "#34d399" },
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventSpineTimelineSnapshot({
  mode,
  contextLabel,
  workerName,
  orderRef,
}: {
  mode: "full" | "compact";
  contextLabel: string;
  workerName: string;
  orderRef: string;
}) {
  const isCompact = mode === "compact";

  return (
    <div className={`event-spine-container ${isCompact ? "compact" : "full"}`}>
      {/* Header */}
      <div className="spine-header">
        <div className="header-title">
          <span className="header-icon">📋</span>
          <h3>{contextLabel}</h3>
        </div>
        <span className="mock-badge">UI Only</span>
      </div>

      {/* Context Info */}
      <div className="context-info">
        <span className="context-item">
          <span className="context-label">Worker:</span>
          <span className="context-value">{workerName}</span>
        </span>
        <span className="context-item">
          <span className="context-label">Order:</span>
          <span className="context-value">{orderRef}</span>
        </span>
      </div>

      {/* Timeline */}
      <div className="timeline-list">
        {MOCK_EVENTS.map((event, index) => (
          <div key={index} className="timeline-item">
            {/* Timeline connector */}
            <div className="timeline-connector">
              <div className="connector-dot"></div>
              {index < MOCK_EVENTS.length - 1 && <div className="connector-line"></div>}
            </div>

            {/* Event content */}
            <div className="event-content">
              <div className="event-header">
                <span className="event-title">{event.title}</span>
                <span className="event-timestamp">{formatTimestamp(event.at)}</span>
              </div>

              {/* Detail (hidden in compact mode) */}
              {!isCompact && event.detail && (
                <p className="event-detail">{event.detail}</p>
              )}

              {/* Badges */}
              <div className="event-badges">
                <span
                  className="badge entity-badge"
                  style={{
                    background: ENTITY_COLORS[event.entity]?.bg,
                    color: ENTITY_COLORS[event.entity]?.text,
                  }}
                >
                  {event.entity}
                </span>
                <span
                  className="badge actor-badge"
                  style={{
                    background: ACTOR_COLORS[event.actor]?.bg,
                    color: ACTOR_COLORS[event.actor]?.text,
                  }}
                >
                  {event.actor}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .event-spine-container {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 16px;
        }

        .event-spine-container.compact {
          padding: 12px;
        }

        /* Header */
        .spine-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-icon {
          font-size: 14px;
        }

        .header-title h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .compact .header-title h3 {
          font-size: 11px;
        }

        .mock-badge {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border-radius: 4px;
        }

        /* Context Info */
        .context-info {
          display: flex;
          gap: 16px;
          margin-bottom: 14px;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
        }

        .compact .context-info {
          gap: 12px;
          padding: 6px 8px;
          margin-bottom: 10px;
        }

        .context-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .context-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
        }

        .compact .context-label {
          font-size: 9px;
        }

        .context-value {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
        }

        .compact .context-value {
          font-size: 10px;
        }

        /* Timeline List */
        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-height: 400px;
          overflow-y: auto;
        }

        .compact .timeline-list {
          max-height: 280px;
        }

        .timeline-list::-webkit-scrollbar {
          width: 4px;
        }

        .timeline-list::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }

        .timeline-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
        }

        /* Timeline Item */
        .timeline-item {
          display: flex;
          gap: 12px;
          position: relative;
        }

        .compact .timeline-item {
          gap: 10px;
        }

        /* Timeline Connector */
        .timeline-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 12px;
          flex-shrink: 0;
        }

        .connector-dot {
          width: 10px;
          height: 10px;
          background: rgba(59, 130, 246, 0.8);
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .compact .connector-dot {
          width: 8px;
          height: 8px;
        }

        .connector-line {
          width: 2px;
          flex: 1;
          min-height: 20px;
          background: rgba(255, 255, 255, 0.1);
        }

        .compact .connector-line {
          min-height: 14px;
        }

        /* Event Content */
        .event-content {
          flex: 1;
          padding-bottom: 14px;
        }

        .compact .event-content {
          padding-bottom: 10px;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 4px;
        }

        .event-title {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }

        .compact .event-title {
          font-size: 11px;
        }

        .event-timestamp {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.45);
          white-space: nowrap;
        }

        .compact .event-timestamp {
          font-size: 9px;
        }

        .event-detail {
          margin: 0 0 6px 0;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.4;
        }

        /* Badges */
        .event-badges {
          display: flex;
          gap: 6px;
        }

        .compact .event-badges {
          gap: 4px;
        }

        .badge {
          font-size: 9px;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: capitalize;
        }

        .compact .badge {
          font-size: 8px;
          padding: 1px 5px;
        }
      `}</style>
    </div>
  );
}
