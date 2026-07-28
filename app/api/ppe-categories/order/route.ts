import { NextResponse } from "next/server";

// Static segment, so it is matched ahead of the sibling [id] route.
export async function PUT(req: Request) {
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const res = await fetch("http://127.0.0.1:3000/ppe-categories/order", {
    method: "PUT",
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
