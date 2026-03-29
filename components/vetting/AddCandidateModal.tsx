'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CandidateSearchSelect, CandidateSearchResult } from './CandidateSearchSelect';

export interface TradeLineOption {
  id: string;
  tradeId: string;
  tradeName: string;
  startDate?: string | null;
  expectedEndDate?: string | null;
  requestedHeadcount?: number;
}

interface AddCandidateModalProps {
  orderId: string;
  tradeLines: TradeLineOption[];
  entrySource: 'OPENINGS_HUB' | 'DIRECT_ADD';
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCandidateModal({
  orderId,
  tradeLines,
  entrySource,
  onClose,
  onSuccess,
}: AddCandidateModalProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSearchResult | null>(null);
  const [selectedTradeLineId, setSelectedTradeLineId] = useState(tradeLines.length === 1 ? tradeLines[0].id : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = selectedCandidate && selectedTradeLineId && !submitting;

  const handleSubmit = async () => {
    if (!selectedCandidate || !selectedTradeLineId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/recruiting/opt-in', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          orderTradeRequirementId: selectedTradeLineId,
          candidateId: selectedCandidate.id,
          entrySource,
          entryMethod: 'PHONE',
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add candidate';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="modal-content" style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Candidate</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Candidate</label>
            <CandidateSearchSelect
              onSelect={(c) => { setSelectedCandidate(c); setError(null); }}
              placeholder="Type candidate name..."
            />
            {selectedCandidate && (
              <div className="selected-candidate">
                {[selectedCandidate.firstName, selectedCandidate.lastName].filter(Boolean).join(' ')}
                {selectedCandidate.candidateTrades?.[0]?.trade?.name && (
                  <span className="selected-trade-hint">
                    {' '}— {selectedCandidate.candidateTrades[0].trade.name}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Trade Line</label>
            {tradeLines.length === 0 ? (
              <div className="no-trades">No trade lines available for this order</div>
            ) : tradeLines.length === 1 ? (
              <div className="single-trade">
                <span className="trade-name">{tradeLines[0].tradeName}</span>
                {tradeLines[0].startDate && (
                  <span className="trade-dates">
                    {new Date(tradeLines[0].startDate).toLocaleDateString()}
                    {tradeLines[0].expectedEndDate && ` — ${new Date(tradeLines[0].expectedEndDate).toLocaleDateString()}`}
                  </span>
                )}
              </div>
            ) : (
              <select
                value={selectedTradeLineId}
                onChange={(e) => setSelectedTradeLineId(e.target.value)}
                className="trade-select"
              >
                <option value="">Select trade line...</option>
                {tradeLines.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.tradeName}
                    {tl.requestedHeadcount ? ` (${tl.requestedHeadcount} needed)` : ''}
                    {tl.startDate ? ` — starts ${new Date(tl.startDate).toLocaleDateString()}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}
          {success && <div className="success-msg">Candidate added successfully</div>}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? 'Adding...' : 'Add to Opt-In'}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(17, 24, 39, 0.45);
            backdrop-filter: blur(2px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .modal-content {
            width: 100%;
            max-width: 440px;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 18px;
            background: #f1f5f9;
            border-bottom: 1px solid #e5e7eb;
          }
          .modal-header h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #111827;
          }
          .close-btn {
            width: 28px;
            height: 28px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            color: #374151;
            font-size: 18px;
            cursor: pointer;
            transition: background 0.12s ease;
          }
          .close-btn:hover { background: #f1f5f9; }
          .modal-body { padding: 18px; }
          .form-group { margin-bottom: 16px; }
          .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 6px;
          }
          .selected-candidate {
            margin-top: 6px;
            padding: 6px 10px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 5px;
            font-size: 12px;
            font-weight: 600;
            color: #1d4ed8;
          }
          .selected-trade-hint {
            font-weight: 400;
            color: #6b7280;
          }
          .trade-select {
            width: 100%;
            padding: 9px 11px;
            background: #ffffff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            color: #111827;
            outline: none;
            cursor: pointer;
          }
          .trade-select:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
          }
          .single-trade {
            padding: 9px 11px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .trade-name {
            font-size: 13px;
            font-weight: 600;
            color: #111827;
          }
          .trade-dates {
            font-size: 11px;
            color: #6b7280;
          }
          .no-trades {
            padding: 12px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }
          .error-msg {
            padding: 8px 12px;
            background: #fff1f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            font-size: 12px;
            color: #dc2626;
          }
          .success-msg {
            padding: 8px 12px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 6px;
            font-size: 12px;
            color: #16a34a;
            font-weight: 600;
          }
          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 14px 18px;
            border-top: 1px solid #e5e7eb;
          }
          .cancel-btn {
            padding: 8px 16px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 7px;
            color: #374151;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.12s ease;
          }
          .cancel-btn:hover { background: #f1f5f9; border-color: #d1d5db; }
          .submit-btn {
            padding: 8px 20px;
            background: #2563eb;
            border: none;
            border-radius: 7px;
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.12s ease;
          }
          .submit-btn:hover:not(:disabled) { background: #1d4ed8; }
          .submit-btn:disabled { background: #bfdbfe; color: #6b7280; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
