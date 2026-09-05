"use client";

/**
 * Whose onboarding this is, on the worker's own screen.
 *
 * WHY IT EXISTS. A worker-facing onboarding page named the module and never the worker, so
 * two open tabs were indistinguishable and there was no way to tell from the screen which
 * worker a session belonged to. That is a real hazard on a surface that captures banking
 * and tax identity, and it cost real QA time to resolve by other means.
 *
 * WHERE THE NAME COMES FROM. The runtime container, which reads it once from the certified
 * worker portal projection. That projection resolves the candidate from the worker's BOUND
 * SESSION server-side. This component is handed a string and has no other source: it cannot
 * read a route parameter, a query string or a browser-held candidate id, so it cannot be
 * made to label the page with an identity the session does not own.
 *
 * WHAT IT DOES WHEN THERE IS NO NAME. Nothing at all. An absent name renders no element,
 * because the one failure this display must never have is showing the wrong worker, and a
 * placeholder is a step toward inventing one.
 *
 * SUBORDINATE BY DESIGN. It sits between the eyebrow and the module title and is styled
 * below the title in weight and size: the page is still about the section being filled in,
 * and an identity line that dominated it would be answering a question the worker did not
 * ask.
 */

type Props = {
  /** The worker's display name, or null when it could not be read. */
  name: string | null;
};

export function OnboardingWorkerIdentity({ name }: Props) {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0) return null;

  return (
    <p className="wf-worker-identity" data-ob-worker-identity>
      {trimmed}
    </p>
  );
}

export default OnboardingWorkerIdentity;
