"use client";

import { useEffect, useState, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../../lib/auth/useSession";
import { fridayFetch } from "../../components/friday/fridayFetch";
import {
  TodaysWorkItem,
  TodaysWorkResult,
  WORK_TYPE_COLORS,
  LIFECYCLE_SHORT,
  BUCKET_LABELS,
  CustomerHealthItem,
  CustomerHealthResult,
  CustomerHealthState,
  HEALTH_STATE_LABELS,
  HEALTH_STATE_COLORS,
} from "../../components/friday/types";
import { FC } from "../../components/friday/styles";

interface BadgeCounts {
  followUps: { overdue: number; dueToday: number };
  tasks: { overdue: number; dueToday: number };
}

type WorkSection = {
  key: string;
  label: string;
  color: string;
  types: TodaysWorkItem["workType"][];
};

const WORK_SECTIONS: WorkSection[] = [
  { key: "todays-followups", label: "Today\u2019s Follow-Ups", color: "#3b82f6", types: ["SCHEDULED_CALL", "FOLLOW_UP_DUE"] },
  { key: "overdue-followups", label: "Overdue Follow-Ups", color: "#ef4444", types: ["FOLLOW_UP_OVERDUE"] },
  { key: "notifications", label: "Operational Notifications", color: "#8b5cf6", types: ["SYSTEM_TOUCH"] },
];

function groupBySection(items: TodaysWorkItem[]) {
  const groups = new Map<string, TodaysWorkItem[]>();
  for (const s of WORK_SECTIONS) groups.set(s.key, []);
  for (const item of items) {
    for (const s of WORK_SECTIONS) {
      if (s.types.includes(item.workType)) {
        groups.get(s.key)!.push(item);
        break;
      }
    }
  }
  return groups;
}

function resolveWorkspaceLabel(scope: string): string {
  if (scope === "COMPANY" || scope === "TEAM") return "KPI";
  return "My Work";
}

const HEALTH_ORDER: CustomerHealthState[] = ["CRITICAL", "STALE", "AT_RISK"];

function groupByHealthState(items: CustomerHealthItem[]) {
  const groups = new Map<CustomerHealthState, CustomerHealthItem[]>();
  for (const hs of HEALTH_ORDER) groups.set(hs, []);
  for (const item of items) {
    const list = groups.get(item.healthState);
    if (list) list.push(item);
  }
  return groups;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function sortWorkItems(items: TodaysWorkItem[]): TodaysWorkItem[] {
  return [...items].sort((a, b) => {
    const touchA = daysUntil(a.touchDeadlineAt);
    const touchB = daysUntil(b.touchDeadlineAt);
    const aOverdue = touchA !== null && touchA < 0;
    const bOverdue = touchB !== null && touchB < 0;

    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (aOverdue && bOverdue) return touchA! - touchB!;

    const aHasUrgency = a.touchDeadlineAt || a.controlDeadlineAt;
    const bHasUrgency = b.touchDeadlineAt || b.controlDeadlineAt;
    if (aHasUrgency && !bHasUrgency) return -1;
    if (!aHasUrgency && bHasUrgency) return 1;
    if (aHasUrgency && bHasUrgency) {
      const nearestA = Math.min(
        touchA ?? Infinity,
        daysUntil(a.controlDeadlineAt) ?? Infinity
      );
      const nearestB = Math.min(
        touchB ?? Infinity,
        daysUntil(b.controlDeadlineAt) ?? Infinity
      );
      if (nearestA !== nearestB) return nearestA - nearestB;
    }

    if (a.hasExplicitTime !== b.hasExplicitTime)
      return a.hasExplicitTime ? -1 : 1;
    if (a.hasExplicitTime && b.hasExplicitTime && a.followUpDueAt && b.followUpDueAt)
      return new Date(a.followUpDueAt).getTime() - new Date(b.followUpDueAt).getTime();

    if (a.followUpDueAt && b.followUpDueAt)
      return new Date(a.followUpDueAt).getTime() - new Date(b.followUpDueAt).getTime();
    if (a.followUpDueAt && !b.followUpDueAt) return -1;
    if (!a.followUpDueAt && b.followUpDueAt) return 1;

    return a.customerName.localeCompare(b.customerName);
  });
}

function sortHealthItems(items: CustomerHealthItem[]): CustomerHealthItem[] {
  return [...items].sort((a, b) => {
    const aDays = a.businessDaysSince ?? Infinity;
    const bDays = b.businessDaysSince ?? Infinity;
    if (aDays !== bDays) {
      if (aDays === Infinity && bDays !== Infinity) return -1;
      if (bDays === Infinity && aDays !== Infinity) return 1;
      return bDays - aDays;
    }
    return a.customerName.localeCompare(b.customerName);
  });
}

export default function KPIPage() {
  const session = useSession();
  const [items, setItems] = useState<TodaysWorkItem[]>([]);
  const [healthItems, setHealthItems] = useState<CustomerHealthItem[]>([]);
  const [badges, setBadges] = useState<BadgeCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const router = useRouter();

  const workspaceLabel = resolveWorkspaceLabel(session.getScope("customers"));

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fridayFetch<TodaysWorkResult>(
      "/friday/intelligence/todays-work"
    );
    if (res.ok) {
      setItems(res.data.items);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    const res = await fridayFetch<CustomerHealthResult>(
      "/friday/intelligence/customer-health"
    );
    if (res.ok) {
      setHealthItems(res.data.items);
      setHealthError(null);
    } else {
      setHealthError(res.error);
    }
    setHealthLoading(false);
  }, []);

  const loadBadges = useCallback(async () => {
    setBadgesLoading(true);
    const res = await fridayFetch<BadgeCounts>("/activity/badges");
    if (res.ok) {
      setBadges(res.data);
    }
    setBadgesLoading(false);
  }, []);

  useEffect(() => {
    if (!session.ready) return;
    load();
    loadHealth();
    loadBadges();
  }, [load, loadHealth, loadBadges, session.ready]);

  const handleStartCall = (customerId: string) => {
    router.push(`/friday?directTarget=${customerId}`);
  };

  const sectionGrouped = groupBySection(items);
  for (const [key, list] of sectionGrouped) sectionGrouped.set(key, sortWorkItems(list));

  const healthGrouped = groupByHealthState(healthItems);
  for (const [key, list] of healthGrouped) healthGrouped.set(key, sortHealthItems(list));

  const totalFollowUps = (sectionGrouped.get("todays-followups")?.length ?? 0) +
    (sectionGrouped.get("overdue-followups")?.length ?? 0);
  const totalNotifications = sectionGrouped.get("notifications")?.length ?? 0;
  const totalWorkItems = totalFollowUps + totalNotifications;

  let workItemIndex = 0;
  let healthItemIndex = 0;

  return (
    <div className="kpi-page">
      {/* ──────────── Role-Based Workspace Header ──────────── */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>{workspaceLabel}</h1>
        {session.ready && session.fullName && (
          <span style={styles.userName}>{session.fullName}</span>
        )}
      </div>

      {/* ──────────── Task Pressure Panel ──────────── */}
      <div style={styles.taskPanel}>
        {badgesLoading && <span style={styles.taskPanelLoading}>Loading task status...</span>}
        {!badgesLoading && badges && (
          <>
            <div style={styles.taskPanelSection}>
              <span style={styles.taskPanelLabel}>Follow-Ups</span>
              <div style={styles.taskPanelCounts}>
                {badges.followUps.overdue > 0 && (
                  <span style={styles.badgeRed}>
                    {badges.followUps.overdue} overdue
                  </span>
                )}
                {badges.followUps.dueToday > 0 && (
                  <span style={styles.badgeBlue}>
                    {badges.followUps.dueToday} due today
                  </span>
                )}
                {badges.followUps.overdue === 0 && badges.followUps.dueToday === 0 && (
                  <span style={styles.badgeNeutral}>All clear</span>
                )}
              </div>
            </div>
            <div style={styles.taskPanelDivider} />
            <div style={styles.taskPanelSection}>
              <span style={styles.taskPanelLabel}>Tasks</span>
              <div style={styles.taskPanelCounts}>
                {badges.tasks.overdue > 0 && (
                  <span style={styles.badgeAmber}>
                    {badges.tasks.overdue} overdue
                  </span>
                )}
                {badges.tasks.dueToday > 0 && (
                  <span style={styles.badgeBlue}>
                    {badges.tasks.dueToday} due today
                  </span>
                )}
                {badges.tasks.overdue === 0 && badges.tasks.dueToday === 0 && (
                  <span style={styles.badgeNeutral}>All clear</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="kpi-columns">
        {/* ──────────── Structured Work Sections ──────────── */}
        <div className="kpi-panel">
          <div style={styles.header}>
            <h2 style={styles.title}>Today&apos;s Work</h2>
            <span style={styles.count}>
              {totalWorkItems} {totalWorkItems === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="kpi-scroll">
            {loading && <p style={styles.message}>Loading...</p>}
            {error && (
              <p style={{ ...styles.message, color: FC.accentRed }}>{error}</p>
            )}

            {!loading && !error && totalWorkItems === 0 && (
              <div style={styles.empty}>
                <p style={styles.emptyTitle}>No work items right now</p>
                <p style={styles.emptyDesc}>
                  All owned accounts are either future-scheduled or completed
                  for today.
                </p>
              </div>
            )}

            {!loading &&
              WORK_SECTIONS.map((section) => {
                const group = sectionGrouped.get(section.key) ?? [];
                if (group.length === 0) return null;
                return (
                  <div key={section.key} style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span
                        style={{
                          ...styles.sectionDot,
                          background: section.color,
                        }}
                      />
                      <span style={styles.sectionLabel}>
                        {section.label}
                      </span>
                      <span style={styles.sectionCount}>{group.length}</span>
                    </div>
                    {group.map((item) => {
                      const isFirst = workItemIndex === 0;
                      workItemIndex++;
                      return (
                      <div
                        key={item.customerId}
                        style={isFirst ? { ...styles.card, ...styles.topItemCard } : styles.card}
                      >
                        <div style={styles.cardTop}>
                          <span style={styles.lifecycleBadge}>
                            {LIFECYCLE_SHORT[item.lifecycleStatus] ?? "?"}
                          </span>
                          <span style={styles.companyName}>
                            {item.customerName}
                          </span>
                          {item.hasExplicitTime && item.followUpDueAt && (
                            <span style={styles.timeBadge}>
                              {formatTime(item.followUpDueAt)}
                            </span>
                          )}
                          {!item.hasExplicitTime && item.followUpDueAt && (
                            <span style={styles.dateBadge}>
                              {formatDate(item.followUpDueAt)}
                            </span>
                          )}
                        </div>
                        {item.lifecycleStatus === "PROSPECT" &&
                          (item.touchDeadlineAt ||
                            item.controlDeadlineAt) && (
                            <div style={styles.urgencyRow}>
                              {item.touchDeadlineAt &&
                                (() => {
                                  const days = daysUntil(
                                    item.touchDeadlineAt
                                  );
                                  const overdue =
                                    days !== null && days < 0;
                                  return (
                                    <span
                                      style={{
                                        ...styles.urgencyTag,
                                        color: overdue
                                          ? FC.accentRed
                                          : FC.accentAmber,
                                        background: overdue
                                          ? "rgba(239, 68, 68, 0.12)"
                                          : FC.accentAmberDim,
                                      }}
                                    >
                                      {overdue
                                        ? `Touch overdue by ${Math.abs(days!)} days`
                                        : `Touch due in ${days} days`}
                                    </span>
                                  );
                                })()}
                              {item.controlDeadlineAt &&
                                (() => {
                                  const days = daysUntil(
                                    item.controlDeadlineAt
                                  );
                                  return (
                                    <span style={styles.urgencyTag}>
                                      {days !== null && days < 0
                                        ? `Control expired`
                                        : `Control expires in ${days} days`}
                                    </span>
                                  );
                                })()}
                            </div>
                          )}
                        <div style={styles.cardBottom}>
                          <span style={styles.bucketLabel}>
                            {BUCKET_LABELS[item.bucket] ?? item.bucket}
                          </span>
                          <span style={styles.reason}>
                            {item.bucketReason}
                          </span>
                          <button
                            style={styles.callBtn}
                            onClick={() =>
                              handleStartCall(item.customerId)
                            }
                          >
                            Start Call
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </div>

        {/* ──────────── Customer Health ──────────── */}
        <div className="kpi-panel">
          <div style={styles.header}>
            <h2 style={styles.healthTitle}>Customer Health</h2>
            <span style={styles.count}>
              {healthItems.length}{" "}
              {healthItems.length === 1 ? "account" : "accounts"}
            </span>
          </div>
          <div className="kpi-scroll">
            {healthLoading && (
              <p style={styles.message}>Loading health data...</p>
            )}
            {healthError && (
              <p style={{ ...styles.message, color: FC.accentRed }}>
                {healthError}
              </p>
            )}

            {!healthLoading && !healthError && healthItems.length === 0 && (
              <div style={styles.empty}>
                <p style={styles.emptyTitle}>All customers are healthy</p>
                <p style={styles.emptyDesc}>
                  No owned customers require attention right now.
                </p>
              </div>
            )}

            {!healthLoading &&
              HEALTH_ORDER.map((hs) => {
                const group = healthGrouped.get(hs) ?? [];
                if (group.length === 0) return null;
                return (
                  <div key={hs} style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span
                        style={{
                          ...styles.sectionDot,
                          background: HEALTH_STATE_COLORS[hs],
                        }}
                      />
                      <span style={styles.sectionLabel}>
                        {HEALTH_STATE_LABELS[hs]}
                      </span>
                      <span style={styles.sectionCount}>{group.length}</span>
                    </div>
                    {group.map((item) => {
                      const isFirst = healthItemIndex === 0;
                      healthItemIndex++;
                      return (
                      <div
                        key={item.customerId}
                        style={isFirst ? { ...styles.healthCard, ...styles.topItemCard } : styles.healthCard}
                      >
                        <span style={styles.companyName}>
                          {item.customerName}
                        </span>
                        <span
                          style={{
                            ...styles.healthBadge,
                            color: HEALTH_STATE_COLORS[item.healthState],
                            background: `${HEALTH_STATE_COLORS[item.healthState]}18`,
                          }}
                        >
                          {item.displayText}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpi-page {
          padding: 32px 40px;
          max-width: 1280px;
          margin: 0 auto;
        }

        .kpi-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          align-items: start;
        }

        .kpi-panel {
          min-width: 0;
        }

        .kpi-scroll {
          max-height: calc(100vh - 180px);
          overflow-y: auto;
          padding-right: 4px;
        }

        .kpi-scroll::-webkit-scrollbar {
          width: 5px;
        }

        .kpi-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .kpi-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .kpi-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 900px) {
          .kpi-page {
            padding: 24px 16px;
          }

          .kpi-columns {
            grid-template-columns: 1fr;
          }

          .kpi-scroll {
            max-height: none;
            overflow-y: visible;
            padding-right: 0;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 16,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: FC.textPrimary,
    margin: 0,
    letterSpacing: "-0.4px",
  },
  userName: {
    fontSize: 14,
    color: FC.textMuted,
    fontWeight: 400,
  },
  taskPanel: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    background: FC.surface,
    border: `1px solid ${FC.border}`,
    borderRadius: 10,
    padding: "12px 20px",
    marginBottom: 24,
    minHeight: 48,
  },
  taskPanelLoading: {
    fontSize: 13,
    color: FC.textMuted,
  },
  taskPanelSection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  taskPanelLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: FC.textSecondary,
    minWidth: 80,
  },
  taskPanelCounts: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  taskPanelDivider: {
    width: 1,
    height: 28,
    background: FC.border,
    margin: "0 20px",
    flexShrink: 0,
  },
  badgeRed: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 4,
    background: "rgba(239, 68, 68, 0.12)",
    color: "#ef4444",
  },
  badgeAmber: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 4,
    background: "rgba(245, 158, 11, 0.12)",
    color: "#f59e0b",
  },
  badgeBlue: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 4,
    background: "rgba(59, 130, 246, 0.12)",
    color: "#3b82f6",
  },
  badgeNeutral: {
    fontSize: 12,
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: 4,
    background: "rgba(255, 255, 255, 0.06)",
    color: FC.textMuted,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: FC.textPrimary,
    margin: 0,
    letterSpacing: "-0.2px",
  },
  count: {
    fontSize: 14,
    color: FC.textMuted,
  },
  message: {
    fontSize: 14,
    color: FC.textSecondary,
  },
  empty: {
    background: FC.surface,
    border: `1px solid ${FC.border}`,
    borderRadius: 12,
    padding: "48px 32px",
    textAlign: "center" as const,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: FC.textSecondary,
    margin: "0 0 8px",
  },
  emptyDesc: {
    fontSize: 13,
    color: FC.textMuted,
    margin: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: FC.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  sectionCount: {
    fontSize: 12,
    color: FC.textMuted,
    marginLeft: 4,
  },
  card: {
    background: FC.surface,
    border: `1px solid ${FC.border}`,
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 6,
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  lifecycleBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    background: "rgba(59, 130, 246, 0.12)",
    color: FC.accentBlue,
    flexShrink: 0,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 600,
    color: FC.textPrimary,
    flex: 1,
  },
  timeBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: FC.accentAmber,
    background: FC.accentAmberDim,
    padding: "2px 8px",
    borderRadius: 4,
  },
  dateBadge: {
    fontSize: 12,
    color: FC.textMuted,
  },
  cardBottom: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingLeft: 32,
  },
  bucketLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: FC.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },
  reason: {
    fontSize: 12,
    color: FC.textFaint,
    flex: 1,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
  callBtn: {
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    borderRadius: 5,
    background: FC.accentBlue,
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  urgencyRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingLeft: 32,
    marginBottom: 6,
  },
  urgencyTag: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    color: FC.textSecondary,
    background: "rgba(255, 255, 255, 0.06)",
  },
  healthTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: FC.textPrimary,
    margin: 0,
    letterSpacing: "-0.2px",
  },
  healthCard: {
    background: FC.surface,
    border: `1px solid ${FC.border}`,
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  healthBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: 4,
    flexShrink: 0,
    marginLeft: "auto",
  },
  topItemCard: {
    borderColor: "rgba(59, 130, 246, 0.45)",
    boxShadow: "0 0 8px rgba(59, 130, 246, 0.15)",
  },
};
