'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fridayFetch } from './fridayFetch';
import CallCompletionGate from './CallCompletionGate';
import * as S from './styles';
import {
  type CallExecutionState,
  type CallTarget,
  type SessionStatus,
  type StartCallResult,
  type CompleteCallResult,
  type DeferResult,
  type DismissGateResult,
  type CompanyContact,
  type FollowUp,
  type ConflictResponse,
  type StaleReviewResult,
  type StaleReviewBounds,
  BUCKET_LABELS,
  BUCKET_COLORS,
} from './types';

const SUPPRESSION_PRESETS = [7, 14, 21, 30] as const;

// Response shape of GET /friday/call-session/next (NextCallableResponse).
type NextCallableResult = {
  ok: boolean;
  target: CallTarget | null;
  reason: string | null;
};

type PanelPhase =
  | 'idle'
  | 'ready'
  | 'in_call'
  | 'completing'
  | 'blocked'
  | 'loading';

interface CallSessionPanelProps {
  onTargetChange?: (target: CallTarget | null) => void;
  directTargetCustomerId?: string;
  onOpenCompanyDetail?: (customerId: string) => void;
}

// Raw shape returned by GET /customer-contacts/customer/:customerId.
type RawCustomerContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  cellPhone?: string | null;
  officePhone?: string | null;
  jobTitle?: string | null;
};

// Map the customer-contacts API record into the CompanyContact shape the
// completion gate consumes.
function toCompanyContacts(rows: RawCustomerContact[]): CompanyContact[] {
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '(no name)',
    email: r.email ?? null,
    phone: r.cellPhone ?? r.officePhone ?? null,
    title: r.jobTitle ?? null,
  }));
}

const STATUS_POLL_INTERVAL_MS = 5000;
const POLLED_PHASES: PanelPhase[] = ['in_call', 'completing', 'blocked'];

export default function CallSessionPanel({ onTargetChange, directTargetCustomerId, onOpenCompanyDetail }: CallSessionPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>('loading');
  const [sessionId, setSessionId] = useState('');
  const [callEventId, setCallEventId] = useState<string | null>(null);
  const [target, setTarget] = useState<CallTarget | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [showCustomDefer, setShowCustomDefer] = useState(false);
  const [customDeferValue, setCustomDeferValue] = useState('');
  const [deferConflict, setDeferConflict] = useState<DeferResult['conflict'] | null>(null);

  // Stale Review Resolution Workflow: duration picker state.
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [staleBounds, setStaleBounds] = useState<StaleReviewBounds | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | 'custom'>(14);
  const [customDaysValue, setCustomDaysValue] = useState('');

  const mountedRef = useRef(true);
  const directConsumedRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const autoOpenedCallEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    onTargetChange?.(target);
  }, [target, onTargetChange]);

  const syncState = useCallback(
    (state: CallExecutionState, evtId: string | null, tgt: CallTarget | null) => {
      setCallEventId((prev) => evtId ?? prev);
      setTarget(tgt);
      switch (state) {
        case 'READY':
          setPhase('ready');
          break;
        case 'IN_CALL':
          setPhase('in_call');
          break;
        case 'COMPLETING':
          setPhase('completing');
          break;
        case 'BLOCKED':
          setPhase('blocked');
          break;
        default:
          setPhase('idle');
      }
    },
    [],
  );

  // On mount, recover session state from the server
  useEffect(() => {
    (async () => {
      const res = await fridayFetch<SessionStatus>('/friday/call-session/status');
      if (!mountedRef.current) return;
      if (res.ok) {
        const d = res.data;
        if (d.sessionId) {
          setSessionId(d.sessionId);
          setEmptyReason(d.nextTarget ? null : d.message);
          syncState(d.state, d.currentCallEventId, d.nextTarget);
        } else {
          setPhase('idle');
        }
      } else {
        setPhase('idle');
      }
    })();
  }, [syncState]);

  // Direct mode: when session is READY and a directTargetCustomerId is pending,
  // auto-fire startCallDirect to bypass queue. Consumed once per mount.
  useEffect(() => {
    if (
      !directTargetCustomerId ||
      directConsumedRef.current ||
      phase !== 'ready' ||
      !sessionId ||
      busy
    ) return;

    directConsumedRef.current = true;

    (async () => {
      setBusy(true);
      setError('');
      const res = await fridayFetch<StartCallResult>(
        '/friday/call-session/start-call-direct',
        {
          method: 'POST',
          body: JSON.stringify({ customerId: directTargetCustomerId }),
        },
      );
      if (!mountedRef.current) return;
      setBusy(false);
      if (res.ok) {
        setCallEventId(res.data.callEventId);
        setTarget(res.data.callTarget);
        setPhase('in_call');
      } else {
        setError(res.error);
      }
    })();
  }, [directTargetCustomerId, phase, sessionId, busy]);

  const loadContactsAndFollowUps = useCallback(async (customerId: string) => {
    const [cRes, fRes] = await Promise.all([
      fridayFetch<RawCustomerContact[]>(`/customer-contacts/customer/${customerId}`),
      fridayFetch<FollowUp[]>(`/friday/follow-ups/company/${customerId}?status=OPEN`),
    ]);
    if (mountedRef.current) {
      setContacts(cRes.ok ? toCompanyContacts(cRes.data) : []);
      setFollowUps(fRes.ok ? fRes.data : []);
    }
  }, []);

  // Poll backend session state while a call is in flight so a backend-driven
  // IN_CALL -> COMPLETING transition (Webex disconnect detection) auto-opens the
  // existing completion gate. Only drives the forward transition; never reverts
  // a locally-opened completing/blocked state back to in_call.
  useEffect(() => {
    if (!sessionId || !POLLED_PHASES.includes(phase)) return;

    const pollStatus = async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const res = await fridayFetch<SessionStatus>('/friday/call-session/status');
        if (!mountedRef.current || !res.ok) return;

        const d = res.data;
        if (
          d.state === 'COMPLETING' &&
          d.currentCallEventId &&
          autoOpenedCallEventIdRef.current !== d.currentCallEventId &&
          phase === 'in_call'
        ) {
          autoOpenedCallEventIdRef.current = d.currentCallEventId;
          setCallEventId(d.currentCallEventId);
          const tgt = d.nextTarget ?? target;
          if (tgt) {
            setTarget(tgt);
            await loadContactsAndFollowUps(tgt.customerId);
          }
          if (mountedRef.current) setPhase('completing');
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };

    const intervalId = setInterval(pollStatus, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [phase, sessionId, target, loadContactsAndFollowUps]);

  // â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleStartSession = async () => {
    setBusy(true);
    setError('');
    const res = await fridayFetch<SessionStatus>('/friday/call-session/start', {
      method: 'POST',
    });
    setBusy(false);
    if (!mountedRef.current) return;
    if (res.ok) {
      setSessionId(res.data.sessionId);
      setEmptyReason(res.data.nextTarget ? null : res.data.message);
      syncState(res.data.state as CallExecutionState, res.data.currentCallEventId, res.data.nextTarget);
    } else {
      setError(res.error);
    }
  };

  // Stale Review Resolution Workflow: open the duration picker. Loads the
  // configured suppression bounds (default + max) and defaults the selection to
  // the configured default value.
  const handleOpenDurationPicker = async () => {
    setError('');
    setShowDurationPicker(true);
    let bounds = staleBounds;
    if (!bounds) {
      const res = await fridayFetch<StaleReviewBounds>(
        '/friday/intelligence/stale-review/config',
      );
      if (!mountedRef.current) return;
      bounds = res.ok ? res.data : { defaultDays: 14, maxDays: 60 };
      setStaleBounds(bounds);
    }
    const def = bounds.defaultDays;
    if ((SUPPRESSION_PRESETS as readonly number[]).includes(def) && def <= bounds.maxDays) {
      setSelectedDuration(def);
      setCustomDaysValue('');
    } else {
      setSelectedDuration('custom');
      setCustomDaysValue(String(def));
    }
  };

  // Acknowledge the STALE reminder without calling. Suppresses ONLY the stale
  // reminder for the selected duration (server validates against the max); the
  // callback is left untouched. Then advance to the next target.
  const handleConfirmReviewedNoContact = async () => {
    if (!target?.customerId) return;
    const maxDays = staleBounds?.maxDays ?? 60;
    let days: number;
    if (selectedDuration === 'custom') {
      days = Number(customDaysValue);
      if (!Number.isInteger(days) || days < 1) {
        setError('Enter a whole number of days (1 or more).');
        return;
      }
      if (days > maxDays) {
        setError(`Suppression cannot exceed the configured maximum of ${maxDays} days.`);
        return;
      }
    } else {
      days = selectedDuration;
    }

    setBusy(true);
    setError('');
    const res = await fridayFetch<StaleReviewResult>(
      `/friday/intelligence/queue/${target.customerId}/reviewed-no-contact`,
      { method: 'POST', body: JSON.stringify({ suppressionDays: days }) },
    );
    if (!mountedRef.current) return;
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    setShowDurationPicker(false);
    const nextRes = await fridayFetch<NextCallableResult>('/friday/call-session/next');
    setBusy(false);
    if (!mountedRef.current) return;
    if (nextRes.ok) {
      setTarget(nextRes.data.target);
      setEmptyReason(nextRes.data.target ? null : nextRes.data.reason);
      setPhase('ready');
    } else {
      setError(nextRes.error);
    }
  };

  const handleStartCall = async () => {
    if (!target) return;
    setBusy(true);
    setError('');
    const res = await fridayFetch<StartCallResult>('/friday/call-session/start-call', {
      method: 'POST',
      body: JSON.stringify({ callTargetId: target.callTargetId }),
    });
    setBusy(false);
    if (!mountedRef.current) return;
    if (res.ok) {
      setCallEventId(res.data.callEventId);
      setTarget(res.data.callTarget);

      const phone = res.data.callTarget?.contactPhone ?? "";
      if (phone) {
        void fridayFetch('/webex/calls/dial', {
          method: 'POST',
          body: JSON.stringify({ destination: phone, callEventId: res.data.callEventId }),
        });
      }
      setPhase('in_call');
    } else {
      setError(res.error);
    }
  };

  const handleDefer = async (deferUntil: Date) => {
    if (!target) return;
    setBusy(true);
    setError('');
    setDeferConflict(null);
    const res = await fridayFetch<DeferResult>('/friday/call-session/defer', {
      method: 'POST',
      body: JSON.stringify({
        callTargetId: target.callTargetId,
        deferUntil: deferUntil.toISOString(),
      }),
    });
    setBusy(false);
    if (!mountedRef.current) return;

    if (res.ok && res.data.deferred) {
      setShowCustomDefer(false);
      setCustomDeferValue('');
      setTarget(res.data.nextTarget);
      setEmptyReason(res.data.nextTarget ? null : res.data.reason);
      setPhase('ready');
      return;
    }

    if (res.ok && !res.data.deferred && res.data.conflict) {
      setDeferConflict(res.data.conflict);
      return;
    }

    if (!res.ok && res.status === 409 && res.data?.conflict) {
      setDeferConflict(res.data);
      return;
    }

    setError(res.ok ? 'Defer failed' : res.error);
  };

  const handleDeferPreset = (hours: number) => {
    const dt = new Date();
    dt.setHours(dt.getHours() + hours);
    handleDefer(dt);
  };

  const handleCustomDeferSubmit = () => {
    if (!customDeferValue) return;
    const dt = new Date(customDeferValue);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      setError('Please select a future time.');
      return;
    }
    handleDefer(dt);
  };

  const handleDeferConflictResolve = async (action: string) => {
    if (!deferConflict || !target) return;
    const existingId = deferConflict.existingFollowUp?.id as string;
    if (!existingId) return;

    setBusy(true);
    setError('');

    const deferUntil = customDeferValue
      ? new Date(customDeferValue)
      : new Date(Date.now() + 3600000);

    const res = await fridayFetch<Record<string, unknown>>(
      `/friday/follow-ups/${existingId}/resolve-conflict`,
      {
        method: 'POST',
        body: JSON.stringify({
          action,
          existingFollowUpId: existingId,
          newDueAt: deferUntil.toISOString(),
          hasExplicitTime: true,
          newContext: 'Deferred from call session',
        }),
      },
    );
    setBusy(false);
    if (!mountedRef.current) return;

    if (res.ok) {
      setDeferConflict(null);
      handleDefer(deferUntil);
    } else {
      setError(res.error);
    }
  };

  const handleEndCall = async () => {
    if (!target?.customerId) return;
    if (callEventId) autoOpenedCallEventIdRef.current = callEventId;
    await loadContactsAndFollowUps(target.customerId);
    setPhase('completing');
  };

  const handleCompleteCall = async () => {
    if (!callEventId) return;
    setBusy(true);
    setError('');
    const res = await fridayFetch<CompleteCallResult>('/friday/call-session/complete-call', {
      method: 'POST',
      body: JSON.stringify({ callEventId }),
    });
    setBusy(false);
    if (!mountedRef.current) return;
    if (res.ok) {
      if (res.data.state === 'BLOCKED') {
        setPhase('blocked');
      } else {
        setTarget(res.data.nextTarget);
        setEmptyReason(res.data.nextTarget ? null : res.data.reason);
        setCallEventId(null);
        setPhase('ready');
      }
    } else {
      setError(res.error);
    }
  };

  const handleDismissGate = async () => {
    setBusy(true);
    const res = await fridayFetch<DismissGateResult>('/friday/call-session/dismiss-gate', {
      method: 'POST',
    });
    setBusy(false);
    if (!mountedRef.current) return;
    if (res.ok) {
      setCallEventId(res.data.callEventId);
      setTarget(res.data.callTarget);

      const phone = res.data.callTarget?.contactPhone ?? "";
      if (phone) {
        void fridayFetch('/webex/calls/dial', {
          method: 'POST',
          body: JSON.stringify({ destination: phone, callEventId: res.data.callEventId }),
        });
      }
      setPhase('blocked');
    }
  };

  const handleReopenGate = async () => {
    if (!target?.customerId) return;
    if (callEventId) autoOpenedCallEventIdRef.current = callEventId;
    await loadContactsAndFollowUps(target.customerId);
    setPhase('completing');
  };

  const handleGateCompleted = () => {
    handleCompleteCall();
  };

  const handleGateConflict = (_conflict: ConflictResponse) => {
    // Conflicts are handled inline inside CallCompletionGate.
    // If a 409 round-trip occurs as fallback, re-open the gate so the rep
    // can use the inline conflict resolution UI. Never dead-end.
    if (target?.customerId) {
      loadContactsAndFollowUps(target.customerId).then(() => {
        if (mountedRef.current) setPhase('completing');
      });
    }
  };

  // â”€â”€â”€ Rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (phase === 'loading') {
    return (
      <div style={panelWrap}>
        <div style={panelCard}>
          <div style={{ color: S.FC.textMuted, textAlign: 'center', padding: 40 }}>
            Loading session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={panelWrap}>
      {/* Session Header */}
      <div style={headerBar}>
        <div style={headerTitle}>Call Session</div>
        <div style={headerBadge(phase)}>{phaseLabel(phase)}</div>
      </div>

      {error && (
        <div style={errorBanner}>{error}</div>
      )}

      {/* IDLE â€” No session */}
      {phase === 'idle' && (
        <div style={panelCard}>
          <div style={emptyState}>
            <div style={emptyIcon}>ðŸ“ž</div>
            <div style={emptyTitle}>Ready to Start Calling</div>
            <div style={emptyDesc}>
              Start a call session to work through your queue. The system will
              feed you calls in priority order.
            </div>
            <button
              style={S.btnPrimary}
              onClick={handleStartSession}
              disabled={busy}
            >
              {busy ? 'Starting...' : 'Start Call Session'}
            </button>
          </div>
        </div>
      )}

      {/* READY â€” Next call target loaded */}
      {phase === 'ready' && target && (
        <div style={panelCard}>
          <TargetCard target={target} />
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button
              style={{ ...S.btnPrimary, flex: 1, padding: '12px 16px', fontSize: '0.9375rem' }}
              onClick={handleStartCall}
              disabled={busy}
            >
              {busy ? 'Connecting...' : target.staleReviewEligible ? 'Call Now' : 'Start Call'}
            </button>
          </div>

          {/* Stale Review Resolution Workflow: only for STALE targets backed by
              an OPEN future callback. */}
          {target.staleReviewEligible && (
            <div style={staleReviewSection}>
              <div style={staleReviewRow}>
                <span style={metaLabel}>Queue Reason</span>
                <span style={bucketBadge(BUCKET_COLORS.STALE)}>
                  {BUCKET_LABELS.STALE}
                </span>
              </div>
              {target.staleReviewCallback && (
                <div style={staleReviewRow}>
                  <span style={metaLabel}>Existing Callback</span>
                  <span style={metaValue}>
                    {formatCallbackDateTime(target.staleReviewCallback)}
                  </span>
                </div>
              )}

              {!showDurationPicker && (
                <button
                  style={reviewedNoContactBtn}
                  onClick={handleOpenDurationPicker}
                  disabled={busy}
                >
                  Reviewed — No Contact Needed
                </button>
              )}

              {showDurationPicker && (
                <div style={durationPickerWrap}>
                  <div style={deferLabel}>Suppress this STALE reminder for:</div>
                  <div style={durationOptions}>
                    {SUPPRESSION_PRESETS.filter(
                      (d) => d <= (staleBounds?.maxDays ?? 60),
                    ).map((d) => (
                      <label key={d} style={durationOption}>
                        <input
                          type="radio"
                          name="stale-suppression-duration"
                          checked={selectedDuration === d}
                          onChange={() => setSelectedDuration(d)}
                        />
                        {d} Days
                      </label>
                    ))}
                    <label style={durationOption}>
                      <input
                        type="radio"
                        name="stale-suppression-duration"
                        checked={selectedDuration === 'custom'}
                        onChange={() => setSelectedDuration('custom')}
                      />
                      Custom
                    </label>
                  </div>

                  {selectedDuration === 'custom' && (
                    <div style={customDaysWrap}>
                      <span style={metaLabel}>Days</span>
                      <input
                        type="number"
                        min={1}
                        max={staleBounds?.maxDays ?? 60}
                        step={1}
                        value={customDaysValue}
                        onChange={(e) => setCustomDaysValue(e.target.value)}
                        style={customDaysInput}
                      />
                      <span style={{ fontSize: '0.6875rem', color: S.FC.textMuted }}>
                        max {staleBounds?.maxDays ?? 60}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      style={{ ...reviewedNoContactBtn, flex: 1, marginTop: 0 }}
                      onClick={handleConfirmReviewedNoContact}
                      disabled={busy}
                    >
                      {busy ? 'Saving...' : 'Confirm — No Contact Needed'}
                    </button>
                    <button
                      style={{ ...viewCallbackBtn, flex: 1 }}
                      onClick={() => { setShowDurationPicker(false); setError(''); }}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {onOpenCompanyDetail && target.customerId && (
                <button
                  style={viewCallbackBtn}
                  onClick={() => onOpenCompanyDetail(target.customerId)}
                  disabled={busy}
                >
                  View Callback
                </button>
              )}
            </div>
          )}

          {onOpenCompanyDetail && target.customerId && (
            <button
              style={companyDetailBtn}
              onClick={() => onOpenCompanyDetail(target.customerId)}
            >
              Open Company Detail
            </button>
          )}

          {/* Defer controls */}
          <div style={deferSection}>
            <div style={deferLabel}>Defer this call</div>
            <div style={deferRow}>
              <button style={deferBtn} onClick={() => handleDeferPreset(1)} disabled={busy}>1h</button>
              <button style={deferBtn} onClick={() => handleDeferPreset(2)} disabled={busy}>2h</button>
              <button style={deferBtn} onClick={() => handleDeferPreset(3)} disabled={busy}>3h</button>
              <button
                style={{ ...deferBtn, ...(showCustomDefer ? deferBtnActive : {}) }}
                onClick={() => { setShowCustomDefer(!showCustomDefer); setDeferConflict(null); }}
                disabled={busy}
              >
                Custom
              </button>
            </div>

            {showCustomDefer && (
              <div style={customDeferWrap}>
                <input
                  type="datetime-local"
                  value={customDeferValue}
                  onChange={(e) => setCustomDeferValue(e.target.value)}
                  min={toLocalInputMin()}
                  step={300}
                  style={customDeferInput}
                />
                <button
                  style={{ ...S.btnPrimary, padding: '8px 16px', fontSize: '0.8125rem' }}
                  onClick={handleCustomDeferSubmit}
                  disabled={busy || !customDeferValue}
                >
                  Defer
                </button>
              </div>
            )}

            {deferConflict && (
              <div style={conflictBanner}>
                <div style={{ fontSize: '0.8125rem', color: S.FC.accentAmber, marginBottom: 8 }}>
                  {deferConflict.message}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {deferConflict.resolutionOptions.map((opt) => (
                    <button
                      key={opt}
                      style={conflictBtn}
                      onClick={() => handleDeferConflictResolve(opt)}
                      disabled={busy}
                    >
                      {conflictOptionLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'ready' && !target && (
        <div style={panelCard}>
          <div style={emptyState}>
            <div style={emptyIcon}>âœ…</div>
            <div style={emptyTitle}>Queue Clear</div>
            <div style={emptyDesc}>
              {emptyReason === 'outside_callable_hours'
                ? 'All calls are outside business hours right now.'
                : 'No calls available right now.'}
            </div>
          </div>
        </div>
      )}

      {/* IN_CALL â€” Active call */}
      {phase === 'in_call' && target && (
        <div style={{ ...panelCard, borderColor: S.FC.accentGreen }}>
          <div style={activeCallHeader}>
            <div style={pulseIndicator} />
            <span style={{ color: S.FC.accentGreen, fontWeight: 700, fontSize: '0.875rem' }}>
              Call In Progress
            </span>
          </div>
          <TargetCard target={target} />
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button
              style={{ ...S.btnPrimary, flex: 1, padding: '12px 16px', fontSize: '0.9375rem', background: S.FC.accentGreen }}
              onClick={handleEndCall}
              disabled={busy}
            >
              End Call &amp; Complete
            </button>
          </div>
          {onOpenCompanyDetail && target.customerId && (
            <button
              style={companyDetailBtn}
              onClick={() => onOpenCompanyDetail(target.customerId)}
            >
              Open Company Detail
            </button>
          )}
        </div>
      )}

      {/* COMPLETING â€” CallCompletionGate overlay */}
      {phase === 'completing' && callEventId && target && (
        <CallCompletionGate
          callEventId={callEventId}
          customerId={target.customerId}
          contacts={contacts}
          existingFollowUps={followUps}
          onCompleted={handleGateCompleted}
          onConflict={handleGateConflict}
          onClose={handleDismissGate}
        />
      )}

      {/* BLOCKED â€” Must complete before continuing */}
      {phase === 'blocked' && (
        <div style={{ ...panelCard, borderColor: S.FC.accentRed }}>
          <div style={blockedHeader}>
            <div style={{ fontSize: 24 }}>âš ï¸</div>
            <div>
              <div style={{ fontWeight: 700, color: S.FC.accentRed, fontSize: '0.9375rem' }}>
                Session Blocked
              </div>
              <div style={{ color: S.FC.textMuted, fontSize: '0.8125rem', marginTop: 4 }}>
                You must complete the call note and select a next action before
                the session can continue.
              </div>
            </div>
          </div>
          {target && <TargetCard target={target} />}
          <div style={{ marginTop: 20 }}>
            <button
              style={{ ...S.btnPrimary, width: '100%', padding: '12px 16px', fontSize: '0.9375rem', background: S.FC.accentRed }}
              onClick={handleReopenGate}
              disabled={busy}
            >
              {busy ? 'Loading...' : 'Complete Call Now'}
            </button>
          </div>
          {onOpenCompanyDetail && target?.customerId && (
            <button
              style={companyDetailBtn}
              onClick={() => onOpenCompanyDetail(target.customerId)}
            >
              Open Company Detail
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TargetCard({ target }: { target: CallTarget }) {
  const bucketColor = BUCKET_COLORS[target.bucket] ?? S.FC.accentBlue;
  const bucketLabel = BUCKET_LABELS[target.bucket] ?? target.bucket;

  return (
    <div style={targetCardWrap}>
      <div style={targetRow}>
        <div style={targetName}>{target.customerName}</div>
        <div style={bucketBadge(bucketColor)}>{bucketLabel}</div>
      </div>

      {target.bucketReason && (
        <div style={targetReason}>{target.bucketReason}</div>
      )}

      <div style={targetMeta}>
        {target.contactName && (
          <div style={metaItem}>
            <span style={metaLabel}>Contact</span>
            <span style={metaValue}>{target.contactName}</span>
          </div>
        )}
        {target.contactPhone && (
          <div style={metaItem}>
            <span style={metaLabel}>Phone</span>
            <span style={metaValue}>{target.contactPhone}</span>
          </div>
        )}
        {target.followUpContext && (
          <div style={metaItem}>
            <span style={metaLabel}>Follow-up</span>
            <span style={metaValue}>{target.followUpContext}</span>
          </div>
        )}
        {target.followUpDueAt && (
          <div style={metaItem}>
            <span style={metaLabel}>Due</span>
            <span style={metaValue}>
              {new Date(target.followUpDueAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toLocalInputMin(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCallbackDateTime(cb: {
  dueAt: string;
  hasExplicitTime: boolean;
}): string {
  const d = new Date(cb.dueAt);
  const datePart = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!cb.hasExplicitTime) return datePart;
  const timePart = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function conflictOptionLabel(opt: string): string {
  switch (opt) {
    case 'reschedule-existing': return 'Reschedule';
    case 'update-existing': return 'Update';
    case 'override': return 'Override';
    case 'mark-complete': return 'Mark Complete';
    default: return opt;
  }
}

function phaseLabel(phase: PanelPhase): string {
  switch (phase) {
    case 'idle': return 'No Session';
    case 'ready': return 'Ready';
    case 'in_call': return 'In Call';
    case 'completing': return 'Completing';
    case 'blocked': return 'Blocked';
    case 'loading': return 'Loading';
    default: return '';
  }
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import type { CSSProperties } from 'react';

const panelWrap: CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
};

const panelCard: CSSProperties = {
  background: S.FC.surface,
  border: `1px solid ${S.FC.border}`,
  borderRadius: 12,
  padding: 24,
};

const headerBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 20,
};

const headerTitle: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: S.FC.textPrimary,
};

function headerBadge(phase: PanelPhase): CSSProperties {
  const colors: Record<PanelPhase, string> = {
    idle: S.FC.textMuted,
    ready: S.FC.accentBlue,
    in_call: S.FC.accentGreen,
    completing: S.FC.accentAmber,
    blocked: S.FC.accentRed,
    loading: S.FC.textMuted,
  };
  const bgs: Record<PanelPhase, string> = {
    idle: 'rgba(255,255,255,0.06)',
    ready: S.FC.accentBlueDim,
    in_call: S.FC.accentGreenDim,
    completing: S.FC.accentAmberDim,
    blocked: S.FC.accentRedDim,
    loading: 'rgba(255,255,255,0.06)',
  };
  return {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: colors[phase],
    background: bgs[phase],
  };
}

const errorBanner: CSSProperties = {
  background: S.FC.accentRedDim,
  border: `1px solid rgba(239, 68, 68, 0.3)`,
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: '0.8125rem',
  color: S.FC.accentRed,
  marginBottom: 16,
};

const emptyState: CSSProperties = {
  textAlign: 'center',
  padding: '24px 0',
};

const emptyIcon: CSSProperties = {
  fontSize: 40,
  marginBottom: 16,
};

const emptyTitle: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: S.FC.textPrimary,
  marginBottom: 8,
};

const emptyDesc: CSSProperties = {
  fontSize: '0.8125rem',
  color: S.FC.textMuted,
  maxWidth: 360,
  margin: '0 auto 24px',
  lineHeight: 1.5,
};

const activeCallHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 16,
};

const pulseIndicator: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: S.FC.accentGreen,
  boxShadow: `0 0 0 3px ${S.FC.accentGreenDim}`,
};

const blockedHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 16,
};

const targetCardWrap: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: `1px solid ${S.FC.border}`,
  borderRadius: 8,
  padding: 16,
};

const targetRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
};

const targetName: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: S.FC.textPrimary,
};

function bucketBadge(color: string): CSSProperties {
  return {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    color,
    background: `${color}22`,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };
}

const targetReason: CSSProperties = {
  fontSize: '0.8125rem',
  color: S.FC.textSecondary,
  marginBottom: 12,
  lineHeight: 1.4,
};

const targetMeta: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const metaItem: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const metaLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: S.FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const metaValue: CSSProperties = {
  fontSize: '0.8125rem',
  color: S.FC.textPrimary,
};

const deferSection: CSSProperties = {
  marginTop: 16,
  paddingTop: 16,
  borderTop: `1px solid ${S.FC.border}`,
};

const deferLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: S.FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 8,
};

const deferRow: CSSProperties = {
  display: 'flex',
  gap: 6,
};

const deferBtn: CSSProperties = {
  flex: 1,
  padding: '8px 0',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: `1px solid ${S.FC.border}`,
  borderRadius: 6,
  background: 'transparent',
  color: S.FC.textSecondary,
  cursor: 'pointer',
};

const deferBtnActive: CSSProperties = {
  borderColor: S.FC.accentBlue,
  color: S.FC.accentBlue,
};

const customDeferWrap: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 8,
  alignItems: 'center',
};

const customDeferInput: CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  fontSize: '0.8125rem',
  border: `1px solid ${S.FC.border}`,
  borderRadius: 6,
  background: S.FC.surface,
  color: S.FC.textPrimary,
  colorScheme: 'dark',
};

const conflictBanner: CSSProperties = {
  marginTop: 10,
  padding: 12,
  background: S.FC.accentAmberDim,
  border: `1px solid rgba(245, 158, 11, 0.3)`,
  borderRadius: 8,
};

const conflictBtn: CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  border: `1px solid rgba(245, 158, 11, 0.4)`,
  borderRadius: 4,
  background: 'transparent',
  color: S.FC.accentAmber,
  cursor: 'pointer',
};

const staleReviewSection: CSSProperties = {
  marginTop: 12,
  padding: 12,
  background: 'rgba(139, 92, 246, 0.06)',
  border: '1px solid rgba(139, 92, 246, 0.22)',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const staleReviewRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const reviewedNoContactBtn: CSSProperties = {
  width: '100%',
  marginTop: 4,
  padding: '10px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: S.FC.accentAmber,
  background: S.FC.accentAmberDim,
  border: '1px solid rgba(245, 158, 11, 0.35)',
  borderRadius: 6,
  cursor: 'pointer',
};

const viewCallbackBtn: CSSProperties = {
  width: '100%',
  padding: '9px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: S.FC.textSecondary,
  background: 'transparent',
  border: `1px solid ${S.FC.border}`,
  borderRadius: 6,
  cursor: 'pointer',
};

const durationPickerWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 0 2px',
};

const durationOptions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
};

const durationOption: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.8125rem',
  color: S.FC.textPrimary,
  cursor: 'pointer',
};

const customDaysWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const customDaysInput: CSSProperties = {
  width: 80,
  padding: '6px 10px',
  fontSize: '0.8125rem',
  border: `1px solid ${S.FC.border}`,
  borderRadius: 6,
  background: S.FC.surface,
  color: S.FC.textPrimary,
  colorScheme: 'dark',
};

const companyDetailBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 10,
  padding: '9px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: S.FC.accentPurple,
  background: 'rgba(139, 92, 246, 0.08)',
  border: '1px solid rgba(139, 92, 246, 0.22)',
  borderRadius: 6,
  cursor: 'pointer',
  textAlign: 'center' as const,
};



