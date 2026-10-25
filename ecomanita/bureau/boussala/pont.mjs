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

export function listeOutils() { const { TOOLS } = require('./adapters/tools.js'); return TOOLS.map(t => t.name); }

/** Le message Telegram quand le cerveau manque (loi de forme). */
export const TEXTE_SANS_CERVEAU = ['🧭 البوصلة', 'العقل ما راهوش : المحرّك ما خدمش', 'الوكلاء اللي يحسبو راهم حابسين', 'شوف التحضير في المكتب'].join('\n');
