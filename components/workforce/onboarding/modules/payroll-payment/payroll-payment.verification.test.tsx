/**
 * Module 4.4 Gate 10C-E3 - the worker checking how he already gets paid.
 *
 * A DIFFERENT SITUATION FROM THE ONE THE DELIVERED SUITE EXERCISES, which is why it is a different
 * file rather than more cases in that one. There, a worker is stating his payroll instructions for
 * the first time and there is nothing in force. Here, there already is: he was paid this way last
 * month, something asked for his record to be checked before he is sent out again, and the whole
 * question on his screen is whether that arrangement is still the one he wants.
 *
 * WHAT THIS SUITE IS ANSWERABLE FOR:
 *
 *  - THE SERVER DECIDES WHETHER HE IS ASKED AT ALL. Five answers, five behaviours, and the browser
 *    invents none of them: it does not conclude from a saved draft, from an instruction existing or
 *    from any date that a worker owes an answer.
 *  - WHAT HE IS SHOWN IS MASKED AND HE IS SHOWN NOTHING ELSE. No full routing or account number, no
 *    record identity, no candidate, no version, no effective date, no card fulfilment.
 *  - "YES" AFFIRMS THE EXACT RECORD ON HIS SCREEN. The identity that goes back is the one that came
 *    with what he read, never a fresher one fetched at the moment he pressed the button.
 *  - "NO" AUTHORIZES NOTHING. It opens the interview he filled in the first time and REMEMBERS WHICH
 *    RECORD HE IS REPLACING, and that memory reaches exactly one place: the signature at the end.
 *  - AN ORDINARY AUTHORIZATION STILL CARRIES NO REPLACEMENT CLAIM. Nothing infers one.
 *  - WHEN THE RECORD MOVES UNDER HIM, NOTHING IS RETRIED AND NOTHING IS RE-AIMED. His claim is
 *    dropped, the authority is read again, and he is put back in front of what is actually in force.
 *
 * THE FAKE SERVER BELOW APPLIES THE GOVERNED RULES the delivered backend applies - the identity
 * comparison, the default refusal, the supersession - rather than echoing what it is sent. A fake
 * that accepted any identity would let every assertion below pass while proving none of them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import type {
  PayrollPaymentAccountView,
  PayrollPaymentAuthorization,
  PayrollPaymentConfirmation,
  PayrollPaymentInstructionView,
  PayrollPaymentInterview,
  PayrollPaymentRecordedAccountView,
  PayrollPaymentReview,
  PayrollPaymentVerification,
  PayrollPaymentVerificationState,
  PayrollPaymentViolation,
  SavePayrollPaymentInterviewInput,
} from "@/lib/workforce/payrollPaymentApi";
import type { OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";

const push = vi.fn();

/* Two things a browser has and jsdom does not, copied from the delivered execution suite so the
   signature at the end of a replacement runs the same drawing path a worker's pointer runs. */
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
  confirmOwnPayrollPaymentVerification,
} = await import("@/lib/workforce/payrollPaymentApi");
const { OnboardingRuntimeProvider } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext"
);
const { default: OnboardingModuleHost } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingModuleHost"
);
const { INVOCATION_ID, fixtureModule, fixturePacket, fixtureRuntime, step } = await import(
  "@/components/workforce/onboarding/runtime/runtimeTestFixtures"
);

/** Production registration, imported for its side effect exactly as the worker layout does. */
await import("./register.worker");

const MODULE_KEY = "PAYROLL_PAYMENT";
const MODULE_SLUG = "payroll-payment";
const STEP = "payment-method";

const BANK = "DIRECT_DEPOSIT";
const CARD = "COMDATA_PAYROLL_CARD";

/**
 * The record identities, and they are deliberately unmistakable strings.
 *
 * A worker must never see one, so every "is it on the screen" assertion below scans for these
 * exact values. A realistic-looking identifier would make a leak hard to spot; these cannot hide.
 */
const IN_FORCE_ID = "ppi_the_one_he_reviewed_9f3";
const OTHER_ID = "ppi_something_else_entirely_44b";
const CANDIDATE_ID = "cand_never_from_the_browser_7a2";

/** Real banking values, used to prove they are never held, shown or sent by this journey. */
const OLD_ROUTING = "021000021";
const OLD_ACCOUNT = "1234567890";
const NEW_ROUTING = "011401533";
const NEW_ACCOUNT = "9876543210";

/* -------------------------------------------------------------------------- */
/*  The fake server                                                            */
/* -------------------------------------------------------------------------- */

class Refusal extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type DraftAccount = {
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

/** What is IN FORCE: an immutable version, and the only thing the verification read describes. */
type Instruction = {
  id: string;
  setVersion: number;
  paymentMethod: string;
  allocationMode: string | null;
  accounts: {
    position: number;
    accountType: string;
    financialInstitutionName: string;
    allocationKind: string;
    allocationPercentage: string | null;
    routingNumber: string;
    accountNumber: string;
  }[];
  effectiveFrom: string;
  supersededAt: string | null;
  /**
   * WHEN THE GOVERNED ACT BOUND TO THIS VERSION WAS PERFORMED (Gate 10C-E3 slice 4 correction).
   *
   * [ADDED BY THE SLICE 4 FAKE CORRECTION, and it is the invariant this fake was missing.] The
   * server holds this as `executionRecordId` on the instruction, and its rule is absolute: AN
   * INSTRUCTION WITH NO BINDING IS NOT AN AUTHORIZATION. An operative row that nobody signed
   * cannot arise from the ordered path and cannot survive one, so it does not exist in production.
   *
   * IT USED TO BE ONE MODULE-LEVEL `authorizedAt`, WHICH IS WHY THE DEFECT SHIPPED. That variable
   * started null and was set only when a TEST performed the act, so it modelled "did this test
   * sign" rather than "is there an authorized instruction on record". The seeded stale record was
   * therefore operative and unbound - a state the backend states is impossible, and doubly so
   * here, because a record can only be RECORD_STALE if it was authorized in the first place. Every
   * replacement test in this file ran against a precondition production cannot produce, and the
   * stage they asserted was one no worker could reach. It belongs to the VERSION, as it does on
   * the server.
   */
  authorizedAt: string | null;
};

let history: Instruction[] = [];
let verdict: PayrollPaymentVerificationState = "RECORD_STALE";
/** Which record the outstanding verdict was reached about. Null models a verdict naming none. */
let verdictAbout: string | null = null;
let confirmations: string[] = [];
let replacementClaims: (string | null)[] = [];

let method: string | null = null;
let mode: string | null = null;
let draft: DraftAccount[] = [];
let savedAt: string | null = null;
let minted = 0;
/** Every replacement identity the AUTHORIZATION READ was told about, in order. */
let authorizationReadClaims: (string | null)[] = [];

function operative(): Instruction | null {
  return history.find((row) => row.supersededAt === null) ?? null;
}

/**
 * The operative instruction, but only where a governed act is bound to it.
 *
 * The server's own `operativeAuthorized`, reproduced because the stage turns on it: an unbound row
 * is not an authorization and must never be reported as one.
 */
function operativeAuthorized(): Instruction | null {
  const effective = operative();
  if (effective === null) return null;
  return effective.authorizedAt === null ? null : effective;
}

/**
 * A record IN FORCE, which means AUTHORIZED AND BOUND (Gate 10C-E3 slice 4 correction).
 *
 * The default is now William's shape: an instruction he signed on 1 September and which still
 * governs his pay. That is the only shape a stale verification can be about, and asserting against
 * anything else is asserting against a state no worker can be in.
 */
function instructionInForce(overrides: Partial<Instruction> = {}): Instruction {
  return {
    id: IN_FORCE_ID,
    setVersion: 1,
    paymentMethod: BANK,
    allocationMode: "FIXED_AMOUNT_REMAINDER",
    accounts: [
      {
        position: 1,
        accountType: "CHECKING",
        financialInstitutionName: "Frost Bank",
        allocationKind: "REMAINING_BALANCE",
        allocationPercentage: null,
        routingNumber: OLD_ROUTING,
        accountNumber: OLD_ACCOUNT,
      },
    ],
    effectiveFrom: "2026-02-01",
    supersededAt: null,
    authorizedAt: "2026-09-01T09:00:00.000Z",
    ...overrides,
  };
}

function resetServer(): void {
  history = [instructionInForce()];
  verdict = "RECORD_STALE";
  verdictAbout = IN_FORCE_ID;
  confirmations = [];
  replacementClaims = [];
  method = null;
  mode = null;
  draft = [];
  savedAt = null;
  minted = 0;
  authorizationReadClaims = [];
}

function mask(value: string): string {
  return `••••${value.replace(/\D/g, "").slice(-4)}`;
}

function toInstructionView(record: Instruction): PayrollPaymentInstructionView {
  return {
    setVersion: record.setVersion,
    paymentMethod: record.paymentMethod as PayrollPaymentInstructionView["paymentMethod"],
    allocationMode:
      record.allocationMode as PayrollPaymentInstructionView["allocationMode"],
    routingVerificationMethod: null,
    accountConfirmationMethod: "INDEPENDENT_SECOND_ENTRY",
    effectiveFrom: record.effectiveFrom,
    supersededAt: record.supersededAt,
    superseded: record.supersededAt !== null,
    accounts: record.accounts.map((account) => ({
      position: account.position,
      accountType:
        account.accountType as PayrollPaymentInstructionView["accounts"][number]["accountType"],
      financialInstitutionName: account.financialInstitutionName,
      institutionSource: "WORKER_SELF_REPORTED",
      allocationKind:
        account.allocationKind as PayrollPaymentInstructionView["accounts"][number]["allocationKind"],
      allocationPercentage: account.allocationPercentage,
      allocationAmount: null,
      // MASKED HERE, exactly as the read-security boundary masks them. The full values live in
      // this fake's own state and there is no response shape that could carry one out.
      routingNumberMasked: mask(account.routingNumber),
      accountNumberMasked: mask(account.accountNumber),
    })),
  };
}

/** The verification read, as the delivered service builds it. */
function verificationView(): PayrollPaymentVerification {
  const evaluatedAt = "2026-09-03T12:00:00.000Z";
  if (verdict !== "RECORD_STALE") {
    return { state: verdict, instructionId: null, instruction: null, evaluatedAt };
  }
  const effective = operative();
  // A verdict about no record, or about one that has since moved, is a read race and not a verdict.
  if (verdictAbout === null || effective === null || effective.id !== verdictAbout) {
    return {
      state: "RECORD_CHANGED",
      instructionId: null,
      instruction: null,
      evaluatedAt,
    };
  }
  return {
    state: "RECORD_STALE",
    instructionId: effective.id,
    instruction: toInstructionView(effective),
    evaluatedAt,
  };
}

/** The affirmation, screened the way the delivered confirmation authority screens it. */
function confirm(instructionId: string): PayrollPaymentConfirmation {
  if (verdict === "NOT_APPLICABLE") throw new Refusal("VERIFICATION_NOT_APPLICABLE");
  if (verdict === "RECORD_ABSENT") throw new Refusal("NO_EFFECTIVE_INSTRUCTION");
  const effective = operative();
  if (effective === null) throw new Refusal("NO_EFFECTIVE_INSTRUCTION");
  if (verdictAbout === null || effective.id !== verdictAbout) {
    throw new Refusal("VERIFICATION_REFRESH_REQUIRED");
  }
  if (effective.id !== instructionId) {
    throw new Refusal("VERIFICATION_INSTRUCTION_MISMATCH");
  }
  const first = !confirmations.includes(instructionId);
  if (first) confirmations.push(instructionId);
  verdict = "SATISFIED";
  return { instructionId: effective.id, confirmationRecorded: first };
}

/* ------------------------------------------------------------------ the draft */

function mintAccountId(): string {
  minted += 1;
  return `acct-${minted}`;
}

function violationsOf(): PayrollPaymentViolation[] {
  const found: PayrollPaymentViolation[] = [];
  if (method !== BANK) return found;
  if (draft.length === 0) {
    found.push({ code: "DEPOSIT_ACCOUNT_REQUIRED", position: null, field: "accounts" });
  }
  if (mode === null) {
    found.push({
      code: "ALLOCATION_MODE_REQUIRED",
      position: null,
      field: "allocationMode",
    });
  }
  for (const account of draft) {
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
    if (!/^\d{9}$/.test(account.routingNumber)) {
      found.push({
        code: "ROUTING_NUMBER_REQUIRED",
        position: account.position,
        field: "routingNumber",
      });
    }
    if (account.accountNumber === "") {
      found.push({
        code: "ACCOUNT_NUMBER_INVALID",
        position: account.position,
        field: "accountNumber",
      });
    }
  }
  return found;
}

function accountViews(): PayrollPaymentAccountView[] {
  return draft.map((account) => ({
    accountId: account.accountId,
    position: account.position,
    accountType: account.accountType as PayrollPaymentAccountView["accountType"],
    financialInstitutionName: account.financialInstitutionName,
    routingNumberEntered: account.routingNumber !== "",
    routingNumberMasked:
      account.routingNumber === "" ? null : mask(account.routingNumber),
    accountNumberEntered: account.accountNumber !== "",
    accountNumberMasked:
      account.accountNumber === "" ? null : mask(account.accountNumber),
    allocationKind: account.allocationKind as PayrollPaymentAccountView["allocationKind"],
    allocationPercentage: account.allocationPercentage,
    allocationAmount: account.allocationAmount,
    accountConfirmationMethod: account.confirmedAt ? "INDEPENDENT_SECOND_ENTRY" : null,
    accountConfirmationRecordedAt: account.confirmedAt,
  }));
}

function interviewView(): PayrollPaymentInterview {
  const violations = violationsOf();
  return {
    paymentMethod: method as PayrollPaymentInterview["paymentMethod"],
    allocationMode: mode as PayrollPaymentInterview["allocationMode"],
    accounts: accountViews(),
    maxDepositAccounts: 3,
    canAddAccount: method === BANK && draft.length < 3,
    violations,
    readyForReview: method !== null && violations.length === 0,
    savedAt,
  };
}

function save(input: SavePayrollPaymentInterviewInput): PayrollPaymentInterview {
  if (input.paymentMethod !== undefined) method = input.paymentMethod;
  if (input.allocationMode !== undefined) mode = input.allocationMode;

  if (input.accounts !== undefined && input.accounts !== null) {
    draft = input.accounts.map((submitted, index) => {
      const held = draft.find((row) => row.accountId === submitted.accountId);
      const entry = (submitted.accountNumber ?? "").trim();
      const again = (submitted.accountNumberConfirmation ?? "").trim();
      let accountNumber = held?.accountNumber ?? "";
      let confirmedAt = held?.confirmedAt ?? null;
      if (held === undefined || entry !== "" || again !== "") {
        if (entry === "" || again === "") {
          throw new Refusal("ACCOUNT_NUMBER_CONFIRMATION_REQUIRED");
        }
        if (entry !== again) throw new Refusal("ACCOUNT_NUMBER_CONFIRMATION_MISMATCH");
        accountNumber = entry;
        confirmedAt = "2026-09-03T12:05:00.000Z";
      }
      const routing = (submitted.routingNumber ?? "").trim();
      return {
        accountId: held?.accountId ?? mintAccountId(),
        position: index + 1,
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
    });
  }
  if (method !== BANK) draft = [];
  savedAt = "2026-09-03T12:05:00.000Z";
  return interviewView();
}

function reviewView(): PayrollPaymentReview {
  return {
    paymentMethod: method as PayrollPaymentReview["paymentMethod"],
    allocationMode: mode as PayrollPaymentReview["allocationMode"],
    accounts: accountViews(),
    accountConfirmationMethod:
      draft.length > 0 && draft.every((row) => row.confirmedAt !== null)
        ? "INDEPENDENT_SECOND_ENTRY"
        : null,
    authorized: false,
    moduleComplete: false,
  };
}

/* ------------------------------------------------------------ the governed act */

const AUTHORIZATION_REVISION = "10C.1";
const AUTHORIZATION_HASH = "c".repeat(64);

/**
 * The governed subject, as the DELIVERED execution foundation projects it.
 *
 * `requiresExecution` IS THE FOUNDATION'S ANSWER ABOUT THE RECORD, NOT ABOUT THE SCREEN, and this
 * is where the corrected invariant does its work. The foundation asks whether an act is in force
 * against the operative governed record - so a worker whose 1 September signature still binds the
 * instruction that still governs his pay needs no further act, and `requiresExecution` is false
 * from the moment the fixture is seeded. It only becomes true again when a NEW effective
 * instruction exists, which on the ordered path is created by the act itself.
 *
 * THAT IS THE CHICKEN AND EGG THE CLAIM EXISTS TO BREAK, and modelling it honestly is what makes
 * the regression below real: nothing about the record can tell the read that he is replacing.
 */
function authorizationSubject(): OnboardingExecutionSubject {
  const bound = operativeAuthorized();
  const done = bound !== null;
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
      lines: [
        {
          label:
            "I authorize Millwrights4Hire to use the payroll payment information I provided to pay wages owed to me using the payment method I selected.",
          field: null,
        },
      ],
    },
    current: done
      ? {
          executionId: "exec-payroll-2",
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
          executedAt: bound?.authorizedAt as string,
          supersededAt: null,
          supersedesId: null,
        }
      : null,
    history: [],
    requiresExecution: !done,
  };
}

/**
 * What is ON RECORD, projected from the INSTRUCTION rather than from the draft.
 *
 * [CORRECTED BY GATE 10C-E3 SLICE 4.] This used to map `accountViews()`, which is the draft he is
 * editing - so the "already in force" panel described his UNSAVED replacement instead of the
 * record it is reporting. The server maps `instruction.accounts`, and the difference is exactly
 * what the owner saw in the browser: the terminal panel named the OLD bank while the review above
 * it named the new one. Masked here, as the read-security boundary masks them.
 */
function recordedAccountViews(
  instruction: Instruction,
): PayrollPaymentRecordedAccountView[] {
  return instruction.accounts.map((account) => ({
    position: account.position,
    accountType:
      account.accountType as PayrollPaymentRecordedAccountView["accountType"],
    financialInstitutionName: account.financialInstitutionName,
    routingNumberEntered: true,
    routingNumberMasked: mask(account.routingNumber),
    accountNumberEntered: true,
    accountNumberMasked: mask(account.accountNumber),
    allocationKind:
      account.allocationKind as PayrollPaymentRecordedAccountView["allocationKind"],
    allocationPercentage: account.allocationPercentage,
    allocationAmount: null,
    accountConfirmationMethod: "INDEPENDENT_SECOND_ENTRY",
    accountConfirmationRecordedAt: instruction.authorizedAt,
  }));
}

/**
 * THE AUTHORIZATION READ, modelling the delivered service including Gate 10C-E3 slice 4.
 *
 * MODELLED RATHER THAN STUBBED, and each branch below exists in the backend and is proved there by
 * section M of `payroll-payment.replacement.spec.ts`. The behaviour under test is precisely how
 * the screen responds to each answer, so a fake that returned a convenient one would make every
 * assertion in this file vacuous - which is what the previous version did.
 *
 * THE ORDER MATTERS AND IS THE SERVER'S ORDER. The claim is examined first, so a worker who asked
 * to change his details is never answered as one who asked to authorize twice; `executed` is only
 * ever reported where he is genuinely finished, because the surface renders it ahead of
 * everything else.
 */
function authorizationView(
  claim: string | null = null,
): PayrollPaymentAuthorization {
  const subject = authorizationSubject();
  const effective = operative();
  const bound = operativeAuthorized();
  const guidance = ["This is the last step."];

  // A claim that does not name what is operative: recoverable, and disclosing nothing about what
  // is. One answer for a superseded record, a foreign one and no record at all.
  if (claim !== null && (effective === null || effective.id !== claim)) {
    return {
      review: null,
      available: false,
      blockers: ["REPLACEMENT_INSTRUCTION_MISMATCH"],
      guidance,
      authorization: subject,
      executed: null,
    };
  }

  const replacing = claim !== null;
  const ready = violationsOf().length === 0 && method !== null;

  /*
    THE SUBJECT AS IT STANDS TOWARD THE ACT HE IS ABOUT TO PERFORM (Gate 10C-E3 slice 4).

    Nothing has been performed toward the REPLACEMENT, so nothing is in force against it: the act
    reported by the foundation is bound to the record he is replacing, and the new instruction does
    not exist until he signs. `current` is null for this projection and `requiresExecution` is
    restated to match, exactly as the delivered service does - and exactly as the delivered Federal
    Tax later election does for the same situation.

    WITHOUT IT THE STAGE SAYS READY AND THE CARD STILL OFFERS NO CONTROL, because the delivered
    execution card asks the SUBJECT whether an act is outstanding before it renders the capture
    surface. That is the second gate, and it is why correcting this fake was worth doing: no
    assertion in this file could see it while the seeded record was unbound.
  */
  const toward = replacing
    ? { ...subject, current: null, requiresExecution: true }
    : subject;

  if (!replacing && bound !== null && !subject.requiresExecution) {
    return {
      review: null,
      available: false,
      blockers: ["ALREADY_AUTHORIZED"],
      guidance,
      authorization: subject,
      executed: {
        paymentMethod: bound.paymentMethod as PayrollPaymentReview["paymentMethod"],
        setVersion: bound.setVersion,
        authorizedAt: bound.authorizedAt as string,
        effectiveFrom: bound.effectiveFrom,
        accounts: recordedAccountViews(bound),
      },
    };
  }

  if (!ready) {
    return {
      review: null,
      available: false,
      blockers: ["PROPOSAL_NOT_REVIEW_READY"],
      guidance,
      authorization: toward,
      executed: null,
    };
  }

  return {
    review: reviewView(),
    available: true,
    blockers: [],
    guidance,
    authorization: toward,
    executed: null,
  };
}

/**
 * THE ACT, WITH THE GOVERNED ADMISSION THE DELIVERED SERVICE APPLIES.
 *
 * Every branch here exists in the backend and is proved there. It is modelled rather than stubbed
 * because the browser behaviour under test is precisely how the screen responds to each of them,
 * and a fake that admitted anything would make all of it vacuous.
 */
function authorize(input: {
  replaces?: { reviewedInstructionId: string } | null;
}): PayrollPaymentAuthorization {
  replacementClaims.push(input.replaces?.reviewedInstructionId ?? null);

  const effective = operative();
  const claim = input.replaces ?? null;

  if (claim !== null) {
    if (effective === null) throw new Refusal("NO_EFFECTIVE_INSTRUCTION");
    if (effective.id !== claim.reviewedInstructionId) {
      throw new Refusal("REPLACEMENT_INSTRUCTION_MISMATCH");
    }
  } else if (effective !== null) {
    // The default that has always stood in front of instructions in force.
    throw new Refusal("ALREADY_AUTHORIZED");
  }

  if (violationsOf().length > 0 || method === null) {
    throw new Refusal("PROPOSAL_NOT_REVIEW_READY");
  }

  /*
    THE ACT CREATES A NEW BOUND VERSION AND SUPERSEDES THE OLD ONE, which is the ordered path: the
    instruction is appended, the act is bound to IT, and the predecessor closes. The binding lands
    on the version rather than on the module, so the record that governs is always the record that
    was signed.
  */
  const authorizedAt = "2026-09-04T09:00:00.000Z";
  if (effective !== null) effective.supersededAt = authorizedAt;
  history.unshift({
    id: "ppi_the_new_one",
    setVersion: (effective?.setVersion ?? 0) + 1,
    authorizedAt,
    paymentMethod: method,
    allocationMode: mode,
    accounts: draft.map((row) => ({
      position: row.position,
      accountType: row.accountType ?? "CHECKING",
      financialInstitutionName: row.financialInstitutionName,
      allocationKind: row.allocationKind ?? "REMAINING_BALANCE",
      allocationPercentage: row.allocationPercentage,
      routingNumber: row.routingNumber,
      accountNumber: row.accountNumber,
    })),
    effectiveFrom: "2026-09-04",
    supersededAt: null,
  });
  // A replacement is naturally current, so there is nothing left to verify.
  verdict = "SATISFIED";
  verdictAbout = null;
  return authorizationView();
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

/** Render the module at the canonical URL and wait for the capsule to have READ something. */
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
  await waitFor(() => {
    const section = document.querySelector<HTMLElement>(".pp-module");
    expect(section).not.toBeNull();
    expect(section?.dataset.ppState).not.toBe("LOADING");
  });
}

function capsule(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".pp-module");
  if (!section) throw new Error("The module did not render.");
  return section;
}

function verifyPanel(): HTMLElement | null {
  return capsule().querySelector<HTMLElement>("[data-pp-verify]");
}

function verifyAction(name: "yes" | "change" | "recheck"): HTMLButtonElement {
  const button = capsule().querySelector<HTMLButtonElement>(
    `[data-pp-verify-action="${name}"]`,
  );
  if (!button) throw new Error(`No ${name} control on the verification screen.`);
  return button;
}

function action(name: string): HTMLElement {
  const button = capsule().querySelector<HTMLElement>(`[data-pp-action="${name}"]`);
  if (!button) throw new Error(`No ${name} control.`);
  return button;
}

function field(name: string, within: HTMLElement): HTMLInputElement {
  const input = within.querySelector<HTMLInputElement>(`[data-pp-field="${name}"]`);
  if (!input) throw new Error(`No field ${name}.`);
  return input;
}

function accountCard(position: number): HTMLElement {
  const card = capsule().querySelector<HTMLElement>(`[data-pp-account="${position}"]`);
  if (!card) throw new Error(`No account ${position}.`);
  return card;
}

function chooseMethod(which: "bank" | "card"): void {
  const control = capsule().querySelector<HTMLElement>(`[data-pp-choice="${which}"] input`);
  if (!control) throw new Error("No method control.");
  fireEvent.click(control);
}

function typeInto(input: HTMLInputElement, value: string): void {
  let held = "";
  for (const character of value) {
    held += character;
    fireEvent.change(input, { target: { value: held } });
  }
}

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

async function sign(): Promise<void> {
  const surface = capsule().querySelector<HTMLCanvasElement>("[data-capture-pad]");
  if (!surface) throw new Error("no signature surface rendered");
  surface.getBoundingClientRect = () => PAD_RECT;
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
  if (surface.dataset.hasMark !== "true") throw new Error("the draw registered no mark");

  const submit = capsule().querySelector<HTMLButtonElement>("[data-execution-submit]");
  if (!submit) throw new Error("no submit control on the governed card");
  fireEvent.click(submit);
  await waitFor(() => expect(authorizeOwnPayrollPayment).toHaveBeenCalled());
}

/** The authorization stage's own section, once it has read the server. */
async function authorizeStage(state: string): Promise<HTMLElement> {
  await waitFor(() =>
    expect(capsule().querySelector(`[data-pp-authorize-state="${state}"]`)).not.toBeNull(),
  );
  return capsule().querySelector(`[data-pp-authorize-state="${state}"]`) as HTMLElement;
}

/**
 * The whole change journey, from the question to the signature being available.
 *
 * It goes through the SAME controls the delivered interview offers and no others - there is no
 * second form here, and this helper would not compile against one.
 */
async function changeToNewAccount(): Promise<void> {
  await enterNewAccountDetails();
  fireEvent.click(action("review"));
  await authorizeStage("READY");
}

/**
 * The change journey UP TO the point of asking to review, and no further.
 *
 * Split out so a test can let the record move WHILE HE IS TYPING - before the review read rather
 * than after it - which is the window the slice 4 read now closes.
 */
async function enterNewAccountDetails(): Promise<void> {
  await pressChange();
  await fillNewAccount();
}

/** "No - I need to make a change", and the method question it leads to. */
async function pressChange(): Promise<void> {
  fireEvent.click(verifyAction("change"));
  await waitFor(() => expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull());
}

/** Direct deposit, and a complete set of new details on the one account. */
async function fillNewAccount(): Promise<void> {
  chooseMethod("bank");
  await waitFor(() => expect(accountCard(1)).toBeTruthy());
  const card = accountCard(1);
  fireEvent.change(field("institution", card), { target: { value: "Amarillo National" } });
  const type = card.querySelector<HTMLInputElement>('[data-pp-account-type="CHECKING"] input');
  if (!type) throw new Error("no account type control");
  fireEvent.click(type);
  typeInto(field("routing", card), NEW_ROUTING);
  typeInto(field("account", card), NEW_ACCOUNT);
  typeInto(field("account-confirm", card), NEW_ACCOUNT);
}

/** The body of the one authorization request made, as the screen assembled it. */
function authorizedWith(at = 0): Record<string, unknown> {
  const call = vi.mocked(authorizeOwnPayrollPayment).mock.calls[at];
  if (!call) throw new Error("no authorization was attempted");
  return call[1] as unknown as Record<string, unknown>;
}

function refusal(code: string): OnboardingApiError {
  return new OnboardingApiError("refused", 400, code);
}

beforeEach(() => {
  resetServer();
  vi.clearAllMocks();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    applicationSessionId: "apps_durable",
    candidateId: CANDIDATE_ID,
  });
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({ values: {} } as never);
  vi.mocked(saveRuntimeModuleDraft).mockResolvedValue({ values: {} } as never);
  vi.mocked(getOwnPayrollPayment).mockImplementation(async () => interviewView());
  vi.mocked(saveOwnPayrollPayment).mockImplementation(async (_id, input) => save(input));
  vi.mocked(getOwnPayrollPaymentReview).mockImplementation(async () => reviewView());
  /*
    THE READ RECEIVES WHAT THE SCREEN SENDS (Gate 10C-E3 slice 4). The second argument is the
    worker's own replacement claim, recorded so the tests below can assert WHEN it travels as well
    as what comes back for it.
  */
  vi.mocked(getOwnPayrollPaymentAuthorization).mockImplementation(
    async (_id, reviewedInstructionId = null) => {
      authorizationReadClaims.push(reviewedInstructionId ?? null);
      return authorizationView(reviewedInstructionId ?? null);
    },
  );
  vi.mocked(authorizeOwnPayrollPayment).mockImplementation(async (_id, input) =>
    authorize(input),
  );
  vi.mocked(getOwnPayrollPaymentVerification).mockImplementation(async () =>
    verificationView(),
  );
  vi.mocked(confirmOwnPayrollPaymentVerification).mockImplementation(async (_id, input) =>
    confirm(input.instructionId),
  );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/* -------------------------------------------------------------------------- */

describe("Module 4.4 Gate 10C-E3 slice 4 - checking how he already gets paid", () => {
  /* ---------------------------------------------------------------------- A */

  describe("A. the question, when the server asks it", () => {
    it("shows him the record in force and asks one plain question about it", async () => {
      await open();

      const panel = verifyPanel();
      expect(panel).not.toBeNull();
      expect(capsule().dataset.ppState).toBe("CONFIRM");
      expect(panel?.querySelector("h3")?.textContent).toBe("Review how you get paid");
      expect(panel?.textContent).toContain("Is this still how you want to be paid?");

      // Both answers, and both say what they mean without a code, an enum or a warning icon.
      expect(verifyAction("yes").textContent).toBe("Yes - this is still correct");
      expect(verifyAction("change").textContent).toBe("No - I need to make a change");
    });

    it("asks the server FIRST, and does not decide for itself that he should be asked", async () => {
      await open();
      expect(getOwnPayrollPaymentVerification).toHaveBeenCalledWith(INVOCATION_ID);
      // Read, not written. Nothing is affirmed by arriving on the screen.
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
      expect(saveOwnPayrollPayment).not.toHaveBeenCalled();
    });

    it("puts NO record identity on the screen, in any form a page can carry one", async () => {
      await open();

      const html = capsule().outerHTML;
      expect(html).not.toContain(IN_FORCE_ID);
      expect(html).not.toContain(CANDIDATE_ID);
      // Nor the record-keeping facts that came with it and are nobody's business here.
      expect(capsule().textContent).not.toContain("2026-02-01");
      expect(capsule().textContent).not.toMatch(/version/i);
    });

    it("does not invite him to carry on with something unfinished", async () => {
      // He has an interview draft on file, and is still not resuming anything: he is being asked.
      method = BANK;
      savedAt = "2026-09-01T09:00:00.000Z";
      await open();
      expect(capsule().querySelector("[data-pp-resumed]")).toBeNull();
    });
  });

  /* ---------------------------------------------------------------------- B */

  describe("B. what the direct deposit record shows him", () => {
    it("shows the masked values and no whole number anywhere on the page", async () => {
      await open();

      const panel = verifyPanel() as HTMLElement;
      expect(
        panel.querySelector("[data-pp-verify-routing]")?.textContent,
      ).toBe("••••0021");
      expect(
        panel.querySelector("[data-pp-verify-account-number]")?.textContent,
      ).toBe("••••7890");
      expect(panel.querySelector("[data-pp-verify-method]")?.textContent).toBe(
        "Direct Deposit into your own account",
      );
      expect(panel.querySelector("[data-pp-verify-account-type]")?.textContent).toBe(
        "Checking",
      );
      expect(panel.querySelector("[data-pp-verify-share]")?.textContent).toBe(
        "Whatever is left of your pay",
      );

      expect(capsule().outerHTML).not.toContain(OLD_ROUTING);
      expect(capsule().outerHTML).not.toContain(OLD_ACCOUNT);
      expect(document.body.textContent ?? "").not.toContain(OLD_ACCOUNT);
    });

    it("says plainly that the whole numbers cannot be shown to anyone", async () => {
      await open();
      expect(verifyPanel()?.textContent).toContain(
        "We only ever show you the last few digits",
      );
    });

    it("describes a split the same way the review does, from the same words", async () => {
      history = [
        instructionInForce({
          allocationMode: "PERCENTAGE",
          accounts: [
            {
              position: 1,
              accountType: "CHECKING",
              financialInstitutionName: "Frost Bank",
              allocationKind: "PERCENTAGE",
              allocationPercentage: "60",
              routingNumber: OLD_ROUTING,
              accountNumber: OLD_ACCOUNT,
            },
            {
              position: 2,
              accountType: "SAVINGS",
              financialInstitutionName: "Amarillo National",
              allocationKind: "PERCENTAGE",
              allocationPercentage: "40",
              routingNumber: OLD_ROUTING,
              accountNumber: "5555555555",
            },
          ],
        }),
      ];
      await open();

      const shares = Array.from(
        capsule().querySelectorAll("[data-pp-verify-share]"),
      ).map((node) => node.textContent);
      expect(shares).toEqual(["60% of your pay", "40% of your pay"]);
      expect(capsule().querySelectorAll("[data-pp-verify-account]")).toHaveLength(2);
    });
  });

  /* ---------------------------------------------------------------------- C */

  describe("C. what the payroll card record shows him", () => {
    beforeEach(() => {
      history = [
        instructionInForce({
          paymentMethod: CARD,
          allocationMode: null,
          accounts: [],
        }),
      ];
    });

    it("says which way he is paid, and asks the same question", async () => {
      await open();
      expect(capsule().querySelector("[data-pp-verify-method]")?.textContent).toBe(
        "MW4H Comdata Payroll Card",
      );
      expect(capsule().querySelector("[data-pp-verify-card]")).not.toBeNull();
      expect(verifyPanel()?.textContent).toContain("Is this still how you want to be paid?");
    });

    it("carries no card fulfilment of any kind, and no control that could start one", async () => {
      await open();

      const text = capsule().textContent ?? "";
      expect(text).not.toMatch(/card number|activate|activation|issued|shipped|tracking/i);
      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.textContent ?? "",
      );
      expect(controls.join(" ")).not.toMatch(/card|order|activate|fulfil|replace card/i);
      // And no bank rows invented for a worker who has no bank account on record.
      expect(capsule().querySelector("[data-pp-verify-account]")).toBeNull();
      expect(capsule().querySelector("[data-pp-verify-routing]")).toBeNull();
    });
  });

  /* ---------------------------------------------------------------------- D */

  describe("D. what YES sends", () => {
    it("sends the identity of the record he was shown, and only that", async () => {
      await open();
      fireEvent.click(verifyAction("yes"));

      await waitFor(() =>
        expect(confirmOwnPayrollPaymentVerification).toHaveBeenCalledTimes(1),
      );
      const [invocation, body] = vi.mocked(confirmOwnPayrollPaymentVerification).mock
        .calls[0];
      expect(invocation).toBe(INVOCATION_ID);
      expect(body).toEqual({ instructionId: IN_FORCE_ID });
      // The WHOLE body: no candidate, no payment details, no verdict, no freshness.
      expect(Object.keys(body)).toEqual(["instructionId"]);
      expect(JSON.stringify(body)).not.toContain(CANDIDATE_ID);
      expect(JSON.stringify(body)).not.toContain(OLD_ACCOUNT);
    });

    it("sends the identity it was SHOWN, not whichever is current when he presses", async () => {
      await open();

      /*
        THE RECORD MOVES BETWEEN THE SCREEN AND THE PRESS, and the browser does not notice - it is
        not supposed to. What it must not do is go and look: a client that re-read the identity
        here would affirm a record the worker has never seen, and the server's screening would
        have nothing left to catch.
      */
      const moved = instructionInForce({ id: OTHER_ID, setVersion: 2 });
      history = [moved];
      verdictAbout = OTHER_ID;

      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(confirmOwnPayrollPaymentVerification).toHaveBeenCalled(),
      );
      expect(
        vi.mocked(confirmOwnPayrollPaymentVerification).mock.calls[0][1],
      ).toEqual({ instructionId: IN_FORCE_ID });
    });
  });

  /* ---------------------------------------------------------------------- E */

  describe("E. what YES leaves behind", () => {
    it("tells him it is done, claims nothing further, and reads the server again", async () => {
      await open();
      fireEvent.click(verifyAction("yes"));

      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-done]")).not.toBeNull(),
      );
      const done = capsule().querySelector("[data-pp-verify-done]") as HTMLElement;
      expect(done.textContent).toContain("nothing about your payment details has changed");

      // NO PROMISE THIS SCREEN CANNOT KEEP. Not cleared, not ready, not dispatched, not paid.
      expect(done.textContent ?? "").not.toMatch(
        /ready|cleared|approved|dispatch|assign|next paycheck|all set/i,
      );

      // The authoritative re-read, and the module's own completion still nobody's but the server's.
      await waitFor(() =>
        expect(getOwnPayrollPaymentVerification).toHaveBeenCalledTimes(2),
      );
      expect(completeOnboardingModule).not.toHaveBeenCalled();
      expect(saveRuntimeModuleDraft).not.toHaveBeenCalled();
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
    });

    it("offers the ordinary way back, and nothing that touches his record", async () => {
      await open();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-return]")).not.toBeNull(),
      );
      const link = capsule().querySelector("[data-pp-verify-return]") as HTMLAnchorElement;
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toContain(INVOCATION_ID);
    });

    it("does not ask the same question again once he has answered it", async () => {
      await open();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-done]")).not.toBeNull(),
      );
      expect(verifyPanel()).toBeNull();
      expect(capsule().querySelector('[data-pp-verify-action="yes"]')).toBeNull();
    });
  });

  /* ---------------------------------------------------------------------- F */

  describe("F. YES against a record that has moved", () => {
    /**
     * HE READ X, AND Y BECAME CURRENT WHILE HE WAS READING IT.
     *
     * The order matters and is the whole scenario: the screen is drawn from the record actually in
     * force, and only THEN does something else legitimately replace it. A suite that moved the
     * record first would be testing a worker who was shown Y all along, which is not a race and
     * proves nothing about one.
     */
    async function openThenMove(): Promise<void> {
      await open();
      history = [instructionInForce({ id: OTHER_ID, setVersion: 2 })];
      verdictAbout = OTHER_ID;
      vi.mocked(confirmOwnPayrollPaymentVerification).mockRejectedValue(
        refusal("VERIFICATION_INSTRUCTION_MISMATCH"),
      );
    }

    it("explains it, reads the authority again, and asks about what is there now", async () => {
      await openThenMove();
      fireEvent.click(verifyAction("yes"));

      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
      );
      expect(capsule().querySelector("[data-pp-verify-moved]")?.textContent).toContain(
        "changed while this page was open",
      );
      // No code, no identifier, no internal state name.
      expect(capsule().textContent).not.toContain("VERIFICATION_INSTRUCTION_MISMATCH");
      expect(capsule().outerHTML).not.toContain(OTHER_ID);

      await waitFor(() =>
        expect(getOwnPayrollPaymentVerification).toHaveBeenCalledTimes(2),
      );
      // He is asked again, about the record actually in force, and must read it before answering.
      await waitFor(() => expect(verifyPanel()).not.toBeNull());
    });

    it("never retries the affirmation by itself, against the new record or the old", async () => {
      await openThenMove();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
      );

      // One attempt, ever. The recovery is a fresh read, not a resend.
      expect(confirmOwnPayrollPaymentVerification).toHaveBeenCalledTimes(1);
      expect(
        vi.mocked(confirmOwnPayrollPaymentVerification).mock.calls[0][1],
      ).toEqual({ instructionId: IN_FORCE_ID });
    });

    it("does not treat it as a failure of his, and puts nothing in force", async () => {
      await openThenMove();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
      );
      expect(capsule().querySelector("[data-pp-verify-done]")).toBeNull();
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
      expect(confirmations).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------------- G */

  describe("G. the button pressed twice", () => {
    it("asks once, however many times he presses while it is in flight", async () => {
      let release: (value: PayrollPaymentConfirmation) => void = () => {};
      vi.mocked(confirmOwnPayrollPaymentVerification).mockImplementation(
        () =>
          new Promise<PayrollPaymentConfirmation>((resolve) => {
            release = resolve;
          }),
      );

      await open();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-in-flight]")).not.toBeNull(),
      );

      // Both controls are held, and clicking anyway changes nothing.
      expect(verifyAction("yes").disabled).toBe(true);
      expect(verifyAction("change").disabled).toBe(true);
      fireEvent.click(verifyAction("yes"));
      fireEvent.click(verifyAction("yes"));
      expect(confirmOwnPayrollPaymentVerification).toHaveBeenCalledTimes(1);

      release({ instructionId: IN_FORCE_ID, confirmationRecorded: true });
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-done]")).not.toBeNull(),
      );
      expect(confirmOwnPayrollPaymentVerification).toHaveBeenCalledTimes(1);
    });

    it("says what is happening while he waits", async () => {
      let release: (value: PayrollPaymentConfirmation) => void = () => {};
      vi.mocked(confirmOwnPayrollPaymentVerification).mockImplementation(
        () =>
          new Promise<PayrollPaymentConfirmation>((resolve) => {
            release = resolve;
          }),
      );
      await open();
      fireEvent.click(verifyAction("yes"));

      const note = await waitFor(() => {
        const found = capsule().querySelector("[data-pp-verify-in-flight]");
        expect(found).not.toBeNull();
        return found as HTMLElement;
      });
      expect(note.getAttribute("role")).toBe("status");
      release({ instructionId: IN_FORCE_ID, confirmationRecorded: true });
    });
  });

  /* -------------------------------------------------------------------- H, I */

  describe("H. choosing to change something", () => {
    it("authorizes nothing, and opens the interview he filled in the first time", async () => {
      await open();
      fireEvent.click(verifyAction("change"));

      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull(),
      );
      expect(capsule().dataset.ppState).toBe("METHOD");
      expect(verifyPanel()).toBeNull();

      // NOTHING HAPPENED TO HIS RECORD. Choosing to change is not changing.
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
      expect(operative()?.id).toBe(IN_FORCE_ID);
      expect(operative()?.supersededAt).toBeNull();
    });

    it("offers him both ways of being paid again, not only the one he has", async () => {
      await open();
      fireEvent.click(verifyAction("change"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull(),
      );
      expect(capsule().querySelector('[data-pp-choice="bank"]')).not.toBeNull();
      expect(capsule().querySelector('[data-pp-choice="card"]')).not.toBeNull();
    });

    it("prepopulates no banking value from the record he is replacing", async () => {
      await open();
      fireEvent.click(verifyAction("change"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull(),
      );
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      const card = accountCard(1);
      expect(field("routing", card).value).toBe("");
      expect(field("account", card).value).toBe("");
      expect(field("account-confirm", card).value).toBe("");
      expect(capsule().outerHTML).not.toContain(OLD_ROUTING);
      expect(capsule().outerHTML).not.toContain(OLD_ACCOUNT);
    });

    it("leaves EVERY box empty for a worker whose accounts are already on file", async () => {
      /*
        THE CASE THAT ACTUALLY HAS SOMETHING TO PREFILL, and the reason it is a second test rather
        than a variation of the one above. A worker being asked to check a record in force has
        usually stated it through this very screen, so the server is still holding his interview
        draft: rows, institutions, account types and MASKS of the two protected values. Everything
        needed to helpfully fill the boxes back in is right there, and filling them in would be
        wrong twice over - it would put the only value we have, a mask, into a box the server
        validates as a real number, and it would let a screen present held banking data as
        re-entered by him.

        WHAT HE SEES INSTEAD is the delivered protected-entry behaviour, unchanged by this slice:
        his rows, the masks as read-only context, and empty boxes.
      */
      method = BANK;
      mode = "FIXED_AMOUNT_REMAINDER";
      draft = [
        {
          accountId: "acct-existing-1",
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: OLD_ROUTING,
          accountNumber: OLD_ACCOUNT,
          allocationKind: "REMAINING_BALANCE",
          allocationPercentage: null,
          allocationAmount: null,
          confirmedAt: "2026-02-01T09:00:00.000Z",
        },
      ];
      savedAt = "2026-02-01T09:00:00.000Z";

      await open();
      fireEvent.click(verifyAction("change"));
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      const card = accountCard(1);
      expect(field("routing", card).value).toBe("");
      expect(field("account", card).value).toBe("");
      expect(field("account-confirm", card).value).toBe("");
      // Not the mask either: a mask in a box he is meant to type into is a value he did not enter.
      expect(field("routing", card).value).not.toContain("•");
      expect(field("account", card).value).not.toContain("•");
      expect(capsule().outerHTML).not.toContain(OLD_ROUTING);
      expect(capsule().outerHTML).not.toContain(OLD_ACCOUNT);
    });

    it("tells him beforehand that nothing changes until he finishes", async () => {
      await open();
      expect(
        capsule().querySelector("[data-pp-verify-change-note]")?.textContent,
      ).toContain("Nothing changes until you finish and sign");
    });
  });

  describe("I. the record he named, carried to the end", () => {
    it("survives METHOD, DETAILS and REVIEW without being shown or stored", async () => {
      await open();
      await changeToNewAccount();

      // Through every stage, and still nowhere a page or the browser could hold it.
      expect(capsule().outerHTML).not.toContain(IN_FORCE_ID);
      expect(JSON.stringify(window.localStorage)).not.toContain(IN_FORCE_ID);
      expect(JSON.stringify(window.sessionStorage)).not.toContain(IN_FORCE_ID);
      expect(window.location.href).not.toContain(IN_FORCE_ID);
      expect(saveRuntimeModuleDraft).not.toHaveBeenCalled();

      // And it is still the claim the signature will carry.
      await sign();
      expect(authorizedWith().replaces).toEqual({
        reviewedInstructionId: IN_FORCE_ID,
      });
    });

    it("keeps the URL the module's one canonical step throughout", async () => {
      await open();
      const before = window.location.href;
      await changeToNewAccount();
      expect(window.location.href).toBe(before);
      expect(push).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------------- J */

  describe("J. an ordinary authorization", () => {
    it("carries NO replacement claim when he never asked to change anything", async () => {
      // A first-time worker: nothing in force, nothing to verify, nothing to replace.
      history = [];
      verdict = "RECORD_ABSENT";
      verdictAbout = null;

      await open();
      expect(verifyPanel()).toBeNull();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      const card = accountCard(1);
      fireEvent.change(field("institution", card), { target: { value: "Frost Bank" } });
      const type = card.querySelector<HTMLInputElement>(
        '[data-pp-account-type="CHECKING"] input',
      );
      fireEvent.click(type as HTMLInputElement);
      typeInto(field("routing", card), NEW_ROUTING);
      typeInto(field("account", card), NEW_ACCOUNT);
      typeInto(field("account-confirm", card), NEW_ACCOUNT);
      fireEvent.click(action("review"));
      await authorizeStage("READY");
      await sign();

      expect(authorizedWith().replaces).toBeNull();
      expect(replacementClaims).toEqual([null]);
      await authorizeStage("EXECUTED");
    });

    it("carries none merely because a record already exists and his draft differs", async () => {
      /*
        THE WHOLE POINT OF "DELIBERATE". This worker has instructions in force and a screen full of
        different details, and he never pressed "No". Nothing infers a claim from any of it.

        [STRENGTHENED BY GATE 10C-E3 SLICE 4.] This test used to reach READY, sign, and assert that
        the POST was refused `ALREADY_AUTHORIZED`. It could only do that because the seeded record
        was operative and UNBOUND, so the read reported an outstanding act - and production cannot
        produce that. With the invariant corrected, the honest assertion is stronger and is made a
        step earlier: a worker who asked for nothing is not offered a signature the server would
        refuse. He is shown what is on record. The act's own default refusal is unchanged and is
        proved where it lives, in the backend replacement suite's section M1.
      */
      verdict = "SATISFIED";
      verdictAbout = null;
      await open();

      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      const card = accountCard(1);
      fireEvent.change(field("institution", card), { target: { value: "Frost Bank" } });
      const type = card.querySelector<HTMLInputElement>(
        '[data-pp-account-type="CHECKING"] input',
      );
      fireEvent.click(type as HTMLInputElement);
      typeInto(field("routing", card), NEW_ROUTING);
      typeInto(field("account", card), NEW_ACCOUNT);
      typeInto(field("account-confirm", card), NEW_ACCOUNT);
      fireEvent.click(action("review"));

      // What is on record, because that is what he asked about: nothing else.
      const terminal = await authorizeStage("EXECUTED");
      expect(terminal.textContent).toContain("in effect");

      // NO CLAIM WAS EVER SENT, on any read. This is the assertion the slice turns on: the anchor
      // comes from his answer to the question, and he was never asked one.
      expect(authorizationReadClaims.every((claim) => claim === null)).toBe(true);

      // AND NO ACT WAS OFFERED OR ATTEMPTED. There is no capture surface to draw on, and nothing
      // was submitted - so the record he never asked to change is untouched.
      expect(capsule().querySelector("[data-capture-pad]")).toBeNull();
      expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
      expect(operative()?.id).toBe(IN_FORCE_ID);
      expect(operative()?.supersededAt).toBeNull();
    });
  });

  /* ---------------------------------------------------------------------- K */

  describe("K. the deliberate replacement", () => {
    it("names the record he reviewed, and puts the new instructions in force", async () => {
      await open();
      await changeToNewAccount();
      await sign();

      expect(replacementClaims).toEqual([IN_FORCE_ID]);
      const body = authorizedWith();
      expect(body.replaces).toEqual({ reviewedInstructionId: IN_FORCE_ID });
      // The claim is an identity and nothing else - no banking value travels with it.
      expect(JSON.stringify(body.replaces)).not.toContain(NEW_ACCOUNT);
      expect(JSON.stringify(body.replaces)).not.toContain(OLD_ACCOUNT);

      await authorizeStage("EXECUTED");
      expect(operative()?.id).toBe("ppi_the_new_one");
      expect(history.find((row) => row.id === IN_FORCE_ID)?.supersededAt).not.toBeNull();
    });

    it("performs ONE act through the delivered signature, and no second call", async () => {
      await open();
      await changeToNewAccount();
      await sign();
      await authorizeStage("EXECUTED");

      expect(authorizeOwnPayrollPayment).toHaveBeenCalledTimes(1);
      // The change was made by authorizing, not by a confirmation and not by a completion.
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
      expect(completeOnboardingModule).not.toHaveBeenCalled();
    });

    it("lets him move to the payroll card if that is the change he wants", async () => {
      await open();
      fireEvent.click(verifyAction("change"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull(),
      );
      chooseMethod("card");
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      fireEvent.click(action("review"));
      await authorizeStage("READY");
      await sign();

      expect(authorizedWith().replaces).toEqual({
        reviewedInstructionId: IN_FORCE_ID,
      });
      const done = await authorizeStage("EXECUTED");
      expect(done.querySelector('[data-pp-outcome="CARD"]')).not.toBeNull();
      // Still no Gate 10D anywhere in sight.
      expect(done.textContent).not.toMatch(/card number|activate|issued|shipped/i);
    });
  });

  /* ---------------------------------------------------------------------- L */

  describe("L. the record moves while he is changing it", () => {
    beforeEach(async () => {
      await open();
      await changeToNewAccount();
      // Something else legitimately becomes current while he was filling the form in.
      history = [instructionInForce({ id: OTHER_ID, setVersion: 7 })];
      verdictAbout = OTHER_ID;
    });

    it("is refused, and nothing is superseded by a claim about a record he never saw", async () => {
      await sign();

      expect(replacementClaims).toEqual([IN_FORCE_ID]);
      expect(operative()?.id).toBe(OTHER_ID);
      expect(operative()?.supersededAt).toBeNull();
      expect(history).toHaveLength(1);
    });

    it("drops the claim rather than re-aiming it, and asks him to look again", async () => {
      await sign();

      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
      );
      // Back to the question, about what is actually in force now.
      await waitFor(() => expect(verifyPanel()).not.toBeNull());

      // NOT RE-ANCHORED AND NOT RESENT. One attempt, naming the record he actually reviewed.
      expect(authorizeOwnPayrollPayment).toHaveBeenCalledTimes(1);
      expect(replacementClaims).toEqual([IN_FORCE_ID]);
      expect(replacementClaims).not.toContain(OTHER_ID);
    });

    it("tells him what became of what he entered, without naming a record", async () => {
      await sign();
      const notice = await waitFor(() => {
        const found = capsule().querySelector("[data-pp-verify-moved]");
        expect(found).not.toBeNull();
        return found as HTMLElement;
      });
      expect(notice.getAttribute("role")).toBe("alert");
      expect(notice.textContent).toContain("changed while this page was open");
      expect(capsule().outerHTML).not.toContain(OTHER_ID);
      expect(capsule().outerHTML).not.toContain(IN_FORCE_ID);
      expect(capsule().textContent).not.toContain("REPLACEMENT_INSTRUCTION_MISMATCH");
    });

    it("requires him to answer about the CURRENT record before anything else happens", async () => {
      await sign();
      await waitFor(() => expect(verifyPanel()).not.toBeNull());

      // The claim is gone: pressing "No" again anchors to what he is being shown NOW.
      await changeToNewAccount();
      await sign();
      expect(replacementClaims).toEqual([IN_FORCE_ID, OTHER_ID]);
      expect(operative()?.id).toBe("ppi_the_new_one");
    });
  });

  /* ---------------------------------------------------------------------- M */

  describe("M. after a successful replacement", () => {
    it("does not ask him to confirm what he has just put in force", async () => {
      await open();
      await changeToNewAccount();
      await sign();
      await authorizeStage("EXECUTED");

      expect(verifyPanel()).toBeNull();
      expect(capsule().querySelector('[data-pp-verify-action="yes"]')).toBeNull();
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
      expect(confirmations).toHaveLength(0);
    });

    it("finishes through the delivered success path and claims nothing extra", async () => {
      await open();
      await changeToNewAccount();
      await sign();

      const done = await authorizeStage("EXECUTED");
      expect(done.querySelector('[data-pp-outcome="DEPOSIT"]')).not.toBeNull();
      expect(done.querySelector("[data-pp-return-to-packet]")).not.toBeNull();
      expect(done.textContent).not.toMatch(/ready to work|cleared|dispatch/i);
      // No freshness flag was invented in the browser to make this true.
      expect(done.textContent).not.toMatch(/fresh|up to date until|expires/i);
    });
  });

  /* ------------------------------------------------------------------ N-Q */

  describe("N. no record on file", () => {
    it("takes him into the ordinary interview and asks nothing about nothing", async () => {
      history = [];
      verdict = "RECORD_ABSENT";
      verdictAbout = null;
      await open();

      expect(verifyPanel()).toBeNull();
      // The stage as well as the panel: there is nothing to affirm, so he is never put there.
      expect(capsule().dataset.ppState).not.toBe("CONFIRM");
      expect(capsule().dataset.ppState).toBe("METHOD");
      expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull();
      expect(capsule().textContent).not.toContain("Is this still how you want to be paid?");
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
    });
  });

  describe("O. a worker who is not being asked", () => {
    it("gets the module he always got, with no verification work manufactured", async () => {
      verdict = "NOT_APPLICABLE";
      verdictAbout = null;
      method = BANK;
      savedAt = "2026-09-01T09:00:00.000Z";
      await open();

      expect(verifyPanel()).toBeNull();
      // Resumed exactly as the delivered module resumes: from what the server holds.
      expect(capsule().dataset.ppState).toBe("DETAILS");
      expect(capsule().querySelector("[data-pp-resumed]")).not.toBeNull();
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
    });
  });

  describe("P. a record already confirmed", () => {
    it("does not ask him again", async () => {
      verdict = "SATISFIED";
      verdictAbout = null;
      await open();

      expect(verifyPanel()).toBeNull();
      expect(capsule().querySelector('[data-pp-verify-action="yes"]')).toBeNull();
      expect(capsule().textContent).not.toContain("Is this still how you want to be paid?");
      /*
        AND HE IS NOT IN THE VERIFICATION STAGE AT ALL, which is a stronger statement than "no
        panel rendered". Only one of the server's five answers puts a worker in that stage, and a
        module that entered it on any of the other four would be asking a question the server did
        not ask - whether or not it had a record to draw while it was there.
      */
      expect(capsule().dataset.ppState).not.toBe("CONFIRM");
      expect(capsule().dataset.ppState).toBe("METHOD");
    });
  });

  describe("Q. a read that raced", () => {
    it("asks again, and renders the settled answer rather than the race", async () => {
      let asked = 0;
      vi.mocked(getOwnPayrollPaymentVerification).mockImplementation(async () => {
        asked += 1;
        if (asked === 1) {
          return {
            state: "RECORD_CHANGED",
            instructionId: null,
            instruction: null,
            evaluatedAt: "2026-09-03T12:00:00.000Z",
          };
        }
        return verificationView();
      });

      await open();
      expect(asked).toBe(2);
      expect(verifyPanel()).not.toBeNull();
      expect(capsule().querySelector("[data-pp-verify-unsettled]")).toBeNull();
    });

    it("shows no record at all when it cannot settle, and offers a way out", async () => {
      verdictAbout = null; // every read is a race
      await open();

      expect(verifyPanel()).toBeNull();
      const unsettled = capsule().querySelector("[data-pp-verify-unsettled]");
      expect(unsettled).not.toBeNull();
      expect(unsettled?.textContent).toContain(
        "changed while this page was open",
      );
      // NOT the last projection dressed up as current, and no internal state name.
      expect(capsule().querySelector("[data-pp-verify-routing]")).toBeNull();
      expect(capsule().textContent).not.toContain("RECORD_CHANGED");
      expect(capsule().outerHTML).not.toContain(IN_FORCE_ID);

      // And it recovers by reading, once the race is over.
      verdictAbout = IN_FORCE_ID;
      fireEvent.click(verifyAction("recheck"));
      await waitFor(() => expect(verifyPanel()).not.toBeNull());
    });

    it("does not spin: two reads, and then the truth", async () => {
      verdictAbout = null;
      await open();
      expect(getOwnPayrollPaymentVerification).toHaveBeenCalledTimes(2);
    });
  });

  /* ---------------------------------------------------------------------- R */

  describe("R. coming back to the page", () => {
    it("asks the authority again rather than resuming a claim it cannot vouch for", async () => {
      await open();
      fireEvent.click(verifyAction("change"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-method-choice]")).not.toBeNull(),
      );

      // He reloads. Everything the browser held goes with it, including the claim.
      cleanup();
      vi.mocked(getOwnPayrollPaymentVerification).mockClear();
      await open();

      expect(getOwnPayrollPaymentVerification).toHaveBeenCalledWith(INVOCATION_ID);
      // And he is put back in front of the question, which is the only safe place to restart.
      expect(verifyPanel()).not.toBeNull();
      expect(capsule().dataset.ppState).toBe("CONFIRM");
    });

    it("still renders the module for a packet that has left his hands, read only", async () => {
      await open({ status: "COMPLETE" });
      expect(verifyPanel()).toBeNull();
      expect(capsule().querySelector("[data-pp-authorize]")).not.toBeNull();
    });
  });

  /* ---------------------------------------------------------------------- S */

  describe("S. a session that is no longer good", () => {
    it("surfaces the delivered session failure and asks him nothing", async () => {
      const { WorkerSessionExpiredError } = await import("@/lib/workforce/workforceApi");
      vi.mocked(getOwnPayrollPaymentVerification).mockRejectedValue(
        new WorkerSessionExpiredError(),
      );

      await open();
      expect(verifyPanel()).toBeNull();
      expect(capsule().dataset.ppState).toBe("ERROR");
      expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
    });

    it("surfaces an ownership refusal the same way, with nothing of the record on screen", async () => {
      vi.mocked(getOwnPayrollPaymentVerification).mockRejectedValue(
        refusal("INVOCATION_NOT_OWNED_BY_WORKER"),
      );

      await open();
      expect(capsule().dataset.ppState).toBe("ERROR");
      expect(capsule().outerHTML).not.toContain(IN_FORCE_ID);
      expect(capsule().outerHTML).not.toContain(OLD_ACCOUNT);
      expect(capsule().textContent).not.toContain("INVOCATION_NOT_OWNED_BY_WORKER");
    });
  });

  /* ---------------------------------------------------------------------- T */

  describe("T. what never leaves the browser, and what never reaches it", () => {
    it("writes no identity and no banking value anywhere it could be read back", async () => {
      const wrote: string[] = [];
      const localSet = window.localStorage.setItem.bind(window.localStorage);
      const sessionSet = window.sessionStorage.setItem.bind(window.sessionStorage);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        wrote.push(`${key}=${value}`);
        (this === window.sessionStorage ? sessionSet : localSet)(key, value);
      });

      await open();
      await changeToNewAccount();
      await sign();

      const stored = wrote.join("|");
      for (const secret of [IN_FORCE_ID, CANDIDATE_ID, OLD_ROUTING, OLD_ACCOUNT, NEW_ACCOUNT]) {
        expect({ secret, stored: stored.includes(secret) }).toEqual({
          secret,
          stored: false,
        });
      }
      expect(document.cookie).toBe("");
      vi.mocked(Storage.prototype.setItem).mockRestore();
    });

    it("logs nothing about the record, the worker or the refusal", async () => {
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
        vi.spyOn(console, level).mockImplementation(() => {}),
      );
      vi.mocked(confirmOwnPayrollPaymentVerification).mockRejectedValue(
        refusal("VERIFICATION_INSTRUCTION_MISMATCH"),
      );

      await open();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
      );

      const logged = spies
        .flatMap((spy) => spy.mock.calls)
        .map((call) => JSON.stringify(call))
        .join("|");
      for (const secret of [IN_FORCE_ID, CANDIDATE_ID, OLD_ROUTING, OLD_ACCOUNT]) {
        expect({ secret, logged: logged.includes(secret) }).toEqual({
          secret,
          logged: false,
        });
      }
      for (const spy of spies) spy.mockRestore();
    });

    it("sends no candidate identity on anything it asks for", async () => {
      await open();
      fireEvent.click(verifyAction("yes"));
      await waitFor(() =>
        expect(confirmOwnPayrollPaymentVerification).toHaveBeenCalled(),
      );

      const sent = JSON.stringify([
        vi.mocked(getOwnPayrollPaymentVerification).mock.calls,
        vi.mocked(confirmOwnPayrollPaymentVerification).mock.calls,
        vi.mocked(authorizeOwnPayrollPayment).mock.calls,
      ]);
      expect(sent).not.toContain(CANDIDATE_ID);
    });

    it("holds one payroll module at one URL, and registers no second renderer", async () => {
      const { resolveOnboardingModuleRenderer } = await import(
        "@/components/workforce/onboarding/runtime/moduleRegistry"
      );
      expect(resolveOnboardingModuleRenderer(MODULE_KEY)).toBeTypeOf("function");
      expect(resolveOnboardingModuleRenderer("PAYROLL_PAYMENT_VERIFICATION")).toBeUndefined();
      expect(resolveOnboardingModuleRenderer("PAYROLL_PAYMENT_CONFIRM")).toBeUndefined();

      await open();
      // The verification screen is a STAGE of the one capsule, not a second capsule.
      expect(document.querySelectorAll(".pp-module")).toHaveLength(1);
      expect(verifyPanel()?.closest(".pp-module")).toBe(capsule());
    });
  });

  /* ---------------------------------------------------------------------- U */

  describe("U. on a phone", () => {
    it("stacks the record in rows and a card, with no table and no fixed width", async () => {
      await open();
      const panel = verifyPanel() as HTMLElement;

      expect(panel.querySelector("table")).toBeNull();
      // The delivered stacked presentation: definition rows inside an account card.
      expect(panel.querySelector("dl.pp-review-list")).not.toBeNull();
      expect(panel.querySelector(".pp-review-account")).not.toBeNull();
      expect(panel.className).toContain("pp-verify");
      expect(panel.outerHTML).not.toMatch(/style="[^"]*width:\s*\d+px/);
    });

    it("offers both answers as real buttons in the shared wrapping row", async () => {
      await open();
      const row = capsule().querySelector(".pp-actions") as HTMLElement;
      expect(row.className).toContain("wf-btn-row");

      for (const name of ["yes", "change"] as const) {
        const button = verifyAction(name);
        expect(button.tagName).toBe("BUTTON");
        expect(button.getAttribute("type")).toBe("button");
        expect(button.className).toContain("wf-btn");
      }
      // The forward answer is the primary one, and they are told apart by more than colour.
      expect(verifyAction("yes").className).toContain("wf-btn-primary");
      expect(verifyAction("change").className).toContain("wf-btn-secondary");
      expect(verifyAction("yes").textContent).not.toBe(verifyAction("change").textContent);
    });

    it("names the question for anyone who cannot see the layout", async () => {
      await open();
      const panel = verifyPanel() as HTMLElement;

      const heading = panel.querySelector("h3") as HTMLElement;
      expect(panel.getAttribute("aria-labelledby")).toBe(heading.id);
      for (const name of ["yes", "change"] as const) {
        expect(verifyAction(name).getAttribute("aria-describedby")).toBe(
          "pp-verify-question",
        );
      }
      expect(document.getElementById("pp-verify-question")?.textContent).toBe(
        "Is this still how you want to be paid?",
      );
    });
  });

  /* ---------------------------------------------------------------------- V */

  /**
   * V. THE SIGNATURE BEING THERE AT ALL (Gate 10C-E3 slice 4 read projection).
   *
   * THE ASSERTION THIS FILE WAS MISSING, and it was missing for a reason worth recording. Sections
   * H to M walk the whole change journey and end at a signature, so on their face they covered
   * this. They passed because the fixture seeded a record that was operative and UNBOUND - and on
   * that record the server reports an outstanding act, so the stage came back READY. Production
   * cannot produce that record: a stale verification is about a record he SIGNED, and a signed
   * record is bound. Against the real shape the read reported his old instruction as a finished
   * module, the surface rendered "Payroll Payment complete", and no worker with instructions in
   * force could reach the signature that would replace them.
   *
   * SO THE FIXTURE IS CORRECTED AND THIS SECTION ASSERTS THE REACHABILITY DIRECTLY. Every test
   * above now runs against an execution-bound record, which is the larger part of the protection;
   * what is added here is the part that must never regress silently again - that the worker who
   * says "no, my details have changed" is offered a pad to sign, and is not shown the record he is
   * replacing as his completed work.
   *
   * WHAT IS DELIBERATELY NOT RE-ASSERTED HERE. That the act still carries the claim is section K,
   * and that a claim refused AT THE POST recovers is section L; both are unchanged behaviour and
   * both now run against the corrected invariant, which is worth more than a copy of them here.
   */
  describe("V. the replacement signature being reachable at all", () => {
    describe("V1. the read is told which task he is on", () => {
      it("sends the record he reviewed, once he has said his details changed", async () => {
        await open();
        await changeToNewAccount();

        // The anchor is his answer to the question, carried onto the read that decides the stage.
        expect(authorizationReadClaims).toContain(IN_FORCE_ID);
        expect(authorizationReadClaims.every((claim) => claim === IN_FORCE_ID)).toBe(true);
        // Opaque, and an identity only: no banking value went with it.
        for (const claim of authorizationReadClaims) {
          expect(claim).not.toContain(NEW_ACCOUNT);
          expect(claim).not.toContain(OLD_ACCOUNT);
          expect(claim).not.toContain(NEW_ROUTING);
        }
      });

      it("omits it entirely on an ordinary first authorization", async () => {
        // Nobody has anything in force, so there is nothing to replace and nothing to claim.
        history = [];
        verdict = "RECORD_ABSENT";
        verdictAbout = null;
        await open();

        chooseMethod("bank");
        await waitFor(() => expect(accountCard(1)).toBeTruthy());
        const card = accountCard(1);
        fireEvent.change(field("institution", card), {
          target: { value: "Amarillo National" },
        });
        const type = card.querySelector<HTMLInputElement>(
          '[data-pp-account-type="CHECKING"] input',
        );
        fireEvent.click(type as HTMLInputElement);
        typeInto(field("routing", card), NEW_ROUTING);
        typeInto(field("account", card), NEW_ACCOUNT);
        typeInto(field("account-confirm", card), NEW_ACCOUNT);
        fireEvent.click(action("review"));
        await authorizeStage("READY");

        expect(authorizationReadClaims.length).toBeGreaterThan(0);
        expect(authorizationReadClaims.every((claim) => claim === null)).toBe(true);
      });

      it("re-reads when the anchor is acquired rather than answering the old question", async () => {
        /*
          A WORKER WHO IS ASKED CHANGES WHICH QUESTION IS OUTSTANDING. The stage read is not a
          one-off at mount: acquiring the anchor must re-ask, or he is left looking at the answer
          to a question he is no longer on.
        */
        await open();
        await changeToNewAccount();
        const withClaim = authorizationReadClaims.filter(
          (claim) => claim === IN_FORCE_ID,
        );
        expect(withClaim.length).toBeGreaterThan(0);
      });
    });

    describe("V2. the pad is on the screen", () => {
      it("reaches READY and offers the capture surface", async () => {
        /*
          THE REGRESSION ASSERTION, END TO END: the stale question, "no - I need to make a change",
          the method, the details, the review, and then a signature he can actually make. This is
          the exact journey the owner walked in the browser, and the exact point at which it stopped.
        */
        await open();
        // He is asked about a record he signed, which is the only kind there is.
        expect(verifyPanel()).not.toBeNull();
        expect(operative()?.authorizedAt).not.toBeNull();

        await pressChange();
        await fillNewAccount();
        fireEvent.click(action("review"));

        const ready = await authorizeStage("READY");
        expect(ready).not.toBeNull();
        expect(capsule().querySelector("[data-capture-pad]")).not.toBeNull();
      });

      it("shows the replacement above the signature, still not in force", async () => {
        await open();
        await changeToNewAccount();

        // The new details are what he is being asked to sign for.
        const review = capsule().querySelector("[data-pp-review]") as HTMLElement;
        expect(review).not.toBeNull();
        expect(review.textContent).toContain("Amarillo National");
        expect(capsule().querySelector("[data-capture-pad]")).not.toBeNull();
      });

      it("does not put the record he is replacing in the authorization slot", async () => {
        /*
          THE DEFECT, ASSERTED AS AN ABSENCE. What the owner saw was the new review and, directly
          beneath it, "Payroll Payment complete ... now in effect ... you signed this on September
          1" - the old record occupying the slot the signature belongs in. It must not be there
          while a valid replacement is awaiting his mark.
        */
        await open();
        await changeToNewAccount();

        expect(capsule().querySelector('[data-pp-authorize-state="EXECUTED"]')).toBeNull();
        const authorization = capsule().querySelector(
          "[data-pp-authorize-state]",
        ) as HTMLElement;
        expect(authorization.dataset.ppAuthorizeState).toBe("READY");
        expect(authorization.textContent).not.toMatch(/now in effect/i);
        expect(authorization.textContent).not.toMatch(/September 1, 2026/);
        // And the old record's own details are nowhere on the screen he is signing from.
        expect(capsule().textContent).not.toContain("Frost Bank");
      });
    });

    describe("V3. reading it does nothing", () => {
      it("authorizes nothing by being read, however ready it says he is", async () => {
        await open();
        await changeToNewAccount();

        expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
        expect(confirmOwnPayrollPaymentVerification).not.toHaveBeenCalled();
        expect(completeOnboardingModule).not.toHaveBeenCalled();
        // The record he is replacing is still the one in force, still unsuperseded.
        expect(operative()?.id).toBe(IN_FORCE_ID);
        expect(operative()?.supersededAt).toBeNull();
        expect(history).toHaveLength(1);
      });
    });

    describe("V4. a claim the server will not vouch for", () => {
      it("recovers when the record moved before he reached the review", async () => {
        /*
          THE SAME LAPSE AS SECTION L, CAUGHT A STEP EARLIER. There the record moved after his read
          and he learned of it by being refused; here it moves while he is still typing, so the
          READ finds out and he is recovered without ever signing against a record he never saw.
        */
        await open();
        await enterNewAccountDetails();
        // Something else legitimately becomes current before he asks to review.
        history = [instructionInForce({ id: OTHER_ID, setVersion: 7 })];
        verdictAbout = OTHER_ID;

        fireEvent.click(action("review"));

        // Back to the question, about what is actually in force now.
        await waitFor(() =>
          expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
        );
        await waitFor(() => expect(verifyPanel()).not.toBeNull());

        // NOTHING WAS SIGNED AND NOTHING WAS RE-AIMED. He was never offered the pad for a claim
        // the server would not vouch for, and the claim was dropped rather than pointed at OTHER_ID.
        expect(authorizeOwnPayrollPayment).not.toHaveBeenCalled();
        expect(authorizationReadClaims).not.toContain(OTHER_ID);
        expect(operative()?.id).toBe(OTHER_ID);
        expect(operative()?.supersededAt).toBeNull();
      });

      it("names no record and shows no code while recovering", async () => {
        await open();
        await enterNewAccountDetails();
        history = [instructionInForce({ id: OTHER_ID, setVersion: 7 })];
        verdictAbout = OTHER_ID;
        fireEvent.click(action("review"));
        await waitFor(() =>
          expect(capsule().querySelector("[data-pp-verify-moved]")).not.toBeNull(),
        );

        expect(capsule().outerHTML).not.toContain(IN_FORCE_ID);
        expect(capsule().outerHTML).not.toContain(OTHER_ID);
        expect(capsule().textContent).not.toContain("REPLACEMENT_INSTRUCTION_MISMATCH");
      });

      it("lets him decide again about the record that is actually current", async () => {
        await open();
        await enterNewAccountDetails();
        history = [instructionInForce({ id: OTHER_ID, setVersion: 7 })];
        verdictAbout = OTHER_ID;
        fireEvent.click(action("review"));
        await waitFor(() => expect(verifyPanel()).not.toBeNull());

        // Pressing "No" again anchors to what he is being shown NOW, and the signature is there.
        await changeToNewAccount();
        expect(capsule().querySelector("[data-capture-pad]")).not.toBeNull();
        await sign();

        expect(authorizedWith().replaces).toEqual({
          reviewedInstructionId: OTHER_ID,
        });
        expect(operative()?.id).toBe("ppi_the_new_one");
      });
    });
  });
});
