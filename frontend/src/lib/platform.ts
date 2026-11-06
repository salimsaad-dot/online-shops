// URLs for a shop, given the platform domain configured for the frontend.
const PLATFORM_HOST = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? "localhost:3001";

/** e.g. "localhost:3001" → shop "demo" lives at demo.localhost:3001 */
export function shopUrl(slug: string): string {
  const secure = !PLATFORM_HOST.startsWith("localhost");
  // Platform host may be "app.example.com"; shops are <slug>.example.com
  const base = PLATFORM_HOST.startsWith("localhost") ? PLATFORM_HOST : PLATFORM_HOST.replace(/^[^.]+\./, "");
  return `${secure ? "https" : "http"}://${slug}.${base}`;
}

export function domainUrl(host: string): string {
  return `${host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https"}://${host}`;
}
