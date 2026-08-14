/**
 * Module 4.1 - the Employment Eligibility API client.
 *
 * What these prove is the SEAM rather than the screen:
 *
 *  - Both routes are the certified worker routes, addressed exactly as the backend mounted them,
 *    and this client invents no third one.
 *  - A Save states the WHOLE version in one request, with no identifier for the worker, the
 *    candidate, the actor, the packet or the record anywhere in the body.
 *  - The client sends NO reference to the governed record the attestation is about. Which record an
 *    act answers for is the server's determination, and a client that stated it could contradict it.
 *  - A fact the catalogue does not capture is OMITTED rather than sent empty, which is what keeps
 *    the one acceptable document whose printed number is a Social Security Number free of a number.
 *  - A governed refusal keeps its code, which is what lets the surface say what was refused.
 *  - There is no examination call, no certification call and no completion call: a worker cannot
 *    reach any of them, and this client could not make one if it tried.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { saveWorkerSession } from "./workerSession";
import { OnboardingApiError } from "./onboardingApi";
import { WorkerSessionExpiredError } from "./workforceApi";
import {
  EMPLOYMENT_ELIGIBILITY_ATTESTATION_SUBJECT_KEY,
  EMPLOYMENT_ELIGIBILITY_CERTIFICATION_BLOCKS,
  EMPLOYMENT_ELIGIBILITY_DOCUMENT_FIELDS,
  EMPLOYMENT_ELIGIBILITY_DOCUMENT_LISTS,
  EMPLOYMENT_ELIGIBILITY_EVIDENCE_SLOT_KEY,
  EMPLOYMENT_ELIGIBILITY_MODULE_KEY,
  EMPLOYMENT_ELIGIBILITY_STATUSES,
  EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE,
  EMPLOYMENT_ELIGIBILITY_STEP_SLUGS,
  EMPLOYMENT_ELIGIBILITY_WORKER_PHASE_STATES,
  employmentEligibilityRefusalCode,
  getOwnEmploymentEligibility,
  saveOwnEmploymentEligibility,
  type SaveEmploymentEligibilityInput,
} from "./employmentEligibilityApi";

const INVOCATION = "invocation-1";
const CANDIDATE = "candidate-1";
const CAPSULE_PATH = `/workforce/onboarding/runtime/packets/${INVOCATION}/employment-eligibility`;

const VERSION: SaveEmploymentEligibilityInput = {
  attestation: { status: "US_CITIZEN", identityConfirmed: true },
  documents: [
    {
      documentTypeKey: "US_PASSPORT",
      documentNumber: "X1234567",
      issuingAuthority: "United States Department of State",
      expiresOn: "2031-04-30",
      onboardingDocumentId: "onb-doc-1",
    },
  ],
};

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response);
}

function emptyState() {
  return {
    moduleKey: EMPLOYMENT_ELIGIBILITY_MODULE_KEY,
    moduleNumber: "4.1",
    record: {
      setVersion: null,
      effectiveFrom: null,
      status: null,
      workAuthorizationExpiresOn: null,
      identityConfirmed: false,
      workerPhaseState: null,
      catalogueVersion: null,
      documents: [],
    },
    offeredDocuments: [],
    catalogueVersion: "2026-08-13",
    certificationBlocks: ["WORKER_PHASE_OUTSTANDING"],
    examinationRecorded: false,
    certificationRecorded: false,
  };
}

function ok(value: unknown = emptyState()) {
  return respondWith(200, { ok: true, value });
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
}

function documentsOf(
  fetchMock: ReturnType<typeof vi.fn>,
): Record<string, unknown>[] {
  return (bodyOf(fetchMock) as { documents: Record<string, unknown>[] }).documents;
}

beforeEach(() => {
  localStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: CANDIDATE,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

/* ------------------------------------------------------------ worker routes */

describe("routes and transport", () => {
  it("reads the worker's own state from the packet-addressed capsule path", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await getOwnEmploymentEligibility(INVOCATION);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(CAPSULE_PATH);
    expect(init.method).toBe("GET");
  });

  it("saves by POST to the same path, and to nothing per document", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, VERSION);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(CAPSULE_PATH);
    expect(url).not.toContain("/documents");
    expect(url).not.toContain("US_PASSPORT");
    expect(init.method).toBe("POST");
  });

  it("carries the worker session, and attempts nothing without one", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await getOwnEmploymentEligibility(INVOCATION);
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer worker-token");

    localStorage.clear();
    await expect(getOwnEmploymentEligibility(INVOCATION)).rejects.toBeInstanceOf(
      WorkerSessionExpiredError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("encodes the invocation rather than interpolating it raw", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await getOwnEmploymentEligibility("inv/../other");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("inv%2F..%2Fother");
  });
});

/* --------------------------------------------------------------- save shape */

describe("what a save states", () => {
  it("sends the whole version as one request", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, {
      attestation: {
        status: "AUTHORIZED_TO_WORK",
        workAuthorizationExpiresOn: "2027-09-30",
        identityConfirmed: true,
      },
      documents: [
        { documentTypeKey: "DRIVERS_LICENSE", documentNumber: "D-1", issuingAuthority: "Oklahoma" },
        { documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = bodyOf(fetchMock) as {
      attestation: Record<string, unknown>;
      documents: unknown[];
    };
    expect(body.attestation).toEqual({
      status: "AUTHORIZED_TO_WORK",
      identityConfirmed: true,
      workAuthorizationExpiresOn: "2027-09-30",
    });
    expect(body.documents).toHaveLength(2);
  });

  it("carries no identity of any kind in the body", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, VERSION);

    const serialized = JSON.stringify(bodyOf(fetchMock));
    for (const forbidden of [
      "candidateId",
      "workerId",
      "actorId",
      "actorType",
      "packetId",
      "invocationId",
      "recordedById",
      "setVersion",
      "effectiveFrom",
      "catalogueVersion",
      "workerPhaseState",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("states nothing about WHICH governed record an attestation would answer for", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, VERSION);

    // Whether an earlier act still answers for the record now in force is the server's
    // determination, made from the record itself. A client that stated it could contradict it.
    expect(JSON.stringify(bodyOf(fetchMock))).not.toContain("governedRecordRef");
  });

  it("omits an authorization end date the chosen category does not carry", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, {
      attestation: {
        status: "US_CITIZEN",
        workAuthorizationExpiresOn: null,
        identityConfirmed: true,
      },
      documents: VERSION.documents,
    });

    const { attestation } = bodyOf(fetchMock) as { attestation: Record<string, unknown> };
    expect(attestation).not.toHaveProperty("workAuthorizationExpiresOn");
  });

  it("omits every per-document fact the caller did not state", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, {
      attestation: VERSION.attestation,
      documents: [
        {
          documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
          documentNumber: null,
          issuingAuthority: "   ",
          expiresOn: "",
          onboardingDocumentId: "onb-doc-9",
        },
      ],
    });

    const [document] = documentsOf(fetchMock);
    // The card the catalogue captures no number for is submitted with no number AT ALL, rather
    // than with an empty one. That is the whole mechanism by which this module never holds a
    // Social Security Number.
    expect(document).not.toHaveProperty("documentNumber");
    expect(document).not.toHaveProperty("issuingAuthority");
    expect(document).not.toHaveProperty("expiresOn");
    expect(document).toEqual({
      documentTypeKey: "SOCIAL_SECURITY_ACCOUNT_NUMBER_CARD",
      onboardingDocumentId: "onb-doc-9",
    });
  });

  it("carries the confirmed capture binding when the worker presented one", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, VERSION);

    const [document] = documentsOf(fetchMock);
    expect(document.onboardingDocumentId).toBe("onb-doc-1");
    // And no file, no storage key and no upload of any kind travels with it.
    expect(JSON.stringify(document)).not.toContain("storage");
  });

  it("omits the binding entirely for a document with no confirmed capture yet", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmploymentEligibility(INVOCATION, {
      attestation: VERSION.attestation,
      documents: [{ documentTypeKey: "US_PASSPORT", onboardingDocumentId: null }],
    });

    expect(documentsOf(fetchMock)[0]).not.toHaveProperty("onboardingDocumentId");
  });
});

/* ------------------------------------------------------------------ refusal */

describe("refusals", () => {
  it("preserves the governed refusal code for the surface to classify", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(400, {
        statusCode: 400,
        code: "DOCUMENT_COMBINATION_INVALID",
        message: "The employment eligibility version proposed is not admissible",
      }),
    );

    const failure = await saveOwnEmploymentEligibility(INVOCATION, VERSION).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(OnboardingApiError);
    expect(employmentEligibilityRefusalCode(failure)).toBe(
      "DOCUMENT_COMBINATION_INVALID",
    );
  });

  it("reports a failure that is not a governed refusal as no code at all", async () => {
    vi.stubGlobal("fetch", respondWith(500, { message: "boom" }));

    const failure = await saveOwnEmploymentEligibility(INVOCATION, VERSION).catch(
      (error: unknown) => error,
    );

    expect(employmentEligibilityRefusalCode(failure)).toBeNull();
  });
});

/* ----------------------------------------------------- vocabulary and limits */

describe("the governed vocabulary, mirrored and closed", () => {
  it("mirrors the module's own constants exactly", () => {
    expect(EMPLOYMENT_ELIGIBILITY_MODULE_KEY).toBe("EMPLOYMENT_ELIGIBILITY");
    expect(EMPLOYMENT_ELIGIBILITY_STEP_SLUGS).toEqual([
      "identity",
      "work-authorization",
      "documents",
    ]);
    expect(EMPLOYMENT_ELIGIBILITY_STATUSES).toEqual([
      "US_CITIZEN",
      "NONCITIZEN_NATIONAL",
      "LAWFUL_PERMANENT_RESIDENT",
      "AUTHORIZED_TO_WORK",
    ]);
    expect(EMPLOYMENT_ELIGIBILITY_DOCUMENT_LISTS).toEqual([
      "LIST_A",
      "LIST_B",
      "LIST_C",
    ]);
    expect(EMPLOYMENT_ELIGIBILITY_DOCUMENT_FIELDS).toEqual([
      "documentNumber",
      "issuingAuthority",
      "expiresOn",
    ]);
    expect(EMPLOYMENT_ELIGIBILITY_WORKER_PHASE_STATES).toEqual([
      "RECORDED",
      "ATTESTED",
    ]);
    expect(EMPLOYMENT_ELIGIBILITY_CERTIFICATION_BLOCKS).toContain(
      "WORKER_ATTESTATION_OUTSTANDING",
    );
    expect(EMPLOYMENT_ELIGIBILITY_ATTESTATION_SUBJECT_KEY).toBe("WORKER_ATTESTATION");
    expect(EMPLOYMENT_ELIGIBILITY_EVIDENCE_SLOT_KEY).toBe(
      "EMPLOYMENT_AUTHORIZATION_EVIDENCE",
    );
  });

  it("knows exactly one category that carries an end date", () => {
    expect(EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE).toEqual([
      "AUTHORIZED_TO_WORK",
    ]);
  });
});

/* --------------------------------------------------- what the client is not */

describe("the boundaries this client keeps", () => {
  const file = readFileSync(join(__dirname, "employmentEligibilityApi.ts"), "utf8");
  // Prose about a capability the module reaches ELSEWHERE, or refuses to reach at all, is not
  // that capability. These assertions are about the code, so the comments are removed first.
  const source = file.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("has no Social Security Number in any shape", () => {
    for (const forbidden of ["socialSecurity", "ssn", "SSN", "taxIdentification"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  /**
   * ADVANCED WITH THE AUTHORIZED MW4H GATE.
   *
   * This assertion said the whole client offered no examination and no disclosure, which was true
   * of a client that had only a worker half. The authorized employer surface now lives beside that
   * half in this file, so the claim is made where it still holds - and where it matters most: the
   * WORKER's half of the client reaches no employer capability at all. He presents documents; the
   * examination and the disclosure are the reviewer's, on the staff transport, and nothing on the
   * worker's path can reach them.
   */
  const workerHalf = source.split(
    "EMPLOYMENT_ELIGIBILITY_EXAMINATION_METHODS",
  )[0];

  it("keeps the WORKER half free of every employer capability", () => {
    for (const forbidden of ["examine", "reveal", "onboardingAdminFetch("]) {
      expect(workerHalf).not.toContain(forbidden);
    }
  });

  it("offers no certification, no completion, and no determination anywhere", () => {
    for (const forbidden of [
      // Certification is a consequential act taken through the delivered administrative action
      // surface, whose outcome the server DERIVES from governed state. No caller can ask for it.
      "certify",
      "certification(",
      "complete",
      // And nothing on either side of this client decides acceptability for itself.
      "restrictiveLegend",
      "unrestrictedAffirmed",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("generates no reference to a governed record, and sends none", () => {
    expect(source).not.toContain("governedRecordRef");
  });

  it("adds no transport, no upload and no browser storage", () => {
    // BOTH delivered transports, and neither invented here: the worker's session carries the worker
    // routes and the staff session carries the authorized ones. A second copy of either would be a
    // second place for expiry, renewal and refusal classification to drift.
    expect(source).toContain('from "./onboardingApi"');
    expect(source).toContain('from "./onboardingAdminApi"');
    expect(source).not.toContain("await fetch(");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("uploadToStorage");
  });

  it("adds no deferred capability", () => {
    for (const forbidden of [
      "supplement",
      "preparer",
      "translator",
      "reverification",
      "verify",
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
