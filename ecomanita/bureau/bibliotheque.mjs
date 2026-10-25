// ecomanita 0.4.2 (25/10/2026) — LA BIBLIOTHÈQUE DES CRÉAS (مكتبة الكرياتيف).
// Chaque vidéo testée garde sa FICHE (ce que l'éditeur a monté : modèle, mannequin, couleur montrée d'abord, angle, accroche,
// musique, durée) et, à chaque lecture (72 heures, puis chaque semaine), une LIGNE de résultat lue dans Tassyir par son
// numéro d'annonce (le lien caché). Le résumé par étiquette dit, par exemple, si une mannequin gagne plus souvent qu'une autre.
// Trois règles pour que l'information reste PROPRE :
//   1. une vidéo sous 15 leads « ne s'est pas mesurée » : elle ne compte ni comme gagnante ni comme perdante ;
//   2. une étiquette ne devient une RÈGLE qu'à partir de 5 vidéos mesurées ; avant, c'est une REMARQUE ;
//   3. le jugement se fait sur le coût par CONFIRMÉE (phase TEST) ou par LIVRÉE (phase VALIDE), jamais sur le pixel.
// Fonctions pures (le fichier JSONL est lu et écrit par le bureau, dans la maison du client) ; l'épreuve les teste.
// Code original « ecom manita ».
import fs from 'node:fs';
import path from 'node:path';

export const LEADS_MESURE = 15, VIDEOS_POUR_REGLE = 5;
export const ETIQUETTES = ['modele', 'mannequin', 'couleur', 'angle', 'accroche', 'musique', 'duree'];
const txt = v => String(v ?? '').trim();

/** La fiche d'une vidéo, depuis ce que l'éditeur a écrit (rapport) et la mission (modèle, mannequin). */
export function ficheVideo({ rapport = {}, modele = '', mannequin = '', couleur = '', video_id = '', ad_id = '', adset = '' } = {}) {
  const d = +rapport.duree || 0;
  return {
    modele: txt(rapport.modele || modele) || '?',
    mannequin: txt(rapport.mannequin || mannequin) || '?',
    couleur: txt(rapport.couleur || couleur) || '?',
    angle: txt(rapport.angle) || '?',
    accroche: txt(rapport.accroche) || '?',
    musique: txt(rapport.musique) || '?',
    duree: d ? (d <= 15 ? '15 s' : d <= 20 ? '20 s' : '30 s') : '?',
    video_id: txt(video_id), ad_id: txt(ad_id), adset: txt(adset),
  };
}

/** Une ligne de résultat : la fiche + ce qui a été LU (dépense Meta, leads et confirmées / livrées de Tassyir). */
export function ligneResultat(fiche, { date, phase = 'TEST', jours = 3, depense_usd = 0, leads = 0, confirmees = 0, livrees = 0, plafond_usd = null } = {}) {
  const dep = +depense_usd || 0, L = +leads || 0, C = +confirmees || 0, V = +livrees || 0;
  const base = phase === 'VALIDE' ? V : C;
  const cout = base > 0 ? dep / base : null;
  const mesuree = L >= LEADS_MESURE;
  let statut = 'pas_mesuree';
  if (mesuree) statut = plafond_usd && cout !== null ? (cout <= plafond_usd ? 'gagnante' : 'perdante') : cout === null ? 'perdante' : 'mesuree';
  return { ...fiche, date, phase, jours, depense_usd: Math.round(dep * 100) / 100, leads: L, confirmees: C, livrees: V, cout_usd: cout === null ? null : Math.round(cout * 100) / 100, statut };
}

/** Le résumé par valeur d'une étiquette (mannequin, angle, couleur…) : on ne garde que la DERNIÈRE ligne de chaque vidéo. */
export function resumeParEtiquette(lignes, etiquette) {
  if (!ETIQUETTES.includes(etiquette)) throw new Error('étiquette inconnue : ' + etiquette);
  const derniere = new Map();
  for (const l of lignes || []) { const k = l.ad_id || l.video_id || JSON.stringify([l.modele, l.angle, l.couleur]); const a = derniere.get(k); if (!a || String(l.date) >= String(a.date)) derniere.set(k, l); }
  const g = new Map();
  for (const l of derniere.values()) {
    const v = l[etiquette] || '?'; const x = g.get(v) || { valeur: v, videos: 0, mesurees: 0, gagnantes: 0, depense: 0, base: 0 };
    x.videos++; if (l.statut !== 'pas_mesuree') { x.mesurees++; x.depense += +l.depense_usd || 0; x.base += l.phase === 'VALIDE' ? +l.livrees || 0 : +l.confirmees || 0; }
    if (l.statut === 'gagnante') x.gagnantes++;
    g.set(v, x);
  }
  return [...g.values()].map(x => ({ ...x, cout_moyen_usd: x.base > 0 ? Math.round(x.depense / x.base * 100) / 100 : null, poids: x.mesurees >= VIDEOS_POUR_REGLE ? 'قاعدة' : 'ملاحظة' }))
    // les RÈGLES d'abord (5 vidéos mesurées et plus), puis le coût : une seule vidéo pas chère ne passe pas devant une règle
    .sort((a, b) => (a.poids === b.poids ? 0 : a.poids === 'قاعدة' ? -1 : 1) || (a.cout_moyen_usd ?? Infinity) - (b.cout_moyen_usd ?? Infinity));
}

/** Le fichier de la bibliothèque, une ligne JSON par résultat, dans la maison du client. */
export const fichierBibliotheque = maison => path.join(maison, 'carnet', 'bibliotheque-creas.jsonl');
export function lireBibliotheque(maison) {
  try { return fs.readFileSync(fichierBibliotheque(maison), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}
export function ajouterLignes(maison, lignes) {
  if (!lignes || !lignes.length) return 0;
  const f = fichierBibliotheque(maison); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
  return lignes.length;
}

/** Le message de la semaine (loi de forme : darija, 36 caractères, aucun chiffre dans une ligne arabe). */
export function messageBibliotheque(resume, etiquette) {
  const nomAr = { mannequin: 'المانكان', angle: 'الزاوية', couleur: 'اللون', accroche: 'الهوك', modele: 'الموديل', musique: 'الموسيقى', duree: 'المدة' }[etiquette] || etiquette;
  const L = [`مكتبة الكرياتيف : ${nomAr}`];
  for (const x of resume.slice(0, 4)) {
    // un nom arabe va sur la ligne darija (sans chiffre), un nom latin sur la ligne des chiffres
    const v = String(x.valeur), arabe = /[\u0600-\u06FF]/.test(v);
    L.push(`${x.poids === 'قاعدة' ? '🟢' : '⚪'} ${x.poids}${arabe ? ' : ' + v.replace(/[0-9\u0660-\u0669]/g, '').trim().slice(0, 18) : ''}`);
    L.push(`${arabe ? '' : v.slice(0, 12) + ' · '}${x.mesurees}/${x.videos} videos · ${x.cout_moyen_usd === null ? '-' : x.cout_moyen_usd + ' $'}`);
  }
  L.push('أقل من خمسة فيديوهات = ملاحظة برك');
  return L.join('\n');
}
