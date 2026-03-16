"use client";

import { useParams } from "next/navigation";
import { OrderDetailView } from "@/components/OrderDetailView";
export type { OrderDetailMode } from "@/components/OrderDetailView";

export function OrderDetail({
  mode = "edit",
  backTo = "orders",
  customerId = null,
}: {
  mode?: "edit" | "view";
  backTo?: "orders" | "customer";
  customerId?: string | null;
}) {
  const params = useParams();
  const orderId = params.id as string;
  return (
    <OrderDetailView
      orderId={orderId}
      mode={mode}
      backTo={backTo}
      customerId={customerId}
    />
  );
}

export default function OrderDetailPage() {
  return <OrderDetail mode="edit" backTo="orders" />;
}
