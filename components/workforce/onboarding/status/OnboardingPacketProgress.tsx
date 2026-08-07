"use client";

/**
 * Phase 3 - derived packet progress.
 *
 * The numerator and denominator both come from the server, which derived them from module
 * completion records on this request. The only arithmetic here is turning two numbers into
 * a bar width; nothing on the client decides whether a packet is complete.
 *
 * `requiredCount` is the only legitimate denominator, and the component says so on screen:
 * "derived from recorded completion" is there so that no operator reads a progress bar as
 * a field somebody could edit.
 */

import type { OnboardingStatusProgress } from "@/lib/workforce/onboardingStatusApi";

export function OnboardingPacketProgress({
  progress,
  label,
  noun = "steps",
}: {
  progress: OnboardingStatusProgress;
  label?: string;
  /**
   * What to call the things being counted, plural.
   *
   * A worker is counting steps and an operator is counting modules; both are counting the
   * same records. The STATUS vocabulary - the chip's words, an outcome's words - is fixed
   * by the server precisely because two surfaces must not describe a record differently.
   * The noun on a tally is not that: naming the thing in the reader's own terms is the
   * plain-language requirement, not a breach of it.
   */
  noun?: string;
}) {
  const { complete, completeCount, requiredCount } = progress;
  const percent =
    requiredCount > 0 ? Math.round((completeCount / requiredCount) * 100) : 0;

  return (
    <div className="obs-progress" data-complete={complete ? "true" : "false"}>
      {label ? <p className="obs-tile-label">{label}</p> : null}
      <div
        className="obs-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={requiredCount}
        aria-valuenow={completeCount}
        aria-valuetext={`${completeCount} of ${requiredCount} ${noun} complete`}
      >
        <div className="obs-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="obs-progress-text">
        {complete
          ? `All ${requiredCount} ${noun} complete`
          : `${completeCount} of ${requiredCount} ${noun} complete`}
        <span className="obs-progress-derived"> (derived from recorded completion)</span>
      </p>
    </div>
  );
}

export default OnboardingPacketProgress;
