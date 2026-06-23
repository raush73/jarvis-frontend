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
  FOLLOWUP_TYPE_BADGES,
  type FollowUpType,
  formatActivityDateTime,
  formatActivityDueDate,
} from "./types";
import FullConnectivityPanel from "./FullConnectivityPanel";
import AddActivityModal from "./AddActivityModal";
import TaskEditForm from "./TaskEditForm";
import FollowUpDispositionModal, {
  DispositionConfirmPayload,
} from "./FollowUpDispositionModal";

const TIMELINE_PAGE_SIZE = 50;

export default function CustomerActivitySection({
  customerId,
  refreshKey,
  lifecycleStatus,
}: {
  customerId: string;
  refreshKey: number;
  lifecycleStatus?: string | null;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  const combinedRefreshKey = refreshKey + localRefresh;

  const handleActivityCreated = useCallback(() => {
    setLocalRefresh((k) => k + 1);
  }, []);

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<OpenActivityEntry | null>(null);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      await apiFetch(`/activity/tasks/${taskId}/complete`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setLocalRefresh((k) => k + 1);
    } catch {
      // Item stays in list, user can retry
    } finally {
      setCompletingTaskId(null);
    }
  }, []);

  const handleCancelTask = useCallback(async (taskId: string) => {
    setCancellingTaskId(taskId);
    try {
      await apiFetch(`/activity/tasks/${taskId}/cancel`, {
        method: "PATCH",
      });
      setLocalRefresh((k) => k + 1);
    } catch {
      // Item stays in list, user can retry
    } finally {
      setCancellingTaskId(null);
    }
  }, []);

  const handleTaskEdited = useCallback(() => {
    setEditingTask(null);
    setLocalRefresh((k) => k + 1);
  }, []);

  // ── Follow-up lifecycle (reuses existing FollowUpService endpoints) ──
  const [followUpActionId, setFollowUpActionId] = useState<string | null>(null);
  const [followUpActionMode, setFollowUpActionMode] = useState<
    "reschedule" | "cancel" | null
  >(null);
  const [followUpActionLoading, setFollowUpActionLoading] = useState<string | null>(null);
  const [followUpActionError, setFollowUpActionError] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Disposition modal (Complete action)
  const [dispositionFollowUpId, setDispositionFollowUpId] = useState<string | null>(null);
  const [dispositionBusy, setDispositionBusy] = useState(false);
  const [dispositionError, setDispositionError] = useState<string | null>(null);

  const resetFollowUpAction = useCallback(() => {
    setFollowUpActionId(null);
    setFollowUpActionMode(null);
    setFollowUpActionError("");
    setRescheduleDate("");
    setRescheduleTime("");
    setRescheduleReason("");
    setCancelReason("");
  }, []);

  const openFollowUpAction = useCallback(
    (id: string, mode: "reschedule" | "cancel") => {
      setFollowUpActionId((prev) => (prev === id && followUpActionMode === mode ? null : id));
      setFollowUpActionMode((prev) =>
        followUpActionId === id && prev === mode ? null : mode
      );
      setFollowUpActionError("");
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
      setCancelReason("");
    },
    [followUpActionId, followUpActionMode]
  );

  const openDisposition = useCallback((id: string) => {
    resetFollowUpAction();
    setDispositionError(null);
    setDispositionFollowUpId(id);
  }, [resetFollowUpAction]);

  const closeDisposition = useCallback(() => {
    setDispositionFollowUpId(null);
    setDispositionError(null);
    setDispositionBusy(false);
  }, []);

  const handleConfirmDisposition = useCallback(
    async (payload: DispositionConfirmPayload) => {
      if (!dispositionFollowUpId) return;
      setDispositionError(null);
      setDispositionBusy(true);
      try {
        // Replacement-contact workflow: create the replacement contact via the
        // existing CustomerContacts API, then close the original follow-up and
        // create a linked replacement follow-up in one complete call.
        let replacement:
          | {
              contactId: string;
              dueAt: string;
              hasExplicitTime: boolean;
              context?: string;
            }
          | undefined;
        if (payload.replacement) {
          const contact = await apiFetch<{ id: string }>(`/customer-contacts`, {
            method: "POST",
            body: JSON.stringify({
              customerId,
              firstName: payload.replacement.newContact.firstName,
              lastName: payload.replacement.newContact.lastName,
              jobTitle: payload.replacement.newContact.jobTitle,
              email: payload.replacement.newContact.email,
              cellPhone: payload.replacement.newContact.phone,
            }),
          });
          replacement = {
            contactId: contact.id,
            dueAt: payload.replacement.dueAt,
            hasExplicitTime: payload.replacement.hasExplicitTime,
            context: payload.replacement.context,
          };
        }

        await apiFetch(`/friday/follow-ups/${dispositionFollowUpId}/complete`, {
          method: "PATCH",
          body: JSON.stringify({
            disposition: payload.disposition,
            completionNote: payload.completionNote,
            createNext: payload.createNext,
            replacement,
          }),
        });
        setDispositionFollowUpId(null);
        setDispositionBusy(false);
        setLocalRefresh((k) => k + 1);
      } catch (e: any) {
        setDispositionError(e?.message ?? "Failed to complete follow-up.");
        setDispositionBusy(false);
      }
    },
    [dispositionFollowUpId, customerId]
  );

  const handleRescheduleFollowUp = useCallback(
    async (id: string) => {
      setFollowUpActionError("");
      if (!rescheduleDate) {
        setFollowUpActionError("New due date is required.");
        return;
      }
      const newDueAt = rescheduleTime
        ? new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
        : new Date(`${rescheduleDate}T09:00:00`).toISOString();
      setFollowUpActionLoading(id);
      try {
        await apiFetch(`/friday/follow-ups/${id}/reschedule`, {
          method: "PATCH",
          body: JSON.stringify({
            newDueAt,
            hasExplicitTime: !!rescheduleTime,
            reason: rescheduleReason.trim() || undefined,
          }),
        });
        resetFollowUpAction();
        setLocalRefresh((k) => k + 1);
      } catch (e: any) {
        setFollowUpActionError(e?.message ?? "Failed to reschedule follow-up.");
      } finally {
        setFollowUpActionLoading(null);
      }
    },
    [rescheduleDate, rescheduleTime, rescheduleReason, resetFollowUpAction]
  );

  const handleCancelFollowUp = useCallback(
    async (id: string) => {
      setFollowUpActionError("");
      setFollowUpActionLoading(id);
      try {
        await apiFetch(`/friday/follow-ups/${id}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({ reason: cancelReason.trim() || "Cancelled by user" }),
        });
        resetFollowUpAction();
        setLocalRefresh((k) => k + 1);
      } catch (e: any) {
        setFollowUpActionError(e?.message ?? "Failed to cancel follow-up.");
      } finally {
        setFollowUpActionLoading(null);
      }
    },
    [cancelReason, resetFollowUpAction]
  );

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
                  {item.type === "FOLLOW_UP" &&
                    item.metadata?.followUpType &&
                    FOLLOWUP_TYPE_BADGES[
                      item.metadata.followUpType as FollowUpType
                    ] && (
                      <span
                        className="oa-type-badge"
                        style={{
                          background:
                            FOLLOWUP_TYPE_BADGES[
                              item.metadata.followUpType as FollowUpType
                            ].bg,
                          color:
                            FOLLOWUP_TYPE_BADGES[
                              item.metadata.followUpType as FollowUpType
                            ].color,
                        }}
                      >
                        {
                          FOLLOWUP_TYPE_BADGES[
                            item.metadata.followUpType as FollowUpType
                          ].label
                        }
                      </span>
                    )}
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
                {item.type === "FOLLOW_UP" && (
                  <div className="oa-actions">
                    <button
                      className="oa-complete-btn"
                      disabled={followUpActionLoading === item.id}
                      onClick={() => openDisposition(item.id)}
                    >
                      Complete
                    </button>
                    <button
                      className="oa-edit-btn"
                      disabled={followUpActionLoading === item.id}
                      onClick={() => openFollowUpAction(item.id, "reschedule")}
                    >
                      Reschedule
                    </button>
                    <button
                      className="oa-cancel-btn"
                      disabled={followUpActionLoading === item.id}
                      onClick={() => openFollowUpAction(item.id, "cancel")}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {item.type === "FOLLOW_UP" &&
                  followUpActionId === item.id &&
                  followUpActionMode && (
                    <div className="fu-action-panel">
                      {followUpActionError && (
                        <div className="fu-action-error">{followUpActionError}</div>
                      )}
                      {followUpActionMode === "reschedule" && (
                        <>
                          <div className="fu-field-row">
                            <div className="fu-field">
                              <label className="fu-label">New due date *</label>
                              <input
                                type="date"
                                className="fu-input"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                              />
                            </div>
                            <div className="fu-field">
                              <label className="fu-label">Time (optional)</label>
                              <input
                                type="time"
                                className="fu-input"
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                              />
                            </div>
                          </div>
                          <label className="fu-label">Reason (optional)</label>
                          <input
                            type="text"
                            className="fu-input"
                            value={rescheduleReason}
                            onChange={(e) => setRescheduleReason(e.target.value)}
                            placeholder="Why is this being rescheduled?"
                          />
                          <div className="fu-action-buttons">
                            <button
                              className="fu-confirm-btn"
                              disabled={followUpActionLoading === item.id}
                              onClick={() => handleRescheduleFollowUp(item.id)}
                            >
                              {followUpActionLoading === item.id
                                ? "Rescheduling…"
                                : "Confirm Reschedule"}
                            </button>
                            <button className="fu-dismiss-btn" onClick={resetFollowUpAction}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                      {followUpActionMode === "cancel" && (
                        <>
                          <label className="fu-label">Reason (optional)</label>
                          <input
                            type="text"
                            className="fu-input"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Reason for cancellation"
                          />
                          <div className="fu-action-buttons">
                            <button
                              className="fu-danger-btn"
                              disabled={followUpActionLoading === item.id}
                              onClick={() => handleCancelFollowUp(item.id)}
                            >
                              {followUpActionLoading === item.id
                                ? "Cancelling…"
                                : "Confirm Cancel"}
                            </button>
                            <button className="fu-dismiss-btn" onClick={resetFollowUpAction}>
                              Keep Open
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                {item.type === "TASK" && (
                  <div className="oa-actions">
                    <button
                      className="oa-complete-btn"
                      disabled={completingTaskId === item.id || cancellingTaskId === item.id}
                      onClick={() => handleCompleteTask(item.id)}
                    >
                      {completingTaskId === item.id ? "Completing…" : "Complete"}
                    </button>
                    <button
                      className="oa-edit-btn"
                      disabled={completingTaskId === item.id || cancellingTaskId === item.id}
                      onClick={() => setEditingTask(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="oa-cancel-btn"
                      disabled={completingTaskId === item.id || cancellingTaskId === item.id}
                      onClick={() => handleCancelTask(item.id)}
                    >
                      {cancellingTaskId === item.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                )}
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
                  {item.type === "FOLLOW_UP" &&
                    item.metadata?.followUpType &&
                    FOLLOWUP_TYPE_BADGES[
                      item.metadata.followUpType as FollowUpType
                    ] && (
                      <span
                        className="tl-type-badge"
                        style={{
                          background:
                            FOLLOWUP_TYPE_BADGES[
                              item.metadata.followUpType as FollowUpType
                            ].bg,
                          color:
                            FOLLOWUP_TYPE_BADGES[
                              item.metadata.followUpType as FollowUpType
                            ].color,
                        }}
                      >
                        {
                          FOLLOWUP_TYPE_BADGES[
                            item.metadata.followUpType as FollowUpType
                          ].label
                        }
                      </span>
                    )}
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
          lifecycleStatus={lifecycleStatus}
          onCreated={handleActivityCreated}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {dispositionFollowUpId && (
        <FollowUpDispositionModal
          busy={dispositionBusy}
          error={dispositionError}
          onConfirm={handleConfirmDisposition}
          onClose={closeDisposition}
        />
      )}

      {editingTask && (
        <div className="edit-task-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setEditingTask(null); }}>
          <div className="edit-task-modal">
            <div className="edit-task-header">
              <h2>Edit Task</h2>
              <button className="edit-task-close" onClick={() => setEditingTask(null)} aria-label="Close">&times;</button>
            </div>
            <div className="edit-task-body">
              <TaskEditForm
                taskId={editingTask.id}
                initialTitle={editingTask.title ?? ""}
                initialDescription={editingTask.body ?? ""}
                initialDueDate={editingTask.dueAt ? editingTask.dueAt.slice(0, 10) : ""}
                onSaved={handleTaskEdited}
                onCancel={() => setEditingTask(null)}
              />
            </div>
          </div>
        </div>
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
        .oa-actions {
          margin-top: 6px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .fu-action-panel {
          margin-top: 8px;
          padding: 10px 12px;
          background: #f8f9fa;
          border: 1px solid #e3e8ee;
          border-radius: 6px;
        }
        .fu-action-error {
          margin-bottom: 6px;
          color: #c0392b;
          font-size: 12px;
        }
        .fu-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #5a6872;
          margin-bottom: 3px;
        }
        .fu-field-row {
          display: flex;
          gap: 10px;
          margin-bottom: 6px;
        }
        .fu-field {
          flex: 1;
        }
        .fu-input,
        .fu-textarea {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #d0d7de;
          border-radius: 4px;
          font-size: 13px;
          color: #2c3e50;
          box-sizing: border-box;
        }
        .fu-textarea {
          resize: vertical;
          font-family: inherit;
        }
        .fu-action-buttons {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .fu-confirm-btn {
          padding: 5px 14px;
          border: 1px solid #2e7d32;
          border-radius: 4px;
          background: #2e7d32;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .fu-confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .fu-danger-btn {
          padding: 5px 14px;
          border: 1px solid #c0392b;
          border-radius: 4px;
          background: #c0392b;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .fu-danger-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .fu-dismiss-btn {
          padding: 5px 14px;
          border: 1px solid #d0d7de;
          border-radius: 4px;
          background: #fff;
          color: #5a6872;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .oa-complete-btn {
          padding: 3px 12px;
          border: 1px solid #2e7d32;
          border-radius: 4px;
          background: #fff;
          color: #2e7d32;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .oa-complete-btn:hover:not(:disabled) {
          background: #2e7d32;
          color: #fff;
        }
        .oa-complete-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .oa-edit-btn {
          padding: 3px 12px;
          border: 1px solid #1976d2;
          border-radius: 4px;
          background: #fff;
          color: #1976d2;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .oa-edit-btn:hover:not(:disabled) {
          background: #1976d2;
          color: #fff;
        }
        .oa-edit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .oa-cancel-btn {
          padding: 3px 12px;
          border: 1px solid #8e99a4;
          border-radius: 4px;
          background: #fff;
          color: #8e99a4;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .oa-cancel-btn:hover:not(:disabled) {
          background: #8e99a4;
          color: #fff;
        }
        .oa-cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .edit-task-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }
        .edit-task-modal {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        }
        .edit-task-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid #e9ecef;
        }
        .edit-task-header h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          color: #2c3e50;
        }
        .edit-task-close {
          background: none;
          border: none;
          font-size: 22px;
          color: #8e99a4;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }
        .edit-task-close:hover {
          color: #2c3e50;
        }
        .edit-task-body {
          padding: 20px;
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
