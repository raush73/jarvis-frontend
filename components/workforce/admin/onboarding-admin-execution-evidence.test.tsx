/**
 * Phase 5 Gate 5G - authorized staff execution-evidence review inside the Phase 2 workspace.
 *
 * What this suite is answerable for:
 *
 *  - The panel is a panel. It appears inside the existing worker workspace; there is no second
 *    administrative shell, no route of its own, and no navigation entry.
 *  - Authorization is by grant, and a missing grant means ABSENCE: nothing rendered, nothing
 *    requested, no disabled control advertising evidence the operator may not see. Holding the
 *    neighbouring grants is not holding this one.
 *  - History is history. A superseded act stays on screen, still reporting the revision it was
 *    executed against, distinguished from the act in effect rather than replaced by it.
 *  - An executed artifact opens through the EXISTING Phase 4 retrieval and through nothing
 *    else, and the URL never reaches the page.
 *  - Where a subject retained no artifact, the panel says so rather than offering a control
 *    that would fail.
 *  - No drawing, no envelope field, no storage internal, and no business decision appears.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/onboarding",
}));

vi.mock("@/lib/workforce/onboardingAdminApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingAdminApi")>();
  return {
    ...actual,
    getOnboardingAdminWorker: vi.fn(),
    getOnboardingAdminWorkerDocuments: vi.fn(),
    getOnboardingAdminDocumentDownload: vi.fn(),
    getOnboardingAdminWorkerExecutions: vi.fn(),
  };
});

vi.mock("@/lib/workforce/onboardingStatusApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingStatusApi")>();
  return { ...actual, getOnboardingAdministrativeStatus: vi.fn() };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const {
  getOnboardingAdminWorker,
  getOnboardingAdminWorkerDocuments,
  getOnboardingAdminDocumentDownload,
  getOnboardingAdminWorkerExecutions,
  OnboardingAdminApiError,
} = await import("@/lib/workforce/onboardingAdminApi");
const { getOnboardingAdministrativeStatus } = await import(
  "@/lib/workforce/onboardingStatusApi"
);

const { OnboardingExecutionEvidencePanel } = await import(
  "./panels/OnboardingExecutionEvidencePanel"
);
const { default: OnboardingAdminWorkerWorkspace } = await import(
  "./surfaces/OnboardingAdminWorkerWorkspace"
);
const {
  CANDIDATE_ID,
  fixtureAdministrativeStatus,
  fixtureDocument,
  fixtureExecution,
  fixtureProjection,
  fixtureSession,
  fixtureSignedExecution,
} = await import("./adminTestFixtures");

const ACCESS = "workforce.onboarding.admin.access";
const WORKER_READ = "workforce.onboarding.admin.worker.read";
const DOCUMENT_READ = "workforce.onboarding.document.read";
const EXECUTION_READ = "workforce.onboarding.execution.read";

/** Everything an operator holds when authorization is not the subject of a test. */
const EVERY_GRANT = [ACCESS, WORKER_READ, DOCUMENT_READ, EXECUTION_READ];

const openWindow = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue(fixtureSession(EVERY_GRANT));
  vi.mocked(getOnboardingAdminWorker).mockResolvedValue(fixtureProjection());
  vi.mocked(getOnboardingAdministrativeStatus).mockResolvedValue(
    fixtureAdministrativeStatus(),
  );
  vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([fixtureDocument()]);
  vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([fixtureExecution()]);
  vi.stubGlobal("open", openWindow);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------- authorization */

describe("execution evidence authorization", () => {
  it("renders nothing and reads nothing without the execution grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, DOCUMENT_READ]));

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    expect(container.textContent).toBe("");
    await waitFor(() =>
      expect(vi.mocked(getOnboardingAdminWorkerExecutions)).not.toHaveBeenCalled(),
    );
  });

  it("lists the worker's acts once the execution grant is held", async () => {
    session.mockReturnValue(fixtureSession([EXECUTION_READ]));

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("Fixture Reading Attestation")).toBeTruthy();
    expect(vi.mocked(getOnboardingAdminWorkerExecutions)).toHaveBeenCalledWith(
      CANDIDATE_ID,
    );
  });

  it("reports a refused read with the code that explains it", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "INSUFFICIENT_PERMISSIONS",
        message: "refused",
      }),
    );

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/INSUFFICIENT_PERMISSIONS/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

/* ---------------------------------------------------------------- the record */

describe("what the panel presents", () => {
  it("says nothing was executed rather than showing an empty table", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([]);

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("This worker has executed nothing.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("states the act performed and the exact governed revision executed", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("Signed electronically")).toBeTruthy();
    expect(screen.getByText("FIXTURE_ACKNOWLEDGEMENT")).toBeTruthy();
    // Revision and rule revision are shown separately: a governed layout and the rules that
    // populate it move independently, and an auditor needs both.
    expect(screen.getByText(/revision 2026\.1/)).toBeTruthy();
    expect(screen.getByText(/rules R2026\.1/)).toBeTruthy();
  });

  it("groups acts by the governed subject they were performed against", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
      fixtureExecution(),
    ]);

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    await screen.findByText("Fixture Signed Form");
    expect(
      container.querySelectorAll("[data-execution-subject]").length,
    ).toBe(2);
    expect(
      container.querySelector(
        '[data-execution-subject="FIXTURE_ALPHA::FIXTURE_SIGNED_FORM"]',
      ),
    ).toBeTruthy();
  });

  it("falls back to the subject key when the module no longer declares the subject", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureExecution({ subjectTitle: null }),
    ]);

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findAllByText("FIXTURE_NOTICE")).toBeTruthy();
  });

  /**
   * The fingerprints are shown as recorded values. Nothing here claims either was checked:
   * Gate 5G does not decrypt the protected capture, so it cannot re-derive the evidence
   * binding, and wording that implied otherwise would misrepresent the surface.
   */
  it("shows the recorded bindings without claiming to have verified them", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    await screen.findByText("Signed electronically");
    expect(screen.getByText(/content 111122223333/)).toBeTruthy();
    expect(screen.getByText(/evidence ffffeeeedddd/)).toBeTruthy();

    const markup = container.innerHTML;
    for (const claim of [/verified/i, /validated/i, /re-?proven/i, /integrity/i]) {
      expect(markup).not.toMatch(claim);
    }
  });

  /** The descriptor says a drawing exists and is plausible. It narrows nothing about it. */
  it("describes a native capture without showing one", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    expect(await screen.findByText(/2 strokes over 1234 ms/)).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg path")).toBeNull();
  });

  it("shows no evidence descriptor for an attestation", async () => {
    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    await screen.findByText("Read and acknowledged");
    expect(screen.queryByText(/stroke/)).toBeNull();
    expect(screen.queryByText(/^evidence /)).toBeNull();
  });
});

/* -------------------------------------------------------------------- history */

describe("history", () => {
  it("keeps a superseded act beside the one in effect, and distinguishes them", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
      fixtureSignedExecution({
        executionId: "exe_fixture_signed_first",
        executedContent: {
          kind: "GOVERNED_FORM",
          ref: "FIXTURE_ACKNOWLEDGEMENT",
          revision: "2025.1",
          ruleRevision: "R2025.1",
          contentHash:
            "0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff",
        },
        onboardingDocumentId: "obdoc_fixture_first",
        current: false,
        supersededAt: "2026-02-02T10:00:00.000Z",
      }),
    ]);

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    await screen.findByText("In effect");
    expect(screen.getByText("Superseded")).toBeTruthy();

    // The older act still reports what IT was executed against.
    expect(screen.getByText(/revision 2025\.1/)).toBeTruthy();
    expect(
      container
        .querySelector('[data-execution-id="exe_fixture_signed_first"]')
        ?.getAttribute("data-execution-current"),
    ).toBe("false");
    expect(
      container
        .querySelector('[data-execution-id="exe_fixture_signed"]')
        ?.getAttribute("data-execution-current"),
    ).toBe("true");

    // Both acts remain under the one subject: history is not split by standing.
    expect(container.querySelectorAll("[data-execution-subject]").length).toBe(1);
  });
});

/* ------------------------------------------------------------------ artifacts */

describe("the executed artifact", () => {
  it("opens through the existing Phase 4 retrieval and nothing else", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_fixture_generated",
      fileName: "fixture-acknowledgement.pdf",
      mimeType: "application/pdf",
      url: "https://private-storage.example.test/signed?token=abc",
      expiresIn: 300,
    });

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    await screen.findByText("Signed electronically");
    expect(vi.mocked(getOnboardingAdminDocumentDownload)).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() =>
      expect(vi.mocked(getOnboardingAdminDocumentDownload)).toHaveBeenCalledWith(
        "obdoc_fixture_generated",
      ),
    );
    expect(openWindow).toHaveBeenCalledWith(
      "https://private-storage.example.test/signed?token=abc",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("never renders the retrieval URL into the page", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_fixture_generated",
      fileName: "fixture-acknowledgement.pdf",
      mimeType: "application/pdf",
      url: "https://private-storage.example.test/signed?token=abc",
      expiresIn: 300,
    });

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    await waitFor(() => expect(openWindow).toHaveBeenCalled());

    expect(container.innerHTML).not.toContain("private-storage.example.test");
    expect(container.innerHTML).not.toContain("token=abc");
  });

  it("reports a refused retrieval without opening anything", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);
    vi.mocked(getOnboardingAdminDocumentDownload).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 404,
        code: "DOCUMENT_NOT_FOUND",
        message: "refused",
      }),
    );

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByText(/DOCUMENT_NOT_FOUND/)).toBeTruthy();
    expect(openWindow).not.toHaveBeenCalled();
  });

  /**
   * A subject may deliberately retain nothing, and for such an act the record IS the
   * evidence. Saying so plainly is the honest answer; a dead control would not be.
   */
  it("states plainly when no artifact was retained, offering no control", async () => {
    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("No artifact retained")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });
});

/* ------------------------------------------------------------------- leakage */

describe("what never reaches the page", () => {
  it("shows no capture, no envelope, no storage internal, and no decision", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
      fixtureExecution(),
    ]);

    const { container } = render(
      <OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />,
    );

    await screen.findByText("Signed electronically");
    const markup = container.innerHTML;

    for (const forbidden of [
      /ciphertext/i,
      /authTag/i,
      /encryptedDataKey/i,
      /kmsKeyId/i,
      /keyVersion/i,
      /\bkms\b/i,
      /bucket/i,
      /\bs3\b/i,
      /storageKey|storage-key/i,
      /\baws\b/i,
      /https?:\/\//i,
      /coordinate/i,
      /\bstroke\b(?!s? over)/i,
    ]) {
      expect({ forbidden: String(forbidden), leaked: forbidden.test(markup) }).toEqual({
        forbidden: String(forbidden),
        leaked: false,
      });
    }

    for (const decision of [/accept/i, /reject/i, /verify/i, /approve/i, /qualif/i]) {
      expect(markup).not.toMatch(decision);
    }
  });

  it("persists nothing about the evidence it displayed", async () => {
    vi.mocked(getOnboardingAdminWorkerExecutions).mockResolvedValue([
      fixtureSignedExecution(),
    ]);
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_fixture_generated",
      fileName: "fixture-acknowledgement.pdf",
      mimeType: "application/pdf",
      url: "https://private-storage.example.test/signed?token=abc",
      expiresIn: 300,
    });

    render(<OnboardingExecutionEvidencePanel candidateId={CANDIDATE_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    await waitFor(() => expect(openWindow).toHaveBeenCalled());

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

/* --------------------------------------------------------- inside the shell */

describe("placement in the existing workspace", () => {
  it("appears as a panel of the Phase 2 worker workspace, following Documents", async () => {
    const { container } = render(
      <OnboardingAdminWorkerWorkspace candidateId={CANDIDATE_ID} />,
    );

    expect(
      await screen.findByRole("heading", { name: "Execution evidence" }),
    ).toBeTruthy();
    // The workspace it was mounted into, unchanged around it.
    expect(screen.getByRole("heading", { name: "Documents" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Packets" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Onboarding status" })).toBeTruthy();

    const headings = [...container.querySelectorAll(".oba-panel-title")].map(
      (node) => node.textContent,
    );
    expect(headings.indexOf("Execution evidence")).toBe(
      headings.indexOf("Documents") + 1,
    );
  });

  it("leaves the rest of the workspace intact for an operator without the grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, DOCUMENT_READ]));

    render(<OnboardingAdminWorkerWorkspace candidateId={CANDIDATE_ID} />);

    expect(await screen.findByRole("heading", { name: "Packets" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Documents" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Execution evidence" })).toBeNull();
    expect(vi.mocked(getOnboardingAdminWorkerExecutions)).not.toHaveBeenCalled();
  });
});
