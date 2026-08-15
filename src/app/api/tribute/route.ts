import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { canTributeMemorial, MemorialAccessRow } from "../../../lib/permissions";
import { moderateText } from "../../../lib/moderation";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const memorial_id = formData.get("memorial_id") as string;
  const item_id = formData.get("item_id") as string;
  const rawLang = formData.get("lang") as string;
  const lang = rawLang === "en" ? "en" : "zh";

  if (!memorial_id) {
    return NextResponse.redirect(new URL(`/${lang}`, req.url));
  }

  const db = getDb();
  const memorial = db
    .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorial_id) as MemorialAccessRow | undefined;
  if (!memorial) {
    return NextResponse.redirect(new URL(`/${lang}`, req.url));
  }

  const user = await getSessionUser();
  if (!canTributeMemorial(memorial, user?.id ?? null)) {
    return NextResponse.redirect(new URL(`/${lang}/login`, req.url));
  }

  const sender_name =
    ((formData.get("sender_name") as string) || "").trim().slice(0, 40) ||
    user?.name ||
    (lang === "en" ? "Anonymous" : "匿名");
  const message = ((formData.get("message") as string) || "").slice(0, 500);
  const senderCheck = await moderateText(sender_name + " " + message);
  if (!senderCheck.pass) {
    return NextResponse.redirect(new URL(`/${lang}/memorial/${memorial_id}?blocked=1`, req.url));
  }
  const is_burning = formData.get("is_burning") === "1" ? 1 : 0;

  db.prepare(
    "INSERT INTO tributes (id, memorial_id, item_id, message, sender_name, is_burning) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(uuid(), memorial_id, item_id || "flower_white", message, sender_name, is_burning);

  return NextResponse.redirect(new URL(`/${lang}/memorial/${memorial_id}`, req.url));
}