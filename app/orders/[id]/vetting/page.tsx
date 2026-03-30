'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bucket,
  Candidate,
  Trade,
  getBucketTradeBreakdown,
  getOpenSlots,
} from '@/data/mockRecruitingData';
import { BucketTradeSummary } from '@/components/BucketTradeSummary';
import { useAuth } from "@/lib/auth/useAuth";
import { EventSpineTimelineSnapshot } from "@/components/EventSpineTimelineSnapshot";
import { useVettingData } from './useVettingData';
import { AddCandidateModal } from '@/components/vetting/AddCandidateModal';

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

// Mock PPE list
const REQUIRED_PPE = [
  'Hard hat',
  'Safety glasses',
  'Hi-vis vest',
  'Gloves',
  'Steel-toe boots',
  'FR clothing',
];

// Mock tools list
const REQUIRED_TOOLS = [
  'Torque Wrenches',
  'Dial Indicators',
  'Laser Alignment Kit',
  'Rigging Equipment',
  'Multimeter',
  'Pipe Wrenches',
];

// Mock certifications required
const REQUIRED_CERTS = [
  'OSHA 30',
  'First Aid/CPR',
  'Confined Space Entry',
];

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
  
  // State for dispatch modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [dispatchDate, setDispatchDate] = useState('');
  
  // State for split-view panel (card click drill-down)
  const [splitViewCandidate, setSplitViewCandidate] = useState<Candidate | null>(null);
  
  // State for No-Show candidates (UI-only mock)
  const [noShowCandidates, setNoShowCandidates] = useState<Candidate[]>(MOCK_NO_SHOWS);

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
  const handleAddToIdentified = (candidate: Candidate) => {
    console.log('Adding to Opted-In:', candidate.name);
  };

  // Handler for dispatch
  const handleDispatch = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowDispatchModal(true);
  };

  // Handler for card click - opens split view
  const handleCardClick = (candidate: Candidate) => {
    setSplitViewCandidate(candidate);
  };
  
  // Handler for redispatching a no-show
  const handleRedispatch = (candidate: Candidate) => {
    setNoShowCandidates(prev => prev.filter(c => c.id !== candidate.id));
    console.log('Redispatching:', candidate.name);
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
                  onDispatch={handleDispatch}
                  onCardClick={handleCardClick}
                  isAuthenticated={isAuthenticated}
                  demoTitle={demoTitle}
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
                  onDispatch={handleDispatch}
                  onCardClick={handleCardClick}
                  isAuthenticated={isAuthenticated}
                  demoTitle={demoTitle}
                />
              )}
            </div>

            {/* Customer Approval Gate (Side Panel — gate only, not a bucket) */}
            <CustomerApprovalGate
              bucket={undefined}
              requiresPreApproval={requiresPreApproval}
              onToggle={setRequiresPreApproval}
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
            requiredPPE={REQUIRED_PPE}
            requiredTools={REQUIRED_TOOLS}
            requiredCerts={REQUIRED_CERTS}
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

      {/* Dispatch Modal */}
      {showDispatchModal && selectedCandidate && (
        <DispatchModal
          candidate={selectedCandidate}
          dispatchDate={dispatchDate}
          onDateChange={setDispatchDate}
          onClose={() => {
            setShowDispatchModal(false);
            setSelectedCandidate(null);
            setDispatchDate('');
          }}
          onConfirm={() => {
            console.log('Dispatching:', selectedCandidate.name, 'on', dispatchDate);
            setShowDispatchModal(false);
            setSelectedCandidate(null);
            setDispatchDate('');
          }}
          isAuthenticated={isAuthenticated}
          demoTitle={demoTitle}
        />
      )}

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
  onDispatch,
  onCardClick,
  isAuthenticated,
  demoTitle,
}: {
  bucket: Bucket;
  trades: Trade[];
  laneName: string;
  laneDescription: string;
  isLast?: boolean;
  onDispatch: (candidate: Candidate) => void;
  onCardClick: (candidate: Candidate) => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const tradeBreakdown = getBucketTradeBreakdown(bucket, trades);
  const isDispatchedBucket = bucket.id === 'DISPATCHED';
  const isPreDispatchBucket = bucket.id === 'PRE_DISPATCH';
  const showSemantics = bucket.id === 'OPTED_IN' || bucket.id === 'AWAITING_CANDIDATE_ACTION';

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
        <BucketTradeSummary tradeCounts={tradeBreakdown} />
      </div>

      <div className="lane-candidates">
        {bucket.candidates.length === 0 ? (
          <div className="empty-state">No candidates</div>
        ) : (
          bucket.candidates.map(candidate => (
            <VettingCandidateCard
              key={candidate.id}
              candidate={candidate}
              showSemantics={showSemantics}
              showDispatchButton={isPreDispatchBucket}
              showDispatchDate={isDispatchedBucket}
              onDispatch={() => onDispatch(candidate)}
              onClick={() => onCardClick(candidate)}
              isAuthenticated={isAuthenticated}
              demoTitle={demoTitle}
            />
          ))
        )}
      </div>

      {!isLast && !isDispatchedBucket && (
        <div className="lane-actions">
          <button className="action-btn" disabled title={demoTitle}>
            Move Selected →
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
        }
      `}</style>
    </div>
  );
}

// Vetting Candidate Card with Semantics
function VettingCandidateCard({
  candidate,
  showSemantics,
  showDispatchButton,
  showDispatchDate,
  onDispatch,
  onClick,
  isAuthenticated,
  demoTitle,
}: {
  candidate: Candidate;
  showSemantics: boolean;
  showDispatchButton?: boolean;
  showDispatchDate?: boolean;
  onDispatch: () => void;
  onClick: () => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const [editableDate, setEditableDate] = useState(candidate.dispatchStartDate || '');
  const source = SOURCE_LABELS[candidate.sourceType] || SOURCE_LABELS.recruiter;
  const readiness = getReadinessSignal(candidate);
  const eligibility = getEligibilitySummary(candidate);

  const readinessColors = {
    green: '#22c55e',
    yellow: '#f59e0b',
    red: '#ef4444',
  };

  return (
    <div className="candidate-card" onClick={onClick}>
      <div className="card-header">
        <div className="candidate-info">
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

      {showDispatchDate && (
        <div className="dispatch-date-edit">
          <label className="date-label">Start Date:</label>
          <input
            type="date"
            className="date-input"
            disabled={!isAuthenticated}
            title={!isAuthenticated ? demoTitle : undefined}
            value={editableDate}
            onChange={(e) => setEditableDate(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showDispatchButton && (
        <button 
          className="dispatch-btn" 
          disabled={!isAuthenticated} 
          title={!isAuthenticated ? demoTitle : undefined} 
          onClick={(e) => { e.stopPropagation(); if (!isAuthenticated) return; onDispatch(); }}
        >
          🚀 Dispatch
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

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 4px;
        }

        .candidate-info {
          display: flex;
          flex-direction: column;
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

        .dispatch-date-edit {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
          margin-top: 6px;
        }

        .date-label {
          font-size: 9px;
          color: #6b7280;
        }

        .date-input {
          flex: 1;
          padding: 4px 6px;
          background: #ffffff;
          border: 1px solid #bbf7d0;
          border-radius: 3px;
          color: #16a34a;
          font-size: 10px;
          font-weight: 600;
          outline: none;
        }

        .dispatch-btn {
          width: 100%;
          padding: 6px;
          margin-top: 6px;
          background: #16a34a;
          border: none;
          border-radius: 4px;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .dispatch-btn:hover:not(:disabled) { background: #15803d; }
        .dispatch-btn:disabled { background: #bbf7d0; color: #6b7280; cursor: not-allowed; }
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
  requiresPreApproval,
  onToggle,
  onCardClick,
  isAuthenticated,
  demoTitle,
}: {
  bucket: Bucket | undefined;
  requiresPreApproval: boolean;
  onToggle: (value: boolean) => void;
  onCardClick: (candidate: Candidate) => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const pendingCount = bucket?.candidates.length || 0;

  // Mock approval context values (UI-only, read-only)
  const mockApprovalRequired = true; // Default to YES per spec
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
            <span className={`context-value ${mockApprovalRequired ? 'yes' : 'no'}`}>
              {mockApprovalRequired ? 'YES' : 'NO'}
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

      {requiresPreApproval && (
        <>
          <div className="gate-status">
            <span className="status-indicator pending"></span>
            <span className="status-text">Pending customer approval</span>
            <span className="status-count">{pendingCount}</span>
          </div>

          {bucket && bucket.candidates.length > 0 && (
            <div className="gate-candidates">
              {bucket.candidates.map(candidate => (
                <div key={candidate.id} className="gate-card" onClick={() => onCardClick(candidate)}>
                  <span className="candidate-name">{candidate.name}</span>
                  <span className="candidate-trade">{candidate.tradeName}</span>
                  <span className="pending-badge">Awaiting</span>
                </div>
              ))}
            </div>
          )}

          <button className="approve-btn" disabled title={demoTitle}>
            Request Customer Approval
          </button>
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
          width: 100%;
        }

        .pending-badge {
          font-size: 8px;
          padding: 2px 5px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #d97706;
          border-radius: 3px;
          font-weight: 700;
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

// Split View Panel (Card Drill-Down Scaffold)
function SplitViewPanel({
  candidate,
  requiredPPE,
  requiredTools,
  requiredCerts,
  onClose,
}: {
  candidate: Candidate;
  requiredPPE: string[];
  requiredTools: string[];
  requiredCerts: string[];
  onClose: () => void;
}) {
  // Mock data for employee profile
  const workerPPE = ['Hard hat', 'Safety glasses', 'Steel-toe boots'];
  const workerTools = ['Torque Wrenches', 'Multimeter', 'Pipe Wrenches'];
  const workerCertNames = candidate.certifications.map(c => c.name);
  
  const missingPPE = requiredPPE.filter(item => !workerPPE.includes(item));
  const missingTools = requiredTools.filter(tool => !workerTools.includes(tool));
  const missingCerts = requiredCerts.filter(cert => !workerCertNames.includes(cert));

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
              {candidate.certifications.map(cert => (
                <span key={cert.id} className={`cert-item ${cert.verified ? 'verified' : 'pending'}`}>
                  {cert.verified ? '✓' : '○'} {cert.name}
                </span>
              ))}
            </div>
          </div>

          <div className="profile-group">
            <h4>Resume</h4>
            <button className="placeholder-btn" disabled>View Resume (PDF)</button>
          </div>
        </div>

        {/* Right: Job Eligibility Checklist (Order-Specific) */}
        <div className="eligibility-section">
          <div className="section-header">
            <h3>Job Eligibility Checklist</h3>
            <span className="section-badge order">This Order</span>
          </div>

          <div className="checklist-group">
            <h4>Required Certifications</h4>
            <ul className="checklist">
              {requiredCerts.map(cert => {
                const isMissing = missingCerts.includes(cert);
                return (
                  <li key={cert} className={isMissing ? 'missing' : 'satisfied'}>
                    <span className="check-icon">{isMissing ? '⚠️' : '✓'}</span>
                    {cert}
                    {isMissing && <span className="missing-tag">MISSING</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="checklist-group">
            <h4>Required Tools</h4>
            <ul className="checklist">
              {missingTools.length === 0 ? (
                <li className="all-good">✓ All required tools available</li>
              ) : (
                missingTools.map(tool => (
                  <li key={tool} className="missing">
                    <span className="check-icon">⚠️</span>
                    {tool}
                    <span className="missing-tag">MISSING</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="checklist-group">
            <h4>Required PPE</h4>
            <ul className="checklist">
              {requiredPPE.map(item => {
                const isMissing = missingPPE.includes(item);
                return (
                  <li key={item} className={isMissing ? 'missing' : 'satisfied'}>
                    <span className="check-icon">{isMissing ? '⚠️' : '✓'}</span>
                    {item}
                    {isMissing && <span className="missing-tag">MISSING</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="checklist-group">
            <h4>Distance / Travel</h4>
            <div className="travel-info">
              <span className="travel-item">📍 {candidate.distance} miles from site</span>
              <span className="travel-item">🚗 Est. 25 min commute</span>
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

// Dispatch Modal Component
function DispatchModal({
  candidate,
  dispatchDate,
  onDateChange,
  onClose,
  onConfirm,
  isAuthenticated,
  demoTitle,
}: {
  candidate: Candidate;
  dispatchDate: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const canConfirm = dispatchDate.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🚀 Dispatch Worker</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="worker-preview">
            <span className="worker-name">{candidate.name}</span>
            <span className="worker-trade">{candidate.tradeName}</span>
          </div>

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

          <div className="dispatch-preview">
            <h4>Dispatch Summary</h4>
            <div className="preview-row">
              <span className="preview-label">Worker:</span>
              <span className="preview-value">{candidate.name}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">Trade:</span>
              <span className="preview-value">{candidate.tradeName}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">Start Date:</span>
              <span className="preview-value">{dispatchDate || '—'}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="confirm-btn"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            Confirm Dispatch
          </button>
        </div>

        <style jsx>{`
          /* Dispatch Modal — IL V1 light */
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
            max-width: 420px;
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
            background: #f1f5f9;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 15px;
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

          .modal-body { padding: 18px; }

          .worker-preview {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 14px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .worker-name {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
          }

          .worker-trade {
            font-size: 12px;
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

          .dispatch-preview {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px;
          }

          .dispatch-preview h4 {
            margin: 0 0 10px 0;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
          }

          .preview-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .preview-row:last-child { border-bottom: none; }

          .preview-label {
            font-size: 12px;
            color: #6b7280;
          }

          .preview-value {
            font-size: 12px;
            font-weight: 600;
            color: #111827;
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



