// ecomanita 0.4.0 — L'INSPECTEUR (المفتّش) : le contrôle médical du compte Tassyir, AVANT tout test.
// Le client écrit « افحص حسابي » à son robot Telegram (ou appuie sur « افحص الحساب » dans l'onglet التحضير).
// Partage du travail (le code compte, Claude lit — rien de deviné) :
//  - Claude : UN tour de la file, outils Tassyir en LECTURE seulement (OUTILS_INSPECTEUR), il lit et rend la liste lue ;
//  - le bureau : chaque fait vient de la réponse BRUTE d'un outil (lectureDuBrut), les contrôles sont des fonctions pures
//    (inspecter), la note et la porte « جاهز للتاست » sont calculées ici, jamais par le modèle ;
//  - Telegram : la note, les points rouges, et UN devoir à la fois (avec « علاش » et « وين تضغط ») ; « عاود الفحص » relit tout.
// L'inspecteur ne touche à RIEN : aucune écriture, aucun outil d'écriture dans sa liste.
// Code original « ecom manita ».
import fs from 'node:fs';
import path from 'node:path';

/** Les lectures du tour (clé du connecteur . outil) — aucune écriture. */
export const OUTILS_INSPECTEUR = [
  'tassyir.list_stores', 'tassyir.get_store', 'tassyir.list_products', 'tassyir.get_product', 'tassyir.list_product_tags',
  'tassyir.list_offers', 'tassyir.list_delivery_agents', 'tassyir.list_delivery_fees', 'tassyir.list_custom_statuses',
  'tassyir.list_employees', 'tassyir.list_expenses', 'tassyir.get_finance_summary', 'tassyir.list_finance_transactions',
  'tassyir.get_analytics_overview', 'tassyir.get_inventory', 'tassyir.get_variant_analytics', 'tassyir.list_orders'
];
const ECRITURES = /^(create|update|delete|set|adjust|add|assign|confirm|cancel|dispatch|deliver|return|schedule|publish|pause|resume|apply|upload|import|remove|move|save|detach|rename|restore|toggle|discard|propose)_/;

/** « افحص حسابي », « عاود الفحص », « /inspect » → { relire } ; autre chose → null. */
export function lireDemandeInspecteur(texte) {
  const t = String(texte || '').trim().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا');
  if (/^\/?inspect(eur)?$/i.test(t)) return { relire: false };
  if (/^عاود\s+(ال)?فحص/.test(t)) return { relire: true };
  if (/^(ا?فحص)\s+(حسابي|الحساب|حسابك|البيزنس)\s*$/.test(t)) return { relire: false };
  return null;
}

/** Une réponse brute → objet JSON (ou null). Les connecteurs rendent du JSON, parfois entouré de texte. */
export function jsonBrut(sortie) {
  const s = String(sortie ?? '').trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const i = Math.min(...['{', '['].map(c => { const k = s.indexOf(c); return k < 0 ? Infinity : k; }));
  if (!Number.isFinite(i)) return null;
  try { return JSON.parse(s.slice(i)); } catch { return null; }
}

/** Les appels du tour → la LECTURE (seulement les réponses brutes sans erreur ; un outil d'écriture = refusé). */
export function lectureDuBrut(appels) {
  const L = { produits: [], refus: [] };
  for (const a of appels || []) {
    if (!a || a.erreur) continue;
    const outil = String(a.nom || '').split('__').pop();
    if (ECRITURES.test(outil)) { L.refus.push(outil); continue; }
    const v = jsonBrut(a.sortie);
    if (v == null) continue;
    if (outil === 'get_product') { if (v && v.id) L.produits.push(v); continue; }
    if (outil === 'list_orders') { const st = a.entree && a.entree.status; (L.commandes ||= {})[st || 'toutes'] = v; continue; }
    if (outil === 'list_delivery_fees' && a.entree && a.entree.groupId) continue; // les lignes d'un groupe : inutiles ici
    L[outil] = v;
  }
  return L;
}

const liste = v => Array.isArray(v) ? v : Array.isArray(v && v.data) ? v.data : [];
const nombre = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/**
 * Les contrôles, purs : lecture → { magasin, constats[], note, pret, devoirs[], questions[] }.
 * Chaque constat : { id, niveau: stop|warn|info, genre: info|business, titre, pourquoi, ou, detail }. Le détail (français, chiffres)
 * vient de la lecture ; un fait non lu n'est jamais un constat : il devient une question.
 */
export function inspecter(L, { magasinId = null, aujourdhui = new Date().toISOString().slice(0, 10), regles = {}, couts = {} } = {}) {
  const C = [], Q = [];
  const add = (id, niveau, genre, titre, pourquoi, ou, detail = '') => C.push({ id, niveau, genre, titre, pourquoi, ou, detail });
  const boutiques = liste(L.list_stores);
  const st = (L.get_store && (!magasinId || String(L.get_store.id) === String(magasinId))) ? L.get_store : boutiques.find(b => String(b.id) === String(magasinId)) || (boutiques.length === 1 ? boutiques[0] : null);
  if (!st) return { magasin: null, constats: [], note: null, pret: false, devoirs: [], questions: ['ما لقيتش البوتيك : اختارها في الإعدادات'], lus: Object.keys(L) };
  const R = regles.tassyir || {};

  // --- la boutique
  const px = st.facebookPixelId;
  if (px != null && px !== '' && !/^\d{10,20}$/.test(String(px))) add('pixel_invalide', 'stop', 'info', 'خانة البيكسل فيها حاجة ماشي رقم', 'حتى حدث ما يوصل لميتا وهي هكا', 'Settings ← Pixels & Tracking ← Meta', 'Pixel : valeur non numérique (non affichée)');
  else if (px == null || px === '') add('pixel_absent', 'stop', 'info', 'المتجر بلا بيكسل', 'حملة بلا بيكسل تخدم بالعمى', 'Settings ← Pixels & Tracking ← Meta');
  else if (st.metaCapiTokenSet === false) add('capi', 'warn', 'info', 'البيكسل بلا توكن الكونفرسيون', 'بلاه ميتا ما تشوفش المؤكّدة والموصّلة', 'Settings ← Pixels & Tracking ← Meta');
  const agents = liste(L.list_delivery_agents);
  const actifs = agents.filter(a => a.status === 'active' && !a.deletedAt);
  if (L.list_delivery_agents && !actifs.length) add('transporteur', 'stop', 'info', 'حتى شركة توصيل مربوطة', 'ما تقدرش تبعث حتى طرد', 'Delivery & Shipping ← Add Delivery Agent');
  else if (!st.deliveryAgentId && actifs.length) add('transporteur_defaut', 'warn', 'info', 'المتجر بلا شركة توصيل افتراضية', 'كل طرد تختار الشركة بيدك وتغلط', 'Stores ← Settings ← Delivery agent', `Transporteurs actifs : ${actifs.length}`);
  const groupes = liste(L.list_delivery_fees);
  const gUtilise = groupes.find(g => String(g.groupId) === String(st.deliveryFeeGroupId));
  const gBoutique = groupes.filter(g => String(g.storeId) === String(st.id) && g.deliveryAgentId);
  if (gUtilise && !gUtilise.deliveryAgentId && gBoutique.length) add('tarifs', 'warn', 'business', 'أسعار التوصيل ماشي من شبكة شركتك', 'تأكّد بلي سعر الزبون هو سعر شركتك', 'Delivery & Shipping ← Delivery Pricing', `Grille utilisée : ${gUtilise.name} · grille du transporteur pour cette boutique : ${gBoutique.map(g => g.name).join(', ')}`);
  const vitrine = [];
  if (!String(st.description || '').trim()) vitrine.push('description vide');
  if (!st.language) vitrine.push('langue non choisie');
  if (st.theme && st.theme.name === 'Simple' && /^#0{6}$/i.test(st.theme.primaryColor || '')) vitrine.push('thème par défaut');
  if (vitrine.length) add('vitrine', 'info', 'info', 'واجهة المتجر ناقصة', 'الزبونة تثق في متجر كامل', 'Stores ← Settings', vitrine.join(' · '));

  // --- les produits
  const rangees = liste(L.list_products).filter(p => !st.id || !p.storeId || String(p.storeId) === String(st.id));
  const fiches = (L.produits || []).filter(p => !p.storeId || String(p.storeId) === String(st.id));
  const nProduits = Math.max(rangees.length, fiches.length);
  // 0.4.1 : pas de produit au départ = normal ; PAGE les prépare après SPY
  if (L.list_products && !nProduits) add('aucun_produit', 'info', 'business', 'حتى منتج في المتجر مازال', 'عادي : PAGE يحضّر المنتجات بعد SPY', 'SPY ← لقالي موديلات');
  const sansSku = fiches.filter(p => !p.sku && liste(p.variants).every(v => !v.sku));
  if (sansSku.length) add('sku', 'warn', 'info', 'منتجات بلا SKU', 'بلا SKU ما نتبعوش الستوك ولا التصفية', 'Products ← Edit ← Variants ← SKU', `Sans SKU : ${sansSku.length} / ${fiches.length} · format : ${R.sku || 'BOUTIQUE-MODELE-COUL-TAILLE'}`);
  const nonSuivis = fiches.filter(p => p.isInventoryTracked === false);
  if (nonSuivis.length) add('stock_non_suivi', 'warn', 'business', 'الستوك ما راهوش متّبع', 'مرحلة ناجح تحتاج الستوك في تسيير', 'Products ← Edit ← Inventory ← Track', `Stock non suivi : ${nonSuivis.length} / ${fiches.length}`);
  // le prix d'achat : lu dans les ventes par variante (buyPrice) ou dans un achat de stock (finance) ; sinon inconnu
  const va = liste(L.get_variant_analytics);
  const achats = liste(L.list_finance_transactions).filter(t => t.category === 'INVENTORY');
  const connu = p => va.some(x => x.product && x.product.name === p.name && nombre(x.buyPrice) > 0) || achats.some(t => String(t.description || '').includes(p.name));
  const base = fiches.length ? fiches : rangees;
  // 24/10/2026 (épreuve HIVE) : le coût posé dans « إضافة مخزون » avec une quantité 0 n'est lisible par AUCUN outil du connecteur
  // (get_inventory rend des totaux, get_product aucun coût) : un produit SUIVI dont le coût n'est pas encore relu = une question,
  // jamais un rouge ; un produit NON suivi sans coût lu nulle part = rouge.
  const sansAchat = base.filter(p => !connu(p));
  const suivisSansLecture = sansAchat.filter(p => p.isInventoryTracked === true);
  const vraimentSans = sansAchat.filter(p => p.isInventoryTracked !== true);
  if (base.length && vraimentSans.length) add('prix_achat', 'stop', 'business', 'ثمن الشراء ما راهوش في تسيير', 'بلاه ما نحسبوش الربح ولا حدود التاست', 'Inventory ← Add stock ← Prix d\'achat (quantité 0 en test)', `Sans prix d'achat : ${vraimentSans.length} / ${base.length}`);
  if (suivisSansLecture.length) Q.push('ثمن الشراء محطوط في المخزون والموصّل ما يبيّنوش : ابعثلي كابتور تاع Inventory');
  // la première couleur : le formulaire s'ouvre sur la PREMIÈRE variante ; elle doit être la première couleur (celle de la photo)
  const couleurs = p => liste(p.options).find(o => /لون|couleur|color/i.test(o.name || ''));
  const malOuverts = fiches.filter(p => {
    const o = couleurs(p); const v0 = liste(p.variants)[0];
    if (!o || !v0) return false;
    const c0 = (o.values || [])[0], cv = (v0.selectedOptions || []).find(s => s.name === o.name);
    return c0 && cv && cv.value !== c0;
  });
  if (malOuverts.length) add('premiere_couleur', 'info', 'info', 'الفورم يفتح على لون ماشي الأول', 'اللون الأول لازم يكون لون الصورة', 'Products ← Edit ← Variants (ordre)', malOuverts.map(p => `${p.name} : ${(liste(p.variants)[0].selectedOptions || []).map(s => s.value).join('/')}`).join(' · '));
  const sansGalerie = fiches.filter(p => !liste(p.gallery).length && liste(p.variants).every(v => !v.image));
  if (sansGalerie.length) add('galerie', 'info', 'info', 'صورة وحدة لكل منتج', 'الزبونة تحب تشوف كل لون', 'Products ← Edit ← Media', `Sans galerie : ${sansGalerie.length} / ${fiches.length}`);
  // le tag d'étape : TEST se pose au « لانسي » ; avant une première commande, c'est CANDIDAT
  const ov = L.get_analytics_overview || {};
  const commandes30 = nombre(ov.orders && ov.orders.count, 0);
  const tagues = fiches.filter(p => liste(p.tags).some(t => t.name === 'TEST'));
  if (tagues.length && L.get_analytics_overview && commandes30 === 0) add('tag_test', 'info', 'info', 'تاغ التاست قبل «لانسي»', 'التاغ يقول للوكلاء وين راه الموديل', 'Products ← Tags', `TEST sans commande : ${tagues.length} · avant le lancement : CANDIDAT`);

  // --- le business (toutes les boutiques)
  // 0.4.1 : pas de statut d'attente ; une commande de test est une commande CONFIRMÉE (date programmée si l'atelier prend des jours)
  const offres = L.list_offers;
  if (offres && nombre(offres.counts && offres.counts.all, liste(offres.offers).length) === 0) add('offres', 'info', 'business', 'حتى عرض في المتجر', 'العرض لازم يكون واجد قبل ما نعيطو', 'Marketing ← Offers');
  const fin = L.get_finance_summary || {};
  const moyenRetour = nombre(fin.refund && fin.refund.breakdown && fin.refund.breakdown.averageRefundPerOrder, NaN);
  const txRetour = liste(L.list_finance_transactions).filter(t => /return refund fee/i.test(t.description || ''));
  // 0.4.1 (25/10) : le tableau « معدلات الاسترجاع » du transporteur vide = Tassyir compte 200 DA par retour ; c'est le CLIENT qui écrit
  // le prix de SON transporteur (gratuit = 0), après l'avoir confirmé avec lui. L'inspecteur ne l'écrit jamais.
  // 0.4.2 (25/10) : le prix du retour est OBLIGATOIRE (point rouge, la porte reste fermée) pour TOUTE boutique, même neuve :
  // le connecteur ne lit pas « معدلات الاسترجاع », donc le client confirme le prix avec son transporteur (gratuit = 0), l'écrit
  // dans Tassyir ET dans les réglages du bureau (« الرجوع »). Ensuite, si Tassyir compte un autre prix, c'est encore rouge.
  const brutDeclare = couts && couts.retour;
  const retourDeclare = brutDeclare === null || brutDeclare === undefined || brutDeclare === '' ? NaN : Number(brutDeclare);
  const conflitRetour = txRetour.length && txRetour.every(t => nombre(t.amount) === 0);
  const ouAppuyer = 'سقسي شركة التوصيل ← Livraison ← وكلاء التوصيل ← … ← معدلات الاسترجاع ← حفظ ← واكتبو في إعدادات المكتب : الرجوع';
  if (!Number.isFinite(retourDeclare) || retourDeclare < 0) {
    add('retour_prix', 'stop', 'business', 'سعر الروتور مازال ما تأكّدش', 'بلا سعر الروتور، أقصى سعر لليد يطلع غالط', ouAppuyer,
      `Retour : non déclaré${Number.isFinite(moyenRetour) && moyenRetour > 0 ? ` · Tassyir compte ${moyenRetour}${moyenRetour === 200 ? ' (valeur de Tassyir quand le tableau est vide)' : ''}` : ''}`);
    Q.push('أكّد مع شركة التوصيل شحال الروتور، وإذا مجاني اكتب صفر');
  } else if (Number.isFinite(moyenRetour) && moyenRetour > 0 && (moyenRetour !== retourDeclare || conflitRetour)) {
    add('retour_conflit', 'stop', 'business', 'تسيير يحسب الروتور بسعر آخر', 'السعر اللي قلتو ماشي هو اللي في تسيير', ouAppuyer,
      `Retour (DZD) : Tassyir ${moyenRetour}${moyenRetour === 200 ? ' (valeur de Tassyir quand le tableau est vide)' : ''} · déclaré ${retourDeclare}${conflitRetour ? ` · transactions ${txRetour.length} à 0` : ''}`);
  }
  if (Array.isArray(L.list_expenses) && !L.list_expenses.length) add('depenses', 'warn', 'business', 'حتى مصروف ما تسجّل', 'الربح يبان أكبر من الحقيقة', 'Finance ← Costs ← Add expense');
  if (fin.adsSpend && nombre(fin.adsSpend.value) === 0) add('pub_hors_finance', 'info', 'business', 'الإعلانات ما راهيش في المالية', 'الربح الصافي ينحسب بلا الإعلان', 'Finance ← Ads accounts');
  const charges = liste(L.list_employees).filter(e => nombre(e.openOrders) >= 10);
  if (charges.length) add('charge', 'warn', 'business', 'مؤكّد عندو طلبيات مفتوحة بزاف', 'الطلبية اللي تستنى تبرد', 'Team ← Order distribution', charges.map(e => `${e.name} : ${e.openOrders} ouvertes`).join(' · '));
  const enAttente = liste(L.commandes && L.commandes.pending).filter(o => !st.id || !o.storeId || String(o.storeId) === String(st.id));
  const vieilles = enAttente.filter(o => (Date.parse(aujourdhui) - Date.parse(o.createdAt)) / 864e5 >= 2);
  if (vieilles.length) add('attente_vieille', 'stop', 'business', 'طلبيات مستنية من يومين ولا أكثر', 'كل ساعة تستنى تنقّص التأكيد', 'Orders ← Pending', `En attente ≥ 2 jours : ${vieilles.length}`);

  // ce que le connecteur ne montre pas : une question, jamais un constat
  Q.push('المحافظ ما يبانوش في الموصّل : ابعثلي كابتور تاع Finance ← Wallets');

  const P = (regles.inspecteur && regles.inspecteur.poids) || { stop: 15, warn: 5, info: 1 };
  const note = Math.max(0, 100 - C.reduce((n, c) => n + (P[c.niveau] || 0), 0));
  const rang = c => ({ stop: 0, warn: 2, info: 4 }[c.niveau] + (c.genre === 'business' ? 0 : 1));
  const devoirs = [...C].sort((a, b) => rang(a) - rang(b));
  return { magasin: { id: st.id, nom: st.name }, constats: C, note, pret: !C.some(c => c.niveau === 'stop'), devoirs, questions: Q, lus: Object.keys(L).filter(k => !['produits', 'refus'].includes(k)).concat(fiches.length ? [`get_product ×${fiches.length}`] : []), refus: L.refus || [] };
}

/** Une ligne arabe coupée à 36 caractères (loi de forme de telegram.mjs), mot par mot. */
export function couper(texte, max = 36) {
  const out = []; let l = '';
  for (const m of String(texte).split(/\s+/).filter(Boolean)) { if ((l + ' ' + m).trim().length > max) { if (l) out.push(l); l = m; } else l = (l + ' ' + m).trim(); }
  if (l) out.push(l);
  return out;
}
const pastille = n => ({ stop: '🔴', warn: '🟡', info: '⚪' }[n] || '•');

/** Le message Telegram (loi de forme : darija, 36 caractères par ligne, aucun chiffre dans une ligne arabe). */
export function messageInspecteur(res, { devoir = 0 } = {}) {
  if (!res || !res.magasin) return ['ما لقيتش البوتيك تاع الفحص', 'اختارها في الإعدادات', 'ومن بعد عاود ابعث افحص حسابي'].join('\n');
  const l = ['هاذا هو الفحص الطبي تاعك', `Boutique : ${res.magasin.nom}`.slice(0, 36), `Note : ${res.note} / 100`];
  const n = k => res.constats.filter(c => c.niveau === k).length;
  l.push(res.pret ? 'الحساب جاهز للتاست ✅' : 'الحساب ماشي جاهز للتاست', `Rouges ${n('stop')} · Jaunes ${n('warn')} · Gris ${n('info')}`);
  const rouges = res.constats.filter(c => c.niveau === 'stop');
  if (rouges.length) { l.push('الحمرين لازم يتصلحو قبل كلش :'); for (const c of rouges) l.push(...couper(`${pastille('stop')} ${c.titre}`)); }
  const d = res.devoirs[devoir];
  if (d) {
    l.push('الواجب اللي نبداو بيه :', ...couper(`${pastille(d.niveau)} ${d.titre}`), ...couper(`علاش : ${d.pourquoi}`), 'وين تضغط :');
    for (const morceau of String(d.ou).split(' ← ')) l.push(`  ${morceau}`.slice(0, 36));
  }
  l.push('كي تكمل ابعثلي عاود الفحص');
  return l.join('\n');
}

/** Le rapport complet (carnet et onglet), en markdown : tout ce qui a été lu, chaque constat avec son détail. */
export function rapportInspecteur(res) {
  if (!res || !res.magasin) return '# الفحص الطبي\n\nما لقيتش البوتيك.';
  const t = [`# الفحص الطبي : ${res.magasin.nom}`, '', `Note : ${res.note} / 100 · ${res.pret ? 'جاهز للتاست' : 'ماشي جاهز للتاست'}`, ''];
  for (const c of res.devoirs) t.push(`- ${pastille(c.niveau)} **${c.titre}** (${c.genre === 'business' ? 'بيزنس' : 'معلومات'}) — ${c.pourquoi}. وين : ${c.ou}${c.detail ? `. ${c.detail}` : ''}`);
  if (res.questions.length) t.push('', '## أسئلة (حوايج ما تبانش في الموصّل)', ...res.questions.map(q => `- ${q}`));
  t.push('', `Sources lues : ${res.lus.join(', ')}`);
  if (res.refus.length) t.push(`Écritures refusées : ${res.refus.join(', ')}`);
  return t.join('\n');
}

export function messageTour(magasin) {
  const id = magasin && magasin.id ? String(magasin.id) : '';
  return `Contrôle médical du compte Tassyir${id ? ` — boutique ${id}` : ''}. LECTURE SEULEMENT, aucune écriture.
Appelle, dans l'ordre : list_stores ; get_store (storeId ${id || 'de la boutique'}) ; list_products (storeId, limit 100) ; get_product pour CHAQUE produit actif (20 au plus) ;
list_product_tags (storeId) ; list_offers (storeId) ; list_delivery_agents ; list_delivery_fees (sans groupId) ; list_custom_statuses ;
list_employees ; list_expenses ; get_finance_summary ; list_finance_transactions (les 30 derniers jours) ; get_analytics_overview (storeId) ;
get_inventory ; get_variant_analytics (storeId) ; list_orders (storeId, status "pending", limit 100).
Ne juge rien, ne calcule rien : le bureau lit les réponses brutes. Rends seulement { lu: [les outils appelés] } et, si un outil refuse, sa raison dans « erreur ».`;
}
export const SCHEMA_INSPECTEUR = { type: 'object', properties: { lu: { type: 'array', items: { type: 'string' } }, erreur: { type: 'string' } }, required: ['lu'] };
export const TEXTES_INSPECTEUR = {
  accuse: ['راني نفحص الحساب تاعك', 'نقرا تسيير بلا ما نبدّل والو', 'نبعتلك النتيجة كي نكمل'],
  occupe: ['راني في فحص دركا', 'استنى حتى يكمل'],
  sansTassyir: ['الموصّل تاع تسيير ماهوش مربوط', 'اربطو في Claude ومن بعد', 'افحص الكونيكتورات في المكتب'],
  sansMagasin: ['ما اخترتش البوتيك', 'اختارها في الإعدادات', 'ومن بعد عاود ابعث افحص حسابي'],
  quota: ['الليميت تاع Claude وصلت', 'الفحص ما كملش', 'عاود ابعثو من بعد'],
  echec: ['الفحص ما كملش', 'شوف السبب في المكتب', 'في الجورنال']
};

/** L'inspecteur du bureau. deps : telegram(), claude() (serveur.mjs claudeChaine), prefixes(), magasin(), regles(), dossier, journal. */
export function creerInspecteur({ telegram, claude, prefixes = () => ({}), magasin = () => null, regles = () => ({}), couts = () => ({}), dossier, journal = () => {} }) {
  let enCours = null, dernier = null;
  const dire = async lignes => { const r = await telegram().envoyer(Array.isArray(lignes) ? lignes.join('\n') : lignes); if (!r.envoye) journal('inspecteur : message non envoyé — ' + (r.fautes || []).join(' ; ')); return r; };
  async function travailler(m, ici) {
    let r;
    try { r = await claude({ systeme: 'Tu es l\'INSPECTEUR (المفتّش) du bureau ecom manita. Tu LIS le compte Tassyir du client, sans rien écrire. Un outil d\'écriture est interdit. Tu rends le JSON demandé, rien d\'autre.', message: messageTour(m), outils: OUTILS_INSPECTEUR, schema: SCHEMA_INSPECTEUR, dureeMaxMs: 15 * 60000 }); }
    catch (e) { journal(`inspecteur : tour refusé — ${e.message}`); if (e.connecteur) return dire(TEXTES_INSPECTEUR.sansTassyir); if (e.quota) return dire(TEXTES_INSPECTEUR.quota); return dire(TEXTES_INSPECTEUR.echec); }
    const L = lectureDuBrut(r.appels);
    const res = inspecter(L, { magasinId: m.id, regles: regles(), couts: couts() || {} });
    dernier = { ...res, quand: new Date().toISOString(), tokens: r.tokens || null };
    fs.writeFileSync(path.join(ici, 'lecture.json'), JSON.stringify(L, null, 1));
    fs.writeFileSync(path.join(ici, 'resultat.json'), JSON.stringify(dernier, null, 1));
    fs.writeFileSync(path.join(ici, 'rapport.md'), rapportInspecteur(res));
    journal(`inspecteur : ${res.magasin ? res.magasin.nom : '?'} — note ${res.note}, ${res.constats.length} constat(s), ${res.pret ? 'prêt' : 'pas prêt'} · lu : ${res.lus.join(', ')}${res.refus.length ? ` · écritures refusées : ${res.refus.join(', ')}` : ''}`);
    await dire(messageInspecteur(res));
  }
  return {
    occupe: () => !!enCours,
    dernier: () => dernier,
    async demander() {
      if (enCours) { await dire(TEXTES_INSPECTEUR.occupe); return { lance: false, raison: 'occupe' }; }
      if (!prefixes().tassyir) { await dire(TEXTES_INSPECTEUR.sansTassyir); return { lance: false, raison: 'tassyir' }; }
      const m = magasin();
      if (!m || !m.id) { await dire(TEXTES_INSPECTEUR.sansMagasin); return { lance: false, raison: 'magasin' }; }
      const ici = path.join(dossier, `${new Date().toISOString().replace(/[:.]/g, '-')}-${m.id}`);
      fs.mkdirSync(ici, { recursive: true });
      enCours = (async () => {
        await dire(TEXTES_INSPECTEUR.accuse);
        try { await travailler(m, ici); } catch (e) { journal(`inspecteur : ${e.message}`); await dire(TEXTES_INSPECTEUR.echec).catch(() => {}); }
      })().finally(() => { enCours = null; });
      return { lance: true, dossier: ici };
    }
  };
}
