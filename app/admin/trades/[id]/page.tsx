"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useParams } from "next/navigation";

interface Trade {
  id: string;
  name: string;
  wcClassCode: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Specialization {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  tradeId: string;
  createdAt: string;
  updatedAt: string;
}

interface SpecModalState {
  open: boolean;
  mode: "create" | "edit";
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY_SPEC_MODAL: SpecModalState = {
  open: false,
  mode: "create",
  name: "",
  description: "",
  isActive: true,
};

export default function TradeDetailPage() {
  const params = useParams();
  const tradeId = params.id as string;

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    type: "auth" | "notfound" | "other";
    message: string;
  } | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftWcClassCode, setDraftWcClassCode] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftIsActive, setDraftIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [baselineToolIds, setBaselineToolIds] = useState<string[]>([]);
  const [baselineTools, setBaselineTools] = useState<{ id: string; name: string }[]>([]);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState("");

  const [baselinePpeIds, setBaselinePpeIds] = useState<string[]>([]);
  const [baselinePpes, setBaselinePpes] = useState<{ id: string; name: string }[]>([]);
  const [ppeLoading, setPpeLoading] = useState(false);
  const [ppeError, setPpeError] = useState("");

  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsError, setSpecsError] = useState("");
  const [specModal, setSpecModal] = useState<SpecModalState>(EMPTY_SPEC_MODAL);
  const [specSaving, setSpecSaving] = useState(false);
  const [specSaveError, setSpecSaveError] = useState("");

  const syncDraft = (t: Trade) => {
    setDraftName(t.name);
    setDraftWcClassCode(t.wcClassCode);
    setDraftDescription(t.description ?? "");
    setDraftIsActive(t.isActive);
  };

  useEffect(() => {
    if (!tradeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<Trade>(`/trades/${tradeId}`);
        if (!cancelled) { setTrade(data); syncDraft(data); }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? String(e);
        if (msg.includes("no access token") || msg.includes("authentication") || msg.includes("401") || msg.includes("403")) {
          setError({ type: "auth", message: "Not authenticated. Please log in again." });
        } else if (msg.includes("404")) {
          setError({ type: "notfound", message: `Trade with ID "${tradeId}" not found.` });
        } else {
          setError({ type: "other", message: msg });
        }
        setTrade(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tradeId]);

  useEffect(() => {
    if (!tradeId || !trade) return;
    let cancelled = false;
    (async () => {
      setBaselineLoading(true);
      setBaselineError("");
      try {
        const baseline = await apiFetch<{ tradeId: string; toolIds: string[] }>(`/trades/${tradeId}/tools-baseline`);
        if (cancelled) return;
        const toolIds = baseline.toolIds ?? [];
        setBaselineToolIds(toolIds);
        const allTools = await apiFetch<{ id: string; name: string }[]>("/tools?activeOnly=true");
        if (cancelled) return;
        const idSet = new Set(toolIds);
        setBaselineTools((allTools ?? []).filter((t) => idSet.has(t.id)));
      } catch (e: any) {
        if (!cancelled) setBaselineError(e?.message ?? "Failed to load tool list.");
      } finally {
        if (!cancelled) setBaselineLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tradeId, trade]);

  useEffect(() => {
    if (!tradeId || !trade) return;
    let cancelled = false;
    (async () => {
      setPpeLoading(true);
      setPpeError("");
      try {
        const baseline = await apiFetch<{ tradeId: string; ppeTypeIds: string[] }>(`/trades/${tradeId}/ppe-baseline`);
        if (cancelled) return;
        const ppeTypeIds = baseline.ppeTypeIds ?? [];
        setBaselinePpeIds(ppeTypeIds);
        const allPpes = await apiFetch<{ id: string; name: string }[]>("/ppe-types?activeOnly=true");
        if (cancelled) return;
        const idSet = new Set(ppeTypeIds);
        setBaselinePpes((allPpes ?? []).filter((p) => idSet.has(p.id)));
      } catch (e: any) {
        if (!cancelled) setPpeError(e?.message ?? "Failed to load PPE list.");
      } finally {
        if (!cancelled) setPpeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tradeId, trade]);

  const loadSpecs = useCallback(async () => {
    if (!tradeId) return;
    setSpecsLoading(true);
    setSpecsError("");
    try {
      const data = await apiFetch<Specialization[]>(`/trades/${tradeId}/specializations`);
      setSpecs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setSpecsError(e?.message ?? "Failed to load specializations.");
    } finally {
      setSpecsLoading(false);
    }
  }, [tradeId]);

  useEffect(() => {
    if (trade) loadSpecs();
  }, [trade, loadSpecs]);

  const canSave = draftName.trim() !== "" && draftWcClassCode.trim() !== "" && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setSaveError("");
    try {
      const updated = await apiFetch<Trade>(`/trades/${tradeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draftName.trim(),
          wcClassCode: draftWcClassCode.trim(),
          description: draftDescription.trim() || null,
          isActive: draftIsActive,
        }),
      });
      setTrade(updated);
      syncDraft(updated);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save trade.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (trade) syncDraft(trade);
    setSaveError("");
  };

  const openCreateSpec = () => {
    setSpecSaveError("");
    setSpecModal({ open: true, mode: "create", name: "", description: "", isActive: true });
  };

  const openEditSpec = (s: Specialization) => {
    setSpecSaveError("");
    setSpecModal({
      open: true,
      mode: "edit",
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      isActive: s.isActive,
    });
  };

  const closeSpecModal = () => setSpecModal(EMPTY_SPEC_MODAL);

  const handleSpecSave = async () => {
    if (!specModal.name.trim()) return;
    setSpecSaving(true);
    setSpecSaveError("");
    try {
      if (specModal.mode === "create") {
        await apiFetch(`/trades/${tradeId}/specializations`, {
          method: "POST",
          body: JSON.stringify({
            name: specModal.name.trim(),
            description: specModal.description.trim() || null,
          }),
        });
      } else {
        await apiFetch(`/trades/${tradeId}/specializations/${specModal.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: specModal.name.trim(),
            description: specModal.description.trim() || null,
            isActive: specModal.isActive,
          }),
        });
      }
      closeSpecModal();
      await loadSpecs();
    } catch (e: any) {
      setSpecSaveError(e?.message ?? "Failed to save specialization.");
    } finally {
      setSpecSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "\u2014";
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
  };

  if (loading) {
    return (
      <div className="trade-detail-container">
        <div className="page-header">
          <Link href="/admin/trades" className="back-link">&larr; Back to Trades</Link>
          <h1>Loading&hellip;</h1>
        </div>
        <style jsx>{detailStyles}</style>
      </div>
    );
  }

  if (error) {
    const title = error.type === "auth" ? "Authentication Required" : error.type === "notfound" ? "Trade Not Found" : "Error";
    return (
      <div className="trade-detail-container">
        <div className="page-header">
          <Link href="/admin/trades" className="back-link">&larr; Back to Trades</Link>
          <h1>{title}</h1>
          <p className="subtitle">{error.message}</p>
          {error.type === "auth" && <Link href="/auth/login" className="login-link">Go to Login</Link>}
        </div>
        <style jsx>{detailStyles}</style>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="trade-detail-container">
        <div className="page-header">
          <Link href="/admin/trades" className="back-link">&larr; Back to Trades</Link>
          <h1>Trade Not Found</h1>
          <p className="subtitle">The trade with ID &quot;{tradeId}&quot; could not be found.</p>
        </div>
        <style jsx>{detailStyles}</style>
      </div>
    );
  }

  return (
    <div className="trade-detail-container">
      <div className="page-header">
        <Link href="/admin/trades" className="back-link">&larr; Back to Trades</Link>
        <h1>{trade.name}</h1>
        <p className="subtitle">View and edit trade details</p>
      </div>

      {saveError && <div className="error-banner">{saveError}</div>}

      {/* Trade Details Card */}
      <div className="detail-card">
        <div className="card-header"><h2>Trade Details</h2></div>
        <div className="card-body">
          <div className="info-row">
            <span className="info-label">Trade Name <span className="required">*</span></span>
            <input type="text" className="edit-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Trade name" />
          </div>
          <div className="info-row">
            <span className="info-label">WC Class Code <span className="required">*</span></span>
            <input type="text" className="edit-input mono" value={draftWcClassCode} onChange={(e) => setDraftWcClassCode(e.target.value)} placeholder="e.g., 5183" />
          </div>
          <div className="info-row">
            <span className="info-label">Status</span>
            <span className="toggle-value">
              <label className="toggle">
                <input type="checkbox" checked={draftIsActive} onChange={() => setDraftIsActive(!draftIsActive)} />
                <span className="toggle-slider"></span>
              </label>
              <span className="status-badge" style={{
                backgroundColor: draftIsActive ? "rgba(34, 197, 94, 0.12)" : "rgba(107, 114, 128, 0.12)",
                color: draftIsActive ? "#22c55e" : "#6b7280",
                borderColor: draftIsActive ? "rgba(34, 197, 94, 0.25)" : "rgba(107, 114, 128, 0.25)",
              }}>{draftIsActive ? "Active" : "Inactive"}</span>
            </span>
          </div>
          <div className="info-row desc-row">
            <span className="info-label">Description</span>
            <textarea className="edit-textarea" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} placeholder="Optional description" rows={3} />
          </div>
          <div className="audit-section">
            <div className="audit-title">Audit Information</div>
            <div className="audit-grid">
              <div className="audit-item">
                <span className="audit-label">Created</span>
                <span className="audit-value">{formatDate(trade.createdAt)}</span>
              </div>
              <div className="audit-item">
                <span className="audit-label">Updated</span>
                <span className="audit-value">{formatDate(trade.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <div />
        <div className="action-buttons">
          <button type="button" className="reset-btn" onClick={handleReset}>Reset</button>
          <button type="button" className="save-btn" onClick={handleSave} disabled={!canSave}>
            {submitting ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Specializations Card */}
      <div className="detail-card">
        <div className="card-header spec-header">
          <h2>Specializations</h2>
          <button type="button" className="btn-add-sm" onClick={openCreateSpec}>+ Add Specialization</button>
        </div>
        <div className="card-body spec-body">
          {specsLoading && <div className="empty-state">Loading specializations…</div>}
          {!specsLoading && specsError && <div className="baseline-error">{specsError}</div>}
          {!specsLoading && !specsError && specs.length === 0 && (
            <div className="empty-state">No specializations yet. Click &ldquo;+ Add Specialization&rdquo; to create one.</div>
          )}
          {!specsLoading && !specsError && specs.length > 0 && (
            <table className="specs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {specs.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-name">{s.name}</td>
                    <td className="cell-desc">{s.description || "—"}</td>
                    <td>
                      <span className="status-badge" style={{
                        backgroundColor: s.isActive ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)",
                        color: s.isActive ? "#22c55e" : "#6b7280",
                        borderColor: s.isActive ? "rgba(34,197,94,0.25)" : "rgba(107,114,128,0.25)",
                      }}>{s.isActive ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="cell-actions">
                      <button type="button" className="action-btn" onClick={() => openEditSpec(s)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MW4H Minimal Tool List */}
      <div className="detail-card tool-list-card">
        <div className="card-header"><h2>MW4H Minimal Tool List</h2></div>
        <div className="card-body">
          <p className="baseline-summary">{baselineToolIds.length} selected</p>
          {baselineLoading && <div className="empty-state">Loading tool list…</div>}
          {!baselineLoading && baselineError && <div className="baseline-error">{baselineError}</div>}
          {!baselineLoading && !baselineError && baselineTools.length > 0 && (
            <ul className="baseline-preview">
              {baselineTools.slice(0, 12).map((t) => (<li key={t.id}>{t.name}</li>))}
            </ul>
          )}
          {!baselineLoading && !baselineError && baselineTools.length > 12 && (
            <p className="baseline-more">+{baselineTools.length - 12} more</p>
          )}
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link href={`/admin/trades/${tradeId}/tools`} className="tools-link">Go to Tools Template &rarr;</Link>
          </div>
        </div>
      </div>

      {/* MW4H Minimal PPE List */}
      <div className="detail-card tool-list-card">
        <div className="card-header"><h2>MW4H Minimal PPE List</h2></div>
        <div className="card-body">
          <p className="baseline-summary">{baselinePpeIds.length} selected</p>
          {ppeLoading && <div className="empty-state">Loading PPE list…</div>}
          {!ppeLoading && ppeError && <div className="baseline-error">{ppeError}</div>}
          {!ppeLoading && !ppeError && baselinePpes.length > 0 && (
            <ul className="baseline-preview">
              {baselinePpes.slice(0, 12).map((p) => (<li key={p.id}>{p.name}</li>))}
            </ul>
          )}
          {!ppeLoading && !ppeError && baselinePpes.length > 12 && (
            <p className="baseline-more">+{baselinePpes.length - 12} more</p>
          )}
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link href={`/admin/trades/${tradeId}/ppe`} className="tools-link">Go to PPE Template &rarr;</Link>
          </div>
        </div>
      </div>

      {/* Specialization Create/Edit Modal */}
      {specModal.open && (
        <div className="modal-overlay" onClick={closeSpecModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{specModal.mode === "create" ? "Add Specialization" : "Edit Specialization"}</h2>
              <button className="modal-close" onClick={closeSpecModal}>&times;</button>
            </div>
            <div className="modal-body">
              {specSaveError && <div className="error-banner" style={{ marginBottom: 16 }}>{specSaveError}</div>}
              <div className="form-field">
                <label>Name <span className="required">*</span></label>
                <input type="text" value={specModal.name} onChange={(e) => setSpecModal((m) => ({ ...m, name: e.target.value }))} placeholder="Specialization name" />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={specModal.description} onChange={(e) => setSpecModal((m) => ({ ...m, description: e.target.value }))} placeholder="Optional description" rows={3} />
              </div>
              {specModal.mode === "edit" && (
                <div className="form-field">
                  <label>Active</label>
                  <div className="toggle-group">
                    <button type="button" className={`toggle-btn ${specModal.isActive ? "active" : ""}`} onClick={() => setSpecModal((m) => ({ ...m, isActive: true }))}>Active</button>
                    <button type="button" className={`toggle-btn ${!specModal.isActive ? "active" : ""}`} onClick={() => setSpecModal((m) => ({ ...m, isActive: false }))}>Inactive</button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={closeSpecModal}>Cancel</button>
              <button type="button" className="btn-save" onClick={handleSpecSave} disabled={!specModal.name.trim() || specSaving}>
                {specSaving ? "Saving\u2026" : specModal.mode === "create" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{detailStyles}</style>
    </div>
  );
}

const detailStyles = `
  .trade-detail-container {
    padding: 24px 40px 60px;
    max-width: 900px;
    margin: 0 auto;
  }
  .page-header { margin-bottom: 24px; }
  .back-link {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    transition: color 0.15s ease;
    display: inline-block;
    margin-bottom: 12px;
  }
  .back-link:hover { color: #3b82f6; }
  h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.5px; }
  .subtitle { font-size: 14px; color: rgba(255, 255, 255, 0.55); margin: 0; }
  .login-link {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 20px;
    background: #3b82f6;
    color: #fff;
    border-radius: 6px;
    text-decoration: none;
    font-size: 14px;
  }
  .login-link:hover { background: #2563eb; }
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 13px;
    color: #ef4444;
    margin-bottom: 20px;
  }

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
  .card-header h2 { font-size: 16px; font-weight: 600; color: #fff; margin: 0; }
  .card-body { padding: 20px; }

  .spec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .btn-add-sm {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-add-sm:hover { background: #2563eb; }
  .spec-body { padding: 0; }

  .specs-table { width: 100%; border-collapse: collapse; }
  .specs-table thead { background: rgba(255, 255, 255, 0.03); }
  .specs-table th {
    padding: 12px 20px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .specs-table td {
    padding: 12px 20px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .specs-table tr:last-child td { border-bottom: none; }
  .specs-table tbody tr:hover { background: rgba(59, 130, 246, 0.04); }
  .cell-name { font-weight: 500; color: #fff !important; }
  .cell-desc {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.55) !important;
    max-width: 240px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell-actions { white-space: nowrap; text-align: right; }
  .action-btn {
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .action-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .info-row:last-child { border-bottom: none; }
  .info-row.desc-row { flex-direction: column; align-items: stretch; gap: 8px; }
  .info-label { font-size: 12px; color: rgba(255, 255, 255, 0.5); flex-shrink: 0; margin-right: 16px; }
  .required { color: #ef4444; }

  .edit-input {
    padding: 6px 10px;
    font-size: 13px;
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    transition: border-color 0.15s ease;
    text-align: right;
    max-width: 260px;
    width: 100%;
  }
  .edit-input.mono { font-family: var(--font-geist-mono), monospace; }
  .edit-input:focus { outline: none; border-color: #3b82f6; }
  .edit-textarea {
    padding: 8px 10px;
    font-size: 13px;
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    transition: border-color 0.15s ease;
    resize: vertical;
    min-height: 60px;
    width: 100%;
  }
  .edit-textarea:focus { outline: none; border-color: #3b82f6; }
  .edit-textarea::placeholder, .edit-input::placeholder { color: rgba(255, 255, 255, 0.3); }

  .toggle-value { display: flex; align-items: center; gap: 10px; }
  .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255, 255, 255, 0.1); border-radius: 24px; transition: 0.2s;
  }
  .toggle-slider:before {
    position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
    background: #fff; border-radius: 50%; transition: 0.2s;
  }
  .toggle input:checked + .toggle-slider { background: #22c55e; }
  .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }
  .status-badge {
    display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600;
    border-radius: 4px; border: 1px solid;
  }

  .audit-section {
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    margin-top: 16px;
  }
  .audit-title {
    font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 14px;
  }
  .audit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .audit-item { display: flex; flex-direction: column; gap: 4px; }
  .audit-label { font-size: 10px; color: rgba(255, 255, 255, 0.4); }
  .audit-value { font-size: 12px; color: rgba(255, 255, 255, 0.8); }

  .form-actions {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 4px; padding-bottom: 28px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .action-buttons { display: flex; gap: 12px; }
  .reset-btn {
    padding: 10px 20px; font-size: 14px; font-weight: 500;
    color: rgba(255, 255, 255, 0.7); background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px;
    cursor: pointer; transition: all 0.15s ease;
  }
  .reset-btn:hover { color: #fff; border-color: rgba(255, 255, 255, 0.3); }
  .save-btn {
    padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff;
    background: #3b82f6; border: none; border-radius: 8px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .save-btn:hover:not(:disabled) { background: #2563eb; }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .tool-list-card { margin-top: 0; }
  .empty-state {
    padding: 16px 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    font-style: italic;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    margin: 20px;
  }
  .tools-link { font-size: 13px; color: #3b82f6; text-decoration: none; }
  .tools-link:hover { text-decoration: underline; }
  .baseline-summary { font-size: 13px; color: rgba(255, 255, 255, 0.7); margin: 0 0 12px; }
  .baseline-error { font-size: 13px; color: #ef4444; margin-bottom: 12px; }
  .baseline-preview { font-size: 13px; color: rgba(255, 255, 255, 0.8); margin: 0 0 4px; padding-left: 20px; }
  .baseline-preview li { margin-bottom: 4px; }
  .baseline-more { font-size: 12px; color: rgba(255, 255, 255, 0.5); margin: 0 0 12px; }

  .modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
  }
  .modal {
    width: 520px; max-width: 90%; max-height: 90vh;
    background: #12151b; border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px; display: flex; flex-direction: column;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .modal-header h2 { font-size: 18px; font-weight: 600; color: #fff; margin: 0; }
  .modal-close {
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    font-size: 24px; color: rgba(255, 255, 255, 0.5); background: transparent;
    border: none; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;
  }
  .modal-close:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
  .modal-body { flex: 1; overflow-y: auto; padding: 24px; }
  .form-field { margin-bottom: 20px; }
  .form-field label { display: block; font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px; }
  .form-field input,
  .form-field select,
  .form-field textarea {
    width: 100%; padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px; font-size: 14px; color: #fff;
  }
  .form-field input:focus,
  .form-field select:focus,
  .form-field textarea:focus { outline: none; border-color: #3b82f6; }
  .form-field input::placeholder,
  .form-field textarea::placeholder { color: rgba(255, 255, 255, 0.3); }
  .form-field select option { background: #1a1d24; color: #fff; }
  .form-field textarea { resize: vertical; min-height: 60px; }

  .toggle-group {
    display: flex; gap: 0;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px; overflow: hidden;
  }
  .toggle-btn {
    flex: 1; padding: 10px 16px; font-size: 13px; font-weight: 500;
    color: rgba(255, 255, 255, 0.5); background: transparent;
    border: none; cursor: pointer; transition: all 0.15s ease;
  }
  .toggle-btn:first-child { border-right: 1px solid rgba(255, 255, 255, 0.1); }
  .toggle-btn:hover { color: rgba(255, 255, 255, 0.8); }
  .toggle-btn.active { color: #fff; background: rgba(34, 197, 94, 0.15); }

  .modal-footer {
    display: flex; justify-content: flex-end; gap: 12px;
    padding: 16px 24px; border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .btn-cancel {
    padding: 10px 20px; font-size: 14px; font-weight: 500;
    color: rgba(255, 255, 255, 0.7); background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;
    cursor: pointer; transition: all 0.15s ease;
  }
  .btn-cancel:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
  .btn-save {
    padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff;
    background: #3b82f6; border: none; border-radius: 8px;
    cursor: pointer; transition: all 0.15s ease;
  }
  .btn-save:hover:not(:disabled) { background: #2563eb; }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
`;
