/**
 * Module 4.4 - what the worker is holding on screen, and where it is allowed to live.
 *
 * IN COMPONENT STATE, AND DELIBERATELY NOWHERE ELSE. This is the one file that defines the shape a
 * plaintext routing or account number may occupy in the browser, so it is the right place to say
 * what may be done with it:
 *
 *  - IT IS NEVER WRITTEN TO BROWSER STORAGE, A COOKIE, A URL, A QUERY STRING, ANALYTICS, TELEMETRY
 *    OR THE CONSOLE. Not as a convenience, not while debugging, not behind a flag. There is no
 *    module-level variable in this capsule holding one either - the state lives in the module root's
 *    own `useState`, which means closing the tab, navigating away or unmounting the screen is
 *    sufficient to lose it. That is the intended lifetime.
 *  - IT IS NEVER USED AS AN IDENTITY. `key` below exists so a React list, a DOM id or a label
 *    association never has to be derived from an account number. A value that ends up in a key ends
 *    up in the DOM, and a value in the DOM is a value in a screenshot, a crash report and a support
 *    session.
 *  - IT IS NEVER READ BACK FROM THE SERVER. The two entry fields are write-only in the strong
 *    sense: a save sends them, the projection that comes back is masked, and the entry boxes are
 *    cleared. A worker returning to a saved account is shown the masked tail and empty boxes,
 *    because there is no call in this capsule that could obtain anything wider.
 *
 * ON THE TWO ACCOUNT-NUMBER FIELDS. They are two separate strings and they stay separate all the
 * way to the server, which is the whole mechanism of the independent second entry (10-R10, 10-R13).
 * Nothing in this capsule compares them in order to decide anything - there is a local hint so the
 * worker is not left guessing while he types, but the SERVER's comparison is the authority and its
 * refusal is what stops a save.
 */

import {
  PAYROLL_DEPOSIT_ALLOCATION_FIXED_AMOUNT,
  PAYROLL_DEPOSIT_ALLOCATION_PERCENTAGE,
  PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE,
  PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE,
  type PayrollDepositAccountType,
  type PayrollDepositAllocationKind,
  type PayrollPaymentAccountView,
  type PayrollPaymentAllocationMode,
  type SavePayrollPaymentAccountInput,
} from "@/lib/workforce/payrollPaymentApi";

/** One account as the worker is filling it in. */
export type PayrollAccountEntry = {
  /**
   * A stable local handle for this row, and nothing else.
   *
   * Never derived from a banking value, and never sent anywhere. It exists so a row keeps its
   * identity across a re-render while the worker retypes the thing that would otherwise identify
   * it.
   */
  key: string;
  accountType: PayrollDepositAccountType | null;
  financialInstitutionName: string;
  /** Entered once. There is no second entry for the routing number in V1 (10-R3). */
  routingNumber: string;
  accountNumber: string;
  accountNumberConfirmation: string;
  allocationKind: PayrollDepositAllocationKind | null;
  allocationPercentage: string;
  allocationAmount: string;
  /** The masked tail of what the server already holds for this account, or null. */
  storedRoutingMasked: string | null;
  storedAccountMasked: string | null;
  /** Whether the server already holds a confirmed account number for this row. */
  confirmed: boolean;
};

let rows = 0;

/** A fresh, empty row. */
export function newAccountEntry(
  mode: PayrollPaymentAllocationMode | null,
): PayrollAccountEntry {
  rows += 1;
  return {
    key: `row-${rows}`,
    accountType: null,
    financialInstitutionName: "",
    routingNumber: "",
    accountNumber: "",
    accountNumberConfirmation: "",
    allocationKind:
      mode === PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE
        ? PAYROLL_DEPOSIT_ALLOCATION_PERCENTAGE
        : null,
    allocationPercentage: "",
    allocationAmount: "",
    storedRoutingMasked: null,
    storedAccountMasked: null,
    confirmed: false,
  };
}

/**
 * Seed the rows from what the server holds.
 *
 * THE ENTRY BOXES COME BACK EMPTY, ALWAYS, because the projection carries masks and there is
 * nothing to put in them. That is not a limitation being worked around: a worker who is not being
 * asked to change his account number should not have it sitting in an input, and one who is will
 * type it twice exactly as he did the first time.
 */
export function entriesFromServer(
  accounts: readonly PayrollPaymentAccountView[],
): PayrollAccountEntry[] {
  return accounts.map((account) => {
    rows += 1;
    return {
      key: `row-${rows}`,
      accountType: account.accountType,
      financialInstitutionName: account.financialInstitutionName,
      routingNumber: "",
      accountNumber: "",
      accountNumberConfirmation: "",
      allocationKind: account.allocationKind,
      allocationPercentage: account.allocationPercentage ?? "",
      allocationAmount: account.allocationAmount ?? "",
      storedRoutingMasked: account.routingNumberMasked,
      storedAccountMasked: account.accountNumberMasked,
      confirmed: account.accountConfirmationMethod !== null,
    };
  });
}

/**
 * What one row states on the wire.
 *
 * OMITTED IS NOT EMPTY. A protected value the worker did not retype is omitted, which tells the
 * server to keep what it holds; sending an empty string would state that he cleared it. The two
 * account-number entries travel together or not at all, because a first entry with nothing to
 * compare it against is an unconfirmed account number.
 */
export function toAccountInput(
  entry: PayrollAccountEntry,
  position: number,
): SavePayrollPaymentAccountInput {
  const input: SavePayrollPaymentAccountInput = {
    position,
    accountType: entry.accountType,
    financialInstitutionName: entry.financialInstitutionName.trim(),
    allocationKind: entry.allocationKind,
  };

  const routing = entry.routingNumber.trim();
  if (routing.length > 0) input.routingNumber = routing;

  const account = entry.accountNumber.trim();
  const confirmation = entry.accountNumberConfirmation.trim();
  if (account.length > 0 || confirmation.length > 0) {
    input.accountNumber = account;
    input.accountNumberConfirmation = confirmation;
  }

  if (entry.allocationKind === PAYROLL_DEPOSIT_ALLOCATION_PERCENTAGE) {
    input.allocationPercentage = entry.allocationPercentage.trim();
  }
  if (entry.allocationKind === PAYROLL_DEPOSIT_ALLOCATION_FIXED_AMOUNT) {
    input.allocationAmount = entry.allocationAmount.trim();
  }
  if (entry.allocationKind === PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE) {
    input.allocationPercentage = null;
    input.allocationAmount = null;
  }

  return input;
}

/**
 * Forget every plaintext value on a row, keeping what the server confirmed it holds.
 *
 * Called after a successful save. The worker's typed routing and account numbers have served their
 * only purpose the moment the server accepts them, and holding them in state afterwards would
 * extend their lifetime for no reason at all.
 */
export function withoutEnteredValues(
  entry: PayrollAccountEntry,
  saved: PayrollPaymentAccountView | undefined,
): PayrollAccountEntry {
  return {
    ...entry,
    routingNumber: "",
    accountNumber: "",
    accountNumberConfirmation: "",
    storedRoutingMasked: saved?.routingNumberMasked ?? entry.storedRoutingMasked,
    storedAccountMasked: saved?.accountNumberMasked ?? entry.storedAccountMasked,
    confirmed: saved
      ? saved.accountConfirmationMethod !== null
      : entry.confirmed,
  };
}
