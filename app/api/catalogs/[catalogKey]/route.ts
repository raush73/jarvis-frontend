import { NextResponse } from "next/server";

// C4E staff-facing catalog selection surface (consumer projection): active entries only,
// already grouped and ordered by the server.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ catalogKey: string }> },
) {
  const { catalogKey } = await params;
  const token = req.headers.get("authorization") || "";

  const res = await fetch(
    `http://127.0.0.1:3000/catalogs/${encodeURIComponent(catalogKey)}`,
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
