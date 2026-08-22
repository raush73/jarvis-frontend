import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

export async function PATCH(req: Request) {
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];

  if (!id || id === "compliance-requirement-types") {
    return NextResponse.json({ ok: false, message: "Missing requirement type id" }, { status: 400 });
  }

  const res = await fetch(`${BACKEND_ORIGIN}/compliance-requirement-types/${encodeURIComponent(id)}`, {
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
