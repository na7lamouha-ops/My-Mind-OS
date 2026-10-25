/*!
 * بوصلة التاجر — قراءة تسيير (Tassyir) → مدخلات الوكيل
 * al-KHALiYA © 2026
 * الحقول مأخوذة من مخرجات أدوات تسيير الحقيقية (أكتوبر 2026):
 *   get_variant_analytics, get_finance_summary, list_finance_transactions, get_marketing_analytics,
 *   get_analytics_overview, list_order_tracking, list_expenses
 * كل الدوال قراءة برك — ما تبدّل والو في تسيير.
 */
'use strict';
const dayMs = 864e5;

// ⚙️ الإعدادات الحقيقية للبوصلة من تسيير
function settingsFromTassyir({ variantAnalytics, financeSummary, financeTx, marketing, overview, rate } = {}) {
  const V = ((variantAnalytics && variantAnalytics.data) || []).filter(v => v.totalOrders > 0 && v.deliveredOrders > 0);
  const wDel = V.reduce((s, v) => s + v.deliveredOrders, 0) || 1;
  const avg = k => V.reduce((s, v) => s + (v[k] || 0) * v.deliveredOrders, 0) / wDel;
  const out = { _source: {}, _flags: [] };
  if (V.length) {
    out.retCost = Math.round(avg('averageRefundFeePerOrder')); out._source.retCost = 'variant_analytics.averageRefundFeePerOrder';
    const rtx = (financeTx || []).filter(t => /return refund fee/i.test(t.description || ''));
    if (rtx.length && rtx.every(t => !(t.amount > 0)) && out.retCost > 0) { out._flags.push('return_fee_conflict'); out._source.retCost += ' — ⚠️ المعاملات تقول 0: نسقسيو التاجر على عرض شركة التوصيل'; }
    out.delCost = Math.round(Math.abs(avg('averageDeliveryFeeDifference'))); out._source.delCost = 'variant_analytics.averageDeliveryFeeDifference';
    const pack = avg('packagePrice'), comm = avg('averageCommissionPerOrder');
    out.pack = Math.round(pack + comm); out._source.pack = `تغليف ${Math.round(pack)} + عمولة المؤكّد ${Math.round(comm)} (على كل موصلة)`;
    if (!(pack > 0)) out._flags.push('packaging_missing');
  }
  if (overview) {
    if (overview.confirmation) out.conf = overview.confirmation.confirmationRatePct;
    if (overview.delivery) out.del = overview.delivery.deliveryRatePct;
    if (overview.abandonedCheckouts != null && overview.orders) out.abandon = Math.round(overview.abandonedCheckouts / (overview.abandonedCheckouts + overview.orders.count) * 100);
  }
  if (marketing && marketing.totals) {
    const sp = marketing.totals.ads && marketing.totals.ads.spend, n = marketing.totals.counts && marketing.totals.counts.orders;
    if (sp > 0 && n > 0) { out.leadUsd = +(sp / n).toFixed(2); out._source.leadUsd = 'marketing.totals.ads.spend ÷ orders'; }
    if (marketing.providers && marketing.providers.tiktok && !marketing.providers.tiktok.connected) out._flags.push('tiktok_not_connected');
  }
  const cash = (financeTx || []).filter(t => t.type === 'IN' && /cashout/i.test(t.description || '')).map(t => new Date(t.createdAt)).sort((a, b) => a - b);
  if (cash.length >= 2) { const g = cash.slice(1).map((d, i) => (d - cash[i]) / dayMs); out.payoutEvery = Math.max(1, Math.round(g.reduce((a, b) => a + b, 0) / g.length)); out._source.payoutEvery = `معدل الأيام بين ${cash.length} سحبات`; }
  if (rate) out.rate = rate;
  return out;
}

// 🔎 لقطة للفحص (audit)
function snapshotFromTassyir({ variantAnalytics, expenses, financeSummary, financeTx, marketing, overview, tracking, merchant, today } = {}) {
  const V = ((variantAnalytics && variantAnalytics.data) || []).map(v => ({ product: v.product && v.product.name, name: v.variant && v.variant.name,
    buyPrice: v.buyPrice, packagePrice: v.packagePrice, avgDeliveryFeeDiff: v.averageDeliveryFeeDifference, avgRefundFee: v.averageRefundFeePerOrder,
    avgCommission: v.averageCommissionPerOrder, orders: v.totalOrders, delivered: v.deliveredOrders, returned: v.returnedOrders }));
  const fs = financeSummary || {};
  return {
    variants: V, expenses: expenses || [], financeTx: financeTx || [],
    finance: { adsSpendDzd: fs.adsSpend ? fs.adsSpend.value : 0, refundAvg: fs.refund && fs.refund.breakdown ? fs.refund.breakdown.averageRefundPerOrder : 0 },
    marketing: marketing ? { spendUsd: marketing.totals && marketing.totals.ads ? marketing.totals.ads.spend : 0, facebook: !!marketing.facebookAdsConnected, tiktok: !!marketing.tiktokAdsConnected } : null,
    tracking: ((tracking && tracking.data) || []).map(t => ({ deliveryStatus: t.deliveryStatus, payoutState: t.carrierPayout && t.carrierPayout.state, delivered: t.delivered, total: t.total, lastStatusAt: t.lastStatusAt })),
    abandoned: overview ? overview.abandonedCheckouts : 0, orders: overview && overview.orders ? overview.orders.count : 0,
    merchant: merchant || {}, today,
  };
}

// 📅 سطر actuals لنهار واحد من get_marketing_analytics (startDate = endDate = النهار)
//   campaignMap: { "PRO TREK": "ساعة PRO TREK" } — كلمة في اسم الحملة → اسم المنتج في المسار
function actualsFromMarketingDay(mk, date, campaignMap) {
  const rows = {};
  const walk = (n) => {
    if (n.level === 'campaign') {
      const key = Object.keys(campaignMap || {}).find(k => (n.name || '').toUpperCase().includes(k.toUpperCase()));
      const product = key ? campaignMap[key] : (n.name || '(not set)');
      const r = (rows[product] = rows[product] || { product, date, adSpendUsd: 0, leads: 0, confirmed: 0, delivered: 0, returned: 0 });
      r.adSpendUsd += (n.ads && n.ads.spend) || 0; r.leads += n.counts.orders || 0; r.confirmed += n.counts.confirmed || 0;
      r.delivered += n.counts.delivered || 0; r.returned += n.counts.returned || 0;
      return;
    }
    (n.children || []).forEach(walk);
  };
  (mk.tree || []).forEach(walk);
  return Object.values(rows).filter(r => r.product !== '(not set)').map(r => ({ ...r, adSpendUsd: Math.round(r.adSpendUsd * 100) / 100 }));
}

module.exports = { settingsFromTassyir, snapshotFromTassyir, actualsFromMarketingDay };
