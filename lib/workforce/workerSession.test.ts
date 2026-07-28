import { beforeEach, describe, expect, it } from "vitest";
import {
  clearWorkerAuth,
  clearWorkerSession,
  getApplicationSessionId,
  getWorkerSession,
  hasWorkerSession,
  renewWorkerSessionToken,
  saveWorkerSession,
} from "./workerSession";

const TOKEN_KEY = "jp_workerSession";
const EXPIRES_KEY = "jp_workerSessionExpiresAt";
const APPLICATION_SESSION_KEY = "jp_workerApplicationSessionId";
const CANDIDATE_KEY = "jp_workerCandidateId";

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

describe("worker session storage", () => {
  beforeEach(() => {
    localStorage.clear();
    saveWorkerSession({
      token: "original-token",
      expiresAt: inMinutes(20),
      applicationSessionId: "apps_durable",
      candidateId: null,
    });
  });

  describe("renewWorkerSessionToken", () => {
    it("replaces the credential and leaves the application session alone", () => {
      const renewedExpiry = inMinutes(60);
      renewWorkerSessionToken("renewed-token", renewedExpiry);

      expect(getWorkerSession()).toEqual({
        token: "renewed-token",
        expiresAt: renewedExpiry,
        applicationSessionId: "apps_durable",
        candidateId: null,
      });
    });

    it("refuses to create a session where there is no application to belong to", () => {
      localStorage.clear();
      renewWorkerSessionToken("renewed-token", inMinutes(60));

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(hasWorkerSession()).toBe(false);
    });

    it("ignores an incomplete renewal", () => {
      renewWorkerSessionToken("renewed-token", "");
      expect(localStorage.getItem(TOKEN_KEY)).toBe("original-token");
    });
  });

  describe("clearWorkerAuth", () => {
    it("drops the credential but keeps the durable application session identifier", () => {
      clearWorkerAuth();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(EXPIRES_KEY)).toBeNull();
      expect(getApplicationSessionId()).toBe("apps_durable");
    });

    /**
     * Keeping the identifier must not become a way in. Every draft route still requires a
     * worker-session token, and locally there is no longer a session to present.
     */
    it("leaves no usable session behind", () => {
      clearWorkerAuth();

      expect(hasWorkerSession()).toBe(false);
      expect(getWorkerSession()).toBeNull();
    });
  });

  describe("clearWorkerSession", () => {
    it("erases everything when the applicant deliberately starts over", () => {
      saveWorkerSession({
        token: "original-token",
        expiresAt: inMinutes(20),
        applicationSessionId: "apps_durable",
        candidateId: "cand_9",
      });

      clearWorkerSession();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(EXPIRES_KEY)).toBeNull();
      expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBeNull();
      expect(localStorage.getItem(CANDIDATE_KEY)).toBeNull();
    });
  });

  describe("getWorkerSession", () => {
    it("reports no session once the stored expiry has passed", () => {
      saveWorkerSession({
        token: "original-token",
        expiresAt: inMinutes(-1),
        applicationSessionId: "apps_durable",
        candidateId: null,
      });

      expect(getWorkerSession()).toBeNull();
      expect(getApplicationSessionId()).toBe("apps_durable");
    });
  });
});
