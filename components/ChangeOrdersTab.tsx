"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  OrderDetailResponse,
  ChangeOrderResponse,
  ChangeOrderType,
  CreateChangeOrderPayload,
} from "@/lib/types/order";

interface ChangeOrdersTabProps {
  orderId: string;
  order: OrderDetailResponse;
  onOrderRefresh: () => void;
}

const CO_TYPE_LABELS: Record<ChangeOrderType, string> = {
  RATE_CHANGE: "Rate Change",
  HEADCOUNT_INCREASE: "Headcount Increase",
  HEADCOUNT_DECREASE: "Headcount Decrease",
  START_DATE_CHANGE: "Start Date Change",
  BACKFILL_POLICY_CHANGE: "Backfill Policy Change",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "rgba(148,163,184,0.8)",
  PENDING_APPROVAL: "#f59e0b",
  APPROVED: "#22c55e",
  REJECTED: "#f87171",
  CANCELLED: "rgba(148,163,184,0.5)",
};

type TargetScope = "TRADE_LINE" | "ASSIGNMENT";

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export function ChangeOrdersTab({
  orderId,
  order,
  onOrderRefresh,
}: ChangeOrdersTabProps) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadChangeOrders = useCallback(async () => {
    try {
      const data = await apiFetch<ChangeOrderResponse[]>(
        `/orders/${orderId}/change-orders`,
      );
      setChangeOrders(data);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load change orders",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadChangeOrders();
  }, [loadChangeOrders]);

  const tradeMap = new Map(
    order.tradeRequirements.map((tr) => [tr.id, tr]),
  );

  function getTargetLabel(co: ChangeOrderResponse): string {
    const tr = tradeMap.get(co.orderTradeRequirementId);
    const tradeName = tr?.trade?.name ?? "Unknown Trade";
    if (co.assignmentId) {
      const assignment = tr?.assignments.find((a) => a.id === co.assignmentId);
      const workerId = assignment?.userId ?? co.assignmentId.slice(0, 8);
      return `${workerId.slice(0, 8)}… · ${tradeName} · Assignment`;
    }
    return `${tradeName} · Trade Line`;
  }

  return (
    <div className="co-tab">
      <div className="co-section">
        <div className="co-header-row">
          <h2>Change Orders</h2>
          <button
            className="co-create-btn"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? "Cancel" : "Create Change Order"}
          </button>
        </div>

        {showCreate && (
          <CreateChangeOrderForm
            orderId={orderId}
            order={order}
            onCreated={() => {
              setShowCreate(false);
              loadChangeOrders();
              onOrderRefresh();
            }}
          />
        )}

        {loading && <p className="co-empty">Loading change orders...</p>}
        {error && <p className="co-error">{error}</p>}
        {!loading && !error && changeOrders.length === 0 && (
          <p className="co-empty">No change orders for this order yet.</p>
        )}
        {!loading && !error && changeOrders.length > 0 && (
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {changeOrders.map((co) => (
                  <tr key={co.id}>
                    <td className="co-seq">{co.sequenceNumber}</td>
                    <td>{CO_TYPE_LABELS[co.type] ?? co.type}</td>
                    <td className="co-target">{getTargetLabel(co)}</td>
                    <td>{fmtDate(co.effectiveDate)}</td>
                    <td>
                      <span
                        className="co-status-badge"
                        style={{
                          color: STATUS_COLORS[co.status] ?? "#fff",
                          borderColor: STATUS_COLORS[co.status] ?? "#fff",
                        }}
                      >
                        {co.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="co-reason">{co.reason || "—"}</td>
                    <td>{fmtDate(co.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .co-tab {
          width: 100%;
        }
        .co-section {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }
        .co-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .co-header-row h2 {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0;
        }
        .co-create-btn {
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .co-create-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }
        .co-empty {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
          margin: 0;
        }
        .co-error {
          font-size: 13px;
          color: #fca5a5;
          margin: 0;
        }
        .co-table-wrap {
          overflow-x: auto;
        }
        .co-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .co-table th {
          text-align: left;
          padding: 8px 10px;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .co-table td {
          padding: 10px 10px;
          color: rgba(255, 255, 255, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }
        .co-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
        .co-seq {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
        }
        .co-target {
          font-size: 11px;
          max-width: 240px;
        }
        .co-status-badge {
          display: inline-block;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .co-reason {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

/* ================================================================
   Create Change Order Form
   ================================================================ */

function CreateChangeOrderForm({
  orderId,
  order,
  onCreated,
}: {
  orderId: string;
  order: OrderDetailResponse;
  onCreated: () => void;
}) {
  const [targetScope, setTargetScope] = useState<TargetScope>("TRADE_LINE");
  const [tradeReqId, setTradeReqId] = useState(
    order.tradeRequirements[0]?.id ?? "",
  );
  const [assignmentId, setAssignmentId] = useState("");
  const [changeType, setChangeType] = useState<ChangeOrderType>("RATE_CHANGE");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [reason, setReason] = useState("");

  // Type-specific fields
  const [newPayRate, setNewPayRate] = useState("");
  const [newBillRate, setNewBillRate] = useState("");
  const [newHeadcount, setNewHeadcount] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newPolicy, setNewPolicy] = useState<"AUTO" | "DO_NOT_BACKFILL">(
    "DO_NOT_BACKFILL",
  );

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTrade = order.tradeRequirements.find(
    (tr) => tr.id === tradeReqId,
  );
  const assignments = selectedTrade?.assignments ?? [];

  const TRADE_ONLY_TYPES: ChangeOrderType[] = [
    "HEADCOUNT_INCREASE",
    "HEADCOUNT_DECREASE",
    "START_DATE_CHANGE",
    "BACKFILL_POLICY_CHANGE",
  ];

  useEffect(() => {
    if (targetScope === "ASSIGNMENT") {
      setChangeType("RATE_CHANGE");
      if (assignments.length > 0 && !assignmentId) {
        setAssignmentId(assignments[0].id);
      }
    }
  }, [targetScope, assignments, assignmentId]);

  useEffect(() => {
    if (targetScope === "ASSIGNMENT" && TRADE_ONLY_TYPES.includes(changeType)) {
      setChangeType("RATE_CHANGE");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetScope]);

  function buildPayload(): Record<string, any> {
    switch (changeType) {
      case "RATE_CHANGE": {
        const p: Record<string, any> = {};
        if (newPayRate)
          p.previousPayRate = Number(selectedTrade?.basePayRate ?? 0);
        if (newPayRate) p.newPayRate = Number(newPayRate);
        if (newBillRate)
          p.previousBillRate = Number(selectedTrade?.baseBillRate ?? 0);
        if (newBillRate) p.newBillRate = Number(newBillRate);
        return p;
      }
      case "HEADCOUNT_INCREASE":
      case "HEADCOUNT_DECREASE":
        return {
          previousHeadcount: selectedTrade?.requestedHeadcount ?? 0,
          newHeadcount: Number(newHeadcount),
        };
      case "START_DATE_CHANGE":
        return {
          previousStartDate: selectedTrade?.startDate ?? "",
          newStartDate,
        };
      case "BACKFILL_POLICY_CHANGE":
        return {
          previousPolicy: "AUTO",
          newPolicy,
        };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const payload: CreateChangeOrderPayload = {
        orderTradeRequirementId: tradeReqId,
        type: changeType,
        changePayload: buildPayload(),
        effectiveDate,
        reason: reason || undefined,
      };

      if (targetScope === "ASSIGNMENT" && assignmentId) {
        payload.assignmentId = assignmentId;
      }

      const created = await apiFetch<ChangeOrderResponse>(
        `/orders/${orderId}/change-orders`,
        { method: "POST", body: JSON.stringify(payload) },
      );

      await apiFetch(
        `/orders/${orderId}/change-orders/${created.id}/submit`,
        { method: "POST" },
      );

      await apiFetch(
        `/orders/${orderId}/change-orders/${created.id}/approve`,
        { method: "POST" },
      );

      onCreated();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create change order",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="cof" onSubmit={handleSubmit}>
      <div className="cof-title">New Change Order</div>

      {formError && <div className="cof-error">{formError}</div>}

      <div className="cof-row">
        <div className="cof-field">
          <label>Target Scope</label>
          <select
            value={targetScope}
            onChange={(e) => setTargetScope(e.target.value as TargetScope)}
          >
            <option value="TRADE_LINE">Trade Line</option>
            <option value="ASSIGNMENT">Assignment (Worker)</option>
          </select>
        </div>

        <div className="cof-field">
          <label>Trade Requirement</label>
          <select
            value={tradeReqId}
            onChange={(e) => {
              setTradeReqId(e.target.value);
              setAssignmentId("");
            }}
          >
            {order.tradeRequirements.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.trade?.name ?? tr.tradeId} — {tr.requestedHeadcount ?? 0}{" "}
                workers
              </option>
            ))}
          </select>
        </div>

        {targetScope === "ASSIGNMENT" && (
          <div className="cof-field">
            <label>Assignment</label>
            {assignments.length === 0 ? (
              <span className="cof-hint">No assignments on this trade line</span>
            ) : (
              <select
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
              >
                <option value="">Select assignment...</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.userId.slice(0, 8)}… — {a.status}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="cof-row">
        <div className="cof-field">
          <label>Change Type</label>
          <select
            value={changeType}
            onChange={(e) => setChangeType(e.target.value as ChangeOrderType)}
          >
            {targetScope === "ASSIGNMENT" ? (
              <option value="RATE_CHANGE">Rate Change</option>
            ) : (
              <>
                <option value="RATE_CHANGE">Rate Change</option>
                <option value="HEADCOUNT_INCREASE">Headcount Increase</option>
                <option value="HEADCOUNT_DECREASE">Headcount Decrease</option>
                <option value="START_DATE_CHANGE">Start Date Change</option>
                <option value="BACKFILL_POLICY_CHANGE">
                  Backfill Policy Change
                </option>
              </>
            )}
          </select>
        </div>

        <div className="cof-field">
          <label>Effective Date</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
        </div>

        <div className="cof-field cof-field-wide">
          <label>Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason"
          />
        </div>
      </div>

      {/* Type-specific inputs */}
      <div className="cof-row">
        {changeType === "RATE_CHANGE" && (
          <>
            <div className="cof-field">
              <label>
                New Pay Rate{" "}
                <span className="cof-current">
                  (current: ${selectedTrade?.basePayRate ?? "—"})
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                value={newPayRate}
                onChange={(e) => setNewPayRate(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
            <div className="cof-field">
              <label>
                New Bill Rate{" "}
                <span className="cof-current">
                  (current: ${selectedTrade?.baseBillRate ?? "—"})
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                value={newBillRate}
                onChange={(e) => setNewBillRate(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
          </>
        )}

        {(changeType === "HEADCOUNT_INCREASE" ||
          changeType === "HEADCOUNT_DECREASE") && (
          <div className="cof-field">
            <label>
              New Headcount{" "}
              <span className="cof-current">
                (current: {selectedTrade?.requestedHeadcount ?? 0})
              </span>
            </label>
            <input
              type="number"
              min="0"
              value={newHeadcount}
              onChange={(e) => setNewHeadcount(e.target.value)}
              required
            />
          </div>
        )}

        {changeType === "START_DATE_CHANGE" && (
          <div className="cof-field">
            <label>
              New Start Date{" "}
              <span className="cof-current">
                (current: {fmtDate(selectedTrade?.startDate)})
              </span>
            </label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              required
            />
          </div>
        )}

        {changeType === "BACKFILL_POLICY_CHANGE" && (
          <div className="cof-field">
            <label>New Backfill Policy</label>
            <select
              value={newPolicy}
              onChange={(e) =>
                setNewPolicy(e.target.value as "AUTO" | "DO_NOT_BACKFILL")
              }
            >
              <option value="AUTO">AUTO</option>
              <option value="DO_NOT_BACKFILL">DO NOT BACKFILL</option>
            </select>
          </div>
        )}
      </div>

      <div className="cof-actions">
        <button type="submit" className="cof-submit" disabled={submitting}>
          {submitting ? "Creating & Approving..." : "Create & Approve"}
        </button>
      </div>

      <style jsx>{`
        .cof {
          padding: 16px;
          margin-bottom: 20px;
          background: rgba(59, 130, 246, 0.04);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 10px;
        }
        .cof-title {
          font-size: 13px;
          font-weight: 600;
          color: #93c5fd;
          margin-bottom: 14px;
        }
        .cof-error {
          padding: 8px 12px;
          font-size: 12px;
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 6px;
          margin-bottom: 12px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .cof-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .cof-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 180px;
          flex: 1;
        }
        .cof-field-wide {
          flex: 2;
        }
        .cof-field label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .cof-current {
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          color: rgba(255, 255, 255, 0.35);
        }
        .cof-field select,
        .cof-field input {
          padding: 7px 10px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
        }
        .cof-field select:focus,
        .cof-field input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }
        .cof-field select option {
          background: #1e293b;
          color: #fff;
        }
        .cof-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
          padding: 7px 0;
        }
        .cof-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .cof-submit {
          padding: 9px 22px;
          font-size: 13px;
          font-weight: 600;
          color: #22c55e;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.35);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cof-submit:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.22);
        }
        .cof-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}
