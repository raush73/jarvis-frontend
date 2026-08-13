/**
 * Module 4.7 - the emergency contacts API client.
 *
 * What these prove is the SEAM rather than the screen:
 *
 *  - Both routes are the Gate 6A routes, addressed exactly as the backend mounted them, and
 *    this client invents no third one.
 *  - The worker calls carry the worker session and the staff call carries the staff
 *    credential. Neither client can reach the other's surface, because neither knows how.
 *  - A Save states the whole set, in one request, with no identifier for the worker, the
 *    candidate, the actor, the packet, or the contact anywhere in the body.
 *  - A governed refusal keeps its code, which is what lets the surface say what was refused.
 *  - There is no staff write, and no confirm-unchanged call: both would be second subsystems
 *    for capabilities that already exist.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { saveWorkerSession } from "./workerSession";
import { OnboardingApiError } from "./onboardingApi";
import { OnboardingAdminApiError } from "./onboardingAdminApi";
import { WorkerSessionExpiredError } from "./workforceApi";
import {
  EMERGENCY_CONTACT_DESIGNATIONS,
  EMERGENCY_CONTACT_MAX_CONTACTS,
  EMERGENCY_CONTACT_PRIORITIES,
  EMERGENCY_CONTACT_RELATIONSHIPS,
  EMERGENCY_CONTACT_STATUSES,
  emergencyContactRefusalCode,
  getOwnEmergencyContacts,
  getStaffEmergencyContacts,
  saveOwnEmergencyContacts,
  type EmergencyContactInput,
} from "./emergencyContactsApi";

const INVOCATION = "invocation-1";
const CANDIDATE = "candidate-1";
const STAFF_TOKEN_KEY = "jp_accessToken";

const CONTACT: EmergencyContactInput = {
  priority: "PRIMARY",
  status: "ACTIVE",
  designation: "AUTHORIZED_TO_RECEIVE",
  fullName: "Dana Rivers",
  relationship: "SPOUSE",
  primaryPhone: "918-555-0100",
};

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response);
}

function ok(value: unknown) {
  return respondWith(200, { ok: true, value });
}

function emptyProfile() {
  return {
    candidateId: CANDIDATE,
    setVersion: null,
    effectiveFrom: null,
    contacts: [],
    activeContactCount: 0,
  };
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
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

describe("worker routes and transport", () => {
  it("reads the worker's contacts from the packet-addressed capsule path", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await getOwnEmergencyContacts(INVOCATION);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `/workforce/onboarding/runtime/packets/${INVOCATION}/emergency-contacts`,
    );
    expect(init.method).toBe("GET");
  });

  it("saves by POST to the same collection, and to nothing per-contact", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmergencyContacts(INVOCATION, [CONTACT]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `/workforce/onboarding/runtime/packets/${INVOCATION}/emergency-contacts`,
    );
    expect(url).not.toContain("/PRIMARY");
    expect(init.method).toBe("POST");
  });

  it("carries the worker session, and attempts nothing without one", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await getOwnEmergencyContacts(INVOCATION);
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer worker-token");

    localStorage.clear();
    await expect(getOwnEmergencyContacts(INVOCATION)).rejects.toBeInstanceOf(
      WorkerSessionExpiredError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("encodes the invocation rather than interpolating it raw", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await getOwnEmergencyContacts("inv/../other");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("inv%2F..%2Fother");
  });
});

/* --------------------------------------------------------------- save shape */

describe("what a save states", () => {
  it("sends the whole set as one request", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmergencyContacts(INVOCATION, [
      CONTACT,
      { ...CONTACT, priority: "SECONDARY", fullName: "Sam Rivers" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = bodyOf(fetchMock) as { contacts: unknown[] };
    expect(body.contacts).toHaveLength(2);
  });

  it("carries no identity of any kind in the body", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmergencyContacts(INVOCATION, [CONTACT]);

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
      '"id"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("omits an absent optional attribute rather than sending it empty", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmergencyContacts(INVOCATION, [
      { ...CONTACT, email: "", secondaryPhone: null, city: undefined },
    ]);

    const [contact] = (bodyOf(fetchMock) as { contacts: Record<string, unknown>[] })
      .contacts;
    expect(contact).not.toHaveProperty("email");
    expect(contact).not.toHaveProperty("secondaryPhone");
    expect(contact).not.toHaveProperty("city");
    expect(contact.fullName).toBe("Dana Rivers");
  });

  it("sends the governed detail when the worker stated one", async () => {
    const fetchMock = ok(emptyProfile());
    vi.stubGlobal("fetch", fetchMock);

    await saveOwnEmergencyContacts(INVOCATION, [
      { ...CONTACT, relationship: "OTHER", relationshipDetail: "Neighbour" },
    ]);

    const [contact] = (bodyOf(fetchMock) as { contacts: Record<string, unknown>[] })
      .contacts;
    expect(contact.relationship).toBe("OTHER");
    expect(contact.relationshipDetail).toBe("Neighbour");
  });
});

/* ------------------------------------------------------------------ refusal */

describe("refusals", () => {
  it("preserves the governed refusal code for the surface to classify", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(400, {
        statusCode: 400,
        code: "ACTIVE_CONTACT_REQUIRED",
        message: "The emergency contacts proposed are not admissible",
        details: { violations: [{ code: "ACTIVE_CONTACT_REQUIRED" }] },
      }),
    );

    const failure = await saveOwnEmergencyContacts(INVOCATION, [CONTACT]).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(OnboardingApiError);
    expect(emergencyContactRefusalCode(failure)).toBe("ACTIVE_CONTACT_REQUIRED");
  });

  it("reports a failure that is not a governed refusal as no code at all", async () => {
    vi.stubGlobal("fetch", respondWith(500, { message: "boom" }));

    const failure = await saveOwnEmergencyContacts(INVOCATION, [CONTACT]).catch(
      (error: unknown) => error,
    );

    expect(emergencyContactRefusalCode(failure)).toBeNull();
  });
});

/* ------------------------------------------------------------- staff surface */

describe("the authorized staff read", () => {
  beforeEach(() => {
    localStorage.setItem(STAFF_TOKEN_KEY, "staff-token");
  });

  it("reads the capsule's staff route with the STAFF credential", async () => {
    const fetchMock = ok({ current: emptyProfile(), history: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getStaffEmergencyContacts(CANDIDATE);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `/workforce/onboarding/modules/emergency-contacts/workers/${CANDIDATE}`,
    );
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer staff-token");
  });

  it("is mounted under the module root rather than the administrative application", async () => {
    const fetchMock = ok({ current: emptyProfile(), history: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getStaffEmergencyContacts(CANDIDATE);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain("/workforce/onboarding/admin");
  });

  it("returns the history the staff route carries alongside what is current", async () => {
    vi.stubGlobal(
      "fetch",
      ok({
        current: emptyProfile(),
        history: [{ id: "ec-1", supersededAt: "2026-01-01T00:00:00.000Z" }],
      }),
    );

    const view = await getStaffEmergencyContacts(CANDIDATE);

    expect(view.history).toHaveLength(1);
  });

  it("surfaces a staff refusal as the administrative error, with its code", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(403, { code: "FORBIDDEN", message: "Missing permission" }),
    );

    const failure = await getStaffEmergencyContacts(CANDIDATE).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(OnboardingAdminApiError);
    expect((failure as OnboardingAdminApiError).code).toBe("FORBIDDEN");
  });
});

/* --------------------------------------------------- what the client is not */

describe("the boundaries this client keeps", () => {
  const file = readFileSync(join(__dirname, "emergencyContactsApi.ts"), "utf8");
  // Prose about a capability the module reaches ELSEWHERE is not that capability. These
  // assertions are about the code, so the comments are removed before reading it.
  const source = file.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("offers no staff write of any kind", () => {
    for (const forbidden of [
      "saveStaffEmergencyContacts",
      "deleteEmergencyContact",
      "reorderEmergencyContacts",
      "deactivateEmergencyContact",
      "verifyEmergencyContacts",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toContain("onboardingAdminFetch<EmergencyContactProfile>");
  });

  it("adds no confirm-unchanged route of its own", () => {
    expect(source).not.toContain("confirmNoChange");
    expect(source).not.toContain("/confirm");
  });

  it("adds no transport, and reuses the two delivered ones", () => {
    expect(source).toContain('from "./onboardingApi"');
    expect(source).toContain('from "./onboardingAdminApi"');
    expect(source).not.toContain("await fetch(");
    expect(source).not.toContain("localStorage");
  });

  it("mirrors the governed vocabulary exactly, and closes it", () => {
    expect(EMERGENCY_CONTACT_PRIORITIES).toEqual(["PRIMARY", "SECONDARY", "TERTIARY"]);
    expect(EMERGENCY_CONTACT_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
    expect(EMERGENCY_CONTACT_DESIGNATIONS).toEqual([
      "AUTHORIZED_TO_RECEIVE",
      "NOTIFICATION_ONLY",
    ]);
    expect(EMERGENCY_CONTACT_RELATIONSHIPS).toContain("OTHER");
    expect(EMERGENCY_CONTACT_RELATIONSHIPS).toHaveLength(8);
    expect(EMERGENCY_CONTACT_MAX_CONTACTS).toBe(3);
  });
});
