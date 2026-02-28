"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type CustomerData = {
  id: string;
  name: string;
  defaultSalespersonId: string | null;
  defaultSalesperson: { id: string; firstName: string; lastName: string; email: string } | null;
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

export default function CustomerOwnershipPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [options, setOptions] = useState<DropdownOption[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [customer, salespeople] = await Promise.all([
          apiFetch<CustomerData>(`/customers/${customerId}`),
          apiFetch<SalespersonRecord[]>("/salespeople"),
        ]);
        if (!alive) return;

        setCustomerName(customer.name ?? "");
        setSelectedValue(customer.defaultSalespersonId ?? "");

        const eligible = (Array.isArray(salespeople) ? salespeople : []).filter(
          (sp) => sp.isActive
        );
        setOptions(
          eligible.map((sp) => ({ value: sp.id, label: buildLabel(sp) }))
        );
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [customerId]);

  const selectedLabel =
    options.find((o) => o.value === selectedValue)?.label || "\u2014";

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/customers/${customerId}/default-salesperson`, {
        method: "PATCH",
        body: JSON.stringify({
          salespersonId: selectedValue || null,
        }),
      });
      router.push(`/customers/${customerId}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save salesperson assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="ownership-container">
        <div className="loading-banner">Loading ownership&hellip;</div>
        <style jsx>{`
          .ownership-container {
            padding: 24px 40px 60px;
            max-width: 800px;
            margin: 0 auto;
          }
          .loading-banner {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 8px;
            padding: 10px 16px;
            font-size: 12px;
            font-weight: 500;
            color: #f59e0b;
            text-align: center;
          }
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
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Main Content */}
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
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white bg-slate-900 text-white">
                  {opt.label}
                </option>
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

      {/* Commission Info */}
      <section className="info-section">
        <div className="section-header">
          <h2>Commission Assignment</h2>
          <span className="section-badge">Read-only</span>
        </div>

        <div className="info-card">
          <p>
            Commission splits are configured at the <strong>Order level</strong>
            . The salesperson assigned here becomes the default for new orders,
            but commission splits can be customized per order.
          </p>
          <p>
            To view or edit commission splits for a specific order, navigate to
            the order and open the <strong>Sales</strong> tab.
          </p>
        </div>
      </section>

      {/* Save Footer */}
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

      <style jsx>{`
        .ownership-container {
          padding: 24px 40px 60px;
          max-width: 800px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 0.15s ease;
          display: inline-block;
          margin-bottom: 12px;
        }

        .back-link:hover {
          color: #3b82f6;
        }

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

        /* Error Banner */
        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          color: #ef4444;
          margin-bottom: 20px;
        }

        /* Ownership Section */
        .ownership-section,
        .info-section {
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

        /* Salesperson Card */
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

        /* Help Note */
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

        /* Info Card */
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

        .info-card p:last-child {
          margin-bottom: 0;
        }

        .info-card strong {
          color: rgba(255, 255, 255, 0.85);
        }

        /* Save Footer */
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

        .save-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
