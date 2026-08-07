"use client";

/**
 * Phase 2 - the canonical worker context surface.
 *
 * One header, shown above every administrative surface that concerns a worker, so an operator
 * always knows whose material he is looking at and can reach the same places from anywhere.
 * Every module's administrative panel mounts underneath this header rather than supplying its
 * own worker context, which is what keeps two modules from disagreeing about who the worker is.
 *
 * Identity is masked, and the only way past that is the audited reveal.
 */

import Link from "next/link";
import type { OnboardingAdminWorker } from "@/lib/workforce/onboardingAdminApi";
import {
  onboardingAdminInvestigationPath,
  onboardingAdminWorkerPath,
  revealOnboardingAdminSsn,
} from "@/lib/workforce/onboardingAdminApi";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "../adminPermissions";
import { OnboardingAdminMaskedValue } from "./MaskedValue";

export function OnboardingAdminWorkerContextHeader({
  worker,
  showWorkerLink = false,
  showInvestigationLink = true,
}: {
  worker: OnboardingAdminWorker;
  showWorkerLink?: boolean;
  showInvestigationLink?: boolean;
}) {
  const session = useSession();
  const { canReadAudit, canReadWorkers } = useOnboardingAdminPermissions(session);

  return (
    <div className="oba-worker-context">
      <div className="oba-worker-identity">
        <p className="oba-worker-name">{worker.displayName}</p>
        <p className="oba-worker-meta">
          {[worker.city, worker.state].filter(Boolean).join(", ") || "No location on file"}
        </p>
        <OnboardingAdminMaskedValue
          label="Social Security number"
          maskedValue={worker.maskedSsn}
          hasValue={worker.hasSecureIdentity}
          onReveal={async (purpose) => {
            const revealed = await revealOnboardingAdminSsn(worker.candidateId, purpose);
            return revealed.value;
          }}
        />
      </div>

      <div className="oba-worker-links">
        {showWorkerLink && canReadWorkers ? (
          <Link className="oba-btn oba-btn-quiet" href={onboardingAdminWorkerPath(worker.candidateId)}>
            Open worker
          </Link>
        ) : null}
        {showInvestigationLink && canReadAudit ? (
          <Link
            className="oba-btn oba-btn-quiet"
            href={onboardingAdminInvestigationPath(worker.candidateId)}
          >
            Investigate history
          </Link>
        ) : null}
      </div>
    </div>
  );
}
