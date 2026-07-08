"use client";

import { apiFetch, clearAccessToken } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth/useSession";
import { fridayFetch } from "./friday/fridayFetch";

const DOMAINS = [
  { key: "kpi", label: "KPI" },
  { key: "friday", label: "Friday" },
  { key: "campaigns", label: "Campaigns" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "employees", label: "Employees" },
  { key: "time-entry", label: "Time Entry" },
  { key: "accounting", label: "Accounting" },
  { key: "careers", label: "Careers" },
  { key: "admin", label: "Admin" },
];

interface NavBadgeCounts {
  followUps: { overdue: number; dueToday: number };
  tasks: { overdue: number; dueToday: number };
}

type CustomerSearchResult = {
  id: string;
  name?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
};

export default function GlobalTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  const pathSegments = pathname.split("/").filter(Boolean);
  const activeDomain = pathSegments[0] || "";

  const visibleDomains = useMemo(
    () => DOMAINS.filter((d) => session.canAccessModule(d.key)),
    [session],
  );

  const kpiLabel = useMemo(() => {
    const scope = session.getScope("customers");
    return scope === "COMPANY" || scope === "TEAM" ? "KPI" : "My Work";
  }, [session]);

  const [badges, setBadges] = useState<NavBadgeCounts | null>(null);

  const loadBadges = useCallback(async () => {
    const res = await fridayFetch<NavBadgeCounts>("/activity/badges");
    if (res.ok) setBadges(res.data);
  }, []);

  useEffect(() => {
    if (!session.ready || !session.authenticated) return;
    loadBadges();
  }, [session.ready, session.authenticated, loadBadges]);

  useEffect(() => {
    if (!session.ready || !session.authenticated) return;
    loadBadges();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [statusText, setStatusText] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  async function runSearch(nextQuery: string) {
    const q = nextQuery.trim();
    if (!q) {
      setOpen(false);
      setResults([]);
      setStatusText(null);
      return;
    }

    setOpen(true);
    setLoading(true);
    setStatusText(null);
    try {
      const params = new URLSearchParams({
        search: q,
        take: "10",
        skip: "0",
      });

      const res = await apiFetch<{
        data: CustomerSearchResult[];
      }>(`/customers?${params.toString()}`);

      const data = Array.isArray(res.data) ? res.data : [];
      setResults(data);
      setStatusText(data.length === 0 ? "No matches" : null);
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (msg.includes("API 401")) {
        setStatusText("Session expired — please log in again");
      } else {
        setStatusText("Search failed");
      }
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!trimmedQuery) {
      setOpen(false);
      setResults([]);
      setStatusText(null);
      return;
    }

    const t = setTimeout(() => {
      runSearch(trimmedQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [trimmedQuery]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    // Close dropdown on navigation
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="global-top-nav">
      {/* Jarvis Prime Logo - Visual Anchor */}
      <div className="nav-logo">
        <img
          src="/branding/jarvis-prime-logo.png"
          alt="Jarvis Prime"
          style={{ height: '38px', width: 'auto', cursor: 'pointer' }}
          onClick={() => router.push("/orders")}
        />
      </div>

      {/* Domain Navigation — filtered by role access */}
      <div className="nav-domains">
        {visibleDomains.map((domain) => {
          const label = domain.key === "kpi" ? kpiLabel : domain.label;
          const showBadges = domain.key === "kpi" && badges;
          const fuOverdue = badges?.followUps.overdue ?? 0;
          const taskOverdue = badges?.tasks.overdue ?? 0;

          return (
            <button
              key={domain.key}
              className={`nav-domain-item ${
                domain.key === activeDomain ? "active" : ""
              }`}
              type="button"
              onClick={() => router.push(`/${domain.key}`)}
            >
              {label}
              {showBadges && fuOverdue > 0 && (
                <span className="nav-badge nav-badge-red" title={`${fuOverdue} overdue follow-up${fuOverdue !== 1 ? "s" : ""}`}>
                  {fuOverdue}
                </span>
              )}
              {showBadges && taskOverdue > 0 && (
                <span className="nav-badge nav-badge-amber" title={`${taskOverdue} overdue task${taskOverdue !== 1 ? "s" : ""}`}>
                  {taskOverdue}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right-side tools */}
      <div className="nav-right">
        <div className="global-search" ref={containerRef}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers or contacts…"
            className="global-search-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(query);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />

          {open ? (
            <div className="global-search-panel" role="listbox" aria-label="Customer search results">
              {loading ? (
                <div className="global-search-empty">Searching…</div>
              ) : statusText ? (
                <div className="global-search-empty">{statusText}</div>
              ) : (
                results.map((c) => {
                  const secondary = c.location ?? [c.city, c.state].filter(Boolean).join(", ");
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="global-search-item"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/customers/${c.id}`);
                      }}
                    >
                      <div className="global-search-primary">{c.name ?? c.id}</div>
                      {secondary ? (
                        <div className="global-search-secondary">{secondary}</div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        {/* Signed-in identity indicator */}
        {session.authenticated && (
          <span className="signed-in-label">
            Signed in as:{" "}
            <strong>{session.fullName || session.email || "Unknown User"}</strong>
          </span>
        )}

        {/* Logout Button */}
        <div style={{ paddingRight: "16px" }}>
          <button
            type="button"
            onClick={() => {
              clearAccessToken();
              router.push("/login");
            }}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .nav-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .global-search {
          position: relative;
        }

        .global-search-input {
          width: min(420px, 42vw);
          height: 34px;
          padding: 8px 12px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.92);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
        }

        .global-search-input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }

        .global-search-panel {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: min(520px, 70vw);
          max-height: 420px;
          overflow: auto;
          background: #0f1f38;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 12px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
          padding: 6px;
          z-index: 200;
        }

        .global-search-item {
          width: 100%;
          text-align: left;
          padding: 10px 10px;
          border-radius: 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .global-search-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .global-search-primary {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
        }

        .global-search-secondary {
          margin-top: 2px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
        }

        .global-search-empty {
          padding: 10px 10px;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.6);
        }

        .signed-in-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          white-space: nowrap;
          padding: 0 4px;
        }

        .signed-in-label strong {
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
        }
      `}</style>
    </nav>
  );
}
