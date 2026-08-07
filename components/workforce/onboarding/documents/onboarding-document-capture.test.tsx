/**
 * Phase 4 Gate 4.7 - the worker document capture surface.
 *
 * The claims proven here are the governed states, in the same terms:
 *
 *  - selection, upload preparation, direct upload, confirmation, success;
 *  - retry after a failed confirmation, WITHOUT re-selecting the file;
 *  - remove-before-confirm;
 *  - validation error before any byte is sent;
 *  - authorization and session errors surfaced through the runtime's one error surface.
 *
 * And the two structural claims: bytes go straight to storage carrying no Jarvis credential,
 * and nothing here names a business module or a real document type.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

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
    getOnboardingDocumentDownload: vi.fn(),
  };
});

const {
  getOnboardingDocumentSlots,
  createOnboardingUploadTarget,
  uploadToStorage,
  confirmOnboardingDocument,
  removeOnboardingDocument,
  getOnboardingDocumentDownload,
} = await import("@/lib/workforce/onboardingDocumentApi");
const { OnboardingApiError } = await import("@/lib/workforce/onboardingApi");
const { WorkerSessionExpiredError } = await import("@/lib/workforce/workforceApi");
const { default: OnboardingDocumentCapture } = await import(
  "./OnboardingDocumentCapture"
);

const INVOCATION = "inv_1";

/** A FIXTURE slot. Nothing here is a real onboarding document type. */
function fixtureSlot(overrides: Record<string, unknown> = {}) {
  return {
    moduleKey: "FIXTURE_SIMPLE",
    slotKey: "FIXTURE_EVIDENCE",
    title: "Fixture Supporting Evidence",
    origin: "UPLOADED" as const,
    acceptedMimeTypes: ["application/pdf"],
    maxBytes: 5 * 1024 * 1024,
    replaceable: true,
    current: null,
    history: [],
    ...overrides,
  };
}

function fixtureDocument(overrides: Record<string, unknown> = {}) {
  return {
    onboardingDocumentId: "onbdoc_1",
    moduleKey: "FIXTURE_SIMPLE",
    slotKey: "FIXTURE_EVIDENCE",
    origin: "UPLOADED" as const,
    fileName: "evidence.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    capturedAt: "2026-08-07T15:00:00.000Z",
    supersededAt: null,
    supersedesId: null,
    generation: null,
    createdAt: "2026-08-07T14:59:00.000Z",
    ...overrides,
  };
}

function fixtureTarget() {
  return {
    onboardingDocumentId: "onbdoc_1",
    moduleKey: "FIXTURE_SIMPLE",
    slotKey: "FIXTURE_EVIDENCE",
    upload: {
      url: "https://storage.test/bucket/key?sig=put",
      method: "PUT" as const,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": "2048",
      },
      expiresIn: 300,
    },
  };
}

function pdf(name = "evidence.pdf", size = 2048): File {
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

async function selectFile(file: File): Promise<void> {
  const input = await screen.findByLabelText(/choose a file/i);
  fireEvent.change(input, { target: { files: [file] } });
}

describe("worker document capture", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([fixtureSlot()]);
    vi.mocked(createOnboardingUploadTarget).mockResolvedValue(fixtureTarget());
    vi.mocked(uploadToStorage).mockResolvedValue(undefined);
    vi.mocked(confirmOnboardingDocument).mockResolvedValue(fixtureDocument());
    vi.mocked(removeOnboardingDocument).mockResolvedValue({ removed: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------------
  // The happy path, state by state
  // ------------------------------------------------------------------------

  it("carries a document from selection to captured", async () => {
    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await screen.findByText("Fixture Supporting Evidence");

    await selectFile(pdf());
    expect(await screen.findByText(/ready to upload/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    await waitFor(() =>
      expect(screen.getByText(/document has been received/i)).toBeTruthy(),
    );
    expect(vi.mocked(createOnboardingUploadTarget)).toHaveBeenCalledWith(
      INVOCATION,
      {
        moduleKey: "FIXTURE_SIMPLE",
        slotKey: "FIXTURE_EVIDENCE",
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
    );
    expect(vi.mocked(confirmOnboardingDocument)).toHaveBeenCalledWith(
      INVOCATION,
      "onbdoc_1",
    );
  });

  it("sends the bytes to the storage URL rather than to Jarvis", async () => {
    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    await waitFor(() => expect(vi.mocked(uploadToStorage)).toHaveBeenCalled());
    const [target] = vi.mocked(uploadToStorage).mock.calls[0];
    expect(target.upload.url).toContain("https://storage.test/");
    expect(target.upload.url).not.toContain("/workforce/onboarding");
  });

  it("reloads the slot listing after a capture so the server decides what is current", async () => {
    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    await waitFor(() =>
      expect(vi.mocked(getOnboardingDocumentSlots).mock.calls.length).toBe(2),
    );
  });

  // ------------------------------------------------------------------------
  // Validation, before any byte leaves the browser
  // ------------------------------------------------------------------------

  it("refuses an unaccepted file type without contacting the server", async () => {
    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    const wrong = new File(["x"], "photo.gif", { type: "image/gif" });
    await selectFile(wrong);

    expect(await screen.findByText(/this slot accepts pdf/i)).toBeTruthy();
    expect(vi.mocked(createOnboardingUploadTarget)).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: /^upload$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("refuses an oversized file without contacting the server", async () => {
    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf("huge.pdf", 6 * 1024 * 1024));

    expect(await screen.findByText(/larger than the 5 MB limit/i)).toBeTruthy();
    expect(vi.mocked(createOnboardingUploadTarget)).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------------
  // Retry and remove-before-confirm
  // ------------------------------------------------------------------------

  it("keeps the reservation when confirmation fails, and confirms again without re-selecting", async () => {
    vi.mocked(confirmOnboardingDocument)
      .mockRejectedValueOnce(
        new OnboardingApiError(
          "The uploaded file was not found in storage",
          400,
          "DOCUMENT_OBJECT_MISSING",
        ),
      )
      .mockResolvedValueOnce(fixtureDocument());

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    const finish = await screen.findByRole("button", { name: /finish upload/i });
    expect(vi.mocked(uploadToStorage)).toHaveBeenCalledTimes(1);

    fireEvent.click(finish);
    await waitFor(() =>
      expect(screen.getByText(/document has been received/i)).toBeTruthy(),
    );
    // The reservation was reused: no second upload target was requested.
    expect(vi.mocked(createOnboardingUploadTarget)).toHaveBeenCalledTimes(1);
  });

  it("discards the stale reservation when the worker starts over", async () => {
    vi.mocked(confirmOnboardingDocument).mockRejectedValue(
      new OnboardingApiError("Refused", 400, "DOCUMENT_SIZE_MISMATCH"),
    );

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    fireEvent.click(await screen.findByRole("button", { name: /start over/i }));
    await waitFor(() =>
      expect(vi.mocked(removeOnboardingDocument)).toHaveBeenCalledWith(
        INVOCATION,
        "onbdoc_1",
      ),
    );
  });

  it("removes an unconfirmed upload on request", async () => {
    vi.mocked(confirmOnboardingDocument).mockRejectedValue(
      new OnboardingApiError("Refused", 400, "DOCUMENT_OBJECT_MISSING"),
    );

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    fireEvent.click(await screen.findByRole("button", { name: /^remove$/i }));
    await waitFor(() =>
      expect(vi.mocked(removeOnboardingDocument)).toHaveBeenCalledWith(
        INVOCATION,
        "onbdoc_1",
      ),
    );
  });

  // ------------------------------------------------------------------------
  // Refusals and session failure
  // ------------------------------------------------------------------------

  it("surfaces an authorization refusal through the runtime error surface", async () => {
    vi.mocked(createOnboardingUploadTarget).mockRejectedValue(
      new OnboardingApiError(
        "This document is not available to this worker",
        403,
        "DOCUMENT_NOT_AVAILABLE",
      ),
    );

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await selectFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("surfaces an expired session as a session failure, not a document failure", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockRejectedValue(
      new WorkerSessionExpiredError(),
    );

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("SESSION_EXPIRED");
  });

  // ------------------------------------------------------------------------
  // What the surface must NOT do
  // ------------------------------------------------------------------------

  it("renders nothing when the server declared no slots", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([]);
    const { container } = render(
      <OnboardingDocumentCapture invocationId={INVOCATION} />,
    );
    await waitFor(() =>
      expect(vi.mocked(getOnboardingDocumentSlots)).toHaveBeenCalled(),
    );
    expect(container.querySelector(".ob-doc-section")).toBeNull();
  });

  it("offers no upload control for a generated artifact", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([
      fixtureSlot({
        slotKey: "FIXTURE_GENERATED_FORM",
        title: "Fixture Generated Form",
        origin: "GENERATED",
        acceptedMimeTypes: [],
      }),
    ]);

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await screen.findByText(/prepared for you/i);
    expect(screen.queryByLabelText(/choose a file/i)).toBeNull();
  });

  it("offers no replacement for a filled slot that does not permit one", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([
      fixtureSlot({
        replaceable: false,
        current: fixtureDocument(),
        history: [fixtureDocument()],
      }),
    ]);

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    await screen.findByText(/does not need to be replaced/i);
    expect(screen.queryByLabelText(/choose a file/i)).toBeNull();
  });

  it("says plainly that a replaced document is retained", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([
      fixtureSlot({
        current: fixtureDocument({ onboardingDocumentId: "onbdoc_2" }),
        history: [
          fixtureDocument({ onboardingDocumentId: "onbdoc_2" }),
          fixtureDocument({ supersededAt: "2026-08-07T15:00:00.000Z" }),
        ],
      }),
    ]);

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    expect(await screen.findByText(/earlier version is kept/i)).toBeTruthy();
  });

  it("exposes no storage internals to the page", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([
      fixtureSlot({ current: fixtureDocument(), history: [fixtureDocument()] }),
    ]);

    const { container } = render(
      <OnboardingDocumentCapture invocationId={INVOCATION} />,
    );
    await screen.findByText(/evidence\.pdf/);
    const markup = container.innerHTML;
    expect(markup).not.toContain("storageKey");
    expect(markup).not.toContain("bucket");
    expect(markup).not.toContain("sig=");
  });

  it("fetches a retrieval URL only at the moment of viewing", async () => {
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([
      fixtureSlot({ current: fixtureDocument(), history: [fixtureDocument()] }),
    ]);
    vi.mocked(getOnboardingDocumentDownload).mockResolvedValue({
      onboardingDocumentId: "onbdoc_1",
      fileName: "evidence.pdf",
      mimeType: "application/pdf",
      url: "https://storage.test/bucket/key?sig=get",
      expiresIn: 300,
    });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(<OnboardingDocumentCapture invocationId={INVOCATION} />);
    const view = await screen.findByRole("button", { name: /view/i });
    expect(vi.mocked(getOnboardingDocumentDownload)).not.toHaveBeenCalled();

    fireEvent.click(view);
    await waitFor(() =>
      expect(vi.mocked(getOnboardingDocumentDownload)).toHaveBeenCalledWith(
        INVOCATION,
        "onbdoc_1",
      ),
    );
    vi.unstubAllGlobals();
  });

  it("names no business module and no real document type", async () => {
    const { container } = render(
      <OnboardingDocumentCapture invocationId={INVOCATION} />,
    );
    await screen.findByText("Fixture Supporting Evidence");
    const markup = container.innerHTML.toUpperCase();
    for (const name of ["I-9", "I9", "W-4", "W4", "SSN", "DIRECT DEPOSIT"]) {
      expect(markup).not.toContain(name);
    }
  });
});
