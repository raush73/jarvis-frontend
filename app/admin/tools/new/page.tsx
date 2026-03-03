"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Category = { id: string; name: string };

export default function AddToolPage() {
  return (
    <Suspense fallback={null}>
      <NewToolFormInner />
    </Suspense>
  );
}

function NewToolFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCategoryId = searchParams.get("categoryId") || "";

  const [categories, setCategories] = useState<Category[]>([]);

  const [categoryName, setCategoryName] = useState("");
  const [categoryStatus, setCategoryStatus] = useState<"Active" | "Inactive">("Active");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [categorySaved, setCategorySaved] = useState(false);

  const [toolName, setToolName] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [toolCategory, setToolCategory] = useState(preselectedCategoryId);
  const [toolSaving, setToolSaving] = useState(false);
  const [toolError, setToolError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      const token = window.localStorage.getItem("jp_accessToken");
      if (!token) return;

      const res = await fetch("/api/tool-categories", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const cats = await res.json();
        setCategories(cats ?? []);
      }
    }

    loadCategories();
  }, []);

  const canSaveCategory = categoryName.trim() !== "";
  const canSaveTool = toolName.trim() !== "" && toolCategory !== "";

  async function handleSaveCategory() {
    if (!canSaveCategory || categorySaving) return;
    setCategorySaving(true);
    setCategoryError("");

    const token = window.localStorage.getItem("jp_accessToken");
    if (!token) { setCategorySaving(false); return; }

    const res = await fetch("/api/tool-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: categoryName.trim(),
      }),
    });

    if (!res.ok) {
      setCategoryError("Failed to save category.");
      setCategorySaving(false);
      return;
    }

    const created = await res.json();
    setCategories((prev) => [...prev, { id: created.id, name: created.name }].sort((a, b) => a.name.localeCompare(b.name)));
    setCategorySaved(true);
    setCategoryName("");
    setCategorySaving(false);
    setTimeout(() => setCategorySaved(false), 3000);
  }

  async function handleSaveTool() {
    if (!canSaveTool || toolSaving) return;
    setToolSaving(true);
    setToolError("");

    const token = window.localStorage.getItem("jp_accessToken");
    if (!token) { setToolSaving(false); return; }

    const res = await fetch("/api/tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: toolName.trim(),
        categoryId: toolCategory,
        description: toolDescription.trim() || undefined,
      }),
    });

    if (!res.ok) {
      setToolError("Failed to save tool.");
      setToolSaving(false);
      return;
    }

    router.push("/admin/tools");
  }

  return (
    <div className="add-tool-container">
      <div className="page-header">
        <Link href="/admin/tools" className="back-link">
          ← Back to Tool Catalog
        </Link>
        <h1>Add Category / Tool</h1>
        <p className="subtitle">
          Create a new category or add a tool to an existing category.
        </p>
      </div>

      {/* Add Category Section */}
      <div className="form-section">
        <h2 className="section-title">Add Category</h2>
        {categoryError && <div className="error-banner">{categoryError}</div>}
        <div className="form-grid">
          <div className="form-row full-width">
            <label className="form-label">
              Category Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g., Welding Equipment"
            />
          </div>

          <div className="form-row full-width">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={categoryStatus}
              onChange={(e) => setCategoryStatus(e.target.value as "Active" | "Inactive")}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="section-actions">
          {categorySaved && (
            <span className="saved-text">Category created!</span>
          )}
          <button
            type="button"
            className="save-btn"
            onClick={handleSaveCategory}
            disabled={!canSaveCategory || categorySaving}
          >
            {categorySaving ? "Saving…" : "Save Category"}
          </button>
        </div>
      </div>

      {/* Add Tool Section */}
      <div className="form-section">
        <h2 className="section-title">Add Tool</h2>
        {toolError && <div className="error-banner">{toolError}</div>}
        <div className="form-grid">
          <div className="form-row full-width">
            <label className="form-label">
              Tool Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="e.g., Torque Wrench 3/8 inch"
            />
          </div>

          <div className="form-row full-width">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={toolDescription}
              onChange={(e) => setToolDescription(e.target.value)}
              placeholder="Optional description of the tool..."
              rows={3}
            />
          </div>

          <div className="form-row full-width">
            <label className="form-label">
              Category <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={toolCategory}
              onChange={(e) => setToolCategory(e.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="section-actions">
          <button
            type="button"
            className="save-btn"
            onClick={handleSaveTool}
            disabled={!canSaveTool || toolSaving}
          >
            {toolSaving ? "Saving…" : "Save Tool"}
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="form-actions">
        <div className="action-buttons">
          <button
            type="button"
            className="cancel-btn"
            onClick={() => router.push("/admin/tools")}
          >
            Cancel
          </button>
        </div>
      </div>

      <style jsx>{`
        .add-tool-container {
          padding: 24px 40px 60px;
          max-width: 800px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 28px;
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
        }

        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .error-banner {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          color: #ef4444;
          margin-bottom: 16px;
        }

        .form-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-row.full-width {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .required {
          color: #ef4444;
        }

        .form-input,
        .form-textarea,
        .form-select {
          padding: 10px 12px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          transition: border-color 0.15s ease;
        }

        .form-input:focus,
        .form-textarea:focus,
        .form-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-select option {
          background: #1a1d24;
          color: #fff;
        }

        .section-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .saved-text {
          font-size: 12px;
          color: #22c55e;
          font-style: italic;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .cancel-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cancel-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .save-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .save-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}


