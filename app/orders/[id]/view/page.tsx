"use client";

import { useSearchParams } from "next/navigation";
import { OrderDetail } from "../page";

// View mode wrapper for /orders/[id]/view route
// Renders the SAME Order Detail UI with mode="view"
export default function OrderViewPage() {
  const searchParams = useSearchParams();
  
  // Check if navigated from customer profile
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
