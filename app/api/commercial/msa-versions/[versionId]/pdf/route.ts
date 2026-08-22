import { NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  const token = req.headers.get("authorization") || "";
  const res = await fetch(
    `${BACKEND_ORIGIN}/commercial/msa-versions/${versionId}/pdf`,
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
    return new NextResponse(text, { status: res.status });
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentDisposition =
    res.headers.get("content-disposition") || 'attachment; filename="msa.pdf"';

  return new NextResponse(Buffer.from(arrayBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition,
    },
  });
}
