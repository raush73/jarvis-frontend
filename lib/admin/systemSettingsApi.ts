/**
 * System Settings - browser API client for the authenticated Admin surface.
 *
 * The staff credential, the API base, and the 401 behaviour are the delivered
 * ones from `lib/api`. What this client adds is the settings refusal contract:
 * the backend answers an out-of-range write with a field-level message naming
 * the accepted range, and an administrator needs to read that message rather
 * than an HTTP status.
 *
 * Note what the SERVER supplies and this client therefore never computes: the
 * authoritative value, the governed default, and the accepted minimum and
 * maximum. A client that hard-coded the bounds would become a second answer to
 * what is valid, free to drift from the validation that actually refuses.
 */

import { API_BASE, clearAccessToken, getAccessToken } from "@/lib/api";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

/** One administered whole-day setting: its value and the bounds a write must satisfy. */
export type AdministeredDaysSetting = {
  value: number;
  default: number;
  min: number;
  max: number;
};

/** The Workforce Onboarding settings group. One setting today. */
export type WorkforceOnboardingSettings = {
  payrollPaymentPreDispatchFreshnessDays: AdministeredDaysSetting;
};

/** A field the server refused, and why. */
export type SettingsFieldError = {
  field: string;
  message: string;
};

/**
 * A refused settings request.
 *
 * `message` is what a surface should show: the server's field-level reason when
 * it gave one, so the administrator is told the accepted range instead of being
 * shown a status number.
 */
export class SystemSettingsApiError extends Error {
  readonly status: number;
  readonly fieldErrors: SettingsFieldError[];

  constructor(input: {
    status: number;
    message: string;
    fieldErrors?: SettingsFieldError[];
  }) {
    super(input.message);
    this.name = "SystemSettingsApiError";
    this.status = input.status;
    this.fieldErrors = input.fieldErrors ?? [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Transport                                                                  */
/* -------------------------------------------------------------------------- */

const BASE = "/admin/settings";

/** The authenticated JSON read seam for the Workforce Onboarding group. */
export const WORKFORCE_ONBOARDING_SETTINGS_PATH = `${BASE}/workforce-onboarding`;

const SESSION_MISSING_MESSAGE =
  "Sign in as an administrator to manage System Settings.";

function fieldErrorsOf(payload: unknown): SettingsFieldError[] {
  const errors = (payload as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) return [];

  return errors.flatMap((entry) => {
    const candidate = entry as { field?: unknown; message?: unknown };
    return typeof candidate?.field === "string" &&
      typeof candidate?.message === "string"
      ? [{ field: candidate.field, message: candidate.message }]
      : [];
  });
}

/**
 * One administrative settings request.
 *
 * Nothing is attempted without a staff credential, so an unauthenticated screen
 * cannot produce a request that merely looks unauthorized.
 */
async function settingsFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new SystemSettingsApiError({
      status: 401,
      message: SESSION_MISSING_MESSAGE,
    });
  }

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or rejected staff credential is a session problem, not a
    // refusal: clearing it is what the delivered client does, so the whole
    // application agrees the operator is out.
    if (response.status === 401) clearAccessToken();

    const fieldErrors = fieldErrorsOf(payload);
    const serverMessage = (payload as { message?: unknown } | null)?.message;

    throw new SystemSettingsApiError({
      status: response.status,
      message:
        response.status === 401
          ? SESSION_MISSING_MESSAGE
          : (fieldErrors[0]?.message ??
            (typeof serverMessage === "string"
              ? serverMessage
              : `Request failed with status ${response.status}`)),
      fieldErrors,
    });
  }

  return payload as T;
}

/* -------------------------------------------------------------------------- */
/*  Reads and writes                                                           */
/* -------------------------------------------------------------------------- */

/** The authoritative Workforce Onboarding settings, with their governed bounds. */
export async function getWorkforceOnboardingSettings(): Promise<WorkforceOnboardingSettings> {
  return settingsFetch<WorkforceOnboardingSettings>(
    WORKFORCE_ONBOARDING_SETTINGS_PATH,
  );
}

/**
 * Update the PRE_DISPATCH Payroll Payment confirmation freshness window.
 *
 * Sends this field alone, so saving it cannot disturb any other setting the
 * shared write contract accepts. The server validates and either persists with
 * the acting administrator recorded, or refuses without changing anything.
 */
export async function savePayrollPaymentPreDispatchFreshnessDays(
  days: number,
): Promise<void> {
  await settingsFetch<{ ok: boolean; message?: string }>(BASE, {
    method: "POST",
    body: { payrollPaymentPreDispatchFreshnessDays: days },
  });
}
