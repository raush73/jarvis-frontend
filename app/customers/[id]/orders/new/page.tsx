"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type {
  TradeListItem,
  CreateOrderPayload,
  CreateTradeRequirement,
  CreateOrderResponse,
  CreatePpeRequirement,
  CreateToolRequirement,
  CreateCertRequirement,
  CreateComplianceRequirement,
  CreateJobOrderContactPayload,
  RequirementEnforcement,
} from "@/lib/types/order";
import { ENFORCEMENT_LABELS } from "@/lib/types/order";

type CommissionPlanOption = { id: string; name: string; isDefault: boolean };
type PpeTypeOption = { id: string; name: string; active?: boolean };
type ToolOption = { id: string; name: string; active?: boolean };
type CertTypeOption = { id: string; name: string; code?: string; categoryId?: string };
type ComplianceReqTypeOption = { id: string; name: string };
type ComplianceVariantOption = { id: string; name: string; requirementTypeId: string };

type CustomerContactOption = { id: string; firstName: string; lastName: string; jobTitle?: string | null };
type ContactRowState = { customerContactId: string; role: string; isPrimary: boolean };

const CONTACT_ROLES = [
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "SITE_SUPERVISOR", label: "Site Supervisor" },
  { value: "SAFETY", label: "Safety" },
  { value: "AP", label: "AP" },
  { value: "EXECUTIVE", label: "Executive" },
  { value: "OTHER", label: "Other" },
];

type ReqItem = { typeId: string; enforcement: RequirementEnforcement; isBaseline?: boolean };

type BaselineSource = "MW4H" | "CUSTOMER" | null;

type TradeToolBaselineResponse = { tradeId: string; toolIds: string[] };
type TradePpeBaselineResponse = { tradeId: string; ppeTypeIds: string[] };
type CustomerToolBaselineResponse = { customerId: string; baselines: Array<{ tradeId: string; toolIds: string[] }> };
type CustomerPpeBaselineResponse = { customerId: string; baselines: Array<{ tradeId: string; ppeIds?: string[]; ppeTypeIds?: string[] }> };

type TradeLineState = {
  tradeId: string;
  basePayRate: string;
  baseBillRate: string;
  requestedHeadcount: number;
  startDate: string;
  expectedEndDate: string;
  notes: string;
  supervisorOverride: boolean;
  supervisorContactId: string;
  ppeBaselineSource: BaselineSource;
  toolBaselineSource: BaselineSource;
  ppeItems: ReqItem[];
  toolItems: ReqItem[];
  certItems: ReqItem[];
  complianceItems: Array<{ requirementTypeId: string; variantId: string }>;
};

function createEmptyTradeLine(defaultTradeId: string): TradeLineState {
  return {
    tradeId: defaultTradeId,
    basePayRate: "30",
    baseBillRate: "55",
    requestedHeadcount: 1,
    startDate: "",
    expectedEndDate: "",
    notes: "",
    supervisorOverride: false,
    supervisorContactId: "",
    ppeBaselineSource: null,
    toolBaselineSource: null,
    ppeItems: [],
    toolItems: [],
    certItems: [],
    complianceItems: [],
  };
}

const DEFAULT_ENFORCEMENT: RequirementEnforcement = "FILTER";

export default function CreateOrderPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Title ---
  const [title, setTitle] = useState("");

  // --- Shift Differential (toggle-driven) ---
  const [hasShiftDifferential, setHasShiftDifferential] = useState(false);
  const [sdPayDeltaRate, setSdPayDeltaRate] = useState<number | null>(null);
  const [sdBillDeltaRate, setSdBillDeltaRate] = useState<number | null>(null);

  // --- Job Site ---
  const [jobSiteName, setJobSiteName] = useState("");
  const [jobSiteAddress1, setJobSiteAddress1] = useState("");
  const [jobSiteAddress2, setJobSiteAddress2] = useState("");
  const [jobSiteCity, setJobSiteCity] = useState("");
  const [jobSiteState, setJobSiteState] = useState("");
  const [jobSiteZip, setJobSiteZip] = useState("");
  const [jobSiteNotes, setJobSiteNotes] = useState("");

  // --- Job Contacts ---
  const [customerContacts, setCustomerContacts] = useState<CustomerContactOption[]>([]);
  const [contactRows, setContactRows] = useState<ContactRowState[]>([]);

  // --- Commission ---
  const [commissionPlans, setCommissionPlans] = useState<CommissionPlanOption[]>([]);
  const [selectedCommissionPlanId, setSelectedCommissionPlanId] = useState("");
  const [isCommissionSplit, setIsCommissionSplit] = useState(false);

  // --- Registry data ---
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [ppeTypes, setPpeTypes] = useState<PpeTypeOption[]>([]);
  const [tools, setTools] = useState<ToolOption[]>([]);
  const [certTypes, setCertTypes] = useState<CertTypeOption[]>([]);
  const [complianceReqTypes, setComplianceReqTypes] = useState<ComplianceReqTypeOption[]>([]);
  const [complianceVariants, setComplianceVariants] = useState<ComplianceVariantOption[]>([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [registryLoadErrors, setRegistryLoadErrors] = useState<string[]>([]);
  const [baselineLoading, setBaselineLoading] = useState<Record<string, boolean>>({});
  const [baselineError, setBaselineError] = useState<Record<string, string | null>>({});

  // --- Trade lines ---
  const [tradeLines, setTradeLines] = useState<TradeLineState[]>([]);

  // --- Collapsible sections: key = "{tradeIdx}-{section}" ---
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const isExpanded = (key: string) => !!expanded[key];

  useEffect(() => {
    let alive = true;
    async function load() {
      const errors: string[] = [];
      try {
        const [tradesRes, ppeRes, toolsRes, certsRes, compReqRes, compVarRes, plansRes, contactsRes] =
          await Promise.all([
            apiFetch<TradeListItem[]>("/trades").catch((e) => { errors.push(`Trades: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<PpeTypeOption[]>("/ppe-types?activeOnly=true").catch((e) => { errors.push(`PPE: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<ToolOption[]>("/tools?activeOnly=true").catch((e) => { errors.push(`Tools: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<CertTypeOption[]>("/certification-types").catch((e) => { errors.push(`Certifications: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<ComplianceReqTypeOption[]>("/compliance-requirement-types").catch((e) => { errors.push(`Compliance Types: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<ComplianceVariantOption[]>("/compliance-variants").catch((e) => { errors.push(`Compliance Variants: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<CommissionPlanOption[]>("/commissions/plans").catch((e) => { errors.push(`Commission Plans: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<CustomerContactOption[]>(`/customer-contacts/customer/${customerId}`).catch((e) => { errors.push(`Customer Contacts: ${e instanceof Error ? e.message : "failed"}`); return []; }),
          ]);
        if (!alive) return;
        const tradeList = Array.isArray(tradesRes) ? tradesRes : [];
        setTrades(tradeList);
        setPpeTypes(Array.isArray(ppeRes) ? ppeRes : []);
        setTools(Array.isArray(toolsRes) ? toolsRes : []);
        setCertTypes(Array.isArray(certsRes) ? certsRes : []);
        setComplianceReqTypes(Array.isArray(compReqRes) ? compReqRes : []);
        setComplianceVariants(Array.isArray(compVarRes) ? compVarRes : []);
        setCommissionPlans(Array.isArray(plansRes) ? plansRes : []);
        setCustomerContacts(Array.isArray(contactsRes) ? contactsRes : []);
        setTradeLines([createEmptyTradeLine(tradeList[0]?.id ?? "")]);
        if (errors.length > 0) setRegistryLoadErrors(errors);
      } catch {
        if (alive) setRegistryLoadErrors(["Registry loading failed unexpectedly"]);
      } finally {
        if (alive) setRegistryLoaded(true);
      }
    }
    load();
    return () => { alive = false; };
  }, [customerId]);

  // --- Trade line helpers ---
  const updateTradeLine = (idx: number, patch: Partial<TradeLineState>) => {
    setTradeLines((prev) => prev.map((tl, i) => (i === idx ? { ...tl, ...patch } : tl)));
  };

  const addTradeLine = () => {
    setTradeLines((prev) => [...prev, createEmptyTradeLine(trades[0]?.id ?? "")]);
  };

  const removeTradeLine = (idx: number) => {
    if (tradeLines.length <= 1) return;
    setTradeLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleReqItem = (
    idx: number,
    field: "ppeItems" | "toolItems" | "certItems",
    typeId: string,
  ) => {
    const tl = tradeLines[idx];
    const items = tl[field];
    const exists = items.find((r) => r.typeId === typeId);
    if (exists?.isBaseline) return;
    const next = exists
      ? items.filter((r) => r.typeId !== typeId)
      : [...items, { typeId, enforcement: DEFAULT_ENFORCEMENT }];
    updateTradeLine(idx, { [field]: next });
  };

  const setReqEnforcement = (
    idx: number,
    field: "ppeItems" | "toolItems" | "certItems",
    typeId: string,
    enforcement: RequirementEnforcement,
  ) => {
    const tl = tradeLines[idx];
    const next = tl[field].map((r) => (r.typeId === typeId ? { ...r, enforcement } : r));
    updateTradeLine(idx, { [field]: next });
  };

  const addComplianceItem = (idx: number) => {
    if (complianceReqTypes.length === 0) return;
    updateTradeLine(idx, {
      complianceItems: [
        ...tradeLines[idx].complianceItems,
        { requirementTypeId: complianceReqTypes[0].id, variantId: "" },
      ],
    });
  };

  const removeComplianceItem = (tradeIdx: number, compIdx: number) => {
    const next = tradeLines[tradeIdx].complianceItems.filter((_, i) => i !== compIdx);
    updateTradeLine(tradeIdx, { complianceItems: next });
  };

  const updateComplianceItem = (
    tradeIdx: number,
    compIdx: number,
    field: "requirementTypeId" | "variantId",
    value: string,
  ) => {
    const items = [...tradeLines[tradeIdx].complianceItems];
    items[compIdx] = { ...items[compIdx], [field]: value };
    updateTradeLine(tradeIdx, { complianceItems: items });
  };

  // --- Baseline handlers (per-section, per-trade-line) ---
  const loadToolBaseline = async (idx: number, source: BaselineSource) => {
    if (source === null) {
      setTradeLines((prev) =>
        prev.map((line, i) =>
          i !== idx
            ? line
            : {
                ...line,
                toolBaselineSource: null,
                toolItems: line.toolItems.filter((r) => !r.isBaseline),
              }
        )
      );
      setBaselineError((prev) => ({ ...prev, [`${idx}-tool`]: null }));
      return;
    }

    const tl = tradeLines[idx];
    const tradeId = tl.tradeId;
    if (!tradeId) return;

    const key = `${idx}-tool`;
    setBaselineLoading((prev) => ({ ...prev, [key]: true }));
    setBaselineError((prev) => ({ ...prev, [key]: null }));

    try {
      let baselineIds: string[] = [];

      if (source === "MW4H") {
        const res = await apiFetch<TradeToolBaselineResponse>(
          `/trades/${tradeId}/tools-baseline`
        );
        baselineIds = res.toolIds ?? [];
      } else if (source === "CUSTOMER") {
        const res = await apiFetch<CustomerToolBaselineResponse>(
          `/customers/${customerId}/tools-baseline`
        );
        const match = res.baselines?.find((b) => b.tradeId === tradeId);
        baselineIds = match?.toolIds ?? [];
      }

      if (baselineIds.length === 0) {
        setBaselineError((prev) => ({
          ...prev,
          [key]: "No tool baseline configured for this trade.",
        }));
      }

      setTradeLines((prev) =>
        prev.map((line, i) => {
          if (i !== idx) return line;
          const deltaItems = line.toolItems.filter((r) => !r.isBaseline);
          const deltaIds = new Set(deltaItems.map((r) => r.typeId));
          const newBaseline: ReqItem[] = baselineIds
            .filter((id) => !deltaIds.has(id))
            .map((id) => ({ typeId: id, enforcement: DEFAULT_ENFORCEMENT, isBaseline: true }));
          return {
            ...line,
            toolBaselineSource: source,
            toolItems: [...newBaseline, ...deltaItems],
          };
        })
      );
    } catch (err) {
      setBaselineError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Failed to load tool baseline",
      }));
    } finally {
      setBaselineLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const loadPpeBaseline = async (idx: number, source: BaselineSource) => {
    if (source === null) {
      setTradeLines((prev) =>
        prev.map((line, i) =>
          i !== idx
            ? line
            : {
                ...line,
                ppeBaselineSource: null,
                ppeItems: line.ppeItems.filter((r) => !r.isBaseline),
              }
        )
      );
      setBaselineError((prev) => ({ ...prev, [`${idx}-ppe`]: null }));
      return;
    }

    const tl = tradeLines[idx];
    const tradeId = tl.tradeId;
    if (!tradeId) return;

    const key = `${idx}-ppe`;
    setBaselineLoading((prev) => ({ ...prev, [key]: true }));
    setBaselineError((prev) => ({ ...prev, [key]: null }));

    try {
      let baselineIds: string[] = [];

      if (source === "MW4H") {
        const res = await apiFetch<TradePpeBaselineResponse>(
          `/trades/${tradeId}/ppe-baseline`
        );
        baselineIds = res.ppeTypeIds ?? [];
      } else if (source === "CUSTOMER") {
        const res = await apiFetch<CustomerPpeBaselineResponse>(
          `/customers/${customerId}/ppe-baseline`
        );
        const match = res.baselines?.find((b) => b.tradeId === tradeId);
        baselineIds = match?.ppeIds ?? match?.ppeTypeIds ?? [];
      }

      if (baselineIds.length === 0) {
        setBaselineError((prev) => ({
          ...prev,
          [key]: "No PPE baseline configured for this trade.",
        }));
      }

      setTradeLines((prev) =>
        prev.map((line, i) => {
          if (i !== idx) return line;
          const deltaItems = line.ppeItems.filter((r) => !r.isBaseline);
          const deltaIds = new Set(deltaItems.map((r) => r.typeId));
          const newBaseline: ReqItem[] = baselineIds
            .filter((id) => !deltaIds.has(id))
            .map((id) => ({ typeId: id, enforcement: DEFAULT_ENFORCEMENT, isBaseline: true }));
          return {
            ...line,
            ppeBaselineSource: source,
            ppeItems: [...newBaseline, ...deltaItems],
          };
        })
      );
    } catch (err) {
      setBaselineError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Failed to load PPE baseline",
      }));
    } finally {
      setBaselineLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleTradeChange = (idx: number, newTradeId: string) => {
    setTradeLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        if (line.tradeId === newTradeId) return line;
        return {
          ...line,
          tradeId: newTradeId,
          toolBaselineSource: null,
          ppeBaselineSource: null,
          toolItems: line.toolItems.filter((r) => !r.isBaseline),
          ppeItems: line.ppeItems.filter((r) => !r.isBaseline),
        };
      })
    );
    setBaselineError((prev) => {
      const next = { ...prev };
      delete next[`${idx}-tool`];
      delete next[`${idx}-ppe`];
      return next;
    });
  };

  // --- Validation ---
  const canSubmit =
    tradeLines.length > 0 &&
    tradeLines.every((tl) => tl.tradeId) &&
    !submitting;

  // --- Submit ---
  const handleCreateOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const tradeRequirements: CreateTradeRequirement[] = tradeLines.map((tl) => {
        const ppeRequirements: CreatePpeRequirement[] = tl.ppeItems.map((r) => ({
          ppeTypeId: r.typeId,
          enforcement: r.enforcement,
        }));
        const toolRequirements: CreateToolRequirement[] = tl.toolItems.map((r) => ({
          toolId: r.typeId,
          enforcement: r.enforcement,
        }));
        const certRequirements: CreateCertRequirement[] = tl.certItems.map((r) => ({
          certTypeId: r.typeId,
          enforcement: r.enforcement,
        }));
        const complianceRequirements: CreateComplianceRequirement[] = tl.complianceItems
          .filter((c) => c.requirementTypeId)
          .map((c) => ({
            requirementTypeId: c.requirementTypeId,
            ...(c.variantId ? { variantId: c.variantId } : {}),
          }));

        return {
          tradeId: tl.tradeId,
          basePayRate: tl.basePayRate || undefined,
          baseBillRate: tl.baseBillRate || undefined,
          requestedHeadcount: tl.requestedHeadcount || undefined,
          startDate: tl.startDate || undefined,
          expectedEndDate: tl.expectedEndDate || undefined,
          notes: tl.notes || undefined,
          ...(tl.supervisorOverride ? { supervisorOverride: true, supervisorContactId: tl.supervisorContactId || undefined } : {}),
          ...(ppeRequirements.length > 0 ? { ppeRequirements } : {}),
          ...(toolRequirements.length > 0 ? { toolRequirements } : {}),
          ...(certRequirements.length > 0 ? { certRequirements } : {}),
          ...(complianceRequirements.length > 0 ? { complianceRequirements } : {}),
        };
      });

      const contacts: CreateJobOrderContactPayload[] = contactRows
        .filter((cr) => cr.customerContactId)
        .map((cr) => ({
          customerContactId: cr.customerContactId,
          role: cr.role,
          isPrimary: cr.isPrimary,
        }));

      const payload: CreateOrderPayload = {
        title: title || undefined,
        customerId,
        ...(jobSiteName ? { jobSiteName } : {}),
        ...(jobSiteAddress1 ? { jobSiteAddress1 } : {}),
        ...(jobSiteAddress2 ? { jobSiteAddress2 } : {}),
        ...(jobSiteCity ? { jobSiteCity } : {}),
        ...(jobSiteState ? { jobSiteState } : {}),
        ...(jobSiteZip ? { jobSiteZip } : {}),
        ...(jobSiteNotes ? { jobSiteNotes } : {}),
        ...(contacts.length > 0 ? { contacts } : {}),
        ...(hasShiftDifferential && sdPayDeltaRate != null ? { sdPayDeltaRate } : {}),
        ...(hasShiftDifferential && sdBillDeltaRate != null ? { sdBillDeltaRate } : {}),
        ...(selectedCommissionPlanId ? { commissionPlanId: selectedCommissionPlanId } : {}),
        tradeRequirements,
      };

      const result = await apiFetch<CreateOrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push(`/customers/${customerId}/orders/${result.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create order";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => router.push(`/customers/${customerId}`);

  const baselineLabel = (source: BaselineSource): string => {
    if (source === "MW4H") return "Using MW4H minimum baseline";
    if (source === "CUSTOMER") return "Using Customer baseline";
    return "No baseline selected";
  };

  return (
    <div className="co-container">
      {/* Page Header */}
      <div className="page-header">
        <button className="back-btn" onClick={handleCancel}>← Back to Customer</button>
        <h1>Create Order</h1>
        <span className="cust-badge">{customerId}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {registryLoadErrors.length > 0 && (
        <div className="registry-warn-banner">
          <strong>Registry load warnings:</strong> {registryLoadErrors.join(" · ")}
        </div>
      )}

      {/* Job Order Title */}
      <div className="form-section">
        <h2>Job Order Title</h2>
        <div className="form-row">
          <label className="form-label">Title</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Example: Tesla Shutdown – Phase 2"
          />
        </div>
      </div>

      {/* Job Site */}
      <div className="form-section">
        <h2>Job Site</h2>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label className="form-label">Site Name</label>
          <input type="text" className="form-input" value={jobSiteName}
            onChange={(e) => setJobSiteName(e.target.value)} placeholder="e.g., Tesla Gigafactory" />
        </div>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label className="form-label">Address Line 1</label>
          <input type="text" className="form-input" value={jobSiteAddress1}
            onChange={(e) => setJobSiteAddress1(e.target.value)} placeholder="Street address" />
        </div>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label className="form-label">Address Line 2</label>
          <input type="text" className="form-input" value={jobSiteAddress2}
            onChange={(e) => setJobSiteAddress2(e.target.value)} placeholder="Suite, building, gate, etc." />
        </div>
        <div className="site-csz-row">
          <div className="form-row" style={{ flex: 2 }}>
            <label className="form-label">City</label>
            <input type="text" className="form-input" value={jobSiteCity}
              onChange={(e) => setJobSiteCity(e.target.value)} placeholder="City" />
          </div>
          <div className="form-row" style={{ flex: 1 }}>
            <label className="form-label">State</label>
            <input type="text" className="form-input" value={jobSiteState}
              onChange={(e) => setJobSiteState(e.target.value)} placeholder="TX" maxLength={2} />
          </div>
          <div className="form-row" style={{ flex: 1 }}>
            <label className="form-label">Zip</label>
            <input type="text" className="form-input" value={jobSiteZip}
              onChange={(e) => setJobSiteZip(e.target.value)} placeholder="78701" maxLength={10} />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <label className="form-label">Site Notes</label>
          <textarea className="form-textarea" value={jobSiteNotes} rows={2}
            onChange={(e) => setJobSiteNotes(e.target.value)}
            placeholder="Access instructions, gate info, reporting details..." />
        </div>
      </div>

      {/* Job Contacts */}
      <div className="form-section">
        <div className="section-header">
          <h2>Job Contacts</h2>
          {customerContacts.length > 0 && (
            <button type="button" className="add-btn" onClick={() => {
              const firstAvailable = customerContacts.find(
                (cc) => !contactRows.some((cr) => cr.customerContactId === cc.id && cr.role === "PROJECT_MANAGER")
              );
              setContactRows((prev) => [
                ...prev,
                {
                  customerContactId: firstAvailable?.id ?? customerContacts[0]?.id ?? "",
                  role: "PROJECT_MANAGER",
                  isPrimary: prev.length === 0,
                },
              ]);
            }}>+ Add Contact</button>
          )}
        </div>

        {customerContacts.length === 0 && registryLoaded && (
          <div className="contacts-empty">
            No contacts found for this customer. Add contacts on the customer profile first.
          </div>
        )}

        {contactRows.map((cr, idx) => {
          const selectedContact = customerContacts.find((cc) => cc.id === cr.customerContactId);
          return (
            <div key={idx} className="contact-row">
              <select className="form-select-sm contact-select" value={cr.customerContactId}
                onChange={(e) => {
                  setContactRows((prev) => prev.map((r, i) =>
                    i === idx ? { ...r, customerContactId: e.target.value } : r
                  ));
                }}>
                {customerContacts.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.firstName} {cc.lastName}{cc.jobTitle ? ` — ${cc.jobTitle}` : ""}
                  </option>
                ))}
              </select>
              <select className="form-select-sm role-select" value={cr.role}
                onChange={(e) => {
                  setContactRows((prev) => prev.map((r, i) =>
                    i === idx ? { ...r, role: e.target.value } : r
                  ));
                }}>
                {CONTACT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {cr.isPrimary && <span className="primary-badge">Primary</span>}
              <button type="button" className="rm-btn" onClick={() => {
                setContactRows((prev) => {
                  const next = prev.filter((_, i) => i !== idx);
                  if (cr.isPrimary && next.length > 0 && !next.some((r) => r.isPrimary)) {
                    next[0] = { ...next[0], isPrimary: true };
                  }
                  return next;
                });
              }}>×</button>
            </div>
          );
        })}
      </div>

      {/* Shift Differential — toggle-driven */}
      <div className="form-section">
        <div className="toggle-header">
          <h2>Shift Differential</h2>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={hasShiftDifferential}
              onChange={(e) => setHasShiftDifferential(e.target.checked)}
            />
            <span>Is there a shift differential?</span>
          </label>
        </div>
        {hasShiftDifferential && (
          <>
            <div className="sd-grid">
              <div className="form-row">
                <label className="form-label">Shift Differential Pay Delta ($/hr)</label>
                <input type="number" className="form-input" value={sdPayDeltaRate ?? ""}
                  onChange={(e) => setSdPayDeltaRate(e.target.value === "" ? null : parseFloat(e.target.value))}
                  min={0} step={0.01} placeholder="e.g., 2.50" />
              </div>
              <div className="form-row">
                <label className="form-label">Shift Differential Bill Delta ($/hr)</label>
                <input type="number" className="form-input" value={sdBillDeltaRate ?? ""}
                  onChange={(e) => setSdBillDeltaRate(e.target.value === "" ? null : parseFloat(e.target.value))}
                  min={0} step={0.01} placeholder="e.g., 4.00" />
              </div>
            </div>
            <p className="helper-text">Additive delta applied only to shift differential hours. Base rates remain on trade lines.</p>
          </>
        )}
      </div>

      {/* Commission — split-aware */}
      <div className="form-section">
        <h2>Commission</h2>
        <div className="form-row" style={{ marginBottom: 16 }}>
          <label className="form-label">Commission Plan</label>
          <select className="form-select" value={selectedCommissionPlanId}
            onChange={(e) => setSelectedCommissionPlanId(e.target.value)}>
            <option value="">Use Global Default Plan</option>
            {commissionPlans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.isDefault ? " (Default)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="toggle-header">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={isCommissionSplit}
              onChange={(e) => setIsCommissionSplit(e.target.checked)}
            />
            <span>Is commission split?</span>
          </label>
        </div>
        {isCommissionSplit && (
          <div className="split-notice">
            <div className="split-notice-icon">⚡</div>
            <div>
              <p className="split-notice-title">Split Commission Mode</p>
              <p className="split-notice-text">
                This order uses split commission allocation. The selected plan above applies to the total commissionable amount.
                Split commission detail allocation will be configured in the next commission wiring pass.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Trade Requirements */}
      <div className="form-section">
        <div className="section-header">
          <h2>Trade Requirements</h2>
          <button type="button" className="add-btn" onClick={addTradeLine}>+ Add Trade</button>
        </div>

        {tradeLines.map((tl, idx) => {
          const ppeKey = `${idx}-ppe`;
          const toolKey = `${idx}-tools`;
          const certKey = `${idx}-certs`;
          const compKey = `${idx}-compliance`;
          const ppeCount = tl.ppeItems.length;
          const toolCount = tl.toolItems.length;
          const certCount = tl.certItems.length;
          const compCount = tl.complianceItems.length;

          return (
            <div key={idx} className="tl-card">
              <div className="tl-header">
                <span className="tl-num">Trade Line {idx + 1}</span>
                {tradeLines.length > 1 && (
                  <button type="button" className="rm-btn" onClick={() => removeTradeLine(idx)}>×</button>
                )}
              </div>

              {/* Core fields */}
              <div className="tl-grid">
                <div className="form-row">
                  <label className="form-label">Trade *</label>
                  <select className="form-select-sm" value={tl.tradeId}
                    onChange={(e) => handleTradeChange(idx, e.target.value)}>
                    {!registryLoaded && <option value="">Loading...</option>}
                    {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Base Pay Rate</label>
                  <input type="text" className="form-input-sm" value={tl.basePayRate}
                    onChange={(e) => updateTradeLine(idx, { basePayRate: e.target.value })} placeholder="30.00" />
                </div>
                <div className="form-row">
                  <label className="form-label">Base Bill Rate</label>
                  <input type="text" className="form-input-sm" value={tl.baseBillRate}
                    onChange={(e) => updateTradeLine(idx, { baseBillRate: e.target.value })} placeholder="55.00" />
                </div>
                <div className="form-row">
                  <label className="form-label">Headcount</label>
                  <input type="number" className="form-input-sm num-input" value={tl.requestedHeadcount}
                    onChange={(e) => updateTradeLine(idx, { requestedHeadcount: parseInt(e.target.value) || 0 })} min={1} />
                </div>
                <div className="form-row">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input-sm" value={tl.startDate}
                    onChange={(e) => updateTradeLine(idx, { startDate: e.target.value })} />
                </div>
                <div className="form-row">
                  <label className="form-label">Expected End Date</label>
                  <input type="date" className="form-input-sm" value={tl.expectedEndDate}
                    onChange={(e) => updateTradeLine(idx, { expectedEndDate: e.target.value })} />
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 12 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={tl.notes} rows={2}
                  onChange={(e) => updateTradeLine(idx, { notes: e.target.value })}
                  placeholder="Trade-line notes..." />
              </div>

              {/* --- Supervisor Override --- */}
              <div className="supervisor-row" style={{ marginTop: 12 }}>
                <label className="form-label supervisor-toggle-label">
                  <input type="checkbox" checked={tl.supervisorOverride}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateTradeLine(idx, {
                        supervisorOverride: checked,
                        supervisorContactId: checked ? tl.supervisorContactId : "",
                      });
                    }} />
                  <span>Supervisor Override</span>
                </label>
                {tl.supervisorOverride && (
                  <select className="form-select-sm supervisor-contact-select"
                    value={tl.supervisorContactId}
                    onChange={(e) => updateTradeLine(idx, { supervisorContactId: e.target.value })}>
                    <option value="">Select supervisor...</option>
                    {customerContacts.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.firstName} {cc.lastName}{cc.jobTitle ? ` — ${cc.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* --- PPE Requirements (baseline-first) --- */}
              <div className="req-section">
                <button type="button" className="req-toggle" onClick={() => toggleSection(ppeKey)}>
                  <span className="req-toggle-label">
                    PPE Requirements
                    {ppeCount > 0 && <span className="req-count">{ppeCount}</span>}
                  </span>
                  <span className="req-chevron">{isExpanded(ppeKey) ? "▾" : "▸"}</span>
                </button>
                {isExpanded(ppeKey) && (
                  <div className="req-body">
                    {/* Baseline selection */}
                    <div className="baseline-area">
                      <span className="baseline-area-label">Baseline Source</span>
                      <div className="baseline-btns">
                        <button type="button"
                          className={`baseline-btn-inline ${tl.ppeBaselineSource === "MW4H" ? "baseline-active" : ""}`}
                          onClick={() => loadPpeBaseline(idx, tl.ppeBaselineSource === "MW4H" ? null : "MW4H")}
                          disabled={!!baselineLoading[`${idx}-ppe`]}>
                          Use MW4H PPE Baseline
                        </button>
                        <button type="button"
                          className={`baseline-btn-inline ${tl.ppeBaselineSource === "CUSTOMER" ? "baseline-active" : ""}`}
                          onClick={() => loadPpeBaseline(idx, tl.ppeBaselineSource === "CUSTOMER" ? null : "CUSTOMER")}
                          disabled={!!baselineLoading[`${idx}-ppe`]}>
                          Use Customer PPE Baseline
                        </button>
                      </div>
                      {baselineLoading[`${idx}-ppe`] && (
                        <span className="baseline-loading">Loading PPE baseline…</span>
                      )}
                      {baselineError[`${idx}-ppe`] && (
                        <span className="baseline-error">{baselineError[`${idx}-ppe`]}</span>
                      )}
                      {tl.ppeBaselineSource && !baselineLoading[`${idx}-ppe`] && (
                        <span className="baseline-indicator">{baselineLabel(tl.ppeBaselineSource)}</span>
                      )}
                    </div>

                    {/* PPE items — baseline items shown locked, manual items toggleable */}
                    <div className="delta-area">
                      <span className="delta-label">
                        {tl.ppeBaselineSource ? "PPE items (baseline + order-specific deltas)" : "PPE items for this order"}
                      </span>
                      {ppeTypes.length === 0 ? (
                        <span className="req-empty">{registryLoaded ? "No PPE types available" : "Loading..."}</span>
                      ) : (
                        <div className="req-list">
                          {ppeTypes.map((item) => {
                            const sel = tl.ppeItems.find((r) => r.typeId === item.id);
                            const isBl = !!sel?.isBaseline;
                            return (
                              <div key={item.id} className={`req-row ${sel ? "req-row-active" : ""} ${isBl ? "req-row-baseline" : ""}`}>
                                <label className={`req-check-label ${isBl ? "req-check-locked" : ""}`}>
                                  <input type="checkbox" checked={!!sel}
                                    disabled={isBl}
                                    onChange={() => toggleReqItem(idx, "ppeItems", item.id)} />
                                  <span>{item.name}</span>
                                  {isBl && <span className="baseline-tag">baseline</span>}
                                </label>
                                {sel && (
                                  <select className="enf-select" value={sel.enforcement}
                                    onChange={(e) => setReqEnforcement(idx, "ppeItems", item.id, e.target.value as RequirementEnforcement)}>
                                    <option value="FILTER">{ENFORCEMENT_LABELS.FILTER}</option>
                                    <option value="FLAG">{ENFORCEMENT_LABELS.FLAG}</option>
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* --- Tool Requirements (baseline-first) --- */}
              <div className="req-section">
                <button type="button" className="req-toggle" onClick={() => toggleSection(toolKey)}>
                  <span className="req-toggle-label">
                    Tool Requirements
                    {toolCount > 0 && <span className="req-count">{toolCount}</span>}
                  </span>
                  <span className="req-chevron">{isExpanded(toolKey) ? "▾" : "▸"}</span>
                </button>
                {isExpanded(toolKey) && (
                  <div className="req-body">
                    {/* Baseline selection */}
                    <div className="baseline-area">
                      <span className="baseline-area-label">Baseline Source</span>
                      <div className="baseline-btns">
                        <button type="button"
                          className={`baseline-btn-inline ${tl.toolBaselineSource === "MW4H" ? "baseline-active" : ""}`}
                          onClick={() => loadToolBaseline(idx, tl.toolBaselineSource === "MW4H" ? null : "MW4H")}
                          disabled={!!baselineLoading[`${idx}-tool`]}>
                          Use MW4H Tool Baseline
                        </button>
                        <button type="button"
                          className={`baseline-btn-inline ${tl.toolBaselineSource === "CUSTOMER" ? "baseline-active" : ""}`}
                          onClick={() => loadToolBaseline(idx, tl.toolBaselineSource === "CUSTOMER" ? null : "CUSTOMER")}
                          disabled={!!baselineLoading[`${idx}-tool`]}>
                          Use Customer Tool Baseline
                        </button>
                      </div>
                      {baselineLoading[`${idx}-tool`] && (
                        <span className="baseline-loading">Loading tool baseline…</span>
                      )}
                      {baselineError[`${idx}-tool`] && (
                        <span className="baseline-error">{baselineError[`${idx}-tool`]}</span>
                      )}
                      {tl.toolBaselineSource && !baselineLoading[`${idx}-tool`] && (
                        <span className="baseline-indicator">{baselineLabel(tl.toolBaselineSource)}</span>
                      )}
                    </div>

                    {/* Baseline items rendered from state (visible even if registry fails) */}
                    {tl.toolItems.filter((r) => r.isBaseline).length > 0 && (
                      <div className="delta-area">
                        <span className="delta-label">Baseline tools (locked)</span>
                        <div className="req-list">
                          {tl.toolItems.filter((r) => r.isBaseline).map((item) => {
                            const toolMeta = tools.find((t) => t.id === item.typeId);
                            return (
                              <div key={item.typeId} className="req-row req-row-active req-row-baseline">
                                <label className="req-check-label req-check-locked">
                                  <input type="checkbox" checked disabled />
                                  <span>{toolMeta?.name ?? `Tool ${item.typeId.slice(0, 8)}…`}</span>
                                  <span className="baseline-tag">baseline</span>
                                </label>
                                <select className="enf-select" value={item.enforcement}
                                  onChange={(e) => setReqEnforcement(idx, "toolItems", item.typeId, e.target.value as RequirementEnforcement)}>
                                  <option value="FILTER">{ENFORCEMENT_LABELS.FILTER}</option>
                                  <option value="FLAG">{ENFORCEMENT_LABELS.FLAG}</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Order-specific delta items already selected */}
                    {tl.toolItems.filter((r) => !r.isBaseline).length > 0 && (
                      <div className="delta-area">
                        <span className="delta-label">Order-specific tools (added)</span>
                        <div className="req-list">
                          {tl.toolItems.filter((r) => !r.isBaseline).map((item) => {
                            const toolMeta = tools.find((t) => t.id === item.typeId);
                            return (
                              <div key={item.typeId} className="req-row req-row-active">
                                <label className="req-check-label">
                                  <input type="checkbox" checked
                                    onChange={() => toggleReqItem(idx, "toolItems", item.typeId)} />
                                  <span>{toolMeta?.name ?? `Tool ${item.typeId.slice(0, 8)}…`}</span>
                                  <span className="delta-tag">order-specific</span>
                                </label>
                                <select className="enf-select" value={item.enforcement}
                                  onChange={(e) => setReqEnforcement(idx, "toolItems", item.typeId, e.target.value as RequirementEnforcement)}>
                                  <option value="FILTER">{ENFORCEMENT_LABELS.FILTER}</option>
                                  <option value="FLAG">{ENFORCEMENT_LABELS.FLAG}</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Delta-add checklist: non-baseline tools from registry */}
                    <div className="delta-area">
                      <span className="delta-label">
                        {tl.toolBaselineSource ? "Add order-specific tools" : "Select tools for this order"}
                      </span>
                      {tools.length === 0 ? (
                        <span className="req-empty">{registryLoaded ? "Tool registry is empty or failed to load — check warnings above" : "Loading tool registry..."}</span>
                      ) : (
                        <div className="req-list">
                          {tools
                            .filter((item) => !tl.toolItems.find((r) => r.typeId === item.id))
                            .map((item) => (
                              <div key={item.id} className="req-row">
                                <label className="req-check-label">
                                  <input type="checkbox" checked={false}
                                    onChange={() => toggleReqItem(idx, "toolItems", item.id)} />
                                  <span>{item.name}</span>
                                </label>
                              </div>
                            ))}
                          {tools.filter((item) => !tl.toolItems.find((r) => r.typeId === item.id)).length === 0 && (
                            <span className="req-empty">All available tools are already selected</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* --- Certification Requirements --- */}
              <div className="req-section">
                <button type="button" className="req-toggle" onClick={() => toggleSection(certKey)}>
                  <span className="req-toggle-label">
                    Certification Requirements
                    {certCount > 0 && <span className="req-count">{certCount}</span>}
                  </span>
                  <span className="req-chevron">{isExpanded(certKey) ? "▾" : "▸"}</span>
                </button>
                {isExpanded(certKey) && (
                  <div className="req-body">
                    {/* Already-selected certs shown at top */}
                    {tl.certItems.length > 0 && (
                      <div className="delta-area" style={{ marginBottom: 12 }}>
                        <span className="delta-label">Selected certification requirements</span>
                        <div className="req-list">
                          {tl.certItems.map((item) => {
                            const certMeta = certTypes.find((c) => c.id === item.typeId);
                            return (
                              <div key={item.typeId} className="req-row req-row-active">
                                <label className="req-check-label">
                                  <input type="checkbox" checked
                                    onChange={() => toggleReqItem(idx, "certItems", item.typeId)} />
                                  <span>{certMeta?.name ?? `Cert ${item.typeId.slice(0, 8)}…`}</span>
                                </label>
                                <select className="enf-select" value={item.enforcement}
                                  onChange={(e) => setReqEnforcement(idx, "certItems", item.typeId, e.target.value as RequirementEnforcement)}>
                                  <option value="FILTER">{ENFORCEMENT_LABELS.FILTER}</option>
                                  <option value="FLAG">{ENFORCEMENT_LABELS.FLAG}</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Available certs to add */}
                    <div className="delta-area">
                      <span className="delta-label">Add certification requirements</span>
                      {certTypes.length === 0 ? (
                        <span className="req-empty">{registryLoaded ? "Certification registry is empty or failed to load — check warnings above" : "Loading certification types..."}</span>
                      ) : (
                        <div className="req-list">
                          {certTypes
                            .filter((item) => !tl.certItems.find((r) => r.typeId === item.id))
                            .map((item) => (
                              <div key={item.id} className="req-row">
                                <label className="req-check-label">
                                  <input type="checkbox" checked={false}
                                    onChange={() => toggleReqItem(idx, "certItems", item.id)} />
                                  <span>{item.name}</span>
                                </label>
                              </div>
                            ))}
                          {certTypes.filter((item) => !tl.certItems.find((r) => r.typeId === item.id)).length === 0 && tl.certItems.length > 0 && (
                            <span className="req-empty">All available certifications are selected</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* --- Compliance Requirements --- */}
              <div className="req-section">
                <button type="button" className="req-toggle" onClick={() => toggleSection(compKey)}>
                  <span className="req-toggle-label">
                    Compliance Requirements
                    {compCount > 0 && <span className="req-count">{compCount}</span>}
                  </span>
                  <span className="req-chevron">{isExpanded(compKey) ? "▾" : "▸"}</span>
                </button>
                {isExpanded(compKey) && (
                  <div className="req-body">
                    {tl.complianceItems.length > 0 && (
                      <div className="delta-area" style={{ marginBottom: 12 }}>
                        <span className="delta-label">Selected compliance requirements</span>
                      </div>
                    )}
                    {tl.complianceItems.map((ci, cIdx) => {
                      const variantsForType = complianceVariants.filter((v) => v.requirementTypeId === ci.requirementTypeId);
                      return (
                        <div key={cIdx} className="compliance-row">
                          <select className="form-select-sm" value={ci.requirementTypeId}
                            onChange={(e) => updateComplianceItem(idx, cIdx, "requirementTypeId", e.target.value)}>
                            {complianceReqTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                          </select>
                          <select className="form-select-sm" value={ci.variantId}
                            onChange={(e) => updateComplianceItem(idx, cIdx, "variantId", e.target.value)}>
                            <option value="">No variant</option>
                            {variantsForType.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                          <button type="button" className="rm-btn" onClick={() => removeComplianceItem(idx, cIdx)}>×</button>
                        </div>
                      );
                    })}
                    {complianceReqTypes.length === 0 ? (
                      <span className="req-empty" style={{ display: "block", marginTop: 8 }}>
                        {registryLoaded ? "Compliance registry is empty or failed to load — check warnings above" : "Loading compliance types..."}
                      </span>
                    ) : (
                      <button type="button" className="add-btn-sm" onClick={() => addComplianceItem(idx)}>
                        + Add Compliance Requirement
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
        <button type="button" className="create-btn" onClick={handleCreateOrder} disabled={!canSubmit}>
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </div>

      <style jsx>{`
        .co-container { padding: 24px 40px 60px; max-width: 1400px; margin: 0 auto; }
        .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
        .back-btn { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; padding: 0; }
        .back-btn:hover { color: #3b82f6; }
        .page-header h1 { font-size: 24px; font-weight: 600; color: #fff; margin: 0; }
        .cust-badge { font-family: var(--font-geist-mono), monospace; font-size: 12px; padding: 4px 10px; background: rgba(59,130,246,0.15); color: #3b82f6; border-radius: 6px; }

        .error-banner { padding: 12px 16px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; color: #ef4444; font-size: 13px; }
        .registry-warn-banner { padding: 12px 16px; margin-bottom: 16px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; color: #f59e0b; font-size: 12px; line-height: 1.5; }

        .form-section { margin-bottom: 28px; padding: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .form-section h2 { font-size: 16px; font-weight: 600; color: #fff; margin: 0 0 16px; }
        .section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .section-header h2 { margin: 0; }

        .form-row { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.3px; }
        .form-input, .form-textarea, .form-select { padding: 10px 12px; font-size: 13px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; }
        .form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .form-input::placeholder, .form-textarea::placeholder { color: rgba(255,255,255,0.3); }
        .form-textarea { resize: vertical; min-height: 60px; width: 100%; }
        .form-select { cursor: pointer; }
        .helper-text { margin: 12px 0 0; font-size: 11px; color: rgba(255,255,255,0.4); font-style: italic; }

        /* Job Site city/state/zip row */
        .site-csz-row { display: flex; gap: 12px; margin-top: 12px; }

        /* Job Contacts */
        .contacts-empty { font-size: 13px; color: rgba(255,255,255,0.4); font-style: italic; padding: 8px 0; }
        .contact-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .contact-select { flex: 2; }
        .role-select { flex: 1; min-width: 140px; }
        .supervisor-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .supervisor-toggle-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.7); cursor: pointer; margin: 0; }
        .supervisor-toggle-label input[type="checkbox"] { accent-color: #3b82f6; }
        .supervisor-contact-select { min-width: 220px; }
        .primary-badge { font-size: 10px; font-weight: 600; color: #22c55e; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); border-radius: 4px; padding: 2px 8px; white-space: nowrap; }

        /* Toggle headers */
        .toggle-header { display: flex; align-items: center; gap: 16px; }
        .toggle-header h2 { margin: 0; }
        .toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.7); cursor: pointer; user-select: none; }
        .toggle-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer; }
        .toggle-label input[type="checkbox"]:checked + span { color: #fff; }

        /* Shift differential grid */
        .sd-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 500px; margin-top: 16px; }

        /* Commission split notice */
        .split-notice { display: flex; gap: 12px; margin-top: 14px; padding: 14px 16px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; }
        .split-notice-icon { font-size: 18px; flex-shrink: 0; line-height: 1.4; }
        .split-notice-title { font-size: 13px; font-weight: 600; color: #f59e0b; margin: 0 0 4px; }
        .split-notice-text { font-size: 12px; color: rgba(255,255,255,0.55); margin: 0; line-height: 1.5; }

        /* Trade line cards */
        .tl-card { margin-bottom: 24px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; }
        .tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .tl-num { font-size: 14px; font-weight: 600; color: #fff; }
        .tl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

        .form-input-sm, .form-select-sm { width: 100%; padding: 8px 10px; font-size: 12px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; }
        .form-input-sm:focus, .form-select-sm:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .form-input-sm.num-input { max-width: 100px; }

        /* Collapsible requirement sections */
        .req-section { margin-top: 10px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden; }
        .req-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.02); border: none; color: rgba(255,255,255,0.7); font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s ease; }
        .req-toggle:hover { background: rgba(255,255,255,0.04); }
        .req-toggle-label { display: flex; align-items: center; gap: 8px; }
        .req-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; font-size: 10px; font-weight: 700; background: rgba(59,130,246,0.2); color: #3b82f6; border-radius: 10px; }
        .req-chevron { font-size: 11px; color: rgba(255,255,255,0.4); }
        .req-body { padding: 12px 14px; }
        .req-empty { font-size: 11px; color: rgba(255,255,255,0.4); font-style: italic; }

        /* Baseline area inside requirement sections */
        .baseline-area { margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .baseline-area-label { display: block; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
        .baseline-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .baseline-btn-inline { padding: 5px 12px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
        .baseline-btn-inline:hover { color: #3b82f6; border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.06); }
        .baseline-active { color: #22c55e; border-color: rgba(34,197,94,0.5); border-style: solid; background: rgba(34,197,94,0.08); }
        .baseline-active:hover { color: #22c55e; border-color: rgba(34,197,94,0.5); background: rgba(34,197,94,0.12); }
        .baseline-indicator { display: block; margin-top: 8px; font-size: 11px; color: rgba(34,197,94,0.8); font-style: italic; }

        /* Baseline loading / error indicators */
        .baseline-loading { display: block; margin-top: 8px; font-size: 11px; color: rgba(59,130,246,0.8); font-style: italic; }
        .baseline-error { display: block; margin-top: 8px; font-size: 11px; color: rgba(245,158,11,0.9); font-style: italic; }
        .baseline-btn-inline:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Baseline item tag */
        .baseline-tag { display: inline-block; margin-left: 6px; padding: 1px 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: rgba(34,197,94,0.9); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); border-radius: 4px; }
        .delta-tag { display: inline-block; margin-left: 6px; padding: 1px 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: rgba(59,130,246,0.9); background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 4px; }
        .req-row-baseline { background: rgba(34,197,94,0.04); border-left: 2px solid rgba(34,197,94,0.3); }
        .req-check-locked { cursor: default; }
        .req-check-locked input[type="checkbox"] { cursor: default; opacity: 0.6; }

        /* Delta area */
        .delta-area {}
        .delta-label { display: block; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }

        .req-list { display: flex; flex-direction: column; gap: 4px; }
        .req-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; transition: background 0.1s ease; }
        .req-row-active { background: rgba(59,130,246,0.06); }
        .req-check-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.7); cursor: pointer; }
        .req-check-label input[type="checkbox"] { width: 14px; height: 14px; accent-color: #3b82f6; cursor: pointer; }
        .req-check-label input[type="checkbox"]:checked + span { color: #fff; }

        .enf-select { padding: 3px 8px; font-size: 10px; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; cursor: pointer; }
        .enf-select:focus { outline: none; border-color: rgba(59,130,246,0.5); }

        .compliance-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .compliance-row .form-select-sm { flex: 1; }

        .add-btn { padding: 6px 12px; font-size: 12px; font-weight: 500; color: #3b82f6; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 4px; cursor: pointer; }
        .add-btn:hover { background: rgba(59,130,246,0.2); }
        .add-btn-sm { padding: 4px 10px; font-size: 11px; font-weight: 500; color: #3b82f6; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 4px; cursor: pointer; margin-top: 6px; }
        .add-btn-sm:disabled { opacity: 0.3; cursor: not-allowed; }

        .rm-btn { width: 24px; height: 24px; padding: 0; font-size: 16px; font-weight: 500; color: rgba(239,68,68,0.7); background: transparent; border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; cursor: pointer; flex-shrink: 0; }
        .rm-btn:hover { color: #ef4444; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.5); }

        .form-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); }
        .cancel-btn { padding: 12px 24px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.7); background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer; }
        .cancel-btn:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
        .create-btn { padding: 12px 24px; font-size: 14px; font-weight: 500; color: #fff; background: #3b82f6; border: none; border-radius: 6px; cursor: pointer; }
        .create-btn:hover:not(:disabled) { background: #2563eb; }
        .create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
