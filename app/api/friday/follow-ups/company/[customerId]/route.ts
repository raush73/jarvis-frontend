import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const UPSTREAM = BACKEND_ORIGIN;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  const qs = new URL(req.url).search || "";
  const auth = req.headers.get("authorization") ?? "";
  const res = await fetch(
    `${UPSTREAM}/friday/follow-ups/company/${customerId}${qs}`,
    {
      method: "GET",
      headers: { Authorization: auth },
      cache: "no-store",
    },
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
