import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const qs = req.nextUrl.searchParams.toString();
  const url = `${BACKEND}/capabilities${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: auth },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
