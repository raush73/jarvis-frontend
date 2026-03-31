'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type {
  Order,
  Trade,
  Bucket,
  BucketId,
  Candidate,
  CandidateSignals,
  ClosedDisposition,
  AltTradeInfo,
  CustomerApprovalStatusType,
} from '@/data/mockRecruitingData';

/**
 * Backend response types — mirroring the enriched shape from
 * GET /recruiting/order/:orderId/candidates (Phase 5 getCandidatesForOrder).
 */
interface BackendCandidate {
  id: string;
  orderId: string;
  candidateId: string;
  status: string;
  bucket: string;
  customerApprovalStatus: string;
  selectedForDispatch: boolean;
  selectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
  originalTrade: {
    orderTradeRequirementId: string;
    tradeId: string;
    tradeName: string;
    startDate: string | null;
    expectedEndDate: string | null;
    requestedHeadcount: number;
  } | null;
  closed: {
    disposition: string | null;
    closedAt: string | null;
    closedByUser: { id: string; fullName: string } | null;
    note: string | null;
  } | null;
  altTrade: {
    orderTradeRequirementId: string;
    tradeId: string | null;
    tradeName: string | null;
    accepted: boolean;
    confirmationMethod: string | null;
    confirmedAt: string | null;
    confirmedByUser: { id: string; fullName: string } | null;
    note: string | null;
  } | null;
  computed: {
    isClosed: boolean;
    hasAltTradeProposal: boolean;
    isAltTradeAccepted: boolean;
    reopenedAt: string | null;
  };
  signals: {
    candidateStatus: string;
    readiness: string;
    blockers: string[];
    hardGates: {
      certifications: { met: number; total: number; items?: unknown[] };
      compliance: { met: number; total: number; items?: unknown[] };
    };
    softSignals: {
      tools: { met: number; total: number; deferred?: boolean };
      ppe: { met: number; total: number };
      capabilities: { matched: number; total: number };
    };
    availability?: {
      available: boolean;
      reason?: string;
      conflictingOrderId?: string;
    };
  } | null;
}

interface BackendTradeRequirement {
  id: string;
  tradeId: string;
  trade: { id: string; name: string };
  requestedHeadcount: number;
  startDate: string | null;
  expectedEndDate: string | null;
}

interface BackendOrder {
  id: string;
  title: string;
  customer: { id: string; name: string } | null;
  jobSiteCity: string | null;
  jobSiteState: string | null;
  jobSiteAddress1: string | null;
  tradeRequirements: BackendTradeRequirement[];
}

const CANONICAL_BUCKETS: BucketId[] = [
  'OPTED_IN',
  'AWAITING_CANDIDATE_ACTION',
  'MW4H_APPROVED',
  'PRE_DISPATCH',
  'DISPATCHED',
  'CLOSED',
];

const BUCKET_DEFINITIONS: { id: BucketId; name: string; description: string }[] = [
  { id: 'OPTED_IN', name: 'Opted-In', description: 'Candidates who opted in for this specific job' },
  { id: 'AWAITING_CANDIDATE_ACTION', name: 'Awaiting Candidate Action', description: 'Worker-blocked: docs, certs, reconfirm needed' },
  { id: 'MW4H_APPROVED', name: 'MW4H Approved', description: 'Approved candidates ready for consideration' },
  { id: 'PRE_DISPATCH', name: 'Pre-Dispatch', description: 'Ready for dispatch assignment' },
  { id: 'DISPATCHED', name: 'Dispatched', description: 'Actively dispatched to job site' },
  { id: 'CLOSED', name: 'Closed', description: 'No longer in active recruiting flow' },
];

function mapBackendCandidateToShell(bc: BackendCandidate): Candidate {
  const name = `${bc.candidate.firstName} ${bc.candidate.lastName}`.trim();
  const tradeName = bc.originalTrade?.tradeName ?? '';
  const tradeId = bc.originalTrade?.tradeId ?? '';

  let closedDisposition: ClosedDisposition | undefined;
  if (bc.closed?.disposition === 'NOT_SELECTED' || bc.closed?.disposition === 'REJECTED') {
    closedDisposition = bc.closed.disposition;
  }

  let altTrade: AltTradeInfo | undefined;
  if (bc.altTrade && bc.altTrade.tradeName) {
    altTrade = {
      tradeName: bc.altTrade.tradeName,
      accepted: bc.altTrade.accepted,
      confirmationMethod: bc.altTrade.confirmationMethod as AltTradeInfo['confirmationMethod'],
      confirmedAt: bc.altTrade.confirmedAt ?? undefined,
      confirmedByName: bc.altTrade.confirmedByUser?.fullName ?? undefined,
      note: bc.altTrade.note ?? undefined,
    };
  }

  let signals: CandidateSignals | undefined;
  if (bc.signals) {
    signals = {
      candidateStatus: bc.signals.candidateStatus as CandidateSignals['candidateStatus'],
      readiness: bc.signals.readiness as CandidateSignals['readiness'],
      blockers: bc.signals.blockers,
      hardGates: {
        certifications: { met: bc.signals.hardGates.certifications.met, total: bc.signals.hardGates.certifications.total },
        compliance: { met: bc.signals.hardGates.compliance.met, total: bc.signals.hardGates.compliance.total },
      },
      softSignals: {
        tools: { met: bc.signals.softSignals.tools.met, total: bc.signals.softSignals.tools.total, deferred: bc.signals.softSignals.tools.deferred },
        ppe: { met: bc.signals.softSignals.ppe.met, total: bc.signals.softSignals.ppe.total },
        capabilities: { matched: bc.signals.softSignals.capabilities.matched, total: bc.signals.softSignals.capabilities.total },
      },
      availability: bc.signals.availability ?? undefined,
    };
  }

  const customerApprovalStatus = bc.customerApprovalStatus as CustomerApprovalStatusType | undefined;

  return {
    id: bc.id,
    name,
    tradeId,
    tradeName,
    phone: bc.candidate.phone ?? '',
    email: bc.candidate.email ?? '',
    distance: 0,
    sourceType: 'recruiter',
    certifications: [],
    availability: 'available',
    closedDisposition,
    originalTradeName: tradeName,
    altTrade,
    signals,
    customerApprovalStatus: customerApprovalStatus !== 'NOT_REQUIRED' ? customerApprovalStatus : undefined,
    selectedForDispatch: bc.selectedForDispatch,
    selectedAt: bc.selectedAt ?? undefined,
  };
}

function buildBuckets(backendCandidates: BackendCandidate[]): Bucket[] {
  const grouped: Record<BucketId, Candidate[]> = {
    OPTED_IN: [],
    AWAITING_CANDIDATE_ACTION: [],
    MW4H_APPROVED: [],
    PRE_DISPATCH: [],
    DISPATCHED: [],
    CLOSED: [],
  };

  for (const bc of backendCandidates) {
    const bucketId = (CANONICAL_BUCKETS.includes(bc.bucket as BucketId) ? bc.bucket : 'OPTED_IN') as BucketId;
    grouped[bucketId].push(mapBackendCandidateToShell(bc));
  }

  return BUCKET_DEFINITIONS.map((def) => ({
    ...def,
    candidates: grouped[def.id],
  }));
}

function buildTrades(tradeReqs: BackendTradeRequirement[], dispatchedCandidates: Candidate[]): Trade[] {
  return tradeReqs.map((tr) => {
    const dispatched = dispatchedCandidates.filter((c) => c.tradeId === tr.tradeId).length;
    return {
      id: tr.tradeId,
      name: tr.trade.name,
      totalRequired: tr.requestedHeadcount,
      dispatched,
    };
  });
}

function buildLocation(order: BackendOrder): string {
  const parts = [order.jobSiteAddress1, order.jobSiteCity, order.jobSiteState].filter(Boolean);
  return parts.join(', ') || 'Location not set';
}

export type VettingDataState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; order: Order };

export interface OrderTradeLineInfo {
  id: string;
  tradeId: string;
  tradeName: string;
  startDate: string | null;
  expectedEndDate: string | null;
  requestedHeadcount: number;
}

export function useVettingData(orderId: string | undefined): {
  state: VettingDataState;
  refetch: () => void;
  tradeLines: OrderTradeLineInfo[];
} {
  const [state, setState] = useState<VettingDataState>({ status: 'loading' });
  const [tradeLines, setTradeLines] = useState<OrderTradeLineInfo[]>([]);

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    setState({ status: 'loading' });

    try {
      const [backendOrder, backendCandidates] = await Promise.all([
        apiFetch<BackendOrder>(`/orders/${orderId}`),
        apiFetch<BackendCandidate[]>(`/recruiting/order/${orderId}/candidates`),
      ]);

      setTradeLines(
        (backendOrder.tradeRequirements ?? []).map((tr) => ({
          id: tr.id,
          tradeId: tr.tradeId,
          tradeName: tr.trade.name,
          startDate: tr.startDate,
          expectedEndDate: tr.expectedEndDate,
          requestedHeadcount: tr.requestedHeadcount,
        })),
      );

      const buckets = buildBuckets(backendCandidates);
      const dispatchedBucket = buckets.find((b) => b.id === 'DISPATCHED');
      const trades = buildTrades(backendOrder.tradeRequirements ?? [], dispatchedBucket?.candidates ?? []);

      const startDates = (backendOrder.tradeRequirements ?? [])
        .map((tr) => tr.startDate)
        .filter(Boolean) as string[];
      const endDates = (backendOrder.tradeRequirements ?? [])
        .map((tr) => tr.expectedEndDate)
        .filter(Boolean) as string[];

      const order: Order = {
        id: backendOrder.id,
        projectName: backendOrder.title ?? 'Untitled Order',
        customerName: backendOrder.customer?.name ?? 'Unknown Customer',
        location: buildLocation(backendOrder),
        startDate: startDates.length > 0 ? startDates.sort()[0] : '',
        endDate: endDates.length > 0 ? endDates.sort().reverse()[0] : '',
        requiresCustomerPreApproval: false,
        trades,
        buckets,
      };

      setState({ status: 'ready', order });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load vetting data';
      setState({ status: 'error', error: msg });
    }
  }, [orderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { state, refetch: fetchData, tradeLines };
}
