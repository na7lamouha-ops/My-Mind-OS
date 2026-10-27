// ecom manita — CE QUE LE ROBOT DIT AU CLIENT. Tous les messages de la chaîne sont ICI, pour être relus
// d'un coup et contrôlés par l'épreuve contre la loi de forme : le texte en darija algérienne, les chiffres
// en français sur leur propre ligne, jamais un chiffre dans une ligne arabe, 36 caractères par ligne au plus
// (sauf un lien), les dinars toujours avec les dollars, la dernière ligne en darija.
// Mots proscrits : « تحوّس », « الكاس », « جوج » (on écrit « زوج »). Code original « ecom manita » — 03/10/2026.
// v0.3.8 (lot) : chaque message d'une mission née d'un lot porte en tête le modèle dont il parle (enteteModele),
// et les couleurs d'un modèle de lot sont nommées seules (couleurProche) puis annoncées (couleursAuto) — SAUF quand le
// client a dit « صحيح، بصح اللونات غالطين » sur sa photo (07/10/2026) : la même couleurQuestion qu'une mission seule,
// enteteModele en tête de la légende de chaque photo, puis couleursFinies.
// 09/10/2026 (décision du vendeur) : couleurQuestion à CHAQUE lot, avec la PROPOSITION de la chaîne (nommerSansFusion :
// jamais deux familles fusionnées, « Noir clair » / « Noir fonce » sinon le 2e nom de palette) et son bouton « صحيح » ;
// couleursCompte dit l'écart au nombre dit et les couleurs sans photo cadrée ; couleursAuto ne part plus.
// v0.3.8 (phase 2) : la page est publiée dès qu'elle est prête — la chaîne n'envoie plus pagePrete (ni ses boutons
// « نشرها » / « خليها مخبية ») : le client reçoit les photos de sa page, puis pagePubliee avec le lien. pagePrete et
// pageMasquee ne partent plus du tout : un vieux bouton d'un message d'avant reçoit seulement « هاذ السؤال فات »
// (missions.mjs surBouton) — surtout pas « الصفحة باقية مخبية » pour une page qui se publie. Elles restent ici, écrites
// dans la loi de forme, pour qu'un retour en arrière du vendeur n'ait rien à réécrire.
// v0.3.8 (phase 2, le scaling du vendeur) : le gagnant du test entre dans une campagne de SCALE en CBO (scalePrete,
// boutons « لانسي » / « ماشي دروك ») ; les hausses (porteScaling, budgetMonte) parlent du budget de la CAMPAGNE.
// Relu contre la source (06/10/2026, « casse ») : le bouton de hausse porte son jeton (le nouveau budget en centimes),
// une hausse ratée repose la même question (hausseRatee) au lieu du « حبس » qui arrêtait tout, scaleRate laisse la
// scale en pause (« ماشي دروك »), et scaleFermee dit au client qu'une porte refermée n'a rien laissé partir.
// Relu de bout en bout (07/10/2026) : scalePasEncore porte son propre « لانسي » (le « ماشي دروك » ne laisse plus la scale
// sans bouton), lectureRatee dit UNE fois qu'une lecture du soir n'a pas pu se faire, photosCourtes dit tôt et en clair
// qu'une page n'aura pas ses six photos (prises trop courtes).
import { nombre, ligneSure, sansMontant, creasLatin } from './accueil.mjs';
/** Une adresse LISIBLE pour le client (09/10/2026) : le slug d'une page Tassyir est souvent en arabe et revient parfois
 *  encodé (« %D8%B9%D8%A8… », un mur de pourcentages). On rend les lettres ; un caractère réservé (espace, /, ?, #, &, =,
 *  +, %) ou de contrôle reste encodé, pour que l'adresse s'ouvre toujours. L'encodage ASCII ne sert qu'au lien marqué
 *  qui part vers Meta (missions.mjs urlPourMeta, manita-testing.py lien_marque). */
export function urlLisible(u) {
  return String(u || '').replace(/(?:%[0-9A-Fa-f]{2})+/g, s => {
    // un caractère INVISIBLE ou de sens d'écriture (U+202E « RLO », U+200F, U+2066…, U+061C, U+FEFF) reste encodé
    // (10/10/2026, « casse ») : décodé, il retournerait la ligne dans Telegram et le client lirait une autre adresse
    try { const d = decodeURIComponent(s); return /[\s\/?#%&=+\x00-\x1f\x7f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(d) ? s : d; } catch { return s; }
  });
}
/** « 1 video » / « 3 videos » (une ligne latine) : jamais « 1 videos ». */
const videosLatin = n => (+n === 1 ? '1 video' : `${n} videos`);

const da = (v, taux) => `${nombre(v)} DA = ${taux > 0 ? nombre(Math.round(v / taux)) : '?'} $`;
const usd = (v, taux) => `${nombre(v)} $ = ${taux > 0 ? nombre(Math.round(v * taux)) : '?'} DA`;
export const PALETTE = [
  { v: 'Noir', ar: 'أسود', hex: '#141414' }, { v: 'Blanc', ar: 'أبيض', hex: '#f5f5f2' }, { v: 'Beige', ar: 'بيج', hex: '#d8c3a5' },
  { v: 'Gris', ar: 'رمادي', hex: '#8c8c8c' }, { v: 'Marron', ar: 'ماروني', hex: '#6b4a32' }, { v: 'Camel', ar: 'كاميل', hex: '#b5895a' },
  { v: 'Bleu', ar: 'أزرق', hex: '#2f5fa8' }, { v: 'Marine', ar: 'بلو مارين', hex: '#1f2a44' }, { v: 'Vert', ar: 'أخضر', hex: '#3f7d4e' },
  { v: 'Kaki', ar: 'كاكي', hex: '#7a7a52' }, { v: 'Rouge', ar: 'أحمر', hex: '#b3261e' }, { v: 'Bordeaux', ar: 'بوردو', hex: '#6d1a2a' },
  { v: 'Rose', ar: 'روز', hex: '#e8a3b5' }, { v: 'Mauve', ar: 'موف', hex: '#8e6bb0' }, { v: 'Jaune', ar: 'أصفر', hex: '#e6c229' },
  { v: 'Orange', ar: 'أورونج', hex: '#e07a2e' }
];

export const M = {
  driveFini: (n, go) => ({ texte: ['جبت الفيديوات من الدرايف', 'عدد الفيديوات و الحجم :', `${n} videos · ${String(go).replace('.', ',')} Go`, 'دروك نفرزو اللونات'].join('\n') }),
  lotDrive: (n, go) => ({ texte: ['جبت الفيديوات من الدرايف', 'عدد الفيديوات و الحجم :', `${n} videos · ${String(go).replace('.', ',')} Go`, 'دروك نفرزو الموديلات وحدنا', 'نبعثلك التصاور كي نكملو'].join('\n') }),
  couleursAuto: noms => ({ texte: ['اللونات لي لقيت في الفيديوات :', ...lignesLatines(noms), 'المونتاج بدا، يدّي شوية وقت', 'نعلمك كي يكمل'].join('\n') }),
  driveVide: () => ({ texte: ['الدوسي جا فارغ', 'ولا ماشي مفتوح للناس', 'في درايف : بارتاج،', 'كل واحد عندو اللينك', 'ومن بعد ابعث اللينك من جديد'].join('\n') }),
  /** La question d'une couleur (une photo par famille). 09/10/2026 (décision du vendeur) : posée À CHAQUE LOT ; le nom que
   *  la chaîne a trouvé n'est plus qu'une PROPOSITION (« propose », ligne latine) que le client valide d'un « صحيح » ou
   *  remplace par un bouton de la palette. sansPhoto : la famille n'a aucune photo cadrée (son aperçu est montré). */
  // [desc-bilan] 10/10/2026 (AVANCEMENT 22:25, pas de question en plus) : la PREMIÈRE photo de la question porte aussi le
  // nombre de familles trouvées et, s'il n'est pas juste, le nombre réel en boutons (ncoul) ; gen : la question refaite
  // après un nombre corrigé (ses boutons portent « g<gen> » : un bouton de l'ancienne question ne nomme jamais une
  // famille de la nouvelle). Sans opts : la question d'avant, mot pour mot.
  couleurQuestion: (idMission, rang, total, propose = null, sansPhoto = false, { gen = 0, nombre = null } = {}) => {
    const k = `coul${rang}${gen ? 'g' + gen : ''}`;
    const autres = nombre ? [1, 2, 3, 4, 5, 6, 7, 8].filter(n => n !== nombre) : [];
    return {
      texte: ['هاذ اللون واش اسمو ؟', ...(nombre ? ['لقيت في الفيديوات :', `${nombre} couleur(s)`, 'ماشي هاذا العدد ؟ اختار الصحيح'] : []),
        ...(sansPhoto ? ['ما لقيتلوش تصويرة كاملة', 'يبان في الفيديوات برك'] : []),
        ...(propose ? ['الاسم لي نقترح :', nomCouleurLatin(propose), 'إذا صحيح اضغط : صحيح'] : []),
        'ولا اختار من الأزرار تحت', `Couleur ${rang} / ${total}`, 'ولا : ماشي لون، حيّدها'].join('\n'),
      boutons: [...(propose ? [[{ texte: 'صحيح', data: `mis:${idMission}:${k}:PROPOSE` }]] : []),
        ...ligneDe(PALETTE.map(p => ({ texte: p.ar, data: `mis:${idMission}:${k}:${p.v}` })), 4),
        [{ texte: 'ماشي لون، حيّدها', data: `mis:${idMission}:${k}:EXCLURE` }],
        ...(autres.length ? ligneDe(autres.map(n => ({ texte: String(n), data: `mis:${idMission}:ncoul${gen}:${n}` })), 4) : [])]
    };
  },
  /** [desc-bilan] le client a corrigé le nombre de couleurs : les familles sont refaites avec ce nombre. */
  couleursRefaites: () => ({ texte: ['تمام، نعاودو نفرزو اللونات', 'بالعدد اللي قلتلي', 'نبعثلك التصاور من جديد'].join('\n') }),
  /** Avant les questions des couleurs, seulement quand il y a quelque chose à dire (09/10/2026, la loi du comptage) : le
   *  nombre trouvé, l'écart avec le nombre que le client a dit (dans les deux sens), les couleurs sans photo cadrée. */
  couleursCompte: (trouvees, dites, sansPhoto, vues = null) => ({ texte: ['لقيت في الفيديوات :', `${trouvees} couleur(s)`,
    ...(dites && dites !== trouvees ? [dites > trouvees ? 'قلتلي أكثر من هكا :' : 'قلتلي أقل من هكا :', `${dites} couleur(s)`, 'نكمّلو باللي لقيت'] : []),
    // 10/10/2026 (passe « casser ») : le nombre dit est gardé, mais l'outil seul en voit un autre — dit dans les deux sens
    ...(dites && vues && vues !== trouvees ? [vues > trouvees ? 'بصح شفت لونات أكثر :' : 'بصح شفت لونات أقل :', `${vues} couleur(s)`, vues > trouvees ? 'يمكن لونين في تصويرة وحدة' : 'يمكن لون واحد في زوج تصاور', 'شوف التصاور مليح'] : []),
    ...(sansPhoto > 0 ? ['لونات بلا تصويرة كاملة :', `${sansPhoto} couleur(s)`, 'يبانو في الفيديوات برك'] : []),
    'سمّي كل لون من التصاور تحت'].join('\n') }),
  couleursFinies: n => ({ texte: ['تمام، فهمت اللونات', 'عدد اللونات :', `${n} couleur(s)`, 'المونتاج بدا، يدّي شوية وقت', 'نعلمك كي يكمل'].join('\n') }),
  /** LE FILM REVU (09/10/2026) : une vidéo qui remontre du film déjà vu (le rush était trop court pour plus de 10 s de film
   *  différent) reste SAINE — elle n'arrête rien — mais ne part jamais en silence : le client lit, le nom du modèle sur sa
   *  ligne latine, si TOUTES ses vidéos saines en sont ou seulement une partie (revu = { n, nom }, n > 0). */
  montageFini: (ok, total, revu = null) => ({ texte: ['المونتاج كمل', 'الفيديوات الصالحين :', `${ok} / ${total}`,
    ...(revu && revu.n > 0 ? [revu.n >= ok ? 'ردّ بالك : الفيديوات كامل تاع' : 'ردّ بالك : شي فيديوات تاع', nomLatin(revu.nom),
      revu.n >= ok ? 'يعاودو يبيّنو نفس اللقطات' : 'يعاودو يبيّنو نفس اللقطات :', ...(revu.n >= ok ? [] : [`${revu.n} / ${ok} videos`]),
      'التصوير تاع هاذ الموديل قصير بزاف', 'شوفهم مليح قبل البوب'] : []),
    'هاذو شوية منهم تحت', 'إذا ما عجبوكش اضغط : حبس'].join('\n') }),
  boutonStop: idMission => [[{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]],
  /** « الطالب 1.0 » (fix 8) : la page masquée attend la décision du client (« نشرها » / « خليها مخبية »), comme en 0.3.7. */
  pagePrete: (idMission, lien) => ({
    texte: ['الصفحة واجدة في تسيير', 'وراهي مخبية على الناس', 'شوفها من هاذ اللينك :', urlLisible(lien), 'نشرها للزبونات ؟'].join('\n'),
    boutons: [[{ texte: 'نشرها', data: `mis:${idMission}:page:oui` }, { texte: 'خليها مخبية', data: `mis:${idMission}:page:non` }]]
  }),
  pageMasquee: () => ({ texte: ['تمام، الصفحة باقية مخبية', 'صلّحها في تسيير كيما تحب', 'و كي تكمل اضغط : نشرها'].join('\n') }),
  pagePubliee: lien => ({ texte: ['الصفحة راهي منشورة', 'هاذا اللينك تاعها :', urlLisible(lien), 'دروك نحضّرو البوب'].join('\n') }),
  porteOk: (be, taux) => ({ texte: ['الحساب تاع الربح، قبل البوب', 'أكبر حاجة تقدر تخلّصها', 'على كوموند وحدة :', da(be.par_commande, taux), 'فوقها راك تخسر', 'هاذا حساب على النسب لي قلتلي'].join('\n') }),
  porteFermee: (idMission, be, mini, taux) => ({
    texte: ['ردّ بالك، بهاذ السعر', 'راك تخسر في كل كوموند', 'الخسارة على كوموند :', da(Math.abs(be.par_commande), taux),
      'السعر لي يخليك ما تخسرش :', mini.prix ? da(mini.prix, taux) : '?', 'تحب نكمّلو برك ولا نحبسو ؟'].join('\n'),
    boutons: [[{ texte: 'نحبسو', data: `mis:${idMission}:porte:stop` }, { texte: 'كمّل على مسؤوليتي', data: `mis:${idMission}:porte:go` }]]
  }),
  campagnePrete: (idMission, b, taux, mode, placements, nbAnnonces) => ({
    texte: ['البوب واجدة وراهي محبوسة', 'ما تصرف والو قبل كلمتك', 'البودجي في النهار :', usd(b.total_usd, taux),
      'عدد الفيديوات في التيست :', `${nbAnnonces} videos`, 'الكوموند : ' + (mode === 'site' ? 'من الموقع' : 'بالميساج'),
      'البوب : ' + (placements === 'broad' ? 'برود' : 'ستوري و ريلز'), 'نلانسيها ؟'].join('\n'),
    boutons: [[{ texte: 'لانسي', data: `mis:${idMission}:lance:oui` }, { texte: 'ماشي دروك', data: `mis:${idMission}:lance:non` }]]
  }),
  pasEncore: () => ({ texte: ['تمام، البوب باقية محبوسة', 'وقت ما تحب اضغط : لانسي', 'في الرسالة لي فاتت'].join('\n') }),
  lancee: () => ({ texte: ['البوب راهي تخدم', 'نبعثلك التقرير كل ليلة', 'وما نبدّل والو بلا كلمتك'].join('\n') }),
  /** ARGENT (09/10/2026) : un compte Meta en mode brouillon rend PUBLISHING — la publication est EN COURS, ce n'est pas un échec.
   *  Le bureau relit lui-même quelques minutes plus tard ; jamais une deuxième activation. */
  activationEnCours: idMission => ({ texte: ['ميتا راهي تنشر البوب دروك', 'نتأكّدو منها بعد شوية وحدنا', 'ما نعاودو نشعّلو والو'].join('\n'), boutons: [[{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]] }),
  /** Meta a REFUSÉ la pub (rien d'actif, rien en attente) : dit, rien d'autre. « عاود » RELIT (une pub corrigée dans Meta passe). */
  activationRejetee: idMission => ({ texte: ['ميتا رفضت البوب', 'ما تصرف والو عليها', 'شوف السبب في ميتا وصلّحو', 'كي تصلّحو اضغط : عاود', 'نقراوها من جديد، ما نشعّلو والو'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]] }),
  /** Une partie tourne, une partie refusée par Meta : la pub est LANCÉE et suivie chaque soir, le client le sait. */
  publicationRefusPartiel: idMission => ({ texte: ['البوب راهي تخدم، بصح', 'ميتا رفضت شي حوايج فيها', 'شوفهم في ميتا وصلّحهم', 'نبعثلك التقرير كل ليلة'].join('\n'), boutons: [[{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]] }),
  /** Toujours « en cours de publication » après les relectures : on la suit quand même chaque soir (jamais d'argent sans suivi). */
  publicationLongue: idMission => ({ texte: ['ميتا مازال ما أكّدتش البوب كاملة', 'شوفها في ميتا كي تقدر', 'نتبعوها كل ليلة كيما العادة'].join('\n'), boutons: [[{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]] }),
  scaleEnCours: idMission => ({ texte: ['ميتا راهي تنشر السكيل دروك', 'نتأكّدو منو بعد شوية وحدنا', 'ما نعاودو نشعّلو والو'].join('\n'), boutons: [[{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]] }),
  scaleRejetee: () => ({ texte: ['ميتا رفضت كامباني السكيل', 'ما تصرف والو عليها', 'التيست باقي يخدم كيما هو', 'شوف السبب في ميتا'].join('\n') }),
  scaleRefusPartiel: () => ({ texte: ['السكيل راهو يخدم، بصح', 'ميتا رفضت شي حوايج فيه', 'شوفهم في ميتا وصلّحهم', 'نطلّعو البودجي غير بكلمتك'].join('\n') }),
  scalePublicationLongue: () => ({ texte: ['ميتا مازال ما أكّدتش السكيل كامل', 'شوفو في ميتا كي تقدر', 'نتبعوه كل ليلة كيما العادة'].join('\n') }),
  boutonScale: idMission => [[{ texte: 'لانسي', data: `mis:${idMission}:scale:oui` }]],
  /** QUOTA (09/10/2026) : la limite d'usage du compte Claude. UN message pour tout le bureau ; aucun essai perdu, la chaîne
   *  reprend seule à l'heure dite. heure : « 15:05 » (ou « 10/10 03:05 »), sur sa propre ligne latine. */
  quota: (heure, boutons = null) => ({ texte: ['كلود وصل للحد تاع الاستعمال', 'الخدمة واقفة شوية، ما ضاع والو', ...(heure ? ['نكمّلو وحدنا على :', String(heure)] : ['نكمّلو وحدنا من بعد شوية']), 'ما تدير والو، نكمّلو وحدنا'].join('\n'), ...(boutons ? { boutons } : {}) }),
  /** CONNECTEUR À RECONNECTER (09/10/2026, décision du coordinateur) : un connecteur claude.ai pas « connected » n'est jamais
   *  une panne. UN message pour tout le bureau ; « عاود » sonde tout de suite, et la chaîne reprend seule quand il revient. */
  connecteur: (cles, idBouton = null) => {
    // le JETON du serveur Meta local (09/10/2026) : rien à faire dans claude.ai, un jeton à recoller dans التحضير
    const jeton = (cles || []).includes('metaLocal');
    const lignesJeton = ['التوكن تاع ميتا ما بقاش يخدم', 'غالط، فات وقتو ولا ناقصو الحق', 'روح لـ التحضير في المكتب', 'لصق توكن جديد ودير الفحص'];
    if (jeton && !(cles || []).some(k => k === 'meta' || k === 'tassyir')) return { texte: [...lignesJeton, 'الخدمة واقفة، ما ضاع والو', 'نكمّلو وحدنا كي يرجع،', 'ولا اضغط : عاود'].join('\n'),
      ...(idBouton ? { boutons: [[{ texte: 'عاود', data: `mis:${idBouton}:cnx:1` }]] } : {}) };
    const noms = { meta: 'ميتا', tassyir: 'تسيير' }, c = [...new Set((cles || []).filter(k => noms[k]))];
    const tete = c.length > 1 ? ['الكونيكتورات تاع ميتا و تسيير', 'لازم يتعاودو يتربطو'] : [`الكونيكتور تاع ${noms[c[0]] || 'ميتا'}`, 'لازم يتعاود يتربط'];
    return { texte: [...tete, 'الخدمة واقفة، ما ضاع والو', 'روح لـ claude.ai، في :', 'Settings > Connectors', `وعاود اربط ${c.length > 1 ? 'ميتا و تسيير' : noms[c[0]] || 'ميتا'}`, ...(jeton ? lignesJeton : []), 'نكمّلو وحدنا كي يرجع،', 'ولا اضغط : عاود'].join('\n'),
      ...(idBouton ? { boutons: [[{ texte: 'عاود', data: `mis:${idBouton}:cnx:1` }]] } : {}) };
  },
  connecteurRevenu: () => ({ texte: ['الكونيكتور رجع يخدم', 'الخدمة رجعت تمشي وحدها', 'ما ضاع والو'].join('\n') }),
  /** « الطالب 1.0 » (fix 9) : les leads arrêtent, les confirmées jugent (la boussole) ; après VALIDE, les colis livrés. Avant 1.0 :
   *  la réponse « السلعة » changeait la base (les colis attendus avec stock). r.chiffres : des lignes latines (leads, plafond). */
  rapportJour: (r, taux) => ({ texte: [
    'التقرير تاع اليوم', 'المصروف :', da(r.depense_da, taux),
    'الكوموندات :', `recues ${r.commandes} · confirmees ${r.confirmees}`, `livrees ${r.livrees} · retours ${r.retours}`,
    ...(r.valide ? ['التاست VALIDE، دروك نحكمو', 'على الكوليات الموصلة'] : ['الليدات يوقفو التاست', 'والمأكدة هي اللي تحكم']),
    ...(r.chiffres || []), 'الحكم تاع البوصلة :', ...decoupe(r.decision_ar || 'نستناو شوية، مازال بكري') ].join('\n') }),
  /** ECHEC (ECHEC-ADS / ECHEC-CONF) : la pause automatique, relue, dite au client (décision 1.0). */
  disjoncteur: (tag = 'ECHEC-ADS') => ({ texte: ['حبسنا البوب وحدنا', `البوصلة حكمات : ${tag}`,
    ...(tag === 'ECHEC-CONF' ? ['التأكيد ما يخلّيش الربح', 'المؤكّد يعيّط ويقول الحقيقة', 'ونقراو أسباب الإلغاء'] : ['الإعلان ما جابش ليدات', 'بسومة تخلّي الربح', 'بدّل الفيديو ولا الزاوية']),
    'ومن بعد نعاودو'].join('\n') }),
  verdictValide: () => ({ texte: ['البوصلة حكمات : VALIDE', 'الموديل هاذا راهو يربح', 'حتى في أسوأ حالة', 'التاغ : VALIDE', 'دروك نحكمو على الكوليات', 'اللي توصل للزبون', 'والسكايل كي يتحل الباب'].join('\n') }),
  verdictFix: () => ({ texte: ['البوصلة حكمات : FIX', 'نربحو بصح التأكيد ضعيف', 'صلّح حاجة وحدة برك :', 'السعر في الفيديو', 'ولا الصفحة', 'ولا السكريبت تاع التأكيد', 'البوب تكمّل تخدم'].join('\n') }),
  /** RESERVE : le plafond du test est dépensé sans verdict sûr ; même boutons que l'ancienne « perte lourde ». */
  verdictReserve: idMission => ({ texte: ['البوصلة حكمات : RESERVE', 'وصلنا للحد تاع التاست', 'الكوموند تحت السقف', 'بصح ماشي مضمونة', 'نخدمو الطلبيات، ما نكبّروش', 'نحبسو البوب ؟'].join('\n'),
    boutons: [[{ texte: 'حبس البوب', data: `mis:${idMission}:perte:stop` }, { texte: 'خليها تخدم', data: `mis:${idMission}:perte:go` }]] }),
  /** La porte du scale (portes.mjs) est fermée : ce qui manque, une fois (jusqu'à ce qu'elle s'ouvre). */
  porteScaleFermee: conditions => ({ texte: ['باب السكايل مازال مسكّر', 'واش ناقص :', ...(conditions || []).filter(k => !k.ok).map(k => '❌ ' + k.ar), 'ما نطلّعو والو قبل', 'نعاودو نشوفو غدوة'].join('\n') }),
  /** Le scaling du vendeur (06/10/2026) : le gagnant du test dans une campagne de SCALE en CBO, par son post ID,
   *  créée EN PAUSE — le client la lance (comme le « لانسي » du test). */
  scalePrete: (idMission, budgetUsd, taux, nbAdSets) => ({
    texte: ['الموديل هاذا راهو يربح', 'حضّرنا كامباني السكيل', 'فيها الفيديو لي ربح في التيست', 'بنفس البوست و الكومونتار تاعو', 'وراهي محبوسة، ما تصرف والو',
      'البودجي تاع الكامباني في النهار :', usd(budgetUsd, taux), 'عدد الأد ست :', `${nbAdSets} ad set${nbAdSets > 1 ? 's' : ''}`, 'نلانسيها ؟'].join('\n'),
    boutons: [[{ texte: 'لانسي', data: `mis:${idMission}:scale:oui` }, { texte: 'ماشي دروك', data: `mis:${idMission}:scale:non` }]]
  }),
  /** « ماشي دروك » sur la scale (scalePrete ou scaleRate) : la scale reste EN PAUSE, et le client garde un « لانسي » —
   *  ici, sous ce message (07/10/2026 : le bouton de la question pouvait disparaître, la campagne restait en pause pour de bon). */
  scalePasEncore: idMission => ({ texte: ['تمام، السكيل باقي محبوس', 'ما يصرف والو قبل كلمتك', 'وقت ما تحب اضغط : لانسي', 'الزر راهو هنا تحت'].join('\n'),
    boutons: [[{ texte: 'لانسي', data: `mis:${idMission}:scale:oui` }]] }),
  scaleLance: () => ({ texte: ['السكيل راهو يخدم', 'نطلّعو البودجي شوية بشوية', 'وما نطلّع والو بلا كلمتك'].join('\n') }),
  /** La préparation de la scale (lecture, outil, création EN PAUSE) a calé : rien n'a été lancé, le bureau réessaie le soir d'après. */
  scaleEchec: raison => ({ texte: ['ما قدرتش نحضّر كامباني السكيل', 'ما تشعّل والو، ما تصرف والو', 'السبب :', ...decoupeLatin(raison), 'نعاودو غدوة وحدنا'].join('\n') }),
  /** La scale attend les 25 wilayas du vendeur, lues et CONFIRMÉES : rien n'est créé chez Meta. La raison technique,
   *  passée par decoupeLatin, perdait son arabe (« Met / a ( : « ») ») et ne disait pas quoi faire (07/10/2026, « casse »). */
  /** « لانسي » sur une campagne de scale montée avant la règle des wilayas : rien n'est allumé ; elle est relue au prochain soir. */
  scaleAncienne: () => ({ texte: ['كامباني السكيل تحضّرت من قبل', 'قبل ما نأكّدو الولايات', 'ما شعّلت والو، ما تصرف والو', 'نعاودو نشوفوها غدوة وحدنا', 'ونبعثلك لانسي جديد'].join('\n') }),
  wilayasManquentScale: () => ({ texte: ['ما قدرتش نحضّر كامباني السكيل', 'الولايات ماراهمش مأكّدين', 'ما بعثت والو لميتا', 'روح للمكتب، في التحضير اضغط :', 'جيب الولايات', 'ومن بعد في الإعدادات أكّدهم', 'نعاودو غدوة وحدنا'].join('\n') }),
  /** L'activation a calé. Le 2e bouton laisse la scale EN PAUSE (« ماشي دروك ») : un « حبس » ici arrêtait TOUTE la
   *  mission, le test qui gagne compris (relu le 06/10/2026, « casse »). */
  scaleRate: (idMission, raison) => ({
    texte: ['ما قدرتش نشعّل السكيل', 'السبب :', ...decoupeLatin(raison), 'نعاودو ؟'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:scale:oui` }, { texte: 'ماشي دروك', data: `mis:${idMission}:scale:non` }]]
  }),
  /** La porte du coach s'est refermée depuis la question (un vieux « لانسي » ou « واه، طلّع ») : rien ne part. */
  scaleFermee: () => ({ texte: ['الأرقام تبدّلو من بعد', 'الباب تاع السكيل تسكّر', 'ما شعّلنا والو، ما طلّعنا والو', 'كي يتحل الباب نبعثلك'].join('\n') }),
  /** La hausse porte sur le budget de la CAMPAGNE de scale (CBO), jamais sur ses ad sets. jeton : le nouveau budget en
   *  centimes, dans le bouton — le « واه، طلّع » d'une hausse d'AVANT ne pose jamais la hausse d'aujourd'hui. */
  /** 1.0 (fix 10) : le bouton dit « طلّع », le seul mot de la hausse (avant : « واه، طلّع » ; « واه » seul ne vaut rien). */
  porteScaling: (idMission, budgetActuel, budgetNouveau, taux, jeton) => ({
    texte: ['السكيل راهو يربح', 'الشروط تاع الزيادة كاملة', 'البودجي تاع الكامباني دروك :', usd(budgetActuel, taux), 'البودجي الجديد :', usd(budgetNouveau, taux), 'نطلّعو البودجي ؟'].join('\n'),
    boutons: [[{ texte: 'طلّع', data: `mis:${idMission}:monte:oui.${jeton}` }, { texte: 'لا، استنى', data: `mis:${idMission}:monte:non.${jeton}` }]]
  }),
  /** La hausse a calé (Meta, relecture) : la même question, les mêmes boutons — jamais le « حبس » qui arrête tout. */
  hausseRatee: (idMission, raison, jeton) => ({
    texte: ['ما قدرتش نطلّع البودجي', 'السبب :', ...decoupeLatin(raison), 'نعاودو ؟'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:monte:oui.${jeton}` }, { texte: 'لا، استنى', data: `mis:${idMission}:monte:non.${jeton}` }]]
  }),
  budgetMonte: (b, taux) => ({ texte: ['طلّعنا البودجي تاع الكامباني', 'البودجي الجديد في النهار :', usd(b, taux), 'نشوفو النتيجة بعد زوج أيام'].join('\n') }),
  /** Avec stock (08/10/2026) on parle du COLIS attendu ; un coût nul (tout est revenu, aucun colis attendu) ne se montre
   *  jamais « 0 DA » : on dit qu'aucun colis n'est attendu. */
  perteLourde: (idMission, cout, be, taux, stock = 'test') => ({
    texte: (stock === 'stock'
      ? (cout > 0
        ? ['ردّ بالك : الكولي لي نستناو يوصل', 'يكلّف أكثر من لي تقدر تخلّص', 'الكولي يكلّف :', da(cout, taux), 'الحد تاعك على الكولي :', da(be, taux), 'نحبسو البوب ؟']
        : ['ردّ بالك : البوب راهي تصرف', 'وما كاين حتى كولي نستناوه يوصل', 'حتى كولي ما وصل لدروك', 'الحد تاعك على الكولي :', da(be, taux), 'نحبسو البوب ؟'])
      : ['ردّ بالك : الكوموند راهي تكلّف', 'أكثر من لي تقدر تخلّص', 'الكوموند تكلّف :', da(cout, taux), 'الحد تاعك :', da(be, taux), 'نحبسو البوب ؟']).join('\n'),
    boutons: [[{ texte: 'حبس البوب', data: `mis:${idMission}:perte:stop` }, { texte: 'خليها تخدم', data: `mis:${idMission}:perte:go` }]]
  }),
  production: (lignes, plate) => ({ texte: ['الموديل جاب كوموندات بزاف', 'وقت تحضّر اللوط الأول', 'البون تاع الأتولييه :',
    ...lignes.slice(0, 9).flatMap((l, i) => [...(i && i % 3 === 0 ? ['و :'] : []), `${(String(l.reference).replace(/[\u0600-\u06FF]+/g, '').trim() || 'ref ' + (i + 1)).slice(0, 18)} : ${l.pieces} pcs`]),
    ...(plate ? ['ردّ بالك : الكوموند مسطّحة'] : []), 'وكي توصل السلعة نطلّعو البودجي'].join('\n') }),
  /** Le budget du jour (partagé entre les modèles d'un lot, ou celui d'une mission seule) ne paie pas un ad set à 7 $. */
  // LES CRÉAS DU TEST (08/10/2026) : le client choisit de un à quatre par lien ; on lui dit quand le test part avec MOINS
  // que son choix (vidéos saines trop peu, ou budget du jour trop court), quand un test d'avant à plus de quatre vidéos est
  // refait (son ancienne campagne reste en pause, rien n'est supprimé) et quand une campagne reprise porte des ad sets en trop.
  creasMoins: (choisi, saines) => ({ texte: ['ردّ بالك على الكريات', 'اخترت :', creasLatin(choisi), 'الفيديوات الصالحين برك :', videosLatin(saines), 'نديرو التيست بلي كاين'].join('\n') }),
  creasPlafond: (choisi, n) => ({ texte: ['البودجي تاع النهار ما يكفيش', 'للكريات لي اخترت :', creasLatin(choisi), 'البودجي يكفي غير لـ :', creasLatin(n), 'تقدر تطلّعو في الإعدادات'].join('\n') }),
  testRefait: k => ({ texte: ['التيست لي تحضّر من قبل', 'فيه فيديوات كثر من أربعة', 'نحضّرو تيست جديد محبوس', 'عدد الكريات دروك :', creasLatin(k), 'الكامباني القديمة :', 'تبقى محبوسة، ما مسحنا والو', 'كي يكون واجد نسقسيك : لانسي'].join('\n') }),
  adSetsEnTrop: n => ({ texte: ['الكامباني فيها آدسات زايدين', 'عدد الآدسات الزايدين :', `${n} ad sets`, 'خليناهم محبوسين، ما مسحنا والو', 'نشعلو غير تاع التيست'].join('\n') }),
  budgetCourt: (parts, plafondDa, taux) => ({ texte: ['البودجي تاع النهار ما يكفيش', ...(parts > 1 ? ['مقسوم على الموديلات :', `${parts} modeles`, 'لكل موديل :'] : ['البودجي تاع النهار :']), da(plafondDa, taux),
    'لازم ثلاثة دولار على الأقل', 'ما درنا والو في ميتا', 'طلّع البودجي في الإعدادات', 'ومن بعد اضغط : عاود'].join('\n') }),
  /** La lecture du soir n'a pas pu se faire (Meta, Tassyir, Claude), même après les essais du soir : UN message, la pub ne
   *  change pas, le bureau relit le soir d'après tout seul ; « عاود دروك » refait une lecture tout de suite (07/10/2026).
   *  Le nombre d'essais est dit JUSTE (« casse ») : trois, deux ou un (heure du rapport tardive, PC allumé tard), ou la
   *  lecture que le client vient de demander. */
  lectureRatee: (idMission, raison, { essais = 3, demandee = false } = {}) => ({
    texte: ['ما قدرتش نقرا الأرقام تاع اليوم', demandee ? 'عاودت كيما طلبت وما مشاتش' : essais >= 3 ? 'جرّبت ثلاث مرات وما مشاتش' : essais === 2 ? 'جرّبت زوج مرات وما مشاتش' : 'جرّبت مرة وحدة وما مشاتش',
      'السبب :', ...decoupeLatin(raison), 'البوب ما تبدّل فيها والو', 'نعاودو غدوة وحدنا،', 'ولا اضغط : عاود دروك'].join('\n'),
    boutons: [[{ texte: 'عاود دروك', data: `mis:${idMission}:lecture:1` }]]
  }),
  /** Les photos de la page : moins de six, même après les relances serrées des captures (prises trop courtes, modèle jamais
   *  en entier). Dit TÔT (juste après les captures, avant le montage) et en clair (07/10/2026). */
  /** [v0.3.9-photos] La page prend des images tirées des vidéos : toutes (n null, le Drive a des photos mais sans couleur
   *  lisible dans leur nom), ou n pour compléter les couleurs sans photo (manquent : leurs noms, lignes latines). */
  photosDesVideos: (n, manquent = []) => ({ texte: [n === null ? 'التصاور تاع الدرايف ما عرفتش لونهم' : 'شي تصاور تاع الصفحة', n === null ? 'سمّي التصاور باللون، مثلا :' : 'خذيتهم من الفيديوات :',
    n === null ? 'Robe_noir_01.jpg' : `${n} photo(s)`, ...(manquent.length ? ['اللونات لي ما عندهمش تصاور :', ...lignesLatines(manquent)] : []),
    n === null ? 'هاذ المرة خذيت تصاور الفيديوات' : 'التصاور تاع الشوتينغ أحسن', 'تقدر تبدّلهم من بعد في تسيير'].join('\n') }),
  photosCourtes: (idMission, n) => ({
    texte: ['ما خرجوش تصاور كافيين للصفحة', 'الصفحة لازمها ستة تصاور', 'التصاور لي قدرت نخرّج :', `${n} / 6 photos`, 'الفيديوات قصار بزاف،', 'ولا الموديلة ما تبانش كاملة', 'ابعث فيديوات أطول في لينك جديد', 'وهاذا الموديل اضغط : حبس'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** Les couleurs DÉSÉQUILIBRÉES (09/10/2026) : une couleur a trop peu de photos pour alterner (jamais deux fois la même
   *  couleur à la suite), même après les relances de ses captures. Les noms des couleurs sur une ligne latine, les nombres
   *  sur leur ligne sous la darija. */
  couleursPauvres: (idMission, pauvres, compte) => ({
    texte: ['الألوان ما راهمش متساويين', 'هاذ اللون ما تصوّرش بزاف :', ...(lignesLatines(pauvres).length ? lignesLatines(pauvres) : ['?']), 'عاودت التصاور تاعو وما كفاوش', 'التصاور لي خرجو :',
      ...(compte || []).map(([n, k]) => `${String(n).replace(/[؀-ۿ\d]/g, '').trim().slice(0, 28) || '?'} ${k}`).reduce((ls, x) => { const t = ls.length ? `${ls[ls.length - 1]} · ${x}` : x; if (ls.length && t.length <= 36) ls[ls.length - 1] = t; else ls.push(x); return ls; }, []).slice(0, 3), 'ما نقدرش نحط زوج تصاور', 'من نفس اللون ورا بعضاهم', 'ابعث فيديوات أطول لهاذ اللون', 'في لينك جديد، ولا اضغط : حبس'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** Les 25 wilayas du vendeur ne sont pas lues ou pas confirmées : la campagne n'est PAS créée (jamais tout le pays). */
  wilayasManquent: idMission => ({
    texte: ['الولايات تاع التيست ماراهمش مأكّدين', 'ما بعثت والو لميتا', 'روح للمكتب، في التحضير اضغط :', 'جيب الولايات', 'ومن بعد في الإعدادات أكّدهم', 'كي تكمل اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** Une campagne de test DÉJÀ chez Meta (montée par une version d'avant les wilayas, ou reprise) dont un ad set ne vise pas
   *  — ou pas sûrement — les wilayas confirmées : rien n'est allumé ; le client corrige dans Meta puis « عاود ». */
  campagneAncienne: idMission => ({
    texte: ['الكامباني تاع التيست موجودة في ميتا', 'ما قدرتش نتأكّد بلي تمشي', 'على الولايات لي أكّدت برك', 'ما شعّلت والو', 'روح لميتا، وفي كل أد سات', 'حط الولايات المأكّدين برك', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** 09/10/2026 : un objet CRÉÉ (campagne, ad set, annonce) relu chez Meta autrement qu'EN PAUSE (un compte en mode
   *  brouillon le montrait ACTIVE) : l'étape refuse, rien n'est allumé ; le client le remet en pause dans Meta puis « عاود ». */
  creeNonPause: idMission => ({
    texte: ['ميتا بيّنت حاجة خدّامة في التيست', 'وهي لازم تكون محبوسة', 'ما شعّلت والو وما تصرف والو', 'روح لميتا وحبس الكامباني', 'والآدسات والإعلانات تاعها', 'ما تضغطش نشر في ميتا', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** casse-4 : une PUBLICATION ou une ACTIVATION est partie PENDANT la création (aucune porte « لانسي ») : l'étape refuse,
   *  rien n'est noté ; le client met la campagne en pause dans Meta puis « عاود ». */
  activeeACreation: idMission => ({
    texte: ['حاجة تشعّلت في ميتا', 'كي كنا نبنيو التيست', 'وانت ما ضغطتش لانسي', 'روح لميتا وحبس الكامباني', 'والآدسات والإعلانات تاعها', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  scaleActiveeACreation: () => ({ texte: ['حاجة تشعّلت في ميتا', 'كي كنا نبنيو السكيل', 'وانت ما ضغطتش لانسي', 'حبسها في ميتا', 'ونعاودو نشوفوها غدوة'].join('\n') }),
  scaleNonPause: () => ({ texte: ['كامباني السكيل بانت خدّامة', 'وهي لازم تكون محبوسة', 'ما شعّلت والو وما تصرف والو', 'حبسها في ميتا', 'ونعاودو نشوفوها غدوة'].join('\n') }),
  /** 09/10/2026 : deux campagnes (ou plus) portent la clé ou le même nom, et aucune n'a son id dans la mission : on ne
   *  choisit JAMAIS (ni la plus récente, ni par le nom) ; le client garde une seule campagne dans Meta puis « عاود ». */
  homonymes: idMission => ({
    texte: ['لقيت زوج كامبانيات بنفس الاسم', 'ما نختارش وحدة على حساب الاسم', 'ما شعّلت والو وما بدّلت والو', 'روح لميتا وخلّي غير وحدة', 'ولا بدّل اسم الأخرى', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  scaleHomonymes: () => ({ texte: ['لقيت زوج كامبانيات سكيل', 'بنفس الاسم في ميتا', 'ما نختارش وحدة على حساب الاسم', 'خلّي غير وحدة في ميتا', 'ونعاودو نشوفوها غدوة'].join('\n') }),
  /** 09/10/2026 : la description stockée chez Tassyir est abîmée (balises échappées, image manquante, bloc JSON) même après
   *  une reprise : la page reste CACHÉE, rien n'est publié. */
  descriptionAbimee: idMission => ({
    texte: ['الوصف تاع الصفحة تسجّل خاطئ', 'التصاور بانو كتابة في بلاصتهم', 'عاودناه مرة وبقا خاطئ', 'الصفحة راهي مخبية، ما نشرنا والو', 'شوف الوصف في تسيير وصلّحو', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** [desc-bilan] 10/10/2026 : la description n'a pas pu être RELUE chez Tassyir après son envoi seul, même après un
   *  nouvel envoi : sans relecture la page ne sort jamais (elle reste CACHÉE, rien publié). */
  descriptionNonRelue: idMission => ({
    texte: ['بعثنا الوصف تاع الصفحة وحدو', 'بصح ما قدرناش نقراوه في تسيير', 'عاودنا مرة وما قريناهش', 'الصفحة راهي مخبية، ما نشرنا والو', 'شوف الوصف في تسيير', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** [casse-5] 10/10/2026 : l'étape publication a RENVOYÉ la description (avec isActive) et Tassyir l'a stockée de travers
   *  (ou elle n'a pas pu être relue) : la page est peut-être en ligne avec une description abîmée — rien n'est annoncé « منشورة ». */
  descriptionRetouchee: idMission => ({
    texte: ['كي نشرنا الصفحة تبعث الوصف تاني', 'وتسجّل خاطئ في تسيير', 'الصفحة تقدر تكون ظاهرة هكا', 'شوف الوصف في تسيير وصلّحو', 'ومن بعد اضغط : عاود'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** [desc-bilan] 10/10/2026 — LE BILAN DU LOT : quand plus aucun modèle du lot n'est en route vers sa page (page publiée,
   *  ou arrêté), UN message : combien de modèles trouvés, combien de pages sorties avec le LIEN de chacune (urlLisible),
   *  et chaque modèle sans page NOMMÉ avec sa raison courte. Recompté et renvoyé quand un « عاود » fait sortir une page.
   *  pages = [{nom, url}], sans = [{nom, raison}] (raison : une ligne darija, sans chiffre). */
  bilanLot: ({ trouves, pages = [], sans = [], lectureSeule = false }) => {
    const nomL = n => { const t = String(n || '').replace(/\s+/g, ' ').trim(); return /[؀-ۿ]/.test(t) ? null : (t.replace(/\bDA\b/g, 'Da').slice(0, 36) || 'Modele'); };
    const l = ['الحصيلة تاع هاذ اللوط', 'شحال من موديل لقينا :', `Modeles trouves : ${trouves}`, 'شحال من صفحة خرجت :', `Pages sorties : ${pages.length}`];
    // [anonymat] 10/10/2026 : une seule lecture des planches vérifiée — le bilan le dit (les modèles, eux, ont été confirmés sur photo)
    if (lectureSeule) l.splice(3, 0, 'قراية وحدة برك اللي تصحّات', 'وكل موديل أكدتو على تصويرتو');
    for (const p of pages) { const n = nomL(p.nom); l.push(n ? 'الصفحة تاع :' : ligneSure('الصفحة تاع : ' + p.nom)); if (n) l.push(n); l.push(p.url ? urlLisible(p.url) : 'الرابط ما بانش، شوفو في تسيير'); }
    if (sans.length) { l.push('هاذو ما خرجتلهمش صفحة :'); for (const x of sans) { const n = nomL(x.nom); l.push(n || ligneSure(x.nom)); l.push(ligneSure(x.raison || 'وقف')); } }
    l.push(sans.length ? 'اللي وقف عندو زر عاود في رسالتو' : 'كامل الصفحات خرجو، نكملو الخدمة');
    return { texte: l.join('\n') };
  },
  /** [porte-groupee] 10/10/2026 — LA PORTE « لانسي » DU LOT : UNE question pour tous les modèles prêts (campagnes en pause).
   *  Chaque modèle prêt avec son heure de début « HH:MM » (null = tout de suite), les modèles tombés nommés (hors porte, ils
   *  sont dans le bilan), le total par jour en USD ET en DA, et UNE ligne : l'heure programmée ne protège pas de la dépense,
   *  elle la décale. prets = [{nom, heure}], tombes = [nom]. idRef : un modèle prêt (le bouton passe par sa mission). */
  porteLot: ({ prets = [], tombes = [], totalUsd = 0, taux = 0, reprises = 0 }, idRef, gen) => {
    const l = ['البوب تاع اللوط واجدة ومحبوسة', 'ما تصرف والو قبل كلمتك',
      // [v19-trois] une porte neuve qui REPREND les modèles prêts des autres questions « لانسي » (fermées) : dit, une seule question
      ...(reprises > 0 ? ['سكّرت الأسئلة تاع لانسي لي قبل', 'والموديلات تاعهم راهم هنا', 'جاوب على هاذ السؤال برك'] : []), ...lignesHeures(prets)];
    if (tombes.length) { l.push('هاذو طاحو، ماهمش في هاذ السؤال :'); for (const n of tombes) { const x = nomL(n); l.push('طاح :'); l.push(x || ligneSure(n)); } }
    l.push('البودجي في النهار لكامل الموديلات :', usd(totalUsd, taux));
    if (prets.some(p => p.heure)) l.push('الساعة ما تحبسش المصروف، تأخّرو برك');
    l.push(prets.length > 1 ? 'نلانسيوهم كامل ؟' : 'نلانسيها ؟');
    return { texte: l.join('\n'), boutons: [[{ texte: 'لانسي', data: `mis:${idRef}:lanceg:${gen}.oui` }, { texte: 'ماشي دروك', data: `mis:${idRef}:lanceg:${gen}.non` }]] };
  },
  /** [v19-trois] « الغي » tapé SANS fiche ouverte : TOUTES les questions « لانسي » ouvertes sont fermées (rien activé, rien
   *  supprimé chez Meta, les campagnes restent en pause) ; chaque question fermée garde un bouton « سقسيني » (son nom de modèle)
   *  pour se rouvrir plus tard, comme une porte refusée. fermees = [{ nom, data }] ; aucune → on le dit. */
  portesAnnulees: (fermees = []) => {
    if (!fermees.length) return { texte: ['ما كان حتى سؤال تاع لانسي مفتوح', 'ما بدّلت والو', 'ابعث لينك جديد وقت ما تحب'].join('\n') };
    const l = ['تمام، سكّرت كامل الأسئلة تاع لانسي', 'والو ما تشعّل، والو ما تمسح في ميتا', 'البوب باقية محبوسة كيما كانت', 'وقت ما تحب تعاود، اضغط على',
      'الموديل لي تحب نسقسيك عليه'];
    return { texte: l.join('\n'), boutons: fermees.map(f => [{ texte: ('سقسيني : ' + (nomL(f.nom) || 'Modele')).slice(0, 40), data: f.data }]) };
  },
  /** [v19-trois] Un modèle seul prêt pendant qu'une autre question « لانسي » attend : il n'en ouvre jamais une deuxième. */
  attendQuestion: () => ({ texte: ['موديل آخر واجد ومحبوس', 'ما نسقسيكش عليه دروك', 'نسقسيك كي تجاوب على سؤال لانسي', 'لي راهو مفتوح قبلو'].join('\n') }),
  /** [v19-trois] LE PIXEL CHOISI n'est pas sur le compte de ce modèle (relu chez Meta) : REFUS, rien n'est créé, la question
   *  reposée avec les pixels du compte (un bouton par pixel, huit au plus). */
  pixelAbsent: (idMission, voulu, noms = []) => ({
    texte: ['البيكسل لي ختارت ماكانش', 'في الكونت تاع هاذ الموديل :', `pixel : ${String(voulu || '?').replace(/[؀-ۿ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28) || '?'}`, 'ما صاوبنا والو في ميتا',
      'اختار بيكسل من الكونت :'].join('\n'),
    boutons: [...ligneDe(noms.map((n, i) => ({ texte: String(n).slice(0, 32) || '?', data: `mis:${idMission}:pixel:${i}` })), 2), [{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  /** « ماشي دروك » sur la porte du lot : rien ne part, le groupe est libéré ; une porte neuve (heures recalculées) au bouton. */
  porteLotPasEncore: (idRef, gen) => ({ texte: ['تمام، والو ما خرج', 'البوب كامل باقية محبوسة', 'وقت ما تحب اضغط : سقسيني', 'ونعاودو نحسبو الساعات'].join('\n'),
    boutons: [[{ texte: 'سقسيني', data: `mis:${idRef}:lanceg:${gen}.neuve` }]] }),
  /** La validation est arrivée plus tard que prévu : les heures recalculées depuis la validation, redites (ce sont elles qui partent). */
  porteLotHeures: prets => ({ texte: ['الساعات تبدّلو، لانسيت من بعد', 'هاذي هي الساعات لي تتحطّ في ميتا :', ...lignesHeures(prets), 'نبداو نشعّلو واحد بواحد'].join('\n') }),
  /** Un test lancé avec une heure de début posée et relue : il tourne et dépense à partir de cette heure. */
  lanceeProgrammee: hhmm => ({ texte: ['البوب راهي مبرمجة في ميتا', 'تبدا تخدم و تصرف في :', String(hhmm || '?').replace(/[؀-ۿ]/g, '').slice(0, 36), 'نبعثلك التقرير كل ليلة', 'وما نبدّل والو بلا كلمتك'].join('\n') }),
  /** L'heure de début n'a pas été posée (ou pas relue) avant l'activation : la pub peut dépenser dès maintenant. */
  heureNonPosee: idMission => ({ texte: ['ردّ بالك، الساعة ما تحطّتش', 'البوب تقدر تبدا تصرف دروك', 'شوف الساعة في ميتا', 'وإذا تحب حبسها اضغط : حبس'].join('\n'),
    boutons: [[{ texte: 'حبس', data: `mis:${idMission}:stop:1` }]] }),
  /** [v0.3.9-meta] Une erreur de configuration du compte Meta, dite en darija avec l'action (cle : erreurMetaConnue). */
  erreurMeta: (idMission, cle, compte = '') => {
    const nom = nomL(compte);
    const dit = {
      paiement: ['الكونت تاع البوبليسيتي', ...(nom ? [nom] : []), 'ما فيهش كارطة دفع', 'زيد كارطة في ميتا، في :', 'Facturation et paiements'],
      impaye: ['الكونت تاع البوبليسيتي', ...(nom ? [nom] : []), 'عندو خلاص ما تخلّصش', 'خلّصو في ميتا، في :', 'Facturation et paiements'],
      desactive: ['الكونت تاع البوبليسيتي', ...(nom ? [nom] : []), 'ميتا حبساتو ولا سكّراتو', 'شوف في ميتا، في :', 'Qualité du compte', 'ولا اختار كونت آخر في لينك جديد'],
      limite: ['الكونت تاع البوبليسيتي', ...(nom ? [nom] : []), 'وصل الحد تاع المصروف', 'بدّل الحد في ميتا، في :', 'Limite de dépenses du compte'],
      droits: ['ميتا ما عطاتش الحق', 'على الكونت ولا الصفحة', 'شوف الأدوار في ميتا، في :', 'Paramètres de l entreprise']
    }[cle] || ['ميتا رفضت الخدمة'];
    return { texte: ['ميتا رفضت، والسبب معروف :', ...dit, 'ما ضاعت حتى محاولة', 'كي تصلّح، اضغط عاود'].join('\n'),
      boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]] };
  },
  echec: (idMission, etapeAr, raison) => ({
    texte: ['صرا مشكل في الخدمة', 'المرحلة : ' + etapeAr, 'السبب :', ...decoupeLatin(raison), 'نعاودو ؟'].join('\n'),
    boutons: [[{ texte: 'عاود', data: `mis:${idMission}:reprendre:1` }, { texte: 'حبس', data: `mis:${idMission}:stop:1` }]]
  }),
  arretee: () => ({ texte: ['تمام، حبسنا هاذ الموديل', 'ما بقا والو يخدم عليه', 'والبوب إذا كانت تخدم،', 'راني حبستها'].join('\n') })
};

/** L'en-tête d'un message d'une mission née d'un LOT : le client voit DE QUEL modèle on parle (deux lignes,
 *  le numéro sur sa ligne latine). Une mission seule n'a pas d'en-tête : ses messages restent ceux d'avant. */
export function enteteModele(lot) {
  if (!lot) return [];
  const nom = sansMontant(String(lot.nom || '').replace(/\s+/g, ' ').trim());
  const num = `Modele ${lot.rang} / ${lot.total}`;
  if (nom && /[؀-ۿ]/.test(nom)) return [ligneSure('الموديل : ' + nom), num];
  return ['الموديل :', (nom ? `${num} · ${nom.replace(/[؀-ۿ]/g, '')}` : num).slice(0, 36)];
}
/** Le nom d'un modèle sur UNE ligne latine (aucune lettre arabe, 36 caractères au plus) ; sans nom latin : « Modele ». */
export function nomLatin(nom) {
  const t = String(nom || '').replace(/[؀-ۿ]/g, '').replace(/\s+/g, ' ').trim();
  return /[A-Za-z]/.test(t) && t.toLowerCase() !== 'auto' ? t.slice(0, 36) : 'Modele';
}
/** Des mots latins (noms de couleurs) en lignes de 36 caractères au plus, séparés par « · », sans chiffres. */
export function lignesLatines(mots) {
  const out = []; let l = '';
  for (const m of (mots || []).map(x => String(x).replace(/[؀-ۿ\d]/g, '').trim()).filter(Boolean)) { const t = l ? `${l} · ${m}` : m; if (t.length > 36 && l) { out.push(l); l = m.slice(0, 36); } else l = t.slice(0, 36); }
  if (l) out.push(l);
  return out.length ? out : ['?'];
}
/** Un nom de couleur sur une ligne latine (sans chiffre, 36 caractères au plus). */
export const nomCouleurLatin = n => String(n || '?').replace(/[؀-ۿ\d]/g, '').replace(/\s+/g, ' ').trim().slice(0, 36) || '?';
const labDe = ([r, g, b]) => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [r, g, b].map(lin);
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const hexRgbDe = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** Les noms de la palette, du plus proche au plus loin d'un centre RGB (distance Lab), les permis d'abord. */
export function couleursProches(rgb, noms = PALETTE.map(p => p.v)) {
  const cible = labDe((rgb || [128, 128, 128]).map(Number));
  const d = p => { const q = labDe(hexRgbDe(p.hex)); return Math.hypot(q[0] - cible[0], q[1] - cible[1], q[2] - cible[2]); };
  const permis = PALETTE.filter(p => noms.includes(p.v)).sort((a, b) => d(a) - d(b)).map(p => p.v);
  return [...permis, ...PALETTE.filter(p => !permis.includes(p.v)).sort((a, b) => d(a) - d(b)).map(p => p.v)];
}
/** LE NOMMAGE SANS AUCUNE FUSION (09/10/2026, recette du vendeur) : chaque famille mesurée garde SON nom. Deux familles qui
 *  tombent sur le même nom de palette ne fusionnent jamais : la seconde prend « <nom> clair » ou « <nom> fonce » selon sa
 *  luminance (L* de Lab, comparée à celle qui a déjà le nom), sinon le deuxième nom de palette le plus proche encore
 *  libre ; jamais un chiffre. Rend un nom par famille, dans l'ordre reçu (familles : [{centre}]). */
/** L'écart (Lab) entre un centre RGB et un nom de la palette. */
const ecartPalette = (rgb, nom) => { const p = PALETTE.find(x => x.v === nom); if (!p) return Infinity; const a = labDe((rgb || [128, 128, 128]).map(Number)), b = labDe(hexRgbDe(p.hex)); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
/** Au-delà de cet écart de plus que le plus proche de toute la palette, une couleur VUE par Claude n'est pas celle de la
 *  famille (une couleur qu'il n'a pas vue : un rouge parmi « Noir, Beige » n'est pas « Beige ») — 10/10/2026, passe « casser ». */
const ECART_VUE_MAXI = 20;
export function nommerSansFusion(familles, noms = PALETTE.map(p => p.v)) {
  const pris = new Map(); const out = [];
  for (const f of familles || []) {
    const tous = couleursProches(f.centre), L = labDe((f.centre || [128, 128, 128]).map(Number))[0];
    const vue = couleursProches(f.centre, noms)[0];
    const base = ecartPalette(f.centre, vue) - ecartPalette(f.centre, tous[0]) > ECART_VUE_MAXI ? tous[0] : vue;
    let nom = null;
    if (!pris.has(base)) nom = base;
    else {
      const dL = L - pris.get(base);
      const essai = Math.abs(dL) >= 1 ? `${base} ${dL > 0 ? 'clair' : 'fonce'}` : null;
      // sinon le DEUXIÈME nom de palette le plus proche de TOUTE la palette (10/10/2026 : pris d'abord parmi les couleurs
      // vues, une 3e famille noire devenait « Beige » et la vraie beige « Beige clair »)
      nom = essai && !pris.has(essai) ? essai : tous.filter(n => n !== base).find(n => !pris.has(n)) || [`${base} clair`, `${base} fonce`].find(n => !pris.has(n)) || null;
    }
    if (!nom) nom = tous.flatMap(n => [n, `${n} clair`, `${n} fonce`]).find(n => !pris.has(n));
    pris.set(nom, L); out.push(nom);
  }
  return out;
}
/** Le code couleur d'un nom (« Noir », « Noir clair », « Noir fonce ») pour la page : la palette, éclaircie ou foncée. */
export function hexCouleur(nom) {
  const m = /^(.*?)(?:\s+(clair|fonce))?$/.exec(String(nom || '').trim()) || [];
  const p = PALETTE.find(x => x.v === m[1]); if (!p) return '#888888';
  if (!m[2]) return p.hex;
  const k = m[2] === 'clair' ? 0.35 : -0.35;
  return '#' + hexRgbDe(p.hex).map(c => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))).map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}
/** La couleur de la PALETTE la plus proche d'un centre RGB mesuré (distance Lab), parmi les noms permis. */
export function couleurProche(rgb, noms = PALETTE.map(p => p.v)) {
  const lab = ([r, g, b]) => {
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const [R, G, B] = [r, g, b].map(lin);
    const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const cible = lab((rgb || [128, 128, 128]).map(Number));
  const permis = PALETTE.filter(p => noms.includes(p.v));
  let meilleur = null, dMin = Infinity;
  for (const p of permis.length ? permis : PALETTE) { const q = lab(hexRgb(p.hex)); const d = Math.hypot(q[0] - cible[0], q[1] - cible[1], q[2] - cible[2]); if (d < dMin) { dMin = d; meilleur = p.v; } }
  return meilleur;
}

/** Coupe une phrase darija en lignes de 36 caractères au plus (sans chiffres : on les enlève, loi de forme). */
export function decoupe(texte) {
  const mots = String(texte || '').replace(/\d+/g, '').split(/\s+/).filter(Boolean);
  const out = []; let l = '';
  for (const m of mots) { if ((l + ' ' + m).trim().length > 36) { if (l) out.push(l); l = m; } else l = (l + ' ' + m).trim(); }
  if (l) out.push(l);
  return out.length ? out : ['…'];
}
/** Une raison technique brute (en français ou en anglais) en lignes latines de 36 caractères, 4 lignes au plus.
 *  Un « DA » seul y devient « DZD » : sinon la loi des dinars refuserait le message et le client ne saurait RIEN de la panne. */
export function decoupeLatin(texte) {
  const t = String(texte || 'inconnue').replace(/[؀-ۿ]/g, '').replace(/\bDA\b/g, 'DZD').replace(/\s+/g, ' ').trim().slice(0, 140) || 'inconnue';
  const out = []; for (let i = 0; i < t.length; i += 36) out.push(t.slice(i, i + 36));
  return out.slice(0, 3); // trois lignes au plus : une ligne de chiffres doit avoir sa ligne darija à trois lignes au-dessus
}
/** [porte-groupee] Un nom de modèle sur une ligne latine (sans arabe), ou null quand il n'a pas de lettres latines. */
function nomL(n) { const t = sansMontant(String(n || '').replace(/[؀-ۿ]/g, '').replace(/\s+/g, ' ').trim()); return /[A-Za-z]/.test(t) ? t.slice(0, 36) : null; }
/** [porte-groupee] Chaque modèle et son heure : une ligne darija, puis « Nom · HH:MM » (ou « tout de suite ») sur une ligne latine. */
function lignesHeures(prets) {
  const l = [];
  for (const p of prets || []) {
    const h = p.heure ? String(p.heure).replace(/[؀-ۿ]/g, '').slice(0, 11) : 'tout de suite', n = nomL(p.nom);
    if (n) { l.push('الموديل و الساعة تاع البداية :'); l.push(`${n.slice(0, 33 - h.length)} · ${h}`); }
    else { l.push(ligneSure('الموديل : ' + p.nom)); l.push(`Demarrage : ${h}`); }
  }
  return l;
}
function ligneDe(boutons, n) { const out = []; for (let i = 0; i < boutons.length; i += n) out.push(boutons.slice(i, i + n)); return out; }
export { da, usd, ligneSure };
