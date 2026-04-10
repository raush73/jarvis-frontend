'use client';

import { useState } from 'react';
import { fridayFetch } from './fridayFetch';
import {
  type FollowUp,
  type FollowUpIntentType,
  type NextActionType,
  type CompanyContact,
  type CompleteCallPayload,
  type ConflictResponse,
  INTENT_LABELS,
  NEXT_ACTION_LABELS,
  ALL_INTENT_TYPES,
  ALL_NEXT_ACTIONS,
} from './types';
import * as S from './styles';
import { formatDueAt } from './displayHelpers';

interface Props {
  callEventId: string;
  customerId: string;
  contacts: CompanyContact[];
  existingFollowUps: FollowUp[];
  onCompleted: () => void;
  onConflict: (conflict: ConflictResponse) => void;
  onClose: () => void;
}

export default function CallCompletionGate({
  callEventId,
  customerId,
  contacts,
  existingFollowUps,
  onCompleted,
  onConflict,
  onClose,
}: Props) {
  const [callNoteText, setCallNoteText] = useState('');
  const [nextAction, setNextAction] = useState<NextActionType | ''>('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Follow-up sub-form
  const [fuContactId, setFuContactId] = useState('');
  const [fuIntentType, setFuIntentType] = useState<FollowUpIntentType>('CALLBACK');
  const [fuDueDate, setFuDueDate] = useState('');
  const [fuDueTime, setFuDueTime] = useState('');
  const [fuContext, setFuContext] = useState('');

  // Reschedule sub-form
  const [rescheduleFollowUpId, setRescheduleFollowUpId] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Task sub-form
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const openFollowUps = existingFollowUps.filter((fu) => fu.status === 'OPEN');

  const canSubmit =
    callNoteText.trim().length > 0 &&
    nextAction !== '' &&
    validateSubForm();

  function validateSubForm(): boolean {
    if (nextAction === 'create-follow-up') {
      return !!fuDueDate && !!fuContext.trim();
    }
    if (nextAction === 'reschedule-existing-follow-up') {
      return !!rescheduleFollowUpId && !!rescheduleDate;
    }
    if (nextAction === 'create-task') {
      return !!taskDescription.trim();
    }
    return nextAction === 'mark-closed' || nextAction === 'do-not-call-again';
  }

  async function handleSubmit() {
    setError('');
    if (!callNoteText.trim()) { setError('Call note is required'); return; }
    if (!nextAction) { setError('Next action is required'); return; }

    const payload: CompleteCallPayload = {
      callNoteText: callNoteText.trim(),
      nextAction,
    };

    if (nextAction === 'create-follow-up') {
      if (!fuDueDate) { setError('Due date is required for follow-up'); return; }
      if (!fuContext.trim()) { setError('Context is required for follow-up'); return; }
      const dueAt = fuDueTime
        ? new Date(`${fuDueDate}T${fuDueTime}`).toISOString()
        : new Date(`${fuDueDate}T09:00:00`).toISOString();
      payload.followUpPayload = {
        customerId,
        contactId: fuContactId || undefined,
        intentType: fuIntentType,
        dueAt,
        hasExplicitTime: !!fuDueTime,
        context: fuContext.trim(),
      };
    }

    if (nextAction === 'reschedule-existing-follow-up') {
      if (!rescheduleFollowUpId) { setError('Select a follow-up to reschedule'); return; }
      if (!rescheduleDate) { setError('New due date is required'); return; }
      const dueAt = rescheduleTime
        ? new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
        : new Date(`${rescheduleDate}T09:00:00`).toISOString();
      payload.reschedulePayload = {
        followUpId: rescheduleFollowUpId,
        newDueAt: dueAt,
        hasExplicitTime: !!rescheduleTime,
        reason: rescheduleReason || undefined,
      };
    }

    if (nextAction === 'create-task') {
      if (!taskDescription.trim()) { setError('Task description is required'); return; }
      payload.taskPayload = {
        customerId,
        description: taskDescription.trim(),
        dueDate: taskDueDate ? new Date(`${taskDueDate}T09:00:00`).toISOString() : undefined,
      };
    }

    setSubmitting(true);
    const result = await fridayFetch(`/friday/calls/${callEventId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (result.ok) {
      onCompleted();
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
      <div style={{ ...S.modal, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Complete Call</h2>
        <p style={{ color: S.FC.textMuted, fontSize: '0.8125rem', marginBottom: 20 }}>
          Every call must be completed with a note and next action.
        </p>

        {/* Call Note */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Call note *</label>
          <textarea
            value={callNoteText}
            onChange={(e) => setCallNoteText(e.target.value)}
            placeholder="Summarize what was discussed..."
            style={{ ...S.textarea, minHeight: 100 }}
          />
        </div>

        {/* Next Action Selection */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Next action *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_NEXT_ACTIONS.map((na) => (
              <label
                key={na}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: `1px solid ${nextAction === na ? S.FC.accentBlue : S.FC.border}`,
                  background: nextAction === na ? S.FC.accentBlueDim : 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  color: S.FC.textSecondary,
                }}
              >
                <input
                  type="radio"
                  name="next-action"
                  value={na}
                  checked={nextAction === na}
                  onChange={() => setNextAction(na)}
                  style={{ accentColor: S.FC.accentBlue }}
                />
                {NEXT_ACTION_LABELS[na]}
              </label>
            ))}
          </div>
        </div>

        {/* Conditional Sub-forms */}
        {nextAction === 'create-follow-up' && (
          <div style={{ ...S.card, marginTop: 4 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 12 }}>
              Follow-up Details
            </h4>
            <div style={S.fieldGroup}>
              <label style={S.label}>Contact</label>
              <select value={fuContactId} onChange={(e) => setFuContactId(e.target.value)} style={S.select}>
                <option value="">Company-level (no contact)</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.title ? ` — ${c.title}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Intent</label>
              <select value={fuIntentType} onChange={(e) => setFuIntentType(e.target.value as FollowUpIntentType)} style={S.select}>
                {ALL_INTENT_TYPES.map((t) => (
                  <option key={t} value={t}>{INTENT_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div style={S.fieldRow}>
              <div>
                <label style={S.label}>Due date *</label>
                <input type="date" value={fuDueDate} onChange={(e) => setFuDueDate(e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Time (optional)</label>
                <input type="time" value={fuDueTime} onChange={(e) => setFuDueTime(e.target.value)} style={S.input} />
                <p style={S.helpText}>{fuDueTime ? 'Specific time follow-up' : 'Any time that day'}</p>
              </div>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Context *</label>
              <textarea
                value={fuContext}
                onChange={(e) => setFuContext(e.target.value)}
                placeholder="What should be discussed?"
                style={S.textarea}
              />
            </div>
          </div>
        )}

        {nextAction === 'reschedule-existing-follow-up' && (
          <div style={{ ...S.card, marginTop: 4 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 12 }}>
              Reschedule Existing Follow-up
            </h4>
            {openFollowUps.length === 0 ? (
              <p style={{ color: S.FC.accentAmber, fontSize: '0.8125rem' }}>
                No open follow-ups to reschedule. Select a different next action.
              </p>
            ) : (
              <>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Select follow-up *</label>
                  <select
                    value={rescheduleFollowUpId}
                    onChange={(e) => setRescheduleFollowUpId(e.target.value)}
                    style={S.select}
                  >
                    <option value="">Select...</option>
                    {openFollowUps.map((fu) => (
                      <option key={fu.id} value={fu.id}>
                        {INTENT_LABELS[fu.intentType]} — due {formatDueAt(fu.dueAt, fu.hasExplicitTime)}
                        {fu.contact ? ` (${fu.contact.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={S.fieldRow}>
                  <div>
                    <label style={S.label}>New due date *</label>
                    <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Time (optional)</label>
                    <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} style={S.input} />
                  </div>
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Reason</label>
                  <input
                    type="text"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Why rescheduling?"
                    style={S.input}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {nextAction === 'create-task' && (
          <div style={{ ...S.card, marginTop: 4 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 12 }}>
              Task Details
            </h4>
            <div style={S.fieldGroup}>
              <label style={S.label}>Description *</label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="What needs to be done?"
                style={S.textarea}
              />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Due date (optional)</label>
              <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} style={S.input} />
            </div>
          </div>
        )}

        {nextAction === 'mark-closed' && (
          <div style={{ ...S.card, marginTop: 4, borderLeft: `3px solid ${S.FC.textMuted}` }}>
            <p style={{ color: S.FC.textSecondary, fontSize: '0.8125rem' }}>
              This will mark the account as closed. Ensure your call note captures the reason.
            </p>
          </div>
        )}

        {nextAction === 'do-not-call-again' && (
          <div style={{ ...S.card, marginTop: 4, borderLeft: `3px solid ${S.FC.accentRed}` }}>
            <p style={{ color: S.FC.accentRed, fontSize: '0.8125rem' }}>
              This marks the contact/company as do-not-call. Ensure your call note captures the reason.
            </p>
          </div>
        )}

        {error && <p style={{ ...S.errorText, marginTop: 12 }}>{error}</p>}

        <div style={S.btnRow}>
          <button onClick={onClose} style={S.btnSecondary}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{
              ...S.btnPrimary,
              opacity: submitting || !canSubmit ? 0.5 : 1,
            }}
          >
            {submitting ? 'Completing...' : 'Complete Call'}
          </button>
        </div>
      </div>
    </div>
  );
}
