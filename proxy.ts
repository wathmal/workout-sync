import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed the `middleware` file convention to `proxy`.
// Phone-class UA → mobile shell. iPadOS Safari reports a desktop UA, so tablets
// land on desktop (intentional — the mobile shell is phone-first).
const MOBILE_UA =
  /Android|iPhone|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile|webOS/i;

// Server picks the shell ONCE per request (no client flash, no double bundle).
// Layout reads `x-shell`; pages read it too when they branch content.
// Override order: ?shell=m|d (sticks via cookie) → cookie → UA. The query
// override makes Playwright + manual desktop testing trivial.
export function proxy(req: NextRequest) {
  const override = req.nextUrl.searchParams.get("shell");
  const cookie = req.cookies.get("shell")?.value;
  const ua = req.headers.get("user-agent") ?? "";

  const pick = override ?? cookie ?? (MOBILE_UA.test(ua) ? "m" : "d");
  const shell = pick === "m" ? "m" : "d";

  const headers = new Headers(req.headers);
  headers.set("x-shell", shell);

  const res = NextResponse.next({ request: { headers } });
  if (override === "m" || override === "d") {
    res.cookies.set("shell", override, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = {
  // Skip API + static assets + PWA files; only page routes need a shell.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|muscle-svg|.*\\.(?:svg|png|ico|webmanifest)).*)",
  ],
};
