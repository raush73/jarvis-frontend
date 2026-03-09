"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CertificationTypeStatus = "Active" | "Inactive";

type CertificationTypeItem = {
  id: string;
  code: string;
  name: string;
  status: CertificationTypeStatus;
  categoryId: string | null;
  description: string;
  requiresExpiration: boolean;
  requiresState: boolean;
  requiresLicenseNumber: boolean;
  sortOrder: number | null;
  isMW4HTrainableDefault: boolean;
  isActive: boolean;
};

type CertificationCategory = {
  id: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean;
  certificationTypes: CertificationTypeItem[];
};

type ApiCertificationCategory = {
  id: string;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean;
};

type ApiCertificationType = {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  categoryId?: string | null;
  description?: string | null;
  requiresExpiration?: boolean;
  requiresState?: boolean;
  requiresLicenseNumber?: boolean;
  sortOrder?: number | null;
  isMW4HTrainableDefault?: boolean;
  isActive?: boolean;
  certCategory?: ApiCertificationCategory | null;
};

type TypeFormState = {
  id?: string;
  code: string;
  name: string;
  categoryId: string;
  description: string;
  requiresExpiration: boolean;
  requiresState: boolean;
  requiresLicenseNumber: boolean;
  sortOrder: string;
  isMW4HTrainableDefault: boolean;
  isActive: boolean;
};

type CategoryFormState = {
  id?: string;
  name: string;
  sortOrder: string;
  isActive: boolean;
};

const GOVERNANCE_CATEGORY_ORDER = [
  "OSHA",
  "MSHA",
  "Welding",
  "Crane",
  "Rigging",
  "Electrical",
  "Medical",
  "Security",
] as const;

function getStatusStyle(status: CertificationTypeStatus) {
  if (status === "Active") {
    return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
  }
  return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
}

function mapCategoriesAndTypes(
  categories: ApiCertificationCategory[],
  types: ApiCertificationType[],
): CertificationCategory[] {
  const byId = new Map<string, CertificationCategory>();

  for (const c of categories) {
    byId.set(c.id, {
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder ?? null,
      isActive: c.isActive !== false,
      certificationTypes: [],
    });
  }

  for (const name of GOVERNANCE_CATEGORY_ORDER) {
    const exists = [...byId.values()].some((c) => c.name === name);
    if (!exists) {
      byId.set(`governance-${name.toLowerCase()}`, {
        id: `governance-${name.toLowerCase()}`,
        name,
        sortOrder: null,
        isActive: true,
        certificationTypes: [],
      });
    }
  }

  for (const t of types) {
    const mappedType: CertificationTypeItem = {
      id: t.id,
      code: t.code,
      name: t.name,
      status: t.isActive === false ? "Inactive" : "Active",
      categoryId: t.categoryId ?? t.certCategory?.id ?? null,
      description: t.description ?? "",
      requiresExpiration: !!t.requiresExpiration,
      requiresState: !!t.requiresState,
      requiresLicenseNumber: !!t.requiresLicenseNumber,
      sortOrder: t.sortOrder ?? null,
      isMW4HTrainableDefault: !!t.isMW4HTrainableDefault,
      isActive: t.isActive !== false,
    };

    if (mappedType.categoryId && byId.has(mappedType.categoryId)) {
      byId.get(mappedType.categoryId)!.certificationTypes.push(mappedType);
      continue;
    }

    const fallbackName = (t.certCategory?.name ?? t.category ?? "").trim();
    if (!fallbackName) continue;
    const fallbackCategory = [...byId.values()].find((c) => c.name === fallbackName);
    if (fallbackCategory) {
      fallbackCategory.certificationTypes.push(mappedType);
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const governanceA = GOVERNANCE_CATEGORY_ORDER.indexOf(a.name as (typeof GOVERNANCE_CATEGORY_ORDER)[number]);
      const governanceB = GOVERNANCE_CATEGORY_ORDER.indexOf(b.name as (typeof GOVERNANCE_CATEGORY_ORDER)[number]);
      const fallbackA = governanceA >= 0 ? governanceA + 1 : 1000;
      const fallbackB = governanceB >= 0 ? governanceB + 1 : 1000;
      const effectiveA = a.sortOrder ?? fallbackA;
      const effectiveB = b.sortOrder ?? fallbackB;
      if (effectiveA !== effectiveB) return effectiveA - effectiveB;
      return a.name.localeCompare(b.name);
    })
    .map((category) => ({
      ...category,
      certificationTypes: category.certificationTypes.sort((x, y) => {
        const sx = x.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const sy = y.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (sx !== sy) return sx - sy;
        return x.name.localeCompare(y.name);
      }),
    }));
}

export default function CertificationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [categories, setCategories] = useState<CertificationCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCertification, setSelectedCertification] = useState<CertificationTypeItem | null>(null);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeCreateMode, setTypeCreateMode] = useState(false);
  const [typeEditMode, setTypeEditMode] = useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeFormError, setTypeFormError] = useState<string | null>(null);
  const [typeFormState, setTypeFormState] = useState<TypeFormState>({
    code: "",
    name: "",
    categoryId: "",
    description: "",
    requiresExpiration: false,
    requiresState: false,
    requiresLicenseNumber: false,
    sortOrder: "",
    isMW4HTrainableDefault: false,
    isActive: true,
  });

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryCreateMode, setCategoryCreateMode] = useState(false);
  const [categoryEditMode, setCategoryEditMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CertificationCategory | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [categoryFormState, setCategoryFormState] = useState<CategoryFormState>({
    name: "",
    sortOrder: "",
    isActive: true,
  });

  const loadCatalog = async (preserveExpanded = false) => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const token = window.localStorage.getItem("jp_accessToken");
      if (!token) throw new Error("Missing access token.");

      const [catsRes, typesRes] = await Promise.all([
        fetch("/api/certification-categories", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch("/api/certification-types", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      if (!catsRes.ok) {
        const text = await catsRes.text();
        throw new Error(`Failed to load certification categories: ${catsRes.status} ${catsRes.statusText}${text ? ` - ${text}` : ""}`);
      }
      if (!typesRes.ok) {
        const text = await typesRes.text();
        throw new Error(`Failed to load certification types: ${typesRes.status} ${typesRes.statusText}${text ? ` - ${text}` : ""}`);
      }

      const categoriesData = (await catsRes.json()) as ApiCertificationCategory[];
      const typesData = (await typesRes.json()) as ApiCertificationType[];
      const nextCategories = mapCategoriesAndTypes(categoriesData, typesData);
      setCategories(nextCategories);
      setExpandedCategories((prev) =>
        preserveExpanded && prev.size > 0 ? prev : new Set(nextCategories.map((category) => category.id)),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load certification catalog.";
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
  }, []);

  const filteredCategories = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        certificationTypes: category.certificationTypes.filter((certType) => {
          if (statusFilter === "Active Only" && certType.status !== "Active") return false;
          if (statusFilter === "Inactive Only" && certType.status !== "Inactive") return false;
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return certType.name.toLowerCase().includes(query) || certType.code.toLowerCase().includes(query);
        }),
      })),
    [categories, statusFilter, searchQuery],
  );

  const totalTypes = filteredCategories.reduce((sum, c) => sum + c.certificationTypes.length, 0);
  const categoryOptions = useMemo(() => categories.filter((category) => !category.id.startsWith("governance-")), [categories]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const openTypeCreate = (category: CertificationCategory) => {
    if (category.id.startsWith("governance-")) {
      setErrorState(`Cannot create in ${category.name} yet: category id is not persisted.`);
      return;
    }

    setSelectedCategoryId(category.id);
    setSelectedCertification(null);
    setTypeCreateMode(true);
    setTypeEditMode(false);
    setTypeFormError(null);
    setTypeFormState({
      code: "",
      name: "",
      categoryId: category.id,
      description: "",
      requiresExpiration: false,
      requiresState: false,
      requiresLicenseNumber: false,
      sortOrder: "",
      isMW4HTrainableDefault: false,
      isActive: true,
    });
    setTypeModalOpen(true);
  };

  const openTypeEdit = (certification: CertificationTypeItem) => {
    setSelectedCategoryId(certification.categoryId ?? "");
    setSelectedCertification(certification);
    setTypeCreateMode(false);
    setTypeEditMode(true);
    setTypeFormError(null);
    setTypeFormState({
      id: certification.id,
      code: certification.code,
      name: certification.name,
      categoryId: certification.categoryId ?? "",
      description: certification.description,
      requiresExpiration: certification.requiresExpiration,
      requiresState: certification.requiresState,
      requiresLicenseNumber: certification.requiresLicenseNumber,
      sortOrder: certification.sortOrder == null ? "" : String(certification.sortOrder),
      isMW4HTrainableDefault: certification.isMW4HTrainableDefault,
      isActive: certification.isActive,
    });
    setTypeModalOpen(true);
  };

  const saveType = async () => {
    const token = window.localStorage.getItem("jp_accessToken");
    if (!token) {
      setTypeFormError("Missing access token.");
      return;
    }

    const code = typeFormState.code.trim();
    const name = typeFormState.name.trim();
    const categoryId = typeFormState.categoryId.trim();
    if (!code || !name || !categoryId) {
      setTypeFormError("Code, Name, and Category are required.");
      return;
    }

    let sortOrder: number | undefined;
    const rawSortOrder = typeFormState.sortOrder.trim();
    if (rawSortOrder) {
      const parsed = Number(rawSortOrder);
      if (!Number.isInteger(parsed)) {
        setTypeFormError("Sort Order must be a whole number.");
        return;
      }
      sortOrder = parsed;
    }

    const payload: Record<string, unknown> = {
      code,
      name,
      categoryId,
      description: typeFormState.description.trim() || undefined,
      requiresExpiration: typeFormState.requiresExpiration,
      requiresState: typeFormState.requiresState,
      requiresLicenseNumber: typeFormState.requiresLicenseNumber,
      isMW4HTrainableDefault: typeFormState.isMW4HTrainableDefault,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };

    let method: "POST" | "PATCH" = "POST";
    let url = "/api/certification-types";
    if (typeEditMode) {
      if (!typeFormState.id) {
        setTypeFormError("Missing certification id for edit.");
        return;
      }
      method = "PATCH";
      url = `/api/certification-types?id=${encodeURIComponent(typeFormState.id)}`;
      payload.id = typeFormState.id;
      payload.isActive = typeFormState.isActive;
    }

    setTypeSaving(true);
    setTypeFormError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Save failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
      }

      setTypeModalOpen(false);
      await loadCatalog(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save certification type.";
      setTypeFormError(message);
    } finally {
      setTypeSaving(false);
    }
  };

  const openCategoryCreate = () => {
    setSelectedCategory(null);
    setCategoryCreateMode(true);
    setCategoryEditMode(false);
    setCategoryFormError(null);
    setCategoryFormState({
      name: "",
      sortOrder: "",
      isActive: true,
    });
    setCategoryModalOpen(true);
  };

  const openCategoryEdit = (category: CertificationCategory) => {
    if (category.id.startsWith("governance-")) {
      setErrorState(`Cannot edit ${category.name} yet: category id is not persisted.`);
      return;
    }
    setSelectedCategory(category);
    setCategoryCreateMode(false);
    setCategoryEditMode(true);
    setCategoryFormError(null);
    setCategoryFormState({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder == null ? "" : String(category.sortOrder),
      isActive: category.isActive,
    });
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    const token = window.localStorage.getItem("jp_accessToken");
    if (!token) {
      setCategoryFormError("Missing access token.");
      return;
    }

    const name = categoryFormState.name.trim();
    if (!name) {
      setCategoryFormError("Name is required.");
      return;
    }

    let sortOrder: number | undefined;
    const rawSortOrder = categoryFormState.sortOrder.trim();
    if (rawSortOrder) {
      const parsed = Number(rawSortOrder);
      if (!Number.isInteger(parsed)) {
        setCategoryFormError("Sort Order must be a whole number.");
        return;
      }
      sortOrder = parsed;
    }

    const payload: Record<string, unknown> = {
      name,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      isActive: categoryFormState.isActive,
    };

    let method: "POST" | "PATCH" = "POST";
    let url = "/api/certification-categories";
    if (categoryEditMode) {
      if (!categoryFormState.id) {
        setCategoryFormError("Missing category id for edit.");
        return;
      }
      method = "PATCH";
      url = `/api/certification-categories/${encodeURIComponent(categoryFormState.id)}`;
    }

    setCategorySaving(true);
    setCategoryFormError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Save failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
      }

      setCategoryModalOpen(false);
      await loadCatalog(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save category.";
      setCategoryFormError(message);
    } finally {
      setCategorySaving(false);
    }
  };

  return (
    <div className="certifications-container">
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Certifications</h1>
          <p className="subtitle">Admin catalog of certification categories and certification types used across Jarvis Prime.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-add-category" onClick={openCategoryCreate}>
            + Add Category
          </button>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All</option>
            <option value="Active Only">Active Only</option>
            <option value="Inactive Only">Inactive Only</option>
          </select>
        </div>
        <div className="filter-group search-group">
          <label htmlFor="searchInput">Search Certification Type</label>
          <input
            id="searchInput"
            type="text"
            placeholder="Certification Type name or code..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="filter-results">
          {filteredCategories.length} categor{filteredCategories.length !== 1 ? "ies" : "y"}, {totalTypes} certification type
          {totalTypes !== 1 ? "s" : ""}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading certification catalog...</div>
      ) : errorState ? (
        <div className="error-state">{errorState}</div>
      ) : (
        <div className="categories-section">
          {filteredCategories.map((category) => {
            const isExpanded = expandedCategories.has(category.id);
            const visibleTypes = category.certificationTypes;

            return (
              <div key={category.id} className="category-accordion">
                <div className="category-header-row">
                  <button type="button" className="category-toggle" onClick={() => toggleCategory(category.id)}>
                    <span className={`chevron ${isExpanded ? "chevron--open" : ""}`}>▶</span>
                    <span className="category-name">{category.name}</span>
                    <span className="type-count">
                      {visibleTypes.length} certification type{visibleTypes.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn-edit-category"
                    onClick={() => openCategoryEdit(category)}
                    aria-label={`Edit Category ${category.name}`}
                  >
                    Edit Category
                  </button>

                  <button
                    type="button"
                    className="btn-add-certification"
                    onClick={() => openTypeCreate(category)}
                    aria-label={`Add Certification Type to ${category.name}`}
                  >
                    + Add Certification
                  </button>
                </div>

                {isExpanded && (
                  <div className="category-body">
                    {visibleTypes.length > 0 ? (
                      <div className="types-list">
                        {visibleTypes.map((certType) => (
                          <div key={certType.id} className="type-row">
                            <button type="button" className="type-link-button" onClick={() => openTypeEdit(certType)}>
                              <span className="type-name">{certType.name}</span>
                            </button>
                            <div className="type-row-right">
                              <span
                                className="status-badge"
                                style={{
                                  backgroundColor: getStatusStyle(certType.status).bg,
                                  color: getStatusStyle(certType.status).color,
                                  borderColor: getStatusStyle(certType.status).border,
                                }}
                              >
                                {certType.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-category">No certification types yet</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {typeModalOpen && (
        <div className="modal-overlay" onClick={() => !typeSaving && setTypeModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{typeCreateMode ? "Add Certification Type" : "Edit Certification Type"}</h2>
              <button type="button" className="modal-close" onClick={() => !typeSaving && setTypeModalOpen(false)} disabled={typeSaving}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="type-code">Code *</label>
                  <input
                    id="type-code"
                    type="text"
                    value={typeFormState.code}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, code: event.target.value }))}
                    disabled={typeSaving}
                    placeholder="OSHA10"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="type-name">Name *</label>
                  <input
                    id="type-name"
                    type="text"
                    value={typeFormState.name}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={typeSaving}
                    placeholder="OSHA 10-Hour"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="type-category">Category *</label>
                  <select
                    id="type-category"
                    value={typeFormState.categoryId}
                    onChange={(event) => {
                      setSelectedCategoryId(event.target.value);
                      setTypeFormState((prev) => ({ ...prev, categoryId: event.target.value }));
                    }}
                    disabled={typeSaving}
                  >
                    <option value="">Select Category</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="type-sortOrder">Sort Order</label>
                  <input
                    id="type-sortOrder"
                    type="number"
                    step="1"
                    value={typeFormState.sortOrder}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, sortOrder: event.target.value }))}
                    disabled={typeSaving}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="type-description">Description</label>
                <textarea
                  id="type-description"
                  rows={3}
                  value={typeFormState.description}
                  onChange={(event) => setTypeFormState((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={typeSaving}
                  placeholder="Optional"
                />
              </div>

              <div className="toggle-grid">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={typeFormState.requiresExpiration}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, requiresExpiration: event.target.checked }))}
                    disabled={typeSaving}
                  />
                  requiresExpiration
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={typeFormState.requiresState}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, requiresState: event.target.checked }))}
                    disabled={typeSaving}
                  />
                  requiresState
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={typeFormState.requiresLicenseNumber}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, requiresLicenseNumber: event.target.checked }))}
                    disabled={typeSaving}
                  />
                  requiresLicenseNumber
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={typeFormState.isMW4HTrainableDefault}
                    onChange={(event) => setTypeFormState((prev) => ({ ...prev, isMW4HTrainableDefault: event.target.checked }))}
                    disabled={typeSaving}
                  />
                  isMW4HTrainableDefault
                </label>
                {typeEditMode && (
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={typeFormState.isActive}
                      onChange={(event) => setTypeFormState((prev) => ({ ...prev, isActive: event.target.checked }))}
                      disabled={typeSaving}
                    />
                    isActive
                  </label>
                )}
              </div>

              {typeFormError && <div className="form-error">{typeFormError}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => !typeSaving && setTypeModalOpen(false)} disabled={typeSaving}>
                Cancel
              </button>
              <button type="button" className="btn-save" onClick={saveType} disabled={typeSaving}>
                {typeSaving ? "Saving..." : typeCreateMode ? "Create Certification Type" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryModalOpen && (
        <div className="modal-overlay" onClick={() => !categorySaving && setCategoryModalOpen(false)}>
          <div className="modal modal--small" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{categoryCreateMode ? "Add Category" : "Edit Category"}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !categorySaving && setCategoryModalOpen(false)}
                disabled={categorySaving}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid form-grid--single">
                <div className="form-field">
                  <label htmlFor="category-name">Name *</label>
                  <input
                    id="category-name"
                    type="text"
                    value={categoryFormState.name}
                    onChange={(event) => setCategoryFormState((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={categorySaving}
                    placeholder="OSHA"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="category-sortOrder">Sort Order</label>
                  <input
                    id="category-sortOrder"
                    type="number"
                    step="1"
                    value={categoryFormState.sortOrder}
                    onChange={(event) => setCategoryFormState((prev) => ({ ...prev, sortOrder: event.target.value }))}
                    disabled={categorySaving}
                    placeholder="Optional"
                  />
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={categoryFormState.isActive}
                    onChange={(event) => setCategoryFormState((prev) => ({ ...prev, isActive: event.target.checked }))}
                    disabled={categorySaving}
                  />
                  isActive
                </label>
              </div>

              {categoryFormError && <div className="form-error">{categoryFormError}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => !categorySaving && setCategoryModalOpen(false)}
                disabled={categorySaving}
              >
                Cancel
              </button>
              <button type="button" className="btn-save" onClick={saveCategory} disabled={categorySaving}>
                {categorySaving ? "Saving..." : categoryCreateMode ? "Create Category" : "Save Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .certifications-container {
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
          min-width: 240px;
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
        }
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
        .type-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-left: auto;
        }
        .btn-edit-category,
        .btn-add-certification {
          flex-shrink: 0;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-edit-category {
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          margin-right: 8px;
        }
        .btn-add-certification {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          margin-right: 16px;
        }
        .category-body {
          padding: 16px 20px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .types-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .type-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .type-row:last-child {
          border-bottom: none;
        }
        .type-link-button {
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
          cursor: pointer;
          text-align: left;
        }
        .type-name {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          text-decoration: underline;
          text-decoration-color: rgba(255, 255, 255, 0.25);
          text-underline-offset: 3px;
        }
        .type-row-right {
          display: inline-flex;
          align-items: center;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          flex-shrink: 0;
        }
        .empty-category {
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          padding: 24px 16px;
          font-size: 13px;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
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
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          color: #fff;
        }
        .modal-close {
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          font-size: 22px;
          cursor: pointer;
        }
        .modal-body {
          padding: 18px 20px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
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
        .form-field input,
        .form-field select,
        .form-field textarea {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 6px;
          color: #fff;
          padding: 9px 10px;
          font-size: 13px;
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
        }
        .form-error {
          margin-top: 4px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.09);
          color: #fecaca;
          font-size: 12px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-cancel {
          padding: 8px 14px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
        }
        .btn-save {
          padding: 8px 14px;
          border-radius: 6px;
          border: none;
          background: #3b82f6;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-cancel:disabled,
        .btn-save:disabled,
        .modal-close:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
