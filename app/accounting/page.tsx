"use client";
import Link from "next/link";

export default function AccountingPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Money</h1>
        <p style={styles.subtitle}>
          Jarvis Prime 1.0 Money focuses on <b>Invoicing</b>, <b>Manual Payment
          Events</b>, <b>Commissions</b>, and <b>Payroll Packet</b> (export-only).
          No GL/AP/AR in 1.0.
        </p>
      </div>

      <div style={styles.grid}>
        <Link href="/accounting/invoicing" className="moneyCard">
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Invoicing</div>
              <div style={styles.cardDesc}>
                Invoice list + invoice snapshot views (read-only UI shells).
              </div>
            </div>
            <span style={styles.badgeActive}>ACTIVE</span>
          </div>

          <div style={styles.cardBody}>
            <ul style={styles.bullets}>
              <li>Invoice list (mock)</li>
              <li>Invoice detail snapshot (mock)</li>
              <li>Payment events panel (manual entry UI)</li>
            </ul>
          </div>

          <div style={styles.cardFooter}>
            <span style={styles.linkHint}>Open Invoicing →</span>
          </div>
        </Link>

        <Link href="/accounting/commissions" className="moneyCard">
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Commissions</div>
              <div style={styles.cardDesc}>
                Commission events derived from paid invoice payment events.
              </div>
            </div>
            <span style={styles.badgeActive}>ACTIVE</span>
          </div>

          <div style={styles.cardBody}>
            <ul style={styles.bullets}>
              <li>Commission events list</li>
              <li>Days-to-paid tier buckets</li>
              <li>Pending / Paid / Reversed filters</li>
              <li>Export placeholder (CSV)</li>
            </ul>
          </div>

          <div style={styles.cardFooter}>
            <span style={styles.linkHint}>Open Commissions →</span>
          </div>
        </Link>

        <Link href="/accounting/payroll" className="moneyCard">
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Payroll Packet</div>
              <div style={styles.cardDesc}>
                Jarvis Prime 1.0 does not run payroll — exports a packet.
              </div>
            </div>
            <span style={styles.badgeActive}>ACTIVE</span>
          </div>

          <div style={styles.cardBody}>
            <ul style={styles.bullets}>
              <li>Hours + worker identifiers</li>
              <li>Deduction totals</li>
              <li>Export/push to InnoWork</li>
            </ul>
          </div>

          <div style={styles.cardFooter}>
            <span style={styles.linkHint}>Open Payroll Packet →</span>
          </div>
        </Link>

        <Link href="/accounting/payments" className="moneyCard">
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Payments</div>
              <div style={styles.cardDesc}>
                Accounting audit view of all payment events across invoices.
              </div>
            </div>
            <span style={styles.badgeActive}>ACTIVE</span>
          </div>

          <div style={styles.cardBody}>
            <ul style={styles.bullets}>
              <li>Payment events hub (audit view)</li>
              <li>Filter by status, date, customer</li>
              <li>Link to invoice detail for entry</li>
            </ul>
          </div>

          <div style={styles.cardFooter}>
            <span style={styles.linkHint}>Open Payments →</span>
          </div>
        </Link>
      </div>

      <div style={styles.note}>
        <span style={styles.noteIcon}>i</span>
        <span>
          UI shell only. No backend wiring. No external payment processing. Paid
          events are recorded manually for audit + commissions.
        </span>
      </div>

      <style jsx>{`
        .moneyCard {
          display: block;
          text-decoration: none;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          padding: 18px;
          transition: transform 120ms ease, border-color 120ms ease,
            background 120ms ease;
        }

        .moneyCard:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.35);
          background: rgba(255, 255, 255, 0.05);
        }

        .moneyCardDisabled {
          cursor: default;
        }

        .moneyCardDisabled:hover {
          transform: none;
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px 40px 60px",
    maxWidth: 1200,
    margin: "0 auto",
    textAlign: "center",
  },
  header: {
    marginBottom: 18,
  },
  title: {
    margin: "0 0 8px",
    fontSize: 44,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "0 auto",
    maxWidth: 920,
    opacity: 0.85,
    lineHeight: 1.5,
  },
  grid: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    textAlign: "left",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6,
  },
  cardDesc: {
    opacity: 0.8,
    lineHeight: 1.4,
  },
  cardBody: {
    marginTop: 12,
  },
  bullets: {
    margin: 0,
    paddingLeft: 18,
    opacity: 0.9,
    lineHeight: 1.7,
  },
  cardFooter: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-end",
  },
  linkHint: {
    opacity: 0.95,
    fontWeight: 600,
  },
  disabledHint: {
    opacity: 0.6,
    fontWeight: 600,
  },
  cardDisabled: {
    opacity: 0.9,
  },
  badgeActive: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  badgeSoon: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(245,158,11,0.22)",
  },
  badgeFuture: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.14)",
    border: "1px solid rgba(148,163,184,0.22)",
  },
  badgeInfo: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.14)",
    border: "1px solid rgba(59,130,246,0.22)",
  },
  note: {
    marginTop: 18,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    textAlign: "left",
    opacity: 0.85,
  },
  noteIcon: {
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
  },
};
