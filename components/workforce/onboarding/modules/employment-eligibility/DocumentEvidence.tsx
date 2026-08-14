"use client";

/**
 * Module 4.1 - a picture of the document you are showing us.
 *
 * THIS BUILDS NO UPLOAD SYSTEM. The whole capture is performed by the DELIVERED document
 * foundation through its own state machine: it authorizes an upload, the bytes go straight from
 * the browser to private storage, and the server then CONFIRMS that the object exists before the
 * artifact is accepted. This file supplies presentation and hands the confirmed binding to the
 * module. There is no second uploader here, no storage key, no bucket, and no signed URL.
 *
 * THE ONE DISTINCTION EVERYTHING RESTS ON: an upload is not a capture. Until the server has
 * confirmed the object, there is no governed evidence and this screen says so - a worker whose
 * bytes arrived but whose confirmation failed is told the second thing rather than the first, and
 * he can finish the confirmation without choosing his file again.
 *
 * The file control is a plain native one on purpose: on a phone it offers the camera and the photo
 * library, and on a computer it offers the file picker, without this module owning either.
 */

import { useEffect, useRef } from "react";
import type { OnboardingDocumentSlot } from "@/lib/workforce/onboardingDocumentApi";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import {
  formatBytes,
  useDocumentSlotCapture,
} from "@/components/workforce/onboarding/documents/useDocumentSlotCapture";

type Props = {
  invocationId: string;
  /** The module's own governed capture target, exactly as the server declared it. */
  slot: OnboardingDocumentSlot;
  /** Which document this capture belongs to, for control identity and for the tests. */
  documentTypeKey: string;
  /** What the worker is being asked to photograph, in the catalogue's own words. */
  prompt: string;
  /** False while the worker's answers are not complete enough to bind evidence to. */
  ready: boolean;
  /** True when the SERVER's record says confirmed evidence is bound to this document. */
  recorded: boolean;
  /** True when a recorded document must be captured again before it can be saved. */
  recaptureRequired: boolean;
  /** Hand the module the CONFIRMED binding. Called once per confirmed artifact. */
  onConfirmed: (onboardingDocumentId: string) => void;
  disabled?: boolean;
};

export function DocumentEvidence({
  invocationId,
  slot,
  documentTypeKey,
  prompt,
  ready,
  recorded,
  recaptureRequired,
  onConfirmed,
  disabled = false,
}: Props) {
  const input = useRef<HTMLInputElement | null>(null);
  const { state, select, upload, confirm, retry, remove, reset } = useDocumentSlotCapture(
    invocationId,
    slot,
  );

  /**
   * The confirmed binding reaches the module from HERE, once.
   *
   * Read from the capture state after the server confirmed it rather than from the upload that
   * preceded it, and guarded by what has already been handed over, so a re-render cannot present
   * the same artifact twice.
   */
  const handed = useRef<string | null>(null);
  const capturedId = state.captured?.onboardingDocumentId ?? null;
  useEffect(() => {
    if (!capturedId || handed.current === capturedId) return;
    handed.current = capturedId;
    onConfirmed(capturedId);
  }, [capturedId, onConfirmed]);

  const working =
    state.status === "PREPARING" ||
    state.status === "UPLOADING" ||
    state.status === "CONFIRMING" ||
    state.status === "REMOVING";
  const busy = disabled || working;
  const fieldId = `ee-evidence-${documentTypeKey}`;

  return (
    <div
      className="ee-evidence"
      data-ee-evidence={documentTypeKey}
      data-ee-capture-status={state.status}
    >
      <h4 className="ee-evidence-title">A picture of this document</h4>

      {recorded && !recaptureRequired ? (
        <p className="ee-note" role="status" data-ee-evidence-recorded>
          We have your picture of this document.
        </p>
      ) : null}

      {recaptureRequired ? (
        <p className="ee-note" data-ee-recapture-required>
          Because you are changing this document, we need a new picture of it before we can save
          it.
        </p>
      ) : null}

      {!ready ? (
        <p className="wf-empty" data-ee-evidence-blocked>
          Finish the details above and then you can add a picture of it.
        </p>
      ) : null}

      {state.error ? (
        <OnboardingErrorNotice error={state.error} saving onRetry={() => void retry()} />
      ) : null}

      {state.validationError ? (
        <p className="wf-field-error" role="alert" data-ee-evidence-invalid>
          {state.validationError}
        </p>
      ) : null}

      {ready ? (
        <div className="ee-capture">
          <label className="wf-label" htmlFor={fieldId}>
            {prompt}
          </label>
          <input
            id={fieldId}
            ref={input}
            className="wf-input"
            type="file"
            accept={slot.acceptedMimeTypes.join(",")}
            disabled={busy}
            onChange={(event) => select(event.target.files?.[0] ?? null)}
            aria-describedby={`${fieldId}-hint`}
          />
          <p className="wf-hint" id={`${fieldId}-hint`}>
            Take a photo or choose a file, up to {formatBytes(slot.maxBytes)}. Make sure the whole
            document is in the picture and the writing can be read. MW4H will look at it.
          </p>

          {/* One live region per document. A worker on a phone watching a slow upload has no
              other way to know which step he is on. */}
          <p className="wf-status" role="status" aria-live="polite">
            {statusMessage(state.status, state.file?.name ?? null)}
          </p>

          <div className="wf-btn-row">
            {state.status === "SELECTED" ? (
              <button
                type="button"
                className="wf-btn wf-btn-primary"
                disabled={Boolean(state.validationError) || busy}
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
                  disabled={busy}
                  onClick={() => void confirm()}
                >
                  Finish upload
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-secondary"
                  disabled={busy}
                  onClick={() => void retry()}
                >
                  Start over
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  disabled={busy}
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
                  handed.current = null;
                  reset();
                }}
                data-ee-capture-again
              >
                Use a different picture
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Plain language for each governed step. Never a code, never an internal name. */
function statusMessage(status: string, fileName: string | null): string {
  switch (status) {
    case "SELECTED":
      return fileName ? `${fileName} is ready to upload.` : "";
    case "PREPARING":
      return "Getting ready to upload.";
    case "UPLOADING":
      return "Uploading your picture.";
    case "AWAITING_CONFIRM":
      return "Your upload is not finished yet.";
    case "CONFIRMING":
      return "Checking your picture.";
    case "CAPTURED":
      return "We have your picture.";
    case "REMOVING":
      return "Removing your picture.";
    default:
      return "";
  }
}

export default DocumentEvidence;
