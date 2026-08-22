import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const UPSTREAM = BACKEND_ORIGIN;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callEventId: string }> }
) {
  try {
    const { callEventId } = await params;
    const auth = req.headers.get("authorization") ?? "";

    const res = await fetch(
      `${UPSTREAM}/friday/calls/${callEventId}/context`,
      {
        method: "GET",
        headers: {
          Authorization: auth,
        },
      }
    );

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Proxy error" },
      { status: 500 }
    );
  }
}
