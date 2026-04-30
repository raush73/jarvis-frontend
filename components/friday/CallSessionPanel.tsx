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
  BUCKET_LABELS,
  BUCKET_COLORS,
} from './types';

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

  const mountedRef = useRef(true);
  const directConsumedRef = useRef(false);

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
      fridayFetch<CompanyContact[]>(`/friday/contacts/company/${customerId}`),
      fridayFetch<FollowUp[]>(`/friday/follow-ups/company/${customerId}?status=OPEN`),
    ]);
    if (mountedRef.current) {
      setContacts(cRes.ok ? cRes.data : []);
      setFollowUps(fRes.ok ? fRes.data : []);
    }
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────

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
      setPhase('blocked');
    }
  };

  const handleReopenGate = async () => {
    if (!target?.customerId) return;
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

  // ─── Rendering ────────────────────────────────────────────────────

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

      {/* IDLE — No session */}
      {phase === 'idle' && (
        <div style={panelCard}>
          <div style={emptyState}>
            <div style={emptyIcon}>📞</div>
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

      {/* READY — Next call target loaded */}
      {phase === 'ready' && target && (
        <div style={panelCard}>
          <TargetCard target={target} />
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button
              style={{ ...S.btnPrimary, flex: 1, padding: '12px 16px', fontSize: '0.9375rem' }}
              onClick={handleStartCall}
              disabled={busy}
            >
              {busy ? 'Connecting...' : 'Start Call'}
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
            <div style={emptyIcon}>✅</div>
            <div style={emptyTitle}>Queue Clear</div>
            <div style={emptyDesc}>
              {emptyReason === 'outside_callable_hours'
                ? 'All calls are outside business hours right now.'
                : 'No calls available right now.'}
            </div>
          </div>
        </div>
      )}

      {/* IN_CALL — Active call */}
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

      {/* COMPLETING — CallCompletionGate overlay */}
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

      {/* BLOCKED — Must complete before continuing */}
      {phase === 'blocked' && (
        <div style={{ ...panelCard, borderColor: S.FC.accentRed }}>
          <div style={blockedHeader}>
            <div style={{ fontSize: 24 }}>⚠️</div>
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

// ─── Sub-components ─────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────

function toLocalInputMin(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

// ─── Styles ─────────────────────────────────────────────────────────

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
