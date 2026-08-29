"use client";

/**
 * QA-L3 - the separate browser tab the real worker experience opens in.
 *
 * OPENED SYNCHRONOUSLY FROM THE OPERATOR'S CLICK, AND FOR ONE REASON: a popup blocker allows a
 * window opened during a user gesture and blocks one opened after an `await`. The launch and the
 * link consumption are two network calls, so a tab opened only once they returned would be blocked
 * in a default browser. The tab is therefore created empty inside the click handler and NAVIGATED
 * when the handoff succeeds.
 *
 * `about:blank` IS THE PLACEHOLDER, AND THE TOKEN IS NEVER THE URL. The temporary tab addresses
 * nothing, carries no query string and receives no secret; the only URL ever assigned to it is a
 * route of this application, built from the invocation the server returned.
 *
 * `noopener` IS DELIBERATELY NOT PASSED, and it is the one thing here that is a trade. With it,
 * `window.open` returns null and the tab could never be navigated, which would defeat the whole
 * pattern above. The destination is a same-origin route of this same application, so the opener
 * relationship grants the new tab nothing it does not already have; the manual fallback link, used
 * when the tab is blocked, is an ordinary `rel="noopener noreferrer"` link.
 *
 * A FAILED HANDOFF CLOSES THE TAB rather than leaving a blank window that looks like a broken app.
 */

/** A tab this launcher opened and may navigate or close. */
export type QaWorkerTab = {
  navigate: (path: string) => void;
  close: () => void;
};

/**
 * Open the empty destination tab, or return null when the browser refused.
 *
 * Null is an ordinary outcome, not a failure: the surface then offers the operator a link to open
 * the run himself, and the run itself is already established either way.
 */
export function openQaWorkerTab(): QaWorkerTab | null {
  if (typeof window === "undefined") return null;

  let opened: Window | null = null;
  try {
    opened = window.open("about:blank", "_blank");
  } catch {
    return null;
  }
  if (!opened) return null;

  return {
    navigate: (path: string) => {
      try {
        // Resolved against this application's own origin: a relative path assigned to a blank
        // document is not reliably resolved against the opener.
        opened.location.href = new URL(path, window.location.origin).toString();
      } catch {
        // A tab the operator closed in the meantime. Nothing to repair: the run stands, and the
        // surface still offers the link.
      }
    },
    close: () => {
      try {
        opened.close();
      } catch {
        // ignore
      }
    },
  };
}
