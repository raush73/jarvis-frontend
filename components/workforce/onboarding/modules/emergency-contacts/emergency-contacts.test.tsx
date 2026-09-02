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

const {
  getOnboardingRuntime,
  getOnboardingPacket,
  getRuntimeModuleDraft,
  saveRuntimeModuleDraft,
  modulePath,
  packetPath,
} = await import("@/lib/workforce/onboardingRuntimeApi");
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

  /**
   * A LISTED EMERGENCY CONTACT IS AN EMERGENCY CONTACT.
   *
   * The module used to ask, per person, whether we may call them - which invited a worker to
   * list someone and then tell us not to call them, and made the obvious reading of his own
   * list wrong. There is no such question now: the decision he makes is who is on the list.
   */
  it("does not ask whether a listed contact may be called", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    await screen.findByLabelText("Full name");

    expect(screen.queryByLabelText(/Call this person in an emergency/i)).toBeNull();
    expect(screen.queryByText(/without us calling them/i)).toBeNull();
  });

  it("never offers more slots than the three the architecture supports", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    fireEvent.click(screen.getByRole("button", { name: "Add another contact" }));
    fireEvent.click(screen.getByRole("button", { name: "Add another contact" }));

    expect(document.querySelectorAll(".ec-contact")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Add another contact" })).toBeNull();
  });

  /**
   * REMOVAL IS FROM THE CURRENT SET, NOT FROM THE RECORD.
   *
   * What the worker is deciding is who we should call today. What he submits is the whole
   * current set, and the set he is replacing is retained as its own version by the record
   * authority - so a contact he takes off his list stops being called and does not stop
   * having existed. Nothing here deletes anything, and there is no route through which it
   * could: the only write this module performs is a save of the set.
   */
  it("removes a contact from the current set and submits the set without him", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(
      profile([
        contact(),
        contact({
          id: "ec-2",
          priority: "SECONDARY",
          fullName: "Ray Rivers",
          relationship: "PARENT",
          primaryPhone: "918-555-0199",
        }),
      ]),
    );

    openModule();
    await screen.findAllByLabelText("Full name");

    // A recorded contact offers removal, in the worker's own terms.
    const remove = screen.getAllByRole("button", { name: "Remove this contact" });
    expect(remove).toHaveLength(2);

    fireEvent.click(remove[1]);
    expect(document.querySelectorAll(".ec-contact")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalledTimes(1),
    );

    const [, submitted] = vi.mocked(saveOwnEmergencyContacts).mock.calls[0];
    expect(submitted.map((entry) => entry.fullName)).toEqual(["Dana Rivers"]);
    // He was removed from the set, not marked uncallable within it.
    expect(submitted.every((entry) => entry.status === "ACTIVE")).toBe(true);
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

  it("leads him back to his own packet rather than to every packet he has held", async () => {
    openModule();

    const home = await waitFor(() => {
      const found = document.querySelector("[data-ec-return-to-packet]");
      if (!found) throw new Error("no way out rendered");
      return found;
    });
    expect(home.getAttribute("href")).toBe(packetPath(INVOCATION_ID));
    expect(home.textContent).toBe("Back to my sections");
  });
});

/* -------------------------------------------------------- preferred language */

/**
 * QA-L5-UX-6. The language a contact prefers is CHOSEN rather than typed.
 *
 * A free-text box collected "spanish", "Spanish ", "Espanol" and "esp" for one language, which
 * is unusable by the person who has to make the call. The offered list settles the common
 * answers; Other keeps the uncommon ones sayable. Persistence is unchanged - the attribute is
 * the same nullable string it always was, and nothing here is a closed set in the database.
 */
describe("the language a contact prefers", () => {
  /** The chooser, by the label the worker reads. */
  function languageSelect(): HTMLSelectElement {
    return screen.getByLabelText(/Language they prefer/) as HTMLSelectElement;
  }

  /** The free-text box, which exists only once Other has been chosen. */
  function ownLanguage(): HTMLInputElement | null {
    return screen.queryByLabelText("The language they prefer") as HTMLInputElement | null;
  }

  /** Save the set and hand back the one contact that went to the server. */
  async function savedContact() {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalled());
    const [, sent] = vi.mocked(saveOwnEmergencyContacts).mock.calls[0];
    return sent[0];
  }

  it("offers the ratified languages, and nothing typed in their place", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    const offered = Array.from(languageSelect().options).map(
      (option) => option.textContent,
    );
    expect(offered).toEqual([
      "Select a language",
      "English",
      "Spanish",
      "French",
      "Haitian Creole",
      "Portuguese",
      "Chinese",
      "Vietnamese",
      "Arabic",
      "Korean",
      "Russian",
      "Other",
    ]);
    // Nothing is preselected: a language nobody stated is not a language.
    expect(languageSelect().value).toBe("");
    expect(ownLanguage()).toBeNull();
  });

  it("sends a chosen language exactly as the list says it", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();
    fireEvent.change(languageSelect(), { target: { value: "Haitian Creole" } });

    expect((await savedContact()).preferredLanguage).toBe("Haitian Creole");
  });

  it("lets him say a language the list does not offer", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    fireEvent.change(languageSelect(), { target: { value: "OTHER" } });
    const own = ownLanguage();
    expect(own).toBeTruthy();
    fireEvent.change(own as HTMLInputElement, { target: { value: "Twi" } });

    // WHAT HE TYPED, AND NOT THE WORD "OTHER". The choice is how he was asked; the language
    // is what gets recorded, through the same string attribute as every other answer.
    expect((await savedContact()).preferredLanguage).toBe("Twi");
  });

  it("reads back a stored language the list does not offer, and keeps it on a re-save", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(
      profile([contact({ preferredLanguage: "Twi" })]),
    );

    openModule();
    await screen.findByLabelText("Full name");

    // A value from before the chooser existed is neither lost nor silently changed: it is
    // shown as what it is, under Other, and it is still his answer until he says otherwise.
    expect(languageSelect().value).toBe("OTHER");
    expect(ownLanguage()?.value).toBe("Twi");

    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "918-555-0199" },
    });
    expect((await savedContact()).preferredLanguage).toBe("Twi");
  });

  it("recognises a stored language the list does offer, however it was capitalised", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(
      profile([contact({ preferredLanguage: "spanish" })]),
    );

    openModule();
    await screen.findByLabelText("Full name");

    // The same language, so the same option - not an "Other" holding a word that is on the
    // list. Nothing is rewritten on his record by looking at it.
    expect(languageSelect().value).toBe("Spanish");
    expect(ownLanguage()).toBeNull();
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
  });

  it("leaves a contact with no stated language unstated", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    expect((await savedContact()).preferredLanguage).toBeNull();
  });
});

/* --------------------------------------------------------------- worker copy */

/**
 * QA-L5-UX-7. What the worker reads, and what he is not made to read.
 *
 * The correction is to stop narrating what a worker already knows, not to remove guidance. The
 * three facts kept below are each material: one of them is the governed meaning of an
 * attribute, and one of them is this module's own unusual save behaviour.
 */
describe("what the worker is told", () => {
  it("identifies each contact by the order we would call them", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    expect(screen.getByRole("heading", { name: "Emergency Contact 1" })).toBeTruthy();
  });

  it("numbers by the governed order and never by position on the screen", async () => {
    // ONE CONTACT, AND HE IS THE THIRD WE WOULD CALL. Numbering by array position would call
    // him "Emergency Contact 1", which would state something about his record that is false.
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(
      profile([contact({ priority: "TERTIARY" })]),
    );

    openModule();
    await screen.findByLabelText("Full name");

    expect(screen.getByRole("heading", { name: "Emergency Contact 3" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Emergency Contact 1" })).toBeNull();
    expect(
      document.querySelector('[data-contact-ordinal="TERTIARY"]')?.textContent,
    ).toBe("Emergency Contact 3");
  });

  it("renumbers a contact the moment his place in the order changes", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));

    openModule();
    await screen.findByLabelText("Full name");
    expect(screen.getByRole("heading", { name: "Emergency Contact 1" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("When we should call this person"), {
      target: { value: "SECONDARY" },
    });

    // The heading follows the attribute rather than the card, because the number IS the
    // attribute said in the worker's words.
    expect(screen.getByRole("heading", { name: "Emergency Contact 2" })).toBeTruthy();
  });

  it("numbers the record the same way it numbers the form", async () => {
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      runtimeWith({ status: "COMPLETE" }),
    );
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(
      profile([contact({ priority: "SECONDARY" })]),
    );

    openModule();

    expect(
      await screen.findByRole("heading", { name: "Emergency Contact 2" }),
    ).toBeTruthy();
  });

  it("keeps every sentence a worker would be worse off without", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    const intro = document.querySelector(".ec-intro")?.textContent ?? "";
    // The governed meaning of priority, which no list of names can show.
    expect(intro).toMatch(/order you set/i);
    // The governed limit, so he plans around it rather than discovering it at contact four.
    expect(intro).toMatch(/three/i);
    // THIS MODULE'S OWN UNUSUAL BEHAVIOUR, and the only thing standing between him and lost
    // work. It is the one piece of guidance that could not be dropped as self-evident.
    expect(intro).toMatch(/nothing is saved until you press save/i);

    // The information-sharing choice is a real decision with a consequence he cannot infer,
    // so its guidance stays where the choice is made. It survived the removal of the
    // call/no-call control because the two were never the same question.
    expect(
      screen.getByText(/will not be given details about you/i),
    ).toBeTruthy();
  });

  it("stops explaining what an emergency contact is", async () => {
    openModule();
    await screen.findByLabelText("Full name");

    const intro = document.querySelector(".ec-intro")?.textContent ?? "";
    expect(intro).not.toMatch(/if something happens to you/i);
    // One statement rather than a page of them.
    expect(document.querySelectorAll(".ec-intro p")).toHaveLength(1);
  });
});

/* -------------------------------------------------------- finishing the section */

/**
 * QA-L5-UX-8. Save & Continue is one operation, and it says so for as long as it runs.
 *
 * Three requests happen behind that one press - the save, the completion, and the re-read of
 * the packet the completion changed. Previously the screen went quiet after the first of them,
 * with both buttons live, which is what the browser run saw as several seconds of a section
 * that looked idle and finished.
 */
describe("finishing the section", () => {
  /**
   * Hold the completion open, and hand back the release.
   *
   * The point of every test below is what the screen says WHILE the operation is running, so
   * the operation has to be stoppable in the middle rather than raced against.
   */
  function heldCompletion(): () => void {
    let release = (): void => undefined;
    vi.mocked(completeOnboardingModule).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              moduleKey: MODULE_KEY,
              completionId: "cmp-1",
              effectiveFrom: new Date().toISOString(),
              versionCreated: true,
              alreadyComplete: false,
              completion: { complete: true, requiredCount: 1, completeCount: 1 },
              nextModuleKey: null,
            });
        }),
    );
    return () => release();
  }

  it("says it is finishing for the whole operation, not merely the save", async () => {
    const finishCompletion = heldCompletion();

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    // The save has returned and the completion has not. THE WORKER IS STILL TOLD IT IS
    // RUNNING, because from where he sits it is: he asked to finish the section, and the
    // section is not finished.
    await waitFor(() =>
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalled(),
    );
    expect(document.querySelector('[data-ec-finishing="true"]')).toBeTruthy();
    expect(screen.queryByText("Your emergency contacts are saved.")).toBeNull();

    finishCompletion();
    await waitFor(() =>
      expect(document.querySelector('[data-ec-finishing="true"]')).toBeNull(),
    );
  });

  it("takes no second press while it is running, and records one completion", async () => {
    const finishCompletion = heldCompletion();

    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();

    const finish = screen.getByRole("button", { name: "Save & Continue" });
    fireEvent.click(finish);
    await waitFor(() =>
      expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalled(),
    );

    // The control says so as well as refusing, so a worker who presses again learns why
    // rather than concluding that nothing happened.
    const running = screen.getByRole("button", { name: "Finishing." });
    expect((running as HTMLButtonElement).disabled).toBe(true);
    expect(running.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(running);
    fireEvent.click(running);

    finishCompletion();
    await waitFor(() =>
      expect(document.querySelector('[data-ec-finishing="true"]')).toBeNull(),
    );
    expect(vi.mocked(completeOnboardingModule)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveOwnEmergencyContacts)).toHaveBeenCalledTimes(1);
  });

  it("re-reads his packet and not his whole onboarding history", async () => {
    openModule();
    await screen.findByLabelText("Full name");
    fillFirstContact();
    const readsBefore = vi.mocked(getOnboardingRuntime).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));

    // ONE PACKET, BY ITS OWN IDENTIFIER. A completion recorded inside a packet can only have
    // changed that packet, and re-deriving every packet the worker ever held to learn it is
    // the cost the browser run measured.
    await waitFor(() =>
      expect(vi.mocked(getOnboardingPacket)).toHaveBeenCalledWith(INVOCATION_ID),
    );
    expect(vi.mocked(getOnboardingRuntime).mock.calls.length).toBe(readsBefore);
  });

  it("holds the same state over the no-change confirmation", async () => {
    vi.mocked(getOwnEmergencyContacts).mockResolvedValue(profile([contact()]));
    const finishCompletion = heldCompletion();

    openModule();
    await screen.findByLabelText("Full name");
    fireEvent.click(screen.getByRole("button", { name: "These are still correct" }));

    await waitFor(() =>
      expect(document.querySelector('[data-ec-finishing="true"]')).toBeTruthy(),
    );

    finishCompletion();
    await waitFor(() =>
      expect(document.querySelector('[data-ec-finishing="true"]')).toBeNull(),
    );
    // Confirming still says what it always said, and it still writes no version.
    const [, options] = vi.mocked(completeOnboardingModule).mock.calls[0];
    expect(options).toMatchObject({ confirmNoChange: true });
    expect(vi.mocked(saveOwnEmergencyContacts)).not.toHaveBeenCalled();
  });
});
