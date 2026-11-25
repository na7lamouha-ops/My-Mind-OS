// ecom manita — LES TROIS CONTRÔLES. Aucun livrable n'atteint le client avec moins de trois contrôles
// DIFFÉRENTS : (1) l'outil — le tour s'est fini proprement et le livrable a la forme exigée ;
// (2) la source — le livrable cite ce qu'il a lu, et les outils cités ont vraiment été appelés ;
// (3) l'auditeur — un second tour de Claude, indépendant, relit le livrable et rend un verdict.
// Chaque contrôle rend PASSE, ECHEC ou NON_VERIFIABLE avec sa raison brute. Jamais un PASSE déduit.
import { tour, jsonDans } from './moteur.mjs';

const chiffreDansLigneArabe = texte => String(texte).split('\n').some(l => /[؀-ۿ]/.test(l) && /\d/.test(l) && !/^\s*[-*]?\s*(Sources lues|Contrôle intégré)/i.test(l));

/** Contrôle 1 — l'outil : le tour et la forme. */
export function controleOutil(resultat) {
  if (!resultat || resultat.estErreur) return { verdict: 'ECHEC', detail: 'le tour de Claude a rendu une erreur' };
  const t = String(resultat.texte || '');
  if (t.length < 40) return { verdict: 'ECHEC', detail: `livrable trop court (${t.length} caractères)` };
  const manques = [];
  if (!/Sources lues\s*:/i.test(t)) manques.push('pas de ligne « Sources lues : »');
  if (!/Contrôle intégré\s*:/i.test(t)) manques.push('pas de ligne « Contrôle intégré : »');
  if (chiffreDansLigneArabe(t)) manques.push('un chiffre à l\'intérieur d\'une ligne arabe (loi de forme)');
  if (manques.length) return { verdict: 'ECHEC', detail: manques.join(' ; ') };
  return { verdict: 'PASSE', detail: `tour fini en ${Math.round((resultat.dureeMs || 0) / 1000)} s, forme conforme` };
}

/** Contrôle 2 — la source : ce qui est cité a vraiment été lu (outils appelés), sinon NON_VERIFIABLE. */
export function controleSource(resultat, connecteursAttendus = []) {
  const t = String(resultat?.texte || '');
  const m = /Sources lues\s*:\s*([^\n]*)/i.exec(t);
  const cite = m ? m[1].trim() : '';
  const outils = (resultat?.outils || []).filter(o => /^mcp__|^Web(Search|Fetch)$/.test(o)); // seuls les connecteurs et le web prouvent une lecture ; ToolSearch & co ne comptent pas
  if (!cite) return { verdict: 'ECHEC', detail: 'aucune source citée' };
  if (/aucune|rien lu|pas pu lire|carnet vide|ما قريت|حتى واحدة|والو|ما قدرتش/i.test(cite) && !outils.length) return { verdict: 'PASSE', detail: 'le livrable dit honnêtement qu\'il n\'a rien lu à la source : ' + cite.slice(0, 120) };
  if (!outils.length) {
    if (connecteursAttendus.length) return { verdict: 'NON_VERIFIABLE', detail: `sources citées (« ${cite.slice(0, 100)} ») mais aucun outil appelé pendant le tour — la lecture n'est pas prouvée` };
    return { verdict: 'PASSE', detail: 'sources citées, tâche sans connecteur (lecture du carnet seulement) : ' + cite.slice(0, 120) };
  }
  return { verdict: 'PASSE', detail: `sources citées et ${outils.length} outil(s) réellement appelé(s) : ${outils.slice(0, 6).join(', ')}` };
}

const SYSTEME_AUDITEUR = `Tu es l'AUDITEUR du bureau « ecom manita ». Tu relis le livrable d'un autre agent et tu cherches activement l'erreur : chiffre non sourcé, promesse de vente, action irréversible non demandée, secret ou coordonnée de cliente, calcul d'argent fait de tête, ROAS pas sur les livrés, colis en route comptés livrés, montant sans les deux monnaies, chiffre dans une phrase arabe, affirmation « c'est fait » sans relecture. Tu ne refais pas le travail. Tu ne complimentes pas.
Réponds UNIQUEMENT par un JSON strict : {"verdict":"CONFIRME|FAUX|NON_VERIFIABLE","fautes":["…"],"a_corriger":"<ce qu'il faut changer, une phrase par faute, ou vide>"}`;

/** Contrôle 3 — l'auditeur : un second tour, indépendant, sans outil. */
export async function controleAuditeur({ tache, resultat, modele = 'sonnet', dureeMaxMs = 120000 }) {
  const message = `TÂCHE DEMANDÉE (département ${tache.departement}, poste ${tache.poste}) :\n${tache.texte}\n\nLIVRABLE À AUDITER :\n${String(resultat?.texte || '').slice(0, 12000)}\n\nOUTILS RÉELLEMENT APPELÉS PENDANT LE TOUR : ${(resultat?.outils || []).join(', ') || 'aucun'}`;
  try {
    const r = await tour({ message, systeme: SYSTEME_AUDITEUR, modele, dureeMaxMs, outilsAutorises: [], web: false, chrome: false });
    let j = {}; try { j = jsonDans(r.texte); } catch { return { verdict: 'NON_VERIFIABLE', detail: 'l\'auditeur n\'a pas rendu de JSON : ' + r.texte.slice(0, 200), usage: r.usage }; }
    const v = String(j.verdict || '').toUpperCase();
    const fautes = Array.isArray(j.fautes) ? j.fautes.map(String) : [];
    if (v === 'CONFIRME') return { verdict: 'PASSE', detail: 'auditeur : CONFIRMÉ' + (fautes.length ? ' avec remarques : ' + fautes.join(' ; ') : ''), fautes, aCorriger: j.a_corriger || '', usage: r.usage };
    if (v === 'FAUX') return { verdict: 'ECHEC', detail: 'auditeur : FAUX — ' + fautes.join(' ; '), fautes, aCorriger: j.a_corriger || '', usage: r.usage };
    return { verdict: 'NON_VERIFIABLE', detail: 'auditeur : NON VÉRIFIABLE — ' + (fautes.join(' ; ') || 'sans raison donnée'), fautes, aCorriger: j.a_corriger || '', usage: r.usage };
  } catch (e) { return { verdict: 'NON_VERIFIABLE', detail: 'auditeur injoignable : ' + e.message }; }
}

export function verdictGlobal(c) {
  const v = [c.outil, c.source, c.auditeur].map(x => x?.verdict || 'NON_VERIFIABLE');
  if (v.includes('ECHEC')) return 'ECHEC';
  if (v.includes('NON_VERIFIABLE')) return 'NON_VERIFIABLE';
  return 'PASSE';
}
