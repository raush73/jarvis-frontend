import { NextResponse } from "next/server";

function extractId(req: Request): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  return id && id !== "tool-categories" ? id : null;
}

export async function GET(req: Request) {
  const token = req.headers.get("authorization") || "";
  const id = extractId(req);

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing category id" }, { status: 400 });
  }

  const res = await fetch(`http://127.0.0.1:3000/tool-categories/${encodeURIComponent(id)}`, {
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

export async function PATCH(req: Request) {
  const token = req.headers.get("authorization") || "";
  const body = await req.text();
  const id = extractId(req);

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing category id" }, { status: 400 });
  }

  const res = await fetch(`http://127.0.0.1:3000/tool-categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
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