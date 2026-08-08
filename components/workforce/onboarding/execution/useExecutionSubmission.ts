"use client";

/**
 * Phase 5 - performing one act, and living with the answer.
 *
 * The backend owns every rule about whether an act may be recorded. This hook owns only what
 * the worker is told and what the screen does next, and it is written so that no refusal can
 * be mistaken for a success: the executed state a worker sees always comes from a fresh read
 * of the server, never from an optimistic local guess.
 *
 * Refusal codes are translated here into the worker's own words. A raw code, a raw server
 * message, or an internal name is never rendered, matching the contract the Phase 1 error
 * classifier already holds: messages explain what happened without restating a refusal at the
 * worker and without echoing a value he supplied.
 */

import { useCallback, useRef, useState } from "react";
import { OnboardingApiError } from "@/lib/workforce/onboardingApi";
import { WorkerSessionExpiredError } from "@/lib/workforce/workforceApi";
import {
  EXECUTION_ALREADY_RECORDED_CODE,
  EXECUTION_CONTENT_STALE_CODE,
  EXECUTION_EVIDENCE_INVALID_CODE,
  EXECUTION_SUBJECT_GONE_CODES,
  submitOnboardingExecution,
  type SubmitOnboardingExecutionInput,
} from "@/lib/workforce/onboardingExecutionApi";

/** What the worker is shown, and whether the same attempt is worth repeating. */
export type ExecutionRefusal = {
  kind: "STALE" | "GONE" | "EVIDENCE" | "RETRYABLE";
  message: string;
  /** True when pressing the same control again is a sensible next step. */
  retryable: boolean;
  /** True when the evidence the worker produced is no longer usable. */
  discardEvidence: boolean;
};

const STALE: ExecutionRefusal = {
  kind: "STALE",
  message:
    "This wording was updated while you were reading it. We have loaded the current version - please read it and complete this again.",
  retryable: false,
  discardEvidence: true,
};

const GONE: ExecutionRefusal = {
  kind: "GONE",
  message:
    "This item is no longer part of your onboarding. We have refreshed this section.",
  retryable: false,
  discardEvidence: true,
};

const EVIDENCE: ExecutionRefusal = {
  kind: "EVIDENCE",
  message: "We could not accept that. Please clear it and try again.",
  retryable: false,
  discardEvidence: true,
};

const RETRYABLE: ExecutionRefusal = {
  kind: "RETRYABLE",
  message: "We could not record that just now. Please try again.",
  retryable: true,
  discardEvidence: false,
};

/**
 * Ownership and session refusals belong to the packet, not to one subject.
 *
 * They are handed upward so the section renders them through the runtime's existing error
 * surface, which already knows how to tell a worker his session timed out without losing
 * anything he has done.
 */
function isPacketLevel(error: unknown): boolean {
  if (error instanceof WorkerSessionExpiredError) return true;
  if (!(error instanceof OnboardingApiError)) return false;
  if (error.status === 403 || error.status === 404) return true;
  return (
    error.code === "INVOCATION_NOT_BOUND" || error.code === "PACKET_NOT_ACTIONABLE"
  );
}

function classify(error: unknown): ExecutionRefusal {
  if (!(error instanceof OnboardingApiError)) return RETRYABLE;
  const code = error.code;
  if (code === EXECUTION_CONTENT_STALE_CODE) return STALE;
  if (code && EXECUTION_SUBJECT_GONE_CODES.includes(code)) return GONE;
  if (code === EXECUTION_EVIDENCE_INVALID_CODE) return EVIDENCE;
  // A form mismatch or a malformed payload is this client's own defect. The worker is told
  // something neutral and the section is refreshed rather than left holding a dead control.
  if (error.status === 400) return GONE;
  return RETRYABLE;
}

export type ExecutionSubmissionState = {
  submitting: boolean;
  refusal: ExecutionRefusal | null;
};

export type UseExecutionSubmission = ExecutionSubmissionState & {
  /** Perform the act. Resolves true when the subject is now satisfied. */
  submit: (input: SubmitOnboardingExecutionInput) => Promise<boolean>;
  clearRefusal: () => void;
};

export function useExecutionSubmission(
  invocationId: string,
  /** Re-read authoritative state from the server. */
  onSettled: () => void | Promise<void>,
  /** Hand a packet-level failure to the section's shared error surface. */
  onPacketFailure: (error: unknown) => void,
): UseExecutionSubmission {
  const [state, setState] = useState<ExecutionSubmissionState>({
    submitting: false,
    refusal: null,
  });
  /*
    Single-flight, guarded by a ref rather than by the rendered `disabled` attribute. A double
    click can deliver its second event before React has re-rendered the first one's disabled
    state, and two recorded acts is not a cosmetic defect.
  */
  const inFlight = useRef(false);

  const submit = useCallback(
    async (input: SubmitOnboardingExecutionInput): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setState({ submitting: true, refusal: null });

      try {
        await submitOnboardingExecution(invocationId, input);
        setState({ submitting: false, refusal: null });
        await onSettled();
        return true;
      } catch (error: unknown) {
        // Already recorded is not a failure. The worker's intent is satisfied and the act in
        // force is the answer; showing him an error would invite him to try again for nothing.
        if (
          error instanceof OnboardingApiError &&
          error.code === EXECUTION_ALREADY_RECORDED_CODE
        ) {
          setState({ submitting: false, refusal: null });
          await onSettled();
          return true;
        }

        if (isPacketLevel(error)) {
          setState({ submitting: false, refusal: null });
          onPacketFailure(error);
          return false;
        }

        const refusal = classify(error);
        setState({ submitting: false, refusal });
        // Anything that invalidated what was on screen is followed by a fresh read, so the
        // worker never acts twice against content the server has already moved past.
        if (refusal.kind === "STALE" || refusal.kind === "GONE") await onSettled();
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [invocationId, onSettled, onPacketFailure],
  );

  const clearRefusal = useCallback(() => {
    setState((previous) =>
      previous.refusal ? { ...previous, refusal: null } : previous,
    );
  }, []);

  return { ...state, submit, clearRefusal };
}

export default useExecutionSubmission;
