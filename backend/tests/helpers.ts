import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app';

let server: Server;
let base = '';

export async function startServer() {
  server = createApp().listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
}

export async function stopServer() {
  await new Promise<void>((r) => server.close(() => r()));
}

export interface Res<T = any> {
  status: number;
  data: T;
}

/**
 * A browser-like client for one host: keeps its cookie between requests and sends
 * `x-shop-host` the way the Next.js proxy does.
 */
export function client(host: string, extraHeaders: Record<string, string> = {}) {
  let cookie = '';
  const call = async <T = any>(method: string, path: string, body?: unknown): Promise<Res<T>> => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-shop-host': host,
        ...(cookie ? { cookie } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie()[0];
    if (set) cookie = set.split(';')[0];
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, data };
  };
  return {
    get: <T = any>(p: string) => call<T>('GET', p),
    post: <T = any>(p: string, b?: unknown) => call<T>('POST', p, b ?? {}),
    put: <T = any>(p: string, b?: unknown) => call<T>('PUT', p, b ?? {}),
    patch: <T = any>(p: string, b?: unknown) => call<T>('PATCH', p, b ?? {}),
    del: <T = any>(p: string) => call<T>('DELETE', p),
    login: (email: string, password: string) => call('POST', '/auth/login', { email, password }),
  };
}

export const DEMO = 'demo.localhost:3001';
export const PLATFORM = 'localhost:3001';
export const OWNER = { email: 'owner@demo.local', password: 'owner12345' };
export const SUPER = { email: 'admin@platform.local', password: 'admin12345' };
