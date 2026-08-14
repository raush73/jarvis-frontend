"use client";

/**
 * Module 4.1 - opening the actual evidence the worker captured.
 *
 * IT BUILDS NO VIEWER, and that is the whole design. The delivered administrative retrieval returns
 * a short-lived signed URL for an artifact whose bytes the document foundation has proven present,
 * and this opens that URL in a new tab so the reviewer looks at the real photograph or PDF in the
 * browser's own image and document viewer. There is no image pipeline here, no PDF library, no
 * canvas, no zoom implementation, and no thumbnail cache - and there is deliberately no OCR and no
 * automated analysis of any kind: the examination determination is the reviewer's, made by looking.
 *
 * AN UNCONFIRMED UPLOAD IS NOT EVIDENCE. Where the server says a binding is not a confirmed
 * capture, this offers nothing to open and says so plainly, because a reviewer must never be
 * invited to examine something whose existence nothing has established.
 */

import { useCallback, useState } from "react";
import { getOnboardingAdminDocumentDownload } from "@/lib/workforce/onboardingAdminApi";
import { OnboardingAdminErrorNotice } from "@/components/workforce/admin/OnboardingAdminNotice";
import type { EmploymentEligibilityStaffDocument } from "@/lib/workforce/employmentEligibilityApi";

export function EmploymentEligibilityEvidence({
  document: presented,
  canReadDocuments,
}: {
  document: EmploymentEligibilityStaffDocument;
  canReadDocuments: boolean;
}) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const binding = presented.onboardingDocumentId;

  const open = useCallback(async () => {
    if (!binding) return;
    setError(null);
    setBusy(true);
    try {
      const download = await getOnboardingAdminDocumentDownload(binding);
      // The browser's own viewer, in its own tab. `noopener` because a signed URL is a live
      // capability and the opened tab has no business reaching back into this one.
      window.open(download.url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }, [binding]);

  if (!binding) {
    return (
      <span className="oba-field-absent" data-ee-evidence="absent">
        Nothing captured
      </span>
    );
  }

  if (!presented.evidenceConfirmed) {
    return (
      <span className="oba-field-absent" data-ee-evidence="unconfirmed">
        Upload not confirmed - not examinable
      </span>
    );
  }

  return (
    <>
      {canReadDocuments ? (
        <button
          type="button"
          className="oba-btn oba-btn-link"
          data-ee-evidence="open"
          disabled={busy}
          onClick={() => void open()}
        >
          {busy ? "Opening…" : "Open evidence"}
        </button>
      ) : (
        <span className="oba-field-absent" data-ee-evidence="ungranted">
          Captured
        </span>
      )}
      {error ? <OnboardingAdminErrorNotice error={error} /> : null}
    </>
  );
}

export default EmploymentEligibilityEvidence;
