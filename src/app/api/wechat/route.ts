import { NextRequest, NextResponse } from "next/server";
import { readXmlField, verifyWechatSignature, xmlTextResponse } from "../../../lib/wechat-official";

function tokenConfigured(): string {
  return process.env.WECHAT_MP_TOKEN || "";
}

export async function GET(req: NextRequest) {
  const token = tokenConfigured();
  const params = req.nextUrl.searchParams;
  const valid = token && verifyWechatSignature(params.get("signature") || "", token, params.get("timestamp") || "", params.get("nonce") || "");
  if (!valid) return new NextResponse("invalid signature", { status: 403 });
  return new NextResponse(params.get("echostr") || "", { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const token = tokenConfigured();
  const params = req.nextUrl.searchParams;
  const valid = token && verifyWechatSignature(params.get("signature") || "", token, params.get("timestamp") || "", params.get("nonce") || "");
  if (!valid) return new NextResponse("invalid signature", { status: 403 });
  const xml = await req.text();
  const msgType = readXmlField(xml, "MsgType");
  const content = readXmlField(xml, "Content");
  if (msgType === "text" && content) return new NextResponse(xmlTextResponse("感谢你的留言，彼岸会认真保存这份思念。"), { headers: { "content-type": "application/xml; charset=utf-8" } });
  return new NextResponse("success", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
