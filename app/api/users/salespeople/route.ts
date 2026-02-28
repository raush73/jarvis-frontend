import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = req.headers.get("authorization") || "";
  const res = await fetch("http://127.0.0.1:3000/users/salespeople", {
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
