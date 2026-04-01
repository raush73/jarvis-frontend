'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bucket,
  BucketId,
  Candidate,
  Trade,
  getBucketTradeBreakdown,
  getOpenSlots,
  CustomerApprovalStatusType,
  CertSignalItem,
  ComplianceSignalItem,
  PpeSignalItem,
  ToolSignalItem,
} from '@/data/mockRecruitingData';
import { BucketTradeSummary } from '@/components/BucketTradeSummary';
import { useAuth } from "@/lib/auth/useAuth";
import { EventSpineTimelineSnapshot } from "@/components/EventSpineTimelineSnapshot";
import { apiFetch, getAccessToken } from '@/lib/api';
import { useVettingData } from './useVettingData';
import { AddCandidateModal } from '@/components/vetting/AddCandidateModal';

const SELECTABLE_BUCKETS = new Set<BucketId>([
  'OPTED_IN',
  'AWAITING_CANDIDATE_ACTION',
  'MW4H_APPROVED',
  'PRE_DISPATCH',
]);

type VettingActionType =
  | 'ADVANCE_TO_AWAITING_ACTION'
  | 'APPROVE_MW4H'
  | 'MOVE_TO_PRE_DISPATCH';

const FORWARD_ACTION: Partial<Record<BucketId, VettingActionType>> = {
  OPTED_IN: 'ADVANCE_TO_AWAITING_ACTION',
  AWAITING_CANDIDATE_ACTION: 'APPROVE_MW4H',
  MW4H_APPROVED: 'MOVE_TO_PRE_DISPATCH',
};

function getCurrentUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Vetting Page — Phase 8 Governance-Aligned Buckets
 *
 * CANONICAL BUCKET NAMES (governance-aligned):
 * 1. OPTED_IN
 * 2. AWAITING_CANDIDATE_ACTION
 * 3. MW4H_APPROVED
 * 4. PRE_DISPATCH
 * 5. DISPATCHED
 * 6. CLOSED
 *
 * Customer Approval is a GATE (side panel), not a bucket.
 * Exceptions lane is preserved as a UI placeholder (not yet backed by status).
 */

const LANE_NAMES: Record<string, { name: string; description: string }> = {
  OPTED_IN: { name: 'Opted-In', description: 'Candidates who opted in for this specific job' },
  AWAITING_CANDIDATE_ACTION: { name: 'Awaiting Candidate Action', description: 'Worker-blocked: docs, certs, reconfirm needed' },
  MW4H_APPROVED: { name: 'MW4H Approved', description: 'Approved candidates ready for consideration' },
  PRE_DISPATCH: { name: 'Pre-Dispatch', description: 'Ready for dispatch assignment' },
  DISPATCHED: { name: 'Dispatched', description: 'Actively dispatched to job site' },
  CLOSED: { name: 'Closed', description: 'Out of active recruiting flow' },
};


// Mock No-Show candidates
const MOCK_NO_SHOWS: Candidate[] = [
  {
    id: 'noshow_001',
    name: 'Carlos Mendez',
    tradeId: 'trade_elec',
    tradeName: 'Electrician',
    phone: '(555) 999-1111',
    email: 'carlos.m@email.com',
    distance: 15,
    sourceType: 'recruiter',
    certifications: [
      { id: 'cert_ns1', name: 'Journeyman Electrician', verified: true },
    ],
    availability: 'available',
    dispatchStartDate: '2026-01-27',
  },
];

// Source type labels for badges
const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  system: { label: 'Jarvis Match', icon: '🤖' },
  recruiter: { label: 'Manual', icon: '👤' },
  roadtechs: { label: 'Roadtechs', icon: '🛣️' },
};

function getReadinessSignal(candidate: Candidate): { color: 'green' | 'yellow' | 'red'; label: string } {
  if (!candidate.signals) {
    return { color: 'yellow', label: 'No data' };
  }
  switch (candidate.signals.readiness) {
    case 'READY':
      return { color: 'green', label: 'Ready' };
    case 'PENDING':
      return { color: 'yellow', label: 'Pending' };
    case 'BLOCKED':
      return { color: 'red', label: 'Blocked' };
    default:
      return { color: 'yellow', label: 'Unknown' };
  }
}

function getEligibilitySummary(candidate: Candidate): { met: number; total: number; blockers: number } {
  if (!candidate.signals) {
    return { met: 0, total: 0, blockers: 0 };
  }
  const { hardGates, softSignals } = candidate.signals;
  const met = hardGates.certifications.met + hardGates.compliance.met
    + softSignals.ppe.met + softSignals.capabilities.matched;
  const total = hardGates.certifications.total + hardGates.compliance.total
    + softSignals.ppe.total + softSignals.capabilities.total;
  const blockers = candidate.signals.blockers.length;
  return { met, total, blockers };
}

export default function VettingPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const router = useRouter();
  const { isAuthenticated, demoTitle } = useAuth();
  
  const { state: vettingState, refetch, tradeLines } = useVettingData(orderId);
  
  // State for customer pre-approval toggle (UI-only)
  const [requiresPreApproval, setRequiresPreApproval] = useState(false);
  
  // State for Add Candidate modal (Direct Add — Path 4)
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  
  // State for bulk dispatch
  const [showBulkDispatchModal, setShowBulkDispatchModal] = useState(false);
  const [bulkDispatchDate, setBulkDispatchDate] = useState('');
  const [bulkDispatchLoading, setBulkDispatchLoading] = useState(false);
  const [bulkDispatchError, setBulkDispatchError] = useState<string | null>(null);

  // State for dispatch result reporting
  const [dispatchSuccessSummary, setDispatchSuccessSummary] = useState<{
    dispatchedCount: number;
    blockedCount: number;
    totalRequested: number;
  } | null>(null);
  const [dispatchFailureDetails, setDispatchFailureDetails] = useState<{
    orderCandidateId: string;
    candidateName: string;
    reasons: string[];
  }[]>([]);
  
  // State for split-view panel (card click drill-down)
  const [splitViewCandidate, setSplitViewCandidate] = useState<Candidate | null>(null);
  
  // State for No-Show candidates (UI-only mock)
  const [noShowCandidates, setNoShowCandidates] = useState<Candidate[]>(MOCK_NO_SHOWS);

  // UI selection state for "Move Selected" — bucket-scoped, NOT selectedForDispatch
  const [selectedIds, setSelectedIds] = useState<Record<string, Set<string>>>({});
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const toggleSelection = useCallback((bucketId: string, candidateId: string) => {
    setSelectedIds(prev => {
      const next = { ...prev };
      const bucketSet = new Set(prev[bucketId] || []);
      if (bucketSet.has(candidateId)) {
        bucketSet.delete(candidateId);
      } else {
        bucketSet.add(candidateId);
      }
      next[bucketId] = bucketSet;
      return next;
    });
  }, []);

  const clearBucketSelection = useCallback((bucketId: string) => {
    setSelectedIds(prev => {
      const next = { ...prev };
      next[bucketId] = new Set();
      return next;
    });
  }, []);

  const handleBulkMove = useCallback(async (bucketId: BucketId) => {
    const action = FORWARD_ACTION[bucketId];
    if (!action) return;
    const ids = Array.from(selectedIds[bucketId] || []);
    if (ids.length === 0) return;

    setMoveLoading(true);
    setMoveError(null);
    try {
      await apiFetch('/recruiting/bulk-move', {
        method: 'POST',
        body: JSON.stringify({
          orderCandidateIds: ids,
          action,
        }),
      });
      setMoveError(null);
      clearBucketSelection(bucketId);
      refetch();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      let friendlyMessage = 'Move failed. Please try again.';

      try {
        const jsonStart = raw.indexOf('{');
        if (jsonStart !== -1) {
          const jsonString = raw.slice(jsonStart);
          const payload = JSON.parse(jsonString);
          if (payload.code === 'HARD_GATE_BLOCKED') {
            const labels = Array.isArray(payload.missingItems)
              ? [...new Set(payload.missingItems.map((item: { label?: string }) => item.label).filter(Boolean))]
              : [];
            const base = (payload.message || friendlyMessage).replace(/\.?\s*$/, '');
            friendlyMessage = labels.length > 0
              ? `${base}. Waiting on: ${labels.join(', ')}.`
              : payload.message || friendlyMessage;
          } else if (payload.message) {
            friendlyMessage = payload.message;
          }
        }
      } catch {
        // JSON parse failed — use fallback message
      }

      setMoveError(friendlyMessage);
    } finally {
      setMoveLoading(false);
    }
  }, [selectedIds, clearBucketSelection, refetch]);

  // Loading state — preserve shell structure
  if (vettingState.status === 'loading') {
    return (
      <div className="vetting-page" style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
        <header className="order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Orders / ... / Vetting</div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Loading vetting data...</h1>
          </div>
        </header>
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14 }}>Loading candidates and order context...</div>
      </div>
    );
  }

  // Error state — preserve shell structure
  if (vettingState.status === 'error') {
    return (
      <div className="vetting-page" style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
        <header className="order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              <button style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#6b7280', fontSize: 13 }} onClick={() => router.push('/orders')}>Orders</button>
              <span style={{ color: '#d1d5db', margin: '0 8px' }}>/</span>
              <span>Vetting</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#dc2626' }}>Failed to load vetting data</h1>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>{vettingState.error}</p>
          </div>
          <button onClick={refetch} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
        </header>
      </div>
    );
  }

  const order = vettingState.order;

  const pipelineBuckets = order.buckets.filter(bucket => bucket.id !== 'CLOSED');
  const closedBucket = order.buckets.find(b => b.id === 'CLOSED');

  // Handler for adding to Identified (mock)
  const handleAddToIdentified = (_candidate: Candidate) => {
    // no-op placeholder for future implementation
  };

  // Handler for card click - opens split view
  const handleCardClick = (candidate: Candidate) => {
    setSplitViewCandidate(candidate);
  };
  
  // Handler for redispatching a no-show
  const handleRedispatch = (candidate: Candidate) => {
    setNoShowCandidates(prev => prev.filter(c => c.id !== candidate.id));
  };

  // Handler for bulk dispatch from PRE_DISPATCH lane (CANONICAL dispatch path)
  const handleBulkDispatch = async () => {
    if (!orderId) return;
    const startDate = new Date().toISOString().split('T')[0];

    const preDispatchBucket = order.buckets.find(b => b.id === 'PRE_DISPATCH');
    const selectedCandidates = preDispatchBucket?.candidates.filter(c => c.selectedForDispatch) || [];
    if (selectedCandidates.length === 0) return;

    setBulkDispatchLoading(true);
    setBulkDispatchError(null);
    setDispatchSuccessSummary(null);
    setDispatchFailureDetails([]);

    try {
      const result = await apiFetch<{
        ok: boolean;
        totalRequested: number;
        dispatchedCount: number;
        blockedCount: number;
        dispatched: { orderCandidateId: string; candidateName: string }[];
        blocked: { orderCandidateId: string; candidateName: string; reasons: string[] }[];
      }>('/recruiting/bulk-dispatch', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          orderCandidateIds: selectedCandidates.map(c => c.id),
          startDate: startDate,
        }),
      });

      setDispatchSuccessSummary({
        dispatchedCount: result.dispatchedCount,
        blockedCount: result.blockedCount,
        totalRequested: result.totalRequested,
      });
      setDispatchFailureDetails(result.blocked);
      setShowBulkDispatchModal(false);
      setBulkDispatchDate('');
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bulk dispatch failed';
      setBulkDispatchError(msg);
    } finally {
      setBulkDispatchLoading(false);
    }
  };

  // Handler for customer approval status change (Phase 9 — soft gate)
  const handleApprovalChange = async (candidateId: string, newStatus: CustomerApprovalStatusType) => {
    try {
      await apiFetch('/recruiting/customer-approval', {
        method: 'POST',
        body: JSON.stringify({
          orderCandidateId: candidateId,
          customerApprovalStatus: newStatus,
        }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to update customer approval:', err);
    }
  };

  // Handler for selection toggle (Phase 11)
  const handleSelectToggle = async (candidate: Candidate) => {
    const userId = getCurrentUserId();
    if (!userId) return;
    const endpoint = candidate.selectedForDispatch ? '/recruiting/deselect' : '/recruiting/select';
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          orderCandidateId: candidate.id,
          userId,
        }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle selection:', err);
    }
  };

  // Calculate totals
  const totalCandidates = order.buckets.reduce((sum, b) => sum + b.candidates.length, 0);
  const dispatchedCount = order.buckets.find(b => b.id === 'DISPATCHED')?.candidates.length || 0;
  const totalRequired = order.trades.reduce((sum, t) => sum + t.totalRequired, 0);

  // Mock discovery counts
  const jarvisMatchCount = 3;
  const manualSearchCount = 4;

  return (
    <div className="vetting-page">
      {/* Order Context Header */}
      <header className="order-header">
        <div className="header-left">
          <div className="breadcrumb">
            <button className="breadcrumb-item breadcrumb-link" onClick={() => router.push('/orders')}>Orders</button>
            <span className="breadcrumb-sep">/</span>
            <button className="breadcrumb-item active breadcrumb-link" onClick={() => router.push(`/orders/${orderId}`)}>{order.id}</button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-item active">Vetting</span>
          </div>
          <h1 className="order-title">{order.projectName}</h1>
          <div className="order-meta">
            <span className="meta-item">
              <span className="meta-icon">🏢</span>
              {order.customerName}
            </span>
            <span className="meta-item">
              <span className="meta-icon">📍</span>
              {order.location}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button
            className="add-candidate-header-btn"
            onClick={() => setShowAddCandidateModal(true)}
          >
            + Add Candidate
          </button>
          <div className="trade-chips">
            {order.trades.map(trade => {
              const open = getOpenSlots(trade);
              const code = trade.name.split(' ').map(w => w[0]).join('').toUpperCase();
              return (
                <span key={trade.id} className="trade-chip">
                  <span className="chip-code">{code}</span>
                  <span className="chip-counts">{open}/{trade.totalRequired}</span>
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {/* Zone 1: Discovery Strip (Compressed) */}
      <section className="discovery-strip">
        <div className="discovery-item jarvis-discovery">
          <div className="discovery-icon">🤖</div>
          <div className="discovery-info">
            <span className="discovery-label">Jarvis Matches</span>
            <span className="discovery-count">{jarvisMatchCount} candidates</span>
          </div>
          <button className="discovery-btn" onClick={() => router.push(`/orders/${orderId}/vetting/jarvis-matches`)}>
            View Matches
          </button>
        </div>
        <div className="discovery-item manual-discovery">
          <div className="discovery-icon">🔍</div>
          <div className="discovery-info">
            <span className="discovery-label">Recruiting Search</span>
            <span className="discovery-count">{manualSearchCount} results</span>
          </div>
          <button className="discovery-btn" onClick={() => router.push(`/orders/${orderId}/vetting/manual-search`)}>
            Search Employees
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Vetting Pipeline */}
        <section className="pipeline-section">
          <div className="pipeline-header">
            <h2 className="section-title">Vetting Pipeline</h2>
            <p className="section-desc">
              {totalCandidates} candidates in pipeline • {dispatchedCount} dispatched / {totalRequired} required
            </p>
          </div>

          {moveError && (
            <div className="move-error-banner" role="alert">
              <span className="move-error-icon">⚠</span>
              <span className="move-error-text">{moveError}</span>
              <button className="move-error-dismiss" onClick={() => setMoveError(null)} aria-label="Dismiss">×</button>
            </div>
          )}

          {dispatchSuccessSummary && (
            <div className="dispatch-result-banner" role="status">
              <div className="dispatch-result-header">
                <span className="dispatch-result-icon">
                  {dispatchSuccessSummary.blockedCount === 0 ? '✓' : dispatchSuccessSummary.dispatchedCount === 0 ? '✗' : '⚠'}
                </span>
                <span className="dispatch-result-text">
                  {dispatchSuccessSummary.blockedCount === 0
                    ? `All ${dispatchSuccessSummary.dispatchedCount} workers dispatched successfully.`
                    : dispatchSuccessSummary.dispatchedCount === 0
                      ? 'No workers were dispatched.'
                      : `${dispatchSuccessSummary.dispatchedCount} workers dispatched. ${dispatchSuccessSummary.blockedCount} were not dispatched.`}
                </span>
                <button
                  className="dispatch-result-dismiss"
                  onClick={() => { setDispatchSuccessSummary(null); setDispatchFailureDetails([]); }}
                  aria-label="Dismiss"
                >×</button>
              </div>
              {dispatchFailureDetails.length > 0 && (
                <div className="dispatch-blocked-details">
                  <div className="dispatch-blocked-title">Not dispatched:</div>
                  <ul className="dispatch-blocked-list">
                    {dispatchFailureDetails.map((item) => (
                      <li key={item.orderCandidateId} className="dispatch-blocked-item">
                        <span className="dispatch-blocked-name">{item.candidateName}</span>
                        <span className="dispatch-blocked-separator"> — </span>
                        <span className="dispatch-blocked-reasons">{item.reasons.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="pipeline-container">
            {/* Primary Pipeline Lanes */}
            <div className="primary-pipeline">
              {pipelineBuckets.map((bucket, index) => (
                <LaneColumn
                  key={bucket.id}
                  bucket={bucket}
                  trades={order.trades}
                  laneName={LANE_NAMES[bucket.id]?.name || bucket.name}
                  laneDescription={LANE_NAMES[bucket.id]?.description || bucket.description}
                  isLast={index === pipelineBuckets.length - 1}
                  onCardClick={handleCardClick}
                  onApprovalChange={handleApprovalChange}
                  onSelectToggle={handleSelectToggle}
                  isAuthenticated={isAuthenticated}
                  demoTitle={demoTitle}
                  isSelectable={SELECTABLE_BUCKETS.has(bucket.id)}
                  selectedIds={selectedIds[bucket.id] || new Set()}
                  onToggleSelection={(candidateId: string) => toggleSelection(bucket.id, candidateId)}
                  hasForwardAction={!!FORWARD_ACTION[bucket.id]}
                  onBulkMove={() => handleBulkMove(bucket.id)}
                  moveLoading={moveLoading}
                  onBulkDispatch={handleBulkDispatch}
                  bulkDispatchLoading={bulkDispatchLoading}
                />
              ))}
              
              {/* Exceptions Lane (No-Show) */}
              <ExceptionsLane
                candidates={noShowCandidates}
                onRedispatch={handleRedispatch}
                onCardClick={handleCardClick}
                isAuthenticated={isAuthenticated}
                demoTitle={demoTitle}
              />
              
                            {/* Closed Lane */}
              {closedBucket && (
                <LaneColumn
                  bucket={closedBucket}
                  trades={order.trades}
                  laneName={LANE_NAMES['CLOSED'].name}
                  laneDescription={LANE_NAMES['CLOSED'].description}
                  isLast
                  onCardClick={handleCardClick}
                  onApprovalChange={handleApprovalChange}
                  isAuthenticated={isAuthenticated}
                  demoTitle={demoTitle}
                />
              )}
            </div>

            {/* Customer Approval Gate (Side Panel — gate only, not a bucket) */}
            <CustomerApprovalGate
              bucket={undefined}
              allCandidates={order.buckets.flatMap(b => b.candidates)}
              requiresPreApproval={requiresPreApproval}
              onToggle={setRequiresPreApproval}
              onApprovalChange={handleApprovalChange}
              onCardClick={handleCardClick}
              isAuthenticated={isAuthenticated}
              demoTitle={demoTitle}
            />
          </div>
        </section>
      </div>

      {/* Split View Panel (Card Drill-Down) - Rendered BELOW Zone 2 */}
      {splitViewCandidate && (
        <section className="split-view-section">
          <SplitViewPanel
            candidate={splitViewCandidate}
            onClose={() => setSplitViewCandidate(null)}
          />
        </section>
      )}

      {/* Worker Timeline — Read Only (Event Spine) */}
      <section className="worker-timeline-section">
        <EventSpineTimelineSnapshot
          mode="compact"
          contextLabel="Worker Timeline — Read Only"
          workerName="Mock Worker"
          orderRef={order.id}
        />
      </section>

      {/* Trade Requirements Summary Table */}
      <section className="trade-summary-section">
        <h2 className="section-title">Trade Requirements Summary</h2>
        <table className="trade-summary-table">
          <thead>
            <tr>
              <th>Trade</th>
              <th>Total Required</th>
              <th>Dispatched</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {order.trades.map(trade => {
              const open = getOpenSlots(trade);
              return (
                <tr key={trade.id}>
                  <td className="trade-name-cell">{trade.name}</td>
                  <td className="count-cell">{trade.totalRequired}</td>
                  <td className="count-cell dispatched">{trade.dispatched}</td>
                  <td className="count-cell open">{open}</td>
                </tr>
              );
            })}
            <tr className="totals-row">
              <td className="trade-name-cell"><strong>Total</strong></td>
              <td className="count-cell"><strong>{totalRequired}</strong></td>
              <td className="count-cell dispatched"><strong>{dispatchedCount}</strong></td>
              <td className="count-cell open"><strong>{totalRequired - dispatchedCount}</strong></td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Add Candidate Modal (Direct Add — Path 4) */}
      {showAddCandidateModal && (
        <AddCandidateModal
          orderId={orderId}
          tradeLines={tradeLines.map((tl) => ({
            id: tl.id,
            tradeId: tl.tradeId,
            tradeName: tl.tradeName,
            startDate: tl.startDate,
            expectedEndDate: tl.expectedEndDate,
            requestedHeadcount: tl.requestedHeadcount,
          }))}
          entrySource="DIRECT_ADD"
          onClose={() => setShowAddCandidateModal(false)}
          onSuccess={() => {
            setShowAddCandidateModal(false);
            refetch();
          }}
        />
      )}

      {/* Bulk Dispatch Modal (CANONICAL dispatch path) */}
      {showBulkDispatchModal && (() => {
        const preDispatchBucket = order.buckets.find(b => b.id === 'PRE_DISPATCH');
        const selectedForDispatchCandidates = preDispatchBucket?.candidates.filter(c => c.selectedForDispatch) || [];
        return (
          <BulkDispatchModal
            candidateCount={selectedForDispatchCandidates.length}
            candidates={selectedForDispatchCandidates}
            dispatchDate={bulkDispatchDate}
            onDateChange={setBulkDispatchDate}
            loading={bulkDispatchLoading}
            error={bulkDispatchError}
            onClose={() => {
              setShowBulkDispatchModal(false);
              setBulkDispatchDate('');
              setBulkDispatchError(null);
            }}
            onConfirm={handleBulkDispatch}
            isAuthenticated={isAuthenticated}
            demoTitle={demoTitle}
          />
        );
      })()}

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Vetting / Kanban Page
        ============================================================ */
        .vetting-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 24px;
        }

        .split-view-section { margin-bottom: 20px; }
        .worker-timeline-section { margin-bottom: 20px; }

        /* Order Header Card */
        .order-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px 20px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          margin-bottom: 12px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .breadcrumb-item {
          font-size: 13px;
          color: #6b7280;
        }

        .breadcrumb-link {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #6b7280;
          font-size: 13px;
          transition: color 0.12s ease;
        }

        .breadcrumb-link:hover {
          color: #2563eb;
          text-decoration: underline;
        }

        .breadcrumb-item.active {
          color: #374151;
          font-weight: 500;
        }

        .breadcrumb-sep {
          color: #d1d5db;
        }

        .order-title {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.2px;
        }

        .order-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #4b5563;
        }

        .meta-icon {
          font-size: 12px;
        }

        .header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .trade-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .trade-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
          font-size: 11px;
        }

        .chip-code {
          font-weight: 700;
          color: #1d4ed8;
        }

        .chip-counts {
          color: #374151;
          font-family: 'SF Mono', monospace;
        }

        /* Discovery Strip */
        .discovery-strip {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          background: #ffffff;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 16px;
        }

        .discovery-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 6px;
          flex: 1;
        }

        .jarvis-discovery {
          border-left: 3px solid #2563eb;
        }

        .manual-discovery {
          border-left: 3px solid #16a34a;
        }

        .discovery-icon {
          font-size: 20px;
        }

        .discovery-info {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .discovery-label {
          font-size: 12px;
          font-weight: 600;
          color: #111827;
        }

        .discovery-count {
          font-size: 11px;
          color: #6b7280;
        }

        .discovery-btn {
          padding: 6px 12px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }

        .discovery-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }

        /* Main Content */
        .main-content { margin-bottom: 20px; }

        /* Pipeline Section */
        .pipeline-section { flex: 1; }

        .pipeline-header { margin-bottom: 12px; }

        .section-title {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .section-desc {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .pipeline-container {
          display: flex;
          gap: 16px;
        }

        .primary-pipeline {
          display: flex;
          gap: 10px;
          flex: 1;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        /* Trade Summary Section */
        .trade-summary-section {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 16px;
        }

        .trade-summary-table {
          width: 100%;
          border-collapse: collapse;
        }

        .trade-summary-table th,
        .trade-summary-table td {
          padding: 10px 14px;
          text-align: left;
          border-bottom: 1px solid #f1f5f9;
        }

        .trade-summary-table th {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #374151;
          background: #f1f5f9;
        }

        .trade-name-cell {
          font-size: 13px;
          color: #111827;
          font-weight: 500;
        }

        .count-cell {
          font-size: 13px;
          font-family: 'SF Mono', monospace;
          color: #374151;
          text-align: center;
        }

        .count-cell.dispatched { color: #16a34a; }
        .count-cell.open { color: #2563eb; }

        .totals-row { background: #f8fafc; }
        .totals-row td { border-bottom: none; }

        .add-candidate-header-btn {
          padding: 7px 14px;
          background: #2563eb;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease;
          white-space: nowrap;
        }

        .add-candidate-header-btn:hover {
          background: #1d4ed8;
        }

        .move-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .move-error-icon {
          font-size: 14px;
          flex-shrink: 0;
          color: #dc2626;
        }

        .move-error-text {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #991b1b;
          line-height: 1.4;
        }

        .move-error-dismiss {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid #fecaca;
          border-radius: 4px;
          color: #991b1b;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .move-error-dismiss:hover {
          background: #fee2e2;
        }

        .dispatch-result-banner {
          margin-bottom: 12px;
          border-radius: 8px;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          overflow: hidden;
        }

        .dispatch-result-banner:has(.dispatch-blocked-details) {
          border-color: #fde68a;
          background: #fffbeb;
        }

        .dispatch-result-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
        }

        .dispatch-result-icon {
          font-size: 14px;
          flex-shrink: 0;
          font-weight: 700;
        }

        .dispatch-result-text {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
          line-height: 1.4;
        }

        .dispatch-result-dismiss {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          color: #6b7280;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .dispatch-result-dismiss:hover {
          background: #f3f4f6;
        }

        .dispatch-blocked-details {
          padding: 8px 14px 12px;
          border-top: 1px solid #fde68a;
        }

        .dispatch-blocked-title {
          font-size: 12px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 6px;
        }

        .dispatch-blocked-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dispatch-blocked-item {
          font-size: 12px;
          color: #1f2937;
          line-height: 1.4;
        }

        .dispatch-blocked-name {
          font-weight: 600;
        }

        .dispatch-blocked-separator {
          color: #9ca3af;
        }

        .dispatch-blocked-reasons {
          color: #dc2626;
        }
      `}</style>
    </div>
  );
}

// Lane Column Component (replaces BucketColumn)
function LaneColumn({
  bucket,
  trades,
  laneName,
  laneDescription,
  isLast,
  onCardClick,
  onApprovalChange,
  onSelectToggle,
  isAuthenticated,
  demoTitle,
  isSelectable,
  selectedIds,
  onToggleSelection,
  hasForwardAction,
  onBulkMove,
  moveLoading,
  onBulkDispatch,
  bulkDispatchLoading,
}: {
  bucket: Bucket;
  trades: Trade[];
  laneName: string;
  laneDescription: string;
  isLast?: boolean;
  onCardClick: (candidate: Candidate) => void;
  onApprovalChange: (candidateId: string, status: CustomerApprovalStatusType) => void;
  onSelectToggle?: (candidate: Candidate) => void;
  isAuthenticated: boolean;
  demoTitle: string;
  isSelectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (candidateId: string) => void;
  hasForwardAction?: boolean;
  onBulkMove?: () => void;
  moveLoading?: boolean;
  onBulkDispatch?: () => void;
  bulkDispatchLoading?: boolean;
}) {
  const tradeBreakdown = getBucketTradeBreakdown(bucket, trades);
  const isDispatchedBucket = bucket.id === 'DISPATCHED';
  const isPreDispatchBucket = bucket.id === 'PRE_DISPATCH';
  const showSemantics = bucket.id === 'OPTED_IN' || bucket.id === 'AWAITING_CANDIDATE_ACTION';
  const selectedCount = isPreDispatchBucket
    ? bucket.candidates.filter(c => c.selectedForDispatch).length
    : 0;
  const totalInLane = bucket.candidates.length;
  const bucketSelectedCount = selectedIds?.size ?? 0;

  const laneColors: Record<string, string> = {
    OPTED_IN: '#6366f1',
    AWAITING_CANDIDATE_ACTION: '#f59e0b',
    MW4H_APPROVED: '#a855f7',
    PRE_DISPATCH: '#22c55e',
    DISPATCHED: '#10b981',
  };

  const accentColor = laneColors[bucket.id] || '#6366f1';

  return (
    <div className="lane-column">
      <div className="lane-header" style={{ borderColor: accentColor }}>
        <div className="lane-title-row">
          <h3 className="lane-name">{laneName}</h3>
          <span className="lane-count" style={{ background: accentColor }}>
            {bucket.candidates.length}
          </span>
        </div>
        <span className="lane-desc">{laneDescription}</span>
        {isPreDispatchBucket && totalInLane > 0 && (
          <div className="selection-summary">
            <span className="selection-count">{selectedCount} selected</span>
            <span className="selection-separator">of</span>
            <span className="selection-total">{totalInLane} staged</span>
          </div>
        )}
        <BucketTradeSummary tradeCounts={tradeBreakdown} />
      </div>

      <div className="lane-candidates">
        {bucket.candidates.length === 0 ? (
          <div className="empty-state">No candidates</div>
        ) : (
          bucket.candidates.map(candidate => (
            isDispatchedBucket ? (
              <DispatchedCard key={candidate.id} candidate={candidate} />
            ) : (
              <VettingCandidateCard
                key={candidate.id}
                candidate={candidate}
                showSemantics={showSemantics}
                showSelectionControl={isPreDispatchBucket}
                onClick={() => onCardClick(candidate)}
                onApprovalChange={(status) => onApprovalChange(candidate.id, status)}
                onSelectToggle={isPreDispatchBucket && onSelectToggle ? () => onSelectToggle(candidate) : undefined}
                isAuthenticated={isAuthenticated}
                demoTitle={demoTitle}
                showCheckbox={!!isSelectable}
                isChecked={!!selectedIds?.has(candidate.id)}
                onCheckboxToggle={onToggleSelection ? () => onToggleSelection(candidate.id) : undefined}
              />
            )
          ))
        )}
      </div>

      {!isLast && !isDispatchedBucket && hasForwardAction && (
        <div className="lane-actions">
          <button
            className={`action-btn${bucketSelectedCount > 0 ? ' action-btn-active' : ''}`}
            disabled={bucketSelectedCount === 0 || !isAuthenticated || !!moveLoading}
            title={!isAuthenticated ? demoTitle : bucketSelectedCount === 0 ? 'Select candidates first' : `Move ${bucketSelectedCount} selected`}
            onClick={(e) => { e.stopPropagation(); if (onBulkMove) onBulkMove(); }}
          >
            {moveLoading ? 'Moving...' : `Move Selected (${bucketSelectedCount}) →`}
          </button>
        </div>
      )}

      {isPreDispatchBucket && selectedCount > 0 && (
        <div className="lane-actions">
          <button
            className="action-btn action-btn-dispatch-bulk"
            disabled={!isAuthenticated || !!bulkDispatchLoading}
            title={!isAuthenticated ? demoTitle : `Dispatch ${selectedCount} selected workers`}
            onClick={(e) => { e.stopPropagation(); if (onBulkDispatch) onBulkDispatch(); }}
          >
            {bulkDispatchLoading ? 'Dispatching...' : `Dispatch Selected (${selectedCount})`}
          </button>
        </div>
      )}

      <style jsx>{`
        /* Lane Column — IL V1 light kanban */
        .lane-column {
          min-width: 240px;
          max-width: 280px;
          flex-shrink: 0;
          background: #ffffff;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
        }

        .lane-header {
          padding: 12px;
          border-bottom: 2px solid;
          background: #f8fafc;
          border-radius: 10px 10px 0 0;
        }

        .lane-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .lane-name {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }

        .lane-count {
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .lane-desc {
          font-size: 10px;
          color: #6b7280;
          display: block;
        }

        .selection-summary {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 11px;
        }
        .selection-count {
          font-weight: 700;
          color: #16a34a;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 1px 6px;
          border-radius: 3px;
        }
        .selection-separator {
          color: #9ca3af;
        }
        .selection-total {
          color: #6b7280;
        }

        .lane-candidates {
          flex: 1;
          padding: 10px;
          overflow-y: auto;
          max-height: 380px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lane-candidates::-webkit-scrollbar { width: 5px; }
        .lane-candidates::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
        .lane-candidates::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #9ca3af;
          font-size: 12px;
          font-style: italic;
        }

        .lane-actions {
          padding: 10px;
          border-top: 1px solid #f1f5f9;
        }

        .action-btn {
          width: 100%;
          padding: 8px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 5px;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 500;
          cursor: not-allowed;
          opacity: 0.7;
          transition: all 0.15s ease;
        }

        .action-btn.action-btn-active {
          background: #2563eb;
          border-color: #1d4ed8;
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          opacity: 1;
        }

        .action-btn.action-btn-active:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .action-btn.action-btn-active:disabled {
          background: #93c5fd;
          border-color: #93c5fd;
          cursor: wait;
        }

        .action-btn-dispatch-bulk {
          background: #16a34a;
          border-color: #15803d;
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
        }

        .action-btn-dispatch-bulk:hover:not(:disabled) {
          background: #15803d;
        }

        .action-btn-dispatch-bulk:disabled {
          background: #86efac;
          border-color: #86efac;
          color: #fff;
          cursor: wait;
        }
      `}</style>
    </div>
  );
}

function formatDispatchDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const ASSIGNMENT_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DISPATCHED: { label: 'Dispatched', color: '#065f46', bg: '#d1fae5' },
  ON_ASSIGNMENT: { label: 'On Assignment', color: '#1e40af', bg: '#dbeafe' },
  ARRIVED: { label: 'Arrived', color: '#1e40af', bg: '#dbeafe' },
  COMPLETED: { label: 'Completed', color: '#6b7280', bg: '#f3f4f6' },
  NO_SHOW: { label: 'No Show', color: '#991b1b', bg: '#fee2e2' },
};

function DispatchedCard({ candidate }: { candidate: Candidate }) {
  const a = candidate.assignment;
  const statusInfo = a ? (ASSIGNMENT_STATUS_LABELS[a.assignmentStatus] ?? { label: a.assignmentStatus, color: '#6b7280', bg: '#f3f4f6' }) : null;

  return (
    <div className="dispatched-card">
      <div className="dc-header">
        <span className="dc-name">{candidate.name}</span>
        <span className="dc-trade">{candidate.tradeName}</span>
      </div>
      {statusInfo && (
        <span className="dc-status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
          {statusInfo.label}
        </span>
      )}
      {a && (
        <div className="dc-meta">
          {a.dispatchedAt && (
            <div className="dc-row">
              <span className="dc-label">Dispatched</span>
              <span className="dc-value">{formatDispatchDate(a.dispatchedAt)}</span>
            </div>
          )}
          <div className="dc-row">
            <span className="dc-label">Start</span>
            <span className="dc-value">{formatDispatchDate(a.startDate)}</span>
          </div>
          {a.expectedEndDate && (
            <div className="dc-row">
              <span className="dc-label">Expected End</span>
              <span className="dc-value">{formatDispatchDate(a.expectedEndDate)}</span>
            </div>
          )}
        </div>
      )}
      <style jsx>{`
        .dispatched-card {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 8px;
        }
        .dc-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .dc-name {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }
        .dc-trade {
          font-size: 10px;
          color: #6b7280;
        }
        .dc-status-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 3px;
          margin-bottom: 4px;
        }
        .dc-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .dc-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        .dc-label {
          color: #6b7280;
        }
        .dc-value {
          color: #111827;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

// Vetting Candidate Card with Semantics
const APPROVAL_BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  APPROVED: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  NOT_REQUIRED: { bg: '#f3f4f6', color: '#6b7280', label: 'N/A' },
};

function ApprovalBadge({ status }: { status: CustomerApprovalStatusType }) {
  const style = APPROVAL_BADGE_STYLES[status] ?? APPROVAL_BADGE_STYLES.NOT_REQUIRED;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: '1px 5px',
        borderRadius: 3,
        background: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      CA: {style.label}
    </span>
  );
}

function VettingCandidateCard({
  candidate,
  showSemantics,
  showSelectionControl,
  onClick,
  onApprovalChange,
  onSelectToggle,
  isAuthenticated,
  demoTitle,
  showCheckbox,
  isChecked,
  onCheckboxToggle,
}: {
  candidate: Candidate;
  showSemantics: boolean;
  showSelectionControl?: boolean;
  onClick: () => void;
  onApprovalChange: (status: CustomerApprovalStatusType) => void;
  onSelectToggle?: () => void;
  isAuthenticated: boolean;
  demoTitle: string;
  showCheckbox?: boolean;
  isChecked?: boolean;
  onCheckboxToggle?: () => void;
}) {
  const source = SOURCE_LABELS[candidate.sourceType] || SOURCE_LABELS.recruiter;
  const readiness = getReadinessSignal(candidate);
  const eligibility = getEligibilitySummary(candidate);

  const readinessColors = {
    green: '#22c55e',
    yellow: '#f59e0b',
    red: '#ef4444',
  };

  const isSelected = candidate.selectedForDispatch === true;

  return (
    <div
      className={`candidate-card${showSelectionControl && isSelected ? ' selected-card' : ''}${showCheckbox && isChecked ? ' checkbox-selected-card' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        {showCheckbox && (
          <label className="card-checkbox-label" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="card-checkbox"
              checked={!!isChecked}
              disabled={!isAuthenticated}
              onChange={() => { if (isAuthenticated && onCheckboxToggle) onCheckboxToggle(); }}
            />
          </label>
        )}
        <div className="candidate-info">
          {showSelectionControl && (
            <span className={`selection-indicator ${isSelected ? 'sel-active' : 'sel-inactive'}`}>
              {isSelected ? '✓' : '○'}
            </span>
          )}
          <span className="candidate-name">{candidate.name}</span>
          <span className="candidate-trade">{candidate.tradeName}</span>
        </div>
        {candidate.matchConfidence && (
          <span className="confidence">{candidate.matchConfidence}%</span>
        )}
      </div>

      {/* Source Badge + Readiness + Eligibility (Semantics) */}
      {showSemantics && (
        <div className="card-semantics">
          <span className="source-badge">
            <span className="source-icon">{source.icon}</span>
            {source.label}
          </span>
          <span className="readiness-badge" style={{ background: `${readinessColors[readiness.color]}20`, color: readinessColors[readiness.color] }}>
            {readiness.label}
          </span>
          <span className="eligibility-badge">
            {eligibility.met}/{eligibility.total}
            {eligibility.blockers > 0 && <span className="blockers"> • {eligibility.blockers} blockers</span>}
          </span>
        </div>
      )}

      <div className="card-details">
        <span className="detail">📍 {candidate.distance} mi</span>
        {candidate.signals?.availability?.available === false ? (
          <span className="availability-unavailable">UNAVAILABLE — COMMITTED ELSEWHERE</span>
        ) : (
          <span className="availability-ok">Available</span>
        )}
      </div>

      {candidate.certifications.length > 0 && (
        <div className="certs">
          {candidate.certifications.slice(0, 2).map(cert => (
            <span key={cert.id} className="cert">
              {cert.verified ? '✓' : '○'} {cert.name}
            </span>
          ))}
          {candidate.certifications.length > 2 && (
            <span className="cert more">+{candidate.certifications.length - 2}</span>
          )}
        </div>
      )}

      {candidate.signals?.blockers && candidate.signals.blockers.length > 0 && (
        <div className="blocker-list">
          {candidate.signals.blockers.slice(0, 3).map((b, i) => (
            <span key={i} className="blocker-item">⚠ {b}</span>
          ))}
          {candidate.signals.blockers.length > 3 && (
            <span className="blocker-overflow">+{candidate.signals.blockers.length - 3} more</span>
          )}
        </div>
      )}

      {candidate.customerApprovalStatus && (
        <div className="approval-row" onClick={(e) => e.stopPropagation()}>
          <ApprovalBadge status={candidate.customerApprovalStatus} />
          <select
            className="approval-select"
            value={candidate.customerApprovalStatus}
            disabled={!isAuthenticated}
            title={!isAuthenticated ? demoTitle : 'Update customer approval'}
            onChange={(e) => onApprovalChange(e.target.value as CustomerApprovalStatusType)}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="NOT_REQUIRED">Not Required</option>
          </select>
        </div>
      )}

      {showSelectionControl && (
        <button
          className={`select-toggle-btn ${isSelected ? 'selected' : 'not-selected'}`}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? demoTitle : isSelected ? 'Deselect from dispatch' : 'Select for dispatch'}
          onClick={(e) => { e.stopPropagation(); if (!isAuthenticated || !onSelectToggle) return; onSelectToggle(); }}
        >
          {isSelected ? '✓ Selected' : 'Select'}
        </button>
      )}

      <style jsx>{`
        /* Candidate Card — IL V1 light */
        .candidate-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px;
          transition: border-color 0.12s ease, background 0.12s ease;
          cursor: pointer;
        }

        .candidate-card:hover {
          background: #f9fafb;
          border-color: #bfdbfe;
        }

        .candidate-card.selected-card {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .candidate-card.selected-card:hover {
          background: #dcfce7;
          border-color: #16a34a;
        }

        .candidate-card.checkbox-selected-card {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .candidate-card.checkbox-selected-card:hover {
          background: #dbeafe;
          border-color: #1d4ed8;
        }

        .card-checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          flex-shrink: 0;
          padding: 2px;
        }

        .card-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
          margin: 0;
          flex-shrink: 0;
        }

        .card-checkbox:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .selection-indicator {
          font-size: 11px;
          font-weight: 700;
          margin-right: 4px;
        }
        .sel-active { color: #16a34a; }
        .sel-inactive { color: #9ca3af; }

        .select-toggle-btn {
          width: 100%;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s ease;
          margin-top: 4px;
        }
        .select-toggle-btn.not-selected {
          background: #f8fafc;
          border: 1px solid #d1d5db;
          color: #374151;
        }
        .select-toggle-btn.not-selected:hover:not(:disabled) {
          background: #f0fdf4;
          border-color: #22c55e;
          color: #16a34a;
        }
        .select-toggle-btn.selected {
          background: #22c55e;
          border: 1px solid #16a34a;
          color: #ffffff;
        }
        .select-toggle-btn.selected:hover:not(:disabled) {
          background: #ef4444;
          border-color: #dc2626;
        }
        .select-toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 6px;
          margin-bottom: 4px;
        }

        .candidate-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .candidate-name {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }

        .candidate-trade {
          font-size: 10px;
          color: #6b7280;
        }

        .confidence {
          font-size: 10px;
          font-weight: 700;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .card-semantics {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 6px;
        }

        .source-badge {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 9px;
          padding: 2px 6px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
          color: #374151;
        }

        .source-icon { font-size: 10px; }

        .readiness-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .eligibility-badge {
          font-size: 9px;
          padding: 2px 6px;
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
          color: #5b21b6;
          border-radius: 3px;
        }

        .blockers { color: #dc2626; }

        .card-details {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }

        .detail {
          font-size: 10px;
          color: #6b7280;
        }

        .availability-ok {
          font-size: 9px;
          font-weight: 500;
          color: #16a34a;
        }

        .availability-unavailable {
          font-size: 8px;
          font-weight: 600;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 1px 5px;
          border-radius: 3px;
        }

        .certs {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
        }

        .cert {
          font-size: 8px;
          padding: 2px 4px;
          background: #f1f5f9;
          border-radius: 2px;
          color: #374151;
        }

        .cert.more {
          background: transparent;
          color: #9ca3af;
        }

        .blocker-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 4px;
          padding: 4px 6px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 4px;
        }

        .blocker-item {
          font-size: 8px;
          color: #991b1b;
          line-height: 1.3;
        }

        .blocker-overflow {
          font-size: 8px;
          color: #9ca3af;
          font-style: italic;
        }

        .approval-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 3px 0;
        }

        .approval-select {
          font-size: 9px;
          padding: 1px 4px;
          border: 1px solid #d1d5db;
          border-radius: 3px;
          background: #fff;
          color: #374151;
          cursor: pointer;
          outline: none;
        }

        .approval-select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

      `}</style>
    </div>
  );
}

// Exceptions Lane (No-Show)
function ExceptionsLane({
  candidates,
  onRedispatch,
  onCardClick,
  isAuthenticated,
  demoTitle,
}: {
  candidates: Candidate[];
  onRedispatch: (candidate: Candidate) => void;
  onCardClick: (candidate: Candidate) => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  return (
    <div className="exceptions-lane">
      <div className="lane-header">
        <div className="lane-title-row">
          <h3 className="lane-name">Exceptions (No-Show)</h3>
          <span className="lane-count">{candidates.length}</span>
        </div>
        <span className="lane-desc">Workers who did not report</span>
      </div>

      <div className="lane-candidates">
        {candidates.length === 0 ? (
          <div className="empty-state">No exceptions</div>
        ) : (
          candidates.map(candidate => (
            <div key={candidate.id} className="exception-card" onClick={() => onCardClick(candidate)}>
              <div className="card-header">
                <span className="candidate-name">{candidate.name}</span>
                <span className="noshow-badge">No-Show</span>
              </div>
              <div className="card-details">
                <span className="trade-badge">{candidate.tradeName}</span>
                <span className="dispatch-date">Was: {candidate.dispatchStartDate}</span>
              </div>
              <button 
                className="redispatch-btn" 
                disabled={!isAuthenticated} 
                title={!isAuthenticated ? demoTitle : undefined} 
                onClick={(e) => { e.stopPropagation(); if (!isAuthenticated) return; onRedispatch(candidate); }}
              >
                ↩ Redispatch
              </button>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        /* Exceptions Lane — IL V1 (semantic red preserved for no-show context) */
        .exceptions-lane {
          min-width: 220px;
          max-width: 240px;
          flex-shrink: 0;
          background: #fff1f2;
          border-radius: 10px;
          border: 1px solid #fecaca;
          display: flex;
          flex-direction: column;
        }

        .lane-header {
          padding: 12px;
          border-bottom: 2px solid #ef4444;
          background: #fff1f2;
          border-radius: 10px 10px 0 0;
        }

        .lane-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .lane-name {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #dc2626;
        }

        .lane-count {
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          padding: 2px 8px;
          border-radius: 10px;
          background: #ef4444;
        }

        .lane-desc {
          font-size: 10px;
          color: #6b7280;
        }

        .lane-candidates {
          flex: 1;
          padding: 10px;
          overflow-y: auto;
          max-height: 380px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #9ca3af;
          font-size: 12px;
          font-style: italic;
        }

        .exception-card {
          background: #ffffff;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .exception-card:hover { background: #fff1f2; }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }

        .candidate-name {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }

        .noshow-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 3px;
        }

        .card-details {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .trade-badge {
          font-size: 9px;
          padding: 2px 5px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          border-radius: 3px;
        }

        .dispatch-date {
          font-size: 10px;
          color: #6b7280;
        }

        .redispatch-btn {
          width: 100%;
          padding: 6px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .redispatch-btn:hover:not(:disabled) { background: #dbeafe; }
        .redispatch-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

// Closed Lane (Phase 5 — Recruiter-facing CLOSED lane with disposition + alt-trade visibility)
function ClosedLane({
  candidates,
  onCardClick,
}: {
  candidates: Candidate[];
  onCardClick: (candidate: Candidate) => void;
}) {
  return (
    <div className="closed-lane">
      <div className="lane-header">
        <div className="lane-title-row">
          <h3 className="lane-name">Closed</h3>
          <span className="lane-count">{candidates.length}</span>
        </div>
        <span className="lane-desc">Out of active recruiting flow</span>
      </div>

      <div className="lane-candidates">
        {candidates.length === 0 ? (
          <div className="empty-state">No closed candidates</div>
        ) : (
          candidates.map(candidate => (
            <div key={candidate.id} className="closed-card" onClick={() => onCardClick(candidate)}>
              <div className="card-header">
                <span className="candidate-name closed-name">{candidate.name}</span>
                {candidate.closedDisposition && (
                  <span className={`disposition-badge ${candidate.closedDisposition === 'REJECTED' ? 'rejected' : 'not-selected'}`}>
                    {candidate.closedDisposition === 'REJECTED' ? 'Rejected' : 'Not Selected'}
                  </span>
                )}
              </div>

              <div className="trade-context">
                <span className="original-trade">
                  Opted in: {candidate.originalTradeName || candidate.tradeName}
                </span>
              </div>

              {candidate.altTrade && (
                <div className={`alt-trade-block ${candidate.altTrade.accepted ? 'accepted' : 'proposed'}`}>
                  <span className="alt-trade-label">
                    {candidate.altTrade.accepted ? 'Alt trade accepted' : 'Alt trade proposed'}
                  </span>
                  <span className="alt-trade-name">{candidate.altTrade.tradeName}</span>
                  {candidate.altTrade.accepted && candidate.altTrade.confirmationMethod && (
                    <span className="alt-trade-method">
                      via {candidate.altTrade.confirmationMethod}
                      {candidate.altTrade.confirmedByName ? ` by ${candidate.altTrade.confirmedByName}` : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .closed-lane {
          min-width: 220px;
          max-width: 260px;
          flex-shrink: 0;
          background: #f3f4f6;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          display: flex;
          flex-direction: column;
          opacity: 0.85;
        }

        .lane-header {
          padding: 12px;
          border-bottom: 2px solid #9ca3af;
          background: #e5e7eb;
          border-radius: 10px 10px 0 0;
        }

        .lane-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .lane-name {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #6b7280;
        }

        .lane-count {
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          padding: 2px 8px;
          border-radius: 10px;
          background: #9ca3af;
        }

        .lane-desc {
          font-size: 10px;
          color: #9ca3af;
        }

        .lane-candidates {
          flex: 1;
          padding: 10px;
          overflow-y: auto;
          max-height: 380px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #9ca3af;
          font-size: 12px;
          font-style: italic;
        }

        .closed-card {
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          transition: border-color 0.12s ease;
        }

        .closed-card:hover {
          border-color: #9ca3af;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 4px;
        }

        .candidate-name.closed-name {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-decoration: line-through;
        }

        .disposition-badge {
          font-size: 8px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }

        .disposition-badge.not-selected {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          color: #6b7280;
        }

        .disposition-badge.rejected {
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .trade-context {
          margin-bottom: 4px;
        }

        .original-trade {
          font-size: 9px;
          color: #9ca3af;
        }

        .alt-trade-block {
          padding: 4px 6px;
          border-radius: 4px;
          margin-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .alt-trade-block.proposed {
          background: #fffbeb;
          border: 1px solid #fde68a;
        }

        .alt-trade-block.accepted {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .alt-trade-label {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .alt-trade-block.proposed .alt-trade-label {
          color: #d97706;
        }

        .alt-trade-block.accepted .alt-trade-label {
          color: #16a34a;
        }

        .alt-trade-name {
          font-size: 10px;
          font-weight: 600;
          color: #374151;
        }

        .alt-trade-method {
          font-size: 8px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

// Customer Approval Gate (Side Panel - NOT a lane)
function CustomerApprovalGate({
  bucket,
  allCandidates,
  requiresPreApproval,
  onToggle,
  onApprovalChange,
  onCardClick,
  isAuthenticated,
  demoTitle,
}: {
  bucket: Bucket | undefined;
  allCandidates: Candidate[];
  requiresPreApproval: boolean;
  onToggle: (value: boolean) => void;
  onApprovalChange: (candidateId: string, status: CustomerApprovalStatusType) => void;
  onCardClick: (candidate: Candidate) => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const pendingCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'PENDING');
  const approvedCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'APPROVED');
  const rejectedCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'REJECTED');

  const mockApprovalPackage = 'Tier 2 — Standard';

  return (
    <div className="approval-gate">
      <div className="gate-header">
        <div className="gate-title">
          <span className="gate-icon">🔒</span>
          <h3>Customer Approval Gate</h3>
        </div>
        <label className="gate-toggle">
          <input
            type="checkbox"
            checked={requiresPreApproval}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className={`toggle-label ${requiresPreApproval ? 'active' : ''}`}>
            {requiresPreApproval ? 'Required' : 'Not Required'}
          </span>
        </label>
      </div>

      {/* Approval Context Block (Read-only, Informational) */}
      <div className="approval-context">
        <div className="context-header">
          <span className="context-label">Approval Context</span>
        </div>
        <div className="context-rows">
          <div className="context-row">
            <span className="context-key">Customer Approval Required:</span>
            <span className={`context-value ${requiresPreApproval ? 'yes' : 'no'}`}>
              {requiresPreApproval ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="context-row">
            <span className="context-key">Approval Package:</span>
            <span className="context-value package">{mockApprovalPackage}</span>
          </div>
        </div>
        <p className="context-helper">
          Approval requirements are defined at the customer level and may be overridden per order.
        </p>
      </div>

      {/* Live approval status summary */}
      <div className="gate-summary">
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#f59e0b' }}></span>
          <span className="summary-label">Pending</span>
          <span className="summary-count">{pendingCandidates.length}</span>
        </div>
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#22c55e' }}></span>
          <span className="summary-label">Approved</span>
          <span className="summary-count">{approvedCandidates.length}</span>
        </div>
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#ef4444' }}></span>
          <span className="summary-label">Rejected</span>
          <span className="summary-count">{rejectedCandidates.length}</span>
        </div>
      </div>

      {requiresPreApproval && pendingCandidates.length > 0 && (
        <>
          <div className="gate-status">
            <span className="status-indicator pending"></span>
            <span className="status-text">Pending customer approval</span>
            <span className="status-count">{pendingCandidates.length}</span>
          </div>

          <div className="gate-candidates">
            {pendingCandidates.map(candidate => (
              <div key={candidate.id} className="gate-card">
                <div className="gate-card-info" onClick={() => onCardClick(candidate)}>
                  <span className="candidate-name">{candidate.name}</span>
                  <span className="candidate-trade">{candidate.tradeName}</span>
                </div>
                <div className="gate-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="gate-action-btn approve"
                    disabled={!isAuthenticated}
                    title={!isAuthenticated ? demoTitle : 'Approve'}
                    onClick={() => onApprovalChange(candidate.id, 'APPROVED')}
                  >
                    ✓
                  </button>
                  <button
                    className="gate-action-btn reject"
                    disabled={!isAuthenticated}
                    title={!isAuthenticated ? demoTitle : 'Reject'}
                    onClick={() => onApprovalChange(candidate.id, 'REJECTED')}
                  >
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        /* Customer Approval Gate — IL V1 amber semantic panel */
        .approval-gate {
          min-width: 200px;
          max-width: 220px;
          background: #fffbeb;
          border: 1px dashed #fde68a;
          border-radius: 10px;
          padding: 12px;
          flex-shrink: 0;
        }

        .gate-header { margin-bottom: 12px; }

        .gate-title {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }

        .gate-icon { font-size: 14px; }

        .gate-title h3 {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #92400e;
        }

        .gate-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .gate-toggle input { display: none; }

        .toggle-slider {
          position: relative;
          width: 32px;
          height: 18px;
          background: #e5e7eb;
          border-radius: 9px;
          transition: 0.3s;
        }

        .toggle-slider::before {
          content: "";
          position: absolute;
          width: 14px;
          height: 14px;
          left: 2px;
          top: 2px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }

        .gate-toggle input:checked + .toggle-slider { background: #f59e0b; }
        .gate-toggle input:checked + .toggle-slider::before { transform: translateX(14px); }

        .toggle-label {
          font-size: 10px;
          color: #6b7280;
          font-weight: 500;
        }

        .toggle-label.active {
          color: #92400e;
          font-weight: 700;
        }

        .gate-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-indicator.pending {
          background: #f59e0b;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          flex: 1;
          font-size: 10px;
          color: #4b5563;
        }

        .status-count {
          font-size: 11px;
          font-weight: 700;
          color: #d97706;
        }

        .gate-candidates {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 10px;
          max-height: 200px;
          overflow-y: auto;
        }

        .gate-card {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          padding: 8px;
          background: #ffffff;
          border: 1px solid #fde68a;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .gate-card:hover { background: #fffbeb; }

        .gate-card .candidate-name {
          font-size: 11px;
          font-weight: 700;
          color: #111827;
          flex: 1;
        }

        .gate-card .candidate-trade {
          font-size: 9px;
          color: #6b7280;
        }

        .gate-card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          cursor: pointer;
        }

        .gate-card-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .gate-action-btn {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease;
        }

        .gate-action-btn.approve {
          background: #d1fae5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .gate-action-btn.approve:hover { background: #a7f3d0; }

        .gate-action-btn.reject {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }
        .gate-action-btn.reject:hover { background: #fecaca; }

        .gate-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .gate-summary {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .summary-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .summary-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .summary-label {
          flex: 1;
          font-size: 10px;
          color: #4b5563;
        }

        .summary-count {
          font-size: 10px;
          font-weight: 700;
          color: #111827;
        }

        .approve-btn {
          width: 100%;
          padding: 8px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 5px;
          color: #d97706;
          font-size: 10px;
          font-weight: 700;
          cursor: not-allowed;
          opacity: 0.75;
        }

        /* Approval Context (read-only info block) */
        .approval-context {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 12px;
        }

        .context-header {
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }

        .context-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
        }

        .context-rows {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 8px;
        }

        .context-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }

        .context-key {
          font-size: 10px;
          color: #4b5563;
        }

        .context-value {
          font-size: 10px;
          font-weight: 700;
        }

        .context-value.yes { color: #d97706; }
        .context-value.no { color: #9ca3af; }
        .context-value.package { color: #374151; font-style: italic; }

        .context-helper {
          margin: 0;
          font-size: 9px;
          color: #9ca3af;
          line-height: 1.4;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

// Split View Panel (Card Drill-Down — order-linked requirement truth)
function SplitViewPanel({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const certItems: CertSignalItem[] = candidate.signals?.hardGates?.certifications?.items ?? [];
  const complianceItems: ComplianceSignalItem[] = candidate.signals?.hardGates?.compliance?.items ?? [];
  const ppeItems: PpeSignalItem[] = candidate.signals?.softSignals?.ppe?.items ?? [];
  const toolItems: ToolSignalItem[] = candidate.signals?.softSignals?.tools?.items ?? [];
  const hasSignals = !!candidate.signals;

  return (
    <div className="split-view-panel">
      <div className="panel-header">
        <h2>Candidate Details</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        {/* Left: Employee Profile (Global Truth) */}
        <div className="profile-section">
          <div className="section-header">
            <h3>Employee Profile</h3>
            <span className="section-badge">Global Truth</span>
          </div>

          <div className="profile-card">
            <div className="profile-name">{candidate.name}</div>
            <div className="profile-trade">{candidate.tradeName}</div>
          </div>

          <div className="profile-group">
            <h4>MW4H Job History</h4>
            <div className="placeholder-content">
              <span className="placeholder-item">12 jobs completed</span>
              <span className="placeholder-item">4.8 avg rating</span>
            </div>
          </div>

          <div className="profile-group">
            <h4>Customers / Sites</h4>
            <div className="placeholder-content">
              <span className="placeholder-item">Apex Construction (3 jobs)</span>
              <span className="placeholder-item">Metro Builders (2 jobs)</span>
            </div>
          </div>

          <div className="profile-group">
            <h4>Pay & Per Diem History</h4>
            <div className="placeholder-content">
              <span className="placeholder-item">Avg Rate: $42/hr</span>
              <span className="placeholder-item">Per Diem: $65/day</span>
            </div>
          </div>

          <div className="profile-group">
            <h4>Safety Incidents</h4>
            <div className="placeholder-content safe">
              <span className="placeholder-item">✓ No incidents on record</span>
            </div>
          </div>

          <div className="profile-group">
            <h4>Certifications</h4>
            <div className="cert-list">
              {candidate.certifications.length > 0 ? (
                candidate.certifications.map(cert => (
                  <span key={cert.id} className={`cert-item ${cert.verified ? 'verified' : 'pending'}`}>
                    {cert.verified ? '✓' : '○'} {cert.name}
                  </span>
                ))
              ) : certItems.length > 0 ? (
                certItems.map(item => (
                  <span key={item.certTypeId} className={`cert-item ${item.candidateStatus === 'VALID' ? 'verified' : 'pending'}`}>
                    {item.candidateStatus === 'VALID' ? '✓' : '○'} {item.certTypeName}
                  </span>
                ))
              ) : (
                <span className="cert-item pending">No certifications on file</span>
              )}
            </div>
          </div>

          <div className="profile-group">
            <h4>Resume</h4>
            <button className="placeholder-btn" disabled>View Resume (PDF)</button>
          </div>
        </div>

        {/* Right: Job Eligibility Checklist (Order-Specific from OrderTradeRequirement) */}
        <div className="eligibility-section">
          <div className="section-header">
            <h3>Job Eligibility Checklist</h3>
            <span className="section-badge order">This Order</span>
          </div>

          {!hasSignals ? (
            <div className="checklist-group">
              <div className="empty-checklist">
                No trade line linked — requirements cannot be evaluated.
              </div>
            </div>
          ) : (
            <>
              <div className="checklist-group">
                <h4>Required Certifications</h4>
                <ul className="checklist">
                  {certItems.length === 0 ? (
                    <li className="no-requirements">No certification requirements defined for this order line</li>
                  ) : (
                    certItems.map(item => {
                      const isSatisfied = item.candidateStatus === 'VALID';
                      return (
                        <li key={item.certTypeId} className={isSatisfied ? 'satisfied' : 'missing'}>
                          <span className="check-icon">{isSatisfied ? '✓' : '⚠️'}</span>
                          {item.certTypeName}
                          {!isSatisfied && (
                            <span className="missing-tag">
                              {item.candidateStatus === 'EXPIRED' ? 'EXPIRED' : 'MISSING'}
                            </span>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="checklist-group">
                <h4>Required Compliance</h4>
                <ul className="checklist">
                  {complianceItems.length === 0 ? (
                    <li className="no-requirements">No compliance requirements defined for this order line</li>
                  ) : (
                    complianceItems.map(item => {
                      const isSatisfied = item.candidateStatus === 'COMPLETED';
                      const isPending = item.candidateStatus === 'PENDING';
                      const className = isSatisfied ? 'satisfied' : isPending ? 'pending-item' : 'missing';
                      return (
                        <li key={item.requirementTypeId} className={className}>
                          <span className="check-icon">{isSatisfied ? '✓' : isPending ? '○' : '⚠️'}</span>
                          {item.requirementName}
                          {!isSatisfied && (
                            <span className="missing-tag">
                              {item.candidateStatus}
                            </span>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="checklist-group">
                <h4>Required Tools</h4>
                <ul className="checklist">
                  {toolItems.length === 0 ? (
                    <li className="no-requirements">No tool requirements defined for this order line</li>
                  ) : (
                    toolItems.map(item => (
                      <li key={item.toolId} className="deferred-item">
                        <span className="check-icon">○</span>
                        {item.toolName}
                        <span className="deferred-tag">SOFT</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="checklist-group">
                <h4>Required PPE</h4>
                <ul className="checklist">
                  {ppeItems.length === 0 ? (
                    <li className="no-requirements">No PPE requirements defined for this order line</li>
                  ) : (
                    ppeItems.map(item => {
                      const isSatisfied = item.candidateStatus === 'HAS';
                      return (
                        <li key={item.ppeTypeId} className={isSatisfied ? 'satisfied' : 'missing'}>
                          <span className="check-icon">{isSatisfied ? '✓' : '⚠️'}</span>
                          {item.ppeTypeName}
                          {!isSatisfied && <span className="missing-tag">MISSING</span>}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </>
          )}

          <div className="checklist-group">
            <h4>Distance / Travel</h4>
            <div className="travel-info">
              <span className="travel-item">📍 {candidate.distance} miles from site</span>
            </div>
          </div>

          <div className="checklist-group">
            <h4>Customer Constraints</h4>
            <div className="placeholder-content">
              <span className="placeholder-item">✓ No customer restrictions</span>
            </div>
          </div>
        </div>
      </div>

        <style jsx>{`
        /* Split View Panel — IL V1 light */
        .split-view-panel {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 500px;
          width: 100%;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          background: #f1f5f9;
          border-bottom: 1px solid #e5e7eb;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }

        .close-btn {
          width: 28px;
          height: 28px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #374151;
          font-size: 18px;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .close-btn:hover { background: #f1f5f9; }

        .panel-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: #e5e7eb;
          flex: 1;
          overflow-y: auto;
        }

        .profile-section,
        .eligibility-section {
          padding: 14px;
          background: #ffffff;
          overflow-y: auto;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }

        .section-header h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }

        .section-badge {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 3px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
        }

        .section-badge.order {
          background: #f5f3ff;
          border-color: #ddd6fe;
          color: #5b21b6;
        }

        .profile-card {
          padding: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          margin-bottom: 12px;
          text-align: center;
        }

        .profile-name {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }

        .profile-trade {
          font-size: 11px;
          color: #6b7280;
        }

        .profile-group,
        .checklist-group { margin-bottom: 12px; }

        .profile-group h4,
        .checklist-group h4 {
          margin: 0 0 6px 0;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
        }

        .placeholder-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .placeholder-content.safe { color: #16a34a; }

        .placeholder-item {
          font-size: 11px;
          color: #374151;
          padding: 4px 8px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 4px;
        }

        .cert-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cert-item {
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .cert-item.verified {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }

        .cert-item.pending {
          background: #fffbeb;
          color: #d97706;
          border: 1px solid #fde68a;
        }

        .placeholder-btn {
          padding: 8px 12px;
          background: #f1f5f9;
          border: 1px solid #e5e7eb;
          border-radius: 5px;
          color: #6b7280;
          font-size: 10px;
          cursor: not-allowed;
          opacity: 0.75;
        }

        .checklist {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .checklist li {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 10px;
        }

        .checklist li.satisfied {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }

        .checklist li.missing {
          background: #fff1f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .checklist li.all-good {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }

        .checklist li.no-requirements {
          background: #f8fafc;
          color: #9ca3af;
          border: 1px solid #e5e7eb;
          font-style: italic;
        }

        .checklist li.pending-item {
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
        }

        .checklist li.deferred-item {
          background: #f8fafc;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .deferred-tag {
          margin-left: auto;
          font-size: 8px;
          font-weight: 700;
          padding: 2px 4px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          border-radius: 2px;
        }

        .empty-checklist {
          padding: 16px;
          text-align: center;
          color: #9ca3af;
          font-size: 11px;
          font-style: italic;
          background: #f8fafc;
          border: 1px dashed #e5e7eb;
          border-radius: 6px;
        }

        .check-icon { font-size: 11px; }

        .missing-tag {
          margin-left: auto;
          font-size: 8px;
          font-weight: 700;
          padding: 2px 4px;
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 2px;
        }

        .travel-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .travel-item {
          font-size: 10px;
          color: #374151;
          padding: 4px 8px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

function BulkDispatchModal({
  candidateCount,
  candidates,
  dispatchDate,
  onDateChange,
  onClose,
  onConfirm,
  loading,
  error,
  isAuthenticated,
  demoTitle,
}: {
  candidateCount: number;
  candidates: Candidate[];
  dispatchDate: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const canConfirm = dispatchDate.length > 0 && !loading && candidateCount > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Bulk Dispatch</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="bulk-summary">
            <span className="bulk-count">{candidateCount}</span>
            <span className="bulk-label">workers selected for dispatch</span>
          </div>

          {candidates.length > 0 && candidates.length <= 20 && (
            <div className="bulk-candidate-list">
              {candidates.map(c => (
                <div key={c.id} className="bulk-candidate-row">
                  <span className="bulk-candidate-name">{c.name}</span>
                  <span className="bulk-candidate-trade">{c.tradeName}</span>
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Official Start Date <span className="required">*</span>
            </label>
            <input
              type="date"
              className="date-input"
              disabled={!isAuthenticated}
              title={!isAuthenticated ? demoTitle : undefined}
              value={dispatchDate}
              onChange={e => onDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: '0 18px 8px', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="confirm-btn"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {loading ? 'Dispatching...' : `Dispatch ${candidateCount} Workers`}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(17, 24, 39, 0.45);
            backdrop-filter: blur(2px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .modal-content {
            width: 100%;
            max-width: 440px;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 18px;
            background: #f0fdf4;
            border-bottom: 1px solid #bbf7d0;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #166534;
          }

          .close-btn {
            width: 28px;
            height: 28px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            color: #374151;
            font-size: 18px;
            cursor: pointer;
            transition: background 0.12s ease;
          }

          .close-btn:hover { background: #f1f5f9; }

          .modal-body { padding: 18px; }

          .bulk-summary {
            display: flex;
            align-items: baseline;
            gap: 8px;
            padding: 14px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .bulk-count {
            font-size: 28px;
            font-weight: 800;
            color: #16a34a;
          }

          .bulk-label {
            font-size: 13px;
            color: #374151;
            font-weight: 500;
          }

          .bulk-candidate-list {
            max-height: 160px;
            overflow-y: auto;
            margin-bottom: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }

          .bulk-candidate-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 10px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
          }

          .bulk-candidate-row:last-child { border-bottom: none; }

          .bulk-candidate-name {
            font-weight: 600;
            color: #111827;
          }

          .bulk-candidate-trade {
            color: #6b7280;
          }

          .form-group { margin-bottom: 16px; }

          .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 6px;
          }

          .required { color: #dc2626; }

          .date-input {
            width: 100%;
            padding: 9px 11px;
            background: #ffffff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            color: #111827;
            font-size: 13px;
            outline: none;
            transition: border-color 0.12s ease;
          }

          .date-input:focus {
            border-color: #16a34a;
            box-shadow: 0 0 0 2px rgba(22,163,74,0.12);
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 14px 18px;
            border-top: 1px solid #e5e7eb;
          }

          .cancel-btn {
            padding: 8px 16px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 7px;
            color: #374151;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.12s ease;
          }

          .cancel-btn:hover { background: #f1f5f9; border-color: #d1d5db; }

          .confirm-btn {
            padding: 8px 20px;
            background: #16a34a;
            border: none;
            border-radius: 7px;
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.12s ease;
          }

          .confirm-btn:hover:not(:disabled) { background: #15803d; }
          .confirm-btn:disabled { background: #bbf7d0; color: #6b7280; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}









