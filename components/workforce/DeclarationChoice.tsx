"use client";

/**
 * A required yes/no declaration.
 *
 * Several Workforce stages are declaration-driven: an unanswered question is
 * deliberately distinct from an answered "no", so the control has three states
 * (null, true, false) and never defaults to an answer on the worker's behalf.
 */
export default function DeclarationChoice({
  name,
  value,
  onChange,
  yesLabel,
  noLabel,
  yesNote,
  noNote,
  disabled = false,
}: {
  name: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel: string;
  noLabel: string;
  yesNote?: string;
  noNote?: string;
  disabled?: boolean;
}) {
  return (
    <div className="wf-choices">
      {[
        { answer: true, label: yesLabel, note: yesNote },
        { answer: false, label: noLabel, note: noNote },
      ].map(({ answer, label, note }) => (
        <label
          key={String(answer)}
          className={`wf-choice ${value === answer ? "is-selected" : ""}`}
        >
          <input
            type="radio"
            name={name}
            checked={value === answer}
            onChange={() => onChange(answer)}
            disabled={disabled}
          />
          <span className="wf-choice-body">
            <span>{label}</span>
            {note ? <span className="wf-choice-note">{note}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
