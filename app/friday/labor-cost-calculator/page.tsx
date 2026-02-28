"use client";

import LaborCostCalculator from "@/components/LaborCostCalculator";

export default function LaborCostCalculatorPage() {
  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Labor Cost Calculator</h1>
      </header>
      <LaborCostCalculator />

      <style jsx>{`
        .page-container {
          padding: 32px 40px;
          max-width: 800px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          letter-spacing: -0.5px;
        }
      `}</style>
    </div>
  );
}
