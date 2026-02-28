"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Tab definitions per domain
const MODULE_TABS: Record<string, { key: string; label: string }[]> = {
  kpi: [
    { key: "overview", label: "Overview" },
    { key: "operations", label: "Operations" },
    { key: "finance", label: "Finance" },
    { key: "safety", label: "Safety" },
  ],
  friday: [
    { key: "dashboard", label: "Dashboard" },
    { key: "assistant", label: "Assistant" },
  ],
  orders: [
    { key: "active", label: "All Active" },
    { key: "recruiting", label: "Has Openings" },
    { key: "fully-staffed", label: "Fully Staffed" },
    { key: "dispatch", label: "Dispatch" },
    { key: "time", label: "Timesheets" },
    { key: "invoicing", label: "Invoicing" },
    { key: "documents", label: "Documents" },
  ],
  customers: [
    { key: "list", label: "Customer List" },
    { key: "contracts", label: "Contracts" },
  ],
  employees: [
    { key: "roster", label: "Roster" },
    { key: "scheduling", label: "Scheduling" },
  ],
  accounting: [
    { key: "gl", label: "GL" },
    { key: "ar", label: "AR" },
    { key: "ap", label: "AP" },
    { key: "assets", label: "Assets" },
    { key: "statements", label: "Statements" },
  ],
  admin: [
    { key: "users", label: "Users" },
    { key: "settings", label: "Settings" },
  ],
};

const VALID_DOMAINS = Object.keys(MODULE_TABS);
const DEFAULT_DOMAIN = "kpi";

export default function ModuleTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  // Derive current domain from the first URL path segment
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] || "";
  const currentDomain = VALID_DOMAINS.includes(firstSegment)
    ? firstSegment
    : DEFAULT_DOMAIN;

  const tabs = MODULE_TABS[currentDomain] || [];

  // Listen for hash changes
  useEffect(() => {
    const updateHash = () => {
      setHash(window.location.hash.replace("#", ""));
    };

    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  // Derive active tab from hash, default to first tab
  const activeTab =
    hash && tabs.some((t) => t.key === hash) ? hash : tabs[0]?.key || "";

  const handleTabClick = (tabKey: string) => {
    // Orders tabs: set hash directly, no router navigation
    if (currentDomain === "orders") {
      // "active" clears hash; others set their key
      window.location.hash = tabKey === "active" ? "" : tabKey;
      return;
    }
    router.push(`/${currentDomain}#${tabKey}`);
  };

  if (tabs.length === 0) return null;

  return (
    <div className="module-tabs">
      <div className="module-tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`module-tab-item ${
              tab.key === activeTab ? "active" : ""
            }`}
            type="button"
            onClick={() => handleTabClick(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
