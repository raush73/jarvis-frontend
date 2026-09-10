/**
 * Gate JO-2 - the worker's Job Offer decision page.
 *
 * Governance: VETTING_SYSTEM.md, MW4H SELECTION, JOB OFFER AND ACTUAL DISPATCH.
 *
 * WHAT THIS SUITE IS FOR, AND WHAT IT IS NOT FOR. The confidentiality boundary is the BACKEND
 * projection, proved in job-offer-response.read.spec.ts. What is proved here is the frontend's own
 * obligations: that it announces selection rather than asking a PRE_DISPATCH question, that both
 * governed labels come from the server, that the consequence disclosure appears BEFORE the buttons
 * and offers no controls, that every state renders honestly, that it never claims paperwork was
 * delivered, and - critically - that it does not borrow the STAFF credential or put anything
 * sensitive into props, page state, the DOM or a log.
 *
 * The fetch layer is stubbed at `window.fetch`, so the real client module runs: URL construction,
 * refusal classification and the absence of an Authorization header are all under test rather than
 * mocked away.
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

/**
 * Removes block and line comments so source assertions examine EXECUTABLE CODE only.
 *
 * Both files document what they must never do, and name the forbidden things in order to do so.
 * Scanning raw text would therefore fail on the very comments that state the rule.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PAGE_SOURCE = stripComments(fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8"));
const CLIENT_SOURCE = stripComments(
  fs.readFileSync(path.join(__dirname, "../../../lib/recruiting/jobOfferApi.ts"), "utf8"),
);

/**
 * The rendered markup with the styled-jsx `<style>` block removed.
 *
 * CSS legitimately contains the word "margin", which would otherwise trip a commercial-data
 * assertion. Stylesheet text is not data sent to the worker.
 */
function markupWithoutStyles(): string {
  return document.body.innerHTML.replace(/<style[\s\S]*?<\/style>/g, "");
}

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

/** The SAFE offer prompt, exactly as the backend allowlist projects it. */
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
    linkExpiresAt: "2026-09-10T14:00:00.000Z",
    actionable: true,
    ...over,
  };
}

const TWO_COMPETING = [
  {
    orderCandidateId: "oc-c",
    job: { ...SAFE_JOB, tradeName: "Millwright", specializationName: null, city: "Baytown" },
  },
  {
    orderCandidateId: "oc-d",
    job: { ...SAFE_JOB, tradeName: "Rigger", specializationName: null, city: "Pasadena" },
  },
];

type FetchCall = { url: string; init: RequestInit | undefined };
let calls: FetchCall[] = [];

/** Stub `window.fetch` so the real client module is exercised end to end. */
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
        respondedAt: "2026-09-09T18:00:00.000Z",
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JO-2 worker page - the offer", () => {
  it("announces selection rather than asking whether the worker is still interested", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);

    expect(
      await screen.findByRole("heading", { name: /you've been selected for this job/i }),
    ).toBeTruthy();
    // This is NOT the PRE_DISPATCH question, and must never read as one.
    expect(markupWithoutStyles()).not.toMatch(/still interested/i);
  });

  it("greets the worker by their own first name", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);

    expect(
      await screen.findByRole("heading", { name: /^Charles, you've been selected/i }),
    ).toBeTruthy();
  });

  it("falls back cleanly when no first name is available", async () => {
    stubFetch({ view: { status: 200, body: prompt({ workerFirstName: null }) } });
    render(<WorkforceJobOfferPage />);

    expect(
      await screen.findByRole("heading", { name: "You've been selected for this job." }),
    ).toBeTruthy();
  });

  it("renders the MW4H identity as governed, never 'Millwrights for Hire'", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    expect(screen.getByText("Millwrights4Hire - MW4H")).toBeTruthy();
    expect(markupWithoutStyles()).not.toMatch(/Millwrights for Hire/i);
  });

  it("offers both governed buttons", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("button", { name: "Accept Job Offer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline Job Offer" })).toBeTruthy();
  });

  it("takes the prompt and both labels from the SERVER, never from local copies", () => {
    // The governed wording has one source. A hard-coded string here would be a second one to keep
    // in agreement.
    expect(PAGE_SOURCE).not.toContain('"Accept Job Offer"');
    expect(PAGE_SOURCE).not.toContain('"Decline Job Offer"');
    expect(PAGE_SOURCE).not.toContain("whether you accept this job offer");
    expect(PAGE_SOURCE).toContain("prompt.acceptLabel");
    expect(PAGE_SOURCE).toContain("prompt.declineLabel");
    expect(PAGE_SOURCE).toContain("prompt.prompt");
  });

  it("renders the safe job facts it was given", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    expect(screen.getByText("Deer Park, TX")).toBeTruthy();
    expect(screen.getByText("$42.00 per hour")).toBeTruthy();
    expect(screen.getByText("$95.00 per day (5 days per week)")).toBeTruthy();
    expect(screen.getByText("About 11 weeks")).toBeTruthy();
    expect(screen.getByText("Millwright — Precision Alignment")).toBeTruthy();
  });

  it("omits a fact it was not given rather than inventing a placeholder", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          job: { ...SAFE_JOB, payRate: null, perDiemDailyRate: null, city: null, state: null },
        }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    const markup = markupWithoutStyles();
    expect(markup).not.toMatch(/TBD|Unknown|N\/A|--/);
    expect(screen.queryByText("Your pay rate")).toBeNull();
    expect(screen.queryByText("Location")).toBeNull();
  });

  it("carries the paperwork sentence OUTSIDE the buttons, as governance requires", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);

    const notice = await screen.findByText(
      "Dispatch paperwork and reporting instructions will follow after you accept.",
    );
    expect(notice.tagName).not.toBe("BUTTON");
    expect(notice.closest("button")).toBeNull();
    // From the server's own value, so it cannot be reworded locally.
    expect(PAGE_SOURCE).toContain("prompt.paperworkNotice");
  });
});

describe("JO-2 worker page - consequence disclosure", () => {
  it("shows the governed sentence and the postings acceptance would close", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          consequenceNotice:
            "If you accept this job offer, you will be removed from consideration for your other active job postings.",
          competingPostings: TWO_COMPETING,
        }),
      },
    });
    render(<WorkforceJobOfferPage />);

    expect(
      await screen.findByText(/you will be removed from consideration for your other active job postings/i),
    ).toBeTruthy();
    expect(screen.getByText("Millwright in Baytown, TX")).toBeTruthy();
    expect(screen.getByText("Rigger in Pasadena, TX")).toBeTruthy();
  });

  it("places the disclosure BEFORE the buttons, where it cannot be scrolled past", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ consequenceNotice: "If you accept this job offer, you will be removed from consideration for your other active job postings.", competingPostings: TWO_COMPETING }),
      },
    });
    render(<WorkforceJobOfferPage />);
    const notice = await screen.findByText(/removed from consideration/i);
    const accept = screen.getByRole("button", { name: "Accept Job Offer" });

    // DOCUMENT_POSITION_FOLLOWING === 4: the button comes after the notice.
    expect(notice.compareDocumentPosition(accept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows nothing at all when there is nothing to lose", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    expect(screen.queryByText(/removed from consideration/i)).toBeNull();
  });

  it("gives the worker NO control over the listed postings - this is S4's concern, not JO-2's", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ consequenceNotice: "If you accept this job offer, you will be removed from consideration for your other active job postings.", competingPostings: TWO_COMPETING }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByText(/removed from consideration/i);

    // Exactly two buttons on the page: Accept and Decline. No per-posting toggle, checkbox,
    // radio, select or remove control exists.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("builds no cross-job control in source - no ranking, preference or primary job", () => {
    expect(PAGE_SOURCE).not.toMatch(/withdrawFrom|rank|preferred|primaryJob|onToggle/i);
    expect(CLIENT_SOURCE).not.toMatch(/withdrawFrom|rank|preferred|primaryJob/i);
  });

  it("lists postings through the same safe projection, never a customer", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ consequenceNotice: "If you accept this job offer, you will be removed from consideration for your other active job postings.", competingPostings: TWO_COMPETING }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByText(/removed from consideration/i);

    const markup = markupWithoutStyles();
    for (const forbidden of [/customer/i, /bill rate/i, /markup/i, /ACME/i]) {
      expect(markup).not.toMatch(forbidden);
    }
  });
});

describe("JO-2 worker page - accepting", () => {
  it("records the acceptance and confirms it concisely", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    const accept = await screen.findByRole("button", { name: "Accept Job Offer" });

    (accept).click();

    expect(await screen.findByRole("heading", { name: /accepted/i })).toBeTruthy();
    expect(screen.getByText(/We've recorded your acceptance/i)).toBeTruthy();
    expect(screen.getByText(/Dispatch paperwork and reporting instructions will follow\./i)).toBeTruthy();
  });

  it("does NOT claim any document was sent, because nothing sent one", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    (await screen.findByRole("button", { name: "Accept Job Offer" })).click();
    await screen.findByRole("heading", { name: /accepted/i });

    const markup = markupWithoutStyles();
    expect(markup).not.toMatch(/we('ve| have) (sent|emailed|texted)/i);
    expect(markup).not.toMatch(/check your (email|inbox|messages)/i);
    expect(markup).not.toMatch(/on (its|the) way/i);
  });

  it("posts ONLY the decision, and names no record", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    (await screen.findByRole("button", { name: "Accept Job Offer" })).click();
    await screen.findByRole("heading", { name: /accepted/i });

    const post = calls.find((c) => c.url.includes("/decision"))!;
    expect(post.init?.method).toBe("POST");
    expect(JSON.parse(String(post.init?.body))).toEqual({ decision: "ACCEPT" });
  });

  it("disables both buttons while submitting so a worker cannot double-decide", async () => {
    let release: (v: unknown) => void = () => {};
    const pending = new Promise((r) => {
      release = r;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/decision")) {
          await pending;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              decisionState: "ACCEPTED",
              respondedAt: "2026-09-09T18:00:00.000Z",
              alreadyRecorded: false,
              competingClosedCount: 0,
              assignmentId: "asg-1",
            }),
          } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => prompt() } as unknown as Response;
      }),
    );
    render(<WorkforceJobOfferPage />);
    (await screen.findByRole("button", { name: "Accept Job Offer" })).click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Saving/ })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Decline Job Offer" }).hasAttribute("disabled")).toBe(true);
    release(null);
  });

  it("reports the SERVER's decision, not the button that was pressed", async () => {
    // A second link on an already-decided offer reports the standing decision. If the worker taps
    // Accept on an offer that was already declined, they must be shown the truth.
    stubFetch({
      decision: {
        status: 200,
        body: {
          decisionState: "DECLINED",
          respondedAt: "2026-09-09T18:00:00.000Z",
          alreadyRecorded: true,
          competingClosedCount: 0,
          assignmentId: null,
        },
      },
    });
    render(<WorkforceJobOfferPage />);
    (await screen.findByRole("button", { name: "Accept Job Offer" })).click();

    expect(await screen.findByRole("heading", { name: /declined/i })).toBeTruthy();
    expect(screen.getByText(/already on file/i)).toBeTruthy();
  });
});

describe("JO-2 worker page - declining", () => {
  it("records the decline and says the other interests were not affected", async () => {
    stubFetch({
      decision: {
        status: 200,
        body: {
          decisionState: "DECLINED",
          respondedAt: "2026-09-09T18:00:00.000Z",
          alreadyRecorded: false,
          competingClosedCount: 0,
          assignmentId: null,
        },
      },
    });
    render(<WorkforceJobOfferPage />);

    (await screen.findByRole("button", { name: "Decline Job Offer" })).click();

    expect(await screen.findByRole("heading", { name: /declined/i })).toBeTruthy();
    expect(screen.getByText(/We've recorded that you declined this job offer/i)).toBeTruthy();
    expect(screen.getByText(/Your other active job interests were not affected/i)).toBeTruthy();
  });

  it("posts DECLINE and nothing else", async () => {
    stubFetch({
      decision: {
        status: 200,
        body: {
          decisionState: "DECLINED",
          respondedAt: "2026-09-09T18:00:00.000Z",
          alreadyRecorded: false,
          competingClosedCount: 0,
          assignmentId: null,
        },
      },
    });
    render(<WorkforceJobOfferPage />);
    (await screen.findByRole("button", { name: "Decline Job Offer" })).click();
    await screen.findByRole("heading", { name: /declined/i });

    const post = calls.find((c) => c.url.includes("/decision"))!;
    expect(JSON.parse(String(post.init?.body))).toEqual({ decision: "DECLINE" });
  });

  it("does not make Decline ambiguous - both controls are real buttons of equal construction", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    const accept = await screen.findByRole("button", { name: "Accept Job Offer" });
    const decline = screen.getByRole("button", { name: "Decline Job Offer" });

    // Same base class, so size, weight and hit area are identical; only the colour differs.
    expect(accept.className).toContain("jo-btn");
    expect(decline.className).toContain("jo-btn");
    expect(decline.hasAttribute("disabled")).toBe(false);
    expect(decline.tagName).toBe("BUTTON");
  });
});

describe("JO-2 worker page - every other state", () => {
  it("shows a loading state before the offer arrives", () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);

    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("explains an expired link WITHOUT claiming the offer ended with it", async () => {
    stubFetch({ view: { status: 403, body: { message: "This link has expired." } } });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /expired/i })).toBeTruthy();

    // A link expiring is not a business event, and this screen still never says the offer ended.
    expect(markupWithoutStyles()).not.toMatch(/offer (has )?(expired|been cancelled|was declined)/i);

    /**
     * GATE JO-2C CORRECTED THIS SENTENCE, AND THE ASSERTION WITH IT.
     *
     * JO-2 told the worker flatly that "This job offer is still open" and that links expire "24 hours
     * after they are SENT". Both became false. Nothing is ever sent - Jarvis implements no delivery - and
     * a credential now lives as long as the offer's own response deadline rather than a fixed day. Worse,
     * the offer may genuinely NOT still be open: a rescission neutralizes the credential, so "expired
     * link" is now reachable on an offer MW4H has withdrawn, and promising it is open would send the
     * worker back to a recruiter for something that no longer exists.
     *
     * SO THE SCREEN IS NOW CONDITIONAL IN LANGUAGE RATHER THAN CONFIDENT: it says what to do IF the offer
     * is still open, and asserts nothing it cannot know.
     */
    expect(screen.getByText(/If the job offer is still open/i)).toBeTruthy();
    expect(markupWithoutStyles()).not.toMatch(/24 hours/i);
    expect(markupWithoutStyles()).not.toMatch(/after they are sent/i);
  });

  it("explains an already-used link", async () => {
    stubFetch({ view: { status: 403, body: { message: "This link has already been used." } } });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /already been used/i })).toBeTruthy();
  });

  it("explains an invalid link", async () => {
    stubFetch({ view: { status: 403, body: { message: "Invalid link." } } });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /does not work/i })).toBeTruthy();
  });

  it("explains a missing token without calling the server at all", async () => {
    searchParams.token = undefined;
    stubFetch();
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /does not work/i })).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("explains a closed offer when the candidacy has moved on", async () => {
    stubFetch({
      view: { status: 409, body: { message: "This job offer is no longer open." } },
    });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /closed/i })).toBeTruthy();
  });

  it("explains a backend error honestly, without internals", async () => {
    stubFetch({ view: { status: 500, body: { message: "Internal server error" } } });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByRole("heading", { name: /something went wrong/i })).toBeTruthy();
    expect(markupWithoutStyles()).not.toMatch(/Internal server error|prisma|stack/i);
  });

  it("shows an already-resolved offer as resolved, with no buttons to press", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ decisionState: "ACCEPTED", actionable: false, respondedAt: "2026-09-09T18:00:00.000Z" }),
      },
    });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByText(/already accepted this job offer/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept Job Offer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline Job Offer" })).toBeNull();
  });

  it("shows an already-declined offer the same way", async () => {
    stubFetch({
      view: { status: 200, body: prompt({ decisionState: "DECLINED", actionable: false }) },
    });
    render(<WorkforceJobOfferPage />);

    expect(await screen.findByText(/already declined this job offer/i)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("names MW4H even on a refused link, so a worker can tell it is not a scam", async () => {
    stubFetch({ view: { status: 403, body: { message: "Invalid link." } } });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /does not work/i });

    expect(screen.getByText("Millwrights4Hire - MW4H")).toBeTruthy();
  });
});

describe("JO-2 worker page - security", () => {
  it("sends NO Authorization header and never reads the staff token", async () => {
    localStorage.setItem("jp_accessToken", "STAFF-TOKEN-SHOULD-NEVER-BE-SENT");
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    for (const call of calls) {
      const headers = (call.init?.headers ?? {}) as Record<string, string>;
      expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
    }
    expect(CLIENT_SOURCE).not.toContain("jp_accessToken");
    expect(CLIENT_SOURCE).not.toContain("apiFetch");
  });

  it("uses the dedicated public Job Offer routes and no staff endpoint", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    expect(calls[0].url).toContain("/public/job-offer?token=");
    expect(calls.every((c) => c.url.includes("/public/job-offer"))).toBe(true);
    // Not the PRE_DISPATCH surface. The two scopes are not interchangeable on the server.
    expect(calls.every((c) => !c.url.includes("pre-dispatch"))).toBe(true);
  });

  it("sends the token in the query string and nothing else identifying", async () => {
    stubFetch();
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    const url = calls[0].url;
    expect(url).toContain("token=offer-token-abc");
    for (const forbidden of ["jobOfferId", "orderCandidateId", "candidateId", "orderId"]) {
      expect(url).not.toContain(forbidden);
    }
  });

  it("puts no forbidden value in the DOM, because it is never sent one", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({ consequenceNotice: "If you accept this job offer, you will be removed from consideration for your other active job postings.", competingPostings: TWO_COMPETING }),
      },
    });
    render(<WorkforceJobOfferPage />);
    await screen.findByRole("heading", { name: /selected/i });

    const markup = markupWithoutStyles();
    for (const forbidden of [
      /customer/i,
      /bill\s*rate/i,
      /margin/i,
      /markup/i,
      /jobSiteName/i,
      /invoice/i,
    ]) {
      expect(markup).not.toMatch(forbidden);
    }
  });

  it("logs nothing", () => {
    expect(PAGE_SOURCE).not.toMatch(/console\.(log|warn|error|info|debug)/);
    expect(CLIENT_SOURCE).not.toMatch(/console\.(log|warn|error|info|debug)/);
  });

  it("retains no raw server message in the error it throws", () => {
    // The classification is carried; the message is deliberately dropped, so a future backend
    // change cannot surface an internal detail in a worker's browser.
    expect(CLIENT_SOURCE).toMatch(/class JobOfferLinkError/);
    expect(CLIENT_SOURCE).toMatch(/super\(failure\)/);
  });

  it("declares no delivery of any kind", () => {
    for (const source of [PAGE_SOURCE, CLIENT_SOURCE]) {
      expect(source).not.toMatch(/\bsms\b|twilio|sendMail|nodemailer|reminder|resend/i);
    }
  });
});
