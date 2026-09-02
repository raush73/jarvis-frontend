/**
 * Module 4.1 Employment Eligibility - the worker experience.
 *
 * What this suite is answerable for:
 *
 *  - The module reaches the worker through the DELIVERED runtime, by registration, at the canonical
 *    URL, across the three steps it declared. Nothing renders a second onboarding application.
 *  - The identity question is asked about the worker's OWN canonical name, and answering it either
 *    way records an answer rather than correcting identity.
 *  - The governed categories, and the end date exactly where the governance carries one.
 *  - Both governed document combinations, with every field decided by the CATALOGUE - including the
 *    one acceptable document that captures no number, which is asked for no number, asked no
 *    question about its acceptability, and submitted without one.
 *  - An upload is not evidence. Only a CONFIRMED capture binds, and the version carrying it is
 *    saved at once.
 *  - A changed document that this session cannot re-bind is asked for a fresh picture rather than
 *    silently losing the evidence on the record.
 *  - The signature is the delivered execution surface, performed against the SERVER's own content
 *    identity, with nothing about the governed record generated here.
 *  - A worker who changes his record afterwards is asked to sign again, because the server says the
 *    act is outstanding again.
 *  - The terminal state says his part is done and claims nothing else. The module is never
 *    completed from here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import type {
  EmploymentEligibilityCatalogueEntry,
  EmploymentEligibilityDocument,
  EmploymentEligibilityRecord,
  EmploymentEligibilityState,
  SaveEmploymentEligibilityInput,
} from "@/lib/workforce/employmentEligibilityApi";
import type {
  OnboardingExecution,
  OnboardingExecutionSubject,
} from "@/lib/workforce/onboardingExecutionApi";

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
  };
});

vi.mock("@/lib/workforce/onboardingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/onboardingApi")>();
  return { ...actual, completeOnboardingModule: vi.fn() };
});

vi.mock("@/lib/workforce/employmentEligibilityApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/employmentEligibilityApi")>();
  return {
    ...actual,
    getOwnEmploymentEligibility: vi.fn(),
    saveOwnEmploymentEligibility: vi.fn(),
  };
});

vi.mock("@/lib/workforce/workerPortalApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/workerPortalApi")>();
  return { ...actual, getWorkerPortalIdentity: vi.fn() };
});

vi.mock("@/lib/workforce/onboardingDocumentApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingDocumentApi")>();
  return {
    ...actual,
    getOnboardingDocumentSlots: vi.fn(),
    createOnboardingUploadTarget: vi.fn(),
    uploadToStorage: vi.fn(),
    confirmOnboardingDocument: vi.fn(),
    removeOnboardingDocument: vi.fn(),
  };
});

vi.mock("@/lib/workforce/onboardingExecutionApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingExecutionApi")>();
  return {
    ...actual,
    getOnboardingExecutionSubjects: vi.fn(),
    submitOnboardingExecution: vi.fn(),
  };
});

const { getOnboardingRuntime, getRuntimeModuleDraft, saveRuntimeModuleDraft, modulePath } =
  await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const { getOwnEmploymentEligibility, saveOwnEmploymentEligibility } = await import(
  "@/lib/workforce/employmentEligibilityApi"
);
const { getWorkerPortalIdentity } = await import("@/lib/workforce/workerPortalApi");
const {
  getOnboardingDocumentSlots,
  createOnboardingUploadTarget,
  uploadToStorage,
  confirmOnboardingDocument,
} = await import("@/lib/workforce/onboardingDocumentApi");
const { getOnboardingExecutionSubjects, submitOnboardingExecution } = await import(
  "@/lib/workforce/onboardingExecutionApi"
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
const { INVOCATION_ID, fixtureModule, fixturePacket, fixtureRuntime, step } = await import(
  "@/components/workforce/onboarding/runtime/runtimeTestFixtures"
);
const { resetEmploymentEligibilityDrafts } = await import(
  "./employmentEligibilityDraftStore"
);

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the worker layout imports it.
 * Nothing in this suite registers a renderer of its own, so what is exercised below is what ships.
 */
await import("./register.worker");

const MODULE_KEY = "EMPLOYMENT_ELIGIBILITY";
const MODULE_SLUG = "employment-eligibility";
const IDENTITY = "identity";
const WORK_AUTHORIZATION = "work-authorization";
const DOCUMENTS = "documents";
const CANDIDATE = "candidate-fixture-1";
const WORKER_NAME = "Dana Rivers";
const CATALOGUE_VERSION = "2026-08-13";

/* -------------------------------------------------------------------------- */
/*  Fixtures mirroring the certified worker contract                           */
/* -------------------------------------------------------------------------- */

const PASSPORT = "A United States passport or passport card";
const LICENCE = "A driver's license issued by a United States state or territory";
const BIRTH_CERTIFICATE = "A certified copy of a United States birth certificate";
const SOCIAL_SECURITY_CARD = "A Social Security Account Number card";

const CATALOGUE: EmploymentEligibilityCatalogueEntry[] = [
  {
    documentTypeKey: "US_PASSPORT",
    list: "LIST_A",
    prompt: PASSPORT,
    issuingAuthorityPrompt: "The United States Department of State",
    captures: ["documentNumber", "issuingAuthority", "expiresOn"],
    requires: ["documentNumber", "issuingAuthority"],
    examinationRules: [],
  },
  {
    documentTypeKey: "PERMANENT_RESIDENT_CARD",
    list: "LIST_A",
    prompt: "A Permanent Resident Card",
    issuingAuthorityPrompt: "The United States agency named on the card",
    captures: ["documentNumber", "issuingAuthority", "expiresOn"],
    requires: ["documentNumber", "issuingAuthority"],
    examinationRules: [],
  },
  {
    documentTypeKey: "STATE_DRIVERS_LICENSE",
    list: "LIST_B",
    prompt: LICENCE,
    issuingAuthorityPrompt: "The state or territory that issued it",
    captures: ["documentNumber", "issuingAuthority", "expiresOn"],
    requires: ["documentNumber", "issuingAuthority"],
    examinationRules: [],
  },
  {
    documentTypeKey: "US_BIRTH_CERTIFICATE",
    list: "LIST_C",
    prompt: BIRTH_CERTIFICATE,
    issuingAuthorityPrompt: "The state, county, or municipal authority that issued it",
    captures: ["documentNumber", "issuingAuthority"],
    requires: ["documentNumber", "issuingAuthority"],
    examinationRules: [],
  },
  {
    /**
     * THE ONE ENTRY THAT CAPTURES NO NUMBER, mirroring the catalogue exactly: the number printed on
     * this card is a Social Security Number, so the entry captures none - and it declares the rule
     * an authorized examiner must apply, which is not a question for the worker.
     */
    documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
    list: "LIST_C",
    prompt: SOCIAL_SECURITY_CARD,
    issuingAuthorityPrompt: "The Social Security Administration",
    captures: ["issuingAuthority"],
    requires: ["issuingAuthority"],
    examinationRules: ["RESTRICTIVE_LEGEND_PROHIBITED"],
  },
];

function listOf(documentTypeKey: string): EmploymentEligibilityDocument["list"] {
  return (
    CATALOGUE.find((entry) => entry.documentTypeKey === documentTypeKey)?.list ?? "LIST_A"
  );
}

function emptyRecord(): EmploymentEligibilityRecord {
  return {
    setVersion: null,
    effectiveFrom: null,
    status: null,
    workAuthorizationExpiresOn: null,
    identityConfirmed: false,
    workerPhaseState: null,
    catalogueVersion: null,
    documents: [],
  };
}

function fixtureState(
  overrides: Partial<EmploymentEligibilityState> = {},
): EmploymentEligibilityState {
  return {
    moduleKey: MODULE_KEY,
    moduleNumber: "4.1",
    record: emptyRecord(),
    offeredDocuments: CATALOGUE,
    catalogueVersion: CATALOGUE_VERSION,
    certificationBlocks: ["WORKER_PHASE_OUTSTANDING"],
    examinationRecorded: false,
    certificationRecorded: false,
    ...overrides,
  };
}

function recordedDocument(
  overrides: Partial<EmploymentEligibilityDocument> & { documentTypeKey: string },
): EmploymentEligibilityDocument {
  return {
    list: listOf(overrides.documentTypeKey),
    issuingAuthority: "United States Department of State",
    expiresOn: null,
    identifierLast4: null,
    evidenceCaptured: false,
    recordedAt: "2026-08-14T10:00:00.000Z",
    ...overrides,
  };
}

/** A recorded version, as the certified projection returns it. */
function recorded(
  overrides: Partial<EmploymentEligibilityRecord> = {},
): EmploymentEligibilityRecord {
  return {
    setVersion: 1,
    effectiveFrom: "2026-08-14T10:00:00.000Z",
    status: "US_CITIZEN",
    workAuthorizationExpiresOn: null,
    identityConfirmed: true,
    workerPhaseState: "RECORDED",
    catalogueVersion: CATALOGUE_VERSION,
    documents: [
      recordedDocument({
        documentTypeKey: "US_PASSPORT",
        identifierLast4: "4567",
        evidenceCaptured: true,
      }),
    ],
    ...overrides,
  };
}

function fixtureSlot(overrides: Record<string, unknown> = {}) {
  return {
    moduleKey: MODULE_KEY,
    slotKey: "EMPLOYMENT_AUTHORIZATION_EVIDENCE",
    title: "Your work permission documents",
    origin: "UPLOADED" as const,
    acceptedMimeTypes: ["image/jpeg", "image/png", "image/heic", "application/pdf"],
    maxBytes: 15 * 1024 * 1024,
    replaceable: true,
    current: null,
    history: [],
    ...overrides,
  };
}

const TARGET_ID = "onbdoc-reserved";
const CONFIRMED_ID = "onbdoc-confirmed";

function fixtureTarget() {
  return {
    onboardingDocumentId: TARGET_ID,
    moduleKey: MODULE_KEY,
    slotKey: "EMPLOYMENT_AUTHORIZATION_EVIDENCE",
    upload: {
      url: "https://storage.test/bucket/key?sig=put",
      method: "PUT" as const,
      headers: { "Content-Type": "image/jpeg" },
      expiresIn: 300,
    },
  };
}

/**
 * The CONFIRMED artifact, deliberately carrying a DIFFERENT identifier from the reservation.
 *
 * Nothing in production depends on the two differing - they do not in the real foundation - but a
 * fixture in which they differ is the only way to prove which of the two this module binds a
 * version to. It binds the confirmation.
 */
function fixtureConfirmed(overrides: Record<string, unknown> = {}) {
  return {
    onboardingDocumentId: CONFIRMED_ID,
    moduleKey: MODULE_KEY,
    slotKey: "EMPLOYMENT_AUTHORIZATION_EVIDENCE",
    origin: "UPLOADED" as const,
    fileName: "passport.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    capturedAt: "2026-08-14T10:05:00.000Z",
    supersededAt: null,
    supersedesId: null,
    generation: null,
    createdAt: "2026-08-14T10:04:00.000Z",
    ...overrides,
  };
}

function fixtureSubject(
  overrides: Partial<OnboardingExecutionSubject> = {},
): OnboardingExecutionSubject {
  return {
    moduleKey: MODULE_KEY,
    subjectKey: "WORKER_ATTESTATION",
    title: "Your attestation about working in the United States",
    requiredForm: "ELECTRONIC_SIGNATURE",
    content: {
      kind: "GOVERNED_TEXT",
      ref: "EMPLOYMENT_AUTHORIZATION_ATTESTATION",
      revision: CATALOGUE_VERSION,
      ruleRevision: "rules-2026-08-13",
      title: "Your attestation about working in the United States",
      contentHash: "hash-of-the-wording",
      lines: [
        {
          label:
            "I confirm that the information I have given about my permission to work in the United States is true and complete.",
          field: null,
        },
      ],
    },
    current: null,
    history: [],
    requiresExecution: true,
    ...overrides,
  };
}

function fixtureExecution(): OnboardingExecution {
  return {
    executionId: "exec-1",
    moduleKey: MODULE_KEY,
    subjectKey: "WORKER_ATTESTATION",
    executionForm: "ELECTRONIC_SIGNATURE",
    executedContent: {
      kind: "GOVERNED_TEXT",
      ref: "EMPLOYMENT_AUTHORIZATION_ATTESTATION",
      revision: CATALOGUE_VERSION,
      ruleRevision: "rules-2026-08-13",
      contentHash: "hash-of-the-wording",
    },
    evidenceKind: "NATIVE_CAPTURE",
    evidence: null,
    executedAt: "2026-08-14T10:10:00.000Z",
    supersededAt: null,
    supersedesId: null,
  };
}

/* -------------------------------------------------------------------------- */
/*  A server that behaves like the certified one                               */
/* -------------------------------------------------------------------------- */

let serverState: EmploymentEligibilityState;
let serverSubjects: OnboardingExecutionSubject[];

/**
 * What the certified server does with a saved version, modelled honestly.
 *
 * In particular the two behaviours the worker experience depends on: the protected number comes
 * back as a MASKED TAIL and never as itself, and a NEW effective record makes the worker's
 * attestation outstanding again even though the wording he signed has not changed.
 */
function applySave(version: SaveEmploymentEligibilityInput): EmploymentEligibilityState {
  const previous = serverSubjects[0]?.current ?? null;
  serverSubjects = [
    fixtureSubject({ current: previous, requiresExecution: true, history: [] }),
  ];
  return fixtureState({
    record: recorded({
      setVersion: (serverState.record.setVersion ?? 0) + 1,
      status: version.attestation.status,
      workAuthorizationExpiresOn:
        version.attestation.workAuthorizationExpiresOn ?? null,
      identityConfirmed: version.attestation.identityConfirmed,
      documents: version.documents.map((document) =>
        recordedDocument({
          documentTypeKey: document.documentTypeKey,
          issuingAuthority: document.issuingAuthority ?? "",
          expiresOn: document.expiresOn ?? null,
          identifierLast4: document.documentNumber
            ? document.documentNumber.slice(-4)
            : null,
          evidenceCaptured: Boolean(document.onboardingDocumentId),
        }),
      ),
    }),
  });
}

function eeModule(overrides: Record<string, unknown> = {}) {
  return fixtureModule({
    moduleKey: MODULE_KEY,
    moduleNumber: "4.1",
    title: "Employment Eligibility",
    moduleSlug: MODULE_SLUG,
    completionGranularity: "MODULE",
    producesGeneratedArtifact: true,
    steps: [
      step(IDENTITY, "Confirm who you are"),
      step(WORK_AUTHORIZATION, "Your permission to work in the United States"),
      step(DOCUMENTS, "The documents you will show us"),
    ],
    resumeStepSlug: IDENTITY,
    ...overrides,
  });
}

function openModule(stepSlug: string, overrides: Record<string, unknown> = {}) {
  vi.mocked(getOnboardingRuntime).mockResolvedValue(
    fixtureRuntime({ packets: [fixturePacket({ modules: [eeModule(overrides)] })] }),
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

/* ------------------------------------------------------------------ helpers */

function image(name = "passport.jpg", size = 2048): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Answer the identity question, then leave the step exactly as the worker would. */
async function answerIdentity(answer = "Yes, this is me.") {
  const view = openModule(IDENTITY);
  await screen.findByText(WORKER_NAME);
  fireEvent.click(screen.getByLabelText(answer));
  view.unmount();
}

async function answerWorkAuthorization(
  label = /I am a citizen of the United States/,
  endDate?: string,
) {
  const view = openModule(WORK_AUTHORIZATION);
  const choice = await screen.findByLabelText(label);
  fireEvent.click(choice);
  if (endDate) {
    fireEvent.change(screen.getByLabelText("The date your permission to work runs out"), {
      target: { value: endDate },
    });
  }
  view.unmount();
}

/** The screen for one document position. */
function documentPanel(list: "LIST_A" | "LIST_B" | "LIST_C") {
  const panel = document.querySelector<HTMLElement>(`[data-ee-document="${list}"]`);
  if (!panel) throw new Error(`no ${list} document panel is on screen`);
  return within(panel);
}

async function statePassport(number = "X1234567") {
  fireEvent.click(await screen.findByLabelText(/One document that covers both/));
  const panel = documentPanel("LIST_A");
  fireEvent.click(panel.getByLabelText(PASSPORT));
  fireEvent.change(panel.getByLabelText(/The number printed on it/), {
    target: { value: number },
  });
  fireEvent.change(panel.getByLabelText(/Who issued it/), {
    target: { value: "United States Department of State" },
  });
}

/** Take the one governed capture from selection through confirmation. */
async function capture(list: "LIST_A" | "LIST_B" | "LIST_C" = "LIST_A") {
  const panel = documentPanel(list);
  const input = panel.getByLabelText(/Take or choose a picture/);
  fireEvent.change(input, { target: { files: [image()] } });
  fireEvent.click(panel.getByRole("button", { name: "Upload" }));
  await waitFor(() => expect(vi.mocked(confirmOnboardingDocument)).toHaveBeenCalled());
}

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

/** Sign, the way the delivered capture surface is signed: with a pointer. */
async function sign() {
  const pad = document.querySelector<HTMLCanvasElement>("[data-capture-pad]");
  if (!pad) throw new Error("no capture surface rendered");
  pad.getBoundingClientRect = () => PAD_RECT;
  await act(async () => {
    fireEvent.pointerDown(pad, {
      pointerId: 1,
      pointerType: "touch",
      clientX: PAD_RECT.left + 10,
      clientY: PAD_RECT.top + 20,
    });
    for (let index = 1; index < 8; index += 1) {
      fireEvent.pointerMove(pad, {
        pointerId: 1,
        pointerType: "touch",
        clientX: PAD_RECT.left + 10 + index * 4,
        clientY: PAD_RECT.top + 20,
      });
    }
    fireEvent.pointerUp(pad, { pointerId: 1, pointerType: "touch" });
  });
  const submit = document.querySelector<HTMLButtonElement>("[data-execution-submit]");
  if (!submit) throw new Error("no submit control rendered");
  await act(async () => {
    fireEvent.click(submit);
  });
}

function savedVersions(): SaveEmploymentEligibilityInput[] {
  return vi
    .mocked(saveOwnEmploymentEligibility)
    .mock.calls.map(([, version]) => version as SaveEmploymentEligibilityInput);
}

/* -------------------------------------------------------------------------- */

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetEmploymentEligibilityDrafts();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: CANDIDATE,
  });

  serverState = fixtureState();
  serverSubjects = [fixtureSubject()];

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
  vi.mocked(getWorkerPortalIdentity).mockResolvedValue({
    candidateId: CANDIDATE,
    displayName: WORKER_NAME,
  });
  vi.mocked(getOwnEmploymentEligibility).mockImplementation(async () => serverState);
  vi.mocked(saveOwnEmploymentEligibility).mockImplementation(async (_i, version) => {
    serverState = applySave(version);
    return serverState;
  });
  vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([fixtureSlot()]);
  vi.mocked(createOnboardingUploadTarget).mockResolvedValue(fixtureTarget());
  vi.mocked(uploadToStorage).mockResolvedValue(undefined);
  vi.mocked(confirmOnboardingDocument).mockResolvedValue(fixtureConfirmed());
  vi.mocked(getOnboardingExecutionSubjects).mockImplementation(async () => serverSubjects);
  vi.mocked(submitOnboardingExecution).mockImplementation(async () => {
    serverSubjects = [
      fixtureSubject({ current: fixtureExecution(), requiresExecution: false }),
    ];
    return fixtureExecution();
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* -------------------------------------------------------------- registration */

describe("how the module reaches the worker", () => {
  it("is rendered by the delivered runtime because its capsule registered it", async () => {
    expect(resolveOnboardingModuleRenderer(MODULE_KEY)).toBeDefined();

    openModule(IDENTITY);

    expect(
      await screen.findByRole("heading", { name: "Employment Eligibility" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Confirm who you are" })).toBeTruthy();
    expect(document.querySelector("[data-unrendered-module]")).toBeNull();
  });

  it("lives at the canonical worker URL, for each declared step", () => {
    for (const slug of [IDENTITY, WORK_AUTHORIZATION, DOCUMENTS]) {
      expect(modulePath(INVOCATION_ID, MODULE_SLUG, slug)).toBe(
        `/workforce/onboarding/${INVOCATION_ID}/employment-eligibility/${slug}`,
      );
    }
  });

  it("reads the worker's own record from his own packet", async () => {
    openModule(IDENTITY);

    await waitFor(() =>
      expect(vi.mocked(getOwnEmploymentEligibility)).toHaveBeenCalledWith(INVOCATION_ID),
    );
  });
});

/* ------------------------------------------------------------------ identity */

describe("step one - is this you", () => {
  it("shows the worker's own canonical name, read from the certified projection", async () => {
    openModule(IDENTITY);

    expect(await screen.findByText(WORKER_NAME)).toBeTruthy();
    expect(vi.mocked(getWorkerPortalIdentity)).toHaveBeenCalled();
    expect(screen.getByText("Is this you?")).toBeTruthy();
  });

  it("shows no date of birth and no Social Security Number, and offers no field for either", async () => {
    openModule(IDENTITY);
    await screen.findByText(WORKER_NAME);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/social security/i);
    expect(text).not.toMatch(/date of birth/i);
    expect(screen.queryByLabelText(/date of birth/i)).toBeNull();
    // The only controls are the two answers to the one question.
    expect(document.querySelectorAll(".ee-step input")).toHaveLength(2);
  });

  it("records a positive confirmation as the worker's own governed answer", async () => {
    await answerIdentity();
    await answerWorkAuthorization();
    openModule(DOCUMENTS);
    await statePassport();
    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    expect(savedVersions()[0].attestation.identityConfirmed).toBe(true);
  });

  it("records a negative answer, and corrects no identity anywhere", async () => {
    await answerIdentity("This information is not correct.");
    const view = openModule(IDENTITY);
    await screen.findByText(WORKER_NAME);

    // The worker is told the truth: we keep his answer and a person will look at it.
    expect(
      screen.getByText(/MW4H will review your details with you/),
    ).toBeTruthy();
    expect(screen.getByText(/Nothing you enter here changes your personal information/)).toBeTruthy();
    // And there is nowhere to state a different name, in this step or anywhere in the module.
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /correct/i })).toBeNull();
    view.unmount();

    await answerWorkAuthorization();
    openModule(DOCUMENTS);
    await statePassport();
    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    const version = savedVersions()[0];
    expect(version.attestation.identityConfirmed).toBe(false);
    // The saved version states an ANSWER about canonical identity and nothing else about it.
    expect(Object.keys(version.attestation).sort()).toEqual([
      "identityConfirmed",
      "status",
      "workAuthorizationExpiresOn",
    ]);
  });

  it("reports a failed identity read rather than asking about a name it never showed", async () => {
    vi.mocked(getWorkerPortalIdentity).mockRejectedValue(
      new OnboardingApiError("Service unavailable", 503, null),
    );

    openModule(IDENTITY);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Is this you?")).toBeNull();
  });
});

/* -------------------------------------------------------- work authorization */

describe("step two - your permission to work", () => {
  it("offers exactly the four governed categories, in plain language", async () => {
    openModule(WORK_AUTHORIZATION);

    expect(
      await screen.findByLabelText(/I am a citizen of the United States/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/I am a noncitizen national/)).toBeTruthy();
    expect(screen.getByLabelText(/I am a lawful permanent resident/)).toBeTruthy();
    expect(screen.getByLabelText(/I am allowed to work in the United States until/)).toBeTruthy();
    expect(document.querySelectorAll('input[name="ee-status"]')).toHaveLength(4);
  });

  it("asks for an end date only for the category that carries one", async () => {
    openModule(WORK_AUTHORIZATION);
    fireEvent.click(await screen.findByLabelText(/I am a citizen of the United States/));

    expect(screen.queryByLabelText("The date your permission to work runs out")).toBeNull();

    fireEvent.click(screen.getByLabelText(/I am allowed to work in the United States until/));
    expect(screen.getByLabelText("The date your permission to work runs out")).toBeTruthy();

    // Changing back does not leave a date the governance refuses.
    fireEvent.click(screen.getByLabelText(/I am a citizen of the United States/));
    expect(screen.queryByLabelText("The date your permission to work runs out")).toBeNull();
  });

  it("keeps a version whose required end date is missing off the wire", async () => {
    await answerIdentity();
    await answerWorkAuthorization(/I am allowed to work in the United States until/);
    openModule(DOCUMENTS);
    await statePassport();

    // The whole version is inadmissible, so there is nothing to photograph yet either.
    expect(screen.queryByLabelText(/Take or choose a picture/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getByText("Tell us the date your permission to work runs out."),
      ).toBeTruthy(),
    );
    expect(vi.mocked(saveOwnEmploymentEligibility)).not.toHaveBeenCalled();
  });

  it("sends the end date the governance does carry", async () => {
    await answerIdentity();
    await answerWorkAuthorization(
      /I am allowed to work in the United States until/,
      "2027-09-30",
    );
    openModule(DOCUMENTS);
    await statePassport();
    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    expect(savedVersions()[0].attestation).toEqual({
      status: "AUTHORIZED_TO_WORK",
      identityConfirmed: true,
      workAuthorizationExpiresOn: "2027-09-30",
    });
  });
});

/* ----------------------------------------------------------------- documents */

describe("step three - the documents you are showing us", () => {
  beforeEach(async () => {
    await answerIdentity();
    await answerWorkAuthorization();
  });

  it("offers the two governed combinations and no third", async () => {
    openModule(DOCUMENTS);

    expect(await screen.findByLabelText(/One document that covers both/)).toBeTruthy();
    expect(screen.getByLabelText(/Two documents/)).toBeTruthy();
    expect(document.querySelectorAll('input[name="ee-path"]')).toHaveLength(2);
  });

  it("carries one document that covers both from choice to saved record", async () => {
    openModule(DOCUMENTS);
    await statePassport();
    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    expect(savedVersions()[0].documents).toEqual([
      {
        documentTypeKey: "US_PASSPORT",
        documentNumber: "X1234567",
        issuingAuthority: "United States Department of State",
        expiresOn: "",
        onboardingDocumentId: CONFIRMED_ID,
      },
    ]);
  });

  it("carries two documents - who you are, and that you may work", async () => {
    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByLabelText(/Two documents/));

    const identity = documentPanel("LIST_B");
    fireEvent.click(identity.getByLabelText(LICENCE));
    fireEvent.change(identity.getByLabelText(/The number printed on it/), {
      target: { value: "D-4411" },
    });
    fireEvent.change(identity.getByLabelText(/Who issued it/), {
      target: { value: "Oklahoma" },
    });

    const authorization = documentPanel("LIST_C");
    fireEvent.click(authorization.getByLabelText(BIRTH_CERTIFICATE));
    fireEvent.change(authorization.getByLabelText(/The number printed on it/), {
      target: { value: "BC-99" },
    });
    fireEvent.change(authorization.getByLabelText(/Who issued it/), {
      target: { value: "Tulsa County" },
    });

    await capture("LIST_B");
    await waitFor(() => expect(savedVersions().length).toBeGreaterThan(0));

    const first = savedVersions()[0].documents;
    expect(first.map((document) => document.documentTypeKey)).toEqual([
      "STATE_DRIVERS_LICENSE",
      "US_BIRTH_CERTIFICATE",
    ]);
    // Both are stated; only the one that was photographed carries a binding so far.
    expect(first[0].onboardingDocumentId).toBe(CONFIRMED_ID);
    expect(first[1].onboardingDocumentId).toBeNull();
  });

  it("will not save a combination the governed lists do not establish", async () => {
    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByLabelText(/Two documents/));

    const identity = documentPanel("LIST_B");
    fireEvent.click(identity.getByLabelText(LICENCE));
    fireEvent.change(identity.getByLabelText(/The number printed on it/), {
      target: { value: "D-4411" },
    });
    fireEvent.change(identity.getByLabelText(/Who issued it/), {
      target: { value: "Oklahoma" },
    });

    // Nothing chosen for the second position, so the pair is not a governed combination.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(document.querySelector('[data-ee-violations="true"]')).toBeTruthy(),
    );
    expect(vi.mocked(saveOwnEmploymentEligibility)).not.toHaveBeenCalled();
  });

  it("asks only what the catalogue says the chosen document captures", async () => {
    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByLabelText(/One document that covers both/));

    const panel = documentPanel("LIST_A");
    fireEvent.click(panel.getByLabelText(PASSPORT));
    expect(panel.getByLabelText(/The number printed on it/)).toBeTruthy();
    expect(panel.getByLabelText(/The date it runs out/)).toBeTruthy();

    fireEvent.click(await screen.findByLabelText(/Two documents/));
    const authorization = documentPanel("LIST_C");
    fireEvent.click(authorization.getByLabelText(BIRTH_CERTIFICATE));
    // The entry captures no expiry, so none is asked for.
    expect(authorization.getByLabelText(/The number printed on it/)).toBeTruthy();
    expect(authorization.queryByLabelText(/The date it runs out/)).toBeNull();
  });

  it("clears what belonged to a document the worker changed his mind about", async () => {
    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByLabelText(/Two documents/));

    const authorization = documentPanel("LIST_C");
    fireEvent.click(authorization.getByLabelText(BIRTH_CERTIFICATE));
    fireEvent.change(authorization.getByLabelText(/The number printed on it/), {
      target: { value: "BC-99" },
    });

    fireEvent.click(authorization.getByLabelText(SOCIAL_SECURITY_CARD));

    // The number belonged to the other document, and the card captures none at all.
    expect(
      documentPanel("LIST_C").queryByLabelText(/The number printed on it/),
    ).toBeNull();
  });
});

/* -------------------------------------------------- the Social Security card */

describe("the Social Security card", () => {
  beforeEach(async () => {
    await answerIdentity();
    await answerWorkAuthorization();
  });

  async function chooseTheCard() {
    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByLabelText(/Two documents/));

    const identity = documentPanel("LIST_B");
    fireEvent.click(identity.getByLabelText(LICENCE));
    fireEvent.change(identity.getByLabelText(/The number printed on it/), {
      target: { value: "D-4411" },
    });
    fireEvent.change(identity.getByLabelText(/Who issued it/), {
      target: { value: "Oklahoma" },
    });

    const authorization = documentPanel("LIST_C");
    fireEvent.click(authorization.getByLabelText(SOCIAL_SECURITY_CARD));
    fireEvent.change(authorization.getByLabelText(/Who issued it/), {
      target: { value: "Social Security Administration" },
    });
  }

  it("is offered to the worker like any other acceptable document", async () => {
    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByLabelText(/Two documents/));

    expect(documentPanel("LIST_C").getByLabelText(SOCIAL_SECURITY_CARD)).toBeTruthy();
  });

  it("asks for no number of any kind", async () => {
    await chooseTheCard();

    const fields = document.querySelector<HTMLElement>(
      '[data-ee-fields="SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD"]',
    );
    if (!fields) throw new Error("the card's own fields are not on screen");
    // Exactly one field, and it is not the number. The entry captures the issuing authority and
    // nothing else, so there is nowhere on this screen a Social Security Number could be typed.
    expect(fields.querySelectorAll("input")).toHaveLength(1);
    expect(within(fields).queryByLabelText(/The number printed on it/)).toBeNull();
    expect(within(fields).getByLabelText(/Who issued it/)).toBeTruthy();
    const text = document.querySelector('[data-ee-document="LIST_C"]')?.textContent ?? "";
    expect(text).not.toMatch(/social security number/i);
  });

  it("asks the worker nothing about whether the card is acceptable", async () => {
    await chooseTheCard();

    const panel = document.querySelector('[data-ee-document="LIST_C"]');
    const text = panel?.textContent ?? "";
    // No legend question, no restriction question, no acceptability question in any spelling.
    expect(text).not.toMatch(/restrict/i);
    expect(text).not.toMatch(/unrestricted/i);
    expect(text).not.toMatch(/legend/i);
    expect(text).not.toMatch(/acceptab/i);
    expect(panel?.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it("submits the card with no number, because the catalogue captures none", async () => {
    await chooseTheCard();
    await capture("LIST_B");

    await waitFor(() => expect(savedVersions().length).toBeGreaterThan(0));
    const card = savedVersions()[0].documents.find(
      (document) => document.documentTypeKey === "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
    );
    expect(card).toEqual({
      documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
      documentNumber: null,
      issuingAuthority: "Social Security Administration",
      expiresOn: null,
      onboardingDocumentId: null,
    });
    expect(JSON.stringify(savedVersions())).not.toMatch(/unrestrictedAffirmed/);
  });
});

/* ------------------------------------------------------------------ evidence */

describe("the picture of the document", () => {
  beforeEach(async () => {
    await answerIdentity();
    await answerWorkAuthorization();
  });

  it("goes to storage through the delivered foundation, never through this module", async () => {
    openModule(DOCUMENTS);
    await statePassport();
    await capture();

    expect(vi.mocked(createOnboardingUploadTarget)).toHaveBeenCalledWith(INVOCATION_ID, {
      moduleKey: MODULE_KEY,
      slotKey: "EMPLOYMENT_AUTHORIZATION_EVIDENCE",
      fileName: "passport.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
    });
    const [target] = vi.mocked(uploadToStorage).mock.calls[0];
    expect(target.upload.url).toContain("https://storage.test/");
  });

  it("treats an authorized upload as no evidence at all until it is confirmed", async () => {
    vi.mocked(confirmOnboardingDocument).mockRejectedValue(
      new OnboardingApiError("Storage did not answer", 503, null),
    );

    openModule(DOCUMENTS);
    await statePassport();
    const panel = documentPanel("LIST_A");
    fireEvent.change(panel.getByLabelText(/Take or choose a picture/), {
      target: { files: [image()] },
    });
    fireEvent.click(panel.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(screen.getByText("Your upload is not finished yet.")).toBeTruthy(),
    );
    // The bytes arrived. The version was NOT saved, because an unconfirmed object is not
    // evidence and there is no binding to put on one.
    expect(vi.mocked(uploadToStorage)).toHaveBeenCalled();
    expect(vi.mocked(saveOwnEmploymentEligibility)).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Finish upload" })).toBeTruthy();
  });

  it("binds the CONFIRMED artifact rather than the reservation, and saves at once", async () => {
    openModule(DOCUMENTS);
    await statePassport();
    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    // Nothing was pressed after the capture: the confirmation is what saved it.
    const [document_] = savedVersions()[0].documents;
    expect(document_.onboardingDocumentId).toBe(CONFIRMED_ID);
    expect(document_.onboardingDocumentId).not.toBe(TARGET_ID);
    expect(await screen.findByText(/We have your picture/)).toBeTruthy();
  });

  it("finishes a confirmation that failed once, without asking for the file again", async () => {
    vi.mocked(confirmOnboardingDocument)
      .mockRejectedValueOnce(new OnboardingApiError("Storage did not answer", 503, null))
      .mockResolvedValue(fixtureConfirmed());

    openModule(DOCUMENTS);
    await statePassport();
    const panel = documentPanel("LIST_A");
    fireEvent.change(panel.getByLabelText(/Take or choose a picture/), {
      target: { files: [image()] },
    });
    fireEvent.click(panel.getByRole("button", { name: "Upload" }));
    await screen.findByRole("button", { name: "Finish upload" });

    fireEvent.click(screen.getByRole("button", { name: "Finish upload" }));

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    expect(vi.mocked(createOnboardingUploadTarget)).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------ changing what was recorded */

describe("a worker changing a document he already gave us", () => {
  it("asks for a fresh picture, and takes nothing off his record until he gives one", async () => {
    // A worker returning in a NEW session: his record says evidence was captured, and no read
    // can tell this session WHICH artifact it was.
    serverState = fixtureState({ record: recorded() });
    resetEmploymentEligibilityDrafts();

    openModule(DOCUMENTS);
    fireEvent.click(await screen.findByRole("button", { name: "I need to change something" }));

    const panel = documentPanel("LIST_A");
    fireEvent.change(panel.getByLabelText(/The number printed on it/), {
      target: { value: "X9999999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(document.querySelector("[data-ee-recapture-blocked]")).toBeTruthy(),
    );
    // Nothing was saved, so nothing took his evidence off his record.
    expect(vi.mocked(saveOwnEmploymentEligibility)).not.toHaveBeenCalled();
    expect(document.querySelector("[data-ee-recapture-required]")).toBeTruthy();

    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    expect(savedVersions()[0].documents[0]).toEqual(
      expect.objectContaining({
        documentNumber: "X9999999",
        onboardingDocumentId: CONFIRMED_ID,
      }),
    );
  });
});

/* ------------------------------------------------------- recorded and masked */

describe("what the worker is shown back", () => {
  it("shows the masked tail of a protected number and never the number", async () => {
    serverState = fixtureState({ record: recorded() });

    openModule(DOCUMENTS);

    expect(await screen.findByText(/Number ending 4567/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("X1234567");
    expect(
      screen.getByText(/We only ever show you the last four characters/),
    ).toBeTruthy();
  });

  it("restores the recorded version on resume, from the server rather than the browser", async () => {
    serverState = fixtureState({
      record: recorded({
        status: "AUTHORIZED_TO_WORK",
        workAuthorizationExpiresOn: "2027-09-30",
      }),
    });

    openModule(DOCUMENTS);

    expect(await screen.findByText(PASSPORT)).toBeTruthy();
    expect(screen.getByText(/2027-09-30/)).toBeTruthy();
    expect(screen.getByText(/We have your picture of this document/)).toBeTruthy();
    // And the interview opens on the recorded answers when he chooses to change them.
    fireEvent.click(screen.getByRole("button", { name: "I need to change something" }));
    const panel = documentPanel("LIST_A");
    expect((panel.getByLabelText(PASSPORT) as HTMLInputElement).checked).toBe(true);
    expect(
      (panel.getByLabelText(/Who issued it/) as HTMLInputElement).value,
    ).toBe("United States Department of State");
  });

  it("shows no examination result and no certification result", async () => {
    serverState = fixtureState({ record: recorded() });

    openModule(DOCUMENTS);
    await screen.findByText(PASSPORT);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/approved/i);
    expect(text).not.toMatch(/certified/i);
    expect(text).not.toMatch(/examined/i);
    expect(text).not.toMatch(/verified/i);
  });
});

/* ----------------------------------------------------------------- signature */

describe("reading and signing", () => {
  /** A record whose worker-facing work is done except the signature. */
  function readyToSign() {
    serverState = fixtureState({
      record: recorded(),
      certificationBlocks: ["WORKER_ATTESTATION_OUTSTANDING"],
    });
  }

  it("is not offered before there is a saved record to sign about", async () => {
    openModule(DOCUMENTS);
    await screen.findByLabelText(/One document that covers both/);

    expect(screen.queryByText("Read this and sign it")).toBeNull();
    expect(document.querySelector("[data-capture-pad]")).toBeNull();
  });

  it("presents the review first, then the server's own wording", async () => {
    readyToSign();

    openModule(DOCUMENTS);

    expect(await screen.findByText("What we have from you")).toBeTruthy();
    expect(screen.getByText("Read this and sign it")).toBeTruthy();
    expect(
      screen.getByText(
        /I confirm that the information I have given about my permission to work/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(`Version ${CATALOGUE_VERSION}`)).toBeTruthy();
  });

  it("submits the act with the content identity the server supplied", async () => {
    readyToSign();
    openModule(DOCUMENTS);
    await screen.findByText("Read this and sign it");

    await sign();

    await waitFor(() =>
      expect(vi.mocked(submitOnboardingExecution)).toHaveBeenCalledTimes(1),
    );
    const [invocation, input] = vi.mocked(submitOnboardingExecution).mock.calls[0];
    expect(invocation).toBe(INVOCATION_ID);
    expect(input.moduleKey).toBe(MODULE_KEY);
    expect(input.subjectKey).toBe("WORKER_ATTESTATION");
    expect(input.performedForm).toBe("ELECTRONIC_SIGNATURE");
    expect(input.presented).toEqual({
      revision: CATALOGUE_VERSION,
      contentHash: "hash-of-the-wording",
      ruleRevision: "rules-2026-08-13",
    });
  });

  it("states nothing about which governed record the act answers for", async () => {
    readyToSign();
    openModule(DOCUMENTS);
    await screen.findByText("Read this and sign it");

    await sign();

    await waitFor(() => expect(vi.mocked(submitOnboardingExecution)).toHaveBeenCalled());
    const [, input] = vi.mocked(submitOnboardingExecution).mock.calls[0];
    expect(JSON.stringify(input)).not.toContain("governedRecordRef");
    expect(Object.keys(input).sort()).toEqual([
      "capture",
      "moduleKey",
      "performedForm",
      "presented",
      "subjectKey",
    ]);
  });

  it("says plainly what a refused act means, and keeps the worker where he is", async () => {
    readyToSign();
    vi.mocked(submitOnboardingExecution).mockRejectedValue(
      new OnboardingApiError("Stale", 409, "EXECUTION_CONTENT_STALE"),
    );

    openModule(DOCUMENTS);
    await screen.findByText("Read this and sign it");
    await sign();

    await waitFor(() =>
      expect(document.querySelector('[data-execution-refusal="STALE"]')).toBeTruthy(),
    );
    expect(
      screen.getByText(/This wording was updated while you were reading it/),
    ).toBeTruthy();
  });

  it("treats an act the server already holds as satisfied rather than as a failure", async () => {
    readyToSign();
    vi.mocked(submitOnboardingExecution).mockImplementation(async () => {
      serverSubjects = [
        fixtureSubject({ current: fixtureExecution(), requiresExecution: false }),
      ];
      throw new OnboardingApiError("Already recorded", 409, "EXECUTION_ALREADY_RECORDED");
    });

    openModule(DOCUMENTS);
    await screen.findByText("Read this and sign it");
    await sign();

    expect(
      await screen.findByText("Your part is complete. MW4H will review your documents."),
    ).toBeTruthy();
  });
});

/* ---------------------------------------------------------- terminal and D4 */

describe("when the worker's part is done", () => {
  async function completeTheWorkerPhase() {
    await answerIdentity();
    await answerWorkAuthorization();
    const view = openModule(DOCUMENTS);
    await statePassport();
    await capture();
    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    await screen.findByText("Read this and sign it");
    await sign();
    return view;
  }

  it("tells him his part is done, and claims nothing more than that", async () => {
    await completeTheWorkerPhase();

    expect(
      await screen.findByText("Your part is complete. MW4H will review your documents."),
    ).toBeTruthy();
    // What the MODULE says, rather than what the frame around it is called.
    const text = document.querySelector(".ee-module")?.textContent ?? "";
    expect(text).toMatch(/Someone at MW4H will look at what you sent/);
    // Not the section complete, not certified, not approved, not examined, not determined.
    expect(text).not.toMatch(/section is complete/i);
    expect(text).not.toMatch(/certified/i);
    expect(text).not.toMatch(/approved/i);
    expect(text).not.toMatch(/examined/i);
    expect(text).not.toMatch(/eligible/i);
    expect(text).not.toMatch(/determined/i);
  });

  it("never completes the module, however much of his own part he finishes", async () => {
    await completeTheWorkerPhase();
    await screen.findByText("Your part is complete. MW4H will review your documents.");

    expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
  });

  /**
   * RE-ENTRY IN A SESSION THAT CAPTURED NOTHING - which is every session but the one he
   * finished in, and always the one a later packet opens.
   *
   * The recorded projection says THAT evidence was captured and never WHICH artifact it was, so
   * a draft seeded from a read holds no binding and every document on the record answers
   * `needsFreshCapture`. That is the right answer for a save and no kind of answer for a worker:
   * his part is done, there is no Save on his screen, and a demand for a new picture beside
   * "we have your picture" is the surface contradicting itself about his own record.
   */
  it("asks a finished worker for nothing, in a session that captured nothing", async () => {
    serverState = fixtureState({ record: recorded() });
    serverSubjects = [
      fixtureSubject({ current: fixtureExecution(), requiresExecution: false }),
    ];
    resetEmploymentEligibilityDrafts();

    openModule(DOCUMENTS);

    expect(
      await screen.findByText("Your part is complete. MW4H will review your documents."),
    ).toBeTruthy();
    // What he has is still said, and said truthfully.
    expect(screen.getByText(/We have your picture of this document/)).toBeTruthy();
    // And nothing at all about saving, on a screen he cannot save from.
    expect(document.querySelector("[data-ee-recapture-blocked]")).toBeNull();
    expect(screen.queryByText("Check the following before saving.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("asks him to sign again when he changes the record he signed about", async () => {
    await completeTheWorkerPhase();
    await screen.findByText("Your part is complete. MW4H will review your documents.");

    fireEvent.click(screen.getByRole("button", { name: "I need to change something" }));
    const panel = documentPanel("LIST_A");
    fireEvent.change(panel.getByLabelText(/The number printed on it/), {
      target: { value: "X7654321" },
    });
    await capture();
    await waitFor(() => expect(savedVersions()).toHaveLength(2));

    // The server made his attestation outstanding again for the new record, and the surface
    // presents it again because it READ that rather than deciding it.
    expect(await screen.findByText("Read this and sign it")).toBeTruthy();
    expect(document.querySelector("[data-reexecution-required]")).toBeTruthy();
    expect(
      screen.queryByText("Your part is complete. MW4H will review your documents."),
    ).toBeNull();

    await sign();

    expect(
      await screen.findByText("Your part is complete. MW4H will review your documents."),
    ).toBeTruthy();
    expect(vi.mocked(submitOnboardingExecution)).toHaveBeenCalledTimes(2);
  });
});

/* ----------------------------------------------------- saving, and not saving */

describe("explicit save", () => {
  beforeEach(async () => {
    await answerIdentity();
    await answerWorkAuthorization();
  });

  it("persists nothing at all while the worker answers", async () => {
    openModule(DOCUMENTS);
    await statePassport();
    // Well past the runtime's draft debounce, and past any timer this module could hold.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    expect(vi.mocked(saveOwnEmploymentEligibility)).not.toHaveBeenCalled();
    // Not through the shared draft either. The module declares no captured keys, and this is
    // what that promise means in practice.
    const draftWrites = vi
      .mocked(saveRuntimeModuleDraft)
      .mock.calls.filter(([, , data]) => JSON.stringify(data ?? {}) !== "{}");
    expect(draftWrites).toEqual([]);
  });

  it("keeps no governed answer in browser storage, under any key", async () => {
    openModule(DOCUMENTS);
    await statePassport();

    for (const store of [localStorage, sessionStorage]) {
      const serialized = JSON.stringify(store);
      expect(serialized).not.toContain("X1234567");
      expect(serialized).not.toContain("US_PASSPORT");
      expect(serialized).not.toContain("US_CITIZEN");
      expect(serialized).not.toContain(WORKER_NAME);
    }
  });

  it("says plainly that nothing is saved yet, and stops saying it once it is", async () => {
    openModule(DOCUMENTS);
    await statePassport();

    expect(document.querySelector('[data-ee-unsaved="true"]')).toBeTruthy();

    await capture();

    await waitFor(() => expect(savedVersions()).toHaveLength(1));
    expect(document.querySelector('[data-ee-unsaved="true"]')).toBeNull();
  });

  it("keeps every answer when the server refuses, and says what was refused", async () => {
    vi.mocked(saveOwnEmploymentEligibility).mockRejectedValue(
      new OnboardingApiError(
        "The employment eligibility version proposed is not admissible",
        400,
        "DOCUMENT_COMBINATION_INVALID",
      ),
    );

    openModule(DOCUMENTS);
    await statePassport();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        document.querySelector('[data-ee-refusal="DOCUMENT_COMBINATION_INVALID"]'),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText(
        /Show us either one document that covers both, or two documents/,
      ),
    ).toBeTruthy();
    // The code itself is a classification, not a message: it is never printed at the worker.
    expect(document.body.textContent).not.toContain("DOCUMENT_COMBINATION_INVALID");
    expect(
      (documentPanel("LIST_A").getByLabelText(/The number printed on it/) as HTMLInputElement)
        .value,
    ).toBe("X1234567");
    expect(document.querySelector('[data-ee-dirty="true"]')).toBeTruthy();
  });

  it("reports a failed read as a failure rather than as an empty interview", async () => {
    vi.mocked(getOwnEmploymentEligibility).mockRejectedValue(
      new OnboardingApiError("Service unavailable", 503, null),
    );

    openModule(DOCUMENTS);

    await waitFor(() =>
      expect(document.querySelector('[data-ee-state="ERROR"]')).toBeTruthy(),
    );
    expect(screen.queryByLabelText(/One document that covers both/)).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("re-reads the authoritative record after saving rather than trusting itself", async () => {
    openModule(DOCUMENTS);
    await statePassport();
    const readsBefore = vi.mocked(getOwnEmploymentEligibility).mock.calls.length;

    await capture();

    await waitFor(() =>
      expect(vi.mocked(getOwnEmploymentEligibility).mock.calls.length).toBeGreaterThan(
        readsBefore,
      ),
    );
  });
});

/* ---------------------------------------------------------------- navigation */

describe("moving through the three steps", () => {
  it("carries the worker forward and back with the runtime's own navigation", async () => {
    openModule(WORK_AUTHORIZATION);
    await screen.findByLabelText(/I am a citizen of the United States/);

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        modulePath(INVOCATION_ID, MODULE_SLUG, DOCUMENTS),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        modulePath(INVOCATION_ID, MODULE_SLUG, IDENTITY),
      ),
    );
  });

  it("keeps answers across a step change without persisting them", async () => {
    await answerIdentity();
    await answerWorkAuthorization();

    openModule(DOCUMENTS);
    await screen.findByLabelText(/One document that covers both/);

    // The answers from the first two steps are still what the module holds: it validates the
    // whole version and asks only for the documents.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByText("Tell us which documents you are showing us.")).toBeTruthy(),
    );
    expect(
      screen.queryByText("Is this you? has not been answered yet."),
    ).toBeNull();
    expect(vi.mocked(saveOwnEmploymentEligibility)).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------- accessibility */

describe("accessibility and small screens", () => {
  it("groups every choice in a fieldset with a legend", async () => {
    openModule(WORK_AUTHORIZATION);
    await screen.findByLabelText(/I am a citizen of the United States/);

    const fieldset = document.querySelector("fieldset");
    expect(fieldset).toBeTruthy();
    expect(fieldset?.querySelector("legend")?.textContent).toBe(
      "Your permission to work in the United States",
    );
  });

  it("associates each error with the control it belongs to, and announces it", async () => {
    await answerIdentity();
    await answerWorkAuthorization(/I am allowed to work in the United States until/);
    openModule(DOCUMENTS);
    await statePassport();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const summary = await waitFor(() => {
      const element = document.querySelector('[data-ee-violations="true"]');
      if (!element) throw new Error("no summary");
      return element as HTMLElement;
    });
    expect(summary.getAttribute("role")).toBe("alert");
    // Focus follows the refusal, so a worker on a phone is taken to the reason.
    expect(document.activeElement).toBe(summary);
  });

  it("describes a field's own error from the field itself", async () => {
    await answerIdentity();
    openModule(WORK_AUTHORIZATION);
    fireEvent.click(
      await screen.findByLabelText(/I am allowed to work in the United States until/),
    );
    const date = screen.getByLabelText("The date your permission to work runs out");

    expect(date.getAttribute("aria-describedby")).toContain("ee-end-date-hint");
  });

  it("uses the native file control, so a phone offers its camera", async () => {
    await answerIdentity();
    await answerWorkAuthorization();
    openModule(DOCUMENTS);
    await statePassport();

    const input = documentPanel("LIST_A").getByLabelText(
      /Take or choose a picture/,
    ) as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("file");
    // The accepted types are the SLOT's, so what a phone offers is what the server accepts.
    expect(input.getAttribute("accept")).toBe(
      "image/jpeg,image/png,image/heic,application/pdf",
    );
  });

  it("asks for nothing in a modal, at any point in the worker's part", async () => {
    await answerIdentity();
    await answerWorkAuthorization();
    openModule(DOCUMENTS);
    await statePassport();
    await capture();
    await screen.findByText("Read this and sign it");

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
