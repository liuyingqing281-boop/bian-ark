import { getDb } from "../../../lib/db";
import { requireAdmin } from "../../../lib/admin";
import { v4 as uuid } from "uuid";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = getDb();
  const memorials = db.prepare("SELECT * FROM memorials ORDER BY created_at DESC").all();
  const items = db.prepare("SELECT * FROM items ORDER BY category, sort_order").all();
  const digitalHumans = db
    .prepare(
      `SELECT dh.id, dh.memorial_id, dh.status, dh.photo_url, dh.script, dh.result_video_url, dh.error, dh.created_at,
              m.name AS memorial_name
       FROM digital_humans dh LEFT JOIN memorials m ON m.id = dh.memorial_id
       WHERE dh.status IN ('reviewing', 'done', 'failed') ORDER BY dh.created_at DESC LIMIT 50`
    )
    .all();
  const stats = db
    .prepare("SELECT type, COUNT(*) AS c FROM events WHERE created_at > datetime('now', '-30 days') GROUP BY type ORDER BY c DESC")
    .all();
  const pendingMedia = db.prepare("SELECT * FROM media WHERE review_status = 'pending' ORDER BY created_at LIMIT 100").all();
  const pendingItems = db.prepare("SELECT * FROM items WHERE review_status = 'pending' ORDER BY rowid LIMIT 100").all();
  const pendingTributes = db.prepare("SELECT * FROM tributes WHERE review_status = 'pending' ORDER BY created_at LIMIT 100").all();
  const appeals = db.prepare("SELECT * FROM moderation_appeals WHERE status = 'pending' ORDER BY created_at LIMIT 100").all();
  return NextResponse.json({ memorials, items, digitalHumans, pendingMedia, pendingItems, pendingTributes, appeals, stats });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const data = await req.json();
  const { action, ...payload } = data;
  const db = getDb();

  if (action === "create_memorial") {
    const id = uuid();
    db.prepare(
      `INSERT INTO memorials (id, name, type, avatar_url, birth_date, death_date, epitaph, biography, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      payload.name || "未命名",
      payload.type || "person",
      payload.avatar_url || "",
      payload.birth_date || "",
      payload.death_date || "",
      payload.epitaph || "",
      payload.biography || "",
      payload.is_featured ? 1 : 0
    );
    return NextResponse.json({ success: true, id });
  }

  if (action === "delete_memorial") {
    db.prepare("DELETE FROM tributes WHERE memorial_id = ?").run(payload.id);
    db.prepare("DELETE FROM memorials WHERE id = ?").run(payload.id);
    return NextResponse.json({ success: true });
  }

  if (action === "toggle_featured") {
    const current = db.prepare("SELECT is_featured FROM memorials WHERE id = ?").get(payload.id) as any;
    const newVal = current?.is_featured ? 0 : 1;
    db.prepare("UPDATE memorials SET is_featured = ? WHERE id = ?").run(newVal, payload.id);
    return NextResponse.json({ success: true, is_featured: newVal });
  }

  if (action === "seed_demo") {
    seedDemoData(db);
    return NextResponse.json({ success: true });
  }

  if (action === "review_digital_human") {
    const approve = payload.decision === "approve";
    db.prepare("UPDATE digital_humans SET status = ?, error = ?, review_reason = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(
      approve ? "done" : "failed",
      approve ? "" : "rejected_by_review",
      String(payload.reason || ""),
      admin.id,
      payload.id
    );
    return NextResponse.json({ success: true });
  }

  if (action === "review_content") {
    const tables: Record<string, { table: string; status: string }> = {
      media: { table: "media", status: "review_status" },
      item: { table: "items", status: "review_status" },
      tribute: { table: "tributes", status: "review_status" },
      digital_human: { table: "digital_humans", status: "status" },
    };
    const target = tables[String(payload.resource_type || "")];
    const decision = payload.decision === "approve" ? "approved" : "rejected";
    if (!target || !payload.id || !String(payload.reason || "").trim()) {
      return NextResponse.json({ error: "invalid_review" }, { status: 400 });
    }
    const status = target.table === "digital_humans" ? (decision === "approved" ? "done" : "failed") : decision;
    const result = db.prepare(
      `UPDATE ${target.table} SET ${target.status} = ?, review_reason = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(status, String(payload.reason).slice(0, 500), admin.id, String(payload.id));
    if (!result.changes) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

function seedDemoData(db: any) {
  const memorials = [
    { id: uuid(), name: "王老先生", type: "person", avatar_url: "👴", birth_date: "1932-03-15", death_date: "2023-11-02", epitaph: "一生耕耘，桃李满天下", biography: "王老先生是一位退休教师，一生致力于乡村教育。他培养了无数学生，深受村民爱戴。晚年喜欢养花和下棋，生活简朴而充实。", is_featured: 1 },
    { id: uuid(), name: "小黄", type: "pet", avatar_url: "🐕", birth_date: "2015-06-01", death_date: "2025-01-20", epitaph: "你是我见过最好的狗狗", biography: "小黄是一只金毛犬，陪伴了我们十年。它是最忠诚的朋友，每天早上都会叼着拖鞋等我们起床。它走了，但我们永远记得它在阳光下奔跑的样子。", is_featured: 1 },
    { id: uuid(), name: "陈奶奶", type: "person", avatar_url: "👵", birth_date: "1940-12-08", death_date: "2024-09-15", epitaph: "慈母手中线，游子身上衣", biography: "陈奶奶是一位慈祥的母亲，养育了四个儿女。她擅长做手工面，每年过年都会做一大桌菜。她的笑容温暖了整个家。", is_featured: 0 },
    { id: uuid(), name: "咪咪", type: "pet", avatar_url: "🐱", birth_date: "2018-04-12", death_date: "2025-05-10", epitaph: "爱吃鱼的小公主", biography: "咪咪是一只英短蓝猫，最爱吃三文鱼。它总是趴在窗台上晒太阳，偶尔会抓一些小礼物（比如落叶）带回家。它是我们的小公主。", is_featured: 0 },
    { id: uuid(), name: "刘叔", type: "person", avatar_url: "👨‍🦳", birth_date: "1955-08-22", death_date: "2024-03-18", epitaph: "仗义执言，铁骨柔情", biography: "刘叔是一位退伍军人，后来成为一名社区志愿者。他热心公益，乐于助人，在社区里人缘极好。每年冬天都会给流浪猫搭窝。", is_featured: 0 },
  ];

  const insertMemorial = db.prepare(
    "INSERT OR IGNORE INTO memorials (id, name, type, avatar_url, birth_date, death_date, epitaph, biography, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const m of memorials) {
    insertMemorial.run(m.id, m.name, m.type, m.avatar_url, m.birth_date, m.death_date, m.epitaph, m.biography, m.is_featured);
  }

  const sampleTributes = [
    { memorial_id: memorials[0].id, item_id: "flower_white", sender_name: "学生李明", message: "王老师，谢谢您的教导，我会永远记得您的鼓励", is_burning: 0 },
    { memorial_id: memorials[0].id, item_id: "candle", sender_name: "学生王芳", message: "老师走好，天堂没有病痛", is_burning: 0 },
    { memorial_id: memorials[0].id, item_id: "joss_paper", sender_name: "匿名", message: "给您烧点纸钱，在那边过得好点", is_burning: 1 },
    { memorial_id: memorials[1].id, item_id: "teddy", sender_name: "主人", message: "小黄，你在汪星也要快乐啊", is_burning: 0 },
    { memorial_id: memorials[1].id, item_id: "fruit", sender_name: "邻居小王", message: "小黄以前天天来我家蹭饭，想你了", is_burning: 0 },
    { memorial_id: memorials[2].id, item_id: "incense", sender_name: "女儿", message: "妈，我学会做你教我的手擀面了", is_burning: 0 },
    { memorial_id: memorials[2].id, item_id: "flower_lily", sender_name: "儿子", message: "妈，孩子们都很想你", is_burning: 0 },
    { memorial_id: memorials[3].id, item_id: "letter", sender_name: "铲屎官", message: "咪咪公主，罐罐永远给你留着", is_burning: 0 },
    { memorial_id: memorials[4].id, item_id: "wine", sender_name: "老战友老张", message: "老刘，咱哥俩喝一杯", is_burning: 0 },
  ];

  const insertTribute = db.prepare(
    "INSERT INTO tributes (id, memorial_id, item_id, message, sender_name, is_burning) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const t of sampleTributes) {
    insertTribute.run(uuid(), t.memorial_id, t.item_id, t.message, t.sender_name, t.is_burning);
  }
}
