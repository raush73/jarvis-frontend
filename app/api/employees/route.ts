import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const qs = url.search || "";

  const res = await fetch(`${BACKEND}/employees${qs}`, {
    headers: { ...(auth ? { Authorization: auth } : {}) },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
