"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// Mock trades data (same as list page for consistency)
const MOCK_TRADES = [
  {
    id: "TRD-001",
    name: "Millwright",
    code: "MILLWRIGHT",
    category: "Mechanical",
    description: "Industrial machinery installation, maintenance, and repair. Alignment and precision work.",
    status: "Active",
    notes: "Core MW4H trade. High demand across all regions.",
    wcClassCode: "3724",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-002",
    name: "Welder",
    code: "WELDER",
    category: "Mechanical",
    description: "Metal fabrication and joining using various welding processes (MIG, TIG, Stick, Flux-Core).",
    status: "Active",
    notes: "Certifications tracked separately (6G, etc.).",
    wcClassCode: "3620",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-003",
    name: "Pipefitter",
    code: "PIPEFITTER",
    category: "Mechanical",
    description: "Industrial piping systems installation and maintenance. Process piping and steam systems.",
    status: "Active",
    notes: "",
    wcClassCode: "5183",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-004",
    name: "Electrician",
    code: "ELECTRICIAN",
    category: "Electrical",
    description: "Electrical systems installation, maintenance, and troubleshooting. Industrial controls.",
    status: "Active",
    notes: "Requires state licensure verification.",
    wcClassCode: "5190",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-005",
    name: "Crane Operator",
    code: "CRANE_OP",
    category: "Mechanical",
    description: "Operation of mobile and overhead cranes for lifting and rigging operations.",
    status: "Active",
    notes: "NCCCO certification required.",
    wcClassCode: "7219",
    createdAt: "2025-03-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-006",
    name: "Ironworker",
    code: "IRONWORKER",
    category: "Structural",
    description: "Structural steel erection, reinforcing steel placement, and metal decking installation.",
    status: "Active",
    notes: "",
    wcClassCode: "5040",
    createdAt: "2025-03-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-007",
    name: "Rigger",
    code: "RIGGER",
    category: "Structural",
    description: "Load calculation, rigging equipment selection, and safe lifting operations.",
    status: "Active",
    notes: "Often combined with Millwright or Ironworker skills.",
    wcClassCode: "5057",
    createdAt: "2025-03-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-008",
    name: "Instrument Technician",
    code: "INST_TECH",
    category: "Electrical",
    description: "Calibration and maintenance of process control instruments and PLCs.",
    status: "Active",
    notes: "",
    wcClassCode: "3681",
    createdAt: "2025-06-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-009",
    name: "Boilermaker",
    code: "BOILERMAKER",
    category: "Mechanical",
    description: "Fabrication, assembly, and repair of boilers, tanks, and pressure vessels.",
    status: "Active",
    notes: "",
    wcClassCode: "3620",
    createdAt: "2025-06-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-010",
    name: "Carpenter",
    code: "CARPENTER",
    category: "Structural",
    description: "Forming, framing, and general carpentry for industrial construction.",
    status: "Inactive",
    notes: "Low demand. Kept for historical orders.",
    wcClassCode: "5403",
    createdAt: "2025-01-15",
    updatedAt: "2025-12-01",
  },
];

// UI-only mock data: Tool Catalog
const TOOL_CATALOG_MOCK = [
  { id: "TOOL-001", name: "Dial Indicator Set", flags: { cal: true, prec: true } },
  { id: "TOOL-002", name: "Laser Alignment System", flags: { cal: true, prec: true } },
  { id: "TOOL-003", name: "Hydraulic Torque Wrench", flags: { cal: true, heavy: true } },
  { id: "TOOL-004", name: "Chain Hoist (2-ton)", flags: { heavy: true } },
  { id: "TOOL-005", name: "Digital Multimeter", flags: { cal: true } },
  { id: "TOOL-006", name: "Pipe Threader Set", flags: { heavy: true } },
  { id: "TOOL-007", name: "Precision Level (Machinist)", flags: { prec: true } },
  { id: "TOOL-008", name: "Micrometer Set (0-6\")", flags: { cal: true, prec: true } },
  { id: "TOOL-009", name: "Come-Along (3-ton)", flags: { heavy: true } },
  { id: "TOOL-010", name: "Feeler Gauge Set", flags: { prec: true } },
  { id: "TOOL-011", name: "Portable Band Saw", flags: {} },
  { id: "TOOL-012", name: "Magnetic Drill Press", flags: { heavy: true } },
  { id: "TOOL-013", name: "Infrared Thermometer", flags: { cal: true } },
  { id: "TOOL-014", name: "Rigging Shackle Set", flags: { heavy: true } },
];

export default function TradeDetailPage() {
  const params = useParams();
  const tradeId = params.id as string;

  // Find the trade from mock data
  const trade = MOCK_TRADES.find((t) => t.id === tradeId);

  // MW4H Minimal Tool List state (UI-only)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [toolSearchQuery, setToolSearchQuery] = useState("");

  // Filter tools by search query
  const filteredTools = useMemo(() => {
    if (!toolSearchQuery.trim()) return TOOL_CATALOG_MOCK;
    const query = toolSearchQuery.toLowerCase();
    return TOOL_CATALOG_MOCK.filter((tool) =>
      tool.name.toLowerCase().includes(query)
    );
  }, [toolSearchQuery]);

  // Toggle tool selection
  const handleToggleTool = (toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  // Remove selected tool
  const handleRemoveTool = (toolId: string) => {
    setSelectedToolIds((prev) => prev.filter((id) => id !== toolId));
  };

  // Get selected tools for pills display
  const selectedTools = TOOL_CATALOG_MOCK.filter((tool) =>
    selectedToolIds.includes(tool.id)
  );

  // Category badge style
  const getCategoryStyle = (category: string) => {
    switch (category) {
      case "Mechanical":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "Electrical":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "Structural":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "Other":
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Status badge style
  const getStatusStyle = (status: string) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // Not found state
  if (!trade) {
    return (
      <div className="trade-detail-container">
        <div className="page-header">
          <Link href="/admin/trades" className="back-link">
            ← Back to Trades
          </Link>
          <h1>Trade Not Found</h1>
          <p className="subtitle">The trade with ID &quot;{tradeId}&quot; could not be found.</p>
        </div>

        <style jsx>{`
          .trade-detail-container {
            padding: 24px 40px 60px;
            max-width: 900px;
            margin: 0 auto;
          }
          .page-header {
            margin-bottom: 24px;
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
        `}</style>
      </div>
    );
  }

  return (
    <div className="trade-detail-container">
      {/* Header with back link */}
      <div className="page-header">
        <Link href="/admin/trades" className="back-link">
          ← Back to Trades
        </Link>
        <h1>{trade.name}</h1>
        <p className="subtitle">Trade details and configuration</p>
      </div>

      {/* Trade Details Card */}
      <div className="detail-card">
        <div className="card-header">
          <h2>Trade Details</h2>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Trade Name</span>
              <span className="detail-value">{trade.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Trade Code</span>
              <span className="detail-value code">{trade.code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">WC Class Code</span>
              <span className="detail-value wc-code">{trade.wcClassCode || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Category</span>
              <span
                className="category-badge"
                style={{
                  backgroundColor: getCategoryStyle(trade.category).bg,
                  color: getCategoryStyle(trade.category).color,
                  borderColor: getCategoryStyle(trade.category).border,
                }}
              >
                {trade.category}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span
                className="status-badge"
                style={{
                  backgroundColor: getStatusStyle(trade.status).bg,
                  color: getStatusStyle(trade.status).color,
                  borderColor: getStatusStyle(trade.status).border,
                }}
              >
                {trade.status}
              </span>
            </div>
          </div>

          <div className="detail-item full-width">
            <span className="detail-label">Description</span>
            <span className="detail-value">{trade.description || "—"}</span>
          </div>

          {trade.notes && (
            <div className="detail-item full-width">
              <span className="detail-label">Notes</span>
              <span className="detail-value">{trade.notes}</span>
            </div>
          )}

          <div className="audit-section">
            <div className="audit-title">Audit Information</div>
            <div className="audit-grid">
              <div className="audit-item">
                <span className="audit-label">Created</span>
                <span className="audit-value">{trade.createdAt}</span>
              </div>
              <div className="audit-item">
                <span className="audit-label">Updated</span>
                <span className="audit-value">{trade.updatedAt}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MW4H Minimal Tool List Section */}
      <div className="detail-card tool-list-card">
        <div className="card-header">
          <h2>MW4H Minimal Tool List</h2>
        </div>
        <div className="card-body">
          <p className="section-intro">
            Company-required minimum tools for this trade. Tools are selected from the Tool Catalog.
          </p>

          {/* Search input */}
          <div className="tool-search">
            <input
              type="text"
              placeholder="Search Tool Catalog…"
              value={toolSearchQuery}
              onChange={(e) => setToolSearchQuery(e.target.value)}
            />
          </div>

          {/* Scrollable tool list */}
          <div className="tool-list-scroll">
            {filteredTools.map((tool) => (
              <label key={tool.id} className="tool-row">
                <input
                  type="checkbox"
                  checked={selectedToolIds.includes(tool.id)}
                  onChange={() => handleToggleTool(tool.id)}
                />
                <span className="tool-name">{tool.name}</span>
                <span className="tool-flags">
                  {tool.flags.cal && <span className="flag-badge cal">CAL</span>}
                  {tool.flags.heavy && <span className="flag-badge heavy">HEAVY</span>}
                  {tool.flags.prec && <span className="flag-badge prec">PREC</span>}
                </span>
              </label>
            ))}
            {filteredTools.length === 0 && (
              <div className="tool-empty-search">No tools match your search</div>
            )}
          </div>

          {/* Selected tools pills */}
          <div className="selected-tools-section">
            <span className="selected-label">Selected Tools:</span>
            {selectedTools.length > 0 ? (
              <div className="selected-pills">
                {selectedTools.map((tool) => (
                  <span key={tool.id} className="tool-pill">
                    {tool.name}
                    <button
                      type="button"
                      className="pill-remove"
                      onClick={() => handleRemoveTool(tool.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No MW4H minimum tools selected yet. (UI-only)
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="tool-footer-note">
            This selection references the Tool Catalog. Orders snapshot required tools at creation.
          </div>
        </div>
      </div>

      <style jsx>{`
        .trade-detail-container {
          padding: 24px 40px 60px;
          max-width: 900px;
          margin: 0 auto;
        }

        /* Header */
        .page-header {
          margin-bottom: 24px;
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

        /* Detail Card */
        .detail-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .card-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .card-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .card-body {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
          margin-bottom: 12px;
        }

        .detail-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .detail-value {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.5;
        }

        .detail-value.code {
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .detail-value.wc-code {
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          color: rgba(139, 92, 246, 0.9);
        }

        .category-badge,
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
          width: fit-content;
        }

        /* Audit Section */
        .audit-section {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          margin-top: 8px;
        }

        .audit-title {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 14px;
        }

        .audit-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .audit-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .audit-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
        }

        .audit-value {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        /* MW4H Minimal Tool List Section */
        .tool-list-card {
          margin-top: 24px;
        }

        .section-intro {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .tool-search {
          margin-bottom: 12px;
        }

        .tool-search input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
        }

        .tool-search input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .tool-search input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .tool-list-scroll {
          max-height: 280px;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.15);
        }

        .tool-row {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .tool-row:last-child {
          border-bottom: none;
        }

        .tool-row:hover {
          background: rgba(59, 130, 246, 0.06);
        }

        .tool-row input[type="checkbox"] {
          width: 16px;
          height: 16px;
          margin-right: 12px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .tool-name {
          flex: 1;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
        }

        .tool-flags {
          display: flex;
          gap: 6px;
        }

        .flag-badge {
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 700;
          border-radius: 3px;
          letter-spacing: 0.3px;
        }

        .flag-badge.cal {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .flag-badge.heavy {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .flag-badge.prec {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .tool-empty-search {
          padding: 24px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        /* Selected tools pills */
        .selected-tools-section {
          margin-top: 16px;
        }

        .selected-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 10px;
        }

        .selected-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tool-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 16px;
          font-size: 12px;
          color: #3b82f6;
        }

        .pill-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          font-size: 14px;
          color: rgba(59, 130, 246, 0.7);
          background: transparent;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pill-remove:hover {
          color: #fff;
          background: rgba(59, 130, 246, 0.3);
        }

        .empty-state {
          padding: 16px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          font-style: italic;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        /* Footer note */
        .tool-footer-note {
          margin-top: 16px;
          padding: 12px 14px;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(139, 92, 246, 0.9);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
