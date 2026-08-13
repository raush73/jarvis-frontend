/**
 * Module 4.7 - authorized staff review inside the Phase 2 workspace.
 *
 * What this suite is answerable for:
 *
 *  - The panel is a PANEL. It mounts inside the existing workspace because the capsule
 *    registered it, and it has no route, no shell, and no navigation entry of its own.
 *  - Authorization is by grant, and a missing grant means ABSENCE: nothing rendered and
 *    nothing requested, so the panel never invites a refusal or discloses that this worker
 *    has contacts at all.
 *  - What an authorized operator sees is the effective set in full, and the superseded
 *    versions behind it, because who MW4H would have called then is part of the record.
 *  - It is READ ONLY. There is no edit, no reorder, no deactivation, no designation change,
 *    no verification control, and no action taken on the worker's behalf.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  EmergencyContact,
  EmergencyContactStaffView,
} from "@/lib/workforce/emergencyContactsApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/onboarding",
}));

vi.mock("@/lib/workforce/emergencyContactsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/emergencyContactsApi")>();
  return { ...actual, getStaffEmergencyContacts: vi.fn() };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const { getStaffEmergencyContacts } = await import(
  "@/lib/workforce/emergencyContactsApi"
);
const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");
const { OnboardingAdminReviewPanel } = await import(
  "@/components/workforce/admin/panels/ReviewPanel"
);
const { resolveOnboardingAdminPanel } = await import(
  "@/components/workforce/admin/adminPanelRegistry"
);
const { CANDIDATE_ID, fixtureModule, fixtureSession, fixtureWorker } = await import(
  "@/components/workforce/admin/adminTestFixtures"
);

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the administrative layout
 * imports it. This suite registers no panel of its own.
 */
await import("./register.admin");

const MODULE_KEY = "EMERGENCY_CONTACT";
const ACCESS = "workforce.onboarding.admin.access";
const WORKER_READ = "workforce.onboarding.admin.worker.read";
const DOCUMENT_READ = "workforce.onboarding.document.read";

const { default: EmergencyContactsReviewPanel } = await import(
  "./EmergencyContactsReviewPanel"
);

function contact(overrides: Partial<EmergencyContact> = {}): EmergencyContact {
  return {
    id: "ec-1",
    setVersion: 2,
    priority: "PRIMARY",
    status: "ACTIVE",
    designation: "AUTHORIZED_TO_RECEIVE",
    fullName: "Dana Rivers",
    relationship: "SPOUSE",
    relationshipDetail: null,
    primaryPhone: "918-555-0100",
    secondaryPhone: null,
    email: null,
    addressLine1: "12 Elm Street",
    addressLine2: null,
    city: "Tulsa",
    state: "OK",
    postalCode: "74101",
    preferredLanguage: null,
    effectiveFrom: "2026-03-02T10:00:00.000Z",
    supersededAt: null,
    recordedByType: "WORKER",
    ...overrides,
  };
}

function staffView(
  overrides: Partial<EmergencyContactStaffView> = {},
): EmergencyContactStaffView {
  const current = [contact()];
  return {
    current: {
      candidateId: CANDIDATE_ID,
      setVersion: 2,
      effectiveFrom: "2026-03-02T10:00:00.000Z",
      contacts: current,
      activeContactCount: 1,
    },
    history: [
      ...current,
      contact({
        id: "ec-0",
        setVersion: 1,
        fullName: "Alex Rivers",
        primaryPhone: "918-555-0199",
        effectiveFrom: "2026-01-04T10:00:00.000Z",
        supersededAt: "2026-03-02T10:00:00.000Z",
      }),
    ],
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <EmergencyContactsReviewPanel
      worker={fixtureWorker()}
      packet={null}
      module={null}
      history={null}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));
  vi.mocked(getStaffEmergencyContacts).mockResolvedValue(staffView());
});

afterEach(() => {
  cleanup();
});

/* ----------------------------------------------------------- authorization */

describe("authorization", () => {
  it("renders nothing and reads nothing without the worker-read grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, DOCUMENT_READ]));

    const { container } = renderPanel();

    expect(container.textContent).toBe("");
    await waitFor(() =>
      expect(vi.mocked(getStaffEmergencyContacts)).not.toHaveBeenCalled(),
    );
  });

  it("reads this worker's contacts once the grant is held", async () => {
    renderPanel();

    await waitFor(() =>
      expect(vi.mocked(getStaffEmergencyContacts)).toHaveBeenCalledWith(CANDIDATE_ID),
    );
    expect(await screen.findByText("Dana Rivers")).toBeTruthy();
  });
});

/* ------------------------------------------------------------ what it shows */

describe("what an authorized operator sees", () => {
  it("shows the effective set in full, because a number nobody can call is no use", async () => {
    renderPanel();
    await screen.findByText("Dana Rivers");

    const current = document.querySelector('[data-ec-current="true"]');
    expect(current?.textContent).toContain("Dana Rivers");
    expect(current?.textContent).toContain("918-555-0100");
    expect(current?.textContent).toContain("12 Elm Street, Tulsa, OK, 74101");
    expect(current?.textContent).toContain("Called first");
    expect(current?.textContent).toContain("May be given information");
  });

  it("keeps the superseded version on screen, marked as superseded", async () => {
    renderPanel();

    await screen.findByText("Dana Rivers");
    const history = document.querySelector('[data-ec-history="true"]');
    expect(history).toBeTruthy();
    expect(history?.textContent).toContain("Alex Rivers");
    expect(history?.textContent).toContain("Superseded");
    expect(
      document.querySelector('[data-emergency-contact-id="ec-0"]')?.getAttribute(
        "data-contact-current",
      ),
    ).toBe("false");
  });

  it("states which set version is in force", async () => {
    renderPanel();

    await screen.findByText("Dana Rivers");
    expect(document.querySelector('[data-ec-set-version="2"]')).toBeTruthy();
  });

  it("says plainly when a worker has recorded nobody", async () => {
    vi.mocked(getStaffEmergencyContacts).mockResolvedValue({
      current: {
        candidateId: CANDIDATE_ID,
        setVersion: null,
        effectiveFrom: null,
        contacts: [],
        activeContactCount: 0,
      },
      history: [],
    });

    renderPanel();

    expect(
      await screen.findByText("This worker has recorded no emergency contacts."),
    ).toBeTruthy();
  });

  it("reports a refusal as a refusal, with the code an operator has to quote", async () => {
    vi.mocked(getStaffEmergencyContacts).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
        message: "Missing permission",
      }),
    );

    renderPanel();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/ADMIN_FUNCTION_NOT_AUTHORIZED/)).toBeTruthy();
    // No contact of any kind reached the screen behind the refusal.
    expect(screen.queryByText("Dana Rivers")).toBeNull();
  });

  it("offers the read again when the failure was not an answer about authorization", async () => {
    vi.mocked(getStaffEmergencyContacts).mockRejectedValue(
      new OnboardingAdminApiError({ status: 503, message: "Service unavailable" }),
    );

    renderPanel();
    await screen.findByRole("alert");

    vi.mocked(getStaffEmergencyContacts).mockResolvedValue(staffView());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Dana Rivers")).toBeTruthy();
  });
});

/* --------------------------------------------------------------- read only */

describe("the panel is read only", () => {
  it("offers no control that would change the worker's record", async () => {
    renderPanel();
    await screen.findByText("Dana Rivers");

    // Nothing to type into, and nothing to submit.
    expect(document.querySelectorAll("input")).toHaveLength(0);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll("form")).toHaveLength(0);
    expect(document.querySelectorAll("button")).toHaveLength(0);
  });

  it("names no administrative act on a worker's contacts", async () => {
    const { container } = renderPanel();
    await screen.findByText("Dana Rivers");

    const text = container.textContent ?? "";
    for (const forbidden of [
      "Edit",
      "Remove",
      "Delete",
      "Reorder",
      "Deactivate",
      "Verify",
      "Save",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

/* ------------------------------------------------------------ registration */

describe("how the panel reaches the workspace", () => {
  it("is registered under this module's key by its own capsule", () => {
    expect(resolveOnboardingAdminPanel(MODULE_KEY)).toBeDefined();
  });

  it("mounts inside the delivered review panel with no workspace change", async () => {
    render(
      <OnboardingAdminReviewPanel
        worker={fixtureWorker()}
        packet={null}
        module={fixtureModule({
          moduleKey: MODULE_KEY,
          moduleNumber: "4.7",
          title: "Emergency Contacts",
        })}
      />,
    );

    expect(await screen.findByText("Dana Rivers")).toBeTruthy();
    // The workspace's placeholder for an unregistered module is gone, which is the whole
    // proof that registration is what put the panel there.
    expect(
      screen.queryByText(/No administrative panel has been registered/),
    ).toBeNull();
  });
});
