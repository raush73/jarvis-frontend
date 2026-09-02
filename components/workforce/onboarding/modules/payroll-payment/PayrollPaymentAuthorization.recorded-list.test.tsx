/**
 * Module 4.4 Gate 10C - the recorded accounts, as React sees them.
 *
 * WHY THIS IS ITS OWN FILE, and it is not an organisational preference.
 *
 * React warns about a missing key ONCE per component per React instance, then never again. The
 * module's main suite renders this component's executed stage in several earlier tests, so by the
 * time any assertion there could look at `console.error`, React has already said its piece and
 * gone quiet - a broken key would sail through. Proven, not assumed: the assertion was written
 * there first, the key was reverted to reproduce the defect, and the suite stayed green.
 *
 * A fresh file gets a fresh React module registry, so the first render in it is the first render
 * React has seen. That is the only arrangement in which "no key warning" is evidence rather than
 * an artefact of ordering, so the console-based proof lives here and nowhere else.
 *
 * WHAT WENT WRONG. The recorded outcome carries no `accountId` - that identifier is how a DRAFT
 * account is recognised across saves so its protected values carry forward (QA-L4-R1), and an
 * authorized instruction is an immutable version with no such round trip. The list was keyed on it
 * anyway, got `undefined`, and a real worker's successful authorization logged a React warning.
 *
 * The component is rendered DIRECTLY here rather than driven through the runtime, because what is
 * under test is one list's keys and nothing about how the worker arrived at it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import type {
  PayrollPaymentAuthorization as PayrollPaymentAuthorizationStage,
  PayrollPaymentRecordedAccountView,
} from "@/lib/workforce/payrollPaymentApi";
import type { OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock("@/lib/workforce/payrollPaymentApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/payrollPaymentApi")>();
  return {
    ...actual,
    getOwnPayrollPaymentAuthorization: vi.fn(),
    authorizeOwnPayrollPayment: vi.fn(),
  };
});

import {
  getOwnPayrollPaymentAuthorization,
  PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
} from "@/lib/workforce/payrollPaymentApi";
import { PayrollPaymentAuthorization } from "./PayrollPaymentAuthorization";

const ROUTING = "021000021";
const ACCOUNT = "1234567890";

/**
 * One account exactly as a recorded outcome carries it: masked, positioned, and with NO
 * `accountId`. Spreading in a stray identifier here would restore the very generosity that let the
 * defect reach a browser, so the shape is written out in full rather than derived from the
 * interview's view.
 */
function recordedAccount(
  position: number,
  accountNumber: string,
): PayrollPaymentRecordedAccountView {
  return {
    position,
    accountType: "CHECKING",
    financialInstitutionName: "Frost Bank",
    routingNumberEntered: true,
    routingNumberMasked: `ending ${ROUTING.slice(-4)}`,
    accountNumberEntered: true,
    accountNumberMasked: `ending ${accountNumber.slice(-4)}`,
    allocationKind: null,
    allocationPercentage: null,
    allocationAmount: null,
    accountConfirmationMethod: "INDEPENDENT_SECOND_ENTRY",
    accountConfirmationRecordedAt: "2026-08-26T12:00:00.000Z",
  };
}

/** The governed subject is required by the contract in both states; nothing here renders it. */
function subject(): OnboardingExecutionSubject {
  return {
    moduleKey: "PAYROLL_PAYMENT",
    subjectKey: "WORKER_PAYMENT_AUTHORIZATION",
    title: "Your payroll payment authorization",
    requiredForm: "ELECTRONIC_SIGNATURE",
    content: {
      kind: "GOVERNED_TEXT",
      ref: "PAYROLL_PAYMENT_AUTHORIZATION",
      revision: "10C.1",
      ruleRevision: "10C.1",
      title: "Your payroll payment authorization",
      contentHash: "c".repeat(64),
      lines: [{ label: "I authorize.", field: null }],
    },
    current: null,
    history: [],
    requiresExecution: false,
  };
}

function executedStage(
  accounts: PayrollPaymentRecordedAccountView[],
): PayrollPaymentAuthorizationStage {
  return {
    review: null,
    available: false,
    blockers: ["ALREADY_AUTHORIZED"],
    guidance: [],
    authorization: subject(),
    executed: {
      paymentMethod: PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
      setVersion: 1,
      authorizedAt: "2026-09-01T15:00:00.000Z",
      effectiveFrom: "2026-09-01",
      accounts,
    },
  };
}

/** Watch console.error for one test, and give it back. Never installed globally. */
function watchConsoleError() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return {
    keyWarnings: () =>
      spy.mock.calls
        .map((call) => call.map(String).join(" "))
        .filter((message) => /unique ["'`]key["'`] prop|same key/i.test(message)),
    stop: () => spy.mockRestore(),
  };
}

async function showExecuted(
  accounts: PayrollPaymentRecordedAccountView[],
): Promise<HTMLElement> {
  vi.mocked(getOwnPayrollPaymentAuthorization).mockResolvedValue(
    executedStage(accounts),
  );
  const { container } = render(
    <PayrollPaymentAuthorization
      invocationId="inv-1"
      proposalToken="token-1"
      changeable
    />,
  );
  return await waitFor(() => {
    const section = container.querySelector<HTMLElement>(
      '[data-pp-authorize-state="EXECUTED"]',
    );
    if (!section) throw new Error("the recorded outcome has not rendered");
    return section;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Gate 10C - the recorded accounts render as a well-formed list", () => {
  /*
    FIRST TEST IN THE FILE ON PURPOSE. React's one-warning-per-component budget is unspent at this
    point, so if the list were keyed on something absent this is where it would be spent.
  */
  it("renders a one-account Direct Deposit outcome with NO React key warning", async () => {
    const watch = watchConsoleError();
    try {
      const done = await showExecuted([recordedAccount(1, ACCOUNT)]);

      // The list genuinely rendered; a warning-free run over an empty list proves nothing.
      expect(done.querySelectorAll("[data-pp-executed-account]")).toHaveLength(1);
      expect(watch.keyWarnings()).toEqual([]);
    } finally {
      watch.stop();
    }
  });

  it("renders MULTIPLE recorded accounts with unique keys and no warning", async () => {
    const watch = watchConsoleError();
    try {
      const done = await showExecuted([
        recordedAccount(1, ACCOUNT),
        recordedAccount(2, "9876543210"),
      ]);

      const positions = Array.from(
        done.querySelectorAll("[data-pp-executed-account]"),
      ).map((node) => node.getAttribute("data-pp-executed-account"));
      expect(positions).toEqual(["1", "2"]);
      expect(new Set(positions).size).toBe(positions.length);
      expect(watch.keyWarnings()).toEqual([]);
    } finally {
      watch.stop();
    }
  });

  it("identifies a row without any protected banking value", async () => {
    const done = await showExecuted([
      recordedAccount(1, ACCOUNT),
      recordedAccount(2, "9876543210"),
    ]);

    /*
      A key built from a routing or account number would have to put one there. Neither full value
      appears anywhere in the rendered markup, attributes included, so nothing protected is doing
      the work of identity.
    */
    expect(done.outerHTML).not.toContain(ACCOUNT);
    expect(done.outerHTML).not.toContain(ROUTING);
    for (const row of Array.from(
      done.querySelectorAll("[data-pp-executed-account]"),
    )) {
      for (const attribute of Array.from(row.attributes)) {
        expect(attribute.value).not.toContain(ACCOUNT);
        expect(attribute.value).not.toContain(ROUTING);
      }
    }
  });

  it("shows the worker the same masked outcome as before", async () => {
    const done = await showExecuted([recordedAccount(1, ACCOUNT)]);

    // The wording and the masking are untouched by the key correction.
    expect(done.textContent).toContain("Payroll Payment complete");
    expect(done.querySelector('[data-pp-outcome="DEPOSIT"]')?.textContent).toBe(
      "Your payroll payment instructions have been saved and are now in effect.",
    );
    const row = done.querySelector("[data-pp-executed-account]") as HTMLElement;
    expect(row.textContent).toContain("Frost Bank");
    expect(row.textContent).toContain(ACCOUNT.slice(-4));
  });
});
