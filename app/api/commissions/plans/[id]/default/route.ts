import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const UPSTREAM_BASE = BACKEND_ORIGIN;

function passthroughResponse(res: Response, text: string) {
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const auth = req.headers.get("authorization") ?? "";

    const res = await fetch(`${UPSTREAM_BASE}/commissions/plans/${id}/default`, {
      method: "PATCH",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const text = await res.text();
    return passthroughResponse(res, text);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        errorId: "JP-COMMISSION-PLANS-PROXY-SET-DEFAULT",
        message: err?.message ?? "Proxy PATCH default failed",
      },
      { status: 502 }
    );
  }
}
