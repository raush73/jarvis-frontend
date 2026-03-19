import React from "react";
import Card from "./Card";

/**
 * Industrial Light V1 — TableWrapper
 *
 * Wraps a <table> in the standard Industrial Light V1 card surface.
 * Provides the white background, visible border, and 12px radius
 * that the table sits inside.
 *
 * Table inside TableWrapper must follow the approved table standards:
 *   thead:        background #f1f5f9
 *   th:           11px, weight 600, #374151, uppercase, letter-spacing 0.5px
 *   th border:    1px solid #d1d5db (bottom)
 *   td:           13px, #111827, border-bottom 1px solid #f1f5f9
 *   tr:hover td:  background #f9fafb
 *   Actions col:  edit = #2563eb link-style, delete = #dc2626 link-style
 *
 * For tables that need horizontal scroll, wrap the <table> in an
 * overflow-x: auto div inside TableWrapper.
 */
export default function TableWrapper({ children }: { children: React.ReactNode }) {
  return <Card style={{ padding: 0, overflow: "hidden" }}>{children}</Card>;
}
