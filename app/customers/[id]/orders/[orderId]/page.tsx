"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type {
  OrderDetailResponse,
  OrderTradeRequirementResponse,
} from "@/lib/types/order";
import { ENFORCEMENT_LABELS, type RequirementEnforcement } from "@/lib/types/order";
import { getOrderPhase, getPhaseLabel, getPhaseBadgeClass, PHASE_BADGE_STYLES } from "@/lib/order-lifecycle";

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await apiFetch<OrderDetailResponse>(`/orders/${orderId}`);
        if (!alive) return;
        setOrder(data);
      } catch (err: unknown) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [orderId]);

  const handleBack = () => router.push(`/customers/${customerId}`);

  if (loading) {
    return (
      <div className="od-container">
        <div className="od-loading">Loading order...</div>
        <style jsx>{`
          .od-container { padding: 24px 40px 60px; max-width: 1400px; margin: 0 auto; }
          .od-loading { color: rgba(255,255,255,0.5); font-size: 14px; }
        `}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="od-container">
        <div className="od-error">
          <h2>Order Not Found</h2>
          <p>{error || "Could not load order data."}</p>
          <button className="od-back-primary" onClick={handleBack}>Back to Customer</button>
        </div>
        <style jsx>{`
          .od-container { padding: 24px 40px 60px; max-width: 1400px; margin: 0 auto; }
          .od-error { text-align: center; padding: 60px 20px; }
          .od-error h2 { font-size: 20px; font-weight: 600; color: #fff; margin: 0 0 12px; }
          .od-error p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0 0 24px; }
          .od-back-primary { padding: 10px 20px; font-size: 14px; font-weight: 500; color: #fff; background: #3b82f6; border: none; border-radius: 6px; cursor: pointer; }
          .od-back-primary:hover { background: #2563eb; }
        `}</style>
      </div>
    );
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const enfLabel = (val: string) =>
    ENFORCEMENT_LABELS[val as RequirementEnforcement] ?? val;

  return (
    <div className="od-container">
      {/* Header */}
      <div className="od-header">
        <button className="od-back" onClick={handleBack}>← Back to Customer</button>
        <div className="od-title-row">
          <div>
            <h1>{order.title || "Untitled Order"}</h1>
            <div className="od-meta">
              <span className="od-id-badge">{order.id}</span>
              <span className={`od-status phase-badge ${getPhaseBadgeClass(getOrderPhase(order.status))}`}>{getPhaseLabel(getOrderPhase(order.status))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="od-section od-summary">
        <div className="od-summary-item">
          <span className="od-label">Customer</span>
          <span className="od-value">{order.customer?.name ?? order.customerId}</span>
        </div>
        <div className="od-summary-item">
          <span className="od-label">SD Pay Delta</span>
          <span className="od-value">{order.sdPayDeltaRate != null ? `$${order.sdPayDeltaRate}/hr` : "—"}</span>
        </div>
        <div className="od-summary-item">
          <span className="od-label">SD Bill Delta</span>
          <span className="od-value">{order.sdBillDeltaRate != null ? `$${order.sdBillDeltaRate}/hr` : "—"}</span>
        </div>
        <div className="od-summary-item">
          <span className="od-label">Commission Plan</span>
          <span className="od-value">{order.commissionPlan?.name ?? "Global Default"}</span>
        </div>
        {order.primaryCustomerContact && (
          <div className="od-summary-item">
            <span className="od-label">Primary Contact</span>
            <span className="od-value">
              {order.primaryCustomerContact.firstName} {order.primaryCustomerContact.lastName}
              {order.primaryCustomerContact.email ? ` — ${order.primaryCustomerContact.email}` : ""}
            </span>
          </div>
        )}
        <div className="od-summary-item">
          <span className="od-label">Created</span>
          <span className="od-value">{fmtDate(order.createdAt)}</span>
        </div>
      </div>

      {/* Trade Requirements */}
      <div className="od-section">
        <h2>Trade Requirements ({order.tradeRequirements.length})</h2>
        {order.tradeRequirements.length === 0 ? (
          <p className="od-empty">No trade requirements on this order.</p>
        ) : (
          order.tradeRequirements.map((tr) => (
            <TradeRequirementCard key={tr.id} tr={tr} fmtDate={fmtDate} enfLabel={enfLabel} />
          ))
        )}
      </div>

      <style jsx>{`
        .od-container { padding: 24px 40px 60px; max-width: 1400px; margin: 0 auto; }
        .od-header { margin-bottom: 28px; }
        .od-back { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 12px; display: block; }
        .od-back:hover { color: #3b82f6; }
        .od-title-row { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .od-title-row h1 { font-size: 24px; font-weight: 600; color: #fff; margin: 0 0 6px; }
        .od-meta { display: flex; align-items: center; gap: 10px; }
        .od-id-badge { font-family: var(--font-geist-mono), monospace; font-size: 12px; padding: 4px 10px; background: rgba(59,130,246,0.15); color: #3b82f6; border-radius: 6px; }
        .od-status { padding: 4px 12px; font-size: 11px; font-weight: 600; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        ${PHASE_BADGE_STYLES}
        .od-section { margin-bottom: 24px; padding: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .od-section h2 { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85); margin: 0 0 16px; }
        .od-summary { display: flex; gap: 32px; flex-wrap: wrap; }
        .od-summary-item { display: flex; flex-direction: column; gap: 4px; }
        .od-label { font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px; }
        .od-value { font-size: 14px; color: #fff; }
        .od-empty { font-size: 13px; color: rgba(255,255,255,0.4); font-style: italic; }
      `}</style>
    </div>
  );
}

function TradeRequirementCard({
  tr,
  fmtDate,
  enfLabel,
}: {
  tr: OrderTradeRequirementResponse;
  fmtDate: (d: string | null) => string;
  enfLabel: (val: string) => string;
}) {
  return (
    <div className="tr-card">
      <div className="tr-header">
        <span className="tr-trade-name">{tr.trade?.name ?? tr.tradeId}</span>
        <span className="tr-headcount">{tr.requestedHeadcount ?? "—"} workers</span>
      </div>

      <div className="tr-fields">
        <div className="tr-field">
          <span className="tr-label">Base Pay Rate</span>
          <span className="tr-val">{tr.basePayRate != null ? `$${tr.basePayRate}` : "—"}</span>
        </div>
        <div className="tr-field">
          <span className="tr-label">Base Bill Rate</span>
          <span className="tr-val">{tr.baseBillRate != null ? `$${tr.baseBillRate}` : "—"}</span>
        </div>
        <div className="tr-field">
          <span className="tr-label">Start Date</span>
          <span className="tr-val">{fmtDate(tr.startDate)}</span>
        </div>
        <div className="tr-field">
          <span className="tr-label">Expected End</span>
          <span className="tr-val">{fmtDate(tr.expectedEndDate)}</span>
        </div>
      </div>

      {tr.notes && <p className="tr-notes">{tr.notes}</p>}

      <EnforcedReqList label="PPE" items={(tr.ppeRequirements ?? []).map((r) => ({
        name: r.ppeType?.name ?? r.ppeTypeId,
        enforcement: r.enforcement,
      }))} enfLabel={enfLabel} />
      <EnforcedReqList label="Tools" items={(tr.toolRequirements ?? []).map((r) => ({
        name: r.tool?.name ?? r.toolId,
        enforcement: r.enforcement,
      }))} enfLabel={enfLabel} />
      <EnforcedReqList label="Certifications" items={(tr.certRequirements ?? []).map((r) => ({
        name: r.certType?.name ?? r.certTypeId,
        enforcement: r.enforcement,
      }))} enfLabel={enfLabel} />
      <RequirementTagList
        label="Compliance"
        items={(tr.complianceRequirements ?? []).map((r) => {
          const name = r.requirementType?.name ?? r.requirementTypeId;
          const variant = r.variant?.name;
          return variant ? `${name} — ${variant}` : name;
        })}
      />

      <style jsx>{`
        .tr-card { margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; }
        .tr-card:last-child { margin-bottom: 0; }
        .tr-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .tr-trade-name { font-size: 15px; font-weight: 600; color: #fff; }
        .tr-headcount { font-size: 12px; color: rgba(255,255,255,0.6); font-family: var(--font-geist-mono), monospace; }
        .tr-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
        .tr-field { display: flex; flex-direction: column; gap: 2px; }
        .tr-label { font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.4px; }
        .tr-val { font-size: 13px; color: rgba(255,255,255,0.85); font-family: var(--font-geist-mono), monospace; }
        .tr-notes { font-size: 12px; color: rgba(255,255,255,0.6); margin: 4px 0 0; font-style: italic; }
      `}</style>
    </div>
  );
}

function EnforcedReqList({
  label,
  items,
  enfLabel,
}: {
  label: string;
  items: Array<{ name: string; enforcement: string }>;
  enfLabel: (val: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="erl-wrap">
      <span className="erl-label">{label}:</span>
      <div className="erl-tags">
        {items.map((item, i) => (
          <span key={i} className={`erl-tag ${item.enforcement === "FILTER" ? "erl-filter" : "erl-flag"}`}>
            {item.name}
            <span className="erl-enf">{enfLabel(item.enforcement)}</span>
          </span>
        ))}
      </div>
      <style jsx>{`
        .erl-wrap { margin-top: 8px; display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .erl-label { font-size: 10px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; padding-top: 4px; min-width: 80px; }
        .erl-tags { display: flex; flex-wrap: wrap; gap: 4px; }
        .erl-tag { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; font-size: 11px; color: rgba(255,255,255,0.8); border-radius: 4px; }
        .erl-filter { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
        .erl-flag { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); }
        .erl-enf { font-size: 9px; font-weight: 600; text-transform: uppercase; opacity: 0.7; }
      `}</style>
    </div>
  );
}

function RequirementTagList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rtl-wrap">
      <span className="rtl-label">{label}:</span>
      <div className="rtl-tags">
        {items.map((name, i) => (
          <span key={i} className="rtl-tag">{name}</span>
        ))}
      </div>
      <style jsx>{`
        .rtl-wrap { margin-top: 8px; display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .rtl-label { font-size: 10px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; padding-top: 4px; min-width: 80px; }
        .rtl-tags { display: flex; flex-wrap: wrap; gap: 4px; }
        .rtl-tag { padding: 3px 8px; font-size: 11px; color: rgba(255,255,255,0.8); background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}

