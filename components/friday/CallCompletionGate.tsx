'use client';

import { useState, useEffect, useCallback } from 'react';
import { fridayFetch } from './fridayFetch';
import {
  type FollowUp,
  type FollowUpIntentType,
  type NextActionType,
  type CompanyContact,
  type CompleteCallPayload,
  type ConflictResponse,
  type CallIntelligence,
  type IntelligenceResponse,
  type EmailDraft,
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

type NoteSourceType = 'MANUAL' | 'AI_ASSISTED' | 'AI_GENERATED';

export default function CallCompletionGate({
  callEventId,
  customerId,
  contacts,
  existingFollowUps,
  onCompleted,
  onConflict,
  onClose,
}: Props) {
  // Intelligence loading state
  const [intelligence, setIntelligence] = useState<CallIntelligence | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState('');
  const [originalAiSummary, setOriginalAiSummary] = useState('');

  // Core form state
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

  // Email draft state
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailContactId, setEmailContactId] = useState('');
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'approving' | 'approved' | 'discarded'>('idle');

  const openFollowUps = existingFollowUps.filter((fu) => fu.status === 'OPEN');

  const loadIntelligence = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    const result = await fridayFetch<IntelligenceResponse>(
      `/friday/calls/${callEventId}/intelligence`,
      { method: 'POST' },
    );
    setAiLoading(false);

    if (result.ok && result.data?.intelligence) {
      const intel = result.data.intelligence;
      setIntelligence(intel);
      setOriginalAiSummary(intel.aiSummary);
      setCallNoteText(intel.aiSummary);

      if (intel.suggestedNextAction) {
        setNextAction(intel.suggestedNextAction);
      }

      const fuSuggestion = intel.suggestedFollowUp ?? result.data.suggestions?.followUp;
      if (fuSuggestion && !fuSuggestion.rescheduleExistingId) {
        setFuIntentType(fuSuggestion.intentType as FollowUpIntentType);
        if (fuSuggestion.dueAt) {
          const d = new Date(fuSuggestion.dueAt);
          setFuDueDate(d.toISOString().split('T')[0]);
          if (fuSuggestion.hasExplicitTime) {
            setFuDueTime(d.toTimeString().slice(0, 5));
          }
        }
        setFuContext(fuSuggestion.context ?? '');
      }
      if (fuSuggestion?.rescheduleExistingId) {
        setRescheduleFollowUpId(fuSuggestion.rescheduleExistingId);
        if (fuSuggestion.dueAt) {
          const d = new Date(fuSuggestion.dueAt);
          setRescheduleDate(d.toISOString().split('T')[0]);
          if (fuSuggestion.hasExplicitTime) {
            setRescheduleTime(d.toTimeString().slice(0, 5));
          }
        }
        setRescheduleReason(fuSuggestion.reasoning ?? '');
      }

      const taskSuggestion = intel.suggestedTask ?? result.data.suggestions?.task;
      if (taskSuggestion) {
        setTaskDescription(taskSuggestion.description ?? '');
        if (taskSuggestion.dueDate) {
          setTaskDueDate(new Date(taskSuggestion.dueDate).toISOString().split('T')[0]);
        }
      }
    } else {
      setAiError(result.ok ? '' : (result.error || ''));
    }
  }, [callEventId]);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  function deriveNoteSource(): NoteSourceType {
    if (!intelligence) return 'MANUAL';
    if (callNoteText.trim() === originalAiSummary.trim()) return 'AI_GENERATED';
    if (callNoteText.trim().length > 0 && originalAiSummary.length > 0) return 'AI_ASSISTED';
    return 'MANUAL';
  }

  function confidenceLabel(score: number | null): { text: string; color: string } {
    if (score === null) return { text: '', color: '' };
    if (score >= 0.8) return { text: 'High confidence', color: S.FC.accentGreen };
    if (score >= 0.5) return { text: 'Medium confidence', color: S.FC.accentAmber };
    return { text: 'Low confidence', color: S.FC.accentRed };
  }

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

  async function handleGenerateEmail() {
    if (!emailContactId) return;
    setEmailLoading(true);
    const result = await fridayFetch<{ ok: boolean; draft: EmailDraft | null }>(
      `/friday/calls/${callEventId}/email-draft/generate`,
      {
        method: 'POST',
        body: JSON.stringify({ contactId: emailContactId }),
      },
    );
    setEmailLoading(false);
    if (result.ok && result.data?.draft) {
      const d = result.data.draft;
      setEmailDraft(d);
      setEmailSubject(d.subject);
      setEmailBody(d.body);
    }
  }

  async function handleApproveEmail() {
    if (!emailDraft) return;
    setEmailStatus('approving');
    if (emailSubject !== emailDraft.subject || emailBody !== emailDraft.body) {
      await fridayFetch(`/friday/email-drafts/${emailDraft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      });
    }
    const result = await fridayFetch(`/friday/email-drafts/${emailDraft.id}/approve`, {
      method: 'POST',
      body: '{}',
    });
    setEmailStatus(result.ok ? 'approved' : 'idle');
  }

  async function handleDiscardEmail() {
    if (!emailDraft) return;
    await fridayFetch(`/friday/email-drafts/${emailDraft.id}/discard`, {
      method: 'POST',
      body: '{}',
    });
    setEmailDraft(null);
    setEmailSubject('');
    setEmailBody('');
    setEmailStatus('discarded');
  }

  async function handleSubmit() {
    setError('');
    if (!callNoteText.trim()) { setError('Call note is required'); return; }
    if (!nextAction) { setError('Next action is required'); return; }

    const payload: CompleteCallPayload = {
      callNoteText: callNoteText.trim(),
      nextAction,
      intelligenceId: intelligence?.id,
      noteSource: deriveNoteSource(),
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

  const conf = confidenceLabel(intelligence?.confidenceScore ?? null);
  const suggestedAction = intelligence?.suggestedNextAction;
  const emailContacts = contacts.filter((c) => c.email);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Complete Call</h2>
        <p style={{ color: S.FC.textMuted, fontSize: '0.8125rem', marginBottom: 20 }}>
          Every call must be completed with a note and next action.
        </p>

        {/* AI Intelligence Banner */}
        {aiLoading && (
          <div style={{ ...S.card, borderLeft: `3px solid ${S.FC.accentPurple}`, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: `2px solid ${S.FC.accentPurple}`,
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: S.FC.accentPurple, fontSize: '0.8125rem', fontWeight: 500 }}>
                Generating AI summary...
              </span>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!aiLoading && intelligence && (
          <div style={{ ...S.card, borderLeft: `3px solid ${S.FC.accentPurple}`, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: S.FC.accentPurple }}>
                AI Summary
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {conf.text && (
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: conf.color,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: `${conf.color}22`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {conf.text}
                  </span>
                )}
                <span style={{ fontSize: '0.625rem', color: S.FC.textFaint }}>
                  {intelligence.modelVersion}
                </span>
              </div>
            </div>

            {intelligence.intentSignals.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {intelligence.intentSignals.map((signal) => (
                  <span key={signal} style={{
                    fontSize: '0.625rem',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: S.FC.accentBlueDim,
                    color: S.FC.accentBlue,
                    fontWeight: 600,
                  }}>
                    {signal.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {intelligence.keyTopics.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {intelligence.keyTopics.map((topic) => (
                  <span key={topic} style={{
                    fontSize: '0.625rem',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: S.FC.surface,
                    color: S.FC.textMuted,
                  }}>
                    {topic.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={() => setCallNoteText(originalAiSummary)}
                style={{ ...S.btnSmall, color: S.FC.accentPurple, borderColor: 'rgba(139, 92, 246, 0.3)' }}
              >
                Reset to AI
              </button>
              <button
                onClick={() => setCallNoteText('')}
                style={S.btnSmall}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {!aiLoading && aiError && (
          <div style={{ ...S.card, borderLeft: `3px solid ${S.FC.accentAmber}`, marginBottom: 16 }}>
            <span style={{ fontSize: '0.75rem', color: S.FC.accentAmber }}>
              AI summary unavailable — enter your note manually.
            </span>
          </div>
        )}

        {/* Call Note */}
        <div style={S.fieldGroup}>
          <label style={S.label}>
            Call note *
            {intelligence && callNoteText === originalAiSummary && (
              <span style={{ color: S.FC.accentPurple, fontWeight: 400, marginLeft: 6 }}>(AI-generated)</span>
            )}
            {intelligence && callNoteText !== originalAiSummary && callNoteText.length > 0 && (
              <span style={{ color: S.FC.accentBlue, fontWeight: 400, marginLeft: 6 }}>(edited)</span>
            )}
          </label>
          <textarea
            value={callNoteText}
            onChange={(e) => setCallNoteText(e.target.value)}
            placeholder={aiLoading ? 'Waiting for AI summary...' : 'Summarize what was discussed...'}
            style={{ ...S.textarea, minHeight: 100 }}
          />
        </div>

        {/* Next Action Selection */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Next action *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_NEXT_ACTIONS.map((na) => {
              const isSuggested = suggestedAction === na;
              const isSelected = nextAction === na;
              return (
                <label
                  key={na}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: `1px solid ${isSelected ? S.FC.accentBlue : isSuggested ? 'rgba(139, 92, 246, 0.4)' : S.FC.border}`,
                    background: isSelected ? S.FC.accentBlueDim : isSuggested ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: S.FC.textSecondary,
                  }}
                >
                  <input
                    type="radio"
                    name="next-action"
                    value={na}
                    checked={isSelected}
                    onChange={() => setNextAction(na)}
                    style={{ accentColor: S.FC.accentBlue }}
                  />
                  {NEXT_ACTION_LABELS[na]}
                  {isSuggested && (
                    <span style={{
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      color: S.FC.accentPurple,
                      marginLeft: 'auto',
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'rgba(139, 92, 246, 0.15)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      suggested
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Conditional Sub-forms */}
        {nextAction === 'create-follow-up' && (
          <div style={{ ...S.card, marginTop: 4 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 12 }}>
              Follow-up Details
              {intelligence?.suggestedFollowUp && !intelligence.suggestedFollowUp.rescheduleExistingId && (
                <span style={{ color: S.FC.accentPurple, fontWeight: 400, fontSize: '0.6875rem', marginLeft: 8 }}>
                  (pre-filled from AI)
                </span>
              )}
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
              {intelligence?.suggestedTask && (
                <span style={{ color: S.FC.accentPurple, fontWeight: 400, fontSize: '0.6875rem', marginLeft: 8 }}>
                  (pre-filled from AI)
                </span>
              )}
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

        {/* Email Draft Panel (optional, collapsible) */}
        {intelligence && emailContacts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setEmailExpanded(!emailExpanded)}
              style={{
                ...S.btnSmall,
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
              }}
            >
              <span>Email Follow-up (optional)</span>
              <span style={{ fontSize: '0.75rem' }}>{emailExpanded ? '\u25B2' : '\u25BC'}</span>
            </button>

            {emailExpanded && (
              <div style={{ ...S.card, marginTop: 4, borderLeft: `3px solid ${S.FC.accentBlue}` }}>
                {emailStatus === 'approved' && (
                  <p style={{ color: S.FC.accentGreen, fontSize: '0.8125rem', fontWeight: 600 }}>
                    Email approved and queued for send.
                  </p>
                )}
                {emailStatus === 'discarded' && !emailDraft && (
                  <p style={{ color: S.FC.textMuted, fontSize: '0.8125rem' }}>
                    Email draft discarded.
                  </p>
                )}

                {emailStatus !== 'approved' && emailStatus !== 'discarded' && !emailDraft && (
                  <>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Recipient</label>
                      <select value={emailContactId} onChange={(e) => setEmailContactId(e.target.value)} style={S.select}>
                        <option value="">Select contact...</option>
                        {emailContacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.email ? ` (${c.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleGenerateEmail}
                      disabled={!emailContactId || emailLoading}
                      style={{
                        ...S.btnSmall,
                        color: S.FC.accentPurple,
                        borderColor: 'rgba(139, 92, 246, 0.3)',
                        opacity: !emailContactId || emailLoading ? 0.5 : 1,
                      }}
                    >
                      {emailLoading ? 'Generating...' : 'Generate AI Draft'}
                    </button>
                  </>
                )}

                {emailDraft && emailStatus !== 'approved' && (
                  <>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Subject</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        style={S.input}
                      />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Body</label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        style={{ ...S.textarea, minHeight: 120 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={handleApproveEmail}
                        disabled={emailStatus === 'approving'}
                        style={{
                          ...S.btnSmall,
                          color: S.FC.accentGreen,
                          borderColor: 'rgba(34, 197, 94, 0.3)',
                          opacity: emailStatus === 'approving' ? 0.5 : 1,
                        }}
                      >
                        {emailStatus === 'approving' ? 'Approving...' : 'Approve & Queue'}
                      </button>
                      <button
                        onClick={handleDiscardEmail}
                        style={{ ...S.btnSmall, color: S.FC.accentRed, borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        Discard
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
