/**
 * Module 4.4 Payroll Payment - browser API client and wire contract.
 *
 * The client half of the capsule and nothing more. It adds no endpoint, no transport and no session
 * handling of its own: the three governed worker routes go through the delivered
 * `onboardingWorkerFetch`, exactly as the Phase 4 document, Phase 5 execution and the first three
 * module clients do. A second copy of that transport would be a second place for expiry, renewal
 * and refusal classification to drift.
 *
 * The types mirror `modules/payroll-payment/payroll-payment.interview.ts` and that module's own DTO
 * exactly.
 *
 * THIS FILE IS THE ONE PLACE THE WIRE VOCABULARY IS SPELLED, and owner ruling 10-R16 is why.
 * `DIRECT_DEPOSIT` is a governed token the certified Phase 1 acceptance suite forbids inside a
 * module capsule, and it forbids it there for a reason that has nothing to do with this module: a
 * capsule that spells another phase's module name is how a second module ships under the first
 * one's authorization. So the token lives HERE, outside every tree that suite scans, and the
 * worker's screens import it as a named constant. That is the same rule from the other direction as
 * the governed plain-language requirement: what the worker reads is "Direct Deposit", in his own
 * words, and the wire token was never meant to be the words on his screen.
 *
 * WHAT IS DELIBERATELY ABSENT, and none of it may be added here:
 *
 *  - THERE IS NO FULL ROUTING OR ACCOUNT NUMBER ON ANY RESPONSE TYPE, in any shape. No field, no
 *    accessor, no accessor that could hold one. Both protected values travel INBOUND ONLY, and
 *    every response type below carries the masked tail the server produced. There is nowhere on
 *    these types to put a full one, which is what makes "the browser cannot redisplay it" a fact
 *    about the contract rather than a promise about the components.
 *  - THERE IS NO `confirmed` FLAG, and there must never be one. The two independent account-number
 *    entries travel as two values and the SERVER compares them (10-R10, 10-R13). A boolean here
 *    would let a browser assert the outcome of a control it did not run.
 *  - There is no candidate, worker or actor parameter on any call. Which worker is asking is the
 *    authenticated session's answer, so no argument here can widen it.
 *  - There is no authorize, execute, sign, activate or complete call. Gate 10B ends at review:
 *    authorization and module completion are Gate 10C's, and administrative payroll-card fulfilment
 *    is Gate 10D's. A client function for either would be that gate arriving early.
 *  - There is no effective-date parameter. The authoritative effective date is not the worker's to
 *    choose and there is no shape here that could carry his opinion about it.
 *  - There is no card activation, assignment or status call, and no external transmission of any
 *    kind. The payroll-card election is a CHOICE this gate retains, not a card it creates.
 *  - There is no artifact or download call. No authorization document exists to fetch.
 *  - There is no staff or administrative surface. This module ships no reviewer experience for a
 *    client to point at.
 *
 * ON PERSISTENCE. Nothing in this file writes to `localStorage`, `sessionStorage`, a cookie, a
 * query string or a URL, and nothing may. A protected banking value belongs in exactly two places -
 * transiently in the field the worker is typing into, and sealed at rest on the server - and the
 * unfinished interview is resumed by READING it back from the server's protected draft rather than
 * from anything a browser kept.
 */

import { onboardingWorkerFetch } from "./onboardingApi";

/* -------------------------------------------------------------------------- */
/*  Governed vocabulary (mirror of payroll-payment.constants.ts)               */
/* -------------------------------------------------------------------------- */

/** The module key the capsule registers its renderer under. */
export const PAYROLL_PAYMENT_MODULE_KEY = "PAYROLL_PAYMENT";

/** The single step the server declares for this module in Gate 10B. */
export const PAYROLL_PAYMENT_STEP_SLUG = "payment-method";

/**
 * The exactly two approved payment methods (architecture 4.4.2, 10-R14).
 *
 * CLOSED. A third method is a governance question and not a constant to add.
 */
export const PAYROLL_PAYMENT_METHODS = [
  "DIRECT_DEPOSIT",
  "COMDATA_PAYROLL_CARD",
] as const;
export type PayrollPaymentMethod = (typeof PAYROLL_PAYMENT_METHODS)[number];

/** Named so the capsule never spells the token. See the file header, and 10-R16. */
export const PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT: PayrollPaymentMethod =
  "DIRECT_DEPOSIT";
export const PAYROLL_PAYMENT_METHOD_PAYROLL_CARD: PayrollPaymentMethod =
  "COMDATA_PAYROLL_CARD";

/** The CLOSED V1 account-type vocabulary (10-R4). Two, and no more. */
export const PAYROLL_DEPOSIT_ACCOUNT_TYPES = ["CHECKING", "SAVINGS"] as const;
export type PayrollDepositAccountType =
  (typeof PAYROLL_DEPOSIT_ACCOUNT_TYPES)[number];

/** One allocation mode per instruction, never both (4.4.4 LOCKED, 10-R3). */
export const PAYROLL_PAYMENT_ALLOCATION_MODES = [
  "PERCENTAGE",
  "FIXED_AMOUNT_REMAINDER",
] as const;
export type PayrollPaymentAllocationMode =
  (typeof PAYROLL_PAYMENT_ALLOCATION_MODES)[number];

export const PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE: PayrollPaymentAllocationMode =
  "PERCENTAGE";
export const PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED: PayrollPaymentAllocationMode =
  "FIXED_AMOUNT_REMAINDER";

/** How ONE account takes its share (4.4.4). */
export const PAYROLL_DEPOSIT_ALLOCATION_KINDS = [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "REMAINING_BALANCE",
] as const;
export type PayrollDepositAllocationKind =
  (typeof PAYROLL_DEPOSIT_ALLOCATION_KINDS)[number];

export const PAYROLL_DEPOSIT_ALLOCATION_PERCENTAGE: PayrollDepositAllocationKind =
  "PERCENTAGE";
export const PAYROLL_DEPOSIT_ALLOCATION_FIXED_AMOUNT: PayrollDepositAllocationKind =
  "FIXED_AMOUNT";
export const PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE: PayrollDepositAllocationKind =
  "REMAINING_BALANCE";

/**
 * The ceiling on deposit accounts (4.4.4).
 *
 * Mirrored here so the UX can stop offering "add another" at the right moment. It is NOT the
 * enforcement: the server refuses a fourth account whatever a browser believes, which is the only
 * reason this copy is safe to keep.
 */
export const PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS = 3;

/** Governed account-number bounds, used only to guide the worker while he types. */
export const PAYROLL_ROUTING_NUMBER_LENGTH = 9;
export const PAYROLL_ACCOUNT_NUMBER_MIN_LENGTH = 4;
export const PAYROLL_ACCOUNT_NUMBER_MAX_LENGTH = 17;

/**
 * The one confirmation method this gate can produce (10-R10).
 *
 * Reported by the server after IT compared the two entries. This constant exists so the review
 * screen can recognise the fact, never so a client can assert it.
 */
export const PAYROLL_ACCOUNT_CONFIRMATION_INDEPENDENT_SECOND_ENTRY =
  "INDEPENDENT_SECOND_ENTRY";
export type PayrollAccountConfirmationMethod = "INDEPENDENT_SECOND_ENTRY";

/* -------------------------------------------------------------------------- */
/*  Projections - masked, always                                               */
/* -------------------------------------------------------------------------- */

/** One rule the server applied to what has been entered so far. Never a worker value. */
export type PayrollPaymentViolation = {
  code: string;
  /** The account at fault, or null for a rule about the instruction as a whole. */
  position: number | null;
  /** The governed attribute at fault. Never the value of one. */
  field: string | null;
};

/**
 * One account as the worker sees his OWN unfinished entry.
 *
 * `routingNumberMasked` and `accountNumberMasked` are the whole of what comes back. The
 * `...Entered` flags exist because "has he filled this in" is a question the UI must answer and a
 * masked string is a poor way to answer it - not because the value is available anywhere.
 */
export type PayrollPaymentAccountView = {
  /**
   * WHICH ACCOUNT THIS IS: the server's stable, opaque identifier for it (owner ruling QA-L4-R1).
   *
   * The browser holds it and echoes it back on save, which is how the server knows that the
   * account now shown second is the same account it was holding third. It is NOT the display
   * order and is never derived from one, and it carries no part of any banking value.
   */
  accountId: string;
  /** Display order, 1..n, for the worker to read. Never an identity. */
  position: number;
  accountType: PayrollDepositAccountType | null;
  financialInstitutionName: string;
  routingNumberEntered: boolean;
  routingNumberMasked: string | null;
  accountNumberEntered: boolean;
  accountNumberMasked: string | null;
  allocationKind: PayrollDepositAllocationKind | null;
  /** Exact decimal text. Never a float: a total that must equal exactly 100% cannot be one. */
  allocationPercentage: string | null;
  allocationAmount: string | null;
  accountConfirmationMethod: PayrollAccountConfirmationMethod | null;
  accountConfirmationRecordedAt: string | null;
};

/**
 * The worker's interview as he is shown it.
 *
 * `violations` is the governed rule set applied to what he has entered SO FAR - reported rather
 * than refused, because a worker part-way through an allocation has not done anything wrong yet.
 * `readyForReview` is the server's answer to the only question that matters at the end of this
 * gate: whether what he has proposed is admissible as a whole.
 */
export type PayrollPaymentInterview = {
  paymentMethod: PayrollPaymentMethod | null;
  allocationMode: PayrollPaymentAllocationMode | null;
  accounts: PayrollPaymentAccountView[];
  maxDepositAccounts: number;
  canAddAccount: boolean;
  violations: PayrollPaymentViolation[];
  readyForReview: boolean;
  /** When the protected draft was last saved, or null when nothing has been saved. */
  savedAt: string | null;
};

/**
 * What the worker is shown at the end of Gate 10B, and it is a PROPOSAL rather than a record.
 *
 * There is no effective date on it, no version, no execution, no signature and no completion,
 * because none of those exists yet and this gate creates none of them (10-R15). `authorized` and
 * `moduleComplete` are typed as the literal `false` on purpose: this contract cannot express the
 * other answer, so a later change that tried to would not compile.
 */
export type PayrollPaymentReview = {
  paymentMethod: PayrollPaymentMethod;
  allocationMode: PayrollPaymentAllocationMode | null;
  accounts: PayrollPaymentAccountView[];
  /** The confirmation method that WOULD be recorded once every account carries it. */
  accountConfirmationMethod: PayrollAccountConfirmationMethod | null;
  authorized: false;
  moduleComplete: false;
};

/* -------------------------------------------------------------------------- */
/*  What a save states                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One account as the worker submits it.
 *
 * BOTH ACCOUNT-NUMBER ENTRIES ARE SEPARATE FIELDS AND BOTH TRAVEL. That is the whole mechanism of
 * the independent second entry: the browser sends what he typed twice and the server decides
 * whether they are the same. Omitting both carries the stored account number and its existing
 * confirmation forward - FOR THE ACCOUNT `accountId` NAMES, and for no other.
 */
export type SavePayrollPaymentAccountInput = {
  /**
   * The account this row IS, or absent to say it is a new one (owner ruling QA-L4-R1).
   *
   * Sent for every account the server already holds, so that a removal, a reorder or a renumber
   * cannot move one account's protected banking values onto another. A NEW account sends none,
   * inherits nothing, and must supply its account number twice like any first entry.
   */
  accountId?: string | null;
  /** Display order only. The server re-derives it and never reads it as identity. */
  position?: number;
  accountType?: PayrollDepositAccountType | null;
  financialInstitutionName?: string | null;
  /** Entered ONCE. There is no second entry for the routing number in V1 (10-R3). */
  routingNumber?: string | null;
  accountNumber?: string | null;
  accountNumberConfirmation?: string | null;
  allocationKind?: PayrollDepositAllocationKind | null;
  allocationPercentage?: string | null;
  allocationAmount?: string | null;
};

/**
 * One deliberate save of the worker's own interview.
 *
 * The whole proposal travels in one request. Sending accounts states that his interview is now
 * those accounts - it does not patch one - which is what lets the server apply the allocation
 * rules to the whole picture. Omitting `accounts` leaves the held accounts alone, which is what a
 * worker choosing his payment method before entering any bank details is doing; an EMPTY array is
 * a different statement, and means he removed them.
 */
export type SavePayrollPaymentInterviewInput = {
  paymentMethod?: PayrollPaymentMethod | null;
  allocationMode?: PayrollPaymentAllocationMode | null;
  accounts?: SavePayrollPaymentAccountInput[] | null;
};

/* -------------------------------------------------------------------------- */
/*  Refusals                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The governed refusals a WORKER can actually cause here.
 *
 * The module's server-side code list is longer. Absent from this one are the codes raised only by
 * acts no worker performs in Gate 10B - a superseded instruction, a missing effective instruction -
 * and a screen with words for those would be describing a path that does not exist yet.
 *
 * NOT ONE OF THESE CARRIES A VALUE. A refusal names the account and the governed attribute at
 * fault; it never echoes a routing or account number, and the mismatch code deliberately says
 * nothing about the two entries beyond the fact that they differ.
 */
export const PAYROLL_PAYMENT_WORKER_REFUSAL_CODES = [
  "PAYMENT_METHOD_NOT_GOVERNED",
  "DEPOSIT_ACCOUNT_REQUIRED",
  "TOO_MANY_DEPOSIT_ACCOUNTS",
  "ACCOUNTS_NOT_PERMITTED_FOR_METHOD",
  "ALLOCATION_MODE_REQUIRED",
  "ALLOCATION_MODE_NOT_GOVERNED",
  "ACCOUNT_TYPE_NOT_GOVERNED",
  "ALLOCATION_KIND_NOT_GOVERNED",
  "FINANCIAL_INSTITUTION_REQUIRED",
  "ACCOUNT_POSITION_INVALID",
  /**
   * The browser named an account the server is not holding, or named one twice (QA-L4-R1).
   *
   * NEITHER IS SOMETHING A WORKER CAN DO THROUGH THE SCREEN, so both read as our fault rather than
   * his - which is what their sentences say. They exist because the alternative to refusing an
   * identifier the server cannot place is guessing which account it meant, and what would be
   * guessed at is which bank account his wages go to.
   */
  "DEPOSIT_ACCOUNT_NOT_RECOGNIZED",
  "DEPOSIT_ACCOUNT_DUPLICATED",
  "ALLOCATION_MODE_MIXED",
  "PERCENTAGE_TOTAL_INVALID",
  "REMAINING_BALANCE_ACCOUNT_REQUIRED",
  "MULTIPLE_REMAINING_BALANCE_ACCOUNTS",
  "ALLOCATION_VALUE_INVALID",
  /**
   * The account has no routing number at all (owner ruling 10A-R1).
   *
   * DISTINCT FROM THE TWO BELOW, AND THE DISTINCTION IS THE WHOLE POINT. Those two say something
   * about a value that WAS entered; this one says none was. A worker told his routing number is
   * the wrong shape when he entered none is being sent to check a field he never filled in.
   *
   * IT IS NEVER RAISED BECAUSE THE BROWSER LACKS THE PLAINTEXT. An account the server already
   * holds a routing number for is resaved with the value omitted, because the worker holds only a
   * mask of it - and the server keeps what it holds for that account (QA-L4-FUNC-1, QA-L4-R1).
   * The server decides presence from what it actually holds, never from what the request carried.
   */
  "ROUTING_NUMBER_REQUIRED",
  "ROUTING_NUMBER_FORMAT_INVALID",
  "ROUTING_NUMBER_CHECKSUM_INVALID",
  "ACCOUNT_NUMBER_INVALID",
  "ACCOUNT_NUMBER_CONFIRMATION_REQUIRED",
  "ACCOUNT_NUMBER_CONFIRMATION_MISMATCH",
  /** The protected draft could not be sealed or opened. Nothing was stored either way (10-R17). */
  "DRAFT_PROTECTION_UNAVAILABLE",
  "DRAFT_PROTECTION_INVALID",
] as const;
export type PayrollPaymentWorkerRefusalCode =
  (typeof PAYROLL_PAYMENT_WORKER_REFUSAL_CODES)[number];

/** Read the governed refusal code off a failure, or null when it is not one of ours. */
export function payrollPaymentRefusalCode(
  error: unknown,
): PayrollPaymentWorkerRefusalCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    PAYROLL_PAYMENT_WORKER_REFUSAL_CODES as readonly string[]
  ).includes(code as string)
    ? (code as PayrollPaymentWorkerRefusalCode)
    : null;
}

/* -------------------------------------------------------------------------- */
/*  Worker surface - exactly three calls                                       */
/* -------------------------------------------------------------------------- */

function workerBase(invocationId: string): string {
  return `/workforce/onboarding/runtime/packets/${encodeURIComponent(
    invocationId,
  )}/payroll-payment`;
}

/**
 * This worker's own interview: his method, his accounts in masked form, the rules applied to what
 * he has entered so far, and whether it is admissible as a whole.
 *
 * THIS IS ALSO THE RESUME READ. There is no separate resume call, because resuming is reading: the
 * unfinished proposal comes back from the server's own protected draft, which is the only place it
 * was ever kept.
 */
export async function getOwnPayrollPayment(
  invocationId: string,
): Promise<PayrollPaymentInterview> {
  return onboardingWorkerFetch<PayrollPaymentInterview>(
    workerBase(invocationId),
  );
}

/**
 * EXPLICIT SAVE. Commit what the worker deliberately submitted, and read back what the server made
 * of it.
 *
 * IT SAVES AND IT DOES NOT AUTHORIZE. Nothing here makes an instruction operative, assigns it an
 * effective date, or completes the module. What it writes is the protected pre-execution draft.
 */
export async function saveOwnPayrollPayment(
  invocationId: string,
  input: SavePayrollPaymentInterviewInput,
): Promise<PayrollPaymentInterview> {
  return onboardingWorkerFetch<PayrollPaymentInterview>(
    workerBase(invocationId),
    { method: "POST", body: input },
  );
}

/**
 * The review stage: the proposal as the worker is asked to check it, masked.
 *
 * LOOKING IS NOT AUTHORIZING. This read performs nothing and records nothing. It reports
 * `authorized: false` and `moduleComplete: false`, and it is the last thing Gate 10B does.
 */
export async function getOwnPayrollPaymentReview(
  invocationId: string,
): Promise<PayrollPaymentReview> {
  return onboardingWorkerFetch<PayrollPaymentReview>(
    `${workerBase(invocationId)}/review`,
  );
}
