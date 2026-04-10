import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "http://127.0.0.1:3000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callEventId: string }> },
) {
  try {
    const { callEventId } = await params;
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(
      `${UPSTREAM}/api/friday/calls/${callEventId}/intelligence`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      },
    );
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
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callEventId: string }> },
) {
  try {
    const { callEventId } = await params;
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(
      `${UPSTREAM}/api/friday/calls/${callEventId}/intelligence`,
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
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message ?? "Proxy GET failed" },
      { status: 502 },
    );
  }
}
