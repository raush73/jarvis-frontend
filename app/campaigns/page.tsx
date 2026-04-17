'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../lib/api';

/* ────────────── Types ────────────── */

interface Campaign {
  id: string;
  name: string;
  status: string;
  sourceType: string;
  pullTargetSize: number;
  createdAt: string;
  updatedAt: string;
}

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  searchQuery: string;
  targetStates: string[];
  targetIndustries: string[];
  targetSicCodes: string[];
  targetNaicsCodes: string[];
  targetEmployeeRange: string | null;
  targetRevenueRange: string | null;
  pullTargetSize: number;
  refillThreshold: number;
  refillAmount: number;
  notes: string | null;
  defaultOwnerId: string | null;
}

interface MemberRow {
  id: string;
  customerId: string;
  status: string;
  stagedAt: string;
  readyForPromotionAt: string | null;
  promotedAt: string | null;
  promotedById: string | null;
  promotionMethod: string | null;
  assignmentMethod: string | null;
  assignedOwnerId: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  revertedAt: string | null;
  revertedById: string | null;
  customer: {
    id: string;
    name: string;
    state: string | null;
    primaryIndustry: string | null;
    employeeRange: string | null;
    domain: string | null;
    phone: string | null;
    fridayOwnerId: string | null;
  };
}

type SortKey = 'name' | 'state' | 'industry' | 'employees' | 'domain';
type SortDir = 'asc' | 'desc';

/* ────────────── Page ────────────── */

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<CampaignDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberFilter, setMemberFilter] = useState<string>('STAGED');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [manualOwnerIds, setManualOwnerIds] = useState<Record<string, string>>({});

  // Create form
  const [formName, setFormName] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formStates, setFormStates] = useState('');
  const [formNaics, setFormNaics] = useState('');
  const [formSic, setFormSic] = useState('');
  const [formMinEmployees, setFormMinEmployees] = useState('');
  const [formMaxEmployees, setFormMaxEmployees] = useState('');
  const [formPullTargetSize, setFormPullTargetSize] = useState('50');
  const [formRefillThreshold, setFormRefillThreshold] = useState('25');
  const [formRefillAmount, setFormRefillAmount] = useState('25');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  /* ── Data loading ── */

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Campaign[]>('/campaigns');
      setCampaigns(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const loadMembers = useCallback(async (campaignId: string, status: string) => {
    setMembersLoading(true);
    try {
      const qs = status ? `?status=${status}` : '';
      const data = await apiFetch<MemberRow[]>(`/campaigns/${campaignId}/members${qs}`);
      setMembers(data);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (campaignId: string) => {
    try {
      const detail = await apiFetch<CampaignDetail>(`/campaigns/${campaignId}`);
      setDetailData(detail);
    } catch {
      setDetailData(null);
    }
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetailData(null);
      setMembers([]);
    } else {
      setExpandedId(id);
      setMemberFilter('STAGED');
      loadDetail(id);
      loadMembers(id, 'STAGED');
    }
  };

  const handleFilterChange = (status: string) => {
    setMemberFilter(status);
    if (expandedId) loadMembers(expandedId, status);
  };

  /* ── Sorting ── */

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      let va = '';
      let vb = '';
      switch (sortKey) {
        case 'name': va = a.customer.name ?? ''; vb = b.customer.name ?? ''; break;
        case 'state': va = a.customer.state ?? ''; vb = b.customer.state ?? ''; break;
        case 'industry': va = a.customer.primaryIndustry ?? ''; vb = b.customer.primaryIndustry ?? ''; break;
        case 'employees': va = a.customer.employeeRange ?? ''; vb = b.customer.employeeRange ?? ''; break;
        case 'domain': va = a.customer.domain ?? ''; vb = b.customer.domain ?? ''; break;
      }
      const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [members, sortKey, sortDir]);

  /* ── Create campaign ── */

  const handleCreate = async () => {
    if (!formName || !formKeywords) {
      setFormError('Name and keywords are required');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);

    const splitCsv = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean);
    let employeeRange: string | undefined;
    if (formMinEmployees || formMaxEmployees) {
      employeeRange = `${formMinEmployees || '0'}-${formMaxEmployees || ''}`;
    }

    try {
      await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          searchQuery: formKeywords,
          targetStates: splitCsv(formStates),
          targetIndustries: [],
          targetSicCodes: splitCsv(formSic),
          targetNaicsCodes: splitCsv(formNaics),
          targetEmployeeRange: employeeRange ?? null,
          targetRevenueRange: null,
          pullTargetSize: parseInt(formPullTargetSize, 10) || 50,
          refillThreshold: parseInt(formRefillThreshold, 10) || 25,
          refillAmount: parseInt(formRefillAmount, 10) || 25,
        }),
      });
      setShowCreate(false);
      resetForm();
      setActionResult({ ok: true, text: 'Campaign created successfully' });
      await loadCampaigns();
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to create campaign');
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName(''); setFormKeywords(''); setFormStates(''); setFormNaics('');
    setFormSic(''); setFormMinEmployees(''); setFormMaxEmployees('');
    setFormPullTargetSize('50'); setFormRefillThreshold('25'); setFormRefillAmount('25');
    setFormError(null);
  };

  /* ── Actions ── */

  const runAction = async (campaignId: string, action: string, body?: object) => {
    const key = `${campaignId}-${action}`;
    setActionLoading(key);
    setActionResult(null);
    try {
      const result = await apiFetch<any>(`/campaigns/${campaignId}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : JSON.stringify({}),
      });
      setActionResult({ ok: true, text: formatResult(action, result) });
      await loadCampaigns();
      if (expandedId === campaignId) {
        loadMembers(campaignId, memberFilter);
      }
    } catch (err: any) {
      setActionResult({ ok: false, text: err?.message ?? 'Action failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (
    campaignId: string,
    customerId: string,
    assignMode: 'none' | 'campaign_default' | 'manual',
    manualOwnerId?: string,
  ) => {
    await runAction(campaignId, 'promote', {
      customerId,
      assignMode,
      ...(manualOwnerId ? { manualOwnerId } : {}),
    });
    setManualOwnerIds((prev) => { const next = { ...prev }; delete next[customerId]; return next; });
  };

  const handleRevert = async (campaignId: string, customerId: string) => {
    await runAction(campaignId, 'revert', { customerId });
  };

  const handleAutoPromote = async (campaignId: string) => {
    await runAction(campaignId, 'auto-promote');
  };

  const handleReject = async (campaignId: string, customerId: string) => {
    const reason = rejectReasons[customerId];
    if (!reason) {
      setActionResult({ ok: false, text: 'Enter a reject reason before rejecting' });
      return;
    }
    await runAction(campaignId, 'reject', { customerId, reason });
    setRejectReasons((prev) => { const next = { ...prev }; delete next[customerId]; return next; });
  };

  const changeStatus = async (campaignId: string, newStatus: string) => {
    const key = `${campaignId}-status`;
    setActionLoading(key);
    setActionResult(null);
    try {
      await apiFetch(`/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const label = newStatus === 'ACTIVE' ? 'Activated' : newStatus === 'PAUSED' ? 'Paused' : newStatus;
      setActionResult({ ok: true, text: `Campaign ${label}` });
      await loadCampaigns();
    } catch (err: any) {
      setActionResult({ ok: false, text: err?.message ?? 'Status change failed' });
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Counts from loaded members (avoid extra API call) ── */

  const stagedCount = members.filter((m) => m.status === 'STAGED').length;
  const promotedCount = members.filter((m) => m.status === 'PROMOTED').length;
  const rejectedCount = members.filter((m) => m.status === 'REJECTED').length;

  /* ────────────── RENDER ────────────── */

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto', color: '#ffffff' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Campaign Manager</h1>
        <p style={{ fontSize: '0.8125rem', color: '#d1d5db', margin: '0.25rem 0 0 0' }}>
          Create campaigns, pull from ZoomInfo, review staged companies, promote or reject
        </p>
      </div>

      {/* ── ACTION RESULT BANNER ── */}
      {actionResult && (
        <div style={{
          padding: '0.625rem 0.75rem', marginBottom: '1.25rem', borderRadius: 6,
          background: actionResult.ok ? '#052e16' : '#450a0a',
          border: `1px solid ${actionResult.ok ? '#16a34a' : '#dc2626'}`,
          fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          color: '#ffffff',
        }}>
          <span style={{ wordBreak: 'break-word', flex: 1 }}>
            <strong style={{ color: actionResult.ok ? '#4ade80' : '#f87171' }}>
              {actionResult.ok ? 'Success' : 'Error'}
            </strong>
            {' — '}{actionResult.text}
          </span>
          <button onClick={() => setActionResult(null)} style={dismissBtnStyle}>x</button>
        </div>
      )}

      {/* ── STEP 1: CREATE CAMPAIGN ── */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCreate ? '1rem' : 0 }}>
          <div>
            <h2 style={stepHeaderStyle}>Step 1: Create Campaign</h2>
            <p style={stepSubStyle}>Define targeting criteria for ZoomInfo intake</p>
          </div>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} style={primaryBtnStyle}>+ New Campaign</button>
          )}
        </div>

        {showCreate && (
          <div style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Campaign Name</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Kentucky Millwrights Q2" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Keywords</label>
                <input value={formKeywords} onChange={(e) => setFormKeywords(e.target.value)} placeholder="ZoomInfo search keywords" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>States <span style={hintStyle}>(comma-separated)</span></label>
                <input value={formStates} onChange={(e) => setFormStates(e.target.value)} placeholder="KY, OH, IN" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>NAICS Codes <span style={hintStyle}>(comma-separated)</span></label>
                <input value={formNaics} onChange={(e) => setFormNaics(e.target.value)} placeholder="238220, 332312" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>SIC Codes <span style={hintStyle}>(comma-separated)</span></label>
                <input value={formSic} onChange={(e) => setFormSic(e.target.value)} placeholder="1711, 3443" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={labelStyle}>Min Employees</label>
                  <input type="number" value={formMinEmployees} onChange={(e) => setFormMinEmployees(e.target.value)} placeholder="10" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Max Employees</label>
                  <input type="number" value={formMaxEmployees} onChange={(e) => setFormMaxEmployees(e.target.value)} placeholder="500" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Pull Target Size</label>
                <input type="number" value={formPullTargetSize} onChange={(e) => setFormPullTargetSize(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={labelStyle}>Refill Threshold</label>
                  <input type="number" value={formRefillThreshold} onChange={(e) => setFormRefillThreshold(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Refill Amount</label>
                  <input type="number" value={formRefillAmount} onChange={(e) => setFormRefillAmount(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
            {formError && <p style={errorStyle}>{formError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleCreate} disabled={formSubmitting} style={primaryBtnStyle}>
                {formSubmitting ? 'Creating...' : 'Create Campaign'}
              </button>
              <button onClick={() => { setShowCreate(false); resetForm(); }} style={secondaryBtnStyle}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* ── STEP 2: CAMPAIGN LIST ── */}
      <section style={sectionStyle}>
        <h2 style={stepHeaderStyle}>Step 2: Run Pull / Refill</h2>
        <p style={stepSubStyle}>Execute ZoomInfo pulls and manage campaign inventory</p>

        {loading && <p style={{ color: '#d1d5db', fontSize: '0.875rem', marginTop: '0.75rem' }}>Loading campaigns...</p>}
        {error && <p style={errorStyle}>{error}</p>}
        {!loading && !error && campaigns.length === 0 && (
          <p style={{ color: '#d1d5db', fontSize: '0.875rem', marginTop: '0.75rem' }}>No campaigns yet. Create one above.</p>
        )}

        {!loading && campaigns.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ border: '1px solid #374151', borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden' }}>
                {/* Campaign row */}
                <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <StatusBadge status={c.status} />
                    {c.status === 'DRAFT' && (
                      <button
                        onClick={() => changeStatus(c.id, 'ACTIVE')}
                        disabled={!!actionLoading}
                        style={actionLoading === `${c.id}-status`
                          ? { ...statusBtnActivateStyle, opacity: 0.5 }
                          : statusBtnActivateStyle}
                      >
                        {actionLoading === `${c.id}-status` ? '...' : 'Activate'}
                      </button>
                    )}
                    {c.status === 'ACTIVE' && (
                      <button
                        onClick={() => changeStatus(c.id, 'PAUSED')}
                        disabled={!!actionLoading}
                        style={actionLoading === `${c.id}-status`
                          ? { ...statusBtnPauseStyle, opacity: 0.5 }
                          : statusBtnPauseStyle}
                      >
                        {actionLoading === `${c.id}-status` ? '...' : 'Pause'}
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button
                        onClick={() => changeStatus(c.id, 'ACTIVE')}
                        disabled={!!actionLoading}
                        style={actionLoading === `${c.id}-status`
                          ? { ...statusBtnActivateStyle, opacity: 0.5 }
                          : statusBtnActivateStyle}
                      >
                        {actionLoading === `${c.id}-status` ? '...' : 'Resume'}
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>{c.pullTargetSize}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#d1d5db' }}>Pull Size</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => runAction(c.id, 'run-pull')}
                      disabled={!!actionLoading}
                      style={actionLoading === `${c.id}-run-pull` ? { ...actionBtnStyle, opacity: 0.5 } : actionBtnStyle}
                    >
                      {actionLoading === `${c.id}-run-pull` ? 'Pulling...' : 'Run Pull'}
                    </button>
                    <button
                      onClick={() => runAction(c.id, 'refill')}
                      disabled={!!actionLoading}
                      style={actionLoading === `${c.id}-refill` ? { ...actionBtnStyle, opacity: 0.5 } : actionBtnStyle}
                    >
                      {actionLoading === `${c.id}-refill` ? 'Refilling...' : 'Refill'}
                    </button>
                    <button
                      onClick={() => toggleExpand(c.id)}
                      style={{
                        ...actionBtnStyle,
                        background: expandedId === c.id ? '#1e3a5f' : '#1f2937',
                        borderColor: expandedId === c.id ? '#3b82f6' : '#4b5563',
                        color: expandedId === c.id ? '#93c5fd' : '#e5e7eb',
                      }}
                    >
                      {expandedId === c.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                </div>

                {/* ── EXPANDED DETAIL + MEMBERS TABLE ── */}
                {expandedId === c.id && (
                  <div style={{ borderTop: '1px solid #374151', background: '#111827' }}>
                    {/* Campaign config summary */}
                    {detailData && (
                      <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: '#e5e7eb' }}>
                        <div><strong style={{ color: '#ffffff' }}>Search:</strong> {detailData.searchQuery}</div>
                        {detailData.targetStates.length > 0 && <div><strong style={{ color: '#ffffff' }}>States:</strong> {detailData.targetStates.join(', ')}</div>}
                        {detailData.targetNaicsCodes.length > 0 && <div><strong style={{ color: '#ffffff' }}>NAICS:</strong> {detailData.targetNaicsCodes.join(', ')}</div>}
                        {detailData.targetSicCodes.length > 0 && <div><strong style={{ color: '#ffffff' }}>SIC:</strong> {detailData.targetSicCodes.join(', ')}</div>}
                        {detailData.targetEmployeeRange && <div><strong style={{ color: '#ffffff' }}>Employees:</strong> {detailData.targetEmployeeRange}</div>}
                        <div><strong style={{ color: '#ffffff' }}>Refill:</strong> {detailData.refillThreshold} threshold / {detailData.refillAmount} amount</div>
                        <div>
                          <strong style={{ color: '#ffffff' }}>Default Owner:</strong>{' '}
                          {detailData.defaultOwnerId
                            ? <span style={{ color: '#93c5fd' }}>Assigned <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>(ID: {detailData.defaultOwnerId})</span></span>
                            : <span style={{ color: '#6b7280' }}>None</span>}
                        </div>
                      </div>
                    )}

                    {/* Auto-Promote action */}
                    <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleAutoPromote(c.id)}
                        disabled={!!actionLoading}
                        style={actionLoading === `${c.id}-auto-promote`
                          ? { ...primaryBtnStyle, fontSize: '0.75rem', opacity: 0.5 }
                          : { ...primaryBtnStyle, fontSize: '0.75rem' }}
                      >
                        {actionLoading === `${c.id}-auto-promote` ? 'Running...' : 'Auto-Promote All Eligible'}
                      </button>
                      <span style={{ fontSize: '0.6875rem', color: '#d1d5db' }}>
                        Evaluates STAGED, promotes eligible{detailData?.defaultOwnerId ? ' (assigns to campaign default owner)' : ' (unassigned)'}
                      </span>
                    </div>

                    {/* Filter tabs */}
                    <div style={{ padding: '0 1rem', display: 'flex', gap: '0.25rem', borderBottom: '1px solid #374151' }}>
                      {(['STAGED', 'READY_FOR_PROMOTION', 'PROMOTED', 'REJECTED', ''] as const).map((f) => {
                        const label = f === 'READY_FOR_PROMOTION' ? 'READY' : f || 'ALL';
                        const isActive = memberFilter === f;
                        return (
                          <button
                            key={label}
                            onClick={() => handleFilterChange(f)}
                            style={{
                              padding: '0.375rem 0.75rem', border: 'none', cursor: 'pointer',
                              background: 'none', fontSize: '0.75rem', fontWeight: isActive ? 700 : 400,
                              color: isActive ? '#93c5fd' : '#d1d5db',
                              borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#d1d5db', alignSelf: 'center' }}>
                        {members.length} shown
                      </span>
                    </div>

                    {/* Members table */}
                    <div style={{ padding: '0 1rem 0.75rem' }}>
                      {membersLoading && <p style={{ fontSize: '0.8125rem', color: '#d1d5db', padding: '0.5rem 0' }}>Loading members...</p>}

                      {!membersLoading && members.length === 0 && (
                        <p style={{ fontSize: '0.8125rem', color: '#d1d5db', padding: '0.5rem 0' }}>
                          No members with status {memberFilter || 'any'}. Run a pull to populate.
                        </p>
                      )}

                      {!membersLoading && members.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginTop: '0.5rem', color: '#e5e7eb' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #374151', textAlign: 'left' }}>
                              <SortTh label="Company" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} />
                              <SortTh label="State" sortKey="state" current={sortKey} dir={sortDir} onClick={toggleSort} />
                              <SortTh label="Industry" sortKey="industry" current={sortKey} dir={sortDir} onClick={toggleSort} />
                              <SortTh label="Employees" sortKey="employees" current={sortKey} dir={sortDir} onClick={toggleSort} />
                              <SortTh label="Domain" sortKey="domain" current={sortKey} dir={sortDir} onClick={toggleSort} />
                              <th style={thStyle}>Phone</th>
                              <th style={thStyle}>Status</th>
                              {(memberFilter === 'STAGED' || memberFilter === 'READY_FOR_PROMOTION' || memberFilter === 'REJECTED') && (
                                <th style={thStyle}>Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedMembers.map((m) => (
                              <tr key={m.id} style={{ borderBottom: '1px solid #1f2937' }}>
                                <td style={tdStyle}>{m.customer.name}</td>
                                <td style={tdStyle}>{m.customer.state ?? '—'}</td>
                                <td style={tdStyle}>{m.customer.primaryIndustry ?? '—'}</td>
                                <td style={tdStyle}>{m.customer.employeeRange ?? '—'}</td>
                                <td style={tdStyle}>
                                  {m.customer.domain
                                    ? <span style={{ color: '#93c5fd', fontSize: '0.75rem' }}>{m.customer.domain}</span>
                                    : '—'}
                                </td>
                                <td style={tdStyle}>
                                  {m.customer.phone
                                    ? <span style={{ fontSize: '0.75rem' }}>{m.customer.phone}</span>
                                    : <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>none</span>}
                                </td>
                                <td style={tdStyle}><MemberStatusBadge status={m.status} /></td>
                                {(memberFilter === 'STAGED' || memberFilter === 'READY_FOR_PROMOTION') && (
                                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <button
                                        onClick={() => handlePromote(c.id, m.customerId, 'none')}
                                        disabled={!!actionLoading}
                                        style={{ ...actionBtnStyle, color: '#4ade80', borderColor: '#166534' }}
                                      >
                                        Promote
                                      </button>
                                      {detailData?.defaultOwnerId && (
                                        <button
                                          onClick={() => handlePromote(c.id, m.customerId, 'campaign_default')}
                                          disabled={!!actionLoading}
                                          style={{ ...actionBtnStyle, color: '#93c5fd', borderColor: '#1e3a5f' }}
                                        >
                                          → Owner
                                        </button>
                                      )}
                                      <input
                                        value={manualOwnerIds[m.customerId] ?? ''}
                                        onChange={(e) => setManualOwnerIds((prev) => ({ ...prev, [m.customerId]: e.target.value }))}
                                        placeholder="Manual Rep User ID"
                                        title="Enter the User ID of the rep to assign ownership"
                                        style={{ ...inputStyle, width: 120, padding: '0.125rem 0.25rem', fontSize: '0.6875rem' }}
                                      />
                                      <button
                                        onClick={() => {
                                          const ownerId = manualOwnerIds[m.customerId];
                                          if (ownerId) handlePromote(c.id, m.customerId, 'manual', ownerId);
                                        }}
                                        disabled={!!actionLoading || !manualOwnerIds[m.customerId]}
                                        style={{ ...actionBtnStyle, color: '#c4b5fd', borderColor: '#4c1d95', opacity: manualOwnerIds[m.customerId] ? 1 : 0.4 }}
                                      >
                                        Assign Rep
                                      </button>
                                      <span style={{ borderLeft: '1px solid #374151', height: 16, margin: '0 0.125rem' }} />
                                      <input
                                        value={rejectReasons[m.customerId] ?? ''}
                                        onChange={(e) => setRejectReasons((prev) => ({ ...prev, [m.customerId]: e.target.value }))}
                                        placeholder="Reason..."
                                        style={{ ...inputStyle, width: 90, padding: '0.125rem 0.25rem', fontSize: '0.6875rem' }}
                                      />
                                      <button
                                        onClick={() => handleReject(c.id, m.customerId)}
                                        disabled={!!actionLoading}
                                        style={{ ...actionBtnStyle, color: '#f87171', borderColor: '#7f1d1d' }}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </td>
                                )}
                                {memberFilter === 'REJECTED' && (
                                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                    <button
                                      onClick={() => handleRevert(c.id, m.customerId)}
                                      disabled={!!actionLoading}
                                      style={{ ...actionBtnStyle, color: '#fbbf24', borderColor: '#92400e' }}
                                    >
                                      Revert to Staged
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ────────────── Sub-components ────────────── */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    ACTIVE: { bg: '#052e16', fg: '#4ade80' },
    DRAFT: { bg: '#422006', fg: '#fbbf24' },
    PAUSED: { bg: '#1e1b4b', fg: '#a5b4fc' },
    COMPLETED: { bg: '#1f2937', fg: '#d1d5db' },
    ARCHIVED: { bg: '#1f2937', fg: '#9ca3af' },
  };
  const c = colors[status] ?? colors.ARCHIVED!;
  return (
    <span style={{
      display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: 9999,
      fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.025em',
      background: c.bg, color: c.fg,
    }}>
      {status}
    </span>
  );
}

function MemberStatusBadge({ status }: { status: string }) {
  const display = status === 'READY_FOR_PROMOTION' ? 'READY' : status;
  const colors: Record<string, string> = {
    STAGED: '#fbbf24',
    READY_FOR_PROMOTION: '#38bdf8',
    PROMOTED: '#4ade80',
    REJECTED: '#f87171',
    REMOVED: '#9ca3af',
  };
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: colors[status] ?? '#d1d5db' }}>
      {display}
    </span>
  );
}

function SortTh({ label, sortKey, current, dir, onClick }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const isActive = current === sortKey;
  const arrow = isActive ? (dir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return (
    <th
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', color: isActive ? '#93c5fd' : '#e5e7eb' }}
      onClick={() => onClick(sortKey)}
    >
      {label}{arrow}
    </th>
  );
}

function formatResult(action: string, result: any): string {
  if (result?.success === true) {
    if (action === 'promote') {
      const owner = result.assignedOwnerId ? ` (assigned to ${result.assignedOwnerId})` : ' (unassigned)';
      return `Promoted${owner}`;
    }
    if (action === 'reject') return 'Rejected';
    if (action === 'revert') return 'Reverted to Staged';
    return 'Done';
  }
  if (result?.evaluated !== undefined) {
    return `Auto-promote: ${result.readied ?? 0} readied, ${result.promoted ?? 0} promoted, ${result.skipped ?? 0} skipped`;
  }
  if (result?.executed === false) return `Refill skipped — inventory sufficient (${result.totalActive}/${result.refillThreshold})`;
  if (result?.executed === true) return `Refilled — ${result.summary?.campaignMembersCreated ?? 0} new members staged`;
  if (result?.campaignMembersCreated !== undefined) {
    return `${result.recordsFound ?? 0} found, ${result.recordsCreated ?? 0} created, ${result.campaignMembersCreated} members staged`;
  }
  return JSON.stringify(result);
}

/* ────────────── Styles ────────────── */

const sectionStyle: React.CSSProperties = { marginBottom: '2rem' };

const stepHeaderStyle: React.CSSProperties = {
  fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#ffffff',
};

const stepSubStyle: React.CSSProperties = {
  fontSize: '0.75rem', color: '#d1d5db', margin: '0.125rem 0 0 0',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #374151', borderRadius: 8, padding: '1rem', background: '#111827',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem', fontSize: '0.8125rem', border: 'none', borderRadius: 4,
  background: '#2563eb', color: '#ffffff', cursor: 'pointer', fontWeight: 600,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #4b5563',
  borderRadius: 4, background: '#1f2937', color: '#e5e7eb', cursor: 'pointer', fontWeight: 500,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '0.3125rem 0.625rem', fontSize: '0.75rem', border: '1px solid #4b5563',
  borderRadius: 4, background: '#1f2937', color: '#e5e7eb', cursor: 'pointer', fontWeight: 500,
};

const dismissBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700,
  fontSize: '1rem', lineHeight: 1, padding: '0 0 0 0.5rem', color: '#d1d5db',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem',
  border: '1px solid #4b5563', borderRadius: 4, background: '#0f172a', color: '#ffffff',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem',
};

const hintStyle: React.CSSProperties = { fontWeight: 400, color: '#d1d5db' };

const errorStyle: React.CSSProperties = {
  color: '#f87171', fontSize: '0.8125rem', marginBottom: '0.5rem',
};

const statusBtnActivateStyle: React.CSSProperties = {
  padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 4,
  border: '1px solid #166534', background: '#052e16', color: '#4ade80', cursor: 'pointer',
};

const statusBtnPauseStyle: React.CSSProperties = {
  padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 4,
  border: '1px solid #92400e', background: '#422006', color: '#fbbf24', cursor: 'pointer',
};

const thStyle: React.CSSProperties = { padding: '0.5rem', fontSize: '0.75rem', color: '#e5e7eb' };
const tdStyle: React.CSSProperties = { padding: '0.5rem', color: '#e5e7eb' };
