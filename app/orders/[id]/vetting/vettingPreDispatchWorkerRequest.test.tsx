/**
 * Phase 17 S2 - the PRE_DISPATCH worker-request state as an operator actually sees it.
 *
 * S1 created a durable job-specific request and rendered nothing. This proves what the Vetting
 * screen now says about that request, and - the harder half - what it refuses to say.
 *
 * THE REAL SCREEN IS RENDERED, not an extracted widget, because every question worth proving
 * here is a question about wiring: which lane shows the status, which candidacy's state reaches
 * the panel, and above all whether the request state and the Onboarding clearance gate can
 * still be told apart. Only the loader is stubbed, which is what makes the second class of
 * proof possible: with the sole authorized API consumer replaced by a fixture, ANY call to the
 * request endpoint could only have come from a component that acquired its own authority.
 *
 * THE CENTRAL WORDING RISK THIS SUITE EXISTS TO CATCH. While S8-S10 delivery remains blocked,
 * nearly every live request is in PENDING_INITIAL_COMMUNICATION - the request exists and
 * NOTHING HAS BEEN SENT. Wording that as "sent" or "waiting for worker" would tell Recruiting
 * that a worker owes an answer to a question he has never been asked. Several tests below exist
 * only to make that specific lie fail loudly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  PreDispatchWorkerRequestState,
  PreDispatchWorkerRequestStatus,
  PreDispatchWorkerRequestView,
} from '@/lib/recruiting/preDispatchWorkerRequestApi';
import type { Bucket, BucketId, Candidate } from '@/data/mockRecruitingData';
import type { VettingDataState, VettingOrder } from './useVettingData';

const ORDER_ID = 'order-s2';

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

/**
 * The S2 client, stubbed so a call from anywhere is visible.
 *
 * The page imports only a TYPE from this module, which is the point: with the loader stubbed
 * too, nothing legitimate can reach it during a render, so a recorded call would mean a
 * component had started talking to the backend on its own.
 */
vi.mock('@/lib/recruiting/preDispatchWorkerRequestApi', () => ({
  getPreDispatchWorkerRequest: vi.fn(),
}));

vi.mock('@/lib/workforce/onboardingStatusApi', () => ({
  getOnboardingPreDispatchStatus: vi.fn(),
}));

vi.mock('@/components/BucketTradeSummary', () => ({ BucketTradeSummary: () => null }));
vi.mock('@/components/EventSpineTimelineSnapshot', () => ({
  EventSpineTimelineSnapshot: () => null,
}));
vi.mock('@/components/vetting/AddCandidateModal', () => ({ AddCandidateModal: () => null }));

import { apiFetch } from '@/lib/api';
import { getPreDispatchWorkerRequest } from '@/lib/recruiting/preDispatchWorkerRequestApi';
import { getOnboardingPreDispatchStatus } from '@/lib/workforce/onboardingStatusApi';
import { useVettingData } from './useVettingData';
import VettingPage from './page';

const PAGE_SOURCE = readFileSync(join(process.cwd(), 'app/orders/[id]/vetting/page.tsx'), 'utf8');
const LOADER_SOURCE = readFileSync(
  join(process.cwd(), 'app/orders/[id]/vetting/useVettingData.ts'),
  'utf8',
);

/**
 * Removes block and line comments, so source assertions examine EXECUTABLE CODE ONLY.
 *
 * Necessary because the code these tests police is heavily commented with the very words the
 * tests forbid - a comment explaining that this module creates no MagicLink would otherwise
 * fail the assertion that no MagicLink code exists.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CLIENT_SOURCE = stripComments(
  readFileSync(join(process.cwd(), 'lib/recruiting/preDispatchWorkerRequestApi.ts'), 'utf8'),
);

const refetch = vi.fn();

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function requestView(
  state: PreDispatchWorkerRequestState,
  overrides: Partial<PreDispatchWorkerRequestView> = {},
): PreDispatchWorkerRequestView {
  return {
    id: 'req-1',
    orderCandidateId: 'oc-1',
    cycleSequence: 1,
    state,
    interestResult: null,
    createdAt: '2026-09-06T10:00:00.000Z',
    initialSentAt: null,
    reminderCount: 0,
    lastReminderAt: null,
    manualResendCount: 0,
    lastManualResendAt: null,
    respondedAt: null,
    clearedAt: null,
    closedAt: null,
    closeReason: null,
    ...overrides,
  };
}

/** A successful read that found a request in the given state. */
function present(
  state: PreDispatchWorkerRequestState,
  overrides: Partial<PreDispatchWorkerRequestView> = {},
): { read: 'SUCCEEDED'; status: PreDispatchWorkerRequestStatus } {
  return {
    read: 'SUCCEEDED',
    status: { orderCandidateId: 'oc-1', present: true, request: requestView(state, overrides) },
  };
}

/** A successful read that found no current request. */
function absent(
  absence: 'NOT_IN_PRE_DISPATCH' | 'NO_REQUEST_ON_FILE',
): { read: 'SUCCEEDED'; status: PreDispatchWorkerRequestStatus } {
  return { read: 'SUCCEEDED', status: { orderCandidateId: 'oc-1', present: false, absence } };
}

/** A read that could not be answered. */
function failed(httpStatus: number | null = 403) {
  return { read: 'FAILED' as const, status: null, httpStatus };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'oc-1',
    candidateId: 'wf-1',
    name: 'Fixture Worker A',
    tradeId: 'trade-1',
    tradeName: 'Electrician',
    phone: '555-0100',
    email: 'a@example.com',
    distance: 12,
    sourceType: 'recruiter',
    certifications: [],
    availability: 'available',
    ...overrides,
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

// --------------------------------------------------------------------------
// Queries
// --------------------------------------------------------------------------

/** Request-state indicators on cards. Found by the S2 `pdr-` namespace. */
function requestIndicators(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.worker-request'));
}

function requestText(): string {
  return requestIndicators()[0]?.textContent ?? '';
}

function requestDetailBlock(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.pdr-detail');
}

/** Clearance indicators. The E4 `oc-` namespace, which S2 must leave alone. */
function clearanceIndicators(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.onboarding-clearance'));
}

function cardFor(name: string): HTMLElement {
  const card = screen.getByText(name).closest('.candidate-card');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function checkboxFor(name: string): HTMLInputElement | null {
  return cardFor(name).querySelector<HTMLInputElement>('input.card-checkbox');
}

function dispatchSelectedButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.action-btn-dispatch-bulk');
}

function openDrillDown(name: string) {
  fireEvent.click(cardFor(name));
}

/**
 * The text an OPERATOR can actually read.
 *
 * `document.body.textContent` is unusable for this: styled-jsx emits its CSS - including the
 * source comments that name the very state tokens these tests forbid - into a `<style>` element
 * that `textContent` happily returns. This walks the rendered UI with the style elements
 * removed, so a leak has to be genuinely visible on screen to fail a test.
 */
function visibleText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style, script').forEach(node => node.remove());
  return clone.textContent ?? '';
}

/** Every request path `apiFetch` was asked for. The S2 endpoint must never appear. */
function requestEndpointCalls(): string[] {
  return vi
    .mocked(apiFetch)
    .mock.calls.map(call => String(call[0]))
    .filter(path => path.includes('pre-dispatch-request'));
}

const CLEARED_ONBOARDING: Candidate['onboardingPreDispatch'] = {
  read: 'SUCCEEDED',
  status: {
    candidateId: 'wf-1',
    audience: 'PRE_DISPATCH',
    published: {
      state: 'NOT_YET_PUBLISHED',
      publishedAt: null,
      packetId: null,
      packetVersion: null,
      label: 'No onboarding on file',
    },
    work: 'ALL_MODULES_COMPLETE',
    workLabel: 'Complete',
    generatedAt: '2026-09-06T09:00:00.000Z',
    modulesDeclaringPreDispatchEvaluation: [],
    readinessState: 'READY',
    workerObligationsOutstanding: false,
    verificationOutstanding: false,
    withheldConfidentialCount: 0,
  },
};

const NOT_CLEARED_ONBOARDING: Candidate['onboardingPreDispatch'] = {
  read: 'SUCCEEDED',
  status: {
    ...CLEARED_ONBOARDING!.status!,
    readinessState: 'WORKER_OBLIGATIONS_OUTSTANDING',
    workerObligationsOutstanding: true,
    work: 'OUTSTANDING',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ==========================================================================
// 1 - 5. EACH STATE IS WORDED ACCURATELY
// ==========================================================================
describe('S2 request-state wording on the card', () => {
  it('PENDING_INITIAL_COMMUNICATION reads as not sent, never as sent or waiting', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION') })],
    });

    const text = requestText();
    expect(requestIndicators()).toHaveLength(1);
    expect(text).toContain('Worker Request Not Sent');
    // The specific lie this slice must not tell: nothing has been sent, so the worker cannot
    // be described as owing a response.
    expect(text).not.toMatch(/awaiting/i);
    expect(text).not.toMatch(/waiting/i);
    expect(text).not.toMatch(/responded/i);
  });

  it('PENDING_INITIAL_COMMUNICATION stays "not sent" even though initialSentAt is null', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION', {
            initialSentAt: null,
          }),
        }),
      ],
    });

    expect(requestText()).toContain('Not Sent');
  });

  it('AWAITING_WORKER_RESPONSE reads as awaiting the worker', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE', {
            initialSentAt: '2026-09-06T11:00:00.000Z',
          }),
        }),
      ],
    });

    expect(requestText()).toContain('Awaiting Worker Response');
  });

  it('WORKER_RESPONDED reads as responded', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('WORKER_RESPONDED', {
            respondedAt: '2026-09-06T12:00:00.000Z',
            interestResult: 'CONTINUED_INTEREST_CONFIRMED',
          }),
        }),
      ],
    });

    expect(requestText()).toContain('Worker Responded');
  });

  it('CLEARED reads as request cleared', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('CLEARED', {
            clearedAt: '2026-09-06T13:00:00.000Z',
          }),
        }),
      ],
    });

    expect(requestText()).toContain('Worker Request Cleared');
  });

  it('CLOSED reads as request closed', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('CLOSED', {
            closedAt: '2026-09-06T14:00:00.000Z',
          }),
        }),
      ],
    });

    expect(requestText()).toContain('Worker Request Closed');
  });

  it('renders no raw enum token in any state', () => {
    const states: PreDispatchWorkerRequestState[] = [
      'PENDING_INITIAL_COMMUNICATION',
      'AWAITING_WORKER_RESPONSE',
      'WORKER_RESPONDED',
      'CLEARED',
      'CLOSED',
    ];

    for (const state of states) {
      renderVetting({ PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: present(state) })] });
      const text = visibleText();
      for (const token of states) expect(text).not.toContain(token);
      expect(text).not.toContain('CONTINUED_INTEREST_CONFIRMED');
      expect(text).not.toContain('WITHDRAWAL_REQUESTED');
      expect(text).not.toContain('NO_REQUEST_ON_FILE');
      expect(text).not.toContain('NOT_IN_PRE_DISPATCH');
      cleanup();
    }
  });

  it('does not infer a state from timestamps when the authoritative state disagrees', () => {
    // Every "sent" and "responded" timestamp is populated, but the stored state says the
    // initial communication has not gone out. The stored state wins.
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION', {
            initialSentAt: '2026-09-06T11:00:00.000Z',
            respondedAt: '2026-09-06T12:00:00.000Z',
            interestResult: 'CONTINUED_INTEREST_CONFIRMED',
            reminderCount: 3,
          }),
        }),
      ],
    });

    expect(requestText()).toContain('Worker Request Not Sent');
    expect(requestText()).not.toMatch(/responded|awaiting/i);
  });
});

// ==========================================================================
// 6 + 7. MISSING AND FAILED READS
// ==========================================================================
describe('S2 missing and unreadable request state', () => {
  it('a successful read reporting no request on file says so without inventing a state', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: absent('NO_REQUEST_ON_FILE') })],
    });

    const text = requestText();
    expect(text).toContain('No Worker Request');
    expect(text).not.toMatch(/sent|awaiting|responded|cleared|closed/i);
  });

  it('a candidacy reported out of lane is not shown as an actionable request', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: absent('NOT_IN_PRE_DISPATCH') })],
    });

    expect(requestText()).toContain('No Worker Request');
  });

  it('a failed read renders unavailable and fabricates no request state', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: failed(403) })] });

    const text = requestText();
    expect(text).toContain('Worker Request Unavailable');
    expect(text).not.toMatch(/sent|awaiting|responded|cleared|closed/i);
  });

  it('a missing attachment renders unavailable, exactly like a failed read', () => {
    renderVetting({ PRE_DISPATCH: [candidate({})] });

    expect(requestText()).toContain('Worker Request Unavailable');
  });

  it('a failed read discloses no HTTP status, refusal message or framework detail', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: failed(403) })] });

    // Scoped to the S2 surfaces. The rest of the Vetting page has its own long-standing
    // vocabulary, and asserting against the whole screen would be asserting about that
    // vocabulary rather than about what a failed request read discloses.
    openDrillDown('Fixture Worker A');
    const disclosed = `${requestText()} ${requestDetailBlock()?.textContent ?? ''}`;

    expect(disclosed).not.toContain('403');
    expect(disclosed).not.toMatch(/forbidden|unauthori[sz]ed|exception|stack|http/i);
  });

  it('neither absence nor failure can reach the cleared tone', () => {
    for (const attached of [failed(403), failed(null), absent('NO_REQUEST_ON_FILE'), absent('NOT_IN_PRE_DISPATCH')]) {
      renderVetting({ PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: attached })] });
      expect(requestIndicators()[0].className).not.toContain('pdr-cleared');
      expect(requestIndicators()[0].className).not.toContain('pdr-responded');
      cleanup();
    }
  });
});

// ==========================================================================
// 8 + 9. THE ONBOARDING CLEARANCE GATE IS UNTOUCHED AND INDEPENDENT
// ==========================================================================
describe('S2 leaves the Onboarding clearance gate independent and unchanged', () => {
  it('renders both statuses as two separate elements, never one merged badge', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION'),
        }),
      ],
    });

    expect(clearanceIndicators()).toHaveLength(1);
    expect(requestIndicators()).toHaveLength(1);
    expect(clearanceIndicators()[0]).not.toBe(requestIndicators()[0]);
    expect(clearanceIndicators()[0].contains(requestIndicators()[0])).toBe(false);
    expect(requestIndicators()[0].contains(clearanceIndicators()[0])).toBe(false);
  });

  it('keeps "Onboarding Cleared" green styling exactly as E4 left it', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('CLOSED'),
        }),
      ],
    });

    const clearance = clearanceIndicators()[0];
    expect(clearance.textContent).toContain('Onboarding Cleared');
    expect(clearance.className).toContain('oc-cleared');
    expect(clearance.className).not.toContain('pdr-');
  });

  it('keeps "Onboarding Not Cleared" red styling even when the request is cleared', () => {
    // The sharpest case: the worker answered and the request cleared, but Onboarding still
    // blocks. The gate must stay red and must not be softened by the request's good news.
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: NOT_CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('CLEARED'),
        }),
      ],
    });

    const clearance = clearanceIndicators()[0];
    expect(clearance.textContent).toContain('Onboarding Not Cleared');
    expect(clearance.className).toContain('oc-not-cleared');
    expect(requestText()).toContain('Worker Request Cleared');
  });

  it('a request state never carries an oc- clearance class', () => {
    const states: PreDispatchWorkerRequestState[] = [
      'PENDING_INITIAL_COMMUNICATION',
      'AWAITING_WORKER_RESPONSE',
      'WORKER_RESPONDED',
      'CLEARED',
      'CLOSED',
    ];

    for (const state of states) {
      renderVetting({
        PRE_DISPATCH: [
          candidate({
            onboardingPreDispatch: CLEARED_ONBOARDING,
            preDispatchWorkerRequest: present(state),
          }),
        ],
      });
      expect(requestIndicators()[0].className).not.toMatch(/\boc-/);
      cleanup();
    }
  });

  it('an unreadable request does not disturb a readable clearance verdict', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: failed(500),
        }),
      ],
    });

    expect(clearanceIndicators()[0].textContent).toContain('Onboarding Cleared');
    expect(requestText()).toContain('Worker Request Unavailable');
  });

  it('an unreadable clearance verdict does not disturb a readable request state', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 },
          preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE'),
        }),
      ],
    });

    expect(clearanceIndicators()[0].textContent).toContain('Onboarding Status Unavailable');
    expect(requestText()).toContain('Awaiting Worker Response');
  });

  it('the two mappers share no branch in the page source', () => {
    expect(PAGE_SOURCE).toMatch(/function presentOnboardingClearance/);
    expect(PAGE_SOURCE).toMatch(/function presentWorkerRequest/);
    const workerMapper = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('function presentWorkerRequest'),
      PAGE_SOURCE.indexOf('function presentInterestResult'),
    );
    expect(workerMapper).not.toMatch(/presentOnboardingClearance|onboardingClearanceClass/);
    expect(workerMapper).not.toMatch(/readinessState|onboardingPreDispatch/);
  });
});

// ==========================================================================
// 10 + 11. SELECTION CONTROLS ARE UNCHANGED
// ==========================================================================
describe('S2 changes no selection or dispatch control', () => {
  it('the upper-left checkbox still appears for a cleared worker regardless of request state', () => {
    const states: PreDispatchWorkerRequestState[] = [
      'PENDING_INITIAL_COMMUNICATION',
      'AWAITING_WORKER_RESPONSE',
      'WORKER_RESPONDED',
      'CLEARED',
      'CLOSED',
    ];

    for (const state of states) {
      renderVetting({
        PRE_DISPATCH: [
          candidate({
            onboardingPreDispatch: CLEARED_ONBOARDING,
            preDispatchWorkerRequest: present(state),
          }),
        ],
      });
      expect(checkboxFor('Fixture Worker A')).not.toBeNull();
      cleanup();
    }
  });

  it('the checkbox is still withheld from a NOT-cleared worker whose request is cleared', () => {
    // Proves the gate is still Onboarding clearance alone. A cleared REQUEST must not open the
    // dispatch-selection control that only Onboarding clearance may open.
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: NOT_CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('CLEARED'),
        }),
      ],
    });

    expect(checkboxFor('Fixture Worker A')).toBeNull();
  });

  it('an unavailable request state does not withhold the checkbox from a cleared worker', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: failed(403),
        }),
      ],
    });

    expect(checkboxFor('Fixture Worker A')).not.toBeNull();
  });

  /**
   * GATE JO-2C RENAMED THIS ONE BUTTON'S LABEL, AND NOTHING ELSE ABOUT IT.
   *
   * The control now opens a modal that issues Job Offers with a response deadline rather than
   * dispatching anybody, so "Dispatch Selected" would have promised something it does not do. The
   * class name, the selector, the count and the behaviour under test are all unchanged - what this
   * test proves is still that checking a box raises the collection control with a count of 1.
   */
  it('checking the box still raises the collection control with a count of 1', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION'),
        }),
      ],
    });

    expect(dispatchSelectedButton()).toBeNull();
    fireEvent.click(checkboxFor('Fixture Worker A')!);
    expect(dispatchSelectedButton()?.textContent).toContain('Offer Job to Selected (1)');
  });

  it('the bottom persisted Select control is still rendered and still independent', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: NOT_CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('CLOSED'),
        }),
      ],
    });

    // Present even for a not-cleared worker with a closed request: S2 changed nothing here.
    expect(document.querySelector('.select-toggle-btn')).not.toBeNull();
  });

  it('no request state feeds the selection gate in the page source', () => {
    const gate = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('function isOnboardingClearedForDispatchSelection'),
      PAGE_SOURCE.indexOf('function isOnboardingClearedForDispatchSelection') + 400,
    );
    expect(gate).toMatch(/presentOnboardingClearance/);
    expect(gate).not.toMatch(/presentWorkerRequest|preDispatchWorkerRequest/);
  });

  it('the request state is not wired into any checkbox, select or dispatch prop', () => {
    expect(PAGE_SOURCE).not.toMatch(/showCheckbox=\{[^}]*[Ww]orkerRequest/);
    expect(PAGE_SOURCE).not.toMatch(/disabled=\{[^}]*[Ww]orkerRequest/);
    expect(PAGE_SOURCE).not.toMatch(/onSelectToggle=\{[^}]*[Ww]orkerRequest/);
  });
});

// ==========================================================================
// LANE SCOPE
// ==========================================================================
describe('S2 request state appears only in PRE_DISPATCH', () => {
  const OTHER_LANES: BucketId[] = [
    'OPTED_IN',
    'AWAITING_CANDIDATE_ACTION',
    'MW4H_APPROVED',
    'DISPATCHED',
    'CLOSED',
  ];

  it.each(OTHER_LANES)('renders no request indicator in %s, even with data attached', lane => {
    renderVetting({
      [lane]: [
        candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') }),
      ],
    } as Partial<Record<BucketId, Candidate[]>>);

    expect(requestIndicators()).toHaveLength(0);
  });

  it('renders the indicator for a PRE_DISPATCH worker', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') })],
    });

    expect(requestIndicators()).toHaveLength(1);
  });
});

// ==========================================================================
// DRILL-DOWN
// ==========================================================================
describe('S2 drill-down detail', () => {
  it('shows the request as its own group, not inside the Onboarding group', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE'),
        }),
      ],
    });
    openDrillDown('Fixture Worker A');

    const detail = requestDetailBlock();
    expect(detail).not.toBeNull();
    expect(screen.getByText('Worker Request')).toBeTruthy();
    // The request block is not nested inside the clearance block.
    expect(document.querySelector('.oc-detail')?.contains(detail!)).toBe(false);
  });

  it('shows the operational detail and the cycle', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION', {
            cycleSequence: 3,
          }),
        }),
      ],
    });
    openDrillDown('Fixture Worker A');

    const text = requestDetailBlock()?.textContent ?? '';
    expect(text).toContain('Not Sent');
    expect(text).toContain('initial communication not yet sent');
    expect(text).toContain('3');
  });

  it('shows a recorded withdrawal request in words, not as an enum', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          preDispatchWorkerRequest: present('WORKER_RESPONDED', {
            interestResult: 'WITHDRAWAL_REQUESTED',
            respondedAt: '2026-09-06T12:00:00.000Z',
          }),
        }),
      ],
    });
    openDrillDown('Fixture Worker A');

    const text = requestDetailBlock()?.textContent ?? '';
    expect(text).toContain('Withdrawal requested');
    expect(text).not.toContain('WITHDRAWAL_REQUESTED');
  });

  it('renders no request group for a candidate drilled into from another lane', () => {
    renderVetting({
      MW4H_APPROVED: [
        candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') }),
      ],
    });
    openDrillDown('Fixture Worker A');

    expect(requestDetailBlock()).toBeNull();
  });

  it('shows unavailable in the panel for a failed read', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ preDispatchWorkerRequest: failed(403) })],
    });
    openDrillDown('Fixture Worker A');

    expect(requestDetailBlock()?.textContent).toContain('Unavailable');
  });
});

// ==========================================================================
// 12. RENDERING TRIGGERS NO COMMUNICATION AND NO BACKEND CALL
// ==========================================================================
describe('S2 rendering triggers no communication and no backend authority', () => {
  /*
    The loader is stubbed, so NOTHING legitimate can reach the request client during a render.
    A recorded call would mean a component had acquired its own backend authority.

    `apiFetch` is asserted BY PATH rather than by call count, because the Vetting page already
    makes its own unrelated reads (the approval config, for one) and always has. Asserting zero
    total calls would be asserting something about the rest of the page, not about S2 - and
    would fail for reasons that have nothing to do with this slice.
  */
  it('no component calls the request endpoint on render', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION') }),
      ],
    });

    expect(vi.mocked(getPreDispatchWorkerRequest)).not.toHaveBeenCalled();
    expect(vi.mocked(getOnboardingPreDispatchStatus)).not.toHaveBeenCalled();
    expect(requestEndpointCalls()).toEqual([]);
  });

  it('opening the drill-down reaches the request endpoint zero times', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') }),
      ],
    });
    openDrillDown('Fixture Worker A');

    expect(vi.mocked(getPreDispatchWorkerRequest)).not.toHaveBeenCalled();
    expect(requestEndpointCalls()).toEqual([]);
  });

  it('re-rendering repeatedly reaches the request endpoint zero times', () => {
    const c = candidate({ preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION') });
    const { rerender } = renderVetting({ PRE_DISPATCH: [c] });
    for (let i = 0; i < 5; i += 1) rerender(<VettingPage />);

    expect(vi.mocked(getPreDispatchWorkerRequest)).not.toHaveBeenCalled();
    expect(requestEndpointCalls()).toEqual([]);
  });

  it('checking the dispatch checkbox reaches the request endpoint zero times', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: CLEARED_ONBOARDING,
          preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION'),
        }),
      ],
    });
    fireEvent.click(checkboxFor('Fixture Worker A')!);

    expect(vi.mocked(getPreDispatchWorkerRequest)).not.toHaveBeenCalled();
    expect(requestEndpointCalls()).toEqual([]);
  });

  it('the client module exposes only a read - no send, resend, create or MagicLink', () => {
    expect(CLIENT_SOURCE).toMatch(/export async function getPreDispatchWorkerRequest/);
    const exports = [...CLIENT_SOURCE.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(
      m => m[1],
    );
    expect(exports).toEqual(['getPreDispatchWorkerRequest']);
    expect(CLIENT_SOURCE).not.toMatch(/magicLink|MagicLink/);
    expect(CLIENT_SOURCE).not.toMatch(/method:\s*['"](POST|PATCH|PUT|DELETE)/);

    // No send/resend/remind ACTION. Matched as a call or a declaration, not as a substring:
    // `manualResendCount` and `reminderCount` are read-only projection fields the operator is
    // entitled to see, and forbidding the letters would forbid displaying them.
    expect(CLIENT_SOURCE).not.toMatch(/\b(send|resend|remind|notify|create)[A-Za-z]*\s*\(/i);
    expect(CLIENT_SOURCE).not.toMatch(/function\s+\w*(send|resend|remind|create)\w*/i);
  });

  it('the loader introduces no polling, timer or revalidation loop', () => {
    const added = LOADER_SOURCE.slice(LOADER_SOURCE.indexOf('async function attachWorkerRequestState'));
    expect(added).not.toMatch(/setInterval|setTimeout|refetchInterval/);
  });

  it('the loader reads by candidacy id, never by workforce candidate id', () => {
    const added = LOADER_SOURCE.slice(
      LOADER_SOURCE.indexOf('async function attachWorkerRequestState'),
      LOADER_SOURCE.indexOf('function buildTrades'),
    );
    expect(added).toMatch(/candidacyId/);
    expect(added).not.toMatch(/workforceCandidateId/);
  });
});

// ==========================================================================
// 13. NO CUSTOMER IDENTITY INTRODUCED
// ==========================================================================
describe('S2 introduces no customer identity', () => {
  it('the request indicator names no customer', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') }),
      ],
    });

    expect(requestText()).not.toMatch(/customer|fixture customer/i);
  });

  it('the request detail block names no customer', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('WORKER_RESPONDED') }),
      ],
    });
    openDrillDown('Fixture Worker A');

    expect(requestDetailBlock()?.textContent).not.toMatch(/customer/i);
  });

  it('the request client carries no customer or commercial field', () => {
    expect(CLIENT_SOURCE).not.toMatch(/customer/i);
    expect(CLIENT_SOURCE).not.toMatch(/payRate|billRate|basePay|baseBill|margin/i);
  });

  it('the request client exposes no workforce candidate identity or contact detail', () => {
    // `orderCandidateId` is the candidacy and is authorized; a bare `candidateId` would be the
    // WORKER and is not.
    expect(CLIENT_SOURCE).not.toMatch(/^\s*candidateId\s*:/m);
    expect(CLIENT_SOURCE).not.toMatch(/^\s*(firstName|lastName|email|phone|ssn)\s*:/m);
  });

  it('the S2 presentation layer builds no worker-facing projection', () => {
    const mapper = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('function presentWorkerRequest'),
      PAGE_SOURCE.indexOf('function workerRequestClass'),
    );
    expect(mapper).not.toMatch(/customer|projectName|jobSite/i);
  });
});

// ==========================================================================
// SCOPE BOUNDARY
// ==========================================================================
describe('S2 scope boundary', () => {
  it('adds no worker action control - the UI only displays', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') }),
      ],
    });

    const indicator = requestIndicators()[0];
    expect(indicator.querySelector('button')).toBeNull();
    expect(indicator.querySelector('input')).toBeNull();
    expect(indicator.querySelector('a')).toBeNull();
  });

  it('offers no Resend, Send or Remind control anywhere on the screen', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('PENDING_INITIAL_COMMUNICATION') }),
      ],
    });

    expect(screen.queryByText(/resend/i)).toBeNull();
    expect(screen.queryByText(/send request/i)).toBeNull();
    expect(screen.queryByText(/remind/i)).toBeNull();
  });

  it('adds no MagicLink or 24-hour expiration wording', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ preDispatchWorkerRequest: present('AWAITING_WORKER_RESPONSE') }),
      ],
    });

    expect(visibleText()).not.toMatch(/magic link|secure link|expires|24 hour/i);
    expect(stripComments(PAGE_SOURCE)).not.toMatch(/magicLink|MagicLink/);
  });
});
