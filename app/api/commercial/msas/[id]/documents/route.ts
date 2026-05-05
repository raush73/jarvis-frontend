import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization") || "";
  const res = await fetch(
    `http://127.0.0.1:3000/commercial/msas/${id}/documents`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      cache: "no-store",
    }
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization") || "";
  const formData = await req.formData();

  const backendForm = new FormData();
  for (const [key, value] of formData.entries()) {
    backendForm.append(key, value);
  }

  const res = await fetch(
    `http://127.0.0.1:3000/commercial/msas/${id}/documents`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: token } : {}),
      },
      body: backendForm,
      cache: "no-store",
    }
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
