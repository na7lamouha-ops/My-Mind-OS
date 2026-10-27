// ecom manita — LA CHAÎNE : une MISSION par modèle, du lien Drive collé dans Telegram jusqu'à la publicité
// qui tourne, puis le suivi de chaque soir, le coach et la porte du scaling.
//
//   descente → captures → couleurs (le client nomme) → montage (natif) → contrôle
//   → photos (Tassyir) → textes (le script d'angles du vendeur, en darija) → paquet (SKU) → page cachée
//   → page-ok (ses photos au client) → publication (tout de suite)
//   → porte (break even) → budget → vidéos (Meta) → noms (clé + liens marqués) → campagne EN PAUSE
//   → lance (le client) → activation → SUIVI chaque soir (lecture, carnet, disjoncteur, coach, scaling)
//
// Trois sortes d'étapes : les OUTILS Python (zéro token : ils calculent, montent, vérifient), les tours de
// CLAUDE (seulement ce qu'il faut faire chez Tassyir et Meta, avec une liste d'outils fermée et une sortie
// JSON imposée), et les DÉCISIONS DU CLIENT (des boutons Telegram ; le silence n'est jamais un oui).
// Chaque affirmation d'un tour de Claude est recoupée par une 2e méthode : la réponse BRUTE du connecteur.
// Tout l'état vit dans <maison>/missions/<id>/mission.json : une coupure du PC reprend où on s'était arrêté.
// Code original « ecom manita » — 03/10/2026.
//
// v0.3.8 — LE LOT (un lien Drive, plusieurs modèles) : <maison>/lots/<id>/lot.json. Descente PARTAGÉE (une fois),
// séparation en DEUX méthodes (les pixels : separer.py --candidats ; les yeux : Claude lit les planches et rend le
// plan.json), puis separer.py --construire : un dossier PLAT par modèle. Le client confirme chaque modèle sur sa
// photo (l'accueil), puis une mission par modèle, exactement comme une mission seule, avec m.d.rushes = SON dossier
// (descente et séparation déjà faites, jamais rejouées), le budget du jour partagé (plafond / N), ses couleurs nommées
// seules (non bloquant) et le nom du modèle en tête de chaque message.
//
// v0.3.8 (phase 2) — LES DÉCISIONS DU VENDEUR DU 06/10/2026 :
//  · la page est PUBLIÉE dès qu'elle est prête : page-ok montre ses photos au client (l'aperçu de Tassyir s'il est
//    FIDÈLE, sinon les vraies photos de la page) et passe ; un aperçu « démo » (produit caché) n'est jamais une erreur ;
//  · la campagne de test n'a AUCUN plafond (ni sur les ad sets, ni sur la campagne : un contrôle refuse tout plafond
//    envoyé), et un nouvel essai REPREND la campagne qui porte la clé et la COMPLÈTE, jamais une deuxième campagne ;
//  · le verdict au TROISIÈME jour dans les deux modes (site et message) ;
//  · le montage en style NATIF (la plaque POV seule, aucun fond flouté) ; un modèle de lot est monté depuis le plan du
//    lot (MONTER-10 --plan <lot>/plan.json --modele <nom>), avec son contrôle anti-mélange ;
//  · les textes suivent le SCRIPT D'ANGLES du vendeur (skills/page/SCRIPT-ANGLES-MARKETING.json) en DARIJA : cinq
//    angles tirés des photos, deux textes par champ, on garde le meilleur ; titre, description courte (haut de page)
//    et longue (les blocs) vont à la page ; le reste du script devient strategie.json / strategie.txt (dossier de la
//    mission) et une note du carnet que le coach lit. Contrôles : pas de COD, pas de faux témoignage, le prix exact une
//    seule fois, aucun chiffre dans une ligne arabe hors la ligne du prix.
//  · relu contre la source (06/10/2026, « casse ») : les contrôles de la campagne lisent les VRAIS noms des champs des outils
//    Meta (campaign_spend_cap, campaign_daily_budget…, même dans un JSON passé en texte), refusent une copie ou une création
//    en ligne, un ad set hors de la campagne, un id vu dans aucune réponse brute, et une campagne reprise qui porte encore le
//    plafond d'une ancienne version ; les textes tiennent aussi les lois des OUTILS (« cod » collé, mot français dans une
//    ligne arabe, un paragraphe = un bloc) ; un vieux bouton de la page ne fait plus rien ; une seule couleur se monte en
//    natif (MONTER-10 --couleurs 1) ; une stratégie par mission dans le carnet.
//  · le SCALING comme le vendeur : la porte du coach ouverte (et du stock), le gagnant du test (manita-scaling.py
//    --gagnant : le résultat le moins cher, lu annonce par annonce dans Meta) entre dans une campagne de SCALE dédiée, en
//    CBO (le budget sur la CAMPAGNE), de un à trois ad sets broad (--depart-scale : autant que le stock le porte, le test
//    qui tourne servi d'abord), l'annonce RECRÉÉE sur son POST ID (object_story_id = l'effective_object_story_id de sa
//    créa : elle garde commentaires et historique). Jamais une campagne dupliquée, aucun plafond de dépense, tout EN
//    PAUSE ; le client la lance (« لانسي »). Les hausses montent le daily_budget de la CAMPAGNE (jamais ses ad sets) :
//    +20 à 30 % par 48 h au plus (--echelle), bornées par le stock et le break even, chacune sur « واه، طلّع ».
//  · le scaling relu contre la source (06/10/2026, « casse ») : la devise des budgets est celle du COMPTE (jamais celle
//    qu'un tour de Claude écrit) ; le départ choisi (gagnant, post, ad sets, budget) est noté AVANT la création et repris
//    tel quel après une coupure ; une scale reprise par sa clé est RELUE (plafond, budget d'ad set, post du gagnant) ;
//    « لانسي » refuse un objet hors de la scale, même publié d'un brouillon (object_ids), et rien ne part quand la porte
//    du coach s'est refermée ; le bouton de hausse porte son jeton (un vieux « واه، طلّع » ne pose jamais la hausse du
//    jour) ; une hausse déjà posée dans Meta avant une coupure est notée, jamais reposée ; pas de hausse sur une scale en
//    pause, ni sur une mission arrêtée par le disjoncteur ; le même échec ne se répète pas au client chaque soir.
//  · la LECTURE DES PLANCHES après l'essai du vrai Claude sur un vrai lot (06/10/2026 : cinq modèles rendus pour cinq
//    annoncés, mais un vêtement coupé en deux et un petit modèle de 4 s oublié — il s'était calé sur N) : l'aperçu de tous
//    les groupes en PREMIÈRE image ; la liste garde les ids T# (tronçon) et R# (vidéo), Claude cite le tronçon et le bureau
//    le traduit en nom exact (un nom sans accents ou préfixé T#/R# est lu aussi) ; une « preuve » de construction par modèle ;
//    CHAQUE groupe dans un modèle ou exclu avec une raison ; « nombreVu » et « doute » ; un système COURT (ni la skill, ni
//    les règles Meta / Tassyir) ; un mélange, un rush inconnu ou un groupe oublié : la lecture ne compte pas, une autre
//    est demandée (08/10/2026 : plus de repli « un lien par modèle », voir les LOTS plus bas) ;
//  · l'ACTIVATION du test relue dans les appels BRUTS : chaque id activé (entity_id, object_ids, même en texte JSON) est un
//    objet de CE test, sinon refus dit au client ; les tours de PAUSE (disjoncteur, arrêt) relus pareil : seulement les
//    objets de la mission, seulement status PAUSED, et chaque campagne a reçu sa pause — sinon le client le sait.
//  · la RELECTURE de ces deux points (06/10/2026, rejouée sur la VRAIE réponse du vrai Claude) : « une couleur qui change »
//    (sa raison pour exclure le petit modèle) ne place jamais un groupe ; une exclusion d'UN tronçon n'exclut pas tout son
//    groupe ; une exclusion incohérente ou à id inventé est refusée (jamais « tout le groupe » par défaut) ; un id T# inventé
//    est refusé même à côté d'un vrai nom, « T9-T11 » / « t03 » sont lus ; toutes les fautes d'une lecture sont dites
//    ENSEMBLE ; le recoupement passe AVANT le nombre (un plan refusé a sa 2e lecture même si le nombre diffère : le groupe
//    oublié est peut-être le modèle qui manque) ; le refus n'est rappelé qu'après une lecture refusée, jamais après une
//    panne ; au-delà de vingt images, toutes dans 2 000 px (règle de l'API) ; « erreur »: "aucune" n'arrête rien ; une
//    pause n'est passée que si Meta a répondu sans « error » / « success: false », ou si sa réponse brute la montre en pause.
//  · les COULEURS d'un modèle de lot (07/10/2026, mesuré sur un vrai lot : le vrai Claude sépare bien les modèles mais
//    nomme mal une couleur sur deux) : sur la photo à confirmer, « صحيح، بصح اللونات غالطين » marque le modèle
//    (m.lot.couleursClient, gardé dans mission.json : une coupure ne le perd pas) ; l'étape couleurs pose alors au client
//    la question d'une mission seule (la photo de chaque famille, en-tête du modèle, boutons de la palette) au lieu de
//    nommer seule. Sans cette marque : nommées seules et annoncées, comme avant.
//    09/10/2026 (décision du vendeur) : la question des couleurs est posée À CHAQUE LOT, marque ou pas ; le nommage de la
//    chaîne (couleurs vues par Claude, la plus proche en Lab, SANS AUCUNE FUSION : nommerSansFusion, « Noir clair » /
//    « Noir fonce ») n'est plus qu'une PROPOSITION que le client valide (« صحيح », PROPOSE) ou remplace par la palette.
//    La LOI DU COMPTAGE : captures.py reçoit le nombre DIT (reponses.couleurs, sinon « auto ») ; aucun rush ni famille
//    jeté ; une famille sans capture cadrée reste (aperçu montré, c'est dit) ; l'INVARIANT de chaque passe est relu sur le
//    disque (invariantCaptures) et écrit (historique, m.d.invariantsCaptures) ; l'écart au nombre dit est nommé, sans bloquer.
//    Relu et cassé : « ابدا » repris après une coupure du PC (lot-final-<id>.json de l'accueil) ne double jamais une
//    mission déjà née ; une création qui échoue en route retire les missions nées dans le même appel (tout ou rien),
//    et aucune ne part avant que le lot soit écrit « missions ».
//  · relu DE BOUT EN BOUT (07/10/2026) : un Drive N = 1 rangé en sous-dossiers donne un dossier PLAT (liens durs, noms
//    uniques) avant captures et montage, même pour une mission déjà descendue ; les six photos de la page sont vérifiées
//    JUSTE APRÈS les captures (relances pour toutes les couleurs : plus de photos, puis un écart de 2 s, puis 1 s), l'échec
//    arrive tôt et en clair, et l'étape photos repasse les captures serrées avant d'échouer (« عاود » peut réussir) ; la
//    lecture du soir ratée n'est plus relancée chaque minute (trois essais espacés, puis UN message au client) ; le
//    « ماشي دروك » de la scale laisse au client un « لانسي ».
//    Relu et CASSÉ : le « عاود دروك » ne vaut que le soir de l'échec (pressé le lendemain matin, il remplaçait la lecture
//    du soir) ; le client est prévenu au dernier essai POSSIBLE (heure du rapport tardive : un ou deux essais) et quand il
//    a demandé une lecture déjà en route ; un Drive effacé après l'aplatissement garde le dossier plat ; des noms de
//    sous-dossiers très longs sont bornés ; une photo effacée par une passe serrée n'est jamais envoyée au dépôt.
//  · défauts confirmés (07/10/2026, partie bureau) : le test ET la scale visent les wilayas CONFIRMÉES (les 25 du nord
//    lues chez Meta, ciblageWilayas) — plus jamais countries ["DZ"] par défaut, et chaque ad set créé ou repris est relu
//    (fauteCiblage) ; une mission seule descend son Drive ENTIER (un outil en erreur est une panne même si une partie est
//    arrivée ; la reprise retélécharge) ; la note du carnet d'un bouton (« كمّل على مسؤوليتي », la porte) ne fait plus
//    attendre le bouton (le serveur, lui, ne fait plus attendre l'écoute de Telegram par un bouton de mission).
//    Relu et CASSÉ : une page restée ouverte ne confirme plus une wilaya lue ENTRE-TEMPS qu'elle n'a jamais montrée ;
//    l'ancien format ({type:"pays"}, des régions écrites telles quelles) est refusé au lieu de retirer la confirmation en
//    silence ; une relecture (« جيب الولايات ») garde les clés ajoutées à la main et la confirmation d'une liste identique ;
//    la scale sans wilayas dit au client quoi faire ; N = 1 et lot : une PHOTO (un PDF) qui ne descend pas du Drive
//    n'arrête plus la mission quand AUCUNE vidéo ne manque (avant la correction : accepté ; après : bloqué pour de bon) ;
//    un vieux « لانسي » sur une campagne de test montée AVANT la règle (countries ["DZ"]) n'allume plus rien : elle repasse
//    par l'étape campagne (ciblage relu, refusé s'il n'est pas les wilayas confirmées ou pas relu), puis un nouveau « لانسي ».
//  · ARGENT, MUET, QUOTA (09/10/2026, refaits et cassés) — l'ACTIVATION relue : un compte Meta en mode brouillon rend
//    PUBLISHING (remis au publieur, encore refusable) ; PUBLISHING et DRAFT (après une publication envoyée) sont « en cours de
//    publication », jamais un échec. statutsBruts() lit le statut BRUT de chaque objet de CETTE mission (le plus avancé :
//    actif, puis refusé, puis en cours, puis le reste ; un objet d'une autre campagne ne compte pas), la phrase de Claude ne
//    vaut que pour « actif » ou « en cours » et seulement après une relecture ; trancher() décide : lancée / partielle (un
//    objet actif, le reste refusé ou arrêté : lancée + suivi + le client le sait) / refusée (rien d'actif ni d'en attente :
//    dit au client, rien d'autre — ni pause, ni nouvelle activation ; « عاود » RELIT) / attendre (« lancée, à confirmer » :
//    une relecture ~3 min plus tard, au plus trois, puis le suivi gardé) / échec (rien ne tourne). JAMAIS une deuxième
//    activation : un tour coupé après un ads_activate_entity (limite, panne, JSON absent, PC coupé pendant le tour —
//    m.d.activationEnVol) est RELU ; une activation sans aucun appel d'activation n'est jamais « lancée ». La scale pareil
//    (états publication / rejetee). Une mission arrêtée (« حبس ») pendant un tour reste arrêtée.
//    Le CARNET n'est plus muet : --il-savait porte sa valeur, et un outil du carnet en code non nul est NOTÉ dans l'historique.
//    La LIMITE D'USAGE de Claude (moteur.mjs lireQuota) : état « quota » (mission, lot, lecture du soir) qui ne consomme
//    AUCUN essai, un verrou global jusqu'à l'heure de reprise (+1 min, entre 1 min et 6 h ; 30 min sans heure lue), reprise
//    seule (tick), UN message au client. Les tours qui n'ont pas besoin de la skill partent sans elle (ETAPES_SANS_SKILL) et
//    quatre tours vérifiés dans le brut partent sur un modèle léger au premier essai (MODELE_LEGER).
//  · CONNECTEUR À RECONNECTER (09/10/2026, décision du coordinateur) : un connecteur claude.ai Meta ou Tassyir pas
//    « connected » au début d'un tour (needs-auth, pending, failed, ou absent de la dernière sonde) n'est JAMAIS une panne :
//    état « connecteur » (mission, lot, lecture du soir, relecture d'une activation) sans essai consommé, UN message au client
//    pour tout le bureau, puis la reprise toute seule quand une sonde (périodique et bornée, au bouton « عاود », ou
//    /api/connecteurs/sonder) les redonne « connected ».
//  · LE SERVEUR META LOCAL (09/10/2026, option A validée) : au DÉBUT de chaque tour Meta d'une mission, une LECTURE RÉELLE
//    (deps.metaLocal.lire : GET /me et le compte, par bureau/meta-mcp.mjs, avec le jeton de التحضير) décide du chemin, UNE
//    fois : réussie → le serveur local (meta_manita) ; sinon → le connecteur claude.ai (comme avant). Le choix est écrit dans
//    l'historique et GARDÉ (m.d.cheminMeta) : une mission ne change jamais de chemin en route. Sur le chemin local, une
//    lecture refusée (#190 jeton, #200/#10 droits) est un « connecteur à reconnecter » (clé metaLocal) sans essai perdu ;
//    seule la PAUSE (arrêter la dépense) change de chemin, et dans les DEUX sens (10/10/2026, pause symétrique) : jeton mort
//    → le connecteur ; connecteur mort → le jeton, si une lecture réelle le prouve vivant ; chaque franchissement journalisé,
//    et sur le chemin local le tour de pause porte un TICKET (--pause) : seulement {"status":"PAUSED"} sur les objets de la
//    mission, aucune activation, aucune création, aucun budget. L'activation après « لانسي »
//    pose une PORTE à usage unique (meta-mcp.mjs ecrirePorte : la mission et SES ids) que le serveur local exige.
//  · LES CRÉAS DU TEST (08/10/2026, décision du vendeur) : au plus QUATRE vidéos (donc ad sets) par modèle ; le client
//    choisit de un à quatre, une fois par lien (accueil.mjs), sinon le réglage creasParModele (défaut quatre). L'étape budget
//    prend ce nombre de vidéos SAINES (choisirVideosTest : les premières dans l'ordre du contrôle, des angles différents
//    d'abord quand _rapport.json les donne), le budget suit la règle existante (1–2 vidéos : 7 $ par ad set, plus : 5 $),
//    divisé par lot ; le plafond du jour ne bouge pas. Moins de vidéos saines que le choix (creasMoins) ou un plafond
//    qui coupe sous le choix (creasPlafond) : on part avec ce qu'il y a et on le dit UNE fois. Le contrôle accepte une
//    seule vidéo saine (cohérent avec le choix un). Cassé : un test d'AVANT à cinq ou six vidéos, rien d'allumé, est refait
//    (testAuPlusQuatre : clé neuve, vidéos déjà chez Meta reprises, ancienne campagne laissée EN PAUSE, jamais supprimée,
//    le client prévenu) ; une campagne reprise avec des ad sets EN TROP (lus dans Meta, pas créés ici) est acceptée, ils
//    restent en pause et ne sont jamais activés ; un test déjà allumé n'est jamais touché.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { M, PALETTE, da, usd, enteteModele, couleurProche, nomLatin, urlLisible, nommerSansFusion, hexCouleur } from './messages.mjs';
import { creasDe, CREAS_MAXI, TEXTES as TEXTES_ACCUEIL } from './accueil.mjs';
import { REGLES_MAISON } from './routeur.mjs';
import { ouvrirCarnet, ecrireNote, listerNotes, refusDeContenu } from './carnet.mjs';
import { ecrirePorte, effacerPorte, ecrireTicketPause, effacerTicketPause, ouvrirTourPorte, fermerTourPorte } from './meta-mcp.mjs';
import { controlesSuivi, messageControles } from './controles-suivi.mjs';
import { ficheVideo, ligneResultat, resumeParEtiquette, ajouterLignes, lireBibliotheque, messageBibliotheque } from './bibliotheque.mjs';

export const ETAPES = [
  ['descente', 'تحميل الفيديوات'], ['separation', 'فرز الموديلات'], ['captures', 'التصاور من الفيديوات'], ['couleurs', 'أسماء اللونات'], ['montage', 'المونتاج'],
  ['controle', 'مراقبة الفيديوات'], ['photos', 'التصاور في تسيير'], ['textes', 'النصوص'], ['paquet', 'تحضير الصفحة'],
  ['page', 'الصفحة في تسيير'], ['page-ok', 'تصاور الصفحة'], ['publication', 'نشر الصفحة'], ['porte', 'حساب الربح'],
  ['budget', 'البودجي'], ['videos', 'الفيديوات في ميتا'], ['noms', 'الأسماء و الروابط'], ['campagne', 'الكامباني محبوسة'],
  ['lance', 'كلمتك : لانسي'], ['activation', 'تشغيل البوب']
];
const NOM_AR = Object.fromEntries(ETAPES);
export const ATTENTE = Symbol('attente');
const SAUTE = 'SAUTE'; // une étape qui ne concerne pas cette mission (la séparation d'une mission seule)
/** Les étapes d'un LOT, avant que les missions naissent. */
export const ETAPES_LOT = ['descente', 'candidats', 'lecture', 'construction'];
const MAX_PLANCHES = 20; // pages de planches montrées à Claude : au-delà, seule la 1re page de chaque groupe est lue
const MAX_GROUPES = 60;  // au-delà, une panne dite au client (limite technique de la lecture par l'image, pas un repli)
const LECTURES_MAX = 3;  // tours de lecture des planches au plus (une lecture illisible ou refusée ne compte pas)
/** [anonymat] 10/10/2026 — UNE SEULE LECTURE VÉRIFIÉE après les LECTURES_MAX tours (les autres refusées ou illisibles). Les deux
 *  lectures croisées restent la PRÉFÉRENCE ; mais les lois du vendeur (« un seul lien passe toujours », « rien ne se perd, tout se
 *  compte, on continue sur ce qui est LÀ », une page n'attend jamais) imposent de continuer sur la lecture vérifiée (verifierPlan) :
 *  chaque modèle est confirmé par le client sur SA photo (l'accueil, comme toujours), le client lit « قراية وحدة برك اللي تصحّات »,
 *  le bilan du lot et la page du lot écrivent « une seule lecture vérifiée ». Zéro lecture vérifiée : l'arrêt « vide » reste.
 *  'continuer' (défaut) | 'arreter' (l'ancien arrêt « vide ») ; le réglage lectureSeuleVerifiee de config.local.json l'emporte. */
export const LECTURE_SEULE_VERIFIEE = 'continuer';
/* [casse-6] 10/10/2026 : le réglage écrit À LA MAIN dans config.local.json (« arrêter » avec son accent, « Arreter », « stop »,
 * false…) n'était reconnu que s'il valait EXACTEMENT 'arreter' : tout le reste CONTINUAIT, sans un mot. Maintenant : la valeur
 * est lavée (accents, casse, espaces) ; absente → le défaut ; une valeur écrite qu'on ne reconnaît pas → « arreter » (la prudence :
 * le client a écrit QUELQUE CHOSE, on ne publie pas sur une seule lecture sans son « continuer » clair). */
const MOTS_CONTINUER = new Set(['continuer', 'continue', 'oui', 'yes', 'true', '1', 'on', 'كمل']);
export const choixLectureSeule = v => {
  if (v === undefined || v === null || v === '') return LECTURE_SEULE_VERIFIEE;
  if (v === false) return 'arreter'; if (v === true) return 'continuer';
  const k = String(v).normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!k) return LECTURE_SEULE_VERIFIEE;
  return MOTS_CONTINUER.has(k) ? 'continuer' : 'arreter'; // « arrêter », « stop », « non »… ET toute valeur inconnue
};
/** LA COUPE MINIMALE (le message à Claude : « le bureau ignore un segment de moins d'une demi-seconde ») : un morceau plus
 *  court ne se garde jamais ; une vidéo où un modèle ne se voit QUE par morceaux plus courts ALTERNE deux vêtements (une vidéo
 *  réelle mesurée le 09/10/2026 : bascule toutes les 0,4 s) — elle est écartée en entier et nommée (rapport + une ligne au client). */
export const COUPE_MINI_S = 0.5;
export const POURQUOI_ALTERNEE = 'deux vêtements alternés plus vite que la coupe minimale (0,5 s) : vidéo écartée';
// une ALTERNANCE de deux VÊTEMENTS (10/10/2026, « casse ») : le mot de la bascule ET deux vêtements — « couleurs alternées »
// (un seul vêtement qui change de coloris) n'écarte JAMAIS une vidéo (une couleur qui change n'est jamais une raison d'exclure)
const RAISON_ALTERNEE = { test: p => /altern|bascul/i.test(String(p || '')) && /(deux|2|plusieurs|autres?)\s+(v[eê]tements?|tenues?|mod[eè]les?|pi[eè]ces?|habits?|robes?|abayas?|ensembles?|lbas|لبسات)|v[eê]tements?\s+(diff[ée]rents?|altern)/i.test(String(p || '')) };
/** LOI DES DIX SECONDES (08/10/2026) : une vidéo livrée de 10 s ou moins est jetée au contrôle. */
export const DUREE_MINI_LIVREE = 10;
/** Le système du tour « separation » : COURT (06/10/2026). Ni la skill de l'éditeur (le montage, les musiques) ni les
 *  règles Meta / Tassyir : ce tour n'a que des images à regarder, et tout le reste le détournait de ce travail. */
export const SYSTEME_SEPARATION = [
  'Tu es l\'œil du bureau « ecom manita » : tu sépares les MODÈLES d\'un shooting vidéo de vêtements, en regardant les planches d\'images que le serveur te joint.',
  '- Tu n\'as ni outil, ni terminal, ni fichier : seulement les images et la liste du message. Tu ne parles pas au client.',
  '- Un modèle = un vêtement, reconnu à sa CONSTRUCTION (col, boutons, surpiqûres, poches, panneaux, coupe). Jamais à la mannequin, au décor, au foulard, au sac ou au texte incrusté.',
  '- Un modèle ne garde QUE les instants où son vêtement se voit, net. Le reste (décor, piscine, transition, écran noir, flou, une autre tenue, mains seules…) va dans « exclusions » avec une raison courte, jamais dans le modèle.',
  '- Tu rends ce que tu VOIS, pas ce qu\'on attend de toi. Ce qui te fait hésiter va dans « doute » ; des images illisibles, dans « erreur ». Tu ne devines jamais.',
  '- Ta réponse finale est UNIQUEMENT l\'objet JSON demandé (outil StructuredOutput).'
].join('\n');
/** LA RÈGLE DES IMPURETÉS (09/10/2026, vrai lot du 09/10) : la lecture rattachait au modèle des tronçons entiers — la piscine
 *  et la fin d'une longue prise, une fin floue, des vidéos entières avec une autre tenue au début. Un modèle ne garde que
 *  les secondes où SON vêtement se voit net ; tout le reste va dans « exclusions » (une raison courte). Les planches écrivent
 *  la seconde de chaque image et donnent son film à chaque tronçon long (separer.py, TRONCON_LONG_S) : les bords se jugent.
 *  Écrite dans le message de CHAQUE tour « separation » (le vérificateur le contrôle). */
export const REGLE_IMPURETES = `CE QUI N'EST PAS LE VÊTEMENT : EXCLURE (règle des impuretés)
- Un modèle ne garde QUE les secondes où SON vêtement se voit, net (on y lit sa construction). Tout tronçon ou passage où le vêtement du modèle ne se voit pas, ou pas net, va dans « exclusions » avec une raison courte — jamais rattaché au modèle : décor seul, piscine ou paysage, silhouette trop loin (la personne tient moins de la moitié de la hauteur de l'image), transition ou fondu, écran noir, image floue ou bougée, une AUTRE tenue que celle du modèle, mains ou visage seuls, texte plein écran.
- Un tronçon n'est pas un bloc et une vidéo n'est jamais gardée entière d'office : chaque image porte sa seconde, et un tronçon long a son propre film, ses bords en images serrées (toutes les 1,5 s au début et à la fin). Si le début, la fin ou un passage du milieu n'est pas le vêtement net, le segment s'arrête avant ou reprend après (de / a resserrés), ET ce moment va dans « exclusions » (troncon, de, a, pourquoi). Coupe au plus près : entre la dernière image nette et la première qui ne l'est pas.
- Une vidéo qui alterne DEUX vêtements différents (pas deux couleurs du même) : le modèle ne garde que les passages où SON vêtement se voit d'affilée ; les instants de l'autre vêtement vont dans « exclusions » (« autre tenue »).
- Une vidéo qui alterne deux vêtements plus vite qu'une demi-seconde va en exclusions avec la raison « deux vêtements alternés » : la vidéo ENTIÈRE (troncon ou rush, de 0 à sa fin), jamais dans un modèle, même si l'un des deux vêtements est celui d'un modèle.
- Dans le doute sur un BORD (début, fin, transition de quelques secondes), exclus-le : un instant gardé à tort gâche une vidéo. Mais le vêtement qu'on voit en entier se garde, même dehors, près d'une piscine, en marche ou s'il change de couleur : jamais un long passage où il se voit.
- Exclure un passage ne retire pas le modèle : son groupe reste dans le modèle par ce qui y est net.`;
const EXT_VIDEO = ['.mp4', '.mov', '.m4v', '.avi', '.mkv'];
/** [v0.3.9-meta] LES ERREURS META CONNUES (constaté le 24/10/2026 : « No Payment Method » coupé, en français, avec « عاود »
 *  qui ne pouvait que rééchouer, et deux essais perdus). Une erreur de CONFIGURATION du compte : dite en darija avec
 *  l'action à faire, aucun essai consommé, la mission attend le « عاود » du client. Lue dans le message ET dans les réponses
 *  brutes des outils (la phrase de Claude ne la cite pas toujours). */
export const ERREURS_META = [
  { cle: 'paiement', motif: /no payment method|update payment method|add a valid payment method|payment method (is )?(required|missing)|funding source/i },
  { cle: 'impaye', motif: /unsettled|outstanding balance|payment (has )?failed|account (is )?in (a )?grace period|balance due/i },
  { cle: 'desactive', motif: /ad account (has been |is )?(disabled|closed|restricted)|account_status["':\s]*(2|101|DISABLED|CLOSED)|ad account is not active|account (is )?disabled/i },
  { cle: 'limite', motif: /spend(ing)? (cap|limit)|account spending limit|spend_cap (reached|exceeded)|reached (its|the) spend/i },
  { cle: 'droits', motif: /\(#200\)|does not have (the )?permission|not authorized to|requires (the )?.{0,40}permission|user doesn'?t have (the )?permission|page .{0,40}not .{0,20}(allowed|authorized)/i }
];
export function erreurMetaConnue(texte) { const t = String(texte || ''); const e = ERREURS_META.find(x => x.motif.test(t)); return e ? e.cle : null; }
const lireJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const extrait = (t, n = 300) => String(t || '').trim().split(/\r?\n/).filter(Boolean).slice(-4).join(' | ').slice(-n);
const definitive = msg => Object.assign(new Error(msg), { definitif: true });
const maintenant = () => new Date().toISOString();
// [v0.3.9-renommer] Windows : renommer par-dessus un fichier qu'un autre programme tient ouvert (antivirus, indexation)
//   échoue un instant (EPERM, EACCES, EBUSY) : on réessaie, comme graceful-fs. Ailleurs, rien ne change.
export function renommerSur(t, f) {
  for (let i = 0; ; i++) {
    try { return fs.renameSync(t, f); }
    catch (e) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code) || i >= 20) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (i + 1));
    }
  }
}

export function listerVideos(dossier) {
  const out = [];
  const marcher = d => { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) { if (x.name.startsWith('.') || x.name.startsWith('_')) continue; const f = path.join(d, x.name);
      if (x.isDirectory()) marcher(f); else if (EXT_VIDEO.includes(path.extname(x.name).toLowerCase())) out.push(f); } };
  marcher(dossier); return out.sort();
}

/** ffprobe : durée, flux vidéo / audio, taille de l'image. Mesuré, jamais deviné. */
export function sonder(ffprobe, fichier) {
  return lireSonde(spawnSync(ffprobe, [...ARGS_SONDE, fichier], { encoding: 'utf8', windowsHide: true, timeout: 120000 }));
}

/** [v0.3.9-async] ffmpeg / ffprobe SANS figer le bureau : spawnSync arrêtait TOUT (l'écoute Telegram, la page, les minuteurs)
 *  pendant chaque appel, et un délai Telegram expirait pendant le blocage. Même résultat que spawnSync (status, stdout,
 *  stderr, error), arrêté au bout de timeout. */
export function executer(bin, args, { timeout = 120000, env = process.env, cwd } = {}) {
  return new Promise(res => {
    let p; try { p = spawn(bin, args, { windowsHide: true, env, cwd, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { return res({ status: null, stdout: '', stderr: '', error }); }
    let stdout = '', stderr = '', fini = false;
    const fin = r => { if (!fini) { fini = true; clearTimeout(minuteur); res({ stdout, stderr, ...r }); } };
    const minuteur = setTimeout(() => { try { p.kill(); } catch {} fin({ status: null, error: Object.assign(new Error('délai dépassé'), { code: 'ETIMEDOUT' }) }); }, timeout);
    p.stdout.on('data', d => { stdout += d; }); p.stderr.on('data', d => { stderr += d; });
    p.on('error', error => fin({ status: null, error }));
    p.on('close', status => fin({ status }));
  });
}
const lireSonde = r => {
  if (r.status !== 0) return { ok: false, raison: extrait(r.stderr || r.error?.message || 'ffprobe a échoué') };
  let j; try { j = JSON.parse(r.stdout); } catch { return { ok: false, raison: 'ffprobe illisible' }; }
  const flux = j.streams || [];
  const v = flux.find(s => s.codec_type === 'video');
  return { ok: true, duree: +(j.format?.duration || 0), video: !!v, audio: flux.some(s => s.codec_type === 'audio'), largeur: v?.width || 0, hauteur: v?.height || 0 };
};
const ARGS_SONDE = ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json'];
/** sonder(), sans figer le bureau. */
export async function sonderA(ffprobe, fichier) { return lireSonde(await executer(ffprobe, [...ARGS_SONDE, fichier], { timeout: 120000 })); }
const choisirMoteur = (videos, durees) => {
  durees = durees.sort((a, b) => a - b);
  const med = durees[Math.floor(durees.length / 2)] || 0;
  return (videos.length <= 4 && med >= 120) ? { moteur: 'scenes', raison: `${videos.length} fichier(s), médiane ${Math.round(med)} s : longues prises` } : { moteur: 'rushes', raison: `${videos.length} fichier(s), médiane ${Math.round(med)} s : rushes déjà coupés` };
};
/** quelMoteur(), sans figer le bureau. */
export async function quelMoteurA(ffprobe, videos) { const durees = []; for (const f of videos) durees.push((await sonderA(ffprobe, f)).duree || 0); return choisirMoteur(videos, durees); }

/** Le moteur de montage, MESURÉ (comme le gardien de la maison) : peu de longues prises → découper les scènes ; sinon des rushes déjà coupés. */
export function quelMoteur(ffprobe, videos) {
  return choisirMoteur(videos, videos.map(f => sonder(ffprobe, f).duree || 0));
}

/** [v0.3.9-photos] LES PHOTOS DU SHOOTING (constaté le 23/10/2026 : la page prenait des images tirées des vidéos, 1080 × 1920,
 *  floues, alors que le Drive avait les photos du shooting en 24 Mpx, nommées par couleur « …_bleu-marine_01.jpg »).
 *  La couleur d'une photo se lit dans son NOM : les mots de chaque couleur de la palette (et leurs synonymes), le dernier
 *  trouvé dans le nom gagne (le nom du modèle vient d'abord : « …-Creme_M-A_noir_01 » est noire). */
export const EXT_PHOTO = /\.(jpe?g|png|webp)$/i;
export const MOTS_COULEUR = {
  Noir: ['noir', 'noire', 'black', 'k7al', 'kahla', 'akhal'], Blanc: ['blanc', 'blanche', 'white', 'abyad', 'ecru'],
  Beige: ['beige', 'creme', 'cream', 'nude', 'sable', 'ivoire'], Gris: ['gris', 'grise', 'grey', 'gray', 'anthracite'],
  Marron: ['marron', 'brown', 'chocolat', 'choco', 'maron', 'taupe'], Camel: ['camel', 'caramel', 'cognac'],
  Bleu: ['bleu', 'blue', 'ciel', 'jean', 'denim'], Marine: ['bleu marine', 'marine', 'navy'],
  Vert: ['vert', 'verte', 'green', 'emeraude', 'sapin'], Kaki: ['kaki', 'khaki', 'olive'], Rouge: ['rouge', 'red'],
  Bordeaux: ['bordeaux', 'bordo', 'burgundy', 'grenat'], Rose: ['rose', 'pink', 'poudre', 'fuchsia'],
  Mauve: ['mauve', 'violet', 'violette', 'lilas', 'purple', 'lavande', 'parme'], Jaune: ['jaune', 'yellow', 'moutarde'],
  Orange: ['orange', 'corail']
};
/** Les couleurs voisines : une photo « bleu-marine » va à la couleur que le client a nommée « Bleu » quand il n'a pas les deux. */
const VOISINES = [['Bleu', 'Marine'], ['Beige', 'Camel', 'Blanc'], ['Marron', 'Camel'], ['Vert', 'Kaki'], ['Rouge', 'Bordeaux'], ['Rose', 'Mauve'], ['Noir', 'Gris']];
const motsDe = t => ' ' + String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
/** La couleur de palette d'un texte (un nom de fichier, un nom de couleur du client) : la DERNIÈRE trouvée, null sinon. */
export function couleurDuTexte(texte) {
  const t = motsDe(texte); let mieux = null, pos = -1;
  for (const [c, mots] of Object.entries(MOTS_COULEUR)) for (const w of mots) { const i = t.lastIndexOf(' ' + w + ' '); if (i >= 0 && (i > pos || (i === pos && w.includes(' ')))) { mieux = c; pos = i; } }
  // « bleu marine » : « marine » est plus loin que « bleu », il gagne déjà ; un « bleu » seul reste Bleu
  return mieux;
}
/** À quelle couleur du client va une photo (son nom de fichier) ; null : on ne sait pas, la photo ne sert pas. */
export function couleurDePhoto(fichier, nomsClient) {
  const c = couleurDuTexte(path.basename(String(fichier)).replace(EXT_PHOTO, '')); if (!c) return null;
  const parNom = nomsClient.map(n => ({ n, c: couleurDuTexte(n) || n }));
  const exact = parNom.filter(x => x.c === c); if (exact.length === 1) return exact[0].n;
  if (exact.length > 1) return null;
  const groupe = VOISINES.find(g => g.includes(c)); if (!groupe) return null;
  const proches = parNom.filter(x => groupe.includes(x.c)); return proches.length === 1 ? proches[0].n : null;
}
/** Les photos d'un dossier du Drive, en descendant dans les sous-dossiers (« Photos », « Mannequin-A »…). */
export function listerPhotos(dossier) {
  const out = [];
  const marcher = d => { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) { if (x.name.startsWith('.') || x.name.startsWith('_')) continue; const f = path.join(d, x.name);
      if (x.isDirectory()) marcher(f); else if (EXT_PHOTO.test(x.name)) out.push(f); } };
  marcher(dossier); return out.sort();
}
/** Les photos de la page : on alterne les couleurs (jamais deux fois la même à la suite), 6 à 15. */
/** LES MUSIQUES DE L'INSTALLATION (09/10/2026) : seuls les morceaux de PLUS de MUSIQUE_MIN_S secondes comptent (chaque
 *  vidéo livrée dépasse dix secondes : un morceau plus court ne sert plus) ; il en faut MUSIQUES_MIN. La durée est lue par
 *  ffprobe (brute, jamais arrondie avant la comparaison : 12,004 s passe, 12 s pile est trop court) ; un fichier illisible ne
 *  compte pas. cache : { [nom]: { mtime, taille, duree | null } } — un fichier déjà lu et inchangé n'est pas relu, un fichier
 *  retiré sort du cache ; un fichier qui bloque ffprobe est gardé comme illisible (sinon chaque page rebloquerait 20 s). Sans
 *  ffprobe : rien n'est mis en cache et rien ne compte (ffprobe: false dans le résultat). */
export const MUSIQUE_MIN_S = 12;
export const MUSIQUES_MIN = 10;
const EXT_MUSIQUE = /\.(mp3|m4a|wav|aac|ogg)$/i;
export function compterMusiques(dossier, ffprobe = 'ffprobe', cache = {}, env = process.env) {
  const r = { dossier, existe: false, ffprobe: true, longues: 0, courtes: 0, illisibles: 0, total: 0, relus: 0, cache: {} };
  let noms;
  try { noms = fs.readdirSync(dossier, { withFileTypes: true }).filter(e => e.isFile() && !e.name.startsWith('._') && EXT_MUSIQUE.test(e.name)).map(e => e.name); }
  catch { return r; }
  r.existe = true; r.total = noms.length;
  for (const n of noms.sort()) {
    const f = path.join(dossier, n); let st; try { st = fs.statSync(f); } catch { r.illisibles++; continue; }
    const vu = cache[n];
    let duree;
    if (vu && vu.mtime === st.mtimeMs && vu.taille === st.size) duree = vu.duree;
    else {
      const p = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8', windowsHide: true, timeout: 20000, env });
      if (p.error && p.error.code === 'ENOENT') { r.ffprobe = false; continue; } // ffprobe absent : rien en cache, rien ne compte
      r.relus++;
      const d = parseFloat(String(p.stdout || '').trim());
      duree = p.status === 0 && Number.isFinite(d) && d > 0 ? d : null; // bloqué (timeout), erreur, durée absente : illisible
    }
    r.cache[n] = { mtime: st.mtimeMs, taille: st.size, duree };
    if (duree === null || duree === undefined) r.illisibles++;
    else if (duree > MUSIQUE_MIN_S) r.longues++;
    else r.courtes++;
  }
  return r;
}
/** [v0.3.9-async] compterMusiques(), sans figer le bureau (même règle, même cache). */
export async function compterMusiquesA(dossier, ffprobe = 'ffprobe', cache = {}, env = process.env) {
  const r = { dossier, existe: false, ffprobe: true, longues: 0, courtes: 0, illisibles: 0, total: 0, relus: 0, cache: {} };
  let noms;
  try { noms = fs.readdirSync(dossier, { withFileTypes: true }).filter(e => e.isFile() && !e.name.startsWith('._') && EXT_MUSIQUE.test(e.name)).map(e => e.name); }
  catch { return r; }
  r.existe = true; r.total = noms.length;
  for (const n of noms.sort()) {
    const f = path.join(dossier, n); let st; try { st = fs.statSync(f); } catch { r.illisibles++; continue; }
    const vu = cache[n];
    let duree;
    if (vu && vu.mtime === st.mtimeMs && vu.taille === st.size) duree = vu.duree;
    else {
      const p = await executer(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { timeout: 20000, env });
      if (p.error && p.error.code === 'ENOENT') { r.ffprobe = false; continue; } // ffprobe absent : rien en cache, rien ne compte
      r.relus++;
      const d = parseFloat(String(p.stdout || '').trim());
      duree = p.status === 0 && Number.isFinite(d) && d > 0 ? d : null; // bloqué (timeout), erreur, durée absente : illisible
    }
    r.cache[n] = { mtime: st.mtimeMs, taille: st.size, duree };
    if (duree === null || duree === undefined) r.illisibles++;
    else if (duree > MUSIQUE_MIN_S) r.longues++;
    else r.courtes++;
  }
  return r;
}
/** Le détail de la ligne « musiques » : exactement ce qui manque. */
export function detailMusiques(r) {
  if (!r.existe) return `dossier introuvable : ${r.dossier} — il faut ${MUSIQUES_MIN} morceaux de plus de ${MUSIQUE_MIN_S} s`;
  if (!r.ffprobe) return `ffprobe introuvable : les durées ne se lisent pas (il faut ${MUSIQUES_MIN} morceaux de plus de ${MUSIQUE_MIN_S} s) · dans ${r.dossier}`;
  const manque = Math.max(0, MUSIQUES_MIN - r.longues);
  return [`il faut ${MUSIQUES_MIN} morceaux de plus de ${MUSIQUE_MIN_S} s, il y en a ${r.longues}${manque ? ` : il en manque ${manque}` : ''}`,
    ...(r.courtes ? [`${r.courtes} trop court(s) (${MUSIQUE_MIN_S} s ou moins) : ils ne servent plus, chaque vidéo livrée dépasse ${DUREE_MINI_LIVREE} s`] : []),
    ...(r.illisibles ? [`${r.illisibles} illisible(s) : ne compte(nt) pas`] : []), `dans ${r.dossier}`].join(' · ');
}
// [pack-23oct] le nom du modèle qui part dans utm_campaign (manita-testing.py --nom-modele → etiquette_campagne)
export function nomPourTracking(m) {
  const rep = (m && m.demande && m.demande.reponses) || {};
  const candidats = [rep.nom !== 'auto' ? rep.nom : '', m && m.lot && m.lot.nom, m && m.d && m.d.textes && m.d.textes.nom];
  return candidats.map(x => String(x || '').trim()).find(x => /[a-z]/i.test(x.normalize('NFKD'))) || '';
}

/** Le lien de la page tel qu'il PART VERS META (lien marqué, 09/10/2026) : chaque caractère hors ASCII (le slug arabe)
 *  est encodé en UTF-8 (%XX), le reste est gardé tel quel (déjà ASCII : jamais encodé deux fois). Prouvé le 09/10/2026
 *  par un GET public : la forme encodée de https://<boutique>.tassyir.io/product/<slug-arabe> rend la même page
 *  (200, même titre, même produit) ; c'est aussi l'og:url que Tassyir écrit. Au client, on montre urlLisible. */
export function urlPourMeta(u) {
  return String(u || '').replace(/[^\x21-\x7e]/gu, c => encodeURIComponent(c));
}
/** Les photos de la page, couleurs alternées : JAMAIS deux fois la même couleur à la suite (09/10/2026 — Noir ×6 et
 *  Gris ×2 donnaient Noir, Gris, Noir, Gris, Noir, Noir, Noir, Noir : manita-produit refuse, la page tombait). À chaque
 *  pas, la couleur qui a le PLUS de photos restantes, sauf celle qu'on vient de poser (la méthode de manita-produit
 *  alterne_couleurs ; à égalité, l'ordre des couleurs) ; on s'arrête quand il ne reste que la couleur d'avant. Les photos
 *  en trop de la couleur bien filmée ne sont pas posées (elles restent dans la mission) : quand la page tombe ainsi sous
 *  ses six photos, l'étape photos relance d'abord des captures de la couleur pauvre (completerPhotos). Une seule couleur
 *  réelle (un seul nom) : rien à alterner, la règle d'avant (toutes ses photos, ses familles tour à tour). */
/** LE NOMBRE DE COULEURS DIT PAR LE CLIENT (09/10/2026, la loi du comptage) : « combien de couleurs » s'il est dans la
 *  fiche (reponses.couleurs, un entier de 1 à 8, ou ce chiffre écrit seul), sinon « auto » (captures.py compte). */
export function nombreDitCouleurs(reponses) {
  const v = reponses && reponses.couleurs;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 8) return v;
  if (typeof v === 'string' && /^[1-8]$/.test(v.trim())) return +v.trim();
  return null;
}
/** L'INVARIANT D'UNE PASSE DE CAPTURES, relu par le bureau (deuxième méthode : le rapport de captures.py ET le disque) :
 *  familles brutes = avec photo + sans photo, chaque capture dans UNE famille, somme par couleur = total, zéro orpheline
 *  (une capture-*.jpg d'un dossier couleur-k que le rapport ne nomme pas), zéro double, zéro absente. */
export function invariantCaptures(rap, sortie) {
  const fams = (rap && rap.familles) || [];
  const refs = fams.flatMap(f => (f.captures || []).map(c => path.resolve(String(c.fichier || ''))));
  const disque = [];
  try { for (const d of fs.readdirSync(sortie)) { const dd = path.join(sortie, d); if (/^couleur-\d+$/.test(d) && fs.statSync(dd).isDirectory()) for (const x of fs.readdirSync(dd)) if (/^capture-/.test(x)) disque.push(path.resolve(dd, x)); } } catch {}
  const vus = new Set(), doubles = [];
  for (const r of refs) { if (vus.has(r)) doubles.push(r); else vus.add(r); }
  const orphelines = disque.filter(x => !vus.has(x)), absentes = refs.filter(r => !fs.existsSync(r));
  const parCouleur = fams.map(f => (f.captures || []).length), avec = parCouleur.filter(n => n > 0).length, sans = parCouleur.filter(n => n === 0).length;
  const somme = parCouleur.reduce((a, b) => a + b, 0);
  const ok = fams.length === avec + sans && somme === refs.length && refs.length === disque.length && !orphelines.length && !doubles.length && !absentes.length;
  return { brutes: fams.length, avec, sans, parCouleur, somme, total: disque.length, orphelines: orphelines.length, doubles: doubles.length, absentes: absentes.length, ok };
}
/** L'écart avec le nombre dit, NOMMÉ dans les deux sens (jamais bloquant : on continue sur ce qui est là). */
export function ecartNombreDit(dit, trouve, vu = null) {
  if (!dit) return `nombre de couleurs non dit par le client : compte de captures.py (${trouve})`;
  // vu : ce que captures.py compterait SEUL (10/10/2026, passe « casser ») — 4 filmées, 3 dites : 3 familles dont une mêlée, et
  // l'historique disait « le nombre dit est trouvé ». L'écart est nommé dans les DEUX sens, les familles restent celles du nombre dit.
  const seul = vu && vu !== trouve ? ` ; captures.py seul en voit ${vu} (${vu > trouve ? 'des couleurs peuvent être mêlées dans une famille' : 'une couleur peut être coupée en deux par la lumière'}) — à vérifier sur les photos` : '';
  if (trouve < dit) return `il manque ${dit - trouve} couleur(s) : ${dit} dite(s) par le client, ${trouve} trouvée(s) après la deuxième passe — on continue sur ce qui est là${seul}`;
  if (trouve > dit) return `${trouve - dit} couleur(s) de plus que dit : ${dit} dite(s), ${trouve} trouvée(s) — on continue sur ce qui est là${seul}`;
  return `le nombre dit par le client est trouvé : ${dit}${seul}`;
}
/** L'ORDRE DES COULEURS (réglage du vendeur — UNE seule définition, lue par le bureau ET passée à manita-produit.py par
 *  --ordre-couleurs), puis rotation (une couleur tour à tour, une couleur épuisée sautée, JAMAIS deux fois la même à la suite) :
 *  « foncees » (DÉFAUT, décision du vendeur du 10/10/2026) = DU FONCÉ AU CLAIR, même quand le client nomme les couleurs dans un
 *  autre ordre (l'ordre de l'outil de captures, que le bureau refait lui-même sur le centre de chaque famille, pour qu'une
 *  2e passe ou une famille ajoutée ne le casse pas) ; « nommees » = l'ordre où le client les a NOMMÉES (nommeA, sinon les
 *  rangs), toujours disponible ; « fournie » = l'ancien comportement (la plus fournie d'abord). */
export const ORDRE_COULEURS = 'foncees';
export const MODES_ORDRE_COULEURS = ['foncees', 'nommees', 'fournie'];
/** La LUMINANCE d'un centre [R, G, B] : la SOMME R+G+B, la mesure même de captures.py (il range ses familles ainsi) — pas
 *  Rec. 709, qui inverserait des familles voisines mesurées en vrai (bleu / gris foncés) ; null sans centre lisible. */
export function luminanceCentre(centre) {
  if (!Array.isArray(centre) || centre.length < 3) return null;
  const v = centre.slice(0, 3).map(Number);
  return v.every(Number.isFinite) ? v[0] + v[1] + v[2] : null;
}
/** Les noms des couleurs gardées, dans l'ordre du réglage (mode : « foncees » par défaut, « nommees »). */
export function ordreDesCouleurs(couleurs, mode = ORDRE_COULEURS) {
  const gardees = (couleurs || []).filter(c => c && !c.exclue).map((c, i) => ({ c, i }));
  if (mode === 'foncees') {
    // DU FONCÉ AU CLAIR : la base est l'ordre des rangs (puis la liste) ; les couleurs qui ont un centre sont rangées entre
    // elles par luminance (puis rang, puis place dans la liste) sur les places qu'elles occupent ; une couleur SANS centre
    // (mission d'avant, famille sans mesure) garde sa place relative ; aucune n'a de centre : les rangs, comme avant
    gardees.sort((a, b) => ((+a.c.rang || 0) - (+b.c.rang || 0)) || a.i - b.i);
    const avec = gardees.filter(x => luminanceCentre(x.c.centre) !== null)
      .sort((a, b) => (luminanceCentre(a.c.centre) - luminanceCentre(b.c.centre)) || ((+a.c.rang || 0) - (+b.c.rang || 0)) || a.i - b.i);
    let k = 0; const range = gardees.map(x => (luminanceCentre(x.c.centre) !== null ? avec[k++] : x));
    return [...new Set(range.map(x => x.c.nom))];
  }
  // « nommees » (casse-4) : l'ordre où le CLIENT les a nommées (nommeA, posé à chaque réponse de la palette : une couleur
  // renommée prend sa nouvelle place) ; une mission d'avant, sans nommeA : les rangs, comme avant
  const n = c => (Number.isFinite(+c.nommeA) && c.nommeA !== null && c.nommeA !== undefined ? +c.nommeA : Infinity);
  gardees.sort((a, b) => (n(a.c) === n(b.c) ? 0 : n(a.c) - n(b.c)) || ((+a.c.rang || 0) - (+b.c.rang || 0)) || a.i - b.i);
  return [...new Set(gardees.map(x => x.c.nom))];
}
/** La longueur la plus grande d'une suite sans deux fois la même couleur à la suite (la plus fournie d'abord, jamais
 *  « interdit » en premier) : l'oracle de la rotation, pour qu'elle ne pose jamais moins de photos que l'ancien ordre. */
function longueurAlternee(comptes, interdit, max) {
  const c = new Map(comptes); let avant = interdit, n = 0;
  while (n < max) {
    let pris = null; for (const [nom, k] of c) if (k > 0 && nom !== avant && (!pris || k > c.get(pris))) pris = nom;
    if (pris === null) break;
    c.set(pris, c.get(pris) - 1); avant = pris; n++;
  }
  return n;
}
/** LA ROTATION : les couleurs tour à tour dans l'ordre donné ; une couleur épuisée est sautée, la rotation continue sur
 *  les restantes, JAMAIS deux fois la même à la suite ; une couleur n'est sautée que si la poser ferait tomber la page
 *  sous la longueur que l'ancien ordre atteignait (alors la suivante dans la rotation). */
export function rotationCouleurs(files, ordre, max = 15) {
  const noms = [...ordre.filter(n => files.some(f => f.nom === n)), ...files.map(f => f.nom).filter(n => !ordre.includes(n))];
  const comptes = new Map(noms.map(n => [n, files.filter(f => f.nom === n).reduce((a, f) => a + f.liste.length, 0)]));
  const file = new Map(noms.map(n => [n, files.filter(f => f.nom === n).flatMap(f => f.liste)]));
  const cible = longueurAlternee(comptes, null, max), out = [];
  let avant = null, pos = -1;
  while (out.length < cible) {
    let choisi = -1;
    for (let k = 1; k <= noms.length && choisi < 0; k++) {
      const j = (pos + k) % noms.length, nom = noms[j];
      if (nom === avant || !(comptes.get(nom) > 0)) continue;
      comptes.set(nom, comptes.get(nom) - 1);
      if (out.length + 1 + longueurAlternee(comptes, nom, cible - out.length - 1) >= cible) choisi = j;
      else comptes.set(nom, comptes.get(nom) + 1);
    }
    if (choisi < 0) break;
    const nom = noms[choisi]; out.push({ couleur: nom, fichier: file.get(nom).shift() }); avant = nom; pos = choisi;
  }
  return out;
}
/** Le plus de photos qu'un paquet porte (PHOTOS_MAXI de manita-produit.py) : la relecture de l'ordre s'y arrête. */
const PHOTOS_PAGE_MAXI_PAQUET = 15;
export function photosAlternees(couleurs, max = 15, mode = ORDRE_COULEURS) {
  const gardees = couleurs.filter(c => !c.exclue);
  const out = [];
  if (new Set(gardees.map(c => c.nom)).size <= 1) {
    const files = gardees.map(c => ({ nom: c.nom, liste: (c.captures || []).slice() }));
    while (out.length < max && files.some(f => f.liste.length)) for (const f of files) { if (f.liste.length && out.length < max) out.push({ couleur: f.nom, fichier: f.liste.shift() }); }
    return out;
  }
  const files = [];
  for (const c of gardees) { const f = files.find(x => x.nom === c.nom); if (f) f.liste.push(...(c.captures || [])); else files.push({ nom: c.nom, liste: (c.captures || []).slice() }); }
  if (mode !== 'fournie') return rotationCouleurs(files, ordreDesCouleurs(couleurs, mode), max);
  let avant = null;
  while (out.length < max) {
    const f = files.filter(x => x.liste.length && x.nom !== avant).reduce((a, x) => (!a || x.liste.length > a.liste.length ? x : a), null);
    if (!f) break;
    out.push({ couleur: f.nom, fichier: f.liste.shift() }); avant = f.nom;
  }
  return out;
}
/** La couleur PAUVRE : celle qui fait tomber la page sous ses six photos parce que l'alternance ne peut plus poser la
 *  couleur bien filmée (null quand rien ne manque, ou quand toutes les photos ensemble ne font même pas six). */
export function couleursPauvres(couleurs, mini = 6) {
  const gardees = couleurs.filter(c => !c.exclue);
  const compte = new Map();
  for (const c of gardees) compte.set(c.nom, (compte.get(c.nom) || 0) + (c.captures || []).length);
  if (compte.size <= 1 || photosAlternees(couleurs, 15).length >= mini) return [];
  const total = [...compte.values()].reduce((a, b) => a + b, 0);
  const gros = Math.max(...compte.values());
  if (total < mini || gros <= total - gros + 1) return []; // pas un déséquilibre : trop peu de photos en tout
  const riche = [...compte.entries()].find(([, n]) => n === gros)[0];
  return [...compte.keys()].filter(n => n !== riche);
}

/** Combien de vidéos tester sous le plafond du client (la règle de l'outil : 7 $ par ad set pour 1 ou 2 vidéos, 5 $ au-delà),
 *  jamais plus que le choix du client (maxi) ni que QUATRE (08/10/2026 : au plus quatre créas par modèle). */
export function videosSousPlafond(disponibles, plafondUsd, maxi = CREAS_MAXI) {
  const cout = n => (n <= 2 ? 7 : 5) * n;
  const haut = Math.max(0, Math.min(CREAS_MAXI, Math.floor(+maxi || CREAS_MAXI), disponibles));
  for (let n = haut; n >= 1; n--) if (cout(n) <= plafondUsd + 1e-9) return { n, unSeulAdSet: false };
  return plafondUsd >= 7 && haut ? { n: haut, unSeulAdSet: true } : { n: 0, unSeulAdSet: false };
}
/** 0.4.2 (25/10/2026) : LA STRUCTURE SORT DU FICHIER que reçoit le media buyer — le budget du jour ÉCRIT par le client
 *  (plafond du jour ÷ modèles du lot), le nombre de vidéos et le plus haut coût par lead de la porte (break even ÷ taux).
 *  Même règle que manita-testing.py structure_du_test (contrôlée par l'épreuve) :
 *    part = budget ÷ vidéos ; pour juger UNE vidéo seule = 15 leads × lead max ÷ 3 jours ;
 *    part ≥ ce minimum → ABO (un ad set par vidéo) · 3 $ ≤ part < minimum → CBO (Meta répartit, 3 $ au moins par ad set) ·
 *    part < 3 $ → on enlève des vidéos ; sous 3 $ pour une seule vidéo → rien ne part (n = 0). */
export const PLANCHER_CBO_USD = 3, LEADS_POUR_JUGER = 15, JOURS_TEST = 3;
export function structureDuTest(disponibles, budgetUsd, leadMaxUsd, maxi = CREAS_MAXI) {
  const haut = Math.max(0, Math.min(CREAS_MAXI, Math.floor(+maxi || CREAS_MAXI), Math.floor(+disponibles || 0)));
  const b = Math.floor((+budgetUsd || 0) * 100) / 100;
  const juge = +leadMaxUsd > 0 ? LEADS_POUR_JUGER * (+leadMaxUsd) / JOURS_TEST : null;
  if (!haut || b < PLANCHER_CBO_USD - 1e-9) return { n: 0, structure: null, budgetUsd: b, partUsd: 0, jugeMinUsd: juge, enlevees: haut };
  let n = haut;
  while (n > 1 && b / n < PLANCHER_CBO_USD - 1e-9) n--;
  const part = b / n;
  const structure = n === 1 ? 'ABO' : (juge !== null && part >= juge - 1e-9 ? 'ABO' : 'CBO');
  return { n, structure, budgetUsd: b, partUsd: part, jugeMinUsd: juge, enlevees: haut - n };
}
/** 0.4.2 : les contrôles du soir à partir de la lecture « suivi » (rien si elle manque ou si un nombre n'est pas retrouvé
 *  dans la réponse brute de l'outil qui l'a donné : jamais un contrôle sur un nombre inventé). */
export function controlesDuSoir(r, x, taux) {
  const su = x && x.suivi;
  if (!su || su.erreur || !Array.isArray(su.annonces)) return null;
  const sorties = nom => ((r && r.appels) || []).filter(a => String(a.nom || '').endsWith('__' + nom) && !a.erreur).map(a => String(a.sortie ?? '')).join(' ');
  const brutT = sorties('get_marketing_analytics'), brutM = sorties('ads_get_ad_entities');
  if (!brutT) return null;
  const vu = (brut, v) => !(+v > 0) || brut.includes(String(v)) || brut.includes((+v).toFixed(2)) || brut.includes(String(Math.round(+v * 100)));
  if (!vu(brutT, su.commandes_liees)) return null;
  const dev = String(x.devise || 'USD').toUpperCase();
  const versUsd = v => dev === 'USD' ? +v : dev === 'DZD' ? (+v) / Math.max(1, taux || 255) : +v * 1.1;
  const annonces = su.annonces.filter(a => vu(brutM, a.depense)).map(a => ({ id: a.id, nom: a.nom, depense_usd: versUsd(+a.depense || 0), achats_meta: a.achats_meta, visites_tassyir: a.visites_tassyir, commandes_tassyir: a.commandes_tassyir }));
  const liees = Number.isInteger(su.commandes_liees) ? su.commandes_liees : null;
  return controlesSuivi({ annonces, commandesLiees: liees, commandesSansTicket: liees === null ? null : Math.max(0, (+x.commandes || 0) - liees),
    depenseMetaUsd: dev === 'USD' ? +x.depense_totale : null, depenseTassyirUsd: su.depense_tassyir_usd ?? null, valeursUtm: su.valeurs_utm || [] });
}
/** 0.4.2 : les lignes de la bibliothèque des créas pour une mission, à partir de la lecture « suivi » (chaque annonce relue dans
 *  la réponse brute de Meta) : l'annonce → son ad set (« V0k ») → la vidéo k du test → sa fiche (le rapport de l'éditeur). */
export function lignesBibliotheque(m, x, r, taux, jour, phase, date) {
  const su = x && x.suivi; if (!su || !Array.isArray(su.annonces)) return [];
  const c = (m.d && m.d.campagne) || {}, sets = new Map((c.adSets || []).map(a => [String(a.id), String(a.nom || '')]));
  const adSetDe = new Map((c.ads || []).map(a => [String(a.id), String(a.ad_set_id)]));
  const brutM = ((r && r.appels) || []).filter(a => String(a.nom || '').endsWith('__ads_get_ad_entities') && !a.erreur).map(a => String(a.sortie ?? '')).join(' ');
  const dev = String(x.devise || 'USD').toUpperCase(), t = Math.max(1, +taux || 255);
  const versUsd = v => dev === 'USD' ? +v : dev === 'DZD' ? (+v) / t : +v * 1.1;
  const be = m.d.be || {}, plafondDa = phase === 'VALIDE' ? +be.par_livree : +be.par_confirmee;
  const lot = m.lot || {}, rushes = String(m.d.rushes || '');
  const out = [];
  for (const a of su.annonces) {
    if (!(+a.depense > 0) || !(brutM.includes(String(a.depense)) || brutM.includes((+a.depense).toFixed(2)) || brutM.includes(String(Math.round(+a.depense * 100))))) continue;
    const nomSet = sets.get(adSetDe.get(String(a.id)) || '') || String(a.nom || '');
    const k = +((/\bV(\d{2})\b/.exec(nomSet) || [])[1] || 0);
    const v = k ? (m.d.videosTest || [])[k - 1] : null;
    const fiche = ficheVideo({ rapport: (v && v.rapport) || {}, modele: lot.nom || m.code, mannequin: path.basename(rushes) || '', couleur: (lot.couleurs || [])[0] || '', video_id: (m.d.metaVideos || [])[k - 1]?.video_id || '', ad_id: a.id, adset: k ? `V${String(k).padStart(2, '0')}` : '' });
    out.push(ligneResultat(fiche, { date, phase, jours: jour, depense_usd: versUsd(a.depense), leads: a.commandes_tassyir || 0, confirmees: a.confirmees_tassyir || 0, livrees: a.livrees_tassyir || 0, plafond_usd: plafondDa > 0 ? plafondDa / t : null }));
  }
  return out;
}
/** Les vidéos du test : n vidéos SAINES, prises dans l'ordre du contrôle, en couvrant d'abord des ANGLES différents quand
 *  le _rapport.json de l'éditeur les donne (rapport.angle) ; l'ordre d'origine est gardé. */
export function choisirVideosTest(saines, n) {
  const pris = new Set(), angles = new Set();
  (saines || []).forEach((v, i) => { const a = v && v.rapport && v.rapport.angle; if (pris.size < n && a && !angles.has(a)) { angles.add(a); pris.add(i); } });
  (saines || []).forEach((_, i) => { if (pris.size < n) pris.add(i); });
  return (saines || []).filter((_, i) => pris.has(i));
}

/** Le jour du verdict (règle du vendeur, 06/10/2026) : le troisième, dans les DEUX modes. La même règle que
 *  JOURS_LECTURE de manita-testing.py (le vérificateur recoupe les deux). */
export const JOUR_VERDICT = { site: 3, message: 3 };

/* ---------------------------------- les WILAYAS du test et de la scale ---------------------------------- */
// Décision du vendeur : le test (et la scale) visent les 25 WILAYAS DU NORD, jamais toute l'Algérie (07/10/2026 : sans
// « ciblage » dans les réglages — aucune page ni aucun installateur ne l'écrivait — les ad sets partaient sur
// countries ["DZ"], les 58 wilayas). Les clés de région Meta des 25 wilayas sont DANS LE PAQUET (CLES_META_WILAYAS) : le
// client n'a rien à faire, la liste part confirmée par défaut (ciblageDuPaquet) ; il peut la relire chez Meta (التحضير :
// « جيب الولايات », recoupée dans les réponses BRUTES) ou la changer dans الإعدادات. Une liste qu'il a décochée n'est plus
// confirmée : rien n'est créé chez Meta ; un ad set créé ou repris hors de ces régions est refusé.
/** La même liste que WILAYAS_NORD de manita-testing.py (le vérificateur recoupe les deux) : les 25 wilayas que le vendeur
 *  vise dans ses vrais ad sets (lues le 07/10/2026). */
export const WILAYAS_NORD = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Setif', 'Tizi Ouzou', 'Bejaia', 'Tlemcen', 'Boumerdes', 'Tipaza',
  'Chlef', 'Medea', 'Bouira', 'Bordj Bou Arreridj', 'Jijel', 'Skikda', 'Guelma', 'Souk Ahras', 'Relizane', 'Ain Defla', 'Mila', 'Oum El Bouaghi', 'Tiaret'];
/** Les clés de région de Meta de ces wilayas, LUES le 07/10/2026 dans les réponses BRUTES de ads_get_ad_entities (le
 *  targeting d'ad sets réels qui visaient exactement ces 25 wilayas : {key, name « … Province », country DZ}). Ce sont des
 *  identifiants de Meta, les mêmes pour tous les comptes — rien de personnel. La même table dans manita-testing.py. */
export const CLES_META_WILAYAS = { Alger: '900', Batna: '901', Constantine: '902', Medea: '903', Oran: '905', Setif: '907', Tiaret: '908', 'Tizi Ouzou': '909',
  Tlemcen: '910', Bejaia: '911', Blida: '913', Bouira: '914', Guelma: '916', Jijel: '917', 'Oum El Bouaghi': '921', Skikda: '923', 'Ain Defla': '926',
  Annaba: '928', 'Bordj Bou Arreridj': '930', Boumerdes: '931', Chlef: '932', Mila: '939', Relizane: '942', 'Souk Ahras': '943', Tipaza: '946' };
/** Le ciblage par défaut : les 25 wilayas avec les clés du paquet, CONFIRMÉ (la décision du vendeur ; le client n'a rien à
 *  taper). Écrit nulle part : il vaut tant que config.local.json n'a pas de « ciblage » à lui. */
export function ciblageDuPaquet() {
  return { type: 'regions', regions: WILAYAS_NORD.map(w => ({ key: CLES_META_WILAYAS[w], nom: w, wilaya: w, source: 'paquet' })), manquent: [], doublons: [], confirme: true, confirmeLe: 'paquet' };
}
// les autres noms qu'une réponse de Meta peut porter (anglais, arabe translittéré)
const ALIAS_WILAYA = { Alger: ['algiers', 'aljazair', 'eldjazair', 'aldjazair', 'aljaza'], Oran: ['wahran'], Tipaza: ['tipasa'], Bejaia: ['bgayet', 'bougie'], Chlef: ['chelif', 'echchlef'], Medea: ['almadiyah', 'lemdiyya'] };
const cleNomRegion = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(wilaya|wilayat|province|governorate)\s+(de|du|d|of)\b/g, ' ').replace(/\b(wilaya|wilayat|province|governorate)\b/g, ' ').replace(/[^a-z]/g, '');
/** La wilaya du nord que nomme une région de Meta (« Béjaïa », « Algiers Province », « Wilaya de Tizi Ouzou »), ou null. */
export function wilayaDe(nom) { const k = cleNomRegion(nom); return k ? WILAYAS_NORD.find(w => cleNomRegion(w) === k || (ALIAS_WILAYA[w] || []).includes(k)) || null : null; }
const jsonsTexte = texte => { const out = []; const t = String(texte || ''); try { out.push(JSON.parse(t)); return out; } catch {} const re = /\{[\s\S]*\}/g; let x; while ((x = re.exec(t))) { try { out.push(JSON.parse(x[0])); } catch {} } return out; };
/** Les régions de Meta LUES dans les réponses brutes (jamais la phrase de Claude) : chaque objet {key, name} d'une liste
 *  « regions » (ou marqué type « region ») — un JSON passé en texte (targeting) est lu aussi — dont le pays, quand il est
 *  là, est DZ et dont le nom est une des 25 wilayas. Une VILLE (« cities » : Oran la ville a sa propre clé) n'est jamais
 *  prise pour sa wilaya. */
function regionsDansBrut(appels) {
  const vues = [];
  const region = o => {
    if (!o || typeof o !== 'object') return;
    const key = o.key, nom = o.name, pays = o.country ?? o.country_code;
    if ((typeof key === 'string' || typeof key === 'number') && /^\d{1,12}$/.test(String(key)) && typeof nom === 'string' && (pays === undefined || pays === null || String(pays).toUpperCase() === 'DZ')) {
      const w = wilayaDe(nom); if (w) vues.push({ key: String(key), nom: nom.slice(0, 60), wilaya: w });
    }
  };
  const chercher = (o, prof = 0) => {
    if (prof > 40) return;
    if (Array.isArray(o)) return o.forEach(x => chercher(x, prof + 1));
    if (!o || typeof o !== 'object') return;
    if (String(o.type || '').toLowerCase() === 'region') region(o);
    for (const [k, v0] of Object.entries(o)) {
      let v = v0;
      if (typeof v === 'string' && v.length < 500000 && /"key"/.test(v)) { const j = jsonsTexte(v); v = j.length === 1 ? j[0] : j; }
      if (k === 'regions' && Array.isArray(v)) v.forEach(region);
      if (v && typeof v === 'object') chercher(v, prof + 1);
    }
  };
  for (const a of appels || []) if (!a.erreur && /__ads_get_ad_entities$/.test(String(a.nom || ''))) jsonsTexte(a.sortie).forEach(j => chercher(j));
  return vues;
}
/** La lecture des wilayas (التحضير) recoupée : les régions viennent des réponses BRUTES de ads_get_ad_entities ; ce que
 *  Claude annonce et que le brut ne montre pas est écarté (et dit) ; deux clés différentes pour une même wilaya : aucune
 *  des deux (on ne choisit pas au hasard, le client tranche). Rend { regions:[{key, nom, wilaya}], manquent, ecartes, doublons }. */
export function recouperRegions(structure, appels) {
  const brut = regionsDansBrut(appels), parCle = new Map(brut.map(r => [r.key, r]));
  const ecartes = [];
  for (const x of (structure && Array.isArray(structure.regions) ? structure.regions : [])) {
    const k = String(x?.key ?? '').trim(), b = parCle.get(k), dit = wilayaDe(x?.name ?? x?.nom ?? '');
    if (!b) ecartes.push({ key: k, nom: String(x?.name ?? x?.nom ?? '').slice(0, 60), raison: 'absente des réponses brutes de Meta (ou hors des 25 wilayas)' });
    else if (dit && dit !== b.wilaya) ecartes.push({ key: k, nom: String(x.name ?? x.nom).slice(0, 60), raison: `Meta la nomme ${b.nom}` });
  }
  const parWilaya = new Map();
  for (const r of brut) { const l = parWilaya.get(r.wilaya) || []; if (!l.some(y => y.key === r.key)) l.push(r); parWilaya.set(r.wilaya, l); }
  const regions = [], doublons = [];
  for (const w of WILAYAS_NORD) { const l = parWilaya.get(w) || []; if (l.length === 1) regions.push(l[0]); else if (l.length > 1) doublons.push(`${w} (${l.map(y => y.key).join(' / ')})`); }
  return { regions, manquent: WILAYAS_NORD.filter(w => !regions.some(r => r.wilaya === w)), ecartes, doublons };
}
/** Les wilayas que la page renvoie : { garder:[clés cochées], vus:[clés affichées], ajouter:[{key, wilaya}], confirme }.
 *  Rien d'inventé par la page : une clé lue chez Meta que la page n'affichait pas (lue entre-temps) reste, NON confirmée ; une clé ajoutée
 *  à la main est en chiffres et vise une des 25 wilayas (elle remplace la clé lue de cette wilaya) ; la liste n'est
 *  « confirmée » que si le client a coché la confirmation, et jamais vide. */
export function ciblageDuClient(n, ancien) {
  if (!n || typeof n !== 'object' || Array.isArray(n)) throw new Error('ciblage illisible');
  // l'ANCIEN format ({type:"pays"} — toute l'Algérie —, {type:"regions", regions:[…]} écrit tel quel) : refusé en clair.
  // Avant (07/10/2026, « casse ») il passait avec un 200 : les régions postées étaient ignorées, et la confirmation du
  // client était RETIRÉE en silence (le test suivant s'arrêtait « wilayas pas confirmées » sans que personne sache pourquoi)
  if ('type' in n || 'regions' in n || !['vus', 'garder', 'ajouter', 'confirme'].some(k => k in n)) throw new Error('ciblage : format {vus, garder, ajouter, confirme} attendu — les clés se lisent par « جيب الولايات » (التحضير), jamais un pays ni des régions écrites telles quelles');
  const a = ancien && ancien.type === 'regions' && Array.isArray(ancien.regions) ? ancien : { type: 'regions', regions: [] };
  const vus = new Set((Array.isArray(n.vus) ? n.vus : []).map(String)), garder = new Set((Array.isArray(n.garder) ? n.garder : []).map(String));
  let regions = a.regions.filter(r => r && /^\d{1,12}$/.test(String(r.key)) && (!vus.has(String(r.key)) || garder.has(String(r.key))));
  const ajoutees = new Set();
  for (const x of Array.isArray(n.ajouter) ? n.ajouter : []) {
    const key = String(x?.key ?? '').trim(), w = WILAYAS_NORD.find(y => y === x?.wilaya);
    if (!/^\d{1,12}$/.test(key) || !w) throw new Error('wilaya ajoutée invalide : une clé Meta en chiffres et une des 25 wilayas');
    regions = regions.filter(r => String(r.key) !== key && r.wilaya !== w); regions.push({ key, nom: w, wilaya: w, source: 'client' }); ajoutees.add(key);
  }
  // une clé lue chez Meta ENTRE-TEMPS (« جيب الولايات » pendant que la page était ouverte) reste dans la liste, mais elle
  // n'est jamais confirmée à l'aveugle : la page ne l'a pas montrée (07/10/2026, « casse » : elle partait confirmée).
  // Sans « vus » (un appel de l'API qui a relu GET /api/reglages), tout ce qui est lu compte comme vu.
  const pasVues = Array.isArray(n.vus) ? regions.filter(r => !vus.has(String(r.key)) && !ajoutees.has(String(r.key))) : [];
  const confirme = n.confirme === true && regions.length > 0 && !pasVues.length;
  const meme = confirme && a.confirme === true && regions.map(r => String(r.key)).sort().join() === a.regions.map(r => String(r.key)).sort().join();
  const { confirmeLe, ...reste } = a;
  return { ...reste, type: 'regions', regions, manquent: WILAYAS_NORD.filter(w => !regions.some(r => r.wilaya === w)), confirme, ...(confirme ? { confirmeLe: meme && confirmeLe ? confirmeLe : new Date().toISOString() } : {}) };
}
/** Une LECTURE de « جيب الولايات » (recouperRegions) posée sur ce qui est déjà dans les réglages : les clés ajoutées À LA
 *  MAIN par le client (source « client ») restent et passent avant la clé lue de leur wilaya (le client l'avait corrigée) ;
 *  la confirmation est gardée seulement si la liste est EXACTEMENT la même (07/10/2026, « casse » : une relecture
 *  effaçait les clés tapées à la main et la confirmation, et le test suivant s'arrêtait). Rend le ciblage à écrire. */
export function ciblageLu(x, ancien) {
  const a = ancien && ancien.type === 'regions' && Array.isArray(ancien.regions) ? ancien : null;
  const main = [];
  for (const r of a ? a.regions : []) if (r && r.source === 'client' && /^\d{1,12}$/.test(String(r.key)) && WILAYAS_NORD.includes(r.wilaya) && !main.some(y => y.wilaya === r.wilaya || y.key === String(r.key))) main.push({ ...r, key: String(r.key) });
  const regions = [...(x.regions || []).filter(r => !main.some(y => y.wilaya === r.wilaya || y.key === String(r.key))), ...main];
  // une wilaya que la lecture n'a pas trouvée (aucun ad set du client ne la vise : la plupart visent toute l'Algérie) garde la
  // clé qu'elle avait — celle du PAQUET au départ : relire ne vide jamais la liste, et une wilaya décochée par le client ne revient pas
  for (const r of a ? a.regions : []) if (r && WILAYAS_NORD.includes(r.wilaya) && /^\d{1,12}$/.test(String(r.key)) && !regions.some(y => y.wilaya === r.wilaya || String(y.key) === String(r.key))) regions.push({ ...r, key: String(r.key) });
  const cles = l => l.map(r => String(r.key)).sort().join();
  const meme = !!a && a.confirme === true && cles(regions) === cles(a.regions);
  return { type: 'regions', regions, manquent: WILAYAS_NORD.filter(w => !regions.some(r => r.wilaya === w)), doublons: x.doublons || [], luLe: new Date().toISOString(), confirme: meme, ...(meme && a.confirmeLe ? { confirmeLe: a.confirmeLe } : {}) };
}
/** Le ciblage du test ET de la scale : les régions CONFIRMÉES — celles du paquet tant que le client n'a rien changé, sinon
 *  les siennes (الإعدادات) — jamais un pays entier. Rend { cles, targeting } ou { faute } (rien ne doit alors partir chez Meta). */
export function ciblageWilayas(c) {
  if (c === null || c === undefined) c = ciblageDuPaquet();
  if (!c || typeof c !== 'object' || c.type !== 'regions' || !Array.isArray(c.regions)) return { faute: 'aucune wilaya lue chez Meta (التحضير : « جيب الولايات »)' };
  const cles = [...new Set(c.regions.map(x => String(x && typeof x === 'object' ? x.key ?? '' : x ?? '').trim()))];
  if (!cles.length || cles.some(k => !/^\d{1,12}$/.test(k))) return { faute: 'aucune clé de wilaya valable dans les réglages (التحضير : « جيب الولايات »)' };
  if (c.confirme !== true) return { faute: 'les wilayas lues ne sont pas encore confirmées par le client (الإعدادات)' };
  return { cles, targeting: { geo_locations: { regions: cles.map(key => ({ key })) } } };
}
/** Le targeting d'un ad set (créé : son entrée ; repris : sa lecture brute) est-il EXACTEMENT ces régions ? Des régions et
 *  rien d'autre dans geo_locations (ni countries — surtout pas « DZ » —, ni villes, ni zones), chaque clé une fois, aucune
 *  audience enregistrée à la place. Rend la faute (texte court) ou null. */
export function fauteCiblage(t, cles, entree = {}) {
  if (entree && (entree.saved_audience_id || entree.saved_audience)) return 'audience enregistrée au lieu des wilayas';
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch { return 'targeting illisible'; } }
  if (!t || typeof t !== 'object' || Array.isArray(t)) return 'targeting absent';
  let g = t.geo_locations; if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = null; } }
  if (!g || typeof g !== 'object' || Array.isArray(g)) return 'geo_locations absent';
  const vide = v => v === undefined || v === null || (Array.isArray(v) && !v.length);
  const autres = Object.keys(g).filter(k => !['regions', 'location_types'].includes(k) && !vide(g[k]));
  if (autres.length) return `geo_locations porte ${autres.map(k => k + (k === 'countries' ? ' ' + JSON.stringify(g[k]) : '')).join(', ')} : pas seulement les wilayas`;
  const lus = (Array.isArray(g.regions) ? g.regions : []).map(x => String(x && typeof x === 'object' ? x.key ?? '' : x ?? '').trim());
  const a = [...new Set(lus)].sort(), b = [...new Set(cles.map(String))].sort();
  if (a.length !== lus.length || a.join() !== b.join()) return `régions [${lus.slice(0, 6).join(', ')}${lus.length > 6 ? '…' : ''}] au lieu des ${b.length} wilayas confirmées`;
  return null;
}

/* ---------- [v19-trois] 15/10/2026 : LE PIXEL PAR COMPTE (fonction éprouvée sur la chaîne du vendeur, portée en AJOUT) ----------
 * En mode « site », le client choisit SON pixel parmi ceux du compte CHOISI — lus EN VRAI chez Meta (ads_get_datasets, par le
 * jeton ou le connecteur, à « جيب الكونتات ») et gardés PAR COMPTE (comptes[].pixels). À la campagne, le bureau relit les pixels
 * de CE compte dans la réponse BRUTE (un tour de lecture seule) et ne garde que celui qui porte ce nom (et cet id) ; absent → REFUS,
 * rien n'est créé chez Meta, la question est reposée avec les pixels du compte — JAMAIS un repli silencieux sur un autre pixel.
 * Sans pixel choisi (compte dont les pixels n'ont pas été lus, mission d'avant) : l'ancienne loi, intacte. */
export const PIXELS_BOUTONS = 8;
/** Deux noms de pixel égaux sans tenir compte de la casse ni des espaces (la règle de sa chaîne, _meme_nom). */
export const memeNomPixel = (a, b) => { const n = x => String(x ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); return n(a) !== '' && n(a) === n(b); };
const sansActPx = x => String(x ?? '').trim().replace(/^act_/, '');
const jsonsPx = t => { const out = []; const s = String(t ?? ''); try { out.push(JSON.parse(s)); return out; } catch {} const re = /\{[\s\S]*\}/g; let x; while ((x = re.exec(s))) { try { out.push(JSON.parse(x[0])); } catch {} } return out; };
/** Les pixels d'UN compte tels que Meta les a rendus (ads_get_datasets, réponses BRUTES, appels réussis dont l'entrée vise ce
 *  compte — jamais un business, jamais un autre compte) : [{id, nom, dernierTir}], du dernier tir au plus ancien, sans doublon.
 *  null : aucune lecture réussie de ce compte (pas lu ≠ lu vide). */
export function pixelsDuBrut(appels, compte) {
  const lus = (appels || []).filter(a => /__ads_get_datasets$/.test(String(a && a.nom || '')) && !a.erreur).filter(a => {
    const e = entreeBrute(a); if (e.business_id !== undefined && e.business_id !== null && e.business_id !== '') return false;
    return e.ad_account_id !== undefined && sansActPx(e.ad_account_id) !== '' && sansActPx(e.ad_account_id) === sansActPx(compte);
  });
  if (!lus.length) return null;
  const vus = new Map();
  const marcher = o => {
    if (Array.isArray(o)) return o.forEach(marcher);
    if (!o || typeof o !== 'object') return;
    if (o.dataset_id !== undefined && o.dataset_id !== null && o.name !== undefined && o.name !== null) { const id = String(o.dataset_id); if (!vus.has(id)) vus.set(id, { id, nom: String(o.name), dernierTir: o.last_fired_time ? String(o.last_fired_time) : '' }); }
    for (const v of Object.values(o)) { if (v && typeof v === 'object') marcher(v); else if (typeof v === 'string' && /dataset_id/.test(v)) jsonsPx(v).forEach(marcher); }
  };
  for (const a of lus) jsonsPx(a.sortie).forEach(marcher);
  return [...vus.values()].sort((x, y) => (y.dernierTir || '').localeCompare(x.dernierTir || ''));
}
/** Le pixel voulu ({id?, nom}) parmi les pixels LUS du compte : l'id (s'il est connu) ET le même nom ; sans id, UN seul pixel de ce
 *  nom. Rend le pixel lu, ou null (absent, ou deux pixels du même nom sans id pour trancher : jamais choisir à sa place). */
export function choisirPixel(lus, voulu) {
  if (!Array.isArray(lus) || !voulu || !String(voulu.nom || '').trim()) return null;
  if (voulu.id) { const p = lus.find(x => String(x.id) === String(voulu.id)); return p && memeNomPixel(p.nom, voulu.nom) ? p : null; }
  const m = lus.filter(x => memeNomPixel(x.nom, voulu.nom));
  return m.length === 1 ? m[0] : null;
}
/** La 2e méthode après la création du test : chaque ad set CRÉÉ porte promoted_object.pixel_id = le pixel choisi et relu.
 *  Rend la faute (texte court) ou ''. */
export function fautePixelCreation(appels, pixelId) {
  for (const a of (appels || []).filter(x => /__ads_create_ad_set$/.test(String(x && x.nom || '')))) {
    const e = entreeBrute(a); let po = e.promoted_object; if (typeof po === 'string') { try { po = JSON.parse(po); } catch { po = null; } }
    const lu = po && typeof po === 'object' ? String(po.pixel_id ?? '') : '';
    if (lu !== String(pixelId)) return `ad set « ${e.ad_set_name || e.name || '?'} » créé avec le pixel ${lu || 'absent'} au lieu de ${pixelId}`;
  }
  return '';
}

/* ---------------------------------- l'ACTIVATION relue (09/10/2026) ---------------------------------- */
// Les statuts de Meta : actif (la pub tourne ou va tourner sans rien d'autre), refusé, en cours de publication (un compte en
// mode brouillon rend PUBLISHING ; DRAFT seulement si une publication a été ENVOYÉE), le reste = à l'arrêt.
export const STATUT_ACTIF = /^(ACTIVE|IN_PROCESS|PENDING_REVIEW|PREAPPROVED)$/i;
export const STATUT_REFUS = /^(DISAPPROVED|REJECTED|WITH_ISSUES|ERROR|FAILED)$/i;
/** [porte-groupee] 10/10/2026 : un ad set activé avec une heure de début FUTURE (start_time) — Meta le rend « programmé »
 *  (SCHEDULED, PENDING, ou un autre statut de début à venir). Ce n'est JAMAIS un échec : le statut brut de Meta l'emporte,
 *  comme PUBLISHING et DRAFT après une publication envoyée. Il compte comme lancé (trancher). NON PROUVÉ chez Meta : le nom
 *  exact du statut rendu pour un début futur se mesure au premier vrai essai. */
export const STATUT_PROGRAMME = /^(SCHEDULED|PENDING|PENDING_START|NOT_STARTED|NOT_YET_STARTED)$/i;
export function classeStatut(statut, publiee = false) {
  const s = String(statut ?? '').trim().toUpperCase();
  if (!s || s === 'NULL' || s === 'UNDEFINED') return 'inconnu';
  if (STATUT_ACTIF.test(s)) return 'actif';
  if (STATUT_PROGRAMME.test(s)) return 'programme';
  if (STATUT_REFUS.test(s)) return 'refus';
  if (s === 'PUBLISHING') return 'encours';
  if (s === 'DRAFT') return publiee ? 'encours' : 'arret';
  return 'arret';
}
const RANG_STATUT = { actif: 4, programme: 3.5, refus: 3, encours: 2, arret: 1, inconnu: 0 };
const entreeBrute = a => { let e = a && a.entree; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } } return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; };
export const appelsActivation = appels => (appels || []).filter(a => /__ads_activate_entity$/.test(String(a.nom || '')));
/** Une PUBLICATION de brouillon a-t-elle été envoyée (object_ids ou publish_as_active) ? Alors DRAFT = encore en cours. */
export const publieDans = appels => appelsActivation(appels).some(a => { const e = entreeBrute(a); return e.object_ids !== undefined || e.publish_as_active === true || e.publish_as_active === 'true'; });
/** Le statut BRUT de chaque objet de la mission, lu dans les réponses de Meta (ads_get_ad_entities, et la réponse de
 *  ads_activate_entity quand elle porte un statut) ; plusieurs lectures (live puis draft) : le statut le PLUS AVANCÉ gagne
 *  (actif, puis refusé, puis en cours, puis le reste). Dans un objet : effective_status, sinon status, sinon
 *  configured_status. Un objet d'une AUTRE campagne n'est jamais lu. Rend Map id → { classe, statut }. */
export function statutsBruts(appels, objets, publiee = false) {
  const permis = new Set((objets || []).map(String)), vus = new Map();
  const poser = (id, statut) => { const k = String(id); if (!permis.has(k)) return; const c = classeStatut(statut, publiee); if (c === 'inconnu') return; const v = vus.get(k); if (!v || RANG_STATUT[c] > RANG_STATUT[v.classe]) vus.set(k, { classe: c, statut: String(statut).toUpperCase() }); };
  const statutDe = o => [o.effective_status, o.status, o.configured_status].find(v => v !== undefined && v !== null && typeof v !== 'object');
  const marcher = (o, prof = 0) => {
    if (prof > 40) return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1)); if (!o || typeof o !== 'object') return;
    const id = [o.id, o.ad_object_id, o.entity_id].find(v => v !== undefined && v !== null && typeof v !== 'object'), st = statutDe(o);
    if (id !== undefined && st !== undefined) poser(id, st);
    for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1);
  };
  for (const a of appels || []) {
    if (a.erreur) continue;
    if (/__ads_get_ad_entities$/.test(String(a.nom || ''))) jsonsTexte(a.sortie).forEach(j => marcher(j));
    else if (/__ads_activate_entity$/.test(String(a.nom || ''))) for (const j of jsonsTexte(a.sortie)) {
      if (!j || typeof j !== 'object' || j.error || j.success === false) continue;
      marcher(j);
      const st = statutDe(j), e = entreeBrute(a);
      if (!Array.isArray(j) && j.id === undefined && j.entity_id === undefined && st !== undefined && e.entity_id !== undefined) poser(e.entity_id, st);
    }
  }
  return vus;
}
/* ------------------------- TOUT NAÎT EN PAUSE, PAR ID JAMAIS PAR NOM (09/10/2026) ------------------------- */
// Vu sur la chaîne du vendeur : dans un compte en mode brouillon, les entités créées portaient le statut ACTIVE (un « Publier »
// cliqué à la main dans Ads Manager aurait dépensé sans sa porte). Les objets créés (campagne, ad sets, annonces) sont RELUS :
// status / configured_status autre que PAUSED (DRAFT : le marqueur du brouillon, toléré), ou un statut effectif qui tourne
// (ACTIVE, IN_PROCESS, PENDING_REVIEW, PREAPPROVED, PUBLISHING) → l'étape REFUSE, le dit, rien n'est activé.
const STATUT_PAUSE_OK = /^(PAUSED|DRAFT)$/i;
/** Les objets de la mission (ids) relus NON en pause dans les réponses BRUTES (lectures d'entités et réponses des
 *  créations). Rend [{ id, champ, statut }] ; [] quand tout ce qui est relu est en pause. */
export function nonPauses(appels, objets) {
  const permis = new Set((objets || []).map(String)), fautes = new Map();
  const marcher = (o, prof = 0) => {
    if (prof > 40) return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1)); if (!o || typeof o !== 'object') return;
    const id = [o.id, o.ad_object_id, o.entity_id].find(v => v !== undefined && v !== null && typeof v !== 'object');
    if (id !== undefined && permis.has(String(id))) {
      for (const champ of ['status', 'configured_status']) { const v = o[champ]; if (v !== undefined && v !== null && typeof v !== 'object' && !STATUT_PAUSE_OK.test(String(v).trim())) fautes.set(`${id}|${champ}`, { id: String(id), champ, statut: String(v).toUpperCase() }); }
      const e = o.effective_status; if (e !== undefined && e !== null && typeof e !== 'object' && (STATUT_ACTIF.test(String(e).trim()) || /^PUBLISHING$/i.test(String(e).trim()))) fautes.set(`${id}|effective_status`, { id: String(id), champ: 'effective_status', statut: String(e).toUpperCase() });
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1);
  };
  for (const a of appels || []) {
    if (a.erreur || !/__ads_(get_ad_entities|create_campaign|create_ad_set|create_ad)$/.test(String(a.nom || ''))) continue;
    for (const j of jsonsTexte(a.sortie)) marcher(j);
    // la réponse d'une création sans « id » (« {campaign_id, status} ») : l'id créé est le sien
    if (/__ads_create_/.test(String(a.nom || ''))) for (const j of jsonsTexte(a.sortie)) {
      if (!j || typeof j !== 'object' || Array.isArray(j) || j.id !== undefined) continue;
      const id = j.campaign_id ?? j.ad_set_id ?? j.ad_id; if (id !== undefined && permis.has(String(id)) && j.status !== undefined && !STATUT_PAUSE_OK.test(String(j.status).trim())) fautes.set(`${id}|status`, { id: String(id), champ: 'status', statut: String(j.status).toUpperCase() });
    }
  }
  return [...fautes.values()];
}
/** Au moins un statut relu (status, configured_status, effective_status) pour ces objets dans les réponses brutes ? */
export function statutsLusDe(appels, objets) {
  const permis = new Set((objets || []).map(String)); let vu = false;
  const marcher = (o, prof = 0) => { if (vu || prof > 40 || !o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1));
    const id = o.id ?? o.ad_object_id; if (id !== undefined && permis.has(String(id)) && ['status', 'configured_status', 'effective_status'].some(k => o[k] !== undefined && o[k] !== null)) vu = true;
    for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1); };
  for (const a of appels || []) if (!a.erreur && /__ads_(get_ad_entities|create_campaign|create_ad_set|create_ad)$/.test(String(a.nom || ''))) jsonsTexte(a.sortie).forEach(j => marcher(j));
  return vu;
}
/* ---- passe « casser » (09/10/2026, casse-4) : AJOUTS à la relecture de la pause et des homonymes ---- */
/** Les ids CRÉÉS dans ce tour (réponses brutes de ads_create_campaign / ad_set / ad, sans erreur) : un objet créé en plus,
 *  que Claude ne rend pas, est relu lui aussi (une annonce glissée ACTIVE ne passe plus derrière la liste rendue). */
export function idsCreesDansLeTour(appels) {
  const ids = new Set();
  for (const a of appels || []) {
    if (a.erreur || !/__ads_create_(campaign|ad_set|ad)$/.test(String(a.nom || ''))) continue;
    for (const j of jsonsTexte(a.sortie)) if (j && typeof j === 'object' && !Array.isArray(j)) { const id = j.id ?? j.campaign_id ?? j.ad_set_id ?? j.adset_id ?? j.ad_id; if (id !== undefined && id !== null && typeof id !== 'object' && String(id).trim()) ids.add(String(id).trim()); }
  }
  return [...ids];
}
/** Un statut relu sous forme d'OBJET (« status: { value: "ACTIVE" } ») : nonPauses ne lisait que les chaînes. Rend les
 *  fautes du même format que nonPauses. */
export function nonPausesObjets(appels, objets) {
  const permis = new Set((objets || []).map(String)), fautes = new Map();
  const texte = v => (v && typeof v === 'object' && !Array.isArray(v)) ? [v.value, v.name, v.status].find(x => typeof x === 'string') : undefined;
  const marcher = (o, prof = 0) => {
    if (prof > 40) return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1)); if (!o || typeof o !== 'object') return;
    const id = [o.id, o.ad_object_id, o.entity_id].find(v => v !== undefined && v !== null && typeof v !== 'object');
    if (id !== undefined && permis.has(String(id))) for (const champ of ['status', 'configured_status', 'effective_status']) {
      const v = texte(o[champ]); if (v === undefined) continue;
      const mauvais = champ === 'effective_status' ? (STATUT_ACTIF.test(v.trim()) || /^PUBLISHING$/i.test(v.trim())) : !STATUT_PAUSE_OK.test(v.trim());
      if (mauvais) fautes.set(`${id}|${champ}`, { id: String(id), champ, statut: v.toUpperCase() });
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1);
  };
  for (const a of appels || []) if (!a.erreur && /__ads_(get_ad_entities|create_campaign|create_ad_set|create_ad)$/.test(String(a.nom || ''))) jsonsTexte(a.sortie).forEach(j => marcher(j));
  return [...fautes.values()];
}
/** Une CRÉATION envoyée avec un statut autre que PAUSED (« active » en minuscules, configured_status ACTIVE…) : la garde
 *  d'avant ne voyait que « "status":"ACTIVE" ». Rend la première faute lue, ou null. */
export function creationHorsPause(appels) {
  for (const a of appels || []) {
    if (!/__ads_create_(campaign|ad_set|ad)$/.test(String(a.nom || ''))) continue;
    const t = JSON.stringify(a.entree || {}).replace(/\\+"/g, '"');
    const x = /"(status|configured_status)"\s*:\s*"([^"]*)"/gi; let k;
    while ((k = x.exec(t))) if (!/^\s*PAUSED\s*$/i.test(k[2])) return `${String(a.nom).replace(/^.*__/, '')} envoyée avec ${k[1]} « ${k[2]} » au lieu de PAUSED`;
  }
  return null;
}
/** Une PUBLICATION ou une ACTIVATION dans un tour de CRÉATION (campagne, scale) : ces tours n'ont aucun outil pour ça ; un
 *  appel d'activation, de mise à jour ou de publication lu dans leurs appels bruts = un objet a pu s'allumer sans la porte
 *  « لانسي ». Rend les noms d'outils fautifs. */
export const activationsDansCreation = appels => [...new Set((appels || []).map(a => String(a.nom || '').replace(/^.*__/, '')).filter(n => /^ads_(activate_entity|update_entity)$|publish/i.test(n)))];
/** LES HOMONYMES : les CAMPAGNES lues dans Meta (réponses brutes de ads_get_ad_entities) qui portent la clé de la mission
 *  dans leur nom, ou exactement son nom. Une campagne = un objet lu avec un nom et sans campaign_id / adset_id (un ad set
 *  porte campaign_id, une annonce adset_id). Rend les ids distincts, dans l'ordre de lecture. */
export function homonymesCampagne(appels, { cle = '', nom = '', exclure = [], nomsExclus = [] } = {}) {
  const ids = [], k = String(cle || '').trim(), n = String(nom || '').trim(), horsIds = new Set(exclure.map(String)), horsNoms = new Set(nomsExclus.map(x => String(x).trim()));
  const marcher = (o, prof = 0) => {
    if (prof > 40) return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1)); if (!o || typeof o !== 'object') return;
    const id = o.id ?? o.ad_object_id, nm = o.name ?? o.campaign_name;
    if (id !== undefined && id !== null && typeof id !== 'object' && typeof nm === 'string' && o.campaign_id === undefined && o.adset_id === undefined && o.ad_set_id === undefined && o.creative === undefined
      && !/^(adset|ad|ad_set)$/i.test(String(o.level ?? '')) && !horsIds.has(String(id)) && !horsNoms.has(nm.trim())
      && ((k && nm.includes(k)) || (n && nm.trim() === n)) && !ids.includes(String(id))) ids.push(String(id));
    for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1);
  };
  for (const a of appels || []) if (!a.erreur && /__ads_get_ad_entities$/.test(String(a.nom || ''))) jsonsTexte(a.sortie).forEach(j => marcher(j));
  // casse-4 : une campagne lue en LIGNE sans « id » (« {campaign_id, campaign_name} », niveau campagne) est une campagne ;
  // et un nom écrit autrement (casse, espaces) est le même nom
  const plat = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const enLigne = (o, prof = 0) => {
    if (prof > 40) return; if (Array.isArray(o)) return o.forEach(x => enLigne(x, prof + 1)); if (!o || typeof o !== 'object') return;
    const id = (o.id === undefined || o.id === null) && (o.ad_object_id === undefined || o.ad_object_id === null) ? o.campaign_id : undefined, nm = o.campaign_name ?? o.name;
    if (id !== undefined && id !== null && typeof id !== 'object' && typeof nm === 'string' && o.adset_id === undefined && o.ad_set_id === undefined && o.ad_id === undefined && o.adset_name === undefined && o.ad_name === undefined
      && !horsIds.has(String(id)) && !horsNoms.has(nm.trim()) && ((k && nm.includes(k)) || (n && plat(nm) === plat(n))) && !ids.includes(String(id))) ids.push(String(id));
    for (const v of Object.values(o)) if (v && typeof v === 'object') enLigne(v, prof + 1);
  };
  for (const a of appels || []) if (!a.erreur && /__ads_get_ad_entities$/.test(String(a.nom || ''))) jsonsTexte(a.sortie).forEach(j => enLigne(j));
  return ids;
}
/** La campagne visée PAR ID quand plusieurs portent la clé ou le même nom : celle dont l'id est déjà dans la mission
 *  (idConnu) ; sans id connu, ou si la rendue n'est pas celle-là → refus (jamais choisir, ni la plus récente, ni par le nom).
 *  Rend null (rien à dire) ou la raison du refus. */
export function refusHomonymes(appels, { cle, nom, idRendu, idConnu, exclure = [], nomsExclus = [] }) {
  const h = homonymesCampagne(appels, { cle, nom, exclure, nomsExclus });
  if (h.length < 2) return null;
  const rendu = String(idRendu ?? ''), connu = idConnu ? String(idConnu) : '';
  if (connu && h.includes(connu)) return rendu === connu ? null : `${h.length} campagnes portent la clé ou le nom (${h.join(', ')}) : la mission vise ${connu}, pas ${rendu || 'aucune'}`;
  return `${h.length} campagnes portent la clé ou le nom (${h.join(', ')}) et aucune n'a son id dans la mission : rien n'est choisi`;
}
/** LA décision, une seule fonction (09/10/2026, « casse » : le tour d'activation et la relecture décidaient chacun à sa façon) :
 *  attendre (un objet en cours ou pas relu), lancee (tout actif), partielle (un actif, le reste refusé ou à l'arrêt : la pub
 *  tourne, le suivi est GARDÉ), refusee (un refus, rien d'actif ni d'en attente), echec (rien ne tourne). */
export function trancher(classes) {
  const v = Array.isArray(classes) ? classes : Object.values(classes || {});
  if (!v.length || v.some(c => c === 'encours' || c === 'inconnu')) return 'attendre';
  // [porte-groupee] « programmé » (début futur) compte comme actif : la pub est lancée, elle dépensera à son heure
  if (v.every(c => c === 'actif' || c === 'programme')) return 'lancee';
  if (v.some(c => c === 'actif' || c === 'programme')) return 'partielle';
  if (v.some(c => c === 'refus')) return 'refusee';
  return 'echec';
}
/** Un tour d'activation ou de relecture → la décision. Le statut BRUT d'abord ; sans lui, la phrase de Claude ne compte que
 *  pour « actif » ou « en cours », et seulement si Meta a été RELU dans ce tour (un refus ou un arrêt que Meta ne montre pas
 *  = « pas relu » : on attend la relecture). */
export function lireActivation(r, objets, publiee = false) {
  const appels = (r && r.appels) || [], bruts = statutsBruts(appels, objets, publiee);
  const relu = appels.some(a => /__ads_get_ad_entities$/.test(String(a.nom || '')) && !a.erreur);
  const dits = new Map(((r && r.structure && r.structure.statuts) || []).filter(x => x && x.id !== undefined).map(x => [String(x.id), x.statut]));
  const classes = {};
  for (const id of objets.map(String)) {
    const b = bruts.get(id);
    if (b) { classes[id] = b.classe; continue; }
    const c = relu ? classeStatut(dits.get(id), publiee) : 'inconnu';
    classes[id] = c === 'actif' || c === 'encours' || c === 'programme' ? c : 'inconnu';
  }
  return { verdict: trancher(classes), classes, bruts };
}
/* ------------- [porte-groupee] 10/10/2026 : LA PORTE « لانسي » GROUPÉE DU LOT, HEURES DE DÉBUT PROGRAMMÉES -------------
 * Décision du vendeur : les campagnes de tous les modèles d'un lot se créent EN MÊME TEMPS (en pause) ; UNE question de lot
 * « لانسي / ماشي دروك » quand plus aucun modèle n'est en route ; à la validation, chaque modèle reçoit une heure de début
 * (start_time sur CHACUN de ses ad sets) : H0 = la prochaine heure RONDE au moins trente minutes après la validation, puis
 * + écart (réglage ecartMetaHeures, défaut 2 h, 0 = tous à H0) par rang. Même lecture que la chaîne du vendeur : l'heure
 * annoncée au client = l'heure posée chez Meta. */
export const ECART_META_DEFAUT = 2, ECART_META_MAXI = 12, AVANCE_MINI_MS = 30 * 60000;
/** L'écart entre deux modèles, en heures : un entier de 0 à 12 ; une valeur abîmée vaut 2. */
export const ecartMetaDe = v => { if (v === undefined || v === null || v === '' || typeof v === 'boolean') return ECART_META_DEFAUT; const n = +v; return Number.isInteger(n) && n >= 0 && n <= ECART_META_MAXI ? n : ECART_META_DEFAUT; };
/** H0 : la prochaine heure ronde (heure locale de la machine du client) au moins trente minutes après t. */
export function prochaineHeureRonde(t) {
  const d = new Date(t + AVANCE_MINI_MS);
  if (d.getMinutes() || d.getSeconds() || d.getMilliseconds()) { d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); }
  return d.getTime();
}
/** Les heures de début d'une porte GROUPÉE validée à t : le modèle k (1..n, dans l'ordre des rangs du lot) à H0 + (k-1) × écart. */
export const heuresGroupe = (t, n, ecart) => { const h0 = prochaineHeureRonde(t); return Array.from({ length: n }, (_, i) => h0 + i * ecart * 3600000); };
/** Les heures d'un modèle débloqué APRÈS la porte groupée : H_dernière + écart (puis + écart pour un deuxième) si ce créneau est
 *  encore à venir (au moins dix minutes), sinon null = tout de suite (aucune heure posée). */
export const MARGE_CRENEAU_MS = 10 * 60000;
export const heuresApres = (t, n, ecart, derniere) => Array.from({ length: n }, (_, i) => { const c = Number.isFinite(derniere) ? derniere + (i + 1) * ecart * 3600000 : null; return c !== null && c >= t + MARGE_CRENEAU_MS ? c : null; });
const lireDateMeta = v => { const t = String(v ?? '').trim(); if (!t) return NaN; const n = Date.parse(t.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); return Number.isFinite(n) ? n : (/^\d{9,11}$/.test(t) ? +t * 1000 : NaN); };
/** LA VÉRIFICATION APRÈS COUP d'un tour d'activation programmé, dans les appels BRUTS : l'heure posée par ads_update_entity
 *  sur CHAQUE ad set du test (le seul champ start_time, l'heure annoncée à une minute près, sans refus de Meta, AVANT la
 *  première activation), relue ensuite par ads_get_ad_entities ; aucun autre champ ni aucun budget touché, aucun autre objet.
 *  heureMs null : aucune heure ne devait être posée (toute mise à jour est une faute). Rend la liste des fautes ([] = juste). */
export function verifierHeurePosee(appels, { adSets = [], heureMs = null, budgetCentimes = null } = {}) {
  const sets = (adSets || []).map(String), fautes = [], liste = appels || [];
  const premiere = liste.findIndex(a => /__ads_activate_entity$/.test(String(a.nom || '')));
  const poses = new Map();
  const refus = a => a.erreur || a.sortie === null || a.sortie === undefined || jsonsTexte(a.sortie).some(j => j && typeof j === 'object' && (j.error || j.success === false || j.success === 'false'));
  liste.forEach((a, i) => {
    if (!/__ads_update_entity$/.test(String(a.nom || ''))) return;
    const e = entreeBrute(a), id = String(e.entity_id ?? '').trim() || '?';
    let f = e.fields; if (typeof f === 'string') { try { f = JSON.parse(f); } catch { f = null; } }
    const cles = f && typeof f === 'object' && !Array.isArray(f) ? Object.keys(f) : [];
    if (cles.some(k => /budget/i.test(k))) fautes.push(`budget touché sur ${id} pendant l'activation`);
    if (cles.join() !== 'start_time') { fautes.push(`${id} touché avec ${JSON.stringify(f ?? e.fields ?? null).slice(0, 60)} au lieu du seul start_time`); return; }
    if (!sets.includes(id)) { fautes.push(`start_time posé hors des ad sets de ce test (${id})`); return; }
    if (heureMs === null) { fautes.push(`start_time posé sur ${id} sans heure programmée`); return; }
    const ms = lireDateMeta(f.start_time);
    if (!Number.isFinite(ms) || Math.abs(ms - heureMs) > 60000) { fautes.push(`${id} : start_time ${String(f.start_time).slice(0, 30)} au lieu de l'heure annoncée`); return; }
    if (refus(a)) { fautes.push(`${id} : Meta a refusé start_time`); return; }
    if (!poses.has(id)) poses.set(id, i);
  });
  if (heureMs === null) return [...new Set(fautes)];
  const relus = new Map();
  liste.forEach((a, i) => {
    if (a.erreur || !/__ads_get_ad_entities$/.test(String(a.nom || ''))) return;
    const marcher = (o, prof = 0) => { if (prof > 40 || !o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1));
      const id = [o.id, o.ad_object_id].find(v => v !== undefined && v !== null && typeof v !== 'object');
      if (id !== undefined && sets.includes(String(id)) && o.start_time !== undefined && o.start_time !== null) relus.set(String(id), { ms: lireDateMeta(o.start_time), i, brut: String(o.start_time), budget: o.daily_budget });
      for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1); };
    jsonsTexte(a.sortie).forEach(j => marcher(j));
  });
  for (const id of sets) {
    if (!poses.has(id)) { fautes.push(`heure non posée sur l'ad set ${id}`); continue; }
    if (premiere >= 0 && poses.get(id) > premiere) fautes.push(`heure posée sur ${id} APRÈS l'activation`);
    const r = relus.get(id);
    if (!r || r.i < poses.get(id)) fautes.push(`heure de l'ad set ${id} non relue dans Meta après l'envoi`);
    else {
      if (!Number.isFinite(r.ms) || Math.abs(r.ms - heureMs) > 60000) fautes.push(`${id} relu avec start_time ${r.brut.slice(0, 30)} au lieu de l'heure annoncée`);
      if (budgetCentimes !== null && r.budget !== undefined && r.budget !== null && +r.budget !== +budgetCentimes) fautes.push(`${id} relu avec un budget ${r.budget} au lieu de ${budgetCentimes}`);
    }
  }
  return [...new Set(fautes)];
}
const resumeClasses = classes => { const g = {}; for (const [id, c] of Object.entries(classes)) (g[c] = g[c] || []).push(id); return Object.entries(g).map(([c, ids]) => `${c} ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? '…' : ''}`).join(' · '); };
/** Les tours qui n'ont PAS besoin de la skill (leur message donne les outils et les champs exacts, leur sortie est recoupée
 *  dans la réponse brute) : la skill n'y fait que des jetons (23 316 caractères au lieu de 3 435 pour « photos »). Gardent
 *  leur skill : textes, page, campagne, la lecture du soir, gagnant et scale (la méthode du vendeur y sert). */
export const ETAPES_SANS_SKILL = new Set(['photos', 'publication', 'videos', 'activation', 'activation-relire', 'activation-scale', 'relire-scale', 'pause', 'hausse', 'page-description', 'publication-variantes', 'lecture-variantes']);
/** Un modèle LÉGER au premier essai seulement (le modèle du bureau prend le relais après un échec) pour les tours dont la
 *  seule affirmation est relue dans la réponse brute : l'URL rendue par upload_image, isActive relu par get_product, le statut
 *  brut de Meta. JAMAIS pour la lecture des planches, les textes, la page, la campagne, l'activation, la lecture du soir ni la
 *  pause. */
export const MODELE_LEGER = { photos: 'haiku', publication: 'haiku', 'activation-relire': 'haiku', 'relire-scale': 'haiku' };

/* ---------------------------------- les TEXTES : le script d'angles du vendeur ---------------------------------- */
/** Le script du vendeur, copié tel quel à côté de la skill de la page (il ne porte aucun nom). */
export const FICHIER_SCRIPT_ANGLES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'skills', 'page', 'SCRIPT-ANGLES-MARKETING.json');
export function lireScriptAngles(fichier = FICHIER_SCRIPT_ANGLES) {
  const j = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  if (!j || !j.content_angle_expansion || !j.mandatory_angle_template) throw new Error('script d\'angles incomplet');
  return j;
}
// La loi de forme des textes, la MÊME que les outils de la maison : le mot COD (manita-testing.py COD_INTERDIT), les mots
// marocains, les promesses de gain (manita-testing.py MAROCAIN / PROMESSE_GAIN, manita-produit.py MOTS_INTERDITS).
const COD_INTERDIT = /\bc[\s.\-_]*o[\s.\-_]*d\b|\bcash[\s-]+on[\s-]+deliver/i;
const MOTS_INTERDITS = ['تحوّس', 'تحوس', 'الكاس', 'الصوردي', 'تحوسي', 'تحوّسي', 'دابا', 'واخا',
  'مضمون', 'مضمونة', 'تربح', 'تربحي', 'ربح مضمون', 'نضمنلك', 'مليونير', 'بلا خسارة', 'garanti', 'garantie', 'assure', '100%', 'الأحسن في الجزائر'];
const ARABE = /[\u0600-\u06FF]/;
// la loi de manita-testing.py (controle_affichage) : un mot français dans une ligne arabe, ou une phrase française
// que la cliente ne lit pas (les mêmes mots, les mêmes lignes permises : barres, nombres seuls, monnaies)
const FRANCAIS_INTERDIT = /\b(seuil|budget|campagne|d[eé]pense|livr[eé]e?s?|confirm[eé]e?s?|commande|b[eé]n[eé]fice|perte|marge|retour|stock|annonce|vid[eé]o|prix|co[uû]t)\b/i;
const LATIN_PERMIS = /^[\s=|\-·.:%+/]*$|^\s*[\d\s.,%|+-]*(DA|USD|EUR|DZD|%)?[\s\d.,]*$/;
const versLatin = t => String(t || '').replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) - 0x06F0));
// LE FAUX TÉMOIGNAGE (contrôle simple) : une citation attribuée à une personne, ou les mots qui l'annoncent
const MOT_TEMOIGNAGE = /(شهادة|شهادات|آراء الزبونات|رأي زبونة|رأي الزبونات|t[ée]moignage|avis client|قالتلي|قالتلنا|قالولي|قالولنا|كتبتلنا|كتبولنا|حكاتلنا|زبونة قالت|زبونتنا قالت|الزبونات قالو)/i;
const CITATION = /[«“”"„][^«»“”"„\n]{3,}[»”“"]/;
const VERBE_PAROLE = /(?<![\u0600-\u06FF])و?(قالت|قال|قالو|تقول|يقول|تقولك|كتبت|علّقت|علقت|حكات)(?![\u0600-\u06FF])/; // un mot entier (« برتقالي » n'est pas « قال »)
export function estTemoignage(texte) {
  const t = String(texte || '');
  if (MOT_TEMOIGNAGE.test(t)) return true;
  if (!CITATION.test(t)) return false;
  // la signature : un tiret APRÈS le guillemet fermant (même ligne, ou la ligne d'en dessous). Pas « : » (« «جديد» : قماش
  // خفيف » est une étiquette), et pas n'importe quelle ligne à tiret (une liste à puces n'est pas une signature).
  return VERBE_PAROLE.test(t) || /[»”"][ \t]*[-–—][ \t]*\S/.test(t) || /[»”"][ \t]*\r?\n[ \t]*[-–—][ \t]*\S+([ \t]+\S+){0,2}[ \t]*$/m.test(t);
}
/** Les nombres d'un texte (chiffres arabes ramenés en latin) : « 6 900 », « 6.900 », « 6900 », avec leur monnaie si elle suit. */
function nombresDe(texte) {
  const t = versLatin(texte), out = [], re = /\d{1,3}(?:[ .,\u00a0\u202f]\d{3})+|\d+/g; let x;
  while ((x = re.exec(t))) out.push({ valeur: +x[0].replace(/[ .,\u00a0\u202f]/g, ''), monnaie: /^\s*(دج|د\.ج|دينار|DA\b|DZD|da\b)/i.test(t.slice(x.index + x[0].length)), debut: x.index, fin: x.index + x[0].length });
  return out;
}
/** Les fautes d'un texte LU PAR LA CLIENTE. prix : le prix du client. prixUneFois : un primary (le prix exact, une fois,
 *  seul sur sa ligne) ; sinon aucun prix. lignesMax : un bloc de la page (l'outil refuse plus de six lignes). latin :
 *  un titre de produit peut être en lettres latines (le nom donné par le client). */
/** [relecture] 10/10/2026 : départage d'un nom de page ARABE déjà pris, SANS chiffre (la loi des lignes arabes) — un mot de
 *  style de la recette des six noms (classic, chic, royal…) écrit en arabe, puis deux mots ; jamais un chiffre. */
export const DEPARTAGES_ARABES = ['كلاسيك', 'شيك', 'رويال', 'لوكس', 'سوفت', 'قلام', 'إليقانس', 'بريستيج'];
export function departagerNom(nom, pris, max = 80) {
  const cle = s => String(s).toLowerCase(), base = String(nom).slice(0, max - 20).trim();
  if (!pris.has(cle(nom))) return nom;
  for (const w of DEPARTAGES_ARABES) { const c = `${base} ${w}`; if (!pris.has(cle(c))) return c; }
  for (const w1 of DEPARTAGES_ARABES) for (const w2 of DEPARTAGES_ARABES) { if (w1 === w2) continue; const c = `${base} ${w1} ${w2}`; if (!pris.has(cle(c))) return c; }
  return `${base} ${DEPARTAGES_ARABES.join(' ')}`.slice(0, max);
}
export function fautesTexteClient(texte, { prix, prixUneFois = false, lignesMax = 0, latin = false } = {}) {
  const t = String(texte || '').trim(), fautes = [];
  if (!t) return ['texte vide'];
  if (COD_INTERDIT.test(t)) fautes.push('le mot COD (on écrit الدفع عند الاستلام)');
  // manita-produit.py (mots_interdits_dans) refuse « cod » partout, sans casse, même collé dans un mot (« Robe Codette ») :
  // le bureau refuse pareil, sinon le paquet tombe APRÈS les textes
  else if (/cod/i.test(t)) fautes.push('« cod » dans un mot (l\'outil de la page le refuse partout, sans casse)');
  const bas = t.toLowerCase();
  for (const mot of MOTS_INTERDITS) if (bas.includes(mot.toLowerCase())) { fautes.push(`mot interdit « ${mot} »`); break; }
  if (estTemoignage(t)) fautes.push('un témoignage ou une citation attribuée à une personne (interdit : aucun faux avis)');
  if (!latin && !ARABE.test(t)) fautes.push('pas écrit en darija (aucune lettre arabe)');
  if (!latin) for (const ligne of t.split(/\r?\n/)) {
    if (!FRANCAIS_INTERDIT.test(ligne)) continue;
    if (ARABE.test(ligne)) { fautes.push(`un mot français dans une ligne arabe : « ${ligne.trim().slice(0, 40)} »`); break; }
    if (!LATIN_PERMIS.test(ligne)) { fautes.push(`une phrase française que la cliente ne lit pas : « ${ligne.trim().slice(0, 40)} »`); break; }
  }
  const nombres = nombresDe(t), exacts = nombres.filter(n => n.valeur === +prix);
  // un nombre de 1 000 et plus SANS monnaie passe pour un prix — sauf dans le nom latin d'un produit (« Abaya Ramadan 2026 »)
  for (const n of nombres) if (n.valeur !== +prix && (n.monnaie || (n.valeur >= 1000 && !latin))) { fautes.push(`un autre prix que celui du client (${n.valeur})`); break; }
  if (prixUneFois && exacts.length !== 1) fautes.push(`le prix exact (${prix} دج) ${exacts.length ? `${exacts.length} fois` : 'absent'} au lieu d'une seule fois`);
  if (!prixUneFois && exacts.length) fautes.push('un prix hors du primary (la page et le titre n\'en portent pas)');
  // aucun chiffre dans une ligne arabe (il s'affiche à l'envers chez la cliente), sauf la ligne du prix : le prix seul + sa monnaie
  for (const ligne of versLatin(t).split(/\r?\n/)) {
    if (!/\d/.test(ligne) || !ARABE.test(ligne)) continue;
    const reste = ligne.replace(/\d{1,3}(?:[ .,\u00a0\u202f]\d{3})+|\d+/g, n => (+n.replace(/[ .,\u00a0\u202f]/g, '') === +prix ? ' ' : n)).replace(/(دج|د\.ج|دينار)/g, ' ');
    if (/\d/.test(reste)) { fautes.push(`un chiffre dans une ligne arabe : « ${ligne.trim().slice(0, 40)} »`); break; }
    if (ARABE.test(reste)) { fautes.push(`le prix doit être SEUL sur sa ligne : « ${ligne.trim().slice(0, 40)} »`); break; }
  }
  if (lignesMax && t.split(/\r?\n/).filter(l => l.trim()).length > lignesMax) fautes.push(`plus de ${lignesMax} lignes (un pavé)`);
  return fautes;
}
/** Les longueurs d'un titre et d'une description d'annonce : on choisit un texte qui tient, on ne coupe jamais au milieu
 *  d'un mot (avant, slice(0, 60) / slice(0, 90) coupait en silence — et coupait un émoji en deux). Comptées en caractères
 *  VUS (un émoji = un). */
export const LONGUEUR_MAX = { titre: 60, description: 90 };
const longueur = t => [...String(t || '')].length;
/** Un bloc de la page tel que manita-produit.py le LIRA : l'outil coupe les blocs sur une ligne vide ou une ligne « --- »
 *  (lis_textes). Un paragraphe qui en porte une deviendrait DEUX blocs (l'alternance photo / texte décalée, ou refusée) :
 *  on retire ces lignes, le paragraphe reste un seul bloc. */
/* ------------------------------ LA DESCRIPTION DE LA PAGE, RELUE (09/10/2026) ------------------------------ */
// Vu sur une vraie page publiée : balises « &lt;img … /&gt; » échappées (du texte au lieu des images) et un premier bloc
// envoyé comme une liste JSON brute (crochets et guillemets). Deux gardes AJOUTÉES : le bloc remis en lignes avant le paquet,
// et la description réellement stockée relue (get_product) après la création.
/** Un bloc de texte qui RESSEMBLE à une liste JSON (« ["ligne 1","ligne 2"] ») → ses lignes, une par ligne. Un bloc
 *  normal revient tel quel. */
export function blocEnLignes(b) {
  const t = String(b ?? '').trim();
  if (!/^\[[\s\S]*\]$/.test(t)) return blocEnLignesDedans(b);
  try { const v = JSON.parse(t); if (Array.isArray(v) && v.length && v.every(x => typeof x === 'string' || typeof x === 'number')) return v.map(x => String(x).trim()).filter(Boolean).join('\n'); } catch {}
  const morceaux = [...t.slice(1, -1).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => x[1].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1').trim()).filter(Boolean);
  // casse-4 : des guillemets simples (« ['…', '…'] ») sont une liste aussi
  const simples = morceaux.length ? [] : [...t.slice(1, -1).matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\(.)/g, '$1').trim()).filter(Boolean);
  return morceaux.length ? morceaux.join('\n') : simples.length ? simples.join('\n') : String(b ?? '');
}
/** casse-4 : une liste JSON qui commence APRÈS une première ligne du bloc (« titre\n["…","…"] ») — chaque suite de lignes
 *  qui ouvre sur « [ » et ferme sur « ] » est remise en lignes ; le reste du bloc ne bouge pas. */
function blocEnLignesDedans(b) {
  const lignes = String(b ?? '').split('\n'); let change = false; const out = [];
  for (let i = 0; i < lignes.length; i++) {
    if (/^\s*\[/.test(lignes[i])) {
      let j = i; while (j < lignes.length && j - i < 60 && !/\]\s*$/.test(lignes[j])) j++;
      if (j < lignes.length && /\]\s*$/.test(lignes[j])) { const morceau = lignes.slice(i, j + 1).join('\n'), r = /^\s*\[[\s\S]*\]\s*$/.test(morceau) ? blocEnLignes(morceau) : morceau;
        if (r !== morceau) { out.push(r); change = true; i = j; continue; } }
    }
    out.push(lignes[i]);
  }
  return change ? out.join('\n') : String(b ?? '');
}
/** Les images d'une description du paquet (le src de chaque <img>), dans l'ordre. */
export const imagesDescription = d => [...String(d || '').matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map(x => x[1]);
/** La description STOCKÉE relue dans les réponses brutes de get_product (la dernière lecture qui en porte une), ou null.
 *  casse-4 : dans une lecture, la description du PRODUIT (l'objet qui porte son id, sinon la moins profonde) — jamais celle
 *  d'une variante ou d'un bloc SEO imbriqué lu après elle. */
export function descriptionRelue(appels, productId = null) {
  let lue = null;
  for (const a of appels || []) if (!a.erreur && /__get_product$/.test(String(a.nom || ''))) for (const j of jsonsTexte(a.sortie)) {
    let meilleur = null;
    const marcher = (o, prof = 0) => { if (prof > 40 || !o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(x => marcher(x, prof + 1));
      // [casse-5] « sien » : l'objet dont l'id (ou _id) EST le produit ; un objet sans id qui porte productId = le produit ne
      // compte que s'il n'est pas une VARIANTE (sku, variantId) — une variante porte le productId de son parent
      if (typeof o.description === 'string') { const P = productId !== null && productId !== undefined ? String(productId) : null;
        const propre = o.id ?? o._id, sien = P !== null && (propre !== undefined && propre !== null ? String(propre) === P : (String(o.productId ?? '') === P && o.sku === undefined && o.variantId === undefined && o.variant_id === undefined));
        if (!meilleur || (sien && !meilleur.sien) || (sien === meilleur.sien && prof < meilleur.prof)) meilleur = { d: o.description, prof, sien }; }
      for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v, prof + 1); };
    marcher(j);
    if (meilleur) lue = meilleur.d;
  }
  return lue;
}
/** casse-4 : une liste JSON n'importe où dans un texte stocké — sur une ligne ou sur plusieurs, guillemets droits, simples
 *  ou échappés (&quot;). */
export function porteListeJSON(texte) {
  const t = String(texte || '').replace(/&quot;/g, '"').replace(/&#0*34;/g, '"').replace(/<br\s*\/?>/gi, '\n');
  return /(^|\n|>)\s*\[\s*(["'])[\s\S]{0,4000}?\2\s*,?\s*\]\s*(\n|<|$)/.test(t);
}
/** Les fautes de la description stockée face à celle du paquet : balise échappée (&lt;img, &amp;lt;), image du paquet
 *  manquante, bloc JSON (« ["…","…"] »). Rend null si aucune description n'a été relue, sinon la liste ([] = juste). */
export function fautesDescription(appels, descriptionPaquet, productId = null) {
  const lue = descriptionRelue(appels, productId);
  if (lue === null) return null;
  const fautes = [];
  if (/&(amp;)*lt;\s*\/?\s*[a-z]/i.test(lue) || /&amp;(lt|gt|quot);/i.test(lue)) fautes.push('balise échappée (&lt;img au lieu de <img)');
  // casse-4 : une balise échappée en entité NUMÉRIQUE (&#60;img, &#x3C;img)
  else if (/&#(0*60|x0*3c);\s*\/?\s*[a-z]/i.test(lue)) fautes.push('balise échappée (&#60;img au lieu de <img)');
  const manquent = imagesDescription(descriptionPaquet).filter(u => !imagesDescription(lue).includes(u));
  if (manquent.length) fautes.push(`${manquent.length} image(s) du paquet manquante(s)`);
  if (/(^|\n|>)\s*\[\s*"[^\n]*"\s*\]\s*(\n|<|$)/.test(lue)) fautes.push('bloc JSON brut (crochets et guillemets)');
  // casse-4 : une liste JSON sur plusieurs lignes ou aux guillemets échappés ; des retours à la ligne partis en « \n » texte
  else if (porteListeJSON(lue) && !porteListeJSON(descriptionPaquet)) fautes.push('bloc JSON brut (crochets et guillemets)');
  if (/\\n/.test(lue) && !/\\n/.test(String(descriptionPaquet || ''))) fautes.push('retours à la ligne partis en « \\n » écrit');
  return fautes;
}
/* ---------- [desc-bilan] 10/10/2026 : LA DESCRIPTION ENVOYÉE SEULE, PUIS RELUE (OBLIGATOIRE) ----------
 * 3e page abîmée constatée en vrai : la réparation « relire puis refaire » n'avait pas tiré parce que la relecture ne
 * s'était pas faite (fautesDescription rendait null → seulement noté, la page passait). Sa recette : la description part
 * dans SON PROPRE envoi (update_product avec la seule description, rien d'autre dans la même charge), puis le bureau
 * RELIT ce qui est réellement stocké (get_product, réponse brute, APRÈS cet envoi), et ne publie qu'ensuite. */
const CLES_ENVOI_DESCRIPTION = new Set(['productId', 'id', 'description']);
/** L'envoi SEUL de la description dans des appels bruts, puis sa relecture : rend { ok, fautes } — ok seulement si
 *  (1) un update_product porte la description du paquet et RIEN d'autre (productId mis à part), (2) un get_product de CE
 *  produit, APRÈS cet envoi, relit une description, (3) cette description relue n'a aucune faute (fautesDescription :
 *  toutes les images du paquet en balises brutes, rien d'échappé, aucune liste JSON, aucun « \n » écrit). */
export function envoiDescriptionSeule(appels, descriptionPaquet, productId) {
  const liste = (appels || []).filter(a => a && !a.erreur), fautes = [];
  const entree = a => { let e = a.entree; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } } return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; };
  const norme = t => String(t ?? '').replace(/\r\n/g, '\n').trim();
  let iEnvoi = -1, pasSeule = null;
  // [casse-5] LA DERNIÈRE écriture de la description de CE produit compte (c'est elle qui est stockée) : un envoi seul juste
  // suivi d'une réécriture (avec le nom, ou seule mais autre) n'est plus l'envoi prouvé
  liste.forEach((a, i) => {
    if (!/__update_product$/.test(String(a.nom || ''))) return;
    const e = entree(a); if (e.description === undefined || String(e.productId ?? e.id ?? '') !== String(productId)) return;
    const autres = Object.keys(e).filter(k => !CLES_ENVOI_DESCRIPTION.has(k));
    if (autres.length) { pasSeule = autres; iEnvoi = -1; return; }
    if (norme(e.description) !== norme(descriptionPaquet)) { pasSeule = ['description différente de celle du paquet']; iEnvoi = -1; return; }
    iEnvoi = i; pasSeule = null;
  });
  if (iEnvoi < 0) { fautes.push(pasSeule ? `description pas envoyée seule (${pasSeule.join(', ').slice(0, 80)})` : 'description jamais envoyée seule (update_product avec la seule description)'); return { ok: false, fautes }; }
  // [casse-5] la relecture de CE produit seulement : un get_product qui vise un AUTRE produit n'en est pas une
  const apres = liste.slice(iEnvoi + 1).filter(a => { if (!/__get_product$/.test(String(a.nom || ''))) return false; const e = entree(a), vise = e.productId ?? e.id; return vise === undefined || vise === null || String(vise) === String(productId); });
  const fd = fautesDescription(apres, descriptionPaquet, productId);
  if (fd === null) {
    // [sortie-persistee] la réponse trop grosse dont le fichier n'a pas pu être lu : la raison est DITE (introuvable, hors dossier, borne)
    const pourquoi = [...new Set(apres.map(a => a.persistee && a.persistee.erreur).filter(Boolean))];
    fautes.push(`description non relue après son envoi (${pourquoi.length ? pourquoi.join(' ; ') : 'aucun get_product brut qui la porte'})`); return { ok: false, fautes, nonRelue: true }; }
  const fn = fauteNomStocke(apres, productId); if (fn) fd.push(fn);
  return { ok: !fd.length, fautes: fd };
}
/** [casse-5] Un tour (publication) qui a RENVOYÉ la description de ce produit : la description relue après le DERNIER de ces
 *  envois doit être juste (fautesDescription face à celle du paquet). Rend null (rien renvoyé, ou relue juste) ou la faute. */
export function fauteDescriptionRenvoyee(appels, descriptionPaquet, productId) {
  const liste = (appels || []).filter(a => a && !a.erreur), entree = a => { let e = a.entree; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } } return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; };
  let i = -1; liste.forEach((a, k) => { if (/__update_products?$/.test(String(a.nom || '')) && JSON.stringify(entree(a)).includes('"description"') && JSON.stringify(entree(a)).includes(String(productId))) i = k; });
  if (i < 0) return null;
  const apres = liste.slice(i + 1).filter(a => /__get_product$/.test(String(a.nom || '')));
  const fd = fautesDescription(apres, descriptionPaquet, productId);
  if (fd === null) return 'description renvoyée puis jamais relue';
  return fd.length ? fd.join(' ; ') : null;
}
/* ---------- [variantes-completes] 10/10/2026 : LES VARIANTES ENVOYÉES COMPLÈTES (id + price + selectedOptions) ----------
 * Constaté sur la chaîne du vendeur : update_product est REFUSÉ par Tassyir (erreur -32602) quand les variantes n'arrivent
 * qu'avec leur id ; Tassyir exige pour CHAQUE variante envoyée son prix et ses selectedOptions, tels que get_product les rend.
 * Trois publications de suite y sont tombées (un tour se corrige parfois seul : ça ne se voit pas à tous les coups). Le bureau
 * RELIT les appels bruts : chaque variante d'un update_product de CE produit porte id, price et selectedOptions IDENTIQUES à
 * ceux lus par get_product (on ne change JAMAIS un prix à la publication) ; un refus -32602 est reconnu et DIT. */
export const VARIANTES_INCOMPLETES = 'variantes incomplètes : prix et options exigés';
const entreeVar = a => { let e = a && a.entree; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } } return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; };
const listeVar = v => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } } return Array.isArray(v) ? v : null; };
const optionsCle = o => { const l = listeVar(o); return l ? l.map(x => `${String(x && x.name !== undefined ? x.name : '').trim()}=${String(x && x.value !== undefined ? x.value : '').trim()}`).sort().join('|') : null; };
/** Les variantes LUES dans les réponses brutes de get_product de CE produit : Map id → { price, selectedOptions } (la
 *  dernière lecture gagne ; premiere = true : la PREMIÈRE lecture gagne, l'état d'avant tout envoi). */
export function variantesLues(appels, productId, premiere = false) {
  const lues = new Map();
  const chercher = (o, prof = 0) => {
    if (!o || typeof o !== 'object' || prof > 8) return;
    if (Array.isArray(o)) { for (const x of o) chercher(x, prof + 1); return; }
    if (o.id !== undefined && productId !== null && productId !== undefined && Array.isArray(o.variants) && String(o.id) !== String(productId) && o.productId === undefined) return;
    if (Array.isArray(o.variants)) for (const v of o.variants) if (v && typeof v === 'object' && v.id !== undefined && v.id !== null) if (!premiere || !lues.has(String(v.id))) lues.set(String(v.id), { price: v.price, selectedOptions: v.selectedOptions, ...(v.sku !== undefined ? { sku: v.sku } : {}) });
    for (const k of ['product', 'data', 'result']) if (o[k] && typeof o[k] === 'object') chercher(o[k], prof + 1);
  };
  for (const a of appels || []) {
    if (!a || a.erreur || !/__get_product$/.test(String(a.nom || ''))) continue;
    const e = entreeVar(a), vise = e.productId ?? e.id; if (vise !== undefined && vise !== null && String(vise) !== String(productId)) continue;
    for (const j of jsonsTexte(a.sortie)) chercher(j);
  }
  return lues;
}
/** Un refus de Tassyir sur un envoi de variantes (code -32602, ou un refus qui nomme price / selectedOptions). */
export const refusVariantesTassyir = texte => /-32602/.test(String(texte || '')) || /(selectedOptions|\bprice\b)[\s\S]{0,120}(required|requis|missing|manquant|expected|invalid)|(required|requis|missing|manquant|expected|invalid)[\s\S]{0,120}(selectedOptions|\bprice\b)/i.test(String(texte || ''));
/** Les fautes des variantes envoyées par update_product(s) pour CE produit, relues dans les appels BRUTS : rend
 *  { fautes, refus, refusCorrige, envois } — fautes vide = toutes les variantes envoyées portent id, price et selectedOptions
 *  identiques à ceux lus par get_product AVANT l'envoi ; refus = un update_product refusé par Tassyir pour ces variantes
 *  (-32602) et jamais suivi d'un envoi accepté ; refusCorrige = refusé puis corrigé dans le même tour (dit, pas bloquant).
 *  reference (Map de variantesLues) : les prix lus AVANT un tour précédent — un prix déjà changé chez Tassyir par ce tour-là
 *  ne devient pas « le prix lu ». */
export function fautesVariantesEnvoyees(appels, productId, reference = null) {
  const liste = (appels || []).filter(Boolean), fautes = [];
  let refus = false, refusCorrige = false, envois = 0;
  const visePid = e => { const v = e.productId ?? e.id; return v !== undefined && v !== null && String(v) === String(productId); };
  liste.forEach((a, i) => {
    const nom = String(a.nom || ''); if (!/__update_products?$/.test(nom)) return;
    const e = entreeVar(a);
    // update_products : une liste de produits ; on ne garde que CE produit
    const charges = /__update_products$/.test(nom) ? (listeVar(e.products ?? e.items ?? e.updates) || []).filter(x => x && typeof x === 'object' && visePid(x)) : (visePid(e) ? [e] : []);
    const avecVariantes = charges.filter(c => c.variants !== undefined);
    // un refus : le résultat en erreur, ou le code -32602 rendu en texte (« MCP error -32602 … ») dans un résultat normal
    if (a.erreur || /-32602/.test(String(a.sortie || ''))) {
      if (!charges.length || (!avecVariantes.length && !refusVariantesTassyir(a.sortie))) return;
      // corrigé dans le tour : un envoi de variantes de CE produit ACCEPTÉ plus tard (ses variantes sont relues plus bas)
      const plusTard = liste.slice(i + 1).some(b => !b.erreur && !/-32602/.test(String(b.sortie || '')) && /__update_products?$/.test(String(b.nom || '')) && JSON.stringify(entreeVar(b)).includes(String(productId)) && JSON.stringify(entreeVar(b)).includes('"variants"'));
      if (plusTard) refusCorrige = true; else refus = true;
      return;
    }
    if (!avecVariantes.length) return;
    const lues = variantesLues(liste.slice(0, i), productId);
    for (const c of avecVariantes) {
      envois++;
      const vs = listeVar(c.variants);
      if (!vs) { fautes.push('variantes envoyées illisibles (ni liste ni JSON)'); continue; }
      for (const v of vs) {
        if (!v || typeof v !== 'object') { fautes.push('une variante envoyée n\'est pas un objet'); continue; }
        const id = v.id === undefined || v.id === null || v.id === '' ? null : String(v.id);
        if (!id) { fautes.push('une variante envoyée sans son id (Tassyir l\'ajouterait en double)'); continue; }
        const manque = [v.price === undefined || v.price === null || v.price === '' ? 'price' : null, !listeVar(v.selectedOptions) || !listeVar(v.selectedOptions).length ? 'selectedOptions' : null].filter(Boolean);
        if (manque.length) { fautes.push(`variante ${id} envoyée sans ${manque.join(' ni ')}${manque.length === 2 ? ' (son id seul)' : ''}`); continue; }
        const lu = lues.get(id);
        if (!lu) { fautes.push(`variante ${id} jamais lue par get_product avant l'envoi (prix et options non recoupés)`); continue; }
        const ref = reference && reference.get(id), prixLu = ref ? ref.price : lu.price;
        if (!(Number.isFinite(+v.price) && Number.isFinite(+lu.price) && +v.price === +lu.price && Number.isFinite(+prixLu) && +v.price === +prixLu)) fautes.push(`variante ${id} : prix changé (${v.price} envoyé, ${prixLu} lu) — on ne change jamais un prix à la publication`);
        if (optionsCle(v.selectedOptions) !== optionsCle(lu.selectedOptions) || (ref && optionsCle(v.selectedOptions) !== optionsCle(ref.selectedOptions))) fautes.push(`variante ${id} : selectedOptions différentes de celles lues par get_product`);
      }
    }
  });
  if (refus) fautes.unshift(`Tassyir a refusé l'update_product (-32602) : ${VARIANTES_INCOMPLETES}`);
  return { fautes: [...new Set(fautes)], refus, refusCorrige, envois };
}
/* ---------- [liste-variantes] 10/10/2026 : LE BUREAU CONSTRUIT LA LISTE DES VARIANTES, LE TOUR L'ENVOIE TELLE QUELLE ----------
 * Cause racine (chaîne du vendeur) : sur une grosse fiche, la réponse get_product est mise en FICHIER par Claude Code ; dans le
 * tour, Claude ne voit que le pointeur (ses outils : tassyir seulement, aucune lecture de fichier) → il ne peut pas connaître le
 * price et les selectedOptions de chaque variante que Tassyir exige. Le BUREAU, lui, lit la réponse entière (moteur,
 * lireSortiePersistee) : il construit la liste complète { id, price, selectedOptions, isHidden } depuis la relecture brute
 * get_product de CE produit (étape page), recoupée avec le paquet qu'il a lui-même fabriqué (même couple Couleur/Taille, même
 * prix : on ne change JAMAIS un prix) ; le tour reçoit la charge exacte et l'envoie telle quelle ; la relecture des appels bruts
 * vérifie que la charge envoyée == la liste. Liste impossible (id introuvable, prix du paquet différent, options manquantes) →
 * rien n'est publié, la raison est dite. */
/** Les variantes lues (Map de variantesLues) → [{ id, sku?, price, selectedOptions }] (gardées dans la mission). */
export const listeLue = lues => [...(lues || new Map())].map(([id, v]) => ({ id, ...(v.sku !== undefined ? { sku: v.sku } : {}), price: v.price, selectedOptions: v.selectedOptions }));
/** La liste à envoyer à la publication : rend { liste, fautes, manquants }. Chaque variante du paquet ↔ UNE variante lue du même
 *  couple (selectedOptions ; le sku sert de contrôle et départage), au même prix → isHidden false ; une variante lue de plus (hors
 *  paquet, ou doublon d'un couple) garde son prix et part isHidden true (rien ne se supprime). manquants : couples du paquet sans
 *  variante lue (pas d'id) ; fautes : ce qui rend la liste impossible (prix, options, sku, id). */
/** Une option envoyée en { name, value } SEULEMENT (10/10/2026, forme réelle : get_product rend aussi optionId et optionValueId ;
 *  un vrai update_product a accepté { id, price, selectedOptions: [{ name, value }], isHidden } sans eux). */
const optionsNomValeur = o => (listeVar(o) || []).map(x => ({ name: x && x.name !== undefined ? x.name : '', value: x && x.value !== undefined ? x.value : '' }));
export function construireListeVariantes(lues, paquet) {
  const fautes = [], manquants = [], liste = [];
  const pv = paquet && Array.isArray(paquet.variants) ? paquet.variants : [];
  const nomCouple = o => (listeVar(o) || []).map(x => String(x && x.value !== undefined ? x.value : '?')).join('/') || '?';
  const restantes = (Array.isArray(lues) ? lues : []).filter(l => l && l.id !== undefined && l.id !== null && String(l.id) !== '');
  for (const p of pv) {
    const k = optionsCle(p && p.selectedOptions);
    if (!k) { fautes.push(`variante du paquet ${p && p.sku ? p.sku : '?'} sans selectedOptions`); continue; }
    const cand = restantes.filter(l => optionsCle(l.selectedOptions) === k);
    if (!cand.length) { manquants.push(nomCouple(p.selectedOptions)); continue; }
    const c = cand.find(l => p.sku !== undefined && l.sku !== undefined && String(l.sku) === String(p.sku)) || cand[0];
    restantes.splice(restantes.indexOf(c), 1);
    if (p.sku !== undefined && c.sku !== undefined && c.sku !== null && String(c.sku) !== String(p.sku)) fautes.push(`variante ${c.id} (${nomCouple(p.selectedOptions)}) : sku ${c.sku} chez Tassyir, ${p.sku} dans le paquet`);
    if (!(Number.isFinite(+c.price) && c.price !== '' && c.price !== null && Number.isFinite(+p.price) && +c.price === +p.price)) fautes.push(`variante ${c.id} (${nomCouple(p.selectedOptions)}) : prix ${c.price} chez Tassyir, ${p.price} dans le paquet — on ne change jamais un prix`);
    liste.push({ id: c.id, price: c.price, selectedOptions: optionsNomValeur(c.selectedOptions), isHidden: false });
  }
  for (const l of restantes) {
    if (!optionsCle(l.selectedOptions)) { fautes.push(`variante ${l.id} lue sans selectedOptions (options manquantes)`); continue; }
    if (!(Number.isFinite(+l.price) && l.price !== '' && l.price !== null)) { fautes.push(`variante ${l.id} lue sans price`); continue; }
    liste.push({ id: l.id, price: l.price, selectedOptions: optionsNomValeur(l.selectedOptions), isHidden: true });
  }
  if (!pv.length) fautes.push('le paquet ne porte aucune variante');
  if (manquants.length) fautes.unshift(`id introuvable chez Tassyir pour ${manquants.length} variante(s) du paquet : ${manquants.slice(0, 6).join(', ')}${manquants.length > 6 ? '…' : ''}`);
  return { liste, fautes: [...new Set(fautes)], manquants };
}
const cleVarListe = v => `${String(v && v.id)}#${+(v && v.price)}#${optionsCle(v && v.selectedOptions)}#${v && v.isHidden === true}`;
/** La charge envoyée == la liste du bureau ? Relu dans les appels BRUTS des update_product(s) de CE produit : rend { fautes,
 *  refus, refusCorrige, ok } — ok = un envoi ACCEPTÉ dont les variantes sont EXACTEMENT la liste (mêmes ids, prix, options,
 *  isHidden ; ni une de plus ni une de moins) avec isActive true ; tout autre envoi accepté de variantes = une faute. */
export function fautesListeEnvoyee(appels, productId, liste) {
  const attendu = (liste || []).map(cleVarListe).sort().join('\n'), fautes = [];
  let refus = false, refusCorrige = false, ok = false;
  const visePid = e => { const v = e.productId ?? e.id; return v !== undefined && v !== null && String(v) === String(productId); };
  const envois = [];
  for (const a of (appels || []).filter(Boolean)) {
    const nom = String(a.nom || ''); if (!/__update_products?$/.test(nom)) continue;
    const e = entreeVar(a);
    const charges = /__update_products$/.test(nom) ? (listeVar(e.products ?? e.items ?? e.updates) || []).filter(x => x && typeof x === 'object' && visePid(x)) : (visePid(e) ? [e] : []);
    for (const c of charges) envois.push({ a, c, rejete: !!a.erreur || /-32602/.test(String(a.sortie || '')) });
  }
  envois.forEach(({ a, c, rejete }, i) => {
    const vs = c.variants === undefined ? null : listeVar(c.variants);
    if (rejete) {
      if (c.variants === undefined && !refusVariantesTassyir(a.sortie)) return;
      if (envois.slice(i + 1).some(x => !x.rejete && x.c.variants !== undefined)) refusCorrige = true; else refus = true;
      return;
    }
    if (c.variants === undefined) return;
    if (!vs) { fautes.push('variantes envoyées illisibles (ni liste ni JSON)'); return; }
    const envoye = vs.map(cleVarListe).sort().join('\n');
    if (envoye === attendu) { if (c.isActive === true || /^true$/i.test(String(c.isActive ?? ''))) ok = true; return; }
    const att = new Set(attendu.split('\n')), env = new Set(envoye.split('\n'));
    const diff = [...env].filter(x => !att.has(x)).slice(0, 2).map(x => x.split('#').slice(0, 2).join(' prix ')), manque = [...att].filter(x => !env.has(x)).length;
    fautes.push(`charge envoyée différente de la liste du bureau (${vs.length} variante(s) envoyée(s), ${(liste || []).length} attendue(s)${manque ? `, ${manque} absente(s) ou changée(s)` : ''}${diff.length ? ` : ${diff.join(', ')}` : ''})`);
  });
  if (refus) fautes.unshift(`Tassyir a refusé l'update_product (-32602) : ${VARIANTES_INCOMPLETES}`);
  else if (!ok && !fautes.length) fautes.push('la liste des variantes du bureau n\'a jamais été envoyée telle quelle (avec isActive true)');
  return { fautes: [...new Set(fautes)], refus, refusCorrige, ok };
}
/** casse-4 : un AUTRE champ stocké en liste JSON (le nom du produit) — rend la faute, ou null. */
export function fauteNomStocke(appels, productId = null) {
  let nom = null;
  for (const a of appels || []) if (!a.erreur && /__get_product$/.test(String(a.nom || ''))) for (const j of jsonsTexte(a.sortie)) {
    const o = j && typeof j === 'object' ? (j.product && typeof j.product === 'object' ? j.product : j.data && typeof j.data === 'object' && !Array.isArray(j.data) ? j.data : j) : null;
    if (o && typeof o.name === 'string' && (productId === null || o.id === undefined || String(o.id) === String(productId))) nom = o.name;
  }
  return nom !== null && porteListeJSON(nom) ? `nom du produit stocké en liste JSON (${nom.slice(0, 60)})` : null;
}
/** casse-4 : le nom du produit (titre) qui RESSEMBLE à une liste JSON → ses morceaux sur une ligne. */
export const nomEnClair = n => { const t = String(n ?? ''); if (!/^\s*\[[\s\S]*\]\s*$/.test(t)) return t; const l = blocEnLignes(t); return l === t ? t : l.split('\n').map(x => x.trim()).filter(Boolean).join(' '); };
const blocDePage = b => String(b || '').split(/\r?\n/).filter(l => l.trim() && !/^\s*-{3,}\s*$/.test(l)).join('\n').trim();
/** La réponse du script → ce que la chaîne lit. Le MEILLEUR de chaque champ (l'index « meilleur » de Claude) s'il passe
 *  les contrôles, sinon l'autre (et on le note) ; un champ dont aucun des deux ne passe est une faute. Les textes de la
 *  page : titre, description courte (le 1er bloc, en haut), description longue (les blocs suivants). */
export function choisirTextes(s, { prix }) {
  const fautes = [], replis = [], vus = new Set();
  const angles = Array.isArray(s?.angles) ? s.angles : [];
  if (angles.length !== 5) fautes.push(`${angles.length} angle(s) au lieu de cinq`);
  const fautesDe = (x, opts, max) => { const f = fautesTexteClient(x, opts); if (max && longueur(x) > max) f.push(`plus de ${max} caractères (${longueur(x)})`); return f; };
  const gardes = angles.slice(0, 5).map((a, i) => {
    const code = `A${i + 1}`, nom = String(a?.angle || '').replace(/\s+/g, ' ').trim();
    if (!nom) fautes.push(`${code} : angle sans nom`);
    else if (vus.has(nom.toLowerCase())) fautes.push(`${code} : le même angle que plus haut (« ${nom} »)`);
    vus.add(nom.toLowerCase());
    const garder = (champ, liste, meilleur, opts, max = 0) => {
      const c = (Array.isArray(liste) ? liste : []).map(x => String(x || '').trim());
      if (c.length !== 2) fautes.push(`${code} : ${c.length} ${champ}(s) au lieu de deux`);
      const m0 = [0, 1].includes(+meilleur) ? +meilleur : 0;
      for (const k of [m0, 1 - m0]) if (c[k] && !fautesDe(c[k], opts, max).length) { if (k !== m0) replis.push(`${code} ${champ} : le meilleur ne passe pas les contrôles, on garde l'autre`); return c[k]; }
      fautes.push(`${code} ${champ} : ${fautesDe(c[m0] || '', opts, max).join(', ')}`);
      return null;
    };
    return { code, angle: nom, primary: garder('primary', a?.primaries, a?.meilleur?.primary, { prix, prixUneFois: true }),
      titre: garder('titre', a?.titres, a?.meilleur?.titre, { prix }, LONGUEUR_MAX.titre), description: garder('description', a?.descriptions, a?.meilleur?.description, { prix }, LONGUEUR_MAX.description) };
  });
  const titre = String(s?.titre_produit || '').replace(/\s+/g, ' ').trim();
  const courte = blocDePage(s?.description_courte);
  const longue = (Array.isArray(s?.description_longue) ? s.description_longue : []).map(blocDePage).filter(Boolean);
  for (const [quoi, t, o] of [['titre du produit', titre, { prix, latin: true }], ['description courte', courte, { prix, lignesMax: 6 }], ...longue.map((b, i) => [`description longue ${i + 1}`, b, { prix, lignesMax: 6 }])]) {
    const f = fautesTexteClient(t, o); if (f.length) fautes.push(`${quoi} : ${f.join(', ')}`);
  }
  if (longue.length < 2 || longue.length > 5) fautes.push(`description longue en ${longue.length} paragraphe(s) au lieu de deux à cinq`);
  return { fautes, replis, textes: { nom: titre, courte, longue, blocs: [courte, ...longue].filter(Boolean), angles: gardes, phraseLanding: String(s?.phrase_landing || '').trim() } };
}
/** La stratégie (tout ce que le script donne en plus des textes gardés), lisible par le client et le coach. */
export function strategieEnTexte(st) {
  const L = [`STRATEGIE MARKETING — ${st.produit}`, `modele ${st.modele} · mission ${st.mission} · ${st.date}`, `langue des textes : darija algerienne (decision du vendeur, exception au script)`, ''];
  const bloc = (titre, v) => { if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return; L.push(`== ${titre}`); if (Array.isArray(v)) for (const x of v) L.push(`- ${typeof x === 'string' ? x : JSON.stringify(x)}`); else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) L.push(`${k} : ${Array.isArray(x) ? x.join(' · ') : x}`); else L.push(String(v)); L.push(''); };
  bloc('Ce qui se voit dans les photos', st.analyse?.visible); bloc('Analyse visuelle', st.analyse?.analyse_visuelle); bloc('Hypotheses', st.analyse?.hypotheses);
  bloc('Strategie de contenu', st.strategie_contenu); bloc('Titre du produit', st.titre_produit); bloc('Phrase de la landing page', st.phrase_landing);
  bloc('Description courte (haut de page)', st.description_courte); bloc('Description longue (blocs de la page)', st.description_longue);
  for (const a of st.angles || []) {
    L.push(`== ${a.code} · ${a.angle}${a.explication ? ' — ' + a.explication : ''}`);
    if ((a.declencheurs || []).length) L.push(`declencheurs : ${a.declencheurs.join(' · ')}`);
    for (const [nom, liste, garde] of [['primary', a.primaries, a.garde?.primary], ['headline', a.titres, a.garde?.titre], ['description', a.descriptions, a.garde?.description]])
      (liste || []).forEach((x, k) => L.push(`${nom} ${k + 1}${String(x).trim() === String(garde || '').trim() ? ' (GARDE)' : ''} :`, String(x).trim()));
    if (a.audience) L.push(`audience : ${typeof a.audience === 'object' ? Object.entries(a.audience).map(([k, x]) => `${k} ${Array.isArray(x) ? x.join(', ') : x}`).join(' · ') : a.audience}`);
    if ((a.mots_cles || []).length) L.push(`mots-cles : ${a.mots_cles.join(' · ')}`);
    L.push('');
  }
  bloc('Offres', st.offres); bloc('Positionnement du prix', st.positionnement_prix); bloc('Idees de creas', st.idees_creas);
  bloc('Tests recommandes', st.tests); bloc('Retargeting', st.retargeting); bloc('Notes finales', st.notes_finales);
  return L.join('\n').trim() + '\n';
}

/* ======================================================================================================== */
export function ouvrirMissions(deps) {
  const { maison, atelier, journal = () => {}, travaux, claude, telegram, depot, reglages, skillDe = () => '' } = deps;
  const RACINE = path.join(maison, 'missions');
  fs.mkdirSync(RACINE, { recursive: true });
  const missions = new Map();
  for (const d of fs.readdirSync(RACINE)) { const m = lireJSON(path.join(RACINE, d, 'mission.json')); if (m && m.id) missions.set(m.id, m); }
  const enMarche = new Set();
  const scaleEnCours = new Set(); // une activation de scale à la fois par mission (deux pressions sur « لانسي »)
  const dossier = m => path.join(RACINE, m.id);
  const sauver = m => { const f = path.join(dossier(m), 'mission.json'); fs.mkdirSync(dossier(m), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(m, null, 1)); renommerSur(t, f); };
  const histoire = (m, quoi) => { m.historique.push({ quand: maintenant(), quoi }); if (m.historique.length > 300) m.historique = m.historique.slice(-300); journal(`mission ${m.id} : ${quoi}`); };
  const R = () => reglages() || {};
  const ffprobe = () => (R().ffmpegDossier ? path.join(R().ffmpegDossier, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : 'ffprobe');
  const ffmpeg = () => (R().ffmpegDossier ? path.join(R().ffmpegDossier, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') : 'ffmpeg');

  /** Un message au client. m : la mission (ou null pour un lot) — celle d'un lot porte en tête le modèle dont elle parle. */
  async function envoyer(m, msg, extra = {}) {
    const tg = telegram(); if (!tg) return { envoye: false };
    const texte = m && m.lot ? [...enteteModele(m.lot), msg.texte].join('\n') : msg.texte;
    const r = await tg.envoyer(texte, { boutons: msg.boutons || null, ...extra });
    if (!r.envoye) journal('telegram non envoyé : ' + (r.fautes || []).join(' ; '));
    return r;
  }
  /** La légende d'un album ou d'une vidéo d'une mission de lot (le modèle dont ils viennent) ; une mission seule : rien, comme avant. */
  const legende = m => (m.lot ? [...enteteModele(m.lot), 'هاذو تاع هاذ الموديل'].join('\n') : '');
  const outil = (m, nom, script, args, o = {}) => travaux.lancer({ nom: `${m.id}/${nom}`, script: script ? path.join(atelier, script) : null, code: o.code || null,
    args, cwd: o.cwd || dossier(m), env: o.env || null, journalFichier: path.join(dossier(m), 'journal', `${nom}.log`), dureeMaxMs: o.dureeMaxMs || 3600000, inactiviteMaxMs: o.inactiviteMaxMs || 900000 });
  const jsonOutil = (r, quoi) => { const j = r.json.filter(x => !quoi || x.quoi === quoi); return j.length ? j[j.length - 1] : null; };

  /* ---- l'état de la CHAÎNE entière : la limite d'usage de Claude et les connecteurs à reconnecter (09/10/2026) ---- */
  // <maison>/chaine.json : survit à une coupure du PC. quota = { depuis, reprise, prevenu } ; connecteurs = { cles, prevenu, sondes, prochaineSonde }
  const FICHIER_CHAINE = path.join(maison, 'chaine.json');
  const chaine = lireJSON(FICHIER_CHAINE) || {};
  const sauverChaine = () => { try { const t = FICHIER_CHAINE + '.tmp'; fs.writeFileSync(t, JSON.stringify(chaine, null, 1)); renommerSur(t, FICHIER_CHAINE); } catch (e) { journal('chaine.json : ' + e.message); } };
  const QUOTA_MIN_MS = 60000, QUOTA_MAX_MS = 6 * 3600000, QUOTA_SANS_HEURE_MS = 30 * 60000;
  /** Le verrou de la limite d'usage : tant qu'il court, aucun tour ne part (sauf une PAUSE : arrêter reste toujours libre). */
  const verrouQuota = (t = Date.now()) => (chaine.quota && Date.parse(chaine.quota.reprise) > t ? chaine.quota : null);
  /** La limite lue (moteur.mjs lireQuota) → le verrou : l'heure dite + 1 min, bornée entre 1 min et 6 h ; sans heure, 30 min. */
  function poserQuota(q, quoi) {
    const t = Date.now();
    const voulu = q && Number.isFinite(q.reprise) ? Math.min(t + QUOTA_MAX_MS, Math.max(t + QUOTA_MIN_MS, q.reprise + 60000)) : t + QUOTA_SANS_HEURE_MS;
    const v = verrouQuota(t);
    if (v) { if (voulu > Date.parse(v.reprise)) v.reprise = new Date(voulu).toISOString(); }
    else chaine.quota = { depuis: new Date(t).toISOString(), reprise: new Date(voulu).toISOString(), heureLue: !!(q && Number.isFinite(q.reprise)), texte: String(q?.texte || '').slice(0, 200), quoi };
    sauverChaine(); journal(`limite d'usage de Claude (${quoi}) : la chaîne attend jusqu'à ${chaine.quota.reprise}`);
    return chaine.quota;
  }
  /** « 15:05 », ou « 10/10 03:05 » quand ce n'est pas aujourd'hui (la ligne latine du message). */
  const heureCourte = iso => { const d = new Date(iso), z = n => String(n).padStart(2, '0'), hm = `${z(d.getHours())}:${z(d.getMinutes())}`; return d.toDateString() === new Date().toDateString() ? hm : `${z(d.getDate())}/${z(d.getMonth() + 1)} ${hm}`; };
  /** UN message au client par limite (deux modèles, un lot et la lecture du soir qui y tombent : un seul). */
  async function prevenirQuota() {
    const v = verrouQuota(); if (!v || v.prevenu) return false;
    v.prevenu = maintenant(); sauverChaine();
    await envoyer(null, M.quota(heureCourte(v.reprise)));
    return true;
  }
  const errQuota = v => Object.assign(new Error(`limite d'usage de Claude jusqu'à ${heureCourte(v.reprise)} : le tour attend (aucun essai perdu)`), { quota: { reprise: Date.parse(v.reprise), verrou: true }, appels: [] });
  const clesDe = e => (e && e.connecteur && Array.isArray(e.connecteur.cles) && e.connecteur.cles.length ? [...new Set(e.connecteur.cles.map(String))] : ['meta', 'tassyir']);
  /* Les CONNECTEURS à reconnecter : tout ce qui attend un connecteur (missions, lectures du soir, relectures d'une
   * activation, lots) ; un connecteur est revenu quand la sonde rend son préfixe (serveur sonder : branché seulement). */
  const SONDES_MAX = 30;
  const delaiSonde = n => Math.min(3600000, (deps.delaiSondeMs ?? 5 * 60000) * 2 ** Math.max(0, n));
  let sondeEnCours = null;
  function attentesConnecteur() {
    const out = [];
    for (const m of missions.values()) {
      if (m.etat === 'connecteur' && m.connecteur) out.push({ cles: m.connecteur.cles, reprendre: () => { histoire(m, `connecteur revenu (${m.connecteur.cles.join(', ')}) : la mission reprend à « ${m.connecteur.etape} », aucun essai perdu`); delete m.connecteur; m.etat = 'encours'; sauver(m); avancer(m); } });
      const S = m.d.suivi, p = m.d.publication, sc = S && S.scale;
      if (m.etat === 'suivi' && S && S.attenteConnecteur) out.push({ cles: S.attenteConnecteur.cles, reprendre: () => { histoire(m, 'connecteur revenu : la lecture du soir reprend toute seule'); delete S.attenteConnecteur; sauver(m); } });
      if (m.etat === 'encours' && p && p.attendConnecteur) out.push({ cles: p.attendConnecteur, reprendre: () => { histoire(m, 'connecteur revenu : la relecture de l\'activation reprend'); delete p.attendConnecteur; p.prochaine = maintenant(); sauver(m); } });
      if (m.etat === 'suivi' && sc && sc.publication && sc.publication.attendConnecteur) out.push({ cles: sc.publication.attendConnecteur, reprendre: () => { histoire(m, 'connecteur revenu : la relecture de la scale reprend'); delete sc.publication.attendConnecteur; sc.publication.prochaine = maintenant(); sauver(m); } });
    }
    for (const l of lots.values()) if (l.etat === 'connecteur' && l.connecteur) out.push({ cles: l.connecteur.cles, reprendre: () => { histoireLot(l, `connecteur revenu : le lot reprend à « ${l.connecteur.etape} »`); delete l.connecteur; l.etat = 'encours'; sauverLot(l); avancerLot(l); } });
    return out;
  }
  /** UN message pour tout le bureau : seulement quand un connecteur PAS ENCORE dit tombe (Meta puis Tassyir : deux messages ;
   *  trois modèles d'un lot sur le même Meta : un seul). Le bouton « عاود » sonde tout de suite. */
  async function signalerConnecteur(cles, m = null) {
    const t = Date.now();
    const ep = chaine.connecteurs = chaine.connecteurs || { depuis: new Date(t).toISOString(), cles: [], prevenu: [], sondes: 0, prochaineSonde: new Date(t + delaiSonde(0)).toISOString() };
    for (const k of cles) if (!ep.cles.includes(k)) ep.cles.push(k);
    if (!ep.idBouton && m && m.id) ep.idBouton = m.id;
    // la même panne qui retombe juste après une reprise (sonde trop optimiste) : pas un deuxième message dans la demi-heure
    const fin = chaine.connecteursFin; if (fin && t - Date.parse(fin.le) < 30 * 60000) for (const k of fin.cles) if (ep.cles.includes(k) && !ep.prevenu.includes(k)) ep.prevenu.push(k);
    const neufs = ep.cles.filter(k => !ep.prevenu.includes(k));
    sauverChaine();
    if (!neufs.length) return false;
    ep.prevenu = [...ep.cles]; sauverChaine();
    journal(`connecteur à reconnecter : ${ep.cles.join(', ')} — le client est prévenu`);
    await envoyer(null, M.connecteur(ep.cles, ep.idBouton || null));
    return true;
  }
  /** Le résultat d'une sonde (serveur sonder : { tassyir: préfixe|null, meta: préfixe|null }) : tout ce qui n'attendait que des
   *  connecteurs revenus reprend ; plus rien n'attend → l'épisode se ferme (un message « رجع » si le client avait été prévenu). */
  function connecteursSondes(r) {
    const ok = k => !!(r && r[k]);
    let reprises = 0;
    for (const a of attentesConnecteur()) if (a.cles.every(ok)) { try { a.reprendre(); reprises++; } catch (e) { journal('reprise après la sonde : ' + e.message); } }
    const restent = attentesConnecteur(), ep = chaine.connecteurs;
    if (ep) {
      if (!restent.length) { chaine.connecteursFin = { le: maintenant(), cles: ep.cles }; delete chaine.connecteurs; sauverChaine(); if (ep.prevenu.length && reprises) envoyer(null, M.connecteurRevenu()).catch(e => journal('telegram : ' + e.message)); }
      else { ep.cles = [...new Set(restent.flatMap(a => a.cles))]; ep.prevenu = ep.prevenu.filter(k => ep.cles.includes(k)); sauverChaine(); }
    }
    if (reprises) journal(`sonde des connecteurs : ${reprises} reprise(s), ${restent.length} attente(s)`);
    return { reprises, restent: restent.length };
  }
  /** La sonde périodique, BORNÉE : 5 min, puis 10, 20, 40, 60 (au plus une heure entre deux), trente sondes au plus par panne ;
   *  ensuite seulement le bouton « عاود » ou « افحص الكونيكتورات ». */
  function entretienConnecteurs(d) {
    const att = attentesConnecteur();
    if (!att.length) { if (chaine.connecteurs) { delete chaine.connecteurs; sauverChaine(); } return; }
    // une attente sans épisode (chaine.json effacé) : le client a déjà été prévenu à l'époque, on sonde tout de suite
    if (!chaine.connecteurs) { const cles = [...new Set(att.flatMap(a => a.cles))]; chaine.connecteurs = { depuis: maintenant(), cles, prevenu: cles, sondes: 0, prochaineSonde: d.toISOString() }; sauverChaine(); }
    const ep = chaine.connecteurs;
    if (!deps.sonder || sondeEnCours || ep.sondes >= SONDES_MAX || d.getTime() < Date.parse(ep.prochaineSonde)) return;
    ep.sondes += 1; ep.prochaineSonde = new Date(d.getTime() + delaiSonde(ep.sondes)).toISOString(); sauverChaine();
    sondeEnCours = (async () => { try { connecteursSondes(await deps.sonder()); } catch (e) { journal('sonde des connecteurs : ' + e.message); } finally { sondeEnCours = null; } })();
  }

  /* ---- LE CHEMIN META d'une mission (09/10/2026, serveur local, option A) ---- */
  const DOSSIER_PORTES = path.join(maison, 'bureau-data', 'meta-portes');
  // une COUPURE pendant un tour d'activation (PC éteint, bureau tué) laisse sa porte sur le disque : au démarrage, plus aucune
  // porte ne vit (10/10/2026, « casse ») — l'activation reprise relit, elle ne réactive jamais
  const DOSSIER_PAUSES = path.join(maison, 'bureau-data', 'meta-pauses');
  try { for (const f of fs.readdirSync(DOSSIER_PAUSES).filter(f => /^[a-f0-9]{32}\.json(\.tmp)?$/.test(f))) fs.unlinkSync(path.join(DOSSIER_PAUSES, f)); } catch {}
  try { const vieilles = fs.readdirSync(DOSSIER_PORTES).filter(f => /^[a-f0-9]{32}\.json(\.tmp)?$/.test(f)); for (const f of vieilles) fs.unlinkSync(path.join(DOSSIER_PORTES, f)); if (vieilles.length) journal(`meta local : ${vieilles.length} porte(s) d'activation d'avant la coupure refermée(s) au démarrage`); } catch {}
  /** 'local' | 'connecteur'. Sans deps.metaLocal (bureau sans serveur local) : le connecteur, sans rien écrire. La première
   *  lecture RÉELLE décide et le choix est gardé ; une mission sur le connecteur y reste (aucune lecture de plus) ; une
   *  mission sur le chemin local relit au début de chaque tour Meta : refus #190/#200/#10 → connecteur à reconnecter. */
  async function cheminMetaDe(m, etape) {
    if (!deps.metaLocal) return null;
    const garde = m.d.cheminMeta;
    if (garde && garde.chemin === 'connecteur') return 'connecteur';
    // une mission née AVANT le serveur local (pas de « cheminLibre ») qui a déjà parlé à Meta a commencé par le connecteur : elle le garde
    if (!garde && !m.d.cheminLibre && (m.d.campagne?.id || (m.d.metaVideos || []).some(v => v && v.video_id))) {
      m.d.cheminMeta = { chemin: 'connecteur', le: maintenant(), etape, lecture: 'mission commencée avant le serveur local' };
      histoire(m, `chemin Meta : le connecteur claude.ai — la mission a commencé chez Meta avant le serveur local, elle le garde jusqu'au bout`); sauver(m); return 'connecteur';
    }
    const compte = m.demande?.reponses?.compte?.id || null;
    let lu; try { lu = await deps.metaLocal.lire(compte); } catch (e) { lu = { ok: false, classe: 'meta', raison: String(e.message || e).slice(0, 200) }; }
    if (!garde) {
      // une PANNE passagère de Meta (réseau, 5xx, réponse illisible) ne décide jamais du chemin pour toute la mission : on
      // réessaie (le choix « connecteur » ne se prend que sur un vrai refus : pas de jeton, jeton refusé, droits)
      if (!lu.ok && !['jeton', 'droits', 'aucun'].includes(lu.classe)) throw new Error(`Meta (serveur local) ne répond pas : ${String(lu.raison || '').slice(0, 200)} — le chemin Meta n'est pas décidé sur une panne passagère`);
      const chemin = lu.ok ? 'local' : 'connecteur';
      m.d.cheminMeta = { chemin, le: maintenant(), etape, lecture: String(lu.raison || '').slice(0, 200) };
      histoire(m, `chemin Meta : ${chemin === 'local' ? 'le serveur local (meta_manita, jeton de التحضير)' : 'le connecteur claude.ai'} — décidé par la lecture réelle au début de « ${etape} » (${String(lu.raison || '').slice(0, 160)}) ; la mission le garde jusqu'au bout`);
      sauver(m); return chemin;
    }
    if (lu.ok) return 'local';
    // arrêter la dépense passe avant tout : la PAUSE seule peut prendre le connecteur quand le jeton est mort
    if (etape === 'pause') { histoire(m, `pause : FRANCHISSEMENT jeton → connecteur — le jeton local est refusé (${String(lu.raison || '').slice(0, 120)}) ; la pause passe par le connecteur claude.ai (seulement status PAUSED sur les objets de la mission ; le chemin gardé de la mission reste « local »)`); sauver(m); return 'connecteur'; }
    if (['jeton', 'droits', 'aucun'].includes(lu.classe)) throw Object.assign(new Error(`connecteur à reconnecter : metaLocal (${String(lu.raison || '').slice(0, 160)})`), { connecteur: { cles: ['metaLocal'], statuts: [`metaLocal (${lu.classe})`] }, appels: [] });
    throw new Error(`Meta (serveur local) ne répond pas : ${String(lu.raison || '').slice(0, 200)}`);
  }

  const ERREUR_VIDE = /^(aucune?|none|null|nil|n\/?a|ras|rien|n[ée]ant|ok|pas d'erreur|no error|-+|—|\.)?$/i;
  /** Un tour de Claude pour une étape : liste d'outils fermée, sortie JSON imposée, refus comptés. systeme : un système
   *  propre à l'étape (la lecture des planches : court), sinon celui du mode chaîne du département (sans la skill pour les
   *  ETAPES_SANS_SKILL). Le verrou de la limite d'usage arrête tout tour avant de partir (sauf « pause ») ; une limite lue
   *  pose le verrou. essaisLeger : les essais déjà faits (le modèle léger ne sert qu'au premier). */
  async function tourClaude(m, etape, { dept, message, outils = [], schema, images = null, systeme = null, essaisLeger = null, porte = null, adSetsPorte = [], porteExistante = null }) {
    const v = verrouQuota();
    if (v && etape !== 'pause') throw errQuota(v);
    const entete = `ETAPE: ${etape}\nMISSION: ${m.id}\n`;
    const essais = essaisLeger ?? (m.etapes && m.etapes[etape] ? m.etapes[etape].essais || 0 : 0);
    const modele = MODELE_LEGER[etape] && !essais ? MODELE_LEGER[etape] : null;
    // LE CHEMIN META (serveur local ou connecteur claude.ai), décidé par une lecture réelle au premier tour Meta, puis gardé
    const cheminMeta = outils.some(o => String(o).startsWith('meta.')) ? await cheminMetaDe(m, etape) : null;
    // [relecture] 10/10/2026 : « حبس » pressé PENDANT la lecture réelle du chemin (au-dessus) : la pause est déjà en file — un
    // tour d'activation ne part plus sur une mission arrêtée (rien n'est parti : la mission reste arrêtée, rien de plus)
    if (etape === 'activation' && m.etat !== 'encours') throw new Error(`la mission est ${m.etat} avant le tour d'activation : rien n'est lancé`);
    // LA PORTE : seule l'activation après « لانسي » la pose, sur le chemin local, pour les ids de CETTE mission ; refermée après le tour
    let laPorte = null, garderPorte = false;
    // [porte-groupee] la porte DU LOT (posée à la validation de la porte groupée, sur les ids de TOUS ses modèles) : reprise
    // telle quelle, jamais refermée par ce tour (le tour du modèle suivant s'en sert) — elle se referme à la fin du groupe
    if (cheminMeta === 'local' && porteExistante && fs.existsSync(path.join(DOSSIER_PORTES, porteExistante + '.json'))) {
      laPorte = porteExistante; garderPorte = true;
      // [casse-5] pendant CE tour, la porte du lot ne sert que les ids de CE modèle (le serveur refuse ceux des autres modèles)
      ouvrirTourPorte(DOSSIER_PORTES, laPorte, m.id);
      histoire(m, `${etape} : porte du lot reprise (usage unique, les ids de tous les modèles de la porte ; pendant ce tour, seulement ceux de ce modèle)`);
      message += `\nPORTE (serveur Meta local) : ajoute l'argument porte "${laPorte}" à CHAQUE appel ads_activate_entity${adSetsPorte.length ? ' et à chaque ads_update_entity qui pose start_time' : ''}. Sans elle le serveur refuse ; elle ne vaut que pour les objets ci-dessus, une fois chacun.`;
    } else if (cheminMeta === 'local' && Array.isArray(porte) && porte.length) {
      laPorte = ecrirePorte(DOSSIER_PORTES, { mission: m.id, ids: porte, adSets: adSetsPorte });
      histoire(m, `${etape} : porte d'activation posée pour ${porte.length} objet(s) de cette mission (usage unique)`);
      message += `\nPORTE (serveur Meta local) : ajoute l'argument porte "${laPorte}" à CHAQUE appel ads_activate_entity${adSetsPorte.length ? ' et à chaque ads_update_entity qui pose start_time' : ''}. Sans elle le serveur refuse ; elle ne vaut que pour les objets ci-dessus, une fois chacun.`;
    }
    // LE TICKET DE PAUSE (10/10/2026) : un tour de pause sur le chemin local ne peut QUE mettre en pause les objets de la mission
    let ticket = null;
    const objetsMission = () => { const c = m.d.campagne || {}, sc = m.d.suivi?.scale?.campagne || null; return [c, ...(sc ? [sc] : [])].flatMap(k => [k.id, ...(k.adSets || []).map(a => a.id), ...(k.ads || []).map(a => a.id)]).filter(x => x !== undefined && x !== null).map(String); };
    const lancer = chemin => {
      if (etape === 'pause' && chemin === 'local' && !ticket) ticket = ecrireTicketPause(DOSSIER_PAUSES, { mission: m.id, ids: objetsMission() });
      return claude({ dept, systeme: systeme || systemeChaine(dept, etape), message: entete + message, outils, schema, images, ...(modele ? { modele } : {}), ...(chemin ? { cheminMeta: chemin } : {}), ...(ticket && chemin === 'local' ? { pauseSeule: ticket } : {}) });
    };
    let r;
    try {
      try { r = await lancer(cheminMeta); }
      catch (e) {
        // le jeton tombé PENDANT le tour de pause (#190 rendu par le serveur local) : la pause prend le connecteur
        if (etape === 'pause' && cheminMeta === 'local' && e && e.connecteur && (e.connecteur.cles || []).includes('metaLocal')) {
          histoire(m, `pause : FRANCHISSEMENT jeton → connecteur — le jeton est tombé pendant le tour (${(e.connecteur.statuts || []).join(', ').slice(0, 80)}) ; la pause passe par le connecteur claude.ai (seulement status PAUSED sur les objets de la mission)`); sauver(m);
          // 10/10/2026 (« casse ») : le connecteur mort LUI AUSSI — dit (« aucun chemin vivant »), jamais un seul « connecteur à
          // reconnecter : meta » qui laisserait croire que le jeton, lui, marche ; les deux clés vont au client
          try { r = await lancer('connecteur'); }
          catch (e2) {
            if (!(e2 && e2.connecteur && (e2.connecteur.cles || []).includes('meta'))) throw e2;
            histoire(m, `pause : le connecteur claude.ai Meta est tombé lui aussi (${(e2.connecteur.statuts || []).join(', ').slice(0, 80)}) après le jeton — aucun chemin vivant`); sauver(m);
            throw Object.assign(e2, { connecteur: { cles: [...new Set([...(e2.connecteur.cles || []), 'metaLocal'])], statuts: [...(e2.connecteur.statuts || []), ...(e.connecteur.statuts || [])] } });
          }
        } else {
        // PAUSE SYMÉTRIQUE : mission sur le connecteur dont le connecteur Meta est tombé → le jeton, si une lecture RÉELLE le prouve vivant
        if (!(etape === 'pause' && cheminMeta === 'connecteur' && deps.metaLocal && e && e.connecteur && (e.connecteur.cles || []).includes('meta'))) throw e;
        const compte = m.demande?.reponses?.compte?.id || null;
        let lu; try { lu = await deps.metaLocal.lire(compte); } catch (x) { lu = { ok: false, classe: 'meta', raison: String(x.message || x).slice(0, 200) }; }
        if (!lu.ok) { histoire(m, `pause : le connecteur claude.ai Meta est tombé (${(e.connecteur.statuts || []).join(', ').slice(0, 80)}) et le jeton local ne se lit pas (${String(lu.raison || '').slice(0, 100)}) — aucun chemin vivant`); sauver(m); throw Object.assign(e, { connecteur: { cles: [...new Set([...(e.connecteur.cles || []), 'metaLocal'])], statuts: [...(e.connecteur.statuts || []), `metaLocal (${lu.classe || 'meta'})`] } }); }
        histoire(m, `pause : FRANCHISSEMENT connecteur → jeton — le connecteur claude.ai Meta est tombé (${(e.connecteur.statuts || []).join(', ').slice(0, 80)}), la lecture réelle prouve le jeton vivant (${String(lu.raison || '').slice(0, 100)}) ; la pause passe par le serveur local (ticket : seulement status PAUSED sur les objets de la mission ; le chemin gardé de la mission reste « connecteur »)`); sauver(m);
        r = await lancer('local');
        }
      }
    }
    catch (e) { if (e && e.quota && !e.quota.verrou) poserQuota(e.quota, `${m.id}/${etape}`); throw e; }
    finally { if (laPorte && !garderPorte) effacerPorte(DOSSIER_PORTES, laPorte); if (laPorte && garderPorte) fermerTourPorte(DOSSIER_PORTES, laPorte, m.id); if (ticket) effacerTicketPause(ticket); }
    m.d.tokens = (m.d.tokens || 0) + (r.tokens || 0);
    if (!r.structure) throw new Error(`Claude n'a pas rendu le JSON demandé (${etape}) : ${extrait(r.texte, 200)}`);
    // arretClaude : Claude a DIT qu'il ne pouvait pas (sa réponse est là), ce n'est pas une panne de la machine. Un champ
    // « erreur » rempli pour dire qu'il n'y en a pas (« aucune », « none », « - »…) n'est pas un arrêt (06/10/2026)
    if (r.structure.erreur && !ERREUR_VIDE.test(String(r.structure.erreur).trim())) {
      // [v0.3.9-meta] la cause réelle de Meta, cherchée aussi dans les réponses brutes des outils du tour
      const metaConnue = erreurMetaConnue(String(r.structure.erreur) + ' ' + (r.appels || []).map(a => a.sortie || '').join(' '));
      throw Object.assign(new Error(`Claude s'est arrêté (${etape}) : ${String(r.structure.erreur).slice(0, 300)}`), { arretClaude: true, ...(metaConnue ? { metaConnue } : {}) });
    }
    return r;
  }
  /** La fin de la publication (commune aux deux chemins) : actif relu brut sur CE produit, aucun autre produit activé, la
   *  description non renvoyée de travers, puis le lien au client. */
  async function finirPublication(m, p, r) {
    const s = r.structure;
    if (!s.actif) throw new Error('le produit n\'est pas actif à la relecture');
    // [relecture] 10/10/2026 : la relecture est celle de CE produit (un get_product qui vise un AUTRE productId ne compte pas :
    // la dernière lecture d'un autre produit actif suffisait) ; et un AUTRE produit activé pendant ce tour est refusé, dit
    const pid = String(p.productId), vise = a => { const e = entreeDe(a), v = e.productId ?? e.id; return v === undefined || v === null || String(v) === pid; };
    const autresPublies = appelsDe(r, 'update_product').filter(a => !vise(a) && /"isActive"\s*:\s*true/.test(JSON.stringify(entreeDe(a))));
    if (autresPublies.length) throw definitive(`un autre produit que ${pid} a ete active pendant la publication : ${autresPublies.map(a => String(entreeDe(a).productId ?? entreeDe(a).id)).join(', ')} — verifie-le dans Tassyir`);
    const relu = appelsDe(r, 'get_product').filter(vise).slice(-1)[0];
    if (!relu || !/"isActive"\s*:\s*true/.test(String(relu.sortie))) throw new Error('la relecture brute de get_product ne montre pas isActive true' + (relu && relu.persistee && relu.persistee.erreur ? ` (${relu.persistee.erreur})` : ''));
    // [casse-5] la publication qui RENVOIE la description (avec isActive dans la même charge) : Tassyir peut l'échapper
    // encore — la description stockée est relue APRÈS cet envoi ; abîmée ou non relue → rien d'annoncé, le client le lit
    const paquetPub = m.d.paquet ? lireJSON(m.d.paquet) : null;
    const descPub = fauteDescriptionRenvoyee(r.appels, paquetPub && typeof paquetPub.description === 'string' ? paquetPub.description : '', p.productId);
    if (descPub) throw Object.assign(definitive(`la publication a renvoye la description et elle est stockee de travers : ${descPub}`), { client: M.descriptionRetouchee(m.id) });
    if (/^https:\/\/[a-z0-9-]+\.tassyir\.io\/product\//.test(s.urlProduit || '')) p.urlProduit = s.urlProduit;
    p.publieLe = maintenant();
    await envoyer(m, M.pagePubliee(p.urlProduit || 'https://app.tassyir.io/'));
  }
  /** [liste-variantes] 10/10/2026 : la publication avec la liste des variantes construite par le BUREAU (voir construireListeVariantes).
   *  Source : la relecture brute get_product de l'étape page (m.d.variantesPage) ; il manque des ids → UN tour court de LECTURE
   *  SEULE (get_product, lu côté bureau, jamais recopié par Claude) ; liste impossible → rien publié, raison dite. Le tour reçoit
   *  la charge EXACTE ; la charge envoyée doit l'égaler (appels bruts) ; sinon UN nouveau tour avec la même liste, puis arrêt dit. */
  async function publierAvecListe(m, p, paquetV, schemaPub) {
    const pid = String(p.productId);
    let source = 'la relecture get_product de l\'étape page';
    let c = construireListeVariantes(Array.isArray(m.d.variantesPage) ? m.d.variantesPage : [], paquetV);
    if (c.manquants.length || !(m.d.variantesPage || []).length) {
      histoire(m, `publication : ${c.manquants.length ? `${c.manquants.length} variante(s) du paquet sans id dans la relecture de la page` : 'aucune variante gardée de l\'étape page'} — UN tour de lecture seule (get_product), lu par le bureau`);
      const rl = await tourClaude(m, 'lecture-variantes', { dept: 'page', outils: ['tassyir.get_product'],
        schema: { type: 'object', properties: { productId: { type: 'string' }, erreur: { type: 'string' } }, required: ['productId'] },
        message: `LECTURE SEULE du produit ${pid} (boutique ${p.storeId}).
1. get_product { productId: "${pid}" } UNE fois. Rien d'autre : aucun envoi, aucun update_product.
Ne recopie rien et ne résume rien : le bureau lit lui-même la réponse brute de get_product (même mise en fichier).
Rends {productId}.` });
      const horsLecture = (rl.appels || []).find(a => /__(update_products?|create_products?|set_product_active)$/.test(String(a.nom || '')));
      if (horsLecture) throw definitive(`le tour de lecture des variantes a envoyé quelque chose (${String(horsLecture.nom).split('__').pop()}) : vérifie le produit dans Tassyir, rien publié`);
      const relu = listeLue(variantesLues(rl.appels, pid));
      const g = (rl.appels || []).filter(a => /__get_product$/.test(String(a.nom || ''))).slice(-1)[0];
      if (relu.length) { m.d.variantesPage = relu; source = 'la relecture get_product du tour de lecture'; }
      c = construireListeVariantes(relu.length ? relu : (m.d.variantesPage || []), paquetV);
      if (!relu.length) c.fautes.unshift(`variantes non relues${g && g.persistee && g.persistee.erreur ? ` (${g.persistee.erreur})` : g ? '' : ' (get_product non appelé)'}`);
    }
    if (c.fautes.length) throw definitive(`liste des variantes impossible à construire, rien publié : ${c.fautes.slice(0, 4).join(' ; ')}`.slice(0, 600));
    const liste = c.liste, charge = { productId: pid, isActive: true, isVisible: true, variants: liste };
    m.d.listeVariantes = { n: liste.length, visibles: liste.filter(v => !v.isHidden).length, source };
    histoire(m, `publication : liste des ${liste.length} variante(s) construite par le bureau (${source}, recoupée avec le paquet : prix et options identiques) — envoyée telle quelle`);
    const consigne = (entete) => `${entete}
1. update_product avec EXACTEMENT la charge ci-dessous, TELLE QUELLE : le bureau a construit lui-même la liste complète des variantes (id + price + selectedOptions lus chez Tassyir et recoupés avec le paquet, isHidden). Envoie-la telle quelle, ne recalcule rien : ne relis pas les variantes pour les recopier, n'en retire ni n'en ajoute aucune, ne change aucun prix ni aucune option, n'y ajoute rien (jamais la description).
CHARGE EXACTE update_product (une ligne JSON) :
${JSON.stringify(charge)}
2. get_product { productId: "${pid}" } ensuite : relis seulement que c'est bien actif (ne renvoie rien d'après cette lecture). get_store si tu n'as pas le sous-domaine.
Rends {productId, actif (relu), variantesVisibles (nombre relu), urlProduit "https://<sous-domaine>.tassyir.io/product/<slug>"}.`;
    const outils = ['tassyir.get_product', 'tassyir.update_product', 'tassyir.get_store'];
    let r = await tourClaude(m, 'publication', { dept: 'page', outils, schema: schemaPub, message: consigne(`La page est prête : publie le produit ${pid} (boutique ${p.storeId}) — règle du vendeur, une page prête est publiée tout de suite.`) });
    let fl = fautesListeEnvoyee(r.appels, pid, liste);
    if (fl.refusCorrige && !fl.fautes.length) histoire(m, `publication : Tassyir avait refusé un envoi de variantes (-32602, ${VARIANTES_INCOMPLETES}), corrigé dans le même tour`);
    if (fl.fautes.length) {
      histoire(m, `publication : ${fl.fautes.slice(0, 3).join(' ; ')} — UN nouveau tour, la même liste du bureau à envoyer telle quelle`);
      r = await tourClaude(m, 'publication-variantes', { dept: 'page', outils, schema: schemaPub, message: consigne(`La publication du produit ${pid} (boutique ${p.storeId}) n'est pas prouvée : ${fl.fautes.slice(0, 3).join(' ; ')}.`) });
      fl = fautesListeEnvoyee(r.appels, pid, liste);
      if (fl.fautes.length) throw definitive(`${VARIANTES_INCOMPLETES} — publication refusée par le bureau après un nouveau tour : ${fl.fautes.slice(0, 3).join(' ; ')}`.slice(0, 600));
      histoire(m, 'publication : liste du bureau envoyée telle quelle au nouveau tour');
    }
    return finirPublication(m, p, r);
  }
  function systemeChaine(dept, etape = null) {
    const skill = ETAPES_SANS_SKILL.has(etape) ? '' : String(skillDe(dept) || '').slice(0, 60000);
    return [`Tu es l'agent ${dept.toUpperCase()} du bureau « ecom manita », en MODE CHAÎNE : le serveur du bureau te donne UNE étape précise, avec toutes ses entrées.`,
      skill ? `\n=== TA SKILL (la méthode de la maison) ===\n${skill}` : '',
      `\n=== ${REGLES_MAISON}`,
      `\n=== MODE CHAÎNE — ces règles passent avant la skill quand elles se contredisent ===
- Tu n'as AUCUN terminal et aucun fichier : les commandes « python3 … » de ta skill ont DÉJÀ été lancées par le serveur ; leurs résultats exacts sont dans le message. Tu ne recalcules aucun chiffre.
- Tu n'utilises QUE les outils de connecteur autorisés pour cette étape. Un outil refusé : tu ne contournes pas, tu le dis dans « erreur ».
- Tu ne parles pas au client : le serveur lui écrit sur Telegram. Ta réponse finale est UNIQUEMENT l'objet JSON demandé (outil StructuredOutput).
- Tu n'inventes JAMAIS un identifiant (produit, boutique, compte, page, pixel, vidéo, campagne) : chaque id vient d'une réponse de connecteur que tu as lue.
- Si une étape est impossible (droit refusé, compte désactivé, champ refusé deux fois), tu remplis « erreur » avec la réponse BRUTE du connecteur, sans deviner la cause.
- Tout ce que tu crées chez Meta naît EN PAUSE ; rien n'est activé sans l'étape « activation ». Un produit Tassyir créé reste CACHÉ jusqu'à l'étape « publication ».`].filter(Boolean).join('\n');
  }
  /** La 2e méthode : la réponse brute d'un outil de connecteur, lue dans le flux (pas dans la phrase de l'agent). */
  const appelsDe = (r, outilNom) => (r.appels || []).filter(a => a.nom.endsWith('__' + outilNom) && !a.erreur);
  const jsonsDans = texte => { const out = []; const t = String(texte || ''); try { out.push(JSON.parse(t)); return out; } catch {} const re = /\{[\s\S]*\}/g; let x; while ((x = re.exec(t))) { try { out.push(JSON.parse(x[0])); } catch {} } return out; };
  const contient = (r, outilNom, valeur) => appelsDe(r, outilNom).some(a => String(a.sortie || '').includes(String(valeur)));
  /** Un nombre rendu par Claude est-il dans la réponse BRUTE de Meta ? Tel quel, à deux décimales, ou à la virgule
   *  (un montant CURRENCY revient mis en forme : « 21,00 $US »). */
  const dansBrut = (brut, v) => { const n = +v, t = String(brut || ''); return Number.isFinite(n) && [String(v), String(n), n.toFixed(2), n.toFixed(2).replace('.', ',')].some(s => t.includes(s)); };
  /** L'entrée d'un appel BRUT : un objet, ou le même objet passé en texte JSON. */
  const entreeDe = a => { let e = a.entree; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } } return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; };
  /** Les ids qu'un appel d'activation a visés : entity_id, et chaque id d'un brouillon publié (object_ids : une liste, une
   *  liste en texte JSON « ["1","2"] », ou des ids séparés par des virgules). Un id illisible compte comme « ? ». */
  function idsActives(a) {
    const e = entreeDe(a); let lot = e.object_ids;
    if (typeof lot === 'string') { try { lot = JSON.parse(lot); } catch { lot = lot.split(/[\s,;]+/).filter(Boolean); } }
    lot = lot === undefined || lot === null ? [] : Array.isArray(lot) ? lot : [lot];
    return [e.entity_id, ...lot].map(x => (x === undefined || x === null || typeof x === 'object' ? '?' : String(x).trim() || '?'));
  }
  /** Les ids activés par un tour qui ne sont PAS dans objets. Chaque appel compte, même un appel qui a rendu une erreur
   *  (une publication de brouillon peut avoir publié une partie avant de caler). */
  const activesHors = (r, objets) => { const permis = new Set(objets.map(String)); return [...new Set((r.appels || []).filter(a => /__ads_activate_entity$/.test(a.nom)).flatMap(idsActives).filter(id => !permis.has(id)))]; };
  /** [relecture] 10/10/2026 : les objets TOUCHÉS par ads_update_entity pendant un tour d'activation (l'heure de début de la
   *  porte groupée) qui ne sont PAS dans objets — sur le chemin du connecteur rien ne refuse un status ACTIVE glissé sur une
   *  campagne hors du test : la même règle que activesHors (refus définitif, dit au client), jamais seulement « heure non posée ». */
  const touchesHors = (r, objets) => { const permis = new Set(objets.map(String)); return [...new Set((r.appels || []).filter(a => /__ads_update_entity$/.test(a.nom)).map(a => String(entreeDe(a).entity_id ?? '').trim() || '?').filter(id => !permis.has(id)))]; };
  /** La relecture d'un tour de PAUSE (disjoncteur, arrêt), dans les appels BRUTS : chaque objet touché est un objet de CETTE
   *  mission (le test, la scale, leurs ad sets et annonces), la seule chose envoyée est status PAUSED, et chaque campagne à
   *  arrêter a reçu sa pause sans erreur. Rend { fautes, pausee } — la faute la plus grave d'abord (le client lit le début). */
  const refusMeta = a => a.sortie === null || a.sortie === undefined || jsonsDans(a.sortie).some(j => j && typeof j === 'object' && (j.error || j.success === false || j.success === 'false'));
  function relirePause(m, r, campagnes) {
    const c = m.d.campagne || {}, sc = m.d.suivi?.scale?.campagne || null;
    const objets = new Set([c, ...(sc ? [sc] : [])].flatMap(k => [k.id, ...(k.adSets || []).map(a => a.id), ...(k.ads || []).map(a => a.id)]).filter(x => x !== undefined && x !== null).map(String));
    const fautes = [], pausees = new Set();
    for (const a of (r.appels || []).filter(x => /__ads_update_entity$/.test(x.nom))) {
      const e = entreeDe(a), id = String(e.entity_id ?? '').trim() || '?';
      let f = e.fields; if (typeof f === 'string') { try { f = JSON.parse(f); } catch { f = null; } }
      if (!objets.has(id)) { fautes.push(`pause envoyée hors de ce modèle (${id}) : vérifie-le dans Meta`); continue; }
      if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).join() !== 'status' || String(f.status).toUpperCase() !== 'PAUSED') { fautes.push(`${id} touché avec ${JSON.stringify(f ?? e.fields ?? null).slice(0, 80)} au lieu de {"status":"PAUSED"} : vérifie-le dans Meta`); continue; }
      // passée = Meta a RÉPONDU, sans erreur : ni is_error, ni « error » / « success: false » dans la réponse brute (06/10/2026)
      if (!a.erreur && !refusMeta(a)) pausees.add(id);
    }
    // une campagne DÉJÀ en pause que Claude a relue sans la re-pauser : passée si la réponse BRUTE de Meta la montre en pause
    // (jamais sur la parole de Claude) — sinon le client lirait une fausse alerte
    const relu = new Set(), chercher = o => { if (Array.isArray(o)) o.forEach(chercher); else if (o && typeof o === 'object') { if (o.id !== undefined && o.id !== null && [o.status, o.configured_status, o.effective_status].some(v => String(v ?? '').toUpperCase() === 'PAUSED')) relu.add(String(o.id)); Object.values(o).forEach(chercher); } };
    for (const a of appelsDe(r, 'ads_get_ad_entities')) jsonsDans(a.sortie).forEach(chercher);
    const manque = campagnes.filter(Boolean).map(String).filter(k => !pausees.has(k) && !relu.has(k));
    for (const k of [...manque].reverse()) fautes.unshift(`la campagne ${k} n'a pas reçu sa pause : mets-la en pause dans Meta`);
    return { fautes, pausee: !manque.length };
  }

  /* ---------------------------------------- les étapes ---------------------------------------- */
  const CODE_DRIVE = "import sys,json;sys.path.insert(0,sys.argv[1]);import manita;manita.installer(silencieux=True);d=manita.telecharger_drive(sys.argv[2],sys.argv[3]);print('MANITA_JSON '+json.dumps({'quoi':'drive','dossier':d}))";

  /** La descente du Drive (une mission seule, ou UNE fois pour tout un lot) : lancer = l'outil, siVide = le message au client.
   *  entier : on télécharge à chaque passage (des vidéos déjà là = un passage coupé, PC éteint, Drive qui a calé)
   *  et un outil qui sort en erreur est une panne même si une PARTIE des vidéos est arrivée : on ne sépare jamais un
   *  morceau de shooting (des modèles manqueraient, ou un modèle n'aurait que la moitié de ses vidéos).
   *  Une mission seule descend AUSSI entière (07/10/2026) : un Drive qui cassait après deux vidéos sur quatre donnait
   *  « جبت الفيديوات … 2 videos » et la mission partait sans les couleurs et les plans des deux autres, sans un mot. */
  async function descendre({ lien, rushes, lancer, siVide, entier = false }) {
    let horsVideos = null;
    if (entier || !listerVideos(rushes).length) {
      const r = await lancer([path.join(atelier, '1-EDITEUR'), lien, rushes], { code: CODE_DRIVE, dureeMaxMs: 3 * 3600000, inactiviteMaxMs: 30 * 60000 });
      if (r.raison) throw new Error(r.raison);
      // deux pannes différentes, deux messages différents : un téléchargement qui plante n'est pas un dossier vide
      const deja = listerVideos(rushes).length;
      if (r.code !== 0 && (entier || !deja)) {
        horsVideos = deja ? ratesSansVideo(r.sortie, rushes) : null;
        if (!horsVideos) {
          if (!deja && /pas public|not public|permission|Cannot retrieve|Access denied|vide/i.test(r.sortie)) { await siVide(); throw definitive('Drive refuse le dossier (pas public ?) : ' + extrait(r.sortie)); }
          throw new Error(`le téléchargement du Drive a échoué${deja ? ` (incomplet : ${deja} vidéo(s) arrivée(s))` : ''} : ` + extrait(r.sortie));
        }
      }
      if (!listerVideos(rushes).length) { await siVide(); throw definitive('le dossier Drive est descendu VIDE (aucune vidéo)'); }
    }
    const v = listerVideos(rushes); let octets = 0; for (const f of v) octets += fs.statSync(f).size;
    return { rushes, nbVideos: v.length, octets, ...(horsVideos ? { horsVideos } : {}) };
  }
  /** gdown 6 ne s'arrête pas au premier fichier raté (« Too many users have viewed or downloaded this file recently ») :
   *  il descend tous les autres, puis sort en erreur avec la liste des ratés. Un fichier raté qui n'est PAS une vidéo (une
   *  photo, un PDF, un Google Doc) ne fait manquer aucune vidéo : la chaîne ne lit que les vidéos (listerVideos : captures,
   *  montage, séparation). On rend ses noms et la descente passe (07/10/2026, « casse » : depuis « entier », une photo ratée
   *  bloquait la mission pour de bon, « عاود » n'y pouvait rien ; avant « entier », une VIDÉO ratée passait aussi). Rend
   *  null — une PANNE — dès que le doute est permis : une vidéo ratée, un chemin hors du dossier, une autre erreur que la
   *  liste des ratés, une ligne de la liste qui ne recoupe pas les ratés imprimés (« Robe: noir.mp4 » mal coupé), ou une
   *  sortie dont le début est perdu (un raté a pu disparaître des 400 dernières lignes). */
  function ratesSansVideo(sortie, rushes) {
    const s = String(sortie || '');
    if (!/^Building directory structure completed\s*$/m.test(s) || !/Failed to download the following files:/.test(s)) return null;
    const racine = path.resolve(rushes) + path.sep, video = f => EXT_VIDEO.includes(path.extname(f).toLowerCase());
    const rates = [...s.matchAll(/^Failed to download (.+?): /gm)].map(x => x[1].trim());
    if (!rates.length || rates.some(f => !path.resolve(f).startsWith(racine) || video(f))) return null;
    // la liste finale de gdown (« - <chemin> » ; coupée à 300 caractères dans le message de manita.py, entière dans la
    // trace de gdown) : aucune vidéo, et chaque ligne recoupe un raté imprimé
    const liste = [...s.matchAll(/^- (.+)$/gm)].map(x => x[1].trim()).filter(Boolean);
    if (!liste.length || liste.some(f => video(f) || !rates.some(r => r === f || r.startsWith(f)))) return null;
    return [...new Set(rates.map(f => path.relative(rushes, f)))];
  }
  /** Le dossier d'un modèle de lot : il doit exister, avoir des vidéos, et être PLAT (captures.py et MONTER-10 lisent un niveau). */
  function dossierPlat(d) {
    const v = listerVideos(d || '');
    if (!v.length) return 'aucune vidéo dans le dossier du modèle';
    if (v.some(f => path.dirname(f) !== path.resolve(d))) return 'le dossier du modèle n\'est pas plat (sous-dossiers)';
    return null;
  }
  /** N = 1 : un Drive rangé en sous-dossiers (« Noir/ », « Beige/ ») descend tel quel (gdown recrée l'arborescence), mais
   *  captures.py et MONTER-10 ne lisent qu'UN niveau (07/10/2026 : « AUCUNE video lisible », mission bloquée pour de bon).
   *  On construit alors un dossier PLAT (liens durs, sinon copie) où chaque vidéo a un nom à elle (deux « clip.mp4 » de deux
   *  sous-dossiers deviennent « Noir - clip.mp4 » et « Beige - clip.mp4 ») et m.d.rushes pointe dessus ; le dossier du Drive
   *  reste dans m.d.rushesDrive. Un Drive déjà plat : rien ne change (le chemin d'avant). Rejoué sans rien recopier : une
   *  mission descendue avant la correction est aplatie à sa reprise (étape captures). Un modèle de lot : jamais (son
   *  dossier vient déjà plat de la séparation). */
  function aplatirRushes(m) {
    if (m.lot) return null;
    const brut = m.d.rushesDrive || m.d.rushes; if (!brut) return null;
    const v = listerVideos(brut);
    // le dossier du Drive vide ou disparu (place libérée à la main) : on garde le dossier plat déjà fait, jamais un dossier
    // vide à la place (07/10/2026, « casse » : m.d.rushes repartait sur le Drive effacé, captures.py n'y lisait plus rien)
    if (!v.length) return null;
    if (v.every(f => path.dirname(f) === path.resolve(brut))) { m.d.rushes = brut; return null; }
    const plat = path.join(dossier(m), 'rushes-plat');
    const cle = n => n.normalize('NFC').toLowerCase(); // un disque Mac ou Windows ne distingue ni la casse ni NFC / NFD
    const parBase = new Map(); for (const f of v) parBase.set(cle(path.basename(f)), (parBase.get(cle(path.basename(f))) || 0) + 1);
    const pris = new Set(), noms = [];
    // des noms de sous-dossiers longs, mis bout à bout, dépasseraient la limite d'un nom de fichier (255) : base bornée à
    // 120 caractères (comptés en caractères entiers, jamais une lettre coupée en deux), l'unicité vient du suffixe « (2) »
    const borne = n => { const e = path.extname(n), b = [...n.slice(0, n.length - e.length)]; return b.length > 120 ? b.slice(0, 120).join('').trim() + e : n; };
    for (const f of v) {
      const nom = borne(parBase.get(cle(path.basename(f))) > 1 ? path.relative(brut, f).split(path.sep).join(' - ') : path.basename(f));
      const ext = path.extname(nom), base = nom.slice(0, nom.length - ext.length);
      let n = nom; for (let i = 2; pris.has(cle(n)); i++) n = `${base} (${i})${ext}`;
      pris.add(cle(n)); noms.push([f, n]);
    }
    fs.mkdirSync(plat, { recursive: true });
    let liens = 0, copies = 0, gardes = 0, retires = 0;
    for (const x of fs.readdirSync(plat)) if (!pris.has(cle(x))) { fs.rmSync(path.join(plat, x), { recursive: true, force: true }); retires++; }
    for (const [src, n] of noms) {
      const dest = path.join(plat, n);
      try { const a = fs.statSync(src), b = fs.statSync(dest); if ((a.ino === b.ino && a.dev === b.dev) || a.size === b.size) { gardes++; continue; } } catch {}
      fs.rmSync(dest, { force: true });
      try { fs.linkSync(src, dest); liens++; } catch { fs.copyFileSync(src, dest); copies++; }
    }
    m.d.rushesDrive = brut; m.d.rushes = plat;
    if (liens || copies || retires) histoire(m, `rushes : le Drive range ses vidéos en sous-dossiers — dossier plat de ${noms.length} vidéo(s) (${liens} lien(s) dur(s), ${copies} copie(s), ${gardes} déjà là)`);
    return { plat, videos: noms.length, liens, copies, gardes };
  }
  /** Les photos que la page aura (6 à 15, les couleurs alternées) avec ces familles de captures.py. */
  // [relecture] 10/10/2026 : chaque famille à part (« famille-0 », « famille-1 »…), comme les couleurs nommées de l'étape photos —
  // avant, le même nom vide pour toutes faisait compter TOUTES les photos sans alterner (6 noires + 1 grise = 7 ici, 3 à
  // l'étape photos) : l'échec tombait APRÈS le montage
  const photosDe = familles => photosAlternees((familles || []).map((f, i) => ({ nom: 'famille-' + i, exclue: false, captures: (f.captures || []).map(c => c.fichier).filter(x => fs.existsSync(x)) })), 15).length;
  /** captures.py sur les rushes de la mission : couleurs (« auto » ou un nombre), photos par couleur, une image toutes les
   *  « pas » secondes, « ecart » secondes au moins entre deux photos du même rush (défaut de l'outil : 6). */
  async function lancerCaptures(m, sortie, couleurs, combien, pas, ecart = null, rushes = m.d.rushes) {
    fs.rmSync(sortie, { recursive: true, force: true });
    const r = await outil(m, 'captures', '1-EDITEUR/captures.py', ['--rushes', rushes, '--sortie', sortie, '--couleurs', couleurs, '--combien', String(combien), '--pas', String(pas), ...(ecart ? ['--ecart', String(ecart)] : [])], { dureeMaxMs: 2 * 3600000, inactiviteMaxMs: 20 * 60000 });
    if (r.raison) throw new Error(r.raison);
    const rap = lireJSON(path.join(sortie, '_rapport.json'));
    if (!rap || !(rap.familles || []).length) throw definitive('aucune couleur sortie des vidéos : ' + extrait(r.sortie));
    // L'INVARIANT, écrit après CHAQUE passe (historique + mission), relu sur le disque par le bureau (09/10/2026)
    const inv = invariantCaptures(rap, sortie), d2 = rap.deuxieme_passe || {};
    m.d.invariantsCaptures = [...(m.d.invariantsCaptures || []).slice(-19), { passe: path.basename(sortie), couleurs, ...inv, deuxiemePasse: d2.tentee ? (d2.retenue ? 'retenue' : 'pas retenue') : 'non tentée', le: maintenant() }];
    histoire(m, `captures (${path.basename(sortie)}, couleurs ${couleurs}) — invariant ${inv.ok ? 'OK' : 'FAUX'} : ${inv.brutes} famille(s) brute(s) = ${inv.avec} avec photo + ${inv.sans} sans photo · ${inv.somme} capture(s), somme par couleur ${inv.parCouleur.join('+') || '0'} = ${inv.total} sur le disque · ${inv.orphelines} orpheline(s) · ${inv.doubles} double(s)${d2.tentee ? ` · deuxième passe par instant ${d2.familles_avant} → ${d2.familles_apres} (${d2.retenue ? 'retenue' : 'pas retenue'})` : ''}${(rap.familles_sans_capture || []).length ? ` · sans capture cadrée (gardée${rap.familles_sans_capture.length > 1 ? 's' : ''} dans le compte) : couleur ${rap.familles_sans_capture.join(', ')}` : ''}${(rap.rushes_illisibles || []).length ? ` · rush(es) illisible(s), dans aucune famille : ${rap.rushes_illisibles.join(', ')}` : ''}${(rap.rushes_sans_mesure || []).length ? ` · rush(es) lu(s) sans aucune mesure (hors famille) : ${rap.rushes_sans_mesure.join(', ')}` : ''}`);
    return rap;
  }
  const PHOTOS_PAGE = 6; // la page demande au moins six photos (étape photos)
  /** Le complément de l'étape photos : moins de six photos (une mission capturée avant la relance serrée, ou des couleurs
   *  retirées par le client) → captures.py repasse plus SERRÉ (deux secondes d'écart, puis une) et chaque famille trouvée
   *  va à la famille nommée la plus proche (son centre) ; une famille retirée ne reprend rien. On s'arrête dès six photos. */
  /** La couleur PAUVRE d'abord (09/10/2026) : Noir ×6 et Gris ×2 ne s'alternent que sur cinq photos. On ne jette pas les
   *  noires pour forcer l'équilibre : captures.py repasse sur les SEULS rushes de la couleur pauvre (un dossier de liens
   *  durs), une seule couleur, de plus en plus serré (2 s d'écart, puis 1 s, puis 0,5 s ; une image toutes les 1 s puis
   *  0,5 s), et ses photos remplacent les siennes dès qu'il y en a plus. On s'arrête dès six photos alternées. */
  async function capturesPauvres(m) {
    let plus = 0;
    for (const nom of couleursPauvres(m.d.couleurs, PHOTOS_PAGE)) {
      const siennes = m.d.couleurs.filter(c => !c.exclue && c.nom === nom);
      const rushes = [...new Set(siennes.flatMap(c => c.rushes || []))].filter(r => m.d.rushes && fs.existsSync(path.join(m.d.rushes, r)));
      if (!rushes.length) { histoire(m, `photos : la couleur ${nom} a trop peu de photos, et ses rushes ne sont pas connus — pas de relance ciblée`); continue; }
      const cle = String(nom).normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'couleur';
      const seuls = path.join(dossier(m), `rushes-${cle}`);
      fs.rmSync(seuls, { recursive: true, force: true }); fs.mkdirSync(seuls, { recursive: true });
      for (const r of rushes) { try { fs.linkSync(path.join(m.d.rushes, r), path.join(seuls, r)); } catch { fs.copyFileSync(path.join(m.d.rushes, r), path.join(seuls, r)); } }
      for (const [i, x] of [{ pas: 1, ecart: 2 }, { pas: 0.5, ecart: 1 }, { pas: 0.5, ecart: 0.5 }].entries()) {
        if (photosAlternees(m.d.couleurs, 15).length >= PHOTOS_PAGE) break;
        const avant = siennes.reduce((a, c) => a + (c.captures || []).length, 0);
        let rap = null; try { rap = await lancerCaptures(m, path.join(dossier(m), `captures-${cle}-${i + 1}`), '1', 8, x.pas, x.ecart, seuls); }
        catch (e) { histoire(m, `photos : relance des captures de la couleur ${nom} (écart ${x.ecart} s) impossible — ${e.message}`); }
        for (const c of m.d.couleurs) c.captures = (c.captures || []).filter(y => fs.existsSync(y));
        if (!rap) continue;
        const neuves = rap.familles.flatMap(f => (f.captures || []).map(c => c.fichier)).filter(y => fs.existsSync(y));
        const ici = Math.max(0, neuves.length - avant);
        if (ici) { siennes[0].captures = neuves; for (const c of siennes.slice(1)) c.captures = []; plus += ici; }
        histoire(m, `photos : la couleur ${nom} est pauvre — captures repassées sur ses ${rushes.length} rush(es) seulement (écart ${x.ecart} s, une image toutes les ${x.pas} s) : ${ici} photo(s) de plus, ${photosAlternees(m.d.couleurs, 15).length} pour la page, jamais deux fois la même couleur à la suite`);
      }
    }
    return plus;
  }
  async function completerPhotos(m) {
    const gardees = (m.d.couleurs || []).filter(c => !c.exclue);
    if (!gardees.length) return false; // plus aucune couleur gardée : rien à compléter
    const pauvres = await capturesPauvres(m);
    if (photosAlternees(m.d.couleurs, 15).length >= PHOTOS_PAGE) return pauvres > 0;
    const parCouleur = Math.min(8, Math.max(4, Math.ceil(PHOTOS_PAGE / gardees.length)));
    const d2 = (a, b) => (a || [0, 0, 0]).reduce((s, x, i) => s + (x - ((b || [])[i] ?? 0)) ** 2, 0);
    let plus = 0;
    for (const [i, x] of [{ combien: parCouleur, pas: 1, ecart: 2 }, { combien: 8, pas: 0.5, ecart: 1 }].entries()) {
      if (photosAlternees(m.d.couleurs, 15).length >= PHOTOS_PAGE) break;
      let rap = null; try { rap = await lancerCaptures(m, path.join(dossier(m), `captures-page-${i + 1}`), String(Math.max(1, m.d.couleurs.length)), x.combien, x.pas, x.ecart); }
      catch (e) { histoire(m, `photos : complément des captures (écart ${x.ecart} s) impossible — ${e.message}`); }
      // une passe efface son dossier AVANT de tourner : les photos qu'elle avait données à un « عاود » d'avant n'existent plus
      // (07/10/2026, « casse » : une passe qui calait cette fois laissait des photos fantômes, envoyées au dépôt)
      for (const c of m.d.couleurs) c.captures = (c.captures || []).filter(y => fs.existsSync(y));
      if (!rap) continue;
      const neuves = new Map();
      for (const f of rap.familles) {
        let k = m.d.couleurs.reduce((a, c) => (d2(c.centre, f.centre_rgb) < d2(a.centre, f.centre_rgb) ? c : a));
        if (k.exclue && k.fusionneeDans) k = m.d.couleurs.find(c => c.rang === k.fusionneeDans) || k;
        if (k.exclue) continue;
        neuves.set(k, [...(neuves.get(k) || []), ...f.captures.map(c => c.fichier).filter(y => fs.existsSync(y))]);
      }
      let ici = 0;
      for (const [k, liste] of neuves) if (liste.length > k.captures.length) { ici += liste.length - k.captures.length; k.captures = liste; }
      plus += ici;
      histoire(m, `photos : captures repassées serrées (écart ${x.ecart} s, une image toutes les ${x.pas} s) — ${ici} photo(s) de plus, ${photosAlternees(m.d.couleurs, 15).length} pour la page`);
    }
    return plus + pauvres > 0;
  }
  /** Le plan du lot et le nom du modèle DANS ce plan (le client a pu donner un autre nom à la page : MONTER-10 lit celui du
   *  plan). Une mission d'un lot d'avant la phase 2 n'a ni l'un ni l'autre : le plan du lot, et le modèle de son rang. */
  /** [v0.3.9-photos] Le dossier du Drive de CE modèle : un lot → le dossier commun des rushes du modèle dans le plan (jamais la
   *  racine d'un lot de plusieurs modèles : on ne saurait pas à qui sont les photos) ; une mission seule → tout son Drive. */
  function dossierDriveDuModele(m) {
    // une mission seule : le Drive descendu tel quel (rangé en sous-dossiers), sinon celui du lot d'UN modèle (N = 1 compté),
    // sinon ses rushes (un Drive plat garde ses photos à côté des vidéos)
    if (!m.lot) { for (const d of [m.d.rushesDrive, m.demande?.rushesLot, m.d.rushes, path.join(dossier(m), 'rushes')]) if (d && fs.existsSync(d) && listerPhotos(d).length) return d; return null; }
    let p, md;
    try { const { plan } = planDuLot(m); p = lireJSON(plan); md = p && p.modeles.find(x => x && x.nom === (m.lot.modelePlan || '')) || (p && p.modeles[(m.lot.rangPlan || m.lot.rang) - 1]); } catch { return null; }
    if (!p || !md) return null;
    const racine = p.rushes && fs.existsSync(p.rushes) ? p.rushes : path.join(maison, 'lots', m.lot.id, 'rushes');
    const rel = [...new Set((md.segments || []).map(s => String(s.rush || '').replace(/\\/g, '/').split('/').slice(0, -1)).map(x => x.join('/')))];
    if (!rel.length) return null;
    const parts = rel.map(r => r.split('/').filter(Boolean)); const commun = [];
    for (let i = 0; parts.every(x => x[i] !== undefined && x[i] === parts[0][i]); i++) commun.push(parts[0][i]);
    if (!commun.length && (p.modeles || []).length > 1) return null;
    // un dossier « Videos » du modèle : ses photos sont à côté (« …/Mannequin-A/Videos » → « …/Mannequin-A »)
    while (commun.length && /^(videos?|vids?|rushes?|clips?)$/i.test(commun[commun.length - 1])) commun.pop();
    if (!commun.length && (p.modeles || []).length > 1) return null;
    return path.join(racine, ...commun);
  }
  /** Les photos du shooting, PRÊTES pour la page : remises droites (EXIF), sans EXIF, 2000 px au plus sur le grand côté,
   *  JPEG qualité 85 (moins si elles dépassent 450 Ko), les trop petites écartées (moins de 800 px). { nom couleur: [fichiers] } */
  async function photosDuShooting(m, noms) {
    const d = dossierDriveDuModele(m); if (!d) return { parCouleur: {}, vues: 0, raison: 'dossier du modèle introuvable dans le Drive' };
    const brutes = listerPhotos(d); if (!brutes.length) return { parCouleur: {}, vues: 0, raison: 'aucune photo dans le Drive' };
    const avecCouleur = brutes.map(f => ({ f, nom: couleurDePhoto(f, noms) })).filter(x => x.nom);
    if (!avecCouleur.length) return { parCouleur: {}, vues: brutes.length, raison: `${brutes.length} photo(s) dans le Drive, aucune couleur lue dans leurs noms` };
    const sortie = path.join(dossier(m), 'photos-shooting'); fs.rmSync(sortie, { recursive: true, force: true }); fs.mkdirSync(sortie, { recursive: true });
    const liste = path.join(sortie, 'liste.json');
    fs.writeFileSync(liste, JSON.stringify(avecCouleur.map((x, i) => ({ src: x.f, dst: path.join(sortie, `photo-${String(i + 1).padStart(2, '0')}.jpg`), nom: x.nom }))));
    const code = [
      'import json, os, sys', 'from PIL import Image, ImageOps',
      'out = []',
      'for x in json.load(open(sys.argv[1], encoding="utf-8")):',
      '    try:',
      '        im = ImageOps.exif_transpose(Image.open(x["src"])).convert("RGB")',
      '        if min(im.size) < 800:',
      '            out.append({**x, "ok": False, "pourquoi": "trop petite"}); continue',
      '        im.thumbnail((2000, 2000), Image.LANCZOS)',
      '        for q in (85, 80, 75, 70):',
      '            im.save(x["dst"], "JPEG", quality=q, optimize=True, progressive=True)',
      '            if os.path.getsize(x["dst"]) <= 450000: break',
      '        out.append({**x, "ok": True, "l": im.size[0], "h": im.size[1], "o": os.path.getsize(x["dst"])})',
      '    except Exception as e:',
      '        out.append({**x, "ok": False, "pourquoi": str(e)[:120]})',
      'print(json.dumps({"quoi": "photos", "photos": out}))'].join('\n');
    const r = await outil(m, 'photos-shooting', null, [liste], { code, dureeMaxMs: 600000, inactiviteMaxMs: 300000 });
    const j = jsonOutil(r, 'photos');
    if (r.code !== 0 || !j) return { parCouleur: {}, vues: brutes.length, raison: `préparation des photos impossible (code ${r.code}) : ${extrait(r.sortie, 160)}` };
    const parCouleur = {};
    for (const x of j.photos || []) if (x.ok && fs.existsSync(x.dst)) (parCouleur[x.nom] = parCouleur[x.nom] || []).push(x.dst);
    const gardees = Object.values(parCouleur).flat().length;
    return { parCouleur, vues: brutes.length, lues: avecCouleur.length, gardees, dossier: d, ...(gardees ? {} : { raison: `${avecCouleur.length} photo(s) avec couleur, aucune utilisable (trop petites ou illisibles)` }) };
  }
  function planDuLot(m) {
    // le chemin écrit dans la mission est ABSOLU : une maison déplacée (autre dossier, autre PC, Windows réinstallé) le
    // rend faux, alors que le plan est toujours là, dans le lot de CETTE maison
    const ici = path.join(maison, 'lots', m.lot.id, 'separation', 'plan.json');
    const plan = m.lot.plan && fs.existsSync(m.lot.plan) ? m.lot.plan : fs.existsSync(ici) ? ici : (m.lot.plan || ici);
    const p = lireJSON(plan);
    if (!p || !Array.isArray(p.modeles)) throw definitive(`plan du lot introuvable : ${plan}`);
    // le rang DANS LE PLAN (rangPlan) : un modèle retiré par le client (« ماشي صحيح ») décale les places, jamais le plan
    const md = m.lot.modelePlan ? p.modeles.find(x => x && x.nom === m.lot.modelePlan) : p.modeles[(m.lot.rangPlan || m.lot.rang) - 1];
    if (!md || !md.nom) throw definitive(`le modèle ${m.lot.rang} (« ${m.lot.modelePlan || '?'} ») n'est pas dans le plan du lot ${m.lot.id}`);
    return { plan, modele: md.nom };
  }

  const ETAPE = {
    async descente(m) {
      // une mission née d'un lot ne télécharge JAMAIS : son dossier vient de la séparation (sinon tout le Drive, tous les modèles mélangés)
      if (m.lot) { const faute = dossierPlat(m.d.rushes); if (faute) throw definitive(`${faute} (lot ${m.lot.id})`); return; }
      // entier : un outil sorti en erreur est une panne même si une partie est arrivée (un nouvel essai, puis « عاود ») ; à la
      // reprise (PC coupé pendant la descente) on retélécharge au lieu de croire les fichiers déjà là
      const { horsVideos, ...d } = await descendre({ lien: m.demande.lien, rushes: path.join(dossier(m), 'rushes'), lancer: (args, o) => outil(m, 'descente', null, args, o), siVide: () => envoyer(m, M.driveVide()), entier: true });
      if (horsVideos) histoire(m, `descente : ${horsVideos.length} fichier(s) qui ne sont pas des vidéos ne sont pas descendus du Drive (${horsVideos.slice(0, 5).join(', ')}${horsVideos.length > 5 ? '…' : ''}) — aucune vidéo ne manque`);
      Object.assign(m.d, d);
      aplatirRushes(m); // un Drive rangé en sous-dossiers : un dossier plat, captures et montage lisent un seul niveau
      await envoyer(m, M.driveFini(d.nbVideos, (d.octets / 1e9).toFixed(2)));
    },
    async separation(m) {
      if (!m.lot) return SAUTE; // une mission seule : un lien = un modèle, rien à séparer
      const faute = dossierPlat(m.d.rushes);
      if (faute) throw definitive(`${faute} (lot ${m.lot.id})`);
    },
    async captures(m) {
      aplatirRushes(m); // une mission seule descendue avant la correction (Drive en sous-dossiers) est aplatie ici, à sa reprise
      const sortie = path.join(dossier(m), 'captures');
      for (const v of ['captures-2', 'captures-3', 'captures-4', 'captures-page-1', 'captures-page-2']) fs.rmSync(path.join(dossier(m), v), { recursive: true, force: true }); // les passes d'un essai d'avant
      // LA LOI DU COMPTAGE (09/10/2026) : le NOMBRE DIT par le client s'il est dans la fiche, sinon « auto »
      const dit = nombreDitCouleurs(m.demande && m.demande.reponses);
      let rap = await lancerCaptures(m, sortie, dit ? String(dit) : 'auto', 4, 2), garde = sortie, n = photosDe(rap.familles);
      // LA PAGE DEMANDE SIX PHOTOS : on le vérifie ICI, avant les couleurs et le montage (07/10/2026 : un modèle filmé en
      // une prise de 14 s par couleur donnait deux photos par prise à six secondes d'écart ; l'échec tombait à l'étape
      // photos, APRÈS le montage, et « عاود » ne refaisait pas les captures). On relance pour TOUTES les couleurs (le même
      // nombre de familles) : plus de photos par couleur (une seule couleur : six, comme avant), puis un écart plus court
      // (deux secondes, puis une) et des images plus serrées. On garde la meilleure passe ; les autres s'effacent.
      const K = rap.familles.length, parCouleur = Math.min(8, Math.max(4, Math.ceil(PHOTOS_PAGE / K)));
      const relances = [...(K === 1 ? [{ combien: 6, pas: 2, ecart: null }] : []), { combien: parCouleur, pas: 1, ecart: 2 }, { combien: 8, pas: 0.5, ecart: 1 }];
      for (const [i, x] of relances.entries()) {
        if (n >= PHOTOS_PAGE) break;
        const d = path.join(dossier(m), `captures-${i + 2}`);
        try {
          const r2 = await lancerCaptures(m, d, String(K), x.combien, x.pas, x.ecart), n2 = photosDe(r2.familles);
          histoire(m, `captures : ${n} photo(s) pour la page (il en faut ${PHOTOS_PAGE}) — relance ${i + 1} : ${x.combien} par couleur, une image toutes les ${x.pas} s, ${x.ecart || 6} s d'écart → ${n2}`);
          if (n2 > n) { if (garde !== sortie) fs.rmSync(garde, { recursive: true, force: true }); rap = r2; garde = d; n = n2; } else fs.rmSync(d, { recursive: true, force: true });
        } catch (e) { histoire(m, `captures : relance ${i + 1} sans résultat — ${e.message}`); fs.rmSync(d, { recursive: true, force: true }); }
      }
      if (garde !== sortie) fs.rmSync(sortie, { recursive: true, force: true });
      // les rushes de chaque famille (mesurés par captures.py sur tout le rush) : le montage N = 1 les reçoit avec le NOM que le
      // client donne à chaque couleur (MONTER-10 --familles), au lieu de refaire ses familles aux pixels
      m.d.couleurs = rap.familles.map((f, i) => ({ rang: i + 1, centre: f.centre_rgb, captures: f.captures.map(c => c.fichier).filter(x => fs.existsSync(x)), rushes: (f.rushes || []).map(r => path.basename(String(r).replace(/\\/g, '/'))), nom: null, exclue: false,
        ...(f.captures.length ? {} : { sansCapture: true, ...(f.apercu && fs.existsSync(f.apercu) ? { apercu: f.apercu } : {}) }) }));
      m.d.capturesManque = rap.manque || []; m.d.capturesEcart = rap.ecart_secondes ?? null;
      // l'écart avec le nombre dit, NOMMÉ dans les deux sens APRÈS la deuxième passe (captures.py l'a tentée), puis on continue
      const vu = (rap.ecart_nombre_dit && Number.isInteger(rap.ecart_nombre_dit.vu_par_l_outil)) ? rap.ecart_nombre_dit.vu_par_l_outil : null;
      m.d.couleursDites = dit; m.d.couleursVues = vu; m.d.ecartCouleurs = ecartNombreDit(dit, m.d.couleurs.length, vu);
      histoire(m, `captures : ${m.d.couleurs.length} couleur(s) gardée(s) (aucune famille ni rush jeté) — ${m.d.ecartCouleurs}`);
      // [relecture] 10/10/2026 : alternées, il en manque (une couleur pauvre) — la relance de la couleur pauvre (capturesPauvres)
      // passe ICI, avant le montage, chaque famille sous un nom provisoire (remis à vide : c'est le client qui nomme ensuite)
      if (n < PHOTOS_PAGE && m.d.couleurs.length > 1) {
        m.d.couleurs.forEach((c, i) => { c.nom = 'famille-' + i; });
        try { await capturesPauvres(m); } finally { for (const c of m.d.couleurs) c.nom = null; }
        for (const c of m.d.couleurs) c.captures = (c.captures || []).filter(x => fs.existsSync(x));
        const n2 = photosAlternees(m.d.couleurs.map((c, i) => ({ ...c, nom: 'famille-' + i })), 15).length;
        if (n2 !== n) histoire(m, `captures : ${n} photo(s) alternées → ${n2} après la relance de la couleur pauvre (avant le montage)`);
        n = n2;
      }
      // l'échec arrive TÔT et en clair (rien n'est monté pour rien) ; « عاود » refait les captures et toutes leurs relances
      if (n < PHOTOS_PAGE) throw Object.assign(definitive(`trop peu de photos pour la page : ${n} sur ${PHOTOS_PAGE}, même avec des captures serrées (prises trop courtes, ou modèle jamais en entier)`), { client: M.photosCourtes(m.id, n) });
    },
    async couleurs(m) {
      // LA QUESTION DES COULEURS À CHAQUE LOT (09/10/2026, décision du vendeur) : le client nomme TOUJOURS chaque famille
      // sur sa photo — un modèle de lot comme une mission seule. Le nom que la chaîne trouve (les couleurs que Claude a vues
      // dans les planches, la plus proche en Lab, SANS AUCUNE FUSION) n'est plus qu'une PROPOSITION : « صحيح » la valide,
      // un bouton de la palette la remplace. Plus jamais un nommage silencieux (couleursAuto). Une famille sans photo cadrée
      // est montrée par son aperçu, et c'est dit.
      const st = m.etapes.couleurs;
      if (!st.demande) {
        // AUCUN NOM N'ENTRE AVANT LA QUESTION (10/10/2026, passe « casser ») : une mission arrêtée entre un nommage silencieux
        // d'avant (couleursAuto, fusion) et la fin de son étape repartait avec ses noms — les questions partaient ET l'étape
        // finissait aussitôt, les réponses du client tombaient sur « هاذ السؤال فات ». Avant la question, tout est remis à
        // zéro : les captures d'une famille fondue par la chaîne lui sont rendues, aucun nom, aucune famille retirée.
        for (const c of m.d.couleurs) if (c.fusionneeDans) { const cible = m.d.couleurs.find(k => k.rang === c.fusionneeDans); if (cible) cible.captures = (cible.captures || []).filter(x => !(c.captures || []).includes(x)); }
        const avaitNoms = m.d.couleurs.some(c => c.nom || c.exclue);
        for (const c of m.d.couleurs) { c.nom = null; c.exclue = false; delete c.fusionneeDans; delete c.nommeA; }
        m.d.nommage = 0; // casse-4 : l'ordre de nommage repart avec la question
        if (avaitNoms || m.d.couleursAuto) histoire(m, 'couleurs : des noms posés avant la question (version d\'avant, coupure) sont remis à zéro — le client nomme');
        delete m.d.couleursAuto;
        const total = m.d.couleurs.length;
        const vues = m.lot && !m.lot.couleursClient ? (m.lot.couleurs || []).filter(c => PALETTE.some(p => p.v === c)) : [];
        const propositions = nommerSansFusion(m.d.couleurs, vues.length ? vues : PALETTE.map(p => p.v));
        m.d.couleurs.forEach((c, i) => { c.propose = propositions[i] || null; });
        histoire(m, `couleurs : la question est posée (${total} famille(s))${m.lot ? (m.lot.couleursClient ? ', le client a dit « اللونات غالطين »' : '') : ''} — propositions de la chaîne, sans fusion : ${propositions.join(', ')}`);
        const sans = m.d.couleurs.filter(c => c.sansCapture).length, dit = m.d.couleursDites || null;
        const vu = m.d.couleursVues || null;
        if (sans || (dit && dit !== total) || (dit && vu && vu !== total)) await envoyer(m, M.couleursCompte(total, dit, sans, vu));
        for (const c of m.d.couleurs) {
          // [desc-bilan] le nombre de couleurs DANS la question (pas de question en plus, AVANCEMENT 22:25) : la 1re photo porte
          // le nombre trouvé et le nombre réel en boutons — seulement quand aucun nombre n'a encore été dit (fiche, ou une
          // correction d'avant : la question refaite ne repropose pas, l'écart est nommé par couleursCompte)
          const msg = M.couleurQuestion(m.id, c.rang, total, c.propose, !!c.sansCapture, { gen: +m.d.questionCouleurs || 0, nombre: c.rang === m.d.couleurs[0].rang && !m.d.couleursDites ? total : null });
          const tg = telegram();
          const legendePhoto = m.lot ? [...enteteModele(m.lot), msg.texte].join('\n') : msg.texte;
          const photo = (c.captures || [])[0] || (c.apercu && fs.existsSync(c.apercu) ? c.apercu : null);
          const r = tg && photo ? await tg.envoyerPhoto(photo, legendePhoto, { boutons: msg.boutons, minArabe: 3 }) : await envoyer(m, msg);
          if (!r.envoye) throw new Error('question des couleurs non envoyée : ' + (r.fautes || []).join(' ; '));
        }
        st.demande = maintenant();
      }
      return m.d.couleurs.every(c => c.nom || c.exclue) ? undefined : ATTENTE;
    },
    async montage(m) {
      const nommees = m.d.couleurs.filter(c => !c.exclue);
      const n = new Set(nommees.map(c => c.nom)).size;
      const creas = path.join(dossier(m), 'creas');
      const musiques = R().musiques && fs.existsSync(R().musiques) ? R().musiques : null;
      // [relecture] 10/10/2026 : seules les musiques de PLUS de 12 s comptent (la loi du 09/10, celle de l'installation et de
      // MONTER-10, qui écarte les autres) — avant, tout fichier audio comptait (« ._ » d'un disque Mac et morceaux courts
      // compris) : le contrôle exigeait le son sur des vidéos que MONTER-10 avait montées sans musique
      const nbMus = musiques ? (await compterMusiquesA(musiques, ffprobe())).longues : 0;
      m.d.musiques = nbMus;
      fs.mkdirSync(creas, { recursive: true });
      const duree = { dureeMaxMs: 4 * 3600000, inactiviteMaxMs: 30 * 60000 };
      // STYLE NATIF partout (règle du vendeur, 06/10/2026) : la plaque POV seule, aucun fond flouté, aucune barre ; des
      // rushes de tailles différentes sont ramenés à la taille majoritaire en REMPLISSANT (MONTER-10)
      let r, moteur, raison;
      if (m.lot) {
        // un modèle de lot : monté depuis le PLAN du lot (ses segments, et rien que les siens), avec le contrôle
        // anti-mélange et le rythme 1,6 / 3 s de MONTER-10. Le mode --rushes exige quatre rushes : un modèle fait
        // d'une ou deux longues prises y serait refusé.
        const { plan, modele } = planDuLot(m);
        moteur = 'plan'; raison = `modèle « ${modele} » du plan du lot ${m.lot.id}`;
        histoire(m, `montage : moteur ${moteur} (${raison})`);
        r = await outil(m, 'montage', '1-EDITEUR/MONTER-10.py', ['--plan', plan, '--modele', modele, '--style', 'natif', '--pov', m.demande.reponses.niche, '--sortie', creas, '--de', '1', '--a', '10', ...(nbMus ? ['--musiques', musiques] : [])], duree);
      } else {
        // N = 1 : le chemin d'avant (MONTER-10 sur les rushes, ou manita.py sur de longues prises).
        // UNE SEULE COULEUR : MONTER-10 sait la monter (--couleurs 1 : 3 s partout, la règle du vendeur) en NATIF. Avant, elle
        // partait chez manita.py, qui remplit le 9:16 d'un FOND FLOUTÉ dès que les rushes ne sont pas en 9:16 — interdit
        // (06/10/2026). manita.py ne reste que pour moins de quatre rushes (MONTER-10 en exige quatre), ou en repli si
        // MONTER-10 ne sort aucune vidéo.
        const videos = listerVideos(m.d.rushes);
        ({ moteur, raison } = await quelMoteurA(ffprobe(), videos));
        // moins de quatre rushes : MONTER-10 les monte maintenant lui-même (un plan d'UN modèle : rythme 1,6 / 3 s, coupes évitées) ;
        // manita.py (sans le rythme du vendeur, marqué A REGARDER) ne sert plus qu'en repli, s'il ne sort aucune vidéo
        if (n < 2 && moteur === 'rushes') raison += ' ; une seule couleur : MONTER-10 --couleurs 1 (3 s partout, natif)';
        // les familles NOMMÉES par le client (rushes mesurés par captures.py) : chaque couleur ouvre une fois, sous son nom ; une
        // couleur retirée (« حيّدها ») ne sert pas. Une mission d'avant (couleurs sans rushes) : --couleurs N comme avant.
        const avecRushes = m.d.couleurs.length && m.d.couleurs.every(c => Array.isArray(c.rushes) && c.rushes.length);
        const familles = path.join(dossier(m), 'familles.json');
        if (avecRushes) fs.writeFileSync(familles, JSON.stringify({ familles: m.d.couleurs.map(c => ({ nom: c.nom || `couleur-${c.rang}`, rushes: c.rushes, ...(c.exclue ? { exclue: true } : {}) })) }, null, 1));
        histoire(m, `montage : moteur ${moteur} (${raison})`);
        const scenes = () => outil(m, 'montage', '1-EDITEUR/manita.py', ['--projet', m.d.rushes, '--pov', m.demande.reponses.niche, '--sortie', creas, ...(nbMus ? ['--musiques', musiques] : [])], duree);
        r = moteur === 'rushes'
          ? await outil(m, 'montage', '1-EDITEUR/MONTER-10.py', ['--rushes', m.d.rushes, '--sortie', creas, '--pov', m.demande.reponses.niche, '--combien', '10', '--style', 'natif', '--couleurs', String(Math.max(1, n)), ...(avecRushes ? ['--familles', familles] : []), ...(nbMus ? ['--musiques', musiques] : [])], duree)
          : await scenes();
        if (moteur === 'rushes' && !r.raison && !listerVideos(creas).some(f => /variante_\d+\.mp4$/i.test(f))) {
          moteur = 'scenes'; histoire(m, `montage : MONTER-10 n'a sorti aucune vidéo pour ${n < 2 ? 'une seule couleur' : n + ' couleurs'} (code ${r.code} : ${extrait(r.sortie, 160)}) ; repli sur manita.py`);
          r = await scenes();
        }
      }
      if (r.raison) throw new Error(r.raison);
      m.d.moteur = moteur; m.d.montageCode = r.code; m.d.montageSortie = extrait(r.sortie, 600);
    },
    async controle(m) {
      const creas = path.join(dossier(m), 'creas');
      const rap = lireJSON(path.join(creas, '_rapport.json'));
      const conforme = new Map(Array.isArray(rap) ? rap.map(f => [path.basename(f.fichier || ''), f]) : []);
      const fichiers = listerVideos(creas).filter(f => /variante_\d+\.mp4$/i.test(f));
      const avecMusique = (m.d.musiques || 0) > 0;
      const bonnes = [], refus = [];
      for (const f of fichiers) {
        const s = await sonderA(ffprobe(), f); const taille = fs.statSync(f).size; const rf = conforme.get(path.basename(f));
        // le contrôle anti-mélange de MONTER-10 (--plan) a relu chaque bloc : une vidéo qui porte deux modèles ne part jamais
        // LOI DES DIX SECONDES (08/10/2026) : chaque vidéo livrée dépasse STRICTEMENT 10 s, mesurée ici par ffprobe (et une
        // vidéo que l'outil a marquée « trop_courte » ne part jamais) — jetée comme une vidéo à deux modèles
        const pourquoi = !s.ok ? s.raison : !s.video ? 'pas d\'image' : s.duree <= DUREE_MINI_LIVREE ? `trop courte (${s.duree.toFixed(1)} s, il faut plus de ${DUREE_MINI_LIVREE} s)` : (rf && rf.trop_courte === true) ? 'trop courte (marquée par l\'outil)' : s.duree > 90 ? 'trop longue' : taille < 100000 ? 'fichier trop petit' : (avecMusique && !s.audio) ? 'pas de son' : (rf && rf.un_seul_modele === false) ? 'deux modèles dans la vidéo' : null;
        if (pourquoi) refus.push({ fichier: path.basename(f), pourquoi }); else bonnes.push({ fichier: f, duree: +s.duree.toFixed(2), largeur: s.largeur, hauteur: s.hauteur, rapport: conforme.get(path.basename(f)) || null });
      }
      m.d.creas = bonnes; m.d.creasRefusees = refus;
      // une seule vidéo saine suffit (08/10/2026 : le client peut choisir UNE créa) ; zéro arrête toujours la mission
      if (bonnes.length < 1) throw definitive(`pas assez de vidéos saines (${bonnes.length} sur ${fichiers.length}) : ${refus.map(x => x.fichier + ' ' + x.pourquoi).join(', ').slice(0, 200) || extrait(m.d.montageSortie)}`);
      // LE FILM REVU (09/10/2026, décision du coordinateur) : une vidéo que MONTER-10 (--plan) a marquée « film revu » (la
      // matière trop courte remontre du film pour dépasser 10 s ; A REGARDER) reste SAINE — elle n'arrête pas la mission —
      // mais ne part jamais en silence : l'historique et le message au client disent si TOUTES les vidéos saines du modèle
      // en sont, ou seulement une partie (le nom du modèle sur sa ligne latine)
      const revues = bonnes.filter(b => b.rapport && Array.isArray(b.rapport.film_revu) && b.rapport.film_revu.length);
      const nomRevu = [m.lot && m.lot.nom, m.demande && m.demande.reponses && m.demande.reponses.nom, m.lot && m.lot.modelePlan, ...bonnes.map(b => b.rapport && b.rapport.modele)]
        .map(nomLatin).find(x => x !== 'Modele') || nomLatin(`Modele ${m.code || ''}`);
      m.d.creasFilmRevu = revues.map(b => path.basename(b.fichier));
      histoire(m, `contrôle : ${bonnes.length} vidéo(s) saine(s) sur ${fichiers.length}` + (!revues.length ? '' : revues.length === bonnes.length
        ? ` ; FILM REVU : TOUTES les vidéos saines de « ${nomRevu} » remontrent du film déjà vu (rush trop court pour plus de 10 s de film différent) — à regarder avant la pub`
        : ` ; FILM REVU : ${revues.length} sur ${bonnes.length} vidéos saines de « ${nomRevu} » remontrent du film déjà vu (rush trop court) : ${m.d.creasFilmRevu.join(', ')} — à regarder avant la pub`));
      const tg = telegram();
      if (tg) {
        const planches = listerFichiers(creas, /^_planche_variante_\d+\.png$/i).slice(0, 6);
        if (planches.length) await tg.envoyerAlbum(planches, legende(m));
        const premiere = bonnes.find(b => fs.statSync(b.fichier).size < 45 * 1048576);
        if (premiere) await tg.envoyerVideo(premiere.fichier, legende(m));
      }
      await envoyer(m, { ...M.montageFini(bonnes.length, fichiers.length, revues.length ? { n: revues.length, nom: nomRevu } : null), boutons: M.boutonStop(m.id) });
    },
    async photos(m) {
      for (const c of m.d.couleurs) c.captures = (c.captures || []).filter(f => fs.existsSync(f)); // jamais une photo fantôme au dépôt
      // [v0.3.9-photos] les PHOTOS DU SHOOTING d'abord (le Drive, par couleur lue dans le nom du fichier) ; les images tirées
      // des vidéos seulement en dernier recours (aucune photo, ou une couleur sans photo), et le client le lit
      const noms = [...new Set(m.d.couleurs.filter(c => !c.exclue).map(c => c.nom).filter(Boolean))];
      let choix = null;
      try {
        const sh = await photosDuShooting(m, noms);
        m.d.photosShooting = { vues: sh.vues || 0, gardees: sh.gardees || 0, raison: sh.raison || null };
        if (sh.gardees) {
          const avecPhotos = noms.map(n => ({ nom: n, exclue: false, captures: sh.parCouleur[n] || [] }));
          const seules = photosAlternees(avecPhotos, 15);
          const manquent = noms.filter(n => !(sh.parCouleur[n] || []).length);
          if (seules.length >= PHOTOS_PAGE && !manquent.length) { choix = seules; histoire(m, `photos : ${seules.length} photo(s) du shooting (${sh.gardees} prêtes sur ${sh.vues} dans le Drive), aucune image tirée des vidéos`); }
          else {
            // les photos d'abord, puis les images des vidéos de la même couleur pour compléter
            const melange = noms.map(n => ({ nom: n, exclue: false, captures: [...(sh.parCouleur[n] || []), ...m.d.couleurs.filter(c => !c.exclue && c.nom === n).flatMap(c => c.captures)] }));
            choix = photosAlternees(melange, 15);
            const deVideo = choix.filter(c => !String(c.fichier).startsWith(path.join(dossier(m), 'photos-shooting'))).length;
            histoire(m, `photos : ${choix.length - deVideo} photo(s) du shooting + ${deVideo} image(s) des vidéos${manquent.length ? ` (sans photo : ${manquent.join(', ')})` : ''}`);
            if (deVideo) await envoyer(m, M.photosDesVideos(deVideo, manquent));
          }
        } else { histoire(m, `photos : ${sh.raison} — les images des vidéos servent`); if (sh.vues && /aucune couleur lue/.test(sh.raison || '')) await envoyer(m, M.photosDesVideos(null, [])); }
      } catch (e) { histoire(m, `photos du shooting : ${String(e.message || e).slice(0, 200)} — les images des vidéos servent`); choix = null; }
      if (!choix) choix = photosAlternees(m.d.couleurs, 15);
      // moins de six : une mission capturée avant la relance serrée (bloquée ici, « عاود ») ou des couleurs retirées par le
      // client — les captures repassent serrées pour les couleurs gardées, avant de déclarer l'échec (07/10/2026)
      if (choix.length < PHOTOS_PAGE) { await completerPhotos(m); sauver(m); choix = photosAlternees(m.d.couleurs, 15); }
      // le déséquilibre, même après les relances de la couleur pauvre : dit en clair (quelle couleur manque), jamais une page
      // qui tombe chez manita-produit sur « deux photos de la même couleur se suivent »
      const pauvres = couleursPauvres(m.d.couleurs, PHOTOS_PAGE);
      if (choix.length < PHOTOS_PAGE && pauvres.length) {
        const compte = [...new Set(m.d.couleurs.filter(c => !c.exclue).map(c => c.nom))].map(n => [n, m.d.couleurs.filter(c => !c.exclue && c.nom === n).reduce((a, c) => a + c.captures.length, 0)]);
        throw Object.assign(definitive(`couleurs déséquilibrées : ${compte.map(([n, k]) => `${n} ${k}`).join(', ')} — en alternant (jamais deux fois la même couleur à la suite) la page n'a que ${choix.length} photos sur ${PHOTOS_PAGE}, même après les relances des captures de ${pauvres.join(', ')}`), { client: M.couleursPauvres(m.id, pauvres, compte) });
      }
      if (choix.length < PHOTOS_PAGE) throw Object.assign(definitive(`la page demande au moins ${PHOTOS_PAGE} photos, il y en a ${choix.length} (trop peu de plans entiers dans les vidéos)`), { client: M.photosCourtes(m.id, choix.length) });
      const pub = await depot.publier(choix.map(c => c.fichier), { etiquette: `${m.id}-photos` });
      try {
        const r = await tourClaude(m, 'photos', { dept: 'page', outils: ['tassyir.upload_image'],
          schema: { type: 'object', properties: { images: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, imageUrl: { type: 'string' } }, required: ['index', 'imageUrl'] } }, erreur: { type: 'string' } }, required: ['images'] },
          message: `Mets ces ${pub.urls.length} photos du produit sur le CDN de Tassyir. Appelle upload_image UNE seule fois avec sourceUrls = la liste ci-dessous, DANS CET ORDRE (index 0 = la première). Ne mets rien d'autre.\n${JSON.stringify(pub.urls, null, 1)}\nRends {"images":[{"index":0,"imageUrl":"https://cdn.tassyir.io/…"}, …]} — une entrée par photo réussie, l'imageUrl EXACTE rendue par upload_image. Si upload_image refuse tout, remplis "erreur" avec sa réponse brute.` });
        // 2e méthode : la réponse brute d'upload_image (pas seulement la phrase de l'agent)
        const brut = new Map();
        for (const a of appelsDe(r, 'upload_image')) for (const j of jsonsDans(a.sortie)) {
          const lignes = Array.isArray(j.results) ? j.results : Array.isArray(j) ? j : [j];
          for (const x of lignes) if (x && x.imageUrl && (x.sourceUrl || x.index !== undefined)) brut.set(x.sourceUrl ? pub.urls.indexOf(x.sourceUrl) : +x.index, x.imageUrl);
        }
        const finales = [];
        for (const im of r.structure.images || []) {
          const url = String(im.imageUrl || '');
          if (!/^https:\/\//.test(url)) continue;
          if (brut.size && brut.get(+im.index) !== url) throw new Error(`l'agent annonce une adresse que upload_image n'a pas rendue (photo ${im.index})`);
          if (!brut.size && !contient(r, 'upload_image', url)) throw new Error(`adresse introuvable dans la réponse brute d'upload_image (photo ${im.index})`);
          if (choix[+im.index]) finales.push({ ...choix[+im.index], cdn: url });
        }
        if (finales.length < 6) throw new Error(`seulement ${finales.length} photo(s) acceptée(s) par Tassyir sur ${choix.length}`);
        m.d.photosPage = finales;
      } finally { await pub.fermer(); }
    },
    async textes(m) {
      const rep = m.demande.reponses;
      const couleurs = [...new Set(m.d.couleurs.filter(c => !c.exclue).map(c => c.nom))];
      const images = [];
      for (const c of m.d.couleurs.filter(c => !c.exclue).slice(0, 4)) { const v = await vignette(m, c.captures[0], `vignette-${c.rang}.jpg`); if (v) images.push({ media_type: 'image/jpeg', data: fs.readFileSync(v).toString('base64') }); }
      let script; try { script = lireScriptAngles(); } catch (e) { throw definitive(`le script d'angles du vendeur est illisible (${path.basename(FICHIER_SCRIPT_ANGLES)}) : ${e.message}`); }
      const consigne = m.d.consigneTextes ? `\nCORRECTION DEMANDÉE PAR LE CONTRÔLE AUTOMATIQUE (à appliquer, le reste peut rester) : ${m.d.consigneTextes}\n` : '';
      const action = rep.mode === 'message' ? 'ابعثيلنا ميساج' : 'اطلبي من الرابط';
      const liste = { type: 'array', items: { type: 'string' } }, deux = { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 };
      const r = await tourClaude(m, 'textes', { dept: 'page', outils: [], images,
        schema: { type: 'object', properties: {
          analyse: { type: 'object', properties: { visible: { type: 'string' }, analyse_visuelle: { type: 'string' }, hypotheses: liste } },
          strategie_contenu: { type: 'string' }, titre_produit: { type: 'string' }, phrase_landing: { type: 'string' },
          description_courte: { type: 'string' }, description_longue: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
          angles: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'object', properties: {
            angle: { type: 'string' }, explication: { type: 'string' }, declencheurs: liste, primaries: deux, titres: deux, descriptions: deux,
            meilleur: { type: 'object', properties: { primary: { type: 'integer', minimum: 0, maximum: 1 }, titre: { type: 'integer', minimum: 0, maximum: 1 }, description: { type: 'integer', minimum: 0, maximum: 1 } }, required: ['primary', 'titre', 'description'] },
            audience: { type: 'object', properties: { age: { type: 'string' }, sexe: { type: 'string' }, interets: liste, comportement: { type: 'string' } } }, mots_cles: liste },
            required: ['angle', 'primaries', 'titres', 'descriptions', 'meilleur'] } },
          offres: liste, positionnement_prix: { type: 'string' }, idees_creas: liste,
          tests: { type: 'object', properties: { trois_premiers_angles: liste, facebook: { type: 'string' }, instagram: { type: 'string' }, tiktok: { type: 'string' }, premiere_crea: { type: 'string' }, image_ou_video: { type: 'string' }, message_froid: { type: 'string' }, message_retargeting: { type: 'string' } } },
          retargeting: liste, notes_finales: liste, erreur: { type: 'string' } },
          required: ['titre_produit', 'description_courte', 'description_longue', 'angles'] },
        message: `Écris les TEXTES de ce modèle en suivant le SCRIPT D'ANGLES DU VENDEUR (en bas, tel qu'il l'a écrit), avec UNE EXCEPTION décidée par le vendeur : tous les textes que la cliente lit (titre, descriptions de la page, primary texts, headlines, descriptions d'annonce) sont en DARIJA ALGÉRIENNE, pas en arabe standard. Tout le reste du script s'applique (analyse visuelle autonome, aucune question).
Regarde d'abord les photos jointes : pas un mot sans avoir vu le vêtement.${consigne}
Faits (ne rien inventer d'autre) :
${JSON.stringify({ nom_demande: rep.nom === 'auto' ? null : rep.nom, prix_da: rep.detail, couleurs, tailles: rep.tailles, niche: rep.niche, mode: rep.mode, paiement: 'الدفع عند الاستلام', livraison: '58 wilayas' }, null, 1)}
Ce que tu rends (le bureau range lui-même) :
- titre_produit : le « Titre du Produit » du script, deux à six mots, sans prix${rep.nom === 'auto' ? '' : ` ; garde le nom donné par le client : « ${rep.nom} »`}.
- phrase_landing : la phrase de quatre mots.
- description_courte : la description courte du HAUT de la page (la structure courte du script), deux à six lignes courtes, aucun prix.
- description_longue : la description longue (la structure longue du script) en deux à cinq paragraphes de deux à six lignes courtes, aucun prix (la page ajoute le prix, la livraison et le paiement) : ce sont les blocs photo / texte de la page. Vise QUATRE à cinq paragraphes : la page veut au moins cinq couples photo / texte (la description courte compte pour un).
- angles : EXACTEMENT cinq angles pour le test, choisis dans la banque de douze du script D'APRÈS LES PHOTOS (pas une liste fixe), chacun d'une logique de persuasion différente. Pour chacun : angle (son nom), explication, declencheurs (un à trois), primaries (DEUX textes), titres (DEUX headlines de 40 caractères au plus), descriptions (DEUX de 60 caractères au plus), meilleur = l'index (0 ou 1) du meilleur primary, du meilleur titre et de la meilleure description (on garde celui-là), audience, mots_cles (huit à quinze).
- Un primary : quatre à dix lignes courtes, émojis permis, une objection levée, le prix EXACT seul sur sa ligne UNE SEULE FOIS : « ${rep.detail} دج », puis l'action « ${action} ».
- Le reste du script, pour le coach (français ou darija) : analyse {visible, analyse_visuelle, hypotheses}, strategie_contenu, offres, positionnement_prix, idees_creas, tests {trois_premiers_angles, facebook, instagram, tiktok, premiere_crea, image_ou_video, message_froid, message_retargeting}, retargeting, notes_finales.
CONTRÔLE AUTOMATIQUE (un texte qui casse une règle est refusé) : jamais le mot COD (on écrit « الدفع عند الاستلام ») ; aucun faux avis ni témoignage (aucune citation attribuée à une personne, jamais « زبونة قالت ») ; aucun autre prix que ${rep.detail} دج, aucun prix barré, aucun prix hors des primaries ; aucun chiffre dans une ligne arabe (sauf la ligne du prix) ; aucune promesse (« مضمون », « تربح », « 100% », « الأحسن في الجزائر ») ; aucun mot marocain (« تحوّس », « الكاس », « الصوردي », « دابا », « واخا ») ; aucun mot français (prix, stock, commande, livré, vidéo…) dans une ligne arabe, et jamais « cod » même dans un mot ; un titre d'annonce de ${LONGUEUR_MAX.titre} caractères au plus et une description de ${LONGUEUR_MAX.description} au plus (sinon on garde l'autre) ; six lignes au plus par paragraphe de la page, sans ligne vide à l'intérieur.
SCRIPT D'ANGLES DU VENDEUR (JSON) :
${JSON.stringify(script)}` });
      const t = r.structure;
      const choix = choisirTextes(t, { prix: rep.detail });
      if (choix.fautes.length) {
        // le 2e essai repart avec les fautes comme consigne ; au 2e refus, la mission s'arrête et le client le sait
        m.d.consigneTextes = choix.fautes.join(' ; ').slice(0, 900);
        throw new Error('textes refusés par le contrôle : ' + choix.fautes.slice(0, 4).join(' ; ').slice(0, 400));
      }
      for (const x of choix.replis) histoire(m, `textes : ${x}`);
      let nomProduit = choix.textes.nom.slice(0, 80);
      // un modèle de lot : son nom de page n'est celui d'aucune autre mission vivante (ses frères, un lot d'avant, une mission
      // seule) — l'étape page reprendrait sinon le produit « du même nom » d'un autre modèle
      // [relecture] 10/10/2026 : une mission seule (N = 1) aussi — deux missions vivantes du même nom se seraient arrêtées à la
      // page (« change le nom ») ; et un nom ARABE n'est jamais départagé par un chiffre (aucun chiffre dans une ligne arabe) :
      // un mot de style de la recette des noms, écrit en arabe (departagerNom), dit dans l'historique
      { const pris = new Set([...missions.values()].filter(x => x.id !== m.id && x.etat !== 'arretee' && x.d.textes).map(x => x.d.textes.nom.toLowerCase()));
        if (pris.has(nomProduit.toLowerCase()) && ARABE.test(nomProduit)) { const dp = departagerNom(nomProduit, pris); histoire(m, `textes : le nom « ${nomProduit} » est déjà celui d'une autre mission — départagé sans chiffre : « ${dp} »`); nomProduit = dp; }
        else { const base = nomProduit.slice(0, 74); for (let i = m.lot ? m.lot.rang : 2; pris.has(nomProduit.toLowerCase()); i++) nomProduit = `${base} ${i}`; } }
      // LE CONTRAT AVAL (paquet, page, noms, campagne) : nom, blocs, et cinq angles {code, angle, primary, titre, description}
      m.d.textes = { nom: nomProduit, blocs: choix.textes.blocs, courte: choix.textes.courte, phraseLanding: choix.textes.phraseLanding,
        angles: choix.textes.angles.map(a => ({ code: a.code, angle: a.angle, primary: a.primary, titre: a.titre, description: a.description })) }; // longueurs déjà tenues (LONGUEUR_MAX)
      // LE RESTE DU SCRIPT → la stratégie, dans le dossier de la mission, et une note du carnet que le coach lit
      const strategie = { produit: nomProduit, modele: m.code, mission: m.id, date: maintenant().slice(0, 10), langue: 'darija algérienne (décision du vendeur, exception au script)', script: path.basename(FICHIER_SCRIPT_ANGLES),
        analyse: t.analyse || null, strategie_contenu: t.strategie_contenu || '', titre_produit: nomProduit, phrase_landing: choix.textes.phraseLanding, description_courte: choix.textes.courte, description_longue: choix.textes.longue,
        angles: (t.angles || []).map((a, i) => ({ code: `A${i + 1}`, angle: a.angle || '', explication: a.explication || '', declencheurs: a.declencheurs || [], primaries: a.primaries || [], titres: a.titres || [], descriptions: a.descriptions || [],
          garde: { primary: m.d.textes.angles[i]?.primary || '', titre: m.d.textes.angles[i]?.titre || '', description: m.d.textes.angles[i]?.description || '' }, audience: a.audience || null, mots_cles: a.mots_cles || [] })),
        offres: t.offres || [], positionnement_prix: t.positionnement_prix || '', idees_creas: t.idees_creas || [], tests: t.tests || null, retargeting: t.retargeting || [], notes_finales: t.notes_finales || [] };
      const fJson = path.join(dossier(m), 'strategie.json'), fTxt = path.join(dossier(m), 'strategie.txt'), texte = strategieEnTexte(strategie);
      fs.mkdirSync(dossier(m), { recursive: true });
      fs.writeFileSync(fJson, JSON.stringify(strategie, null, 1)); fs.writeFileSync(fTxt, texte, 'utf8');
      // le carnet refuse un texte qui RESSEMBLE à un secret ou à une coordonnée (« Le secret : … », un « @compte.dz ») :
      // une seule ligne de Claude privait le coach de toute la stratégie. On retire ces lignes-là de la note (le fichier
      // strategie.txt les garde) et on le dit.
      const lignesNote = texte.slice(0, 20000).split('\n'), gardees = lignesNote.filter(l => !refusDeContenu(l));
      if (gardees.length < lignesNote.length) histoire(m, `stratégie : ${lignesNote.length - gardees.length} ligne(s) retirée(s) de la note du carnet (secret ou coordonnée), gardées dans strategie.txt`);
      let note = null;
      try {
        const c = ouvrirCarnet(maison);
        note = ecrireNote(c, { titre: `Strategie ${nomProduit} (${m.code})`, dept: 'coach', poste: 'strategie', agent: 'page', texte: gardees.join('\n') });
        // UNE stratégie par mission : des textes REFAITS (le paquet les a refusés) ou une étape rejouée après une coupure du PC
        // laissaient l'ancienne note à côté de la nouvelle — le coach lisait des textes refusés. La note d'avant de CETTE
        // mission (même poste, son id dans l'en-tête) part ; les autres notes du carnet ne sont jamais touchées.
        for (const x of listerNotes(c)) if (x.chemin !== note && x.poste === 'strategie' && x.departement === 'coach' && new RegExp(`· mission ${m.id} ·`).test(x.apercu)) fs.rmSync(path.join(maison, x.chemin), { force: true });
      }
      catch (e) { histoire(m, `stratégie : note du carnet non écrite (${e.message})`); }
      m.d.strategie = { json: fJson, txt: fTxt, note };
      delete m.d.consigneTextes;
    },
    async paquet(m) {
      const rep = m.demande.reponses; const d = path.join(dossier(m), 'page'); fs.mkdirSync(d, { recursive: true });
      const hex = n => hexCouleur(n); // « Noir clair » / « Noir fonce » (le nommage sans fusion) : la palette éclaircie ou foncée
      const couleurs = [...new Set(m.d.photosPage.map(p => p.couleur))];
      fs.writeFileSync(path.join(d, 'photos.txt'), m.d.photosPage.map(p => `${p.couleur}|${p.cdn}`).join('\n') + '\n', 'utf8');
      // un bloc qui ressemble à une liste JSON (« ["…","…"] ») est remis en lignes AVANT le paquet (09/10/2026, constaté sur une page réelle)
      const blocsPage = m.d.textes.blocs.map(blocEnLignes);
      if (blocsPage.some((b, i) => b !== m.d.textes.blocs[i])) histoire(m, `paquet : ${blocsPage.filter((b, i) => b !== m.d.textes.blocs[i]).length} bloc(s) en liste JSON remis en lignes avant le paquet`);
      fs.writeFileSync(path.join(d, 'textes.txt'), blocsPage.join('\n\n') + '\n', 'utf8');
      // L'ORDRE DES COULEURS (le réglage ORDRE_COULEURS, « foncees » par défaut : du foncé au clair, sur le centre de chaque
      // famille) : calculé ICI et passé tel quel à l'outil, qui le respecte (rotation, jamais reclassé « la plus fournie
      // d'abord ») ; « nommees » : l'ordre du client ; « fournie » : rien n'est passé (l'ancien comportement)
      const ordreFiche = ORDRE_COULEURS === 'fournie' ? [] : ordreDesCouleurs(m.d.couleurs || [], ORDRE_COULEURS);
      const ordreCouleurs = ORDRE_COULEURS === 'fournie' ? [] : [...ordreFiche.filter(c => couleurs.includes(c)), ...couleurs.filter(c => !ordreFiche.includes(c))];
      const sortie = path.join(d, 'paquet');
      // casse-4 : un titre qui ressemble à une liste JSON (« ["Abaya Lina"] ») part en clair, et c'est dit
      const nomPaquet = nomEnClair(m.d.textes.nom);
      if (nomPaquet !== m.d.textes.nom) histoire(m, `paquet : le nom du produit était une liste JSON, remis en clair (« ${nomPaquet} »)`);
      const args = ['--produit', '--nom', nomPaquet, '--boutique', codeBoutique(), '--modele', m.code, '--prix', String(rep.detail),
        '--couleurs', couleurs.map(c => `${c}:${hex(c)}`).join(','), '--tailles', rep.tailles, '--mode', rep.sku || 'par-taille',
        '--photos', path.join(d, 'photos.txt'), '--textes', path.join(d, 'textes.txt'), '--sortie', sortie, '--json', ...(ordreCouleurs.length > 1 ? ['--ordre-couleurs', ordreCouleurs.join(',')] : [])];
      const r = await outil(m, 'paquet', '2-PAGE-PRODUIT-SKU/manita-produit.py', args, { cwd: d, dureeMaxMs: 600000, inactiviteMaxMs: 300000 });
      const paquet = lireJSON(path.join(sortie, 'paquet-create_product.json'));
      // deux couleurs dont les codes SKU se percutaient (10/10/2026, « Gris »/« Gris clair », constaté en vrai) : l'outil les
      // DÉPARTAGE (une lettre de plus), la famille est gardée, la page ne tombe pas — et c'est dit dans l'historique
      for (const x of String(r.sortie || '').matchAll(/« ([^»]+) » prend le code ([A-Z0-9]+) \(([A-Z0-9]+) est deja a « ([^»]+) »\)/g)) histoire(m, `paquet : la couleur « ${x[1]} » prend le code ${x[2]} (${x[3]} est déjà à « ${x[4]} ») — gardée, code départagé`);
      if (r.code !== 0 || !paquet) {
        if (!m.d.textesRefaits && /texte|mot interdit|angle|bloc/i.test(r.sortie)) {
          m.d.textesRefaits = true; m.d.consigneTextes = extrait(r.sortie, 400);
          m.etapes.textes = { etat: 'afaire', essais: 0 }; m.etapes.paquet = { etat: 'afaire', essais: 0 };
          histoire(m, 'paquet refusé à cause des textes : on les refait une fois'); return 'REFAIRE';
        }
        throw definitive('l\'outil de la page refuse : ' + extrait(r.sortie, 400));
      }
      if (paquet.price !== rep.detail) throw definitive(`le prix du paquet (${paquet.price}) n'est pas celui du client (${rep.detail})`);
      // casse-4 : L'ORDRE DONNÉ EST RESPECTÉ PAR L'OUTIL (2e méthode) : la suite des couleurs du paquet (image puis galerie) est
      // relue face à la même rotation calculée ici ; un outil qui reclasse quand même (« la plus fournie d'abord ») est refusé
      if (ordreCouleurs.length > 1) {
        const files = []; for (const p of m.d.photosPage) { const f = files.find(x => x.nom === p.couleur); if (f) f.liste.push(p.cdn); else files.push({ nom: p.couleur, liste: [p.cdn] }); }
        const attendu = rotationCouleurs(files, ordreCouleurs, PHOTOS_PAGE_MAXI_PAQUET).map(x => x.couleur);
        const couleurDe = new Map(m.d.photosPage.map(p => [p.cdn, p.couleur]));
        const lu = [paquet.image, ...(Array.isArray(paquet.gallery) ? paquet.gallery : [])].filter(Boolean).map(u => couleurDe.get(u) ?? '?');
        if (lu.join('|') !== attendu.slice(0, lu.length).join('|') || lu.length < Math.min(attendu.length, 6)) throw definitive(`l'outil de la page n'a pas respecté l'ordre des couleurs donné (${ordreCouleurs.join(', ')}) : ${lu.join(', ').slice(0, 160)} au lieu de ${attendu.join(', ').slice(0, 160)}`);
      }
      // CINQ COUPLES PHOTO/TEXTE au moins (PHOTOS_DESCRIPTION de l'outil) : impossible (pas assez de blocs ou de photos) → DIT
      const jd = (r.json || []).find(j => j && j.quoi === 'description');
      if (jd) { m.d.descriptionCouples = { couples: jd.couples, minimum: jd.minimum, photos: jd.photos }; if (jd.dit) histoire(m, `paquet : ${jd.dit}`); }
      m.d.paquet = path.join(sortie, 'paquet-create_product.json');
    },
    async page(m) {
      const paquet = lireJSON(m.d.paquet);
      const magasin = R().magasin || null;
      const r = await tourClaude(m, 'page', { dept: 'page', outils: ['tassyir.list_stores', 'tassyir.get_store', 'tassyir.list_products', 'tassyir.get_product', 'tassyir.create_product', 'tassyir.update_product', 'tassyir.render_preview'],
        schema: { type: 'object', properties: { storeId: { type: 'string' }, productId: { type: 'string' }, slug: { type: 'string' }, sousDomaine: { type: 'string' }, urlProduit: { type: 'string' }, previewUrl: { type: 'string' }, cache: { type: 'boolean' }, existaitDeja: { type: 'boolean' }, apercuFidele: { type: 'boolean' }, note: { type: 'string' }, erreur: { type: 'string' } }, required: ['storeId', 'productId', 'cache'] },
        message: `Crée la page produit CACHÉE sur Tassyir, à partir du paquet exact ci-dessous (fabriqué par l'outil de la maison : n'en change aucun champ, sauf storeId).
1. list_stores${magasin ? ` : prends la boutique « ${magasin.nom || ''} » (id ${magasin.id})` : ' : prends la seule boutique ACTIVE ; s\'il y en a plusieurs, ARRÊTE et mets dans « erreur » la liste des noms'}.
2. list_products (recherche par le nom exact « ${paquet.name} ») : si ce produit existe DÉJÀ dans cette boutique, ne crée RIEN, reprends son id (existaitDeja = true).
3. Sinon create_product avec le paquet, storeId remplacé.
4. update_product sur ce produit : isActive false, isVisible false (il reste caché jusqu'à l'étape publication, qui suit tout de suite). Si un update_product porte des variantes : CHACUNE avec son id, son price et ses selectedOptions tels que get_product les rend (l'id seul : Tassyir refuse, erreur -32602).
4 bis. update_product { productId, description } : la DESCRIPTION SEULE, dans son PROPRE envoi (rien d'autre dans cette charge : ni nom, ni isActive, ni variantes), la chaîne "description" du paquet décodée une fois, caractère par caractère, balises <img> brutes. La relecture de l'étape 5 vient APRÈS cet envoi (obligatoire : sans elle la page ne sort pas).
5. get_store : le sous-domaine ; get_product : le slug (et ses variantes avec leur sku : un produit repris doit porter les sku du paquet) ET la DESCRIPTION stockée (champ description, rendue telle quelle) : elle doit être celle du paquet caractère par caractère, balises <img> brutes (jamais &lt;img), aucun bloc entre crochets.
6. render_preview { storeId, productId } (source draft) : garde le previewUrl. ATTENTION : le produit est CACHÉ, et le rendu peut montrer une page de démonstration au lieu de CE produit. Ce n'est PAS une erreur : ne mets JAMAIS rien dans « erreur » à cause de l'aperçu. Mets apercuFidele = true seulement si les captures montrent le nom ou les photos de CE produit, sinon false, et explique dans « note ». « erreur » sert seulement si la création ou la mise en cache a échoué.
Rends {storeId, productId, slug, sousDomaine, urlProduit: "https://<sous-domaine>.tassyir.io/product/<slug>" seulement si tu as LU les deux, previewUrl, cache: true seulement si l'update a réussi}.
PAQUET :
${JSON.stringify(paquet)}` });
      const s = r.structure;
      // 2e méthode : l'id du produit doit apparaître dans une réponse BRUTE de Tassyir, et la mise en cache doit avoir été appelée
      const vu = contient(r, 'create_product', s.productId) || contient(r, 'list_products', s.productId) || contient(r, 'get_product', s.productId);
      if (!vu) throw new Error('l\'id du produit annoncé n\'apparaît dans aucune réponse de Tassyir');
      // jamais deux modèles sur la même page : un produit « du même nom » déjà pris par une autre mission vivante n'est pas repris
      const autre = [...missions.values()].find(x => x.id !== m.id && x.etat !== 'arretee' && String(x.d.produit?.productId || '') === String(s.productId));
      if (autre) throw definitive(`ce produit Tassyir est deja la page de la mission ${autre.id} (${autre.code}) : deux modeles ne partagent jamais une page, change le nom`);
      // LA PAGE EST PUBLIÉE SANS « نشرها » (règle du vendeur, 06/10/2026) : le regard du client ne rattrape plus un produit
      // « du même nom » qui n'est PAS celui de la chaîne (un vieux produit du client, caché exprès). Un produit repris doit
      // porter au moins un SKU du paquet (celui que la chaîne a créé avant une coupure le porte) ; sinon on ne le reprend
      // pas, et surtout on ne le publie pas.
      const skus = (paquet.variants || []).map(v => String(v.sku || '')).filter(Boolean);
      if (s.existaitDeja && skus.length && !skus.some(k => contient(r, 'get_product', k) || contient(r, 'list_products', k))) throw definitive(`un autre produit porte deja ce nom dans la boutique : renomme-le dans Tassyir puis reprends (rien publie)`); // le client lit 108 caracteres
      const cache = appelsDe(r, 'update_product').some(a => JSON.stringify(a.entree || {}).includes(s.productId) && /"isActive"\s*:\s*false/.test(JSON.stringify(a.entree || {})));
      if (!s.existaitDeja && !cache) throw new Error('le produit a été créé mais la mise en cache (isActive false) n\'est pas dans les appels');
      // [variantes-completes] une variante renvoyée ici aussi : id + price + selectedOptions lus, sinon refusé et dit (l'étape est refaite)
      const fvPage = fautesVariantesEnvoyees(r.appels, s.productId);
      if (fvPage.fautes.length) throw new Error(`${VARIANTES_INCOMPLETES} (étape page) : ${fvPage.fautes.slice(0, 3).join(' ; ')}`.slice(0, 400));
      // LA DESCRIPTION RÉELLEMENT STOCKÉE, RELUE (09/10/2026 — constaté sur une page réelle : &lt;img échappées, 1er bloc en liste JSON) ;
      // [desc-bilan] 10/10/2026 (3e page abîmée constatée en vrai, la relecture ne s'était pas faite) : la description part
      // dans SON PROPRE envoi (update_product avec la seule description), puis la relecture BRUTE de CE qui est stocké, faite
      // APRÈS cet envoi, est OBLIGATOIRE (sans elle l'étape échoue, jamais « passée par défaut »). Envoi absent, pas seul,
      // non relu ou stocké abîmé → UN seul nouvel envoi de la description seule, relu ; encore raté → arrêt définitif dit
      // au client, la page reste cachée (la publication n'arrive qu'après cette étape)
      const aDescription = typeof paquet.description === 'string' && paquet.description.trim() !== '';
      const ev = aDescription ? envoiDescriptionSeule(r.appels, paquet.description, s.productId) : { ok: true, fautes: [] };
      // [liste-variantes] les variantes de CE produit telles que la relecture BRUTE get_product les rend (lue entière par le moteur,
      // même mise en fichier) : la publication en construit la liste à envoyer
      let appelsLus = r.appels;
      if (!aDescription) histoire(m, 'page : le paquet ne porte aucune description — rien à envoyer ni à relire');
      else if (ev.ok) histoire(m, 'page : description envoyée seule puis relue brute (balises brutes, toutes les images du paquet, aucun bloc JSON)');
      else {
        const fd = ev.fautes, fn = fd.find(x => /^nom du produit stocké/.test(x));
        histoire(m, `page : description ${ev.nonRelue ? 'non relue' : 'envoyée ou stockée de travers'} (${fd.join(' ; ')}) — UN nouvel envoi de la description seule, relu`);
        const r2 = await tourClaude(m, 'page-description', { dept: 'page', outils: ['tassyir.get_product', 'tassyir.update_product'],
          schema: { type: 'object', properties: { productId: { type: 'string' }, erreur: { type: 'string' } }, required: ['productId'] },
          message: `La DESCRIPTION du produit ${s.productId} (boutique ${s.storeId}) n'est pas prouvée juste chez Tassyir : ${fd.join(' ; ')}.
1. update_product { productId: "${s.productId}", description } et RIEN D'AUTRE dans cet envoi (la description SEULE, dans son propre update_product) : la description part CARACTÈRE PAR CARACTÈRE, balises brutes, AUCUN échappement (jamais &lt; ni &amp;), aucun bloc entre crochets ni guillemets. C'est la chaîne JSON ci-dessous, décodée UNE fois (ses \\n sont des retours à la ligne) :
${JSON.stringify(paquet.description || '')}
Ne touche à RIEN d'autre (ni isActive, ni isVisible, ni les variantes : le produit reste caché).${fn ? `
Le NOM stocké est abîmé aussi : dans un AUTRE update_product, à part, { productId: "${s.productId}", name: ${JSON.stringify(paquet.name || '')} } tel quel.` : ''}
2. get_product APRÈS cet envoi : relis la description stockée, rendue telle quelle (la relecture est obligatoire : sans elle la page ne sort pas).
Rends {productId}.` });
        // casse-4 : la reprise ne publie rien et ne vise que CE produit (2e méthode : les appels bruts) ; [desc-bilan] chaque
        // envoi y est SEUL : la description seule, ou le nom seul
        const horsReprise = appelsDe(r2, 'update_product').map(a => entreeDe(a)).find(e => String(e.productId ?? e.id ?? '') !== String(s.productId) || e.isActive === true || e.isVisible === true || /^true$/i.test(String(e.isActive ?? '')) || /^true$/i.test(String(e.isVisible ?? '')) || e.variants !== undefined);
        if (horsReprise) throw definitive(`la reprise de la description a touché autre chose (${JSON.stringify(horsReprise).slice(0, 120)}) : verifie le produit dans Tassyir, rien publie`);
        const ev2 = envoiDescriptionSeule(r2.appels, paquet.description, s.productId);
        appelsLus = [...(r.appels || []), ...(r2.appels || [])];
        if (!ev2.ok) throw Object.assign(definitive(`description de la page abimee meme apres la reprise, page cachee, rien publie : ${ev2.fautes.join(' ; ')}`), { client: ev2.nonRelue ? M.descriptionNonRelue(m.id) : M.descriptionAbimee(m.id) });
        histoire(m, 'page : description relue juste après la reprise (envoyée seule, balises brutes, images du paquet, aucun bloc JSON)');
      }
      const apercus = [];
      // un aperçu qui montre une page de démonstration (produit caché) n'est jamais montré au client
      if (s.apercuFidele === true) for (const a of appelsDe(r, 'render_preview')) for (const [i, im] of (a.images || []).entries()) { const f = path.join(dossier(m), 'page', `apercu-${i + 1}.${(im.media_type || 'image/png').split('/')[1].replace('jpeg', 'jpg')}`); fs.writeFileSync(f, Buffer.from(im.data, 'base64')); apercus.push(f); }
      if (s.apercuFidele !== true) histoire(m, `page : aperçu de Tassyir non fidèle, pas montré${s.note ? ` (${String(s.note).slice(0, 160)})` : ''}`);
      m.d.variantesPage = listeLue(variantesLues(appelsLus, s.productId));
      m.d.produit = { storeId: s.storeId, productId: s.productId, slug: s.slug || '', urlProduit: /^https:\/\/[a-z0-9-]+\.tassyir\.io\/product\//.test(s.urlProduit || '') ? s.urlProduit : '', previewUrl: s.previewUrl || '', apercus, apercuFidele: s.apercuFidele === true, existaitDeja: !!s.existaitDeja };
    },
    async 'page-ok'(m) {
      // règle du vendeur (06/10/2026) : la page est publiée dès qu'elle est prête, sans attendre « نشرها ».
      // On montre quand même au client ses photos (l'aperçu FIDÈLE de Tassyir, sinon les vraies photos de la page).
      const st = m.etapes['page-ok'];
      // st.demande : une mission d'avant (v0.3.7) attendait « نشرها » — son aperçu et le lien sont déjà partis, on ne les
      // renvoie pas ; elle passe à la publication comme les autres (le lien publié suit)
      if (!st.photosEnvoyees && !st.demande) {
        const tg = telegram(); const p = m.d.produit;
        const vues = (p.apercus || []).length ? p.apercus.slice(0, 4) : (m.d.photosPage || []).map(x => x.fichier).filter(f => f && fs.existsSync(f)).slice(0, 4);
        if (tg && vues.length) { try { await tg.envoyerAlbum(vues, legende(m)); } catch (e) { histoire(m, 'photos de la page non envoyées : ' + e.message); } }
        st.photosEnvoyees = maintenant();
      }
      st.reponse = 'oui';
      return undefined;
    },
    async publication(m) {
      const p = m.d.produit;
      const schemaPub = { type: 'object', properties: { productId: { type: 'string' }, actif: { type: 'boolean' }, variantesVisibles: { type: 'integer' }, urlProduit: { type: 'string' }, erreur: { type: 'string' } }, required: ['productId', 'actif'] };
      // [liste-variantes] 10/10/2026 : le paquet porte des variantes → le BUREAU construit la liste complète à envoyer (id + price +
      // selectedOptions lus chez Tassyir, recoupés avec le paquet) ; le tour l'envoie TELLE QUELLE (dans le tour, Claude ne voit
      // qu'un pointeur quand get_product est mis en fichier : il ne peut rien recopier)
      const paquetV = m.d.paquet && fs.existsSync(m.d.paquet) ? lireJSON(m.d.paquet) : null;
      if (paquetV && Array.isArray(paquetV.variants) && paquetV.variants.length) return publierAvecListe(m, p, paquetV, schemaPub);
      let r = await tourClaude(m, 'publication', { dept: 'page', outils: ['tassyir.get_product', 'tassyir.update_product', 'tassyir.get_store'],
        schema: schemaPub,
        message: `La page est prête : publie le produit ${p.productId} (boutique ${p.storeId}) — règle du vendeur, une page prête est publiée tout de suite.
1. get_product : lis les variantes (leurs id, leur price et leurs selectedOptions).
2. update_product : isActive true, isVisible true, et CHAQUE variante isHidden false (en gardant son id).
2 bis. VARIANTES COMPLÈTES (Tassyir refuse sinon, erreur -32602) : chaque variante envoyée porte son id, son price et ses selectedOptions EXACTEMENT tels que get_product les a rendus (même prix, mêmes name/value), plus isHidden false. Jamais une variante avec son id seul ; ne change JAMAIS un prix à la publication.
3. get_product à nouveau : relis que c'est bien actif. get_store si tu n'as pas le sous-domaine.
Ne renvoie JAMAIS la description dans cet update_product (elle est déjà envoyée seule et relue : la renvoyer avec isActive peut l'abîmer).
Rends {productId, actif (relu), variantesVisibles (nombre relu), urlProduit "https://<sous-domaine>.tassyir.io/product/<slug>"}.` });
      // [variantes-completes] 10/10/2026 : les variantes envoyées sont relues dans les appels BRUTS (id + price + selectedOptions
      // identiques à get_product) ; un refus -32602 de Tassyir est reconnu et DIT ; une faute → UN seul nouveau tour avec la
      // consigne explicite (les variantes lues recopiées), encore fausse → arrêt définitif dit, rien d'annoncé
      let fv = fautesVariantesEnvoyees(r.appels, p.productId);
      if (fv.refusCorrige && !fv.fautes.length) histoire(m, `publication : Tassyir avait refusé un envoi de variantes (-32602, ${VARIANTES_INCOMPLETES}), corrigé dans le même tour`);
      if (fv.fautes.length) {
        histoire(m, `publication : ${fv.fautes.slice(0, 4).join(' ; ')} — UN nouveau tour, chaque variante avec id + price + selectedOptions lus`);
        const avant = variantesLues(r.appels, p.productId, true);
        const lues = [...avant].map(([id, v]) => ({ id, price: v.price, selectedOptions: v.selectedOptions, isHidden: false }));
        r = await tourClaude(m, 'publication-variantes', { dept: 'page', outils: ['tassyir.get_product', 'tassyir.update_product', 'tassyir.get_store'],
          schema: schemaPub,
          message: `La publication du produit ${p.productId} (boutique ${p.storeId}) n'est pas prouvée : ${fv.fautes.slice(0, 4).join(' ; ')}.
Tassyir REFUSE (erreur -32602) un update_product dont une variante n'a que son id : il exige pour CHAQUE variante envoyée son price et ses selectedOptions, tels que get_product les rend.
1. get_product { productId: "${p.productId}" } : relis les variantes (id, price, selectedOptions).
2. update_product { productId: "${p.productId}", isActive: true, isVisible: true, variants } : CHAQUE variante = { id, price, selectedOptions, isHidden: false }, id, price et selectedOptions recopiés TELS QUELS depuis la réponse de get_product (ne change JAMAIS un prix). Rien d'autre (jamais la description).${lues.length ? `
Les variantes lues au tour précédent (à recouper avec ta nouvelle lecture) :
${JSON.stringify(lues).slice(0, 20000)}` : ''}
3. get_product à nouveau : relis que c'est bien actif. get_store si tu n'as pas le sous-domaine.
Rends {productId, actif (relu), variantesVisibles (nombre relu), urlProduit "https://<sous-domaine>.tassyir.io/product/<slug>"}.` });
        fv = fautesVariantesEnvoyees(r.appels, p.productId, avant);
        if (fv.fautes.length) throw definitive(`${VARIANTES_INCOMPLETES} — publication refusée par le bureau après un nouveau tour : ${fv.fautes.slice(0, 4).join(' ; ')}`.slice(0, 600));
        histoire(m, 'publication : variantes renvoyées complètes (id + price + selectedOptions lus) au nouveau tour');
      }
      return finirPublication(m, p, r);
    },
    async porte(m) {
      const st = m.etapes.porte;
      if (st.reponse === 'go') return undefined;
      const rep = m.demande.reponses, c = R().couts || {}, dcl = R().declare || {};
      for (const [k, v] of [['emballage', c.emballage], ['livraison', c.livraison], ['retour', c.retour], ['confirmation', dcl.confirmation], ['livraison déclarée', dcl.livraison]]) if (v === null || v === undefined || v === '') throw definitive(`réglage manquant : ${k} (onglet الإعدادات)`);
      const args = ['--break-even', '--prix', rep.detail, '--cout-produit', rep.gros, '--emballage', c.emballage, '--livraison', c.livraison, '--frais-cod', c.fraisCod || 0, '--cout-retour', c.retour, '--taux-confirmation', (+dcl.confirmation / 100).toFixed(4), '--taux-livraison', (+dcl.livraison / 100).toFixed(4)];
      const r = await outil(m, 'break-even', '3-TESTING/manita-testing.py', args, { dureeMaxMs: 120000 });
      const be = jsonOutil(r, 'break_even');
      if (!be) throw definitive('l\'outil du testing ne rend pas le break even : ' + extrait(r.sortie));
      m.d.be = be;
      await outilCarnet(m, 'carnet-fiche', ['--fiche', '--produit', m.code, '--prix', rep.detail, '--gros', rep.gros, '--emballage', c.emballage, '--livraison-a-ta-charge', (+c.livraison || 0) + (+c.fraisCod || 0), '--retour', c.retour, '--conf-declaree', (+dcl.confirmation / 100).toFixed(2), '--liv-declaree', (+dcl.livraison / 100).toFixed(2)]);
      if (be.passe) { await envoyer(m, M.porteOk(be, +R().taux || 0)); return undefined; }
      if (!st.demande) { await envoyer(m, M.porteFermee(m.id, be, be.minimums || {}, +R().taux || 0)); st.demande = maintenant(); }
      return ATTENTE;
    },
    async budget(m) {
      const taux = +R().taux || 0; const plafondJour = +R().plafondJourDA || 0;
      if (!(taux > 0)) throw definitive('le taux du dollar manque (الإعدادات)');
      if (!(plafondJour > 0)) throw definitive('le budget maximum par jour manque (الإعدادات)');
      // le plafond du jour est GLOBAL : un modèle d'un lot de N teste avec plafond / N (arrondi en dessous)
      const parts = Math.max(1, +(m.lot?.total || 1));
      const plafondDa = parts > 1 ? Math.floor(plafondJour / parts) : plafondJour;
      const compte = m.demande.reponses.compte || {};
      const devise = String(compte.devise || 'USD').toUpperCase();
      // LES CRÉAS DU CLIENT (08/10/2026) : de un à quatre, sa réponse au robot (une fois par lien), sinon le réglage (défaut quatre)
      const k = creasDe(m.demande.reponses.creas, R().creasParModele);
      const saines = m.d.creas.length, voulu = Math.min(k, saines);
      // l'outil convertit un plafond en DZD au cours fixe de 255 : sous ce cours, choisir au taux du client lui ferait refuser le budget
      // 0.4.2 : la STRUCTURE du fichier (budget du client, vidéos, lead max de la porte) — ABO, CBO, ou moins de vidéos
      const leadMaxUsd = +(m.d.be && m.d.be.par_commande) > 0 ? (+m.d.be.par_commande) / taux : 0;
      const choix = structureDuTest(voulu, plafondDa / Math.max(taux, 255), leadMaxUsd, k);
      // le client l'apprend en clair (dinars ET dollars) ; l'échec qui suit porte les boutons « عاود » / « حبس »
      if (!choix.n) await envoyer(m, M.budgetCourt(parts, plafondDa, Math.max(taux, 255)));
      if (!choix.n) throw definitive(parts > 1 ? `le budget du jour (${plafondJour} DA) partagé entre ${parts} modèles laisse ${plafondDa} DA par modèle : pas assez pour une vidéo à ${PLANCHER_CBO_USD} $ (rien n'est créé)` : `le budget maximum (${plafondDa} DA) ne paie même pas une vidéo à ${PLANCHER_CBO_USD} $`);
      if (parts > 1) histoire(m, `budget : ${plafondJour} DA par jour partagés entre ${parts} modèles → ${plafondDa} DA pour celui-ci`);
      // moins que le choix : on part avec ce qu'il y a, et le client le sait — UNE fois, même si l'étape est rejouée
      if (saines < k && !m.d.creasMoinsDit) { await envoyer(m, M.creasMoins(k, saines)); m.d.creasMoinsDit = maintenant(); }
      if (choix.n < voulu && !m.d.creasPlafondDit) { await envoyer(m, M.creasPlafond(k, choix.n)); m.d.creasPlafondDit = maintenant(); }
      histoire(m, `budget : ${k} créa(s) choisie(s), ${saines} vidéo(s) saine(s), ${choix.n} au test · structure ${choix.structure} (${choix.budgetUsd.toFixed(2)} $ par jour, ${choix.partUsd.toFixed(2)} $ par vidéo${choix.jugeMinUsd ? `, ${choix.jugeMinUsd.toFixed(2)} $ pour juger une vidéo seule` : ''})`);
      const args = ['--budget', '--videos', choix.n, '--devise', devise, '--plafond', plafondDa, '--plafond-devise', 'DZD', '--taux-dinar', taux, '--structure', choix.structure, '--budget-jour-usd', choix.budgetUsd.toFixed(2)];
      const r = await outil(m, 'budget', '3-TESTING/manita-testing.py', args, { dureeMaxMs: 120000 });
      const b = jsonOutil(r, 'budget');
      if (!b) throw definitive('l\'outil refuse le budget : ' + extrait(r.sortie));
      m.d.budget = b; m.d.creasChoix = k; m.d.videosTest = choisirVideosTest(m.d.creas, choix.n);
    },
    async videos(m) {
      if (await testAuPlusQuatre(m)) return 'REFAIRE';
      const vids = m.d.videosTest;
      // un test REFAIT (testAuPlusQuatre) : les vidéos déjà dans la bibliothèque Meta du compte sont reprises, sans nouvel envoi
      const deja = m.d.metaDejaEnvoyees || [], repris = vids.map(v => deja.find(x => x.fichier === v.fichier && x.video_id));
      if (vids.length && repris.every(Boolean)) {
        m.d.metaVideos = repris.map((x, i) => ({ index: i, video_id: x.video_id, statut: 'ready', duree: x.duree ?? null }));
        m.d.metaVignettes = repris.map((x, i) => ({ index: i, image_hash: x.image_hash || null, url: x.url || null }));
        histoire(m, `videos : ${vids.length} vidéo(s) déjà chez Meta reprises (${m.d.metaVideos.map(v => v.video_id).join(', ')}), aucun envoi`);
        return undefined;
      } const d = path.join(dossier(m), 'meta'); fs.mkdirSync(d, { recursive: true });
      const vignettes = [];
      for (const [i, v] of vids.entries()) { const f = path.join(d, `vignette-${String(i + 1).padStart(2, '0')}.jpg`); if (!fs.existsSync(f)) await executer(ffmpeg(), ['-y', '-v', 'error', '-ss', '0.15', '-i', v.fichier, '-frames:v', '1', '-q:v', '2', f], { timeout: 120000 }); vignettes.push(f); }
      if (vignettes.some(f => !fs.existsSync(f))) throw new Error('vignette impossible à tirer (ffmpeg)');
      const compte = String(m.demande.reponses.compte?.id || '').replace(/^act_/, '');
      if (!compte) throw definitive('compte publicitaire inconnu');
      const pub = await depot.publier([...vids.map(v => v.fichier), ...vignettes], { etiquette: `${m.id}-videos` });
      try {
        const n = vids.length;
        const r = await tourClaude(m, 'videos', { dept: 'testing', outils: ['meta.ads_creative_upload_media', 'meta.ads_get_ad_videos', 'meta.ads_get_ad_images'],
          schema: { type: 'object', properties: { videos: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, video_id: { type: 'string' }, statut: { type: 'string' }, duree: { type: 'number' } }, required: ['index', 'video_id', 'statut'] } },
            vignettes: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, image_hash: { type: 'string' }, url: { type: 'string' } }, required: ['index'] } }, erreur: { type: 'string' } }, required: ['videos', 'vignettes'] },
          message: `Envoie ces ${n} vidéos et leurs ${n} vignettes dans la bibliothèque du compte publicitaire ${compte}.
- Vidéos : ads_creative_upload_media { ad_account_id: "${compte}", upload_source: "URL", media_type: "VIDEO", media_url, name } :
${pub.urls.slice(0, n).map((u, i) => `  index ${i} · name "${m.code}-V${String(i + 1).padStart(2, '0')}" · ${u}`).join('\n')}
- Vignettes : même outil, media_type "IMAGE" :
${pub.urls.slice(n).map((u, i) => `  index ${i} · name "${m.code}-V${String(i + 1).padStart(2, '0')}-vignette" · ${u}`).join('\n')}
- Puis ads_get_ad_videos sur les video_id jusqu'à ce que chacune soit « ready » (au plus huit lectures en tout) ; note leur durée.
Durées attendues (s) : ${vids.map(v => v.duree).join(', ')}.
Rends {videos:[{index, video_id, statut, duree}], vignettes:[{index, image_hash, url}]}.` });
        const s = r.structure;
        if ((s.videos || []).length !== n) throw new Error(`${(s.videos || []).length} vidéo(s) rendue(s) au lieu de ${n}`);
        for (const v of s.videos) {
          if (!contient(r, 'ads_creative_upload_media', v.video_id) && !contient(r, 'ads_get_ad_videos', v.video_id)) throw new Error(`video_id ${v.video_id} absent des réponses brutes de Meta`);
          if (String(v.statut).toLowerCase() !== 'ready') throw new Error(`la vidéo ${v.index + 1} n'est pas prête chez Meta (${v.statut})`);
          const attendu = vids[v.index]?.duree || 0;
          if (v.duree && attendu && Math.abs(v.duree - attendu) > 1.5) throw new Error(`durée chez Meta ${v.duree} s au lieu de ${attendu} s (vidéo ${v.index + 1})`);
        }
        m.d.metaVideos = s.videos.sort((a, b) => a.index - b.index);
        m.d.metaVignettes = (s.vignettes || []).sort((a, b) => a.index - b.index);
      } finally { await pub.fermer(); }
    },
    async noms(m) {
      if (await testAuPlusQuatre(m)) return 'REFAIRE';
      const rep = m.demande.reponses;
      const args = ['--noms', '--mode', rep.mode, '--boutique', codeBoutique(), '--modele', m.code, '--prix', rep.detail, '--date', (m.d.dateTest || maintenant().slice(0, 10)),
        '--videos-ids', m.d.metaVideos.map(v => v.video_id).join(','), '--devise', m.d.budget.devise, ...(rep.mode === 'site' ? ['--lien', urlPourMeta(m.d.produit.urlProduit)] : []),
        // 0.4.2 : la structure du budget voyage avec les noms (le nom de la campagne annonce le vrai total du jour)
        ...(m.d.budget.structure && m.d.budget.total_usd ? ['--structure', m.d.budget.structure, '--budget-jour-usd', (+m.d.budget.total_usd).toFixed(2)] : [])];
      // [pack-23oct] LE NOM DU MODÈLE LISIBLE DANS LE TRACKING : utm_campaign = <nom>-<CLÉ> (la vue UTM de Tassyir n'a pas de
      // niveau medium). Le nom donné par le client d'abord, puis celui du lot, puis celui des textes — le premier qui a une
      // lettre latine ; aucun → l'outil prend le code du modèle. La clé reste la clé (campagne Meta, anti-doublon).
      const nomModele = nomPourTracking(m);
      if (nomModele) args.push('--nom-modele', nomModele);
      if (rep.mode === 'site' && !m.d.produit.urlProduit) throw definitive('le lien de la page manque pour les liens marqués');
      const r = await outil(m, 'noms', '3-TESTING/manita-testing.py', args, { dureeMaxMs: 120000 });
      const n = jsonOutil(r, 'noms');
      if (!n || !n.cle) throw definitive('l\'outil ne rend pas la clé du test : ' + extrait(r.sortie));
      m.d.noms = n;
    },
    async campagne(m) {
      if (await testAuPlusQuatre(m)) return 'REFAIRE';
      // [v19-trois] LE PIXEL CHOISI PAR LE CLIENT (mode site), relu en vrai AVANT toute création : absent du compte → REFUS, la
      // question reposée avec les pixels du compte, rien n'est créé chez Meta (jamais un repli silencieux)
      if (await verifierPixelChoisi(m) === ATTENTE) return ATTENTE;
      const rep = m.demande.reponses, n = m.d.noms, b = m.d.budget;
      // un test d'AVANT refait (plus de quatre vidéos) : sa campagne reste telle quelle, en pause — jamais reprise ici
      const avant = (m.d.testsAvant || []).filter(t => t.cle || t.campagne);
      // les 25 wilayas du vendeur, confirmées par le client : sans elles, RIEN ne part chez Meta (jamais tout le pays)
      const cib = ciblageWilayas(R().ciblage);
      if (cib.faute) throw Object.assign(definitive(`ciblage : ${cib.faute} — rien n'est créé chez Meta`), { client: M.wilayasManquent(m.id) });
      const angles = m.d.textes.angles;
      const annonces = m.d.metaVideos.map((v, i) => ({ adSet: b.un_seul_ad_set ? n.ad_sets[0] : n.ad_sets[i], video_id: v.video_id, vignette: m.d.metaVignettes[i]?.image_hash || m.d.metaVignettes[i]?.url || null, angle: angles[i % 5], lien: rep.mode === 'site' ? (n.liens || [])[i % 5] : null }));
      const ciblage = cib.targeting;
      const placements = rep.placements === 'broad' ? 'automatiques (Advantage+ placements)' : 'publisher_platforms ["facebook","instagram"], instagram_positions ["story","reels"], facebook_positions ["story","facebook_reels"]';
      // PAR ID, JAMAIS PAR NOM (09/10/2026) : l'id de la campagne déjà dans la mission (une campagne repassée par cette étape,
      // ou créée par un essai d'avant coupé — noté dans campagneVue avec sa clé) ; deux campagnes de même clé ou de même nom :
      // l'étape vise celle-là, sinon elle refuse (jamais la plus récente, jamais par le nom)
      const idConnu = (m.d.campagne && m.d.campagne.id) ? String(m.d.campagne.id) : (m.d.campagneVue && m.d.campagneVue.cle === n.cle ? String(m.d.campagneVue.id) : null);
      const noterVue = appels => { const id = appelsDe({ appels }, 'ads_create_campaign').flatMap(a => jsonsDans(a.sortie)).map(j => j && (j.id ?? j.campaign_id)).find(x => x !== undefined && x !== null && x !== ''); if (id !== undefined && !idConnu) { m.d.campagneVue = { cle: n.cle, id: String(id), le: maintenant() }; sauver(m); } };
      const r = await tourClaude(m, 'campagne', { dept: 'testing', outils: ['meta.ads_get_ad_accounts', 'meta.ads_get_ad_entities', 'meta.ads_get_ad_account_pages', 'meta.ads_get_ig_accounts', 'meta.ads_get_datasets', 'meta.ads_get_field_context', 'meta.ads_get_help_article', 'meta.ads_get_errors', 'meta.ads_create_campaign', 'meta.ads_create_ad_set', 'meta.ads_create_creative', 'meta.ads_create_ad'],
        schema: { type: 'object', properties: { campaign_id: { type: 'string' }, ad_sets: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' } }, required: ['id'] } }, ad_sets_en_trop: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' } }, required: ['id'] } }, ads: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, ad_set_id: { type: 'string' }, angle: { type: 'string' } }, required: ['id', 'ad_set_id'] } }, existaitDeja: { type: 'boolean' }, pixel_id: { type: 'string' }, page_id: { type: 'string' }, note: { type: 'string' }, erreur: { type: 'string' } }, required: ['campaign_id', 'ad_sets', 'ads'] },
        message: `${avant.length ? `ATTENTION : un test d'AVANT de ce modèle (plus de quatre vidéos, clé${avant.length > 1 ? 's' : ''} ${avant.map(t => `« ${t.cle || '?'} »${t.campagne ? ` campagne ${t.campagne}` : ''}`).join(', ')}) a été REFAIT. Ne reprends PAS cette ancienne clé ni sa campagne, ne la touche pas, ne la supprime pas, ne l'active pas : elle reste en pause. Ce test a sa clé neuve « ${n.cle} ».
` : ''}AD SETS EN TROP : si la campagne reprise (clé « ${n.cle} ») porte PLUS d'ad sets que ce test, ne rends dans ad_sets QUE ceux de ce test (les noms ci-dessous) et liste les autres dans ad_sets_en_trop (id, nom) ; ne les touche pas (ni suppression, ni modification, ni activation) : ils restent en pause.
Monte le TEST de ce modèle chez Meta, TOUT EN PAUSE (étape 7 de ta skill, champs exacts). Rien n'est activé ici.
Compte : ${String(rep.compte?.id || '').replace(/^act_/, '')} (devise ${b.devise}) · Page Facebook : ${rep.page?.id || '?'} (${rep.page?.nom || ''}) · Mode : ${rep.mode} · Placements : ${placements}
1. ads_get_ad_entities : cherche la clé « ${n.cle} » dans les campagnes du compte, publiées ET en brouillon (object_state « live » puis « draft » : un compte en mode brouillon garde là ce qu'un essai coupé a créé). Si une campagne la porte, ne crée PAS de deuxième campagne : reprends-la (existaitDeja = true) et LIS-la dans Meta : la campagne (id, name, spend_cap), ses ad sets (id, name, daily_budget, daily_spend_cap, lifetime_spend_cap, targeting) et ses annonces (id, adset_id). Si elle est complète (tous les ad sets et toutes les annonces), rends ses id. Si elle est incomplète (un essai précédent s'est arrêté en route), COMPLÈTE-la : crée seulement ce qui manque, dans cette campagne (campaign_id = son id). Ne touche pas aux autres campagnes qui portent la clé : dis-le dans « note ». PAR ID, JAMAIS PAR NOM : si PLUSIEURS campagnes portent la clé « ${n.cle} » ou le nom « ${n.campagne} », ${idConnu ? `reprends SEULEMENT celle dont l'id est ${idConnu} (l'id de cette mission)` : `n'en choisis AUCUNE (ni la plus récente, ni par le nom), ne crée rien et mets leurs id dans « erreur »`}. Si la campagne ou un de ses ad sets porte un plafond de dépense (posé par une ancienne version), ou un ad set un autre ciblage que les wilayas ci-dessous, ne le change pas : dis-le dans « note ».
2. ${rep.mode === 'site' && m.d.pixel && m.d.pixel.id ? `LE PIXEL est CHOISI par le client et RELU par le bureau dans Meta : pixel_id ${m.d.pixel.id} (« ${String(m.d.pixel.nom || '').replace(/[«»"]/g, '')} »). Mets EXACTEMENT celui-là dans promoted_object de chaque ad set ; aucun autre pixel, ne choisis rien à sa place.` : rep.mode === 'site' ? 'ads_get_datasets : le pixel du compte (dédoublonne ; un pixel qui n\'a jamais tiré, dis-le dans « erreur »).' :'Mode message : pas de pixel ; objectif messages, destination Messenger + Instagram Direct (vérifie les noms exacts avec ads_get_field_context si Meta refuse).'}
3. ads_create_campaign : campaign_name « ${n.campagne} », ${rep.mode === 'site' ? 'objective OUTCOME_SALES' : 'objectif de messages'}, buying_type AUCTION, statut PAUSED. ${b.structure === 'CBO' ? `CBO (la structure du fichier) : campaign_daily_budget ${b.centimes_campagne} (plus petite unité de la devise ${b.devise}), campaign_bid_strategy LOWEST_COST_WITHOUT_CAP. AUCUN campaign_lifetime_budget, AUCUN budget_schedule_specs, AUCUN campaign_spend_cap (règle du vendeur : pas de plafond ; le budget du jour de la campagne est la seule limite).` : 'ABO : AUCUN campaign_daily_budget, campaign_lifetime_budget ni campaign_bid_strategy. AUCUN campaign_spend_cap (règle du vendeur : pas de plafond ; le budget du jour de chaque ad set est la seule limite).'}
4. ${b.un_seul_ad_set ? 'UN SEUL ad set' : `${n.ad_sets.length} ad sets (un par vidéo, une seule vidéo par ad set)`} : campaign_id = la campagne de l'étape 1 ou 3, ${b.structure === 'CBO' ? `AUCUN daily_budget (CBO : le budget est sur la campagne), daily_min_spend_target ${b.centimes_min_par_ad_set} (le plancher de chaque vidéo, centimes, devise ${b.devise}), aucune bid_strategy sur l'ad set` : `daily_budget ${b.centimes_par_ad_set} (centimes, devise ${b.devise})`}, AUCUN daily_spend_cap ni lifetime_spend_cap (pas de plafond), billing_event IMPRESSIONS, ${rep.mode === 'site' ? 'optimization_goal OFFSITE_CONVERSIONS, destination_type WEBSITE, promoted_object {pixel_id, custom_event_type PURCHASE}' : 'optimization_goal CONVERSATIONS, destination Messenger + Instagram Direct'}, targeting.geo_locations = EXACTEMENT ${JSON.stringify(ciblage.geo_locations)} (les ${cib.cles.length} wilayas confirmées par le client, règle du vendeur : JAMAIS countries ["DZ"] ni tout le pays, aucune ville, aucune audience enregistrée ; les placements vont dans ce même targeting), statut PAUSED. Noms : ${JSON.stringify(n.ad_sets)}.
5. Une créa + une annonce par vidéo (PAUSED), l'annonce dans SON ad set (ad_set_id) : page_id, instagram_user_id (ads_get_ig_accounts), video_id, la vignette, call_to_action ${rep.mode === 'site' ? 'SHOP_NOW avec link_url = le lien caché, EXACTEMENT tel quel (le même pour toutes les annonces : les accolades {{campaign.id}} et {{ad.id}} restent ÉCRITES ainsi, Meta les remplace par les numéros ; ne les remplace pas toi-même, n\'y mets aucun nom)' : 'MESSAGE_PAGE (Messenger)'}, message = primary, headline = titre, description. Le nom de chaque annonce (ad_name) = le nom de SON ad set (il porte V01, V02… : Tassyir l'affiche à côté des commandes).
6. TOUT NAÎT EN PAUSE, même dans un compte en mode brouillon : campagne, ad sets et annonces PAUSED. Puis RELIS (ads_get_ad_entities, object_ids = la campagne, ses ad sets et ses annonces, object_state « live » puis « draft », fields id, name, status, configured_status, effective_status). Un objet relu ACTIVE (ou autre que PAUSED) : ne l'active pas, ne publie rien, dis-le dans « note » — le bureau refuse et le dit au client.
Chaque objet est créé À PART : jamais de campaign_spec, d'adset_spec ni de copie (source_campaign_id, source_adset_id, source_ad_id) — une copie garderait les réglages (et le plafond) d'un autre. Les annonces :
${JSON.stringify(annonces, null, 1)}
Rends {campaign_id, ad_sets:[{id, nom}], ads:[{id, ad_set_id, angle}], existaitDeja, pixel_id, page_id, note}. Si Meta refuse un champ deux fois, arrête et mets sa réponse brute dans « erreur ».` }).catch(e => { noterVue(e && e.appels); throw e; });
      noterVue(r.appels);
      const s = r.structure;
      // casse-4 : une PUBLICATION ou une ACTIVATION dans le tour de création (« Publier » un brouillon, ads_update_entity) : un
      // objet a pu s'allumer sans la porte « لانسي » → refus, dit au client (il le met en pause dans Meta), rien n'est noté
      const allumesC = activationsDansCreation(r.appels);
      if (allumesC.length) throw Object.assign(definitive(`publication ou activation pendant la creation du test (${allumesC.join(', ')}) : mets la campagne en pause dans Meta puis reprends`), { client: M.activeeACreation(m.id) });
      // PAR ID : deux campagnes de même clé ou de même nom → celle de la mission, sinon refus (dit au client, rien n'est choisi)
      const homo = refusHomonymes(r.appels, { cle: n.cle, nom: n.campagne, idRendu: s.campaign_id, idConnu, nomsExclus: n.ad_sets || [],
        exclure: [...(s.ad_sets || []), ...(s.ads || []), ...(Array.isArray(s.ad_sets_en_trop) ? s.ad_sets_en_trop : [])].map(a => a && a.id).filter(x => x !== undefined && x !== null) });
      if (homo) throw Object.assign(definitive(`deux campagnes de meme nom ou de meme cle dans Meta : garde-en une puis reprends — ${homo}`), { client: M.homonymes(m.id) });
      if (!s.existaitDeja && !contient(r, 'ads_create_campaign', s.campaign_id)) throw new Error('l\'id de campagne annoncé n\'apparaît pas dans la réponse brute de Meta');
      if (s.existaitDeja && !contient(r, 'ads_get_ad_entities', s.campaign_id)) throw new Error('la campagne reprise (clé déjà là) n\'apparaît pas dans la lecture brute de Meta');
      if (s.existaitDeja && appelsDe(r, 'ads_create_campaign').length) throw new Error('une deuxième campagne a été créée alors que la clé existait déjà');
      const attendus = b.un_seul_ad_set ? 1 : m.d.metaVideos.length;
      if (s.ad_sets.length !== attendus) throw new Error(`${s.ad_sets.length} ad set(s) au lieu de ${attendus}`);
      if (avant.some(t => t.campagne && String(t.campagne) === String(s.campaign_id))) throw new Error(`la campagne ${s.campaign_id} est celle d'un test d'avant refait : elle ne se reprend pas`);
      // une campagne REPRISE peut porter des ad sets EN TROP (doublon, ancienne version) : acceptés seulement s'ils ont été LUS
      // dans Meta, jamais créés dans ce tour, jamais sur une campagne neuve, jamais aussi dans le test ; ils restent en pause
      const enTrop = Array.isArray(s.ad_sets_en_trop) ? s.ad_sets_en_trop.filter(a => a && a.id !== undefined && a.id !== null) : [];
      if (enTrop.length) {
        if (!s.existaitDeja) throw new Error(`${enTrop.length} ad set(s) « en trop » sur une campagne neuve`);
        const duTest = new Set(s.ad_sets.map(a => String(a.id)));
        for (const a of enTrop) {
          if (duTest.has(String(a.id))) throw new Error(`l'ad set ${a.id} est à la fois dans le test et en trop`);
          if (contient(r, 'ads_create_ad_set', a.id)) throw new Error(`l'ad set en trop ${a.id} a été créé dans ce tour`);
          if (!contient(r, 'ads_get_ad_entities', a.id)) throw new Error(`l'ad set en trop ${a.id} n'a jamais été lu dans Meta`);
        }
      }
      if (s.ads.length !== m.d.metaVideos.length) throw new Error(`${s.ads.length} annonce(s) au lieu de ${m.d.metaVideos.length}`);
      // la structure du test (ABO) : une vidéo = un ad set, chaque annonce dans un ad set de CETTE campagne
      const idsAdSets = new Set(s.ad_sets.map(a => String(a.id)));
      if (s.ads.some(a => !idsAdSets.has(String(a.ad_set_id)))) throw new Error('une annonce est rangée hors des ad sets de la campagne');
      if (!b.un_seul_ad_set && new Set(s.ads.map(a => String(a.ad_set_id))).size !== s.ads.length) throw new Error('deux vidéos dans le même ad set (le test : une vidéo par ad set)');
      // LES VRAIS NOMS DES CHAMPS (relus sur les schémas des outils Meta, 06/10/2026) : ads_create_campaign porte
      // campaign_daily_budget / campaign_lifetime_budget / campaign_bid_strategy (CBO) et campaign_spend_cap ; ads_create_ad_set
      // porte daily_spend_cap / lifetime_spend_cap. Un JSON passé EN TEXTE (targeting, campaign_spec…) est lu aussi.
      const creations = (r.appels || []).filter(x => /__ads_create_[a-z_]+$/.test(x.nom));
      const lu = a => JSON.stringify(a.entree || {}).replace(/\\+"/g, '"');
      for (const a of creations) if (/"status"\s*:\s*"ACTIVE"/.test(lu(a))) throw new Error('une création a été envoyée ACTIVE au lieu de PAUSED');
      // une copie ou une création « en ligne » échappe aux contrôles qui suivent (elle garderait le plafond d'un autre)
      for (const a of creations) { const x = /"(campaign_spec|adset_spec|source_campaign_id|source_adset_id|source_ad_id)"\s*:/.exec(lu(a)); if (x) throw new Error(`création par copie ou en ligne (${x[1]}) : chaque objet du test est créé à part`); }
      // règle du vendeur : AUCUN plafond de dépense, ni sur la campagne ni sur les ad sets (quel que soit le nom du champ)
      for (const a of creations) { const x = /"([a-z_]*spend_cap)"\s*:/i.exec(lu(a)); if (x) throw new Error(`un plafond de dépense a été envoyé (${x[1]}) — règle : pas de plafond`); }
      // ABO : aucun budget ni stratégie d'enchère sur la campagne, et chaque ad set au budget de l'outil (en centimes)
      // 0.4.2 CBO (structure du fichier) : le budget du jour SUR la campagne (exactement celui de l'outil), aucun budget sur
      // les ad sets, chaque ad set au plancher de l'outil (daily_min_spend_target) ; jamais de budget de vie
      const cbo = b.structure === 'CBO';
      for (const a of appelsDe(r, 'ads_create_campaign')) {
        if (cbo) {
          const v = /"campaign_daily_budget"\s*:\s*"?(\d+)/.exec(lu(a)); if (!v || +v[1] !== +b.centimes_campagne) throw new Error(`campagne CBO créée avec campaign_daily_budget ${v ? v[1] : 'absent'} au lieu de ${b.centimes_campagne} centimes`);
          const x = /"(campaign_lifetime_budget|lifetime_budget)"\s*:/.exec(lu(a)); if (x) throw new Error(`un budget de vie a été posé sur la campagne (${x[1]}) — règle : budget du jour seulement`);
        } else { const x = /"((campaign_)?(daily|lifetime)_budget|campaign_bid_strategy)"\s*:/.exec(lu(a)); if (x) throw new Error(`un budget a été posé sur la campagne (${x[1]} : CBO) — le test est en ABO`); }
      }
      for (const a of appelsDe(r, 'ads_create_ad_set')) {
        if (cbo) {
          const x = /"(daily_budget|lifetime_budget|bid_strategy)"\s*:/.exec(JSON.stringify(a.entree || {})); if (x) throw new Error(`ad set créé avec ${x[1]} sous une campagne CBO (le budget est sur la campagne)`);
          const mn = /"daily_min_spend_target"\s*:\s*"?(\d+)/.exec(JSON.stringify(a.entree || {})); if (!mn || +mn[1] !== +b.centimes_min_par_ad_set) throw new Error(`ad set CBO créé avec daily_min_spend_target ${mn ? mn[1] : 'absent'} au lieu de ${b.centimes_min_par_ad_set} centimes (le plancher de chaque vidéo)`);
        } else {
          const v = /"daily_budget"\s*:\s*"?(\d+)/.exec(JSON.stringify(a.entree || {})); if (!v || +v[1] !== +b.centimes_par_ad_set) throw new Error(`ad set créé avec daily_budget ${v ? v[1] : 'absent'} au lieu de ${b.centimes_par_ad_set} centimes`);
        }
        // « complète-la » : un ad set créé l'est DANS cette campagne, jamais dans une autre qui porte la clé
        if (String(a.entree?.campaign_id || '') !== String(s.campaign_id)) throw new Error(`ad set créé dans la campagne ${a.entree?.campaign_id || '?'} au lieu de ${s.campaign_id}`);
        // les 25 wilayas du vendeur (confirmées par le client), relues dans l'ENTRÉE brute : jamais countries DZ, rien d'autre
        const fc = fauteCiblage(a.entree?.targeting, cib.cles, a.entree);
        if (fc) throw new Error(`ad set « ${a.entree?.ad_set_name || '?'} » créé hors des wilayas confirmées (${fc})`);
      }
      for (const a of appelsDe(r, 'ads_create_ad')) if (!idsAdSets.has(String(a.entree?.ad_set_id || ''))) throw new Error(`annonce créée dans l'ad set ${a.entree?.ad_set_id || '?'}, qui n'est pas un ad set de la campagne`);
      // 0.4.2 : LE LIEN CACHÉ dans chaque créa (mode site) — les numéros de Meta ({{campaign.id}}, {{ad.id}}), jamais un nom
      // écrit à la main : sans lui, Tassyir ne relie aucune commande à la dépense de l'annonce
      if (rep.mode === 'site') for (const a of appelsDe(r, 'ads_create_creative')) {
        const l = String(a.entree?.link_url || '');
        if (!l.includes('utm_campaign={{campaign.id}}') || !l.includes('utm_content={{ad.id}}')) throw new Error(`créa créée sans le lien caché (numéros de Meta) : ${l.slice(0, 90) || 'link_url absent'}`);
      }
      // [v19-trois] le pixel CHOISI et relu : chaque ad set créé le porte, et le pixel rendu est le même (sinon refus, rien n'est activé)
      if (rep.mode === 'site' && m.d.pixel && m.d.pixel.id) {
        const fp = fautePixelCreation(r.appels, m.d.pixel.id);
        if (fp) throw definitive(`pixel : ${fp} — les objets restent en pause, corrige-les dans Meta puis reprends`);
        if (s.pixel_id && String(s.pixel_id) !== String(m.d.pixel.id)) throw definitive(`pixel rendu ${s.pixel_id} au lieu du pixel choisi ${m.d.pixel.id}`);
      }
      // 2e méthode sur CHAQUE id rendu : il est dans une réponse brute de Meta (créé ici, ou lu dans la campagne reprise)
      for (const a of s.ad_sets) if (!contient(r, 'ads_create_ad_set', a.id) && !contient(r, 'ads_get_ad_entities', a.id)) throw new Error(`l'ad set ${a.id} n'apparaît dans aucune réponse brute de Meta (ni créé, ni lu)`);
      for (const a of s.ads) if (!contient(r, 'ads_create_ad', a.id) && !contient(r, 'ads_get_ad_entities', a.id)) throw new Error(`l'annonce ${a.id} n'apparaît dans aucune réponse brute de Meta (ni créée, ni lue)`);
      // une campagne REPRISE d'une ancienne version (v0.3.7 posait lifetime_spend_cap) : le plafond est relu dans Meta.
      // On ne l'enlève pas en douce (aucun outil de modification à cette étape) : on s'arrête et on le dit.
      if (s.existaitDeja) {
        const plafonne = [];
        const fouiller = o => { if (Array.isArray(o)) return o.forEach(fouiller); if (!o || typeof o !== 'object') return;
          const id = String(o.id ?? ''); if ((id === String(s.campaign_id) || idsAdSets.has(id)) && ['spend_cap', 'daily_spend_cap', 'lifetime_spend_cap'].some(k => +(o[k] || 0) > 0)) plafonne.push(id);
          for (const v of Object.values(o)) if (v && typeof v === 'object') fouiller(v); };
        for (const a of appelsDe(r, 'ads_get_ad_entities')) for (const j of jsonsDans(a.sortie)) fouiller(j);
        // le client lit les 108 premiers caractères (decoupeLatin) : la consigne d'abord, les id ensuite
        if (plafonne.length) throw definitive(`plafond de dépense sur la campagne reprise (ancienne version) : retire-le dans Meta puis reprends — ${[...new Set(plafonne)].join(', ')}`);
      }
      // un ad set REPRIS (pas créé dans ce tour) : son ciblage relu dans les réponses BRUTES — une ancienne version visait
      // countries ["DZ"] (tout le pays) ; on ne le change pas en douce : on s'arrête et on le dit. Pas relu : noté.
      // Une campagne montée par une version d'AVANT la règle (m.d.campagneAncienne : son « لانسي » l'a renvoyée ici) : son
      // ciblage DOIT être relu — pas relu, elle ne part pas. Le client lit en darija quoi faire (07/10/2026, « casse »).
      const lusTest = objetsLus(r);
      for (const a of s.ad_sets) {
        if (contient(r, 'ads_create_ad_set', a.id)) continue;
        const o = lusTest.get(String(a.id));
        if (!o || o.targeting === undefined) {
          if (m.d.campagneAncienne) throw Object.assign(definitive(`ciblage de l'ad set repris ${a.id} non relu (campagne d'une version d'avant les wilayas) : vérifie-le dans Meta puis reprends`), { client: M.campagneAncienne(m.id) });
          histoire(m, `campagne : ciblage de l'ad set repris ${a.id} non relu dans Meta`); continue;
        }
        const fc = fauteCiblage(o.targeting, cib.cles);
        if (fc) throw Object.assign(definitive(`ciblage de l'ad set repris ${a.id} hors des wilayas confirmées : corrige-le dans Meta puis reprends — ${fc}`), { client: M.campagneAncienne(m.id) });
      }
      // TOUT EN PAUSE, RELU (09/10/2026) : un objet de ce test relu autrement qu'en pause (compte en mode brouillon : ACTIVE)
      // → refusé, dit au client, rien n'est activé ; pas relu du tout : noté
      const objetsCrees = [s.campaign_id, ...s.ad_sets.map(a => a.id), ...s.ads.map(a => a.id), ...enTrop.map(a => a.id)].map(String);
      // casse-4 : tout objet CRÉÉ dans ce tour est relu (une annonce glissée en plus, non rendue), et un statut relu en objet
      for (const id of idsCreesDansLeTour(r.appels)) if (!objetsCrees.includes(id)) objetsCrees.push(id);
      const pasEnPause = [...nonPauses(r.appels, objetsCrees), ...nonPausesObjets(r.appels, objetsCrees)];
      const envoiHorsPause = creationHorsPause(r.appels);
      if (envoiHorsPause) throw Object.assign(definitive(`creation hors pause, remets-la en pause dans Meta (rien n'est active) : ${envoiHorsPause}`), { client: M.creeNonPause(m.id) });
      if (pasEnPause.length) throw Object.assign(definitive(`objet du test relu hors pause, remets-le en pause dans Meta (rien n'est active) : ${pasEnPause.slice(0, 4).map(x => `${x.id} ${x.champ} ${x.statut}`).join(', ')}`), { client: M.creeNonPause(m.id) });
      if (!statutsLusDe(r.appels, objetsCrees)) histoire(m, 'campagne : statut des objets créés non relu dans Meta (ni ACTIVE ni PAUSED lu)');
      if (s.note) histoire(m, `campagne : ${String(s.note).slice(0, 200)}`);
      // « ciblage » : les wilayas avec lesquelles cette campagne a été montée ET relue — une campagne sans ce champ vient d'une
      // version d'avant (countries ["DZ"]) et ne s'allume jamais telle quelle (étape activation)
      m.d.campagne = { id: s.campaign_id, adSets: s.ad_sets, ads: s.ads, pixel: s.pixel_id || null, page: s.page_id || null, existaitDeja: !!s.existaitDeja, ciblage: cib.cles, ...(enTrop.length ? { adSetsEnTrop: enTrop.map(a => ({ id: String(a.id), nom: a.nom || null })) } : {}) };
      delete m.d.campagneAncienne;
      if (enTrop.length) {
        histoire(m, `campagne : ${enTrop.length} ad set(s) en trop dans la campagne reprise (${enTrop.map(a => a.id).join(', ')}) — laissés EN PAUSE, jamais activés`);
        if (!m.d.adSetsEnTropDit) { await envoyer(m, M.adSetsEnTrop(enTrop.length)); m.d.adSetsEnTropDit = maintenant(); }
      }
    },
    async lance(m) {
      if (await testAuPlusQuatre(m)) return 'REFAIRE';
      const st = m.etapes.lance;
      if (st.reponse === 'oui') return undefined;
      // [porte-groupee] un modèle d'un LOT (deux missions et plus) : sa campagne prête EN PAUSE attend la porte du LOT (une
      // seule question pour tous les modèles, verifierPorteLot à la sortie d'avancer) — plus aucune question par modèle
      if (lotGroupe(m)) {
        if (!st.groupe) { st.groupe = maintenant(); histoire(m, 'lance : campagne prête EN PAUSE — elle attend la porte « لانسي » du lot (une seule question pour tous ses modèles)'); }
        return ATTENTE;
      }
      // [v19-trois] jamais deux questions « لانسي » ouvertes : une porte de lot ouverte → ce modèle la rejoint (porte neuve, à la
      // sortie d'avancer) ; la question d'une autre mission seule ouverte → il attend (dit) ; fermée par « الغي » / reprise : rien
      if (!st.demande && !st.annulee && !st.reprisePar) {
        const o = questionOuverte(m);
        if (o) { if (!st.rejoint) { st.rejoint = maintenant(); histoire(m, `lance : une autre question « لانسي » est ouverte (${o.type === 'lot' ? 'porte du lot ' + o.l.id : 'mission ' + o.x.code}) — ${o.type === 'lot' ? 'ce modèle rejoint une porte neuve' : 'ce modèle attend sa réponse'}`); if (o.type === 'seul') await envoyer(m, M.attendQuestion()); } return ATTENTE; }
        delete st.rejoint;
        await envoyer(m, M.campagnePrete(m.id, m.d.budget, +R().taux || 0, m.demande.reponses.mode, m.demande.reponses.placements, m.d.metaVideos.length)); st.demande = maintenant();
      }
      return ATTENTE;
    },
    async activation(m) {
      if (await testAuPlusQuatre(m)) return 'REFAIRE';
      const c = m.d.campagne;
      // Un « لانسي » sur une campagne montée AVANT la règle des wilayas (une version d'avant : countries ["DZ"], les 58
      // wilayas — un vieux bouton pressé après la mise à jour) : elle n'est JAMAIS allumée telle quelle (07/10/2026, « casse » :
      // elle partait sur toute l'Algérie, le défaut d'origine). Elle repasse par l'étape campagne, qui relit le ciblage de
      // chaque ad set (refusé s'il n'est pas les wilayas confirmées, ou s'il ne se relit pas), puis le client re-presse « لانسي ».
      if (!Array.isArray(c.ciblage)) {
        m.d.campagneAncienne = true;
        m.etapes.campagne = { etat: 'afaire', essais: 0 }; m.etapes.lance = { etat: 'afaire', essais: 0 }; m.etapes.activation = { etat: 'afaire', essais: 0 };
        histoire(m, `activation : la campagne ${c.id} vient d'une version d'avant les wilayas — rien n'est allumé, elle repasse par l'étape campagne (ciblage relu) puis par « لانسي »`);
        return 'REFAIRE';
      }
      const objets = objetsTest(m);
      // DÉJÀ PARTIE : jamais une deuxième activation. Le PC coupé PENDANT le tour d'activation (activationEnVol encore là au
      // démarrage), ou « عاود » après un refus de Meta : on RELIT (la relecture tranche), on ne réactive pas. Une attente de
      // relecture (coupure pendant l'attente) reprend telle quelle.
      if (m.d.activationEnVol && !m.d.publication) {
        // aucune preuve qu'une publication est partie : un DRAFT relu ne compte pas « en cours » (publiee: false)
        m.d.publication = { le: m.d.activationEnVol, essais: 0, prochaine: maintenant(), publiee: false, apresCoupure: true };
        histoire(m, 'activation : le PC s\'est coupé PENDANT le tour d\'activation — on relit dans Meta, jamais une 2e activation');
      }
      if (m.d.activationRejetee && !m.d.publication) {
        m.d.publication = { le: m.d.activationRejetee.le, essais: 0, prochaine: maintenant(), publiee: !!m.d.activationRejetee.publiee, apresRefus: true };
        histoire(m, 'activation : « عاود » après un refus de Meta — on RELIT (une pub corrigée dans Meta passe), rien n\'est réactivé');
      }
      // Une mission BLOQUÉE par l'ANCIENNE règle (avant le 09/10/2026 : PUBLISHING ou DRAFT lus comme un échec, après une
      // activation déjà envoyée) : son « عاود » RELIT dans Meta, il ne réactive pas (jamais une 2e activation).
      const ancienne = /n'est pas actif à la relecture \((PUBLISHING|DRAFT)\)/i.exec(String((m.etapes.activation || {}).erreur || ''));
      if (ancienne && m.d.activationTentee && !m.d.publication && !m.d.lanceLe) {
        m.d.publication = { le: m.d.activationTentee, essais: 0, prochaine: maintenant(), publiee: /PUBLISHING/i.test(ancienne[1]), apresAncienneRegle: true };
        histoire(m, `activation : bloquée par l'ancienne règle (${ancienne[1]} lu comme un échec) — « عاود » RELIT dans Meta, rien n'est réactivé`);
      }
      delete m.d.activationEnVol; delete m.d.activationRejetee;
      if (m.d.publication) { sauver(m); return ATTENTE; }
      // dès qu'une activation est tentée, un « حبس » du client met en pause (même si ce tour est refusé ensuite) ; activationEnVol
      // dit au prochain démarrage qu'un tour d'activation était EN ROUTE (relire, pas réactiver)
      // [porte-groupee] L'HEURE DE DÉBUT posée à la validation de la porte du lot (m.d.depart) : start_time sur CHAQUE ad set
      // AVANT l'activation, puis relue. Une heure déjà passée (la chaîne des activations a pris du temps) n'est pas posée :
      // démarrage tout de suite, écrit et dit au client (l'heure annoncée n'est plus celle de Meta).
      const dep = m.d.depart || null, adSetsTest = c.adSets.map(a => String(a.id));
      let heureMs = dep && dep.heure ? Date.parse(dep.heure) : null;
      if (heureMs !== null && heureMs < Date.now() + 2 * 60000) {
        histoire(m, `activation : l'heure de début ${heureCourte(dep.heure)} est déjà passée au moment de ce tour — aucune heure posée, démarrage tout de suite`);
        dep.heurePassee = maintenant(); heureMs = null; m.d.heureNonPosee = { le: maintenant(), fautes: [`heure ${heureCourte(dep.heure)} passée avant le tour d'activation`] };
        await envoyer(m, M.heureNonPosee(m.id));
      }
      const porteLot = dep ? ticketLotDe(m) : null;
      const consigneHeure = heureMs === null ? '' : `DÉMARRAGE PROGRAMMÉ (porte « لانسي » du lot) : AVANT toute publication et toute activation, pose l'heure de début sur CHAQUE ad set de ce test, un appel par ad set : ads_update_entity { entity_type "adset", entity_id <id>, fields {"start_time":"${new Date(heureMs).toISOString().replace(/\.\d{3}Z$/, '+0000')}"} } pour ${JSON.stringify(adSetsTest)}. fields porte le SEUL champ start_time (ni budget, ni status, rien d'autre) ; aucun autre objet. Puis seulement, publie et active comme dit ci-dessous. À la fin, RELIS ces ad sets (ads_get_ad_entities level "adset", object_ids = ces ad sets, fields ["id","start_time","effective_status","daily_budget"]). Un ad set relu SCHEDULED, PENDING ou avec un début futur est NORMAL : il est PROGRAMMÉ, ne réactive rien et ne change pas l'heure.\n`;
      m.d.activationTentee = maintenant(); m.d.activationEnVol = m.d.activationTentee; sauver(m);
      let r;
      try {
        r = await tourClaude(m, 'activation', { dept: 'testing', outils: ['meta.ads_activate_entity', 'meta.ads_get_ad_entities', ...(heureMs !== null ? ['meta.ads_update_entity'] : [])], porte: objets, adSetsPorte: heureMs !== null ? adSetsTest : [], porteExistante: porteLot,
          schema: { type: 'object', properties: { statuts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, niveau: { type: 'string' }, statut: { type: 'string' } }, required: ['id', 'statut'] } }, erreur: { type: 'string' } }, required: ['statuts'] },
          message: `${consigneHeure}Le client a pressé « لانسي » (= le mot « lance ») pour CE test et seulement lui. Active, dans cet ordre : la campagne ${c.id}, PUIS chaque ad set ${JSON.stringify(c.adSets.map(a => a.id))}, PUIS chaque annonce ${JSON.stringify(c.ads.map(a => a.id))} (ads_activate_entity). Si elle est en BROUILLON (draft), publie-la D'ABORD avec object_ids = exactement ces objets ${JSON.stringify(objets)} et AUCUN autre (un autre brouillon du compte ne part jamais avec elle), entity_id = la campagne et publish_as_active true ; puis active chacun de ces objets resté en pause (la publication n'allume que la campagne). Ne touche à rien d'autre : aucune autre campagne, aucun budget. Puis RELIS dans Meta (ads_get_ad_entities, object_state « live » puis « draft ») le statut effectif de chacun. Si Meta répond PUBLISHING (compte en mode brouillon : la publication est en cours), c'est NORMAL : ne réactive rien, relis et rends les statuts tels quels — le bureau relira lui-même plus tard.
Rends {statuts:[{id, niveau, statut}]} avec les statuts RELUS (ACTIVE, IN_PROCESS, PENDING_REVIEW, PUBLISHING, DRAFT, DISAPPROVED…).` });
      } catch (e) {
        delete m.d.activationEnVol;
        // un tour COUPÉ (limite, panne, JSON absent, Claude arrêté) APRÈS un ads_activate_entity : quelque chose est peut-être parti
        // → on RELIT, jamais une 2e activation. Rien n'est parti (limite avant de commencer, connecteur à l'init) : l'erreur suit
        // son chemin (la reprise peut activer, rien n'a été touché).
        const partis = appelsActivation(e && e.appels);
        if (!partis.length) { sauver(m); throw e; }
        await noterHeure(m, e.appels, heureMs, adSetsTest); // [porte-groupee] l'heure relue même dans un tour coupé
        const hors = activesHors({ appels: e.appels }, objets);
        if (hors.length) throw definitive(`objet hors de ce test activé, remets-le en pause dans Meta : ${hors.join(', ')}`);
        const touches = touchesHors({ appels: e.appels }, objets);
        if (touches.length) throw definitive(`objet hors de ce test touché, remets-le en pause dans Meta : ${touches.join(', ')}`);
        if (m.etat !== 'encours') { if (m.etat === 'arretee') await repauserApresActivation(m); sauver(m); return undefined; }
        m.d.publication = { le: maintenant(), essais: 0, prochaine: new Date(Date.now() + delaiRelecture()).toISOString(), publiee: publieDans(e.appels), apresPanne: String(e.message || e).slice(0, 160) };
        histoire(m, `activation : tour coupé APRÈS ${partis.length} appel(s) d'activation (${String(e.message || e).slice(0, 120)}) — relecture dans Meta, jamais une 2e activation`);
        sauver(m);
        if (e.quota) await prevenirQuota();
        return ATTENTE;
      }
      delete m.d.activationEnVol;
      await noterHeure(m, r.appels, heureMs, adSetsTest); // [porte-groupee] l'heure de début relue (ou « heure non posée », dit)
      // 2e méthode : les appels BRUTS. Chaque id activé (entity_id, et chaque id d'un brouillon publié) est un objet de CE
      // test — sinon refus, dit au client (le texte commence par la consigne : il lit les 108 premiers caractères)
      const hors = activesHors(r, objets);
      if (hors.length) throw definitive(`objet hors de ce test activé, remets-le en pause dans Meta : ${hors.join(', ')}`);
      const touches = touchesHors(r, objets); // [relecture] l'heure de début : jamais un objet hors du test
      if (touches.length) throw definitive(`objet hors de ce test touché, remets-le en pause dans Meta : ${touches.join(', ')}`);
      // « lancée » sur une PHRASE (aucun appel d'activation) : jamais. Rien n'est parti, la reprise peut activer.
      if (!appelsActivation(r.appels).length) throw new Error('aucune activation envoyée à Meta (aucun ads_activate_entity) : rien n\'est parti');
      // « حبس » pendant le tour : la mission reste arrêtée — [relecture] 10/10/2026 : et si l'activation est passée APRÈS la pause
      // (la pause était en file avant elle), la pause est REFAITE (le client a lu « راني حبستها »), jamais laissée allumée
      if (m.etat !== 'encours') { if (m.etat === 'arretee' && appelsActivation(r.appels).length) await repauserApresActivation(m); sauver(m); return undefined; }
      const publiee = publieDans(r.appels), lu = lireActivation(r, objets, publiee);
      histoire(m, `activation : ${lu.verdict} — ${resumeClasses(lu.classes)}`);
      return deciderActivation(m, lu, { le: maintenant(), publiee, depuisTour: true });
    }
  };
  /** Un test d'AVANT la règle des quatre créas (08/10/2026) : plus de quatre vidéos, et RIEN d'allumé (ni « لانسي » parti,
   *  ni activation tentée ou en vol, ni publication). Il est refait : retour à l'étape budget avec le choix du client (sinon
   *  le réglage), les vidéos déjà chez Meta reprises sans nouvel envoi, une clé neuve, « لانسي » redemandé. Son ancienne
   *  campagne n'est ni reprise, ni modifiée, ni supprimée, ni allumée : notée dans m.d.testsAvant, le client le sait. Un test
   *  déjà allumé n'est JAMAIS touché. Rend true quand le test est refait. */
  async function testAuPlusQuatre(m) {
    const n = (m.d.videosTest || []).length;
    if (n <= CREAS_MAXI) return false;
    if (m.d.lanceLe || m.d.activationTentee || m.d.activationEnVol || m.d.activationRejetee || m.d.publication) return false;
    const vus = m.d.metaVideos || [], vign = m.d.metaVignettes || [];
    const dejaChezMeta = m.d.videosTest.map((v, i) => { const x = vus.find(y => +y.index === i); return x && x.video_id ? { fichier: v.fichier, video_id: String(x.video_id), duree: x.duree ?? v.duree ?? null, image_hash: vign.find(y => +y.index === i)?.image_hash || null, url: vign.find(y => +y.index === i)?.url || null } : null; }).filter(Boolean);
    m.d.metaDejaEnvoyees = [...(m.d.metaDejaEnvoyees || []).filter(x => !dejaChezMeta.some(y => y.fichier === x.fichier)), ...dejaChezMeta];
    m.d.testsAvant = [...(m.d.testsAvant || []), { le: maintenant(), videos: n, cle: m.d.noms?.cle || null, campagne: m.d.campagne?.id || null, adSets: (m.d.campagne?.adSets || []).map(a => String(a.id)) }];
    for (const id of ['budget', 'videos', 'noms', 'campagne', 'lance', 'activation']) m.etapes[id] = { etat: 'afaire', essais: 0 };
    delete m.d.budget; delete m.d.videosTest; delete m.d.metaVideos; delete m.d.metaVignettes; delete m.d.noms; delete m.d.campagne; delete m.d.campagneAncienne;
    const k = creasDe(m.demande.reponses.creas, R().creasParModele);
    histoire(m, `test d'avant à ${n} vidéos (au plus ${CREAS_MAXI} maintenant), rien d'allumé : refait avec ${k} créa(s), clé neuve ; l'ancienne campagne ${m.d.testsAvant[m.d.testsAvant.length - 1].campagne || '(pas encore créée)'} reste en pause, rien n'est supprimé`);
    sauver(m);
    await envoyer(m, M.testRefait(k));
    return true;
  }
  /** Les objets de CE test (la campagne, ses ad sets, ses annonces) : rien d'autre n'est activé ni relu. */
  const objetsTest = m => { const c = m.d.campagne; return [c.id, ...c.adSets.map(a => a.id), ...c.ads.map(a => a.id)].map(String); };
  const delaiRelecture = () => deps.delaiRelectureMs ?? 180000;
  const RELECTURES_MAX = 3;
  /** La décision d'un tour d'activation (depuisTour) ou d'une relecture : lancée / partielle → le test est LANCÉ (suivi du
   *  soir) ; refusée → dit au client, RIEN d'autre ; attendre → « lancée, à confirmer » (une relecture plus tard) ; échec →
   *  rien ne tourne, dit au client (son « عاود » refait une activation : sa décision). */
  async function deciderActivation(m, lu, { le, publiee, depuisTour = false }) {
    const ids = c => Object.entries(lu.classes).filter(([, k]) => k === c).map(([id]) => id);
    // [porte-groupee] une heure de début posée et relue : le test démarre à cette heure (le message la dit)
    const prog = heureProgrammee(m);
    if (lu.verdict === 'lancee') { await lancerTest(m, { depuis: prog ? prog.iso : le, msg: prog ? M.lanceeProgrammee(prog.hhmm) : M.lancee() }); return undefined; }
    if (lu.verdict === 'partielle') { histoire(m, `activation : lancée EN PARTIE (refusé ou à l'arrêt : ${[...ids('refus'), ...ids('arret')].join(', ')}) — le suivi du soir est gardé`); if (prog) histoire(m, `activation : lancée EN PARTIE avec l'heure de début ${prog.hhmm} posée — le test compte depuis cette heure (l'heure annoncée = l'heure posée)`); await lancerTest(m, { depuis: prog ? prog.iso : le, msg: M.publicationRefusPartiel(m.id) }); if (prog) await envoyer(m, M.lanceeProgrammee(prog.hhmm)); return undefined; }
    if (lu.verdict === 'refusee') {
      m.d.activationRejetee = { le, publiee, ids: ids('refus') }; delete m.d.publication;
      throw Object.assign(definitive(`Meta a refusé la pub (${ids('refus').join(', ')}) : rien d'autre n'est fait, ni pause ni nouvelle activation`), { client: M.activationRejetee(m.id) });
    }
    if (lu.verdict === 'attendre') {
      const premier = !m.d.publication;
      m.d.publication = { ...(m.d.publication || {}), le: m.d.publication?.le || le, publiee: !!(publiee || m.d.publication?.publiee), essais: m.d.publication?.essais || 0, prochaine: new Date(Date.now() + delaiRelecture()).toISOString() };
      histoire(m, `activation : en cours de publication chez Meta (${[...ids('encours'), ...ids('inconnu')].join(', ')}) — lancée, à confirmer : relecture dans ${Math.round(delaiRelecture() / 1000)} s`);
      sauver(m);
      if (depuisTour && premier) await envoyer(m, M.activationEnCours(m.id));
      return ATTENTE;
    }
    delete m.d.publication;
    throw definitive(`rien n'est actif à la relecture (${resumeClasses(lu.classes)}) : la pub ne tourne pas`);
  }
  /** Le test est LANCÉ : le fichier de passage Testing → Coach, puis le message (« lancee » : inchangé ; une lancée partielle
   *  ou une publication longue le disent). depuis : l'heure de la publication (le jour 1 du test). */
  async function lancerTest(m, { depuis = maintenant(), msg = M.lancee() } = {}) {
    const c = m.d.campagne;
    m.d.lanceLe = depuis; delete m.d.publication; delete m.d.activationRejetee;
    // le fichier de passage Testing → Coach : écrit par l'outil, dans le dossier du testing de la mission
    const rep = m.demande.reponses, cts = R().couts || {};
    const passage = { cle: m.d.noms.cle, date_lancement: m.d.lanceLe.slice(0, 10), ad_account_id: String(rep.compte?.id || ''), product_id: m.d.produit.productId, devise: m.d.budget.devise, mode: rep.mode,
      break_even_par_commande_da: Math.round(m.d.be.par_commande), couts: { prix: rep.detail, cout_produit: rep.gros, emballage: +cts.emballage, livraison: +cts.livraison, frais_cod: +(cts.fraisCod || 0), cout_retour: +cts.retour },
      taux_declares: { confirmation: +(R().declare?.confirmation || 0) / 100, livraison: +(R().declare?.livraison || 0) / 100 }, stock: rep.stock === 'stock' ? 'stock' : 'test', campagne_id: c.id, budget_centimes_par_ad_set: m.d.budget.centimes_par_ad_set };
    const dTest = path.join(dossier(m), 'testing'); fs.mkdirSync(dTest, { recursive: true });
    fs.writeFileSync(path.join(dTest, 'passage.json'), JSON.stringify(passage, null, 1));
    sauver(m);
    const rp = await outil(m, 'passage', '3-TESTING/manita-testing.py', ['--passage-ecrire', '--json', JSON.stringify(passage)], { cwd: dTest, dureeMaxMs: 60000 });
    if (!fs.existsSync(path.join(dTest, 'test-en-cours.json'))) histoire(m, 'passage non écrit : ' + extrait(rp.sortie));
    await envoyer(m, msg);
  }
  /** LA RELECTURE d'une activation « en cours de publication » (l'horloge, ~3 min après) : un tour qui LIT seulement
   *  (ads_get_ad_entities, les objets de CETTE mission), au plus trois fois ; toujours en cours après la dernière, ou relecture
   *  impossible → le client le sait et le suivi du soir est GARDÉ (jamais « échec » qui laisse de l'argent tourner sans suivi).
   *  Une limite d'usage ou un connecteur à reconnecter ne comptent pas un essai. Une mission arrêtée reste arrêtée. */
  async function relirePublication(m) {
    if (enMarche.has(m.id) || m.etat !== 'encours' || m.attente !== 'activation' || !m.d.publication) return;
    enMarche.add(m.id);
    let suite = false;
    try {
      const p = m.d.publication, c = m.d.campagne, objets = objetsTest(m);
      let r = null, panne = null;
      try {
        r = await tourClaude(m, 'activation-relire', { dept: 'testing', outils: ['meta.ads_get_ad_entities'], essaisLeger: (p.essais || 0) + (p.pannes || 0),
          schema: { type: 'object', properties: { statuts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, niveau: { type: 'string' }, statut: { type: 'string' } }, required: ['id', 'statut'] } }, erreur: { type: 'string' } }, required: ['statuts'] },
          message: `RELECTURE de l'activation de CE test (tu LIS seulement : tu n'actives rien, tu ne modifies rien). Compte ${String(m.demande.reponses.compte?.id || '').replace(/^act_/, '')}. Les objets de ce test et AUCUN autre : la campagne ${c.id}, les ad sets ${JSON.stringify(c.adSets.map(a => a.id))}, les annonces ${JSON.stringify(c.ads.map(a => a.id))}.
ads_get_ad_entities sur ces objets (object_ids = exactement ${JSON.stringify(objets)}), object_state « live » PUIS « draft » (un compte en mode brouillon garde là ce qui est en cours de publication), fields id, name, status, effective_status, configured_status.
Rends {statuts:[{id, niveau, statut}]} avec le statut effectif RELU de chacun (ACTIVE, IN_PROCESS, PENDING_REVIEW, PUBLISHING, DRAFT, DISAPPROVED, PAUSED…).` });
      } catch (e) {
        if (e && e.quota) { histoire(m, `activation : relecture repoussée — limite d'usage de Claude (aucun essai perdu)`); sauver(m); await prevenirQuota(); return; }
        if (e && e.connecteur) { p.attendConnecteur = clesDe(e); histoire(m, `activation : relecture en attente — connecteur à reconnecter (${p.attendConnecteur.join(', ')}), aucun essai perdu`); sauver(m); await signalerConnecteur(p.attendConnecteur, m); return; }
        panne = e; p.pannes = (p.pannes || 0) + 1;
      }
      // « حبس » pendant la relecture : la mission arrêtée reste arrêtée (rien n'est « lancé » derrière son dos)
      if (m.etat !== 'encours' || m.attente !== 'activation' || m.d.publication !== p) { histoire(m, `activation : relecture rendue, mais la mission est ${m.etat} — rien de plus`); sauver(m); return; }
      p.essais = (p.essais || 0) + 1; p.derniere = maintenant();
      const lu = r ? lireActivation(r, objets, p.publiee) : { verdict: 'attendre', classes: Object.fromEntries(objets.map(id => [id, 'inconnu'])) };
      histoire(m, `activation : relecture ${p.essais} — ${panne ? 'impossible (' + String(panne.message || panne).slice(0, 120) + ')' : lu.verdict + ' — ' + resumeClasses(lu.classes)}`);
      const st = m.etapes.activation = m.etapes.activation || { etat: 'attente', essais: 0 };
      if (lu.verdict === 'attendre' && p.essais < RELECTURES_MAX) { p.prochaine = new Date(Date.now() + delaiRelecture()).toISOString(); sauver(m); return; }
      try {
        if (lu.verdict === 'attendre') {
          // toujours en cours (ou illisible) après la dernière relecture : la pub peut tourner — le suivi du soir est GARDÉ
          histoire(m, `activation : Meta n'a pas confirmé après ${p.essais} relecture(s) — le client le sait, le suivi du soir est gardé`);
          await lancerTest(m, { depuis: p.le, msg: M.publicationLongue(m.id) });
        } else await deciderActivation(m, lu, { le: p.le, publiee: p.publiee });
        if (m.etat === 'encours' && m.d.lanceLe) { Object.assign(st, { etat: 'fini', fin: maintenant() }); m.attente = null; histoire(m, 'activation : fini'); sauver(m); suite = true; }
      } catch (e) {
        st.essais = (st.essais || 0) + 1; st.erreur = String(e.message || e).slice(0, 500); st.etat = 'echec'; m.etat = 'bloquee'; m.attente = null;
        histoire(m, `activation : ÉCHEC (${st.essais}) — ${st.erreur}`); sauver(m);
        await envoyer(m, e.client && e.client.texte ? e.client : M.echec(m.id, NOM_AR.activation, st.erreur));
      }
    } finally { enMarche.delete(m.id); }
    if (suite) await avancer(m); // plus aucune étape : la mission passe au suivi
  }

  /* ---------------------------------------- le SUIVI de chaque soir ---------------------------------------- */
  // La publicité tourne. Chaque soir : Claude LIT (Tassyir + Meta), les OUTILS calculent (carnet, lecture du
  // testing, porte du coach, échelle du scaling), le robot RACONTE. Seule exception d'action sans le client :
  // le DISJONCTEUR (dépense sans aucune confirmée) met en pause — mettre en pause reste toujours libre.
  const jourLocal = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  function heureVenue(heure, d = new Date()) { const [h, mn] = String(heure || '20:30').split(':').map(Number); return d.getHours() * 60 + d.getMinutes() >= (h || 0) * 60 + (mn || 0); }
  // La lecture du soir qui ÉCHOUE (connecteur Meta débranché, « erreur » rendue par Claude, contrôle intégré qui refuse) :
  // au plus LECTURES_PAR_SOIR essais par soir, espacés de delaiLecture (07/10/2026 : elle était relancée CHAQUE MINUTE de
  // l'heure du rapport à minuit — un tour de Claude à chaque fois, la file de Claude prise, l'historique noyé, le client
  // jamais prévenu). Après le dernier essai du soir (le troisième, ou le dernier avant minuit) : UN message au client
  // (lectureRatee, avec « عاود دروك », valable ce soir-là seulement). Le soir d'après, tout repart normalement.
  // « suivre maintenant » (le bureau) et « عاود دروك » (le client) ne sont pas bornés.
  const LECTURES_PAR_SOIR = 3;
  const delaiLecture = () => deps.delaiLectureMs ?? 20 * 60000;
  async function suivreJour(m, { manuel = false } = {}) {
    if (enMarche.has(m.id)) return; enMarche.add(m.id);
    const S = m.d.suivi = m.d.suivi || { jours: [], cumul: null, hausses: [], production: false };
    const aujourdhui = jourLocal();
    try {
      const rep = m.demande.reponses, cts = R().couts || {}, dcl = R().declare || {}, taux = +R().taux || 0;
      const jour = Math.max(1, Math.floor((Date.now() - Date.parse(m.d.lanceLe)) / 86400000) + 1);
      const c = m.d.campagne, sc = S.scale?.campagne || null; // sc : la campagne de SCALE (CBO), dès qu'elle existe
      const r = await tourClaude(m, 'lecture', { dept: 'coach', outils: ['tassyir.list_orders', 'tassyir.get_order', 'tassyir.get_order_stats', 'tassyir.list_order_tracking', 'tassyir.list_returns', 'tassyir.get_product', 'tassyir.get_inventory', 'tassyir.get_variant_analytics', 'tassyir.get_marketing_analytics', 'meta.ads_get_ad_entities'],
        schema: { type: 'object', properties: {
          commandes: { type: 'integer' }, confirmees: { type: 'integer' }, expediees: { type: 'integer' }, livrees: { type: 'integer' }, retours: { type: 'integer' }, annulees: { type: 'integer' },
          stock: { type: 'integer' }, confirmees_par_couleur: { type: 'array', items: { type: 'object', properties: { couleur: { type: 'string' }, n: { type: 'integer' } }, required: ['couleur', 'n'] } },
          depense_totale: { type: 'number' }, depense_jour: { type: 'number' }, devise: { type: 'string' }, conversations: { type: 'integer' }, budget_jour_actuel: { type: 'number' }, test_actif: { type: 'boolean' },
          depense_test: { type: 'number' }, depense_scale: { type: 'number' }, scale_budget_jour: { type: 'number' }, scale_actif: { type: 'boolean' }, erreur: { type: 'string' },
          // 0.4.2 : les QUATRE CONTRÔLES avant le verdict (facultatif : une lecture impossible ne bloque pas le rapport)
          suivi: { type: 'object', properties: {
            annonces: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' }, depense: { type: 'number' }, achats_meta: { type: 'integer' }, visites_tassyir: { type: 'integer' }, commandes_tassyir: { type: 'integer' }, confirmees_tassyir: { type: 'integer' }, livrees_tassyir: { type: 'integer' } }, required: ['id', 'depense'] } },
            commandes_liees: { type: 'integer' }, depense_tassyir_usd: { type: ['number', 'null'] }, valeurs_utm: { type: 'array', items: { type: 'string' } }, erreur: { type: 'string' } } } },
          required: ['commandes', 'confirmees', 'expediees', 'livrees', 'retours', 'depense_totale', 'devise', ...(sc ? ['depense_test', 'depense_scale', 'scale_budget_jour'] : [])] },
        message: `LECTURE DU SOIR (jour ${jour} du test, lancé le ${m.d.lanceLe.slice(0, 10)}). Tu LIS seulement, tu ne modifies rien.
Tassyir — produit ${m.d.produit.productId} (boutique ${m.d.produit.storeId}) : compte SES commandes depuis le ${m.d.lanceLe.slice(0, 10)} (toutes les pages de list_orders) :
- commandes = toutes, quel que soit le statut ; confirmees = confirmées + parties + livrées + retournées ; expediees = parties + livrées + retournées ;
- livrees ; retours (list_returns aussi) ; annulees ; stock = la somme du stock de ses variantes (get_product / get_inventory) ;
- confirmees_par_couleur = les confirmées par couleur de variante.
Meta — campagne ${c.id}${sc ? ` (le test) ET campagne ${sc.id} (la scale, CBO)` : ''} : la dépense TOTALE depuis le lancement et celle d'aujourd'hui (ads_get_ad_entities, amount_spent, time_range), dans la devise du compte${sc ? ` — les DEUX campagnes additionnées ; depense_test et depense_scale = la dépense totale de chacune, lue à part` : ''} ; budget_jour_actuel = la somme des daily_budget des ad sets du TEST, en unités (pas en centimes) ; test_actif = le statut effectif (effective_status) de la campagne ${c.id} est ACTIVE${sc ? ` ; scale_budget_jour = le daily_budget de la CAMPAGNE ${sc.id} (CBO : le budget est sur la campagne), en unités ; scale_actif = son effective_status est ACTIVE` : ''}${rep.mode === 'message' ? ' ; conversations = les discussions ouvertes depuis le lancement' : ''}.
LES CONTRÔLES (« suivi », 0.4.2) — Meta : chaque ANNONCE de la campagne ${c.id} depuis le lancement (ads_get_ad_entities level ad : id, name, amount_spent, les achats « purchase » du pixel) → suivi.annonces [{id, nom, depense, achats_meta}]. Tassyir : get_marketing_analytics depuis le ${m.d.lanceLe.slice(0, 10)} SANS storeId (avec storeId la dépense est cachée) : sous facebook / instagram, le nœud de la campagne ${c.id} et ses contenus (les annonces, par leur id) → visites_tassyir, commandes_tassyir, confirmees_tassyir et livrees_tassyir de chaque annonce (0 si l'annonce n'y est pas), suivi.commandes_liees = les commandes de ce nœud campagne, suivi.depense_tassyir_usd = la dépense que Tassyir montre pour ce nœud (null si elle n'y est pas), suivi.valeurs_utm = les valeurs de campagne et de contenu de ce nœud TELLES QUE Tassyir les écrit, plus toute valeur qui contient « {{ » ou « CAMPAIGN ». Lecture impossible : suivi.erreur.
Rends les nombres EXACTS lus ; si une lecture est impossible, mets la réponse brute dans « erreur ».` });
      const x = r.structure;
      // contrôle intégré (2e méthode) : les nombres doivent tenir debout, et la dépense doit être dans la réponse brute de Meta
      const fautes = [];
      if (!(x.commandes >= x.confirmees && x.confirmees >= x.expediees && x.expediees >= x.livrees + x.retours)) fautes.push(`nombres impossibles : ${x.commandes} ≥ ${x.confirmees} ≥ ${x.expediees} ≥ ${x.livrees} + ${x.retours}`);
      const brutMeta = appelsDe(r, 'ads_get_ad_entities').map(a => a.sortie).join(' ');
      if (!sc && x.depense_totale > 0 && !brutMeta.includes(String(x.depense_totale)) && !brutMeta.includes(x.depense_totale.toFixed(2)) && !brutMeta.includes(String(Math.round(x.depense_totale * 100)))) fautes.push(`dépense ${x.depense_totale} introuvable dans la réponse brute de Meta`);
      // avec la scale : chaque campagne est lue à part (chacune dans la réponse brute) et le total est LEUR somme
      if (sc) {
        for (const [k, v] of [['test', x.depense_test], ['scale', x.depense_scale]]) if (!(v >= 0)) fautes.push(`dépense du ${k} absente`); else if (v > 0 && !dansBrut(brutMeta, v)) fautes.push(`dépense du ${k} ${v} introuvable dans la réponse brute de Meta`);
        if (Math.abs((x.depense_test || 0) + (x.depense_scale || 0) - x.depense_totale) > 0.01) fautes.push(`dépense totale ${x.depense_totale} ≠ test ${x.depense_test} + scale ${x.depense_scale}`);
        if (x.scale_budget_jour > 0 && !dansBrut(brutMeta, x.scale_budget_jour) && !dansBrut(brutMeta, Math.round(x.scale_budget_jour * 100))) fautes.push(`budget de la scale ${x.scale_budget_jour} introuvable dans la réponse brute de Meta`);
      }
      if (fautes.length) throw new Error('lecture refusée par le contrôle intégré : ' + fautes.join(' ; '));
      // 0.4.2 : les quatre contrôles avant le verdict — seulement sur des nombres RETROUVÉS dans les réponses brutes
      const ctrl = controlesDuSoir(r, x, taux);
      if (ctrl) S.controles = { date: aujourdhui, ...ctrl };
      const enRoute = x.expediees - x.livrees - x.retours;
      const vers = v => (String(x.devise).toUpperCase() === 'DZD' ? v : v * taux);
      const depenseDa = vers(x.depense_totale);
      // le carnet : les FLUX du jour (différence avec la lecture précédente), et l'état « en route » de ce soir
      const avant = S.cumul || { commandes: 0, confirmees: 0, expediees: 0, livrees: 0, retours: 0, depense_da: 0 };
      const flux = k => Math.max(0, (k === 'depense_da' ? depenseDa : x[k]) - (avant[k] || 0));
      await outilCarnet(m, 'carnet-mesure', ['--mesure', '--date', aujourdhui, '--produit', m.code, '--depense', Math.round(flux('depense_da')), '--commandes', flux('commandes'), '--confirmees', flux('confirmees'), '--expediees', flux('expediees'), '--livrees', flux('livrees'), '--refusees', flux('retours'), '--en-route', Math.max(0, enRoute)]);
      // la lecture du testing : les seuils du mode, la BASE de la réponse « السلعة » (règle du vendeur, 08/10/2026) — sans
      // stock les confirmées, avec stock les livrées + en route à trente pour cent + confirmées pas encore parties au taux
      // déclaré, contre le break even par livrée. Une mission d'avant, sans réponse, vaut « test ».
      const stock = rep.stock === 'stock' ? 'stock' : 'test';
      const lect = await outil(m, 'lecture', '3-TESTING/manita-testing.py', ['--lecture', '--mode', rep.mode, '--stock', stock, '--jour', jour, '--spend', x.depense_totale, '--devise', x.devise, '--taux-dinar', taux, '--commandes', x.commandes, '--confirmees', x.confirmees,
        '--livrees', x.livrees, '--expediees', x.expediees, '--en-route', Math.max(0, enRoute), '--retours', x.retours,
        '--prix', rep.detail, '--cout-produit', rep.gros, '--emballage', cts.emballage, '--livraison', cts.livraison, '--frais-cod', cts.fraisCod || 0, '--cout-retour', cts.retour, '--taux-confirmation', (+dcl.confirmation / 100).toFixed(4), '--taux-livraison', (+dcl.livraison / 100).toFixed(4), ...(rep.mode === 'message' ? ['--messages', x.conversations || 0] : [])], { dureeMaxMs: 60000 });
      const L = jsonOutil(lect, 'lecture') || {};
      const jourS = { date: aujourdhui, jour, ...x, en_route: enRoute, depense_da: Math.round(depenseDa), decision: L.decision || '?', stock, base: L.base ?? null };
      S.jours.push(jourS); S.cumul = { commandes: x.commandes, confirmees: x.confirmees, expediees: x.expediees, livrees: x.livrees, retours: x.retours, depense_da: depenseDa }; S.dernierJour = aujourdhui; sauver(m);
      const DECISION_AR = { DONNEES_INSUFFISANTES: 'مازال ما كاينش بزاف كوموندات باش نحكمو', RENTABLE: 'الكوموند تكلّف أقل من الحد تاعك، مليح', PERTE_LEGERE: 'راك تخسر شوية في كل كوموند، نشوفو غدوة', PERTE_LOURDE: 'راك تخسر بزاف في كل كوموند', CORRIGER_UNE_CREA: 'تصرف وما تجيبش، لازم نبدّلو الفيديو', DISJONCTEUR: 'صرفت بزاف بلا حتى كوموند مأكدة', TROP_TOT: 'مازال بكري باش نحكمو، نستناو' };
      // avec stock on juge le COLIS attendu ; sous une livraison attendue, ce n'est jamais une perte
      if (stock === 'stock') Object.assign(DECISION_AR, { DONNEES_INSUFFISANTES: 'مازال ما كاينش بزاف كوليات باش نحكمو', RENTABLE: 'الكولي يكلّف أقل من الحد تاعك، مليح', PERTE_LEGERE: 'راك تخسر شوية في كل كولي، نشوفو غدوة',
        PERTE_LOURDE: L.cout_par_commande > 0 ? 'راك تخسر بزاف في كل كولي' : 'ما كاين حتى كولي نستناوه يوصل' });
      const decisionAr = L.pourquoi === 'base attendue sous une livraison' ? 'الكوليات لي نستناو أقل من كولي، مازال ما نحكموش، ماشي خسارة' : DECISION_AR[L.decision];
      await envoyer(m, M.rapportJour({ depense_da: depenseDa, commandes: x.commandes, confirmees: x.confirmees, livrees: x.livrees, retours: x.retours, stock, base: L.base, decision_ar: decisionAr || 'ما قدرتش نحكم اليوم' }, taux));
      // 0.4.2 : les contrôles qui ne passent pas partent juste après le rapport (le verdict du MODÈLE reste sur les commandes
      // du produit dans Tassyir ; ce sont les verdicts PAR VIDÉO qui attendent des chiffres complets)
      if (ctrl && ctrl.alertes.length) { const t = messageControles(ctrl); if (t) await envoyer(m, { texte: t }); histoire(m, `contrôles du soir : ${ctrl.alertes.map(a => `${a.id} (${a.detail})`).join(' · ')}`); }
      // 0.4.2 : LA BIBLIOTHÈQUE DES CRÉAS — le jour du verdict (72 h) puis chaque semaine, une ligne par vidéo (sa fiche de
      // l'éditeur + ce que Tassyir dit de SON annonce) ; seulement quand les contrôles laissent juger les vidéos
      const jv = JOUR_VERDICT[rep.mode] || 3;
      if (ctrl && ctrl.verdictPermis && jour >= jv && (jour - jv) % 7 === 0 && S.biblioJour !== jour) {
        const lignes = lignesBibliotheque(m, x, r, taux, jour, stock === 'stock' ? 'VALIDE' : 'TEST', aujourdhui);
        if (lignes.length) {
          ajouterLignes(maison, lignes); S.biblioJour = jour; sauver(m);
          histoire(m, `bibliothèque des créas : ${lignes.length} vidéo(s) notée(s) (${lignes.map(l => `${l.adset || l.ad_id} ${l.statut}`).join(', ')})`);
          if (jour > jv) for (const et of ['mannequin', 'angle']) { const rs = resumeParEtiquette(lireBibliotheque(maison), et); if (rs.length >= 2) await envoyer(m, { texte: messageBibliotheque(rs, et) }); }
        }
      }
      if (L.decision === 'DISJONCTEUR') {
        // la pause est RELUE dans les appels bruts (seulement les objets de cette mission, seulement status PAUSED, chaque
        // campagne servie) : une pause qui n'est pas passée n'est jamais annoncée comme faite
        let p;
        try {
          const rp = await tourClaude(m, 'pause', { dept: 'testing', outils: ['meta.ads_update_entity', 'meta.ads_get_ad_entities'], schema: { type: 'object', properties: { statut: { type: 'string' }, erreur: { type: 'string' } }, required: ['statut'] },
            message: `DISJONCTEUR de l'outil (dépense sans aucune confirmée) : mets en PAUSE la campagne ${c.id}${sc ? ` ET la campagne de scale ${sc.id}` : ''} (ads_update_entity entity_type "campaign", fields {"status":"PAUSED"}, rien d'autre ; même une campagne déjà en pause reçoit sa pause : le bureau la relit), relis ${sc ? 'leurs statuts' : 'son statut'}, rends {statut}. Ne touche à aucun autre objet.` });
          p = relirePause(m, rp, [c.id, sc?.id]);
        } catch (e) { p = { fautes: [`la pause n'est pas passée, mets la pub en pause dans Meta : ${e.message}`], pausee: false }; }
        // la mission s'arrête : une question ouverte (une hausse, une perte) se ferme avec elle — son vieux bouton ne fait plus rien
        m.etat = 'arretee'; m.attente = null; S.hausseDemandee = null; histoire(m, p.fautes.length ? `disjoncteur : pause relue — ${p.fautes.join(' ; ')}` : 'disjoncteur : publicité mise en pause'); sauver(m);
        if (p.pausee) await envoyer(m, M.disjoncteur());
        if (p.fautes.length) await envoyer(m, M.echec(m.id, 'حبس البوب', p.fautes[0])); // « حبس » refait la pause
        return;
      }
      if (L.decision === 'PERTE_LOURDE' && !S.perteDemandee) { S.perteDemandee = aujourdhui; m.attente = 'perte';
        // ce que le client SAIT quand il répond (le carnet le note avec sa décision)
        S.perteVue = { date: aujourdhui, depense_da: Math.round(depenseDa), commandes: x.commandes, confirmees: x.confirmees, livrees: x.livrees, stock, cout: Math.round(L.cout_par_commande || 0), limite: Math.round(L.repere || m.d.be.par_commande || 0) }; sauver(m); await envoyer(m, M.perteLourde(m.id, L.cout_par_commande || 0, L.repere || m.d.be.par_commande, taux, stock)); }
      // le coach : à partir du jour du verdict (le TROISIÈME dans les deux modes, règle du vendeur), dès qu'il y a des colis partis
      const jourVerdict = JOUR_VERDICT[rep.mode] || 3;
      if (jour >= jourVerdict && x.expediees > 0 && x.livrees > 0) await coachEtScaling(m, x, depenseDa, jour);
    } catch (e) {
      // la limite d'usage de Claude, ou un connecteur à reconnecter : la lecture ATTEND, aucun essai du soir consommé, un seul
      // message ; elle repart toute seule (la limite passée : l'horloge ; le connecteur revenu : la sonde)
      if (e && (e.quota || e.connecteur) && S.dernierJour !== aujourdhui) {
        if (e.quota) { S.attenteQuota = maintenant(); histoire(m, `suivi du ${aujourdhui} : limite d'usage de Claude — la lecture attend, aucun essai perdu`); sauver(m); await prevenirQuota(); }
        else { S.attenteConnecteur = { cles: clesDe(e), depuis: maintenant() }; histoire(m, `suivi du ${aujourdhui} : connecteur à reconnecter (${S.attenteConnecteur.cles.join(', ')}) — la lecture attend, aucun essai perdu`); sauver(m); await signalerConnecteur(S.attenteConnecteur.cles, m); }
        return;
      }
      histoire(m, `suivi du ${aujourdhui} : ÉCHEC — ${e.message}`); S.dernierEchec = { date: aujourdhui, erreur: e.message };
      // la LECTURE n'est pas faite (une panne APRÈS la lecture — coach, scaling — ne compte pas : le rapport est parti)
      if (S.dernierJour !== aujourdhui) {
        const ess = S.essaisLecture = S.essaisLecture?.date === aujourdhui ? S.essaisLecture : { date: aujourdhui, n: 0 };
        ess.n += 1; ess.dernier = maintenant();
        // le client est prévenu au DERNIER essai possible du soir : le troisième, ou plus tôt quand le prochain tomberait
        // après minuit (07/10/2026, « casse » : une heure du rapport tardive, 23:30, ou un PC allumé tard ne laissaient que
        // un ou deux essais — le client n'était jamais prévenu) ; et toujours quand il a demandé la lecture (« عاود دروك »)
        const plusLeTemps = jourLocal(new Date(Date.now() + delaiLecture())) !== aujourdhui;
        const demandee = manuel || !!ess.demandee;
        const dire = demandee || (!ess.prevenu && (ess.n >= LECTURES_PAR_SOIR || plusLeTemps));
        delete ess.demandee;
        if (dire) ess.prevenu = maintenant();
        sauver(m);
        if (dire) { histoire(m, `lecture du ${aujourdhui} : ${ess.n} essai(s) ratés${demandee ? ' (demandée par le client)' : ''}, le client est prévenu`); sauver(m); try { await envoyer(m, M.lectureRatee(m.id, e.message, { essais: ess.n, demandee })); } catch (x) { journal('telegram : ' + x.message); } }
      } else sauver(m);
    }
    finally { enMarche.delete(m.id); }
  }
  async function coachEtScaling(m, x, depenseDa, jour) {
    const S = m.d.suivi, rep = m.demande.reponses, cts = R().couts || {}, taux = +R().taux || 0;
    // le break even avec les taux MESURÉS (un taux mesuré écrase un taux déclaré)
    const tConf = x.confirmees / Math.max(1, x.commandes), tLiv = (x.livrees + Math.max(0, x.expediees - x.livrees - x.retours) * 0.3) / Math.max(1, x.expediees);
    const be = jsonOutil(await outil(m, 'coach-break-even', '5-COACH-ERP/manita-coach.py', ['--break-even', '--prix', rep.detail, '--cout-produit', rep.gros, '--emballage', cts.emballage, '--livraison', cts.livraison, '--frais-cod', cts.fraisCod || 0, '--cout-retour', cts.retour, '--declare-confirmation', tConf.toFixed(4), '--declare-livraison', Math.max(0.01, Math.min(1, tLiv)).toFixed(4), '--devise', 'DZD'], { dureeMaxMs: 60000 }), 'break_even');
    if (!be) return histoire(m, 'coach : break even mesuré illisible');
    const porte = jsonOutil(await outil(m, 'coach-porte', '5-COACH-ERP/manita-coach.py', ['--porte', '--commandes', x.commandes, '--confirmees', x.confirmees, '--expediees', x.expediees, '--livrees', x.livrees, '--retours', x.retours, '--stock', x.stock || 0,
      '--be-livree', be.par_livree.toFixed(2), '--cout-livree', (depenseDa / Math.max(1, x.livrees)).toFixed(2), '--devise-depenses', 'DZD', '--devise', 'DZD'], { dureeMaxMs: 60000 }), 'porte');
    S.porte = porte ? { date: jourLocal(), ouverte: !!porte.ouverte, controles: porte.controles || null } : null;
    // pas de stock : la porte reste fermée par le stock → le coach donne le bon de l'atelier, une fois
    if (!(x.stock > 0) && !S.production && (x.confirmees_par_couleur || []).length) {
      const bon = jsonOutil(await outil(m, 'coach-bon', '5-COACH-ERP/manita-coach.py', ['--bon-de-commande', '--par-reference', x.confirmees_par_couleur.filter(k => k.n > 0).map(k => `${String(k.couleur).replace(/[:,]/g, ' ')}:${k.n}`).join(','), '--devise', 'DZD'], { dureeMaxMs: 60000 }), 'bon_de_commande');
      if (bon && bon.porte_production && bon.porte_production.ouverte) { S.production = jourLocal(); sauver(m); await envoyer(m, M.production(bon.bon.lignes || [], !!bon.bon.plate)); }
    }
    // une hausse demandée par une version d'avant (sur les AD SETS du test) : la règle a changé (06/10/2026), le scaling
    // passe par la campagne de SCALE. Elle n'est plus posée et ne bloque plus rien (son vieux bouton : « هاذ السؤال فات »).
    if (S.hausseDemandee && !S.hausseDemandee.campagne) { histoire(m, 'hausse d\'avant (sur les ad sets du test) abandonnée : le scaling passe par la campagne de scale (CBO)'); S.hausseDemandee = null; if (m.attente === 'monte') m.attente = null; }
    // une question attend déjà le client (une hausse, une perte lourde) : rien de neuf ce soir
    if (!porte || !porte.ouverte || !(x.stock > 0) || S.hausseDemandee || m.attente) return sauver(m);
    // la porte est ouverte et il y a du stock : le plafond du stock (borné par le break even), puis la campagne de SCALE
    const coutCmd = depenseDa / Math.max(1, x.commandes);
    const plaf = jsonOutil(await outil(m, 'scaling-plafond', '4-SCALING/manita-scaling.py', ['--plafond-stock', '--stock', x.stock, '--jours-reappro', R().joursReappro || 7, '--taux-confirmation', tConf.toFixed(4), '--cout-commande', coutCmd.toFixed(2), '--be-commande', be.par_commande.toFixed(2), '--devise-depenses', 'DZD', '--devise', 'DZD'], { dureeMaxMs: 60000, env: { MANITA_DOSSIER_SCALING: path.join(dossier(m), 'testing') } }), 'plafond_stock');
    if (!plaf || !plaf.rentable || !(plaf.budget_max_da >= (plaf.plancher_jour_da || 0))) return sauver(m);
    const enDa = v => (String(x.devise).toUpperCase() === 'DZD' ? v : v * taux);
    // le test qui tourne encore vend le MÊME stock : son budget du jour sort du plafond avant la scale
    const budgetTestDa = x.test_actif === false ? 0 : x.budget_jour_actuel ? enDa(x.budget_jour_actuel) : (m.d.budget?.total_usd || 0) * taux;
    const sc = S.scale;
    // pas encore de scale (ou un essai d'un autre soir resté en route) : le gagnant, son départ, sa campagne EN PAUSE
    // une scale EN COURS DE PUBLICATION (relue par l'horloge) ou REFUSÉE par Meta n'est jamais refaite le soir (pas de 2e scale)
    if (!sc || (!['creee', 'lancee', 'publication', 'rejetee'].includes(sc.etat) && sc.date !== jourLocal())) return proposerScale(m, x, be, plaf, coutCmd, budgetTestDa);
    if (sc.etat !== 'lancee') {
      // créée EN PAUSE : elle attend le « لانسي » du client. Un « لانسي » refusé porte fermée (sc.fermee) : la porte
      // s'est rouverte, la question repart, une fois
      if (sc.etat === 'creee' && sc.fermee && sc.campagne) {
        delete sc.fermee; histoire(m, 'scale : la porte s\'est rouverte, la question « لانسي » repart'); sauver(m);
        const k = sc.campagne; await envoyer(m, M.scalePrete(m.id, k.devise === 'DZD' ? k.budget_centimes / 100 / taux : k.budget_centimes / 100, taux, k.adSets.length));
      }
      return sauver(m);
    }
    // la scale tourne : la hausse porte sur le budget de sa CAMPAGNE (CBO), +20 à 30 % (l'outil choisit sur la marge
    // mesurée), 72 h après son lancement puis 48 h entre deux, bornée par le stock (le test servi d'abord) et le break even
    if (x.scale_actif === false) { histoire(m, 'scale : sa campagne n\'est pas active dans Meta ce soir (en pause ?), pas de hausse'); return sauver(m); }
    if (!(x.scale_budget_jour > 0)) { histoire(m, 'scale : le budget de sa campagne ne se lit pas ce soir, pas de hausse'); return sauver(m); }
    const budgetDa = Math.round(enDa(x.scale_budget_jour)); // ce que l'outil reçoit : sa hausse se rapporte à CE nombre
    const ech = jsonOutil(await outil(m, 'scaling-echelle', '4-SCALING/manita-scaling.py', ['--echelle', '--budget-actuel', budgetDa, '--plafond', (plaf.budget_max_da - budgetTestDa).toFixed(2), '--date-lancement', heureLocale(sc.lanceLe), '--hier', hierRentable(S, coutCmd, be.par_commande) ? 'rentable' : 'perte', '--be-commande', be.par_commande.toFixed(2), '--cout-commande', coutCmd.toFixed(2), '--devise-depenses', 'DZD', '--devise', 'DZD'], { dureeMaxMs: 60000, env: { MANITA_DOSSIER_SCALING: path.join(dossier(m), 'testing') } }), 'echelle');
    if (!ech || !ech.autorise || !ech.propose_da) return sauver(m);
    // le nouveau budget dans la plus petite unité de la devise du compte, arrondi en dessous (jamais plus que l'outil)
    const deC = Math.round(x.scale_budget_jour * 100), versC = Math.floor(deC * ech.propose_da / budgetDa + 1e-6);
    if (!(versC > deC)) return sauver(m);
    S.hausseDemandee = { date: jourLocal(), campagne: sc.campagne.id, de_da: Math.round(budgetDa), vers_da: Math.round(ech.propose_da), de_centimes: deC, vers_centimes: versC, hausse: ech.hausse || null }; m.attente = 'monte'; sauver(m);
    await envoyer(m, M.porteScaling(m.id, budgetDa / taux, ech.propose_da / taux, taux, versC));
  }
  /** « Hier » pour --echelle : la dépense et les commandes de la DERNIÈRE journée lue (la différence avec le dernier soir
   *  d'un AUTRE jour : une deuxième lecture le même jour, « suivre maintenant », ne fait pas une journée de quelques
   *  heures). Une journée qui a dépensé sans une commande est une perte. Sans deux soirs, le coût depuis le lancement. */
  function hierRentable(S, coutCmd, beCommande) {
    const j = S.jours || [], a = j[j.length - 1], b = a ? [...j].reverse().find(k => k.date && k.date < a.date) : null;
    if (!a || !b) return coutCmd <= beCommande;
    const dep = (a.depense_da || 0) - (b.depense_da || 0), cmd = (a.commandes || 0) - (b.commandes || 0);
    if (!(dep > 0)) return coutCmd <= beCommande;
    return cmd > 0 && dep / cmd <= beCommande;
  }
  /** Une date ISO en heure LOCALE « AAAA-MM-JJ HH:MM » : l'outil compte les 72 h et les 48 h sur l'horloge du PC. */
  const heureLocale = iso => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' '); };
  /** La clé de la campagne de scale : tirée de celle du test, mais SANS la contenir (chercher la clé du test ne doit
   *  jamais trouver la scale, et l'inverse). */
  const cleScale = m => crypto.createHash('sha256').update('scale|' + (m.d.noms?.cle || m.id)).digest('hex').slice(0, 12).toUpperCase();
  const placementsDe = rep => (rep.placements === 'broad' ? 'automatiques (Advantage+ placements)' : 'publisher_platforms ["facebook","instagram"], instagram_positions ["story","reels"], facebook_positions ["story","facebook_reels"]');

  /** LA CAMPAGNE DE SCALE (règle du vendeur, 06/10/2026). Le gagnant du test — choisi par l'OUTIL sur les annonces lues
   *  dans Meta — entre dans une campagne DÉDIÉE, en CBO, de un à trois ad sets broad (l'outil : autant que le stock le
   *  porte), l'annonce gagnante RECRÉÉE sur son post ID (object_story_id) : elle garde commentaires et historique. Jamais
   *  une campagne dupliquée, aucun plafond. Tout naît EN PAUSE ; le client la lance (« لانسي »). Un soir sans gagnant ou
   *  sans stock : rien n'est créé, on relit le lendemain. */
  async function proposerScale(m, x, be, plaf, coutCmd, budgetTestDa) {
    const S = m.d.suivi, c = m.d.campagne, rep = m.demande.reponses, taux = +R().taux || 0, date = jourLocal();
    const compte = String(rep.compte?.id || '').replace(/^act_/, '');
    const env = { MANITA_DOSSIER_SCALING: path.join(dossier(m), 'testing') };
    // l'essai d'un autre soir : son départ NOTÉ avant la création (plan) se reprend tel quel — une coupure en pleine
    // création a pu laisser chez Meta une campagne à compléter avec CE gagnant et CE nombre d'ad sets, pas ceux de ce soir
    const avant = S.scale || null; let echecs = avant?.echecs || 0;
    let plan = avant && ['preparation', 'creation', 'echec', 'attente'].includes(avant.etat) ? avant.plan || null : null;
    // trois échecs de suite sur le même départ (un post supprimé, un refus de Meta qui ne passe pas) : on repart de la
    // lecture ; une campagne laissée à moitié avec un autre post sera alors refusée à la relecture, et le client le saura
    if (plan && avant.etat === 'echec' && echecs >= 3) { histoire(m, `scale : ${echecs} échecs sur le départ noté le ${plan.date}, on repart de la lecture des annonces`); plan = null; echecs = 0; }
    const garder = o => ({ ...o, ...(plan ? { plan } : {}), ...(echecs ? { echecs } : {}) });
    S.scale = garder({ etat: 'preparation', date }); sauver(m);
    const attendre = raison => { S.scale = garder({ etat: 'attente', date, raison }); histoire(m, 'scale : ' + raison); sauver(m); };
    // la devise des budgets est celle du COMPTE (lue à l'étape budget) : un « DZD » écrit par un tour de Claude sur un
    // compte en dollars ferait une campagne cent fois trop chère, et le contrôle du budget le recopierait
    const deviseCompte = String(m.d.budget?.devise || rep.compte?.devise || '').toUpperCase();
    try {
      // les mêmes wilayas que le test : celles que le client a confirmées (jamais tout le pays) — sinon rien ne part
      const cib = ciblageWilayas(R().ciblage);
      if (cib.faute) throw Object.assign(new Error(`ciblage : ${cib.faute} — la scale n'est pas créée`), { client: M.wilayasManquentScale() });
      if (plan) {
        // le départ noté se reprend, mais le stock et le break even de CE soir le bornent toujours
        if (!(coutCmd < be.par_commande)) return attendre('pas de scale : la commande coûte plus que le break even');
        if (plan.budget_da > plaf.budget_max_da - budgetTestDa + 1) return attendre(`pas de scale : le stock (le test servi) ne porte plus le départ noté (${plan.budget_da} DA par jour)`);
        histoire(m, `scale : reprise du départ noté le ${plan.date} (annonce ${plan.gagnant.ad_id}, post ${plan.story}, ${plan.n} ad set(s), ${plan.centimes} centimes)`);
      } else {
        // 1. LIRE chaque annonce du test : sa dépense, ses résultats, et le POST de sa créa
        const ids = (c.ads || []).map(a => String(a.id));
        const r = await tourClaude(m, 'gagnant', { dept: 'scaling', outils: ['meta.ads_get_ad_entities', 'meta.ads_get_creatives', 'meta.ads_get_field_context'],
          schema: { type: 'object', properties: { annonces: { type: 'array', items: { type: 'object', properties: { ad_id: { type: 'string' }, ad_set_id: { type: 'string' }, depense: { type: 'number' }, resultats: { type: 'integer' }, creative_id: { type: 'string' }, story_id: { type: 'string' }, instagram_media_id: { type: 'string' } }, required: ['ad_id', 'depense', 'resultats', 'story_id'] } }, devise: { type: 'string' }, erreur: { type: 'string' } }, required: ['annonces', 'devise'] },
          message: `LECTURE DES ANNONCES DU TEST pour choisir le gagnant (tu LIS seulement, tu ne modifies rien). Compte ${compte}, campagne de test ${c.id}, annonces ${JSON.stringify(ids)}.
1. ads_get_ad_entities level "ad", object_ids = ces annonces, time_range depuis le ${m.d.lanceLe.slice(0, 10)} jusqu'à aujourd'hui : pour chacune la dépense (amount_spent, devise du compte), les résultats (results : ${rep.mode === 'site' ? 'les achats du pixel' : 'les conversations commencées'}), son ad set et sa créa (vérifie les noms exacts des champs avec ads_get_field_context).
2. ads_get_creatives sur ces créas, fields ["effective_object_story_id","object_story_id","effective_instagram_media_id"] : story_id = effective_object_story_id (le POST de l'annonce, « <page>_<post> »), à défaut object_story_id.
Rends {annonces:[{ad_id, ad_set_id, depense, resultats, creative_id, story_id, instagram_media_id}], devise} avec les valeurs EXACTES lues ; une lecture impossible : la réponse brute dans « erreur ».` });
        const ann = r.structure.annonces || [], deviseLue = String(r.structure.devise || '').toUpperCase();
        if (deviseCompte && deviseLue && deviseLue !== deviseCompte) throw new Error(`devise lue ${deviseLue} au lieu de celle du compte ${deviseCompte} : lecture des annonces refusée`);
        const devise = deviseCompte || deviseLue || 'USD';
        // 2e méthode : chaque annonce est une annonce de CE test, toutes sont lues, et chaque dépense est dans la réponse brute
        const brut = appelsDe(r, 'ads_get_ad_entities').map(a => a.sortie).join(' ');
        for (const a of ann) {
          if (!ids.includes(String(a.ad_id))) throw new Error(`l'annonce ${a.ad_id} n'est pas une annonce de ce test`);
          if (a.depense > 0 && !dansBrut(brut, a.depense)) throw new Error(`dépense ${a.depense} de l'annonce ${a.ad_id} introuvable dans la réponse brute de Meta`);
        }
        const manquent = ids.filter(id => !ann.some(a => String(a.ad_id) === id));
        if (manquent.length) throw new Error(`annonce(s) du test non lue(s) : ${manquent.join(', ')}`);
        // 2. l'OUTIL choisit le gagnant (le résultat le moins cher, sur assez de résultats)
        const g = jsonOutil(await outil(m, 'scaling-gagnant', '4-SCALING/manita-scaling.py', ['--gagnant', '--annonces', ann.map(a => `${a.ad_id}:${a.resultats}:${a.depense}`).join(','), '--devise-depenses', devise, ...(devise === 'DZD' ? [] : ['--taux-dinar', taux]), '--devise', 'DZD'], { dureeMaxMs: 60000, env }), 'gagnant');
        if (!g) throw new Error('l\'outil du scaling ne rend pas le gagnant (journal scaling-gagnant)');
        if (!g.autorise) return attendre(`pas encore de gagnant : il manque ${g.manque} résultat(s) à la meilleure annonce`);
        const w = ann.find(a => String(a.ad_id) === String(g.gagnant.code)), story = String(w?.story_id || '').trim();
        if (!/^\d+_\d+$/.test(story)) throw new Error(`le post de l'annonce gagnante ${g.gagnant.code} est illisible (${story || 'absent'})`);
        if (!contient(r, 'ads_get_creatives', story) && !contient(r, 'ads_get_ad_entities', story)) throw new Error(`le post ${story} n'apparaît dans aucune réponse brute de Meta`);
        const pageId = String(c.page || rep.page?.id || '');
        if (pageId && story.split('_')[0] !== pageId) throw new Error(`le post ${story} n'est pas un post de la page ${pageId}`);
        // 3. l'OUTIL dit combien d'ad sets et quel budget de CAMPAGNE : le budget du gagnant au test, le stock, le break even
        const budgetGagnantDa = (devise === 'DZD' ? 1 : taux) * (+m.d.budget?.centimes_par_ad_set || 0) / 100;
        const dep = jsonOutil(await outil(m, 'scaling-depart', '4-SCALING/manita-scaling.py', ['--depart-scale', '--budget-gagnant', budgetGagnantDa.toFixed(2), '--budget-test', budgetTestDa.toFixed(2), '--plafond', plaf.budget_max_da.toFixed(2), '--be-commande', be.par_commande.toFixed(2), '--cout-commande', coutCmd.toFixed(2), '--devise-depenses', 'DZD', '--devise', 'DZD'], { dureeMaxMs: 60000, env }), 'depart_scale');
        if (!dep) throw new Error('l\'outil du scaling ne rend pas le départ de la scale (journal scaling-depart)');
        if (!dep.autorise) return attendre(dep.pourquoi === 'PERTE' ? 'pas de scale : la commande coûte plus que le break even' : 'pas de scale : le stock (le test servi) ne la porte pas');
        const n = dep.ad_sets, centimes = Math.floor((devise === 'DZD' ? dep.budget_campagne_da : dep.budget_campagne_da / taux) * 100 + 1e-6);
        if (!(n >= 1 && n <= 3) || !(centimes > 0)) throw new Error(`départ de la scale impossible : ${n} ad set(s), ${centimes} centimes`);
        // le départ est NOTÉ avant que rien ne parte chez Meta : une coupure pendant la création le reprend tel quel
        plan = { date, cle: cleScale(m), story, n, centimes, devise, budget_da: Math.round(dep.budget_campagne_da),
          gagnant: { ad_id: String(w.ad_id), ad_set_id: w.ad_set_id || null, instagram_media_id: w.instagram_media_id || null, resultats: g.gagnant.resultats, cout_resultat_da: g.gagnant.cout_resultat_da } };
      }
      const { story, n, centimes, devise, cle } = plan, w = plan.gagnant, pageId = String(c.page || rep.page?.id || '');
      S.scale = garder({ etat: 'creation', date }); sauver(m);
      // 4. CRÉER chez Meta, TOUT EN PAUSE : la campagne CBO, les ad sets broad, l'annonce gagnante RECRÉÉE sur son post
      const nom = `${plan.date} | SCALE | ${rep.detail}DA | ${m.code} | CBO | ${cle}`;
      const noms = Array.from({ length: n }, (_, i) => `${plan.date} | SCALE | ${m.code} | AS${i + 1} | BROAD | ${cle}`);
      // PAR ID, JAMAIS PAR NOM (09/10/2026) : l'id de la scale déjà connue (créée par un essai d'avant, noté dans le départ)
      const idScaleConnu = plan.campagneVue && plan.campagneVue.cle === cle ? String(plan.campagneVue.id) : null;
      const noterScale = appels => { const id = appelsDe({ appels }, 'ads_create_campaign').flatMap(a => jsonsDans(a.sortie)).map(j => j && (j.id ?? j.campaign_id)).find(x => x !== undefined && x !== null && x !== ''); if (id !== undefined && !idScaleConnu) { plan.campagneVue = { cle, id: String(id), le: maintenant() }; sauver(m); } };
      const r2 = await tourClaude(m, 'scale', { dept: 'scaling', outils: ['meta.ads_get_ad_entities', 'meta.ads_get_creatives', 'meta.ads_get_field_context', 'meta.ads_get_help_article', 'meta.ads_get_errors', 'meta.ads_get_ig_accounts', 'meta.ads_create_campaign', 'meta.ads_create_ad_set', 'meta.ads_create_creative', 'meta.ads_create_ad'],
        schema: { type: 'object', properties: { campaign_id: { type: 'string' }, ad_sets: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' } }, required: ['id'] } }, ads: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, ad_set_id: { type: 'string' } }, required: ['id', 'ad_set_id'] } }, existaitDeja: { type: 'boolean' }, note: { type: 'string' }, erreur: { type: 'string' } }, required: ['campaign_id', 'ad_sets', 'ads'] },
        message: `Monte la campagne de SCALE de ce modèle chez Meta, TOUT EN PAUSE (règle du vendeur : le gagnant du test, par son POST ID, dans une campagne CBO dédiée). Rien n'est activé ici.
Compte : ${compte} (devise ${devise}) · Page Facebook : ${pageId || '?'} · Mode : ${rep.mode} · Placements : ${placementsDe(rep)}
Le gagnant (choisi par l'outil du scaling) : l'annonce ${w.ad_id}${w.ad_set_id ? ` (ad set ${w.ad_set_id})` : ''} de la campagne de test ${c.id} ; son post : ${story}.
1. ads_get_ad_entities : cherche la clé « ${cle} » dans les campagnes du compte, publiées ET en brouillon (object_state « live » puis « draft »). Si une campagne la porte, ne crée PAS de deuxième campagne : reprends-la (existaitDeja = true), LIS-la — la campagne (id, name, daily_budget, lifetime_budget, spend_cap), ses ad sets (id, daily_budget, lifetime_budget, bid_amount, daily_spend_cap, lifetime_spend_cap, targeting) et ses annonces (id, adset_id, creative avec son object_story_id / effective_object_story_id : ads_get_creatives si besoin) — et crée seulement ce qui manque, dedans. Si ce qui existe ne suit pas les règles ci-dessous (un plafond, un budget d'ad set, un autre post, un autre ciblage), ne le change pas : dis-le dans « note ». PAR ID, JAMAIS PAR NOM : si PLUSIEURS campagnes portent la clé « ${cle} » ou le nom « ${nom} », ${idScaleConnu ? `reprends SEULEMENT celle dont l'id est ${idScaleConnu}` : `n'en choisis AUCUNE (ni la plus récente, ni par le nom), ne crée rien et mets leurs id dans « erreur »`}.
2. LIS la campagne de test ${c.id} et l'ad set du gagnant (objective, optimization_goal, billing_event, destination_type, promoted_object) : la scale garde EXACTEMENT les mêmes (le même pixel, le même événement).
3. ads_create_campaign : campaign_name « ${nom} », le MÊME objective que le test, buying_type AUCTION, statut PAUSED. CBO : campaign_daily_budget ${centimes} (plus petite unité de la devise ${devise}), campaign_bid_strategy LOWEST_COST_WITHOUT_CAP. AUCUN campaign_lifetime_budget, AUCUN budget_schedule_specs, AUCUN campaign_spend_cap (règle du vendeur : pas de plafond).
4. ${n} ad set${n > 1 ? 's' : ''} broad : campaign_id = la campagne de l'étape 1 ou 3, noms ${JSON.stringify(noms)}, targeting.geo_locations = EXACTEMENT ${JSON.stringify(cib.targeting.geo_locations)} (broad : aucun intérêt ; les ${cib.cles.length} wilayas confirmées par le client, les mêmes que le test — JAMAIS countries ["DZ"] ni tout le pays, aucune ville, aucune audience enregistrée), les mêmes optimization_goal, billing_event, destination_type et promoted_object que l'ad set du gagnant, statut PAUSED. CBO : AUCUN daily_budget ni lifetime_budget, AUCUN bid_strategy, bid_amount ni bid_constraints (le budget et l'enchère sont sur la campagne), AUCUN daily_min_spend_target, lifetime_min_spend_target, daily_spend_cap ni lifetime_spend_cap.
5. Dans CHAQUE ad set, UNE annonce : l'annonce gagnante RECRÉÉE sur son post — ads_create_ad { ad_set_id, ad_name, creative: {"object_story_id":"${story}"} }, ou ads_create_creative { page_id, object_story_id: "${story}", instagram_user_id (ads_get_ig_accounts) } puis ads_create_ad avec creative {"creative_id":"<son id>"}. Le post garde ses commentaires et son historique. JAMAIS object_story_spec, video_id, image ni texte (ce serait un NOUVEAU post, sans ses commentaires), jamais source_ad_id.
Chaque objet est créé À PART : jamais de copie (source_campaign_id, source_adset_id, source_ad_id) ni de campaign_spec / adset_spec — on ne duplique JAMAIS une campagne pour scaler. Ne touche pas à la campagne de test.
Puis RELIS (ads_get_ad_entities) la campagne, ses ad sets et ses annonces, avec les champs de l'étape 1 ET status, configured_status, effective_status : TOUT NAÎT EN PAUSE, même dans un compte en mode brouillon ; un objet relu ACTIVE (ou autre que PAUSED) : ne l'active pas, ne publie rien, dis-le dans « note ».
Rends {campaign_id, ad_sets:[{id, nom}], ads:[{id, ad_set_id}], existaitDeja, note}. Si Meta refuse un champ deux fois, arrête et mets sa réponse brute dans « erreur ».` }).catch(e => { noterScale(e && e.appels); throw e; });
      noterScale(r2.appels);
      const s = r2.structure;
      // casse-4 : une publication ou une activation dans le tour de création de la scale → refus, dit
      const allumesS = activationsDansCreation(r2.appels);
      if (allumesS.length) throw Object.assign(new Error(`publication ou activation pendant la creation de la scale (${allumesS.join(', ')}) : mets-la en pause dans Meta`), { client: M.scaleActiveeACreation() });
      const homoS = refusHomonymes(r2.appels, { cle, nom, idRendu: s.campaign_id, idConnu: idScaleConnu, nomsExclus: noms,
        exclure: [...(s.ad_sets || []), ...(s.ads || [])].map(a => a && a.id).filter(x => x !== undefined && x !== null) });
      if (homoS) throw Object.assign(new Error(`deux campagnes de scale de meme nom ou de meme cle dans Meta : ${homoS}`), { client: M.scaleHomonymes() });
      if (String(s.campaign_id) === String(c.id)) throw new Error('la campagne rendue est celle du test : la scale est une campagne dédiée');
      if (!s.existaitDeja && !contient(r2, 'ads_create_campaign', s.campaign_id)) throw new Error('l\'id de la campagne de scale n\'apparaît pas dans la réponse brute de Meta');
      if (s.existaitDeja && !contient(r2, 'ads_get_ad_entities', s.campaign_id)) throw new Error('la campagne de scale reprise (clé déjà là) n\'apparaît pas dans la lecture brute de Meta');
      if (s.existaitDeja && appelsDe(r2, 'ads_create_campaign').length) throw new Error('une deuxième campagne de scale a été créée alors que la clé existait déjà');
      if (s.ad_sets.length !== n) throw new Error(`${s.ad_sets.length} ad set(s) au lieu de ${n} (l'outil du scaling)`);
      if (s.ads.length !== n) throw new Error(`${s.ads.length} annonce(s) au lieu de ${n} (une par ad set)`);
      const idsSets = new Set(s.ad_sets.map(a => String(a.id)));
      if (s.ads.some(a => !idsSets.has(String(a.ad_set_id)))) throw new Error('une annonce est rangée hors des ad sets de la scale');
      if (new Set(s.ads.map(a => String(a.ad_set_id))).size !== s.ads.length) throw new Error('deux annonces dans le même ad set de la scale');
      const creations = (r2.appels || []).filter(a => /__ads_create_[a-z_]+$/.test(a.nom));
      const lu = a => JSON.stringify(a.entree || {}).replace(/\\+"/g, '"');
      for (const a of creations) if (/"status"\s*:\s*"ACTIVE"/i.test(lu(a))) throw new Error('une création de la scale a été envoyée ACTIVE au lieu de PAUSED');
      for (const a of creations) { const k = /"(campaign_spec|adset_spec|source_campaign_id|source_adset_id|source_ad_id)"\s*:/.exec(lu(a)); if (k) throw new Error(`création par copie ou en ligne (${k[1]}) : on ne duplique jamais une campagne pour scaler`); }
      for (const a of creations) { const k = /"([a-z_]*spend_cap)"\s*:/i.exec(lu(a)); if (k) throw new Error(`un plafond de dépense a été envoyé (${k[1]}) — règle : pas de plafond`); }
      // un calendrier de budget (budget_schedule_specs) monte le budget hors de l'outil, sans le client
      for (const a of creations) if (/"budget_schedule_specs"\s*:/.test(lu(a))) throw new Error('un calendrier de budget (budget_schedule_specs) sur la scale : le budget est celui de l\'outil, monté sur « واه، طلّع »');
      // CBO : le budget de l'outil sur la CAMPAGNE ; ni budget ni enchère sur les ad sets
      for (const a of appelsDe(r2, 'ads_create_campaign')) {
        const v = /"campaign_daily_budget"\s*:\s*"?(\d+)/.exec(lu(a));
        if (!v || +v[1] !== centimes) throw new Error(`campagne de scale créée avec campaign_daily_budget ${v ? v[1] : 'absent'} au lieu de ${centimes} (CBO : le budget est sur la campagne)`);
        if (/"campaign_lifetime_budget"\s*:/.test(lu(a))) throw new Error('un budget à vie sur la campagne de scale : le budget est celui du jour, de l\'outil');
        const st = /"campaign_bid_strategy"\s*:\s*"([^"]*)"/.exec(lu(a)); if (st && st[1] !== 'LOWEST_COST_WITHOUT_CAP') throw new Error(`campaign_bid_strategy ${st[1]} : la scale enchérit sans plafond (LOWEST_COST_WITHOUT_CAP)`);
      }
      for (const a of appelsDe(r2, 'ads_create_ad_set')) {
        const k = /"(daily_budget|lifetime_budget|bid_strategy|bid_amount|bid_constraints|daily_min_spend_target|lifetime_min_spend_target)"\s*:/.exec(lu(a)); if (k) throw new Error(`un ad set de la scale porte ${k[1]} : en CBO, le budget et l'enchère sont sur la campagne`);
        if (String(a.entree?.campaign_id || '') !== String(s.campaign_id)) throw new Error(`ad set créé dans la campagne ${a.entree?.campaign_id || '?'} au lieu de ${s.campaign_id}`);
        // les wilayas confirmées, relues dans l'ENTRÉE brute (jamais countries DZ, rien d'autre)
        const fc = fauteCiblage(a.entree?.targeting, cib.cles, a.entree);
        if (fc) throw new Error(`ad set de la scale « ${a.entree?.ad_set_name || '?'} » créé hors des wilayas confirmées (${fc})`);
      }
      // LE POST ID : chaque annonce créée l'est sur le post du gagnant (directement, ou par une créa faite sur ce post)
      const creasSurPost = [];
      for (const a of appelsDe(r2, 'ads_create_creative')) {
        if (String(a.entree?.object_story_id || '') !== story || /"(object_story_spec|video_id|image_hash|image_url|link_url|message|headline)"\s*:/.test(lu(a))) throw new Error(`une créa de la scale n'est pas le post du gagnant ${story} (object_story_id seul)`);
        creasSurPost.push(String(a.sortie || ''));
      }
      for (const a of appelsDe(r2, 'ads_create_ad')) {
        const e = a.entree || {};
        if (!idsSets.has(String(e.ad_set_id || ''))) throw new Error(`annonce créée dans l'ad set ${e.ad_set_id || '?'}, qui n'est pas un ad set de la scale`);
        let cr = e.creative; if (typeof cr === 'string') { try { cr = JSON.parse(cr); } catch { cr = null; } }
        cr = cr && typeof cr === 'object' ? cr : {};
        if (cr.object_story_spec || /"(video_id|image_hash|image_url|link_url)"\s*:/.test(JSON.stringify(cr))) throw new Error('une annonce de la scale est un NOUVEAU post (object_story_spec, vidéo, image) : elle perdrait les commentaires du gagnant');
        const surPost = String(cr.object_story_id || '') === story, parCrea = !!cr.creative_id && creasSurPost.some(t => t.includes(String(cr.creative_id)));
        if (!surPost && !parCrea) throw new Error(`une annonce de la scale n'est pas recréée sur le post du gagnant ${story} (object_story_id)`);
      }
      // 2e méthode sur CHAQUE id rendu : créé ici, ou lu dans la campagne reprise
      for (const a of s.ad_sets) if (!contient(r2, 'ads_create_ad_set', a.id) && !contient(r2, 'ads_get_ad_entities', a.id)) throw new Error(`l'ad set ${a.id} n'apparaît dans aucune réponse brute de Meta (ni créé, ni lu)`);
      for (const a of s.ads) if (!contient(r2, 'ads_create_ad', a.id) && !contient(r2, 'ads_get_ad_entities', a.id)) throw new Error(`l'annonce ${a.id} n'apparaît dans aucune réponse brute de Meta (ni créée, ni lue)`);
      // CE QUI EXISTAIT DÉJÀ (une scale reprise par sa clé, un essai d'avant coupé ou refusé) n'est passé par aucun des
      // contrôles des créations : on le relit dans les réponses BRUTES de Meta — aucun plafond, le budget de l'outil sur
      // la campagne, aucun budget ni enchère sur les ad sets, chaque annonce sur le post du gagnant
      const lus = objetsLus(r2), faute = [];
      const cree = id => ['ads_create_campaign', 'ads_create_ad_set', 'ads_create_ad'].some(o => contient(r2, o, id));
      const kc = lus.get(String(s.campaign_id)) || {};
      for (const k of Object.keys(kc)) if (/spend_cap$/.test(k) && montant(kc[k]) > 0) faute.push(`${k} sur la campagne ${s.campaign_id}`);
      if (montant(kc.lifetime_budget) > 0) faute.push(`lifetime_budget sur la campagne ${s.campaign_id}`);
      if (!cree(s.campaign_id) && !budgetEgal(kc.daily_budget, centimes)) faute.push(`daily_budget de la campagne ${s.campaign_id} ${kc.daily_budget === undefined ? 'non relu' : kc.daily_budget} au lieu de ${centimes}`);
      for (const a of s.ad_sets) { const o = lus.get(String(a.id)) || {}; for (const k of Object.keys(o)) if (/^(daily_budget|lifetime_budget|bid_amount|daily_min_spend_target|lifetime_min_spend_target|[a-z_]*spend_cap)$/.test(k) && montant(o[k]) > 0) faute.push(`${k} sur l'ad set ${a.id}`); }
      // le ciblage d'un ad set REPRIS : les wilayas confirmées (relu quand Meta le rend ; pas relu : noté — sauf pour une scale
      // montée AVANT la règle des wilayas, renvoyée ici par son « لانسي » : elle doit être relue, sinon elle ne part pas)
      for (const a of s.ad_sets) if (!cree(a.id)) {
        const o = lus.get(String(a.id));
        if (!o || o.targeting === undefined) { if (S.scaleAncienne) faute.push(`ciblage de l'ad set ${a.id} non relu (scale d'une version d'avant les wilayas)`); else histoire(m, `scale : ciblage de l'ad set repris ${a.id} non relu dans Meta`); continue; }
        const fc = fauteCiblage(o.targeting, cib.cles); if (fc) faute.push(`ciblage de l'ad set ${a.id} : ${fc}`);
      }
      const lePost = new RegExp(`(^|[^0-9_])${story}($|[^0-9_])`);
      for (const a of s.ads) if (!cree(a.id)) {
        const o = lus.get(String(a.id)), crId = o?.creative?.id || o?.creative_id, crea = crId ? lus.get(String(crId)) : null;
        if (!o || !(lePost.test(JSON.stringify(o)) || (crea && lePost.test(JSON.stringify(crea))))) faute.push(`l'annonce ${a.id} n'est pas relue sur le post ${story}`);
      }
      if (faute.length) throw new Error(`scale reprise mais hors des règles (un essai d'avant) : corrige ou supprime-la dans Meta — ${faute.slice(0, 3).join(' ; ')}`);
      // TOUT EN PAUSE, RELU (09/10/2026) : un objet de la scale relu hors pause → refusé, dit, rien n'est activé
      const objetsScaleCrees = [s.campaign_id, ...s.ad_sets.map(a => a.id), ...s.ads.map(a => a.id)].map(String);
      for (const id of idsCreesDansLeTour(r2.appels)) if (!objetsScaleCrees.includes(id)) objetsScaleCrees.push(id);
      const scaleHorsPause = [...nonPauses(r2.appels, objetsScaleCrees), ...nonPausesObjets(r2.appels, objetsScaleCrees)];
      const envoiScaleHorsPause = creationHorsPause(r2.appels);
      if (envoiScaleHorsPause) throw Object.assign(new Error(`creation de la scale hors pause : ${envoiScaleHorsPause}`), { client: M.scaleNonPause() });
      if (scaleHorsPause.length) throw Object.assign(new Error(`objet de la scale relu hors pause, remets-le en pause dans Meta (rien n'est active) : ${scaleHorsPause.slice(0, 4).map(x => `${x.id} ${x.champ} ${x.statut}`).join(', ')}`), { client: M.scaleNonPause() });
      if (!statutsLusDe(r2.appels, objetsScaleCrees)) histoire(m, 'scale : statut des objets créés non relu dans Meta (ni ACTIVE ni PAUSED lu)');
      if (s.note) histoire(m, `scale : ${String(s.note).slice(0, 200)}`);
      S.scale = { etat: 'creee', date, cle, gagnant: { ...w, story_id: story },
        campagne: { id: String(s.campaign_id), adSets: s.ad_sets, ads: s.ads, budget_centimes: centimes, budget_da: plan.budget_da, devise, ciblage: cib.cles }, existaitDeja: !!s.existaitDeja, creeeLe: maintenant() };
      delete S.scaleAncienne;
      histoire(m, `scale : campagne ${s.campaign_id} créée EN PAUSE (CBO, ${n} ad set(s), ${plan.budget_da} DA par jour, post ${story})`); sauver(m);
      await envoyer(m, M.scalePrete(m.id, devise === 'DZD' ? centimes / 100 / taux : centimes / 100, taux, n));
    } catch (e) {
      // la limite d'usage ou un connecteur à reconnecter : pas un échec (aucun essai compté), le départ noté est gardé, on
      // reprend un autre soir
      if (e && (e.quota || e.connecteur)) {
        S.scale = garder({ etat: 'attente', date, raison: e.quota ? 'limite d\'usage de Claude' : 'connecteur à reconnecter' }); histoire(m, `scale : ${S.scale.raison} — rien n'est compté comme un échec`);
        if (e.connecteur) S.attenteConnecteur = { cles: clesDe(e), depuis: maintenant() };
        sauver(m);
        if (e.quota) await prevenirQuota(); else await signalerConnecteur(clesDe(e), m);
        return;
      }
      const erreur = String(e.message || e).slice(0, 500);
      S.scale = { etat: 'echec', date, erreur, ...(plan ? { plan } : {}), echecs: echecs + 1 }; histoire(m, 'scale : ÉCHEC — ' + erreur); sauver(m);
      // le MÊME échec qu'au dernier essai : le client le sait déjà (le bureau le garde dans l'historique et réessaie)
      // les wilayas pas confirmées : le client lit QUOI faire (« جيب الولايات », puis confirmer), pas une raison technique coupée
      if (!(avant?.etat === 'echec' && avant.erreur === erreur)) await envoyer(m, e.client && e.client.texte ? e.client : M.scaleEchec(erreur));
    }
  }
  /** Les objets lus dans les réponses BRUTES de Meta (lectures d'entités et de créas), rangés par id (fusionnés s'ils
   *  reviennent plusieurs fois). */
  function objetsLus(r) {
    const lus = new Map();
    const marcher = o => { if (Array.isArray(o)) return o.forEach(marcher); if (!o || typeof o !== 'object') return;
      const id = o.id ?? o.ad_object_id; if (id !== undefined && id !== null && typeof id !== 'object') { const k = String(id); lus.set(k, Object.assign(lus.get(k) || {}, o)); }
      for (const v of Object.values(o)) if (v && typeof v === 'object') marcher(v); };
    for (const a of [...appelsDe(r, 'ads_get_ad_entities'), ...appelsDe(r, 'ads_get_creatives')]) for (const j of jsonsDans(a.sortie)) marcher(j);
    return lus;
  }
  /** Un montant relu chez Meta : 2100, « 2100 », « 21,00 $US », « 2 100,00 $US ». */
  const montant = v => { if (v === undefined || v === null || v === '' || typeof v === 'object') return 0; if (typeof v === 'number') return v;
    let t = String(v).replace(/[^\d.,-]/g, ''); // « 2 100,00 $US » → « 2100,00 » ; « 1,234.56 » : le séparateur des milliers part
    t = t.includes(',') && t.includes('.') ? (t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')) : t.replace(',', '.');
    const n = parseFloat(t); return Number.isFinite(n) ? n : 0; };
  /** Un budget relu vaut-il ces centimes ? Des chiffres seuls sont des centimes (« 2100 », l'API) ; mis en forme (une
   *  virgule, un point, une devise : « 21,00 $US »), ce sont des unités. */
  const budgetEgal = (v, centimes) => { if (v === undefined || v === null || v === '' || typeof v === 'object') return false; const n = montant(v);
    return /[.,$€A-Za-z]/.test(String(v)) ? Math.abs(n * 100 - centimes) < 0.5 : Math.abs(n - centimes) < 0.5; };
  /** Le « لانسي » du client sur la scale : la campagne, puis ses ad sets, puis ses annonces, RELUS dans Meta. Rien d'autre. */
  async function lancerScale(m) {
    const sc = m.d.suivi.scale, k = sc.campagne;
    // une campagne de scale montée AVANT la règle des wilayas (sans « ciblage » : countries ["DZ"], toute l'Algérie) n'est
    // JAMAIS allumée telle quelle (07/10/2026, « casse ») : la scale est reprise au prochain soir — même clé, ses ad sets
    // relus (ciblage pas relu ou hors des wilayas : refusé) — puis un nouveau « لانسي »
    if (!Array.isArray(k.ciblage)) {
      m.d.suivi.scaleAncienne = true;
      m.d.suivi.scale = { etat: 'echec', date: '', erreur: 'campagne de scale montée avant la règle des wilayas : relue au prochain soir, avant tout « لانسي »', echecs: 0 };
      histoire(m, `scale : la campagne ${k.id} vient d'une version d'avant les wilayas — rien n'est allumé, elle sera relue au prochain soir`); sauver(m);
      await envoyer(m, M.scaleAncienne());
      return;
    }
    const objets = objetsScale(k);
    // activationEnVol : un tour d'activation de la scale EN ROUTE (le PC coupé pendant : l'horloge le RELIT, ne réactive jamais)
    sc.activationEnVol = maintenant(); sauver(m);
    let r;
    try {
      r = await tourClaude(m, 'activation-scale', { dept: 'scaling', outils: ['meta.ads_activate_entity', 'meta.ads_get_ad_entities'], porte: objets,
        schema: { type: 'object', properties: { statuts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, niveau: { type: 'string' }, statut: { type: 'string' } }, required: ['id', 'statut'] } }, erreur: { type: 'string' } }, required: ['statuts'] },
        message: `Le client a pressé « لانسي » pour la campagne de SCALE de ce modèle, et seulement elle. Active, dans cet ordre : la campagne ${k.id}, PUIS chaque ad set ${JSON.stringify(k.adSets.map(a => a.id))}, PUIS chaque annonce ${JSON.stringify(k.ads.map(a => a.id))} (ads_activate_entity). Si elle est en BROUILLON (draft), publie-la D'ABORD avec object_ids = exactement ces objets ${JSON.stringify(objets)} et AUCUN autre (un autre brouillon du compte ne part jamais avec elle), entity_id = la campagne et publish_as_active true ; puis active chacun de ces objets resté en pause (la publication n'allume que la campagne). Ne touche à rien d'autre : ni le budget, ni la campagne de test ${m.d.campagne.id}. Puis RELIS dans Meta (ads_get_ad_entities, object_state « live » puis « draft ») le statut effectif de chacun. Si Meta répond PUBLISHING (compte en mode brouillon), c'est NORMAL : ne réactive rien, rends les statuts tels quels.
Rends {statuts:[{id, niveau, statut}]} avec les statuts RELUS (ACTIVE, IN_PROCESS, PENDING_REVIEW, PUBLISHING, DRAFT, DISAPPROVED…).` });
    } catch (e) {
      delete sc.activationEnVol;
      const partis = appelsActivation(e && e.appels);
      if (!partis.length) {
        sauver(m);
        // rien n'est parti : la limite d'usage ou un connecteur — le client le sait et GARDE son « لانسي »
        if (e && e.quota) { const v = verrouQuota(); histoire(m, 'scale : « لانسي » pendant la limite d\'usage de Claude — rien n\'est parti, le bouton reste'); if (v) { v.prevenu = v.prevenu || maintenant(); sauverChaine(); } await envoyer(m, M.quota(v ? heureCourte(v.reprise) : '', M.boutonScale(m.id))); return; }
        if (e && e.connecteur) { histoire(m, `scale : « لانسي » avec un connecteur à reconnecter (${clesDe(e).join(', ')}) — rien n'est parti, le bouton reste`); await signalerConnecteur(clesDe(e), m); await envoyer(m, M.scalePasEncore(m.id)); return; }
        throw e;
      }
      const hors = activesHors({ appels: e.appels }, objets);
      if (hors.length) throw new Error(`${hors.join(', ')} activé : ce n'est pas un objet de la campagne de scale`);
      sc.etat = 'publication'; sc.publication = { le: maintenant(), essais: 0, prochaine: new Date(Date.now() + delaiRelecture()).toISOString(), publiee: publieDans(e.appels), apresPanne: String(e.message || e).slice(0, 160) };
      histoire(m, `scale : tour coupé APRÈS ${partis.length} appel(s) d'activation (${String(e.message || e).slice(0, 120)}) — relecture dans Meta, jamais une 2e activation`); sauver(m);
      if (e.quota) await prevenirQuota();
      return;
    }
    delete sc.activationEnVol;
    // chaque objet activé — entity_id, et chaque id d'un brouillon publié (object_ids, même en texte JSON) — est un objet de
    // CETTE scale (la même relecture que l'activation du test)
    const hors = activesHors(r, objets);
    if (hors.length) { sauver(m); throw new Error(`${hors.join(', ')} activé : ce n'est pas un objet de la campagne de scale`); }
    if (!appelsActivation(r.appels).length) { sauver(m); throw new Error('aucune activation envoyée à Meta (aucun ads_activate_entity) : rien n\'est parti'); }
    const publiee = publieDans(r.appels), lu = lireActivation(r, objets, publiee);
    histoire(m, `scale : activation ${lu.verdict} — ${resumeClasses(lu.classes)}`);
    await deciderScale(m, lu, { le: maintenant(), publiee, depuisTour: true });
  }
  const objetsScale = k => [String(k.id), ...k.adSets.map(a => String(a.id)), ...k.ads.map(a => String(a.id))];
  /** La décision pour la SCALE (la même trancher() que le test) : lancée / partielle → « lancee » ; refusée → « rejetee » (dit,
   *  rien d'autre, jamais relancée) ; attendre → « publication » (l'horloge relit) ; échec → l'erreur (scaleRate : « عاود » =
   *  une nouvelle activation, décision du client). */
  async function deciderScale(m, lu, { le, publiee, depuisTour = false }) {
    const sc = m.d.suivi.scale, ids = c => Object.entries(lu.classes).filter(([, k]) => k === c).map(([id]) => id);
    if (lu.verdict === 'lancee' || lu.verdict === 'partielle') {
      sc.etat = 'lancee'; sc.lanceLe = le; delete sc.publication;
      histoire(m, lu.verdict === 'lancee' ? `scale : campagne ${sc.campagne.id} lancée par le client` : `scale : campagne ${sc.campagne.id} lancée EN PARTIE (refusé ou à l'arrêt : ${[...ids('refus'), ...ids('arret')].join(', ')})`); sauver(m);
      await envoyer(m, lu.verdict === 'lancee' ? M.scaleLance() : M.scaleRefusPartiel()); return;
    }
    if (lu.verdict === 'refusee') { sc.etat = 'rejetee'; sc.rejeteeLe = maintenant(); sc.refus = ids('refus'); delete sc.publication; histoire(m, `scale : Meta a refusé (${sc.refus.join(', ')}) — rien d'autre, ni pause ni nouvelle activation`); sauver(m); await envoyer(m, M.scaleRejetee()); return; }
    if (lu.verdict === 'attendre') {
      const premier = sc.etat !== 'publication';
      sc.etat = 'publication'; sc.publication = { ...(sc.publication || {}), le: sc.publication?.le || le, publiee: !!(publiee || sc.publication?.publiee), essais: sc.publication?.essais || 0, prochaine: new Date(Date.now() + delaiRelecture()).toISOString() };
      histoire(m, `scale : en cours de publication chez Meta — relecture dans ${Math.round(delaiRelecture() / 1000)} s`); sauver(m);
      if (depuisTour && premier) await envoyer(m, M.scaleEnCours(m.id));
      return;
    }
    sc.etat = 'creee'; delete sc.publication; sauver(m);
    throw new Error(`rien n'est actif à la relecture (${resumeClasses(lu.classes)})`);
  }
  /** Une scale « creee » dont la DERNIÈRE activation a échoué sous l'ancienne règle (« <id> n'est pas actif à la relecture
   *  (PUBLISHING|DRAFT) » : l'activation était partie, rien n'est lancé) → {le, statut} ; sinon null (une activation plus
   *  récente, une autre panne, une scale recréée depuis : rien). */
  function scaleAncienneRegle(m, sc) {
    if (!sc || sc.etat !== 'creee' || sc.lanceLe || sc.publication || sc.activationEnVol) return null;
    const depuis = Date.parse(sc.creeeLe || '') || 0;
    for (let i = (m.historique || []).length - 1; i >= 0; i--) {
      const h = m.historique[i], q = String(h.quoi || '');
      if (depuis && Date.parse(h.quand) < depuis) return null;
      if (/^scale : campagne \S+ créée EN PAUSE/.test(q)) return null;
      const x = /^scale : activation ratée — \S+ n'est pas actif à la relecture \((PUBLISHING|DRAFT)\)/i.exec(q);
      if (x) return { le: h.quand, statut: x[1].toUpperCase() };
      if (/^scale : (activation|tour coupé|en cours de publication|relecture|bloquée par l'ancienne|Meta |campagne \S+ lancée)/.test(q)) return null;
    }
    return null;
  }
  /** La relecture de la scale « en cours de publication » (l'horloge) : la même loi que le test, trois relectures au plus. */
  async function relireScale(m) {
    const sc = m.d.suivi && m.d.suivi.scale;
    if (!sc || sc.etat !== 'publication' || !sc.publication || m.etat !== 'suivi' || scaleEnCours.has(m.id)) return;
    scaleEnCours.add(m.id);
    try {
      const p = sc.publication, k = sc.campagne, objets = objetsScale(k);
      let r = null, panne = null;
      try {
        r = await tourClaude(m, 'relire-scale', { dept: 'scaling', outils: ['meta.ads_get_ad_entities'], essaisLeger: (p.essais || 0) + (p.pannes || 0),
          schema: { type: 'object', properties: { statuts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, niveau: { type: 'string' }, statut: { type: 'string' } }, required: ['id', 'statut'] } }, erreur: { type: 'string' } }, required: ['statuts'] },
          message: `RELECTURE de l'activation de la campagne de SCALE (tu LIS seulement : tu n'actives rien). Les objets de la scale et AUCUN autre : la campagne ${k.id}, les ad sets ${JSON.stringify(k.adSets.map(a => a.id))}, les annonces ${JSON.stringify(k.ads.map(a => a.id))}.
ads_get_ad_entities sur ces objets (object_ids = exactement ${JSON.stringify(objets)}), object_state « live » PUIS « draft », fields id, name, status, effective_status, configured_status.
Rends {statuts:[{id, niveau, statut}]} avec le statut effectif RELU de chacun.` });
      } catch (e) {
        if (e && e.quota) { histoire(m, 'scale : relecture repoussée — limite d\'usage de Claude (aucun essai perdu)'); sauver(m); await prevenirQuota(); return; }
        if (e && e.connecteur) { p.attendConnecteur = clesDe(e); histoire(m, `scale : relecture en attente — connecteur à reconnecter (${p.attendConnecteur.join(', ')})`); sauver(m); await signalerConnecteur(p.attendConnecteur, m); return; }
        panne = e; p.pannes = (p.pannes || 0) + 1;
      }
      if (m.etat !== 'suivi' || m.d.suivi.scale !== sc || sc.etat !== 'publication' || sc.publication !== p) { histoire(m, `scale : relecture rendue, mais la mission est ${m.etat} — rien de plus`); sauver(m); return; }
      p.essais = (p.essais || 0) + 1; p.derniere = maintenant();
      const lu = r ? lireActivation(r, objets, p.publiee) : { verdict: 'attendre', classes: Object.fromEntries(objets.map(id => [id, 'inconnu'])) };
      histoire(m, `scale : relecture ${p.essais} — ${panne ? 'impossible (' + String(panne.message || panne).slice(0, 120) + ')' : lu.verdict + ' — ' + resumeClasses(lu.classes)}`);
      if (lu.verdict === 'attendre') {
        if (p.essais < RELECTURES_MAX) { p.prochaine = new Date(Date.now() + delaiRelecture()).toISOString(); sauver(m); return; }
        // toujours en cours : la scale peut tourner — elle est SUIVIE (lancée), le client le sait
        sc.etat = 'lancee'; sc.lanceLe = p.le; delete sc.publication; histoire(m, `scale : Meta n'a pas confirmé après ${p.essais} relecture(s) — suivie comme lancée, le client le sait`); sauver(m);
        await envoyer(m, M.scalePublicationLongue()); return;
      }
      try { await deciderScale(m, lu, { le: p.le, publiee: p.publiee }); }
      catch (e) { histoire(m, 'scale : activation ratée — ' + e.message); sauver(m); await envoyer(m, M.scaleRate(m.id, e.message)); }
    } finally { scaleEnCours.delete(m.id); }
  }
  /** « واه، طلّع » : le daily_budget de la CAMPAGNE de scale (CBO) passe à ce que l'outil a calculé, relu. Jamais un ad set. */
  async function monter(m) {
    const S = m.d.suivi, h = S.hausseDemandee, sc = S.scale, taux = +R().taux || 0;
    if (!h || !h.campagne || !sc?.campagne || String(sc.campagne.id) !== String(h.campagne)) throw new Error('aucune campagne de scale pour cette hausse');
    const compte = String(m.demande.reponses.compte?.id || '').replace(/^act_/, '');
    const r = await tourClaude(m, 'hausse', { dept: 'scaling', outils: ['meta.ads_get_ad_entities', 'meta.ads_update_entity'],
      schema: { type: 'object', properties: { campagne: { type: 'object', properties: { id: { type: 'string' }, avant: { type: 'integer' }, apres: { type: 'integer' } }, required: ['id', 'avant', 'apres'] }, erreur: { type: 'string' } }, required: ['campagne'] },
      message: `Le client a pressé « واه، طلّع » : monte le budget de la CAMPAGNE de scale ${h.campagne} (compte ${compte}, CBO), calculé par l'outil du scaling (+${Math.round((h.hausse || 0.2) * 100)} % : ${h.de_da} DA → ${h.vers_da} DA par jour).
1. LIS son daily_budget (ads_get_ad_entities level "campaign", plus petite unité de la devise du compte) : il doit valoir ${h.de_centimes}. S'il vaut DÉJÀ ${h.vers_centimes} (cette hausse a été posée, puis le PC s'est coupé avant de la noter), ne pose RIEN et rends avant = apres = ${h.vers_centimes}. S'il vaut autre chose, ne change RIEN et mets ce que tu as lu dans « erreur ».
2. ads_update_entity { entity_type "campaign", entity_id "${h.campagne}", fields {"daily_budget": ${h.vers_centimes}} } — le champ s'appelle daily_budget (pas campaign_daily_budget).
3. RELIS-le dans Meta.
Ne touche à rien d'autre : ni les ad sets (en CBO, ils n'ont pas de budget), ni ciblage, ni créa, ni statut, aucun plafond (spend_cap). Rends {campagne:{id, avant, apres}} avec les valeurs RELUES.` });
    const maj = appelsDe(r, 'ads_update_entity');
    const k = r.structure.campagne || {}, relu = appelsDe(r, 'ads_get_ad_entities').map(a => a.sortie).join(' ');
    // une hausse DÉJÀ posée (coupure entre Meta et le journal) : relue dans Meta, elle est notée — jamais reposée, et le
    // délai de 48 h la voit
    const dejaPosee = !maj.length && +k.avant === +h.vers_centimes && +k.apres === +h.vers_centimes && (dansBrut(relu, h.vers_centimes) || dansBrut(relu, h.vers_centimes / 100));
    if (!maj.length && !dejaPosee) throw new Error('aucune mise à jour envoyée à Meta');
    for (const a of maj) {
      const e = a.entree || {}; let f = e.fields; if (typeof f === 'string') { try { f = JSON.parse(f); } catch { f = null; } }
      if (String(e.entity_id || '') !== String(h.campagne) || String(e.entity_type || '').toLowerCase() !== 'campaign') throw new Error(`mise à jour envoyée à ${e.entity_type || '?'} ${e.entity_id || '?'} : seule la CAMPAGNE de scale monte (CBO), jamais un ad set`);
      if (!f || typeof f !== 'object' || Object.keys(f).join() !== 'daily_budget' || +f.daily_budget !== +h.vers_centimes) throw new Error(`mise à jour ${JSON.stringify(f)} au lieu de {"daily_budget":${h.vers_centimes}}`);
    }
    if (!dejaPosee && +k.avant !== +h.de_centimes) throw new Error(`le budget de la campagne valait ${k.avant} avant la hausse, pas ${h.de_centimes} (changé dans Meta depuis la proposition)`);
    if (+k.apres !== +h.vers_centimes || !(dansBrut(relu, k.apres) || dansBrut(relu, k.apres / 100))) throw new Error(`budget relu ${k.apres} au lieu de ${h.vers_centimes} (ou absent de la relecture brute de Meta)`);
    // le journal des hausses de l'outil (c'est lui qui tient les 48 h) : son dossier existe, et un journal pas écrit se DIT
    const dJ = path.join(dossier(m), 'testing'); fs.mkdirSync(dJ, { recursive: true });
    const note = await outil(m, 'scaling-noter', '4-SCALING/manita-scaling.py', ['--noter-hausse', '--nouveau-budget', h.vers_da, '--devise-depenses', 'DZD', '--devise', 'DZD'], { dureeMaxMs: 60000, env: { MANITA_DOSSIER_SCALING: dJ } });
    if (!jsonOutil(note, 'hausse_notee')) histoire(m, 'ATTENTION : hausse posée dans Meta mais PAS notée dans le journal du scaling (le délai de 48 h ne la voit pas) — ' + extrait(note.raison || note.sortie));
    sc.campagne.budget_centimes = h.vers_centimes; sc.campagne.budget_da = h.vers_da;
    S.hausses.push({ ...h, faite: maintenant(), ...(dejaPosee ? { reprise: true } : {}) }); S.hausseDemandee = null; m.attente = null;
    histoire(m, dejaPosee ? `hausse déjà posée dans Meta avant une coupure (${h.vers_centimes} relu) : notée, pas reposée` : `budget de la campagne de scale monté : ${h.de_da} → ${h.vers_da} DA`); sauver(m);
    await envoyer(m, M.budgetMonte(h.vers_da / taux, taux));
  }

  /** L'ENTRETIEN de chaque minute (l'horloge, quelle que soit l'heure du rapport) : la limite d'usage passée → tout ce qui
   *  l'attendait reprend ; les relectures d'activation dues (test et scale) ; un tour d'activation coupé par une coupure du PC
   *  (activationEnVol) → relu ; la sonde bornée des connecteurs à reconnecter. */
  function entretien(d = new Date()) {
    const t = d.getTime(), libre = !verrouQuota(t);
    if (libre && chaine.quota) { journal('limite d\'usage de Claude passée : la chaîne reprend'); delete chaine.quota; sauverChaine(); }
    for (const m of missions.values()) {
      if (libre && m.etat === 'quota') { histoire(m, `limite d'usage passée : la mission reprend à « ${m.quota?.etape || m.etape} », aucun essai perdu`); delete m.quota; m.etat = 'encours'; sauver(m); avancer(m); continue; }
      const S = m.d.suivi;
      if (libre && S && S.attenteQuota) { delete S.attenteQuota; histoire(m, 'limite d\'usage passée : la lecture du soir reprend'); sauver(m); }
      const p = m.d.publication;
      if (libre && m.etat === 'encours' && m.attente === 'activation' && p && !p.attendConnecteur && Date.parse(p.prochaine) <= t && !enMarche.has(m.id)) relirePublication(m).catch(e => journal(`mission ${m.id} : relecture — ${e.message}`));
      const sc = S && S.scale;
      if (m.etat === 'suivi' && sc && sc.activationEnVol && !scaleEnCours.has(m.id)) {
        sc.etat = 'publication'; sc.publication = { le: sc.activationEnVol, essais: 0, prochaine: new Date(t).toISOString(), publiee: false, apresCoupure: true }; delete sc.activationEnVol;
        histoire(m, 'scale : le PC s\'est coupé PENDANT le tour d\'activation — relue dans Meta, jamais une 2e activation'); sauver(m);
      }
      if (libre && m.etat === 'suivi' && sc && sc.etat === 'publication' && sc.publication && !sc.publication.attendConnecteur && Date.parse(sc.publication.prochaine) <= t && !scaleEnCours.has(m.id)) relireScale(m).catch(e => journal(`mission ${m.id} : relecture de la scale — ${e.message}`));
    }
    for (const l of lots.values()) if (libre && l.etat === 'quota') { histoireLot(l, `limite d'usage passée : le lot reprend à « ${l.quota?.etape || l.etape} »`); delete l.quota; l.etat = 'encours'; sauverLot(l); avancerLot(l); }
    revoirPortesLots();
    entretienConnecteurs(d);
  }

  /* ---------------------------------------- le moteur ---------------------------------------- */
  const codeBoutique = () => String(R().codeBoutique || 'SHOP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SHOP';
  const prochaine = m => ETAPES.map(([id]) => id).find(id => !['fini', 'saute'].includes((m.etapes[id] || {}).etat));
  async function vignette(m, source, nom) {
    if (!source || !fs.existsSync(source)) return null;
    const d = path.join(dossier(m), 'textes'); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, nom);
    if (!fs.existsSync(f)) await executer(ffmpeg(), ['-y', '-v', 'error', '-i', source, '-vf', 'scale=512:-2', '-q:v', '4', f], { timeout: 60000 });
    return fs.existsSync(f) ? f : null;
  }

  // [v0.3.9-avancer] avancer() est souvent lancée sans await : une erreur qui sort (un sauver() qui échoue) est écrite
  //   au journal au lieu d'arrêter le serveur par une promesse rejetée que personne ne rattrape
  function avancer(m) { return avancerTour(m).catch(e => { try { journal(`mission ${m.id} : erreur hors étape — ${String(e?.stack || e?.message || e).slice(0, 400)}`); } catch {} }); }
  async function avancerTour(m) {
    if (enMarche.has(m.id)) return; enMarche.add(m.id);
    try {
      while (m.etat === 'encours') {
        const id = prochaine(m);
        if (!id) { m.etat = 'suivi'; histoire(m, 'chaîne finie : la publicité tourne, le suivi commence'); sauver(m); break; }
        const st = m.etapes[id] = m.etapes[id] || { etat: 'afaire', essais: 0 };
        m.etape = id;
        if (st.etat !== 'attente') { st.etat = 'encours'; st.debut = st.debut || maintenant(); }
        sauver(m);
        let r;
        try { r = await ETAPE[id](m); }
        catch (e) {
          // la mission a été ARRÊTÉE (« حبس ») pendant son tour : elle reste arrêtée — ni « quota », ni « bloquee », ni reprise
          if (m.etat !== 'encours') { histoire(m, `${id} : rendu en erreur (${String(e.message || e).slice(0, 160)}), mais la mission est ${m.etat} : rien de plus`); sauver(m); break; }
          // LA LIMITE D'USAGE de Claude : aucun essai consommé, la mission attend l'heure de reprise (tick), un seul message
          if (e.quota) {
            st.etat = 'afaire'; st.erreur = String(e.message || e).slice(0, 300); m.etat = 'quota'; m.quota = { depuis: maintenant(), etape: id };
            histoire(m, `${id} : limite d'usage de Claude — la mission attend (${verrouQuota() ? 'reprise ' + verrouQuota().reprise : 'bientôt'}), aucun essai perdu`); sauver(m);
            await prevenirQuota(); break;
          }
          // UN CONNECTEUR À RECONNECTER (needs-auth, pending, failed, absent) : jamais une panne — aucun essai, un seul message,
          // la reprise toute seule quand une sonde le redonne « connected »
          if (e.connecteur) {
            st.etat = 'afaire'; st.erreur = String(e.message || e).slice(0, 300); m.etat = 'connecteur'; m.connecteur = { cles: clesDe(e), statuts: e.connecteur.statuts || [], depuis: maintenant(), etape: id };
            histoire(m, `${id} : connecteur à reconnecter (${(m.connecteur.statuts.length ? m.connecteur.statuts : m.connecteur.cles).join(', ')}) — la mission attend, aucun essai perdu`); sauver(m);
            await signalerConnecteur(m.connecteur.cles, m); break;
          }
          // [v0.3.9-meta] une erreur de CONFIGURATION du compte Meta : aucun essai consommé, le client lit quoi faire en darija
          const metaConnue = e.metaConnue || erreurMetaConnue(e.message);
          if (metaConnue) {
            st.etat = 'echec'; st.erreur = String(e.message || e).slice(0, 500); m.etat = 'bloquee'; m.d.erreurMeta = { cle: metaConnue, etape: id, le: maintenant() };
            histoire(m, `${id} : Meta refuse — ${metaConnue} (configuration du compte : aucun essai consommé, la mission attend « عاود »)`); sauver(m);
            await envoyer(m, M.erreurMeta(m.id, metaConnue, m.demande?.reponses?.compte?.nom || ''));
            break;
          }
          st.essais = (st.essais || 0) + 1; st.erreur = String(e.message || e).slice(0, 500);
          histoire(m, `${id} : ÉCHEC (${st.essais}) — ${st.erreur}`);
          if (!e.definitif && st.essais < 2) { sauver(m); await new Promise(x => setTimeout(x, deps.pauseReessaiMs ?? 30000)); continue; }
          st.etat = 'echec'; m.etat = 'bloquee'; sauver(m);
          // une étape peut porter son propre message (e.client, avec « عاود » / « حبس ») : plus clair que la raison technique
          await envoyer(m, e.client && e.client.texte ? e.client : M.echec(m.id, NOM_AR[id] || id, st.erreur));
          break;
        }
        // « حبس » pendant l'étape : la mission arrêtée reste arrêtée (l'étape n'est pas marquée finie, rien ne repart)
        if (m.etat !== 'encours') { histoire(m, `${id} : rendu, mais la mission est ${m.etat} : on s'arrête là`); sauver(m); break; }
        if (r === ATTENTE) { st.etat = 'attente'; m.attente = id; sauver(m); break; }
        if (r === 'REFAIRE') { sauver(m); continue; }
        if (r === SAUTE) { st.etat = 'saute'; st.fin = maintenant(); histoire(m, `${id} : sautée`); sauver(m); continue; }
        st.etat = 'fini'; st.fin = maintenant(); m.attente = null; histoire(m, `${id} : fini`); sauver(m);
        if (id === 'publication') await verifierBilanLot(m); // [desc-bilan] la page est sortie : le bilan du lot, si c'était la dernière
      }
      await verifierBilanLot(m); // [desc-bilan] arrêtée, bloquée : le bilan du lot, si c'était la dernière
      await verifierPorteLot(m); // [porte-groupee] plus aucun modèle du lot en route : UNE porte « لانسي » pour le lot
      await rejoindrePorte(m); // [v19-trois] une mission seule prête pendant une porte de lot ouverte : la porte est refaite avec elle
    } finally { enMarche.delete(m.id); }
  }

  /* ---------------------------------------- les boutons du client ---------------------------------------- */
  async function surBouton(data) {
    const x = /^mis:([0-9a-f]{6}):([a-z0-9-]+):(.+)$/.exec(String(data || ''));
    if (!x) return { connu: false };
    const [cle, val] = [x[2], x[3]];
    // « عاود » du message « الكونيكتور … لازم يتعاود يتربط » (un seul message pour tout le bureau) : une sonde TOUT DE SUITE ;
    // tout ce qui n'attendait que des connecteurs revenus reprend. Toujours pas branché : le bouton reste.
    if (cle === 'cnx') {
      if (!attentesConnecteur().length) return { connu: true, texte: 'هاذ السؤال فات' };
      if (!deps.sonder) { let n = 0; for (const a of attentesConnecteur()) { a.reprendre(); n++; } return { connu: true, texte: n ? 'نعاودو' : 'هاذ السؤال فات' }; }
      try { const r = connecteursSondes(await deps.sonder()); return r.reprises && !r.restent ? { connu: true, texte: 'رجع، نكمّلو' } : r.reprises ? { connu: true, texte: 'رجع واحد، نكمّلو', garder: true } : { connu: true, texte: 'مازال ما تربطش', garder: true }; }
      catch (e) { journal('sonde (bouton) : ' + e.message); return { connu: true, texte: 'مازال ما تربطش', garder: true }; }
    }
    const m = missions.get(x[1]);
    if (!m) return { connu: true, texte: 'هاذ الموديل ما بقاش' };
    if (cle === 'stop') { await arreter(m, 'le client a pressé « حبس »'); return { connu: true, texte: 'حبسنا' }; }
    if (cle === 'reprendre') { if (m.etat !== 'bloquee') return { connu: true, texte: 'ماشي محبوسة' }; reprendre(m.id); return { connu: true, texte: 'نعاودو' }; }
    // [desc-bilan] LE NOMBRE RÉEL DE COULEURS, dit sur la question (bouton « ncoul<gen>:K ») : un nombre différent des
    // familles trouvées → il devient le NOMBRE DIT (reponses.couleurs, lu par nombreDitCouleurs) et les familles sont REFAITES
    // avec lui (captures.py --couleurs K, 1er recours ; captures.py tente lui-même la 2e passe par instant, bornée par K,
    // s'il en trouve moins) ; l'écart qui reste est nommé (couleursCompte) et on continue. Une seule correction par question.
    const ncoul = /^ncoul(\d+)$/.exec(cle);
    if (ncoul) {
      const k = +val;
      if (m.etat !== 'encours' || m.attente !== 'couleurs' || +ncoul[1] !== (+m.d.questionCouleurs || 0) || m.d.couleursDites) return { connu: true, texte: 'هاذ السؤال فات' };
      if (!Number.isInteger(k) || k < 1 || k > 8) return { connu: true, texte: '?' };
      const trouvees = m.d.couleurs.length;
      if (k === trouvees) return { connu: true, texte: 'هاذاك هو العدد، سمّي اللونات' };
      m.demande.reponses = { ...(m.demande.reponses || {}), couleurs: k };
      m.d.couleursDites = k; m.d.nombreCorrige = { de: trouvees, a: k, le: maintenant() };
      m.d.questionCouleurs = (+m.d.questionCouleurs || 0) + 1;
      for (const c of m.d.couleurs) { c.nom = null; c.exclue = false; delete c.nommeA; }
      m.etapes.captures = { etat: 'afaire', essais: 0 }; m.etapes.couleurs = { etat: 'afaire', essais: 0 }; m.attente = null;
      histoire(m, `couleurs : le client dit ${k} couleur(s) (la chaîne en avait trouvé ${trouvees}) — nombre dit, familles REFAITES avec ce nombre (captures.py --couleurs ${k})`);
      sauver(m); await envoyer(m, M.couleursRefaites()); avancer(m);
      return { connu: true, texte: 'وصلني' };
    }
    const coul = /^coul(\d+)(?:g(\d+))?$/.exec(cle);
    if (coul) {
      if (m.attente !== 'couleurs') return { connu: true, texte: 'هاذ السؤال فات' };
      // [desc-bilan] un bouton d'une question d'AVANT la correction du nombre ne nomme jamais une famille refaite
      if ((+coul[2] || 0) !== (+m.d.questionCouleurs || 0)) return { connu: true, texte: 'هاذ السؤال فات' };
      const c = m.d.couleurs[+coul[1] - 1]; if (!c) return { connu: true, texte: '?' };
      if (val === 'EXCLURE') { c.exclue = true; c.nom = null; } else if (PALETTE.some(p => p.v === val)) { c.nom = val; c.exclue = false; }
      // « صحيح » sur la PROPOSITION de la chaîne (09/10/2026) : son nom, tel quel (« Noir clair » compris, jamais fusionné)
      else if (val === 'PROPOSE' && c.propose) { c.nom = c.propose; c.exclue = false; }
      else return { connu: true, texte: '?' };
      // casse-4 : l'ORDRE OÙ LE CLIENT NOMME (lu par le mode « nommees » d'ORDRE_COULEURS ; le défaut « foncees » range du foncé
      // au clair et ne s'en sert pas) — chaque réponse prend la place suivante
      if (c.nom) c.nommeA = m.d.nommage = (+m.d.nommage || 0) + 1; else delete c.nommeA;
      histoire(m, `couleur ${c.rang} : ${c.exclue ? 'retirée' : c.nom}${val === 'PROPOSE' ? ' (proposition validée par le client)' : ''}`);
      if (m.d.couleurs.every(k => k.nom || k.exclue)) {
        if (!m.d.couleurs.some(k => k.nom)) {
          m.etat = 'bloquee'; sauver(m); await envoyer(m, M.echec(m.id, NOM_AR.couleurs, 'aucune couleur gardee'));
          // [relecture] 10/10/2026 : ce modèle tombe — comme dans arreter, le bilan du lot et la porte « لانسي » des modèles
          // prêts (avant : la porte attendait ce modèle « en route » jusqu'au prochain redémarrage, le bilan ne partait jamais)
          await verifierBilanLot(m); await verifierPorteLot(m);
          return { connu: true, texte: 'وصلني' };
        }
        fusionnerCouleurs(m);
        m.etapes.couleurs.etat = 'fini'; m.etapes.couleurs.fin = maintenant(); m.attente = null; sauver(m);
        await envoyer(m, M.couleursFinies(new Set(m.d.couleurs.filter(k => !k.exclue).map(k => k.nom)).size));
        avancer(m);
      } else sauver(m);
      return { connu: true, texte: 'وصلني' };
    }
    if (cle === 'monte') {
      const S = m.d.suivi, h = S?.hausseDemandee, [choix, jeton] = String(val).split('.');
      if (m.etat !== 'suivi' || m.attente !== 'monte' || !h) return { connu: true, texte: 'هاذ السؤال فات' };
      // une hausse d'une version d'avant portait sur les AD SETS du test : elle n'est plus posée (le scaling passe par la
      // campagne de scale, CBO) — son bouton ne fait plus rien, et la question se ferme
      if (!h.campagne) { histoire(m, 'vieux bouton de hausse (ad sets du test) : plus posé, le scaling passe par la campagne de scale'); S.hausseDemandee = null; m.attente = null; sauver(m); return { connu: true, texte: 'هاذ السؤال فات' }; }
      // le bouton d'une AUTRE question (une hausse d'avant, déjà posée ou refusée) ne répond jamais à celle d'aujourd'hui
      if (jeton !== String(h.vers_centimes)) return { connu: true, texte: 'هاذ السؤال فات' };
      if (choix === 'non') { histoire(m, 'hausse refusée par le client'); S.hausseDemandee = null; m.attente = null; sauver(m); return { connu: true, texte: 'تمام، البودجي يبقى كيما هو' }; }
      // la porte du coach s'est refermée depuis la question (lue chaque soir, même quand une hausse attend) : rien ne monte
      if (S.porte && S.porte.ouverte === false) { histoire(m, 'hausse pas posée : la porte du coach s\'est refermée depuis la question'); S.hausseDemandee = null; m.attente = null; sauver(m); await envoyer(m, M.scaleFermee()); return { connu: true, texte: 'هاذ السؤال فات' }; }
      try { await monter(m); } catch (e) {
        histoire(m, 'hausse ratée : ' + e.message); sauver(m);
        // la limite d'usage, un connecteur : rien n'a bougé chez Meta, la même question reste (son bouton aussi)
        if (e && e.connecteur) await signalerConnecteur(clesDe(e), m);
        await envoyer(m, M.hausseRatee(m.id, e && e.quota ? `limite d'usage de Claude, reprise ${verrouQuota() ? heureCourte(verrouQuota().reprise) : 'bientot'}` : e && e.connecteur ? `connecteur ${clesDe(e).join(', ')} a reconnecter` : e.message, h.vers_centimes));
      }
      return { connu: true, texte: 'وصلني' };
    }
    // la campagne de SCALE, créée EN PAUSE : elle ne part que sur le « لانسي » du client (un vieux bouton, une mission
    // arrêtée, une scale déjà lancée : rien ne bouge)
    if (cle === 'scale') {
      const sc = m.d.suivi?.scale;
      if (m.etat !== 'suivi' || !sc || sc.etat !== 'creee' || !sc.campagne) return { connu: true, texte: 'هاذ السؤال فات' };
      // « ماشي دروك » (de scalePrete ou de scaleRate) : la scale reste en pause, et le client garde un « لانسي » (sous ce
      // message, et celui de la question : le serveur ne retire plus ses boutons)
      if (val === 'non') { histoire(m, 'scale : le client attend (« ماشي دروك »)'); await envoyer(m, M.scalePasEncore(m.id)); return { connu: true, texte: 'وصلني' }; }
      // la porte du coach s'est refermée depuis la question (ou une perte lourde attend sa réponse) : le vieux « لانسي » ne
      // lance rien ; la question repart d'elle-même le soir où la porte se rouvre
      if ((m.d.suivi.porte && m.d.suivi.porte.ouverte === false) || m.attente === 'perte') {
        sc.fermee = jourLocal(); histoire(m, 'scale pas lancée : la porte du coach s\'est refermée depuis la question'); sauver(m);
        await envoyer(m, M.scaleFermee()); return { connu: true, texte: 'هاذ السؤال فات' };
      }
      if (scaleEnCours.has(m.id)) return { connu: true, texte: 'وصلني' }; // deux pressions : une seule activation
      // LA MÊME LOI QUE LES MISSIONS (09/10/2026) : une scale BLOQUÉE par l'ANCIENNE règle (PUBLISHING ou DRAFT lus comme un
      // échec, après une activation déjà envoyée, rien de lancé) : son « عاود » RELIT dans Meta (relire-scale), il ne
      // réactive jamais. Toute autre panne garde son « عاود » qui active, comme avant.
      const ancienne = scaleAncienneRegle(m, sc);
      if (ancienne) {
        sc.etat = 'publication'; sc.publication = { le: ancienne.le, essais: 0, prochaine: maintenant(), publiee: ancienne.statut === 'PUBLISHING', apresAncienneRegle: true };
        histoire(m, `scale : bloquée par l'ancienne règle (${ancienne.statut} lu comme un échec) — « عاود » RELIT dans Meta, rien n'est réactivé`); sauver(m);
        await relireScale(m);
        if (m.d.suivi?.scale === sc && sc.etat === 'publication') await envoyer(m, M.scaleEnCours(m.id));
        return { connu: true, texte: 'وصلني' };
      }
      scaleEnCours.add(m.id);
      try { await lancerScale(m); } catch (e) { histoire(m, 'scale : activation ratée — ' + e.message); sauver(m); await envoyer(m, M.scaleRate(m.id, e.message)); }
      finally { scaleEnCours.delete(m.id); }
      return { connu: true, texte: 'وصلني' };
    }
    // « عاود دروك » sous lectureRatee : une lecture tout de suite (le client la demande : elle n'est pas bornée), une fois par
    // message (le serveur retire le bouton) ; une lecture déjà faite aujourd'hui, une mission qui ne tourne plus : rien
    // Le bouton ne vaut que le SOIR de l'échec : pressé le lendemain matin, il faisait une lecture du matin qui prenait la
    // place de celle du soir (dernierJour écrit, l'horloge ne relisait plus) — la journée lue à moitié, le verdict du coach
    // sur des heures (07/10/2026, « casse »). Une lecture déjà en route : le client saura comment elle finit.
    if (cle === 'lecture') {
      const S = m.d.suivi;
      if (m.etat !== 'suivi' || !S || S.dernierJour === jourLocal() || S.essaisLecture?.date !== jourLocal()) return { connu: true, texte: 'هاذ السؤال فات' };
      if (enMarche.has(m.id)) { S.essaisLecture.demandee = maintenant(); sauver(m); return { connu: true, texte: 'راني نقرا' }; }
      histoire(m, 'lecture du soir : le client demande « عاود دروك »'); suivreJour(m, { manuel: true });
      return { connu: true, texte: 'نعاودو' };
    }
    if (cle === 'perte') {
      if (m.attente !== 'perte') return { connu: true, texte: 'هاذ السؤال فات' };
      m.attente = null; sauver(m);
      if (val === 'stop') { await arreter(m, 'perte lourde : le client a choisi d\'arrêter'); return { connu: true, texte: 'حبسنا' }; }
      histoire(m, 'perte lourde : le client continue (décision notée)');
      const pv = m.d.suivi?.perteVue;
      noterDecision(m, 'continuer malgre une perte lourde annoncee', pv ? `rapport du ${pv.date} : depense ${pv.depense_da} DA, ${pv.commandes} commandes, ${pv.confirmees} confirmees, ${pv.livrees} livrees ; cout par ${pv.stock === 'stock' ? 'colis attendu' : 'commande'} ${pv.cout} DA pour une limite de ${pv.limite} DA` : 'une perte lourde annoncee par la lecture du soir'); // une note : elle suit, le bouton n'attend pas la file des outils
      return { connu: true, texte: 'تمام، تبقى تخدم' };
    }
    // règle du vendeur (06/10/2026) : la page se publie seule dès qu'elle est prête. Un vieux bouton « نشرها » / « خليها مخبية »
    // (un message d'avant la mise à jour) ne fait plus RIEN — surtout pas « الصفحة باقية مخبية » pour une page qui se publie
    if (cle === 'page') return { connu: true, texte: 'هاذ السؤال فات' };
    // [porte-groupee] LA PORTE DU LOT (« mis:<un modèle prêt>:lanceg:<gen>.oui|non|neuve ») ; un vieux « لانسي » PAR MODÈLE
    // d'un lot (une question d'avant la porte groupée) ne lance plus rien : il n'existe jamais deux portes pour un lot
    if (cle === 'lanceg') return await boutonPorteLot(m, val);
    if (cle === 'lance' && lotGroupe(m)) { histoire(m, 'vieux bouton « لانسي » par modèle : le lot a sa porte groupée, rien ne part'); sauver(m); return { connu: true, texte: 'هاذ السؤال فات' }; }
    // [v19-trois] la question d'une mission seule fermée par « الغي » (« سقسيني » la rouvre) ou reprise dans une porte de lot : son
    // vieux bouton ne lance plus rien
    if (cle === 'lance') {
      const stL = m.etapes.lance || {};
      if (val === 'neuve') {
        if (!stL.annulee || !estSeulPret(m)) return { connu: true, texte: 'هاذ السؤال فات' };
        delete stL.annulee; delete stL.demande; histoire(m, 'lance : « سقسيني » — la question « لانسي » est rouverte'); sauver(m);
        await poserQuestionSeule(m); return { connu: true, texte: 'وصلني' };
      }
      if (stL.annulee || stL.reprisePar) { histoire(m, `vieux bouton « لانسي » : question ${stL.annulee ? 'fermée par « الغي »' : 'reprise dans une porte de lot'}, rien ne part`); sauver(m); return { connu: true, texte: 'هاذ السؤال فات' }; }
    }
    // [v19-trois] LE PIXEL : le bouton pressé = un pixel LU sur le compte de ce modèle ; la campagne repart avec lui (rien n'était créé)
    if (cle === 'pixel') {
      const q = m.d.pixelQuestion, p = q && /^\d+$/.test(val) ? q.pixels[+val] : null;
      if (!q || !p || m.etat !== 'encours' || m.attente !== 'campagne') return { connu: true, texte: 'هاذ السؤال فات' };
      const appliquer = x => {
        const qq = x.d.pixelQuestion; x.demande.reponses.pixel = { id: p.id, nom: p.nom }; x.d.pixel = { id: p.id, nom: p.nom, lu: qq.le, choisiPar: 'client (bouton)' };
        delete x.d.pixelQuestion; if (x.etapes.campagne) x.etapes.campagne.etat = 'afaire'; x.attente = null;
        histoire(x, `pixel : le client choisit « ${p.nom} » (${p.id}) parmi les pixels lus du compte — la campagne repart`); sauver(x); avancer(x);
      };
      appliquer(m);
      // la même question pour les autres modèles du lot (même compte, même nom demandé) : la même réponse, une seule fois
      for (const x of missions.values()) if (x !== m && x.lot && m.lot && x.lot.id === m.lot.id && x.etat === 'encours' && x.attente === 'campagne' && x.d.pixelQuestion && x.d.pixelQuestion.compte === q.compte && memeNomPixel(x.d.pixelQuestion.voulu.nom, q.voulu.nom) && x.d.pixelQuestion.pixels.some(y => String(y.id) === String(p.id))) appliquer(x);
      return { connu: true, texte: 'وصلني' };
    }
    const attendu = { porte: 'porte', lance: 'lance' }[cle];
    if (attendu) {
      if (m.attente !== attendu) return { connu: true, texte: 'هاذ السؤال فات' };
      const st = m.etapes[attendu];
      if (cle === 'lance' && val === 'non') { await envoyer(m, M.pasEncore()); return { connu: true, texte: 'وصلني' }; }
      if (cle === 'porte' && val === 'stop') { await arreter(m, 'le client a refusé de continuer à perte'); return { connu: true, texte: 'حبسنا' }; }
      st.reponse = cle === 'porte' ? 'go' : 'oui'; st.repondu = maintenant();
      if (cle === 'porte') { const be = m.d.be || {}; noterDecision(m, 'continuer malgre la perte annoncee par le break even', `le break even annonce une perte de ${Math.round(Math.abs(+be.par_commande || 0))} DA par commande ; prix minimum ${be.minimums && be.minimums.prix ? Math.round(be.minimums.prix) + ' DA' : 'inconnu'}`); } // la note suit (file des outils)
      st.etat = 'encours'; m.attente = null; histoire(m, `${attendu} : le client a répondu ${st.reponse}`); sauver(m);
      avancer(m);
      return { connu: true, texte: 'وصلني' };
    }
    return { connu: true, texte: '?' };
  }
  /** La décision du client dans le carnet : une NOTE, lancée sans l'attendre (07/10/2026 : « كمّل على مسؤوليتي » attendait
   *  la file des outils — un montage d'un autre modèle, des minutes — et le robot n'écoutait plus rien pendant ce temps).
   *  Une note ratée se lit dans l'historique ; elle ne bloque jamais la chaîne. */
  /** ilSavait : CE QU'IL SAVAIT quand il a décidé (09/10/2026 : « --il-savait » partait SANS valeur, argparse sortait en
   *  code 2 et la décision n'était jamais écrite — en silence). */
  function noterDecision(m, decision, ilSavait = '') {
    const savait = String(ilSavait || '').replace(/\s+/g, ' ').trim().slice(0, 400) || 'rien de plus que la décision';
    Promise.resolve().then(() => outilCarnet(m, 'carnet-decision', ['--noter', '--produit', m.code, '--date', maintenant().slice(0, 10), '--decision', decision, '--il-savait', savait]))
      .catch(e => { histoire(m, 'carnet : décision pas notée — ' + e.message); sauver(m); });
  }
  /** Un outil du CARNET (fiche, mesure, décision) : jamais avalé — un code non nul (ou un outil qui ne part pas) est NOTÉ dans
   *  l'historique de la mission ; il ne bloque jamais la chaîne. */
  async function outilCarnet(m, nom, args) {
    let r;
    try { r = await outil(m, nom, '0-CARNET/manita-carnet.py', args, { dureeMaxMs: 60000 }); }
    catch (e) { histoire(m, `carnet : ${nom} pas noté — ${e.message}`); sauver(m); return null; }
    if (r && (r.raison || r.code !== 0)) { histoire(m, `carnet : ${nom} pas noté (code ${r.code}${r.raison ? ', ' + r.raison : ''}) — ${extrait(r.sortie, 200)}`); sauver(m); }
    return r;
  }
  /** Deux familles que le CLIENT a nommées pareil (il a pressé le même bouton de la palette : la lumière a coupé une couleur
   *  en deux) n'en font qu'une — sa décision, dite dans l'historique. La chaîne, elle, ne fusionne jamais (nommerSansFusion). */
  function fusionnerCouleurs(m) {
    const vues = new Map();
    for (const c of m.d.couleurs) { if (c.exclue) continue; if (vues.has(c.nom)) { vues.get(c.nom).captures.push(...c.captures); c.exclue = true; c.fusionneeDans = vues.get(c.nom).rang; histoire(m, `couleurs : la famille ${c.rang} rejoint la ${vues.get(c.nom).rang} (« ${c.nom} » : le même nom choisi par le client)`); } else vues.set(c.nom, c); }
  }

  async function arreter(m, pourquoi) {
    m.etat = 'arretee'; m.arreteeLe = maintenant(); m.attente = null; histoire(m, 'ARRÊTÉE : ' + pourquoi); sauver(m);
    // une activation TENTÉE compte aussi (refusée par la relecture, elle a pu allumer le test) : on met en pause
    let p = { fautes: [], pausee: true };
    if (m.d.campagne && (m.d.lanceLe || m.d.activationTentee)) {
      const sc = m.d.suivi?.scale?.campagne; // la campagne de scale s'arrête avec le modèle
      try {
        const r = await tourClaude(m, 'pause', { dept: 'testing', outils: ['meta.ads_update_entity', 'meta.ads_get_ad_entities'], schema: { type: 'object', properties: { statut: { type: 'string' }, erreur: { type: 'string' } }, required: ['statut'] },
          message: `Le client a demandé d'arrêter. Mets en PAUSE la campagne ${m.d.campagne.id}${sc ? ` ET la campagne de scale ${sc.id}` : ''} (ads_update_entity entity_type "campaign", fields {"status":"PAUSED"}, rien d'autre ; même une campagne déjà en pause reçoit sa pause : le bureau la relit), relis ${sc ? 'leurs statuts' : 'son statut'}, rends {statut}. Ne touche à aucun autre objet.` });
        p = relirePause(m, r, [m.d.campagne.id, sc?.id]); // la même relecture que l'activation : dans les appels BRUTS
      } catch (e) { p = { fautes: [`la pause n'est pas passée, mets la pub en pause dans Meta : ${e.message}`], pausee: false }; }
      if (p.fautes.length) histoire(m, 'pause relue : ' + p.fautes.join(' ; '));
    }
    // « راني حبستها » seulement si c'est vrai ; sinon le client lit ce qui cloche (« حبس » refait la pause)
    if (p.pausee) await envoyer(m, M.arretee());
    if (p.fautes.length) await envoyer(m, M.echec(m.id, 'حبس البوب', p.fautes[0]));
    await verifierBilanLot(m); // [desc-bilan] un modèle arrêté : le bilan du lot, si c'était le dernier en route
    await verifierPorteLot(m); // [porte-groupee] le dernier modèle en route s'arrête : la porte du lot pour les modèles prêts
  }
  /** [relecture] 10/10/2026 : une activation passée APRÈS le « حبس » du client (la pause était partie avant elle, sur des objets
   *  encore éteints) : la pause est refaite, une fois, et c'est écrit ; le client relit « راني حبستها » seulement si elle passe. */
  async function repauserApresActivation(m) {
    if (m.d.repauseeApresActivation) return;
    m.d.repauseeApresActivation = maintenant();
    histoire(m, 'activation passée APRÈS « حبس » (la pause était en file avant elle) : la pause est refaite'); sauver(m);
    await arreter(m, 'pause refaite : l\'activation est passée après « حبس »');
  }
  function reprendre(id) {
    const m = missions.get(id); if (!m || !['bloquee', 'encours', 'connecteur', 'quota'].includes(m.etat)) return false;
    delete m.connecteur; delete m.quota;
    for (const st of Object.values(m.etapes)) if (st.etat === 'echec' || st.etat === 'encours') { st.etat = 'afaire'; st.essais = 0; }
    m.etat = 'encours'; histoire(m, 'reprise'); sauver(m); avancer(m); return true;
  }

  /** demarrer: false — la mission est écrite mais ne part pas encore (un lot fait naître TOUTES ses missions, puis les lance). */
  function creer(demande, lot = null, { demarrer = true } = {}) {
    let id; do { id = crypto.randomBytes(3).toString('hex'); } while (missions.has(id));
    const rang = [...missions.values()].length + 1;
    let code = demande.reponses.nom && demande.reponses.nom !== 'auto' ? String(demande.reponses.nom).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) || `M${String(rang).padStart(2, '0')}` : `M${String(rang).padStart(2, '0')}`;
    { // un modèle de lot : son code (carnet, noms Meta) n'est celui d'aucune autre mission — [relecture] 10/10/2026 : une mission
      // seule (N = 1) aussi (deux « Abaya Lina » avaient le même code : mêmes SKU, carnet commun, mesures mêlées pour le coach)
      const pris = new Set([...missions.values()].map(x => x.code)); const base = code.slice(0, 8);
      for (let i = lot ? lot.rang : 2; pris.has(code); i++) code = `${base}${i}`;
    }
    const m = { id, code, creeLe: maintenant(), demande, etat: 'encours', etape: 'descente', etapes: {}, d: { cheminLibre: true }, attente: null, historique: [] };
    if (lot) {
      const v = listerVideos(lot.rushes); let octets = 0; for (const f of v) octets += fs.statSync(f).size;
      m.lot = { id: lot.id, rang: lot.rang, rangPlan: lot.rangPlan || lot.rang, total: lot.total, nom: lot.nom, couleurs: lot.couleurs || [], plan: lot.plan || null, modelePlan: lot.modelePlan || null, couleursClient: lot.couleursClient === true };
      Object.assign(m.d, { rushes: lot.rushes, nbVideos: v.length, octets });
      m.etapes.descente = { etat: 'fini', essais: 0, fin: maintenant(), lot: lot.id };
      m.etapes.separation = { etat: 'fini', essais: 0, fin: maintenant(), lot: lot.id };
      m.etape = 'captures';
    } else if (demande.rushesLot) {
      // N = 1 vérifié par separer.py (08/10/2026) : un seul groupe pur — la mission d'avant, sur le Drive que le lot a DÉJÀ
      // descendu (jamais retéléchargé) ; captures.py l'aplatit (aplatirRushes) comme une mission seule
      const v = listerVideos(demande.rushesLot); let octets = 0; for (const f of v) octets += fs.statSync(f).size;
      Object.assign(m.d, { rushes: demande.rushesLot, nbVideos: v.length, octets });
      m.etapes.descente = { etat: 'fini', essais: 0, fin: maintenant(), lot: demande.depuisLot || null };
      m.etapes.separation = { etat: 'saute', essais: 0 };
      m.etape = 'captures';
    } else m.etapes.separation = { etat: 'saute', essais: 0 }; // un lien = un modèle : rien à séparer
    missions.set(id, m); histoire(m, lot ? `créée (${code}) — modèle ${lot.rang}/${lot.total} du lot ${lot.id}${m.lot.couleursClient ? ' (couleurs à nommer par le client)' : ''}` : `créée (${code})`); sauver(m); if (demarrer) avancer(m); return m;
  }

  /* ---------------------------------------- les LOTS : un lien Drive, plusieurs modèles ---------------------------------------- */
  // descente PARTAGÉE → candidats (pixels : separer.py) → lecture des planches (Claude, images seulement, plan.json)
  // → construction (un dossier PLAT par modèle) → « pret » : l'accueil fait confirmer chaque modèle → une mission par modèle.
  // UN SEUL LIEN PASSE TOUJOURS (08/10/2026, décisions du vendeur) : un nombre trouvé ≠ N → une 2e lecture (l'écart écrit),
  // deux lectures croisées, ce qui est disputé est mis de côté ; le nombre RÉEL pilote la suite (photos, questions, budget,
  // missions). Un modèle refusé par le client est retiré, les autres continuent. Seul arrêt : aucun groupe pur (« vide »).
  // N = 1 n'est plus cru sur parole : un lot d'UN modèle (n = 1, sa demande) — un seul groupe pur → « seul », la mission
  // d'avant naît ici sur le Drive déjà descendu ; plusieurs → bascule (lecture, photos, questions de chaque modèle).
  const RACINE_LOTS = path.join(maison, 'lots');
  fs.mkdirSync(RACINE_LOTS, { recursive: true });
  const lots = new Map();
  for (const d of fs.readdirSync(RACINE_LOTS)) { const l = lireJSON(path.join(RACINE_LOTS, d, 'lot.json')); if (l && l.id) lots.set(l.id, l); }
  const dossierLot = l => path.join(RACINE_LOTS, l.id);
  const sepLot = l => path.join(dossierLot(l), 'separation');
  const sauverLot = l => { const f = path.join(dossierLot(l), 'lot.json'); fs.mkdirSync(dossierLot(l), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(l, null, 1)); renommerSur(t, f); };
  const histoireLot = (l, quoi) => { l.historique.push({ quand: maintenant(), quoi }); if (l.historique.length > 200) l.historique = l.historique.slice(-200); journal(`lot ${l.id} : ${quoi}`); };
  const outilLot = (l, nom, script, args, o = {}) => travaux.lancer({ nom: `lot-${l.id}/${nom}`, script: script ? path.join(atelier, script) : null, code: o.code || null,
    args, cwd: dossierLot(l), env: null, journalFichier: path.join(dossierLot(l), 'journal', `${nom}.log`), dureeMaxMs: o.dureeMaxMs || 3600000, inactiviteMaxMs: o.inactiviteMaxMs || 900000 });
  // LE SEUL ARRÊT (08/10/2026) : aucun groupe pur — dit au client, on attend son prochain lien (plus aucun repli « un lien par modèle »)
  const vide = msg => Object.assign(new Error(msg), { vide: true, definitif: true });
  const NOMS_PALETTE = PALETTE.map(p => p.v);
  // le plan rendu par Claude (06/10/2026) : nombreVu et doute contre l'ancrage sur N ; une preuve de construction par
  // modèle ; un segment cite son tronçon (T#, traduit par le bureau en nom exact) ; une exclusion porte toujours sa raison
  // et peut viser un groupe entier (G#) ou un tronçon
  const SCHEMA_PLAN = { type: 'object', properties: {
    nombreVu: { type: 'integer' }, doute: { type: 'string' },
    modeles: { type: 'array', items: { type: 'object', properties: {
      nom: { type: 'string' }, preuve: { type: 'string' }, couleurs: { type: 'array', items: { type: 'string', enum: NOMS_PALETTE } }, groupes: { type: 'array', items: { type: 'string' } },
      segments: { type: 'array', items: { type: 'object', properties: { troncon: { type: 'string' }, rush: { type: 'string' }, de: { type: 'number' }, a: { type: 'number' }, coloris: { type: 'string', enum: NOMS_PALETTE } }, required: ['troncon', 'de', 'a', 'coloris'] } } },
      required: ['nom', 'preuve', 'couleurs', 'segments'] } },
    exclusions: { type: 'array', items: { type: 'object', properties: { groupe: { type: 'string' }, troncon: { type: 'string' }, rush: { type: 'string' }, de: { type: 'number' }, a: { type: 'number' }, pourquoi: { type: 'string' } }, required: ['pourquoi'] } },
    erreur: { type: 'string' } }, required: ['nombreVu', 'doute', 'modeles', 'exclusions'] };

  /** Une planche trop lourde, ou trop grande (l'API refuse un côté de plus de 8 000 px), est réduite (ffmpeg) dans une boîte
   *  de 2 000 px ; sinon elle part telle quelle. reduire : toutes réduites (la requête entière a une limite de taille). */
  async function imagePourClaude(source, sortie, reduire = false) {
    const s = await sonderA(ffprobe(), source); // sans ffprobe on ne sait pas mesurer : on garde la règle du poids seul
    const tailleOk = !s.ok || (s.largeur <= 7900 && s.hauteur <= 7900);
    if (!reduire && tailleOk && fs.statSync(source).size <= 3.5e6 && /\.jpe?g$/i.test(source)) return source;
    fs.mkdirSync(path.dirname(sortie), { recursive: true }); fs.rmSync(sortie, { force: true }); // jamais l'image d'un passage d'avant
    await executer(ffmpeg(), ['-y', '-v', 'error', '-i', source, '-vf', 'scale=\'min(2000,iw)\':\'min(2000,ih)\':force_original_aspect_ratio=decrease', '-q:v', '4', sortie], { timeout: 120000 });
    if (!fs.existsSync(sortie) || fs.statSync(sortie).size > 4.5e6) throw new Error(`planche trop lourde pour la lecture : ${path.basename(source)}`);
    return sortie;
  }
  /** La photo qu'un client confirme : faite DEPUIS le dossier plat du modèle (ce qui servira vraiment), six vidéos au plus. */
  async function photoModele(dossierVideos, sortie) {
    const v = listerVideos(dossierVideos).slice(0, 6); if (!v.length) return null;
    const tmp = sortie + '.d'; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    try {
      const images = [];
      for (const f of v) {
        const s = await sonderA(ffprobe(), f); const t = s.ok && s.duree > 0 ? s.duree * 0.4 : 0;
        const o = path.join(tmp, `i${String(images.length).padStart(2, '0')}.jpg`);
        await executer(ffmpeg(), ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', f, '-frames:v', '1', '-vf', 'scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:white', '-q:v', '3', o], { timeout: 120000 });
        if (fs.existsSync(o) && fs.statSync(o).size > 0) images.push(o);
      }
      if (!images.length) return null;
      const col = images.length === 4 ? 2 : Math.min(3, images.length), lig = Math.ceil(images.length / col);
      // une case vide reste BLANCHE (une image répétée ferait croire à une vidéo de plus)
      while (images.length < col * lig) { const o = path.join(tmp, `i${String(images.length).padStart(2, '0')}.jpg`); await executer(ffmpeg(), ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=360x640', '-frames:v', '1', o], { timeout: 60000 }); if (!fs.existsSync(o)) fs.copyFileSync(images[images.length - 1], o); images.push(o); }
      await executer(ffmpeg(), ['-y', '-v', 'error', '-framerate', '1', '-start_number', '0', '-i', path.join(tmp, 'i%02d.jpg'), '-vf', `tile=${col}x${lig}:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', sortie], { timeout: 120000 });
      return fs.existsSync(sortie) && fs.statSync(sortie).size > 0 ? sortie : null;
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  // un nom de fichier s'écrit de deux façons en Unicode (« é » composé ou non : le disque d'un Mac garde souvent la forme
  // décomposée, Claude rend la forme composée) : on compare en NFC et on écrit TOUJOURS le nom exact des candidats
  const cleRush = r => String(r ?? '').replace(/\\/g, '/').normalize('NFC');
  // les planches écrivent les noms en lettres latines SEULES (latin() de separer.py : NFKD, accents ôtés, espaces réduits)
  const sansAccents = r => cleRush(r).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const nombre = v => (v === undefined || v === null || v === '' || typeof v === 'object' ? NaN : +v);
  // un id du bureau (T#, R#, G#) tel que Claude l'écrit : « t3 », « T03 » = T3 (06/10/2026)
  const normId = s => String(s ?? '').trim().toUpperCase().replace(/^([TRG])0+(?=\d)/, '$1');
  /** Le nom d'une vidéo tel que Claude l'écrit → le nom EXACT des candidats. Les planches écrivent le nom de base, SANS
   *  ACCENTS, précédé des ids « T# » (tronçon) et « R# » (vidéo) : on lit le nom de la liste (NFC ou NFD), le nom sans
   *  accents (chemin ou nom de base, s'il ne désigne qu'une seule vidéo), un préfixe T# / R#, ou l'id seul. Un id inconnu,
   *  ou deux indices qui désignent deux vidéos différentes : refusé, jamais deviné. */
  function lecteurDeRushes(l) {
    const tous = [...l.d.groupes.flatMap(g => g.troncons), ...(l.d.troncons || [])];
    const exact = new Map(), parTroncon = new Map(), parVideo = new Map(), parLatin = new Map(), parBase = new Map();
    const ajouter = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
    for (const t of tous) {
      const k = cleRush(t.rush); if (!exact.has(k)) exact.set(k, t.rush);
      if (t.id) parTroncon.set(normId(t.id), t);
      if (t.video) ajouter(parVideo, normId(t.video), k);
    }
    for (const [id, r] of Object.entries(l.d.idsVideos || {})) if (exact.has(cleRush(r))) ajouter(parVideo, normId(id), cleRush(r));
    for (const k of exact.keys()) { ajouter(parLatin, sansAccents(k), k); ajouter(parBase, sansAccents(k.split('/').pop()), k); }
    const seul = e => (e && e.size === 1 ? [...e][0] : null);
    const parNom = n => { const k = cleRush(n).trim(); return !k ? null : exact.has(k) ? k : (seul(parLatin.get(sansAccents(k))) || seul(parBase.get(sansAccents(k.split('/').pop())))); };
    const ID = /^[\s[(]*([TR]\d+)[\])]?(?=[\s:·,|–—-]|$)[\s:·,|–—-]*/i;
    function resoudre(texte) {
      const brut = cleRush(texte).trim(); if (!brut) return null;
      const entier = parNom(brut); if (entier) return { rush: exact.get(entier) }; // un vrai nom qui commencerait par « R2 … »
      let reste = brut, x; const vus = new Set();
      while (reste && (x = ID.exec(reste)) && x[0]) {
        const id = normId(x[1]); reste = reste.slice(x[0].length);
        const k = id[0] === 'T' ? (parTroncon.has(id) ? cleRush(parTroncon.get(id).rush) : null) : seul(parVideo.get(id));
        if (!k) return { erreur: `id inconnu « ${id} » dans « ${brut.slice(0, 60)} »` };
        vus.add(k);
      }
      if (reste) { const k = parNom(reste); if (k) vus.add(k); else if (!vus.size) return null; }
      if (vus.size > 1) return { erreur: `« ${brut.slice(0, 60)} » désigne deux vidéos différentes` };
      return vus.size ? { rush: exact.get([...vus][0]) } : null;
    }
    return { resoudre, parTroncon, exact };
  }
  /** La part d'un tronçon couverte par des morceaux {rush, de, a} (recouvrements comptés une fois). */
  const couvert = (liste, t) => {
    const iv = liste.filter(x => cleRush(x.rush) === cleRush(t.rush)).map(x => [Math.max(x.de, t.de), Math.min(x.a, t.a)]).filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0]);
    let n = 0, fin = -Infinity; for (const [x, y] of iv) if (y > fin) { n += y - Math.max(x, fin); fin = y; }
    return n;
  };
  /** Les tronçons MESURÉS d'un lot, par vidéo (sans recoller les trous) : la matière saine. */
  const intervallesMesures = l => { const m = new Map(); for (const t of [...l.d.groupes.flatMap(g => g.troncons), ...(l.d.troncons || [])]) { const k = cleRush(t.rush); if (!m.has(k)) m.set(k, []); m.get(k).push([+t.de, +t.a]); } for (const [k, v] of m) m.set(k, ivUnion(v)); return m; };
  /** Les morceaux SAINS de segments : posés sur un tronçon mesuré, hors des exclusions, d'une demi-seconde au moins. */
  const morceauxSains = (segments, mesures, exclusions = []) => segments.flatMap(sg => {
    const k = cleRush(sg.rush), ex = exclusions.filter(e => cleRush(e.rush) === k).map(e => [+e.de, +e.a]);
    return ivMoins(ivInter([[+sg.de, +sg.a]], mesures.get(k) || []), ex).filter(([x, y]) => y - x >= 0.5 - 1e-6).map(([de, a]) => ({ rush: sg.rush, de, a }));
  });
  // Une couleur qui change n'est JAMAIS une raison d'exclure un vêtement qu'on voit (06/10/2026 : le vrai Claude a exclu tout
  // le petit modèle, « transitions rapides, impossible d'isoler un coloris unique », puis coupé un vêtement en deux pour
  // tomber sur N). Lecture ÉTROITE d'une raison : elle ne parle QUE de couleur (aucun flou, décor, plan vide, deux modèles…).
  const RAISON_COULEUR = /multi-?couleurs?|multicolore|plusieurs (couleurs|teintes|coloris)|(seul|unique) coloris|coloris (unique|seul)|chang\w* (de |vite de |rapides? de )?(couleurs?|teintes?|coloris)|(couleurs?|teintes?|coloris) (qui )?chang/i;
  const RAISON_VRAIE = /\bflou|d[ée]cor|v[eê]tement (absent|invisible)|sans (aucun )?v[eê]tement|aucun v[eê]tement|pas de v[eê]tement|[ée]cran|image noire|\bnoir complet|\bvides?\b|deux (mod[eè]les|v[eê]tements|tenues|pi[eè]ces)|autres? (mod[eè]les?|v[eê]tements?)|plusieurs (mod[eè]les|v[eê]tements)|m[ée]lang|hors (du )?champ|personne|\blogo|\btexte/i;
  const raisonValable = p => !!p && !(RAISON_COULEUR.test(p) && !RAISON_VRAIE.test(p));
  /** 2e méthode sur le plan de Claude : chaque segment repose sur les tronçons MESURÉS des candidats (au moins la moitié de sa
   *  durée ; ce qui tombe dans un trou mesuré — personne, image noire — est retiré), deux modèles ne se partagent jamais un
   *  moment, CHAQUE groupe est dans un modèle ou exclu avec une raison valable (jamais oublié), et chaque modèle porte sa
   *  preuve. Les fautes d'une même phase sont dites ENSEMBLE (06/10/2026) : la 2e lecture est la dernière, Claude doit tout
   *  savoir dès le premier refus. */
  function verifierPlan(s, l, { strict = false } = {}) {
    // STRICT (09/10/2026, le plan croisé) : rien n'est réparé en silence — un segment doit tenir EN ENTIER dans les tronçons
    // mesurés, ne toucher aucune exclusion, ne partager aucun instant avec un autre modèle (pas d'arrondi de 0,3 s), et chaque
    // modèle garde au moins un morceau SAIN (posé sur un vrai tronçon, pas dans un trou recollé) d'une demi-seconde
    const tolerance = 1.5, jeu = 0.05;
    const lu = lecteurDeRushes(l), connus = new Map();
    for (const t of [...l.d.groupes.flatMap(g => g.troncons), ...(l.d.troncons || [])]) { const k = cleRush(t.rush); if (!connus.has(k)) connus.set(k, []); connus.get(k).push([t.de, t.a]); }
    // la preuve manquante est dite avec TOUTE autre faute (elle ne change aucun calcul) : un seul refus pour tout corriger
    const fautes = []; let fautePreuve = null;
    const dire = () => { if (!fautes.length) return; if (fautePreuve) fautes.push(fautePreuve); throw new Error([...new Set(fautes)].slice(0, 6).join(' ; ')); };
    /** Un segment ou une exclusion → {rush exact, de, a} : le tronçon cité (T#, traduit ICI en nom exact) fait foi ; plusieurs
     *  tronçons cités (« T9-T11 ») doivent être dans la MÊME vidéo ; un id inventé est refusé ; un nom écrit qui désigne une
     *  AUTRE vidéo que son tronçon est refusé ; sans bornes, un tronçon cité (un seul) se prend en entier. */
    const situer = (x, quoi) => {
      const brutT = String(x.troncon ?? '').trim(), t = brutT ? lu.parTroncon.get(normId(brutT)) : null;
      let viaT = null;
      if (brutT && !t) {
        const r = lu.resoudre(brutT);
        if (r && r.erreur) throw new Error(`le plan cite un tronçon ou un rush inconnu des candidats : ${r.erreur}`);
        viaT = r ? r.rush : null;
      }
      const n = String(x.rush ?? '').trim() ? lu.resoudre(x.rush) : null;
      if (n && n.erreur) throw new Error(`le plan cite un rush inconnu des candidats : ${n.erreur}`);
      const parT = t ? t.rush : viaT;
      if (parT && n && cleRush(n.rush) !== cleRush(parT)) throw new Error(`${quoi === 'exclusion' ? 'exclusion incohérente' : `${quoi} incohérent`} : le tronçon ${brutT} est dans « ${parT} », le plan écrit « ${String(x.rush).slice(0, 60)} »`);
      const rush = parT || (n ? n.rush : null);
      if (!rush) return { inconnu: String(x.rush || x.troncon || '').slice(0, 60) };
      let de = nombre(x.de), a = nombre(x.a);
      if (t && Number.isNaN(de) && Number.isNaN(a)) { de = t.de; a = t.a; }
      return { rush: lu.exact.get(cleRush(rush)) ?? rush, de, a };
    };
    const modeles = [], noms = new Set();
    for (const [i, x] of (s.modeles || []).entries()) {
      let nom = String(x.nom || '').replace(/\s+/g, ' ').trim().slice(0, 40) || `Modele ${i + 1}`;
      while (noms.has(nom.toLowerCase())) nom = `${nom} ${i + 1}`;
      noms.add(nom.toLowerCase());
      const couleurs = [...new Set((x.couleurs || []).filter(c => NOMS_PALETTE.includes(c)))];
      const segments = [], courts = []; let fautif = false;
      for (const sg of x.segments || []) {
        try {
          const p = situer(sg, 'segment');
          if (p.inconnu !== undefined) throw new Error(`le plan cite un rush inconnu des candidats : « ${p.inconnu} »`);
          const { rush, de, a } = p, tr = connus.get(cleRush(rush));
          if (!(de >= 0 && a > de)) throw new Error(`segment impossible : ${rush} ${sg.de} → ${sg.a}`);
          // plus court que la COUPE MINIMALE (09/10/2026) : ignoré, comme le message le dit à Claude (avant : « hors des tronçons
          // mesurés », la lecture entière refusée) ; gardé de côté pour reconnaître une vidéo qui ALTERNE deux vêtements
          if (a - de < COUPE_MINI_S - 1e-6) { courts.push({ rush, de, a }); continue; }
          // les tronçons voisins (un même vêtement qui change de couleur) se recollent ; un trou de plus de 1,5 s reste un trou
          const blocs = []; for (const [d0, a0] of [...tr].sort((x, y) => x[0] - y[0])) { const b = blocs[blocs.length - 1]; if (b && d0 <= b[1] + tolerance) b[1] = Math.max(b[1], a0); else blocs.push([d0, a0]); }
          const morceaux = blocs.map(([d0, a0]) => [+Math.max(d0, de).toFixed(2), +Math.min(a0, a).toFixed(2)]).filter(([x, y]) => y - x >= 0.5);
          const couvre = morceaux.reduce((n, [x, y]) => n + y - x, 0);
          if (strict ? couvre < (a - de) - jeu : couvre < 0.5 * (a - de)) throw new Error(`segment hors des tronçons mesurés${strict ? ' (strict)' : ''} : ${rush} ${de} → ${a}`);
          const coloris = NOMS_PALETTE.includes(sg.coloris) ? sg.coloris : (couleurs[0] || null);
          if (coloris && !couleurs.includes(coloris)) couleurs.push(coloris);
          for (const [d2, a2] of morceaux) segments.push({ rush, de: d2, a: a2, coloris });
        } catch (e) { fautes.push(e.message); fautif = true; }
      }
      modeles.push({ nom, preuve: String(x.preuve || '').replace(/\s+/g, ' ').trim().slice(0, 300), couleurs, declares: new Set((x.groupes || []).map(String)), segments, courts, fautif });
    }
    // LA VIDÉO QUI ALTERNE DEUX VÊTEMENTS (09/10/2026, une vidéo réelle mesurée : bascule toutes les 0,4 s) : un modèle dont TOUS
    // les morceaux dans une vidéo sont plus courts que la coupe minimale (au moins deux) ne s'y voit que par éclairs — la vidéo
    // est ÉCARTÉE en entier (jamais rattachée à un modèle), nommée, et la lecture n'est PAS refusée pour autant
    const alternees = new Map();
    const marquerAlternee = r => { const k = cleRush(r); if (!alternees.has(k)) alternees.set(k, lu.exact.get(k) ?? r); };
    for (const md of modeles) {
      const parR = new Map(); for (const c of md.courts) parR.set(cleRush(c.rush), [...(parR.get(cleRush(c.rush)) || []), c]);
      // deux éclairs au moins, et deux qui se suivent à moins de deux coupes minimales (une BASCULE rapide) : deux miettes
      // aux deux bouts d'une longue prise donnée à un autre modèle ne sont pas une alternance (rien n'est écarté pour elles)
      const rapide = cs => cs.slice().sort((x, y) => x.de - y.de).some((c, i, t) => i > 0 && c.de - t[i - 1].a <= 2 * COUPE_MINI_S + 1e-6);
      // 10/10/2026 (« casse ») : un modèle qui garde aussi un petit morceau d'une demi-seconde à une seconde dans la vidéo (deux
      // images de 0,4 s recollées) ne s'y voit toujours QUE par éclairs : moins d'une seconde gardée en tout n'empêche rien
      const longDans = k => md.segments.filter(sg => cleRush(sg.rush) === k).reduce((n, sg) => n + sg.a - sg.de, 0);
      for (const [k, cs] of parR) if (cs.length >= 2 && rapide(cs) && longDans(k) < 2 * COUPE_MINI_S - 1e-6) marquerAlternee(cs[0].rush);
    }
    // LA BASCULE ENTRE MODÈLES (10/10/2026, « casse ») : la lecture d'une vidéo qui alterne toutes les 0,4 s donne souvent des
    // morceaux de 0,4 ET de 0,8 s (deux images recollées) à CHAQUE modèle — aucun ne s'y voit « que par éclairs » et la vidéo
    // restait rattachée aux deux. Dans une vidéo, trois bascules au moins d'un modèle à un autre, chacune entre deux morceaux
    // qui se touchent (≤ une seconde d'écart) dont le plus court fait moins d'une seconde : une alternance, écartée en entier.
    // Une seule prise par modèle (A puis B, même avec une miette à chaque bout) n'en fait jamais trois.
    {
      const parRush = new Map();
      modeles.forEach((md, i) => { for (const sg of [...md.segments, ...md.courts]) { const k = cleRush(sg.rush); if (!parRush.has(k)) parRush.set(k, []); parRush.get(k).push({ i, de: +sg.de, a: +sg.a, rush: sg.rush }); } });
      for (const [k, ps] of parRush) {
        ps.sort((x, y) => x.de - y.de); let bascules = 0;
        for (let j = 1; j < ps.length; j++) { const p = ps[j - 1], q = ps[j]; if (p.i !== q.i && q.de - p.a <= 2 * COUPE_MINI_S + 1e-6 && Math.min(p.a - p.de, q.a - q.de) < 2 * COUPE_MINI_S - 1e-6) bascules++; }
        if (bascules >= 3) marquerAlternee(ps[0].rush);
      }
    }
    for (const md of modeles) if (!md.segments.length && !md.fautif && !(md.courts.length && md.courts.every(c => alternees.has(cleRush(c.rush))))) fautes.push(`le modèle « ${md.nom} » n'a aucun segment utilisable`);
    // la preuve : les détails de construction qui font de ce vêtement un modèle à part (pas la mannequin ni le décor)
    const sansPreuve = modeles.filter(md => md.preuve.length < 8).map(md => md.nom);
    if (sansPreuve.length) fautePreuve = `modèle sans « preuve » de construction : ${sansPreuve.join(', ')}`;
    dire();
    // Le plan écrit ne laisse JAMAIS un instant à deux modèles, ni un instant exclu à un modèle (separer.py, selon sa
    // version, refuse ou retire ; le bureau rend un plan juste pour les deux). Dans le doute, l'instant ne va à PERSONNE.
    const sans = (sg, trous) => trous.reduce((ms, [x, y]) => ms.flatMap(p => [{ ...p, a: Math.min(p.a, x) }, { ...p, de: Math.max(p.de, y) }]).filter(p => p.a - p.de > 1e-6), [sg]);
    const garder = () => { for (const md of modeles) { md.segments = md.segments.filter(sg => sg.a - sg.de >= 0.5); if (!md.segments.length) throw new Error(`le modèle « ${md.nom} » n'a aucun segment utilisable (exclu ou disputé)`); } };
    // 1. les exclusions (décor, flou, deux modèles à la fois) : un groupe entier (G#), un tronçon (T#) ou un moment d'une
    // vidéo, ramenées dans la vidéo, puis retirées des modèles. Une exclusion qui ne désigne rien de connu ne retire rien ;
    // une exclusion qui cite un id inventé, ou un tronçon hors du groupe qu'elle nomme, est refusée (jamais « tout le groupe »
    // par défaut). Un groupe n'est « exclu en entier » que si l'exclusion le nomme SANS tronçon ni moment.
    const duree = new Map(Object.entries(l.d.durees || {}).map(([r, d]) => [cleRush(r), +d]));
    const exclusions = [], nommes = new Map();
    for (const e of s.exclusions || []) {
      const pourquoi = String(e.pourquoi || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      const idG = normId(e.groupe), g = idG ? l.d.groupes.find(G => normId(G.id) === idG) : null;
      let p = null;
      if (String(e.troncon ?? '').trim() || String(e.rush ?? '').trim()) {
        try { p = situer(e, 'exclusion'); } catch (err) { fautes.push(err.message); continue; }
        if (p.inconnu !== undefined || Number.isNaN(p.de) || Number.isNaN(p.a)) p = null; // rien de lisible : le groupe nommé, sinon rien
      }
      if (p && g && !g.troncons.some(t => cleRush(t.rush) === cleRush(p.rush) && Math.min(t.a, p.a) - Math.max(t.de, p.de) > 0.05)) {
        fautes.push(`exclusion incohérente : ${String(e.troncon || e.rush).slice(0, 40)} (${p.de} → ${p.a} s) n'est pas dans le groupe ${g.id}`); continue;
      }
      const cibles = p ? [p] : g ? g.troncons.map(t => ({ rush: t.rush, de: t.de, a: t.a })) : [];
      if (g && !p && pourquoi) nommes.set(g.id, pourquoi);
      for (const c of cibles) {
        const k = cleRush(c.rush), fin = duree.get(k) > 0 ? duree.get(k) : Math.max(...connus.get(k).map(x => x[1]));
        const de = Math.max(0, +(+c.de).toFixed(2)), a = Math.min(fin, +(+c.a).toFixed(2));
        if (Number.isFinite(de) && Number.isFinite(a) && a - de > 0.05) exclusions.push({ rush: lu.exact.get(k), de, a, pourquoi });
      }
    }
    // la même vidéo, nommée par Claude (« deux vêtements alternés ») : écartée EN ENTIER elle aussi ; puis chaque vidéo alternée
    // devient une exclusion de toute sa durée, et un modèle qui n'avait QUE cette matière est RETIRÉ (dit au client), jamais
    // un modèle sans vidéo ni une lecture refusée pour lui
    for (const e of exclusions) if (raisonValable(e.pourquoi) && RAISON_ALTERNEE.test(e.pourquoi)) marquerAlternee(e.rush);
    for (const [k, rush] of alternees) {
      const fin = duree.get(k) > 0 ? duree.get(k) : Math.max(0, ...(connus.get(k) || []).map(x => x[1]));
      if (fin > 0) exclusions.push({ rush, de: 0, a: +(+fin).toFixed(2), pourquoi: POURQUOI_ALTERNEE });
    }
    const retires = [];
    for (let i = modeles.length - 1; i >= 0; i--) {
      const md = modeles[i];
      if ((md.segments.length || md.courts.length) && [...md.segments, ...md.courts].every(sg => alternees.has(cleRush(sg.rush))) && !md.fautif) { retires.unshift(md.nom); modeles.splice(i, 1); }
    }
    dire();
    if (strict) for (const md of modeles) for (const sg of md.segments) for (const e of exclusions) {
      if (e.rush === sg.rush && Math.min(e.a, sg.a) - Math.max(e.de, sg.de) > jeu) fautes.push(`instant exclu ET gardé (strict) : « ${md.nom} » garde ${sg.rush} (${Math.max(e.de, sg.de)} → ${Math.min(e.a, sg.a)} s), exclu (${e.pourquoi || 'sans raison'})`);
    }
    dire();
    for (const md of modeles) md.segments = md.segments.flatMap(sg => sans(sg, exclusions.filter(e => e.rush === sg.rush).map(e => [e.de, e.a])));
    garder();
    // 2. deux modèles sur le même moment d'un rush : au-delà de 0,3 s c'est un mélange, refusé ; un bord qui déborde de
    // 0,3 s au plus (Claude arrondit « 5,2 » et « 5,0 ») est retiré aux DEUX (le lot n'échoue pas pour un arrondi)
    const disputes = [];
    for (let i = 0; i < modeles.length; i++) for (let j = i + 1; j < modeles.length; j++)
      for (const a of modeles[i].segments) for (const b of modeles[j].segments) {
        const lo = Math.max(a.de, b.de), hi = Math.min(a.a, b.a);
        if (a.rush !== b.rush || hi - lo <= 1e-6) continue;
        if (hi - lo > (strict ? jeu : 0.3 + 1e-6)) { fautes.push(`mélange : « ${modeles[i].nom} » et « ${modeles[j].nom} » se partagent ${a.rush} (${lo} → ${hi} s)`); continue; }
        disputes.push({ rush: a.rush, de: lo, a: hi });
      }
    dire();
    for (const md of modeles) md.segments = md.segments.flatMap(sg => sans(sg, disputes.filter(x => x.rush === sg.rush).map(x => [x.de, x.a])));
    garder();
    // 3. CHAQUE groupe est dans un modèle (un segment gardé sur un de ses tronçons) ou exclu avec une raison VALABLE (nommé
    // en entier, ou au moins la moitié de son temps). Le 06/10/2026, le vrai Claude a sauté un petit modèle de 4 s pour tomber
    // sur N : un groupe oublié n'est jamais lu comme « rien à voir », et « une couleur qui change » n'est pas une raison.
    const segs = modeles.flatMap(md => md.segments);
    const dansUnModele = g => g.troncons.some(t => couvert(segs, t) >= Math.min(0.5, (t.a - t.de) / 2));
    const exclu = (g, valable) => {
      const r = nommes.get(g.id); if (r !== undefined && valable(r)) return true;
      const liste = exclusions.filter(e => valable(e.pourquoi));
      return g.troncons.reduce((n, t) => n + couvert(liste, t), 0) >= 0.5 * g.troncons.reduce((n, t) => n + (t.a - t.de), 0);
    };
    const oublies = l.d.groupes.filter(g => !dansUnModele(g) && !exclu(g, raisonValable));
    if (oublies.length) {
      const parCouleur = oublies.filter(g => exclu(g, p => !!p)).map(g => g.id);
      fautes.push(`groupe oublié : ${oublies.map(g => g.id).join(', ')} (ni dans un modèle, ni dans « exclusions » avec une raison valable)${parCouleur.length ? ` — ${parCouleur.join(', ')} exclu(s) pour une couleur qui change : ce n'est jamais une raison, mets ce vêtement dans un modèle avec le coloris qu'on voit le plus` : ''}`);
    }
    if (strict) { const mes = intervallesMesures(l); for (const md of modeles) if (!morceauxSains(md.segments, mes).length) fautes.push(`le modèle « ${md.nom} » n'a aucun tronçon sain utilisable (strict)`); }
    if (fautePreuve) fautes.push(fautePreuve);
    dire();
    // les groupes d'un modèle : ceux où ses segments tombent VRAIMENT (ceux qu'il annonce, s'il n'en touche aucun)
    return { alternees: [...alternees.values()], retires, modeles: modeles.map(({ declares, courts, fautif, ...md }) => {
      const vus = l.d.groupes.filter(G => G.troncons.some(t => couvert(md.segments, t) >= 0.5)).map(G => G.id);
      return { ...md, groupes: vus.length ? vus : l.d.groupes.filter(G => declares.has(G.id)).map(G => G.id) };
    }), exclusions };
  }
  /** Le candidats.json de separer.py → les groupes, tronçons, ids et durées du lot (la lecture et le recoupement les
   *  lisent). Tout est calculé AVANT d'être posé : un candidats.json inutilisable ne change rien au lot. Au-delà de
   *  MAX_PLANCHES pages, seule la 1re page de chaque groupe est lue ; au-delà de MAX_GROUPES groupes, une panne dite. */
  function poserCandidats(l, L, c) {
    // un tronçon est donné en entier {rush, de, a} ou par son id (« T3 ») dans la liste des tronçons ; une planche, seule ou en
    // pages. Les ids du tronçon (T#) et de sa vidéo (R#) sont GARDÉS : les planches les écrivent, Claude les cite.
    const parId = new Map((c.troncons || []).filter(t => t && t.id).map(t => [String(t.id), t]));
    const tronconDe = t => { const x = t && typeof t === 'object' ? t : parId.get(String(t)); return x && x.rush !== undefined ? { ...(x.id ? { id: String(x.id) } : {}), ...(x.video ? { video: String(x.video) } : {}), rush: String(x.rush).replace(/\\/g, '/'), de: +x.de, a: +x.a } : null; };
    const groupes = (c.groupes || []).filter(g => g && g.id).map(g => ({ g, troncons: (g.troncons || []).map(tronconDe).filter(t => t && t.a > t.de) })).filter(x => x.troncons.length);
    if (!groupes.length) throw vide('aucun groupe pur : aucun groupe candidat dans les vidéos');
    if (groupes.length > MAX_GROUPES) throw definitive(`${groupes.length} groupes candidats : trop pour une lecture sûre par l'image (au plus ${MAX_GROUPES})`);
    const racine = path.resolve(L) + path.sep;
    let gs = groupes.map(({ g, troncons }) => {
      const pages = (Array.isArray(g.planches) && g.planches.length ? g.planches : [g.planche || `planches/${g.id}.jpg`]).map(x => path.resolve(L, String(x)));
      if (pages.some(x => !x.startsWith(racine) || !fs.existsSync(x))) throw new Error(`planche absente pour ${g.id}`);
      return { id: String(g.id), planche: pages[0], pages, raison: String(g.raison || '').slice(0, 120), troncons };
    });
    let nPages = gs.reduce((n, g) => n + g.pages.length, 0);
    if (nPages > MAX_PLANCHES) { gs = gs.map(g => ({ ...g, pages: g.pages.slice(0, 1) })); histoireLot(l, `${nPages} pages de planches : seule la 1re page de chaque groupe est lue (${gs.length})`); nPages = gs.length; }
    l.d.groupes = gs;
    // l'aperçu (tous les groupes côte à côte) : la PREMIÈRE image de la lecture ; absent (outil d'avant), on lit sans lui
    l.d.apercu = (Array.isArray(c.planches?.apercu) ? c.planches.apercu : []).map(x => path.resolve(L, String(x))).filter(x => x.startsWith(racine) && fs.existsSync(x)).slice(0, 3);
    l.d.troncons = (c.troncons || []).map(tronconDe).filter(Boolean);
    l.d.idsVideos = Object.fromEntries((c.videos || []).filter(v => v && v.id && v.rush !== undefined).map(v => [String(v.id), String(v.rush).replace(/\\/g, '/')]));
    // la durée mesurée de chaque vidéo (forme réelle de l'outil) : une exclusion ne dépassera jamais la vidéo
    l.d.durees = Object.fromEntries((c.videos || []).filter(v => v && v.rush !== undefined && +v.duree > 0).map(v => [String(v.rush).replace(/\\/g, '/'), +v.duree]));
    // les groupes que separer.py lui-même trouve douteux (doutes écrits, scission possible) : une relance plus fine avant la 2e lecture
    l.d.douteux = [...new Set([...(c.groupes || []).filter(g => g && Array.isArray(g.doutes) && g.doutes.length).map(g => String(g.id)), ...(c.scissions_possibles || []).map(x => String(x && x.groupe))].filter(x => x && x !== 'undefined'))];
    return nPages;
  }
  /** Avant la 2e lecture : un groupe douteux (doute de separer.py, scission possible, ou un G# cité dans le doute de Claude)
   *  → separer.py --candidats --fin relancé dans separation/fin ; ses candidats (plus fins) servent à la 2e lecture. Une
   *  relance ratée ne bloque rien : la 2e lecture se fait sur les candidats d'avant (c'est écrit). */
  async function relanceFine(l, valide) {
    const cites = String(valide.doute || '').match(/\bG\d+\b/gi) || [];
    if (!(l.d.douteux || []).length && !cites.length) { l.d.fin = 'inutile'; sauverLot(l); return; }
    const F = path.join(sepLot(l), 'fin');
    fs.rmSync(F, { recursive: true, force: true }); fs.mkdirSync(F, { recursive: true });
    const r = await outilLot(l, 'candidats-fin', '1-EDITEUR/separer.py', ['--candidats', '--fin', '--rushes', l.d.rushes, '--sortie', F, '--modeles', String(l.n)], { dureeMaxMs: 3 * 3600000, inactiviteMaxMs: 30 * 60000 });
    const c = lireJSON(path.join(F, 'candidats.json'));
    try {
      if (r.raison || r.code !== 0 || !c) throw new Error(r.raison || `code ${r.code} : ${extrait(r.sortie, 160)}`);
      const n = poserCandidats(l, F, c);
      l.d.fin = 'fait'; histoireLot(l, `relance plus fine de separer.py (groupe douteux : ${[...new Set([...(l.d.douteux || []), ...cites.map(x => x.toUpperCase())])].join(', ') || '?'}) : ${l.d.groupes.length} groupe(s), ${n} page(s) pour la 2e lecture`);
    } catch (e) { l.d.fin = 'ratee'; histoireLot(l, `relance plus fine de separer.py ratée (${String(e.message).slice(0, 160)}) : la 2e lecture garde les candidats d'avant`); }
    sauverLot(l);
  }
  /** UN tour de Claude sur les planches : sa lecture est gardée dans lot.json (plan recoupé, ou refus), jamais refaite. */
  async function tourDeLecture(l, { bascule, valide }) {
    const L = sepLot(l), rang = l.d.lectures.length + 1;
    const derniere = l.d.lectures[l.d.lectures.length - 1] || null;
    const apercu = (l.d.apercu || []).filter(f => fs.existsSync(f)).map((f, i, tout) => ({ f, nom: tout.length > 1 ? `apercu (page ${i + 1}/${tout.length})` : 'apercu' }));
    const pages = [...apercu, ...l.d.groupes.flatMap(g => (g.pages || [g.planche]).map((f, i, tout) => ({ f, nom: tout.length > 1 ? `${g.id} (page ${i + 1}/${tout.length})` : g.id })))];
    const pourClaude = async reduire => { const r = []; for (const [i, p] of pages.entries()) r.push(await imagePourClaude(p.f, path.join(L, 'pour-claude', `${i + 1}.jpg`), reduire)); return r; };
    let fichiers = await pourClaude(false);
    // toutes ensemble sous la limite d'une requête ; et au-delà de VINGT images dans une requête, l'API n'accepte plus un côté
    // de plus de 2 000 px (l'aperçu en plus des 20 pages permises, 06/10/2026) : toutes réduites dans la boîte de 2 000 px
    if (fichiers.length > 20 || fichiers.reduce((n, f) => n + fs.statSync(f).size, 0) > 20e6) fichiers = await pourClaude(true);
    const images = fichiers.map(f => ({ media_type: 'image/jpeg', data: fs.readFileSync(f).toString('base64') }));
    // la LISTE : la seule source des noms (les planches les écrivent sans accents) ; chaque tronçon garde son id T# et sa vidéo R#
    const liste = l.d.groupes.map(g => ({ groupe: g.id, ...(g.raison ? { raison: g.raison } : {}), troncons: g.troncons.map(t => ({ ...(t.id ? { troncon: t.id } : {}), ...(t.video ? { video: t.video } : {}), rush: t.rush, de: t.de, a: t.a })) }));
    // le refus rappelé est celui d'une LECTURE refusée (gardée dans le lot, complète) : une panne de la machine au tour d'avant
    // (CLI coupé, JSON absent) n'est jamais présentée à Claude comme une lecture refusée
    const refusAvant = derniere && !derniere.plan && derniere.refus ? `\n\nTA LECTURE PRÉCÉDENTE A ÉTÉ REFUSÉE par le recoupement du bureau : « ${derniere.refus} ». Regarde de nouveau les images et corrige TOUS ces points, sans couper un vêtement ni en oublier un.` : '';
    // LA REVÉRIFICATION (08/10/2026) : l'écart est écrit — le client dit N (et les pixels en voient E pour un N = 1 basculé),
    // la lecture d'avant en a vu K : recompter groupe par groupe, sans se caler ni sur N ni sur K
    const recompte = valide ? `\n\nRECOMPTE : le client dit ${l.n}${bascule ? `, la mesure des pixels en voit ${l.d.estimes ?? 'plusieurs'}` : ''}, tu en as vu ${valide.k}${valide.vu !== null && valide.vu !== undefined && valide.vu !== valide.k ? ` (et tu as écrit nombreVu ${valide.vu})` : ''} : recompte, regarde chaque groupe (${l.d.groupes.map(g => g.id).join(', ')}) un par un. Ne te cale ni sur son nombre ni sur ta première lecture : rends ce que tu vois. Deux groupes du même vêtement = un modèle ; deux vêtements différents dans un groupe = coupe le tronçon ou exclus ce moment.${l.d.fin === 'fait' ? ' Les groupes ont été recoupés plus finement depuis ta première lecture : les ids ont changé, lis la NOUVELLE liste.' : ''}` : '';
    const vue = { id: 'lot-' + l.id, d: l.d };
    let r;
    try {
      r = await tourClaude(vue, 'separation', { dept: 'editeur', outils: [], images, schema: SCHEMA_PLAN, systeme: SYSTEME_SEPARATION,
        message: `SÉPARER LES MODÈLES d'un shooting de vêtements. Tu n'as que tes yeux : les images jointes, dans cet ordre : ${pages.map(p => p.nom).join(', ')}.
${apercu.length ? `- La PREMIÈRE image, « apercu », montre TOUS les groupes candidats côte à côte (pour chaque groupe : ses plus longs tronçons et un zoom sur le vêtement). Commence par elle : elle montre quels groupes portent le même vêtement.\n` : ''}- Puis les pages de chaque groupe : une carte par tronçon (deux images et un zoom sur le vêtement), puis chaque vidéo entière en douze images.
Les groupes viennent d'une mesure de pixels (la couleur du buste) : un groupe peut mélanger deux modèles de la même couleur, et un même modèle en plusieurs couleurs est réparti sur plusieurs groupes. Regarde les images, ne crois pas les groupes.

CE QUI FAIT UN MODÈLE
- Un modèle = UN vêtement, reconnu à sa CONSTRUCTION : col, boutons, surpiqûres, poches, panneaux, coupe (longueur, manches, ampleur). Ces détails, tu les écris dans « preuve », pour chaque modèle.
- Ne comptent PAS : la mannequin, le décor, le foulard ou le hijab porté avec, le sac, les bijoux, le texte incrusté dans la vidéo, la lumière.
- Le même vêtement dans plusieurs couleurs = UN SEUL modèle (toutes ses couleurs dans « couleurs »). Un vêtement bicolore (deux tissus sur la même pièce) = UN modèle. Deux vêtements différents de la même couleur = deux modèles.
- Un petit groupe (quelques secondes) compte autant qu'un grand : s'il montre un vêtement qu'on ne voit nulle part ailleurs, c'est un modèle à lui seul.
- Une couleur qui change vite (une vidéo qui passe d'une teinte à l'autre en moins d'une seconde) n'est JAMAIS une raison d'exclure : garde ces tronçons dans leur modèle, en UN segment avec le coloris qu'on voit le plus, et toutes les teintes vues dans « couleurs ».

${REGLE_IMPURETES}

LA LISTE (la seule source des noms)
Chaque tronçon a un id « T# », chaque vidéo un id « R# ». Sur les planches, les noms des vidéos sont écrits SANS ACCENTS, après ces ids : ne recopie jamais un nom depuis une image. Dans chaque segment, « troncon » = l'id T# (le bureau le traduit lui-même en nom exact) ; si tu remplis aussi « rush », recopie le nom EXACT de cette LISTE.
${JSON.stringify(liste, null, 1)}

RÈGLES DE LA RÉPONSE
- modeles : les modèles que tu VOIS, chacun avec sa « preuve », « couleurs » = TOUTES les teintes où tu le vois, « groupes » = les groupes où on le voit.
- segments : un segment par tronçon GARDÉ (troncon, de, a, coloris), resserré (de / a) sur les secondes où le vêtement se voit net, et un nouveau segment dès que la couleur change (si elle change plus vite qu'une seconde : un seul segment, le coloris qu'on voit le plus ; le bureau ignore un segment de moins d'une demi-seconde) ; de < a, dans les limites du tronçon. Chaque instant va à UN seul modèle : un tronçon qui montre deux modèles, coupe-le (de / a) ou mets ce moment dans exclusions.
- CHAQUE groupe G# est soit dans un modèle (au moins un segment), soit dans « exclusions » avec sa raison (« groupe » = son id, « pourquoi »). Aucun groupe oublié. Une exclusion, c'est un décor, un flou, une transition, un plan sans vêtement, une autre tenue, deux modèles à la fois — jamais un vêtement qu'on voit bien, ni une couleur qui change. Une exclusion qui cite un tronçon n'exclut que lui : le reste du groupe doit être placé aussi.
- couleurs et coloris : les noms de la palette seulement (${NOMS_PALETTE.join(', ')}).
- nom : court, en français, sans prix (ex. « Abaya plissée »).
- nombreVu : le nombre de modèles que tu vois (la longueur de « modeles »). doute : ce qui te fait hésiter (deux groupes qui sont peut-être le même vêtement, une image floue…), sinon une chaîne vide.

LE NOMBRE DU CLIENT
Le client a annoncé ${l.n} modèle(s). Ce nombre PEUT ÊTRE FAUX : il compte de tête. Ne coupe JAMAIS un vêtement en deux et n'en oublie JAMAIS un pour tomber sur ${l.n} ; ne fusionne jamais non plus deux vêtements différents. Si tu en vois un autre nombre, rends ce que tu vois : le bureau revérifie par une autre lecture, puis le client confirme chaque modèle sur sa photo.
Si les images sont illisibles, remplis « erreur » au lieu de deviner.${recompte}${refusAvant}` });
    } catch (e) {
      // Claude a DIT qu'il ne pouvait pas lire (« erreur ») : une lecture illisible, gardée, qui ne compte pas ; une panne de
      // la machine (CLI coupé, JSON absent) repart par le réessai du lot, sans rien écrire
      if (!e.arretClaude) throw e;
      l.d.lectures.push({ rang, refus: String(e.message).slice(0, 1200), illisible: true, candidats: l.d.fin === 'fait' ? 'fin' : 'base' });
      histoireLot(l, `lecture ${rang} : illisible, elle ne compte pas — ${String(e.message).slice(0, 160)}`); sauverLot(l);
      return;
    }
    const s = r.structure;
    fs.writeFileSync(path.join(L, `reponse-claude-${rang}.json`), JSON.stringify(s, null, 1)); // la réponse brute, gardée
    const rendus = Array.isArray(s.modeles) ? s.modeles.length : 0, vu = Number.isInteger(s.nombreVu) ? s.nombreVu : null;
    const doute = String(s.doute || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
    l.d.doute = doute;
    if (doute) histoireLot(l, `lecture ${rang} : le doute de Claude — ${doute}`);
    let plan = null, refus = null;
    try { plan = verifierPlan(s, l); } catch (e) { refus = e.message; }
    if (refus !== null) {
      l.d.lectures.push({ rang, refus: String(refus).slice(0, 1200), k: rendus, vu, doute, candidats: l.d.fin === 'fait' ? 'fin' : 'base' });
      histoireLot(l, `lecture ${rang} : refusée par le recoupement, elle ne compte pas — ${String(refus).slice(0, 200)}`);
    } else {
      const auNombre = rendus === l.n && (vu === null || vu === l.n);
      l.d.lectures.push({ rang, k: rendus, vu, doute, auNombre, candidats: l.d.fin === 'fait' ? 'fin' : 'base',
        plan: { modeles: plan.modeles.map(({ nom, preuve, couleurs, segments, groupes }) => ({ nom, preuve, couleurs, segments, groupes })), exclusions: plan.exclusions, alternees: plan.alternees || [], retires: plan.retires || [] } });
      histoireLot(l, `lecture ${rang} : ${rendus} modèle(s) vu(s)${vu !== null && vu !== rendus ? ` (nombreVu ${vu})` : ''}, ${l.n} annoncé(s) — ${plan.modeles.map(x => `${x.nom} [${String(x.preuve).slice(0, 50)}]`).join(' · ')}${(plan.alternees || []).length ? ` — vidéo(s) qui alternent deux vêtements, écartée(s) : ${plan.alternees.join(' · ')}` : ''}`);
    }
    sauverLot(l);
  }
  /** [casse-6] La SEULE lecture vérifiée → son plan, revérifié sur les candidats qu'elle a lus (« base » : separation/, « fin » :
   *  separation/fin/). Si une relance plus fine les a remplacés depuis, ils sont remis (leur candidats.json est encore là) ;
   *  candidats introuvables ou plan refusé dessus → l'arrêt « vide », jamais un plan posé sur des groupes qu'il n'a pas vus.
   *  Candidats inchangés : le plan gardé tel quel (vérifié à son tour, comme avant). */
  function planSurSesCandidats(l, lecture) {
    const L = sepLot(l), siens = lecture.candidats === 'fin' ? 'fin' : 'base', poses = l.d.fin === 'fait' ? 'fin' : 'base';
    if (siens === poses) return lecture.plan; // ses candidats sont ceux du lot : son plan a été vérifié dessus, à son tour
    const D = siens === 'fin' ? path.join(L, 'fin') : L, c = lireJSON(path.join(D, 'candidats.json'));
    try { if (!c) throw new Error('candidats.json introuvable'); poserCandidats(l, D, c); }
    catch (e) { l.d.trouves = 0; throw vide(`aucun groupe pur vérifié : la seule lecture vérifiée (lecture ${lecture.rang}) a lu les candidats « ${siens} », qui ne se remettent pas (${String(e.message).slice(0, 120)})`); }
    l.d.fin = siens === 'fin' ? 'fait' : 'remis';
    histoireLot(l, `une seule lecture vérifiée (lecture ${lecture.rang}) : ses candidats « ${siens} » sont remis (la relance plus fine les avait remplacés), son plan y est revérifié`);
    try { return verifierPlan({ nombreVu: lecture.k, doute: lecture.doute || '', ...lecture.plan }, l); }
    catch (e) { l.d.trouves = 0; throw vide(`aucun groupe pur vérifié : la seule lecture vérifiée (lecture ${lecture.rang}) ne tient plus sur ses candidats (${String(e.message).slice(0, 160)})`); }
  }
  /** Le plan retenu (une lecture, ou deux croisées) → plan.json, le nombre RÉEL trouvé, les vidéos mises de côté. */
  function finirLecture(l, plan, comment) {
    const retires = plan.retires || [];
    l.d.retires = retires.length; l.d.retiresNoms = retires;
    if (retires.length) histoireLot(l, `${retires.length} modèle(s) retiré(s) du plan croisé, sans aucun tronçon sain : ${retires.join(' · ')}`);
    if (!plan.modeles.length) { l.d.trouves = 0; throw vide(`aucun groupe pur : ${comment}, ${retires.length ? `mais aucun modèle n'y garde un tronçon sain (${retires.join(' · ')})` : 'mais rien de pareil entre elles'}`); }
    const L = sepLot(l);
    l.d.trouves = plan.modeles.length;
    l.d.groupesParModele = plan.modeles.map(x => x.groupes || []);
    l.d.preuves = plan.modeles.map(x => x.preuve || '');
    l.d.misDeCote = plan.misDeCote || 0;
    // LA VIDÉO QUI ALTERNE DEUX VÊTEMENTS (09/10/2026) : écartée, jamais en silence — l'historique et « لقيت … » la nomment
    l.d.alternees = [...new Set(plan.alternees || [])];
    if (l.d.alternees.length) histoireLot(l, `${l.d.alternees.length} vidéo(s) ÉCARTÉE(S), deux vêtements alternés plus vite que la coupe minimale (${COUPE_MINI_S} s), rattachée(s) à aucun modèle : ${l.d.alternees.join(' · ')}`);
    const fichier = path.join(L, 'plan.json');
    fs.writeFileSync(fichier, JSON.stringify({ rushes: l.d.rushes, modeles: plan.modeles.map(({ nom, couleurs, segments }) => ({ nom, couleurs, segments })), exclusions: plan.exclusions }, null, 1));
    l.d.plan = fichier;
    histoireLot(l, `lecture des planches : ${comment} → ${plan.modeles.length} modèle(s) retenu(s) (${plan.modeles.map(x => x.nom).join(' · ')}), ${l.n} annoncé(s)${l.d.misDeCote ? `, ${l.d.misDeCote} vidéo(s) mise(s) de côté (disputées)` : ''}`);
  }
  /* Intervalles par vidéo : [[de, a], …] triés, fusionnés. */
  const ivUnion = iv => { const o = []; for (const [x, y] of [...iv].filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0])) { const b = o[o.length - 1]; if (b && x <= b[1] + 1e-6) b[1] = Math.max(b[1], y); else o.push([x, y]); } return o; };
  const ivInter = (A, B) => { const o = []; for (const [x, y] of A) for (const [u, v] of B) { const lo = Math.max(x, u), hi = Math.min(y, v); if (hi > lo + 1e-6) o.push([lo, hi]); } return ivUnion(o); };
  const ivMoins = (A, B) => ivUnion(A).flatMap(([x, y]) => B.reduce((ms, [u, v]) => ms.flatMap(([p, q]) => [[p, Math.min(q, u)], [Math.max(p, v), q]]).filter(([p, q]) => q - p > 1e-6), [[x, y]]));
  const parRush = segs => { const m = new Map(); for (const sg of segs) { const k = cleRush(sg.rush); if (!m.has(k)) m.set(k, { rush: sg.rush, iv: [] }); m.get(k).iv.push([+sg.de, +sg.a]); } for (const v of m.values()) v.iv = ivUnion(v.iv); return m; };
  /** DEUX LECTURES CROISÉES (08/10/2026). Les modèles sont appariés un à un (le plus grand temps commun d'abord) ; chaque
   *  modèle retenu ne garde QUE le temps que les deux lectures lui donnent (intersection, au moins une demi-seconde par
   *  morceau). Tout le reste du temps donné à un modèle par l'une ou l'autre est MIS DE CÔTÉ dans les exclusions du plan :
   *  « disputé » quand les deux lectures le donnent à deux modèles différents (compté pour le client), « une seule
   *  lecture » sinon (une fin floue exclue par l'autre). Jamais un tronçon rattaché au hasard, jamais deux modèles.
   *  09/10/2026 : le plan croisé repasse LUI-MÊME verifierPlan en mode STRICT sur le lot (refusé → une erreur, jamais pris) ;
   *  un modèle apparié qui n'a plus AUCUN tronçon sain (ses morceaux communs tombent dans des trous, ou sont exclus) est
   *  RETIRÉ (son temps mis de côté, son nom dans « retires » : le client le lit), jamais une mission sans matière. */
  function croiserLectures(p1, p2, l) {
    if (!l || !l.d || !Array.isArray(l.d.groupes)) throw new Error('plan croisé sans son lot : il ne peut pas être revérifié');
    const inter = (A, B) => {
      const o = [];
      for (const a of A) for (const b of B) {
        if (cleRush(a.rush) !== cleRush(b.rush)) continue;
        const lo = Math.max(a.de, b.de), hi = Math.min(a.a, b.a);
        if (hi - lo >= 0.5 - 1e-6) o.push({ rush: b.rush, de: +lo.toFixed(2), a: +hi.toFixed(2), coloris: b.coloris || a.coloris || null });
      }
      return o.sort((x, y) => cleRush(x.rush).localeCompare(cleRush(y.rush)) || x.de - y.de);
    };
    const dureeDe = xs => xs.reduce((n, x) => n + x.a - x.de, 0);
    const cand = [];
    p1.modeles.forEach((A, i) => p2.modeles.forEach((B, j) => { const d = dureeDe(inter(A.segments, B.segments)); if (d >= 0.5 - 1e-6) cand.push({ i, j, d }); }));
    cand.sort((x, y) => y.d - x.d);
    const pris1 = new Set(), pris2 = new Set(), paires = [];
    for (const c of cand) if (!pris1.has(c.i) && !pris2.has(c.j)) { pris1.add(c.i); pris2.add(c.j); paires.push(c); }
    paires.sort((x, y) => x.j - y.j); // l'ordre et les noms de la 2e lecture (la plus récente, sur les candidats du moment)
    const noms = new Set();
    const modeles = paires.map(({ i, j }) => {
      const A = p1.modeles[i], B = p2.modeles[j], segments = inter(A.segments, B.segments);
      let nom = B.nom || A.nom; for (let k = 2; noms.has(String(nom).toLowerCase()); k++) nom = `${B.nom || A.nom} ${k}`; noms.add(String(nom).toLowerCase());
      const couleurs = [...new Set([...(B.couleurs || []), ...segments.map(x => x.coloris).filter(Boolean)])];
      return { nom, preuve: B.preuve || A.preuve || '', couleurs, segments, groupes: B.groupes || [] };
    }).filter(md => md.segments.length);
    // ce qui est mis de côté, par vidéo
    const tous1 = parRush(p1.modeles.flatMap(m => m.segments)), tous2 = parRush(p2.modeles.flatMap(m => m.segments)), gardes = parRush(modeles.flatMap(m => m.segments));
    const exclusions = [...(p1.exclusions || []), ...(p2.exclusions || [])].map(e => ({ rush: e.rush, de: e.de, a: e.a, pourquoi: e.pourquoi || 'exclu par une des deux lectures' }));
    const disputees = new Set();
    for (const k of new Set([...tous1.keys(), ...tous2.keys()])) {
      const r1 = tous1.get(k)?.iv || [], r2 = tous2.get(k)?.iv || [], g = gardes.get(k)?.iv || [], rush = (tous2.get(k) || tous1.get(k)).rush;
      const deux = ivMoins(ivInter(r1, r2), g), une = ivMoins(ivMoins(ivUnion([...r1, ...r2]), g), deux);
      for (const [de, a] of deux) if (a - de > 0.05) exclusions.push({ rush, de: +de.toFixed(2), a: +a.toFixed(2), pourquoi: 'disputé entre les deux lectures (deux modèles différents) : mis de côté' });
      for (const [de, a] of une) if (a - de > 0.05) exclusions.push({ rush, de: +de.toFixed(2), a: +a.toFixed(2), pourquoi: 'mis de côté : une seule des deux lectures le donne à un modèle' });
      if (deux.reduce((n, [x, y]) => n + y - x, 0) >= 1 - 1e-6) disputees.add(k);
    }
    // une exclusion d'une vidéo que ce lot ne connaît plus n'exclut rien (des candidats plus fins entre les deux lectures)
    const lu = lecteurDeRushes(l), excl = exclusions.filter(e => lu.exact.has(cleRush(e.rush)));
    // L'INVARIANT : aucun modèle du plan croisé sans matière saine — retiré, son temps mis de côté
    const mesures = intervallesMesures(l), retires = [];
    const sains = modeles.filter(md => { if (morceauxSains(md.segments, mesures, excl).length) return true; retires.push(md); return false; });
    for (const md of retires) for (const sg of md.segments) excl.push({ rush: sg.rush, de: sg.de, a: sg.a, pourquoi: `mis de côté : « ${md.nom} » n'a plus aucun tronçon sain après le croisement` });
    // le temps d'un groupe que ni un modèle gardé ni une exclusion ne tient est mis de côté lui aussi (rien d'oublié)
    const tenu = parRush([...sains.flatMap(md => md.segments), ...excl]);
    for (const g of l.d.groupes) for (const t of g.troncons) {
      for (const [de, a] of ivMoins([[+t.de, +t.a]], tenu.get(cleRush(t.rush))?.iv || [])) if (a - de > 0.05) excl.push({ rush: t.rush, de: +de.toFixed(2), a: +a.toFixed(2), pourquoi: 'mis de côté : aucune des deux lectures ne le garde à un modèle' });
    }
    let v;
    try { v = verifierPlan({ modeles: sains, exclusions: excl }, l, { strict: true }); }
    catch (e) { throw Object.assign(new Error(`plan croisé refusé par le recoupement strict : ${e.message}`), { croisementRefuse: true }); }
    // les vidéos qui alternent deux vêtements, vues par l'une OU l'autre lecture (ou relues ici) : toutes nommées
    return { modeles: v.modeles, exclusions: v.exclusions, misDeCote: disputees.size, retires: [...new Set([...retires.map(md => md.nom), ...(v.retires || [])])], alternees: [...new Set([...(v.alternees || []), ...(p1.alternees || []), ...(p2.alternees || [])])] };
  }
  const ETAPE_LOT = {
    async descente(l) {
      const { horsVideos, ...d } = await descendre({ lien: l.lien, rushes: path.join(dossierLot(l), 'rushes'), lancer: (args, o) => outilLot(l, 'descente', null, args, o), siVide: () => envoyer(null, M.driveVide()), entier: true });
      if (horsVideos) histoireLot(l, `descente : ${horsVideos.length} fichier(s) qui ne sont pas des vidéos ne sont pas descendus du Drive (${horsVideos.slice(0, 5).join(', ')}${horsVideos.length > 5 ? '…' : ''}) — aucune vidéo ne manque`);
      Object.assign(l.d, d);
      if (l.etat === 'encours') await envoyer(null, M.lotDrive(d.nbVideos, (d.octets / 1e9).toFixed(2))); // annulé pendant la descente : on se tait
    },
    async candidats(l) {
      const L = sepLot(l);
      fs.rmSync(path.join(L, 'planches'), { recursive: true, force: true }); fs.rmSync(path.join(L, 'candidats.json'), { force: true });
      fs.rmSync(path.join(L, 'fin'), { recursive: true, force: true });
      fs.mkdirSync(L, { recursive: true });
      const r = await outilLot(l, 'candidats', '1-EDITEUR/separer.py', ['--candidats', '--rushes', l.d.rushes, '--sortie', L, '--modeles', String(l.n)], { dureeMaxMs: 3 * 3600000, inactiviteMaxMs: 30 * 60000 });
      if (r.raison) throw new Error(r.raison);
      const c = lireJSON(path.join(L, 'candidats.json'));
      // « AUCUN groupe » : separer.py sort en code 1 AVEC son candidats.json — ce n'est pas une panne, c'est l'arrêt « vide »
      const aucun = c && Array.isArray(c.groupes) && !c.groupes.length;
      if (!c || (r.code !== 0 && !(r.code === 1 && aucun))) throw new Error(`separer.py --candidats a échoué (code ${r.code}) : ${extrait(r.sortie)}`);
      // des candidats NEUFS : rien d'une lecture d'avant (une coupure pendant les candidats les refait)
      delete l.d.lectures; delete l.d.lectureSeule; delete l.d.sansPhoto; delete l.d.fin; delete l.d.seul; delete l.d.bascule; l.d.misDeCote = 0; l.d.retires = 0; delete l.d.retiresNoms; delete l.d.alternees;
      const nPages = poserCandidats(l, L, c);
      l.d.estimes = Number.isInteger(c.estimes) && c.estimes >= 0 ? c.estimes : null;
      histoireLot(l, `candidats : ${l.d.groupes.length} groupe(s), ${nPages} page(s) de planches${l.d.apercu.length ? ' + l\'aperçu' : ''}, ${l.d.troncons.length} tronçon(s), ${l.d.estimes ?? '?'} modèle(s) estimé(s) par les pixels`);
      // N = 1 N'EST PLUS CRU SUR PAROLE (08/10/2026) : un seul modèle estimé → le chemin d'un modèle (une mission, sans
      // lecture) ; plusieurs (ou un outil d'avant qui ne l'écrit pas) → bascule en lot, avec DEUX lectures des planches
      if (l.n === 1) {
        if (l.d.estimes === 1) { l.d.seul = true; histoireLot(l, 'N = 1 vérifié : un seul groupe pur, la mission d\'un modèle part sur le Drive déjà descendu'); }
        else { l.d.bascule = true; histoireLot(l, `N = 1 annoncé, les pixels distinguent ${l.d.estimes ?? 'plusieurs'} modèles : bascule en lot (deux lectures des planches, photo de chaque modèle)`); }
      }
    },
    /* LA LECTURE DES PLANCHES (08/10/2026, décisions du vendeur : un seul lien passe toujours). Jusqu'à LECTURES_MAX tours de
     * Claude, chacun gardé dans lot.json (une coupure ou une panne ne refait que ce qui manque) :
     *  - la 1re lecture propre au nombre annoncé est prise seule (sauf un N = 1 basculé : toujours deux lectures) ;
     *  - sinon une 2e lecture, l'écart écrit dans le message (« le client dit N, tu en as vu K : recompte… »), après une
     *    relance PLUS FINE de separer.py si un groupe est douteux ;
     *  - deux lectures propres sont TOUJOURS croisées (croiserLectures) : seul ce que les deux donnent au même modèle est
     *    gardé ; un tronçon disputé est MIS DE CÔTÉ (exclusions du plan), jamais rattaché au hasard. Le même nombre rangé
     *    autrement est donc mis de côté lui aussi ;
     *  - une lecture refusée par le recoupement ou illisible ne compte pas (le refus est rappelé au tour suivant) ;
     *  - [anonymat] 10/10/2026 : UNE SEULE lecture vérifiée en LECTURES_MAX tours → on CONTINUE sur elle (LECTURE_SEULE_VERIFIEE,
     *    « continuer » par défaut) : chaque modèle confirmé sur sa photo, « une seule lecture vérifiée » dit partout ;
     *  - SEUL ARRÊT : rien de pur (« vide ») — aucun groupe, rien de pareil entre les deux lectures, ou aucune lecture
     *    vérifiable en LECTURES_MAX tours (ou une seule, réglage « arreter »). Le nombre trouvé (K) pilote ensuite tout. */
    async lecture(l) {
      const L = sepLot(l);
      l.d.lectures = Array.isArray(l.d.lectures) ? l.d.lectures : [];
      l.d.trouves = null; // rien d'un passage d'avant : le nombre trouvé est celui de CES lectures
      delete l.d.lectureSeule;
      const bascule = l.n === 1 && !!l.d.bascule;
      for (;;) {
        const valides = l.d.lectures.filter(x => x.plan);
        if (valides.length >= 2) {
          // le plan croisé refusé par sa propre revérification stricte n'est jamais pris : c'est l'arrêt « vide » (dit au client)
          let croise; try { croise = croiserLectures(valides[0].plan, valides[1].plan, l); } catch (e) { l.d.trouves = 0; throw vide(`aucun groupe pur vérifié : ${e.message}`); }
          return finirLecture(l, croise, `deux lectures croisées (${valides[0].k} et ${valides[1].k} modèle(s) vus)`);
        }
        if (valides.length === 1 && !bascule && valides[0].auNombre) return finirLecture(l, valides[0].plan, `première lecture au nombre annoncé (${l.n})`);
        if (l.d.lectures.length >= LECTURES_MAX) {
          if (valides.length === 1 && choixLectureSeule(R().lectureSeuleVerifiee) === 'continuer') {
            // [casse-6] la seule lecture vérifiée l'a été sur les candidats de SON tour : une relance plus fine (separer.py --fin)
            // a pu les remplacer depuis (autres groupes, autres tronçons, autres ids). Avant : son plan partait tel quel sur des
            // groupes qu'elle n'a jamais vus (la photo d'un groupe d'un AUTRE vêtement, une page qui contredit ce qu'elle a lu).
            // Maintenant : on remet les candidats qu'ELLE a lus, puis son plan repasse verifierPlan dessus ; refusé → « vide ».
            const plan = planSurSesCandidats(l, valides[0]);
            const fini = finirLecture(l, plan, `une seule lecture vérifiée en ${LECTURES_MAX} tours (lecture ${valides[0].rang}, ${valides[0].k} modèle(s) vus, ${l.n} annoncé(s)) : on continue sur elle, chaque modèle confirmé sur sa photo par le client`);
            l.d.lectureSeule = true; // posé APRÈS : un plan vide reste l'arrêt « vide », sans la marque
            return fini;
          }
          l.d.trouves = 0;
          throw vide(valides.length ? `aucun groupe pur vérifié : une seule lecture lisible en ${LECTURES_MAX} tours (${valides[0].k} modèle(s) vus, ${l.n} annoncé(s)), rien ne la recoupe` : `aucun groupe pur : aucune lecture vérifiable en ${LECTURES_MAX} tours (${l.d.lectures.map(x => String(x.refus || '').slice(0, 80)).join(' | ')})`);
        }
        // avant la 2e lecture d'une lecture propre : la relance plus fine de separer.py si un groupe est douteux
        if (valides.length === 1 && !l.d.fin) await relanceFine(l, valides[0]);
        await tourDeLecture(l, { bascule, valide: valides[0] || null });
      }
    },
    async construction(l) {
      const L = sepLot(l), S = path.join(L, 'modeles');
      fs.rmSync(S, { recursive: true, force: true });
      const r = await outilLot(l, 'construction', '1-EDITEUR/separer.py', ['--construire', '--plan', path.join(L, 'plan.json'), '--sortie', S], { dureeMaxMs: 3 * 3600000, inactiviteMaxMs: 30 * 60000 });
      if (r.raison) throw new Error(r.raison);
      const index = lireJSON(path.join(S, 'index.json')), plan = lireJSON(path.join(L, 'plan.json'));
      if (r.code !== 0 || !index || !plan) throw new Error(`separer.py --construire a échoué (code ${r.code}) : ${extrait(r.sortie)}`);
      const liste = index.modeles || [];
      if (liste.length !== plan.modeles.length) throw new Error(`${liste.length} dossier(s) construit(s) pour ${plan.modeles.length} modèle(s)`);
      const modeles = plan.modeles.map((p, i) => {
        const x = liste.find(y => y && y.nom === p.nom) || liste[i];
        const d = path.resolve(S, String(x.dossier || ''));
        if (!d.startsWith(path.resolve(S) + path.sep)) throw new Error(`dossier hors de la séparation : ${x.dossier}`);
        const faute = dossierPlat(d); if (faute) throw new Error(`modèle ${i + 1} « ${p.nom} » : ${faute}`);
        const v = listerVideos(d); let octets = 0; for (const f of v) octets += fs.statSync(f).size;
        return { rang: i + 1, nom: p.nom, couleurs: p.couleurs, dossier: d, nbVideos: v.length, octets, groupes: (l.d.groupesParModele || [])[i] || [], photo: null };
      });
      const dossiers = new Set(modeles.map(md => md.dossier));
      if (dossiers.size !== modeles.length) throw new Error('deux modèles pointent vers le même dossier');
      // la photo à confirmer : la planche de l'outil (--planches : chaque couleur du modèle), sinon une mosaïque tirée du dossier plat,
      // sinon la planche du groupe où on le voit. Une photo manquante ne bloque pas : la question part en texte.
      const P = path.join(L, 'photos'); fs.rmSync(P, { recursive: true, force: true });
      const rp = await outilLot(l, 'planches', '1-EDITEUR/separer.py', ['--planches', '--plan', path.join(L, 'plan.json'), '--sortie', P], { dureeMaxMs: 3600000, inactiviteMaxMs: 15 * 60000 });
      if (rp.code !== 0) histoireLot(l, `planches des modèles non faites (code ${rp.code}) : ${extrait(rp.sortie, 160)}`);
      for (const md of modeles) {
        const g = l.d.groupes.find(G => md.groupes.includes(G.id)) || l.d.groupes.find(G => G.troncons.some(t => t.rush === plan.modeles[md.rang - 1].segments[0].rush));
        const outilPhoto = path.join(P, `modele-${md.rang}.jpg`);
        md.photo = (rp.code === 0 && fs.existsSync(outilPhoto) ? outilPhoto : null) || (await photoModele(md.dossier, path.join(L, `modele-${md.rang}.jpg`))) || (g && !l.d.lectureSeule ? g.planche : null);
      }
      // [casse-6] UNE SEULE LECTURE VÉRIFIÉE : la photo est la SEULE vérification humaine. Avant, un modèle sans photo à lui
      // partait avec la planche d'un groupe de pixels (qui peut mêler deux vêtements : c'est le doute même), ou en TEXTE seul —
      // le client « confirmait » sans rien voir. Maintenant, sans photo tirée de SON dossier, le modèle n'est pas proposé (dit dans
      // l'historique et à « لقيت … ») ; aucun modèle avec sa photo → l'arrêt « vide ». Le rang du plan reste celui de chacun.
      delete l.d.sansPhoto;
      if (l.d.lectureSeule) {
        const sans = modeles.filter(md => !md.photo || !fs.existsSync(md.photo));
        l.d.sansPhoto = sans.map(md => md.nom);
        if (sans.length) histoireLot(l, `une seule lecture vérifiée : ${sans.length} modèle(s) sans photo de son propre dossier, pas proposé(s) au client (jamais une confirmation sans photo) : ${l.d.sansPhoto.join(' · ')}`);
        if (sans.length === modeles.length) throw vide(`aucun groupe pur vérifié : une seule lecture vérifiée et aucune photo de modèle à faire confirmer (${l.d.sansPhoto.join(' · ')})`);
        l.d.modeles = modeles.filter(md => !sans.includes(md));
        return;
      }
      l.d.modeles = modeles;
    }
  };

  async function avancerLot(l) {
    const cle = 'lot-' + l.id;
    if (enMarche.has(cle)) return; enMarche.add(cle);
    try {
      while (l.etat === 'encours') {
        const id = ETAPES_LOT.find(e => (l.etapes[e] || {}).etat !== 'fini');
        if (!id) { l.etat = 'pret'; delete l.raison; histoireLot(l, `séparé : ${l.d.modeles.length} modèle(s) à faire confirmer par le client`); sauverLot(l); break; }
        const st = l.etapes[id] = l.etapes[id] || { etat: 'afaire', essais: 0 };
        l.etape = id; st.etat = 'encours'; st.debut = st.debut || maintenant(); sauverLot(l);
        try { await ETAPE_LOT[id](l); }
        catch (e) {
          if (l.etat !== 'encours') { histoireLot(l, `${id} interrompu : le lot est ${l.etat}`); sauverLot(l); break; }
          // la limite d'usage (la lecture des planches est un tour de Claude) : aucun essai, aucune lecture perdue, reprise seule
          if (e.quota) { st.etat = 'afaire'; st.erreur = String(e.message || e).slice(0, 300); l.etat = 'quota'; l.quota = { depuis: maintenant(), etape: id }; histoireLot(l, `${id} : limite d'usage de Claude — le lot attend, aucun essai ni lecture perdus`); sauverLot(l); await prevenirQuota(); break; }
          if (e.connecteur) { st.etat = 'afaire'; st.erreur = String(e.message || e).slice(0, 300); l.etat = 'connecteur'; l.connecteur = { cles: clesDe(e), depuis: maintenant(), etape: id }; histoireLot(l, `${id} : connecteur à reconnecter — le lot attend, aucun essai perdu`); sauverLot(l); await signalerConnecteur(l.connecteur.cles, null); break; }
          st.essais = (st.essais || 0) + 1; st.erreur = String(e.message || e).slice(0, 500);
          histoireLot(l, `${id} : ${e.vide ? 'AUCUN GROUPE PUR' : 'ÉCHEC'} (${st.essais}) — ${st.erreur}`);
          // le SEUL arrêt (08/10/2026) : rien de pur — l'accueil le dit au client, on attend son prochain lien
          if (e.vide) { st.etat = 'echec'; l.etat = 'vide'; l.raison = st.erreur; sauverLot(l); break; }
          if (!e.definitif && st.essais < 2) { sauverLot(l); await new Promise(x => setTimeout(x, deps.pauseReessaiMs ?? 30000)); continue; }
          st.etat = 'echec'; l.etat = 'echec'; l.raison = st.erreur; sauverLot(l); break;
        }
        if (l.etat !== 'encours') { histoireLot(l, `${id} fini, mais le lot est ${l.etat} : on s'arrête`); sauverLot(l); break; }
        st.etat = 'fini'; st.fin = maintenant(); histoireLot(l, `${id} : fini`); sauverLot(l);
        // N = 1 vérifié (un seul groupe pur) : la mission d'avant naît TOUT DE SUITE (le lot la porte : une coupure entre les
        // deux est reprise au démarrage), sans lecture des planches ni confirmation
        if (l.d.seul) { l.etat = 'seul'; delete l.raison; sauverLot(l); try { naitreSeul(l); } catch (e) { histoireLot(l, `mission du modèle seul : ${e.message}`); } break; }
      }
    } finally { enMarche.delete(cle); }
    if (['pret', 'vide', 'seul', 'echec'].includes(l.etat) && deps.surLot) { try { await deps.surLot(l); } catch (e) { journal(`lot ${l.id} : ${e.message}`); } }
  }
  const parDemande = id => (id ? [...missions.values()].find(m => m.demande && m.demande.id === id) || null : null);
  /** Un N = 1 « seul » : sa mission (la demande gardée par le lot, le Drive DÉJÀ descendu) — jamais deux (parDemande). */
  function naitreSeul(l) {
    if (!l.demande || !l.demande.reponses) throw new Error('le lot d\'un modèle n\'a pas sa demande');
    let m = parDemande(l.demande.id);
    if (!m) { m = creer({ ...l.demande, rushesLot: l.d.rushes, depuisLot: l.id }); histoireLot(l, `un seul modèle : mission ${m.id} (${m.code}) sur le Drive déjà descendu`); }
    l.missions = [m.id]; sauverLot(l); return m;
  }
  /** L'accueil a fini les questions communes (N ≥ 2), ou le résumé d'un N = 1 (avec sa demande) : le lot naît (son id =
   *  celui de la conversation). */
  function lancerLot({ id, lien, n, demande = null }) {
    if (!/^[0-9a-f]{6}$/.test(String(id))) throw new Error('id de lot invalide');
    if (!(+n >= 1)) throw new Error('un lot annonce au moins un modèle');
    if (+n === 1 && !(demande && demande.reponses)) throw new Error('un lot d\'un modèle porte sa demande');
    const deja = lots.get(id); if (deja && deja.etat === 'encours') return deja;
    // un ancien lot du même numéro (hasard) : ses vidéos d'un AUTRE Drive se mêleraient à celles-ci
    if (deja) throw new Error(`un lot ${id} existe déjà (${deja.etat}) : renvoie le lien`);
    const l = { id, lien, n: +n, creeLe: maintenant(), etat: 'encours', etape: 'descente', etapes: {}, d: {}, historique: [], missions: [], ...(+n === 1 ? { demande } : {}) };
    lots.set(id, l); histoireLot(l, `créé : ${n} modèle(s) annoncé(s)${+n === 1 ? ' (N = 1 vérifié par separer.py)' : ''}`); sauverLot(l); avancerLot(l); return l;
  }
  /** Le client a annulé (« الغي »), ou n'a confirmé aucun modèle : le lot s'arrête proprement. */
  function annulerLot(id, { raison = '' } = {}) {
    const l = lots.get(id); if (!l || !['encours', 'pret', 'quota', 'connecteur'].includes(l.etat)) return false;
    l.etat = 'annule'; l.raison = String(raison || '').slice(0, 300); histoireLot(l, `${l.etat} : ${l.raison}`); sauverLot(l); return true;
  }
  /** « ابدا » : une mission par modèle CONFIRMÉ (08/10/2026 : les modèles retirés par le client ne sont pas dans choix ; le
   *  nombre retenu pilote le budget du jour, divisé entre eux). choix = [{rang, rangPlan, reponses}] : rang = la place parmi
   *  les modèles retenus (1..n), rangPlan = le rang dans le plan du lot (un lot final d'avant : rang seul). Tout ou rien. */
  function creerDepuisLot(id, choix) {
    const l = lots.get(id);
    if (!l || l.etat !== 'pret') throw new Error(`le lot ${id} n'est pas prêt (${l ? l.etat : 'inconnu'})`);
    const modeles = l.d.modeles || [];
    if (!Array.isArray(choix) || !choix.length || choix.length > modeles.length) throw new Error(`${(choix || []).length} réponse(s) pour ${modeles.length} modèle(s) trouvé(s)`);
    const vus = new Set();
    const paires = choix.map((c, i) => {
      const rp = +(c && (c.rangPlan || c.rang)), md = modeles.find(x => +x.rang === rp);
      if (!md) throw new Error(`le modèle ${rp || '?'} n'est pas dans le lot`);
      if (vus.has(rp)) throw new Error(`le modèle ${rp} est donné deux fois`); vus.add(rp);
      if (!c.reponses) throw new Error(`réponses manquantes pour le modèle ${rp}`);
      const faute = dossierPlat(md.dossier); if (faute) throw new Error(`modèle ${rp} : ${faute}`);
      return [md, { ...c, place: +c.rang || i + 1 }];
    });
    // « صحيح، بصح اللونات غالطين » sur la photo : les couleurs de CE modèle seront nommées par le client (étape couleurs)
    for (const [md, c] of paires) md.couleursClient = c.couleursClient === true;
    // une coupure du PC au milieu de la création (« ابدا » repris au démarrage) : la mission d'un modèle déjà née est GARDÉE
    // (jamais deux missions, deux pages, deux campagnes pour le même modèle) ; seules celles qui manquent naissent
    const deja = rp => [...missions.values()].find(m => m.lot && m.lot.id === l.id && +(m.lot.rangPlan || m.lot.rang) === +rp) || null;
    const nouvelles = [];
    let crees;
    try {
      crees = paires.map(([md, c]) => deja(md.rang) || (x => { nouvelles.push(x); return x; })(creer({ id: `${l.id}-${md.rang}`, lien: l.lien, recueLe: maintenant(), lot: l.id, reponses: { ...c.reponses } },
        { id: l.id, rang: c.place, rangPlan: md.rang, total: paires.length, nom: c.reponses.nom && c.reponses.nom !== 'auto' ? String(c.reponses.nom) : md.nom, couleurs: md.couleurs, rushes: md.dossier,
          plan: path.join(sepLot(l), 'plan.json'), modelePlan: md.nom, couleursClient: md.couleursClient }, { demarrer: false }))); // le montage lit le plan du lot (MONTER-10 --plan)
    } catch (e) {
      // tout ou rien : une mission née dans CET appel avant la panne n'a pas démarré, elle est retirée ; le lot reste « pret »
      for (const m of nouvelles) { missions.delete(m.id); fs.rmSync(dossier(m), { recursive: true, force: true }); journal(`mission ${m.id} : retirée (la création du lot ${l.id} a cassé en route : ${e.message})`); }
      throw e;
    }
    const reprises = crees.filter(m => !nouvelles.includes(m));
    l.etat = 'missions'; l.missions = crees.map(m => m.id);
    histoireLot(l, `${crees.length} mission(s) créée(s) pour ${crees.length} modèle(s) retenu(s) sur ${modeles.length} trouvé(s), ${l.n} annoncé(s) : ${crees.map(m => `${m.id} (${m.code}${m.lot.couleursClient ? ', couleurs par le client' : ''})`).join(', ')}${reprises.length ? ` — dont ${reprises.length} déjà née(s) avant une coupure, gardée(s)` : ''}`); sauverLot(l);
    for (const m of crees) avancer(m); // le lot est écrit « missions » AVANT que la première parte
    return crees;
  }
  /* ---------- [desc-bilan] 10/10/2026 : LE BILAN DU LOT ----------
   * Quand la dernière mission d'un lot atteint sa page (publiée) ou s'arrête (bloquée, arrêtée), UN message au client :
   * N modèles trouvés, K pages sorties avec le LIEN de chacune, chaque modèle sans page nommé avec sa raison courte. Un
   * « عاود » qui fait sortir une page change le compte : le bilan est recompté et renvoyé (jamais deux fois le même). */
  function calculBilanLot(l) {
    const trouves = (l.d && Array.isArray(l.d.modeles) && l.d.modeles.length) || (l.missions || []).length;
    const ms = (l.missions || []).map(id => missions.get(id)).filter(Boolean);
    const pages = [], sans = [], enRoute = [];
    for (const m of ms) {
      const nom = m.lot?.nom || m.d.textes?.nom || m.demande?.reponses?.nom || m.code;
      if (m.d.produit?.publieLe) pages.push({ id: m.id, rang: m.lot?.rang || 0, nom, url: m.d.produit.urlProduit || '' });
      else if (m.etat === 'arretee') sans.push({ id: m.id, rang: m.lot?.rang || 0, nom, raison: 'حبستو انت' });
      else if (m.etat === 'bloquee') sans.push({ id: m.id, rang: m.lot?.rang || 0, nom, raison: 'وقف في : ' + (NOM_AR[m.etape] || m.etape || '?') });
      else enRoute.push(m.id);
    }
    // les modèles trouvés que le client n'a pas retenus au « ابدا » : nommés aussi
    const pris = new Set(ms.map(m => +(m.lot?.rangPlan || m.lot?.rang || 0)));
    if (l.etat === 'missions') for (const md of (l.d?.modeles || [])) if (!pris.has(+md.rang)) sans.push({ id: null, rang: 0, nom: md.nom || `Modele ${md.rang}`, raison: 'ما اخترتوش في البداية' });
    pages.sort((a, b) => a.rang - b.rang);
    return { trouves, pages, sans, enRoute, lectureSeule: !!(l.d && l.d.lectureSeule), pret: l.etat === 'missions' && ms.length > 0 && !enRoute.length };
  }
  async function verifierBilanLot(m) {
    try {
      if (!m || !m.lot) return;
      const l = lots.get(m.lot.id); if (!l) return;
      const b = calculBilanLot(l); if (!b.pret) return;
      const signature = JSON.stringify([b.trouves, b.pages.map(p => [p.id, p.url]), b.sans.map(x => [x.id, x.nom, x.raison])]);
      if (l.bilan && l.bilan.signature === signature) return;
      const renvoi = !!l.bilan;
      l.bilan = { signature, le: maintenant(), trouves: b.trouves, pages: b.pages.length, sans: b.sans.length }; // posé AVANT l'envoi : deux missions qui finissent ensemble n'envoient qu'un bilan
      histoireLot(l, `bilan${renvoi ? ' recompté' : ''} : ${b.trouves} modèle(s) trouvé(s)${b.lectureSeule ? ' (une seule lecture vérifiée)' : ''}, ${b.pages.length} page(s) sortie(s)${b.pages.length ? ` (${b.pages.map(p => `${p.nom} ${p.url ? urlLisible(p.url) : 'sans lien'}`).join(' · ')})` : ''}${b.sans.length ? ` — sans page : ${b.sans.map(x => `${x.nom} (${x.raison})`).join(' · ')}` : ''}`);
      sauverLot(l);
      await envoyer(null, M.bilanLot(b));
    } catch (e) { journal(`bilan du lot ${m?.lot?.id} : ${e.message}`); }
  }
  /** [v19-trois] LE PIXEL CHOISI (mode site) : relu EN VRAI sur le compte de la mission (un tour de LECTURE SEULE, ads_get_datasets,
   *  2e méthode sur la réponse brute) AVANT toute création chez Meta. Trouvé (id et nom) → gardé, le test le portera ; absent →
   *  REFUS : rien n'est créé, la question est reposée avec les pixels du compte (boutons), la mission attend. Sans pixel choisi : null
   *  (l'ancienne loi : la campagne lit « le pixel du compte »). */
  async function verifierPixelChoisi(m) {
    const rep = m.demande.reponses || {};
    const voulu = rep.mode === 'site' && rep.pixel && typeof rep.pixel === 'object' && String(rep.pixel.nom || '').trim() ? rep.pixel : null;
    if (!voulu) return null;
    if (m.d.pixelQuestion) return ATTENTE; // la question attend sa réponse : rien n'est relu, rien n'est créé
    if (m.d.pixel && m.d.pixel.id && memeNomPixel(m.d.pixel.nom, voulu.nom) && (!voulu.id || String(voulu.id) === String(m.d.pixel.id))) return null;
    const compte = String(rep.compte?.id || '').replace(/^act_/, '');
    if (!compte) throw definitive('pixel : compte publicitaire inconnu — rien n\'est créé');
    const r = await tourClaude(m, 'pixel', { dept: 'testing', outils: ['meta.ads_get_datasets'],
      schema: { type: 'object', properties: { pixels: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nom: { type: 'string' } }, required: ['id'] } }, erreur: { type: 'string' } }, required: ['pixels'] },
      message: `LECTURE SEULE, rien d'autre. ads_get_datasets avec ad_account_id "${compte}" (suis next_cursor jusqu'au bout). Rends {pixels:[{id, nom}]} EXACTEMENT comme Meta les a rendus (id = dataset_id). Ne choisis rien, n'écris rien, ne crée rien.` });
    const lus = pixelsDuBrut(r.appels, compte);
    if (lus === null) throw new Error('pixel : les pixels du compte ne se relisent pas dans la réponse brute de Meta (ads_get_datasets)');
    const p = choisirPixel(lus, voulu);
    if (p) { m.d.pixel = { id: p.id, nom: p.nom, lu: maintenant(), choisiPar: 'client' }; histoire(m, `pixel : « ${p.nom} » (${p.id}) relu sur le compte ${compte} — le test le portera, aucun autre`); sauver(m); return null; }
    if (!lus.length) throw definitive(`pixel « ${voulu.nom} » : aucun pixel lu sur le compte ${compte} — rien n'est créé`);
    const pixels = lus.slice(0, PIXELS_BOUTONS);
    m.d.pixelQuestion = { voulu: { id: voulu.id || null, nom: String(voulu.nom) }, compte, pixels, le: maintenant() };
    histoire(m, `pixel : « ${voulu.nom} » ABSENT du compte ${compte} (${lus.length} pixel(s) lus) — REFUS, rien n'est créé, la question est reposée avec les pixels du compte`);
    sauver(m);
    await envoyer(m, M.pixelAbsent(m.id, voulu.nom, pixels.map(x => x.nom)));
    return ATTENTE;
  }
  /* ---------- [porte-groupee] 10/10/2026 : LA PORTE « لانسي » GROUPÉE DU LOT, HEURES DE DÉBUT PROGRAMMÉES ----------
   * Un lot de deux modèles et plus : chaque campagne se crée tout de suite EN PAUSE (aucun retard), puis attend. Quand plus
   * aucun modèle n'est en route (chacun a sa campagne en pause, ou est arrêté / bloqué / sans page), UNE question de lot
   * part : chaque modèle prêt avec son heure de début, les modèles tombés nommés, le total par jour (DA et USD), et la phrase
   * de la dépense. « لانسي » → intention oui sur tout le groupe, puis les activations UNE PAR UNE (la mécanique existante),
   * chacune posant d'abord start_time sur chaque ad set du modèle ; « ماشي دروك » → rien ne part, porte neuve au bouton.
   * La porte du serveur local (meta-portes) couvre EXACTEMENT les ids de tous les modèles de la porte. Un modèle débloqué
   * après la porte groupée a sa propre porte (ses ids), son créneau H_dernière + écart s'il est encore à venir, sinon tout de
   * suite. Une mission seule (N = 1, ou un lot d'un seul modèle) garde sa porte d'un modèle, démarrage tout de suite. */
  const chainesLot = new Set();
  const ecartMeta = () => ecartMetaDe(R().ecartMetaHeures);
  /** Le lot d'une mission quand il compte deux missions et plus (sinon null : la porte d'un seul modèle, comme avant). */
  function lotGroupe(m) { if (!m || !m.lot) return null; const l = lots.get(m.lot.id); return l && Array.isArray(l.missions) && l.missions.length >= 2 && l.missions.includes(m.id) ? l : null; }
  const nomDe = x => x.lot?.nom || x.d.textes?.nom || x.demande?.reponses?.nom || x.code;
  const rangDe = x => +(x.lot?.rang || 0);
  const parRang = (a, b) => rangDe(a) - rangDe(b);
  // [v19-trois] une porte d'un lot peut couvrir les modèles d'AUTRES lots (et de missions seules) : « couvert » = sous n'importe
  // quelle porte VALIDÉE du bureau (avant : seulement celles du lot ; un modèle repris par la porte d'un autre lot aurait été
  // reposé par son propre lot pendant ses activations)
  const couvertsLot = () => new Set([...lots.values()].flatMap(x => ((x.portes && x.portes.liste) || []).filter(p => p.etat === 'validee').flatMap(p => p.modeles.map(y => y.id))));
  /** parti (déjà sous une porte validée, ou lancé) · tombe (arrêté, bloqué) · pret (campagne en pause, attend la porte) · route. */
  function classeLot(x, couverts) {
    if (couverts.has(x.id) || x.d.lanceLe || x.d.activationTentee || x.d.publication || x.etapes.lance?.reponse === 'oui' || x.etat === 'suivi') return 'parti';
    if (['arretee', 'bloquee', 'annulee'].includes(x.etat)) return 'tombe';
    if (x.etat === 'encours' && x.attente === 'lance' && x.d.campagne && x.d.campagne.id) return 'pret';
    return 'route';
  }
  const heuresDeLaPorte = (P, groupe, t, n, ecart) => (groupe ? heuresGroupe(t, n, ecart) : heuresApres(t, n, ecart, P.dernierCreneau ? Date.parse(P.dernierCreneau) : NaN));
  async function verifierPorteLot(m) {
    try {
      const l = m && m.lot ? lotGroupe(m) : null; if (!l) return;
      await porteDuLot(l);
    } catch (e) { journal(`porte du lot ${m?.lot?.id} : ${e.message}`); }
  }
  /** [v19-trois] La porte d'un lot (le cœur de verifierPorteLot, inchangé dans ses lois) + LA REPRISE : la porte neuve prend aussi
   *  les modèles prêts des AUTRES questions « لانسي » ouvertes (portes des autres lots, questions des missions seules), les ferme
   *  et le dit — jamais deux questions « لانسي » ouvertes pour le client ; + LA GARDE : un modèle tenu par la porte d'un autre lot
   *  (ouverte, ou refusée sans « سقسيني ») n'est jamais reposé par son propre lot (sinon les deux lots se voleraient la porte à
   *  chaque tour d'horloge : le ping-pong vu sur la chaîne du vendeur le 14/10). reprendre : une porte neuve même sans modèle
   *  propre au lot (la porte d'un lot fermée pour faire place à un modèle seul, ou « سقسيني »). */
  async function porteDuLot(l, { reprendre = false, fermees = 0 } = {}) {
    if (!l || chainesLot.has(l.id)) return;
    const P = l.portes = l.portes || { gen: 0, liste: [], dernierCreneau: null };
    const ms = l.missions.map(id => missions.get(id)).filter(Boolean), couverts = couvertsLot(l);
    const cl = new Map(ms.map(x => [x.id, classeLot(x, couverts)]));
    if ([...cl.values()].includes('route')) return;
    const tenus = tenusAilleurs(l); // la GARDE
    const prets = ms.filter(x => cl.get(x.id) === 'pret' && !tenus.has(x.id)).sort(parRang);
    if (P.liste.some(p => p.etat === 'ouverte')) return; // jamais deux portes pour un lot
    const repris = aReprendre(l, couverts, new Set(prets.map(x => x.id))); repris.questions += fermees;
    if (!prets.length && !(reprendre && repris.modeles.length)) return;
    const tous = [...prets, ...repris.modeles];
    const signature = tous.map(x => x.id).join(',');
    const der = P.liste[P.liste.length - 1];
    if (der && der.etat === 'refusee' && der.signature === signature && !der.neuve) return; // « ماشي دروك » : porte neuve au bouton
    const groupe = !P.liste.some(p => p.etat === 'validee'), t = Date.now(), ecart = ecartMeta();
    const hs = heuresDeLaPorte(P, groupe, t, tous.length, ecart);
    const tombes = ms.filter(x => cl.get(x.id) === 'tombe').sort(parRang);
    const p = { gen: ++P.gen, etat: 'ouverte', groupe, signature, poseeLe: maintenant(), ecart, idRef: tous[0].id, modeles: tous.map((x, i) => ({ id: x.id, rang: rangDe(x), heure: hs[i] === null ? null : new Date(hs[i]).toISOString(), ...(x.lot && x.lot.id === l.id ? {} : { de: x.lot ? `lot:${x.lot.id}` : 'seul' }) })), tombes: tombes.map(x => x.id), ...(repris.questions ? { reprises: repris.questions } : {}) };
    P.liste.push(p); sauverLot(l); // posée AVANT l'envoi : deux modèles qui finissent ensemble n'ouvrent qu'une porte
    fermerReprises(l, p, repris);
    histoireLot(l, `porte ${p.gen} « لانسي » ${groupe ? 'GROUPÉE' : 'd\'un modèle débloqué après la porte groupée'} ouverte : ${tous.map((x, i) => `${x.code} ${hs[i] === null ? 'tout de suite' : heureCourte(hs[i])}`).join(' · ')}${tombes.length ? ` — hors porte (tombés, dans le bilan) : ${tombes.map(x => x.code).join(', ')}` : ''} ; écart ${ecart} h ; heures recalculées à la validation${repris.questions ? ` — REPRISE : ${repris.questions} autre(s) question(s) « لانسي » fermée(s), leurs modèles prêts sont dans cette porte (${repris.modeles.map(x => x.code).join(', ')}) : jamais deux questions ouvertes` : ''}`);
    const totalUsd = Math.round(tous.reduce((s, x) => s + (+x.d.budget?.total_usd || 0), 0) * 100) / 100;
    await envoyer(null, M.porteLot({ prets: tous.map((x, i) => ({ nom: nomDe(x), heure: hs[i] === null ? null : heureCourte(hs[i]) })), tombes: tombes.map(nomDe), totalUsd, taux: +R().taux || 0, reprises: repris.questions }, p.idRef, p.gen));
  }
  /* ---------- [v19-trois] 15/10/2026 : UNE SEULE QUESTION « لانسي » À LA FOIS — LA REPRISE ET LA GARDE, TOUJOURS ENSEMBLE ----------
   * Fonction éprouvée sur la chaîne du vendeur (_lots_en_porte / _lance_groupe_regarder, contrôle de la porte unique, cas du
   * ping-pong), portée en AJOUT : (1) une porte neuve REPREND les modèles prêts des autres questions « لانسي » ouvertes (la porte
   * d'un autre lot, la question d'une mission seule), les ferme et le dit ; (2) une mission seule prête pendant qu'une porte de lot
   * est ouverte ne pose pas sa question : la porte est refaite avec elle ; pendant la question d'une AUTRE mission seule, elle
   * attend (dit au client) ; (3) LA GARDE : un modèle tenu par la porte d'un autre lot (ouverte, ou refusée sans « سقسيني ») n'est
   * jamais reposé par son propre lot — sans elle, deux lots se reprendraient l'un l'autre à chaque tour d'horloge. */
  const derniere = l => { const L = (l && l.portes && l.portes.liste) || []; return L[L.length - 1] || null; };
  const porteDe = ref => { if (!ref) return null; const l = lots.get(ref.lot); return (l && ((l.portes && l.portes.liste) || []).find(p => p.gen === ref.gen)) || null; };
  /** Une porte qui TIENT encore ses modèles : ouverte, validée, ou refusée (« ماشي دروك » / « الغي ») sans « سقسيني ». */
  const porteTient = p => !!p && (p.etat === 'ouverte' || p.etat === 'validee' || (p.etat === 'refusee' && !p.neuve));
  /** Une mission SEULE (hors porte de lot) dont la campagne en pause attend « لانسي ». */
  const estSeulPret = x => !!x && !lotGroupe(x) && x.etat === 'encours' && x.attente === 'lance' && !!(x.d.campagne && x.d.campagne.id) && (x.etapes.lance || {}).reponse !== 'oui';
  /** Sa question « لانسي » est OUVERTE chez le client (posée, ni fermée par « الغي », ni reprise dans une porte de lot). */
  const seulOuvert = x => { const st = (x && x.etapes && x.etapes.lance) || {}; return estSeulPret(x) && !!st.demande && !st.annulee && !st.reprisePar; };
  /** La question « لانسي » ouverte du bureau (au plus une, c'est la loi), sauf celle de « sauf ». */
  function questionOuverte(sauf = null) {
    for (const x of lots.values()) { const d = derniere(x); if (d && d.etat === 'ouverte') return { type: 'lot', l: x, p: d }; }
    for (const x of missions.values()) if (x !== sauf && seulOuvert(x)) return { type: 'seul', x };
    return null;
  }
  /** LA GARDE : les modèles de ce lot tenus par la porte d'un AUTRE lot (sa dernière porte ouverte ou refusée sans « سقسيني »),
   *  ou par la porte qui a repris la dernière porte de ce lot tant qu'elle tient. */
  function tenusAilleurs(l) {
    const out = new Set();
    for (const x of lots.values()) { if (x.id === l.id) continue; const d = derniere(x); if (d && (d.etat === 'ouverte' || (d.etat === 'refusee' && !d.neuve))) for (const mo of d.modeles) out.add(mo.id); }
    const d = derniere(l); if (d && d.etat === 'reprise') { const h = porteDe(d.reprisePar); if (porteTient(h)) for (const mo of h.modeles) out.add(mo.id); }
    return out;
  }
  /** LA REPRISE : ce qu'une porte neuve du lot l prend aux autres questions — (i) la porte OUVERTE d'un autre lot (tous ses modèles
   *  prêts), (ii) un lot dont la porte a été reprise par une porte qui ne tient plus ou par une porte de l, (iii) les missions
   *  seules prêtes (question ouverte, en attente, ou reprises par une porte qui ne tient plus ou de l). Jamais un modèle couvert
   *  par une porte validée, jamais un « الغي » sans « سقسيني ». */
  function aReprendre(l, couverts, deja) {
    const out = { modeles: [], questions: 0, portes: [], seuls: [] }, pris = new Set(deja);
    const prendre = x => { if (x && !pris.has(x.id) && classeLot(x, couverts) === 'pret') { pris.add(x.id); out.modeles.push(x); return true; } return false; };
    for (const x of lots.values()) {
      if (x.id === l.id) continue;
      const d = derniere(x); if (!d) continue;
      if (d.etat === 'ouverte') { out.portes.push({ lot: x.id, gen: d.gen }); out.questions++; for (const mo of d.modeles) prendre(missions.get(mo.id)); continue; }
      if (d.etat === 'reprise') {
        const h = porteDe(d.reprisePar); if (h && h.etat === 'validee') continue;
        if (!porteTient(h) || (d.reprisePar && d.reprisePar.lot === l.id)) { const n0 = out.modeles.length; for (const id of x.missions || []) prendre(missions.get(id)); if (out.modeles.length > n0) out.portes.push({ lot: x.id, gen: d.gen, deja: true }); }
      }
    }
    for (const x of missions.values()) {
      if (!estSeulPret(x) || pris.has(x.id)) continue;
      const st = x.etapes.lance || {}; if (st.annulee) continue;
      const h = st.reprisePar ? porteDe(st.reprisePar) : null; if (h && h.etat === 'validee') continue;
      const ouverte = seulOuvert(x);
      if (ouverte || st.rejoint || (st.reprisePar && (!porteTient(h) || st.reprisePar.lot === l.id))) { if (prendre(x)) { out.seuls.push(x.id); if (ouverte) out.questions++; } }
    }
    return out;
  }
  /** Les questions reprises par la porte p du lot l : fermées (leurs boutons ne lancent plus rien), chacune pointe vers p. */
  function fermerReprises(l, p, repris) {
    const ref = { lot: l.id, gen: p.gen }, le = maintenant();
    const touches = new Map(repris.portes.map(r => [r.lot, r]));
    for (const x of repris.modeles) if (x.lot && x.lot.id !== l.id && lotGroupe(x) && !touches.has(x.lot.id)) touches.set(x.lot.id, { lot: x.lot.id, deja: true });
    for (const r of touches.values()) {
      const x = lots.get(r.lot), d = derniere(x); if (!d || !['ouverte', 'reprise'].includes(d.etat)) continue;
      const etait = d.etat; d.etat = 'reprise'; d.reprisePar = ref; d.repriseLe = le; sauverLot(x);
      histoireLot(x, `porte ${d.gen} : ${etait === 'ouverte' ? 'fermée, ses modèles prêts' : 'ses modèles prêts'} repris dans la porte ${p.gen} du lot ${l.id} (jamais deux questions « لانسي » ouvertes) — son bouton ne lance plus rien`);
    }
    for (const id of repris.seuls) {
      const x = missions.get(id); if (!x) continue; const st = x.etapes.lance = x.etapes.lance || { etat: 'attente', essais: 0 };
      st.reprisePar = ref; st.repriseLe = le; delete st.rejoint; sauver(x);
      histoire(x, `lance : repris dans la porte ${p.gen} du lot ${l.id} (une seule question « لانسي » à la fois) — l'ancien bouton ne lance plus rien`);
    }
  }
  /** Une mission seule prête pendant qu'une porte de lot est OUVERTE : cette porte est fermée et refaite AVEC elle (une porte neuve
   *  qui reprend tout, dite au client) — jamais une deuxième question à côté. */
  async function rejoindrePorte(m) {
    try {
      const st = m && m.etapes && m.etapes.lance; if (!st || !st.rejoint || st.reprisePar || st.annulee || !estSeulPret(m)) return;
      const o = questionOuverte(m); if (!o || o.type !== 'lot') return;
      const x = o.l, d = o.p; if (chainesLot.has(x.id)) return;
      d.etat = 'reprise'; d.reprisePar = { lot: x.id, gen: (x.portes.gen || 0) + 1 }; d.repriseLe = maintenant(); sauverLot(x);
      histoireLot(x, `porte ${d.gen} : fermée pour une porte neuve qui reprend aussi ${m.code} (mission seule prête) — une seule question « لانسي » à la fois`);
      await porteDuLot(x, { reprendre: true, fermees: 1 });
      if (derniere(x) === d) { d.etat = 'ouverte'; delete d.reprisePar; delete d.repriseLe; sauverLot(x); histoireLot(x, `porte ${d.gen} : aucune porte neuve n'a pu s'ouvrir, elle reste ouverte`); }
    } catch (e) { journal(`porte (mission seule ${m?.id}) : ${e.message}`); }
  }
  /** La question « لانسي » d'une mission seule, posée seulement si AUCUNE autre n'est ouverte (sinon : elle rejoint la porte de lot
   *  ouverte, ou elle attend la réponse à l'autre mission seule — dit une fois au client). */
  async function poserQuestionSeule(m) {
    const st = m.etapes.lance = m.etapes.lance || { etat: 'attente', essais: 0 };
    const o = questionOuverte(m);
    if (o) {
      if (!st.rejoint) { st.rejoint = maintenant(); delete st.reprisePar; sauver(m); histoire(m, `lance : une autre question « لانسي » est ouverte (${o.type === 'lot' ? 'porte du lot ' + o.l.id : 'mission ' + o.x.code}) — ${o.type === 'lot' ? 'ce modèle rejoint une porte neuve' : 'ce modèle attend sa réponse'}`); if (o.type === 'seul') await envoyer(m, M.attendQuestion()); }
      if (o.type === 'lot') await rejoindrePorte(m);
      return;
    }
    delete st.rejoint; delete st.reprisePar; st.demande = maintenant(); sauver(m);
    histoire(m, 'lance : question « لانسي » posée (aucune autre question ouverte)');
    await envoyer(m, M.campagnePrete(m.id, m.d.budget, +R().taux || 0, m.demande.reponses.mode, m.demande.reponses.placements, (m.d.metaVideos || []).length));
  }
  /** « الغي » tapé SANS fiche ouverte (la chaîne du vendeur : l'ordre « annule ») : TOUTES les questions « لانسي » ouvertes (portes de
   *  lot, missions seules, et celles qui attendaient leur tour) sont fermées, sans dialogue, sans rien activer, sans rien supprimer
   *  chez Meta (aucun tour de Claude : les campagnes restent en pause) ; chacune se rouvre plus tard par « سقسيني », comme une
   *  porte refusée. Une porte VALIDÉE (activations en route) n'est jamais touchée : c'est « حبس ». */
  function annulerPortes() {
    const fermees = [], le = maintenant();
    for (const l of lots.values()) {
      const d = derniere(l); if (!d || d.etat !== 'ouverte') continue;
      d.etat = 'refusee'; d.refuseLe = le; d.annuleeLe = le; sauverLot(l);
      histoireLot(l, `porte ${d.gen} : « الغي » tapé sans fiche ouverte — question fermée sans dialogue, rien activé, rien supprimé chez Meta (les campagnes restent en pause) ; « سقسيني » la rouvre`);
      const x0 = missions.get(d.modeles[0]?.id);
      fermees.push({ nom: x0 ? nomDe(x0) : 'Modele', data: `mis:${d.idRef || d.modeles[0]?.id}:lanceg:${d.gen}.neuve` });
    }
    for (const x of missions.values()) {
      if (!estSeulPret(x)) continue; const st = x.etapes.lance || {};
      if (st.annulee || st.reprisePar || !(st.demande || st.rejoint)) continue;
      st.annulee = le; delete st.rejoint; sauver(x);
      histoire(x, 'lance : « الغي » tapé sans fiche ouverte — question « لانسي » fermée, rien activé, rien supprimé chez Meta ; « سقسيني » la rouvre');
      fermees.push({ nom: nomDe(x), data: `mis:${x.id}:lance:neuve` });
    }
    journal(`« الغي » sans fiche : ${fermees.length} question(s) « لانسي » fermée(s), rien envoyé chez Meta`);
    return { fermees: fermees.length, message: M.portesAnnulees(fermees) };
  }
  /** [porte-tick] 10/10/2026 : à CHAQUE tour d'horloge (entretien), la porte de chaque lot qui a au moins un modèle prêt NON
   *  couvert est revue — UN appel par lot, jamais pendant une chaîne d'activations, jamais quand une porte est déjà ouverte.
   *  Avant : revue seulement aux événements (fin d'avancer, couleurs retirées, arrêt, bouton, après activations) → après une
   *  coupure du bureau entre la dernière arrivée à « lance » et l'ouverture de la porte, des modèles prêts restaient sans porte.
   *  verifierPorteLot garde ses lois (aucun modèle en route, jamais deux portes, « ماشي دروك » de même signature non rouverte). */
  function revoirPortesLots() {
    for (const l of lots.values()) {
      if (chainesLot.has(l.id) || !Array.isArray(l.missions) || l.missions.length < 2) continue;
      if (((l.portes && l.portes.liste) || []).some(p => p.etat === 'ouverte')) continue;
      const couverts = couvertsLot(l);
      const pret = l.missions.map(id => missions.get(id)).find(x => x && x.lot && x.lot.id === l.id && classeLot(x, couverts) === 'pret');
      if (pret) verifierPorteLot(pret).catch(e => journal(`porte du lot ${l.id} (horloge) : ${e.message}`));
    }
    // [v19-trois] les missions seules qui attendent leur tour (ou reprises par une porte qui ne tient plus) : une porte de lot
    // ouverte → la plus ancienne la rejoint ; aucune question ouverte → UNE question, pour la plus ancienne
    const attendent = [...missions.values()].filter(x => { const st = x.etapes.lance || {}; return estSeulPret(x) && !enMarche.has(x.id) && !st.annulee && (st.rejoint || (st.reprisePar && !porteTient(porteDe(st.reprisePar)) && (porteDe(st.reprisePar) || {}).etat !== 'validee')); })
      .sort((a, b) => String(a.creeLe || '').localeCompare(String(b.creeLe || '')));
    if (attendent.length) {
      const s0 = attendent[0], st0 = s0.etapes.lance; if (st0.reprisePar) { delete st0.reprisePar; st0.rejoint = st0.rejoint || maintenant(); sauver(s0); }
      const o = questionOuverte(s0);
      if (o && o.type === 'lot') rejoindrePorte(s0).catch(e => journal(`porte (horloge, mission seule ${s0.id}) : ${e.message}`));
      else if (!o) poserQuestionSeule(s0).catch(e => journal(`question « لانسي » (horloge, mission seule ${s0.id}) : ${e.message}`));
    }
  }
  /** Le bouton de la porte du lot. « لانسي » : les heures RECALCULÉES depuis la validation (redites si elles ont bougé), la
   *  porte du serveur local sur les ids de TOUS les modèles couverts, puis les activations une par une. */
  async function boutonPorteLot(m, val) {
    const fat = { connu: true, texte: 'هاذ السؤال فات' };
    const [g, choix] = String(val).split('.');
    // [v19-trois] la porte qui porte ce bouton (son idRef) d'abord : une porte de reprise peut être tenue par un AUTRE lot
    const hote = [...lots.values()].find(x => ((x.portes && x.portes.liste) || []).some(q => q.gen === +g && q.idRef === m.id));
    const l = hote || lotGroupe(m), P = l && l.portes;
    const p = P && (P.liste || []).find(x => x.gen === +g);
    if (!p) return fat;
    if (choix === 'neuve') {
      if (p.etat !== 'refusee' || P.liste[P.liste.length - 1] !== p) return fat;
      p.neuve = maintenant(); sauverLot(l); histoireLot(l, `porte ${p.gen} : le client demande une porte neuve`);
      const n0 = P.gen; await porteDuLot(l, { reprendre: true }).catch(e => journal(`porte du lot ${l.id} : ${e.message}`));
      return { connu: true, texte: P.gen > n0 ? 'وصلني' : 'ما كاين حتى موديل واجد دروك' };
    }
    if (p.etat !== 'ouverte') return fat;
    if (choix === 'non') {
      p.etat = 'refusee'; p.refuseLe = maintenant(); sauverLot(l);
      histoireLot(l, `porte ${p.gen} : « ماشي دروك » — rien ne part, le groupe est libéré ; aucun ticket consommé (la porte du serveur local ne s'écrit qu'à la validation) ; porte neuve au bouton`);
      await envoyer(null, M.porteLotPasEncore(m.id, p.gen));
      return { connu: true, texte: 'وصلني' };
    }
    if (choix !== 'oui') return { connu: true, texte: '?' };
    const couverts = couvertsLot(l);
    const prets = p.modeles.map(mo => missions.get(mo.id)).filter(x => x && classeLot(x, couverts) === 'pret').sort(parRang);
    if (!prets.length) { p.etat = 'perimee'; sauverLot(l); histoireLot(l, `porte ${p.gen} : plus aucun modèle prêt à la validation — rien ne part`); return fat; }
    const t = Date.now(), ecart = ecartMeta();
    const hs = heuresDeLaPorte(P, p.groupe, t, prets.length, ecart);
    const annoncees = new Map(p.modeles.map(mo => [mo.id, mo.heure || null]));
    p.modeles = prets.map((x, i) => ({ id: x.id, rang: rangDe(x), heure: hs[i] === null ? null : new Date(hs[i]).toISOString() }));
    p.etat = 'validee'; p.valideLe = new Date(t).toISOString(); p.ecart = ecart; p.intention = 'oui';
    if (p.groupe) p.H0 = new Date(prochaineHeureRonde(t)).toISOString();
    const posees = hs.filter(h => h !== null);
    if (posees.length) P.dernierCreneau = new Date(Math.max(...posees, P.dernierCreneau ? Date.parse(P.dernierCreneau) : 0)).toISOString();
    p.ids = prets.flatMap(x => objetsTest(x));
    p.adSets = prets.filter((x, i) => hs[i] !== null).flatMap(x => x.d.campagne.adSets.map(a => String(a.id)));
    p.ticket = ecrirePorte(DOSSIER_PORTES, { mission: `lot:${l.id}`, ids: p.ids, adSets: p.adSets, dureeMs: 12 * 3600000, parMission: Object.fromEntries(prets.map(x => [x.id, objetsTest(x)])) }); // [casse-5] les ids de chaque modèle : un tour ne sert que les siens
    prets.forEach((x, i) => {
      const k = i + 1, h = hs[i];
      const pourquoi = h === null
        ? `heure de début : tout de suite — modèle débloqué après la porte groupée, son créneau (la dernière heure du lot + ${ecart} h) est déjà passé (porte ${p.gen} validée à ${heureCourte(t)})`
        : p.groupe
          ? `heure de début ${heureCourte(h)} : porte « لانسي » du lot validée à ${heureCourte(t)} → H0 = la prochaine heure ronde au moins trente minutes après la validation (${heureCourte(hs[0])}), + ${k - 1} × ${ecart} h (rang ${k} sur ${prets.length}) ; même règle que la chaîne du vendeur : l'heure annoncée = l'heure posée chez Meta (start_time de chaque ad set)`
          : `heure de début ${heureCourte(h)} : modèle débloqué après la porte groupée → la dernière heure du lot + ${ecart} h (porte ${p.gen} validée à ${heureCourte(t)}) ; l'heure annoncée = l'heure posée chez Meta`;
      x.d.depart = { lot: l.id, porte: p.gen, rang: k, heure: h === null ? null : new Date(h).toISOString(), ecart, valideLe: p.valideLe, pourquoi };
      histoire(x, pourquoi); sauver(x);
    });
    histoireLot(l, `porte ${p.gen} validée (« لانسي ») à ${heureCourte(t)} : ${prets.map((x, i) => `${x.code} ${hs[i] === null ? 'tout de suite' : heureCourte(hs[i])}`).join(' · ')} ; porte du serveur local sur ${p.ids.length} id(s) de ${prets.length} modèle(s), rien d'autre ; activations une par une`);
    sauverLot(l);
    const bouge = prets.some((x, i) => (annoncees.get(x.id) || null) !== (hs[i] === null ? null : new Date(hs[i]).toISOString()));
    if (bouge) await envoyer(null, M.porteLotHeures(prets.map((x, i) => ({ nom: nomDe(x), heure: hs[i] === null ? null : heureCourte(hs[i]) }))));
    activerGroupe(l, p).catch(e => journal(`lot ${l.id} : activations de la porte ${p.gen} — ${e.message}`));
    return { connu: true, texte: 'وصلني' };
  }
  /** Les activations d'une porte validée, UNE PAR UNE (modèle par modèle, l'étape activation existante). Reprise au démarrage. */
  async function activerGroupe(l, p) {
    if (chainesLot.has(l.id)) return; chainesLot.add(l.id);
    try {
      // [casse-5] UNE PAR UNE même après une coupure : un modèle dont l'activation tourne déjà (relancée par redemarrer, ou
      // « عاود ») est attendu avant le suivant — jamais deux tours d'activation du lot en même temps
      const enActivation = () => p.modeles.some(mo => { const y = missions.get(mo.id); return y && enMarche.has(y.id) && y.etat === 'encours' && y.etape === 'activation'; });
      for (const [i, mo] of p.modeles.entries()) {
        for (let k = 0; k < 18000 && enActivation(); k++) await new Promise(r => setTimeout(r, 200));
        const x = missions.get(mo.id); if (!x) continue;
        const st = x.etapes.lance = x.etapes.lance || { etat: 'afaire', essais: 0 };
        if (st.reponse === 'oui') continue; // déjà parti (une reprise après coupure)
        if (x.etat !== 'encours' || x.attente !== 'lance') { histoireLot(l, `porte ${p.gen} : ${x.code} n'est plus prêt (${x.etat}) — pas activé`); sauverLot(l); continue; }
        for (let k = 0; k < 300 && enMarche.has(x.id); k++) await new Promise(r => setTimeout(r, 200));
        st.reponse = 'oui'; st.repondu = maintenant(); st.etat = 'encours'; x.attente = null;
        histoire(x, `lance : « لانسي » du lot (porte ${p.gen}) — activation ${i + 1}/${p.modeles.length}, une par une`); sauver(x);
        await avancer(x);
      }
    } finally {
      chainesLot.delete(l.id);
      if (p.modeles.every(mo => { const x = missions.get(mo.id); return !x || x.etapes.lance?.reponse === 'oui' || x.etat !== 'encours'; })) {
        if (p.ticket) effacerPorte(DOSSIER_PORTES, p.ticket);
        p.fini = maintenant(); histoireLot(l, `porte ${p.gen} : activations finies, porte du serveur local refermée`); sauverLot(l);
      }
    }
    await porteDuLot(l).catch(e => journal(`porte du lot ${l.id} : ${e.message}`)); // un modèle prêt après le groupe : sa propre porte
  }
  /** La porte du serveur local d'un modèle couvert par une porte de lot validée. Effacée par une coupure (au démarrage, plus
   *  aucune porte ne vit) : réécrite pour les SEULS modèles de cette porte dont l'activation n'a pas encore été tentée — jamais
   *  une entité déjà activée. */
  function ticketLotDe(m) {
    const l = lotGroupe(m); const P = l && l.portes; if (!P) return null;
    const p = (P.liste || []).find(x => x.etat === 'validee' && x.modeles.some(y => y.id === m.id)); if (!p || p.fini) return null;
    if (p.ticket && fs.existsSync(path.join(DOSSIER_PORTES, p.ticket + '.json'))) return p.ticket;
    // [casse-5] jamais un modèle arrêté, bloqué ou sorti de la chaîne depuis la validation : seulement ceux encore à activer
    const restants = p.modeles.map(mo => missions.get(mo.id)).filter(x => x && (x.id === m.id || (x.etat === 'encours' && !x.d.activationTentee && !x.d.lanceLe)));
    const ids = restants.flatMap(x => objetsTest(x));
    const adSets = restants.filter(x => x.d.depart && x.d.depart.heure).flatMap(x => x.d.campagne.adSets.map(a => String(a.id)));
    p.ticket = ecrirePorte(DOSSIER_PORTES, { mission: `lot:${l.id}`, ids, adSets, dureeMs: 12 * 3600000, parMission: Object.fromEntries(restants.map(x => [x.id, objetsTest(x)])) });
    histoireLot(l, `porte ${p.gen} : la porte du serveur local avait disparu (coupure) — réécrite pour les ${restants.length} modèle(s) pas encore activé(s), ${ids.length} id(s)`); sauverLot(l);
    return p.ticket;
  }
  /** L'heure de début posée et RELUE (après coup, dans les appels bruts) ; sinon « heure non posée » : historique, journal, client. */
  async function noterHeure(m, appels, heureMs, adSets) {
    const maj = (appels || []).some(a => /__ads_update_entity$/.test(String(a.nom || '')));
    if (heureMs === null && !maj) return;
    const fautes = verifierHeurePosee(appels, { adSets, heureMs, budgetCentimes: m.d.budget?.centimes_par_ad_set ?? null });
    if (!fautes.length) { if (m.d.depart) m.d.depart.posee = maintenant(); histoire(m, `activation : heure de début ${heureCourte(heureMs)} posée sur ${adSets.length} ad set(s) AVANT l'activation, puis relue dans Meta (start_time) — aucun budget touché`); sauver(m); return; }
    m.d.heureNonPosee = { le: maintenant(), fautes };
    histoire(m, `activation : heure non posée — ${fautes.slice(0, 4).join(' ; ')}`); sauver(m);
    await envoyer(m, M.heureNonPosee(m.id));
  }
  const heureProgrammee = m => { const d = m.d.depart; return d && d.heure && !d.heurePassee && d.posee ? { iso: d.heure, hhmm: heureCourte(d.heure) } : null; };
  function resumeLot(l) { return { id: l.id, etat: l.etat, etape: l.etape, n: l.n, creeLe: l.creeLe, raison: l.raison || null, trouves: l.d.trouves ?? null, estimes: l.d.estimes ?? null, misDeCote: l.d.misDeCote || 0, retires: l.d.retires || 0, alternees: l.d.alternees || [], lectureSeule: !!l.d.lectureSeule,
    // le nombre des PIXELS (separer.py estimer, seuil non calibré) n'est jamais un compte sûr : l'interface le lit en ESTIMATION
    estimation: (l.d.trouves === null || l.d.trouves === undefined) && Number.isInteger(l.d.estimes) && l.d.estimes > 0 ? TEXTES_ACCUEIL.estimation(l.d.estimes) : null, lectures: (l.d.lectures || []).length, nbVideos: l.d.nbVideos || 0, missions: l.missions || [], porte: (P => (P && (P.liste || []).length ? (q => ({ gen: q.gen, etat: q.etat, groupe: q.groupe, valideLe: q.valideLe || null, modeles: q.modeles.map(mo => ({ id: mo.id, heure: mo.heure })) }))(P.liste[P.liste.length - 1]) : null))(l.portes), bilan: (b => ({ trouves: b.trouves, lectureSeule: b.lectureSeule, pages: b.pages.map(p => ({ nom: p.nom, url: p.url ? urlLisible(p.url) : null })), sans: b.sans.map(x => ({ nom: x.nom, raison: x.raison })), enRoute: b.enRoute.length, envoyeLe: l.bilan?.le || null }))(calculBilanLot(l)), modeles: (l.d.modeles || []).map(md => ({ rang: md.rang, nom: md.nom, couleurs: md.couleurs, nbVideos: md.nbVideos, couleursClient: md.couleursClient === true })), etapes: Object.fromEntries(ETAPES_LOT.map(e => [e, { etat: l.etapes[e]?.etat || 'afaire', erreur: l.etapes[e]?.erreur || null }])) }; }

  return {
    creer, surBouton, reprendre, avancer,
    lancerLot, annulerLot, creerDepuisLot, lireLot: id => lots.get(id) || null, lots: () => [...lots.values()].sort((a, b) => b.creeLe.localeCompare(a.creeLe)).map(resumeLot),
    arreter: async (id, pourquoi = 'arrêt depuis le bureau') => { const m = missions.get(id); if (m) await arreter(m, pourquoi); return !!m; },
    lister: () => [...missions.values()].sort((a, b) => b.creeLe.localeCompare(a.creeLe)).map(resume),
    lire: id => missions.get(id) || null,
    /** La mission née d'une demande de l'accueil (N = 1 : demande.id = l'id de la conversation) : un 2e « ابدا », un vieux
     *  bouton de cette conversation ne referont jamais une mission, et le client ne lit jamais « ابعث لينك جديد ». */
    parDemande,
    /** Au démarrage : chaque mission « encours » repart là où elle s'était arrêtée (une étape interrompue est rejouée). */
    redemarrer() {
      for (const m of missions.values()) if (m.etat === 'encours') { for (const st of Object.values(m.etapes)) if (st.etat === 'encours') st.etat = 'afaire'; avancer(m); }
      for (const l of lots.values()) if (l.etat === 'encours') { for (const st of Object.values(l.etapes)) if (st.etat === 'encours') st.etat = 'afaire'; avancerLot(l); }
      // un N = 1 « seul » dont la mission n'est jamais née (coupure entre les deux) : elle naît maintenant, jamais deux fois
      // [porte-groupee] une porte de lot validée dont les activations n'étaient pas finies (coupure) : la chaîne reprend, une par une
      for (const l of lots.values()) for (const p of ((l.portes && l.portes.liste) || []).filter(q => q.etat === 'validee' && !q.fini)) activerGroupe(l, p).catch(e => journal(`lot ${l.id} : reprise des activations — ${e.message}`));
      for (const l of lots.values()) if (l.etat === 'seul' && !(l.missions || []).length) { try { naitreSeul(l); journal(`lot ${l.id} : mission du modèle seul née au démarrage`); } catch (e) { journal(`lot ${l.id} : ${e.message}`); } }
    },
    actives: () => [...missions.values()].filter(m => m.etat === 'suivi'),
    /** L'horloge (appelée chaque minute par le serveur) : la lecture du soir, une fois par jour, après l'heure du rapport. */
    tick(d = new Date()) {
      try { entretien(d); } catch (e) { journal('entretien de la chaîne : ' + e.message); }
      if (!heureVenue(R().heureRapport, d)) return 0; let n = 0; const jour = jourLocal(d);
      if (verrouQuota(d.getTime())) return 0; // la limite d'usage : la lecture du soir attend (aucun essai consommé)
      for (const m of missions.values()) {
        if (m.etat !== 'suivi' || m.d.suivi?.dernierJour === jour) continue;
        if (m.d.suivi?.attenteConnecteur) continue; // un connecteur à reconnecter : la sonde la relancera
        // une lecture ratée ce soir : au plus LECTURES_PAR_SOIR essais, espacés (le soir d'après, la date change : tout repart)
        const e = m.d.suivi?.essaisLecture;
        if (e && e.date === jour && (e.n >= LECTURES_PAR_SOIR || d.getTime() - Date.parse(e.dernier) < delaiLecture())) continue;
        n++; suivreJour(m);
      }
      return n;
    },
    suivreMaintenant: id => { const m = missions.get(id); if (!m || m.etat !== 'suivi') return false; suivreJour(m); return true; },
    /** Le résultat d'une sonde des connecteurs (serveur : « افحص الكونيكتورات », /api/connecteurs/sonder) : ce qui attendait reprend. */
    connecteursSondes,
    /** L'état de la chaîne (limite d'usage, connecteurs à reconnecter) pour le bureau. */
    etatChaine: () => ({ quota: verrouQuota() ? { reprise: chaine.quota.reprise, prevenu: !!chaine.quota.prevenu } : null, connecteurs: chaine.connecteurs ? { cles: chaine.connecteurs.cles, sondes: chaine.connecteurs.sondes, prochaineSonde: chaine.connecteurs.prochaineSonde } : null, attentes: attentesConnecteur().length }),
    _suivreJour: suivreJour, _aplatirRushes: aplatirRushes, _proposerScale: proposerScale, _hierRentable: hierRentable, _etapes: ETAPE, _etapesLot: ETAPE_LOT, _dossier: dossier, _sauver: sauver, _verifierPlan: verifierPlan, _croiserLectures: croiserLectures, _photoModele: photoModele, _legende: legende, _imagePourClaude: imagePourClaude, _planDuLot: planDuLot,
    annulerPortes, _questionOuverte: questionOuverte, _porteDuLot: porteDuLot,
    _bilanLot: calculBilanLot, _verifierBilanLot: verifierBilanLot, _verifierPorteLot: verifierPorteLot, _activerGroupe: activerGroupe, _dossierPortes: DOSSIER_PORTES, _relirePublication: relirePublication, _relireScale: relireScale, _entretien: entretien, _systemeChaine: systemeChaine, _chaine: chaine, _sondeEnCours: () => sondeEnCours, _lancerScale: lancerScale
  };
  function resume(m) { return { id: m.id, code: m.code, etat: m.etat, etape: m.etape, attente: m.attente, creeLe: m.creeLe, nom: m.d.textes?.nom || m.demande.reponses.nom, lot: m.lot ? { id: m.lot.id, rang: m.lot.rang, rangPlan: m.lot.rangPlan || m.lot.rang, total: m.lot.total, nom: m.lot.nom, couleursClient: m.lot.couleursClient === true } : null, etapes: Object.fromEntries(ETAPES.map(([id, ar]) => [id, { ar, etat: m.etapes[id]?.etat || 'afaire', erreur: m.etapes[id]?.erreur || null }])), produit: m.d.produit?.urlProduit ? urlLisible(m.d.produit.urlProduit) : null, campagne: m.d.campagne?.id || null, lanceLe: m.d.lanceLe || null, scale: m.d.suivi?.scale ? { etat: m.d.suivi.scale.etat, campagne: m.d.suivi.scale.campagne?.id || null } : null, tokens: m.d.tokens || 0,
    quota: m.etat === 'quota' && verrouQuota() ? chaine.quota.reprise : null, connecteur: m.etat === 'connecteur' ? (m.connecteur?.cles || []) : m.d.suivi?.attenteConnecteur ? m.d.suivi.attenteConnecteur.cles : null }; }
}

function listerFichiers(d, re) { try { return fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => path.join(d, f)); } catch { return []; } }
