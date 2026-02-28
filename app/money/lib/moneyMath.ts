/**
 * moneyMath.ts — Canonical Money Math Helper
 * PREVIEW ONLY — NOT INVOICE — NOT SNAPSHOT
 *
 * Pure functions for Shift Differential money math verification.
 * No side effects. No IO.
 */

// ============================================
// TYPES
// ============================================

export type PayrollMultiplierType = 'REG' | 'OT' | 'DT';

export interface EffectiveRateInput {
  baseRate: number;
  sdDeltaRate: number;
  multiplier: number;
  isSd: boolean;
}

export interface PreviewRowInput {
  basePayRate: number;
  baseBillRate: number;
  otBillMultiplier: number;
  sdPayDeltaRate: number;
  sdBillDeltaRate: number;
  regHours: number;
  otHours: number;
  dtHours: number;
  regSdHours: number;
  otSdHours: number;
  dtSdHours: number;
}

export interface PreviewRow {
  bucket: string;
  hours: number;
  payMultiplier: number;
  effectivePayRate: number;
  payAmount: number;
  billMultiplier: number;
  effectiveBillRate: number;
  billAmount: number;
}

export interface PreviewResult {
  rows: PreviewRow[];
  totalHours: number;
  totalPay: number;
  totalBill: number;
}

// ============================================
// LOCKED MULTIPLIERS
// ============================================

const PAYROLL_MULTIPLIERS: Record<PayrollMultiplierType, number> = {
  REG: 1.0,
  OT: 1.5,
  DT: 2.0,
};

// ============================================
// PURE FUNCTIONS
// ============================================

/**
 * Round to 2 decimal places.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute billing DT multiplier from OT multiplier.
 * DT = ROUND(OT × 4/3, 2)
 */
export function computeBillingDtMultiplier(otMultiplier: number): number {
  return round2(otMultiplier * (4 / 3));
}

/**
 * Compute effective rate.
 * - SD is additive delta ONLY
 * - SD does NOT modify base rates
 * - SD applies ONLY to SD-classified hours
 * - SD uses SAME multipliers as base hours
 */
export function computeEffectiveRate(input: EffectiveRateInput): number {
  const { baseRate, sdDeltaRate, multiplier, isSd } = input;
  if (isSd) {
    // SD row: (baseRate + sdDeltaRate) × multiplier
    return round2((baseRate + sdDeltaRate) * multiplier);
  }
  // Non-SD row: baseRate × multiplier
  return round2(baseRate * multiplier);
}

/**
 * Compute preview rows for Shift Differential verification.
 * Returns rows in fixed order: REG, OT, DT, REG (SD), OT (SD), DT (SD)
 */
export function computePreviewRows(input: PreviewRowInput): PreviewResult {
  const {
    basePayRate,
    baseBillRate,
    otBillMultiplier,
    sdPayDeltaRate,
    sdBillDeltaRate,
    regHours,
    otHours,
    dtHours,
    regSdHours,
    otSdHours,
    dtSdHours,
  } = input;

  // Billing multipliers: REG=1.0, OT=otBillMultiplier, DT=OT×4/3
  const billMultREG = 1.0;
  const billMultOT = otBillMultiplier;
  const billMultDT = computeBillingDtMultiplier(otBillMultiplier);

  // Build rows in fixed order
  const rows: PreviewRow[] = [];

  // REG (non-SD)
  const regPayRate = computeEffectiveRate({
    baseRate: basePayRate,
    sdDeltaRate: sdPayDeltaRate,
    multiplier: PAYROLL_MULTIPLIERS.REG,
    isSd: false,
  });
  const regBillRate = computeEffectiveRate({
    baseRate: baseBillRate,
    sdDeltaRate: sdBillDeltaRate,
    multiplier: billMultREG,
    isSd: false,
  });
  rows.push({
    bucket: 'REG',
    hours: regHours,
    payMultiplier: PAYROLL_MULTIPLIERS.REG,
    effectivePayRate: regPayRate,
    payAmount: round2(regPayRate * regHours),
    billMultiplier: billMultREG,
    effectiveBillRate: regBillRate,
    billAmount: round2(regBillRate * regHours),
  });

  // OT (non-SD)
  const otPayRate = computeEffectiveRate({
    baseRate: basePayRate,
    sdDeltaRate: sdPayDeltaRate,
    multiplier: PAYROLL_MULTIPLIERS.OT,
    isSd: false,
  });
  const otBillRate = computeEffectiveRate({
    baseRate: baseBillRate,
    sdDeltaRate: sdBillDeltaRate,
    multiplier: billMultOT,
    isSd: false,
  });
  rows.push({
    bucket: 'OT',
    hours: otHours,
    payMultiplier: PAYROLL_MULTIPLIERS.OT,
    effectivePayRate: otPayRate,
    payAmount: round2(otPayRate * otHours),
    billMultiplier: billMultOT,
    effectiveBillRate: otBillRate,
    billAmount: round2(otBillRate * otHours),
  });

  // DT (non-SD)
  const dtPayRate = computeEffectiveRate({
    baseRate: basePayRate,
    sdDeltaRate: sdPayDeltaRate,
    multiplier: PAYROLL_MULTIPLIERS.DT,
    isSd: false,
  });
  const dtBillRate = computeEffectiveRate({
    baseRate: baseBillRate,
    sdDeltaRate: sdBillDeltaRate,
    multiplier: billMultDT,
    isSd: false,
  });
  rows.push({
    bucket: 'DT',
    hours: dtHours,
    payMultiplier: PAYROLL_MULTIPLIERS.DT,
    effectivePayRate: dtPayRate,
    payAmount: round2(dtPayRate * dtHours),
    billMultiplier: billMultDT,
    effectiveBillRate: dtBillRate,
    billAmount: round2(dtBillRate * dtHours),
  });

  // REG (SD)
  const regSdPayRate = computeEffectiveRate({
    baseRate: basePayRate,
    sdDeltaRate: sdPayDeltaRate,
    multiplier: PAYROLL_MULTIPLIERS.REG,
    isSd: true,
  });
  const regSdBillRate = computeEffectiveRate({
    baseRate: baseBillRate,
    sdDeltaRate: sdBillDeltaRate,
    multiplier: billMultREG,
    isSd: true,
  });
  rows.push({
    bucket: 'REG (SD)',
    hours: regSdHours,
    payMultiplier: PAYROLL_MULTIPLIERS.REG,
    effectivePayRate: regSdPayRate,
    payAmount: round2(regSdPayRate * regSdHours),
    billMultiplier: billMultREG,
    effectiveBillRate: regSdBillRate,
    billAmount: round2(regSdBillRate * regSdHours),
  });

  // OT (SD)
  const otSdPayRate = computeEffectiveRate({
    baseRate: basePayRate,
    sdDeltaRate: sdPayDeltaRate,
    multiplier: PAYROLL_MULTIPLIERS.OT,
    isSd: true,
  });
  const otSdBillRate = computeEffectiveRate({
    baseRate: baseBillRate,
    sdDeltaRate: sdBillDeltaRate,
    multiplier: billMultOT,
    isSd: true,
  });
  rows.push({
    bucket: 'OT (SD)',
    hours: otSdHours,
    payMultiplier: PAYROLL_MULTIPLIERS.OT,
    effectivePayRate: otSdPayRate,
    payAmount: round2(otSdPayRate * otSdHours),
    billMultiplier: billMultOT,
    effectiveBillRate: otSdBillRate,
    billAmount: round2(otSdBillRate * otSdHours),
  });

  // DT (SD)
  const dtSdPayRate = computeEffectiveRate({
    baseRate: basePayRate,
    sdDeltaRate: sdPayDeltaRate,
    multiplier: PAYROLL_MULTIPLIERS.DT,
    isSd: true,
  });
  const dtSdBillRate = computeEffectiveRate({
    baseRate: baseBillRate,
    sdDeltaRate: sdBillDeltaRate,
    multiplier: billMultDT,
    isSd: true,
  });
  rows.push({
    bucket: 'DT (SD)',
    hours: dtSdHours,
    payMultiplier: PAYROLL_MULTIPLIERS.DT,
    effectivePayRate: dtSdPayRate,
    payAmount: round2(dtSdPayRate * dtSdHours),
    billMultiplier: billMultDT,
    effectiveBillRate: dtSdBillRate,
    billAmount: round2(dtSdBillRate * dtSdHours),
  });

  // Compute totals
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const totalPay = round2(rows.reduce((sum, r) => sum + r.payAmount, 0));
  const totalBill = round2(rows.reduce((sum, r) => sum + r.billAmount, 0));

  return {
    rows,
    totalHours,
    totalPay,
    totalBill,
  };
}
