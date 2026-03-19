"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type SalespersonRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
};

function buildSalespersonLabel(sp: SalespersonRecord): string {
  const name = `${sp.firstName ?? ""} ${sp.lastName ?? ""}`.trim();
  return name || sp.email || sp.id;
}

const US_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

function formatUpdatedAt(value: any): string {
  if (!value) return "â€”";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "â€”";
  return d.toLocaleString();
}

const AZ_STRIP = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")] as const;
type AzBucket = (typeof AZ_STRIP)[number];

function getAlphaBucket(name: string): string {
  const trimmed = String(name ?? "").trim();
  const first = trimmed.charAt(0).toUpperCase();
  if (first >= "A" && first <= "Z") return first;
  return "#";
}

function azAnchorId(bucket: string): string {
  return bucket === "#" ? "az-bucket-hash" : `az-bucket-${bucket}`;
}

function azFirstRowId(bucket: string): string {
  return bucket === "#" ? "az-hash-first" : `az-${bucket}-first`;
}
export default function CustomersPage() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "prospect">("all");
  const [salespersonIdFilter, setSalespersonIdFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "updatedAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [salespeople, setSalespeople] = useState<SalespersonRecord[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [azJumpLoading, setAzJumpLoading] = useState(false);
  const [pendingJumpLetter, setPendingJumpLetter] = useState<string | null>(null);
  const [azJumpMessage, setAzJumpMessage] = useState<string | null>(null);

  function buildCustomersParams(skip: number, take: number) {
    const params = new URLSearchParams({
      take: String(take),
      skip: String(skip),
      sort: sortBy,
      order: sortOrder,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
    if (salespersonIdFilter && salespersonIdFilter !== "all") {
      params.set("salespersonId", salespersonIdFilter);
    }
    if (stateFilter && stateFilter !== "all") {
      params.set("state", stateFilter);
    }
    return params;
  }

  async function fetchCustomersPage(skip: number, take: number) {
    return await apiFetch<{
      data: any[];
      meta: { total: number; take: number; skip: number };
    }>(`/customers?${buildCustomersParams(skip, take).toString()}`);
  }

  async function jumpToLetter(letter: string) {
    if (azJumpLoading) return;

    const target = (letter || "").trim().toUpperCase();
    const targetBucket: string = target >= "A" && target <= "Z" ? target : "#";

    setAzJumpLoading(true);
    setAzJumpMessage(null);
    try {
      if (!totalCount) {
        setAzJumpMessage(`No ${targetBucket} customers under current filters`);
        return;
      }

      const pagesToScan = Math.max(1, Math.ceil(totalCount / pageSize));
      let foundPage: number | null = null;

      for (let p = 1; p <= pagesToScan; p++) {
        const skip = (p - 1) * pageSize;
        const res = await fetchCustomersPage(skip, pageSize);
        const data = Array.isArray(res.data) ? res.data : [];
        const found = data.find((c) => getAlphaBucket(String(c?.name ?? "")) === targetBucket);
        if (found) {
          foundPage = p;
          break;
        }
      }

      if (foundPage) {
        setPage(foundPage);
        setPendingJumpLetter(targetBucket);
      } else {
        setAzJumpMessage(`No ${targetBucket} customers under current filters`);
      }
    } catch {
      setAzJumpMessage("Aâ€“Z jump failed");
    } finally {
      setAzJumpLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<SalespersonRecord[]>("/salespeople");
        if (!alive) return;
        const active = (Array.isArray(res) ? res : []).filter((sp) => sp.isActive);
        active.sort((a, b) =>
          buildSalespersonLabel(a).localeCompare(buildSalespersonLabel(b), undefined, {
            sensitivity: "base",
          })
        );
        setSalespeople(active);
      } catch {
        if (!alive) return;
        setSalespeople([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const skip = (page - 1) * pageSize;
        const res = await fetchCustomersPage(skip, pageSize);
        if (!alive) return;
        setCustomers(Array.isArray(res.data) ? res.data : []);
        setTotalCount(res.meta?.total ?? 0);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load customers.");
        setCustomers([]);
        setTotalCount(0);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedSearch, typeFilter, salespersonIdFilter, stateFilter, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  const azBuckets = useMemo(() => {
    const firstIndex: Partial<Record<AzBucket, number>> = {};
    for (let i = 0; i < customers.length; i++) {
      const bucket = getAlphaBucket(String(customers[i]?.name ?? "")) as AzBucket;
      if (firstIndex[bucket] === undefined) firstIndex[bucket] = i;
    }
    return { firstIndex };
  }, [customers]);

  useEffect(() => {
    if (!pendingJumpLetter) return;
    if (loading) return;
    if (!customers.length) return;

    const bucket = pendingJumpLetter;
    requestAnimationFrame(() => {
      const el = document.getElementById(azFirstRowId(bucket));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setPendingJumpLetter(null);
    });
  }, [pendingJumpLetter, loading, customers]);

  return (
    <div className="customers-container">
      {/* Page Header */}
      <div className="customers-header">
        <div className="header-left">
          <h1>Customers</h1>
          <span className="customer-count">{totalCount} customers</span>
        </div>
        <div className="header-actions">
          <Link href="/customers/new" className="btn-add">
            + Create Customer
          </Link>
        </div>
      </div>

      {/* Controls Row */}
      <div className="controls-row">
        <input
          type="text"
          placeholder="Search customers..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="control-search"
        />
        <select
          value={salespersonIdFilter}
          onChange={(e) => {
            setSalespersonIdFilter(e.target.value);
            setPage(1);
          }}
          className="control-select"
        >
          <option value="all">All salespeople</option>
          {salespeople.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {buildSalespersonLabel(sp)}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="control-select"
        >
          <option value="all">All states</option>
          {US_STATE_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as "all" | "customer" | "prospect");
            setPage(1);
          }}
          className="control-select"
        >
          <option value="all">All</option>
          <option value="customer">Customers</option>
          <option value="prospect">Prospects</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as "name" | "createdAt" | "updatedAt"); setPage(1); }}
          className="control-select"
        >
          <option value="name">Name</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Last Updated</option>
        </select>
        <select
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value as "asc" | "desc"); setPage(1); }}
          className="control-select"
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="control-select"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <div className="pagination-controls">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="control-btn"
          >
            Prev
          </button>
          <span className="page-display">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="control-btn"
          >
            Next
          </button>
        </div>
      </div>

      <div className="az-strip" aria-label="A to Z jump">
        {AZ_STRIP.map((bucket) => {
          return (
            <button
              key={bucket}
              type="button"
              className="az-btn"
              disabled={azJumpLoading}
              aria-disabled={azJumpLoading}
              aria-busy={azJumpLoading}
              onClick={() => {
                jumpToLetter(bucket);
              }}
            >
              {bucket}
            </button>
          );
        })}
        <div className="az-status" aria-live="polite">
          {azJumpLoading ? "Findingâ€¦" : azJumpMessage ? azJumpMessage : null}
        </div>
      </div>

      {/* Customers Table */}
      <div className="customers-table-wrap">
  <table className="customers-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Location</th>
        <th>Main Phone</th>
        <th>Customer Owner</th>
        <th>Last Updated</th>
      </tr>
    </thead>
    <tbody>
      {customers.map((customer, idx) => {
        const bucket = getAlphaBucket(String(customer?.name ?? "")) as AzBucket;
        const isFirstForBucket = azBuckets.firstIndex[bucket] === idx;

        return (
          <Fragment key={customer.id}>
            {isFirstForBucket ? (
              <tr id={azAnchorId(bucket)} className="az-anchor-row">
                <td colSpan={5}>
                  <span className="az-anchor-label">{bucket}</span>
                </td>
              </tr>
            ) : null}
            <tr
              id={isFirstForBucket ? azFirstRowId(bucket) : undefined}
              onClick={() => router.push(`/customers/${customer.id}`)}
              style={{ cursor: "pointer" }}
            >
              <td>
                <div className="cell-primary">{customer.name}</div>
                {customer.websiteUrl ? (
                  <div className="cell-sub">{customer.websiteUrl}</div>
                ) : null}
              </td>
              <td>{customer.locationCity && customer.locationState ? `${customer.locationCity}, ${customer.locationState}` : "\u2014"}</td>
              <td>{customer.mainPhone ?? "\u2014"}</td>
              <td>
                {customer.registrySalesperson
                  ? `${customer.registrySalesperson.firstName} ${customer.registrySalesperson.lastName}`
                  : "\u2014"}
              </td>
              <td>{formatUpdatedAt(customer.updatedAt)}</td>
            </tr>
          </Fragment>
        );
      })}
    </tbody>
  </table>
</div>

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Customer Hub Page
           Palette: bg #f8fafc | card #fff | border #e5e7eb
                    text-primary #111827 | text-secondary #4b5563
                    text-muted #6b7280 | blue #2563eb | blue-hover #1d4ed8
        ============================================================ */

        /* --- Page Shell --- */
        .customers-container {
          padding: 32px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
          background: #f8fafc;
          min-height: 100vh;
        }

        /* --- Page Header --- */
        .customers-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: baseline;
          gap: 14px;
        }

        .header-left h1 {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .customer-count {
          font-size: 14px;
          color: #6b7280;
        }

        .header-actions {
          display: flex;
          align-items: center;
        }

        /* --- Primary Add Button --- */
        .btn-add {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          background: #2563eb;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease;
          text-decoration: none;
        }

        .btn-add:hover {
          background: #1d4ed8;
        }

        /* --- Filter / Control Row --- */
        .controls-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          margin-bottom: 14px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          flex-wrap: wrap;
        }

        .control-search {
          flex: 1;
          min-width: 180px;
          padding: 9px 12px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.12s ease;
        }

        .control-search::placeholder {
          color: #9ca3af;
        }

        .control-search:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .control-select {
          padding: 9px 12px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.12s ease;
        }

        .control-select:focus {
          border-color: #2563eb;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .control-btn {
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }

        .control-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #d1d5db;
        }

        .control-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .page-display {
          font-size: 13px;
          color: #6b7280;
          white-space: nowrap;
        }

        /* --- A–Z Jump Strip --- */
        .az-strip {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          padding: 10px 14px;
          margin-bottom: 14px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }

        .az-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }

        .az-btn:hover:not(:disabled) {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .az-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .az-status {
          margin-left: 8px;
          font-size: 12.5px;
          color: #6b7280;
          min-height: 16px;
        }

        /* --- Table Wrapper --- */
        .customers-table-wrap {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        /* --- Table --- */
        .customers-table {
          width: 100%;
          border-collapse: collapse;
        }

        .customers-table thead {
          background: #f1f5f9;
        }

        .customers-table th {
          padding: 11px 20px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #d1d5db;
          white-space: nowrap;
        }

        .customers-table td {
          padding: 14px 20px;
          font-size: 13px;
          color: #111827;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .customers-table tr:last-child td {
          border-bottom: none;
        }

        .customers-table tbody tr:hover td {
          background: #f9fafb;
        }

        /* --- A–Z Anchor Row (table section divider) --- */
        .az-anchor-row td {
          padding: 8px 20px;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .az-anchor-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 18px;
          border-radius: 5px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          font-size: 11px;
          font-weight: 700;
        }

        /* --- Cell Hierarchy --- */
        .cell-primary {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
        }

        .cell-sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        /* --- Loading / Error / Empty States --- */
        .state-loading,
        .state-empty {
          padding: 32px 20px;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
        }

        .state-error {
          padding: 14px 18px;
          margin-bottom: 16px;
          border-radius: 8px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}





