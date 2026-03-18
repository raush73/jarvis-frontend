import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

function getAuthHeader(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) {
    headers.Authorization = auth;
  }
  return headers;
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const res = await fetch(`${BACKEND}/burden-rate-sets${qs}`, {
    headers: getAuthHeader(req),
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(`${BACKEND}/burden-rate-sets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(req),
    },
    body,
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}



