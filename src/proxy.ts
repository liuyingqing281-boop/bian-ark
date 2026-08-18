import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

// Keep these in sync with src/app/[lang]/dictionaries.ts.
// Proxy runs in isolation and should not import app modules.
const locales = ["zh", "en"];
const defaultLocale = "zh";

function detectLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return acceptLanguage.includes("zh") ? "zh" : "en";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase();
    const origin = request.headers.get("origin");
    if (origin) {
      // 反向代理后 Node 侧看到的是 http + 内网 Host，需用转发头推导浏览器真实 origin
      const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] || "http";
      const host = request.headers.get("x-forwarded-host")?.split(",")[0] || request.headers.get("host") || "";
      const expected = `${proto}://${host.trim()}`;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && origin !== expected && origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
      }
    }
    const requestHeaders = new Headers(request.headers);
    const requestId = requestHeaders.get("x-request-id") || randomUUID();
    requestHeaders.set("x-request-id", requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    return response;
  }
  const matched = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (matched) {
    // Remember the explicit locale choice from the URL.
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", matched, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const locale =
    cookieLocale && locales.includes(cookieLocale) ? cookieLocale : detectLocale(request) || defaultLocale;
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!uploads|_next/static|_next/image|_next/dev|favicon.ico).*)"],
};
