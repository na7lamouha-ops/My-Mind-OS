// ecom manita — LE DÉPÔT : Meta et Tassyir n'acceptent une photo ou une vidéo que par une ADRESSE PUBLIQUE
// (ils viennent la chercher eux-mêmes). Les fichiers du client sont sur SON PC. Le dépôt les rend joignables
// le temps de l'envoi, puis ferme tout. Rien ne passe jamais par une machine de la maison ecom manita.
//
//  « tunnel » (par défaut, AUCUN compte) : un petit serveur de fichiers SÉPARÉ du bureau (il ne sert que les
//      fichiers donnés, sous un chemin aléatoire de 32 caractères) + un tunnel Cloudflare rapide
//      (cloudflared, sans compte, une adresse https://….trycloudflare.com qui meurt à la fermeture) ;
//  « r2 » : le stockage Cloudflare R2 du CLIENT (son compte, sa clé ; demande une carte ou PayPal chez Cloudflare) :
//      envoi signé SigV4 (sans bibliothèque), type de fichier juste, puis effacement après usage.
// Code original « ecom manita » — 03/10/2026.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TYPES_MEDIA = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/mp4' };
const typeDe = f => TYPES_MEDIA[path.extname(f).toLowerCase()] || 'application/octet-stream';
/** Un nom de fichier sûr pour une adresse : lettres latines, chiffres, tirets (l'arabe et les espaces cassent les signatures). */
export const nomSur = (f, i) => `${String(i + 1).padStart(2, '0')}-${path.basename(f).normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-60) || 'media'}`;

/* ---------- lire une adresse publique SANS le cache DNS du système ----------
   Un nom de tunnel tout neuf n'existe dans le DNS qu'au bout de quelques secondes. Le résolveur du système (la box,
   le fournisseur) garde l'« introuvable » en mémoire : vu sur un vrai Mac le 03/10/2026, 79 s d'« introuvable » alors
   que le tunnel répondait déjà (200 en passant par l'adresse IP donnée par 1.1.1.1 et 8.8.8.8). Pour NOS vérifications,
   on demande l'adresse IP à Cloudflare puis Google (DNS sur HTTPS, puis DNS classique), le système en dernier.
   Meta et Tassyir, eux, résolvent chez eux. */
const resolveur = new dns.promises.Resolver({ timeout: 2500, tries: 2 });
resolveur.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4']);
export async function ipPublique(hote, { recuperer = fetch } = {}) {
  for (const doh of ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve']) {
    try {
      const r = await recuperer(`${doh}?name=${encodeURIComponent(hote)}&type=A`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) });
      const a = ((await r.json()).Answer || []).find(x => x.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(x.data));
      if (a) return a.data;
    } catch {}
  }
  try { const a = await resolveur.resolve4(hote); if (a.length) return a[0]; } catch {}
  return null;
}
/** Comme fetch (GET/HEAD), mais le nom est résolu par ipPublique ; le certificat reste vérifié sur le vrai nom (SNI). */
export function recupererPublic(url, { method = 'GET', signal, headers = {} } = {}) {
  const u = new URL(url); const mod = u.protocol === 'http:' ? http : https;
  return new Promise((ok, ko) => {
    const lookup = (hote, o, cb) => {
      ipPublique(hote).then(ip => {
        if (!ip) return dns.lookup(hote, o, cb);
        if (o && o.all) cb(null, [{ address: ip, family: 4 }]); else cb(null, ip, 4);
      }, () => dns.lookup(hote, o, cb));
    };
    const req = mod.request(u, { method, headers, lookup, signal }, res => {
      const m = []; res.on('data', d => m.push(d)); res.on('error', ko);
      res.on('end', () => {
        const vide = method === 'HEAD' || [204, 304].includes(res.statusCode);
        const entetes = new Headers(); for (const [k, v] of Object.entries(res.headers)) if (typeof v === 'string') entetes.set(k, v);
        ok(new Response(vide ? null : Buffer.concat(m), { status: res.statusCode, headers: entetes }));
      });
    });
    req.on('error', ko); req.end();
  });
}

/* ---------- le petit serveur de fichiers (une liste fermée, un chemin secret, la lecture par morceaux) ---------- */
export function serveurDeFichiers(fichiers) {
  const secret = crypto.randomBytes(16).toString('hex');
  const table = new Map(fichiers.map((f, i) => [`/${secret}/${nomSur(f, i)}`, f]));
  const srv = http.createServer((req, res) => {
    const f = table.get(decodeURIComponent((req.url || '').split('?')[0]));
    if (!f || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end(); }
    let taille; try { taille = fs.statSync(f).size; } catch { res.writeHead(404); return res.end(); }
    const entetes = { 'content-type': typeDe(f), 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m) {
      let debut = m[1] === '' ? Math.max(0, taille - (+m[2] || 0)) : +m[1];
      let fin = m[1] === '' ? taille - 1 : (m[2] === '' ? taille - 1 : Math.min(+m[2], taille - 1));
      if (debut > fin || debut >= taille) { res.writeHead(416, { 'content-range': `bytes */${taille}` }); return res.end(); }
      res.writeHead(206, { ...entetes, 'content-range': `bytes ${debut}-${fin}/${taille}`, 'content-length': fin - debut + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(f, { start: debut, end: fin }).pipe(res);
    }
    res.writeHead(200, { ...entetes, 'content-length': taille });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok, ko) => {
    srv.on('error', ko);
    srv.listen(0, '127.0.0.1', () => ok({ port: srv.address().port, chemins: [...table.keys()], fermer: () => new Promise(r => srv.close(() => r())) }));
  });
}

/* ---------- le tunnel rapide (cloudflared, sans compte) ---------- */
export function lireAdresseTunnel(texte) {
  const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(texte || ''));
  return m ? m[0] : null;
}
async function ouvrirTunnel({ binaire, port, journal, delaiMs = 90000 }) {
  const argsTunnel = ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`];
  // « node:<script> » : un faux cloudflared pour les épreuves (même convention que MANITA_CLAUDE) ; sinon le vrai binaire
  const p = String(binaire).startsWith('node:') ? spawn(process.execPath, [String(binaire).slice(5), ...argsTunnel], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    : spawn(binaire, argsTunnel, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let brut = '';
  const adresse = await new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('le tunnel ne donne pas son adresse (réseau ? pare-feu ?) : ' + brut.trim().split('\n').slice(-2).join(' | ').slice(0, 300))), delaiMs);
    const lire = d => { brut += d; const a = lireAdresseTunnel(brut); if (a) { clearTimeout(t); ok(a); } };
    p.stdout.on('data', lire); p.stderr.on('data', lire);
    p.on('error', e => { clearTimeout(t); ko(new Error(e.code === 'ENOENT' ? 'cloudflared introuvable (installateur ou réglages)' : e.message)); });
    p.on('close', c => { clearTimeout(t); ko(new Error(`cloudflared s'est arrêté (code ${c}) : ` + brut.trim().split('\n').slice(-2).join(' | ').slice(0, 300))); });
  });
  journal(`dépôt : tunnel ouvert ${adresse}`);
  return { adresse, fermer: () => { try { p.kill(); } catch {} } };
}

/** Attend qu'une adresse publique réponde vraiment (un tunnel neuf met quelques secondes à exister dans le DNS). */
async function attendreJoignable(url, octetsAttendus, { essais = 40, pauseMs = 4000, premiere = 0, recuperer = recupererPublic } = {}) {
  if (premiere) await new Promise(r => setTimeout(r, premiere)); // ne pas demander le nom avant qu'il existe : l'« introuvable » resterait en mémoire
  let derniere = '';
  for (let i = 0; i < essais; i++) {
    try {
      const r = await recuperer(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      const n = +(r.headers.get('content-length') || -1);
      if (r.ok && (octetsAttendus === undefined || n === octetsAttendus)) return true;
      derniere = `HTTP ${r.status}, ${n} octets`;
    } catch (e) { derniere = [e.message, e.cause && (e.cause.code || e.cause.message), e.code].filter(Boolean).join(' / '); }
    await new Promise(r => setTimeout(r, pauseMs));
  }
  throw new Error(`l'adresse publique ne répond pas : ${derniere}`);
}

/* ---------- R2 du client : SigV4 écrit à la main (bibliothèque standard), vérifié contre botocore ---------- */
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s, 'utf8').digest();
const sha256hex = b => crypto.createHash('sha256').update(b).digest('hex');
export const encoderS3 = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
/** La signature d'une requête S3 (région « auto » pour R2). Rend les en-têtes à envoyer. */
export function signerS3({ methode, hote, chemin, region = 'auto', cleId, cleSecrete, typeContenu = null, corpsHash, maintenant = new Date() }) {
  const amzDate = maintenant.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const jour = amzDate.slice(0, 8);
  const uri = '/' + chemin.split('/').filter(Boolean).map(encoderS3).join('/');
  const entetes = { host: hote, 'x-amz-content-sha256': corpsHash, 'x-amz-date': amzDate };
  if (typeContenu) entetes['content-type'] = typeContenu;
  const noms = Object.keys(entetes).sort();
  const canonique = [methode, uri, '', noms.map(n => `${n}:${String(entetes[n]).trim()}\n`).join(''), noms.join(';'), corpsHash].join('\n');
  const portee = `${jour}/${region}/s3/aws4_request`;
  const aSigner = ['AWS4-HMAC-SHA256', amzDate, portee, sha256hex(canonique)].join('\n');
  const cle = hmac(hmac(hmac(hmac('AWS4' + cleSecrete, jour), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', cle).update(aSigner, 'utf8').digest('hex');
  return { ...entetes, authorization: `AWS4-HMAC-SHA256 Credential=${cleId}/${portee}, SignedHeaders=${noms.join(';')}, Signature=${signature}`, uri, canonique };
}
function r2({ compte, bucket, cleId, cleSecrete, basePublique }) {
  const hote = `${compte}.r2.cloudflarestorage.com`;
  const requete = async (methode, cle, corps = null, type = null) => {
    const corpsHash = sha256hex(corps || Buffer.alloc(0));
    const h = signerS3({ methode, hote, chemin: `${bucket}/${cle}`, cleId, cleSecrete, typeContenu: type, corpsHash });
    const { uri, canonique, host, ...envoyer } = h;
    const r = await fetch(`https://${hote}${uri}`, { method: methode, headers: envoyer, body: corps || undefined, signal: AbortSignal.timeout(300000) });
    if (!r.ok && !(methode === 'DELETE' && r.status === 404)) { const t = await r.text().catch(() => ''); throw new Error(`R2 ${methode} ${r.status} : ${t.slice(0, 200)}`); }
  };
  return {
    envoyer: (cle, fichier) => requete('PUT', cle, fs.readFileSync(fichier), typeDe(fichier)),
    effacer: cle => requete('DELETE', cle),
    adresse: cle => `${String(basePublique).replace(/\/+$/, '')}/${cle.split('/').map(encoderS3).join('/')}`
  };
}

/**
 * publier(fichiers) → { urls, fermer } : les fichiers sont joignables à ces adresses jusqu'à fermer().
 * reglage = { type: 'tunnel' | 'r2', cloudflared, r2:{compte, bucket, cleId, cleSecrete, basePublique} }
 */
export function creerDepot({ reglage = () => ({ type: 'tunnel' }), journal = () => {}, recuperer = recupererPublic, attente = {} } = {}) {
  return {
    async publier(fichiers, { etiquette = 'lot' } = {}) {
      const r = reglage() || {};
      const liste = fichiers.filter(f => fs.existsSync(f));
      if (liste.length !== fichiers.length) throw new Error(`fichiers absents : ${fichiers.filter(f => !fs.existsSync(f)).map(f => path.basename(f)).join(', ')}`);
      if (r.type === 'r2') {
        const c = r.r2 || {};
        for (const k of ['compte', 'bucket', 'cleId', 'cleSecrete', 'basePublique']) if (!c[k]) throw new Error(`R2 : le réglage « ${k} » manque (الإعدادات)`);
        const s3 = r2(c);
        const prefixe = `ecom-manita/${etiquette}-${crypto.randomBytes(6).toString('hex')}`;
        const cles = liste.map((f, i) => `${prefixe}/${nomSur(f, i)}`);
        // tout ce qui a pu monter s'efface : après l'envoi (fermer) ET si l'envoi ou la lecture publique échoue (un DELETE absent rend 404 : ignoré)
        const effacerTout = async () => { let rate = 0; for (const k of cles) { try { await s3.effacer(k); } catch (e) { rate++; journal('dépôt R2 : effacement raté ' + e.message); } } journal(rate ? `dépôt R2 : ${rate} effacement(s) raté(s)` : 'dépôt R2 : effacé'); };
        try {
          for (let i = 0; i < liste.length; i++) await s3.envoyer(cles[i], liste[i]);
          const urls = cles.map(k => s3.adresse(k));
          for (let i = 0; i < urls.length; i++) await attendreJoignable(urls[i], fs.statSync(liste[i]).size, { recuperer, ...attente });
          journal(`dépôt R2 : ${urls.length} fichier(s) publiés`);
          return { urls, fermer: effacerTout };
        } catch (e) { await effacerTout(); throw e; }
      }
      // par défaut : le tunnel
      const srv = await serveurDeFichiers(liste);
      let tun;
      try { tun = await ouvrirTunnel({ binaire: r.cloudflared || 'cloudflared', port: srv.port, journal }); }
      catch (e) { await srv.fermer(); throw e; }
      const urls = srv.chemins.map(c => tun.adresse + c);
      try { for (let i = 0; i < urls.length; i++) await attendreJoignable(urls[i], fs.statSync(liste[i]).size, { recuperer, premiere: i ? 0 : 10000, ...attente }); }
      catch (e) { tun.fermer(); await srv.fermer(); throw e; }
      return { urls, fermer: async () => { tun.fermer(); await srv.fermer(); journal('dépôt : tunnel fermé'); } };
    }
  };
}

/* ---------- les épreuves : la preuve que le chemin public marche VRAIMENT chez le client ---------- */
const empreinte = b => crypto.createHash('sha256').update(b).digest('hex');
/** Après fermer() : l'adresse ne doit plus rendre le fichier (tunnel fermé → 530 ou plus de nom ; R2 effacé → 404). */
export async function adresseMorte(url, { recuperer = recupererPublic, essais = 8, pauseMs = 3000 } = {}) {
  let dernier = '';
  for (let i = 0; i < essais; i++) {
    try {
      const r = await recuperer(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
      dernier = 'HTTP ' + r.status;
      try { await r.arrayBuffer(); } catch {}
      if (!r.ok) return { morte: true, detail: dernier };
    } catch (e) { return { morte: true, detail: String((e.cause && e.cause.code) || e.message).slice(0, 80) }; }
    await new Promise(x => setTimeout(x, pauseMs));
  }
  return { morte: false, detail: dernier };
}

/** L'épreuve du dépôt : un fichier au hasard part par l'adresse publique, revient IDENTIQUE (empreinte), puis l'adresse meurt. */
export async function epreuve(depot, { dossier, recuperer = recupererPublic, octets = 256 * 1024, essaisMort = 8, pauseMortMs = 3000 } = {}) {
  const debut = Date.now();
  fs.mkdirSync(dossier, { recursive: true });
  const f = path.join(dossier, 'epreuve-depot.mp4'); // des octets au hasard : on compare l'empreinte, pas l'image
  const donnees = crypto.randomBytes(octets); fs.writeFileSync(f, donnees);
  let pub = null;
  try {
    pub = await depot.publier([f], { etiquette: 'epreuve' });
    const url = pub.urls[0];
    const r = await recuperer(url, { signal: AbortSignal.timeout(120000) });
    const recu = Buffer.from(await r.arrayBuffer());
    const pareil = empreinte(recu) === empreinte(donnees);
    if (!r.ok || !pareil) throw new Error(`l'adresse publique rend HTTP ${r.status}, ${recu.length} octets sur ${donnees.length}, empreinte ${pareil ? 'identique' : 'DIFFÉRENTE'}`);
    await pub.fermer(); pub = null;
    const m = await adresseMorte(url, { recuperer, essais: essaisMort, pauseMs: pauseMortMs });
    if (!m.morte) throw new Error(`après la fermeture, l'adresse rend encore le fichier (${m.detail})`);
    return { verdict: 'PASSE', detail: `aller-retour public : ${donnees.length} octets, empreinte identique · fermé : ${m.detail} · ${Math.round((Date.now() - debut) / 1000)} s`, url };
  } catch (e) {
    return { verdict: 'ECHEC', detail: String(e.message).slice(0, 400) };
  } finally { if (pub) { try { await pub.fermer(); } catch {} } try { fs.unlinkSync(f); } catch {} }
}

/** L'essai Meta (installation) : une vidéo d'essai part par le dépôt → Meta la prend (video_id lu dans SA réponse brute)
 *  → « ready » (lu aussi dans la réponse brute) → le dépôt ferme (R2 : effacée) → l'adresse est morte. Aucune publicité. */
/** meta (10/10/2026, l'installation sur le jeton) : { lire(nom, args) } de meta-mcp.mjs cheminJeton — l'essai passe alors par
 *  le serveur local EN DIRECT (aucun tour de Claude) : l'envoi, puis huit lectures au plus jusqu'à « ready » ; les mêmes
 *  contrôles sur les réponses BRUTES. Sans meta : le tour de Claude sur le connecteur, comme avant. */
async function essaiParJeton({ meta, compte, url, nom, lectures = 8, pauseLectureMs = 5000 }) {
  const appelsDe = () => meta.appels.filter(a => /__ads_(creative_upload_media|get_ad_videos)$/.test(a.nom));
  let video_id = '', statut = '', duree = null;
  try {
    const u = await meta.lire('ads_creative_upload_media', { ad_account_id: compte, upload_source: 'URL', media_type: 'VIDEO', media_url: url, name: nom });
    video_id = String(u?.video_id || '');
    for (let i = 0; video_id && i < lectures; i++) {
      const v = await meta.lire('ads_get_ad_videos', { ad_account_id: compte, video_ids: [video_id], fields: ['id', 'status', 'length'] });
      const x = (v?.videos || []).find(y => String(y.id) === video_id) || {};
      statut = String((x.status && typeof x.status === 'object' ? x.status.video_status : x.status) || '').toLowerCase(); duree = x.length ?? null;
      if (statut === 'ready' || statut === 'error') break;
      await new Promise(r => setTimeout(r, pauseLectureMs));
    }
  } catch (e) { return { structure: { video_id, statut: statut || 'error', erreur: String(e.message).slice(0, 300) }, appels: appelsDe(), texte: e.message }; }
  return { structure: { video_id, statut: statut || 'processing', duree }, appels: appelsDe() };
}
export async function essaiMeta({ depot, claude, meta = null, compte, fichier, recuperer = recupererPublic, maintenant = new Date(), essaisMort = 8, pauseMortMs = 3000, pauseLectureMs = 5000 }) {
  const nom = 'ecom-manita-essai-' + maintenant.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  let pub = null, url = '';
  try {
    pub = await depot.publier([fichier], { etiquette: 'essai-meta' }); url = pub.urls[0];
    const r = meta ? await essaiParJeton({ meta, compte, url, nom, pauseLectureMs }) : await claude({
      systeme: "Tu es le MANAGER du bureau « ecom manita ». VÉRIFICATION D'INSTALLATION : tu envoies UNE vidéo d'essai dans la bibliothèque du compte publicitaire du client, par son adresse publique, puis tu attends qu'elle soit prête. Aucune publicité, aucune campagne, aucune autre écriture. Tu rends uniquement le JSON demandé ; un identifiant absent des réponses des connecteurs n'est jamais inventé ; si un outil refuse, « erreur » = sa réponse brute.",
      message: `1. ads_creative_upload_media { ad_account_id: "${compte}", upload_source: "URL", media_type: "VIDEO", media_url: "${url}", name: "${nom}" }\n2. ads_get_ad_videos { ad_account_id: "${compte}", video_ids: [le video_id rendu], fields: ["id", "status", "length"] } : relis jusqu'à « ready » (huit lectures au plus).\nRends {"video_id": "…", "statut": "ready | processing | error", "duree": secondes}.`,
      outils: ['meta.ads_creative_upload_media', 'meta.ads_get_ad_videos'],
      schema: { type: 'object', properties: { video_id: { type: 'string' }, statut: { type: 'string' }, duree: { type: 'number' }, erreur: { type: 'string' } }, required: ['video_id', 'statut'] }
    });
    const s = r.structure || {};
    if (!s.video_id) throw new Error('Meta : ' + String(s.erreur || r.texte || 'aucun video_id rendu').slice(0, 300));
    const brut = (r.appels || []).filter(a => /__ads_(creative_upload_media|get_ad_videos)$/.test(a.nom) && !a.erreur).map(a => String(a.sortie || ''));
    if (!brut.some(x => x.includes(String(s.video_id)))) throw new Error(`video_id ${s.video_id} absent des réponses brutes de Meta (inventé ?)`);
    const pret = String(s.statut || '').toLowerCase() === 'ready' && brut.some(x => x.includes(String(s.video_id)) && /ready/i.test(x));
    await pub.fermer(); pub = null;
    const m = await adresseMorte(url, { recuperer, essais: essaisMort, pauseMs: pauseMortMs });
    return { verdict: pret && m.morte ? 'PASSE' : 'ECHEC', video_id: s.video_id, statut: s.statut, duree: s.duree ?? null, nom, url, morte: m.morte,
      detail: `${pret ? 'vidéo « ready » chez Meta (lu dans sa réponse brute)' : 'vidéo PAS prête chez Meta : ' + s.statut} · adresse ${m.morte ? 'fermée (' + m.detail + ')' : 'ENCORE OUVERTE (' + m.detail + ')'}` };
  } catch (e) {
    return { verdict: 'ECHEC', detail: String(e.message).slice(0, 400), nom, url };
  } finally { if (pub) { try { await pub.fermer(); } catch {} } }
}
