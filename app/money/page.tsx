'use client';

import { useState } from 'react';
import {
  computePreviewRows,
  computeBillingDtMultiplier,
  type PreviewRowInput,
  type PreviewResult,
} from './lib/moneyMath';

/**
 * Money Preview Page
 * PREVIEW ONLY — NOT INVOICE — NOT SNAPSHOT
 *
 * Purpose: Verify Shift Differential money math end-to-end.
 * UI-only / preview-only. No persistence. No navigation changes.
 */
export default function MoneyPage() {
  // Mocked inputs — visible and editable for verification
  const [inputs, setInputs] = useState<PreviewRowInput>({
    basePayRate: 25.0,
    baseBillRate: 45.0,
    otBillMultiplier: 1.5,
    sdPayDeltaRate: 3.0,
    sdBillDeltaRate: 5.0,
    regHours: 40,
    otHours: 8,
    dtHours: 4,
    regSdHours: 16,
    otSdHours: 4,
    dtSdHours: 2,
  });

  // Compute preview rows
  const result: PreviewResult = computePreviewRows(inputs);

  // Computed DT billing multiplier for display
  const dtBillMultiplier = computeBillingDtMultiplier(inputs.otBillMultiplier);

  const handleInputChange = (field: keyof PreviewRowInput, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: numValue }));
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Warning Banner */}
      <div
        style={{
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'center',
        }}
      >
        <strong style={{ color: '#92400e', fontSize: '18px' }}>
          PREVIEW ONLY — NOT INVOICE — NOT SNAPSHOT
        </strong>
      </div>

      <h1 style={{ marginBottom: '24px' }}>Money Math Preview</h1>

      {/* Input Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
        }}
      >
        <h2 style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>Inputs</h2>

        {/* Rates */}
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            Base Pay Rate ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.basePayRate}
            onChange={(e) => handleInputChange('basePayRate', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            Base Bill Rate ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.baseBillRate}
            onChange={(e) => handleInputChange('baseBillRate', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            OT Bill Multiplier
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.otBillMultiplier}
            onChange={(e) => handleInputChange('otBillMultiplier', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            DT Bill Mult = OT × 4/3 = {dtBillMultiplier}
          </div>
        </div>

        {/* SD Deltas */}
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            SD Pay Delta ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.sdPayDeltaRate}
            onChange={(e) => handleInputChange('sdPayDeltaRate', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            SD Bill Delta ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={inputs.sdBillDeltaRate}
            onChange={(e) => handleInputChange('sdBillDeltaRate', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>

        {/* Hours - Non-SD */}
        <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
          <strong>Non-SD Hours</strong>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            REG Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={inputs.regHours}
            onChange={(e) => handleInputChange('regHours', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            OT Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={inputs.otHours}
            onChange={(e) => handleInputChange('otHours', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            DT Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={inputs.dtHours}
            onChange={(e) => handleInputChange('dtHours', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>

        {/* Hours - SD */}
        <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
          <strong>SD Hours (Shift Differential)</strong>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            REG (SD) Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={inputs.regSdHours}
            onChange={(e) => handleInputChange('regSdHours', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            OT (SD) Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={inputs.otSdHours}
            onChange={(e) => handleInputChange('otSdHours', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            DT (SD) Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={inputs.dtSdHours}
            onChange={(e) => handleInputChange('dtSdHours', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
      </div>

      {/* Preview Table */}
      <h2 style={{ marginBottom: '16px' }}>Preview Results</h2>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #9ca3af' }}>
                Bucket
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Hours
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Pay Mult
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Eff Pay Rate
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Pay $
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Bill Mult
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Eff Bill Rate
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #9ca3af' }}>
                Bill $
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, idx) => (
              <tr
                key={row.bucket}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderBottom: row.bucket === 'DT' ? '2px solid #9ca3af' : '1px solid #e5e7eb',
                }}
              >
                <td style={{ padding: '12px', fontWeight: row.bucket.includes('SD') ? 'bold' : 'normal' }}>
                  {row.bucket}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{row.hours}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{row.payMultiplier.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>${row.effectivePayRate.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>${row.payAmount.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{row.billMultiplier.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>${row.effectiveBillRate.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>${row.billAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#d1d5db', fontWeight: 'bold' }}>
              <td style={{ padding: '12px' }}>TOTALS</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>{result.totalHours}</td>
              <td style={{ padding: '12px' }}></td>
              <td style={{ padding: '12px' }}></td>
              <td style={{ padding: '12px', textAlign: 'right' }}>${result.totalPay.toFixed(2)}</td>
              <td style={{ padding: '12px' }}></td>
              <td style={{ padding: '12px' }}></td>
              <td style={{ padding: '12px', textAlign: 'right' }}>${result.totalBill.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Rules Reference */}
      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          fontSize: '13px',
        }}
      >
        <strong>Locked Rules Reference:</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Payroll Multipliers: REG=1.0, OT=1.5, DT=2.0</li>
          <li>Billing Multipliers: REG=1.0, OT=otBillMultiplier, DT=OT×4/3 (rounded)</li>
          <li>SD is additive delta ONLY — does NOT modify base rates</li>
          <li>SD applies ONLY to SD-classified hours</li>
          <li>SD uses SAME multipliers as base hours</li>
        </ul>
      </div>
    </div>
  );
}
