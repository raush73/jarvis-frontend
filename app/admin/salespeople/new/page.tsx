"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

// Role options matching Admin Users pattern
type SalespersonRole = "Salesperson" | "Recruiter" | "Dispatcher" | "Admin";
const ROLE_OPTIONS: SalespersonRole[] = ["Salesperson", "Recruiter", "Dispatcher", "Admin"];

// Commission plan options
type CommissionPlan = "Standard Tier" | "Custom";
const COMMISSION_PLAN_OPTIONS: { value: CommissionPlan; label: string; disabled?: boolean }[] = [
  { value: "Standard Tier", label: "Standard Tier" },
  { value: "Custom", label: "Custom", disabled: true },
];

export default function CreateSalespersonPage() {
  const router = useRouter();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SalespersonRole>("Salesperson");
  const [commissionPlan, setCommissionPlan] = useState<CommissionPlan>("Standard Tier");
  const [defaultOnNewCustomers, setDefaultOnNewCustomers] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = firstName.trim() !== "" && lastName.trim() !== "";

  const handleCreate = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/salespeople", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email?.trim() || undefined,
          phone: phone?.trim() || undefined,
        }),
      });
      router.push("/admin/salespeople");
    } catch {
      setError("Failed to create salesperson");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/salespeople");
  };

  return (
    <div className="create-salesperson-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to Sales roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <Link href="/admin/salespeople" className="back-link">
          ← Back to Salespeople
        </Link>
        <h1>Create Salesperson</h1>
        <p className="subtitle">
          Add a new salesperson for customer ownership and commission attribution.
        </p>
      </div>

      {/* Form Section */}
      <div className="form-section">
        <div className="form-grid">
          {/* First Name */}
          <div className="form-row">
            <label className="form-label">
              First Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g., John"
            />
          </div>

          {/* Last Name */}
          <div className="form-row">
            <label className="form-label">
              Last Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g., Smith"
            />
          </div>

          {/* Email */}
          <div className="form-row">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., john.smith@mw4h.com"
            />
          </div>

          {/* Phone */}
          <div className="form-row">
            <label className="form-label">Phone</label>
            <input
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., (555) 123-4567"
            />
          </div>

          {/* Role */}
          <div className="form-row">
            <label className="form-label">
              Role <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as SalespersonRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Default Commission Plan */}
          <div className="form-row">
            <label className="form-label">Default Commission Plan</label>
            <div className="select-with-badge">
              <select
                className="form-select"
                value={commissionPlan}
                onChange={(e) => setCommissionPlan(e.target.value as CommissionPlan)}
              >
                {COMMISSION_PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {commissionPlan === "Custom" && (
                <span className="future-badge">future wiring</span>
              )}
            </div>
          </div>

          {/* Default on New Customers Toggle */}
          <div className="form-row">
            <label className="form-label">Default on New Customers</label>
            <div className="toggle-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={defaultOnNewCustomers}
                  onChange={() => setDefaultOnNewCustomers(!defaultOnNewCustomers)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label-text">
                {defaultOnNewCustomers ? "Yes" : "No"}
              </span>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="form-row">
            <label className="form-label">Status</label>
            <div className="toggle-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => setActive(!active)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label-text">
                {active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="form-row full-width">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this salesperson..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: "#ef4444", fontSize: "13px", margin: "0 0 12px" }}>{error}</p>
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <div />
        <div className="action-buttons">
          <button type="button" className="cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="create-btn"
            onClick={handleCreate}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Creating\u2026" : "Create Salesperson"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .create-salesperson-container {
          padding: 24px 40px 60px;
          max-width: 800px;
          margin: 0 auto;
        }

        /* Shell Banner */
        .shell-banner {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #f59e0b;
          text-align: center;
          margin-bottom: 24px;
        }

        /* Header */
        .page-header {
          margin-bottom: 28px;
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

        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
        }

        /* Form Section */
        .form-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-row.full-width {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .required {
          color: #ef4444;
        }

        .form-input,
        .form-textarea,
        .form-select {
          padding: 10px 12px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          transition: border-color 0.15s ease;
        }

        .form-input:focus,
        .form-textarea:focus,
        .form-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-select {
          width: 100%;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' fill-opacity='0.5' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }

        .form-select option {
          background: #1a1d24;
          color: #fff;
        }

        .form-select option:disabled {
          color: rgba(255, 255, 255, 0.35);
        }

        .select-with-badge {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .select-with-badge .form-select {
          flex: 1;
        }

        .future-badge {
          position: absolute;
          right: 40px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 2px 6px;
          border-radius: 4px;
          pointer-events: none;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        /* Toggle */
        .toggle-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-top: 4px;
        }

        .toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          transition: 0.2s;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background: #fff;
          border-radius: 50%;
          transition: 0.2s;
        }

        .toggle input:checked + .toggle-slider {
          background: #22c55e;
        }

        .toggle input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .toggle-label-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        /* Form Actions */
        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .helper-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
          margin: 0;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .cancel-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cancel-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .create-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .create-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
