import { apiFetch } from "@/lib/api";

/**
 * TE-S1 Working Timesheet Hub contract.
 *
 * A Working Timesheet is ONE Job Order + ONE Monday->Sunday crew-week. Its `id` is the
 * deterministic backend identity (`${orderId}__${weekStart}`), so it is stable across
 * reads and safe to use as the Hub's navigation target.
 */

/** Only state produced by TE-S1. Later lifecycle states are owned by a later slice. */
export type WorkingTimesheetStatus = "Draft";

export interface WorkingTimesheetSummary {
  id: string;
  orderId: string;
  orderRef: string;
  customerId: string;
  customerName: string;
  /** Crew-week Monday, YYYY-MM-DD. */
  weekStart: string;
  /** Crew-week Sunday, YYYY-MM-DD. */
  weekEnding: string;
  workers: number;
  status: WorkingTimesheetStatus;
}

export interface WorkingTimesheetCustomerGroup {
  customerId: string;
  customerName: string;
  workingTimesheets: WorkingTimesheetSummary[];
}

export interface WorkingTimesheetHubResponse {
  weekStart: string;
  weekEnding: string;
  customerGroups: WorkingTimesheetCustomerGroup[];
}

/**
 * Fetch the Working Timesheets for a completed crew-week.
 *
 * `weekStart` must be a Monday (YYYY-MM-DD). When omitted the backend uses the most
 * recently completed crew-week, so the Hub is populated once a week has closed without
 * staff creating each Working Timesheet by hand.
 */
export async function fetchWorkingTimesheetHub(
  weekStart?: string,
): Promise<WorkingTimesheetHubResponse> {
  const query = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  return apiFetch<WorkingTimesheetHubResponse>(`/time-entry/working-timesheets${query}`);
}
