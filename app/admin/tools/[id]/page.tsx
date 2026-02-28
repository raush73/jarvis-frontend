"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// Types
type ToolStatus = "Active" | "Inactive";

type Tool = {
  id: string;
  name: string;
  description: string;
  flags: {
    calibrationRequired: boolean;
    heavyEquipment: boolean;
    precisionTool: boolean;
  };
  status: ToolStatus;
};

// Mock data
const MOCK_TOOLS: Record<string, Tool> = {
  "TOOL-001": {
    id: "TOOL-001",
    name: "Pipe Wrench 24\"",
    description: "Heavy-duty pipe wrench for plumbing applications. Adjustable jaw for various pipe sizes.",
    flags: { calibrationRequired: false, heavyEquipment: false, precisionTool: false },
    status: "Active",
  },
  "TOOL-002": {
    id: "TOOL-002",
    name: "Digital Multimeter",
    description: "Professional-grade digital multimeter for electrical diagnostics. Measures voltage, current, resistance, and continuity.",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Active",
  },
  "TOOL-003": {
    id: "TOOL-003",
    name: "Hydraulic Press",
    description: "50-ton hydraulic press for heavy-duty pressing operations. Requires certified operator.",
    flags: { calibrationRequired: true, heavyEquipment: true, precisionTool: false },
    status: "Active",
  },
  "TOOL-004": {
    id: "TOOL-004",
    name: "Torque Wrench",
    description: "Precision torque wrench with digital readout. Range: 10-150 ft-lbs.",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Active",
  },
  "TOOL-005": {
    id: "TOOL-005",
    name: "Hammer Drill",
    description: "Corded hammer drill for masonry and concrete applications.",
    flags: { calibrationRequired: false, heavyEquipment: false, precisionTool: false },
    status: "Inactive",
  },
  "TOOL-006": {
    id: "TOOL-006",
    name: "Laser Level",
    description: "Self-leveling rotary laser level with tripod. Indoor/outdoor use.",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Active",
  },
  "TOOL-007": {
    id: "TOOL-007",
    name: "Forklift",
    description: "5000 lb capacity propane forklift. Requires forklift certification to operate.",
    flags: { calibrationRequired: false, heavyEquipment: true, precisionTool: false },
    status: "Active",
  },
  "TOOL-008": {
    id: "TOOL-008",
    name: "Oscilloscope",
    description: "4-channel digital oscilloscope for electronic diagnostics and waveform analysis.",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Inactive",
  },
};

export default function ToolDetailPage() {
  const params = useParams();
  const toolId = params.id as string;

  // Get tool data (fallback to first mock if not found)
  const tool = MOCK_TOOLS[toolId] || MOCK_TOOLS["TOOL-001"];

  // Status badge style
  const getStatusStyle = (status: ToolStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  return (
    <div className="detail-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to field roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin/tools" className="back-link">
            ← Back to Tool Catalog
          </Link>
          <h1>{tool.name}</h1>
          <p className="subtitle">
            Tool details and configuration.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-edit">
            Edit
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="content-grid">
        {/* Tool Info Card */}
        <div className="card">
          <div className="card-header">
            <h2>Tool Information</h2>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="info-label">Tool ID</span>
              <span className="info-value mono">{tool.id}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Name</span>
              <span className="info-value">{tool.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <span className="info-value">
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: getStatusStyle(tool.status).bg,
                    color: getStatusStyle(tool.status).color,
                    borderColor: getStatusStyle(tool.status).border,
                  }}
                >
                  {tool.status}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Flags Card */}
        <div className="card">
          <div className="card-header">
            <h2>Flags</h2>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="info-label">Calibration Required</span>
              <span className="info-value">
                {tool.flags.calibrationRequired ? (
                  <span className="flag-yes">Yes</span>
                ) : (
                  <span className="flag-no">No</span>
                )}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Heavy Equipment</span>
              <span className="info-value">
                {tool.flags.heavyEquipment ? (
                  <span className="flag-yes">Yes</span>
                ) : (
                  <span className="flag-no">No</span>
                )}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Precision Tool</span>
              <span className="info-value">
                {tool.flags.precisionTool ? (
                  <span className="flag-yes">Yes</span>
                ) : (
                  <span className="flag-no">No</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="section">
        <div className="section-header">
          <h2>Description</h2>
        </div>
        <div className="description-panel">
          {tool.description || <span className="no-description">No description provided.</span>}
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
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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

        .header-actions {
          padding-top: 28px;
        }

        .btn-edit {
          display: inline-block;
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

        .btn-edit:hover {
          background: #2563eb;
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
        }

        .info-value {
          font-size: 13px;
          color: #fff;
          font-weight: 500;
        }

        .info-value.mono {
          font-family: monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }

        .flag-yes {
          color: #22c55e;
          font-weight: 500;
        }

        .flag-no {
          color: rgba(255, 255, 255, 0.4);
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

        .description-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
        }

        .no-description {
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
