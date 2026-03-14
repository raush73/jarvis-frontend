import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const res = await fetch(`${BACKEND}/orders`, {
    headers: { ...(auth ? { Authorization: auth } : {}) },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const body = await req.text();
  const res = await fetch(`${BACKEND}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
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
