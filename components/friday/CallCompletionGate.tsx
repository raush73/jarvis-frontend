'use client';

import { useState, useEffect, useCallback } from 'react';
import { fridayFetch } from './fridayFetch';
import {
  type FollowUp,
  type FollowUpIntentType,
  type NextActionType,
  type CallOutcome,
  type RecycleReason,
  type DoNotCallReason,
  type ConflictResolutionAction,
  type CompanyContact,
  type CompleteCallPayload,
  type ConflictResponse,
  type CallIntelligence,
  type IntelligenceResponse,
  type CallCompletionContext,
  type EmailDraft,
  INTENT_LABELS,
  OUTCOME_LABELS,
  CTA_LABELS,
  RECYCLE_REASON_LABELS,
  RECYCLE_REASON_BD,
  DNC_REASON_LABELS,
  ALL_OUTCOMES,
  ALL_CTAS,
  ALL_RECYCLE_REASONS,
  ALL_DNC_REASONS,
  ALL_INTENT_TYPES,
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
  mode?: 'friday' | 'operational';
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
  mode = 'friday',
}: Props) {
  // Intelligence loading state
  const [intelligence, setIntelligence] = useState<CallIntelligence | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState('');
  const [originalAiSummary, setOriginalAiSummary] = useState('');

  // Context data
  const [context, setContext] = useState<CallCompletionContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  // Core form state
  const [callOutcome, setCallOutcome] = useState<CallOutcome | ''>('');
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

  // Conflict resolution
  const [conflictAction, setConflictAction] = useState<ConflictResolutionAction | ''>('');
  const [conflictNewDueDate, setConflictNewDueDate] = useState('');
  const [conflictNewDueTime, setConflictNewDueTime] = useState('');
  const [conflictNewContext, setConflictNewContext] = useState('');
  const [conflictOverrideReason, setConflictOverrideReason] = useState('');

  // Recycle sub-form
  const [recycleReason, setRecycleReason] = useState<RecycleReason | ''>('');

  // Do-not-call sub-form
  const [dncReason, setDncReason] = useState<DoNotCallReason | ''>('');

  // Email draft state
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailContactId, setEmailContactId] = useState('');
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'approving' | 'approved' | 'discarded'>('idle');

  const openFollowUps = existingFollowUps.filter((fu) => fu.status === 'OPEN');
  const hasConflict = nextAction === 'follow-up' && openFollowUps.length > 0;

  // Load context data
  useEffect(() => {
    (async () => {
      setContextLoading(true);
      const res = await fridayFetch<CallCompletionContext>(
        `/friday/calls/${callEventId}/context`,
      );
      setContextLoading(false);
      if (res.ok) setContext(res.data);
    })();
  }, [callEventId]);

  const MEANINGFUL_OUTCOMES: Set<string> = new Set([
    'SPOKE_NO_OPPORTUNITY',
    'OPPORTUNITY_IDENTIFIED',
    'FOLLOW_UP_REQUIRED',
  ]);

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
    } else {
      setAiError(result.ok ? '' : (result.error || ''));
    }
  }, [callEventId]);

  useEffect(() => {
    if (mode === 'operational') {
      setAiLoading(false);
      return;
    }
    if (MEANINGFUL_OUTCOMES.has(callOutcome)) {
      loadIntelligence();
    } else {
      setAiLoading(false);
    }
  }, [callOutcome, loadIntelligence, mode]);

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

  const canSubmit = mode === 'operational'
    ? callNoteText.trim().length > 0
    : callNoteText.trim().length > 0 &&
      callOutcome !== '' &&
      nextAction !== '' &&
      validateSubForm();

  function validateSubForm(): boolean {
    if (nextAction === 'follow-up') {
      if (hasConflict) {
        if (!conflictAction) return false;
        if (conflictAction === 'override') return !!conflictOverrideReason.trim() && !!fuDueDate && !!fuContext.trim();
        if (conflictAction === 'reschedule-existing') return !!conflictNewDueDate;
        if (conflictAction === 'mark-complete') return true;
        if (conflictAction === 'update-existing') return true;
        return false;
      }
      return !!fuDueDate && !!fuContext.trim();
    }
    if (nextAction === 'recycle-lead') {
      return recycleReason !== '';
    }
    if (nextAction === 'do-not-call') {
      return dncReason !== '';
    }
    return false;
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

    if (mode === 'operational') {
      if (!callNoteText.trim()) { setError('Call note is required'); return; }

      const payload: CompleteCallPayload = {
        callNoteText: callNoteText.trim(),
        noteSource: 'MANUAL',
      };
      if (callOutcome) {
        payload.callOutcome = callOutcome as CallOutcome;
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
      setError(result.error);
      return;
    }

    if (!callOutcome) { setError('Call outcome is required'); return; }
    if (!callNoteText.trim()) { setError('Call note is required'); return; }
    if (!nextAction) { setError('Next action is required'); return; }

    const payload: CompleteCallPayload = {
      callOutcome: callOutcome as CallOutcome,
      callNoteText: callNoteText.trim(),
      nextAction,
      intelligenceId: intelligence?.id,
      noteSource: deriveNoteSource(),
    };

    if (nextAction === 'follow-up') {
      if (hasConflict && conflictAction) {
        const existingFu = openFollowUps[0];
        payload.conflictResolution = {
          action: conflictAction as ConflictResolutionAction,
          existingFollowUpId: existingFu.id,
          overrideReason: conflictAction === 'override' ? conflictOverrideReason : undefined,
          newDueAt: conflictAction === 'reschedule-existing' && conflictNewDueDate
            ? (conflictNewDueTime
              ? new Date(`${conflictNewDueDate}T${conflictNewDueTime}`).toISOString()
              : new Date(`${conflictNewDueDate}T09:00:00`).toISOString())
            : undefined,
          hasExplicitTime: conflictAction === 'reschedule-existing' ? !!conflictNewDueTime : undefined,
          newContext: conflictAction === 'update-existing' ? conflictNewContext || undefined : undefined,
        };
        if (conflictAction === 'override') {
          if (!fuDueDate) { setError('Due date is required for follow-up'); return; }
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
      } else {
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
    }

    if (nextAction === 'recycle-lead' && recycleReason) {
      payload.recyclePayload = { reason: recycleReason as RecycleReason };
    }

    if (nextAction === 'do-not-call') {
      if (!dncReason) { setError('Do Not Call reason is required'); return; }
      payload.doNotCallReason = dncReason as DoNotCallReason;
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
  const emailContacts = contacts.filter((c) => c.email);

  // ─── Operational Mode (CUSTOMER_DETAIL) ────────────────────────────
  if (mode === 'operational') {
    return (
      <>
        <h2 style={S.modalTitle}>Complete Call</h2>
        <p style={{ color: S.FC.textMuted, fontSize: '0.8125rem', marginBottom: 20 }}>
          Add a note to complete this call.
        </p>

        <div style={S.fieldGroup}>
          <label style={S.label}>Call note *</label>
          <textarea
            value={callNoteText}
            onChange={(e) => setCallNoteText(e.target.value)}
            placeholder="Summarize what was discussed..."
            style={{ ...S.textarea, minHeight: 100 }}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Call outcome (optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_OUTCOMES.map((oc) => {
              const isSelected = callOutcome === oc;
              return (
                <label key={oc} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 6,
                  border: `1px solid ${isSelected ? S.FC.accentBlue : S.FC.border}`,
                  background: isSelected ? S.FC.accentBlueDim : 'transparent',
                  cursor: 'pointer', fontSize: '0.8125rem', color: S.FC.textSecondary,
                }}>
                  <input
                    type="radio" name="op-call-outcome" value={oc}
                    checked={isSelected}
                    onChange={() => setCallOutcome(oc)}
                    style={{ accentColor: S.FC.accentBlue }}
                  />
                  {OUTCOME_LABELS[oc]}
                </label>
              );
            })}
            {callOutcome && (
              <button
                onClick={() => setCallOutcome('')}
                style={{
                  alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 5,
                  border: `1px solid ${S.FC.border}`, background: 'transparent',
                  color: S.FC.textMuted, fontSize: '0.75rem', cursor: 'pointer',
                  marginTop: 2,
                }}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        {error && <p style={{ ...S.errorText, marginTop: 12 }}>{error}</p>}

        <div style={S.btnRow}>
          <button onClick={onClose} style={S.btnSecondary}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{ ...S.btnPrimary, opacity: submitting || !canSubmit ? 0.5 : 1 }}
          >
            {submitting ? 'Completing...' : 'Complete Call'}
          </button>
        </div>
      </>
    );
  }

  // ─── Friday Mode (default) ─────────────────────────────────────────
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Complete Call</h2>
        <p style={{ color: S.FC.textMuted, fontSize: '0.8125rem', marginBottom: 20 }}>
          Select an outcome and next action to complete this call.
        </p>

        {/* ─── Context Display Section ─── */}
        {!contextLoading && context && (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: S.FC.textSecondary }}>
                Company Context
              </span>
              {context.attemptCount > 0 && (
                <span style={{
                  fontSize: '0.625rem', fontWeight: 700, color: S.FC.accentBlue,
                  padding: '2px 6px', borderRadius: 3, background: S.FC.accentBlueDim,
                }}>
                  Call #{context.attemptCount + 1}
                </span>
              )}
            </div>

            {/* Call History */}
            {context.callHistory.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: S.FC.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Call History
                </div>
                <div style={{ maxHeight: 130, overflowY: 'auto', fontSize: '0.75rem', color: S.FC.textSecondary }}>
                  {context.callHistory.map((c, i) => (
                    <div key={i} style={{
                      padding: '4px 0',
                      borderBottom: i < context.callHistory.length - 1 ? `1px solid ${S.FC.border}` : 'none',
                      fontWeight: i === 0 ? 600 : 400,
                      color: i === 0 ? S.FC.textPrimary : S.FC.textSecondary,
                    }}>
                      Last called by {c.repName} on {new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {c.outcome ? ` — ${c.outcome.replace(/_/g, ' ')}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note History */}
            {context.noteHistory.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: S.FC.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Recent Notes
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: '0.75rem', color: S.FC.textSecondary }}>
                  {context.noteHistory.map((n, i) => (
                    <div key={i} style={{
                      padding: '4px 0',
                      borderBottom: i < context.noteHistory.length - 1 ? `1px solid ${S.FC.border}` : 'none',
                    }}>
                      <span style={{ color: S.FC.textMuted, fontSize: '0.625rem' }}>
                        {n.author} — {new Date(n.date).toLocaleDateString()}
                      </span>
                      <div style={{ marginTop: 2 }}>{n.text.length > 200 ? n.text.slice(0, 200) + '...' : n.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Follow-up */}
            {context.activeFollowUp && (
              <div style={{
                padding: '6px 10px', borderRadius: 6,
                background: S.FC.accentBlueDim, border: `1px solid rgba(59, 130, 246, 0.2)`,
                fontSize: '0.75rem', color: S.FC.accentBlue,
              }}>
                Active: {context.activeFollowUp.intentType.replace(/_/g, ' ')} due {new Date(context.activeFollowUp.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {context.activeFollowUp.context ? ` — ${context.activeFollowUp.context.slice(0, 80)}` : ''}
              </div>
            )}
          </div>
        )}

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
                    fontSize: '0.625rem', fontWeight: 700, color: conf.color,
                    padding: '2px 6px', borderRadius: 3, background: `${conf.color}22`,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {conf.text}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button onClick={() => setCallNoteText(originalAiSummary)} style={{ ...S.btnSmall, color: S.FC.accentPurple, borderColor: 'rgba(139, 92, 246, 0.3)' }}>
                Reset to AI
              </button>
              <button onClick={() => setCallNoteText('')} style={S.btnSmall}>Clear</button>
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
            style={{ ...S.textarea, minHeight: 80 }}
          />
        </div>

        {/* ─── Step 1: Outcome Selection ─── */}
        <div style={S.fieldGroup}>
          <label style={{ ...S.label, fontSize: '0.8125rem', fontWeight: 700, color: S.FC.textPrimary }}>
            Step 1 — Call Outcome *
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_OUTCOMES.map((oc) => {
              const isSelected = callOutcome === oc;
              return (
                <label key={oc} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 6,
                  border: `1px solid ${isSelected ? S.FC.accentBlue : S.FC.border}`,
                  background: isSelected ? S.FC.accentBlueDim : 'transparent',
                  cursor: 'pointer', fontSize: '0.8125rem', color: S.FC.textSecondary,
                }}>
                  <input
                    type="radio" name="call-outcome" value={oc}
                    checked={isSelected}
                    onChange={() => setCallOutcome(oc)}
                    style={{ accentColor: S.FC.accentBlue }}
                  />
                  {OUTCOME_LABELS[oc]}
                </label>
              );
            })}
          </div>
        </div>

        {/* ─── Step 2: CTA Selection ─── */}
        <div style={{
          ...S.fieldGroup,
          opacity: callOutcome ? 1 : 0.4,
          pointerEvents: callOutcome ? 'auto' : 'none',
        }}>
          <label style={{ ...S.label, fontSize: '0.8125rem', fontWeight: 700, color: S.FC.textPrimary }}>
            Step 2 — Next Action *
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_CTAS.map((cta) => {
              const isSelected = nextAction === cta;
              return (
                <label key={cta} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 6,
                  border: `1px solid ${isSelected ? S.FC.accentBlue : S.FC.border}`,
                  background: isSelected ? S.FC.accentBlueDim : 'transparent',
                  cursor: callOutcome ? 'pointer' : 'not-allowed',
                  fontSize: '0.8125rem', color: S.FC.textSecondary,
                }}>
                  <input
                    type="radio" name="next-action" value={cta}
                    checked={isSelected}
                    onChange={() => { setNextAction(cta); setConflictAction(''); }}
                    disabled={!callOutcome}
                    style={{ accentColor: S.FC.accentBlue }}
                  />
                  {CTA_LABELS[cta]}
                </label>
              );
            })}
          </div>
        </div>

        {/* ─── Follow-Up CTA Sub-form ─── */}
        {nextAction === 'follow-up' && !hasConflict && (
          <div style={{ ...S.card, marginTop: 4 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 12 }}>
              Follow-up Details
            </h4>
            <div style={S.fieldGroup}>
              <label style={S.label}>Contact</label>
              <select value={fuContactId} onChange={(e) => setFuContactId(e.target.value)} style={S.select}>
                <option value="" style={{ background: '#1a1d24', color: '#fff' }}>Company-level (no contact)</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#1a1d24', color: '#fff' }}>
                    {c.name}{c.title ? ` — ${c.title}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Intent</label>
              <select value={fuIntentType} onChange={(e) => setFuIntentType(e.target.value as FollowUpIntentType)} style={S.select}>
                {ALL_INTENT_TYPES.map((t) => (
                  <option key={t} value={t} style={{ background: '#1a1d24', color: '#fff' }}>{INTENT_LABELS[t]}</option>
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

        {/* ─── Follow-Up CTA with Conflict Resolution ─── */}
        {nextAction === 'follow-up' && hasConflict && (
          <div style={{ ...S.card, marginTop: 4, borderLeft: `3px solid ${S.FC.accentAmber}` }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.accentAmber, marginBottom: 8 }}>
              Existing Follow-up Detected
            </h4>
            <p style={{ fontSize: '0.75rem', color: S.FC.textSecondary, marginBottom: 12 }}>
              {openFollowUps[0].intentType.replace(/_/g, ' ')} — due {formatDueAt(openFollowUps[0].dueAt, openFollowUps[0].hasExplicitTime)}
              {openFollowUps[0].context ? `: ${openFollowUps[0].context.slice(0, 80)}` : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {([
                ['update-existing', 'Update existing follow-up'],
                ['reschedule-existing', 'Reschedule existing follow-up'],
                ['mark-complete', 'Mark existing as complete (no new follow-up)'],
                ['override', 'Override — cancel existing, create new (requires reason)'],
              ] as [ConflictResolutionAction, string][]).map(([action, label]) => (
                <label key={action} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 5,
                  border: `1px solid ${conflictAction === action ? S.FC.accentAmber : S.FC.border}`,
                  background: conflictAction === action ? S.FC.accentAmberDim : 'transparent',
                  cursor: 'pointer', fontSize: '0.75rem', color: S.FC.textSecondary,
                }}>
                  <input
                    type="radio" name="conflict-action" value={action}
                    checked={conflictAction === action}
                    onChange={() => setConflictAction(action)}
                    style={{ accentColor: S.FC.accentAmber }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {conflictAction === 'reschedule-existing' && (
              <div style={S.fieldRow}>
                <div>
                  <label style={S.label}>New due date *</label>
                  <input type="date" value={conflictNewDueDate} onChange={(e) => setConflictNewDueDate(e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Time (optional)</label>
                  <input type="time" value={conflictNewDueTime} onChange={(e) => setConflictNewDueTime(e.target.value)} style={S.input} />
                </div>
              </div>
            )}

            {conflictAction === 'update-existing' && (
              <div style={S.fieldGroup}>
                <label style={S.label}>Updated context (optional)</label>
                <textarea
                  value={conflictNewContext}
                  onChange={(e) => setConflictNewContext(e.target.value)}
                  placeholder="Update the context..."
                  style={S.textarea}
                />
              </div>
            )}

            {conflictAction === 'override' && (
              <>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Override reason *</label>
                  <input
                    type="text"
                    value={conflictOverrideReason}
                    onChange={(e) => setConflictOverrideReason(e.target.value)}
                    placeholder="Why are you overriding the existing follow-up?"
                    style={S.input}
                  />
                </div>
                <div style={S.fieldRow}>
                  <div>
                    <label style={S.label}>New due date *</label>
                    <input type="date" value={fuDueDate} onChange={(e) => setFuDueDate(e.target.value)} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Time (optional)</label>
                    <input type="time" value={fuDueTime} onChange={(e) => setFuDueTime(e.target.value)} style={S.input} />
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
              </>
            )}
          </div>
        )}

        {/* ─── Recycle Lead CTA Sub-form ─── */}
        {nextAction === 'recycle-lead' && (
          <div style={{ ...S.card, marginTop: 4 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.textPrimary, marginBottom: 12 }}>
              Recycle Lead
            </h4>
            <div style={S.fieldGroup}>
              <label style={S.label}>Reason *</label>
              <select
                value={recycleReason}
                onChange={(e) => setRecycleReason(e.target.value as RecycleReason)}
                style={S.select}
              >
                <option value="" style={{ background: '#1a1d24', color: '#fff' }}>Select reason...</option>
                {ALL_RECYCLE_REASONS.map((r) => (
                  <option key={r} value={r} style={{ background: '#1a1d24', color: '#fff' }}>{RECYCLE_REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {recycleReason && (
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: S.FC.accentBlueDim, fontSize: '0.75rem', color: S.FC.accentBlue,
              }}>
                Will be callable again in {RECYCLE_REASON_BD[recycleReason as RecycleReason]} business day{RECYCLE_REASON_BD[recycleReason as RecycleReason] !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* ─── Do Not Call CTA Sub-form ─── */}
        {nextAction === 'do-not-call' && (
          <div style={{ ...S.card, marginTop: 4, borderLeft: `3px solid ${S.FC.accentRed}` }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: S.FC.accentRed, marginBottom: 12 }}>
              Do Not Call
            </h4>
            <div style={S.fieldGroup}>
              <label style={S.label}>Reason *</label>
              <select
                value={dncReason}
                onChange={(e) => setDncReason(e.target.value as DoNotCallReason)}
                style={S.select}
              >
                <option value="" style={{ background: '#1a1d24', color: '#fff' }}>Select reason...</option>
                {ALL_DNC_REASONS.map((r) => (
                  <option key={r} value={r} style={{ background: '#1a1d24', color: '#fff' }}>{DNC_REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <p style={{ color: S.FC.accentRed, fontSize: '0.8125rem', marginTop: 4 }}>
              This marks the company as do-not-call and removes it from the calling queue.
            </p>
          </div>
        )}

        {/* Email Draft Panel */}
        {intelligence && emailContacts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setEmailExpanded(!emailExpanded)}
              style={{
                ...S.btnSmall, width: '100%', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px',
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
                        <option value="" style={{ background: '#1a1d24', color: '#fff' }}>Select contact...</option>
                        {emailContacts.map((c) => (
                          <option key={c.id} value={c.id} style={{ background: '#1a1d24', color: '#fff' }}>
                            {c.name}{c.email ? ` (${c.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleGenerateEmail}
                      disabled={!emailContactId || emailLoading}
                      style={{
                        ...S.btnSmall, color: S.FC.accentPurple, borderColor: 'rgba(139, 92, 246, 0.3)',
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
                      <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} style={S.input} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Body</label>
                      <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} style={{ ...S.textarea, minHeight: 120 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={handleApproveEmail}
                        disabled={emailStatus === 'approving'}
                        style={{ ...S.btnSmall, color: S.FC.accentGreen, borderColor: 'rgba(34, 197, 94, 0.3)', opacity: emailStatus === 'approving' ? 0.5 : 1 }}
                      >
                        {emailStatus === 'approving' ? 'Approving...' : 'Approve & Queue'}
                      </button>
                      <button onClick={handleDiscardEmail} style={{ ...S.btnSmall, color: S.FC.accentRed, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
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
            style={{ ...S.btnPrimary, opacity: submitting || !canSubmit ? 0.5 : 1 }}
          >
            {submitting ? 'Completing...' : 'Complete Call'}
          </button>
        </div>
      </div>
    </div>
  );
}
