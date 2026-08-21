"use client";

/**
 * Module 4.2 Federal Tax - the worker's own election history.
 *
 * WHAT HE HAS ELECTED, INCLUDING WHAT HE ELECTED BEFORE. A superseded election is not a mistake to be
 * hidden and not a lesser record: it is what governed his withholding while it governed it, and this
 * panel is what lets the screen say so rather than quietly dropping it (Section 16.1.4).
 *
 * EVERY FACT IS THE SERVER'S, PER ENTRY. Each entry reports its OWN revision, its OWN origin, its OWN
 * reason where it stated one and its OWN artifact, exactly as the server projected it. Nothing here
 * reads a value off the current election and applies it to a historical one, which is the single
 * failure mode that would make an honest append-only record read like a rewritten one.
 *
 * THE TWO LATER ORIGINS ARE DESCRIBED DIFFERENTLY BECAUSE THEY ARE DIFFERENT FACTS (8D-R4). A
 * correction says the earlier information was wrong; a subsequent election says it was right for the
 * time it applied. THIS PANEL NEVER CALLS AN EARLIER ELECTION A MISTAKE ON THE STRENGTH OF A LATER
 * ONE EXISTING, and the sentence a superseded entry carries depends on what SUPERSEDED it rather than
 * on the fact that something did.
 *
 * IT OFFERS NO EDIT AND NO DELETE, and there is no control here that could ask for either. The only
 * action on a historical entry is opening the copy that election produced, through the DELIVERED
 * document surface, by identity - this capsule never holds or builds a storage location.
 */

import type { FederalTaxExecutedElection } from "@/lib/workforce/federalTaxApi";

/**
 * WHY AN ELECTION EXISTS, in his words.
 *
 * Keyed by the governed origin so an unrecognised one falls back to a neutral sentence rather than
 * being described as something it might not be. Nothing here characterises an election as erroneous
 * unless its own origin says it corrected one.
 */
const ORIGIN_WORDS: Record<string, string> = {
  INITIAL_ELECTION: "Your first federal withholding choices.",
  CORRECTION:
    "You told us something on the earlier record was wrong, and this replaced it.",
  SUBSEQUENT_ELECTION:
    "A later choice you made. The record before it was correct for the time it applied.",
};

export default function FederalTaxHistory({
  history,
  onOpenArtifact,
}: {
  /** Newest first, as the server ordered it. Nothing here reorders or filters it. */
  history: FederalTaxExecutedElection[];
  onOpenArtifact: (onboardingDocumentId: string) => void;
}) {
  // ONE ENTRY IS NOT A HISTORY. A worker with a single election is already told about it above, and
  // repeating it under a heading about earlier records would invent a past he does not have.
  if (history.length < 2) return null;

  return (
    <div className="ft-history" data-ft-history>
      <h4 className="ft-guidance-heading">Everything you have elected</h4>
      <p className="ft-note">
        We keep every set of choices you have made, exactly as you made it. Nothing below was
        changed or removed when you elected again.
      </p>

      <ol className="ft-history-list">
        {history.map((election) => (
          <li
            className="ft-history-entry"
            key={election.setVersion}
            data-ft-history-entry={election.setVersion}
            data-ft-history-current={election.current ? "true" : "false"}
            data-ft-history-origin={election.electionOrigin}
          >
            <p className="ft-history-when">
              <span className="ft-history-status">
                {election.current ? "In force now" : "No longer in force"}
              </span>{" "}
              - signed {longDate(election.executedAt)}, applied from{" "}
              {longDate(election.effectiveFrom)}
              {election.supersededAt
                ? ` until ${longDate(election.supersededAt)}`
                : ""}
              .
            </p>

            <p className="ft-history-why" data-ft-history-why>
              {ORIGIN_WORDS[election.electionOrigin] ??
                "A federal withholding election you made."}
            </p>

            {/*
              WHAT HE SAID WAS WRONG, IN HIS WORDS AND ONLY WHERE HE SAID IT. A later intentional
              election carries no reason and is shown none: inventing one here would put an admission
              of error on a record that states the opposite.
            */}
            {election.correctionReason ? (
              <p className="ft-history-reason" data-ft-history-reason>
                What you told us was wrong: {election.correctionReason}
              </p>
            ) : null}

            {election.exemptionClaimed ? (
              <p className="ft-history-exemption" data-ft-history-exemption>
                On this record you claimed that no federal income tax needed to be held back from
                your pay.
              </p>
            ) : null}

            {election.artifactDocumentId ? (
              <button
                type="button"
                className="wf-btn wf-btn-secondary"
                data-ft-history-view={election.setVersion}
                onClick={() =>
                  onOpenArtifact(election.artifactDocumentId as string)
                }
              >
                Open this copy
              </button>
            ) : (
              <p className="wf-empty" data-ft-history-artifact-pending>
                The copy for this record is being prepared.
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function longDate(value: string): string {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "an earlier date";
  return when.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
