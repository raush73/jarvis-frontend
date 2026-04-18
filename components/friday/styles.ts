import type { CSSProperties } from 'react';

export const FC = {
  bg: '#0c0f14',
  surface: 'rgba(255, 255, 255, 0.04)',
  surfaceHover: 'rgba(255, 255, 255, 0.06)',
  surfaceActive: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textFaint: 'rgba(255, 255, 255, 0.35)',
  accentBlue: '#3b82f6',
  accentBlueDim: 'rgba(59, 130, 246, 0.15)',
  accentPurple: '#8b5cf6',
  accentGreen: '#22c55e',
  accentGreenDim: 'rgba(34, 197, 94, 0.15)',
  accentAmber: '#f59e0b',
  accentAmberDim: 'rgba(245, 158, 11, 0.15)',
  accentRed: '#ef4444',
  accentRedDim: 'rgba(239, 68, 68, 0.15)',

  statusOpen: '#3b82f6',
  statusCompleted: '#22c55e',
  statusMissed: '#ef4444',
  statusCancelled: '#6b7280',
} as const;

export const STATUS_COLORS: Record<string, string> = {
  OPEN: FC.statusOpen,
  COMPLETED: FC.statusCompleted,
  MISSED: FC.statusMissed,
  CANCELLED: FC.statusCancelled,
};

export const STATUS_BG: Record<string, string> = {
  OPEN: FC.accentBlueDim,
  COMPLETED: FC.accentGreenDim,
  MISSED: FC.accentRedDim,
  CANCELLED: 'rgba(107, 114, 128, 0.15)',
};

export const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)',
};

export const modal: CSSProperties = {
  background: '#1a1d24',
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 12,
  padding: '24px',
  width: '100%',
  maxWidth: 560,
  maxHeight: '85vh',
  overflowY: 'auto',
  color: FC.textPrimary,
};

export const modalTitle: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  marginBottom: 20,
  color: FC.textPrimary,
};

export const label: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.textSecondary,
  marginBottom: 4,
};

export const input: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '0.8125rem',
  background: 'rgba(255, 255, 255, 0.06)',
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 6,
  color: FC.textPrimary,
  outline: 'none',
};

export const select: CSSProperties = {
  ...input,
  colorScheme: 'dark',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23999' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
};

export const textarea: CSSProperties = {
  ...input,
  minHeight: 80,
  resize: 'vertical' as const,
};

export const fieldGroup: CSSProperties = {
  marginBottom: 16,
};

export const fieldRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 16,
};

export const btnPrimary: CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  background: FC.accentBlue,
  color: '#fff',
  cursor: 'pointer',
};

export const btnSecondary: CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.8125rem',
  fontWeight: 500,
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 6,
  background: 'transparent',
  color: FC.textSecondary,
  cursor: 'pointer',
};

export const btnDanger: CSSProperties = {
  ...btnSecondary,
  color: FC.accentRed,
  borderColor: 'rgba(239, 68, 68, 0.3)',
};

export const btnSmall: CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 4,
  background: 'transparent',
  color: FC.textSecondary,
  cursor: 'pointer',
};

export const btnRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 20,
  justifyContent: 'flex-end',
};

export const errorText: CSSProperties = {
  color: FC.accentRed,
  fontSize: '0.75rem',
  marginTop: 4,
};

export const helpText: CSSProperties = {
  color: FC.textFaint,
  fontSize: '0.6875rem',
  marginTop: 3,
};

export const sectionTitle: CSSProperties = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: FC.textPrimary,
  marginBottom: 12,
};

export const card: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: '16px',
  marginBottom: 12,
};

export const thStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  textAlign: 'left',
  borderBottom: `1px solid ${FC.border}`,
};

export const tdStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: '0.8125rem',
  color: FC.textSecondary,
  borderBottom: `1px solid rgba(255, 255, 255, 0.04)`,
};

export function statusBadgeStyle(status: string): CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: STATUS_COLORS[status] ?? FC.textMuted,
    background: STATUS_BG[status] ?? FC.surface,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };
}
