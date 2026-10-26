// الكتابة: الأرقام لاتينية، كل رقم معزول LTR، المبالغ الكبيرة بالمليون (10,000 دج = 1 مليون).
export const DZD_PER_MILLION = 10000;
export const MILLION_PER_BILLION = 1000;

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function num(n, digits = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return digits ? nf1.format(n) : nf0.format(Math.round(n));
}

// مبلغ كبير: «X مليون» ولا «X مليار». صغير (على الطلبية): «X دج».
export function money(dzd, { small = false } = {}) {
  if (dzd === null || dzd === undefined || !Number.isFinite(dzd)) return 'غير محسوم';
  if (small || Math.abs(dzd) < DZD_PER_MILLION) return `${num(dzd)} دج`;
  const m = dzd / DZD_PER_MILLION;
  if (Math.abs(m) >= MILLION_PER_BILLION) {
    const b = m / MILLION_PER_BILLION;
    return `${nf1.format(Math.round(b * 10) / 10)} مليار`;
  }
  return `${nf1.format(Math.round(m * 10) / 10)} مليون`;
}

export function pct(x, digits = 0) {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'غير محسوم';
  return `${(x * 100).toFixed(digits)}%`;
}

// للواجهة: كل رقم في span LTR.
export function ltr(text) {
  return `<span dir="ltr">${text}</span>`;
}
export function ltrNumbers(text) {
  return String(text).replace(/(−|-)?[0-9](?:[0-9,.%$:]|-(?=[0-9]))*/g, (m) => `<span dir="ltr">${m}</span>`);
}
