'use client';

import { useState, type CSSProperties } from 'react';
import { fridayFetch } from './fridayFetch';
import * as S from './styles';

interface ManualCallResult {
  callEventId: string;
  customerId: string;
  createdLead?: {
    customerId: string;
    name: string;
    phone: string;
    lifecycleStatus: string;
  };
}

interface ManualCallModalProps {
  onClose: () => void;
  onCallStarted: (result: ManualCallResult) => void;
}

export default function ManualCallModal({ onClose, onCallStarted }: ManualCallModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = companyName.trim().length > 0 && phoneNumber.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');

    const res = await fridayFetch<ManualCallResult>('/friday/calls/manual', {
      method: 'POST',
      body: JSON.stringify({
        companyName: companyName.trim(),
        phoneNumber: phoneNumber.trim(),
      }),
    });

    setBusy(false);

    if (res.ok) {
      onCallStarted(res.data);
    } else {
      if (res.status === 403) {
        setError('Access denied. You do not have permission to execute Friday calls.');
      } else {
        setError(res.error || 'Failed to create manual call.');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit && !busy) {
      handleSubmit();
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalTitle}>Manual Call</div>
        <p style={subtitleStyle}>
          Start a sales call outside the queue. A minimal lead record will be created if no existing record is selected.
        </p>

        {error && <div style={errorBanner}>{error}</div>}

        <div style={S.fieldGroup}>
          <label style={S.label}>Company Name *</label>
          <input
            type="text"
            style={S.input}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Acme Construction"
            autoFocus
            disabled={busy}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Phone Number *</label>
          <input
            type="tel"
            style={S.input}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. (555) 123-4567"
            disabled={busy}
          />
        </div>

        <div style={S.btnRow}>
          <button style={S.btnSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            style={{ ...S.btnPrimary, opacity: canSubmit ? 1 : 0.5 }}
            onClick={handleSubmit}
            disabled={!canSubmit || busy}
          >
            {busy ? 'Starting...' : 'Start Manual Call'}
          </button>
        </div>
      </div>
    </div>
  );
}

const subtitleStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: S.FC.textMuted,
  marginBottom: 20,
  lineHeight: 1.5,
};

const errorBanner: CSSProperties = {
  background: S.FC.accentRedDim,
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: '0.8125rem',
  color: S.FC.accentRed,
  marginBottom: 16,
};
