/**
 * Phase 4 - governed document review inside the Phase 2 workspace.
 *
 * What this suite is answerable for:
 *
 *  - The panel is a panel. It appears inside the existing worker workspace; there is no second
 *    administrative shell, and no navigation of its own.
 *  - Authorization is by grant, and a missing grant means ABSENCE: no listing, no request, no
 *    disabled control advertising material the operator may not see.
 *  - Retrieval is requested at the moment of viewing, goes to private storage directly, and is
 *    never held on the page.
 *  - The surface exposes no storage internals: no bucket, no key, no credential.
 *  - It renders no business decision. Nothing here accepts, rejects, verifies, or qualifies.
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
  OnboardingAdminApiError,
} = await import("@/lib/workforce/onboardingAdminApi");
const { getOnboardingAdministrativeStatus } = await import(
  "@/lib/workforce/onboardingStatusApi"
);

const { OnboardingAdminDocumentsPanel } = await import("./panels/OnboardingDocumentsPanel");
const { default: OnboardingAdminWorkerWorkspace } = await import(
  "./surfaces/OnboardingAdminWorkerWorkspace"
);
const {
  CANDIDATE_ID,
  ONBOARDING_ADMIN_ALL_GRANTS,
  fixtureAdministrativeStatus,
  fixtureDocument,
  fixtureGeneratedDocument,
  fixtureProjection,
  fixtureSession,
} = await import("./adminTestFixtures");

const ACCESS = "workforce.onboarding.admin.access";
const WORKER_READ = "workforce.onboarding.admin.worker.read";
const DOCUMENT_READ = "workforce.onboarding.document.read";

const openWindow = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue(fixtureSession(ONBOARDING_ADMIN_ALL_GRANTS));
  vi.mocked(getOnboardingAdminWorker).mockResolvedValue(fixtureProjection());
  vi.mocked(getOnboardingAdministrativeStatus).mockResolvedValue(
    fixtureAdministrativeStatus(),
  );
  vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([fixtureDocument()]);
  vi.stubGlobal("open", openWindow);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------- authorization */

describe("document review authorization", () => {
  it("renders nothing and reads nothing without the document grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));

    const { container } = render(
      <OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />,
    );

    expect(container.textContent).toBe("");
    await waitFor(() =>
      expect(vi.mocked(getOnboardingAdminWorkerDocuments)).not.toHaveBeenCalled(),
    );
  });

  it("lists the worker's artifacts once the document grant is held", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, DOCUMENT_READ]));

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("fixture-evidence.pdf")).toBeTruthy();
    expect(vi.mocked(getOnboardingAdminWorkerDocuments)).toHaveBeenCalledWith(CANDIDATE_ID);
  });

  it("reports a refused listing with the code that explains it", async () => {
    vi.mocked(getOnboardingAdminWorkerDocuments).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "INSUFFICIENT_PERMISSIONS",
        message: "refused",
      }),
    );

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/INSUFFICIENT_PERMISSIONS/)).toBeTruthy();
  });

  it("reports a refused retrieval without opening anything", async () => {
    vi.mocked(getOnboardingAdminDocumentDownload).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 404,
        code: "ONBOARDING_DOCUMENT_NOT_FOUND",
        message: "refused",
      }),
    );

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByText(/ONBOARDING_DOCUMENT_NOT_FOUND/)).toBeTruthy();
    expect(openWindow).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- retrieval */

describe("authorized retrieval", () => {
  it("asks for the retrieval only when the operator opens the artifact", async () => {
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_fixture_1",
      fileName: "fixture-evidence.pdf",
      mimeType: "application/pdf",
      url: "https://private-storage.example.test/signed?token=abc",
      expiresIn: 300,
    });

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    await screen.findByText("fixture-evidence.pdf");
    expect(vi.mocked(getOnboardingAdminDocumentDownload)).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() =>
      expect(vi.mocked(getOnboardingAdminDocumentDownload)).toHaveBeenCalledWith(
        "obdoc_fixture_1",
      ),
    );
  });

  it("sends the operator to private storage directly rather than through Jarvis", async () => {
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_fixture_1",
      fileName: "fixture-evidence.pdf",
      mimeType: "application/pdf",
      url: "https://private-storage.example.test/signed?token=abc",
      expiresIn: 300,
    });

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    await waitFor(() =>
      expect(openWindow).toHaveBeenCalledWith(
        "https://private-storage.example.test/signed?token=abc",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });

  it("never renders the retrieval URL into the page", async () => {
    vi.mocked(getOnboardingAdminDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "obdoc_fixture_1",
      fileName: "fixture-evidence.pdf",
      mimeType: "application/pdf",
      url: "https://private-storage.example.test/signed?token=abc",
      expiresIn: 300,
    });

    const { container } = render(
      <OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    await waitFor(() => expect(openWindow).toHaveBeenCalled());

    expect(container.innerHTML).not.toContain("private-storage.example.test");
    expect(container.innerHTML).not.toContain("token=abc");
  });

  it("offers no retrieval for an artifact that was never completed", async () => {
    vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([
      fixtureDocument({ capturedAt: null }),
    ]);

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("Never completed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });
});

/* ------------------------------------------------------------ what is shown */

describe("what the panel presents", () => {
  it("says nothing is recorded rather than showing an empty table", async () => {
    vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([]);

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    expect(
      await screen.findByText("No document is recorded for this worker."),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a generated artifact's form, revisions, and source binding", async () => {
    vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([
      fixtureGeneratedDocument(),
    ]);

    render(<OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText(/FIXTURE_ACKNOWLEDGEMENT/)).toBeTruthy();
    expect(screen.getByText(/form 2026\.1/)).toBeTruthy();
    expect(screen.getByText(/rules R2026\.1/)).toBeTruthy();
    expect(screen.getByText(/FIXTURE_MODULE_COMPLETION:cmp_beta/)).toBeTruthy();
    expect(screen.getByText("Generated")).toBeTruthy();
  });

  it("distinguishes a superseded artifact from the one in effect", async () => {
    vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([
      fixtureDocument(),
      fixtureDocument({
        onboardingDocumentId: "obdoc_fixture_0",
        fileName: "fixture-evidence-first.pdf",
        supersededAt: "2026-02-02T10:00:00.000Z",
      }),
    ]);

    const { container } = render(
      <OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />,
    );

    await screen.findByText("fixture-evidence.pdf");

    expect(
      container.querySelector('[data-document-id="obdoc_fixture_1"]')?.getAttribute(
        "data-superseded",
      ),
    ).toBe("false");
    expect(
      container.querySelector('[data-document-id="obdoc_fixture_0"]')?.getAttribute(
        "data-superseded",
      ),
    ).toBe("true");
    expect(screen.getByText("In effect")).toBeTruthy();
  });

  it("exposes no storage internals and no business decision", async () => {
    vi.mocked(getOnboardingAdminWorkerDocuments).mockResolvedValue([
      fixtureDocument(),
      fixtureGeneratedDocument(),
    ]);

    const { container } = render(
      <OnboardingAdminDocumentsPanel candidateId={CANDIDATE_ID} />,
    );

    await screen.findByText("fixture-evidence.pdf");

    const markup = container.innerHTML;
    expect(markup).not.toMatch(/bucket/i);
    expect(markup).not.toMatch(/s3/i);
    expect(markup).not.toMatch(/storageKey|storage-key/i);
    expect(markup).not.toMatch(/aws/i);

    for (const decision of [/accept/i, /reject/i, /verify/i, /approve/i, /qualif/i]) {
      expect(markup).not.toMatch(decision);
    }
  });
});

/* --------------------------------------------------------- inside the shell */

describe("placement in the existing workspace", () => {
  it("appears as a panel of the Phase 2 worker workspace", async () => {
    render(<OnboardingAdminWorkerWorkspace candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("fixture-evidence.pdf")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Documents" })).toBeTruthy();
    // The workspace it was mounted into, unchanged around it.
    expect(screen.getByRole("heading", { name: "Packets" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Onboarding status" })).toBeTruthy();
  });

  it("leaves the rest of the workspace intact for an operator without the document grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));

    render(<OnboardingAdminWorkerWorkspace candidateId={CANDIDATE_ID} />);

    expect(await screen.findByRole("heading", { name: "Packets" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Documents" })).toBeNull();
    expect(vi.mocked(getOnboardingAdminWorkerDocuments)).not.toHaveBeenCalled();
  });
});
