import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || BACKEND_ORIGIN;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  const { orderId } = await Promise.resolve(context.params);

  const headers = new Headers();
  const authHeader = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie");

  if (authHeader) headers.set("authorization", authHeader);
  if (cookieHeader) headers.set("cookie", cookieHeader);

  const res = await fetch(`${BACKEND_BASE_URL}/recruiting/order/${orderId}/candidates`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
