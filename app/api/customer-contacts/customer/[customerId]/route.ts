import { NextResponse } from "next/server";

/**
 * Proxy: GET /api/customer-contacts/customer/:customerId
 *      → backend GET /customer-contacts/customer/:customerId
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  const token = req.headers.get("authorization") || "";

  const url = new URL(req.url);
  const backendUrl = new URL(
    `http://127.0.0.1:3000/customer-contacts/customer/${customerId}`,
  );
  backendUrl.search = url.search;

  const res = await fetch(backendUrl.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
