"use client";

import Link from "next/link";

export default function FridayPage() {
  return (
    <div className="stub-container">
      <div className="stub-content">
        <h1>Friday</h1>
        <p className="stub-description">UI shell placeholder (no logic yet)</p>

        <Link href="/friday/labor-cost-calculator" className="tool-card">
          Labor Cost Calculator
        </Link>
        
        <div className="future-tabs">
          <span className="future-tabs-label">Planned sub-tabs:</span>
          <ul className="future-tabs-list">
            <li>Weekly Scheduling</li>
            <li>Dispatch Board</li>
            <li>Timesheet Review</li>
            <li>Payroll Preview</li>
            <li>End-of-Week Reports</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .stub-container {
          padding: 48px 40px;
          max-width: 800px;
          margin: 0 auto;
        }

        .stub-content {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 48px;
          text-align: center;
        }

        h1 {
          font-size: 36px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
        }

        .stub-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 40px;
        }

        .future-tabs {
          background: rgba(139, 92, 246, 0.05);
          border: 1px dashed rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 24px 32px;
          text-align: left;
        }

        .future-tabs-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 12px;
        }

        .future-tabs-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .future-tabs-list li {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          padding-left: 20px;
          position: relative;
        }

        .future-tabs-list li::before {
          content: "→";
          position: absolute;
          left: 0;
          color: #8b5cf6;
        }

        :global(.tool-card) {
          display: block;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 24px;
          font-size: 16px;
          font-weight: 600;
          color: #a78bfa;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }

        :global(.tool-card:hover) {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}

