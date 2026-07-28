"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import {
  type TradeOption,
  WorkforceApiError,
  getPrimaryTrade,
  getTradeRegistry,
  savePrimaryTrade,
} from "@/lib/workforce/workforceApi";

/**
 * Trade Selection screen (backend stage PRIMARY_TRADE).
 *
 * Trades come from the canonical active Trade Registry owned by Workforce
 * Administration; nothing is hardcoded here.
 */
export default function TradePage() {
  const [trades, setTrades] = useState<TradeOption[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [registry, current] = await Promise.all([
          getTradeRegistry(),
          getPrimaryTrade(),
        ]);
        if (cancelled) return;
        setTrades(registry);
        setSelected(current.primaryTradeId ?? "");
      } catch (err) {
        if (!cancelled) setStageError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? trades.filter((t) => t.name.toLowerCase().includes(needle))
      : trades;
  }, [query, trades]);

  const onSave = useCallback(async () => {
    if (!selected) {
      throw new WorkforceApiError("Please select your primary trade.", 400);
    }
    await savePrimaryTrade(selected);
  }, [selected]);

  return (
    <WorkforceWizardShell
      slug="trade"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="Choose the single trade that best describes the work you are qualified to perform. You can list additional experience in your work history."
    >
      <div className="wf-section">
        <input
          className="wf-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trades"
          style={{ marginBottom: 10 }}
        />

        {trades.length === 0 ? (
          <p className="wf-empty">
            No trades are available right now. Please try again later.
          </p>
        ) : visible.length === 0 ? (
          <p className="wf-empty">No trades match &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="wf-picker">
            {visible.map((trade) => (
              <label key={trade.id} className="wf-option">
                <input
                  type="radio"
                  name="primaryTrade"
                  checked={selected === trade.id}
                  onChange={() => setSelected(trade.id)}
                />
                <span>{trade.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </WorkforceWizardShell>
  );
}
