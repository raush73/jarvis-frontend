"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function CreateTradePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [wcClassCode, setWcClassCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim() !== "" && wcClassCode.trim() !== "";

  const handleCreate = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const created = await apiFetch<{ id: string }>("/trades", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          wcClassCode: wcClassCode.trim(),
          description: description.trim() || null,
        }),
      });
      router.push(`/admin/trades/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create trade.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-trade-container">
      <div className="page-header">
        <Link href="/admin/trades" className="back-link">
          &larr; Back to Trades
        </Link>
        <h1>Add Trade</h1>
        <p className="subtitle">
          Create a new skilled trade for use across Jarvis Prime.
        </p>
      </div>

      <div className="form-section">
        <div className="form-grid">
          <div className="form-row">
            <label className="form-label">
              Trade Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pipefitter"
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              WC Class Code <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input mono"
              value={wcClassCode}
              onChange={(e) => setWcClassCode(e.target.value)}
              placeholder="e.g., 5183"
            />
          </div>

          <div className="form-row full-width">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this trade"
              rows={3}
            />
          </div>
        </div>
      </div>

      {error && (
        <p
          style={{ color: "#ef4444", fontSize: "13px", margin: "0 0 12px" }}
        >
          {error}
        </p>
      )}

      <div className="form-actions">
        <div />
        <div className="action-buttons">
          <Link href="/admin/trades" className="cancel-btn">
            Cancel
          </Link>
          <button
            type="button"
            className="create-btn"
            onClick={handleCreate}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Creating\u2026" : "Create Trade"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .create-trade-container {
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
        .form-textarea {
          padding: 10px 12px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          transition: border-color 0.15s ease;
        }

        .form-input.mono {
          font-family: var(--font-geist-mono), monospace;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
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
