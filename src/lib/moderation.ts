// Content moderation adapter (PRD F1.6).
// MVP default: pass-through with manual review as the safety net.
// When ALIYUN_GREEN_ACCESS_KEY_ID/SECRET are configured, text is screened via
// Aliyun Content Security (TextModerationPlus, ACS3-HMAC-SHA256 signed).
import { createHmac, createHash, randomUUID } from "crypto";

export interface ModerationResult {
  pass: boolean;
  status: "approved" | "pending" | "rejected";
  reason?: string;
}

export function moderationEnabled(): boolean {
  return !!(process.env.ALIYUN_GREEN_ACCESS_KEY_ID && process.env.ALIYUN_GREEN_ACCESS_KEY_SECRET);
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac256(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

async function aliyunGreenText(text: string): Promise<ModerationResult> {
  const accessKeyId = process.env.ALIYUN_GREEN_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.ALIYUN_GREEN_ACCESS_KEY_SECRET!;
  const host = "green-cip.cn-shanghai.aliyuncs.com";
  const body = JSON.stringify({
    service: "chat_detection",
    serviceParameters: JSON.stringify({ content: text }),
  });

  const hashedPayload = sha256Hex(body);
  const nonce = randomUUID();
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const headers: Record<string, string> = {
    host,
    "x-acs-action": "TextModerationPlus",
    "x-acs-version": "2022-03-02",
    "x-acs-date": date,
    "x-acs-signature-nonce": nonce,
    "x-acs-content-sha256": hashedPayload,
  };
  const signedKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeadersStr = signedKeys.join(";");
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeadersStr, hashedPayload].join("\n");
  const stringToSign = ["ACS3-HMAC-SHA256", sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac256(`acs3-${accessKeySecret}`, stringToSign).toString("hex");
  const authorization = `ACS3-HMAC-SHA256 Credential=${accessKeyId},SignedHeaders=${signedHeadersStr},Signature=${signature}`;

  const resp = await fetch(`https://${host}/`, {
    method: "POST",
    headers: { ...headers, Authorization: authorization, "Content-Type": "application/json" },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("[moderation] aliyun green error", resp.status, data);
    // fail-open to manual review rather than silently dropping content
    return { pass: true, status: "pending", reason: "moderation_unavailable" };
  }
  const labels: string = data?.Data?.Result?.[0]?.Label || data?.Data?.Labels || "";
  const risky = labels && !/^(nonLabel|normal)$/i.test(labels);
  return risky
    ? { pass: false, status: "rejected", reason: labels }
    : { pass: true, status: "approved" };
}

export async function moderateText(text: string): Promise<ModerationResult> {
  if (!text || !text.trim()) return { pass: true, status: "approved" };
  if (!moderationEnabled()) return { pass: true, status: "pending", reason: "moderation_not_configured" };
  try {
    return await aliyunGreenText(text.slice(0, 900));
  } catch (err) {
    console.error("[moderation] failed", err);
    return { pass: true, status: "pending", reason: "moderation_error" };
  }
}
