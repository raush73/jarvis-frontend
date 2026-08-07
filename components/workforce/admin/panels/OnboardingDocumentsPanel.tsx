"use client";

/**
 * Phase 4 - the governed document panel.
 *
 * A PANEL inside the Phase 2 workspace, not a review shell. It answers two questions and no
 * others: what governed artifacts exist for this worker, and - for an operator holding the
 * grant - what does one of them contain.
 *
 * What it deliberately does not do:
 *
 *  - It renders no judgement. There is no accept, no reject, no verify, no qualification.
 *    Those belong to business modules, and Phase 4 implements none.
 *  - It renders nothing at all for an operator who does not hold the document grant. An
 *    absent panel invites no request the server will refuse, and a disabled one would still
 *    disclose that this worker has material on file.
 *  - It never holds a retrieval URL. The link is requested when the operator asks to open the
 *    artifact, so no short-lived credential sits in a rendered page waiting to be scraped.
 *
 * The artifact list is a listing only: no bucket, no storage key, no retrieval capability.
 * Seeing that something exists and opening it are separate authorizations server-side, and
 * this panel keeps them separate on screen as well.
 */

import { useCallback, useState } from "react";
import {
  getOnboardingAdminDocumentDownload,
  getOnboardingAdminWorkerDocuments,
  type OnboardingAdminDocument,
} from "@/lib/workforce/onboardingAdminApi";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "../adminPermissions";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel, OnboardingAdminTimestamp } from "./DetailPanel";

export function OnboardingAdminDocumentsPanel({
  candidateId,
}: {
  candidateId: string;
}) {
  const session = useSession();
  const { canReadDocuments } = useOnboardingAdminPermissions(session);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdminWorkerDocuments(candidateId),
    [candidateId],
    { enabled: canReadDocuments },
  );

  const [openError, setOpenError] = useState<unknown>(null);

  const open = useCallback(async (onboardingDocumentId: string) => {
    setOpenError(null);
    try {
      const download = await getOnboardingAdminDocumentDownload(onboardingDocumentId);
      window.open(download.url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setOpenError(failure);
    }
  }, []);

  if (!canReadDocuments) return null;

  return (
    <OnboardingAdminPanel
      title="Documents"
      description="Governed artifacts recorded against this worker. Opening one is authorized and audited separately from seeing that it exists."
    >
      {loading ? <OnboardingAdminLoading label="Loading documents" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}
      {openError ? <OnboardingAdminErrorNotice error={openError} /> : null}

      {data && data.length === 0 ? (
        <OnboardingAdminEmpty
          title="No document is recorded for this worker."
          detail="Nothing has been captured or generated against a governed document slot."
        />
      ) : null}

      {data && data.length > 0 ? (
        <table className="oba-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Slot</th>
              <th scope="col">Origin</th>
              <th scope="col">Recorded</th>
              <th scope="col">Standing</th>
              <th scope="col">Retrieval</th>
            </tr>
          </thead>
          <tbody>
            {data.map((document) => (
              <OnboardingAdminDocumentRow
                key={document.onboardingDocumentId}
                document={document}
                onOpen={open}
              />
            ))}
          </tbody>
        </table>
      ) : null}
    </OnboardingAdminPanel>
  );
}

function OnboardingAdminDocumentRow({
  document,
  onOpen,
}: {
  document: OnboardingAdminDocument;
  onOpen: (onboardingDocumentId: string) => Promise<void>;
}) {
  const superseded = document.supersededAt !== null;
  const retrievable = document.capturedAt !== null;

  return (
    <tr
      data-document-id={document.onboardingDocumentId}
      data-superseded={superseded ? "true" : "false"}
    >
      <td>
        <span className="oba-module-title">{document.fileName}</span>
        {/*
          The generation binding, shown because it is the whole point of a produced artifact:
          which form, at which revision, under which rules, from which authoritative source.
          The hash is the binding to that source, not the source itself - the structured data
          remains authoritative and is not restated here.
        */}
        {document.generation ? (
          <span className="oba-cell-detail">
            {document.generation.formKey} · form {document.generation.formRevision} · rules{" "}
            {document.generation.ruleRevision} · source {document.generation.sourceKind}:
            {document.generation.sourceRef} · binding{" "}
            {document.generation.sourceHash.slice(0, 12)}
          </span>
        ) : null}
      </td>
      <td className="oba-cell-detail">
        {document.moduleKey} · {document.slotKey}
      </td>
      <td>{document.origin === "GENERATED" ? "Generated" : "Provided by worker"}</td>
      <td>
        <OnboardingAdminTimestamp value={document.capturedAt} />
      </td>
      <td>
        {superseded ? (
          <span className="oba-cell-detail">
            Superseded <OnboardingAdminTimestamp value={document.supersededAt} />
          </span>
        ) : retrievable ? (
          "In effect"
        ) : (
          <span className="oba-field-absent">Never completed</span>
        )}
      </td>
      <td>
        {retrievable ? (
          <button
            type="button"
            className="oba-btn oba-btn-link"
            onClick={() => void onOpen(document.onboardingDocumentId)}
          >
            Open
          </button>
        ) : null}
      </td>
    </tr>
  );
}

export default OnboardingAdminDocumentsPanel;
