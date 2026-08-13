/**
 * Module 4.7 Emergency Contacts - the worker experience.
 *
 * What this suite is answerable for:
 *
 *  - The module reaches the worker through the DELIVERED Phase 1 runtime, by registration,
 *    at the canonical URL. Nothing renders a second onboarding application.
 *  - EXPLICIT SAVE, in the strong sense: no contact value is written to the shared draft, to
 *    local storage, or to session storage, and nothing at all is persisted by typing.
 *  - A refused save keeps every edit, says what was refused, and leaves the module dirty.
 *  - Save & Continue saves FIRST and completes only on confirmed persistence.
 *  - Confirming an unchanged record is its own act, and is not a re-save.
 *  - Unsaved edits cannot be lost by leaving: the worker is given save, discard, or stay, and
 *    each does exactly what it says.
 *  - The governed rules are the rules of architecture 4.7.3 - 4.7.6, reported per field.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import type {
  EmergencyContact,
  EmergencyContactProfile,
} from "@/lib/workforce/emergencyContactsApi";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock("@/lib/workforce/onboardingRuntimeApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingRuntimeApi")>();
  return {
    ...actual,
    getOnboardingRuntime: vi.fn(),
    getRuntimeModuleDraft: vi.fn(),
    saveRuntimeModuleDraft: vi.fn(),
    getOnboardingPacket: vi.fn(),
    getOnboardingSession: vi.fn(),
  };
});

vi.mock("@/lib/workforce/onboardingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/onboardingApi")>();
  return { ...actual, completeOnboardingModule: vi.fn() };
});

vi.mock("@/lib/workforce/emergencyContactsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/emergencyContactsApi")>();
  return {
    ...actual,
    getOwnEmergencyContacts: vi.fn(),
    saveOwnEmergencyContacts: vi.fn(),
  };
});

const { getOnboardingRuntime, getRuntimeModuleDraft, saveRuntimeModuleDraft, modulePath } =
  await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const { getOwnEmergencyContacts, saveOwnEmergencyContacts } = await import(
  "@/lib/workforce/emergencyContactsApi"
);
const { OnboardingRuntimeProvider } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext"
);
const { default: OnboardingModuleHost } = await import(
  "@/components/workforce/onboarding/runtime/OnboardingModuleHost"
);
const { resolveOnboardingModuleRenderer } = await import(
  "@/components/workforce/onboarding/runtime/moduleRegistry"
);
const { INVOCATION_ID, fixtureModule, fixturePacket, fixtureRuntime, step } = await import(
  "@/components/workforce/onboarding/runtime/runtimeTestFixtures"
);

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the worker layout imports
 * it. Nothing in this suite registers a renderer of its own, so what is exercised below is
 * what ships.
 */
await import("./register.worker");

const MODULE_KEY = "EMERGENCY_CONTACT";
const MODULE_SLUG = "emergency-contact";
const STEP_SLUG = "contacts";
const CANDIDATE = "candidate-fixture-1";

function emergencyContactsModule(overrides: Record<string, unknown> = {}) {
  return fixtureModule({
    moduleKey: MODULE_KEY,
    moduleNumber: "4.7",
    title: "Emergency Contacts",
    moduleSlug: MODULE_SLUG,
    completionGranularity: "EFFECTIVE_RECORD",
    steps: [step(STEP_SLUG, "Who we should call")],
    resumeStepSlug: STEP_SLUG,
    ...overrides,
  });
}

function runtimeWith(overrides: Record<string, unknown> = {}) {
  return fixtureRuntime({
    packets: [fixturePacket({ modules: [emergencyContactsModule(overrides)] })],
  });
}

function contact(overrides: Partial<EmergencyContact> = {}): EmergencyContact {
  return {
    id: "ec-1",
    setVersion: 1,
    priority: "PRIMARY",
    status: "ACTIVE",
    designation: "AUTHORIZED_TO_RECEIVE",
    fullName: "Dana Rivers",
    relationship: "SPOUSE",
    relationshipDetail: null,
    primaryPhone: "918-555-0100",
    secondaryPhone: null,
    email: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    preferredLanguage: null,
    effectiveFrom: "2026-03-01T10:00:00.000Z",
    supersededAt: null,
    recordedByType: "WORKER",
    ...overrides,
  };
}

function profile(
  contacts: EmergencyContact[] = [],
  setVersion = 1,
): EmergencyContactProfile {
  return {
    candidateId: CANDIDATE,
    setVersion: contacts.length > 0 ? setVersion : null,
    effectiveFrom: contacts.length > 0 ? "2026-03-01T10:00:00.000Z" : null,
    contacts,
    activeContactCount: contacts.filter((entry) => entry.status === "ACTIVE").length,
  };
}

function openModule() {
  return render(
    <OnboardingRuntimeProvider>
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug={MODULE_SLUG}
        stepSlug={STEP_SLUG}
      />
    </OnboardingRuntimeProvider>,
  );
}

/** Fill the one contact on screen with an admissible set of answers. */
function fillFirstContact(name = "Dana Rivers") {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Their relationship to you"), {
    target: { value: "SPOUSE" },
  });
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "918-555-0100" },
  });
  fireEvent.click(screen.getByLabelText(/May be given information about me/));
}

beforeEach(() => {
  localStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: CANDIDATE,
  });
  vi.mocked(getOnboardingRuntime).mockResolvedValue(runtimeWith());
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({
    packetId: "pkt-fixture-1",
    moduleKey: MODULE_KEY,
    data: {},
    updatedAt: null,
  });
  vi.mocked(saveRuntimeModuleDraft).mockImplementation(async (_i, _m, data) => ({
    packetId: "pkt-fixture-1",
    moduleKey: MODULE_KEY,
    data,
    updatedAt: new Date().toISOString(),
  }));
  vi.mocked(completeOnboardingModule).mockResolvedValue({
    moduleKey: MODULE_KEY,
    completionId: "cmp-1",
    effectiveFrom: new Date().toISOString(),
    versionCreated: true,
    alreadyComplete: false,
    completion: { complete: true, requiredCount: 1, completeCount: 1 },
    nextModuleKey: null,
  });
  vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile());
  vi.mocked(saveOwnEmergencyContacts).mockImplementation(async (_invocation, contacts) =>
    profile(
      contacts.map((entry, index) =>
        contact({ ...entry, id: `ec-saved-${index}`, setVersion: 2 }),
      ),
      2,
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* -------------------------------------------------------------- registration */

describe("how the module reaches the worker", () => {
  it("is rendered by the delivered runtime because its capsule registered it", async () => {
    expect(resolveOnboardingModuleRenderer(MODULE_KEY)).toBeDefined();

    openModule();

    // The runtime's own frame, with the module inside it. No second shell, no second page.
    expect(await screen.findByRole("heading", { name: "Emergency Contacts" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Who we should call" })).toBeTruthy();
    expect(document.querySelector('[data-unrendered-module]')).toBeNull();
  });

  it("lives at the canonical worker URL", () => {
    expect(modulePath(INVOCATION_ID, MODULE_SLUG, STEP_SLUG)).toBe(
      `/workforce/onboarding/${INVOCATION_ID}/emergency-contact/contacts`,
    );
  });

  it("reads the worker's own contacts from his own packet", async () => {
    openModule();

    await waitFor(() =>
      expect(vi.mocked(getOwnEmergencyContacts)).toHaveBeenCalledWith(INVOCATION_ID),
    );
  });
});

/* ------------------------------------------------------------ states on load */

describe("loading, empty, and error states", () => {
  it("says it is loading before the record arrives", async () => {
    let release: ((value: ReturnType<typeof profile>) => void) | null = null;
    vi.mocked(getOwnEmergencyContacts).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    openModule();

    expect(
      await screen.findByText("Loading your emergency contacts."),
    ).toBeTruthy();
    (release as unknown as (value: ReturnType<typeof profile>) => void)(profile());
    await waitFor(() => expect(screen.queryByText("Loading your emergency contacts.")).toBeNull());
  });

  it("says plainly that nobody has been given yet, and offers a place to start", async () => {
    openModule();

    expect(await screen.findByText(/You have not given us anyone to call yet/)).toBeTruthy();
    expect(screen.getByLabelText("Full name")).toBeTruthy();
  });

  it("reports a failed read rather than an empty form", async () => {
    vi.mocked(getOwnEmergencyContacts).mockRejectedValue(
      new OnboardingApiError("Service unavailable", 503, null),
    );

    openModule();

    await waitFor(() =>
      expect(document.querySelector('[data-ec-state="ERROR"]')).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Full name")).toBeNull();
  });

  it("shows the contacts already on the record", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(
      profile([contact(), contact({ id: "ec-2", priority: "SECONDARY", fullName: "Sam Rivers" })]),
    );

    openModule();

    await waitFor(() =>
      expect(document.querySelectorAll(".ec-contact")).toHaveLength(2),
    );
    expect((screen.getAllByLabelText("Full name")[0] as HTMLInputElement).value).toBe(
      "Dana Rivers",
    );
  });
});

/* --------------------------------------------------------------- explicit save */

describe("explicit save", () => {
  it("persists nothing at all while the worker types", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    fillFirstContact();
    // Well past the runtime's draft debounce, and past any timer this module could hold.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
    // Not through the shared draft either. The module declares no captured keys, and this is
    // what that promise means in practice.
    const draftWrites = vi
      .mocked(saveRuntimeModuleDraft)
      .mock.calls.filter(([, , data]) => JSON.stringify(data ?? {}) !== "{}");
    expect(draftWrites).toEqual([]);
    // And nothing reached the browser's own storage.
    expect(JSON.stringify(localStorage)).not.toContain("Dana Rivers");
    expect(JSON.stringify(sessionStorage)).not.toContain("Dana Rivers");
  });

  it("commits the whole set when the worker presses Save", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalledTimes(1),
    );
    const [invocation, contacts] = vi.mocked(saveOwnEmergencyContacts).mock.calls[0];
    expect(invocation).toBe(INVOCATION_ID);
    expect(contacts).toEqual([
      expect.objectContaining({
        priority: "PRIMARY",
        status: "ACTIVE",
        designation: "AUTHORIZED_TO_RECEIVE",
        fullName: "Dana Rivers",
        relationship: "SPOUSE",
        primaryPhone: "918-555-0100",
      }),
    ]);
  });

  it("is clean once the record confirms it, and says so", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    expect(document.querySelector('[data-ec-unsaved="true"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Your emergency contacts are saved.")).toBeTruthy(),
    );
    expect(document.querySelector('[data-ec-unsaved="true"]')).toBeNull();
    expect(document.querySelector('[data-ec-dirty="false"]')).toBeTruthy();
  });

  it("keeps every edit when the server refuses, and does not claim success", async () => {
    vi.mocked(saveOwnEmergencyContacts).mockRejectedValue(
      new OnboardingApiError(
        "The emergency contacts proposed are not admissible",
        400,
        "ACTIVE_CONTACT_REQUIRED",
      ),
    );

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact("Dana Rivers");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        document.querySelector('[data-ec-refusal="ACTIVE_CONTACT_REQUIRED"]'),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText("At least one of your contacts has to be someone we can call."),
    ).toBeTruthy();
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
      "Dana Rivers",
    );
    expect(document.querySelector('[data-ec-dirty="true"]')).toBeTruthy();
    expect(screen.queryByText("Your emergency contacts are saved.")).toBeNull();
  });
});

/* ---------------------------------------------------------------- validation */

describe("the governed rules, before the round trip", () => {
  it("refuses to send a contact that is missing what 4.7.4 requires", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Dana Rivers" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(document.querySelector('[data-ec-violations="true"]')).toBeTruthy(),
    );
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a phone number we can reach them on.")).toBeTruthy();
    expect(screen.getByText("Choose their relationship to you.")).toBeTruthy();
    expect(screen.getByText("Choose what this person may be told.")).toBeTruthy();
  });

  it("asks how the worker knows a contact whose relationship is Other", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();
    fireEvent.change(screen.getByLabelText("Their relationship to you"), {
      target: { value: "OTHER" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Beside the field, and in the summary above it: the same governed rule, said once in
    // each place a worker looks.
    await waitFor(() =>
      expect(
        screen.getAllByText(
          "Tell us how you know the person whose relationship you gave as Other.",
        ),
      ).toHaveLength(2),
    );
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Tell us how you know them"), {
      target: { value: "Neighbour" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalledTimes(1),
    );
  });

  it("refuses a set in which nobody would be called", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    await screen.findByLabelText("Full name");
    fireEvent.click(screen.getByLabelText(/Call this person in an emergency/));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getByText("At least one of your contacts has to be someone we can call."),
      ).toBeTruthy(),
    );
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
  });

  it("never offers more slots than the three the architecture supports", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    fireEvent.click(screen.getByRole("button", { name: "Add another contact" }));
    fireEvent.click(screen.getByRole("button", { name: "Add another contact" }));

    expect(document.querySelectorAll(".ec-contact")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Add another contact" })).toBeNull();
  });

  it("keeps a recorded contact on the record: deactivation, not deletion", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    await screen.findByLabelText("Full name");

    // The recorded contact offers no removal at all. The only way to stop being called is
    // the deactivation control beside it.
    expect(screen.queryByRole("button", { name: "Remove this contact" })).toBeNull();
    expect(screen.getByLabelText(/Call this person in an emergency/)).toBeTruthy();
  });
});

/* ----------------------------------------------------------- save & continue */

describe("Save & Continue", () => {
  it("saves first and completes only after the record confirms", async () => {
    const order: string[] = [];
    vi.mocked(saveOwnEmergencyContacts).mockImplementation(async () => {
      order.push("SAVE");
      return profile([contact({ setVersion: 2 })], 2);
    });
    vi.mocked(completeOnboardingModule).mockImplementation(async () => {
      order.push("COMPLETE");
      return {
        moduleKey: MODULE_KEY,
        completionId: "cmp-1",
        effectiveFrom: new Date().toISOString(),
        versionCreated: true,
        alreadyComplete: false,
        completion: { complete: true, requiredCount: 1, completeCount: 1 },
        nextModuleKey: null,
      };
    });

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() => expect(order).toEqual(["SAVE", "COMPLETE"]));
  });

  it("persists a changed record first, then completes", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));
    const order: string[] = [];
    vi.mocked(saveOwnEmergencyContacts).mockImplementation(async () => {
      order.push("SAVE");
      return profile([contact({ setVersion: 2 })], 2);
    });
    vi.mocked(completeOnboardingModule).mockImplementation(async () => {
      order.push("COMPLETE");
      return {
        moduleKey: MODULE_KEY,
        completionId: "cmp-1",
        effectiveFrom: new Date().toISOString(),
        versionCreated: true,
        alreadyComplete: false,
        completion: { complete: true, requiredCount: 1, completeCount: 1 },
        nextModuleKey: null,
      };
    });

    openModule();
    await screen.findByLabelText("Full name");
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "918-555-0188" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() => expect(order).toEqual(["SAVE", "COMPLETE"]));
  });

  it("writes no new version of a record the worker did not change", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    await screen.findByLabelText("Full name");

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() =>
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledTimes(1),
    );
    // The set on the record is the set being completed against. Re-posting it would
    // supersede the version actually in force with an identical one.
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
    // And continuing past an unchanged record is not the no-change CONFIRMATION, which is a
    // separate affirmative act with its own audited meaning.
    const [, options] = vi.mocked(completeOnboardingModule).mock.calls[0];
    expect(options).not.toHaveProperty("confirmNoChange");
  });

  it("writes no second version when Save is followed by Save & Continue", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByText("Your emergency contacts are saved.")).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() =>
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledTimes(1),
    );
    // The save established the returned set as the baseline, so there is nothing left to
    // commit and the second press commits nothing.
    expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalledTimes(1);
  });

  it("does not complete when the save was refused", async () => {
    vi.mocked(saveOwnEmergencyContacts).mockRejectedValue(
      new OnboardingApiError("Refused", 400, "CONTACT_FIELD_REQUIRED"),
    );

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() =>
      expect(
        document.querySelector('[data-ec-refusal="CONTACT_FIELD_REQUIRED"]'),
      ).toBeTruthy(),
    );
    expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
    // The refusal did not cost the worker his answers, and the module still knows it has
    // something unsaved to protect.
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
      "Dana Rivers",
    );
    expect(document.querySelector('[data-ec-dirty="true"]')).toBeTruthy();
  });

  it("does not complete when the module's own rules refuse the set", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() =>
      expect(document.querySelector('[data-ec-violations="true"]')).toBeTruthy(),
    );
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
    expect(vi.mocked(completeOnboardingModule)).not.toHaveBeenCalled();
  });

  it("says what the server refused when completion is refused", async () => {
    vi.mocked(completeOnboardingModule).mockRejectedValue(
      new OnboardingApiError("Please correct the following.", 400, "MODULE_COMPLETION_INVALID", [
        "ACTIVE_CONTACT_REQUIRED",
      ]),
    );

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    await waitFor(() =>
      expect(
        screen.getByText("At least one of your contacts has to be someone we can call."),
      ).toBeTruthy(),
    );
  });
});

/* -------------------------------------------------------- confirm unchanged */

describe("confirming an unchanged record", () => {
  it("is offered only where there is a record and nothing has been changed", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    const confirm = await screen.findByRole("button", {
      name: "These are still correct",
    });
    expect(confirm).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Dana R Rivers" },
    });
    expect(
      screen.queryByRole("button", { name: "These are still correct" }),
    ).toBeNull();
  });

  it("is never offered before the worker has a record", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    expect(
      screen.queryByRole("button", { name: "These are still correct" }),
    ).toBeNull();
  });

  it("uses the delivered completion path and writes no new version", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    fireEvent.click(
      await screen.findByRole("button", { name: "These are still correct" }),
    );

    await waitFor(() =>
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledWith(
        MODULE_KEY,
        expect.objectContaining({ confirmNoChange: true }),
      ),
    );
    // Not emulated by re-saving what is already there: that would version a record nobody
    // changed and destroy the distinction the audit trail is keeping.
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
  });
});

/* --------------------------------------------------------- leaving protection */

describe("unsaved edits are not lost by leaving", () => {
  async function openDirty() {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();
    return screen.getByText("Save & finish later");
  }

  it("asks the worker what to do instead of leaving silently", async () => {
    const leave = await openDirty();

    fireEvent.click(leave);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("You have not saved your emergency contacts");
    expect(push).not.toHaveBeenCalled();
  });

  it("does not ask when there is nothing unsaved", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    fireEvent.click(screen.getByText("Save & finish later"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/workforce/onboarding"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves and then leaves", async () => {
    const leave = await openDirty();
    fireEvent.click(leave);
    fireEvent.click(await screen.findByRole("button", { name: "Save and leave" }));

    await waitFor(() =>
      expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/workforce/onboarding"));
  });

  it("stays put, with the edits intact, when that save is refused", async () => {
    vi.mocked(saveOwnEmergencyContacts).mockRejectedValue(
      new OnboardingApiError("Refused", 400, "TOO_MANY_CONTACTS"),
    );

    const leave = await openDirty();
    fireEvent.click(leave);
    fireEvent.click(await screen.findByRole("button", { name: "Save and leave" }));

    await waitFor(() =>
      expect(document.querySelector('[data-ec-refusal="TOO_MANY_CONTACTS"]')).toBeTruthy(),
    );
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
      "Dana Rivers",
    );
    expect(document.querySelector('[data-ec-dirty="true"]')).toBeTruthy();
  });

  it("discards the edits and leaves when the worker says so", async () => {
    const leave = await openDirty();
    fireEvent.click(leave);
    fireEvent.click(
      await screen.findByRole("button", { name: "Leave without saving" }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/workforce/onboarding"));
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("");
  });

  it("keeps every edit and goes nowhere when the worker cancels", async () => {
    const leave = await openDirty();
    fireEvent.click(leave);
    fireEvent.click(await screen.findByRole("button", { name: "Stay on this page" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(push).not.toHaveBeenCalled();
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
      "Dana Rivers",
    );
    expect(document.querySelector('[data-ec-dirty="true"]')).toBeTruthy();
  });

  it("protects a jump from the packet rail as well as the buttons", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({
        packets: [
          fixturePacket({
            modules: [
              emergencyContactsModule({ position: 1 }),
              fixtureModule({
                moduleKey: "FIXTURE_BETA",
                title: "Fixture Beta",
                position: 2,
              }),
            ],
          }),
        ],
      }),
    );

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.click(screen.getByRole("link", { name: "Fixture Beta" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("stops protecting once the worker has left the module", async () => {
    const view = openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    view.unmount();

    // The guard went with the module. Nothing here can be asserted about a screen that no
    // longer exists, so what is asserted is that leaving it did not throw and left no
    // dialog behind for the next module to inherit.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("warns the browser itself while there is something to lose", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fillFirstContact();

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

/* ------------------------------------------------------------ recorded state */

describe("once the module is complete", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      runtimeWith({ status: "COMPLETE" }),
    );
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));
  });

  it("shows the record rather than a form", async () => {
    openModule();

    expect(
      await screen.findByText("Your emergency contacts are on your record."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.getByText("Dana Rivers")).toBeTruthy();
  });

  it("offers an explicit way to change it", async () => {
    openModule();

    fireEvent.click(
      await screen.findByRole("button", { name: "Change these contacts" }),
    );

    expect(screen.getByLabelText("Full name")).toBeTruthy();
  });
});
