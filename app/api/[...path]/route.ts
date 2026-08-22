import { NextRequest, NextResponse } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const backendPath = path.join("/");
    const search = new URL(req.url).search || "";
    const target = `${BACKEND_ORIGIN}/${backendPath}${search}`;

    const headers = new Headers();
    const auth = req.headers.get("authorization");
    const contentType = req.headers.get("content-type");
    if (auth) headers.set("Authorization", auth);
    if (contentType) headers.set("Content-Type", contentType);

    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";

    const res = await fetch(target, {
      method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || "API proxy failed" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
