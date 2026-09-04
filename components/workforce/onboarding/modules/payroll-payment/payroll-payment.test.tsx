/**
 * Module 4.4 Payroll Payment - the worker's own interview, through review.
 *
 * What this suite is answerable for:
 *
 *  - The module reaches the worker through the DELIVERED Phase 1 runtime, by registration, at the
 *    canonical URL. Nothing renders a second onboarding application.
 *  - He is offered BOTH approved ways of being paid, as equals, with neither pre-selected and
 *    neither recommended.
 *  - Choosing his own bank account opens the account interview; choosing the payroll card does not,
 *    and asks him for no bank details at all.
 *  - He can enter one account, add a second and a third, and CANNOT add a fourth.
 *  - Checking and Savings are the only kinds of account offered.
 *  - The routing number is checked arithmetically, once, with no second box.
 *  - THE ACCOUNT NUMBER IS TYPED TWICE, INDEPENDENTLY: paste, drop, copy and cut are refused on both
 *    boxes, and an insertion of more than one character at a time - which is what autofill, a drag
 *    and an extension-driven paste all look like - is refused too. The worker is told why.
 *  - A mismatch is explained in plain language and NEITHER ENTRY IS ECHOED.
 *  - The two allocation approaches are explained without an enum, only one can be chosen at a time,
 *    percentages are totalled for him, and the remainder is a shape in which "two of them" cannot be
 *    expressed.
 *  - Review shows MASKED banking values and nothing wider, for both methods.
 *  - He can leave an unfinished interview and resume it FROM THE SERVER's protected draft.
 *  - NOTHING IN THIS GATE AUTHORIZES, EXECUTES, ACTIVATES A CARD, ASSIGNS AN EFFECTIVE DATE OR
 *    COMPLETES THE MODULE. The runtime's completion call is never made, and there is no control that
 *    could make it.
 *  - Every governed refusal has a sentence, and no sentence carries a protected value.
 *  - NO PROTECTED BANKING VALUE IS WRITTEN TO BROWSER STORAGE, A COOKIE, A URL, THE CONSOLE, OR ANY
 *    ATTRIBUTE OF THE DOM.
 *
 * THE FAKE SERVER BELOW APPLIES THE GOVERNED RULES rather than echoing the request, because the
 * behaviours that matter are exactly the ones a naive echo would hide: the account-number comparison
 * being the SERVER's, the entry boxes coming back EMPTY behind a mask, bank details being dropped
 * when the worker moves to the card, and an unfinished proposal being reported with its broken rules
 * instead of refused.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import { PAYROLL_PAYMENT_WORKER_REFUSAL_CODES } from "@/lib/workforce/payrollPaymentApi";
import {
  payrollPaymentRefusalMessage,
  payrollPaymentViolationMessage,
} from "./payrollPaymentRefusal";
import type {
  PayrollPaymentAccountView,
  PayrollPaymentRecordedAccountView,
  PayrollPaymentAuthorization,
  PayrollPaymentAuthorizationBlocker,
  PayrollPaymentInterview,
  PayrollPaymentReview,
  PayrollPaymentViolation,
  SavePayrollPaymentAccountInput,
  SavePayrollPaymentInterviewInput,
} from "@/lib/workforce/payrollPaymentApi";
import type { OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";

const push = vi.fn();

/*
  [ADDED BY GATE 10C.] Two things a browser has and jsdom does not, both needed because the
  terminal act of this module is now a DRAWN signature rendered by the delivered shared capture
  surface. Copied from the delivered execution capture suite rather than invented, so what runs
  here is the same drawing path a worker's pointer runs.

  Without the first, the testing library degrades a pointer event to a bare Event carrying no
  coordinate, and every signature assertion below would pass while proving nothing was drawn.
*/
if (typeof window.PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: TestPointerEvent,
  });
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  writable: true,
  value: () => ({
    setTransform: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    strokeStyle: "",
  }),
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock("@/lib/workforce/onboardingRuntimeApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingRuntimeApi")>();
  return {
    ...actual,
    getOnboardingRuntime: vi.fn(),
    getRuntimeModuleDraft: vi.fn(),
    saveRuntimeModuleDraft: vi.fn(),
    getOnboardingPacket: vi.fn(),
    getOnboardingSession: vi.fn(),
  };
});

vi.mock("@/lib/workforce/onboardingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/onboardingApi")>();
  return { ...actual, completeOnboardingModule: vi.fn() };
});

vi.mock("@/lib/workforce/payrollPaymentApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/payrollPaymentApi")>();
  return {
    ...actual,
    getOwnPayrollPayment: vi.fn(),
    saveOwnPayrollPayment: vi.fn(),
    getOwnPayrollPaymentReview: vi.fn(),
    getOwnPayrollPaymentAuthorization: vi.fn(),
    authorizeOwnPayrollPayment: vi.fn(),
    /*
      [ADDED BY GATE 10C-E3 SLICE 4, AND ANSWERED `NOT_APPLICABLE` THROUGHOUT THIS SUITE, which is
      what the server actually says to every worker in it. Every scenario below is a worker
      stating his payroll instructions for the FIRST time in a hire packet - he is not being asked
      to verify a record already governing his pay, because there is none - so this suite goes on
      exercising exactly the journey it always exercised, and the assertions in it keep exactly the
      meanings they had. The verification journey is a different packet and a different situation,
      and it is proved in `payroll-payment.verification.test.tsx`.

      IT IS MOCKED RATHER THAN LEFT REAL because leaving it real would put a `fetch` in the middle
      of this suite. The default is set in `beforeEach` beside the other five.
    */
    getOwnPayrollPaymentVerification: vi.fn(),
    confirmOwnPayrollPaymentVerification: vi.fn(),
  };
});

const { getOnboardingRuntime, getRuntimeModuleDraft, saveRuntimeModuleDraft } =
  await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const {
  getOwnPayrollPayment,
  saveOwnPayrollPayment,
  getOwnPayrollPaymentReview,
  getOwnPayrollPaymentAuthorization,
  authorizeOwnPayrollPayment,
  getOwnPayrollPaymentVerification,
  PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS,
} = await import("@/lib/workforce/payrollPaymentApi");
const { OnboardingRuntimeProvider } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext"
);
const { default: OnboardingModuleHost } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingModuleHost"
);
const { resolveOnboardingModuleRenderer } = await import(
  "@/components/workforce/onboarding/runtime/moduleRegistry"
);
const { INVOCATION_ID, fixtureModule, fixturePacket, fixtureRuntime, step } = await import(
  "@/components/workforce/onboarding/runtime/runtimeTestFixtures"
);

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the worker layout imports it.
 * Nothing in this suite registers a renderer of its own, so what is exercised below is what ships.
 */
await import("./register.worker");

const MODULE_KEY = "PAYROLL_PAYMENT";
const MODULE_SLUG = "payroll-payment";
const STEP = "payment-method";

/** Wire tokens, spelled ONCE here so the assertions are about the wire and not about a constant. */
const BANK = "DIRECT_DEPOSIT";
const CARD = "COMDATA_PAYROLL_CARD";
const PERCENTAGE = "PERCENTAGE";
const FIXED = "FIXED_AMOUNT_REMAINDER";

/** Real values, used to prove they never come back and never reach the DOM. */
const ROUTING = "021000021";
const ROUTING_BAD_CHECKSUM = "021000022";
const ACCOUNT = "1234567890";
const OTHER_ACCOUNT = "1234567899";

/* -------------------------------------------------------------------------- */
/*  The fake server: the governed rules, applied                              */
/* -------------------------------------------------------------------------- */

type ServerAccount = {
  /** The server's stable identity for the account (QA-L4-R1). Minted here, never accepted. */
  accountId: string;
  position: number;
  accountType: string | null;
  financialInstitutionName: string;
  routingNumber: string;
  accountNumber: string;
  allocationKind: string | null;
  allocationPercentage: string | null;
  allocationAmount: string | null;
  confirmedAt: string | null;
};

let method: string | null = null;
let mode: string | null = null;
let accounts: ServerAccount[] = [];
let savedAt: string | null = null;
let minted = 0;

function resetServer(): void {
  method = null;
  mode = null;
  accounts = [];
  savedAt = null;
  minted = 0;
  authorizedAt = null;
}

/** Readable, opaque, and not derived from anything the worker can change. */
function mintAccountId(): string {
  minted += 1;
  return `acct-${minted}`;
}

/** A held account as the server would hold it, for a suite that starts mid-interview. */
function serverAccount(
  overrides: Partial<ServerAccount> & { position: number },
): ServerAccount {
  return {
    accountId: mintAccountId(),
    accountType: null,
    financialInstitutionName: "",
    routingNumber: "",
    accountNumber: "",
    allocationKind: null,
    allocationPercentage: null,
    allocationAmount: null,
    confirmedAt: null,
    ...overrides,
  };
}

class Refusal extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function mask(value: string): string {
  return `••••${value.replace(/\D/g, "").slice(-4)}`;
}

function checksumHolds(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = (at: number): number => Number(routing[at]);
  const total =
    3 * (d(0) + d(3) + d(6)) + 7 * (d(1) + d(4) + d(7)) + (d(2) + d(5) + d(8));
  return total % 10 === 0;
}

function hundredths(text: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** The rules, REPORTED rather than thrown, exactly as the interview service reports them. */
function violationsOf(): PayrollPaymentViolation[] {
  const found: PayrollPaymentViolation[] = [];
  if (method !== BANK) return found;

  if (accounts.length === 0) {
    found.push({ code: "DEPOSIT_ACCOUNT_REQUIRED", position: null, field: "accounts" });
  }
  if (mode === null) {
    found.push({ code: "ALLOCATION_MODE_REQUIRED", position: null, field: "allocationMode" });
  }

  for (const account of accounts) {
    if (account.accountType === null) {
      found.push({
        code: "ACCOUNT_TYPE_NOT_GOVERNED",
        position: account.position,
        field: "accountType",
      });
    }
    if (account.financialInstitutionName.trim() === "") {
      found.push({
        code: "FINANCIAL_INSTITUTION_REQUIRED",
        position: account.position,
        field: "financialInstitutionName",
      });
    }
    if (account.accountNumber === "" || account.confirmedAt === null) {
      found.push({
        code: "ACCOUNT_NUMBER_CONFIRMATION_REQUIRED",
        position: account.position,
        field: "accountNumber",
      });
    }
    // THE THREE ROUTING CONDITIONS, IN THE ORDER THE SERVER DECIDES THEM (owner ruling 10A-R1).
    // Absence first, and absence is of the RESOLVED account above - an omitted routing number on a
    // held account carried the stored value forward in `mergeAccount`, so it is not missing here.
    // The two validity codes describe a value that IS present and must not answer for one that
    // is not: telling a worker that the routing number he never entered is the wrong shape sends
    // him to check a field he has not filled in.
    if (account.routingNumber === "") {
      found.push({
        code: "ROUTING_NUMBER_REQUIRED",
        position: account.position,
        field: "routingNumber",
      });
    } else if (!/^\d{9}$/.test(account.routingNumber)) {
      found.push({
        code: "ROUTING_NUMBER_FORMAT_INVALID",
        position: account.position,
        field: "routingNumber",
      });
    } else if (!checksumHolds(account.routingNumber)) {
      found.push({
        code: "ROUTING_NUMBER_CHECKSUM_INVALID",
        position: account.position,
        field: "routingNumber",
      });
    }
  }

  if (mode === PERCENTAGE) {
    let total = 0;
    let sound = accounts.length > 0;
    for (const account of accounts) {
      if (account.allocationKind !== PERCENTAGE) sound = false;
      const value = hundredths(account.allocationPercentage ?? "");
      if (value === null) sound = false;
      else total += value;
    }
    if (!sound) {
      found.push({ code: "ALLOCATION_VALUE_INVALID", position: null, field: "allocation" });
    } else if (total !== 100_00) {
      found.push({ code: "PERCENTAGE_TOTAL_INVALID", position: null, field: "allocation" });
    }
  }

  if (mode === FIXED) {
    const remainders = accounts.filter(
      (account) => account.allocationKind === "REMAINING_BALANCE",
    );
    if (accounts.some((account) => account.allocationKind === PERCENTAGE)) {
      found.push({ code: "ALLOCATION_MODE_MIXED", position: null, field: "allocation" });
    }
    if (remainders.length === 0) {
      found.push({
        code: "REMAINING_BALANCE_ACCOUNT_REQUIRED",
        position: null,
        field: "allocation",
      });
    }
    if (remainders.length > 1) {
      found.push({
        code: "MULTIPLE_REMAINING_BALANCE_ACCOUNTS",
        position: null,
        field: "allocation",
      });
    }
    for (const account of accounts) {
      if (account.allocationKind !== "FIXED_AMOUNT") continue;
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(account.allocationAmount ?? "")) {
        found.push({
          code: "ALLOCATION_VALUE_INVALID",
          position: account.position,
          field: "allocationAmount",
        });
      }
    }
  }

  return found;
}

function accountViews(): PayrollPaymentAccountView[] {
  return accounts.map((account) => ({
    accountId: account.accountId,
    position: account.position,
    accountType: account.accountType as PayrollPaymentAccountView["accountType"],
    financialInstitutionName: account.financialInstitutionName,
    routingNumberEntered: account.routingNumber !== "",
    routingNumberMasked: account.routingNumber === "" ? null : mask(account.routingNumber),
    accountNumberEntered: account.accountNumber !== "",
    accountNumberMasked: account.accountNumber === "" ? null : mask(account.accountNumber),
    allocationKind: account.allocationKind as PayrollPaymentAccountView["allocationKind"],
    allocationPercentage: account.allocationPercentage,
    allocationAmount: account.allocationAmount,
    accountConfirmationMethod: account.confirmedAt ? "INDEPENDENT_SECOND_ENTRY" : null,
    accountConfirmationRecordedAt: account.confirmedAt,
  }));
}

/**
 * The accounts as they come back on a RECORDED outcome, which is NOT the interview's projection.
 *
 * THE MISSING `accountId` IS THE POINT AND MUST STAY MISSING. The recorded instruction is an
 * immutable version, so the server exposes no stable draft identifier on it - there is nothing to
 * echo back and nothing to carry forward. This fake used to hand back the interview's own account
 * views here, `accountId` and all, which made it strictly more generous than the real server: the
 * authorization screen keyed its list on a field that exists in this file and nowhere in a real
 * response, and every test passed while a real browser logged a React key warning. A fake that is
 * kinder than the server proves nothing, so this one is not.
 */
function recordedAccountViews(): PayrollPaymentRecordedAccountView[] {
  // Field by field rather than a spread minus one, so this is an object LITERAL: the excess-property
  // check then makes putting `accountId` back a compile error rather than a silent regression.
  return accountViews().map((account) => ({
    position: account.position,
    accountType: account.accountType,
    financialInstitutionName: account.financialInstitutionName,
    routingNumberEntered: account.routingNumberEntered,
    routingNumberMasked: account.routingNumberMasked,
    accountNumberEntered: account.accountNumberEntered,
    accountNumberMasked: account.accountNumberMasked,
    allocationKind: account.allocationKind,
    allocationPercentage: account.allocationPercentage,
    allocationAmount: account.allocationAmount,
    accountConfirmationMethod: account.accountConfirmationMethod,
    accountConfirmationRecordedAt: account.accountConfirmationRecordedAt,
  }));
}

function interviewView(): PayrollPaymentInterview {
  const violations = violationsOf();
  return {
    paymentMethod: method as PayrollPaymentInterview["paymentMethod"],
    allocationMode: mode as PayrollPaymentInterview["allocationMode"],
    accounts: accountViews(),
    maxDepositAccounts: 3,
    canAddAccount: method === BANK && accounts.length < 3,
    violations,
    readyForReview: method !== null && violations.length === 0,
    savedAt,
  };
}

/**
 * THE SERVER'S COMPARISON. Nothing the browser sends decides this.
 *
 * `held` is resolved by STABLE IDENTITY before this is called, never by position, because the fake
 * that resolved it by index is the one that let QA-L4-FUNC-2 through a green suite.
 */
function mergeAccount(
  submitted: SavePayrollPaymentAccountInput,
  held: ServerAccount | undefined,
  position: number,
): ServerAccount {
  const entry = (submitted.accountNumber ?? "").trim();
  const again = (submitted.accountNumberConfirmation ?? "").trim();
  let accountNumber = held?.accountNumber ?? "";
  let confirmedAt = held?.confirmedAt ?? null;

  // A new account has nothing to carry forward, so it establishes its own (QA-L4-R1).
  if (held === undefined || entry !== "" || again !== "") {
    if (entry === "" || again === "") {
      throw new Refusal("ACCOUNT_NUMBER_CONFIRMATION_REQUIRED");
    }
    if (entry !== again) throw new Refusal("ACCOUNT_NUMBER_CONFIRMATION_MISMATCH");
    accountNumber = entry;
    confirmedAt = "2026-08-26T12:00:00.000Z";
  }

  const routing = (submitted.routingNumber ?? "").trim();

  return {
    accountId: held?.accountId ?? mintAccountId(),
    position,
    accountType: submitted.accountType ?? held?.accountType ?? null,
    financialInstitutionName:
      submitted.financialInstitutionName ?? held?.financialInstitutionName ?? "",
    routingNumber: routing === "" ? (held?.routingNumber ?? "") : routing,
    accountNumber,
    allocationKind: submitted.allocationKind ?? held?.allocationKind ?? null,
    allocationPercentage: submitted.allocationPercentage ?? null,
    allocationAmount: submitted.allocationAmount ?? null,
    confirmedAt,
  };
}

/** Which held account a submitted row IS. Refused rather than guessed at (QA-L4-R1). */
function resolveHeld(
  submitted: SavePayrollPaymentAccountInput,
  held: readonly ServerAccount[],
  claimed: Set<string>,
): ServerAccount | undefined {
  const claim = (submitted.accountId ?? "").trim();
  if (claim === "") return undefined;
  if (claimed.has(claim)) throw new Refusal("DEPOSIT_ACCOUNT_DUPLICATED");
  const match = held.find((account) => account.accountId === claim);
  if (!match) throw new Refusal("DEPOSIT_ACCOUNT_NOT_RECOGNIZED");
  claimed.add(claim);
  return match;
}

function save(input: SavePayrollPaymentInterviewInput): PayrollPaymentInterview {
  if (input.paymentMethod !== undefined && input.paymentMethod !== null) {
    if (input.paymentMethod !== BANK && input.paymentMethod !== CARD) {
      throw new Refusal("PAYMENT_METHOD_NOT_GOVERNED");
    }
    if (input.paymentMethod !== method && input.paymentMethod === CARD) {
      // The card allocates nothing, so the bank details it had are dropped rather than kept.
      accounts = [];
      mode = null;
    }
    method = input.paymentMethod;
  }

  if (input.allocationMode !== undefined) mode = input.allocationMode ?? null;

  if (input.accounts !== undefined && input.accounts !== null) {
    if (method === CARD && input.accounts.length > 0) {
      throw new Refusal("ACCOUNTS_NOT_PERMITTED_FOR_METHOD");
    }
    if (input.accounts.length > PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS) {
      throw new Refusal("TOO_MANY_DEPOSIT_ACCOUNTS");
    }
    const held = accounts;
    const claimed = new Set<string>();
    accounts = input.accounts.map((submitted, index) =>
      mergeAccount(submitted, resolveHeld(submitted, held, claimed), index + 1),
    );
  }

  savedAt = "2026-08-26T12:00:00.000Z";
  return interviewView();
}

/* -------------------------------------------------------------------------- */
/*  Gate 10C: the authorization stage, as the server projects it               */
/* -------------------------------------------------------------------------- */

/**
 * THE SECURED OWNER-RATIFIED AUTHORIZATION STATEMENT, spelled out here in full.
 *
 * Written out rather than imported from the component or the client, deliberately. A test that
 * imported the sentence it is checking would agree with any wording the implementation happened to
 * hold, including a paraphrase - which is the one thing that must never pass. This is the wording
 * as governance ratified it, and it is the only wording that satisfies these assertions.
 */
const AUTHORIZATION_STATEMENT =
  "I authorize Millwrights4Hire to use the payroll payment information I provided to pay wages " +
  "owed to me using the payment method I selected. I confirm that the information I provided is " +
  "accurate and that I am authorized to use the account identified above. I understand that I " +
  "can later request a change to my payroll payment instructions.";

const AUTHORIZATION_REVISION = "10C.1";
const AUTHORIZATION_HASH = "c".repeat(64);

/** Server-side truth about the act: set only when the fake server records one. */
let authorizedAt: string | null = null;

function authorizationSubject(): OnboardingExecutionSubject {
  const done = authorizedAt !== null;
  return {
    moduleKey: MODULE_KEY,
    subjectKey: "WORKER_PAYMENT_AUTHORIZATION",
    title: "Your payroll payment authorization",
    requiredForm: "ELECTRONIC_SIGNATURE",
    content: {
      kind: "GOVERNED_TEXT",
      ref: "PAYROLL_PAYMENT_AUTHORIZATION",
      revision: AUTHORIZATION_REVISION,
      ruleRevision: AUTHORIZATION_REVISION,
      title: "Your payroll payment authorization",
      contentHash: AUTHORIZATION_HASH,
      lines: [{ label: AUTHORIZATION_STATEMENT, field: null }],
    },
    current: done
      ? {
          executionId: "exec-payroll-1",
          moduleKey: MODULE_KEY,
          subjectKey: "WORKER_PAYMENT_AUTHORIZATION",
          executionForm: "ELECTRONIC_SIGNATURE",
          executedContent: {
            kind: "GOVERNED_TEXT",
            ref: "PAYROLL_PAYMENT_AUTHORIZATION",
            revision: AUTHORIZATION_REVISION,
            ruleRevision: AUTHORIZATION_REVISION,
            contentHash: AUTHORIZATION_HASH,
          },
          evidenceKind: "NATIVE_CAPTURE",
          evidence: null,
          executedAt: authorizedAt as string,
          supersededAt: null,
          supersedesId: null,
        }
      : null,
    history: [],
    requiresExecution: !done,
  };
}

/**
 * The stage as the server would build it: available only when the proposal is admissible and the
 * worker has not already signed.
 */
function authorizationView(): PayrollPaymentAuthorization {
  const ready = violationsOf().length === 0 && method !== null;
  const blockers: PayrollPaymentAuthorizationBlocker[] = [];
  if (authorizedAt !== null) blockers.push("ALREADY_AUTHORIZED");
  else if (!ready) blockers.push("PROPOSAL_NOT_REVIEW_READY");

  return {
    review: ready ? reviewView() : null,
    available: blockers.length === 0,
    blockers,
    guidance: [
      "This is the last step. Up to now, what you told us has only been saved. Signing here puts your payroll payment instructions in force.",
      "If your details change later, you can tell us and we will record new instructions. We keep what you signed before, exactly as you signed it.",
    ],
    authorization: authorizationSubject(),
    executed:
      authorizedAt === null
        ? null
        : {
            paymentMethod: method as PayrollPaymentReview["paymentMethod"],
            setVersion: 1,
            authorizedAt,
            effectiveFrom: "2026-09-01",
            accounts: recordedAccountViews(),
          },
  };
}

/** Record the act the way the server does: only if it is open, and once. */
function authorize(): PayrollPaymentAuthorization {
  if (authorizedAt !== null) throw new Refusal("ALREADY_AUTHORIZED");
  if (violationsOf().length > 0 || method === null) {
    throw new Refusal("PROPOSAL_NOT_REVIEW_READY");
  }
  authorizedAt = "2026-09-01T15:00:00.000Z";
  return authorizationView();
}

function reviewView(): PayrollPaymentReview {
  const confirmed =
    accounts.length > 0 && accounts.every((account) => account.confirmedAt !== null);
  return {
    paymentMethod: method as PayrollPaymentReview["paymentMethod"],
    allocationMode: mode as PayrollPaymentReview["allocationMode"],
    accounts: accountViews(),
    accountConfirmationMethod: confirmed ? "INDEPENDENT_SECOND_ENTRY" : null,
    authorized: false,
    moduleComplete: false,
  };
}

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

function payrollModule(overrides: Record<string, unknown> = {}) {
  return fixtureModule({
    moduleKey: MODULE_KEY,
    moduleNumber: "4.4",
    title: "Payroll Payment",
    moduleSlug: MODULE_SLUG,
    completionGranularity: "EFFECTIVE_RECORD",
    steps: [step(STEP, "Payment method")],
    resumeStepSlug: STEP,
    ...overrides,
  });
}

/**
 * Render the module the way the worker reaches it, and WAIT FOR THE MODULE ITSELF.
 *
 * Waiting for the module's own method question rather than for a heading, deliberately: the runtime
 * frame renders its step title before the capsule has read anything, so a suite that waited on text
 * would go on to assert against a half-loaded screen and would report the capsule as broken when it
 * was merely not there yet.
 */
async function open(overrides: Record<string, unknown> = {}): Promise<void> {
  vi.mocked(getOnboardingRuntime).mockResolvedValue(
    fixtureRuntime({ packets: [fixturePacket({ modules: [payrollModule(overrides)] })] }),
  );
  render(
    <OnboardingRuntimeProvider>
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug={MODULE_SLUG}
        stepSlug={STEP}
      />
    </OnboardingRuntimeProvider>,
  );
  await waitFor(() =>
    expect(document.querySelector("[data-pp-method-choice]")).not.toBeNull(),
  );
}

/** The module's own section, so a scan cannot read the surrounding runtime frame as the module. */
function capsule(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".pp-module");
  if (!section) throw new Error("The module did not render.");
  return section;
}

function field(name: string, within: HTMLElement = capsule()): HTMLInputElement {
  const input = within.querySelector<HTMLInputElement>(`[data-pp-field="${name}"]`);
  if (!input) throw new Error(`No field ${name}.`);
  return input;
}

function accountCard(position: number): HTMLElement {
  const card = capsule().querySelector<HTMLElement>(`[data-pp-account="${position}"]`);
  if (!card) throw new Error(`No account ${position}.`);
  return card;
}

function action(name: string): HTMLElement {
  const button = capsule().querySelector<HTMLElement>(`[data-pp-action="${name}"]`);
  if (!button) throw new Error(`No ${name} control.`);
  return button;
}

/** Click the remove control on an account, which now ASKS rather than removes (QA-L4-UX-6). */
function askToRemove(position: number): void {
  const remove = accountCard(position).querySelector<HTMLElement>(
    `[data-pp-remove-account="${position}"]`,
  );
  if (!remove) throw new Error(`No remove control on account ${position}.`);
  fireEvent.click(remove);
}

/** The removal question, or null when nothing is being asked. */
function removePrompt(): HTMLElement | null {
  return capsule().querySelector<HTMLElement>("[data-pp-remove-prompt]");
}

/**
 * Move into a box, and move on from it, the way clicking and tabbing do.
 *
 * BOTH THE NATIVE CALL AND THE BUBBLING EVENT, deliberately: React listens for `focusin` and
 * `focusout` rather than for `focus` and `blur`, and jsdom's own focus handling is not identical to
 * a browser's. Sending both is what makes these two helpers mean "he moved on from this box" here
 * as well as in front of a person.
 */
function moveOnFrom(input: HTMLInputElement): void {
  input.blur();
  fireEvent.focusOut(input);
}

function moveInto(input: HTMLInputElement): void {
  input.focus();
  fireEvent.focusIn(input);
}

function chooseMethod(which: "bank" | "card"): void {
  const label = capsule().querySelector<HTMLElement>(`[data-pp-choice="${which}"] input`);
  if (!label) throw new Error("No method control.");
  fireEvent.click(label);
}

/** Type a value one character at a time, which is what a person does. */
function typeInto(input: HTMLInputElement, value: string): void {
  let held = "";
  for (const character of value) {
    held += character;
    fireEvent.change(input, { target: { value: held } });
  }
}

async function enterAccount(
  position: number,
  values: {
    institution?: string;
    type?: "CHECKING" | "SAVINGS";
    routing?: string;
    account?: string;
    confirmation?: string;
  },
): Promise<void> {
  const card = accountCard(position);
  if (values.institution !== undefined) {
    fireEvent.change(field("institution", card), {
      target: { value: values.institution },
    });
  }
  if (values.type) {
    const radio = card.querySelector<HTMLInputElement>(
      `[data-pp-account-type="${values.type}"] input`,
    );
    if (!radio) throw new Error("No account type control.");
    fireEvent.click(radio);
  }
  if (values.routing !== undefined) {
    typeInto(field("routing", card), values.routing);
  }
  if (values.account !== undefined) {
    typeInto(field("account", card), values.account);
  }
  if (values.confirmation !== undefined) {
    typeInto(field("account-confirm", card), values.confirmation);
  }
}

beforeEach(() => {
  resetServer();
  vi.clearAllMocks();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({ values: {} } as never);
  vi.mocked(saveRuntimeModuleDraft).mockResolvedValue({ values: {} } as never);
  vi.mocked(getOwnPayrollPayment).mockImplementation(async () => interviewView());
  vi.mocked(saveOwnPayrollPayment).mockImplementation(async (_id, input) => save(input));
  vi.mocked(getOwnPayrollPaymentReview).mockImplementation(async () => reviewView());
  vi.mocked(getOwnPayrollPaymentAuthorization).mockImplementation(async () =>
    authorizationView(),
  );
  vi.mocked(authorizeOwnPayrollPayment).mockImplementation(async () => authorize());
  // Nobody in this suite is being asked to verify a record already in force. See the mock above.
  vi.mocked(getOwnPayrollPaymentVerification).mockImplementation(async () => ({
    state: "NOT_APPLICABLE",
    instructionId: null,
    instruction: null,
    evaluatedAt: new Date().toISOString(),
  }));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/* -------------------------------------------------------------------------- */

describe("Module 4.4 - how the worker gets paid", () => {
  describe("it reaches him through the delivered runtime", () => {
    it("registers ONE renderer, under the module key, and the runtime renders it", async () => {
      expect(resolveOnboardingModuleRenderer(MODULE_KEY)).toBeTypeOf("function");
      await open();
      // The owner's heading for this screen, and the module's only one - so this asserts both that
      // the runtime rendered the capsule and that it is titled what he ruled it should be.
      const heading = screen.getByText("Payroll Distribution");
      expect(heading.tagName).toBe("H2");
      expect(heading.classList.contains("pp-title")).toBe(true);
      expect(screen.queryByText(/How you get paid/i)).toBeNull();
    });

    it("does not register a renderer for anything else", () => {
      expect(resolveOnboardingModuleRenderer("PAYROLL_PAYMENT_ADMIN")).toBeUndefined();
    });
  });

  describe("the two ways of being paid", () => {
    it("offers BOTH, with neither pre-selected and neither recommended", async () => {
      await open();

      expect(screen.getByText("Direct Deposit")).toBeTruthy();
      expect(screen.getByText("MW4H Comdata Payroll Card")).toBeTruthy();

      for (const which of ["bank", "card"]) {
        const radio = capsule().querySelector<HTMLInputElement>(
          `[data-pp-choice="${which}"] input`,
        );
        expect(radio?.checked).toBe(false);
      }
      // Neither is called recommended, best, usual or fastest anywhere on the screen.
      expect(capsule().textContent).not.toMatch(
        /recommend|we suggest|most (workers|people)|best option|fastest way/i,
      );
    });

    it("tells him a bank account is not needed, because for one choice it is not", async () => {
      await open();
      expect(capsule().textContent).toMatch(/do not need a bank account/i);
    });

    it("asks for NO bank detail when he chooses the payroll card", async () => {
      await open();
      chooseMethod("card");

      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-details]")).toBeNull(),
      );
      expect(capsule().querySelector('[data-pp-field="routing"]')).toBeNull();
      expect(capsule().querySelector('[data-pp-field="account"]')).toBeNull();
    });

    it("opens the account interview when he chooses his own bank account", async () => {
      await open();
      chooseMethod("bank");

      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(field("routing", accountCard(1))).toBeTruthy();
    });

    it("drops the bank details he had entered if he moves to the card", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      chooseMethod("card");
      await waitFor(() => expect(accounts).toHaveLength(0));
      expect(capsule().querySelector("[data-pp-details]")).toBeNull();
    });
  });

  describe("the account interview", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("offers exactly Checking and Savings, and nothing else", () => {
      const kinds = Array.from(
        accountCard(1).querySelectorAll("[data-pp-account-type]"),
      ).map((node) => node.getAttribute("data-pp-account-type"));
      expect(kinds).toEqual(["CHECKING", "SAVINGS"]);
      expect(accountCard(1).textContent).toMatch(/Checking account/);
      expect(accountCard(1).textContent).toMatch(/Savings account/);
    });

    it("says where to find a routing number rather than assuming he knows", () => {
      expect(accountCard(1).textContent).toMatch(/bottom left of your checks/i);
    });

    it("catches a routing number no bank can have, arithmetically and at once", async () => {
      await enterAccount(1, { routing: ROUTING_BAD_CHECKSUM });
      expect(
        accountCard(1).querySelector("[data-pp-routing-invalid]"),
      ).not.toBeNull();
      expect(accountCard(1).textContent).toMatch(/one of the digits is probably wrong/i);
      // And it never claims the bank itself was found or checked.
      expect(capsule().textContent).not.toMatch(/verified|we found your bank|confirmed with/i);
    });

    it("accepts a routing number whose check digit holds, with no second box for it", async () => {
      await enterAccount(1, { routing: ROUTING });
      expect(accountCard(1).querySelector("[data-pp-routing-invalid]")).toBeNull();
      // ONE routing box. A second entry for it is not required and is not offered (10-R3).
      expect(accountCard(1).querySelectorAll('[data-pp-field="routing"]')).toHaveLength(1);
    });

    it("says the bank's name is his to state, not something we checked", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));
      await waitFor(() => expect(getOwnPayrollPaymentReview).toHaveBeenCalled());
      expect(
        capsule().querySelector("[data-pp-review-institution-source]")?.textContent,
      ).toMatch(/have not checked it with the bank/i);
    });
  });

  describe("the account number is typed twice, INDEPENDENTLY", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("asks for it twice, and says why", () => {
      expect(field("account", accountCard(1))).toBeTruthy();
      expect(field("account-confirm", accountCard(1))).toBeTruthy();
      expect(accountCard(1).textContent).toMatch(/type the account number again/i);
      expect(accountCard(1).textContent).toMatch(
        /catch a wrong digit before payday/i,
      );
    });

    it("REFUSES A PASTE into the confirmation box, and says why", () => {
      const confirm = field("account-confirm", accountCard(1));
      const pasted = fireEvent.paste(confirm, {
        clipboardData: { getData: () => ACCOUNT },
      });

      // The default action was prevented, so nothing was pasted.
      expect(pasted).toBe(false);
      expect(confirm.value).toBe("");
      expect(accountCard(1).querySelector("[data-pp-entry-blocked]")).not.toBeNull();
      expect(accountCard(1).textContent).toMatch(/rather than pasting it/i);
    });

    it("refuses a paste into the FIRST box too, so there is less to copy from", () => {
      const first = field("account", accountCard(1));
      expect(fireEvent.paste(first, { clipboardData: { getData: () => ACCOUNT } })).toBe(
        false,
      );
      expect(first.value).toBe("");
    });

    it("refuses copy and cut, so the value cannot be lifted out of either box", async () => {
      await enterAccount(1, { account: ACCOUNT });
      const first = field("account", accountCard(1));
      expect(first.value).toBe(ACCOUNT);
      expect(fireEvent.copy(first)).toBe(false);
      expect(fireEvent.cut(first)).toBe(false);
      expect(fireEvent.copy(field("account-confirm", accountCard(1)))).toBe(false);
    });

    it("refuses a drop, which is a paste by another route", () => {
      expect(fireEvent.drop(field("account-confirm", accountCard(1)))).toBe(false);
      expect(field("account-confirm", accountCard(1)).value).toBe("");
    });

    /**
     * AUTOFILL, AND EVERY OTHER MACHINE THAT FILLS A BOX AT ONCE.
     *
     * This is the assertion that actually catches autofill, because autofill raises no paste event:
     * a browser, an extension or a password manager sets the whole value in one change, and a person
     * cannot. It is written as a property of the CHANGE rather than as trust in `autoComplete`,
     * which browsers respect unevenly.
     */
    it("refuses a whole value arriving in ONE change, which is what autofill looks like", () => {
      const confirm = field("account-confirm", accountCard(1));
      fireEvent.change(confirm, { target: { value: ACCOUNT } });

      expect(confirm.value).toBe("");
      expect(accountCard(1).querySelector("[data-pp-entry-blocked]")).not.toBeNull();
    });

    it("refuses both boxes being filled at once by the same route", () => {
      fireEvent.change(field("account", accountCard(1)), {
        target: { value: ACCOUNT },
      });
      fireEvent.change(field("account-confirm", accountCard(1)), {
        target: { value: ACCOUNT },
      });
      expect(field("account", accountCard(1)).value).toBe("");
      expect(field("account-confirm", accountCard(1)).value).toBe("");
    });

    it("turns autofill away at the attribute level as well", () => {
      for (const name of ["account", "account-confirm"]) {
        expect(field(name, accountCard(1)).getAttribute("autocomplete")).toBe("off");
      }
    });

    it("lets him type it, and lets him delete a selection in one go", async () => {
      const confirm = field("account-confirm", accountCard(1));
      typeInto(confirm, ACCOUNT);
      expect(confirm.value).toBe(ACCOUNT);
      // A worker who selects the lot and starts again is doing what we asked him to do.
      fireEvent.change(confirm, { target: { value: "" } });
      expect(confirm.value).toBe("");
    });

    it("tells him the two do not match while he types, WITHOUT echoing either", async () => {
      await enterAccount(1, { account: ACCOUNT, confirmation: OTHER_ACCOUNT });
      const notice = accountCard(1).querySelector("[data-pp-confirm-differs]");
      expect(notice).not.toBeNull();
      expect(notice?.textContent).not.toMatch(/\d{4,}/);
    });

    /**
     * THE COMPARISON IS THE SERVER'S. This is the assertion that says so: the browser sends the two
     * entries as two values, sends NO verdict about them, and the refusal comes back from the
     * server.
     */
    it("sends BOTH entries and NO verdict, and lets the server refuse the mismatch", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: OTHER_ACCOUNT,
      });
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(
          capsule().querySelector(
            '[data-pp-refusal="ACCOUNT_NUMBER_CONFIRMATION_MISMATCH"]',
          ),
        ).not.toBeNull(),
      );

      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      const account = sent?.accounts?.[0];
      expect(account?.accountNumber).toBe(ACCOUNT);
      expect(account?.accountNumberConfirmation).toBe(OTHER_ACCOUNT);
      // No verdict travels. A browser cannot assert the outcome of a comparison it did not run.
      expect(Object.keys(account ?? {})).not.toContain("confirmed");
      expect(JSON.stringify(sent)).not.toMatch(/"confirmed"|"matched"|"verified"/);

      // And the worker's sentence carries neither value.
      const said = capsule().querySelector("[data-pp-refusal]")?.textContent ?? "";
      expect(said).toMatch(/not the same/i);
      expect(said).not.toContain(ACCOUNT);
      expect(said).not.toContain(OTHER_ACCOUNT);
      expect(said).not.toMatch(/\d{4,}/);
    });

    it("records the server's confirmation, and never shows the number again", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));

      await waitFor(() => expect(accounts[0]?.confirmedAt).not.toBeNull());
      // The boxes are emptied on success: the typed values have served their only purpose.
      await waitFor(() => expect(field("account", accountCard(1)).value).toBe(""));
      expect(field("account-confirm", accountCard(1)).value).toBe("");
      expect(accountCard(1).textContent).toMatch(/••••7890/);
      expect(accountCard(1).textContent).not.toContain(ACCOUNT);
    });
  });

  describe("up to three accounts, and no more", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("lets him add a second and a third", async () => {
      fireEvent.click(action("add-account"));
      expect(accountCard(2)).toBeTruthy();
      fireEvent.click(action("add-account"));
      expect(accountCard(3)).toBeTruthy();
    });

    it("STOPS OFFERING a fourth, and says why", () => {
      fireEvent.click(action("add-account"));
      fireEvent.click(action("add-account"));

      expect(capsule().querySelector('[data-pp-action="add-account"]')).toBeNull();
      expect(capsule().querySelector("[data-pp-account-ceiling]")).not.toBeNull();
      expect(capsule().textContent).toMatch(/up to 3 accounts/i);
      expect(capsule().querySelector('[data-pp-account="4"]')).toBeNull();
    });

    it("never sends more than three, whatever the screen shows", async () => {
      fireEvent.click(action("add-account"));
      fireEvent.click(action("add-account"));
      fireEvent.click(action("save"));

      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      expect(sent?.accounts?.length).toBeLessThanOrEqual(3);
    });

    it("lets him remove one once there is more than one, once he has confirmed it", () => {
      expect(accountCard(1).querySelector("[data-pp-remove-account]")).toBeNull();
      fireEvent.click(action("add-account"));
      expect(
        accountCard(2).querySelector('[data-pp-remove-account="2"]'),
      ).not.toBeNull();

      askToRemove(2);
      fireEvent.click(action("remove-confirm"));
      expect(capsule().querySelector('[data-pp-account="2"]')).toBeNull();
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  Removing an account - owner ruling QA-L4-R1, defect QA-L4-FUNC-2         */
  /* ------------------------------------------------------------------------ */

  describe("removing an account leaves the others' banking details alone", () => {
    const A_ACCOUNT = "1111222233";
    const B_ACCOUNT = "4444555566";
    const C_ACCOUNT = "7777888899";
    /**
     * Three DIFFERENT routing numbers, so a routing swap cannot hide behind a shared one.
     *
     * QA-L4 used ONE routing number for all three accounts, which is exactly why the routing half
     * of the misassociation was invisible on the screen that exposed the account-number half. Each
     * satisfies the 3-7-1 arithmetic honestly while the `999` prefix lies outside every assigned
     * ABA range, so none of them can name a real financial institution.
     */
    const A_ROUTING = "999000001";
    const B_ROUTING = "999007020";
    const C_ROUTING = "999000700";

    /**
     * THE EXACT REAL-BROWSER SEQUENCE THAT CORRUPTED A QA DRAFT.
     *
     * Three accounts, each with its own routing number, its own account number and its own
     * confirmation, saved. What the worker then holds on screen is three masks and six empty entry
     * boxes, which is why the save that follows a removal resends no protected value at all.
     */
    async function saveThreeAccounts(): Promise<void> {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "QA Test Bank",
        type: "CHECKING",
        routing: A_ROUTING,
        account: A_ACCOUNT,
        confirmation: A_ACCOUNT,
      });

      fireEvent.click(action("add-account"));
      await enterAccount(2, {
        institution: "QA Savings Bank",
        type: "SAVINGS",
        routing: B_ROUTING,
        account: B_ACCOUNT,
        confirmation: B_ACCOUNT,
      });

      fireEvent.click(action("add-account"));
      await enterAccount(3, {
        institution: "QA Third Bank",
        type: "CHECKING",
        routing: C_ROUTING,
        account: C_ACCOUNT,
        confirmation: C_ACCOUNT,
      });

      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(3));
      // AND WAIT FOR THE BROWSER, not only for the server. `accounts` is set inside the fake save
      // before the screen has taken the response, so a test that carried on here would be acting
      // on a screen with a re-render still pending - and would sometimes click a node that had
      // already been replaced, which is a flake rather than a finding.
      await waitFor(() => expect(field("account", accountCard(3)).value).toBe(""));
      await waitFor(() => expect(accountCard(3).textContent).toMatch(/••••8899/));
    }

    /**
     * Remove an account the way the worker now has to: ask, then mean it (QA-L4-UX-6).
     *
     * The confirmation is part of removal from here on, so it belongs in the helper rather than in
     * each of the identity assertions below. What those assertions are about has not changed.
     */
    async function removeAccountAt(position: number): Promise<void> {
      askToRemove(position);
      await waitFor(() => expect(removePrompt()).not.toBeNull());
      fireEvent.click(action("remove-confirm"));
      await waitFor(() => expect(removePrompt()).toBeNull());
    }

    /** What the last save actually put on the wire. */
    function lastSent(): SavePayrollPaymentInterviewInput | undefined {
      return vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
    }

    it("sends the SURVIVORS' identities and not the removed account's", async () => {
      await saveThreeAccounts();
      const [a, b, c] = accounts.map((account) => account.accountId);

      await removeAccountAt(2);
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      const sent = lastSent();
      expect(sent?.accounts?.map((account) => account.accountId)).toEqual([a, c]);
      expect(JSON.stringify(sent)).not.toContain(b);
      // Identity did not get renumbered along with the display order.
      expect(sent?.accounts?.map((account) => account.position)).toEqual([1, 2]);
      // And no protected value was resent, because the browser no longer holds one.
      for (const account of sent?.accounts ?? []) {
        expect(account.accountNumber).toBeUndefined();
        expect(account.accountNumberConfirmation).toBeUndefined();
        expect(account.routingNumber).toBeUndefined();
      }
    });

    it("KEEPS THE SURVIVING ACCOUNT'S OWN banking details, which is the defect", async () => {
      await saveThreeAccounts();
      const [a, , c] = accounts.map((account) => account.accountId);

      await removeAccountAt(2);
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      // On the server: the third account is still the third account's, under its own identity.
      expect(accounts.map((account) => account.accountId)).toEqual([a, c]);
      expect(accounts[1].financialInstitutionName).toBe("QA Third Bank");
      expect(accounts[1].accountNumber).toBe(C_ACCOUNT);
      expect(accounts[1].routingNumber).toBe(C_ROUTING);
      expect(accounts[0].accountNumber).toBe(A_ACCOUNT);
      expect(accounts[0].routingNumber).toBe(A_ROUTING);
      // Nothing belonging to the removed account survived anywhere.
      expect(accounts.some((account) => account.accountNumber === B_ACCOUNT)).toBe(false);
      expect(accounts.some((account) => account.routingNumber === B_ROUTING)).toBe(false);

      // And on the SCREEN, which is where QA read the wrong tail: the surviving card shows its
      // own masked tail rather than the removed account's.
      await waitFor(() => expect(capsule().querySelector('[data-pp-account="2"]')).not.toBeNull());
      expect(accountCard(2).textContent).toMatch(/••••8899/);
      expect(accountCard(2).textContent).not.toMatch(/••••5566/);
      expect(accountCard(1).textContent).toMatch(/••••2233/);
      // The routing tail too, which QA could not see because all three shared one routing number.
      expect(accountCard(2).textContent).toMatch(/••••0700/);
      expect(accountCard(2).textContent).not.toMatch(/••••7020/);
    });

    /**
     * AND NO SURVIVOR IS ASKED FOR A ROUTING NUMBER IT ALREADY HAS (owner ruling 10A-R1).
     *
     * The save after a removal resends no protected value and renumbers the surviving rows from
     * one, which is exactly the request a routing-presence rule reading the request body would have
     * refused for every account at once. Both survivors keep their own routing number, so neither
     * is missing one and neither acquired the removed account's.
     */
    it("asks no survivor for the routing number it already has", async () => {
      await saveThreeAccounts();
      await removeAccountAt(2);
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      // Nothing was resent, and nothing is reported missing.
      for (const account of lastSent()?.accounts ?? []) {
        expect(account.routingNumber).toBeUndefined();
      }
      expect(violationsOf().map((violation) => violation.code)).not.toContain(
        "ROUTING_NUMBER_REQUIRED",
      );
      expect(
        capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
      ).toBeNull();

      // Each survivor's OWN routing number, so nothing moved by position to make that true.
      await waitFor(() => expect(accountCard(2).textContent).toMatch(/••••0700/));
      expect(accountCard(1).textContent).toMatch(/••••0001/);
      expect(capsule().textContent).not.toMatch(/••••7020/);
      // Neither card is being told to enter a routing number it has.
      expect(accountCard(1).querySelector("[data-pp-routing-required]")).toBeNull();
      expect(accountCard(2).querySelector("[data-pp-routing-required]")).toBeNull();
    });

    it("adopts the returned masks BY IDENTITY, not by their place in the response", async () => {
      await saveThreeAccounts();

      await removeAccountAt(2);
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      // The server answers in the order it was asked, so a positional reader would look right
      // here. This asserts the stronger property: reverse the response and the rows still take
      // their own accounts, because they are matched by the identity they hold.
      vi.mocked(saveOwnPayrollPayment).mockImplementationOnce(async (_id, input) => {
        const value = save(input);
        return { ...value, accounts: [...value.accounts].reverse() };
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalledTimes(4));

      await waitFor(() => expect(accountCard(1).textContent).toMatch(/••••2233/));
      expect(accountCard(2).textContent).toMatch(/••••8899/);
    });

    it("keeps identity when the FIRST account is removed", async () => {
      await saveThreeAccounts();
      const [, b, c] = accounts.map((account) => account.accountId);

      await removeAccountAt(1);
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      expect(accounts.map((account) => account.accountId)).toEqual([b, c]);
      expect(accounts.map((account) => account.position)).toEqual([1, 2]);
      expect(accounts[0].accountNumber).toBe(B_ACCOUNT);
      expect(accounts[0].routingNumber).toBe(B_ROUTING);
      expect(accounts[1].accountNumber).toBe(C_ACCOUNT);
      expect(accounts[1].routingNumber).toBe(C_ROUTING);
      expect(accounts.some((account) => account.accountNumber === A_ACCOUNT)).toBe(false);
    });

    it("keeps identity when the LAST account is removed", async () => {
      await saveThreeAccounts();
      const [a, b] = accounts.map((account) => account.accountId);

      await removeAccountAt(3);
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      expect(accounts.map((account) => account.accountId)).toEqual([a, b]);
      expect(accounts[0].accountNumber).toBe(A_ACCOUNT);
      expect(accounts[1].accountNumber).toBe(B_ACCOUNT);
      expect(accounts.some((account) => account.accountNumber === C_ACCOUNT)).toBe(false);
    });

    /**
     * A NEW ROW NAMES NOTHING UNTIL THE SERVER HAS NAMED IT.
     *
     * This is the other half of the identity contract: a row this browser invented cannot claim an
     * identity, because the only identities that exist belong to accounts that already have
     * protected values. It sends none, supplies its own account number, and adopts the identity it
     * is given.
     */
    it("sends NO identity for an account the server has never seen, then adopts the one it gets", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "QA Test Bank",
        type: "CHECKING",
        routing: A_ROUTING,
        account: A_ACCOUNT,
        confirmation: A_ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));
      const a = accounts[0].accountId;

      fireEvent.click(action("add-account"));
      await enterAccount(2, {
        institution: "QA Savings Bank",
        type: "SAVINGS",
        routing: B_ROUTING,
        account: B_ACCOUNT,
        confirmation: B_ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(2));

      const sent = lastSent();
      // The held account named itself; the new one did not, and could not.
      expect(sent?.accounts?.[0]?.accountId).toBe(a);
      expect(sent?.accounts?.[1]?.accountId).toBeUndefined();
      // The held account resent no protected value; the new one had to supply its own.
      expect(sent?.accounts?.[0]?.accountNumber).toBeUndefined();
      expect(sent?.accounts?.[1]?.accountNumber).toBe(B_ACCOUNT);

      // The new row then adopts the identity it was given, so its NEXT save names it.
      await enterAccount(2, { institution: "QA Savings Bank NA" });
      fireEvent.click(action("save"));
      await waitFor(() =>
        expect(accounts[1]?.financialInstitutionName).toBe("QA Savings Bank NA"),
      );
      expect(lastSent()?.accounts?.[1]?.accountId).toBe(accounts[1].accountId);
      expect(accounts[1].accountNumber).toBe(B_ACCOUNT);
      expect(accounts[1].routingNumber).toBe(B_ROUTING);
    });

    it("never puts an account identity where a banking value could be read from it", async () => {
      await saveThreeAccounts();

      // The identifier is opaque: it is not any part of a routing or account number, and it is
      // not the position dressed up as an identifier.
      for (const account of accounts) {
        for (const value of [A_ACCOUNT, B_ACCOUNT, C_ACCOUNT, A_ROUTING, B_ROUTING, C_ROUTING]) {
          expect(account.accountId).not.toContain(value.slice(-4));
        }
      }
      // And no banking value reached the DOM alongside it.
      expect(capsule().outerHTML).not.toContain(A_ACCOUNT);
      expect(capsule().outerHTML).not.toContain(C_ROUTING);
    });

    /* ---------------------------------------------------------------------- */
    /*  And he is asked first - QA-L4-UX-6                                     */
    /* ---------------------------------------------------------------------- */

    describe("and he is asked before any of it happens", () => {
      it("ASKS, and removes nothing at all, on the first click", async () => {
        await saveThreeAccounts();

        askToRemove(2);

        // Nothing has gone anywhere, on the screen or on the server.
        expect(capsule().querySelectorAll("[data-pp-account]")).toHaveLength(3);
        expect(accounts).toHaveLength(3);

        const prompt = removePrompt();
        expect(prompt).not.toBeNull();
        expect(prompt?.textContent).toMatch(/Remove this bank account\?/i);

        // A dialog a keyboard can use, landing on the answer that loses nothing.
        const dialog = prompt?.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        expect(document.activeElement).toBe(action("remove-cancel"));
      });

      it("names the account HE POINTED AT, and no other", async () => {
        await saveThreeAccounts();
        askToRemove(2);

        const prompt = removePrompt() as HTMLElement;
        expect(prompt.querySelector("[data-pp-remove-bank]")?.textContent).toBe(
          "QA Savings Bank",
        );
        expect(prompt.querySelector("[data-pp-remove-kind]")?.textContent).toBe(
          "Savings account",
        );
        expect(prompt.querySelector("[data-pp-remove-tail]")?.textContent).toMatch(
          /ending in 5566$/,
        );
        // The accounts either side of it are not mentioned, and their tails are not shown.
        expect(prompt.textContent).not.toMatch(/QA Test Bank|QA Third Bank/);
        expect(prompt.textContent).not.toMatch(/2233|8899/);
      });

      /* ------------------------------------------------------- QA-L4-UX-6A */

      /**
       * THE IRREVERSIBLE ANSWER LOOKS LIKE ONE, AND THE SAFE ONE DOES NOT.
       *
       * `wf-btn-danger` - the shared destructive modifier - is a transparent button with red text.
       * That is right for a remove control in a list and wrong for the last click before a bank
       * account is discarded: real-browser QA read it as an ordinary white button. Two answers sit
       * side by side here and exactly one of them cannot be taken back, so they must not look
       * equally harmless.
       */
      it("fills the destructive answer in, and leaves the safe one neutral", async () => {
        await saveThreeAccounts();
        askToRemove(2);

        const cancel = action("remove-cancel") as HTMLButtonElement;
        const confirm = action("remove-confirm") as HTMLButtonElement;

        // Cancel: the shared neutral button, and NOT dressed as the destructive one.
        expect(cancel.className.split(/\s+/)).toContain("wf-btn");
        expect(cancel.className).toMatch(/\bwf-btn-ghost\b/);
        expect(cancel.className).not.toMatch(/destructive|danger/);

        // Remove: the shared shape, filled in by this module.
        expect(confirm.className.split(/\s+/)).toContain("wf-btn");
        expect(confirm.className.split(/\s+/)).toContain("pp-btn-destructive");
        expect(confirm.className).not.toMatch(/\bwf-btn-danger\b/);

        // Both are still native buttons, which is what makes the keyboard route work at all.
        for (const button of [cancel, confirm]) {
          expect(button.tagName).toBe("BUTTON");
          expect(button.getAttribute("type")).toBe("button");
          expect(button.disabled).toBe(false);
        }
      });

      /**
       * WHAT "FILLED IN" MEANS, checked against the stylesheet rather than against a screenshot.
       *
       * The assertion is about the intent the owner stated - a solid fill with white text, and the
       * three states a filled button needs - and not about which hex the design tokens happen to
       * hold. A class name on a button proves nothing if nothing styles it, which is precisely the
       * failure QA-L4-UX-1 was.
       */
      it("defines that fill, with its hover, focus and disabled states", () => {
        const stylesheet = readFileSync(
          resolve(
            process.cwd(),
            "components/workforce/onboarding/modules/payroll-payment/payroll-payment.css",
          ),
          "utf8",
        );

        const rule = /\.pp-prompt \.pp-btn-destructive\s*\{([^}]*)\}/.exec(stylesheet);
        expect(rule).not.toBeNull();
        // Solid, and legible on it.
        expect(rule?.[1]).toMatch(/background:\s*var\(--color-danger/);
        expect(rule?.[1]).toMatch(/color:\s*#fff/);
        // Not left as a flat block a pointer or a keyboard gets no answer from.
        expect(stylesheet).toMatch(
          /\.pp-prompt \.pp-btn-destructive:hover:not\(:disabled\)/,
        );
        expect(stylesheet).toMatch(/\.pp-prompt \.pp-btn-destructive:focus-visible/);
        expect(stylesheet).toMatch(/\.pp-prompt \.pp-btn-destructive:disabled/);
      });

      it("still removes on the filled answer, and still nothing on the neutral one", async () => {
        await saveThreeAccounts();

        // The neutral one changes nothing.
        askToRemove(2);
        fireEvent.click(action("remove-cancel"));
        expect(capsule().querySelectorAll("[data-pp-account]")).toHaveLength(3);

        // The filled one does what it says.
        askToRemove(2);
        fireEvent.click(action("remove-confirm"));
        expect(capsule().querySelectorAll("[data-pp-account]")).toHaveLength(2);
        expect(field("institution", accountCard(2)).value).toBe("QA Third Bank");
      });

      it("introduces no banking value along with the styling", async () => {
        await saveThreeAccounts();
        askToRemove(2);

        const prompt = removePrompt() as HTMLElement;
        for (const value of [A_ACCOUNT, B_ACCOUNT, C_ACCOUNT, A_ROUTING, B_ROUTING, C_ROUTING]) {
          expect(prompt.outerHTML).not.toContain(value);
        }
        // The safe tail, and no other run of digits.
        expect((prompt.textContent?.match(/\d{3,}/g) ?? [])).toEqual(["5566"]);
      });

      it("warns him that how his pay is divided may need attention", async () => {
        await saveThreeAccounts();
        askToRemove(2);
        expect(removePrompt()?.textContent).toMatch(/how your pay is divided/i);
      });

      it("changes NOTHING when he cancels, and does not save merely because he cancelled", async () => {
        await saveThreeAccounts();
        const saves = vi.mocked(saveOwnPayrollPayment).mock.calls.length;

        askToRemove(2);
        fireEvent.click(action("remove-cancel"));

        expect(removePrompt()).toBeNull();
        expect(capsule().querySelectorAll("[data-pp-account]")).toHaveLength(3);
        expect(accounts).toHaveLength(3);
        expect(vi.mocked(saveOwnPayrollPayment).mock.calls.length).toBe(saves);
        // Every account still shows its own masked tail, and the allocation is untouched.
        expect(accountCard(1).textContent).toMatch(/••••2233/);
        expect(accountCard(2).textContent).toMatch(/••••5566/);
        expect(accountCard(3).textContent).toMatch(/••••8899/);
      });

      it("treats Escape as cancelling, because a dialog a worker cannot dismiss is a trap", async () => {
        await saveThreeAccounts();
        askToRemove(2);

        fireEvent.keyDown(document, { key: "Escape" });

        expect(removePrompt()).toBeNull();
        expect(capsule().querySelectorAll("[data-pp-account]")).toHaveLength(3);
      });

      it("removes the account he asked about once he says he means it", async () => {
        await saveThreeAccounts();

        askToRemove(2);
        fireEvent.click(action("remove-confirm"));

        expect(removePrompt()).toBeNull();
        expect(capsule().querySelectorAll("[data-pp-account]")).toHaveLength(2);
        // The one that went is the one he pointed at. What survives keeps its own details, which
        // is asserted in full by the identity tests above.
        expect(field("institution", accountCard(1)).value).toBe("QA Test Bank");
        expect(field("institution", accountCard(2)).value).toBe("QA Third Bank");
      });

      /**
       * A NEW ACCOUNT'S PLAINTEXT IS IN STATE, AND MUST NOT REACH THE QUESTION.
       *
       * This is the case a dialog could get wrong without anybody noticing: the account he is
       * removing is one he has just typed, so the browser is holding the whole account number and
       * the whole routing number in memory. The masked tail comes from the SERVER, and an account
       * the server has never seen therefore has none - so it is named by his bank alone rather
       * than by helpfully reaching for the value that is lying around.
       */
      it("puts no protected value in the question, not even one he typed a moment ago", async () => {
        await open();
        chooseMethod("bank");
        await waitFor(() => expect(accountCard(1)).toBeTruthy());
        await enterAccount(1, {
          institution: "QA Test Bank",
          type: "CHECKING",
          routing: A_ROUTING,
          account: A_ACCOUNT,
          confirmation: A_ACCOUNT,
        });
        fireEvent.click(action("add-account"));
        await enterAccount(2, {
          institution: "QA Savings Bank",
          type: "SAVINGS",
          routing: B_ROUTING,
          account: B_ACCOUNT,
          confirmation: B_ACCOUNT,
        });

        askToRemove(2);
        const prompt = removePrompt() as HTMLElement;

        expect(prompt.outerHTML).not.toContain(B_ACCOUNT);
        expect(prompt.outerHTML).not.toContain(B_ROUTING);
        expect(prompt.textContent).not.toMatch(/\d{5,}/);
        // Nothing has been saved for it, so there is no tail to show and none is invented.
        expect(prompt.querySelector("[data-pp-remove-tail]")).toBeNull();
        expect(prompt.querySelector("[data-pp-remove-bank]")?.textContent).toBe(
          "QA Savings Bank",
        );
      });

      /**
       * REMOVING THE REMAINDER ACCOUNT LEAVES THE REMAINDER UNASSIGNED, ON PURPOSE.
       *
       * The account that was to receive whatever is left is gone, so the instruction no longer
       * says where the rest of his wages go. This screen does not pick a replacement for him -
       * choosing which account gets the remainder of his pay is not a decision software should
       * make quietly - and the server refuses the proposal until he has made it.
       */
      it("leaves the remainder unassigned, and picks nothing for him", async () => {
        await saveThreeAccounts();

        // Set amounts, with the SECOND account taking whatever is left.
        fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);
        const remainders = capsule().querySelectorAll<HTMLInputElement>(
          "[data-pp-remainder-for] input",
        );
        fireEvent.click(remainders[1]);
        const amounts = capsule().querySelectorAll<HTMLInputElement>(
          '[data-pp-field="amount"]',
        );
        fireEvent.change(amounts[0], { target: { value: "500" } });
        fireEvent.change(amounts[1], { target: { value: "250" } });
        fireEvent.click(action("save"));
        await waitFor(() =>
          expect(accounts[1]?.allocationKind).toBe("REMAINING_BALANCE"),
        );

        askToRemove(2);
        fireEvent.click(action("remove-confirm"));

        // No survivor was quietly promoted, and the screen asks him to choose.
        expect(
          Array.from(
            capsule().querySelectorAll<HTMLInputElement>("[data-pp-remainder-for] input"),
          ).filter((input) => input.checked),
        ).toHaveLength(0);
        expect(capsule().querySelector("[data-pp-remainder-missing]")).not.toBeNull();

        // And it does not go on until he has.
        fireEvent.click(action("review"));
        await waitFor(() =>
          expect(
            capsule().querySelector(
              '[data-pp-violation="REMAINING_BALANCE_ACCOUNT_REQUIRED"]',
            ),
          ).not.toBeNull(),
        );
        expect(getOwnPayrollPaymentReview).not.toHaveBeenCalled();
      });
    });
  });

  describe("how his pay is divided", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      fireEvent.click(action("add-account"));
    });

    it("explains both approaches without naming an internal anything", () => {
      const allocation = capsule().querySelector("[data-pp-allocation]");
      expect(allocation).not.toBeNull();
      expect(allocation?.textContent).toMatch(/By percentage/);
      expect(allocation?.textContent).toMatch(/Set amounts, with the rest in one account/);
      expect(allocation?.textContent).toMatch(/one of these two ways, not both/i);
      // No enum reaches the screen.
      expect(allocation?.textContent).not.toMatch(/FIXED_AMOUNT|REMAINING_BALANCE|_/);
    });

    it("totals his percentages for him, and says when they are wrong", () => {
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      const boxes = capsule().querySelectorAll<HTMLInputElement>(
        '[data-pp-field="percentage"]',
      );
      fireEvent.change(boxes[0], { target: { value: "60" } });
      fireEvent.change(boxes[1], { target: { value: "30" } });

      expect(capsule().textContent).toMatch(/adds up to 90%/);
      expect(capsule().textContent).toMatch(/has to be exactly 100%/);

      fireEvent.change(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[1],
        { target: { value: "40" } },
      );
      expect(capsule().textContent).toMatch(/adds up to 100%/);
    });

    it("adds exact decimals correctly, which floats would not", () => {
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      fireEvent.click(action("add-account"));
      const boxes = capsule().querySelectorAll<HTMLInputElement>(
        '[data-pp-field="percentage"]',
      );
      fireEvent.change(boxes[0], { target: { value: "33.33" } });
      fireEvent.change(boxes[1], { target: { value: "33.33" } });
      fireEvent.change(boxes[2], { target: { value: "33.34" } });

      expect(capsule().textContent).toMatch(/adds up to 100%/);
    });

    it("makes TWO remainder accounts unexpressible, and asks for one", () => {
      fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);

      expect(capsule().querySelector("[data-pp-remainder-missing]")).not.toBeNull();

      const remainders = capsule().querySelectorAll<HTMLInputElement>(
        "[data-pp-remainder-for] input",
      );
      expect(remainders).toHaveLength(2);
      // A radio group. "Both of them" is not a state this shape has.
      expect(Array.from(remainders).every((input) => input.type === "radio")).toBe(true);
      expect(new Set(Array.from(remainders).map((input) => input.name)).size).toBe(1);

      fireEvent.click(remainders[0]);
      expect(capsule().querySelector("[data-pp-remainder-missing]")).toBeNull();
      expect(
        Array.from(
          capsule().querySelectorAll<HTMLInputElement>("[data-pp-remainder-for] input"),
        ).filter((input) => input.checked),
      ).toHaveLength(1);
    });

    it("asks for an amount only for the accounts that are not taking the remainder", () => {
      fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);
      fireEvent.click(
        capsule().querySelectorAll<HTMLInputElement>("[data-pp-remainder-for] input")[0],
      );

      const amounts = capsule().querySelectorAll('[data-pp-field="amount"]');
      expect(amounts).toHaveLength(1);
      expect(amounts[0].getAttribute("data-pp-amount-for")).toBe("2");
    });

    it("cannot hold both approaches at once: choosing one clears the other's figures", () => {
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      fireEvent.change(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[0],
        { target: { value: "60" } },
      );

      fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);
      expect(capsule().querySelector('[data-pp-field="percentage"]')).toBeNull();

      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      expect(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[0]
          .value,
      ).toBe("");
    });
  });

  describe("the rules the server reports", () => {
    it("says each one in his own words, and never as a code", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      // The account number is typed, because a NEW account establishes its own rather than
      // inheriting one (QA-L4-R1). What is left unstated is what the reported rules are about.
      await enterAccount(1, { account: ACCOUNT, confirmation: ACCOUNT });
      fireEvent.click(action("save"));
      await waitFor(() =>
        expect(capsule().querySelector('[data-pp-violations="true"]')).not.toBeNull(),
      );

      const summary = capsule().querySelector('[data-pp-violations="true"]');
      expect(summary?.textContent).toMatch(/Tell us whether each account is a checking/i);
      expect(summary?.textContent).toMatch(/name of your bank/i);
      // No identifier reaches him.
      expect(summary?.textContent).not.toMatch(/[A-Z]{4,}_[A-Z]/);
    });

    it("names the account a rule is about, so he knows which one to fix", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      fireEvent.click(action("add-account"));
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      // Account 2 states its own account number and nothing else, so the rule it breaks is the
      // one about its bank's name.
      await enterAccount(2, { account: OTHER_ACCOUNT, confirmation: OTHER_ACCOUNT });
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="FINANCIAL_INSTITUTION_REQUIRED"]'),
        ).not.toBeNull(),
      );
      expect(
        capsule().querySelector('[data-pp-violation="FINANCIAL_INSTITUTION_REQUIRED"]')
          ?.textContent,
      ).toMatch(/^Account 2:/);
    });

    it("has a sentence for a refusal it has never seen, and shows no code", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      vi.mocked(saveOwnPayrollPayment).mockRejectedValueOnce(
        new OnboardingApiError("nope", 400, "SOMETHING_NEW_ENTIRELY"),
      );
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(capsule().querySelector('[data-pp-refusal="UNKNOWN"]')).not.toBeNull(),
      );
      const said = capsule().querySelector("[data-pp-refusal]")?.textContent ?? "";
      expect(said).toMatch(/nothing was saved/i);
      expect(said).not.toContain("SOMETHING_NEW_ENTIRELY");
    });
  });

  describe("leaving it and coming back", () => {
    it("resumes from the SERVER's protected draft, with the numbers masked", async () => {
      method = BANK;
      mode = null;
      accounts = [
        serverAccount({
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          confirmedAt: "2026-08-20T09:00:00.000Z",
        }),
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();

      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(capsule().querySelector("[data-pp-resumed]")).not.toBeNull();
      expect(field("institution", accountCard(1)).value).toBe("Frost Bank");
      // What he gets back is the mask and EMPTY boxes. There is no call that returns anything wider.
      expect(accountCard(1).textContent).toMatch(/••••0021/);
      expect(accountCard(1).textContent).toMatch(/••••7890/);
      expect(field("routing", accountCard(1)).value).toBe("");
      expect(field("account", accountCard(1)).value).toBe("");
      expect(field("account-confirm", accountCard(1)).value).toBe("");
      expect(accountCard(1).textContent).toMatch(/Leave this blank to keep it/i);
    });

    it("tells him he has already typed the account number twice", async () => {
      method = BANK;
      accounts = [
        serverAccount({
          position: 1,
          accountType: "SAVINGS",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          confirmedAt: "2026-08-20T09:00:00.000Z",
        }),
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(accountCard(1).querySelector("[data-pp-confirmed]")).not.toBeNull();
    });

    it("carries the account number forward when he changes only his bank's name", async () => {
      method = BANK;
      accounts = [
        serverAccount({
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          confirmedAt: "2026-08-20T09:00:00.000Z",
        }),
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      await enterAccount(1, { institution: "Frost Bank NA" });
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(accounts[0]?.financialInstitutionName).toBe("Frost Bank NA"),
      );
      // Neither protected value was sent, and neither was lost.
      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      expect(sent?.accounts?.[0]?.accountNumber).toBeUndefined();
      expect(sent?.accounts?.[0]?.routingNumber).toBeUndefined();
      expect(accounts[0]?.accountNumber).toBe(ACCOUNT);
      expect(accounts[0]?.confirmedAt).not.toBeNull();
    });
  });

  describe("the review, which is where this gate ends", () => {
    async function reachReview(): Promise<void> {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));
      await waitFor(() => expect(capsule().querySelector("[data-pp-review]")).not.toBeNull());
    }

    it("shows MASKED banking values, and no full value anywhere on the screen", async () => {
      await reachReview();

      const review = capsule().querySelector("[data-pp-review]") as HTMLElement;
      expect(review.querySelector("[data-pp-review-routing]")?.textContent).toBe("••••0021");
      expect(review.querySelector("[data-pp-review-account-number]")?.textContent).toBe(
        "••••7890",
      );
      expect(review.textContent).not.toContain(ACCOUNT);
      expect(review.textContent).not.toContain(ROUTING);
      // Not in an attribute either, which is where a value hides from a text scan.
      expect(capsule().outerHTML).not.toContain(ACCOUNT);
      expect(capsule().outerHTML).not.toContain(ROUTING);
    });

    it("says we cannot show him the whole numbers again", async () => {
      await reachReview();
      expect(
        capsule().querySelector("[data-pp-review-masking]")?.textContent,
      ).toMatch(/not able to show you the whole numbers again/i);
    });

    it("says which kind of account it is, and what goes to it", async () => {
      await reachReview();
      expect(
        capsule().querySelector("[data-pp-review-account-type]")?.textContent,
      ).toBe("Checking");
      expect(capsule().querySelector("[data-pp-review-share]")).not.toBeNull();
    });

    it("confirms he typed the number twice, once the server says so", async () => {
      await reachReview();
      expect(capsule().querySelector("[data-pp-review-confirmed]")?.textContent).toMatch(
        /typed each account number twice and they matched/i,
      );
    });

    it("SAYS IT IS NOT IN PLACE YET, and that nothing was sent to his bank", async () => {
      await reachReview();
      const pending = capsule().querySelector("[data-pp-review-pending]")?.textContent ?? "";
      expect(pending).toMatch(/has not been put in place yet/i);
      expect(pending).toMatch(/Nothing has been sent to your bank/i);
      // [AMENDED BY GATE 10C.] It used to say he would be asked to confirm it in a LATER step. The
      // later step is now immediately below this panel, so the paragraph points at it instead.
      expect(pending).toMatch(/Signing below is what puts it in force/i);
    });

    /*
      [AMENDED BY GATE 10C, and split in two.] This asserted that the review offered NO signature,
      which was the truth of Gate 10B. Gate 10C gives the worker exactly one act, so the assertion
      inverts for the signature alone: it must now be THERE, on the delivered shared surface. Every
      other absence this test guarded is untouched below, because none of them was authorized.
    */
    it("offers the ONE governed act, and nothing else acts on his record", async () => {
      await reachReview();
      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-authorize-state="READY"]'),
        ).not.toBeNull(),
      );

      // The act is the DELIVERED card's, not this capsule's.
      expect(capsule().querySelector("[data-subject-key]")).not.toBeNull();
      expect(capsule().querySelector('[data-capture-pad="ELECTRONIC_SIGNATURE"]')).not.toBeNull();

      // And the things Gate 10C did not authorize are still absent, not merely disabled.
      const text = capsule().textContent ?? "";
      expect(text).not.toMatch(/activate|effective date|starts on|takes effect on/i);
      expect(capsule().querySelector('input[type="date"]')).toBeNull();

      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.getAttribute("data-pp-action"),
      );
      // This capsule's OWN actions at review: going back to edit, and nothing more. The submit and
      // clear controls inside the card carry no `data-pp-action`, because they are not ours.
      expect(controls.filter((name) => name !== null)).toEqual(["change"]);
    });

    it("does NOT offer Save and finish later as the last thing to do", async () => {
      await reachReview();
      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-authorize-state="READY"]'),
        ).not.toBeNull(),
      );

      /*
        SECURED OWNER RULING. `Save and finish later` is an abandonment and resume action. It is
        truthful on the entry screen, where he may genuinely be leaving partway through - and it is
        asserted present there by the suite above. It is NOT the successful terminal action for
        this module, so once he has read everything through it is ABSENT rather than disabled, and
        the governed signature is the only way forward.
      */
      expect(capsule().querySelector('[data-pp-action="save"]')).toBeNull();
      expect(capsule().textContent).not.toMatch(/Save and finish later/i);
    });

    it("lets him go back and change something", async () => {
      await reachReview();
      fireEvent.click(action("change"));
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("does not open the review while a rule is still broken", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      fireEvent.click(action("review"));
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      expect(getOwnPayrollPaymentReview).not.toHaveBeenCalled();
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();
    });
  });

  describe("the payroll card, at review", () => {
    async function reachCardReview(): Promise<void> {
      await open();
      chooseMethod("card");
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      fireEvent.click(action("review"));
      await waitFor(() => expect(capsule().querySelector("[data-pp-review]")).not.toBeNull());
    }

    it("shows the choice he made, with no bank details to show", async () => {
      await reachCardReview();
      expect(capsule().querySelector("[data-pp-review-method]")?.textContent).toBe(
        "MW4H Comdata Payroll Card",
      );
      expect(capsule().querySelector("[data-pp-review-account]")).toBeNull();
    });

    it("DOES NOT SAY HE HAS A CARD, and says MW4H will arrange it", async () => {
      await reachCardReview();
      const next = capsule().querySelector("[data-pp-review-card-next]")?.textContent ?? "";
      expect(next).toMatch(/MW4H will arrange the card with you/i);
      expect(next).toMatch(/has not been ordered or set up yet/i);

      const text = capsule().textContent ?? "";
      expect(text).not.toMatch(/your card is (ready|active|on its way)/i);
      expect(text).not.toMatch(/card number|activated|shipped|mailed/i);
    });

    it("creates nothing: the only calls made are this module's own", async () => {
      await reachCardReview();
      expect(getOwnPayrollPayment).toHaveBeenCalled();
      expect(saveOwnPayrollPayment).toHaveBeenCalled();
      expect(getOwnPayrollPaymentReview).toHaveBeenCalled();
      /*
        [AMENDED BY GATE 10C. Reading the authorization stage is a fourth call, and it is a READ -
        it neither performs the act nor creates a card. What this test has always been about is
        that merely REACHING the review creates nothing, and the two assertions below are still
        what say so: the act was not performed, and the module was not completed from here.]
      */
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
      expect(completeOnboardingModule).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  What he can see and click - QA-L4-UX-1 through UX-5                      */
  /* ------------------------------------------------------------------------ */

  describe("he can tell what to click, and is told each thing once", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("gives him REAL BUTTONS for the two things he can do, and says which goes forward", () => {
      const review = action("review") as HTMLButtonElement;
      const save = action("save") as HTMLButtonElement;

      for (const button of [review, save]) {
        // A button element, not a run of text with a click handler on it. A keyboard reaches it,
        // Enter and Space work on it, and assistive technology announces it, for free.
        expect(button.tagName).toBe("BUTTON");
        expect(button.getAttribute("type")).toBe("button");
        expect(button.disabled).toBe(false);
        expect(button.className.split(/\s+/)).toContain("wf-btn");
      }

      // The hierarchy: going forward is the emphasised one, saving for later sits beside it.
      expect(review.className).toMatch(/\bwf-btn-primary\b/);
      expect(save.className).toMatch(/\bwf-btn-secondary\b/);
      expect(review.textContent?.trim()).toBe("Review info");
      expect(save.textContent?.trim()).toBe("Save and finish later");
    });

    it("makes Add another account a button too, and takes it away at the third", () => {
      const add = action("add-account") as HTMLButtonElement;
      expect(add.tagName).toBe("BUTTON");
      expect(add.className.split(/\s+/)).toContain("wf-btn");
      expect(add.textContent?.trim()).toBe("Add another account");
      // Secondary, so finding it is easy and it does not compete with going forward.
      expect(add.className).toMatch(/\bwf-btn-secondary\b/);
      expect(action("review").className).toMatch(/\bwf-btn-primary\b/);

      fireEvent.click(add);
      expect(accountCard(2)).toBeTruthy();
      fireEvent.click(action("add-account"));
      expect(accountCard(3)).toBeTruthy();
      // The ceiling is where it was.
      expect(capsule().querySelector('[data-pp-action="add-account"]')).toBeNull();
      expect(capsule().querySelector("[data-pp-account-ceiling]")).not.toBeNull();
    });

    it("gives the remove control a visible shape as well", () => {
      fireEvent.click(action("add-account"));
      const remove = accountCard(2).querySelector<HTMLButtonElement>(
        '[data-pp-remove-account="2"]',
      );
      expect(remove?.tagName).toBe("BUTTON");
      expect(remove?.className.split(/\s+/)).toContain("wf-btn");
      // Quiet, because it is not what he came here to do.
      expect(remove?.className).toMatch(/\bwf-btn-ghost\b/);
    });

    /**
     * THE ACTUAL CAUSE OF WHAT QA SAW, ASSERTED DIRECTLY.
     *
     * The controls on this screen were written against `wf-button`, `wf-button-secondary` and
     * `wf-button-quiet`. No stylesheet in this application defines any of them - the shared
     * primitive is `wf-btn` with its modifiers, which every other Workforce screen uses - so they
     * reached the worker as unstyled native buttons, which is to say as text he could not tell was
     * clickable. It was not a design judgement that went wrong; it was three class names nothing
     * had ever styled.
     *
     * So this asserts the property rather than the symptom: every shared class this module puts on
     * the screen is one the shared stylesheet actually defines. A future control written against a
     * name that does not exist trips this the moment it is rendered.
     */
    it("styles itself with shared classes the application actually defines", () => {
      const stylesheet = readFileSync(
        resolve(process.cwd(), "app/workforce/workforce.css"),
        "utf8",
      );

      const used = new Set<string>();
      for (const element of Array.from(capsule().querySelectorAll<HTMLElement>("*"))) {
        for (const token of Array.from(element.classList)) {
          if (token.startsWith("wf-")) used.add(token);
        }
      }

      expect(used.size).toBeGreaterThan(0);
      for (const token of used) {
        expect(stylesheet).toMatch(new RegExp(`\\.${token}\\b`));
      }
      // And the three names that never existed are gone from the module entirely.
      expect(capsule().outerHTML).not.toMatch(/wf-button/);
    });

    it("still saves what he has entered when he clicks Save and finish later", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));

      await waitFor(() => expect(accounts).toHaveLength(1));
      expect(capsule().querySelector('[data-pp-saved="true"]')).not.toBeNull();
    });

    it("still opens the review when he clicks Review info", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));

      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );
    });

    /* --------------------------------------------------------------- UX-5 */

    it("uses the owner's wording, and no longer the wording it replaced", async () => {
      expect(capsule().textContent).toMatch(/Review info/);
      expect(capsule().textContent).not.toMatch(/Check what I have entered/i);
      expect(capsule().textContent).not.toMatch(/Change something/i);

      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );

      expect(action("change").textContent?.trim()).toBe("Edit payment information");
      expect(capsule().textContent).not.toMatch(/Change something/i);
    });

    /* --------------------------------------------------------------- UX-2 */

    it("asks for the account number twice, and explains why ONCE", () => {
      const card = accountCard(1);
      const said = card.textContent ?? "";

      // The instruction survives, in full.
      expect(said).toMatch(/Type the account number again/i);
      expect(said).toMatch(/catch a wrong digit before payday/i);
      expect(said).toMatch(/rather than copying it/i);

      // And it is given once, where it used to be given three times over.
      expect((said.match(/wrong digit/gi) ?? []).length).toBe(1);
      expect((said.match(/payday/gi) ?? []).length).toBe(1);
      expect((said.match(/rather than (copying|pasting)/gi) ?? []).length).toBe(1);
    });

    it("keeps the paste refusal to the point, since the reason is already above the box", () => {
      fireEvent.paste(field("account-confirm", accountCard(1)), {
        clipboardData: { getData: () => ACCOUNT },
      });

      const note = accountCard(1).querySelector("[data-pp-entry-blocked]");
      expect(note?.textContent).toMatch(/rather than pasting it/i);
      // It no longer re-argues the case for typing it twice.
      expect(note?.textContent).not.toMatch(/payday|twice/i);
    });

    /* --------------------------------------------------------------- UX-3 */

    it("HIDES WHAT HE TYPED once he moves on from the box", async () => {
      const box = field("account", accountCard(1));
      typeInto(box, ACCOUNT);
      expect(box.value).toBe(ACCOUNT);

      moveOnFrom(box);

      // What is on screen is the masked tail, in the same shape as everywhere else.
      expect(box.value).toBe("••••7890");
      expect(box.getAttribute("data-pp-masked")).toBe("true");
      // And the value he typed is not in the page at all any more.
      expect(capsule().outerHTML).not.toContain(ACCOUNT);
    });

    it("hides the second box on the same terms", async () => {
      const again = field("account-confirm", accountCard(1));
      typeInto(again, ACCOUNT);
      moveOnFrom(again);

      expect(again.value).toBe("••••7890");
      expect(capsule().outerHTML).not.toContain(ACCOUNT);
    });

    it("shows bullets alone for a value too short to have a tail worth showing", () => {
      const box = field("account", accountCard(1));
      typeInto(box, "1234");
      moveOnFrom(box);
      expect(box.value).toBe("••••");
    });

    /**
     * IT CANNOT BE TALKED INTO ADOPTING ITS OWN MASK.
     *
     * The box displays a mask while he is not in it, so anything that echoes what is displayed back
     * as a change is offering the mask as the value. Taking it would replace his account number
     * with a picture of its last four digits - and the server would then be asked to confirm THAT.
     */
    it("never takes the mask it is showing as the value", () => {
      const box = field("account", accountCard(1));
      typeInto(box, ACCOUNT);
      moveOnFrom(box);
      expect(box.value).toBe("••••7890");

      fireEvent.change(box, { target: { value: "••••7890" } });

      // Unchanged: what he typed is still what will be sent.
      moveInto(box);
      expect(box.value).toBe(ACCOUNT);
    });

    it("gives him HIS OWN VALUE back when he returns to the box, rather than an empty one", () => {
      const box = field("account", accountCard(1));
      typeInto(box, ACCOUNT);
      moveOnFrom(box);
      expect(box.value).toBe("••••7890");

      moveInto(box);

      expect(box.value).toBe(ACCOUNT);
      expect(box.getAttribute("data-pp-masked")).toBeNull();
    });

    /**
     * MASKING IS THE DISPLAY, AND THE SERVER'S COMPARISON IS UNTOUCHED.
     *
     * This is the assertion that says the mask is not a shortcut to throwing the value away: both
     * boxes are typed, both are left, and what goes on the wire is both values IN FULL - because
     * the SERVER compares them and its comparison is what confirms the account number (10-R10).
     */
    it("still sends both values in full for the server to compare", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      moveOnFrom(field("account", accountCard(1)));
      moveOnFrom(field("account-confirm", accountCard(1)));
      expect(field("account", accountCard(1)).value).toBe("••••7890");

      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      expect(sent?.accounts?.[0]?.accountNumber).toBe(ACCOUNT);
      expect(sent?.accounts?.[0]?.accountNumberConfirmation).toBe(ACCOUNT);
      // And the server, not the browser, is what recorded the confirmation.
      expect(accounts[0].confirmedAt).not.toBeNull();
    });

    it("lets the server refuse a mismatch it can no longer see on screen", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: OTHER_ACCOUNT,
      });
      moveOnFrom(field("account", accountCard(1)));
      moveOnFrom(field("account-confirm", accountCard(1)));
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(
          capsule().querySelector(
            '[data-pp-refusal="ACCOUNT_NUMBER_CONFIRMATION_MISMATCH"]',
          ),
        ).not.toBeNull(),
      );
      expect(accounts).toHaveLength(0);
    });

    it("puts nothing back in the boxes after a save, masked or otherwise", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      // Empty, and therefore not masked either - a mask of nothing would imply we had put
      // something back, and nothing in this capsule can retrieve a saved account number.
      await waitFor(() => expect(field("account", accountCard(1)).value).toBe(""));
      expect(field("account-confirm", accountCard(1)).value).toBe("");
      expect(field("account", accountCard(1)).getAttribute("data-pp-masked")).toBeNull();
      // The saved tail is stated as text beside the box instead.
      expect(accountCard(1).textContent).toMatch(/••••7890/);
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  When red appears, and when it does not - QA-L4-UX-7                      */
  /* ------------------------------------------------------------------------ */

  /* ------------------------------------------------------------------------ */
  /*  The routing number is required - owner ruling 10A-R1                     */
  /* ------------------------------------------------------------------------ */

  /**
   * EVERY ACCOUNT NEEDS A ROUTING NUMBER, AND THE SCREEN'S PART IN THAT IS TWO SENTENCES.
   *
   * One while he is filling the account in, so he knows the field is not optional; one when he asks
   * to go on, which is the server's own answer put in front of him. Neither is enforcement:
   * `readyForReview` still decides whether the review opens and the browser re-implements no rule.
   *
   * THE FIRST OF THE TWO IS BOLD AND RED, BY OWNER RULING, AND THAT IS NOT UX-7 GIVING WAY. It was
   * a clause in the muted help paragraph until the owner met it in a real browser and ruled that a
   * worker would miss it. A static "this field is not optional" said before he starts and an
   * actionable "here is what the server refused" said after he asks to go on are different things,
   * and only the second is validation output - which is why the first can be loud from the first
   * frame without UX-7 or UX-7A being touched.
   *
   * THE ONE THING THIS SCREEN MUST NOT CONCLUDE IS THAT AN EMPTY BOX MEANS AN ACCOUNT WITHOUT A
   * ROUTING NUMBER. After any save the box is empty for EVERY account, because the worker is shown
   * a mask and there is no call here that could obtain anything wider (10-R7). So the affordance
   * keys off what the server says it HOLDS - the masked tail - and never off what is in the input.
   * An affordance that read the input would demand that a worker retype his routing number every
   * time he corrected his bank's spelling, which is the mandatory stop 10A-R1 names.
   */
  describe("the routing number is required, and the screen says so honestly", () => {
    function summary(): HTMLElement | null {
      return capsule().querySelector<HTMLElement>('[data-pp-violations="true"]');
    }

    /** The required-routing line on one account, or null when it is not being said. */
    function requiredNote(position: number): HTMLElement | null {
      return accountCard(position).querySelector<HTMLElement>(
        "[data-pp-routing-required]",
      );
    }

    /** The sentence the owner ruled must be shown, exactly as he wrote it. */
    const REQUIRED_SENTENCE =
      "Routing number is required for every account and cannot be left blank.";

    /** A new account complete in every respect BUT the routing number. */
    async function accountWithoutRouting(): Promise<void> {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
    }

    /** A save whose timing this test decides, for the in-flight frame (QA-L4-UX-7A). */
    function heldSave(): { release: () => void } {
      let release: (() => void) | null = null;
      vi.mocked(saveOwnPayrollPayment).mockImplementationOnce(
        (_id, input) =>
          new Promise((resolve) => {
            release = () => resolve(save(input));
          }),
      );
      return {
        release: () => {
          if (!release) throw new Error("The save was never called.");
          release();
        },
      };
    }

    it("tells him a new account's routing number is required, beside the box", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      // THE OWNER'S OWN SENTENCE, WHOLE. He found the previous wording in a browser and ruled it
      // too easy to miss, so what it now says is his text rather than a paraphrase of it.
      expect(requiredNote(1)?.textContent?.trim()).toBe(REQUIRED_SENTENCE);
      expect(field("routing", accountCard(1)).getAttribute("aria-required")).toBe(
        "true",
      );
      expect(summary()).toBeNull();
      // And it still says where to find the number, which is the part he may not know.
      expect(accountCard(1).textContent).toMatch(/bottom left of your checks/i);
    });

    /**
     * ITS OWN LINE, IN ITS OWN VOICE - which is the whole of the owner's correction.
     *
     * The sentence existed before this and the browser QA still failed, because it was a clause at
     * the tail of the muted grey help paragraph. So proving the words are present proves nothing
     * about what was actually wrong. What follows asserts the two properties the owner ruled on -
     * SEPARATE and BOLD RED - and asserts the second against the stylesheet, in the manner this
     * suite already uses for QA-L4-UX-1: a class name on an element proves nothing if nothing
     * styles it, and that failure is exactly the one being corrected here.
     */
    it("gives that sentence its own line, apart from the ordinary help copy", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      const note = requiredNote(1);
      // A block of its own, and not a fragment inside another paragraph.
      expect(note?.tagName).toBe("P");
      expect(note?.closest(".pp-help")).toBeNull();
      // The grey paragraph is still there saying where to find the number, and is a DIFFERENT
      // element - so the requirement is not buried in the copy it sits beside.
      const help = accountCard(1).querySelector<HTMLElement>(".pp-help");
      expect(help).not.toBeNull();
      expect(help).not.toBe(note);
      expect(help?.textContent).not.toMatch(/cannot be left blank/i);
      expect(help?.contains(note as Node)).toBe(false);

      // It carries the module's required-field class rather than the error class, because it is
      // stating a requirement in advance and not reporting a fault.
      expect(note?.classList.contains("pp-field-required")).toBe(true);
      expect(note?.classList.contains("pp-help")).toBe(false);
      expect(note?.classList.contains("pp-field-error")).toBe(false);
      // Read out with the box too, not left to sighted workers.
      const describedBy =
        field("routing", accountCard(1)).getAttribute("aria-describedby") ?? "";
      expect(describedBy.split(/\s+/)).toContain(note?.id);
    });

    it("styles that line BOLD and RED in the module's own stylesheet", () => {
      const stylesheet = readFileSync(
        resolve(
          process.cwd(),
          "components/workforce/onboarding/modules/payroll-payment/payroll-payment.css",
        ),
        "utf8",
      );

      const rule = /\.pp-field-required\s*\{([^}]*)\}/.exec(stylesheet);
      expect(rule).not.toBeNull();
      const declared = rule?.[1] ?? "";

      // BOLD. Asserted as a weight at or above the CSS bold threshold rather than as one exact
      // number, so the intent is what is pinned and not a particular figure.
      const weight = /font-weight:\s*(\d+)/.exec(declared);
      expect(weight).not.toBeNull();
      expect(Number(weight?.[1])).toBeGreaterThanOrEqual(700);

      // RED, through the application's error colour token - the same one `.pp-field-error` uses, so
      // this line is the same red the worker already reads as consequential.
      expect(declared).toMatch(/color:\s*var\(--color-error-text/);
      const errorRule = /\.pp-field-error\s*\{([^}]*)\}/.exec(stylesheet);
      expect(errorRule?.[1]).toMatch(/color:\s*var\(--color-error-text/);

      // And it is a distinct rule from the muted help voice, which must not have become bold or red
      // by this correction.
      const helpRule = /\.pp-note,\s*\.pp-help,[^{]*\{([^}]*)\}/.exec(stylesheet);
      expect(helpRule?.[1]).toMatch(/color:\s*var\(--color-text-muted/);
      expect(helpRule?.[1]).not.toMatch(/font-weight/);
    });

    /**
     * "CHEQUE" IS NOT A WORD IN A UNITED STATES PAYROLL APPLICATION (owner correction 2).
     *
     * The owner read it on the routing field during browser QA and rejected the spelling. It is
     * asserted over both places the worker can meet it - the copy this module renders, and the
     * sentence every governed refusal would put in front of him - because the routing vocabulary
     * spans both and correcting one would have left the other saying it.
     */
    it("says nothing about cheques, in a United States payroll application", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, { routing: ROUTING_BAD_CHECKSUM });

      // Everything on screen: the method choice, the routing help, the required line, the ABA
      // complaint and the allocation copy beneath them.
      expect(capsule().textContent).not.toMatch(/cheque/i);
      expect(capsule().textContent).toMatch(/bottom left of your checks/i);
      expect(accountCard(1).textContent).toMatch(/against your check or your bank/i);
      expect(capsule().textContent).toMatch(/on your checks or in your bank/i);

      // And every sentence a refusal or a reported violation could say, which is where the routing
      // wording actually lives. Asserted over the whole vocabulary rather than the three routing
      // codes, so this cannot be reintroduced anywhere in it.
      for (const code of PAYROLL_PAYMENT_WORKER_REFUSAL_CODES) {
        expect(payrollPaymentRefusalMessage(code)).not.toMatch(/cheque/i);
        expect(payrollPaymentViolationMessage(code)).not.toMatch(/cheque/i);
      }
      expect(payrollPaymentRefusalMessage("ROUTING_NUMBER_REQUIRED")).toMatch(
        /bottom left of a check\./i,
      );
      expect(payrollPaymentRefusalMessage("ROUTING_NUMBER_FORMAT_INVALID")).toMatch(
        /bottom left of a check\./i,
      );
      expect(payrollPaymentRefusalMessage("ROUTING_NUMBER_CHECKSUM_INVALID")).toMatch(
        /against your check or your bank/i,
      );
    });

    it("TELLS HIM when he asks to go on without one, and does not go on", async () => {
      await accountWithoutRouting();

      fireEvent.click(action("review"));

      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
        ).not.toBeNull(),
      );
      const said = summary()?.textContent ?? "";
      expect(said).toMatch(/Before you can go on/i);
      expect(said).toMatch(/Account 1: Enter the routing number/i);
      // It sends him to ENTER a number rather than to check one, which is the distinction 10A-R1
      // draws between an absent value and a malformed one.
      expect(said).not.toMatch(/Check it and save again/i);

      // The review was never even asked for, let alone opened.
      expect(getOwnPayrollPaymentReview).not.toHaveBeenCalled();
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();
    });

    it("stays quiet while he is merely building the account", async () => {
      // The server is asked as soon as he chooses Direct Deposit and again on every save, so it has
      // been saying the routing number is missing since long before he finished typing one
      // (QA-L4-UX-7). A held account with no routing number is the same situation on resume.
      method = BANK;
      mode = FIXED;
      accounts = [
        serverAccount({
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          accountNumber: ACCOUNT,
          allocationKind: "REMAINING_BALANCE",
          confirmedAt: "2026-08-20T09:00:00.000Z",
        }),
      ];
      savedAt = "2026-08-20T09:00:00.000Z";
      expect(violationsOf().map((violation) => violation.code)).toContain(
        "ROUTING_NUMBER_REQUIRED",
      );

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      // NO COMPLAINT ON ARRIVAL, AND NONE WHILE HE TYPES. The distinction the owner drew in
      // correction 1 is asserted here rather than assumed: the STATIC requirement line is present
      // and is meant to be, because it states in advance that the field is not optional. What must
      // not be present is the server's ACTUAL REFUSAL, which he has not yet asked for and has done
      // nothing to earn - so the violation summary stays away and no validation error is rendered.
      expect(requiredNote(1)).not.toBeNull();
      expect(summary()).toBeNull();
      expect(capsule().querySelector(".wf-error")).toBeNull();
      expect(capsule().querySelector(".pp-field-error")).toBeNull();
      await enterAccount(1, { routing: "0210" });
      expect(summary()).toBeNull();
      expect(
        capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
      ).toBeNull();
    });

    it("CLEARS IT the moment he enters the routing number", async () => {
      await accountWithoutRouting();
      fireEvent.click(action("review"));
      await waitFor(() => expect(summary()).not.toBeNull());

      // Typing into the field he was told about is doing something about it, so the complaint goes
      // at once rather than sitting there while he types.
      await enterAccount(1, { routing: ROUTING });
      expect(summary()).toBeNull();

      // And when he asks again, he goes through.
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );
      expect(summary()).toBeNull();
    });

    it("shows no stale required-routing red while a valid review is in flight", async () => {
      // QA-L4-UX-7A over this violation: the last answer the server gave still says the routing
      // number is missing, and for the length of the round trip that answer is about an older
      // question. A screen that does not yet know says nothing.
      await accountWithoutRouting();
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
        ).not.toBeNull(),
      );

      await enterAccount(1, { routing: ROUTING });
      const held = heldSave();
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-in-flight]")).not.toBeNull(),
      );

      expect(summary()).toBeNull();
      expect(
        capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
      ).toBeNull();

      held.release();
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );
      expect(summary()).toBeNull();
    });

    it("does NOT ask an existing account to type its routing number again", async () => {
      // THE MANDATORY-STOP CASE, AS THE BROWSER MEETS IT. The value is held server-side and the
      // browser has only the mask, so the box is empty - and an empty box on this account is the
      // normal, correct state rather than a missing routing number.
      method = BANK;
      mode = FIXED;
      accounts = [
        serverAccount({
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          allocationKind: "REMAINING_BALANCE",
          confirmedAt: "2026-08-20T09:00:00.000Z",
        }),
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      expect(field("routing", accountCard(1)).value).toBe("");
      // NO RED LINE, AND NOT MERELY NO HOOK. For this worker "it cannot be left blank" would be
      // false - leaving it blank is exactly what he should do - so the sentence is absent from the
      // card altogether, and what he gets instead is the mask and permission to leave it alone.
      expect(requiredNote(1)).toBeNull();
      expect(accountCard(1).textContent).not.toMatch(/cannot be left blank/i);
      expect(accountCard(1).querySelector(".pp-field-required")).toBeNull();
      expect(field("routing", accountCard(1)).getAttribute("aria-required")).toBeNull();
      expect(
        accountCard(1).querySelector("[data-pp-routing-stored]"),
      ).not.toBeNull();
      expect(accountCard(1).textContent).toMatch(/Leave this blank to keep it/i);

      // He corrects only his bank's spelling and asks to go on. No routing number travels, none is
      // asked for, and the one the server holds is untouched.
      await enterAccount(1, { institution: "Frost Bank NA" });
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );

      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      expect(sent?.accounts?.[0]?.routingNumber).toBeUndefined();
      expect(accounts[0]?.routingNumber).toBe(ROUTING);
      expect(summary()).toBeNull();
    });

    it("leaves the existing ABA feedback exactly as it was", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING_BAD_CHECKSUM,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });

      // Still caught beside the box, arithmetically and at once.
      expect(
        accountCard(1).querySelector("[data-pp-routing-invalid]"),
      ).not.toBeNull();

      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(
          capsule().querySelector(
            '[data-pp-violation="ROUTING_NUMBER_CHECKSUM_INVALID"]',
          ),
        ).not.toBeNull(),
      );
      // A SUPPLIED value that is wrong is not an absent one, and does not answer as one.
      expect(
        capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
      ).toBeNull();
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();
    });

    it("names the account actually missing its routing number, and not the one beside it", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });

      fireEvent.click(action("add-account"));
      await enterAccount(2, {
        institution: "Second Bank",
        type: "SAVINGS",
        account: OTHER_ACCOUNT,
        confirmation: OTHER_ACCOUNT,
      });
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      const shares = capsule().querySelectorAll<HTMLInputElement>(
        '[data-pp-field="percentage"]',
      );
      fireEvent.change(shares[0], { target: { value: "60" } });
      fireEvent.change(shares[1], { target: { value: "40" } });

      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="ROUTING_NUMBER_REQUIRED"]'),
        ).not.toBeNull(),
      );

      const said = summary()?.textContent ?? "";
      expect(said).toMatch(/Account 2: Enter the routing number/i);
      expect(said).not.toMatch(/Account 1: Enter the routing number/i);
      // And the two cards say two different things, each about its own account.
      expect(
        accountCard(1).querySelector("[data-pp-routing-stored]"),
      ).not.toBeNull();
      expect(requiredNote(1)).toBeNull();
      expect(requiredNote(2)).not.toBeNull();
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();
    });
  });

  describe("red says he must fix something now, not that he has not finished typing", () => {
    /** The red summary of what the server says is outstanding, or null. */
    function summary(): HTMLElement | null {
      return capsule().querySelector<HTMLElement>('[data-pp-violations="true"]');
    }

    /**
     * THE EXACT THING QA SAW, AND THE REASON IT WAS SEEN.
     *
     * Choosing a payment method is itself saved, so the server is asked before the worker has been
     * given a box to type in - and its perfectly correct answer is that he has no account yet.
     * That answer was going straight onto the screen in a red box headed "Before you can go on",
     * while he was going on.
     */
    it("says NOTHING is outstanding merely because he chose Direct Deposit", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      expect(summary()).toBeNull();
      expect(capsule().textContent).not.toMatch(/Before you can go on/i);
      expect(capsule().textContent).not.toMatch(/Add the account you would like/i);

      // The server DID say so. It is simply not an answer to a question he has asked.
      expect(violationsOf().map((violation) => violation.code)).toContain(
        "DEPOSIT_ACCOUNT_REQUIRED",
      );
    });

    it("stays quiet while he is working through the first account", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      await enterAccount(1, { institution: "Frost", type: "CHECKING", routing: "0210" });
      expect(summary()).toBeNull();

      await enterAccount(1, { account: "12345" });
      expect(summary()).toBeNull();
      expect(capsule().querySelector(".wf-error")).toBeNull();
    });

    it("does not greet a returning worker with a red box either", async () => {
      method = BANK;
      accounts = [];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-details]")).not.toBeNull(),
      );

      expect(summary()).toBeNull();
      expect(capsule().querySelector("[data-pp-resumed]")).not.toBeNull();
    });

    it("TELLS HIM when he asks to go on without an account, in the words he needs", async () => {
      method = BANK;
      accounts = [];
      savedAt = "2026-08-20T09:00:00.000Z";
      await open();
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-details]")).not.toBeNull(),
      );

      fireEvent.click(action("review"));

      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="DEPOSIT_ACCOUNT_REQUIRED"]'),
        ).not.toBeNull(),
      );
      expect(summary()?.textContent).toMatch(/Before you can go on/i);
      expect(summary()?.textContent).toMatch(
        /Add the account you would like your pay sent to/i,
      );
      // And it did not go on.
      expect(getOwnPayrollPaymentReview).not.toHaveBeenCalled();
    });

    it("CLEARS IT the moment he does something about it", async () => {
      method = BANK;
      accounts = [];
      savedAt = "2026-08-20T09:00:00.000Z";
      await open();
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-details]")).not.toBeNull(),
      );
      fireEvent.click(action("review"));
      await waitFor(() => expect(summary()).not.toBeNull());

      // Adding the account is doing something about it, so the complaint goes at once rather
      // than sitting there while he types.
      fireEvent.click(action("add-account"));
      expect(summary()).toBeNull();

      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      expect(summary()).toBeNull();

      // And when he asks again, he goes through.
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );
    });

    /**
     * THE ALLOCATION RULES ARE TIMED THE SAME WAY, and the running total is not a rule.
     *
     * A worker halfway through dividing his pay between two accounts has, necessarily, a total
     * that is not yet a hundred. Being told that in a red box is being told off for typing. The
     * running total beside the boxes is the helpful version of the same fact and stays.
     */
    it("waits until he asks to go on before calling his percentages wrong", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("add-account"));
      await enterAccount(2, {
        institution: "Second Bank",
        type: "SAVINGS",
        routing: ROUTING,
        account: OTHER_ACCOUNT,
        confirmation: OTHER_ACCOUNT,
      });
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      const shares = capsule().querySelectorAll<HTMLInputElement>(
        '[data-pp-field="percentage"]',
      );
      fireEvent.change(shares[0], { target: { value: "60" } });
      fireEvent.change(shares[1], { target: { value: "30" } });

      // Nothing red, and the running total still tells him where he is.
      expect(summary()).toBeNull();
      const total = capsule().querySelector("[data-pp-percentage-total]");
      expect(total?.textContent).toMatch(/has to be exactly 100%/);
      expect(total?.closest(".wf-error")).toBeNull();

      // He asks to go on. NOW it is his question, and it is answered.
      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="PERCENTAGE_TOTAL_INVALID"]'),
        ).not.toBeNull(),
      );
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();

      // He corrects it, and the red goes with the condition that earned it.
      fireEvent.change(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[1],
        { target: { value: "40" } },
      );
      expect(summary()).toBeNull();

      fireEvent.click(action("review"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
      );
    });

    /* ---------------------------------------------------------------------- */
    /*  And not while the answer is still on its way - QA-L4-UX-7A             */
    /* ---------------------------------------------------------------------- */

    describe("and not while the answer to his question is still on its way", () => {
      /**
       * A SAVE THIS TEST DECIDES THE TIMING OF.
       *
       * The flash real-browser QA reported lives entirely inside the window between the click and
       * the response, so a suite that cannot hold a request open cannot see it. This holds the next
       * save open until the test lets it finish, and applies the governed rules when it does.
       */
      function heldSave(): { release: () => void } {
        let release: (() => void) | null = null;
        vi.mocked(saveOwnPayrollPayment).mockImplementationOnce(
          (_id, input) =>
            new Promise((resolve) => {
              release = () => resolve(save(input));
            }),
        );
        return {
          release: () => {
            if (!release) throw new Error("The save was never called.");
            release();
          },
        };
      }

      /** A / B / C, valid: five hundred, whatever is left, two hundred and fifty. */
      async function validThreeAccounts(): Promise<void> {
        await open();
        chooseMethod("bank");
        await waitFor(() => expect(accountCard(1)).toBeTruthy());
        await enterAccount(1, {
          institution: "QA Test Bank",
          type: "CHECKING",
          routing: ROUTING,
          account: "1111222233",
          confirmation: "1111222233",
        });
        fireEvent.click(action("add-account"));
        await enterAccount(2, {
          institution: "QA Savings Bank",
          type: "SAVINGS",
          routing: ROUTING,
          account: "4444555566",
          confirmation: "4444555566",
        });
        fireEvent.click(action("add-account"));
        await enterAccount(3, {
          institution: "QA Third Bank",
          type: "CHECKING",
          routing: ROUTING,
          account: "7777888899",
          confirmation: "7777888899",
        });

        fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);
        const remainders = capsule().querySelectorAll<HTMLInputElement>(
          "[data-pp-remainder-for] input",
        );
        fireEvent.click(remainders[1]);
        const amounts = capsule().querySelectorAll<HTMLInputElement>(
          '[data-pp-field="amount"]',
        );
        fireEvent.change(amounts[0], { target: { value: "500" } });
        fireEvent.change(amounts[1], { target: { value: "250" } });
      }

      /**
       * THE DEFECT, AS THE BROWSER SHOWED IT.
       *
       * The proposal is valid and the review opens, so nothing is wrong with the outcome. What was
       * wrong was the frame in between: the summary rendered the violations of the LAST answer the
       * server gave - collected when the form was still empty - as though they were the answer to
       * the question he had just asked.
       */
      it("SHOWS NO RED while a valid review request is in flight", async () => {
        await validThreeAccounts();
        const held = heldSave();

        fireEvent.click(action("review"));
        await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalledTimes(2));

        // In flight. Nothing has been refused, so nothing is presented as refused.
        expect(summary()).toBeNull();
        expect(capsule().textContent).not.toMatch(/Before you can go on/i);
        // And he cannot ask twice while we are asking once.
        expect((action("review") as HTMLButtonElement).disabled).toBe(true);
        expect((action("save") as HTMLButtonElement).disabled).toBe(true);

        held.release();

        await waitFor(() =>
          expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
        );
        expect(summary()).toBeNull();
        // The review is the real one: three accounts, with what each is to receive.
        expect(capsule().querySelectorAll("[data-pp-review-account]")).toHaveLength(3);
      });

      it("shows no red on the way through a valid review after the remainder was removed", async () => {
        await validThreeAccounts();
        fireEvent.click(action("save"));
        await waitFor(() => expect(accounts).toHaveLength(3));
        await waitFor(() => expect(accounts[1]?.allocationKind).toBe("REMAINING_BALANCE"));
        const [a, , c] = accounts.map((account) => account.accountId);

        // Remove the account that was taking whatever was left, through the confirmation.
        askToRemove(2);
        await waitFor(() => expect(removePrompt()).not.toBeNull());
        fireEvent.click(action("remove-confirm"));
        await waitFor(() => expect(removePrompt()).toBeNull());

        // Choose the survivor that is to take it, which is the worker's own decision to make.
        const remainders = capsule().querySelectorAll<HTMLInputElement>(
          "[data-pp-remainder-for] input",
        );
        expect(remainders).toHaveLength(2);
        fireEvent.click(remainders[1]);
        fireEvent.change(
          capsule().querySelector('[data-pp-field="amount"]') as HTMLInputElement,
          { target: { value: "500" } },
        );

        const held = heldSave();
        fireEvent.click(action("review"));
        await waitFor(() =>
          expect(saveOwnPayrollPayment).toHaveBeenCalledTimes(3),
        );

        expect(summary()).toBeNull();

        held.release();
        await waitFor(() =>
          expect(capsule().querySelector("[data-pp-review]")).not.toBeNull(),
        );

        // The two survivors, under their own identities, with what each is to receive.
        expect(accounts.map((account) => account.accountId)).toEqual([a, c]);
        expect(accounts[0].allocationKind).toBe("FIXED_AMOUNT");
        expect(accounts[1].allocationKind).toBe("REMAINING_BALANCE");
        expect(accounts[0].accountNumber).toBe("1111222233");
        expect(accounts[1].accountNumber).toBe("7777888899");
      });

      /**
       * AND A REAL REFUSAL IS STILL A REFUSAL. This is the assertion that says the correction
       * suppressed a FRAME rather than the rules: the same request, genuinely invalid, is answered
       * in red the moment the answer arrives.
       */
      it("SHOWS THE RED as soon as a real answer says something is wrong", async () => {
        await validThreeAccounts();
        // Take the remainder away, so the proposal genuinely breaks a rule.
        fireEvent.click(
          capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
        );
        const shares = capsule().querySelectorAll<HTMLInputElement>(
          '[data-pp-field="percentage"]',
        );
        fireEvent.change(shares[0], { target: { value: "60" } });
        fireEvent.change(shares[1], { target: { value: "10" } });
        fireEvent.change(shares[2], { target: { value: "10" } });

        const held = heldSave();
        fireEvent.click(action("review"));
        await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalledTimes(2));

        // Still nothing while it is in flight: we do not know yet.
        expect(summary()).toBeNull();

        held.release();

        // Now we know, and he is told.
        await waitFor(() =>
          expect(
            capsule().querySelector('[data-pp-violation="PERCENTAGE_TOTAL_INVALID"]'),
          ).not.toBeNull(),
        );
        expect(capsule().querySelector("[data-pp-review]")).toBeNull();

        // And correcting it still clears it, which is UX-7 unchanged.
        fireEvent.change(
          capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[1],
          { target: { value: "40" } },
        );
        expect(summary()).toBeNull();
      });

      it("says what is happening while he waits, and refuses nothing on a request that failed", async () => {
        await validThreeAccounts();

        let fail: (() => void) | null = null;
        vi.mocked(saveOwnPayrollPayment).mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              fail = () => reject(new Error("the network went away"));
            }),
        );

        fireEvent.click(action("review"));
        await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalledTimes(2));

        // A neutral in-progress state, not a refusal.
        expect(capsule().querySelector("[data-pp-in-flight]")).not.toBeNull();
        expect(summary()).toBeNull();
        expect(capsule().querySelector(".wf-error")).toBeNull();

        (fail as unknown as () => void)();

        // A request that genuinely failed is still said, in the existing safe words.
        await waitFor(() =>
          expect(capsule().querySelector("[data-pp-refusal]")).not.toBeNull(),
        );
        expect(capsule().querySelector("[data-pp-in-flight]")).toBeNull();
        expect(capsule().textContent).toMatch(/nothing was saved/i);
      });
    });

    it("still refuses to open the review, whatever it is or is not showing him", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      // Nothing on screen was complaining, and the server still decides.
      expect(summary()).toBeNull();
      fireEvent.click(action("review"));
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalledTimes(2));
      expect(getOwnPayrollPaymentReview).not.toHaveBeenCalled();
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  Gate 10C - putting it in force                                           */
  /* ------------------------------------------------------------------------ */

  describe("Gate 10C - the last step, and what it truthfully leaves behind", () => {
    const PAD_RECT = {
      width: 400,
      height: 160,
      top: 40,
      left: 20,
      right: 420,
      bottom: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect;

    function pad(): HTMLCanvasElement {
      const element = capsule().querySelector<HTMLCanvasElement>("[data-capture-pad]");
      if (!element) throw new Error("no signature surface rendered");
      element.getBoundingClientRect = () => PAD_RECT;
      return element;
    }

    /** Draw a mark the way a pointer draws one, and refuse to pretend if nothing registered. */
    async function drawSignature(): Promise<void> {
      const surface = pad();
      const points = Array.from({ length: 8 }, (_, index) => ({
        x: 10 + index * 6,
        y: 20 + (index % 2) * 4,
      }));
      fireEvent.pointerDown(surface, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: PAD_RECT.left + points[0].x,
        clientY: PAD_RECT.top + points[0].y,
      });
      for (const point of points.slice(1)) {
        fireEvent.pointerMove(surface, {
          pointerId: 1,
          pointerType: "mouse",
          clientX: PAD_RECT.left + point.x,
          clientY: PAD_RECT.top + point.y,
        });
      }
      fireEvent.pointerUp(surface, { pointerId: 1, pointerType: "mouse" });

      // Guards the helper: a draw that recorded nothing would let everything below pass hollow.
      if (surface.dataset.hasMark !== "true") {
        throw new Error("the draw registered no mark");
      }
    }

    /** The authorization stage's own section, once it has read the server. */
    async function stage(state: string): Promise<HTMLElement> {
      await waitFor(() =>
        expect(
          capsule().querySelector(`[data-pp-authorize-state="${state}"]`),
        ).not.toBeNull(),
      );
      return capsule().querySelector(
        `[data-pp-authorize-state="${state}"]`,
      ) as HTMLElement;
    }

    async function reachBankAuthorization(): Promise<void> {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));
      await stage("READY");
    }

    async function reachCardAuthorization(): Promise<void> {
      await open();
      chooseMethod("card");
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      fireEvent.click(action("review"));
      await stage("READY");
    }

    /**
     * Sign, and wait for the recorded outcome.
     *
     * The submit control belongs to the DELIVERED shared card, so it is found by the shared card's
     * own attribute. Nothing in this capsule provides it.
     */
    async function sign(): Promise<void> {
      await drawSignature();
      const submit = capsule().querySelector<HTMLButtonElement>("[data-execution-submit]");
      if (!submit) throw new Error("no submit control on the governed card");
      expect(submit.disabled).toBe(false);
      fireEvent.click(submit);
      await waitFor(() => expect(authorizeOwnPayrollPayment).toHaveBeenCalled());
    }

    /* ---------------------------------------------------- 1, 2: he is asked */

    it("presents the governed authorization once the proposal is review-ready", async () => {
      await reachBankAuthorization();
      const section = await stage("READY");

      expect(section.querySelector("[data-pp-authorization-statement]")).not.toBeNull();
      expect(
        section.querySelector('[data-subject-key="WORKER_PAYMENT_AUTHORIZATION"]'),
      ).not.toBeNull();
      // The act the subject requires, taken from the subject and not chosen here.
      expect(
        section
          .querySelector("[data-required-form]")
          ?.getAttribute("data-required-form"),
      ).toBe("ELECTRONIC_SIGNATURE");
    });

    it("displays the ratified statement EXACTLY, with nothing added to it", async () => {
      await reachBankAuthorization();
      const section = await stage("READY");

      const governed = section.querySelector("[data-pp-authorization-statement]") as HTMLElement;
      const shown = (governed.querySelector(".ob-exec-content")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();

      /*
        CONTAINS, not merely resembles. The governed region also carries the subject's title, so
        an equality assertion would be about the card's layout rather than about the wording. What
        matters is that the ratified sentence is present WORD FOR WORD - and that the words nobody
        ratified are not.
      */
      expect(shown).toContain(AUTHORIZATION_STATEMENT);

      const text = section.textContent ?? "";
      expect(text).not.toMatch(/under penalt(y|ies) of perjury/i);
      expect(text).not.toMatch(/NACHA|ACH network|Regulation E/i);
      expect(text).not.toMatch(/citizen|lawful permanent resident|Form I-9|Form W-4/i);
    });

    it("explains it in OUR words, kept outside the thing he signs", async () => {
      await reachBankAuthorization();
      const section = await stage("READY");

      const guidance = section.querySelector("[data-pp-authorize-guidance]") as HTMLElement;
      expect(guidance.textContent).toMatch(/This is the last step/i);

      // Our explanation is NOT inside the governed region, which is what he is signing.
      const governed = section.querySelector(".ob-exec-content") as HTMLElement;
      expect(governed.textContent).not.toMatch(/This is the last step/i);
    });

    /* ------------------------------------------------------- 3, 4: he signs */

    it("lets him sign, and sends back the version he was shown", async () => {
      await reachBankAuthorization();
      await sign();

      const [, input] = vi.mocked(authorizeOwnPayrollPayment).mock.calls[0];
      expect(input.performedForm).toBe("ELECTRONIC_SIGNATURE");
      expect(input.presented).toEqual({
        revision: AUTHORIZATION_REVISION,
        contentHash: AUTHORIZATION_HASH,
        ruleRevision: AUTHORIZATION_REVISION,
      });
      // A real mark went with it - not an empty capture, and not an attestation.
      expect(input.capture?.strokes.length).toBeGreaterThan(0);
      expect(input.capture?.strokes[0].points.length).toBeGreaterThan(1);
    });

    it("tells him his DIRECT DEPOSIT instructions are in effect, and promises nothing more", async () => {
      await reachBankAuthorization();
      await sign();
      const done = await stage("EXECUTED");

      expect(done.textContent).toContain("Payroll Payment complete");
      expect(
        done.querySelector('[data-pp-outcome="DEPOSIT"]')?.textContent,
      ).toBe(
        "Your payroll payment instructions have been saved and are now in effect.",
      );

      /*
        THE SIX THINGS THIS SENTENCE MUST NOT IMPLY. Gate 10C put a governed instruction on record.
        It moved no money, contacted no bank, verified no ownership, told no payroll provider, ran
        no payroll and identified no paycheck - and a worker who reads any of those here has been
        told something we did not do.
      */
      const text = done.textContent ?? "";
      expect(text).not.toMatch(/transferred|deposited|funds (were|have been) sent/i);
      expect(text).not.toMatch(/verified|confirmed with your bank|your bank (has )?accepted/i);
      expect(text).not.toMatch(/payroll provider|submitted to payroll|payroll run/i);
      expect(text).not.toMatch(/paycheck|pay check|first pay|next pay/i);
    });

    it("tells him his CARD SELECTION is complete, and that MW4H still has work to do", async () => {
      await reachCardAuthorization();
      await sign();
      const done = await stage("EXECUTED");

      expect(done.textContent).toContain("Payroll Payment complete");
      expect(done.querySelector('[data-pp-outcome="CARD"]')?.textContent).toBe(
        "You selected an MW4H Comdata Payroll Card. Your payroll payment selection is complete. MW4H will complete the card setup.",
      );

      // No deposit account is shown for a card, because there is none to show.
      expect(done.querySelector("[data-pp-executed-accounts]")).toBeNull();
    });

    /* ------------------------------------------- 6: no downstream promises */

    it("promises no particular paycheck, at ANY point in the module", async () => {
      await reachBankAuthorization();
      expect(capsule().textContent).not.toMatch(/which paycheck/i);
      expect(capsule().textContent).not.toMatch(/paycheck it starts with/i);

      await sign();
      await stage("EXECUTED");
      expect(capsule().textContent).not.toMatch(/paycheck/i);

      /*
        AND NOT IN THE SOURCE EITHER, so a promise cannot survive in a branch this suite happens
        not to render. The removed wording is checked by its distinctive half rather than by the
        word `paycheck` alone, which honest wording could one day need.
      */
      const capsuleRoot = resolve(
        process.cwd(),
        "components/workforce/onboarding/modules/payroll-payment",
      );
      for (const file of [
        "PayrollPaymentReviewPanel.tsx",
        "PayrollPaymentModule.tsx",
        "PayrollPaymentAuthorization.tsx",
      ]) {
        const source = readFileSync(resolve(capsuleRoot, file), "utf8");
        // Comments are stripped WHOLE, so a note explaining why the promise was removed does not
        // read as the promise itself. What is left is what could reach a worker.
        const rendered = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^[ \t]*\/\/.*$/gm, "");
        expect(rendered).not.toMatch(/which paycheck/i);
      }
    });

    /* --------------------------------- 8, 9: Gate 10B truth is not regressed */

    it("keeps the Gate 10B states truthful: entered is not authorized", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      // Saved and admissible - and still NOT in force. Nothing was authorized by saving.
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
      expect(capsule().querySelector("[data-pp-saved]")).not.toBeNull();
      expect(capsule().querySelector('[data-pp-authorize-state="EXECUTED"]')).toBeNull();
    });

    it("keeps a partial proposal resumable, and refuses to offer the act for it", async () => {
      // Half an account: a bank name and a routing number, and nothing else.
      accounts = [
        serverAccount({
          position: 1,
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
        }),
      ];
      method = BANK;
      savedAt = "2026-08-26T12:00:00.000Z";

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(capsule().querySelector("[data-pp-resumed]")).not.toBeNull();
      // What he held is still held, and the protected half comes back MASKED as it always has.
      expect(field("institution", accountCard(1)).value).toBe("Frost Bank");
      expect(accountCard(1).textContent).toMatch(/••••0021/);

      // He can still leave and come back: the abandonment action is here, and it is truthful.
      expect(capsule().querySelector('[data-pp-action="save"]')).not.toBeNull();

      // And the server will not let him put it in force.
      expect(authorizationView().available).toBe(false);
      expect(authorizationView().blockers).toEqual(["PROPOSAL_NOT_REVIEW_READY"]);
    });

    it("shows him WHY he cannot sign yet, in his own words and never as a code", async () => {
      await reachBankAuthorization();

      // The server changes its mind between reads: the proposal stopped being admissible.
      vi.mocked(getOwnPayrollPaymentAuthorization).mockResolvedValueOnce({
        ...authorizationView(),
        review: null,
        available: false,
        blockers: ["PROPOSAL_NOT_REVIEW_READY"],
      });
      fireEvent.click(action("change"));
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      fireEvent.click(action("review"));

      const blocked = await stage("BLOCKED");
      expect(blocked.textContent).toMatch(/Finish the payment details above/i);
      expect(blocked.textContent).not.toContain("PROPOSAL_NOT_REVIEW_READY");
      expect(capsule().querySelector("[data-capture-pad]")).toBeNull();
    });

    /* --------------------------------------- 10: nothing downstream is done */

    it("represents no card fulfilment as done, and offers no way to ask for one", async () => {
      await reachCardAuthorization();
      await sign();
      const done = await stage("EXECUTED");

      const text = done.textContent ?? "";
      expect(text).not.toMatch(/card (number|is ready|is active|was issued|has been (sent|mailed|shipped|assigned|activated))/i);
      expect(text).not.toMatch(/activated|shipped|mailed|in the (mail|post)/i);
      expect(text).not.toMatch(/Comdata (has been|was) (contacted|notified|sent)/i);

      // And no control that could start it. Gate 10D is MW4H's work, not a button on his screen.
      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.textContent ?? "",
      );
      expect(controls.join(" ")).not.toMatch(/card|order|activate|fulfil/i);
    });

    /* ------------------------------------- the boundary the browser can see */

    it("never completes the module itself, and never sees a banking value", async () => {
      await reachBankAuthorization();
      await sign();
      await stage("EXECUTED");

      /*
        COMPLETION IS THE SERVER'S. The runtime's completion call is not made by this capsule at
        any point, including after the act - what finished this module is derived from the
        instruction, the act, and the binding between them, all of which are the server's facts.
      */
      expect(completeOnboardingModule).not.toHaveBeenCalled();

      expect(capsule().outerHTML).not.toContain(ACCOUNT);
      expect(capsule().outerHTML).not.toContain(ROUTING);
      const sent = JSON.stringify(vi.mocked(authorizeOwnPayrollPayment).mock.calls);
      expect(sent).not.toContain(ACCOUNT);
      expect(sent).not.toContain(ROUTING);
    });

    it("offers NO way to change instructions already in force, HERE", async () => {
      await reachBankAuthorization();
      await sign();
      const done = await stage("EXECUTED");

      /*
        [AMENDED BY GATE 10C-E3 SLICE 4, AND WHAT IT GUARDS IS NARROWER AND STRONGER THAN BEFORE.

        WHAT IT USED TO SAY was that changing instructions in force was deferred and unbuilt, so no
        control for it could exist anywhere in this capsule. That premise has been superseded: a
        worker whose record the SERVER says needs checking is now shown it and can replace it, and
        the last step of that replacement is this same signature.

        WHAT IT SAYS NOW is that the change path is not reachable FROM HERE, and every worker in
        this suite is exactly the worker it must not be reachable for: he has just signed his
        FIRST instruction in a hire packet, and the verification authority answers `NOT_APPLICABLE`
        for him throughout (see the mock at the head of this file). So this screen offers him no
        confirm question, no change control and no PRE_DISPATCH wording - and the sentence about
        telling us, which needs no control, is still the whole of what he is told.

        THE OTHER HALF IS GUARDED WHERE IT BELONGS. That a worker the server IS asking gets the
        question, both answers, and a replacement anchored to the record he was shown is proved in
        `payroll-payment.verification.test.tsx`. Between the two files the property is complete: the
        change path exists only where the server asks for it, and nowhere else.]
      */
      expect(done.querySelector("[data-pp-executed-change]")?.textContent).toMatch(
        /tell us and we will record new instructions/i,
      );
      const controls = Array.from(capsule().querySelectorAll("button"));
      expect(controls.map((button) => button.textContent ?? "").join(" ")).not.toMatch(
        /change|update|confirm|replace/i,
      );
      expect(capsule().textContent).not.toMatch(/before (your pay|dispatch)|confirm these are still/i);
      // Nothing on this journey asked the verification surface for anything but its answer, and
      // nothing affirmed or replaced a record on the strength of it.
      expect(capsule().querySelector("[data-pp-verify]")).toBeNull();
      expect(capsule().querySelector('[data-pp-verify-action="yes"]')).toBeNull();
    });

    it("carries NO replacement claim on a first authorization (Gate 10C-E3 slice 4)", async () => {
      /*
        THE DEFAULT, PROVED WHERE THE ORDINARY JOURNEY IS. Slice 4 gave this request an optional
        replacement claim, and the one thing that must never happen is it being filled in on its
        own: an authorization that named a record to supersede without the worker having asked to
        change anything would supersede instructions nobody asked about. Nothing infers it, so
        this journey - the only journey in this suite - sends nothing.
      */
      await reachBankAuthorization();
      await sign();
      await stage("EXECUTED");

      const [, body] = vi.mocked(authorizeOwnPayrollPayment).mock.calls[0];
      expect((body as { replaces?: unknown }).replaces ?? null).toBeNull();
    });

    it("signs ONCE: a second attempt is refused and told plainly", async () => {
      await reachBankAuthorization();
      await sign();
      await stage("EXECUTED");

      // The card is gone with the act, so there is nothing left to click twice.
      expect(capsule().querySelector("[data-execution-submit]")).toBeNull();
      expect(vi.mocked(authorizeOwnPayrollPayment).mock.calls).toHaveLength(1);
    });

    it("says plainly when nothing was put in force, and blames nobody", async () => {
      await reachBankAuthorization();
      vi.mocked(authorizeOwnPayrollPayment).mockRejectedValueOnce(
        new Refusal("INSTRUCTION_BINDING_UNAVAILABLE"),
      );
      await sign();

      const refusalNotice = await waitFor(() => {
        const element = capsule().querySelector("[data-pp-authorize-refusal]");
        if (!element) throw new Error("no refusal shown");
        return element as HTMLElement;
      });
      expect(refusalNotice.textContent).toMatch(/nothing was put in force/i);
      expect(refusalNotice.textContent).not.toContain("INSTRUCTION_BINDING_UNAVAILABLE");
      expect(capsule().querySelector('[data-pp-authorize-state="EXECUTED"]')).toBeNull();
    });

    it("shows what is on record when he comes back to a finished module", async () => {
      authorizedAt = "2026-09-01T15:00:00.000Z";
      method = BANK;
      accounts = [
        serverAccount({
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          confirmedAt: "2026-08-26T12:00:00.000Z",
        }),
      ];
      savedAt = "2026-08-26T12:00:00.000Z";

      vi.mocked(getOnboardingRuntime).mockResolvedValue(
        fixtureRuntime({
          packets: [
            fixturePacket({ modules: [payrollModule({ status: "COMPLETE" })] }),
          ],
        }),
      );
      render(
        <OnboardingRuntimeProvider>
          <OnboardingModuleHost
            invocationId={INVOCATION_ID}
            moduleSlug={MODULE_SLUG}
            stepSlug={STEP}
          />
        </OnboardingRuntimeProvider>,
      );

      const done = await stage("EXECUTED");
      expect(done.textContent).toContain("Payroll Payment complete");
      // Not the entry form, and not an invitation to carry on with something already finished.
      expect(capsule().querySelector("[data-pp-method-choice]")).toBeNull();
      expect(capsule().querySelector("[data-pp-resumed]")).toBeNull();
      expect(capsule().outerHTML).not.toContain(ACCOUNT);
      expect(capsule().outerHTML).not.toContain(ROUTING);
    });

    /* ------------------------------- the recorded list, as React sees it */

    /**
     * The recorded accounts are a real list, so React holds them to a real list's rules.
     *
     * This escaped to a live browser because the fake server was kinder than the real one: it
     * returned the interview's account views for the recorded outcome, `accountId` included, so a
     * list keyed on that field looked correct in every test and warned on the one response that
     * matters. The fake no longer supplies it, and these assert what is left.
     */
    describe("what is on record renders as a well-formed list", () => {
      /*
        THE CONSOLE PROOF IS NOT HERE, AND THAT IS DELIBERATE. React warns about a missing key once
        per component per React instance, and several tests above render this component's executed
        stage first - so an assertion on `console.error` in this file would be silent whether the
        keys were sound or not. It lives in PayrollPaymentAuthorization.recorded-list.test.tsx,
        which gets a fresh registry. What is asserted here is the end-to-end shape: that the real
        worker path produces a list whose rows are distinct, ordered by the server, and free of any
        protected value.
      */

      it("keys MULTIPLE recorded accounts uniquely and deterministically", async () => {
        authorizedAt = "2026-09-01T15:00:00.000Z";
        method = BANK;
        mode = "PERCENTAGE";
        accounts = [
          serverAccount({
            position: 1,
            accountType: "CHECKING",
            financialInstitutionName: "Frost Bank",
            routingNumber: ROUTING,
            accountNumber: ACCOUNT,
            allocationKind: "PERCENTAGE",
            allocationPercentage: "60",
            confirmedAt: "2026-08-26T12:00:00.000Z",
          }),
          serverAccount({
            position: 2,
            accountType: "SAVINGS",
            financialInstitutionName: "Frost Bank",
            routingNumber: ROUTING,
            accountNumber: "9876543210",
            allocationKind: "PERCENTAGE",
            allocationPercentage: "40",
            confirmedAt: "2026-08-26T12:00:00.000Z",
          }),
        ];
        savedAt = "2026-08-26T12:00:00.000Z";
        vi.mocked(getOnboardingRuntime).mockResolvedValue(
          fixtureRuntime({
            packets: [
              fixturePacket({ modules: [payrollModule({ status: "COMPLETE" })] }),
            ],
          }),
        );

        render(
          <OnboardingRuntimeProvider>
            <OnboardingModuleHost
              invocationId={INVOCATION_ID}
              moduleSlug={MODULE_SLUG}
              stepSlug={STEP}
            />
          </OnboardingRuntimeProvider>,
        );
        const done = await stage("EXECUTED");

        const rendered = Array.from(
          done.querySelectorAll("[data-pp-executed-account]"),
        ).map((node) => node.getAttribute("data-pp-executed-account"));
        expect(rendered).toEqual(["1", "2"]);
        // Unique, and in the server's order rather than one this screen chose.
        expect(new Set(rendered).size).toBe(rendered.length);
      });

      it("needs no protected banking value to identify a row", async () => {
        await reachBankAuthorization();
        await sign();
        const done = await stage("EXECUTED");

        /*
          The key is `position`, and the proof that no banking value is standing in for identity is
          that neither full value appears anywhere in the rendered markup - attributes included.
          A key built from a routing or account number would have to.
        */
        const row = done.querySelector("[data-pp-executed-account]") as HTMLElement;
        expect(row.getAttribute("data-pp-executed-account")).toBe("1");
        for (const attribute of Array.from(row.attributes)) {
          expect(attribute.value).not.toContain(ACCOUNT);
          expect(attribute.value).not.toContain(ROUTING);
        }
        expect(done.outerHTML).not.toContain(ACCOUNT);
        expect(done.outerHTML).not.toContain(ROUTING);
      });

      it("still says what it said before, and shows only masked digits", async () => {
        await reachBankAuthorization();
        await sign();
        const done = await stage("EXECUTED");

        // The worker-facing outcome is untouched by the key correction.
        expect(done.textContent).toContain("Payroll Payment complete");
        expect(done.querySelector('[data-pp-outcome="DEPOSIT"]')?.textContent).toBe(
          "Your payroll payment instructions have been saved and are now in effect.",
        );
        const row = done.querySelector("[data-pp-executed-account]") as HTMLElement;
        expect(row.textContent).toContain("Frost Bank");
        expect(row.textContent).toContain(ACCOUNT.slice(-4));
        expect(row.textContent).not.toContain(ACCOUNT);
      });
    });
  });

  describe("the Gate 10B boundary, as the browser can see it", () => {
    it("NEVER COMPLETES THE MODULE, by any route through the screen", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));
      fireEvent.click(action("review"));
      await waitFor(() => expect(capsule().querySelector("[data-pp-review]")).not.toBeNull());

      expect(completeOnboardingModule).not.toHaveBeenCalled();
    });

    it("writes nothing to the runtime's shared debounced draft", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, { routing: ROUTING, account: ACCOUNT, confirmation: ACCOUNT });

      expect(saveRuntimeModuleDraft).not.toHaveBeenCalled();
    });

    it("PERSISTS NO BANKING VALUE IN THE BROWSER, anywhere it could be read back", async () => {
      const setLocal = vi.spyOn(window.localStorage, "setItem");
      const setSession = vi.spyOn(window.sessionStorage, "setItem");
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      const wrote = [...setLocal.mock.calls, ...setSession.mock.calls]
        .map((call) => JSON.stringify(call))
        .join(" ");
      expect(wrote).not.toContain(ACCOUNT);
      expect(wrote).not.toContain(ROUTING);

      const storage = [
        JSON.stringify(window.localStorage),
        JSON.stringify(window.sessionStorage),
        document.cookie,
        window.location.href,
        window.location.search,
      ].join(" ");
      expect(storage).not.toContain(ACCOUNT);
      expect(storage).not.toContain(ROUTING);

      const said = [log, warn, error]
        .flatMap((spy) => spy.mock.calls)
        .map((call) => JSON.stringify(call))
        .join(" ");
      expect(said).not.toContain(ACCOUNT);
      expect(said).not.toContain(ROUTING);

      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    });

    it("keeps no banking value in a key, an id or a data attribute", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, { routing: ROUTING, account: ACCOUNT, confirmation: ACCOUNT });

      for (const element of Array.from(capsule().querySelectorAll("*"))) {
        for (const attribute of Array.from(element.attributes)) {
          if (attribute.name === "value") continue;
          expect(attribute.value).not.toContain(ACCOUNT);
          expect(attribute.value).not.toContain(ROUTING);
        }
      }
    });
  });
});
