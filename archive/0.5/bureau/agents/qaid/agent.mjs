// ecomanita 0.5.0 — LE القائد (le manager). Il route les messages Telegram, tient l'étape de chaque modèle, écrit les cartes
// de décision et demande « نعم ». Il ne CALCULE rien : il compte des fiches et des états, il ne sort aucun chiffre d'argent.
import { ETAPES_PRODUIT, passagePermis } from '../../fiche-produit.mjs';

/** Le texte lavé (sans voyelles, alif unifié, sans ponctuation finale) pour reconnaître les phrases. */
export const laver = t => String(t || '').trim().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/[؟?!.]+$/g, '').replace(/\s+/g, ' ').toLowerCase();

/** Les phrases du client (section 7 du chantier) → l'agent et l'intention. */
export const PHRASES = [
  { re: /^(ا?فحص (حسابي|الحساب)|عاود (ال)?فحص|\/inspect(eur)?)$/, agent: 'mofattich', intention: 'fahs' },
  { re: /^وين راني$/, agent: 'qaid', intention: 'ou' },
  { re: /^واش ندير (اليوم|ليوم)$/, agent: 'qaid', intention: 'jour' },
  { re: /^حسبلي (ال)?هدف$/, agent: 'boussala', intention: 'hadaf' },
  { re: /^(سباي|spy)( [a-z]{2})?$/i, agent: 'jasous', intention: 'spy' },
  { re: /^فلترلي$/, agent: 'boussala', intention: 'filtre' },
  { re: /^قراءة (الليل|ليل)$/, agent: 'media_buyer', intention: 'lecture_nuit' },
  { re: /^تقرير (التاكيد|تاكيد)$/, agent: 'taakid', intention: 'rapport' },
  { re: /^تقرير (الستوك|ستوك)$/, agent: 'darahem', intention: 'stock' },
  { re: /^ندخلو (لل|ل)?سكايل$/, agent: 'media_buyer', intention: 'scale' },
  { re: /^كمّ?لت$/, agent: '*kammelt', intention: 'kammelt' },
  { re: /^حبس الكل$/, agent: '*arreter_tout', intention: 'arreter' },
  { re: /^حبس( .+)?$/, agent: '*arreter', intention: 'arreter' },
  { re: /^شعّ?ل الكل$/, agent: '*rallumer_tout', intention: 'rallumer' },
  { re: /^شعّ?ل( .+)?$/, agent: '*rallumer', intention: 'rallumer' },
];

/** Une phrase → { agent, intention, cible? } ou null (le bureau garde alors son chemin de 0.4.x). `charges` = ids chargés. */
export function routerTexte(texte, charges = [], noms = {}) {
  const t = laver(texte);
  for (const p of PHRASES) {
    if (!p.re.test(t)) continue;
    if (p.agent.startsWith('*')) {
      const reste = t.replace(/^(حبس|شعّ?ل)\s*/, '');
      const cible = Object.entries(noms).find(([, n]) => reste && laver(n).includes(reste.replace(/^ال/, '')))?.[0] || null;
      return { agent: p.agent, intention: p.intention, cible };
    }
    if (!charges.includes(p.agent)) return null;
    return { agent: p.agent, intention: p.intention, texte: String(texte).trim() };
  }
  return null;
}

/** Les tags d'étape dans Tassyir (CATALOGUE n'est pas un tag). */
export const TAGS_ETAPE = ETAPES_PRODUIT.filter(e => e !== 'CATALOGUE');
const nomTag = t => (typeof t === 'string' ? t : t && t.name) || '';
const arabe = s => /[\u0600-\u06FF]/.test(String(s || ''));
/** Le modèle sur une ligne À LUI (loi de forme : un nom arabe ne porte pas de chiffre, un numéro va sur une ligne latine). */
export const lignesProduit = f => { const nom = String(f.nom || ''); return arabe(nom) ? [f.id, nom.replace(/[0-9\u0660-\u0669]/g, '').trim()].filter(Boolean) : [`${f.id}${nom && nom !== f.id ? ' · ' + nom : ''}`.slice(0, 36)]; };
/** Une liste de tags en lignes de 36 caractères au plus. */
export const lignesTags = tags => { const out = []; let l = ''; for (const t of tags.length ? tags : ['-']) { const x = l ? l + ' · ' + t : t; if (x.length > 36 && l) { out.push(l); l = t; } else l = x; } if (l) out.push(l.slice(0, 36)); return out; };
/** update_product REMPLACE tous les tags : on garde ceux qui ne sont pas une étape (SRC-…, PRF-…) et on ajoute la nouvelle. */
export function tagsApres(anciens, vers) {
  const garde = (anciens || []).map(nomTag).filter(n => n && !TAGS_ETAPE.includes(n) && !['CANDIDAT', 'FIX', 'STOP'].includes(n));
  return [...new Set([...garde, vers])];
}
/** Un passage ne se propose qu'avec le verdict d'un OUTIL (la boussole ou les petites règles), jamais d'une tête. */
export function verdictValide(v, vers) {
  if (!v || typeof v !== 'object') return { ok: false, ar: 'بلا حكم البوصلة' };
  if (!/^(boussala_[a-z_]+|regles-masar\.[a-zA-Z]+)$/.test(String(v.moteur || ''))) return { ok: false, ar: 'الحكم ما جاش من المحرّك' };
  if (v.decision !== vers) return { ok: false, ar: 'الحكم ما يقولش هاذ المرحلة' };
  return { ok: true };
}

/** Le portefeuille (règle 4 des lois) : toujours un modèle en test, deux ou trois en scale, un en réserve. Compte, ne calcule pas. */
export function santePortefeuille(fiches = []) {
  const n = e => fiches.filter(f => f.etape === e).length;
  const c = { TEST: n('TEST'), VALIDE: n('VALIDE'), SCALE: n('SCALE'), DESTOCK: n('DESTOCK'), RESERVE: n('RESERVE'), CATALOGUE: n('CATALOGUE') };
  const A = [];
  if (fiches.length && c.TEST === 0) A.push({ id: 'pas_de_test', priorite: 1, ar: 'حتى موديل في التاست : دخّل واحد' });
  if (c.SCALE > 3) A.push({ id: 'trop_scale', priorite: 1, ar: 'بزاف موديلات في السكايل' });
  if (fiches.length && c.RESERVE === 0 && c.CATALOGUE === 0) A.push({ id: 'pas_de_reserve', priorite: 1, ar: 'حتى موديل احتياط : اطلب من الجاسوس' });
  const faibles = fiches.filter(f => ['VALIDE', 'SCALE'].includes(f.etape) && f.signaux && f.signaux.faiblesse);
  const successeur = fiches.find(f => f.etape === 'RESERVE') || fiches.find(f => f.etape === 'CATALOGUE') || null;
  for (const f of faibles) A.push({ id: 'faiblesse', priorite: 0, argent: true, ar: 'إشارة ضعف : حضّر الخليفة', produit: f.id, successeur: successeur ? successeur.id : null,
    ref: successeur ? [f.id, 'الخليفة اللي نقترح :', successeur.id] : [f.id, 'ما كاين حتى خليفة : اطلب من الجاسوس'] });
  return { comptes: c, alertes: A, successeur: successeur ? successeur.id : null };
}

/** Les trois choses du jour : les attentes du client d'abord, puis les tâches des agents, puis le portefeuille. */
export function troisChoses(autres, fiches, cartesOuvertes = 0) {
  const T = [];
  if (cartesOuvertes) T.push({ priorite: 0, argent: false, ar: 'بطاقة مرحلة تستنى «نعم» تاعك' });
  for (const x of autres) {
    const s = x.etat, nom = x.contrat.nom_ar;
    if (s.arrete) continue;
    if (s.etat === 'attend_reponse') T.push({ priorite: 0, ar: `${nom} يستنى جوابك` });
    else if (s.etat === 'attend_naam') T.push({ priorite: 0, argent: true, ar: `${nom} يستنى «نعم» على بطاقة` });
    else if (s.etat === 'bloque') T.push({ priorite: 0, ar: `${nom} حابس : شوف علاش` });
    if (x.taches) for (const t of x.taches) T.push({ ...t, ar: t.ar });
  }
  for (const a of santePortefeuille(fiches).alertes) T.push(a);
  return T.sort((a, b) => (a.priorite ?? 2) - (b.priorite ?? 2) || (b.argent ? 1 : 0) - (a.argent ? 1 : 0)).slice(0, 3);
}

const RANGS = ['أولاً', 'ثانياً', 'ثالثاً'];
const ETATS_AR = { repos: 'يرتاح', en_cours: 'يخدم', attend_reponse: 'يستنى جوابك', attend_naam: 'يستنى «نعم»', bloque: 'حابس', fini: 'كمّل الباب تاعو' };

export async function lire(ctx) {
  const autres = ctx.autres();
  const taches = [];
  for (const x of autres) {
    let t = [];
    try { if (x.module.taches) t = (await x.module.taches(x.ctx())) || []; } catch (e) { ctx.journal('taches de ' + x.contrat.id + ' : ' + e.message); }
    taches.push({ id: x.contrat.id, taches: t });
  }
  return { agents: autres.map(x => ({ id: x.contrat.id, nom: x.contrat.nom_ar, etat: x.etat.etat, arrete: !!x.etat.arrete })), taches, fiches: ctx.produits.lister().map(f => ({ id: f.id, nom: f.nom, etape: f.etape, tassyirId: f.tassyirId, signaux: f.signaux || {} })) };
}

export async function executer(ctx) {
  const L = ctx.lecture || {};
  if (ctx.declencheur === 'proposition') {
    const props = (ctx.memo.propositions || []).splice(0); // la mémoire est sauvée avec l'état
    const ecritures = [], refus = [];
    for (const p of props) {
      const f = ctx.produits.lire(p.produit);
      if (!f) { refus.push('ما لقيتش الموديل', String(p.produit || '?')); continue; }
      const v = verdictValide(p.verdict, p.vers);
      if (!v.ok) { refus.push(...lignesProduit(f), `- ${v.ar}`); continue; }
      if (!passagePermis(f.etape, p.vers)) { refus.push(...lignesProduit(f), '- المرحلة هاذي ما تجيش من بعد اللي راه فيها', `${f.etape} → ${p.vers}`); continue; }
      const meta = { produit: f.id, nom: f.nom, de: f.etape, vers: p.vers, verdict: p.verdict, par: p.par || '?' };
      if (!f.tassyirId) { ecritures.push({ type: 'etape', outil: 'carnet.etape', entree: { produit: f.id, vers: p.vers }, meta, ar: ['نبدّلو المرحلة تاع :', ...lignesProduit(f), 'الحكم من البوصلة :', `${f.etape} → ${p.vers}`, 'المنتج مازال ماشي في تسيير'] }); continue; }
      const brut = await ctx.connecteur.lire([{ outil: 'tassyir.get_product', entree: { productId: f.tassyirId } }]);
      const prod = brut.get_product && brut.get_product[0] ? brut.get_product[0].v : null;
      if (!prod) { refus.push(...lignesProduit(f), '- ما قدرتش نقرا المنتج في تسيير'); continue; }
      const avant = (prod.tags || []).map(nomTag).filter(Boolean);
      const apres = tagsApres(prod.tags, p.vers);
      ecritures.push({ type: 'etape', outil: 'tassyir.update_product', entree: { productId: f.tassyirId, tags: apres }, meta: { ...meta, avant },
        ar: ['نحطو التاغ الجديد على :', ...lignesProduit(f), 'التاغات دركا :', ...lignesTags(avant), 'من بعد :', ...lignesTags(apres), 'الحكم من البوصلة'] });
    }
    return { resultat: { type: 'proposition', refus, cartes: ecritures.length }, ecritures };
  }
  const intention = ctx.texte === 'ou' ? 'ou' : 'jour';
  const autres = ctx.autres().map(x => ({ contrat: x.contrat, etat: x.etat, taches: (L.taches || []).find(t => t.id === x.contrat.id)?.taches || [] }));
  return { resultat: { type: intention, choses: troisChoses(autres, L.fiches || [], Object.keys(ctx.st.cartes || {}).length), sante: santePortefeuille(L.fiches || []).comptes } };
}

/** L'écriture après « نعم » : on RELIT les tags juste avant (ils ont pu changer), puis on écrit. */
export async function ecrire(ctx, carte) {
  if (carte.outil === 'carnet.etape') return { local: true };
  const f = ctx.produits.lire(carte.meta.produit);
  const brut = await ctx.connecteur.lire([{ outil: 'tassyir.get_product', entree: { productId: f.tassyirId } }]);
  const prod = brut.get_product && brut.get_product[0] ? brut.get_product[0].v : null;
  const maintenant = (prod && prod.tags || []).map(nomTag).filter(Boolean);
  if (JSON.stringify([...maintenant].sort()) !== JSON.stringify([...carte.meta.avant].sort())) throw new Error('التاغات تبدّلو من بعد البطاقة : نعاود نقترح');
  return ctx.connecteur.ecrire(carte.outil, carte.entree);
}

export async function verifier(ctx) {
  const e = ctx.ecrit;
  if (!e || !e.carte) return { ok: true };
  const m = e.carte.meta;
  if (e.outil === 'tassyir.update_product') {
    const f = ctx.produits.lire(m.produit);
    const brut = await ctx.connecteur.lire([{ outil: 'tassyir.get_product', entree: { productId: f.tassyirId } }]);
    const prod = brut.get_product && brut.get_product[0] ? brut.get_product[0].v : null;
    const lus = new Set((prod && prod.tags || []).map(nomTag));
    if (!e.entree.tags.every(t => lus.has(t))) return { ok: false, ar: 'التاغ ما بانش في تسيير' };
  }
  ctx.produits.changerEtape(m.produit, m.vers, { par: m.par, verdict: m.verdict, naam: true });
  return { ok: true, lignes: ['دخل للمرحلة الجديدة :', ...lignesProduit({ id: m.produit, nom: m.nom }), m.vers, 'كتبتها وعاودت قريتها'] };
}

export async function rapport(ctx) {
  const r = ctx.resultat || {};
  if (r.type === 'proposition') return r.refus && r.refus.length ? ['ما حطّيتش التاغ :', ...r.refus, 'التاغ يتحط غير بحكم البوصلة'] : null;
  if (r.type === 'ou') {
    const L = ctx.lecture || {};
    const c = r.sante || {};
    return ['وين راهم الوكلاء :', ...(L.agents || []).map(a => `- ${a.nom} : ${a.arrete ? 'محبوس' : ETATS_AR[a.etat] || a.etat}`),
      'الموديلات حسب المرحلة :', `TEST ${c.TEST || 0} · VALIDE ${c.VALIDE || 0} · SCALE ${c.SCALE || 0}`, `DESTOCK ${c.DESTOCK || 0} · RESERVE ${c.RESERVE || 0}`, 'باش تعرف واش تدير : واش ندير اليوم'];
  }
  const ch = r.choses || [];
  if (!ch.length) return ['واش ندير اليوم :', 'حتى حاجة مستعجلة اليوم', 'الوكلاء يخدمو، نبعتلك كي كاين جديد'];
  return ['واش ندير اليوم :', ...ch.flatMap((x, i) => [`${RANGS[i]} : ${x.ar}`, ...(x.ref ? [x.ref].flat().map(String) : [])]), 'ابدا بالأولى، ومن بعد الجاية'];
}

export async function porte() { return { ouverte: false }; }
export async function taches() { return []; }
// l'ordre des trois choses suit la loi 2.6 : le rouge avant l'orange, et ce qui touche l'argent d'abord
