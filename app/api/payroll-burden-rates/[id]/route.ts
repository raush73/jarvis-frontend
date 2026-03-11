import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:3000";

function getAuthHeader(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.text();

  const res = await fetch(`${BACKEND}/payroll-burden-rates/${id}`, {
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
