// ecom manita — LE SPY PAR LE ROBOT DU BUREAU (23/10/2026). Le client écrit « spy dz » (ou spy morocco / egypte / iraq /
// tunis) à SON robot Telegram et reçoit, comme sur la chaîne du vendeur : pour chaque boutique, dans l'ordre des verdicts,
// la photo de ses modèles (si capturée) puis sa ligne de calcul et « Pubs actives : N (M lues) », puis la conclusion.
// Partage du travail (chacun ce qu'il sait faire, rien de deviné) :
//  - Claude (un tour de la file unique, outil UNIQUE : ads_library_search du connecteur Meta Ads, lecture seule, sans
//    navigateur ni fichiers) fait les étapes 1 à 4 de la skill spy : ratisser, choisir, ouvrir, nommer le produit — et
//    rend un JSON. 2e méthode : chaque page et chaque pub gardée doit se relire dans la réponse BRUTE du connecteur ;
//  - le bureau écrit entree.json et lance les outils de la skill tels quels : spy_calc.py (les verdicts, PASSE exigé),
//    modeles.py (les deux modèles), capture_modeles.mjs (les photos, Chrome sans fenêtre ; une panne = pas de photo) ;
//  - Telegram : les photos par envoyerPhoto (une photo refusée → la ligne part seule), les lignes de spy_calc en HTML
//    telles que spy_calc les écrit, la conclusion en darija (loi de forme) en dernier.
// Un seul SPY à la fois. Le SPY ne touche à AUCUN compte publicitaire et ne lance rien.
// Code original « ecom manita ».
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fautesDeForme } from './telegram.mjs';

/** Les pays du SPY : le mot tapé après « spy » → le code de spy_calc.py. */
export const PAYS_SPY = {
  DZ: { mots: ['dz', 'algerie', 'algérie', 'algeria'], ar: 'الدزاير' },
  MA: { mots: ['ma', 'morocco', 'maroc'], ar: 'المغرب' },
  EG: { mots: ['eg', 'egypte', 'egypt', 'égypte'], ar: 'مصر' },
  IQ: { mots: ['iq', 'iraq', 'irak'], ar: 'العراق' },
  TN: { mots: ['tn', 'tunis', 'tunisie', 'tunisia'], ar: 'تونس' }
};
/** « spy dz » → { pays: 'DZ' } ; « spy » seul ou un pays inconnu → { pays: null, mot } ; autre chose → null. */
export function lireDemandeSpy(texte) {
  const x = /^\s*\/?spy(?:\s+(\S+))?\s*$/i.exec(String(texte || ''));
  if (!x) return null;
  const mot = (x[1] || '').toLowerCase();
  const pays = Object.keys(PAYS_SPY).find(k => PAYS_SPY[k].mots.includes(mot)) || null;
  return { pays, mot };
}

/** Ce que le robot dit (loi de forme : darija, 36 caractères par ligne, aucun chiffre dans une ligne arabe). */
export const TEXTES_SPY = {
  accuse: ar => ['راني نخدم على السباي', `البلاد : ${ar}`, 'نقرا البيبليوتاك تاع ميتا', 'نبعتلك النتيجة كي نكمل'],
  occupe: ['كاين سباي راني نخدم عليه', 'استنى حتى يكمل', 'ومن بعد عاود ابعث'],
  paysInconnu: ['ما عرفتش البلاد', 'اكتب واحد من هاذو :', 'spy dz · spy morocco · spy egypte', 'spy iraq · spy tunis', 'ولا اختار البلاد من الزراير'],
  sansMeta: ['الكونيكتور تاع ميتا ماهوش مربوط', 'اربطو في Claude ومن بعد', 'افحص الكونيكتورات في المكتب', 'وعاود ابعث السباي'],
  metaRefuse: ['ميتا ما خلاتنيش نقرا', 'لازم كونت بوب أكتيف', 'والكونيكتور تاع ميتا مربوط', 'شوف السبب في المكتب'],
  quota: ['الليميت تاع Claude وصلت', 'السباي ما كملش', 'عاود ابعثو من بعد'],
  vide: ['ما لقيت حتى بوتيك تاع لبسة', 'تبيع بالصح في هاذ البلاد', 'خير ما نقلدو حاجة باردة'],
  echec: ['السباي ما كملش', 'شوف السبب في المكتب', 'في الجورنال'],
  photosAbsentes: ['التصاور ما تقدروش يتجابو', 'كروم ما خدمش في هاذ الماشينة', 'بعتلك غير الحسابات'],
  /** La conclusion, tirée des verdicts calculés par spy_calc.py (aucun avis inventé). */
  conclusion: rangs => {
    const l = ['هاذي هي الخلاصة تاع السباي'];
    if (rangs[1]) l.push('كاين اللي خلص الإنتاج ورجع', 'هاذو شوفهم الأولين');
    else if (rangs[2] || rangs[3]) l.push('كاين اللي السلعة عندو ويرجع', 'ما كاين حتى إنتاج مثبت');
    else l.push('ما كاين حتى واحد سكالا بالصح', 'ما تقلد حتى موديل تاع تاست');
    l.push('الحكم إشارة، ماشي ضمان تاع بيع');
    return l;
  }
};

/** Le JSON que rend le tour de Claude (étapes 1 à 4 de la skill), rien d'autre. */
export const SCHEMA_SPY = { type: 'object', properties: {
  pays: { type: 'string' },
  pages: { type: 'array', items: { type: 'object', properties: {
    page_id: { type: 'string' }, page_name: { type: 'string' }, niche: { type: 'string' }, total: { type: 'integer' },
    ads: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, created: { type: 'integer' }, start: { type: 'integer' }, title: { type: 'string' }, texte: { type: 'string' }, produit: { type: 'string' } }, required: ['id', 'created'] } } },
    required: ['page_id', 'page_name', 'ads'] } },
  erreur: { type: 'string' } }, required: ['pages'] };

export const OUTIL_SPY = 'meta.ads_library_search';
const DUREE_SPY_MS = 40 * 60000;

/** Le prompt du tour : la skill spy entière, et ce que le bureau attend du tour (le calcul, les photos et l'envoi sont au bureau). */
export function messageSpy(pays) {
  return `spy ${pays.toLowerCase()} — pays ${pays}, fenêtre des 30 derniers jours.
Tu es lancé par le BUREAU du client, sans navigateur ni fichiers. Fais SEULEMENT les étapes 1 à 4 de la skill avec l'outil ads_library_search (lecture seule) :
1) ratisser chaque mot-clé du pays (un seul mot par appel, countries ["${pays}"], ad_active_status "ACTIVE", limit 50) ;
2) choisir les pages de vêtements au détail (40 au plus) ;
3) ouvrir chaque page (page_ids, 3 au plus par appel, limit 50 ; estimated_total_count > 50 → rouvrir seule, et mettre ce nombre dans « total ») ;
4) pour chaque pub : id, created (ad_creation_time en secondes epoch), start (ad_delivery_start_time en secondes epoch), title, texte (le texte de la pub, court), produit (le modèle nommé par le TEXTE de la pub ; vide s'il n'est pas nommé, jamais deviné).
Ne calcule AUCUN verdict, n'envoie rien : le bureau calcule avec spy_calc.py, capture les photos et envoie sur Telegram.
Rends UNIQUEMENT le JSON demandé : {pays, pages:[{page_id, page_name, niche, total, ads:[…]}]}. Un id que tu n'as pas lu dans une réponse de l'outil n'est JAMAIS écrit. Si le connecteur refuse (aucun compte publicitaire actif, connecteur absent), pages vide et la raison dans « erreur ».`;
}
export function systemeSpy(skill) {
  return `Tu es l'agent SPY du bureau « ecom manita ». Tu lis la Meta Ad Library sans toucher à aucun compte publicitaire : aucune création, aucune modification, aucune activation.\n\n=== LA SKILL SPY (la méthode, à suivre pour les étapes 1 à 4) ===\n${String(skill || '').slice(0, 60000)}`;
}

/** 2e méthode : une page ou une pub n'est gardée que si son id se relit dans une réponse BRUTE d'ads_library_search. */
export function recouperSpy(structure, appels) {
  const brut = (appels || []).filter(a => a && /ads_library_search$/.test(a.nom || '') && !a.erreur).map(a => String(a.sortie || '')).join('\n');
  const ecartes = { pages: 0, pubs: 0 };
  const secondes = v => { const n = typeof v === 'number' ? v : /^\d+$/.test(String(v || '')) ? +v : Date.parse(String(v || '')) / 1000; return Number.isFinite(n) && n > 0 ? Math.round(n > 1e12 ? n / 1000 : n) : null; };
  const pages = [];
  for (const p of (structure && Array.isArray(structure.pages) ? structure.pages : [])) {
    const pid = String(p && p.page_id || '');
    if (!/^\d{6,20}$/.test(pid) || !brut.includes(pid)) { ecartes.pages++; continue; }
    const vus = new Set(), ads = [];
    for (const a of Array.isArray(p.ads) ? p.ads : []) {
      const id = String(a && a.id || ''), created = secondes(a && a.created);
      if (!/^\d{5,25}$/.test(id) || !brut.includes(id) || !created || vus.has(id)) { ecartes.pubs++; continue; }
      vus.add(id);
      const start = secondes(a.start);
      ads.push({ id, created, ...(start ? { start } : {}), title: String(a.title || '').slice(0, 300), texte: String(a.texte || '').slice(0, 300), produit: String(a.produit || '').slice(0, 60) });
    }
    if (!ads.length) { ecartes.pages++; continue; }
    const total = Number.isInteger(p.total) && p.total > ads.length ? p.total : undefined;
    pages.push({ page_id: pid, page_name: String(p.page_name || pid).slice(0, 120), niche: String(p.niche || '').slice(0, 40), ...(total ? { total } : {}), ads });
  }
  return { pages, ecartes };
}

/** Une ligne HTML de spy_calc en texte simple (si Telegram refuse le HTML) : le lien reste lisible. */
export function sansHtml(t) {
  return String(t).replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2\n$1').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// les blocs du rapport, écrits par les fonctions de spy_calc.py (GROUPES, ligne, PAYS) : rien recalculé ici
const PY_BLOCS = String.raw`import json, sys
sys.path.insert(0, sys.argv[1])
import spy_calc
res = json.load(open(sys.argv[2], encoding="utf-8")); pays = res["pays"]; m = spy_calc.PAYS[pays]
blocs = [{"texte": m["drapeau"] + " <b>SPY " + pays + "</b>\nهاذا هو التحليل تاع الشهر\nFenêtre : " + res["fenetre"] + " · " + str(res["nb_pages"]) + " pages"}]
for rang, titre, phrase in spy_calc.GROUPES:
    rows = [x for x in res["pages"] if x["rang"] == rang]
    if not rows:
        continue
    blocs.append({"texte": "<b>" + titre + "</b> — " + str(len(rows)) + "\n" + phrase})
    for x in rows:
        t = spy_calc.ligne(x, pays)
        if "actives" in x:
            t += ("\nPubs actives : %d (%d lues)" % (x["actives"], x["actives_lues"])) if x["actives"] > x["actives_lues"] else ("\nPubs actives : %d" % x["actives"])
        blocs.append({"texte": t, "page_id": x["page_id"]})
jet = [x for x in res["pages"] if x["rang"] >= 8]
if jet:
    blocs.append({"texte": "<b>Écartées</b> — %d\nغير بائعين بالجملة ولا صفحات واقفة\n" % len(jet) + ", ".join(spy_calc.esc(x["page"]) for x in jet)})
rangs = {str(r): sum(1 for x in res["pages"] if x["rang"] == r) for r in range(1, 10)}
print("MANITA_JSON " + json.dumps({"quoi": "spy", "blocs": blocs, "rangs": rangs}, ensure_ascii=False))
`;

/** Lance un programme et rend { code, sortie } — jamais de rejet ; tué après dureeMaxMs. */
function lancer(bin, args, { cwd, env, dureeMaxMs = 300000 } = {}) {
  return new Promise(ok => {
    let p, sortie = '', fini = false;
    const finir = code => { if (fini) return; fini = true; clearTimeout(m); ok({ code, sortie: sortie.slice(-20000) }); };
    try { p = spawn(bin, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
    catch (e) { return ok({ code: -1, sortie: e.message }); }
    const m = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} sortie += `\narrêté : plus de ${Math.round(dureeMaxMs / 1000)} s`; finir(-2); }, dureeMaxMs);
    p.stdout.on('data', d => { sortie += d; }); p.stderr.on('data', d => { sortie += d; });
    p.on('error', e => { sortie += e.message; finir(-1); });
    p.on('close', c => finir(c));
  });
}

/**
 * Le SPY du bureau. deps :
 *  telegram() → l'objet de telegram.mjs ; claude({ systeme, message, outils, schema, dureeMaxMs }) → un tour de la file
 *  (serveur.mjs claudeChaine : connecteur exigé « connected », e.connecteur / e.quota sinon) ; prefixes() → { meta } ;
 *  python() / env() → le python et l'environnement des outils ; dossier : où chaque SPY garde ses fichiers ;
 *  skill : le dossier de la skill spy ; capture : le script de capture (MANITA_SPY_CAPTURE pour l'épreuve).
 */
export function creerSpy({ telegram, claude, prefixes = () => ({}), python = () => 'python3', env = () => process.env, dossier, skill, capture = '', journal = () => {} }) {
  let enCours = null;
  const tg = () => telegram();
  const dire = async lignes => { const r = await tg().envoyer(lignes.join('\n')); if (!r.envoye) journal('spy : message non envoyé — ' + (r.fautes || []).join(' ; ')); return r; };
  const envoyerCalc = async t => {
    let r = await tg().envoyer(t, { controle: false, html: true });
    if (!r.envoye && tg().etat().configure) r = await tg().envoyer(sansHtml(t), { controle: false });
    if (!r.envoye) journal('spy : ligne non envoyée — ' + (r.fautes || []).join(' ; '));
    return r;
  };
  const envPy = () => ({ ...env(), PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' });

  async function travailler(pays, ici) {
    // 1) le tour de Claude : lecture seule, un seul outil
    const lireSkill = () => { try { return fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8'); } catch { return ''; } };
    let r;
    try { r = await claude({ systeme: systemeSpy(lireSkill()), message: messageSpy(pays), outils: [OUTIL_SPY], schema: SCHEMA_SPY, dureeMaxMs: DUREE_SPY_MS }); }
    catch (e) {
      journal(`spy ${pays} : tour refusé — ${e.message}`);
      if (e.connecteur) return dire(TEXTES_SPY.sansMeta);
      if (e.quota) return dire(TEXTES_SPY.quota);
      return dire(TEXTES_SPY.echec);
    }
    const s = r.structure || {};
    const { pages, ecartes } = recouperSpy(s, r.appels);
    journal(`spy ${pays} : ${pages.length} page(s) gardée(s), ${pages.reduce((n, p) => n + p.ads.length, 0)} pub(s) relues dans le brut · écartées (absentes du brut) : ${ecartes.pages} page(s), ${ecartes.pubs} pub(s)`);
    if (!pages.length) {
      if (s.erreur || !(r.appels || []).some(a => /ads_library_search$/.test(a.nom || '') && !a.erreur)) { journal(`spy ${pays} : Meta n'a rien laissé lire — ${String(s.erreur || 'aucune réponse de l\'outil').slice(0, 200)}`); return dire(TEXTES_SPY.metaRefuse); }
      return dire(TEXTES_SPY.vide);
    }
    // 2) les outils de la skill, tels quels
    fs.writeFileSync(path.join(ici, 'entree.json'), JSON.stringify({ pays, now: Math.floor(Date.now() / 1000), pages }, null, 1));
    const calc = await lancer(python(), ['-X', 'utf8', path.join(skill, 'spy_calc.py'), 'entree.json', '--json', 'resultat.json', '--telegram', 'messages.txt'], { cwd: ici, env: envPy(), dureeMaxMs: 120000 });
    if (calc.code !== 0 || !/PASSE/.test(calc.sortie)) { journal(`spy ${pays} : spy_calc.py n'a pas écrit PASSE — ${calc.sortie.trim().slice(-300)}`); return dire(TEXTES_SPY.echec); }
    const blocsR = await lancer(python(), ['-X', 'utf8', '-c', PY_BLOCS, skill, path.join(ici, 'resultat.json')], { cwd: ici, env: envPy(), dureeMaxMs: 60000 });
    let rapport = null;
    for (const l of blocsR.sortie.split(/\r?\n/)) if (l.startsWith('MANITA_JSON ')) { try { rapport = JSON.parse(l.slice(12)); } catch {} }
    if (!rapport || !Array.isArray(rapport.blocs)) { journal(`spy ${pays} : blocs du rapport illisibles — ${blocsR.sortie.trim().slice(-300)}`); return dire(TEXTES_SPY.echec); }
    // les modèles et leurs photos : EN PLUS du rapport, une panne ne bloque jamais les lignes
    const photos = new Map();
    const mod = await lancer(python(), ['-X', 'utf8', path.join(skill, 'modeles.py'), 'entree.json', 'resultat.json', 'modeles.json', 'modeles.txt'], { cwd: ici, env: envPy(), dureeMaxMs: 60000 });
    let photosRatees = false;
    if (mod.code === 0 && /PASSE/.test(mod.sortie)) {
      const captures = path.join(ici, 'captures');
      const cap = await lancer(process.execPath, [capture || path.join(skill, 'capture_modeles.mjs'), 'modeles.json', captures], { cwd: ici, env: env(), dureeMaxMs: 30 * 60000 });
      journal(`spy ${pays} : capture des photos (code ${cap.code}) — ${cap.sortie.trim().split('\n').slice(-1)[0] || ''}`.slice(0, 300));
      let mods = []; try { mods = JSON.parse(fs.readFileSync(path.join(ici, 'modeles.json'), 'utf8')); } catch {}
      const dans = f => { try { const reel = fs.realpathSync(path.resolve(ici, f)); return reel.startsWith(fs.realpathSync(captures) + path.sep) && fs.statSync(reel).isFile() ? reel : null; } catch { return null; } };
      for (const m of Array.isArray(mods) ? mods : []) {
        const fichiers = (m.modeles || []).map(x => x && x.capture ? dans(x.capture) : null).filter(Boolean);
        if (fichiers.length) photos.set(String(m.page_id), fichiers);
      }
      photosRatees = cap.code !== 0 && cap.code !== 1 && !photos.size;
    } else journal(`spy ${pays} : modeles.py n'a pas écrit PASSE — pas de photos (${mod.sortie.trim().slice(-200)})`);
    // 3) l'envoi : boutique par boutique, la photo d'abord, puis sa ligne ; la conclusion en dernier
    let tampon = [], nPhotos = 0, nRefusees = 0;
    const vider = async () => { if (tampon.length) { await envoyerCalc(tampon.join('\n\n')); tampon = []; } };
    const pousser = async t => { if (tampon.length && (tampon.join('\n\n').length + t.length + 2) > 3800) await vider(); tampon.push(t); };
    for (const b of rapport.blocs) {
      const fichiers = b.page_id ? photos.get(String(b.page_id)) || [] : [];
      if (fichiers.length) {
        await vider();
        for (const f of fichiers) { const p = await tg().envoyerPhoto(f, ''); if (p.envoye) nPhotos++; else { nRefusees++; journal(`spy : photo refusée (${(p.fautes || []).join(' ; ')}), la ligne part seule`); } }
      }
      await pousser(String(b.texte || ''));
    }
    await vider();
    if (photosRatees) await dire(TEXTES_SPY.photosAbsentes);
    const rangs = Object.fromEntries(Object.entries(rapport.rangs || {}).map(([k, v]) => [+k, +v || 0]));
    await dire(TEXTES_SPY.conclusion(rangs));
    journal(`spy ${pays} : rapport envoyé — ${rapport.blocs.length} bloc(s), ${nPhotos} photo(s)${nRefusees ? `, ${nRefusees} refusée(s)` : ''} · fichiers : ${ici}`);
  }

  return {
    occupe: () => !!enCours,
    /** Une demande du robot. Rend dès que l'accusé est parti : le travail continue sans bloquer l'écoute de Telegram. */
    async demander({ pays }) {
      const code = String(pays || '').toUpperCase();
      if (!PAYS_SPY[code]) {
        const r = await tg().envoyer(TEXTES_SPY.paysInconnu.join('\n'), { boutons: [Object.keys(PAYS_SPY).slice(0, 3).map(k => ({ texte: PAYS_SPY[k].ar, data: 'spy:' + k })), Object.keys(PAYS_SPY).slice(3).map(k => ({ texte: PAYS_SPY[k].ar, data: 'spy:' + k }))] });
        if (!r.envoye) journal('spy : message non envoyé — ' + (r.fautes || []).join(' ; '));
        return { lance: false, raison: 'pays' };
      }
      if (enCours) { await dire(TEXTES_SPY.occupe); return { lance: false, raison: 'occupe' }; }
      // le connecteur Meta pas gardé par la dernière sonde : une phrase claire, aucun tour de Claude
      if (!prefixes().meta) { journal(`spy ${code} : connecteur Meta absent de la dernière sonde`); await dire(TEXTES_SPY.sansMeta); return { lance: false, raison: 'meta' }; }
      const ici = path.join(dossier, `${new Date().toISOString().replace(/[:.]/g, '-')}-${code}`);
      fs.mkdirSync(ici, { recursive: true });
      enCours = (async () => {
        await dire(TEXTES_SPY.accuse(PAYS_SPY[code].ar));
        journal(`spy ${code} : demandé depuis Telegram`);
        try { await travailler(code, ici); }
        catch (e) { journal(`spy ${code} : ${e.message}`); await dire(TEXTES_SPY.echec).catch(() => {}); }
      })().finally(() => { enCours = null; });
      return { lance: true, dossier: ici };
    }
  };
}
