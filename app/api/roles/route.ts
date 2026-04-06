import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";

  const res = await fetch(`${BACKEND}/roles`, {
    headers: { ...(auth ? { Authorization: auth } : {}) },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
