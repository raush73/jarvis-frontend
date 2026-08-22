import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const BACKEND_BASE = BACKEND_ORIGIN;

function getAuthHeader(req: NextRequest): HeadersInit {
  const auth = req.headers.get("authorization");
  if (!auth) return {};
  return { Authorization: auth };
}
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qs = url.search ? url.search : "";
  const upstream = `${BACKEND_BASE}/tool-categories${qs}`;

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

