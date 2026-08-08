"use client";

/**
 * Phase 5 - the native capture surface.
 *
 * ONE surface for both drawn forms. Initials and a signature differ in how much room they are
 * given and in what the worker is asked for; they do not differ in what evidence is, so they
 * do not get two implementations that could drift into two standards of proof.
 *
 * NATIVE means drawn. There is no text input here, no typed-name fallback, and no alternate
 * act, because a typed name is a keystroke sequence anyone with the keyboard could produce and
 * calling it a signature would put that claim in an immutable record. A worker who cannot draw
 * is told plainly to ask for help rather than quietly given a weaker instrument.
 *
 * WHAT LEAVES THIS COMPONENT. One payload, to one endpoint: the strokes and how long the
 * drawing took. The coordinates live in a ref for the lifetime of the attempt and nowhere else
 * - not in React state that a dev-tools tree would show, not in a data attribute, not in the
 * DOM, not in storage, not in a log, and not in a URL. The canvas is never serialised to an
 * image string either, which would turn a capture the backend protects with a key into plain
 * text sitting in a variable. The coordinates are discarded when the act succeeds, when the
 * wording changes, and when the component goes away.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXECUTION_CAPTURE_MAX_DURATION_MS,
  EXECUTION_CAPTURE_MAX_POINTS_PER_STROKE,
  EXECUTION_CAPTURE_MAX_STROKES,
  EXECUTION_CAPTURE_MAX_TOTAL_POINTS,
  type OnboardingExecutionCapture,
  type OnboardingExecutionCapturePoint,
  type OnboardingExecutionNativeForm,
} from "@/lib/workforce/onboardingExecutionApi";

/**
 * How far the pointer must travel before another point is kept.
 *
 * A stylus reporting at 240Hz can spend the entire point budget on a single letter, and the
 * points it spends it on are visually indistinguishable. Dropping the ones that add no shape
 * is what lets a real signature fit inside the delivered ceiling instead of being truncated
 * halfway through, which would be the failure a worker actually notices.
 */
const MIN_POINT_SPACING_PX = 1.5;

type Props = {
  form: OnboardingExecutionNativeForm;
  subjectKey: string;
  submitting: boolean;
  disabled: boolean;
  /** Resolves true when the act was recorded, at which point the evidence is discarded. */
  onSubmit: (capture: OnboardingExecutionCapture) => Promise<boolean>;
};

type Buffer = {
  strokes: OnboardingExecutionCapturePoint[][];
  totalPoints: number;
  startedAt: number | null;
  endedAt: number | null;
};

function emptyBuffer(): Buffer {
  return { strokes: [], totalPoints: 0, startedAt: null, endedAt: null };
}

const WORDING: Record<
  OnboardingExecutionNativeForm,
  { noun: string; verb: string; action: string }
> = {
  INITIALS: { noun: "initials", verb: "Draw your initials", action: "Submit initials" },
  ELECTRONIC_SIGNATURE: {
    noun: "signature",
    verb: "Draw your signature",
    action: "Submit signature",
  },
};

export function ExecutionCaptureSurface({
  form,
  subjectKey,
  submitting,
  disabled,
  onSubmit,
}: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const buffer = useRef<Buffer>(emptyBuffer());
  const drawing = useRef(false);
  const activePointer = useRef<number | null>(null);
  /** Rendered size, so a resize can be told from a re-render. */
  const size = useRef<{ width: number; height: number } | null>(null);

  // Only whether there IS a mark, never how much of one. How many strokes a drawing took and
  // how long it lasted are an auditor's facts, and this surface is not the auditor's.
  const [marked, setMarked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const wording = WORDING[form];
  const describedById = `ob-exec-assist-${subjectKey}`;
  const locked = disabled || submitting;

  const repaint = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext?.("2d");
    if (!context) return;

    const rect = element.getBoundingClientRect();
    // A backing store at device resolution, drawn in CSS pixels. The COORDINATES stay in CSS
    // pixels regardless, so what is recorded does not depend on the display it was drawn on.
    const ratio =
      typeof window !== "undefined" && window.devicePixelRatio
        ? window.devicePixelRatio
        : 1;
    if (rect.width > 0 && rect.height > 0) {
      element.width = Math.round(rect.width * ratio);
      element.height = Math.round(rect.height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#16202e";

    for (const stroke of buffer.current.strokes) {
      if (stroke.length === 0) continue;
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      // A single tap is a dot, and a dot a worker made must appear.
      if (stroke.length === 1) context.lineTo(stroke[0].x + 0.1, stroke[0].y);
      context.stroke();
    }
  }, []);

  const discard = useCallback(() => {
    buffer.current = emptyBuffer();
    drawing.current = false;
    activePointer.current = null;
    setMarked(false);
    repaint();
  }, [repaint]);

  /*
    Nothing outlives the surface.

    Replaced wording is handled by the caller REMOUNTING this component, which is how evidence
    produced against a superseded revision is guaranteed not to survive into the new one:
    there is no clearing routine to get wrong, and no window in which a stale buffer exists.
  */
  useEffect(() => {
    return () => {
      buffer.current = emptyBuffer();
    };
  }, []);

  /*
    A resize invalidates a drawing in progress.

    The alternative is to rescale the points to the new box, which would mean submitting
    coordinates the worker never produced as though he had. Clearing costs him a few seconds
    and keeps the record honest.
  */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const element = canvas.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const previous = size.current;
      size.current = { width: rect.width, height: rect.height };
      if (!previous) return;
      if (previous.width === rect.width && previous.height === rect.height) return;
      if (buffer.current.strokes.length === 0) {
        repaint();
        return;
      }
      discard();
      setNotice(`The screen changed size, so your ${wording.noun} was cleared.`);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [discard, repaint, wording.noun]);

  const pointAt = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): OnboardingExecutionCapturePoint => {
      const rect = event.currentTarget.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (locked) return;
      // Hard stop rather than an over-budget payload the backend would only refuse.
      if (buffer.current.strokes.length >= EXECUTION_CAPTURE_MAX_STROKES) return;
      if (buffer.current.totalPoints >= EXECUTION_CAPTURE_MAX_TOTAL_POINTS) return;
      if (drawing.current) return;

      event.preventDefault();
      setNotice(null);
      drawing.current = true;
      activePointer.current = event.pointerId;
      // One pointer owns the surface for the stroke, so a finger leaving the canvas mid-letter
      // ends the letter where it was lifted rather than where it left the box.
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const now = Date.now();
      if (buffer.current.startedAt === null) buffer.current.startedAt = now;
      buffer.current.endedAt = now;
      buffer.current.strokes.push([pointAt(event)]);
      buffer.current.totalPoints += 1;
      setMarked(true);
      repaint();
    },
    [locked, pointAt, repaint],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || locked) return;
      if (activePointer.current !== null && event.pointerId !== activePointer.current) {
        return;
      }

      const stroke = buffer.current.strokes[buffer.current.strokes.length - 1];
      if (!stroke) return;
      if (stroke.length >= EXECUTION_CAPTURE_MAX_POINTS_PER_STROKE) return;
      if (buffer.current.totalPoints >= EXECUTION_CAPTURE_MAX_TOTAL_POINTS) return;

      const point = pointAt(event);
      const last = stroke[stroke.length - 1];
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx * dx + dy * dy < MIN_POINT_SPACING_PX * MIN_POINT_SPACING_PX) return;

      stroke.push(point);
      buffer.current.totalPoints += 1;
      buffer.current.endedAt = Date.now();
      repaint();
    },
    [locked, pointAt, repaint],
  );

  const endStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      drawing.current = false;
      activePointer.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      buffer.current.endedAt = Date.now();
    },
    [],
  );

  const clear = useCallback(() => {
    discard();
    setNotice(null);
  }, [discard]);

  const submit = useCallback(() => {
    if (locked) return;
    const { strokes, startedAt, endedAt } = buffer.current;
    // An empty surface is not an act. Nothing is sent for one.
    if (strokes.length === 0 || startedAt === null || endedAt === null) return;

    const elapsed = Math.max(1, endedAt - startedAt);
    if (elapsed > EXECUTION_CAPTURE_MAX_DURATION_MS) {
      // Truncating the duration to fit would report a drawing that did not happen. The
      // attempt is abandoned instead, in the worker's own words.
      discard();
      setNotice(`That took too long to record. Please draw your ${wording.noun} again.`);
      return;
    }

    const capture: OnboardingExecutionCapture = {
      strokes: strokes.map((points) => ({ points: points.map((p) => ({ ...p })) })),
      capturedDurationMs: elapsed,
    };

    void onSubmit(capture).then((recorded) => {
      if (recorded) discard();
    });
  }, [locked, onSubmit, discard, wording.noun]);

  return (
    <div className="ob-exec-capture ob-exec-act" data-execution-form={form}>
      <span className="wf-label" id={`ob-exec-pad-label-${subjectKey}`}>
        {wording.verb}
      </span>
      <canvas
        ref={canvas}
        className={`ob-exec-pad ${
          form === "INITIALS" ? "ob-exec-pad-initials" : "ob-exec-pad-signature"
        }`}
        data-capture-pad={form}
        data-disabled={locked ? "true" : "false"}
        data-has-mark={marked ? "true" : "false"}
        aria-labelledby={`ob-exec-pad-label-${subjectKey}`}
        aria-describedby={describedById}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />

      {/*
        Static copy, and deliberately nothing more. It names the one route to help that already
        exists - the person who sent the link - rather than inventing a request-help workflow,
        a ticket, or an execute-on-behalf-of authority, none of which this phase governs.
      */}
      <p className="ob-exec-assistance" id={describedById} data-assistance-notice>
        Your {wording.noun} must be drawn here on this device. If you are not able to draw{" "}
        {form === "INITIALS" ? "them" : "it"}, contact the person who sent you this
        onboarding link and they can help you finish this.
      </p>

      {notice ? (
        <p className="wf-field-error" role="alert" data-capture-notice>
          {notice}
        </p>
      ) : null}

      <div className="wf-btn-row">
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          data-execution-submit
          disabled={locked || !marked}
          onClick={submit}
        >
          {submitting ? "Recording." : wording.action}
        </button>
        <button
          type="button"
          className="wf-btn wf-btn-secondary"
          data-capture-clear
          disabled={locked || !marked}
          onClick={clear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default ExecutionCaptureSurface;
