// ecom manita — L'ÉPREUVE DE LA VOIE « تيست » (29/10/2026, règle du vendeur) : appelée par verifier.mjs, jouable seule
// (node verifier-tester.mjs). Quatre créas par modèle (l'originale + des copies où SEULE la musique change), les deux
// boutons ABO / CBO, la CBO à UN seul ad set avec le budget sur la campagne. Les vrais outils (python, ffmpeg) quand ils
// sont là ; jamais Meta, jamais Tassyir, jamais un client.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const CIBLAGE_OK = { type: 'regions', confirme: true, regions: [{ key: '1101', nom: 'Alger', wilaya: 'Alger' }, { key: '1102', nom: 'Oran', wilaya: 'Oran' }] };
const TARGETING_OK = JSON.stringify({ geo_locations: { regions: [{ key: '1101' }, { key: '1102' }] }, publisher_platforms: ['facebook', 'instagram'] });
const appel = (nom, entree, sortie) => ({ nom: `mcp__claude_ai_X__${nom}`, entree, sortie: typeof sortie === 'string' ? sortie : JSON.stringify(sortie) });
const ff = args => spawnSync('ffmpeg', ['-v', 'error', ...args, '-y'], { windowsHide: true });

export async function epreuveTester({ etape }) {
  const accueil = await import('./accueil.mjs');
  const telegram = await import('./telegram.mjs');
  const messages = await import('./messages.mjs');
  const missionsM = await import('./missions.mjs');
  const travauxM = await import('./travaux.mjs');

  await etape('VOIE « تيست » (29/10/2026, accueil) : la question « شوتينغ جديد / تيست » une fois par lien, puis ABO / CBO seulement sur « تيست » (la ligne du budget CBO en dollars ET en dinars), la question des créas JAMAIS sur « تيست » (quatre, figées au résumé), une conversation d\'avant passée plus loin (créas, nom, niche) ne reçoit pas la voie ; lot : voie et structure dans les questions COMMUNES ; textes à la loi de forme (contrôles négatifs)', async () => {
    const Q = accueil.QUESTIONS, voie = Q.find(q => q.cle === 'voie'), st = Q.find(q => q.cle === 'structure'), cr = Q.find(q => q.cle === 'creas');
    if (!voie || !st) throw new Error('questions voie / structure absentes');
    if (JSON.stringify(voie.choix.map(c => c.v)) !== '["shooting","tester"]' || JSON.stringify(st.choix.map(c => c.v)) !== '["ABO","CBO"]') throw new Error('boutons : ' + JSON.stringify([voie.choix, st.choix]));
    const ordre = Q.map(q => q.cle); if (!(ordre.indexOf('placements') < ordre.indexOf('voie') && ordre.indexOf('voie') < ordre.indexOf('structure') && ordre.indexOf('structure') < ordre.indexOf('creas'))) throw new Error('ordre : ' + ordre.join(','));
    if (st.si({ voie: 'shooting' }) || st.si({}) || !st.si({ voie: 'tester' })) throw new Error('structure posée hors de « تيست »');
    if (cr.si({ voie: 'tester' }) || !cr.si({ voie: 'shooting' }) || !cr.si({})) throw new Error('créas : posée sur « تيست » ou retirée de la chaîne d\'avant');
    if (voie.si({ niche: 'hijab', creas: '4' }) || voie.si({ creas: '3' }) || voie.si({ nom: 'Robe' }) || !voie.si({}) || !voie.si({ stock: 'test', placements: 'broad' })) throw new Error('voie : une conversation d\'avant passée plus loin la reçoit');
    if (JSON.stringify(accueil.COMMUNES) !== JSON.stringify(['stock', 'compte', 'page', 'mode', 'pixel', 'placements', 'voie', 'structure', 'creas', 'niche'])) throw new Error('communes : ' + accueil.COMMUNES.join(','));
    const fautes = [voie.texte.join('\n'), [...st.texte, '20 $ = 5 100 DA / modele', ...st.fin].join('\n'), accueil.TEXTES.budgetCourtTester(3, 15300).join('\n')].map(t => telegram.fautesDeForme(t));
    if (fautes.some(f => f.length)) throw new Error('loi de forme : ' + JSON.stringify(fautes));
    if (!telegram.fautesDeForme([...st.texte, '20 $ = 5 100 DA / modele'].join('\n')).length) throw new Error('contrôle négatif : un message qui finit en latin passe');
    if (accueil.CBO_TESTER_USD !== 20 || accueil.CREAS_TESTER !== 4) throw new Error('chiffres du vendeur : ' + accueil.CBO_TESTER_USD + ' / ' + accueil.CREAS_TESTER);
    // une vraie conversation N = 1, du lien au résumé (le chemin des boutons)
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-tester-acc-'));
    const L = { comptes: [{ id: 'act_1', nom: 'Compte', devise: 'USD' }], pages: [{ id: 'p1', nom: 'Page' }], taux: 255, plafondJourDA: 8000 };
    const A = accueil.ouvrirAccueil({ dossier: d, listes: () => L });
    const txt = x => (Array.isArray(x) ? x : (x && x.envoyer) || []).map(e => e.texte).join('\n---\n');
    const id = () => A.conversation().id;
    let sortie = A.commencer('https://drive.google.com/drive/folders/AbCdEfGhIjKlMnOp');
    const presser = (cle, v) => A.surBouton(`acc:${id()}:${cle}:${v}`);
    sortie = presser('n', '1'); sortie = A.surTexte('2300'); sortie = A.surTexte('6900');
    sortie = presser('stock', 'test'); sortie = presser('compte', '0'); sortie = presser('page', '0'); sortie = presser('mode', 'message'); sortie = presser('placements', 'broad');
    if (!/واش من طريقة/.test(txt(sortie))) throw new Error('après les placements, pas la voie : ' + txt(sortie).slice(0, 200));
    sortie = presser('voie', 'tester');
    if (!/الكامباني تاع التيست/.test(txt(sortie)) || !/20 \$ = 5 100 DA \/ modele/.test(txt(sortie))) throw new Error('après « تيست », pas ABO / CBO avec le budget : ' + txt(sortie).slice(0, 300));
    sortie = presser('structure', 'CBO');
    if (/شحال من كريا/.test(txt(sortie))) throw new Error('la question des créas est posée sur « تيست »');
    for (let i = 0; i < 12 && A.conversation() && A.conversation().phase === 'questions'; i++) {
      const t = txt(sortie);
      if (/اكتب الاسم|اسم الموديل/.test(t) && /نكتبو أنا/.test(t) && A.conversation().reponses.choixnom === undefined) sortie = presser('choixnom', 'ecrire');
      else if (/اسم الموديل/.test(t)) sortie = A.surTexte('Robe Lina');
      else if (/التايات/.test(t)) sortie = presser('tailles', 'sans');
      else if (/النيش/.test(t)) sortie = presser('niche', 'hijab');
      else if (/هاذا واش فهمت منك/.test(t)) break;
      else throw new Error('question inattendue : ' + t.slice(0, 200));
    }
    const res = txt(sortie);
    if (!/الطريقة : تيست بالفيديوهات/.test(res) || !/CBO · 1 adset · 4 ads/.test(res) || !/4 creas/.test(res) || telegram.fautesDeForme(res).length) throw new Error('résumé : ' + res + ' ' + JSON.stringify(telegram.fautesDeForme(res)));
    if (A.conversation().reponses.creas !== '4') throw new Error('créas non figées à quatre : ' + A.conversation().reponses.creas);
    sortie = presser('go', '1');
    const dem = sortie && sortie.lot && sortie.lot.demande;
    if (!dem || dem.reponses.voie !== 'tester' || dem.reponses.structure !== 'CBO' || dem.reponses.creas !== '4') throw new Error('la demande ne porte pas la voie : ' + JSON.stringify(dem && dem.reponses));
    // une conversation d'AVANT (relue du disque, née sans la voie) arrêtée après les placements : la question des créas, jamais la voie
    const dv = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-tester-avant-'));
    fs.writeFileSync(path.join(dv, 'conversation.json'), JSON.stringify({ id: 'ab0099', debut: new Date().toISOString(), lien: 'https://drive.google.com/drive/folders/AbCdEfGhIjKlMnOp', phase: 'questions', n: 1, termine: false, reponses: { gros: 2300, detail: 6900, stock: 'test', compte: '0', compteId: 'act_1', page: '0', pageId: 'p1', mode: 'message', placements: 'broad' } }));
    const Av = accueil.ouvrirAccueil({ dossier: dv, listes: () => L });
    const enCours = txt(Av.questionEnCours());
    if (/واش من طريقة/.test(enCours) || !/شحال من كريا/.test(enCours)) throw new Error('conversation d\'avant : ' + enCours.slice(0, 200));
    fs.rmSync(dv, { recursive: true, force: true });
    fs.rmSync(d, { recursive: true, force: true });
    return 'conversation d\'avant : créas, pas de voie · voie → ABO / CBO → (pas de créas) → résumé « 4 creas » + CBO 20 $ = 5 100 DA → la demande porte voie, structure, quatre';
  });

  await etape('VOIE « تيست » (29/10/2026, outils) : QUATRE-CREAS.py --verifier (une vidéo = l\'originale TELLE QUELLE + trois copies de la MÊME image où seule la musique change, six vidéos = les quatre premières, musique de 12 s écartée) ; manita-testing.py --verifier (CBO à un seul ad set : 2000 centimes sur la campagne, aucun plancher ; ABO + un seul ad set toujours refusé ; plafond passe avant)', async () => {
    const py = travauxM.trouverPython('');
    if (!py) return 'python absent : non joué ici';
    if (spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status !== 0) return 'ffmpeg absent : QUATRE-CREAS non joué ici';
    const q = spawnSync(py, ['-I', path.resolve(RACINE, '..', 'outils', '1-EDITEUR', 'QUATRE-CREAS.py'), '--verifier'], { encoding: 'utf8', windowsHide: true, timeout: 300000 });
    if (q.status !== 0 || !/QUATRE-CREAS : TOUT PASSE/.test(q.stdout)) throw new Error('QUATRE-CREAS : ' + (q.stdout + q.stderr).slice(-600));
    const t = spawnSync(py, ['-I', path.resolve(RACINE, '..', 'outils', '3-TESTING', 'manita-testing.py'), '--verifier'], { encoding: 'utf8', windowsHide: true, timeout: 300000, cwd: path.resolve(RACINE, '..', 'outils', '3-TESTING') });
    if (!/\[OK  \] CBO un seul ad set : 2000 centimes/.test(t.stdout) || !/\[OK  \] ABO \+ un seul ad set avec --structure : toujours refuse/.test(t.stdout) || !/\[OK  \] CBO un seul ad set : 20 USD sur un plafond de 15 USD = refus/.test(t.stdout)) throw new Error('manita-testing : ' + t.stdout.slice(-600));
    return `${(q.stdout.match(/\[OK\]/g) || []).length} contrôles QUATRE-CREAS · 3 contrôles CBO un seul ad set`;
  });

  await etape('VOIE « تيست » (29/10/2026, chaîne) : une mission « تيست » d\'UNE vidéo → montage par QUATRE-CREAS (jamais MONTER-10) → contrôle : quatre vidéos saines → budget CBO : l\'outil rend UN ad set, 2000 centimes sur la campagne ; ABO : quatre ad sets à 500 ; budget du jour trop court : rien, le client lit le besoin en dinars ET en dollars ; une mission « شوتينغ » garde MONTER-10 (contrôles négatifs)', async () => {
    const py = travauxM.trouverPython('');
    if (!py || spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status !== 0) return 'python ou ffmpeg absent : non joué ici';
    const maison = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-tester-'));
    const rushes = path.join(maison, 'drive', 'modele'), mus = path.join(maison, 'musiques');
    fs.mkdirSync(rushes, { recursive: true }); fs.mkdirSync(mus);
    ff(['-f', 'lavfi', '-i', 'color=c=red:s=180x320:d=12:r=25', '-f', 'lavfi', '-i', 'sine=f=330:d=12', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(rushes, 'post.mp4')]);
    for (const [n, f] of [['a', 440], ['b', 550], ['c', 660]]) ff(['-f', 'lavfi', '-i', `sine=f=${f}:d=20`, path.join(mus, n + '.wav')]);
    let reglages = { taux: 255, plafondJourDA: 8000, musiques: mus, ciblage: CIBLAGE_OK };
    const textes = [], lances = [];
    const T = travauxM.creerTravaux({ python: () => py, env: () => travauxM.envOutil({}) });
    const travaux = { lancer: async spec => { lances.push(spec); return T.lancer(spec); } };
    const tg = { envoyer: async t => { textes.push(t); return { envoye: true }; }, envoyerPhoto: async () => ({ envoye: true }), envoyerAlbum: async () => ({ envoye: true }), envoyerVideo: async () => ({ envoye: true }) };
    const Ms = missionsM.ouvrirMissions({ maison, atelier: path.resolve(RACINE, '..', 'outils'), travaux, telegram: () => tg, depot: {}, reglages: () => reglages, claude: async () => { throw new Error('pas de Claude ici'); } });
    const m = { id: 'tst001', code: 'LINA', etat: 'encours', d: { rushes, couleurs: [{ rang: 1, nom: 'Noir', captures: [], exclue: false }] },
      demande: { reponses: { voie: 'tester', structure: 'CBO', creas: '4', nom: 'Robe Lina', mode: 'message', niche: 'hijab', compte: { id: 'act_111', devise: 'USD' } } }, etapes: {}, historique: [] };
    fs.mkdirSync(Ms._dossier(m), { recursive: true });
    await Ms._etapes.montage(m);
    const monte = lances.filter(s => /QUATRE-CREAS|MONTER-10|manita\.py/.test(String(s.script || s.chemin || s.nom || '') + JSON.stringify(s.args || [])));
    if (!monte.length || !monte.every(s => /QUATRE-CREAS/.test(JSON.stringify(s)))) throw new Error('le montage « تيست » n\'appelle pas QUATRE-CREAS : ' + JSON.stringify(lances.map(s => s.nom)));
    const rap = JSON.parse(fs.readFileSync(path.join(Ms._dossier(m), 'creas', '_rapport.json'), 'utf8'));
    if (JSON.stringify(rap.map(x => x.sorte)) !== JSON.stringify(['originale', 'copie_musique', 'copie_musique', 'copie_musique'])) throw new Error('rapport : ' + JSON.stringify(rap));
    await Ms._etapes.controle(m);
    if (m.d.creas.length !== 4) throw new Error('contrôle : ' + m.d.creas.length + ' saines — ' + JSON.stringify(m.d.creasRefusees));
    await Ms._etapes.budget(m);
    const b = m.d.budget;
    if (!(b.structure === 'CBO' && b.un_seul_ad_set === true && b.ad_sets === 1 && b.annonces === 4 && b.centimes_campagne === 2000 && b.centimes_min_par_ad_set === null) || m.d.videosTest.length !== 4) throw new Error('budget CBO : ' + JSON.stringify(b));
    m.demande.reponses.structure = 'ABO'; await Ms._etapes.budget(m);
    if (!(m.d.budget.structure === 'ABO' && m.d.budget.ad_sets === 4 && m.d.budget.centimes_par_ad_set === 500 && !m.d.budget.un_seul_ad_set)) throw new Error('budget ABO : ' + JSON.stringify(m.d.budget));
    reglages = { ...reglages, plafondJourDA: 4000 }; m.demande.reponses.structure = 'CBO'; const avant = m.d.budget;
    let e = null; try { await Ms._etapes.budget(m); } catch (x) { e = x; }
    if (!e || !e.definitif || !/20 \$ par jour demandés/.test(e.message) || m.d.budget !== avant) throw new Error('budget court accepté : ' + (e ? e.message : JSON.stringify(m.d.budget)));
    const dit = textes[textes.length - 1] || '';
    if (!/5 100 DA = 20 \$/.test(dit) || telegram.fautesDeForme(dit).length) throw new Error('le client ne lit pas le besoin : ' + dit);
    // la chaîne d'avant : une mission sans voie garde MONTER-10 (le faux outil ne monte rien ; on lit seulement qui est appelé)
    const lances2 = [];
    const Ms2 = missionsM.ouvrirMissions({ maison, atelier: path.resolve(RACINE, '..', 'outils'), travaux: { lancer: async s => { lances2.push(s); return { code: 1, sortie: 'faux', json: [], dureeMs: 1, raison: '' }; } }, telegram: () => null, depot: {}, reglages: () => reglages, claude: async () => { throw new Error('pas de Claude ici'); } });
    const m2 = { ...m, id: 'tst002', d: { rushes, couleurs: [{ rang: 1, nom: 'Noir', captures: [], exclue: false }] }, demande: { reponses: { nom: 'Robe Lina', mode: 'message', niche: 'hijab' } } };
    fs.mkdirSync(Ms2._dossier(m2), { recursive: true });
    try { await Ms2._etapes.montage(m2); } catch {}
    if (lances2.some(s => /QUATRE-CREAS/.test(JSON.stringify(s))) || !lances2.length) throw new Error('la chaîne d\'avant appelle QUATRE-CREAS : ' + JSON.stringify(lances2.map(s => s.nom)));
    fs.rmSync(maison, { recursive: true, force: true });
    return 'QUATRE-CREAS → 4 saines → CBO 1 ad set 2000 · ABO 4 × 500 · 4 000 DA refusé (5 100 DA = 20 $ dit) · chaîne d\'avant sans QUATRE-CREAS';
  });

  await etape('VOIE « تيست » (29/10/2026, campagne CBO à UN ad set) : le message dit UN SEUL ad set, AUCUN daily_min_spend_target, le budget du jour sur la campagne, chaque annonce nommée V01… ; deux ad sets, un plancher posé, un budget sur l\'ad set ou un autre budget de campagne : refusés (contrôles négatifs)', async () => {
    const maison = fs.mkdtempSync(path.join(os.tmpdir(), 'manita-tester-camp-'));
    let rendre = null; const vus = [];
    const Ms = missionsM.ouvrirMissions({ maison, atelier: path.join(maison, 'pas-d-atelier'), travaux: { lancer: async () => ({ code: 1, sortie: '', json: [] }) }, telegram: () => null, depot: {}, reglages: () => ({ ciblage: CIBLAGE_OK }), claude: async a => { vus.push(a); return rendre(a); } });
    const m = { id: 'tst010', code: 'LINA', etat: 'encours', etapes: {}, historique: [],
      demande: { reponses: { voie: 'tester', structure: 'CBO', mode: 'site', compte: { id: 'act_111', devise: 'USD' }, page: { id: '222', nom: 'P' }, placements: 'broad' } },
      d: { noms: { cle: 'K3Y123456789', campagne: 'SHOP | LINA | test', ad_sets: ['V01 K', 'V02 K', 'V03 K', 'V04 K'], liens: ['l1', 'l1', 'l1', 'l1', 'l1'] },
        budget: { devise: 'USD', structure: 'CBO', un_seul_ad_set: true, ad_sets: 1, annonces: 4, centimes_par_ad_set: null, centimes_campagne: 2000, centimes_min_par_ad_set: null, total_usd: 20 },
        metaVideos: [1, 2, 3, 4].map(i => ({ index: i - 1, video_id: 'v' + i })), metaVignettes: [1, 2, 3, 4].map(i => ({ index: i - 1, image_hash: 'h' + i })),
        textes: { angles: Array.from({ length: 5 }, (_, i) => ({ code: `A${i + 1}`, primary: 'p', titre: 't', description: 'd' })) }, produit: { urlProduit: 'https://b.tassyir.io/product/x' } } };
    const LIEN = 'https://b.tassyir.io/product/x?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';
    const ads = ['A1', 'A2', 'A3', 'A4'];
    const juste = (plus = {}) => ({ campaign_id: 'C1', ad_sets: [{ id: 'S-u' }], ads: ads.map(id => ({ id, ad_set_id: 'S-u' })), ...plus });
    const creation = (set = {}, camp = {}) => [appel('ads_create_campaign', { ad_account_id: '111', campaign_name: 'x', objective: 'OUTCOME_SALES', buying_type: 'AUCTION', campaign_daily_budget: 2000, campaign_bid_strategy: 'LOWEST_COST_WITHOUT_CAP', ...camp }, { id: 'C1' }),
      appel('ads_create_ad_set', { ad_account_id: '111', campaign_id: 'C1', ad_set_name: 'V01 K', billing_event: 'IMPRESSIONS', targeting: TARGETING_OK, ...set }, { id: 'S-u' }),
      appel('ads_create_creative', { ad_account_id: '111', page_id: 'p', video_id: 'v1', link_url: LIEN }, { id: 'cr1' }),
      ...ads.map((id, i) => appel('ads_create_ad', { ad_account_id: '111', ad_set_id: 'S-u', ad_name: `V0${i + 1} K`, creative: '{"creative_id":"cr1"}' }, { id }))];
    rendre = () => ({ structure: juste(), appels: creation() });
    await Ms._etapes.campagne(m);
    const msg = vus[vus.length - 1].message;
    if (!/4\. UN SEUL ad set/.test(msg) || !/AUCUN daily_min_spend_target \(un seul ad set\)/.test(msg) || !/campaign_daily_budget 2000/.test(msg) || !/son « nomAnnonce »/.test(msg) || !/"nomAnnonce": "V04 K"/.test(msg) || m.d.campagne.id !== 'C1') throw new Error('message : ' + msg.slice(0, 900));
    const refuse = async (nom, rep, motif) => { rendre = () => rep; let e = null; try { await Ms._etapes.campagne(m); } catch (x) { e = x; } if (!e || !motif.test(e.message)) throw new Error(`${nom} : ${e ? e.message : 'accepté'}`); };
    await refuse('un plancher posé sur l\'ad set unique', { structure: juste(), appels: creation({ daily_min_spend_target: 300 }) }, /aucun plancher/);
    await refuse('un budget sur l\'ad set', { structure: juste(), appels: creation({ daily_budget: 2000 }) }, /daily_budget sous une campagne CBO/);
    await refuse('un autre budget de campagne', { structure: juste(), appels: creation(undefined, { campaign_daily_budget: 1500 }) }, /campaign_daily_budget 1500 au lieu de 2000/);
    await refuse('deux ad sets', { structure: juste({ ad_sets: [{ id: 'S-u' }, { id: 'S-v' }] }), appels: creation() }, /2 ad set\(s\) au lieu de 1/);
    // la bibliothèque : le V0k vient du nom de l'ANNONCE quand il n'y a qu'un ad set
    m.d.campagne = { ...m.d.campagne, adSets: [{ id: 'S-u', nom: 'V01 K' }], ads: ads.map(id => ({ id, ad_set_id: 'S-u' })) };
    m.d.videosTest = [1, 2, 3, 4].map(i => ({ fichier: `/x/variante_0${i}.mp4`, rapport: {} })); m.d.be = { par_confirmee: 1000, par_livree: 2000 };
    const su = { suivi: { annonces: ads.map((id, i) => ({ id, nom: `V0${i + 1} K`, depense: 2 + i, commandes_tassyir: 1 })) }, devise: 'USD' };
    const brut = { appels: [{ nom: 'mcp__x__ads_get_ad_entities', sortie: JSON.stringify(ads.map((id, i) => ({ id, spend: 2 + i }))) }] };
    const lignes = missionsM.lignesBibliotheque(m, su, brut, 255, 3, 'TEST', '2026-10-29');
    const vk = lignes.map(l => JSON.stringify(l).match(/"V0(\d)"/)?.[1]).join('');
    if (vk !== '1234') throw new Error('bibliothèque : les quatre annonces ne vont pas à leurs quatre vidéos (' + vk + ') ' + JSON.stringify(lignes).slice(0, 300));
    fs.rmSync(maison, { recursive: true, force: true });
    return 'message UN SEUL ad set + aucun plancher + V01…V04 · 4 refus · bibliothèque V01→V04';
  });
}

export async function epreuveCatalogue({ etape }) {
  await etape('CATALOGUE → TRELLO → DRIVE (29/10/2026, kit testé sur un vrai tableau) : les deux fichiers à donner au client sont dans le paquet, OCTET POUR OCTET (sha256 du kit) ; config.json en valeurs d\'exemple ; le message à coller porte l\'ÉTAPE 8 bis (trois gestes du client, « Moi uniquement », aucune clé ni jeton, le lien Drive collé par le client, la vidéo d\'un autre jamais en pub sans son accord) AVANT « Tout vérifier » (contrôles négatifs)', async () => {
    const crypto = await import('node:crypto');
    const D = path.resolve(RACINE, '..', 'catalogue-trello-drive');
    const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(D, f))).digest('hex');
    const attendu = { 'extension-catalogue-trello.zip': '76113ecc1437627205947e53469be1a1fe982ed193744b9feb7baed76b0c953d', 'apps-script-ecomanita-drive.gs': '933b7d8753ab10e27d6516f85338266c4c98e5713bdfd3d0d843d739443032e6' };
    for (const [f, h] of Object.entries(attendu)) { if (!fs.existsSync(path.join(D, f))) throw new Error(f + ' absent du paquet'); if (sha(f) !== h) throw new Error(f + ' : empreinte ' + sha(f) + ' au lieu de la version testée'); }
    const gs = fs.readFileSync(path.join(D, 'apps-script-ecomanita-drive.gs'), 'utf8');
    if (!/service: 'ecomanita-drive'/.test(gs) || /script\.google\.com\/macros\/s\//.test(gs)) throw new Error('script Google : réponse attendue absente, ou une URL de déploiement dedans');
    const msg = fs.readFileSync(path.resolve(RACINE, '..', 'MESSAGE-A-COLLER-DANS-CLAUDE.txt'), 'utf8');
    const i8 = msg.indexOf('ÉTAPE 8 bis — Mon catalogue Trello → Drive'), i9 = msg.indexOf('ÉTAPE 9 — Tout vérifier');
    if (i8 < 0 || i9 < 0 || i8 > i9) throw new Error('ÉTAPE 8 bis absente ou après « Tout vérifier »');
    const e = msg.slice(i8, i9), manque = ['« Moi uniquement »', 'JAMAIS « Tout le monde »', 'AUCUNE clé ni AUCUN jeton', 'Mon geste n° 1', 'Mon geste n° 2', 'Charger l\'extension non empaquetée', '{"ok":true,"service":"ecomanita-drive"}', 'Ne touche pas au bureau', 'c\'est MOI qui le colle', 'sans l\'accord de son propriétaire', '« 🧪 À tester → Drive »', '/1/members/me'].filter(x => !e.includes(x));
    if (manque.length) throw new Error('ÉTAPE 8 bis : il manque ' + manque.join(' · '));
    if (/Tout le monde\s*»\s*\(conseillé|choisis « Tout le monde/.test(e)) throw new Error('contrôle négatif : « Tout le monde » conseillé');
    return 'zip + .gs = kit testé (sha256) · ÉTAPE 8 bis avant ÉTAPE 9, ' + 12 + ' points relus';
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = [];
  const etape = async (nom, fn) => { try { const d = await fn(); res.push(true); console.log(`✓ ${nom}${d ? '  — ' + d : ''}`); } catch (e) { res.push(false); console.log(`✗ ${nom}  — ${e.message}`); } };
  await epreuveTester({ etape });
  await epreuveCatalogue({ etape });
  const n = res.filter(Boolean).length;
  console.log(`\n${n === res.length ? '✓' : '✗'} ${n}/${res.length} contrôles de la voie « تيست »`);
  process.exit(n === res.length ? 0 : 1);
}
