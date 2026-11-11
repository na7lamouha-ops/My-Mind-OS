// ecomanita 0.5.0 — LA FICHE PRODUIT partagée : <maison>/carnet/produits/<MBF-Mxx>.json.
// Un modèle garde le même numéro du catalogue du الجاسوس jusqu'à la liquidation. Les agents y écrivent leurs constats
// (hypothèses, limites, stock, signaux) ; SEUL le القائد change l'étape (après le verdict de la boussole et le « نعم »).
// Aucun secret ni coordonnée de cliente n'y entre (refusDeContenu du carnet). Code original « ecom manita ».
import fs from 'node:fs';
import path from 'node:path';
import { refusDeContenu } from './carnet.mjs';

export const ETAPES_PRODUIT = ['CATALOGUE', 'TEST', 'VALIDE', 'SCALE', 'DESTOCK', 'ECHEC-ADS', 'ECHEC-CONF', 'RESERVE'];
/** Les seuls passages permis (TEST ← VALIDE ← SCALE ← DESTOCK, ou l'échec avec sa raison, ou la réserve). */
export const PASSAGES = {
  CATALOGUE: ['TEST', 'RESERVE'],
  RESERVE: ['TEST'],
  TEST: ['VALIDE', 'ECHEC-ADS', 'ECHEC-CONF', 'RESERVE'],
  VALIDE: ['SCALE', 'DESTOCK', 'ECHEC-CONF'],
  SCALE: ['DESTOCK'],
  DESTOCK: [],
  'ECHEC-ADS': ['RESERVE'],
  'ECHEC-CONF': ['RESERVE'],
};
export const passagePermis = (de, vers) => (PASSAGES[de || 'CATALOGUE'] || []).includes(vers);
export const ID_PRODUIT = /^MBF-M\d{2,3}$/;

export function ouvrirProduits(maison) {
  const dossier = path.join(maison, 'carnet', 'produits');
  fs.mkdirSync(dossier, { recursive: true });
  const f = id => { if (!ID_PRODUIT.test(id)) throw new Error('numéro de modèle invalide : ' + id); return path.join(dossier, `${id}.json`); };
  const lire = id => { try { return JSON.parse(fs.readFileSync(f(id), 'utf8')); } catch { return null; } };
  const ecrireBrut = (id, v) => { const t = f(id) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, f(id)); };
  const api = {
    lister: () => fs.readdirSync(dossier).filter(x => /^MBF-M\d+\.json$/.test(x)).sort().map(x => lire(x.replace(/\.json$/, ''))).filter(Boolean),
    lire,
    /** Le prochain numéro libre (MBF-M01, MBF-M02…). */
    prochainId() { const n = api.lister().map(p => +p.id.slice(5)).reduce((a, b) => Math.max(a, b), 0) + 1; return `MBF-M${String(n).padStart(2, '0')}`; },
    /** Crée la fiche (étape CATALOGUE) — jamais d'écrasement. */
    creer({ id = null, nom, source = null, ...reste } = {}) {
      const k = id || api.prochainId();
      if (lire(k)) throw new Error('fiche déjà là : ' + k);
      const v = { id: k, nom: String(nom || k), etape: 'CATALOGUE', tassyirId: null, source, hypotheses: {}, limites: {}, stock: {}, signaux: {}, decisions: [], ...reste, cree: new Date().toISOString() };
      const refus = refusDeContenu(JSON.stringify(v)); if (refus) throw new Error(refus);
      ecrireBrut(k, v); return v;
    },
    /** Un agent complète la fiche (fusion d'un niveau). L'étape ne se change JAMAIS par ici. */
    completer(id, champs, agent = '?') {
      const v = lire(id); if (!v) throw new Error('fiche absente : ' + id);
      if ('etape' in champs || 'decisions' in champs) throw new Error("l'étape et les décisions passent par le القائد");
      const refus = refusDeContenu(JSON.stringify(champs)); if (refus) throw new Error(refus);
      for (const [k, x] of Object.entries(champs)) v[k] = x && typeof x === 'object' && !Array.isArray(x) && v[k] && typeof v[k] === 'object' ? { ...v[k], ...x } : x;
      v.maj = { quand: new Date().toISOString(), agent };
      ecrireBrut(id, v); return v;
    },
    /** Le changement d'étape (appelé par le القائد seulement, après « نعم ») : daté, avec qui a jugé et ce qu'il savait. */
    changerEtape(id, vers, { par, verdict = null, naam = false } = {}) {
      const v = lire(id); if (!v) throw new Error('fiche absente : ' + id);
      if (!naam) throw new Error('changement d\'étape sans « نعم »');
      if (!passagePermis(v.etape, vers)) throw new Error(`passage interdit : ${v.etape} → ${vers}`);
      v.decisions = [...(v.decisions || []), { quand: new Date().toISOString(), de: v.etape, vers, par: par || '?', verdict }];
      v.etape = vers; ecrireBrut(id, v); return v;
    },
  };
  return api;
}
