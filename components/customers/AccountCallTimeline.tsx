"use client";

type CallHistoryItem = {
  id: string;
  customerId: string;
  contactId: string | null;
  userId: string;
  origin: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: string | null;
  createdAt: string;
  repName: string | null;
  contactName: string | null;
  lastNote: string | null;
  hasOpenFollowUp: boolean;
};

const ORIGIN_LABELS: Record<string, string> = {
  FRIDAY_SESSION: "Friday Session",
  FRIDAY_MANUAL: "Friday Manual",
  CUSTOMER_DETAIL: "Customer Detail",
  INBOUND: "Inbound",
};

const OUTCOME_LABELS: Record<string, string> = {
  NO_ANSWER: "No Answer",
  LEFT_VOICEMAIL: "Left Voicemail",
  SPOKE_NO_OPPORTUNITY: "Spoke — No Opportunity",
  OPPORTUNITY_IDENTIFIED: "Opportunity Identified",
  FOLLOW_UP_REQUIRED: "Follow-Up Required",
  CLOSED_NO_INTEREST: "Closed — No Interest",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AccountCallTimeline({
  history,
  loading,
  error,
}: {
  history: CallHistoryItem[];
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <div className="call-timeline-panel">
        <div className="call-timeline-empty">Loading call history…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="call-timeline-panel">
        <div className="call-timeline-empty" style={{ color: "#c0392b" }}>
          Failed to load call history: {error}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="call-timeline-panel">
        <div className="call-timeline-empty">No call history for this account.</div>
        <style jsx>{timelineStyles}</style>
      </div>
    );
  }

  return (
    <div className="call-timeline-panel">
      <div className="call-timeline-list">
        {history.map((call) => (
          <div key={call.id} className="call-timeline-item">
            <div className="call-timeline-row-top">
              <span className="call-timeline-date">
                {formatDateTime(call.startedAt)}
              </span>
              <span className="call-timeline-origin">
                {ORIGIN_LABELS[call.origin] ?? call.origin}
              </span>
              {call.hasOpenFollowUp && (
                <span className="call-timeline-followup-badge">Open follow-up</span>
              )}
            </div>

            <div className="call-timeline-row-mid">
              {call.outcome && (
                <span className="call-timeline-outcome">
                  {OUTCOME_LABELS[call.outcome] ?? call.outcome}
                </span>
              )}
              {call.durationSeconds != null && call.durationSeconds > 0 && (
                <span className="call-timeline-duration">
                  {formatDuration(call.durationSeconds)}
                </span>
              )}
              {call.repName && (
                <span className="call-timeline-rep">{call.repName}</span>
              )}
              {call.contactName && (
                <span className="call-timeline-contact">→ {call.contactName}</span>
              )}
            </div>

            {call.lastNote && (
              <div className="call-timeline-note">{call.lastNote}</div>
            )}
          </div>
        ))}
      </div>
      <style jsx>{timelineStyles}</style>
    </div>
  );
}

const timelineStyles = `
  .call-timeline-panel {
    padding: 0;
  }
  .call-timeline-empty {
    padding: 32px 16px;
    text-align: center;
    color: #8e99a4;
    font-size: 14px;
  }
  .call-timeline-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: #e9ecef;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
  }
  .call-timeline-item {
    background: #fff;
    padding: 12px 16px;
  }
  .call-timeline-row-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .call-timeline-date {
    font-size: 13px;
    font-weight: 600;
    color: #2c3e50;
  }
  .call-timeline-origin {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #eef1f5;
    color: #5a6872;
    font-weight: 500;
  }
  .call-timeline-followup-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #fff3e0;
    color: #e67e22;
    font-weight: 600;
    margin-left: auto;
  }
  .call-timeline-row-mid {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
    color: #5a6872;
    margin-bottom: 2px;
  }
  .call-timeline-outcome {
    font-weight: 500;
    color: #34495e;
  }
  .call-timeline-duration {
    color: #8e99a4;
  }
  .call-timeline-rep {
    color: #5a6872;
  }
  .call-timeline-contact {
    color: #7f8c8d;
  }
  .call-timeline-note {
    margin-top: 6px;
    font-size: 13px;
    color: #4a5568;
    line-height: 1.5;
    background: #f8f9fa;
    padding: 8px 10px;
    border-radius: 4px;
    border-left: 3px solid #d0d7de;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
