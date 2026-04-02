import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const headers = new Headers();
  const authHeader = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie");

  if (authHeader) headers.set("authorization", authHeader);
  if (cookieHeader) headers.set("cookie", cookieHeader);

  const res = await fetch(
    `${BACKEND_BASE_URL}/recruiting/send-approval-packet/${orderId}`,
    {
      method: "POST",
      headers,
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  }

  const body = await res.arrayBuffer();

  const responseHeaders = new Headers();
  const contentType = res.headers.get("content-type");
  const contentDisposition = res.headers.get("content-disposition");

  if (contentType) responseHeaders.set("content-type", contentType);
  if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);

  return new NextResponse(body, {
    status: 200,
    headers: responseHeaders,
  });
}
