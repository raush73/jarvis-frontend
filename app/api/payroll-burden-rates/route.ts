import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const BACKEND = BACKEND_ORIGIN;

function getAuthHeader(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) {
    headers.Authorization = auth;
  }
  return headers;
}

export async function GET(req: NextRequest) {
  const res = await fetch(`${BACKEND}/payroll-burden-rates`, {
    headers: getAuthHeader(req),
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(`${BACKEND}/payroll-burden-rates`, {
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



