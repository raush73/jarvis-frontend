/**
 * Phase 17 S3 - the worker's PRE_DISPATCH job-interest page.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION, "Worker Experience" and
 * "Customer Identity Confidentiality"; VETTING_BUILD_CHECKLIST.md PHASE 17 slice S3.
 *
 * WHAT THIS SUITE IS FOR, AND WHAT IT IS NOT FOR. The confidentiality boundary is the BACKEND
 * projection, proved in pre-dispatch-worker-response.projection.spec.ts. What is proved here is
 * the frontend's own obligations: that it asks the governed question with the governed answers,
 * that it renders the Owner-governed expiration sentence, that it explains each failure honestly,
 * that it never invents a placeholder for a field it was not given, and - critically - that it
 * does not fetch broad internal objects and hide them client-side, borrow the STAFF credential,
 * or put anything sensitive into props, page state, the DOM or a log.
 *
 * The fetch layer is stubbed at `window.fetch`, so the real client module runs: URL construction,
 * refusal classification and the absence of an Authorization header are all under test rather
 * than mocked away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const searchParams = { token: "worker-token-abc" } as Record<string, string | undefined>;

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => searchParams[k] ?? null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/workforce/job-interest",
}));

import WorkforceJobInterestPage from "./page";

/**
 * Removes block and line comments so source assertions examine EXECUTABLE CODE only.
 *
 * Both files document what they must never do, and name the forbidden things in order to do so.
 * Scanning raw text would therefore fail on the very comments that state the rule.
 */
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

/**
 * The rendered markup with the styled-jsx `<style>` block removed.
 *
 * CSS legitimately contains the word "margin", which would otherwise trip a commercial-data
 * assertion. Stylesheet text is not data sent to the worker.
 */
function markupWithoutStyles(): string {
  return document.body.innerHTML.replace(/<style[\s\S]*?<\/style>/g, "");
}

/** The SAFE prompt, exactly as the backend allowlist projects it. */
function prompt(over: Record<string, unknown> = {}) {
  return {
    workerFirstName: "Charles",
    job: {
      tradeName: "Electrician",
      specializationName: "Industrial",
      city: "Odessa",
      state: "TX",
      payRate: "42.50",
      perDiemDailyRate: "75.00",
      perDiemDaysPerWeek: "5",
      anticipatedStartDate: "2026-09-21T13:00:00.000Z",
      anticipatedEndDate: "2026-12-18T00:00:00.000Z",
      estimatedDurationWeeks: 12,
      estimatedRegHoursPerWeek: "40",
      estimatedOtHoursPerWeek: "10",
      estimatedWorkDaysPerWeek: 5,
    },
    question: "Are you still interested in this job?",
    yesLabel: "Confirm",
    noLabel: "Remove me from this job posting",
    linkExpiresAt: "2026-09-09T14:00:00.000Z",
    expirationNotice: "This secure link expires 24 hours after it was sent.",
    recordedAnswer: null,
    actionable: true,
    /**
     * PHASE 17 S4. A WORKER WITH NO OTHER OPEN INTERESTS, which is what keeps these S3 assertions
     * meaningful: they describe the page a worker sees when this job is the only one, and S4 must
     * not have changed it. The S4 behaviour is covered in `workerJobInterestOtherJobs.test.tsx`.
     */
    otherInterests: [],
    otherInterestsCopy: {
      heading: "Your other job interests",
      notice:
        "You'll stay under consideration for these unless you ask to be removed.",
      removeLabel: "Remove me from this job posting",
      undoRemoveLabel: "Keep me interested",
      pendingJobOfferLabel: "Pending Job Offer",
      pendingJobOfferNotice:
        "You have a job offer waiting on this one. Open it to accept or decline.",
      reviewJobOfferLabel: "Review Job Offer",
      confirmationHeading: "Please confirm before we save this",
    },
    ...over,
  };
}

type FetchCall = { url: string; init: RequestInit | undefined };
let calls: FetchCall[] = [];

/** Stub `window.fetch` so the real client module is exercised end to end. */
function stubFetch(
  handlers: {
    view?: { status: number; body: unknown };
    respond?: { status: number; body: unknown };
  } = {},
) {
  const view = handlers.view ?? { status: 200, body: prompt() };
  const respond =
    handlers.respond ?? {
      status: 200,
      body: {
        interestResult: "CONTINUED_INTEREST_CONFIRMED",
        respondedAt: "2026-09-08T16:00:00.000Z",
        alreadyRecorded: false,
      },
    };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const chosen = String(url).includes("/respond") ? respond : view;
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
  searchParams.token = "worker-token-abc";
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("S3 worker page - the primary question", () => {
  it("asks the governed question with both governed answers", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    expect(
      await screen.findByText("Are you still interested in this job?"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove me from this job posting" })).toBeTruthy();
  });

  it("renders the question and answers from the SERVER, never from local copies", () => {
    // The governed wording has one source. A hard-coded string here would be a second one to
    // keep in agreement - and it was this single source that let "Confirm" replace the older
    // YES label in one place rather than two.
    expect(PAGE_SOURCE).not.toContain("Are you still interested in this job?");
    expect(PAGE_SOURCE).not.toContain("Remove me from this job");
    // The YES label is matched as a QUOTED LITERAL. A bare "Confirm" would collide with the
    // page's own heading, "Confirm you're still interested.", and the assertion would then be
    // testing the heading instead of the button.
    expect(PAGE_SOURCE).not.toContain('"Confirm"');
    expect(PAGE_SOURCE).toContain("prompt.question");
    expect(PAGE_SOURCE).toContain("prompt.yesLabel");
    expect(PAGE_SOURCE).toContain("prompt.noLabel");
  });

  it("renders the Owner-governed expiration sentence", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    expect(
      await screen.findByText("This secure link expires 24 hours after it was sent."),
    ).toBeTruthy();
    // Also from the server's own value, so it cannot be weakened locally.
    expect(PAGE_SOURCE).toContain("prompt.expirationNotice");
  });

  it("asks the worker to confirm interest, without implying they hold the job", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    expect(
      await screen.findByText("Charles, confirm you're still interested."),
    ).toBeTruthy();
    // The worker is not dispatched, assigned, placed or hired at this point, so the heading may
    // not read as news about a job they already have.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/update on your job|your job is|dispatched|assigned|you're on this job/i);
  });

  it("still asks plainly when it was given no first name", async () => {
    stubFetch({ view: { status: 200, body: prompt({ workerFirstName: null }) } });
    render(<WorkforceJobInterestPage />);

    expect(await screen.findByText("Confirm you're still interested.")).toBeTruthy();
  });

  it("greets the worker by their own first name", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    expect(await screen.findByText(/Charles/)).toBeTruthy();
  });

  it("shows the safe job facts it was given", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    const text = document.body.textContent ?? "";

    expect(text).toContain("Electrician");
    expect(text).toContain("Odessa, TX");
    expect(text).toContain("$42.50 per hour");
    expect(text).toContain("$75.00 per day");
    expect(text).toContain("About 12 weeks");
    expect(text).toContain("About 40 hours per week");
  });
});

/**
 * The Owner-governed company identity, exactly as ruled: spelling, capitalisation, spacing and a
 * hyphen. A worker who followed a link from a text message has no other way to tell who is
 * asking, so this is present on every state they can land on - including the refusals, which are
 * where an unidentified page looks most like a phishing attempt.
 */
const MW4H_IDENTITY = "Millwrights4Hire - MW4H";

describe("S3 worker page - company identity", () => {
  it("identifies MW4H on the initial job-interest screen", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    expect(screen.getByText(MW4H_IDENTITY)).toBeTruthy();
  });

  it("identifies MW4H on the YES success screen", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Confirm" })).click();

    await screen.findByText("Thank you — your interest is confirmed.");
    expect(screen.getByText(MW4H_IDENTITY)).toBeTruthy();
  });

  it("identifies MW4H on the NO success screen", async () => {
    stubFetch({
      respond: {
        status: 200,
        body: {
          interestResult: "WITHDRAWAL_REQUESTED",
          respondedAt: "2026-09-08T16:00:00.000Z",
          alreadyRecorded: false,
        },
      },
    });
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Remove me from this job posting" })).click();

    await screen.findByText("You've been removed from this job posting");
    expect(screen.getByText(MW4H_IDENTITY)).toBeTruthy();
  });

  it.each([
    ["expired", "This link has expired.", /link has expired/i],
    ["already used", "This link has already been used.", /already been used/i],
    ["invalid", "Invalid link.", /does not work/i],
    ["closed", "This request is no longer open.", /request is closed/i],
  ])("identifies MW4H on the %s link screen", async (_label, message, shown) => {
    stubFetch({ view: { status: 403, body: { message } } });
    render(<WorkforceJobInterestPage />);

    await screen.findByText(shown);
    expect(screen.getByText(MW4H_IDENTITY)).toBeTruthy();
  });

  it("uses the exact governed identity and no loose variant of it", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    const text = document.body.textContent ?? "";

    expect(text).toContain(MW4H_IDENTITY);
    // The rejected substitutes: the long form spelled out, and either half standing alone.
    expect(text).not.toMatch(/Millwrights for Hire/i);
    expect(text.replace(MW4H_IDENTITY, "")).not.toMatch(/Millwrights4Hire|MW4H/i);
  });

  it("keeps the identity to one quiet line, not a marketing banner", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");

    // No logo, no image, no tagline, no marketing prose competing with the question.
    expect(document.querySelectorAll("img, svg")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/welcome to|about us|our mission|trusted|leading/i);
  });
});

describe("S3 worker page - customer confidentiality at the client boundary", () => {
  it("requests only the narrow worker endpoint, never a broad order or customer object", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/public/pre-dispatch-request");
    // No internal staff surface is consulted to enrich the page.
    for (const c of calls) {
      expect(c.url).not.toMatch(/\/orders\/|\/customers\/|\/recruiting\//);
    }
  });

  it("sends no Authorization header and never reads the staff token", async () => {
    localStorage.setItem("jp_accessToken", "STAFF-TOKEN-MUST-NOT-BE-USED");
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");

    for (const c of calls) {
      const headers = new Headers((c.init?.headers ?? {}) as HeadersInit);
      expect(headers.get("Authorization")).toBeNull();
    }
    // A worker surface must not borrow the staff credential, so it must not use the staff client.
    expect(CLIENT_SOURCE).not.toContain("getAccessToken");
    expect(CLIENT_SOURCE).not.toContain("apiFetch(");
    expect(CLIENT_SOURCE).not.toContain("jp_accessToken");
  });

  it("puts no forbidden customer or commercial field in the DOM", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    const html = markupWithoutStyles();

    expect(html).not.toMatch(/customer/i);
    expect(html).not.toMatch(/\bcompany\b/i);
    expect(html).not.toMatch(/billRate|bill rate|markup/i);
    expect(html).not.toMatch(/\bmargin\b(?!:)/i);
    expect(html).not.toMatch(/jobSiteName|jobSiteAddress/i);
  });

  it("declares no type or prop for forbidden data, so none can be passed in", () => {
    for (const source of [PAGE_SOURCE, CLIENT_SOURCE]) {
      expect(source).not.toMatch(/customerName|customerId|companyName|customer:/);
      expect(source).not.toMatch(/baseBillRate|otBillRate|dtBillRate|billingTerms/);
      // `margin` is excluded only in its CSS-property sense; the commercial field names are not.
      expect(source).not.toMatch(/marginAmount|marginPercent|expectedTradeMargin|markup/i);
    }
  });

  it("logs nothing, so no payload can reach the browser console", () => {
    for (const source of [PAGE_SOURCE, CLIENT_SOURCE]) {
      expect(source).not.toMatch(/console\.(log|error|warn|info|debug)/);
    }
  });

  it("puts the token in the query string only, and never in storage or the DOM", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");

    // The token is the credential the worker arrived with; it must not be persisted or rendered.
    expect(document.body.innerHTML).not.toContain("worker-token-abc");
    expect(localStorage.getItem("jp_workerSession")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("worker-token-abc");
    expect(PAGE_SOURCE).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });

  it("uses no internal recruiting vocabulary anywhere on the page", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    // "Millwrights4Hire - MW4H" is the Owner-governed COMPANY IDENTITY and is required on every
    // state. It is removed before the scan rather than dropped from the pattern, so "MW4H" as
    // recruiting jargon remains forbidden everywhere else on the page.
    const text = (document.body.textContent ?? "").replace(/Millwrights4Hire - MW4H/g, "");

    expect(text).not.toMatch(/PRE_DISPATCH|pre-dispatch/i);
    expect(text).not.toMatch(/candidacy|candidate/i);
    expect(text).not.toMatch(/vetting|MW4H|disposition|withdraw(al)?\b/i);
  });
});

describe("S3 worker page - YES", () => {
  it("submits the decision and only the decision", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Confirm" })).click();

    await waitFor(() => expect(calls.length).toBe(2));
    const respondCall = calls[1];
    expect(respondCall.url).toContain("/public/pre-dispatch-request/respond");
    expect(respondCall.init?.method).toBe("POST");
    expect(JSON.parse(String(respondCall.init?.body))).toEqual({ decision: "YES" });
  });

  it("confirms the recorded interest, and claims no more than that", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Confirm" })).click();

    expect(
      await screen.findByText("Thank you — your interest is confirmed."),
    ).toBeTruthy();
    expect(
      screen.getByText("We've recorded that you're still interested in this job."),
    ).toBeTruthy();
  });

  it("claims nothing about onboarding, clearance, selection or dispatch", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Confirm" })).click();
    await screen.findByText("Thank you — your interest is confirmed.");
    const text = document.body.textContent ?? "";

    // Those are later governed slices. YES means only "I remain interested".
    expect(text).not.toMatch(/cleared|verified|onboarding complete|dispatched|selected/i);
    // Confirming interest is not a place on the job, so the page must not say it is one.
    expect(text).not.toMatch(/still on this job|you are on this job|assigned|placed|hired/i);
  });
});

describe("S3 worker page - NO", () => {
  it("submits NO and reports removal from THIS job only", async () => {
    stubFetch({
      respond: {
        status: 200,
        body: {
          interestResult: "WITHDRAWAL_REQUESTED",
          respondedAt: "2026-09-08T16:00:00.000Z",
          alreadyRecorded: false,
        },
      },
    });
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Remove me from this job posting" })).click();

    await waitFor(() => expect(calls.length).toBe(2));
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ decision: "NO" });

    expect(
      await screen.findByText("You've been removed from this job posting"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "We've recorded that you're no longer interested in this job posting. This does not affect any other job you're being considered for.",
      ),
    ).toBeTruthy();
  });

  /**
   * S4 IS NOW THE AUTHORIZED GATE FOR OTHER INTERESTS, so this no longer asserts that the page has
   * no concept of them. What it still proves is the part S4 did not change: a worker whose only open
   * interest is THIS job sees the S3 page exactly - two buttons, no extra section, nothing to
   * dismiss. The section is driven by the server's list, so an empty list renders nothing at all
   * rather than an empty container with a heading.
   *
   * THE PROHIBITIONS THAT SURVIVE ARE STILL ASSERTED. S4 authorized Keep/Remove; it authorized no
   * ranking, no preference, no job board and no durable Keep, and those remain forbidden here.
   */
  it("shows exactly the S3 page when this job is the worker's only open interest", async () => {
    stubFetch();
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");

    // Exactly two buttons: the two governed answers, and no other-interests controls beside them.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("Your other job interests")).toBeNull();

    // S4 RANKS NOTHING AND PREFERS NOTHING. No score, no ordering control, no starred or preferred
    // job, and no durable Keep - because Keep is the default and persists no state.
    expect(PAGE_SOURCE).not.toMatch(
      /ranking|rankJob|preferred|priority|sortBy|reorder|jobBoard|browseJobs|recordKeep|keepJob\(/i,
    );
  });

  it("reflects the SERVER's recorded outcome rather than the button pressed", async () => {
    // A second link on an already-answered request reports the standing answer. Trusting the
    // click would show the worker an outcome that did not happen.
    stubFetch({
      respond: {
        status: 200,
        body: {
          interestResult: "CONTINUED_INTEREST_CONFIRMED",
          respondedAt: "2026-09-08T16:00:00.000Z",
          alreadyRecorded: true,
        },
      },
    });
    render(<WorkforceJobInterestPage />);

    (await screen.findByRole("button", { name: "Remove me from this job posting" })).click();

    expect(
      await screen.findByText("Thank you — your interest is confirmed."),
    ).toBeTruthy();
    expect(screen.getByText(/already on file/i)).toBeTruthy();
  });
});

/** One rule block from the page's styled-jsx, so appearance can be asserted precisely. */
function cssBlock(selector: string): string {
  const found = PAGE_SOURCE.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
  if (!found) throw new Error(`no CSS block for .${selector}`);
  return found[1];
}

/** A colour declaration from a rule block. `color` must not match inside `border-color`. */
function colourOf(block: string, property: string): { r: number; g: number; b: number } {
  const found = block.match(new RegExp(`(?<![-\\w])${property}:\\s*#([0-9a-f]{6})`, "i"));
  if (!found) throw new Error(`no ${property} declaration in block: ${block}`);
  const n = parseInt(found[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const isWhite = (c: { r: number; g: number; b: number }) => c.r === 255 && c.g === 255 && c.b === 255;

describe("S3 worker page - the withdrawal answer", () => {
  it("names the POSTING, in both the answer and the outcome", async () => {
    // Regression guard. "Remove me from this job" reads as walking off a job already in hand.
    // The worker has not been dispatched, assigned, placed or hired, so both the action and its
    // confirmation must say what is really being withdrawn: interest in an opening. The shape of
    // the wording is asserted, not just its current text, so it cannot quietly shorten back.
    stubFetch({
      respond: {
        status: 200,
        body: {
          interestResult: "WITHDRAWAL_REQUESTED",
          respondedAt: "2026-09-08T16:00:00.000Z",
          alreadyRecorded: false,
        },
      },
    });
    render(<WorkforceJobInterestPage />);

    const button = await screen.findByRole("button", { name: /remove me/i });
    expect(button.textContent).toMatch(/job posting$/);
    expect(button.textContent).not.toMatch(/from this job$/);

    button.click();

    // Scoped to the outcome heading, so this waits for the transition instead of reading the
    // question's heading that is still on screen for an instant after the click.
    const heading = await screen.findByRole("heading", { level: 1, name: /removed/i });
    expect(heading.textContent).toMatch(/job posting$/);
    expect(heading.textContent).not.toMatch(/from this job$/);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/no longer want this job\b/);
    expect(text).not.toMatch(/\b(your|my) job\b|assigned|placed|hired|dispatch/i);
  });

  it("renders the withdrawal action as solid red with white lettering", async () => {
    const no = cssBlock("ji-btn-no");
    const background = colourOf(no, "background");
    const lettering = colourOf(no, "color");

    // Unmistakably red rather than a tint, and specifically NOT the white-background outline it
    // used to be, which read as the lesser option beside a solid green Confirm.
    expect(background.r).toBeGreaterThan(120);
    expect(background.r).toBeGreaterThan(background.g * 2);
    expect(background.r).toBeGreaterThan(background.b * 2);
    expect(isWhite(background)).toBe(false);
    expect(isWhite(lettering)).toBe(true);
  });

  it("keeps Confirm solid green and builds both answers identically", async () => {
    const yes = cssBlock("ji-btn-yes");
    const yesBackground = colourOf(yes, "background");

    expect(yesBackground.g).toBeGreaterThan(yesBackground.r);
    expect(yesBackground.g).toBeGreaterThan(yesBackground.b);
    expect(isWhite(colourOf(yes, "color"))).toBe(true);

    // Same construction, so size, weight and spacing stay equal: each answer states only its own
    // three colours and inherits everything else from the shared .ji-btn rule.
    const declarations = (block: string) =>
      block
        .split(";")
        .map((d) => d.split(":")[0].trim())
        .filter(Boolean)
        .sort();
    expect(declarations(yes)).toEqual(["background", "border-color", "color"]);
    expect(declarations(cssBlock("ji-btn-no"))).toEqual(declarations(yes));
  });
});

describe("S3 worker page - error experience", () => {
  const cases: { status: number; message: string; expect: RegExp }[] = [
    { status: 403, message: "This link has expired.", expect: /link has expired/i },
    {
      status: 403,
      message: "This link has already been used.",
      expect: /already been used/i,
    },
    { status: 403, message: "Invalid link.", expect: /does not work/i },
    {
      status: 403,
      message: "This request is no longer open.",
      expect: /request is closed/i,
    },
    { status: 500, message: "boom", expect: /something went wrong/i },
  ];

  for (const c of cases) {
    it(`explains a ${c.status} "${c.message}" honestly`, async () => {
      stubFetch({ view: { status: c.status, body: { message: c.message } } });
      render(<WorkforceJobInterestPage />);

      expect(await screen.findByText(c.expect)).toBeTruthy();
    });
  }

  it("tells an expired-link worker how long the link was valid for", async () => {
    stubFetch({ view: { status: 403, body: { message: "This link has expired." } } });
    render(<WorkforceJobInterestPage />);

    await screen.findByText(/link has expired/i);
    expect(document.body.textContent).toMatch(/24 hours/);
  });

  it("refuses a missing token without calling the server", async () => {
    searchParams.token = undefined;
    stubFetch();
    render(<WorkforceJobInterestPage />);

    expect(await screen.findByText(/does not work/i)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("never shows a stack trace, exception name, id or server internal", async () => {
    stubFetch({
      view: {
        status: 403,
        // A hostile server message. The page must not echo it.
        body: {
          message: "PrismaClientKnownRequestError at oc-123 cand-456 ACME HOLDINGS tokenHash=ab",
        },
      },
    });
    render(<WorkforceJobInterestPage />);

    await screen.findByText(/does not work/i);
    const text = document.body.textContent ?? "";

    expect(text).not.toMatch(/Prisma|tokenHash|oc-123|cand-456|ACME/i);
    // The client keeps a classification, not the raw message.
    expect(CLIENT_SOURCE).toContain("failure");
  });

  it("shows a settled state rather than the question when the request is not actionable", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          actionable: false,
          recordedAnswer: {
            interestResult: "WITHDRAWAL_REQUESTED",
            respondedAt: "2026-09-08T12:00:00.000Z",
          },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);

    expect(await screen.findByText(/asked to be removed from this job/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });
});

describe("S3 worker page - invents nothing", () => {
  it("omits a field it was not given instead of showing a placeholder", async () => {
    stubFetch({
      view: {
        status: 200,
        body: prompt({
          workerFirstName: null,
          job: {
            tradeName: "Pipefitter",
            specializationName: null,
            city: null,
            state: null,
            payRate: null,
            perDiemDailyRate: null,
            perDiemDaysPerWeek: null,
            anticipatedStartDate: null,
            anticipatedEndDate: null,
            estimatedDurationWeeks: null,
            estimatedRegHoursPerWeek: null,
            estimatedOtHoursPerWeek: null,
            estimatedWorkDaysPerWeek: null,
          },
        }),
      },
    });
    render(<WorkforceJobInterestPage />);

    await screen.findByText("Are you still interested in this job?");
    const text = document.body.textContent ?? "";

    expect(text).toContain("Pipefitter");
    expect(text).not.toMatch(/TBD|Unknown|N\/A|null|undefined|To be determined/i);
    // Still fully answerable with only a trade name.
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  });

  it("invents no shift, reporting time or reporting location", () => {
    expect(PAGE_SOURCE).not.toMatch(/shift|reportTime|reporting time|report to/i);
  });
});

describe("S3 worker page - mobile first", () => {
  it("is a single narrow column with no staff shell or navigation chrome", () => {
    expect(PAGE_SOURCE).toContain("max-width");
    expect(PAGE_SOURCE).toContain("min-height: 100vh");
    // No staff layout, sidebar or module navigation is imported into a worker surface.
    expect(PAGE_SOURCE).not.toMatch(/Sidebar|AppShell|StaffLayout|useSession/);
  });

  it("stacks full-width answer buttons at a thumb-sized tap target", () => {
    expect(PAGE_SOURCE).toMatch(/flex-direction:\s*column/);
    expect(PAGE_SOURCE).toMatch(/min-height:\s*52px/);
    expect(PAGE_SOURCE).toMatch(/\.ji-btn\s*\{[\s\S]*?width:\s*100%/);
  });

  it("treats the phone as the base case and widens only upward", () => {
    // The single media query is min-width, so the phone layout is the default rather than an
    // override of a desktop design.
    expect(PAGE_SOURCE).toMatch(/@media \(min-width: 640px\)/);
    expect(PAGE_SOURCE).not.toMatch(/@media \(max-width/);
  });

  it("disables both buttons while an answer is in flight", async () => {
    let release: (v: unknown) => void = () => {};
    const pending = new Promise((r) => {
      release = r;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes("/respond")) {
          await pending;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              interestResult: "CONTINUED_INTEREST_CONFIRMED",
              respondedAt: "2026-09-08T16:00:00.000Z",
              alreadyRecorded: false,
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => prompt(),
        } as unknown as Response;
      }),
    );

    render(<WorkforceJobInterestPage />);
    const yes = await screen.findByRole("button", { name: "Confirm" });
    yes.click();

    // A double tap on a phone must not submit twice.
    await waitFor(() =>
      expect(
        screen.getAllByRole("button").every((b) => (b as HTMLButtonElement).disabled),
      ).toBe(true),
    );

    release(null);
    await screen.findByText("Thank you — your interest is confirmed.");
    expect(calls.filter((c) => c.url.includes("/respond"))).toHaveLength(1);
  });
});
