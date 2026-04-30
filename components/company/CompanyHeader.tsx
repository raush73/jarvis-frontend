'use client';

import type { CSSProperties } from 'react';
import type { CompanyRecord } from './types';
import { FC } from '../friday/styles';
import { formatPhone } from '@/lib/format';

interface CompanyHeaderProps {
  company: CompanyRecord;
}

const LIFECYCLE_COLORS: Record<string, string> = {
  LEAD: FC.accentBlue,
  PROSPECT: FC.accentAmber,
  CUSTOMER: FC.accentGreen,
};

function resolveOwnerName(company: CompanyRecord): string | null {
  const sp = company.registrySalesperson;
  if (sp) {
    const full = typeof sp.fullName === 'string' ? sp.fullName.trim() : '';
    const firstLast = `${sp.firstName ?? ''} ${sp.lastName ?? ''}`.trim();
    return full || firstLast || sp.email || null;
  }
  return company.ownerSalespersonName ?? null;
}

function buildAddress(company: CompanyRecord): string | null {
  const parts: string[] = [];
  if (company.street) parts.push(company.street);
  const cityState = [company.city, company.state].filter(Boolean).join(', ');
  if (cityState) parts.push(cityState);
  if (company.zipCode) parts.push(company.zipCode);
  return parts.length > 0 ? parts.join(' ') : null;
}

export default function CompanyHeader({ company }: CompanyHeaderProps) {
  const lifecycle = company.lifecycleStatus ?? 'UNKNOWN';
  const lifecycleColor = LIFECYCLE_COLORS[lifecycle] ?? FC.textMuted;
  const ownerName = resolveOwnerName(company);
  const address = buildAddress(company);
  const phone = company.phone;
  const website = company.website || company.domain;

  return (
    <div style={wrapper}>
      {/* Name + lifecycle */}
      <div style={nameRow}>
        <div style={companyName}>{company.name || 'Unnamed Company'}</div>
        <div style={lifecycleBadge(lifecycleColor)}>{lifecycle}</div>
      </div>

      {/* Info grid */}
      <div style={infoGrid}>
        {phone && (
          <InfoItem label="Phone" value={formatPhone(phone)} />
        )}
        {website && (
          <InfoItem label="Website" value={website} isLink />
        )}
        {ownerName && (
          <InfoItem label="Owner" value={ownerName} />
        )}
        {company.primaryIndustry && (
          <InfoItem label="Industry" value={company.primaryIndustry} />
        )}
      </div>

      {/* Address */}
      {address && (
        <div style={addressRow}>
          <span style={infoLabel}>Location</span>
          <span style={infoValue}>{address}</span>
        </div>
      )}

      {/* Empty lead state */}
      {!phone && !website && !ownerName && !address && (
        <div style={emptyHint}>
          Minimal record — add details during discovery.
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>{label}</span>
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

const companyName: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: FC.textPrimary,
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

const infoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px 16px',
};

const infoItem: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const infoLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: FC.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
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

const addressRow: CSSProperties = {
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
