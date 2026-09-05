import { createHash, timingSafeEqual } from "node:crypto";

export function createWechatSignature(token: string, timestamp: string, nonce: string): string {
  return createHash("sha1").update([token, timestamp, nonce].sort().join(""), "utf8").digest("hex");
}

export function verifyWechatSignature(signature: string, token: string, timestamp: string, nonce: string): boolean {
  const expected = createWechatSignature(token, timestamp, nonce);
  const actual = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function xmlTextResponse(content: string): string {
  const safe = content.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<xml><Content><![CDATA[${safe}]]></Content></xml>`;
}

export function readXmlField(xml: string, field: string): string {
  const match = xml.match(new RegExp(`<${field}><!\\[CDATA\\[(.*?)\\]\\]></${field}>`, "s"));
  return match?.[1] || "";
}
