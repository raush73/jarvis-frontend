import { NextResponse } from "next/server";

/**
 * Proxy: GET /api/customer-contacts → backend GET /customer-contacts (with query params)
 */
export async function GET(req: Request) {
  const token = req.headers.get("authorization") || "";

  const url = new URL(req.url);
  const backendUrl = new URL("http://127.0.0.1:3000/customer-contacts");
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

/**
 * Proxy: POST /api/customer-contacts → backend POST /customer-contacts
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const res = await fetch("http://127.0.0.1:3000/customer-contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
