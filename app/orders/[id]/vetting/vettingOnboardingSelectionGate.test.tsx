/**
 * Gate 10C-E4 - the Onboarding gate on the PRE_DISPATCH dispatch-selection checkbox.
 *
 * E4-5 rendered the authoritative clearance verdict as words. This proves the verdict now
 * governs a control: only an Onboarding-Cleared worker can be added to the existing
 * "Dispatch Selected (N)" collection, and every other verdict withholds the checkbox.
 *
 * THE GATE IS UI-ONLY AND DELIBERATELY NARROW. It hides the upper-left checkbox on the card.
 * It does not touch the Dispatch subsystem, the Dispatch Workers modal, the dispatch API, or
 * the bottom card-level "Select" control that writes `selectedForDispatch`. Two of the
 * suites below exist purely to hold that line: the other selectable lanes must behave exactly
 * as they did, and the card-level Select control must be indifferent to Onboarding entirely.
 *
 * THE REAL SCREEN IS RENDERED, not an extracted widget, because the card and the lane are
 * module-local to the Vetting page and the questions worth proving are questions about wiring.
 * Only the loader is stubbed, which is what lets a call to the Onboarding endpoint be read as
 * proof that a component acquired its own backend authority.
 *
 * What these prove:
 *
 *  - CLEARED, and only CLEARED, renders the checkbox.
 *  - EVERY OTHER VERDICT FAILS CLOSED, including the three non-ready states, a failed read, an
 *    absent attachment, and a state the verdict mapper does not recognise.
 *  - The gate is scoped to PRE_DISPATCH. The three other selectable lanes still show a
 *    checkbox for every candidate, with no Onboarding data attached at all.
 *  - A cleared worker can still be checked and still raises "Dispatch Selected (1)".
 *  - A WORKER CHECKED WHILE CLEARED CANNOT SURVIVE LOSING CLEARANCE. A check is local and
 *    outlives a refetch; clearance is authoritative and does not. The degraded worker leaves
 *    the count and the modal collection without anything having to prune the checked set.
 *  - The card-level Select control, the selection indicator, and the staged/selected card
 *    styling are untouched across every readiness state.
 *  - The gate introduced no fetch and no timer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  OnboardingPreDispatchReadinessState,
  OnboardingPreDispatchStatus,
} from '@/lib/workforce/onboardingStatusApi';
import type { Bucket, BucketId, Candidate } from '@/data/mockRecruitingData';
import type { VettingDataState, VettingOrder } from './useVettingData';

const ORDER_ID = 'order-e4gate';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: ORDER_ID }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => `/orders/${ORDER_ID}/vetting`,
}));

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, demoTitle: '' }),
}));

// A staff token carrying a `sub`, because the card-level Select action refuses without one.
const STAFF_TOKEN = `h.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64')}.s`;

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async () => null),
  getAccessToken: () => STAFF_TOKEN,
  API_BASE: 'http://localhost:3000',
}));

vi.mock('./useVettingData', () => ({ useVettingData: vi.fn() }));

/**
 * The E4 client, stubbed so that a call from anywhere is visible.
 *
 * The page does not import this module, which is the point: with the loader stubbed too,
 * nothing legitimate can reach it during a render, so a recorded call would mean the gate had
 * started asking the backend a question of its own.
 */
vi.mock('@/lib/workforce/onboardingStatusApi', () => ({
  getOnboardingPreDispatchStatus: vi.fn(),
}));

// Unrelated surfaces, stubbed to keep this suite about the selection gate.
vi.mock('@/components/BucketTradeSummary', () => ({ BucketTradeSummary: () => null }));
vi.mock('@/components/EventSpineTimelineSnapshot', () => ({
  EventSpineTimelineSnapshot: () => null,
}));
vi.mock('@/components/vetting/AddCandidateModal', () => ({ AddCandidateModal: () => null }));

import { apiFetch } from '@/lib/api';
import { getOnboardingPreDispatchStatus } from '@/lib/workforce/onboardingStatusApi';
import { useVettingData } from './useVettingData';
import VettingPage from './page';

const refetch = vi.fn();

function preDispatchStatus(
  readinessState: OnboardingPreDispatchReadinessState,
  overrides: Partial<OnboardingPreDispatchStatus> = {},
): OnboardingPreDispatchStatus {
  return {
    candidateId: 'wf-1',
    audience: 'PRE_DISPATCH',
    published: {
      state: 'NOT_YET_PUBLISHED',
      publishedAt: null,
      packetId: null,
      packetVersion: null,
      label: 'No onboarding on file',
    },
    work: 'NONE_ON_FILE',
    workLabel: 'No onboarding on file',
    generatedAt: '2026-09-06T15:00:00.000Z',
    modulesDeclaringPreDispatchEvaluation: [],
    readinessState,
    workerObligationsOutstanding: readinessState === 'WORKER_OBLIGATIONS_OUTSTANDING',
    verificationOutstanding: readinessState === 'VERIFICATION_OUTSTANDING',
    withheldConfidentialCount: 0,
    ...overrides,
  };
}

/** A worker whose readiness read succeeded and returned the given verdict. */
function withReadiness(
  readinessState: OnboardingPreDispatchReadinessState,
  overrides: Partial<Candidate> = {},
): Candidate {
  return candidate({
    onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus(readinessState) },
    ...overrides,
  });
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

const ALL_BUCKETS: BucketId[] = [
  'OPTED_IN',
  'AWAITING_CANDIDATE_ACTION',
  'MW4H_APPROVED',
  'PRE_DISPATCH',
  'DISPATCHED',
  'CLOSED',
];

function buildOrder(candidatesByBucket: Partial<Record<BucketId, Candidate[]>>): VettingOrder {
  const buckets: Bucket[] = ALL_BUCKETS.map(id => ({
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

function setVettingData(candidatesByBucket: Partial<Record<BucketId, Candidate[]>>) {
  const state: VettingDataState = { status: 'ready', order: buildOrder(candidatesByBucket) };
  vi.mocked(useVettingData).mockReturnValue({ state, refetch, tradeLines: [] });
}

function renderVetting(candidatesByBucket: Partial<Record<BucketId, Candidate[]>>) {
  setVettingData(candidatesByBucket);
  return render(<VettingPage />);
}

function cardFor(name: string): HTMLElement {
  const card = screen.getByText(name).closest('.candidate-card');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

/** The upper-left dispatch-selection checkbox, or null where the gate withheld it. */
function checkboxFor(name: string): HTMLInputElement | null {
  return cardFor(name).querySelector<HTMLInputElement>('input.card-checkbox');
}

function allCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input.card-checkbox'));
}

/** The green lane button, present only while the lane reports a selected worker. */
function dispatchSelectedButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.action-btn-dispatch-bulk');
}

/** The lane header's "N selected of M staged" line. */
function selectionSummaryText(): string {
  return document.querySelector<HTMLElement>('.selection-summary')?.textContent ?? '';
}

/** What the Dispatch Workers modal reports it would send - i.e. dispatchModalCandidates. */
function modalCandidateCount(): string {
  return document.querySelector<HTMLElement>('.dm-count')?.textContent ?? '';
}

const NON_READY_STATES: OnboardingPreDispatchReadinessState[] = [
  'NO_ONBOARDING_ON_FILE',
  'WORKER_OBLIGATIONS_OUTSTANDING',
  'VERIFICATION_OUTSTANDING',
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('PRE_DISPATCH selection gate - CLEARED permits the checkbox', () => {
  it('renders the upper-left checkbox for a READY worker whose read succeeded', () => {
    renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    expect(checkboxFor('Fixture Worker A')).not.toBeNull();
  });

  it('renders the checkbox alongside the "Onboarding Cleared" wording, never instead of it', () => {
    renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    const card = cardFor('Fixture Worker A');
    expect(card.querySelector('input.card-checkbox')).not.toBeNull();
    expect(card.querySelector('.onboarding-clearance')?.textContent).toContain(
      'Onboarding Cleared',
    );
  });
});

describe('PRE_DISPATCH selection gate - every other verdict fails closed', () => {
  for (const state of NON_READY_STATES) {
    it(`withholds the checkbox for ${state}`, () => {
      renderVetting({ PRE_DISPATCH: [withReadiness(state)] });

      expect(checkboxFor('Fixture Worker A')).toBeNull();
    });
  }

  it('withholds the checkbox when the readiness read failed', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 } }),
      ],
    });

    expect(checkboxFor('Fixture Worker A')).toBeNull();
  });

  it('withholds the checkbox when the read failed without even a status to report', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: null } }),
      ],
    });

    expect(checkboxFor('Fixture Worker A')).toBeNull();
  });

  it('withholds the checkbox when no readiness was attached at all', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ onboardingPreDispatch: undefined })] });

    expect(checkboxFor('Fixture Worker A')).toBeNull();
  });

  /**
   * A state the verdict mapper does not recognise must not come out selectable.
   *
   * The cast is the whole point: it manufactures the one input the type system promises
   * cannot occur, so that a state added to the contract tomorrow is proven to fail closed
   * today rather than silently arriving green.
   */
  it('withholds the checkbox for an unrecognised future readiness state', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus(
              'SOMETHING_ADDED_LATER' as unknown as OnboardingPreDispatchReadinessState,
            ),
          },
        }),
      ],
    });

    expect(checkboxFor('Fixture Worker A')).toBeNull();
  });

  it('gates each worker independently, so one blocked worker does not hide the lane', () => {
    renderVetting({
      PRE_DISPATCH: [
        withReadiness('READY', { id: 'oc-ready', name: 'Cleared Worker' }),
        withReadiness('WORKER_OBLIGATIONS_OUTSTANDING', {
          id: 'oc-blocked',
          name: 'Blocked Worker',
        }),
      ],
    });

    expect(checkboxFor('Cleared Worker')).not.toBeNull();
    expect(checkboxFor('Blocked Worker')).toBeNull();
    expect(allCheckboxes()).toHaveLength(1);
  });
});

describe('the gate is scoped to PRE_DISPATCH', () => {
  const otherSelectableLanes: BucketId[] = [
    'OPTED_IN',
    'AWAITING_CANDIDATE_ACTION',
    'MW4H_APPROVED',
  ];

  for (const lane of otherSelectableLanes) {
    it(`leaves ${lane} checkboxes untouched when no readiness is attached`, () => {
      renderVetting({ [lane]: [candidate({ onboardingPreDispatch: undefined })] });

      expect(checkboxFor('Fixture Worker A')).not.toBeNull();
    });

    it(`leaves ${lane} checkboxes untouched even for a not-cleared worker`, () => {
      renderVetting({ [lane]: [withReadiness('WORKER_OBLIGATIONS_OUTSTANDING')] });

      expect(checkboxFor('Fixture Worker A')).not.toBeNull();
    });
  }

  it('shows a checkbox in every other selectable lane while withholding it in PRE_DISPATCH', () => {
    renderVetting({
      OPTED_IN: [candidate({ id: 'oc-a', name: 'Opted Worker' })],
      AWAITING_CANDIDATE_ACTION: [candidate({ id: 'oc-b', name: 'Awaiting Worker' })],
      MW4H_APPROVED: [candidate({ id: 'oc-c', name: 'Approved Worker' })],
      PRE_DISPATCH: [
        withReadiness('NO_ONBOARDING_ON_FILE', { id: 'oc-d', name: 'Blocked Worker' }),
      ],
    });

    expect(checkboxFor('Opted Worker')).not.toBeNull();
    expect(checkboxFor('Awaiting Worker')).not.toBeNull();
    expect(checkboxFor('Approved Worker')).not.toBeNull();
    expect(checkboxFor('Blocked Worker')).toBeNull();
    expect(allCheckboxes()).toHaveLength(3);
  });
});

describe('a cleared worker retains the existing Dispatch Selected behaviour', () => {
  it('can still be checked', () => {
    renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    const box = checkboxFor('Fixture Worker A');
    expect(box!.checked).toBe(false);

    fireEvent.click(box!);

    expect(checkboxFor('Fixture Worker A')!.checked).toBe(true);
  });

  it('raises "Dispatch Selected (1)" once checked', () => {
    renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    expect(dispatchSelectedButton()).toBeNull();

    fireEvent.click(checkboxFor('Fixture Worker A')!);

    expect(dispatchSelectedButton()?.textContent).toContain('Dispatch Selected (1)');
  });

  it('counts only the checked worker, not the whole staged lane', () => {
    renderVetting({
      PRE_DISPATCH: [
        withReadiness('READY', { id: 'oc-1', name: 'Cleared One' }),
        withReadiness('READY', { id: 'oc-2', name: 'Cleared Two' }),
      ],
    });

    fireEvent.click(checkboxFor('Cleared One')!);

    expect(selectionSummaryText()).toContain('1 selected');
    expect(selectionSummaryText()).toContain('2 staged');
    expect(dispatchSelectedButton()?.textContent).toContain('Dispatch Selected (1)');
  });

  it('carries the checked worker into the existing Dispatch Workers modal', () => {
    renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    fireEvent.click(checkboxFor('Fixture Worker A')!);
    fireEvent.click(dispatchSelectedButton()!);

    expect(modalCandidateCount()).toBe('1');
  });
});

describe('a check cannot survive the worker losing clearance', () => {
  /**
   * The hazard the gate would otherwise leave open: `selectedIds` is local and outlives a
   * refetch, so hiding the checkbox alone would leave a degraded worker checked, counted, and
   * dispatchable. Clearance is re-asked on every render instead.
   */
  it('drops the worker from the selected count when readiness degrades', () => {
    const { rerender } = renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    fireEvent.click(checkboxFor('Fixture Worker A')!);
    expect(dispatchSelectedButton()?.textContent).toContain('Dispatch Selected (1)');

    // The lane reloads and the authoritative verdict has changed underneath the check.
    setVettingData({ PRE_DISPATCH: [withReadiness('VERIFICATION_OUTSTANDING')] });
    rerender(<VettingPage />);

    expect(selectionSummaryText()).toContain('0 selected');
    expect(dispatchSelectedButton()).toBeNull();
  });

  it('withdraws the checkbox from the degraded worker', () => {
    const { rerender } = renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    fireEvent.click(checkboxFor('Fixture Worker A')!);

    setVettingData({ PRE_DISPATCH: [withReadiness('VERIFICATION_OUTSTANDING')] });
    rerender(<VettingPage />);

    expect(checkboxFor('Fixture Worker A')).toBeNull();
  });

  it('drops the worker when readiness becomes unreadable rather than negative', () => {
    const { rerender } = renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    fireEvent.click(checkboxFor('Fixture Worker A')!);

    setVettingData({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 } }),
      ],
    });
    rerender(<VettingPage />);

    expect(selectionSummaryText()).toContain('0 selected');
    expect(dispatchSelectedButton()).toBeNull();
  });

  it('excludes the degraded worker from the open Dispatch Workers modal', () => {
    const { rerender } = renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    fireEvent.click(checkboxFor('Fixture Worker A')!);
    fireEvent.click(dispatchSelectedButton()!);
    expect(modalCandidateCount()).toBe('1');

    // Degrading while the modal is open must empty it, not leave a stale payload behind.
    setVettingData({ PRE_DISPATCH: [withReadiness('WORKER_OBLIGATIONS_OUTSTANDING')] });
    rerender(<VettingPage />);

    expect(modalCandidateCount()).toBe('0');
  });

  it('keeps a still-cleared worker while dropping only the degraded one', () => {
    const { rerender } = renderVetting({
      PRE_DISPATCH: [
        withReadiness('READY', { id: 'oc-1', name: 'Stays Cleared' }),
        withReadiness('READY', { id: 'oc-2', name: 'Loses Clearance' }),
      ],
    });

    fireEvent.click(checkboxFor('Stays Cleared')!);
    fireEvent.click(checkboxFor('Loses Clearance')!);
    expect(dispatchSelectedButton()?.textContent).toContain('Dispatch Selected (2)');

    setVettingData({
      PRE_DISPATCH: [
        withReadiness('READY', { id: 'oc-1', name: 'Stays Cleared' }),
        withReadiness('NO_ONBOARDING_ON_FILE', { id: 'oc-2', name: 'Loses Clearance' }),
      ],
    });
    rerender(<VettingPage />);

    expect(dispatchSelectedButton()?.textContent).toContain('Dispatch Selected (1)');
    expect(checkboxFor('Stays Cleared')!.checked).toBe(true);
    expect(checkboxFor('Loses Clearance')).toBeNull();
  });

  it('restores the worker if clearance returns, without needing a re-check', () => {
    const { rerender } = renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

    fireEvent.click(checkboxFor('Fixture Worker A')!);

    setVettingData({ PRE_DISPATCH: [withReadiness('WORKER_OBLIGATIONS_OUTSTANDING')] });
    rerender(<VettingPage />);
    expect(dispatchSelectedButton()).toBeNull();

    setVettingData({ PRE_DISPATCH: [withReadiness('READY')] });
    rerender(<VettingPage />);

    expect(checkboxFor('Fixture Worker A')!.checked).toBe(true);
    expect(dispatchSelectedButton()?.textContent).toContain('Dispatch Selected (1)');
  });
});

describe('the card-level Select control is untouched by the gate', () => {
  const everyVerdict: { label: string; readiness: Candidate['onboardingPreDispatch'] }[] = [
    { label: 'READY', readiness: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } },
    ...NON_READY_STATES.map(state => ({
      label: state,
      readiness: {
        read: 'SUCCEEDED' as const,
        status: preDispatchStatus(state),
      },
    })),
    {
      label: 'failed read',
      readiness: { read: 'FAILED' as const, status: null, httpStatus: 403 },
    },
    { label: 'no readiness attached', readiness: undefined },
  ];

  for (const { label, readiness } of everyVerdict) {
    it(`still offers "Select" to an unstaged worker (${label})`, () => {
      renderVetting({
        PRE_DISPATCH: [candidate({ selectedForDispatch: false, onboardingPreDispatch: readiness })],
      });

      expect(screen.getByText('Select')).toBeTruthy();
      expect(document.querySelector('.select-toggle-btn')).not.toBeNull();
    });

    it(`still shows "✓ Selected" for a staged worker (${label})`, () => {
      renderVetting({
        PRE_DISPATCH: [candidate({ selectedForDispatch: true, onboardingPreDispatch: readiness })],
      });

      expect(screen.getByText('✓ Selected')).toBeTruthy();
    });

    it(`still renders the selection indicator (${label})`, () => {
      renderVetting({
        PRE_DISPATCH: [candidate({ selectedForDispatch: true, onboardingPreDispatch: readiness })],
      });

      expect(document.querySelector('.selection-indicator')).not.toBeNull();
      expect(document.querySelector('.candidate-card.selected-card')).not.toBeNull();
    });
  }

  it('lets a not-cleared worker still be staged, so the gate blocks dispatch and not staging', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          selectedForDispatch: false,
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING'),
          },
        }),
      ],
    });

    // No dispatch-selection checkbox, but the staging action remains available and reaches
    // its own endpoint - the two controls stay independent.
    expect(checkboxFor('Fixture Worker A')).toBeNull();

    fireEvent.click(screen.getByText('Select'));

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/recruiting/select',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps staging and dispatch-selection as separate elements on a cleared worker', () => {
    renderVetting({ PRE_DISPATCH: [withReadiness('READY', { selectedForDispatch: true })] });

    const card = cardFor('Fixture Worker A');
    const box = card.querySelector('input.card-checkbox');

    expect(box).not.toBeNull();
    expect(box!.closest('.select-toggle-btn')).toBeNull();
    expect(box!.closest('.selection-indicator')).toBeNull();
  });
});

describe('the gate added no backend authority and no clock', () => {
  it('never calls the Onboarding readiness endpoint from a component', () => {
    renderVetting({
      PRE_DISPATCH: [
        withReadiness('READY', { id: 'oc-1', name: 'Cleared Worker' }),
        withReadiness('VERIFICATION_OUTSTANDING', { id: 'oc-2', name: 'Blocked Worker' }),
        candidate({ id: 'oc-3', name: 'Unread Worker', onboardingPreDispatch: undefined }),
      ],
    });

    fireEvent.click(checkboxFor('Cleared Worker')!);

    expect(vi.mocked(getOnboardingPreDispatchStatus)).not.toHaveBeenCalled();
  });

  /**
   * Rendering and checking must not write anything.
   *
   * Asserted against the write endpoints by name rather than against `apiFetch` wholesale,
   * because the page already reads the Customer Approval Gate config on mount and banning
   * every call would only prove that unrelated read still happens.
   */
  it('neither dispatches, stages, moves, nor refetches by rendering and checking the gate', () => {
    renderVetting({
      PRE_DISPATCH: [
        withReadiness('READY'),
        withReadiness('NO_ONBOARDING_ON_FILE', { id: 'oc-2', name: 'Blocked Worker' }),
      ],
    });

    fireEvent.click(checkboxFor('Fixture Worker A')!);

    const calledPaths = vi.mocked(apiFetch).mock.calls.map(([path]) => String(path));
    for (const forbidden of [
      '/recruiting/bulk-dispatch',
      '/recruiting/select',
      '/recruiting/deselect',
      '/recruiting/bulk-move',
      '/recruiting/move',
      '/assignments',
    ]) {
      expect(calledPaths.some(path => path.startsWith(forbidden))).toBe(false);
    }
    expect(refetch).not.toHaveBeenCalled();
  });

  it('introduces no timer, so clearance is never re-evaluated on a schedule', () => {
    vi.useFakeTimers();
    try {
      renderVetting({ PRE_DISPATCH: [withReadiness('READY')] });

      fireEvent.click(checkboxFor('Fixture Worker A')!);

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
