// ecom manita — L'ACCUEIL TELEGRAM : le client colle le lien Drive de son shooting dans la discussion
// de SON robot, et le robot lui pose les questions UNE PAR UNE, avec des boutons — dans l'ordre de la maison :
// lien · combien de modèles · prix de gros · prix de détail · test ou stock · compte pub · page · message ou site ·
// placements, puis ce que la page produit et le montage ne peuvent pas deviner : le nom, les tailles, le code SKU, la niche.
// Rien n'est supposé : pas de valeur par défaut, pas de chiffre ressorti d'avant. « الغي » annule.
// La conversation vit sur le disque (une coupure du PC ne la perd pas). Code original « ecom manita » — 03/10/2026.
//
// v0.3.8 — un lien, PLUSIEURS modèles (un « lot ») : la première question est toujours « شحال من موديل ؟ ».
//   N = 1 : le chemin d'avant, tel quel (une mission, pas de lot).
//   N ≥ 2 : les questions COMMUNES une fois (stock, compte, page, mode, placements, niche) → le bureau télécharge
//   et sépare (phase « analyse ») → le client confirme chaque modèle sur sa PHOTO (« صحيح » / « ماشي صحيح ») →
//   les questions de CHAQUE modèle (photo rappelée, ligne « Modele k / N ») → le résumé → « ابدا » → une mission
//   par modèle.
// v0.3.8 (08/10/2026, décisions du vendeur) — UN SEUL LIEN PASSE TOUJOURS. Le repli « un lien par modèle » n'existe
//   plus : le bureau revérifie (deux lectures croisées, tronçons disputés mis de côté) et le client lit « لقيت <nombre en
//   lettres> موديلات », une ligne pour les vidéos mises de côté, puis la photo de chaque modèle. « ماشي صحيح » RETIRE ce
//   modèle, les autres continuent ; le nombre RÉEL de modèles confirmés pilote tout (conv.n, questions, budget, lot
//   final), jamais le nombre annoncé. Seul arrêt : aucun groupe pur (aucunModele), ou aucun modèle confirmé.
//   N = 1 n'est plus cru sur parole : « ابدا » lance un lot d'UN modèle (descente, separer.py --candidats) ; un seul
//   groupe pur → la mission d'avant (créée par le bureau, sur le Drive déjà descendu) ; plusieurs → bascule en lot.
// v0.3.8 (07/10/2026) — mesuré sur un vrai lot : le vrai Claude SÉPARE bien les modèles (aucun mélange) mais NOMME
//   mal les couleurs (une sur deux fausse), et un modèle de lot part avec ces noms dans les variantes de sa page,
//   publiée directement. La photo à confirmer a donc un 3e bouton « صحيح، بصح اللونات غالطين » : le modèle est
//   confirmé ET ses couleurs sont marquées « à nommer par le client » (couleursClient) ; sa mission posera alors la
//   question d'une mission seule (la photo de chaque famille + les boutons de la palette). Sans ce bouton : comme avant.
//   Relu et cassé (07/10/2026) : « ابدا » effaçait la conversation AVANT que le serveur crée les missions — une coupure
//   du PC entre les deux perdait toutes les réponses et les marques (le lot restait « prêt », puis annulé en silence au
//   démarrage). Le lot final est maintenant écrit sur le disque (lot-final-<id>.json) avant que la conversation
//   disparaisse ; le serveur l'efface une fois les missions nées, ou le reprend au démarrage (lotsFinalsEnAttente).
// Relu de bout en bout (07/10/2026) : un budget trop court au « ابدا » d'un lot renvoie le résumé AVEC « ابدا » ; N = 1, un
//   texte tapé après le résumé le renvoie avec ses boutons ; un 2e « ابدا » N = 1 lit « هاذ الزر تاع موديل بدا » (le
//   serveur, dejaLanceUn), jamais « ابعث لينك جديد ».
// Relu (07/10/2026) : un VIEUX bouton d'une conversation d'avant pendant qu'une autre est ouverte (un « الغي » resté sous
//   une question tapée, un bouton d'avant « عاود من الأول ») répondait « ابعث لينك جديد », puis le lien renvoyé tombait sur
//   « راك في وسط موديل آخر ». Il reçoit maintenant « هاذ الزر تاع سؤال فات » et la question EN COURS avec ses boutons
//   (questionEnCours) ; « ابعث لينك جديد » ne reste que quand aucune conversation n'est ouverte.
// v0.3.8 (08/10/2026, décision du vendeur) — LE NOMBRE DE CRÉAS DU TEST : au plus QUATRE vidéos (donc ad sets) par
//   modèle, et le choix est TOUJOURS proposé. Une seule question PAR LIEN, dans les questions communes (N = 1 compris),
//   juste après les placements : « شحال من كريا للتيست ؟ », boutons واحد / زوج / ثلاثة / أربعة, celui du réglage
//   (creasParModele, الإعدادات, 1 à 4, défaut quatre) marqué « (العادة) ». La réponse vaut pour TOUS les modèles du
//   lien. Sans réponse valable (conversation d'avant, valeur abîmée) : le réglage, figé au moment où le résumé part
//   (ce que le client a vu est ce qui part). Le résumé le dit une fois (le nombre dans une ligne latine).
//   Relu et cassé : un vieux bouton, un double clic, « ابدا » hors du résumé ou un texte tapé sur une question à
//   boutons reçoivent aussi la question EN COURS avec ses boutons (une conversation d'avant arrêtée sur le nom ou la
//   niche voit arriver la question des créas, qu'elle n'avait jamais reçue) ; creasValide est stricte (true, [3],
//   « 0x2 », « 1e0 », « 2 » avec une espace ne sont pas des nombres de créas).
// v0.3.8 (23/10/2026, question de la chaîne du vendeur) — « السعر و التايات كيف كيف في كل الموديلات ؟ » : dans un lot de DEUX
//   modèles ou plus, posée UNE fois, au 1er modèle, juste avant son prix de gros (après son nom). « واه، كيف كيف » : le gros, la
//   vente, les tailles et le code (sku) ne sont demandés qu'au 1er modèle, puis COPIÉS dans les réponses de chaque autre modèle
//   au moment où on passe à lui (écrit sur le disque : le résumé et le lot final les portent, une coupure ne perd rien). « لا،
//   كل موديل وحدو » ou un prix tapé à la place d'un bouton (pris comme le gros de CE modèle) : rien ne change. N = 1 (et un lot
//   resté à un seul modèle confirmé) : jamais posée. Une conversation d'avant dont le 1er modèle a déjà son prix : jamais posée.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fautesDeForme } from './telegram.mjs';
// v0.3.8 (09/10/2026, recette du vendeur, prouvée sur sa chaîne) — LE TYPE PUIS SIX NOMS, à la place de la question du nom
//   à froid : la PREMIÈRE question d'un modèle de lot est son TYPE (six boutons : حجاب, عباية, طقم, روبة, جينز, آخر → Hijab,
//   Abaya, Ensemble, Robe, Jeans, Model ; un mot tapé est pris comme type : le premier, douze lettres latines au plus,
//   capitalisé) et la photo de rappel du modèle voyage avec elle ; puis SIX noms en boutons sur deux colonnes (quatre
//   « Type Prénom » du vivier, deux « Type style »), tirés de façon DÉTERMINISTE (graine : le lot ou la conversation, le
//   rang, le type), latins, sans chiffre, 30 caractères au plus, jamais un nom déjà pris dans la fiche ; un septième bouton
//   « نكتبو أنا » rend la question du nom en texte libre (les règles d'avant) ; « سمّيه انت » reste (Claude titre depuis
//   les photos à l'étape textes : jamais une proposition retenue sans choix). Un bouton vaut le nom ; un texte tapé à la
//   place d'un bouton est le nom. N = 1 : le type juste avant le nom. Le nom du dossier Drive n'est jamais proposé.
// v0.3.8 (10/10/2026, demande du vendeur, recette prouvée sur sa chaîne) — LES NOMS AU CHOIX, en AJOUT : la première question
//   d'un modèle (avec sa photo de rappel) est un CHOIX à deux boutons : « نكتبو أنا » → la question du nom en texte libre,
//   exactement comme avant (« سمّيه انت » y reste) ; « اقترحلي أسماء » → le TYPE (les six boutons, un mot tapé) → QUATRE noms
//   (NOMS_PROPOSES, son chiffre : trois « Type Prénom » puis un « Type style », même tirage déterministe) + « نكتبو أنا » en
//   cinquième bouton (« سمّيه انت » reste sur sa ligne dessous). Le nom que la chaîne a déjà trouvé pour ce modèle (le nom du
//   plan) passe en PREMIER s'il respecte les règles (lettres latines, accents enlevés, zéro chiffre, 30 caractères au plus,
//   jamais un nom pris dans la fiche, jamais le dossier du Drive) ; « Modele 2 » (le nom par défaut) ne l'est jamais. Un texte
//   tapé sur le choix est le nom (le libellé d'un bouton tapé est ce bouton ; un type seul tapé, « Robe » / « عباية », ouvre
//   les noms de ce type). Une conversation d'avant déjà passée par le type ne reçoit jamais le choix.

export const LIEN_DRIVE = /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})(?:[/?][^\s#]*)?$/;
/** Le DOSSIER d'un lien Drive (son id), ou '' : deux écritures du même dossier sont le même lien (10/10/2026). */
export const dossierDrive = lien => (LIEN_DRIVE.exec(String(lien || '').trim()) || [])[1] || '';
export const MOTS_ANNULE = ['الغي', 'ألغي', 'annule', 'annuler', 'stop', 'حبس'];
export const MAX_MODELES = 10;

/** Les créas du test (08/10/2026) : de UN à QUATRE par modèle, le réglage par défaut quatre. */
export const CREAS_MAXI = 4;
export const CREAS_DEFAUT = 4;
export const CREAS_CHOIX = [1, 2, 3, 4];
export const CREAS_LETTRES = { 1: 'واحد', 2: 'زوج', 3: 'ثلاثة', 4: 'أربعة' };
/** Un nombre de créas valable : l'entier 1 à 4, ou ce chiffre écrit seul (« 3 ») ; tout le reste → null (strict :
 *  Number(true) = 1, Number([3]) = 3, Number(' 2') = 2, Number('0x2') = 2 ne passent pas). */
export function creasValide(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 1 && v <= CREAS_MAXI ? v : null;
  if (typeof v === 'string' && /^[1-4]$/.test(v)) return +v;
  return null;
}
/** Le nombre de créas d'un test : la réponse du client si elle est valable, sinon le réglage, sinon quatre. */
export const creasDe = (reponse, reglage) => creasValide(reponse) ?? creasValide(reglage) ?? CREAS_DEFAUT;
/** La ligne latine du résumé (« 1 crea », « 3 creas »). */
export const creasLatin = k => (k === 1 ? '1 crea' : `${k} creas`);
/** 29/10/2026 (règle du vendeur) — LA VOIE DU LIEN, une fois par lien, juste avant les créas : « شوتينغ جديد » = la chaîne
 *  d'avant, TELLE QUELLE (montage, créas au choix) ; « تيست » = les vidéos DÉJÀ faites du dossier, QUATRE créas par modèle
 *  (QUATRE-CREAS.py : quatre vidéos ou plus → les quatre premières telles quelles ; moins → chaque originale + des copies où
 *  SEULE la musique change), puis la STRUCTURE au choix du client : ABO comme avant (un ad set par vidéo, la règle 7 / 5 $)
 *  ou CBO (une campagne, UN ad set, les quatre annonces dedans, CBO_TESTER_USD par modèle sur la campagne). Les textes des
 *  annonces ne changent pas. Le bouton « تيست » dit que les vidéos sont au client ou qu'il a l'accord de leur propriétaire.
 *  Une conversation d'avant sans voie : la chaîne d'avant. */
export const VOIES = [{ v: 'shooting', t: '📸 شوتينغ جديد' }, { v: 'tester', t: '🧪 تيست بالفيديوهات' }];
export const CBO_TESTER_USD = 20;
export const CREAS_TESTER = 4;
export const STRUCTURES_TESTER = [{ v: 'ABO', t: 'ABO' }, { v: 'CBO', t: 'CBO' }];
/** La voie « tester » (le reste, absent compris, est la chaîne d'avant). */
export const estTester = r => !!r && r.voie === 'tester';

export const TAILLES = [
  { v: 'lettres-courte', t: 'S → XL' }, { v: 'lettres-complete', t: 'S → 3XL' },
  { v: 'chiffres-44', t: '36 → 44' }, { v: 'chiffres-46', t: '36 → 46' }, { v: 'chiffres-48', t: '36 → 48' },
  { v: 'chiffres-52', t: '36 → 52' }, { v: 'chiffres-58', t: '36 → 58' }, { v: 'chiffres-46-58', t: '46 → 58' },
  { v: 'bandes-2', t: 'Taille 1-2' }, { v: 'bandes-3', t: 'Taille 1-3' }, { v: 'bandes-4', t: 'Taille 1-4' },
  { v: 'sans', t: 'بلا تايات' }
];
export const NICHES = [
  { v: 'hijab', t: 'حجاب' }, { v: 'mariage', t: 'عرس' }, { v: 'soiree', t: 'سهرة' }, { v: 'sortie', t: 'خرجة' },
  { v: 'maison', t: 'دار' }, { v: 'etudiante', t: 'طالبة' }, { v: 'travail', t: 'خدمة' }
];

/** LES TYPES (09/10/2026, recette du vendeur) : le bouton arabe, le mot latin qui ouvre les noms. */
export const TYPES = [{ v: 'Hijab', t: 'حجاب' }, { v: 'Abaya', t: 'عباية' }, { v: 'Ensemble', t: 'طقم' }, { v: 'Robe', t: 'روبة' }, { v: 'Jeans', t: 'جينز' }, { v: 'Model', t: 'آخر' }];
/** Un type TAPÉ : le libellé d'un bouton (« عباية ») ou le premier mot, douze lettres latines au plus, capitalisé ; sinon null. */
/** Un texte tapé, lavé pour être comparé à un bouton (10/10/2026, passe « casser ») : sans voyelles arabes ni chadda, أ/إ/آ → ا,
 *  sans accents latins (« Pantalón » → « Pantalon »), espaces resserrés. */
export const laverTape = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
export function typeTape(texte) {
  const t = laverTape(texte); if (!t) return null;
  const b = TYPES.find(x => laverTape(x.t) === t || x.v.toLowerCase() === t.toLowerCase()); if (b) return b.v;
  // le PREMIER mot (10/10/2026) : débarrassé de ce qui l'entoure (emoji, ponctuation : « 👗 robe », « Hijab! ») et coupé au
  // tiret (« Robe-longue » → Robe) ; un mot qui porte un chiffre, un mot arabe hors boutons, plus de douze lettres : refusé
  const mot = (t.replace(/^[^\p{L}\p{N}]+/u, '').split(/\s+/)[0] || '').replace(/[^\p{L}\p{N}]+$/u, '').split(/[-'’_]/)[0];
  const ar = TYPES.find(x => laverTape(x.t) === mot); if (ar) return ar.v;
  return /^[A-Za-z]{2,12}$/.test(mot) ? mot[0].toUpperCase() + mot.slice(1).toLowerCase() : null;
}
/** Le vivier des prénoms et des styles (recette du vendeur). */
export const PRENOMS = ['Lara', 'Maya', 'Nour', 'Lina', 'Sara', 'Yara', 'Mila', 'Dina', 'Rania', 'Amira', 'Selma', 'Lydia', 'Ines', 'Celia', 'Nelia', 'Rym', 'Kenza', 'Meriem', 'Sirine', 'Aya', 'Malak', 'Jana', 'Lamia', 'Hana', 'Rita', 'Tina', 'Zina', 'Wissal', 'Safa', 'Asma'];
export const STYLES = ['classic', 'chic', 'royal', 'luxe', 'elegance', 'prestige', 'soft', 'glam'];
export const NOM_MAXI = 30; // le titre ET l'adresse de la page Tassyir
const cleNomP = s => String(s || '').toUpperCase().replace(/[^A-Z0-9؀-ۿ]+/g, '');
/** LES SIX NOMS (09/10/2026, recette du vendeur) : quatre « Type Prénom » puis deux « Type style », tirés de façon
 *  DÉTERMINISTE (graine : l'id du lot ou de la conversation, le rang du modèle, le type) — la même question rend toujours
 *  les mêmes boutons, un vieux bouton reste lisible. Latins, sans chiffre, 30 caractères au plus, jamais un nom de « pris »
 *  (les noms déjà donnés dans la fiche), jamais deux fois le même. */
export function nomsProposes({ graine, rang, type, pris = [], premier = '', dossier = '' }) {
  const ty = typeTape(type) || 'Model';
  const deja = new Set((pris || []).map(cleNomP));
  // 10/10/2026 : le nom de la chaîne d'abord (s'il est valable), puis le tirage ; NOMS_PROPOSES en tout
  const chaine = nomDeLaChaine(premier, { pris, dossier }); if (chaine) deja.add(cleNomP(chaine));
  let flux = Buffer.alloc(0), k = 0;
  const hasard = n => { if (flux.length < 4) { flux = Buffer.concat([flux, crypto.createHash('sha256').update(`${graine}:${rang}:${ty}:${k++}`).digest()]); } const v = flux.readUInt32BE(0); flux = flux.subarray(4); return v % n; };
  const tirer = (vivier, combien) => {
    const reste = vivier.map(x => `${ty} ${x}`).filter(n => n.length <= NOM_MAXI && /^[A-Za-z ]+$/.test(n) && !deja.has(cleNomP(n)));
    const out = [];
    while (out.length < combien && reste.length) { const n = reste.splice(hasard(reste.length), 1)[0]; out.push(n); deja.add(cleNomP(n)); }
    return out;
  };
  const prenoms = tirer(PRENOMS, NOMS_PROPOSES - NOMS_STYLES - (chaine ? 1 : 0)), styles = tirer(STYLES, NOMS_STYLES);
  return [...(chaine ? [chaine] : []), ...prenoms, ...styles];
}
/** Le bouton « نكتبو أنا » : la question du nom repasse en texte libre. */
export const BOUTON_ECRIRE = 'نكتبو أنا';
/** Le bouton « اقترحلي أسماء » (10/10/2026) : le type, puis les noms proposés. */
export const BOUTON_PROPOSER = 'اقترحلي أسماء';
/** COMBIEN de noms proposés (10/10/2026, le chiffre du vendeur) et combien d'entre eux en « Type style » (le dernier). */
export const NOMS_PROPOSES = 4;
export const NOMS_STYLES = 1;
/** Le nom que la chaîne a trouvé (le plan) rendu proposable, ou '' : accents enlevés, espaces resserrés, lettres latines
 *  seules, zéro chiffre, 2 à 30 caractères, jamais « auto », jamais un nom de « pris », jamais le dossier du Drive. */
export function nomDeLaChaine(nom, { pris = [], dossier = '' } = {}) {
  const n = String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > NOM_MAXI || !/^[A-Za-z ]+$/.test(n) || n.toLowerCase() === 'auto') return '';
  const c = cleNomP(n), d = cleNomP(dossier);
  if ((pris || []).some(x => cleNomP(x) === c)) return '';
  if (d && (c === d || c.includes(d))) return '';
  return n;
}

/** La PREMIÈRE question, toujours : combien de modèles dans ce dossier (boutons, ou le chiffre tapé). */
export const QUESTION_N = { cle: 'n', type: 'choix', tape: true, colonnes: 5,
  texte: ['وصلني اللينك، مليح', 'سؤال : شحال من موديل ؟', 'في الفيديوات لي في الدوسي', 'اختار من الأزرار'],
  choix: Array.from({ length: MAX_MODELES }, (_, i) => ({ v: String(i + 1), t: String(i + 1) })) };

/** Le prix de vente que la page accepte : les MÊMES bornes que PRIX_MINI / PRIX_MAXI de outils/2-PAGE-PRODUIT-SKU/manita-produit.py
 *  (avant, le robot acceptait 100 à 1 000 000 DA et la page refusait le prix APRÈS la descente et le montage). */
export const PRIX_VENTE = { mini: 1500, maxi: 59000 };
/** Les questions d'UN modèle, dans l'ordre. Chaque texte respecte la loi de forme (darija, ≤ 36 caractères, aucun chiffre en arabe). */
export const QUESTIONS = [
  { cle: 'gros', type: 'nombre', min: 50, max: 500000,
    texte: ['سؤال : سعر الجملة', 'بقداش تجيك الحبّة ؟', 'اكتب السعر بالدينار برك'] },
  { cle: 'detail', type: 'nombre', min: 100, max: 1000000,
    texte: ['سؤال : سعر البيع', 'بقداش راك تبيعها للزبونة ؟', 'اكتب السعر بالدينار برك'],
    valider: (v, r) => (v < PRIX_VENTE.mini || v > PRIX_VENTE.maxi ? ['سعر البيع هاذا ما يتقبلش', 'في الصفحة تاع تسيير', 'لازم يكون بين ألف و خمسمية', 'و تسعة و خمسين ألف دينار', 'عاود اكتبو من فضلك']
      : v > r.gros ? null : ['سعر البيع لازم يفوت', 'سعر الجملة', 'عاود اكتبو من فضلك']) },
  { cle: 'stock', type: 'choix', texte: ['سؤال : السلعة', 'راك تدير تيست برك،', 'ولا السلعة راهي عندك ؟'],
    choix: [{ v: 'test', t: 'تيست برك' }, { v: 'stock', t: 'السلعة عندي' }] },
  { cle: 'compte', type: 'liste', source: 'comptes', texte: ['سؤال : الكونت تاع البوبليسيتي', 'واش من كونت نخدمو بيه ؟', 'اختار من الأزرار'] },
  { cle: 'page', type: 'liste', source: 'pages', texte: ['سؤال : الصفحة', 'واش من صفحة تبان في البوب ؟', 'اختار من الأزرار'] },
  { cle: 'mode', type: 'choix', texte: ['سؤال : كيفاش تجيك الكوموند', 'بالميساج ولا من الموقع ؟', 'اختار واحد'],
    choix: [{ v: 'message', t: 'ميساج' }, { v: 'site', t: 'الموقع' }] },
  // [v19-trois] 15/10/2026 — LE PIXEL PAR COMPTE (fonction éprouvée sur la chaîne du vendeur) : en mode « site », SEULEMENT quand les
  // pixels du compte CHOISI ont été lus chez Meta (« جيب الكونتات » : comptes[].pixels) ; les boutons = les pixels de CE compte
  // (huit au plus, du dernier tir au plus ancien), un nom tapé n'est pris que s'il est EXACTEMENT celui d'un pixel du compte
  // (sans la casse ni les espaces) ; sinon REFUS et la question revient — jamais un autre pixel à sa place. Pixels jamais lus
  // (installation d'avant) : pas de question, l'ancienne loi de la campagne (« le pixel du compte »), comme chez le vendeur.
  { cle: 'pixel', type: 'pixel', colonnes: 2, texte: ['سؤال : البيكسل', 'واش من بيكسل للموقع ؟', 'هاذو البيكسلات تاع الكونت لي ختارت', 'اختار ولا اكتب الاسم بالضبط'],
    texteVide: ['سؤال : البيكسل', 'الكونت لي ختارت ما فيه حتى بيكسل', 'بدّل للميساج ولا اكتب : الغي'] },
  { cle: 'placements', type: 'choix', texte: ['سؤال : وين تبان البوب', 'ستوري و ريلز برك،', 'ولا برود في كل بلاصة ؟'],
    choix: [{ v: 'story_reels', t: 'ستوري و ريلز' }, { v: 'broad', t: 'برود' }] },
  // 29/10/2026 : LA VOIE (une fois par lien) ; une conversation d'avant déjà passée plus loin (créas, nom, type ou niche répondus)
  // ne la reçoit jamais : elle continue sur la chaîne d'avant, telle quelle
  { cle: 'voie', type: 'choix', colonnes: 1, si: r => [r.creas, r.choixnom, r.type, r.nom, r.niche].every(x => x === undefined),
    texte: ['سؤال : واش من طريقة ؟', 'شوتينغ جديد : المونتاج كيما العادة', 'تيست : الفيديوهات لي في الدوسي', 'أربعة كريات لكل موديل', 'فيديو وحدة : نزيدو ثلاثة', 'نفس التصويرة، الموسيقى برك تتبدّل', 'غير الفيديوهات تاعك', 'ولا لي مولاها عطاك الإذن'],
    choix: VOIES },
  // 29/10/2026 : LA STRUCTURE du test, seulement sur la voie « tester » (la ligne du budget en dollars ET en dinars est ajoutée à l'envoi)
  { cle: 'structure', type: 'choix', colonnes: 2, si: r => estTester(r),
    texte: ['سؤال : الكامباني تاع التيست', 'ABO : كل فيديو في أد ست وحدو', 'كيما العادة، والو ما يتبدّل', 'CBO : أد ست واحد فيه الكريات', 'البودجي على الكامباني لكل موديل :'],
    fin: ['اختار واحد'], choix: STRUCTURES_TESTER },
  // UNE fois par lien (08/10/2026) ; les libellés sont refaits à chaque envoi (le réglage marqué « (العادة) »). Une conversation
  // N = 1 d'avant déjà au résumé (la niche, dernière question, est répondue) ne la reçoit pas : le réglage, figé au résumé.
  // 29/10/2026 : jamais sur la voie « tester » (quatre créas, la règle du vendeur)
  { cle: 'creas', type: 'choix', colonnes: 2, si: r => !estTester(r) && !(r.niche !== undefined && r.creas === undefined),
    texte: ['سؤال : الكريات تاع التيست', 'شحال من كريا للتيست ؟', 'من واحد حتى أربعة لكل موديل', 'نفس العدد لكل الموديلات'],
    choix: CREAS_CHOIX.map(k => ({ v: String(k), t: CREAS_LETTRES[k] })) },
  // LE CHOIX (10/10/2026) : « نكتبو أنا » (texte libre) ou « اقترحلي أسماء » (le type puis les noms) ; seulement tant que ni le
  // type ni le nom ne sont donnés (une conversation d'avant déjà passée par le type ne le reçoit jamais) ; un texte tapé = le nom
  { cle: 'choixnom', type: 'choix', tape: 'choixnom', colonnes: 2, si: r => r.nom === undefined && r.type === undefined,
    texte: ['سؤال : اسم الموديل', 'تكتب الاسم أنت ولا نقترحولك ؟', 'اختار من الأزرار ولا اكتب الاسم'],
    choix: [{ v: 'ecrire', t: BOUTON_ECRIRE }, { v: 'proposer', t: BOUTON_PROPOSER }] },
  // LE TYPE (09/10/2026) : demandé seulement tant que le nom n'est pas donné (une conversation d'avant arrêtée APRÈS son nom
  // ne le reçoit jamais) ; les six boutons, ou un mot tapé (typeTape) ; jamais après « نكتبو أنا » (10/10/2026)
  { cle: 'type', type: 'choix', tape: 'type', colonnes: 3, si: r => r.nom === undefined && r.choixnom !== 'ecrire',
    texte: ['سؤال : نوع الموديل', 'واش من نوع هاذ الموديل ؟', 'اختار من الأزرار ولا اكتبو'], choix: TYPES },
  // LES SIX NOMS (09/10/2026) : les boutons sont tirés au moment de la question (nomsProposes) ; « نكتبو أنا » rend la
  // question du nom en texte libre (texteLibre) ; « سمّيه انت » (auto) reste
  { cle: 'nom', type: 'texte', min: 2, max: 40, texte: ['سؤال : اسم الموديل', 'اختار اسم من الأزرار', 'ولا اكتب الاسم لي تحب'],
    texteLibre: ['سؤال : اسم الموديل', 'واش نسمّيوه ؟ اكتب الاسم', 'ولا خليني نسمّيه أنا'],
    choix: [{ v: 'auto', t: 'سمّيه انت' }] },
  { cle: 'tailles', type: 'choix', colonnes: 3, texte: ['سؤال : التايات', 'كيفاش راهم التايات تاعك ؟', 'اختار من الأزرار'], choix: TAILLES },
  { cle: 'sku', type: 'choix', si: r => r.tailles !== 'sans', texte: ['سؤال : الكود تاع السلعة', 'كود لكل تاي وحدها،', 'ولا كود واحد لزوج تايات ؟'],
    choix: [{ v: 'par-taille', t: 'كود لكل تاي' }, { v: 'groupe2', t: 'كود لزوج تايات' }] },
  { cle: 'niche', type: 'choix', colonnes: 3, texte: ['سؤال الأخير : النيش', 'الكتابة لي تبان على الفيديو', 'لمين راهي موجّهة ؟'], choix: NICHES }
];
/** Le 3e bouton de la photo à confirmer : le modèle est juste, ses couleurs non (darija, ≤ 36 caractères, aucun chiffre). */
export const BOUTON_COULEURS_FAUSSES = 'صحيح، بصح اللونات غالطين';
/** Un lot : ce qui est posé UNE fois pour tous les modèles, puis ce qui est posé pour CHAQUE modèle. */
export const COMMUNES = ['stock', 'compte', 'page', 'mode', 'pixel', 'placements', 'voie', 'structure', 'creas', 'niche'];
/** [v19-trois] Les boutons du pixel : huit au plus (la borne du robot du vendeur) ; le bouton du compte sans pixel. */
export const PIXELS_MAXI_BOUTONS = 8;
export const BOUTON_PIXEL_MESSAGE = 'بدّل للميساج';
/** [v19-trois] Deux noms de pixel égaux sans la casse ni les espaces (la même règle que la campagne). */
export const memeNomPixel = (a, b) => { const n = x => String(x ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); return n(a) !== '' && n(a) === n(b); };
/** [v0.3.9-meta] Les statuts Meta d'un compte qui ne peut pas lancer de publicité (nom ou numéro d'account_status). */
export const STATUT_BLOQUANT = /^(2|3|7|8|9|100|101|DISABLED|UNSETTLED|PENDING_RISK_REVIEW|PENDING_SETTLEMENT|IN_GRACE_PERIOD|PENDING_CLOSURE|CLOSED|ANY_CLOSED)$/i;
export const PAR_MODELE = ['choixnom', 'type', 'nom', 'gros', 'detail', 'tailles', 'sku'];
/** [meme-prix] 23/10/2026 — la question du lot (N ≥ 2), une fois, au 1er modèle avant son gros ; la réponse est gardée dans
 *  conv.reponses.memeprix (jamais dans le lot final). Ce qui est repris du 1er modèle quand c'est « واه ». */
export const QUESTION_MEME_PRIX = { cle: 'memeprix', type: 'choix', colonnes: 1,
  texte: ['سؤال : السعر و التايات', 'كيف كيف في كل الموديلات ؟', 'سعر الجملة، البيع، التايات و الكود', 'إذا واه، نسقسيك مرة وحدة برك'],
  choix: [{ v: 'oui', t: 'واه، كيف كيف' }, { v: 'non', t: 'لا، كل موديل وحدو' }] };
export const MEME_PRIX_REPRIS = ['gros', 'detail', 'tailles', 'sku'];
const NICHE_LOT = ['سؤال : النيش، لكل الموديلات', 'الكتابة لي تبان على الفيديو', 'لمين راهي موجّهة ؟'];
/** Les boutons de la question des créas : le réglage du client marqué « (العادة) » (darija, aucun chiffre, ≤ 36). */
export const choixCreas = reglage => { const h = creasDe(undefined, reglage); return CREAS_CHOIX.map(k => ({ v: String(k), t: CREAS_LETTRES[k] + (k === h ? ' (العادة)' : '') })); };
/** La ligne ajoutée sous la question : « العادة تاعك : ثلاثة ». */
export const ligneHabitude = reglage => `العادة تاعك : ${CREAS_LETTRES[creasDe(undefined, reglage)]}`;
/** Les deux lignes du résumé : une ligne darija, puis le nombre dans une ligne latine. */
export const lignesCreas = k => ['الكريات تاع التيست لكل موديل :', creasLatin(k)];

/** Un nombre à la française : espace insécable entre les milliers (« 2 300 »), jamais cassé sur deux lignes. */
export const nombre = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Un nom libre qui contient le MOT « DA » ou « دج » (une page « Mode DA », un modèle « Robe DA ») passerait pour un
 *  montant sans dollars : la loi de forme refuserait tout le message (résumé, en-tête) et le client resterait sans réponse. */
export const sansMontant = s => String(s || '').replace(/\bDA\b/g, 'Da').replace(/(^|[\s\d ])دج(?=$|[\s.,:;!?؟])/g, '$1د.ج');
/** Une ligne libre (nom de compte, de page, de modèle) rendue sûre pour la loi de forme : ≤ 36 caractères,
 *  et une ligne qui a de l'arabe perd ses chiffres (sinon elle s'afficherait à l'envers chez le client). */
export const ligneSure = s => { let t = sansMontant(String(s || '').replace(/\s+/g, ' ').trim()); if (/[؀-ۿ]/.test(t)) t = t.replace(/\d+/g, '').replace(/\s+/g, ' ').trim(); return t.slice(0, 36) || '?'; };
/** Une raison technique en lignes latines de 36 caractères, coupées entre les mots, trois au plus (sans arabe). */
const coupeLatin = t => {
  const mots = (sansMontant(String(t || '').replace(/[؀-ۿ]/g, '')).replace(/\s+/g, ' ').trim() || 'inconnue').split(' ');
  const out = []; let l = '';
  for (const m of mots.flatMap(x => x.match(/.{1,36}/g) || [])) { if (l && (l + ' ' + m).length > 36) { out.push(l); l = m; } else l = l ? l + ' ' + m : m; }
  if (l) out.push(l);
  return out.slice(0, 3);
};
/** Des noms latins (couleurs) en lignes de 36 caractères au plus, sans chiffres. */
const lignesNoms = noms => { const out = []; let l = ''; for (const m of (noms || []).map(x => sansMontant(String(x).replace(/[؀-ۿ\d]/g, '')).trim()).filter(Boolean)) { const t = l ? `${l} · ${m}` : m; if (t.length > 36 && l) { out.push(l); l = m.slice(0, 36); } else l = t.slice(0, 36); } if (l) out.push(l); return out; };
/** Deux noms de modèle « pareils » (casse, espaces, tirets) donneraient le même code et la même page. */
const cleNom = s => String(s || '').toUpperCase().replace(/[^A-Z0-9؀-ۿ]+/g, '');

/** Un nombre de modèles EN LETTRES darija (08/10/2026) : une ligne arabe ne porte jamais de chiffre. Au-delà de vingt,
 *  « بزاف » (le compte part dans une ligne latine à part). */
// 09/10/2026 : « ثلاثة » et « أربعة » comme partout ailleurs dans le produit (boutons des créas, réglages) : le client lit
// « لقيت أربعة موديلات » (la phrase du vendeur), jamais deux écritures du même nombre dans la même conversation
const LETTRES_3_10 = ['ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'تمنية', 'تسعة', 'عشرة'];
const LETTRES_11_20 = ['حداش', 'طناش', 'تلطاش', 'ربعطاش', 'خمسطاش', 'سطاش', 'سبعطاش', 'تمنطاش', 'تسعطاش', 'عشرين'];
export function modelesEnLettres(k) {
  k = Math.round(+k || 0);
  if (k === 1) return 'موديل واحد';
  if (k === 2) return 'زوج موديلات';
  if (k >= 3 && k <= 10) return `${LETTRES_3_10[k - 3]} موديلات`;
  if (k >= 11 && k <= 20) return `${LETTRES_11_20[k - 11]} موديل`;
  return 'بزاف تاع الموديلات';
}
/** Le nom d'une vidéo sur une ligne LATINE (sans lettre arabe : une ligne arabe n'a jamais de chiffre), 36 caractères au plus. */
export const nomVideoLatin = r => { const t = String(r || '').split(/[\\/]/).pop().replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').replace(/\s+/g, ' ').trim(); return (/[A-Za-z0-9]/.test(t.replace(/\.[A-Za-z0-9]{2,4}$/, '')) ? t : 'video').slice(0, 36); };
/** Les vidéos écartées parce qu'elles alternent deux vêtements : deux noms au plus, puis « +k videos » (loi de forme : un
 *  paquet latin a toujours une ligne darija dans ses trois lignes du dessus). */
function lignesAlternees(alternees) {
  const v = [...new Set((alternees || []).map(String))]; if (!v.length) return [];
  return [v.length === 1 ? 'حيّدت فيديو فيها زوج لبسات' : 'حيّدت فيديوات فيهم زوج لبسات', 'يتبدلو بالزربة، ما نخلطهمش :',
    ...v.slice(0, 2).map(nomVideoLatin), ...(v.length > 2 ? [`+${v.length - 2} videos`] : [])];
}
/** Les textes de l'accueil (contrôlés par l'épreuve contre la loi de forme). */
export const TEXTES = {
  annule: ['تمام، حبسنا', 'ما بدينا والو', 'ابعث لينك جديد وقت ما تحب'],
  pasDrive: ['هاذ اللينك ماشي دوسي درايف', 'لازم يكون لينك تاع دوسي', 'وفي البارتاج : كل واحد عندو اللينك', 'عاود ابعثو من فضلك'],
  enCours: ['راك في وسط موديل آخر', 'كمّل الأسئلة لي قبل،', 'ولا اكتب : الغي'],
  /** « الغي » sous « راك في وسط موديل آخر » avec un lien neuf EN ATTENTE (09/10/2026) : la fiche ouverte est annulée et le
   *  lien neuf commence tout de suite (sa première question suit ce message). */
  annuleEtLien: ['تمام، حبسنا الموديل لي قبل', 'دروك نبداو اللينك الجديد', 'جاوب على السؤال لي تحت'],
  /** La fiche ouverte s'est FINIE sans le client (le lot seul, vide, en échec, fermé au redémarrage) alors qu'un lien neuf
   *  attendait (10/10/2026, « casse ») : ce lien commence tout de suite, jamais perdu en silence. */
  lienQuiAttendait: ['دروك نبداو اللينك الجديد', 'لي بعثتو وانت تستنى', 'جاوب على السؤال لي تحت'],
  enAnalyse: ['راني نفرز اللينك لي فات', 'استنى حتى نكمل،', 'ولا اكتب : الغي'],
  /** [relecture] 10/10/2026 (décision 21:20) : un lien NEUF envoyé pendant la séparation est GARDÉ, et c'est dit tout de suite ;
   *  son bouton « الغي اللينك » n'annule QUE ce lien (la séparation en cours continue). */
  lienGarde: ['راني نفرز اللينك لي فات', 'خبّيت اللينك الجديد،', 'يبدا كي نكملو هاذ الفرز', 'ولا اضغط : الغي اللينك'],
  lienGardeAnnule: ['تمام، نحّيت اللينك الجديد', 'الفرز لي فات راهو يكمل', 'نبعثلك التصاور كي نكملو'],
  /** Une commande Telegram (« /start »…) tapée au milieu d'une fiche n'est jamais une réponse (un nom « /start »). */
  commandeEnFiche: ['راك في وسط موديل', 'جاوب على السؤال لي تحت', 'ولا اكتب : الغي'],
  analyse: ['استنى شوية، راني نفرز', 'الموديلات في الفيديوات', 'نبعثلك التصاور كي نكملو', 'ولا اكتب : الغي'],
  // [relecture] 10/10/2026 : l'exemple en chiffres, sur sa ligne latine (l'exemple en lettres ne se lisait pas : la question revenait en boucle)
  prixIncompris: ['ما فهمتش السعر', 'اكتب الرقم برك، بلا حروف', 'كيما هاذا المثال :', '2300', 'وابعثو هنا'],
  nombreIncompris: ['ما فهمتش عدد الموديلات', 'اختار من الأزرار', 'ولا اكتب : الغي'],
  nomFaux: ['الاسم لازم يكون قصير', 'بلا رموز غريبة', 'عاود اكتبو'],
  nomPris: ['هاذ الاسم عطيتو لموديل آخر', 'كل موديل لازم اسم وحدو', 'عاود اكتب اسم آخر'],
  /** Un type tapé illisible (des chiffres, un mot trop long, une phrase arabe hors boutons) : la question revient. */
  typeFaux: ['ما فهمتش نوع الموديل', 'اختار من الأزرار', 'ولا اكتب كلمة وحدة بالفرنسية'],
  boutons: ['جاوب بالأزرار من فضلك', 'الأزرار راهم تحت السؤال', 'ولا اكتب : الغي'],
  questionFatet: ['هاذ السؤال فات', 'ابعث لينك جديد', 'باش نبداو من الأول'],
  /** N = 1, « ابدا » : le bureau compte d'abord les modèles dans les vidéos (08/10/2026 : N = 1 n'est plus cru sur parole). */
  analyseUn: ['تمام، نجيبو الفيديوات', 'ونشوفو بلي فيهم موديل واحد', 'نعلمك كي نكملو', 'ولا اكتب : الغي'],
  /** « ماشي صحيح » sur la photo d'un modèle : il est retiré, les autres continuent (08/10/2026). */
  retire: ['تمام، نحيّدو هاذ الموديل', 'ما يدخلش في الخدمة', 'نكملو بالموديلات لوخرين'],
  /** Le client n'a confirmé aucun modèle : rien ne démarre. */
  aucunConfirme: ['ما أكدت حتى موديل', 'ما بدينا والو', 'ابعث لينك جديد وقت ما تحب'],
  /** LE SEUL ARRÊT (08/10/2026) : aucun groupe pur dans les vidéos — on le dit et on attend le client. */
  aucunModele: ['ما لقيتش حتى موديل واضح', 'في الفيديوات تاع الدوسي', 'شوف الفيديوات و صوّر من جديد', 'ومن بعد ابعثلي اللينك'],
  /** Le nombre RÉEL trouvé (en lettres darija : aucun chiffre dans une ligne arabe) et les vidéos mises de côté. */
  trouve: (k, misDeCote = 0, retires = 0, alternees = [], lectureSeule = false, sansPhoto = 0) => [`لقيت ${modelesEnLettres(k)}`, ...(k > 20 ? [`${k} modeles`] : []),
    // [anonymat] 10/10/2026 : une seule lecture des planches vérifiée — on continue sur elle, le client le lit et confirme chaque photo
    ...(lectureSeule ? ['قراية وحدة برك اللي تصحّات', 'لهاذا شوف مليح كل تصويرة'] : []),
    // [casse-6] une seule lecture : un modèle sans photo de son dossier n'est pas proposé (jamais confirmé sans rien voir) — dit
    ...(lectureSeule && sansPhoto > 0 ? [`وحيّدت ${modelesEnLettres(sansPhoto)}`, 'ما قدرتش نوريلك التصويرة تاعو'] : []),
    ...(misDeCote > 0 ? ['فيديوات حطيتهم على جنب :', `${misDeCote} videos`, 'باش ما نخلطش الموديلات'] : []),
    // 09/10/2026 : un modèle du plan croisé sans aucun tronçon sain est retiré — le client le lit (nombre en lettres)
    ...(retires > 0 ? [`وحيّدت ${modelesEnLettres(retires)}`, retires === 1 ? 'ما بقا فيه حتى فيديو صالحة' : 'ما بقا فيهم حتى فيديو صالحة'] : []),
    // 09/10/2026 : une vidéo qui alterne deux vêtements plus vite que la coupe minimale est ÉCARTÉE — nommée (ligne latine),
    // aucune question : le client sait laquelle ne servira pas
    ...lignesAlternees(alternees),
    'نبعثلك التصويرة تاع كل موديل', 'قولي صحيح ولا ماشي صحيح'],
  /** Le nombre des PIXELS (separer.py estimer, seuil 1,5 non calibré), AVANT la lecture des planches : une ESTIMATION,
   *  jamais un compte sûr (09/10/2026). Le compte confirmé reste celui des lectures et des photos (« لقيت … »). */
  estimation: k => [`تقريبا ${modelesEnLettres(k)}`, 'هاذا تخمين برك، ماشي حساب أكيد', 'الحساب الأكيد من بعد التصاور'],
  /** Un bouton d'un LOT déjà lancé (double clic sur « ابدا », vieux bouton d'une photo) : surtout pas « ابعث لينك جديد »
   *  (le client referait le même lot : deux pages, deux campagnes pour les mêmes modèles). Le serveur le choisit. */
  dejaLance: ['هاذ الزر تاع موديلات بداو', 'الخدمة راهي تمشي، نعلمك', 'ما تعاودش تبعث نفس اللينك'],
  /** La même chose pour UN modèle (N = 1) : un 2e « ابدا », « عاود من الأول » après « ابدا » (07/10/2026). */
  dejaLanceUn: ['هاذ الزر تاع موديل بدا', 'الخدمة راهي تمشي، نعلمك', 'ما تعاودش تبعث نفس اللينك'],
  zarFat: ['هاذ الزر تاع سؤال فات', 'جاوب على السؤال الأخير', 'لي راهو تحت'],
  /** [v19-trois] Un nom de pixel tapé qui n'est pas un pixel du compte choisi : REFUS, la question revient avec ses boutons. */
  // [v0.3.9-meta] un compte que Meta dit désactivé, fermé ou impayé : refusé AVANT le montage (la campagne y échouerait)
  compteBloque: ['الكونت هاذا ماشي خدام عند ميتا', 'محبوس، مسكّر ولا عندو خلاص', 'ما يقدرش يطلق البوب', 'صلّحو في ميتا ولا اختار واحد آخر'],
  pixelAbsent: ['هاذ البيكسل ماكانش في الكونت', 'لي ختارت، والو ما تبدّل', 'اختار من الأزرار تحت', 'ولا اكتب الاسم بالضبط'],
  pasDeComptes: ['ما لقيتش الكونتات تاعك', 'روح للمكتب، الإعدادات،', 'واضغط : جيب الكونتات', 'ومن بعد عاود ابعث اللينك'],
  demandeOk: ['تمام، الخدمة بدات', 'نجيبو الفيديوات من الدرايف', 'نعلمك في كل مرحلة'],
  lotParti: n => ['تمام، نجيبو الفيديوات', 'ونفرزو الموديلات وحدنا', 'عدد الموديلات لي قلتلي :', `${n} modeles`, 'كل موديل عندو الصفحة تاعو', 'نبعثلك التصاور كي نكملو'],
  lotEchec: raison => ['صرا مشكل في فرز الموديلات', 'السبب :', ...coupeLatin(raison), 'ابعث نفس اللينك من جديد'],
  lotPerdu: ['ما قدرتش نبدا الموديلات', 'الفرز تاعهم ضاع من الدوسي', 'ابعث اللينك من جديد'],
  lotLance: n => ['تمام، الخدمة بدات', 'عدد الموديلات :', `${n} modeles`, 'كل موديل عندو الخدمة تاعو', 'وكل ميساج فيه اسم الموديل', 'نعلمك في كل مرحلة'],
  budgetCourtTester: (n, minDa) => ['البودجي تاع النهار ما يكفيش', 'التيست بأربعة كريات يحتاج', 'عشرين دولار لكل موديل', 'الأقل لكل الموديلات :', `${nombre(minDa)} DA = ${CBO_TESTER_USD * n} $`, 'طلّع البودجي في الإعدادات', 'ومن بعد اضغط : ابدا'],
  budgetCourt: (n, minDa) => ['البودجي تاع النهار ما يكفيش', 'لازم ثلاثة دولار لكل موديل', 'الأقل لكل الموديلات :', `${nombre(minDa)} DA = ${3 * n} $`, 'طلّع البودجي في الإعدادات', 'ومن بعد اضغط : ابدا'],
  confirmation: (k, n, couleurs) => ['هاذا واحد من الموديلات لي فرزت', 'الرقم تاعو و اللونات :', `Modele ${k} / ${n}`, ...lignesNoms(couleurs), 'كل التصاور فيها نفس الموديل ؟', 'إذا صحيح اضغط : صحيح', 'وإذا اللونات غالطين، تسمّيهم انت'],
  /** Dans le résumé du lot, sous un modèle dont le client a dit « اللونات غالطين » (rien sous les autres : comme avant). */
  couleursClient: 'اللونات : تسمّيهم انت من بعد',
  entete: (k, n) => ['الموديل :', `Modele ${k} / ${n}`]
};

/** Lit un prix tapé à la main : « 2300 », « 2 300 », « 2.300 », « 2,300 » → 2300. « 2,5 » est refusé (pas un prix). */
/** [relecture] 10/10/2026 : l'objet choisi (compte, page) retrouvé PAR SON ID dans la liste du moment ; un id disparu → null
 *  (la mission s'arrête en clair : « compte publicitaire inconnu »), jamais l'objet d'un autre rang. Une conversation d'avant
 *  (sans id gardé) : le rang, comme avant. */
export function choisiParId(liste, rep, cle) {
  const l = liste || [], id = rep && rep[cle + 'Id'];
  if (id !== undefined && id !== null) return l.find(x => x && String(x.id) === String(id)) || null;
  return l[+(rep || {})[cle]] || null;
}
export function lirePrix(texte) {
  // un clavier arabe tape « ٢٣٠٠ » ou « ۲۳۰۰ » : ce sont les mêmes chiffres
  const t = String(texte || '').trim().replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6F0))
    .replace(/\s+/g, '').replace(/(da|دج|دينار)$/i, '');
  if (/^\d+$/.test(t)) return +t;
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return +t.replace(/[.,]/g, '');
  return null;
}

/** Une conversation : purement en mémoire + un fichier ; le serveur envoie ce qu'elle rend.
 *  Elle rend un tableau de messages [{texte, boutons, photo}] ou un objet qui dit au serveur quoi faire :
 *  { demande } (N = 1 : une mission) · { lot } (lancer la descente et la séparation) · { lotAnnule: {id, etat, raison} }
 *  · { lotFinal: {id, n, modeles:[{rang, nom, reponses}]} } (une mission par modèle) — chacun avec { envoyer }. */
export function ouvrirAccueil({ dossier, listes = () => ({ comptes: [], pages: [] }), journal = () => {} }) {
  fs.mkdirSync(dossier, { recursive: true });
  const FICHIER = path.join(dossier, 'conversation.json');
  let conv = null;
  try { conv = JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch { conv = null; }
  if (conv && !conv.phase) conv.phase = 'questions'; // une conversation d'avant la v0.3.8 : un seul modèle
  const sauver = () => { if (conv) fs.writeFileSync(FICHIER, JSON.stringify(conv, null, 2)); else { try { fs.unlinkSync(FICHIER); } catch {} } };
  // le lot final de « ابدا » (réponses ET marques « اللونات غالطين ») : écrit AVANT que la conversation s'efface, effacé par
  // le serveur quand les missions sont nées — une coupure du PC entre les deux ne perd plus rien
  const FINAL = id => path.join(dossier, `lot-final-${id}.json`);
  const ecrireFinal = lf => { const f = FINAL(lf.id), t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(lf, null, 2)); fs.renameSync(t, f); };
  const msg = lignes => ({ texte: lignes.join('\n') });

  const parCle = c => (c === 'memeprix' ? QUESTION_MEME_PRIX : QUESTIONS.find(q => q.cle === c));
  /** [meme-prix] La question est due : un lot de deux modèles ou plus, le 1er modèle, pas encore répondue, son gros pas encore
   *  donné (une conversation d'avant déjà passée par le prix du 1er modèle ne la reçoit jamais). */
  const memePrixDue = () => conv.phase === 'modeles' && conv.n >= 2 && conv.rang === 1 && conv.reponses.memeprix === undefined
    && !!modele() && modele().reponses.gros === undefined;
  /** [meme-prix] « واه » : le modèle en cours (rang ≥ 2) reçoit le gros, la vente, les tailles et le code du 1er modèle. */
  const reprendrePrix = () => {
    const md = modele(), src = (conv.modeles || [])[0];
    if (conv.reponses.memeprix !== 'oui' || !md || !src || md === src) return;
    for (const c of MEME_PRIX_REPRIS) if (src.reponses[c] !== undefined && md.reponses[c] === undefined) md.reponses[c] = src.reponses[c];
    journal(`accueil ${conv.id} : modèle ${conv.rang} : prix, tailles et code repris du modèle 1`);
  };
  /** [v19-trois] Les pixels LUS du compte choisi (du dernier tir au plus ancien), ou null quand ils n'ont jamais été lus. */
  const pixelsDe = r => { const c = choisiParId(listes().comptes, r || {}, 'compte'); return c && Array.isArray(c.pixels) ? c.pixels.filter(x => x && x.id !== undefined && x.id !== null && String(x.nom || '').trim()).slice().sort((a, b) => String(b.dernierTir || '').localeCompare(String(a.dernierTir || ''))) : null; };
  const pixelActif = r => !!r && r.mode === 'site' && pixelsDe(r) !== null;
  // 29/10/2026 : la voie n'existe que pour une conversation NÉE avec elle (conv.avecVoie, posé au lien) — une conversation d'avant
  // relue du disque continue sur la chaîne d'avant, telle quelle
  const voieDue = () => !!(conv && conv.avecVoie);
  const questionsActives = r => QUESTIONS.filter(q => (!q.si || q.si(r)) && (q.cle !== 'pixel' || pixelActif(r)) && (q.cle !== 'voie' || voieDue()));
  const communes = () => COMMUNES.map(c => (c === 'niche' ? { ...parCle(c), texte: NICHE_LOT } : parCle(c))).filter(q => q.cle !== 'pixel' || pixelActif(conv.reponses))
    .filter(q => (q.cle !== 'structure' || estTester(conv.reponses)) && (q.cle !== 'creas' || !estTester(conv.reponses)) // 29/10/2026
      && (q.cle !== 'voie' || (voieDue() && (conv.reponses.voie !== undefined || q.si(conv.reponses))))); // un lot d'avant : pas de voie
  const modele = () => (conv.modeles || [])[conv.rang - 1] || null;
  /** Les réponses que la question en cours remplit : celles du modèle en cours dans un lot, sinon celles de la conversation. */
  const reponses = () => (conv.phase === 'modeles' ? modele().reponses : conv.reponses);
  /** La question en cours, selon la phase (null : plus de question tapée dans cette phase). */
  function courante() {
    if (!conv) return null;
    if (conv.phase === 'nombre') return QUESTION_N;
    if (conv.phase === 'questions') return questionsActives(conv.reponses).find(q => conv.reponses[q.cle] === undefined) || null;
    if (conv.phase === 'communes') return communes().find(q => conv.reponses[q.cle] === undefined) || null;
    if (conv.phase === 'modeles') {
      const md = modele(); if (!md) return null;
      const q = PAR_MODELE.map(parCle).filter(x => !x.si || x.si(md.reponses)).find(x => md.reponses[x.cle] === undefined) || null;
      return q && q.cle === 'gros' && memePrixDue() ? QUESTION_MEME_PRIX : q; // [meme-prix] juste avant le gros du 1er modèle
    }
    return null;
  }
  /** La clé d'un bouton : celle de la question, + le rang du modèle dans un lot (un vieux bouton du modèle 1 ne répond pas au 2). */
  const cleBouton = q => q.cle + (conv.phase === 'modeles' ? String(conv.rang) : '');

  /** Le message d'une question : ses lignes + ses boutons. data = acc:<conv>:<cle>:<valeur> (≤ 64 octets). */
  /** Qui porte la question en cours : le modèle d'un lot, ou la conversation (N = 1). */
  const porteur = () => (conv.phase === 'modeles' ? modele() : conv);
  /** Les noms déjà pris dans la fiche (les autres modèles du lot, jamais « auto »). */
  const nomsPris = () => (conv.phase === 'modeles' ? conv.modeles.filter(md => md.rang !== conv.rang && md.reponses.nom && md.reponses.nom !== 'auto').map(md => md.reponses.nom) : []);
  /** Les noms proposés de la question en cours (déterministes : graine = le lot ou la conversation, le rang, le type ; le nom
   *  que la chaîne a trouvé pour ce modèle d'abord, s'il est valable — 10/10/2026 : NOMS_PROPOSES en tout). */
  const sixNoms = () => nomsProposes({ graine: conv.lot || conv.id, rang: conv.phase === 'modeles' ? conv.rang : 1, type: reponses().type, pris: nomsPris(),
    premier: conv.phase === 'modeles' ? (modele() || {}).nom || '' : '', dossier: dossierDrive(conv.lien) });
  /** Les choix d'une question au moment où elle part (et où son bouton revient) : les noms + « نكتبو أنا » + « سمّيه انت ». */
  function choixDe(q) {
    if (q.cle === 'nom') return [...sixNoms().map(n => ({ v: n, t: n })), { v: 'ecrire', t: BOUTON_ECRIRE }, ...q.choix];
    // [v19-trois] les pixels du compte CHOISI, et eux seuls (par leur id) ; un compte sans pixel : « بدّل للميساج »
    if (q.cle === 'pixel') { const px = pixelsDe(reponses()) || []; return px.length ? px.slice(0, PIXELS_MAXI_BOUTONS).map(p => ({ v: String(p.id), t: String(p.nom).slice(0, 40) })) : [{ v: 'message', t: BOUTON_PIXEL_MESSAGE }]; }
    return q.choix || [];
  }
  function message(q) {
    let choix = choixDe(q);
    let texte = q.texte;
    if (q.cle === 'creas') { const reg = listes().creasParModele; choix = choixCreas(reg); texte = [...q.texte, ligneHabitude(reg)]; }
    if (q.cle === 'structure') texte = [...q.texte, ligneCboTester(), ...q.fin]; // 29/10/2026 : le budget CBO en dollars ET en dinars
    // « نكتبو أنا » pressé : la question du nom en texte libre, avec le seul « سمّيه انت » (les règles d'avant)
    if (q.cle === 'nom' && porteur().nomLibre) { choix = q.choix; texte = q.texteLibre; }
    if (q.cle === 'pixel' && !(pixelsDe(reponses()) || []).length) texte = q.texteVide;
    if (q.type === 'liste') {
      const l = (listes()[q.source] || []).slice(0, 8);
      choix = l.map((x, i) => ({ v: String(i), t: String(x.nom || x.id).slice(0, 40) }));
    }
    const col = q.colonnes || (choix.length > 2 ? 2 : choix.length || 1);
    const boutons = [];
    for (let i = 0; i < choix.length; i += col) boutons.push(choix.slice(i, i + col).map(c => ({ texte: c.t, data: `acc:${conv.id}:${cleBouton(q)}:${c.v}` })));
    // les six noms sur DEUX colonnes, puis « نكتبو أنا » et « سمّيه انت » chacun sur sa ligne
    if (q.cle === 'nom' && !porteur().nomLibre) {
      boutons.length = 0; const six = choix.filter(c => c.v !== 'ecrire' && c.v !== 'auto'), seuls = choix.filter(c => c.v === 'ecrire' || c.v === 'auto');
      for (let i = 0; i < six.length; i += 2) boutons.push(six.slice(i, i + 2).map(c => ({ texte: c.t, data: `acc:${conv.id}:${cleBouton(q)}:${c.v}` })));
      for (const c of seuls) boutons.push([{ texte: c.t, data: `acc:${conv.id}:${cleBouton(q)}:${c.v}` }]);
    }
    boutons.push([{ texte: 'الغي', data: `acc:${conv.id}:annule:1` }]);
    if (conv.phase !== 'modeles' || q.cle === 'memeprix') return { texte: texte.join('\n'), boutons };
    // un modèle d'un lot : chaque question dit de quel modèle elle parle ; la première rappelle sa photo
    const md = modele();
    const out = { texte: [...TEXTES.entete(md.rang, conv.n), ...texte].join('\n'), boutons };
    if (q.cle === PAR_MODELE[0] && md.photo) out.photo = md.photo;
    return out;
  }
  /** La photo d'un modèle trouvé, à confirmer : « صحيح » / « ماشي صحيح » / « صحيح، بصح اللونات غالطين » (le modèle est
   *  juste, ses couleurs non : sa mission les fera nommer par le client). */
  function messageConfirmation(k) {
    const md = conv.modeles[k - 1];
    return { texte: TEXTES.confirmation(k, conv.modeles.length, md.couleurs).join('\n'), photo: md.photo || null,
      boutons: [[{ texte: 'صحيح', data: `acc:${conv.id}:ok${k}:oui` }, { texte: 'ماشي صحيح', data: `acc:${conv.id}:ok${k}:non` }],
        [{ texte: BOUTON_COULEURS_FAUSSES, data: `acc:${conv.id}:ok${k}:coul` }], [{ texte: 'الغي', data: `acc:${conv.id}:annule:1` }]] };
  }

  const nomListe = (src, i) => { const x = (listes()[src] || [])[+i]; return ligneSure(x ? String(x.nom || x.id) : '?'); };
  // [relecture] le résumé lit le compte et la page PAR ID, comme le lancement (choisiParId)
  const nomChoisi = (src, r, cle) => { const x = choisiParId(listes()[src], r, cle); return ligneSure(x ? String(x.nom || x.id) : '?'); };
  // la loi des dinars : chaque montant en DA porte aussi les dollars (le taux du client, dans ses réglages)
  const prix = (etiquette, v) => { const taux = +(listes().taux || 0); return `${etiquette} ${nombre(v)} DA = ${taux > 0 ? nombre(Math.round(v / taux)) : '?'} $`; };
  /** 29/10/2026 : le budget CBO du test, en dollars ET en dinars au taux du client (une ligne latine). */
  const ligneCboTester = () => { const taux = +(listes().taux || 0); return `${CBO_TESTER_USD} $${taux > 0 ? ` = ${nombre(CBO_TESTER_USD * taux)} DA` : ''} / modele`; };
  const lignesVoie = r => (!estTester(r) ? [] : ['الطريقة : تيست بالفيديوهات', ...(r.structure === 'CBO' ? ['الكامباني : أد ست واحد', 'CBO · 1 adset · 4 ads', ligneCboTester()] : ['الكامباني : كل فيديو وحدو', 'ABO · 4 adsets'])]);
  const lignesCommunes = r => ['السلعة : ' + (r.stock === 'stock' ? 'عندك' : 'تيست برك'), 'الكوموند : ' + (r.mode === 'site' ? 'من الموقع' : 'بالميساج'), ...(r.mode === 'site' && r.pixelId ? ['البيكسل :', ligneSure(String(r.pixel || '?'))] : []), 'البوب : ' + (r.placements === 'broad' ? 'برود' : 'ستوري و ريلز'), ...lignesVoie(r)];
  /** [v19-trois] Le pixel qui PART avec la demande : celui du compte choisi, retrouvé par son id dans la liste du moment ; disparu
   *  de la liste → l'id et le nom choisis partent quand même (la campagne le relit chez Meta et refuse s'il n'y est plus) ; jamais
   *  un autre pixel. Mode message ou pixels jamais lus : rien (l'ancienne loi). */
  const pixelQuiPart = r => { if (!r || r.mode !== 'site' || !r.pixelId) return undefined; const p = (pixelsDe(r) || []).find(x => String(x.id) === String(r.pixelId)); return p ? { id: String(p.id), nom: String(p.nom) } : { id: String(r.pixelId), nom: String(r.pixel || '') }; };
  const sansPixels = c => { if (!c || !Array.isArray(c.pixels)) return c; const { pixels, ...x } = c; return x; };
  const nomModele = r => (r.nom === 'auto' ? 'اسم أوتوماتيك' : ligneSure(String(r.nom)));
  const taillesDe = r => (TAILLES.find(t => t.v === r.tailles) || {}).t || r.tailles;

  /** Le nombre de créas montré au résumé est CELUI qui part : sans réponse valable (conversation d'avant, valeur abîmée),
   *  le réglage est figé ici, au moment où le résumé est envoyé — un réglage changé avant « ابدا » ne change rien. */
  function figerCreas() {
    // 29/10/2026 : la voie « tester » = quatre créas, toujours (la règle du vendeur)
    if (estTester(conv.reponses)) { if (conv.reponses.creas !== String(CREAS_TESTER)) { conv.reponses.creas = String(CREAS_TESTER); sauver(); } return CREAS_TESTER; }
    if (creasValide(conv.reponses.creas) !== null) return creasValide(conv.reponses.creas);
    const k = creasDe(undefined, listes().creasParModele);
    conv.reponses.creas = String(k); sauver(); journal(`accueil ${conv.id} : créas figées au résumé sur le réglage (${k})`);
    return k;
  }
  function resume() {
    const r = conv.reponses; const k = figerCreas();
    const lignes = [
      'هاذا واش فهمت منك',
      'السعر بالدينار و الدولار :',
      prix('Gros', r.gros), prix('Detail', r.detail),
      ...lignesCommunes(r),
      'الكونت و الصفحة :',
      nomChoisi('comptes', r, 'compte'), nomChoisi('pages', r, 'page'),
      'الاسم و التايات :',
      nomModele(r), taillesDe(r),
      ...lignesCreas(k),
      'إذا صحيح اضغط : ابدا'
    ];
    return lignes.join('\n');
  }
  function resumeLot() {
    const r = conv.reponses; const k = figerCreas();
    const lignes = ['هاذا واش فهمت منك', 'عدد الموديلات :', `${conv.n} modeles`, ...lignesCommunes(r),
      'النيش : ' + ((NICHES.find(x => x.v === r.niche) || {}).t || '?'), ...lignesCreas(k),
      'الكونت و الصفحة :', nomChoisi('comptes', r, 'compte'), nomChoisi('pages', r, 'page')];
    for (const md of conv.modeles) {
      const x = md.reponses;
      lignes.push('الموديل و السعر :', `Modele ${md.rang} / ${conv.n}`, prix('Gros', x.gros), prix('Detail', x.detail), 'الاسم و التايات :', nomModele(x), taillesDe(x));
      if (md.couleursClient) lignes.push(TEXTES.couleursClient);
    }
    lignes.push('إذا صحيح اضغط : ابدا');
    return lignes.join('\n');
  }
  const messageResumeLot = () => ({ texte: resumeLot(), boutons: [[{ texte: 'ابدا', data: `acc:${conv.id}:go:1` }, { texte: 'الغي', data: `acc:${conv.id}:annule:1` }]] });
  /** Le résumé d'UN modèle (N = 1) et ses deux boutons. */
  const messageResume = () => ({ texte: resume(), boutons: [[{ texte: 'ابدا', data: `acc:${conv.id}:go:1` }, { texte: 'عاود من الأول', data: `acc:${conv.id}:refaire:1` }]] });
  /** Fermer la conversation ; un lot déjà lancé est annulé par le serveur. */
  function fermer(texte, { etat = 'annule', raison = 'annulé par le client' } = {}) {
    const lot = conv && conv.lot; const id = conv && conv.id;
    conv = null; sauver();
    if (lot) journal(`accueil ${id} : lot ${lot} ${etat} (${raison})`);
    const envoyer = [msg(texte)];
    return lot ? { lotAnnule: { id: lot, etat, raison }, envoyer } : envoyer;
  }

  /** UN LIEN NEUF PENDANT UNE FICHE OUVERTE (09/10/2026) : « راك في وسط موديل آخر » porte un BOUTON « الغي » ; le lien
   *  refusé (un dossier Drive, autre que celui de la fiche) est gardé EN ATTENTE dans la conversation. Il le reste tant que
   *  le client ne continue pas l'ancienne fiche (une réponse prise l'efface : il a choisi « كمّل ») ; un lien plus récent le
   *  remplace. */
  function lienPendantFiche(texte) {
    const lien = (String(texte || '').match(/https?:\/\/(drive|docs)\.google\.com\/\S+/i) || [])[0] || '';
    // 10/10/2026 (« casse ») : le MÊME dossier écrit autrement (« ?usp=sharing », « /u/0/ », une barre finale) n'est pas un lien
    // neuf — « الغي » referait la même fiche ; et le dossier de la fiche renvoyé APRÈS un lien neuf est le dernier mot du
    // client : plus rien n'attend (« الغي » redevient l'annulation simple)
    const neuf = dossierDrive(lien);
    if (neuf && neuf === dossierDrive(conv.lien)) { if (conv.lienEnAttente) { delete conv.lienEnAttente; sauver(); journal(`accueil ${conv.id} : le dossier de la fiche renvoyé, le lien neuf n'attend plus`); } }
    else if (neuf && neuf !== dossierDrive(conv.lienEnAttente)) { conv.lienEnAttente = lien; conv.attenteDepuis = conv.phase; sauver(); journal(`accueil ${conv.id} : un lien neuf attend (la fiche ouverte n'est pas finie)`); }
    // [relecture] 10/10/2026 : pendant la séparation, le lien neuf GARDÉ est dit, et son bouton n'annule que lui
    if (conv.phase === 'analyse' && conv.lienEnAttente) return [{ texte: TEXTES.lienGarde.join('\n'), boutons: [[{ texte: 'الغي اللينك', data: `acc:${conv.id}:annule:lienseul` }]] }];
    return [{ texte: (conv.phase === 'analyse' ? TEXTES.enAnalyse : TEXTES.enCours).join('\n'), boutons: [[{ texte: 'الغي', data: `acc:${conv.id}:annule:lien` }]] }];
  }
  /** « الغي » (tapé ou pressé) : avec un lien neuf EN ATTENTE, la fiche ouverte est annulée ET ce lien commence (« شحال من
   *  موديل ؟ ») ; sans lien en attente, l'annulation simple, dite comme avant (« ابعث لينك جديد وقت ما تحب »). */
  function annulerFiche() {
    const lien = conv.lienEnAttente;
    if (!lien) return fermer(TEXTES.annule);
    const f = fermer(TEXTES.annuleEtLien, { raison: 'annulé par le client pour un lien neuf' });
    const neuf = api.commencer(lien);
    journal(`accueil : fiche annulée, le lien neuf commence${conv ? ` (${conv.id})` : ''}`);
    return Array.isArray(f) ? [...f, ...neuf] : { ...f, envoyer: [...f.envoyer, ...neuf] };
  }
  /** La fiche finie SANS le client (lot seul, vide, en échec, fermée au redémarrage) : un lien neuf qui attendait commence
   *  (10/10/2026, « casse » : il disparaissait avec la conversation, le client avait lu « استنى حتى نكمل »). conv est déjà null. */
  function lienSuivant(lien) {
    if (!lien || !dossierDrive(lien) || (conv && !conv.termine)) return [];
    journal('accueil : la fiche est finie, le lien neuf qui attendait commence');
    return [msg(TEXTES.lienQuiAttendait), ...api.commencer(lien)];
  }
  /** Le client CONTINUE la fiche ouverte (une réponse prise) : le lien neuf qui attendait n'attend plus. */
  // 10/10/2026 (« casse ») : un lien arrivé PENDANT LA SÉPARATION (« استنى حتى نكمل ») n'est pas un lien que le client
  // abandonne en confirmant les photos : il attend la fin de la fiche (lancée, vide, en échec) puis commence
  const continuer = () => { if (conv && conv.lienEnAttente && conv.attenteDepuis !== 'analyse') { delete conv.lienEnAttente; delete conv.attenteDepuis; journal(`accueil ${conv.id} : la fiche continue, le lien neuf n'attend plus`); } };

  const api = {
    enCours: () => !!conv && !conv.termine,
    conversation: () => conv,
    /** « هاذ الزر تاع سؤال فات » + la question EN COURS avec ses boutons (la photo à confirmer, le résumé, ou la question
     *  tapée) ; pendant la séparation il n'y a rien à répondre : on dit d'attendre. */
    questionEnCours() {
      const fat = msg(TEXTES.zarFat);
      if (conv.phase === 'analyse') return [msg(TEXTES.analyse)];
      if (conv.phase === 'confirmation') return [fat, messageConfirmation(conv.rangConf)];
      if (conv.phase === 'resume') return [fat, messageResumeLot()];
      const q = courante();
      if (q) return [fat, message(q)];
      if (conv.phase === 'questions') return [fat, messageResume()];
      return [fat];
    },
    /** Un lien Drive vient d'arriver. Rend [{texte, boutons}] à envoyer. */
    commencer(lien) {
      const lienPropre = String(lien || '').trim();
      if (!LIEN_DRIVE.test(lienPropre)) return [msg(TEXTES.pasDrive)];
      if (conv && !conv.termine) return lienPendantFiche(lienPropre);
      conv = { id: crypto.randomBytes(3).toString('hex'), debut: new Date().toISOString(), lien: lienPropre, phase: 'nombre', n: null, reponses: {}, termine: false, avecVoie: true };
      sauver(); journal(`accueil ${conv.id} : lien reçu`);
      return [message(courante())];
    },
    /** Un texte tapé par le client pendant la conversation. */
    surTexte(texte) {
      if (!conv || conv.termine) return null;
      const t = String(texte || '').trim();
      if (MOTS_ANNULE.includes(t.toLowerCase())) return annulerFiche();
      // un AUTRE lien collé en pleine conversation n'est ni un prix ni un nom : on dit qu'un modèle est déjà en cours, avec
      // un bouton « الغي » qui enchaîne sur ce lien (09/10/2026)
      if (/https?:\/\/(drive|docs)\.google\.com\//i.test(t)) return lienPendantFiche(t);
      if (conv.phase === 'analyse') return [msg(TEXTES.analyse)];
      // la photo à confirmer (ou le résumé) a pu ne jamais arriver (réseau coupé, PC éteint) : on la renvoie avec ses boutons
      if (conv.phase === 'confirmation') return [msg(TEXTES.boutons), messageConfirmation(conv.rangConf)];
      if (conv.phase === 'resume') return [msg(TEXTES.boutons), messageResumeLot()];
      const q = courante();
      // [relecture] 10/10/2026 : « /start » (ou toute commande) n'est jamais une réponse : la question revient
      if (/^\//.test(t) && q) return [msg(TEXTES.commandeEnFiche), message(q)];
      // N = 1 : toutes les réponses sont là, le résumé attend « ابدا » — un texte tapé (« ok », « ابدا »), ou un résumé
      // jamais arrivé : on le renvoie avec ses boutons, comme pour un lot (07/10/2026 : le client restait sans réponse)
      if (!q && conv.phase === 'questions') return [msg(TEXTES.boutons), messageResume()];
      if (!q) return null;
      const r = reponses();
      // [meme-prix] un PRIX tapé à la place d'un bouton : le client donne le gros de CE modèle → « كل موديل وحدو » (rien n'est
      // copié, jamais supposé « كيف كيف ») et le prix suit la loi du gros ; tout autre texte : la question revient avec ses boutons
      if (q.cle === 'memeprix') {
        if (lirePrix(t) === null) return [msg(TEXTES.boutons), message(q)];
        conv.reponses.memeprix = 'non'; journal(`accueil ${conv.id} : prix tapé sur « كيف كيف ؟ », chaque modèle a ses prix`);
        return api.surTexte(t);
      }
      if (q.tape === 'choixnom') {
        // 10/10/2026 : le libellé d'un bouton tapé est ce bouton (« نكتبو أنا », « اقترحلي أسماء », « سمّيه انت ») ; un TYPE seul tapé
        // (« Robe », « عباية ») ouvre les noms de ce type ; tout autre texte est le nom (les règles du texte libre)
        const lt = laverTape(t), qn = parCle('nom');
        if (lt === laverTape(BOUTON_ECRIRE)) return api.repondre(q, 'ecrire');
        if (lt === laverTape(BOUTON_PROPOSER)) return api.repondre(q, 'proposer');
        if (qn.choix.some(c => laverTape(c.t) === lt)) { r.choixnom = 'ecrire'; r.nom = 'auto'; delete porteur().nomLibre; return api.suite(); }
        const ty = TYPES.find(x => laverTape(x.t) === lt || x.v.toLowerCase() === lt.toLowerCase());
        if (ty) { r.choixnom = 'proposer'; r.type = ty.v; return api.suite(); }
        if (t.length < qn.min || t.length > qn.max || /[<>{}\\]/.test(t)) return [msg(TEXTES.nomFaux)];
        if (conv.phase === 'modeles' && nomsPris().some(n => cleNom(n) === cleNom(t))) return [msg(TEXTES.nomPris)];
        r.choixnom = 'ecrire'; r.nom = t; delete porteur().nomLibre;
        return api.suite();
      }
      if (q.cle === 'pixel') {
        // [v19-trois] un nom TAPÉ : pris seulement s'il est EXACTEMENT celui d'UN pixel du compte choisi ; sinon REFUS + la question
        const px = pixelsDe(r) || [];
        if (!px.length && laverTape(t) === laverTape(BOUTON_PIXEL_MESSAGE)) return api.repondre(q, 'message');
        const p = px.filter(x => memeNomPixel(x.nom, t));
        if (p.length === 1) return api.repondre(q, String(p[0].id));
        journal(`accueil ${conv.id} : pixel tapé absent du compte choisi, refusé`);
        return [msg(TEXTES.pixelAbsent), message(q)];
      }
      if (q.tape === 'type') {
        const ty = typeTape(t);
        if (!ty) return [msg(TEXTES.typeFaux), message(q)];
        return api.repondre(q, ty);
      }
      if (q.tape) {
        const v = lirePrix(t);
        if (!(v >= 1 && v <= MAX_MODELES)) return [msg(TEXTES.nombreIncompris)];
        return api.repondre(q, String(v));
      }
      if (q.type === 'nombre') {
        const v = lirePrix(t);
        if (v === null || v < q.min || v > q.max) return [msg(TEXTES.prixIncompris)];
        const faute = q.valider ? q.valider(v, r) : null;
        if (faute) return [{ texte: faute.join('\n') }];
        r[q.cle] = v;
      } else if (q.type === 'texte') {
        // le libellé d'un BOUTON tapé à la main (« نكتبو أنا », « سمّيه انت ») est ce bouton, jamais un nom (10/10/2026, passe
        // « casser » : « نكتبو أنا » tapé devenait le nom du modèle)
        const bouton = q.cle === 'nom' ? choixDe(q).find(c => (c.v === 'ecrire' || c.v === 'auto') && laverTape(c.t) === laverTape(t)) : null;
        if (bouton) return api.repondre(q, bouton.v);
        // 10/10/2026 : « اقترحلي أسماء » tapé sur le nom n'est jamais un nom : le type (s'il manque) puis les noms proposés
        if (q.cle === 'nom' && laverTape(t) === laverTape(BOUTON_PROPOSER)) { r.choixnom = 'proposer'; delete porteur().nomLibre; return api.suite(); }
        if (t.length < q.min || t.length > q.max || /[<>{}\\]/.test(t)) return [msg(TEXTES.nomFaux)];
        if (conv.phase === 'modeles' && conv.modeles.some(md => md.rang !== conv.rang && md.reponses.nom && md.reponses.nom !== 'auto' && cleNom(md.reponses.nom) === cleNom(t))) return [msg(TEXTES.nomPris)];
        r[q.cle] = t; delete porteur().nomLibre;
      } else {
        // une question à boutons (une conversation d'avant arrêtée sur le nom reçoit maintenant celle des créas) : la question
        // revient AVEC ses boutons — « جاوب بالأزرار » seul laissait le client sans bouton à l'écran
        return [msg(TEXTES.boutons), message(q)];
      }
      return api.suite();
    },
    /** Une réponse prise par bouton (ou le nombre de modèles tapé). */
    repondre(q, valeur) {
      if (q.cle === 'n') { conv.n = +valeur; conv.phase = conv.n === 1 ? 'questions' : 'communes'; journal(`accueil ${conv.id} : ${conv.n} modèle(s) annoncé(s)`); }
      else if (q.cle === 'memeprix') { conv.reponses.memeprix = valeur; journal(`accueil ${conv.id} : prix et tailles ${valeur === 'oui' ? 'pareils pour tous les modèles' : 'pour chaque modèle'}`); }
      else if (q.cle === 'choixnom') {
        // 10/10/2026 : « نكتبو أنا » → le texte libre d'avant (nomLibre) ; « اقترحلي أسماء » → le type puis les noms
        reponses().choixnom = valeur;
        if (valeur === 'ecrire') { porteur().nomLibre = true; journal(`accueil ${conv.id} : le client écrit le nom lui-même`); } else delete porteur().nomLibre;
      }
      else if (q.cle === 'nom' && valeur === 'ecrire') {
        // « نكتبو أنا » : la question du nom repasse en texte libre (les règles d'avant), rien n'est retenu
        porteur().nomLibre = true; sauver(); journal(`accueil ${conv.id} : le client écrit le nom lui-même`);
        return [message(q)];
      }
      else if (q.cle === 'pixel') {
        // [v19-trois] le bouton = l'id d'un pixel LU du compte choisi ; « بدّل للميساج » (compte sans pixel) : le mode passe au message
        const r = reponses();
        if (valeur === 'message') { if ((pixelsDe(r) || []).length) return [msg(TEXTES.pixelAbsent), message(q)]; r.mode = 'message'; delete r.pixel; delete r.pixelId; journal(`accueil ${conv.id} : compte sans pixel, le client passe au message`); }
        else { const p = (pixelsDe(r) || []).find(x => String(x.id) === String(valeur)); if (!p) return [msg(TEXTES.pixelAbsent), message(q)]; r.pixel = String(p.nom); r.pixelId = String(p.id); journal(`accueil ${conv.id} : pixel choisi parmi ceux du compte`); }
      }
      else if (q.cle === 'nom') {
        // un bouton vaut le nom — jamais un nom déjà pris dans la fiche (deux boutons identiques comme deux noms tapés)
        if (valeur !== 'auto' && nomsPris().some(n => cleNom(n) === cleNom(valeur))) return [msg(TEXTES.nomPris), message(q)];
        reponses()[q.cle] = valeur; delete porteur().nomLibre;
      }
      else if (q.cle === 'compte' && STATUT_BLOQUANT.test(String(((listes().comptes || [])[+valeur] || {}).statut ?? '').trim())) {
        journal(`accueil ${conv.id} : compte refusé (statut Meta ${((listes().comptes || [])[+valeur] || {}).statut})`);
        return [msg(TEXTES.compteBloque), message(q)];
      }
      else {
        reponses()[q.cle] = valeur;
        // [relecture] 10/10/2026 : le compte et la page sont gardés PAR ID (le rang seul changeait de cible si la liste était relue
        // entre la question et « ابدا ») ; résolus par cet id au lancement (choisiParId)
        if (q.type === 'liste') { const x = (listes()[q.source] || [])[+valeur]; if (x && x.id !== undefined && x.id !== null) reponses()[q.cle + 'Id'] = String(x.id); }
      }
      return api.suite();
    },
    /** Un bouton pressé : acc:<conv>:<cle>:<valeur>. */
    surBouton(data) {
      const m = /^acc:([0-9a-f]{6}):([a-z0-9]+):(.+)$/.exec(String(data || ''));
      if (!m) return null;
      // un bouton d'une conversation d'AVANT pendant qu'une autre est ouverte : jamais « ابعث لينك جديد » (le lien renvoyé
      // tomberait sur « راك في وسط موديل آخر ») — on dit que ce bouton est passé et on renvoie la question en cours
      if (conv && !conv.termine && conv.id !== m[1]) return api.questionEnCours();
      if (!conv || conv.id !== m[1]) return [msg(TEXTES.questionFatet)];
      // [relecture] « الغي اللينك » : seulement le lien gardé ; la fiche (la séparation en cours) continue
      if (m[2] === 'annule' && m[3] === 'lienseul') {
        if (!conv.lienEnAttente) return api.questionEnCours();
        delete conv.lienEnAttente; delete conv.attenteDepuis; sauver(); journal(`accueil ${conv.id} : le lien gardé est annulé, la fiche continue`);
        return conv.phase === 'analyse' ? [msg(TEXTES.lienGardeAnnule)] : api.questionEnCours();
      }
      if (m[2] === 'annule') return annulerFiche();
      // pendant le comptage (N = 1) ou la séparation, aucun bouton n'a rien à répondre : un 2e « ابدا », un vieux bouton
      // d'une question d'avant → « استنى شوية، راني نفرز » (jamais « هاذ الزر تاع سؤال فات » sans question à montrer)
      if (conv.phase === 'analyse') return [msg(TEXTES.analyse)];
      if (m[2] === 'go') {
        if (conv.termine) return null;
        if (conv.phase === 'resume') return api.lancerLesModeles();
        if (conv.phase !== 'questions' || courante()) return api.questionEnCours();
        // N = 1 N'EST PLUS CRU SUR PAROLE (08/10/2026) : la demande complète est gardée, et le bureau compte d'abord les
        // modèles dans les vidéos (un lot d'UN modèle : descente, separer.py --candidats). Un seul groupe pur → le bureau
        // crée la mission d'avant avec cette demande ; plusieurs → bascule en lot (photos, questions de chaque modèle).
        continuer(); figerCreas(); // déjà figé au résumé ; une conversation d'avant restée au résumé le fige ici
        const demande = { id: conv.id, lien: conv.lien, recueLe: new Date().toISOString(), reponses: { ...conv.reponses } };
        const l = listes();
        demande.reponses.creas = String(creasDe(conv.reponses.creas, l.creasParModele));
        demande.reponses.compte = choisiParId(l.comptes, conv.reponses, 'compte');
        demande.reponses.page = choisiParId(l.pages, conv.reponses, 'page');
        { const px = pixelQuiPart(conv.reponses); if (px) demande.reponses.pixel = px; else delete demande.reponses.pixel; demande.reponses.compte = sansPixels(demande.reponses.compte); delete demande.reponses.pixelId; } // [v19-trois]
        delete demande.reponses.compteId; delete demande.reponses.pageId;
        delete demande.reponses.choixnom; // [noms-choix] le choix ne part jamais : la demande garde sa forme d'avant
        conv.demandeUn = demande; conv.phase = 'analyse'; conv.lot = conv.id; conv.annonce = 1; sauver();
        journal(`accueil ${conv.id} : demande N = 1 complète, comptage des modèles lancé`);
        return { lot: { id: conv.id, lien: conv.lien, n: 1, demande }, envoyer: [msg(TEXTES.analyseUn)] };
      }
      if (m[2] === 'refaire') {
        if (conv.phase !== 'questions') return api.questionEnCours();
        const lien = conv.lien; conv = null; sauver(); return api.commencer(lien);
      }
      const ok = /^ok(\d+)$/.exec(m[2]);
      if (ok) {
        const k = +ok[1];
        if (conv.phase !== 'confirmation' || k !== conv.rangConf) return api.questionEnCours();
        if (!['oui', 'coul', 'non'].includes(m[3])) return null;
        const md = conv.modeles[k - 1]; continuer();
        // « ماشي صحيح » (08/10/2026) : CE modèle est retiré, les autres continuent (plus de repli « un lien par modèle »)
        if (m[3] === 'non') { md.confirme = false; md.retire = true; journal(`accueil ${conv.id} : modèle ${k} retiré (« ماشي صحيح »)`); }
        else {
          // « صحيح، بصح اللونات غالطين » : le modèle est confirmé, ses couleurs seront nommées par le client (sa mission)
          md.confirme = true; md.couleursClient = m[3] === 'coul';
          journal(`accueil ${conv.id} : modèle ${k} confirmé${md.couleursClient ? ', couleurs à nommer par le client' : ''}`);
        }
        const avant = m[3] === 'non' ? [msg(TEXTES.retire)] : [];
        if (k < conv.modeles.length) { conv.rangConf = k + 1; sauver(); return [...avant, messageConfirmation(k + 1)]; }
        return api.finConfirmation(avant);
      }
      const q = courante();
      // un vieux bouton, un double clic : « هاذ الزر تاع سؤال فات » ET la question en cours avec ses boutons (sans elle, une
      // conversation d'avant arrêtée sur le nom ou la niche ne voyait jamais la question des créas, venue avant)
      if (!q || cleBouton(q) !== m[2]) return api.questionEnCours();
      const valides = q.type === 'liste' ? (listes()[q.source] || []).map((_, i) => String(i)) : choixDe(q).map(c => c.v);
      if (!valides.includes(m[3])) return null;
      return api.repondre(q, m[3]);
    },
    /** Après une réponse : la question suivante, ou la fin de la phase (résumé, lancement du lot, modèle suivant). */
    suite() {
      continuer(); sauver();
      const q = courante();
      if (q) {
        if (q.type === 'liste' && !(listes()[q.source] || []).length) { conv = null; sauver(); return [msg(TEXTES.pasDeComptes)]; }
        return [message(q)];
      }
      if (conv.phase === 'questions') return [messageResume()];
      if (conv.phase === 'communes') {
        // les questions communes sont finies : le bureau télécharge le Drive UNE fois et sépare les modèles
        conv.phase = 'analyse'; conv.lot = conv.id; sauver();
        journal(`accueil ${conv.id} : questions communes finies, lot lancé (${conv.n} modèles)`);
        return { lot: { id: conv.id, lien: conv.lien, n: conv.n }, envoyer: [msg(TEXTES.lotParti(conv.n))] };
      }
      if (conv.phase === 'modeles') {
        if (conv.rang < conv.n) { conv.rang += 1; reprendrePrix(); return api.suite(); } // [meme-prix] copié AVANT la sauvegarde
        conv.phase = 'resume'; sauver();
        return [messageResumeLot()];
      }
      return null;
    },
    /** Toutes les photos ont leur réponse : les modèles CONFIRMÉS (renumérotés 1..n, chacun garde son rang dans le plan)
     *  font le nombre RÉEL qui pilote la suite ; aucun confirmé → on le dit, rien ne démarre. Un N = 1 basculé où il ne
     *  reste qu'un modèle reprend les prix, le nom et les tailles tapés au départ (le résumé les montre). */
    finConfirmation(avant = []) {
      const gardes = conv.modeles.filter(md => md.confirme);
      if (!gardes.length) { const attente = conv.lienEnAttente, f = fermer(TEXTES.aucunConfirme, { etat: 'annule', raison: 'aucun modèle confirmé par le client' }), apres = lienSuivant(attente); return Array.isArray(f) ? [...f, ...apres] : { ...f, envoyer: [...f.envoyer, ...apres] }; }
      conv.modeles = gardes.map((md, i) => ({ ...md, rang: i + 1 }));
      conv.n = gardes.length; conv.phase = 'modeles'; conv.rang = 1; delete conv.rangConf;
      if (conv.annonce === 1 && conv.n === 1) for (const c of PAR_MODELE) if (conv.reponses[c] !== undefined) conv.modeles[0].reponses[c] = conv.reponses[c];
      journal(`accueil ${conv.id} : ${conv.n} modèle(s) confirmé(s) sur ${conv.trouves ?? gardes.length} trouvé(s)`);
      const suite = api.suite();
      return Array.isArray(suite) ? [...avant, ...suite] : suite;
    },
    /** Le bureau a fini de séparer : « لقيت … » puis la photo du 1er modèle à confirmer (le nombre RÉEL trouvé, pas celui
     *  annoncé) ; un N = 1 d'un seul modèle (« seul » : sa mission est déjà née) ; aucun groupe pur (le seul arrêt) ; un échec. */
    lotPret(lot) {
      if (!lot || !conv || conv.termine || conv.lot !== lot.id || conv.phase !== 'analyse') return null; // le client a annulé entre-temps
      const attente = conv.lienEnAttente;
      if (lot.etat === 'seul') { const id = conv.id; conv = null; sauver(); journal(`accueil ${id} : un seul modèle dans les vidéos, la mission part`); return [msg(TEXTES.demandeOk), ...lienSuivant(attente)]; }
      const modeles = lot.d?.modeles || [];
      if (lot.etat === 'pret' && modeles.length) {
        conv.modeles = modeles.map((x, i) => ({ rang: i + 1, rangPlan: +x.rang || i + 1, nom: String(x.nom || ''), couleurs: x.couleurs || [], photo: x.photo || null, confirme: false, reponses: {} }));
        conv.trouves = modeles.length; conv.n = modeles.length; conv.phase = 'confirmation'; conv.rangConf = 1; sauver();
        journal(`accueil ${conv.id} : ${conv.n} modèle(s) trouvé(s) (${conv.annonce ?? '?'} annoncé(s)), à confirmer`);
        return [msg(TEXTES.trouve(conv.n, +lot.d?.misDeCote || 0, +lot.d?.retires || 0, Array.isArray(lot.d?.alternees) ? lot.d.alternees : [], !!lot.d?.lectureSeule, Array.isArray(lot.d?.sansPhoto) ? lot.d.sansPhoto.length : 0)), messageConfirmation(1)];
      }
      conv = null; sauver();
      if (lot.etat === 'vide') return [msg(TEXTES.aucunModele), ...lienSuivant(attente)];
      return [msg(TEXTES.lotEchec(lot.raison)), ...lienSuivant(attente)];
    },
    /** Au démarrage : la conversation « en analyse » dont le lot n'est jamais né (coupure) — de quoi le relancer. */
    lotDeLaConversation() {
      if (!conv || conv.termine || conv.phase !== 'analyse' || !conv.lot) return null;
      return { id: conv.lot, lien: conv.lien, n: conv.n, ...(conv.demandeUn ? { demande: conv.demandeUn } : {}) };
    },
    /** « ابدا » sur le résumé d'un lot : une mission par modèle (le budget du jour est partagé entre eux). */
    lancerLesModeles() {
      const l = listes(); const taux = +(l.taux || 0), plafond = +(l.plafondJourDA || 0);
      // le plafond du jour est GLOBAL : chaque modèle teste avec plafond / N, il faut au moins une vidéo à 3 $ chacun (0.4.2 : la structure du fichier, plancher CBO)
      // (même calcul que l'étape budget : floor(plafond / N) DA, au cours du CLIENT — 1.0 : plus de plancher à 255 ;
      // sans taux, l'étape budget refuse elle-même avec « le taux du dollar manque »)
      const cours = taux;
      // le serveur retire les boutons du résumé pressé : le résumé repart AVEC « ابدا », que le message dit de presser une fois
      // le budget monté (07/10/2026 : le client n'avait plus aucun « ابدا » et devait tout recommencer)
      if (plafond > 0 && cours > 0 && Math.floor(plafond / conv.n) / cours < 3) return [msg(TEXTES.budgetCourt(conv.n, conv.n * Math.ceil(3 * cours))), messageResumeLot()];
      // 29/10/2026 : la voie « tester » demande CBO_TESTER_USD par modèle (ABO : 4 × 5 $, CBO : sur la campagne)
      if (estTester(conv.reponses) && plafond > 0 && cours > 0 && Math.floor(plafond / conv.n) / cours < CBO_TESTER_USD) return [msg(TEXTES.budgetCourtTester(conv.n, conv.n * Math.ceil(CBO_TESTER_USD * cours))), messageResumeLot()];
      // « finie » n'est PAS écrite sur le disque : une coupure avant l'effacement laisse le résumé, que le client peut
      // represser (une conversation « finie » restée sur le disque gardait le lot « prêt » pour rien, sans rien dire)
      conv.termine = true; conv.fin = new Date().toISOString();
      // les réponses COMMUNES seulement (un N = 1 basculé garde aussi ses prix et son nom de départ : ils ne passent jamais
      // à un modèle qui ne les a pas reçus, sauf « il ne reste qu'un modèle », où ils sont déjà dans ses réponses)
      const communes = Object.fromEntries(COMMUNES.filter(c => conv.reponses[c] !== undefined).map(c => [c, conv.reponses[c]]));
      Object.assign(communes, { compte: sansPixels(choisiParId(l.comptes, conv.reponses, 'compte')), page: choisiParId(l.pages, conv.reponses, 'page') });
      { const px = pixelQuiPart(conv.reponses); if (px) communes.pixel = px; else delete communes.pixel; } // [v19-trois] le pixel du compte choisi, par son id
      // le MÊME nombre de créas pour tous les modèles du lien (la réponse commune, figée au résumé, sinon le réglage)
      communes.creas = String(creasDe(conv.reponses.creas, l.creasParModele));
      const lotFinal = { id: conv.lot, lien: conv.lien, n: conv.n, recueLe: conv.fin, modeles: conv.modeles.map(md => ({ rang: md.rang, rangPlan: md.rangPlan || md.rang, nom: md.nom, couleursClient: md.couleursClient === true, reponses: (({ choixnom, ...x }) => x)({ ...communes, ...md.reponses }) })) }; // [noms-choix] le choix ne part jamais
      ecrireFinal(lotFinal); // d'abord le lot final sur le disque, PUIS la conversation s'efface
      const fini = conv; conv = null; sauver();
      journal(`accueil ${fini.id} : lot complet, ${fini.n} modèles`);
      return { lotFinal, envoyer: [msg(TEXTES.lotLance(fini.n)), ...lienSuivant(fini.lienEnAttente)] };
    },
    /** Fermée par le bureau (lot qui ne naît pas, lot fini au redémarrage) : rend les messages du lien neuf qui attendait. */
    annuler() { const attente = conv && conv.lienEnAttente; conv = null; sauver(); return lienSuivant(attente); },
    /** Les lots finals de « ابدا » dont les missions ne sont pas (toutes) nées : le PC s'est coupé entre les deux. */
    lotsFinalsEnAttente() {
      let fichiers = []; try { fichiers = fs.readdirSync(dossier).filter(f => /^lot-final-[0-9a-f]{6}\.json$/.test(f)).sort(); } catch {}
      return fichiers.map(f => { try { return JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8')); } catch { journal(`accueil : ${f} illisible`); return null; } })
        .filter(lf => lf && /^[0-9a-f]{6}$/.test(String(lf.id)) && Array.isArray(lf.modeles));
    },
    /** Les missions du lot sont nées (ou le lot est perdu) : son lot final s'efface, et la conversation de ce lot restée
     *  sur le disque (coupure entre le lot final écrit et la conversation effacée) aussi : son « ابدا » est fait. */
    lotFinalFait(id) {
      try { fs.unlinkSync(FINAL(id)); } catch {}
      if (conv && conv.lot === id) { conv = null; sauver(); }
    }
  };
  return api;
}

/** Contrôle de toutes les questions et de tous les textes de l'accueil contre la loi de forme (épreuve). */
export function fautesDesQuestions() {
  const out = [];
  const voir = (nom, lignes) => { const f = fautesDeForme(lignes.join('\n')); if (f.length) out.push(`${nom} : ${f.join(' ; ')}`); };
  for (const q of [QUESTION_N, ...QUESTIONS]) voir(q.cle, q.texte);
  voir('niche (lot)', NICHE_LOT);
  // [meme-prix] la question « كيف كيف » et ses deux boutons (même loi qu'une ligne)
  voir('memeprix (lot)', QUESTION_MEME_PRIX.texte);
  for (const c of QUESTION_MEME_PRIX.choix) if (!/[؀-ۿ]/.test(c.t) || /\d/.test(c.t) || c.t.length > 36) out.push(`bouton memeprix « ${c.t} » : hors loi de forme`);
  voir('pixel (compte sans pixel)', QUESTIONS.find(x => x.cle === 'pixel').texteVide); // [v19-trois]
  // le 3e bouton de la photo à confirmer : la même loi qu'une ligne (darija, ≤ 36 caractères, aucun chiffre)
  const bt = BOUTON_COULEURS_FAUSSES;
  if (!/[؀-ۿ]/.test(bt) || /\d/.test(bt) || bt.length > 36) out.push(`bouton « ${bt} » : hors loi de forme`);
  voir('couleursClient (résumé du lot)', ['الاسم و التايات :', 'Robe Lina', 'S → XL', TEXTES.couleursClient, 'إذا صحيح اضغط : ابدا']);
  for (const q of PAR_MODELE.map(c => QUESTIONS.find(x => x.cle === c))) voir(`${q.cle} (modèle d'un lot)`, [...TEXTES.entete(2, 3), ...q.texte]);
  for (const [k, t] of Object.entries(TEXTES)) {
    if (k === 'entete' || k === 'couleursClient') continue;
    const lignes = typeof t === 'function' ? ({ lotParti: () => t(3), trouve: () => t(3, 2, 1), estimation: () => t(3), lotEchec: () => t('separer.py --candidats a echoue : code 3 (plantage voulu)'), lotLance: () => t(3), budgetCourt: () => t(3, 5355), budgetCourtTester: () => t(3, 15300), confirmation: () => t(2, 3, ['Noir', 'Beige', 'Bordeaux', 'Marine', 'Camel']) }[k] || (() => t()))() : t;
    voir(k, lignes);
  }
  // les formes rares : plusieurs modèles retirés, une estimation au-delà de vingt (toujours « تقريبا », jamais un chiffre arabe)
  voir('trouve (deux retirés)', TEXTES.trouve(1, 0, 2)); voir('trouve (un retiré, aucun de côté)', TEXTES.trouve(2, 0, 1));
  for (const k of [1, 2, 7, 15, 30]) voir(`estimation (${k})`, TEXTES.estimation(k));
  // la question des créas pour chaque réglage (1 à 4, absent) : ses boutons (un marqué « (العادة) »), sa ligne d'habitude ;
  // le résumé pour chaque nombre (08/10/2026)
  const qc = QUESTIONS.find(x => x.cle === 'creas');
  for (const reg of [1, 2, 3, 4, undefined]) {
    voir(`creas (réglage ${reg})`, [...qc.texte, ligneHabitude(reg)]);
    const bs = choixCreas(reg);
    if (bs.length !== 4 || bs.filter(b => /\(العادة\)$/.test(b.t)).length !== 1) out.push(`creas (réglage ${reg}) : boutons ${JSON.stringify(bs)}`);
    for (const b of bs) if (!/[؀-ۿ]/.test(b.t) || /\d/.test(b.t) || b.t.length > 36) out.push(`bouton créas « ${b.t} » : hors loi de forme`);
  }
  for (const k of CREAS_CHOIX) voir(`résumé créas ${k}`, ['الاسم و التايات :', 'Robe Lina', 'S → XL', ...lignesCreas(k), 'إذا صحيح اضغط : ابدا']);
  // « لقيت … » pour chaque nombre (1 à 25), avec et sans vidéos mises de côté (08/10/2026)
  for (let k = 1; k <= 25; k++) for (const x of [0, 1, 12]) voir(`trouve(${k}, ${x})`, TEXTES.trouve(k, x));
  // les vidéos écartées (deux vêtements alternés) : une, deux, cinq, un nom arabe ou très long, avec tout le reste
  for (const alt of [['video (12).mp4'], ['Videos/video (12).mp4', 'فيديو ٣.mp4'], ['a.mp4', 'b.mp4', 'c.mp4', 'd.mp4', 'e.mp4'], ['فيديو.mp4'], ['x'.repeat(80) + ' 12.mp4']]) voir(`trouve (alternées ${alt.length})`, TEXTES.trouve(4, 2, 1, alt));
  return out;
}
