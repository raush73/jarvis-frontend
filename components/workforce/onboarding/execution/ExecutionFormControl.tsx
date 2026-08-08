"use client";

/**
 * Phase 5 - the control for whatever act a subject requires.
 *
 * The required form is a property of the governed subject (architecture 4.6.9). It arrives on
 * the subject, this file renders it, and nothing here lets a worker choose it, change it, or
 * reach it by doing something else: `performedForm` is copied from `requiredForm` and is never
 * derived from what the worker actually did. A signature is not satisfied by a checkbox, in
 * either direction, and the backend refuses independently if this file ever gets that wrong.
 *
 * FAIL CLOSED. A form outside the four governed ones renders no control at all. The tempting
 * alternative - fall back to an acknowledgement - would let an unrecognised requirement be
 * satisfied by the weakest available act, which is the exact substitution the phase exists to
 * prevent.
 */

import { useState } from "react";
import {
  isOnboardingExecutionForm,
  requiresNativeCapture,
  type OnboardingExecutionCapture,
  type OnboardingExecutionSubject,
} from "@/lib/workforce/onboardingExecutionApi";
import ExecutionCaptureSurface from "./ExecutionCaptureSurface";

/** What the worker did. Shaped so an attestation can never carry a drawing, or the reverse. */
export type ExecutionAct =
  | { kind: "ATTESTATION" }
  | { kind: "CAPTURE"; capture: OnboardingExecutionCapture };

type Props = {
  subject: OnboardingExecutionSubject;
  /** A request is in flight for this subject. */
  submitting: boolean;
  /** The packet has left the worker's hands: shown, never written to. */
  disabled: boolean;
  /**
   * The governed content has been read to its end. Meaningful for READ_ACKNOWLEDGEMENT only;
   * the other three forms ignore it entirely.
   */
  readGateSatisfied: boolean;
  /** Element describing why the control is unavailable, for `aria-describedby`. */
  describedBy?: string;
  /** Changes when the governed content changes, which resets any part-completed act. */
  resetToken: string;
  /** Resolves true when the subject is now satisfied. */
  onSubmit: (act: ExecutionAct) => Promise<boolean>;
};

export function ExecutionFormControl({
  subject,
  submitting,
  disabled,
  readGateSatisfied,
  describedBy,
  resetToken,
  onSubmit,
}: Props) {
  const form = subject.requiredForm;

  if (!isOnboardingExecutionForm(form)) {
    return (
      <p className="wf-empty" data-execution-form="UNKNOWN">
        This item cannot be completed here yet.
      </p>
    );
  }

  /*
    `key` is load-bearing, not cosmetic. Replaced wording is a fresh obligation, so the control
    is REMOUNTED rather than reset: a tick or a drawing produced against the previous revision
    cannot survive into the new one, because the component holding it no longer exists.
  */
  if (requiresNativeCapture(form)) {
    return (
      <ExecutionCaptureSurface
        key={resetToken}
        form={form}
        subjectKey={subject.subjectKey}
        submitting={submitting}
        disabled={disabled}
        onSubmit={(capture) => onSubmit({ kind: "CAPTURE", capture })}
      />
    );
  }

  return (
    <AttestationControl
      key={resetToken}
      form={form}
      subjectKey={subject.subjectKey}
      submitting={submitting}
      disabled={disabled}
      readGateSatisfied={readGateSatisfied}
      describedBy={describedBy}
      onSubmit={() => void onSubmit({ kind: "ATTESTATION" })}
    />
  );
}

/**
 * The two acts whose evidence IS the act.
 *
 * Neither is ever pre-checked, defaulted, or completed by anything other than a deliberate
 * interaction, and neither submits until the worker has performed it.
 */
function AttestationControl({
  form,
  subjectKey,
  submitting,
  disabled,
  readGateSatisfied,
  describedBy,
  onSubmit,
}: {
  form: "READ_ACKNOWLEDGEMENT" | "CHECKBOX_ACKNOWLEDGEMENT";
  subjectKey: string;
  submitting: boolean;
  disabled: boolean;
  readGateSatisfied: boolean;
  describedBy?: string;
  onSubmit: () => void;
}) {
  const [checked, setChecked] = useState(false);

  if (form === "READ_ACKNOWLEDGEMENT") {
    const blocked = !readGateSatisfied;
    return (
      <div className="ob-exec-act" data-execution-form={form}>
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          data-execution-submit
          disabled={disabled || submitting || blocked}
          aria-describedby={describedBy}
          onClick={onSubmit}
        >
          {submitting ? "Recording." : "I have read this"}
        </button>
      </div>
    );
  }

  const inputId = `ob-exec-check-${subjectKey}`;
  return (
    <div className="ob-exec-act" data-execution-form={form}>
      <label className="wf-option ob-exec-check" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled || submitting}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>I acknowledge the statement above.</span>
      </label>
      <div className="wf-btn-row">
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          data-execution-submit
          disabled={disabled || submitting || !checked}
          onClick={onSubmit}
        >
          {submitting ? "Recording." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

export default ExecutionFormControl;
