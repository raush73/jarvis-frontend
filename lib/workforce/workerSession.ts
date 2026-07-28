/**
 * Workforce Application - worker session storage.
 *
 * The worker session is deliberately SEPARATE from the staff session. The backend
 * mints an isolated worker token (distinguished by a token-type claim) and rejects a
 * staff JWT on every worker route, so the browser must never mix the two. Staff live
 * under `jp_accessToken`; workers live under the keys below, and neither client reads
 * the other's key.
 *
 * The session is keyed by the ANONYMOUS application session, not by a Candidate: an
 * applicant arriving from a job board has no Candidate record, and one is created only after
 * a recruiter approves the submitted application. `candidateId` is therefore present only for
 * an already-identified worker and is null for everyone applying for the first time.
 */

const WORKER_TOKEN_KEY = "jp_workerSession";
const WORKER_EXPIRES_KEY = "jp_workerSessionExpiresAt";
const WORKER_APPLICATION_SESSION_KEY = "jp_workerApplicationSessionId";
const WORKER_CANDIDATE_KEY = "jp_workerCandidateId";

export const WORKER_SESSION_SYNC_EVENT = "jp:worker-session-sync";

export type WorkerSession = {
  token: string;
  expiresAt: string;
  applicationSessionId: string;
  /** Null while the applicant has no Candidate (the normal case during application). */
  candidateId: string | null;
};

function notifyChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(WORKER_SESSION_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function saveWorkerSession(session: WorkerSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKER_TOKEN_KEY, session.token);
    localStorage.setItem(WORKER_EXPIRES_KEY, session.expiresAt);
    localStorage.setItem(WORKER_APPLICATION_SESSION_KEY, session.applicationSessionId);
    if (session.candidateId) {
      localStorage.setItem(WORKER_CANDIDATE_KEY, session.candidateId);
    } else {
      localStorage.removeItem(WORKER_CANDIDATE_KEY);
    }
  } catch {
    // ignore
  }
  notifyChange();
}

/**
 * Slide the stored session onto a token the backend just reissued.
 *
 * Only the credential changes. The application session and any Candidate linkage are
 * properties of the application itself and are untouched by renewal.
 */
export function renewWorkerSessionToken(token: string, expiresAt: string): void {
  if (typeof window === "undefined") return;
  if (!token || !expiresAt) return;
  try {
    // Renewal slides an EXISTING session; it must never conjure one where the applicant
    // has no application session to belong to.
    if (!localStorage.getItem(WORKER_APPLICATION_SESSION_KEY)) return;
    localStorage.setItem(WORKER_TOKEN_KEY, token);
    localStorage.setItem(WORKER_EXPIRES_KEY, expiresAt);
  } catch {
    // ignore
  }
  notifyChange();
}

/**
 * Discard an unusable credential while KEEPING the application session identifier.
 *
 * The durable draft on the server is keyed by `applicationSessionId`. Erasing it because a
 * JWT expired would orphan everything the applicant has entered, so an expired or rejected
 * token clears only the token and its expiry. The identifier alone opens nothing: every
 * draft route still demands a valid worker-session token.
 */
export function clearWorkerAuth(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WORKER_TOKEN_KEY);
    localStorage.removeItem(WORKER_EXPIRES_KEY);
  } catch {
    // ignore
  }
  notifyChange();
}

/** Erase the whole session, application session identifier included. */
export function clearWorkerSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WORKER_TOKEN_KEY);
    localStorage.removeItem(WORKER_EXPIRES_KEY);
    localStorage.removeItem(WORKER_APPLICATION_SESSION_KEY);
    localStorage.removeItem(WORKER_CANDIDATE_KEY);
  } catch {
    // ignore
  }
  notifyChange();
}

/** The stored session, or null when absent or already expired. */
export function getWorkerSession(): WorkerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(WORKER_TOKEN_KEY);
    const expiresAt = localStorage.getItem(WORKER_EXPIRES_KEY);
    const applicationSessionId = localStorage.getItem(WORKER_APPLICATION_SESSION_KEY);
    if (!token || !expiresAt || !applicationSessionId) return null;
    if (Date.parse(expiresAt) <= Date.now()) return null;
    return {
      token,
      expiresAt,
      applicationSessionId,
      candidateId: localStorage.getItem(WORKER_CANDIDATE_KEY) || null,
    };
  } catch {
    return null;
  }
}

export function getWorkerToken(): string | null {
  return getWorkerSession()?.token ?? null;
}

/**
 * The durable application session identifier, which outlives the credential.
 *
 * Present without a usable token means the applicant's draft still exists on the server
 * but this browser can no longer reach it.
 */
export function getApplicationSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(WORKER_APPLICATION_SESSION_KEY);
  } catch {
    return null;
  }
}

export function hasWorkerSession(): boolean {
  return getWorkerSession() !== null;
}
