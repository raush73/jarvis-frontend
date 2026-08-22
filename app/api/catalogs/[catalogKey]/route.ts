import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

// C4E staff-facing catalog selection surface (consumer projection): active entries only,
// already grouped and ordered by the server.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ catalogKey: string }> },
) {
  const { catalogKey } = await params;
  const token = req.headers.get("authorization") || "";

  const res = await fetch(
    `${BACKEND_ORIGIN}/catalogs/${encodeURIComponent(catalogKey)}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      cache: "no-store",
    },
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
