import assert from "node:assert/strict";
import { createWechatSignature, verifyWechatSignature, xmlTextResponse } from "../src/lib/wechat-official.ts";

const token = "test-token";
const timestamp = "1700000000";
const nonce = "abc123";
const signature = createWechatSignature(token, timestamp, nonce);
assert.equal(verifyWechatSignature(signature, token, timestamp, nonce), true);
assert.equal(verifyWechatSignature("bad", token, timestamp, nonce), false);
assert.equal(xmlTextResponse("success"), "<xml><Content><![CDATA[success]]></Content></xml>");
console.log("wechat official callback tests passed");
