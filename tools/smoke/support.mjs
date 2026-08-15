import path from "node:path";
import { randomBytes } from "node:crypto";

const DEFAULT_BASE_URL = "http://localhost:3002";

export function createRunContext(suiteName) {
  const suite = String(suiteName || "smoke").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const runId = `${suite}-${Date.now()}-${randomBytes(3).toString("hex")}`;
  return {
    suite,
    runId,
    testEmail(role = "user") {
      const safeRole = String(role).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      return `smoke-${suite}-${safeRole}-${runId}@test.local`;
    },
  };
}

export function testEmail(role, context = createRunContext("smoke")) {
  return context.testEmail(role);
}

export function createCookieJar() {
  const cookies = new Map();
  return {
    get size() {
      return cookies.size;
    },
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    setCookieHeader(header) {
      if (!header) return;
      const values = Array.isArray(header) ? header : [header];
      for (const value of values) {
        const pair = String(value).split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator <= 0) continue;
        const name = pair.slice(0, separator).trim();
        const cookieValue = pair.slice(separator + 1).trim();
        if (!cookieValue) cookies.delete(name);
        else cookies.set(name, cookieValue);
      }
    },
    has(name) {
      return cookies.has(name);
    },
    clear() {
      cookies.clear();
    },
  };
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const header = headers.get("set-cookie");
  return header ? [header] : [];
}

export function createApiClient({ baseUrl = resolveBaseUrl(), cookieJar = createCookieJar(), suite = "smoke", identity = null, timeoutMs = 15_000 } = {}) {
  const root = baseUrl.replace(/\/$/, "");
  return {
    cookieJar,
    async request(pathname, { method = "GET", body, json, form, auth = true, redirect = "manual", timeout = timeoutMs } = {}) {
      if (identity) console.log(`[${suite}] identity=${identity} ${method} ${pathname}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const headers = {};
      let payload = body;
      if (json !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(json);
      } else if (body !== undefined && !(body instanceof FormData) && typeof body !== "string" && !(body instanceof URLSearchParams)) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
      } else if (form !== undefined) {
        payload = form;
      }
      if (auth && cookieJar.size) headers.cookie = cookieJar.header();
      try {
        const response = await fetch(`${root}${pathname}`, { method, headers, body: payload, redirect, signal: controller.signal });
        cookieJar.setCookieHeader(getSetCookieHeaders(response.headers));
        const text = await response.text();
        let jsonBody = null;
        try { jsonBody = JSON.parse(text); } catch { /* HTML or empty response */ }
        return { status: response.status, ok: response.ok, json: jsonBody, body: jsonBody, text, raw: text, suite, pathname };
      } catch (error) {
        const message = error?.name === "AbortError" ? `request_timeout_${timeout}ms` : (error?.message || "request_failed");
        throw new Error(`[${suite}] ${method} ${pathname}: ${message}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function createReporter({ suite, context = null } = {}) {
  let failures = 0;
  let passes = 0;
  const prefix = context?.runId ? `[${suite} ${context.runId}]` : `[${suite}]`;
  return {
    check(name, actual, expected = true) {
      const pass = check(name, actual, expected, { prefix });
      if (!pass) failures += 1;
      else passes += 1;
      return pass;
    },
    assert(condition, message, details = "") {
      const pass = assert(condition, message, details, { prefix, throwOnFailure: false });
      if (pass) passes += 1;
      else failures += 1;
      return pass;
    },
    get failures() {
      return failures;
    },
    get passes() {
      return passes;
    },
  };
}

export function check(name, actual, expected = true, { prefix = "[smoke]" } = {}) {
  const pass = actual === expected;
  console.log(`${prefix} ${pass ? "PASS" : "FAIL"} ${name}: ${actual} (expect ${expected})`);
  return pass;
}

export function assert(condition, message, details = "", { prefix = "[smoke]", throwOnFailure = true } = {}) {
  if (condition) return true;
  const suffix = details ? ` ${safeSummary(details)}` : "";
  const error = new Error(`${prefix} ASSERT ${message}${suffix}`);
  if (throwOnFailure) throw error;
  console.error(error.message);
  return false;
}

export async function waitFor(predicate, { timeoutMs = 30_000, intervalMs = 1_000, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await predicate();
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`wait_for_timeout: ${label}; last=${safeSummary(lastValue)}`);
}

export function resolveDbPath() {
  return path.resolve(process.env.SMOKE_DB_PATH || path.join(process.cwd(), "data", "bian.db"));
}

export function resolveBaseUrl() {
  return process.env.BASE_URL || DEFAULT_BASE_URL;
}

function safeSummary(value) {
  if (value === undefined) return "undefined";
  try { return JSON.stringify(value).slice(0, 500); } catch { return String(value); }
}
