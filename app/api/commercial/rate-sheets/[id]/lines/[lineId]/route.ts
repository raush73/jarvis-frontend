import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id, lineId } = await params;
  const token = req.headers.get("authorization") || "";
  const res = await fetch(
    `${BACKEND_ORIGIN}/commercial/rate-sheets/${id}/lines/${lineId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      cache: "no-store",
    }
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
