import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization") || "";
  const res = await fetch(
    `http://127.0.0.1:3000/commercial/rate-sheets/${id}/pdf`,
    {
      method: "GET",
      headers: {
        ...(token ? { Authorization: token } : {}),
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const buf = await res.arrayBuffer();
  const disposition = res.headers.get("content-disposition") || 'inline; filename="rate-sheet.pdf"';
  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
