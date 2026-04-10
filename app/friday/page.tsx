"use client";

import Link from "next/link";
import CallSessionPanel from "../../components/friday/CallSessionPanel";

export default function FridayPage() {
  return (
    <div className="friday-page">
      <div className="friday-main">
        <CallSessionPanel />
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
          grid-template-columns: 1fr 240px;
          gap: 32px;
          padding: 40px;
          max-width: 960px;
          margin: 0 auto;
          min-height: calc(100vh - 80px);
          align-items: start;
        }

        .friday-main {
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

        @media (max-width: 768px) {
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
