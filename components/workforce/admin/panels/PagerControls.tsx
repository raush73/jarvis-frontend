"use client";

/**
 * Phase 2 - paging, once, for every paged administrative surface.
 *
 * The page and the size are the SERVER's: it clamps both, so this control reports what came
 * back rather than what was asked for. A pager that computed its own bounds would let a
 * surface offer a page the server would refuse.
 */

export function OnboardingAdminPager({
  page,
  pageSize,
  total,
  onPage,
  label = "results",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="oba-pager">
      <p className="oba-pager-count">
        {total === 0
          ? `No ${label}`
          : `Showing ${first}–${last} of ${total} ${label}`}
      </p>
      {pages > 1 ? (
        <div className="oba-pager-controls">
          <button
            type="button"
            className="oba-btn oba-btn-quiet"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </button>
          <span className="oba-pager-position">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="oba-btn oba-btn-quiet"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
