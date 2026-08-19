"use client";

/**
 * Module 4.2 Federal Tax - the guidance beside one question.
 *
 * IT RENDERS WHAT THE SERVER SENT, WORD FOR WORD. There is no text of its own here, no substitution,
 * no worker value, and nothing conditional: the governed guidance lives in one reviewable file on the
 * server, and this component's only job is to put it beside the question it belongs to. A screen that
 * wrote its own explanation would be advising a worker in words nobody governs.
 *
 * A DISCLOSURE RATHER THAN A WALL OF TEXT. Nine explanations rendered open at once is an interview a
 * worker stops reading, so each sits behind its own heading and opens on request. The text is in the
 * document either way, which is what keeps it available to a screen reader and to a test.
 *
 * IT NEVER RECOMMENDS, because it cannot: it has no opinion to render. Whether the governed text
 * recommends anything is proven where the text lives.
 */

import type { FederalTaxGuidance } from "@/lib/workforce/federalTaxApi";

export default function QuestionGuidance({
  guidance,
  questionKey,
}: {
  guidance: FederalTaxGuidance;
  questionKey: string;
}) {
  return (
    <details className="ft-guidance" data-ft-guidance={questionKey}>
      <summary className="ft-guidance-heading">{guidance.heading}</summary>
      {guidance.paragraphs.map((paragraph) => (
        <p className="ft-guidance-text" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </details>
  );
}
