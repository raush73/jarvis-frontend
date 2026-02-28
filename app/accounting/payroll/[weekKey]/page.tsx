"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Mock employee payroll data with all 20 required columns
// SSN format: 123-45-6789 (unmasked for export)
const MOCK_PAYROLL_DATA = [
  {
    ssn: "123-45-6789",
    employee: "John Smith",
    loc: "KY-001",
    regRate: 28.50,
    regHours: 40.0,
    otHours: 8.0,
    dtHours: 0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 0,
    busExpense: 0,
    bonus: 0,
    advance: 0,
    mileage: 0,
    perDiem: 350.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 125.0,
    notes: "",
  },
  {
    ssn: "234-56-7890",
    employee: "Maria Garcia",
    loc: "KY-001",
    regRate: 32.00,
    regHours: 40.0,
    otHours: 12.0,
    dtHours: 4.0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 45.00,
    busExpense: 0,
    bonus: 100.0,
    advance: 0,
    mileage: 87.50,
    perDiem: 350.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 0,
    notes: "",
  },
  {
    ssn: "345-67-8901",
    employee: "Robert Johnson",
    loc: "KY-002",
    regRate: 26.00,
    regHours: 32.0,
    otHours: 4.0,
    dtHours: 0,
    holiday: 8.0,
    salary: 0,
    commission: 0,
    reimbursement: 0,
    busExpense: 25.00,
    bonus: 0,
    advance: 0,
    mileage: 0,
    perDiem: 280.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 200.0,
    notes: "Holiday hours included",
  },
  {
    ssn: "456-78-9012",
    employee: "Sarah Williams",
    loc: "TX-001",
    regRate: 35.00,
    regHours: 40.0,
    otHours: 6.0,
    dtHours: 0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 150.00,
    busExpense: 0,
    bonus: 250.0,
    advance: 0,
    mileage: 125.00,
    perDiem: 420.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 350.0,
    notes: "Lead technician",
  },
  {
    ssn: "567-89-0123",
    employee: "Michael Brown",
    loc: "TX-001",
    regRate: 24.00,
    regHours: 40.0,
    otHours: 2.0,
    dtHours: 0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 0,
    busExpense: 0,
    bonus: 0,
    advance: 0,
    mileage: 50.00,
    perDiem: 280.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 0,
    notes: "",
  },
  {
    ssn: "678-90-1234",
    employee: "Emily Davis",
    loc: "KY-002",
    regRate: 30.00,
    regHours: 40.0,
    otHours: 10.0,
    dtHours: 4.0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 75.00,
    busExpense: 35.00,
    bonus: 0,
    advance: 0,
    mileage: 0,
    perDiem: 350.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 175.0,
    notes: "",
  },
  {
    ssn: "789-01-2345",
    employee: "David Wilson",
    loc: "KY-001",
    regRate: 27.50,
    regHours: 40.0,
    otHours: 4.5,
    dtHours: 0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 0,
    busExpense: 0,
    bonus: 75.0,
    advance: 0,
    mileage: 62.50,
    perDiem: 280.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 0,
    notes: "",
  },
  {
    ssn: "890-12-3456",
    employee: "Jennifer Martinez",
    loc: "TX-002",
    regRate: 29.00,
    regHours: 40.0,
    otHours: 2.0,
    dtHours: 0,
    holiday: 0,
    salary: 0,
    commission: 0,
    reimbursement: 0,
    busExpense: 0,
    bonus: 0,
    advance: 0,
    mileage: 0,
    perDiem: 210.0,
    healthReimbursement: 0,
    deduction: 0,
    travel: 400.0,
    notes: "Remote site",
  },
];

type GroupByMode = "employee" | "employee_loc";

// CSV column headers - exact order per spec
const CSV_HEADERS = [
  "SSN",
  "Employee",
  "LOC",
  "Reg Rate",
  "Reg Hours",
  "O/T Hours",
  "D/T Hours",
  "Holiday",
  "Salary",
  "Commission",
  "Reimbursement",
  "Bus Expense",
  "BONUS",
  "Advance",
  "Mileage",
  "PER DIEM",
  "Health Reimbursement",
  "Deduction",
  "Travel",
  "NOTES",
];

function maskSSN(ssn: string): string {
  // Display as ***-**-1234
  const last4 = ssn.slice(-4);
  return `***-**-${last4}`;
}

function escapeCSVField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(data: typeof MOCK_PAYROLL_DATA): string {
  const headerRow = CSV_HEADERS.map(escapeCSVField).join(",");
  const dataRows = data.map((row) => {
    return [
      row.ssn, // Unmasked SSN in export
      row.employee,
      row.loc,
      row.regRate.toFixed(2),
      row.regHours.toFixed(1),
      row.otHours.toFixed(1),
      row.dtHours.toFixed(1),
      row.holiday.toFixed(1),
      row.salary.toFixed(2),
      row.commission.toFixed(2),
      row.reimbursement.toFixed(2),
      row.busExpense.toFixed(2),
      row.bonus.toFixed(2),
      row.advance.toFixed(2),
      row.mileage.toFixed(2),
      row.perDiem.toFixed(2),
      row.healthReimbursement.toFixed(2),
      row.deduction.toFixed(2),
      row.travel.toFixed(2),
      row.notes,
    ]
      .map(escapeCSVField)
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PayrollWeekPage() {
  const params = useParams();
  const weekKey = params.weekKey as string;
  const [groupBy, setGroupBy] = useState<GroupByMode>("employee");

  // Aggregate data based on groupBy mode
  const displayData = useMemo(() => {
    if (groupBy === "employee") {
      // Group by employee only - aggregate across LOCs
      const grouped: Record<string, typeof MOCK_PAYROLL_DATA[0]> = {};
      MOCK_PAYROLL_DATA.forEach((row) => {
        if (!grouped[row.employee]) {
          grouped[row.employee] = { ...row, loc: "(All)" };
        } else {
          const g = grouped[row.employee];
          g.regHours += row.regHours;
          g.otHours += row.otHours;
          g.dtHours += row.dtHours;
          g.holiday += row.holiday;
          g.salary += row.salary;
          g.commission += row.commission;
          g.reimbursement += row.reimbursement;
          g.busExpense += row.busExpense;
          g.bonus += row.bonus;
          g.advance += row.advance;
          g.mileage += row.mileage;
          g.perDiem += row.perDiem;
          g.healthReimbursement += row.healthReimbursement;
          g.deduction += row.deduction;
          g.travel += row.travel;
          if (row.notes && !g.notes.includes(row.notes)) {
            g.notes = g.notes ? `${g.notes}; ${row.notes}` : row.notes;
          }
        }
      });
      return Object.values(grouped).sort((a, b) =>
        a.employee.localeCompare(b.employee)
      );
    } else {
      // Employee + LOC - show detail rows
      return [...MOCK_PAYROLL_DATA].sort((a, b) => {
        const empCompare = a.employee.localeCompare(b.employee);
        if (empCompare !== 0) return empCompare;
        return a.loc.localeCompare(b.loc);
      });
    }
  }, [groupBy]);

  // Summary calculations
  const summary = useMemo(() => {
    let headcount = 0;
    let totalRegHours = 0;
    let totalOTHours = 0;
    let totalDTHours = 0;
    let totalPerDiem = 0;
    let totalTravel = 0;
    let totalBonus = 0;
    let totalReimbursement = 0;

    const uniqueEmployees = new Set<string>();
    MOCK_PAYROLL_DATA.forEach((row) => {
      uniqueEmployees.add(row.employee);
      totalRegHours += row.regHours;
      totalOTHours += row.otHours;
      totalDTHours += row.dtHours;
      totalPerDiem += row.perDiem;
      totalTravel += row.travel;
      totalBonus += row.bonus;
      totalReimbursement += row.reimbursement;
    });
    headcount = uniqueEmployees.size;

    return {
      headcount,
      totalHours: totalRegHours + totalOTHours + totalDTHours,
      totalPerDiem,
      totalTravel,
      totalBonus,
      totalReimbursement,
    };
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const formatHours = (val: number) => val.toFixed(1);

  const handleExportCSV = () => {
    const csv = generateCSV(displayData);
    const filename = `payroll_packet_${weekKey}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <div className="payroll-week-container">
      {/* Header */}
      <div className="page-header">
        <Link href="/accounting/payroll" className="back-link">
          ← Back to Payroll Packet
        </Link>
        <h1>Payroll Packet — {weekKey}</h1>
        <p className="subtitle">Week Ending {weekKey}</p>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span className="card-label">Headcount</span>
          <span className="card-value">{summary.headcount}</span>
        </div>
        <div className="summary-card">
          <span className="card-label">Total Hours</span>
          <span className="card-value">{formatHours(summary.totalHours)}</span>
        </div>
        <div className="summary-card">
          <span className="card-label">Total Per Diem</span>
          <span className="card-value money">{formatCurrency(summary.totalPerDiem)}</span>
        </div>
        <div className="summary-card">
          <span className="card-label">Total Travel</span>
          <span className="card-value money">{formatCurrency(summary.totalTravel)}</span>
        </div>
        <div className="summary-card">
          <span className="card-label">Total Bonus</span>
          <span className="card-value money">{formatCurrency(summary.totalBonus)}</span>
        </div>
        <div className="summary-card">
          <span className="card-label">Total Reimbursement</span>
          <span className="card-value money">{formatCurrency(summary.totalReimbursement)}</span>
        </div>
      </div>

      {/* Controls Row */}
      <div className="controls-row">
        <div className="group-by-toggle">
          <span className="toggle-label">Group By:</span>
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${groupBy === "employee" ? "active" : ""}`}
              onClick={() => setGroupBy("employee")}
            >
              Employee
            </button>
            <button
              className={`toggle-btn ${groupBy === "employee_loc" ? "active" : ""}`}
              onClick={() => setGroupBy("employee_loc")}
            >
              Employee + LOC
            </button>
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={handleExportCSV}>
            Export CSV
          </button>
          <button className="btn btn-disabled" disabled title="InnoWork integration not yet wired">
            Push to InnoWork
          </button>
        </div>
      </div>

      {/* Data Table - 20 columns in exact order */}
      <div className="table-wrap">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>SSN</th>
              <th>Employee</th>
              <th>LOC</th>
              <th className="num">Reg Rate</th>
              <th className="num">Reg Hours</th>
              <th className="num">O/T Hours</th>
              <th className="num">D/T Hours</th>
              <th className="num">Holiday</th>
              <th className="num">Salary</th>
              <th className="num">Commission</th>
              <th className="num">Reimbursement</th>
              <th className="num">Bus Expense</th>
              <th className="num">BONUS</th>
              <th className="num">Advance</th>
              <th className="num">Mileage</th>
              <th className="num">PER DIEM</th>
              <th className="num ky-fill">Health Reimb.</th>
              <th className="num">Deduction</th>
              <th className="num">Travel</th>
              <th>NOTES</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => (
              <tr key={`${row.ssn}-${row.loc}-${idx}`}>
                <td className="cell-ssn">{maskSSN(row.ssn)}</td>
                <td className="cell-employee">{row.employee}</td>
                <td className="cell-loc">{row.loc}</td>
                <td className="cell-num">${row.regRate.toFixed(2)}</td>
                <td className="cell-num">{formatHours(row.regHours)}</td>
                <td className="cell-num">{formatHours(row.otHours)}</td>
                <td className="cell-num">{formatHours(row.dtHours)}</td>
                <td className="cell-num">{formatHours(row.holiday)}</td>
                <td className="cell-num">${row.salary.toFixed(2)}</td>
                <td className="cell-num">${row.commission.toFixed(2)}</td>
                <td className="cell-num">${row.reimbursement.toFixed(2)}</td>
                <td className="cell-num">${row.busExpense.toFixed(2)}</td>
                <td className="cell-num highlight">${row.bonus.toFixed(2)}</td>
                <td className="cell-num">${row.advance.toFixed(2)}</td>
                <td className="cell-num">${row.mileage.toFixed(2)}</td>
                <td className="cell-num highlight">${row.perDiem.toFixed(2)}</td>
                <td className="cell-num ky-fill">$0.00</td>
                <td className="cell-num">${row.deduction.toFixed(2)}</td>
                <td className="cell-num">${row.travel.toFixed(2)}</td>
                <td className="cell-notes">{row.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="notes-section">
        <div className="note-item">
          <span className="note-icon">i</span>
          <span>
            <strong>SSN:</strong> Masked in UI (***-**-1234). CSV export contains unmasked SSN for InnoWork import.
          </span>
        </div>
        <div className="note-item">
          <span className="note-icon">i</span>
          <span>
            <strong>Health Reimbursement:</strong> Always 0 in Jarvis export (labeled as "KY Fill" — filled by InnoWork).
          </span>
        </div>
        <div className="note-item">
          <span className="note-icon">i</span>
          <span>
            <strong>Advances:</strong> Handled outside Jarvis (deferred).
          </span>
        </div>
        <div className="note-item">
          <span className="note-icon">i</span>
          <span>
            <strong>PER DIEM:</strong> Weekly total dollar amount (not days).
          </span>
        </div>
      </div>

      <style jsx>{`
        .payroll-week-container {
          padding: 24px 40px 60px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 0.15s ease;
          display: inline-block;
          margin-bottom: 12px;
        }

        .back-link:hover {
          color: #3b82f6;
        }

        h1 {
          font-size: 26px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        /* Summary Grid */
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .summary-card {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .card-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-value {
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.9);
        }

        .card-value.money {
          color: #22c55e;
        }

        /* Controls Row */
        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .group-by-toggle {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .toggle-buttons {
          display: flex;
          gap: 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
        }

        .toggle-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          background: rgba(255, 255, 255, 0.02);
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:first-child {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-btn:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.05);
        }

        .toggle-btn.active {
          color: #fff;
          background: rgba(59, 130, 246, 0.2);
        }

        .action-buttons {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          color: #fff;
          background: #3b82f6;
          border: 1px solid #3b82f6;
        }

        .btn-primary:hover {
          background: #2563eb;
          border-color: #2563eb;
        }

        .btn-disabled {
          color: rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: not-allowed;
        }

        /* Table */
        .table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow-x: auto;
          margin-bottom: 20px;
        }

        .payroll-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1400px;
        }

        .payroll-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .payroll-table th {
          padding: 12px 8px;
          text-align: left;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .payroll-table th.num {
          text-align: right;
        }

        .payroll-table th.ky-fill {
          color: rgba(245, 158, 11, 0.7);
        }

        .payroll-table td {
          padding: 10px 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .payroll-table tr:last-child td {
          border-bottom: none;
        }

        .cell-ssn {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        .cell-employee {
          font-weight: 500;
          color: #fff;
        }

        .cell-loc {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          color: #3b82f6;
        }

        .cell-num {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
        }

        .cell-num.highlight {
          color: #22c55e;
          font-weight: 600;
        }

        .cell-num.ky-fill {
          color: rgba(245, 158, 11, 0.5);
          font-style: italic;
        }

        .cell-notes {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Notes Section */
        .notes-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .note-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
        }

        .note-item strong {
          color: rgba(255, 255, 255, 0.75);
        }

        .note-icon {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

