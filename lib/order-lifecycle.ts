/**
 * Order lifecycle phase mapping for UI display.
 *
 * Maps raw DB statuses (DRAFT, NEEDS_TO_BE_FILLED, FILLED, COMPLETED,
 * CANCELLED) to the four operational phases shown to users.
 */

export type OrderPhase = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const STATUS_TO_PHASE: Record<string, OrderPhase> = {
  DRAFT: 'DRAFT',
  NEEDS_TO_BE_FILLED: 'ACTIVE',
  FILLED: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export function getOrderPhase(status: string): OrderPhase {
  const exact = STATUS_TO_PHASE[status];
  if (exact) return exact;

  // UI-only draft variants (e.g. "Draft (UI-only)") map to DRAFT intentionally
  if (status.toUpperCase().includes('DRAFT')) return 'DRAFT';

  // Unknown status — default to DRAFT as the safest read-only-safe phase.
  // This should not occur in production; if it does, the UI will render a
  // grey badge and no lifecycle actions, which is the least-harmful fallback.
  return 'DRAFT';
}

export function getPhaseLabel(phase: OrderPhase): string {
  switch (phase) {
    case 'DRAFT': return 'Draft';
    case 'ACTIVE': return 'Active';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
  }
}

export function getPhaseBadgeClass(phase: OrderPhase): string {
  switch (phase) {
    case 'DRAFT': return 'phase-draft';
    case 'ACTIVE': return 'phase-active';
    case 'COMPLETED': return 'phase-completed';
    case 'CANCELLED': return 'phase-cancelled';
  }
}

export const PHASE_BADGE_STYLES = `
  .phase-badge { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
  .phase-badge.phase-draft { background: rgba(148,163,184,0.15); color: #94a3b8; }
  .phase-badge.phase-active { background: rgba(34,197,94,0.15); color: #22c55e; }
  .phase-badge.phase-completed { background: rgba(100,116,139,0.15); color: #64748b; }
  .phase-badge.phase-cancelled { background: rgba(239,68,68,0.15); color: #ef4444; }
`;
