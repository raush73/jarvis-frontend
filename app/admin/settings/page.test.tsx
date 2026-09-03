import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gate 10C-E1A - the authenticated System Settings surface.
 *
 * The setting itself was already authoritative before this screen existed; what
 * was missing was an administrator who could actually reach it. So what these
 * tests hold closed is the operability: the governed value is shown, a valid
 * change reaches the authoritative write, and a refused change never leaves the
 * administrator believing an invalid value took effect.
 *
 * The backend remains the authority on what is valid. The client-side checks
 * proven here are immediacy, not enforcement - which is why a value the screen
 * accepts but the server refuses is also covered.
 */

vi.mock("@/lib/admin/systemSettingsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin/systemSettingsApi")>();
  return {
    ...actual,
    getWorkforceOnboardingSettings: vi.fn(),
    savePayrollPaymentPreDispatchFreshnessDays: vi.fn(),
  };
});

const api = await import("@/lib/admin/systemSettingsApi");
const getSettings = vi.mocked(api.getWorkforceOnboardingSettings);
const saveFreshness = vi.mocked(api.savePayrollPaymentPreDispatchFreshnessDays);
const { SystemSettingsApiError } = api;

const SettingsPage = (await import("./page")).default;

const SETTING_LABEL = "PRE_DISPATCH Payroll Confirmation Freshness";
const SAVE_BUTTON = "Save Changes";
const GOVERNED_KEY = "workforce.onboarding.payrollPayment.preDispatchFreshnessDays";

function settings(value: number) {
  return {
    payrollPaymentPreDispatchFreshnessDays: {
      value,
      default: 14,
      min: 1,
      max: 365,
    },
  };
}

/** The page as an administrator finds it once the authoritative read has landed. */
async function openPage(value = 14) {
  getSettings.mockResolvedValue(settings(value));
  render(<SettingsPage />);
  return (await screen.findByLabelText(SETTING_LABEL)) as HTMLInputElement;
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON }));
}

beforeEach(() => {
  // Reset implementations, not just call counts: every test states its own
  // authoritative read, so none of them can pass on a neighbour's fixture.
  vi.resetAllMocks();
  saveFreshness.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("System Settings page - load", () => {
  it("renders the Workforce Onboarding section and its one setting", async () => {
    await openPage();

    expect(screen.getByText("Workforce Onboarding")).toBeTruthy();
    expect(screen.getByText(SETTING_LABEL)).toBeTruthy();
  });

  it("shows the governed default when nothing has been persisted", async () => {
    const input = await openPage(14);

    expect(input.value).toBe("14");
    expect(screen.getByText(/In effect now: 14 days/)).toBeTruthy();
  });

  it("shows the persisted authoritative value when an override exists", async () => {
    const input = await openPage(45);

    expect(input.value).toBe("45");
    expect(screen.getByText(/In effect now: 45 days/)).toBeTruthy();
  });

  it("states the accepted range and the default", async () => {
    await openPage();

    const range = screen.getByText(/Whole days/);
    expect(range.textContent).toContain("1");
    expect(range.textContent).toContain("365");
    expect(range.textContent).toContain("Default 14");
  });

  it("explains what the setting controls without requiring the governed key", async () => {
    getSettings.mockResolvedValue(settings(14));
    const { container } = render(<SettingsPage />);
    await screen.findByLabelText(SETTING_LABEL);

    expect(screen.getByText(/stays fresh/)).toBeTruthy();
    expect(container.textContent).toMatch(/before dispatch/i);
    // The dotted internal key is not how an administrator is addressed.
    expect(container.textContent).not.toContain(GOVERNED_KEY);
  });
});

describe("System Settings page - saving a valid value", () => {
  it("sends a whole number within the accepted range", async () => {
    const input = await openPage(14);

    type(input, "30");
    getSettings.mockResolvedValue(settings(30));
    save();

    await waitFor(() => expect(saveFreshness).toHaveBeenCalledWith(30));
  });

  it.each([1, 14, 365])("accepts the governed boundary value %i", async (days) => {
    const input = await openPage(14);

    type(input, String(days));
    getSettings.mockResolvedValue(settings(days));
    save();

    await waitFor(() => expect(saveFreshness).toHaveBeenCalledWith(days));
  });

  it("reports success and then shows the persisted value", async () => {
    const input = await openPage(14);

    type(input, "30");
    getSettings.mockResolvedValue(settings(30));
    save();

    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(screen.getByText(/In effect now: 30 days/)).toBeTruthy();
  });

  it("re-reads the authority rather than trusting what was typed", async () => {
    const input = await openPage(14);

    type(input, "30");
    getSettings.mockResolvedValue(settings(30));
    save();

    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2));
  });
});

describe("System Settings page - refusing an invalid value", () => {
  const invalid: Array<[string, string]> = [
    ["below the minimum", "0"],
    ["a negative value", "-5"],
    ["above the maximum", "366"],
    ["a fractional value", "14.5"],
    ["a non-numeric value", "abc"],
    ["an empty value", ""],
  ];

  it.each(invalid)("refuses %s", async (_label, value) => {
    const input = await openPage(14);

    type(input, value);
    save();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(saveFreshness).not.toHaveBeenCalled();
  });

  it.each(invalid)(
    "leaves the authoritative value standing when given %s",
    async (_label, value) => {
      const input = await openPage(14);

      type(input, value);
      save();

      await screen.findByRole("alert");
      // What is in effect is the persisted value, never the refused attempt.
      expect(screen.getByText(/In effect now: 14 days/)).toBeTruthy();
      expect(screen.queryByText("Saved")).toBeNull();
    },
  );

  it("names the accepted range when the value is out of range", async () => {
    const input = await openPage(14);

    type(input, "400");
    save();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("1");
    expect(alert.textContent).toContain("365");
  });

  it("says whole days when given a decimal", async () => {
    const input = await openPage(14);

    type(input, "7.5");
    save();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/whole number of days/i);
  });

  it("never silently substitutes a bound for a refused value", async () => {
    const input = await openPage(14);

    type(input, "9000");
    save();

    await screen.findByRole("alert");
    expect(saveFreshness).not.toHaveBeenCalled();
    expect(input.value).toBe("9000");
    expect(screen.getByText(/In effect now: 14 days/)).toBeTruthy();
  });

  it("clears the refusal once the administrator corrects the value", async () => {
    const input = await openPage(14);

    type(input, "0");
    save();
    await screen.findByRole("alert");

    type(input, "21");

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("System Settings page - the backend stays the authority", () => {
  it("reports a value the server refuses even though the screen allowed it", async () => {
    const input = await openPage(14);
    saveFreshness.mockRejectedValue(
      new SystemSettingsApiError({
        status: 400,
        message: "Must be a whole number of days between 1 and 365",
        fieldErrors: [
          {
            field: "payrollPaymentPreDispatchFreshnessDays",
            message: "Must be a whole number of days between 1 and 365",
          },
        ],
      }),
    );

    type(input, "30");
    save();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Must be a whole number of days between 1 and 365",
    );
  });

  it("keeps showing the prior authoritative value after a server refusal", async () => {
    const input = await openPage(14);
    saveFreshness.mockRejectedValue(
      new SystemSettingsApiError({ status: 400, message: "Validation failed" }),
    );

    type(input, "30");
    save();

    await screen.findByRole("alert");
    expect(screen.getByText(/In effect now: 14 days/)).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("System Settings page - authentication", () => {
  it("asks the administrator to sign in rather than showing an empty form", async () => {
    getSettings.mockRejectedValue(
      new SystemSettingsApiError({
        status: 401,
        message: "Sign in as an administrator to manage System Settings.",
      }),
    );

    render(<SettingsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/sign in as an administrator/i);
    expect(screen.queryByLabelText(SETTING_LABEL)).toBeNull();
    expect(screen.queryByRole("button", { name: SAVE_BUTTON })).toBeNull();
  });

  it("offers no way to save while unauthenticated", async () => {
    getSettings.mockRejectedValue(
      new SystemSettingsApiError({ status: 401, message: "Sign in" }),
    );

    render(<SettingsPage />);

    await screen.findByRole("alert");
    expect(saveFreshness).not.toHaveBeenCalled();
  });

  it("surfaces a failed read instead of presenting a default as authoritative", async () => {
    getSettings.mockRejectedValue(new Error("Settings store unavailable"));

    render(<SettingsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Settings store unavailable");
    expect(screen.queryByText(/In effect now/)).toBeNull();
  });
});
