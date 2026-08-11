"use client";

/**
 * Phase 5 - the execution evidence panel.
 *
 * A PANEL inside the Phase 2 worker workspace, not an evidence shell. It answers one question:
 * what has this worker executed, against exactly which governed content, and what binds each
 * act. Everything it shows was written once, at the act, by the execution authority; nothing
 * here recomputes, re-derives, or re-verifies any of it.
 *
 * Acts are grouped by governed subject and shown newest first inside each group, because the
 * question an operator arrives with is about a THING the worker executed rather than about a
 * chronology. A superseded act stays on screen beneath the one that replaced it: it is not a
 * mistake to be hidden, it is what happened, and it keeps reporting the older revision.
 *
 * What it deliberately does not do:
 *
 *  - It renders no judgement. There is no accept, no reject, no verify, no qualification.
 *  - It shows no drawing. A signature or a set of initials is protected, and this surface has
 *    no way to reach it: where a subject retained an executed artifact the operator opens THAT
 *    through the existing Phase 4 retrieval, and where a subject retained none the record and
 *    its bindings are the evidence. A row that has no artifact says so rather than offering a
 *    control that would fail.
 *  - It never holds a retrieval URL. The link is requested at the moment the operator asks to
 *    open the artifact, so no short-lived credential sits in a rendered page.
 *  - It renders nothing at all without the grant. An absent panel invites no request the
 *    server will refuse, and a disabled one would still disclose that this worker has
 *    executed something.
 *
 * ON FINGERPRINTS. The content hash and the evidence binding are shown as what they are:
 * values recorded at the act. This surface performs no cryptographic verification of either
 * and is worded so that it cannot be read as having done so.
 */

import { useCallback, useState } from "react";
import {
  getOnboardingAdminDocumentDownload,
  getOnboardingAdminWorkerExecutions,
  type OnboardingAdminExecution,
} from "@/lib/workforce/onboardingAdminApi";
import type { OnboardingExecutionForm } from "@/lib/workforce/onboardingExecutionApi";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "../adminPermissions";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel, OnboardingAdminTimestamp } from "./DetailPanel";

/**
 * How each governed act reads to an operator: the ratified vocabulary, said in English.
 *
 * Keyed by the form union rather than by string, so a fifth form could not be added to the
 * architecture and quietly arrive here unlabelled.
 */
const FORM_LABELS: Record<OnboardingExecutionForm, string> = {
  READ_ACKNOWLEDGEMENT: "Read and acknowledged",
  CHECKBOX_ACKNOWLEDGEMENT: "Affirmed",
  INITIALS: "Initialled",
  ELECTRONIC_SIGNATURE: "Signed electronically",
};

type SubjectGroup = {
  key: string;
  moduleKey: string;
  subjectKey: string;
  title: string;
  acts: OnboardingAdminExecution[];
};

/**
 * Group by governed subject, preserving the server's newest-first order.
 *
 * Grouping only. No act is dropped, none is reordered within its subject, and nothing is
 * derived: a group is a presentation of the same list the server returned.
 */
function groupBySubject(
  executions: readonly OnboardingAdminExecution[],
): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>();
  for (const act of executions) {
    const key = `${act.moduleKey}::${act.subjectKey}`;
    const group = groups.get(key);
    if (group) {
      group.acts.push(act);
      continue;
    }
    groups.set(key, {
      key,
      moduleKey: act.moduleKey,
      subjectKey: act.subjectKey,
      title: act.subjectTitle ?? act.subjectKey,
      acts: [act],
    });
  }
  return [...groups.values()];
}

export function OnboardingExecutionEvidencePanel({
  candidateId,
}: {
  candidateId: string;
}) {
  const session = useSession();
  const { canReadExecutionEvidence } = useOnboardingAdminPermissions(session);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdminWorkerExecutions(candidateId),
    [candidateId],
    { enabled: canReadExecutionEvidence },
  );

  const [openError, setOpenError] = useState<unknown>(null);

  /**
   * The EXISTING Phase 4 retrieval, unchanged. Gate 5G issues no signed URL of its own and
   * adds no second way to reach an artifact's bytes.
   */
  const open = useCallback(async (onboardingDocumentId: string) => {
    setOpenError(null);
    try {
      const download = await getOnboardingAdminDocumentDownload(onboardingDocumentId);
      window.open(download.url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setOpenError(failure);
    }
  }, []);

  if (!canReadExecutionEvidence) return null;

  const groups = data ? groupBySubject(data) : [];

  return (
    <OnboardingAdminPanel
      title="Execution evidence"
      description="What this worker executed, against exactly which governed revision, and what each act recorded. History is kept: an act replaced by a later one stays here, still reporting what it was executed against."
    >
      {loading ? <OnboardingAdminLoading label="Loading execution evidence" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}
      {openError ? <OnboardingAdminErrorNotice error={openError} /> : null}

      {data && data.length === 0 ? (
        <OnboardingAdminEmpty
          title="This worker has executed nothing."
          detail="No governed subject has been acknowledged, affirmed, initialled, or signed."
        />
      ) : null}

      {groups.length > 0 ? (
        <table className="oba-table">
          <thead>
            <tr>
              <th scope="col">Act</th>
              <th scope="col">Executed content</th>
              <th scope="col">Executed</th>
              <th scope="col">Standing</th>
              <th scope="col">Recorded bindings</th>
              <th scope="col">Executed artifact</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key} data-execution-subject={group.key}>
              <tr className="oba-evidence-subject">
                <th scope="colgroup" colSpan={6}>
                  <span className="oba-module-title">{group.title}</span>
                  <span className="oba-cell-detail">
                    {group.moduleKey} · {group.subjectKey}
                  </span>
                </th>
              </tr>
              {group.acts.map((act) => (
                <OnboardingExecutionRow
                  key={act.executionId}
                  execution={act}
                  onOpen={open}
                />
              ))}
            </tbody>
          ))}
        </table>
      ) : null}
    </OnboardingAdminPanel>
  );
}

function OnboardingExecutionRow({
  execution,
  onOpen,
}: {
  execution: OnboardingAdminExecution;
  onOpen: (onboardingDocumentId: string) => Promise<void>;
}) {
  const content = execution.executedContent;
  const sameRules = content.ruleRevision === content.revision;

  return (
    <tr
      data-execution-id={execution.executionId}
      data-execution-current={execution.current ? "true" : "false"}
    >
      <td>
        <span className="oba-module-title">
              {FORM_LABELS[execution.executionForm]}
        </span>
      </td>
      <td>
        <span>{content.ref}</span>
        {/*
          The exact version proof. Revision and rule revision are shown separately because a
          governed layout and the rules that populate it move independently, and an auditor
          asking what was executed needs both.
        */}
        <span className="oba-cell-detail">
          revision {content.revision}
          {sameRules ? null : <> · rules {content.ruleRevision}</>}
        </span>
      </td>
      <td>
        <OnboardingAdminTimestamp value={execution.executedAt} />
      </td>
      <td>
        {execution.current ? (
          <span className="oba-badge oba-badge-executed">In effect</span>
        ) : (
          <>
            <span className="oba-badge oba-badge-superseded">Superseded</span>
            <span className="oba-cell-detail">
              <OnboardingAdminTimestamp value={execution.supersededAt} />
            </span>
          </>
        )}
      </td>
      <td>
        {/*
          Recorded at the act, and reported as recorded. Nothing on this surface re-derives
          either value, so neither is presented as having been checked here.
        */}
        <span className="oba-cell-detail">content {content.contentHash.slice(0, 12)}</span>
        {execution.evidenceHash ? (
          <span className="oba-cell-detail">
            evidence {execution.evidenceHash.slice(0, 12)}
          </span>
        ) : null}
        {execution.evidence ? (
          <span className="oba-cell-detail">
            {execution.evidence.strokeCount} stroke
            {execution.evidence.strokeCount === 1 ? "" : "s"} over{" "}
            {execution.evidence.captureDurationMs} ms
          </span>
        ) : null}
      </td>
      <td>
        {execution.artifactRetained && execution.onboardingDocumentId ? (
          <button
            type="button"
            className="oba-btn oba-btn-link"
            onClick={() => void onOpen(execution.onboardingDocumentId!)}
          >
            Open
          </button>
        ) : (
          <span className="oba-field-absent">No artifact retained</span>
        )}
      </td>
    </tr>
  );
}

export default OnboardingExecutionEvidencePanel;
