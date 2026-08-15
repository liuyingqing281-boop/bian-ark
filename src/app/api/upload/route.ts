import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { saveUpload, isImageMime } from "../../../lib/upload";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (!isImageMime(file.type)) return NextResponse.json({ error: "image_only" }, { status: 400 });

  try {
    const upload = await saveUpload(file, "avatars");
    return NextResponse.json({ ok: true, url: upload.url, thumbUrl: upload.thumbUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload_failed" },
      { status: 400 }
    );
  }
}