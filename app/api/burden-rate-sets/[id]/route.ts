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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const res = await fetch(`${BACKEND}/burden-rate-sets/${id}`, {
    headers: getAuthHeader(req),
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.text();

  const res = await fetch(`${BACKEND}/burden-rate-sets/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(req),
    },
    body,
  });

  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}



