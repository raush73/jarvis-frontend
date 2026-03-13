import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_BASE = "http://127.0.0.1:3000";

function passthroughResponse(res: Response, text: string) {
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";

  const res = await fetch(`${UPSTREAM_BASE}/commissions/plans/active`, {
    method: "GET",
    headers: { Authorization: auth },
    cache: "no-store",
  });

  const text = await res.text();
  return passthroughResponse(res, text);
}
