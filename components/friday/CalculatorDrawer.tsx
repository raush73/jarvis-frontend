'use client';

import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { FC } from './styles';

interface CalculatorDrawerProps {
  onClose: () => void;
}

export default function CalculatorDrawer({ onClose }: CalculatorDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div style={backdrop} onClick={onClose} />

      <div style={drawerPanel} role="dialog" aria-label="Labor Cost Calculator">
        {/* Header */}
        <div style={drawerHeader}>
          <div style={drawerTitle}>Labor Cost Calculator</div>
          <button style={closeBtn} onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* Guardrail Banner */}
        <div style={guardrailBanner}>
          Internal conversation support only. Not a quote. Final pricing requires a formal Quote.
        </div>

        {/* Body */}
        <div style={drawerBody}>
          <div style={placeholderText}>Calculator inputs coming in S3.</div>
        </div>
      </div>
    </>
  );
}

const DRAWER_Z = 900;

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  zIndex: DRAWER_Z,
  backdropFilter: 'blur(2px)',
};

const drawerPanel: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 560,
  background: '#1a1d24',
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
  padding: '16px 24px',
  borderBottom: `1px solid ${FC.border}`,
  flexShrink: 0,
};

const drawerTitle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: FC.textPrimary,
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
  flexShrink: 0,
};

const guardrailBanner: CSSProperties = {
  padding: '10px 24px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: FC.accentAmber,
  background: FC.accentAmberDim,
  borderBottom: `1px solid rgba(245, 158, 11, 0.2)`,
  flexShrink: 0,
};

const drawerBody: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 24,
};

const placeholderText: CSSProperties = {
  color: FC.textMuted,
  fontSize: '0.875rem',
  textAlign: 'center',
  padding: '60px 0',
};
