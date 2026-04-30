'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { FC } from '../friday/styles';
import { apiFetch } from '@/lib/api';
import type {
  ActivityType,
  TimelineEntry,
  OpenActivityEntry,
  TimelineResponse,
  OpenActivitiesResponse,
} from '../activity/types';
import {
  ACTIVITY_FILTER_TABS,
  ACTIVITY_TYPE_BADGES,
  formatActivityDateTime,
  formatActivityDueDate,
} from '../activity/types';

const PAGE_SIZE = 30;

interface CompanyActivityPanelProps {
  customerId: string;
}

const TYPE_DARK_BADGES: Record<ActivityType, { label: string; color: string; bg: string }> = {
  NOTE: { label: 'Note', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)' },
  FOLLOW_UP: { label: 'Follow-Up', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  TASK: { label: 'Task', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
};

export default function CompanyActivityPanel({ customerId }: CompanyActivityPanelProps) {
  const [openItems, setOpenItems] = useState<OpenActivityEntry[]>([]);
  const [openLoading, setOpenLoading] = useState(true);

  const [timelineItems, setTimelineItems] = useState<TimelineEntry[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState('');

  const [activeFilter, setActiveFilter] = useState<ActivityType | 'ALL'>('ALL');

  const loadOpen = useCallback(async () => {
    setOpenLoading(true);
    try {
      const data = await apiFetch<OpenActivitiesResponse>(
        `/activity/company/${customerId}/open-activities`,
      );
      setOpenItems(data.items ?? []);
    } catch {
      setOpenItems([]);
    } finally {
      setOpenLoading(false);
    }
  }, [customerId]);

  const loadTimeline = useCallback(
    async (offset = 0, append = false) => {
      setTimelineLoading(true);
      setTimelineError('');
      try {
        const typesParam = activeFilter !== 'ALL' ? `&types=${activeFilter}` : '';
        const data = await apiFetch<TimelineResponse>(
          `/activity/company/${customerId}/timeline?limit=${PAGE_SIZE}&offset=${offset}${typesParam}`,
        );
        if (append) {
          setTimelineItems((prev) => [...prev, ...(data.items ?? [])]);
        } else {
          setTimelineItems(data.items ?? []);
        }
        setTimelineTotal(data.total ?? 0);
        setTimelineOffset(offset + (data.items?.length ?? 0));
      } catch (e: unknown) {
        setTimelineError(e instanceof Error ? e.message : 'Failed to load timeline.');
      } finally {
        setTimelineLoading(false);
      }
    },
    [customerId, activeFilter],
  );

  useEffect(() => { loadOpen(); }, [loadOpen]);
  useEffect(() => {
    setTimelineOffset(0);
    setTimelineItems([]);
    loadTimeline(0, false);
  }, [loadTimeline]);

  const hasMore = timelineOffset < timelineTotal;

  return (
    <div>
      {/* Open Activities — context awareness */}
      {!openLoading && openItems.length > 0 && (
        <div style={sectionWrap}>
          <div style={sectionHeader}>Open Activities</div>
          {openItems.map((item) => (
            <div key={`${item.type}:${item.id}`} style={openCard(item.isOverdue)}>
              <div style={openTopRow}>
                <span style={typeBadge(item.type)}>{badgeLabel(item.type)}</span>
                {item.isOverdue && <span style={overdueBadge}>Overdue</span>}
                {item.dueAt && <span style={dueText}>{formatActivityDueDate(item.dueAt)}</span>}
                <span style={userText}>{item.userName}</span>
              </div>
              <div style={itemTitle}>{item.title}</div>
              {item.body && <div style={itemBody}>{item.body}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Timeline filters */}
      <div style={sectionWrap}>
        <div style={timelineHeaderRow}>
          <div style={sectionHeader}>Activity Timeline</div>
          <div style={filterRow}>
            {ACTIVITY_FILTER_TABS.map((f) => (
              <button
                key={f.value}
                style={activeFilter === f.value ? filterBtnActive : filterBtn}
                onClick={() => setActiveFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {timelineLoading && timelineItems.length === 0 && (
          <div style={emptyText}>Loading activity timeline...</div>
        )}
        {timelineError && (
          <div style={errorText}>{timelineError}</div>
        )}
        {!timelineLoading && !timelineError && timelineItems.length === 0 && (
          <div style={emptyText}>No activity history for this account.</div>
        )}

        {timelineItems.map((item) => (
          <div key={`${item.type}:${item.id}`} style={tlCard}>
            <div style={tlTopRow}>
              <span style={tlTimestamp}>{formatActivityDateTime(item.timestamp)}</span>
              <span style={typeBadge(item.type)}>{badgeLabel(item.type)}</span>
              {item.status && <span style={tlStatus}>{item.status}</span>}
              <span style={userText}>{item.userName}</span>
            </div>
            <div style={itemTitle}>{item.title}</div>
            {item.body && <div style={itemBody}>{item.body}</div>}
          </div>
        ))}

        {hasMore && (
          <div style={loadMoreWrap}>
            <button
              style={loadMoreBtn}
              onClick={() => loadTimeline(timelineOffset, true)}
              disabled={timelineLoading}
            >
              {timelineLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function badgeLabel(type: ActivityType): string {
  return TYPE_DARK_BADGES[type]?.label ?? type;
}

function typeBadge(type: ActivityType): CSSProperties {
  const b = TYPE_DARK_BADGES[type] ?? { color: FC.textMuted, bg: FC.surface };
  return {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    color: b.color,
    background: b.bg,
    flexShrink: 0,
  };
}

// ─── Styles ──────────────────────────────────────────────────────────

const sectionWrap: CSSProperties = {
  marginBottom: 20,
};

const sectionHeader: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  color: FC.textPrimary,
  marginBottom: 10,
};

const timelineHeaderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 10,
};

const filterRow: CSSProperties = {
  display: 'flex',
  gap: 4,
};

const filterBtn: CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  border: `1px solid ${FC.border}`,
  borderRadius: 4,
  background: 'transparent',
  color: FC.textMuted,
  cursor: 'pointer',
};

const filterBtnActive: CSSProperties = {
  ...filterBtn,
  background: FC.accentPurple,
  borderColor: FC.accentPurple,
  color: '#fff',
};

function openCard(isOverdue: boolean): CSSProperties {
  return {
    background: FC.surface,
    border: `1px solid ${FC.border}`,
    borderLeft: isOverdue ? `3px solid ${FC.accentRed}` : `1px solid ${FC.border}`,
    borderRadius: 6,
    padding: '10px 14px',
    marginBottom: 6,
  };
}

const openTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 4,
  fontSize: '0.75rem',
};

const overdueBadge: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 700,
  padding: '2px 7px',
  borderRadius: 4,
  color: FC.accentRed,
  background: FC.accentRedDim,
};

const dueText: CSSProperties = {
  fontSize: '0.75rem',
  color: FC.textMuted,
};

const userText: CSSProperties = {
  fontSize: '0.75rem',
  color: FC.textFaint,
  marginLeft: 'auto',
};

const itemTitle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: FC.textPrimary,
};

const itemBody: CSSProperties = {
  marginTop: 4,
  fontSize: '0.75rem',
  color: FC.textSecondary,
  lineHeight: 1.5,
  background: 'rgba(255, 255, 255, 0.02)',
  padding: '6px 10px',
  borderRadius: 4,
  borderLeft: `3px solid ${FC.border}`,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const tlCard: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 6,
};

const tlTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 4,
  fontSize: '0.75rem',
};

const tlTimestamp: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.textSecondary,
};

const tlStatus: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 3,
  color: FC.textMuted,
  background: 'rgba(255, 255, 255, 0.06)',
};

const emptyText: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.textFaint,
  textAlign: 'center',
  padding: '24px 0',
};

const errorText: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.accentRed,
  textAlign: 'center',
  padding: '16px 0',
};

const loadMoreWrap: CSSProperties = {
  textAlign: 'center',
  paddingTop: 12,
};

const loadMoreBtn: CSSProperties = {
  padding: '6px 20px',
  fontSize: '0.75rem',
  fontWeight: 600,
  border: `1px solid ${FC.border}`,
  borderRadius: 4,
  background: 'transparent',
  color: FC.accentPurple,
  cursor: 'pointer',
};
