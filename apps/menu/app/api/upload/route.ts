import { NextRequest, NextResponse } from "next/server";

/**
 * Image upload.
 *
 * The app does not hold storage credentials either. The file is handed to the
 * daemon, which hands it to the platform, which owns the bucket.
 */
const DAEMON = process.env.NEXT_PUBLIC_DAEMON_URL ?? "http://127.0.0.1:7770";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const out = new FormData();
  out.append("file", file, file.name);

  const res = await fetch(`${DAEMON}/api/business/upload`, { method: "POST", body: out });
  const data = await res.json().catch(() => ({ error: "upload failed" }));
  return NextResponse.json(data, { status: res.status });
}
