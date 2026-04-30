'use client';

import { useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { FC } from '../friday/styles';

interface CompanyDrawerProps {
  customerId: string;
  onClose: () => void;
}

export default function CompanyDrawer({ customerId, onClose }: CompanyDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Backdrop — click to close */}
      <div style={backdrop} onClick={onClose} />

      {/* Drawer panel — right side */}
      <div style={drawerPanel} role="dialog" aria-label="Company Detail">
        {/* Header */}
        <div style={drawerHeader}>
          <div style={drawerTitleRow}>
            <div style={drawerTitle}>Company Detail</div>
            <div style={drawerBadge}>Phase A</div>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* Phase A placeholder content */}
        <div style={drawerBody}>
          <div style={placeholderCard}>
            <div style={placeholderLabel}>Customer ID</div>
            <div style={placeholderValue}>{customerId}</div>
          </div>

          <div style={placeholderNotice}>
            <div style={noticeIcon}>🏗</div>
            <div style={noticeTitle}>Drawer Shell Active</div>
            <div style={noticeDesc}>
              Company Detail panels will be wired in Phase B (Overview, Contacts)
              and Phase C (Activity, History). This shell validates that the drawer
              opens, closes, and preserves active call state.
            </div>
          </div>

          <div style={tabPreview}>
            <div style={tabPreviewLabel}>Planned Tabs</div>
            <div style={tabRow}>
              {['Overview', 'Contacts', 'Activity', 'History'].map((t) => (
                <div key={t} style={tabItem}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const DRAWER_Z = 900;

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.35)',
  zIndex: DRAWER_Z,
  backdropFilter: 'blur(2px)',
};

const drawerPanel: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '60%',
  minWidth: 400,
  maxWidth: 780,
  background: '#0f1117',
  borderLeft: `1px solid ${FC.borderStrong}`,
  zIndex: DRAWER_Z + 1,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
  overflow: 'hidden',
};

const drawerHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 24px',
  borderBottom: `1px solid ${FC.border}`,
  flexShrink: 0,
};

const drawerTitleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const drawerTitle: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: FC.textPrimary,
};

const drawerBadge: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 4,
  color: FC.accentPurple,
  background: 'rgba(139, 92, 246, 0.15)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const closeBtn: CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  color: FC.textMuted,
  background: 'transparent',
  border: `1px solid ${FC.border}`,
  borderRadius: 6,
  cursor: 'pointer',
};

const drawerBody: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 24,
};

const placeholderCard: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
};

const placeholderLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
};

const placeholderValue: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: FC.textPrimary,
  fontFamily: 'monospace',
  wordBreak: 'break-all',
};

const placeholderNotice: CSSProperties = {
  background: 'rgba(139, 92, 246, 0.06)',
  border: '1px solid rgba(139, 92, 246, 0.18)',
  borderRadius: 10,
  padding: 24,
  textAlign: 'center',
  marginBottom: 20,
};

const noticeIcon: CSSProperties = {
  fontSize: 32,
  marginBottom: 12,
};

const noticeTitle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: FC.textPrimary,
  marginBottom: 8,
};

const noticeDesc: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.textSecondary,
  lineHeight: 1.5,
  maxWidth: 440,
  margin: '0 auto',
};

const tabPreview: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: 16,
};

const tabPreviewLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 10,
};

const tabRow: CSSProperties = {
  display: 'flex',
  gap: 6,
};

const tabItem: CSSProperties = {
  flex: 1,
  padding: '8px 0',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.textFaint,
  textAlign: 'center',
  background: 'rgba(255, 255, 255, 0.03)',
  border: `1px solid ${FC.border}`,
  borderRadius: 6,
};
