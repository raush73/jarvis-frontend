'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface CandidateSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  candidateTrades: Array<{ trade: { id: string; name: string } }>;
}

interface CandidateSearchSelectProps {
  onSelect: (candidate: CandidateSearchResult) => void;
  placeholder?: string;
}

export function CandidateSearchSelect({ onSelect, placeholder = 'Search by name...' }: CandidateSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CandidateSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<CandidateSearchResult[]>(
        `/recruiting/candidate-search?q=${encodeURIComponent(q.trim())}`,
      );
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (candidate: CandidateSearchResult) => {
    const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
    setQuery(name);
    setOpen(false);
    onSelect(candidate);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '9px 11px',
          background: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 13,
          color: '#111827',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {loading && (
        <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 11, color: '#9ca3af' }}>
          Searching...
        </span>
      )}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          marginTop: 2,
          maxHeight: 240,
          overflowY: 'auto',
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
              No candidates found
            </div>
          )}
          {results.map((c) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '(unnamed)';
            const primaryTrade = c.candidateTrades?.[0]?.trade?.name;
            return (
              <div
                key={c.id}
                onClick={() => handleSelect(c)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#ffffff'; }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{name}</div>
                {primaryTrade && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{primaryTrade}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
