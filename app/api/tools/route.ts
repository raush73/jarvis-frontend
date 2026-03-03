import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = "http://127.0.0.1:3000";

function getAuthHeader(req: NextRequest): HeadersInit {
  const auth = req.headers.get("authorization");
  if (!auth) return {};
  return { Authorization: auth };
}
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qs = url.search ? url.search : "";
  const upstream = `${BACKEND_BASE}/tools${qs}`;

  const res = await fetch(upstream, {
    method: "GET",
    headers: {
      ...getAuthHeader(req),
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

