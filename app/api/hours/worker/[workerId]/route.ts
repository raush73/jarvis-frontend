import { NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const { workerId } = await params;
  const token = req.headers.get("authorization") || "";

  const res = await fetch(`${BACKEND}/hours/worker/${workerId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
