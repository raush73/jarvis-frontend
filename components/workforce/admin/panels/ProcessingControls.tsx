"use client";

/**
 * Phase 2 - reusable processing controls.
 *
 * The uniform way an administrative decision is taken, whichever module contributed it.
 * Verify, certify, record processing, return to worker, raise an exception, resolve an
 * exception: each of those is a module-declared ACTION, so this component renders whatever the
 * server advertised rather than a fixed list of buttons. That is what lets a later module phase
 * add a decision to this workspace without changing this file.
 *
 * Four rules hold for every control here:
 *
 *  - IT DOES NOT RENDER WITHOUT THE GRANT. The server advertises only the actions this operator
 *    holds an explicit grant for, so an unpermitted control is absent rather than disabled.
 *  - IT REQUIRES EXPLICIT CONFIRMATION. Nothing is decided by a single click.
 *  - IT REQUIRES A REASON WHEN THE ACTION DECLARES ONE. Enforced here for the operator's sake
 *    and again server-side, which is where it counts.
 *  - IT IS AUDITED SERVER-SIDE. This component never claims the audit; it reports the outcome
 *    the server returned after recording it.
 */

import { useState } from "react";
import type {
  OnboardingAdminAction,
  OnboardingAdminActionResult,
} from "@/lib/workforce/onboardingAdminApi";
import { executeOnboardingAdminAction } from "@/lib/workforce/onboardingAdminApi";
import { OnboardingAdminErrorNotice } from "../OnboardingAdminNotice";

export function OnboardingAdminProcessingControls({
  actions,
  candidateId,
  packetId,
  onExecuted,
}: {
  /** Already permission-scoped by the server. */
  actions: readonly OnboardingAdminAction[];
  candidateId: string;
  /** Null when the queue row carries no packet: an action always names one. */
  packetId: string | null;
  onExecuted?: (result: OnboardingAdminActionResult) => void;
}) {
  const [pending, setPending] = useState<OnboardingAdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<OnboardingAdminActionResult | null>(null);

  if (actions.length === 0) return null;

  const close = () => {
    setPending(null);
    setReason("");
    setError(null);
  };

  const execute = async (action: OnboardingAdminAction) => {
    if (!packetId) return;
    setBusy(true);
    setError(null);
    try {
      const executed = await executeOnboardingAdminAction(action.actionKey, {
        candidateId,
        packetId,
        reason: reason.trim() ? reason.trim() : null,
      });
      setResult(executed);
      close();
      onExecuted?.(executed);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oba-processing">
      {result ? (
        <p className="oba-processing-result" role="status">
          {result.actionKey.replace(/_/g, " ")} recorded as {result.outcome}
          {result.detail ? ` — ${result.detail}` : ""}
        </p>
      ) : null}

      {pending ? (
        <div className="oba-confirm">
          <p className="oba-confirm-title">
            {pending.title}
            {pending.governanceSection ? (
              <span className="oba-confirm-governance"> ({pending.governanceSection})</span>
            ) : null}
          </p>
          <p className="oba-confirm-detail">
            This decision is recorded against your name, with its outcome and the time it was
            taken. Declared outcomes: {pending.outcomes.join(", ")}.
          </p>
          {pending.requiresReason ? (
            <>
              <label className="oba-label" htmlFor="oba-action-reason">
                Reason (required)
              </label>
              <input
                id="oba-action-reason"
                className="oba-input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why this decision is being taken"
              />
            </>
          ) : null}
          <div className="oba-confirm-controls">
            <button
              type="button"
              className="oba-btn oba-btn-primary"
              disabled={
                busy || !packetId || (pending.requiresReason && reason.trim().length === 0)
              }
              onClick={() => void execute(pending)}
            >
              {busy ? "Recording…" : "Confirm"}
            </button>
            <button type="button" className="oba-btn oba-btn-quiet" onClick={close}>
              Cancel
            </button>
          </div>
          {error ? <OnboardingAdminErrorNotice error={error} /> : null}
        </div>
      ) : (
        <div className="oba-processing-buttons">
          {actions.map((action) => (
            <button
              key={action.actionKey}
              type="button"
              className="oba-btn"
              disabled={!packetId}
              title={packetId ? undefined : "This row carries no packet to act against"}
              onClick={() => {
                setResult(null);
                setPending(action);
              }}
            >
              {action.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
