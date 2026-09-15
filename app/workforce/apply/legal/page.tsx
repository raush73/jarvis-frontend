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
 *
 * TWO KINDS OF STATEMENT NOW SHARE THIS SCREEN (owner ruling 2026-09-15), and the split is
 * the server's rather than this file's: each acknowledgment declares whether it is
 * `required`, and the optional text-message consent is shown apart from the certifications
 * so that a genuine choice does not read as one more thing being demanded of him.
 */
export default function LegalPage() {
  const [items, setItems] = useState<AcknowledgmentView[]>([]);
  const [acceptedKeys, setAcceptedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageError, setStageError] = useState<unknown>(null);

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
      } catch (err) {
        if (!cancelled) setStageError(err);
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
    // REQUIRED ONLY. An optional acknowledgment left unchecked is an answer, so refusing to
    // save on it would make the choice a demand and contradict the wording he just read.
    const missing = items.filter(
      (a) => a.required && !acceptedKeys.includes(a.key),
    );
    if (missing.length > 0) {
      throw new WorkforceApiError(
        "You must accept every required acknowledgment to continue.",
        400,
      );
    }
    await acceptAcknowledgments(acceptedKeys);
  }, [acceptedKeys, items]);

  const required = items.filter((item) => item.required);
  const optional = items.filter((item) => !item.required);

  const choice = (item: AcknowledgmentView) => (
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
        aria-describedby={item.links.length > 0 ? `${item.key}-docs` : undefined}
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
  );

  return (
    <WorkforceWizardShell
      slug="legal"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro={
        optional.length > 0
          ? "Please read each statement and confirm your agreement. The statements under Required are needed to continue. The text message choice below them is optional."
          : "Please read each statement and confirm your agreement. All are required."
      }
    >
      {required.length === 0 ? (
        <p className="wf-empty">No acknowledgments are required at this time.</p>
      ) : (
        <div className="wf-section">
          <h2 className="wf-section-title">Required</h2>
          <div className="wf-choices">{required.map(choice)}</div>
        </div>
      )}

      {optional.map((item) => (
        <div className="wf-section" key={item.key}>
          <h2 className="wf-section-title">Text messages (optional)</h2>
          <p className="wf-section-note">
            This one is your choice. Leaving it unchecked will not affect your
            application in any way.
          </p>
          <div className="wf-choices">{choice(item)}</div>
          {item.links.length > 0 ? (
            /*
              THE DOCUMENTS SIT OUTSIDE THE LABEL, DELIBERATELY. A `<label>` activates its
              control when any child is clicked, so an anchor placed inside this one would
              toggle his consent on the way to reading the policy - the opposite of informed.
              They are associated with the checkbox by `aria-describedby` instead, which is
              what a screen reader announces and what a mouse cannot accidentally trip.
            */
            <p className="wf-section-note" id={`${item.key}-docs`}>
              {item.links.map((link, index) => (
                <span key={link.href}>
                  {index > 0 ? " | " : null}
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ))}
    </WorkforceWizardShell>
  );
}
