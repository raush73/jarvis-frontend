"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  CreateRampRow,
} from "@/lib/types/order";
import { ENFORCEMENT_LABELS } from "@/lib/types/order";
import {
  classifyMarginHealth,
  HEALTH_STATUS_COLORS,
  HEALTH_STATUS_LABELS,
} from "@/lib/constants/margin-health";

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

type SpecializationOption = { id: string; name: string; tradeId: string };
type CapabilityOption = { id: string; name: string; categories?: Array<{ id: string; name: string; isActive?: boolean }> };

type ReqItem = { typeId: string; enforcement: RequirementEnforcement; isBaseline?: boolean };

type BaselineSource = "MW4H" | "CUSTOMER" | null;

type TradeToolBaselineResponse = { tradeId: string; toolIds: string[] };
type TradePpeBaselineResponse = { tradeId: string; ppeTypeIds: string[] };
type CustomerToolBaselineResponse = { customerId: string; baselines: Array<{ tradeId: string; toolIds: string[] }> };
type CustomerPpeBaselineResponse = { customerId: string; baselines: Array<{ tradeId: string; ppeIds?: string[]; ppeTypeIds?: string[] }> };

type RampRowState = {
  startDate: string;
  endDate: string;
  headcount: number;
};

type TradeLineState = {
  tradeId: string;
  specializationId: string;
  capabilityIds: string[];
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
  rampEnabled: boolean;
  rampRows: RampRowState[];
};

function createEmptyTradeLine(defaultTradeId: string): TradeLineState {
  return {
    tradeId: defaultTradeId,
    specializationId: "",
    capabilityIds: [],
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
    rampEnabled: false,
    rampRows: [],
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
  const [inheritedSalesperson, setInheritedSalesperson] = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  const [inheritedPlanId, setInheritedPlanId] = useState<string | null>(null);
  const [inheritedPlanName, setInheritedPlanName] = useState<string | null>(null);
  const [commissionOverride, setCommissionOverride] = useState(false);

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

  // --- Specializations cache (keyed by tradeId) ---
  const [specsByTrade, setSpecsByTrade] = useState<Record<string, SpecializationOption[]>>({});
  const [specsLoading, setSpecsLoading] = useState<Record<string, boolean>>({});

  // --- Capabilities catalog ---
  const [capabilities, setCapabilities] = useState<CapabilityOption[]>([]);
  const [capabilityModalIdx, setCapabilityModalIdx] = useState<number | null>(null);
  const [capabilitySearch, setCapabilitySearch] = useState("");

  // --- Trade lines ---
  const [tradeLines, setTradeLines] = useState<TradeLineState[]>([]);

  // --- Trade-level burden previews (keyed by trade line index) ---
  // Populated by calling the canonical /payroll-burden-rates/preview endpoint
  // so the health dot matches saved-order truth.
  const [tradeHealthPreviews, setTradeHealthPreviews] = useState<
    Record<number, { regCost: number; totalBurdenPercent: number } | null>
  >({});
  // Debounce timers per trade line index
  const burdenDebounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // --- Header-level blended GM (pre-save, live) ---
  // Aggregates dollars across all trade lines that have valid canonical burden previews.
  // Follows the same weighted-revenue formula used by the saved-order evaluateOrderHealth:
  //   revenue_i = billRate_i × headcount_i
  //   tlc_i     = regCost_i  × headcount_i
  //   blended   = Σ(billRate_i - regCost_i) × headcount_i  ÷  Σ(billRate_i × headcount_i)
  // Does NOT average percentages. Does NOT introduce new burden math.
  const headerBlendedGm = useMemo(() => {
    let totalRevenue = 0;
    let totalGP = 0;
    let hasAny = false;

    tradeLines.forEach((tl, idx) => {
      const preview = tradeHealthPreviews[idx];
      const bill = parseFloat(tl.baseBillRate);
      const headcount = tl.requestedHeadcount > 0 ? tl.requestedHeadcount : 1;
      if (!preview || isNaN(bill) || bill <= 0) return;
      hasAny = true;
      totalRevenue += bill * headcount;
      totalGP += (bill - preview.regCost) * headcount;
    });

    if (!hasAny || totalRevenue <= 0) return null;
    const pct = (totalGP / totalRevenue) * 100;
    return { pct, status: classifyMarginHealth(pct) };
  }, [tradeLines, tradeHealthPreviews]);

  // --- Collapsible sections: key = "{tradeIdx}-{section}" ---
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const isExpanded = (key: string) => !!expanded[key];

  useEffect(() => {
    let alive = true;
    async function load() {
      const errors: string[] = [];
      try {
        const [tradesRes, ppeRes, toolsRes, certsRes, compReqRes, compVarRes, plansRes, contactsRes, custRes, capsRes] =
          await Promise.all([
            apiFetch<TradeListItem[]>("/trades").catch((e) => { errors.push(`Trades: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<PpeTypeOption[]>("/ppe-types?activeOnly=true").catch((e) => { errors.push(`PPE: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<ToolOption[]>("/tools?activeOnly=true").catch((e) => { errors.push(`Tools: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<CertTypeOption[]>("/certification-types").catch((e) => { errors.push(`Certifications: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<ComplianceReqTypeOption[]>("/compliance-requirement-types").catch((e) => { errors.push(`Compliance Types: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<ComplianceVariantOption[]>("/compliance-variants").catch((e) => { errors.push(`Compliance Variants: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<CommissionPlanOption[]>("/commissions/plans").catch((e) => { errors.push(`Commission Plans: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<CustomerContactOption[]>(`/customer-contacts/customer/${customerId}`).catch((e) => { errors.push(`Customer Contacts: ${e instanceof Error ? e.message : "failed"}`); return []; }),
            apiFetch<any>(`/customers/${customerId}`).catch((e) => { errors.push(`Customer: ${e instanceof Error ? e.message : "failed"}`); return null; }),
            apiFetch<CapabilityOption[]>("/capabilities?include=categories&activeOnly=true").catch((e) => { errors.push(`Capabilities: ${e instanceof Error ? e.message : "failed"}`); return []; }),
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
        setCapabilities(Array.isArray(capsRes) ? capsRes : []);
        setTradeLines([createEmptyTradeLine(tradeList[0]?.id ?? "")]);
        if (tradeList[0]?.id) loadSpecsForTrade(tradeList[0].id);

        if (custRes?.registrySalesperson) {
          const sp = custRes.registrySalesperson;
          setInheritedSalesperson({ id: sp.id, firstName: sp.firstName, lastName: sp.lastName });
          if (sp.defaultCommissionPlan) {
            setInheritedPlanId(sp.defaultCommissionPlanId);
            setInheritedPlanName(sp.defaultCommissionPlan.name);
            setSelectedCommissionPlanId(sp.defaultCommissionPlanId);
          }
        }
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

  const loadSpecsForTrade = async (tradeId: string) => {
    if (!tradeId || specsByTrade[tradeId] || specsLoading[tradeId]) return;
    setSpecsLoading((prev) => ({ ...prev, [tradeId]: true }));
    try {
      const specs = await apiFetch<SpecializationOption[]>(`/trades/${tradeId}/specializations?activeOnly=true`);
      setSpecsByTrade((prev) => ({ ...prev, [tradeId]: Array.isArray(specs) ? specs : [] }));
    } catch {
      setSpecsByTrade((prev) => ({ ...prev, [tradeId]: [] }));
    } finally {
      setSpecsLoading((prev) => ({ ...prev, [tradeId]: false }));
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
          specializationId: "",
          capabilityIds: [],
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
    if (newTradeId) loadSpecsForTrade(newTradeId);
  };

  // --- Canonical burden preview per trade line ---
  // Fires a debounced call to POST /payroll-burden-rates/preview (same endpoint
  // as Admin Burden Preview) so the health dot uses true loaded cost, not pay-only.
  const scheduleBurdenPreview = (idx: number) => {
    clearTimeout(burdenDebounceTimers.current[idx]);
    burdenDebounceTimers.current[idx] = setTimeout(async () => {
      const tl = tradeLines[idx];
      if (!tl) return;
      const pay = parseFloat(tl.basePayRate);
      const state = jobSiteState.trim().toUpperCase();
      if (!tl.tradeId || isNaN(pay) || pay <= 0 || state.length !== 2) {
        setTradeHealthPreviews((prev) => ({ ...prev, [idx]: null }));
        return;
      }
      try {
        const result = await apiFetch<{ regCost: number; totalBurdenPercent: number }>(
          "/payroll-burden-rates/preview",
          {
            method: "POST",
            body: JSON.stringify({ payRate: pay, stateCode: state, tradeId: tl.tradeId }),
          },
        );
        setTradeHealthPreviews((prev) => ({
          ...prev,
          [idx]: { regCost: result.regCost, totalBurdenPercent: result.totalBurdenPercent },
        }));
      } catch {
        setTradeHealthPreviews((prev) => ({ ...prev, [idx]: null }));
      }
    }, 600);
  };

  // Re-run burden preview when relevant inputs change
  useEffect(() => {
    tradeLines.forEach((_, idx) => scheduleBurdenPreview(idx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeLines.map((t) => `${t.tradeId}|${t.basePayRate}`).join(","), jobSiteState]);

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

        const rampSchedule: CreateRampRow[] = tl.rampEnabled
          ? tl.rampRows
              .filter((r) => r.startDate && r.endDate && r.headcount >= 1)
              .map((r) => ({
                startDate: r.startDate,
                endDate: r.endDate,
                headcount: r.headcount,
              }))
          : [];

          return {
          tradeId: tl.tradeId,
          ...(tl.specializationId ? { specializationId: tl.specializationId } : {}),
          ...(tl.capabilityIds.length > 0 ? { capabilityIds: tl.capabilityIds } : {}),
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
          ...(rampSchedule.length > 0 ? { rampSchedule } : {}),
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
        {headerBlendedGm && (
          <span
            className="header-gm-indicator"
            title={`Blended order GM — ${headerBlendedGm.pct.toFixed(1)}% (aggregated from trade line previews, pre-save)`}
          >
            <span
              className="header-gm-dot"
              style={{ background: HEALTH_STATUS_COLORS[headerBlendedGm.status] }}
            />
            <span
              className="header-gm-text"
              style={{ color: HEALTH_STATUS_COLORS[headerBlendedGm.status] }}
            >
              {HEALTH_STATUS_LABELS[headerBlendedGm.status]} — Order GM {headerBlendedGm.pct.toFixed(1)}%
            </span>
          </span>
        )}
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

      {/* Commission — inheritance-first */}
      <div className="form-section">
        <h2>Commission</h2>

        {/* Inherited salesperson + plan display */}
        <div className="commission-inherited-block">
          <div className="commission-inherited-row">
            <span className="commission-inherited-label">Salesperson</span>
            <span className="commission-inherited-value">
              {inheritedSalesperson
                ? `${inheritedSalesperson.firstName} ${inheritedSalesperson.lastName}`
                : <span className="commission-warning-text">No salesperson assigned to this customer</span>}
            </span>
          </div>
          <div className="commission-inherited-row">
            <span className="commission-inherited-label">Commission Plan</span>
            <span className="commission-inherited-value">
              {inheritedPlanName
                ? inheritedPlanName
                : (inheritedSalesperson
                  ? <span className="commission-warning-text">No default plan assigned — Global Default will apply</span>
                  : <span className="commission-warning-text">N/A</span>)}
            </span>
          </div>
          {inheritedPlanName && !commissionOverride && (
            <div className="commission-source-label">Inherited from Salesperson</div>
          )}
        </div>

        {/* Override toggle */}
        <div className="toggle-header" style={{ marginTop: 16 }}>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={commissionOverride}
              onChange={(e) => {
                const checked = e.target.checked;
                setCommissionOverride(checked);
                if (!checked && inheritedPlanId) {
                  setSelectedCommissionPlanId(inheritedPlanId);
                }
              }}
            />
            <span>Override Commission Plan</span>
          </label>
        </div>

        {commissionOverride && (
          <div className="commission-override-block">
            <div className="commission-override-warning">
              Overriding the inherited commission plan will require management approval before this order can be activated.
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label className="form-label">Override Plan</label>
              <select className="form-select" value={selectedCommissionPlanId}
                onChange={(e) => setSelectedCommissionPlanId(e.target.value)}>
                <option value="">Select a plan...</option>
                {commissionPlans
                  .filter((p) => p.id !== inheritedPlanId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.isDefault ? " (Global Default)" : ""}</option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {/* Split commission toggle */}
        <div className="toggle-header" style={{ marginTop: 12 }}>
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
            <div className="split-notice-icon">&#x26A1;</div>
            <div>
              <p className="split-notice-title">Split Commission Mode</p>
              <p className="split-notice-text">
                This order uses split commission allocation. The active plan applies to the total commissionable amount.
                Split commission detail allocation will be configured after order creation.
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
                {(() => {
                  const preview = tradeHealthPreviews[idx];
                  const bill = parseFloat(tl.baseBillRate);
                  if (preview && !isNaN(bill) && bill > 0) {
                    const grossProfit = bill - preview.regCost;
                    const gm = (grossProfit / bill) * 100;
                    const status = classifyMarginHealth(gm);
                    return (
                      <span className="tl-health-indicator">
                        <span
                          className="tl-health-dot"
                          style={{ background: HEALTH_STATUS_COLORS[status] }}
                        />
                        <span
                          className="tl-health-gm"
                          style={{ color: HEALTH_STATUS_COLORS[status] }}
                          title={`Burden: ${preview.totalBurdenPercent.toFixed(2)}% | TLC: $${preview.regCost.toFixed(2)}/hr`}
                        >
                          GM {gm.toFixed(1)}%
                        </span>
                      </span>
                    );
                  }
                  return null;
                })()}
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
                  <label className="form-label">Specialization</label>
                  <select className="form-select-sm" value={tl.specializationId}
                    disabled={!tl.tradeId || specsLoading[tl.tradeId]}
                    onChange={(e) => updateTradeLine(idx, { specializationId: e.target.value })}>
                    <option value="">{specsLoading[tl.tradeId] ? "Loading…" : "None"}</option>
                    {(specsByTrade[tl.tradeId] ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
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

              {/* Capability requirements */}
              <div className="cap-section" style={{ marginTop: 12 }}>
                <div className="cap-header-row">
                  <label className="form-label" style={{ marginBottom: 0 }}>Capabilities</label>
                  <button type="button" className="add-btn-sm"
                    onClick={() => { setCapabilityModalIdx(idx); setCapabilitySearch(""); }}>
                    + Add Capabilities
                  </button>
                </div>
                {tl.capabilityIds.length > 0 && (
                  <div className="cap-chips">
                    {tl.capabilityIds.map((cid) => {
                      const cap = capabilities.find((c) => c.id === cid);
                      return (
                        <span key={cid} className="cap-chip">
                          {cap?.name ?? cid.slice(0, 8)}
                          <button type="button" className="cap-chip-rm"
                            onClick={() => updateTradeLine(idx, { capabilityIds: tl.capabilityIds.filter((id) => id !== cid) })}>×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
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

              {/* --- Ramp Schedule --- */}
              <div className="ramp-section" style={{ marginTop: 12 }}>
                <label className="form-label supervisor-toggle-label">
                  <input type="checkbox" checked={tl.rampEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateTradeLine(idx, {
                        rampEnabled: checked,
                        rampRows: checked && tl.rampRows.length === 0
                          ? [{ startDate: tl.startDate, endDate: tl.expectedEndDate, headcount: tl.requestedHeadcount || 1 }]
                          : tl.rampRows,
                      });
                    }} />
                  <span>Add Ramp Schedule</span>
                </label>
                {tl.rampEnabled && (
                  <div className="ramp-editor">
                    <div className="ramp-info-text">
                      Ramp defines phased staffing demand over time. Gaps between rows represent zero-demand periods. End date is exclusive — the next row begins on that date.
                    </div>
                    {tl.rampRows.map((row, rIdx) => (
                      <div key={rIdx} className="ramp-row-editor">
                        {rIdx > 0 && (() => {
                          const prevEnd = tl.rampRows[rIdx - 1].endDate;
                          if (prevEnd && row.startDate && new Date(row.startDate) > new Date(prevEnd)) {
                            return <div className="ramp-gap-indicator">Gap — 0 demand period</div>;
                          }
                          return null;
                        })()}
                        <div className="ramp-row-fields">
                          <div className="form-row" style={{ flex: 1 }}>
                            <label className="form-label">Start</label>
                            <input type="date" className="form-input-sm" value={row.startDate}
                              onChange={(e) => {
                                const rows = [...tl.rampRows];
                                rows[rIdx] = { ...rows[rIdx], startDate: e.target.value };
                                updateTradeLine(idx, { rampRows: rows });
                              }} />
                          </div>
                          <div className="form-row" style={{ flex: 1 }}>
                            <label className="form-label">End</label>
                            <input type="date" className="form-input-sm" value={row.endDate}
                              onChange={(e) => {
                                const rows = [...tl.rampRows];
                                rows[rIdx] = { ...rows[rIdx], endDate: e.target.value };
                                updateTradeLine(idx, { rampRows: rows });
                              }} />
                          </div>
                          <div className="form-row" style={{ flex: 0.5 }}>
                            <label className="form-label">Workers</label>
                            <input type="number" className="form-input-sm num-input" value={row.headcount} min={1}
                              onChange={(e) => {
                                const rows = [...tl.rampRows];
                                rows[rIdx] = { ...rows[rIdx], headcount: parseInt(e.target.value) || 1 };
                                updateTradeLine(idx, { rampRows: rows });
                              }} />
                          </div>
                          <button type="button" className="rm-btn" style={{ marginTop: 18 }}
                            onClick={() => {
                              const rows = tl.rampRows.filter((_, i) => i !== rIdx);
                              updateTradeLine(idx, { rampRows: rows });
                            }}>×</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="add-btn-sm" onClick={() => {
                      const lastRow = tl.rampRows[tl.rampRows.length - 1];
                      updateTradeLine(idx, {
                        rampRows: [...tl.rampRows, {
                          startDate: lastRow?.endDate || tl.startDate,
                          endDate: "",
                          headcount: lastRow?.headcount || tl.requestedHeadcount || 1,
                        }],
                      });
                    }}>+ Add Ramp Period</button>
                  </div>
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

      {/* Capability Selector Modal */}
      {capabilityModalIdx !== null && (() => {
        const tlForModal = tradeLines[capabilityModalIdx];
        if (!tlForModal) return null;
        const selectedSet = new Set(tlForModal.capabilityIds);
        const searchLower = capabilitySearch.toLowerCase();
        const filtered = searchLower
          ? capabilities.filter((c) => c.name.toLowerCase().includes(searchLower))
          : capabilities;

        const categoryMap = new Map<string, { name: string; items: CapabilityOption[] }>();
        const uncategorized: CapabilityOption[] = [];
        for (const cap of filtered) {
          const cats = cap.categories ?? [];
          if (cats.length === 0) {
            uncategorized.push(cap);
          } else {
            for (const cat of cats) {
              if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, { name: cat.name, items: [] });
              categoryMap.get(cat.id)!.items.push(cap);
            }
          }
        }
        const sortedGroups = [...categoryMap.entries()]
          .sort((a, b) => a[1].name.localeCompare(b[1].name));

        const toggleCap = (capId: string) => {
          const next = selectedSet.has(capId)
            ? tlForModal.capabilityIds.filter((id) => id !== capId)
            : [...tlForModal.capabilityIds, capId];
          updateTradeLine(capabilityModalIdx!, { capabilityIds: next });
        };

        return (
          <div className="cap-modal-overlay" onClick={() => setCapabilityModalIdx(null)}>
            <div className="cap-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cap-modal-header">
                <h3>Select Capabilities — Trade Line {capabilityModalIdx + 1}</h3>
                <button type="button" className="cap-modal-close" onClick={() => setCapabilityModalIdx(null)}>×</button>
              </div>
              <div className="cap-modal-search">
                <input type="text" className="form-input" placeholder="Search capabilities…"
                  value={capabilitySearch} onChange={(e) => setCapabilitySearch(e.target.value)}
                  autoFocus />
              </div>
              <div className="cap-modal-body">
                {filtered.length === 0 && (
                  <p className="cap-modal-empty">{capabilities.length === 0 ? "No capabilities loaded" : "No matches"}</p>
                )}
                {sortedGroups.map(([catId, group]) => (
                  <div key={catId} className="cap-category-group">
                    <div className="cap-category-name">{group.name}</div>
                    {group.items.map((cap) => (
                      <label key={cap.id} className={`cap-check-row ${selectedSet.has(cap.id) ? "cap-check-active" : ""}`}>
                        <input type="checkbox" checked={selectedSet.has(cap.id)}
                          onChange={() => toggleCap(cap.id)} />
                        <span>{cap.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
                {uncategorized.length > 0 && (
                  <div className="cap-category-group">
                    {sortedGroups.length > 0 && <div className="cap-category-name">Other</div>}
                    {uncategorized.map((cap) => (
                      <label key={cap.id} className={`cap-check-row ${selectedSet.has(cap.id) ? "cap-check-active" : ""}`}>
                        <input type="checkbox" checked={selectedSet.has(cap.id)}
                          onChange={() => toggleCap(cap.id)} />
                        <span>{cap.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="cap-modal-footer">
                <span className="cap-modal-count">{tlForModal.capabilityIds.length} selected</span>
                <button type="button" className="create-btn" onClick={() => setCapabilityModalIdx(null)}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
        <button type="button" className="create-btn" onClick={handleCreateOrder} disabled={!canSubmit}>
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </div>

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Customer Order Create Page
           Palette: bg #f8fafc | card #fff | border #e5e7eb
                    text-primary #111827 | text-secondary #374151
                    text-muted #6b7280 | blue #2563eb | blue-hover #1d4ed8
        ============================================================ */

        /* --- Page Shell --- */
        .co-container {
          padding: 24px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
          background: #f8fafc;
          min-height: 100vh;
        }

        /* --- Page Header --- */
        .page-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .back-btn:hover { background: #f1f5f9; border-color: #d1d5db; }
        .page-header h1 {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          letter-spacing: -0.3px;
        }
        .cust-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          border-radius: 6px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        /* --- Banners --- */
        .error-banner {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: #fff1f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #991b1b;
          font-size: 13px;
        }
        .registry-warn-banner {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 8px;
          color: #92400e;
          font-size: 12px;
          line-height: 1.5;
        }

        /* --- Form Sections (white cards) --- */
        .form-section {
          margin-bottom: 20px;
          padding: 22px 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }
        .form-section h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .section-header h2 { margin: 0; }

        /* --- Form Fields --- */
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        /* Full-width inputs / textarea / select */
        .form-input,
        .form-textarea,
        .form-select {
          width: 100%;
          padding: 9px 11px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.12s ease;
          box-sizing: border-box;
        }
        .form-input:focus,
        .form-textarea:focus,
        .form-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
        }
        .form-input::placeholder,
        .form-textarea::placeholder { color: #9ca3af; }
        .form-textarea { resize: vertical; min-height: 60px; }
        .form-select { cursor: pointer; }

        /* Ensure dropdown options are always readable in light theme */
        .form-select option,
        .form-select-sm option,
        .enf-select option {
          background: #ffffff;
          color: #111827;
        }

        .helper-text {
          margin: 10px 0 0;
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
        }

        /* Job Site city/state/zip row */
        .site-csz-row { display: flex; gap: 12px; margin-top: 12px; }

        /* --- Job Contacts --- */
        .contacts-empty {
          font-size: 13px;
          color: #6b7280;
          font-style: italic;
          padding: 8px 0;
        }
        .contact-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .contact-select { flex: 2; }
        .role-select { flex: 1; min-width: 140px; }
        .supervisor-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .supervisor-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          margin: 0;
        }
        .supervisor-toggle-label input[type="checkbox"] { accent-color: #2563eb; }
        .supervisor-contact-select { min-width: 220px; }
        .primary-badge {
          display: inline-flex;
          align-items: center;
          height: 20px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #16a34a;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        /* --- Toggle Headers --- */
        .toggle-header { display: flex; align-items: center; gap: 16px; }
        .toggle-header h2 { margin: 0; }
        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          user-select: none;
        }
        .toggle-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
        }
        .toggle-label input[type="checkbox"]:checked + span { color: #111827; }

        /* Shift differential grid */
        .sd-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          max-width: 500px;
          margin-top: 16px;
        }

        /* --- Commission Section --- */
        .commission-inherited-block {
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .commission-inherited-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
        }
        .commission-inherited-row + .commission-inherited-row {
          border-top: 1px solid #f1f5f9;
        }
        .commission-inherited-label {
          font-size: 12px;
          color: #6b7280;
          flex-shrink: 0;
        }
        .commission-inherited-value {
          font-size: 13px;
          color: #111827;
          font-weight: 500;
          text-align: right;
        }
        .commission-warning-text {
          color: #d97706;
          font-weight: 400;
          font-size: 12px;
        }
        .commission-source-label {
          margin-top: 8px;
          font-size: 11px;
          color: #2563eb;
          font-weight: 500;
          letter-spacing: 0.2px;
        }
        .commission-override-block {
          margin-top: 12px;
          padding: 14px 16px;
          background: #fff1f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
        }
        .commission-override-warning {
          font-size: 12px;
          color: #991b1b;
          font-weight: 500;
          line-height: 1.5;
        }
        .split-notice {
          display: flex;
          gap: 12px;
          margin-top: 14px;
          padding: 14px 16px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 8px;
        }
        .split-notice-icon { font-size: 18px; flex-shrink: 0; line-height: 1.4; }
        .split-notice-title {
          font-size: 13px;
          font-weight: 600;
          color: #d97706;
          margin: 0 0 4px;
        }
        .split-notice-text {
          font-size: 12px;
          color: #4b5563;
          margin: 0;
          line-height: 1.5;
        }

        /* --- Trade Line Cards --- */
        .tl-card {
          margin-bottom: 20px;
          padding: 18px 20px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }
        .tl-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .tl-num {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }
        .tl-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        /* Small inputs and selects — used in trade line grid and inline rows */
        .form-input-sm,
        .form-select-sm {
          width: 100%;
          padding: 8px 10px;
          font-size: 12px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          outline: none;
          transition: border-color 0.12s ease;
          box-sizing: border-box;
        }
        .form-input-sm:focus,
        .form-select-sm:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.12);
        }
        .form-input-sm::placeholder { color: #9ca3af; }
        .form-input-sm.num-input { max-width: 100px; }

        /* --- Collapsible Requirement Sections --- */
        .req-section {
          margin-top: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .req-toggle {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #f8fafc;
          border: none;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .req-toggle:hover { background: #f1f5f9; }
        .req-toggle-label { display: flex; align-items: center; gap: 8px; }
        .req-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          font-size: 10px;
          font-weight: 700;
          background: #eff6ff;
          color: #1d4ed8;
          border-radius: 10px;
        }
        .req-chevron { font-size: 11px; color: #9ca3af; }
        .req-body {
          padding: 12px 14px;
          background: #ffffff;
        }
        .req-empty {
          font-size: 11px;
          color: #6b7280;
          font-style: italic;
        }

        /* --- Baseline Area (inside requirement sections) --- */
        .baseline-area {
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .baseline-area-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }
        .baseline-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .baseline-btn-inline {
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          background: #f8fafc;
          border: 1px dashed #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .baseline-btn-inline:hover {
          color: #1d4ed8;
          border-color: #bfdbfe;
          background: #eff6ff;
          border-style: solid;
        }
        .baseline-btn-inline:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Active baseline button — green confirmation state */
        .baseline-active {
          color: #16a34a;
          border-color: #bbf7d0;
          border-style: solid;
          background: #f0fdf4;
        }
        .baseline-active:hover {
          color: #16a34a;
          border-color: #86efac;
          background: #dcfce7;
        }

        .baseline-indicator {
          display: block;
          margin-top: 8px;
          font-size: 11px;
          color: #16a34a;
          font-style: italic;
        }
        .baseline-loading {
          display: block;
          margin-top: 8px;
          font-size: 11px;
          color: #2563eb;
          font-style: italic;
        }
        .baseline-error {
          display: block;
          margin-top: 8px;
          font-size: 11px;
          color: #d97706;
          font-style: italic;
        }

        /* --- Baseline / Delta Tags --- */
        .baseline-tag {
          display: inline-block;
          margin-left: 6px;
          padding: 1px 6px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #16a34a;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
        }
        .delta-tag {
          display: inline-block;
          margin-left: 6px;
          padding: 1px 6px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
        }

        /* Baseline row highlight — subtle green left border */
        .req-row-baseline {
          background: #f0fdf4;
          border-left: 2px solid #bbf7d0;
        }
        .req-check-locked { cursor: default; }
        .req-check-locked input[type="checkbox"] { cursor: default; opacity: 0.6; }

        /* --- Delta Area --- */
        .delta-area {}
        .delta-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }

        /* --- Requirement List --- */
        .req-list { display: flex; flex-direction: column; gap: 4px; }
        .req-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.1s ease;
        }
        .req-row-active { background: #eff6ff; }
        .req-check-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #374151;
          cursor: pointer;
        }
        .req-check-label input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: #2563eb;
          cursor: pointer;
        }
        .req-check-label input[type="checkbox"]:checked + span { color: #111827; }

        /* Enforcement select — small inline dropdown inside req rows */
        .enf-select {
          padding: 3px 8px;
          font-size: 10px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          outline: none;
        }
        .enf-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.12);
        }
        .enf-select option { background: #ffffff; color: #111827; }

        /* --- Compliance Row --- */
        .compliance-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .compliance-row .form-select-sm { flex: 1; }

        /* --- Inline Action Buttons --- */
        .add-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .add-btn:hover { background: #dbeafe; border-color: #93c5fd; }

        .add-btn-sm {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 6px;
          transition: background 0.12s ease;
        }
        .add-btn-sm:hover { background: #dbeafe; }
        .add-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Remove button — destructive, icon-size */
        .rm-btn {
          width: 24px;
          height: 24px;
          padding: 0;
          font-size: 16px;
          font-weight: 500;
          color: #dc2626;
          background: transparent;
          border: 1px solid #fecaca;
          border-radius: 4px;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .rm-btn:hover { background: #fff1f2; border-color: #fca5a5; }

        /* --- Form Actions Bar --- */
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          margin-top: 8px;
        }
        .cancel-btn {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .cancel-btn:hover { background: #f1f5f9; border-color: #d1d5db; }

        .create-btn {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          background: #2563eb;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .create-btn:hover:not(:disabled) { background: #1d4ed8; }
        .create-btn:disabled { background: #93c5fd; cursor: not-allowed; }

        /* --- Health Indicators (semantic status colors — do not override) --- */
        .tl-health-indicator { display: inline-flex; align-items: center; gap: 5px; }
        .tl-health-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .tl-health-gm {
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-geist-mono), monospace;
          cursor: default;
        }

        /* Blended order GM badge in page header (pre-save) */
        .header-gm-indicator {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 14px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          margin-left: 4px;
          cursor: default;
        }
        .header-gm-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .header-gm-text {
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-geist-mono), monospace;
          letter-spacing: 0.2px;
        }

        /* --- Ramp Editor --- */
        .ramp-section {}
        .ramp-editor {
          margin-top: 10px;
          padding: 12px 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
        }
        .ramp-info-text {
          font-size: 11px;
          color: #4b5563;
          font-style: italic;
          margin-bottom: 10px;
        }
        .ramp-row-editor { margin-bottom: 6px; }
        .ramp-row-fields { display: flex; gap: 8px; align-items: flex-start; }
        .ramp-gap-indicator {
          padding: 4px 12px;
          margin-bottom: 4px;
          font-size: 10px;
          color: #6b7280;
          font-style: italic;
          border-left: 2px dashed #d1d5db;
          margin-left: 16px;
        }

        /* --- Capability Section (per trade line) --- */
        .cap-section {}
        .cap-header-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }
        .cap-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }
        .cap-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          font-size: 12px;
          color: #1d4ed8;
          font-weight: 500;
        }
        .cap-chip-rm {
          background: none;
          border: none;
          color: #93c5fd;
          font-size: 14px;
          cursor: pointer;
          padding: 0 2px;
          line-height: 1;
        }
        .cap-chip-rm:hover { color: #dc2626; }

        /* --- Capability Modal --- */
        .cap-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .cap-modal {
          background: #ffffff;
          border-radius: 14px;
          width: 640px;
          max-width: 92vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        }
        .cap-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        .cap-modal-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #111827;
        }
        .cap-modal-close {
          background: none;
          border: none;
          font-size: 22px;
          color: #9ca3af;
          cursor: pointer;
          padding: 2px 6px;
          line-height: 1;
        }
        .cap-modal-close:hover { color: #374151; }
        .cap-modal-search {
          padding: 12px 22px;
          border-bottom: 1px solid #f3f4f6;
        }
        .cap-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 22px 18px;
          min-height: 240px;
        }
        .cap-modal-empty {
          color: #6b7280;
          font-size: 13px;
          text-align: center;
          padding: 24px 0;
        }
        .cap-category-group {
          margin-bottom: 14px;
        }
        .cap-category-name {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #f3f4f6;
        }
        .cap-check-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
          transition: background 0.1s ease;
        }
        .cap-check-row:hover { background: #f9fafb; }
        .cap-check-active { background: #eff6ff; }
        .cap-check-active:hover { background: #dbeafe; }
        .cap-check-row input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
        }
        .cap-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 22px;
          border-top: 1px solid #e5e7eb;
        }
        .cap-modal-count {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
