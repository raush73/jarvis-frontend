import { NextResponse } from "next/server";

// C4E stale-selection resolution. Static segment, so it is matched ahead of the parent
// [catalogKey] route.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ catalogKey: string }> },
) {
  const { catalogKey } = await params;
  const token = req.headers.get("authorization") || "";
  const body = await req.text();

  const res = await fetch(
    `http://127.0.0.1:3000/catalogs/${encodeURIComponent(catalogKey)}/selections`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body,
      cache: "no-store",
    },
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
