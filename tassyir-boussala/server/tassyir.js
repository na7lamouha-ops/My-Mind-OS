// عميل API تسيير (2026-10). التطبيق = عضو في الفريق بالصلاحيات اللي يعطيهم التاجر.
// المسارات في جدول واحد (ENDPOINTS) باش تتبدّل ساهل كي يتأكّد الشكل النهائي / الماركت بلاس.
import { mergeStageTag } from '../engine/engine.js';

export const API_VERSION = '2026-10';
export const ENDPOINTS = {
  products: { method: 'GET', path: '/products', scope: 'read_products' },
  product: { method: 'GET', path: '/products/:id', scope: 'read_products' },
  updateProduct: { method: 'PATCH', path: '/products/:id', scope: 'write_products' },
  orders: { method: 'GET', path: '/orders', scope: 'read_orders' },
  orderComment: { method: 'POST', path: '/orders/:id/comments', scope: 'write_orders' },
  inventory: { method: 'GET', path: '/inventory', scope: 'read_inventory' },
  costs: { method: 'GET', path: '/costs', scope: 'read_costs' },
  stores: { method: 'GET', path: '/stores', scope: 'read_stores' },
  delivery: { method: 'GET', path: '/delivery', scope: 'read_delivery' },
  appData: { method: 'GET', path: '/apps/data/:scope/:key', scope: null },
};

export class TassyirClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch }) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl;
  }
  async call(name, { params = {}, query, body, method } = {}) {
    const ep = ENDPOINTS[name];
    let p = ep.path;
    for (const [k, v] of Object.entries(params)) p = p.replace(`:${k}`, encodeURIComponent(v));
    const qs = query ? `?${new URLSearchParams(query)}` : '';
    const res = await this.fetch(`${this.baseUrl}${p}${qs}`, {
      method: method || ep.method,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', 'tassyir-api-version': API_VERSION },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 403) throw new Error(`Permission denied: ${ep.scope}`);
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  getProduct(id) {
    return this.call('product', { params: { id } });
  }

  // ⚠️ update_product يبدّل التاغات كاملين ← نقراو القدام ونزيدو عليهم (خطر قليل: بلا موافقة).
  async writeStageTag(productId, stage) {
    const prod = await this.getProduct(productId);
    const tags = mergeStageTag(prod.tags || [], stage);
    await this.call('updateProduct', { params: { id: productId }, body: { tags } });
    return tags;
  }

  // تعليق على الطلبية (write_orders = التعليقات برك). أسباب الرجوع: #R-01…10.
  addOrderComment(orderId, text) {
    return this.call('orderComment', { params: { id: orderId }, body: { text } });
  }

  async appData(op, scope, key, value) {
    const params = { scope, key: key || '' };
    if (op === 'GET') return this.call('appData', { params }).then((r) => r?.value ?? null).catch(() => null);
    if (op === 'PUT') return this.call('appData', { params, method: 'PUT', body: { value } });
    return this.call('appData', { params: { scope, key: '' }, query: { prefix: key || '' } }).then((r) => r?.items || []);
  }
}

// 10 أسباب رجوع — المتتبّع يختار، التطبيق يكتب تعليق #R-…
export const RETURN_REASONS = [
  ['R-01', 'الزبون ما جاوبش'], ['R-02', 'رفض كي شاف السلعة'], ['R-03', 'المقاس ما جاش'], ['R-04', 'اللون ماشي هو'],
  ['R-05', 'ما عندوش الدراهم'], ['R-06', 'شرا من بلاصة أخرى'], ['R-07', 'العنوان غالط'], ['R-08', 'تأخّر التوصيل'],
  ['R-09', 'السلعة فيها عيب'], ['R-10', 'سبب آخر'],
];
export function returnComment(code) {
  const r = RETURN_REASONS.find(([c]) => c === code);
  if (!r) throw new Error('سبب رجوع مجهول');
  return `#${r[0]} ${r[1]} — البوصلة`;
}
