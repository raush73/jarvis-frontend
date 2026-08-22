import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const UPSTREAM = BACKEND_ORIGIN;

// Stale Review Resolution Workflow: "Reviewed - No Contact Needed".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const { customerId } = await params;
    const auth = req.headers.get("authorization") ?? "";
    const body = await req.text();
    const res = await fetch(
      `${UPSTREAM}/friday/intelligence/queue/${customerId}/reviewed-no-contact`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: body || "{}",
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
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message ?? "Proxy POST failed" },
      { status: 502 },
    );
  }
}
