"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getAccessToken } from "@/lib/api";

type CustomerData = {
  id: string;
  name: string;
  lifecycleStatus: string;
  registrySalespersonId: string | null;
  registrySalesperson: { id: string; firstName: string; lastName: string } | null;
};

type SalespersonRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
  userId: string | null;
};

type DropdownOption = {
  value: string;
  label: string;
};

function buildLabel(sp: SalespersonRecord): string {
  const name = `${sp.firstName ?? ""} ${sp.lastName ?? ""}`.trim();
  return name || sp.email || sp.id;
}

function parseTokenRoles(): string[] {
  try {
    const token = getAccessToken();
    if (!token) return [];
    const parts = token.split(".");
    if (parts.length < 2) return [];
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const raw = Array.isArray(payload.roles) ? payload.roles : [];
    return raw.map((r: any) => (typeof r === "string" ? r : r?.name ?? "")).filter(Boolean).map((r: string) => r.toLowerCase());
  } catch {
    return [];
  }
}

function parseTokenUserId(): string | null {
  try {
    const token = getAccessToken();
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

const BROAD_ACCESS_ROLES = ["admin", "recruiting", "accounting"];

function isSalesOnlyFromRoles(roles: string[]): boolean {
  if (roles.some((r) => BROAD_ACCESS_ROLES.includes(r))) return false;
  return roles.includes("sales");
}

export default function CustomerOwnershipPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [salespeople, setSalespeople] = useState<SalespersonRecord[]>([]);

  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const roles = useMemo(() => parseTokenRoles(), []);
  const userId = useMemo(() => parseTokenUserId(), []);
  const salesOnly = useMemo(() => isSalesOnlyFromRoles(roles), [roles]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [cust, sp] = await Promise.all([
          apiFetch<CustomerData>(`/customers/${customerId}`),
          apiFetch<SalespersonRecord[]>("/salespeople"),
        ]);
        if (!alive) return;

        setCustomer(cust);
        setSelectedValue(cust.registrySalespersonId ?? "");
        setSalespeople(Array.isArray(sp) ? sp : []);

        const eligible = (Array.isArray(sp) ? sp : []).filter((s) => s.isActive);
        setOptions(eligible.map((s) => ({ value: s.id, label: buildLabel(s) })));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  const customerName = customer?.name ?? "";
  const lifecycleStatus = customer?.lifecycleStatus ?? "";
  const isProspect = lifecycleStatus === "PROSPECT";
  const selectedLabel = options.find((o) => o.value === selectedValue)?.label || "\u2014";

  const callerOwnsSp = useMemo(() => {
    if (!userId || !customer?.registrySalespersonId) return false;
    const linked = salespeople.find((sp) => sp.userId === userId);
    return linked?.id === customer.registrySalespersonId;
  }, [userId, customer, salespeople]);

  const canRelease = salesOnly ? (isProspect && callerOwnsSp) : isProspect;
  const canReassign = !salesOnly;

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/customers/${customerId}/default-salesperson`, {
        method: "PATCH",
        body: JSON.stringify({ salespersonId: selectedValue || null }),
      });
      router.push(`/customers/${customerId}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save salesperson assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseProspect = async () => {
    if (releasing) return;
    setReleasing(true);
    setError("");
    try {
      await apiFetch(`/customers/${customerId}/release-prospect`, { method: "POST" });
      router.push(`/customers/${customerId}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to release prospect.");
    } finally {
      setReleasing(false);
      setShowReleaseConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="ownership-container">
        <div className="loading-banner">Loading ownership&hellip;</div>
        <style jsx>{`
          .ownership-container { padding: 24px 40px 60px; max-width: 800px; margin: 0 auto; }
          .loading-banner { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px 16px; font-size: 12px; font-weight: 500; color: #f59e0b; text-align: center; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ownership-container">
      {/* Header */}
      <div className="page-header">
        <Link href={`/customers/${customerId}`} className="back-link">
          &larr; Back to Customer
        </Link>
        <div className="header-row">
          <div className="header-info">
            <h1>Ownership</h1>
            <div className="customer-badge-row">
              <span className="customer-name">{customerName}</span>
              <span className="customer-id">{customerId}</span>
              {lifecycleStatus && (
                <span className={`lifecycle-badge ${lifecycleStatus.toLowerCase()}`}>{lifecycleStatus}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Admin: full ownership reassignment */}
      {canReassign && (
        <section className="ownership-section">
          <div className="section-header">
            <h2>Default / Main Salesperson</h2>
          </div>

          <div className="salesperson-card">
            <div className="card-label">Customer Owner</div>
            <div className="salesperson-select-wrap">
              <select
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="salesperson-select"
              >
                <option value="">None</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="current-selection">{selectedLabel}</span>
            </div>
          </div>

          <div className="help-note">
            <span className="help-icon">i</span>
            <span>
              This salesperson is used as the default on new orders for this
              customer unless overridden at the order level.
            </span>
          </div>
        </section>
      )}

      {/* Sales-only: read-only owner display */}
      {salesOnly && (
        <section className="ownership-section">
          <div className="section-header">
            <h2>Current Owner</h2>
            <span className="section-badge">Read-only</span>
          </div>
          <div className="salesperson-card">
            <div className="card-label">Customer Owner</div>
            <div className="owner-display">{selectedLabel}</div>
          </div>
          <div className="help-note">
            <span className="help-icon">i</span>
            <span>Customer ownership changes require admin authorization.</span>
          </div>
        </section>
      )}

      {/* Release Prospect action */}
      {canRelease && (
        <section className="release-section">
          <div className="section-header">
            <h2>Release Prospect</h2>
          </div>
          <div className="release-info">
            <p>
              Releasing this prospect returns it to the pool so other salespeople can work it.
              This action clears your ownership assignment.
            </p>
            {!showReleaseConfirm ? (
              <button className="release-btn" onClick={() => setShowReleaseConfirm(true)}>
                Release Prospect
              </button>
            ) : (
              <div className="release-confirm">
                <p className="release-confirm-text">
                  Are you sure you want to release this prospect? This cannot be undone from here.
                </p>
                <div className="release-confirm-actions">
                  <button className="release-confirm-cancel" onClick={() => setShowReleaseConfirm(false)} disabled={releasing}>
                    Cancel
                  </button>
                  <button className="release-confirm-btn" onClick={handleReleaseProspect} disabled={releasing}>
                    {releasing ? "Releasing\u2026" : "Confirm Release"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Commission Info */}
      <section className="info-section">
        <div className="section-header">
          <h2>Commission Assignment</h2>
          <span className="section-badge">Read-only</span>
        </div>
        <div className="info-card">
          <p>
            Commission splits are configured at the <strong>Order level</strong>.
            The salesperson assigned here becomes the default for new orders,
            but commission splits can be customized per order.
          </p>
          <p>
            To view or edit commission splits for a specific order, navigate to
            the order and open the <strong>Commission</strong> section.
          </p>
        </div>
      </section>

      {/* Save Footer (admin only) */}
      {canReassign && (
        <div className="save-footer">
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      )}

      <style jsx>{`
        .ownership-container {
          padding: 24px 40px 60px;
          max-width: 800px;
          margin: 0 auto;
        }

        .page-header { margin-bottom: 32px; }
        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 0.15s ease;
          display: inline-block;
          margin-bottom: 12px;
        }
        .back-link:hover { color: #3b82f6; }
        .header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .header-info h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 10px;
          letter-spacing: -0.5px;
        }
        .customer-badge-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .customer-name {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.75);
        }
        .customer-id {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          padding: 3px 8px;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 5px;
        }
        .lifecycle-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .lifecycle-badge.lead { color: #3b82f6; background: rgba(59, 130, 246, 0.15); }
        .lifecycle-badge.prospect { color: #f59e0b; background: rgba(245, 158, 11, 0.15); }
        .lifecycle-badge.customer { color: #22c55e; background: rgba(34, 197, 94, 0.15); }

        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          color: #ef4444;
          margin-bottom: 20px;
        }

        .ownership-section, .info-section, .release-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }
        .section-badge {
          font-size: 10px;
          padding: 3px 8px;
          background: rgba(148, 163, 184, 0.12);
          color: rgba(148, 163, 184, 0.8);
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .salesperson-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .card-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        .salesperson-select-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .salesperson-select {
          width: 100%;
          max-width: 320px;
          padding: 12px 14px;
          font-size: 15px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
        }
        .salesperson-select:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }
        .current-selection {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }
        .owner-display {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
        }

        .help-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          background: rgba(59, 130, 246, 0.06);
          border: 1px dashed rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.65);
        }
        .help-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .info-card {
          padding: 16px 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }
        .info-card p {
          margin: 0 0 12px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }
        .info-card p:last-child { margin-bottom: 0; }
        .info-card strong { color: rgba(255, 255, 255, 0.85); }

        /* Release Prospect */
        .release-section {
          border-color: rgba(245, 158, 11, 0.2);
        }
        .release-info p {
          margin: 0 0 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }
        .release-btn {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .release-btn:hover {
          background: rgba(245, 158, 11, 0.2);
        }
        .release-confirm {
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 16px;
        }
        .release-confirm-text {
          margin: 0 0 14px !important;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8) !important;
        }
        .release-confirm-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .release-confirm-cancel {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
        }
        .release-confirm-cancel:hover { background: rgba(255, 255, 255, 0.05); }
        .release-confirm-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
        .release-confirm-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          background: #f59e0b;
          color: #000;
          cursor: pointer;
          transition: background 0.15s;
        }
        .release-confirm-btn:hover:not(:disabled) { background: #d97706; }
        .release-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .save-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 24px;
        }
        .save-btn {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .save-btn:hover:not(:disabled) { background: #2563eb; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
