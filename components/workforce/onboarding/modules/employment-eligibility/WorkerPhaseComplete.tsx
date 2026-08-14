"use client";

/**
 * Module 4.1 - your part is done.
 *
 * THE MOST CAREFULLY WORDED SCREEN IN THIS CAPSULE, because the temptation here is to congratulate
 * the worker on something that has not happened. What HAS happened is exactly this: he answered,
 * he presented his documents, he attested, and MW4H now has work to do.
 *
 * SO IT DOES NOT SAY, and must never be edited to say:
 *
 *  - that this section of his onboarding is complete - it is not, and the platform will not let it
 *    be until the employer's own phase is recorded;
 *  - that his documents were accepted, examined, approved or found genuine - no authorized person
 *    has looked at them yet;
 *  - that he is certified, verified, cleared or eligible - none of those is a worker's to be told
 *    here, and one of them is not a conclusion this system reaches at all.
 *
 * It is also not a dead end. A worker who realizes he showed us the wrong document can say so from
 * here, and stating a new record legitimately asks him to sign again about the record he changed.
 */

type Props = {
  /** Open the interview again so the worker can state a new record. */
  onRestate?: () => void;
  /** True once the whole section is closed, when changing it is no longer his to do. */
  closed?: boolean;
};

export function WorkerPhaseComplete({ onRestate, closed = false }: Props) {
  return (
    <section className="ee-done" data-ee-worker-phase="COMPLETE">
      <p className="ee-done-title" role="status">
        Your part is complete. MW4H will review your documents.
      </p>
      <p>
        We have your answers, your pictures and your signature. There is nothing else for you to do
        in this section right now.
      </p>
      <p className="ee-note">
        Someone at MW4H will look at what you sent. If anything is unclear, we will contact you.
      </p>

      {onRestate && !closed ? (
        <div className="wf-btn-row">
          <button
            type="button"
            className="wf-btn wf-btn-secondary"
            onClick={onRestate}
            data-ee-restate
          >
            I need to change something
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default WorkerPhaseComplete;
