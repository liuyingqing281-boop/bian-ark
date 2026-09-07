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

/** 原型屏蔽时返回与正式 404 一致的响应（不暴露屏蔽原因，与未知路由行为一致） */
function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

// 原型/演示路由的可见性开关（docs/16 P0-2）：
// - 生产（NODE_ENV=production）默认屏蔽，需显式 ENABLE_PROTO_ROUTES=true 才放行
// - 开发环境默认放行（本地高保真原型/概念页/showreel 照常可用）
// 请求期读取 env（而非模块快照），便于测试与运行时切换
function protoRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_PROTO_ROUTES === "true";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // 概念落地页：作为站点首页，独立于 [lang] 体系
  if (pathname === "/concept" || pathname.startsWith("/concept/")) {
    return protoRoutesEnabled() ? NextResponse.next() : notFound();
  }
  // 产品 Showreel：沉浸式独立路由，跳过多语言重定向
  if (pathname === "/showreel" || pathname.startsWith("/showreel/")) {
    return protoRoutesEnabled() ? NextResponse.next() : notFound();
  }
  if (pathname === "/") {
    // 根路径统一进概念页（WebGL 落地页），由页内 CTA 引导进入 /zh；
    // 原型屏蔽时根路径直接进语言首页（产品主入口）
    if (protoRoutesEnabled()) {
      return NextResponse.redirect(new URL("/concept", request.url));
    }
    const rootLocale =
      request.cookies.get("NEXT_LOCALE")?.value === "en" || detectLocale(request) === "en"
        ? "en"
        : "zh";
    return NextResponse.redirect(new URL(`/${rootLocale}`, request.url));
  }
  const isProto =
    pathname === "/prototype" || pathname.startsWith("/prototype/") ||
    pathname === "/proto-zcode" || pathname.startsWith("/proto-zcode/") ||
    pathname === "/proto" || pathname.startsWith("/proto/");
  if (isProto) {
    // 高保真原型路由：独立于 [lang] 体系，跳过多语言重定向
    return protoRoutesEnabled() ? NextResponse.next() : notFound();
  }
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
