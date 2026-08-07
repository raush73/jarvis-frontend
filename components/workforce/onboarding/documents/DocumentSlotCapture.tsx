"use client";

/**
 * Phase 4 - one governed document slot, as the worker sees it.
 *
 * Reusable by construction: everything shown comes from the slot the SERVER declared - its
 * title, what it accepts, its size cap, whether it may be replaced - so a module that adds a
 * slot in a later phase gets this presentation without changing this file.
 *
 * It says nothing a worker should not be told. No storage key, no bucket, no permission name,
 * no refusal internals: a refusal renders through the shared error surface in the runtime's
 * own words.
 */

import { useRef } from "react";
import OnboardingErrorNotice from "../runtime/OnboardingErrorNotice";
import type { OnboardingDocumentSlot } from "@/lib/workforce/onboardingDocumentApi";
import {
  formatBytes,
  useDocumentSlotCapture,
} from "./useDocumentSlotCapture";

type Props = {
  invocationId: string;
  slot: OnboardingDocumentSlot;
  /** Refresh the slot listing after a capture or removal changes it. */
  onChanged?: () => void | Promise<void>;
  /** Open the artifact through the authorized retrieval path. */
  onView?: (onboardingDocumentId: string) => void | Promise<void>;
};

export function DocumentSlotCapture({
  invocationId,
  slot,
  onChanged,
  onView,
}: Props) {
  const input = useRef<HTMLInputElement | null>(null);
  const { state, select, upload, confirm, retry, remove, reset } =
    useDocumentSlotCapture(invocationId, slot, onChanged);

  const existing = slot.current;
  const busy =
    state.status === "PREPARING" ||
    state.status === "UPLOADING" ||
    state.status === "CONFIRMING" ||
    state.status === "REMOVING";

  // A generated artifact is produced by Jarvis from the worker's own answers. Offering an
  // upload control for one would invite a worker to supply a file that would be refused.
  const uploadable = slot.origin === "UPLOADED";
  // A filled, non-replaceable slot is finished. Nothing is offered that would be refused.
  const canSupply = uploadable && (slot.replaceable || !existing);

  return (
    <li
      className="wf-card ob-doc-slot"
      data-slot-key={slot.slotKey}
      data-capture-status={state.status}
    >
      <div className="ob-doc-slot-head">
        <h3 className="wf-section-title">{slot.title}</h3>
        {existing ? (
          <span className="ob-doc-badge ob-doc-badge-done">Provided</span>
        ) : (
          <span className="ob-doc-badge">Needed</span>
        )}
      </div>

      {existing ? (
        <p className="wf-section-note" data-current-document>
          {existing.fileName} · {formatBytes(existing.sizeBytes)}
        </p>
      ) : null}

      {existing && onView ? (
        <div className="wf-btn-row">
          <button
            type="button"
            className="wf-btn wf-btn-secondary wf-btn-sm"
            onClick={() => void onView(existing.onboardingDocumentId)}
          >
            View
          </button>
        </div>
      ) : null}

      {slot.history.length > 1 ? (
        /*
          Replaced documents are RETAINED, and saying so plainly matters: a worker who
          replaces a file should not be left wondering whether the earlier one was destroyed.
        */
        <p className="wf-section-note" data-history-count={slot.history.length}>
          {slot.history.length - 1} earlier{" "}
          {slot.history.length === 2 ? "version is" : "versions are"} kept on your record.
        </p>
      ) : null}

      {!uploadable ? (
        <p className="wf-empty">
          This document is prepared for you from the answers you provide.
        </p>
      ) : null}

      {state.error ? (
        <OnboardingErrorNotice
          error={state.error}
          saving
          onRetry={() => void retry()}
        />
      ) : null}

      {state.validationError ? (
        <p className="wf-field-error" role="alert" data-validation-error>
          {state.validationError}
        </p>
      ) : null}

      {canSupply ? (
        <div className="ob-doc-capture">
          <label className="wf-label" htmlFor={`file-${slot.slotKey}`}>
            {existing ? "Replace this document" : "Choose a file"}
          </label>
          <input
            id={`file-${slot.slotKey}`}
            ref={input}
            className="wf-input"
            type="file"
            accept={slot.acceptedMimeTypes.join(",")}
            disabled={busy}
            onChange={(event) => select(event.target.files?.[0] ?? null)}
            aria-describedby={`hint-${slot.slotKey}`}
          />
          <p className="wf-hint" id={`hint-${slot.slotKey}`}>
            Up to {formatBytes(slot.maxBytes)}.
          </p>

          {/*
            One live region per slot. Each governed step is announced, because a worker on a
            phone watching a slow upload has no other way to know which step he is on.
          */}
          <p className="wf-status" role="status" aria-live="polite">
            {statusMessage(state.status, state.file?.name ?? null)}
          </p>

          <div className="wf-btn-row">
            {state.status === "SELECTED" ? (
              <button
                type="button"
                className="wf-btn wf-btn-primary"
                disabled={Boolean(state.validationError)}
                onClick={() => void upload()}
              >
                Upload
              </button>
            ) : null}

            {state.status === "AWAITING_CONFIRM" ? (
              <>
                <button
                  type="button"
                  className="wf-btn wf-btn-primary"
                  onClick={() => void confirm()}
                >
                  Finish upload
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-secondary"
                  onClick={() => void retry()}
                >
                  Start over
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  onClick={() => void remove()}
                >
                  Remove
                </button>
              </>
            ) : null}

            {state.status === "CAPTURED" ? (
              <button
                type="button"
                className="wf-btn wf-btn-ghost wf-btn-sm"
                onClick={() => {
                  if (input.current) input.current.value = "";
                  reset();
                }}
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      ) : uploadable ? (
        <p className="wf-empty" data-slot-locked>
          This document has been provided and does not need to be replaced.
        </p>
      ) : null}
    </li>
  );
}

/** Plain language for each governed step. Never a code, never an internal name. */
function statusMessage(
  status: string,
  fileName: string | null,
): string {
  switch (status) {
    case "SELECTED":
      return fileName ? `${fileName} is ready to upload.` : "";
    case "PREPARING":
      return "Preparing your upload.";
    case "UPLOADING":
      return "Uploading your file.";
    case "AWAITING_CONFIRM":
      return "Your upload needs to be finished.";
    case "CONFIRMING":
      return "Checking your file.";
    case "CAPTURED":
      return "Your document has been received.";
    case "REMOVING":
      return "Removing your file.";
    default:
      return "";
  }
}

export default DocumentSlotCapture;
