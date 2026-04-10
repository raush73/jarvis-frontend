'use client';

import { useState } from 'react';
import { fridayFetch } from './fridayFetch';
import {
  type FollowUp,
  type FollowUpIntentType,
  type CompanyContact,
  type CreateFollowUpPayload,
  type ConflictResponse,
  INTENT_LABELS,
  ALL_INTENT_TYPES,
} from './types';
import * as S from './styles';

interface Props {
  customerId: string;
  contacts: CompanyContact[];
  callEventId?: string;
  onCreated: (followUp: FollowUp) => void;
  onConflict: (conflict: ConflictResponse) => void;
  onClose: () => void;
}

export default function FollowUpCreateModal({
  customerId,
  contacts,
  callEventId,
  onCreated,
  onConflict,
  onClose,
}: Props) {
  const [contactId, setContactId] = useState('');
  const [intentType, setIntentType] = useState<FollowUpIntentType>('CALLBACK');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function buildDueAt(): string {
    if (!dueDate) return '';
    if (dueTime) {
      return new Date(`${dueDate}T${dueTime}`).toISOString();
    }
    return new Date(`${dueDate}T09:00:00`).toISOString();
  }

  async function handleSubmit() {
    setError('');
    if (!dueDate) { setError('Due date is required'); return; }
    if (!context.trim()) { setError('Context is required'); return; }

    const payload: CreateFollowUpPayload = {
      customerId,
      intentType,
      dueAt: buildDueAt(),
      hasExplicitTime: !!dueTime,
      context: context.trim(),
    };
    if (contactId) payload.contactId = contactId;
    if (callEventId) payload.callEventId = callEventId;

    setSubmitting(true);
    const result = await fridayFetch<FollowUp>('/friday/follow-ups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (result.ok) {
      onCreated(result.data);
      return;
    }

    if (result.status === 409 && result.data?.existingFollowUp) {
      onConflict(result.data as ConflictResponse);
      return;
    }

    setError(result.error);
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Create Follow-up</h2>

        <div style={S.fieldGroup}>
          <label style={S.label}>Contact</label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            style={S.select}
          >
            <option value="">Company-level (no contact)</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.title ? ` — ${c.title}` : ''}{c.email ? ` (${c.email})` : ''}
              </option>
            ))}
          </select>
          {contacts.length === 0 && (
            <p style={S.helpText}>No contacts on file. Follow-up will be company-level.</p>
          )}
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Intent</label>
          <select
            value={intentType}
            onChange={(e) => setIntentType(e.target.value as FollowUpIntentType)}
            style={S.select}
          >
            {ALL_INTENT_TYPES.map((t) => (
              <option key={t} value={t}>{INTENT_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div style={S.fieldRow}>
          <div>
            <label style={S.label}>Due date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Time (optional)</label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              style={S.input}
            />
            <p style={S.helpText}>
              {dueTime ? 'Specific time follow-up' : 'Any time that day'}
            </p>
          </div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Context *</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Why is this follow-up needed? What should be discussed?"
            style={S.textarea}
          />
        </div>

        {error && <p style={S.errorText}>{error}</p>}

        <div style={S.btnRow}>
          <button onClick={onClose} style={S.btnSecondary}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...S.btnPrimary,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create Follow-up'}
          </button>
        </div>
      </div>
    </div>
  );
}
