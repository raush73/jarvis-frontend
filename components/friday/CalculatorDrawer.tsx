'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { FC } from './styles';
import { fridayFetch } from './fridayFetch';

interface CalculatorDrawerProps {
  onClose: () => void;
}

type CostCalcType = 'standard' | 'ocip' | 'prevailing' | 'prevailing-ocip';

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

const BURDEN_CATEGORY_LABELS: Record<string, string> = {
  WC: 'Workers\' Comp',
  GL: 'General Liability',
  FICA: 'FICA',
  SUTA: 'SUTA',
  FUTA: 'FUTA',
  PEO: 'PEO / Admin Fee',
  OVERHEAD: 'Overhead',
  ADMIN: 'Admin',
  INT_W: 'Internal (W)',
  INT_PD: 'Internal (PD)',
};

export default function CalculatorDrawer({ onClose }: CalculatorDrawerProps) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fridayFetch<Trade[]>('/trades?activeOnly=true');
      if (cancelled) return;
      if (res.ok) {
        setTrades(res.data);
      }
      setTradesLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const isPw = costType === 'prevailing' || costType === 'prevailing-ocip';

  const canCalculate = useCallback(() => {
    if (!stateCode || !tradeId) return false;
    if (isPw) {
      const bw = parseFloat(baseWage);
      return bw > 0;
    }
    const pr = parseFloat(payRate);
    return pr > 0;
  }, [stateCode, tradeId, isPw, baseWage, payRate]);

  const handleCalculate = async () => {
    if (!canCalculate()) return;
    setComputing(true);
    setError('');

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

  const selectedTrade = trades.find(t => t.id === tradeId);

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
          {/* Cost Calculation Type */}
          <div style={fieldGroup}>
            <div style={labelStyle}>Cost Calculation Type</div>
            <div style={segmentRow}>
              {COST_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  style={costType === opt.value ? segmentBtnActive : segmentBtn}
                  onClick={() => { setCostType(opt.value); setResult(null); setError(''); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* State + Trade row */}
          <div style={twoColRow}>
            <div>
              <div style={labelStyle}>State</div>
              <select
                style={selectStyle}
                value={stateCode}
                onChange={e => { setStateCode(e.target.value); setResult(null); }}
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
                onChange={e => { setTradeId(e.target.value); setResult(null); }}
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
                onChange={e => { setPayRate(e.target.value); setResult(null); }}
              />
            </div>
          )}

          {/* Base Wage + Fringe (Prevailing Wage modes) */}
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
                  onChange={e => { setBaseWage(e.target.value); setResult(null); }}
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
                  onChange={e => { setFringeAmount(e.target.value); setResult(null); }}
                />
              </div>
            </div>
          )}

          {/* Calculate button */}
          <button
            style={canCalculate() && !computing ? calcBtn : calcBtnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate() || computing}
          >
            {computing ? 'Calculating...' : 'Calculate'}
          </button>

          {/* Error */}
          {error && (
            <div style={errorBanner}>{error}</div>
          )}

          {/* Results */}
          {result && (
            <div style={{ marginTop: 24 }}>
              {/* Context badge */}
              <div style={contextRow}>
                <span style={contextBadge}>{result.stateCode}</span>
                <span style={contextBadge}>{result.tradeName}</span>
                <span style={contextBadge}>
                  {COST_TYPE_OPTIONS.find(o => o.value === costType)?.label}
                </span>
              </div>

              {/* True Labor Cost Cards */}
              <div style={sectionLabel}>True Labor Cost</div>
              <div style={costCardsRow}>
                <CostCard label="REG" value={result.regCost} multiplier={result.regMultiplier} />
                <CostCard label="OT" value={result.otCost} multiplier={result.otMultiplier} />
                <CostCard label="DT" value={result.dtCost} multiplier={result.dtMultiplier} />
              </div>

              {/* Burden Summary */}
              <div style={sectionLabel}>Burden Summary</div>
              <div style={summaryCard}>
                <SummaryRow label="Total Burden" value={`${result.totalBurdenPercent}%`} />
                <SummaryRow label="Base Burden" value={`${result.fullBaseBurdenPercent}%`} />
                <SummaryRow label="Premium Burden (OT/DT)" value={`${result.premiumBurdenPercent}%`} />
                <SummaryRow label="WC Rate" value={`${result.wcPercent}%`} />
                <SummaryRow label="WC Class Code" value={result.wcClassCode} />
                <SummaryRow
                  label="WC Source"
                  value={result.wcSource === 'CLASS_CODE_RATE' ? 'Class Code Rate Set' : 'Payroll Burden Rate'}
                />
                <SummaryRow label="Effective Pay Rate" value={`$${result.payRate.toFixed(2)}`} />
              </div>

              {/* Burden Breakdown */}
              <div style={sectionLabel}>Burden Breakdown</div>
              <table style={breakdownTable}>
                <thead>
                  <tr>
                    <th style={thCell}>Category</th>
                    <th style={{ ...thCell, textAlign: 'right' }}>Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.burdenBreakdown).map(([cat, pct]) => (
                    <tr key={cat}>
                      <td style={tdCell}>{BURDEN_CATEGORY_LABELS[cat] ?? cat}</td>
                      <td style={{ ...tdCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {(pct as number).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Inline sub-components ─────────────────────────────────────────── */

function CostCard({ label, value, multiplier }: { label: string; value: number; multiplier: number }) {
  return (
    <div style={costCard}>
      <div style={costCardLabel}>{label}</div>
      <div style={costCardValue}>${value.toFixed(2)}</div>
      <div style={costCardMult}>{multiplier.toFixed(2)}x</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRow}>
      <span style={summaryRowLabel}>{label}</span>
      <span style={summaryRowValue}>{value}</span>
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

const fieldGroup: CSSProperties = {
  marginBottom: 16,
};

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
  background: 'rgba(255, 255, 255, 0.06)',
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 6,
  color: FC.textPrimary,
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
  marginBottom: 20,
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

const summaryCard: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: '4px 0',
  marginBottom: 20,
};

const summaryRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 14px',
  borderBottom: `1px solid rgba(255, 255, 255, 0.04)`,
};

const summaryRowLabel: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.textMuted,
};

const summaryRowValue: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: FC.textPrimary,
  fontVariantNumeric: 'tabular-nums',
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
