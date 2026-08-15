import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getStorageAdapter } from "../../../lib/upload";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    const row = getDb().prepare("SELECT 1 AS ok").get() as { ok: number };
    checks.database = { ok: row.ok === 1 };
  } catch (error) { checks.database = { ok: false, detail: error instanceof Error ? error.message : "failed" }; }
  try { checks.storage = { ok: await getStorageAdapter().health() }; }
  catch (error) { checks.storage = { ok: false, detail: error instanceof Error ? error.message : "failed" }; }
  checks.stripe = { ok: !!process.env.STRIPE_SECRET_KEY, detail: process.env.STRIPE_SECRET_KEY ? undefined : "not_configured" };
  checks.wechat = { ok: !!process.env.WECHAT_APP_ID, detail: process.env.WECHAT_APP_ID ? undefined : "not_configured" };
  checks.digitalHuman = { ok: (process.env.DIGITALHUMAN_PROVIDER || "mock") === "mock" || !!process.env.DH_VENDOR_API_KEY, detail: process.env.DIGITALHUMAN_PROVIDER ? undefined : "mock" };
  const criticalOk = checks.database.ok && checks.storage.ok;
  return NextResponse.json({ ok: criticalOk, status: criticalOk ? "healthy" : "unhealthy", checks, timestamp: new Date().toISOString() }, { status: criticalOk ? 200 : 503 });
}
