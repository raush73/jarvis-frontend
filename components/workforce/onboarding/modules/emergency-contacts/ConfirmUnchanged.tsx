"use client";

/**
 * Module 4.7 - confirming that a re-presented record still stands.
 *
 * A worker whose contacts were recorded in an earlier packet is asked about them again rather
 * than asked to type them again. Saying "these are still right" is an AFFIRMATIVE ACT of its
 * own, and it is not the same act as saving: it writes no new version, supersedes nothing, and
 * leaves the effective record exactly where it was, while recording in the audit trail that
 * the worker was asked and answered.
 *
 * It reaches the DELIVERED Phase 0 completion path with `confirmNoChange`. This module adds no
 * confirmation endpoint, and it must never emulate the act by re-saving identical values: that
 * would create a version of a record nobody changed and destroy the very distinction the audit
 * trail is keeping.
 *
 * Offered only where it is meaningful - a recorded profile, with no unsaved edits in front of
 * it - because confirming a set the worker has just altered would confirm something that is
 * not on his record.
 */

type Props = {
  /** The version of the set the worker is being asked to confirm. */
  setVersion: number;
  busy: boolean;
  onConfirm: () => void;
};

export function ConfirmUnchanged({ setVersion, busy, onConfirm }: Props) {
  return (
    <div className="ec-confirm" data-confirm-unchanged-version={setVersion}>
      <p className="ec-confirm-detail">
        If these are still the people we should call, you do not need to change anything.
        Confirm them and we will keep the record you already gave us.
      </p>
      <button
        type="button"
        className="wf-btn wf-btn-primary"
        disabled={busy}
        onClick={onConfirm}
      >
        These are still correct
      </button>
    </div>
  );
}

export default ConfirmUnchanged;
