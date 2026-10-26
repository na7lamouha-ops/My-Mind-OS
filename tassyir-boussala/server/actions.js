// مالك واحد لكل قرار: التطبيق يقترح ← التاجر يوافق ← التنفيذ بيد التاجر ولا Tassya ببطاقة موافقة.
// حتى دورو ما يتصرف بلا موافقة. التوقيف ديما مسموح (بلا شروط، غير بنقرة التاجر).
export const LOW_RISK = ['order_comment', 'alert', 'reminder', 'write_tag'];
export const HIGH_RISK = ['scale_up', 'pause_offer', 'cancel', 'production_order', 'destock'];

export function riskOf(type) {
  if (LOW_RISK.includes(type)) return 'low';
  if (HIGH_RISK.includes(type)) return 'high';
  throw new Error(`فعل مجهول: ${type}`);
}

export class Actions {
  constructor(store, executors = {}) {
    this.store = store;
    this.exec = executors;
  }
  async request(type, payload, { why, say } = {}) {
    const risk = riskOf(type);
    if (risk === 'low') {
      const result = this.exec[type] ? await this.exec[type](payload) : null;
      await this.log({ type, payload, risk, status: 'done', why });
      return { status: 'done', result };
    }
    const id = `ap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const card = { id, type, payload, risk, why, say, status: 'pending', createdAt: new Date().toISOString() };
    await this.store.set('business', `approval:${id}`, card);
    return { status: 'pending', card };
  }
  async decide(id, approve) {
    const card = await this.store.get('business', `approval:${id}`);
    if (!card || card.status !== 'pending') throw new Error('بطاقة ماشي موجودة ولا تقرّرت');
    card.status = approve ? 'approved' : 'rejected';
    card.decidedAt = new Date().toISOString();
    if (approve && this.exec[card.type]) card.result = await this.exec[card.type](card.payload);
    await this.store.set('business', `approval:${id}`, card);
    await this.log({ type: card.type, payload: card.payload, risk: 'high', status: card.status, why: card.why });
    return card;
  }
  async pending() {
    return (await this.store.list('business', 'approval:')).map((x) => x.value).filter((c) => c.status === 'pending');
  }
  async log(entry) {
    await this.store.set('business', `log:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, { ...entry, at: new Date().toISOString() });
  }
}
