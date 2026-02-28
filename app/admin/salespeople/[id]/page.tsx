"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type SalespersonRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function SalespersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const salespersonId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [recordId, setRecordId] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const isProtected =
    (firstName.trim() === "House" && lastName.trim() === "Account") ||
    email.trim().toLowerCase() === "mike@mw4h.com";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<SalespersonRecord>(
          `/salespeople/${salespersonId}`
        );
        if (!alive) return;
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setIsActive(data.isActive ?? true);
        setRecordId(data.id);
        setCreatedAt(data.createdAt ?? "");
        setUpdatedAt(data.updatedAt ?? "");
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load salesperson.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [salespersonId]);

  const canSubmit = firstName.trim() !== "" && lastName.trim() !== "";

  const handleSave = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/salespeople/${salespersonId}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          isActive,
        }),
      });
      router.push("/admin/salespeople");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update salesperson.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (active: boolean) => {
    if (active) {
      return {
        bg: "rgba(34, 197, 94, 0.12)",
        color: "#22c55e",
        border: "rgba(34, 197, 94, 0.25)",
      };
    }
    return {
      bg: "rgba(107, 114, 128, 0.12)",
      color: "#6b7280",
      border: "rgba(107, 114, 128, 0.25)",
    };
  };

  const formatDate = (iso: string) => {
    if (!iso) return "\u2014";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="detail-container">
        <div className="shell-banner">Loading salesperson\u2026</div>
        <style jsx>{`
          .detail-container {
            padding: 24px 40px 60px;
            max-width: 1000px;
            margin: 0 auto;
          }
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
        `}</style>
      </div>
    );
  }

  return (
    <div className="detail-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        Salesperson edit â€” Internal management view â€” not visible to Sales
        roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <Link href="/admin/salespeople" className="back-link">
          &larr; Back to Salespeople
        </Link>
        <h1>Salesperson Detail</h1>
        <p className="subtitle">
          View and manage salesperson profile and customer assignments.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Main Content Grid */}
      <div className="content-grid">
        {/* Basic Info Card */}
        <div className="card">
          <div className="card-header">
            <h2>Basic Information</h2>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="info-label">First Name</span>
              <input
                type="text"
                className="edit-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="info-row">
              <span className="info-label">Last Name</span>
              <input
                type="text"
                className="edit-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="info-row">
              <span className="info-label">Email</span>
              <input
                type="email"
                className="edit-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="info-row">
              <span className="info-label">Phone</span>
              <input
                type="tel"
                className="edit-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <span className="info-value">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={isProtected}
                    onChange={() => setIsActive(!isActive)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: getStatusStyle(isActive).bg,
                    color: getStatusStyle(isActive).color,
                    borderColor: getStatusStyle(isActive).border,
                    marginLeft: "10px",
                  }}
                >
                  {isActive ? "Active" : "Inactive"}
                </span>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">ID</span>
              <span className="info-value mono">{recordId}</span>
            </div>
          </div>
        </div>

        {/* Defaults Card */}
        <div className="card">
          <div className="card-header">
            <h2>Defaults</h2>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="info-label">Default Commission Plan</span>
              <span className="info-value">{"\u2014"}</span>
            </div>
            <div className="info-row toggle-row">
              <span className="info-label">Default on New Customers</span>
              <span className="toggle-hint">(future wiring)</span>
            </div>
          </div>
          <div className="card-footer">
            <span className="audit-text">
              Created: {formatDate(createdAt)}
            </span>
            <span className="audit-text">
              Updated: {formatDate(updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="form-actions">
        <div />
        <div className="action-buttons">
          <Link href="/admin/salespeople" className="cancel-btn">
            Cancel
          </Link>
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Customers Owned Section */}
      <div className="section">
        <div className="section-header">
          <h2>Customers Owned</h2>
          <span className="badge-future">FUTURE</span>
        </div>
        <div className="placeholder-panel">
          <div className="placeholder-text">
            Customer ownership list will appear here once wired to backend data.
          </div>
        </div>
      </div>

      {/* Commission Snapshot Placeholder */}
      <div className="section">
        <div className="section-header">
          <h2>Commission Snapshot</h2>
          <span className="badge-future">FUTURE</span>
        </div>
        <div className="placeholder-panel">
          <div className="placeholder-icon">&#x1F4CA;</div>
          <div className="placeholder-text">
            Commission history and earnings summary will appear here once wired
            to backend data.
          </div>
          <div className="placeholder-note">
            Powered by approved snapshots (future wiring).
          </div>
        </div>
      </div>

      <style jsx>{`
        .detail-container {
          padding: 24px 40px 60px;
          max-width: 1000px;
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

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        /* Cards */
        .card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .card-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .card-header h2 {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .card-body {
          padding: 20px;
        }

        .card-footer {
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          gap: 20px;
        }

        .audit-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
          margin-right: 16px;
        }

        .info-value {
          font-size: 13px;
          color: #fff;
          font-weight: 500;
          display: flex;
          align-items: center;
        }

        .info-value.mono {
          font-family: monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Edit Input */
        .edit-input {
          padding: 6px 10px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          transition: border-color 0.15s ease;
          text-align: right;
          max-width: 220px;
          width: 100%;
        }

        .edit-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }

        /* Toggle */
        .toggle-row {
          gap: 12px;
        }

        .toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
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
          background: #3b82f6;
        }

        .toggle input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .toggle-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          margin-left: auto;
        }

        /* Form Actions */
        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 4px;
          padding-bottom: 28px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          margin-bottom: 0;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .cancel-btn {
          display: inline-block;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .cancel-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .save-btn {
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

        .save-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Sections */
        .section {
          margin-bottom: 28px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .badge-future {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          background: rgba(148, 163, 184, 0.12);
          color: rgba(148, 163, 184, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        /* Placeholder Panel */
        .placeholder-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 40px 24px;
          text-align: center;
        }

        .placeholder-icon {
          font-size: 32px;
          margin-bottom: 12px;
          opacity: 0.6;
        }

        .placeholder-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }

        .placeholder-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </div>
  );
}




