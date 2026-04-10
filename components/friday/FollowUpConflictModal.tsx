'use client';

import { useState } from 'react';
import { fridayFetch } from './fridayFetch';
import {
  type FollowUp,
  type ConflictResolution,
  INTENT_LABELS,
  STATUS_LABELS,
} from './types';
import * as S from './styles';
import { formatDueAt } from './displayHelpers';

interface Props {
  existingFollowUp: FollowUp;
  message: string;
  onResolved: () => void;
  onClose: () => void;
}

export default function FollowUpConflictModal({
  existingFollowUp,
  message,
  onResolved,
  onClose,
}: Props) {
  const [action, setAction] = useState<ConflictResolution | ''>('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [newContext, setNewContext] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fu = existingFollowUp;

  async function handleResolve() {
    setError('');
    if (!action) { setError('Select a resolution action'); return; }

    if (action === 'reschedule-existing' && !newDueDate) {
      setError('New due date is required for rescheduling');
      return;
    }
    if (action === 'override' && !overrideReason.trim()) {
      setError('Override reason is required');
      return;
    }

    const payload: Record<string, unknown> = { action };

    if (action === 'reschedule-existing') {
      const dueAt = newDueTime
        ? new Date(`${newDueDate}T${newDueTime}`).toISOString()
        : new Date(`${newDueDate}T09:00:00`).toISOString();
      payload.newDueAt = dueAt;
      payload.hasExplicitTime = !!newDueTime;
    }
    if (action === 'update-existing' && newContext.trim()) {
      payload.newContext = newContext.trim();
    }
    if (action === 'override') {
      payload.overrideReason = overrideReason.trim();
    }

    setSubmitting(true);
    const result = await fridayFetch(`/friday/follow-ups/${fu.id}/resolve-conflict`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (result.ok) {
      onResolved();
      return;
    }
    setError(result.error);
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Duplicate Follow-up Conflict</h2>

        <div style={{
          ...S.card,
          borderLeft: `3px solid ${S.FC.accentAmber}`,
          marginBottom: 20,
        }}>
          <p style={{ color: S.FC.accentAmber, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>
            {message}
          </p>
          <div style={{ fontSize: '0.8125rem', color: S.FC.textSecondary }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
              <div><span style={{ color: S.FC.textMuted }}>Intent:</span> {INTENT_LABELS[fu.intentType] ?? fu.intentType}</div>
              <div><span style={{ color: S.FC.textMuted }}>Status:</span> {STATUS_LABELS[fu.status] ?? fu.status}</div>
              <div><span style={{ color: S.FC.textMuted }}>Due:</span> {formatDueAt(fu.dueAt, fu.hasExplicitTime)}</div>
              {fu.contact && (
                <div><span style={{ color: S.FC.textMuted }}>Contact:</span> {fu.contact.name}</div>
              )}
            </div>
            {fu.context && (
              <div style={{ marginTop: 8, color: S.FC.textMuted }}>
                <span style={{ color: S.FC.textFaint }}>Context:</span> {fu.context}
              </div>
            )}
          </div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Resolution</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['reschedule-existing', 'update-existing', 'override'] as ConflictResolution[]).map((opt) => (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${action === opt ? S.FC.accentBlue : S.FC.border}`,
                  background: action === opt ? S.FC.accentBlueDim : 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  color: S.FC.textSecondary,
                }}
              >
                <input
                  type="radio"
                  name="conflict-action"
                  value={opt}
                  checked={action === opt}
                  onChange={() => setAction(opt)}
                  style={{ accentColor: S.FC.accentBlue }}
                />
                {opt === 'reschedule-existing' && 'Reschedule existing follow-up'}
                {opt === 'update-existing' && 'Update existing follow-up context'}
                {opt === 'override' && 'Override — create new (requires reason)'}
              </label>
            ))}
          </div>
        </div>

        {action === 'reschedule-existing' && (
          <div style={S.fieldRow}>
            <div>
              <label style={S.label}>New due date *</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Time (optional)</label>
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                style={S.input}
              />
            </div>
          </div>
        )}

        {action === 'update-existing' && (
          <div style={S.fieldGroup}>
            <label style={S.label}>Updated context</label>
            <textarea
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Update the context for the existing follow-up"
              style={S.textarea}
            />
          </div>
        )}

        {action === 'override' && (
          <div style={S.fieldGroup}>
            <label style={S.label}>Override reason *</label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why a duplicate follow-up is justified"
              style={S.textarea}
            />
          </div>
        )}

        {error && <p style={S.errorText}>{error}</p>}

        <div style={S.btnRow}>
          <button onClick={onClose} style={S.btnSecondary}>Cancel</button>
          <button
            onClick={handleResolve}
            disabled={submitting || !action}
            style={{
              ...S.btnPrimary,
              opacity: submitting || !action ? 0.5 : 1,
            }}
          >
            {submitting ? 'Resolving...' : 'Resolve Conflict'}
          </button>
        </div>
      </div>
    </div>
  );
}
