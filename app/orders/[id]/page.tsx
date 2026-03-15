"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { OrderDetailResponse, OrderTradeRequirementResponse } from "@/lib/types/order";
import { ENFORCEMENT_LABELS, type RequirementEnforcement } from "@/lib/types/order";
import { getOrderPhase, getPhaseLabel, getPhaseBadgeClass, PHASE_BADGE_STYLES, type OrderPhase } from "@/lib/order-lifecycle";

export type OrderDetailMode = "edit" | "view";

type TabKey = "overview" | "changeOrders" | "invoices";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "changeOrders", label: "Change Orders" },
  { key: "invoices", label: "Invoices" },
];

interface OrderDetailProps {
  mode?: OrderDetailMode;
  backTo?: "orders" | "customer";
  customerId?: string | null;
}

const enfLabel = (val: string) =>
  ENFORCEMENT_LABELS[val as RequirementEnforcement] ?? val;

export function OrderDetail({ mode = "edit", backTo = "orders", customerId = null }: OrderDetailProps) {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingLocCode, setEditingLocCode] = useState(false);
  const [locCodeDraft, setLocCodeDraft] = useState("");
  const [locCodeSaving, setLocCodeSaving] = useState(false);

  const phase: OrderPhase = order ? getOrderPhase(order.status) : "DRAFT";
  const approvalStatus = order?.approvalStatus;
  const isReadOnly = mode === "view" || phase === "COMPLETED" || phase === "CANCELLED";
  const isPendingApproval = phase === "DRAFT" && approvalStatus === "PENDING";
  const isRejected = phase === "DRAFT" && approvalStatus === "REJECTED";

  async function loadOrder() {
    try {
      const data = await apiFetch<OrderDetailResponse>(`/orders/${orderId}`);
      setOrder(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    loadOrder().then(() => { if (!alive) return; });
    return () => { alive = false; };
  }, [orderId]);

  const [approvalRouting, setApprovalRouting] = useState<any>(null);

  async function handleLifecycleAction(action: "activate" | "complete" | "cancel") {
    if (actionLoading) return;
    if (action === "cancel" && !window.confirm("Are you sure you want to cancel this order?")) return;
    if (action === "complete" && !window.confirm("Mark this order as completed?")) return;

    setActionLoading(true);
    setActionError(null);
    setApprovalRouting(null);
    try {
      const result = await apiFetch<any>(`/orders/${orderId}/${action}`, { method: "POST" });
      if (result?.approvalRequired) {
        setApprovalRouting(result.routingOutcome ?? null);
      }
      await loadOrder();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} order`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproval(action: "approve" | "reject") {
    if (actionLoading) return;

    if (action === "reject") {
      const reason = window.prompt("Rejection reason (required):");
      if (!reason) return;
      setActionLoading(true);
      setActionError(null);
      try {
        await apiFetch(`/orders/${orderId}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        await loadOrder();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Failed to reject order");
      } finally {
        setActionLoading(false);
      }
      return;
    }

    const note = window.prompt("Approval note (optional):");
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/orders/${orderId}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: note || undefined }),
      });
      await loadOrder();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to approve order");
    } finally {
      setActionLoading(false);
    }
  }

  const handleBack = () => {
    if (backTo === "customer" && customerId) {
      router.push(`/customers/${customerId}`);
    } else {
      router.push("/orders");
    }
  };

  const backButtonText = backTo === "customer" ? "← Back to Customer" : "← Back to Orders";

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  if (loading) {
    return (
      <div className="order-detail-page">
        <div className="order-detail-container">
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading order...</p>
        </div>
        <style jsx>{`${baseStyles}`}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-detail-page">
        <div className="order-detail-container">
          <button className="back-btn" onClick={handleBack}>{backButtonText}</button>
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: "0 0 12px" }}>Order Not Found</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 24px" }}>{error || "Could not load order."}</p>
          </div>
        </div>
        <style jsx>{`${baseStyles}`}</style>
      </div>
    );
  }

  const totalRequestedHeadcount = order.tradeRequirements.reduce((s, tr) => s + (tr.requestedHeadcount ?? 0), 0);

  return (
    <div className="order-detail-page">
      <div className="order-detail-container">
        {/* Header */}
        <div className="detail-header">
          <div className="header-left">
            <button className="back-btn" onClick={handleBack}>{backButtonText}</button>
            <div className="header-title">
              <h1>{order.title || "Untitled Order"}</h1>
              <div className="header-meta">
                <span className={`phase-badge ${getPhaseBadgeClass(phase, approvalStatus)}`}>{getPhaseLabel(phase, approvalStatus)}</span>
                {isReadOnly && phase !== "COMPLETED" && phase !== "CANCELLED" && (
                  <span className="read-only-indicator">Read-Only View</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Approval Banner */}
        {isPendingApproval && (
          <div className="approval-banner approval-banner-pending">
            <div className="approval-banner-text">
              <strong>Pending Approval</strong> — One or more trade lines have gross margin below the approval threshold. Manager or owner approval is required.
            </div>
            {approvalRouting?.failingTrades && approvalRouting.failingTrades.length > 0 && (
              <div className="approval-failing-trades">
                {approvalRouting.failingTrades.map((t: any) => (
                  <span key={t.tradeRequirementId} className="failing-trade-tag">
                    {t.tradeName}: {t.grossMarginPct}% GM
                  </span>
                ))}
                <span className="threshold-note">Threshold: {approvalRouting.thresholdUsed}%</span>
              </div>
            )}
          </div>
        )}
        {isRejected && (
          <div className="approval-banner approval-banner-rejected">
            <div className="approval-banner-text">
              <strong>Approval Rejected</strong>{order?.approvalNote ? ` — ${order.approvalNote}` : ""}
            </div>
            <div className="approval-banner-sub">
              Edit trade rates and re-attempt activation.
            </div>
          </div>
        )}

        {/* Lifecycle Action Bar */}
        <div className="lifecycle-bar">
          {actionError && <div className="lifecycle-error">{actionError}</div>}
          {phase === "DRAFT" && !isPendingApproval && (
            <button
              className="lifecycle-btn lifecycle-activate"
              onClick={() => handleLifecycleAction("activate")}
              disabled={actionLoading}
            >
              {actionLoading ? "Activating..." : "Activate Order"}
            </button>
          )}
          {isPendingApproval && (
            <>
              <button
                className="lifecycle-btn lifecycle-approve"
                onClick={() => handleApproval("approve")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Approve Order"}
              </button>
              <button
                className="lifecycle-btn lifecycle-reject"
                onClick={() => handleApproval("reject")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Reject"}
              </button>
            </>
          )}
          {isRejected && (
            <button
              className="lifecycle-btn lifecycle-activate"
              onClick={() => handleLifecycleAction("activate")}
              disabled={actionLoading}
            >
              {actionLoading ? "Activating..." : "Re-submit for Activation"}
            </button>
          )}
          {phase === "ACTIVE" && (
            <>
              <button
                className="lifecycle-btn lifecycle-complete"
                onClick={() => handleLifecycleAction("complete")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Complete Order"}
              </button>
              <button
                className="lifecycle-btn lifecycle-cancel"
                onClick={() => handleLifecycleAction("cancel")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Cancel Order"}
              </button>
            </>
          )}
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? "tab-btn-active" : ""}`}
              onClick={() => {
                if (tab.key === "invoices") {
                  let url = `/invoices?orderId=${orderId}`;
                  if (customerId) url += `&customerId=${customerId}`;
                  router.push(url);
                  return;
                }
                setActiveTab(tab.key);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="detail-grid">
            <section className="detail-section summary-section">
              <h2>Order Summary</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Customer</span>
                  <span className="value">{order.customer?.name ?? order.customerId}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Status</span>
                  <span className="value">{getPhaseLabel(phase)}</span>
                </div>
                <div className="summary-item">
                  <span className="label">SD Pay Delta</span>
                  <span className="value">{order.sdPayDeltaRate != null ? `$${order.sdPayDeltaRate}/hr` : "—"}</span>
                </div>
                <div className="summary-item">
                  <span className="label">SD Bill Delta</span>
                  <span className="value">{order.sdBillDeltaRate != null ? `$${order.sdBillDeltaRate}/hr` : "—"}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Commission Plan</span>
                  <span className="value">{order.commissionPlan?.name ?? "Global Default"}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Created</span>
                  <span className="value">{fmtDate(order.createdAt)}</span>
                </div>
              </div>
            </section>

            {(order.jobSiteName || order.jobSiteAddress1 || order.jobSiteCity) ? (
              <section className="detail-section">
                <h2>Job Site</h2>
                {order.jobSiteName && <div className="site-name">{order.jobSiteName}</div>}
                <div className="site-address">
                  {order.jobSiteAddress1 && <div>{order.jobSiteAddress1}</div>}
                  {order.jobSiteAddress2 && <div>{order.jobSiteAddress2}</div>}
                  {(order.jobSiteCity || order.jobSiteState || order.jobSiteZip) && (
                    <div>{[order.jobSiteCity, order.jobSiteState].filter(Boolean).join(", ")}{order.jobSiteZip ? ` ${order.jobSiteZip}` : ""}</div>
                  )}
                </div>
                {order.jobSiteNotes && <div className="site-notes">{order.jobSiteNotes}</div>}

                <div className="loc-code-section">
                  <span className="loc-code-label">Insurance Location ID</span>
                  {!editingLocCode ? (
                    <div className="loc-code-display">
                      <span className={order.jobLocationCode ? "loc-code-value" : "loc-code-empty"}>
                        {order.jobLocationCode || "Not assigned"}
                      </span>
                      <button className="loc-code-edit-btn" onClick={() => {
                        setLocCodeDraft(order.jobLocationCode || "");
                        setEditingLocCode(true);
                      }}>
                        {order.jobLocationCode ? "Edit" : "Assign"}
                      </button>
                    </div>
                  ) : (
                    <div className="loc-code-edit">
                      <input type="text" className="loc-code-input" value={locCodeDraft}
                        onChange={(e) => setLocCodeDraft(e.target.value)}
                        placeholder="Enter location code" autoFocus />
                      <button className="loc-code-save-btn" disabled={locCodeSaving} onClick={async () => {
                        setLocCodeSaving(true);
                        try {
                          await apiFetch(`/orders/${orderId}`, {
                            method: "PATCH",
                            body: JSON.stringify({ jobLocationCode: locCodeDraft || null }),
                          });
                          await loadOrder();
                          setEditingLocCode(false);
                        } catch {} finally {
                          setLocCodeSaving(false);
                        }
                      }}>
                        {locCodeSaving ? "Saving..." : "Save"}
                      </button>
                      <button className="loc-code-cancel-btn" onClick={() => setEditingLocCode(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="detail-section">
                <h2>Job Site</h2>
                <p className="placeholder-text">No job site specified</p>
                <div className="loc-code-section">
                  <span className="loc-code-label">Insurance Location ID</span>
                  {!editingLocCode ? (
                    <div className="loc-code-display">
                      <span className={order.jobLocationCode ? "loc-code-value" : "loc-code-empty"}>
                        {order.jobLocationCode || "Not assigned"}
                      </span>
                      <button className="loc-code-edit-btn" onClick={() => {
                        setLocCodeDraft(order.jobLocationCode || "");
                        setEditingLocCode(true);
                      }}>
                        {order.jobLocationCode ? "Edit" : "Assign"}
                      </button>
                    </div>
                  ) : (
                    <div className="loc-code-edit">
                      <input type="text" className="loc-code-input" value={locCodeDraft}
                        onChange={(e) => setLocCodeDraft(e.target.value)}
                        placeholder="Enter location code" autoFocus />
                      <button className="loc-code-save-btn" disabled={locCodeSaving} onClick={async () => {
                        setLocCodeSaving(true);
                        try {
                          await apiFetch(`/orders/${orderId}`, {
                            method: "PATCH",
                            body: JSON.stringify({ jobLocationCode: locCodeDraft || null }),
                          });
                          await loadOrder();
                          setEditingLocCode(false);
                        } catch {} finally {
                          setLocCodeSaving(false);
                        }
                      }}>
                        {locCodeSaving ? "Saving..." : "Save"}
                      </button>
                      <button className="loc-code-cancel-btn" onClick={() => setEditingLocCode(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="detail-section">
              <h2>Job Contacts</h2>
              {order.jobOrderContacts && order.jobOrderContacts.length > 0 ? (
                <div className="joc-list">
                  {order.jobOrderContacts.map((joc) => (
                    <div key={joc.id} className="joc-row">
                      <span className="joc-name">{joc.contactName}</span>
                      <span className="joc-role">{joc.role.replace(/_/g, " ")}</span>
                      {joc.isPrimary && <span className="joc-primary">Primary</span>}
                    </div>
                  ))}
                </div>
              ) : order.primaryCustomerContact ? (
                <div className="joc-list">
                  <div className="joc-row">
                    <span className="joc-name">{order.primaryCustomerContact.firstName} {order.primaryCustomerContact.lastName}</span>
                    <span className="joc-role">Primary Contact</span>
                    <span className="joc-primary">Primary</span>
                  </div>
                </div>
              ) : (
                <p className="placeholder-text">No contacts assigned</p>
              )}
            </section>

            <section className="detail-section full-span">
              <h2>Trade Requirements ({order.tradeRequirements.length})</h2>
              <div className="trades-overview">
                <div className="trades-stat">
                  <span className="stat-value">{totalRequestedHeadcount}</span>
                  <span className="stat-label">Total Requested</span>
                </div>
              </div>
              {order.tradeRequirements.map((tr) => (
                <TradeRequirementBlock key={tr.id} tr={tr} fmtDate={fmtDate} />
              ))}
            </section>

            <section className="detail-section placeholder-section">
              <h2>Dispatch Readiness</h2>
              <p className="placeholder-text">Dispatch readiness will be available in a future phase.</p>
            </section>
            <section className="detail-section placeholder-section">
              <h2>Activity Log</h2>
              <p className="placeholder-text">Activity log will be available in a future phase.</p>
            </section>
          </div>
        )}

        {activeTab === "changeOrders" && (
          <div className="detail-section full-span">
            <h2>Change Orders</h2>
            <p className="placeholder-text">
              Change order management is a deferred system and will be wired in a future phase.
            </p>
          </div>
        )}
      </div>
      <style jsx>{`${baseStyles}`}</style>
    </div>
  );
}

function TradeRequirementBlock({
  tr,
  fmtDate,
}: {
  tr: OrderTradeRequirementResponse;
  fmtDate: (d: string | null) => string;
}) {
  return (
    <div className="tr-block">
      <div className="tr-block-header">
        <span className="tr-name">{tr.trade?.name ?? tr.tradeId}</span>
        <span className="tr-hc">{tr.requestedHeadcount ?? "—"} workers</span>
      </div>
      <div className="tr-block-fields">
        <div className="tr-f"><span className="tr-fl">Base Pay</span><span className="tr-fv">{tr.basePayRate != null ? `$${tr.basePayRate}` : "—"}</span></div>
        <div className="tr-f"><span className="tr-fl">Base Bill</span><span className="tr-fv">{tr.baseBillRate != null ? `$${tr.baseBillRate}` : "—"}</span></div>
        <div className="tr-f"><span className="tr-fl">Start</span><span className="tr-fv">{fmtDate(tr.startDate)}</span></div>
        <div className="tr-f"><span className="tr-fl">End</span><span className="tr-fv">{fmtDate(tr.expectedEndDate)}</span></div>
      </div>
      {tr.notes && <p className="tr-notes">{tr.notes}</p>}
      <EnfReqTags label="PPE" items={tr.ppeRequirements.map((r) => ({
        name: r.ppeType?.name ?? r.ppeTypeId, enforcement: r.enforcement,
      }))} />
      <EnfReqTags label="Tools" items={tr.toolRequirements.map((r) => ({
        name: r.tool?.name ?? r.toolId, enforcement: r.enforcement,
      }))} />
      <EnfReqTags label="Certs" items={tr.certRequirements.map((r) => ({
        name: r.certType?.name ?? r.certTypeId, enforcement: r.enforcement,
      }))} />
      <ReqTags
        label="Compliance"
        items={tr.complianceRequirements.map((r) => {
          const n = r.requirementType?.name ?? r.requirementTypeId;
          return r.variant?.name ? `${n} — ${r.variant.name}` : n;
        })}
      />
      <style jsx>{`
        .tr-block { margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; }
        .tr-block:last-child { margin-bottom: 0; }
        .tr-block-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .tr-name { font-size: 15px; font-weight: 600; color: #fff; }
        .tr-hc { font-size: 12px; color: rgba(255,255,255,0.6); font-family: var(--font-geist-mono), monospace; }
        .tr-block-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
        .tr-f { display: flex; flex-direction: column; gap: 2px; }
        .tr-fl { font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.4px; }
        .tr-fv { font-size: 13px; color: rgba(255,255,255,0.85); font-family: var(--font-geist-mono), monospace; }
        .tr-notes { font-size: 12px; color: rgba(255,255,255,0.6); margin: 4px 0 0; font-style: italic; }
      `}</style>
    </div>
  );
}

function EnfReqTags({ label, items }: { label: string; items: Array<{ name: string; enforcement: string }> }) {
  if (items.length === 0) return null;
  return (
    <div className="ert-wrap">
      <span className="ert-label">{label}:</span>
      <div className="ert-tags">
        {items.map((item, i) => (
          <span key={i} className={`ert-tag ${item.enforcement === "FILTER" ? "ert-filter" : "ert-flag"}`}>
            {item.name}
            <span className="ert-enf">{enfLabel(item.enforcement)}</span>
          </span>
        ))}
      </div>
      <style jsx>{`
        .ert-wrap { margin-top: 8px; display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .ert-label { font-size: 10px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; padding-top: 4px; min-width: 80px; }
        .ert-tags { display: flex; flex-wrap: wrap; gap: 4px; }
        .ert-tag { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; font-size: 11px; color: rgba(255,255,255,0.8); border-radius: 4px; }
        .ert-filter { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
        .ert-flag { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); }
        .ert-enf { font-size: 9px; font-weight: 600; text-transform: uppercase; opacity: 0.7; }
      `}</style>
    </div>
  );
}

function ReqTags({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rt-wrap">
      <span className="rt-label">{label}:</span>
      <div className="rt-tags">
        {items.map((n, i) => (
          <span key={i} className="rt-tag">{n}</span>
        ))}
      </div>
      <style jsx>{`
        .rt-wrap { margin-top: 8px; display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .rt-label { font-size: 10px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; padding-top: 4px; min-width: 80px; }
        .rt-tags { display: flex; flex-wrap: wrap; gap: 4px; }
        .rt-tag { padding: 3px 8px; font-size: 11px; color: rgba(255,255,255,0.8); background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}

export default function OrderDetailPage() {
  return <OrderDetail mode="edit" backTo="orders" />;
}

const baseStyles = `
  .order-detail-page { min-height: 100vh; background: linear-gradient(180deg, #0c0f14 0%, #111827 100%); }
  .order-detail-container { padding: 24px 40px 60px; max-width: 1200px; margin: 0 auto; }

  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
  .header-left { display: flex; flex-direction: column; gap: 12px; }
  .back-btn { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; padding: 0; transition: color 0.15s ease; }
  .back-btn:hover { color: #3b82f6; }
  .header-title { display: flex; flex-direction: column; gap: 8px; }
  .header-title h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0; letter-spacing: -0.5px; }
  .header-meta { display: flex; align-items: center; gap: 10px; }

  ${PHASE_BADGE_STYLES}

  .read-only-indicator { padding: 4px 12px; font-size: 11px; font-weight: 500; border-radius: 6px; background: rgba(148,163,184,0.15); color: rgba(148,163,184,0.8); border: 1px dashed rgba(148,163,184,0.3); }

  .lifecycle-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .lifecycle-error { width: 100%; padding: 8px 14px; font-size: 13px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; margin-bottom: 4px; }
  .lifecycle-btn { padding: 9px 20px; font-size: 13px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }
  .lifecycle-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .lifecycle-activate { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .lifecycle-activate:hover:not(:disabled) { background: rgba(34,197,94,0.25); }
  .lifecycle-complete { background: rgba(59,130,246,0.15); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); }
  .lifecycle-complete:hover:not(:disabled) { background: rgba(59,130,246,0.25); }
  .lifecycle-cancel { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .lifecycle-cancel:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
  .lifecycle-approve { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .lifecycle-approve:hover:not(:disabled) { background: rgba(34,197,94,0.25); }
  .lifecycle-reject { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .lifecycle-reject:hover:not(:disabled) { background: rgba(239,68,68,0.15); }

  .approval-banner { padding: 14px 20px; border-radius: 10px; margin-bottom: 16px; }
  .approval-banner-pending { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }
  .approval-banner-rejected { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); }
  .approval-banner-text { font-size: 14px; color: rgba(255,255,255,0.85); }
  .approval-banner-pending .approval-banner-text strong { color: #f59e0b; }
  .approval-banner-rejected .approval-banner-text strong { color: #f87171; }
  .approval-banner-sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 4px; }
  .approval-failing-trades { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
  .failing-trade-tag { padding: 3px 10px; font-size: 12px; font-weight: 600; color: #fbbf24; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; font-family: var(--font-geist-mono), monospace; }
  .threshold-note { font-size: 11px; color: rgba(255,255,255,0.4); }

  .tab-bar { display: flex; gap: 6px; margin-bottom: 24px; flex-wrap: wrap; }
  .tab-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.65); padding: 10px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s ease; }
  .tab-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); }
  .tab-btn-active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); color: #93c5fd; }

  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .detail-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 24px; }
  .detail-section h2 { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 18px; }
  .detail-section.summary-section, .detail-section.full-span { grid-column: span 2; }
  .placeholder-section { grid-column: span 1; }
  .placeholder-text { font-size: 13px; color: rgba(255,255,255,0.4); font-style: italic; }

  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .summary-item { display: flex; flex-direction: column; gap: 6px; }
  .summary-item .label { font-size: 12px; color: rgba(255,255,255,0.45); }
  .summary-item .value { font-size: 15px; color: #fff; font-weight: 500; }

  .contact-card { padding: 16px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.2); border-radius: 10px; }
  .contact-name { font-size: 16px; font-weight: 600; color: #fff; display: block; margin-bottom: 10px; }
  .contact-row { display: flex; gap: 8px; font-size: 13px; margin-bottom: 4px; }
  .contact-label { color: rgba(255,255,255,0.45); min-width: 50px; }
  .contact-value { color: rgba(255,255,255,0.85); }

  .site-name { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 6px; }
  .site-address { font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.6; }
  .site-notes { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 8px; font-style: italic; }

  .loc-code-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); }
  .loc-code-label { display: block; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
  .loc-code-display { display: flex; align-items: center; gap: 10px; }
  .loc-code-value { font-size: 14px; font-weight: 500; color: #fff; font-family: var(--font-geist-mono), monospace; }
  .loc-code-empty { font-size: 13px; color: rgba(255,255,255,0.4); font-style: italic; }
  .loc-code-edit-btn { padding: 4px 12px; font-size: 11px; font-weight: 500; color: #3b82f6; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 4px; cursor: pointer; }
  .loc-code-edit-btn:hover { background: rgba(59,130,246,0.2); }
  .loc-code-edit { display: flex; align-items: center; gap: 8px; }
  .loc-code-input { padding: 6px 10px; font-size: 13px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; width: 180px; }
  .loc-code-input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
  .loc-code-save-btn { padding: 6px 14px; font-size: 11px; font-weight: 600; color: #22c55e; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 4px; cursor: pointer; }
  .loc-code-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .loc-code-cancel-btn { padding: 6px 12px; font-size: 11px; color: rgba(255,255,255,0.5); background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; }

  .joc-list { display: flex; flex-direction: column; gap: 6px; }
  .joc-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; }
  .joc-name { font-size: 14px; font-weight: 500; color: #fff; }
  .joc-role { font-size: 12px; color: rgba(255,255,255,0.5); text-transform: capitalize; }
  .joc-primary { font-size: 10px; font-weight: 600; color: #22c55e; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); border-radius: 4px; padding: 2px 8px; }

  .trades-overview { display: flex; gap: 40px; margin-bottom: 20px; }
  .trades-stat { display: flex; flex-direction: column; }
  .stat-value { font-size: 32px; font-weight: 700; color: #fff; line-height: 1; }
  .stat-label { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 4px; }
`;
