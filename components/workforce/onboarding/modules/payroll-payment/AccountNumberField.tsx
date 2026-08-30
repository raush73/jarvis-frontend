"use client";

/**
 * Module 4.4 - one account-number box, and the controls that make the second one INDEPENDENT.
 *
 * The worker types his account number twice. The reason is not that we distrust him: an account
 * number is the one value in this module that nothing can check for him. A routing number has a
 * checksum, so a wrong digit is caught here and now (10-R3). An account number has nothing - a
 * mistyped one is a perfectly well-formed account number that belongs to somebody else or to
 * nobody, and it is found out on payday. Typing it twice is the only check that exists.
 *
 * WHAT THIS COMPONENT DOES ABOUT THAT, AND WHAT IT HONESTLY CANNOT:
 *
 *  - PASTE AND DROP ARE REFUSED, ON BOTH BOXES. Pasting the first value into the second proves the
 *    clipboard can copy, which was never in question. Refusing it on the FIRST box as well is
 *    deliberate: a value that cannot be pasted in is one fewer place it has been.
 *  - COPY AND CUT ARE REFUSED. The value cannot be lifted out of either box, so there is nothing
 *    to paste into the other one even by a route this component does not know about.
 *  - AN INSERTION OF MORE THAN ONE CHARACTER AT A TIME IS REFUSED. This is what actually catches
 *    autofill, a browser extension, a drag between the boxes and a paste performed through a route
 *    that raises no paste event: a person typing produces one character per change, and a machine
 *    filling a box produces all of them at once. Deletions are never restricted - a worker who
 *    selects the lot and starts again is doing exactly what we asked him to do.
 *  - AUTOFILL IS TURNED AWAY at the attribute level as well, which browsers respect unevenly. That
 *    is precisely why the rule above is written in terms of the CHANGE rather than in terms of
 *    trusting `autoComplete`.
 *
 * NONE OF THIS IS THE SECURITY AUTHORITY, AND THIS FILE WILL NOT PRETEND OTHERWISE. Every control
 * here runs in a browser the worker controls, and any of them can be got around by anyone who wants
 * to - a determined person can read the value out of the DOM and type it back in. What these
 * controls buy is that the ACCIDENTAL path is closed: the ordinary, well-meaning worker who would
 * have copy-pasted, and the browser that would have helpfully filled both boxes, cannot produce a
 * false confirmation without meaning to. THE SERVER COMPARES THE TWO ENTRIES AND ITS COMPARISON IS
 * WHAT DECIDES (10-R10, 10-R13). Nothing in this component is relied upon by that comparison, and
 * removing all of it would not weaken it.
 *
 * ON WHAT IS IN THE DOM. `inputMode` gets him a numeric keypad on a phone; `type` stays `text`
 * because a number input drops leading zeros, and an account number's leading zero is a digit.
 * There is no `name` a form-filler recognises, no label text a heuristic matches on, and the value
 * never reaches an id, a key, a data attribute or the console.
 *
 * AND IT IS ON SCREEN ONLY WHILE HE IS IN THE BOX (QA-L4-UX-3). Real-browser QA left an account
 * number sitting in full view in two boxes for the rest of the interview. So the moment the box
 * stops being the one he is working in, what is DISPLAYED becomes the masked tail - the same shape
 * the review and the saved-account line use, because a worker should not have to learn a second
 * convention for the same thing.
 *
 * WHAT IS MASKED IS THE DISPLAY, AND ONLY THE DISPLAY. The value the worker typed stays exactly
 * where it was - in the module's own state, whole and untouched - because the SERVER's comparison
 * of the two entries is what confirms the account number (10-R10, 10-R13), and a browser that
 * threw away or truncated what it had collected would have nothing honest to send. Masking early
 * would be a browser deciding it knows better than the check it exists to feed.
 *
 * THE ONE PROPERTY THIS BUYS BEYOND PRIVACY: while the box is masked the plaintext is not in the
 * DOM at all, so it is not in a screenshot, a screen-share, a support session or a serialisation
 * of the page. When he comes back to the box it is his own value he finds there, ready to correct,
 * rather than a cleared box demanding the whole thing again.
 */

import {
  useCallback,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";

/**
 * What a box shows when it is not the one being worked in.
 *
 * FOUR BULLETS AND THE LAST FOUR DIGITS, which is the masking convention already in force
 * everywhere else in this module - the review panel, the saved-routing line and the saved-account
 * line all read `••••6789`, because that is what the server returns. A value too short to have a
 * tail worth showing is shown as bullets alone rather than as most of itself.
 */
export function maskedEntry(value: string): string {
  const held = value.trim();
  if (held.length === 0) return "";
  return held.length > 4 ? `••••${held.slice(-4)}` : "••••";
}

export default function AccountNumberField({
  id,
  label,
  help,
  value,
  disabled,
  invalid,
  onChange,
  onBlocked,
  testId,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  /** Told when a control above refused an edit, so the worker can be told why. */
  onBlocked: () => void;
  testId: string;
}) {
  /**
   * Whether this is the box he is working in, which is the only thing that decides what is shown.
   *
   * SET BY FOCUS AND BY EDITING, cleared by blur. Focus is the honest signal and is what a browser
   * gives; an accepted edit is here as well because an edit IS the worker working in the box, and
   * a box that could be typed into while displaying a mask of its own contents would be a trap.
   */
  const [working, setWorking] = useState(false);

  const refuse = useCallback(
    (event: ClipboardEvent<HTMLInputElement> | DragEvent<HTMLInputElement>) => {
      event.preventDefault();
      onBlocked();
    },
    [onBlocked],
  );

  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      // A CHANGE CARRYING THE MASK IS NOT A CHANGE HE MADE. The mask is what the box shows while he
      // is not in it (QA-L4-UX-3); taking it as the value would replace his account number with a
      // picture of its last four digits, and the server would be asked to confirm that. A bullet is
      // not something a person types into an account number, so there is nothing else this can be.
      if (next.includes("•")) return;
      // One character at a time, or fewer characters than before. Anything else was not typed.
      if (next.length > value.length + 1) {
        onBlocked();
        return;
      }
      setWorking(true);
      onChange(next);
    },
    [onBlocked, onChange, value.length],
  );

  const shown = working ? value : maskedEntry(value);

  return (
    <div className="pp-field">
      <label className="pp-label" htmlFor={id}>
        {label}
      </label>
      {help ? (
        <p className="pp-help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      <input
        id={id}
        className="pp-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-pp-field={testId}
        data-pp-masked={!working && value.trim().length > 0 ? "true" : undefined}
        aria-describedby={help ? `${id}-help` : undefined}
        aria-invalid={invalid || undefined}
        value={shown}
        disabled={disabled}
        onChange={change}
        onFocus={() => setWorking(true)}
        onBlur={() => setWorking(false)}
        onPaste={refuse}
        onDrop={refuse}
        onCopy={refuse}
        onCut={refuse}
      />
    </div>
  );
}
