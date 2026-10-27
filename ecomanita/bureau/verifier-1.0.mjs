// ecomanita « الطالب 1.0 » — L'ÉPREUVE DES DIX FIXES (appelée par verifier.mjs, ou seule : node verifier-1.0.mjs).
// Tout se fait avec des données INVENTÉES (les trois commerçants du plan unifié : NEXOR, ZELA, البيت الهادئ — noms d'essai)
// et un FAUX Telegram : aucun compte réel n'est lu ni écrit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));

export async function epreuve10({ etape }) {
  const regles = await import('./regles-masar.mjs');
  const pont = await import('./boussala/pont.mjs');
  const { fautesDeForme } = await import('./telegram.mjs');

  await etape('1.0 : regles-masar.mjs (port ESM de masar.js) rejoue ses 26 contrôles', () => {
    const r = regles.testerRegles();
    if (r.ko.length || r.ok.length !== 26) throw new Error(`${r.ok.length}/26 · ${r.ko.join(' | ')}`);
    return '26/26 قوانين المسار صحاح';
  });
  await etape('1.0 (fix 7) : la boussole 29.18 est DANS le bureau (bureau/boussala) — golden 6/6, un outil répond ; moteur cassé → l\'outil refuse « العقل ما راهوش » (contrôle négatif)', () => {
    const g = pont.etatCerveau({ relire: true });
    if (!g.ok || g.pass !== 6 || g.version !== '29.18.0') throw new Error(JSON.stringify(g));
    const d = pont.outil('boussala_defaults', {});
    if (!/29\.18/.test(d.text)) throw new Error('boussala_defaults : ' + d.text);
    pont._forcerEtat({ ok: false, pass: 5, total: 6, version: '29.18.0', echecs: ['x'] });
    let refus = null; try { pont.outil('boussala_defaults', {}); } catch (e) { refus = e; }
    pont.etatCerveau({ relire: true });
    if (!refus || refus.cerveau !== false || !/العقل ما راهوش/.test(refus.message)) throw new Error('moteur cassé accepté');
    if (fautesDeForme(pont.TEXTE_SANS_CERVEAU).length) throw new Error('message sans cerveau hors loi');
    return `golden ${g.pass}/${g.total} · ${g.version} · ${pont.listeOutils().length} outils · cassé → refus`;
  });
}

/** Les trois commerçants du plan unifié (docs/01), en données INVENTÉES qui reprennent leurs chiffres. */
export function troisCommercants() {
  const base = (id, nom) => ({ get_store: { id, name: nom, facebookPixelId: '1234567890123', metaCapiTokenSet: true, deliveryAgentId: 'nav', deliveryFeeGroupId: 'g1', description: 'x', language: 'ar' },
    list_delivery_agents: [{ status: 'active' }], list_delivery_fees: [{ groupId: 'g1', name: 'Navex', storeId: id, deliveryAgentId: 'nav' }],
    list_custom_statuses: [], list_expenses: [{ amount: 1 }], list_offers: { offers: [{ id: 'o' }], counts: { all: 1 } },
    list_employees: [{ name: 'C1', openOrders: 2 }], commandes: { pending: { data: [] } }, list_returns: [], list_order_tracking: [], list_finance_transactions: [],
    get_marketing_analytics: { totals: { ads: { spend: 0 }, counts: { orders: 0 } }, tree: [] }, get_finance_summary: { adsSpend: { value: 0 } }, get_analytics_overview: { orders: { count: 0 } } });
  const produit = (id, nom, store, extra = {}) => ({ id, name: nom, storeId: store, sku: `S-${id}`, isInventoryTracked: true, gallery: ['u'], tags: [], options: [{ name: 'اللون', values: ['أسود'] }], variants: [{ sku: `S-${id}`, selectedOptions: [{ name: 'اللون', value: 'أسود' }] }], ...extra });
  // NEXOR (ancien) : Tassyir compte 200 DA par retour (18 000 / 90), Navex 50 ; 5 retours à traiter ; la pub à 0 dans la finance ;
  // le confirmateur a 15 commandes ouvertes ; 67 commandes en 30 jours, 88 % avec leur campagne
  const nexor = { ...base('nx', 'NEXOR'), list_products: { data: [{ id: 'pt', name: 'PRO TREK', storeId: 'nx' }] }, produits: [produit('pt', 'PRO TREK', 'nx')],
    get_variant_analytics: { data: [{ product: { name: 'PRO TREK' }, buyPrice: 2500, packagePrice: 40, totalOrders: 67 }] },
    get_finance_summary: { refund: { breakdown: { averageRefundPerOrder: 18000 / 90 } }, adsSpend: { value: 0 } },
    list_finance_transactions: [{ amount: 200, description: 'Order return refund fee for order #12' }, { type: 'IN', description: 'Carrier cashout', amount: 90000 }],
    list_employees: [{ name: 'C1', openOrders: 15 }], get_analytics_overview: { orders: { count: 67 } },
    list_returns: [1, 2, 3, 4, 5].map(i => ({ id: 'r' + i, status: 'to_process' })), list_order_tracking: [{ delivered: true, deliveryStatus: 'delivered' }],
    get_marketing_analytics: { totals: { ads: { spend: 312 }, counts: { orders: 67 } }, tree: [{ level: 'campaign', name: 'TESTING PRO TREK', counts: { orders: 59 } }, { level: 'campaign', name: '(not set)', counts: { orders: 8 } }] } };
  // ZELA (débutant) : un e-mail dans la case du pixel, aucun prix d'achat, les 6 produits tagués TEST avant tout verdict
  const zela = { ...base('ze', 'ZELA'), get_store: { ...base('ze', 'ZELA').get_store, facebookPixelId: 'zela@exemple.dz' },
    list_products: { data: [1, 2, 3, 4, 5, 6].map(i => ({ id: 'z' + i, name: 'Modele ' + i, storeId: 'ze' })) },
    produits: [1, 2, 3, 4, 5, 6].map(i => produit('z' + i, 'Modele ' + i, 'ze', { isInventoryTracked: false, tags: [{ name: 'TEST' }] })), get_variant_analytics: { data: [] } };
  // البيت الهادئ (pas commencé) : zéro produit — l'équipe et le transporteur sont ceux du business (avant : 67/100)
  const hadi = { ...base('bh', 'البيت الهادئ'), list_products: { data: [] }, produits: [], get_variant_analytics: { data: [] } };
  return { nexor, zela, hadi };
}

export async function epreuveInspecteur10({ etape }) {
  const I = await import('./inspecteur.mjs');
  const { fautesDeForme } = await import('./telegram.mjs');
  const R = JSON.parse(fs.readFileSync(path.join(ICI, 'regles.json'), 'utf8'));
  const { nexor, zela, hadi } = troisCommercants();
  const repondu = { reponses: { portefeuilles: true }, taux: 250 };
  const forme = res => { const m = I.messageInspecteur(res); const f = fautesDeForme(m); if (f.length) throw new Error('loi de forme : ' + f.join(' ; ') + '\n' + m); const q = I.questionInspecteur(res); if (q) { const fq = fautesDeForme(q.texte); if (fq.length) throw new Error('question hors loi : ' + fq.join(' ; ') + '\n' + q.texte); } return m; };

  await etape('1.0 (fix 1) : le prix du retour — le chiffre du client contre la moyenne de Tassyir : NEXOR, Navex 50 contre 200 (18 000 / 90) → rouge, les deux chiffres dits ; 200 déclaré → plus de conflit (contrôles négatifs)', () => {
    const a = I.inspecter(nexor, { magasinId: 'nx', regles: R, couts: { retour: 50 }, ...repondu });
    const c = a.constats.find(x => x.id === 'retour_conflit');
    if (!c || c.niveau !== 'stop' || !/Tassyir 200/.test(c.detail) || !/déclaré 50/.test(c.detail) || a.pret) throw new Error(JSON.stringify(c));
    const b = I.inspecter(nexor, { magasinId: 'nx', regles: R, couts: { retour: 200 }, ...repondu });
    if (b.constats.some(x => /^retour_/.test(x.id))) throw new Error('200 = 200 : ' + b.constats.map(x => x.id));
    return c.detail;
  });
  await etape('1.0 (fix 2) : la note PAR MAGASIN — البيت الهادئ (zéro produit) → « ما بداش », SANS note (avant : 67/100), le message le dit ; NEXOR et ZELA ont une note', () => {
    const h = I.inspecter(hadi, { magasinId: 'bh', regles: R, couts: { retour: 50 }, ...repondu });
    if (h.etat !== 'pas_commence' || h.note !== null) throw new Error(JSON.stringify({ etat: h.etat, note: h.note }));
    const m = forme(h); if (!/ما بداش/.test(m) || /Note :/.test(m)) throw new Error(m);
    const n = I.inspecter(nexor, { magasinId: 'nx', regles: R, couts: { retour: 50 }, ...repondu }), z = I.inspecter(zela, { magasinId: 'ze', regles: R, couts: { retour: 50 }, ...repondu });
    if (n.note === null || z.note === null) throw new Error('note absente');
    return `البيت الهادئ : ما بداش (pas de note) · NEXOR ${n.note}/100 · ZELA ${z.note}/100`;
  });
  await etape('1.0 (fix 3) : la note de l\'ACADÉMIE (vert 1, orange 0,5, sur les fiches lues) et les fiches 1.2 — wallets et dollar en QUESTIONS (inconnus, porte fermée), confirmateur, retours à traiter, encaissement, suivi des sources ≥ 80 % après 20 commandes, emballage ; aucune question ne demande une photo (contrôles négatifs)', () => {
    const n = I.inspecter(nexor, { magasinId: 'nx', regles: R, couts: { retour: 50 } });
    const lus = n.checks.filter(c => ['vert', 'orange', 'rouge'].includes(c.etat));
    const attendu = Math.round(lus.reduce((s, c) => s + (c.etat === 'vert' ? 1 : c.etat === 'orange' ? 0.5 : 0), 0) / lus.length * 100);
    if (n.note !== attendu) throw new Error(`note ${n.note} ≠ ${attendu}`);
    if (n.inconnus.join() !== 'portefeuilles,taux' || n.pret) throw new Error('inconnus : ' + n.inconnus);
    if (!n.constats.some(c => c.id === 'retours_a_traiter' && /5/.test(c.detail))) throw new Error('5 retours à traiter');
    if (n.constats.some(c => c.id === 'suivi_source') || n.checks.find(c => c.id === 'suivi_source').etat !== 'vert') throw new Error('88 % suivies = vert');
    const mal = { ...nexor, get_marketing_analytics: { ...nexor.get_marketing_analytics, tree: [{ level: 'campaign', name: 'X', counts: { orders: 40 } }, { level: 'campaign', name: '(not set)', counts: { orders: 27 } }] } };
    if (!I.inspecter(mal, { magasinId: 'nx', regles: R, couts: { retour: 50 } }).constats.some(c => c.id === 'suivi_source')) throw new Error('60 % suivies : rouge attendu');
    const peu = { ...mal, get_marketing_analytics: { totals: { ads: { spend: 9 }, counts: { orders: 12 } }, tree: [] } };
    if (I.inspecter(peu, { magasinId: 'nx', regles: R, couts: { retour: 50 } }).checks.find(c => c.id === 'suivi_source').etat !== 'na') throw new Error('12 commandes : pas encore jugé');
    const sansEnc = { ...nexor, list_finance_transactions: [{ amount: 200, description: 'Order return refund fee for order #12' }] };
    if (!I.inspecter(sansEnc, { magasinId: 'nx', regles: R, couts: { retour: 50 } }).constats.some(c => c.id === 'encaissement')) throw new Error('livré sans encaissement : rouge');
    const sansConf = { ...hadi, list_employees: [] };
    if (!I.inspecter(sansConf, { magasinId: 'bh', regles: R, couts: { retour: 50 } }).constats.some(c => c.id === 'confirmateur' && c.niveau === 'stop')) throw new Error('aucun confirmateur : rouge');
    for (const res of [n, I.inspecter(zela, { magasinId: 'ze', regles: R })]) for (const q of res.questions) if (/(صور|تصويرة|كابتور|capture)/i.test(q.ar + (q.lignes || []).join(' '))) throw new Error('photo demandée : ' + q.ar);
    forme(n);
    const r = I.inspecter(nexor, { magasinId: 'nx', regles: R, couts: { retour: 50 }, ...repondu });
    return `NEXOR ${n.note}/100 (= ${lus.length} fiches lues, compté) · sans réponses : 2 inconnus, porte fermée · répondu : inconnus ${r.inconnus.length} · 5 retours · suivi 88 % vert, 60 % rouge, 12 commandes pas jugé · livré sans encaissement rouge · sans confirmateur rouge · aucune photo demandée`;
  });
  await etape('1.0 (fix 4) : TEST avant le verdict de la boussole = ORANGE — ZELA, 6 produits tagués sans verdict → orange (6 / 6) ; deux jugés → 4 / 6 ; tous jugés → plus rien (contrôles négatifs)', () => {
    const z = I.inspecter(zela, { magasinId: 'ze', regles: R, couts: { retour: 50 }, ...repondu });
    const t = z.constats.find(c => c.id === 'tag_test');
    if (!t || t.niveau !== 'warn' || !/6 \/ 6/.test(t.detail)) throw new Error(JSON.stringify(t));
    const deux = I.inspecter(zela, { magasinId: 'ze', regles: R, couts: { retour: 50 }, ...repondu, verdicts: ['z1', 'Modele 2'] });
    if (!/4 \/ 6/.test(deux.constats.find(c => c.id === 'tag_test').detail)) throw new Error('deux jugés');
    const tous = I.inspecter(zela, { magasinId: 'ze', regles: R, couts: { retour: 50 }, ...repondu, verdicts: ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'] });
    if (tous.constats.some(c => c.id === 'tag_test')) throw new Error('tous jugés : plus d\'orange');
    if (!z.constats.some(c => c.id === 'pixel_invalide') || !z.constats.some(c => c.id === 'prix_achat')) throw new Error('ZELA : pixel et prix d\'achat rouges');
    forme(z);
    return `ZELA ${z.note}/100 · ${t.detail} · 2 jugés → 4 / 6 · tous jugés → rien · pixel et prix d'achat rouges`;
  });
  await etape('1.0 (fix 5) : la pub reliée dans Tassyir — NEXOR (67 commandes, 312 $ lus côté marketing, 0 dans la finance) → orange ; reliée → rien ; un magasin sans commande ni pub → rien (contrôles négatifs)', () => {
    const n = I.inspecter(nexor, { magasinId: 'nx', regles: R, couts: { retour: 50 }, ...repondu });
    const p = n.constats.find(c => c.id === 'pub_hors_finance');
    if (!p || p.niveau !== 'warn' || !/312/.test(p.detail)) throw new Error(JSON.stringify(p));
    const relie = I.inspecter({ ...nexor, get_finance_summary: { ...nexor.get_finance_summary, adsSpend: { value: 78000 } } }, { magasinId: 'nx', regles: R, couts: { retour: 50 }, ...repondu });
    if (relie.constats.some(c => c.id === 'pub_hors_finance')) throw new Error('reliée : rien');
    const neuf = I.inspecter(hadi, { magasinId: 'bh', regles: R, couts: { retour: 50 }, ...repondu });
    if (neuf.constats.some(c => c.id === 'pub_hors_finance')) throw new Error('sans commande : rien');
    return p.detail;
  });
  await etape('1.0 (fix 6) : la première question « عندك طلبيات ؟ » — avant toute lecture (aucun tour de Claude), trois boutons ; « عندي طلبيات من قبل » → la lecture part, NEXOR saigne → le sauvetage d\'abord (trois choses) ; puis UNE question à la fois : le dollar tapé (250) va dans les réglages et recalcule SANS nouveau tour ; un nombre absurde est refusé ; « واه » aux wallets ferme la dernière question (contrôles négatifs)', async () => {
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-insp-10-'));
    const msgs = [], tours = [], reglages = {};
    const tg = { envoyer: async (t, o = {}) => { msgs.push({ t, b: o.boutons || null }); return { envoye: !fautesDeForme(t).length, fautes: fautesDeForme(t) }; } };
    const appels = [];
    for (const [k, v] of Object.entries(nexor)) { if (k === 'produits') v.forEach(p => appels.push({ nom: 'mcp__T__get_product', sortie: JSON.stringify(p) })); else if (k === 'commandes') appels.push({ nom: 'mcp__T__list_orders', entree: { status: 'pending' }, sortie: JSON.stringify(v.pending) }); else appels.push({ nom: 'mcp__T__' + k, sortie: JSON.stringify(v) }); }
    const insp = I.creerInspecteur({ telegram: () => tg, claude: async () => { tours.push(1); return { appels }; }, prefixes: () => ({ tassyir: 'mcp__T__' }), magasin: () => ({ id: 'nx', nom: 'NEXOR' }),
      regles: () => R, couts: () => ({ retour: 200 }), taux: () => reglages.taux || null, ecrireReglage: (k, v) => { reglages[k] = v; }, dossier });
    const r0 = await insp.demander();
    if (r0.raison !== 'parcours' || tours.length || !/عندك طلبيات في تسيير/.test(msgs[0].t) || msgs[0].b[0].length !== 3) throw new Error('première question : ' + JSON.stringify(msgs[0]));
    if (msgs.some(m => fautesDeForme(m.t).length)) throw new Error('hors loi');
    await insp.surBouton('insp:p:2');
    while (insp.occupe()) await new Promise(r => setTimeout(r, 20));
    if (tours.length !== 1 || insp.reponses().parcours !== 'ancien') throw new Error('après « عندي طلبيات » : ' + tours.length);
    const rapport = msgs.find(m => /الفحص الطبي/.test(m.t));
    if (!rapport || !/🚑 الحساب ينزف/.test(rapport.t) || !/اليوم ثلاث حوايج برك/.test(rapport.t) || rapport.t.indexOf('🚑') > rapport.t.indexOf('الواجب')) throw new Error('sauvetage : ' + (rapport && rapport.t));
    const q1 = msgs.at(-1); if (!/الدولار/.test(q1.t) || insp.attendNombre() !== 'taux') throw new Error('question du dollar : ' + q1.t);
    if ((q1.t.match(/؟/g) || []).length !== 1) throw new Error('une seule question par message : ' + q1.t);
    if (!(await insp.surTexte('9')) || reglages.taux) throw new Error('9 n\'est pas un dollar');
    await insp.surTexte('250');
    if (reglages.taux !== 250 || tours.length !== 1) throw new Error(`dollar → réglages (${reglages.taux}), aucun nouveau tour (${tours.length})`);
    const q2 = msgs.at(-1); if (!/المحافظ الأربعة/.test(q2.t) || !q2.b || q2.b[0][0].data !== 'insp:q:portefeuilles:0') throw new Error('question des wallets : ' + q2.t);
    await insp.surBouton('insp:q:portefeuilles:0');
    const fin = insp.dernier();
    if (fin.inconnus.length || fin.questions.length || tours.length !== 1) throw new Error('après les réponses : ' + JSON.stringify(fin.inconnus));
    if (msgs.some(m => fautesDeForme(m.t).length)) throw new Error('hors loi : ' + msgs.filter(m => fautesDeForme(m.t).length).map(m => m.t).join('\n---\n'));
    return `« عندك طلبيات ؟ » sans tour · « ancien » → 1 tour, sauvetage d'abord · dollar 9 refusé, 250 → réglages, recalcul sans tour · wallets « واه » → 0 inconnu · ${msgs.length} messages dans la loi`;
  });
}

/** Le bureau ENTIER (serveur.mjs) avec un faux Telegram : le cerveau lu au démarrage, la ligne « العقل » de التحضير. */
export async function epreuveServeur10({ etape }) {
  const http = await import('node:http');
  const { spawn } = await import('node:child_process');
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-srv-10-'));
  const COPIE = path.join(D, 'bureau'); fs.mkdirSync(COPIE);
  for (const f of fs.readdirSync(ICI)) if (!f.startsWith('_') && f !== 'node_modules' && f !== 'config.local.json') fs.cpSync(path.join(ICI, f), path.join(COPIE, f), { recursive: true });
  fs.writeFileSync(path.join(COPIE, 'config.local.json'), JSON.stringify({ telegram: { token: ['FAUX', 'DIX'].join('-'), chat_id: '4545' }, connecteurs: { tassyir: 'mcp__claude_ai_Boutique__' } }));
  const suite = [], aLivrer = []; let maj = 100;
  const ftg = http.createServer((req, res) => { const m = []; req.on('data', d => m.push(d)); req.on('end', () => {
    const meth = req.url.split('/').pop(); let j = {}; try { j = JSON.parse(Buffer.concat(m).toString('utf8') || '{}'); } catch {}
    const rep = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: o })); };
    if (meth === 'getUpdates') { if (aLivrer.length) return rep(aLivrer.splice(0)); return setTimeout(() => rep([]), 120); }
    if (meth === 'sendMessage') { suite.push({ meth, text: j.text }); return rep({ message_id: 900 + suite.length }); }
    suite.push({ meth, j }); rep(true);
  }); });
  await new Promise(r => ftg.listen(0, '127.0.0.1', r));
  const port = 5500 + Math.floor(Math.random() * 300);
  fs.writeFileSync(path.join(D, 'pas-de-claude.mjs'), 'process.exit(3)\n');
  const env = { ...process.env, PORT: String(port), MANITA_MAISON: path.join(D, 'maison'), MANITA_CLAUDE: 'node:' + path.join(D, 'pas-de-claude.mjs'), MANITA_TELEGRAM_API: `http://127.0.0.1:${ftg.address().port}`, MANITA_ATELIER: path.join(D, 'pas-d-atelier') };
  delete env.CLAUDECODE;
  const srv = spawn(process.execPath, ['serveur.mjs'], { cwd: COPIE, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', d => journal += d); srv.stderr.on('data', d => journal += d);
  const attendre = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); } throw new Error('délai dépassé · journal : ' + journal.slice(-600)); };
  try {
    await attendre(() => /cerveau : boussole 29\.18\.0, golden 6\/6/.test(journal) && /le bureau/.test(journal), 15000);
    await etape('1.0 serveur (fix 7) : au démarrage le cerveau est lu (golden 6/6) ; /api/cerveau et la ligne « العقل » de التحضير le disent', async () => {
      const c = await (await fetch(`http://127.0.0.1:${port}/api/cerveau`, { headers: { 'x-manita': '1' } })).json();
      const i = await (await fetch(`http://127.0.0.1:${port}/api/installation`, { headers: { 'x-manita': '1' } })).json();
      const l = (i.rapide || []).find(x => x.cle === 'cerveau');
      if (!c.ok || !l || l.verdict !== 'PASSE') throw new Error(JSON.stringify({ c, l }));
      return l.detail;
    });
  } finally {
    srv.kill('SIGTERM'); await new Promise(r => setTimeout(r, 300)); try { srv.kill('SIGKILL'); } catch {}
    ftg.close(); fs.rmSync(D, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let ok = 0, ko = 0;
  const etape = async (nom, fn) => { try { const d = await fn(); ok++; console.log(`✓ ${nom}${d ? '  — ' + d : ''}`); } catch (e) { ko++; console.log(`✗ ${nom}  — ${e.message}`); } };
  await epreuve10({ etape });
  await epreuveInspecteur10({ etape });
  if (!process.argv.includes('--sans-serveur')) await epreuveServeur10({ etape });
  console.log(`\n${ko ? '✗' : '✓'} ${ok}/${ok + ko} contrôles 1.0 passés`);
  process.exit(ko ? 1 : 0);
}
