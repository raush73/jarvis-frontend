"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/auth/useSession";

const ALL_LIFECYCLE_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "CUSTOMER", label: "Customer" },
] as const;

const CUSTOMER_LIFECYCLE_AUTHORITY_ROLES = ["admin", "admin_system", "manager", "sales_admin"];

const US_STATE_CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

export default function CreateCustomerPage() {
  const router = useRouter();
  const session = useSession();

  const canCreateCustomer = session.ready &&
    session.roles.some((r) => CUSTOMER_LIFECYCLE_AUTHORITY_ROLES.includes(r));

  const lifecycleOptions = canCreateCustomer
    ? ALL_LIFECYCLE_OPTIONS
    : ALL_LIFECYCLE_OPTIONS.filter((opt) => opt.value !== "CUSTOMER");

  const [name, setName] = useState("");
  const [lifecycleStatus, setLifecycleStatus] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() !== "" && lifecycleStatus !== "" && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        lifecycleStatus,
      };
      if (phone.trim()) payload.phone = phone.trim();
      if (websiteUrl.trim()) payload.websiteUrl = websiteUrl.trim();
      if (street.trim()) payload.street = street.trim();
      if (city.trim()) payload.city = city.trim();
      if (state) payload.state = state;
      if (zipCode.trim()) payload.zipCode = zipCode.trim();
      if (country.trim()) payload.country = country.trim();

      const created = await apiFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push(`/customers/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create company. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/customers");
  };

  return (
    <div className="create-customer-container">
      {/* Header */}
      <div className="page-header">
        <Link href="/customers" className="back-link">
          &larr; Back to Companies
        </Link>
        <h1>Add Company</h1>
        <p className="subtitle">
          Create a new Lead, Prospect, or Customer record.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Basic Information */}
      <div className="form-section">
        <div className="section-title">Basic Information</div>
        <div className="form-grid">
          <div className="form-row">
            <label className="form-label">
              Company Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Turner Construction"
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              Lifecycle Status <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={lifecycleStatus}
              onChange={(e) => setLifecycleStatus(e.target.value)}
            >
              <option value="">— Select Status —</option>
              {lifecycleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="form-section">
        <div className="section-title">Contact Information</div>
        <div className="form-grid">
          <div className="form-row">
            <label className="form-label">Main Phone</label>
            <input
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., (213) 555-1000"
            />
          </div>

          <div className="form-row">
            <label className="form-label">Website</label>
            <input
              type="url"
              className="form-input"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="e.g., https://turnerconstruction.com"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="form-section">
        <div className="section-title">Location</div>
        <div className="form-grid">
          <div className="form-row full-width">
            <label className="form-label">Street</label>
            <input
              type="text"
              className="form-input"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="e.g., 450 S Grand Ave, Suite 2100"
            />
          </div>

          <div className="form-row">
            <label className="form-label">City</label>
            <input
              type="text"
              className="form-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Los Angeles"
            />
          </div>

          <div className="form-row">
            <label className="form-label">State</label>
            <select
              className="form-select"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">— Select State —</option>
              {US_STATE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">Zip Code</label>
            <input
              type="text"
              className="form-input"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="e.g., 90071"
            />
          </div>

          <div className="form-row">
            <label className="form-label">Country</label>
            <input
              type="text"
              className="form-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="USA"
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
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
            {submitting ? "Creating..." : "Create Company"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .create-customer-container {
          padding: 24px 40px 60px;
          max-width: 800px;
          margin: 0 auto;
        }

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

        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          color: #ef4444;
          margin-bottom: 24px;
        }

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
        .form-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-input::placeholder {
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

        .form-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
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
