"use client";

import { useCallback, useEffect, useState } from "react";
import { CareersShell } from "@/components/careers/CareersShell";
import { useSession } from "@/lib/auth/useSession";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  CAREERS_CONFIG_FIELDS,
  CareersApplicationConfig,
  CareersApplicationConfigInput,
  getCareersConfig,
  updateCareersConfig,
} from "@/lib/careers/careersConfigApi";

/**
 * Jarvis Careers - Application Settings (V2.1.5A, admin-only).
 *
 * Admin surface for the backend-authoritative required/optional application
 * rules. These toggles are the foundation extended by later V2.1.5 sub-phases;
 * they are enforced server-side at application submit in a later phase. The page
 * gates client-side on the admin role; the backend independently enforces it.
 */
export default function CareersSettingsPage() {
  const session = useSession();
  const [config, setConfig] = useState<CareersApplicationConfig | null>(null);
  const [draft, setDraft] = useState<CareersApplicationConfigInput>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCareersConfig();
      setConfig(data);
      setDraft(toDraft(data));
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load application settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session.ready) return;
    if (!session.isAdmin) {
      setLoading(false);
      return;
    }
    load();
  }, [session.ready, session.isAdmin, load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const saved = await updateCareersConfig(draft);
      setConfig(saved);
      setDraft(toDraft(saved));
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save application settings."));
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    config != null &&
    CAREERS_CONFIG_FIELDS.some((f) => draft[f.key] !== config[f.key]);

  if (session.ready && !session.isAdmin) {
    return (
      <CareersShell
        title="Application Settings"
        subtitle="Careers"
        backHref="/careers"
        backLabel="Careers"
      >
        <div className="state-block state-error">
          You do not have access to Careers application settings. This area is
          restricted to administrators.
        </div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  return (
    <CareersShell
      title="Application Settings"
      subtitle="Configure which application fields are required"
      backHref="/careers"
      backLabel="Careers"
      actions={
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || loading || !dirty}
        >
          {saving ? "Saving\u2026" : "Save Changes"}
        </button>
      }
    >
      {loading ? (
        <div className="state-block">Loading settings…</div>
      ) : error && !config ? (
        <div className="state-block state-error">{error}</div>
      ) : (
        <>
          {error ? <div className="inline-error">{error}</div> : null}
          {savedAt ? (
            <div className="inline-ok">Settings saved at {savedAt}.</div>
          ) : null}

          <section className="panel">
            <div className="panel-header">
              <h2>Required Application Fields</h2>
              <p className="panel-note">
                Turn a field on to make it required when an applicant submits.
                Rules are enforced by the server, not just the UI.
              </p>
            </div>
            <div className="panel-body">
              {CAREERS_CONFIG_FIELDS.map((f) => (
                <label key={f.key} className="toggle-row">
                  <input
                    type="checkbox"
                    checked={draft[f.key] ?? false}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.key]: e.target.checked }))
                    }
                    disabled={saving}
                  />
                  <span className="toggle-text">
                    <span className="toggle-label">{f.label}</span>
                    <span className="toggle-hint">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </>
      )}

      <style jsx>{`
        .btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: 1px solid transparent;
          border-radius: 7px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .btn-primary:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }
        .panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .panel-header {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .panel-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .panel-note {
          margin: 6px 0 0;
          font-size: 12.5px;
          color: #6b7280;
        }
        .panel-body {
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
        }
        .toggle-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
        }
        .toggle-row:last-child {
          border-bottom: none;
        }
        .toggle-row input {
          margin-top: 2px;
          accent-color: #2563eb;
          width: 16px;
          height: 16px;
        }
        .toggle-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .toggle-label {
          font-size: 13.5px;
          font-weight: 600;
          color: #111827;
        }
        .toggle-hint {
          font-size: 12px;
          color: #9ca3af;
        }
        .inline-error {
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 12.5px;
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 14px;
        }
        .inline-ok {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          font-size: 12.5px;
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 14px;
        }
      `}</style>
      <style jsx>{blockStyles}</style>
    </CareersShell>
  );
}

function toDraft(c: CareersApplicationConfig): CareersApplicationConfigInput {
  return {
    requirePhone: c.requirePhone,
    requireLocation: c.requireLocation,
    requireProfessionalSummary: c.requireProfessionalSummary,
    requireCurrentProfession: c.requireCurrentProfession,
    requireDesiredProfession: c.requireDesiredProfession,
    requireLongTermGoals: c.requireLongTermGoals,
    requireFacebookUrl: c.requireFacebookUrl,
    requireLinkedinUrl: c.requireLinkedinUrl,
    requireResume: c.requireResume,
    collectCompensationHistory: c.collectCompensationHistory,
  };
}

const blockStyles = `
  .state-block {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 40px 20px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }
  .state-error {
    background: #fff1f2;
    border-color: #fecaca;
    color: #991b1b;
  }
`;
