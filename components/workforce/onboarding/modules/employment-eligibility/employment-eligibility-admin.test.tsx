/**
 * Module 4.1 - the authorized MW4H review inside the Phase 2 workspace.
 *
 * What this suite is answerable for:
 *
 *  - The panel is a PANEL. It mounts inside the existing workspace because the capsule registered
 *    it, and it has no route, no shell, and no navigation entry of its own.
 *  - Authorization is by grant, and a missing grant means ABSENCE: nothing rendered and nothing
 *    requested, so the panel never invites a refusal or discloses that this worker has a record.
 *  - A protected document identifier is MASKED, and the whole value arrives only through a
 *    deliberate, purpose-stated disclosure that is offered exclusively to an operator holding the
 *    separate sensitive grant - never on the strength of an administrator role.
 *  - The reviewer, and nobody else, records the examination. The governed Social Security card rule
 *    is shown to HIM; the worker was never asked it and nothing here reads an image to decide it.
 *  - Certification readiness is the SERVER'S. The panel renders the blockers it was given and has
 *    no certify control at all: the affirmative act is the workspace's processing action, whose
 *    outcome the server derives.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type {
  EmploymentEligibilityStaffCertification,
  EmploymentEligibilityStaffReview,
} from "@/lib/workforce/employmentEligibilityApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/onboarding",
}));

vi.mock("@/lib/workforce/employmentEligibilityApi", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/workforce/employmentEligibilityApi")
    >();
  return {
    ...actual,
    getStaffEmploymentEligibility: vi.fn(),
    recordEmploymentEligibilityExamination: vi.fn(),
    revealEmploymentEligibilityIdentifier: vi.fn(),
  };
});

vi.mock("@/lib/workforce/onboardingAdminApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingAdminApi")>();
  return { ...actual, getOnboardingAdminDocumentDownload: vi.fn() };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const {
  getStaffEmploymentEligibility,
  recordEmploymentEligibilityExamination,
  revealEmploymentEligibilityIdentifier,
} = await import("@/lib/workforce/employmentEligibilityApi");
const { getOnboardingAdminDocumentDownload, OnboardingAdminApiError } =
  await import("@/lib/workforce/onboardingAdminApi");
const { OnboardingAdminReviewPanel } = await import(
  "@/components/workforce/admin/panels/ReviewPanel"
);
const { resolveOnboardingAdminPanel } = await import(
  "@/components/workforce/admin/adminPanelRegistry"
);
const { CANDIDATE_ID, fixtureModule, fixtureSession, fixtureWorker } =
  await import("@/components/workforce/admin/adminTestFixtures");

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the administrative layout
 * imports it. This suite registers no panel of its own.
 */
await import("./register.admin");

const { default: EmploymentEligibilityReviewPanel } = await import(
  "./EmploymentEligibilityReviewPanel"
);

const MODULE_KEY = "EMPLOYMENT_ELIGIBILITY";
const ACCESS = "workforce.onboarding.admin.access";
const WORKER_READ = "workforce.onboarding.admin.worker.read";
const DOCUMENT_READ = "workforce.onboarding.document.read";
const EXAMINE = "workforce.onboarding.employment-eligibility.examine";
const CERTIFY = "workforce.onboarding.employment-eligibility.certify";
const IDENTIFIER_REVEAL =
  "workforce.onboarding.employment-eligibility.identifier.reveal";

/** The six grants the authorized roles hold. */
const FULL_GRANTS = [
  ACCESS,
  WORKER_READ,
  DOCUMENT_READ,
  EXAMINE,
  CERTIFY,
  IDENTIFIER_REVEAL,
];

function review(
  overrides: Partial<EmploymentEligibilityStaffReview> = {},
): EmploymentEligibilityStaffReview {
  return {
    candidateId: CANDIDATE_ID,
    moduleKey: MODULE_KEY,
    moduleNumber: "4.1",
    packetId: "pkt_fixture_1",
    setVersion: 1,
    effectiveFrom: "2026-08-12T10:00:00.000Z",
    catalogueVersion: "2026-08-13",
    currentCatalogueVersion: "2026-08-13",
    status: "US_CITIZEN",
    workAuthorizationExpiresOn: null,
    workerPhaseState: "RECORDED",
    canonicalIdentityComplete: true,
    identityConfirmedByWorker: true,
    workerAttestationOutstanding: false,
    documents: [
      {
        documentRecordId: "eedoc_1",
        documentTypeKey: "US_PASSPORT",
        list: "LIST_A",
        prompt: "A United States passport or passport card",
        issuingAuthority: "United States Department of State",
        expiresOn: "2031-04-04",
        identifierLast4: "4567",
        hasProtectedIdentifier: true,
        onboardingDocumentId: "obdoc_ee_1",
        evidenceConfirmed: true,
        recordedAt: "2026-08-12T10:00:00.000Z",
        examinationRules: [],
        examinationOutcome: null,
      },
    ],
    timeliness: {
      state: "ESTABLISHED",
      firstDayOfEmployment: "2026-08-10",
      daysSinceFirstDay: 4,
    },
    certificationBlocks: ["EXAMINATION_OUTSTANDING"],
    certifiable: false,
    examination: null,
    examinationHistory: [],
    certification: null,
    certificationHistory: [],
    examinationMethods: [
      "REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE",
      "IN_PERSON_EXAMINATION",
    ],
    documentOutcomeVocabulary: ["ACCEPTED", "REJECTED"],
    ...overrides,
  };
}

/** The List B and Social Security card presentation, whose card carries the governed rule. */
function reviewWithCard(): EmploymentEligibilityStaffReview {
  return review({
    documents: [
      {
        documentRecordId: "eedoc_2",
        documentTypeKey: "STATE_DRIVERS_LICENSE",
        list: "LIST_B",
        prompt: "A driver's license issued by a United States state or territory",
        issuingAuthority: "Oklahoma",
        expiresOn: "2029-01-01",
        identifierLast4: "1111",
        hasProtectedIdentifier: true,
        onboardingDocumentId: "obdoc_ee_2",
        evidenceConfirmed: true,
        recordedAt: "2026-08-12T10:00:00.000Z",
        examinationRules: [],
        examinationOutcome: null,
      },
      {
        documentRecordId: "eedoc_3",
        documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
        list: "LIST_C",
        prompt: "A Social Security Account Number card",
        issuingAuthority: "The Social Security Administration",
        expiresOn: null,
        // NO NUMBER WAS EVER CAPTURED for this type, so there is nothing to mask and nothing to
        // reveal - which is how no Social Security Number exists in this module at all.
        identifierLast4: null,
        hasProtectedIdentifier: false,
        onboardingDocumentId: "obdoc_ee_3",
        evidenceConfirmed: true,
        recordedAt: "2026-08-12T10:00:00.000Z",
        examinationRules: ["RESTRICTIVE_LEGEND_PROHIBITED"],
        examinationOutcome: null,
      },
    ],
  });
}

function renderPanel() {
  return render(
    <EmploymentEligibilityReviewPanel
      worker={fixtureWorker()}
      packet={null}
      module={null}
      history={null}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue(fixtureSession(FULL_GRANTS));
  vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(review());
});

afterEach(() => {
  cleanup();
});

/* ----------------------------------------------------------- registration */

describe("registration", () => {
  it("registers a panel under the module key, so the workspace needs no list of modules", () => {
    expect(resolveOnboardingAdminPanel(MODULE_KEY)).toBeDefined();
  });

  it("mounts inside the delivered workspace review panel", async () => {
    render(
      <OnboardingAdminReviewPanel
        worker={fixtureWorker()}
        packet={null}
        module={fixtureModule({
          moduleKey: MODULE_KEY,
          moduleNumber: "4.1",
          title: "Employment Eligibility",
        })}
      />,
    );

    await waitFor(() =>
      expect(vi.mocked(getStaffEmploymentEligibility)).toHaveBeenCalledWith(
        CANDIDATE_ID,
      ),
    );
    expect(await screen.findByText("Employment eligibility")).toBeTruthy();
  });
});

/* ---------------------------------------------------------- authorization */

describe("authorization", () => {
  it("renders nothing and reads nothing without the examine grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, DOCUMENT_READ]));

    const { container } = renderPanel();

    expect(container.textContent).toBe("");
    await waitFor(() =>
      expect(vi.mocked(getStaffEmploymentEligibility)).not.toHaveBeenCalled(),
    );
  });

  it("reads this worker's record once the examine grant is held", async () => {
    renderPanel();

    await waitFor(() =>
      expect(vi.mocked(getStaffEmploymentEligibility)).toHaveBeenCalledWith(
        CANDIDATE_ID,
      ),
    );
  });

  it("surfaces a server refusal as a refusal, with its governed code", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
        message: "refused",
        details: null,
      }),
    );

    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("ADMIN_FUNCTION_NOT_AUTHORIZED");
  });
});

/* ------------------------------------------------------------ what it shows */

describe("what an authorized reviewer sees", () => {
  it("shows the recorded version, what the worker attested, and his signature state", async () => {
    renderPanel();

    await screen.findByText("Employment eligibility");
    expect(document.querySelector('[data-ee-set-version="1"]')).toBeTruthy();
    expect(screen.getByText("A citizen of the United States")).toBeTruthy();
    expect(screen.getByText("Signed")).toBeTruthy();
  });

  it("shows the derived first day of employment without inventing a deadline", async () => {
    renderPanel();

    await screen.findByText("Employment eligibility");
    expect(screen.getByText("2026-08-10")).toBeTruthy();
    expect(screen.getByText(/4 day\(s\) since his first day/)).toBeTruthy();
    // A count, and no verdict about it anywhere on screen.
    expect(document.body.textContent).not.toMatch(/overdue|late|deadline/i);
  });

  it("says plainly when the first day is not yet established", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        timeliness: {
          state: "NOT_ESTABLISHED",
          firstDayOfEmployment: null,
          daysSinceFirstDay: null,
        },
      }),
    );

    renderPanel();

    expect(
      await screen.findByText(/Not yet established/),
    ).toBeTruthy();
  });

  it("renders the SERVER'S certification blockers and offers no certify control", async () => {
    renderPanel();

    const blocks = await waitFor(() => {
      const node = document.querySelector('[data-ee-blocks="true"]');
      expect(node).toBeTruthy();
      return node!;
    });
    expect(blocks.getAttribute("role")).toBe("alert");
    expect(
      blocks.querySelector('[data-ee-block="EXAMINATION_OUTSTANDING"]'),
    ).toBeTruthy();

    // NO CERTIFY BUTTON. The affirmative act is the workspace's processing action, and its outcome
    // is derived by the server from governed state.
    for (const button of Array.from(document.querySelectorAll("button"))) {
      expect(button.textContent ?? "").not.toMatch(/certify/i);
    }
  });

  it("says nothing about a worker who has recorded nothing", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({ setVersion: null, documents: [] }),
    );

    renderPanel();

    expect(
      await screen.findByText("This worker has recorded nothing yet."),
    ).toBeTruthy();
    expect(document.querySelector('[data-ee-documents="true"]')).toBeNull();
  });
});

/* ------------------------------------------------------------------ masking */

describe("the protected document identifier", () => {
  it("is masked by default, and the whole value is nowhere on the page", async () => {
    renderPanel();

    await screen.findByText("Employment eligibility");
    expect(screen.getByText("•••• 4567")).toBeTruthy();
    expect(document.body.textContent).not.toContain("X1234567");
  });

  it("offers no reveal affordance without the sensitive grant", async () => {
    session.mockReturnValue(
      fixtureSession([ACCESS, WORKER_READ, DOCUMENT_READ, EXAMINE, CERTIFY]),
    );

    renderPanel();

    await screen.findByText("•••• 4567");
    // ABSENT, not disabled: a disabled control still advertises the value is there for the asking.
    expect(screen.queryByText("Reveal number")).toBeNull();
  });

  it("requires a stated purpose, and discloses only after a deliberate confirmation", async () => {
    vi.mocked(revealEmploymentEligibilityIdentifier).mockResolvedValue({
      documentRecordId: "eedoc_1",
      documentTypeKey: "US_PASSPORT",
      identifier: "X1234567",
      revealedAt: "2026-08-14T12:00:00.000Z",
    });

    renderPanel();

    fireEvent.click(await screen.findByText("Reveal number"));
    // Nothing was requested merely by opening the affordance.
    expect(
      vi.mocked(revealEmploymentEligibilityIdentifier),
    ).not.toHaveBeenCalled();

    const confirm = screen.getByText("Confirm and reveal") as HTMLButtonElement;
    // Refused locally until a purpose is stated, and refused server-side regardless.
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "Confirming the number against the image" },
    });
    fireEvent.click(screen.getByText("Confirm and reveal"));

    await waitFor(() =>
      expect(
        vi.mocked(revealEmploymentEligibilityIdentifier),
      ).toHaveBeenCalledWith(
        CANDIDATE_ID,
        "eedoc_1",
        "Confirming the number against the image",
      ),
    );
    expect(await screen.findByText("X1234567")).toBeTruthy();
  });

  it("drops the revealed value on Hide, and keeps it in no storage at all", async () => {
    vi.mocked(revealEmploymentEligibilityIdentifier).mockResolvedValue({
      documentRecordId: "eedoc_1",
      documentTypeKey: "US_PASSPORT",
      identifier: "X1234567",
      revealedAt: "2026-08-14T12:00:00.000Z",
    });

    renderPanel();
    fireEvent.click(await screen.findByText("Reveal number"));
    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "Confirming the number" },
    });
    fireEvent.click(screen.getByText("Confirm and reveal"));
    await screen.findByText("X1234567");

    // NEVER PERSISTED. It lived in component state for as long as he looked at it.
    expect(JSON.stringify(window.localStorage)).not.toContain("X1234567");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("X1234567");
    expect(window.location.href).not.toContain("X1234567");

    fireEvent.click(screen.getByText("Hide"));
    await waitFor(() =>
      expect(screen.queryByText("X1234567")).toBeNull(),
    );
    expect(screen.getByText("•••• 4567")).toBeTruthy();
  });

  it("surfaces a refused disclosure without disclosing anything", async () => {
    vi.mocked(revealEmploymentEligibilityIdentifier).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 400,
        code: "IDENTIFIER_REVEAL_PURPOSE_REQUIRED",
        message: "refused",
        details: null,
      }),
    );

    renderPanel();
    fireEvent.click(await screen.findByText("Reveal number"));
    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "   because" },
    });
    fireEvent.click(screen.getByText("Confirm and reveal"));

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((alert) =>
            (alert.textContent ?? "").includes(
              "IDENTIFIER_REVEAL_PURPOSE_REQUIRED",
            ),
          ),
      ).toBe(true),
    );
    expect(document.body.textContent).not.toContain("X1234567");
  });

  it("offers no disclosure for a document that captured no number", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(reviewWithCard());

    renderPanel();

    const cardRow = await waitFor(() => {
      const row = document.querySelector(
        '[data-ee-document="SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD"]',
      );
      expect(row).toBeTruthy();
      return row!;
    });
    expect(cardRow.textContent).toContain("Not captured");
    expect(cardRow.textContent).not.toContain("Reveal number");
  });
});

/* ----------------------------------------------------------------- evidence */

describe("the evidence", () => {
  it("opens the actual artifact through the DELIVERED administrative retrieval", async () => {
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_ee_1",
      fileName: "passport.jpg",
      mimeType: "image/jpeg",
      url: "https://example.test/signed",
      expiresIn: 300,
    });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    renderPanel();

    fireEvent.click((await screen.findAllByText("Open evidence"))[0]);

    await waitFor(() =>
      expect(vi.mocked(getOnboardingAdminDocumentDownload)).toHaveBeenCalledWith(
        "obdoc_ee_1",
      ),
    );
    // The browser's own viewer, in its own tab. No viewer was built here, and no OCR exists.
    expect(open).toHaveBeenCalledWith(
      "https://example.test/signed",
      "_blank",
      "noopener,noreferrer",
    );
    vi.unstubAllGlobals();
  });

  it("offers nothing to open for an upload the foundation has not confirmed", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        documents: [
          { ...review().documents[0], evidenceConfirmed: false },
        ],
      }),
    );

    renderPanel();

    expect(
      (await screen.findAllByText(/Upload not confirmed/))[0],
    ).toBeTruthy();
    expect(screen.queryByText("Open evidence")).toBeNull();
    // And there is no way to record a conclusion about it either.
    const submit = screen.getByText(
      "Record this examination",
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("does not offer retrieval without the document grant", async () => {
    session.mockReturnValue(
      fixtureSession([ACCESS, WORKER_READ, EXAMINE, CERTIFY]),
    );

    renderPanel();

    await screen.findByText("Employment eligibility");
    expect(screen.queryByText("Open evidence")).toBeNull();
  });
});

/* -------------------------------------------------------------- examination */

describe("the examination the reviewer records", () => {
  it("shows the governed Social Security card rule to the REVIEWER", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(reviewWithCard());

    renderPanel();

    const rule = await waitFor(() => {
      const node = document.querySelector(
        '[data-ee-examination-rule="RESTRICTIVE_LEGEND_PROHIBITED"]',
      );
      expect(node).toBeTruthy();
      return node!;
    });
    expect(rule.textContent).toContain("restriction on working");
    // It is a RULE put to him, never an answer taken from the worker.
    expect(document.body.textContent).not.toMatch(/the worker (said|told|confirmed) /i);
  });

  it("submits one examination covering every presented document, through the module endpoint", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(reviewWithCard());
    vi.mocked(recordEmploymentEligibilityExamination).mockResolvedValue({
      examinationId: "exam_1",
      attestationSetVersion: 1,
      catalogueVersion: "2026-08-13",
      method: "REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE",
      documentOutcomes: [],
      examinedById: "usr_fixture_operator",
      examinedAt: "2026-08-14T12:00:00.000Z",
      supersededAt: null,
    });

    renderPanel();
    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-ee-examine-document="SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD"]',
        ),
      ).toBeTruthy(),
    );

    // The reviewer accepts the licence and rejects the card, which is the restrictive-legend case.
    const licence = document.querySelector(
      '[data-ee-examine-document="STATE_DRIVERS_LICENSE"]',
    )!;
    fireEvent.click(licence.querySelectorAll('input[type="radio"]')[0]);
    const card = document.querySelector(
      '[data-ee-examine-document="SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD"]',
    )!;
    fireEvent.click(card.querySelectorAll('input[type="radio"]')[1]);

    fireEvent.click(screen.getByText("Record this examination"));

    await waitFor(() =>
      expect(
        vi.mocked(recordEmploymentEligibilityExamination),
      ).toHaveBeenCalledWith(CANDIDATE_ID, {
        // The version the reviewer was shown, carried through unaltered so the server can refuse
        // on a mismatch if the worker has since saved a newer one.
        attestationSetVersion: 1,
        catalogueVersion: "2026-08-13",
        method: "REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE",
        documentOutcomes: [
          { documentTypeKey: "STATE_DRIVERS_LICENSE", outcome: "ACCEPTED" },
          {
            documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
            outcome: "REJECTED",
          },
        ],
      }),
    );
  });

  it("cannot be submitted until every presented document carries a conclusion", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(reviewWithCard());

    renderPanel();
    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-ee-examine-document="SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD"]',
        ),
      ).toBeTruthy(),
    );

    const submit = screen.getByText(
      "Record this examination",
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const licence = document.querySelector(
      '[data-ee-examine-document="STATE_DRIVERS_LICENSE"]',
    )!;
    fireEvent.click(licence.querySelectorAll('input[type="radio"]')[0]);
    // Still incomplete: the card has no conclusion.
    expect(
      (screen.getByText("Record this examination") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("surfaces a stale-version refusal rather than pretending it recorded", async () => {
    vi.mocked(recordEmploymentEligibilityExamination).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 400,
        code: "EXAMINATION_RECORD_STALE",
        message: "refused",
        details: null,
      }),
    );

    renderPanel();
    const passport = await waitFor(() => {
      const node = document.querySelector(
        '[data-ee-examine-document="US_PASSPORT"]',
      );
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(passport.querySelectorAll('input[type="radio"]')[0]);

    const submit = await waitFor(() => {
      const button = screen.getByText(
        "Record this examination",
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      return button;
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((alert) =>
            (alert.textContent ?? "").includes("EXAMINATION_RECORD_STALE"),
          ),
      ).toBe(true),
    );
  });

  it("uses accessible grouping and real labels for every choice", async () => {
    renderPanel();
    await screen.findByText("Employment eligibility");

    const form = document.querySelector('[data-ee-examination-form="true"]')!;
    // A fieldset and legend per governed question, rather than loose radios.
    expect(form.querySelectorAll("fieldset").length).toBeGreaterThanOrEqual(2);
    expect(form.querySelectorAll("legend").length).toBeGreaterThanOrEqual(2);
    for (const input of Array.from(form.querySelectorAll("input"))) {
      expect(input.closest("label")).toBeTruthy();
    }
  });

  it("shows what the recorded examination concluded, per document", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        documents: [
          { ...review().documents[0], examinationOutcome: "REJECTED" },
        ],
        certificationBlocks: ["DOCUMENT_EXAMINATION_REJECTED"],
        examination: {
          examinationId: "exam_1",
          attestationSetVersion: 1,
          catalogueVersion: "2026-08-13",
          method: "REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE",
          documentOutcomes: [
            { documentTypeKey: "US_PASSPORT", outcome: "REJECTED" },
          ],
          examinedById: "usr_fixture_operator",
          examinedAt: "2026-08-14T12:00:00.000Z",
          supersededAt: null,
        },
        examinationHistory: [],
      }),
    );

    renderPanel();

    const row = await waitFor(() => {
      const node = document.querySelector('[data-ee-document="US_PASSPORT"]');
      expect(node).toBeTruthy();
      return node!;
    });
    // The badge on the document row, which is the recorded conclusion rather than a control.
    expect(row.querySelector(".oba-badge-refused")?.textContent).toBe(
      "Not acceptable",
    );
    expect(document.querySelector('[data-ee-examination="current"]')).toBeTruthy();
    // The deficiency is stated truthfully, and no worker-facing notification exists to send.
    const blocks = document.querySelector('[data-ee-blocks="true"]');
    expect(
      blocks?.querySelector('[data-ee-block="DOCUMENT_EXAMINATION_REJECTED"]'),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/notify|send a message|email the worker/i);
  });

  it("says so plainly when everything required is in order", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({ certificationBlocks: [], certifiable: true }),
    );

    renderPanel();

    expect(
      await screen.findByText("Everything required is in order."),
    ).toBeTruthy();
    expect(document.querySelector('[data-ee-blocks="true"]')).toBeNull();
  });
});

/* ------------------------------------------------ the completed record */

/** A certification as the server projects one, with the finalized artifact bound to it. */
function certified(
  overrides: Partial<EmploymentEligibilityStaffCertification> = {},
): EmploymentEligibilityStaffCertification {
  return {
    certificationId: "cert_1",
    attestationSetVersion: 1,
    catalogueVersion: "2026-08-13",
    examinationId: "exam_1",
    certifiedById: "usr_fixture_operator",
    certifiedAt: "2026-08-14T12:00:00.000Z",
    firstDayOfEmployment: "2026-08-10",
    artifactRecorded: true,
    artifactOnboardingDocumentId: "onbdoc_artifact_1",
    correctionReason: null,
    supersededAt: null,
    ...overrides,
  };
}

describe("the completed governed record", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens it through the delivered audited administrative retrieval", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        certificationBlocks: [],
        certifiable: true,
        certification: certified(),
      }),
    );
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "onbdoc_artifact_1",
      fileName: "employment_eligibility_record-2026-08-17.pdf",
      mimeType: "application/pdf",
      url: "https://storage.test/signed-artifact",
      expiresIn: 300,
    });
    const opened = vi.fn();
    vi.stubGlobal("open", opened);

    renderPanel();

    const button = await screen.findByRole("button", {
      name: "Open completed record",
    });
    fireEvent.click(button);

    await waitFor(() => {
      // THE DELIVERED RETRIEVAL, asked for by binding. No URL was held in the payload.
      expect(getOnboardingAdminDocumentDownload).toHaveBeenCalledWith(
        "onbdoc_artifact_1",
      );
    });
    await waitFor(() => {
      expect(opened).toHaveBeenCalledWith(
        "https://storage.test/signed-artifact",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("offers nothing to open without the document grant, and does not pretend otherwise", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({ certificationBlocks: [], certifiable: true, certification: certified() }),
    );

    session.mockReturnValue(
      fixtureSession([ACCESS, WORKER_READ, EXAMINE, CERTIFY]),
    );

    renderPanel();
    await screen.findByText("Employment eligibility");

    expect(document.querySelector('[data-ee-artifact="ungranted"]')).toBeTruthy();
    expect(document.querySelector('[data-ee-artifact="open"]')).toBeNull();
    expect(getOnboardingAdminDocumentDownload).not.toHaveBeenCalled();
  });

  it("says plainly when a certification has no stored record, and offers no generate control", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        certificationBlocks: [],
        certifiable: true,
        certification: certified({
          artifactRecorded: false,
          artifactOnboardingDocumentId: null,
        }),
      }),
    );

    renderPanel();
    await screen.findByText("Employment eligibility");

    expect(document.querySelector('[data-ee-artifact="absent"]')).toBeTruthy();
    expect(document.querySelector('[data-ee-artifact="open"]')).toBeNull();
  });

  it("shows the stated reason a certification was corrected", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        certificationBlocks: [],
        certifiable: true,
        certification: certified({
          attestationSetVersion: 2,
          correctionReason: "worker presented a replacement passport",
        }),
      }),
    );

    renderPanel();

    expect(
      await screen.findByText("worker presented a replacement passport"),
    ).toBeTruthy();
  });
});

/* ----------------------------------------------- still out of scope */

describe("what this surface does not do", () => {
  it("offers no generation, export, transport or correction control", async () => {
    vi.mocked(getStaffEmploymentEligibility).mockResolvedValue(
      review({
        certificationBlocks: [],
        certifiable: true,
        certification: certified(),
      }),
    );

    renderPanel();
    await screen.findByText("Employment eligibility");

    /**
     * The completed record can be OPENED, and that is the whole of it. Nothing here generates an
     * artifact, bundles one, exports one, mails one, or edits a certified record: an administrative
     * delivery framework is a later phase's, and a correction begins with the worker amending his
     * own record rather than with staff rewriting a certified one.
     */
    for (const button of Array.from(document.querySelectorAll("button"))) {
      expect(button.textContent ?? "").not.toMatch(
        /generate|regenerate|export|bundle|email|send|transmit|correct this|amend/i,
      );
    }
    expect(document.body.textContent).not.toMatch(/e-verify/i);
    expect(document.body.textContent).not.toMatch(/supplement/i);
  });
});
