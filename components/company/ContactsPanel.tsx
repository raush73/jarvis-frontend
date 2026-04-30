'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContactRecord } from './types';
import { FC, btnPrimary, btnSecondary, input, label as labelStyle, fieldGroup } from '../friday/styles';
import { formatPhone } from '@/lib/format';
import { apiFetch } from '@/lib/api';

interface ContactsPanelProps {
  customerId: string;
  contacts: ContactRecord[];
  onRefresh: () => void;
}

function contactDisplayName(c: ContactRecord): string {
  const first = (c.firstName ?? '').trim();
  const last = (c.lastName ?? '').trim();
  return `${first} ${last}`.trim() || '—';
}

export default function ContactsPanel({ customerId, contacts, onRefresh }: ContactsPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div>
      <div style={headerRow}>
        <div style={sectionTitle}>Contacts ({contacts.length})</div>
        <button
          style={{ ...btnPrimary, padding: '6px 14px', fontSize: '0.75rem' }}
          onClick={() => { setShowAdd(true); setEditId(null); }}
        >
          + Add Contact
        </button>
      </div>

      {contacts.length === 0 && !showAdd && (
        <div style={emptyState}>No contacts yet — add one during discovery.</div>
      )}

      {contacts.map((c) => (
        editId === c.id ? (
          <ContactForm
            key={c.id}
            customerId={customerId}
            existing={c}
            onDone={() => { setEditId(null); onRefresh(); }}
            onCancel={() => setEditId(null)}
          />
        ) : (
          <ContactCard
            key={c.id}
            contact={c}
            onEdit={() => { setEditId(c.id); setShowAdd(false); }}
          />
        )
      ))}

      {showAdd && (
        <ContactForm
          customerId={customerId}
          onDone={() => { setShowAdd(false); onRefresh(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ─── Contact Card ────────────────────────────────────────────────────

function ContactCard({ contact, onEdit }: { contact: ContactRecord; onEdit: () => void }) {
  const name = contactDisplayName(contact);
  const phones = [
    contact.officePhone ? `Office: ${formatPhone(contact.officePhone)}` : null,
    contact.cellPhone ? `Cell: ${formatPhone(contact.cellPhone)}` : null,
  ].filter(Boolean);

  return (
    <div style={cardWrap}>
      <div style={cardHeader}>
        <div>
          <div style={cardName}>{name}</div>
          {contact.jobTitle && <div style={cardTitle}>{contact.jobTitle}</div>}
        </div>
        <button style={editBtn} onClick={onEdit}>Edit</button>
      </div>
      <div style={cardMeta}>
        {contact.email && <div style={metaLine}>{contact.email}</div>}
        {phones.map((p, i) => <div key={i} style={metaLine}>{p}</div>)}
      </div>
    </div>
  );
}

// ─── Contact Form (Add / Edit) ──────────────────────────────────────

interface ContactFormProps {
  customerId: string;
  existing?: ContactRecord;
  onDone: () => void;
  onCancel: () => void;
}

function ContactForm({ customerId, existing, onDone, onCancel }: ContactFormProps) {
  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [officePhone, setOfficePhone] = useState(existing?.officePhone ?? '');
  const [cellPhone, setCellPhone] = useState(existing?.cellPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!existing;
  const canSave = firstName.trim() && lastName.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
      if (jobTitle.trim()) payload.jobTitle = jobTitle.trim();
      if (email.trim()) payload.email = email.trim();
      if (officePhone.trim()) payload.officePhone = officePhone.trim();
      if (cellPhone.trim()) payload.cellPhone = cellPhone.trim();

      if (isEdit) {
        await apiFetch(`/customer-contacts/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/customer-contacts', {
          method: 'POST',
          body: JSON.stringify({ customerId, ...payload }),
        });
      }
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={formWrap}>
      <div style={formTitle}>{isEdit ? 'Edit Contact' : 'Add Contact'}</div>

      <div style={formRow}>
        <div style={fieldGroup}>
          <label style={labelStyle}>First Name *</label>
          <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Last Name *</label>
          <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" />
        </div>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Job Title</label>
        <input style={input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Plant Manager" />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Email</label>
        <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" type="email" />
      </div>

      <div style={formRow}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Office Phone</label>
          <input style={input} value={officePhone} onChange={(e) => setOfficePhone(e.target.value)} placeholder="Office" />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Cell Phone</label>
          <input style={input} value={cellPhone} onChange={(e) => setCellPhone(e.target.value)} placeholder="Cell" />
        </div>
      </div>

      {error && <div style={errorText}>{error}</div>}

      <div style={formActions}>
        <button style={btnSecondary} onClick={onCancel} disabled={saving}>Cancel</button>
        <button
          style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Contact'}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const sectionTitle: CSSProperties = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: FC.textPrimary,
};

const emptyState: CSSProperties = {
  fontSize: '0.8125rem',
  color: FC.textFaint,
  fontStyle: 'italic',
  padding: '20px 0',
  textAlign: 'center',
};

const cardWrap: CSSProperties = {
  background: FC.surface,
  border: `1px solid ${FC.border}`,
  borderRadius: 8,
  padding: 14,
  marginBottom: 8,
};

const cardHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
};

const cardName: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: FC.textPrimary,
};

const cardTitle: CSSProperties = {
  fontSize: '0.75rem',
  color: FC.textSecondary,
  marginTop: 2,
};

const editBtn: CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  border: `1px solid ${FC.borderStrong}`,
  borderRadius: 4,
  background: 'transparent',
  color: FC.textSecondary,
  cursor: 'pointer',
  flexShrink: 0,
};

const cardMeta: CSSProperties = {
  marginTop: 8,
};

const metaLine: CSSProperties = {
  fontSize: '0.75rem',
  color: FC.textSecondary,
  marginTop: 3,
};

const formWrap: CSSProperties = {
  background: 'rgba(139, 92, 246, 0.04)',
  border: '1px solid rgba(139, 92, 246, 0.18)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 8,
};

const formTitle: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
  color: FC.textPrimary,
  marginBottom: 14,
};

const formRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

const formActions: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 16,
};

const errorText: CSSProperties = {
  color: FC.accentRed,
  fontSize: '0.75rem',
  marginTop: 8,
};
