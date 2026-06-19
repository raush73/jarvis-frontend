"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CallSessionPanel from "../../components/friday/CallSessionPanel";
import CallHistoryPanel from "../../components/friday/CallHistoryPanel";
import ManualCallModal from "../../components/friday/ManualCallModal";
import CallCompletionGate from "../../components/friday/CallCompletionGate";
import { fridayFetch } from "../../components/friday/fridayFetch";
import type { CallTarget, CompanyContact, FollowUp } from "../../components/friday/types";
import CompanyDrawer from "../../components/company/CompanyDrawer";
import CalculatorDrawer from "../../components/friday/CalculatorDrawer";

export default function FridayPage() {
  return (
    <Suspense fallback={null}>
      <FridayPageInner />
    </Suspense>
  );
}

type ManualCallPhase = 'idle' | 'form' | 'in_call' | 'completing';

// Raw shape returned by GET /customer-contacts/customer/:customerId.
type RawCustomerContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  cellPhone?: string | null;
  officePhone?: string | null;
  jobTitle?: string | null;
};

// Map the customer-contacts API record into the CompanyContact shape the
// completion gate consumes.
function toCompanyContacts(rows: RawCustomerContact[]): CompanyContact[] {
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '(no name)',
    email: r.email ?? null,
    phone: r.cellPhone ?? r.officePhone ?? null,
    title: r.jobTitle ?? null,
  }));
}

interface ManualCallState {
  callEventId: string;
  customerId: string;
  companyName: string;
  phone: string;
}

function FridayPageInner() {
  const searchParams = useSearchParams();
  const directTarget = searchParams.get("directTarget") ?? undefined;
  const [activeTarget, setActiveTarget] = useState<CallTarget | null>(null);

  // Manual Call state
  const [manualPhase, setManualPhase] = useState<ManualCallPhase>('idle');
  const [manualCall, setManualCall] = useState<ManualCallState | null>(null);
  const [manualContacts, setManualContacts] = useState<CompanyContact[]>([]);
  const [manualFollowUps, setManualFollowUps] = useState<FollowUp[]>([]);

  // Company Detail Drawer state
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null);

  // Calculator Drawer state
  const [calculatorDrawerOpen, setCalculatorDrawerOpen] = useState(false);

  const handleOpenCompanyDetail = useCallback((customerId: string) => {
    setDrawerCustomerId(customerId);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerCustomerId(null);
  }, []);

  const handleTargetChange = useCallback((target: CallTarget | null) => {
    setActiveTarget(target);
  }, []);

  const handleManualCallStarted = (result: { callEventId: string; customerId: string; createdLead?: { customerId: string; name: string; phone: string } }) => {
    const phone = result.createdLead?.phone ?? '';

    setManualCall({
      callEventId: result.callEventId,
      customerId: result.customerId,
      companyName: result.createdLead?.name ?? 'Manual Call',
      phone,
    });

    setManualPhase('in_call');

    if (phone) {
      void fridayFetch('/webex/calls/dial', {
        method: 'POST',
        body: JSON.stringify({ destination: phone, callEventId: result.callEventId }),
      }).then((res) => {
        if (!res.ok) {
          alert(`Webex dial failed: ${res.error}`);
        }
      });
    }
  };

  const handleManualEndCall = async () => {
    if (!manualCall) return;
    const [cRes, fRes] = await Promise.all([
      fridayFetch<RawCustomerContact[]>(`/customer-contacts/customer/${manualCall.customerId}`),
      fridayFetch<FollowUp[]>(`/friday/follow-ups/company/${manualCall.customerId}?status=OPEN`),
    ]);
    setManualContacts(cRes.ok ? toCompanyContacts(cRes.data) : []);
    setManualFollowUps(fRes.ok ? fRes.data : []);
    setManualPhase('completing');
  };

  const handleManualCompleted = () => {
    setManualPhase('idle');
    setManualCall(null);
    setManualContacts([]);
    setManualFollowUps([]);
  };

  const handleManualClose = () => {
    setManualPhase('idle');
    setManualCall(null);
    setManualContacts([]);
    setManualFollowUps([]);
  };

  return (
    <div className="friday-page">
      <div className="friday-session">
        <CallSessionPanel
          onTargetChange={handleTargetChange}
          directTargetCustomerId={directTarget}
          onOpenCompanyDetail={handleOpenCompanyDetail}
        />
      </div>

      <div className="friday-history">
        <CallHistoryPanel
          customerId={activeTarget?.customerId ?? null}
          companyName={activeTarget?.customerName ?? null}
        />
      </div>

      <div className="friday-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Actions</div>
          <button
            className="sidebar-action-btn"
            onClick={() => setManualPhase('form')}
            disabled={manualPhase !== 'idle'}
          >
            Manual Call
          </button>
        </div>

        <div className="sidebar-section" style={{ marginTop: 12 }}>
          <div className="sidebar-label">Tools</div>
          <Link href="/friday/intelligence" className="sidebar-link">
            Intelligence Queue
          </Link>
          <button
            className="sidebar-link"
            onClick={() => setCalculatorDrawerOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', font: 'inherit' }}
          >
            Labor Cost Calculator
          </button>
          <Link href="/friday/control-panel" className="sidebar-link">
            Control Panel
          </Link>
        </div>
      </div>

      {/* Manual Call Modal (form) */}
      {manualPhase === 'form' && (
        <ManualCallModal
          onClose={() => setManualPhase('idle')}
          onCallStarted={handleManualCallStarted}
        />
      )}

      {/* Manual Call In-Call floating panel (non-blocking) */}
      {manualPhase === 'in_call' && manualCall && (
        <div className="manual-call-panel">
          <div className="manual-call-panel-header">
            <div className="manual-call-indicator" />
            <span className="manual-call-status">Manual Call Active</span>
          </div>
          <div className="manual-call-info">
            <div className="manual-call-name">{manualCall.companyName}</div>
            {manualCall.phone && <div className="manual-call-phone">{manualCall.phone}</div>}
          </div>
          <div className="manual-call-actions">
            <button className="manual-call-end-btn" onClick={handleManualEndCall}>
              End Call &amp; Complete
            </button>
            <button
              className="manual-call-detail-btn"
              onClick={() => handleOpenCompanyDetail(manualCall.customerId)}
            >
              Company Detail
            </button>
          </div>
        </div>
      )}

      {/* Manual Call Completion Gate */}
      {manualPhase === 'completing' && manualCall && (
        <CallCompletionGate
          callEventId={manualCall.callEventId}
          customerId={manualCall.customerId}
          contacts={manualContacts}
          existingFollowUps={manualFollowUps}
          onCompleted={handleManualCompleted}
          onConflict={() => {}}
          onClose={handleManualClose}
          mode="friday"
        />
      )}

      {/* Company Detail Drawer */}
      {drawerCustomerId && (
        <CompanyDrawer
          customerId={drawerCustomerId}
          onClose={handleCloseDrawer}
        />
      )}

      {/* Calculator Drawer */}
      {calculatorDrawerOpen && (
        <CalculatorDrawer
          onClose={() => setCalculatorDrawerOpen(false)}
          customerId={activeTarget?.customerId ?? manualCall?.customerId ?? null}
          customerName={activeTarget?.customerName ?? manualCall?.companyName ?? null}
        />
      )}

      <style jsx>{`
        .friday-page {
          display: grid;
          grid-template-columns: 340px 1fr 220px;
          gap: 28px;
          padding: 40px;
          max-width: 1200px;
          margin: 0 auto;
          min-height: calc(100vh - 80px);
          align-items: start;
        }

        .friday-session {
          min-width: 0;
        }

        .friday-history {
          min-width: 0;
        }

        .friday-sidebar {
          position: sticky;
          top: 40px;
        }

        .sidebar-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }

        .sidebar-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .sidebar-action-btn {
          display: block;
          width: 100%;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 600;
          color: #a78bfa;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          text-align: left;
        }

        .sidebar-action-btn:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.18);
          border-color: rgba(139, 92, 246, 0.4);
        }

        .sidebar-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        :global(.sidebar-link) {
          display: block;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          border-radius: 6px;
          margin-bottom: 4px;
          transition: background 0.15s, color 0.15s;
        }

        :global(.sidebar-link:hover) {
          background: rgba(139, 92, 246, 0.1);
          color: #a78bfa;
        }

        .manual-call-panel {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 900;
          background: #1a1d24;
          border: 1px solid rgba(34, 197, 94, 0.5);
          border-radius: 12px;
          padding: 16px 20px;
          width: 280px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(34, 197, 94, 0.1);
          pointer-events: auto;
        }

        .manual-call-panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .manual-call-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
          animation: pulse-green 2s infinite;
          flex-shrink: 0;
        }

        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.08); }
        }

        .manual-call-status {
          font-size: 0.75rem;
          font-weight: 700;
          color: #22c55e;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .manual-call-info {
          margin-bottom: 14px;
        }

        .manual-call-name {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .manual-call-phone {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .manual-call-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .manual-call-end-btn {
          padding: 9px 16px;
          font-size: 0.8125rem;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          background: #22c55e;
          color: #ffffff;
          cursor: pointer;
          transition: background 0.15s;
          width: 100%;
        }

        .manual-call-end-btn:hover {
          background: #16a34a;
        }

        .manual-call-detail-btn {
          padding: 7px 16px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 6px;
          background: rgba(139, 92, 246, 0.08);
          color: #a78bfa;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          width: 100%;
        }

        .manual-call-detail-btn:hover {
          background: rgba(139, 92, 246, 0.18);
          border-color: rgba(139, 92, 246, 0.45);
        }

        @media (max-width: 900px) {
          .friday-page {
            grid-template-columns: 1fr;
            padding: 24px 16px;
          }

          .friday-sidebar {
            position: static;
          }
        }
      `}</style>
    </div>
  );
}




