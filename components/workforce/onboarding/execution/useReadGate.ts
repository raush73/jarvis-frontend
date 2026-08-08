"use client";

/**
 * Phase 5 - the genuine opportunity to read.
 *
 * Owner ruling, 2026-08-08: where governed content is scrollable, the acknowledgement control
 * stays unavailable until the worker has reached the end of it; where the whole of it is
 * already visible, no artificial scrolling is manufactured and the control is available at
 * once. There is deliberately NO dwell timer and no reading-speed heuristic here, and none may
 * be added: elapsed time evidences nothing, and a timer would punish a careful reader while
 * doing nothing to a hurried one.
 *
 * WHAT THIS IS NOT. It is presentation behaviour, not evidence. It runs in a browser, it is
 * trivially bypassable with developer tools, it is never submitted, and no record anywhere
 * claims because of it that a worker read anything. The execution record proves exactly what
 * Gate 5C made it prove - which content, at which revision and hash, was executed - and this
 * hook neither adds to that nor is permitted to.
 *
 * It is measured rather than assumed. Content that fits on a desktop overflows on a phone, and
 * a rotation moves the boundary again, so overflow is re-measured on mount, on scroll, and on
 * resize rather than decided once.
 *
 * The caller owns the region and is responsible for returning it to its beginning when the
 * governed content changes. A browser preserves scroll position across a content swap, and a
 * region left at the bottom of the previous revision would otherwise report the replacement as
 * already read the instant it rendered - satisfying the gate for wording nobody had seen.
 */

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * How close to the bottom still counts as the bottom.
 *
 * Browser zoom, fractional device pixel ratios, and sub-pixel layout rounding routinely leave
 * a scrolled-to-the-end element a fraction of a pixel short. Without this the end of a
 * document would be unreachable on those displays, which is the one failure mode a read
 * requirement must not have.
 */
export const READ_GATE_BOTTOM_TOLERANCE_PX = 2;

export type ReadGate = {
  /** Re-measure the region. Called from its own `onScroll`, with the scrolled element. */
  measure: (element: HTMLElement) => void;
  /** True when the content has been read to the end, or never needed scrolling. */
  satisfied: boolean;
  /** True when the content is taller than its region. */
  overflowing: boolean;
};

type GateState = {
  /** The content this satisfaction belongs to. New content, new obligation. */
  identity: string;
  satisfied: boolean;
  overflowing: boolean;
};

/**
 * @param identity Changes when the governed content changes - typically revision and hash
 *   together. A change RESETS the gate, so a worker who read the previous wording to the end
 *   must reach the end of the replacement before acknowledging it.
 * @param region The scrollable governed content region.
 */
export function useReadGate(
  identity: string,
  region: RefObject<HTMLElement | null>,
): ReadGate {
  const [state, setState] = useState<GateState>({
    identity,
    satisfied: false,
    overflowing: false,
  });

  /*
    Takes the region rather than reaching for it. Every caller already has the element in hand
    - an event has its target, and the effect below has just read the ref - so this stays a
    pure function of what it was given, memoized on the one thing that changes its meaning.
  */
  const measure = useCallback(
    (element: HTMLElement) => {
      const { scrollTop, clientHeight, scrollHeight } = element;

      /*
        An element with no box has not been laid out yet, and an unlaid-out element is not a
        short one. Concluding "it all fits" from zero geometry would satisfy the gate before
        the content had ever been on screen - the one way this could silently stop being a
        read requirement at all. Nothing is concluded until there is something to measure; a
        browser delivers the first measurement through ResizeObserver, which fires on observe.
      */
      if (clientHeight <= 0 && scrollHeight <= 0) return;

      const overflowing = scrollHeight > clientHeight + READ_GATE_BOTTOM_TOLERANCE_PX;
      const atEnd =
        scrollTop + clientHeight >= scrollHeight - READ_GATE_BOTTOM_TOLERANCE_PX;
      // The end of the content has been on screen: it all fits, or it was scrolled to.
      const endSeen = !overflowing || atEnd;

      setState((previous) => {
        // A gate belonging to superseded content carries nothing forward.
        const base: GateState =
          previous.identity === identity
            ? previous
            : { identity, satisfied: false, overflowing: false };

        // Sticky: a worker who has seen the end is not sent back through it by a later resize
        // that reintroduces overflow.
        const satisfied = base.satisfied || endSeen;

        if (
          base === previous &&
          previous.satisfied === satisfied &&
          previous.overflowing === overflowing
        ) {
          return previous;
        }
        return { identity, satisfied, overflowing };
      });
    },
    [identity],
  );

  useEffect(() => {
    const element = region.current;
    if (!element) return;

    /*
      ResizeObserver delivers the FIRST measurement as well as later ones: it reports the
      element's size when observation begins. That is what measures the content on arrival,
      and it is why nothing is concluded here synchronously - a region measured before layout
      would report zero height and prove nothing.
    */
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => measure(element));
      observer.observe(element);
    }

    // The coarse fallback where ResizeObserver is unavailable, and harmless where it is not:
    // measuring twice reaches the same answer.
    const onWindowResize = () => measure(element);
    window.addEventListener("resize", onWindowResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [identity, measure, region]);

  return {
    measure,
    satisfied: state.identity === identity && state.satisfied,
    overflowing: state.identity === identity && state.overflowing,
  };
}

export default useReadGate;
