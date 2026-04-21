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

export default function KPIPage() {
  const [items, setItems] = useState<TodaysWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    load();
  }, [load]);

  const handleStartCall = (customerId: string) => {
    router.push(`/friday?directTarget=${customerId}`);
  };

  const grouped = groupByWorkType(items);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Today&apos;s Work</h1>
        <span style={styles.count}>
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {loading && <p style={styles.message}>Loading...</p>}
      {error && <p style={{ ...styles.message, color: FC.accentRed }}>{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No work items right now</p>
          <p style={styles.emptyDesc}>
            All owned accounts are either future-scheduled or completed for
            today.
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
                  <div style={styles.cardBottom}>
                    <span style={styles.bucketLabel}>
                      {BUCKET_LABELS[item.bucket] ?? item.bucket}
                    </span>
                    <span style={styles.reason}>{item.bucketReason}</span>
                    <button
                      style={styles.callBtn}
                      onClick={() => handleStartCall(item.customerId)}
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
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: "32px 40px",
    maxWidth: 860,
    margin: "0 auto",
  },
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
};
