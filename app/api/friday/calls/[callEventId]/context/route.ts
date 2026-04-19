import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "http://127.0.0.1:3000";

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
