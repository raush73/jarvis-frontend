'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

interface ConfigValues {
  controlWindowWorkingDays: number;
  touchWindowWorkingDays: number;
  graceGapWorkingDays: number;
  reentryWorkingDays: number;
  atRiskAttemptThreshold: number;
  autoReleaseAttemptThreshold: number;
  systemEnabled: boolean;
  followupEnforced: boolean;
  callPressureLevel: string;
  absenceProtectionEnabled: boolean;
  defaultOwnershipDays: number;
  inactivityThresholdDays: number;
  expirationThresholdDays: number;
  ownershipExpirationBehavior: string;
  minCallDurationSeconds: number;
  atRiskThresholdDays: number;
  staleThresholdDays: number;
  forceReleaseThresholdDays: number;
  rescueThresholdMinutes: number;
  [key: string]: any;
}

const ENFORCEMENT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'controlWindowWorkingDays', label: 'Control Window (working days)' },
  { key: 'touchWindowWorkingDays', label: 'Touch Window (working days)' },
  { key: 'graceGapWorkingDays', label: 'Grace Gap (working days)' },
  { key: 'reentryWorkingDays', label: 'Re-entry Period (working days)' },
  { key: 'atRiskAttemptThreshold', label: 'At-Risk Attempt Threshold' },
  { key: 'autoReleaseAttemptThreshold', label: 'Auto-Release Attempt Threshold' },
];

const OWNERSHIP_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'defaultOwnershipDays', label: 'Default Ownership (days)' },
  { key: 'inactivityThresholdDays', label: 'Inactivity Threshold (days)' },
  { key: 'expirationThresholdDays', label: 'Expiration Threshold (days)' },
];

const ACTIVITY_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'minCallDurationSeconds', label: 'Min Call Duration (sec)' },
  { key: 'atRiskThresholdDays', label: 'At Risk Threshold (days)' },
  { key: 'staleThresholdDays', label: 'Stale Threshold (days)' },
  { key: 'forceReleaseThresholdDays', label: 'Force Release (days)' },
  { key: 'rescueThresholdMinutes', label: 'Rescue Threshold (min)' },
];

export default function EnforcementConfigEditor({ isAdmin }: { isAdmin: boolean }) {
  const [config, setConfig] = useState<ConfigValues | null>(null);
  const [draft, setDraft] = useState<Partial<ConfigValues>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ConfigValues>('/friday/control-panel/config');
      setConfig(data);
      setDraft({});
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateDraft = (key: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setDraft((prev) => ({ ...prev, [key]: num }));
    }
  };

  const hasDraftChanges = Object.keys(draft).length > 0;

  const handleSave = async () => {
    if (!hasDraftChanges) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch('/friday/control-panel/config', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setSuccessMsg('Config saved. Changes apply to newly granted controls only.');
      setShowConfirm(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading config...</p>;
  if (!config) return <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>Config not available</p>;

  const currentValue = (key: string) => {
    if (key in draft) return String(draft[key]);
    return String(config[key] ?? '');
  };

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Enforcement Config {!isAdmin && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>(read-only)</span>}
      </h2>

      {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{error}</p>}
      {successMsg && <p style={{ color: '#16a34a', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{successMsg}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <ConfigCard title="Control Enforcement (Phase 9)" fields={ENFORCEMENT_FIELDS} config={config} currentValue={currentValue} onChange={isAdmin ? updateDraft : undefined} />
        <ConfigCard title="Ownership Timers" fields={OWNERSHIP_FIELDS} config={config} currentValue={currentValue} onChange={isAdmin ? updateDraft : undefined} />
        <ConfigCard title="Activity Thresholds" fields={ACTIVITY_FIELDS} config={config} currentValue={currentValue} onChange={isAdmin ? updateDraft : undefined} />
        <ConfigCard title="System Switches" fields={[]} config={config} currentValue={currentValue} onChange={undefined}>
          <SwitchField label="System Enabled" value={config.systemEnabled} />
          <SwitchField label="Follow-up Enforced" value={config.followupEnforced} />
          <SwitchField label="Absence Protection" value={config.absenceProtectionEnabled} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <span style={{ color: '#6b7280' }}>Call Pressure</span>
            <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{config.callPressureLevel}</span>
          </div>
        </ConfigCard>
      </div>

      {isAdmin && hasDraftChanges && (
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => setShowConfirm(true)} style={primaryBtnStyle}>
            Save Changes
          </button>
          <button onClick={() => setDraft({})} style={{ ...actionBtnStyle, marginLeft: '0.5rem' }}>
            Discard
          </button>
        </div>
      )}

      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 450, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>Confirm Config Update</h3>
            <p style={{ fontSize: '0.8125rem', color: '#374151', marginBottom: '1rem' }}>
              Config changes apply <strong>prospectively only</strong>. Existing active controls keep their current deadlines. Only newly granted controls will use the updated values.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
              <button onClick={() => setShowConfirm(false)} style={actionBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ConfigCard({ title, fields, config, currentValue, onChange, children }: {
  title: string;
  fields: Array<{ key: string; label: string }>;
  config: ConfigValues;
  currentValue: (key: string) => string;
  onChange?: (key: string, value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {fields.map((f) => (
          <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
            <span style={{ color: '#6b7280' }}>{f.label}</span>
            {onChange ? (
              <input
                type="number"
                value={currentValue(f.key)}
                onChange={(e) => onChange(f.key, e.target.value)}
                style={{ width: 70, padding: '0.25rem 0.375rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right', fontFamily: 'monospace' }}
              />
            ) : (
              <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{currentValue(f.key)}</span>
            )}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}

function SwitchField({ label, value }: { label: string; value: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 500, fontFamily: 'monospace', color: value ? '#16a34a' : '#dc2626' }}>
        {value ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', border: 'none', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const actionBtnStyle: React.CSSProperties = { padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' };
