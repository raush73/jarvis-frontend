import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const BACKEND = BACKEND_ORIGIN;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; roleId: string }> },
) {
  const { userId, roleId } = await params;
  const auth = req.headers.get("authorization") ?? "";

  const res = await fetch(`${BACKEND}/users/${userId}/roles/${roleId}`, {
    method: "POST",
    headers: { ...(auth ? { Authorization: auth } : {}) },
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; roleId: string }> },
) {
  const { userId, roleId } = await params;
  const auth = req.headers.get("authorization") ?? "";

  const res = await fetch(`${BACKEND}/users/${userId}/roles/${roleId}`, {
    method: "DELETE",
    headers: { ...(auth ? { Authorization: auth } : {}) },
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
