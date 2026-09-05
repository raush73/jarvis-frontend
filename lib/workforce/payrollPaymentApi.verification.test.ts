import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorizeOwnPayrollPayment,
  confirmOwnPayrollPaymentVerification,
  getOwnPayrollPaymentAuthorization,
  getOwnPayrollPaymentVerification,
  PAYROLL_PAYMENT_AUTHORIZATION_BLOCKERS,
  PAYROLL_PAYMENT_VERIFICATION_STATES,
  payrollPaymentRefusalCode,
  type PayrollPaymentVerification,
} from "./payrollPaymentApi";
import { saveWorkerSession } from "./workerSession";

/**
 * Module 4.4 Gate 10C-E3 - the verification transport, at the wire.
 *
 * WHAT THIS SUITE IS ANSWERABLE FOR, and it is the half the component suite structurally cannot
 * reach. That one mocks this module, so what it observes is what the SCREEN asked this client for;
 * this one mocks `fetch`, so what it observes is what actually leaves the browser. The two
 * questions that matter here can only be asked at this level:
 *
 *  - THE ORDINARY AUTHORIZATION CARRIES NO REPLACEMENT KEY AT ALL. Not `replaces: null`, not
 *    `replaces: {}` - the property is absent from the JSON. A worker authorizing for the first
 *    time sends the request he always sent, and the server's default refusal goes on protecting
 *    every instruction already in force.
 *  - THE DELIBERATE REPLACEMENT CARRIES EXACTLY ONE OPAQUE IDENTITY and nothing beside it.
 *
 * [EXTENDED BY GATE 10C-E3 SLICE 4.] The same two questions are now asked of the authorization
 * READ, which is where the defect lived: the ordinary read must still carry NO query string at
 * all, and the replacement read must carry one escaped opaque identity on a GET with no body.
 *
 * The routes, the verbs and the state vocabulary are checked here too, because a client pointed at
 * the wrong path or inventing a sixth state would be caught by nothing else in the browser.
 */

const INVOCATION = "inv-verify-1";
const BASE = `/api/workforce/onboarding/runtime/packets/${INVOCATION}/payroll-payment`;

const STALE: PayrollPaymentVerification = {
  state: "RECORD_STALE",
  instructionId: "ppi_reviewed_0001",
  instruction: {
    setVersion: 3,
    paymentMethod: "DIRECT_DEPOSIT",
    allocationMode: "PERCENTAGE",
    routingVerificationMethod: null,
    accountConfirmationMethod: "INDEPENDENT_SECOND_ENTRY",
    effectiveFrom: "2026-02-01",
    supersededAt: null,
    superseded: false,
    accounts: [
      {
        position: 1,
        accountType: "CHECKING",
        financialInstitutionName: "Frost Bank",
        institutionSource: "WORKER_SELF_REPORTED",
        allocationKind: "PERCENTAGE",
        allocationPercentage: "100",
        allocationAmount: null,
        routingNumberMasked: "••••0021",
        accountNumberMasked: "••••7890",
      },
    ],
  },
  evaluatedAt: "2026-09-03T12:00:00.000Z",
};

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response);
}

/** The one request that was made, as JSON the server would receive. */
function sentBody(): Record<string, unknown> {
  const call = vi.mocked(global.fetch).mock.calls[0];
  const init = call[1] as { body?: string };
  return JSON.parse(init.body ?? "{}") as Record<string, unknown>;
}

function sentTo(): { url: string; method: string } {
  const call = vi.mocked(global.fetch).mock.calls[0];
  return {
    url: String(call[0]),
    method: String((call[1] as { method?: string }).method ?? "GET"),
  };
}

const PRESENTED = {
  revision: "10C.1",
  contentHash: "c".repeat(64),
  ruleRevision: "10C.1",
};

const CAPTURE = {
  strokes: [{ points: [{ x: 1, y: 1, t: 0 }] }],
  width: 400,
  height: 160,
  durationMs: 120,
} as never;

beforeEach(() => {
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    applicationSessionId: "apps_durable",
    candidateId: "candidate-1",
  });
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Gate 10C-E3 - the verification transport", () => {
  describe("the read", () => {
    it("asks the delivered route, and asks it as a read", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: STALE }));

      const value = await getOwnPayrollPaymentVerification(INVOCATION);

      expect(sentTo()).toEqual({ url: `${BASE}/verification`, method: "GET" });
      expect(value.state).toBe("RECORD_STALE");
      expect(value.instructionId).toBe("ppi_reviewed_0001");
      expect(value.instruction?.accounts[0]?.accountNumberMasked).toBe("••••7890");
    });

    it("knows the server's five states and no sixth", () => {
      // A state the browser invented would be a browser deciding something the server decides.
      expect([...PAYROLL_PAYMENT_VERIFICATION_STATES]).toEqual([
        "NOT_APPLICABLE",
        "SATISFIED",
        "RECORD_STALE",
        "RECORD_ABSENT",
        "RECORD_CHANGED",
      ]);
    });

    it("carries the refusal code through when the surface refuses", async () => {
      vi.stubGlobal(
        "fetch",
        respondWith(400, {
          statusCode: 400,
          code: "VERIFICATION_NOT_APPLICABLE",
          message: "not asked",
        }),
      );

      const failure = await getOwnPayrollPaymentVerification(INVOCATION).catch(
        (error: unknown) => error,
      );
      expect(payrollPaymentRefusalCode(failure)).toBe("VERIFICATION_NOT_APPLICABLE");
    });
  });

  describe("the affirmation", () => {
    it("sends ONE opaque identity, and nothing else at all", async () => {
      vi.stubGlobal(
        "fetch",
        respondWith(200, {
          ok: true,
          value: { instructionId: "ppi_reviewed_0001", confirmationRecorded: true },
        }),
      );

      const value = await confirmOwnPayrollPaymentVerification(INVOCATION, {
        instructionId: "ppi_reviewed_0001",
      });

      expect(sentTo()).toEqual({ url: `${BASE}/verification`, method: "POST" });
      // The WHOLE body. A candidate, a verdict, a date or a banking value would fail this.
      expect(sentBody()).toEqual({ instructionId: "ppi_reviewed_0001" });
      expect(value.confirmationRecorded).toBe(true);
    });

    it("tells a first affirmation from a repeat, because the server does", async () => {
      vi.stubGlobal(
        "fetch",
        respondWith(200, {
          ok: true,
          value: { instructionId: "ppi_reviewed_0001", confirmationRecorded: false },
        }),
      );

      const value = await confirmOwnPayrollPaymentVerification(INVOCATION, {
        instructionId: "ppi_reviewed_0001",
      });
      expect(value.confirmationRecorded).toBe(false);
    });
  });

  describe("the authorization, with and without a claim", () => {
    it("sends NO replacement property for an ordinary authorization", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: { executed: null } }));

      await authorizeOwnPayrollPayment(INVOCATION, {
        presented: PRESENTED,
        performedForm: "ELECTRONIC_SIGNATURE",
        capture: CAPTURE,
      });

      const body = sentBody();
      // ABSENT, not null and not empty. This is the property the server's default refusal rests on.
      expect(Object.prototype.hasOwnProperty.call(body, "replaces")).toBe(false);
      expect(Object.keys(body).sort()).toEqual([
        "capture",
        "performedForm",
        "presented",
      ]);
    });

    it("sends no replacement property when the caller passes an explicit null", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: { executed: null } }));

      await authorizeOwnPayrollPayment(INVOCATION, {
        presented: PRESENTED,
        performedForm: "ELECTRONIC_SIGNATURE",
        capture: CAPTURE,
        replaces: null,
      });

      expect(Object.prototype.hasOwnProperty.call(sentBody(), "replaces")).toBe(false);
    });

    it("sends the claim, narrowed to one identity, for a deliberate replacement", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: { executed: null } }));

      await authorizeOwnPayrollPayment(INVOCATION, {
        presented: PRESENTED,
        performedForm: "ELECTRONIC_SIGNATURE",
        capture: CAPTURE,
        replaces: {
          reviewedInstructionId: "ppi_reviewed_0001",
          // A caller handing in more than the contract cannot widen the request.
          ...({ routingNumber: "021000021", candidateId: "candidate-9" } as object),
        },
      });

      const body = sentBody();
      expect(body.replaces).toEqual({ reviewedInstructionId: "ppi_reviewed_0001" });
      expect(JSON.stringify(body)).not.toContain("021000021");
      expect(JSON.stringify(body)).not.toContain("candidate-9");
    });

    it("keeps the replacement refusal machine-readable", async () => {
      vi.stubGlobal(
        "fetch",
        respondWith(400, {
          statusCode: 400,
          code: "REPLACEMENT_INSTRUCTION_MISMATCH",
          message: "These are not the payroll payment instructions now in force",
        }),
      );

      const failure = await authorizeOwnPayrollPayment(INVOCATION, {
        presented: PRESENTED,
        performedForm: "ELECTRONIC_SIGNATURE",
        capture: CAPTURE,
        replaces: { reviewedInstructionId: "ppi_reviewed_0001" },
      }).catch((error: unknown) => error);

      expect(payrollPaymentRefusalCode(failure)).toBe(
        "REPLACEMENT_INSTRUCTION_MISMATCH",
      );
    });
  });

  /**
   * THE AUTHORIZATION READ, WHICH NOW SAYS WHICH TASK HE IS ON (Gate 10C-E3 slice 4).
   *
   * The transport half of the read-projection fix. What matters at this level is that the ordinary
   * read is the request it always was - no query string at all - and that the one thing the
   * replacement read adds is an opaque identity, on a GET, with no body.
   */
  describe("the authorization read, with and without a claim", () => {
    const stage = {
      review: null,
      available: false,
      blockers: ["ALREADY_AUTHORIZED"],
      guidance: [],
      authorization: null,
      executed: null,
    };

    it("asks the delivered route as a read, with no query at all", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: stage }));

      await getOwnPayrollPaymentAuthorization(INVOCATION);

      // NO `?` ANYWHERE. The delivered read is untouched by this slice, which is the compatibility
      // guarantee stated as a request rather than as a comment.
      expect(sentTo()).toEqual({ url: `${BASE}/authorization`, method: "GET" });
    });

    it("asks the same way when the caller passes an explicit null", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: stage }));

      await getOwnPayrollPaymentAuthorization(INVOCATION, null);

      expect(sentTo().url).toBe(`${BASE}/authorization`);
    });

    it("omits the query entirely rather than sending an empty claim", async () => {
      // An empty claim names no record, which the server must answer as a lapsed one. The absence
      // of the parameter is the absence of the claim.
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: stage }));

      await getOwnPayrollPaymentAuthorization(INVOCATION, "");

      expect(sentTo().url).toBe(`${BASE}/authorization`);
    });

    it("carries ONE opaque identity for a deliberate replacement, and still no body", async () => {
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: stage }));

      await getOwnPayrollPaymentAuthorization(INVOCATION, "ppi_reviewed_0001");

      const sent = sentTo();
      expect(sent.method).toBe("GET");
      expect(sent.url).toBe(
        `${BASE}/authorization?reviewedInstructionId=ppi_reviewed_0001`,
      );
      // READING IS NOT ASKING FOR ANYTHING TO HAPPEN. A GET with a body would be a write wearing a
      // read's method.
      const call = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
      expect(call?.body).toBeUndefined();
    });

    it("escapes the identity rather than trusting its shape", async () => {
      // It is opaque, so nothing here may assume it is URL-safe.
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: stage }));

      await getOwnPayrollPaymentAuthorization(INVOCATION, "ppi/a b&c=d");

      expect(sentTo().url).toBe(
        `${BASE}/authorization?reviewedInstructionId=ppi%2Fa%20b%26c%3Dd`,
      );
    });

    it("knows the lapsed-claim blocker the read can now answer with", () => {
      // A blocker the browser invented would be a browser deciding something the server decides.
      expect([...PAYROLL_PAYMENT_AUTHORIZATION_BLOCKERS]).toEqual([
        "PROPOSAL_NOT_REVIEW_READY",
        "ALREADY_AUTHORIZED",
        "REPLACEMENT_INSTRUCTION_MISMATCH",
      ]);
    });
  });
});
