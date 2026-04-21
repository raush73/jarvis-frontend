"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CallSessionPanel from "../../components/friday/CallSessionPanel";
import CallHistoryPanel from "../../components/friday/CallHistoryPanel";
import type { CallTarget } from "../../components/friday/types";

export default function FridayPage() {
  const searchParams = useSearchParams();
  const directTarget = searchParams.get("directTarget") ?? undefined;
  const [activeTarget, setActiveTarget] = useState<CallTarget | null>(null);

  const handleTargetChange = useCallback((target: CallTarget | null) => {
    setActiveTarget(target);
  }, []);

  return (
    <div className="friday-page">
      <div className="friday-session">
        <CallSessionPanel
          onTargetChange={handleTargetChange}
          directTargetCustomerId={directTarget}
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
          <div className="sidebar-label">Tools</div>
          <Link href="/friday/intelligence" className="sidebar-link">
            Intelligence Queue
          </Link>
          <Link href="/friday/labor-cost-calculator" className="sidebar-link">
            Labor Cost Calculator
          </Link>
          <Link href="/friday/control-panel" className="sidebar-link">
            Control Panel
          </Link>
        </div>
      </div>

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
