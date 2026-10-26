// الخادم: الصفحة داخل اللوحة (App Bridge) + API + webhooks + الجدولة (04:00 سحب، 08:00 تقرير، كل ساعة تنبيه صامت).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeBusiness, nextRunAt, policyOf, mergeStageTag, stageOf } from '../engine/engine.js';
import { buildDailyReport, hourlyAlert } from '../engine/report.js';
import { makeDemo } from '../demo/data.js';
import { FileStore } from './store.js';
import { verifySignature, publicKeyFrom, Deduper, applyOrderEvent, ORDER_TOPICS } from './webhooks.js';
import { TassyirClient, RETURN_REASONS, returnComment } from './tassyir.js';
import { Actions } from './actions.js';
import { loadLiveData } from './live.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = process.env;
const DEMO = env.BOUSSALA_DEMO === '1' || !env.TASSYIR_TOKEN;
const store = new FileStore(env.BOUSSALA_DATA || path.join(ROOT, '.data', 'appdata.json'));
const client = DEMO ? null : new TassyirClient({ baseUrl: env.TASSYIR_API_URL, token: env.TASSYIR_TOKEN });
const pubKey = publicKeyFrom(env.TASSYIR_WEBHOOK_PUBLIC_KEY);
const dedupe = new Deduper(store);
let demoState = null;

const today = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10); // الجزائر UTC+1

async function loadData() {
  if (DEMO) {
    demoState ||= makeDemo(today());
    return demoState;
  }
  return loadLiveData(client, store);
}

const actions = new Actions(store, {
  write_tag: async ({ productId, stage }) => {
    if (DEMO) {
      const p = demoState.products.find((x) => x.id === productId);
      const from = stageOf(p.tags);
      p.tags = mergeStageTag(p.tags, stage);
      p.tagHistory = [...(p.tagHistory || []), { date: today(), from, to: stage, why: 'البوصلة' }];
      return p.tags;
    }
    return client.writeStageTag(productId, stage);
  },
  order_comment: async ({ orderId, text }) => (DEMO ? { orderId, text } : client.addOrderComment(orderId, text)),
  alert: async (x) => x,
  reminder: async (x) => x,
  // الأفعال الكبار: التنفيذ بيد التاجر ولا Tassya — التطبيق ما ينفّذش وحدو، يسجّل الموافقة برك.
  scale_up: async (x) => ({ handedTo: 'Tassya', ...x }),
  pause_offer: async (x) => ({ handedTo: 'Tassya', ...x }),
  cancel: async (x) => ({ handedTo: 'Tassya', ...x }),
  production_order: async (x) => ({ handedTo: 'Tassya', ...x }),
  destock: async (x) => ({ handedTo: 'Tassya', ...x }),
});

async function snapshot() {
  return analyzeBusiness(await loadData(), today());
}

async function makeReport() {
  const snap = await snapshot();
  const rep = buildDailyReport(snap);
  await store.set('business', `report:${rep.date}`, { ...rep, generatedAt: new Date().toISOString() });
  return rep;
}

// ───── الجدولة ─────
function schedule(hour, fn) {
  const tick = () => {
    const pol = policyOf({});
    const at = nextRunAt(Date.now(), hour, pol.timezoneOffsetHours);
    setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        console.error('[schedule]', e.message);
      }
      tick();
    }, at - Date.now()).unref();
  };
  tick();
}
schedule(DEFAULT_HOUR('pull'), async () => {
  demoState = null; // سحب الأرقام من جديد
  const snap = await snapshot();
  await store.set('business', `equity:${today()}`, { wallets: snap.split.cash, carrier: snap.split.atCarrier, stock: snap.split.locked });
});
schedule(DEFAULT_HOUR('report'), async () => {
  const rep = await makeReport();
  await store.set('business', 'notification:latest', { title: 'تقرير البوصلة', body: rep.sections[0].lines.join('\n'), at: new Date().toISOString() });
});
setInterval(async () => {
  try {
    const h = hourlyAlert(await snapshot());
    if (h.send) await store.set('business', 'notification:latest', { title: '🛑/🔴 البوصلة', body: h.lines.join('\n'), at: new Date().toISOString() });
  } catch (e) {
    console.error('[hourly]', e.message);
  }
}, 3600000).unref();
function DEFAULT_HOUR(kind) {
  const p = policyOf({});
  return kind === 'pull' ? p.pullHour : p.reportHour;
}

// ───── HTTP ─────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function handleWebhook(req, res) {
  const body = await readBody(req);
  const h = { id: req.headers['webhook-id'], timestamp: req.headers['webhook-timestamp'], signature: req.headers['webhook-signature'], body };
  if (!DEMO) {
    const v = verifySignature(h, pubKey);
    if (!v.ok) return send(res, 401, { error: v.reason });
  }
  if (await dedupe.seen(h.id)) return send(res, 200, { duplicate: true }); // 200 باش تسيير ما يعاودش
  const evt = JSON.parse(body);
  const topic = evt.topic || req.headers['webhook-topic'];
  if (ORDER_TOPICS.includes(topic)) {
    const order = evt.data || evt.order;
    const prev = await store.get(`order:${order.id}`, 'state');
    const r = applyOrderEvent(prev, topic, order, evt.createdAt || new Date().toISOString());
    await store.set(`order:${order.id}`, 'state', r.state);
    for (const pid of r.state.productIds) {
      const key = `counters:${today()}`;
      const c = (await store.get(`product:${pid}`, key)) || {};
      for (const k of r.counters) c[k] = (c[k] || 0) + 1;
      if (r.firstContactMin !== null && topic !== 'orders/created' && !prev?.firstChangeAt) (c.firstContact ||= []).push(r.firstContactMin);
      if (topic === 'orders/cancelled') (c.cancelReasons ||= {})[r.state.cancelReason] = ((c.cancelReasons || {})[r.state.cancelReason] || 0) + 1;
      await store.set(`product:${pid}`, key, c);
    }
  }
  return send(res, 200, { ok: true });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (req.method === 'POST' && p === '/webhooks/tassyir') return handleWebhook(req, res);
    if (p === '/api/snapshot') return send(res, 200, { demo: DEMO, ...(await snapshot()) });
    if (p === '/api/report/today') {
      const saved = await store.get('business', `report:${today()}`);
      return send(res, 200, saved || (await makeReport()));
    }
    if (p === '/api/report/archive') {
      const list = await store.list('business', 'report:');
      return send(res, 200, list.map((x) => ({ date: x.value.date, generatedAt: x.value.generatedAt })).sort((a, b) => (a.date < b.date ? 1 : -1)));
    }
    if (p.startsWith('/api/report/')) return send(res, 200, (await store.get('business', `report:${p.split('/').pop()}`)) || { error: 'ماكاش' });
    if (p === '/api/return-reasons') return send(res, 200, RETURN_REASONS);
    if (req.method === 'POST' && p === '/api/actions') {
      const { type, payload, why, say } = JSON.parse(await readBody(req));
      if (type === 'order_comment' && payload.returnCode) payload.text = returnComment(payload.returnCode);
      return send(res, 200, await actions.request(type, payload, { why, say }));
    }
    if (p === '/api/approvals') return send(res, 200, await actions.pending());
    const m = p.match(/^\/api\/approvals\/([\w-]+)\/(approve|reject)$/);
    if (req.method === 'POST' && m) return send(res, 200, await actions.decide(m[1], m[2] === 'approve'));
    if (p === '/api/notification') return send(res, 200, (await store.get('business', 'notification:latest')) || null);
    // الصفحة
    const file = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const full = path.join(ROOT, 'web', path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(path.join(ROOT, 'web'))) return send(res, 403, 'no');
    const ext = path.extname(full);
    if (p.startsWith('/engine/')) {
      const e = path.join(ROOT, path.normalize(p).replace(/^\/+/, ''));
      if (!e.startsWith(path.join(ROOT, 'engine'))) return send(res, 403, 'no');
      return send(res, 200, await fs.readFile(e), MIME['.js']);
    }
    return send(res, 200, await fs.readFile(full), MIME[ext] || 'application/octet-stream');
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, { error: 'ماكاش' });
    console.error(e);
    return send(res, 500, { error: e.message });
  }
});

const PORT = Number(env.PORT || 8787);
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(PORT, () => console.log(`البوصلة ← http://localhost:${PORT} ${DEMO ? '(بيانات تجريبية)' : ''}`));
}
export { server };
