/**
 * Phase 17 S4, Ruling C - staff can see WHY a candidacy is closed.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION, Ruling C;
 * VETTING_BUILD_CHECKLIST.md PHASE 17 slice S4.
 *
 * THE PROBLEM, IN THE OWNER'S TERMS. A worker who asks to come off one job posting is closed with
 * `WORKER_WITHDREW`. Before S4 the board showed no reason at all on the closed card, so that worker
 * looked identical to one who had been turned down - and the next operator to open the order had no
 * way to tell a staffing outcome from a rejection from the worker's own choice. The backend had been
 * sending the disposition since S3; the frontend narrowing silently discarded it.
 *
 * WHAT IS PROVED HERE:
 *   - all three dispositions reach the shell, `WORKER_WITHDREW` included;
 *   - "Worker Withdrew" is rendered on the LIVE closed card, distinct from "Not Selected" and
 *     "Rejected" in its TEXT and not only in a colour;
 *   - an unrecognised disposition renders nothing rather than a raw enum name;
 *   - S4 built no new dashboard, no worker-centric staff portal and no closed-candidacy workflow,
 *     and activated no dead component.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import type { Bucket, BucketId, Candidate, ClosedDisposition } from '@/data/mockRecruitingData';
import type { VettingDataState, VettingOrder } from './useVettingData';

const ORDER_ID = 'order-s4';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: ORDER_ID }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => `/orders/${ORDER_ID}/vetting`,
}));

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, demoTitle: '' }),
}));

const STAFF_TOKEN = `h.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64')}.s`;

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async () => null),
  getAccessToken: () => STAFF_TOKEN,
  API_BASE: 'http://localhost:3000',
}));

vi.mock('./useVettingData', () => ({ useVettingData: vi.fn() }));

vi.mock('@/lib/recruiting/jobOfferLifecycleApi', () => ({
  getJobOfferHistory: vi.fn(async () => ({ read: 'FAILED', history: null, httpStatus: 403 })),
  rescindJobOffer: vi.fn(async () => ({ ok: true })),
  extendJobOfferDeadline: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/recruiting/preDispatchWorkerRequestApi', () => ({
  getPreDispatchWorkerRequest: vi.fn(),
}));

/**
 * THE ONBOARDING CLEARANCE CLIENT IS DELIBERATELY NOT MOCKED HERE.
 *
 * Naming its status-read function - even in a comment - would add this file to the enumerated list
 * of surfaces permitted to touch the PRE_DISPATCH readiness contract, which
 * `onboardingStatusApi.predispatch` guards by scanning raw source precisely so that the clearance
 * verdict cannot quietly spread to new screens. That guard fired on the first draft of this file and
 * was right to: this suite has no business with clearance, because it is about why a CLOSED
 * candidacy is closed. `apiFetch` is already stubbed above, so the real client runs and resolves to
 * nothing.
 */
vi.mock('@/components/BucketTradeSummary', () => ({ BucketTradeSummary: () => null }));
vi.mock('@/components/EventSpineTimelineSnapshot', () => ({
  EventSpineTimelineSnapshot: () => null,
}));
vi.mock('@/components/vetting/AddCandidateModal', () => ({ AddCandidateModal: () => null }));

import { useVettingData } from './useVettingData';
import VettingPage from './page';

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const PAGE_SOURCE = stripComments(
  readFileSync(join(process.cwd(), 'app/orders/[id]/vetting/page.tsx'), 'utf8'),
);
const LOADER_SOURCE = stripComments(
  readFileSync(join(process.cwd(), 'app/orders/[id]/vetting/useVettingData.ts'), 'utf8'),
);

const refetch = vi.fn();

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    id: 'oc-1',
    candidateId: 'wf-1',
    name: 'John Smith',
    tradeId: 'trade-1',
    tradeName: 'Electrician',
    phone: '555-0100',
    email: 'john@example.com',
    distance: 12,
    sourceType: 'recruiter',
    certifications: [],
    availability: 'available',
    ...over,
  };
}

const BUCKET_LABELS: Record<string, { name: string; description: string }> = {
  OPTED_IN: { name: 'Opted-In', description: 'Opted in for this job' },
  AWAITING_CANDIDATE_ACTION: { name: 'Awaiting Candidate Action', description: 'Worker-blocked' },
  MW4H_APPROVED: { name: 'MW4H Approved', description: 'Approved' },
  PRE_DISPATCH: { name: 'Pre-Dispatch', description: 'Staged for dispatch' },
  DISPATCHED: { name: 'Dispatched', description: 'On site' },
  CLOSED: { name: 'Closed', description: 'Out of the flow' },
};

function buildOrder(candidatesByBucket: Partial<Record<BucketId, Candidate[]>>): VettingOrder {
  const buckets: Bucket[] = (
    [
      'OPTED_IN',
      'AWAITING_CANDIDATE_ACTION',
      'MW4H_APPROVED',
      'PRE_DISPATCH',
      'DISPATCHED',
      'CLOSED',
    ] as BucketId[]
  ).map(id => ({
    id,
    name: BUCKET_LABELS[id].name,
    description: BUCKET_LABELS[id].description,
    candidates: candidatesByBucket[id] ?? [],
  }));

  return {
    id: ORDER_ID,
    projectName: 'Fixture Project',
    customerName: 'Fixture Customer',
    location: 'Somewhere, TX',
    startDate: '2026-09-01',
    endDate: '2026-12-01',
    requiresCustomerPreApproval: false,
    trades: [{ id: 'trade-1', name: 'Electrician', totalRequired: 4, dispatched: 1 }],
    buckets,
    staffing: {
      summary: {
        requested: 4,
        dispatched: 1,
        adjustments: 0,
        open: 3,
        hasOpenings: true,
        fullyStaffed: false,
      },
      trades: [],
    },
  };
}

function renderVetting(candidatesByBucket: Partial<Record<BucketId, Candidate[]>>) {
  const state: VettingDataState = { status: 'ready', order: buildOrder(candidatesByBucket) };
  vi.mocked(useVettingData).mockReturnValue({ state, refetch, tradeLines: [] });
  return render(<VettingPage />);
}

/** One closed candidacy with the given reason. */
function closed(disposition: ClosedDisposition | undefined, name = 'John Smith') {
  return candidate({ id: `oc-${name}`, name, closedDisposition: disposition });
}

/**
 * Every closure reason currently on screen, read from the closure ROW specifically.
 *
 * SCOPED TO `.closed-disposition` RATHER THAN SEARCHED BY TEXT, because "Rejected" is also a
 * customer-approval status elsewhere on this board. A bare `getByText('Rejected')` would match the
 * approval summary and let an assertion pass - or fail - for a reason that has nothing to do with
 * why a candidacy is closed.
 */
function closureLabels(): string[] {
  return Array.from(document.querySelectorAll('.closed-disposition .cd-label')).map(
    el => el.textContent ?? '',
  );
}

beforeEach(() => {
  refetch.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Ruling C - the closure reason on the live closed card', () => {
  it('shows "Worker Withdrew" when the worker asked to come off the job', () => {
    renderVetting({ CLOSED: [closed('WORKER_WITHDREW')] });

    expect(closureLabels()).toEqual(['Worker Withdrew']);
  });

  it('distinguishes all three reasons in TEXT, not in a colour', () => {
    renderVetting({
      CLOSED: [
        closed('WORKER_WITHDREW', 'Withdrew Worker'),
        closed('NOT_SELECTED', 'Passed Over'),
        closed('REJECTED', 'Turned Down'),
      ],
    });

    // THE WORDS CARRY THE MEANING, so the distinction survives greyscale and a colour-blind
    // operator - the same rule every other status row on this card follows. An operator can tell a
    // staffing outcome from a decision about the worker from the worker's own choice at a glance.
    expect(closureLabels()).toEqual(['Worker Withdrew', 'Not Selected', 'Rejected']);
  });

  it('does not describe a worker\'s own choice as a staff decision', () => {
    renderVetting({ CLOSED: [closed('WORKER_WITHDREW')] });

    // The whole point of Ruling C. Before S4 this candidacy was indistinguishable from one that had
    // been passed over or turned down, and neither of those labels may appear on it now.
    expect(closureLabels()).not.toContain('Not Selected');
    expect(closureLabels()).not.toContain('Rejected');
  });

  it('renders nothing at all for an open candidacy', () => {
    renderVetting({ PRE_DISPATCH: [closed(undefined)] });

    // `closedDisposition` is its own gate: it exists if and only if the candidacy is closed, so an
    // active worker's card has no closure row to show and needs no flag to suppress one.
    expect(closureLabels()).toEqual([]);
  });

  it('shows no reason rather than a raw enum name for an unknown disposition', () => {
    // A disposition a future backend might add, arriving through a stale build. Nothing renders the
    // raw identifier and nothing renders `undefined`, so an operator sees no reason at all rather
    // than a database name or a wrong label.
    renderVetting({
      CLOSED: [closed('SOMETHING_NEW' as ClosedDisposition)],
    });

    expect(document.body.textContent).not.toContain('SOMETHING_NEW');
    expect(closureLabels()).not.toContain('undefined');
  });

  it('is rendered on the card, not behind a click into the drill-down', () => {
    renderVetting({ CLOSED: [closed('WORKER_WITHDREW')] });

    // Ruling C asks for the reason "on the actual closed candidacy card staff use". It is present
    // in the initial render with no interaction, so an operator scanning the Closed lane reads every
    // reason at once rather than opening each worker in turn.
    const row = document.querySelector('.closed-disposition');
    expect(row).not.toBeNull();
    expect(row!.closest('.candidate-card')).not.toBeNull();
  });
});

describe('Ruling C - the loader admits the disposition the backend already sends', () => {
  it('narrows through an allowlist that now includes WORKER_WITHDREW', () => {
    expect(LOADER_SOURCE).toContain("bc.closed?.disposition === 'WORKER_WITHDREW'");
    // STILL AN ALLOWLIST, NOT A CAST. `as ClosedDisposition` would let any future backend string
    // through to the label lookup and render as `undefined` in front of staff.
    expect(LOADER_SOURCE).not.toMatch(/as ClosedDisposition/);
  });

  it('required no backend change, because the disposition was always on the wire', () => {
    // S3 introduced `WORKER_WITHDREW` and the order-candidate read has returned it since. Ruling C
    // is a frontend-only correction, which is why S4 needed no schema change and no new endpoint
    // for it.
    expect(LOADER_SOURCE).toContain('closedDisposition');
    expect(LOADER_SOURCE).not.toMatch(/getClosedDisposition|closedDispositionApi/);
  });
});

describe('Ruling C - scope firewall', () => {
  it('builds no new dashboard, staff portal or closed-candidacy workflow', () => {
    // Ruling C: "Do not build a new dashboard, worker-centric staff portal, new closed-candidacy
    // workflow, or Vetting redesign."
    expect(PAGE_SOURCE).not.toMatch(
      /WorkerDashboard|StaffWorkerPortal|ClosedCandidacyWorkflow|WithdrawalReview/,
    );
  });

  it('activates no dead component merely because it exists', () => {
    // `ClosedLane` is defined in this file and rendered nowhere - the live closed lane is
    // `LaneColumn` with `VettingCandidateCard`. Ruling C forbids activating it, so it stays
    // unreferenced and the reason went on the card that is actually on screen.
    expect(PAGE_SOURCE).toContain('function ClosedLane');
    expect(PAGE_SOURCE).not.toMatch(/<ClosedLane[\s/>]/);
  });

  it('adds no staff control over the worker\'s withdrawal', () => {
    renderVetting({ CLOSED: [closed('WORKER_WITHDREW')] });
    expect(closureLabels()).toEqual(['Worker Withdrew']);

    // The reason is INFORMATION. S4 authorized no way for staff to undo, dispute, approve or
    // re-open a worker's own withdrawal from this surface.
    expect(
      screen.queryByRole('button', { name: /undo withdrawal|reinstate|reopen|dispute/i }),
    ).toBeNull();
  });

  it('gives the closure reason its own style namespace', () => {
    // A "cd-" namespace sharing no selector with the "oc-" clearance, "pdr-" request or "jo-" offer
    // rows, for the same reason those three share none with each other: no single stylesheet edit
    // may collapse them into one indicator or let a closure reason inherit the clearance gate's red.
    expect(PAGE_SOURCE).toContain('closed-disposition');
    expect(PAGE_SOURCE).toMatch(/\.cd-withdrew/);
    expect(PAGE_SOURCE).not.toMatch(/\.oc-withdrew|\.pdr-withdrew|\.jo-withdrew/);
  });
});
