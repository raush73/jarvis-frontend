"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { ApplicantFormModal } from "@/components/careers/ApplicantFormModal";
import { useDebouncedValue } from "@/components/careers/useDebouncedValue";
import { formatDate } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  Applicant,
  applicantName,
  listApplicants,
} from "@/lib/careers/applicantsApi";

type SortKey = "name" | "email" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100];
const FETCH_LIMIT = 200;

export default function CareersApplicantsPage() {
  const router = useRouter();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Applicant | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listApplicants({ limit: FETCH_LIMIT, offset: 0 });
      setApplicants(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load applicants."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortOrder, pageSize]);

  const filtered = useMemo(() => {
    let list = applicants;

    // Multi-field search: Name, Email, Phone, City, State (client-side; the
    // backend `q` covers only name/email/phone, so city/state are matched here).
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const haystack = [
          applicantName(a),
          a.firstName ?? "",
          a.lastName ?? "",
          a.email ?? "",
          a.phone ?? "",
          a.city ?? "",
          a.state ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    const sorted = [...list].sort((a, b) => {
      let cmp: number;
      if (sortBy === "name") {
        cmp = applicantName(a).localeCompare(applicantName(b));
      } else if (sortBy === "email") {
        cmp = (a.email ?? "").localeCompare(b.email ?? "");
      } else {
        cmp = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [applicants, debouncedSearch, sortBy, sortOrder]);

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

  const openEdit = (a: Applicant) => {
    setModalMode("edit");
    setEditing(a);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const truncated = total > applicants.length;

  return (
    <CareersShell
      title="Applicants"
      subtitle="Internal hiring applicant directory"
      actions={
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New Applicant
        </button>
      }
    >
      <div className="controls-row">
        <input
          type="search"
          className="control-search"
          placeholder="Search name, email, phone, city, or state…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="control-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="createdAt">Created</option>
          <option value="name">Name</option>
          <option value="email">Email</option>
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
            : `${filtered.length} applicant${filtered.length === 1 ? "" : "s"}`}
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
          Showing the first {applicants.length} of {total} applicants. Refine
          your search to narrow results.
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="careers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
              <th>State</th>
              <th>Created</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="empty-row">
                  Loading applicants…
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-row">
                  {applicants.length === 0
                    ? "No applicants yet. Click \u201c+ New Applicant\u201d to add the first one."
                    : "No applicants match your search."}
                </td>
              </tr>
            ) : (
              pageItems.map((a) => (
                <tr
                  key={a.id}
                  className="data-row"
                  onClick={() => router.push(`/careers/applicants/${a.id}`)}
                >
                  <td>
                    <span className="cell-title">{applicantName(a)}</span>
                  </td>
                  <td>{a.email}</td>
                  <td>{a.phone ?? "\u2014"}</td>
                  <td>{a.city ?? "\u2014"}</td>
                  <td>{a.state ?? "\u2014"}</td>
                  <td>{formatDate(a.createdAt)}</td>
                  <td
                    className="col-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="link-action"
                      onClick={() => openEdit(a)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

      <ApplicantFormModal
        open={modalOpen}
        mode={modalMode}
        applicant={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
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
