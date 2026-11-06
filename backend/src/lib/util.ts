import crypto from 'node:crypto';

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

/** Random uppercase code without ambiguous characters (0/O, 1/I). */
export function randomCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * True when two phone numbers refer to the same subscriber, ignoring formatting and the
 * country/trunk prefix: "+233 24 111 2222" matches "0241112222". Compares the last 9 digits.
 * Only used together with a second secret (order number / message reference).
 */
export function samePhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  if (da.length < 7 || db.length < 7) return false;
  return da.slice(-9) === db.slice(-9);
}

/** Escape LIKE wildcards in user search input. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}
