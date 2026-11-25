#!/usr/bin/env node
// « الطالب 1.0 » (fix 9) — LE VERDICT DU TEST en ligne de commande, pour le mode manuel (les skills testing et coach du plugin).
// La même fonction que le bureau (pont.mjs › verdictProduit) : boussala_testweek decide + l'arrêt anticipé de boussala_test_ads.
// Jamais « le jour 3 ». Sortie : une ligne « MANITA_JSON {…} », comme les outils Python.
//   node verdict.mjs --prix 6900 --gros 2300 --emballage 100 --livraison 0 --retour 400 --confirmation 60 --livraison-pct 70 \
//     --taux <le taux du client> --depense-usd 120 --leads 60 --confirmees 45 [--traitees 50]
import { verdictProduit } from './pont.mjs';

const a = process.argv.slice(2), v = k => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
try {
  const r = verdictProduit({ nom: v('nom') || 'modele', prix: v('prix'), gros: v('gros'), emballage: v('emballage') || 0, livraison: v('livraison') || 0, retour: v('retour') || 0,
    confirmation: v('confirmation'), livraisonPct: v('livraison-pct'), taux: v('taux'), spendUsd: v('depense-usd'), leads: v('leads'), confirmed: v('confirmees'),
    processed: v('traitees') !== undefined ? v('traitees') : null });
  console.log('MANITA_JSON ' + JSON.stringify({ quoi: 'verdict', tag: r.tag, verdict: r.verdict, etiquette: r.etiquette, pourquoi: r.pourquoi, suite: r.suite, anticipe: r.anticipe,
    lead_max_usd: r.limites.maxLead, sommet_usd: r.limites.ceiling, pire_usd: r.limites.ceilingWorst, leads_min: r.limites.minLeads, plafond_usd: r.limites.cap, source: r.source }));
} catch (e) {
  console.log('MANITA_JSON ' + JSON.stringify({ quoi: 'verdict', erreur: e.message }));
  process.exit(2);
}
