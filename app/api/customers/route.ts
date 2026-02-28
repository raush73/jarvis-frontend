import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = req.headers.get("authorization") || "";

  // Forward query params to backend (critical for search/filter/sort/pagination)
  const url = new URL(req.url);
  const backendUrl = new URL("http://127.0.0.1:3000/customers");
  backendUrl.search = url.search; // includes leading "?" if present

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
