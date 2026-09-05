/**
 * Module 4.4 Payroll Payment - browser API client and wire contract.
 *
 * The client half of the capsule and nothing more. It adds no endpoint, no transport and no session
 * handling of its own: the governed worker routes go through the delivered `onboardingWorkerFetch`,
 * exactly as the Phase 4 document, Phase 5 execution and the first three module clients do. A
 * second copy of that transport would be a second place for expiry, renewal and refusal
 * classification to drift.
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
 *  - [AMENDED BY GATE 10C. There is an AUTHORIZE call, and it is the only one that arrived: the
 *    worker's governed electronic signature, performed through the DELIVERED execution surface.
 *    There is still no execute call of this module's own, no sign call, no activate call and NO
 *    COMPLETE CALL - completion is derived server-side from the module's validator and no response
 *    type here has a field a browser could assert it through. Administrative payroll-card
 *    fulfilment is still Gate 10D's, and PRE_DISPATCH confirm-or-update is still deferred Slice E;
 *    a client function for either would be work arriving early.]
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
import type {
  OnboardingExecutionCapture,
  OnboardingExecutionForm,
  OnboardingExecutionSubject,
  PresentedOnboardingExecutionContent,
} from "./onboardingExecutionApi";

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
/*  Gate 10C - the authorization stage                                         */
/* -------------------------------------------------------------------------- */

/**
 * Why the worker may not authorize yet.
 *
 * A CLASSIFICATION AND NEVER A DESCRIPTION OF HIS DATA. Neither code says anything about what he
 * entered; the rules he has broken so far are the interview's `violations`, in his own words, and
 * they are a separate thing from whether the proposal as a whole is at the point of being put in
 * force.
 */
export const PAYROLL_PAYMENT_AUTHORIZATION_BLOCKERS = [
  "PROPOSAL_NOT_REVIEW_READY",
  "ALREADY_AUTHORIZED",
  /**
   * THE RECORD HE ASKED TO REPLACE IS NO LONGER THE ONE IN FORCE (Gate 10C-E3 slice 4).
   *
   * The slice 3 token, arriving as a BLOCKER on the read rather than only as a refusal on the act
   * - the same situation reached by reading instead of by signing. It says only that what he named
   * is not current: never what is, never whose, and never whether anything exists.
   *
   * A SCREEN TO RECOVER AND NOT AN ERROR TO SHOW. The surface drops the claim and reads the
   * authority again, which is the delivered E3 recovery, so he is put back in front of whatever is
   * actually in force to decide about instead of signing against a record he was never shown.
   */
  "REPLACEMENT_INSTRUCTION_MISMATCH",
] as const;
export type PayrollPaymentAuthorizationBlocker =
  (typeof PAYROLL_PAYMENT_AUTHORIZATION_BLOCKERS)[number];

/**
 * One account as it appears on a RECORDED instruction, which is not the same thing as one the
 * worker is still editing.
 *
 * IT CARRIES NO `accountId`, AND THAT IS THE CONTRACT RATHER THAN AN OVERSIGHT. The stable
 * identifier is draft-editing machinery: the browser holds it and echoes it back on save so the
 * server can recognise the account it was already holding and carry that account's protected
 * values forward (owner ruling QA-L4-R1). An authorized instruction is an immutable version -
 * there is no save to echo anything back on, nothing to carry forward, and no account to
 * re-recognise - so the recorded projection has no reason to expose one, and does not.
 *
 * WRITTEN DOWN HERE BECAUSE ASSUMING OTHERWISE ALREADY COST US ONE DEFECT. This shape was
 * previously declared as the interview's own account view, which promises an `accountId`; a screen
 * read that promise, reached for the field on a real recorded outcome and got `undefined`. Stating
 * the absence in the type means the next reader is told, and the compiler stops the same reach.
 */
export type PayrollPaymentRecordedAccountView = Omit<
  PayrollPaymentAccountView,
  "accountId"
>;

/**
 * WHAT IS ON RECORD once he has authorized: facts, and not a sentence.
 *
 * READ THE ABSENCES, because they are most of the contract. There is no transmitted flag, no bank
 * acceptance, no provider acknowledgement, no payroll run, no paycheck identifier, no card, no card
 * status and no administrative fulfilment - so a screen cannot report one of those from this shape,
 * because there is nowhere on it to read one from. Gate 10C records an authorized instruction; it
 * runs no payroll and it sets up no card.
 *
 * `accounts` IS MASKED LIKE EVERY OTHER PROJECTION HERE (10-R7), and is empty for the payroll card,
 * which carries no accounts at all.
 */
export type PayrollPaymentRecordedOutcome = {
  paymentMethod: PayrollPaymentMethod;
  setVersion: number;
  /** When he performed the governed act. The server's clock, never the browser's. */
  authorizedAt: string;
  /** When the instruction started governing payroll. Not his to choose (10-R2). */
  effectiveFrom: string;
  accounts: PayrollPaymentRecordedAccountView[];
};

/**
 * The authorization stage: what he is about to put in force, or what he already did.
 *
 * ONE SHAPE FOR BOTH SIDES OF THE ACT. A screen reads `executed` and shows one or the other, which
 * is what keeps "has he finished" a SERVER answer rather than a browser guess. There is no
 * `moduleComplete` field on this type and there must never be one: completion is derived
 * server-side from the module's own validator, and a browser that could assert it would be a
 * second completion authority disagreeing with the first.
 *
 * THE TWO KINDS OF WORDS ARE SEPARATE FIELDS BECAUSE THEY ARE SEPARATE THINGS. `authorization` is
 * the AUTHORITATIVE governed statement, resolved, hashed and projected by the delivered execution
 * surface; `guidance` is Jarvis explaining it. A screen that rendered them as one block would be
 * putting Jarvis wording inside what the worker signs, so nothing in this client merges them.
 */
export type PayrollPaymentAuthorization = {
  /** What he is authorizing, masked. Null while the proposal is not admissible as a whole. */
  review: PayrollPaymentReview | null;
  /** Whether he may authorize now. ADVISORY: the server decides again when the act arrives. */
  available: boolean;
  blockers: PayrollPaymentAuthorizationBlocker[];
  /** Jarvis explanation. Explains the statement; is not part of it and is not hashed with it. */
  guidance: string[];
  /**
   * The governed authorization, as the DELIVERED execution subject projection.
   *
   * Carried whole and passed through untouched. Its `content.revision`, `content.contentHash` and
   * `content.ruleRevision` are the exact three values that travel back with the act; nothing here
   * recomputes or refreshes any of them, because each would turn a claim about what was displayed
   * into a claim the display never made.
   */
  authorization: OnboardingExecutionSubject;
  /** What is on record, or null while nothing is. */
  executed: PayrollPaymentRecordedOutcome | null;
};

/* -------------------------------------------------------------------------- */
/*  Gate 10C-E3 - verifying instructions already in force                      */
/* -------------------------------------------------------------------------- */

/**
 * WHERE THE WORKER STANDS with respect to the record already governing his pay.
 *
 * A MIRROR OF THE SERVER'S OWN VOCABULARY (`payroll-payment.verification.service.ts`) AND NOT A
 * BROWSER OPINION. The browser never derives one of these from anything it holds: not from a
 * saved draft, not from whether an instruction exists, not from a date it compared. It asks, and
 * what comes back decides which screen the worker sees.
 *
 * FIVE STATES, AND ONLY ONE OF THEM IS A QUESTION FOR HIM. `RECORD_STALE` is the one that carries
 * a record to look at; the other four are answers about why there is nothing to ask.
 */
export const PAYROLL_PAYMENT_VERIFICATION_STATES = [
  "NOT_APPLICABLE",
  "SATISFIED",
  "RECORD_STALE",
  "RECORD_ABSENT",
  "RECORD_CHANGED",
] as const;
export type PayrollPaymentVerificationState =
  (typeof PAYROLL_PAYMENT_VERIFICATION_STATES)[number];

export const PAYROLL_PAYMENT_VERIFICATION_RECORD_STALE: PayrollPaymentVerificationState =
  "RECORD_STALE";
export const PAYROLL_PAYMENT_VERIFICATION_RECORD_ABSENT: PayrollPaymentVerificationState =
  "RECORD_ABSENT";
export const PAYROLL_PAYMENT_VERIFICATION_RECORD_CHANGED: PayrollPaymentVerificationState =
  "RECORD_CHANGED";

/**
 * One account of an instruction ALREADY IN FORCE, as the server's read-security boundary projects
 * it.
 *
 * NOT THE SAME SHAPE AS `PayrollPaymentAccountView`, and the differences are the point rather than
 * an inconsistency. That one describes a DRAFT the worker is still editing, so it carries his
 * account's draft identity and says which boxes he has filled in. This one describes an immutable
 * record, so it carries neither: there is no box to fill in and no identity to carry forward.
 *
 * BOTH MASKS ARE NON-NULL HERE, which the draft shape cannot promise. A record in force was
 * complete when it was put in force, so there is no "not entered yet" for either value - and there
 * is still no field on this type that a full routing or account number could occupy.
 */
export type PayrollPaymentInstructionAccountView = {
  position: number;
  accountType: PayrollDepositAccountType;
  financialInstitutionName: string;
  /** WORKER_SELF_REPORTED in V1. Never presented as externally verified (10-R3). */
  institutionSource: string;
  allocationKind: PayrollDepositAllocationKind;
  allocationPercentage: string | null;
  allocationAmount: string | null;
  routingNumberMasked: string;
  accountNumberMasked: string;
};

/**
 * One payroll payment instruction as the worker may recognise it.
 *
 * `setVersion`, `effectiveFrom`, `supersededAt` and `superseded` ARE CARRIED BECAUSE THE SERVER
 * SENDS THEM, AND ARE NOT SHOWN TO ANYBODY. They are record-keeping facts about a governed
 * version, and a worker asked "is this still how you want to be paid?" is not helped by a version
 * number. The panel that renders this reads the payment method and the accounts, and nothing else
 * on this type reaches the screen.
 */
export type PayrollPaymentInstructionView = {
  setVersion: number;
  paymentMethod: PayrollPaymentMethod;
  allocationMode: PayrollPaymentAllocationMode | null;
  routingVerificationMethod: string | null;
  accountConfirmationMethod: PayrollAccountConfirmationMethod | null;
  effectiveFrom: string;
  supersededAt: string | null;
  superseded: boolean;
  accounts: PayrollPaymentInstructionAccountView[];
};

/**
 * The verification read, whole.
 *
 * `instructionId` IS AN IDENTITY TO HAND BACK, NEVER A VALUE TO SHOW. It is opaque: the browser
 * does not parse it, order by it, store it, log it or render it. It exists so that the affirmation
 * or the replacement the worker goes on to make can name the exact record he was looking at, and
 * so the server can refuse it if that is no longer the record in force.
 */
export type PayrollPaymentVerification = {
  state: PayrollPaymentVerificationState;
  /** Non-null only for `RECORD_STALE`. */
  instructionId: string | null;
  /** Non-null only for `RECORD_STALE`. */
  instruction: PayrollPaymentInstructionView | null;
  evaluatedAt: string;
};

/** What the server made of an affirmation. */
export type PayrollPaymentConfirmation = {
  /** The record actually affirmed, as the SERVER resolved it. Opaque, and never displayed. */
  instructionId: string;
  /** False when the record was already current and this request wrote nothing new. */
  confirmationRecorded: boolean;
};

/**
 * WHICH RECORD THE WORKER IS DELIBERATELY REPLACING.
 *
 * PRESENT ONLY WHEN HE ASKED TO CHANGE HIS DETAILS, and absent from every other authorization -
 * see `authorizeOwnPayrollPayment`, which omits the field entirely rather than sending it null.
 * The server refuses an authorization carrying no such claim exactly as it always did, so the
 * absence is not a formality: it is what keeps an ordinary submission from silently superseding
 * instructions the worker never asked to change.
 */
export type PayrollPaymentReplacementClaim = {
  reviewedInstructionId: string;
};

/**
 * ONE ACT OF PAYROLL PAYMENT AUTHORIZATION.
 *
 * NOTE WHAT IS NOT ON IT, because that is the governance. No payment method, no account, no routing
 * number, no account number, no allocation and no instruction content of any kind: what he
 * authorizes is the proposal the SERVER already holds. A client that could restate the instruction
 * here could authorize one thing while having shown him another.
 *
 * NOR IS THERE AN EFFECTIVE DATE, A VERSION, AN EXECUTION IDENTIFIER OR A COMPLETION FLAG. Each
 * would be a caller asserting the OUTCOME of the act rather than performing it.
 */
export type AuthorizePayrollPaymentInput = {
  /** The exact governed content the client claims it displayed. Forwarded unchanged. */
  presented: PresentedOnboardingExecutionContent;
  /** Copied from the subject's own `requiredForm`, never derived from what the worker did. */
  performedForm: OnboardingExecutionForm;
  /** The worker's mark, as the DELIVERED shared capture carries it. Geometry and a duration. */
  capture?: OnboardingExecutionCapture | null;
  /**
   * [ADDED BY GATE 10C-E3 SLICE 4.] The record he deliberately chose to replace, when he did.
   *
   * OPTIONAL, AND ITS ABSENCE IS THE DEFAULT RATHER THAN AN OMISSION. It is set from ONE thing:
   * the worker pressing "No - I need to make a change" against a record he was shown. It is never
   * set because an instruction exists, because a draft differs from it, or because a verification
   * was outstanding.
   */
  replaces?: PayrollPaymentReplacementClaim | null;
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
  /**
   * [ADDED BY GATE 10C. The three refusals a worker can now actually cause, because he can now
   * perform an act. Each is reachable only by a client that got ahead of the server - authorizing
   * a proposal that is not review-ready, or authorizing twice - so their sentences read as our
   * fault rather than his.]
   */
  "PROPOSAL_NOT_REVIEW_READY",
  "ALREADY_AUTHORIZED",
  /** The act could not be bound to the instruction it was performed against (10-R8). */
  "INSTRUCTION_BINDING_UNAVAILABLE",
  /**
   * [ADDED BY GATE 10C-E3. The five refusals the verification surface can answer with, and every
   * one of them is RECOVERABLE - which is why the browser must be able to tell them apart rather
   * than showing one sentence for all five. Four of them mean the same thing to the worker in
   * different words ("what you were looking at is not what we hold now"), and the recovery for all
   * four is to read the record again; but WHICH SCREEN he is sent back to differs, and so does
   * whether he has details of his own still in hand.
   *
   * NONE OF THEM IS SHOWN TO HIM AS A CODE, and none is shown as a failure of his. Each is
   * reachable only by a screen that got behind the server, which is our timing rather than his
   * mistake.
   */
  "VERIFICATION_NOT_APPLICABLE",
  "VERIFICATION_REFRESH_REQUIRED",
  "VERIFICATION_INSTRUCTION_MISMATCH",
  "NO_EFFECTIVE_INSTRUCTION",
  "REPLACEMENT_INSTRUCTION_MISMATCH",
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
/*  Worker surface - five calls, and the fifth is the only act                 */
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

/**
 * GATE 10C - the authorization stage: what he is about to put in force, or what he already did.
 *
 * READING WHAT ONE WOULD BE ASKED TO AUTHORIZE IS NOT AUTHORIZING IT. This performs nothing,
 * records nothing and completes nothing, which is why it is a GET.
 *
 * [AMENDED BY GATE 10C-E3 SLICE 4.] It now says WHICH TASK the worker is on, where he is on the
 * replacement one. Whether he is authorizing for the first time or replacing what governs his pay
 * cannot be read off any record - both have the same instruction, the same act and the same draft
 * - so a read that is not told reports the record he is replacing as his finished module, and the
 * signature that would replace it is never reached.
 *
 * THE CLAIM IS THE WORKER'S OWN AND NOTHING IS INFERRED FROM IT HERE. It is passed when the screen
 * that asked him the question hands one over, omitted otherwise, and it grants nothing: the server
 * resolves the operative instruction for itself, and the act decides admission again at write
 * time. Every initial authorization omits it and is the request it always was.
 */
export async function getOwnPayrollPaymentAuthorization(
  invocationId: string,
  reviewedInstructionId: string | null = null,
): Promise<PayrollPaymentAuthorization> {
  /*
    OMITTED RATHER THAN SENT EMPTY. An `?reviewedInstructionId=` with nothing after it is a claim
    naming no record, which the server would have to answer as a lapsed one - so the ordinary read
    carries no query string at all.
  */
  const query = reviewedInstructionId
    ? `?reviewedInstructionId=${encodeURIComponent(reviewedInstructionId)}`
    : "";
  return onboardingWorkerFetch<PayrollPaymentAuthorization>(
    `${workerBase(invocationId)}/authorization${query}`,
  );
}

/**
 * GATE 10C - PUT THE WORKER'S PAYROLL PAYMENT INSTRUCTIONS IN FORCE.
 *
 * THE ONE ACT THIS CLIENT CAN PERFORM, and the terminal worker action for this module. Everything
 * before it saved a proposal he could change.
 *
 * IT IS NOT A COMPLETION CALL. Nothing here asserts that the module is finished and there is no
 * field on the payload through which it could: what comes back is the SERVER's answer about what is
 * now on record, and whether the module completed is the server's own derivation from it.
 */
export async function authorizeOwnPayrollPayment(
  invocationId: string,
  input: AuthorizePayrollPaymentInput,
): Promise<PayrollPaymentAuthorization> {
  return onboardingWorkerFetch<PayrollPaymentAuthorization>(
    `${workerBase(invocationId)}/authorization`,
    {
      method: "POST",
      body: {
        // Field by field, so a caller cannot widen the payload by handing in extra properties -
        // the same posture the delivered execution client takes with its own submission.
        presented: input.presented,
        performedForm: input.performedForm,
        capture: input.capture ?? null,
        /*
          [ADDED BY GATE 10C-E3 SLICE 4, AND SPREAD RATHER THAN SET, which is the difference
          between an absent field and a null one. An ordinary authorization sends no `replaces`
          key at all - not `replaces: null`, not `replaces: {}` - so the request the worker's
          first authorization makes is byte-for-byte the request it always made, and a caller
          that forgot to pass a claim cannot have one manufactured for it.

          NARROWED TO THE ONE FIELD the server reads, for the reason every other field on this
          body is copied out by name: a claim assembled elsewhere cannot smuggle a second
          property through this call.
        */
        ...(input.replaces
          ? {
              replaces: {
                reviewedInstructionId: input.replaces.reviewedInstructionId,
              },
            }
          : {}),
      },
    },
  );
}

/**
 * GATE 10C-E3 - IS THE RECORD ALREADY GOVERNING HIS PAY STILL THE ONE HE WANTS?
 *
 * THE SERVER ANSWERS THIS, AND THE BROWSER MAY NOT. Whether a worker is being asked to verify his
 * payroll record depends on his whole applicable composition, on how long a record is treated as
 * current, and on whether the record behind an earlier verdict is still the one in force - none of
 * which the browser holds any part of. So this is the FIRST thing the module asks on the way in,
 * and the answer decides the screen.
 *
 * READING IS NOT AFFIRMING. This records nothing, refreshes nothing and confirms nothing, which is
 * why it is a GET; the affirmation is the call below it.
 */
export async function getOwnPayrollPaymentVerification(
  invocationId: string,
): Promise<PayrollPaymentVerification> {
  return onboardingWorkerFetch<PayrollPaymentVerification>(
    `${workerBase(invocationId)}/verification`,
  );
}

/**
 * GATE 10C-E3 - "YES: THIS IS STILL HOW I WANT TO BE PAID."
 *
 * THE WORKER'S AFFIRMATION OF ONE EXACT RECORD, and the identity is the whole of what it carries.
 * No payment details, no candidate, no verdict, no date and no state: those are the server's, and
 * a body that offered them would be offering a client the chance to be its own authority.
 *
 * THE IDENTITY IS THE ONE HE WAS SHOWN, taken from the verification read that produced the screen
 * and never re-fetched at the moment he presses the button. Re-fetching it is precisely how an
 * affirmation of a record the worker never saw gets submitted, so the value handed here is the one
 * that came back with the record on screen - and if the record has moved since, the server refuses
 * it rather than the browser quietly agreeing to something else.
 */
export async function confirmOwnPayrollPaymentVerification(
  invocationId: string,
  input: { instructionId: string },
): Promise<PayrollPaymentConfirmation> {
  return onboardingWorkerFetch<PayrollPaymentConfirmation>(
    `${workerBase(invocationId)}/verification`,
    { method: "POST", body: { instructionId: input.instructionId } },
  );
}
