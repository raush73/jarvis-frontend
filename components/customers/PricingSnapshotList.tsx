'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface PricingSnapshot {
  id: string;
  customerId: string;
  payloadJson: any;
  notes: string | null;
  state: string | null;
  tradeCode: string | null;
  createdAt: string;
}

interface Props {
  customerId: string;
}

export default function PricingSnapshotList({ customerId }: Props) {
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<PricingSnapshot[]>(
          `/commercial/customers/${customerId}/pricing-snapshots`
        );
        if (!alive) return;
        setSnapshots(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Failed to load pricing snapshots');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  if (loading) return <div style={S.loading}>Loading pricing snapshots...</div>;
  if (error) return <div style={S.error}>{error}</div>;
  if (snapshots.length === 0) return <div style={S.empty}>No pricing snapshots yet.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {snapshots.map((s) => {
        const date = new Date(s.createdAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });
        const isExpanded = expandedId === s.id;

        return (
          <div key={s.id} style={S.card}>
            <div style={S.header} onClick={() => setExpandedId(isExpanded ? null : s.id)}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{date}</span>
                {s.tradeCode && <span style={S.badge}>{s.tradeCode}</span>}
                {s.state && <span style={S.badge}>{s.state}</span>}
                <span style={{ ...S.badge, color: '#9ca3af' }}>Internal</span>
              </div>
              <button style={{ background: 'none', border: 'none', fontSize: 14, color: '#9ca3af', cursor: 'pointer' }}>{isExpanded ? '▾' : '▸'}</button>
            </div>
            {s.notes && <div style={{ padding: '4px 14px 8px', fontSize: 13, color: '#4b5563' }}>{s.notes}</div>}
            {isExpanded && (
              <div style={{ padding: '8px 14px 12px', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                <pre style={{ margin: 0, fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto' }}>{JSON.stringify(s.payloadJson, null, 2)}</pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const S = {
  loading: { padding: '24px 0', textAlign: 'center' as const, color: '#6b7280', fontSize: 14 },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 },
  empty: { padding: '24px 0', textAlign: 'center' as const, color: '#9ca3af', fontSize: 14, fontStyle: 'italic' as const },
  card: { border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff', overflow: 'hidden' as const },
  header: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: '10px 14px', cursor: 'pointer' },
  badge: { display: 'inline-block' as const, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#4b5563', background: '#f3f4f6', border: '1px solid #e5e7eb' },
};
