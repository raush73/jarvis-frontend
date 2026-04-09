'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/api';

type Tab =
  | 'system-rules'
  | 'absence-continuity'
  | 'rescue-queue'
  | 'sales-admin-actions'
  | 'audit-log';

const TABS: { id: Tab; label: string }[] = [
  { id: 'system-rules', label: 'System Rules' },
  { id: 'absence-continuity', label: 'Absence & Continuity' },
  { id: 'rescue-queue', label: 'Rescue Queue' },
  { id: 'sales-admin-actions', label: 'Sales Admin Actions' },
  { id: 'audit-log', label: 'Audit Log' },
];

export default function FridayControlPanelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('system-rules');

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Friday Control Panel
      </h1>

      <nav style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'system-rules' && <SystemRulesSection />}
      {activeTab === 'absence-continuity' && <AbsenceContinuitySection />}
      {activeTab === 'rescue-queue' && <RescueQueueSection />}
      {activeTab === 'sales-admin-actions' && <SalesAdminActionsSection />}
      {activeTab === 'audit-log' && <AuditLogSection />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 1 — System Rules (Phase 3 — unchanged)
   ──────────────────────────────────────────────────────────────── */
function SystemRulesSection() {
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        System Rules
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <FieldGroup title="Scoring Weights">
          <MockField label="FOLLOW_UP_OVERDUE" value="100" />
          <MockField label="FOLLOW_UP_DUE" value="80" />
          <MockField label="ACTIVE_CONVERSATION" value="60" />
          <MockField label="NEW_LEAD" value="40" />
          <MockField label="STALE_OWNED" value="30" />
          <MockField label="RECYCLED_POOL" value="20" />
          <MockField label="STRATEGIC_TARGET" value="50" />
        </FieldGroup>
        <FieldGroup title="Ownership Timers">
          <MockField label="Default Ownership (days)" value="90" />
          <MockField label="Inactivity Threshold (days)" value="14" />
          <MockField label="Expiration Threshold (days)" value="30" />
          <MockField label="Expiration Behavior" value="FLAG" />
        </FieldGroup>
        <FieldGroup title="Activity Thresholds">
          <MockField label="Min Call Duration (sec)" value="60" />
          <MockField label="Stale Threshold (days)" value="60" />
          <MockField label="At Risk Threshold (days)" value="30" />
          <MockField label="Force Release (days)" value="90" />
        </FieldGroup>
        <FieldGroup title="System Switches">
          <MockField label="System Enabled" value="true" />
          <MockField label="Follow-up Enforced" value="true" />
          <MockField label="Absence Protection" value="false" />
          <MockField label="Call Pressure" value="NORMAL" />
          <MockField label="Rescue Threshold (min)" value="120" />
        </FieldGroup>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 2 — Absence & Continuity (Phase 4 — REAL)
   ──────────────────────────────────────────────────────────────── */

interface AbsenceRiskRow {
  userId: string;
  userName: string | null;
  totalAtRisk: number;
  overdueCount: number;
  followUps: any[];
}

interface AffectedFollowUp {
  id: string;
  customerId: string;
  customer: { id: string; name: string } | null;
  scheduledDate: string;
  scheduledTime: string | null;
  type: string;
  derivedStrictness: 'HARD' | 'SOFT';
  isResolved: boolean;
}

interface AbsenceResult {
  absence: { id: string; userId: string; startDate: string; endDate: string; status: string };
  affectedFollowUps: AffectedFollowUp[];
}

type CoverageAction = 'RESCHEDULE' | 'ASSIGN_BACKUP' | 'MOVE_TO_MANAGER' | 'MOVE_TO_SALES_ADMIN';

interface CoverageResolution {
  followUpId: string;
  action: CoverageAction;
  newDate?: string;
  backupUserId?: string;
}

function AbsenceContinuitySection() {
  const [riskData, setRiskData] = useState<AbsenceRiskRow[] | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdAbsence, setCreatedAbsence] = useState<AbsenceResult | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, CoverageResolution>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [formUserId, setFormUserId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  const [salespeople, setSalespeople] = useState<Array<{ id: string; name: string; userId: string | null }>>([]);

  const [rescueStats, setRescueStats] = useState<{ openCount: number; inProgressCount: number } | null>(null);

  const loadRisk = useCallback(async () => {
    setRiskLoading(true);
    setRiskError(null);
    try {
      const data = await apiFetch<AbsenceRiskRow[]>('/friday/control-panel/absences/risk?daysAhead=14');
      setRiskData(data);
    } catch (err: any) {
      setRiskError(err?.message ?? 'Failed to load absence risk data');
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const loadSalespeople = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>('/friday/control-panel/absences');
      setSalespeople(data.map((sp: any) => ({
        id: sp.salespersonId,
        name: sp.name,
        userId: sp.userId,
      })));
    } catch { /* non-critical */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch<{ openCount: number; inProgressCount: number; resolvedCount: number }>('/friday/continuity/rescue-queue/stats');
      setRescueStats(data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadRisk();
    loadSalespeople();
    loadStats();
  }, [loadRisk, loadSalespeople, loadStats]);

  const handleCreateAbsence = async () => {
    if (!formUserId || !formStartDate || !formEndDate) {
      setFormError('All fields are required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await apiFetch<AbsenceResult>('/friday/continuity/absences', {
        method: 'POST',
        body: JSON.stringify({ userId: formUserId, startDate: formStartDate, endDate: formEndDate }),
      });
      setCreatedAbsence(result);
      setResolutions(new Map());
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to create absence');
    } finally {
      setSubmitting(false);
    }
  };

  const updateResolution = (followUpId: string, field: Partial<CoverageResolution>) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      const existing = next.get(followUpId) ?? { followUpId, action: 'RESCHEDULE' as CoverageAction };
      next.set(followUpId, { ...existing, ...field });
      return next;
    });
  };

  const handleSubmitResolutions = async () => {
    if (!createdAbsence) return;
    const unresolvedItems = createdAbsence.affectedFollowUps.filter((fu) => !fu.isResolved);
    const resolvedAll = unresolvedItems.every((fu) => resolutions.has(fu.id));
    if (!resolvedAll) {
      setFormError('All affected follow-ups must have a resolution before submitting');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        absenceId: createdAbsence.absence.id,
        resolutions: Array.from(resolutions.values()).map((r) => ({
          followUpId: r.followUpId,
          action: r.action,
          ...(r.newDate ? { newDate: r.newDate } : {}),
          ...(r.backupUserId ? { backupUserId: r.backupUserId } : {}),
        })),
      };
      await apiFetch('/friday/continuity/absences/resolve-coverage', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const refreshed = await apiFetch<AffectedFollowUp[]>(
        `/friday/continuity/absences/${createdAbsence.absence.id}/affected`,
      );
      setCreatedAbsence((prev) => prev ? { ...prev, affectedFollowUps: refreshed } : prev);
      setResolutions(new Map());
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to resolve coverage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAbsence = async () => {
    if (!createdAbsence) return;
    setConfirming(true);
    setFormError(null);
    try {
      await apiFetch(`/friday/continuity/absences/${createdAbsence.absence.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setCreatedAbsence(null);
      setShowCreateForm(false);
      await loadRisk();
    } catch (err: any) {
      setFormError(err?.message ?? 'Cannot confirm — check all follow-ups are resolved');
    } finally {
      setConfirming(false);
    }
  };

  const allResolved = createdAbsence?.affectedFollowUps.every((fu) => fu.isResolved) ?? false;

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Absence & Continuity
      </h2>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="At-Risk Salespersons" value={riskData?.length ?? '—'} />
        <StatCard label="Rescue Queue (Open)" value={rescueStats?.openCount ?? '—'} />
        <StatCard label="Rescue Queue (In Progress)" value={rescueStats?.inProgressCount ?? '—'} />
      </div>

      {/* Create planned absence button */}
      {!showCreateForm && !createdAbsence && (
        <button onClick={() => setShowCreateForm(true)} style={primaryBtnStyle}>
          + Create Planned Absence
        </button>
      )}

      {/* Create form */}
      {showCreateForm && !createdAbsence && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>New Planned Absence</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Salesperson</label>
              <select value={formUserId} onChange={(e) => setFormUserId(e.target.value)} style={selectStyle}>
                <option value="" style={optionStyle}>Select...</option>
                {salespeople.filter((sp) => sp.userId).map((sp) => (
                  <option key={sp.userId!} value={sp.userId!} style={optionStyle}>{sp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {formError && <p style={errorStyle}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleCreateAbsence} disabled={submitting} style={primaryBtnStyle}>
              {submitting ? 'Creating...' : 'Create Absence'}
            </button>
            <button onClick={() => setShowCreateForm(false)} style={actionBtnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {/* Absence created — coverage resolution flow */}
      {createdAbsence && (
        <div style={{ border: '1px solid #d97706', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', background: '#fffbeb' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Absence Created — Resolve Coverage
          </h3>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            {createdAbsence.affectedFollowUps.length} follow-up(s) affected.
            {allResolved
              ? ' All resolved — you may confirm the absence.'
              : ' Each must be resolved before the absence can be confirmed.'}
          </p>

          {createdAbsence.affectedFollowUps.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Strictness</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {createdAbsence.affectedFollowUps.map((fu) => {
                  const res = resolutions.get(fu.id);
                  return (
                    <tr key={fu.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{fu.customer?.name ?? fu.customerId}</td>
                      <td style={tdStyle}>{new Date(fu.scheduledDate).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        <span style={{
                          color: fu.derivedStrictness === 'HARD' ? '#dc2626' : '#2563eb',
                          fontWeight: 600, fontSize: '0.75rem',
                        }}>
                          {fu.derivedStrictness}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {fu.isResolved
                          ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Resolved</span>
                          : <span style={{ color: '#d97706', fontWeight: 600 }}>Pending</span>}
                      </td>
                      <td style={tdStyle}>
                        {!fu.isResolved && (
                          <select
                            value={res?.action ?? ''}
                            onChange={(e) => updateResolution(fu.id, { followUpId: fu.id, action: e.target.value as CoverageAction })}
                            style={{ ...selectStyle, padding: '0.25rem', fontSize: '0.75rem' }}
                          >
                            <option value="" style={optionStyle}>Select...</option>
                            <option value="RESCHEDULE" style={optionStyle}>Reschedule</option>
                            <option value="ASSIGN_BACKUP" style={optionStyle}>Assign Backup</option>
                            <option value="MOVE_TO_MANAGER" style={optionStyle}>Move to Manager</option>
                            <option value="MOVE_TO_SALES_ADMIN" style={optionStyle}>Move to Sales Admin</option>
                          </select>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {!fu.isResolved && res?.action === 'RESCHEDULE' && (
                          <input
                            type="date"
                            value={res.newDate ?? ''}
                            onChange={(e) => updateResolution(fu.id, { newDate: e.target.value })}
                            style={{ ...inputStyle, padding: '0.25rem', fontSize: '0.75rem' }}
                          />
                        )}
                        {!fu.isResolved && res?.action === 'ASSIGN_BACKUP' && (
                          <select
                            value={res.backupUserId ?? ''}
                            onChange={(e) => updateResolution(fu.id, { backupUserId: e.target.value })}
                            style={{ ...selectStyle, padding: '0.25rem', fontSize: '0.75rem' }}
                          >
                            <option value="" style={optionStyle}>Select backup...</option>
                            {salespeople.filter((sp) => sp.userId && sp.userId !== createdAbsence.absence.userId).map((sp) => (
                              <option key={sp.userId!} value={sp.userId!} style={optionStyle}>{sp.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {formError && <p style={errorStyle}>{formError}</p>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!allResolved && (
              <button onClick={handleSubmitResolutions} disabled={submitting} style={primaryBtnStyle}>
                {submitting ? 'Submitting...' : 'Submit Resolutions'}
              </button>
            )}
            {allResolved && (
              <button onClick={handleConfirmAbsence} disabled={confirming} style={{ ...primaryBtnStyle, background: '#16a34a' }}>
                {confirming ? 'Confirming...' : 'Confirm Absence'}
              </button>
            )}
            <button
              onClick={() => { setCreatedAbsence(null); setShowCreateForm(false); setFormError(null); }}
              style={actionBtnStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Risk table */}
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.75rem' }}>
        Absence Risk Overview
      </h3>

      {riskLoading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading risk data...</p>}
      {riskError && <p style={errorStyle}>{riskError}</p>}
      {!riskLoading && !riskError && riskData && riskData.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No at-risk follow-ups in the next 14 days.</p>
      )}
      {!riskLoading && riskData && riskData.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Salesperson</th>
              <th style={thStyle}>At-Risk Follow-ups</th>
              <th style={thStyle}>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {riskData.map((row) => (
              <tr key={row.userId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{row.userName ?? row.userId}</td>
                <td style={tdStyle}>{row.totalAtRisk}</td>
                <td style={tdStyle}>
                  <span style={{ color: row.overdueCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    {row.overdueCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 3 — Rescue Queue (Phase 4 — REAL)
   ──────────────────────────────────────────────────────────────── */

interface RescueQueueItem {
  id: string;
  followUpId: string;
  coverageId: string;
  entryReason: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  assignedToId: string | null;
  resolvedById: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  followUp: {
    id: string;
    scheduledDate: string;
    scheduledTime: string | null;
    type: string;
    context: string | null;
    customer: { id: string; name: string } | null;
    user: { id: string; fullName: string | null } | null;
  };
  coverage: {
    id: string;
    escalationLevel: string;
    coverageStatus: string;
  };
  assignedTo: { id: string; fullName: string | null } | null;
  resolvedBy: { id: string; fullName: string | null } | null;
  derivedStrictness: 'HARD' | 'SOFT';
  derivedResponsibleParty: {
    userId: string;
    source: 'RESCUE_HANDLER' | 'BACKUP_OWNER' | 'FOLLOW_UP_OWNER';
  };
}

type RescueStatusFilter = '' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

function RescueQueueSection() {
  const [items, setItems] = useState<RescueQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RescueStatusFilter>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [assignModal, setAssignModal] = useState<{ itemId: string } | null>(null);
  const [assignHandlerId, setAssignHandlerId] = useState('');

  const [resolveModal, setResolveModal] = useState<{ itemId: string } | null>(null);
  const [resolveResolution, setResolveResolution] = useState('');
  const [resolveNewOwnerId, setResolveNewOwnerId] = useState('');
  const [resolveNote, setResolveNote] = useState('');

  const [salespeople, setSalespeople] = useState<Array<{ userId: string | null; name: string }>>([]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '100');
      const data = await apiFetch<{ items: RescueQueueItem[]; total: number }>(
        `/friday/continuity/rescue-queue?${params.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load rescue queue');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<any[]>('/friday/control-panel/absences');
        setSalespeople(data.map((sp: any) => ({ userId: sp.userId, name: sp.name })));
      } catch { /* non-critical */ }
    })();
  }, []);

  const handleAssign = async () => {
    if (!assignModal || !assignHandlerId) return;
    setActionLoading(assignModal.itemId);
    setActionError(null);
    try {
      await apiFetch('/friday/continuity/rescue-queue/assign', {
        method: 'POST',
        body: JSON.stringify({ itemId: assignModal.itemId, handlerId: assignHandlerId }),
      });
      setAssignModal(null);
      setAssignHandlerId('');
      await loadQueue();
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to assign handler');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal || !resolveResolution) return;
    setActionLoading(resolveModal.itemId);
    setActionError(null);
    try {
      await apiFetch('/friday/continuity/rescue-queue/resolve', {
        method: 'POST',
        body: JSON.stringify({
          itemId: resolveModal.itemId,
          resolution: resolveResolution,
          ...(resolveNewOwnerId ? { newOwnerId: resolveNewOwnerId } : {}),
          ...(resolveNote ? { note: resolveNote } : {}),
        }),
      });
      setResolveModal(null);
      setResolveResolution('');
      setResolveNewOwnerId('');
      setResolveNote('');
      await loadQueue();
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to resolve item');
    } finally {
      setActionLoading(null);
    }
  };

  const sourceLabel: Record<string, string> = {
    RESCUE_HANDLER: 'Rescue Handler',
    BACKUP_OWNER: 'Backup Owner',
    FOLLOW_UP_OWNER: 'Follow-up Owner',
  };

  const statusColor: Record<string, string> = {
    OPEN: '#d97706',
    IN_PROGRESS: '#2563eb',
    RESOLVED: '#16a34a',
  };

  const escalationColor: Record<string, string> = {
    SALESPERSON: '#6b7280',
    MANAGER: '#d97706',
    SALES_ADMIN: '#dc2626',
    SYSTEM: '#7c3aed',
  };

  function ageLabel(createdAt: string): string {
    const ms = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(ms / 3600000);
    if (hours < 1) return `${Math.floor(ms / 60000)}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Rescue Queue
      </h2>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RescueStatusFilter)}
          style={{ ...selectStyle, width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
        >
          <option value="" style={optionStyle}>All</option>
          <option value="OPEN" style={optionStyle}>Open</option>
          <option value="IN_PROGRESS" style={optionStyle}>In Progress</option>
          <option value="RESOLVED" style={optionStyle}>Resolved</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({total} total)</span>
      </div>

      {actionError && <p style={errorStyle}>{actionError}</p>}

      {loading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading rescue queue...</p>}
      {error && <p style={errorStyle}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No rescue queue items found.</p>
      )}

      {!loading && items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Owner</th>
              <th style={thStyle}>Due Date</th>
              <th style={thStyle}>Strictness</th>
              <th style={thStyle}>Escalation</th>
              <th style={thStyle}>Responsible Party</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Age</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{item.followUp.customer?.name ?? '—'}</td>
                <td style={tdStyle}>{item.followUp.user?.fullName ?? '—'}</td>
                <td style={tdStyle}>{new Date(item.followUp.scheduledDate).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <span style={{
                    color: item.derivedStrictness === 'HARD' ? '#dc2626' : '#2563eb',
                    fontWeight: 600, fontSize: '0.75rem',
                  }}>
                    {item.derivedStrictness}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    color: escalationColor[item.coverage.escalationLevel] ?? '#6b7280',
                    fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase',
                  }}>
                    {item.coverage.escalationLevel}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: '0.75rem' }}>
                    {salespeople.find((sp) => sp.userId === item.derivedResponsibleParty.userId)?.name
                      ?? item.derivedResponsibleParty.userId}
                    <br />
                    <span style={{ color: '#9ca3af' }}>
                      ({sourceLabel[item.derivedResponsibleParty.source] ?? item.derivedResponsibleParty.source})
                    </span>
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    color: statusColor[item.status] ?? '#6b7280',
                    fontWeight: 600, fontSize: '0.75rem',
                  }}>
                    {item.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {ageLabel(item.createdAt)}
                  </span>
                </td>
                <td style={{ ...tdStyle, display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {item.status === 'OPEN' && (
                    <button
                      onClick={() => { setAssignModal({ itemId: item.id }); setActionError(null); }}
                      disabled={actionLoading === item.id}
                      style={actionBtnStyle}
                    >
                      Assign
                    </button>
                  )}
                  {(item.status === 'OPEN' || item.status === 'IN_PROGRESS') && (
                    <button
                      onClick={() => { setResolveModal({ itemId: item.id }); setActionError(null); }}
                      disabled={actionLoading === item.id}
                      style={actionBtnStyle}
                    >
                      Resolve
                    </button>
                  )}
                  {item.status === 'RESOLVED' && (
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      {item.resolution?.replace(/_/g, ' ')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Assign Handler Modal */}
      {assignModal && (
        <ModalOverlay onClose={() => setAssignModal(null)}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>Assign Handler</h3>
          <select
            value={assignHandlerId}
            onChange={(e) => setAssignHandlerId(e.target.value)}
            style={{ ...selectStyle, marginBottom: '0.75rem' }}
          >
            <option value="" style={optionStyle}>Select handler...</option>
            {salespeople.filter((sp) => sp.userId).map((sp) => (
              <option key={sp.userId!} value={sp.userId!} style={optionStyle}>{sp.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleAssign} disabled={!assignHandlerId || !!actionLoading} style={primaryBtnStyle}>
              {actionLoading ? 'Assigning...' : 'Assign'}
            </button>
            <button onClick={() => setAssignModal(null)} style={actionBtnStyle}>Cancel</button>
          </div>
        </ModalOverlay>
      )}

      {/* Resolve Item Modal */}
      {resolveModal && (
        <ModalOverlay onClose={() => setResolveModal(null)}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>Resolve Rescue Item</h3>
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={labelStyle}>Resolution</label>
            <select value={resolveResolution} onChange={(e) => setResolveResolution(e.target.value)} style={selectStyle}>
              <option value="" style={optionStyle}>Select...</option>
              <option value="REASSIGNED_TO_NEW_OWNER" style={optionStyle}>Reassign to New Owner</option>
              <option value="RETURNED_TO_ORIGINAL_OWNER" style={optionStyle}>Return to Original Owner</option>
              <option value="ESCALATED_TO_MANAGER" style={optionStyle}>Escalate to Manager</option>
              <option value="RESOLVED_MANUALLY" style={optionStyle}>Resolve Manually</option>
            </select>
          </div>
          {resolveResolution === 'REASSIGNED_TO_NEW_OWNER' && (
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>New Owner</label>
              <select value={resolveNewOwnerId} onChange={(e) => setResolveNewOwnerId(e.target.value)} style={selectStyle}>
                <option value="" style={optionStyle}>Select...</option>
                {salespeople.filter((sp) => sp.userId).map((sp) => (
                  <option key={sp.userId!} value={sp.userId!} style={optionStyle}>{sp.name}</option>
                ))}
              </select>
            </div>
          )}
          {resolveResolution === 'RESOLVED_MANUALLY' && (
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>Note</label>
              <input
                type="text"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Resolution note..."
                style={inputStyle}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleResolve} disabled={!resolveResolution || !!actionLoading} style={primaryBtnStyle}>
              {actionLoading ? 'Resolving...' : 'Resolve'}
            </button>
            <button onClick={() => setResolveModal(null)} style={actionBtnStyle}>Cancel</button>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 4 — Sales Admin Actions (Phase 3 — unchanged)
   ──────────────────────────────────────────────────────────────── */
function SalesAdminActionsSection() {
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Sales Admin Actions
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <ActionCard title="Reassign Follow-up" description="Transfer a follow-up to a different salesperson." />
        <ActionCard title="Shift Due Date" description="Move the due date for a loose follow-up." />
        <ActionCard title="Move to Manager Queue" description="Escalate a follow-up to the manager queue." />
        <ActionCard title="Resolve Absence Coverage" description="Bulk-resolve uncovered follow-ups for an absent rep." />
        <ActionCard title="Move to Sales Admin Review" description="Flag a follow-up for sales admin review." />
        <ActionCard title="View Absence Risk" description="See upcoming absence impact across the team." />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 5 — Audit Log (Phase 3 — unchanged)
   ──────────────────────────────────────────────────────────────── */
function AuditLogSection() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ items: any[] }>('/friday/control-panel/admin-actions?limit=50');
        setLogs(data.items);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Audit Log
      </h2>
      {loading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>}
      {error && <p style={errorStyle}>{error}</p>}
      {!loading && logs && logs.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No audit log entries yet.</p>
      )}
      {!loading && logs && logs.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Performed By</th>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {log.actionType}
                </td>
                <td style={tdStyle}>{log.entityType} {log.entityId?.slice(0, 8)}</td>
                <td style={tdStyle}>{log.performedBy?.fullName ?? log.performedByUserId}</td>
                <td style={tdStyle}>{new Date(log.createdAt).toLocaleString()}</td>
                <td style={{ ...tdStyle, color: log.reason ? 'inherit' : '#9ca3af' }}>
                  {log.reason ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Shared UI primitives
   ──────────────────────────────────────────────────────────────── */

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {children}
      </div>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function ActionCard({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '1rem',
      cursor: 'pointer',
      transition: 'box-shadow 0.15s',
    }}>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>{title}</h4>
      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', minWidth: 140 }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 8, padding: '1.5rem',
          minWidth: 400, maxWidth: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.8125rem',
  border: 'none',
  borderRadius: 4,
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.375rem 0.5rem',
  fontSize: '0.8125rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: '#0f172a',
  color: '#ffffff',
  border: '1px solid #475569',
};

const optionStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.25rem',
};

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '0.8125rem',
  marginBottom: '0.5rem',
};

const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
