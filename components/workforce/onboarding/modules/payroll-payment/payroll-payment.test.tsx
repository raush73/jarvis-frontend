/**
 * Module 4.4 Payroll Payment - the worker's own interview, through review.
 *
 * What this suite is answerable for:
 *
 *  - The module reaches the worker through the DELIVERED Phase 1 runtime, by registration, at the
 *    canonical URL. Nothing renders a second onboarding application.
 *  - He is offered BOTH approved ways of being paid, as equals, with neither pre-selected and
 *    neither recommended.
 *  - Choosing his own bank account opens the account interview; choosing the payroll card does not,
 *    and asks him for no bank details at all.
 *  - He can enter one account, add a second and a third, and CANNOT add a fourth.
 *  - Checking and Savings are the only kinds of account offered.
 *  - The routing number is checked arithmetically, once, with no second box.
 *  - THE ACCOUNT NUMBER IS TYPED TWICE, INDEPENDENTLY: paste, drop, copy and cut are refused on both
 *    boxes, and an insertion of more than one character at a time - which is what autofill, a drag
 *    and an extension-driven paste all look like - is refused too. The worker is told why.
 *  - A mismatch is explained in plain language and NEITHER ENTRY IS ECHOED.
 *  - The two allocation approaches are explained without an enum, only one can be chosen at a time,
 *    percentages are totalled for him, and the remainder is a shape in which "two of them" cannot be
 *    expressed.
 *  - Review shows MASKED banking values and nothing wider, for both methods.
 *  - He can leave an unfinished interview and resume it FROM THE SERVER's protected draft.
 *  - NOTHING IN THIS GATE AUTHORIZES, EXECUTES, ACTIVATES A CARD, ASSIGNS AN EFFECTIVE DATE OR
 *    COMPLETES THE MODULE. The runtime's completion call is never made, and there is no control that
 *    could make it.
 *  - Every governed refusal has a sentence, and no sentence carries a protected value.
 *  - NO PROTECTED BANKING VALUE IS WRITTEN TO BROWSER STORAGE, A COOKIE, A URL, THE CONSOLE, OR ANY
 *    ATTRIBUTE OF THE DOM.
 *
 * THE FAKE SERVER BELOW APPLIES THE GOVERNED RULES rather than echoing the request, because the
 * behaviours that matter are exactly the ones a naive echo would hide: the account-number comparison
 * being the SERVER's, the entry boxes coming back EMPTY behind a mask, bank details being dropped
 * when the worker moves to the card, and an unfinished proposal being reported with its broken rules
 * instead of refused.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import type {
  PayrollPaymentAccountView,
  PayrollPaymentInterview,
  PayrollPaymentReview,
  PayrollPaymentViolation,
  SavePayrollPaymentAccountInput,
  SavePayrollPaymentInterviewInput,
} from "@/lib/workforce/payrollPaymentApi";

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

vi.mock("@/lib/workforce/payrollPaymentApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/payrollPaymentApi")>();
  return {
    ...actual,
    getOwnPayrollPayment: vi.fn(),
    saveOwnPayrollPayment: vi.fn(),
    getOwnPayrollPaymentReview: vi.fn(),
  };
});

const { getOnboardingRuntime, getRuntimeModuleDraft, saveRuntimeModuleDraft } =
  await import("@/lib/workforce/onboardingRuntimeApi");
const { completeOnboardingModule, OnboardingApiError } = await import(
  "@/lib/workforce/onboardingApi"
);
const {
  getOwnPayrollPayment,
  saveOwnPayrollPayment,
  getOwnPayrollPaymentReview,
  PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS,
} = await import("@/lib/workforce/payrollPaymentApi");
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
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the worker layout imports it.
 * Nothing in this suite registers a renderer of its own, so what is exercised below is what ships.
 */
await import("./register.worker");

const MODULE_KEY = "PAYROLL_PAYMENT";
const MODULE_SLUG = "payroll-payment";
const STEP = "payment-method";

/** Wire tokens, spelled ONCE here so the assertions are about the wire and not about a constant. */
const BANK = "DIRECT_DEPOSIT";
const CARD = "COMDATA_PAYROLL_CARD";
const PERCENTAGE = "PERCENTAGE";
const FIXED = "FIXED_AMOUNT_REMAINDER";

/** Real values, used to prove they never come back and never reach the DOM. */
const ROUTING = "021000021";
const ROUTING_BAD_CHECKSUM = "021000022";
const ACCOUNT = "1234567890";
const OTHER_ACCOUNT = "1234567899";

/* -------------------------------------------------------------------------- */
/*  The fake server: the governed rules, applied                              */
/* -------------------------------------------------------------------------- */

type ServerAccount = {
  position: number;
  accountType: string | null;
  financialInstitutionName: string;
  routingNumber: string;
  accountNumber: string;
  allocationKind: string | null;
  allocationPercentage: string | null;
  allocationAmount: string | null;
  confirmedAt: string | null;
};

let method: string | null = null;
let mode: string | null = null;
let accounts: ServerAccount[] = [];
let savedAt: string | null = null;

function resetServer(): void {
  method = null;
  mode = null;
  accounts = [];
  savedAt = null;
}

class Refusal extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function mask(value: string): string {
  return `••••${value.replace(/\D/g, "").slice(-4)}`;
}

function checksumHolds(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = (at: number): number => Number(routing[at]);
  const total =
    3 * (d(0) + d(3) + d(6)) + 7 * (d(1) + d(4) + d(7)) + (d(2) + d(5) + d(8));
  return total % 10 === 0;
}

function hundredths(text: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** The rules, REPORTED rather than thrown, exactly as the interview service reports them. */
function violationsOf(): PayrollPaymentViolation[] {
  const found: PayrollPaymentViolation[] = [];
  if (method !== BANK) return found;

  if (accounts.length === 0) {
    found.push({ code: "DEPOSIT_ACCOUNT_REQUIRED", position: null, field: "accounts" });
  }
  if (mode === null) {
    found.push({ code: "ALLOCATION_MODE_REQUIRED", position: null, field: "allocationMode" });
  }

  for (const account of accounts) {
    if (account.accountType === null) {
      found.push({
        code: "ACCOUNT_TYPE_NOT_GOVERNED",
        position: account.position,
        field: "accountType",
      });
    }
    if (account.financialInstitutionName.trim() === "") {
      found.push({
        code: "FINANCIAL_INSTITUTION_REQUIRED",
        position: account.position,
        field: "financialInstitutionName",
      });
    }
    if (account.accountNumber === "" || account.confirmedAt === null) {
      found.push({
        code: "ACCOUNT_NUMBER_CONFIRMATION_REQUIRED",
        position: account.position,
        field: "accountNumber",
      });
    }
    if (account.routingNumber === "" || !/^\d{9}$/.test(account.routingNumber)) {
      found.push({
        code: "ROUTING_NUMBER_FORMAT_INVALID",
        position: account.position,
        field: "routingNumber",
      });
    } else if (!checksumHolds(account.routingNumber)) {
      found.push({
        code: "ROUTING_NUMBER_CHECKSUM_INVALID",
        position: account.position,
        field: "routingNumber",
      });
    }
  }

  if (mode === PERCENTAGE) {
    let total = 0;
    let sound = accounts.length > 0;
    for (const account of accounts) {
      if (account.allocationKind !== PERCENTAGE) sound = false;
      const value = hundredths(account.allocationPercentage ?? "");
      if (value === null) sound = false;
      else total += value;
    }
    if (!sound) {
      found.push({ code: "ALLOCATION_VALUE_INVALID", position: null, field: "allocation" });
    } else if (total !== 100_00) {
      found.push({ code: "PERCENTAGE_TOTAL_INVALID", position: null, field: "allocation" });
    }
  }

  if (mode === FIXED) {
    const remainders = accounts.filter(
      (account) => account.allocationKind === "REMAINING_BALANCE",
    );
    if (accounts.some((account) => account.allocationKind === PERCENTAGE)) {
      found.push({ code: "ALLOCATION_MODE_MIXED", position: null, field: "allocation" });
    }
    if (remainders.length === 0) {
      found.push({
        code: "REMAINING_BALANCE_ACCOUNT_REQUIRED",
        position: null,
        field: "allocation",
      });
    }
    if (remainders.length > 1) {
      found.push({
        code: "MULTIPLE_REMAINING_BALANCE_ACCOUNTS",
        position: null,
        field: "allocation",
      });
    }
    for (const account of accounts) {
      if (account.allocationKind !== "FIXED_AMOUNT") continue;
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(account.allocationAmount ?? "")) {
        found.push({
          code: "ALLOCATION_VALUE_INVALID",
          position: account.position,
          field: "allocationAmount",
        });
      }
    }
  }

  return found;
}

function accountViews(): PayrollPaymentAccountView[] {
  return accounts.map((account) => ({
    position: account.position,
    accountType: account.accountType as PayrollPaymentAccountView["accountType"],
    financialInstitutionName: account.financialInstitutionName,
    routingNumberEntered: account.routingNumber !== "",
    routingNumberMasked: account.routingNumber === "" ? null : mask(account.routingNumber),
    accountNumberEntered: account.accountNumber !== "",
    accountNumberMasked: account.accountNumber === "" ? null : mask(account.accountNumber),
    allocationKind: account.allocationKind as PayrollPaymentAccountView["allocationKind"],
    allocationPercentage: account.allocationPercentage,
    allocationAmount: account.allocationAmount,
    accountConfirmationMethod: account.confirmedAt ? "INDEPENDENT_SECOND_ENTRY" : null,
    accountConfirmationRecordedAt: account.confirmedAt,
  }));
}

function interviewView(): PayrollPaymentInterview {
  const violations = violationsOf();
  return {
    paymentMethod: method as PayrollPaymentInterview["paymentMethod"],
    allocationMode: mode as PayrollPaymentInterview["allocationMode"],
    accounts: accountViews(),
    maxDepositAccounts: 3,
    canAddAccount: method === BANK && accounts.length < 3,
    violations,
    readyForReview: method !== null && violations.length === 0,
    savedAt,
  };
}

/** THE SERVER'S COMPARISON. Nothing the browser sends decides this. */
function mergeAccount(
  submitted: SavePayrollPaymentAccountInput,
  held: ServerAccount | undefined,
  position: number,
): ServerAccount {
  const entry = (submitted.accountNumber ?? "").trim();
  const again = (submitted.accountNumberConfirmation ?? "").trim();
  let accountNumber = held?.accountNumber ?? "";
  let confirmedAt = held?.confirmedAt ?? null;

  if (entry !== "" || again !== "") {
    if (entry === "" || again === "") {
      throw new Refusal("ACCOUNT_NUMBER_CONFIRMATION_REQUIRED");
    }
    if (entry !== again) throw new Refusal("ACCOUNT_NUMBER_CONFIRMATION_MISMATCH");
    accountNumber = entry;
    confirmedAt = "2026-08-26T12:00:00.000Z";
  }

  const routing = (submitted.routingNumber ?? "").trim();

  return {
    position,
    accountType: submitted.accountType ?? held?.accountType ?? null,
    financialInstitutionName:
      submitted.financialInstitutionName ?? held?.financialInstitutionName ?? "",
    routingNumber: routing === "" ? (held?.routingNumber ?? "") : routing,
    accountNumber,
    allocationKind: submitted.allocationKind ?? held?.allocationKind ?? null,
    allocationPercentage: submitted.allocationPercentage ?? null,
    allocationAmount: submitted.allocationAmount ?? null,
    confirmedAt,
  };
}

function save(input: SavePayrollPaymentInterviewInput): PayrollPaymentInterview {
  if (input.paymentMethod !== undefined && input.paymentMethod !== null) {
    if (input.paymentMethod !== BANK && input.paymentMethod !== CARD) {
      throw new Refusal("PAYMENT_METHOD_NOT_GOVERNED");
    }
    if (input.paymentMethod !== method && input.paymentMethod === CARD) {
      // The card allocates nothing, so the bank details it had are dropped rather than kept.
      accounts = [];
      mode = null;
    }
    method = input.paymentMethod;
  }

  if (input.allocationMode !== undefined) mode = input.allocationMode ?? null;

  if (input.accounts !== undefined && input.accounts !== null) {
    if (method === CARD && input.accounts.length > 0) {
      throw new Refusal("ACCOUNTS_NOT_PERMITTED_FOR_METHOD");
    }
    if (input.accounts.length > PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS) {
      throw new Refusal("TOO_MANY_DEPOSIT_ACCOUNTS");
    }
    const held = accounts;
    accounts = input.accounts.map((submitted, index) =>
      mergeAccount(submitted, held[index], index + 1),
    );
  }

  savedAt = "2026-08-26T12:00:00.000Z";
  return interviewView();
}

function reviewView(): PayrollPaymentReview {
  const confirmed =
    accounts.length > 0 && accounts.every((account) => account.confirmedAt !== null);
  return {
    paymentMethod: method as PayrollPaymentReview["paymentMethod"],
    allocationMode: mode as PayrollPaymentReview["allocationMode"],
    accounts: accountViews(),
    accountConfirmationMethod: confirmed ? "INDEPENDENT_SECOND_ENTRY" : null,
    authorized: false,
    moduleComplete: false,
  };
}

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

function payrollModule(overrides: Record<string, unknown> = {}) {
  return fixtureModule({
    moduleKey: MODULE_KEY,
    moduleNumber: "4.4",
    title: "Payroll Payment",
    moduleSlug: MODULE_SLUG,
    completionGranularity: "EFFECTIVE_RECORD",
    steps: [step(STEP, "Payment method")],
    resumeStepSlug: STEP,
    ...overrides,
  });
}

/**
 * Render the module the way the worker reaches it, and WAIT FOR THE MODULE ITSELF.
 *
 * Waiting for the module's own method question rather than for a heading, deliberately: the runtime
 * frame renders its step title before the capsule has read anything, so a suite that waited on text
 * would go on to assert against a half-loaded screen and would report the capsule as broken when it
 * was merely not there yet.
 */
async function open(overrides: Record<string, unknown> = {}): Promise<void> {
  vi.mocked(getOnboardingRuntime).mockResolvedValue(
    fixtureRuntime({ packets: [fixturePacket({ modules: [payrollModule(overrides)] })] }),
  );
  render(
    <OnboardingRuntimeProvider>
      <OnboardingModuleHost
        invocationId={INVOCATION_ID}
        moduleSlug={MODULE_SLUG}
        stepSlug={STEP}
      />
    </OnboardingRuntimeProvider>,
  );
  await waitFor(() =>
    expect(document.querySelector("[data-pp-method-choice]")).not.toBeNull(),
  );
}

/** The module's own section, so a scan cannot read the surrounding runtime frame as the module. */
function capsule(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".pp-module");
  if (!section) throw new Error("The module did not render.");
  return section;
}

function field(name: string, within: HTMLElement = capsule()): HTMLInputElement {
  const input = within.querySelector<HTMLInputElement>(`[data-pp-field="${name}"]`);
  if (!input) throw new Error(`No field ${name}.`);
  return input;
}

function accountCard(position: number): HTMLElement {
  const card = capsule().querySelector<HTMLElement>(`[data-pp-account="${position}"]`);
  if (!card) throw new Error(`No account ${position}.`);
  return card;
}

function action(name: string): HTMLElement {
  const button = capsule().querySelector<HTMLElement>(`[data-pp-action="${name}"]`);
  if (!button) throw new Error(`No ${name} control.`);
  return button;
}

function chooseMethod(which: "bank" | "card"): void {
  const label = capsule().querySelector<HTMLElement>(`[data-pp-choice="${which}"] input`);
  if (!label) throw new Error("No method control.");
  fireEvent.click(label);
}

/** Type a value one character at a time, which is what a person does. */
function typeInto(input: HTMLInputElement, value: string): void {
  let held = "";
  for (const character of value) {
    held += character;
    fireEvent.change(input, { target: { value: held } });
  }
}

async function enterAccount(
  position: number,
  values: {
    institution?: string;
    type?: "CHECKING" | "SAVINGS";
    routing?: string;
    account?: string;
    confirmation?: string;
  },
): Promise<void> {
  const card = accountCard(position);
  if (values.institution !== undefined) {
    fireEvent.change(field("institution", card), {
      target: { value: values.institution },
    });
  }
  if (values.type) {
    const radio = card.querySelector<HTMLInputElement>(
      `[data-pp-account-type="${values.type}"] input`,
    );
    if (!radio) throw new Error("No account type control.");
    fireEvent.click(radio);
  }
  if (values.routing !== undefined) {
    typeInto(field("routing", card), values.routing);
  }
  if (values.account !== undefined) {
    typeInto(field("account", card), values.account);
  }
  if (values.confirmation !== undefined) {
    typeInto(field("account-confirm", card), values.confirmation);
  }
}

beforeEach(() => {
  resetServer();
  vi.clearAllMocks();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  vi.mocked(getRuntimeModuleDraft).mockResolvedValue({ values: {} } as never);
  vi.mocked(saveRuntimeModuleDraft).mockResolvedValue({ values: {} } as never);
  vi.mocked(getOwnPayrollPayment).mockImplementation(async () => interviewView());
  vi.mocked(saveOwnPayrollPayment).mockImplementation(async (_id, input) => save(input));
  vi.mocked(getOwnPayrollPaymentReview).mockImplementation(async () => reviewView());
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/* -------------------------------------------------------------------------- */

describe("Module 4.4 - how the worker gets paid", () => {
  describe("it reaches him through the delivered runtime", () => {
    it("registers ONE renderer, under the module key, and the runtime renders it", async () => {
      expect(resolveOnboardingModuleRenderer(MODULE_KEY)).toBeTypeOf("function");
      await open();
      expect(screen.getByText("How you get paid")).toBeTruthy();
    });

    it("does not register a renderer for anything else", () => {
      expect(resolveOnboardingModuleRenderer("PAYROLL_PAYMENT_ADMIN")).toBeUndefined();
    });
  });

  describe("the two ways of being paid", () => {
    it("offers BOTH, with neither pre-selected and neither recommended", async () => {
      await open();

      expect(screen.getByText("Direct Deposit")).toBeTruthy();
      expect(screen.getByText("MW4H Comdata Payroll Card")).toBeTruthy();

      for (const which of ["bank", "card"]) {
        const radio = capsule().querySelector<HTMLInputElement>(
          `[data-pp-choice="${which}"] input`,
        );
        expect(radio?.checked).toBe(false);
      }
      // Neither is called recommended, best, usual or fastest anywhere on the screen.
      expect(capsule().textContent).not.toMatch(
        /recommend|we suggest|most (workers|people)|best option|fastest way/i,
      );
    });

    it("tells him a bank account is not needed, because for one choice it is not", async () => {
      await open();
      expect(capsule().textContent).toMatch(/do not need a bank account/i);
    });

    it("asks for NO bank detail when he chooses the payroll card", async () => {
      await open();
      chooseMethod("card");

      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      await waitFor(() =>
        expect(capsule().querySelector("[data-pp-details]")).toBeNull(),
      );
      expect(capsule().querySelector('[data-pp-field="routing"]')).toBeNull();
      expect(capsule().querySelector('[data-pp-field="account"]')).toBeNull();
    });

    it("opens the account interview when he chooses his own bank account", async () => {
      await open();
      chooseMethod("bank");

      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(field("routing", accountCard(1))).toBeTruthy();
    });

    it("drops the bank details he had entered if he moves to the card", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      chooseMethod("card");
      await waitFor(() => expect(accounts).toHaveLength(0));
      expect(capsule().querySelector("[data-pp-details]")).toBeNull();
    });
  });

  describe("the account interview", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("offers exactly Checking and Savings, and nothing else", () => {
      const kinds = Array.from(
        accountCard(1).querySelectorAll("[data-pp-account-type]"),
      ).map((node) => node.getAttribute("data-pp-account-type"));
      expect(kinds).toEqual(["CHECKING", "SAVINGS"]);
      expect(accountCard(1).textContent).toMatch(/Checking account/);
      expect(accountCard(1).textContent).toMatch(/Savings account/);
    });

    it("says where to find a routing number rather than assuming he knows", () => {
      expect(accountCard(1).textContent).toMatch(/bottom left of your cheques/i);
    });

    it("catches a routing number no bank can have, arithmetically and at once", async () => {
      await enterAccount(1, { routing: ROUTING_BAD_CHECKSUM });
      expect(
        accountCard(1).querySelector("[data-pp-routing-invalid]"),
      ).not.toBeNull();
      expect(accountCard(1).textContent).toMatch(/one of the digits is probably wrong/i);
      // And it never claims the bank itself was found or checked.
      expect(capsule().textContent).not.toMatch(/verified|we found your bank|confirmed with/i);
    });

    it("accepts a routing number whose check digit holds, with no second box for it", async () => {
      await enterAccount(1, { routing: ROUTING });
      expect(accountCard(1).querySelector("[data-pp-routing-invalid]")).toBeNull();
      // ONE routing box. A second entry for it is not required and is not offered (10-R3).
      expect(accountCard(1).querySelectorAll('[data-pp-field="routing"]')).toHaveLength(1);
    });

    it("says the bank's name is his to state, not something we checked", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));
      await waitFor(() => expect(getOwnPayrollPaymentReview).toHaveBeenCalled());
      expect(
        capsule().querySelector("[data-pp-review-institution-source]")?.textContent,
      ).toMatch(/have not checked it with the bank/i);
    });
  });

  describe("the account number is typed twice, INDEPENDENTLY", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("asks for it twice, and says why", () => {
      expect(field("account", accountCard(1))).toBeTruthy();
      expect(field("account-confirm", accountCard(1))).toBeTruthy();
      expect(accountCard(1).textContent).toMatch(/type the account number again/i);
      expect(accountCard(1).textContent).toMatch(
        /catch a wrong digit before payday/i,
      );
    });

    it("REFUSES A PASTE into the confirmation box, and says why", () => {
      const confirm = field("account-confirm", accountCard(1));
      const pasted = fireEvent.paste(confirm, {
        clipboardData: { getData: () => ACCOUNT },
      });

      // The default action was prevented, so nothing was pasted.
      expect(pasted).toBe(false);
      expect(confirm.value).toBe("");
      expect(accountCard(1).querySelector("[data-pp-entry-blocked]")).not.toBeNull();
      expect(accountCard(1).textContent).toMatch(/rather than pasting it/i);
    });

    it("refuses a paste into the FIRST box too, so there is less to copy from", () => {
      const first = field("account", accountCard(1));
      expect(fireEvent.paste(first, { clipboardData: { getData: () => ACCOUNT } })).toBe(
        false,
      );
      expect(first.value).toBe("");
    });

    it("refuses copy and cut, so the value cannot be lifted out of either box", async () => {
      await enterAccount(1, { account: ACCOUNT });
      const first = field("account", accountCard(1));
      expect(first.value).toBe(ACCOUNT);
      expect(fireEvent.copy(first)).toBe(false);
      expect(fireEvent.cut(first)).toBe(false);
      expect(fireEvent.copy(field("account-confirm", accountCard(1)))).toBe(false);
    });

    it("refuses a drop, which is a paste by another route", () => {
      expect(fireEvent.drop(field("account-confirm", accountCard(1)))).toBe(false);
      expect(field("account-confirm", accountCard(1)).value).toBe("");
    });

    /**
     * AUTOFILL, AND EVERY OTHER MACHINE THAT FILLS A BOX AT ONCE.
     *
     * This is the assertion that actually catches autofill, because autofill raises no paste event:
     * a browser, an extension or a password manager sets the whole value in one change, and a person
     * cannot. It is written as a property of the CHANGE rather than as trust in `autoComplete`,
     * which browsers respect unevenly.
     */
    it("refuses a whole value arriving in ONE change, which is what autofill looks like", () => {
      const confirm = field("account-confirm", accountCard(1));
      fireEvent.change(confirm, { target: { value: ACCOUNT } });

      expect(confirm.value).toBe("");
      expect(accountCard(1).querySelector("[data-pp-entry-blocked]")).not.toBeNull();
    });

    it("refuses both boxes being filled at once by the same route", () => {
      fireEvent.change(field("account", accountCard(1)), {
        target: { value: ACCOUNT },
      });
      fireEvent.change(field("account-confirm", accountCard(1)), {
        target: { value: ACCOUNT },
      });
      expect(field("account", accountCard(1)).value).toBe("");
      expect(field("account-confirm", accountCard(1)).value).toBe("");
    });

    it("turns autofill away at the attribute level as well", () => {
      for (const name of ["account", "account-confirm"]) {
        expect(field(name, accountCard(1)).getAttribute("autocomplete")).toBe("off");
      }
    });

    it("lets him type it, and lets him delete a selection in one go", async () => {
      const confirm = field("account-confirm", accountCard(1));
      typeInto(confirm, ACCOUNT);
      expect(confirm.value).toBe(ACCOUNT);
      // A worker who selects the lot and starts again is doing what we asked him to do.
      fireEvent.change(confirm, { target: { value: "" } });
      expect(confirm.value).toBe("");
    });

    it("tells him the two do not match while he types, WITHOUT echoing either", async () => {
      await enterAccount(1, { account: ACCOUNT, confirmation: OTHER_ACCOUNT });
      const notice = accountCard(1).querySelector("[data-pp-confirm-differs]");
      expect(notice).not.toBeNull();
      expect(notice?.textContent).not.toMatch(/\d{4,}/);
    });

    /**
     * THE COMPARISON IS THE SERVER'S. This is the assertion that says so: the browser sends the two
     * entries as two values, sends NO verdict about them, and the refusal comes back from the
     * server.
     */
    it("sends BOTH entries and NO verdict, and lets the server refuse the mismatch", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: OTHER_ACCOUNT,
      });
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(
          capsule().querySelector(
            '[data-pp-refusal="ACCOUNT_NUMBER_CONFIRMATION_MISMATCH"]',
          ),
        ).not.toBeNull(),
      );

      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      const account = sent?.accounts?.[0];
      expect(account?.accountNumber).toBe(ACCOUNT);
      expect(account?.accountNumberConfirmation).toBe(OTHER_ACCOUNT);
      // No verdict travels. A browser cannot assert the outcome of a comparison it did not run.
      expect(Object.keys(account ?? {})).not.toContain("confirmed");
      expect(JSON.stringify(sent)).not.toMatch(/"confirmed"|"matched"|"verified"/);

      // And the worker's sentence carries neither value.
      const said = capsule().querySelector("[data-pp-refusal]")?.textContent ?? "";
      expect(said).toMatch(/not the same/i);
      expect(said).not.toContain(ACCOUNT);
      expect(said).not.toContain(OTHER_ACCOUNT);
      expect(said).not.toMatch(/\d{4,}/);
    });

    it("records the server's confirmation, and never shows the number again", async () => {
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));

      await waitFor(() => expect(accounts[0]?.confirmedAt).not.toBeNull());
      // The boxes are emptied on success: the typed values have served their only purpose.
      await waitFor(() => expect(field("account", accountCard(1)).value).toBe(""));
      expect(field("account-confirm", accountCard(1)).value).toBe("");
      expect(accountCard(1).textContent).toMatch(/••••7890/);
      expect(accountCard(1).textContent).not.toContain(ACCOUNT);
    });
  });

  describe("up to three accounts, and no more", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("lets him add a second and a third", async () => {
      fireEvent.click(action("add-account"));
      expect(accountCard(2)).toBeTruthy();
      fireEvent.click(action("add-account"));
      expect(accountCard(3)).toBeTruthy();
    });

    it("STOPS OFFERING a fourth, and says why", () => {
      fireEvent.click(action("add-account"));
      fireEvent.click(action("add-account"));

      expect(capsule().querySelector('[data-pp-action="add-account"]')).toBeNull();
      expect(capsule().querySelector("[data-pp-account-ceiling]")).not.toBeNull();
      expect(capsule().textContent).toMatch(/up to 3 accounts/i);
      expect(capsule().querySelector('[data-pp-account="4"]')).toBeNull();
    });

    it("never sends more than three, whatever the screen shows", async () => {
      fireEvent.click(action("add-account"));
      fireEvent.click(action("add-account"));
      fireEvent.click(action("save"));

      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      expect(sent?.accounts?.length).toBeLessThanOrEqual(3);
    });

    it("lets him remove one once there is more than one", () => {
      expect(accountCard(1).querySelector("[data-pp-remove-account]")).toBeNull();
      fireEvent.click(action("add-account"));
      const remove = accountCard(2).querySelector<HTMLElement>(
        '[data-pp-remove-account="2"]',
      );
      expect(remove).not.toBeNull();
      fireEvent.click(remove as HTMLElement);
      expect(capsule().querySelector('[data-pp-account="2"]')).toBeNull();
    });
  });

  describe("how his pay is divided", () => {
    beforeEach(async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      fireEvent.click(action("add-account"));
    });

    it("explains both approaches without naming an internal anything", () => {
      const allocation = capsule().querySelector("[data-pp-allocation]");
      expect(allocation).not.toBeNull();
      expect(allocation?.textContent).toMatch(/By percentage/);
      expect(allocation?.textContent).toMatch(/Set amounts, with the rest in one account/);
      expect(allocation?.textContent).toMatch(/one of these two ways, not both/i);
      // No enum reaches the screen.
      expect(allocation?.textContent).not.toMatch(/FIXED_AMOUNT|REMAINING_BALANCE|_/);
    });

    it("totals his percentages for him, and says when they are wrong", () => {
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      const boxes = capsule().querySelectorAll<HTMLInputElement>(
        '[data-pp-field="percentage"]',
      );
      fireEvent.change(boxes[0], { target: { value: "60" } });
      fireEvent.change(boxes[1], { target: { value: "30" } });

      expect(capsule().textContent).toMatch(/adds up to 90%/);
      expect(capsule().textContent).toMatch(/has to be exactly 100%/);

      fireEvent.change(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[1],
        { target: { value: "40" } },
      );
      expect(capsule().textContent).toMatch(/adds up to 100%/);
    });

    it("adds exact decimals correctly, which floats would not", () => {
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      fireEvent.click(action("add-account"));
      const boxes = capsule().querySelectorAll<HTMLInputElement>(
        '[data-pp-field="percentage"]',
      );
      fireEvent.change(boxes[0], { target: { value: "33.33" } });
      fireEvent.change(boxes[1], { target: { value: "33.33" } });
      fireEvent.change(boxes[2], { target: { value: "33.34" } });

      expect(capsule().textContent).toMatch(/adds up to 100%/);
    });

    it("makes TWO remainder accounts unexpressible, and asks for one", () => {
      fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);

      expect(capsule().querySelector("[data-pp-remainder-missing]")).not.toBeNull();

      const remainders = capsule().querySelectorAll<HTMLInputElement>(
        "[data-pp-remainder-for] input",
      );
      expect(remainders).toHaveLength(2);
      // A radio group. "Both of them" is not a state this shape has.
      expect(Array.from(remainders).every((input) => input.type === "radio")).toBe(true);
      expect(new Set(Array.from(remainders).map((input) => input.name)).size).toBe(1);

      fireEvent.click(remainders[0]);
      expect(capsule().querySelector("[data-pp-remainder-missing]")).toBeNull();
      expect(
        Array.from(
          capsule().querySelectorAll<HTMLInputElement>("[data-pp-remainder-for] input"),
        ).filter((input) => input.checked),
      ).toHaveLength(1);
    });

    it("asks for an amount only for the accounts that are not taking the remainder", () => {
      fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);
      fireEvent.click(
        capsule().querySelectorAll<HTMLInputElement>("[data-pp-remainder-for] input")[0],
      );

      const amounts = capsule().querySelectorAll('[data-pp-field="amount"]');
      expect(amounts).toHaveLength(1);
      expect(amounts[0].getAttribute("data-pp-amount-for")).toBe("2");
    });

    it("cannot hold both approaches at once: choosing one clears the other's figures", () => {
      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      fireEvent.change(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[0],
        { target: { value: "60" } },
      );

      fireEvent.click(capsule().querySelector('[data-pp-mode="fixed"] input') as HTMLElement);
      expect(capsule().querySelector('[data-pp-field="percentage"]')).toBeNull();

      fireEvent.click(
        capsule().querySelector('[data-pp-mode="percentage"] input') as HTMLElement,
      );
      expect(
        capsule().querySelectorAll<HTMLInputElement>('[data-pp-field="percentage"]')[0]
          .value,
      ).toBe("");
    });
  });

  describe("the rules the server reports", () => {
    it("says each one in his own words, and never as a code", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      fireEvent.click(action("save"));
      await waitFor(() =>
        expect(capsule().querySelector('[data-pp-violations="true"]')).not.toBeNull(),
      );

      const summary = capsule().querySelector('[data-pp-violations="true"]');
      expect(summary?.textContent).toMatch(/Tell us whether each account is a checking/i);
      expect(summary?.textContent).toMatch(/name of your bank/i);
      // No identifier reaches him.
      expect(summary?.textContent).not.toMatch(/[A-Z]{4,}_[A-Z]/);
    });

    it("names the account a rule is about, so he knows which one to fix", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      fireEvent.click(action("add-account"));
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(
          capsule().querySelector('[data-pp-violation="FINANCIAL_INSTITUTION_REQUIRED"]'),
        ).not.toBeNull(),
      );
      expect(
        capsule().querySelector('[data-pp-violation="FINANCIAL_INSTITUTION_REQUIRED"]')
          ?.textContent,
      ).toMatch(/^Account 2:/);
    });

    it("has a sentence for a refusal it has never seen, and shows no code", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      vi.mocked(saveOwnPayrollPayment).mockRejectedValueOnce(
        new OnboardingApiError("nope", 400, "SOMETHING_NEW_ENTIRELY"),
      );
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(capsule().querySelector('[data-pp-refusal="UNKNOWN"]')).not.toBeNull(),
      );
      const said = capsule().querySelector("[data-pp-refusal]")?.textContent ?? "";
      expect(said).toMatch(/nothing was saved/i);
      expect(said).not.toContain("SOMETHING_NEW_ENTIRELY");
    });
  });

  describe("leaving it and coming back", () => {
    it("resumes from the SERVER's protected draft, with the numbers masked", async () => {
      method = BANK;
      mode = null;
      accounts = [
        {
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          allocationKind: null,
          allocationPercentage: null,
          allocationAmount: null,
          confirmedAt: "2026-08-20T09:00:00.000Z",
        },
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();

      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(capsule().querySelector("[data-pp-resumed]")).not.toBeNull();
      expect(field("institution", accountCard(1)).value).toBe("Frost Bank");
      // What he gets back is the mask and EMPTY boxes. There is no call that returns anything wider.
      expect(accountCard(1).textContent).toMatch(/••••0021/);
      expect(accountCard(1).textContent).toMatch(/••••7890/);
      expect(field("routing", accountCard(1)).value).toBe("");
      expect(field("account", accountCard(1)).value).toBe("");
      expect(field("account-confirm", accountCard(1)).value).toBe("");
      expect(accountCard(1).textContent).toMatch(/Leave this blank to keep it/i);
    });

    it("tells him he has already typed the account number twice", async () => {
      method = BANK;
      accounts = [
        {
          position: 1,
          accountType: "SAVINGS",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          allocationKind: null,
          allocationPercentage: null,
          allocationAmount: null,
          confirmedAt: "2026-08-20T09:00:00.000Z",
        },
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      expect(accountCard(1).querySelector("[data-pp-confirmed]")).not.toBeNull();
    });

    it("carries the account number forward when he changes only his bank's name", async () => {
      method = BANK;
      accounts = [
        {
          position: 1,
          accountType: "CHECKING",
          financialInstitutionName: "Frost Bank",
          routingNumber: ROUTING,
          accountNumber: ACCOUNT,
          allocationKind: null,
          allocationPercentage: null,
          allocationAmount: null,
          confirmedAt: "2026-08-20T09:00:00.000Z",
        },
      ];
      savedAt = "2026-08-20T09:00:00.000Z";

      await open();
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      await enterAccount(1, { institution: "Frost Bank NA" });
      fireEvent.click(action("save"));

      await waitFor(() =>
        expect(accounts[0]?.financialInstitutionName).toBe("Frost Bank NA"),
      );
      // Neither protected value was sent, and neither was lost.
      const sent = vi.mocked(saveOwnPayrollPayment).mock.calls.at(-1)?.[1];
      expect(sent?.accounts?.[0]?.accountNumber).toBeUndefined();
      expect(sent?.accounts?.[0]?.routingNumber).toBeUndefined();
      expect(accounts[0]?.accountNumber).toBe(ACCOUNT);
      expect(accounts[0]?.confirmedAt).not.toBeNull();
    });
  });

  describe("the review, which is where this gate ends", () => {
    async function reachReview(): Promise<void> {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("review"));
      await waitFor(() => expect(capsule().querySelector("[data-pp-review]")).not.toBeNull());
    }

    it("shows MASKED banking values, and no full value anywhere on the screen", async () => {
      await reachReview();

      const review = capsule().querySelector("[data-pp-review]") as HTMLElement;
      expect(review.querySelector("[data-pp-review-routing]")?.textContent).toBe("••••0021");
      expect(review.querySelector("[data-pp-review-account-number]")?.textContent).toBe(
        "••••7890",
      );
      expect(review.textContent).not.toContain(ACCOUNT);
      expect(review.textContent).not.toContain(ROUTING);
      // Not in an attribute either, which is where a value hides from a text scan.
      expect(capsule().outerHTML).not.toContain(ACCOUNT);
      expect(capsule().outerHTML).not.toContain(ROUTING);
    });

    it("says we cannot show him the whole numbers again", async () => {
      await reachReview();
      expect(
        capsule().querySelector("[data-pp-review-masking]")?.textContent,
      ).toMatch(/not able to show you the whole numbers again/i);
    });

    it("says which kind of account it is, and what goes to it", async () => {
      await reachReview();
      expect(
        capsule().querySelector("[data-pp-review-account-type]")?.textContent,
      ).toBe("Checking");
      expect(capsule().querySelector("[data-pp-review-share]")).not.toBeNull();
    });

    it("confirms he typed the number twice, once the server says so", async () => {
      await reachReview();
      expect(capsule().querySelector("[data-pp-review-confirmed]")?.textContent).toMatch(
        /typed each account number twice and they matched/i,
      );
    });

    it("SAYS IT IS NOT IN PLACE YET, and that nothing was sent to his bank", async () => {
      await reachReview();
      const pending = capsule().querySelector("[data-pp-review-pending]")?.textContent ?? "";
      expect(pending).toMatch(/has not been put in place yet/i);
      expect(pending).toMatch(/Nothing has been sent to your bank/i);
      expect(pending).toMatch(/asked to confirm it in a later step/i);
    });

    it("offers NO signature, authorization, activation or effective date", async () => {
      await reachReview();

      const text = capsule().textContent ?? "";
      expect(text).not.toMatch(/sign|signature|authorize|authorise|activate|execute/i);
      expect(text).not.toMatch(/effective date|starts on|takes effect on/i);
      expect(capsule().querySelector("canvas")).toBeNull();
      expect(capsule().querySelector('input[type="date"]')).toBeNull();

      const controls = Array.from(capsule().querySelectorAll("button")).map(
        (button) => button.getAttribute("data-pp-action"),
      );
      expect(controls).toEqual(["change"]);
    });

    it("lets him go back and change something", async () => {
      await reachReview();
      fireEvent.click(action("change"));
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
    });

    it("does not open the review while a rule is still broken", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());

      fireEvent.click(action("review"));
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      expect(getOwnPayrollPaymentReview).not.toHaveBeenCalled();
      expect(capsule().querySelector("[data-pp-review]")).toBeNull();
    });
  });

  describe("the payroll card, at review", () => {
    async function reachCardReview(): Promise<void> {
      await open();
      chooseMethod("card");
      await waitFor(() => expect(saveOwnPayrollPayment).toHaveBeenCalled());
      fireEvent.click(action("review"));
      await waitFor(() => expect(capsule().querySelector("[data-pp-review]")).not.toBeNull());
    }

    it("shows the choice he made, with no bank details to show", async () => {
      await reachCardReview();
      expect(capsule().querySelector("[data-pp-review-method]")?.textContent).toBe(
        "MW4H Comdata Payroll Card",
      );
      expect(capsule().querySelector("[data-pp-review-account]")).toBeNull();
    });

    it("DOES NOT SAY HE HAS A CARD, and says MW4H will arrange it", async () => {
      await reachCardReview();
      const next = capsule().querySelector("[data-pp-review-card-next]")?.textContent ?? "";
      expect(next).toMatch(/MW4H will arrange the card with you/i);
      expect(next).toMatch(/has not been ordered or set up yet/i);

      const text = capsule().textContent ?? "";
      expect(text).not.toMatch(/your card is (ready|active|on its way)/i);
      expect(text).not.toMatch(/card number|activated|shipped|mailed/i);
    });

    it("creates nothing: the only calls made are this module's own three", async () => {
      await reachCardReview();
      expect(getOwnPayrollPayment).toHaveBeenCalled();
      expect(saveOwnPayrollPayment).toHaveBeenCalled();
      expect(getOwnPayrollPaymentReview).toHaveBeenCalled();
      expect(completeOnboardingModule).not.toHaveBeenCalled();
    });
  });

  describe("the Gate 10B boundary, as the browser can see it", () => {
    it("NEVER COMPLETES THE MODULE, by any route through the screen", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));
      fireEvent.click(action("review"));
      await waitFor(() => expect(capsule().querySelector("[data-pp-review]")).not.toBeNull());

      expect(completeOnboardingModule).not.toHaveBeenCalled();
    });

    it("writes nothing to the runtime's shared debounced draft", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, { routing: ROUTING, account: ACCOUNT, confirmation: ACCOUNT });

      expect(saveRuntimeModuleDraft).not.toHaveBeenCalled();
    });

    it("PERSISTS NO BANKING VALUE IN THE BROWSER, anywhere it could be read back", async () => {
      const setLocal = vi.spyOn(window.localStorage, "setItem");
      const setSession = vi.spyOn(window.sessionStorage, "setItem");
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, {
        institution: "Frost Bank",
        type: "CHECKING",
        routing: ROUTING,
        account: ACCOUNT,
        confirmation: ACCOUNT,
      });
      fireEvent.click(action("save"));
      await waitFor(() => expect(accounts).toHaveLength(1));

      const wrote = [...setLocal.mock.calls, ...setSession.mock.calls]
        .map((call) => JSON.stringify(call))
        .join(" ");
      expect(wrote).not.toContain(ACCOUNT);
      expect(wrote).not.toContain(ROUTING);

      const storage = [
        JSON.stringify(window.localStorage),
        JSON.stringify(window.sessionStorage),
        document.cookie,
        window.location.href,
        window.location.search,
      ].join(" ");
      expect(storage).not.toContain(ACCOUNT);
      expect(storage).not.toContain(ROUTING);

      const said = [log, warn, error]
        .flatMap((spy) => spy.mock.calls)
        .map((call) => JSON.stringify(call))
        .join(" ");
      expect(said).not.toContain(ACCOUNT);
      expect(said).not.toContain(ROUTING);

      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    });

    it("keeps no banking value in a key, an id or a data attribute", async () => {
      await open();
      chooseMethod("bank");
      await waitFor(() => expect(accountCard(1)).toBeTruthy());
      await enterAccount(1, { routing: ROUTING, account: ACCOUNT, confirmation: ACCOUNT });

      for (const element of Array.from(capsule().querySelectorAll("*"))) {
        for (const attribute of Array.from(element.attributes)) {
          if (attribute.name === "value") continue;
          expect(attribute.value).not.toContain(ACCOUNT);
          expect(attribute.value).not.toContain(ROUTING);
        }
      }
    });
  });
});
