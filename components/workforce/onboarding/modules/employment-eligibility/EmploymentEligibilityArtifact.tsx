"use client";

/**
 * Module 4.1 - opening the completed governed Employment Eligibility record.
 *
 * WHAT THIS IS FOR. The finished record has to be practically reachable by the authorized staff who
 * process it, and this is the one affordance that makes it reachable from the surface where the
 * reviewer already works. It opens the stored artifact through the DELIVERED audited administrative
 * retrieval - the same signed, short-lived, recorded disclosure the worker's evidence is opened
 * through - and it does nothing else.
 *
 * WHAT IT DELIBERATELY IS NOT. There is no generate button: the artifact is produced by the
 * certification itself, and offering to re-render one here would invite an artifact that no
 * certification stands behind. There is no bundle, no export, no email, no queue and no transport of
 * any kind; a packet-level administrative delivery framework is a later phase's, and duplicating a
 * piece of it inside a business module is how two of them end up existing. There is no correction
 * control either: a correction begins with the worker amending his record, not with staff editing a
 * certified one.
 *
 * NO VIEWER, again on purpose. The signed URL opens in a new tab and the browser's own document
 * viewer displays the PDF. No PDF library, no embedded frame, and nothing cached in this app.
 */

import { useCallback, useState } from "react";
import { getOnboardingAdminDocumentDownload } from "@/lib/workforce/onboardingAdminApi";
import { OnboardingAdminErrorNotice } from "@/components/workforce/admin/OnboardingAdminNotice";
import type { EmploymentEligibilityStaffCertification } from "@/lib/workforce/employmentEligibilityApi";

export function EmploymentEligibilityArtifact({
  certification,
  canReadDocuments,
}: {
  certification: EmploymentEligibilityStaffCertification;
  canReadDocuments: boolean;
}) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const binding = certification.artifactOnboardingDocumentId;

  const open = useCallback(async () => {
    if (!binding) return;
    setError(null);
    setBusy(true);
    try {
      const download = await getOnboardingAdminDocumentDownload(binding);
      // `noopener` because a signed URL is a live capability and the opened tab has no business
      // reaching back into this one.
      window.open(download.url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }, [binding]);

  if (!binding) {
    // A certification recorded before finalized artifacts were produced. Said plainly rather than
    // offering a control that would fail, and NOT offering to generate one now.
    return (
      <p className="oba-field-absent" data-ee-artifact="absent">
        No completed record is stored for this certification.
      </p>
    );
  }

  if (!canReadDocuments) {
    return (
      <p className="oba-field-absent" data-ee-artifact="ungranted">
        A completed record is stored for this certification.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="oba-btn oba-btn-link"
        data-ee-artifact="open"
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? "Opening…" : "Open completed record"}
      </button>
      {error ? <OnboardingAdminErrorNotice error={error} /> : null}
    </>
  );
}

export default EmploymentEligibilityArtifact;
