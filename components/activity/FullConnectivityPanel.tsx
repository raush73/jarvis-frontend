"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import type { OpenActivityEntry } from "./types";
import {
  LIFECYCLE_BADGES,
  formatRelativeTime,
  formatActivityDueDate,
} from "./types";

type CustomerContext = {
  ownerName: string | null;
  lifecycleStatus: string | null;
  primaryContact: {
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  contactCount: number;
  lastMeaningfulActivityAt: string | null;
};

export default function FullConnectivityPanel({
  customerId,
  openItems,
  refreshKey,
}: {
  customerId: string;
  openItems?: OpenActivityEntry[];
  refreshKey?: number;
}) {
  const [ctx, setCtx] = useState<CustomerContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await apiFetch<any>(`/customers/${customerId}`);
        if (!alive) return;

        const sp = data?.registrySalesperson;
        const ownerName = sp
          ? (sp.fullName?.trim() || `${sp.firstName ?? ""} ${sp.lastName ?? ""}`.trim() || sp.email || null)
          : null;

        const contacts: any[] = Array.isArray(data?.contacts) ? data.contacts : [];
        const first = contacts[0] ?? null;

        setCtx({
          ownerName,
          lifecycleStatus: data?.lifecycleStatus ?? null,
          primaryContact: first
            ? {
                name: [first.firstName, first.lastName].filter(Boolean).join(" ") || "Unnamed",
                phone: first.officePhone || first.cellPhone || null,
                email: first.email || null,
              }
            : null,
          contactCount: contacts.length,
          lastMeaningfulActivityAt: data?.lastMeaningfulActivityAt ?? null,
        });
      } catch {
        if (alive) setCtx(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId, refreshKey]);

  const obligations = useMemo(() => {
    if (!openItems) return null;
    const followUps = openItems.filter((i) => i.type === "FOLLOW_UP");
    const tasks = openItems.filter((i) => i.type === "TASK");

    const nextFollowUp = followUps
      .filter((i) => i.dueAt)
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0] ?? null;

    return {
      openFollowUps: followUps.length,
      overdueFollowUps: followUps.filter((i) => i.isOverdue).length,
      openTasks: tasks.length,
      overdueTasks: tasks.filter((i) => i.isOverdue).length,
      nextFollowUp,
    };
  }, [openItems]);

  if (loading) {
    return (
      <div className="connectivity-panel cp-loading">
        Loading relationship context…
        <style jsx>{`
          .connectivity-panel { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; }
          .cp-loading { padding: 16px; text-align: center; color: #8e99a4; font-size: 13px; }
        `}</style>
      </div>
    );
  }

  if (!ctx) return null;

  const badge = LIFECYCLE_BADGES[ctx.lifecycleStatus ?? ""] ?? {
    label: ctx.lifecycleStatus ?? "Unknown",
    bg: "#f5f5f5",
    color: "#616161",
  };

  return (
    <div className="connectivity-panel">
      <div className="cp-grid">
        <div className="cp-cell">
          <span className="cp-label">Owner</span>
          <span className="cp-value">{ctx.ownerName ?? "Unassigned"}</span>
        </div>
        <div className="cp-cell">
          <span className="cp-label">Status</span>
          <span className="cp-badge" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>

        <div className="cp-cell">
          <span className="cp-label">Primary Contact</span>
          {ctx.primaryContact ? (
            <span className="cp-value" title={ctx.primaryContact.email ?? undefined}>
              {ctx.primaryContact.name}
              {ctx.primaryContact.phone && (
                <span className="cp-contact-phone"> · {ctx.primaryContact.phone}</span>
              )}
            </span>
          ) : (
            <span className="cp-value cp-dim">No contacts</span>
          )}
        </div>
        <div className="cp-cell">
          <span className="cp-label">Contacts</span>
          <span className="cp-value">{ctx.contactCount}</span>
        </div>

        <div className="cp-cell">
          <span className="cp-label">Last Activity</span>
          <span className={`cp-value ${!ctx.lastMeaningfulActivityAt ? "cp-dim" : ""}`}>
            {formatRelativeTime(ctx.lastMeaningfulActivityAt)}
          </span>
        </div>
        <div className="cp-cell">
          <span className="cp-label">Next Follow-Up</span>
          {obligations?.nextFollowUp ? (
            <span className={`cp-value ${obligations.nextFollowUp.isOverdue ? "cp-urgent" : ""}`}>
              {formatActivityDueDate(obligations.nextFollowUp.dueAt!)}
            </span>
          ) : (
            <span className="cp-value cp-dim">None scheduled</span>
          )}
        </div>

        {obligations && (
          <>
            <div className="cp-cell">
              <span className="cp-label">Open Follow-Ups</span>
              <span className={`cp-value ${obligations.overdueFollowUps > 0 ? "cp-urgent" : ""}`}>
                {obligations.openFollowUps}
                {obligations.overdueFollowUps > 0 && (
                  <span className="cp-overdue-tag"> ({obligations.overdueFollowUps} overdue)</span>
                )}
              </span>
            </div>
            <div className="cp-cell">
              <span className="cp-label">Open Tasks</span>
              <span className={`cp-value ${obligations.overdueTasks > 0 ? "cp-urgent" : ""}`}>
                {obligations.openTasks}
                {obligations.overdueTasks > 0 && (
                  <span className="cp-overdue-tag"> ({obligations.overdueTasks} overdue)</span>
                )}
              </span>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .connectivity-panel {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }
        .cp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .cp-cell {
          padding: 8px 16px;
          border-bottom: 1px solid #f0f2f5;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .cp-cell:nth-child(odd) {
          border-right: 1px solid #f0f2f5;
        }
        .cp-label {
          font-size: 11px;
          font-weight: 600;
          color: #8e99a4;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .cp-value {
          font-size: 13px;
          font-weight: 500;
          color: #2c3e50;
        }
        .cp-contact-phone {
          font-weight: 400;
          color: #5a6872;
          font-size: 12px;
        }
        .cp-dim {
          color: #adb5bd;
          font-style: italic;
        }
        .cp-urgent {
          color: #c0392b;
        }
        .cp-overdue-tag {
          font-size: 11px;
          font-weight: 600;
        }
        .cp-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          width: fit-content;
        }
      `}</style>
    </div>
  );
}
