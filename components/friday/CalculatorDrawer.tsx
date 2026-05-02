'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { FC } from './styles';
import { fridayFetch } from './fridayFetch';

interface CalculatorDrawerProps {
  onClose: () => void;
  customerId?: string | null;
  customerName?: string | null;
}

type CostCalcType = 'standard' | 'ocip' | 'prevailing' | 'prevailing-ocip';
type SellingTab = 'presets' | 'custom-margin' | 'profit-hr';
type MarginHealthStatus = 'RED' | 'YELLOW' | 'GREEN';

interface Trade {
  id: string;
  name: string;
  wcClassCode: string;
  isActive: boolean;
}

interface BurdenPreviewResult {
  payRate: number;
  stateCode: string;
  tradeName: string;
  wcClassCode: string;
  wcSource: 'CLASS_CODE_RATE' | 'PAYROLL_BURDEN_RATE';
  burdenBreakdown: Record<string, number>;
  totalBurdenPercent: number;
  fullBaseBurdenPercent: number;
  premiumBurdenPercent: number;
  wcPercent: number;
  regCost: number;
  otCost: number;
  dtCost: number;
  regMultiplier: number;
  otMultiplier: number;
  dtMultiplier: number;
}

interface SellingRateResult {
  regSellRate: number;
  otSellRate: number;
  dtSellRate: number;
  grossMarginPct: number;
  marginHealth: MarginHealthStatus;
}

interface PresetComputeResult extends SellingRateResult {
  presetId: string;
  marginPct: number;
  otMultiplier: number;
  label: string | null;
}

interface SellingComputeResponse {
  presets: PresetComputeResult[];
  customMargin: SellingRateResult | null;
  customProfit: SellingRateResult | null;
}

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const;

const COST_TYPE_OPTIONS: { value: CostCalcType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'ocip', label: 'OCIP' },
  { value: 'prevailing', label: 'Prevailing Wage' },
  { value: 'prevailing-ocip', label: 'Prevailing Wage + OCIP' },
];

const SELLING_TABS: { value: SellingTab; label: string }[] = [
  { value: 'presets', label: 'Presets' },
  { value: 'custom-margin', label: 'Custom Margin' },
  { value: 'profit-hr', label: 'Profit $/hr' },
];

const HEALTH_COLORS: Record<MarginHealthStatus, { color: string; bg: string }> = {
  GREEN: { color: FC.accentGreen, bg: FC.accentGreenDim },
  YELLOW: { color: FC.accentAmber, bg: FC.accentAmberDim },
  RED: { color: FC.accentRed, bg: FC.accentRedDim },
};

export default function CalculatorDrawer({ onClose, customerId, customerName }: CalculatorDrawerProps) {
  // -- Commercial actions --
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState('');
  const [showRsModal, setShowRsModal] = useState(false);
  const [draftSheets, setDraftSheets] = useState<Array<{ id: string; rateSheetNumber: string | null; title: string | null }>>([]);
  const [rsLoading, setRsLoading] = useState(false);
  const [rsActionMsg, setRsActionMsg] = useState('');

  // -- Burden inputs --
  const [costType, setCostType] = useState<CostCalcType>('standard');
  const [stateCode, setStateCode] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [payRate, setPayRate] = useState('');
  const [baseWage, setBaseWage] = useState('');
  const [fringeAmount, setFringeAmount] = useState('');

  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  const [computing, setComputing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BurdenPreviewResult | null>(null);

  // -- Selling state --
  const [sellingTab, setSellingTab] = useState<SellingTab>('presets');
  const [sellingResult, setSellingResult] = useState<SellingComputeResponse | null>(null);
  const [sellingComputing, setSellingComputing] = useState(false);
  const [sellingError, setSellingError] = useState('');

  const [cmMarginPct, setCmMarginPct] = useState('');
  const [cmOtMult, setCmOtMult] = useState('1.5');
  const [cpProfitPerHour, setCpProfitPerHour] = useState('');
  const [cpOtMult, setCpOtMult] = useState('1.5');

  // -- Escape close --
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // -- Load trades on mount --
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fridayFetch<Trade[]>('/trades?activeOnly=true');
      if (cancelled) return;
      if (res.ok) setTrades(res.data);
      setTradesLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // -- Auto-compute selling when burden result changes --
  useEffect(() => {
    if (!result) {
      setSellingResult(null);
      setSellingError('');
      return;
    }
    let cancelled = false;
    (async () => {
      setSellingComputing(true);
      setSellingError('');
      const res = await fridayFetch<SellingComputeResponse>(
        '/friday/calculator/selling-compute',
        {
          method: 'POST',
          body: JSON.stringify({
            regCost: result.regCost,
            otCost: result.otCost,
            dtCost: result.dtCost,
          }),
        },
      );
      if (cancelled) return;
      setSellingComputing(false);
      if (res.ok) {
        setSellingResult(res.data);
      } else {
        setSellingError(res.error || 'Selling compute failed');
      }
    })();
    return () => { cancelled = true; };
  }, [result]);

  const isPw = costType === 'prevailing' || costType === 'prevailing-ocip';

  const canCalculate = useCallback(() => {
    if (!stateCode || !tradeId) return false;
    if (isPw) return parseFloat(baseWage) > 0;
    return parseFloat(payRate) > 0;
  }, [stateCode, tradeId, isPw, baseWage, payRate]);

  const handleCalculate = async () => {
    if (!canCalculate()) return;
    setComputing(true);
    setError('');
    setSellingResult(null);

    const body: Record<string, unknown> = { stateCode, tradeId };
    if (isPw) {
      body.baseWage = parseFloat(baseWage);
      body.fringeAmount = parseFloat(fringeAmount) || 0;
    } else {
      body.payRate = parseFloat(payRate);
    }
    if (costType === 'ocip' || costType === 'prevailing-ocip') {
      body.isOsep = true;
    }

    const res = await fridayFetch<BurdenPreviewResult>(
      '/friday/calculator/burden-preview',
      { method: 'POST', body: JSON.stringify(body) },
    );
    setComputing(false);
    if (res.ok) {
      setResult(res.data);
    } else {
      setError(res.error || 'Burden preview failed');
      setResult(null);
    }
  };

  const handleCustomMarginCompute = async () => {
    if (!result) return;
    const margin = parseFloat(cmMarginPct);
    if (isNaN(margin) || margin < 0 || margin >= 100) return;
    setSellingComputing(true);
    setSellingError('');
    const res = await fridayFetch<SellingComputeResponse>(
      '/friday/calculator/selling-compute',
      {
        method: 'POST',
        body: JSON.stringify({
          regCost: result.regCost,
          otCost: result.otCost,
          dtCost: result.dtCost,
          customMarginPct: margin,
          customOtMultiplier: parseFloat(cmOtMult) || 1.5,
        }),
      },
    );
    setSellingComputing(false);
    if (res.ok) {
      setSellingResult(res.data);
    } else {
      setSellingError(res.error || 'Selling compute failed');
    }
  };

  const handleCustomProfitCompute = async () => {
    if (!result) return;
    const profit = parseFloat(cpProfitPerHour);
    if (isNaN(profit) || profit < 0) return;
    setSellingComputing(true);
    setSellingError('');
    const res = await fridayFetch<SellingComputeResponse>(
      '/friday/calculator/selling-compute',
      {
        method: 'POST',
        body: JSON.stringify({
          regCost: result.regCost,
          otCost: result.otCost,
          dtCost: result.dtCost,
          customProfitPerHour: profit,
          customOtMultiplier: parseFloat(cpOtMult) || 1.5,
        }),
      },
    );
    setSellingComputing(false);
    if (res.ok) {
      setSellingResult(res.data);
    } else {
      setSellingError(res.error || 'Selling compute failed');
    }
  };

  const clearBurdenResults = () => {
    setResult(null);
    setError('');
    setSellingResult(null);
    setSellingError('');
  };

  return (
    <>
      <div style={backdrop} onClick={onClose} />

      <div style={drawerPanel} role="dialog" aria-label="Labor Cost Calculator">
        {/* Header */}
        <div style={drawerHeader}>
          <div style={titleStyle}>Labor Cost Calculator</div>
          <button style={closeBtn} onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* Guardrail Banner */}
        <div style={guardrailBanner}>
          Internal conversation support only. Not a quote. Final pricing requires a formal Quote.
        </div>

        {/* Body */}
        <div style={drawerBody}>
          {/* ── BURDEN INPUTS ──────────────────────────────── */}

          {/* Cost Calculation Type */}
          <div style={fieldGroup}>
            <div style={labelStyle}>Cost Calculation Type</div>
            <div style={segmentRow}>
              {COST_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  style={costType === opt.value ? segmentBtnActive : segmentBtn}
                  onClick={() => { setCostType(opt.value); clearBurdenResults(); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* State + Trade */}
          <div style={twoColRow}>
            <div>
              <div style={labelStyle}>State</div>
              <select
                style={selectStyle}
                value={stateCode}
                onChange={e => { setStateCode(e.target.value); clearBurdenResults(); }}
              >
                <option value="">Select state...</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Trade</div>
              <select
                style={selectStyle}
                value={tradeId}
                onChange={e => { setTradeId(e.target.value); clearBurdenResults(); }}
                disabled={tradesLoading}
              >
                <option value="">{tradesLoading ? 'Loading...' : 'Select trade...'}</option>
                {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Pay Rate (Standard / OCIP) */}
          {!isPw && (
            <div style={fieldGroup}>
              <div style={labelStyle}>Pay Rate ($/hr)</div>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 32.00"
                value={payRate}
                onChange={e => { setPayRate(e.target.value); clearBurdenResults(); }}
              />
            </div>
          )}

          {/* Base Wage + Fringe (Prevailing Wage) */}
          {isPw && (
            <div style={twoColRow}>
              <div>
                <div style={labelStyle}>Base Wage ($/hr)</div>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 35.00"
                  value={baseWage}
                  onChange={e => { setBaseWage(e.target.value); clearBurdenResults(); }}
                />
              </div>
              <div>
                <div style={labelStyle}>Fringe Amount ($/hr)</div>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 12.50"
                  value={fringeAmount}
                  onChange={e => { setFringeAmount(e.target.value); clearBurdenResults(); }}
                />
              </div>
            </div>
          )}

          {/* Calculate */}
          <button
            style={canCalculate() && !computing ? calcBtn : calcBtnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate() || computing}
          >
            {computing ? 'Calculating...' : 'Calculate'}
          </button>

          {/* Burden Error */}
          {error && <div style={errorBanner}>{error}</div>}

          {/* ── BURDEN RESULTS ─────────────────────────────── */}
          {result && (
            <div style={{ marginTop: 20 }}>
              <div style={contextRow}>
                <span style={contextBadge}>{result.stateCode}</span>
                <span style={contextBadge}>{result.tradeName}</span>
                <span style={contextBadge}>
                  {COST_TYPE_OPTIONS.find(o => o.value === costType)?.label}
                </span>
              </div>

              <div style={sectionLabel}>True Labor Cost</div>
              <div style={costCardsRow}>
                <CostCard label="REG" value={result.regCost} multiplier={result.regMultiplier} />
                <CostCard label="OT" value={result.otCost} multiplier={result.otMultiplier} />
                <CostCard label="DT" value={result.dtCost} multiplier={result.dtMultiplier} />
              </div>

              <div style={burdenMetaRow}>
                <span style={burdenMetaItem}>Burden: <strong>{result.totalBurdenPercent}%</strong></span>
                <span style={burdenMetaItem}>WC: <strong>{result.wcClassCode}</strong></span>
                <span style={burdenMetaItem}>
                  {result.wcSource === 'CLASS_CODE_RATE' ? 'Class Code Rate' : 'Payroll Burden Rate'}
                </span>
              </div>

              {/* ── SELLING SECTION ──────────────────────────── */}
              <div style={sellingDivider} />
              <div style={sectionLabel}>Selling Price</div>

              {sellingComputing && !sellingResult && (
                <div style={loadingText}>Computing sell rates...</div>
              )}

              {sellingError && <div style={errorBanner}>{sellingError}</div>}

              {sellingResult && (
                <>
                  {/* Tab bar */}
                  <div style={sellingTabBar}>
                    {SELLING_TABS.map(t => (
                      <button
                        key={t.value}
                        style={sellingTab === t.value ? sellingTabActive : sellingTabBtn}
                        onClick={() => setSellingTab(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Presets tab */}
                  {sellingTab === 'presets' && (
                    <div>
                      {sellingResult.presets.length === 0 ? (
                        <div style={loadingText}>No active presets configured.</div>
                      ) : (
                        <table style={breakdownTable}>
                          <thead>
                            <tr>
                              <th style={thCell}>Preset</th>
                              <th style={thCell}>Margin</th>
                              <th style={{ ...thCell, textAlign: 'right' }}>REG</th>
                              <th style={{ ...thCell, textAlign: 'right' }}>OT</th>
                              <th style={{ ...thCell, textAlign: 'right' }}>DT</th>
                              <th style={{ ...thCell, textAlign: 'center' }}>Health</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sellingResult.presets.map(p => (
                              <tr key={p.presetId}>
                                <td style={tdCell}>{p.label || `${p.marginPct}%`}</td>
                                <td style={tdCell}>{p.grossMarginPct.toFixed(1)}%</td>
                                <td style={{ ...tdCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  ${p.regSellRate.toFixed(2)}
                                </td>
                                <td style={{ ...tdCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  ${p.otSellRate.toFixed(2)}
                                </td>
                                <td style={{ ...tdCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  ${p.dtSellRate.toFixed(2)}
                                </td>
                                <td style={{ ...tdCell, textAlign: 'center' }}>
                                  <HealthBadge status={p.marginHealth} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Custom Margin tab */}
                  {sellingTab === 'custom-margin' && (
                    <div>
                      <div style={twoColRow}>
                        <div>
                          <div style={labelStyle}>Target Margin %</div>
                          <input
                            style={inputStyle}
                            type="number"
                            min="0"
                            max="99.99"
                            step="0.5"
                            placeholder="e.g. 25"
                            value={cmMarginPct}
                            onChange={e => setCmMarginPct(e.target.value)}
                          />
                        </div>
                        <div>
                          <div style={labelStyle}>OT Multiplier</div>
                          <input
                            style={inputStyle}
                            type="number"
                            min="1"
                            step="0.1"
                            value={cmOtMult}
                            onChange={e => setCmOtMult(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        style={
                          cmMarginPct && parseFloat(cmMarginPct) >= 0 && parseFloat(cmMarginPct) < 100 && !sellingComputing
                            ? computeSellingBtn
                            : computeSellingBtnDisabled
                        }
                        onClick={handleCustomMarginCompute}
                        disabled={!cmMarginPct || parseFloat(cmMarginPct) < 0 || parseFloat(cmMarginPct) >= 100 || sellingComputing}
                      >
                        {sellingComputing ? 'Computing...' : 'Compute Sell Rates'}
                      </button>
                      {sellingResult.customMargin && (
                        <SellingResultCard
                          label={`Custom ${parseFloat(cmMarginPct).toFixed(1)}% Margin`}
                          rates={sellingResult.customMargin}
                          regCost={result.regCost}
                        />
                      )}
                    </div>
                  )}

                  {/* Profit $/hr tab */}
                  {sellingTab === 'profit-hr' && (
                    <div>
                      <div style={twoColRow}>
                        <div>
                          <div style={labelStyle}>Profit $/hr</div>
                          <input
                            style={inputStyle}
                            type="number"
                            min="0"
                            step="0.50"
                            placeholder="e.g. 8.00"
                            value={cpProfitPerHour}
                            onChange={e => setCpProfitPerHour(e.target.value)}
                          />
                        </div>
                        <div>
                          <div style={labelStyle}>OT Multiplier</div>
                          <input
                            style={inputStyle}
                            type="number"
                            min="1"
                            step="0.1"
                            value={cpOtMult}
                            onChange={e => setCpOtMult(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        style={
                          cpProfitPerHour && parseFloat(cpProfitPerHour) >= 0 && !sellingComputing
                            ? computeSellingBtn
                            : computeSellingBtnDisabled
                        }
                        onClick={handleCustomProfitCompute}
                        disabled={!cpProfitPerHour || parseFloat(cpProfitPerHour) < 0 || sellingComputing}
                      >
                        {sellingComputing ? 'Computing...' : 'Compute Sell Rates'}
                      </button>
                      {sellingResult.customProfit && (
                        <SellingResultCard
                          label={`$${parseFloat(cpProfitPerHour).toFixed(2)}/hr Profit`}
                          rates={sellingResult.customProfit}
                          regCost={result.regCost}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Commercial Actions */}
          {result && customerId && (
            <div style={commercialDivider}>
              <div style={sectionLabel}>Commercial Actions</div>
              {!customerId && (
                <div style={{ fontSize: '0.75rem', color: FC.textMuted, marginBottom: 8 }}>
                  No customer context — start a call to enable commercial actions.
                </div>
              )}
              {customerName && (
                <div style={{ fontSize: '0.75rem', color: FC.textSecondary, marginBottom: 10 }}>
                  Customer: <strong>{customerName}</strong>
                </div>
              )}

              {snapshotMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 10,
                  fontSize: '0.75rem', fontWeight: 600,
                  color: snapshotMsg.startsWith('Error') ? FC.accentRed : FC.accentGreen,
                  background: snapshotMsg.startsWith('Error') ? FC.accentRedDim : FC.accentGreenDim,
                }}>
                  {snapshotMsg}
                </div>
              )}

              <button
                style={snapshotSaving ? { ...commercialBtn, opacity: 0.5 } : commercialBtn}
                disabled={snapshotSaving}
                onClick={async () => {
                  if (!result || !customerId) return;
                  setSnapshotSaving(true);
                  setSnapshotMsg('');
                  const tradeName = trades.find(t => t.id === tradeId)?.name ?? '';
                  const payload = {
                    payloadJson: {
                      costType,
                      stateCode,
                      tradeId,
                      tradeName,
                      payRate: payRate ? parseFloat(payRate) : null,
                      baseWage: baseWage ? parseFloat(baseWage) : null,
                      burden: result,
                      selling: sellingResult,
                    },
                    notes: `Calculator snapshot: ${tradeName} in ${stateCode}`,
                    state: stateCode || undefined,
                    tradeCode: tradeName || undefined,
                  };
                  const res = await fridayFetch<any>(
                    `/commercial/customers/${customerId}/pricing-snapshots`,
                    { method: 'POST', body: JSON.stringify(payload) },
                  );
                  setSnapshotSaving(false);
                  setSnapshotMsg(res.ok ? 'Pricing snapshot saved' : `Error: ${res.error}`);
                  if (res.ok) setTimeout(() => setSnapshotMsg(''), 4000);
                }}
              >
                {snapshotSaving ? 'Saving...' : 'Save Pricing Snapshot'}
              </button>

              <button
                style={{ ...commercialBtn, marginTop: 8 }}
                onClick={async () => {
                  setShowRsModal(true);
                  setRsActionMsg('');
                  setRsLoading(true);
                  const res = await fridayFetch<any[]>(
                    `/commercial/customers/${customerId}/rate-sheets`,
                  );
                  setRsLoading(false);
                  if (res.ok) {
                    setDraftSheets((res.data ?? []).filter((s: any) => s.status === 'DRAFT'));
                  } else {
                    setDraftSheets([]);
                  }
                }}
              >
                Add to Rate Sheet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add to Rate Sheet Modal */}
      {showRsModal && customerId && (
        <>
          <div style={{ ...rsModalBackdrop }} onClick={() => setShowRsModal(false)} />
          <div style={rsModalPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: FC.textPrimary }}>Add to Rate Sheet</div>
              <button style={closeBtn} onClick={() => setShowRsModal(false)}>✕</button>
            </div>

            {rsActionMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginBottom: 10,
                fontSize: '0.75rem', fontWeight: 600,
                color: rsActionMsg.startsWith('Error') ? FC.accentRed : FC.accentGreen,
                background: rsActionMsg.startsWith('Error') ? FC.accentRedDim : FC.accentGreenDim,
              }}>
                {rsActionMsg}
              </div>
            )}

            {rsLoading && <div style={{ color: FC.textMuted, fontSize: '0.8125rem', textAlign: 'center', padding: '16px 0' }}>Loading...</div>}

            {!rsLoading && (
              <>
                {draftSheets.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: FC.textSecondary, marginBottom: 8 }}>
                      Add to existing DRAFT:
                    </div>
                    {draftSheets.map((ds) => (
                      <button
                        key={ds.id}
                        style={rsSheetBtn}
                        onClick={async () => {
                          if (!result) return;
                          setRsActionMsg('');
                          const tradeName = trades.find(t => t.id === tradeId)?.name ?? '';
                          const line: Record<string, any> = {
                            tradeCode: tradeName || tradeId,
                            tradeName: tradeName || 'Unknown',
                            state: stateCode || undefined,
                            basePayRate: result.payRate,
                            baseBillRate: sellingResult?.presets?.[0]?.regSellRate ?? undefined,
                            otPayRate: result.otCost,
                            otBillRate: sellingResult?.presets?.[0]?.otSellRate ?? undefined,
                            dtPayRate: result.dtCost,
                            dtBillRate: sellingResult?.presets?.[0]?.dtSellRate ?? undefined,
                            burdenPct: result.totalBurdenPercent,
                            marginPct: sellingResult?.presets?.[0]?.grossMarginPct ?? undefined,
                          };
                          const res = await fridayFetch<any>(
                            `/commercial/rate-sheets/${ds.id}/lines`,
                            { method: 'POST', body: JSON.stringify(line) },
                          );
                          setRsActionMsg(res.ok ? `Line added to ${ds.rateSheetNumber ?? 'Rate Sheet'}` : `Error: ${res.error}`);
                          if (res.ok) setTimeout(() => { setShowRsModal(false); setRsActionMsg(''); }, 2000);
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{ds.rateSheetNumber ?? 'Draft'}</span>
                        {ds.title && <span style={{ color: FC.textMuted, marginLeft: 8 }}>{ds.title}</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: FC.textSecondary, marginBottom: 8 }}>
                    Or create new DRAFT Rate Sheet:
                  </div>
                  <button
                    style={rsCreateBtn}
                    onClick={async () => {
                      if (!result || !customerId) return;
                      setRsActionMsg('');
                      const expDate = new Date();
                      expDate.setDate(expDate.getDate() + 30);
                      const tradeName = trades.find(t => t.id === tradeId)?.name ?? '';
                      const createRes = await fridayFetch<{ id: string; rateSheetNumber: string }>(
                        `/commercial/customers/${customerId}/rate-sheets`,
                        {
                          method: 'POST',
                          body: JSON.stringify({
                            title: `Rate Sheet — ${tradeName || 'New'}`,
                            expiresAt: expDate.toISOString(),
                          }),
                        },
                      );
                      if (!createRes.ok) {
                        setRsActionMsg(`Error: ${createRes.error}`);
                        return;
                      }
                      const line: Record<string, any> = {
                        tradeCode: tradeName || tradeId,
                        tradeName: tradeName || 'Unknown',
                        state: stateCode || undefined,
                        basePayRate: result.payRate,
                        baseBillRate: sellingResult?.presets?.[0]?.regSellRate ?? undefined,
                        otPayRate: result.otCost,
                        otBillRate: sellingResult?.presets?.[0]?.otSellRate ?? undefined,
                        dtPayRate: result.dtCost,
                        dtBillRate: sellingResult?.presets?.[0]?.dtSellRate ?? undefined,
                        burdenPct: result.totalBurdenPercent,
                        marginPct: sellingResult?.presets?.[0]?.grossMarginPct ?? undefined,
                      };
                      const lineRes = await fridayFetch<any>(
                        `/commercial/rate-sheets/${createRes.data.id}/lines`,
                        { method: 'POST', body: JSON.stringify(line) },
                      );
                      if (lineRes.ok) {
                        setRsActionMsg(`Created ${createRes.data.rateSheetNumber} with line`);
                        setTimeout(() => { setShowRsModal(false); setRsActionMsg(''); }, 2000);
                      } else {
                        setRsActionMsg(`Sheet created but line failed: ${lineRes.error}`);
                      }
                    }}
                  >
                    + Create New Rate Sheet
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function CostCard({ label, value, multiplier }: { label: string; value: number; multiplier: number }) {
  return (
    <div style={costCard}>
      <div style={costCardLabel}>{label}</div>
      <div style={costCardValue}>${value.toFixed(2)}</div>
      <div style={costCardMult}>{multiplier.toFixed(2)}x</div>
    </div>
  );
}

function HealthBadge({ status }: { status: MarginHealthStatus }) {
  const scheme = HEALTH_COLORS[status] ?? HEALTH_COLORS.RED;
  const style: CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: '0.625rem',
    fontWeight: 700,
    color: scheme.color,
    background: scheme.bg,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };
  return <span style={style}>{status}</span>;
}

function SellingResultCard({
  label,
  rates,
  regCost,
}: {
  label: string;
  rates: SellingRateResult;
  regCost: number;
}) {
  const profitPerHour = rates.regSellRate - regCost;
  const markupPct = regCost > 0 ? ((rates.regSellRate - regCost) / regCost) * 100 : 0;
  return (
    <div style={sellingResultCard}>
      <div style={sellingResultHeader}>
        <span style={sellingResultLabel}>{label}</span>
        <HealthBadge status={rates.marginHealth} />
      </div>
      <div style={costCardsRow}>
        <div style={costCard}>
          <div style={costCardLabel}>REG Sell</div>
          <div style={costCardValue}>${rates.regSellRate.toFixed(2)}</div>
        </div>
        <div style={costCard}>
          <div style={costCardLabel}>OT Sell</div>
          <div style={costCardValue}>${rates.otSellRate.toFixed(2)}</div>
        </div>
        <div style={costCard}>
          <div style={costCardLabel}>DT Sell</div>
          <div style={costCardValue}>${rates.dtSellRate.toFixed(2)}</div>
        </div>
      </div>
      <div style={sellingMetaRow}>
        <span>Margin: <strong>{rates.grossMarginPct.toFixed(1)}%</strong></span>
        <span>Markup: <strong>{markupPct.toFixed(1)}%</strong></span>
        <span>Profit: <strong>${profitPerHour.toFixed(2)}/hr</strong></span>
      </div>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────────── */

const DRAWER_Z = 900;

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  zIndex: DRAWER_Z,
  backdropFilter: 'blur(2px)',
};

const drawerPanel: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 560,
  background: '#1a1d24',
  borderLeft: `1px solid ${FC.borderStrong}`,
  zIndex: DRAWER_Z + 1,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
  overflow: 'hidden',
};

const drawerHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  borderBottom: `1px solid ${FC.border}`,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: FC.textPrimary,
};

const closeBtn: CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  color: FC.textMuted,
  background: 'transparent',
  border: `1px solid ${FC.border}`,
  borderRadius: 6,
  cursor: 'pointer',
  flexShrink: 0,
};

const guardrailBanner: CSSProperties = {
  padding: '10px 24px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.accentAmber,
  background: FC.accentAmberDim,
  borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
  flexShrink: 0,
};

const drawerBody: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 24,
};

const fieldGroup: CSSProperties = { marginBottom: 16 };

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.textSecondary,
  marginBottom: 6,
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '0.8125rem',
  backgroundColor: '#2a2d35',
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 6,
  color: '#f0f0f0',
  outline: 'none',
  colorScheme: 'dark',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '0.8125rem',
  background: 'rgba(255, 255, 255, 0.06)',
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 6,
  color: FC.textPrimary,
  outline: 'none',
};

const twoColRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 16,
};

const segmentRow: CSSProperties = {
  display: 'flex',
  gap: 0,
  borderRadius: 6,
  overflow: 'hidden',
  border: `1px solid ${FC.borderStrong}`,
};

const segmentBtn: CSSProperties = {
  flex: 1,
  padding: '8px 4px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  background: 'transparent',
  border: 'none',
  borderRight: `1px solid ${FC.borderStrong}`,
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
};

const segmentBtnActive: CSSProperties = {
  ...segmentBtn,
  color: FC.textPrimary,
  background: 'rgba(139, 92, 246, 0.15)',
};

const calcBtn: CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  background: FC.accentBlue,
  color: '#fff',
  cursor: 'pointer',
  marginTop: 4,
};

const calcBtnDisabled: CSSProperties = {
  ...calcBtn,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const errorBanner: CSSProperties = {
  marginTop: 12,
  padding: '10px 14px',
  fontSize: '0.8125rem',
  color: FC.accentRed,
  background: FC.accentRedDim,
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 8,
};

const contextRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const contextBadge: CSSProperties = {
  padding: '3px 10px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textSecondary,
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 4,
};

const sectionLabel: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  color: FC.textPrimary,
  marginBottom: 10,
  marginTop: 4,
};

const costCardsRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 10,
  marginBottom: 12,
};

const costCard: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: '14px 12px',
  textAlign: 'center',
};

const costCardLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
};

const costCardValue: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: FC.textPrimary,
  fontVariantNumeric: 'tabular-nums',
};

const costCardMult: CSSProperties = {
  fontSize: '0.6875rem',
  color: FC.textFaint,
  marginTop: 2,
};

const burdenMetaRow: CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: '0.75rem',
  color: FC.textMuted,
  marginBottom: 4,
};

const burdenMetaItem: CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  alignItems: 'center',
};

const breakdownTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  overflow: 'hidden',
};

const thCell: CSSProperties = {
  padding: '8px 14px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  textAlign: 'left',
  borderBottom: `1px solid ${FC.border}`,
};

const tdCell: CSSProperties = {
  padding: '8px 14px',
  fontSize: '0.8125rem',
  color: FC.textSecondary,
  borderBottom: `1px solid rgba(255, 255, 255, 0.04)`,
};

const sellingDivider: CSSProperties = {
  height: 1,
  background: FC.borderStrong,
  margin: '20px 0 16px',
};

const sellingTabBar: CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: `1px solid ${FC.border}`,
  marginBottom: 16,
};

const sellingTabBtn: CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.textMuted,
  background: 'transparent',
  border: 'none',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  cursor: 'pointer',
  transition: 'color 0.15s',
};

const sellingTabActive: CSSProperties = {
  ...sellingTabBtn,
  color: FC.textPrimary,
  borderBottomColor: FC.accentPurple,
};

const computeSellingBtn: CSSProperties = {
  width: '100%',
  padding: '9px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: `1px solid rgba(139, 92, 246, 0.3)`,
  borderRadius: 6,
  background: 'rgba(139, 92, 246, 0.12)',
  color: '#a78bfa',
  cursor: 'pointer',
  marginBottom: 16,
};

const computeSellingBtnDisabled: CSSProperties = {
  ...computeSellingBtn,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const sellingResultCard: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: 16,
};

const sellingResultHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14,
};

const sellingResultLabel: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  color: FC.textPrimary,
};

const sellingMetaRow: CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: '0.75rem',
  color: FC.textMuted,
};

const loadingText: CSSProperties = {
  color: FC.textMuted,
  fontSize: '0.8125rem',
  textAlign: 'center',
  padding: '24px 0',
};

const commercialDivider: CSSProperties = {
  marginTop: 20,
  paddingTop: 16,
  borderTop: `1px solid ${FC.borderStrong}`,
};

const commercialBtn: CSSProperties = {
  width: '100%',
  padding: '9px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: `1px solid rgba(139, 92, 246, 0.3)`,
  borderRadius: 6,
  background: 'rgba(139, 92, 246, 0.12)',
  color: '#a78bfa',
  cursor: 'pointer',
};

const rsModalBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: DRAWER_Z + 5,
};

const rsModalPanel: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 420,
  maxHeight: '70vh',
  overflowY: 'auto',
  background: '#1a1d24',
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 12,
  padding: 24,
  zIndex: DRAWER_Z + 6,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
};

const rsSheetBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 14px',
  fontSize: '0.8125rem',
  color: FC.textPrimary,
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 6,
  cursor: 'pointer',
  textAlign: 'left',
  marginBottom: 6,
};

const rsCreateBtn: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: FC.accentGreen,
  background: FC.accentGreenDim,
  border: `1px solid rgba(34, 197, 94, 0.3)`,
  borderRadius: 6,
  cursor: 'pointer',
};
