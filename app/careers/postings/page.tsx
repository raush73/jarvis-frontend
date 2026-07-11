"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { StatusBadge } from "@/components/careers/StatusBadge";
import { JobPostingFormModal } from "@/components/careers/JobPostingFormModal";
import { ConfirmDialog } from "@/components/careers/ConfirmDialog";
import { useDebouncedValue } from "@/components/careers/useDebouncedValue";
import { useStaffDirectory } from "@/components/careers/useStaffDirectory";
import { formatDate } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { staffLabel } from "@/lib/careers/staffApi";
import {
  JobPosting,
  POSTING_STATUSES,
  POSTING_STATUS_LABELS,
  PostingStatus,
  PostingVisibility,
  VISIBILITIES,
  VISIBILITY_LABELS,
  archiveJobPosting,
  closeJobPosting,
  employmentTypeLabel,
  fillJobPosting,
  listJobPostings,
  pauseJobPosting,
  postingStatusTone,
  postingTitle,
  publishJobPosting,
} from "@/lib/careers/jobPostingsApi";

type StatusFilter = "all" | PostingStatus;
type VisibilityFilter = "all" | PostingVisibility;
type SortKey = "title" | "createdAt" | "publishedAt" | "updatedAt";
type SortOrder = "asc" | "desc";
type LifecycleAction = "publish" | "pause" | "fill" | "close" | "archive";

const PAGE_SIZES = [25, 50, 100];
const FETCH_LIMIT = 200;

export default function CareersPostingsPage() {
  const router = useRouter();
  const { byId: staffById } = useStaffDirectory();

  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<JobPosting | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<{
    posting: JobPosting;
    action: LifecycleAction;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listJobPostings({ limit: FETCH_LIMIT, offset: 0 });
      setPostings(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load job postings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    statusFilter,
    visibilityFilter,
    sortBy,
    sortOrder,
    pageSize,
  ]);

  const managerLabel = useCallback(
    (p: JobPosting): string => {
      if (!p.hiringManagerUserId) return "\u2014";
      const user = staffById.get(p.hiringManagerUserId);
      return user ? staffLabel(user) : p.hiringManagerUserId.slice(0, 8);
    },
    [staffById],
  );

  const filtered = useMemo(() => {
    let list = postings;
    if (statusFilter !== "all")
      list = list.filter((p) => p.status === statusFilter);
    if (visibilityFilter !== "all")
      list = list.filter((p) => p.visibility === visibilityFilter);

    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          postingTitle(p).toLowerCase().includes(q) ||
          (p.position?.title ?? "").toLowerCase().includes(q) ||
          (p.location ?? "").toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q),
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp: number;
      if (sortBy === "title") {
        cmp = postingTitle(a).localeCompare(postingTitle(b));
      } else {
        const av = a[sortBy] ? new Date(a[sortBy] as string).getTime() : 0;
        const bv = b[sortBy] ? new Date(b[sortBy] as string).getTime() : 0;
        cmp = av - bv;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [postings, statusFilter, visibilityFilter, debouncedSearch, sortBy, sortOrder]);

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

  const openEdit = (p: JobPosting) => {
    setModalMode("edit");
    setEditing(p);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const handleConfirmLifecycle = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const id = confirmTarget.posting.id;
      const action: Record<LifecycleAction, () => Promise<unknown>> = {
        publish: () => publishJobPosting(id),
        pause: () => pauseJobPosting(id),
        fill: () => fillJobPosting(id),
        close: () => closeJobPosting(id),
        archive: () => archiveJobPosting(id),
      };
      await action[confirmTarget.action]();
      setConfirmTarget(null);
      await load();
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, `Failed to ${confirmTarget.action} posting.`),
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  const truncated = total > postings.length;

  return (
    <CareersShell
      title="Job Postings"
      subtitle="Internal hiring events"
      actions={
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New Job Posting
        </button>
      }
    >
      <div className="controls-row">
        <input
          type="search"
          className="control-search"
          placeholder="Search title, position, or location…"
          aria-label="Search job postings"
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
          {POSTING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {POSTING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="control-select"
          value={visibilityFilter}
          onChange={(e) =>
            setVisibilityFilter(e.target.value as VisibilityFilter)
          }
          aria-label="Visibility filter"
        >
          <option value="all">All visibility</option>
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {VISIBILITY_LABELS[v]}
            </option>
          ))}
        </select>
        <select
          className="control-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="createdAt">Created</option>
          <option value="publishedAt">Published</option>
          <option value="title">Title</option>
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
            : `${filtered.length} posting${filtered.length === 1 ? "" : "s"}`}
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
          Showing the first {postings.length} of {total} postings. Refine your
          search to narrow results.
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="careers-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Position</th>
              <th>Location</th>
              <th>Type</th>
              <th>Status</th>
              <th>Hiring Manager</th>
              <th>Published</th>
              <th>Closing</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  Loading job postings…
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  {postings.length === 0
                    ? "No job postings yet. Click \u201c+ New Job Posting\u201d to create the first one."
                    : "No postings match your search / filters."}
                </td>
              </tr>
            ) : (
              pageItems.map((p) => (
                <tr
                  key={p.id}
                  className="data-row"
                  onClick={() => router.push(`/careers/postings/${p.id}`)}
                >
                  <td>
                    <Link
                      href={`/careers/postings/${p.id}`}
                      className="cell-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {postingTitle(p)}
                    </Link>
                    {p.visibility === "PUBLIC" ? (
                      <span className="cell-tag">Public</span>
                    ) : null}
                  </td>
                  <td>{p.position?.title ?? "\u2014"}</td>
                  <td>{p.location ?? "\u2014"}</td>
                  <td>{employmentTypeLabel(p.employmentType)}</td>
                  <td>
                    <StatusBadge
                      label={POSTING_STATUS_LABELS[p.status]}
                      tone={postingStatusTone(p.status)}
                    />
                  </td>
                  <td>{managerLabel(p)}</td>
                  <td>{formatDate(p.publishedAt)}</td>
                  <td>{formatDate(p.closedAt)}</td>
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
                    {p.status === "DRAFT" || p.status === "PAUSED" ? (
                      <button
                        type="button"
                        className="link-action"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirmTarget({ posting: p, action: "publish" });
                        }}
                      >
                        {p.status === "PAUSED" ? "Republish" : "Publish"}
                      </button>
                    ) : null}
                    {p.status === "PUBLISHED" ? (
                      <>
                        <button
                          type="button"
                          className="link-action"
                          onClick={() => {
                            setConfirmError(null);
                            setConfirmTarget({ posting: p, action: "pause" });
                          }}
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          className="link-action"
                          onClick={() => {
                            setConfirmError(null);
                            setConfirmTarget({ posting: p, action: "fill" });
                          }}
                        >
                          Mark Filled
                        </button>
                      </>
                    ) : null}
                    {p.status === "DRAFT" ||
                    p.status === "PUBLISHED" ||
                    p.status === "PAUSED" ||
                    p.status === "FILLED" ? (
                      <button
                        type="button"
                        className="link-action link-danger"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirmTarget({ posting: p, action: "close" });
                        }}
                      >
                        Close
                      </button>
                    ) : null}
                    {p.status === "FILLED" || p.status === "CLOSED" ? (
                      <button
                        type="button"
                        className="link-action"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirmTarget({ posting: p, action: "archive" });
                        }}
                      >
                        Archive
                      </button>
                    ) : null}
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

      <JobPostingFormModal
        open={modalOpen}
        mode={modalMode}
        posting={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget?.action === "publish"
            ? confirmTarget?.posting.status === "PAUSED"
              ? "Republish posting"
              : "Publish posting"
            : confirmTarget?.action === "pause"
              ? "Pause posting"
              : confirmTarget?.action === "fill"
                ? "Mark posting as filled"
                : confirmTarget?.action === "archive"
                  ? "Archive posting"
                  : "Close posting"
        }
        tone={confirmTarget?.action === "close" ? "danger" : "primary"}
        confirmLabel={
          confirmTarget?.action === "publish"
            ? confirmTarget?.posting.status === "PAUSED"
              ? "Republish"
              : "Publish"
            : confirmTarget?.action === "pause"
              ? "Pause"
              : confirmTarget?.action === "fill"
                ? "Mark Filled"
                : confirmTarget?.action === "archive"
                  ? "Archive"
                  : "Close"
        }
        busy={confirmBusy}
        error={confirmError}
        message={
          !confirmTarget ? null : confirmTarget.action === "publish" ? (
            confirmTarget.posting.status === "PAUSED" ? (
              <>
                Republish{" "}
                <strong>{postingTitle(confirmTarget.posting)}</strong>? This
                returns the posting to the public careers site. Its permanent
                public application ID is unchanged.
              </>
            ) : (
              <>
                Publish{" "}
                <strong>{postingTitle(confirmTarget.posting)}</strong>? This
                activates the posting and assigns its permanent public
                application ID. The public ID never changes once assigned.
              </>
            )
          ) : confirmTarget.action === "pause" ? (
            <>
              Pause <strong>{postingTitle(confirmTarget.posting)}</strong>? This
              temporarily removes it from the public careers site. You can
              republish it later.
            </>
          ) : confirmTarget.action === "fill" ? (
            <>
              Mark <strong>{postingTitle(confirmTarget.posting)}</strong> as
              filled? The posting is no longer public but is retained and can
              still be closed or archived.
            </>
          ) : confirmTarget.action === "archive" ? (
            <>
              Archive <strong>{postingTitle(confirmTarget.posting)}</strong>? This
              retains it for historical reference only. This action is final.
            </>
          ) : (
            <>
              Close <strong>{postingTitle(confirmTarget.posting)}</strong>? A
              closed posting can no longer be published or reopened.
            </>
          )
        }
        onConfirm={handleConfirmLifecycle}
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
          min-width: 1040px;
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
        .cell-link {
          display: inline-block;
          font-weight: 600;
          color: #111827;
          text-decoration: none;
        }
        .cell-link:hover {
          color: #2563eb;
          text-decoration: underline;
        }
        .cell-tag {
          display: inline-block;
          margin-left: 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 1px 7px;
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
