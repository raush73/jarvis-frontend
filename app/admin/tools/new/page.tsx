"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddToolPage() {
  const router = useRouter();

  // Form state
  const [toolName, setToolName] = useState("");
  const [description, setDescription] = useState("");
  const [calibrationRequired, setCalibrationRequired] = useState(false);
  const [heavyEquipment, setHeavyEquipment] = useState(false);
  const [precisionTool, setPrecisionTool] = useState(false);

  // Validation - Tool Name is required
  const canSubmit = toolName.trim() !== "";

  // Handle save
  const handleSave = () => {
    if (!canSubmit) return;

    // Generate mock id
    const mockId = `TOOL-${Date.now()}`;

    // Navigate to detail page (no persistence)
    router.push(`/admin/tools/${mockId}`);
  };

  const handleCancel = () => {
    router.push("/admin/tools");
  };

  return (
    <div className="add-tool-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to field roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <Link href="/admin/tools" className="back-link">
          ← Back to Tool Catalog
        </Link>
        <h1>Add Tool</h1>
        <p className="subtitle">
          Add a new tool to the catalog.
        </p>
      </div>

      {/* Form Section */}
      <div className="form-section">
        <div className="form-grid">
          {/* Tool Name */}
          <div className="form-row full-width">
            <label className="form-label">
              Tool Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="e.g., Torque Wrench 3/8 inch"
            />
          </div>

          {/* Description */}
          <div className="form-row full-width">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the tool..."
              rows={3}
            />
          </div>

          {/* Flags Section */}
          <div className="form-row full-width">
            <label className="form-label">Flags</label>
            <div className="flags-section">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={calibrationRequired}
                  onChange={() => setCalibrationRequired(!calibrationRequired)}
                />
                <span className="checkbox-label">Calibration Required</span>
                <span className="checkbox-hint">Tool requires periodic calibration</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={heavyEquipment}
                  onChange={() => setHeavyEquipment(!heavyEquipment)}
                />
                <span className="checkbox-label">Heavy Equipment</span>
                <span className="checkbox-hint">Requires special handling or certification</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={precisionTool}
                  onChange={() => setPrecisionTool(!precisionTool)}
                />
                <span className="checkbox-label">Precision Tool</span>
                <span className="checkbox-hint">High-accuracy measurement or operation</span>
              </label>
            </div>
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
            className="save-btn"
            onClick={handleSave}
            disabled={!canSubmit}
          >
            Save
          </button>
        </div>
      </div>

      <style jsx>{`
        .add-tool-container {
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
          grid-template-columns: 1fr;
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

        /* Flags Section */
        .flags-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 8px 0;
        }

        .checkbox-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .checkbox-label {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          min-width: 160px;
        }

        .checkbox-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
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
      `}</style>
    </div>
  );
}
