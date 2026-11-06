/**
 * Same-origin proxy: browser → /api/* on the shop's own domain → Express backend.
 * Keeps the auth cookie first-party on every client domain and tells the backend which
 * shop is being served via the `x-shop-host` header.
 */
import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

// Request headers we pass through to the backend (everything else is dropped).
const FORWARD_REQUEST = ["content-type", "cookie", "accept", "user-agent", "accept-language", "origin"];
// Shared with the backend so it can trust the client IP we forward (see backend middleware/security.ts).
const PROXY_SECRET = process.env.INTERNAL_PROXY_SECRET;
// Response headers we pass back to the browser.
const FORWARD_RESPONSE = ["content-type", "set-cookie", "cache-control", "ratelimit", "ratelimit-policy", "retry-after"];

async function handler(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  if (path.some((seg) => seg === "." || seg === "..")) {
    return Response.json({ message: "Bad path" }, { status: 400 });
  }
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, BACKEND_URL);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  headers.set("x-shop-host", host);
  // On Vercel the first x-forwarded-for entry is the real client IP (set by Vercel's edge).
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (clientIp && PROXY_SECRET) {
    headers.set("x-client-ip", clientIp);
    headers.set("x-internal-proxy-secret", PROXY_SECRET);
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error -- required by Node fetch when streaming a request body
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json({ message: "The store is temporarily unavailable. Please try again." }, { status: 502 });
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    if (name === "set-cookie") {
      for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", c);
    } else {
      const v = upstream.headers.get(name);
      if (v) out.set(name, v);
    }
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
