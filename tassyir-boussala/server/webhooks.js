// Webhooks تسيير: موقّعين بـ Ed25519 (Standard Webhooks «v1a»)، يوصلو مرة ولا أكثر ← نحيّو المكرّر بـ webhook-id.
import crypto from 'node:crypto';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function publicKeyFrom(raw) {
  if (!raw) return null;
  if (raw.includes('BEGIN PUBLIC KEY')) return crypto.createPublicKey(raw);
  const bytes = Buffer.from(raw.replace(/^whpk_/, ''), 'base64');
  return crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, bytes]), format: 'der', type: 'spki' });
}

export function verifySignature({ id, timestamp, signature, body }, publicKey, { toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!id || !timestamp || !signature || !publicKey) return { ok: false, reason: 'headers ناقصين' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return { ok: false, reason: 'timestamp قديم' };
  const data = Buffer.from(`${id}.${timestamp}.${body}`);
  for (const part of String(signature).split(' ')) {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1a' || !sig) continue;
    try {
      if (crypto.verify(null, data, publicKey, Buffer.from(sig, 'base64'))) return { ok: true };
    } catch {
      /* توقيع مكسور ← نجرّبو اللي بعدو */
    }
  }
  return { ok: false, reason: 'توقيع غالط' };
}

// المكرّر: نحفظو webhook-id (في بيانات التطبيق) ونرفضو الثاني.
export class Deduper {
  constructor(store, { ttlMs = 7 * 86400000 } = {}) {
    this.store = store;
    this.ttlMs = ttlMs;
  }
  async seen(id, nowMs = Date.now()) {
    const key = `webhook:${id}`;
    const prev = await this.store.get('business', key);
    if (prev && nowMs - prev < this.ttlMs) return true;
    await this.store.set('business', key, nowMs);
    return false;
  }
}

// تطبيق الحدث على حالة الطلبية + العدّادات اليومية (idempotent على الانتقال).
export const ORDER_TOPICS = ['orders/created', 'orders/confirmed', 'orders/cancelled', 'orders/dispatched', 'orders/delivered', 'orders/returned', 'orders/updated'];
const COUNTER = { 'orders/created': 'leads', 'orders/confirmed': 'confirmed', 'orders/cancelled': 'cancelled', 'orders/delivered': 'delivered', 'orders/returned': 'returned' };

export function applyOrderEvent(state, topic, order, atIso) {
  const s = state || { id: order.id, productIds: [], seen: {}, createdAt: null, firstChangeAt: null };
  s.productIds = (order.lineItems || order.items || []).map((li) => li.productId).filter(Boolean);
  if (order.productId && !s.productIds.length) s.productIds = [order.productId];
  s.utm = order.utm || s.utm || null;
  const counters = [];
  if (topic === 'orders/created' && !s.createdAt) s.createdAt = atIso;
  if (topic !== 'orders/created' && topic !== 'orders/updated' && !s.firstChangeAt) s.firstChangeAt = atIso; // وقت أول اتصال
  const c = COUNTER[topic];
  if (c && !s.seen[topic]) {
    s.seen[topic] = atIso;
    counters.push(c);
  }
  if (topic === 'orders/cancelled') s.cancelReason = order.cancellation?.reasonLabel || 'بلا سبب';
  if (order.delivery?.carrierStatus) s.carrierStatus = order.delivery.carrierStatus;
  const firstContactMin = s.createdAt && s.firstChangeAt ? (Date.parse(s.firstChangeAt) - Date.parse(s.createdAt)) / 60000 : null;
  return { state: s, counters, firstContactMin };
}
