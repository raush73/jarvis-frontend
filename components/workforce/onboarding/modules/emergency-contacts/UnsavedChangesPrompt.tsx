"use client";

/**
 * Module 4.7 - the decision a worker is given when he tries to leave unsaved edits behind.
 *
 * This module's values are committed by an explicit act (owner decision 6-5), which means they
 * are NOT autosaved on the way out the way a drafted module's answers are. Leaving would
 * therefore discard them silently, and silently is the one thing it must not be. So the
 * runtime's leave guard holds the navigation the worker asked for and this component asks him
 * the only three questions that exist: save it, throw it away, or stay.
 *
 * It is a dialog, and an accessible one: labelled, described, focus moved into it on open,
 * dismissible with Escape, and with Cancel as the safe default that the keyboard lands on. A
 * prompt about losing work that a keyboard user could not reach would be a prompt that lost the
 * work.
 *
 * It decides nothing. Every branch is handed back to the module, which owns what saving,
 * discarding, and staying mean for its own state.
 */

import { useEffect, useRef } from "react";

type Props = {
  /** True while the module's own Save is in flight. */
  saving: boolean;
  onSaveAndLeave: () => void;
  onDiscardAndLeave: () => void;
  onCancel: () => void;
};

export function UnsavedChangesPrompt({
  saving,
  onSaveAndLeave,
  onDiscardAndLeave,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Focus lands on the option that cannot lose anything.
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="ec-prompt-scrim" data-unsaved-prompt="EMERGENCY_CONTACT">
      <div
        className="wf-card ec-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-prompt-title"
        aria-describedby="ec-prompt-detail"
      >
        <h3 className="wf-section-title" id="ec-prompt-title">
          You have not saved your emergency contacts
        </h3>
        <p id="ec-prompt-detail">
          The changes you have made are still on this screen only. If you leave without
          saving, they will be lost.
        </p>
        <div className="wf-btn-row ec-prompt-actions">
          <button
            type="button"
            className="wf-btn wf-btn-primary"
            disabled={saving}
            onClick={onSaveAndLeave}
          >
            {saving ? "Saving." : "Save and leave"}
          </button>
          <button
            type="button"
            className="wf-btn wf-btn-secondary"
            disabled={saving}
            onClick={onDiscardAndLeave}
          >
            Leave without saving
          </button>
          <button
            type="button"
            className="wf-btn wf-btn-ghost"
            ref={cancelRef}
            disabled={saving}
            onClick={onCancel}
          >
            Stay on this page
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedChangesPrompt;
