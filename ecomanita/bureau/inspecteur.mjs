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
import { noteInspecteur } from './regles-masar.mjs';

/** Les lectures du tour (clé du connecteur . outil) — aucune écriture. */
export const OUTILS_INSPECTEUR = [
  'tassyir.list_stores', 'tassyir.get_store', 'tassyir.list_products', 'tassyir.get_product', 'tassyir.list_product_tags',
  'tassyir.list_offers', 'tassyir.list_delivery_agents', 'tassyir.list_delivery_fees', 'tassyir.list_custom_statuses',
  'tassyir.list_employees', 'tassyir.list_expenses', 'tassyir.get_finance_summary', 'tassyir.list_finance_transactions',
  'tassyir.get_analytics_overview', 'tassyir.get_inventory', 'tassyir.get_variant_analytics', 'tassyir.list_orders',
  // 1.0 : les fiches 1.2 (le suivi des sources, la pub dans Tassyir, les retours à traiter, l'encaissement des colis livrés)
  'tassyir.get_marketing_analytics', 'tassyir.list_returns', 'tassyir.list_order_tracking'
];
const ECRITURES = /^(create|update|delete|set|adjust|add|assign|confirm|cancel|dispatch|deliver|return|schedule|publish|pause|resume|apply|upload|import|remove|move|save|detach|rename|restore|toggle|discard|propose)_/;

/** « افحص حسابي », « عاود الفحص », « /inspect » → { relire } ; autre chose → null. */
export function lireDemandeInspecteur(texte) {
  const t = String(texte || '').trim().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا');
  if (/^\/?inspect(eur)?$/i.test(t)) return { relire: false };
  if (/^عاود\s+(ال)?فحص/.test(t) || /^كم+ّ?لت$/.test(t)) return { relire: true };
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
export function inspecter(L, { magasinId = null, aujourdhui = new Date().toISOString().slice(0, 10), regles = {}, couts = {}, reponses = {}, taux = null, verdicts = [] } = {}) {
  const C = [], Q = [];
  const add = (id, niveau, genre, titre, pourquoi, ou, detail = '') => C.push({ id, niveau, genre, titre, pourquoi, ou, detail });
  const boutiques = liste(L.list_stores);
  const st = (L.get_store && (!magasinId || String(L.get_store.id) === String(magasinId))) ? L.get_store : boutiques.find(b => String(b.id) === String(magasinId)) || (boutiques.length === 1 ? boutiques[0] : null);
  if (!st) return { magasin: null, constats: [], checks: [], note: null, etat: null, pret: false, devoirs: [], questions: [{ id: 'boutique', ar: 'ما لقيتش البوتيك : اختارها في الإعدادات' }], lus: Object.keys(L) };
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
  // 1.0 (fix 2) : zéro produit = « ما بداش » — pas de note (les réglages partagés du business ne font pas une note de magasin)
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
  // 1.2 : une question à boutons, jamais une capture
  if (suivisSansLecture.length && reponses.prix_achat !== true) {
    if (reponses.prix_achat === false) add('prix_achat', 'stop', 'business', 'ثمن الشراء ما راهوش في تسيير', 'بلاه ما نحسبوش الربح ولا حدود التاست', 'Inventory ← Add stock ← Prix d\'achat', `Sans prix d'achat (dit par le client) : ${suivisSansLecture.length}`);
    else Q.push({ id: 'prix_achat', ar: 'كتبت ثمن الشراء في المخزون تاع تسيير؟', boutons: ['واه', 'لا'], rouge: true });
  }
  // la première couleur : le formulaire s'ouvre sur la PREMIÈRE variante ; elle doit être la première couleur (celle de la photo)
  const couleurs = p => liste(p.options).find(o => /لون|couleur|color/i.test(o.name || ''));
  const malOuverts = fiches.filter(p => {
    const o = couleurs(p); const v0 = liste(p.variants)[0];
    if (!o || !v0) return false;
    const c0 = (o.values || [])[0], cv = (v0.selectedOptions || []).find(s => s.name === o.name);
    return c0 && cv && cv.value !== c0;
  });
  if (malOuverts.length) add('premiere_couleur', 'warn', 'info', 'الفورم يفتح على لون ماشي الأول', 'اللون الأول لازم يكون لون الصورة', 'Products ← Edit ← Variants (ordre)', malOuverts.map(p => `${p.name} : ${(liste(p.variants)[0].selectedOptions || []).map(s => s.value).join('/')}`).join(' · '));
  const sansGalerie = fiches.filter(p => !liste(p.gallery).length && liste(p.variants).every(v => !v.image));
  if (sansGalerie.length) add('galerie', 'warn', 'info', 'صورة وحدة لكل منتج', 'الزبونة تحب تشوف كل لون', 'Products ← Edit ← Media', `Sans galerie : ${sansGalerie.length} / ${fiches.length}`);
  // 1.0 (fix 4) : le tag d'étape se pose APRÈS le verdict de la boussole (et le « نعم » du client) — un TEST sans verdict = orange
  const ov = L.get_analytics_overview || {};
  const commandes30 = nombre(ov.orders && ov.orders.count, 0);
  const jugees = new Set((verdicts || []).map(v => String(v)));
  const tagues = fiches.filter(p => liste(p.tags).some(t => t.name === 'TEST') && !jugees.has(String(p.id)) && !jugees.has(String(p.name)));
  if (tagues.length) add('tag_test', 'warn', 'info', 'تاغ TEST قبل حكم البوصلة', 'التاغ يتحط غير بعد الحكم و«نعم» تاعك', 'Products ← Tags', `TEST sans verdict de la boussole : ${tagues.length} / ${fiches.length}`);

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
    Q.push({ id: 'retour', ar: 'شحال الروتور عند شركة التوصيل؟ اكتب الرقم، مجاني = صفر', type: 'nombre', rouge: true });
  } else if (Number.isFinite(moyenRetour) && moyenRetour > 0 && (moyenRetour !== retourDeclare || conflitRetour)) {
    add('retour_conflit', 'stop', 'business', 'تسيير يحسب الروتور بسعر آخر', 'السعر اللي قلتو ماشي هو اللي في تسيير', ouAppuyer,
      `Retour (DZD) : Tassyir ${moyenRetour}${moyenRetour === 200 ? ' (valeur de Tassyir quand le tableau est vide)' : ''} · déclaré ${retourDeclare}${conflitRetour ? ` · transactions ${txRetour.length} à 0` : ''}`);
  }
  if (Array.isArray(L.list_expenses) && !L.list_expenses.length) add('depenses', 'warn', 'business', 'حتى مصروف ما تسجّل', 'الربح يبان أكبر من الحقيقة', 'Finance ← Costs ← Add expense');
  // 1.0 (fix 5) : la pub doit être reliée dans Tassyir (Wallets ← Ad spend deductions) — sinon « الربح الصافي » oublie la pub.
  //   Orange dès qu'il y a des commandes (ou une dépense lue côté marketing) et une pub à 0 dans la finance.
  const mk = L.get_marketing_analytics || null;
  const pubMk = nombre(mk && mk.totals && mk.totals.ads && mk.totals.ads.spend, 0);
  if (fin.adsSpend && nombre(fin.adsSpend.value) === 0 && (commandes30 > 0 || pubMk > 0)) add('pub_hors_finance', 'warn', 'business', 'الإعلان ما راهوش مربوط في تسيير', 'الربح الصافي يبان أكبر من الحقيقة', 'Finance ← Wallets ← Ad spend deductions', `Pub dans la finance : 0${pubMk ? ` · dépense lue côté marketing : ${pubMk} $` : ''} · commandes 30 j : ${commandes30}`);
  const charges = liste(L.list_employees).filter(e => nombre(e.openOrders) >= 10);
  if (charges.length) add('charge', 'warn', 'business', 'مؤكّد عندو طلبيات مفتوحة بزاف', 'الطلبية اللي تستنى تبرد', 'Team ← Order distribution', charges.map(e => `${e.name} : ${e.openOrders} ouvertes`).join(' · '));
  const enAttente = liste(L.commandes && L.commandes.pending).filter(o => !st.id || !o.storeId || String(o.storeId) === String(st.id));
  const vieilles = enAttente.filter(o => (Date.parse(aujourdhui) - Date.parse(o.createdAt)) / 864e5 >= 2);
  if (vieilles.length) add('attente_vieille', 'stop', 'business', 'طلبيات مستنية من يومين ولا أكثر', 'كل ساعة تستنى تنقّص التأكيد', 'Orders ← Pending', `En attente ≥ 2 jours : ${vieilles.length}`);

  // ---- 1.0 (fix 3) : les fiches de l'inspecteur 1.2 (docs/03) — chaque fait vient du BRUT ; ce qui ne se lit pas devient une question
  // le dollar et les quatre wallets : des QUESTIONS (jamais une capture) — rouge « inconnu » tant que le client n'a pas répondu
  const tauxLu = Number(taux ?? reponses.taux);
  if (!(Number.isFinite(tauxLu) && tauxLu > 0)) Q.push({ id: 'taux', ar: 'شحال الدولار عندك بالدينار؟ اكتب الرقم', type: 'nombre', rouge: true });
  if (reponses.portefeuilles === false) add('portefeuilles', 'stop', 'business', 'المحافظ الأربعة ماشي واجدين', 'الكاش يتخلط : السلعة، الإعلان، الاحتياط', 'Finance ← Wallets ← New wallet', 'PAIEMENTS · MARCHANDISE · ADS · RÉSERVE');
  else if (reponses.portefeuilles !== true) Q.push({ id: 'portefeuilles', ar: 'عندك المحافظ الأربعة في تسيير؟', lignes: ['المدفوعات، السلعة، الإعلان، الاحتياط'], boutons: ['واه', 'لا'], rouge: true });
  // au moins un confirmateur (l'équipe est partagée par le business : un fait du business, pas du magasin)
  if (L.list_employees && !liste(L.list_employees).length) add('confirmateur', 'stop', 'business', 'حتى مؤكّد في الفريق', 'الطلبية اللي ما يعيّطلهاش حد تبرد', 'Team ← Order distribution');
  // le motif d'annulation obligatoire : seulement si le connecteur le dit (sinon : pas noté, écrit dans le rapport)
  const reglageMotif = liste(L.list_custom_statuses).map(x => x && Object.entries(x).find(([k]) => /require.*reason|reason.*required|motif.*oblig/i.test(k))).find(Boolean);
  if (reglageMotif && reglageMotif[1] === false) add('raison_annulation', 'warn', 'business', 'سبب الإلغاء ماشي مفروض', 'الإلغاء بلا سبب ما يعلّمناش والو', 'Settings ← Status customization ← Cancel reasons ← Require a reason');
  const nonLus = new Set(reglageMotif ? [] : ['raison_annulation']);
  // les retours « à traiter » (le stock et le bénéfice sont faux tant qu'ils attendent)
  const aTraiter = liste(L.list_returns).filter(x => x && (/to.?process|pending|a.?traiter|waiting/i.test(String(x.status || x.state || '')) || x.processed === false));
  if (aTraiter.length) add('retours_a_traiter', 'stop', 'business', 'رواجع ما تعالجتش', 'الستوك والربح غالطين حتى تتعالج', 'Tracking ← Returns ← To process', `Retours à traiter : ${aTraiter.length}`);
  // l'encaissement : des colis livrés et AUCUN encaissement (cashout) écrit dans la finance = l'argent n'est pas suivi
  const livres = liste(L.list_order_tracking).filter(t => t && (t.delivered === true || /deliver|livr/i.test(String(t.deliveryStatus || ''))));
  const encaisses = liste(L.list_finance_transactions).filter(t => t && t.type === 'IN' && /cashout|payout|encaiss/i.test(String(t.description || '')));
  if (L.list_order_tracking && L.list_finance_transactions && livres.length && !encaisses.length) add('encaissement', 'stop', 'business', 'القبض ما تسجّلش', 'الكاش عند شركة التوصيل وتسيير ما يعرفوش', 'Finance ← Report ← Set up payout tracking', `Colis livrés lus : ${livres.length} · encaissements écrits : 0`);
  // le suivi des sources : 80 % des commandes avec leur campagne, à partir de 20 commandes (get_marketing_analytics, « (not set) » = sans lien)
  let partSuivie = null, totalMk = 0;
  if (mk && mk.totals && mk.totals.counts) {
    totalMk = nombre(mk.totals.counts.orders, 0);
    let suivies = 0; const marche = n => { if (!n) return; if (n.level === 'campaign') { if (String(n.name || '') !== '(not set)') suivies += nombre(n.counts && n.counts.orders, 0); return; } (n.children || []).forEach(marche); };
    (mk.tree || []).forEach(marche);
    partSuivie = totalMk > 0 ? suivies / totalMk : null;
    if (totalMk >= 20 && partSuivie !== null && partSuivie < 0.8) add('suivi_source', 'stop', 'business', 'الطلبيات بلا مصدر بزاف', 'ما نعرفوش أنهي إعلان جاب الطلبية', 'Meta ← chaque annonce ← le lien caché', `Commandes avec campagne : ${Math.round(partSuivie * 100)} % de ${totalMk} (il faut 80 %)`);
  }
  // l'emballage : le prix de l'emballage sur les variantes vendues (get_variant_analytics › packagePrice)
  const vendues = va.filter(v => nombre(v.totalOrders, 0) > 0);
  if (vendues.length && vendues.every(v => !(nombre(v.packagePrice, 0) > 0))) add('emballage', 'warn', 'business', 'التغليف ماشي محسوب', 'كل دينار تغليف ما تحسبش يبان ربح', 'Inventory ← Packaging ← Add Packaging', `Variantes vendues sans emballage : ${vendues.length}`);

  // ---- 1.0 (fix 3) : LA NOTE DE L'ACADÉMIE — vert 1, orange 0,5, rouge 0, sur les fiches LUES (regles-masar.noteInspecteur) ;
  // une fiche rouge qui ne se lit pas (ou une question pas encore répondue) est « inconnue » : hors note, mais la porte reste fermée
  const niv = ids => { const c = C.filter(x => ids.includes(x.id)); return c.some(x => x.niveau === 'stop') ? 'rouge' : c.some(x => x.niveau === 'warn') ? 'orange' : null; };
  const sansProduit = !nProduits;
  const checks = CATALOGUE_FICHES.map(f => {
    let etat = niv(f.constats);
    if (!etat) {
      if (f.produit && sansProduit) etat = 'na';
      else if (f.question && Q.some(q => q.id === f.question)) etat = 'inconnu';
      else if (f.lu && !f.lu.every(k => (k === 'produits' ? L.list_products : k === 'commandes' ? (L.commandes && L.commandes.pending) : L[k]) !== undefined)) etat = f.rouge ? 'inconnu' : 'na';
      else if (f.id === 'suivi_source' && !(totalMk >= 20)) etat = 'na';
      else if (nonLus.has(f.id)) etat = 'na';
      else etat = 'vert';
    }
    return { n: f.n, id: f.id, etat };
  });
  const N = noteInspecteur({ checks });
  // l'état du magasin (fix 6) : la réponse à « عندك طلبيات ؟ », corrigée par ce qui est lu (zéro produit = ما بداش, toujours)
  const etat = sansProduit ? 'pas_commence' : reponses.parcours === 'ancien' || (!reponses.parcours && commandes30 > 0) ? 'ancien' : 'debutant';
  // le compte qui saigne (ancien) : le sauvetage passe AVANT les questions — trois choses aujourd'hui, l'argent d'abord
  const saigne = ['attente_vieille', 'retours_a_traiter', 'encaissement', 'pub_hors_finance'].filter(id => C.some(c => c.id === id));
  const rang = c => ({ stop: 0, warn: 2, info: 4 }[c.niveau] + (c.genre === 'business' ? 0 : 1));
  const devoirs = [...C].sort((a, b) => rang(a) - rang(b));
  return { magasin: { id: st.id, nom: st.name }, constats: C, checks, note: etat === 'pas_commence' ? null : N.note, etat,
    pret: N.porteOuverte, inconnus: N.inconnus, rouges: N.rouges, sauvetage: etat === 'ancien' && saigne.length ? { signes: saigne, aujourdhui: devoirs.filter(d => d.niveau === 'stop').slice(0, 3).map(d => d.id) } : null,
    devoirs, questions: [...Q.filter(q => q.rouge), ...Q.filter(q => !q.rouge)], partSuivie,
    ...{ lus: Object.keys(L).filter(k => !['produits', 'refus'].includes(k)).concat(fiches.length ? [`get_product ×${fiches.length}`] : []), refus: L.refus || [] } };
}

/** Le catalogue des fiches notées (les numéros de 01-tajhiz-mofattich.md). `rouge` : une fiche qui ferme la porte quand on ne la lit pas.
 *  Pas dans 1.0 (rapport seulement) : 15 l'échelle d'appels, 19 les raisons de retour (#R, en 1.1), 21 le rythme réel des encaissements, 26 le but. */
export const CATALOGUE_FICHES = [
  { n: 1, id: 'portefeuilles', constats: ['portefeuilles'], question: 'portefeuilles', rouge: true },
  { n: 2, id: 'taux', constats: [], question: 'taux', rouge: true },
  { n: 3, id: 'pixel', constats: ['pixel_invalide', 'pixel_absent'], lu: ['get_store'], rouge: true },
  { n: 4, id: 'capi', constats: ['capi'], lu: ['get_store'] },
  { n: 5, id: 'transporteur', constats: ['transporteur'], lu: ['list_delivery_agents'], rouge: true },
  { n: 6, id: 'transporteur_defaut', constats: ['transporteur_defaut'], lu: ['get_store'] },
  { n: 7, id: 'tarifs', constats: ['tarifs'], lu: ['list_delivery_fees'] },
  { n: 8, id: 'retour', constats: ['retour_prix', 'retour_conflit'], rouge: true },
  { n: 9, id: 'prix_achat', constats: ['prix_achat'], question: 'prix_achat', lu: ['produits'], produit: true, rouge: true },
  { n: 10, id: 'emballage', constats: ['emballage'], lu: ['get_variant_analytics'], produit: true },
  { n: 11, id: 'sku', constats: ['sku'], lu: ['produits'], produit: true },
  { n: 12, id: 'stock_suivi', constats: ['stock_non_suivi'], lu: ['produits'], produit: true },
  { n: 13, id: 'couleurs_photos', constats: ['premiere_couleur', 'galerie'], lu: ['produits'], produit: true },
  { n: 14, id: 'confirmateur', constats: ['confirmateur'], lu: ['list_employees'], rouge: true },
  { n: 16, id: 'raison_annulation', constats: ['raison_annulation'], lu: ['list_custom_statuses'] },
  { n: 17, id: 'attente', constats: ['attente_vieille'], lu: ['commandes'], rouge: true },
  { n: 18, id: 'charge', constats: ['charge'], lu: ['list_employees'] },
  { n: 20, id: 'retours', constats: ['retours_a_traiter', 'encaissement'], lu: ['list_returns', 'list_order_tracking', 'list_finance_transactions'], rouge: true },
  { n: 22, id: 'suivi_source', constats: ['suivi_source'], lu: ['get_marketing_analytics'], rouge: true },
  { n: 23, id: 'pub_tassyir', constats: ['pub_hors_finance'], lu: ['get_finance_summary'] },
  { n: 24, id: 'depenses', constats: ['depenses'], lu: ['list_expenses'] },
  { n: 27, id: 'tag_test', constats: ['tag_test'], lu: ['produits'], produit: true },
];


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
  const l = ['هاذا هو الفحص الطبي تاعك', `Boutique : ${res.magasin.nom}`.slice(0, 36)];
  // 1.0 (fix 2) : un magasin sans produit n'a pas de note (« ما بداش ») ; sinon la note de l'académie (fix 3)
  if (res.etat === 'pas_commence') l.push('المتجر مازال ما بداش', 'ما كاينش نقطة قبل أول منتج', 'نحضّرو الحساب قبل التاست :');
  else l.push('النقطة تاعك :', `Note : ${res.note} / 100`);
  const n = k => (res.checks || []).filter(c => c.etat === k).length;
  // le compte qui saigne : le sauvetage d'abord, trois choses aujourd'hui
  const sauver = res.sauvetage ? res.devoirs.filter(d => res.sauvetage.aujourdhui.includes(d.id)) : [];
  if (sauver.length) { l.push('🚑 الحساب ينزف', 'اليوم ثلاث حوايج برك :'); for (const c of sauver) l.push(...couper(`${pastille('stop')} ${c.titre}`)); }
  l.push(res.pret ? 'الحساب جاهز للتاست ✅' : 'الحساب ماشي جاهز للتاست', `Rouges ${n('rouge')} · Oranges ${n('orange')} · ? ${n('inconnu')}`);
  const rouges = res.constats.filter(c => c.niveau === 'stop' && !sauver.includes(c));
  if (rouges.length) { l.push(sauver.length ? 'وحمرين آخرين من بعد :' : 'الحمرين لازم يتصلحو قبل كلش :'); for (const c of rouges) l.push(...couper(`${pastille('stop')} ${c.titre}`)); }
  // un inconnu = une question pas encore répondue, ou une lecture qui a manqué (l'outil a refusé) : on ne dit pas la même chose
  const sansQuestion = (res.checks || []).filter(c => c.etat === 'inconnu' && !(res.questions || []).some(q => CATALOGUE_FICHES.find(f => f.id === c.id)?.question === q.id));
  if ((res.questions || []).length) l.push('كاين حوايج ما يبانوش في تسيير :', 'نسقسيك عليهم واحد بواحد');
  if (sansQuestion.length) l.push('ما قدرتش نقرا كلش في تسيير :', 'عاود الفحص من بعد شوية');
  const d = res.devoirs[devoir];
  if (d) {
    l.push('الواجب اللي نبداو بيه :', ...couper(`${pastille(d.niveau)} ${d.titre}`), ...couper(`علاش : ${d.pourquoi}`), 'وين تضغط :');
    for (const morceau of String(d.ou).split(' ← ')) l.push(`  ${morceau}`.slice(0, 36));
    l.push('كيفاش تعرف كمّلت : ابعثلي كمّلت', 'ونعاود نفحص الحساب');
  } else l.push('كي تكمل ابعثلي عاود الفحص');
  return l.join('\n');
}

/** 1.0 : LA question du moment (une seule par message, des boutons quand il y en a, jamais une capture). null si rien à demander. */
export function questionInspecteur(res) {
  const q = res && res.questions && res.questions[0];
  if (!q) return null;
  const texte = ['سؤال واحد باش نكمّل الفحص :', ...(q.lignes || []), ...couper(q.ar), q.type === 'nombre' ? 'اكتبلي الرقم هنا برك' : 'اختار من الأزرار تحت'].join('\n');
  return { id: q.id, texte, type: q.type || 'boutons', boutons: q.boutons ? [q.boutons.map((t, i) => ({ texte: t, data: `insp:q:${q.id}:${i}` }))] : null };
}
/** 1.0 (fix 6) : la toute première question, avant de lire (le chemin : ما بداش / مبتدئ / قديم). */
export const QUESTION_PARCOURS = { id: 'parcours', ar: 'عندك طلبيات في تسيير؟', boutons: ['مازال ما بديت', 'بديت جديد', 'عندي طلبيات من قبل'], valeurs: ['pas_commence', 'debutant', 'ancien'] };
export function messageParcours() {
  return { texte: ['قبل ما نفحص الحساب تاعك', 'سؤال واحد :', QUESTION_PARCOURS.ar, 'اختار من الأزرار تحت'].join('\n'),
    boutons: [QUESTION_PARCOURS.boutons.map((t, i) => ({ texte: t, data: `insp:p:${i}` }))] };
}

/** Le rapport complet (carnet et onglet), en markdown : tout ce qui a été lu, chaque constat avec son détail. */
export function rapportInspecteur(res) {
  if (!res || !res.magasin) return '# الفحص الطبي\n\nما لقيتش البوتيك.';
  const t = [`# الفحص الطبي : ${res.magasin.nom}`, '', `${res.etat === 'pas_commence' ? 'ما بداش (pas de note)' : `Note : ${res.note} / 100`} · ${res.pret ? 'جاهز للتاست' : 'ماشي جاهز للتاست'}`, ''];
  for (const c of res.devoirs) t.push(`- ${pastille(c.niveau)} **${c.titre}** (${c.genre === 'business' ? 'بيزنس' : 'معلومات'}) — ${c.pourquoi}. وين : ${c.ou}${c.detail ? `. ${c.detail}` : ''}`);
  if (res.questions.length) t.push('', '## أسئلة (حوايج ما تبانش في الموصّل)', ...res.questions.map(q => `- ${q.ar || q}`));
  if (res.checks && res.checks.length) t.push('', '## الفحوص (النقطة بطريقة الأكاديمية)', ...res.checks.map(c => `- ${c.n}. ${c.id} : ${c.etat}`), '', 'Pas lus dans 1.0 : 15 (échelle d\'appels), 19 (raisons de retour #R, en 1.1), 21 (rythme des encaissements), 26 (le but : une question de la boussole).');
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
get_inventory ; get_variant_analytics (storeId) ; list_orders (storeId, status "pending", limit 100) ;
get_marketing_analytics (SANS storeId, les 14 derniers jours : 90 jours est refusé) ; list_returns ; list_order_tracking (les 30 derniers jours).
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

/** L'inspecteur du bureau. deps : telegram(), claude() (serveur.mjs claudeChaine), prefixes(), magasin(), regles(), couts(), taux(),
 *  verdicts() (les modèles que la boussole a jugés), ecrireReglage(cle, valeur) (le dollar et le retour vont dans les réglages du
 *  client, comme s'il les avait tapés dans الإعدادات), dossier, journal.
 *  1.0 : la première fois, « عندك طلبيات ؟ » (trois boutons) AVANT de lire ; après le rapport, UNE question à la fois sur ce qui ne
 *  se lit pas ; une réponse recalcule depuis la DERNIÈRE lecture (aucun nouveau tour de Claude). */
export function creerInspecteur({ telegram, claude, prefixes = () => ({}), magasin = () => null, regles = () => ({}), couts = () => ({}), taux = () => null, verdicts = () => [], ecrireReglage = () => {}, dossier, journal = () => {} }) {
  let enCours = null, dernier = null, derniereLecture = null, attenteNombre = null;
  const FICHIER_REPONSES = path.join(dossier, 'reponses.json');
  const reponses = () => { try { return JSON.parse(fs.readFileSync(FICHIER_REPONSES, 'utf8')); } catch { return {}; } };
  const garder = (k, v) => { const r = reponses(); r[k] = v; fs.mkdirSync(dossier, { recursive: true }); fs.writeFileSync(FICHIER_REPONSES, JSON.stringify(r, null, 1)); };
  const dire = async (lignes, boutons = null) => { const r = await telegram().envoyer(Array.isArray(lignes) ? lignes.join('\n') : lignes, boutons ? { boutons } : {}); if (!r.envoye) journal('inspecteur : message non envoyé — ' + (r.fautes || []).join(' ; ')); return r; };
  const options = m => ({ magasinId: m.id, regles: regles(), couts: couts() || {}, reponses: reponses(), taux: taux(), verdicts: verdicts() || [] });
  async function annoncer(res, ici) {
    dernier = { ...res, quand: new Date().toISOString() };
    if (ici) { fs.writeFileSync(path.join(ici, 'resultat.json'), JSON.stringify(dernier, null, 1)); fs.writeFileSync(path.join(ici, 'rapport.md'), rapportInspecteur(res)); }
    await dire(messageInspecteur(res));
    const q = questionInspecteur(res);
    attenteNombre = q && q.type === 'nombre' ? q.id : null;
    if (q) await dire(q.texte, q.boutons);
  }
  async function travailler(m, ici) {
    let r;
    try { r = await claude({ systeme: 'Tu es l\'INSPECTEUR (المفتّش) du bureau ecom manita. Tu LIS le compte Tassyir du client, sans rien écrire. Un outil d\'écriture est interdit. Tu rends le JSON demandé, rien d\'autre.', message: messageTour(m), outils: OUTILS_INSPECTEUR, schema: SCHEMA_INSPECTEUR, dureeMaxMs: 15 * 60000 }); }
    catch (e) { journal(`inspecteur : tour refusé — ${e.message}`); if (e.connecteur) return dire(TEXTES_INSPECTEUR.sansTassyir); if (e.quota) return dire(TEXTES_INSPECTEUR.quota); return dire(TEXTES_INSPECTEUR.echec); }
    const L = lectureDuBrut(r.appels);
    derniereLecture = { L, m, ici };
    fs.writeFileSync(path.join(ici, 'lecture.json'), JSON.stringify(L, null, 1));
    const res = inspecter(L, options(m));
    journal(`inspecteur : ${res.magasin ? res.magasin.nom : '?'} — ${res.etat || '?'}, note ${res.note ?? '—'}, ${res.constats.length} constat(s), ${res.pret ? 'prêt' : 'pas prêt'} · lu : ${res.lus.join(', ')}${res.refus.length ? ` · écritures refusées : ${res.refus.join(', ')}` : ''}`);
    await annoncer(res, ici);
  }
  /** Recalcule depuis la dernière lecture (une réponse du client) ; sans lecture, relance un vrai fichier. */
  async function recalculer() {
    if (!derniereLecture) return api.demander();
    const res = inspecter(derniereLecture.L, options(derniereLecture.m));
    await annoncer(res, derniereLecture.ici);
    return { recalcule: true };
  }
  const api = {
    occupe: () => !!enCours,
    dernier: () => dernier,
    reponses,
    async demander() {
      if (enCours) { await dire(TEXTES_INSPECTEUR.occupe); return { lance: false, raison: 'occupe' }; }
      // la toute première fois : le chemin (fix 6), avant de lire
      if (!reponses().parcours) { const q = messageParcours(); await dire(q.texte, q.boutons); return { lance: false, raison: 'parcours' }; }
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
    },
    /** « insp:p:<i> » (le chemin) ou « insp:q:<question>:<i> » (une réponse à boutons). Rend true si le bouton était pour lui. */
    async surBouton(data) {
      const p = /^insp:p:(\d)$/.exec(String(data || ''));
      if (p) { const v = QUESTION_PARCOURS.valeurs[+p[1]]; if (!v) return true; garder('parcours', v); journal(`inspecteur : chemin « ${v} »`); await api.demander(); return true; }
      const q = /^insp:q:([a-z_]+):(\d)$/.exec(String(data || ''));
      if (!q) return false;
      const oui = +q[2] === 0;
      if (q[1] === 'portefeuilles' || q[1] === 'prix_achat') { garder(q[1], oui); await recalculer(); }
      return true;
    },
    /** Un nombre tapé quand l'inspecteur attend le dollar ou le prix du retour. Rend true s'il l'a pris. */
    async surTexte(t) {
      if (!attenteNombre) return false;
      const v = Number(String(t).trim().replace(',', '.').replace(/[^\d.]/g, ''));
      if (!/^\s*\d+([.,]\d+)?\s*$/.test(String(t)) || !Number.isFinite(v)) return false;
      if (attenteNombre === 'taux' && !(v >= 100 && v <= 400)) { await dire(['هاذ الرقم ماشي سعر الدولار', 'اكتب شحال الدولار بالدينار', 'مثلاً : مية وخمسين ولا أكثر']); return true; }
      if (attenteNombre === 'retour' && !(v >= 0 && v <= 2000)) { await dire(['هاذ الرقم ماشي سعر روتور', 'اكتب واش تخلّص للشركة', 'مجاني = صفر']); return true; }
      const cle = attenteNombre; attenteNombre = null;
      garder(cle, v); ecrireReglage(cle, v);
      journal(`inspecteur : réponse ${cle} = ${v} (réglages du client)`);
      await recalculer();
      return true;
    },
    attendNombre: () => attenteNombre,
  };
  return api;
}
