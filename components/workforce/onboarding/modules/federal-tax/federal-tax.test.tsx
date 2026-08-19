/**
 * Module 4.2 Federal Tax - the guided worker interview, as the worker meets it.
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
 *  - Nothing here executes, signs, certifies, submits or completes anything.
 *
 * THE FAKE SERVER BELOW APPLIES THE GOVERNED RULES rather than echoing the request, because the
 * behaviours that matter are exactly the ones a naive echo would hide: normalization erasing what a
 * branch no longer collects, and a Save opening questions the worker had not been asked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import type {
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
  };
});

const { getOnboardingRuntime, getRuntimeModuleDraft, saveRuntimeModuleDraft, modulePath } =
  await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const { getOwnFederalTaxInterview, saveOwnFederalTaxInterview } = await import(
  "@/lib/workforce/federalTaxApi"
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

  describe("nothing here executes or completes anything", () => {
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

      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(saveButton());

      // Every applicable question answered and the review confirmed - and the module is STILL not
      // complete, because completing it needs an executed election that this gate cannot produce.
      await waitFor(() => expect(stored.reviewConfirmed).toBe(true));
      expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
    });

    it("offers no signature, no submission and no certification control", async () => {
      stored = normalize({
        ...emptyAnswers(),
        identityConfirmed: true,
        filingStatus: "HEAD_OF_HOUSEHOLD",
        exemptionElected: true,
        reviewConfirmed: true,
      });
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector('[data-ft-review="SHOWN"]')).not.toBeNull(),
      );

      // Scoped to the MODULE's own section: the surrounding runtime frame carries navigation of its
      // own, and reading that as the module's would prove nothing about what this capsule offers.
      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.textContent ?? "",
      );
      expect(controls).toEqual(["Save"]);
      for (const forbidden of [/sign/i, /submit/i, /certif/i, /finish/i, /complete/i]) {
        expect(controls.some((label) => forbidden.test(label))).toBe(false);
      }
      expect(capsule().querySelector("canvas")).toBeNull();
    });

    it("tells him his choices are not yet in force", async () => {
      openStep(REVIEW);
      await waitFor(() =>
        expect(document.querySelector("[data-ft-not-yet-in-force]")).not.toBeNull(),
      );
      expect(screen.getByText(/does not\s+yet put them in force/i)).toBeTruthy();
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
});
