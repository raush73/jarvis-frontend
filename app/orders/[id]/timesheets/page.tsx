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
        /* Timesheet Snapshot Header */
        .ts-snapshot-header {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 20px;
        }

        .ts-header-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 6px;
        }

        .ts-header-subtext {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
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
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ts-badge strong {
          color: #fff;
          font-weight: 600;
        }

        .ts-badge-status {
          border-color: rgba(234, 179, 8, 0.3);
          background: rgba(234, 179, 8, 0.08);
        }

        .ts-badge-mode {
          border-color: rgba(139, 92, 246, 0.3);
          background: rgba(139, 92, 246, 0.08);
        }

        .ts-badge-approval {
          border-color: rgba(34, 197, 94, 0.3);
          background: rgba(34, 197, 94, 0.08);
        }

        /* Card Styles */
        .ts-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .ts-card-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          font-size: 12px;
          font-weight: 600;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ts-step-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
        }

        .ts-step-actor {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          font-style: italic;
        }

        .ts-helper-text {
          font-size: 12px;
          color: rgba(148, 163, 184, 0.8);
          font-style: italic;
          padding: 10px 12px;
          background: rgba(148, 163, 184, 0.08);
          border-radius: 6px;
          border: 1px solid rgba(148, 163, 184, 0.15);
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
          color: rgba(255, 255, 255, 0.6);
          cursor: not-allowed;
        }

        .ts-entry-option input {
          cursor: not-allowed;
        }

        .ts-entry-option-selected {
          color: rgba(255, 255, 255, 0.9);
        }

        .ts-default-tag {
          font-size: 10px;
          color: rgba(34, 197, 94, 0.9);
          font-weight: 500;
        }

        .ts-later-tag {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        /* Mock Table */
        .ts-mock-table {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .ts-mock-table-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.3px;
        }

        .ts-mock-table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 6px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.7);
        }

        .ts-col-day {
          font-weight: 500;
        }

        .ts-col-reg,
        .ts-col-ot {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
        }

        .ts-reference-label {
          font-size: 11px;
          color: rgba(139, 92, 246, 0.9);
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
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ts-chip-submitted {
          background: rgba(139, 92, 246, 0.12);
          border-color: rgba(139, 92, 246, 0.3);
          color: #a78bfa;
        }

        .ts-chip-customer {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.3);
          color: #34d399;
        }

        .ts-chip-mw4h {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.3);
          color: #fbbf24;
        }

        .ts-chip-official {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }

        .ts-approval-arrow {
          color: rgba(255, 255, 255, 0.3);
          font-size: 14px;
        }

        /* Cadence Dropdown */
        .ts-cadence-dropdown {
          margin-bottom: 12px;
        }

        .ts-cadence-dropdown select {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          cursor: not-allowed;
          min-width: 200px;
        }
      `}</style>
    </>
  );
}
