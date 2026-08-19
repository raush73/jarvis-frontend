"use client";

/**
 * Module 4.2 Federal Tax - what the worker reviews before anything is executed.
 *
 * IT SHOWS THE SERVER'S REVIEW AND BUILDS NONE OF ITS OWN. Each line is the question as it was asked
 * and the answer as it was given, already turned into plain language by the module that owns the
 * question set. This component composes no sentence, formats no amount and labels no choice: two
 * renderings of one answer is how a worker comes to confirm something different from what is stored.
 *
 * IT REVIEWS WHAT WAS ASKED OF HIM AND NOTHING ELSE. The lines are the APPLICABLE questions, so a
 * worker who claimed an exemption is not shown four blank amounts he was never asked for and invited
 * to wonder what he missed. That filtering is the server's, for the same reason the branching is.
 *
 * CORRECTION IS A LINK BACK TO THE QUESTION. Every line offers the step that owns it, so correcting
 * is answering the question again rather than editing a summary - which is what keeps the review a
 * view of the answers rather than a second place to state them.
 *
 * NOTHING HERE EXECUTES ANYTHING. There is no signature, no submission and no act on this panel, and
 * the screen says so in as many words: a worker who has confirmed his review has confirmed that he
 * read it, and his choices are not yet in force.
 */

import Link from "next/link";
import { modulePath } from "@/lib/workforce/onboardingRuntimeApi";
import type { FederalTaxReviewLine } from "@/lib/workforce/federalTaxApi";

export default function ReviewPanel({
  lines,
  invocationId,
  moduleSlug,
  stepForKey,
}: {
  lines: FederalTaxReviewLine[];
  invocationId: string;
  moduleSlug: string;
  /** Which declared step owns a given answer, so "change this" goes where the question is. */
  stepForKey: (key: string) => string | null;
}) {
  if (lines.length === 0) {
    return (
      <p className="ft-note" data-ft-review="EMPTY">
        There is nothing to review yet. Answer the questions and come back to this.
      </p>
    );
  }

  return (
    <div className="ft-review" data-ft-review="SHOWN">
      <dl className="ft-review-list">
        {lines.map((line) => {
          const step = stepForKey(line.key);
          return (
            <div className="ft-review-row" key={line.key} data-ft-review-line={line.key}>
              <dt className="ft-review-question">{line.prompt}</dt>
              <dd className="ft-review-answer" data-ft-review-answer={line.key}>
                {line.answer}
                {step ? (
                  <Link
                    className="ft-review-change"
                    href={modulePath(invocationId, moduleSlug, step)}
                    data-ft-review-change={line.key}
                  >
                    Change this
                  </Link>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
