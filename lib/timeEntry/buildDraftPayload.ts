/**
 * TE-S2B5 Save Draft payload builder.
 *
 * Turns the truthful Working Timesheet screen state into the authoritative request contract.
 *
 * TWO RULES GOVERN THIS FILE, and both exist to keep persistence honest:
 *
 *   1. SOURCE FACTS ARE SENT FOR THE CURRENT MODE ONLY. In DAILY mode only per-day worked
 *      hours are sent; in WEEKLY mode only the weekly total is sent. The backend therefore
 *      replaces just that granularity, which is what lets a mode switch preserve the other
 *      granularity instead of destroying it. Sending both would make "cleared" and "not
 *      represented by this mode" indistinguishable.
 *
 *   2. A CALCULATED DISPLAY VALUE IS NOT A SOURCE FACT. A weekly total is never expanded into
 *      seven fabricated days, and daily hours are never collapsed into a weekly total that the
 *      operator did not type.
 *
 * Classifications come from the approved GOLD engine, which this file only reads.
 */

export type DraftEntryMode = "DAILY" | "WEEKLY";

export interface DraftPayloadJobRow {
  jobRowIndex: number;
  projectRef?: string | null;
  /**
   * TE-S2B8 the DURABLE Customer Job id, never the typed description.
   *
   * Text is not sent and is never matched into an identity: descriptions are renameable, and two
   * Job Orders may each legitimately have a "First Floor", so text could not identify one. Null
   * when the operator selected no Customer Job, which persists truthfully as "not recorded".
   */
  customerJobId?: string | null;
  dailyHours?: Array<{ workDate: string; quantity: number }>;
  weeklyHours?: number;
  weeklyOtAllocation?: number;
  dailyDt?: Array<{ workDate: string; quantity: number }>;
  weeklyDt?: number;
  sdDates?: string[];
  perDiemDays?: number;
}

export interface DraftPayloadItem {
  billability: "BILLABLE" | "NON_BILLABLE";
  itemType: string;
  unit: "DOLLARS" | "DAYS";
  value: number;
  note?: string | null;
  sortOrder: number;
}

export interface DraftPayloadClassification {
  earningCode: string;
  unit: string;
  quantity: number;
  projectRef?: string | null;
  jobRowIndex?: number;
}

export interface DraftPayloadWorker {
  candidateId: string;
  sdEligible?: boolean;
  totalHours?: number;
  jobRows?: DraftPayloadJobRow[];
  items?: DraftPayloadItem[];
  classifications?: DraftPayloadClassification[];
}

export interface SaveDraftPayload {
  entryMode: DraftEntryMode;
  workers: DraftPayloadWorker[];
}

/** The shapes this builder reads. Kept structural so it never imports the page component. */
export interface BuilderJobRow {
  id: string;
  jobId: string;
  /** TE-S2B8 selected durable Customer Job, or null when none has been selected for this row. */
  customerJobId?: string | null;
  dailyHours: number[];
  perDiemDays: number;
  weeklyTotalHours: number;
  weeklyOtAllocation: number;
  dailyDtHours?: number[];
  weeklyDtHours?: number;
}

export interface BuilderItem {
  id: string;
  type: string;
  note: string;
  value: number;
}

export interface BuilderEmployee {
  id: string;
  jobRows: BuilderJobRow[];
  billableItems: BuilderItem[];
  nonBillableItems: BuilderItem[];
}

export interface BuilderTotals {
  totalHours: number;
  reg: number;
  ot: number;
  dt: number;
}

export interface BuilderSdOverlay {
  regSdHours: number;
  otSdHours: number;
  dtSdHours: number;
}

export interface BuildDraftPayloadInput {
  entryMode: "daily" | "weekly";
  employees: BuilderEmployee[];
  /** Crew-week Monday, YYYY-MM-DD. Day index 0 is Monday. */
  weekStart: string;
  /** Worker-week SD eligibility, keyed by employee id. */
  workerSdEnabled: Record<string, boolean>;
  /** Per employee, per job-row id, the seven SD day flags. */
  rowSdFlags: Record<string, Record<string, boolean[]>>;
  /** GOLD totals for the current mode, keyed by employee id. */
  totalsByEmployeeId: Record<string, BuilderTotals>;
  /** GOLD SD overlay for the current mode, keyed by employee id. Daily mode only. */
  sdOverlayByEmployeeId?: Record<string, BuilderSdOverlay>;
}

/** The UI's item type labels mapped onto the persisted Time Entry taxonomy. */
const ITEM_TYPE_BY_LABEL: Record<string, string> = {
  Bonus: "BONUS",
  Hazard: "HAZARD",
  Mobilization: "MOBILIZATION",
  Demobilization: "DEMOBILIZATION",
  Reimbursement: "REIMBURSEMENT",
  "Per Diem": "PER_DIEM",
  Other: "OTHER",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Day index 0..6 to its ISO date within the crew-week. Monday is 0. */
export function workDateForDayIndex(weekStart: string, dayIdx: number): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  return new Date(start.getTime() + dayIdx * MS_PER_DAY).toISOString().slice(0, 10);
}

function mapItem(
  item: BuilderItem,
  billability: "BILLABLE" | "NON_BILLABLE",
  sortOrder: number,
): DraftPayloadItem | null {
  const itemType = ITEM_TYPE_BY_LABEL[item.type];
  // An untouched placeholder carries no value; it is not a fact and is not sent.
  if (!itemType) return null;
  if (!item.value) return null;

  // Non-billable Per Diem is the one item denominated in DAYS; everything else is money.
  const unit: "DOLLARS" | "DAYS" =
    billability === "NON_BILLABLE" && itemType === "PER_DIEM" ? "DAYS" : "DOLLARS";

  return {
    billability,
    itemType,
    unit,
    value: item.value,
    note: item.note ? item.note : null,
    sortOrder,
  };
}

/**
 * Governed classification lines for one worker, taken from the approved engine's output.
 *
 * REG/OT/DT are the worker-level hour classifications. The SD buckets decompose those same
 * hours and are therefore never additional worked time. Zero quantities are omitted, so an
 * untouched worker produces nothing.
 */
function buildClassifications(
  totals: BuilderTotals,
  sd: BuilderSdOverlay | undefined,
): DraftPayloadClassification[] {
  const lines: DraftPayloadClassification[] = [];

  if (totals.reg > 0) lines.push({ earningCode: "REG", unit: "HOURS", quantity: totals.reg });
  if (totals.ot > 0) lines.push({ earningCode: "OT", unit: "HOURS", quantity: totals.ot });
  if (totals.dt > 0) lines.push({ earningCode: "DT", unit: "HOURS", quantity: totals.dt });

  if (sd) {
    if (sd.regSdHours > 0)
      lines.push({ earningCode: "REG", unit: "REG_SD", quantity: sd.regSdHours });
    if (sd.otSdHours > 0) lines.push({ earningCode: "OT", unit: "OT_SD", quantity: sd.otSdHours });
    if (sd.dtSdHours > 0) lines.push({ earningCode: "DT", unit: "DT_SD", quantity: sd.dtSdHours });
  }

  return lines;
}

/**
 * True when this job row carries any fact worth persisting.
 *
 * TE-S2B8 counts a selected Customer Job as one. Choosing "First Floor" IS operator input, so a
 * row carrying only that selection must persist - otherwise the choice would silently vanish on
 * reopen. An untouched row still has no Customer Job and is still omitted, so pressing Save Draft
 * continues to manufacture nothing.
 */
function rowHasFact(row: DraftPayloadJobRow): boolean {
  return (
    !!row.customerJobId ||
    (row.dailyHours?.length ?? 0) > 0 ||
    (row.weeklyHours ?? 0) > 0 ||
    (row.dailyDt?.length ?? 0) > 0 ||
    (row.weeklyDt ?? 0) > 0 ||
    (row.sdDates?.length ?? 0) > 0 ||
    (row.perDiemDays ?? 0) > 0 ||
    (row.weeklyOtAllocation ?? 0) > 0
  );
}

/**
 * Build the Save Draft payload.
 *
 * Only workers with an actual entered fact are included. An untouched roster worker is omitted
 * entirely, so pressing Save Draft never manufactures an empty draft for them.
 */
export function buildDraftPayload(input: BuildDraftPayloadInput): SaveDraftPayload {
  const entryMode: DraftEntryMode = input.entryMode === "daily" ? "DAILY" : "WEEKLY";
  const isDaily = entryMode === "DAILY";

  const workers: DraftPayloadWorker[] = [];

  for (const employee of input.employees) {
    const sdEligible = input.workerSdEnabled[employee.id] ?? false;
    const totals = input.totalsByEmployeeId[employee.id];
    const sdOverlay = isDaily ? input.sdOverlayByEmployeeId?.[employee.id] : undefined;

    const jobRows: DraftPayloadJobRow[] = [];

    employee.jobRows.forEach((row, jobRowIndex) => {
      const payloadRow: DraftPayloadJobRow = {
        jobRowIndex,
        projectRef: row.jobId ?? null,
        // Normalized to null so "no Customer Job" is one value rather than both undefined and
        // empty string, which the backend would otherwise have to disambiguate.
        customerJobId: row.customerJobId ? row.customerJobId : null,
      };

      if (isDaily) {
        // Only days the operator actually entered. Nothing is derived from a weekly total.
        const dailyHours = row.dailyHours
          .map((quantity, dayIdx) => ({
            workDate: workDateForDayIndex(input.weekStart, dayIdx),
            quantity,
          }))
          .filter((cell) => cell.quantity > 0);
        if (dailyHours.length > 0) payloadRow.dailyHours = dailyHours;

        const dailyDt = (row.dailyDtHours ?? [])
          .map((quantity, dayIdx) => ({
            workDate: workDateForDayIndex(input.weekStart, dayIdx),
            quantity,
          }))
          .filter((cell) => cell.quantity > 0);
        if (dailyDt.length > 0) payloadRow.dailyDt = dailyDt;

        const flags = input.rowSdFlags[employee.id]?.[row.id] ?? [];
        const sdDates = flags
          .map((on, dayIdx) => (on ? workDateForDayIndex(input.weekStart, dayIdx) : null))
          .filter((iso): iso is string => iso !== null);
        if (sdDates.length > 0) payloadRow.sdDates = sdDates;
      } else {
        // Weekly mode: the operator's weekly total only. No Mon-Sun values are invented.
        if (row.weeklyTotalHours > 0) payloadRow.weeklyHours = row.weeklyTotalHours;
        if ((row.weeklyDtHours ?? 0) > 0) payloadRow.weeklyDt = row.weeklyDtHours;
      }

      if (row.weeklyOtAllocation > 0) payloadRow.weeklyOtAllocation = row.weeklyOtAllocation;
      if (row.perDiemDays > 0) payloadRow.perDiemDays = row.perDiemDays;

      if (rowHasFact(payloadRow)) jobRows.push(payloadRow);
    });

    const items: DraftPayloadItem[] = [
      ...employee.billableItems
        .map((item, i) => mapItem(item, "BILLABLE", i))
        .filter((i): i is DraftPayloadItem => i !== null),
      ...employee.nonBillableItems
        .map((item, i) => mapItem(item, "NON_BILLABLE", i))
        .filter((i): i is DraftPayloadItem => i !== null),
    ];

    const classifications = totals ? buildClassifications(totals, sdOverlay) : [];

    const hasFacts = jobRows.length > 0 || items.length > 0 || sdEligible;
    if (!hasFacts) continue;

    workers.push({
      candidateId: employee.id,
      sdEligible,
      totalHours: totals?.totalHours ?? 0,
      ...(jobRows.length > 0 ? { jobRows } : {}),
      ...(items.length > 0 ? { items } : {}),
      ...(classifications.length > 0 ? { classifications } : {}),
    });
  }

  return { entryMode, workers };
}
