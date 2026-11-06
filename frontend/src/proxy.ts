import { NextResponse, type NextRequest } from "next/server";

const PLATFORM_HOST = (process.env.PLATFORM_HOST ?? "localhost:3001").toLowerCase();

/**
 * Keeps the two "sites" apart:
 *  - the platform host only serves /platform (super admin)
 *  - shop hosts serve the storefront and /admin, never /platform
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;
  const isPlatformPath = pathname === "/platform" || pathname.startsWith("/platform/");

  if (host === PLATFORM_HOST) {
    if (!isPlatformPath) return NextResponse.redirect(new URL("/platform", request.url));
    return NextResponse.next();
  }
  if (isPlatformPath) {
    return NextResponse.rewrite(new URL("/not-found-page", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API proxy, Next internals and static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
