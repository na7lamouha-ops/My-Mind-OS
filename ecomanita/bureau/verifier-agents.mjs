// ecomanita 0.5.0 — L'ÉPREUVE DES AGENTS (appelée par verifier.mjs, ou seule : node verifier-agents.mjs).
// Tout se fait avec un FAUX Claude (un faux Tassyir derrière) et un FAUX Telegram : aucun compte réel n'est lu ni écrit.
// Les noms et les chiffres des exemples sont INVENTÉS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));

/** Un faux Tassyir derrière un faux Claude : get_product / list_products en lecture, update_product en écriture. */
export function fauxClaude(produits = {}) {
  const log = [];
  const claude = async ({ outils = [], message = '' }) => {
    const appels = [];
    if (outils.includes('tassyir.update_product')) {
      const e = JSON.parse(message.slice(message.indexOf('{')));
      log.push({ outil: 'update_product', entree: e });
      if (produits[e.productId]) produits[e.productId].tags = e.tags.map(n => ({ name: n }));
      appels.push({ nom: 'mcp__T__update_product', entree: e, sortie: JSON.stringify({ id: e.productId, ok: true }) });
    }
    for (const m of message.matchAll(/get_product (\{[^}]*\})/g)) {
      const e = JSON.parse(m[1]); log.push({ outil: 'get_product', entree: e });
      const p = produits[e.productId];
      appels.push({ nom: 'mcp__T__get_product', entree: e, sortie: p ? JSON.stringify({ id: e.productId, ...p }) : 'not found', erreur: !p });
    }
    return { appels, tokens: 0 };
  };
  return { claude, log, produits };
}
export function fauxTelegram() {
  const msgs = []; let n = 0;
  return { msgs, tg: { etat: () => ({ configure: true }), envoyer: async (texte, { boutons = null } = {}) => { msgs.push({ texte, boutons }); return { envoye: true, message_id: ++n }; } } };
}
const maisonTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'manita-agents-'));
const sansFautes = (boucle, fautesDeForme) => { const b = boucle.boite(500); const sales = b.filter(m => m.fautes.length); if (sales.length) throw new Error('loi de forme : ' + sales.map(m => m.fautes.join(',') + '\n' + m.texte).join('\n---\n')); return b.length; };

export async function epreuveAgents({ etape }) {
  const regles = await import('./regles-masar.mjs');
  const pont = await import('./boussala/pont.mjs');
  const boucleM = await import('./boucle.mjs');
  const { chargerAgents } = await import('./agents/index.mjs');
  const qaidM = await import('./agents/qaid/agent.mjs');
  const { ouvrirProduits, passagePermis } = await import('./fiche-produit.mjs');
  const { fautesDeForme } = await import('./telegram.mjs');

  /* ---------- les petites règles et le cerveau ---------- */
  await etape('0.5.0 : regles-masar.mjs (port ESM de masar.js) rejoue ses 26 contrôles', () => {
    const r = regles.testerRegles();
    if (r.ko.length || r.ok.length !== 26) throw new Error(`${r.ok.length}/26 · ${r.ko.join(' | ')}`);
    return '26/26 قوانين المسار صحاح';
  });
  await etape('0.5.0 : la boussole 29.18 est DANS le bureau (bureau/boussala) — golden 6/6, un outil répond ; moteur cassé → l\'outil refuse « العقل ما راهوش » (contrôle négatif)', () => {
    const g = pont.etatCerveau({ relire: true });
    if (!g.ok || g.pass !== 6 || g.version !== '29.18.0') throw new Error(JSON.stringify(g));
    const d = pont.outil('boussala_defaults', {});
    if (!/29\.18/.test(d.text)) throw new Error('boussala_defaults : ' + d.text);
    if (pont.listeOutils().length < 20) throw new Error('outils : ' + pont.listeOutils().length);
    pont._forcerEtat({ ok: false, pass: 5, total: 6, version: '29.18.0', echecs: ['x'] });
    let refus = null; try { pont.outil('boussala_defaults', {}); } catch (e) { refus = e; }
    pont.etatCerveau({ relire: true });
    if (!refus || refus.cerveau !== false || !/العقل ما راهوش/.test(refus.message)) throw new Error('moteur cassé accepté');
    if (fautesDeForme(pont.TEXTE_SANS_CERVEAU).length) throw new Error('message sans cerveau hors loi');
    return `golden ${g.pass}/${g.total} · ${g.version} · ${pont.listeOutils().length} outils · cassé → refus`;
  });

  /* ---------- les contrats ---------- */
  const { agents, refuses } = await chargerAgents();
  await etape('0.5.0 : les contrats des agents se chargent et sont valides (agents/<id>/agent.json + agent.mjs + prompt.md)', () => {
    if (refuses.length) throw new Error(refuses.map(r => `${r.id} : ${r.fautes.join(', ')}`).join(' · '));
    if (!agents.some(a => a.contrat.id === 'qaid')) throw new Error('le القائد manque');
    return agents.map(a => `${a.contrat.id} (${a.contrat.nom_ar})`).join(' · ');
  });
  await etape('0.5.0 : un contrat FAUX est refusé — question avec chiffre, demande de photo, écriture en lecture, interdits manquants, sortie fausse (contrôles négatifs)', () => {
    const bon = JSON.parse(fs.readFileSync(path.join(ICI, 'agents', 'qaid', 'agent.json'), 'utf8'));
    if (boucleM.validerContrat(bon).length) throw new Error('le bon contrat refusé : ' + boucleM.validerContrat(bon));
    const cas = [
      [{ ...bon, questions: [{ id: 'x', ar: 'شحال عندك 4 محافظ؟', quand: 'pas lisible' }] }, /chiffre/],
      [{ ...bon, questions: [{ id: 'x', ar: 'ابعثلي تصويرة المحافظ', quand: 'pas lisible' }] }, /photo/],
      [{ ...bon, outils_lecture: ['tassyir.update_product'] }, /écriture en lecture/],
      [{ ...bon, interdit: ['calcul'] }, /interdit/],
      [{ ...bon, outils_ecriture_avec_naam: ['tassyir.create_finance_transaction'] }, /interdite/],
      [{ ...bon, sortie: { carnet: 'autre.json', rapport: 'x' } }, /sortie/],
      [{ ...bon, cadence: { type: 'heures', heures: ['8h'] } }, /cadence/],
    ];
    for (const [c, re] of cas) { const f = boucleM.validerContrat(c); if (!f.some(x => re.test(x))) throw new Error(`pas refusé (${re}) : ${f.join(',')}`); }
    return `${cas.length} contrats faux refusés`;
  });

  /* ---------- la boucle, avec un agent d'essai ---------- */
  const essai = (opts = {}) => {
    const compte = { lire: 0, ecrire: 0, executer: 0 };
    const module = {
      async lire() { compte.lire++; if (opts.lireJette) throw new Error(opts.lireJette); return { lu: true }; },
      async prerequis(ctx) {
        for (const q of [{ id: 'taux', ar: 'شحال الدولار عندك؟' }, { id: 'objectif', ar: 'واش هو الهدف تاعك؟', boutons: ['بلا هدف', 'عندي هدف'] }])
          if ((opts.questions ?? true) && !(q.id in ctx.reponses)) return { question: q };
        return {};
      },
      async executer(ctx) {
        compte.executer++;
        if (opts.ecritDirect) { await ctx.connecteur.ecrire('tassyir.update_product', { productId: 'p1', tags: ['X'] }); }
        if (opts.ecriture) return { resultat: { fait: 1 }, ecriture: { outil: 'tassyir.update_product', entree: { productId: 'p1', tags: ['SRC-TR', 'TEST'] }, ar: ['نبدّل التاغات تاع المنتج'] } };
        return { resultat: { fait: 1 } };
      },
      async ecrire(ctx, carte) { compte.ecrire++; return ctx.connecteur.ecrire(carte.outil, carte.entree); },
      async verifier() { return { ok: true }; },
      async rapport() { if (opts.rapportJetteUneFois && !compte.jete) { compte.jete = true; throw new Error('coupure'); } return ['هاذا هو التقرير تاع التجربة', 'كلش مليح']; },
      async porte() { return { ouverte: !!opts.porte, lignes: ['الشروط كاملين'] }; },
    };
    const contrat = { id: 'tajriba', nom_ar: 'التجربة', emoji: '🧪', declencheurs: ['جرّب'], cadence: opts.cadence || { type: 'evenement' }, questions: [], prerequis_depart: opts.prerequis || [],
      prerequis_avancer: [], outils_lecture: ['tassyir.get_product'], outils_ecriture_avec_naam: ['tassyir.update_product'], interdit: ['prix_retour', 'wallets', 'tokens'],
      sortie: { carnet: 'etat/tajriba.json', rapport: 'تقرير التجربة' }, porte: { id: opts.porte ? 'pret_essai' : null, debloque: opts.porte ? ['suivant'] : [] }, boucle: { max_iterations_jour: opts.max || 20, meme_erreur_max: 3 } };
    if (boucleM.validerContrat(contrat).length) throw new Error('contrat d\'essai : ' + boucleM.validerContrat(contrat));
    return { compte, agent: { contrat, module } };
  };
  const qaidAgent = agents.find(a => a.contrat.id === 'qaid');
  const monter = (maison, liste, { claude = fauxClaude({ p1: { tags: [{ name: 'SRC-TR' }] } }).claude, communs = {}, horloge } = {}) => {
    const T = fauxTelegram();
    const b = boucleM.creerBoucle({ maison, agents: liste, telegram: () => T.tg, claude, prerequisCommuns: communs, ...(horloge ? { horloge } : {}) });
    return { b, T };
  };

  await etape('0.5.0 boucle : UNE question à la fois ; la boucle s\'arrête (attend_reponse) ; la réponse la relance, la 2e question part seule ; un bouton de réponse marche ; tout passe la loi de forme', async () => {
    const maison = maisonTemp(); const { agent, compte } = essai(); const { b, T } = monter(maison, [agent]);
    const r1 = await b.cycle('tajriba', { humain: true });
    if (r1.raison !== 'question' || b.etat('tajriba').etat !== 'attend_reponse' || b.etat('tajriba').question.id !== 'taux') throw new Error(JSON.stringify(r1));
    if (compte.executer) throw new Error('exécuté avant la réponse');
    const q1 = T.msgs.filter(m => /شحال الدولار/.test(m.texte)); if (q1.length !== 1 || /واش هو الهدف/.test(q1[0].texte)) throw new Error('deux questions dans un message');
    if ((await b.cycle('tajriba', { humain: true })).raison !== 'attend_reponse') throw new Error('un 2e cycle a tourné pendant la question');
    await b.repondre('tajriba', 'taux', '250');
    const st = b.etat('tajriba'); if (st.question?.id !== 'objectif' || st.reponses.taux !== '250') throw new Error(JSON.stringify(st.question));
    const qb = T.msgs.at(-1); const btn = qb.boutons[0][0]; if (!/^b:tajriba:r:objectif:0$/.test(btn.data)) throw new Error('bouton ' + btn.data);
    const rb = await b.surBouton(btn.data); if (!rb.ok) throw new Error('bouton de réponse');
    const fin = b.etat('tajriba'); if (fin.etat !== 'repos' || fin.reponses.objectif !== 'بلا هدف' || compte.executer !== 1) throw new Error(`état ${fin.etat}, exécuté ${compte.executer}`);
    if (!T.msgs[0].texte.startsWith('🧪 التجربة')) throw new Error('le message ne dit pas qui parle');
    return `taux → objectif (bouton) → exécuté une fois · ${sansFautes(b, fautesDeForme)} messages dans la loi`;
  });

  await etape('0.5.0 boucle : un prérequis de départ manque → l\'agent ne démarre pas, dit ce qui manque (bloque) ; l\'horloge ne le relance pas ; le client le relance quand c\'est réglé (contrôles négatifs)', async () => {
    const maison = maisonTemp(); let branche = false; const { agent, compte } = essai({ prerequis: ['connecteur_tassyir'], questions: false });
    const { b, T } = monter(maison, [agent], { communs: { connecteur_tassyir: () => ({ ok: branche, ar: 'الكونيكتور تاع تسيير ماشي مربوط' }) } });
    const r = await b.cycle('tajriba', { humain: true });
    if (r.raison !== 'prerequis' || b.etat('tajriba').etat !== 'bloque' || compte.executer) throw new Error(JSON.stringify(r));
    if (!T.msgs.some(m => /ناقص/.test(m.texte) && /تسيير/.test(m.texte))) throw new Error('le manque n\'est pas dit');
    if ((await b.cycle('tajriba', { declencheur: 'horloge' })).raison !== 'bloque') throw new Error('l\'horloge a relancé un agent bloqué');
    branche = true; const r2 = await b.cycle('tajriba', { humain: true });
    if (!r2.fait || compte.executer !== 1) throw new Error(JSON.stringify(r2));
    return 'bloque → dit → horloge ignorée → relancé par le client';
  });

  await etape('0.5.0 boucle : une écriture SANS « نعم » est refusée ; la même erreur trois fois → bloque + message (contrôles négatifs)', async () => {
    const maison = maisonTemp(); const F = fauxClaude({ p1: { tags: [] } }); const { agent } = essai({ ecritDirect: true, questions: false });
    const { b, T } = monter(maison, [agent], { claude: F.claude });
    for (let i = 0; i < 3; i++) await b.cycle('tajriba', { humain: i === 0, declencheur: 'horloge' });
    const st = b.etat('tajriba');
    if (F.log.some(x => x.outil === 'update_product')) throw new Error('écrit sans نعم');
    if (st.etat !== 'bloque' || st.bloqueRaison?.type !== 'erreurs' || !/بلا «نعم»/.test(st.bloqueRaison.cle)) throw new Error(JSON.stringify(st.bloqueRaison) + ' ' + st.etat);
    if (!T.msgs.some(m => /ثلاث مرات/.test(m.texte))) throw new Error('message de blocage absent');
    return 'trois refus « كتابة بلا نعم » → bloque, rien écrit';
  });

  await etape('0.5.0 boucle : la carte « نعم » — rien n\'est écrit avant ; « نعم » écrit UNE fois puis relit ; un 2e clic ne réécrit pas ; le même cycle rejoué ne refait pas la carte (idempotent) ; « لا » n\'écrit rien (contrôles négatifs)', async () => {
    const maison = maisonTemp(); const F = fauxClaude({ p1: { tags: [{ name: 'SRC-TR' }] } }); const { agent, compte } = essai({ ecriture: true, questions: false });
    const { b, T } = monter(maison, [agent], { claude: F.claude });
    const r = await b.cycle('tajriba', { humain: true });
    if (r.raison !== 'attend_naam' || F.log.some(x => x.outil === 'update_product')) throw new Error('écrit avant نعم : ' + JSON.stringify(r));
    const carte = T.msgs.at(-1); const naam = carte.boutons[0][0].data; if (!/^b:tajriba:naam:/.test(naam)) throw new Error(naam);
    if (!carte.boutons[1].some(x => /hbes/.test(x.data))) throw new Error('pas de bouton « حبس » sur la carte');
    await b.surBouton(naam); const r2 = await b.surBouton(naam);
    const ecrits = F.log.filter(x => x.outil === 'update_product');
    if (ecrits.length !== 1 || compte.ecrire !== 1 || r2.ok !== false) throw new Error(`écritures ${ecrits.length}, 2e clic ${JSON.stringify(r2)}`);
    if (b.etat('tajriba').etat !== 'repos') throw new Error('état après نعم : ' + b.etat('tajriba').etat);
    await b.cycle('tajriba', { humain: true });
    if (F.log.filter(x => x.outil === 'update_product').length !== 1 || b.etat('tajriba').etat === 'attend_naam') throw new Error('le même changement redemandé ou réécrit');
    const m2 = maisonTemp(); const F2 = fauxClaude({ p1: { tags: [] } }); const e2 = essai({ ecriture: true, questions: false }); const x2 = monter(m2, [e2.agent], { claude: F2.claude });
    await x2.b.cycle('tajriba', { humain: true }); await x2.b.surBouton(x2.T.msgs.at(-1).boutons[0][1].data);
    if (F2.log.some(x => x.outil === 'update_product') || x2.b.etat('tajriba').etat !== 'repos') throw new Error('« لا » a écrit');
    return 'carte → « نعم » → 1 écriture · 2e clic → carte fermée · rejoué → rien · « لا » → rien';
  });

  await etape('0.5.0 boucle : l\'état survit au redémarrage — une question ouverte se répond après la coupure ; un cycle coupé au rapport reprend AU RAPPORT (lire() pas rejoué)', async () => {
    const maison = maisonTemp();
    const a = essai(); const x = monter(maison, [a.agent]);
    await x.b.cycle('tajriba', { humain: true });
    const y = monter(maison, [essai().agent]); // le bureau s'éteint et se rallume : une nouvelle boucle, le même disque
    if (y.b.etat('tajriba').etat !== 'attend_reponse') throw new Error('question perdue');
    await y.b.repondre('tajriba', 'taux', '250'); await y.b.repondre('tajriba', 'objectif', 'بلا هدف');
    if (y.b.etat('tajriba').etat !== 'repos') throw new Error('pas fini après la coupure : ' + y.b.etat('tajriba').etat);
    const m2 = maisonTemp(); const c1 = essai({ questions: false, rapportJetteUneFois: true }); const z = monter(m2, [c1.agent]);
    await z.b.cycle('tajriba', { humain: true });
    if (z.b.etat('tajriba').pas !== 'rapport') throw new Error('pas gardé : ' + z.b.etat('tajriba').pas);
    const c2 = essai({ questions: false }); const z2 = monter(m2, [c2.agent]);
    await z2.b.cycle('tajriba', { humain: true });
    if (c2.compte.lire !== 0 || c2.compte.executer !== 0 || z2.b.etat('tajriba').etat !== 'repos' || !z2.b.etat('tajriba').dernierRapport) throw new Error(`lire ${c2.compte.lire}, executer ${c2.compte.executer}`);
    // coupure PENDANT un cycle (état « en_cours » sur le disque) : au redémarrage l'horloge le reprend au pas gardé
    const m3 = maisonTemp(); const c3 = essai({ questions: false }); const w = monter(m3, [c3.agent]);
    await w.b.cycle('tajriba', { humain: true }); const f3 = path.join(m3, 'carnet', 'etat', 'tajriba.json'); const s3 = JSON.parse(fs.readFileSync(f3, 'utf8')); fs.writeFileSync(f3, JSON.stringify({ ...s3, etat: 'en_cours', pas: 'executer', lecture: { lu: true } }));
    const c4 = essai({ questions: false }); const w2 = monter(m3, [c4.agent]);
    if (w2.b.etat('tajriba').etat !== 'repos') throw new Error('« en_cours » resté après le redémarrage');
    await w2.b.tick();
    if (c4.compte.lire !== 0 || c4.compte.executer !== 1 || w2.b.etat('tajriba').etat !== 'repos' || w2.b.etat('tajriba').pas !== null) throw new Error(`reprise par l'horloge : lire ${c4.compte.lire}, executer ${c4.compte.executer}`);
    return 'question répondue après coupure · reprise au pas « rapport » · coupé « en_cours » → l\'horloge reprend au pas « executer »';
  });

  await etape('0.5.0 boucle : « حبس » arrête un agent (cycle, carte et réponse refusés) ; « حبس الكل » arrête tout ; « شعّل » rallume ; le plafond de cycles par jour tient (contrôles négatifs)', async () => {
    const maison = maisonTemp(); const F = fauxClaude({ p1: { tags: [] } }); const e = essai({ ecriture: true, questions: false }); const { b, T } = monter(maison, [e.agent, qaidAgent], { claude: F.claude });
    await b.cycle('tajriba', { humain: true }); const carte = T.msgs.at(-1).boutons;
    await b.surBouton(carte[1].find(x => /hbes/.test(x.data)).data);
    if (!b.etat('tajriba').arrete || (await b.cycle('tajriba', { humain: true })).raison !== 'arrete') throw new Error('pas arrêté');
    const r = await b.surBouton(carte[0][0].data); if (r.ok !== false || F.log.some(x => x.outil === 'update_product')) throw new Error('écrit après حبس');
    await b.arreter(null); if (!b.etats().every(s => s.arrete)) throw new Error('حبس الكل');
    await b.rallumer('tajriba'); if (b.etat('tajriba').arrete || !b.etat('qaid').arrete) throw new Error('شعّل ciblé');
    const m2 = maisonTemp(); const p = essai({ questions: false, max: 2 }); const z = monter(m2, [p.agent]);
    for (let i = 0; i < 4; i++) await z.b.cycle('tajriba', { humain: true });
    if (p.compte.executer !== 2 || (await z.b.cycle('tajriba', { humain: true })).raison !== 'max_jour') throw new Error('plafond : ' + p.compte.executer);
    return 'حبس → tout refusé · حبس الكل · شعّل ciblé · plafond 2/jour';
  });

  await etape('0.5.0 boucle : la porte ouverte ne se franchit JAMAIS seule — carte du القائد, « نعم » → fini + _portes.json, l\'agent suivant passe son prérequis « porte: » ; « لا » → reste (contrôles négatifs)', async () => {
    const maison = maisonTemp(); const e = essai({ questions: false, porte: true });
    const suiv = { contrat: { ...e.agent.contrat, id: 'suivant', nom_ar: 'اللي من بعد', sortie: { carnet: 'etat/suivant.json', rapport: 'تقرير' }, prerequis_depart: ['porte:pret_essai'], porte: { id: null, debloque: [] } }, module: essai({ questions: false }).agent.module };
    const { b, T } = monter(maison, [e.agent, suiv, qaidAgent]);
    if ((await b.cycle('suivant', { humain: true })).raison !== 'prerequis') throw new Error('le suivant démarre sans la porte');
    await b.cycle('tajriba', { humain: true });
    if (b.etat('tajriba').etat !== 'attend_naam' || b.portes().pret_essai) throw new Error('porte franchie seule');
    const carte = T.msgs.at(-1); if (!carte.texte.startsWith('🎯 القائد') || !/نفوتو/.test(carte.texte)) throw new Error('la carte ne vient pas du القائد');
    await b.surBouton(carte.boutons[0][0].data);
    if (b.etat('tajriba').etat !== 'fini' || !b.portes().pret_essai) throw new Error('après نعم : ' + b.etat('tajriba').etat);
    if (!(await b.cycle('suivant', { humain: true })).fait) throw new Error('le suivant reste fermé');
    const m2 = maisonTemp(); const e2 = essai({ questions: false, porte: true }); const z = monter(m2, [e2.agent, qaidAgent]);
    await z.b.cycle('tajriba', { humain: true }); await z.b.surBouton(z.T.msgs.at(-1).boutons[0][1].data);
    if (z.b.portes().pret_essai || z.b.etat('tajriba').etat !== 'repos') throw new Error('« لا » a franchi');
    return `carte 🎯 → « نعم » → fini, suivant ouvert · « لا » → repos · ${sansFautes(b, fautesDeForme)} messages dans la loi`;
  });

  await etape('0.5.0 boucle : l\'horloge — une cadence « heures 08:00 » ne tourne qu\'à l\'échéance ; « evenement » jamais seule', async () => {
    let t = new Date('2026-10-26T07:00:00').getTime();
    const maison = maisonTemp(); const h = essai({ questions: false, cadence: { type: 'heures', heures: ['08:00'] } }); const ev = { ...essai({ questions: false }).agent, contrat: { ...essai({ questions: false }).agent.contrat, id: 'evt', sortie: { carnet: 'etat/evt.json', rapport: 'تقرير' } } };
    const { b } = monter(maison, [h.agent, ev], { horloge: () => t });
    await b.tick(t); if (h.compte.executer) throw new Error('tourné avant l\'heure');
    t = new Date('2026-10-26T07:59:00').getTime(); await b.tick(t); if (h.compte.executer) throw new Error('07:59');
    t = new Date('2026-10-26T08:00:30').getTime(); const l = await b.tick(t);
    if (h.compte.executer !== 1 || l.join() !== 'tajriba') throw new Error('08:00 : ' + l);
    t += 3600000; await b.tick(t); if (h.compte.executer !== 1) throw new Error('rejoué dans la même journée');
    if (boucleM.prochaineEcheance({ type: 'hebdo', jour: 0, heure: '09:00' }, new Date('2026-10-26T10:00:00').getTime()) !== new Date('2026-11-01T09:00:00').getTime()) throw new Error('hebdo dimanche');
    return '07:00 rien · 08:00 un cycle · 09:00 rien · dimanche 09:00';
  });

  /* ---------- le القائد ---------- */
  await etape('0.5.0 القائد : les phrases de Telegram vont au bon agent ; un agent pas encore construit → null (le chemin 0.4.x reste) ; « حبس الكل », « حبس المفتّش », « شعّل الكل »', () => {
    const tous = ['qaid', 'mofattich', 'boussala', 'jasous', 'media_buyer', 'taakid', 'darahem'];
    const cas = [['افحص حسابي', 'mofattich'], ['وين راني', 'qaid'], ['واش ندير اليوم؟', 'qaid'], ['حسبلي الهدف', 'boussala'], ['سباي dz', 'jasous'], ['فلترلي', 'boussala'],
      ['قراءة الليل', 'media_buyer'], ['تقرير التأكيد', 'taakid'], ['تقرير الستوك', 'darahem'], ['ندخلو للسكايل؟', 'media_buyer'], ['كمّلت', '*kammelt'], ['حبس الكل', '*arreter_tout'], ['شعّل الكل', '*rallumer_tout']];
    for (const [t, a] of cas) { const r = qaidM.routerTexte(t, tous); if (!r || r.agent !== a) throw new Error(`${t} → ${JSON.stringify(r)}`); }
    if (qaidM.routerTexte('افحص حسابي', ['qaid']) !== null) throw new Error('agent absent : doit rendre null');
    if (qaidM.routerTexte('قشابية نسائية', tous) !== null || qaidM.routerTexte('https://drive.google.com/x', tous) !== null) throw new Error('faux positif');
    const c = qaidM.routerTexte('حبس المفتّش', tous, { mofattich: 'المفتّش', qaid: 'القائد' }); if (c.agent !== '*arreter' || c.cible !== 'mofattich') throw new Error(JSON.stringify(c));
    return `${cas.length} phrases · agent absent → 0.4.x · cible nommée`;
  });
  await etape('0.5.0 القائد : les tags — l\'ancien relu, SRC-/PRF- gardés, l\'étape remplacée ; le passage d\'étape exige le verdict d\'un OUTIL et un passage permis (contrôles négatifs)', () => {
    const t = qaidM.tagsApres([{ name: 'SRC-TR' }, { name: 'PRF-ABAYA' }, { name: 'TEST' }, 'CANDIDAT'], 'VALIDE');
    if (t.join() !== 'SRC-TR,PRF-ABAYA,VALIDE') throw new Error(t.join());
    if (qaidM.verdictValide(null, 'VALIDE').ok || qaidM.verdictValide({ moteur: 'tete', decision: 'VALIDE' }, 'VALIDE').ok || qaidM.verdictValide({ moteur: 'boussala_testweek', decision: 'ECHEC-ADS' }, 'VALIDE').ok) throw new Error('verdict faux accepté');
    if (!qaidM.verdictValide({ moteur: 'boussala_testweek', decision: 'VALIDE' }, 'VALIDE').ok || !qaidM.verdictValide({ moteur: 'regles-masar.couverture', decision: 'DESTOCK' }, 'DESTOCK').ok) throw new Error('verdict juste refusé');
    if (passagePermis('CATALOGUE', 'SCALE') || passagePermis('TEST', 'SCALE') || !passagePermis('TEST', 'VALIDE') || !passagePermis('VALIDE', 'SCALE') || passagePermis('DESTOCK', 'TEST')) throw new Error('passages');
    return 'SRC-TR,PRF-ABAYA,VALIDE · verdict de tête refusé · CATALOGUE→SCALE refusé';
  });
  await etape('0.5.0 القائد : « حطّ VALIDE » — carte sans écrire ; « نعم » → relit les tags, écrit TEST→VALIDE en gardant SRC-, relit, la fiche MBF-M01 passe VALIDE avec la décision datée ; tags changés entre la carte et « نعم » → rien écrit ; verdict absent → refus dit (contrôles négatifs)', async () => {
    const maison = maisonTemp(); const F = fauxClaude({ 'tz-101': { name: 'Abaya Exemple', tags: [{ name: 'SRC-TR' }, { name: 'TEST' }] }, 'tz-102': { name: 'Robe Exemple', tags: [{ name: 'TEST' }] } });
    const { b, T } = monter(maison, [qaidAgent], { claude: F.claude });
    const P = ouvrirProduits(maison);
    const f1 = P.creer({ nom: 'Abaya Exemple', tassyirId: 'tz-101' }); P.changerEtape(f1.id, 'TEST', { par: 'essai', naam: true });
    const f2 = P.creer({ nom: 'Robe Exemple', tassyirId: 'tz-102' }); P.changerEtape(f2.id, 'TEST', { par: 'essai', naam: true });
    await b.proposer('qaid', { produit: f1.id, vers: 'VALIDE', verdict: { moteur: 'boussala_testweek', decision: 'VALIDE', version: '29.18.0' }, par: 'media_buyer' });
    if (F.log.some(x => x.outil === 'update_product')) throw new Error('écrit avant نعم');
    const carte = T.msgs.find(m => /نحطو التاغ الجديد/.test(m.texte)); if (!carte || !/SRC-TR · VALIDE/.test(carte.texte)) throw new Error('carte : ' + (carte && carte.texte));
    if (b.etat('qaid').etat === 'attend_naam') throw new Error('le القائد bloqué par sa carte');
    await b.surBouton(carte.boutons[0][0].data);
    const ec = F.log.filter(x => x.outil === 'update_product');
    if (ec.length !== 1 || ec[0].entree.tags.join() !== 'SRC-TR,VALIDE') throw new Error(JSON.stringify(ec));
    const lu = P.lire(f1.id); if (lu.etape !== 'VALIDE' || lu.decisions.at(-1).vers !== 'VALIDE' || lu.decisions.at(-1).verdict.moteur !== 'boussala_testweek') throw new Error(JSON.stringify(lu.decisions));
    await b.proposer('qaid', { produit: f2.id, vers: 'VALIDE', verdict: { moteur: 'boussala_testweek', decision: 'VALIDE' } });
    const c2 = T.msgs.filter(m => /نحطو التاغ الجديد/.test(m.texte)).at(-1);
    F.produits['tz-102'].tags.push({ name: 'PRF-NOUVEAU' }); // le client a changé un tag entre-temps
    await b.surBouton(c2.boutons[0][0].data);
    if (F.log.filter(x => x.outil === 'update_product').length !== 1 || P.lire(f2.id).etape !== 'TEST') throw new Error('écrit sur des tags changés');
    await b.proposer('qaid', { produit: f2.id, vers: 'VALIDE', verdict: null });
    if (!T.msgs.some(m => /ما حطّيتش التاغ/.test(m.texte) && /بلا حكم البوصلة/.test(m.texte))) throw new Error('refus non dit');
    return `carte → « نعم » → SRC-TR,VALIDE écrit et relu · fiche VALIDE datée · tags changés → rien · sans verdict → refus · ${sansFautes(b, fautesDeForme)} messages dans la loi`;
  });
  await etape('0.5.0 القائد : « واش ندير اليوم » — trois choses rangées (l\'argent d\'abord, puis le client attendu), le portefeuille (pas de test, pas de réserve, signal de faiblesse → le successeur) ; « وين راني » ; loi de forme', async () => {
    const maison = maisonTemp(); const e = essai(); const { b, T } = monter(maison, [e.agent, qaidAgent]);
    const P = ouvrirProduits(maison);
    const a = P.creer({ nom: 'عباية مثال 2', tassyirId: null }); P.changerEtape(a.id, 'TEST', { naam: true, par: 'x' }); P.changerEtape(a.id, 'VALIDE', { naam: true, par: 'x' });
    P.completer(a.id, { signaux: { faiblesse: true } }, 'hares');
    const r = P.creer({ nom: 'Robe Reserve' }); P.changerEtape(r.id, 'RESERVE', { naam: true, par: 'x' });
    await b.cycle('tajriba', { humain: true }); // il attend une réponse
    await b.cycle('qaid', { humain: true, texte: 'jour' });
    const j = T.msgs.filter(m => /واش ندير اليوم :/.test(m.texte)).at(-1);
    if (!j) throw new Error('pas de rapport');
    const L = j.texte.split('\n');
    // loi 2.6 : le rouge d'abord, et ce qui touche l'argent avant le reste (la faiblesse d'un modèle en VALIDE), puis le client attendu
    if (!/أولاً : إشارة ضعف/.test(j.texte) || !/ثانياً : التجربة يستنى جوابك/.test(j.texte) || !L.includes(r.id) || !L.includes(a.id)) throw new Error(j.texte);
    const s = qaidM.santePortefeuille(P.lister()); if (!s.alertes.some(x => x.id === 'pas_de_test') || s.successeur !== r.id) throw new Error(JSON.stringify(s));
    await b.cycle('qaid', { humain: true, texte: 'ou' });
    const o = T.msgs.at(-1).texte; if (!/وين راهم الوكلاء/.test(o) || !/VALIDE 1/.test(o)) throw new Error(o);
    return `3 choses (attente du client, faiblesse, successeur ${r.id}) · وين راني · ${sansFautes(b, fautesDeForme)} messages dans la loi`;
  });
}

/** Le bureau ENTIER (serveur.mjs) avec un faux Telegram : les phrases arrivent au القائد, les boutons « b: » répondent, et ce qui
 *  n'a pas encore son agent garde le chemin de 0.4.x (« افحص حسابي » → l'inspecteur de 0.4.2). */
export async function epreuveServeurAgents({ etape }) {
  const http = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { fautesDeForme } = await import('./telegram.mjs');
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-srv-agents-'));
  const COPIE = path.join(D, 'bureau'); fs.mkdirSync(COPIE);
  for (const f of fs.readdirSync(ICI)) if (!f.startsWith('_') && f !== 'node_modules' && f !== 'config.local.json') fs.cpSync(path.join(ICI, f), path.join(COPIE, f), { recursive: true });
  fs.writeFileSync(path.join(COPIE, 'config.local.json'), JSON.stringify({ telegram: { token: ['FAUX', 'AGENTS'].join('-'), chat_id: '4545' }, connecteurs: { tassyir: 'mcp__claude_ai_Boutique__' } }));
  const suite = [], aLivrer = []; let maj = 100;
  const livrer = u => aLivrer.push({ update_id: ++maj, ...u });
  const ftg = http.createServer((req, res) => { const m = []; req.on('data', d => m.push(d)); req.on('end', () => {
    const meth = req.url.split('/').pop(); let j = {}; try { j = JSON.parse(Buffer.concat(m).toString('utf8') || '{}'); } catch {}
    const rep = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: o })); };
    if (meth === 'getUpdates') { if (aLivrer.length) return rep(aLivrer.splice(0)); return setTimeout(() => rep([]), 120); }
    if (meth === 'sendMessage') { suite.push({ meth, text: j.text, boutons: j.reply_markup ? j.reply_markup.inline_keyboard.flat().map(b => b.callback_data) : [] }); return rep({ message_id: 900 + suite.length }); }
    suite.push({ meth, j }); rep(true);
  }); });
  await new Promise(r => ftg.listen(0, '127.0.0.1', r));
  const port = 5500 + Math.floor(Math.random() * 300);
  const env = { ...process.env, PORT: String(port), MANITA_MAISON: path.join(D, 'maison'), MANITA_CLAUDE: 'node:' + path.join(D, 'pas-de-claude.mjs'), MANITA_TELEGRAM_API: `http://127.0.0.1:${ftg.address().port}`, MANITA_ATELIER: path.join(D, 'pas-d-atelier') };
  fs.writeFileSync(path.join(D, 'pas-de-claude.mjs'), 'process.exit(3)\n');
  delete env.CLAUDECODE;
  const srv = spawn(process.execPath, ['serveur.mjs'], { cwd: COPIE, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', d => journal += d); srv.stderr.on('data', d => journal += d);
  const attendre = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); } throw new Error('délai dépassé · journal : ' + journal.slice(-600)); };
  const textes = () => suite.filter(x => x.meth === 'sendMessage');
  const msg = (id, text) => livrer({ message: { message_id: id, chat: { id: 4545 }, from: { id: 1 }, text } });
  try {
    await attendre(() => /cerveau : boussole 29\.18\.0, golden 6\/6/.test(journal) && /le bureau/.test(journal), 15000);
    await etape('0.5.0 serveur : au démarrage le cerveau est lu (golden 6/6) ; /api/agents et la ligne « العقل » de التحضير le disent', async () => {
      const a = await (await fetch(`http://127.0.0.1:${port}/api/agents`, { headers: { 'x-manita': '1' } })).json();
      const i = await (await fetch(`http://127.0.0.1:${port}/api/installation`, { headers: { 'x-manita': '1' } })).json();
      const l = (i.rapide || []).find(x => x.cle === 'cerveau');
      if (!a.cerveau.ok || !a.agents.some(x => x.id === 'qaid') || !l || l.verdict !== 'PASSE') throw new Error(JSON.stringify({ a: a.cerveau, l }));
      return `${l.detail} · agents : ${a.agents.map(x => x.nom).join(', ')}`;
    });
    await etape('0.5.0 serveur : « وين راني » écrit au robot → le القائد répond (« 🎯 القائد » en tête), loi de forme ; « واش ندير اليوم » pareil', async () => {
      msg(1, 'وين راني');
      const r = await attendre(() => textes().find(x => /وين راهم الوكلاء :/.test(x.text)));
      if (!textes().some(x => /راني نشوف وين راهم الوكلاء/.test(x.text))) throw new Error('le القائد a tourné sans dire ce qu\'il fait');
      if (!r.text.startsWith('🎯 القائد')) throw new Error(r.text);
      msg(2, 'واش ندير اليوم؟');
      const j = await attendre(() => textes().find(x => /واش ندير اليوم :/.test(x.text)));
      const f = [...fautesDeForme(r.text), ...fautesDeForme(j.text)]; if (f.length) throw new Error(f.join(' ; '));
      return `${r.text.split('\n').length} + ${j.text.split('\n').length} lignes dans la loi`;
    });
    await etape('0.5.0 serveur : « حبس الكل » arrête les agents et le dit ; un bouton « b:qaid:hbes » répond « وصلني » ; « شعّل الكل » rallume', async () => {
      msg(3, 'حبس الكل');
      await attendre(() => textes().find(x => /حبست :/.test(x.text)));
      const e1 = await (await fetch(`http://127.0.0.1:${port}/api/agents`, { headers: { 'x-manita': '1' } })).json();
      if (!e1.agents.every(x => x.arrete)) throw new Error('pas arrêtés');
      msg(4, 'شعّل الكل');
      await attendre(() => textes().find(x => /شعّلت :/.test(x.text)));
      livrer({ callback_query: { id: 'cb1', data: 'b:qaid:hbes', message: { message_id: 901, chat: { id: 4545 } }, from: { id: 1 } } });
      await attendre(() => suite.find(x => x.meth === 'answerCallbackQuery' && x.j.callback_query_id === 'cb1'));
      return 'حبس الكل → arrêtés · شعّل الكل → rallumés · bouton b: → وصلني';
    });
    await etape('0.5.0 serveur : « افحص حسابي » garde le chemin de 0.4.2 tant que l\'agent المفتّش n\'est pas construit (l\'accusé de l\'inspecteur part)', async () => {
      msg(5, 'افحص حسابي');
      await attendre(() => textes().find(x => /راني نفحص الحساب تاعك|الموصّل تاع تسيير|ما اخترتش البوتيك/.test(x.text)));
      return 'inspecteur 0.4.2 servi';
    });
  } finally {
    srv.kill('SIGTERM'); await new Promise(r => setTimeout(r, 300)); try { srv.kill('SIGKILL'); } catch {}
    ftg.close(); fs.rmSync(D, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let ok = 0, ko = 0;
  const etape = async (nom, fn) => { try { const d = await fn(); ok++; console.log(`✓ ${nom}${d ? '  — ' + d : ''}`); } catch (e) { ko++; console.log(`✗ ${nom}  — ${e.message}`); } };
  await epreuveAgents({ etape });
  if (!process.argv.includes('--sans-serveur')) await epreuveServeurAgents({ etape });
  console.log(`\n${ko ? '✗' : '✓'} ${ok}/${ok + ko} contrôles des agents passés`);
  process.exit(ko ? 1 : 0);
}
