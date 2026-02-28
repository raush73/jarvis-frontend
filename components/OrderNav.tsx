"use client";

import { useRouter, usePathname, useParams } from "next/navigation";

/**
 * OrderNav — Order-Level Navigation Component
 *
 * Provides consistent order-scoped navigation for internal users
 * navigating between order-related views within /orders/[id].
 *
 * ORDER-CONTEXT ROUTING ENFORCEMENT:
 * - ALL tabs resolve to order-scoped pages (/orders/[id]/*)
 * - NO tab routes to list-level views (/orders, /dispatch, etc.)
 * - Dispatch tab routes to /orders/[id]/dispatch-order (NOT recruiting queue)
 *
 * UI Shell only — no data fetching, no permissions.
 */

/**
 * ORDER_TABS Configuration (LOCKED)
 *
 * Tab routing is STRICTLY order-scoped:
 * - Overview   → /orders/[id]
 * - Vetting    → /orders/[id]/vetting
 * - Dispatch   → /orders/[id]/dispatch-order (Order-specific dispatch document)
 * - Timesheets → /orders/[id]/timesheets (canonical hub route)
 * - Invoicing  → /orders/[id]/invoicing
 * - Documents  → /orders/[id]/documents
 *
 * DO NOT modify these paths to point to list-level routes.
 */
const ORDER_TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "vetting", label: "Vetting", path: "/vetting" },
  { key: "dispatch", label: "Dispatch", path: "/dispatch-order" },
  { key: "time", label: "Timesheets", path: "/timesheets" },
  { key: "invoicing", label: "Invoicing", path: "/invoicing" },
  { key: "documents", label: "Documents", path: "/documents" },
] as const;

type OrderNavProps = {
  orderId?: string;
};

export default function OrderNav(props: OrderNavProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const orderIdFromParams = params?.id as string | undefined;
  const orderId = (props.orderId ?? orderIdFromParams) ?? "";

  // Base path for this order — ALL navigation stays within this context
  const basePath = orderId ? `/orders/${orderId}` : "";

  /**
   * Determine active tab based on pathname
   *
   * ORDER-CONTEXT ENFORCEMENT:
   * - Only matches paths within /orders/[id]/*
   * - Falls back to "overview" for the base path or unknown routes
   */
  const getActiveTab = (): string => {
    if (!pathname || !orderId) return "overview";

    // Remove base path to get the remaining segment
    const remainingPath = pathname.replace(basePath, "");

    // Normalize: ensure leading slash for comparison
    const normalizedPath = remainingPath.startsWith("/")
      ? remainingPath
      : `/${remainingPath}`;

    // Find matching tab (exact match or startsWith for nested routes)
    for (const tab of ORDER_TABS) {
      const tabPath = tab.path || "";
      const normalizedTabPath = tabPath.startsWith("/")
        ? tabPath
        : `/${tabPath}`;

      // Exact match for overview
      if (tabPath === "" && (normalizedPath === "" || normalizedPath === "/")) {
        return tab.key;
      }

      // Match nested routes
      if (tabPath !== "" && normalizedPath.startsWith(normalizedTabPath)) {
        return tab.key;
      }
    }

    return "overview";
  };

  const activeTab = getActiveTab();

  /**
   * Handle tab navigation
   *
   * ORDER-CONTEXT ENFORCEMENT:
   * - ALWAYS routes to /orders/[id]/* paths
   * - NEVER routes to list-level pages
   */
  const handleTabClick = (tab: (typeof ORDER_TABS)[number]) => {
    if (!orderId) return;
    router.push(`${basePath}${tab.path}`);
  };

  return (
    <nav className="order-nav">
      <div className="order-nav-container">
        {ORDER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`order-nav-tab ${
              tab.key === activeTab ? "active" : ""
            }`}
            type="button"
            onClick={() => handleTabClick(tab)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
