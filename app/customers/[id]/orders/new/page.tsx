"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

// OT Multiplier constraints
const OT_MULTIPLIER_MIN = 1.47;
const OT_MULTIPLIER_DEFAULT = 1.5;

// Available trades for dropdown
const AVAILABLE_TRADES = [
  "Millwright",
  "Electrician",
  "Pipefitter",
  "Welder",
  "Rigger",
  "Crane Operator",
  "HVAC Technician",
  "Ironworker",
  "Carpenter",
  "Plumber",
];

// Mock person list for commission splits
const MOCK_PERSONS = [
  "Jordan Miles",
  "Sarah Chen",
  "Mike Thompson",
  "Lisa Rodriguez",
  "David Kim",
];

// Commission roles
const COMMISSION_ROLES = ["Sales", "Recruiting", "Admin", "Other"];

// Trade line type
type TradeLine = {
  trade: string;
  projectName: string;
  headcount: number;
  hours: number;
  basePay: number;
  billRate: number;
  otMultiplier: number;
  // System-owned placeholders
  burdenedPay: number;
  gmPerHr: number;
  gmPct: number;
  health: "Good" | "Watch" | "Risk";
};

// Commission split type
type CommissionSplit = {
  person: string;
  role: string;
  splitPct: number;
};

// Order modifiers type
type OrderModifiers = {
  perDiem: number;
  travel: number;
  bonuses: number;
};

// SD delta rates type
type SDDeltaRates = {
  sdPayDeltaRate: number | null;
  sdBillDeltaRate: number | null;
};

// Helper to generate order ID
function generateOrderId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 900) + 100;
  return `ORD-${year}-${num}`;
}

const MOCK_CERTIFICATIONS = [
  "OSHA 10",
  "OSHA 30",
  "MSHA",
  "NCCER",
  "Confined Space",
  "Fall Protection",
  "Forklift Certified",
  "Rigging Certified",
];

// MW4H Standard Tool List (mock)
const MW4H_STANDARD_TOOLS = [
  "Hard Hat",
  "FR Clothing",
  "Steel Toe Boots",
  "Safety Glasses",
  "Gloves",
  "Basic Hand Tools",
];

// Job requirements type
type JobRequirements = {
  tools: string[];
  useCustomerToolList: boolean;
  useMW4HStandardToolList: boolean;
  certifications: string[];
  ppe: string[];
};

// Create empty trade line
function createEmptyTradeLine(): TradeLine {
  return {
    trade: "Millwright",
    projectName: "",
    headcount: 1,
    hours: 40,
    basePay: 30,
    billRate: 55,
    otMultiplier: OT_MULTIPLIER_DEFAULT,
    // System-owned placeholders
    burdenedPay: 36,
    gmPerHr: 19,
    gmPct: 34.5,
    health: "Good",
  };
}

// Create empty commission split
function createEmptyCommissionSplit(defaultPerson: string): CommissionSplit {
  return {
    person: defaultPerson,
    role: "Sales",
    splitPct: 100,
  };
}

export default function CreateOrderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = params.id as string;

  const fromQuote = searchParams.get("fromQuote");
  const orderId = searchParams.get("orderId");

  // Order metadata
  const [orderName, setOrderName] = useState("");
  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // Trade lines
  const [tradeLines, setTradeLines] = useState<TradeLine[]>([createEmptyTradeLine()]);

  // Modifiers
  const [modifiers, setModifiers] = useState<OrderModifiers>({
    perDiem: 100,
    travel: 0.58,
    bonuses: 0,
  });

  // SD Delta Rates
  const [sdDeltaRates, setSDDeltaRates] = useState<SDDeltaRates>({
    sdPayDeltaRate: null,
    sdBillDeltaRate: null,
  });

  // Commission splits
  const [commissionSplits, setCommissionSplits] = useState<CommissionSplit[]>([
    createEmptyCommissionSplit(MOCK_PERSONS[0]),
  ]);

  // Job requirements
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    tools: [],
    useCustomerToolList: false,
    useMW4HStandardToolList: false,
    certifications: [],
    ppe: [],
  });

  // Registry-backed PPE and Tool types (Layer 1 dictionaries)
  const [ppeTypes, setPpeTypes] = useState<Array<{ id: string; name: string; active?: boolean }>>([]);
  const [toolTypes, setToolTypes] = useState<Array<{ id: string; name: string; active?: boolean }>>([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);

  // Customer PPE policy for blow-through defaults (3A.1)
  const [customerPpePolicy, setCustomerPpePolicy] = useState<string[]>([]);
  const [initializedFromPolicy, setInitializedFromPolicy] = useState(false);

  useEffect(() => {
    async function loadRegistry() {
      try {
        const [ppe, tools] = await Promise.all([
          apiFetch<Array<{ id: string; name: string; active?: boolean }>>("/ppe-types?activeOnly=true"),
          apiFetch<Array<{ id: string; name: string; active?: boolean }>>("/tool-types?activeOnly=true"),
        ]);

        setPpeTypes(Array.isArray(ppe) ? ppe : []);
        setToolTypes(Array.isArray(tools) ? tools : []);
      } catch (err) {
        console.error("Failed to load PPE/Tool registries", err);
        setPpeTypes([]);
        setToolTypes([]);
      } finally {
        setRegistryLoaded(true);
      }
    }

    loadRegistry();
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<any[]>(`/customers/${customerId}/ppe-requirements`);
        if (!alive) return;
        const rows = Array.isArray(data) ? data : [];
        setCustomerPpePolicy(rows.map((row: any) => row.ppeTypeId).filter(Boolean));
      } catch {
        // Customer may not have PPE policy — safe to ignore
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  useEffect(() => {
    if (initializedFromPolicy) return;
    if (orderId) return;
    if (customerPpePolicy.length === 0) return;
    setJobRequirements(prev => ({
      ...prev,
      ppe: customerPpePolicy,
    }));
    setInitializedFromPolicy(true);
  }, [customerPpePolicy, initializedFromPolicy, orderId]);

  useEffect(() => {
    if (!orderId) return;
    const storageKey = `jp.orderDraft.${customerId}.${orderId}`;
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (payload.orderName) setOrderName(payload.orderName);
      if (payload.projectDescription) setNotes(payload.projectDescription);
      if (payload.site) setSite(payload.site);
      if (payload.startDate) setStartDate(payload.startDate);
      if (payload.endDate) setEndDate(payload.endDate);
      if (payload.tradeLines && Array.isArray(payload.tradeLines)) {
        const mappedLines: TradeLine[] = payload.tradeLines.map((t: Record<string, unknown>) => ({
          trade: (t.trade as string) || "Millwright",
          projectName: (t.project as string) || "",
          headcount: (t.headcount as number) || 1,
          hours: (t.hours as number) || 40,
          basePay: (t.basePay as number) || 30,
          billRate: (t.billRate as number) || 55,
          otMultiplier: (t.otMultiplier as number) || OT_MULTIPLIER_DEFAULT,
          burdenedPay: (t.burdenedPay as number) || 36,
          gmPerHr: (t.gmPerHr as number) || 19,
          gmPct: (t.gmPct as number) || 34.5,
          health: ((t.health as string) || "Good") as "Good" | "Watch" | "Risk",
        }));
        if (mappedLines.length > 0) setTradeLines(mappedLines);
      }
      if (payload.modifiers) {
        setModifiers({
          perDiem: payload.modifiers.perDiem ?? 100,
          travel: payload.modifiers.travel ?? 0.58,
          bonuses: payload.modifiers.bonuses ?? 0,
        });
      }

      // Load SD delta rates from draft (top-level fields)
      if (payload.sdPayDeltaRate !== undefined || payload.sdBillDeltaRate !== undefined) {
        setSDDeltaRates({
          sdPayDeltaRate: payload.sdPayDeltaRate ?? null,
          sdBillDeltaRate: payload.sdBillDeltaRate ?? null,
        });
      }
      if (payload.jobRequirements) {
        setJobRequirements({
          tools: payload.jobRequirements.tools || [],
          certifications: payload.jobRequirements.certifications || [],
          ppe: payload.jobRequirements.ppe || [],
          useCustomerToolList: payload.jobRequirements.useCustomerToolList || false,
          useMW4HStandardToolList: payload.jobRequirements.useMW4HStandardToolList || false,
        });
      }
      if (payload.commissionSplits && Array.isArray(payload.commissionSplits) && payload.commissionSplits.length > 0) {
        setCommissionSplits(payload.commissionSplits.map((s: Record<string, unknown>) => ({
          person: (s.person as string) || MOCK_PERSONS[0],
          role: (s.role as string) || "Sales",
          splitPct: (s.splitPct as number) || 100,
        })));
      }
    } catch {
      // ignore malformed payload
    }
  }, [customerId, orderId]);

  // Calculate total commission percentage
  const totalCommissionPct = commissionSplits.reduce((sum, s) => sum + s.splitPct, 0);
  const commissionError = totalCommissionPct !== 100;

  // Trade line handlers
  const updateTradeLine = (index: number, field: keyof TradeLine, value: string | number) => {
    const newLines = [...tradeLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setTradeLines(newLines);
  };

  const handleOtMultiplierBlur = (index: number, inputValue: string) => {
    const parsed = parseFloat(inputValue);
    let finalValue: number;
    if (isNaN(parsed) || inputValue.trim() === "") {
      const prior = tradeLines[index].otMultiplier ?? OT_MULTIPLIER_DEFAULT;
      finalValue = Math.max(OT_MULTIPLIER_MIN, prior);
    } else {
      finalValue = Math.max(OT_MULTIPLIER_MIN, parsed);
    }
    updateTradeLine(index, "otMultiplier", finalValue);
  };

  const addTradeLine = () => {
    setTradeLines([...tradeLines, createEmptyTradeLine()]);
  };

  const removeTradeLine = (index: number) => {
    if (tradeLines.length <= 1) return;
    setTradeLines(tradeLines.filter((_, i) => i !== index));
  };

  // Commission split handlers
  const updateCommissionSplit = (index: number, field: keyof CommissionSplit, value: string | number) => {
    const newSplits = [...commissionSplits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setCommissionSplits(newSplits);
  };

  const addCommissionSplit = () => {
    setCommissionSplits([...commissionSplits, createEmptyCommissionSplit(MOCK_PERSONS[0])]);
  };

  const removeCommissionSplit = (index: number) => {
    if (commissionSplits.length <= 1) return;
    setCommissionSplits(commissionSplits.filter((_, i) => i !== index));
  };

  // Modifier handlers
  const updateModifier = (field: keyof OrderModifiers, value: number) => {
    setModifiers({ ...modifiers, [field]: value });
  };

  // SD Delta Rate handlers
  const updateSDDeltaRate = (field: keyof SDDeltaRates, value: number | null) => {
    setSDDeltaRates({ ...sdDeltaRates, [field]: value });
  };

  // Job requirements handlers
  const toggleTool = (toolTypeId: string) => {
    const next = jobRequirements.tools.includes(toolTypeId)
      ? jobRequirements.tools.filter((t) => t !== toolTypeId)
      : [...jobRequirements.tools, toolTypeId];
    setJobRequirements({ ...jobRequirements, tools: next });
  };

  const toggleUseCustomerToolList = () => {
    setJobRequirements({
      ...jobRequirements,
      useCustomerToolList: !jobRequirements.useCustomerToolList,
    });
  };

  const toggleUseMW4HStandardToolList = () => {
    setJobRequirements({
      ...jobRequirements,
      useMW4HStandardToolList: !jobRequirements.useMW4HStandardToolList,
    });
  };

  const toggleCertification = (cert: string) => {
    const newCerts = jobRequirements.certifications.includes(cert)
      ? jobRequirements.certifications.filter((c) => c !== cert)
      : [...jobRequirements.certifications, cert];
    setJobRequirements({ ...jobRequirements, certifications: newCerts });
  };

  const togglePPE = (ppeTypeId: string) => {
    const next = jobRequirements.ppe.includes(ppeTypeId)
      ? jobRequirements.ppe.filter((p) => p !== ppeTypeId)
      : [...jobRequirements.ppe, ppeTypeId];
    setJobRequirements({ ...jobRequirements, ppe: next });
  };

  const customerTools: string[] = [];

  // Form validation
  const canSubmit = orderName.trim() !== "" && !commissionError;

  // Handle create order
  const handleCreateOrder = () => {
    if (!canSubmit) return;

    const orderId = generateOrderId();
    const payload = {
      orderId,
      customerId,
      orderName: orderName.trim(),
      site: site.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim() || null,
      status: "Draft",
      tradeLines,
      modifiers,
      sdPayDeltaRate: sdDeltaRates.sdPayDeltaRate,
      sdBillDeltaRate: sdDeltaRates.sdBillDeltaRate,
      commissionSplits,
      origin: { type: "manual" },
    };

    // Store in sessionStorage
    const storageKey = `jp.orderDraft.${customerId}.${orderId}`;
    sessionStorage.setItem(storageKey, JSON.stringify(payload));

    // Navigate to order detail
    router.push(`/customers/${customerId}/orders/${orderId}`);
  };

  const handleCancel = () => {
    router.push(`/customers/${customerId}`);
  };

  return (
    <div className="create-order-container">
      {/* Page Header */}
      <div className="page-header">
        <button className="back-btn" onClick={handleCancel}>
          â† Back to Customer
        </button>
        <h1>Create Order</h1>
        <span className="customer-id-badge">{customerId}</span>
      </div>

      {/* Order Setup Section */}
      <div className="form-section">
        <h2>Order Setup</h2>
        <div className="form-grid">
          <div className="form-row full-width">
            <label className="form-label">Order Name <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder="e.g., Downtown Tower Phase 2 â€” Millwright Services"
            />
          </div>
          <div className="form-row">
            <label className="form-label">Site / Location</label>
            <input
              type="text"
              className="form-input"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="e.g., Downtown Tower â€” Los Angeles, CA"
            />
          </div>
          <div className="form-row">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-row full-width">
            <label className="form-label">Project Description</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this order..."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Trade Lines Section */}
      <div className="form-section">
        <div className="section-header">
          <h2>Trade Lines</h2>
          <button type="button" className="add-row-btn" onClick={addTradeLine}>
            + Add Trade
          </button>
        </div>
        <div className="trades-table-wrap">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Trade</th>
                <th>Project</th>
                <th>Headcount</th>
                <th>Hours</th>
                <th>Base Pay</th>
                <th>Bill Rate</th>
                <th>OT Mult</th>
                <th>
                  <span className="th-with-hint">
                    Burdened Pay
                    <span className="auto-calc-hint">Auto-calculated</span>
                  </span>
                </th>
                <th>
                  <span className="th-with-hint">
                    GM $/HR
                    <span className="auto-calc-hint">Auto-calculated</span>
                  </span>
                </th>
                <th>
                  <span className="th-with-hint">
                    GM %
                    <span className="auto-calc-hint">Auto-calculated</span>
                  </span>
                </th>
                <th>
                  <span className="th-with-hint">
                    Health
                    <span className="auto-calc-hint">Auto-calculated</span>
                  </span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tradeLines.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      className="form-select-sm"
                      value={line.trade}
                      onChange={(e) => updateTradeLine(idx, "trade", e.target.value)}
                    >
                      {AVAILABLE_TRADES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input-sm"
                      value={line.projectName}
                      onChange={(e) => updateTradeLine(idx, "projectName", e.target.value)}
                      placeholder="Project / PO"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm num-input"
                      value={line.headcount}
                      onChange={(e) => updateTradeLine(idx, "headcount", parseInt(e.target.value) || 0)}
                      min={1}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm num-input"
                      value={line.hours}
                      onChange={(e) => updateTradeLine(idx, "hours", parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm num-input"
                      value={line.basePay}
                      onChange={(e) => updateTradeLine(idx, "basePay", parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm num-input"
                      value={line.billRate}
                      onChange={(e) => updateTradeLine(idx, "billRate", parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm num-input"
                      value={line.otMultiplier}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = parseFloat(val);
                        if (val === "" || isNaN(parsed)) {
                          updateTradeLine(idx, "otMultiplier", OT_MULTIPLIER_DEFAULT);
                        } else {
                          updateTradeLine(idx, "otMultiplier", parsed);
                        }
                      }}
                      onBlur={(e) => handleOtMultiplierBlur(idx, e.target.value)}
                      min={OT_MULTIPLIER_MIN}
                      step={0.001}
                      title={`Minimum: ${OT_MULTIPLIER_MIN}`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm form-input-disabled num-input"
                      value={line.burdenedPay}
                      disabled
                      readOnly
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm form-input-disabled num-input"
                      value={line.gmPerHr}
                      disabled
                      readOnly
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm form-input-disabled num-input"
                      value={line.gmPct}
                      disabled
                      readOnly
                    />
                  </td>
                  <td>
                    <span className={`health-badge health-badge-${line.health.toLowerCase()}`}>
                      {line.health}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="remove-row-btn"
                      onClick={() => removeTradeLine(idx)}
                      disabled={tradeLines.length <= 1}
                      title="Remove trade"
                    >
                      Ã—
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modifiers Section */}
      <div className="form-section">
        <h2>Modifiers</h2>
        <div className="modifiers-grid">
          <div className="form-row">
            <label className="form-label">Per Diem ($/day)</label>
            <input
              type="number"
              className="form-input"
              value={modifiers.perDiem}
              onChange={(e) => updateModifier("perDiem", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Travel ($/mi)</label>
            <input
              type="number"
              className="form-input"
              value={modifiers.travel}
              onChange={(e) => updateModifier("travel", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Bonuses / Premiums ($/hr)</label>
            <input
              type="number"
              className="form-input"
              value={modifiers.bonuses}
              onChange={(e) => updateModifier("bonuses", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
            />
          </div>
        </div>

        {/* Shift Differential Section */}
        <div className="sd-delta-section">
          <h3>Shift Differential</h3>
          <div className="sd-delta-grid">
            <div className="form-row">
              <label className="form-label">SD Pay Delta ($/hr)</label>
              <input
                type="number"
                className="form-input"
                value={sdDeltaRates.sdPayDeltaRate ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSDDeltaRate("sdPayDeltaRate", val === "" ? null : parseFloat(val));
                }}
                min={0}
                step={0.01}
                placeholder="e.g., 2.50"
              />
            </div>
            <div className="form-row">
              <label className="form-label">SD Bill Delta ($/hr)</label>
              <input
                type="number"
                className="form-input"
                value={sdDeltaRates.sdBillDeltaRate ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSDDeltaRate("sdBillDeltaRate", val === "" ? null : parseFloat(val));
                }}
                min={0}
                step={0.01}
                placeholder="e.g., 4.00"
              />
            </div>
          </div>
          <p className="sd-helper-text">
            Additive delta applied only to SD hours. Base rates remain on trade lines.
          </p>
        </div>
      </div>

      {/* Job Requirements Section */}
      <div className="form-section">
        <h2>Job Requirements</h2>

        {/* Required Tools */}
        <div className="requirements-subsection">
          <h3>Required Tools</h3>
          <div className="toggle-row toggle-row-inline">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={jobRequirements.useCustomerToolList}
                onChange={toggleUseCustomerToolList}
              />
              <span>Use Customer Tool List</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={jobRequirements.useMW4HStandardToolList}
                onChange={toggleUseMW4HStandardToolList}
              />
              <span>MW4H Standard Tool List</span>
            </label>
          </div>
          {jobRequirements.useCustomerToolList && (
            <div className="customer-tools-preview">
              <span className="preview-label">Customer Tools ({tradeLines[0]?.trade}):</span>
              <div className="preview-items">
                {customerTools.length > 0 ? (
                  customerTools.map((tool) => (
                    <span key={tool} className="preview-tag">{tool}</span>
                  ))
                ) : (
                  <span className="preview-empty">No customer tools defined for this trade</span>
                )}
              </div>
            </div>
          )}
          {jobRequirements.useMW4HStandardToolList && (
            <div className="customer-tools-preview mw4h-tools-preview">
              <span className="preview-label">MW4H Standard Tools:</span>
              <div className="preview-items">
                {MW4H_STANDARD_TOOLS.map((tool) => (
                  <span key={tool} className="preview-tag mw4h-tag">{tool}</span>
                ))}
              </div>
            </div>
          )}

          {/* Trade-specific tool display (UI-only) */}
          {(() => {
            const TRADE_DISPLAY_ALIAS: Record<string, string> = {
              Millwrights: "Millwright",
              Electricians: "Electrician",
            };

            const MW4H_BASELINE_BY_TRADE: Record<string, string[]> = {
              Millwright: ["Hard Hat", "FR Clothing", "Steel Toe Boots", "Safety Glasses", "Gloves", "Basic Hand Tools"],
              Electrician: ["Hard Hat", "FR Clothing", "Steel Toe Boots", "Safety Glasses", "Gloves", "Basic Hand Tools"],
            };

            const tradesToDisplay = ["Millwrights", "Electricians"];

            const toolIdToName = new Map(toolTypes.map((t) => [t.id, t.name]));

            const getBaselineForTrade = (displayTrade: string): string[] => {
              const normalizedTrade = TRADE_DISPLAY_ALIAS[displayTrade] || displayTrade;
              if (jobRequirements.useCustomerToolList) {
                return [];
              } else if (jobRequirements.useMW4HStandardToolList) {
                return MW4H_BASELINE_BY_TRADE[normalizedTrade] || [];
              }
              return [];
            };

            const computeTradeToolGroups = (displayTrade: string) => {
              const baselineNames = getBaselineForTrade(displayTrade);
              const selected = jobRequirements.tools.map((id) => ({ id, name: toolIdToName.get(id) || id }));
              const baselineTools = selected.filter((t) => baselineNames.includes(t.name));
              const jobSpecificTools = selected.filter((t) => !baselineNames.includes(t.name));
              return { baselineTools, jobSpecificTools };
            };

            return (
              <div className="trade-tools-display-wrapper">
                <div className="trade-tools-note-box">
                  Tools are selected once for the Job Order. Each trade section shows how the selected tools relate to the baseline for that trade.
                </div>

                {tradesToDisplay.map((displayTrade) => {
                  const { baselineTools, jobSpecificTools } = computeTradeToolGroups(displayTrade);
                  return (
                    <div key={displayTrade} className="trade-tools-section">
                      <h4 className="trade-tools-section-header">Required Tools — {displayTrade}</h4>
                      <p className="trade-tools-helper-text">
                        Baseline tools are copied into this Job Order and will not change if customer defaults change later.
                      </p>

                      <div className="trade-tools-group">
                        <div className="trade-tools-group-header">
                          <span className="trade-tools-group-title">Baseline tools</span>
                          <span className="trade-tools-group-badge badge-copied">Copied at creation</span>
                        </div>
                        <p className="trade-tools-group-subtext">These tools came from the selected baseline for this trade.</p>
                        <div className="trade-tools-list">
                          {baselineTools.length > 0 ? (
                            baselineTools.map((tool) => (
                              <span key={tool.id} className="trade-tool-item">
                                <span className="trade-tool-name">{tool.name}</span>
                                <span className="trade-tool-badge badge-baseline">Baseline</span>
                              </span>
                            ))
                          ) : (
                            <span className="trade-tools-empty">No baseline tools selected</span>
                          )}
                        </div>
                      </div>

                      <div className="trade-tools-group">
                        <div className="trade-tools-group-header">
                          <span className="trade-tools-group-title">Job-specific additions</span>
                        </div>
                        <p className="trade-tools-group-subtext">Added for this Job Order only.</p>
                        <div className="trade-tools-list">
                          {jobSpecificTools.length > 0 ? (
                            jobSpecificTools.map((tool) => (
                              <span key={tool.id} className="trade-tool-item">
                                <span className="trade-tool-name">{tool.name}</span>
                                <span className="trade-tool-badge badge-job-specific">Job-specific</span>
                              </span>
                            ))
                          ) : (
                            <span className="trade-tools-empty">No job-specific tools added</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="checkbox-grid">
            {toolTypes.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic", padding: "8px 0" }}>
                {registryLoaded ? "No Tool Types found. Add them in Admin → Tools." : "Loading Tool Types..."}
              </div>
            ) : (
              toolTypes.map((item) => (
                <label key={item.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={jobRequirements.tools.includes(item.id)}
                    onChange={() => toggleTool(item.id)}
                  />
                  <span>{item.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Required Certifications */}
        <div className="requirements-subsection">
          <h3>Required Certifications</h3>
          <div className="checkbox-grid">
            {MOCK_CERTIFICATIONS.map((cert) => (
              <label key={cert} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={jobRequirements.certifications.includes(cert)}
                  onChange={() => toggleCertification(cert)}
                />
                <span>{cert}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Required PPE */}
        <div className="requirements-subsection">
          <h3>Required PPE</h3>
          <div className="checkbox-grid">
            {ppeTypes.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic", padding: "8px 0" }}>
                {registryLoaded ? "No PPE Types found. Add them in Admin → PPE." : "Loading PPE Types..."}
              </div>
            ) : (
              ppeTypes.map((item) => (
                <label key={item.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={jobRequirements.ppe.includes(item.id)}
                    onChange={() => togglePPE(item.id)}
                  />
                  <span>{item.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Commission Splits Section */}
      <div className="form-section">
        <div className="section-header">
          <div>
            <h2>Commission Splits</h2>
            <span className="section-note">Overrides Customer default salesperson for this Order</span>
          </div>
          <button type="button" className="add-row-btn" onClick={addCommissionSplit}>
            + Add Split
          </button>
        </div>
        {commissionError && (
          <div className="error-banner">
            Commission splits must total exactly 100%. Current total: {totalCommissionPct}%
          </div>
        )}
        <div className="commission-table-wrap">
          <table className="commission-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Split %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {commissionSplits.map((split, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      className="form-select-sm"
                      value={split.person}
                      onChange={(e) => updateCommissionSplit(idx, "person", e.target.value)}
                    >
                      {MOCK_PERSONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select-sm"
                      value={split.role}
                      onChange={(e) => updateCommissionSplit(idx, "role", e.target.value)}
                    >
                      {COMMISSION_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input-sm num-input"
                      value={split.splitPct}
                      onChange={(e) => updateCommissionSplit(idx, "splitPct", parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      step={0.01}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="remove-row-btn"
                      onClick={() => removeCommissionSplit(idx)}
                      disabled={commissionSplits.length <= 1}
                      title="Remove split"
                    >
                      Ã—
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="total-label">Total</td>
                <td className={`total-value ${commissionError ? "error" : ""}`}>
                  {totalCommissionPct}%
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="create-btn"
          onClick={handleCreateOrder}
          disabled={!canSubmit}
        >
          Create Order
        </button>
      </div>

      <style jsx>{`
        .create-order-container {
          padding: 24px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .back-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s ease;
        }

        .back-btn:hover {
          color: #3b82f6;
        }

        .page-header h1 {
          font-size: 24px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .customer-id-badge {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 6px;
        }

        .form-section {
          margin-bottom: 32px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .form-section h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .section-header h2 {
          margin: 0;
        }

        .section-note {
          display: block;
          font-size: 11px;
          color: rgba(245, 158, 11, 0.8);
          margin-top: 4px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-row.full-width {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .required {
          color: #ef4444;
        }

        .form-input,
        .form-textarea {
          padding: 10px 12px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          transition: border-color 0.15s ease;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-textarea {
          resize: vertical;
          min-height: 60px;
        }

        /* Tables */
        .trades-table-wrap,
        .commission-table-wrap {
          overflow-x: auto;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .trades-table,
        .commission-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .trades-table th,
        .commission-table th {
          padding: 10px 8px;
          text-align: left;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .trades-table td,
        .commission-table td {
          padding: 8px 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .trades-table tr:last-child td,
        .commission-table tbody tr:last-child td {
          border-bottom: none;
        }

        .commission-table tfoot td {
          padding: 10px 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 600;
        }

        .total-label {
          text-align: right;
          color: rgba(255, 255, 255, 0.7);
        }

        .total-value {
          color: #22c55e;
        }

        .total-value.error {
          color: #ef4444;
        }

        .th-with-hint {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .auto-calc-hint {
          font-size: 9px;
          font-weight: 400;
          color: rgba(245, 158, 11, 0.8);
          text-transform: none;
          letter-spacing: 0;
        }

        .form-input-sm,
        .form-select-sm {
          width: 100%;
          padding: 6px 8px;
          font-size: 12px;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .form-input-sm:focus,
        .form-select-sm:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .form-input-sm {
          min-width: 80px;
        }

        .form-input-sm.num-input {
          min-width: 60px;
          max-width: 80px;
        }

        .form-input-sm.form-input-disabled {
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.4);
          cursor: not-allowed;
          border-color: rgba(255, 255, 255, 0.05);
        }

        .form-select-sm {
          min-width: 100px;
          cursor: pointer;
        }

        .health-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 500;
          border-radius: 10px;
          text-align: center;
          min-width: 52px;
          user-select: none;
        }

        .health-badge-good {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .health-badge-watch {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .health-badge-risk {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .add-row-btn {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-row-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .remove-row-btn {
          width: 24px;
          height: 24px;
          padding: 0;
          font-size: 16px;
          font-weight: 500;
          color: rgba(239, 68, 68, 0.7);
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .remove-row-btn:hover:not(:disabled) {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .remove-row-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .modifiers-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .sd-delta-section {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .sd-delta-section h3 {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 12px;
        }

        .sd-delta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          max-width: 500px;
        }

        .sd-helper-text {
          margin: 12px 0 0;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        .error-banner {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cancel-btn {
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cancel-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .create-btn {
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .create-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .requirements-subsection {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .requirements-subsection:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .requirements-subsection h3 {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 12px;
        }

        .toggle-row {
          margin-bottom: 12px;
        }

        .toggle-row-inline {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
        }

        .toggle-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .customer-tools-preview {
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 6px;
        }

        .preview-label {
          display: block;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }

        .preview-items {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .preview-tag {
          padding: 4px 10px;
          font-size: 11px;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 4px;
        }

        .mw4h-tools-preview {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.2);
        }

        .mw4h-tag {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .preview-empty {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        .checkbox-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .checkbox-label:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .checkbox-label input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"]:checked + span {
          color: #fff;
        }

        /* Trade-specific tool display styles (UI-only) */
        .trade-tools-display-wrapper {
          margin-bottom: 16px;
        }

        .trade-tools-note-box {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.5;
        }

        .trade-tools-section {
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }

        .trade-tools-section:last-of-type {
          margin-bottom: 16px;
        }

        .trade-tools-section-header {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
        }

        .trade-tools-helper-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 16px;
          font-style: italic;
        }

        .trade-tools-group {
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
        }

        .trade-tools-group:last-child {
          margin-bottom: 0;
        }

        .trade-tools-group-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .trade-tools-group-title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .trade-tools-group-badge {
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 500;
          border-radius: 4px;
        }

        .badge-copied {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .trade-tools-group-subtext {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 10px;
        }

        .trade-tools-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .trade-tool-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }

        .trade-tool-name {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
        }

        .trade-tool-badge {
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 500;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .badge-baseline {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .badge-job-specific {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .trade-tools-empty {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}


