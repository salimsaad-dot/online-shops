import { describe, expect, it } from 'vitest';
import { randomCode, samePhone, slugify } from '../src/lib/util';

describe('samePhone', () => {
  it('matches local and international formats', () => {
    expect(samePhone('+233 24 111 2222', '0241112222')).toBe(true);
    expect(samePhone('024-111-2222', '(024) 111 2222')).toBe(true);
  });
  it('rejects different or too-short numbers', () => {
    expect(samePhone('0241112222', '0241112223')).toBe(false);
    expect(samePhone('12345', '12345')).toBe(false);
  });
});

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('  Kente Scarf — Large!  ')).toBe('kente-scarf-large');
    expect(slugify('Café Crème')).toBe('cafe-creme');
    expect(slugify('***')).toBe('item');
  });
});

describe('randomCode', () => {
  it('uses only unambiguous characters', () => {
    for (let i = 0; i < 50; i++) expect(randomCode(8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
