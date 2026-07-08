"use client";

/**
 * Jarvis Careers - generic status pill (Industrial Light V1).
 * Reused across Careers entities (Positions here; Postings/Applications later).
 */
export type BadgeTone = "neutral" | "success" | "info" | "warn" | "danger";

const TONES: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  neutral: { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
  success: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  info: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  warn: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  danger: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const c = TONES[tone];
  return (
    <span
      className="careers-status-badge"
      style={{ background: c.bg, color: c.color, borderColor: c.border }}
    >
      {label}
      <style jsx>{`
        .careers-status-badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 3px 9px;
          border-radius: 999px;
          border: 1px solid transparent;
          white-space: nowrap;
        }
      `}</style>
    </span>
  );
}

export function positionStatusTone(isActive: boolean): BadgeTone {
  return isActive ? "success" : "neutral";
}
