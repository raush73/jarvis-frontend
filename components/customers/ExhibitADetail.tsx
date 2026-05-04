'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

/* ───── Types ───── */

interface ExhibitALine {
  id: string;
  tradeCode: string;
  tradeName: string;
  state: string | null;
  costType: string | null;
  baseWage: number | null;
  fringeAmount: number | null;
  basePayRate: number | null;
  baseBillRate: number | null;
  otPayRate: number | null;
  otBillRate: number | null;
  dtPayRate: number | null;
  dtBillRate: number | null;
  perDiem: number | null;
  burdenPct: number | null;
  markupPct: number | null;
  notes: string | null;
  sortOrder: number;
}

interface ExhibitA {
  id: string;
  exhibitANumber: string | null;
  status: string;
  title: string | null;
  projectName: string | null;
  siteName: string | null;
  siteAddress: string | null;
  notes: string | null;
  expiresAt: string | null;
  effectiveDate: string | null;
  customerContactId: string | null;
  customerContactName: string | null;
  customerContactEmail: string | null;
  customerContactPhone: string | null;
  invoicingTerms: string | null;
  paymentTerms: string | null;
  overtimeRules: string | null;
  perDiemRules: string | null;
  travelAssumptions: string | null;
  ppeAssumptions: string | null;
  safetyRequirements: string | null;
  prevailingWageNotes: string | null;
  shiftDifferentialNotes: string | null;
  reportingRequirements: string | null;
  specialConditions: string | null;
  paymentTermsPolicy: string | null;
  invoiceCadencePolicy: string | null;
  perDiemCadence: string | null;
  lodgingResponsibility: string | null;
  ppeResponsibility: string | null;
  toolResponsibility: string | null;
  travelTermsPolicy: string | null;
  approvalMethod: string | null;
  approvalNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ExhibitALine[];
  customer?: { id: string; name: string };
  customerContact?: { id: string; firstName: string; lastName: string; email: string | null; officePhone: string | null; cellPhone: string | null } | null;
  msa?: { id: string; msaNumber: string | null; title: string | null; status: string } | null;
}

interface RateSheetSummary { id: string; rateSheetNumber: string | null; title: string | null; status: string; _count?: { lines: number } }
interface Trade { id: string; name: string; wcClassCode: string; isActive: boolean }
interface ContactOption { id: string; firstName: string; lastName: string; email: string | null; officePhone: string | null; cellPhone: string | null; jobTitle: string | null }
interface BurdenResult { payRate: number; totalBurdenPercent: number; regCost: number; otCost: number; dtCost: number; tradeName: string }
interface SellingRate { regSellRate: number; otSellRate: number; dtSellRate: number; grossMarginPct: number; marginHealth: 'RED' | 'YELLOW' | 'GREEN' }
interface PresetRate extends SellingRate { presetId: string; marginPct: number; otMultiplier: number; label: string | null }
interface SellingResponse { presets: PresetRate[]; customMargin: SellingRate | null; customProfit: SellingRate | null }

interface Props { exhibitAId: string; customerId?: string; onBack: () => void; onChanged?: () => void }

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const;

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: '#d97706', bg: '#fffbeb' },
  APPROVED: { color: '#16a34a', bg: '#f0fdf4' },
  EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
  SUPERSEDED: { color: '#6b7280', bg: '#f3f4f6' },
};

const HEALTH_COLORS: Record<string, { color: string; bg: string }> = {
  GREEN: { color: '#16a34a', bg: '#dcfce7' },
  YELLOW: { color: '#d97706', bg: '#fef3c7' },
  RED: { color: '#dc2626', bg: '#fee2e2' },
};

const PAYMENT_TERMS_OPTIONS = [
  { value: 'NET_10', label: 'Net 10' },
  { value: 'NET_15', label: 'Net 15' },
  { value: 'NET_30', label: 'Net 30' },
  { value: 'NET_45', label: 'Net 45' },
  { value: 'NET_60', label: 'Net 60' },
] as const;

const INVOICE_CADENCE_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
] as const;

const PER_DIEM_CADENCE_OPTIONS = [
  { value: 'DAYS_WORKED', label: 'Days Worked' },
  { value: 'SEVEN_DAYS_PER_WEEK', label: 'Seven Days Per Week' },
] as const;

const LODGING_OPTIONS = [
  { value: 'EMPLOYEE_RESPONSIBLE', label: 'Employee Responsible' },
  { value: 'CUSTOMER_PROVIDED', label: 'Customer Provided' },
  { value: 'MW4H_PROVIDED', label: 'MW4H Provided' },
] as const;

const PPE_RESPONSIBILITY_OPTIONS = [
  { value: 'MW4H_STANDARD', label: 'MW4H Standard PPE' },
  { value: 'CUSTOMER_REQUIRED', label: 'Customer Required PPE List' },
  { value: 'CUSTOMER_PROVIDED', label: 'Customer Provided PPE' },
] as const;

const TOOL_RESPONSIBILITY_OPTIONS = [
  { value: 'MW4H_STANDARD', label: 'MW4H Standard Tool List' },
  { value: 'CUSTOMER_REQUIRED', label: 'Customer Required Tool List' },
  { value: 'CUSTOMER_PROVIDED', label: 'Customer Provided Tools' },
] as const;

const TRAVEL_TERMS_OPTIONS = [
  { value: 'NO_TRAVEL_PAY', label: 'No Travel Pay' },
  { value: 'CUSTOMER_PROVIDED_TRAVEL_PAY', label: 'Customer Provided Travel Pay' },
  { value: 'MW4H_PROVIDED_TRAVEL_PAY', label: 'MW4H Provided Travel Pay' },
  { value: 'SEE_TRAVEL_NOTES', label: 'See Travel Notes' },
] as const;

const DROPDOWN_LABEL_MAP: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_TERMS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(INVOICE_CADENCE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(PER_DIEM_CADENCE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(LODGING_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(PPE_RESPONSIBILITY_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(TOOL_RESPONSIBILITY_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(TRAVEL_TERMS_OPTIONS.map(o => [o.value, o.label])),
};

export default function ExhibitADetail({ exhibitAId, customerId, onBack, onChanged }: Props) {
  const [ea, setEa] = useState<ExhibitA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showImportRs, setShowImportRs] = useState(false);

  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [approvalMethod, setApprovalMethod] = useState('');
  const [approvalNote, setApprovalNote] = useState('');

  const [rateSheets, setRateSheets] = useState<RateSheetSummary[]>([]);
  const [rsLoading, setRsLoading] = useState(false);
  const [selectedRsId, setSelectedRsId] = useState('');

  // Governed source data
  const [trades, setTrades] = useState<Trade[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  // Calculator-driven line builder state
  const [calcTradeId, setCalcTradeId] = useState('');
  const [calcState, setCalcState] = useState('');
  const [calcCostType, setCalcCostType] = useState<'standard' | 'ocip' | 'prevailing' | 'prevailing-ocip'>('standard');
  const [calcPayRate, setCalcPayRate] = useState('');
  const [calcBaseWage, setCalcBaseWage] = useState('');
  const [calcFringe, setCalcFringe] = useState('');
  const [calcPerDiem, setCalcPerDiem] = useState('');
  const [calcNotes, setCalcNotes] = useState('');
  const [burdenResult, setBurdenResult] = useState<BurdenResult | null>(null);
  const [burdenLoading, setBurdenLoading] = useState(false);
  const [burdenError, setBurdenError] = useState('');
  const [sellingResult, setSellingResult] = useState<SellingResponse | null>(null);
  const [sellingLoading, setSellingLoading] = useState(false);
  const [sellingTab, setSellingTab] = useState<'presets' | 'custom-margin' | 'profit-hr'>('presets');
  const [cmMarginPct, setCmMarginPct] = useState('');
  const [cmOtMult, setCmOtMult] = useState('1.5');
  const [cpProfitHr, setCpProfitHr] = useState('');
  const [cpOtMult, setCpOtMult] = useState('1.5');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const loadEa = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch<ExhibitA>(`/commercial/exhibit-as/${exhibitAId}`);
      setEa(data);
    } catch (e: any) { setError(e?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }, [exhibitAId]);

  useEffect(() => { loadEa(); }, [loadEa]);

  // Load trades on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Trade[]>('/trades?activeOnly=true');
        setTrades(data);
      } catch { /* ignore */ }
    })();
  }, []);

  // Load contacts when customerId available
  useEffect(() => {
    const cid = customerId || ea?.customer?.id;
    if (!cid) return;
    (async () => {
      try {
        const data = await apiFetch<ContactOption[]>(`/customer-contacts/customer/${cid}`);
        setContacts(data.filter(c => (c as any).isActive !== false));
      } catch { /* ignore */ }
    })();
  }, [customerId, ea?.customer?.id]);

  const isDraft = ea?.status === 'DRAFT';
  const isApproved = ea?.status === 'APPROVED';

  const doAction = async (action: string, body?: object) => {
    setActionLoading(true); setActionError('');
    try {
      await apiFetch(`/commercial/exhibit-as/${exhibitAId}/${action}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      await loadEa(); onChanged?.();
    } catch (e: any) { setActionError(e?.message ?? `Failed to ${action}`); }
    finally { setActionLoading(false); }
  };

  /* ───── Edit meta ───── */
  const openEdit = () => {
    if (!ea) return;
    const f: Record<string, string> = {};
    const keys = ['title','projectName','siteName','siteAddress','notes','customerContactName','customerContactEmail','customerContactPhone',
      'invoicingTerms','paymentTerms','overtimeRules','perDiemRules','travelAssumptions','ppeAssumptions','safetyRequirements',
      'prevailingWageNotes','shiftDifferentialNotes','reportingRequirements','specialConditions',
      'paymentTermsPolicy','invoiceCadencePolicy','perDiemCadence','lodgingResponsibility','ppeResponsibility','toolResponsibility','travelTermsPolicy'];
    for (const k of keys) f[k] = (ea as any)[k] ?? '';
    f.expiresAt = ea.expiresAt ? ea.expiresAt.slice(0, 10) : '';
    f.effectiveDate = ea.effectiveDate ? ea.effectiveDate.slice(0, 10) : '';
    f.customerContactId = ea.customerContactId ?? '';
    setEditForm(f);
    setShowEditMeta(true);
  };

  const handleContactSelect = (contactId: string) => {
    const c = contacts.find(x => x.id === contactId);
    if (c) {
      setEditForm(prev => ({
        ...prev,
        customerContactId: c.id,
        customerContactName: `${c.firstName} ${c.lastName}`.trim(),
        customerContactPhone: c.officePhone || c.cellPhone || '',
        customerContactEmail: c.email || '',
      }));
    } else {
      setEditForm(prev => ({ ...prev, customerContactId: '' }));
    }
  };

  const handleSaveMeta = async () => {
    setActionLoading(true); setActionError('');
    try {
      const body: Record<string, any> = {};
      const stringFields = ['title','projectName','siteName','siteAddress','notes','customerContactName','customerContactEmail','customerContactPhone',
        'invoicingTerms','paymentTerms','overtimeRules','perDiemRules','travelAssumptions','ppeAssumptions','safetyRequirements',
        'prevailingWageNotes','shiftDifferentialNotes','reportingRequirements','specialConditions',
        'paymentTermsPolicy','invoiceCadencePolicy','perDiemCadence','lodgingResponsibility','ppeResponsibility','toolResponsibility','travelTermsPolicy'];
      for (const f of stringFields) {
        const cur = (ea as any)?.[f] ?? '';
        if (editForm[f] !== cur) body[f] = editForm[f] || null;
      }
      if (editForm.expiresAt) body.expiresAt = new Date(editForm.expiresAt).toISOString();
      if (editForm.effectiveDate) body.effectiveDate = new Date(editForm.effectiveDate).toISOString();
      else if (ea?.effectiveDate && !editForm.effectiveDate) body.effectiveDate = null;
      if (editForm.customerContactId !== (ea?.customerContactId ?? '')) body.customerContactId = editForm.customerContactId || null;
      await apiFetch(`/commercial/exhibit-as/${exhibitAId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setShowEditMeta(false); await loadEa(); onChanged?.();
    } catch (e: any) { setActionError(e?.message ?? 'Failed to update'); }
    finally { setActionLoading(false); }
  };

  /* ───── Calculator-driven line builder ───── */
  const resetCalc = () => {
    setEditingLineId(null);
    setCalcTradeId(''); setCalcState(''); setCalcCostType('standard'); setCalcPayRate(''); setCalcBaseWage(''); setCalcFringe('');
    setCalcPerDiem(''); setCalcNotes('');
    setBurdenResult(null); setSellingResult(null); setBurdenError('');
    setSelectedPresetId(''); setCmMarginPct(''); setCpProfitHr('');
    setSellingTab('presets');
  };

  const openEditLine = (line: ExhibitALine) => {
    resetCalc();
    setEditingLineId(line.id);
    const ct = (line.costType as any) || 'standard';
    setCalcCostType(ct);
    const trade = trades.find(t => t.name === line.tradeName || t.id === (line as any).tradeId);
    setCalcTradeId(trade?.id ?? '');
    setCalcState(line.state ?? '');
    const pwMode = ct === 'prevailing' || ct === 'prevailing-ocip';
    if (pwMode) {
      setCalcBaseWage(line.baseWage != null ? String(line.baseWage) : '');
      setCalcFringe(line.fringeAmount != null ? String(line.fringeAmount) : '');
    } else {
      setCalcPayRate(line.basePayRate != null ? String(line.basePayRate) : '');
    }
    setCalcPerDiem(line.perDiem != null ? String(line.perDiem) : '');
    setCalcNotes(line.notes ?? '');
    setShowAddLine(true);
  };

  const isPw = calcCostType === 'prevailing' || calcCostType === 'prevailing-ocip';
  const canCalcBurden = calcTradeId && calcState && (isPw ? parseFloat(calcBaseWage) > 0 : parseFloat(calcPayRate) > 0);

  const handleCalcBurden = async () => {
    if (!canCalcBurden) return;
    setBurdenLoading(true); setBurdenError(''); setSellingResult(null); setSelectedPresetId('');
    try {
      const body: Record<string, unknown> = { stateCode: calcState, tradeId: calcTradeId };
      if (isPw) {
        body.baseWage = parseFloat(calcBaseWage);
        body.fringeAmount = parseFloat(calcFringe) || 0;
      } else {
        body.payRate = parseFloat(calcPayRate);
      }
      if (calcCostType === 'ocip' || calcCostType === 'prevailing-ocip') {
        body.isOsep = true;
      }
      const res = await apiFetch<BurdenResult>('/friday/calculator/burden-preview', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setBurdenResult(res);
      // Auto-compute selling presets
      setSellingLoading(true);
      try {
        const sell = await apiFetch<SellingResponse>('/friday/calculator/selling-compute', {
          method: 'POST',
          body: JSON.stringify({ regCost: res.regCost, otCost: res.otCost, dtCost: res.dtCost }),
        });
        setSellingResult(sell);
      } catch { /* ignore */ }
      setSellingLoading(false);
    } catch (e: any) { setBurdenError(e?.message ?? 'Burden calculation failed'); }
    finally { setBurdenLoading(false); }
  };

  const handleCustomSelling = async () => {
    if (!burdenResult) return;
    setSellingLoading(true);
    try {
      const body: Record<string, any> = { regCost: burdenResult.regCost, otCost: burdenResult.otCost, dtCost: burdenResult.dtCost };
      if (sellingTab === 'custom-margin' && cmMarginPct) {
        body.customMarginPct = parseFloat(cmMarginPct);
        body.customOtMultiplier = parseFloat(cmOtMult) || 1.5;
      }
      if (sellingTab === 'profit-hr' && cpProfitHr) {
        body.customProfitPerHour = parseFloat(cpProfitHr);
        body.customOtMultiplier = parseFloat(cpOtMult) || 1.5;
      }
      const sell = await apiFetch<SellingResponse>('/friday/calculator/selling-compute', {
        method: 'POST', body: JSON.stringify(body),
      });
      setSellingResult(sell);
    } catch { /* ignore */ }
    setSellingLoading(false);
  };

  const getSelectedSelling = (): SellingRate | null => {
    if (!sellingResult) return null;
    if (sellingTab === 'presets') return sellingResult.presets.find(p => p.presetId === selectedPresetId) ?? null;
    if (sellingTab === 'custom-margin') return sellingResult.customMargin;
    if (sellingTab === 'profit-hr') return sellingResult.customProfit;
    return null;
  };

  const handleAddCalcLine = async () => {
    const selling = getSelectedSelling();
    if (!selling || !burdenResult) return;
    const trade = trades.find(t => t.id === calcTradeId);
    setActionLoading(true); setActionError('');
    try {
      const body: Record<string, any> = {
        tradeId: calcTradeId,
        tradeCode: trade?.name ?? calcTradeId,
        tradeName: trade?.name ?? calcTradeId,
        state: calcState,
        costType: calcCostType,
        basePayRate: burdenResult.payRate,
        baseBillRate: selling.regSellRate,
        otPayRate: burdenResult.otCost,
        otBillRate: selling.otSellRate,
        dtPayRate: burdenResult.dtCost,
        dtBillRate: selling.dtSellRate,
        burdenPct: burdenResult.totalBurdenPercent,
        markupPct: burdenResult.regCost > 0 ? ((selling.regSellRate - burdenResult.regCost) / burdenResult.regCost * 100) : 0,
      };
      if (isPw) {
        body.baseWage = parseFloat(calcBaseWage);
        body.fringeAmount = parseFloat(calcFringe) || 0;
      }
      if (calcPerDiem) body.perDiem = parseFloat(calcPerDiem);
      if (calcNotes) body.notes = calcNotes;
      if (editingLineId) {
        await apiFetch(`/commercial/exhibit-as/${exhibitAId}/lines/${editingLineId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch(`/commercial/exhibit-as/${exhibitAId}/lines`, { method: 'POST', body: JSON.stringify(body) });
      }
      setShowAddLine(false); resetCalc();
      await loadEa(); onChanged?.();
    } catch (e: any) { setActionError(e?.message ?? `Failed to ${editingLineId ? 'update' : 'add'} line`); }
    finally { setActionLoading(false); }
  };

  /* ───── Other handlers ───── */
  const handleRemoveLine = async (lineId: string) => {
    if (!confirm('Remove this labor category?')) return;
    setActionLoading(true); setActionError('');
    try { await apiFetch(`/commercial/exhibit-as/${exhibitAId}/lines/${lineId}`, { method: 'DELETE' }); await loadEa(); onChanged?.(); }
    catch (e: any) { setActionError(e?.message ?? 'Failed to remove line'); }
    finally { setActionLoading(false); }
  };

  const handleApprove = async () => {
    if (!approvalMethod.trim()) return;
    await doAction('approve', { approvalMethod: approvalMethod.trim(), approvalNote: approvalNote.trim() || undefined });
    setShowApproval(false); setApprovalMethod(''); setApprovalNote('');
  };

  const openImportRs = async () => {
    const cid = customerId || ea?.customer?.id;
    if (!cid) return;
    setRsLoading(true); setShowImportRs(true);
    try { const data = await apiFetch<RateSheetSummary[]>(`/commercial/customers/${cid}/rate-sheets`); setRateSheets(data.filter(rs => rs.status === 'DRAFT' || rs.status === 'ACTIVE')); } catch { /* ignore */ }
    setRsLoading(false);
  };

  const handleImportRs = async () => {
    if (!selectedRsId) return;
    setActionLoading(true); setActionError('');
    try {
      await apiFetch(`/commercial/exhibit-as/${exhibitAId}/import-rate-sheet-lines`, { method: 'POST', body: JSON.stringify({ rateSheetId: selectedRsId }) });
      setShowImportRs(false); setSelectedRsId(''); await loadEa(); onChanged?.();
    } catch (e: any) { setActionError(e?.message ?? 'Failed to import lines'); }
    finally { setActionLoading(false); }
  };

  const handlePdf = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jp_accessToken') : null;
    if (!token) return;
    try {
      const res = await fetch(`/api/commercial/exhibit-as/${exhibitAId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ea?.exhibitANumber ?? 'exhibit-a'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setActionError(e?.message ?? 'PDF download failed');
    }
  };

  const handleInlineDropdownSave = async (field: string, value: string) => {
    if (!ea || ea.status !== 'DRAFT') return;
    const prev = (ea as any)[field];
    setEa({ ...ea, [field]: value || null } as ExhibitA);
    setActionLoading(true); setActionError('');
    try {
      await apiFetch(`/commercial/exhibit-as/${exhibitAId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value || null }),
      });
      onChanged?.();
    } catch (e: any) {
      setEa({ ...ea, [field]: prev } as ExhibitA);
      setActionError(e?.message ?? 'Failed to update');
    } finally { setActionLoading(false); }
  };

  const [travelNotesLocal, setTravelNotesLocal] = useState(ea?.travelAssumptions ?? '');
  useEffect(() => { setTravelNotesLocal(ea?.travelAssumptions ?? ''); }, [ea?.travelAssumptions]);

  const handleTravelNotesBlur = async () => {
    if (!ea || ea.status !== 'DRAFT') return;
    const trimmed = travelNotesLocal.trim() || null;
    if (trimmed === (ea.travelAssumptions ?? null)) return;
    const prev = ea.travelAssumptions;
    setEa({ ...ea, travelAssumptions: trimmed } as ExhibitA);
    setActionLoading(true); setActionError('');
    try {
      await apiFetch(`/commercial/exhibit-as/${exhibitAId}`, {
        method: 'PATCH',
        body: JSON.stringify({ travelAssumptions: trimmed }),
      });
      onChanged?.();
    } catch (e: any) {
      setEa({ ...ea, travelAssumptions: prev } as ExhibitA);
      setTravelNotesLocal(prev ?? '');
      setActionError(e?.message ?? 'Failed to update');
    } finally { setActionLoading(false); }
  };

  const fmtRate = (v: number | null) => v != null ? `$${Number(v).toFixed(2)}` : '—';
  const fmtPct = (v: number | null) => v != null ? `${Number(v).toFixed(1)}%` : '—';
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const fmtMargin = (line: ExhibitALine): string => {
    const bill = line.baseBillRate != null ? Number(line.baseBillRate) : null;
    const markup = line.markupPct != null ? Number(line.markupPct) : null;
    if (bill == null || bill === 0 || markup == null) return '—';
    const cost = bill / (1 + markup / 100);
    const margin = ((bill - cost) / bill) * 100;
    return `${margin.toFixed(1)}%`;
  };
  const COST_TYPE_LABELS: Record<string, string> = { standard: 'Standard', ocip: 'OCIP', prevailing: 'Prev. Wage', 'prevailing-ocip': 'PW + OCIP' };

  if (loading) return <div style={S.loading}>Loading Exhibit A...</div>;
  if (error) return <div style={S.error}>{error}<br /><button style={S.linkBtn} onClick={onBack}>Back</button></div>;
  if (!ea) return null;

  const statusStyle = STATUS_STYLES[ea.status] ?? STATUS_STYLES.EXPIRED;

  const commercialTerms: [string, string | null][] = [
    ['Invoicing Terms', ea.invoicingTerms], ['Payment Terms', ea.paymentTerms],
    ['Overtime / Double-Time Rules', ea.overtimeRules], ['Per Diem Policy', ea.perDiemRules],
    ['Shift Differential', ea.shiftDifferentialNotes], ['Travel Assumptions', ea.travelAssumptions],
    ['PPE / Tool Provisions', ea.ppeAssumptions], ['Safety Requirements', ea.safetyRequirements],
    ['Reporting Requirements', ea.reportingRequirements], ['Prevailing Wage Notes', ea.prevailingWageNotes],
    ['Special Conditions', ea.specialConditions],
  ];
  const hasAnyTerms = commercialTerms.some(([, v]) => !!v);

  return (
    <div style={{ color: '#111827' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <button style={{ ...S.linkBtn, marginBottom: 10, fontSize: 13 }} onClick={onBack}>← Back to Exhibit As</button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>{ea.exhibitANumber ?? 'Exhibit A'}</h3>
            <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700, color: statusStyle.color, background: statusStyle.bg, letterSpacing: '0.5px' }}>{ea.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(isDraft || isApproved) && <button style={S.btnSecondary} onClick={handlePdf}>Download PDF</button>}
          </div>
        </div>
        {ea.title && <div style={{ fontSize: 15, color: '#374151', marginTop: 4 }}>{ea.title}</div>}
      </div>

      {actionError && <div style={{ ...S.error, marginBottom: 12 }}>{actionError}</div>}

      {/* Agreement Identification */}
      <div style={S.sectionCard}>
        <div style={S.sectionHeaderRow}>
          <h4 style={S.sectionTitle}>Agreement Identification</h4>
          {isDraft && <button style={S.editLink} onClick={openEdit}>Edit Details</button>}
        </div>
        <div style={S.grid2}>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Customer</span><span style={S.fieldValue}>{ea.customer?.name ?? '—'}</span></div>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Exhibit A Number</span><span style={S.fieldValue}>{ea.exhibitANumber ?? '—'}</span></div>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Effective Date</span><span style={S.fieldValue}>{fmtDate(ea.effectiveDate ?? ea.createdAt)}</span></div>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Expiration Date</span><span style={S.fieldValue}>{fmtDate(ea.expiresAt)}</span></div>
          {ea.msa && <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}><span style={S.fieldLabel}>Governing MSA</span><span style={S.fieldValue}>{ea.msa.msaNumber}{ea.msa.title ? ` — ${ea.msa.title}` : ''}</span></div>}
          {ea.approvalMethod && <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}><span style={S.fieldLabel}>Approval</span><span style={S.fieldValue}>{ea.approvalMethod}{ea.approvedAt && ` — Approved ${fmtDate(ea.approvedAt)}`}{ea.approvalNote && ` (${ea.approvalNote})`}</span></div>}
        </div>
      </div>

      {/* Project / Site */}
      <div style={S.sectionCard}>
        <h4 style={S.sectionTitle}>Project / Site Information</h4>
        <div style={S.grid2}>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Project Name</span><span style={S.fieldValue}>{ea.projectName || '—'}</span></div>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Site Name</span><span style={S.fieldValue}>{ea.siteName || '—'}</span></div>
          <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}><span style={S.fieldLabel}>Site Address</span><span style={S.fieldValue}>{ea.siteAddress || '—'}</span></div>
        </div>
      </div>

      {/* Customer Contact */}
      <div style={S.sectionCard}>
        <h4 style={S.sectionTitle}>Customer Contact</h4>
        <div style={S.grid3}>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Contact Name</span><span style={S.fieldValue}>{ea.customerContactName || '—'}</span></div>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Phone</span><span style={S.fieldValue}>{ea.customerContactPhone || '—'}</span></div>
          <div style={S.fieldGroup}><span style={S.fieldLabel}>Email</span><span style={S.fieldValue}>{ea.customerContactEmail || '—'}</span></div>
        </div>
      </div>

      {/* Labor Categories & Billing Rates */}
      <div style={S.sectionCard}>
        <div style={S.sectionHeaderRow}>
          <h4 style={S.sectionTitle}>Labor Categories & Billing Rates ({ea.lines.length})</h4>
          {isDraft && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...S.btnPrimary, fontSize: 12, padding: '5px 12px' }} onClick={() => { resetCalc(); setShowAddLine(true); }}>+ Add Labor Category</button>
              <button style={{ ...S.btnSecondary, fontSize: 12, padding: '5px 12px' }} onClick={openImportRs}>Import from Rate Sheet</button>
            </div>
          )}
        </div>

        {ea.lines.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>
            No labor categories defined. {isDraft ? 'Add lines using the calculator or import from a Rate Sheet.' : ''}
          </div>
        ) : (() => {
            const showBasis = ea.lines.some(l => l.costType && l.costType !== 'standard');
            const headers = ['Trade / Category', 'State', ...(showBasis ? ['Basis'] : []), 'Base Pay', 'Reg Bill', 'OT Bill', 'DT Bill', 'Per Diem', 'Margin%'].concat(isDraft ? [''] : []);
            return (
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>{headers.map(h => {
                    const leftCols = ['Trade / Category', 'State', 'Basis', ''];
                    return <th key={h} style={leftCols.includes(h) ? S.thLeft : S.th}>{h}</th>;
                  })}</tr></thead>
                  <tbody>
                    {ea.lines.map((line) => (
                      <tr key={line.id}>
                        <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>
                          {line.tradeName || line.tradeCode}
                          {line.notes && <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginTop: 1 }}>{line.notes}</div>}
                        </td>
                        <td style={S.td}>{line.state ?? '—'}</td>
                        {showBasis && <td style={S.tdCenter}>{COST_TYPE_LABELS[line.costType ?? 'standard'] ?? 'Standard'}</td>}
                        <td style={S.tdNum}>
                          {(line.costType === 'prevailing' || line.costType === 'prevailing-ocip') && line.baseWage != null
                            ? <><span>{fmtRate(line.baseWage)}</span><span style={{ fontSize: 10, color: '#6b7280' }}>{` +${fmtRate(line.fringeAmount ?? 0)}`}</span></>
                            : fmtRate(line.basePayRate)}
                        </td>
                        <td style={S.tdNum}>{fmtRate(line.baseBillRate)}</td>
                        <td style={S.tdNum}>{fmtRate(line.otBillRate)}</td>
                        <td style={S.tdNum}>{fmtRate(line.dtBillRate)}</td>
                        <td style={S.tdNum}>{fmtRate(line.perDiem)}</td>
                        <td style={S.tdNum}>{fmtMargin(line)}</td>
                        {isDraft && (
                          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                            <button style={{ ...S.linkBtn, fontSize: 12, marginRight: 8 }} disabled={actionLoading} onClick={() => openEditLine(line)}>Edit</button>
                            <button style={{ ...S.linkBtn, color: '#dc2626', fontSize: 12 }} disabled={actionLoading} onClick={() => handleRemoveLine(line.id)}>Remove</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
      </div>

      {/* 5. COMMERCIAL TERMS & CONDITIONS */}
      <div style={S.sectionCard}>
        <h4 style={S.sectionTitle}>Commercial Terms & Conditions</h4>

        {/* 5A. MW4H Responsibilities */}
        <div style={S.subsectionBlock}>
          <div style={S.subsectionTitle}>MW4H Responsibilities</div>
          <p style={S.proseText}>
            MW4H shall be responsible for employee wages, payroll processing and handling, state unemployment insurance (SUI), federal unemployment insurance (FUTA), Social Security and Medicare employer obligations, and workers&apos; compensation coverage
            {ea.lines.some(l => l.costType === 'ocip' || l.costType === 'prevailing-ocip')
              ? ' (except where Owner-Controlled Insurance Program applies)'
              : ''}
            .
          </p>
        </div>

        {/* 5B. Customer Responsibilities */}
        <div style={S.subsectionBlock}>
          <div style={S.subsectionTitle}>Customer Responsibilities</div>
          <div style={S.proseText}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {ea.safetyRequirements && <li>Site-specific safety requirements and instructions as provided by Customer.</li>}
              {!ea.safetyRequirements && <li>Customer shall communicate any site-specific safety requirements prior to work commencement.</li>}
              <li>Weekly toolbox safety meetings where applicable.</li>
              {ea.reportingRequirements
                ? <li>Time reporting and approval per Customer requirements.</li>
                : <li>Timely review and approval of submitted time reports.</li>}
              {ea.ppeResponsibility === 'CUSTOMER_REQUIRED' && <li>Customer shall provide required PPE list prior to mobilization.</li>}
              {ea.ppeResponsibility === 'CUSTOMER_PROVIDED' && <li>Customer shall furnish all required PPE to MW4H personnel on-site.</li>}
              {ea.toolResponsibility === 'CUSTOMER_REQUIRED' && <li>Customer shall provide required tool list prior to mobilization.</li>}
              {ea.toolResponsibility === 'CUSTOMER_PROVIDED' && <li>Customer shall furnish all required tools and equipment to MW4H personnel on-site.</li>}
            </ul>
          </div>
        </div>

        {/* 5C. Commercial Term Controls */}
        <div style={S.subsectionBlock}>
          <div style={S.subsectionTitle}>Commercial Terms</div>
          {isDraft ? (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 20px' }}>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Payment Terms</span>
                <select style={S.inlineSelect} value={ea.paymentTermsPolicy ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('paymentTermsPolicy', e.target.value)}>
                  <option value="">— Select —</option>
                  {PAYMENT_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Invoice Cadence</span>
                <select style={S.inlineSelect} value={ea.invoiceCadencePolicy ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('invoiceCadencePolicy', e.target.value)}>
                  <option value="">— Select —</option>
                  {INVOICE_CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Late Fees</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280', fontStyle: 'italic', paddingTop: 6 }}>Per Master Services Agreement</span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Lodging Responsibility</span>
                <select style={S.inlineSelect} value={ea.lodgingResponsibility ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('lodgingResponsibility', e.target.value)}>
                  <option value="">— Select —</option>
                  {LODGING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>PPE Responsibility</span>
                <select style={S.inlineSelect} value={ea.ppeResponsibility ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('ppeResponsibility', e.target.value)}>
                  <option value="">— Select —</option>
                  {PPE_RESPONSIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Tool Responsibility</span>
                <select style={S.inlineSelect} value={ea.toolResponsibility ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('toolResponsibility', e.target.value)}>
                  <option value="">— Select —</option>
                  {TOOL_RESPONSIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Travel Terms</span>
                <select style={S.inlineSelect} value={ea.travelTermsPolicy ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('travelTermsPolicy', e.target.value)}>
                  <option value="">— Select —</option>
                  {TRAVEL_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Per Diem Cadence</span>
                <select style={S.inlineSelect} value={ea.perDiemCadence ?? ''} disabled={actionLoading}
                  onChange={e => handleInlineDropdownSave('perDiemCadence', e.target.value)}>
                  <option value="">— Select —</option>
                  {PER_DIEM_CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {(() => {
                  const perDiems = ea.lines.map(l => l.perDiem != null ? Number(l.perDiem) : null).filter((v): v is number => v !== null);
                  if (perDiems.length === 0) return null;
                  const allSame = perDiems.every(v => v === perDiems[0]);
                  return <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{allSame ? `Line per diem: $${perDiems[0].toFixed(2)}/day` : 'Per diem amounts vary by labor category line.'}</span>;
                })()}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={S.fieldLabel}>Travel Notes</span>
              <textarea style={{ ...S.inlineSelect, minHeight: 48, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px' }}
                value={travelNotesLocal} disabled={actionLoading} placeholder="e.g., mileage reimbursement, mobilization/demob, special travel instructions"
                onChange={e => setTravelNotesLocal(e.target.value)} onBlur={handleTravelNotesBlur} />
            </div>
          </>) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 20px' }}>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Payment Terms</span>
                <span style={S.fieldValue}>
                  {ea.paymentTermsPolicy ? DROPDOWN_LABEL_MAP[ea.paymentTermsPolicy] || ea.paymentTermsPolicy : ea.paymentTerms || '—'}
                </span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Invoice Cadence</span>
                <span style={S.fieldValue}>
                  {ea.invoiceCadencePolicy ? DROPDOWN_LABEL_MAP[ea.invoiceCadencePolicy] || ea.invoiceCadencePolicy : ea.invoicingTerms || '—'}
                </span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Late Fees</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280', fontStyle: 'italic' }}>Per Master Services Agreement</span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Lodging Responsibility</span>
                <span style={S.fieldValue}>{ea.lodgingResponsibility ? DROPDOWN_LABEL_MAP[ea.lodgingResponsibility] || ea.lodgingResponsibility : '—'}</span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>PPE Responsibility</span>
                <span style={S.fieldValue}>{ea.ppeResponsibility ? DROPDOWN_LABEL_MAP[ea.ppeResponsibility] || ea.ppeResponsibility : ea.ppeAssumptions || '—'}</span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Tool Responsibility</span>
                <span style={S.fieldValue}>{ea.toolResponsibility ? DROPDOWN_LABEL_MAP[ea.toolResponsibility] || ea.toolResponsibility : '—'}</span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Travel Terms</span>
                <span style={S.fieldValue}>{ea.travelTermsPolicy ? DROPDOWN_LABEL_MAP[ea.travelTermsPolicy] || ea.travelTermsPolicy : ea.travelAssumptions || '—'}</span>
              </div>
              <div style={S.fieldGroup}>
                <span style={S.fieldLabel}>Per Diem Cadence</span>
                <span style={S.fieldValue}>
                  {ea.perDiemCadence ? DROPDOWN_LABEL_MAP[ea.perDiemCadence] || ea.perDiemCadence : ea.perDiemRules || '—'}
                </span>
                {(() => {
                  const perDiems = ea.lines.map(l => l.perDiem != null ? Number(l.perDiem) : null).filter((v): v is number => v !== null);
                  if (perDiems.length === 0) return null;
                  const allSame = perDiems.every(v => v === perDiems[0]);
                  return <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{allSame ? `Line per diem: $${perDiems[0].toFixed(2)}/day` : 'Per diem amounts vary by labor category line.'}</span>;
                })()}
              </div>
            </div>
            {ea.travelAssumptions && (
              <div style={{ marginTop: 10 }}>
                <span style={S.fieldLabel}>Travel Notes</span>
                <span style={{ ...S.fieldValue, whiteSpace: 'pre-wrap' }}>{ea.travelAssumptions}</span>
              </div>
            )}
          </>)}
        </div>

        {/* 5D. Additional / Legacy Notes */}
        {(() => {
          const legacyNotes: [string, string | null][] = [
            ['Overtime / Double-Time Rules', ea.overtimeRules],
          ];
          const filled = legacyNotes.filter(([, v]) => !!v);
          if (filled.length === 0) return null;
          return (
            <div style={{ ...S.subsectionBlock, background: '#fff', borderStyle: 'dashed' }}>
              <div style={{ ...S.subsectionTitle, color: '#6b7280' }}>Additional / Legacy Notes</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                {filled.map(([label, value]) => (
                  <div key={label} style={S.fieldGroup}>
                    <span style={S.fieldLabel}>{label}</span>
                    <span style={{ ...S.fieldValue, whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151', fontWeight: 400 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 5E. Special Conditions / Additional Notes */}
        {(ea.specialConditions || ea.notes) && (
          <div style={S.subsectionBlock}>
            <div style={S.subsectionTitle}>Special Conditions / Additional Notes</div>
            {ea.specialConditions && <p style={S.proseText}>{ea.specialConditions}</p>}
            {ea.notes && <p style={{ ...S.proseText, marginTop: ea.specialConditions ? 8 : 0 }}>{ea.notes}</p>}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {isDraft && (
          <button style={{ ...S.btnPrimary, background: '#16a34a', opacity: (actionLoading || ea.lines.length === 0) ? 0.5 : 1 }}
            disabled={actionLoading || ea.lines.length === 0} onClick={() => setShowApproval(true)}>Record Customer Approval</button>
        )}
        {isApproved && (
          <>
            <button style={{ ...S.btnDanger, opacity: actionLoading ? 0.5 : 1 }} disabled={actionLoading} onClick={() => doAction('expire')}>Expire</button>
            <button style={{ ...S.btnSecondary, opacity: actionLoading ? 0.5 : 1 }} disabled={actionLoading} onClick={() => doAction('supersede')}>Supersede</button>
          </>
        )}
      </div>

      {/* ═══════ MODALS ═══════ */}

      {/* Approval Modal */}
      {showApproval && (
        <div style={S.overlay} onClick={() => setShowApproval(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><h3 style={S.modalTitle}>Record Customer Approval</h3><button style={S.modalClose} onClick={() => setShowApproval(false)}>×</button></div>
            <div style={S.modalBody}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>Record how the customer approved this Exhibit A. Internal record only.</p>
              <div style={S.formRow}><label style={S.formLabel}>Approval Method *</label><input style={S.formInput} value={approvalMethod} onChange={e => setApprovalMethod(e.target.value)} placeholder="e.g., Verbal, Email, Signed PDF" /></div>
              <div style={S.formRow}><label style={S.formLabel}>Approval Note</label><textarea style={S.formTextarea} rows={2} value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="Optional context" /></div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowApproval(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, background: '#16a34a', opacity: (!approvalMethod.trim() || actionLoading) ? 0.5 : 1 }} disabled={!approvalMethod.trim() || actionLoading} onClick={handleApprove}>{actionLoading ? 'Recording...' : 'Record Approval'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Rate Sheet Modal */}
      {showImportRs && (
        <div style={S.overlay} onClick={() => setShowImportRs(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><h3 style={S.modalTitle}>Import Lines from Rate Sheet</h3><button style={S.modalClose} onClick={() => setShowImportRs(false)}>×</button></div>
            <div style={S.modalBody}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>Select a Rate Sheet to import its line items. Lines will be copied — the Rate Sheet remains unchanged.</p>
              {rsLoading ? <div style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>Loading...</div>
                : rateSheets.length === 0 ? <div style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>No Rate Sheets available.</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rateSheets.map(rs => (
                      <label key={rs.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: selectedRsId === rs.id ? '2px solid #2563eb' : '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: selectedRsId === rs.id ? '#eff6ff' : '#fff' }}>
                        <input type="radio" name="rsImport" value={rs.id} checked={selectedRsId === rs.id} onChange={() => setSelectedRsId(rs.id)} />
                        <div><div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{rs.rateSheetNumber ?? rs.id.slice(0, 8)}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{rs.title || 'Untitled'} · {rs.status} · {rs._count?.lines ?? '?'} lines</div></div>
                      </label>
                    ))}
                  </div>}
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowImportRs(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: (!selectedRsId || actionLoading) ? 0.5 : 1 }} disabled={!selectedRsId || actionLoading} onClick={handleImportRs}>{actionLoading ? 'Importing...' : 'Import Lines'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CALCULATOR-DRIVEN ADD LABOR CATEGORY MODAL ═══════ */}
      {showAddLine && (
        <div style={S.overlay} onClick={() => setShowAddLine(false)}>
          <div style={{ ...S.modal, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><h3 style={S.modalTitle}>{editingLineId ? 'Edit Labor Category — Calculator-Driven Pricing' : 'Add Labor Category — Calculator-Driven Pricing'}</h3><button style={S.modalClose} onClick={() => setShowAddLine(false)}>×</button></div>
            <div style={{ ...S.modalBody, maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Step 1: Trade + State + Cost Type + Wage Inputs */}
              <div style={S.editSectionLabel}>1. Select Trade, State & Cost Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Trade *</label>
                  <select style={S.formInput} value={calcTradeId} onChange={e => { setCalcTradeId(e.target.value); setBurdenResult(null); setSellingResult(null); }}>
                    <option value="">Select trade...</option>
                    {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>State *</label>
                  <select style={S.formInput} value={calcState} onChange={e => { setCalcState(e.target.value); setBurdenResult(null); setSellingResult(null); }}>
                    <option value="">Select state...</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Cost Type Selector */}
              <div style={{ marginTop: 10 }}>
                <label style={S.formLabel}>Cost Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
                  {([
                    { val: 'standard', label: 'Standard' },
                    { val: 'ocip', label: 'OCIP' },
                    { val: 'prevailing', label: 'Prevailing Wage' },
                    { val: 'prevailing-ocip', label: 'PW + OCIP' },
                  ] as const).map(ct => (
                    <button key={ct.val} type="button" onClick={() => { setCalcCostType(ct.val); setBurdenResult(null); setSellingResult(null); }}
                      style={{
                        padding: '8px 6px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        border: calcCostType === ct.val ? '2px solid #2563eb' : '1px solid #d1d5db',
                        background: calcCostType === ct.val ? '#eff6ff' : '#fff',
                        color: calcCostType === ct.val ? '#1d4ed8' : '#374151',
                      }}>
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wage Inputs - conditional on cost type */}
              <div style={{ display: 'grid', gridTemplateColumns: isPw ? '1fr 1fr' : '1fr', gap: 12, marginTop: 10 }}>
                {isPw ? (
                  <>
                    <div style={S.formRow}>
                      <label style={S.formLabel}>Base Wage ($/hr) *</label>
                      <input style={S.formInput} type="number" step="0.01" min="0" value={calcBaseWage} onChange={e => { setCalcBaseWage(e.target.value); setBurdenResult(null); setSellingResult(null); }} placeholder="0.00" />
                    </div>
                    <div style={S.formRow}>
                      <label style={S.formLabel}>Fringe Amount ($/hr)</label>
                      <input style={S.formInput} type="number" step="0.01" min="0" value={calcFringe} onChange={e => { setCalcFringe(e.target.value); setBurdenResult(null); setSellingResult(null); }} placeholder="0.00" />
                    </div>
                  </>
                ) : (
                  <div style={S.formRow}>
                    <label style={S.formLabel}>Pay Rate ($/hr) *</label>
                    <input style={S.formInput} type="number" step="0.01" min="0" value={calcPayRate} onChange={e => { setCalcPayRate(e.target.value); setBurdenResult(null); setSellingResult(null); }} placeholder="0.00" />
                  </div>
                )}
              </div>
              <button
                style={{ ...S.btnPrimary, marginTop: 8, opacity: canCalcBurden && !burdenLoading ? 1 : 0.5 }}
                disabled={!canCalcBurden || burdenLoading}
                onClick={handleCalcBurden}>
                {burdenLoading ? 'Computing...' : 'Calculate Burden & Costs'}
              </button>
              {burdenError && <div style={{ ...S.error, marginTop: 8 }}>{burdenError}</div>}

              {/* Step 2: Burden Results */}
              {burdenResult && (
                <>
                  <div style={{ ...S.editSectionLabel, marginTop: 16 }}>2. Burden & Cost Results <span style={{ fontWeight: 400, color: '#6b7280', textTransform: 'none' as const }}>({COST_TYPE_LABELS[calcCostType] ?? 'Standard'})</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    <div style={S.calcCard}><span style={S.calcCardLabel}>Total Burden</span><span style={S.calcCardValue}>{burdenResult.totalBurdenPercent.toFixed(1)}%</span></div>
                    <div style={S.calcCard}><span style={S.calcCardLabel}>REG Cost</span><span style={S.calcCardValue}>${burdenResult.regCost.toFixed(2)}</span></div>
                    <div style={S.calcCard}><span style={S.calcCardLabel}>OT Cost</span><span style={S.calcCardValue}>${burdenResult.otCost.toFixed(2)}</span></div>
                    <div style={S.calcCard}><span style={S.calcCardLabel}>DT Cost</span><span style={S.calcCardValue}>${burdenResult.dtCost.toFixed(2)}</span></div>
                  </div>

                  {/* Step 3: Selling Model */}
                  <div style={{ ...S.editSectionLabel, marginTop: 16 }}>3. Select Selling Model</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {(['presets', 'custom-margin', 'profit-hr'] as const).map(tab => (
                      <button key={tab} onClick={() => setSellingTab(tab)} style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none',
                        background: sellingTab === tab ? '#2563eb' : '#f3f4f6', color: sellingTab === tab ? '#fff' : '#374151',
                      }}>
                        {tab === 'presets' ? 'Presets' : tab === 'custom-margin' ? 'Custom Margin' : 'Profit $/hr'}
                      </button>
                    ))}
                  </div>

                  {/* Presets tab */}
                  {sellingTab === 'presets' && sellingResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {sellingResult.presets.map(p => {
                        const hc = HEALTH_COLORS[p.marginHealth] ?? HEALTH_COLORS.GREEN;
                        return (
                          <label key={p.presetId} style={{
                            display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 80px 70px', alignItems: 'center', gap: 8,
                            padding: '8px 10px', border: selectedPresetId === p.presetId ? '2px solid #2563eb' : '1px solid #e5e7eb',
                            borderRadius: 6, cursor: 'pointer', background: selectedPresetId === p.presetId ? '#eff6ff' : '#fff', fontSize: 13,
                          }}>
                            <input type="radio" name="presetSel" checked={selectedPresetId === p.presetId} onChange={() => setSelectedPresetId(p.presetId)} />
                            <span style={{ fontWeight: 600, color: '#111827' }}>{p.label || `${p.marginPct}% Margin`}</span>
                            <span style={{ textAlign: 'right', color: '#111827' }}>${p.regSellRate.toFixed(2)}</span>
                            <span style={{ textAlign: 'right', color: '#6b7280' }}>${p.otSellRate.toFixed(2)}</span>
                            <span style={{ textAlign: 'right', color: '#6b7280' }}>${p.dtSellRate.toFixed(2)}</span>
                            <span style={{ textAlign: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: hc.color, background: hc.bg }}>{p.grossMarginPct.toFixed(1)}%</span>
                          </label>
                        );
                      })}
                      {sellingResult.presets.length > 0 && (
                        <div style={{ fontSize: 11, color: '#9ca3af', display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 80px 70px', gap: 8, padding: '2px 10px' }}>
                          <span /><span /><span style={{ textAlign: 'right' }}>REG Bill</span><span style={{ textAlign: 'right' }}>OT Bill</span><span style={{ textAlign: 'right' }}>DT Bill</span><span style={{ textAlign: 'center' }}>Margin</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Margin tab */}
                  {sellingTab === 'custom-margin' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                        <div style={S.formRow}><label style={S.formLabel}>Target Margin %</label><input style={S.formInput} type="number" step="0.1" value={cmMarginPct} onChange={e => setCmMarginPct(e.target.value)} placeholder="e.g., 25" /></div>
                        <div style={S.formRow}><label style={S.formLabel}>OT Multiplier</label><input style={S.formInput} type="number" step="0.1" value={cmOtMult} onChange={e => setCmOtMult(e.target.value)} /></div>
                        <button style={{ ...S.btnPrimary, fontSize: 12, height: 35 }} onClick={handleCustomSelling} disabled={!cmMarginPct || sellingLoading}>Compute</button>
                      </div>
                      {sellingResult?.customMargin && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                          <div style={S.calcCard}><span style={S.calcCardLabel}>REG Bill</span><span style={S.calcCardValue}>${sellingResult.customMargin.regSellRate.toFixed(2)}</span></div>
                          <div style={S.calcCard}><span style={S.calcCardLabel}>OT Bill</span><span style={S.calcCardValue}>${sellingResult.customMargin.otSellRate.toFixed(2)}</span></div>
                          <div style={S.calcCard}><span style={S.calcCardLabel}>DT Bill</span><span style={S.calcCardValue}>${sellingResult.customMargin.dtSellRate.toFixed(2)}</span></div>
                          <div style={{ ...S.calcCard, borderColor: HEALTH_COLORS[sellingResult.customMargin.marginHealth]?.color ?? '#16a34a' }}>
                            <span style={S.calcCardLabel}>Margin</span><span style={{ ...S.calcCardValue, color: HEALTH_COLORS[sellingResult.customMargin.marginHealth]?.color }}>{sellingResult.customMargin.grossMarginPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Profit $/hr tab */}
                  {sellingTab === 'profit-hr' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                        <div style={S.formRow}><label style={S.formLabel}>Profit $/hr</label><input style={S.formInput} type="number" step="0.5" value={cpProfitHr} onChange={e => setCpProfitHr(e.target.value)} placeholder="e.g., 8.00" /></div>
                        <div style={S.formRow}><label style={S.formLabel}>OT Multiplier</label><input style={S.formInput} type="number" step="0.1" value={cpOtMult} onChange={e => setCpOtMult(e.target.value)} /></div>
                        <button style={{ ...S.btnPrimary, fontSize: 12, height: 35 }} onClick={handleCustomSelling} disabled={!cpProfitHr || sellingLoading}>Compute</button>
                      </div>
                      {sellingResult?.customProfit && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                          <div style={S.calcCard}><span style={S.calcCardLabel}>REG Bill</span><span style={S.calcCardValue}>${sellingResult.customProfit.regSellRate.toFixed(2)}</span></div>
                          <div style={S.calcCard}><span style={S.calcCardLabel}>OT Bill</span><span style={S.calcCardValue}>${sellingResult.customProfit.otSellRate.toFixed(2)}</span></div>
                          <div style={S.calcCard}><span style={S.calcCardLabel}>DT Bill</span><span style={S.calcCardValue}>${sellingResult.customProfit.dtSellRate.toFixed(2)}</span></div>
                          <div style={{ ...S.calcCard, borderColor: HEALTH_COLORS[sellingResult.customProfit.marginHealth]?.color ?? '#16a34a' }}>
                            <span style={S.calcCardLabel}>Margin</span><span style={{ ...S.calcCardValue, color: HEALTH_COLORS[sellingResult.customProfit.marginHealth]?.color }}>{sellingResult.customProfit.grossMarginPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {sellingLoading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 8, fontSize: 13 }}>Computing selling rates...</div>}

                  {/* Step 4: Per Diem & Notes */}
                  <div style={{ ...S.editSectionLabel, marginTop: 16 }}>4. Per Diem & Notes</div>
                  <div style={S.formRow2}>
                    <div style={S.formRow}><label style={S.formLabel}>Per Diem ($/day)</label><input style={S.formInput} type="number" step="0.01" value={calcPerDiem} onChange={e => setCalcPerDiem(e.target.value)} placeholder="0.00" /></div>
                    <div style={S.formRow}><label style={S.formLabel}>Notes</label><input style={S.formInput} value={calcNotes} onChange={e => setCalcNotes(e.target.value)} placeholder="Optional line notes" /></div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowAddLine(false)}>Cancel</button>
              <button
                style={{ ...S.btnPrimary, opacity: getSelectedSelling() && !actionLoading ? 1 : 0.5 }}
                disabled={!getSelectedSelling() || actionLoading}
                onClick={handleAddCalcLine}>
                {actionLoading ? 'Saving...' : editingLineId ? 'Save Labor Category' : 'Freeze & Add Labor Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {showEditMeta && (
        <div style={S.overlay} onClick={() => setShowEditMeta(false)}>
          <div style={{ ...S.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><h3 style={S.modalTitle}>Edit Exhibit A Details</h3><button style={S.modalClose} onClick={() => setShowEditMeta(false)}>×</button></div>
            <div style={{ ...S.modalBody, maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={S.editSectionLabel}>Agreement</div>
              <div style={S.formRow}><label style={S.formLabel}>Title / Description</label><input style={S.formInput} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="e.g., Refinery Turnaround Q3 2026" /></div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>Effective Date</label><input style={S.formInput} type="date" value={editForm.effectiveDate} onChange={e => setEditForm({ ...editForm, effectiveDate: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>Expiration Date</label><input style={S.formInput} type="date" value={editForm.expiresAt} onChange={e => setEditForm({ ...editForm, expiresAt: e.target.value })} /></div>
              </div>

              <div style={S.editSectionLabel}>Project / Site</div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>Project Name</label><input style={S.formInput} value={editForm.projectName} onChange={e => setEditForm({ ...editForm, projectName: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>Site Name</label><input style={S.formInput} value={editForm.siteName} onChange={e => setEditForm({ ...editForm, siteName: e.target.value })} /></div>
              </div>
              <div style={S.formRow}><label style={S.formLabel}>Site Address</label><input style={S.formInput} value={editForm.siteAddress} onChange={e => setEditForm({ ...editForm, siteAddress: e.target.value })} placeholder="Full street address" /></div>

              <div style={S.editSectionLabel}>Customer Contact</div>
              {contacts.length > 0 && (
                <div style={S.formRow}>
                  <label style={S.formLabel}>Select from Customer Contacts</label>
                  <select style={S.formInput} value={editForm.customerContactId ?? ''} onChange={e => handleContactSelect(e.target.value)}>
                    <option value="">— Manual entry —</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.jobTitle ? ` (${c.jobTitle})` : ''}</option>)}
                  </select>
                </div>
              )}
              <div style={S.formRow}><label style={S.formLabel}>Contact Name</label><input style={S.formInput} value={editForm.customerContactName} onChange={e => setEditForm({ ...editForm, customerContactName: e.target.value })} placeholder="e.g., John Smith" /></div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>Phone</label><input style={S.formInput} value={editForm.customerContactPhone} onChange={e => setEditForm({ ...editForm, customerContactPhone: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>Email</label><input style={S.formInput} type="email" value={editForm.customerContactEmail} onChange={e => setEditForm({ ...editForm, customerContactEmail: e.target.value })} /></div>
              </div>

              <div style={S.editSectionLabel}>Commercial Terms — Controlled</div>
              <div style={S.formRow2}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Payment Terms</label>
                  <select style={S.formInput} value={editForm.paymentTermsPolicy} onChange={e => setEditForm({ ...editForm, paymentTermsPolicy: e.target.value })}>
                    <option value="">— Select —</option>
                    {PAYMENT_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Invoice Cadence</label>
                  <select style={S.formInput} value={editForm.invoiceCadencePolicy} onChange={e => setEditForm({ ...editForm, invoiceCadencePolicy: e.target.value })}>
                    <option value="">— Select —</option>
                    {INVOICE_CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Per Diem Cadence</label>
                  <select style={S.formInput} value={editForm.perDiemCadence} onChange={e => setEditForm({ ...editForm, perDiemCadence: e.target.value })}>
                    <option value="">— Select —</option>
                    {PER_DIEM_CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Lodging Responsibility</label>
                  <select style={S.formInput} value={editForm.lodgingResponsibility} onChange={e => setEditForm({ ...editForm, lodgingResponsibility: e.target.value })}>
                    <option value="">— Select —</option>
                    {LODGING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>PPE Responsibility</label>
                  <select style={S.formInput} value={editForm.ppeResponsibility} onChange={e => setEditForm({ ...editForm, ppeResponsibility: e.target.value })}>
                    <option value="">— Select —</option>
                    {PPE_RESPONSIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Tool Responsibility</label>
                  <select style={S.formInput} value={editForm.toolResponsibility} onChange={e => setEditForm({ ...editForm, toolResponsibility: e.target.value })}>
                    <option value="">— Select —</option>
                    {TOOL_RESPONSIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Travel Terms</label>
                  <select style={S.formInput} value={editForm.travelTermsPolicy} onChange={e => setEditForm({ ...editForm, travelTermsPolicy: e.target.value })}>
                    <option value="">— Select —</option>
                    {TRAVEL_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ ...S.formRow, justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', paddingTop: 22 }}>Late fees per Master Services Agreement</span>
                </div>
              </div>

              <div style={S.editSectionLabel}>Additional Terms — Freeform</div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>Payment Terms Notes</label><input style={S.formInput} value={editForm.paymentTerms} onChange={e => setEditForm({ ...editForm, paymentTerms: e.target.value })} placeholder="Additional payment details" /></div>
                <div style={S.formRow}><label style={S.formLabel}>Invoicing Notes</label><input style={S.formInput} value={editForm.invoicingTerms} onChange={e => setEditForm({ ...editForm, invoicingTerms: e.target.value })} placeholder="Additional invoicing details" /></div>
              </div>
              <div style={S.formRow}><label style={S.formLabel}>Overtime / Double-Time Rules</label><textarea style={S.formTextarea} rows={2} value={editForm.overtimeRules} onChange={e => setEditForm({ ...editForm, overtimeRules: e.target.value })} placeholder="e.g., OT after 40hrs/week" /></div>
              <div style={S.formRow}><label style={S.formLabel}>Per Diem Notes</label><textarea style={S.formTextarea} rows={2} value={editForm.perDiemRules} onChange={e => setEditForm({ ...editForm, perDiemRules: e.target.value })} placeholder="Additional per diem details" /></div>
              <div style={S.formRow}><label style={S.formLabel}>Shift Differential</label><input style={S.formInput} value={editForm.shiftDifferentialNotes} onChange={e => setEditForm({ ...editForm, shiftDifferentialNotes: e.target.value })} /></div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>Travel Notes</label><input style={S.formInput} value={editForm.travelAssumptions} onChange={e => setEditForm({ ...editForm, travelAssumptions: e.target.value })} placeholder="Additional travel details" /></div>
                <div style={S.formRow}><label style={S.formLabel}>PPE / Tool Notes</label><input style={S.formInput} value={editForm.ppeAssumptions} onChange={e => setEditForm({ ...editForm, ppeAssumptions: e.target.value })} placeholder="Additional PPE/tool details" /></div>
              </div>
              <div style={S.formRow}><label style={S.formLabel}>Safety Requirements</label><textarea style={S.formTextarea} rows={2} value={editForm.safetyRequirements} onChange={e => setEditForm({ ...editForm, safetyRequirements: e.target.value })} /></div>
              <div style={S.formRow}><label style={S.formLabel}>Reporting Requirements</label><input style={S.formInput} value={editForm.reportingRequirements} onChange={e => setEditForm({ ...editForm, reportingRequirements: e.target.value })} /></div>
              <div style={S.formRow}><label style={S.formLabel}>Prevailing Wage Notes</label><input style={S.formInput} value={editForm.prevailingWageNotes} onChange={e => setEditForm({ ...editForm, prevailingWageNotes: e.target.value })} /></div>
              <div style={S.formRow}><label style={S.formLabel}>Special Conditions</label><textarea style={S.formTextarea} rows={3} value={editForm.specialConditions} onChange={e => setEditForm({ ...editForm, specialConditions: e.target.value })} /></div>

              <div style={S.editSectionLabel}>Additional Notes</div>
              <div style={S.formRow}><label style={S.formLabel}>Notes</label><textarea style={S.formTextarea} rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowEditMeta(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: actionLoading ? 0.5 : 1 }} disabled={actionLoading} onClick={handleSaveMeta}>{actionLoading ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Styles ───── */
const S = {
  loading: { padding: '24px 0', textAlign: 'center' as const, color: '#6b7280', fontSize: 14 },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  sectionCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 14 } as React.CSSProperties,
  sectionHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } as React.CSSProperties,
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  editLink: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 } as React.CSSProperties,
  grid2: { display: 'grid' as const, gridTemplateColumns: '1fr 1fr', gap: '8px 24px' },
  grid3: { display: 'grid' as const, gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 20px' },
  fieldGroup: { display: 'flex' as const, flexDirection: 'column' as const, gap: 2 },
  fieldLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280' } as React.CSSProperties,
  fieldValue: { fontSize: 14, color: '#111827', fontWeight: 500 } as React.CSSProperties,
  th: { padding: '10px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', textAlign: 'right' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  thLeft: { padding: '10px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', textAlign: 'left' as const } as React.CSSProperties,
  td: { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 13 },
  tdCenter: { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600, textAlign: 'center' as const } as React.CSSProperties,
  tdNum: { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#111827', fontSize: 13, fontVariantNumeric: 'tabular-nums' as const, textAlign: 'right' as const },
  btnPrimary: { padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnSecondary: { padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnDanger: { padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } as React.CSSProperties,
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' } as React.CSSProperties,
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' } as React.CSSProperties,
  modalBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb' } as React.CSSProperties,
  formRow: { display: 'flex' as const, flexDirection: 'column' as const, gap: 4 },
  formRow2: { display: 'grid' as const, gridTemplateColumns: '1fr 1fr', gap: 12 },
  formLabel: { fontSize: 12, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  formInput: { padding: '7px 10px', fontSize: 13, color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' } as React.CSSProperties,
  formTextarea: { padding: '7px 10px', fontSize: 13, color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit' } as React.CSSProperties,
  editSectionLabel: { fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '0.8px', borderBottom: '1px solid #dbeafe', paddingBottom: 4, marginTop: 8 } as React.CSSProperties,
  calcCard: { background: '#f0f4fa', border: '1px solid #dbeafe', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 } as React.CSSProperties,
  calcCardLabel: { fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  calcCardValue: { fontSize: 16, fontWeight: 700, color: '#111827' } as React.CSSProperties,
  inlineSelect: { padding: '5px 8px', fontSize: 13, color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', fontWeight: 500, cursor: 'pointer', maxWidth: '100%' } as React.CSSProperties,
  subsectionBlock: { marginTop: 14, padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 } as React.CSSProperties,
  subsectionTitle: { fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 } as React.CSSProperties,
  proseText: { margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 } as React.CSSProperties,
};
