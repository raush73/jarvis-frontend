/**
 * Gate 10C-E1A - the System Settings transport contract.
 *
 * What these prove is the seam, not the surface:
 *
 *  - The staff credential is what an administrative settings request carries,
 *    and nothing is attempted without one.
 *  - A refusal keeps the server's field-level reason, which is what lets the
 *    screen tell an administrator the accepted range rather than a status.
 *  - A rejected credential clears the staff session exactly as the delivered
 *    client does, so the whole application agrees the operator is out.
 *  - A write sends the one administered field and nothing else, so saving this
 *    setting cannot disturb another that the shared contract also accepts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE } from "@/lib/api";
import {
  SystemSettingsApiError,
  WORKFORCE_ONBOARDING_SETTINGS_PATH,
  getWorkforceOnboardingSettings,
  savePayrollPaymentPreDispatchFreshnessDays,
} from "./systemSettingsApi";

const TOKEN_KEY = "jp_accessToken";

const GOVERNED_SETTING = {
  value: 14,
  default: 14,
  min: 1,
  max: 365,
};

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response);
}

function settingsBody(overrides: Partial<typeof GOVERNED_SETTING> = {}) {
  return {
    payrollPaymentPreDispatchFreshnessDays: {
      ...GOVERNED_SETTING,
      ...overrides,
    },
  };
}

/** The refusal shape the existing Admin Settings write contract already returns. */
function validationRefusal(field: string, message: string) {
  return {
    ok: false,
    message: "Validation failed",
    errors: [{ field, message }],
  };
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, "staff-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("reading the Workforce Onboarding settings", () => {
  it("carries the staff bearer credential", async () => {
    const fetchMock = respondWith(200, settingsBody());
    vi.stubGlobal("fetch", fetchMock);

    await getWorkforceOnboardingSettings();

    const { url, init, headers } = lastRequest(fetchMock);
    expect(url).toBe(`${API_BASE}${WORKFORCE_ONBOARDING_SETTINGS_PATH}`);
    expect(init.method).toBe("GET");
    expect(headers.get("Authorization")).toBe("Bearer staff-token");
  });

  it("reads from the authenticated JSON seam, not the rendered page", async () => {
    const fetchMock = respondWith(200, settingsBody());
    vi.stubGlobal("fetch", fetchMock);

    await getWorkforceOnboardingSettings();

    expect(lastRequest(fetchMock).url).toContain(
      "/admin/settings/workforce-onboarding",
    );
  });

  it("returns the authoritative value and the governed bounds", async () => {
    const fetchMock = respondWith(200, settingsBody({ value: 30 }));
    vi.stubGlobal("fetch", fetchMock);

    const settings = await getWorkforceOnboardingSettings();

    expect(settings.payrollPaymentPreDispatchFreshnessDays).toEqual({
      value: 30,
      default: 14,
      min: 1,
      max: 365,
    });
  });

  it("attempts nothing when there is no staff session", async () => {
    localStorage.clear();
    const fetchMock = respondWith(200, settingsBody());
    vi.stubGlobal("fetch", fetchMock);

    await expect(getWorkforceOnboardingSettings()).rejects.toBeInstanceOf(
      SystemSettingsApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the administrator to sign in when the credential is rejected", async () => {
    const fetchMock = respondWith(401, { message: "Unauthorized" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getWorkforceOnboardingSettings()).rejects.toThrow(
      /sign in as an administrator/i,
    );
  });

  it("clears the dead staff session so the application agrees the operator is out", async () => {
    vi.stubGlobal("fetch", respondWith(401, { message: "Unauthorized" }));

    await expect(getWorkforceOnboardingSettings()).rejects.toBeInstanceOf(
      SystemSettingsApiError,
    );
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("updating the freshness window", () => {
  it("posts the one administered field with the staff credential", async () => {
    const fetchMock = respondWith(200, { ok: true, message: "Settings saved" });
    vi.stubGlobal("fetch", fetchMock);

    await savePayrollPaymentPreDispatchFreshnessDays(30);

    const { url, init, headers } = lastRequest(fetchMock);
    expect(url).toBe(`${API_BASE}/admin/settings`);
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer staff-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      payrollPaymentPreDispatchFreshnessDays: 30,
    });
  });

  it("surfaces the server's field-level reason, naming the accepted range", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(
        400,
        validationRefusal(
          "payrollPaymentPreDispatchFreshnessDays",
          "Must be a whole number of days between 1 and 365",
        ),
      ),
    );

    await expect(savePayrollPaymentPreDispatchFreshnessDays(0)).rejects.toThrow(
      "Must be a whole number of days between 1 and 365",
    );
  });

  it("keeps the refused field so a surface can attribute the problem", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(
        400,
        validationRefusal(
          "payrollPaymentPreDispatchFreshnessDays",
          "Must be a whole number of days between 1 and 365",
        ),
      ),
    );

    expect.assertions(2);
    try {
      await savePayrollPaymentPreDispatchFreshnessDays(366);
    } catch (error) {
      const refusal = error as SystemSettingsApiError;
      expect(refusal.status).toBe(400);
      expect(refusal.fieldErrors).toEqual([
        {
          field: "payrollPaymentPreDispatchFreshnessDays",
          message: "Must be a whole number of days between 1 and 365",
        },
      ]);
    }
  });

  it("falls back to the server message when no field was named", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(500, { message: "Settings store unavailable" }),
    );

    await expect(
      savePayrollPaymentPreDispatchFreshnessDays(30),
    ).rejects.toThrow("Settings store unavailable");
  });

  it("still reports a refusal when the body cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 503,
        ok: false,
        headers: new Headers(),
        json: async () => {
          throw new Error("not json");
        },
      } as unknown as Response),
    );

    await expect(
      savePayrollPaymentPreDispatchFreshnessDays(30),
    ).rejects.toThrow("Request failed with status 503");
  });

  it("attempts nothing when there is no staff session", async () => {
    localStorage.clear();
    const fetchMock = respondWith(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      savePayrollPaymentPreDispatchFreshnessDays(30),
    ).rejects.toBeInstanceOf(SystemSettingsApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
