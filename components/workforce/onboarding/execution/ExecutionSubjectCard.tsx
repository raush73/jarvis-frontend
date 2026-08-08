"use client";

/**
 * Phase 5 - one execution subject, as the worker sees it.
 *
 * Everything shown comes from the SERVER: the title, the governed wording, the version it is
 * in force at, the act it requires, and what the worker has already done about it. No wording
 * is authored here, so a module that declares a subject in a later phase is presented by this
 * file without changing it.
 *
 * THE ROUND TRIP. The revision, hash, and rule revision rendered above the control are the
 * exact three values sent back with the act. They are read from the subject that produced what
 * is on screen and are never recomputed, re-derived, or refreshed just before submitting -
 * each of which would submit a claim about a display that never happened. The backend
 * re-resolves the governed content independently and refuses if they no longer match.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  OnboardingExecution,
  OnboardingExecutionSubject,
} from "@/lib/workforce/onboardingExecutionApi";
import ExecutionFormControl, { type ExecutionAct } from "./ExecutionFormControl";
import { useReadGate } from "./useReadGate";
import type { ExecutionRefusal } from "./useExecutionSubmission";

type Props = {
  subject: OnboardingExecutionSubject;
  submitting: boolean;
  refusal: ExecutionRefusal | null;
  /** False for a packet that has left the worker's hands: shown, never changed. */
  changeable: boolean;
  /** Resolves true when the subject is now satisfied. */
  onSubmit: (
    subject: OnboardingExecutionSubject,
    act: ExecutionAct,
  ) => Promise<boolean>;
};

/** Plain language for the act a subject requires. Never a code, never an internal name. */
const ACT_DESCRIPTION: Record<string, string> = {
  READ_ACKNOWLEDGEMENT: "Read this and confirm that you have.",
  CHECKBOX_ACKNOWLEDGEMENT: "Read this and tick the box to acknowledge it.",
  INITIALS: "Initial this by drawing your initials.",
  ELECTRONIC_SIGNATURE: "Sign this by drawing your signature.",
};

export function ExecutionSubjectCard({
  subject,
  submitting,
  refusal,
  changeable,
  onSubmit,
}: Props) {
  const content = subject.content;

  /*
    One identity for one piece of governed wording. It drives the read gate and resets any
    part-completed act, so replaced wording is a fresh obligation rather than an amendment to
    one the worker already half-answered.
  */
  const identity = `${content.revision}:${content.contentHash}`;
  const region = useRef<HTMLDivElement | null>(null);

  // Replaced wording starts at its beginning, and must be returned there before the gate
  // measures it. Declared ahead of the gate so the reset lands first.
  useEffect(() => {
    if (region.current) region.current.scrollTop = 0;
  }, [identity]);

  const gate = useReadGate(identity, region);

  const presented = useMemo(
    () => ({
      revision: content.revision,
      contentHash: content.contentHash,
      ruleRevision: content.ruleRevision,
    }),
    [content.revision, content.contentHash, content.ruleRevision],
  );

  const submit = useCallback(
    (act: ExecutionAct) => onSubmit(subject, act),
    [onSubmit, subject],
  );

  const done = Boolean(subject.current) && !subject.requiresExecution;
  const again = Boolean(subject.current) && subject.requiresExecution;
  const gateBlocking =
    subject.requiredForm === "READ_ACKNOWLEDGEMENT" && !gate.satisfied;
  const contentId = `ob-exec-content-${subject.subjectKey}`;
  const reasonId = `ob-exec-reason-${subject.subjectKey}`;

  return (
    <li
      className="wf-card ob-exec-subject"
      data-subject-key={subject.subjectKey}
      data-module-key={subject.moduleKey}
      data-required-form={subject.requiredForm}
      data-requires-execution={subject.requiresExecution ? "true" : "false"}
      data-presented-revision={presented.revision}
    >
      <div className="ob-exec-subject-head">
        <h3 className="wf-section-title">{subject.title}</h3>
        {done ? (
          <span className="ob-exec-badge ob-exec-badge-done">Completed</span>
        ) : again ? (
          <span className="ob-exec-badge">Needs doing again</span>
        ) : (
          <span className="ob-exec-badge">Needed</span>
        )}
      </div>

      <p className="wf-section-note" data-content-version>
        Version {content.revision}
      </p>

      {/*
        Scrollable and focusable so the whole of it can be reached with a keyboard alone. The
        read gate measures this element, and a region a keyboard user could not scroll would
        make the gate unsatisfiable for him.
      */}
      <div
        className="ob-exec-content"
        id={contentId}
        ref={region}
        onScroll={(event) => gate.measure(event.currentTarget)}
        tabIndex={0}
        role="group"
        aria-label={`${content.title}, the wording you are asked to complete`}
      >
        <h4 className="ob-exec-content-title">{content.title}</h4>
        {content.lines.map((line, index) => (
          <p className="ob-exec-line" key={`${identity}:${index}`}>
            {line.label}
            {line.field ? <span className="ob-exec-field">{line.field}</span> : null}
          </p>
        ))}
      </div>

      <p className="wf-hint">{ACT_DESCRIPTION[subject.requiredForm] ?? ""}</p>

      {again ? (
        <p className="wf-section-note" data-reexecution-required>
          This was updated after you completed it. Please complete the current version.
        </p>
      ) : null}

      {refusal ? (
        <p className="wf-field-error" role="alert" data-execution-refusal={refusal.kind}>
          {refusal.message}
        </p>
      ) : null}

      {changeable && subject.requiresExecution ? (
        <>
          {gateBlocking ? (
            <p className="wf-hint" id={reasonId} data-read-gate="BLOCKED">
              Read to the end of this document to continue.
            </p>
          ) : null}
          <ExecutionFormControl
            subject={subject}
            submitting={submitting}
            disabled={!changeable}
            readGateSatisfied={gate.satisfied}
            describedBy={gateBlocking ? reasonId : undefined}
            resetToken={identity}
            onSubmit={submit}
          />
        </>
      ) : null}

      {done ? (
        <p className="wf-empty" data-execution-complete>
          Completed on {formatDate(subject.current?.executedAt ?? null)}.
        </p>
      ) : null}

      {!changeable && subject.requiresExecution ? (
        <p className="wf-empty" data-execution-readonly>
          This is no longer open for changes.
        </p>
      ) : null}

      <ExecutionHistory history={subject.history} />
    </li>
  );
}

/**
 * The worker's own earlier acts.
 *
 * Form, version, and date only. The evidence descriptors the contract also carries - how many
 * strokes a drawing had, how long it took - are an auditor's facts, not a worker's, and Gate
 * 5G owns the surface that reads evidence. Nothing here narrows what was drawn.
 */
function ExecutionHistory({ history }: { history: OnboardingExecution[] }) {
  const earlier = history.filter((act) => act.supersededAt !== null);
  if (earlier.length === 0) return null;

  return (
    <details className="ob-exec-history" data-history-count={earlier.length}>
      <summary>
        {earlier.length} earlier {earlier.length === 1 ? "version" : "versions"} kept on
        your record
      </summary>
      <ul className="ob-exec-history-list">
        {earlier.map((act) => (
          <li key={act.executionId} data-history-execution={act.executionId}>
            Version {act.executedContent.revision} on {formatDate(act.executedAt)}
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "an earlier date";
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "an earlier date";
  return when.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default ExecutionSubjectCard;
