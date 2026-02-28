import { redirect } from "next/navigation";

/**
 * Order Context Catch-All Route
 * 
 * Handles any invalid or unknown sub-routes within /orders/[id]/*.
 * Gracefully redirects to the order overview page.
 * 
 * This ensures order-context routing enforcement:
 * - No OrderNav tab should ever lead to a 404
 * - Invalid routes automatically resolve to /orders/[id]
 * 
 * UI Shell only — no data fetching, no permissions.
 */
export default function OrderCatchAllPage({
  params,
}: {
  params: { id: string; catchAll: string[] };
}) {
  // Redirect to order overview for any unknown sub-routes
  redirect(`/orders/${params.id}`);
}

