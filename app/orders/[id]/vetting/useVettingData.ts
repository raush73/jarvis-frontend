'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getOnboardingPreDispatchStatus } from '@/lib/workforce/onboardingStatusApi';
import { getPreDispatchWorkerRequest } from '@/lib/recruiting/preDispatchWorkerRequestApi';
import { getJobOfferHistory } from '@/lib/recruiting/jobOfferLifecycleApi';
import type {
  Order,
  Trade,
  Bucket,
  BucketId,
  Candidate,
  OnboardingPreDispatchReadiness,
  PreDispatchWorkerRequestRead,
  JobOfferHistoryRead,
  CandidateSignals,
  CertSignalItem,
  ComplianceSignalItem,
  PpeSignalItem,
  ToolSignalItem,
  ClosedDisposition,
  AltTradeInfo,
  CustomerApprovalStatusType,
  AssignmentInfo,
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
  assignment: {
    assignmentId: string;
    assignmentStatus: string;
    dispatchedAt: string | null;
    startDate: string | null;
    expectedEndDate: string | null;
    orderTradeRequirementId: string | null;
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
      certifications: { met: number; total: number; items?: CertSignalItem[] };
      compliance: { met: number; total: number; items?: ComplianceSignalItem[] };
    };
    softSignals: {
      tools: { met: number; total: number; deferred?: boolean; items?: ToolSignalItem[] };
      ppe: { met: number; total: number; items?: PpeSignalItem[] };
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

export interface StaffingTradeRow {
  tradeId: string;
  tradeName: string;
  requested: number;
  dispatched: number;
  adjustments: number;
  open: number;
  hasOpenings: boolean;
  fullyStaffed: boolean;
}

export interface StaffingResolution {
  summary: {
    requested: number;
    dispatched: number;
    adjustments: number;
    open: number;
    hasOpenings: boolean;
    fullyStaffed: boolean;
  };
  trades: StaffingTradeRow[];
}

interface BackendOrder {
  id: string;
  title: string;
  customer: { id: string; name: string } | null;
  jobSiteCity: string | null;
  jobSiteState: string | null;
  jobSiteAddress1: string | null;
  tradeRequirements: BackendTradeRequirement[];
  staffing?: StaffingResolution;
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

  /**
   * The closure reason, narrowed from the backend's raw string to the dispositions the shell knows.
   *
   * IT STAYS AN ALLOWLIST RATHER THAN A CAST. An unrecognised value becomes `undefined` and the card
   * simply shows no reason, which is the safe outcome: a future backend disposition would render as
   * nothing rather than as a wrong label or a raw enum name in front of staff.
   *
   * PHASE 17 S4 ADDED `WORKER_WITHDREW`, WHICH THE BACKEND HAS ALWAYS SENT. S3 introduced the
   * disposition and the API returned it from the start, but this narrowing dropped it, so a worker's
   * own withdrawal arrived and was discarded. Admitting it here is the whole of the data change
   * Ruling C needs.
   */
  let closedDisposition: ClosedDisposition | undefined;
  if (
    bc.closed?.disposition === 'NOT_SELECTED' ||
    bc.closed?.disposition === 'REJECTED' ||
    bc.closed?.disposition === 'WORKER_WITHDREW'
  ) {
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
        certifications: {
          met: bc.signals.hardGates.certifications.met,
          total: bc.signals.hardGates.certifications.total,
          items: bc.signals.hardGates.certifications.items,
        },
        compliance: {
          met: bc.signals.hardGates.compliance.met,
          total: bc.signals.hardGates.compliance.total,
          items: bc.signals.hardGates.compliance.items,
        },
      },
      softSignals: {
        tools: {
          met: bc.signals.softSignals.tools.met,
          total: bc.signals.softSignals.tools.total,
          deferred: bc.signals.softSignals.tools.deferred,
          items: bc.signals.softSignals.tools.items,
        },
        ppe: {
          met: bc.signals.softSignals.ppe.met,
          total: bc.signals.softSignals.ppe.total,
          items: bc.signals.softSignals.ppe.items,
        },
        capabilities: { matched: bc.signals.softSignals.capabilities.matched, total: bc.signals.softSignals.capabilities.total },
      },
      availability: bc.signals.availability ?? undefined,
    };
  }

  const customerApprovalStatus = bc.customerApprovalStatus as CustomerApprovalStatusType | undefined;

  let assignment: AssignmentInfo | undefined;
  if (bc.assignment) {
    assignment = {
      assignmentId: bc.assignment.assignmentId,
      assignmentStatus: bc.assignment.assignmentStatus,
      dispatchedAt: bc.assignment.dispatchedAt,
      startDate: bc.assignment.startDate,
      expectedEndDate: bc.assignment.expectedEndDate,
    };
  }

  return {
    id: bc.id,
    candidateId: bc.candidateId,
    orderTradeRequirementId: bc.originalTrade?.orderTradeRequirementId,
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
    customerApprovalStatus: customerApprovalStatus ?? undefined,
    selectedForDispatch: bc.selectedForDispatch,
    selectedAt: bc.selectedAt ?? undefined,
    assignment,
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

/**
 * Gate 10C-E4 - the Vetting lane's read of authoritative Onboarding PRE_DISPATCH clearance.
 *
 * THE ONE AUTHORIZED CONSUMER of the internal PRE_DISPATCH status projection. The worker is
 * already in the lane, so the question asked here is never "may he enter PRE_DISPATCH" but
 * "HAS ONBOARDING CLEARED HIM TO CONTINUE TOWARD DISPATCH" - a fact this loader reports and
 * never acts on. Nothing here selects, stages, moves or dispatches anybody, and no verdict is
 * derived: the server's four-state vocabulary is carried through untouched.
 *
 * Read against `candidate.candidateId`, WHICH IS THE WORKFORCE `Candidate.id`. `candidate.id`
 * is the ORDER-SCOPED `OrderCandidate.id` and identifies a row in a recruiting pipeline, not
 * a worker - passing it would ask onboarding about a worker who does not exist, and would do
 * so under a staff grant and an audit event. The two are never interchangeable.
 *
 * ONE READ PER WORKER PER LOAD, and no read at all outside this lane. Successful reads are
 * audited server-side, which is why there is no polling, no timer and no revalidation loop
 * here, and why identities are de-duplicated before anything is requested: refresh follows
 * the loader's own deliberate lifecycle and nothing else.
 */
const ONBOARDING_LANE: BucketId = 'PRE_DISPATCH';

/** The Workforce identity, or nothing. A blank string is not an identity. */
function workforceCandidateId(candidate: Candidate): string | null {
  const id = candidate.candidateId;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

/** A refusal's status number, where the transport supplied one. */
function refusalStatus(reason: unknown): number | null {
  const status = (reason as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

async function attachOnboardingReadiness(buckets: Bucket[]): Promise<Bucket[]> {
  const lane = buckets.find((bucket) => bucket.id === ONBOARDING_LANE);
  if (!lane) return buckets;

  const identities = [
    ...new Set(
      lane.candidates
        .map(workforceCandidateId)
        .filter((id): id is string => id !== null),
    ),
  ];
  if (identities.length === 0) return buckets;

  // In parallel, and SETTLED rather than raced: one worker's refusal, dead session or
  // network failure isolates to that worker instead of failing the Vetting load, which
  // would take an order's whole pipeline off the screen over a status indicator.
  const outcomes = await Promise.allSettled(
    identities.map((candidateId) => getOnboardingPreDispatchStatus(candidateId)),
  );

  // Associated by POSITION AGAINST THE REQUESTED IDENTITY, never by completion order:
  // `allSettled` preserves input order, so the worker a response belongs to is fixed
  // before any of them resolve and a slow read cannot land on a different candidate.
  const readiness = new Map<string, OnboardingPreDispatchReadiness>();
  identities.forEach((candidateId, index) => {
    const outcome = outcomes[index];
    readiness.set(
      candidateId,
      outcome.status === 'fulfilled'
        ? { read: 'SUCCEEDED', status: outcome.value }
        : { read: 'FAILED', status: null, httpStatus: refusalStatus(outcome.reason) },
    );
  });

  return buckets.map((bucket) => {
    if (bucket.id !== ONBOARDING_LANE) return bucket;
    return {
      ...bucket,
      candidates: bucket.candidates.map((candidate) => {
        const id = workforceCandidateId(candidate);
        const attached = id ? readiness.get(id) : undefined;
        return attached ? { ...candidate, onboardingPreDispatch: attached } : candidate;
      }),
    };
  });
}

/**
 * Phase 17 S2 - the Vetting lane's read of the job-specific PRE_DISPATCH worker-request state.
 *
 * A SEPARATE READ FROM ONBOARDING CLEARANCE ABOVE, answering a separate question. Clearance
 * asks whether Onboarding has cleared the WORKER; this asks what is happening with the request
 * for that worker's action on THIS candidacy. The two are fetched independently, attached to
 * independent fields, and presented as independent statuses, so neither can be mistaken for the
 * other and a failure of one cannot corrupt the other.
 *
 * KEYED BY `candidate.id`, WHICH IS THE `OrderCandidate.id` - THE EXACT OPPOSITE OF THE READ
 * ABOVE. The request is job-specific: one worker can hold a request awaiting his response on
 * one order and no request at all on another. Keying this by the workforce `candidateId` would
 * merge those into a single wrong answer and show an operator a request that belongs to a
 * different job. The asymmetry between the two reads is deliberate, not an oversight.
 *
 * READING NEVER CREATES, AND NEVER SENDS. This is a GET against a server surface that is proven
 * incapable of creating a request, advancing a cycle, issuing a MagicLink, or sending anything.
 * That is why it is safe to run on every deliberate load - and why there is still no polling,
 * no timer and no revalidation loop here: refresh follows the loader's own lifecycle only.
 */
const WORKER_REQUEST_LANE: BucketId = 'PRE_DISPATCH';

/**
 * The candidacy identity, or nothing.
 *
 * Reads `candidate.id`, the ORDER-SCOPED `OrderCandidate.id`. Deliberately a separate helper
 * from `workforceCandidateId` so the two identities cannot be swapped by editing one line.
 */
function candidacyId(candidate: Candidate): string | null {
  const id = candidate.id;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

/**
 * The HTTP status of a failed staff read, where one is recoverable.
 *
 * `apiFetch` throws a plain `Error` whose message begins `API <status> ...`, so the number is
 * parsed from that format rather than read off a property the transport does not set. Returns
 * null when nothing usable is present: an invented status would be worse than no status, and
 * NOTHING IN THE PRESENTATION LAYER BRANCHES ON A VERDICT BECAUSE OF THIS VALUE - a failed read
 * is unavailable regardless of why.
 */
function staffReadStatus(reason: unknown): number | null {
  const direct = (reason as { status?: unknown } | null)?.status;
  if (typeof direct === 'number') return direct;

  const message = (reason as { message?: unknown } | null)?.message;
  if (typeof message !== 'string') return null;
  const matched = /^API\s+(\d{3})\b/.exec(message);
  return matched ? Number(matched[1]) : null;
}

async function attachWorkerRequestState(buckets: Bucket[]): Promise<Bucket[]> {
  const lane = buckets.find((bucket) => bucket.id === WORKER_REQUEST_LANE);
  if (!lane) return buckets;

  const candidacies = [
    ...new Set(
      lane.candidates.map(candidacyId).filter((id): id is string => id !== null),
    ),
  ];
  if (candidacies.length === 0) return buckets;

  // In parallel, and SETTLED rather than raced, for the same reason as the clearance read: one
  // candidacy's refusal or transport failure isolates to that candidacy instead of taking the
  // order's whole pipeline off the screen over a status line.
  const outcomes = await Promise.allSettled(
    candidacies.map((orderCandidateId) => getPreDispatchWorkerRequest(orderCandidateId)),
  );

  // Associated BY POSITION AGAINST THE REQUESTED CANDIDACY, never by completion order, so a
  // slow response cannot land on a different candidacy and report one worker's request state
  // against another worker's card.
  const reads = new Map<string, PreDispatchWorkerRequestRead>();
  candidacies.forEach((orderCandidateId, index) => {
    const outcome = outcomes[index];
    reads.set(
      orderCandidateId,
      outcome.status === 'fulfilled'
        ? { read: 'SUCCEEDED', status: outcome.value }
        : { read: 'FAILED', status: null, httpStatus: staffReadStatus(outcome.reason) },
    );
  });

  return buckets.map((bucket) => {
    if (bucket.id !== WORKER_REQUEST_LANE) return bucket;
    return {
      ...bucket,
      candidates: bucket.candidates.map((candidate) => {
        const id = candidacyId(candidate);
        const attached = id ? reads.get(id) : undefined;
        return attached ? { ...candidate, preDispatchWorkerRequest: attached } : candidate;
      }),
    };
  });
}

/**
 * Gate JO-2C - the Vetting lane's read of one candidacy's JOB OFFER history.
 *
 * Governance: VETTING_SYSTEM.md, as corrected by the JO-2C lifecycle ruling.
 *
 * WHY A THIRD PRE_DISPATCH READ RATHER THAN A WIDER ONE. It answers a third distinct question. Onboarding
 * clearance asks whether the WORKER has been cleared; the worker-request read asks what is happening with
 * the request for that worker's action on this candidacy; this asks WHETHER MW4H HAS OFFERED THIS WORKER
 * THIS JOB, AND WHAT BECAME OF IT. A worker can be fully cleared, hold no worker request, and still have
 * had an offer that MW4H rescinded last week. Folding any two of these together would eventually collapse
 * them into one indicator that answers none of the three.
 *
 * THE PROBLEM IT SOLVES. A candidacy whose offer lapsed or was rescinded STAYS in PRE_DISPATCH, and until
 * now looked exactly like a candidacy that had never been offered anything. Staff deciding whom to offer
 * next could not see that this worker had already been selected, nor - crucially - that it was MW4H and
 * not the worker who ended it.
 *
 * KEYED BY `candidate.id`, THE `OrderCandidate.id`, exactly like the worker-request read above and
 * deliberately NOT like the onboarding read. An offer is made on a candidacy: the same worker can hold a
 * rescinded offer on one order and none at all on another, and keying this by the workforce candidate id
 * would merge those into a single wrong answer.
 *
 * READING NEVER ADVANCES AN OFFER. The server derives effective state - so a cycle past its deadline reads
 * LAPSED - and deliberately persists nothing on this path. A board refresh cannot lapse, decide, rescind or
 * end an offer, which is why this is safe on every deliberate load and why there is still no polling here.
 */
const JOB_OFFER_LANE: BucketId = 'PRE_DISPATCH';

async function attachJobOfferHistory(buckets: Bucket[]): Promise<Bucket[]> {
  const lane = buckets.find((bucket) => bucket.id === JOB_OFFER_LANE);
  if (!lane) return buckets;

  const candidacies = [
    ...new Set(
      lane.candidates.map(candidacyId).filter((id): id is string => id !== null),
    ),
  ];
  if (candidacies.length === 0) return buckets;

  // SETTLED rather than raced, for the same reason as the two reads above: one candidacy's refusal or
  // transport failure isolates to that candidacy instead of taking the order's whole pipeline off the
  // screen over a history line.
  const outcomes = await Promise.allSettled(
    candidacies.map((orderCandidateId) => getJobOfferHistory(orderCandidateId)),
  );

  // Associated BY POSITION against the requested candidacy, never by completion order, so a slow response
  // cannot report one worker's offer history against another worker's card.
  const reads = new Map<string, JobOfferHistoryRead>();
  candidacies.forEach((orderCandidateId, index) => {
    const outcome = outcomes[index];
    reads.set(
      orderCandidateId,
      outcome.status === 'fulfilled'
        ? { read: 'SUCCEEDED', history: outcome.value }
        : { read: 'FAILED', history: null, httpStatus: staffReadStatus(outcome.reason) },
    );
  });

  return buckets.map((bucket) => {
    if (bucket.id !== JOB_OFFER_LANE) return bucket;
    return {
      ...bucket,
      candidates: bucket.candidates.map((candidate) => {
        const id = candidacyId(candidate);
        const attached = id ? reads.get(id) : undefined;
        return attached ? { ...candidate, jobOffer: attached } : candidate;
      }),
    };
  });
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

export type VettingOrder = Order & {
  staffing: StaffingResolution;
};

export type VettingDataState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; order: VettingOrder };

export interface OrderTradeLineInfo {
  id: string;
  tradeId: string;
  tradeName: string;
  startDate: string | null;
  expectedEndDate: string | null;
  requestedHeadcount: number;
  openCount?: number;
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

      const resolverTradeMap = new Map(
        (backendOrder.staffing?.trades ?? []).map(st => [st.tradeId, st]),
      );

      setTradeLines(
        (backendOrder.tradeRequirements ?? []).map((tr) => ({
          id: tr.id,
          tradeId: tr.tradeId,
          tradeName: tr.trade.name,
          startDate: tr.startDate,
          expectedEndDate: tr.expectedEndDate,
          requestedHeadcount: tr.requestedHeadcount,
          openCount: resolverTradeMap.get(tr.tradeId)?.open,
        })),
      );

      // THREE independent PRE_DISPATCH reads, layered in sequence over the built buckets. Each attaches
      // to its own field and none can overwrite another's attachment, so a failure of one leaves the
      // other two intact and correct.
      const buckets = await attachJobOfferHistory(
        await attachWorkerRequestState(
          await attachOnboardingReadiness(buildBuckets(backendCandidates)),
        ),
      );
      const dispatchedBucket = buckets.find((b) => b.id === 'DISPATCHED');
      const trades = buildTrades(backendOrder.tradeRequirements ?? [], dispatchedBucket?.candidates ?? []);

      const staffing: StaffingResolution = backendOrder.staffing ?? {
        summary: { requested: 0, dispatched: 0, adjustments: 0, open: 0, hasOpenings: false, fullyStaffed: true },
        trades: [],
      };

      const startDates = (backendOrder.tradeRequirements ?? [])
        .map((tr) => tr.startDate)
        .filter(Boolean) as string[];
      const endDates = (backendOrder.tradeRequirements ?? [])
        .map((tr) => tr.expectedEndDate)
        .filter(Boolean) as string[];

      const order: VettingOrder = {
        id: backendOrder.id,
        projectName: backendOrder.title ?? 'Untitled Order',
        customerName: backendOrder.customer?.name ?? 'Unknown Customer',
        location: buildLocation(backendOrder),
        startDate: startDates.length > 0 ? startDates.sort()[0] : '',
        endDate: endDates.length > 0 ? endDates.sort().reverse()[0] : '',
        requiresCustomerPreApproval: false,
        trades,
        buckets,
        staffing,
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
