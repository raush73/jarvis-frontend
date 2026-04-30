'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { FC } from '../friday/styles';
import { apiFetch } from '@/lib/api';
import type { CompanyRecord, ContactRecord, DrawerTab } from './types';
import CompanyHeader from './CompanyHeader';
import ContactsPanel from './ContactsPanel';
import CompanyActivityPanel from './CompanyActivityPanel';

interface CompanyDrawerProps {
  customerId: string;
  onClose: () => void;
}

export default function CompanyDrawer({ customerId, onClose }: CompanyDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCompany = useCallback(async () => {
    try {
      const data = await apiFetch<CompanyRecord>(`/customers/${customerId}`);
      setCompany(data);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load company.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    setLoading(true);
    setCompany(null);
    setError('');
    setTab('overview');
    loadCompany();
  }, [customerId, loadCompany]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contacts: ContactRecord[] = Array.isArray(company?.contacts) ? company.contacts : [];

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: `Contacts (${contacts.length})` },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <>
      <div style={backdrop} onClick={onClose} />

      <div style={drawerPanel} role="dialog" aria-label="Company Detail">
        {/* Header */}
        <div style={drawerHeader}>
          <div style={drawerTitleRow}>
            <div style={drawerTitle}>
              {company?.name ?? 'Company Detail'}
            </div>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={tabBar}>
          {tabs.map((t) => (
            <button
              key={t.key}
              style={tab === t.key ? tabBtnActive : tabBtn}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={drawerBody}>
          {loading && (
            <div style={loadingState}>Loading company data...</div>
          )}

          {error && !loading && (
            <div style={errorBanner}>{error}</div>
          )}

          {!loading && !error && company && tab === 'overview' && (
            <CompanyHeader company={company} onRefresh={loadCompany} />
          )}

          {!loading && !error && company && tab === 'contacts' && (
            <ContactsPanel
              customerId={customerId}
              contacts={contacts}
              onRefresh={loadCompany}
            />
          )}

          {!loading && !error && company && tab === 'activity' && (
            <CompanyActivityPanel customerId={customerId} />
          )}
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
  padding: '16px 24px',
  borderBottom: `1px solid ${FC.border}`,
  flexShrink: 0,
};

const drawerTitleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  flex: 1,
};

const drawerTitle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: FC.textPrimary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
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

const tabBar: CSSProperties = {
  display: 'flex',
  gap: 0,
  padding: '0 24px',
  borderBottom: `1px solid ${FC.border}`,
  flexShrink: 0,
};

const tabBtn: CSSProperties = {
  padding: '10px 16px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: FC.textMuted,
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  transition: 'color 0.15s',
};

const tabBtnActive: CSSProperties = {
  ...tabBtn,
  color: FC.textPrimary,
  borderBottomColor: FC.accentPurple,
};

const drawerBody: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 24,
};

const loadingState: CSSProperties = {
  color: FC.textMuted,
  fontSize: '0.875rem',
  textAlign: 'center',
  padding: '40px 0',
};

const errorBanner: CSSProperties = {
  background: FC.accentRedDim,
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: '0.8125rem',
  color: FC.accentRed,
};
