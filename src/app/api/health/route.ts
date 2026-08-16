import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getStorageAdapter } from "../../../lib/upload";
import { activeProvider as imagegenProvider } from "../../../lib/imagegen";
import { activeProvider as digitalHumanProvider } from "../../../lib/digitalhuman";

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
  const imageProvider = imagegenProvider();
  checks.imagegen = {
    ok: imageProvider === "mock" || (imageProvider === "ark" ? !!process.env.ARK_API_KEY : !!process.env.DASHSCOPE_API_KEY),
    detail: imageProvider,
  };
  const dhProvider = digitalHumanProvider();
  checks.digitalHuman = {
    ok: dhProvider === "mock" || (dhProvider === "ark" ? !!process.env.ARK_API_KEY : !!process.env.DH_VENDOR_API_KEY),
    detail: dhProvider,
  };
  const criticalOk = checks.database.ok && checks.storage.ok;
  return NextResponse.json({ ok: criticalOk, status: criticalOk ? "healthy" : "unhealthy", checks, timestamp: new Date().toISOString() }, { status: criticalOk ? 200 : 503 });
}
