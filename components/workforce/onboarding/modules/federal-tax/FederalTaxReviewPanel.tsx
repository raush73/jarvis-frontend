"use client";

/**
 * Module 4.2 Federal Tax - the authorized staff review panel.
 *
 * A PANEL inside the delivered Phase 2 workspace, registered under this module's key, exactly as the
 * workspace was designed for: no second administrative shell, no route of its own, and no change to
 * the workspace to accommodate it. The administrative act is taken through the workspace's OWN
 * processing controls, which render beside this panel - so this panel has no processing button, and
 * could not have one: the server derives that outcome from governed state rather than accepting a
 * result from a caller.
 *
 * IT IS A READ, AND IT IS THE ONLY THING THIS FILE CAN BE (8D-R1, criterion 5). There is no form
 * here, no input, no editable election model and no request this panel can compose that changes a
 * worker's withholding. AUTHORIZED STAFF MAY READ, REVIEW AND PROCESS ADMINISTRATIVELY; they may not
 * change a filing status, an amount, an exemption or a certification on a worker's behalf, and they
 * may not sign for him or complete his record for him. A withholding election is the employee's.
 *
 * WHAT IT SHOWS: what governs the worker's federal withholding now, WHY that election exists and
 * what he said was wrong where he corrected one, every superseded election with its own revision and
 * its own dates, and the SERVER'S statement of whether the administrative phase can proceed.
 *
 * SUPERSEDED ELECTIONS ARE SHOWN, NOT HIDDEN. An append-only record whose earlier versions were
 * withheld from the only people authorized to read it would be append-only in storage and
 * destructive in effect (Section 16.1.4). Each historical entry reports ITS OWN facts - never the
 * current election's applied to an earlier one.
 *
 * IT DECIDES NOTHING. Readiness is the server's derivation, rendered here; a panel that computed its
 * own would eventually show a readiness the administrative action disagrees with.
 *
 * NO PROTECTED IDENTIFIER APPEARS AND NONE CAN. There is no Social Security Number on the read this
 * panel consumes, masked or otherwise, no ciphertext and no reveal control - the table it projects
 * holds none of them, so there is nothing here to disclose and no call in this capsule that could
 * obtain one. The masked canonical identity a reviewer sees comes from the delivered administrative
 * worker directory, which is a different authority with its own audited surface.
 *
 * NO WITHHELD AMOUNT, RATE OR LIABILITY IS SHOWN, because none is computed anywhere. Jarvis records
 * what a worker elected; payroll calculates.
 *
 * IT RENDERS NOTHING WITHOUT THE GRANT, and asks for nothing either. `workforce.onboarding.federal-tax.read`
 * is SENSITIVE: broad administrative visibility does not imply it and recruiting does not hold it.
 * An absent panel invites no request the server will refuse, and a disabled one would still disclose
 * that this worker has tax elections to look at. THE ABSENCE IS A COURTESY AND NOT THE BOUNDARY: the
 * route refuses and audits an unauthorized reader whatever a browser believes about itself.
 */

import { getStaffFederalTax } from "@/lib/workforce/federalTaxApi";
import type {
  FederalTaxStaffElection,
  FederalTaxStaffReview,
} from "@/lib/workforce/federalTaxApi";
import type { OnboardingAdminPanelProps } from "@/components/workforce/admin/adminPanelRegistry";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminResource } from "@/components/workforce/admin/useOnboardingAdminResource";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "@/components/workforce/admin/OnboardingAdminNotice";
import {
  OnboardingAdminField,
  OnboardingAdminFieldList,
  OnboardingAdminPanel,
  OnboardingAdminTimestamp,
} from "@/components/workforce/admin/panels/DetailPanel";

/**
 * The module's own sensitive grant, checked so the panel can decide whether to RENDER.
 *
 * READ FROM EFFECTIVE GRANTS rather than through a role-aware helper, exactly as the delivered
 * sensitive controls are: the server treats no role as a bypass for a sensitive permission, so an
 * administrator who lacks this grant must not be offered a disclosure the server will refuse.
 */
const FEDERAL_TAX_READ = "workforce.onboarding.federal-tax.read";

/** Plain language for the governed filing statuses. Never the government form's own wording. */
const FILING_STATUS_LABELS: Record<string, string> = {
  SINGLE_OR_MARRIED_FILING_SEPARATELY:
    "Single, or married filing separately",
  MARRIED_FILING_JOINTLY: "Married filing jointly",
  HEAD_OF_HOUSEHOLD: "Head of household",
};

/** WHY an election exists. A later election is never described as a correction of an earlier one. */
const ORIGIN_LABELS: Record<string, string> = {
  INITIAL_ELECTION: "His first election",
  CORRECTION: "A correction of the election before it",
  SUBSEQUENT_ELECTION: "A later election he chose to make",
};

/** What the server says is preventing the administrative phase, in plain language. */
const BLOCK_LABELS: Record<string, string> = {
  NO_OPERATIVE_ELECTION:
    "This worker has no executed federal withholding election.",
  CERTIFICATION_NOT_BOUND:
    "His election is not fully certified: the signed act or the retained record is missing, so there is nothing complete to process.",
};

export function FederalTaxReviewPanel({ worker }: OnboardingAdminPanelProps) {
  const session = useSession();
  // EFFECTIVE grants only. No role is a bypass here, exactly as the server's assertion is not.
  const canRead = session.permissions.includes(FEDERAL_TAX_READ);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getStaffFederalTax(worker.candidateId),
    [worker.candidateId],
    { enabled: canRead },
  );

  if (!canRead) return null;

  return (
    <OnboardingAdminPanel
      title="Federal withholding"
      description="What this worker elected for federal income tax withholding, every election he has made, and whether the administrative phase can proceed. This is a read: his elections are his own, and nothing here can change them."
    >
      {loading ? (
        <OnboardingAdminLoading label="Loading federal withholding" />
      ) : null}
      {error ? (
        <OnboardingAdminErrorNotice error={error} onRetry={reload} />
      ) : null}

      {data && data.current === null ? (
        <OnboardingAdminEmpty
          title="This worker has made no federal withholding election."
          detail="There is nothing to process until he has completed and signed his own choices."
        />
      ) : null}

      {data && data.current !== null ? (
        <ReviewBody review={data} current={data.current} />
      ) : null}
    </OnboardingAdminPanel>
  );
}

function ReviewBody({
  review,
  current,
}: {
  review: FederalTaxStaffReview;
  current: FederalTaxStaffElection;
}) {
  // Newest first, as the server ordered it. The current election is shown in full above, so what is
  // listed below is what governed him BEFORE it.
  const superseded = review.history.filter((entry) => !entry.current);

  return (
    <>
      <p className="oba-cell-detail" data-ft-staff-version={current.setVersion}>
        Version {current.setVersion} · effective{" "}
        <OnboardingAdminTimestamp value={current.effectiveFrom} /> ·{" "}
        {current.formKey} revision {current.formRevision}
      </p>

      <OnboardingAdminFieldList>
        <OnboardingAdminField
          label="Why this election exists"
          value={ORIGIN_LABELS[current.electionOrigin] ?? current.electionOrigin}
          hint={current.correctionReason ?? undefined}
        />
        <OnboardingAdminField
          label="How he files"
          value={
            FILING_STATUS_LABELS[current.filingStatus] ?? current.filingStatus
          }
        />
        <OnboardingAdminField
          label="Accounts for other work"
          value={current.multipleJobsElected ? "Yes" : "No"}
        />
        {/*
          AN ABSENT AMOUNT IS STATED AS NO ELECTION AND NEVER SHOWN AS A ZERO. An elected zero and no
          election are different facts, and a panel that rendered a blank as "$0.00" would report an
          election the worker never made.
        */}
        <OnboardingAdminField
          label="Claimed for dependents"
          value={amount(current.dependentsCreditAmount)}
        />
        <OnboardingAdminField
          label="Other income to account for"
          value={amount(current.otherIncomeAmount)}
        />
        <OnboardingAdminField
          label="Deductions beyond the standard one"
          value={amount(current.deductionsAmount)}
        />
        <OnboardingAdminField
          label="Extra withholding each pay period"
          value={amount(current.additionalWithholdingAmount)}
        />
        {/*
          REPORTED, NEVER ADJUDICATED (8-R5). Whether the worker qualifies is not MW4H's decision and
          there is nowhere on this panel to record an opinion about it.
        */}
        <OnboardingAdminField
          label="Claimed exemption from withholding"
          value={current.exemptionClaimed ? "Yes, he claimed it" : "No"}
          hint={
            current.exemptionClaimed
              ? "He affirmed both governed conditions himself. Jarvis records the claim and decides nothing about it."
              : undefined
          }
        />
        <OnboardingAdminField
          label="He signed it"
          value={<OnboardingAdminTimestamp value={current.executedAt} />}
        />
        <OnboardingAdminField
          label="We received it"
          value={<OnboardingAdminTimestamp value={current.receipt.receivedAt} />}
          hint={current.receipt.basis}
        />
      </OnboardingAdminFieldList>

      {/*
        READINESS IS THE SERVER'S DERIVATION, RENDERED. The administrative action reads the same
        blocks, so this panel cannot show a readiness the action would disagree with.
      */}
      {review.processing.actionable ? (
        <p className="oba-notice" data-ft-staff-actionable="true">
          <span className="oba-notice-title">
            This election is ready for administrative processing.
          </span>
          <span className="oba-notice-detail">
            Process it using the action below. Processing records that MW4H handled his election; it
            does not change what he elected, and his module is already complete either way.
          </span>
        </p>
      ) : (
        <div
          className="oba-notice oba-notice-error"
          role="alert"
          data-ft-staff-actionable="false"
        >
          <p className="oba-notice-title">
            Administrative processing is not available yet.
          </p>
          <ul>
            {review.processing.blocks.map((block) => (
              <li className="oba-notice-detail" key={block} data-ft-staff-block={block}>
                {BLOCK_LABELS[block] ?? block}
              </li>
            ))}
          </ul>
        </div>
      )}

      {superseded.length > 0 ? (
        <div data-ft-staff-history>
          <h3 className="oba-panel-title">What governed him before</h3>
          <p className="oba-panel-description">
            Every earlier election is kept exactly as he made it, under the revision it was made
            under. Nothing below was changed or removed when he elected again.
          </p>
          {superseded.map((entry) => (
            <OnboardingAdminFieldList key={entry.setVersion}>
              <OnboardingAdminField
                label={`Version ${entry.setVersion}`}
                value={
                  <>
                    <OnboardingAdminTimestamp value={entry.effectiveFrom} /> to{" "}
                    <OnboardingAdminTimestamp value={entry.supersededAt} />
                  </>
                }
                hint={`${entry.formKey} revision ${entry.formRevision}`}
              />
              <OnboardingAdminField
                label="Why it exists"
                value={
                  ORIGIN_LABELS[entry.electionOrigin] ?? entry.electionOrigin
                }
                hint={entry.correctionReason ?? undefined}
              />
              <OnboardingAdminField
                label="How he filed"
                value={
                  FILING_STATUS_LABELS[entry.filingStatus] ?? entry.filingStatus
                }
              />
              <OnboardingAdminField
                label="Extra withholding each pay period"
                value={amount(entry.additionalWithholdingAmount)}
              />
              <OnboardingAdminField
                label="Claimed exemption from withholding"
                value={entry.exemptionClaimed ? "Yes, he claimed it" : "No"}
              />
            </OnboardingAdminFieldList>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** An elected amount as the exact decimal the server holds, or the stated absence of one. */
function amount(value: string | null): string {
  return value === null ? "No election" : `$${value}`;
}

export default FederalTaxReviewPanel;
