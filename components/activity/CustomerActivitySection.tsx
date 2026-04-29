"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  ActivityType,
  TimelineEntry,
  OpenActivityEntry,
  TimelineResponse,
  OpenActivitiesResponse,
  ACTIVITY_FILTER_TABS,
  ACTIVITY_TYPE_BADGES,
  formatActivityDateTime,
  formatActivityDueDate,
} from "./types";
import FullConnectivityPanel from "./FullConnectivityPanel";
import AddActivityModal from "./AddActivityModal";

const TIMELINE_PAGE_SIZE = 50;

export default function CustomerActivitySection({
  customerId,
  refreshKey,
}: {
  customerId: string;
  refreshKey: number;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  const combinedRefreshKey = refreshKey + localRefresh;

  const handleActivityCreated = useCallback(() => {
    setLocalRefresh((k) => k + 1);
  }, []);

  const [openItems, setOpenItems] = useState<OpenActivityEntry[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState("");

  const [timelineItems, setTimelineItems] = useState<TimelineEntry[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [timelineOffset, setTimelineOffset] = useState(0);

  const [activeFilter, setActiveFilter] = useState<ActivityType | "ALL">("ALL");

  const loadOpenActivities = useCallback(async () => {
    setOpenLoading(true);
    setOpenError("");
    try {
      const data = await apiFetch<OpenActivitiesResponse>(
        `/activity/company/${customerId}/open-activities`
      );
      setOpenItems(data.items ?? []);
    } catch (e: any) {
      setOpenError(e?.message ?? "Failed to load open activities.");
    } finally {
      setOpenLoading(false);
    }
  }, [customerId]);

  const loadTimeline = useCallback(
    async (offset = 0, append = false) => {
      setTimelineLoading(true);
      setTimelineError("");
      try {
        const typesParam = activeFilter !== "ALL" ? `&types=${activeFilter}` : "";
        const data = await apiFetch<TimelineResponse>(
          `/activity/company/${customerId}/timeline?limit=${TIMELINE_PAGE_SIZE}&offset=${offset}${typesParam}`
        );
        if (append) {
          setTimelineItems((prev) => [...prev, ...(data.items ?? [])]);
        } else {
          setTimelineItems(data.items ?? []);
        }
        setTimelineTotal(data.total ?? 0);
        setTimelineOffset(offset + (data.items?.length ?? 0));
      } catch (e: any) {
        setTimelineError(e?.message ?? "Failed to load activity timeline.");
      } finally {
        setTimelineLoading(false);
      }
    },
    [customerId, activeFilter]
  );

  useEffect(() => {
    loadOpenActivities();
  }, [loadOpenActivities, combinedRefreshKey]);

  useEffect(() => {
    setTimelineOffset(0);
    setTimelineItems([]);
    loadTimeline(0, false);
  }, [loadTimeline, combinedRefreshKey]);

  const handleLoadMore = () => {
    loadTimeline(timelineOffset, true);
  };

  const handleFilterChange = (f: ActivityType | "ALL") => {
    setActiveFilter(f);
  };

  const hasMoreTimeline = timelineOffset < timelineTotal;

  return (
    <div className="activity-section">
      {/* ── Connectivity Panel: Relationship Context ── */}
      <FullConnectivityPanel
        customerId={customerId}
        openItems={openItems}
        refreshKey={combinedRefreshKey}
      />

      {/* ── ZONE 1: Open Activities ── */}
      <div className="activity-zone open-activities-zone">
        <div className="zone-header">
          <h3>Open Activities</h3>
          <button
            className="add-activity-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add Activity
          </button>
        </div>
        {openLoading && (
          <div className="activity-empty">Loading open activities…</div>
        )}
        {openError && (
          <div className="activity-empty activity-error">{openError}</div>
        )}
        {!openLoading && !openError && openItems.length === 0 && (
          <div className="activity-empty">No open activities</div>
        )}
        {!openLoading && !openError && openItems.length > 0 && (
          <div className="open-activities-list">
            {openItems.map((item) => (
              <div
                key={`${item.type}:${item.id}`}
                className={`open-activity-item ${item.isOverdue ? "overdue" : ""}`}
              >
                <div className="oa-top-row">
                  <span
                    className="oa-type-badge"
                    style={{
                      background: ACTIVITY_TYPE_BADGES[item.type]?.bg ?? "#eee",
                      color: ACTIVITY_TYPE_BADGES[item.type]?.color ?? "#333",
                    }}
                  >
                    {ACTIVITY_TYPE_BADGES[item.type]?.label ?? item.type}
                  </span>
                  {item.isOverdue && <span className="oa-overdue-badge">Overdue</span>}
                  {item.metadata?.isDueToday && !item.isOverdue && (
                    <span className="oa-due-today-badge">Due Today</span>
                  )}
                  {item.dueAt && (
                    <span className="oa-due-date">{formatActivityDueDate(item.dueAt)}</span>
                  )}
                  <span className="oa-assignee">{item.userName}</span>
                </div>
                <div className="oa-title">{item.title}</div>
                {item.body && <div className="oa-body">{item.body}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ZONE 2: Activity Timeline ── */}
      <div className="activity-zone timeline-zone">
        <div className="zone-header">
          <h3>Activity Timeline</h3>
          <div className="timeline-filters">
            {ACTIVITY_FILTER_TABS.map((f) => (
              <button
                key={f.value}
                className={`filter-btn ${activeFilter === f.value ? "active" : ""}`}
                onClick={() => handleFilterChange(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {timelineLoading && timelineItems.length === 0 && (
          <div className="activity-empty">Loading activity timeline…</div>
        )}
        {timelineError && (
          <div className="activity-empty activity-error">{timelineError}</div>
        )}
        {!timelineLoading && !timelineError && timelineItems.length === 0 && (
          <div className="activity-empty">No activity history for this account.</div>
        )}
        {timelineItems.length > 0 && (
          <div className="timeline-list">
            {timelineItems.map((item) => (
              <div key={`${item.type}:${item.id}`} className="timeline-item">
                <div className="tl-top-row">
                  <span className="tl-timestamp">{formatActivityDateTime(item.timestamp)}</span>
                  <span
                    className="tl-type-badge"
                    style={{
                      background: ACTIVITY_TYPE_BADGES[item.type]?.bg ?? "#eee",
                      color: ACTIVITY_TYPE_BADGES[item.type]?.color ?? "#333",
                    }}
                  >
                    {ACTIVITY_TYPE_BADGES[item.type]?.label ?? item.type}
                  </span>
                  {item.status && <span className="tl-status">{item.status}</span>}
                  <span className="tl-user">{item.userName}</span>
                </div>
                <div className="tl-title">{item.title}</div>
                {item.body && <div className="tl-body">{item.body}</div>}
              </div>
            ))}
          </div>
        )}
        {hasMoreTimeline && (
          <div className="timeline-load-more">
            <button
              className="load-more-btn"
              onClick={handleLoadMore}
              disabled={timelineLoading}
            >
              {timelineLoading ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddActivityModal
          customerId={customerId}
          onCreated={handleActivityCreated}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <style jsx>{`
        .add-activity-btn {
          padding: 5px 14px;
          border: 1px solid #1976d2;
          border-radius: 6px;
          background: #1976d2;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .add-activity-btn:hover {
          background: #1565c0;
        }
        .activity-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .activity-zone {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }
        .zone-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #e9ecef;
          background: #fafbfc;
        }
        .zone-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #2c3e50;
        }
        .activity-empty {
          padding: 24px 16px;
          text-align: center;
          color: #8e99a4;
          font-size: 14px;
        }
        .activity-error {
          color: #c0392b;
        }

        /* ── Open Activities ── */
        .open-activities-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: #e9ecef;
        }
        .open-activity-item {
          background: #fff;
          padding: 10px 16px;
        }
        .open-activity-item.overdue {
          border-left: 3px solid #e74c3c;
        }
        .oa-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
          font-size: 12px;
        }
        .oa-type-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .oa-overdue-badge {
          padding: 2px 8px;
          border-radius: 4px;
          background: #fdecea;
          color: #c0392b;
          font-size: 11px;
          font-weight: 600;
        }
        .oa-due-today-badge {
          padding: 2px 8px;
          border-radius: 4px;
          background: #fff8e1;
          color: #f57f17;
          font-size: 11px;
          font-weight: 600;
        }
        .oa-due-date {
          color: #5a6872;
          font-size: 12px;
        }
        .oa-assignee {
          margin-left: auto;
          color: #8e99a4;
          font-size: 12px;
        }
        .oa-title {
          font-size: 14px;
          font-weight: 500;
          color: #2c3e50;
        }
        .oa-body {
          margin-top: 4px;
          font-size: 13px;
          color: #5a6872;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* ── Timeline ── */
        .timeline-filters {
          display: flex;
          gap: 4px;
        }
        .filter-btn {
          padding: 4px 10px;
          border: 1px solid #d0d7de;
          border-radius: 4px;
          background: #fff;
          color: #5a6872;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-btn:hover {
          background: #f0f3f6;
        }
        .filter-btn.active {
          background: #1976d2;
          color: #fff;
          border-color: #1976d2;
        }
        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: #e9ecef;
        }
        .timeline-item {
          background: #fff;
          padding: 10px 16px;
        }
        .tl-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
          font-size: 12px;
        }
        .tl-timestamp {
          font-size: 13px;
          font-weight: 600;
          color: #2c3e50;
        }
        .tl-type-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .tl-status {
          font-size: 11px;
          color: #5a6872;
          background: #eef1f5;
          padding: 2px 6px;
          border-radius: 3px;
        }
        .tl-user {
          margin-left: auto;
          color: #8e99a4;
          font-size: 12px;
        }
        .tl-title {
          font-size: 14px;
          font-weight: 500;
          color: #2c3e50;
        }
        .tl-body {
          margin-top: 4px;
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
        .timeline-load-more {
          padding: 12px 16px;
          text-align: center;
          background: #fafbfc;
          border-top: 1px solid #e9ecef;
        }
        .load-more-btn {
          padding: 6px 20px;
          border: 1px solid #d0d7de;
          border-radius: 4px;
          background: #fff;
          color: #1976d2;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .load-more-btn:hover {
          background: #e8f4fd;
        }
        .load-more-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
