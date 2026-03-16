"use client";

import { useSearchParams } from "next/navigation";
import { OrderDetail } from "../page";

export default function OrderViewPage() {
  const searchParams = useSearchParams();

  const fromCustomer = searchParams.get("from") === "customer";
  const customerId = searchParams.get("customerId");

  return (
    <OrderDetail
      mode="view"
      backTo={fromCustomer ? "customer" : "orders"}
      customerId={customerId}
    />
  );
}
