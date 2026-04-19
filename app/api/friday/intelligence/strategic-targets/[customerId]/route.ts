import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "http://127.0.0.1:3000";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const { customerId } = await params;
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(
      `${UPSTREAM}/friday/intelligence/strategic-targets/${customerId}`,
      {
        method: "DELETE",
        headers: { Authorization: auth },
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
      { ok: false, message: err?.message ?? "Proxy DELETE failed" },
      { status: 502 },
    );
  }
}
