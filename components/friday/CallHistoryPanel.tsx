'use client';

import { useState, useEffect, useRef } from 'react';
import { fridayFetch } from './fridayFetch';
import * as S from './styles';
import type { CompanyCallHistoryResponse, CompanyCallHistoryEntry } from './types';
import type { CSSProperties } from 'react';

interface Props {
  customerId: string | null;
  companyName: string | null;
}

export default function CallHistoryPanel({ customerId, companyName }: Props) {
  const [history, setHistory] = useState<CompanyCallHistoryResponse['history']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!customerId) {
      setHistory([]);
      setFetched(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fridayFetch<CompanyCallHistoryResponse>(
      `/friday/call-session/history/${customerId}`,
    ).then((res) => {
      if (cancelled || !mountedRef.current) return;
      setLoading(false);
      setFetched(true);
      if (res.ok) {
        setHistory(res.data.history);
      } else {
        const raw = res.error ?? '';
        const isUnsafe = raw.startsWith('<') || raw.startsWith('<!') || raw.length > 200;
        setError(isUnsafe ? 'Unable to load call history.' : (raw || 'Unable to load call history.'));
      }
    });

    return () => { cancelled = true; };
  }, [customerId]);

  return (
    <div style={panelWrap}>
      <div style={headerBar}>
        <div style={headerTitle}>Call Intelligence</div>
        {companyName && (
          <div style={companyBadge}>{companyName}</div>
        )}
      </div>

      <div style={panelCard}>
        {!customerId && (
          <div style={emptyState}>
            <div style={emptyIcon}>📋</div>
            <div style={emptyMessage}>
              Call history will appear when a company is loaded
            </div>
          </div>
        )}

        {customerId && loading && (
          <div style={emptyState}>
            <div style={emptyMessage}>Loading...</div>
          </div>
        )}

        {customerId && !loading && error && (
          <div style={errorState}>
            {error}
          </div>
        )}

        {customerId && !loading && !error && fetched && history.length === 0 && (
          <IntelligenceBlock history={[]} />
        )}

        {customerId && !loading && !error && history.length > 0 && (
          <>
            <IntelligenceBlock history={history} />
            <div style={divider} />
            <div style={historyList}>
              {history.map((entry) => (
                <div key={entry.id} style={historyRow}>
                  <div style={historyDate}>
                    {new Date(entry.startedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div style={historyDetail}>
                    <span style={repNameStyle}>{entry.repName}</span>
                    {entry.outcome && (
                      <span style={outcomeBadge(entry.outcome)}>
                        {entry.outcome.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Intelligence Block ─────────────────────────────────────────────

function IntelligenceBlock({ history }: { history: CompanyCallHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div style={intelWrap}>
        <div style={intelSection}>
          <div style={intelLabel}>Status</div>
          <div style={intelValue}>First touch</div>
        </div>
        <div style={intelSection}>
          <div style={intelLabel}>Insight</div>
          <div style={intelDetail}>No prior calls logged for this company</div>
          <div style={intelDetail}>Ready for first outreach</div>
        </div>
      </div>
    );
  }

  const attemptCount = history.length;
  const latest = history[0];
  const lastContactText = relativeTime(latest.startedAt);

  const voicemailCount = history.filter(
    (e) => e.outcome === 'LEFT_VOICEMAIL',
  ).length;
  const spokeCount = history.filter(
    (e) => e.outcome && e.outcome.startsWith('SPOKE'),
  ).length;

  let insight: string;
  if (spokeCount > 0) {
    insight = 'Contact established';
  } else if (voicemailCount > 0) {
    insight = 'Voicemail contact established';
  } else {
    insight = 'Decision maker not reached';
  }

  return (
    <div style={intelWrap}>
      <div style={intelSection}>
        <div style={intelLabel}>Status</div>
        <div style={intelValue}>
          {attemptCount} attempt{attemptCount !== 1 ? 's' : ''}
        </div>
        <div style={intelDetail}>Last contact: {lastContactText}</div>
      </div>
      <div style={intelSection}>
        <div style={intelLabel}>Insight</div>
        <div style={intelValue}>{insight}</div>
      </div>
    </div>
  );
}

// ─── Relative Time Helper ───────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const then = new Date(isoDate);
  const now = new Date();
  const msPerDay = 86400000;

  const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.round((nowDay.getTime() - thenDay.getTime()) / msPerDay);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// ─── Styles ─────────────────────────────────────────────────────────

const panelWrap: CSSProperties = {};

const headerBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

const headerTitle: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
  color: S.FC.textPrimary,
};

const companyBadge: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 4,
  color: S.FC.accentPurple,
  background: 'rgba(139, 92, 246, 0.12)',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const panelCard: CSSProperties = {
  background: S.FC.surface,
  border: `1px solid ${S.FC.border}`,
  borderRadius: 12,
  padding: 20,
  minHeight: 200,
};

const emptyState: CSSProperties = {
  textAlign: 'center',
  padding: '32px 16px',
};

const emptyIcon: CSSProperties = {
  fontSize: 28,
  marginBottom: 12,
};

const emptyMessage: CSSProperties = {
  fontSize: '0.8125rem',
  color: S.FC.textMuted,
  lineHeight: 1.5,
};

const errorState: CSSProperties = {
  background: S.FC.accentRedDim,
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: '0.8125rem',
  color: S.FC.accentRed,
};

const divider: CSSProperties = {
  height: 1,
  background: S.FC.border,
  margin: '16px 0',
};

const intelWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const intelSection: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const intelLabel: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 700,
  color: S.FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const intelValue: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: S.FC.textPrimary,
};

const intelDetail: CSSProperties = {
  fontSize: '0.75rem',
  color: S.FC.textSecondary,
  lineHeight: 1.4,
};

const historyList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
};

const historyRow: CSSProperties = {
  padding: '10px 0',
  borderBottom: `1px solid ${S.FC.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const historyDate: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: S.FC.textMuted,
};

const historyDetail: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const repNameStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: S.FC.textSecondary,
};

function outcomeBadge(outcome: string): CSSProperties {
  const colorMap: Record<string, string> = {
    OPPORTUNITY_IDENTIFIED: S.FC.accentGreen,
    FOLLOW_UP_REQUIRED: S.FC.accentAmber,
    NO_ANSWER: S.FC.textMuted,
    LEFT_VOICEMAIL: S.FC.accentBlue,
    SPOKE_NO_OPPORTUNITY: S.FC.textFaint,
    CLOSED_NO_INTEREST: S.FC.accentRed,
  };
  const color = colorMap[outcome] ?? S.FC.textMuted;
  return {
    fontSize: '0.625rem',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 3,
    color,
    background: `${color}22`,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };
}
