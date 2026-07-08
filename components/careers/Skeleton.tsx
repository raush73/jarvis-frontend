"use client";

/**
 * Jarvis Careers - shared loading skeleton primitive (Phase 7B.1 foundation).
 * Industrial Light V1 surface tokens. Used for dashboard placeholders and,
 * later, hub/detail loading states.
 */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
}) {
  return (
    <span
      className="careers-skeleton"
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    >
      <style jsx>{`
        .careers-skeleton {
          display: inline-block;
          background: linear-gradient(
            90deg,
            #eef2f7 25%,
            #e2e8f0 37%,
            #eef2f7 63%
          );
          background-size: 400% 100%;
          animation: careers-skeleton-shimmer 1.4s ease infinite;
        }
        @keyframes careers-skeleton-shimmer {
          0% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0 50%;
          }
        }
      `}</style>
    </span>
  );
}
