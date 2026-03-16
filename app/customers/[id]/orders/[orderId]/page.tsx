"use client";

import { useParams } from "next/navigation";
import { OrderDetailView } from "@/components/OrderDetailView";

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
  const orderId = params.orderId as string;

  return (
    <OrderDetailView
      orderId={orderId}
      mode="view"
      backTo="customer"
      customerId={customerId}
    />
  );
}
