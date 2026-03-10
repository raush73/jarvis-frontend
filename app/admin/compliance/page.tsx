"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ComplianceVariant = {
  id: string;
  requirementTypeId: string;
  name: string;
  description: string;
  sortOrder: number | null;
  isActive: boolean;
};

type ComplianceRequirementType = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  requiresExpiration: boolean;
  isActive: boolean;
  sortOrder: number | null;
  variants: ComplianceVariant[];
};

type ComplianceCategory = {
  id: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean;
  requirementTypes: ComplianceRequirementType[];
};

type ApiCategory = {
  id: string;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean;
};

type ApiRequirementType = {
  id: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  requiresExpiration?: boolean;
  isActive?: boolean;
  sortOrder?: number | null;
};

type ApiVariant = {
  id: string;
  requirementTypeId?: string | null;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
};

type CategoryFormState = {
  id?: string;
  name: string;
  sortOrder: string;
  isActive: boolean;
};

type ReqTypeFormState = {
  id?: string;
  name: string;
  categoryId: string;
  description: string;
  requiresExpiration: boolean;
  sortOrder: string;
  isActive: boolean;
};

type VariantFormState = {
  id?: string;
  name: string;
  requirementTypeId: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

type WizardStep = 1 | 2 | 3;

// ─── Constants ────────────────────────────────────────────────────────────────

const GOVERNANCE_CATEGORY_ORDER = [
  "Drug Testing",
  "Background Checks",
  "Site Badging",
  "Medical Clearance",
  "Safety Orientation",
  "Security Screening",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusStyle(isActive: boolean) {
  if (isActive) {
    return {
      bg: "rgba(34, 197, 94, 0.12)",
      color: "#22c55e",
      border: "rgba(34, 197, 94, 0.25)",
    };
  }
  return {
    bg: "rgba(107, 114, 128, 0.12)",
    color: "#6b7280",
    border: "rgba(107, 114, 128, 0.25)",
  };
}

function looksLikeVariant(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (/^\d/.test(n)) return true;
  if (/\bpanel\b/.test(n)) return true;
  const keywords = [
    "follicle",
    "disa",
    "criminal",
    "federal",
    "observed",
    "hair test",
    "blood test",
    "urine",
    "breathalyzer",
    "expanded",
    "standard criminal",
    "national criminal",
  ];
  return keywords.some((kw) => n.includes(kw));
}

function mapComplianceCatalog(
  rawCategories: ApiCategory[],
  rawReqTypes: ApiRequirementType[],
  rawVariants: ApiVariant[],
): ComplianceCategory[] {
  const byId = new Map<string, ComplianceCategory>();

  for (const c of rawCategories) {
    byId.set(c.id, {
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder ?? null,
      isActive: c.isActive !== false,
      requirementTypes: [],
    });
  }

  for (const name of GOVERNANCE_CATEGORY_ORDER) {
    const exists = [...byId.values()].some((c) => c.name === name);
    if (!exists) {
      const key = `governance-${name.toLowerCase().replace(/\s+/g, "-")}`;
      byId.set(key, {
        id: key,
        name,
        sortOrder: null,
        isActive: true,
        requirementTypes: [],
      });
    }
  }

  const reqTypeMap = new Map<string, ComplianceRequirementType>();

  for (const rt of rawReqTypes) {
    const mapped: ComplianceRequirementType = {
      id: rt.id,
      categoryId: rt.categoryId ?? "",
      name: rt.name,
      description: rt.description ?? "",
      requiresExpiration: !!rt.requiresExpiration,
      isActive: rt.isActive !== false,
      sortOrder: rt.sortOrder ?? null,
      variants: [],
    };
    reqTypeMap.set(rt.id, mapped);
    if (mapped.categoryId && byId.has(mapped.categoryId)) {
      byId.get(mapped.categoryId)!.requirementTypes.push(mapped);
    }
  }

  for (const v of rawVariants) {
    const rtId = v.requirementTypeId ?? "";
    if (rtId && reqTypeMap.has(rtId)) {
      reqTypeMap.get(rtId)!.variants.push({
        id: v.id,
        requirementTypeId: rtId,
        name: v.name,
        description: v.description ?? "",
        sortOrder: v.sortOrder ?? null,
        isActive: v.isActive !== false,
      });
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const govA = GOVERNANCE_CATEGORY_ORDER.indexOf(
        a.name as (typeof GOVERNANCE_CATEGORY_ORDER)[number],
      );
      const govB = GOVERNANCE_CATEGORY_ORDER.indexOf(
        b.name as (typeof GOVERNANCE_CATEGORY_ORDER)[number],
      );
      const fallbackA = govA >= 0 ? govA + 1 : 1000;
      const fallbackB = govB >= 0 ? govB + 1 : 1000;
      const effectiveA = a.sortOrder ?? fallbackA;
      const effectiveB = b.sortOrder ?? fallbackB;
      if (effectiveA !== effectiveB) return effectiveA - effectiveB;
      return a.name.localeCompare(b.name);
    })
    .map((cat) => ({
      ...cat,
      requirementTypes: cat.requirementTypes
        .sort((x, y) => {
          const sx = x.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const sy = y.sortOrder ?? Number.MAX_SAFE_INTEGER;
          if (sx !== sy) return sx - sy;
          return x.name.localeCompare(y.name);
        })
        .map((rt) => ({
          ...rt,
          variants: rt.variants.sort((x, y) => {
            const sx = x.sortOrder ?? Number.MAX_SAFE_INTEGER;
            const sy = y.sortOrder ?? Number.MAX_SAFE_INTEGER;
            if (sx !== sy) return sx - sy;
            return x.name.localeCompare(y.name);
          }),
        })),
    }));
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [categories, setCategories] = useState<ComplianceCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardCatId, setWizardCatId] = useState<string | null>(null);
  const [wizardRtId, setWizardRtId] = useState<string | null>(null);
  const [wizardCatName, setWizardCatName] = useState("");
  const [wizardCatSortOrder, setWizardCatSortOrder] = useState("");
  const [wizardCatIsActive, setWizardCatIsActive] = useState(true);
  const [wizardRtName, setWizardRtName] = useState("");
  const [wizardRtDescription, setWizardRtDescription] = useState("");
  const [wizardRtRequiresExpiration, setWizardRtRequiresExpiration] = useState(false);
  const [wizardRtSortOrder, setWizardRtSortOrder] = useState("");
  const [wizardVarName, setWizardVarName] = useState("");
  const [wizardVarDescription, setWizardVarDescription] = useState("");
  const [wizardVarSortOrder, setWizardVarSortOrder] = useState("");

  // ── Category modal ──────────────────────────────────────────────────────────
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catModalIsEdit, setCatModalIsEdit] = useState(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormState>({
    name: "",
    sortOrder: "",
    isActive: true,
  });

  // ── Requirement Type modal ──────────────────────────────────────────────────
  const [rtModalOpen, setRtModalOpen] = useState(false);
  const [rtSaving, setRtSaving] = useState(false);
  const [rtModalIsEdit, setRtModalIsEdit] = useState(false);
  const [rtFormError, setRtFormError] = useState<string | null>(null);
  const [rtForm, setRtForm] = useState<ReqTypeFormState>({
    name: "",
    categoryId: "",
    description: "",
    requiresExpiration: false,
    sortOrder: "",
    isActive: true,
  });

  // ── Variant modal ───────────────────────────────────────────────────────────
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varSaving, setVarSaving] = useState(false);
  const [varModalIsEdit, setVarModalIsEdit] = useState(false);
  const [varFormError, setVarFormError] = useState<string | null>(null);
  const [varForm, setVarForm] = useState<VariantFormState>({
    name: "",
    requirementTypeId: "",
    description: "",
    sortOrder: "",
    isActive: true,
  });

  // ─── Data loading ────────────────────────────────────────────────────────────

  const loadCatalog = async (preserveExpanded = false) => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const token = window.localStorage.getItem("jp_accessToken");
      if (!token) throw new Error("Missing access token.");

      const [catsRes, rtsRes, varsRes] = await Promise.all([
        fetch("/api/compliance-categories", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch("/api/compliance-requirement-types", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch("/api/compliance-variants", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      const parseOrEmpty = async (res: Response): Promise<unknown[]> => {
        if (!res.ok) return [];
        try {
          return (await res.json()) as unknown[];
        } catch {
          return [];
        }
      };

      const [catsData, rtsData, varsData] = await Promise.all([
        parseOrEmpty(catsRes),
        parseOrEmpty(rtsRes),
        parseOrEmpty(varsRes),
      ]);

      const nextCategories = mapComplianceCatalog(
        catsData as ApiCategory[],
        rtsData as ApiRequirementType[],
        varsData as ApiVariant[],
      );

      setCategories(nextCategories);
      setExpandedCategories((prev) =>
        preserveExpanded && prev.size > 0
          ? prev
          : new Set(nextCategories.map((c) => c.id)),
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load compliance catalog.";
      setErrorState(message);
      setCategories([]);
      setExpandedCategories(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadCatalog(false);
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filtered data ───────────────────────────────────────────────────────────

  const filteredCategories = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        requirementTypes: cat.requirementTypes.filter((rt) => {
          if (statusFilter === "Active Only" && !rt.isActive) return false;
          if (statusFilter === "Inactive Only" && rt.isActive) return false;
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            rt.name.toLowerCase().includes(q) ||
            rt.variants.some((v) => v.name.toLowerCase().includes(q))
          );
        }),
      })),
    [categories, statusFilter, searchQuery],
  );

  const totalRequirementTypes = filteredCategories.reduce(
    (sum, c) => sum + c.requirementTypes.length,
    0,
  );

  const categoryOptions = useMemo(
    () => categories.filter((c) => !c.id.startsWith("governance-")),
    [categories],
  );

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getToken = () => window.localStorage.getItem("jp_accessToken") ?? "";

  // ─── Wizard handlers ─────────────────────────────────────────────────────────

  const openWizard = () => {
    setWizardStep(1);
    setWizardCatId(null);
    setWizardRtId(null);
    setWizardCatName("");
    setWizardCatSortOrder("");
    setWizardCatIsActive(true);
    setWizardRtName("");
    setWizardRtDescription("");
    setWizardRtRequiresExpiration(false);
    setWizardRtSortOrder("");
    setWizardVarName("");
    setWizardVarDescription("");
    setWizardVarSortOrder("");
    setWizardError(null);
    setWizardOpen(true);
  };

  const wizardStep1Next = async () => {
    const name = wizardCatName.trim();
    if (!name) {
      setWizardError("Category name is required.");
      return;
    }
    setWizardSaving(true);
    setWizardError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Missing access token.");
      const sortOrderVal = wizardCatSortOrder.trim()
        ? Number(wizardCatSortOrder.trim())
        : undefined;
      const res = await fetch("/api/compliance-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          isActive: wizardCatIsActive,
          ...(sortOrderVal !== undefined ? { sortOrder: sortOrderVal } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to create category: ${res.status}${text ? ` — ${text}` : ""}`,
        );
      }
      const data = (await res.json()) as { id: string };
      setWizardCatId(data.id);
      setWizardStep(2);
    } catch (e) {
      setWizardError(
        e instanceof Error ? e.message : "Failed to save category.",
      );
    } finally {
      setWizardSaving(false);
    }
  };

  const wizardStep2Next = async () => {
    const name = wizardRtName.trim();
    if (!name) {
      setWizardError("Requirement type name is required.");
      return;
    }
    if (!wizardCatId) {
      setWizardError("Category was not saved. Please restart the wizard.");
      return;
    }
    setWizardSaving(true);
    setWizardError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Missing access token.");
      const sortOrderVal = wizardRtSortOrder.trim()
        ? Number(wizardRtSortOrder.trim())
        : undefined;
      const res = await fetch("/api/compliance-requirement-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: wizardCatId,
          name,
          description: wizardRtDescription.trim() || undefined,
          requiresExpiration: wizardRtRequiresExpiration,
          isActive: true,
          ...(sortOrderVal !== undefined ? { sortOrder: sortOrderVal } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to create requirement type: ${res.status}${text ? ` — ${text}` : ""}`,
        );
      }
      const data = (await res.json()) as { id: string };
      setWizardRtId(data.id);
      setWizardStep(3);
    } catch (e) {
      setWizardError(
        e instanceof Error ? e.message : "Failed to save requirement type.",
      );
    } finally {
      setWizardSaving(false);
    }
  };

  const wizardStep3Finish = async () => {
    const name = wizardVarName.trim();
    if (!name) {
      setWizardOpen(false);
      await loadCatalog(true);
      return;
    }
    if (!wizardRtId) {
      setWizardError(
        "Requirement type was not saved. Cannot add variant.",
      );
      return;
    }
    setWizardSaving(true);
    setWizardError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Missing access token.");
      const sortOrderVal = wizardVarSortOrder.trim()
        ? Number(wizardVarSortOrder.trim())
        : undefined;
      const res = await fetch("/api/compliance-variants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requirementTypeId: wizardRtId,
          name,
          description: wizardVarDescription.trim() || undefined,
          isActive: true,
          ...(sortOrderVal !== undefined ? { sortOrder: sortOrderVal } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to create variant: ${res.status}${text ? ` — ${text}` : ""}`,
        );
      }
      setWizardOpen(false);
      await loadCatalog(true);
    } catch (e) {
      setWizardError(
        e instanceof Error ? e.message : "Failed to save variant.",
      );
    } finally {
      setWizardSaving(false);
    }
  };

  const wizardSkipAndClose = () => {
    setWizardError(null);
    setWizardOpen(false);
    loadCatalog(true);
  };

  // ─── Category modal handlers ─────────────────────────────────────────────────

  const openCatEdit = (cat: ComplianceCategory) => {
    if (cat.id.startsWith("governance-")) {
      setErrorState(
        `Cannot edit "${cat.name}" — this category is not yet saved to the database. Use the Add Category wizard to create it.`,
      );
      return;
    }
    setCatModalIsEdit(true);
    setCatFormError(null);
    setCatForm({
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sortOrder == null ? "" : String(cat.sortOrder),
      isActive: cat.isActive,
    });
    setCatModalOpen(true);
  };

  const saveCat = async () => {
    const name = catForm.name.trim();
    if (!name) {
      setCatFormError("Name is required.");
      return;
    }
    const token = getToken();
    if (!token) {
      setCatFormError("Missing access token.");
      return;
    }
    let sortOrder: number | undefined;
    if (catForm.sortOrder.trim()) {
      const parsed = Number(catForm.sortOrder.trim());
      if (!Number.isInteger(parsed)) {
        setCatFormError("Sort Order must be a whole number.");
        return;
      }
      sortOrder = parsed;
    }
    const payload: Record<string, unknown> = {
      name,
      isActive: catForm.isActive,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };
    const url = catModalIsEdit && catForm.id
      ? `/api/compliance-categories/${encodeURIComponent(catForm.id)}`
      : "/api/compliance-categories";
    const method: "POST" | "PATCH" = catModalIsEdit && catForm.id ? "PATCH" : "POST";
    setCatSaving(true);
    setCatFormError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Save failed: ${res.status}${t ? ` — ${t}` : ""}`);
      }
      setCatModalOpen(false);
      await loadCatalog(true);
    } catch (e) {
      setCatFormError(
        e instanceof Error ? e.message : "Failed to save category.",
      );
    } finally {
      setCatSaving(false);
    }
  };

  // ─── Requirement Type modal handlers ─────────────────────────────────────────

  const openRtCreate = (cat: ComplianceCategory) => {
    if (cat.id.startsWith("governance-")) {
      setErrorState(
        `Cannot add a requirement type to "${cat.name}" — this category is not yet saved. Use the Add Category wizard to create it first.`,
      );
      return;
    }
    setRtModalIsEdit(false);
    setRtFormError(null);
    setRtForm({
      name: "",
      categoryId: cat.id,
      description: "",
      requiresExpiration: false,
      sortOrder: "",
      isActive: true,
    });
    setRtModalOpen(true);
  };

  const openRtEdit = (rt: ComplianceRequirementType) => {
    setRtModalIsEdit(true);
    setRtFormError(null);
    setRtForm({
      id: rt.id,
      name: rt.name,
      categoryId: rt.categoryId,
      description: rt.description,
      requiresExpiration: rt.requiresExpiration,
      sortOrder: rt.sortOrder == null ? "" : String(rt.sortOrder),
      isActive: rt.isActive,
    });
    setRtModalOpen(true);
  };

  const saveRt = async () => {
    const name = rtForm.name.trim();
    if (!name) {
      setRtFormError("Name is required.");
      return;
    }
    if (!rtForm.categoryId) {
      setRtFormError("Category is required.");
      return;
    }
    const token = getToken();
    if (!token) {
      setRtFormError("Missing access token.");
      return;
    }
    let sortOrder: number | undefined;
    if (rtForm.sortOrder.trim()) {
      const parsed = Number(rtForm.sortOrder.trim());
      if (!Number.isInteger(parsed)) {
        setRtFormError("Sort Order must be a whole number.");
        return;
      }
      sortOrder = parsed;
    }
    const payload: Record<string, unknown> = {
      name,
      categoryId: rtForm.categoryId,
      description: rtForm.description.trim() || undefined,
      requiresExpiration: rtForm.requiresExpiration,
      isActive: rtForm.isActive,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };
    const url = rtModalIsEdit && rtForm.id
      ? `/api/compliance-requirement-types/${encodeURIComponent(rtForm.id)}`
      : "/api/compliance-requirement-types";
    const method: "POST" | "PATCH" = rtModalIsEdit && rtForm.id ? "PATCH" : "POST";
    setRtSaving(true);
    setRtFormError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Save failed: ${res.status}${t ? ` — ${t}` : ""}`);
      }
      setRtModalOpen(false);
      await loadCatalog(true);
    } catch (e) {
      setRtFormError(
        e instanceof Error ? e.message : "Failed to save requirement type.",
      );
    } finally {
      setRtSaving(false);
    }
  };

  // ─── Variant modal handlers ───────────────────────────────────────────────────

  const openVarCreate = (rt: ComplianceRequirementType) => {
    setVarModalIsEdit(false);
    setVarFormError(null);
    setVarForm({
      name: "",
      requirementTypeId: rt.id,
      description: "",
      sortOrder: "",
      isActive: true,
    });
    setVarModalOpen(true);
  };

  const openVarEdit = (v: ComplianceVariant) => {
    setVarModalIsEdit(true);
    setVarFormError(null);
    setVarForm({
      id: v.id,
      name: v.name,
      requirementTypeId: v.requirementTypeId,
      description: v.description,
      sortOrder: v.sortOrder == null ? "" : String(v.sortOrder),
      isActive: v.isActive,
    });
    setVarModalOpen(true);
  };

  const saveVar = async () => {
    const name = varForm.name.trim();
    if (!name) {
      setVarFormError("Name is required.");
      return;
    }
    const token = getToken();
    if (!token) {
      setVarFormError("Missing access token.");
      return;
    }
    let sortOrder: number | undefined;
    if (varForm.sortOrder.trim()) {
      const parsed = Number(varForm.sortOrder.trim());
      if (!Number.isInteger(parsed)) {
        setVarFormError("Sort Order must be a whole number.");
        return;
      }
      sortOrder = parsed;
    }
    const payload: Record<string, unknown> = {
      name,
      requirementTypeId: varForm.requirementTypeId,
      description: varForm.description.trim() || undefined,
      isActive: varForm.isActive,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };
    const url = varModalIsEdit && varForm.id
      ? `/api/compliance-variants/${encodeURIComponent(varForm.id)}`
      : "/api/compliance-variants";
    const method: "POST" | "PATCH" = varModalIsEdit && varForm.id ? "PATCH" : "POST";
    setVarSaving(true);
    setVarFormError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Save failed: ${res.status}${t ? ` — ${t}` : ""}`);
      }
      setVarModalOpen(false);
      await loadCatalog(true);
    } catch (e) {
      setVarFormError(
        e instanceof Error ? e.message : "Failed to save variant.",
      );
    } finally {
      setVarSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="compliance-container">

      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Compliance Catalog</h1>
          <p className="subtitle">
            Admin catalog of compliance categories, requirement types, and variants for site eligibility and dispatch gating.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-add-category" onClick={openWizard}>
            + Add Category
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Active Only">Active Only</option>
            <option value="Inactive Only">Inactive Only</option>
          </select>
        </div>
        <div className="filter-group search-group">
          <label htmlFor="searchInput">Search</label>
          <input
            id="searchInput"
            type="text"
            placeholder="Requirement type or variant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-results">
          {filteredCategories.length} categor{filteredCategories.length !== 1 ? "ies" : "y"},{" "}
          {totalRequirementTypes} requirement type{totalRequirementTypes !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Catalog */}
      {isLoading ? (
        <div className="loading-state">Loading compliance catalog...</div>
      ) : errorState ? (
        <div className="error-state">
          {errorState}
          <button
            type="button"
            className="error-dismiss"
            onClick={() => setErrorState(null)}
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="categories-section">
          {filteredCategories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.id);
            return (
              <div key={cat.id} className="category-accordion">

                {/* Category Header */}
                <div className="category-header-row">
                  <button
                    type="button"
                    className="category-toggle"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <span className={`chevron ${isExpanded ? "chevron--open" : ""}`}>▶</span>
                    <span className="category-name">{cat.name}</span>
                    {!cat.isActive && (
                      <span className="cat-inactive-badge">Inactive</span>
                    )}
                    <span className="type-count">
                      {cat.requirementTypes.length} requirement type
                      {cat.requirementTypes.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-edit-category"
                    onClick={() => openCatEdit(cat)}
                    aria-label={`Edit category ${cat.name}`}
                  >
                    Edit Category
                  </button>
                  <button
                    type="button"
                    className="btn-add-rt"
                    onClick={() => openRtCreate(cat)}
                    aria-label={`Add requirement type to ${cat.name}`}
                  >
                    + Add Requirement Type
                  </button>
                </div>

                {/* Category Body */}
                {isExpanded && (
                  <div className="category-body">
                    {cat.requirementTypes.length === 0 ? (
                      <div className="empty-category">
                        No requirement types yet.{" "}
                        {!cat.id.startsWith("governance-") && (
                          <button
                            type="button"
                            className="empty-add-link"
                            onClick={() => openRtCreate(cat)}
                          >
                            Add one now
                          </button>
                        )}
                        {cat.id.startsWith("governance-") && (
                          <span className="empty-hint">
                            Use the Add Category wizard to create this category first.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="req-types-list">
                        {cat.requirementTypes.map((rt) => (
                          <div key={rt.id} className="req-type-section">

                            {/* Requirement Type Header */}
                            <div className="req-type-header">
                              <div className="req-type-header-left">
                                <span className="req-type-name">{rt.name}</span>
                                {rt.requiresExpiration && (
                                  <span className="expires-badge">Expires</span>
                                )}
                                {!rt.isActive && (
                                  <span className="inactive-pill">Inactive</span>
                                )}
                                {rt.description && (
                                  <span className="rt-desc">{rt.description}</span>
                                )}
                                <span className="variant-count">
                                  {rt.variants.length} variant
                                  {rt.variants.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="req-type-header-right">
                                <button
                                  type="button"
                                  className="btn-edit-rt"
                                  onClick={() => openRtEdit(rt)}
                                  aria-label={`Edit requirement type ${rt.name}`}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-add-variant"
                                  onClick={() => openVarCreate(rt)}
                                  aria-label={`Add variant to ${rt.name}`}
                                >
                                  + Add Variant
                                </button>
                              </div>
                            </div>

                            {/* Variants */}
                            {rt.variants.length > 0 ? (
                              <div className="variants-list">
                                {rt.variants.map((v) => {
                                  const s = getStatusStyle(v.isActive);
                                  return (
                                    <div key={v.id} className="variant-row">
                                      <div className="variant-row-left">
                                        <span className="variant-indent" aria-hidden="true">└</span>
                                        <button
                                          type="button"
                                          className="variant-name-btn"
                                          onClick={() => openVarEdit(v)}
                                        >
                                          {v.name}
                                        </button>
                                        {v.description && (
                                          <span className="variant-desc">{v.description}</span>
                                        )}
                                      </div>
                                      <div className="variant-row-right">
                                        <span
                                          className="status-badge"
                                          style={{
                                            backgroundColor: s.bg,
                                            color: s.color,
                                            borderColor: s.border,
                                          }}
                                        >
                                          {v.isActive ? "Active" : "Inactive"}
                                        </span>
                                        <button
                                          type="button"
                                          className="btn-edit-variant"
                                          onClick={() => openVarEdit(v)}
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="empty-variants">
                                No variants yet.{" "}
                                <button
                                  type="button"
                                  className="empty-add-link"
                                  onClick={() => openVarCreate(rt)}
                                >
                                  Add first variant
                                </button>
                              </div>
                            )}

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ─── WIZARD MODAL ──────────────────────────────────────────────────────── */}
      {wizardOpen && (
        <div
          className="modal-overlay"
          onClick={() => !wizardSaving && setWizardOpen(false)}
        >
          <div
            className="modal modal--wizard"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="wizard-header-left">
                <h2>
                  {wizardStep === 1 && "Step 1 of 3 — Create Category"}
                  {wizardStep === 2 && "Step 2 of 3 — Add Requirement Type"}
                  {wizardStep === 3 && "Step 3 of 3 — Add First Variant"}
                </h2>
                <div className="wizard-step-dots">
                  <span className={`step-dot ${wizardStep >= 1 ? "step-dot--active" : ""}`} />
                  <span className={`step-dot ${wizardStep >= 2 ? "step-dot--active" : ""}`} />
                  <span className={`step-dot ${wizardStep >= 3 ? "step-dot--active" : ""}`} />
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !wizardSaving && setWizardOpen(false)}
                disabled={wizardSaving}
              >
                ×
              </button>
            </div>

            <div className="modal-body wizard-body">

              {/* Left column: form */}
              <div className="wizard-form-col">

                {/* Step 1 — Category */}
                {wizardStep === 1 && (
                  <>
                    <div className="wizard-helper-box">
                      <div className="helper-title">What is a Category?</div>
                      <p>
                        A category is the broad compliance bucket that groups related
                        requirements together.
                      </p>
                      <p className="helper-examples">
                        Examples: Drug Testing · Background Checks · Site Badging ·
                        Medical Clearance · Safety Orientation
                      </p>
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-cat-name">Category Name *</label>
                      <input
                        id="wiz-cat-name"
                        type="text"
                        value={wizardCatName}
                        onChange={(e) => {
                          setWizardCatName(e.target.value);
                          setWizardError(null);
                        }}
                        placeholder="Drug Testing"
                        disabled={wizardSaving}
                        autoFocus
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-cat-sort">Sort Order</label>
                      <input
                        id="wiz-cat-sort"
                        type="number"
                        step="1"
                        value={wizardCatSortOrder}
                        onChange={(e) => setWizardCatSortOrder(e.target.value)}
                        placeholder="Optional"
                        disabled={wizardSaving}
                      />
                    </div>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={wizardCatIsActive}
                        onChange={(e) => setWizardCatIsActive(e.target.checked)}
                        disabled={wizardSaving}
                      />
                      Active
                    </label>
                  </>
                )}

                {/* Step 2 — Requirement Type */}
                {wizardStep === 2 && (
                  <>
                    <div className="wizard-helper-box">
                      <div className="helper-title">What is a Requirement Type?</div>
                      <p>
                        This is the <strong>base compliance item</strong> tracked
                        inside the category — not a specific version.
                      </p>
                      <p>
                        Enter the broad item name.{" "}
                        <strong>Do not enter a specific version here.</strong>
                      </p>
                      <p className="helper-examples helper-examples--good">
                        ✓ Enter: Drug Test · Background Check · Site Orientation ·
                        Medical Exam
                      </p>
                      <p className="helper-examples helper-examples--warn">
                        ✗ Not this: 5 Panel · 10 Panel · Hair Follicle · 200 Panel ·
                        DISA (those are Variants — added in Step 3)
                      </p>
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-rt-name">Requirement Type Name *</label>
                      <input
                        id="wiz-rt-name"
                        type="text"
                        value={wizardRtName}
                        onChange={(e) => {
                          setWizardRtName(e.target.value);
                          setWizardError(null);
                        }}
                        placeholder="Drug Test"
                        disabled={wizardSaving}
                        autoFocus
                      />
                      {looksLikeVariant(wizardRtName) && (
                        <div className="variant-warning">
                          ⚠ This looks like a specific variant, not a requirement type.
                          Did you mean to add a Variant instead? Requirement Types
                          should be broad (e.g. &ldquo;Drug Test&rdquo;), while
                          Variants are specific (e.g. &ldquo;10 Panel&rdquo;).
                        </div>
                      )}
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-rt-desc">Description</label>
                      <textarea
                        id="wiz-rt-desc"
                        rows={2}
                        value={wizardRtDescription}
                        onChange={(e) => setWizardRtDescription(e.target.value)}
                        placeholder="Optional"
                        disabled={wizardSaving}
                      />
                    </div>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={wizardRtRequiresExpiration}
                        onChange={(e) =>
                          setWizardRtRequiresExpiration(e.target.checked)
                        }
                        disabled={wizardSaving}
                      />
                      Requires Expiration Date
                    </label>
                    <div className="form-field" style={{ marginTop: 10 }}>
                      <label htmlFor="wiz-rt-sort">Sort Order</label>
                      <input
                        id="wiz-rt-sort"
                        type="number"
                        step="1"
                        value={wizardRtSortOrder}
                        onChange={(e) => setWizardRtSortOrder(e.target.value)}
                        placeholder="Optional"
                        disabled={wizardSaving}
                      />
                    </div>
                  </>
                )}

                {/* Step 3 — Variant */}
                {wizardStep === 3 && (
                  <>
                    <div className="wizard-helper-box">
                      <div className="helper-title">What is a Variant?</div>
                      <p>
                        Variants are the <strong>specific versions</strong> of the
                        requirement type above.
                      </p>
                      <p className="helper-examples helper-examples--good">
                        Examples: 5 Panel · 10 Panel · Hair Follicle · 200 Panel ·
                        DISA · Standard Criminal · Federal Criminal
                      </p>
                      <p className="helper-skip-note">
                        You can skip this step — variants can be added from the
                        catalog at any time.
                      </p>
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-var-name">
                        Variant Name{" "}
                        <span className="optional-label">(optional)</span>
                      </label>
                      <input
                        id="wiz-var-name"
                        type="text"
                        value={wizardVarName}
                        onChange={(e) => {
                          setWizardVarName(e.target.value);
                          setWizardError(null);
                        }}
                        placeholder="10 Panel"
                        disabled={wizardSaving}
                        autoFocus
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-var-desc">Description</label>
                      <textarea
                        id="wiz-var-desc"
                        rows={2}
                        value={wizardVarDescription}
                        onChange={(e) => setWizardVarDescription(e.target.value)}
                        placeholder="Optional"
                        disabled={wizardSaving}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="wiz-var-sort">Sort Order</label>
                      <input
                        id="wiz-var-sort"
                        type="number"
                        step="1"
                        value={wizardVarSortOrder}
                        onChange={(e) => setWizardVarSortOrder(e.target.value)}
                        placeholder="Optional"
                        disabled={wizardSaving}
                      />
                    </div>
                  </>
                )}

                {wizardError && (
                  <div className="form-error">{wizardError}</div>
                )}
              </div>

              {/* Right column: live preview */}
              <div className="wizard-preview-col">
                <div className="preview-label">Live Preview</div>
                <div className="preview-tree">
                  <div className="preview-row preview-row--cat">
                    <span className="preview-icon">▣</span>
                    <span className="preview-key">Category:</span>
                    <span
                      className={`preview-val ${!wizardCatName.trim() ? "preview-placeholder" : ""}`}
                    >
                      {wizardCatName.trim() || "…"}
                    </span>
                  </div>
                  {wizardStep >= 2 && (
                    <div className="preview-row preview-row--rt">
                      <span className="preview-branch">└──</span>
                      <span className="preview-key">Requirement Type:</span>
                      <span
                        className={`preview-val ${!wizardRtName.trim() ? "preview-placeholder" : ""}`}
                      >
                        {wizardRtName.trim() || "…"}
                      </span>
                    </div>
                  )}
                  {wizardStep >= 3 && (
                    <div className="preview-row preview-row--var">
                      <span className="preview-branch preview-branch--deep">└──</span>
                      <span className="preview-key">Variant:</span>
                      <span
                        className={`preview-val ${!wizardVarName.trim() ? "preview-placeholder" : ""}`}
                      >
                        {wizardVarName.trim() || "…"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="preview-legend">
                  <div className="legend-row">
                    <span className="legend-term">Category</span> — broad compliance bucket
                  </div>
                  <div className="legend-row">
                    <span className="legend-term">Requirement Type</span> — base tracked item
                  </div>
                  <div className="legend-row">
                    <span className="legend-term">Variant</span> — specific version
                  </div>
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => !wizardSaving && setWizardOpen(false)}
                disabled={wizardSaving}
              >
                Cancel
              </button>
              {(wizardStep === 2 || wizardStep === 3) && (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={wizardSkipAndClose}
                  disabled={wizardSaving}
                >
                  {wizardStep === 2 ? "Skip — Finish Later" : "Skip Variant"}
                </button>
              )}
              <button
                type="button"
                className="btn-save"
                onClick={
                  wizardStep === 1
                    ? wizardStep1Next
                    : wizardStep === 2
                      ? wizardStep2Next
                      : wizardStep3Finish
                }
                disabled={wizardSaving}
              >
                {wizardSaving
                  ? "Saving..."
                  : wizardStep === 1
                    ? "Save & Continue →"
                    : wizardStep === 2
                      ? "Save & Continue →"
                      : wizardVarName.trim()
                        ? "Save Variant & Finish"
                        : "Finish Setup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CATEGORY MODAL (Edit only — creation uses wizard) ──────────────── */}
      {catModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => !catSaving && setCatModalOpen(false)}
        >
          <div
            className="modal modal--small"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{catModalIsEdit ? "Edit Category" : "Add Category"}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !catSaving && setCatModalOpen(false)}
                disabled={catSaving}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid--single">
                <div className="form-field">
                  <label htmlFor="cat-name">Name *</label>
                  <input
                    id="cat-name"
                    type="text"
                    value={catForm.name}
                    onChange={(e) =>
                      setCatForm((p) => ({ ...p, name: e.target.value }))
                    }
                    disabled={catSaving}
                    placeholder="Drug Testing"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="cat-sort">Sort Order</label>
                  <input
                    id="cat-sort"
                    type="number"
                    step="1"
                    value={catForm.sortOrder}
                    onChange={(e) =>
                      setCatForm((p) => ({ ...p, sortOrder: e.target.value }))
                    }
                    disabled={catSaving}
                    placeholder="Optional"
                  />
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={catForm.isActive}
                    onChange={(e) =>
                      setCatForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                    disabled={catSaving}
                  />
                  Active
                </label>
              </div>
              {catFormError && <div className="form-error">{catFormError}</div>}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => !catSaving && setCatModalOpen(false)}
                disabled={catSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={saveCat}
                disabled={catSaving}
              >
                {catSaving
                  ? "Saving..."
                  : catModalIsEdit
                    ? "Save Category"
                    : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── REQUIREMENT TYPE MODAL ─────────────────────────────────────────── */}
      {rtModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => !rtSaving && setRtModalOpen(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {rtModalIsEdit ? "Edit Requirement Type" : "Add Requirement Type"}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !rtSaving && setRtModalOpen(false)}
                disabled={rtSaving}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="rt-guide-box">
                <strong>Requirement Type</strong> is the broad compliance item —
                not a specific version.
                <br />
                <span className="guide-good">
                  ✓ Good: Drug Test · Background Check · Site Orientation · Medical Exam
                </span>
                <br />
                <span className="guide-bad">
                  ✗ Not this: 10 Panel · DISA · Hair Follicle (those are Variants,
                  added separately)
                </span>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="rt-name">Name *</label>
                  <input
                    id="rt-name"
                    type="text"
                    value={rtForm.name}
                    onChange={(e) =>
                      setRtForm((p) => ({ ...p, name: e.target.value }))
                    }
                    disabled={rtSaving}
                    placeholder="Drug Test"
                  />
                  {looksLikeVariant(rtForm.name) && (
                    <div className="variant-warning">
                      ⚠ This looks like a specific variant, not a requirement
                      type. Did you mean to add a Variant instead? Requirement
                      Types should be broad (e.g. &ldquo;Drug Test&rdquo;),
                      while Variants are specific (e.g. &ldquo;10 Panel&rdquo;).
                    </div>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="rt-sort">Sort Order</label>
                  <input
                    id="rt-sort"
                    type="number"
                    step="1"
                    value={rtForm.sortOrder}
                    onChange={(e) =>
                      setRtForm((p) => ({ ...p, sortOrder: e.target.value }))
                    }
                    disabled={rtSaving}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="rt-desc">Description</label>
                <textarea
                  id="rt-desc"
                  rows={3}
                  value={rtForm.description}
                  onChange={(e) =>
                    setRtForm((p) => ({ ...p, description: e.target.value }))
                  }
                  disabled={rtSaving}
                  placeholder="Optional"
                />
              </div>
              <div className="toggle-grid">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={rtForm.requiresExpiration}
                    onChange={(e) =>
                      setRtForm((p) => ({
                        ...p,
                        requiresExpiration: e.target.checked,
                      }))
                    }
                    disabled={rtSaving}
                  />
                  Requires Expiration Date
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={rtForm.isActive}
                    onChange={(e) =>
                      setRtForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                    disabled={rtSaving}
                  />
                  Active
                </label>
              </div>
              {!rtModalIsEdit && (
                <div className="form-grid form-grid--single">
                  <div className="form-field">
                    <label htmlFor="rt-cat">Category</label>
                    <select
                      id="rt-cat"
                      value={rtForm.categoryId}
                      onChange={(e) =>
                        setRtForm((p) => ({ ...p, categoryId: e.target.value }))
                      }
                      disabled={rtSaving}
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {rtFormError && <div className="form-error">{rtFormError}</div>}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => !rtSaving && setRtModalOpen(false)}
                disabled={rtSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={saveRt}
                disabled={rtSaving}
              >
                {rtSaving
                  ? "Saving..."
                  : rtModalIsEdit
                    ? "Save Changes"
                    : "Create Requirement Type"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── VARIANT MODAL ──────────────────────────────────────────────────── */}
      {varModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => !varSaving && setVarModalOpen(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{varModalIsEdit ? "Edit Variant" : "Add Variant"}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !varSaving && setVarModalOpen(false)}
                disabled={varSaving}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="rt-guide-box">
                <strong>Variant</strong> is the specific version of a
                Requirement Type.
                <br />
                <span className="guide-good">
                  Examples: 5 Panel · 10 Panel · Hair Follicle · 200 Panel · DISA ·
                  Standard Criminal · Federal Criminal · Observed
                </span>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="var-name">Name *</label>
                  <input
                    id="var-name"
                    type="text"
                    value={varForm.name}
                    onChange={(e) =>
                      setVarForm((p) => ({ ...p, name: e.target.value }))
                    }
                    disabled={varSaving}
                    placeholder="10 Panel"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="var-sort">Sort Order</label>
                  <input
                    id="var-sort"
                    type="number"
                    step="1"
                    value={varForm.sortOrder}
                    onChange={(e) =>
                      setVarForm((p) => ({ ...p, sortOrder: e.target.value }))
                    }
                    disabled={varSaving}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="var-desc">Description</label>
                <textarea
                  id="var-desc"
                  rows={3}
                  value={varForm.description}
                  onChange={(e) =>
                    setVarForm((p) => ({ ...p, description: e.target.value }))
                  }
                  disabled={varSaving}
                  placeholder="Optional"
                />
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={varForm.isActive}
                  onChange={(e) =>
                    setVarForm((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  disabled={varSaving}
                />
                Active
              </label>
              {varFormError && <div className="form-error">{varFormError}</div>}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => !varSaving && setVarModalOpen(false)}
                disabled={varSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={saveVar}
                disabled={varSaving}
              >
                {varSaving
                  ? "Saving..."
                  : varModalIsEdit
                    ? "Save Changes"
                    : "Create Variant"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .compliance-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .header-left {
          flex: 1;
        }
        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 0.15s ease;
          display: inline-block;
          margin-bottom: 12px;
        }
        .back-link:hover {
          color: #3b82f6;
        }
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
          max-width: 620px;
          line-height: 1.5;
        }
        .header-actions {
          padding-top: 28px;
        }
        .btn-add-category {
          display: inline-block;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-add-category:hover {
          background: #2563eb;
        }
        .filters-section {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 20px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-group label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
          min-width: 140px;
        }
        .filter-group select option {
          background: #1a1d24;
          color: #fff;
        }
        .search-group input {
          min-width: 260px;
        }
        .filter-results {
          margin-left: auto;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding-bottom: 8px;
        }
        .loading-state,
        .error-state {
          text-align: center;
          padding: 32px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          font-size: 14px;
        }
        .loading-state {
          color: rgba(255, 255, 255, 0.65);
        }
        .error-state {
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.08);
          display: flex;
          align-items: center;
          gap: 16px;
          justify-content: center;
        }
        .error-dismiss {
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: transparent;
          color: #fca5a5;
          font-size: 12px;
          cursor: pointer;
        }

        /* ── Category Accordion ── */
        .categories-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .category-accordion {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }
        .category-header-row {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
        }
        .category-toggle {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .chevron {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          transition: transform 0.2s ease;
          display: inline-block;
          flex-shrink: 0;
        }
        .chevron--open {
          transform: rotate(90deg);
        }
        .category-name {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }
        .cat-inactive-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(107, 114, 128, 0.15);
          color: #6b7280;
          border: 1px solid rgba(107, 114, 128, 0.25);
          flex-shrink: 0;
        }
        .type-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-left: auto;
        }
        .btn-edit-category {
          flex-shrink: 0;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          margin-right: 8px;
        }
        .btn-add-rt {
          flex-shrink: 0;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          margin-right: 16px;
          white-space: nowrap;
        }
        .category-body {
          padding: 0 0 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .empty-category {
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          padding: 24px 16px;
          font-size: 13px;
        }
        .empty-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }
        .empty-add-link {
          background: none;
          border: none;
          color: #3b82f6;
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* ── Requirement Type Section ── */
        .req-types-list {
          display: flex;
          flex-direction: column;
        }
        .req-type-section {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .req-type-section:last-child {
          border-bottom: none;
        }
        .req-type-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px 12px 28px;
          background: rgba(255, 255, 255, 0.015);
          gap: 12px;
        }
        .req-type-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .req-type-name {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
          white-space: nowrap;
        }
        .expires-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(251, 146, 60, 0.15);
          color: #fb923c;
          border: 1px solid rgba(251, 146, 60, 0.3);
          flex-shrink: 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .inactive-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(107, 114, 128, 0.15);
          color: #6b7280;
          border: 1px solid rgba(107, 114, 128, 0.25);
          flex-shrink: 0;
        }
        .rt-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }
        .variant-count {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          margin-left: auto;
          white-space: nowrap;
        }
        .req-type-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .btn-edit-rt {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.75);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .btn-add-variant {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          cursor: pointer;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.22);
          white-space: nowrap;
        }

        /* ── Variant Rows ── */
        .variants-list {
          display: flex;
          flex-direction: column;
        }
        .variant-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 20px 8px 52px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(0, 0, 0, 0.08);
        }
        .variant-row-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .variant-indent {
          color: rgba(255, 255, 255, 0.2);
          font-size: 12px;
          flex-shrink: 0;
          font-family: monospace;
        }
        .variant-name-btn {
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
          cursor: pointer;
          text-align: left;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          text-decoration: underline;
          text-decoration-color: rgba(255, 255, 255, 0.2);
          text-underline-offset: 3px;
        }
        .variant-name-btn:hover {
          color: #fff;
        }
        .variant-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 240px;
        }
        .variant-row-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .status-badge {
          display: inline-block;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          flex-shrink: 0;
        }
        .btn-edit-variant {
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.65);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .empty-variants {
          padding: 10px 20px 10px 52px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(0, 0, 0, 0.06);
        }

        /* ── Modals ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal {
          width: 640px;
          max-width: 100%;
          max-height: 90vh;
          background: #12151b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
        }
        .modal--small {
          width: 520px;
        }
        .modal--wizard {
          width: 820px;
          max-width: calc(100vw - 40px);
        }
        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          color: #fff;
          font-weight: 600;
        }
        .modal-close {
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          font-size: 22px;
          cursor: pointer;
          flex-shrink: 0;
          line-height: 1;
          padding: 0 0 0 12px;
        }
        .modal-body {
          padding: 18px 20px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-grid--single {
          grid-template-columns: 1fr;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-field label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.75);
        }
        .optional-label {
          color: rgba(255, 255, 255, 0.4);
          font-weight: 400;
        }
        .form-field input,
        .form-field select,
        .form-field textarea {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 6px;
          color: #fff;
          padding: 9px 10px;
          font-size: 13px;
          font-family: inherit;
        }
        .form-field select option {
          background: #1a1d24;
          color: #fff;
        }
        .toggle-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .toggle-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
        }
        .form-error {
          margin-top: 4px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.09);
          color: #fecaca;
          font-size: 12px;
          line-height: 1.5;
        }
        .btn-cancel {
          padding: 8px 14px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          font-size: 13px;
        }
        .btn-save {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          background: #3b82f6;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        }
        .btn-save:hover:not(:disabled) {
          background: #2563eb;
        }
        .btn-cancel:disabled,
        .btn-save:disabled,
        .modal-close:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* ── Guide boxes ── */
        .rt-guide-box {
          padding: 12px 14px;
          background: rgba(59, 130, 246, 0.06);
          border: 1px solid rgba(59, 130, 246, 0.18);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.6;
        }
        .rt-guide-box strong {
          color: rgba(255, 255, 255, 0.95);
        }
        .guide-good {
          color: #86efac;
        }
        .guide-bad {
          color: rgba(255, 255, 255, 0.5);
        }
        .variant-warning {
          margin-top: 6px;
          padding: 9px 12px;
          border-radius: 7px;
          border: 1px solid rgba(251, 191, 36, 0.35);
          background: rgba(251, 191, 36, 0.08);
          color: #fde68a;
          font-size: 12px;
          line-height: 1.5;
        }

        /* ── Wizard layout ── */
        .wizard-header-left {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wizard-step-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          display: inline-block;
          transition: background 0.2s ease;
        }
        .step-dot--active {
          background: #3b82f6;
        }
        .wizard-body {
          display: flex;
          flex-direction: row;
          gap: 0;
          padding: 0;
          flex: 1;
          overflow: hidden;
        }
        .wizard-form-col {
          flex: 1;
          padding: 20px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-right: 1px solid rgba(255, 255, 255, 0.07);
        }
        .wizard-preview-col {
          width: 260px;
          flex-shrink: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: rgba(0, 0, 0, 0.15);
          overflow: auto;
        }
        .wizard-helper-box {
          padding: 12px 14px;
          background: rgba(59, 130, 246, 0.06);
          border: 1px solid rgba(59, 130, 246, 0.18);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.6;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .helper-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 2px;
        }
        .wizard-helper-box p {
          margin: 0;
        }
        .helper-examples {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }
        .helper-examples--good {
          color: #86efac;
        }
        .helper-examples--warn {
          color: #fde68a;
        }
        .helper-skip-note {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        /* ── Live Preview ── */
        .preview-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.4);
        }
        .preview-tree {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .preview-row {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 5px;
          font-size: 12px;
        }
        .preview-row--rt {
          padding-left: 8px;
        }
        .preview-row--var {
          padding-left: 24px;
        }
        .preview-icon {
          color: rgba(255, 255, 255, 0.3);
          font-size: 11px;
        }
        .preview-branch {
          color: rgba(255, 255, 255, 0.25);
          font-family: monospace;
          font-size: 12px;
          white-space: pre;
        }
        .preview-branch--deep {
          padding-left: 10px;
        }
        .preview-key {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
        }
        .preview-val {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          word-break: break-word;
        }
        .preview-placeholder {
          color: rgba(255, 255, 255, 0.25);
          font-style: italic;
          font-weight: 400;
        }
        .preview-legend {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }
        .legend-row {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          line-height: 1.5;
        }
        .legend-term {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.65);
        }
      `}</style>
    </div>
  );
}
