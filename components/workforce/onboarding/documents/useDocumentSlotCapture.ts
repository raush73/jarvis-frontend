"use client";

/**
 * Phase 4 - the worker document capture state machine.
 *
 * One slot's capture, as a hook, so the presentation can be tested apart from the states and
 * a later module can reuse the behaviour without reusing the markup.
 *
 * The states are the GOVERNED ones, not cosmetic ones. In particular:
 *
 *  - `UPLOADING` and `CONFIRMING` are distinct. The bytes leaving the browser and the server
 *    proving the object exists are separate events, and a worker whose upload succeeded but
 *    whose confirmation failed needs to be told the second thing, not the first.
 *  - `AWAITING_CONFIRM` is a real resting state. If confirmation fails the reservation
 *    survives, so the worker can retry the confirmation without re-selecting the file.
 *  - Nothing is marked captured locally. `capturedAt` comes from the server, which sets it
 *    only after storage proved the object is there.
 */

import { useCallback, useState } from "react";
import {
  confirmOnboardingDocument,
  createOnboardingUploadTarget,
  removeOnboardingDocument,
  uploadToStorage,
  type OnboardingDocument,
  type OnboardingDocumentSlot,
  type OnboardingUploadTarget,
} from "@/lib/workforce/onboardingDocumentApi";

export type DocumentCaptureStatus =
  | "IDLE"
  | "SELECTED"
  | "PREPARING"
  | "UPLOADING"
  | "AWAITING_CONFIRM"
  | "CONFIRMING"
  | "CAPTURED"
  | "REMOVING";

export type DocumentCaptureState = {
  status: DocumentCaptureStatus;
  file: File | null;
  /** A client-side check failure. Never the only check: the server re-decides. */
  validationError: string | null;
  /** A refusal or transport failure, rendered through the shared error surface. */
  error: unknown;
  /** The reservation awaiting proof, if one exists. */
  pendingId: string | null;
  captured: OnboardingDocument | null;
};

const IDLE_STATE: DocumentCaptureState = {
  status: "IDLE",
  file: null,
  validationError: null,
  error: null,
  pendingId: null,
  captured: null,
};

/**
 * Client-side pre-checks against what the SLOT declared.
 *
 * Courtesy, not enforcement. The server validates the same things and its answer is the one
 * that counts; this exists so a worker learns a 30 MB photo is too large before spending the
 * upload rather than after.
 */
export function checkAgainstSlot(
  slot: OnboardingDocumentSlot,
  file: File,
): string | null {
  if (!slot.acceptedMimeTypes.includes(file.type)) {
    return `This slot accepts ${describeTypes(slot.acceptedMimeTypes)}.`;
  }
  if (file.size > slot.maxBytes) {
    return `This file is larger than the ${formatBytes(slot.maxBytes)} limit.`;
  }
  if (file.size === 0) {
    return "This file is empty.";
  }
  return null;
}

export function useDocumentSlotCapture(
  invocationId: string,
  slot: OnboardingDocumentSlot,
  onCaptured?: () => void | Promise<void>,
) {
  const [state, setState] = useState<DocumentCaptureState>(IDLE_STATE);

  const select = useCallback(
    (file: File | null) => {
      if (!file) {
        setState(IDLE_STATE);
        return;
      }
      setState({
        ...IDLE_STATE,
        status: "SELECTED",
        file,
        validationError: checkAgainstSlot(slot, file),
      });
    },
    [slot],
  );

  /** Ask the server to verify the object and accept the artifact onto the record. */
  const runConfirm = useCallback(
    async (onboardingDocumentId: string) => {
      try {
        const captured = await confirmOnboardingDocument(
          invocationId,
          onboardingDocumentId,
        );
        setState((prev) => ({
          ...prev,
          status: "CAPTURED",
          error: null,
          pendingId: null,
          captured,
        }));
        await onCaptured?.();
      } catch (error: unknown) {
        setState((prev) => ({ ...prev, status: "AWAITING_CONFIRM", error }));
      }
    },
    [invocationId, onCaptured],
  );

  /**
   * Request authorization, send the bytes to storage, then ask the server to confirm.
   *
   * Sequenced rather than combined so a failure lands on the step that failed. If the upload
   * succeeded and confirmation did not, the reservation is retained and the worker resumes at
   * `AWAITING_CONFIRM` rather than starting over.
   */
  const upload = useCallback(async () => {
    const file = state.file;
    if (!file || state.validationError) return;

    let target: OnboardingUploadTarget;
    setState((prev) => ({ ...prev, status: "PREPARING", error: null }));
    try {
      target = await createOnboardingUploadTarget(invocationId, {
        moduleKey: slot.moduleKey,
        slotKey: slot.slotKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    } catch (error: unknown) {
      setState((prev) => ({ ...prev, status: "SELECTED", error }));
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "UPLOADING",
      pendingId: target.onboardingDocumentId,
    }));
    try {
      await uploadToStorage(target, file);
    } catch (error: unknown) {
      setState((prev) => ({ ...prev, status: "AWAITING_CONFIRM", error }));
      return;
    }

    setState((prev) => ({ ...prev, status: "CONFIRMING", error: null }));
    await runConfirm(target.onboardingDocumentId);
  }, [invocationId, runConfirm, slot, state.file, state.validationError]);

  /** Retry the confirmation alone, against the reservation that already exists. */
  const confirm = useCallback(async () => {
    if (!state.pendingId) return;
    setState((prev) => ({ ...prev, status: "CONFIRMING", error: null }));
    await runConfirm(state.pendingId);
  }, [runConfirm, state.pendingId]);

  /** Retry from the beginning: the same file, a fresh reservation. */
  const retry = useCallback(async () => {
    if (state.pendingId) {
      // Discard the stale reservation first, so a retry does not leave a slot occupied by
      // something the worker abandoned.
      await removeOnboardingDocument(invocationId, state.pendingId).catch(
        () => undefined,
      );
    }
    setState((prev) => ({
      ...prev,
      status: prev.file ? "SELECTED" : "IDLE",
      error: null,
      pendingId: null,
    }));
  }, [invocationId, state.pendingId]);

  /** Remove-before-confirm. Only ever reaches an unconfirmed reservation. */
  const remove = useCallback(async () => {
    if (!state.pendingId) {
      setState(IDLE_STATE);
      return;
    }
    setState((prev) => ({ ...prev, status: "REMOVING", error: null }));
    try {
      await removeOnboardingDocument(invocationId, state.pendingId);
      setState(IDLE_STATE);
      await onCaptured?.();
    } catch (error: unknown) {
      setState((prev) => ({ ...prev, status: "AWAITING_CONFIRM", error }));
    }
  }, [invocationId, onCaptured, state.pendingId]);

  const reset = useCallback(() => setState(IDLE_STATE), []);

  return { state, select, upload, confirm, retry, remove, reset };
}

function describeTypes(types: readonly string[]): string {
  const labels = types.map((type) => {
    if (type === "application/pdf") return "PDF";
    if (type === "image/jpeg") return "JPEG";
    if (type === "image/png") return "PNG";
    return type;
  });
  if (labels.length <= 1) return labels[0] ?? "no file types";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}
