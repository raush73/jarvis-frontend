"use client";

/**
 * Phase 2 - masked field display with an authorized reveal affordance.
 *
 * The reveal rules of architecture Section 4.1.6, rendered:
 *
 *  - MASKED IS THE DEFAULT. The masked value is what the server sent; this component has no
 *    access to a full value and cannot construct one.
 *  - THE AFFORDANCE IS ABSENT WITHOUT THE GRANT. An operator who does not hold the sensitive
 *    grant sees the masked value and nothing else - no greyed-out button, because a disabled
 *    reveal button still advertises that the value is there for the asking.
 *  - REVEAL IS DELIBERATE. It takes a stated business purpose and an explicit confirmation. A
 *    disclosure cannot happen as a side effect of opening a screen.
 *  - REVEAL IS AUDITED, AND NOT BY THIS COMPONENT. The disclosure goes through the server's
 *    audited path, which records it twice - once in the secure-identity trail and once in the
 *    onboarding trail - and refuses if it cannot.
 *  - THE DISCLOSURE IS NOT KEPT. It is held in component state for this operator's view and is
 *    dropped as soon as he hides it or leaves; it is never written anywhere.
 */

import { useState } from "react";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "../adminPermissions";
import { OnboardingAdminErrorNotice } from "../OnboardingAdminNotice";

export function OnboardingAdminMaskedValue({
  label,
  maskedValue,
  hasValue,
  onReveal,
  revealLabel = "Reveal full value",
  canReveal,
}: {
  label: string;
  maskedValue: string | null;
  /** Whether a full value exists to be revealed at all. */
  hasValue: boolean;
  /** The audited server path. Given the operator's stated purpose. */
  onReveal: (purpose: string) => Promise<string>;
  revealLabel?: string;
  /**
   * Whether this operator holds the sensitive grant for THIS value.
   *
   * Supplied by a caller whose protected value is guarded by a different sensitive grant than the
   * delivered one. Omitting it keeps the original behaviour exactly - the workspace's own grant -
   * so nothing that already used this control changed.
   *
   * A caller supplying it MUST decide from EFFECTIVE grants rather than from role membership, for
   * the same reason the default does: `SensitiveDataGuard` treats no role as a bypass, and a
   * control that offered the disclosure to an administrator who lacks the grant would be
   * advertising something the server refuses.
   */
  canReveal?: boolean;
}) {
  const session = useSession();
  const { canRevealSensitiveValues } = useOnboardingAdminPermissions(session);
  const mayReveal = canReveal ?? canRevealSensitiveValues;

  const [asking, setAsking] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const close = () => {
    setAsking(false);
    setPurpose("");
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await onReveal(purpose);
      setRevealed(value);
      setAsking(false);
      setPurpose("");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oba-masked">
      <span className="oba-masked-label">{label}</span>
      <span className="oba-masked-value">
        {revealed ?? maskedValue ?? (
          <span className="oba-field-absent">
            {hasValue ? "On file" : "Not on file"}
          </span>
        )}
      </span>

      {revealed ? (
        <button
          type="button"
          className="oba-btn oba-btn-quiet"
          onClick={() => setRevealed(null)}
        >
          Hide
        </button>
      ) : hasValue && mayReveal && !asking ? (
        <button type="button" className="oba-btn oba-btn-quiet" onClick={() => setAsking(true)}>
          {revealLabel}
        </button>
      ) : null}

      {asking ? (
        <div className="oba-reveal">
          <p className="oba-reveal-warning">
            Revealing a full value is recorded against your name, with the worker it concerned
            and the time you asked. State the business purpose.
          </p>
          <label className="oba-label" htmlFor="oba-reveal-purpose">
            Business purpose
          </label>
          <input
            id="oba-reveal-purpose"
            className="oba-input"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="Why this disclosure is necessary"
          />
          <div className="oba-reveal-controls">
            <button
              type="button"
              className="oba-btn oba-btn-primary"
              disabled={busy || purpose.trim().length === 0}
              onClick={() => void submit()}
            >
              {busy ? "Revealing…" : "Confirm and reveal"}
            </button>
            <button type="button" className="oba-btn oba-btn-quiet" onClick={close}>
              Cancel
            </button>
          </div>
          {error ? <OnboardingAdminErrorNotice error={error} /> : null}
        </div>
      ) : null}
    </div>
  );
}
