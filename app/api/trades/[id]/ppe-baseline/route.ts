import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const BACKEND = BACKEND_ORIGIN;

export async function GET(req: Request, ctx: any) {
  const token =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  const rawParams = ctx?.params;
  const resolvedParams =
    rawParams && typeof rawParams?.then === "function"
      ? await rawParams
      : rawParams;

  const tradeId = resolvedParams?.id;
if (!tradeId) {
    return new NextResponse(JSON.stringify({ message: "Missing trade id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${BACKEND}/trades/${tradeId}/ppe-baseline`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT(req: Request, ctx: any) {
  const token =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  const rawParams = ctx?.params;
  const resolvedParams =
    rawParams && typeof rawParams?.then === "function"
      ? await rawParams
      : rawParams;

  const tradeId = resolvedParams?.id;
  const body = await req.text();
if (!tradeId) {
    return new NextResponse(JSON.stringify({ message: "Missing trade id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${BACKEND}/trades/${tradeId}/ppe-baseline`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
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


