import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = "http://127.0.0.1:3000";

function getAuthHeader(req: NextRequest): HeadersInit {
  const auth = req.headers.get("authorization");
  if (!auth) return {};
  return { Authorization: auth };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qs = url.search ? url.search : "";
  const upstream = `${BACKEND_BASE}/certification-types${qs}`;

  const res = await fetch(upstream, {
    method: "GET",
    headers: {
      ...getAuthHeader(req),
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const res = await fetch(`${BACKEND_BASE}/certification-types`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(req),
    },
    body: payload,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idFromQuery = url.searchParams.get("id")?.trim() ?? "";
  const idFromBody = typeof body.id === "string" ? body.id.trim() : "";
  const id = idFromQuery || idFromBody;
  if (!id) {
    return NextResponse.json({ error: "Missing certification type id for PATCH" }, { status: 400 });
  }

  const { id: _omit, ...patchData } = body;
  const res = await fetch(`${BACKEND_BASE}/certification-types/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(req),
    },
    body: JSON.stringify(patchData),
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
