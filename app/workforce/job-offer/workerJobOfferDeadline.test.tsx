/**
 * Gate JO-2C - the worker's response deadline, and the two outcomes that are not the worker's fault.
 *
 * Governance: VETTING_SYSTEM.md, MW4H SELECTION, JOB OFFER AND ACTUAL DISPATCH, as corrected by the
 * JO-2C lifecycle ruling.
 *
 * WHY A SECOND SUITE RATHER THAN MORE CASES IN THE FIRST. The JO-2 suite proves the offer screen itself -
 * the announcement, the labels, the consequence disclosure, the confidentiality of the staff credential.
 * What is proved here is the TIME dimension JO-2C added: that a worker is told when they must answer in
 * two independent forms, that neither form is ever treated as the enforcement, and that LAPSED and
 * RESCINDED are shown as what they are rather than as a decline or a fault.
 *
 * THE CLOCK IS FROZEN WITH FAKE TIMERS, because a countdown asserted against real time is a test that
 * fails at midnight. `setSystemTime` fixes the instant the component reads, so "about 3 hours remaining"
 * is a deterministic consequence of the payload rather than of when the suite happened to run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const searchParams = { token: "offer-token-abc" } as Record<string, string | undefined>;

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => searchParams[k] ?? null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/workforce/job-offer",
}));

import WorkforceJobOfferPage from "./page";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PAGE_SOURCE = stripComments(fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8"));
const CLIENT_SOURCE = stripComments(
  fs.readFileSync(path.join(__dirname, "../../../lib/recruiting/jobOfferApi.ts"), "utf8"),
);

function markupWithoutStyles(): string {
  return document.body.innerHTML.replace(/<style[\s\S]*?<\/style>/g, "");
}

/**
 * A fixed "now", in a zone-independent way.
 *
 * The absolute-deadline formatter deliberately renders in the DEVICE's zone, so these specs assert on
 * offsets FROM this instant rather than on a hard-coded "3:00 PM" that would only be correct in one
 * time zone. The one thing a literal string could pin - today versus tomorrow - is asserted through the
 * same local-day arithmetic the component uses.
 */
const NOW = new Date("2026-09-10T18:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const SAFE_JOB = {
  tradeName: "Millwright",
  specializationName: "Precision Alignment",
  city: "Deer Park",
  state: "TX",
  payRate: "42.00",
  perDiemDailyRate: "95.00",
  perDiemDaysPerWeek: "5",
  anticipatedStartDate: "2026-10-05T13:00:00.000Z",
  anticipatedEndDate: "2026-12-18T00:00:00.000Z",
  estimatedDurationWeeks: 11,
  estimatedRegHoursPerWeek: "40",
  estimatedOtHoursPerWeek: "10",
  estimatedWorkDaysPerWeek: 5,
};

function prompt(over: Record<string, unknown> = {}) {
  return {
    companyIdentity: "Millwrights4Hire - MW4H",
    workerFirstName: "Charles",
    job: SAFE_JOB,
    prompt: "Review the job information below and let us know whether you accept this job offer.",
    acceptLabel: "Accept Job Offer",
    declineLabel: "Decline Job Offer",
    paperworkNotice: "Dispatch paperwork and reporting instructions will follow after you accept.",
    consequenceNotice: null,
    competingPostings: [],
    decisionState: "PENDING",
    respondedAt: null,
    respondByAt: at(3 * HOUR),
    linkExpiresAt: at(3 * HOUR),
    actionable: true,
    ...over,
  };
}

type FetchCall = { url: string; init: RequestInit | undefined };
let calls: FetchCall[] = [];

function stubFetch(
  handlers: {
    view?: { status: number; body: unknown };
    decision?: { status: number; body: unknown };
  } = {},
) {
  const view = handlers.view ?? { status: 200, body: prompt() };
  const decision =
    handlers.decision ?? {
      status: 200,
      body: {
        decisionState: "ACCEPTED",
        respondedAt: at(0),
        alreadyRecorded: false,
        competingClosedCount: 0,
        assignmentId: "asg-1",
      },
    };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const chosen = String(url).includes("/decision") ? decision : view;
      return {
        ok: chosen.status >= 200 && chosen.status < 300,
        status: chosen.status,
        json: async () => chosen.body,
      } as unknown as Response;
    }),
  );
}

beforeEach(() => {
  calls = [];
  searchParams.token = "offer-token-abc";
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ===========================================================================
// THE DEADLINE, IN BOTH FORMS
// ===========================================================================

describe("JO-2C worker deadline - both an absolute time and a relative one", () => {
  it("shows an ABSOLUTE deadline the worker can act on", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    // "Please respond by <time> today." - the wall-clock instruction, in the worker's own locale.
    const due = new Date(at(3 * HOUR));
    const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    expect(screen.getByText(new RegExp(`Please respond by ${time.replace(/\s/g, "\\s")} today`, "i"))).toBeTruthy();
  });

  it("ALSO shows the relative time remaining", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    // BOTH FORMS, NOT ONE. The absolute value is the thing to act on; this one carries the urgency, and
    // survives being screenshotted or read hours later only because the absolute value is beside it.
    expect(screen.getByText("About 3 hours remaining.")).toBeTruthy();
  });

  it("names TOMORROW rather than leaving the day ambiguous", async () => {
    // A deadline 20 hours out crosses local midnight from an 18:00 UTC "now" in the Americas, and does
    // not in every zone - so the expectation is computed the same way the component computes it.
    const iso = at(20 * HOUR);
    stubFetch({ view: { status: 200, body: prompt({ respondByAt: iso, linkExpiresAt: iso }) } });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    const due = new Date(iso);
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const sameDay = startOfDay(due) === startOfDay(NOW);

    // "by 3:00 PM" is genuinely ambiguous, and a worker acting on the wrong day loses the job.
    expect(markupWithoutStyles()).toMatch(sameDay ? /today\./ : /tomorrow\./);
  });

  it("uses the coarsest honest unit, rounded DOWN", async () => {
    const iso = at(57 * MINUTE + 45 * 1000);
    stubFetch({ view: { status: 200, body: prompt({ respondByAt: iso, linkExpiresAt: iso }) } });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    // 57m45s is reported as 57 minutes, never 58. Understating never encourages a worker to answer
    // later than they safely can.
    expect(screen.getByText("About 57 minutes remaining.")).toBeTruthy();
  });

  it("shows no deadline block at all for a HISTORICAL offer that has none", async () => {
    stubFetch({ view: { status: 200, body: prompt({ respondByAt: null }) } });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    // Offers predating deadline governance have none, and inventing one for display would tell the
    // worker something Jarvis does not know.
    expect(markupWithoutStyles()).not.toMatch(/Please respond by/i);
    expect(markupWithoutStyles()).not.toMatch(/remaining\./i);
    // The offer is still answerable.
    expect(screen.getByRole("button", { name: "Accept Job Offer" })).toBeTruthy();
  });

  it("the countdown NEVER runs negative and never becomes a verdict", async () => {
    // A payload the server still calls actionable, whose deadline is nonetheless in the past - the
    // clock-skew case. The page must not invent a refusal the server did not make.
    const iso = at(-5 * MINUTE);
    stubFetch({ view: { status: 200, body: prompt({ respondByAt: iso, linkExpiresAt: iso }) } });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    expect(markupWithoutStyles()).not.toMatch(/-\d+ (minute|hour)/);
    expect(markupWithoutStyles()).not.toMatch(/About -/);
    // Whether an offer is over is the SERVER's `decisionState`, never this arithmetic.
    expect(screen.getByRole("button", { name: "Accept Job Offer" })).toBeTruthy();
  });

  it("the deadline is displayed but never used as the enforcement", () => {
    // The page performs no comparison that gates the buttons on time, and no request carries a
    // client-computed deadline. The server decides lateness against the stored instant.
    expect(PAGE_SOURCE).not.toMatch(/respondByAt[^\n]*<[^=]/);
    expect(PAGE_SOURCE).not.toMatch(/disabled=\{[^}]*respondByAt/);
    expect(CLIENT_SOURCE).not.toMatch(/respondByAt:\s*[^;\n]*(new Date|Date\.now)/);
    // The client sends a decision and a token, and no time at all.
    expect(CLIENT_SOURCE).not.toMatch(/body:[\s\S]{0,200}respondByAt/);
  });
});

// ===========================================================================
// LAPSED - the deadline passed, and the worker did NOT decline
// ===========================================================================

describe("JO-2C worker LAPSED - silence is never recorded as a refusal", () => {
  it("routes a LAPSED decisionState to the deadline-passed screen", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ decisionState: "LAPSED", actionable: false, respondByAt: at(-HOUR) }),
      },
    });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /deadline to respond has passed/i })).toBeTruthy();
  });

  it("offers NO accept or decline control once it has lapsed", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ decisionState: "LAPSED", actionable: false, respondByAt: at(-HOUR) }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /deadline to respond has passed/i });

    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /decline/i })).toBeNull();
  });

  it("never says or implies the worker DECLINED", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ decisionState: "LAPSED", actionable: false, respondByAt: at(-HOUR) }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /deadline to respond has passed/i });

    const markup = markupWithoutStyles();
    // THE ENTIRE REASON LAPSED EXISTS AS A SEPARATE STATE. Jarvis implements no delivery, so it cannot
    // establish this worker was ever reached - describing silence as a refusal attributes to them a
    // choice they may never have had the chance to make.
    expect(markup).not.toMatch(/declin/i);
    expect(markup).not.toMatch(/turned (it|the job) down/i);
    expect(markup).not.toMatch(/you said no/i);
    // And it says so positively, rather than merely omitting it.
    expect(markup).toMatch(/Nothing has been recorded as your decision/i);
  });

  it("does NOT tell a lapsed worker to ask for a new link", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ decisionState: "LAPSED", actionable: false, respondByAt: at(-HOUR) }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /deadline to respond has passed/i });

    // The OFFER closed, not the credential. Sending them to a recruiter for a new link would send them
    // for something that no longer exists.
    expect(markupWithoutStyles()).not.toMatch(/new link/i);
  });

  it("classifies a LAPSED refusal on the decision POST by its CODE", async () => {
    stubFetch({
      decision: {
        status: 409,
        body: {
          ok: false,
          code: "JOB_OFFER_LAPSED",
          // Deliberately unhelpful prose, to prove the code is what classifies it.
          message: "Conflict.",
        },
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    screen.getByRole("button", { name: "Accept Job Offer" }).click();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /deadline to respond has passed/i })).toBeTruthy(),
    );
    // AND CRITICALLY NOT the "already recorded" screen, which would report a decision they never made.
    expect(markupWithoutStyles()).not.toMatch(/already recorded/i);
  });
});

// ===========================================================================
// RESCINDED - MW4H withdrew it, and the worker is told nothing internal
// ===========================================================================

describe("JO-2C worker RESCINDED - MW4H's act, with no reason disclosed", () => {
  const rescinded = {
    status: 200,
    body: prompt({ decisionState: "RESCINDED", actionable: false }),
  };

  it("shows the governed unavailable sentence", async () => {
    stubFetch({ view: rescinded });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /no longer available/i })).toBeTruthy();
    expect(screen.getByText(/This job offer is no longer available\./i)).toBeTruthy();
  });

  it("offers NO accept or decline control", async () => {
    stubFetch({ view: rescinded });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /no longer available/i });

    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /decline/i })).toBeNull();
  });

  it("never implies fault, slowness or lack of qualification", async () => {
    stubFetch({ view: rescinded });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /no longer available/i });

    const markup = markupWithoutStyles();
    expect(markup).not.toMatch(/unqualified|not qualified|did not qualify/i);
    expect(markup).not.toMatch(/too slow|too late/i);
    expect(markup).not.toMatch(/someone else|another worker|filled by/i);
    expect(markup).not.toMatch(/declin/i);
    // And it reassures them explicitly, because "no longer available" alone invites the worst reading.
    expect(markup).toMatch(/not a reflection on you/i);
  });

  it("discloses NO internal reason, even if the server were ever to send one", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          decisionState: "RESCINDED",
          actionable: false,
          // The backend never selects this column for a worker. Present here to prove that even so,
          // the page renders nothing from it.
          rescindedReason: "INTERNAL: customer cut the crew and we chose Rufus instead",
        }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /no longer available/i });

    const markup = markupWithoutStyles();
    expect(markup).not.toMatch(/customer cut the crew/i);
    expect(markup).not.toMatch(/Rufus/i);
    // The page has no code path that reads it at all.
    expect(PAGE_SOURCE).not.toMatch(/rescindedReason/);
  });

  it("classifies a RESCINDED refusal on the decision POST by its CODE", async () => {
    stubFetch({
      decision: {
        status: 409,
        body: { ok: false, code: "JOB_OFFER_RESCINDED", message: "This job offer is no longer available." },
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    // The already-open-page case: the worker had the offer on screen when MW4H withdrew it.
    screen.getByRole("button", { name: "Accept Job Offer" }).click();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /no longer available/i })).toBeTruthy(),
    );
    expect(markupWithoutStyles()).not.toMatch(/already recorded/i);
  });
});

// ===========================================================================
// FAILURE CLASSIFICATION - codes first, prose only as a fallback
// ===========================================================================

describe("JO-2C worker failure classification - stable codes, not message matching", () => {
  it("classifies every governed refusal code", async () => {
    const cases: Array<[string, RegExp]> = [
      ["JOB_OFFER_LAPSED", /deadline to respond has passed/i],
      ["JOB_OFFER_RESCINDED", /no longer available/i],
      ["JOB_OFFER_ALREADY_DECIDED", /already been used/i],
      ["JOB_OFFER_CANDIDACY_NOT_OFFERABLE", /closed/i],
    ];

    for (const [code, heading] of cases) {
      stubFetch({ view: { status: 409, body: { ok: false, code, message: "Conflict." } } });
      render(<WorkforceJobOfferPage />);
      expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
      cleanup();
    }
  });

  it("still classifies a credential refusal that carries no code", async () => {
    // The MagicLink layer refuses in prose, and predates JO-2C. Message matching survives as a
    // DEFENSIVE FALLBACK for exactly this, and only for this.
    const cases: Array<[string, RegExp]> = [
      ["This link has expired.", /link has expired/i],
      ["This link has already been used.", /already been used/i],
      ["Invalid link.", /does not work/i],
    ];

    for (const [message, heading] of cases) {
      stubFetch({ view: { status: 403, body: { message } } });
      render(<WorkforceJobOfferPage />);
      expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
      cleanup();
    }
  });

  it("prefers the CODE over the prose when the two disagree", async () => {
    stubFetch({
      view: {
        status: 409,
        body: {
          ok: false,
          code: "JOB_OFFER_RESCINDED",
          // Prose that the JO-2 message matcher would have classified as an already-used link.
          message: "This link has already been used.",
        },
      },
    });
    render(<WorkforceJobOfferPage />);

    // The code is the stable contract; the sentence is copy and may be reworded at any time.
    expect(await screen.findByRole("heading", { name: /no longer available/i })).toBeTruthy();
    expect(markupWithoutStyles()).not.toMatch(/already been used/i);
  });

  it("keeps an EXPIRED CREDENTIAL distinct from a LAPSED OFFER", async () => {
    stubFetch({ view: { status: 403, body: { message: "This link has expired." } } });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /link has expired/i });

    // TWO DIFFERENT FACTS. A dead credential may sit in front of a perfectly open offer; a lapsed offer
    // is over. Collapsing them would either tell a worker the job is gone when it is not, or send them
    // chasing a link for an offer that no longer exists.
    const markup = markupWithoutStyles();
    expect(markup).toMatch(/link/i);
    expect(markup).not.toMatch(/deadline/i);
  });

  it("names no internal identifier or reason in any refusal screen", async () => {
    stubFetch({
      view: {
        status: 409,
        body: {
          ok: false,
          code: "JOB_OFFER_LAPSED",
          message: "Conflict.",
          jobOfferId: "offer-1",
          orderCandidateId: "oc-offered",
        },
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /deadline/i });

    const markup = markupWithoutStyles();
    expect(markup).not.toMatch(/offer-1|oc-offered/);
    // The page renders its OWN governed copy per failure, never the server's raw sentence.
    expect(markup).not.toMatch(/Conflict\./);
  });
});
