// ecomanita 0.5.0 — LES PETITES RÈGLES DU MASAR (port ESM de chantier/ecomanita-masar/scripts/masar.js, 13 fonctions, 26 contrôles).
// Le gros calcul (bénéfice, capital, lead max, verdict) = la boussole (boussala/pont.mjs). Ici seulement les règles confirmées.
// Fonctions PURES, mêmes entrées et mêmes sorties que masar.js ; l'épreuve rejoue ses 26 contrôles (testerRegles).
const n = v => (Number.isFinite(+v) ? +v : 0);

/* 0 · المفتّش — النقطة بطريقة الأكاديمية (مؤكّدة 25/10):
   أخضر = 1، برتقالي = 0.5، أحمر = 0، المجهول ما يدخلش في الحساب بصح يسكّر الباب.
   checks = [{ id, etat: 'vert'|'orange'|'rouge'|'inconnu'|'na' }]   (na = ما يخصّش هذا المتجر، مثلاً أسباب الروتور بلا روتور) */
export function noteInspecteur({ checks = [] } = {}) {
  const lus = checks.filter(c => c.etat === 'vert' || c.etat === 'orange' || c.etat === 'rouge');
  const pts = lus.reduce((s, c) => s + (c.etat === 'vert' ? 1 : c.etat === 'orange' ? 0.5 : 0), 0);
  const note = lus.length ? Math.round(pts / lus.length * 100) : 0;
  const rouges = checks.filter(c => c.etat === 'rouge').map(c => c.id);
  const inconnus = checks.filter(c => c.etat === 'inconnu').map(c => c.id);
  return { note, lus: lus.length, rouges, inconnus, porteOuverte: rouges.length === 0 && inconnus.length === 0 };
}

/* الستوك المتاح: totalItems = كل اللي دخل، ماشي الستوك. */
export function stockDisponible({ totalItems = null, delivered = null, inTransit = null, damaged = null, sellable = null } = {}) {
  if (sellable !== null && sellable !== undefined && sellable !== '') return { pieces: Math.max(0, n(sellable)), enRoute: n(inTransit), source: 'sellable' };
  if ([totalItems, delivered, inTransit, damaged].some(v => v === null || v === undefined || v === '' || !Number.isFinite(+v)))
    return { pieces: null, enRoute: null, source: null, raison: 'totalItems وحدو ما يقولش الستوك: يلزم delivered وinTransit وdamaged، ولا «Sellable»' };
  return { pieces: Math.max(0, n(totalItems) - n(delivered) - n(inTransit) - n(damaged)), enRoute: n(inTransit), source: 'formule' };
}

/* أيام التغطية والقاعدة: فوق 30 يوم = ممنوع إنتاج جديد، فوق 45 = تصفية. */
export function couverture({ pieces = 0, livreesParJour = 0, prixAchat = 0, enRoute = 0 } = {}) {
  const jours = n(livreesParJour) > 0 ? Math.round(n(pieces) / n(livreesParJour)) : null;
  const regle = jours === null ? (n(pieces) > 0 ? 'destock' : 'ok') : jours > 45 ? 'destock' : jours > 30 ? 'commande_interdite' : 'ok';
  return { jours, regle, valeurRayon: Math.round(n(pieces) * n(prixAchat)), valeurEnRoute: Math.round(n(enRoute) * n(prixAchat)) };
}

/* نقطة إعادة الطلب = السرعة × (مدة الورشة + 3 أيام). */
export function pointCommande({ vitesseJour = 0, delaiAtelierJours = 0, stockPieces = 0 } = {}) {
  const seuil = Math.ceil(n(vitesseJour) * (n(delaiAtelierJours) + 3));
  return { seuil, commanderMaintenant: n(stockPieces) <= seuil };
}

/* تقسيم طلبية الورشة حسب طلب آخر 5 أيام على كل لون × مقاس (ماشي بالتساوي). Min 30 للدفعة كاملة. */
export function repartitionCommande({ total = 0, demandes = {} } = {}) {
  const T = Math.round(n(total));
  if (T < 30) return { ok: false, raison: 'الدفعة تحت 30 قطعة: الورشة ما تربحش، والموديل ما يستاهلش' };
  const ent = Object.entries(demandes).filter(([, v]) => n(v) > 0);
  const somme = ent.reduce((s, [, v]) => s + n(v), 0);
  if (!somme) return { ok: false, raison: 'ما كاين حتى طلب في آخر 5 أيام' };
  const parts = ent.map(([k, v]) => ({ k, exact: T * n(v) / somme }));
  parts.forEach(p => { p.q = Math.floor(p.exact); });
  let reste = T - parts.reduce((s, p) => s + p.q, 0);
  parts.slice().sort((a, b) => (b.exact - b.q) - (a.exact - a.q)).forEach(p => { if (reste > 0) { p.q++; reste--; } });
  return { ok: true, total: T, parVariante: Object.fromEntries(parts.map(p => [p.k, p.q])) };
}

/* آخر طلبية للورشة: قبل نهاية الموسم بمدة التحضير + التوصيل (البوصلة: حوالي 8 أيام). */
export function derniereCommande({ jourFin = 0, prepJours = 5, livraisonJours = 3 } = {}) {
  return { jour: Math.max(0, n(jourFin) - n(prepJours) - n(livraisonJours)) };
}

/* 5 · الهيكل من الملف: نصيب الفيديو = البودجي ÷ الفيديوهات. للحكم على فيديو وحدو = 15 × أقصى ليد ÷ 3 أيام.
   ≥ هذا ← ABO · من 3$ حتى هذا ← CBO (3$ على الأقل لكل مجموعة) · تحت 3$ ← فيديوهات أقل · 1 إلى 4 فيديوهات. */
export function structureTest({ videos = 0, budgetJourUsd = 0, leadMaxUsd = 0 } = {}) {
  const haut = Math.max(0, Math.min(4, Math.floor(n(videos))));
  const b = Math.floor(n(budgetJourUsd) * 100) / 100;
  const juge = n(leadMaxUsd) > 0 ? 15 * n(leadMaxUsd) / 3 : null;
  if (!haut || b < 3) return { n: 0, structure: null, partUsd: 0, jugeMinUsd: juge, raison: 'تحت 3$ لفيديو واحد: ما يخرج والو' };
  let k = haut; while (k > 1 && b / k < 3) k--;
  const part = b / k;
  const structure = k === 1 ? 'ABO' : (juge !== null && part >= juge - 1e-9 ? 'ABO' : 'CBO');
  return { n: k, structure, partUsd: Math.round(part * 100) / 100, jugeMinUsd: juge, enlevees: haut - k,
    cboMinParAdsetUsd: structure === 'CBO' ? 3 : null };
}

/* الرابط المخفي: نفس الرابط في كل إعلان، ميتا تبدّل الأقواس بالأرقام. */
export function lienSuivi({ page = '' } = {}) {
  const ligne = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';
  const p = String(page || '');
  return { lien: p ? p + (p.includes('?') ? '&' : '?') + ligne : '', ligne };
}

/* الفحوص قبل الحكم (كل ليلة): حمراء = ما نحكموش على الفيديوهات. */
export function controlesAvantVerdict({ annoncesSansLien = 0, lienNonRemplace = false, commandesTotal = 0, commandesSansTicket = 0,
  depenseMetaUsd = 0, depenseTassyirUsd = 0, pixelEcart = false } = {}) {
  const r = [];
  if (n(annoncesSansLien) > 0) r.push({ id: 'lien_absent', niveau: 'rouge', ar: 'إعلان بلا الرابط المخفي' });
  if (lienNonRemplace) r.push({ id: 'lien_non_remplace', niveau: 'rouge', ar: 'ميتا ما بدّلتش الأقواس: الرابط مكتوب غالط' });
  const pct = n(commandesTotal) > 0 ? n(commandesSansTicket) / n(commandesTotal) : 0;
  if (pct > 0.10) r.push({ id: 'sans_ticket', niveau: 'jaune', ar: `طلبيات بلا مصدر: ${Math.round(pct * 100)}%` });
  const base = Math.max(1, n(depenseMetaUsd));
  if (n(depenseMetaUsd) >= 1 && Math.abs(n(depenseMetaUsd) - n(depenseTassyirUsd)) / base > 0.05) r.push({ id: 'depense_ecart', niveau: 'rouge', ar: 'صرف ميتا ≠ صرف تسيير' });
  if (pixelEcart) r.push({ id: 'pixel', niveau: 'jaune', ar: 'البيكسل ما يطابقش تسيير (مكرّر ولا ناقص)' });
  return { ok: !r.some(x => x.niveau === 'rouge'), alertes: r };
}

/* مكتبة الكرياتيف: تحت 15 ليد = «ما تقاستش» (ماشي خاسرة). الحكم على ثمن المؤكّدة (TEST) ولا الموصّلة (VALIDE). */
export function statutVideo({ leads = 0, depenseUsd = 0, base = 0, plafondUsd = null } = {}) {
  if (n(leads) < 15) return { statut: 'pas_mesuree', cout: null };
  const cout = n(base) > 0 ? n(depenseUsd) / n(base) : null;
  if (cout === null) return { statut: 'perdante', cout: null };
  return { statut: plafondUsd ? (cout <= n(plafondUsd) ? 'gagnante' : 'perdante') : 'mesuree', cout: Math.round(cout * 100) / 100 };
}
/* وسم = قاعدة غير من 5 فيديوهات مقاسة. */
export function poidsEtiquette({ mesurees = 0 } = {}) { return { poids: n(mesurees) >= 5 ? 'قاعدة' : 'ملاحظة' }; }

/* الجاسوس: الدرجات التسعة ← لون الطالب. */
export function couleurSpy({ rang = 9 } = {}) { const r = n(rang); return { couleur: r >= 1 && r <= 3 ? '🟢' : r <= 6 ? '🟡' : '⚪' }; }

/* 8 · باب السكايل: الأرقام صحاح + 4 شروط + «نعم» من التاجر (ما يتحلّش وحدو). */
export function porteScale(e = {}) {
  const benef = n(e.encaisseParColis) - n(e.pubParColis) - n(e.marchandiseParColis) - n(e.retourParColis) - n(e.commissionParColis);
  const jh = n(e.joursHausse) || 2, lpj = n(e.livreesParJour);
  const joursStock = lpj > 0 ? n(e.stockPieces) / (lpj * 1.25) : Infinity;
  const marche = n(e.budgetJourDa) * 0.25 * jh;
  const C = [
    ...(e.controlesOk === false ? [{ id: 'chiffres', ok: false, ar: 'الأرقام ماشي صحاح (الفحوص حمرا)' }] : []),
    { id: 'benefice', ok: benef > 0, ar: 'الربح الحقيقي على الطرد الموصّل', valeur: Math.round(benef) },
    { id: 'courbe', ok: e.courbe === 'vert' || e.courbe === 'jaune', ar: 'المنحنى ماشي تحت الأسوأ' },
    { id: 'stock', ok: joursStock >= jh && e.atelierSuit !== false, ar: 'الستوك يلحق والورشة تتبع' },
    { id: 'cash', ok: n(e.cashRevenu) - marche >= n(e.reserve), ar: 'الكاش اللي رجع يغطي الخطوة والاحتياط ما يتمسّش' },
  ];
  const cov = lpj > 0 ? n(e.stockPieces) / lpj : null;
  return { ouverte: C.every(c => c.ok), conditions: C, beneficeParColis: Math.round(benef), marcheDa: Math.round(marche),
    avecDestock: cov !== null && cov > 45, attendreNaam: true };
}

export const F = { noteInspecteur, stockDisponible, couverture, pointCommande, repartitionCommande, derniereCommande, structureTest,
  lienSuivi, controlesAvantVerdict, statutVideo, poidsEtiquette, couleurSpy, porteScale };

/** Les 26 contrôles de masar.js, rejoués tels quels. Rend { ok: [noms], ko: [noms] } (sans console). */
export function testerRegles() {
  const ok = [], ko = [];
  const t = (nom, cond) => (cond ? ok : ko).push(nom);
  const a = noteInspecteur({ checks: [{ id: 'a', etat: 'vert' }, { id: 'b', etat: 'orange' }, { id: 'c', etat: 'vert' }, { id: 'd', etat: 'na' }] });
  t('note 83, porte ouverte', a.note === 83 && a.porteOuverte);
  t('inconnu ferme la porte', !noteInspecteur({ checks: [{ id: 'a', etat: 'vert' }, { id: 'w', etat: 'inconnu' }] }).porteOuverte);
  t('rouge ferme la porte', noteInspecteur({ checks: [{ id: 'r', etat: 'rouge' }, { id: 'a', etat: 'vert' }] }).rouges.length === 1);
  t('stock 90−71−6−1 = 12', stockDisponible({ totalItems: 90, delivered: 71, inTransit: 6, damaged: 1 }).pieces === 12);
  t('totalItems seul refusé', stockDisponible({ totalItems: 90 }).pieces === null);
  const c = couverture({ pieces: 12, livreesParJour: 71 / 91, prixAchat: 2500, enRoute: 6 });
  t('couverture 15 j ok', c.jours === 15 && c.regle === 'ok' && c.valeurRayon === 30000 && c.valeurEnRoute === 15000);
  t('33 j interdit, 50 j destock', couverture({ pieces: 100, livreesParJour: 3 }).regle === 'commande_interdite' && couverture({ pieces: 150, livreesParJour: 3 }).regle === 'destock');
  t('point de commande', pointCommande({ vitesseJour: 10, delaiAtelierJours: 4, stockPieces: 60 }).seuil === 70);
  const rp = repartitionCommande({ total: 50, demandes: { 'Noir-M': 10, 'Noir-L': 6, 'Vert-M': 4 } });
  t('répartition 25/15/10', rp.ok && rp.parVariante['Noir-M'] === 25 && rp.parVariante['Noir-L'] === 15 && rp.parVariante['Vert-M'] === 10);
  t('moins de 30 refusé', !repartitionCommande({ total: 20, demandes: { a: 1 } }).ok);
  t('dernière commande J42', derniereCommande({ jourFin: 50, prepJours: 5, livraisonJours: 3 }).jour === 42);
  const s1 = structureTest({ videos: 4, budgetJourUsd: 60, leadMaxUsd: 2 });
  t('60$ 4 vidéos lead max 2$ → ABO (15 ≥ 10)', s1.structure === 'ABO' && s1.n === 4);
  const s2 = structureTest({ videos: 4, budgetJourUsd: 20, leadMaxUsd: 3 });
  t('20$ 4 vidéos → CBO (5 < 15)', s2.structure === 'CBO' && s2.n === 4);
  const s3 = structureTest({ videos: 4, budgetJourUsd: 9, leadMaxUsd: 3 });
  t('9$ → 3 vidéos CBO', s3.n === 3 && s3.structure === 'CBO');
  t('2$ → rien', structureTest({ videos: 2, budgetJourUsd: 2, leadMaxUsd: 3 }).n === 0);
  t('lien caché', lienSuivi({ page: 'https://x.tassyir.io/p/a' }).lien.endsWith('utm_content={{ad.id}}'));
  t('contrôle dépense 10% rouge', !controlesAvantVerdict({ depenseMetaUsd: 100, depenseTassyirUsd: 89 }).ok);
  t('contrôles propres ok', controlesAvantVerdict({ depenseMetaUsd: 100, depenseTassyirUsd: 98, commandesTotal: 100, commandesSansTicket: 5 }).ok);
  t('14 leads pas mesurée', statutVideo({ leads: 14, depenseUsd: 30, base: 10, plafondUsd: 5 }).statut === 'pas_mesuree');
  t('gagnante', statutVideo({ leads: 30, depenseUsd: 30, base: 12, plafondUsd: 3 }).statut === 'gagnante');
  t('5 vidéos = قاعدة', poidsEtiquette({ mesurees: 5 }).poids === 'قاعدة' && poidsEtiquette({ mesurees: 4 }).poids === 'ملاحظة');
  t('couleurs spy', couleurSpy({ rang: 1 }).couleur === '🟢' && couleurSpy({ rang: 5 }).couleur === '🟡' && couleurSpy({ rang: 8 }).couleur === '⚪');
  const base = { encaisseParColis: 6400, pubParColis: 1600, marchandiseParColis: 2500, retourParColis: 300, commissionParColis: 0, courbe: 'vert', stockPieces: 120, livreesParJour: 8, atelierSuit: true, cashRevenu: 400000, budgetJourDa: 15000, reserve: 100000 };
  t('porte ouverte (2 000 DA)', porteScale(base).ouverte && porteScale(base).beneficeParColis === 2000);
  t('porte fermée si chiffres faux', !porteScale({ ...base, controlesOk: false }).ouverte);
  t('porte fermée si courbe rouge', !porteScale({ ...base, courbe: 'rouge' }).ouverte);
  t('commission compte', porteScale({ ...base, commissionParColis: 150 }).beneficeParColis === 1850);
  return { ok, ko };
}
