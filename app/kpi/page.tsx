"use client";

export default function KPIPage() {
  return (
    <div className="stub-container">
      <div className="stub-content">
        <h1>KPI</h1>
        <p className="stub-description">UI shell placeholder (no logic yet)</p>
        
        <div className="future-tabs">
          <span className="future-tabs-label">Planned sub-tabs:</span>
          <ul className="future-tabs-list">
            <li>Dashboard Overview</li>
            <li>Fill Rate Metrics</li>
            <li>Revenue & Margin</li>
            <li>Recruiter Performance</li>
            <li>Customer Satisfaction</li>
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
          background: rgba(59, 130, 246, 0.05);
          border: 1px dashed rgba(59, 130, 246, 0.2);
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
          color: #3b82f6;
        }
      `}</style>
    </div>
  );
}

