import { NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

function getTradeId(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // /api/trades/:id/tools-baseline
  const idx = parts.indexOf("trades");
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return parts[idx + 1];
}

export async function GET(req: Request) {
  const token = req.headers.get("authorization") || "";
  const tradeId = getTradeId(req);

  if (!tradeId) {
    return new NextResponse(JSON.stringify({ message: "Missing trade id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${BACKEND}/trades/${tradeId}/tools-baseline`, {
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

export async function PUT(req: Request) {
  const token = req.headers.get("authorization") || "";
  const tradeId = getTradeId(req);
  const body = await req.text();

  if (!tradeId) {
    return new NextResponse(JSON.stringify({ message: "Missing trade id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${BACKEND}/trades/${tradeId}/tools-baseline`, {
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
