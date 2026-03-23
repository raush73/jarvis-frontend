"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types — Candidate-shaped employee detail                           */
/* ------------------------------------------------------------------ */

type TradeRow = {
  id: string;
  tradeId: string;
  tradeName: string;
  proficiency: string;
  notes: string | null;
  source: string;
};

type CertRow = {
  id: string;
  certTypeId: string;
  certTypeName: string;
  certTypeCode: string;
  categoryName: string | null;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  verification: string;
  notes: string | null;
  source: string;
};

type ToolRow = {
  id: string;
  toolTypeId: string;
  toolTypeName: string;
  status: string;
  notes: string | null;
  source: string;
};

type PpeRow = {
  id: string;
  ppeTypeId: string;
  ppeTypeName: string;
  status: string;
  notes: string | null;
  source: string;
};

type ApplicationRow = {
  id: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

type EmployeeDetail = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  createdAt: string;
  updatedAt: string;
  trades: TradeRow[];
  certifications: CertRow[];
  tools: ToolRow[];
  ppe: PpeRow[];
  applications: ApplicationRow[];
};

type ComplianceRecord = {
  id: string;
  employeeId: string;
  requirementTypeId: string;
  requirementTypeName: string;
  categoryName: string | null;
  variantId: string | null;
  variantName: string | null;
  status: string;
  issueDate: string | null;
  expirationDate: string | null;
  documentFile: string | null;
  notes: string | null;
  issuedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplianceRequirementType = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  requiresExpiration: boolean;
  isActive: boolean;
};

type ComplianceVariant = {
  id: string;
  requirementTypeId: string;
  name: string;
  isActive: boolean;
};

/* ------------------------------------------------------------------ */
/*  Tab list (locked order)                                            */
/* ------------------------------------------------------------------ */

const TABS = [
  "Overview",
  "Certifications",
  "Compliance",
  "Tools",
  "PPE",
  "Work History",
  "Timesheets",
  "Payroll",
  "Safety",
  "Documents",
  "Job Application",
  "Notes",
] as const;

type TabKey = (typeof TABS)[number];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDate(v: string | null | undefined): string {
  if (!v) return "\u2014";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString();
}

function statusColor(status: string): { bg: string; color: string; border: string } {
  switch (status) {
    case "COMPLETED":
    case "VERIFIED":
      return { bg: "rgba(34,197,94,0.08)", color: "#16a34a", border: "rgba(34,197,94,0.25)" };
    case "PENDING":
    case "SELF_ATTESTED":
    case "UNKNOWN":
      return { bg: "rgba(245,158,11,0.08)", color: "#d97706", border: "rgba(245,158,11,0.25)" };
    case "FAILED":
    case "MISSING":
      return { bg: "rgba(239,68,68,0.08)", color: "#dc2626", border: "rgba(239,68,68,0.25)" };
    case "EXPIRED":
      return { bg: "rgba(107,114,128,0.08)", color: "#6b7280", border: "rgba(107,114,128,0.25)" };
    default:
      return { bg: "rgba(107,114,128,0.08)", color: "#6b7280", border: "rgba(107,114,128,0.25)" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const sc = statusColor(status);
  return (
    <span style={{
      display: "inline-block", padding: "3px 8px", borderRadius: "4px",
      fontSize: "11px", fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
    }}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Downstream placeholder                                             */
/* ------------------------------------------------------------------ */

function DownstreamTab({ label }: { label: string }) {
  return (
    <div style={{
      padding: "40px 20px",
      textAlign: "center",
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
    }}>
      <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
        {label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compliance state
  const [compRecords, setCompRecords] = useState<ComplianceRecord[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compReqTypes, setCompReqTypes] = useState<ComplianceRequirementType[]>([]);
  const [compVariants, setCompVariants] = useState<ComplianceVariant[]>([]);
  const [showCompModal, setShowCompModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ComplianceRecord | null>(null);
  const [compForm, setCompForm] = useState({
    requirementTypeId: "",
    variantId: "",
    status: "PENDING",
    issueDate: "",
    expirationDate: "",
    notes: "",
    issuedBy: "",
  });
  const [compSaving, setCompSaving] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  /* ---------- Load employee ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<EmployeeDetail>(`/employees/${id}`);
        if (!alive) return;
        setEmployee(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load employee.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  /* ---------- Load compliance records when tab is active ---------- */
  const loadCompliance = useCallback(async () => {
    setCompLoading(true);
    try {
      const [records, reqTypes, variants] = await Promise.all([
        apiFetch<ComplianceRecord[]>(`/employees/${id}/compliance-records`),
        apiFetch<ComplianceRequirementType[]>("/compliance-requirement-types?activeOnly=true"),
        apiFetch<ComplianceVariant[]>("/compliance-variants?activeOnly=true"),
      ]);
      setCompRecords(Array.isArray(records) ? records : []);
      setCompReqTypes(Array.isArray(reqTypes) ? reqTypes : []);
      setCompVariants(Array.isArray(variants) ? variants : []);
    } catch {
      setCompRecords([]);
    } finally {
      setCompLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "Compliance") loadCompliance();
  }, [activeTab, loadCompliance]);

  /* ---------- Compliance CRUD ---------- */
  function openAddCompliance() {
    setEditingRecord(null);
    setCompForm({ requirementTypeId: "", variantId: "", status: "PENDING", issueDate: "", expirationDate: "", notes: "", issuedBy: "" });
    setCompError(null);
    setShowCompModal(true);
  }

  function openEditCompliance(rec: ComplianceRecord) {
    setEditingRecord(rec);
    setCompForm({
      requirementTypeId: rec.requirementTypeId,
      variantId: rec.variantId ?? "",
      status: rec.status,
      issueDate: rec.issueDate ? rec.issueDate.slice(0, 10) : "",
      expirationDate: rec.expirationDate ? rec.expirationDate.slice(0, 10) : "",
      notes: rec.notes ?? "",
      issuedBy: rec.issuedBy ?? "",
    });
    setCompError(null);
    setShowCompModal(true);
  }

  async function saveCompliance() {
    setCompSaving(true);
    setCompError(null);
    try {
      if (editingRecord) {
        await apiFetch(`/employees/${id}/compliance-records/${editingRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            variantId: compForm.variantId || undefined,
            status: compForm.status,
            issueDate: compForm.issueDate || undefined,
            expirationDate: compForm.expirationDate || undefined,
            notes: compForm.notes || undefined,
            issuedBy: compForm.issuedBy || undefined,
          }),
        });
      } else {
        if (!compForm.requirementTypeId) {
          setCompError("Requirement type is required.");
          setCompSaving(false);
          return;
        }
        await apiFetch(`/employees/${id}/compliance-records`, {
          method: "POST",
          body: JSON.stringify({
            employeeId: id,
            requirementTypeId: compForm.requirementTypeId,
            variantId: compForm.variantId || undefined,
            status: compForm.status,
            issueDate: compForm.issueDate || undefined,
            expirationDate: compForm.expirationDate || undefined,
            notes: compForm.notes || undefined,
            issuedBy: compForm.issuedBy || undefined,
          }),
        });
      }
      setShowCompModal(false);
      await loadCompliance();
    } catch (e: any) {
      setCompError(e?.message ?? "Save failed.");
    } finally {
      setCompSaving(false);
    }
  }

  async function deleteCompliance(recordId: string) {
    if (!confirm("Delete this compliance record?")) return;
    try {
      await apiFetch(`/employees/${id}/compliance-records/${recordId}`, { method: "DELETE" });
      await loadCompliance();
    } catch {
      // silent
    }
  }

  /* ---------- Loading / Error ---------- */
  const shellStyle: React.CSSProperties = {
    padding: "24px 40px 60px",
    maxWidth: "1600px",
    margin: "0 auto",
    background: "#f8fafc",
    minHeight: "100vh",
  };

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>
          Loading employee...
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div style={shellStyle}>
        <button
          onClick={() => router.push("/employees")}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "7px 14px", fontSize: "13px", fontWeight: 500,
            color: "#374151", background: "#ffffff",
            border: "1px solid #e5e7eb", borderRadius: "7px", cursor: "pointer",
          }}
        >
          &larr; Back to Employees
        </button>
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Employee Not Found</h2>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{error || `No employee with ID: ${id}`}</p>
        </div>
      </div>
    );
  }

  const emp = employee;
  const displayName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || null;
  const primaryTrade = emp.trades[0]?.tradeName ?? null;
  const variantsForType = compVariants.filter(
    (v) => v.requirementTypeId === compForm.requirementTypeId
  );

  /* ---------- Tab content renderer ---------- */
  function renderTab() {
    switch (activeTab) {
      /* ========== OVERVIEW ========== */
      case "Overview": {
        const hasEmergencyContact = emp.emergencyContactName || emp.emergencyContactPhone;
        const primaryTrade = emp.trades[0] ?? null;

        const OV_GRID_CLASS = "ov-profile-grid";
        const OV_CARD: React.CSSProperties = { background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
        const OV_TITLE: React.CSSProperties = { fontSize: "14px", fontWeight: 700, color: "#111827", margin: "0 0 14px", paddingBottom: "10px", borderBottom: "1px solid #e5e7eb" };
        const OV_ROW: React.CSSProperties = { display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "start", gap: "0 16px", padding: "10px 0", borderBottom: "1px solid #f1f5f9" };
        const OV_ROW_LAST: React.CSSProperties = { ...OV_ROW, borderBottom: "none" };
        const OV_LBL: React.CSSProperties = { fontSize: "13px", fontWeight: 500, color: "#6b7280" };
        const OV_VAL: React.CSSProperties = { fontSize: "14px", fontWeight: 500, color: "#111827" };
        const OV_EMPTY: React.CSSProperties = { fontSize: "13px", color: "#9ca3af", fontStyle: "italic", margin: 0 };

        const fmtEnum = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        return (
          <div>
            <style>{`
              .${OV_GRID_CLASS} { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              @media (max-width: 900px) { .${OV_GRID_CLASS} { grid-template-columns: 1fr; } }
            `}</style>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: 0 }}>Employee Overview</h2>
            </div>
            <div className={OV_GRID_CLASS}>
              {/* Contact Information */}
              <div style={OV_CARD}>
                <h3 style={OV_TITLE}>Contact Information</h3>
                <div style={OV_ROW}>
                  <div style={OV_LBL}>First Name</div>
                  <div style={OV_VAL}>{emp.firstName || "\u2014"}</div>
                </div>
                <div style={OV_ROW}>
                  <div style={OV_LBL}>Last Name</div>
                  <div style={OV_VAL}>{emp.lastName || "\u2014"}</div>
                </div>
                <div style={OV_ROW}>
                  <div style={OV_LBL}>Email</div>
                  <div style={{ ...OV_VAL, color: emp.email ? "#2563eb" : "#111827" }}>{emp.email || "\u2014"}</div>
                </div>
                <div style={OV_ROW}>
                  <div style={OV_LBL}>Phone</div>
                  <div style={OV_VAL}>{emp.phone || "\u2014"}</div>
                </div>
                <div style={OV_ROW_LAST}>
                  <div style={OV_LBL}>Status</div>
                  <div style={OV_VAL}><StatusBadge status={emp.status} /></div>
                </div>
              </div>

              {/* Trade Information */}
              <div style={OV_CARD}>
                <h3 style={OV_TITLE}>Trade Information</h3>
                {primaryTrade ? (
                  <>
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>Primary Trade</div>
                      <div style={OV_VAL}>{primaryTrade.tradeName}</div>
                    </div>
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>Proficiency</div>
                      <div style={OV_VAL}>{fmtEnum(primaryTrade.proficiency)}</div>
                    </div>
                    <div style={OV_ROW_LAST}>
                      <div style={OV_LBL}>Source</div>
                      <div style={OV_VAL}>{fmtEnum(primaryTrade.source)}</div>
                    </div>
                  </>
                ) : (
                  <p style={OV_EMPTY}>No trades declared.</p>
                )}
              </div>

              {/* Address */}
              <div style={OV_CARD}>
                <h3 style={OV_TITLE}>Address</h3>
                {(emp.address1 || emp.city || emp.state || emp.zip) ? (
                  <>
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>Address 1</div>
                      <div style={OV_VAL}>{emp.address1 || "\u2014"}</div>
                    </div>
                    {emp.address2 && (
                      <div style={OV_ROW}>
                        <div style={OV_LBL}>Address 2</div>
                        <div style={OV_VAL}>{emp.address2}</div>
                      </div>
                    )}
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>City</div>
                      <div style={OV_VAL}>{emp.city || "\u2014"}</div>
                    </div>
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>State</div>
                      <div style={OV_VAL}>{emp.state || "\u2014"}</div>
                    </div>
                    <div style={OV_ROW_LAST}>
                      <div style={OV_LBL}>Zip</div>
                      <div style={OV_VAL}>{emp.zip || "\u2014"}</div>
                    </div>
                  </>
                ) : (
                  <p style={OV_EMPTY}>No address on file.</p>
                )}
              </div>

              {/* Emergency Contact */}
              <div style={OV_CARD}>
                <h3 style={OV_TITLE}>Emergency Contact</h3>
                {hasEmergencyContact ? (
                  <>
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>Name</div>
                      <div style={OV_VAL}>{emp.emergencyContactName || "\u2014"}</div>
                    </div>
                    <div style={OV_ROW}>
                      <div style={OV_LBL}>Phone</div>
                      <div style={OV_VAL}>{emp.emergencyContactPhone || "\u2014"}</div>
                    </div>
                    <div style={OV_ROW_LAST}>
                      <div style={OV_LBL}>Relationship</div>
                      <div style={OV_VAL}>{emp.emergencyContactRelationship || "\u2014"}</div>
                    </div>
                  </>
                ) : (
                  <p style={OV_EMPTY}>No emergency contact on file.</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      /* ========== CERTIFICATIONS (LIVE from CandidateCertification) ========== */
      case "Certifications":
        return (
          <div>
            <div className="panel-header">
              <h2 className="panel-title">Certifications</h2>
              <span className="panel-note">Worker-held certifications</span>
            </div>
            {emp.certifications.length === 0 ? (
              <DownstreamTab label="No certifications on record for this worker." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Certification</th>
                      <th style={{ width: '12%' }}>Category</th>
                      <th style={{ width: '9%' }}>Status</th>
                      <th style={{ width: '11%' }}>Issued</th>
                      <th style={{ width: '11%' }}>Expires</th>
                      <th style={{ width: '14%' }}>Verification</th>
                      <th style={{ width: '9%' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.certifications.map((cc) => (
                      <tr key={cc.id}>
                        <td style={{ fontWeight: 500 }}>{cc.certTypeName}</td>
                        <td>{cc.categoryName || "\u2014"}</td>
                        <td><StatusBadge status={cc.status} /></td>
                        <td>{fmtDate(cc.issuedAt)}</td>
                        <td>{fmtDate(cc.expiresAt)}</td>
                        <td>{cc.verification}</td>
                        <td>{cc.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      /* ========== COMPLIANCE (LIVE) ========== */
      case "Compliance":
        return (
          <div>
            <div className="panel-header">
              <h2 className="panel-title">Compliance Records</h2>
              <span className="panel-note">Worker-owned compliance items</span>
              <button className="btn-primary" onClick={openAddCompliance}>+ Add Record</button>
            </div>
            {compLoading ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#6b7280" }}>Loading compliance records...</div>
            ) : compRecords.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#6b7280" }}>No compliance records yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th style={{ width: '12%' }}>Category</th>
                      <th style={{ width: '10%' }}>Variant</th>
                      <th style={{ width: '9%' }}>Status</th>
                      <th style={{ width: '11%' }}>Issue Date</th>
                      <th style={{ width: '11%' }}>Expiration</th>
                      <th style={{ width: '11%' }}>Issued By</th>
                      <th style={{ width: '10%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compRecords.map((rec) => (
                      <tr key={rec.id}>
                        <td style={{ fontWeight: 500 }}>{rec.requirementTypeName}</td>
                        <td>{rec.categoryName || "\u2014"}</td>
                        <td>{rec.variantName || "\u2014"}</td>
                        <td><StatusBadge status={rec.status} /></td>
                        <td>{fmtDate(rec.issueDate)}</td>
                        <td>{fmtDate(rec.expirationDate)}</td>
                        <td>{rec.issuedBy || "\u2014"}</td>
                        <td>
                          <span className="action-link" onClick={() => openEditCompliance(rec)}>Edit</span>
                          <span className="action-delete" onClick={() => deleteCompliance(rec.id)}>Delete</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      /* ========== TOOLS (LIVE from CandidateTool) ========== */
      case "Tools":
        return (
          <div>
            <div className="panel-header">
              <h2 className="panel-title">Tools</h2>
              <span className="panel-note">Worker-declared tools</span>
            </div>
            {emp.tools.length === 0 ? (
              <DownstreamTab label="No tools declared by this worker." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '12%' }}>Source</th>
                      <th style={{ width: '28%' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.tools.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500 }}>{t.toolTypeName}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>{t.source}</td>
                        <td>{t.notes || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      /* ========== PPE (LIVE from CandidatePpe) ========== */
      case "PPE":
        return (
          <div>
            <div className="panel-header">
              <h2 className="panel-title">PPE</h2>
              <span className="panel-note">Worker-declared PPE</span>
            </div>
            {emp.ppe.length === 0 ? (
              <DownstreamTab label="No PPE declared by this worker." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PPE Item</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '12%' }}>Source</th>
                      <th style={{ width: '28%' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.ppe.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.ppeTypeName}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>{p.source}</td>
                        <td>{p.notes || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      /* ========== JOB APPLICATION (LIVE from Application) ========== */
      case "Job Application":
        return (
          <div>
            <div className="panel-header">
              <h2 className="panel-title">Job Application</h2>
              <span className="panel-note">Candidate intake records</span>
            </div>
            {emp.applications.length === 0 ? (
              <DownstreamTab label="No application records for this worker." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>Application ID</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '14%' }}>Submitted</th>
                      <th style={{ width: '14%' }}>Reviewed</th>
                      <th>Review Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.applications.map((app) => (
                      <tr key={app.id}>
                        <td style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "12px" }}>{app.id.slice(0, 12)}</td>
                        <td><StatusBadge status={app.status} /></td>
                        <td>{fmtDate(app.submittedAt)}</td>
                        <td>{fmtDate(app.reviewedAt)}</td>
                        <td>{app.reviewNote || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      /* ========== DOWNSTREAM TABS (honest placeholders) ========== */
      case "Work History":
        return <div><div className="panel-header"><h2 className="panel-title">Work History</h2></div><DownstreamTab label="Work history is not connected yet. This tab will show MW4H assignment history and external work history once available." /></div>;
      case "Timesheets":
        return <div><div className="panel-header"><h2 className="panel-title">Timesheets</h2></div><DownstreamTab label="Timesheets are not connected yet. This tab will show hours entries once worker-scoped timesheet queries are available." /></div>;
      case "Payroll":
        return <div><div className="panel-header"><h2 className="panel-title">Payroll</h2></div><DownstreamTab label="Payroll visibility is not connected yet. This tab will show pay history once employee-scoped payroll queries are available." /></div>;
      case "Safety":
        return <div><div className="panel-header"><h2 className="panel-title">Safety</h2></div><DownstreamTab label="Safety module is not connected yet. No incident or medical screen management is available in this build." /></div>;
      case "Documents":
        return <div><div className="panel-header"><h2 className="panel-title">Documents</h2></div><DownstreamTab label="Document management is not connected yet. No document model or file upload system exists in this build." /></div>;
      case "Notes":
        return <div><div className="panel-header"><h2 className="panel-title">Notes</h2></div><DownstreamTab label="Internal notes are not connected yet. No Note model exists in this build." /></div>;
      default:
        return null;
    }
  }

  /* ---------- Render ---------- */
  return (
    <div className="detail-container">
      {/* HEADER */}
      <div className="detail-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => router.push("/employees")}>&larr; Back to Employees</button>
          <div className="header-title">
            <h1>{displayName || emp.email || `Candidate ${emp.id.slice(0, 8)}`}</h1>
            <span className="id-badge">{emp.id.slice(0, 12)}</span>
            <span className={`status-badge ${emp.status === "ACTIVE_SEEKING" ? "sb-active" : "sb-inactive"}`}>
              {emp.status === "ACTIVE_SEEKING" ? "Active" : "Not Active"}
            </span>
            {primaryTrade && <span className="trade-badge">{primaryTrade}</span>}
          </div>
        </div>
      </div>

      {/* SUMMARY ROW */}
      <div className="summary-row">
        <div className="summary-item">
          <span className="summary-label">NAME</span>
          <span className="summary-value" style={{ fontWeight: 600 }}>{displayName || "\u2014"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">EMAIL</span>
          <span className="summary-value" style={{ color: emp.email ? "#2563eb" : undefined }}>{emp.email || "\u2014"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">PHONE</span>
          <span className="summary-value">{emp.phone || "\u2014"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">PRIMARY TRADE</span>
          <span className="summary-value">{primaryTrade || "\u2014"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">STATUS</span>
          <span className="summary-value">{emp.status === "ACTIVE_SEEKING" ? "Active / Seeking" : "Not Active"}</span>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs-nav">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="tab-content">
        {renderTab()}
      </div>

      {/* COMPLIANCE MODAL */}
      {showCompModal && (
        <div className="modal-overlay" onClick={() => setShowCompModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingRecord ? "Edit Compliance Record" : "Add Compliance Record"}</h3>
            </div>
            <div className="modal-body">
              {compError && (
                <div style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontSize: "13px", marginBottom: "16px" }}>
                  {compError}
                </div>
              )}

              <div className="form-field">
                <label>Requirement Type *</label>
                <select
                  value={compForm.requirementTypeId}
                  onChange={(e) => setCompForm((f) => ({ ...f, requirementTypeId: e.target.value, variantId: "" }))}
                  disabled={!!editingRecord}
                >
                  <option value="">Select...</option>
                  {compReqTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>

              {variantsForType.length > 0 && (
                <div className="form-field">
                  <label>Variant</label>
                  <select
                    value={compForm.variantId}
                    onChange={(e) => setCompForm((f) => ({ ...f, variantId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {variantsForType.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-field">
                <label>Status *</label>
                <select
                  value={compForm.status}
                  onChange={(e) => setCompForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-field">
                  <label>Issue Date</label>
                  <input type="date" value={compForm.issueDate} onChange={(e) => setCompForm((f) => ({ ...f, issueDate: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Expiration Date</label>
                  <input type="date" value={compForm.expirationDate} onChange={(e) => setCompForm((f) => ({ ...f, expirationDate: e.target.value }))} />
                </div>
              </div>

              <div className="form-field">
                <label>Issued By</label>
                <input type="text" value={compForm.issuedBy} onChange={(e) => setCompForm((f) => ({ ...f, issuedBy: e.target.value }))} placeholder="e.g. LabCorp, DISA" />
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea rows={3} value={compForm.notes} onChange={(e) => setCompForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCompModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveCompliance} disabled={compSaving}>
                {compSaving ? "Saving..." : editingRecord ? "Save Changes" : "Add Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ============================================================
           JARVIS PRIME — INDUSTRIAL LIGHT V1
           Employee Profile Page
           Mirrors Customer Profile master page pattern
           ============================================================ */

        /* --- Page Shell --- */
        .detail-container {
          padding: 24px 40px 60px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8fafc;
          color: #111827;
          min-height: 100vh;
        }

        /* --- Page Header (mirrors customer .detail-header) --- */
        .detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }
        .header-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .back-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .header-title h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
        }
        .id-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #1d4ed8;
          font-family: var(--font-geist-mono), monospace;
          letter-spacing: 0.3px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #374151;
        }
        .sb-active {
          background: rgba(34, 197, 94, 0.08);
          color: #16a34a;
          border-color: rgba(34, 197, 94, 0.25);
        }
        .sb-inactive {
          background: rgba(107, 114, 128, 0.08);
          color: #6b7280;
          border-color: rgba(107, 114, 128, 0.25);
        }
        .trade-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #374151;
        }

        /* --- Summary Cards Row (individual cards, matches customer) --- */
        .summary-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }
        .summary-item {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .summary-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .summary-value {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          line-height: 1.4;
        }

        /* --- Tabs Navigation (pill tabs, matches customer) --- */
        .tabs-nav {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          white-space: nowrap;
        }
        .tab-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .tab-btn.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
        }

        /* --- Tab Content Panel --- */
        .tab-content {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 22px;
        }

        /* --- Panel Header (shared across all tabs) --- */
        .panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .panel-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          flex: 1;
        }
        .panel-note {
          font-size: 13px;
          color: #6b7280;
        }
        /* --- Tables --- */
        .table-wrap {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .data-table thead {
          background: #f1f5f9;
        }
        .data-table th {
          padding: 10px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #d1d5db;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .data-table td {
          padding: 12px 16px;
          font-size: 13px;
          color: #111827;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .data-table tr:last-child td {
          border-bottom: none;
        }
        .data-table tbody tr:hover td {
          background: #f9fafb;
        }
        .action-link {
          font-size: 13px;
          font-weight: 500;
          color: #2563eb;
          cursor: pointer;
          margin-right: 12px;
        }
        .action-link:hover {
          text-decoration: underline;
        }
        .action-delete {
          font-size: 13px;
          font-weight: 500;
          color: #dc2626;
          cursor: pointer;
        }
        .action-delete:hover {
          text-decoration: underline;
        }

        /* --- Buttons --- */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 16px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          background: #2563eb;
          border: none;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .btn-primary:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 16px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .btn-secondary:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }

        /* --- Modal --- */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }
        .modal-content {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          padding: 20px 24px 0;
        }
        .modal-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .modal-body {
          padding: 20px 24px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
        }

        /* --- Form Fields --- */
        .form-field {
          margin-bottom: 14px;
        }
        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 5px;
        }
        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          padding: 9px 11px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.12s ease;
          box-sizing: border-box;
        }
        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
        .form-field select:disabled {
          background: #f8fafc;
          color: #6b7280;
          cursor: not-allowed;
        }
        .form-field textarea {
          resize: vertical;
          min-height: 60px;
        }
      `}</style>
    </div>
  );
}
