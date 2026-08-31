import { createHash } from 'node:crypto';

/**
 * Stable hash of a payload. Object keys are sorted, so a source that returns
 * the same data with a different key order does not look like a change.
 */
export function contentHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** Lowercase, strip punctuation, collapse whitespace - for dedupe keys and slugs. */
export function normaliseText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(text, { maxLength = 200 } = {}) {
  const slug = normaliseText(text).replace(/\s/g, '-').replace(/-+/g, '-');
  return slug.slice(0, maxLength).replace(/^-|-$/g, '');
}
