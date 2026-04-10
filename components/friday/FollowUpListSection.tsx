'use client';

import { useState } from 'react';
import { fridayFetch } from './fridayFetch';
import {
  type FollowUp,
  INTENT_LABELS,
} from './types';
import * as S from './styles';
import { formatDueAt } from './displayHelpers';

interface Props {
  followUps: FollowUp[];
  title?: string;
  showActions?: boolean;
  onRefresh: () => void;
}

export default function FollowUpListSection({
  followUps,
  title = 'Follow-ups',
  showActions = true,
  onRefresh,
}: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  async function handleComplete(id: string) {
    setActionError(null);
    setActionLoading(id);
    const result = await fridayFetch(`/friday/follow-ups/${id}/complete`, { method: 'PATCH' });
    setActionLoading(null);
    if (result.ok) { onRefresh(); return; }
    setActionError(result.error);
  }

  async function handleReschedule(id: string) {
    setActionError(null);
    if (!rescheduleDate) { setActionError('New due date is required'); return; }
    const dueAt = rescheduleTime
      ? new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
      : new Date(`${rescheduleDate}T09:00:00`).toISOString();

    setActionLoading(id);
    const result = await fridayFetch(`/friday/follow-ups/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({
        newDueAt: dueAt,
        hasExplicitTime: !!rescheduleTime,
        reason: rescheduleReason || undefined,
      }),
    });
    setActionLoading(null);
    if (result.ok) {
      setRescheduleId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleReason('');
      onRefresh();
      return;
    }
    setActionError(result.error);
  }

  async function handleCancel(id: string) {
    setActionError(null);
    setActionLoading(id);
    const result = await fridayFetch(`/friday/follow-ups/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: cancelReason || 'Cancelled by user' }),
    });
    setActionLoading(null);
    if (result.ok) {
      setCancelId(null);
      setCancelReason('');
      onRefresh();
      return;
    }
    setActionError(result.error);
  }

  if (followUps.length === 0) {
    return (
      <div>
        <h3 style={S.sectionTitle}>{title}</h3>
        <p style={{ color: S.FC.textFaint, fontSize: '0.8125rem' }}>No follow-ups.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={S.sectionTitle}>{title} ({followUps.length})</h3>

      {actionError && <p style={{ ...S.errorText, marginBottom: 8 }}>{actionError}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={S.thStyle}>Status</th>
            <th style={S.thStyle}>Intent</th>
            <th style={S.thStyle}>Due</th>
            <th style={S.thStyle}>Contact</th>
            <th style={S.thStyle}>Context</th>
            {showActions && <th style={S.thStyle}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {followUps.map((fu) => (
            <tr key={fu.id}>
              <td style={S.tdStyle}>
                <span style={S.statusBadgeStyle(fu.status)}>
                  {fu.status}
                </span>
              </td>
              <td style={S.tdStyle}>{INTENT_LABELS[fu.intentType] ?? fu.intentType}</td>
              <td style={S.tdStyle}>
                <span style={{
                  color: fu.status === 'OPEN' && new Date(fu.dueAt) < new Date()
                    ? S.FC.accentRed
                    : S.FC.textSecondary,
                }}>
                  {formatDueAt(fu.dueAt, fu.hasExplicitTime)}
                </span>
                {!fu.hasExplicitTime && fu.status === 'OPEN' && (
                  <span style={{ display: 'block', fontSize: '0.625rem', color: S.FC.textFaint }}>
                    Any time that day
                  </span>
                )}
              </td>
              <td style={S.tdStyle}>
                {fu.contact?.name ?? <span style={{ color: S.FC.textFaint }}>Company-level</span>}
              </td>
              <td style={{ ...S.tdStyle, maxWidth: 200, whiteSpace: 'normal' }}>
                {fu.context || <span style={{ color: S.FC.textFaint }}>—</span>}
              </td>
              {showActions && (
                <td style={S.tdStyle}>
                  {fu.status === 'OPEN' && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleComplete(fu.id)}
                        disabled={actionLoading === fu.id}
                        style={{ ...S.btnSmall, color: S.FC.accentGreen, borderColor: 'rgba(34,197,94,0.3)' }}
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => {
                          setRescheduleId(rescheduleId === fu.id ? null : fu.id);
                          setCancelId(null);
                        }}
                        disabled={actionLoading === fu.id}
                        style={{ ...S.btnSmall, color: S.FC.accentBlue, borderColor: 'rgba(59,130,246,0.3)' }}
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => {
                          setCancelId(cancelId === fu.id ? null : fu.id);
                          setRescheduleId(null);
                        }}
                        disabled={actionLoading === fu.id}
                        style={{ ...S.btnSmall, color: S.FC.accentRed, borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {rescheduleId && (
        <div style={{ ...S.card, marginTop: 8 }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 8 }}>
            Reschedule Follow-up
          </h4>
          <div style={S.fieldRow}>
            <div>
              <label style={S.label}>New due date *</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Time (optional)</label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                style={S.input}
              />
            </div>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Reason</label>
            <input
              type="text"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="Why is this being rescheduled?"
              style={S.input}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleReschedule(rescheduleId)}
              disabled={actionLoading === rescheduleId}
              style={S.btnPrimary}
            >
              Confirm Reschedule
            </button>
            <button onClick={() => setRescheduleId(null)} style={S.btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {cancelId && (
        <div style={{ ...S.card, marginTop: 8 }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 8 }}>
            Cancel Follow-up
          </h4>
          <div style={S.fieldGroup}>
            <label style={S.label}>Reason</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation"
              style={S.input}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleCancel(cancelId)}
              disabled={actionLoading === cancelId}
              style={S.btnDanger}
            >
              Confirm Cancel
            </button>
            <button onClick={() => setCancelId(null)} style={S.btnSecondary}>
              Keep Open
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
