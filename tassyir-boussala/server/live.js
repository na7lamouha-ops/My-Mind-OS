// تجميع بيانات التاجر من تسيير + بيانات التطبيق ← نفس الشكل اللي يقراه المحرّك.
// اللي ما كاينش في API (الصرف، المالية) يجي من ميتا ولا من التاجر، ومكتوب مصدرو.
export async function loadLiveData(client, store) {
  const [products, inventory, costs, delivery] = await Promise.all([
    client.call('products', { query: { limit: 100 } }),
    client.call('inventory'),
    client.call('costs').catch(() => null), // read_costs حساسة: لو ما تعطاتش ← «غير محسوم»
    client.call('delivery').catch(() => null),
  ]);
  const business = (await store.get('business', 'settings')) || {};
  const finance = (await store.get('business', 'finance')) || {}; // التاجر يأكّد (ما كاينش read_finance)
  const items = (products.items || products).map((p) => p);
  const out = [];
  for (const p of items) {
    const plan = (await store.get(`product:${p.id}`, 'plan')) || {};
    const daily = (await store.get(`product:${p.id}`, 'daily')) || []; // من webhooks + ميتا
    const cost = costs?.items?.find((c) => c.productId === p.id) || {};
    const inv = (inventory.items || []).filter((i) => i.productId === p.id);
    out.push({
      id: p.id, name: p.name, tags: p.tags || [], image: p.images?.[0],
      sell: p.price, buy: cost.purchasePrice ?? p.costPrice, pack: plan.pack, delCost: plan.delCost ?? delivery?.averageFeeDiff, retCost: plan.retCost ?? delivery?.returnFee,
      ...plan, daily,
      variants: inv.map((i) => ({ sku: i.variantId, label: i.variantLabel || i.sku, inventory: { sellable: i.sellable, totalItems: i.totalItems, delivered: i.delivered, inTransit: i.inTransit, damaged: i.damaged }, out: i.out7 || [], backIn: i.backIn7 || [], delivered: i.delivered7 || [] })),
    });
  }
  return { demo: false, business: { ...business, ...finance }, products: out };
}
