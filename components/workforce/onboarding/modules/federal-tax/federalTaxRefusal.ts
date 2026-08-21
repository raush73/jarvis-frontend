/**
 * Module 4.2 Federal Tax - a refused act, in the worker's own words.
 *
 * ONE CLASSIFICATION FOR BOTH GOVERNED CERTIFICATION PATHS, and the reason it is one rather than two
 * is the reason the server's sequence is one: a first election and a later one are refused by the
 * same rules for the same causes, and two copies of this mapping would be two chances for the same
 * refusal to be described differently depending on which control the worker used.
 *
 * THE SHARED REFUSAL SHAPE IS REUSED DELIBERATELY - the same four kinds, and the same meaning of
 * `retryable` - because whether the same attempt is worth repeating is a property of the refusal
 * rather than of the module that received it. This module's own governed codes are added to it,
 * because a worker certifying his withholding can receive them and a raw code must never reach a
 * screen.
 *
 * NOTHING WAS RECORDED WHENEVER ONE OF THESE IS SHOWN. The governed sequence refuses before it
 * writes, so every message below says so plainly rather than hedging about what may have happened -
 * and on a LATER election that promise extends to his existing record: a refused correction leaves
 * the election already in force exactly as it was.
 */

import type { ExecutionRefusal } from "@/components/workforce/onboarding/execution/useExecutionSubmission";
import { OnboardingApiError } from "@/lib/workforce/onboardingApi";
import {
  EXECUTION_CONTENT_STALE_CODE,
  EXECUTION_EVIDENCE_INVALID_CODE,
  EXECUTION_INFRASTRUCTURE_UNAVAILABLE_CODES,
  EXECUTION_SUBJECT_GONE_CODES,
} from "@/lib/workforce/onboardingExecutionApi";
import { federalTaxRefusalCode } from "@/lib/workforce/federalTaxApi";

export function classifyFederalTaxRefusal(error: unknown): ExecutionRefusal {
  const own = federalTaxRefusalCode(error);
  if (own === "INTERVIEW_NOT_COMPLETE") {
    return {
      kind: "GONE",
      message:
        "Your answers are not finished and confirmed, so nothing has been put in force. Read through them above, confirm your review, and try again.",
      retryable: false,
      discardEvidence: true,
    };
  }
  if (own === "ELECTION_ALREADY_EXECUTED") {
    return {
      kind: "GONE",
      message:
        "Your choices are already in force, so nothing further was recorded. To change them, use one of the options for electing again.",
      retryable: false,
      discardEvidence: true,
    };
  }
  if (own === "EXEMPTION_CONDITIONS_REQUIRED") {
    return {
      kind: "GONE",
      message:
        "You have to confirm both of the conditions above before we can record that you are claiming no federal income tax needs to be held back. Nothing was recorded.",
      retryable: false,
      discardEvidence: true,
    };
  }
  // THE MIRROR OF "ALREADY IN FORCE", and it is a different sentence because it is the opposite
  // fact: there is nothing on his record to correct or to elect differently from.
  if (own === "NO_OPERATIVE_ELECTION") {
    return {
      kind: "GONE",
      message:
        "You do not have federal withholding choices in force yet, so there is nothing to correct or replace. Nothing was recorded. Finish the questions above and sign them first.",
      retryable: false,
      discardEvidence: true,
    };
  }
  // A CORRECTION SAYS SOMETHING WAS WRONG, AND SAYING WHAT IS PART OF IT. Refused rather than
  // recorded with an empty explanation on his permanent record.
  if (own === "CORRECTION_REASON_REQUIRED") {
    return {
      kind: "GONE",
      message:
        "Tell us what was wrong on your earlier record and we will record the correction. Nothing was recorded, and your earlier choices are untouched.",
      retryable: false,
      discardEvidence: true,
    };
  }
  // AND THE REVERSE, WHICH IS REFUSED RATHER THAN QUIETLY DROPPED (8D-R4). A reason on an election
  // that corrects nothing would put an unmeant admission of error on the record.
  if (own === "CORRECTION_REASON_NOT_PERMITTED") {
    return {
      kind: "GONE",
      message:
        "You told us your earlier record was correct for the time it applied, so there is nothing to explain. Nothing was recorded. Choose the option that says something was wrong if that is what you meant.",
      retryable: false,
      discardEvidence: true,
    };
  }
  if (own === "VALUE_NOT_GOVERNED") {
    return {
      kind: "GONE",
      message:
        "We could not tell which of the two reasons you meant, so nothing was recorded. Choose one of them and try again.",
      retryable: false,
      discardEvidence: true,
    };
  }
  if (
    own === "ELECTION_BINDING_UNAVAILABLE" ||
    own === "REVISION_BINDING_REQUIRED"
  ) {
    return {
      kind: "RETRYABLE",
      message:
        "We could not finish recording that just now, and nothing has been put in force. Please try again.",
      retryable: true,
      discardEvidence: false,
    };
  }
  if (own === "IDENTITY_NOT_AVAILABLE") {
    return {
      kind: "GONE",
      message:
        "We cannot show you the details this is based on, so we have not put anything in force. Tell your MW4H contact.",
      retryable: false,
      discardEvidence: true,
    };
  }

  const code = error instanceof OnboardingApiError ? error.code : null;
  if (code === EXECUTION_CONTENT_STALE_CODE) {
    return {
      kind: "STALE",
      message:
        "This wording was updated while you were reading it. Nothing was recorded. We have loaded the current version - please read it and sign again.",
      retryable: false,
      discardEvidence: true,
    };
  }
  if (code === EXECUTION_EVIDENCE_INVALID_CODE) {
    return {
      kind: "EVIDENCE",
      message:
        "We could not accept that signature, and nothing was recorded. Please clear it and draw it again.",
      retryable: false,
      discardEvidence: true,
    };
  }
  if (code && EXECUTION_SUBJECT_GONE_CODES.includes(code)) {
    return {
      kind: "GONE",
      message:
        "This is no longer part of your onboarding, and nothing was recorded. We have refreshed this section.",
      retryable: false,
      discardEvidence: true,
    };
  }
  // Checked BEFORE the catch-all. Nothing about the worker, his answers or his signature became
  // invalid, so telling him this is "no longer part of your onboarding" would be both wrong and
  // destructive - it would clear a signature the server is perfectly willing to accept next time.
  if (code && EXECUTION_INFRASTRUCTURE_UNAVAILABLE_CODES.includes(code)) {
    return {
      kind: "RETRYABLE",
      message:
        "We could not record that just now, and nothing has been put in force. Please try again.",
      retryable: true,
      discardEvidence: false,
    };
  }
  return {
    kind: "RETRYABLE",
    message:
      "We could not record that just now, and nothing has been put in force. Please try again.",
    retryable: true,
    discardEvidence: false,
  };
}
