import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "http://127.0.0.1:3000";

export function proxyGet(backendPath: string) {
  return async function GET(req: NextRequest) {
    const qs = new URL(req.url).search || "";
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(`${UPSTREAM}${backendPath}${qs}`, {
      method: "GET",
      headers: { Authorization: auth },
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  };
}

export function proxyPost(backendPath: string) {
  return async function POST(req: NextRequest) {
    try {
      const auth = req.headers.get("authorization") ?? "";
      const body = await req.text();
      const res = await fetch(`${UPSTREAM}${backendPath}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body,
        cache: "no-store",
      });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
      });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, message: err?.message ?? "Proxy POST failed" },
        { status: 502 },
      );
    }
  };
}

export function proxyGetWithId(backendPathTemplate: string) {
  return async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    const path = backendPathTemplate.replace("[id]", id);
    const qs = new URL(req.url).search || "";
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(`${UPSTREAM}${path}${qs}`, {
      method: "GET",
      headers: { Authorization: auth },
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  };
}

export function proxyPostWithId(backendPathTemplate: string) {
  return async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const path = backendPathTemplate.replace("[id]", id);
      const auth = req.headers.get("authorization") ?? "";
      const body = await req.text();
      const res = await fetch(`${UPSTREAM}${path}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body,
        cache: "no-store",
      });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
      });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, message: err?.message ?? "Proxy POST failed" },
        { status: 502 },
      );
    }
  };
}
