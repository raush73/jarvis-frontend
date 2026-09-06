/**
 * Gate 10C-E4 slice E4-5 - the Onboarding clearance verdict as an operator actually sees it.
 *
 * E4-4 attached the authoritative projection to PRE_DISPATCH candidates and deliberately
 * rendered nothing. This proves what the screen now says about a worker, and - just as
 * importantly - what it refuses to say.
 *
 * THE REAL SCREEN IS RENDERED, not an extracted widget: the card and the drill-down are
 * module-local to the Vetting page, and the questions worth proving here are questions about
 * wiring - which lane gets the indicator, which candidate's verdict reaches the panel,
 * whether staging and clearance can be told apart. Only the loader is stubbed, which is what
 * makes the second class of proof possible: with the sole authorized API consumer replaced by
 * a fixture, ANY call to the Onboarding endpoint could only have come from a component.
 *
 * What these prove:
 *
 *  - Each of the four governed states is worded as the Owner ratified, and nothing says
 *    "ready for pre-dispatch" - the worker is already there.
 *  - AN UNREADABLE STATUS IS NOT A VERDICT. A failed read and a missing attachment both say
 *    "Unavailable", and neither can come out green or red.
 *  - THE VERDICT IS NOT THE SELECTION CUE. A worker can be staged for dispatch and not
 *    cleared at the same moment, and the two are separate elements with separate wording.
 *  - Lanes other than PRE_DISPATCH ask no clearance question, even when data is attached.
 *  - The drill-down explains a blockage with governed reason text, and discloses no HTTP
 *    status, no framework refusal, no count, and no confidential requirement's name.
 *  - No component reaches the backend, no timer was introduced, and no Dispatch control was
 *    disabled by anything in this slice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  OnboardingPreDispatchReadinessState,
  OnboardingPreDispatchStatus,
} from '@/lib/workforce/onboardingStatusApi';
import type { Bucket, BucketId, Candidate } from '@/data/mockRecruitingData';
import type { VettingDataState, VettingOrder } from './useVettingData';

const ORDER_ID = 'order-e45';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: ORDER_ID }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => `/orders/${ORDER_ID}/vetting`,
}));

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, demoTitle: '' }),
}));

// A staff token carrying a `sub`, because the selection action refuses to fire without one.
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
 * The page does not import this module at all, which is the point: with the loader stubbed
 * too, nothing legitimate can reach it during a render, so a recorded call would mean a
 * component had acquired its own backend authority.
 */
vi.mock('@/lib/workforce/onboardingStatusApi', () => ({
  getOnboardingPreDispatchStatus: vi.fn(),
}));

// Unrelated surfaces, stubbed to keep this suite about the clearance verdict.
vi.mock('@/components/BucketTradeSummary', () => ({ BucketTradeSummary: () => null }));
vi.mock('@/components/EventSpineTimelineSnapshot', () => ({
  EventSpineTimelineSnapshot: () => null,
}));
vi.mock('@/components/vetting/AddCandidateModal', () => ({ AddCandidateModal: () => null }));

import { apiFetch } from '@/lib/api';
import { getOnboardingPreDispatchStatus } from '@/lib/workforce/onboardingStatusApi';
import { useVettingData } from './useVettingData';
import VettingPage from './page';

const PAGE_SOURCE = readFileSync(
  join(process.cwd(), 'app/orders/[id]/vetting/page.tsx'),
  'utf8',
);

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
    generatedAt: '2026-09-05T18:30:00.000Z',
    modulesDeclaringPreDispatchEvaluation: [],
    readinessState,
    workerObligationsOutstanding: readinessState === 'WORKER_OBLIGATIONS_OUTSTANDING',
    verificationOutstanding: readinessState === 'VERIFICATION_OUTSTANDING',
    withheldConfidentialCount: 0,
    ...overrides,
  };
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

/** Every clearance indicator on screen, card or panel, found by its own class. */
function clearanceElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.onboarding-clearance, .oc-detail'),
  );
}

function cardIndicators(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.onboarding-clearance'));
}

function detailBlock(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.oc-detail');
}

function openDrillDown(name: string) {
  const card = screen.getByText(name).closest('.candidate-card');
  expect(card).not.toBeNull();
  fireEvent.click(card as Element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('E4-5 PRE_DISPATCH card verdict', () => {
  it('words READY as "Onboarding Cleared"', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    expect(cardIndicators()).toHaveLength(1);
    expect(cardIndicators()[0].textContent).toContain('Onboarding Cleared');
  });

  it('words NO_ONBOARDING_ON_FILE as "Onboarding Not Cleared"', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('NO_ONBOARDING_ON_FILE'),
          },
        }),
      ],
    });

    expect(cardIndicators()[0].textContent).toContain('Onboarding Not Cleared');
  });

  it('words WORKER_OBLIGATIONS_OUTSTANDING as "Onboarding Not Cleared"', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING'),
          },
        }),
      ],
    });

    expect(cardIndicators()[0].textContent).toContain('Onboarding Not Cleared');
  });

  it('words VERIFICATION_OUTSTANDING as "Onboarding Not Cleared"', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('VERIFICATION_OUTSTANDING'),
          },
        }),
      ],
    });

    expect(cardIndicators()[0].textContent).toContain('Onboarding Not Cleared');
  });

  it('never words a verdict as readiness FOR pre-dispatch, since the worker is already there', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    const wording = cardIndicators()[0].textContent ?? '';
    expect(wording).not.toMatch(/ready for pre-?dispatch/i);
    expect(wording).not.toMatch(/eligible/i);
    expect(wording).not.toMatch(/can enter/i);
  });
});

describe('E4-5 an unreadable status is not a verdict', () => {
  it('words a FAILED read as "Onboarding Status Unavailable"', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 } }),
      ],
    });

    const indicator = cardIndicators()[0];
    expect(indicator.textContent).toContain('Onboarding Status Unavailable');
    expect(indicator.textContent).not.toContain('Cleared');
  });

  it('words a PRE_DISPATCH candidate with no attachment as "Onboarding Status Unavailable"', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ onboardingPreDispatch: undefined })] });

    const indicator = cardIndicators()[0];
    expect(indicator.textContent).toContain('Onboarding Status Unavailable');
    expect(indicator.textContent).not.toContain('Cleared');
  });

  it('gives the unavailable state neither the cleared nor the not-cleared treatment', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ id: 'oc-a', name: 'Cleared Worker', candidateId: 'wf-a',
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } }),
        candidate({ id: 'oc-b', name: 'Unread Worker', candidateId: 'wf-b',
          onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 500 } }),
      ],
    });

    const [cleared, unread] = cardIndicators();
    expect(cleared.className).toContain('oc-cleared');
    expect(unread.className).toContain('oc-unavailable');
    expect(unread.className).not.toContain('oc-cleared');
    expect(unread.className).not.toContain('oc-not-cleared');
  });

  it('cannot turn an unrecognized state green', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus(
              'SOMETHING_THE_CLIENT_DOES_NOT_KNOW' as OnboardingPreDispatchReadinessState,
            ),
          },
        }),
      ],
    });

    const indicator = cardIndicators()[0];
    expect(indicator.textContent).toContain('Onboarding Status Unavailable');
    expect(indicator.className).not.toContain('oc-cleared');
  });
});

describe('E4-5 the verdict is not the selection cue', () => {
  it('shows a staged worker as selected AND not cleared at the same time', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          selectedForDispatch: true,
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING'),
          },
        }),
      ],
    });

    // Staging semantics, untouched.
    expect(screen.getByText('✓ Selected')).toBeTruthy();
    expect(document.querySelector('.selection-indicator')).not.toBeNull();
    expect(document.querySelector('.candidate-card.selected-card')).not.toBeNull();

    // The clearance verdict, separately and contradictorily.
    expect(cardIndicators()[0].textContent).toContain('Onboarding Not Cleared');
  });

  it('renders the verdict as its own element, outside the selection indicator', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          selectedForDispatch: true,
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    const selection = document.querySelector('.selection-indicator') as HTMLElement;
    const indicator = cardIndicators()[0];

    expect(indicator).not.toBe(selection);
    expect(selection.contains(indicator)).toBe(false);
    expect(indicator.contains(selection)).toBe(false);
    expect(indicator.closest('.card-header')).toBeNull();
  });

  it('borrows neither the check nor the circle glyph that mean "selected"', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    const wording = cardIndicators()[0].textContent ?? '';
    expect(wording).not.toContain('✓');
    expect(wording).not.toContain('○');
  });

  it('names its own subject, so the verdict cannot be read as a staging state', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('VERIFICATION_OUTSTANDING'),
          },
        }),
      ],
    });

    expect(cardIndicators()[0].textContent).toContain('Onboarding');
  });
});

describe('E4-5 the card does not rely on colour alone', () => {
  it('carries the verdict in text as well as in a tone class', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('NO_ONBOARDING_ON_FILE'),
          },
        }),
      ],
    });

    const indicator = cardIndicators()[0];
    expect(indicator.textContent?.trim()).toBe('Onboarding Not Cleared');
    expect(indicator.className).toContain('oc-not-cleared');
  });

  it('leaves the colour swatch out of the accessibility tree', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    const dot = document.querySelector('.oc-dot');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.textContent).toBe('');
  });
});

describe('E4-5 lanes other than PRE_DISPATCH', () => {
  it('asks no clearance question, even where an attachment exists', () => {
    renderVetting({
      OPTED_IN: [
        candidate({ id: 'oc-o', name: 'Opted In Worker', candidateId: 'wf-o',
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } }),
      ],
      AWAITING_CANDIDATE_ACTION: [
        candidate({ id: 'oc-w', name: 'Awaiting Worker', candidateId: 'wf-w',
          onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 } }),
      ],
      MW4H_APPROVED: [
        candidate({ id: 'oc-m', name: 'Approved Worker', candidateId: 'wf-m',
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING'),
          } }),
      ],
    });

    expect(screen.getByText('Opted In Worker')).toBeTruthy();
    expect(screen.getByText('Awaiting Worker')).toBeTruthy();
    expect(screen.getByText('Approved Worker')).toBeTruthy();

    expect(clearanceElements()).toHaveLength(0);
    expect(screen.queryByText(/Onboarding Cleared/)).toBeNull();
    expect(screen.queryByText(/Onboarding Not Cleared/)).toBeNull();
    expect(screen.queryByText(/Onboarding Status Unavailable/)).toBeNull();
  });

  it('indicates only the PRE_DISPATCH worker when lanes are populated together', () => {
    renderVetting({
      MW4H_APPROVED: [
        candidate({ id: 'oc-m', name: 'Approved Worker', candidateId: 'wf-m',
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } }),
      ],
      PRE_DISPATCH: [
        candidate({ id: 'oc-p', name: 'Staged Worker', candidateId: 'wf-p',
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } }),
      ],
    });

    expect(cardIndicators()).toHaveLength(1);
    const indicated = cardIndicators()[0].closest('.candidate-card');
    expect(indicated?.textContent).toContain('Staged Worker');
    expect(indicated?.textContent).not.toContain('Approved Worker');
  });

  it('gives the drill-down of a non-PRE_DISPATCH worker no Onboarding section', () => {
    renderVetting({
      MW4H_APPROVED: [
        candidate({ id: 'oc-m', name: 'Approved Worker', candidateId: 'wf-m',
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } }),
      ],
    });

    openDrillDown('Approved Worker');

    expect(screen.getByText('Candidate Details')).toBeTruthy();
    expect(detailBlock()).toBeNull();
    expect(screen.queryByText('Onboarding')).toBeNull();
  });
});

describe('E4-5 drill-down reason mapping', () => {
  const cases: {
    state: OnboardingPreDispatchReadinessState;
    statusWord: string;
    reason: string | null;
  }[] = [
    { state: 'READY', statusWord: 'Cleared', reason: null },
    { state: 'NO_ONBOARDING_ON_FILE', statusWord: 'Not Cleared', reason: 'No onboarding on file' },
    {
      state: 'WORKER_OBLIGATIONS_OUTSTANDING',
      statusWord: 'Not Cleared',
      reason: 'Worker action required',
    },
    {
      state: 'VERIFICATION_OUTSTANDING',
      statusWord: 'Not Cleared',
      reason: 'Verification required',
    },
  ];

  for (const { state, statusWord, reason } of cases) {
    it(`explains ${state} as "${statusWord}"${reason ? ` / "${reason}"` : ' with no reason line'}`, () => {
      renderVetting({
        PRE_DISPATCH: [
          candidate({
            onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus(state) },
          }),
        ],
      });

      openDrillDown('Fixture Worker A');

      expect(screen.getByText('Onboarding')).toBeTruthy();
      const block = detailBlock();
      expect(block).not.toBeNull();
      expect(block?.textContent).toContain('Status:');
      expect(block?.textContent).toContain(statusWord);

      if (reason) {
        expect(block?.textContent).toContain('Reason:');
        expect(block?.textContent).toContain(reason);
      } else {
        expect(block?.textContent).not.toContain('Reason:');
      }
    });
  }

  it('explains a FAILED read as unavailable, with no reason invented for it', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 } }),
      ],
    });

    openDrillDown('Fixture Worker A');

    const block = detailBlock();
    expect(block?.textContent).toContain('Unavailable');
    expect(block?.textContent).not.toContain('Reason:');
    expect(block?.textContent).not.toContain('Cleared');
  });

  it('explains a missing attachment as unavailable', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ onboardingPreDispatch: undefined })] });

    openDrillDown('Fixture Worker A');

    expect(detailBlock()?.textContent).toContain('Unavailable');
  });

  it('reads the verdict from the live lane, so the panel is never a stale snapshot', () => {
    const staged = candidate({
      onboardingPreDispatch: {
        read: 'SUCCEEDED',
        status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING'),
      },
    });
    const { rerender } = renderVetting({ PRE_DISPATCH: [staged] });

    openDrillDown('Fixture Worker A');
    expect(detailBlock()?.textContent).toContain('Not Cleared');

    // The worker clears onboarding and the lane reloads; the clicked snapshot did not change.
    vi.mocked(useVettingData).mockReturnValue({
      state: {
        status: 'ready',
        order: buildOrder({
          PRE_DISPATCH: [
            candidate({
              onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
            }),
          ],
        }),
      },
      refetch,
      tradeLines: [],
    });
    rerender(<VettingPage />);

    expect(detailBlock()?.textContent).toContain('Cleared');
    expect(detailBlock()?.textContent).not.toContain('Not Cleared');
  });
});

describe('E4-5 the drill-down discloses nothing protected', () => {
  it('never shows the HTTP status of a failed read', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 } }),
      ],
    });

    openDrillDown('Fixture Worker A');

    const block = detailBlock();
    expect(block?.textContent).not.toContain('403');
    expect(block?.textContent).not.toMatch(/\d{3}/);
    expect(block?.textContent).not.toMatch(/http/i);
    expect(block?.textContent).not.toMatch(/forbidden|unauthorized|error/i);
    // Nor anywhere else the verdict is rendered.
    expect(cardIndicators()[0].textContent).not.toContain('403');
  });

  it('never names a module, a protected value, or the internal field names', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING', {
              withheldConfidentialCount: 3,
              modulesDeclaringPreDispatchEvaluation: [
                {
                  moduleKey: 'PAYROLL_PAYMENT',
                  moduleNumber: '7',
                  title: 'Payroll Payment',
                  status: { state: 'NOT_STARTED', label: 'Not started', outstanding: true },
                },
              ],
            }),
          },
        }),
      ],
    });

    openDrillDown('Fixture Worker A');

    const text = detailBlock()?.textContent ?? '';
    for (const forbidden of [
      'PAYROLL_PAYMENT',
      'Payroll',
      'SSN',
      'DOB',
      'routing',
      'account',
      'bank',
      'withheldConfidentialCount',
      'readinessState',
      'workerObligationsOutstanding',
      'verificationOutstanding',
      'moduleKey',
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('reports a withheld confidential requirement generically, and never its count', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING', {
              withheldConfidentialCount: 3,
            }),
          },
        }),
      ],
    });

    openDrillDown('Fixture Worker A');

    // Scoped to the notice itself: the block also carries the server's timestamp, and it is
    // the NOTICE that must be free of the count.
    const note = document.querySelector('.oc-detail-note');
    expect(note?.textContent?.trim()).toBe('Additional confidential verification required');
    expect(note?.textContent).not.toMatch(/\d/);
    expect(detailBlock()?.textContent).not.toContain('withheld');
  });

  it('says nothing about confidential requirements when none are withheld', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING', {
              withheldConfidentialCount: 0,
            }),
          },
        }),
      ],
    });

    openDrillDown('Fixture Worker A');

    expect(detailBlock()?.textContent).not.toContain('confidential');
  });

  it('keeps the withholding notice off the card, which states the verdict only', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('WORKER_OBLIGATIONS_OUTSTANDING', {
              withheldConfidentialCount: 2,
            }),
          },
        }),
      ],
    });

    expect(cardIndicators()[0].textContent?.trim()).toBe('Onboarding Not Cleared');
  });
});

describe('E4-5 freshness', () => {
  it('shows the backend generatedAt as "As of", for a verdict that has one', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    openDrillDown('Fixture Worker A');

    const asOf = document.querySelector('.oc-detail-asof');
    expect(asOf).not.toBeNull();
    expect(asOf?.textContent).toContain('As of');
    expect(asOf?.textContent).toContain(new Date('2026-09-05T18:30:00.000Z').toLocaleString());
  });

  it('omits "As of" entirely when no authoritative timestamp was read', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 500 } }),
      ],
    });

    openDrillDown('Fixture Worker A');

    expect(document.querySelector('.oc-detail-asof')).toBeNull();
    expect(detailBlock()?.textContent).not.toContain('As of');
  });

  it('omits "As of" rather than substituting request time for an unusable timestamp', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('READY', { generatedAt: 'not-a-timestamp' }),
          },
        }),
      ],
    });

    openDrillDown('Fixture Worker A');

    expect(document.querySelector('.oc-detail-asof')).toBeNull();
  });
});

describe('E4-5 the loader remains the sole backend authority', () => {
  it('performs no Onboarding read from any component', async () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
    });

    openDrillDown('Fixture Worker A');
    await waitFor(() => expect(cardIndicators()).toHaveLength(1));

    expect(getOnboardingPreDispatchStatus).not.toHaveBeenCalled();
  });

  it('leaves no Onboarding endpoint or client reachable from the page source', () => {
    expect(PAGE_SOURCE).not.toContain('getOnboardingPreDispatchStatus');
    expect(PAGE_SOURCE).not.toContain('onboardingStatusApi');
    expect(PAGE_SOURCE).not.toContain('onboardingAdminApi');
    expect(PAGE_SOURCE).not.toContain('/onboarding/status');
    expect(PAGE_SOURCE).not.toContain('pre-dispatch/');
  });

  it('words the server\u2019s verdict without deriving one from the summary flags', () => {
    // `readinessState` is read, because that IS the server's verdict. The flags behind it are
    // never touched, so this surface cannot reach a conclusion the server did not audit.
    expect(PAGE_SOURCE).toContain('readinessState');
    expect(PAGE_SOURCE).not.toContain('workerObligationsOutstanding');
    expect(PAGE_SOURCE).not.toContain('verificationOutstanding');
  });

  it('introduces no timer, interval, or background revalidation', () => {
    expect(PAGE_SOURCE).not.toContain('setInterval');
    expect(PAGE_SOURCE).not.toContain('setTimeout');
    expect(PAGE_SOURCE).not.toContain('requestAnimationFrame');
  });

  it('does not refresh the status on its own over time', () => {
    vi.useFakeTimers();
    try {
      renderVetting({
        PRE_DISPATCH: [
          candidate({
            onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
          }),
        ],
      });

      const callsAfterMount = refetch.mock.calls.length;
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(getOnboardingPreDispatchStatus).not.toHaveBeenCalled();
      expect(refetch.mock.calls.length).toBe(callsAfterMount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('adds no role-name authorization to the surface', () => {
    const roleNames = /\b(isAdmin|hasRole|role\s*===\s*['"]|ADMIN|recruiting|accounting)\b/;
    const clearanceRegion = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('function presentOnboardingClearance'),
      PAGE_SOURCE.indexOf('function getReadinessSignal'),
    );
    expect(clearanceRegion.length).toBeGreaterThan(0);
    expect(clearanceRegion).not.toMatch(roleNames);
  });
});

describe('E4-5 Dispatch and existing Vetting behaviour', () => {
  it('leaves the selection action live for a worker who is not cleared', async () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: {
            read: 'SUCCEEDED',
            status: preDispatchStatus('NO_ONBOARDING_ON_FILE'),
          },
        }),
      ],
    });

    const selectButton = screen.getByRole('button', { name: 'Select' });
    expect((selectButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(selectButton);

    await waitFor(() =>
      expect(vi.mocked(apiFetch).mock.calls.some(call => call[0] === '/recruiting/select')).toBe(
        true,
      ),
    );
  });

  /**
   * Retargeted to the card-level staging control.
   *
   * This originally asserted the upper-left dispatch-selection checkbox as well, which the
   * Owner has since ruled must be withheld from a worker who is not cleared - proven in
   * `vettingOnboardingSelectionGate.test.tsx`. E4-5's finding survives where it is still
   * true: STAGING IS NOT DISPATCH SELECTION, so the Select control stays live regardless of
   * the verdict, and an unreadable status is no more disqualifying here than a negative one.
   */
  it('leaves the staging control live when the verdict could not be read at all', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'FAILED', status: null, httpStatus: 403 },
        }),
      ],
    });

    const stagingControl = document.querySelector('.select-toggle-btn') as HTMLButtonElement;
    expect(stagingControl).not.toBeNull();
    expect(stagingControl.disabled).toBe(false);
    expect(stagingControl.textContent).toContain('Select');
  });

  /**
   * Narrowed to what these assertions actually establish.
   *
   * The title once claimed the verdict gated nothing at all. It now gates one thing - whether
   * the PRE_DISPATCH dispatch-selection checkbox is rendered - and does so by withholding the
   * control at render time. That is why these assertions still hold: no control is DISABLED
   * by the verdict, and no dispatch, staging or movement ACTION branches on it. Both remain
   * worth holding, because either would be a different and worse design.
   */
  it('disables no control, and puts the verdict inside no dispatch, staging or movement action', () => {
    // No control's enabled-ness is bound to the verdict.
    expect(PAGE_SOURCE).not.toMatch(/disabled=\{[^}]*clearance/);
    expect(PAGE_SOURCE).not.toMatch(/disabled=\{[^}]*onboarding/i);

    // And no line that dispatches, selects, or moves a candidate consults it.
    const actionLines = PAGE_SOURCE.split('\n').filter(line =>
      /bulk-dispatch|bulk-move|recruiting\/select|recruiting\/deselect|handleBulkDispatch|handleBulkMove|handleSelectToggle|onOpenDispatchModal/.test(
        line,
      ),
    );
    expect(actionLines.length).toBeGreaterThan(0);
    for (const line of actionLines) {
      expect(line.toLowerCase()).not.toContain('clearance');
      expect(line.toLowerCase()).not.toContain('onboarding');
    }
  });

  it('keeps the rest of the Vetting screen intact', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') },
        }),
      ],
      DISPATCHED: [candidate({ id: 'oc-d', name: 'Dispatched Worker', candidateId: 'wf-d' })],
    });

    expect(screen.getByText('Fixture Project')).toBeTruthy();
    expect(screen.getByText('Pre-Dispatch')).toBeTruthy();
    expect(screen.getByText('Fixture Worker A')).toBeTruthy();
    expect(screen.getByText('Dispatched Worker')).toBeTruthy();
    expect(screen.getAllByText('Electrician').length).toBeGreaterThan(0);
  });

  it('leaves the DISPATCHED lane card untouched by the clearance indicator', () => {
    renderVetting({
      DISPATCHED: [
        candidate({ id: 'oc-d', name: 'Dispatched Worker', candidateId: 'wf-d',
          onboardingPreDispatch: { read: 'SUCCEEDED', status: preDispatchStatus('READY') } }),
      ],
    });

    expect(screen.getByText('Dispatched Worker')).toBeTruthy();
    expect(clearanceElements()).toHaveLength(0);
  });
});
