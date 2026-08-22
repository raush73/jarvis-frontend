import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

// Static segment, so it is matched ahead of the sibling [id] route.
export async function PUT(req: Request) {
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const res = await fetch(`${BACKEND_ORIGIN}/ppe-categories/order`, {
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
