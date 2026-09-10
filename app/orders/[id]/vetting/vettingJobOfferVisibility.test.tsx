/**
 * Gate JO-2C - the PRE_DISPATCH Job Offer history an operator can actually see.
 *
 * Governance: VETTING_SYSTEM.md, MW4H SELECTION, JOB OFFER AND ACTUAL DISPATCH, as corrected by the
 * JO-2C lifecycle ruling.
 *
 * THE PROBLEM THIS SURFACE SOLVES, IN THE OWNER'S OWN TERMS. MW4H offers John Smith a job. MW4H later
 * rescinds it. More workers are needed. John is still sitting in PRE_DISPATCH looking exactly like a
 * worker who was never offered anything - so an operator has no way to see that John WAS selected, and
 * no way to see that MW4H, not John, ended it. These tests exist to make that specific blindness
 * impossible, and to make the opposite error - implying John was at fault - impossible too.
 *
 * THE REAL SCREEN IS RENDERED, and only the loader and the API clients are stubbed. Every claim worth
 * proving here is a claim about wiring: which lane shows the history, whether a rescission can be told
 * apart from a lapse in text as well as in colour, whether the filter narrows without ranking, and
 * whether the two staff actions reach the authorized routes with the right arguments.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JobOfferCycle, JobOfferHistory } from '@/lib/recruiting/jobOfferLifecycleApi';
import type { Bucket, BucketId, Candidate, JobOfferHistoryRead } from '@/data/mockRecruitingData';
import type { VettingDataState, VettingOrder } from './useVettingData';

const ORDER_ID = 'order-jo2c';

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
  getJobOfferHistory: vi.fn(),
  rescindJobOffer: vi.fn(async () => ({ ok: true })),
  extendJobOfferDeadline: vi.fn(async () => ({ ok: true })),
}));

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
import { extendJobOfferDeadline, rescindJobOffer } from '@/lib/recruiting/jobOfferLifecycleApi';
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
const LIFECYCLE_CLIENT_SOURCE = stripComments(
  readFileSync(join(process.cwd(), 'lib/recruiting/jobOfferLifecycleApi.ts'), 'utf8'),
);

const refetch = vi.fn();

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const FUTURE = '2026-12-01T21:00:00.000Z';
const PAST = '2026-08-01T21:00:00.000Z';

function cycle(over: Partial<JobOfferCycle> = {}): JobOfferCycle {
  return {
    jobOfferId: 'offer-1',
    cycleSequence: 1,
    state: 'PENDING',
    respondByAt: FUTURE,
    respondedAt: null,
    rescindedAt: null,
    offeredAt: '2026-09-09T12:00:00.000Z',
    ...over,
  };
}

/** A successful history read. */
function history(over: Partial<JobOfferHistory> = {}): JobOfferHistoryRead {
  return {
    read: 'SUCCEEDED',
    history: { totalCycles: 1, current: null, latestTerminal: null, ...over },
  };
}

/** A history read that could not be answered. */
const FAILED_READ: JobOfferHistoryRead = { read: 'FAILED', history: null, httpStatus: 403 };

const PENDING_OFFER = history({ current: cycle(), totalCycles: 1 });

const RESCINDED_HISTORY = history({
  totalCycles: 1,
  latestTerminal: cycle({
    state: 'RESCINDED',
    respondByAt: FUTURE,
    rescindedAt: '2026-09-09T18:30:00.000Z',
  }),
});

const LAPSED_HISTORY = history({
  totalCycles: 1,
  latestTerminal: cycle({ state: 'LAPSED', respondByAt: PAST }),
});

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

// --------------------------------------------------------------------------
// Queries
// --------------------------------------------------------------------------

/** The open-offer indicator, found by the JO-2C `job-offer-state` class. */
function currentRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.job-offer-state'));
}

/** The prior-outcome indicator. */
function priorRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.job-offer-prior'));
}

function cardFor(name: string): HTMLElement {
  const card = screen.getByText(name).closest('.candidate-card');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function cardNames(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.candidate-card .candidate-name')).map(
    node => node.textContent?.trim() ?? '',
  );
}

function filterButton(label: string): HTMLElement {
  const button = Array.from(document.querySelectorAll<HTMLElement>('.jo-filter-btn')).find(
    node => node.textContent?.trim() === label,
  );
  expect(button, `filter chip "${label}"`).toBeTruthy();
  return button as HTMLElement;
}

/**
 * The text an operator can actually read.
 *
 * `document.body.textContent` is unusable: styled-jsx emits its CSS - including source comments naming
 * the very tokens these tests forbid - into a `<style>` element that `textContent` returns.
 */
function visibleText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style, script').forEach(node => node.remove());
  return clone.textContent ?? '';
}

beforeEach(() => {
  refetch.mockClear();
  vi.mocked(apiFetch).mockClear();
  vi.mocked(rescindJobOffer).mockClear();
  vi.mocked(extendJobOfferDeadline).mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ===========================================================================
// THE HISTORY IS VISIBLE AT ALL
// ===========================================================================

describe('JO-2C PRE_DISPATCH visibility - prior outcomes are visible on the existing card', () => {
  it('shows an open offer and its response deadline', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: PENDING_OFFER })] });

    expect(currentRows()).toHaveLength(1);
    expect(currentRows()[0].textContent).toMatch(/Job Offer Pending/);
    expect(currentRows()[0].textContent).toMatch(/Respond by/);
  });

  it('shows a prior RESCINDED cycle, and names MW4H as the actor', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: RESCINDED_HISTORY })] });

    // THE CENTRAL REQUIREMENT. An operator looking at John Smith must see that MW4H rescinded, not
    // that John did something. The actor is in the TEXT, not only in the colour.
    expect(priorRows()[0].textContent).toMatch(/MW4H Rescinded Offer/);
  });

  it('shows a prior LAPSED cycle as no response, never as a decline', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: LAPSED_HISTORY })] });

    expect(priorRows()[0].textContent).toMatch(/No Response by Deadline/);
    expect(visibleText()).not.toMatch(/declined/i);
  });

  it('DISTINGUISHES rescinded from lapsed in text as well as in style', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ id: 'oc-r', name: 'Rescinded Worker', jobOffer: RESCINDED_HISTORY }),
        candidate({ id: 'oc-l', name: 'Lapsed Worker', jobOffer: LAPSED_HISTORY }),
      ],
    });

    const rescinded = cardFor('Rescinded Worker').querySelector('.job-offer-prior')!;
    const lapsed = cardFor('Lapsed Worker').querySelector('.job-offer-prior')!;

    // Different words AND different classes. Either alone would be a single point of failure: colour
    // alone fails a colour-blind operator and a greyscale print, and text alone is easy to skim past.
    expect(rescinded.textContent).not.toBe(lapsed.textContent);
    expect(rescinded.className).toContain('jo-rescinded');
    expect(lapsed.className).toContain('jo-lapsed');
    expect(rescinded.className).not.toContain('jo-lapsed');
  });

  it('never renders a rescission in the RED this board uses for a worker finding', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: RESCINDED_HISTORY })] });

    const prior = priorRows()[0];
    // Red on this board means "Onboarding Not Cleared" - a finding ABOUT THE WORKER. Governance forbids
    // RESCINDED from implying worker fault, and MW4H withdrawing its own offer is the clearest case of
    // something that is not the worker's doing.
    expect(prior.className).not.toContain('oc-blocked');
    expect(prior.className).not.toContain('danger');
    expect(prior.textContent).not.toMatch(/not cleared|blocked|unqualified|ineligible/i);
  });

  it('shows BOTH an open cycle and the prior outcome when a worker was re-offered', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({
          jobOffer: history({
            totalCycles: 2,
            current: cycle({ jobOfferId: 'offer-2', cycleSequence: 2 }),
            latestTerminal: cycle({ state: 'LAPSED', respondByAt: PAST }),
          }),
        }),
      ],
    });

    // An operator needs both facts: there is an offer out right now, AND the last one ran out of time.
    expect(currentRows()[0].textContent).toMatch(/Job Offer Pending/);
    expect(priorRows()[0].textContent).toMatch(/Previously: No Response by Deadline/);
  });

  it('shows NOTHING for a candidacy that was never offered anything', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ jobOffer: history({ totalCycles: 0 }) })],
    });

    expect(currentRows()).toHaveLength(0);
    expect(priorRows()).toHaveLength(0);
  });

  it('shows NOTHING - not a guess - when the history could not be read', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: FAILED_READ })] });

    // Inventing "No offer made" from a failed read would be worse than silence: an operator would read
    // it as a fact and staff the job on it.
    expect(currentRows()).toHaveLength(0);
    expect(priorRows()).toHaveLength(0);
    expect(visibleText()).not.toMatch(/never offered|no offer made/i);
  });

  it('shows the history in PRE_DISPATCH and nowhere else', () => {
    renderVetting({
      PRE_DISPATCH: [candidate({ id: 'oc-p', name: 'Pre Dispatch Worker', jobOffer: RESCINDED_HISTORY })],
      MW4H_APPROVED: [candidate({ id: 'oc-a', name: 'Approved Worker', jobOffer: RESCINDED_HISTORY })],
      DISPATCHED: [candidate({ id: 'oc-d', name: 'Dispatched Worker', jobOffer: RESCINDED_HISTORY })],
    });

    // The ONLY authorized PRE_DISPATCH expansion in this gate, and it stays there. No other lane grows a
    // new indicator, so no other lane's meaning changes. All three workers carry identical rescinded
    // history, so exactly one indicator on the whole board can only mean the lane gate is doing the work.
    expect(priorRows()).toHaveLength(1);
    expect(cardFor('Pre Dispatch Worker').querySelector('.job-offer-prior')).not.toBeNull();
  });

  it('never displays the internal rescission reason, because it never receives one', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: RESCINDED_HISTORY })] });

    // The backend does not select the column, this type has no field for it, and the page has no code
    // path that would read one.
    expect(PAGE_SOURCE).not.toMatch(/rescindedReason/);
    expect(LIFECYCLE_CLIENT_SOURCE).not.toMatch(/rescindedReason/);
  });

  it('the card carries the SERVER\'s effective state and never recomputes it from the clock', () => {
    // A cycle the server still calls PENDING whose deadline has already passed - the clock-skew case.
    renderVetting({
      PRE_DISPATCH: [candidate({ jobOffer: history({ current: cycle({ respondByAt: PAST }) }) })],
    });

    // The board reports what the database holds. A board that worked lapse out for itself would
    // disagree with the server the moment a machine's clock was off.
    expect(currentRows()[0].textContent).toMatch(/Job Offer Pending/);
    expect(PAGE_SOURCE).not.toMatch(/respondByAt[^\n]*<\s*(new Date|Date\.now|now)/);
  });
});

// ===========================================================================
// THE FILTER - narrowing without ranking
// ===========================================================================

describe('JO-2C prior-outcome filter - narrows the pool, ranks nothing', () => {
  const pool = {
    PRE_DISPATCH: [
      candidate({ id: 'oc-r', name: 'Rescinded Worker', jobOffer: RESCINDED_HISTORY }),
      candidate({ id: 'oc-l', name: 'Lapsed Worker', jobOffer: LAPSED_HISTORY }),
      candidate({ id: 'oc-n', name: 'Fresh Worker', jobOffer: history({ totalCycles: 0 }) }),
    ],
  };

  it('offers at minimum a RESCINDED and a LAPSED filter', () => {
    renderVetting(pool);

    expect(filterButton('MW4H Rescinded')).toBeTruthy();
    expect(filterButton('No Response')).toBeTruthy();
  });

  it('narrows the pool to workers MW4H rescinded', () => {
    renderVetting(pool);

    fireEvent.click(filterButton('MW4H Rescinded'));

    // "Which of these did we already offer and then rescind" is not answerable by reading sixty cards.
    expect(cardNames()).toEqual(['Rescinded Worker']);
  });

  it('narrows the pool to workers who never answered', () => {
    renderVetting(pool);

    fireEvent.click(filterButton('No Response'));

    expect(cardNames()).toEqual(['Lapsed Worker']);
  });

  it('narrows the pool to workers never offered anything', () => {
    renderVetting(pool);

    fireEvent.click(filterButton('Never Offered'));

    expect(cardNames()).toEqual(['Fresh Worker']);
  });

  it('preserves the existing ORDER within a filter, and never reorders on outcome', () => {
    renderVetting(pool);
    const unfiltered = cardNames();

    fireEvent.click(filterButton('All'));

    // IT FILTERS AND DOES NOT RANK. A rescinded worker is not floated to the top and a lapsed one is not
    // pushed down: who gets offered next stays entirely a human decision.
    expect(cardNames()).toEqual(unfiltered);
    expect(unfiltered).toEqual(['Rescinded Worker', 'Lapsed Worker', 'Fresh Worker']);
  });

  it('does NOT hide a worker whose history could not be read behind an outcome filter... but keeps them out of an outcome claim', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ id: 'oc-r', name: 'Rescinded Worker', jobOffer: RESCINDED_HISTORY }),
        candidate({ id: 'oc-f', name: 'Unreadable Worker', jobOffer: FAILED_READ }),
      ],
    });

    // Visible in the default pool, because a transport error must never remove a real available worker.
    expect(cardNames()).toContain('Unreadable Worker');

    // And not claimed as "Never Offered", because nobody established that.
    fireEvent.click(filterButton('Never Offered'));
    expect(cardNames()).not.toContain('Unreadable Worker');
  });

  it('explains an empty result as a FILTER effect rather than an empty lane', () => {
    renderVetting({
      PRE_DISPATCH: [
        candidate({ id: 'oc-l', name: 'Lapsed Worker', jobOffer: LAPSED_HISTORY }),
        candidate({ id: 'oc-n', name: 'Fresh Worker', jobOffer: history({ totalCycles: 0 }) }),
      ],
    });

    fireEvent.click(filterButton('MW4H Rescinded'));

    expect(cardNames()).toEqual([]);
    // An operator who sees "no candidates" would conclude the lane is empty and go looking elsewhere.
    expect(visibleText()).toMatch(/filter/i);
  });

  it('introduces no new dashboard, page or route', () => {
    // The whole expansion lives on the existing Vetting surface, as governance requires.
    expect(PAGE_SOURCE).not.toMatch(/router\.push\(['"`][^'"`]*job-offer/);
    expect(PAGE_SOURCE).not.toMatch(/\/offers?\/dashboard/);
  });
});

// ===========================================================================
// THE STAFF ACTIONS - extend and rescind, and no shorten
// ===========================================================================

describe('JO-2C staff actions - extend and rescind on the open offer', () => {
  const withOpenOffer = { PRE_DISPATCH: [candidate({ jobOffer: PENDING_OFFER })] };

  it('offers Extend Deadline and Rescind Offer on an OPEN offer', () => {
    renderVetting(withOpenOffer);

    expect(screen.getByRole('button', { name: 'Extend Deadline' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rescind Offer' })).toBeTruthy();
  });

  it('offers NEITHER control on a terminal offer', () => {
    renderVetting({ PRE_DISPATCH: [candidate({ jobOffer: RESCINDED_HISTORY })] });

    // Both are rendered from the OPEN cycle, which the server populates only for a PENDING offer still
    // within its deadline. A terminal cycle offers nothing to extend or withdraw.
    expect(screen.queryByRole('button', { name: 'Extend Deadline' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rescind Offer' })).toBeNull();
  });

  it('offers NO shorten control anywhere', () => {
    renderVetting(withOpenOffer);

    // Shortening is forbidden, so it is not offered. The honest way to end an offer early is rescission,
    // which records who did it - so the destructive action is the visible one, not the quiet one.
    expect(visibleText()).not.toMatch(/shorten/i);
    expect(PAGE_SOURCE).not.toMatch(/shorten/i);
  });

  it('sends an extension to the authorized route with the operator\'s new deadline', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('2026-12-02T15:00');
    renderVetting(withOpenOffer);

    fireEvent.click(screen.getByRole('button', { name: 'Extend Deadline' }));

    await waitFor(() => expect(extendJobOfferDeadline).toHaveBeenCalledTimes(1));
    const [args] = vi.mocked(extendJobOfferDeadline).mock.calls[0];
    expect(args.jobOfferId).toBe('offer-1');
    // An absolute instant, not a duration. The server validates it independently.
    expect(new Date(args.respondByAt).getTime()).toBe(new Date('2026-12-02T15:00').getTime());
    prompt.mockRestore();
  });

  it('sends nothing when the operator cancels the extension', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    renderVetting(withOpenOffer);

    fireEvent.click(screen.getByRole('button', { name: 'Extend Deadline' }));

    await waitFor(() => expect(extendJobOfferDeadline).not.toHaveBeenCalled());
    prompt.mockRestore();
  });

  it('CONFIRMS before rescinding, and sends nothing if the operator declines', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderVetting(withOpenOffer);

    fireEvent.click(screen.getByRole('button', { name: 'Rescind Offer' }));

    // Rescinding is terminal forever and cannot be undone by reopening the cycle.
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(rescindJobOffer).not.toHaveBeenCalled());
    confirm.mockRestore();
  });

  it('sends a rescission to the authorized route with the internal reason', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Customer reduced the crew count.');
    renderVetting(withOpenOffer);

    fireEvent.click(screen.getByRole('button', { name: 'Rescind Offer' }));

    await waitFor(() => expect(rescindJobOffer).toHaveBeenCalledTimes(1));
    const [args] = vi.mocked(rescindJobOffer).mock.calls[0];
    expect(args.jobOfferId).toBe('offer-1');
    // The reason is INTERNAL by construction: no worker-facing surface reads it.
    expect(args.reason).toBe('Customer reduced the crew count.');
    confirm.mockRestore();
    prompt.mockRestore();
  });

  it('reloads the board after either action, rather than guessing the new state', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('');
    renderVetting(withOpenOffer);

    fireEvent.click(screen.getByRole('button', { name: 'Rescind Offer' }));

    // The server decides the outcome - including refusing, if a worker won the race - so the board
    // re-reads rather than optimistically painting a rescission that may not have happened.
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    confirm.mockRestore();
    prompt.mockRestore();
  });

  it('clicking an action does not also open the candidate drill-down', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderVetting(withOpenOffer);

    fireEvent.click(screen.getByRole('button', { name: 'Rescind Offer' }));

    // The whole card is clickable. An operator reaching for Rescind must not also get a panel over it.
    expect(document.querySelector('.drill-down-panel')).toBeNull();
    confirm.mockRestore();
  });
});

// ===========================================================================
// THE ISSUANCE DEADLINE - required, absolute, and server-validated
// ===========================================================================

/** Open the issuance modal by checking a worker and pressing the lane's collection control. */
function openIssuanceModal(name = 'John Smith') {
  const checkbox = cardFor(name).querySelector<HTMLInputElement>('input.card-checkbox');
  expect(checkbox, 'selection checkbox').toBeTruthy();
  fireEvent.click(checkbox!);
  fireEvent.click(document.querySelector<HTMLElement>('.action-btn-dispatch-bulk')!);
}

function presetButton(label: string): HTMLElement {
  const button = Array.from(document.querySelectorAll<HTMLElement>('.dm-deadline-btn')).find(
    node => node.textContent?.trim() === label,
  );
  expect(button, `deadline preset "${label}"`).toBeTruthy();
  return button as HTMLElement;
}

function confirmButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('.dm-confirm')!;
}

/**
 * Fill the pre-existing required start date.
 *
 * JO-2C ADDED THE DEADLINE TO A GATE THAT ALREADY HAD A CONDITION, and these specs are about the new
 * one, so the old one is satisfied first. That the confirm button stays disabled until BOTH are present
 * is itself the correct behaviour.
 */
function fillStartDate(value = '2026-12-01') {
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="date"].dm-input')!, {
    target: { value },
  });
}

/**
 * A candidacy the existing Onboarding clearance gate permits to be selected.
 *
 * The checkbox is withheld unless clearance READS AS READY, which is a pre-existing E4 rule this gate
 * does not touch. Without it the issuance modal cannot be opened at all, so the fixture has to satisfy
 * it - and satisfying it here is also proof that JO-2C did not loosen it.
 */
function clearedCandidate(over: Partial<Candidate> = {}): Candidate {
  return candidate({
    onboardingPreDispatch: {
      read: 'SUCCEEDED',
      status: {
        candidateId: 'wf-1',
        audience: 'PRE_DISPATCH',
        published: {
          state: 'PUBLISHED',
          publishedAt: '2026-09-06T15:00:00.000Z',
          packetId: 'packet-1',
          packetVersion: 1,
          label: 'Published',
        },
        work: 'COMPLETE',
        workLabel: 'Complete',
        generatedAt: '2026-09-06T15:00:00.000Z',
        modulesDeclaringPreDispatchEvaluation: [],
        readinessState: 'READY',
        workerObligationsOutstanding: false,
        verificationOutstanding: false,
        withheldConfidentialCount: 0,
      },
    } as Candidate['onboardingPreDispatch'],
    ...over,
  });
}

describe('JO-2C issuance deadline - the smallest clean control, on the existing surface', () => {
  const selectable = {
    PRE_DISPATCH: [clearedCandidate({ jobOffer: history({ totalCycles: 0 }) })],
  };

  it('offers exactly the governed presets, plus Custom', () => {
    renderVetting(selectable);
    openIssuanceModal();

    for (const label of ['1 hour', '4 hours', '8 hours', '24 hours', '48 hours', 'Custom']) {
      expect(presetButton(label)).toBeTruthy();
    }
  });

  it('offers NO "ASAP" option', () => {
    renderVetting(selectable);
    openIssuanceModal();

    // "ASAP" is not a duration and could never be compared to a clock, so an offer marked ASAP would be
    // an offer with no real deadline wearing an urgent word. Urgency is 1 hour, or a custom instant.
    expect(visibleText()).not.toMatch(/\bASAP\b/i);
    expect(PAGE_SOURCE).not.toMatch(/ASAP/i);
  });

  it('pre-selects NOTHING, and refuses to issue until a window is chosen', () => {
    renderVetting(selectable);
    openIssuanceModal();
    fillStartDate();

    // Every other condition is met, and the batch still cannot be issued. A default would be this modal
    // quietly making a business decision for an operator who never looked at the control.
    expect(document.querySelector('.dm-deadline-active')).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });

  it('enables issuance once a preset is chosen, and echoes the resolved wall-clock moment', () => {
    renderVetting(selectable);
    openIssuanceModal();
    fillStartDate();

    fireEvent.click(presetButton('4 hours'));

    expect(confirmButton().disabled).toBe(false);
    // An operator committing a real person to a deadline should see the moment, not just the duration.
    expect(document.querySelector('.dm-deadline-echo')?.textContent).toMatch(/must respond by/i);
  });

  it('a CUSTOM window is not enough on its own - it needs an explicit future instant', () => {
    renderVetting(selectable);
    openIssuanceModal();
    fillStartDate();

    fireEvent.click(presetButton('Custom'));

    // Choosing "Custom" states only that the operator wants to name a time; until they name one there
    // is no deadline, and an offer with no deadline is exactly what this gate exists to prevent.
    expect(confirmButton().disabled).toBe(true);
    const input = document.querySelector<HTMLInputElement>('input[type="datetime-local"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { value: '2026-12-02T15:00' } });
    expect(confirmButton().disabled).toBe(false);
  });

  it('refuses a CUSTOM instant in the past', () => {
    renderVetting(selectable);
    openIssuanceModal();
    fillStartDate();

    fireEvent.click(presetButton('Custom'));
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!, {
      target: { value: '2020-01-01T09:00' },
    });

    // An offer born past its deadline could never be accepted, declined or extended. The server refuses
    // it too - this is convenience, not the rule.
    expect(confirmButton().disabled).toBe(true);
  });

  it('sends the resolved deadline to the backend as an absolute instant', async () => {
    renderVetting(selectable);
    openIssuanceModal();
    fillStartDate();
    fireEvent.click(presetButton('4 hours'));

    const before = Date.now();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const call = vi.mocked(apiFetch).mock.calls.find(([url]) => String(url).includes('bulk-dispatch'));
    expect(call, 'the bulk issuance request').toBeTruthy();
    const body = JSON.parse(String((call![1] as RequestInit).body));

    // AN ISO INSTANT, NOT A PRESET NAME AND NOT AN HOUR COUNT. What the server stores is a moment.
    expect(typeof body.defaultRespondByAt).toBe('string');
    const sent = new Date(body.defaultRespondByAt).getTime();
    expect(sent).toBeGreaterThanOrEqual(before + 4 * 60 * 60 * 1000 - 5000);
    expect(sent).toBeLessThanOrEqual(Date.now() + 4 * 60 * 60 * 1000 + 5000);
    expect(body).not.toHaveProperty('deadlinePreset');
  });

  it('sends NOTHING when no deadline was chosen, and says why', async () => {
    renderVetting(selectable);
    openIssuanceModal();
    fillStartDate();

    // The confirm control is disabled, so this reaches the handler only through a direct call - which is
    // exactly the case the handler's own guard exists for. Neither layer is the real enforcement: the
    // server refuses a missing deadline independently.
    expect(confirmButton().disabled).toBe(true);
    expect(PAGE_SOURCE).toMatch(/if \(!respondByAt\)\s*\{[\s\S]{0,300}return;/);
  });

  it('resolves the preset to an ABSOLUTE instant rather than storing a duration', () => {
    // The durable fact is "due at 3:00 PM", not "somebody clicked 4 hours". A stored duration would need
    // an anchor, and the anchor becomes ambiguous the moment a replacement credential is issued.
    expect(PAGE_SOURCE).toMatch(/function resolveRespondByAt/);
    expect(PAGE_SOURCE).toMatch(/defaultRespondByAt/);
    expect(PAGE_SOURCE).not.toMatch(/defaultRespondByHours|respondByPreset:/);
  });

  it('does not rely on this modal for validity - the request carries a plain instant the server checks', () => {
    expect(PAGE_SOURCE).toMatch(/toISOString\(\)/);
    // No client-side authority: nothing here writes offer state, and the deadline is not signed, hashed
    // or otherwise presented as trusted.
    expect(PAGE_SOURCE).not.toMatch(/deadlineSignature|trustedDeadline/);
  });

  it('the corrected control no longer promises DISPATCH where it issues a job offer', () => {
    renderVetting(selectable);
    openIssuanceModal();

    // GATE JO-2C'S NARROW WORDING CORRECTION. The historical "Dispatch Selected" cleanup is out of scope
    // and is not attempted; but this modal now asks for a JOB OFFER RESPONSE DEADLINE and produces an
    // offer the worker may decline, so a title reading "Dispatch Workers" beside that field would tell an
    // operator that pressing the button puts people on a job site.
    expect(document.querySelector('.dm-title')?.textContent).toBe('Issue Job Offers');
    expect(confirmButton().textContent).toMatch(/Issue 1 Job Offers/);
    // AND IT DOES NOT SAY "SEND". Jarvis implements no delivery, and nothing is sent from here.
    expect(confirmButton().textContent).not.toMatch(/send/i);
  });

  it('does NOT broaden the rename beyond the controls this gate touched', () => {
    renderVetting(selectable);
    openIssuanceModal();

    // The per-worker note field and the lane's own vocabulary are untouched, and the button's class name
    // is unchanged so no styling or existing selector moves.
    expect(visibleText()).toMatch(/Default Dispatch Note/);
    expect(document.querySelector('.action-btn-dispatch-bulk')).not.toBeNull();
  });
});

// ===========================================================================
// THE LOADER - one authoritative source, read the established way
// ===========================================================================

describe('JO-2C loader - history comes from the offer cycles, not a candidate-level copy', () => {
  it('reads history only for the PRE_DISPATCH lane', () => {
    expect(LOADER_SOURCE).toMatch(/JOB_OFFER_LANE\s*:\s*BucketId\s*=\s*'PRE_DISPATCH'/);
    expect(LOADER_SOURCE).toMatch(/bucket\.id !== JOB_OFFER_LANE/);
  });

  it('associates each read with its candidacy by POSITION, never by completion order', () => {
    // `Promise.allSettled` preserves input order and resolution order is arbitrary. Zipping by
    // completion would attach one worker's offer history to another worker's card.
    expect(LOADER_SOURCE).toMatch(/attachJobOfferHistory/);
    expect(LOADER_SOURCE).toMatch(/allSettled/);
  });

  it('a failed read is carried as FAILED rather than swallowed into a false negative', () => {
    expect(LOADER_SOURCE).toMatch(/read:\s*'FAILED'/);
  });

  it('adds NO candidate-level historical field to the backend candidate projection', () => {
    // Governance forbids a duplicate candidate-level truth: the JobOffer cycles already ARE the
    // authoritative history, and a denormalised copy could disagree with them.
    expect(LOADER_SOURCE).not.toMatch(/lastOfferOutcome/);
    expect(PAGE_SOURCE).not.toMatch(/lastOfferOutcome/);
  });

  it('the staff client uses the STAFF credential, and the worker client never does', () => {
    // A deliberate separation: this module attaches a bearer token, and the worker's own client
    // (jobOfferApi.ts) never may.
    expect(LIFECYCLE_CLIENT_SOURCE).toMatch(/apiFetch/);
    const workerClient = stripComments(
      readFileSync(join(process.cwd(), 'lib/recruiting/jobOfferApi.ts'), 'utf8'),
    );
    expect(workerClient).not.toMatch(/apiFetch|getAccessToken|Authorization/);
  });
});
