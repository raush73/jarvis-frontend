"use client";

/**
 * Phase 5 - the execution section of a packet.
 *
 * Renders whatever execution subjects the SERVER declared for this packet, and renders NOTHING
 * when there are none. That is the expected state in this phase, which ships the foundation and
 * zero business modules: an empty section must be invisible rather than an empty heading
 * suggesting the worker has something outstanding.
 *
 * It is the sibling of the Phase 4 document section, and deliberately not merged with it. Both
 * involve capture; they answer to different authorities. A document is an artifact governed by
 * Phase 4 and the enterprise Document authority; an execution is an immutable act bound to the
 * exact governed content it was performed against.
 *
 * It holds no list of subjects, no subject names, and no per-module special case, so a module
 * that declares a subject in a later phase appears here without this file changing.
 *
 * It creates NO completion authority. Packet and module completion remain the server's
 * derivation, read by the Phase 1 runtime; nothing here reports, refreshes, or infers it.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getOnboardingExecutionSubjects,
  type OnboardingExecutionSubject,
} from "@/lib/workforce/onboardingExecutionApi";
import OnboardingErrorNotice from "../runtime/OnboardingErrorNotice";
import ExecutionSubjectCard from "./ExecutionSubjectCard";
import type { ExecutionAct } from "./ExecutionFormControl";
import { useExecutionSubmission } from "./useExecutionSubmission";

type Props = {
  invocationId: string;
  /** False for a packet that has left the worker's hands: shown, never changed. */
  changeable?: boolean;
};

function keyOf(subject: OnboardingExecutionSubject): string {
  return `${subject.moduleKey}:${subject.subjectKey}`;
}

export function OnboardingExecutionCapture({
  invocationId,
  changeable = true,
}: Props) {
  const [subjects, setSubjects] = useState<OnboardingExecutionSubject[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  /** Bumped to ask for the subjects again after an act changes one. */
  const [reloads, setReloads] = useState(0);
  /** The subject with a request in flight. One at a time, but never freezing the others. */
  const [pending, setPending] = useState<string | null>(null);
  /** The subject a refusal belongs to. Outlives the request, so the answer stays on screen. */
  const [refused, setRefused] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setReloads((count) => count + 1);
  }, []);

  const onPacketFailure = useCallback((failure: unknown) => {
    setError(failure);
  }, []);

  const { submitting, refusal, submit, clearRefusal } = useExecutionSubmission(
    invocationId,
    reload,
    onPacketFailure,
  );

  useEffect(() => {
    // `live` guards a response that arrives after the packet changed, which would otherwise
    // show one packet's subjects under another's heading.
    let live = true;
    getOnboardingExecutionSubjects(invocationId)
      .then((value) => {
        if (!live) return;
        setSubjects(value);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (live) setError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads]);

  const perform = useCallback(
    (subject: OnboardingExecutionSubject, act: ExecutionAct): Promise<boolean> => {
      const key = keyOf(subject);
      setPending(key);
      setRefused(key);
      clearRefusal();
      return submit({
        moduleKey: subject.moduleKey,
        subjectKey: subject.subjectKey,
        // Copied from the subject, never from what the worker did. The governed subject
        // determines the act; naming it here can only fail, never define.
        performedForm: subject.requiredForm,
        presented: {
          revision: subject.content.revision,
          contentHash: subject.content.contentHash,
          ruleRevision: subject.content.ruleRevision,
        },
        ...(act.kind === "ATTESTATION"
          ? { acknowledged: true as const }
          : { capture: act.capture }),
      }).finally(() => setPending(null));
    },
    [submit, clearRefusal],
  );

  if (error) {
    return <OnboardingErrorNotice error={error} onRetry={() => void reload()} />;
  }

  // Nothing at all until the server has spoken, and nothing ever if it declared no subjects.
  if (!subjects || subjects.length === 0) return null;

  return (
    <section className="ob-exec-section" aria-labelledby="ob-exec-heading">
      <h2 className="wf-section-title" id="ob-exec-heading">
        What you need to sign and acknowledge
      </h2>
      <ul className="ob-exec-list">
        {subjects.map((subject) => {
          const key = keyOf(subject);
          return (
            <ExecutionSubjectCard
              key={key}
              subject={subject}
              submitting={submitting && pending === key}
              refusal={refused === key ? refusal : null}
              changeable={changeable}
              onSubmit={perform}
            />
          );
        })}
      </ul>
    </section>
  );
}

export default OnboardingExecutionCapture;
