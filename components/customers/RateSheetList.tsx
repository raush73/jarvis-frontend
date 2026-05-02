'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface RateSheetSummary {
  id: string;
  rateSheetNumber: string | null;
  status: string;
  title: string | null;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  _count?: { lines: number };
}

interface Props {
  customerId: string;
  onSelect: (id: string) => void;
  refreshKey?: number;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: '#d97706', bg: '#fffbeb' },
  ACTIVE: { color: '#16a34a', bg: '#f0fdf4' },
  EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
  SUPERSEDED: { color: '#6b7280', bg: '#f3f4f6' },
};

export default function RateSheetList({ customerId, onSelect, refreshKey }: Props) {
  const [sheets, setSheets] = useState<RateSheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<RateSheetSummary[]>(
          `/commercial/customers/${customerId}/rate-sheets`
        );
        if (!alive) return;
        setSheets(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Failed to load rate sheets');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId, refreshKey]);

  if (loading) return <div style={S.loading}>Loading rate sheets...</div>;
  if (error) return <div style={S.error}>{error}</div>;
  if (sheets.length === 0) return <div style={S.empty}>No rate sheets yet.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr>
            {['Number','Status','Title','Valid Until','Lines','Created'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheets.map((rs) => {
            const statusStyle = STATUS_STYLES[rs.status] ?? STATUS_STYLES.EXPIRED;
            return (
              <tr key={rs.id} onClick={() => onSelect(rs.id)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>{rs.rateSheetNumber ?? '—'}</td>
                <td style={S.td}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: statusStyle.color, background: statusStyle.bg }}>
                    {rs.status}
                  </span>
                </td>
                <td style={{ ...S.td, color: '#374151' }}>{rs.title || '—'}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {rs.expiresAt ? new Date(rs.expiresAt).toLocaleDateString('en-US') : '—'}
                </td>
                <td style={{ ...S.td, textAlign: 'center', color: '#374151' }}>{rs._count?.lines ?? 0}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {new Date(rs.createdAt).toLocaleDateString('en-US')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const S = {
  loading: { padding: '24px 0', textAlign: 'center' as const, color: '#6b7280', fontSize: 14 },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 },
  empty: { padding: '24px 0', textAlign: 'center' as const, color: '#9ca3af', fontSize: 14, fontStyle: 'italic' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 13 },
};
