import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || BACKEND_ORIGIN;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const auth = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie");

  const forwardHeaders: Record<string, string> = {
    Authorization: auth || "",
    "Content-Type": "application/json",
  };
  if (cookieHeader) {
    forwardHeaders.Cookie = cookieHeader;
  }

  const res = await fetch(
    `${BACKEND_BASE_URL}/recruiting/send-approval-packet/${orderId}`,
    {
      method: "POST",
      headers: forwardHeaders,
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
