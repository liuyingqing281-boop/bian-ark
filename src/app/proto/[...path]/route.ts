import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

// 静态原型托管：/proto/index.html → <repo>/prototype/index.html（同源，便于接真实 API）
const ROOT = path.resolve(process.cwd(), "prototype");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path: segs = ["index.html"] } = await ctx.params;
  const rel = segs.length ? segs.join("/") : "index.html";
  const abs = path.resolve(ROOT, rel);

  // 防目录穿越
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ext = path.extname(abs).toLowerCase();
  const type = CONTENT_TYPES[ext];
  if (!type) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });

  try {
    const buf = await fs.readFile(abs);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": type, "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
