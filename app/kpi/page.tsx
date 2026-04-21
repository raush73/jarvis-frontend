"use client";

import { useEffect, useState, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { fridayFetch } from "../../components/friday/fridayFetch";
import {
  TodaysWorkItem,
  TodaysWorkResult,
  WORK_TYPE_LABELS,
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

const PRIORITY_ORDER: TodaysWorkItem["workType"][] = [
  "SCHEDULED_CALL",
  "FOLLOW_UP_OVERDUE",
  "FOLLOW_UP_DUE",
  "SYSTEM_TOUCH",
];

function groupByWorkType(items: TodaysWorkItem[]) {
  const groups = new Map<TodaysWorkItem["workType"], TodaysWorkItem[]>();
  for (const wt of PRIORITY_ORDER) groups.set(wt, []);
  for (const item of items) {
    const list = groups.get(item.workType);
    if (list) list.push(item);
  }
  return groups;
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

export default function KPIPage() {
  const [items, setItems] = useState<TodaysWorkItem[]>([]);
  const [healthItems, setHealthItems] = useState<CustomerHealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const router = useRouter();

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

  useEffect(() => {
    load();
    loadHealth();
  }, [load, loadHealth]);

  const handleStartCall = (customerId: string) => {
    router.push(`/friday?directTarget=${customerId}`);
  };

  const grouped = groupByWorkType(items);
  const healthGrouped = groupByHealthState(healthItems);

  return (
    <div className="kpi-page">
      <div className="kpi-columns">
        {/* ──────────── Today's Work ──────────── */}
        <div className="kpi-panel">
          <div style={styles.header}>
            <h1 style={styles.title}>Today&apos;s Work</h1>
            <span style={styles.count}>
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="kpi-scroll">
            {loading && <p style={styles.message}>Loading...</p>}
            {error && (
              <p style={{ ...styles.message, color: FC.accentRed }}>{error}</p>
            )}

            {!loading && !error && items.length === 0 && (
              <div style={styles.empty}>
                <p style={styles.emptyTitle}>No work items right now</p>
                <p style={styles.emptyDesc}>
                  All owned accounts are either future-scheduled or completed
                  for today.
                </p>
              </div>
            )}

            {!loading &&
              PRIORITY_ORDER.map((wt) => {
                const group = grouped.get(wt) ?? [];
                if (group.length === 0) return null;
                return (
                  <div key={wt} style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span
                        style={{
                          ...styles.sectionDot,
                          background: WORK_TYPE_COLORS[wt],
                        }}
                      />
                      <span style={styles.sectionLabel}>
                        {WORK_TYPE_LABELS[wt]}
                      </span>
                      <span style={styles.sectionCount}>{group.length}</span>
                    </div>
                    {group.map((item) => (
                      <div key={item.customerId} style={styles.card}>
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
                    ))}
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
                    {group.map((item) => (
                      <div key={item.customerId} style={styles.healthCard}>
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
                    ))}
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
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: FC.textPrimary,
    margin: 0,
    letterSpacing: "-0.3px",
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
};
