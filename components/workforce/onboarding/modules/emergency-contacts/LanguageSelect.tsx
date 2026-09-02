"use client";

/**
 * Module 4.7 - the preferred-language control.
 *
 * A worker should not have to spell a language to tell us how to speak to the person he named,
 * so the common ones are offered as a list. The list is a CONVENIENCE AND NOT A VOCABULARY, and
 * the difference matters:
 *
 *  - `preferredLanguage` is, and stays, a free STRING on the record. There is no governed
 *    closed set for it, no enum, and no database constraint - so this control must never behave
 *    as though there were one.
 *  - "Other" is therefore not an escape hatch bolted on: it is the honest statement that the
 *    list is short and the world is not. Choosing it gives the worker the text box back.
 *  - A value already on the record that is not in the list - one typed before the list existed,
 *    or a language it does not name - RENDERS AS ITSELF and saves again unchanged. Nothing here
 *    rewrites, normalizes or discards a value a worker previously gave us.
 *
 * The component holds one thing only: whether the worker is currently typing his own answer.
 * The value itself lives where every other contact value lives - in the module's state, until
 * the module's own explicit Save commits the whole set.
 */

import { useState } from "react";

/**
 * The languages offered, in the ratified order, with "Other" last.
 *
 * PRESENTATION, and the stored value is the label itself, because the label IS the answer: the
 * field records what language a person prefers, in words, and there is no governed code for it
 * to be translated into.
 */
export const EMERGENCY_CONTACT_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Haitian Creole",
  "Portuguese",
  "Chinese",
  "Vietnamese",
  "Arabic",
  "Korean",
  "Russian",
] as const;

/** The list's own term for "not in this list". Never stored: it is a choice, not an answer. */
export const EMERGENCY_CONTACT_LANGUAGE_OTHER = "OTHER";

/**
 * The offered language a stored value already says, or null when the list does not name it.
 *
 * Compared without case or surrounding space so a record holding "spanish" is recognised, and
 * the recognition is used only to decide WHICH OPTION TO SHOW AS CHOSEN. The stored value is
 * left exactly as the worker gave it unless he changes it himself.
 */
export function matchOfferedLanguage(value: string): string | null {
  const wanted = value.trim().toLowerCase();
  if (wanted.length === 0) return null;
  return (
    EMERGENCY_CONTACT_LANGUAGES.find(
      (language) => language.toLowerCase() === wanted,
    ) ?? null
  );
}

export function LanguageSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const offered = matchOfferedLanguage(value);

  /*
    Whether he is typing his own answer. Started from the value he arrived with - a language
    the list does not name means he is already in that state - and thereafter it is his choice,
    which is why it has to be held rather than derived: an empty box under "Other" would
    otherwise collapse straight back to the placeholder while he was still deciding what to
    type into it.
  */
  const [typingOwn, setTypingOwn] = useState(
    value.trim().length > 0 && offered === null,
  );

  const selected = typingOwn
    ? EMERGENCY_CONTACT_LANGUAGE_OTHER
    : (offered ?? "");

  return (
    <>
      <select
        id={id}
        className="wf-input ec-control"
        value={selected}
        disabled={disabled}
        onChange={(event) => {
          const chosen = event.target.value;
          if (chosen === EMERGENCY_CONTACT_LANGUAGE_OTHER) {
            setTypingOwn(true);
            // Cleared, because the language he is about to type is not the one he had chosen.
            // Leaving the old value behind the new box would save an answer he had replaced.
            onChange("");
            return;
          }
          setTypingOwn(false);
          onChange(chosen);
        }}
      >
        <option value="">Select a language</option>
        {EMERGENCY_CONTACT_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
        <option value={EMERGENCY_CONTACT_LANGUAGE_OTHER}>Other</option>
      </select>

      {typingOwn ? (
        <input
          id={`${id}-other`}
          className="wf-input ec-control"
          type="text"
          aria-label="The language they prefer"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </>
  );
}

export default LanguageSelect;
