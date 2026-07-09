"use client";

import { RefObject, useEffect, useRef } from "react";

/**
 * Jarvis Careers - shared dialog accessibility primitive (V2.1.0 foundations).
 *
 * Consolidates the focus/keyboard behavior every Careers dialog needs:
 *  - Autofocus into the dialog on open (prefers `[data-autofocus]`, then the
 *    first focusable element, then the container itself).
 *  - Focus trap: Tab / Shift+Tab cycle within the dialog.
 *  - ESC closes the dialog (suppressed while `busy` to mirror the existing
 *    overlay-click-disabled-while-busy behavior).
 *  - Restores focus to the previously-focused element on close/unmount.
 *
 * Usage: attach the returned ref to the dialog container element (the element
 * with role="dialog"), and give that element `tabIndex={-1}` so it can receive
 * focus as a fallback. Purely additive: no visual change.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
}): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  // Keep latest values without re-subscribing the listener each render.
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    const previouslyFocused =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    const visibleFocusable = (): HTMLElement[] => {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    const focusInitial = () => {
      if (!container) return;
      const marked =
        container.querySelector<HTMLElement>("[data-autofocus]") ?? null;
      const target = marked ?? visibleFocusable()[0] ?? container;
      target.focus();
    };

    // Defer to ensure the dialog content is mounted and painted.
    const raf = requestAnimationFrame(focusInitial);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!busyRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !container) return;

      const focusables = visibleFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return containerRef;
}
