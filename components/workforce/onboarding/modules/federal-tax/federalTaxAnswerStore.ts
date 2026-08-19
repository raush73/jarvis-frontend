"use client";

/**
 * Module 4.2 Federal Tax - the capsule's own in-session answers.
 *
 * WHERE UNSAVED ANSWERS LIVE, AND WHERE THEY MUST NOT. This module's answers are committed by an
 * EXPLICIT SAVE of the whole answer set through its own endpoint. Until that Save succeeds they live
 * HERE and nowhere else. In particular they never reach:
 *
 *  - the runtime's shared debounced draft, which is why the module declares no captured keys: a
 *    half-typed withholding amount must never be persisted as though the worker had elected it;
 *  - browser storage of any kind, which this file does not touch and may not. A restricted answer
 *    kept in a browser store is a second copy of protected data with no protection at rest, no
 *    supersession, no audit and no expiry - and the whole reason the saved draft is encrypted is that
 *    these values are not fit to leave lying about.
 *
 * WHY IT IS NOT COMPONENT STATE. The runtime routes each declared step to its own URL, so the
 * module's component is unmounted and remounted as the worker moves between his three steps. Answers
 * held in that component would be lost on every transition. They are therefore held here, beside the
 * capsule rather than inside one of its screens, keyed by the packet being worked in.
 *
 * WHAT THAT MEANS HONESTLY. This is memory, not persistence. A reload or a closed tab loses whatever
 * has not been saved, which is the truthful consequence of not writing restricted values anywhere a
 * worker cannot see them - and the module tells him so rather than implying his typing was kept.
 *
 * UNANSWERED IS NOT "NO". Every value starts as `null`, and null is what is HELD for a question the
 * worker has not reached. A boolean question stored as `false` before he answers would send a
 * governed answer he never gave, which is the one thing an interview must not do.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  FEDERAL_TAX_ANSWER_KEYS,
  type FederalTaxAnswerKey,
  type FederalTaxInterview,
  type SaveFederalTaxInterviewInput,
} from "@/lib/workforce/federalTaxApi";

/** One answer as an input can hold it, plus the honest third state: not answered. */
export type FederalTaxAnswerValue = string | boolean | null;

/** The whole answer set as the worker is stating it, every entry legitimately unanswered. */
export type FederalTaxAnswers = Record<FederalTaxAnswerKey, FederalTaxAnswerValue>;

function emptyAnswers(): FederalTaxAnswers {
  const answers = {} as FederalTaxAnswers;
  for (const key of FEDERAL_TAX_ANSWER_KEYS) answers[key] = null;
  return answers;
}

const EMPTY_ANSWERS: FederalTaxAnswers = emptyAnswers();

/**
 * The answers of the packets open in this browser session.
 *
 * Module scope, so they survive the step navigation that unmounts the screens, and one entry per
 * packet, so two packets can never be confused for each other.
 */
const answersByPacket = new Map<string, FederalTaxAnswers>();
/** The packets whose answers have already been offered what the server holds. */
const seeded = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** The answers for one packet. The same object until something changes it. */
export function readFederalTaxAnswers(invocationId: string): FederalTaxAnswers {
  const existing = answersByPacket.get(invocationId);
  if (existing) return existing;
  answersByPacket.set(invocationId, EMPTY_ANSWERS);
  return EMPTY_ANSWERS;
}

/** State one answer. Callers say which key changed; nothing else moves. */
export function stateFederalTaxAnswer(
  invocationId: string,
  key: FederalTaxAnswerKey,
  value: FederalTaxAnswerValue,
): void {
  const current = readFederalTaxAnswers(invocationId);
  answersByPacket.set(invocationId, { ...current, [key]: value });
  emit();
}

/**
 * Offer the saved answers to a packet that has none yet - ONCE per packet per session.
 *
 * A resuming worker should see what he saved rather than an empty interview, and a worker who has
 * typed something must never have it overwritten by a read that arrived afterwards. Both are
 * satisfied by seeding exactly once, before he has touched anything.
 *
 * SEEDED FROM THE APPLICABLE QUESTIONS ONLY, which is the same thing as saying it is seeded from
 * what the server decided. An answer the worker's own branching made inapplicable was erased on the
 * way in, so there is nothing to seed for it and no stale value can reappear here.
 */
export function seedFederalTaxAnswers(
  invocationId: string,
  interview: FederalTaxInterview,
): void {
  if (seeded.has(invocationId)) return;
  seeded.add(invocationId);
  answersByPacket.set(invocationId, answersOf(interview));
  emit();
}

/**
 * Re-seed from the server's own answer of what it just stored.
 *
 * Called after a successful Save and after nothing else. The server normalizes an answer set - it
 * erases what the worker's branching made inapplicable - so the screen must show what was actually
 * kept rather than what was sent. Without this, a worker who turns a branch off keeps looking at the
 * amounts he just erased.
 */
export function resetFederalTaxAnswersFromServer(
  invocationId: string,
  interview: FederalTaxInterview,
): void {
  seeded.add(invocationId);
  answersByPacket.set(invocationId, answersOf(interview));
  emit();
}

/**
 * The answers an interview reports, in the shape this store holds them.
 *
 * AN UNCONFIRMED CONFIRMATION IS HELD AS UNANSWERED. The server represents "has not confirmed" and
 * "declined to confirm" identically, as false, because neither is a confirmation - so a false
 * confirmation carries no intent to send back and is held as null. A YES/NO answer of `false` is
 * left exactly as it is: there, "no" is a real answer to a real question and losing it would erase
 * something the worker said.
 */
export function answersOf(interview: FederalTaxInterview): FederalTaxAnswers {
  const answers = emptyAnswers();
  for (const question of interview.questions) {
    answers[question.key] =
      question.kind === "CONFIRMATION" && question.answer !== true
        ? null
        : question.answer;
  }
  return answers;
}

/**
 * The answer set as one explicit Save states it.
 *
 * An UNANSWERED question is omitted rather than sent as false or as an empty string, because the
 * server reads an absent answer as unanswered and a present one as an answer. Sending `false` for a
 * question the worker never reached would record a governed choice he did not make.
 */
export function toSaveInput(
  answers: FederalTaxAnswers,
): SaveFederalTaxInterviewInput {
  const input: Record<string, unknown> = {};
  for (const key of FEDERAL_TAX_ANSWER_KEYS) {
    const value = answers[key];
    if (value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    input[key] = typeof value === "string" ? value.trim() : value;
  }
  return input as SaveFederalTaxInterviewInput;
}

/** TEST SUPPORT. Clears the session's answers so one suite cannot leak into another. */
export function resetFederalTaxAnswerStore(): void {
  answersByPacket.clear();
  seeded.clear();
  emit();
}

/** The packet's answers, re-rendering the caller whenever they change. */
export function useFederalTaxAnswers(invocationId: string): FederalTaxAnswers {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const snapshot = useCallback(
    () => readFederalTaxAnswers(invocationId),
    [invocationId],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
