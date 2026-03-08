import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization") || "";

  const res = await fetch(
    `${BACKEND}/customers/${id}/ppe-baseline`,
    {
      headers: { Authorization: token },
      cache: "no-store",
    }
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const res = await fetch(
    `${BACKEND}/customers/${id}/ppe-baseline`,
    {
      method: "PUT",
      headers: {
        Authorization: token,
        "content-type": "application/json",
      },
      body,
    }
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
