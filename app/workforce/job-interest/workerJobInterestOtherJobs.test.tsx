/**
 * Phase 17 S4 - the worker's OTHER open job interests, on the PRE_DISPATCH job-interest page.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION, "Worker Experience", Rulings A
 * and B; VETTING_BUILD_CHECKLIST.md PHASE 17 slice S4.
 *
 * WHAT THIS SUITE IS FOR. The security and confidentiality boundaries are the BACKEND's, proved in
 * `pre-dispatch-worker-response.s4.spec.ts` and `.projection.spec.ts`. What is proved here is the
 * frontend's own obligations under Sections 14, 15 and 21:
 *
 *   - other interests are LISTED, never ranked, scored or marked preferred;
 *   - Keep is the DEFAULT and has no control, because Keep writes nothing;
 *   - marking Remove mutates NOTHING until the worker confirms an explicit summary;
 *   - a sibling holding a live Job Offer is READ-ONLY, with Review instead of Keep/Remove;
 *   - the primary answer and every confirmed removal go out in ONE request;
 *   - the primary-NO reassurance is shown only when it is TRUE;
 *   - the confirmation is built from what the SERVER closed, not from what the page asked for.
 *
 * THE FETCH LAYER IS STUBBED AT `window.fetch`, so the real client module runs. URL construction,
 * the request body, the absence of an Authorization header and the refusal classification are all
 * under test rather than mocked away.
 *
 * S3'S OWN OBLIGATIONS ARE NOT RE-PROVED HERE. `workerJobInterest.test.tsx` owns the primary
 * question, the failure copy and the confidentiality assertions, and continues to prove that a
 * worker with no other interests sees exactly the S3 page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const searchParams = { token: "worker-token-abc" } as Record<string, string | undefined>;

/**
 * A STABLE `push` SPY, unlike the fresh `vi.fn()` per call in the S3 suite.
 *
 * The Review handoff's whole observable effect is the navigation it performs, so the destination -
 * and in particular the fact that it carries the NEW token and not this page's - has to be
 * assertable.
 */
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => searchParams[k] ?? null }),
  useRouter: () => ({ push: routerPush, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/workforce/job-interest",
}));

import WorkforceJobInterestPage from "./page";

/** Removes comments so source assertions examine EXECUTABLE CODE only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PAGE_SOURCE = stripComments(
  fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8"),
);
const CLIENT_SOURCE = stripComments(
  fs.readFileSync(
    path.join(__dirname, "../../../lib/recruiting/preDispatchWorkerResponseApi.ts"),
    "utf8",
  ),
);

/** The page's executable source with the styled-jsx template literals removed. */
const PAGE_SOURCE_WITHOUT_CSS = PAGE_SOURCE.replace(
  /<style jsx>\{`[\s\S]*?`\}<\/style>/g,
  "",
);

/** The rendered markup with the styled-jsx `<style>` blocks removed. */
function markupWithoutStyles(): string {
  return document.body.innerHTML.replace(/<style[\s\S]*?<\/style>/g, "");
}

const OC_PLAIN = "oc-plain-cuid";
const OC_SECOND = "oc-second-cuid";
const OC_OFFERED = "oc-offered-cuid";

/** The governed copy, exactly as the backend constants serve it. */
const COPY = {
  heading: "Your other job interests",
  notice: "You'll stay under consideration for these unless you ask to be removed.",
  removeLabel: "Remove me from this job posting",
  undoRemoveLabel: "Keep me interested",
  pendingJobOfferLabel: "Pending Job Offer",
  pendingJobOfferNotice:
    "You have a job offer waiting on this one. Open it to accept or decline.",
  reviewJobOfferLabel: "Review Job Offer",
  confirmationHeading: "Please confirm before we save this",
};

/**
 * A sibling job, projected through the SAME safe allowlist as the primary job.
 *
 * Note what there is no field for: customer, company, site, street address, bill rate, margin,
 * markup or internal note. The backend does not send them, so this fixture cannot pretend it does.
 */
function safeJob(over: Record<string, unknown> = {}) {
  return {
    tradeName: "Millwright",
    specializationName: "Conveyor",
    city: "Midland",
    state: "TX",
    payRate: "38.00",
    perDiemDailyRate: null,
    perDiemDaysPerWeek: null,
    anticipatedStartDate: "2026-10-05T13:00:00.000Z",
    anticipatedEndDate: null,
    estimatedDurationWeeks: 8,
    estimatedRegHoursPerWeek: "40",
    estimatedOtHoursPerWeek: "0",
    estimatedWorkDaysPerWeek: 5,
    ...over,
  };
}

/** Category A/D: an ordinary Keep/Remove opportunity. */
function keepOrRemove(orderCandidateId: string, job: Record<string, unknown> = {}) {
  return {
    orderCandidateId,
    job: safeJob(job),
    category: "KEEP_OR_REMOVE",
    pendingJobOffer: null,
  };
}

/** Category B: read-only, because a live Job Offer is waiting on it. */
function pendingJobOffer(
  orderCandidateId: string,
  respondByAt: string | null = "2026-09-11T18:30:00.000Z",
) {
  return {
    orderCandidateId,
    job: safeJob({ tradeName: "Pipefitter", specializationName: null, city: "Odessa" }),
    category: "PENDING_JOB_OFFER",
    pendingJobOffer: { respondByAt },
  };
}

function prompt(over: Record<string, unknown> = {}) {
  return {
    workerFirstName: "Charles",
    job: safeJob({ tradeName: "Electrician", specializationName: "Industrial", city: "Odessa" }),
    question: "Are you still interested in this job?",
    yesLabel: "Confirm",
    noLabel: "Remove me from this job posting",
    linkExpiresAt: "2026-09-09T14:00:00.000Z",
    expirationNotice: "This secure link expires 24 hours after it was sent.",
    recordedAnswer: null,
    actionable: true,
    otherInterests: [],
    otherInterestsCopy: COPY,
    ...over,
  };
}

type FetchCall = { url: string; init: RequestInit | undefined };
let calls: FetchCall[] = [];

function outcome(over: Record<string, unknown> = {}) {
  return {
    interestResult: "CONTINUED_INTEREST_CONFIRMED",
    respondedAt: "2026-09-08T16:00:00.000Z",
    alreadyRecorded: false,
    siblingRemoval: { requested: 0, removedOrderCandidateIds: [], skipped: 0 },
    ...over,
  };
}

/**
 * Stub `window.fetch`, routing by URL so all THREE S4 surfaces are reachable.
 *
 * The review route is matched BEFORE `/respond`, since both are POSTs under the same path prefix and
 * confusing them would let a test pass while the page called the wrong one.
 */
function stubFetch(
  handlers: {
    view?: { status: number; body: unknown };
    respond?: { status: number; body: unknown };
    review?: { status: number; body: unknown };
  } = {},
) {
  const view = handlers.view ?? { status: 200, body: prompt() };
  const respond = handlers.respond ?? { status: 200, body: outcome() };
  const review =
    handlers.review ?? {
      status: 200,
      body: {
        token: "fresh-job-offer-token",
        expiresAt: "2026-09-11T18:30:00.000Z",
        respondByAt: "2026-09-11T18:30:00.000Z",
      },
    };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const target = String(url);
      const chosen = target.includes("/job-offer-review")
        ? review
        : target.includes("/respond")
          ? respond
          : view;
      return {
        ok: chosen.status >= 200 && chosen.status < 300,
        status: chosen.status,
        json: async () => chosen.body,
      } as unknown as Response;
    }),
  );
}

/** The parsed body of the submission, which is the only write S4 performs. */
function respondBody(): Record<string, unknown> {
  const call = calls.find((c) => c.url.includes("/respond"));
  if (!call) throw new Error("no submission was sent");
  return JSON.parse(String(call.init?.body));
}

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/**
 * The Remove / Keep controls on the OTHER-INTEREST ROWS, and never the primary red button.
 *
 * THE DISTINCTION HAS TO BE MADE BY ACCESSIBLE NAME, because the governed visible label is the same
 * on both: "Remove me from this job posting" is the primary answer AND each row's control. The rows
 * append the job to their accessible name for exactly that reason, so matching on the trailing job
 * is what separates "leave the job I was asked about" from "leave this other posting". A suite that
 * selected by position instead would silently start clicking the wrong button if the layout moved.
 */
function rowRemoveButtons(): HTMLElement[] {
  return screen.getAllByRole("button", {
    name: new RegExp(`^${COPY.removeLabel}: .`),
  });
}

function rowUndoButtons(): HTMLElement[] {
  return screen.getAllByRole("button", {
    name: new RegExp(`^${COPY.undoRemoveLabel}: .`),
  });
}

/** The primary red button, whose accessible name is the governed label and nothing more. */
function primaryRemoveButton(): HTMLElement {
  return button(COPY.removeLabel);
}

const MILLWRIGHT = "Millwright — Conveyor in Midland, TX";

beforeEach(() => {
  calls = [];
  routerPush.mockClear();
  searchParams.token = "worker-token-abc";
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("S4 - the worker sees their other open interests", () => {
  it("lists them under the governed heading, with the Keep-is-default notice", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);

    expect(await screen.findByText(COPY.heading)).toBeTruthy();
    // THE NOTICE IS THE SERVER'S SENTENCE. It states that Keep is the default, which is why no Keep
    // control is needed - and it is not written in the page, so it cannot drift from governance.
    expect(screen.getByText(COPY.notice)).toBeTruthy();
  });

  it("names each other job by trade and place, and never by its internal id", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);

    expect(await screen.findByText("Millwright — Conveyor in Midland, TX")).toBeTruthy();
    // Section 15: no internal ids. The id is a handle for the page's own selection and is never
    // rendered, logged or placed in an attribute.
    expect(markupWithoutStyles()).not.toContain(OC_PLAIN);
  });

  it("ranks nothing: no score, no preference, no ordering control (Ruling B)", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          otherInterests: [keepOrRemove(OC_PLAIN), keepOrRemove(OC_SECOND)],
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    const markup = markupWithoutStyles();
    expect(markup).not.toMatch(/1st|2nd|first choice|preferred|top pick|rank/i);
    // No control exists to reorder or prioritise, because holding several interests is not a
    // competition the worker has to resolve.
    expect(screen.queryByRole("button", { name: /move up|move down|prefer|rank/i })).toBeNull();
    expect(PAGE_SOURCE).not.toMatch(/sortBy|reorder|rankJob|setPreferred|priorityOrder/i);
  });

  it("renders them in the SERVER's order and does not re-sort them", async () => {
    // Chronological, per the backend's `orderBy: createdAt asc` - which is deliberately NOT a
    // ranking. Sorting here by pay, date or name would invent exactly the preference Ruling B
    // forbids.
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          otherInterests: [
            keepOrRemove(OC_PLAIN, { tradeName: "Millwright", specializationName: null }),
            keepOrRemove(OC_SECOND, {
              tradeName: "Boilermaker",
              specializationName: null,
              payRate: "99.00",
            }),
          ],
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    const markup = markupWithoutStyles();
    // The higher-paying job was sent second and stays second.
    expect(markup.indexOf("Millwright")).toBeLessThan(markup.indexOf("Boilermaker"));
    expect(PAGE_SOURCE).not.toMatch(/\.sort\(/);
  });

  it("offers no Keep control, because Keep writes nothing (Ruling B)", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    // ONE control on the row, and it is the way OUT. "Keep me interested" appears only after the
    // worker marks a removal, as the way to undo that mark - never as a standing action.
    expect(rowRemoveButtons()).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: new RegExp(COPY.undoRemoveLabel) }),
    ).toBeNull();
  });

  it("shows the S4 section only when the worker has other open interests", async () => {
    stubFetch({ view: { status: 200, body: prompt({ otherInterests: [] }) } });
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    expect(screen.queryByText(COPY.heading)).toBeNull();
  });

  it("survives a backend that predates S4 rather than showing a blank page", async () => {
    // The window between the two deploys. `otherInterests` is absent, not empty.
    const legacy = prompt();
    delete (legacy as Record<string, unknown>).otherInterests;
    stubFetch({ view: { status: 200, body: legacy } });
    render(<WorkforceJobInterestPage />);

    // The worker still gets the question they were texted about.
    expect(await screen.findByText("Are you still interested in this job?")).toBeTruthy();
    expect(screen.queryByText(COPY.heading)).toBeNull();
    expect(CLIENT_SOURCE).toContain("prompt.otherInterests ?? []");
  });
});

describe("S4 - marking a removal is inert until confirmed (Section 14)", () => {
  it("sends NOTHING when a removal is merely marked", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    const before = calls.length;
    rowRemoveButtons()[0].click();

    // THE WHOLE OF SECTION 14'S "do not mutate merely by toggling UI controls". A tap changes local
    // state and reaches no network at all.
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    expect(calls.length).toBe(before);
  });

  it("lets the worker take the mark back off before anything is sent", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    rowUndoButtons()[0].click();

    // Back to the default state, having written nothing in either direction.
    await waitFor(() => expect(rowRemoveButtons()).toHaveLength(1));
    expect(calls.some((c) => c.url.includes("/respond"))).toBe(false);
  });

  it("marks the row visibly, and says what will happen when the answer is saved", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();

    // FUTURE TENSE, BECAUSE IT HAS NOT HAPPENED YET. Copy in the past tense here would tell the
    // worker they had been removed while nothing had been sent.
    expect(
      await screen.findByText(
        "We'll remove you from this posting when you save your answer.",
      ),
    ).toBeTruthy();
  });

  it("requires a deliberate confirmation summary before it will submit a removal", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));

    // Answering the primary question does NOT submit while a removal is marked. Section 14: "do not
    // create accidental one-click destructive mutation".
    button("Confirm").click();

    expect(await screen.findByText(COPY.confirmationHeading)).toBeTruthy();
    expect(
      screen.getByText("You're also asking to be removed from this job posting:"),
    ).toBeTruthy();
    // Named, so the worker can check it is the posting they meant.
    expect(screen.getByText(MILLWRIGHT)).toBeTruthy();
    // And still nothing sent.
    expect(calls.some((c) => c.url.includes("/respond"))).toBe(false);
  });

  it("treats Go back as a genuine cancel, keeping the marks and sending nothing", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN), keepOrRemove(OC_SECOND)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    button("Confirm").click();
    await screen.findByText(COPY.confirmationHeading);

    button("Go back").click();

    // THE MARK SURVIVES. A worker who checks the summary and steps back should not have to redo
    // their selection - and there is nothing to undo on the server, because nothing was sent.
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    expect(calls.some((c) => c.url.includes("/respond"))).toBe(false);
  });

  it("submits the primary answer directly when nothing is marked for removal", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    button("Confirm").click();

    // NO CONFIRMATION STEP, BECAUSE THERE IS NOTHING DESTRUCTIVE TO CONFIRM. An extra tap to agree
    // that nothing else will change is friction that protects nobody, and the S3 flow is unchanged.
    await waitFor(() => expect(calls.some((c) => c.url.includes("/respond"))).toBe(true));
    expect(respondBody()).toEqual({ decision: "YES" });
  });
});

describe("S4 - one atomic submission (Section 13)", () => {
  it("sends the primary answer and every confirmed removal in ONE request", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN), keepOrRemove(OC_SECOND)] }),
      },
      respond: {
        status: 200,
        body: outcome({
          siblingRemoval: {
            requested: 2,
            removedOrderCandidateIds: [OC_PLAIN, OC_SECOND],
            skipped: 0,
          },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons().forEach((b) => b.click());
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(2));
    button("Confirm").click();
    await screen.findByText(COPY.confirmationHeading);
    button("Save my answer").click();

    await waitFor(() => expect(calls.some((c) => c.url.includes("/respond"))).toBe(true));

    // ONE POST, CARRYING BOTH. The credential is single-use, so there is no arrangement in which
    // the removals commit and the primary answer is lost.
    expect(calls.filter((c) => c.url.includes("/respond"))).toHaveLength(1);
    expect(respondBody()).toEqual({
      decision: "YES",
      removeOrderCandidateIds: [OC_PLAIN, OC_SECOND],
    });
  });

  it("represents Keep by omission and never sends a Keep instruction (Ruling B)", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN), keepOrRemove(OC_SECOND)] }),
      },
      respond: {
        status: 200,
        body: outcome({
          siblingRemoval: { requested: 1, removedOrderCandidateIds: [OC_SECOND], skipped: 0 },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    // Leave the first alone; remove only the second.
    rowRemoveButtons()[1].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    button("Confirm").click();
    await screen.findByText(COPY.confirmationHeading);
    button("Save my answer").click();

    await waitFor(() => expect(calls.some((c) => c.url.includes("/respond"))).toBe(true));

    // THE KEPT JOB IS SIMPLY ABSENT. There is no `keep`, `keptOrderCandidateIds` or `decisions` map,
    // because Keep persists nothing and a field for it would imply a record that does not exist.
    const body = respondBody();
    expect(body).toEqual({ decision: "YES", removeOrderCandidateIds: [OC_SECOND] });
    expect(JSON.stringify(body)).not.toContain(OC_PLAIN);
    expect(CLIENT_SOURCE).not.toMatch(/keepOrderCandidateIds|keptOrderCandidateIds|"KEEP"/);
  });

  it("omits the array entirely after a mark is taken back off", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    // Mark, then unmark, then answer. The worker's net intention is Keep.
    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    rowUndoButtons()[0].click();
    await waitFor(() => expect(rowRemoveButtons()).toHaveLength(1));
    button("Confirm").click();

    await waitFor(() => expect(calls.some((c) => c.url.includes("/respond"))).toBe(true));
    // THE S3 BODY, BYTE FOR BYTE - not `removeOrderCandidateIds: []`. An empty array would be a
    // request to remove nothing, which is a different thing from not asking, and it would make an
    // S4 client distinguishable from an S3 one for a worker who changed nothing.
    expect(respondBody()).toEqual({ decision: "YES" });
  });

  it("sends no Authorization header, on any of the three routes", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }) },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    button(COPY.reviewJobOfferLabel).click();
    await waitFor(() => expect(routerPush).toHaveBeenCalled());

    // A worker holding a secure link has no staff account. Borrowing the staff bearer would make
    // this a surface that could act as staff.
    for (const call of calls) {
      const headers = (call.init?.headers ?? {}) as Record<string, string>;
      expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
    }
    expect(CLIENT_SOURCE).not.toContain("jp_accessToken");
  });
});

describe("S4 - a sibling with a live Job Offer is read-only (Ruling A)", () => {
  it("labels it Pending Job Offer and gives it no Keep or Remove control", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    expect(screen.getByText(COPY.pendingJobOfferLabel)).toBeTruthy();
    expect(screen.getByText(COPY.pendingJobOfferNotice)).toBeTruthy();

    // RULING A: NOT WITHDRAWABLE THROUGH S4. The worker answers the offer on the Job Offer surface,
    // where accept and decline have always lived. The row carries no Keep/Remove control at all -
    // only the primary red button, which is about the job the worker was actually asked about.
    expect(
      screen.queryAllByRole("button", { name: new RegExp(`^${COPY.removeLabel}: .`) }),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: new RegExp(COPY.undoRemoveLabel) }),
    ).toHaveLength(0);
    expect(primaryRemoveButton()).toBeTruthy();
    expect(button(COPY.reviewJobOfferLabel)).toBeTruthy();
  });

  it("shows the offer's deadline without altering it", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    expect(screen.getByText(/Please respond by /)).toBeTruthy();
    // Viewing is a read. The page issues no request at all until the worker asks to review.
    expect(calls.filter((c) => c.url.includes("/job-offer-review"))).toHaveLength(0);
  });

  it("offers no accept or decline on this surface", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    expect(screen.queryByRole("button", { name: /accept|decline/i })).toBeNull();
    // And no code path exists to build one: PRE_DISPATCH authority never becomes Job Offer authority.
    expect(PAGE_SOURCE).not.toMatch(/submitJobOfferDecision|acceptOffer|declineOffer/);
  });

  it("exposes no job offer id, offer state or rescission detail", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    const markup = markupWithoutStyles();
    // The server sends only a deadline, so there is nothing here to leak - and no field for the page
    // to read even if it tried. Arbitrary-offer navigation is structurally impossible rather than
    // merely refused, because no offer identifier crosses the wire.
    expect(markup).not.toContain(OC_OFFERED);
    expect(markup).not.toMatch(/RESCINDED|LAPSED|jobOfferId|cycleSequence/i);
    expect(CLIENT_SOURCE).not.toMatch(/jobOfferId|rescindedReason|cycleSequence/);
  });
});

describe("S4 - the Review Job Offer handoff (Section 21)", () => {
  it("names the CANDIDACY, and takes the worker to the offer with the NEW token", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    button(COPY.reviewJobOfferLabel).click();

    await waitFor(() => expect(routerPush).toHaveBeenCalled());

    const review = calls.find((c) => c.url.includes("/job-offer-review"))!;
    expect(review.url).toContain("token=worker-token-abc");
    // THE BODY NAMES A CANDIDACY, NOT AN OFFER. There is no offer-id parameter anywhere in S4, so
    // there is nothing to point at another worker's offer with.
    expect(JSON.parse(String(review.init?.body))).toEqual({ orderCandidateId: OC_OFFERED });

    // The worker arrives at the Job Offer surface carrying the FRESHLY issued credential - never
    // this page's PRE_DISPATCH token, which grants no Job Offer authority.
    expect(routerPush).toHaveBeenCalledWith(
      "/workforce/job-offer?token=fresh-job-offer-token",
    );
  });

  it("does not consume this page's link, so the worker can come back and answer", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    button(COPY.reviewJobOfferLabel).click();
    await waitFor(() => expect(routerPush).toHaveBeenCalled());

    // REVIEWING IS NOT ANSWERING. The primary respond route was never called, so the single-use
    // credential is unspent and the primary question is still open to them.
    expect(calls.some((c) => c.url.includes("/respond"))).toBe(false);
    expect(button("Confirm")).toBeTruthy();
  });

  it("keeps the page working when the offer closed while it sat open", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [pendingJobOffer(OC_OFFERED)] }),
      },
      review: {
        status: 409,
        body: { message: "The deadline to respond to this job offer has passed." },
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    button(COPY.reviewJobOfferLabel).click();

    // A CLOSED OFFER IS NOT A BROKEN LINK. Dropping into the failure state would cost the worker the
    // primary answer they came here to give, so they are told plainly and the page keeps working.
    expect(
      await screen.findByText(/That job offer is no longer open\./),
    ).toBeTruthy();
    expect(routerPush).not.toHaveBeenCalled();
    expect(button("Confirm")).toBeTruthy();
    // And nothing about WHY - a bearer must not learn whether staff rescinded it or time ran out.
    expect(markupWithoutStyles()).not.toMatch(/rescind|deadline to respond|lapsed/i);
  });
});

describe("S4 - the recorded outcome is truthful (Section 15)", () => {
  it("preserves the S3 reassurance when the worker removed ONLY this job", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
      respond: {
        status: 200,
        body: outcome({
          interestResult: "WITHDRAWAL_REQUESTED",
          siblingRemoval: { requested: 0, removedOrderCandidateIds: [], skipped: 0 },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    primaryRemoveButton().click();

    expect(
      await screen.findByText("You've been removed from this job posting"),
    ).toBeTruthy();
    // THE GOVERNED SENTENCE, VERBATIM AND UNCHANGED. It is true here: this submission touched
    // nothing else.
    expect(
      screen.getByText(
        "We've recorded that you're no longer interested in this job posting. This does not affect any other job you're being considered for.",
      ),
    ).toBeTruthy();
  });

  it("drops that sentence and lists the removals when siblings were also closed", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }),
      },
      respond: {
        status: 200,
        body: outcome({
          interestResult: "WITHDRAWAL_REQUESTED",
          siblingRemoval: {
            requested: 1,
            removedOrderCandidateIds: [OC_PLAIN],
            skipped: 0,
          },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    primaryRemoveButton().click();
    await screen.findByText(COPY.confirmationHeading);
    button("Save my answer").click();

    expect(
      await screen.findByText("You've been removed from this job posting"),
    ).toBeTruthy();

    // THE FALSE SENTENCE IS GONE, not softened. Other jobs WERE affected by this submission.
    expect(markupWithoutStyles()).not.toContain(
      "This does not affect any other job you're being considered for",
    );
    expect(screen.getByText("You also asked to be removed from:")).toBeTruthy();
    expect(screen.getByText(MILLWRIGHT)).toBeTruthy();
  });

  it("claims only what the SERVER closed, never what the page asked for", async () => {
    // The worker marked two. One went stale between the read and the write - a concurrent staff
    // closure, say - so the server skipped it and closed one.
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          otherInterests: [
            keepOrRemove(OC_PLAIN, { tradeName: "Millwright", specializationName: null }),
            keepOrRemove(OC_SECOND, { tradeName: "Boilermaker", specializationName: null }),
          ],
        }),
      },
      respond: {
        status: 200,
        body: outcome({
          siblingRemoval: {
            requested: 2,
            removedOrderCandidateIds: [OC_PLAIN],
            skipped: 1,
          },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons().forEach((b) => b.click());
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(2));
    button("Confirm").click();
    await screen.findByText(COPY.confirmationHeading);
    button("Save my answer").click();

    expect(await screen.findByText("You also asked to be removed from:")).toBeTruthy();

    // SECTION 15, EXACTLY: "do not claim a sibling removal succeeded if it was skipped". Only the
    // one the server actually closed is named. The skipped one is not listed as removed, and the
    // worker is not told a count or a reason either - it simply remains an interest of theirs.
    const markup = markupWithoutStyles();
    expect(markup).toContain("Millwright in Midland, TX");
    expect(markup).not.toContain("Boilermaker");
    expect(markup).not.toMatch(/skipped|could not be removed|1 of 2/i);
  });

  it("says nothing else was affected only when something else is still open", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN), keepOrRemove(OC_SECOND)] }),
      },
      respond: {
        status: 200,
        body: outcome({
          siblingRemoval: {
            requested: 1,
            removedOrderCandidateIds: [OC_PLAIN],
            skipped: 0,
          },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    button("Confirm").click();
    await screen.findByText(COPY.confirmationHeading);
    button("Save my answer").click();

    // One sibling was left alone, so this is true and is said.
    expect(
      await screen.findByText(
        "You're still being considered for any other jobs not listed here.",
      ),
    ).toBeTruthy();
  });

  it("reports the standing answer on an already-answered request without inventing removals", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN)] }) },
      respond: {
        status: 200,
        body: outcome({
          interestResult: "WITHDRAWAL_REQUESTED",
          alreadyRecorded: true,
          // Business idempotency: the durable answer stands and this submission changed nothing,
          // so every named removal was skipped.
          siblingRemoval: { requested: 1, removedOrderCandidateIds: [], skipped: 1 },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    rowRemoveButtons()[0].click();
    await waitFor(() => expect(rowUndoButtons()).toHaveLength(1));
    primaryRemoveButton().click();
    await screen.findByText(COPY.confirmationHeading);
    button("Save my answer").click();

    expect(await screen.findByText("This answer was already on file.")).toBeTruthy();
    // NOTHING IS CLAIMED, because nothing committed - and the reassurance is therefore true again.
    expect(screen.queryByText("You also asked to be removed from:")).toBeNull();
    expect(
      screen.getByText(
        "We've recorded that you're no longer interested in this job posting. This does not affect any other job you're being considered for.",
      ),
    ).toBeTruthy();
  });
});

describe("S4 - scope firewall", () => {
  it("adds no communication, reminder or scheduling capability", async () => {
    // Section 26. "Review Job Offer" is not authorization to build a communications system.
    for (const source of [PAGE_SOURCE, CLIENT_SOURCE]) {
      expect(source).not.toMatch(/sms|twilio|webex|sendEmail|resend|reminder|schedule/i);
    }
  });

  it("implies no obligation to choose only one job", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ otherInterests: [keepOrRemove(OC_PLAIN), pendingJobOffer(OC_OFFERED)] }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    // Ruling A: a worker may hold several interests, and several offers, concurrently. Nothing here
    // pressures them to pick one or warns them about holding more.
    expect(markupWithoutStyles()).not.toMatch(
      /only one|choose one|pick one|you must select|limit of/i,
    );
  });

  it("exposes no customer identity or commercial term on any other-interest row", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          otherInterests: [keepOrRemove(OC_PLAIN), pendingJobOffer(OC_OFFERED)],
        }),
      },
    });
    render(<WorkforceJobInterestPage />);
    await screen.findByText(COPY.heading);

    // The backend allowlist is the boundary; this proves the page adds no second, weaker one. A
    // sibling row must not disclose what the primary job is forbidden to disclose.
    const markup = markupWithoutStyles();
    for (const forbidden of [
      "customer",
      "billRate",
      "bill rate",
      "margin",
      "markup",
      "companyName",
      "siteName",
      "streetAddress",
    ]) {
      expect(markup.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    // The stylesheet is excluded, because CSS legitimately says `margin` and `margin` is also the
    // name of a commercial field. Stylesheet text is not data sent to the worker.
    expect(PAGE_SOURCE_WITHOUT_CSS).not.toMatch(
      /billRate|\bmargin\b|markup|customerName|siteAddress/,
    );
  });
});
