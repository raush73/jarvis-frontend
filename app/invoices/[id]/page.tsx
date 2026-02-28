"use client";

import { useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";

export default function InvoiceDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const invoiceId = params.id as string;
  const customerId = searchParams.get("customerId");
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    // Build returnTo URL
    const returnParts: string[] = [];
    if (customerId) returnParts.push(`customerId=${encodeURIComponent(customerId)}`);
    if (orderId) returnParts.push(`orderId=${encodeURIComponent(orderId)}`);
    const returnTo = returnParts.length > 0
      ? `/invoices?${returnParts.join("&")}`
      : "/invoices";

    // Build redirect URL
    const redirectParts: string[] = ["from=invoices"];
    if (customerId) redirectParts.push(`customerId=${encodeURIComponent(customerId)}`);
    if (orderId) redirectParts.push(`orderId=${encodeURIComponent(orderId)}`);
    redirectParts.push(`returnTo=${encodeURIComponent(returnTo)}`);

    const redirectUrl = `/accounting/invoicing/${invoiceId}?${redirectParts.join("&")}`;
    router.replace(redirectUrl);
  }, [router, invoiceId, customerId, orderId]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0c0f14 0%, #111827 100%)",
      color: "rgba(255, 255, 255, 0.5)",
      fontSize: "14px"
    }}>
      Redirecting…
    </div>
  );
}
