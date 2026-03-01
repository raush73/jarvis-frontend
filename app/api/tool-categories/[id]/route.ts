import { NextResponse } from "next/server";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const res = await fetch(`http://127.0.0.1:3000/tool-categories/${ctx.params.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}