export function yuanToCents(yuan) {
  if (typeof yuan !== 'number' && typeof yuan !== 'string') return null;
  const s = String(yuan).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const cents = Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2));
  if (!Number.isInteger(cents) || cents < 0 || cents > 99_999_999) return null;
  return cents;
}

export function centsToYuan(cents) {
  return (cents / 100).toFixed(2);
}

export function sanitize(str, max = 500) {
  if (typeof str !== 'string') return '';
  return str.slice(0, max);
}

export function isNonEmpty(s, max = 200) {
  return typeof s === 'string' && s.trim().length > 0 && s.length <= max;
}

export function safeFilename(name) {
  const base = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(-64);
}