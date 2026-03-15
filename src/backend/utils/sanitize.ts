const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

export function sanitizeText(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeEmail(value: unknown, maxLength = 254) {
  return sanitizeText(value, maxLength).toLowerCase();
}

export function sanitizeDigits(value: unknown, maxLength = 32) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function sanitizeId(value: unknown, maxLength = 100) {
  const cleaned = sanitizeText(value, maxLength);
  if (!/^[A-Za-z0-9:_-]+$/.test(cleaned)) return '';
  return cleaned;
}

export function sanitizeUuid(value: unknown) {
  const cleaned = sanitizeText(value, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(cleaned)) {
    return '';
  }
  return cleaned;
}

export function sanitizeMoney(value: unknown) {
  if (typeof value !== 'string') return '';
  const cleaned = sanitizeText(value, 30);
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return '';
  return cleaned;
}

export function sanitizeToken(value: unknown, maxLength = 256) {
  const cleaned = sanitizeText(value, maxLength);
  if (!/^[A-Za-z0-9._-]+$/.test(cleaned)) return '';
  return cleaned;
}
