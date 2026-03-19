'use client';

import CustomerTimesheetsHubPage from "@/app/customer/orders/[id]/timesheets/page";
import WipVisibilityPanel from "@/components/WipVisibilityPanel";
import { EventSpineTimelineSnapshot } from "@/components/EventSpineTimelineSnapshot";

export default function InternalTimesheetsHubPage() {
  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 40px 0' }}>
        {/* A) Timesheet Snapshot Header Block */}
        <div className="ts-snapshot-header">
          <div className="ts-header-title">Timesheet Snapshot (UI Only)</div>
          <div className="ts-header-subtext">
            Models working timesheet → approvals → snapshot. No persistence.
          </div>
          <div className="ts-badge-row">
            <span className="ts-badge ts-badge-status">Status: <strong>Draft</strong></span>
            <span className="ts-badge ts-badge-mode">Hours Mode: <strong>Reference Only</strong></span>
            <span className="ts-badge ts-badge-approval">Customer Approval: <strong>Required</strong></span>
          </div>
        </div>

        {/* B) Working Timesheet Card */}
        <div className="ts-card">
          <div className="ts-card-title">Working Timesheet (Pre-Snapshot)</div>
          <div className="ts-stepper">
            <div className="ts-step">
              <span className="ts-step-num">1</span>
              <span className="ts-step-label">Created <span className="ts-step-actor">(System)</span></span>
            </div>
            <div className="ts-step">
              <span className="ts-step-num">2</span>
              <span className="ts-step-label">Worker enters hours <span className="ts-step-actor">(Reference Only)</span></span>
            </div>
            <div className="ts-step">
              <span className="ts-step-num">3</span>
              <span className="ts-step-label">Submitted <span className="ts-step-actor">(Worker)</span></span>
            </div>
            <div className="ts-step">
              <span className="ts-step-num">4</span>
              <span className="ts-step-label">Customer approval <span className="ts-step-actor">(Customer)</span> OR MW4H approval <span className="ts-step-actor">(Internal)</span></span>
            </div>
            <div className="ts-step">
              <span className="ts-step-num">5</span>
              <span className="ts-step-label">Snapshot generated <span className="ts-step-actor">(System)</span></span>
            </div>
          </div>
          <div className="ts-helper-text">
            Snapshot is what downstream (Payroll/Invoice) trusts.
          </div>
        </div>

        {/* C) Hours Entry Mode Card */}
        <div className="ts-card">
          <div className="ts-card-title">Hours Entry Mode (Modeled)</div>
          <div className="ts-entry-options">
            <label className="ts-entry-option ts-entry-option-selected">
              <input type="radio" name="entryMode" checked disabled />
              <span>Total Hours Only</span>
              <span className="ts-default-tag">(default)</span>
            </label>
            <label className="ts-entry-option">
              <input type="radio" name="entryMode" disabled />
              <span>Start/End Times</span>
              <span className="ts-later-tag">(optional mode supported later)</span>
            </label>
          </div>
          <div className="ts-mock-table">
            <div className="ts-mock-table-header">
              <span className="ts-col-day">Day</span>
              <span className="ts-col-reg">Reg</span>
              <span className="ts-col-ot">OT</span>
            </div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Mon</span><span className="ts-col-reg">8.0</span><span className="ts-col-ot">0.0</span></div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Tue</span><span className="ts-col-reg">8.0</span><span className="ts-col-ot">1.5</span></div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Wed</span><span className="ts-col-reg">8.0</span><span className="ts-col-ot">0.0</span></div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Thu</span><span className="ts-col-reg">8.0</span><span className="ts-col-ot">2.0</span></div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Fri</span><span className="ts-col-reg">8.0</span><span className="ts-col-ot">0.0</span></div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Sat</span><span className="ts-col-reg">0.0</span><span className="ts-col-ot">4.0</span></div>
            <div className="ts-mock-table-row"><span className="ts-col-day">Sun</span><span className="ts-col-reg">0.0</span><span className="ts-col-ot">0.0</span></div>
          </div>
          <div className="ts-reference-label">
            Worker-entered numbers are &quot;Reference Only&quot; unless approved.
          </div>
        </div>

        {/* D) Approvals Card */}
        <div className="ts-card">
          <div className="ts-card-title">Approvals</div>
          <div className="ts-approval-chain">
            <span className="ts-approval-chip ts-chip-submitted">Worker Submitted</span>
            <span className="ts-approval-arrow">→</span>
            <span className="ts-approval-chip ts-chip-customer">Customer Approved</span>
            <span className="ts-approval-arrow">→</span>
            <span className="ts-approval-chip ts-chip-mw4h">MW4H Verified (optional)</span>
            <span className="ts-approval-arrow">→</span>
            <span className="ts-approval-chip ts-chip-official">Official</span>
          </div>
          <div className="ts-helper-text">
            No enforcement yet — modeled for clarity.
          </div>
        </div>

        {/* E) Reminder Cadence Card */}
        <div className="ts-card">
          <div className="ts-card-title">Reminder Cadence (Config Placeholder)</div>
          <div className="ts-cadence-dropdown">
            <select disabled>
              <option>Daily (after shift)</option>
              <option>Weekly (Fri 5pm)</option>
            </select>
          </div>
          <div className="ts-helper-text">
            Configurable reminder cadence; sends worker a magic link to enter reference hours.
          </div>
        </div>

        {/* F) Event Spine Timeline (Compact) */}
        <div className="ts-card">
          <EventSpineTimelineSnapshot
            mode="compact"
            contextLabel="Timeline Context — UI Only"
            workerName="Mock Worker"
            orderRef="ORD-MOCK-001"
          />
        </div>

        <WipVisibilityPanel />
      </div>
      <CustomerTimesheetsHubPage __internal />

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Timesheets Hub Page
        ============================================================ */

        /* Snapshot Header Card */
        .ts-snapshot-header {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 20px;
        }

        .ts-header-title {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 5px;
        }

        .ts-header-subtext {
          font-size: 13px;
          color: #6b7280;
          font-style: italic;
          margin-bottom: 14px;
        }

        .ts-badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .ts-badge {
          font-size: 11px;
          padding: 5px 10px;
          border-radius: 6px;
          background: #f8fafc;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .ts-badge strong {
          color: #111827;
          font-weight: 700;
        }

        .ts-badge-status {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .ts-badge-mode {
          background: #f5f3ff;
          border-color: #ddd6fe;
          color: #5b21b6;
        }

        .ts-badge-approval {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #15803d;
        }

        /* Info Cards */
        .ts-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .ts-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        /* Stepper */
        .ts-stepper {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 14px;
        }

        .ts-step {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ts-step-num {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 700;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ts-step-label {
          font-size: 13px;
          color: #374151;
        }

        .ts-step-actor {
          font-size: 11px;
          color: #9ca3af;
          font-style: italic;
        }

        .ts-helper-text {
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
          padding: 10px 12px;
          background: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        /* Entry Mode Options */
        .ts-entry-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .ts-entry-option {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .ts-entry-option input {
          cursor: not-allowed;
          accent-color: #2563eb;
        }

        .ts-entry-option-selected {
          color: #374151;
          font-weight: 500;
        }

        .ts-default-tag {
          font-size: 10px;
          color: #16a34a;
          font-weight: 600;
        }

        .ts-later-tag {
          font-size: 10px;
          color: #9ca3af;
          font-style: italic;
        }

        /* Mock Table */
        .ts-mock-table {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .ts-mock-table-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 8px 12px;
          background: #f1f5f9;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.3px;
        }

        .ts-mock-table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 6px 12px;
          border-top: 1px solid #f1f5f9;
          color: #374151;
        }

        .ts-col-day {
          font-weight: 600;
          color: #111827;
        }

        .ts-col-reg,
        .ts-col-ot {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          color: #374151;
        }

        .ts-reference-label {
          font-size: 11px;
          color: #7c3aed;
          font-style: italic;
        }

        /* Approval Chain */
        .ts-approval-chain {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }

        .ts-approval-chip {
          font-size: 11px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: 6px;
          background: #f8fafc;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .ts-chip-submitted {
          background: #f5f3ff;
          border-color: #ddd6fe;
          color: #5b21b6;
        }

        .ts-chip-customer {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #15803d;
        }

        .ts-chip-mw4h {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .ts-chip-official {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .ts-approval-arrow {
          color: #d1d5db;
          font-size: 14px;
        }

        /* Cadence Dropdown */
        .ts-cadence-dropdown {
          margin-bottom: 12px;
        }

        .ts-cadence-dropdown select {
          background: #f1f5f9;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: #9ca3af;
          cursor: not-allowed;
          min-width: 200px;
        }

        .ts-cadence-dropdown select option {
          background: #ffffff;
          color: #111827;
        }
      `}</style>
    </>
  );
}
