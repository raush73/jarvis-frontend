import React from "react";
import OrderNav from "@/components/OrderNav";

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id?: string | string[] }>;
}) {
  const resolved = await params;
  const rawId = resolved?.id;
  const orderId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!orderId) {
    return <>{children}</>;
  }

  return (
    <div className="order-layout">
      <OrderNav orderId={orderId} />
      <div className="order-content">{children}</div>
    </div>
  );
}
