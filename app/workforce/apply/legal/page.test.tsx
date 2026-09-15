import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import LegalPage from "./page";

/**
 * OWNER RULING 2026-09-15 - THE OPTIONAL TEXT-MESSAGE CONSENT ON THE LEGAL SCREEN.
 *
 * WHAT THESE TESTS ARE ACTUALLY GUARDING. A consent control is only lawful if the worker can
 * decline it and still finish, and only useful if what he agreed to is the language he was
 * shown. Both of those are browser facts: whether the box starts empty, whether Save & Continue
 * still works untouched, whether the exact disclosure and its two documents reach the screen,
 * and whether following a policy link can accidentally tick the box.
 *
 * The wording itself is the SERVER'S - this screen renders `item.text` and words nothing - so
 * these assert what the browser does with it, not what it says.
 */

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/workforce/workforceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/workforceApi")>();
  return {
    ...actual,
    getLegal: vi.fn(),
    acceptAcknowledgments: vi.fn(),
  };
});

const api = await import("@/lib/workforce/workforceApi");
const getLegal = vi.mocked(api.getLegal);
const acceptAcknowledgments = vi.mocked(api.acceptAcknowledgments);

const CONSENT_KEY = "SMS_MESSAGING_CONSENT";

/** The ratified version 1.0 disclosure, exactly as the server catalogues it. */
const CONSENT_TEXT =
  "I agree to receive SMS text messages from Millwrights4Hire (MW4H) about employment " +
  "matters, including job opportunities, application and account updates, job-interest " +
  "confirmations, hiring, onboarding, dispatch, and other employment-related " +
  "communications. Message frequency may vary. Message and data rates may apply. Reply STOP " +
  "to opt out or HELP for help. Consent to receive promotional or job-opportunity text " +
  "messages is not a condition of employment. See the MW4H Privacy Policy and Terms and " +
  "Conditions.";

const REQUIRED_ONE = "I certify that the information I have supplied is accurate.";
const REQUIRED_TWO = "I understand additional onboarding may be required.";

function stage(
  overrides: Partial<Awaited<ReturnType<typeof api.getLegal>>> = {},
): Awaited<ReturnType<typeof api.getLegal>> {
  return {
    military: {
      hasMilitaryService: false,
      branch: null,
      branchLabel: null,
      serviceComponent: null,
      serviceComponentLabel: null,
      serviceStartDate: null,
      serviceEndDate: null,
      occupationalSpecialty: null,
    },
    unionAffiliation: {
      isUnionAffiliated: false,
      unionName: null,
      localNumber: null,
    },
    acknowledgments: [
      {
        key: "ACCURACY_COMPLETENESS",
        version: "1.0",
        text: REQUIRED_ONE,
        accepted: false,
        acceptedAt: null,
        required: true,
        links: [],
      },
      {
        key: "ADDITIONAL_ONBOARDING",
        version: "1.0",
        text: REQUIRED_TWO,
        accepted: false,
        acceptedAt: null,
        required: true,
        links: [],
      },
      {
        key: CONSENT_KEY,
        version: "1.0",
        text: CONSENT_TEXT,
        accepted: false,
        acceptedAt: null,
        required: false,
        links: [
          {
            label: "Privacy Policy",
            href: "https://www.mw4h.com/privacy-policy",
          },
          {
            label: "Terms and Conditions",
            href: "https://www.mw4h.com/terms-and-conditions",
          },
        ],
      },
    ],
    allAcknowledgmentsAccepted: false,
    ...overrides,
  };
}

/** The checkbox belonging to one acknowledgment, found through its own label text. */
function boxFor(text: string): HTMLInputElement {
  const label = screen.getByText(text).closest("label");
  if (!label) throw new Error(`no label wraps: ${text}`);
  const box = label.querySelector('input[type="checkbox"]');
  if (!box) throw new Error(`no checkbox inside label: ${text}`);
  return box as HTMLInputElement;
}

const saveButton = () => screen.getByRole("button", { name: "Save & Continue" });

async function loaded() {
  render(<LegalPage />);
  await waitFor(() => expect(screen.getByText(REQUIRED_ONE)).toBeTruthy());
}

describe("Legal stage - optional SMS consent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    saveWorkerSession({
      token: "worker-token",
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      applicationSessionId: "apps_durable",
      candidateId: null,
    });
    getLegal.mockResolvedValue(stage());
    acceptAcknowledgments.mockResolvedValue(stage());
  });

  afterEach(cleanup);

  it("renders the consent, marked optional and apart from the required statements", async () => {
    await loaded();

    expect(screen.getByText(CONSENT_TEXT)).toBeTruthy();
    // Visibly a choice rather than one more demand.
    expect(screen.getByText("Text messages (optional)")).toBeTruthy();
    expect(
      screen.getByText(/Leaving it unchecked will not affect your application/),
    ).toBeTruthy();
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("starts unchecked on a fresh application", async () => {
    await loaded();

    expect(boxFor(CONSENT_TEXT).checked).toBe(false);
    expect(boxFor(REQUIRED_ONE).checked).toBe(false);
    expect(boxFor(REQUIRED_TWO).checked).toBe(false);
  });

  it("no longer tells the worker every statement is required", async () => {
    await loaded();

    expect(screen.queryByText(/All are required/)).toBeNull();
  });

  it("saves the required statements with the consent left untouched", async () => {
    await loaded();
    fireEvent.click(boxFor(REQUIRED_ONE));
    fireEvent.click(boxFor(REQUIRED_TWO));

    fireEvent.click(saveButton());

    await waitFor(() => expect(acceptAcknowledgments).toHaveBeenCalledTimes(1));
    const sent = acceptAcknowledgments.mock.calls[0][0];
    expect(sent).toEqual(["ACCURACY_COMPLETENESS", "ADDITIONAL_ONBOARDING"]);
    expect(sent).not.toContain(CONSENT_KEY);
  });

  it("includes the consent when the worker checks it", async () => {
    await loaded();
    fireEvent.click(boxFor(REQUIRED_ONE));
    fireEvent.click(boxFor(REQUIRED_TWO));
    fireEvent.click(boxFor(CONSENT_TEXT));

    fireEvent.click(saveButton());

    await waitFor(() => expect(acceptAcknowledgments).toHaveBeenCalledTimes(1));
    expect(acceptAcknowledgments.mock.calls[0][0]).toContain(CONSENT_KEY);
  });

  it("still refuses to save when a REQUIRED statement is unchecked", async () => {
    await loaded();
    fireEvent.click(boxFor(REQUIRED_ONE));
    fireEvent.click(boxFor(CONSENT_TEXT));

    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(
        screen.getByText(/You must accept every required acknowledgment/),
      ).toBeTruthy(),
    );
    expect(acceptAcknowledgments).not.toHaveBeenCalled();
  });

  describe("the compliance documents", () => {
    it("offers both, pointing at the governed MW4H URLs", async () => {
      await loaded();

      expect(
        screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href"),
      ).toBe("https://www.mw4h.com/privacy-policy");
      expect(
        screen
          .getByRole("link", { name: "Terms and Conditions" })
          .getAttribute("href"),
      ).toBe("https://www.mw4h.com/terms-and-conditions");
    });

    it("opens them safely, without handing the new tab this session", async () => {
      await loaded();

      for (const name of ["Privacy Policy", "Terms and Conditions"]) {
        const link = screen.getByRole("link", { name });
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      }
    });

    /*
      READING A POLICY IS NOT AGREEING TO IT.

      A `<label>` activates its control when any child is clicked, so an anchor placed inside
      the consent label would tick the box on the way to the policy - consent by navigation.
      The links sit outside the label and are tied to it by `aria-describedby` instead.
    */
    it("cannot tick the consent by following a link", async () => {
      await loaded();

      const link = screen.getByRole("link", { name: "Privacy Policy" });
      expect(link.closest("label")).toBeNull();
      fireEvent.click(link);

      expect(boxFor(CONSENT_TEXT).checked).toBe(false);
    });

    it("announces the documents as the consent's description", async () => {
      await loaded();

      const described = boxFor(CONSENT_TEXT).getAttribute("aria-describedby");
      expect(described).toBe(`${CONSENT_KEY}-docs`);
      expect(document.getElementById(described!)).toBeTruthy();
    });
  });

  it("re-checks a consent the worker already accepted, without defaulting it on", async () => {
    getLegal.mockResolvedValue(
      stage({
        acknowledgments: stage().acknowledgments.map((a) =>
          a.key === CONSENT_KEY
            ? { ...a, accepted: true, acceptedAt: "2026-09-15T18:00:00.000Z" }
            : a,
        ),
      }),
    );

    await loaded();

    // Resuming shows him what he already chose; it is not a default for anybody else.
    expect(boxFor(CONSENT_TEXT).checked).toBe(true);
  });
});
