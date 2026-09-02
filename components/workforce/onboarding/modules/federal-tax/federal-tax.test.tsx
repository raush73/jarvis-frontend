/**
 * Module 4.2 Federal Tax - the worker's guided interview and the act that puts it in force.
 *
 * What this suite is answerable for:
 *
 *  - The module reaches the worker through the DELIVERED Phase 1 runtime, by registration, at the
 *    canonical URL. Nothing renders a second onboarding application.
 *  - He is shown the canonical record MASKED, and no full identification number exists anywhere on
 *    the screen, in the payload, or in this capsule.
 *  - He is asked about his circumstances and never about a government document.
 *  - The questions ADAPT: an inapplicable one is not greyed out, not disabled, and not rendered.
 *  - Nothing suggests an answer. No option is pre-selected and no answer is defaulted.
 *  - Guidance accompanies every question, verbatim as the server sent it.
 *  - EXPLICIT SAVE, in the strong sense: nothing is persisted by typing, nothing reaches the shared
 *    runtime draft, and nothing at all reaches browser storage.
 *  - A refused save keeps every answer, says what was refused, and records nothing.
 *  - He can be interrupted and resume: his in-session answers survive step navigation, and where he
 *    resumes and what counts as answered are the SERVER's answers rather than a remembered position.
 *  - He can review everything applicable and correct any of it.
 *  - NO STEP OF THE INTERVIEW EXECUTES ANYTHING. Saving is never signing, an unfinished interview
 *    reaches no signing control, and confirming the review says so in words.
 *  - HE CAN THEN PUT IT IN FORCE, once and deliberately: he is shown what he is signing, Jarvis's
 *    explanation and the AUTHORITATIVE certification are separately presented and never merged, an
 *    exemption requires both governed conditions before a control appears at all, the mark is drawn
 *    on the DELIVERED shared capture surface, and the exact wording he was shown travels back with
 *    the act.
 *  - THE ACT'S OUTCOMES ARE THE SERVER'S. Success shows the executed election and offers his own
 *    copy through the DELIVERED document surface by identity; a refusal says nothing was put in
 *    force, keeps a signature the server would still accept, and discards one performed against
 *    wording that has moved.
 *  - THIS CAPSULE NEVER CLAIMS COMPLETION and never builds a signature engine of its own.
 *  - AND ONCE AN ELECTION IS IN FORCE HE CAN ELECT AGAIN, through the GOVERNED LATER PATH: he
 *    chooses between "something I told you was wrong" and "my situation has changed", states what
 *    was wrong where that is what he chose, and signs the same authoritative certification again.
 *    THE EARLIER RECORD SURVIVES, IS SHOWN AS HISTORY, AND IS NEVER CALLED A MISTAKE ON THE STRENGTH
 *    OF A LATER ELECTION EXISTING. Nothing here edits a recorded election, and no control on any
 *    surface in this capsule could.
 *
 * THE FAKE SERVER BELOW APPLIES THE GOVERNED RULES rather than echoing the request, because the
 * behaviours that matter are exactly the ones a naive echo would hide: normalization erasing what a
 * branch no longer collects, a Save opening questions the worker had not been asked, and a
 * certification refused for each governed reason in the order the server refuses them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import type {
  CertifyFederalTaxElectionInput,
  CertifyFederalTaxNewElectionInput,
  FederalTaxCertification,
  FederalTaxExecutedElection,
  FederalTaxInterview,
  FederalTaxQuestion,
  FederalTaxQuestionChoice,
  FederalTaxReviewLine,
  SaveFederalTaxInterviewInput,
} from "@/lib/workforce/federalTaxApi";

const push = vi.fn();

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

vi.mock("@/lib/workforce/federalTaxApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/federalTaxApi")>();
  return {
    ...actual,
    getOwnFederalTaxInterview: vi.fn(),
    saveOwnFederalTaxInterview: vi.fn(),
    getOwnFederalTaxCertification: vi.fn(),
    certifyOwnFederalTaxElection: vi.fn(),
    certifyOwnFederalTaxNewElection: vi.fn(),
  };
});

/**
 * The DELIVERED worker document client, mocked at its own boundary.
 *
 * Mocked rather than replaced by something local, which is the point of the assertion it supports:
 * the retained artifact must reach the worker through the delivered surface, so this suite proves
 * the delivered function is the one called and that a location is never held in the capsule.
 */
vi.mock("@/lib/workforce/onboardingDocumentApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingDocumentApi")>();
  return { ...actual, getOnboardingDocumentDownload: vi.fn() };
});

const {
  getOnboardingRuntime,
  getRuntimeModuleDraft,
  saveRuntimeModuleDraft,
  modulePath,
  packetPath,
} = await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const {
  getOwnFederalTaxInterview,
  saveOwnFederalTaxInterview,
  getOwnFederalTaxCertification,
  certifyOwnFederalTaxElection,
  certifyOwnFederalTaxNewElection,
} = await import("@/lib/workforce/federalTaxApi");
const { getOnboardingDocumentDownload } = await import(
  "@/lib/workforce/onboardingDocumentApi"
);
const { OnboardingRuntimeProvider } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext"
);
const { default: OnboardingModuleHost } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingModuleHost"
);
const { resolveOnboardingModuleRenderer } = await import(
  "@/components/workforce/onboarding/runtime/moduleRegistry"
);
const { resetFederalTaxAnswerStore } = await import("./federalTaxAnswerStore");
const { INVOCATION_ID, fixtureModule, fixturePacket, fixtureRuntime, step } = await import(
  "@/components/workforce/onboarding/runtime/runtimeTestFixtures"
);

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the worker layout imports it.
 * Nothing in this suite registers a renderer of its own, so what is exercised below is what ships.
 */
await import("./register.worker");

const MODULE_KEY = "FEDERAL_TAX";
const MODULE_SLUG = "federal-tax";
const IDENTITY = "identity";
const WITHHOLDING = "withholding";
const REVIEW = "review";
const CANDIDATE = "candidate-fixture-1";
const WORKER_NAME = "Dale Wilson";
const MASKED = "***-**-1234";
const FULL_IDENTIFIER = "555001234";

/* -------------------------------------------------------------------------- */
/*  The governed question set, mirrored so the fake server can apply it        */
/* -------------------------------------------------------------------------- */

type AnswerMap = Record<string, string | boolean | null>;

const FILING_CHOICES: FederalTaxQuestionChoice[] = [
  {
    value: "SINGLE_OR_MARRIED_FILING_SEPARATELY",
    label: "Single, or married and filing separately from my spouse",
  },
  { value: "MARRIED_FILING_JOINTLY", label: "Married and filing together with my spouse" },
  { value: "HEAD_OF_HOUSEHOLD", label: "Head of household" },
];

type Spec = {
  key: string;
  step: typeof IDENTITY | typeof WITHHOLDING | typeof REVIEW;
  kind: FederalTaxQuestion["kind"];
  prompt: string;
  required: boolean;
  choices?: FederalTaxQuestionChoice[];
  when?: { key: string; equals: boolean };
};

const SPECS: Spec[] = [
  {
    key: "identityConfirmed",
    step: IDENTITY,
    kind: "CONFIRMATION",
    prompt: "Is this you, and is the information we already have on file correct?",
    required: true,
  },
  {
    key: "filingStatus",
    step: WITHHOLDING,
    kind: "CHOICE",
    prompt: "How do you file your federal taxes?",
    required: true,
    choices: FILING_CHOICES,
  },
  {
    key: "exemptionElected",
    step: WITHHOLDING,
    kind: "YES_NO",
    prompt:
      "Are you claiming that no federal income tax needs to be withheld from your pay this year?",
    required: true,
  },
  {
    key: "multipleJobsElected",
    step: WITHHOLDING,
    kind: "YES_NO",
    prompt:
      "Do you have another job, or a spouse who works, that you want your withholding here to account for?",
    required: true,
    when: { key: "exemptionElected", equals: false },
  },
  {
    key: "adjustmentsElected",
    step: WITHHOLDING,
    kind: "YES_NO",
    prompt: "Is there anything else you want your withholding here to take into account?",
    required: true,
    when: { key: "exemptionElected", equals: false },
  },
  {
    key: "dependentsCreditAmount",
    step: WITHHOLDING,
    kind: "AMOUNT",
    prompt:
      "The total amount you are claiming for children or other dependents, if you are claiming any.",
    required: false,
    when: { key: "adjustmentsElected", equals: true },
  },
  {
    key: "otherIncomeAmount",
    step: WITHHOLDING,
    kind: "AMOUNT",
    prompt:
      "Other yearly income of yours that nothing is being withheld from, if you want it taken into account.",
    required: false,
    when: { key: "adjustmentsElected", equals: true },
  },
  {
    key: "deductionsAmount",
    step: WITHHOLDING,
    kind: "AMOUNT",
    prompt: "Yearly deductions of yours beyond the standard one, if you want them taken into account.",
    required: false,
    when: { key: "adjustmentsElected", equals: true },
  },
  {
    key: "additionalWithholdingAmount",
    step: WITHHOLDING,
    kind: "AMOUNT",
    prompt: "An extra amount you want held back from each paycheck, if you want one held back.",
    required: false,
    when: { key: "adjustmentsElected", equals: true },
  },
  {
    key: "reviewConfirmed",
    step: REVIEW,
    kind: "CONFIRMATION",
    prompt: "Have you read everything above and is it what you meant to choose?",
    required: true,
  },
];

const STEP_TITLES: Record<string, string> = {
  identity: "Confirm who you are",
  withholding: "Your federal withholding choices",
  review: "Review what you have chosen",
};

/**
 * The SERVER's word for each step once it is done, copied here as a fixture value.
 *
 * Each step gets its own, because the three steps are three different acts. A fixture that
 * chose one word for all of them would be re-deciding what the module already states, and the
 * assertions below would then prove the fixture rather than the contract.
 */
const STEP_RECORDED_WORDS: Record<string, string> = {
  identity: "Confirmed",
  withholding: "Answered",
  review: "Confirmed",
};

const STEP_OUTSTANDING_WORD = "Still to do";

function emptyAnswers(): AnswerMap {
  const answers: AnswerMap = {};
  for (const spec of SPECS) {
    answers[spec.key] = spec.kind === "CONFIRMATION" ? false : null;
  }
  return answers;
}

function presented(answers: AnswerMap): Spec[] {
  return SPECS.filter(
    (spec) => !spec.when || answers[spec.when.key] === spec.when.equals,
  );
}

/** The server's normalization: clear whatever the worker's own branching un-presented. */
function normalize(answers: AnswerMap): AnswerMap {
  let current = { ...answers };
  for (let pass = 0; pass < SPECS.length; pass += 1) {
    const open = new Set(presented(current).map((spec) => spec.key));
    const next = { ...current };
    let changed = false;
    for (const spec of SPECS) {
      if (open.has(spec.key)) continue;
      const cleared = spec.kind === "CONFIRMATION" ? false : null;
      if (next[spec.key] !== cleared) {
        next[spec.key] = cleared;
        changed = true;
      }
    }
    if (!changed) return current;
    current = next;
  }
  return current;
}

function displayAnswer(spec: Spec, value: string | boolean | null): string {
  if (spec.kind === "CHOICE") {
    return (
      spec.choices?.find((choice) => choice.value === value)?.label ?? "Not answered yet"
    );
  }
  if (spec.kind === "AMOUNT") {
    return value === null ? "Nothing entered" : `$${String(value)}`;
  }
  if (value === true) return "Yes";
  if (value === false) return spec.kind === "CONFIRMATION" ? "Not confirmed yet" : "No";
  return "Not answered yet";
}

function recordedSteps(answers: AnswerMap): string[] {
  const open = presented(answers);
  const answered = (slug: string): boolean =>
    open
      .filter((spec) => spec.step === slug && spec.required)
      .every((spec) =>
        spec.kind === "CONFIRMATION"
          ? answers[spec.key] === true
          : answers[spec.key] !== null,
      );

  const recorded: string[] = [];
  const identityDone = answers.identityConfirmed === true;
  if (identityDone) recorded.push(IDENTITY);
  const withholdingDone = identityDone && answered(WITHHOLDING);
  if (withholdingDone) recorded.push(WITHHOLDING);
  if (withholdingDone && answers.reviewConfirmed === true) recorded.push(REVIEW);
  return recorded;
}

function projectInterview(
  answers: AnswerMap,
  overrides: Partial<FederalTaxInterview> = {},
): FederalTaxInterview {
  const open = presented(answers);
  const questions: FederalTaxQuestion[] = open.map((spec) => ({
    key: spec.key as FederalTaxQuestion["key"],
    step: spec.step,
    kind: spec.kind,
    prompt: spec.prompt,
    choices: spec.choices ?? [],
    required: spec.required,
    answer: answers[spec.key],
    guidance: {
      heading: `Why we ask about ${spec.key}`,
      paragraphs: [`Guidance for ${spec.key}, sent by the server.`],
    },
  }));
  const review: FederalTaxReviewLine[] = open
    .filter((spec) => spec.step !== REVIEW)
    .map((spec) => ({
      key: spec.key as FederalTaxReviewLine["key"],
      prompt: spec.prompt,
      answer: displayAnswer(spec, answers[spec.key]),
    }));
  const recorded = recordedSteps(answers);

  return {
    moduleKey: MODULE_KEY,
    questionSet: {
      questionSetVersion: "FEDERAL_TAX_INTERVIEW_V1",
      formKey: "FEDERAL_WITHHOLDING_ELECTION",
      formRevision: null,
    },
    questionSetSuperseded: false,
    identity: {
      candidateId: CANDIDATE,
      displayName: WORKER_NAME,
      maskedIdentifier: MASKED,
      identifierOnFile: true,
      city: "Louisville",
      state: "KY",
    },
    steps: (["identity", "withholding", "review"] as const).map((slug) => ({
      slug,
      title: STEP_TITLES[slug],
      recorded: recorded.includes(slug),
      stateWord: recorded.includes(slug)
        ? STEP_RECORDED_WORDS[slug]
        : STEP_OUTSTANDING_WORD,
    })),
    recordedStepSlugs: recorded as FederalTaxInterview["recordedStepSlugs"],
    resumeStep: ((["identity", "withholding", "review"] as const).find(
      (slug) => !recorded.includes(slug),
    ) ?? REVIEW) as FederalTaxInterview["resumeStep"],
    questions,
    review,
    interviewComplete: recorded.length === 3,
    savedAt: null,
    hasOperativeElection: false,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  The fake server                                                            */
/* -------------------------------------------------------------------------- */

let stored: AnswerMap = emptyAnswers();
let saves: SaveFederalTaxInterviewInput[] = [];

/** What the certified server does with a submitted answer set, modelled honestly. */
function applySave(input: SaveFederalTaxInterviewInput): FederalTaxInterview {
  saves.push(input);
  const submitted = emptyAnswers();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    submitted[key] = value as string | boolean | null;
  }
  stored = normalize(submitted);
  return projectInterview(stored, { savedAt: new Date().toISOString() });
}

/* -------------------------------------------------------------------------- */
/*  The certification stage, and the governed act                              */
/* -------------------------------------------------------------------------- */

/**
 * The AUTHORITATIVE certification, exactly as the governed backend supplies it.
 *
 * Held as a constant so the assertions below can prove the screen renders the SERVER's wording
 * verbatim and that this capsule authors none of it. The statement is the federal one, and no
 * paraphrase of it appears anywhere in this suite.
 */
const CERTIFICATION_SUBJECT_KEY = "WORKER_CERTIFICATION";
const CERTIFICATION_STATEMENT =
  "Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.";
const CERTIFICATION_REVISION = "2026-08-19";
const CERTIFICATION_RULE_REVISION = "2026-08-19";
const CERTIFICATION_HASH = "sha256:certification-2026-08-19";
const APPLICABLE_TAX_YEAR = "2026";
const PRIOR_TAX_YEAR = "2025";

/** Jarvis's own explanation. Separate wording, separate field, never inside the certification. */
const CERTIFICATION_GUIDANCE = [
  "This is the last step. Up to now your answers have only been saved. Signing here puts them in force and tells our payroll system how much federal income tax to hold back from your pay.",
  'The sentence below is the federal government\'s own wording, not ours, and we are not allowed to reword it. "Under penalties of perjury" means you are stating that what you have told us is true as far as you know.',
];

const EXEMPTION_CONDITION_ONE = `you owed no federal income tax for ${PRIOR_TAX_YEAR}`;
const EXEMPTION_CONDITION_TWO = `you expect to owe no federal income tax for ${APPLICABLE_TAX_YEAR}`;
const EXEMPTION_GUIDANCE = [
  "You have told us that you are claiming that no federal income tax needs to be held back from your pay.",
  `Federal rules allow that only when BOTH of the following are true of you. You have to confirm both of them yourself. We cannot work either of them out for you and we will not decide it for you.`,
];

const ARTIFACT_DOCUMENT_ID = "doc-federal-withholding-1";
const ARTIFACT_SLOT_KEY = "FEDERAL_WITHHOLDING_RECORD";
const ARTIFACT_URL = "https://storage.example.test/signed/federal-withholding.pdf";

let executed: FederalTaxExecutedElection | null = null;
/**
 * Every election he has executed, newest first, as the server keeps them.
 *
 * APPEND-ONLY IN THE FAKE TOO, deliberately. A fake that replaced the entry when a later election
 * arrived would let a screen claim to preserve history while being tested against a store that
 * does not - so this one supersedes and retains, exactly as the governed store does.
 */
let history: FederalTaxExecutedElection[] = [];
let certifications: CertifyFederalTaxElectionInput[] = [];
let laterElections: CertifyFederalTaxNewElectionInput[] = [];
/** Set by a test that wants the delivered execution foundation to report moved wording. */
let governedHash = CERTIFICATION_HASH;

function refusal(code: string, status = 400): InstanceType<typeof OnboardingApiError> {
  return new OnboardingApiError(`Refused: ${code}`, status, code);
}

/**
 * The certification stage as the governed backend projects it.
 *
 * `available` is DERIVED from the blockers here exactly as the server derives it, so this fake
 * cannot present a signing control beside a stated reason the worker may not sign - which is a
 * state the real projection makes unrepresentable and a naive fake would happily produce.
 */
function projectCertification(): FederalTaxCertification {
  const interview = projectInterview(stored);
  const blockers: FederalTaxCertification["blockers"] = [];
  if (!interview.interviewComplete) blockers.push("INTERVIEW_NOT_COMPLETE");
  if (interview.questionSetSuperseded) blockers.push("QUESTION_SET_SUPERSEDED");
  if (executed) blockers.push("ELECTION_ALREADY_EXECUTED");

  /**
   * WHY HE MAY NOT ELECT AGAIN - the same interview conditions, with the third one INVERTED.
   *
   * Having an election in force blocks a FIRST election and is exactly what OPENS a later one;
   * having none blocks a later one. The two are projected from one set of facts here for the same
   * reason the server projects them that way: a screen must never be handed both affordances.
   */
  const laterBlockers = blockers.filter(
    (blocker) => blocker !== "ELECTION_ALREADY_EXECUTED",
  );
  if (!executed) laterBlockers.push("NO_OPERATIVE_ELECTION");

  const subject: FederalTaxCertification["certification"] = {
    moduleKey: MODULE_KEY,
    subjectKey: CERTIFICATION_SUBJECT_KEY,
    title: "Your federal withholding certification",
    requiredForm: "ELECTRONIC_SIGNATURE",
    content: {
      kind: "GOVERNED_TEXT",
      ref: "FEDERAL_WITHHOLDING_CERTIFICATION",
      revision: governedHash === CERTIFICATION_HASH ? CERTIFICATION_REVISION : "2026-09-01",
      ruleRevision: CERTIFICATION_RULE_REVISION,
      title: "Your federal withholding certification",
      contentHash: governedHash,
      lines: [{ label: CERTIFICATION_STATEMENT, field: null }],
    },
    current: null,
    history: [],
    requiresExecution: executed === null,
  };

  return {
    moduleKey: MODULE_KEY,
    certification: subject,
    guidance: CERTIFICATION_GUIDANCE,
    applicableTaxYear: APPLICABLE_TAX_YEAR,
    exemptionElected: stored.exemptionElected === true,
    // AFFIRMED IS FALSE ON A READ, ALWAYS, as the server reports it: an affirmation travels with the
    // mark and is not stored on the interview, so there is nothing to read back.
    exemptionConditions: [
      { condition: EXEMPTION_CONDITION_ONE, affirmed: false },
      { condition: EXEMPTION_CONDITION_TWO, affirmed: false },
    ],
    exemptionGuidance: EXEMPTION_GUIDANCE,
    review: interview.review,
    identity: interview.identity,
    available: blockers.length === 0,
    blockers,
    executed,
    newElection: {
      available: laterBlockers.length === 0,
      blockers: laterBlockers,
      // OFFERED ONLY WHERE IT IS OPEN, and in the SERVER's words - the two sentences a worker
      // chooses between are governed text, and this fake carries them rather than inventing them.
      options: laterBlockers.length === 0 ? LATER_ELECTION_OPTIONS : [],
      // THE SAME GOVERNED WORDING, PROJECTED AGAINST AN ACT NOBODY HAS PERFORMED. Modelled here
      // because it is what the server sends: the stage's own subject reports the act that put the
      // current election in force and reports it satisfied, so a fake that reused it would let this
      // capsule ship a later-election card the delivered surface would render as already done.
      certification: {
        ...subject,
        current: null,
        requiresExecution: true,
      },
    },
    history,
  };
}

/** The two governed origins as the server describes them to the worker. Verbatim. */
const LATER_ELECTION_OPTIONS = [
  {
    origin: "CORRECTION",
    title: "Something I told you was wrong",
    description:
      "Use this if the information on your current federal withholding record is incorrect - for example a filing status or an amount that was entered by mistake. You will be asked what was wrong, and your earlier record is kept exactly as it was.",
    requiresReason: true,
  },
  {
    origin: "SUBSEQUENT_ELECTION",
    title: "My situation has changed and I want to elect differently",
    description:
      "Use this if your current record was correct for the time it applied, and you now want to make a different federal withholding election going forward. Nothing about your earlier record is treated as a mistake.",
    requiresReason: false,
  },
];

/**
 * The governed act, with its refusals modelled in the ORDER the server applies them.
 *
 * Every refusal below happens BEFORE anything is recorded, which is what lets the assertions state
 * that a refused certification put nothing in force rather than hedging about it.
 */
function applyCertify(input: CertifyFederalTaxElectionInput): FederalTaxCertification {
  certifications.push(input);

  if (!projectInterview(stored).interviewComplete) {
    throw refusal("INTERVIEW_NOT_COMPLETE");
  }
  if (executed) throw refusal("ELECTION_ALREADY_EXECUTED");

  const exempt = stored.exemptionElected === true;
  const first = input.hadNoLiabilityForPriorYear === true;
  const second = input.expectsNoLiabilityForApplicableYear === true;
  // Both directions, as ruling OR-3 requires: an exemption needs both, and no exemption permits
  // neither.
  if (exempt ? !(first && second) : first || second) {
    throw refusal("EXEMPTION_CONDITIONS_REQUIRED");
  }

  assertEvidence(input);

  return record("INITIAL_ELECTION", null, exempt);
}

/**
 * The GOVERNED LATER ACT, refused in the server's order and recorded the server's way.
 *
 * The evidence rules are the initial act's rules and are applied by the shared helper. What is
 * modelled here is what is NEW: the act needs an election to supersede, needs one of exactly two
 * origins, and its reason is REQUIRED BY ONE AND REFUSED TO THE OTHER - which is the distinction
 * the whole path exists to keep.
 */
function applyCertifyLater(
  input: CertifyFederalTaxNewElectionInput,
): FederalTaxCertification {
  laterElections.push(input);

  if (!projectInterview(stored).interviewComplete) {
    throw refusal("INTERVIEW_NOT_COMPLETE");
  }
  if (!executed) throw refusal("NO_OPERATIVE_ELECTION");
  if (input.origin !== "CORRECTION" && input.origin !== "SUBSEQUENT_ELECTION") {
    throw refusal("VALUE_NOT_GOVERNED");
  }

  const stated = input.correctionReason?.trim() ?? "";
  if (input.origin === "CORRECTION" && stated.length === 0) {
    throw refusal("CORRECTION_REASON_REQUIRED");
  }
  if (input.origin === "SUBSEQUENT_ELECTION" && stated.length > 0) {
    throw refusal("CORRECTION_REASON_NOT_PERMITTED");
  }

  const exempt = stored.exemptionElected === true;
  const first = input.hadNoLiabilityForPriorYear === true;
  const second = input.expectsNoLiabilityForApplicableYear === true;
  if (exempt ? !(first && second) : first || second) {
    throw refusal("EXEMPTION_CONDITIONS_REQUIRED");
  }
  assertEvidence(input);

  return record(input.origin, input.origin === "CORRECTION" ? stated : null, exempt);
}

/** The evidence rules shared by both governed acts, in the order the server applies them. */
function assertEvidence(input: CertifyFederalTaxElectionInput): void {
  if (input.presented.contentHash !== governedHash) {
    throw refusal("EXECUTION_CONTENT_STALE");
  }
  if (input.performedForm !== "ELECTRONIC_SIGNATURE") {
    throw refusal("EXECUTION_EVIDENCE_INVALID");
  }
  if (!input.capture || input.capture.strokes.length === 0) {
    throw refusal("EXECUTION_EVIDENCE_INVALID");
  }
}

/**
 * Recording an election the way the store records one: APPEND, SUPERSEDE, RETAIN.
 *
 * The prior entry is marked superseded and KEPT. Nothing about it is rewritten - not its date, not
 * its origin, not the copy bound to it - so a screen cannot pass a test here by showing a history
 * this fake had already flattened.
 */
function record(
  origin: string,
  correctionReason: string | null,
  exempt: boolean,
): FederalTaxCertification {
  const setVersion = (executed?.setVersion ?? 0) + 1;
  const at = `2026-08-19T1${4 + setVersion}:00:00.000Z`;

  if (executed) {
    const superseded = { ...executed, current: false, supersededAt: at };
    history = [superseded, ...history.slice(1)];
  }

  executed = {
    setVersion,
    executedAt: at,
    effectiveFrom: at,
    supersededAt: null,
    current: true,
    electionOrigin: origin,
    correctionReason,
    formKey: "IRS_FORM_W4",
    formRevision: CERTIFICATION_REVISION,
    exemptionClaimed: exempt,
    receivedAt: at,
    receiptBasis: "ELECTRONIC_EXECUTION",
    executionRecordId: `exec-federal-tax-${setVersion}`,
    artifactDocumentId:
      setVersion === 1 ? ARTIFACT_DOCUMENT_ID : `${ARTIFACT_DOCUMENT_ID}-${setVersion}`,
    artifactSlotKey: ARTIFACT_SLOT_KEY,
  };
  history = [executed, ...history];
  return projectCertification();
}

function federalTaxModule(overrides: Record<string, unknown> = {}) {
  return fixtureModule({
    moduleKey: MODULE_KEY,
    moduleNumber: "4.2",
    title: "Federal Tax",
    moduleSlug: MODULE_SLUG,
    completionGranularity: "EFFECTIVE_RECORD",
    steps: [
      step(IDENTITY, STEP_TITLES.identity),
      step(WITHHOLDING, STEP_TITLES.withholding),
      step(REVIEW, STEP_TITLES.review),
    ],
    resumeStepSlug: IDENTITY,
    ...overrides,
  });
}

function openStep(stepSlug: string, overrides: Record<string, unknown> = {}) {
  vi.mocked(getOnboardingRuntime).mockResolvedValue(
    fixtureRuntime({
      packets: [fixturePacket({ modules: [federalTaxModule(overrides)] })],
    }),
  );
  return render(
    <OnboardingRuntimeProvider>
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug={MODULE_SLUG}
        stepSlug={stepSlug}
      />
    </OnboardingRuntimeProvider>,
  );
}

function saveButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Save$/ });
}

/** Whether the control behind a label is selected. This project ships no DOM matcher library. */
function isChecked(element: HTMLElement): boolean {
  return (element as HTMLInputElement).checked;
}

function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLInputElement).disabled;
}

/** The module's own section, so a scan cannot read the surrounding runtime frame as the module. */
function capsule(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".ft-module");
  if (!section) throw new Error("The module did not render.");
  return section;
}

/* -------------------------------------------------------------------------- */
/*  Drawing on the DELIVERED capture surface                                   */
/* -------------------------------------------------------------------------- */

/*
  jsdom implements no PointerEvent, and without one the testing library silently degrades a pointer
  event to a bare Event carrying no coordinate and no pointer identity - which would let every
  assertion about a drawn mark pass while proving nothing. Installed ONCE, at module scope, in the
  same shape and for the same reason as the delivered execution suite installs it.
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

/*
  jsdom implements no canvas context either. A stub is installed rather than letting the delivered
  surface skip painting, so its drawing path runs exactly as it does in a browser. Installed once at
  module scope rather than per test, because a per-test mock is cleared between tests and the real
  jsdom implementation is reached again the moment it is.
*/
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

const PAD_RECT = {
  left: 20,
  top: 40,
  width: 400,
  height: 160,
  right: 420,
  bottom: 200,
  x: 20,
  y: 40,
  toJSON: () => ({}),
} as DOMRect;

/** The delivered surface's own pad, found by the delivered surface's own attribute. */
function pad(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>("[data-capture-pad]");
  if (!element) throw new Error("no capture surface rendered");
  element.getBoundingClientRect = () => PAD_RECT;
  return element;
}

/** The delivered surface's own submit control. */
function signButton(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-execution-submit]");
  if (!element) throw new Error("no signing control rendered");
  return element;
}

/** Draw one continuous mark, as a pointer reports it. Copied from the delivered execution suite. */
async function draw(points: { x: number; y: number }[]) {
  const surface = pad();
  await act(async () => {
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
  });
  // Guards the helper itself: a draw that silently records nothing would let every assertion below
  // pass while proving nothing.
  if (surface.dataset.hasMark !== "true") {
    throw new Error(`the draw registered no mark: ${surface.outerHTML}`);
  }
}

function line(count: number, spacing = 4) {
  return Array.from({ length: count }, (_, index) => ({
    x: 10 + index * spacing,
    y: 20,
  }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: CANDIDATE,
  });

  stored = emptyAnswers();
  saves = [];
  executed = null;
  history = [];
  certifications = [];
  laterElections = [];
  governedHash = CERTIFICATION_HASH;
  resetFederalTaxAnswerStore();

  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
    packetId: "pkt-fixture-1",
    moduleKey: MODULE_KEY,
    data: {},
    updatedAt: null,
  });
  vi.mocked(saveRuntimeModuleDraft).mockImplementation(async (_i, _m, data) => ({
    packetId: "pkt-fixture-1",
    moduleKey: MODULE_KEY,
    data,
    updatedAt: new Date().toISOString(),
  }));
  vi.mocked(getOwnFederalTaxInterview).mockImplementation(async () =>
    projectInterview(stored),
  );
  vi.mocked(saveOwnFederalTaxInterview).mockImplementation(async (_id, answers) =>
    applySave(answers),
  );
  vi.mocked(getOwnFederalTaxCertification).mockImplementation(async () =>
    projectCertification(),
  );
  vi.mocked(certifyOwnFederalTaxElection).mockImplementation(async (_id, input) =>
    applyCertify(input),
  );
  vi.mocked(certifyOwnFederalTaxNewElection).mockImplementation(async (_id, input) =>
    applyCertifyLater(input),
  );
  vi.mocked(getOnboardingDocumentDownload).mockResolvedValue({
    onboardingDocumentId: ARTIFACT_DOCUMENT_ID,
    fileName: "federal-withholding-record.pdf",
    mimeType: "application/pdf",
    url: ARTIFACT_URL,
    expiresIn: 60,
  });

  window.open = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */

describe("Module 4.2 the worker federal tax interview", () => {
  // ------------------------------------------------------------------------
  // It arrives through the delivered runtime
  // ------------------------------------------------------------------------

  describe("reaching the worker", () => {
    it("is rendered by the delivered runtime because the capsule registered itself", () => {
      expect(resolveOnboardingModuleRenderer(MODULE_KEY)).toBeDefined();
    });

    it("renders the module inside the delivered module host, at the canonical URL", async () => {
      openStep(IDENTITY);
      expect(await screen.findByText(WORKER_NAME)).toBeTruthy();
      // The host's own frame, not a second onboarding shell of the module's making.
      expect(screen.getByRole("heading", { level: 1, name: "Federal Tax" })).toBeTruthy();
    });
  });

  // ------------------------------------------------------------------------
  // Worker-safe masked identity confirmation
  // ------------------------------------------------------------------------

  describe("the identity he is asked to confirm", () => {
    it("shows the canonical record with the identification number MASKED", async () => {
      openStep(IDENTITY);
      expect(await screen.findByText(WORKER_NAME)).toBeTruthy();
      expect(screen.getByText(MASKED)).toBeTruthy();
      expect(screen.getByText("Louisville, KY")).toBeTruthy();
    });

    it("puts no full identification number anywhere in the document", async () => {
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);
      expect(document.body.textContent ?? "").not.toContain(FULL_IDENTIFIER);
      expect(document.body.innerHTML).not.toContain(FULL_IDENTIFIER);
    });

    it("offers a confirmation and no way to correct the record", async () => {
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      expect(screen.getByRole("checkbox")).toBeTruthy();
      // Not a single text box: correcting canonical identity is not this module's, and a field here
      // would be a second place a worker's identity could be written from.
      expect(screen.queryAllByRole("textbox")).toHaveLength(0);
      expect(screen.getByText(/tell your MW4H contact/i)).toBeTruthy();
    });

    it("says there is nothing to confirm when the record cannot be shown", async () => {
      vi.mocked(getOwnFederalTaxInterview).mockResolvedValue(
        projectInterview(stored, { identity: null }),
      );
      openStep(IDENTITY);

      expect(
        await screen.findByText(/we cannot show you your details/i),
      ).toBeTruthy();
      expect(isDisabled(screen.getByRole("checkbox"))).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  // Plain language, and no government document
  // ------------------------------------------------------------------------

  describe("what he is asked", () => {
    it("asks about his circumstances in plain language", async () => {
      openStep(WITHHOLDING);
      expect(
        await screen.findByText("How do you file your federal taxes?"),
      ).toBeTruthy();
    });

    it("shows him no government document, step, worksheet or line reference", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      const text = document.body.textContent ?? "";
      for (const forbidden of [
        "Form W",
        "worksheet",
        "Worksheet",
        "Step 1",
        "Step 2",
        "Line 1",
        "line 4",
        "Internal Revenue",
        "IRS",
      ]) {
        expect(text).not.toContain(forbidden);
      }
    });

    it("pre-selects nothing and defaults nothing", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      for (const radio of screen.getAllByRole("radio")) {
        expect(isChecked(radio)).toBe(false);
      }
    });
  });

  // ------------------------------------------------------------------------
  // Adaptive branching, decided by the server
  // ------------------------------------------------------------------------

  describe("adaptive branching", () => {
    it("renders nothing behind an unanswered branch", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      expect(document.querySelector('[data-ft-question="exemptionElected"]')).not.toBeNull();
      expect(
        document.querySelector('[data-ft-question="multipleJobsElected"]'),
      ).toBeNull();
      expect(
        document.querySelector('[data-ft-question="dependentsCreditAmount"]'),
      ).toBeNull();
    });

    it("opens the further questions once he saves an answer that admits them", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      fireEvent.click(
        screen.getByLabelText("Married and filing together with my spouse"),
      );
      // "No" to the exemption question, which is what admits the two questions behind it.
      const noOptions = screen.getAllByLabelText("No");
      fireEvent.click(noOptions[0]);
      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(
          document.querySelector('[data-ft-question="multipleJobsElected"]'),
        ).not.toBeNull();
      });
      // And he is TOLD his answers opened them, rather than finding new fields unannounced.
      expect(document.querySelector('[data-ft-opened="true"]')).not.toBeNull();
    });

    it("opens the four amounts only once he says there is something else to take into account", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: false,
        multipleJobsElected: false,
        adjustmentsElected: true,
      });
      openStep(WITHHOLDING);

      await waitFor(() => {
        expect(
          document.querySelector('[data-ft-question="dependentsCreditAmount"]'),
        ).not.toBeNull();
      });
      expect(
        document.querySelector('[data-ft-question="additionalWithholdingAmount"]'),
      ).not.toBeNull();
    });

    it("removes the whole adjustment branch when he claims an exemption instead", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: false,
        multipleJobsElected: false,
        adjustmentsElected: true,
        dependentsCreditAmount: "4000.00",
      });
      openStep(WITHHOLDING);
      await waitFor(() => {
        expect(
          document.querySelector('[data-ft-question="dependentsCreditAmount"]'),
        ).not.toBeNull();
      });

      fireEvent.click(screen.getAllByLabelText("Yes")[0]);
      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(
          document.querySelector('[data-ft-question="dependentsCreditAmount"]'),
        ).toBeNull();
      });
      // The amount is gone from the record too, not merely hidden from him.
      expect(stored.dependentsCreditAmount).toBeNull();
    });
  });

  // ------------------------------------------------------------------------
  // Guidance
  // ------------------------------------------------------------------------

  describe("contextual guidance", () => {
    it("accompanies every question, in the server's own words", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      for (const key of ["filingStatus", "exemptionElected"]) {
        expect(document.querySelector(`[data-ft-guidance="${key}"]`)).not.toBeNull();
        expect(
          screen.getByText(`Guidance for ${key}, sent by the server.`),
        ).toBeTruthy();
      }
    });

    it("travels with the question rather than being fetched separately", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      // One read produced the questions AND their guidance. A second call for help text would be a
      // second place the governed wording could come from.
      expect(vi.mocked(getOwnFederalTaxInterview)).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------------
  // Explicit save
  // ------------------------------------------------------------------------

  describe("explicit save", () => {
    it("persists NOTHING as a consequence of typing", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      fireEvent.click(screen.getByLabelText("Head of household"));
      fireEvent.click(screen.getAllByLabelText("No")[0]);

      expect(vi.mocked(saveOwnFederalTaxInterview)).not.toHaveBeenCalled();
      // And nothing reached the runtime's shared debounced draft either.
      expect(vi.mocked(saveRuntimeModuleDraft)).not.toHaveBeenCalled();
    });

    it("writes no answer to browser storage of any kind", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");
      fireEvent.click(screen.getByLabelText("Head of household"));
      fireEvent.click(saveButton());
      await waitFor(() => expect(saves.length).toBe(1));

      const everything = [
        ...Object.keys(localStorage),
        ...Object.keys(sessionStorage),
      ].map((key) => `${key}=${localStorage.getItem(key) ?? sessionStorage.getItem(key)}`);
      const dumped = everything.join("\n");
      expect(dumped).not.toContain("HEAD_OF_HOUSEHOLD");
      expect(dumped).not.toContain("filingStatus");
      expect(dumped).not.toContain("exemption");
    });

    it("sends the WHOLE answer set in one deliberate act", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      fireEvent.click(screen.getByLabelText("Head of household"));
      fireEvent.click(screen.getAllByLabelText("Yes")[0]);
      fireEvent.click(saveButton());

      await waitFor(() => expect(saves.length).toBe(1));
      expect(saves[0]).toEqual({
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
      });
    });

    it("omits an unanswered question rather than sending a No he never gave", async () => {
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      fireEvent.click(screen.getByLabelText("Head of household"));
      fireEvent.click(saveButton());

      await waitFor(() => expect(saves.length).toBe(1));
      expect(Object.keys(saves[0])).toEqual(["filingStatus"]);
    });

    it("saves a partial interview, because saving exists in order to stop", async () => {
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(document.querySelector('[data-ft-saved="true"]')).not.toBeNull(),
      );
      expect(stored.identityConfirmed).toBe(true);
      expect(stored.filingStatus).toBeNull();
    });

    it("tells him plainly when he has unsaved answers, and stops saying so once he saves", async () => {
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);
      expect(document.querySelector('[data-ft-unsaved="true"]')).toBeNull();

      fireEvent.click(screen.getByRole("checkbox"));
      expect(document.querySelector('[data-ft-unsaved="true"]')).not.toBeNull();

      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(document.querySelector('[data-ft-unsaved="true"]')).toBeNull(),
      );
    });
  });

  // ------------------------------------------------------------------------
  // Refusals
  // ------------------------------------------------------------------------

  describe("a refused save", () => {
    it("refuses a malformed amount without a request, and keeps what he typed", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: false,
        multipleJobsElected: false,
        adjustmentsElected: true,
      });
      openStep(WITHHOLDING);
      await waitFor(() => {
        expect(
          document.querySelector('[data-ft-question="dependentsCreditAmount"]'),
        ).not.toBeNull();
      });

      const amount = document.querySelector<HTMLInputElement>("#ft-dependentsCreditAmount");
      fireEvent.change(amount as HTMLInputElement, { target: { value: "1,000.00" } });
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(document.querySelector('[data-ft-violations="true"]')).not.toBeNull(),
      );
      expect(vi.mocked(saveOwnFederalTaxInterview)).not.toHaveBeenCalled();
      expect((amount as HTMLInputElement).value).toBe("1,000.00");
    });

    it("says what the server refused, in this module's words, and keeps every answer", async () => {
      vi.mocked(saveOwnFederalTaxInterview).mockRejectedValue(
        new OnboardingApiError("Refused", 400, "ANSWER_NOT_GOVERNED"),
      );
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      fireEvent.click(screen.getByLabelText("Head of household"));
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-refusal="ANSWER_NOT_GOVERNED"]'),
        ).not.toBeNull(),
      );
      expect(screen.getByText(/Nothing was recorded/i)).toBeTruthy();
      expect(isChecked(screen.getByLabelText("Head of household"))).toBe(true);
    });

    it("says nothing was stored when the protected store could not be reached", async () => {
      vi.mocked(saveOwnFederalTaxInterview).mockRejectedValue(
        new OnboardingApiError("Refused", 400, "DRAFT_PROTECTION_UNAVAILABLE"),
      );
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-refusal="DRAFT_PROTECTION_UNAVAILABLE"]'),
        ).not.toBeNull(),
      );
      expect(screen.getByText(/we did not store them at all/i)).toBeTruthy();
    });
  });

  // ------------------------------------------------------------------------
  // Interruption, resume and truthful progress
  // ------------------------------------------------------------------------

  describe("interruption and resume", () => {
    it("keeps unsaved answers across the step navigation that unmounts the screen", async () => {
      const first = openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");
      fireEvent.click(screen.getByLabelText("Head of household"));
      first.unmount();

      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");
      expect(isChecked(screen.getByLabelText("Head of household"))).toBe(true);
      // And still nothing was persisted by the navigation itself.
      expect(vi.mocked(saveOwnFederalTaxInterview)).not.toHaveBeenCalled();
    });

    it("shows him what he saved when he comes back to a fresh session", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "MARRIED_FILING_JOINTLY",
        exemptionElected: false,
        multipleJobsElected: true,
        adjustmentsElected: false,
      });
      resetFederalTaxAnswerStore();

      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");
      expect(
        isChecked(screen.getByLabelText("Married and filing together with my spouse")),
      ).toBe(true);
    });

    it("reports progress truthfully, from the server's derivation and not from a position it kept", async () => {
      stored = normalize({ ...emptyAnswers(), identityConfirmed: true });
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      expect(
        document.querySelector('[data-ft-step="identity"]')?.getAttribute(
          "data-ft-step-recorded",
        ),
      ).toBe("true");
      expect(
        document.querySelector('[data-ft-step="withholding"]')?.getAttribute(
          "data-ft-step-recorded",
        ),
      ).toBe("false");
      expect(
        document.querySelector('[data-ft-step="review"]')?.getAttribute(
          "data-ft-step-recorded",
        ),
      ).toBe("false");
    });

    it("does not leave an exempt worker short of a step he was never asked", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
      });
      openStep(WITHHOLDING);
      await screen.findByText("How do you file your federal taxes?");

      expect(
        document.querySelector('[data-ft-step="withholding"]')?.getAttribute(
          "data-ft-step-recorded",
        ),
      ).toBe("true");
    });

    /**
     * QA-L5-UX-5. Each step is described in the word for THAT step.
     *
     * The three steps are three different acts, and one word could not describe them all:
     * he confirms who he is, he answers questions, and he confirms what he read back.
     * "Answered" beside the step that asked him nothing was untrue about his own interview.
     */
    it("says what each step is in the word the SERVER gave for that step", async () => {
      stored = normalize({ ...emptyAnswers(), identityConfirmed: true });
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      const wordFor = (slug: string) =>
        document
          .querySelector(`[data-ft-step="${slug}"]`)
          ?.querySelector("[data-ft-step-state]")?.textContent;

      expect(wordFor(IDENTITY)).toBe("Confirmed");
      expect(wordFor(WITHHOLDING)).toBe("Still to do");
      expect(wordFor(REVIEW)).toBe("Still to do");
    });

    it("takes those words from the server rather than choosing between two of its own", async () => {
      stored = normalize({ ...emptyAnswers(), identityConfirmed: true });
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      // The interview the SERVER supplied, and the words on screen, are the same words.
      const supplied = projectInterview(stored).steps;
      const rendered = Array.from(document.querySelectorAll("[data-ft-step]")).map(
        (element) => ({
          slug: element.getAttribute("data-ft-step"),
          word: element.querySelector("[data-ft-step-state]")?.textContent,
        }),
      );
      expect(rendered).toEqual(
        supplied.map((declared) => ({ slug: declared.slug, word: declared.stateWord })),
      );
    });

    it("adds no fourth step for signing", async () => {
      stored = normalize({ ...emptyAnswers(), identityConfirmed: true });
      openStep(IDENTITY);
      await screen.findByText(WORKER_NAME);

      // The certification is the module's execution, not a question in its interview.
      const slugs = Array.from(document.querySelectorAll("[data-ft-step]")).map(
        (element) => element.getAttribute("data-ft-step"),
      );
      expect(slugs).toEqual([IDENTITY, WITHHOLDING, REVIEW]);
    });
  });

  // ------------------------------------------------------------------------
  // Review and correction
  // ------------------------------------------------------------------------

  describe("review and correction", () => {
    beforeEach(() => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "MARRIED_FILING_JOINTLY",
        exemptionElected: false,
        multipleJobsElected: true,
        adjustmentsElected: true,
        dependentsCreditAmount: "4000.00",
        otherIncomeAmount: null,
        deductionsAmount: null,
        additionalWithholdingAmount: "75.25",
      });
      resetFederalTaxAnswerStore();
    });

    it("reads his answers back in plain language, as the server rendered them", async () => {
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );

      expect(
        document.querySelector('[data-ft-review-answer="filingStatus"]')?.textContent,
      ).toContain("Married and filing together with my spouse");
      expect(
        document.querySelector('[data-ft-review-answer="dependentsCreditAmount"]')
          ?.textContent,
      ).toContain("$4000.00");
      // A blank amount reads as no election, and never as a nought.
      expect(
        document.querySelector('[data-ft-review-answer="otherIncomeAmount"]')?.textContent,
      ).toContain("Nothing entered");
    });

    it("reviews only what applies to him", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
      });
      resetFederalTaxAnswerStore();
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );

      expect(
        document.querySelector('[data-ft-review-line="multipleJobsElected"]'),
      ).toBeNull();
      expect(
        document.querySelector('[data-ft-review-line="dependentsCreditAmount"]'),
      ).toBeNull();
    });

    it("excludes the review confirmation from the thing being reviewed", async () => {
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );
      expect(document.querySelector('[data-ft-review-line="reviewConfirmed"]')).toBeNull();
    });

    it("offers a correction that goes back to the question rather than editing the summary", async () => {
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );

      const change = document.querySelector('[data-ft-review-change="filingStatus"]');
      expect(change?.getAttribute("href")).toBe(
        modulePath(INVOCATION_ID, MODULE_SLUG, WITHHOLDING),
      );
    });

    it("records his review confirmation and nothing more", async () => {
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );

      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(saveButton());

      await waitFor(() => expect(stored.reviewConfirmed).toBe(true));
      expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
    });

    it("keeps his answers and drops his confirmation when the questions are superseded", async () => {
      vi.mocked(getOwnFederalTaxInterview).mockImplementation(async () =>
        projectInterview(
          { ...stored, reviewConfirmed: false },
          { questionSetSuperseded: true },
        ),
      );
      openStep(REVIEW);

      await waitFor(() =>
        expect(
          document.querySelector("[data-ft-question-set-superseded]"),
        ).not.toBeNull(),
      );
      expect(isChecked(screen.getByRole("checkbox"))).toBe(false);
      expect(
        document.querySelector('[data-ft-review-answer="filingStatus"]')?.textContent,
      ).toContain("Married and filing together with my spouse");
    });
  });

  // ------------------------------------------------------------------------
  // Nothing is executed, signed, certified or completed
  // ------------------------------------------------------------------------

  describe("the interview itself executes and completes nothing", () => {
    it("never asks the runtime to complete the module, however far he gets", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
      });
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );

      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.click(saveButton());

      // Every applicable question answered and the review confirmed - and the module is STILL not
      // complete, because completing it needs an executed election that saving does not produce.
      await waitFor(() => expect(stored.reviewConfirmed).toBe(true));
      expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
      expect(vi.mocked(certifyOwnFederalTaxElection)).not.toHaveBeenCalled();
    });

    it("offers no signing control while the interview is unfinished", async () => {
      // MAINTAINED FOR GATE 8C. Gate 8B asserted that this capsule offered no signing control AT
      // ALL, which was true of a gate that owned no act. Gate 8C gives the worker exactly one, so
      // the guarantee is now the ORDERING it always stood for: an unfinished interview reaches no
      // signature. That an act exists at all is asserted separately below, and that the capsule
      // still builds no signature engine of its own is asserted there too.
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
      });
      openStep(REVIEW);
      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-state="BLOCKED"]'),
        ).not.toBeNull(),
      );

      // Scoped to the MODULE's own section: the surrounding runtime frame carries navigation of its
      // own, and reading that as the module's would prove nothing about what this capsule offers.
      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.textContent ?? "",
      );
      expect(controls).toEqual(["Save"]);
      expect(capsule().querySelector("canvas")).toBeNull();
      expect(
        document.querySelector('[data-ft-blocker="INTERVIEW_NOT_COMPLETE"]'),
      ).not.toBeNull();
    });

    it("tells him confirming the review is not itself putting anything in force", async () => {
      openStep(REVIEW);
      await waitFor(() =>
        expect(
          document.querySelector("[data-ft-confirmation-is-not-execution]"),
        ).not.toBeNull(),
      );
      expect(
        screen.getByText(/does not\s+put them in force on its own/i),
      ).toBeTruthy();
    });

    it("shows a closed section for reference without a save control", async () => {
      openStep(REVIEW, {
        status: "COMPLETE",
        restart: {
          posture: "CLOSED",
          createsNewVersion: false,
          destroysCapturedData: false,
          reason: "MODULE_COMPLETE",
        },
      });

      expect(
        await screen.findByText(/shown for reference only/i),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Save$/ })).toBeNull();
    });
  });

  // ------------------------------------------------------------------------
  // Gate 8C - the certification, the act, and what follows it
  // ------------------------------------------------------------------------

  describe("putting his choices in force", () => {
    /** A reviewed, non-exempt interview: the ordinary worker who is ready to sign. */
    function reviewed(): AnswerMap {
      return normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "MARRIED_FILING_JOINTLY",
        exemptionElected: false,
        multipleJobsElected: false,
        adjustmentsElected: true,
        dependentsCreditAmount: "2000.00",
        otherIncomeAmount: null,
        deductionsAmount: null,
        additionalWithholdingAmount: "50.00",
        reviewConfirmed: true,
      });
    }

    /** A reviewed interview claiming an exemption, which requires the two affirmations. */
    function reviewedExempt(): AnswerMap {
      return normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
        reviewConfirmed: true,
      });
    }

    async function openCertification(answers: AnswerMap = reviewed()) {
      stored = answers;
      resetFederalTaxAnswerStore();
      openStep(REVIEW);
      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-state="READY"]'),
        ).not.toBeNull(),
      );
    }

    async function openExecutedElection() {
      await openCertification();
      await draw(line(6));
      fireEvent.click(signButton());
      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-state="EXECUTED"]'),
        ).not.toBeNull(),
      );
    }

    /* ------------------------------------------------------ reaching the act */

    it("reaches the certification from the reviewed interview, at the same URL", async () => {
      await openCertification();

      // No fourth step and no second route architecture: the act is composed into the review step
      // the interview already declared, which is how the delivered I-9 capsule composes its own.
      expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull();
      expect(capsule().querySelector("[data-ft-certify]")).not.toBeNull();
      expect(
        Array.from(document.querySelectorAll("[data-ft-step]")).map((element) =>
          element.getAttribute("data-ft-step"),
        ),
      ).toEqual([IDENTITY, WITHHOLDING, REVIEW]);
    });

    it("shows him what he is putting in force, as the server read it back", async () => {
      await openCertification();

      // The stage's OWN review, not the interview's copy above it: what he is shown at the moment of
      // signing must be what the server will actually record.
      const panel = document.querySelector("[data-ft-certify-review]");
      expect(panel).not.toBeNull();
      expect(
        panel?.querySelector('[data-ft-certify-line="filingStatus"]')?.textContent,
      ).toContain("Married and filing together with my spouse");
      expect(
        panel?.querySelector('[data-ft-certify-line="additionalWithholdingAmount"]')
          ?.textContent,
      ).toContain("$50.00");
    });

    /* ------------------------------------------- the two kinds of words (OR-3) */

    it("renders the authoritative certification verbatim, as the server supplied it", async () => {
      await openCertification();

      const authoritative = document.querySelector(
        "[data-ft-authoritative-certification]",
      );
      expect(authoritative).not.toBeNull();
      expect(authoritative?.textContent).toContain(CERTIFICATION_STATEMENT);
      // The version the wording is in force at is shown, because he is signing a version of it.
      expect(
        document.querySelector(`[data-presented-revision="${CERTIFICATION_REVISION}"]`),
      ).not.toBeNull();
    });

    it("keeps Jarvis wording outside the certification, and the certification outside Jarvis wording", async () => {
      await openCertification();

      const authoritative = document.querySelector(
        "[data-ft-authoritative-certification]",
      );
      const explanation = document.querySelector("[data-ft-certify-guidance]");
      expect(explanation).not.toBeNull();

      // NEITHER CONTAINS THE OTHER. What he certifies under penalty of perjury is the governed body
      // and nothing this module wrote, and the explanation does not restate the certification as
      // though it were ours.
      for (const paragraph of CERTIFICATION_GUIDANCE) {
        expect(explanation?.textContent).toContain(paragraph);
        expect(authoritative?.textContent).not.toContain(paragraph);
      }
      expect(explanation?.textContent).not.toContain(CERTIFICATION_STATEMENT);

      // And they are separate elements rather than one block that merely reads as two.
      expect(explanation?.contains(authoritative as Node)).toBe(false);
      expect(authoritative?.contains(explanation as Node)).toBe(false);

      // The worker is told whose words are whose, in words.
      expect(
        document.querySelector("[data-ft-authoritative-notice]")?.textContent,
      ).toMatch(/federal government’s own|federal government's own/);
    });

    /* --------------------------------------------- the shared execution engine */

    it("signs on the DELIVERED shared capture surface, and builds none of its own", async () => {
      await openCertification();

      // The pad, the clear control and the submit control are the delivered surface's, identified by
      // the delivered surface's own attributes. This capsule contributes no canvas of its own.
      expect(
        document.querySelector('[data-capture-pad="ELECTRONIC_SIGNATURE"]'),
      ).not.toBeNull();
      expect(document.querySelector("[data-capture-clear]")).not.toBeNull();
      expect(
        document.querySelector(`[data-subject-key="${CERTIFICATION_SUBJECT_KEY}"]`),
      ).not.toBeNull();
      expect(
        document
          .querySelector("[data-required-form]")
          ?.getAttribute("data-required-form"),
      ).toBe("ELECTRONIC_SIGNATURE");
    });

    /* ------------------------------------------------------- the act succeeds */

    it("submits the act through the governed module route, with the exact content he was shown", async () => {
      await openCertification();
      await draw(line(6));
      fireEvent.click(signButton());

      await waitFor(() => expect(certifications).toHaveLength(1));
      const sent = certifications[0];

      // THE ROUND TRIP, UNCHANGED. The three identifiers are the ones the stage delivered, not
      // refreshed ones - a refreshed hash would submit a claim about a display that never happened.
      expect(sent.presented).toEqual({
        revision: CERTIFICATION_REVISION,
        contentHash: CERTIFICATION_HASH,
        ruleRevision: CERTIFICATION_RULE_REVISION,
      });
      // The SUBJECT's own required act, copied rather than chosen.
      expect(sent.performedForm).toBe("ELECTRONIC_SIGNATURE");
      expect(sent.capture?.strokes.length).toBeGreaterThan(0);

      // It went to THIS MODULE's governed route, which owns the whole ordered sequence. Reaching the
      // delivered execution route directly would execute with no election to execute against.
      expect(vi.mocked(certifyOwnFederalTaxElection)).toHaveBeenCalledTimes(1);
    });

    it("carries no election content, no identity and no moment in the payload", async () => {
      await openCertification();
      await draw(line(6));
      fireEvent.click(signButton());
      await waitFor(() => expect(certifications).toHaveLength(1));

      // What is ELECTED is read server-side from the answers it already holds. A client that could
      // restate the election here could certify one thing while having shown him another.
      expect(Object.keys(certifications[0]).sort()).toEqual(
        [
          "capture",
          "expectsNoLiabilityForApplicableYear",
          "hadNoLiabilityForPriorYear",
          "performedForm",
          "presented",
        ].sort(),
      );
    });

    it("shows the completed state from the SERVER's answer, never from an optimistic guess", async () => {
      await openExecutedElection();

      expect(document.querySelector("[data-ft-executed]")).not.toBeNull();
      expect(screen.getByText(/Your choices are in force/i)).toBeTruthy();
      // The signing control is gone because the server said an election governs him, not because
      // this component remembered pressing a button.
      expect(document.querySelector("[data-capture-pad]")).toBeNull();
    });

    it("never claims completion itself, however it ends", async () => {
      await openExecutedElection();

      // Completion is DERIVED server-side from this module's own validator once the election, the
      // execution record and the retained artifact all exist. A browser claiming it would be a
      // second completion authority disagreeing with the first.
      expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
    });

    /* --------------------------------------------- the generated artifact */

    it("offers his own copy through the DELIVERED document surface, by identity", async () => {
      await openExecutedElection();

      expect(document.querySelector("[data-ft-artifact]")).not.toBeNull();
      fireEvent.click(
        document.querySelector("[data-ft-artifact-view]") as HTMLElement,
      );

      await waitFor(() =>
        expect(vi.mocked(getOnboardingDocumentDownload)).toHaveBeenCalledWith(
          INVOCATION_ID,
          ARTIFACT_DOCUMENT_ID,
        ),
      );
      // The URL is fetched at the moment of viewing and never rendered into the page, so a link
      // cannot outlive its short expiry.
      expect(capsule().innerHTML).not.toContain(ARTIFACT_URL);
      expect(vi.mocked(window.open)).toHaveBeenCalledWith(
        ARTIFACT_URL,
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("says the copy is being prepared rather than offering a control for nothing", async () => {
      await openCertification();
      await draw(line(6));
      fireEvent.click(signButton());
      await waitFor(() => expect(certifications).toHaveLength(1));

      // A retained artifact the server has not yet named cannot be opened, and a View control beside
      // nothing would be worse than saying so.
      executed = { ...(executed as FederalTaxExecutedElection), artifactDocumentId: null };
      vi.mocked(getOwnFederalTaxCertification).mockImplementation(async () =>
        projectCertification(),
      );
      cleanup();
      openStep(REVIEW);

      await waitFor(() =>
        expect(document.querySelector("[data-ft-artifact-pending]")).not.toBeNull(),
      );
      expect(document.querySelector("[data-ft-artifact-view]")).toBeNull();
    });

    /* ------------------------------------------- the exemption affirmations */

    it("withholds the signing control until BOTH governed conditions are affirmed", async () => {
      await openCertification(reviewedExempt());

      expect(document.querySelector("[data-ft-exemption-conditions]")).not.toBeNull();
      // Neither is ever pre-ticked, and neither is inferred from the exemption election it is about.
      const first = document.querySelector('[data-ft-affirm="0"]') as HTMLElement;
      const second = document.querySelector('[data-ft-affirm="1"]') as HTMLElement;
      expect(isChecked(first)).toBe(false);
      expect(isChecked(second)).toBe(false);
      expect(document.querySelector("[data-ft-exemption-gate]")).not.toBeNull();
      expect(document.querySelector("[data-capture-pad]")).toBeNull();

      // ONE is not enough, in either direction.
      fireEvent.click(first);
      expect(document.querySelector("[data-capture-pad]")).toBeNull();
      fireEvent.click(first);
      fireEvent.click(second);
      expect(document.querySelector("[data-capture-pad]")).toBeNull();

      fireEvent.click(first);
      await waitFor(() =>
        expect(document.querySelector("[data-capture-pad]")).not.toBeNull(),
      );
      expect(document.querySelector("[data-ft-exemption-gate]")).toBeNull();
    });

    it("sends both affirmations with the act when an exemption is claimed", async () => {
      await openCertification(reviewedExempt());
      fireEvent.click(document.querySelector('[data-ft-affirm="0"]') as HTMLElement);
      fireEvent.click(document.querySelector('[data-ft-affirm="1"]') as HTMLElement);
      await waitFor(() =>
        expect(document.querySelector("[data-capture-pad]")).not.toBeNull(),
      );

      await draw(line(6));
      fireEvent.click(signButton());
      await waitFor(() => expect(certifications).toHaveLength(1));

      expect(certifications[0].hadNoLiabilityForPriorYear).toBe(true);
      expect(certifications[0].expectsNoLiabilityForApplicableYear).toBe(true);
      await waitFor(() =>
        expect(document.querySelector("[data-ft-executed-exemption]")).not.toBeNull(),
      );
    });

    it("affirms neither condition for a worker who claimed no exemption", async () => {
      await openCertification();

      // The conditions are not shown to him at all, and false travels in both fields - the governed
      // rule runs in both directions and an affirmation about an exemption nobody claimed states
      // nothing.
      expect(document.querySelector("[data-ft-exemption-conditions]")).toBeNull();
      await draw(line(6));
      fireEvent.click(signButton());
      await waitFor(() => expect(certifications).toHaveLength(1));

      expect(certifications[0].hadNoLiabilityForPriorYear).toBe(false);
      expect(certifications[0].expectsNoLiabilityForApplicableYear).toBe(false);
    });

    it("explains the two conditions without deciding either of them for him", async () => {
      await openCertification(reviewedExempt());

      const block = document.querySelector("[data-ft-exemption-conditions]");
      // The conditions are the SERVER's wording, and each names its own year so an affirmation is
      // always about the year being certified.
      expect(block?.textContent).toContain(EXEMPTION_CONDITION_ONE);
      expect(block?.textContent).toContain(EXEMPTION_CONDITION_TWO);
      expect(block?.textContent).toContain(PRIOR_TAX_YEAR);
      expect(block?.textContent).toContain(APPLICABLE_TAX_YEAR);

      const words = (block?.textContent ?? "").toLowerCase();
      for (const advice of ["you should", "we recommend", "you qualify", "most people"]) {
        expect(words).not.toContain(advice);
      }
    });

    /* -------------------------------------------------- the act is refused */

    it("keeps his signature and invites another attempt when the failure is ours", async () => {
      await openCertification();
      vi.mocked(certifyOwnFederalTaxElection).mockRejectedValueOnce(
        refusal("ELECTION_BINDING_UNAVAILABLE"),
      );

      await draw(line(6));
      fireEvent.click(signButton());

      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-refusal="RETRYABLE"]'),
        ).not.toBeNull(),
      );
      // Nothing was put in force, and he is told so.
      expect(screen.getByText(/nothing has been put in force/i)).toBeTruthy();
      expect(document.querySelector("[data-ft-certify-state]")?.getAttribute(
        "data-ft-certify-state",
      )).toBe("READY");
      // His mark is still on the surface, because the server is willing to accept it next time.
      expect(
        document.querySelector("[data-capture-pad]")?.getAttribute("data-has-mark"),
      ).toBe("true");
    });

    it("discards a signature performed against wording that has since moved", async () => {
      await openCertification();
      // The wording moves underneath him between presentation and submission - the exact race the
      // round trip exists to catch.
      governedHash = "sha256:certification-2026-09-01";

      await draw(line(6));
      fireEvent.click(signButton());

      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-refusal="STALE"]'),
        ).not.toBeNull(),
      );
      expect(screen.getByText(/updated while you were reading it/i)).toBeTruthy();
      // Re-read, so he cannot sign twice against a stage the server has already moved past.
      await waitFor(() =>
        expect(
          document.querySelector(`[data-presented-revision="2026-09-01"]`),
        ).not.toBeNull(),
      );
    });

    it("refuses an unfinished interview at the server too, and records nothing", async () => {
      // The blockers are ADVISORY. Even reaching the act with an unfinished interview - which this
      // screen does not offer - is refused by the server before anything is written.
      await openCertification();
      stored = { ...stored, reviewConfirmed: false };

      await draw(line(6));
      fireEvent.click(signButton());

      await waitFor(() => expect(certifications).toHaveLength(1));
      expect(executed).toBeNull();
      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-refusal="GONE"]'),
        ).not.toBeNull(),
      );
    });

    it("says the choices are in force, and closes the path that put them there", async () => {
      await openExecutedElection();

      expect(
        document.querySelector('[data-ft-certify-state="EXECUTED"]'),
      ).not.toBeNull();
      // THE FIRST ELECTION IS OVER. The signing control that recorded it is gone, and the later
      // path is a DIFFERENT act reached deliberately rather than the same one left open.
      expect(
        screen.getByRole("heading", { name: /your choices are in force/i }),
      ).toBeTruthy();
      expect(document.querySelector("[data-ft-change-request]")).not.toBeNull();
      expect(document.querySelector("[data-capture-pad]")).toBeNull();
      expect(document.querySelector("[data-execution-submit]")).toBeNull();
    });

    it("does not put the amendment path in front of a worker who has just signed", async () => {
      await openExecutedElection();

      // WHAT HE NEEDS FIRST, AND ONLY THAT: he is told it is done, he is told when it applies
      // from, and his own retained copy is offered to him.
      expect(document.querySelector("[data-ft-executed]")).not.toBeNull();
      expect(document.querySelector("[data-ft-artifact-view]")).not.toBeNull();

      // AND THEN WHERE TO GO, which is his own packet. Signing was the last thing this module
      // asked of him, and his sections are where he sees what is still outstanding.
      const home = document.querySelector("[data-ft-return-to-packet]");
      expect(home?.getAttribute("href")).toBe(packetPath(INVOCATION_ID));

      // NOT the machinery for signing again. It is not removed - the control that opens it is
      // right there - but electing again is not what a worker who has just elected is doing.
      expect(document.querySelector("[data-ft-again]")).toBeNull();
      expect(document.querySelector("[data-ft-again-option]")).toBeNull();
      expect(document.querySelector("[data-ft-history]")).toBeNull();
    });

    it("presents the whole governed amendment experience the moment he asks for it", async () => {
      await openExecutedElection();

      fireEvent.click(
        document.querySelector("[data-ft-change-request]") as HTMLElement,
      );

      // UNCHANGED IN EVERY RESPECT: the two governed reasons in the server's words, his record,
      // and the same governed act behind them. Nothing about the capability was conditioned.
      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-again-option="CORRECTION"]'),
        ).not.toBeNull(),
      );
      expect(
        document.querySelector('[data-ft-again-option="SUBSEQUENT_ELECTION"]'),
      ).not.toBeNull();
      expect(document.querySelector('[data-ft-again-state="OPEN"]')).not.toBeNull();
    });

    /* --------------------------------------------------- security boundary */

    it("shows and sends no full identification number at any point", async () => {
      await openExecutedElection();
      fireEvent.click(
        document.querySelector("[data-ft-artifact-view]") as HTMLElement,
      );
      await waitFor(() =>
        expect(vi.mocked(getOnboardingDocumentDownload)).toHaveBeenCalled(),
      );

      expect(document.body.textContent ?? "").not.toContain(FULL_IDENTIFIER);
      expect(JSON.stringify(certifications)).not.toContain(FULL_IDENTIFIER);
      // No reveal control exists to ask for one either.
      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.textContent ?? "",
      );
      expect(controls.some((label) => /reveal|show.*number|full/i.test(label))).toBe(
        false,
      );
    });

    it("puts the mark nowhere but the one request", async () => {
      await openCertification();
      await draw(line(6));
      fireEvent.click(signButton());
      await waitFor(() => expect(certifications).toHaveLength(1));

      // The coordinates leave the delivered surface, go into one request, and are held nowhere a
      // rendered document, a data attribute or browser storage could keep them.
      const drawn = String(certifications[0].capture?.strokes[0]?.points[0]?.x ?? "");
      expect(drawn).not.toBe("");
      expect(capsule().innerHTML).not.toContain(`"x":${drawn}`);
      expect(JSON.stringify(localStorage)).not.toContain("strokes");
      expect(JSON.stringify(sessionStorage)).not.toContain("strokes");
      expect(saves.length).toBe(0);
    });

    it("offers no act at all once the packet has left his hands", async () => {
      stored = reviewed();
      resetFederalTaxAnswerStore();
      openStep(REVIEW, {
        status: "COMPLETE",
        restart: {
          posture: "CLOSED",
          createsNewVersion: false,
          destroysCapturedData: false,
          reason: "MODULE_COMPLETE",
        },
      });

      // THE DELIVERED RUNTIME REFUSES BEFORE THIS CAPSULE IS EVEN ASKED. A closed module is
      // presented read-only by the host, so the certification component is never mounted and there
      // is no signing control to reach - which is a stronger guarantee than a capsule that mounted
      // and then disabled itself, and it is the delivered behaviour rather than anything added here.
      expect(await screen.findByText(/shown for reference only/i)).toBeTruthy();
      expect(document.querySelector("[data-ft-certify]")).toBeNull();
      expect(document.querySelector("[data-capture-pad]")).toBeNull();
      expect(document.querySelector("[data-execution-submit]")).toBeNull();
      expect(vi.mocked(getOwnFederalTaxCertification)).not.toHaveBeenCalled();
      expect(vi.mocked(certifyOwnFederalTaxElection)).not.toHaveBeenCalled();
    });

    /* ------------------------------------------------- Gate 8B is preserved */

    it("leaves the interview, its branching and its Save exactly as they were", async () => {
      await openCertification();

      // The review he is certifying is still the interview's own, still correctable, and the Save
      // that got him here still saves answers and nothing else.
      expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull();
      expect(
        document
          .querySelector('[data-ft-review-change="filingStatus"]')
          ?.getAttribute("href"),
      ).toBe(modulePath(INVOCATION_ID, MODULE_SLUG, WITHHOLDING));
      expect(saveButton()).toBeTruthy();
      // An inapplicable question is still absent rather than shown disabled.
      expect(
        document.querySelector('[data-ft-review-line="dependentsCreditAmount"]'),
      ).not.toBeNull();

      // And the masked identity is still the only form of it anywhere.
      expect(document.body.textContent ?? "").not.toContain(FULL_IDENTIFIER);
    });

    /* ---------------------------------------------- electing again (Gate 8D) */

    describe("electing again", () => {
      /**
       * Reach the executed state and ASK to change what is in force.
       *
       * The asking is the only new thing in this whole describe. A worker who has just signed is
       * shown that he has signed; the governed later-election path is one deliberate control
       * away, and every claim below about that path is a claim about what he finds when he
       * takes it. Shadows the parent helper so no test here can accidentally assert on the
       * amendment machinery without a worker having asked for it.
       */
      async function requestChange() {
        const control = await waitFor(() => {
          const found = document.querySelector<HTMLElement>(
            "[data-ft-change-request]",
          );
          if (!found) throw new Error("nothing to ask with yet");
          return found;
        });
        fireEvent.click(control);
        await waitFor(() =>
          expect(document.querySelector("[data-ft-again]")).not.toBeNull(),
        );
      }

      async function openExecuted() {
        await openExecutedElection();
        await requestChange();
      }

      /** Choose one of the two governed reasons, by the origin the server named. */
      function chooseOrigin(origin: string) {
        fireEvent.click(
          document.querySelector(`[data-ft-again-option="${origin}"]`) as HTMLElement,
        );
      }

      function reasonField(): HTMLTextAreaElement {
        const element = document.querySelector<HTMLTextAreaElement>(
          "[data-ft-again-reason]",
        );
        if (!element) throw new Error("no reason field rendered");
        return element;
      }

      /** Sign whatever the later-election card is asking for. */
      async function signAgain() {
        await draw(line(6));
        fireEvent.click(signButton());
      }

      it("offers the two governed reasons in the server's words, and neither is chosen for him", async () => {
        await openExecuted();

        // BOTH SENTENCES ARE THE SERVER'S, verbatim, and the two say OPPOSITE things about the
        // earlier record - one that it was wrong, one that it was right for the time it applied.
        // That distinction is the affordance; a single "change my W-4" control would destroy it.
        expect(screen.getByText(LATER_ELECTION_OPTIONS[0].description)).toBeTruthy();
        expect(screen.getByText(LATER_ELECTION_OPTIONS[1].description)).toBeTruthy();
        // Neither is pre-selected: defaulting would decide on his behalf whether he had erred.
        for (const option of LATER_ELECTION_OPTIONS) {
          expect(
            isChecked(
              document.querySelector(
                `[data-ft-again-option="${option.origin}"]`,
              ) as HTMLElement,
            ),
          ).toBe(false);
        }
        // And nothing can be signed until he says which of the two he means.
        expect(document.querySelector("[data-ft-again-gate]")).not.toBeNull();
        expect(document.querySelector("[data-capture-pad]")).toBeNull();
      });

      it("asks a correction what was wrong, and withholds the act until he says", async () => {
        await openExecuted();
        chooseOrigin("CORRECTION");

        // The field exists BECAUSE the chosen option says a reason is required, and the signing
        // control is withheld rather than offered and then refused.
        expect(reasonField()).toBeTruthy();
        expect(document.querySelector("[data-ft-again-gate]")).not.toBeNull();
        expect(document.querySelector("[data-capture-pad]")).toBeNull();

        fireEvent.change(reasonField(), {
          target: { value: "I picked the wrong filing status." },
        });

        await waitFor(() =>
          expect(document.querySelector("[data-capture-pad]")).not.toBeNull(),
        );
        expect(document.querySelector("[data-ft-again-gate]")).toBeNull();
      });

      it("offers no reason field at all for a later election, and can be signed without one", async () => {
        await openExecuted();
        chooseOrigin("SUBSEQUENT_ELECTION");

        // THE ABSENCE IS THE POINT. There is nowhere on this screen to state an error against an
        // election that was correct, so a client defect cannot send one - and the server refuses
        // one anyway.
        expect(document.querySelector("[data-ft-again-reason]")).toBeNull();
        await waitFor(() =>
          expect(document.querySelector("[data-capture-pad]")).not.toBeNull(),
        );
      });

      it("clears a stated reason when he changes his mind about which of the two he means", async () => {
        await openExecuted();
        chooseOrigin("CORRECTION");
        fireEvent.change(reasonField(), { target: { value: "wrong amount" } });

        chooseOrigin("SUBSEQUENT_ELECTION");
        await signAgain();

        // A reason carried across the change would have put an admission of error onto an election
        // that states the opposite, and the server would have refused it.
        await waitFor(() => expect(laterElections).toHaveLength(1));
        expect(laterElections[0].origin).toBe("SUBSEQUENT_ELECTION");
        expect(laterElections[0].correctionReason).toBeNull();
        expect(executed?.correctionReason).toBeNull();
      });

      it("sends the correction through the later route, with the reason he stated", async () => {
        await openExecuted();
        chooseOrigin("CORRECTION");
        fireEvent.change(reasonField(), {
          target: { value: "I picked the wrong filing status." },
        });
        await signAgain();

        await waitFor(() => expect(laterElections).toHaveLength(1));
        // THE INITIAL ROUTE WAS NOT REUSED. One call put the first election in force; the later one
        // travelled a different function, and the origin is the option's own value rather than
        // anything inferred from a control or from a reason having been typed.
        expect(vi.mocked(certifyOwnFederalTaxElection)).toHaveBeenCalledTimes(1);
        expect(laterElections[0].origin).toBe("CORRECTION");
        expect(laterElections[0].correctionReason).toBe(
          "I picked the wrong filing status.",
        );
        // The round trip is the delivered subject's own three values, exactly as on a first election.
        expect(laterElections[0].presented.contentHash).toBe(CERTIFICATION_HASH);
        expect(laterElections[0].presented.revision).toBe(CERTIFICATION_REVISION);
        expect(laterElections[0].performedForm).toBe("ELECTRONIC_SIGNATURE");
      });

      it("shows the new election in force and KEEPS the earlier one, described as what it was", async () => {
        await openExecuted();
        chooseOrigin("SUBSEQUENT_ELECTION");
        await signAgain();

        await waitFor(() =>
          expect(document.querySelector("[data-ft-history]")).not.toBeNull(),
        );

        // BOTH RECORDS ARE ON SCREEN. The earlier one is not hidden, not struck through, and not
        // relabelled by what came after it: its own origin, its own dates and its own copy.
        const first = document.querySelector('[data-ft-history-entry="1"]');
        const second = document.querySelector('[data-ft-history-entry="2"]');
        expect(first?.getAttribute("data-ft-history-current")).toBe("false");
        expect(first?.getAttribute("data-ft-history-origin")).toBe("INITIAL_ELECTION");
        expect(second?.getAttribute("data-ft-history-current")).toBe("true");
        expect(second?.getAttribute("data-ft-history-origin")).toBe(
          "SUBSEQUENT_ELECTION",
        );
        // AND IT IS NOT CALLED A MISTAKE. Nothing about a later election makes the earlier one wrong,
        // so no entry carries a stated error and none is described as having one.
        expect(first?.querySelector("[data-ft-history-reason]")).toBeNull();
        expect(first?.textContent ?? "").not.toMatch(/wrong|mistake|error/i);
      });

      it("says what he told us was wrong on the record that says so, and nowhere else", async () => {
        await openExecuted();
        chooseOrigin("CORRECTION");
        fireEvent.change(reasonField(), { target: { value: "wrong dependents amount" } });
        await signAgain();

        await waitFor(() =>
          expect(document.querySelector('[data-ft-history-entry="2"]')).not.toBeNull(),
        );
        const corrected = document.querySelector('[data-ft-history-entry="2"]');
        const superseded = document.querySelector('[data-ft-history-entry="1"]');
        // The reason belongs to the election that STATED it, not to the one it replaced.
        expect(corrected?.querySelector("[data-ft-history-reason]")?.textContent).toContain(
          "wrong dependents amount",
        );
        expect(superseded?.querySelector("[data-ft-history-reason]")).toBeNull();
      });

      it("offers each record its OWN retained copy, through the delivered document surface", async () => {
        await openExecuted();
        chooseOrigin("SUBSEQUENT_ELECTION");
        await signAgain();
        await waitFor(() =>
          expect(document.querySelector('[data-ft-history-view="1"]')).not.toBeNull(),
        );

        fireEvent.click(
          document.querySelector('[data-ft-history-view="1"]') as HTMLElement,
        );
        await waitFor(() =>
          expect(vi.mocked(getOnboardingDocumentDownload)).toHaveBeenCalledWith(
            INVOCATION_ID,
            ARTIFACT_DOCUMENT_ID,
          ),
        );

        // THE SUPERSEDED ELECTION'S OWN ARTIFACT, by identity, and a DIFFERENT one from the current
        // election's - the earlier copy was retained rather than regenerated over.
        fireEvent.click(
          document.querySelector('[data-ft-history-view="2"]') as HTMLElement,
        );
        await waitFor(() =>
          expect(vi.mocked(getOnboardingDocumentDownload)).toHaveBeenCalledWith(
            INVOCATION_ID,
            `${ARTIFACT_DOCUMENT_ID}-2`,
          ),
        );
        // No location is ever held here: the capsule passes an identity and nothing else.
        expect(capsule().innerHTML).not.toContain(ARTIFACT_URL);
      });

      it("can elect a third time, and the whole record is still there", async () => {
        await openExecuted();
        chooseOrigin("SUBSEQUENT_ELECTION");
        await signAgain();
        // WAIT ON THE SCREEN RATHER THAN ON THE FAKE. The act resolves before React has re-rendered
        // the panel it resets, and reaching for the next control on the strength of the store having
        // moved is how this reads a stale radio.
        await waitFor(() =>
          expect(document.querySelector('[data-ft-history-entry="2"]')).not.toBeNull(),
        );

        chooseOrigin("CORRECTION");
        await waitFor(() => expect(reasonField()).toBeTruthy());
        fireEvent.change(reasonField(), { target: { value: "still not right" } });
        await signAgain();

        await waitFor(() =>
          expect(document.querySelector('[data-ft-history-entry="3"]')).not.toBeNull(),
        );
        expect(executed?.setVersion).toBe(3);
        for (const version of [1, 2, 3]) {
          expect(
            document.querySelector(`[data-ft-history-entry="${version}"]`),
          ).not.toBeNull();
        }
        // APPEND-ONLY, AS THE SERVER KEEPS IT: three elections, three acts, three copies, and the
        // first one still says what it always said.
        expect(history).toHaveLength(3);
        expect(history.map((entry) => entry.electionOrigin)).toEqual([
          "CORRECTION",
          "SUBSEQUENT_ELECTION",
          "INITIAL_ELECTION",
        ]);
        expect(history[2].executedAt).toBe("2026-08-19T15:00:00.000Z");
        expect(history[2].artifactDocumentId).toBe(ARTIFACT_DOCUMENT_ID);
      });

      it("says nothing was put in force when the server refuses the later act", async () => {
        await openExecuted();
        vi.mocked(certifyOwnFederalTaxNewElection).mockRejectedValueOnce(
          refusal("CORRECTION_REASON_REQUIRED"),
        );

        chooseOrigin("CORRECTION");
        fireEvent.change(reasonField(), { target: { value: "  " } });
        // A whitespace-only reason opens the control on the client's own courtesy check only after
        // trimming, so state it explicitly and let the server be the one that refuses.
        fireEvent.change(reasonField(), { target: { value: "x" } });
        await signAgain();

        await waitFor(() =>
          expect(document.querySelector("[data-ft-again-refusal]")).not.toBeNull(),
        );
        // HIS EARLIER ELECTION IS UNTOUCHED, which is the assertion that matters: a refused later
        // election is not a partially applied one.
        expect(executed?.setVersion).toBe(1);
        expect(history).toHaveLength(1);
      });

      it("does not offer the path at all to a worker who has nothing in force", async () => {
        await openCertification();

        // THE MIRROR IMAGE OF THE STATE ABOVE, AND THE TWO ARE NEVER BOTH OPEN. He is being offered
        // his FIRST election, so there is nothing to correct and nothing to replace, and no part of
        // the later path is on screen to be attempted.
        expect(document.querySelector("[data-ft-again]")).toBeNull();
        expect(document.querySelector("[data-ft-again-option]")).toBeNull();
        expect(document.querySelector("[data-ft-again-reason]")).toBeNull();
        expect(vi.mocked(certifyOwnFederalTaxNewElection)).not.toHaveBeenCalled();
      });

      it("says why electing again is closed, without listing reasons he may not use", async () => {
        // AN ELECTION IN FORCE AND AN INTERVIEW THAT NO LONGER MATCHES THE GOVERNED QUESTIONS. The
        // certification stage is doctored directly because that combination is the server's answer
        // to read, and the point being proven is what the screen does with it.
        await openExecutedElection();
        const stage = projectCertification();
        vi.mocked(getOwnFederalTaxCertification).mockResolvedValue({
          ...stage,
          newElection: {
            ...stage.newElection,
            available: false,
            blockers: ["QUESTION_SET_SUPERSEDED"],
            options: [],
          },
        });
        cleanup();
        openStep(REVIEW);
        await requestChange();

        await waitFor(() =>
          expect(
            document.querySelector('[data-ft-again-state="BLOCKED"]'),
          ).not.toBeNull(),
        );
        // STATED RATHER THAN HIDDEN, and the two reasons are NOT listed beneath it: offering him a
        // choice under a sentence saying he may use neither would invite a refusal.
        expect(
          document.querySelector('[data-ft-again-blocker="QUESTION_SET_SUPERSEDED"]'),
        ).not.toBeNull();
        expect(document.querySelector("[data-ft-again-option]")).toBeNull();
        expect(document.querySelector("[data-ft-again-reason]")).toBeNull();
        // And no code is shown to him as one.
        expect(document.body.textContent ?? "").not.toContain("QUESTION_SET_SUPERSEDED");
      });

      it("shows no history to a worker with one election, and no earlier record to open", async () => {
        await openExecuted();

        // ONE ELECTION IS NOT A HISTORY. Repeating his only record under a heading about earlier
        // ones would invent a past he does not have.
        expect(document.querySelector("[data-ft-history]")).toBeNull();
      });

      it("shows the record but offers no later act once the packet has left his hands", async () => {
        await openExecuted();
        chooseOrigin("SUBSEQUENT_ELECTION");
        await signAgain();
        await waitFor(() =>
          expect(document.querySelector('[data-ft-history-entry="2"]')).not.toBeNull(),
        );
        cleanup();

        stored = reviewed();
        resetFederalTaxAnswerStore();
        openStep(REVIEW, {
          status: "COMPLETE",
          restart: {
            posture: "CLOSED",
            createsNewVersion: false,
            destroysCapturedData: false,
            reason: "MODULE_COMPLETE",
          },
        });

        // The delivered runtime presents a closed module read-only, so nothing in this capsule is
        // mounted to act with - a stronger guarantee than a later-election panel that mounted and
        // then disabled itself. NOTHING HERE OPENS A SECOND WAY IN.
        expect(await screen.findByText(/shown for reference only/i)).toBeTruthy();
        expect(document.querySelector("[data-ft-again]")).toBeNull();
        expect(document.querySelector("[data-capture-pad]")).toBeNull();
        expect(vi.mocked(certifyOwnFederalTaxNewElection)).toHaveBeenCalledTimes(1);
      });

      it("builds no self-service, no access link and no second way in", async () => {
        await openExecuted();
        chooseOrigin("SUBSEQUENT_ELECTION");
        await signAgain();
        await waitFor(() =>
          expect(document.querySelector('[data-ft-history-entry="2"]')).not.toBeNull(),
        );

        // The deferred architecture is absent as VOCABULARY as well as behaviour: no code here
        // offers a worker a route to this from outside the bound onboarding runtime.
        const rendered = capsule().innerHTML;
        for (const deferred of [
          /self.?service/i,
          /access link/i,
          /one.?time code/i,
          /sign in again/i,
          /portal/i,
          /after you (have )?left/i,
        ]) {
          expect(deferred.test(rendered)).toBe(false);
        }
        // And every link out of the capsule is still somewhere inside the DELIVERED runtime, at a
        // URL the delivered helpers built: one of this module's own steps, or his own packet. Both
        // are behind the same bound session he is already in, and neither is assembled here.
        const inside = [
          packetPath(INVOCATION_ID),
          ...[IDENTITY, WITHHOLDING, REVIEW].map((step) =>
            modulePath(INVOCATION_ID, MODULE_SLUG, step),
          ),
        ];
        const links = Array.from(capsule().querySelectorAll("a")).map((anchor) =>
          anchor.getAttribute("href"),
        );
        expect(links.length).toBeGreaterThan(0);
        for (const href of links) {
          expect(inside).toContain(href);
        }
      });
    });

    it("re-reads the stage when the interview changes rather than remembering availability", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
      });
      resetFederalTaxAnswerStore();
      openStep(REVIEW);
      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-state="BLOCKED"]'),
        ).not.toBeNull(),
      );

      // He confirms his review and saves. The act must become available WITHOUT a page reload,
      // because availability is the server's answer about answers this component does not own.
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(
          document.querySelector('[data-ft-certify-state="READY"]'),
        ).not.toBeNull(),
      );
    });
  });
});
