"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import {
  StatusBadge,
  positionStatusTone,
} from "@/components/careers/StatusBadge";
import { PositionFormModal } from "@/components/careers/PositionFormModal";
import { ConfirmDialog } from "@/components/careers/ConfirmDialog";
import { useDebouncedValue } from "@/components/careers/useDebouncedValue";
import { formatDate } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  Position,
  activatePosition,
  deactivatePosition,
  listPositions,
} from "@/lib/careers/positionsApi";

type StatusFilter = "all" | "active" | "inactive";
type SortKey = "title" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100];
const FETCH_LIMIT = 200;

export default function CareersPositionsPage() {
  const router = useRouter();

  const [positions, setPositions] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Position | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<Position | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPositions({ limit: FETCH_LIMIT, offset: 0 });
      setPositions(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load positions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to first page whenever the filter/sort inputs change.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortBy, sortOrder, pageSize]);

  const filtered = useMemo(() => {
    let list = positions;
    if (statusFilter === "active") list = list.filter((p) => p.isActive);
    else if (statusFilter === "inactive")
      list = list.filter((p) => !p.isActive);

    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.department ?? "").toLowerCase().includes(q),
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp: number;
      if (sortBy === "title") {
        cmp = a.title.localeCompare(b.title);
      } else {
        cmp =
          new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [positions, statusFilter, debouncedSearch, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const openCreate = () => {
    setModalMode("create");
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (p: Position) => {
    setModalMode("edit");
    setEditing(p);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const handleActivate = async (p: Position) => {
    setRowBusyId(p.id);
    setError(null);
    try {
      await activatePosition(p.id);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to activate position."));
    } finally {
      setRowBusyId(null);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await deactivatePosition(confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } catch (e) {
      setConfirmError(getApiErrorMessage(e, "Failed to deactivate position."));
    } finally {
      setConfirmBusy(false);
    }
  };

  const truncated = total > positions.length;

  return (
    <CareersShell
      title="Positions"
      subtitle="Internal role catalog"
      actions={
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New Position
        </button>
      }
    >
      {/* Toolbar / controls */}
      <div className="controls-row">
        <input
          type="search"
          className="control-search"
          placeholder="Search title or department…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="control-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Status filter"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="control-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="title">Title</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Last Updated</option>
        </select>
        <select
          className="control-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          aria-label="Sort order"
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
        <select
          className="control-select"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          aria-label="Page size"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
        <span className="control-count">
          {loading
            ? "Loading\u2026"
            : `${filtered.length} position${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {error ? (
        <div className="state-error">
          {error}
          <button type="button" className="retry-btn" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {truncated ? (
        <div className="state-note">
          Showing the first {positions.length} of {total} positions. Refine your
          search to narrow results.
        </div>
      ) : null}

      {/* Table */}
      <div className="table-wrap">
        <table className="careers-table">
          <thead>
            <tr>
              <th>Position Title</th>
              <th>Department</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Created</th>
              <th>Last Updated</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="empty-row">
                  Loading positions…
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-row">
                  {positions.length === 0
                    ? "No positions yet. Click \u201c+ New Position\u201d to create the first internal role."
                    : "No positions match your search / filters."}
                </td>
              </tr>
            ) : (
              pageItems.map((p) => (
                <tr
                  key={p.id}
                  className="data-row"
                  onClick={() => router.push(`/careers/positions/${p.id}`)}
                >
                  <td>
                    <span className="cell-title">{p.title}</span>
                  </td>
                  <td>{p.department ?? "\u2014"}</td>
                  <td>
                    <StatusBadge
                      label={p.isActive ? "Active" : "Inactive"}
                      tone={positionStatusTone(p.isActive)}
                    />
                  </td>
                  <td>
                    {p.createdByUserId ? (
                      <span
                        className="cell-muted"
                        title={p.createdByUserId}
                      >
                        {p.createdByUserId.slice(0, 8)}
                      </span>
                    ) : (
                      "\u2014"
                    )}
                  </td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{formatDate(p.updatedAt)}</td>
                  <td
                    className="col-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="link-action"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                    {p.isActive ? (
                      <button
                        type="button"
                        className="link-action link-danger"
                        disabled={rowBusyId === p.id}
                        onClick={() => {
                          setConfirmError(null);
                          setConfirmTarget(p);
                        }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="link-action"
                        disabled={rowBusyId === p.id}
                        onClick={() => handleActivate(p)}
                      >
                        {rowBusyId === p.id ? "Working\u2026" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 ? (
        <div className="pagination-row">
          <button
            type="button"
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </button>
          <span className="page-display">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      ) : null}

      <PositionFormModal
        open={modalOpen}
        mode={modalMode}
        position={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Deactivate position"
        tone="danger"
        confirmLabel="Deactivate"
        busy={confirmBusy}
        error={confirmError}
        message={
          <>
            Deactivate <strong>{confirmTarget?.title}</strong>? It will be hidden
            from active role selection but preserved for history. You can
            reactivate it later.
          </>
        }
        onConfirm={handleConfirmDeactivate}
        onCancel={() => {
          if (!confirmBusy) setConfirmTarget(null);
        }}
      />

      <style jsx>{`
        .btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 7px;
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }
        .controls-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 14px 16px;
          margin-bottom: 14px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }
        .control-search {
          flex: 1 1 260px;
          min-width: 200px;
          height: 36px;
          padding: 8px 11px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
        }
        .control-search:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
        .control-select {
          height: 36px;
          padding: 0 10px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          cursor: pointer;
        }
        .control-count {
          margin-left: auto;
          font-size: 12.5px;
          color: #6b7280;
        }
        .state-error {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 13px;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .retry-btn {
          background: #ffffff;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .state-note {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 12.5px;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }
        .table-wrap {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow-x: auto;
        }
        .careers-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 860px;
        }
        .careers-table thead th {
          text-align: left;
          background: #f1f5f9;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          border-bottom: 1px solid #d1d5db;
          white-space: nowrap;
        }
        .careers-table tbody td {
          font-size: 13px;
          color: #111827;
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .data-row {
          cursor: pointer;
        }
        .data-row:hover td {
          background: #f9fafb;
        }
        .cell-title {
          font-weight: 600;
          color: #111827;
        }
        .cell-muted {
          font-size: 12px;
          color: #6b7280;
          font-family: var(--font-geist-mono, monospace);
        }
        .col-actions {
          text-align: right;
          white-space: nowrap;
        }
        .link-action {
          background: transparent;
          border: none;
          color: #2563eb;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 2px 6px;
        }
        .link-action:hover:not(:disabled) {
          text-decoration: underline;
        }
        .link-action:disabled {
          color: #9ca3af;
          cursor: not-allowed;
        }
        .link-danger {
          color: #dc2626;
        }
        .empty-row {
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          padding: 40px 12px;
        }
        .pagination-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
        }
        .page-btn {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
        }
        .page-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .page-display {
          font-size: 12.5px;
          color: #6b7280;
        }
      `}</style>
    </CareersShell>
  );
}
