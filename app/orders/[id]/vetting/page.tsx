'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import {
  Bucket,
  BucketId,
  Candidate,
  ClosedDisposition,
  Trade,
  getBucketTradeBreakdown,
  CustomerApprovalStatusType,
  CertSignalItem,
  ComplianceSignalItem,
  PpeSignalItem,
  ToolSignalItem,
  OnboardingPreDispatchReadiness,
  PreDispatchWorkerRequestRead,
  JobOfferHistoryRead,
} from '@/data/mockRecruitingData';
import {
  extendJobOfferDeadline,
  rescindJobOffer,
} from '@/lib/recruiting/jobOfferLifecycleApi';
import type { PreDispatchInterestResult } from '@/lib/recruiting/preDispatchWorkerRequestApi';
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

/**
 * Gate 10C-E4 - HOW AN AUTHORITATIVE ONBOARDING CLEARANCE VERDICT IS WORDED, AND THE ONE
 * PLACE IT IS WORDED.
 *
 * The card and the detail panel must never be able to disagree about a worker, so both read
 * this function and neither interprets `readinessState` itself. What it maps is the SERVER'S
 * verdict onto the Owner-ratified wording, and nothing else: no verdict is computed here, no
 * verdict is corrected, and the four governed states are the only ones with a business
 * meaning.
 *
 * THE WORKER IS ALREADY IN PRE_DISPATCH, so the question this wording answers is clearance
 * to CONTINUE toward Dispatch. That is why nothing here says "ready for pre-dispatch" or
 * "eligible for pre-dispatch" - he is already there, and saying so would answer a question
 * nobody asked.
 *
 * UNREADABLE IS NOT A VERDICT, AND IS THE DEFAULT. A failed read, a missing attachment and
 * an unrecognized state all resolve to `UNAVAILABLE` - never to cleared, and never to not
 * cleared either, because inventing a negative verdict about a worker is as wrong as
 * inventing a positive one. `UNAVAILABLE` is reached by falling through rather than by being
 * asked for, so a state this function does not understand cannot come out green.
 */
type OnboardingClearanceTone = 'CLEARED' | 'NOT_CLEARED' | 'UNAVAILABLE';

type OnboardingClearancePresentation = {
  tone: OnboardingClearanceTone;
  /** The card's wording. Always rendered as text, never carried by colour alone. */
  label: string;
  /** The detail panel's `Status:` value. */
  statusWord: string;
  /** The detail panel's `Reason:` value, where the verdict has one. */
  reason: string | null;
  /**
   * That an outstanding requirement is withheld as confidential - NEVER WHICH ONE, AND NEVER
   * HOW MANY. The server sends a count so that the verdict is not a lie; this carries only
   * its existence, so the panel can explain a blockage without naming a module, implying
   * Payroll Payment, or disclosing a protected fact.
   */
  confidentialOutstanding: boolean;
  /** The SERVER'S timestamp, and only where the server supplied one. Never request time. */
  generatedAt: string | null;
};

const ONBOARDING_CLEARANCE_UNAVAILABLE: OnboardingClearancePresentation = {
  tone: 'UNAVAILABLE',
  label: 'Onboarding Status Unavailable',
  statusWord: 'Unavailable',
  reason: null,
  confidentialOutstanding: false,
  generatedAt: null,
};

function presentOnboardingClearance(
  readiness: OnboardingPreDispatchReadiness | undefined,
): OnboardingClearancePresentation {
  // `undefined` is "never asked" and `FAILED` is "asked, unanswerable". Neither is a fact
  // about the worker, so both are presented identically and neither reaches a verdict.
  if (!readiness || readiness.read === 'FAILED') return ONBOARDING_CLEARANCE_UNAVAILABLE;

  const status = readiness.status;
  const notCleared = (reason: string): OnboardingClearancePresentation => ({
    tone: 'NOT_CLEARED',
    label: 'Onboarding Not Cleared',
    statusWord: 'Not Cleared',
    reason,
    confidentialOutstanding: status.withheldConfidentialCount > 0,
    generatedAt: status.generatedAt,
  });

  switch (status.readinessState) {
    case 'READY':
      return {
        tone: 'CLEARED',
        label: 'Onboarding Cleared',
        statusWord: 'Cleared',
        reason: null,
        confidentialOutstanding: false,
        generatedAt: status.generatedAt,
      };
    case 'NO_ONBOARDING_ON_FILE':
      return notCleared('No onboarding on file');
    case 'WORKER_OBLIGATIONS_OUTSTANDING':
      return notCleared('Worker action required');
    case 'VERIFICATION_OUTSTANDING':
      return notCleared('Verification required');
    default:
      return ONBOARDING_CLEARANCE_UNAVAILABLE;
  }
}

/** The tone as a class suffix, so the stylesheet and the verdict cannot drift apart. */
function onboardingClearanceClass(tone: OnboardingClearanceTone): string {
  return tone === 'CLEARED' ? 'oc-cleared' : tone === 'NOT_CLEARED' ? 'oc-not-cleared' : 'oc-unavailable';
}

/**
 * Whether Onboarding permits this worker to be added to the dispatch-selection collection.
 *
 * Asks the verdict mapper above rather than reading `read` and `readinessState` itself, so
 * the checkbox cannot contradict the words printed next to it: a worker reading "Onboarding
 * Not Cleared" is not selectable, and one reading "Onboarding Cleared" is, by construction
 * rather than by two agreeing implementations.
 *
 * Only `CLEARED` permits selection. Every other verdict withholds the control, including the
 * ones that are not findings about the worker at all - a failed read, an absent attachment,
 * and a state the mapper does not recognise all arrive here as `UNAVAILABLE`. Unreadable is
 * therefore treated as not selectable, which is the safe direction to be wrong in.
 */
function isOnboardingClearedForDispatchSelection(candidate: Candidate): boolean {
  return presentOnboardingClearance(candidate.onboardingPreDispatch).tone === 'CLEARED';
}

/* ==========================================================================
   Phase 17 S2 - the PRE_DISPATCH worker-request state.

   A SECOND, SEPARATE STATUS SITTING BESIDE ONBOARDING CLEARANCE, AND NOT A SECOND OPINION
   ABOUT IT. Clearance answers "has Onboarding cleared this worker to continue toward
   dispatch". This answers an operational question about a different subject entirely: "what
   is happening with the job-specific request for this worker's action on this candidacy".

   The two are kept apart by construction rather than by convention:

   - separate attachment on the candidate (`preDispatchWorkerRequest`, not `onboardingPreDispatch`);
   - separate mapper below, sharing no branch with `presentOnboardingClearance`;
   - separate `pdr-` class namespace, so no request state can inherit `oc-cleared` styling;
   - separate wording, every string prefixed "Worker Request", so the subject is named in text.

   THE REQUEST STATE IS NOT A GATE AND MUST NEVER BECOME ONE HERE. It feeds no selection
   decision, no checkbox, and no dispatch control. Only Onboarding clearance does that, and
   only through `isOnboardingClearedForDispatchSelection`.
   ========================================================================== */

/**
 * How prominent a request state is, and in what colour family.
 *
 * `PENDING` and `WAITING` are deliberately the SAME neutral tone with different words. An
 * operational "we have not sent this yet" is not a failure and must not borrow the red that
 * means "Onboarding Not Cleared"; a worker who owes an answer is not a worker who has been
 * refused. `CLEARED` is the only tone permitted anything green, and only because the persisted
 * state genuinely says CLEARED.
 */
type WorkerRequestTone = 'PENDING' | 'WAITING' | 'RESPONDED' | 'CLEARED' | 'CLOSED' | 'UNAVAILABLE';

type WorkerRequestPresentation = {
  tone: WorkerRequestTone;
  /** The card's wording. Always text, never carried by colour alone. */
  label: string;
  /** The detail panel's `Request:` value. */
  statusWord: string;
  /** A short operational elaboration, where the state has one. */
  detail: string | null;
  cycleSequence: number | null;
};

const WORKER_REQUEST_UNAVAILABLE: WorkerRequestPresentation = {
  tone: 'UNAVAILABLE',
  label: 'Worker Request Unavailable',
  statusWord: 'Unavailable',
  detail: null,
  cycleSequence: null,
};

/**
 * Maps the persisted request lifecycle to staff-facing wording.
 *
 * READS THE AUTHORITATIVE `state` AND NOTHING ELSE TO CHOOSE THE WORDING. Timestamps are used
 * only to elaborate a state that has already been chosen, never to infer one. That distinction
 * is the whole reason this function exists rather than a few ternaries at the call site:
 * PENDING_INITIAL_COMMUNICATION means the request exists and NOTHING HAS BEEN SENT, and while
 * S8-S10 delivery remains blocked it is the state nearly every live request is in. Wording it
 * as "sent" or "waiting for worker" would tell an operator a worker owes an answer to a
 * question he has never been asked.
 *
 * The inverse guard matters too: AWAITING_WORKER_RESPONSE is worded as waiting ONLY because the
 * stored state says so. It is never reached by observing that `initialSentAt` is populated.
 *
 * UNAVAILABLE IS THE DEFAULT AND IS REACHED BY FALLING THROUGH. A missing attachment, a failed
 * read, a successful read reporting no current request, and an unrecognised state all resolve
 * here - never to a lifecycle state, and never to CLEARED.
 */
function presentWorkerRequest(
  attached: PreDispatchWorkerRequestRead | undefined,
): WorkerRequestPresentation {
  // `undefined` is "never asked" and `FAILED` is "asked, unanswerable". Neither is a fact about
  // the request, so both present identically and NEITHER FABRICATES A STATE.
  if (!attached || attached.read === 'FAILED') return WORKER_REQUEST_UNAVAILABLE;

  const status = attached.status;

  // A successful read can legitimately report that there is no current request: the candidacy
  // left the lane, or it entered the lane before Phase 17 existed. Reported, never invented.
  if (!status.present) {
    return {
      ...WORKER_REQUEST_UNAVAILABLE,
      label: 'No Worker Request',
      statusWord: 'None',
      detail:
        status.absence === 'NOT_IN_PRE_DISPATCH'
          ? 'Candidacy is not in Pre-Dispatch'
          : 'No request on file for this candidacy',
    };
  }

  const request = status.request;
  const cycleSequence = request.cycleSequence;

  switch (request.state) {
    case 'PENDING_INITIAL_COMMUNICATION':
      return {
        tone: 'PENDING',
        label: 'Worker Request Not Sent',
        statusWord: 'Not Sent',
        detail: 'Request created; initial communication not yet sent',
        cycleSequence,
      };
    case 'AWAITING_WORKER_RESPONSE':
      return {
        tone: 'WAITING',
        label: 'Awaiting Worker Response',
        statusWord: 'Awaiting Response',
        detail: 'Sent; waiting for the worker to respond',
        cycleSequence,
      };
    case 'WORKER_RESPONDED':
      return {
        tone: 'RESPONDED',
        label: 'Worker Responded',
        statusWord: 'Responded',
        detail: presentInterestResult(request.interestResult),
        cycleSequence,
      };
    case 'CLEARED':
      return {
        tone: 'CLEARED',
        label: 'Worker Request Cleared',
        statusWord: 'Cleared',
        detail: presentInterestResult(request.interestResult),
        cycleSequence,
      };
    case 'CLOSED':
      return {
        tone: 'CLOSED',
        label: 'Worker Request Closed',
        statusWord: 'Closed',
        detail: request.closeReason ?? null,
        cycleSequence,
      };
    default:
      // An unrecognised state is unavailable, NOT a guess. Reached by falling through, so a
      // state this mapper does not understand cannot come out looking answered or cleared.
      return { ...WORKER_REQUEST_UNAVAILABLE, cycleSequence };
  }
}

/**
 * The worker's recorded answer, in words. Null where nothing has been recorded.
 *
 * S2 only DISPLAYS a result the worker has already given. Recording one is S3.
 */
function presentInterestResult(result: PreDispatchInterestResult | null): string | null {
  if (result === 'CONTINUED_INTEREST_CONFIRMED') return 'Continued interest confirmed';
  if (result === 'WITHDRAWAL_REQUESTED') return 'Withdrawal requested';
  return null;
}

/**
 * The tone as a class suffix.
 *
 * A `pdr-` NAMESPACE, SHARING NO CLASS NAME WITH THE `oc-` CLEARANCE STYLES. A request state
 * therefore cannot pick up the clearance gate's green or red by accident, and the two
 * indicators cannot be restyled into looking like one badge by a single stylesheet edit.
 */
function workerRequestClass(tone: WorkerRequestTone): string {
  switch (tone) {
    case 'CLEARED':
      return 'pdr-cleared';
    case 'RESPONDED':
      return 'pdr-responded';
    case 'CLOSED':
      return 'pdr-closed';
    case 'PENDING':
    case 'WAITING':
      return 'pdr-pending';
    default:
      return 'pdr-unavailable';
  }
}

/**
 * Phase 17 S4, Ruling C - WHY a closed candidacy is closed, in staff-facing words.
 *
 * THE THREE REASONS ARE NOT INTERCHANGEABLE, AND THAT IS THE WHOLE POINT. "Not Selected" is a
 * staffing outcome, "Rejected" is a decision about the worker, and "Worker Withdrew" is the WORKER's
 * own choice and says nothing against them. Before S4 the board showed no reason at all on the
 * closed card, so a worker who asked to come off one job looked identical to a worker who had been
 * turned down - and the next operator to open the order had no way to tell.
 *
 * THE LABEL CARRIES THE MEANING IN TEXT, following this card's existing rule for every other status
 * row: the words say who decided, so the distinction survives greyscale and a colour-blind operator
 * rather than living in a badge colour.
 *
 * NO NEW SURFACE, DELIBERATELY. Ruling C asks for "the smallest live-surface change necessary for
 * staff to see the reason on the actual closed candidacy card they use". This is a row on that card.
 * (Note that the `ClosedLane` component further down this file is defined but never rendered, so
 * adding the reason there would have shipped nothing.)
 */
const CLOSED_DISPOSITION_LABELS: Record<ClosedDisposition, string> = {
  NOT_SELECTED: 'Not Selected',
  REJECTED: 'Rejected',
  WORKER_WITHDREW: 'Worker Withdrew',
};

/** A `cd-` namespace, sharing no class name with the clearance, request or offer rows. */
function closedDispositionClass(disposition: ClosedDisposition): string {
  switch (disposition) {
    case 'REJECTED':
      return 'cd-rejected';
    case 'WORKER_WITHDREW':
      return 'cd-withdrew';
    default:
      return 'cd-not-selected';
  }
}

/* ==========================================================================
   Gate JO-2C - the candidacy's JOB OFFER history on the PRE_DISPATCH card.

   THE PROBLEM THIS SOLVES, IN THE OWNER'S OWN TERMS. MW4H offers John Smith a job. MW4H later
   rescinds it. John stays in PRE_DISPATCH, because nothing about MW4H changing its mind says
   anything about John. Weeks later more workers are needed, an operator opens this board, and
   John's card is indistinguishable from the card of a worker nobody has ever contacted. The
   operator cannot see that John was already selected, and cannot see that it was MW4H - not
   John - who ended it. Both facts change who gets offered the job next.

   A THIRD INDICATOR, KEPT APART FROM THE OTHER TWO BY CONSTRUCTION, exactly as S2 kept the
   worker-request state apart from onboarding clearance:

   - separate attachment on the candidate (`jobOffer`, not `preDispatchWorkerRequest`);
   - separate mapper below, sharing no branch with either existing presenter;
   - separate `jo-` class namespace, so no offer state can inherit `oc-cleared` green or
     `pdr-closed` grey;
   - separate wording, every string naming "Job Offer", so the subject is named in text.

   IT IS NOT A GATE, AND MUST NEVER BECOME ONE. It feeds no checkbox, no selection decision and
   no ranking. Only Onboarding clearance gates selection, and only through
   `isOnboardingClearedForDispatchSelection`. Nothing here reorders, prioritises or scores a
   candidate: a rescinded worker is not automatically offered first, and a lapsed one is not
   pushed down.
   ========================================================================== */

/**
 * How prominent an offer outcome is, and in what colour family.
 *
 * `RESCINDED` AND `LAPSED` ARE DELIBERATELY DIFFERENT TONES, because they are opposite kinds of fact
 * and governance requires staff to tell them apart at a glance. A lapse is about the worker's silence;
 * a rescission is about MW4H's own decision.
 *
 * AND NEITHER OF THEM IS RED. Red on this board already means "Onboarding Not Cleared" - a finding
 * ABOUT THE WORKER. Governance forbids RESCINDED from visually implying worker fault or lack of
 * qualification, and MW4H withdrawing its own offer is the clearest possible case of something that is
 * not the worker's doing. `RESCINDED` is therefore given a distinct informational blue-violet that
 * appears nowhere else on the card, and `LAPSED` a neutral amber that reads as "time ran out".
 */
type JobOfferTone =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'LAPSED'
  | 'RESCINDED'
  | 'UNAVAILABLE';

type JobOfferPresentation = {
  /** Null when there is nothing to show at all - no offer was ever made, or the read failed. */
  current: { tone: JobOfferTone; label: string; deadline: string | null; jobOfferId: string } | null;
  /** The latest cycle that ENDED, where one exists. Shown even when a newer cycle is open. */
  prior: { tone: JobOfferTone; label: string; when: string | null } | null;
};

const JOB_OFFER_NOTHING_TO_SHOW: JobOfferPresentation = { current: null, prior: null };

/** A timestamp as local date and time, or null when the server sent nothing usable. */
function jobOfferMoment(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  return Number.isNaN(when.getTime())
    ? null
    : when.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

/**
 * Maps a candidacy's offer history to card wording.
 *
 * THE SERVER'S EFFECTIVE STATE IS CARRIED VERBATIM AND NEVER RECOMPUTED HERE. The backend already
 * decides that a cycle past its deadline is LAPSED; a board that worked that out for itself from
 * `respondByAt` and the browser clock would disagree with the server the moment a machine's clock was
 * off, and would show an operator an outcome the database does not hold.
 *
 * AN UNREADABLE OR ABSENT HISTORY SHOWS NOTHING, NOT A GUESS. `undefined` (never asked), `FAILED`
 * (asked, unanswerable) and a successful read of a candidacy with no offers all produce the same empty
 * presentation. Inventing "No offer made" from a failed read would be worse than silence here: an
 * operator would read it as a fact and decide staffing on it.
 */
function presentJobOffer(read: JobOfferHistoryRead | undefined): JobOfferPresentation {
  if (!read || read.read !== 'SUCCEEDED' || !read.history) return JOB_OFFER_NOTHING_TO_SHOW;

  const { current, latestTerminal } = read.history;

  const currentView = current
    ? {
        tone: 'PENDING' as JobOfferTone,
        label: 'Job Offer Pending',
        deadline: jobOfferMoment(current.respondByAt),
        jobOfferId: current.jobOfferId,
      }
    : null;

  const priorView = latestTerminal
    ? {
        tone: latestTerminal.state as JobOfferTone,
        // EVERY LABEL NAMES WHO ACTED. "MW4H Rescinded Offer" cannot be misread as the worker
        // withdrawing, and "No Response by Deadline" cannot be misread as the worker declining.
        // Colour is never the only carrier of the distinction.
        label:
          latestTerminal.state === 'RESCINDED'
            ? 'MW4H Rescinded Offer'
            : latestTerminal.state === 'LAPSED'
              ? 'No Response by Deadline'
              : latestTerminal.state === 'DECLINED'
                ? 'Worker Declined Offer'
                : 'Worker Accepted Offer',
        when: jobOfferMoment(
          latestTerminal.state === 'RESCINDED'
            ? latestTerminal.rescindedAt
            : latestTerminal.state === 'LAPSED'
              ? latestTerminal.respondByAt
              : latestTerminal.respondedAt,
        ),
      }
    : null;

  return { current: currentView, prior: priorView };
}

/**
 * A `jo-` NAMESPACE, SHARING NO CLASS NAME WITH THE `oc-` CLEARANCE OR `pdr-` REQUEST STYLES. An offer
 * outcome therefore cannot pick up the clearance gate's red or the request indicator's grey by accident,
 * and the three indicators cannot be collapsed into one look by a single stylesheet edit.
 */
function jobOfferClass(tone: JobOfferTone): string {
  switch (tone) {
    case 'PENDING':
      return 'jo-pending';
    case 'ACCEPTED':
      return 'jo-accepted';
    case 'DECLINED':
      return 'jo-declined';
    case 'LAPSED':
      return 'jo-lapsed';
    case 'RESCINDED':
      return 'jo-rescinded';
    default:
      return 'jo-unavailable';
  }
}

/**
 * Gate JO-2C. The prior-outcome filter over the PRE_DISPATCH pool.
 *
 * WHY A FILTER AT ALL. On an order with sixty PRE_DISPATCH candidacies, "which of these did we already
 * offer and rescind" is not answerable by reading sixty cards. Governance requires staff to be able to
 * narrow the pool by prior outcome, at minimum RESCINDED and LAPSED.
 *
 * IT FILTERS AND DOES NOT RANK. There is no scoring, no reordering and no automatic prioritisation:
 * choosing this filter changes WHICH cards are visible and nothing about their order or emphasis. Who
 * gets offered next remains entirely a human decision.
 */
type PriorOfferFilter = 'ALL' | 'RESCINDED' | 'LAPSED' | 'NONE';

const PRIOR_OFFER_FILTERS: { id: PriorOfferFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'RESCINDED', label: 'MW4H Rescinded' },
  { id: 'LAPSED', label: 'No Response' },
  { id: 'NONE', label: 'Never Offered' },
];

/**
 * Whether a candidate survives the prior-outcome filter.
 *
 * AN UNREADABLE HISTORY IS NEVER FILTERED OUT BY AN OUTCOME FILTER, and is never counted as "Never
 * Offered" either. Hiding a worker because a status read failed would remove a real, available candidate
 * from an operator's pool over a transport error, and claiming they were never offered anything would be
 * asserting a fact nobody established.
 */
function matchesPriorOfferFilter(candidate: Candidate, filter: PriorOfferFilter): boolean {
  if (filter === 'ALL') return true;

  const read = candidate.jobOffer;
  if (!read || read.read !== 'SUCCEEDED' || !read.history) return false;

  if (filter === 'NONE') return read.history.totalCycles === 0;
  return read.history.latestTerminal?.state === filter;
}

/* ==========================================================================
   Gate JO-2C - choosing the Job Offer response deadline at issuance.
   ========================================================================== */

/**
 * The response windows staff may pick from.
 *
 * THE PRESET IS NEVER WHAT GETS STORED. Each one is resolved to an absolute instant before the request is
 * sent, and that instant is the durable fact - "this offer is due at 3:00 PM", not "somebody clicked 4
 * hours". A stored duration would need an anchor, and the anchor becomes ambiguous the moment a
 * replacement credential is issued for a still-pending offer.
 *
 * THERE IS DELIBERATELY NO "ASAP". "ASAP" is not a duration, cannot be compared to a clock and therefore
 * could never be enforced - an offer marked ASAP would be an offer with no real deadline wearing the word
 * "urgent". Urgency is expressed as `H1`, or as an explicit custom instant.
 *
 * THE LIST MIRRORS THE BACKEND'S `JOB_OFFER_DEADLINE_PRESET_HOURS`, but constrains nothing: the server
 * accepts any future instant and validates only that it IS future, which is what makes CUSTOM possible.
 */
type DeadlinePreset = 'H1' | 'H4' | 'H8' | 'H24' | 'H48' | 'CUSTOM';

const DEADLINE_PRESETS: { id: DeadlinePreset; label: string; hours: number | null }[] = [
  { id: 'H1', label: '1 hour', hours: 1 },
  { id: 'H4', label: '4 hours', hours: 4 },
  { id: 'H8', label: '8 hours', hours: 8 },
  { id: 'H24', label: '24 hours', hours: 24 },
  { id: 'H48', label: '48 hours', hours: 48 },
  { id: 'CUSTOM', label: 'Custom', hours: null },
];

/**
 * Resolve the operator's choice to an absolute ISO instant, or null when there is no valid choice.
 *
 * NULL IS A REFUSAL, NOT A DEFAULT. Nothing here falls back to a "reasonable" window when the operator has
 * chosen nothing or typed something unusable, because inventing a deadline would be inventing a business
 * decision - and it would hide the omission rather than reporting it.
 *
 * A CUSTOM DEADLINE MUST BE IN THE FUTURE. `datetime-local` will happily hand back yesterday. An offer
 * born past its deadline could never be accepted, declined or extended, so it is refused here and again on
 * the server.
 */
function resolveRespondByAt(preset: DeadlinePreset | null, custom: string): string | null {
  if (!preset) return null;

  if (preset === 'CUSTOM') {
    if (!custom) return null;
    const chosen = new Date(custom);
    if (Number.isNaN(chosen.getTime())) return null;
    if (chosen.getTime() <= Date.now()) return null;
    return chosen.toISOString();
  }

  const hours = DEADLINE_PRESETS.find(p => p.id === preset)?.hours;
  if (!hours) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * The server's `generatedAt`, rendered as local time.
 *
 * Returns null rather than a substitute when the server sent nothing usable: an "as of" the
 * browser invented would present request time as backend authority.
 */
function formatOnboardingAsOf(generatedAt: string | null): string | null {
  if (!generatedAt) return null;
  const when = new Date(generatedAt);
  return Number.isNaN(when.getTime()) ? null : when.toLocaleString();
}

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
  const pageInstanceId = useRef(Math.random().toString(36).slice(2));
  const params = useParams();
  const orderId = params?.id as string;
  const router = useRouter();
  const { isAuthenticated, demoTitle } = useAuth();
  
  const { state: vettingState, refetch, tradeLines } = useVettingData(orderId);
  
  // Vetting approval config (Slice C — live data from backend)
  const [vettingApprovalConfig, setVettingApprovalConfig] = useState<{
    orderId: string;
    jobOrderResolved: { approvalRequired: boolean; tier: string };
    vettingOverride: {
      overrideEnabled: boolean;
      approvalRequiredOverride: boolean | null;
      tierOverride: string | null;
      setByUserId: string | null;
      setAt: string | null;
    };
    liveResolved: { approvalRequired: boolean; tier: string; source: string };
    counts: { unsent: number; pending: number; approved: number; rejected: number };
  } | null>(null);
  const [vettingConfigLoading, setVettingConfigLoading] = useState(false);
  const [vettingConfigSaving, setVettingConfigSaving] = useState(false);

  const loadVettingApprovalConfig = useCallback(async () => {
    if (!orderId) return;
    setVettingConfigLoading(true);
    try {
      const config = await apiFetch<typeof vettingApprovalConfig>(`/recruiting/vetting-approval-config/${orderId}`);
      setVettingApprovalConfig(config);
    } catch (err) {
      console.error('Failed to load vetting approval config:', err);
    } finally {
      setVettingConfigLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadVettingApprovalConfig();
  }, [loadVettingApprovalConfig]);

  const saveVettingOverride = useCallback(async (overrideData: {
    overrideEnabled: boolean;
    approvalRequiredOverride?: boolean | null;
    tierOverride?: string | null;
  }) => {
    if (!orderId) return;
    setVettingConfigSaving(true);
    try {
      const userId = getCurrentUserId();
      const config = await apiFetch<typeof vettingApprovalConfig>(`/recruiting/vetting-override/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...overrideData, userId }),
      });
      setVettingApprovalConfig(config);
    } catch (err) {
      console.error('Failed to save vetting override:', err);
    } finally {
      setVettingConfigSaving(false);
    }
  }, [orderId]);

  const [sendingPacket, setSendingPacket] = useState(false);

  const handleSendPacket = useCallback(async () => {
    if (!orderId) return;
    setSendingPacket(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('jp_accessToken') : null;
      const res = await fetch(`/api/recruiting/send-approval-packet/${orderId}`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const msg = errorData?.message ?? 'Failed to generate approval packet.';
        alert(msg);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `approval-packet-${orderId.slice(0, 8)}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      refetch();
      loadVettingApprovalConfig();
    } catch (err) {
      console.error('Failed to generate approval packet:', err);
      alert('Failed to generate approval packet. Please try again.');
    } finally {
      setSendingPacket(false);
    }
  }, [orderId, refetch, loadVettingApprovalConfig]);

  const requiresPreApproval = vettingApprovalConfig?.liveResolved?.approvalRequired ?? false;
  
  // State for Add Candidate modal (Direct Add — Path 4)
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  
  // State for bulk dispatch
  const [showBulkDispatchModal, setShowBulkDispatchModal] = useState(false);

  // --- DIAGNOSTIC: instance tracking ---
  console.log('[VETTING PAGE RENDER] instance=' + pageInstanceId.current + ' showBulkDispatchModal=' + showBulkDispatchModal + ' vettingStatus=' + vettingState.status);

  useEffect(() => {
    console.log('[VETTING PAGE] mounted instance=' + pageInstanceId.current);
    return () => { console.log('[VETTING PAGE] unmounted instance=' + pageInstanceId.current); };
  }, []);

  useEffect(() => {
    console.log('[MODAL STATE EFFECT] instance=' + pageInstanceId.current + ' showBulkDispatchModal changed to ' + showBulkDispatchModal);
  }, [showBulkDispatchModal]);
  const [bulkDispatchDate, setBulkDispatchDate] = useState('');
  const [bulkDispatchNote, setBulkDispatchNote] = useState('');
  const [bulkDispatchLoading, setBulkDispatchLoading] = useState(false);
  const [bulkDispatchError, setBulkDispatchError] = useState<string | null>(null);
  const [workerOverrides, setWorkerOverrides] = useState<Record<string, { startDate?: string; dispatchNote?: string }>>({});

  // State for dispatch result reporting
  const [dispatchSuccessSummary, setDispatchSuccessSummary] = useState<{
    dispatchedCount: number;
    blockedCount: number;
    totalRequested: number;
  } | null>(null);
  const [dispatchSuccessDetails, setDispatchSuccessDetails] = useState<{
    orderCandidateId: string;
    candidateName: string;
    startDate: string;
    dispatchNote: string | null;
  }[]>([]);
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
          } else if (payload.code === 'CUSTOMER_APPROVAL_REQUIRED') {
            friendlyMessage = payload.message || 'Customer approval is required before moving to Pre-Dispatch.';
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

  /**
   * Gate JO-2C. The Job Offer response deadline chosen for this batch.
   *
   * TWO PIECES OF STATE, ONE ANSWER. The preset is what the operator clicked; `customDeadline` is only
   * consulted when they chose CUSTOM. Keeping them separate means switching from a preset to Custom and
   * back does not silently retain a half-typed timestamp as the live value.
   *
   * NO DEFAULT PRESET IS PRE-SELECTED, DELIBERATELY. A pre-filled "24 hours" would be this UI making a
   * business decision on the operator's behalf and, worse, doing it invisibly - an operator who never
   * looked at the control would still have set a deadline. Governance requires every offer to carry a
   * deliberate one, so the batch cannot be sent until somebody chooses.
   */
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset | null>(null);
  const [customDeadline, setCustomDeadline] = useState('');

  const dismissModal = useCallback(() => {
    setShowBulkDispatchModal(false);
    setBulkDispatchDate('');
    setBulkDispatchNote('');
    setBulkDispatchError(null);
    setWorkerOverrides({});
    setDeadlinePreset(null);
    setCustomDeadline('');
  }, []);

  /**
   * Gate JO-2C. Give a worker LONGER to respond.
   *
   * EXTENSION ONLY, AND THE SERVER IS THE JUDGE. This prompts for a new deadline and sends it; whether it
   * is genuinely later than the deadline in force is decided by the backend against the DATABASE value,
   * not against anything this page believes. A board showing a stale deadline therefore cannot talk the
   * server into a shortening.
   *
   * A PROMPT RATHER THAN A NEW MODAL, deliberately. Extension is a rare correction, and governance
   * authorizes the smallest clean control on the existing surface - not a new dashboard.
   */
  const handleExtendOffer = useCallback(async (jobOfferId: string) => {
    const entered = window.prompt(
      'Extend this job offer deadline to (date and time). The new deadline must be LATER than the current one.',
    );
    if (!entered) return;

    const parsed = new Date(entered);
    if (Number.isNaN(parsed.getTime())) {
      window.alert('That is not a date and time we could read. Nothing was changed.');
      return;
    }

    try {
      await extendJobOfferDeadline({ jobOfferId, respondByAt: parsed.toISOString() });
      refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not extend the job offer deadline.');
    }
  }, [refetch]);

  /**
   * Gate JO-2C. Withdraw a still-open Job Offer.
   *
   * CONFIRMED FIRST, BECAUSE IT ENDS SOMETHING FOR A REAL PERSON. A rescission is terminal for that offer
   * cycle and cannot be undone - the correct remedy is a NEW offer - so it is never a single misclick.
   *
   * THE REASON IS OPTIONAL AND INTERNAL. It is recorded for MW4H and is never disclosed to the worker,
   * who is told only that the offer is no longer available.
   *
   * IT DOES NOT TOUCH THE CANDIDACY, AND THIS PAGE MAKES NO ATTEMPT TO. Nothing here closes the
   * candidacy, clears its selection or moves it out of PRE_DISPATCH; the worker stays exactly where they
   * are and may be offered again. The confirmation says so, because an operator hesitating over this
   * button needs to know they are not removing the worker.
   */
  const handleRescindOffer = useCallback(async (jobOfferId: string) => {
    const confirmed = window.confirm(
      'Withdraw this job offer?\n\nThe worker will be told only that the offer is no longer available. ' +
        'They stay in Pre-Dispatch and can be offered this job again later. This cannot be undone.',
    );
    if (!confirmed) return;

    const reason = window.prompt('Internal reason (optional). The worker never sees this.') ?? undefined;

    try {
      await rescindJobOffer({ jobOfferId, reason: reason?.trim() || undefined });
      refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not withdraw the job offer.');
    }
  }, [refetch]);

  const preDispatchCheckedIds = selectedIds['PRE_DISPATCH'] || new Set<string>();
  // A check is local and survives a refetch; Onboarding clearance is authoritative and does
  // not. Re-asking on every render means a worker checked while cleared and since degraded
  // drops out of this collection, and therefore out of the modal and the payload built from
  // it, without anything having to remember to prune the checked set.
  const dispatchModalCandidates = (vettingState.status === 'ready')
    ? (vettingState.order.buckets.find(b => b.id === 'PRE_DISPATCH')?.candidates.filter(c => preDispatchCheckedIds.has(c.id) && isOnboardingClearedForDispatchSelection(c)) || [])
    : [];

  const handleBulkDispatch = async () => {
    if (vettingState.status !== 'ready') return;
    console.log('[DISPATCH CHAIN] Step 4: handleBulkDispatch called. orderId=', orderId, 'bulkDispatchDate=', bulkDispatchDate);
    if (!orderId || !bulkDispatchDate) { console.log('[DISPATCH CHAIN] Step 4: EARLY RETURN — orderId or bulkDispatchDate falsy'); return; }

    /**
     * GATE JO-2C. THE RESPONSE DEADLINE, RESOLVED TO AN ABSOLUTE INSTANT BEFORE ANYTHING IS SENT.
     *
     * A preset is a convenience and is never what gets stored; `respondByAt` below is the durable fact.
     * Resolving it here, once, means every worker in this batch shares one deadline computed from one
     * moment rather than each being measured from whenever their own row happened to be processed.
     *
     * AND THE BACKEND VALIDATES IT AGAIN. This guard exists so an operator gets an immediate, local
     * error instead of a round trip - it is NOT the enforcement. `JobOfferService.assertIssuableDeadline`
     * is the authority and refuses a missing or past deadline regardless of what this computed.
     */
    const respondByAt = resolveRespondByAt(deadlinePreset, customDeadline);
    if (!respondByAt) {
      setBulkDispatchError(
        'Choose how long this worker has to respond, or enter a specific date and time in the future.',
      );
      return;
    }

    const checkedIds = selectedIds['PRE_DISPATCH'] || new Set<string>();
    const selectedCandidates = dispatchModalCandidates.filter(c => checkedIds.has(c.id));
    console.log('[DISPATCH CHAIN] Step 4: selectedCandidates.length=', selectedCandidates.length, 'checkedIds.size=', checkedIds.size);
    if (selectedCandidates.length === 0) { console.log('[DISPATCH CHAIN] Step 4: EARLY RETURN — no selected candidates'); return; }

    setBulkDispatchLoading(true);
    setBulkDispatchError(null);
    setDispatchSuccessSummary(null);
    setDispatchSuccessDetails([]);
    setDispatchFailureDetails([]);

    try {
      const result = await apiFetch<{
        ok: boolean;
        totalRequested: number;
        dispatchedCount: number;
        blockedCount: number;
        dispatched: { orderCandidateId: string; candidateName: string; startDate: string; dispatchNote: string | null }[];
        blocked: { orderCandidateId: string; candidateName: string; reasons: string[] }[];
      }>('/recruiting/bulk-dispatch', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          defaultStartDate: bulkDispatchDate,
          // Gate JO-2C. The Job Offer response deadline. REQUIRED by the server, which re-validates it.
          defaultRespondByAt: respondByAt,
          defaultDispatchNote: bulkDispatchNote.trim() || undefined,
          workers: selectedCandidates.map(c => {
            const ov = workerOverrides[c.id];
            return {
              orderCandidateId: c.id,
              startDate: ov?.startDate || undefined,
              dispatchNote: ov?.dispatchNote || undefined,
            };
          }),
        }),
      });

      setDispatchSuccessSummary({
        dispatchedCount: result.dispatchedCount,
        blockedCount: result.blockedCount,
        totalRequested: result.totalRequested,
      });
      setDispatchSuccessDetails(result.dispatched);
      setDispatchFailureDetails(result.blocked);
      setShowBulkDispatchModal(false);
      setBulkDispatchDate('');
      setBulkDispatchNote('');
      setWorkerOverrides({});
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bulk dispatch failed';
      setBulkDispatchError(msg);
    } finally {
      setBulkDispatchLoading(false);
    }
  };

  const dispatchModalElement = showBulkDispatchModal ? (
    <BulkDispatchModal
      candidateCount={dispatchModalCandidates.length}
      candidates={dispatchModalCandidates}
      dispatchDate={bulkDispatchDate}
      onDateChange={setBulkDispatchDate}
      dispatchNote={bulkDispatchNote}
      onNoteChange={setBulkDispatchNote}
      deadlinePreset={deadlinePreset}
      onDeadlinePresetChange={setDeadlinePreset}
      customDeadline={customDeadline}
      onCustomDeadlineChange={setCustomDeadline}
      workerOverrides={workerOverrides}
      onWorkerOverrideChange={(id: string, field: 'startDate' | 'dispatchNote', value: string) => {
        setWorkerOverrides(prev => ({
          ...prev,
          [id]: { ...prev[id], [field]: value },
        }));
      }}
      loading={bulkDispatchLoading}
      error={bulkDispatchError}
      onClose={dismissModal}
      onConfirm={handleBulkDispatch}
      isAuthenticated={isAuthenticated}
      demoTitle={demoTitle}
    />
  ) : null;

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
        {dispatchModalElement}
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
        {dispatchModalElement}
      </div>
    );
  }

  const order = vettingState.order;

  const pipelineBuckets = order.buckets.filter(bucket => bucket.id !== 'CLOSED');
  const closedBucket = order.buckets.find(b => b.id === 'CLOSED');

  /**
   * The drill-down's Onboarding context, resolved against the LIVE lane rather than the
   * clicked snapshot.
   *
   * `splitViewCandidate` is the object captured when the card was clicked, so reading the
   * verdict off it would leave the panel showing a stale clearance after a refetch. Looking
   * the worker up in the current PRE_DISPATCH lane also answers the other question the panel
   * cannot answer for itself - WHETHER HE IS IN THAT LANE AT ALL - so a candidate from any
   * other lane gets no Onboarding section rather than a fabricated one.
   */
  const preDispatchInDrillDown = splitViewCandidate
    ? order.buckets
        .find(bucket => bucket.id === 'PRE_DISPATCH')
        ?.candidates.find(candidate => candidate.id === splitViewCandidate.id)
    : undefined;

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

  // Handler for customer approval status change (Phase 9 — soft gate)
  const handleApprovalChange = async (candidateId: string, newStatus: CustomerApprovalStatusType, note?: string) => {
    try {
      const userId = getCurrentUserId();
      await apiFetch('/recruiting/customer-approval', {
        method: 'POST',
        body: JSON.stringify({
          orderCandidateId: candidateId,
          customerApprovalStatus: newStatus,
          userId: userId ?? undefined,
          note: note ?? undefined,
        }),
      });
      refetch();
      loadVettingApprovalConfig();
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

  const staffing = order.staffing;
  const resolverOpenByTradeId = new Map(staffing.trades.map(t => [t.tradeId, t.open]));

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
        </div>
      </header>

      {/* Zone 1: Discovery Strip (Compressed) */}
      {/* Zone 1: Discovery + Staffing Need */}
      <section className="discovery-staffing-row">
        <div className="discovery-stack">
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
        </div>
        <div className="staffing-need-card">
          <div className="staffing-need-header">
            <span className="staffing-need-title">Staffing Need</span>
            {staffing.summary.fullyStaffed
              ? <span className="staffing-badge staffing-badge--full">Fully Staffed</span>
              : <span className="staffing-badge staffing-badge--open">{staffing.summary.open} open</span>
            }
          </div>
          <div className="staffing-need-trades">
            {staffing.trades.map(tr => (
              <div key={tr.tradeId} className="staffing-trade-row">
                <span className="staffing-trade-name">{tr.tradeName}</span>
                <span className="staffing-trade-nums">
                  <span className="staffing-dispatched">{tr.dispatched}</span>
                  <span className="staffing-separator">/</span>
                  <span className="staffing-requested">{tr.requested}</span>
                  {tr.open > 0 && <span className="staffing-open-tag">{tr.open} open</span>}
                  {tr.fullyStaffed && <span className="staffing-full-tag">full</span>}
                </span>
              </div>
            ))}
          </div>
          {staffing.summary.adjustments > 0 && (
            <div className="staffing-adjustments">
              {staffing.summary.adjustments} demand adjustment{staffing.summary.adjustments !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Vetting Pipeline */}
        <section className="pipeline-section">
          <div className="pipeline-header">
            <h2 className="section-title">Vetting Pipeline</h2>
          </div>

          {moveError && (
            <div className="move-error-banner" role="alert">
              <span className="move-error-icon">⚠</span>
              <span className="move-error-text">{moveError}</span>
              <button className="move-error-dismiss" onClick={() => setMoveError(null)} aria-label="Dismiss">×</button>
            </div>
          )}

          {bulkDispatchError && !showBulkDispatchModal && (
            <div className="dispatch-result-banner dispatch-error-banner" role="alert">
              <div className="dispatch-result-header">
                <span className="dispatch-result-icon">&#x2717;</span>
                <span className="dispatch-result-text">{bulkDispatchError}</span>
                <button
                  className="dispatch-result-dismiss"
                  onClick={() => setBulkDispatchError(null)}
                  aria-label="Dismiss"
                >x</button>
              </div>
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
                  onClick={() => { setDispatchSuccessSummary(null); setDispatchSuccessDetails([]); setDispatchFailureDetails([]); }}
                  aria-label="Dismiss"
                >×</button>
              </div>
              {dispatchSuccessDetails.length > 0 && dispatchSuccessDetails.length <= 20 && (
                <div className="dispatch-blocked-details">
                  <div className="dispatch-blocked-title">Dispatched:</div>
                  <ul className="dispatch-blocked-list">
                    {dispatchSuccessDetails.map((item) => (
                      <li key={item.orderCandidateId} className="dispatch-blocked-item">
                        <span className="dispatch-blocked-name">{item.candidateName}</span>
                        <span className="dispatch-blocked-separator"> — </span>
                        <span className="dispatch-blocked-reasons">
                          Start: {item.startDate}{item.dispatchNote ? ` | Note: ${item.dispatchNote}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                  resolverOpenByTradeId={resolverOpenByTradeId}
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
                  onOpenDispatchModal={() => { console.log('[DISPATCH CHAIN] Step 1: instance=' + pageInstanceId.current + ' setting showBulkDispatchModal=true'); setShowBulkDispatchModal(true); }}
                  onExtendOffer={handleExtendOffer}
                  onRescindOffer={handleRescindOffer}
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
                  resolverOpenByTradeId={resolverOpenByTradeId}
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
              allCandidates={order.buckets.flatMap(b => b.candidates)}
              approvalConfig={vettingApprovalConfig}
              configLoading={vettingConfigLoading}
              configSaving={vettingConfigSaving}
              sendingPacket={sendingPacket}
              onOverrideChange={saveVettingOverride}
              onSendPacket={handleSendPacket}
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
            showOnboardingClearance={!!preDispatchInDrillDown}
            onboardingReadiness={preDispatchInDrillDown?.onboardingPreDispatch}
            showWorkerRequest={!!preDispatchInDrillDown}
            workerRequestRead={preDispatchInDrillDown?.preDispatchWorkerRequest}
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
            openCount: tl.openCount,
          }))}
          entrySource="DIRECT_ADD"
          onClose={() => setShowAddCandidateModal(false)}
          onSuccess={() => {
            setShowAddCandidateModal(false);
            refetch();
          }}
        />
      )}

      {/* Bulk Dispatch Modal (CANONICAL dispatch path) — rendered via dispatchModalElement */}
      {dispatchModalElement}

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
          align-items: center;
        }

        /* Discovery + Staffing Row */
        .discovery-staffing-row {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          align-items: stretch;
          max-width: 680px;
        }

        .discovery-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1 1 0;
          min-width: 0;
          max-width: 380px;
        }

        .discovery-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          background: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .jarvis-discovery { border-left: 3px solid #2563eb; }
        .manual-discovery { border-left: 3px solid #16a34a; }

        .discovery-icon { font-size: 18px; }

        .discovery-info {
          display: flex;
          flex-direction: column;
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
          padding: 5px 10px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.12s ease, border-color 0.12s ease;
        }

        .discovery-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }

        /* Staffing Need Card */
        .staffing-need-card {
          width: 250px;
          flex-shrink: 0;
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .staffing-need-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .staffing-need-title {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .staffing-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .staffing-badge--open {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
        }

        .staffing-badge--full {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }

        .staffing-need-trades {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .staffing-trade-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 0;
        }

        .staffing-trade-name {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        }

        .staffing-trade-nums {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-family: 'SF Mono', monospace;
          color: #6b7280;
        }

        .staffing-dispatched { color: #374151; font-weight: 600; }
        .staffing-separator { color: #d1d5db; }
        .staffing-requested { color: #6b7280; }

        .staffing-open-tag {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .staffing-full-tag {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .staffing-adjustments {
          font-size: 10px;
          color: #9ca3af;
          padding-top: 4px;
          border-top: 1px solid #f3f4f6;
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

        .dispatch-error-banner {
          border-color: #fca5a5;
          background: #fef2f2;
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

function LaneColumn({
  bucket,
  trades,
  resolverOpenByTradeId,
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
  onOpenDispatchModal,
  onExtendOffer,
  onRescindOffer,
}: {
  bucket: Bucket;
  trades: Trade[];
  resolverOpenByTradeId: Map<string, number>;
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
  onOpenDispatchModal?: () => void;
  /** Gate JO-2C. The two staff Job Offer lifecycle actions, PRE_DISPATCH only. */
  onExtendOffer?: (jobOfferId: string) => void;
  onRescindOffer?: (jobOfferId: string) => void;
}) {
  const tradeBreakdown = getBucketTradeBreakdown(bucket, trades).map(tb => ({
    ...tb,
    openSlots: resolverOpenByTradeId.get(tb.trade.id) ?? 0,
  }));
  const isDispatchedBucket = bucket.id === 'DISPATCHED';
  const isPreDispatchBucket = bucket.id === 'PRE_DISPATCH';
  const showSemantics = bucket.id === 'OPTED_IN' || bucket.id === 'AWAITING_CANDIDATE_ACTION';
  const selectedCount = isPreDispatchBucket
    ? bucket.candidates.filter(c => c.selectedForDispatch).length
    : 0;
  const totalInLane = bucket.candidates.length;
  // In PRE_DISPATCH, a check survives a refetch but Onboarding clearance does not have to.
  // Counting only workers who are still cleared keeps this number equal to what the Dispatch
  // modal would actually carry, so the button cannot offer more workers than it can send.
  const bucketSelectedCount = isPreDispatchBucket
    ? bucket.candidates.filter(
        c => selectedIds?.has(c.id) && isOnboardingClearedForDispatchSelection(c),
      ).length
    : selectedIds?.size ?? 0;

  const laneColors: Record<string, string> = {
    OPTED_IN: '#6366f1',
    AWAITING_CANDIDATE_ACTION: '#f59e0b',
    MW4H_APPROVED: '#a855f7',
    PRE_DISPATCH: '#22c55e',
    DISPATCHED: '#10b981',
  };

  const accentColor = laneColors[bucket.id] || '#6366f1';

  /**
   * Gate JO-2C. The prior-outcome filter over this lane's pool.
   *
   * LOCAL TO THE LANE, AND PRE_DISPATCH ONLY. It answers a PRE_DISPATCH question - "which of these did we
   * already offer, and what happened" - so it lives with the lane it filters rather than becoming a
   * board-wide control that would need a meaning in every other lane.
   *
   * IT FILTERS AND DOES NOT RANK. Cards keep their existing order; only which of them are visible changes.
   * No score, no reordering and no automatic prioritisation is introduced, because who gets offered next
   * must stay a human decision.
   */
  const [priorOfferFilter, setPriorOfferFilter] = useState<PriorOfferFilter>('ALL');
  const visibleCandidates = isPreDispatchBucket
    ? bucket.candidates.filter(c => matchesPriorOfferFilter(c, priorOfferFilter))
    : bucket.candidates;

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
            <span className="selection-count">{bucketSelectedCount} selected</span>
            <span className="selection-separator">of</span>
            <span className="selection-total">{totalInLane} staged</span>
          </div>
        )}
        <BucketTradeSummary tradeCounts={tradeBreakdown} />

        {/*
          GATE JO-2C - narrow the pool by what happened to the LAST offer.

          THE ONE THING SIXTY CARDS CANNOT TELL YOU. "Which of these did we offer and then rescind" is
          the question staff have when more workers are needed later, and it is not answerable by
          reading a lane. "Never Offered" is included because its complement is just as operational:
          the workers nobody has approached yet.

          RENDERED ONLY WHEN THERE IS A POOL TO NARROW, so an empty or single-candidate lane is not
          given a control with nothing to do.
        */}
        {isPreDispatchBucket && totalInLane > 1 && (
          <div className="jo-filter" role="group" aria-label="Filter by previous job offer outcome">
            {PRIOR_OFFER_FILTERS.map(option => (
              <button
                key={option.id}
                type="button"
                className={`jo-filter-btn${priorOfferFilter === option.id ? ' jo-filter-active' : ''}`}
                onClick={() => setPriorOfferFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lane-candidates">
        {visibleCandidates.length === 0 ? (
          <div className="empty-state">
            {/* An empty lane and an empty FILTER are different situations, and an operator who has
                just narrowed the pool needs to know which one they are looking at. */}
            {isPreDispatchBucket && priorOfferFilter !== 'ALL' && totalInLane > 0
              ? 'No candidates match this job offer filter'
              : 'No candidates'}
          </div>
        ) : (
          visibleCandidates.map(candidate => (
            isDispatchedBucket ? (
              <DispatchedCard key={candidate.id} candidate={candidate} />
            ) : (
              <VettingCandidateCard
                key={candidate.id}
                candidate={candidate}
                showSemantics={showSemantics}
                showSelectionControl={isPreDispatchBucket}
                showOnboardingClearance={isPreDispatchBucket}
                showWorkerRequest={isPreDispatchBucket}
                showJobOffer={isPreDispatchBucket}
                onExtendOffer={isPreDispatchBucket ? onExtendOffer : undefined}
                onRescindOffer={isPreDispatchBucket ? onRescindOffer : undefined}
                onClick={() => onCardClick(candidate)}
                onApprovalChange={(status) => onApprovalChange(candidate.id, status)}
                onSelectToggle={isPreDispatchBucket && onSelectToggle ? () => onSelectToggle(candidate) : undefined}
                isAuthenticated={isAuthenticated}
                demoTitle={demoTitle}
                showCheckbox={
                  !!isSelectable &&
                  (!isPreDispatchBucket || isOnboardingClearedForDispatchSelection(candidate))
                }
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

      {isPreDispatchBucket && bucketSelectedCount > 0 && (
        <div className="lane-actions">
          <button
            className="action-btn action-btn-dispatch-bulk"
            disabled={!isAuthenticated || !!bulkDispatchLoading}
            title={
              !isAuthenticated
                ? demoTitle
                : `Issue a job offer to ${bucketSelectedCount} selected workers`
            }
            onClick={(e) => { e.stopPropagation(); console.log('[DISPATCH CHAIN] Step 0: Dispatch Selected button clicked, bucketSelectedCount=', bucketSelectedCount); if (onOpenDispatchModal) onOpenDispatchModal(); }}
          >
            {/* GATE JO-2C. The one control that OPENS the corrected modal, and therefore the one whose
                label would otherwise promise dispatch and deliver a job offer with a response deadline.
                The class name is deliberately unchanged, so no styling or existing selector moves. */}
            {bulkDispatchLoading ? 'Issuing...' : `Offer Job to Selected (${bucketSelectedCount})`}
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

        /* GATE JO-2C - the prior-outcome filter. Quiet chips: narrowing a pool is a lens, not a
           lane action, and must not compete with the lane's primary controls. */
        .jo-filter {
          display: flex;
          gap: 4px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .jo-filter-btn {
          padding: 2px 6px;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
          background: #ffffff;
          color: #6b7280;
          font-size: 9px;
          font-weight: 600;
          cursor: pointer;
        }
        .jo-filter-btn.jo-filter-active {
          border-color: #c7d2fe;
          background: #eef2ff;
          color: #3730a3;
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
  UNSENT: { bg: '#e2e8f0', color: '#475569', label: 'Unsent' },
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
  showOnboardingClearance,
  showWorkerRequest,
  showJobOffer,
  onExtendOffer,
  onRescindOffer,
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
  /** PRE_DISPATCH only: no other lane has an Onboarding clearance question to answer. */
  showOnboardingClearance?: boolean;
  /**
   * PRE_DISPATCH only: no other lane has a job-specific worker request.
   *
   * A SEPARATE PROP FROM `showOnboardingClearance` even though both lanes-gate identically
   * today, so that showing one status never implies showing the other.
   */
  showWorkerRequest?: boolean;
  /**
   * Gate JO-2C. Whether to show the Job Offer state, history and lifecycle actions.
   *
   * A THIRD INDEPENDENT FLAG, not folded into `showWorkerRequest`. The two answer different questions
   * and are authorized for the PRE_DISPATCH lane separately, so one lane could legitimately want one and
   * not the other - and a single shared flag would make that impossible to express.
   */
  showJobOffer?: boolean;
  /** Gate JO-2C. Absent when the surface is not authorized to act, which withholds both controls. */
  onExtendOffer?: (jobOfferId: string) => void;
  onRescindOffer?: (jobOfferId: string) => void;
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
  const clearance = presentOnboardingClearance(candidate.onboardingPreDispatch);
  const workerRequest = presentWorkerRequest(candidate.preDispatchWorkerRequest);
  const jobOffer = presentJobOffer(candidate.jobOffer);

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

      {/*
        PHASE 17 S4, RULING C - WHY this candidacy is closed.

        NO FLAG GATES IT, AND THAT IS CORRECT RATHER THAN LAZY. Every other status row on this card
        is lane-gated because clearance, worker requests and job offers are only meaningful in
        PRE_DISPATCH. A closure reason is different: `closedDisposition` exists if and only if the
        candidacy is closed, so the data is its own gate and a flag would only add a way to forget
        to pass it. An open candidacy has nothing here to render.

        FIRST OF THE STATUS ROWS, BECAUSE FOR A CLOSED CARD IT IS THE HEADLINE. An operator looking
        at the Closed lane is asking exactly one question about each card, and this answers it
        without a click into the drill-down.
      */}
      {candidate.closedDisposition && (
        <div className={`closed-disposition ${closedDispositionClass(candidate.closedDisposition)}`}>
          <span className="cd-dot" aria-hidden="true" />
          <span className="cd-label">
            {CLOSED_DISPOSITION_LABELS[candidate.closedDisposition]}
          </span>
        </div>
      )}

      {/*
        Gate 10C-E4 - the authoritative Onboarding clearance verdict.

        DELIBERATELY ITS OWN ROW, AND DELIBERATELY NOT THE SELECTION INDICATOR. The header's
        circle-and-check and the footer's "Selected" button are STAGING semantics - whether
        this operator has picked the worker for a dispatch action - and they are already
        green. This says something entirely different, so it is placed away from both, names
        the subject in its own text ("Onboarding ..."), and uses no check or circle glyph
        that could be read as selection. A worker can therefore be staged AND not cleared at
        the same time, which is exactly the situation an operator most needs to see.

        THE TEXT CARRIES THE MEANING; colour and the dashed unavailable border only reinforce
        it, so the verdict survives a colour-blind operator and a greyscale screen.
      */}
      {showOnboardingClearance && (
        <div className={`onboarding-clearance ${onboardingClearanceClass(clearance.tone)}`}>
          <span className="oc-dot" aria-hidden="true" />
          <span className="oc-label">{clearance.label}</span>
        </div>
      )}

      {/*
        Phase 17 S2 - the job-specific worker-request state.

        ADJACENT TO THE CLEARANCE VERDICT, AND DELIBERATELY NOT MERGED WITH IT. It is grouped
        with clearance because an operator reasons about both at once, but it is its own row,
        its own element, its own `pdr-` class namespace and its own wording - so the two read
        as two statuses about two subjects rather than one badge with two colours.

        LIGHTER THAN THE GATE ABOVE, ON PURPOSE. Clearance is the dispatch gate and keeps the
        heavier bordered treatment; this is operational information and is rendered smaller and
        flatter so it informs without competing. A request state never controls a control.

        THE TEXT NAMES ITS OWN SUBJECT ("Worker Request ...", "Awaiting Worker Response"), so
        the meaning survives greyscale, colour-blindness, and a glance.
      */}
      {showWorkerRequest && (
        <div className={`worker-request ${workerRequestClass(workerRequest.tone)}`}>
          <span className="pdr-dot" aria-hidden="true" />
          <span className="pdr-label">{workerRequest.label}</span>
        </div>
      )}

      {/*
        GATE JO-2C - the candidacy's JOB OFFER state and history.

        A THIRD ROW, AND NOT A THIRD OPINION ABOUT THE OTHER TWO. Clearance is the dispatch gate;
        the worker request is about asking the worker to act; this is about whether MW4H has
        OFFERED THIS WORKER THIS JOB, and what became of it. Its own row, its own `jo-` class
        namespace and its own wording, so it cannot be read as a variant of either.

        BOTH LINES CAN APPEAR AT ONCE, DELIBERATELY. A candidacy that lapsed and was then
        re-offered has an open current cycle AND a prior terminal outcome, and an operator needs
        both: "there is an offer out right now" and "the last one ran out of time". Collapsing
        them into one line would force the board to hide one of the two.

        THE PRIOR-OUTCOME LINE NAMES THE ACTOR IN TEXT. "MW4H Rescinded Offer" and "No Response
        by Deadline" cannot be confused with each other, or with a worker declining, in greyscale
        or by a colour-blind operator. Neither is rendered in the red this card uses for
        "Onboarding Not Cleared", because neither is a finding about the worker's qualification.
      */}
      {showJobOffer && jobOffer.current && (
        <div className={`job-offer-state ${jobOfferClass(jobOffer.current.tone)}`}>
          <span className="jo-dot" aria-hidden="true" />
          <span className="jo-label">{jobOffer.current.label}</span>
          {jobOffer.current.deadline && (
            <span className="jo-deadline">Respond by {jobOffer.current.deadline}</span>
          )}
        </div>
      )}

      {showJobOffer && jobOffer.prior && (
        <div className={`job-offer-prior ${jobOfferClass(jobOffer.prior.tone)}`}>
          <span className="jo-dot" aria-hidden="true" />
          <span className="jo-label">
            {jobOffer.current ? `Previously: ${jobOffer.prior.label}` : jobOffer.prior.label}
          </span>
          {jobOffer.prior.when && <span className="jo-when">{jobOffer.prior.when}</span>}
        </div>
      )}

      {/*
        GATE JO-2C - the two staff lifecycle actions, on the open offer only.

        ON THE EXISTING CARD RATHER THAN A NEW SURFACE, because this is where an operator is
        already looking at this worker's offer. No new dashboard is introduced.

        EXTEND AND RESCIND, AND NO "SHORTEN". Shortening a deadline is not offered because it is
        forbidden: a worker may already have rearranged their life around the time they were
        promised. The honest way to end an offer early is to rescind it, which records who did it
        and when - so the destructive action is the visible one, not the quiet one.

        ONLY WHILE AN OFFER IS GENUINELY OPEN. Both controls are rendered from
        `jobOffer.current`, which the server populates only for a cycle that is PENDING and still
        within its deadline, so a terminal cycle offers neither. The server re-checks both rules
        regardless of what this card decided to render.
      */}
      {showJobOffer && jobOffer.current && onExtendOffer && onRescindOffer && (
        <div className="jo-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="jo-action jo-action-extend"
            disabled={!isAuthenticated}
            title={!isAuthenticated ? demoTitle : 'Give this worker longer to respond'}
            onClick={() => onExtendOffer(jobOffer.current!.jobOfferId)}
          >
            Extend Deadline
          </button>
          <button
            type="button"
            className="jo-action jo-action-rescind"
            disabled={!isAuthenticated}
            title={!isAuthenticated ? demoTitle : 'Withdraw this job offer'}
            onClick={() => onRescindOffer(jobOffer.current!.jobOfferId)}
          >
            Rescind Offer
          </button>
        </div>
      )}

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

      {candidate.customerApprovalStatus && candidate.customerApprovalStatus !== 'NOT_REQUIRED' && (
        <div className="approval-row" onClick={(e) => e.stopPropagation()}>
          <ApprovalBadge status={candidate.customerApprovalStatus} />
          {(candidate.customerApprovalStatus === 'PENDING' ||
            candidate.customerApprovalStatus === 'APPROVED' ||
            candidate.customerApprovalStatus === 'REJECTED') && (
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
            </select>
          )}
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

        /* Onboarding clearance (Gate 10C-E4) — a labelled verdict, not a selection cue */
        .onboarding-clearance {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          padding: 3px 8px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .oc-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .oc-cleared {
          background: #ecfdf5;
          border-color: #6ee7b7;
          color: #047857;
        }

        .oc-cleared .oc-dot {
          background: #059669;
        }

        .oc-not-cleared {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #b91c1c;
        }

        .oc-not-cleared .oc-dot {
          background: #dc2626;
        }

        /* Neutral and DASHED: an unread status must not read as a verdict, and must not
           resemble the cleared state in colour, weight, or edge. */
        .oc-unavailable {
          background: #f8fafc;
          border-color: #cbd5e1;
          border-style: dashed;
          color: #475569;
        }

        .oc-unavailable .oc-dot {
          background: #94a3b8;
        }

        /* ------------------------------------------------------------------
           Phase 17 S2 - the worker-request state.

           SUBORDINATE TO THE CLEARANCE GATE BY DESIGN. No border, a smaller type size and a
           lighter weight than .onboarding-clearance above, so it sits with the verdict
           without competing with it. Recruiting still reads it at a glance because the words
           name the subject; it simply does not look like a gate, because it is not one.

           A SEPARATE pdr- NAMESPACE FROM oc-. No selector below is shared with the
           clearance styles, so a request state cannot inherit the gate's green or red.
           ------------------------------------------------------------------ */
        .worker-request {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 500;
          line-height: 1.4;
          /* Wraps rather than truncating: an operational status that has been cut off is a
             status an operator has to open a panel to trust. */
          white-space: normal;
        }

        .pdr-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        /* ==================================================================
           PHASE 17 S4, RULING C - why a closed candidacy is closed.

           A "cd-" NAMESPACE SHARING NO SELECTOR with "oc-", "pdr-" or "jo-", for the same reason
           those three share none with each other: a closure reason must not be able to inherit the
           clearance gate's red or the request row's grey through one stylesheet edit.

           NONE OF THE THREE IS GREEN, AND WORKER WITHDREW IS NOT RED. A closed candidacy is not a
           success, so nothing here is green; and a worker exercising their own choice is not a
           finding against them, so it is not given the red this card uses for rejection. It is
           neutral blue-grey, distinct from both at a glance and distinct in its words regardless.
           ------------------------------------------------------------------ */
        .closed-disposition {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          line-height: 1.4;
          white-space: normal;
        }

        .cd-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .cd-not-selected {
          background: #f3f4f6;
          color: #4b5563;
        }
        .cd-not-selected .cd-dot {
          background: #9ca3af;
        }

        .cd-rejected {
          background: #fee2e2;
          color: #991b1b;
        }
        .cd-rejected .cd-dot {
          background: #dc2626;
        }

        .cd-withdrew {
          background: #e8eefb;
          color: #1e4487;
        }
        .cd-withdrew .cd-dot {
          background: #3b6bc4;
        }

        /* ==================================================================
           GATE JO-2C - the Job Offer state and history rows.

           A "jo-" NAMESPACE THAT SHARES NO CLASS NAME with the "oc-" clearance or "pdr-" request
           styles, so no offer outcome can inherit the clearance gate's red or the request
           indicator's grey, and no single stylesheet edit can collapse the three indicators
           into one look.
           ================================================================== */
        .job-offer-state,
        .job-offer-prior {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 500;
          line-height: 1.4;
          white-space: normal;
        }

        .jo-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .jo-deadline,
        .jo-when {
          opacity: 0.8;
          font-weight: 400;
        }

        /* An open offer: informational, and NOT green. Green on this card means a gate has been
           passed; a pending offer is a question nobody has answered yet. */
        .job-offer-state.jo-pending {
          background: #eef2ff;
          color: #3730a3;
        }
        .job-offer-state.jo-pending .jo-dot {
          background: #4f46e5;
        }

        .job-offer-prior.jo-accepted {
          background: #f0fdf4;
          color: #15803d;
        }
        .job-offer-prior.jo-accepted .jo-dot {
          background: #16a34a;
        }

        /* The worker's own decision. Neutral grey: declining is a legitimate answer, not a fault. */
        .job-offer-prior.jo-declined {
          background: #f3f4f6;
          color: #4b5563;
        }
        .job-offer-prior.jo-declined .jo-dot {
          background: #6b7280;
        }

        /*
          LAPSED - the deadline ran out. Amber, reading as "time", and deliberately NOT the red
          that means "Onboarding Not Cleared": no delivery system exists, so Jarvis cannot even
          establish this worker was reached, and presenting silence as a failing would attribute a
          choice to them that they may never have had a chance to make.
        */
        .job-offer-prior.jo-lapsed {
          background: #fffbeb;
          color: #92400e;
        }
        .job-offer-prior.jo-lapsed .jo-dot {
          background: #d97706;
        }

        /*
          RESCINDED - MW4H withdrew its own offer.

          VISUALLY DISTINCT FROM LAPSED, WHICH GOVERNANCE REQUIRES: an operator must be able to
          tell "the worker went quiet" from "we changed our mind" at a glance, so this violet
          appears nowhere else on the card and cannot be confused with the amber above.

          AND EMPHATICALLY NOT RED, NOT A WARNING, AND NOT AN ALERT. This is the one outcome on
          this list that is entirely MW4H's doing. Styling it as a problem with the worker would
          quietly turn MW4H's own decision into a mark against the person it was made about -
          which is exactly what governance forbids. The left rule gives it presence without
          giving it blame.
        */
        .job-offer-prior.jo-rescinded {
          background: #f5f3ff;
          color: #5b21b6;
          border-left: 2px solid #7c3aed;
        }
        .job-offer-prior.jo-rescinded .jo-dot {
          background: #7c3aed;
        }

        .job-offer-state.jo-unavailable,
        .job-offer-prior.jo-unavailable {
          background: #f9fafb;
          color: #6b7280;
        }
        .job-offer-state.jo-unavailable .jo-dot,
        .job-offer-prior.jo-unavailable .jo-dot {
          background: #9ca3af;
        }

        /* The two lifecycle actions. Deliberately quiet: they are exceptions, not routine steps,
           and must not compete with the lane's primary controls. */
        .jo-actions {
          display: flex;
          gap: 6px;
          margin-top: 6px;
        }
        .jo-action {
          flex: 1;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          background: #ffffff;
        }
        .jo-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .jo-action-extend {
          border: 1px solid #c7d2fe;
          color: #3730a3;
        }
        /* Rescission ends a worker's offer, so its control looks like what it is - without
           borrowing the red that this board uses for findings about the worker. */
        .jo-action-rescind {
          border: 1px solid #ddd6fe;
          color: #5b21b6;
        }

        /*
          PENDING and WAITING share this neutral amber. Neither is a failure, so neither may
          borrow the red that means "Onboarding Not Cleared" - a worker who has not been sent a
          request, and a worker who owes an answer, have both done nothing wrong.
        */
        .pdr-pending {
          background: #fffbeb;
          color: #92400e;
        }

        .pdr-pending .pdr-dot {
          background: #d97706;
        }

        /* Informational blue: an answer is on file, which is progress and not a verdict. */
        .pdr-responded {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .pdr-responded .pdr-dot {
          background: #2563eb;
        }

        /*
          The ONLY green in this namespace, and reachable only from the persisted CLEARED state.
          Deliberately flatter and borderless so that even here it cannot be mistaken for the
          bordered "Onboarding Cleared" gate above it.
        */
        .pdr-cleared {
          background: #f0fdf4;
          color: #15803d;
        }

        .pdr-cleared .pdr-dot {
          background: #16a34a;
        }

        .pdr-closed {
          background: #f1f5f9;
          color: #475569;
        }

        .pdr-closed .pdr-dot {
          background: #64748b;
        }

        /* Unread and no-request-on-file: neutral, and never mistakable for an answer. */
        .pdr-unavailable {
          background: #f8fafc;
          color: #64748b;
          font-style: italic;
        }

        .pdr-unavailable .pdr-dot {
          background: #cbd5e1;
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
                {/*
                  PHASE 17 S4: LABELLED FROM THE SHARED MAP, NOT FROM A LOCAL TWO-WAY TEST. This
                  component is not rendered anywhere - the live closed lane is `LaneColumn` with
                  `VettingCandidateCard` - and S4 deliberately does not activate it. But the old
                  `=== 'REJECTED' ? ... : 'Not Selected'` test would silently label a worker's own
                  withdrawal as "Not Selected" the moment anyone did wire it up, so it now reads the
                  same labels as the live card. No behaviour changes; a latent mislabel is removed.
                */}
                {candidate.closedDisposition && (
                  <span className={`disposition-badge ${candidate.closedDisposition === 'REJECTED' ? 'rejected' : 'not-selected'}`}>
                    {CLOSED_DISPOSITION_LABELS[candidate.closedDisposition]}
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
// Slice C: Wired to live backend data — vetting override + job order resolved
function CustomerApprovalGate({
  allCandidates,
  approvalConfig,
  configLoading,
  configSaving,
  sendingPacket,
  onOverrideChange,
  onSendPacket,
  onApprovalChange,
  onCardClick,
  isAuthenticated,
  demoTitle,
}: {
  allCandidates: Candidate[];
  approvalConfig: {
    orderId: string;
    jobOrderResolved: { approvalRequired: boolean; tier: string };
    vettingOverride: {
      overrideEnabled: boolean;
      approvalRequiredOverride: boolean | null;
      tierOverride: string | null;
    };
    liveResolved: { approvalRequired: boolean; tier: string; source: string };
    counts: { unsent: number; pending: number; approved: number; rejected: number };
  } | null;
  configLoading: boolean;
  configSaving: boolean;
  sendingPacket: boolean;
  onOverrideChange: (data: {
    overrideEnabled: boolean;
    approvalRequiredOverride?: boolean | null;
    tierOverride?: string | null;
  }) => void;
  onSendPacket: () => void;
  onApprovalChange: (candidateId: string, status: CustomerApprovalStatusType, note?: string) => void;
  onCardClick: (candidate: Candidate) => void;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const unsentCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'UNSENT');
  const pendingCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'PENDING');
  const approvedCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'APPROVED');
  const rejectedCandidates = allCandidates.filter(c => c.customerApprovalStatus === 'REJECTED');

  const overrideEnabled = approvalConfig?.vettingOverride?.overrideEnabled ?? false;
  const liveApprovalRequired = approvalConfig?.liveResolved?.approvalRequired ?? false;
  const liveTier = approvalConfig?.liveResolved?.tier ?? 'TIER_1';
  const liveSource = approvalConfig?.liveResolved?.source ?? 'JOB_ORDER';
  const joApprovalRequired = approvalConfig?.jobOrderResolved?.approvalRequired ?? false;
  const joTier = approvalConfig?.jobOrderResolved?.tier ?? 'TIER_1';

  const tierLabel = (t: string) => {
    if (t === 'TIER_1') return 'Tier 1';
    if (t === 'TIER_2') return 'Tier 2';
    if (t === 'TIER_3') return 'Tier 3';
    return t;
  };

  const sourceLabel = liveSource === 'VETTING_OVERRIDE' ? 'Vetting Override' : 'Job Order';

  const handleOverrideToggle = (enabled: boolean) => {
    if (!enabled) {
      onOverrideChange({ overrideEnabled: false });
    } else {
      onOverrideChange({
        overrideEnabled: true,
        approvalRequiredOverride: joApprovalRequired,
        tierOverride: joTier,
      });
    }
  };

  const counts = approvalConfig?.counts ?? { unsent: unsentCandidates.length, pending: pendingCandidates.length, approved: approvedCandidates.length, rejected: rejectedCandidates.length };

  return (
    <div className="approval-gate">
      <div className="gate-header">
        <div className="gate-title">
          <span className="gate-icon">🔒</span>
          <h3>Customer Approval Gate</h3>
        </div>
        {/* Override Toggle */}
        <label className="gate-toggle">
          <input
            type="checkbox"
            checked={overrideEnabled}
            disabled={configSaving || !isAuthenticated}
            onChange={(e) => handleOverrideToggle(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className={`toggle-label ${overrideEnabled ? 'active' : ''}`}>
            {overrideEnabled ? 'Override Active' : 'Using Job Order'}
          </span>
        </label>
      </div>

      {configLoading && (
        <div className="gate-loading">Loading...</div>
      )}

      {/* Source indicator */}
      <div className={`gate-source-badge ${overrideEnabled ? 'override' : 'job-order'}`}>
        {sourceLabel}
      </div>

      {/* Approval Context Block */}
      <div className="approval-context">
        <div className="context-header">
          <span className="context-label">Live Settings</span>
        </div>
        <div className="context-rows">
          <div className="context-row">
            <span className="context-key">Approval Required:</span>
            <span className={`context-value ${liveApprovalRequired ? 'yes' : 'no'}`}>
              {liveApprovalRequired ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="context-row">
            <span className="context-key">Active Tier:</span>
            <span className="context-value package">{tierLabel(liveTier)}</span>
          </div>
        </div>

        {/* Override edit controls — only when override is ON */}
        {overrideEnabled && (
          <div className="override-controls">
            <div className="override-field">
              <label className="override-label">Approval Required</label>
              <select
                className="override-select"
                value={approvalConfig?.vettingOverride?.approvalRequiredOverride != null
                  ? (approvalConfig.vettingOverride.approvalRequiredOverride ? 'true' : 'false')
                  : 'inherit'}
                disabled={configSaving || !isAuthenticated}
                onChange={(e) => {
                  const v = e.target.value;
                  onOverrideChange({
                    overrideEnabled: true,
                    approvalRequiredOverride: v === 'inherit' ? null : v === 'true',
                    tierOverride: approvalConfig?.vettingOverride?.tierOverride,
                  });
                }}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
                <option value="inherit">Inherit (Job Order)</option>
              </select>
            </div>
            <div className="override-field">
              <label className="override-label">Active Tier</label>
              <select
                className="override-select"
                value={approvalConfig?.vettingOverride?.tierOverride ?? 'inherit'}
                disabled={configSaving || !isAuthenticated}
                onChange={(e) => {
                  const v = e.target.value;
                  onOverrideChange({
                    overrideEnabled: true,
                    approvalRequiredOverride: approvalConfig?.vettingOverride?.approvalRequiredOverride,
                    tierOverride: v === 'inherit' ? null : v,
                  });
                }}
              >
                <option value="TIER_1">Tier 1</option>
                <option value="TIER_2">Tier 2</option>
                <option value="TIER_3">Tier 3</option>
                <option value="inherit">Inherit (Job Order)</option>
              </select>
            </div>
          </div>
        )}

        {!overrideEnabled && (
          <p className="context-helper">
            Using job order settings. Enable override to edit live values.
          </p>
        )}
      </div>

      {/* Job Order baseline (collapsed reference) */}
      {overrideEnabled && (
        <div className="jo-baseline">
          <span className="jo-baseline-label">Job Order:</span>
          <span className="jo-baseline-value">{joApprovalRequired ? 'Required' : 'Not Required'} · {tierLabel(joTier)}</span>
        </div>
      )}

      {/* Live approval status summary — 4 statuses */}
      <div className="gate-summary">
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#94a3b8' }}></span>
          <span className="summary-label">Unsent</span>
          <span className="summary-count">{counts.unsent}</span>
        </div>
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#f59e0b' }}></span>
          <span className="summary-label">Pending</span>
          <span className="summary-count">{counts.pending}</span>
        </div>
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#22c55e' }}></span>
          <span className="summary-label">Approved</span>
          <span className="summary-count">{counts.approved}</span>
        </div>
        <div className="summary-row">
          <span className="summary-dot" style={{ background: '#ef4444' }}></span>
          <span className="summary-label">Rejected</span>
          <span className="summary-count">{counts.rejected}</span>
        </div>
      </div>

      {/* Generate Packet — sends UNSENT candidates to customer (UNSENT→PENDING) */}
      {liveApprovalRequired && counts.unsent > 0 && (
        <div className="gate-packet-action">
          <button
            className="gate-packet-btn"
            disabled={sendingPacket || !isAuthenticated}
            title={!isAuthenticated ? demoTitle : `Send ${counts.unsent} unsent candidate(s) to customer`}
            onClick={onSendPacket}
          >
            {sendingPacket ? 'Generating PDF...' : `Generate Packet PDF (${counts.unsent})`}
          </button>
          <span className="packet-helper">Generates PDF and marks candidates as sent</span>
        </div>
      )}

      {/* UNSENT candidates — not yet sent to customer */}
      {liveApprovalRequired && unsentCandidates.length > 0 && (
        <div className="gate-decided-section">
          <div className="decided-header unsent">Unsent ({unsentCandidates.length})</div>
          <div className="gate-candidates">
            {unsentCandidates.map(candidate => (
              <div key={candidate.id} className="gate-card decided-unsent">
                <div className="gate-card-info" onClick={() => onCardClick(candidate)}>
                  <span className="candidate-name">{candidate.name}</span>
                  <span className="candidate-trade">{candidate.tradeName}</span>
                </div>
                <span className="unsent-badge">Not yet sent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING candidates — sent to customer, awaiting response */}
      {liveApprovalRequired && pendingCandidates.length > 0 && (
        <>
          <div className="gate-status">
            <span className="status-indicator pending"></span>
            <span className="status-text">Awaiting customer response</span>
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

      {/* Approved candidates with reversal */}
      {liveApprovalRequired && approvedCandidates.length > 0 && (
        <div className="gate-decided-section">
          <div className="decided-header">Approved ({approvedCandidates.length})</div>
          <div className="gate-candidates">
            {approvedCandidates.map(candidate => (
              <div key={candidate.id} className="gate-card decided-approved">
                <div className="gate-card-info" onClick={() => onCardClick(candidate)}>
                  <span className="candidate-name">{candidate.name}</span>
                  <span className="candidate-trade">{candidate.tradeName}</span>
                </div>
                <div className="gate-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="gate-action-btn reject"
                    disabled={!isAuthenticated}
                    title={!isAuthenticated ? demoTitle : 'Reverse to Rejected'}
                    onClick={() => onApprovalChange(candidate.id, 'REJECTED')}
                  >
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected candidates with reversal */}
      {liveApprovalRequired && rejectedCandidates.length > 0 && (
        <div className="gate-decided-section">
          <div className="decided-header rejected">Rejected ({rejectedCandidates.length})</div>
          <div className="gate-candidates">
            {rejectedCandidates.map(candidate => (
              <div key={candidate.id} className="gate-card decided-rejected">
                <div className="gate-card-info" onClick={() => onCardClick(candidate)}>
                  <span className="candidate-name">{candidate.name}</span>
                  <span className="candidate-trade">{candidate.tradeName}</span>
                </div>
                <div className="gate-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="gate-action-btn approve"
                    disabled={!isAuthenticated}
                    title={!isAuthenticated ? demoTitle : 'Reverse to Approved'}
                    onClick={() => onApprovalChange(candidate.id, 'APPROVED')}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {configSaving && <div className="gate-saving">Saving...</div>}

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

        .gate-loading {
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
          padding: 8px 0;
        }

        .gate-saving {
          text-align: center;
          font-size: 9px;
          color: #d97706;
          padding: 4px 0;
          font-style: italic;
        }

        .gate-source-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 8px;
        }

        .gate-source-badge.job-order {
          background: #e0e7ff;
          color: #3730a3;
        }

        .gate-source-badge.override {
          background: #fef3c7;
          color: #92400e;
        }

        .override-controls {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #fde68a;
        }

        .override-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .override-label {
          font-size: 9px;
          font-weight: 600;
          color: #6b7280;
        }

        .override-select {
          padding: 3px 4px;
          font-size: 10px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          color: #111827;
        }

        .jo-baseline {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 4px 8px;
          background: #f0f4ff;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .jo-baseline-label {
          font-size: 9px;
          font-weight: 600;
          color: #6b7280;
        }

        .jo-baseline-value {
          font-size: 9px;
          color: #374151;
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
        .gate-card.decided-unsent { border-color: #cbd5e1; background: #f8fafc; }
        .gate-card.decided-approved { border-color: #a7f3d0; background: #f0fdf4; }
        .gate-card.decided-rejected { border-color: #fecaca; background: #fef2f2; }

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

        .gate-decided-section {
          margin-bottom: 8px;
        }

        .decided-header {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #065f46;
          margin-bottom: 4px;
        }

        .decided-header.unsent {
          color: #475569;
        }

        .decided-header.rejected {
          color: #991b1b;
        }

        .unsent-badge {
          font-size: 8px;
          color: #64748b;
          background: #e2e8f0;
          padding: 1px 5px;
          border-radius: 3px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .gate-packet-action {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          margin-bottom: 10px;
        }

        .gate-packet-btn {
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 700;
          border: 1px solid #f59e0b;
          border-radius: 5px;
          background: #fef3c7;
          color: #92400e;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .gate-packet-btn:hover { background: #fde68a; }

        .gate-packet-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .packet-helper {
          font-size: 8px;
          color: #9ca3af;
          text-align: center;
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
  showOnboardingClearance,
  onboardingReadiness,
  showWorkerRequest,
  workerRequestRead,
  onClose,
}: {
  candidate: Candidate;
  /** PRE_DISPATCH only, decided by the page against the live lane. */
  showOnboardingClearance?: boolean;
  onboardingReadiness?: OnboardingPreDispatchReadiness;
  /** Phase 17 S2. PRE_DISPATCH only, decided by the page against the live lane. */
  showWorkerRequest?: boolean;
  workerRequestRead?: PreDispatchWorkerRequestRead;
  onClose: () => void;
}) {
  const certItems: CertSignalItem[] = candidate.signals?.hardGates?.certifications?.items ?? [];
  const complianceItems: ComplianceSignalItem[] = candidate.signals?.hardGates?.compliance?.items ?? [];
  const ppeItems: PpeSignalItem[] = candidate.signals?.softSignals?.ppe?.items ?? [];
  const toolItems: ToolSignalItem[] = candidate.signals?.softSignals?.tools?.items ?? [];
  const hasSignals = !!candidate.signals;
  const clearance = presentOnboardingClearance(onboardingReadiness);
  const clearanceAsOf = formatOnboardingAsOf(clearance.generatedAt);
  const workerRequest = presentWorkerRequest(workerRequestRead);

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

          {/*
            Gate 10C-E4 - the Onboarding clearance drill-down.

            Placed immediately under the worker's name because it is the first thing an
            operator staging a PRE_DISPATCH worker needs, and it is a fact about the WORKER
            rather than about this order - which is why it sits in the profile column and not
            under the order's eligibility checklist.

            WHAT IS DELIBERATELY ABSENT: the read's HTTP status, the framework refusal code,
            the confidential count, the name of any withheld requirement, and every protected
            worker value. The panel reports a verdict, a governed reason, and the server's own
            timestamp. It is not a debugging display.
          */}
          {showOnboardingClearance && (
            <div className="profile-group">
              <h4>Onboarding</h4>
              <div className={`oc-detail ${onboardingClearanceClass(clearance.tone)}`}>
                <div className="oc-detail-row">
                  <span className="oc-detail-key">Status:</span>
                  <span className="oc-detail-value">{clearance.statusWord}</span>
                </div>
                {clearance.reason && (
                  <div className="oc-detail-row">
                    <span className="oc-detail-key">Reason:</span>
                    <span className="oc-detail-value">{clearance.reason}</span>
                  </div>
                )}
                {clearance.confidentialOutstanding && (
                  <div className="oc-detail-note">
                    Additional confidential verification required
                  </div>
                )}
                {clearanceAsOf && (
                  <div className="oc-detail-asof">As of {clearanceAsOf}</div>
                )}
              </div>
            </div>
          )}

          {/*
            Phase 17 S2 - the worker-request detail.

            ITS OWN `profile-group` WITH ITS OWN HEADING, immediately after Onboarding rather
            than inside it. Grouping it under the "Onboarding" heading would assert that the
            request lifecycle is part of the clearance determination, which is exactly the
            conflation this slice exists to avoid. The heading names the subject.

            The cycle is shown because a candidacy can legitimately re-enter PRE_DISPATCH, and
            an operator looking at a request needs to know which entry it belongs to.
          */}
          {showWorkerRequest && (
            <div className="profile-group">
              <h4>Worker Request</h4>
              <div className={`pdr-detail ${workerRequestClass(workerRequest.tone)}`}>
                <div className="pdr-detail-row">
                  <span className="pdr-detail-key">Request:</span>
                  <span className="pdr-detail-value">{workerRequest.statusWord}</span>
                </div>
                {workerRequest.detail && (
                  <div className="pdr-detail-row">
                    <span className="pdr-detail-key">Detail:</span>
                    <span className="pdr-detail-value">{workerRequest.detail}</span>
                  </div>
                )}
                {workerRequest.cycleSequence !== null && (
                  <div className="pdr-detail-row">
                    <span className="pdr-detail-key">Cycle:</span>
                    <span className="pdr-detail-value">{workerRequest.cycleSequence}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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

        /* Onboarding clearance drill-down (Gate 10C-E4) */
        .oc-detail {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 6px 8px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 11px;
        }

        .oc-detail-row {
          display: flex;
          gap: 6px;
        }

        .oc-detail-key {
          font-weight: 600;
          opacity: 0.75;
        }

        .oc-detail-value {
          font-weight: 700;
        }

        .oc-detail-note {
          margin-top: 2px;
          font-style: italic;
          opacity: 0.85;
        }

        .oc-detail-asof {
          margin-top: 2px;
          font-size: 10px;
          opacity: 0.7;
        }

        .oc-cleared {
          background: #ecfdf5;
          border-color: #6ee7b7;
          color: #047857;
        }

        .oc-not-cleared {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #b91c1c;
        }

        /* Neutral and dashed, so an unread status cannot be mistaken for a cleared one. */
        .oc-unavailable {
          background: #f8fafc;
          border-color: #cbd5e1;
          border-style: dashed;
          color: #475569;
        }

        /* ------------------------------------------------------------------
           Phase 17 S2 - the worker-request detail block.

           BORDERLESS, unlike .oc-detail above, so that in the drill-down as on the card the
           clearance gate stays visually primary and the request state stays informational.
           The pdr- tone classes (.pdr-pending, .pdr-cleared, ...) are defined with the
           card styles and are reused here unchanged, so a state's colour cannot differ between
           the two places an operator sees it.
           ------------------------------------------------------------------ */
        .pdr-detail {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .pdr-detail-row {
          display: flex;
          gap: 6px;
        }

        .pdr-detail-key {
          font-weight: 600;
          opacity: 0.75;
          flex: 0 0 auto;
        }

        .pdr-detail-value {
          font-weight: 700;
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
  dispatchNote,
  onNoteChange,
  deadlinePreset,
  onDeadlinePresetChange,
  customDeadline,
  onCustomDeadlineChange,
  workerOverrides,
  onWorkerOverrideChange,
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
  dispatchNote: string;
  onNoteChange: (note: string) => void;
  /** Gate JO-2C. The chosen response window, or null while nothing has been chosen. */
  deadlinePreset: DeadlinePreset | null;
  onDeadlinePresetChange: (preset: DeadlinePreset) => void;
  customDeadline: string;
  onCustomDeadlineChange: (value: string) => void;
  workerOverrides: Record<string, { startDate?: string; dispatchNote?: string }>;
  onWorkerOverrideChange: (id: string, field: 'startDate' | 'dispatchNote', value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
  isAuthenticated: boolean;
  demoTitle: string;
}) {
  const [showOverrides, setShowOverrides] = useState(false);

  /**
   * Gate JO-2C. The deadline the current choice actually resolves to.
   *
   * Computed for BOTH the echo line and the confirm gate from the SAME resolver the submit path uses, so
   * the button cannot be enabled by one rule and the request built by another. A null means the choice is
   * incomplete or in the past, and the batch is not sendable.
   */
  const resolvedRespondByAt = resolveRespondByAt(deadlinePreset, customDeadline);
  const resolvedDeadlineLabel = resolvedRespondByAt
    ? new Date(resolvedRespondByAt).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  // GATE JO-2C ADDED THE DEADLINE TO THE CONFIRM GATE. A batch with no valid future deadline cannot be
  // sent from here - and the server refuses it independently, so this is convenience rather than the rule.
  const canConfirm =
    dispatchDate.length > 0 && resolvedRespondByAt !== null && !loading && candidateCount > 0;
  const overrideCount = Object.values(workerOverrides).filter(
    ov => (ov.startDate && ov.startDate.length > 0) || (ov.dispatchNote && ov.dispatchNote.trim().length > 0)
  ).length;

  console.log('[DISPATCH CHAIN] Step 3: BulkDispatchModal MOUNTED. candidateCount=', candidateCount, 'canConfirm=', canConfirm, 'dispatchDate=', dispatchDate);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          minWidth: 400,
          maxWidth: 600,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/*
          GATE JO-2C WORDING CORRECTION - THE NARROWEST ONE THAT KEEPS THIS MODAL HONEST.

          The historical "Dispatch Selected" terminology cleanup is explicitly NOT in this gate's scope,
          and is not attempted. But this modal is a control JO-2C changed: it now asks an operator to set
          a JOB OFFER RESPONSE DEADLINE, and what it produces is a pending Job Offer the worker may
          decline. Leaving it titled "Dispatch Workers" would tell an operator that pressing the button
          puts people on a job site, when it asks them a question they can answer either way - and it
          would make the deadline field beside it incomprehensible.

          THREE STRINGS ARE CORRECTED AND NO MORE: this title, the summary line under it, and the confirm
          button. Every other "dispatch" word on this screen is left exactly as it was.
        */}
        <div className="dm-header">
          <h2 className="dm-title">Issue Job Offers</h2>
          <button className="dm-close" onClick={onClose}>×</button>
        </div>

        <div className="dm-body">
          <div className="dm-summary">
            <span className="dm-count">{candidateCount}</span>
            <span className="dm-label">workers to receive a job offer</span>
          </div>

          <div className="dm-field">
            <label className="dm-field-label">
              Default Start Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              className="dm-input"
              disabled={!isAuthenticated}
              title={!isAuthenticated ? demoTitle : undefined}
              value={dispatchDate}
              onChange={e => onDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/*
            GATE JO-2C - HOW LONG THE WORKER HAS TO RESPOND. REQUIRED.

            THE SMALLEST CLEAN CONTROL ON THE EXISTING SURFACE, per governance: presets for the windows
            staff actually use, plus an explicit custom instant. No new modal, no new dashboard, no
            second step.

            WHAT IS SENT IS AN ABSOLUTE INSTANT. The preset is only how the operator expresses it; a
            duration is resolved to a timestamp before anything leaves this page, so the durable fact
            is "due at 3:00 PM" rather than "somebody clicked 4 hours".

            NO "ASAP" OPTION, DELIBERATELY. It is not a duration, could never be compared to a clock,
            and would therefore be an offer with no real deadline wearing an urgent word. Urgency is
            1 hour, or a custom instant.

            NOTHING IS PRE-SELECTED, so the batch cannot be sent until somebody actually chooses. A
            default would be this modal quietly making a business decision for an operator who never
            looked at the control.
          */}
          <div className="dm-field">
            <label className="dm-field-label">
              Job Offer Response Deadline <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="dm-deadline-presets">
              {DEADLINE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className={`dm-deadline-btn${deadlinePreset === preset.id ? ' dm-deadline-active' : ''}`}
                  disabled={!isAuthenticated}
                  title={!isAuthenticated ? demoTitle : undefined}
                  onClick={() => onDeadlinePresetChange(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {deadlinePreset === 'CUSTOM' && (
              <input
                type="datetime-local"
                className="dm-input"
                style={{ marginTop: 8 }}
                disabled={!isAuthenticated}
                value={customDeadline}
                onChange={e => onCustomDeadlineChange(e.target.value)}
              />
            )}

            {/* The resolved deadline, echoed back in the operator's own local time. An operator who
                clicked "4 hours" should be able to see what wall-clock moment that actually is before
                committing a real person to it. */}
            {resolvedDeadlineLabel && (
              <p className="dm-deadline-echo">Workers must respond by {resolvedDeadlineLabel}.</p>
            )}
          </div>

          <div className="dm-field">
            <label className="dm-field-label">Default Dispatch Note</label>
            <textarea
              className="dm-input dm-textarea"
              placeholder="Worker-facing instructions (optional)"
              value={dispatchNote}
              onChange={e => onNoteChange(e.target.value)}
              rows={2}
              disabled={!isAuthenticated}
            />
          </div>

          <div className="dm-overrides-section">
            <button
              className="dm-overrides-toggle"
              onClick={() => setShowOverrides(!showOverrides)}
              type="button"
            >
              {showOverrides ? '▾' : '▸'} Per-Worker Overrides
              {overrideCount > 0 && <span className="dm-override-badge">{overrideCount}</span>}
            </button>

            {showOverrides && (
              <div className="dm-overrides-list">
                {candidates.map(c => {
                  const ov = workerOverrides[c.id] || {};
                  const hasOverride = (ov.startDate && ov.startDate.length > 0) || (ov.dispatchNote && ov.dispatchNote.trim().length > 0);
                  return (
                    <div key={c.id} className={`dm-ov-row${hasOverride ? ' dm-ov-active' : ''}`}>
                      <div className="dm-ov-worker">
                        <span className="dm-ov-name">{c.name}</span>
                        <span className="dm-ov-trade">{c.tradeName}</span>
                      </div>
                      <div className="dm-ov-fields">
                        <input
                          type="date"
                          className="dm-ov-date"
                          value={ov.startDate || ''}
                          onChange={e => onWorkerOverrideChange(c.id, 'startDate', e.target.value)}
                          placeholder="Default"
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <input
                          type="text"
                          className="dm-ov-note"
                          value={ov.dispatchNote || ''}
                          onChange={e => onWorkerOverrideChange(c.id, 'dispatchNote', e.target.value)}
                          placeholder="Note override"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '0 18px 8px', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div className="dm-footer">
          <button className="dm-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="dm-confirm"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {/* NOT "Send". Jarvis implements no delivery, and this button does not send anything. */}
            {loading ? 'Issuing...' : `Issue ${candidateCount} Job Offers`}
          </button>
        </div>

        <style jsx>{`
          .dm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 18px;
            background: #f0fdf4;
            border-bottom: 1px solid #bbf7d0;
            position: sticky;
            top: 0;
            z-index: 1;
            border-radius: 12px 12px 0 0;
          }
          .dm-title { margin: 0; font-size: 15px; font-weight: 700; color: #166534; }
          .dm-close {
            width: 28px; height: 28px; background: #fff; border: 1px solid #e5e7eb;
            border-radius: 6px; color: #374151; font-size: 18px; cursor: pointer;
          }
          .dm-close:hover { background: #f1f5f9; }

          .dm-body { padding: 18px; }

          .dm-summary {
            display: flex; align-items: baseline; gap: 8px; padding: 14px;
            background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 16px;
          }
          .dm-count { font-size: 28px; font-weight: 800; color: #16a34a; }
          .dm-label { font-size: 13px; color: #374151; font-weight: 500; }

          .dm-field { margin-bottom: 16px; }
          .dm-field-label {
            display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px;
          }

          .dm-input {
            width: 100%; padding: 9px 11px; background: #fff; border: 1px solid #d1d5db;
            border-radius: 6px; color: #111827; font-size: 13px; outline: none;
            font-family: inherit; box-sizing: border-box;
          }

          /* GATE JO-2C - the response-deadline presets. */
          .dm-deadline-presets {
            display: flex; gap: 6px; flex-wrap: wrap;
          }
          .dm-deadline-btn {
            padding: 7px 12px; background: #fff; border: 1px solid #d1d5db; border-radius: 6px;
            color: #374151; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
          }
          .dm-deadline-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .dm-deadline-active {
            border-color: #4f46e5; background: #eef2ff; color: #3730a3;
          }
          /* The resolved wall-clock deadline. An operator committing a real person to a deadline
             should see the moment, not just the duration they clicked. */
          .dm-deadline-echo {
            margin: 8px 0 0; font-size: 12px; color: #3730a3; font-weight: 600;
          }
          .dm-input:focus { border-color: #16a34a; box-shadow: 0 0 0 2px rgba(22,163,74,0.12); }
          .dm-textarea { resize: vertical; min-height: 40px; }

          .dm-overrides-section { margin-bottom: 8px; }
          .dm-overrides-toggle {
            display: flex; align-items: center; gap: 6px; padding: 8px 0;
            background: none; border: none; color: #374151; font-size: 12px; font-weight: 600; cursor: pointer;
          }
          .dm-overrides-toggle:hover { color: #111827; }
          .dm-override-badge {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 18px; height: 18px; padding: 0 5px;
            background: #dbeafe; color: #1d4ed8; font-size: 10px; font-weight: 700; border-radius: 9px;
          }

          .dm-overrides-list {
            border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-top: 6px;
          }
          .dm-ov-row { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
          .dm-ov-row:last-child { border-bottom: none; }
          .dm-ov-active { background: #eff6ff; }
          .dm-ov-worker { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .dm-ov-name { font-size: 12px; font-weight: 600; color: #111827; }
          .dm-ov-trade { font-size: 11px; color: #6b7280; }
          .dm-ov-fields { display: flex; gap: 8px; }
          .dm-ov-date {
            width: 140px; padding: 5px 8px; border: 1px solid #d1d5db;
            border-radius: 5px; font-size: 11px; color: #111827; background: #fff; outline: none;
          }
          .dm-ov-date:focus { border-color: #3b82f6; }
          .dm-ov-note {
            flex: 1; padding: 5px 8px; border: 1px solid #d1d5db;
            border-radius: 5px; font-size: 11px; color: #111827; background: #fff; outline: none;
          }
          .dm-ov-note:focus { border-color: #3b82f6; }

          .dm-footer {
            display: flex; justify-content: flex-end; gap: 10px;
            padding: 14px 18px; border-top: 1px solid #e5e7eb;
            position: sticky; bottom: 0; background: #fff;
            border-radius: 0 0 12px 12px;
          }
          .dm-cancel {
            padding: 8px 16px; background: #fff; border: 1px solid #e5e7eb;
            border-radius: 7px; color: #374151; font-size: 13px; font-weight: 600; cursor: pointer;
          }
          .dm-cancel:hover { background: #f1f5f9; border-color: #d1d5db; }
          .dm-confirm {
            padding: 8px 20px; background: #16a34a; border: none;
            border-radius: 7px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
          }
          .dm-confirm:hover:not(:disabled) { background: #15803d; }
          .dm-confirm:disabled { background: #bbf7d0; color: #6b7280; cursor: not-allowed; }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}










