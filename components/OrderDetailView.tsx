"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type {
  OrderDetailResponse,
  OrderTradeRequirementResponse,
  MarginHealthStatus,
} from "@/lib/types/order";
import { ChangeOrdersTab } from "./ChangeOrdersTab";
import { ENFORCEMENT_LABELS, type RequirementEnforcement } from "@/lib/types/order";
import { HEALTH_STATUS_COLORS, HEALTH_STATUS_LABELS } from "@/lib/constants/margin-health";
import {
  getOrderPhase,
  getPhaseLabel,
  getPhaseBadgeClass,
  PHASE_BADGE_STYLES,
  type OrderPhase,
} from "@/lib/order-lifecycle";

type TabKey = "overview" | "changeOrders" | "invoices";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "changeOrders", label: "Change Orders" },
  { key: "invoices", label: "Invoices" },
];

export type OrderDetailMode = "edit" | "view";

interface OrderDetailViewProps {
  orderId: string;
  mode?: OrderDetailMode;
  backTo?: "orders" | "customer";
  customerId?: string | null;
}

const enfLabel = (val: string) =>
  ENFORCEMENT_LABELS[val as RequirementEnforcement] ?? val;

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export function OrderDetailView({
  orderId,
  mode = "edit",
  backTo = "orders",
  customerId = null,
}: OrderDetailViewProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalRouting, setApprovalRouting] = useState<any>(null);

  const [editingLocCode, setEditingLocCode] = useState(false);
  const [locCodeDraft, setLocCodeDraft] = useState("");
  const [locCodeSaving, setLocCodeSaving] = useState(false);

  const phase: OrderPhase = order ? getOrderPhase(order.status) : "DRAFT";
  const approvalStatus = order?.approvalStatus;
  const isReadOnly =
    mode === "view" || phase === "COMPLETED" || phase === "CANCELLED";
  const isPendingApproval = phase === "DRAFT" && approvalStatus === "PENDING";
  const isRejected = phase === "DRAFT" && approvalStatus === "REJECTED";
  const showLifecycle = mode === "edit";

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
    loadOrder().then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleLifecycleAction(
    action: "activate" | "complete" | "cancel",
  ) {
    if (actionLoading) return;
    if (
      action === "cancel" &&
      !window.confirm("Are you sure you want to cancel this order?")
    )
      return;
    if (action === "complete" && !window.confirm("Mark this order as completed?"))
      return;

    setActionLoading(true);
    setActionError(null);
    setApprovalRouting(null);
    try {
      const result = await apiFetch<any>(`/orders/${orderId}/${action}`, {
        method: "POST",
      });
      if (result?.approvalRequired) {
        setApprovalRouting(result.routingOutcome ?? null);
      }
      await loadOrder();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : `Failed to ${action} order`,
      );
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
        setActionError(
          err instanceof Error ? err.message : "Failed to reject order",
        );
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
      setActionError(
        err instanceof Error ? err.message : "Failed to approve order",
      );
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

  const backButtonText =
    backTo === "customer" ? "← Back to Customer" : "← Back to Orders";

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className="od-container">
        <div className="od-loading">Loading order...</div>
        <style jsx>{shellStyles}</style>
      </div>
    );
  }

  /* ---------- Error / not-found state ---------- */
  if (error || !order) {
    return (
      <div className="od-container">
        <button className="od-back" onClick={handleBack}>
          {backButtonText}
        </button>
        <div className="od-error-box">
          <h2>Order Not Found</h2>
          <p>{error || "Could not load order data."}</p>
        </div>
        <style jsx>{shellStyles}</style>
      </div>
    );
  }

  const totalRequestedHeadcount = order.tradeRequirements.reduce(
    (s, tr) => s + (tr.requestedHeadcount ?? 0),
    0,
  );

  return (
    <div className="od-container">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="od-header">
        <button className="od-back" onClick={handleBack}>
          {backButtonText}
        </button>
        <div className="od-title-row">
          <div>
            <h1>{order.title || "Untitled Order"}</h1>
            <div className="od-meta">
              <span className="od-id-badge">{order.id}</span>
              <span
                className={`phase-badge ${getPhaseBadgeClass(phase, approvalStatus)}`}
              >
                {getPhaseLabel(phase, approvalStatus)}
              </span>
              {isReadOnly &&
                phase !== "COMPLETED" &&
                phase !== "CANCELLED" && (
                  <span className="od-readonly-badge">Read-Only View</span>
                )}
            </div>
            {order.marginHealth && (
              <div className="od-health-row">
                <span
                  className="od-health-dot-lg"
                  style={{ background: HEALTH_STATUS_COLORS[order.marginHealth.orderHealthStatus] }}
                />
                <span
                  className="od-health-label-lg"
                  style={{ color: HEALTH_STATUS_COLORS[order.marginHealth.orderHealthStatus] }}
                  title={`Blended order GM — ${order.marginHealth.orderBlendedMarginPct.toFixed(1)}% (weighted by revenue × headcount)`}
                >
                  {HEALTH_STATUS_LABELS[order.marginHealth.orderHealthStatus]} — Order GM {order.marginHealth.orderBlendedMarginPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Approval Banners ──────────────────────────────── */}
      {showLifecycle && isPendingApproval && (
        <div className="od-banner od-banner-pending">
          <div className="od-banner-text">
            <strong>Pending Approval</strong> — One or more trade lines have
            gross margin below the approval threshold. Manager or owner approval
            is required.
          </div>
          {approvalRouting?.failingTrades &&
            approvalRouting.failingTrades.length > 0 && (
              <div className="od-failing-trades">
                {approvalRouting.failingTrades.map((t: any) => (
                  <span key={t.tradeRequirementId} className="od-failing-tag">
                    {t.tradeName}: {t.grossMarginPct}% GM
                  </span>
                ))}
                <span className="od-threshold-note">
                  Threshold: {approvalRouting.thresholdUsed}%
                </span>
              </div>
            )}
        </div>
      )}
      {showLifecycle && isRejected && (
        <div className="od-banner od-banner-rejected">
          <div className="od-banner-text">
            <strong>Approval Rejected</strong>
            {order.approvalNote ? ` — ${order.approvalNote}` : ""}
          </div>
          <div className="od-banner-sub">
            Edit trade rates and re-attempt activation.
          </div>
        </div>
      )}

      {/* ── Lifecycle Action Bar ──────────────────────────── */}
      {showLifecycle && (
        <div className="od-lc-bar">
          {actionError && <div className="od-lc-error">{actionError}</div>}
          {phase === "DRAFT" && !isPendingApproval && (
            <button
              className="od-lc-btn od-lc-activate"
              onClick={() => handleLifecycleAction("activate")}
              disabled={actionLoading}
            >
              {actionLoading ? "Activating..." : "Activate Order"}
            </button>
          )}
          {isPendingApproval && (
            <>
              <button
                className="od-lc-btn od-lc-approve"
                onClick={() => handleApproval("approve")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Approve Order"}
              </button>
              <button
                className="od-lc-btn od-lc-reject"
                onClick={() => handleApproval("reject")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Reject"}
              </button>
            </>
          )}
          {isRejected && (
            <button
              className="od-lc-btn od-lc-activate"
              onClick={() => handleLifecycleAction("activate")}
              disabled={actionLoading}
            >
              {actionLoading ? "Activating..." : "Re-submit for Activation"}
            </button>
          )}
          {phase === "ACTIVE" && (
            <>
              <button
                className="od-lc-btn od-lc-complete"
                onClick={() => handleLifecycleAction("complete")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Complete Order"}
              </button>
              <button
                className="od-lc-btn od-lc-cancel"
                onClick={() => handleLifecycleAction("cancel")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Cancel Order"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Tab Bar ───────────────────────────────────────── */}
      {showLifecycle && (
        <div className="od-tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`od-tab-btn ${activeTab === tab.key ? "od-tab-active" : ""}`}
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
      )}

      {/* ── Overview Tab Content ──────────────────────────── */}
      {activeTab === "overview" && (
        <>
          {/* Summary row */}
          <div className="od-section od-summary">
            <div className="od-summary-item">
              <span className="od-label">Customer</span>
              <span className="od-value">
                {order.customer?.name ?? order.customerId}
              </span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">Status</span>
              <span className="od-value">{getPhaseLabel(phase)}</span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">SD Pay Delta</span>
              <span className="od-value">
                {order.sdPayDeltaRate != null
                  ? `$${order.sdPayDeltaRate}/hr`
                  : "—"}
              </span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">SD Bill Delta</span>
              <span className="od-value">
                {order.sdBillDeltaRate != null
                  ? `$${order.sdBillDeltaRate}/hr`
                  : "—"}
              </span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">Salesperson</span>
              <span className="od-value">
                {order.salesperson
                  ? `${order.salesperson.firstName} ${order.salesperson.lastName}`
                  : "—"}
              </span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">Commission Plan</span>
              <span className="od-value od-commission-val">
                {order.commissionPlan?.name ?? "Global Default"}
                {order.commissionPlanSource === "INHERITED" && (
                  <span className="od-plan-tag od-plan-inherited">
                    Inherited
                  </span>
                )}
                {order.commissionPlanSource === "OVERRIDE" && (
                  <span className="od-plan-tag od-plan-override">Override</span>
                )}
              </span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">Insurance Location ID</span>
              <span className="od-value">
                {order.jobLocationCode || "Not assigned"}
              </span>
            </div>
            <div className="od-summary-item">
              <span className="od-label">Created</span>
              <span className="od-value">{fmtDate(order.createdAt)}</span>
            </div>
          </div>

          {/* Job Site */}
          <div className="od-section">
            <h2>Job Site</h2>
            {order.jobSiteName ||
            order.jobSiteAddress1 ||
            order.jobSiteCity ? (
              <>
                {order.jobSiteName && (
                  <div className="od-site-name">{order.jobSiteName}</div>
                )}
                <div className="od-site-addr">
                  {order.jobSiteAddress1 && <div>{order.jobSiteAddress1}</div>}
                  {order.jobSiteAddress2 && <div>{order.jobSiteAddress2}</div>}
                  {(order.jobSiteCity ||
                    order.jobSiteState ||
                    order.jobSiteZip) && (
                    <div>
                      {[order.jobSiteCity, order.jobSiteState]
                        .filter(Boolean)
                        .join(", ")}
                      {order.jobSiteZip ? ` ${order.jobSiteZip}` : ""}
                    </div>
                  )}
                </div>
                {order.jobSiteNotes && (
                  <div className="od-site-notes">{order.jobSiteNotes}</div>
                )}
              </>
            ) : (
              <p className="od-empty">No job site specified</p>
            )}

            {mode === "edit" && (
              <div className="od-loc-section">
                <span className="od-loc-label">Insurance Location ID</span>
                {!editingLocCode ? (
                  <div className="od-loc-display">
                    <span
                      className={
                        order.jobLocationCode
                          ? "od-loc-value"
                          : "od-loc-empty"
                      }
                    >
                      {order.jobLocationCode || "Not assigned"}
                    </span>
                    <button
                      className="od-loc-edit-btn"
                      onClick={() => {
                        setLocCodeDraft(order.jobLocationCode || "");
                        setEditingLocCode(true);
                      }}
                    >
                      {order.jobLocationCode ? "Edit" : "Assign"}
                    </button>
                  </div>
                ) : (
                  <div className="od-loc-edit">
                    <input
                      type="text"
                      className="od-loc-input"
                      value={locCodeDraft}
                      onChange={(e) => setLocCodeDraft(e.target.value)}
                      placeholder="Enter location code"
                      autoFocus
                    />
                    <button
                      className="od-loc-save-btn"
                      disabled={locCodeSaving}
                      onClick={async () => {
                        setLocCodeSaving(true);
                        try {
                          await apiFetch(`/orders/${orderId}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              jobLocationCode: locCodeDraft || null,
                            }),
                          });
                          await loadOrder();
                          setEditingLocCode(false);
                        } catch {
                          /* swallow */
                        } finally {
                          setLocCodeSaving(false);
                        }
                      }}
                    >
                      {locCodeSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="od-loc-cancel-btn"
                      onClick={() => setEditingLocCode(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Job Contacts */}
          <div className="od-section">
            <h2>Job Contacts</h2>
            {order.jobOrderContacts && order.jobOrderContacts.length > 0 ? (
              <div className="od-contacts-list">
                {order.jobOrderContacts.map((joc) => (
                  <div key={joc.id} className="od-contact-row">
                    <span className="od-contact-name">{joc.contactName}</span>
                    <span className="od-contact-role">
                      {joc.role.replace(/_/g, " ")}
                    </span>
                    {joc.isPrimary && (
                      <span className="od-contact-primary">Primary</span>
                    )}
                  </div>
                ))}
              </div>
            ) : order.primaryCustomerContact ? (
              <div className="od-contacts-list">
                <div className="od-contact-row">
                  <span className="od-contact-name">
                    {order.primaryCustomerContact.firstName}{" "}
                    {order.primaryCustomerContact.lastName}
                  </span>
                  <span className="od-contact-role">Primary Contact</span>
                  <span className="od-contact-primary">Primary</span>
                </div>
              </div>
            ) : (
              <p className="od-empty">No contacts assigned</p>
            )}
          </div>

          {/* Trade Requirements */}
          <div className="od-section">
            <h2>Trade Requirements ({order.tradeRequirements.length})</h2>
            <div className="od-trades-overview">
              <div className="od-trades-stat">
                <span className="od-stat-value">{totalRequestedHeadcount}</span>
                <span className="od-stat-label">Total Requested</span>
              </div>
            </div>
            {order.tradeRequirements.length === 0 ? (
              <p className="od-empty">No trade requirements on this order.</p>
            ) : (
              order.tradeRequirements.map((tr) => {
                const tradeHealth = order.marginHealth?.trades.find(
                  (t) => t.tradeRequirementId === tr.id,
                );
                return (
                  <TradeRequirementCard
                    key={tr.id}
                    tr={tr}
                    tradeHealth={tradeHealth ?? null}
                  />
                );
              })
            )}
          </div>

          {showLifecycle && (
            <>
              <div className="od-section">
                <h2>Dispatch Readiness</h2>
                <p className="od-empty">
                  Dispatch readiness will be available in a future phase.
                </p>
              </div>
              <div className="od-section">
                <h2>Activity Log</h2>
                <p className="od-empty">
                  Activity log will be available in a future phase.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Change Orders Tab ─────────────────────────────── */}
      {activeTab === "changeOrders" && (
        <ChangeOrdersTab
          orderId={orderId}
          order={order}
          onOrderRefresh={loadOrder}
        />
      )}

      <style jsx>{shellStyles}</style>
    </div>
  );
}

/* ================================================================
   Trade Requirement Card (sub-component with scoped styles)
   ================================================================ */

function TradeRequirementCard({
  tr,
  tradeHealth,
}: {
  tr: OrderTradeRequirementResponse;
  tradeHealth: {
    totalBurdenPercent: number;
    trueLaborCost: number;
    grossProfit: number;
    grossMarginPct: number;
    healthStatus: MarginHealthStatus;
  } | null;
}) {
  return (
    <div className="trc-card">
      <div className="trc-header">
        <span className="trc-name">{tr.trade?.name ?? tr.tradeId}</span>
        {tradeHealth && (
          <span className="trc-health-indicator">
            <span
              className="trc-health-dot"
              style={{ background: HEALTH_STATUS_COLORS[tradeHealth.healthStatus] }}
              title={`Burden: ${tradeHealth.totalBurdenPercent.toFixed(2)}% | TLC: $${tradeHealth.trueLaborCost.toFixed(2)}/hr`}
            />
            <span
              className="trc-health-label"
              style={{ color: HEALTH_STATUS_COLORS[tradeHealth.healthStatus] }}
            >
              GM {tradeHealth.grossMarginPct.toFixed(1)}%
            </span>
          </span>
        )}
        <span className="trc-hc">
          {tr.requestedHeadcount ?? "—"} workers
        </span>
      </div>
      <div className="trc-fields">
        <div className="trc-field">
          <span className="trc-label">Base Pay Rate</span>
          <span className="trc-val">
            {tr.basePayRate != null ? `$${tr.basePayRate}` : "—"}
          </span>
        </div>
        <div className="trc-field">
          <span className="trc-label">Base Bill Rate</span>
          <span className="trc-val">
            {tr.baseBillRate != null ? `$${tr.baseBillRate}` : "—"}
          </span>
        </div>
        <div className="trc-field">
          <span className="trc-label">Start Date</span>
          <span className="trc-val">{fmtDate(tr.startDate)}</span>
        </div>
        <div className="trc-field">
          <span className="trc-label">Expected End</span>
          <span className="trc-val">{fmtDate(tr.expectedEndDate)}</span>
        </div>
      </div>

      {tr.effectiveState &&
        tr.effectiveState.appliedChangeOrderIds.length > 0 && (
          <div className="trc-eff">
            <span className="trc-eff-title">
              Effective State ({tr.effectiveState.appliedChangeOrderIds.length}{" "}
              CO{tr.effectiveState.appliedChangeOrderIds.length !== 1 ? "s" : ""}{" "}
              applied)
            </span>
            <div className="trc-eff-fields">
              <div className="trc-eff-item">
                <span className="trc-eff-label">Eff. Headcount</span>
                <span className="trc-eff-val">
                  {tr.effectiveState.requestedHeadcount ?? "—"}
                  {tr.effectiveState.requestedHeadcount !== tr.requestedHeadcount && (
                    <span className="trc-eff-delta">
                      (was {tr.requestedHeadcount ?? "—"})
                    </span>
                  )}
                </span>
              </div>
              <div className="trc-eff-item">
                <span className="trc-eff-label">Eff. Pay Rate</span>
                <span className="trc-eff-val">
                  ${tr.effectiveState.basePayRate ?? "—"}
                  {tr.effectiveState.basePayRate !== tr.basePayRate && (
                    <span className="trc-eff-delta">
                      (was ${tr.basePayRate ?? "—"})
                    </span>
                  )}
                </span>
              </div>
              <div className="trc-eff-item">
                <span className="trc-eff-label">Eff. Bill Rate</span>
                <span className="trc-eff-val">
                  ${tr.effectiveState.baseBillRate ?? "—"}
                  {tr.effectiveState.baseBillRate !== tr.baseBillRate && (
                    <span className="trc-eff-delta">
                      (was ${tr.baseBillRate ?? "—"})
                    </span>
                  )}
                </span>
              </div>
              <div className="trc-eff-item">
                <span className="trc-eff-label">Eff. Start Date</span>
                <span className="trc-eff-val">
                  {fmtDate(tr.effectiveState.startDate)}
                </span>
              </div>
              <div className="trc-eff-item">
                <span className="trc-eff-label">Backfill Policy</span>
                <span className="trc-eff-val">
                  {tr.effectiveState.backfillPolicy}
                </span>
              </div>
            </div>
          </div>
        )}

      {tr.assignments.length > 0 && (
        <div className="trc-assignments">
          <span className="trc-asn-title">
            Assignments ({tr.assignments.length})
          </span>
          {tr.assignments.map((a) => (
            <div key={a.id} className="trc-asn-row">
              <span className="trc-asn-id">{a.userId.slice(0, 8)}…</span>
              <span className="trc-asn-status">{a.status}</span>
              {a.effectiveAssignmentState && (
                <span className="trc-asn-eff">
                  Pay: ${a.effectiveAssignmentState.payRate ?? "—"} · Bill: $
                  {a.effectiveAssignmentState.billRate ?? "—"}
                  <span
                    className={`trc-asn-source ${a.effectiveAssignmentState.source === "ASSIGNMENT" ? "trc-asn-source-asn" : ""}`}
                  >
                    {a.effectiveAssignmentState.source}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {tr.notes && <p className="trc-notes">{tr.notes}</p>}

      {tr.supervisorOverride && tr.supervisorContact && (
        <div className="trc-supervisor">
          <span className="trc-sup-label">Supervisor</span>
          <span className="trc-sup-name">
            {tr.supervisorContact.firstName} {tr.supervisorContact.lastName}
          </span>
        </div>
      )}

      <EnforcedReqList
        label="PPE"
        items={(tr.ppeRequirements ?? []).map((r) => ({
          name: r.ppeType?.name ?? r.ppeTypeId,
          enforcement: r.enforcement,
        }))}
      />
      <EnforcedReqList
        label="Tools"
        items={(tr.toolRequirements ?? []).map((r) => ({
          name: r.tool?.name ?? r.toolId,
          enforcement: r.enforcement,
        }))}
      />
      <EnforcedReqList
        label="Certifications"
        items={(tr.certRequirements ?? []).map((r) => ({
          name: r.certType?.name ?? r.certTypeId,
          enforcement: r.enforcement,
        }))}
      />
      <RequirementTagList
        label="Compliance"
        items={(tr.complianceRequirements ?? []).map((r) => {
          const name = r.requirementType?.name ?? r.requirementTypeId;
          const variant = r.variant?.name;
          return variant ? `${name} — ${variant}` : name;
        })}
      />

      {/* Ramp Schedule */}
      {tr.rampSchedule && tr.rampSchedule.length > 0 && (
        <div className="trc-ramp-section">
          <span className="trc-ramp-title">Ramp Schedule</span>
          <div className="trc-ramp-timeline">
            {tr.rampSchedule.map((row, i) => {
              const prevEnd = i > 0 ? new Date(tr.rampSchedule[i - 1].endDate) : null;
              const currStart = new Date(row.startDate);
              const hasGap = prevEnd && currStart.getTime() > prevEnd.getTime();
              return (
                <div key={row.id}>
                  {hasGap && (
                    <div className="trc-ramp-gap">
                      <span className="trc-ramp-gap-label">0 demand</span>
                    </div>
                  )}
                  <div className="trc-ramp-row">
                    <span className="trc-ramp-dates">
                      {fmtDate(row.startDate)} — {fmtDate(row.endDate)}
                    </span>
                    <span className="trc-ramp-hc">{row.headcount} workers</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .trc-card {
          margin-bottom: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
        }
        .trc-card:last-child {
          margin-bottom: 0;
        }
        .trc-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .trc-name {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }
        .trc-hc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-family: var(--font-geist-mono), monospace;
        }
        .trc-health-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .trc-health-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .trc-health-label {
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-geist-mono), monospace;
        }
        .trc-ramp-section {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .trc-ramp-title {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }
        .trc-ramp-timeline {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .trc-ramp-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(59, 130, 246, 0.06);
          border-radius: 4px;
        }
        .trc-ramp-dates {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }
        .trc-ramp-hc {
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          font-family: var(--font-geist-mono), monospace;
        }
        .trc-ramp-gap {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3px 10px;
          border-left: 2px dashed rgba(255, 255, 255, 0.15);
          margin-left: 16px;
        }
        .trc-ramp-gap-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }
        .trc-eff {
          margin: 10px 0;
          padding: 10px 12px;
          background: rgba(34, 197, 94, 0.04);
          border: 1px solid rgba(34, 197, 94, 0.15);
          border-radius: 8px;
        }
        .trc-eff-title {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: #22c55e;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }
        .trc-eff-fields {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .trc-eff-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .trc-eff-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .trc-eff-val {
          font-size: 13px;
          color: #86efac;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
        }
        .trc-eff-delta {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
          margin-left: 6px;
          font-weight: 400;
        }
        .trc-assignments {
          margin: 10px 0;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .trc-asn-title {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }
        .trc-asn-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
          margin-bottom: 3px;
          flex-wrap: wrap;
        }
        .trc-asn-id {
          font-size: 11px;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.6);
        }
        .trc-asn-status {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
        }
        .trc-asn-eff {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--font-geist-mono), monospace;
          margin-left: auto;
        }
        .trc-asn-source {
          display: inline-block;
          margin-left: 8px;
          padding: 1px 6px;
          font-size: 9px;
          font-weight: 600;
          border-radius: 3px;
          background: rgba(59, 130, 246, 0.1);
          color: rgba(59, 130, 246, 0.8);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .trc-asn-source-asn {
          background: rgba(168, 85, 247, 0.1);
          color: rgba(168, 85, 247, 0.9);
          border-color: rgba(168, 85, 247, 0.25);
        }
        .trc-fields {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 8px;
        }
        .trc-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .trc-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .trc-val {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          font-family: var(--font-geist-mono), monospace;
        }
        .trc-notes {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin: 4px 0 0;
          font-style: italic;
        }
        .trc-supervisor {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .trc-sup-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          min-width: 80px;
        }
        .trc-sup-name {
          font-size: 13px;
          color: #3b82f6;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

/* ================================================================
   Enforced Requirement List (PPE / Tools / Certs)
   ================================================================ */

function EnforcedReqList({
  label,
  items,
}: {
  label: string;
  items: Array<{ name: string; enforcement: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="erl-wrap">
      <span className="erl-label">{label}:</span>
      <div className="erl-tags">
        {items.map((item, i) => (
          <span
            key={i}
            className={`erl-tag ${item.enforcement === "FILTER" ? "erl-filter" : "erl-flag"}`}
          >
            {item.name}
            <span className="erl-enf">{enfLabel(item.enforcement)}</span>
          </span>
        ))}
      </div>
      <style jsx>{`
        .erl-wrap {
          margin-top: 8px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .erl-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding-top: 4px;
          min-width: 80px;
        }
        .erl-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .erl-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
          border-radius: 4px;
        }
        .erl-filter {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .erl-flag {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .erl-enf {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

/* ================================================================
   Plain Requirement Tag List (Compliance)
   ================================================================ */

function RequirementTagList({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rtl-wrap">
      <span className="rtl-label">{label}:</span>
      <div className="rtl-tags">
        {items.map((name, i) => (
          <span key={i} className="rtl-tag">
            {name}
          </span>
        ))}
      </div>
      <style jsx>{`
        .rtl-wrap {
          margin-top: 8px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rtl-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding-top: 4px;
          min-width: 80px;
        }
        .rtl-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .rtl-tag {
          padding: 3px 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

/* ================================================================
   Shell Styles — scoped to OrderDetailView
   ================================================================ */

const shellStyles = `
  /* Container */
  .od-container { padding: 24px 40px 60px; max-width: 1200px; margin: 0 auto; }
  .od-loading { color: rgba(255,255,255,0.5); font-size: 14px; }

  /* Error */
  .od-error-box { text-align: center; padding: 60px 20px; }
  .od-error-box h2 { font-size: 20px; font-weight: 600; color: #fff; margin: 0 0 12px; }
  .od-error-box p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0 0 24px; }

  /* Header */
  .od-header { margin-bottom: 20px; }
  .od-back { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 12px; display: block; }
  .od-back:hover { color: #3b82f6; }
  .od-title-row { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
  .od-title-row h1 { font-size: 24px; font-weight: 600; color: #fff; margin: 0 0 6px; letter-spacing: -0.3px; }
  .od-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .od-id-badge { font-family: var(--font-geist-mono), monospace; font-size: 12px; padding: 4px 10px; background: rgba(59,130,246,0.15); color: #3b82f6; border-radius: 6px; }
  .od-readonly-badge { padding: 4px 12px; font-size: 11px; font-weight: 500; border-radius: 6px; background: rgba(148,163,184,0.15); color: rgba(148,163,184,0.8); border: 1px dashed rgba(148,163,184,0.3); }
  .od-health-badge { padding: 4px 12px; font-size: 11px; font-weight: 600; border-radius: 6px; font-family: var(--font-geist-mono), monospace; cursor: default; }
  .od-health-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .od-health-dot-lg { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .od-health-label-lg { font-size: 13px; font-weight: 700; font-family: var(--font-geist-mono), monospace; letter-spacing: 0.2px; cursor: default; }
  ${PHASE_BADGE_STYLES}

  /* Approval banners */
  .od-banner { padding: 14px 20px; border-radius: 10px; margin-bottom: 16px; }
  .od-banner-pending { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }
  .od-banner-rejected { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); }
  .od-banner-text { font-size: 14px; color: rgba(255,255,255,0.85); }
  .od-banner-pending .od-banner-text strong { color: #f59e0b; }
  .od-banner-rejected .od-banner-text strong { color: #f87171; }
  .od-banner-sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 4px; }
  .od-failing-trades { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
  .od-failing-tag { padding: 3px 10px; font-size: 12px; font-weight: 600; color: #fbbf24; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; font-family: var(--font-geist-mono), monospace; }
  .od-threshold-note { font-size: 11px; color: rgba(255,255,255,0.4); }

  /* Lifecycle bar */
  .od-lc-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .od-lc-error { width: 100%; padding: 8px 14px; font-size: 13px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; margin-bottom: 4px; }
  .od-lc-btn { padding: 9px 20px; font-size: 13px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }
  .od-lc-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .od-lc-activate { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .od-lc-activate:hover:not(:disabled) { background: rgba(34,197,94,0.25); }
  .od-lc-complete { background: rgba(59,130,246,0.15); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); }
  .od-lc-complete:hover:not(:disabled) { background: rgba(59,130,246,0.25); }
  .od-lc-cancel { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .od-lc-cancel:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
  .od-lc-approve { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .od-lc-approve:hover:not(:disabled) { background: rgba(34,197,94,0.25); }
  .od-lc-reject { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .od-lc-reject:hover:not(:disabled) { background: rgba(239,68,68,0.15); }

  /* Tab bar */
  .od-tab-bar { display: flex; gap: 6px; margin-bottom: 24px; flex-wrap: wrap; }
  .od-tab-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.65); padding: 10px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s ease; }
  .od-tab-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); }
  .od-tab-active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); color: #93c5fd; }

  /* Sections */
  .od-section { margin-bottom: 24px; padding: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
  .od-section h2 { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85); margin: 0 0 16px; }
  .od-empty { font-size: 13px; color: rgba(255,255,255,0.4); font-style: italic; margin: 0; }

  /* Summary row */
  .od-summary { display: flex; gap: 32px; flex-wrap: wrap; }
  .od-summary-item { display: flex; flex-direction: column; gap: 4px; }
  .od-label { font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px; }
  .od-value { font-size: 14px; color: #fff; }
  .od-commission-val { display: flex; align-items: center; }
  .od-plan-tag { display: inline-block; margin-left: 8px; padding: 2px 8px; font-size: 10px; font-weight: 600; border-radius: 4px; letter-spacing: 0.3px; text-transform: uppercase; }
  .od-plan-inherited { background: rgba(59,130,246,0.12); color: rgba(59,130,246,0.9); border: 1px solid rgba(59,130,246,0.25); }
  .od-plan-override { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }

  /* Job Site */
  .od-site-name { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 6px; }
  .od-site-addr { font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.6; }
  .od-site-notes { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 8px; font-style: italic; }

  /* Location code editing */
  .od-loc-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); }
  .od-loc-label { display: block; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
  .od-loc-display { display: flex; align-items: center; gap: 10px; }
  .od-loc-value { font-size: 14px; font-weight: 500; color: #fff; font-family: var(--font-geist-mono), monospace; }
  .od-loc-empty { font-size: 13px; color: rgba(255,255,255,0.4); font-style: italic; }
  .od-loc-edit-btn { padding: 4px 12px; font-size: 11px; font-weight: 500; color: #3b82f6; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 4px; cursor: pointer; }
  .od-loc-edit-btn:hover { background: rgba(59,130,246,0.2); }
  .od-loc-edit { display: flex; align-items: center; gap: 8px; }
  .od-loc-input { padding: 6px 10px; font-size: 13px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; width: 180px; }
  .od-loc-input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
  .od-loc-save-btn { padding: 6px 14px; font-size: 11px; font-weight: 600; color: #22c55e; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 4px; cursor: pointer; }
  .od-loc-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .od-loc-cancel-btn { padding: 6px 12px; font-size: 11px; color: rgba(255,255,255,0.5); background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; }

  /* Job Contacts */
  .od-contacts-list { display: flex; flex-direction: column; gap: 6px; }
  .od-contact-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; }
  .od-contact-name { font-size: 14px; font-weight: 500; color: #fff; }
  .od-contact-role { font-size: 12px; color: rgba(255,255,255,0.5); text-transform: capitalize; }
  .od-contact-primary { font-size: 10px; font-weight: 600; color: #22c55e; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); border-radius: 4px; padding: 2px 8px; }

  /* Trades overview */
  .od-trades-overview { display: flex; gap: 40px; margin-bottom: 20px; }
  .od-trades-stat { display: flex; flex-direction: column; }
  .od-stat-value { font-size: 32px; font-weight: 700; color: #fff; line-height: 1; }
  .od-stat-label { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 4px; }
`;
