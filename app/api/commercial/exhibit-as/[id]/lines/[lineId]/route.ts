import { NextResponse } from "next/server";

async function proxyRequest(
  req: Request,
  id: string,
  lineId: string,
  method: string,
) {
  const token = req.headers.get("authorization") || "";
  const body = method !== "DELETE" ? await req.text() : undefined;
  const res = await fetch(
    `http://127.0.0.1:3000/commercial/exhibit-as/${id}/lines/${lineId}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      ...(body ? { body } : {}),
      cache: "no-store",
    },
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await params;
  return proxyRequest(req, id, lineId, "PATCH");
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await params;
  return proxyRequest(req, id, lineId, "DELETE");
}
