import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";

  const res = await fetch(`${BACKEND}/trades`, {
    headers: {
      Authorization: auth,
    },
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const body = await req.text();

  const res = await fetch(`${BACKEND}/trades`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body,
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}
