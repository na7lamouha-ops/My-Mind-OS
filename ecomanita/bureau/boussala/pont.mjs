// ecomanita 0.5.0 — LE PONT vers la boussole 29.18 (l'unique cerveau des chiffres).
// Le moteur est en CommonJS (copié tel quel de chantier/ecomanita-masar/boussala) ; le bureau est en ESM : createRequire.
// Règle : un agent qui calcule ne calcule QUE par ici. Si le golden n'est pas 6/6, le cerveau est « absent » et
// outil() refuse — l'agent bloque et le dit (« العقل ما راهوش »). Aucun chiffre ne sort d'une tête.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let cache = null;

/** Rejoue les six cas de référence (tests/golden-v29.json) dans le processus, comme tests/run.js, sans process.exit. */
export function golden() {
  try {
    const E = require('./engine/boussala-engine.js');
    const G = require('./tests/golden-v29.json');
    let pass = 0; const echecs = [];
    for (const c of G.cases) {
      const ctx = E.makeCtx({ ...G.base, ...c.settings });
      const p = E.normProduct(c.product, ctx);
      const R = E.calcOneProduct(p, E.sharedOf(ctx), ctx.target, ctx);
      const got = { ...R, ab: E.abExtra(p, R, ctx).profit };
      const errs = [];
      for (const [k, exp] of Object.entries(c.expect)) {
        const g = got[k];
        if (exp === null) { if (g !== null && g !== undefined) errs.push(k); continue; }
        const tol = Math.max(0.011, Math.abs(exp) * 1e-6) + (k === 'ab' ? 1 : 0);
        if (!(Math.abs(g - exp) <= tol)) errs.push(k);
      }
      if (errs.length) echecs.push(`${c.name}: ${errs.join(',')}`); else pass++;
    }
    return { ok: echecs.length === 0 && pass === G.cases.length, pass, total: G.cases.length, version: E.ENGINE_VERSION, echecs };
  } catch (e) {
    return { ok: false, pass: 0, total: 6, version: null, echecs: ['moteur introuvable : ' + e.message] };
  }
}

/** L'état du cerveau (golden rejoué une fois par processus ; `relire` pour forcer). */
export function etatCerveau({ relire = false } = {}) {
  if (!cache || relire) cache = golden();
  return cache;
}
export const cerveauPret = () => etatCerveau().ok;

/** Pour l'épreuve : simuler un moteur absent ou cassé sans toucher au disque. */
export function _forcerEtat(etat) { cache = etat; }

/** Un outil du moteur (boussala_guide, boussala_commit, boussala_pick, boussala_testweek…). Refuse si le cerveau n'est pas là. */
export function outil(nom, entree = {}) {
  const e = etatCerveau();
  if (!e.ok) throw Object.assign(new Error(`العقل ما راهوش (golden ${e.pass}/${e.total})`), { cerveau: false });
  const { callTool } = require('./adapters/tools.js');
  return callTool(nom, entree);
}

/**
 * « الطالب 1.0 » — LE SOMMET ET LE PIRE CAS AVANT TOUT LANCEMENT, par la boussole (boussala_testweek, mode plan).
 * Entrée en dinars et en pourcentages (le client) ; sortie : les limites du moteur ($) et leurs équivalents en dinars, au taux du CLIENT.
 *   parConfirmeeDa = le plafond par commande CONFIRMÉE (ceiling × taux) — le juge du test
 *   parCommandeDa  = le plafond par commande REÇUE / lead (maxLead × taux) — la structure et l'arrêt
 *   parLivreeDa    = le plafond par colis LIVRÉ (ceiling × taux ÷ livraison) — après VALIDE
 *   pireParConfirmeeDa = le plafond au pire cas (livraison − 8 points, ceilingWorst × taux)
 * Sans taux du client : refus (aucun cours inventé). Moteur absent : refus « العقل ما راهوش ».
 */
export function limitesProduit({ nom = 'modele', prix, gros, emballage = 0, livraison = 0, retour = 0, confirmation, livraisonPct, taux, leadUsd = null } = {}) {
  if (!(+taux > 0)) throw Object.assign(new Error('le taux du dollar du client manque (الإعدادات) : la boussole ne calcule pas sans lui'), { taux: false });
  for (const [k, v] of [['prix', prix], ['gros', gros], ['confirmation', confirmation], ['livraison %', livraisonPct]]) if (!(+v > 0)) throw new Error(`la boussole a besoin de « ${k} »`);
  const r = outil('boussala_testweek', { mode: 'plan', models: [{ name: nom, sell: +prix, buy: +gros, conf: +confirmation, del: +livraisonPct, ...(leadUsd ? { leadUsd: +leadUsd } : {}) }],
    settings: { rate: +taux, pack: +emballage || 0, delCost: +livraison || 0, retCost: +retour || 0 } });
  const L = r.data && r.data.limits && r.data.limits[0];
  if (!L) throw new Error('la boussole n\'a rendu aucune limite');
  if (!L.ok) return { ok: false, passe: false, limites: L, source: 'boussala_testweek ' + etatCerveau().version };
  const t = +taux;
  return { ok: true, passe: L.ceiling > 0, limites: L, source: 'boussala_testweek ' + etatCerveau().version,
    parConfirmeeDa: Math.round(L.ceiling * t), parCommandeDa: Math.round(L.maxLead * t), parLivreeDa: Math.round(L.ceiling * t / (L.del / 100)),
    pireParConfirmeeDa: Math.round(L.ceilingWorst * t), arretUsd: L.cap, zeroLeadStopUsd: L.zeroLeadStop, budgetRecommandeUsd: L.budget, joursRecommandes: L.days };
}

/**
 * « الطالب 1.0 » (fix 9) — LE VERDICT DU TEST, par la boussole seule (jamais « le jour 3 »).
 *   les LEADS arrêtent, les CONFIRMÉES jugent : boussala_testweek mode decide (50 leads, confiance 90 %) ;
 *   l'arrêt anticipé : les règles de boussala_test_ads (dès 25 leads, le lead au-dessus de 1,3 × le lead maximum ;
 *   aucun lead et 3 × le lead maximum dépensés) — lues dans le moteur, pas recopiées ici.
 * Entrée : le produit (comme limitesProduit) + spendUsd, leads, confirmed, processed (confirmées + annulées : celles déjà traitées).
 * Sortie : { tag (celui du moteur), verdict ('VALIDE' | 'FIX' | 'ECHEC' | 'RESERVE' | null = le test continue), etiquette (le tag
 *   Tassyir à écrire, null tant que le test continue), pourquoi, suite, limites, cpl, cpc, anticipe }.
 */
export const VERDICT_DU_TAG = { VALIDE: 'VALIDE', FIX: 'FIX', 'ECHEC-ADS': 'ECHEC', 'ECHEC-CONF': 'ECHEC', 'ECHEC-RESERVE': 'RESERVE' };
export const ETIQUETTE_DU_TAG = { VALIDE: 'VALIDE', 'ECHEC-ADS': 'ECHEC-ADS', 'ECHEC-CONF': 'ECHEC-CONF', 'ECHEC-RESERVE': 'RESERVE' };
export function verdictProduit({ nom = 'modele', prix, gros, emballage = 0, livraison = 0, retour = 0, confirmation, livraisonPct, taux, spendUsd = 0, leads = 0, confirmed = 0, processed = null } = {}) {
  if (!(+taux > 0)) throw Object.assign(new Error('le taux du dollar du client manque (الإعدادات) : la boussole ne juge pas sans lui'), { taux: false });
  for (const [k, v] of [['prix', prix], ['gros', gros], ['confirmation', confirmation], ['livraison %', livraisonPct]]) if (!(+v > 0)) throw new Error(`la boussole a besoin de « ${k} »`);
  const settings = { rate: +taux, pack: +emballage || 0, delCost: +livraison || 0, retCost: +retour || 0 };
  const res = { name: nom, sell: +prix, buy: +gros, conf: +confirmation, del: +livraisonPct, spend: +spendUsd || 0, leads: +leads || 0, confirmed: +confirmed || 0, ...(processed != null ? { processed: +processed } : {}) };
  const d = outil('boussala_testweek', { mode: 'decide', results: [res], settings }).data.decisions[0];
  let tag = d.tag, pourquoi = d.why, suite = d.next, anticipe = null;
  const L = d.limits || {};
  // l'arrêt anticipé (boussala_test_ads) : seulement quand testweek laisse encore tourner
  if (tag === 'TEST' && L.ok) {
    const { RULES } = require('./engine/testads.js');
    const k = res.leads, cpl = k ? res.spend / k : null;
    if (k === 0 && res.spend >= RULES.DEAD_X * L.maxLead) anticipe = 'sans_lead';
    else if (k >= RULES.EARLY_LEADS && k < RULES.MIN_LEADS && cpl > RULES.EARLY_X * L.maxLead) anticipe = 'lead_cher';
    if (anticipe) { tag = 'ECHEC-ADS'; pourquoi = anticipe === 'sans_lead' ? `${res.spend}$ مصروفين بلا حتى ليد (${RULES.DEAD_X}× الليد الأقصى ${L.maxLead}$)` : `${k} ليد والليد ${cpl.toFixed(2)}$ فوق ${RULES.EARLY_X}× الليد الأقصى ${L.maxLead}$`; suite = 'نوقفو بكري، الميدياباير يبدّل الزاوية'; }
  }
  return { ok: tag !== '?', tag, verdict: VERDICT_DU_TAG[tag] || null, etiquette: ETIQUETTE_DU_TAG[tag] || null, pourquoi, suite, limites: L, cpl: d.cpl ?? null, cpc: d.cpc ?? null, anticipe,
    source: `boussala_testweek decide ${etatCerveau().version}${anticipe ? ' + boussala_test_ads (arrêt anticipé)' : ''}` };
}

export function listeOutils() { const { TOOLS } = require('./adapters/tools.js'); return TOOLS.map(t => t.name); }

/** Le message Telegram quand le cerveau manque (loi de forme). */
export const TEXTE_SANS_CERVEAU = ['🧭 البوصلة', 'العقل ما راهوش : المحرّك ما خدمش', 'الوكلاء اللي يحسبو راهم حابسين', 'شوف التحضير في المكتب'].join('\n');

/** La page « بوصلة التاجر » (fix 7) : les champs de la page → les limites de testweek (le test) et le texte du guide (le chemin).
 *  Le paragraphe « 🧪 التاست = 100 ليد… » du guide est retiré : il contredit testweek (50 événements par groupe), la règle de 1.0 ;
 *  la page montre le plan de testweek à la place (écart signalé au moteur pour 1.1). */
export function calculBoussole(e = {}) {
  const n = v => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(/[\s ]/g, '').replace(',', '.')));
  const taux = n(e.taux), cpl = n(e.cpl);
  const L = limitesProduit({ nom: String(e.nom || 'Modele').slice(0, 40), prix: n(e.prix), gros: n(e.achat), emballage: n(e.emballage) || 0, livraison: (n(e.livraison) || 0) + (n(e.fraisCod) || 0),
    retour: n(e.retour) || 0, confirmation: n(e.confirmation), livraisonPct: n(e.tauxLivraison), taux, leadUsd: cpl && taux ? cpl / taux : null });
  let guide = null;
  if (L.ok && n(e.objectif) > 0) {
    const g = outil('boussala_guide', { settings: { rate: taux, pack: n(e.emballage) || 0, delCost: (n(e.livraison) || 0) + (n(e.fraisCod) || 0), retCost: n(e.retour) || 0, target: n(e.objectif), ...(n(e.jours) > 0 ? { period: n(e.jours) } : {}), ...(n(e.surplus) >= 0 && e.surplus !== '' && e.surplus != null ? { surplus: n(e.surplus) } : {}) },
      products: [{ name: String(e.nom || 'Modele').slice(0, 40), sell: n(e.prix), buy: n(e.achat), conf: n(e.confirmation), del: n(e.tauxLivraison), ...(cpl ? { lead: cpl } : {}) }] });
    guide = String(g.text || '').split(/\n(?=\S)/).filter(b => !/^🧪 التاست =/.test(b)).join('\n');
  }
  return { ...L, guide, version: etatCerveau().version };
}
