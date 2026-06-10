'use client';

import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { CompanyRecord } from './types';
import { FC, input, btnPrimary, btnSecondary } from '../friday/styles';
import { formatPhone } from '@/lib/format';
import { apiFetch } from '@/lib/api';

interface CompanyHeaderProps {
  company: CompanyRecord;
  onRefresh: () => void;
}

const LIFECYCLE_COLORS: Record<string, string> = {
  LEAD: FC.accentBlue,
  PROSPECT: FC.accentAmber,
  CUSTOMER: FC.accentGreen,
};

function resolveOwnerName(company: CompanyRecord): string | null {
  const sp = company.registrySalesperson;
  if (sp) {
    const firstLast = `${sp.firstName ?? ''} ${sp.lastName ?? ''}`.trim();
    return firstLast || null;
  }
  return null;
}

function buildAddress(company: CompanyRecord): string | null {
  const loc = company.locations?.[0];
  if (!loc) return null;
  const parts: string[] = [];
  if (loc.address1) parts.push(loc.address1);
  if (loc.address2) parts.push(loc.address2);
  const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
  if (cityState) parts.push(cityState);
  if (loc.zip) parts.push(loc.zip);
  return parts.length > 0 ? parts.join(' ') : null;
}

export default function CompanyHeader({ company, onRefresh }: CompanyHeaderProps) {
  const lifecycle = company.lifecycleStatus ?? 'UNKNOWN';
  const lifecycleColor = LIFECYCLE_COLORS[lifecycle] ?? FC.textMuted;
  const ownerName = resolveOwnerName(company);
  const address = buildAddress(company);
  const phone = company.phone;
  const website = company.websiteUrl;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(company.name);
  const [editWebsite, setEditWebsite] = useState(company.websiteUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = useCallback(() => {
    setEditName(company.name);
    setEditWebsite(company.websiteUrl ?? '');
    setError('');
    setEditing(true);
  }, [company]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setError('');
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string> = {};
      const trimName = editName.trim();
      const trimSite = editWebsite.trim();

      if (trimName && trimName !== company.name) payload.name = trimName;
      if (trimSite !== (company.websiteUrl ?? '')) payload.websiteUrl = trimSite;

      if (Object.keys(payload).length === 0) {
        setEditing(false);
        return;
      }

      await apiFetch(`/customers/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditing(false);
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }, [editName, editWebsite, company, onRefresh]);

  const hasAnyDetail = phone || website || ownerName || address;
  const isDnc = !!company.doNotCall;
  const dncReasonLabel = DNC_LABELS[company.doNotCallReason ?? ''] ?? company.doNotCallReason ?? null;
  const dncSetAt = company.doNotCallSetAt
    ? new Date(company.doNotCallSetAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const dncSetBy = company.doNotCallSetBy?.fullName ?? company.doNotCallSetBy?.email ?? null;

  return (
    <div style={wrapper}>
      {/* Do Not Call banner */}
      {isDnc && (
        <div style={dncBanner}>
          <div style={dncBannerTop}>
            <span style={dncBadge}>DO NOT CALL</span>
            {dncReasonLabel && <span style={dncDetail}>{dncReasonLabel}</span>}
          </div>
          {(dncSetAt || dncSetBy) && (
            <div style={dncMeta}>
              {dncSetAt && <span>Set {dncSetAt}</span>}
              {dncSetBy && <span> by {dncSetBy}</span>}
            </div>
          )}
        </div>
      )}

      {/* Name + lifecycle + edit toggle */}
      <div style={nameRow}>
        <div style={nameLeft}>
          {editing ? (
            <input
              style={{ ...input, fontSize: '1rem', fontWeight: 700, padding: '6px 10px' }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Company name"
            />
          ) : (
            <div style={companyNameStyle}>{company.name || 'Unnamed Company'}</div>
          )}
          <div style={lifecycleBadge(lifecycleColor)}>{lifecycle}</div>
        </div>
        {!editing && (
          <button style={editToggle} onClick={startEdit}>
            Edit
          </button>
        )}
      </div>

      {/* Editable website row */}
      {editing && (
        <div style={editSection}>
          <div style={editField}>
            <label style={fieldLabel}>Website</label>
            <input
              style={input}
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          {error && <div style={errorText}>{error}</div>}
          <div style={editActions}>
            <button style={btnSecondary} onClick={cancelEdit} disabled={saving}>Cancel</button>
            <button style={btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Info cards */}
      <div style={infoGrid}>
        {phone && <InfoCard label="Phone" value={formatPhone(phone)} />}
        {website && !editing && (
          <InfoCard label="Website" value={website} isLink />
        )}
        {ownerName && <InfoCard label="Owner" value={ownerName} />}
      </div>

      {/* Address */}
      {address && (
        <div style={addressBlock}>
          <span style={fieldLabel}>Location</span>
          <span style={infoValue}>{address}</span>
        </div>
      )}

      {/* Empty lead state */}
      {!hasAnyDetail && !editing && (
        <div style={emptyHint}>
          Minimal record — click Edit to add details during discovery.
        </div>
      )}

      {/* Non-editable limitations note */}
      {editing && (
        <div style={limitNote}>
          Only name and website can be edited here. Use the Edit Company button on Customer Detail for phone and address.
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div style={infoCard}>
      <span style={fieldLabel}>{label}</span>
      {isLink ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          style={linkValue}
        >
          {value}
        </a>
      ) : (
        <span style={infoValue}>{value}</span>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const wrapper: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: 20,
};

const nameRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 16,
};

const nameLeft: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flex: 1,
  minWidth: 0,
};

const companyNameStyle: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: FC.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function lifecycleBadge(color: string): CSSProperties {
  return {
    fontSize: '0.625rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 4,
    color,
    background: `${color}22`,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    flexShrink: 0,
  };
}

const editToggle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 4,
  background: 'transparent',
  color: FC.accentPurple,
  cursor: 'pointer',
  flexShrink: 0,
};

const editSection: CSSProperties = {
  background: 'rgba(139, 92, 246, 0.04)',
  border: '1px solid rgba(139, 92, 246, 0.18)',
  borderRadius: 6,
  padding: 14,
  marginBottom: 16,
};

const editField: CSSProperties = {
  marginBottom: 12,
};

const fieldLabel: CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
};

const editActions: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
};

const infoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px 16px',
};

const infoCard: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const infoValue: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.textPrimary,
  wordBreak: 'break-word',
};

const linkValue: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.accentBlue,
  textDecoration: 'none',
  wordBreak: 'break-word',
};

const addressBlock: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  marginTop: 12,
  paddingTop: 12,
  borderTop: `1px solid ${FC.border}`,
};

const emptyHint: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.textFaint,
  fontStyle: 'italic',
  marginTop: 4,
};

const errorText: CSSProperties = {
  color: FC.accentRed,
  fontSize: '0.75rem',
  marginBottom: 8,
};

const limitNote: CSSProperties = {
  fontSize: '0.6875rem',
  color: FC.textFaint,
  fontStyle: 'italic',
  marginTop: 12,
  paddingTop: 10,
  borderTop: `1px solid ${FC.border}`,
};

// ─── Do Not Call ─────────────────────────────────────────────────────

const DNC_LABELS: Record<string, string> = {
  UNION: 'Union',
  OUT_OF_SCOPE_INDUSTRY: 'Out of Scope Industry',
  BAD_FIT: 'Bad Fit',
  COMPETITOR: 'Competitor',
  HOSTILE: 'Hostile',
};

const dncBanner: CSSProperties = {
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  borderLeft: `4px solid ${FC.accentRed}`,
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 14,
};

const dncBannerTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 4,
};

const dncBadge: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  color: FC.accentRed,
  textTransform: 'uppercase',
};

const dncDetail: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
  color: FC.accentRed,
  opacity: 0.85,
};

const dncMeta: CSSProperties = {
  fontSize: '0.6875rem',
  color: FC.textMuted,
};
