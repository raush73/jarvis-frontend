/**
 * Workforce Onboarding documents - browser API client.
 *
 * The Phase 4 counterpart to `onboardingRuntimeApi.ts`. It adds no transport of its own for
 * Jarvis calls: the same worker session handling, the same refusal codes, and the same error
 * class are reused.
 *
 * It DOES add one call that deliberately bypasses that transport - `uploadToStorage` - and
 * the bypass is the point. Bytes go from the browser straight to private storage against a
 * short-lived signed URL, so the worker's session token is never attached to that request
 * and no file ever transits a Jarvis application server.
 *
 * The types mirror the backend's `documents/onboarding-document.view.ts` exactly.
 */

import { onboardingWorkerFetch } from "./onboardingApi";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

export type OnboardingDocumentOrigin = "UPLOADED" | "GENERATED";

/** What a generated artifact was produced from. Absent for an uploaded one. */
export type OnboardingDocumentGeneration = {
  formKey: string;
  formRevision: string;
  ruleRevision: string;
  sourceKind: string;
  sourceRef: string;
  sourceHash: string;
  generatedAt: string | null;
};

export type OnboardingDocument = {
  onboardingDocumentId: string;
  moduleKey: string;
  slotKey: string;
  origin: OnboardingDocumentOrigin;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Null until storage proved the object exists. Not a client-side flag. */
  capturedAt: string | null;
  supersededAt: string | null;
  supersedesId: string | null;
  generation: OnboardingDocumentGeneration | null;
  createdAt: string;
};

export type OnboardingDocumentSlot = {
  moduleKey: string;
  slotKey: string;
  title: string;
  origin: OnboardingDocumentOrigin;
  acceptedMimeTypes: string[];
  maxBytes: number;
  replaceable: boolean;
  current: OnboardingDocument | null;
  history: OnboardingDocument[];
};

/** The upload capability. `url` is a storage URL, never a Jarvis one. */
export type OnboardingUploadTarget = {
  onboardingDocumentId: string;
  moduleKey: string;
  slotKey: string;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresIn: number;
  };
};

export type OnboardingDocumentDownload = {
  onboardingDocumentId: string;
  fileName: string;
  mimeType: string;
  url: string;
  expiresIn: number;
};

/* -------------------------------------------------------------------------- */
/*  Surface                                                                    */
/* -------------------------------------------------------------------------- */

function base(invocationId: string): string {
  return `/workforce/onboarding/runtime/packets/${encodeURIComponent(
    invocationId,
  )}/documents`;
}

/** Every governed slot in this packet, with what currently occupies it. */
export async function getOnboardingDocumentSlots(
  invocationId: string,
): Promise<OnboardingDocumentSlot[]> {
  return onboardingWorkerFetch<OnboardingDocumentSlot[]>(base(invocationId));
}

/** Ask for authorization to upload. Returns a capability, not a place to send bytes to. */
export async function createOnboardingUploadTarget(
  invocationId: string,
  input: {
    moduleKey: string;
    slotKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<OnboardingUploadTarget> {
  return onboardingWorkerFetch<OnboardingUploadTarget>(
    `${base(invocationId)}/upload-targets`,
    { method: "POST", body: input },
  );
}

/**
 * Send the file DIRECTLY to private storage.
 *
 * Note what is absent: no `API_BASE`, no worker token, no credentials. This request does not
 * go to Jarvis, and attaching the session token would hand a bearer credential to a third
 * party. The signed URL is the only authority it carries, and it expires.
 *
 * Content-Length is set by the browser from the body and cannot be set here; that is the
 * desired behaviour, because it means the length in the signature is checked against the
 * real body rather than against anything the page claimed.
 */
export async function uploadToStorage(
  target: OnboardingUploadTarget,
  file: Blob,
): Promise<void> {
  const headers: Record<string, string> = {};
  const contentType = target.upload.headers["Content-Type"];
  if (contentType) headers["Content-Type"] = contentType;

  const response = await fetch(target.upload.url, {
    method: target.upload.method,
    headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

/** Ask the server to verify the object and accept the artifact. */
export async function confirmOnboardingDocument(
  invocationId: string,
  onboardingDocumentId: string,
): Promise<OnboardingDocument> {
  return onboardingWorkerFetch<OnboardingDocument>(
    `${base(invocationId)}/${encodeURIComponent(onboardingDocumentId)}/confirm`,
    { method: "POST", body: {} },
  );
}

/** Remove-before-confirm. Reaches only an unconfirmed reservation. */
export async function removeOnboardingDocument(
  invocationId: string,
  onboardingDocumentId: string,
): Promise<{ removed: true }> {
  return onboardingWorkerFetch<{ removed: true }>(
    `${base(invocationId)}/${encodeURIComponent(onboardingDocumentId)}`,
    { method: "DELETE" },
  );
}

/** A short-lived retrieval of the worker's own confirmed artifact. */
export async function getOnboardingDocumentDownload(
  invocationId: string,
  onboardingDocumentId: string,
): Promise<OnboardingDocumentDownload> {
  return onboardingWorkerFetch<OnboardingDocumentDownload>(
    `${base(invocationId)}/${encodeURIComponent(
      onboardingDocumentId,
    )}/download`,
  );
}
