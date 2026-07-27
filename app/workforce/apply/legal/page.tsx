"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import {
  type AcknowledgmentView,
  WorkforceApiError,
  acceptAcknowledgments,
  getLegal,
} from "@/lib/workforce/workforceApi";

/**
 * Legal Acknowledgments screen (backend LEGAL_ACKNOWLEDGEMENTS stage).
 *
 * The exact text and version presented here come from the backend catalog, and the
 * backend records that exact text with an acceptance timestamp - so the submitted
 * application proves precisely what the worker agreed to. Nothing is worded locally.
 */
export default function LegalPage() {
  const [items, setItems] = useState<AcknowledgmentView[]>([]);
  const [acceptedKeys, setAcceptedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const stage = await getLegal();
        if (cancelled) return;
        setItems(stage.acknowledgments);
        setAcceptedKeys(
          stage.acknowledgments.filter((a) => a.accepted).map((a) => a.key),
        );
      } catch {
        // Save-time errors are surfaced by the shell.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((key: string) => {
    setAcceptedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const onSave = useCallback(async () => {
    const missing = items.filter((a) => !acceptedKeys.includes(a.key));
    if (missing.length > 0) {
      throw new WorkforceApiError(
        "You must accept every acknowledgment to continue.",
        400,
      );
    }
    await acceptAcknowledgments(acceptedKeys);
  }, [acceptedKeys, items]);

  return (
    <WorkforceWizardShell
      slug="legal"
      loading={loading}
      onSave={onSave}
      intro="Please read each statement and confirm your agreement. All are required."
    >
      {items.length === 0 ? (
        <p className="wf-empty">No acknowledgments are required at this time.</p>
      ) : (
        <div className="wf-choices">
          {items.map((item) => (
            <label
              key={item.key}
              className={`wf-choice ${
                acceptedKeys.includes(item.key) ? "is-selected" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={acceptedKeys.includes(item.key)}
                onChange={() => toggle(item.key)}
              />
              <span className="wf-choice-body">
                <span>{item.text}</span>
                {item.acceptedAt ? (
                  <span className="wf-choice-note">
                    Accepted {new Date(item.acceptedAt).toLocaleString()}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </WorkforceWizardShell>
  );
}
