"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

type ToolStatus = "Active" | "Inactive";

type Tool = {
  id: string;
  name: string;
  description: string;
  status: ToolStatus;
};

const MOCK_TOOLS: Record<string, Tool> = {
  "TOOL-001": {
    id: "TOOL-001",
    name: "Pipe Wrench 24\"",
    description: "Heavy-duty pipe wrench for plumbing applications. Adjustable jaw for various pipe sizes.",
    status: "Active",
  },
  "TOOL-002": {
    id: "TOOL-002",
    name: "Digital Multimeter",
    description: "Professional-grade digital multimeter for electrical diagnostics.",
    status: "Active",
  },
};

export default function ToolDetailPage() {
  const params = useParams();
  const toolId = params.id as string;

  const tool = MOCK_TOOLS[toolId] || MOCK_TOOLS["TOOL-001"];

  const getStatusStyle = (status: ToolStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34,197,94,0.12)", color: "#22c55e", border: "rgba(34,197,94,0.25)" };
    }
    return { bg: "rgba(107,114,128,0.12)", color: "#6b7280", border: "rgba(107,114,128,0.25)" };
  };

  return (
    <div className="detail-container">
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to field roles.
      </div>

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
      </div>

      <div className="content-grid">
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
      </div>

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

        .shell-banner {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #f59e0b;
          text-align: center;
          margin-bottom: 24px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.55);
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 28px;
        }

        .card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .card-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .card-body {
          padding: 20px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }

        .info-label {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .info-value {
          font-size: 13px;
          color: #fff;
          font-weight: 500;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }

        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .description-panel {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 20px;
          font-size: 14px;
          color: rgba(255,255,255,0.8);
        }

        .no-description {
          color: rgba(255,255,255,0.4);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
