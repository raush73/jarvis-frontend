"use client";

import { useEffect, useState, useCallback, CSSProperties } from "react";
import { fridayFetch } from "../../components/friday/fridayFetch";
import { FC } from "../../components/friday/styles";

interface FollowUpDiscipline {
  missed: number;
  completed: number;
  cancelled: number;
  currentlyOverdue: number;
  duplicatesBlocked: number;
  overridesCreated: number;
  antiGamingWarnings: number;
  antiGamingFlags: number;
  avgRescheduleCount: number;
  maxRescheduleCount: number;
}

interface ReleaseEntry {
  reason: string;
  count: number;
}

interface DeadlineEntry {
  customerId: string;
  companyName: string;
  touchDeadlineAt?: string;
  controlDeadlineAt?: string;
}

interface ControlBehavior {
  activeControls: number;
  atRiskControls: number;
  releasesInPeriod: ReleaseEntry[];
  newControlsInPeriod: number;
  pausedControls: number;
  graceExtensionsInPeriod: number;
  overrideRequestsInPeriod: number;
  nearestTouchDeadline: DeadlineEntry | null;
  nearestControlDeadline: DeadlineEntry | null;
}

interface AccountHealthSummary {
  active: number;
  atRisk: number;
  stale: number;
  critical: number;
}

interface AccountEntry {
  customerId: string;
  companyName: string;
  healthState: string;
  businessDaysSince: number | null;
  lastMeaningfulActivityAt: string | null;
}

interface AccountHealth {
  summary: AccountHealthSummary;
  accounts: AccountEntry[];
}

interface DistributionEntry {
  outcome?: string;
  origin?: string;
  source?: string;
  status?: string;
  count: number;
}

interface CallQuality {
  totalCalls: number;
  outcomeDistribution: DistributionEntry[];
  originDistribution: DistributionEntry[];
  noteSourceDistribution: DistributionEntry[];
  recycleEvents: number;
}

interface RepEntry {
  repUserId: string;
  repName: string;
  followUps: { missed: number; completed: number; currentlyOverdue: number };
  controls: { active: number; atRisk: number; releasedInPeriod: number };
  callQuality: { totalCalls: number; outcomeBreakdown: DistributionEntry[] };
  health: { atRisk: number; stale: number; critical: number };
}

interface RepSummary {
  reps: RepEntry[];
}

const HEALTH_COLORS: Record<string, string> = {
  CRITICAL: FC.accentRed,
  STALE: FC.accentAmber,
  AT_RISK: FC.accentAmber,
  ACTIVE: FC.accentGreen,
};

export default function AccountabilityPage() {
  const [followUp, setFollowUp] = useState<FollowUpDiscipline | null>(null);
  const [control, setControl] = useState<ControlBehavior | null>(null);
  const [health, setHealth] = useState<AccountHealth | null>(null);
  const [callQ, setCallQ] = useState<CallQuality | null>(null);
  const [repSum, setRepSum] = useState<RepSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const errs: string[] = [];

    const [fuRes, ctRes, ahRes, cqRes, rsRes] = await Promise.all([
      fridayFetch<FollowUpDiscipline>(
        "/friday/accountability/follow-up-discipline/mine"
      ),
      fridayFetch<ControlBehavior>(
        "/friday/accountability/control-behavior/mine"
      ),
      fridayFetch<AccountHealth>(
        "/friday/accountability/account-health/mine"
      ),
      fridayFetch<CallQuality>(
        "/friday/accountability/call-quality/mine"
      ),
      fridayFetch<RepSummary>(
        "/friday/accountability/rep-summary"
      ),
    ]);

    if (fuRes.ok) setFollowUp(fuRes.data);
    else errs.push(`Follow-Up: ${fuRes.error}`);

    if (ctRes.ok) setControl(ctRes.data);
    else errs.push(`Control: ${ctRes.error}`);

    if (ahRes.ok) setHealth(ahRes.data);
    else errs.push(`Health: ${ahRes.error}`);

    if (cqRes.ok) setCallQ(cqRes.data);
    else errs.push(`Call Quality: ${cqRes.error}`);

    if (rsRes.ok) setRepSum(rsRes.data);
    // Rep summary may 403 for non-admins — not an error

    setErrors(errs);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={s.page}>
        <h1 style={s.pageTitle}>Accountability</h1>
        <p style={s.muted}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Accountability</h1>

      {errors.length > 0 && (
        <div style={s.errorBox}>
          {errors.map((e, i) => (
            <p key={i} style={s.errorLine}>
              {e}
            </p>
          ))}
        </div>
      )}

      {/* ──────── Follow-Up Discipline ──────── */}
      {followUp && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Follow-Up Discipline</h2>
          <div style={s.grid}>
            <Stat label="Completed" value={followUp.completed} color={FC.accentGreen} />
            <Stat label="Missed" value={followUp.missed} color={FC.accentRed} />
            <Stat label="Currently Overdue" value={followUp.currentlyOverdue} color={FC.accentAmber} />
            <Stat label="Cancelled" value={followUp.cancelled} />
            <Stat label="Duplicates Blocked" value={followUp.duplicatesBlocked} />
            <Stat label="Overrides Created" value={followUp.overridesCreated} />
            <Stat label="Anti-Gaming Warnings" value={followUp.antiGamingWarnings} color={FC.accentAmber} />
            <Stat label="Anti-Gaming Flags" value={followUp.antiGamingFlags} color={FC.accentRed} />
            <Stat label="Avg Reschedules" value={followUp.avgRescheduleCount.toFixed(1)} />
            <Stat label="Max Reschedules" value={followUp.maxRescheduleCount} />
          </div>
        </section>
      )}

      {/* ──────── Control / Ownership Behavior ──────── */}
      {control && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Control / Ownership Behavior</h2>
          <div style={s.grid}>
            <Stat label="Active Controls" value={control.activeControls} color={FC.accentBlue} />
            <Stat label="At Risk" value={control.atRiskControls} color={FC.accentAmber} />
            <Stat label="New in Period" value={control.newControlsInPeriod} />
            <Stat label="Paused" value={control.pausedControls} />
            <Stat label="Grace Extensions" value={control.graceExtensionsInPeriod} />
            <Stat label="Override Requests" value={control.overrideRequestsInPeriod} />
          </div>

          {control.releasesInPeriod.length > 0 && (
            <div style={s.subSection}>
              <h3 style={s.subTitle}>Releases in Period</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Reason</th>
                    <th style={s.th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {control.releasesInPeriod.map((r) => (
                    <tr key={r.reason}>
                      <td style={s.td}>{r.reason}</td>
                      <td style={s.td}>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {control.nearestTouchDeadline && (
            <p style={s.detail}>
              Nearest touch deadline:{" "}
              <strong>{control.nearestTouchDeadline.companyName}</strong> —{" "}
              {new Date(control.nearestTouchDeadline.touchDeadlineAt!).toLocaleDateString()}
            </p>
          )}
          {control.nearestControlDeadline && (
            <p style={s.detail}>
              Nearest control deadline:{" "}
              <strong>{control.nearestControlDeadline.companyName}</strong> —{" "}
              {new Date(control.nearestControlDeadline.controlDeadlineAt!).toLocaleDateString()}
            </p>
          )}
        </section>
      )}

      {/* ──────── Account Health ──────── */}
      {health && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Account Health</h2>
          <div style={s.grid}>
            <Stat label="Active" value={health.summary.active} color={FC.accentGreen} />
            <Stat label="At Risk" value={health.summary.atRisk} color={FC.accentAmber} />
            <Stat label="Stale" value={health.summary.stale} color={FC.accentAmber} />
            <Stat label="Critical" value={health.summary.critical} color={FC.accentRed} />
          </div>

          {health.accounts.length > 0 && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Company</th>
                  <th style={s.th}>State</th>
                  <th style={s.th}>Days Since Activity</th>
                </tr>
              </thead>
              <tbody>
                {health.accounts.map((a) => (
                  <tr key={a.customerId}>
                    <td style={s.td}>{a.companyName}</td>
                    <td style={s.td}>
                      <span
                        style={{
                          color: HEALTH_COLORS[a.healthState] ?? FC.textMuted,
                          fontWeight: 600,
                        }}
                      >
                        {a.healthState}
                      </span>
                    </td>
                    <td style={s.td}>
                      {a.businessDaysSince !== null ? a.businessDaysSince : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ──────── Call Execution Quality ──────── */}
      {callQ && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Call Execution Quality</h2>
          <div style={s.grid}>
            <Stat label="Total Calls" value={callQ.totalCalls} color={FC.accentBlue} />
            <Stat label="Recycle Events" value={callQ.recycleEvents} />
          </div>

          {callQ.outcomeDistribution.length > 0 && (
            <div style={s.subSection}>
              <h3 style={s.subTitle}>Outcome Distribution</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Outcome</th>
                    <th style={s.th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {callQ.outcomeDistribution.map((d) => (
                    <tr key={d.outcome}>
                      <td style={s.td}>{d.outcome}</td>
                      <td style={s.td}>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {callQ.originDistribution.length > 0 && (
            <div style={s.subSection}>
              <h3 style={s.subTitle}>Origin Distribution</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Origin</th>
                    <th style={s.th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {callQ.originDistribution.map((d) => (
                    <tr key={d.origin}>
                      <td style={s.td}>{d.origin}</td>
                      <td style={s.td}>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {callQ.noteSourceDistribution.length > 0 && (
            <div style={s.subSection}>
              <h3 style={s.subTitle}>Note Source Distribution</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Source</th>
                    <th style={s.th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {callQ.noteSourceDistribution.map((d) => (
                    <tr key={d.source}>
                      <td style={s.td}>{d.source}</td>
                      <td style={s.td}>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ──────── Rep Summary (Admin Only) ──────── */}
      {repSum && repSum.reps.length > 0 && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Rep Summary (Admin)</h2>
          <div style={{ overflowX: "auto" as const }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Rep</th>
                  <th style={s.th}>Calls</th>
                  <th style={s.th}>FU Completed</th>
                  <th style={s.th}>FU Missed</th>
                  <th style={s.th}>FU Overdue</th>
                  <th style={s.th}>Controls</th>
                  <th style={s.th}>At Risk</th>
                  <th style={s.th}>Released</th>
                  <th style={s.th}>Health: At Risk</th>
                  <th style={s.th}>Stale</th>
                  <th style={s.th}>Critical</th>
                </tr>
              </thead>
              <tbody>
                {repSum.reps.map((r) => (
                  <tr key={r.repUserId}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{r.repName}</td>
                    <td style={s.td}>{r.callQuality.totalCalls}</td>
                    <td style={s.td}>{r.followUps.completed}</td>
                    <td style={s.td}>
                      <span style={r.followUps.missed > 0 ? { color: FC.accentRed } : {}}>
                        {r.followUps.missed}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={r.followUps.currentlyOverdue > 0 ? { color: FC.accentAmber } : {}}>
                        {r.followUps.currentlyOverdue}
                      </span>
                    </td>
                    <td style={s.td}>{r.controls.active}</td>
                    <td style={s.td}>
                      <span style={r.controls.atRisk > 0 ? { color: FC.accentAmber } : {}}>
                        {r.controls.atRisk}
                      </span>
                    </td>
                    <td style={s.td}>{r.controls.releasedInPeriod}</td>
                    <td style={s.td}>{r.health.atRisk}</td>
                    <td style={s.td}>
                      <span style={r.health.stale > 0 ? { color: FC.accentAmber } : {}}>
                        {r.health.stale}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={r.health.critical > 0 ? { color: FC.accentRed } : {}}>
                        {r.health.critical}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statValue, color: color ?? FC.textPrimary }}>
        {value}
      </div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    padding: "32px 40px",
    maxWidth: 1280,
    margin: "0 auto",
    color: FC.textPrimary,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 32,
    letterSpacing: "-0.3px",
  },
  muted: {
    color: FC.textMuted,
    fontSize: 14,
  },
  errorBox: {
    background: FC.accentRedDim,
    border: `1px solid rgba(239, 68, 68, 0.3)`,
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 24,
  },
  errorLine: {
    color: FC.accentRed,
    fontSize: 13,
    margin: "4px 0",
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 16,
    color: FC.textPrimary,
    letterSpacing: "-0.2px",
  },
  subSection: {
    marginTop: 16,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: FC.textSecondary,
    marginBottom: 8,
  },
  detail: {
    fontSize: 13,
    color: FC.textSecondary,
    margin: "8px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    background: FC.surface,
    border: `1px solid ${FC.border}`,
    borderRadius: 8,
    padding: "14px 16px",
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: FC.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    background: FC.surface,
    borderRadius: 8,
  },
  th: {
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: FC.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
    textAlign: "left" as const,
    borderBottom: `1px solid ${FC.border}`,
  },
  td: {
    padding: "8px 12px",
    fontSize: 13,
    color: FC.textSecondary,
    borderBottom: `1px solid rgba(255, 255, 255, 0.04)`,
  },
};
