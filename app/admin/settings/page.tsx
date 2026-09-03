"use client";

/**
 * System Settings - the authenticated administrative surface for runtime-editable
 * system configuration.
 *
 * Gate 10C-E1A. This is the governed human operational surface for the
 * PRE_DISPATCH Payroll Payment confirmation freshness window: an administrator
 * reaches it by signing in and navigating Admin -> System Settings, and the read
 * and the write both travel the ordinary authenticated frontend request path.
 *
 * The page holds one grouping and one setting on purpose. It is the first narrow
 * operational settings surface, not the future settings platform, so nothing
 * speculative is drawn here.
 *
 * The accepted range is not written into this file. It arrives with the value
 * from the server, which is also what refuses an out-of-range write, so the
 * screen cannot come to disagree with the authority about what is valid.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  type AdministeredDaysSetting,
  getWorkforceOnboardingSettings,
  savePayrollPaymentPreDispatchFreshnessDays,
} from "@/lib/admin/systemSettingsApi";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const FRESHNESS_FIELD_ID = "payrollPaymentPreDispatchFreshnessDays";

/**
 * Immediate feedback for the administrator. The backend refuses independently:
 * this exists so a mistake is named before a request is spent on it, never as
 * the thing that makes the value safe.
 */
function validateDays(
  raw: string,
  bounds: { min: number; max: number },
): string | null {
  const trimmed = raw.trim();

  if (trimmed === "") return "Enter a number of days.";
  if (!/^\d+$/.test(trimmed)) {
    return "Enter a whole number of days, with no decimal point.";
  }

  const days = Number(trimmed);
  if (days < bounds.min || days > bounds.max) {
    return `Days must be between ${bounds.min} and ${bounds.max}.`;
  }

  return null;
}

/** What to show the administrator when a request fails, never a bare status. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminSystemSettingsPage() {
  const [freshness, setFreshness] = useState<AdministeredDaysSetting | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const settings = await getWorkforceOnboardingSettings();
    const setting = settings.payrollPaymentPreDispatchFreshnessDays;
    setFreshness(setting);
    setDraft(String(setting.value));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!alive) return;
        setLoadError(messageOf(error, "Failed to load System Settings."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const handleSave = async () => {
    if (!freshness) return;

    setSaveError(null);

    const problem = validateDays(draft, freshness);
    if (problem) {
      // Nothing is sent, so the authoritative value is untouched and what the
      // page reports as in effect remains the persisted one.
      setSaveError(problem);
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saving");
    try {
      await savePayrollPaymentPreDispatchFreshnessDays(Number(draft.trim()));
      // Re-read rather than assume: what the page reports as in effect is what
      // the server now holds.
      await load();
      setSaveStatus("saved");
    } catch (error) {
      setSaveError(messageOf(error, "Failed to save System Settings."));
      setSaveStatus("error");
    }
  };

  const handleChange = (value: string) => {
    setDraft(value);
    if (saveStatus !== "idle") setSaveStatus("idle");
    setSaveError(null);
  };

  const unsaved = freshness !== null && draft.trim() !== String(freshness.value);

  return (
    <div className="settings-admin-container">
      <div className="page-header">
        <Link href="/admin" className="back-link">
          ← Back to Admin
        </Link>
        <h1>System Settings</h1>
        <p className="subtitle">
          Runtime configuration for Jarvis Prime. Changes take effect
          immediately.
        </p>
      </div>

      {loading ? <div className="loading">Loading system settings...</div> : null}

      {!loading && (loadError || !freshness) ? (
        <div className="error-banner" role="alert">
          {loadError ?? "Failed to load System Settings."}
        </div>
      ) : null}

      {!loading && !loadError && freshness ? (
        <>
          <div className="config-section">
            <div className="section-header">
              <h2>Workforce Onboarding</h2>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <label htmlFor={FRESHNESS_FIELD_ID}>
                  PRE_DISPATCH Payroll Confirmation Freshness
                </label>
                <p className="setting-desc">
                  How long a worker&apos;s current Payroll Payment authorization
                  or confirmation stays fresh. Once it is older than this, the
                  worker is asked to confirm their payment details again before
                  dispatch.
                </p>
                <p className="setting-range">
                  Whole days, {freshness.min}&ndash;{freshness.max}. Default{" "}
                  {freshness.default}.
                </p>
              </div>

              <div className="setting-control">
                <div className="input-wrap">
                  <input
                    id={FRESHNESS_FIELD_ID}
                    name={FRESHNESS_FIELD_ID}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-describedby={`${FRESHNESS_FIELD_ID}Help`}
                    value={draft}
                    onChange={(e) => handleChange(e.target.value)}
                  />
                  <span className="input-suffix">days</span>
                </div>
                <p id={`${FRESHNESS_FIELD_ID}Help`} className="in-effect">
                  In effect now: {freshness.value} days
                </p>
              </div>
            </div>
          </div>

          {saveError ? (
            <div className="error-banner" role="alert">
              {saveError}
            </div>
          ) : null}

          <div className="save-footer">
            {saveStatus === "saved" && !unsaved ? (
              <span className="save-status success" role="status">
                Saved
              </span>
            ) : null}
            <button
              type="button"
              className="save-btn"
              onClick={handleSave}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </>
      ) : null}

      <style jsx>{`
        .settings-admin-container {
          padding: 24px 40px 60px;
          max-width: 900px;
          margin: 0 auto;
        }
        .loading {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }
        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          display: inline-block;
          margin-bottom: 12px;
        }
        .back-link:hover {
          color: #3b82f6;
        }
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px;
        }
        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 16px 20px;
          border-radius: 8px;
          font-size: 14px;
          margin-top: 16px;
        }
        .config-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
        }
        .section-header {
          margin-bottom: 20px;
        }
        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }
        .setting-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 32px;
        }
        .setting-copy {
          flex: 1;
        }
        .setting-copy label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 6px;
        }
        .setting-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.5;
          margin: 0 0 8px;
          max-width: 62ch;
        }
        .setting-range {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
        }
        .setting-control {
          flex-shrink: 0;
          text-align: right;
        }
        .input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .input-wrap input {
          width: 90px;
          padding: 8px 10px;
          font-size: 14px;
          font-family: var(--font-geist-mono), monospace;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
          text-align: right;
        }
        .input-wrap input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }
        .input-suffix {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }
        .in-effect {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin: 8px 0 0;
        }
        .save-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 24px;
        }
        .save-status {
          font-size: 13px;
          padding: 6px 12px;
          border-radius: 6px;
        }
        .save-status.success {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .save-btn {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: rgba(59, 130, 246, 0.8);
          border: 1px solid rgba(59, 130, 246, 0.6);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .save-btn:hover:not(:disabled) {
          background: rgba(59, 130, 246, 1);
        }
        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
