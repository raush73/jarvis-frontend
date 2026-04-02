import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const headers = new Headers();
  const authHeader = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie");

  if (authHeader) headers.set("authorization", authHeader);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  headers.set("content-type", "application/json");

  const res = await fetch(
    `${BACKEND_BASE_URL}/recruiting/vetting-approval-config/${orderId}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
