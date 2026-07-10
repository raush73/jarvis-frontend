"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { StatusBadge } from "@/components/careers/StatusBadge";
import { useDebouncedValue } from "@/components/careers/useDebouncedValue";
import { formatDate } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { postingTitle } from "@/lib/careers/jobPostingsApi";
import {
  HIRING_PIPELINE_STAGES,
  HIRING_PIPELINE_STAGE_LABELS,
  HiringPipelineStage,
  ReviewDashboardItem,
  hiringPipelineStageTone,
  listReviewApplications,
} from "@/lib/careers/hiringReviewApi";

type StageFilter = "all" | HiringPipelineStage;
type ResumeFilter = "all" | "with" | "without";
type SortKey = "submitted" | "applicant" | "stage" | "completion";
type SortOrder = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100];
const FETCH_LIMIT = 200;

function itemName(a: ReviewDashboardItem): string {
  const full = [a.internalApplicant.firstName, a.internalApplicant.lastName]
    .filter((p) => p && p.trim())
    .join(" ")
    .trim();
  return full || a.internalApplicant.email || "(no name)";
}

export default function CareersReviewDashboardPage() {
  const router = useRouter();

  const [items, setItems] = useState<ReviewDashboardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [postingFilter, setPostingFilter] = useState<string>("all");
  const [resumeFilter, setResumeFilter] = useState<ResumeFilter>("all");
  const [veteranOnly, setVeteranOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("submitted");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listReviewApplications({ limit: FETCH_LIMIT, offset: 0 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load applications."));
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
    stageFilter,
    postingFilter,
    resumeFilter,
    veteranOnly,
    sortBy,
    sortOrder,
    pageSize,
  ]);

  const postingOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of items) {
      if (!map.has(a.jobPosting.id)) {
        map.set(a.jobPosting.id, postingTitle(a.jobPosting));
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (stageFilter !== "all")
      list = list.filter((a) => a.hiringPipelineStage === stageFilter);
    if (postingFilter !== "all")
      list = list.filter((a) => a.jobPosting.id === postingFilter);
    if (resumeFilter !== "all")
      list = list.filter((a) =>
        resumeFilter === "with" ? a.hasResume : !a.hasResume,
      );
    if (veteranOnly) list = list.filter((a) => a.isVeteran);

    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const haystack = [
          itemName(a),
          a.internalApplicant.email ?? "",
          postingTitle(a.jobPosting),
          HIRING_PIPELINE_STAGE_LABELS[a.hiringPipelineStage],
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    const submitted = (a: ReviewDashboardItem) =>
      new Date(a.submittedAt ?? a.createdAt).getTime();

    const sorted = [...list].sort((a, b) => {
      let cmp: number;
      if (sortBy === "applicant") {
        cmp = itemName(a).localeCompare(itemName(b));
      } else if (sortBy === "stage") {
        cmp = a.hiringPipelineStage.localeCompare(b.hiringPipelineStage);
      } else if (sortBy === "completion") {
        cmp = a.profileCompletionPercent - b.profileCompletionPercent;
      } else {
        cmp = submitted(a) - submitted(b);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [
    items,
    stageFilter,
    postingFilter,
    resumeFilter,
    veteranOnly,
    debouncedSearch,
    sortBy,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const truncated = total > items.length;

  return (
    <CareersShell
      title="Applicant Review"
      subtitle="Hiring manager review of submitted applications"
    >
      <div className="controls-row">
        <input
          type="search"
          className="control-search"
          placeholder="Search applicant, email, or position…"
          aria-label="Search applications"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="control-select"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as StageFilter)}
          aria-label="Status filter"
        >
          <option value="all">All statuses</option>
          {HIRING_PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {HIRING_PIPELINE_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="control-select"
          value={postingFilter}
          onChange={(e) => setPostingFilter(e.target.value)}
          aria-label="Position filter"
        >
          <option value="all">All positions</option>
          {postingOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="control-select"
          value={resumeFilter}
          onChange={(e) => setResumeFilter(e.target.value as ResumeFilter)}
          aria-label="Resume filter"
        >
          <option value="all">Any resume</option>
          <option value="with">Has resume</option>
          <option value="without">No resume</option>
        </select>
        <label className="control-check">
          <input
            type="checkbox"
            checked={veteranOnly}
            onChange={(e) => setVeteranOnly(e.target.checked)}
          />
          Veterans
        </label>
        <select
          className="control-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="submitted">Submitted</option>
          <option value="applicant">Applicant</option>
          <option value="stage">Status</option>
          <option value="completion">Completion</option>
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
            : `${filtered.length} application${filtered.length === 1 ? "" : "s"}`}
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
          Showing the first {items.length} of {total} applications. Refine your
          search to narrow results.
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="careers-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Position Applied For</th>
              <th>Submitted</th>
              <th>Status</th>
              <th className="center">Veteran</th>
              <th className="center">Resume</th>
              <th>Profile</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  Loading applications…
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  {items.length === 0
                    ? "No submitted applications yet."
                    : "No applications match your search / filters."}
                </td>
              </tr>
            ) : (
              pageItems.map((a) => (
                <tr
                  key={a.id}
                  className="data-row"
                  onClick={() => router.push(`/careers/review/${a.id}`)}
                >
                  <td>
                    <Link
                      href={`/careers/review/${a.id}`}
                      className="cell-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {itemName(a)}
                    </Link>
                    <span className="cell-sub">{a.internalApplicant.email}</span>
                  </td>
                  <td>{postingTitle(a.jobPosting)}</td>
                  <td>{formatDate(a.submittedAt ?? a.createdAt)}</td>
                  <td>
                    <StatusBadge
                      label={HIRING_PIPELINE_STAGE_LABELS[a.hiringPipelineStage]}
                      tone={hiringPipelineStageTone(a.hiringPipelineStage)}
                    />
                  </td>
                  <td className="center">
                    {a.isVeteran ? (
                      <span className="pill pill-vet">Veteran</span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td className="center">
                    {a.hasResume ? (
                      <span className="pill pill-ok">Yes</span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td>
                    <div className="completion">
                      <div className="bar">
                        <div
                          className="bar-fill"
                          style={{ width: `${a.profileCompletionPercent}%` }}
                        />
                      </div>
                      <span className="completion-pct">
                        {a.profileCompletionPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="right">
                    <Link
                      href={`/careers/review/${a.id}`}
                      className="row-action"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Review
                    </Link>
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

      <style jsx>{`
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
          flex: 1 1 240px;
          min-width: 180px;
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
          max-width: 220px;
        }
        .control-check {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #374151;
          cursor: pointer;
          user-select: none;
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
          min-width: 980px;
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
        .careers-table thead th.center {
          text-align: center;
        }
        .careers-table thead th.right {
          text-align: right;
        }
        .careers-table tbody td {
          font-size: 13px;
          color: #111827;
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .careers-table tbody td.center {
          text-align: center;
        }
        .careers-table tbody td.right {
          text-align: right;
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
        .cell-sub {
          display: block;
          font-size: 12px;
          color: #6b7280;
        }
        .pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 2px 9px;
          white-space: nowrap;
        }
        .pill-vet {
          background: #eef2ff;
          color: #3730a3;
          border: 1px solid #c7d2fe;
        }
        .pill-ok {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .dash {
          color: #9ca3af;
        }
        .completion {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 120px;
        }
        .bar {
          flex: 1;
          height: 7px;
          background: #eef2f7;
          border-radius: 999px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          background: #2563eb;
          border-radius: 999px;
        }
        .completion-pct {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          width: 34px;
          text-align: right;
        }
        .row-action {
          display: inline-block;
          background: #ffffff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 7px;
          padding: 6px 12px;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: none;
        }
        .row-action:hover {
          background: #eff6ff;
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
