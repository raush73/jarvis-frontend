'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fridayFetch } from '../../../../components/friday/fridayFetch';
import {
  type FollowUp,
  type CompanyContact,
  type ConflictResponse,
  INTENT_LABELS,
} from '../../../../components/friday/types';
import * as S from '../../../../components/friday/styles';
import { formatDueAt } from '../../../../components/friday/displayHelpers';
import FollowUpCreateModal from '../../../../components/friday/FollowUpCreateModal';
import FollowUpConflictModal from '../../../../components/friday/FollowUpConflictModal';
import CallCompletionGate from '../../../../components/friday/CallCompletionGate';
import FollowUpListSection from '../../../../components/friday/FollowUpListSection';

/* ────────────────────────────────────────────────────────────────
   Types for priority response (bucket system)
   ──────────────────────────────────────────────────────────────── */

type Bucket = 'OVERDUE' | 'DUE_TODAY' | 'STALE' | 'NORMAL';

const BUCKET_COLORS: Record<Bucket, string> = {
  OVERDUE: '#dc2626',
  DUE_TODAY: '#d97706',
  STALE: '#7c3aed',
  NORMAL: '#6b7280',
};

const BUCKET_LABELS: Record<Bucket, string> = {
  OVERDUE: 'Overdue',
  DUE_TODAY: 'Due Today',
  STALE: 'Stale',
  NORMAL: 'Normal',
};

interface CompanyPriorityResponse {
  customerId: string;
  customerName?: string;
  bucket: Bucket;
  explanationSummary: string;
  explanationFactors: string[];
  representativeFollowUp: {
    id: string;
    dueAt: string;
    hasExplicitTime: boolean;
    intentType: string;
    context: string | null;
    status: string;
  } | null;
  followUps: {
    id: string;
    dueAt: string;
    hasExplicitTime: boolean;
    intentType: string;
    context: string | null;
    status: string;
  }[];
  isStrategicTarget: boolean;
  lifecycleStatus: string;
  healthStatus: string | null;
}

/* ────────────────────────────────────────────────────────────────
   Main Company Detail Page
   ──────────────────────────────────────────────────────────────── */

export default function CompanyDetailPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [priority, setPriority] = useState<CompanyPriorityResponse | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictResponse | null>(null);
  const [showCallGate, setShowCallGate] = useState(false);
  const [activeCallEventId, setActiveCallEventId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);

    const [priorityRes, followUpsRes, contactsRes] = await Promise.all([
      fridayFetch<CompanyPriorityResponse>(
        `/friday/intelligence/company/${customerId}/priority`,
      ),
      fridayFetch<FollowUp[]>(
        `/friday/follow-ups/company/${customerId}`,
      ),
      fridayFetch<CompanyContact[]>(
        `/friday/contacts/company/${customerId}`,
      ),
    ]);

    if (priorityRes.ok) setPriority(priorityRes.data);
    else setError(priorityRes.error);

    if (followUpsRes.ok) setFollowUps(followUpsRes.data);
    if (contactsRes.ok) setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);

    setLoading(false);
  }, [customerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openFollowUps = followUps.filter((fu) => fu.status === 'OPEN');
  const historicalFollowUps = followUps.filter((fu) => fu.status !== 'OPEN');

  if (loading) {
    return (
      <div style={pageContainer}>
        <p style={{ color: S.FC.textMuted, fontSize: '0.875rem' }}>Loading company detail...</p>
      </div>
    );
  }

  if (error && !priority) {
    return (
      <div style={pageContainer}>
        <Link href="/friday/intelligence" style={backLinkStyle}>&larr; Back to Intelligence</Link>
        <p style={{ color: S.FC.accentRed, fontSize: '0.875rem', marginTop: '1rem' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <Link href="/friday/intelligence" style={backLinkStyle}>&larr; Back to Intelligence</Link>

      {/* Company Header */}
      {priority && (
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: S.FC.textPrimary, margin: 0 }}>
              {priority.customerName || 'Unknown Company'}
            </h1>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#fff',
              background: BUCKET_COLORS[priority.bucket] ?? '#6b7280',
              textTransform: 'uppercase',
            }}>
              {BUCKET_LABELS[priority.bucket] ?? priority.bucket}
            </span>
            {priority.isStrategicTarget && (
              <span style={{
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: '0.625rem',
                fontWeight: 700,
                color: '#b45309',
                background: '#fef3c7',
              }}>
                STRATEGIC
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: S.FC.textSecondary, margin: '4px 0' }}>
            {priority.explanationSummary}
          </p>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: S.FC.textMuted }}>
            <span>Lifecycle: <span style={{ color: S.FC.textSecondary, textTransform: 'capitalize' }}>{priority.lifecycleStatus.toLowerCase()}</span></span>
            {priority.healthStatus && (
              <span>Health: <HealthBadge status={priority.healthStatus} /></span>
            )}
          </div>
          {priority.explanationFactors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {priority.explanationFactors.map((f, i) => (
                <li key={i} style={{ fontSize: '0.75rem', color: S.FC.textMuted, marginBottom: 2 }}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setShowCreateModal(true)}
          style={S.btnPrimary}
        >
          + Create Follow-up
        </button>
        <button
          onClick={() => {
            const callId = prompt('Enter Call Event ID to complete:');
            if (callId) {
              setActiveCallEventId(callId);
              setShowCallGate(true);
            }
          }}
          style={S.btnSecondary}
        >
          Complete Call
        </button>
      </div>

      {/* Open Follow-ups */}
      <div style={{ marginBottom: 32 }}>
        <FollowUpListSection
          followUps={openFollowUps}
          title="Open Follow-ups"
          showActions={true}
          onRefresh={loadData}
        />
      </div>

      {/* Historical Follow-ups */}
      {historicalFollowUps.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <FollowUpListSection
            followUps={historicalFollowUps}
            title="Historical Follow-ups"
            showActions={false}
            onRefresh={loadData}
          />
        </div>
      )}

      {/* Company Contacts */}
      {contacts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={S.sectionTitle}>Contacts ({contacts.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contacts.map((c) => (
              <div key={c.id} style={{
                ...S.card,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                marginBottom: 0,
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: S.FC.textPrimary, fontSize: '0.8125rem' }}>
                    {c.name}
                  </span>
                  {c.title && (
                    <span style={{ color: S.FC.textMuted, fontSize: '0.75rem', marginLeft: 8 }}>
                      {c.title}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: S.FC.textMuted }}>
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bucket Follow-ups from Priority (canonical view) */}
      {priority?.representativeFollowUp && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={S.sectionTitle}>Representative Follow-up</h3>
          <div style={{ ...S.card, borderLeft: `3px solid ${BUCKET_COLORS[priority.bucket]}` }}>
            <div style={{ display: 'flex', gap: 24, fontSize: '0.8125rem' }}>
              <div>
                <span style={{ color: S.FC.textMuted }}>Due: </span>
                <span style={{ color: S.FC.textSecondary }}>
                  {formatDueAt(
                    priority.representativeFollowUp.dueAt,
                    priority.representativeFollowUp.hasExplicitTime,
                  )}
                </span>
              </div>
              <div>
                <span style={{ color: S.FC.textMuted }}>Intent: </span>
                <span style={{ color: S.FC.textSecondary }}>
                  {INTENT_LABELS[priority.representativeFollowUp.intentType as keyof typeof INTENT_LABELS] ?? priority.representativeFollowUp.intentType}
                </span>
              </div>
              <div>
                <span style={S.statusBadgeStyle(priority.representativeFollowUp.status)}>
                  {priority.representativeFollowUp.status}
                </span>
              </div>
            </div>
            {priority.representativeFollowUp.context && (
              <div style={{ marginTop: 6, fontSize: '0.8125rem', color: S.FC.textMuted }}>
                {priority.representativeFollowUp.context}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <FollowUpCreateModal
          customerId={customerId}
          contacts={contacts}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
          onConflict={(conflict) => {
            setShowCreateModal(false);
            setConflictData(conflict);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {conflictData && (
        <FollowUpConflictModal
          existingFollowUp={conflictData.existingFollowUp}
          message={conflictData.message}
          onResolved={() => {
            setConflictData(null);
            loadData();
          }}
          onClose={() => setConflictData(null)}
        />
      )}

      {showCallGate && activeCallEventId && (
        <CallCompletionGate
          callEventId={activeCallEventId}
          customerId={customerId}
          contacts={contacts}
          existingFollowUps={openFollowUps}
          onCompleted={() => {
            setShowCallGate(false);
            setActiveCallEventId(null);
            loadData();
          }}
          onConflict={(conflict) => {
            setShowCallGate(false);
            setConflictData(conflict);
          }}
          onClose={() => {
            setShowCallGate(false);
            setActiveCallEventId(null);
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Shared UI
   ──────────────────────────────────────────────────────────────── */

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HEALTHY: S.FC.accentGreen,
    AT_RISK: S.FC.accentAmber,
    STALE: S.FC.accentRed,
  };
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors[status] ?? S.FC.textMuted, textTransform: 'capitalize' }}>
      {status.toLowerCase().replace('_', ' ')}
    </span>
  );
}

const pageContainer: React.CSSProperties = {
  padding: '2rem',
  maxWidth: 960,
  margin: '0 auto',
};

const backLinkStyle: React.CSSProperties = {
  color: S.FC.accentBlue,
  textDecoration: 'none',
  fontSize: '0.8125rem',
};
