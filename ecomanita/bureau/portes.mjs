// ecomanita 0.4.2 (25/10/2026) — LA PORTE DU SCALE et LE STOCK RESTANT (regles.json › scale, stock).
// La deuxième phase ne s'ouvre jamais seule : le bureau vérifie les QUATRE conditions, écrit la carte, et attend le « نعم »
// du client. Le stock restant accompagne TOUJOURS le bénéfice : au prix d'achat, en jours de couverture, avec le cash net.
// Fonctions pures ; l'épreuve les teste. Code original « ecom manita ».

export const COUVERTURE_STOP_COMMANDE = 30, COUVERTURE_DESTOCK = 45, MARCHE_SCALE = 0.25;

/**
 * @param {object} e
 *  - encaisseParColis, pubParColis, marchandiseParColis, retourParColis : en DA, sur les colis LIVRÉS (bénéfice RÉEL)
 *  - courbe : 'vert' | 'jaune' | 'rouge' (la courbe du modèle contre le cône de la boussole)
 *  - stockPieces, livreesParJour, joursHausse (2 par défaut), atelierSuit (bool)
 *  - cashRevenu, budgetJourDa, reserve : en DA (la marche = budget × 25 % × jours de hausse)
 *  - controlesOk : false quand les contrôles du soir refusent les chiffres (préalable)
 * @returns {{ ouverte, conditions: Array<{id, ok, ar, detail}>, beneficeParColis, marcheDa }}
 */
export function porteScale(e = {}) {
  const n = v => (Number.isFinite(+v) ? +v : 0);
  const benef = n(e.encaisseParColis) - n(e.pubParColis) - n(e.marchandiseParColis) - n(e.retourParColis);
  const jh = n(e.joursHausse) || 2, lpj = n(e.livreesParJour);
  const joursStock = lpj > 0 ? n(e.stockPieces) / (lpj * (1 + MARCHE_SCALE)) : Infinity;
  const marche = n(e.budgetJourDa) * MARCHE_SCALE * jh;
  const C = [
    // le préalable (simulation à trois commerçants, 25/10) : une porte ne s'ouvre pas sur des chiffres que les contrôles du
    // soir ont refusés (lien caché absent, lien non remplacé, dépense qui ne se tient pas)
    ...(e.controlesOk === false ? [{ id: 'chiffres', ok: false, ar: 'الأرقام ماشي صحاح', detail: 'les contrôles du soir refusent les chiffres : réparer le lien d\'abord' }] : []),
    { id: 'benefice', ok: benef > 0, ar: 'الربح الحقيقي على الطرد', detail: `${Math.round(benef)} DA par colis livré` },
    { id: 'courbe', ok: e.courbe === 'vert' || e.courbe === 'jaune', ar: 'المنحنى ماشي في الأحمر', detail: `courbe ${e.courbe || '?'}` },
    { id: 'stock', ok: joursStock >= jh && e.atelierSuit !== false, ar: 'الستوك يلحق والورشة تتبع', detail: `${Number.isFinite(joursStock) ? joursStock.toFixed(1) : '∞'} jours au rythme +25 %${e.atelierSuit === false ? ', atelier en retard' : ''}` },
    { id: 'cash', ok: n(e.cashRevenu) - marche >= n(e.reserve), ar: 'الكاش يغطي الخطوة بلا ما نمسّو الاحتياط', detail: `cash ${Math.round(n(e.cashRevenu))} DA − marche ${Math.round(marche)} DA ≥ réserve ${Math.round(n(e.reserve))} DA ?` },
  ];
  // le stock trop gros n'empêche pas de monter (monter le vend), mais la marche part avec l'offre de deux pièces
  const couverture = lpj > 0 ? n(e.stockPieces) / lpj : null;
  const avecDestock = couverture !== null && couverture > COUVERTURE_DESTOCK;
  return { ouverte: C.every(c => c.ok), conditions: C, beneficeParColis: Math.round(benef), marcheDa: Math.round(marche), avecDestock };
}

/** Les pièces DISPONIBLES (sur l'étagère). `totalItems` de get_inventory = tout ce qui est ENTRÉ, jamais le stock :
 *  disponible = totalItems − delivered − inTransit − damaged, ou « Sellable » de l'écran Inventaire quand le client le donne.
 *  Sans les trois soustractions (ni Sellable) → null + raison : on ne sort pas un stock d'un total. */
export function stockDisponible({ totalItems = null, delivered = null, inTransit = null, damaged = null, sellable = null } = {}) {
  if (sellable !== null && sellable !== undefined && sellable !== '') return { pieces: Math.max(0, +sellable || 0), enRoute: +inTransit || 0, source: 'sellable' };
  if ([totalItems, delivered, inTransit, damaged].some(v => v === null || v === undefined || v === '' || !Number.isFinite(+v)))
    return { pieces: null, enRoute: null, source: null, raison: 'totalItems seul ne dit pas le stock : il faut delivered, inTransit et damaged, ou « Sellable »' };
  return { pieces: Math.max(0, +totalItems - +delivered - +inTransit - +damaged), enRoute: +inTransit, source: 'formule' };
}

/** Le stock restant, au PRIX D'ACHAT (jamais la valeur de Tassyir quand elle diffère), en jours, et la règle qui s'applique. */
export function stockRestant({ pieces = 0, prixAchat = 0, valeurTassyir = null, livreesParJour = 0, enRoute = 0 } = {}) {
  const valeur = Math.round((+pieces || 0) * (+prixAchat || 0));
  const valeurEnRoute = Math.round((+enRoute || 0) * (+prixAchat || 0)); // Tassyir valorise l'étagère ET la route
  const jours = +livreesParJour > 0 ? Math.round((+pieces || 0) / +livreesParJour) : null;
  const regle = jours === null ? ((+pieces || 0) > 0 ? 'destock' : 'ok') : jours > COUVERTURE_DESTOCK ? 'destock' : jours > COUVERTURE_STOP_COMMANDE ? 'commande_interdite' : 'ok';
  const base = valeur + valeurEnRoute;
  const ecartTassyir = valeurTassyir !== null && Math.abs(+valeurTassyir - base) > 0.05 * Math.max(1, base);
  return { valeur, valeurEnRoute, jours, regle, ecartTassyir };
}
