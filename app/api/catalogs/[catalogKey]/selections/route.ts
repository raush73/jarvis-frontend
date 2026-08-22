import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

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
    `${BACKEND_ORIGIN}/catalogs/${encodeURIComponent(catalogKey)}/selections`,
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
