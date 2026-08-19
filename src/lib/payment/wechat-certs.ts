import fs from "node:fs";
import path from "node:path";
import { createDecipheriv, createSign, randomBytes } from "node:crypto";

export interface WechatPlatformCertificate {
  serialNo: string;
  effectiveTime: number;
  expireTime: number;
  pem: string;
}

interface CertificateFile {
  certificates: WechatPlatformCertificate[];
}

const API_BASE = "https://api.mch.weixin.qq.com";
let memory: WechatPlatformCertificate[] | null = null;
let refreshPromise: Promise<WechatPlatformCertificate[]> | null = null;

const env = (name: string) => process.env[name] || "";
const privateKey = () => env("WECHAT_PAY_PRIVATE_KEY").replace(/\\n/g, "\n");
const cachePath = () => path.resolve(process.env.WECHAT_PAY_CERT_CACHE_PATH || path.join(process.cwd(), "data", "payment", "wechat-platform-certs.json"));

function decryptCertificate(resource: { nonce: string; associated_data: string; ciphertext: string }): string {
  const key = Buffer.from(env("WECHAT_PAY_API_V3_KEY"), "utf8");
  if (key.length !== 32) throw new Error("wechat_invalid_api_v3_key");
  const encrypted = Buffer.from(resource.ciphertext, "base64");
  if (encrypted.length <= 16) throw new Error("wechat_invalid_certificate_ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(resource.nonce, "utf8"));
  decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  decipher.setAuthTag(encrypted.subarray(-16));
  return Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString("utf8");
}

function readDisk(): WechatPlatformCertificate[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath(), "utf8")) as CertificateFile;
    return Array.isArray(parsed.certificates) ? parsed.certificates.filter((item) => item.serialNo && item.pem && item.expireTime > Date.now()) : [];
  } catch {
    return [];
  }
}

function writeDisk(certificates: WechatPlatformCertificate[]): void {
  const target = cachePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ certificates }, null, 2), { mode: 0o600 });
  fs.renameSync(temp, target);
}

function signRequest(timestamp: string, nonce: string, body: string): string {
  return createSign("RSA-SHA256").update(`${timestamp}\n${nonce}\n${body}\n`).sign(privateKey(), "base64");
}

async function download(): Promise<WechatPlatformCertificate[]> {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${env("WECHAT_PAY_MCH_ID")}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env("WECHAT_PAY_SERIAL_NO")}",signature="${signRequest(timestamp, nonce, "")}"`;
  const response = await fetch(`${API_BASE}/v3/certificates`, { headers: { Accept: "application/json", Authorization: authorization } });
  if (!response.ok) throw new Error("wechat_certificate_download_failed");
  const payload = await response.json() as { data?: Array<{ serial_no: string; effective_time: string; expire_time: string; encrypt_certificate: { nonce: string; associated_data: string; ciphertext: string } }> };
  const certificates = (payload.data || []).map((item) => ({ serialNo: item.serial_no, effectiveTime: Date.parse(item.effective_time), expireTime: Date.parse(item.expire_time), pem: decryptCertificate(item.encrypt_certificate) })).filter((item) => item.serialNo && item.pem && Number.isFinite(item.expireTime));
  if (!certificates.length) throw new Error("wechat_platform_certificates_empty");
  writeDisk(certificates);
  memory = certificates;
  return certificates;
}

export async function refreshWechatPlatformCertificates(): Promise<WechatPlatformCertificate[]> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = download().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function getWechatPlatformCertificate(serialNo: string): Promise<WechatPlatformCertificate | undefined> {
  if (!memory) memory = readDisk();
  const found = memory.find((item) => item.serialNo === serialNo && item.expireTime > Date.now());
  if (found) return found;
  try {
    const refreshed = await refreshWechatPlatformCertificates();
    return refreshed.find((item) => item.serialNo === serialNo);
  } catch {
    return undefined;
  }
}
