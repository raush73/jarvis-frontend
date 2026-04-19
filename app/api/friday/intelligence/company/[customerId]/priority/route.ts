import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "http://127.0.0.1:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const res = await fetch(
    `${UPSTREAM}/friday/intelligence/company/${customerId}/priority`,
    {
      method: "GET",
      headers: { Authorization: auth },
      cache: "no-store",
    },
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type":
        res.headers.get("content-type") ?? "application/json",
    },
  });
}
