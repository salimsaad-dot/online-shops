// Server-side (Server Components) API access: calls the backend directly with the request's host.
import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Shop } from "./types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function requestHost(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-host") ?? h.get("host") ?? "";
}

export class ServerApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function serverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { "x-shop-host": await requestHost(), accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ServerApiError(res.status, data.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** The shop for this request (deduplicated per render). Renders the 404 page if unknown. */
export const getShop = cache(async (): Promise<Shop> => {
  try {
    const { shop } = await serverGet<{ shop: Shop }>("/shop");
    return shop;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }
});

/** Like serverGet but returns null on 404 (for detail pages). */
export async function serverGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await serverGet<T>(path);
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) return null;
    throw err;
  }
}
