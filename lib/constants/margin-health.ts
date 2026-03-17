import type { MarginHealthStatus } from "../types/order";

export const MARGIN_HEALTH_THRESHOLDS = {
  RED_BELOW_PCT: 19.5,
  YELLOW_BELOW_PCT: 21.0,
} as const;

export function classifyMarginHealth(
  grossMarginPct: number,
): MarginHealthStatus {
  if (grossMarginPct < MARGIN_HEALTH_THRESHOLDS.RED_BELOW_PCT) return "RED";
  if (grossMarginPct < MARGIN_HEALTH_THRESHOLDS.YELLOW_BELOW_PCT)
    return "YELLOW";
  return "GREEN";
}

export const HEALTH_STATUS_COLORS: Record<MarginHealthStatus, string> = {
  RED: "#ef4444",
  YELLOW: "#eab308",
  GREEN: "#22c55e",
};

export const HEALTH_STATUS_LABELS: Record<MarginHealthStatus, string> = {
  RED: "Risk",
  YELLOW: "Watch",
  GREEN: "Healthy",
};
