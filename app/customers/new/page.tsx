"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Mock salesperson options (static)
const SALESPERSON_OPTIONS = [
  { value: "sp-001", label: "Jordan Miles" },
  { value: "sp-002", label: "Sarah Chen" },
  { value: "sp-003", label: "Marcus Johnson" },
  { value: "sp-004", label: "Emily Rodriguez" },
];


export default function CreateCustomerPage() {
  const router = useRouter();

  // Form state — Required fields
  const [customerName, setCustomerName] = useState("");
  const [defaultSalesperson, setDefaultSalesperson] = useState("");

  // Form state — Optional fields
  const [website, setWebsite] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [address, setAddress] = useState("");

  // Validation — Customer Name and Default Salesperson are required
  const canSubmit = customerName.trim() !== "" && defaultSalesperson !== "";

  // Handle create (mock only — no persistence)
  const handleCreate = () => {
    if (!canSubmit) return;

    // Navigate to mock Customer Profile page
    router.push("/customers/CUST-NEW");
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/customers");
  };

  return (
    <div className="create-customer-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — No backend wiring — Manual customer creation only.
      </div>

      {/* Header */}
      <div className="page-header">
        <Link href="/customers" className="back-link">
          ← Back to Customers
        </Link>
        <h1>Create Customer</h1>
        <p className="subtitle">
          Add a new customer record for order and commission management.
        </p>
      </div>

      {/* Basic Information Section */}
      <div className="form-section">
        <div className="section-title">Basic Information</div>
        <div className="form-grid">
          {/* Customer Name */}
          <div className="form-row">
            <label className="form-label">
              Customer Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g., Turner Construction"
            />
            <span className="field-hint">
              Legal or commonly used business name.
            </span>
          </div>

          {/* Default Salesperson */}
          <div className="form-row">
            <label className="form-label">
              Main / Default Salesperson <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={defaultSalesperson}
              onChange={(e) => setDefaultSalesperson(e.target.value)}
            >
              <option value="">— Select Salesperson —</option>
              {SALESPERSON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Primary owner of this customer.
            </span>
          </div>
        </div>
      </div>

      {/* Sales & Commission Section */}
      <div className="form-section">
        <div className="section-title">Sales & Commission</div>
        <div className="form-grid">
          {/* Commission Plan (Admin-controlled) */}
          <div className="form-row">
            <label className="form-label">Commission Plan</label>
            <input
              type="text"
              className="form-input readonly-field"
              value="— Use Salesperson Default —"
              readOnly
              disabled
            />
            <span className="field-hint">
              Commission plans are set by Admin and audited.
            </span>
          </div>
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="form-section">
        <div className="section-title">Contact Information</div>
        <div className="form-grid">
          {/* Website */}
          <div className="form-row">
            <label className="form-label">Website</label>
            <input
              type="url"
              className="form-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g., https://turnerconstruction.com"
            />
          </div>

          {/* Main Phone */}
          <div className="form-row">
            <label className="form-label">Main Phone</label>
            <input
              type="tel"
              className="form-input"
              value={mainPhone}
              onChange={(e) => setMainPhone(e.target.value)}
              placeholder="e.g., (213) 555-1000"
            />
          </div>

          {/* Address */}
          <div className="form-row full-width">
            <label className="form-label">Address</label>
            <textarea
              className="form-textarea"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 450 S Grand Ave, Suite 2100, Los Angeles, CA 90071"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <p className="helper-text">UI-only: saving will be wired later.</p>
        <div className="action-buttons">
          <button type="button" className="cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="create-btn"
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            Create Customer
          </button>
        </div>
      </div>

      <style jsx>{`
        .create-customer-container {
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

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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

        .field-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        .readonly-field {
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.4);
          cursor: not-allowed;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
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
