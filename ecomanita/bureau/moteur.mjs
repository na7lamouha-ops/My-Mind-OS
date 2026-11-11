// ecom manita — LE MOTEUR : un tour de Claude Code en mode headless, sur l'abonnement du client.
// Aucune clé API. Un seul processus `claude -p` par tour, un dossier de travail vide, un temps maximum dur,
// et la lecture du flux JSON : le texte, la sortie structurée, les outils RÉELLEMENT appelés et ce qu'ils ont rendu.
//
// v0.3 (03/10/2026) — sûr pour Windows :
//  - le prompt système part dans un FICHIER (--system-prompt-file) et le message par l'entrée standard :
//    Windows refuse une ligne de commande de plus de 32 767 caractères, et une skill en fait 60 000 ;
//  - AUCUN outil intégré (--tools ToolSearch : pas de shell, pas de fichiers, pas de web) ; seuls les
//    connecteurs listés passent (--allowedTools), et tout ce qui demanderait une permission est refusé
//    (--permission-prompts none) ;
//  - les connecteurs du compte claude.ai du client s'appellent « claude.ai <Nom> » dans Claude Code :
//    sonderConnecteurs() les trouve par leurs OUTILS (Tassyir = list_orders + create_product,
//    Meta = ads_get_ad_entities + ads_create_campaign), pas par leur nom, que le client choisit.
// Code original « ecom manita » — aucun code tiers.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const OUTILS_INTERDITS = ['Bash', 'PowerShell', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'Agent', 'Task', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Skill', 'TodoWrite'];
export const OUTILS_INTEGRES = 'ToolSearch'; // le seul outil intégré gardé : il ouvre les connecteurs mis de côté
export const MODELES = ['sonnet', 'opus', 'fable', 'haiku'];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// les outils qu'AUCUNE étape ne reçoit jamais, quel que soit le réglage (vrais colis, suppressions, argent)
export const JAMAIS = ['dispatch_orders', 'cancel_order', 'deliver_order', 'return_order', 'confirm_order', 'assign_orders', 'schedule_order',
  'create_finance_transaction', 'create_expense', 'delete_shared_block', 'discard_store_builder_draft', 'publish_store_builder', 'publish_design',
  'add_custom_domain', 'toggle_domain', 'apply_theme_package', 'update_store_settings', 'create_delivery_agent',
  'ads_creative_delete', 'ads_delete_custom_audience', 'ads_delete_local_ad_image', 'ads_catalog_delete_product', 'ads_catalog_product_feed_delete',
  'ads_catalog_product_set_delete', 'ads_catalog_product_feed_delete_rule', 'ads_catalog_event_source_disconnect', 'ads_boost_ig_post'];

const DOSSIER_TOURS = path.join(os.tmpdir(), 'ecom-manita-tour'); // aucun CLAUDE.md, aucun dépôt : l'agent ne voit que son prompt

/** Le binaire claude : MANITA_CLAUDE, puis l'installation officielle (~/.local/bin), puis le PATH. */
export function trouverClaude(env = process.env, plateforme = process.platform) {
  if (env.MANITA_CLAUDE) return env.MANITA_CLAUDE;
  const maison = env.USERPROFILE || env.HOME || os.homedir();
  const candidats = plateforme === 'win32'
    ? [path.join(maison, '.local', 'bin', 'claude.exe')]
    : [path.join(maison, '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  for (const c of candidats) { try { if (fs.statSync(c).isFile()) return c; } catch {} }
  return plateforme === 'win32' ? 'claude.exe' : 'claude';
}

/**
 * L'environnement d'un enfant : sans les variables d'une session Claude Code qui l'aurait lancé, et avec
 * l'ATTENTE des connecteurs. Constaté sur un vrai Mac (03/10/2026) : sans attente, l'événement init part
 * avant que les connecteurs claude.ai du client soient branchés (« pending », aucun outil, ou même aucun
 * serveur), et avec la recherche d'outils le premier tour ne les attend pas non plus.
 *   MCP_CONNECTION_NONBLOCKING=0 + MCP_CONNECT_TIMEOUT_MS : l'init attend la connexion (30 s au plus) ;
 *   CLAUDE_CODE_MCP_STARTUP_WAIT_MS : le premier tour attend chaque serveur encore en route (Claude Code 2.1.274+).
 * Ces trois valeurs sont IMPOSÉES : un bureau lancé depuis une session Claude Code hérite sinon de
 * MCP_CONNECTION_NONBLOCKING=true (vu dans l'environnement d'une session) et le défaut revient.
 */
export const ATTENTE_CONNECTEURS = { MCP_CONNECTION_NONBLOCKING: '0', MCP_CONNECT_TIMEOUT_MS: '30000', CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '30000' };
export function envEnfant(base = process.env, plus = {}) {
  const env = { ...base, ...plus, ...ATTENTE_CONNECTEURS };
  for (const k of Object.keys(env)) if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_SESSION') || k === 'CLAUDE_CODE_ENTRYPOINT') delete env[k];
  return env;
}

/** Construit la ligne de commande — exportée pour être vérifiée sans lancer Claude. Le message ne passe PAS ici (entrée standard). */
// mcpConfig (09/10/2026, le serveur Meta LOCAL) : un fichier SANS secret qui déclare meta_manita (bureau/meta-mcp.mjs) ; le
// tour garde aussi les connecteurs claude.ai du client (Tassyir), et la liste blanche ne donne que les outils du chemin choisi.
export function argumentsDuTour({ fichierSysteme, outilsAutorises = [], modele = 'sonnet', effort = '', schema = null, sessionId = null, images = null, mcpConfig = null }) {
  const m = MODELES.includes(modele) ? modele : 'sonnet';
  const args = ['-p', ...(images && images.length ? ['--input-format', 'stream-json'] : []), '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--session-id', sessionId || crypto.randomUUID(),
    '--system-prompt-file', fichierSysteme,
    '--tools', OUTILS_INTEGRES,
    '--disallowedTools', OUTILS_INTERDITS.join(','),
    '--permission-prompts', 'none',
    '--no-chrome', '--model', m];
  const autorises = [...new Set(outilsAutorises.filter(o => o && !JAMAIS.some(j => o.endsWith('__' + j))))];
  if (autorises.length) args.push('--allowedTools', autorises.join(','));
  if (effort && EFFORTS.includes(effort)) args.push('--effort', effort);
  if (schema) args.push('--json-schema', JSON.stringify(schema));
  if (mcpConfig) args.push('--mcp-config', mcpConfig);
  return args;
}

/* ---------- la LIMITE D'USAGE du compte Claude (v0.3.8, 09/10/2026) ----------
 * Six tours par modèle, plusieurs centaines de milliers de jetons : la fenêtre de cinq heures d'un compte Pro tombe au
 * 2e ou 3e modèle. Le CLI le dit dans un message d'ERREUR DE L'API (CLI 2.1.283 : un message assistant marqué
 * error "rate_limit" et model "<synthetic>", « Claude AI usage limit reached|<epoch> » ou « You've hit your limit ·
 * resets 3pm »), puis un résultat en erreur. On ne lit la limite QUE là (le message d'erreur de l'API, le résultat en
 * erreur, errors[], stderr quand il n'y a pas de résultat) : jamais dans la prose de l'agent, qui peut citer la limite
 * d'appels de Meta (« (#17) User request limit reached ») sans que Claude soit à court. « limit reached » seul ne compte
 * pas (« Context limit reached », « Budget limit reached »). */
export const MOTIF_QUOTA = /usage limit|rate[ _-]?limit(?:ed)?\b|5-hour limit|five-hour limit|weekly limit|hit your (?:\w+ )?limit|\b429\b/i;
const ERREUR_META = /\(#\d+\)|OAuthException|graph\.facebook/i; // la limite d'appels de META n'est pas celle de Claude
/** L'heure de reprise écrite dans le texte de la limite (ms depuis 1970) ou null : un epoch après « | » (secondes ou ms),
 *  une date ISO, « resets 3pm » / « resets 1am » / « resets 3:30pm » / « resets at 15:00 » (heure LOCALE, la prochaine),
 *  « in 45 minutes » / « in 2 hours ». */
export function heureDeReprise(texte, maintenant = Date.now()) {
  const t = String(texte || '');
  let x = /\|\s*(\d{10,13})\b/.exec(t);
  if (x) { const n = +x[1]; return n < 1e12 ? n * 1000 : n; }
  x = /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)/.exec(t);
  if (x && Number.isFinite(Date.parse(x[1]))) return Date.parse(x[1]);
  x = /\bin\s+(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|h)\b/i.exec(t);
  if (x) return maintenant + +x[1] * (/^h/i.test(x[2]) ? 3600000 : 60000);
  x = /\bresets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(t);
  if (x) {
    let h = +x[1]; const mn = +(x[2] || 0), ap = (x[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || mn > 59) return null;
    const d = new Date(maintenant); d.setHours(h, mn, 0, 0);
    if (d.getTime() <= maintenant) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}
/** Une limite d'usage de CLAUDE dans ce texte (venu d'une erreur, jamais de la prose) : { reprise: ms|null, texte } ou null. */
export function lireQuota(texte, maintenant = Date.now()) {
  const t = String(texte || '');
  if (!MOTIF_QUOTA.test(t) || ERREUR_META.test(t)) return null;
  return { reprise: heureDeReprise(t, maintenant), texte: t.trim().slice(0, 300) };
}
/* ---------- la RÉPONSE TROP GROSSE d'un outil (10/10/2026, [sortie-persistee]) ----------
 * Constaté sur la chaîne du vendeur : un get_product Tassyir à des dizaines de variantes ne revient PAS dans le tool_result du
 * flux ; Claude Code l'écrit dans un fichier et met un POINTEUR à la place. Formats lus dans le CLI 2.1.295 (strings du binaire) :
 *  (1) « <persisted-output>\nOutput too large (37.1KB). Full output saved to: <chemin>\nPreview (first 2KB):\n…</persisted-output> »
 *  (2) « <persisted-output>\nOutput exceeded the <N> persist limit; only the first <N> were saved to: <chemin> … » (fichier TRONQUÉ)
 *  (3) MCP : « Error: result (<n> characters[ across <m> lines]) exceeds maximum allowed tokens. Output has been saved to <chemin>.
 *      \nFormat: … » (+ « Note: the output exceeded the persist byte limit; the saved file contains only the first … » = TRONQUÉ)
 *  (4) MCP : « Error: result (<n> characters) exceeds maximum allowed tokens. Failed to save output to file: <raison>. … » (rien)
 *  (5) « <truncated-output>\nOutput too large (<n>). It could not be saved, so only the first <n> are shown; … » (rien)
 * Le fichier (<config>/projects/<projet>/<session>/tool-results/<id>.txt|.json) n'est lu QUE si son chemin RÉEL (realpath, liens
 * suivis) est un fichier ordinaire, sous le CLAUDE_CONFIG_DIR du tour (~/.claude sinon), dans un dossier « tool-results », et sous
 * la borne de taille. Un .json qui est un tableau de blocs texte (le contenu MCP) est recollé comme un tool_result en ligne.
 * Sinon : la sortie devient une phrase SANS JSON (jamais l'aperçu coupé, dont un morceau d'objet pourrait se lire) et
 * a.persistee.erreur dit pourquoi — l'étape qui relit voit « non relue » et le dit. */
export const BORNE_SORTIE_PERSISTEE = 20 * 1024 * 1024; // 20 Mo : au-delà, refusé et dit
export const COUPE_SORTIE = 200000; // la sortie EN LIGNE reste coupée ici (le CLI n'en rend pas plus de ~50 000 jetons en ligne)
export function dossierConfigClaude(env = process.env) {
  return env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(env.HOME || env.USERPROFILE || os.homedir(), '.claude');
}
/** Un texte de tool_result → null (pas un pointeur), sinon { sortie, persistee: { chemin, octets } | { chemin?, erreur } }. */
export function lireSortiePersistee(texte, { dossierConfig = dossierConfigClaude(), borne = BORNE_SORTIE_PERSISTEE } = {}) {
  const t = String(texte ?? ''), tete = t.slice(0, 600);
  const refus = (erreur, chemin = null) => ({ sortie: `[ecom manita] ${erreur}${chemin ? ` (${chemin})` : ''} — réponse de l'outil NON relue`, persistee: { ...(chemin ? { chemin } : {}), erreur } });
  let chemin = null, tronque = false, x;
  const iP = tete.indexOf('<persisted-output>');
  if (iP >= 0 && iP < 200) {
    if ((x = /Output too large \([^)\n]*\)\. Full output saved to: ([^\n]+)/.exec(tete))) chemin = x[1].trim();
    else if ((x = /Output exceeded the [^\n]*? persist limit; only the first [^\n]*? were saved to: ([^\n]+)/.exec(tete))) { chemin = x[1].trim(); tronque = true; }
    else return refus('réponse trop grosse, pointeur illisible');
  } else if (/^\s*(?:\S+\s*)?<truncated-output>/.test(tete) && /It could not be saved/.test(tete)) return refus('réponse trop grosse, non enregistrée par Claude Code');
  else if (/^\s*Error: result \([^)\n]*\) exceeds maximum allowed tokens\./.test(tete)) {
    if (/Failed to save output to file/.test(tete)) return refus('réponse trop grosse, non enregistrée par Claude Code');
    if (!(x = /Output has been saved to (.+?)\.(?:\r?\n|$)/.exec(tete))) return refus('réponse trop grosse, pointeur illisible');
    chemin = x[1].trim(); tronque = /the saved file contains only the first/.test(t.slice(0, 20000));
  } else return null;
  if (tronque) return refus('réponse trop grosse, fichier tronqué par Claude Code', chemin);
  let reel, base;
  try { reel = fs.realpathSync(path.resolve(chemin)); } catch { return refus('réponse trop grosse, fichier introuvable', chemin); }
  try { base = fs.realpathSync(dossierConfig); } catch { return refus('réponse trop grosse, dossier de Claude introuvable', chemin); }
  const rel = path.relative(base, reel);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || path.basename(path.dirname(reel)) !== 'tool-results') return refus('réponse trop grosse, fichier hors du dossier tool-results de Claude : jamais lu', chemin);
  let st; try { st = fs.statSync(reel); } catch { return refus('réponse trop grosse, fichier introuvable', chemin); }
  if (!st.isFile()) return refus('réponse trop grosse, ce n\'est pas un fichier', chemin);
  if (st.size > borne) return refus(`réponse trop grosse, fichier de ${Math.round(st.size / 1048576)} Mo au-delà de la borne de ${Math.round(borne / 1048576)} Mo : refusé`, chemin);
  let contenu; try { contenu = fs.readFileSync(reel, 'utf8'); } catch (e) { return refus('réponse trop grosse, fichier illisible : ' + e.message, chemin); }
  if (/\.json$/i.test(reel)) { try { const j = JSON.parse(contenu); if (Array.isArray(j) && j.length && j.every(b => b && b.type === 'text' && typeof b.text === 'string')) contenu = j.map(b => b.text).join('\n'); } catch {} }
  return { sortie: contenu, persistee: { chemin: reel, octets: st.size } };
}

/** Le préfixe d'outils d'un serveur (« claude.ai Meta Ads » → mcp__claude_ai_Meta_Ads__). */
const prefixeDe = nom => `mcp__${String(nom || '').replace(/[^A-Za-z0-9_-]/g, '_')}__`;

/**
 * Un tour. Rend { texte, structure, outils, appels, refus, usage, modele, dureeMs, connecteurs, outilsVus, estErreur }.
 * appels = [{ nom, entree, sortie, erreur }] : ce que chaque outil a VRAIMENT rendu (2e méthode : on ne croit
 * pas seulement la phrase finale de l'agent, on relit la réponse du connecteur).
 * Un tour qui finit MAL rejette une erreur qui porte TOUJOURS ses appels (e.appels : un tour coupé après un
 * ads_activate_entity ne doit jamais faire croire que rien n'est parti) ; e.quota = { reprise, texte } quand c'est la
 * limite d'usage du compte Claude ; e.connecteur = { prefixes, statuts } quand un connecteur EXIGÉ
 * (exigerConnecteurs : [{ cle, prefixe }]) n'est pas « connected » à l'init — le tour est alors arrêté AVANT toute
 * question au modèle (aucun jeton, aucun appel).
 */
export function tour(options) {
  const { message, systeme, dureeMaxMs = 300000, surLigne = null, arretApresInit = false } = options;
  fs.mkdirSync(DOSSIER_TOURS, { recursive: true });
  const fichierSysteme = path.join(DOSSIER_TOURS, `systeme-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.txt`);
  fs.writeFileSync(fichierSysteme, String(systeme || ''), 'utf8');
  const args = argumentsDuTour({ ...options, fichierSysteme });
  const env = envEnfant(process.env, { ENABLE_TOOL_SEARCH: process.env.ENABLE_TOOL_SEARCH || 'auto', MAX_MCP_OUTPUT_TOKENS: process.env.MAX_MCP_OUTPUT_TOKENS || '50000' });
  const debut = Date.now();
  const nettoyer = () => { try { fs.unlinkSync(fichierSysteme); } catch {} };
  return new Promise((resoudre, rejeter) => {
    let p;
    try {
      // « node:<fichier> » : un faux claude écrit en JavaScript (épreuves) — Windows ne lance pas un .mjs tout seul
      const bin = trouverClaude();
      p = bin.startsWith('node:') ? spawn(process.execPath, [bin.slice(5), ...args], { cwd: DOSSIER_TOURS, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
        : spawn(bin, args, { cwd: DOSSIER_TOURS, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) { nettoyer(); return rejeter(new Error('impossible de lancer claude : ' + e.message)); }
    let tampon = '', erreurs = '', texte = '', resultatVu = false, usage = null, modeleUsage = null, estErreur = false, structure = null, refus = [];
    const outils = [], appels = [], parId = new Map(), connecteurs = [], erreursApi = [], erreursResultat = [];
    let outilsVus = [], fini = false;
    const terminer = (f, v) => { if (fini) return; fini = true; clearTimeout(minuteur); nettoyer(); f(v); };
    // toute erreur rendue après le lancement porte les appels déjà faits (une activation partie, puis le tour coupé)
    const echouer = (e, plus = {}) => terminer(rejeter, Object.assign(e, { appels: appels.slice() }, plus));
    const minuteur = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} echouer(new Error(`Claude a dépassé ${Math.round(dureeMaxMs / 1000)} s`)); }, dureeMaxMs);
    const ligne = l => {
      if (!l.trim()) return;
      let j; try { j = JSON.parse(l); } catch { return; }
      if (surLigne) { try { surLigne(j); } catch {} }
      if (j.type === 'system' && j.subtype === 'init') {
        for (const s of j.mcp_servers || []) connecteurs.push({ id: s.name, statut: s.status || 'inconnu' });
        outilsVus = Array.isArray(j.tools) ? j.tools.slice() : [];
        // un connecteur EXIGÉ par l'étape qui n'est pas « connected » (needs-auth, pending, failed, absent) : ce n'est pas une
        // panne de la chaîne, c'est un connecteur à reconnecter — arrêté ici, avant toute question au modèle
        const exiges = Array.isArray(options.exigerConnecteurs) ? options.exigerConnecteurs.filter(x => x && x.prefixe) : [];
        const manque = exiges.map(x => { const s = connecteurs.find(c => prefixeDe(c.id) === x.prefixe); return !s || s.statut !== 'connected' ? { cle: x.cle || null, prefixe: x.prefixe, statut: s ? s.statut : 'absent' } : null; }).filter(Boolean);
        if (manque.length) { try { p.kill('SIGKILL'); } catch {} return echouer(new Error(`connecteur à reconnecter : ${manque.map(x => `${x.cle || x.prefixe} (${x.statut})`).join(', ')}`), { connecteur: { cles: manque.map(x => x.cle).filter(Boolean), statuts: manque.map(x => `${x.cle || x.prefixe} (${x.statut})`) } }); }
        if (arretApresInit) { try { p.kill('SIGKILL'); } catch {} return terminer(resoudre, { texte: '', structure: null, outils: [], appels: [], refus: [], usage: null, modele: null, dureeMs: Date.now() - debut, connecteurs, outilsVus, estErreur: false, init: true }); }
      }
      // un message d'ERREUR DE L'API (pas la prose de l'agent) : CLI 2.1.283 le marque error / model "<synthetic>"
      if (j.type === 'assistant' && j.message && (j.error || j.message.model === '<synthetic>')) {
        const t = Array.isArray(j.message.content) ? j.message.content.map(b => b.text || '').join(' ') : String(j.message.content || '');
        erreursApi.push({ code: String(j.error || ''), texte: t });
      }
      if (j.type === 'assistant' && j.message && Array.isArray(j.message.content)) {
        for (const b of j.message.content) if (b.type === 'tool_use' && b.name) {
          if (b.name !== 'StructuredOutput' && !outils.includes(b.name)) outils.push(b.name);
          const a = { id: b.id, nom: b.name, entree: b.input, sortie: null, erreur: false };
          appels.push(a); parId.set(b.id, a);
        }
      }
      if (j.type === 'user' && j.message && Array.isArray(j.message.content)) {
        for (const b of j.message.content) if (b.type === 'tool_result' && parId.has(b.tool_use_id)) {
          const a = parId.get(b.tool_use_id);
          const c = Array.isArray(b.content) ? b.content.map(x => x.text || '').join('\n') : String(b.content ?? '');
          a.sortie = c.slice(0, COUPE_SORTIE); a.erreur = !!b.is_error;
          // [sortie-persistee] un POINTEUR vers la réponse trop grosse : la VRAIE réponse, entière (≤ 20 Mo), lue dans son fichier
          const lu = lireSortiePersistee(c, { dossierConfig: dossierConfigClaude(env) });
          if (lu) { a.sortie = lu.sortie; a.persistee = lu.persistee; }
          // une capture d'écran rendue par un connecteur (l'aperçu de la page) : gardée pour le client
          if (Array.isArray(b.content)) a.images = b.content.filter(x => x.type === 'image' && x.source && x.source.data && x.source.data.length < 3e6).slice(0, 3).map(x => ({ media_type: x.source.media_type, data: x.source.data }));
        }
      }
      if (j.type === 'result') {
        resultatVu = true; texte = String(j.result || '').trim(); usage = j.usage || null; modeleUsage = j.modelUsage || null; estErreur = !!j.is_error;
        structure = j.structured_output ?? null; refus = Array.isArray(j.permission_denials) ? j.permission_denials : [];
        if (Array.isArray(j.errors)) for (const x of j.errors) erreursResultat.push(typeof x === 'string' ? x : JSON.stringify(x));
      }
    };
    p.stdout.on('data', d => { tampon += d; let i; while ((i = tampon.indexOf('\n')) >= 0) { ligne(tampon.slice(0, i)); tampon = tampon.slice(i + 1); } });
    p.stderr.on('data', d => { erreurs += d; if (erreurs.length > 20000) erreurs = erreurs.slice(-20000); });
    p.on('error', e => echouer(new Error(e.code === 'ENOENT' ? "Claude Code n'est pas installé (claude introuvable)" : e.message)));
    p.on('close', code => {
      if (fini) return;
      ligne(tampon);
      // LA LIMITE D'USAGE : lue dans les erreurs de l'API, le résultat EN ERREUR, errors[], et stderr sans résultat
      // (un tour qui finit BIEN n'est jamais une limite, même si l'API a calé une fois en route puis repris)
      const sources = !estErreur && resultatVu ? [] : [...erreursApi.map(x => (x.code === 'rate_limit' && !MOTIF_QUOTA.test(x.texte) ? 'rate_limit ' : '') + x.texte), ...(estErreur ? [texte] : []), ...erreursResultat, ...(!resultatVu ? [erreurs] : [])];
      for (const t of sources) { const q = lireQuota(t); if (q) return echouer(new Error(`limite d'usage de Claude atteinte : ${q.texte.slice(0, 160)}`), { quota: q }); }
      if (!resultatVu) return echouer(new Error(`claude s'est arrêté (code ${code}) sans résultat${erreurs ? ' : ' + erreurs.trim().slice(0, 300) : ''}`));
      if (estErreur && !texte && !structure) return echouer(new Error('Claude a rendu une erreur sans texte' + (erreursResultat.length ? ' : ' + erreursResultat.join(' ; ').slice(0, 200) : '') + (erreurs ? ' : ' + erreurs.trim().slice(0, 300) : '')));
      terminer(resoudre, { texte, structure, outils, appels, refus, usage, modele: modelePrincipal(modeleUsage, options.modele), dureeMs: Date.now() - debut, connecteurs, outilsVus, estErreur });
    });
    p.stdin.on('error', () => {});
    const images = options.images && options.images.length ? options.images : null;
    if (images) {
      // le message ET les photos du produit (l'agent ne lit aucun fichier : on lui MONTRE ce qu'il doit voir)
      const contenu = [{ type: 'text', text: String(message || '') }, ...images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.media_type || 'image/jpeg', data: i.data } }))];
      p.stdin.end(JSON.stringify({ type: 'user', message: { role: 'user', content: contenu } }) + '\n', 'utf8');
    } else p.stdin.end(String(message || ''), 'utf8');
  });
}

function modelePrincipal(mu, voulu) {
  const cles = Object.keys(mu || {});
  if (!cles.length) return voulu || null;
  return cles.find(k => k.includes(voulu || 'sonnet')) || cles.filter(k => !/haiku/.test(k)).sort((a, b) => ((mu[b].outputTokens || 0) - (mu[a].outputTokens || 0)))[0] || cles[0];
}

/** Compte des tokens d'un usage (toutes catégories). */
export function tokensDe(usage) {
  if (!usage) return 0;
  return (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
}

/** Extrait un objet JSON d'un texte qui peut contenir des fences ou du bavardage. */
export function jsonDans(texte) {
  const t = String(texte || '').replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('aucun JSON dans la réponse');
  return JSON.parse(t.slice(a, b + 1));
}

/* ---------- les connecteurs du client ---------- */
export const SIGNATURES = {
  tassyir: ['list_orders', 'create_product', 'upload_image'],
  meta: ['ads_get_ad_entities', 'ads_create_campaign', 'ads_creative_upload_media']
};
/** Le nom d'outil que Claude Code donne à un serveur : tout caractère hors A-Z a-z 0-9 _ - devient « _ ». */
export const nomServeur = n => String(n || '').replace(/[^A-Za-z0-9_-]/g, '_');

/**
 * Retrouve les connecteurs à partir de l'événement init : pour chaque serveur, ses outils (préfixe mcp__<nom>__).
 * Rend { serveurs:[{nom, statut, prefixe, outils}], tassyir: prefixe|null, meta: prefixe|null, manque:[…] }.
 */
export function lireConnecteurs(connecteurs, outilsVus) {
  const serveurs = (connecteurs || []).map(c => {
    const prefixe = `mcp__${nomServeur(c.id)}__`;
    const outils = (outilsVus || []).filter(t => t.startsWith(prefixe)).map(t => t.slice(prefixe.length));
    return { nom: c.id, statut: c.statut, prefixe, outils };
  });
  const choisir = cle => {
    const sig = SIGNATURES[cle];
    // 1) par les outils (le plus sûr) ; 2) par le nom si les outils ne sont pas listés (connecteur mis de côté)
    const parOutils = serveurs.filter(s => sig.every(o => s.outils.includes(o)));
    if (parOutils.length === 1) return parOutils[0];
    const mots = cle === 'tassyir' ? /tass?yir|تسيير/i : /meta|facebook|fcb|ads/i;
    const parNom = serveurs.filter(s => !s.outils.length && mots.test(s.nom));
    return parOutils[0] || (parNom.length === 1 ? parNom[0] : null);
  };
  const t = choisir('tassyir'), m = choisir('meta');
  const manque = [];
  if (!t) manque.push('tassyir'); else if (t.statut !== 'connected') manque.push(`tassyir (${t.statut})`);
  if (!m) manque.push('meta'); else if (m.statut !== 'connected') manque.push(`meta (${m.statut})`);
  return { serveurs, tassyir: t ? t.prefixe : null, meta: m ? m.prefixe : null, manque };
}

/** Sonde sans dépenser : lance claude, lit l'événement init (serveurs + outils), et l'arrête avant toute question au modèle. */
/**
 * Lit la sortie de `claude mcp list` : « <nom>: <adresse ou commande> - <état> », une ligne par serveur
 * (les connecteurs claude.ai s'appellent « claude.ai <Nom> »). Rend [{ nom, url, statut }].
 */
export function lireListeMcp(texte) {
  const serveurs = [];
  for (const brut of String(texte || '').split(/\r?\n/)) {
    const l = brut.trim(); const deux = l.indexOf(': '); const tiret = l.lastIndexOf(' - ');
    if (deux <= 0 || tiret <= deux) continue;
    const nom = l.slice(0, deux).trim(), cible = l.slice(deux + 2, tiret).trim(), etat = l.slice(tiret + 3).trim();
    const statut = /needs? auth/i.test(etat) ? 'needs-auth' : /fail|disconnect|error|erreur|✗/i.test(etat) ? 'failed' : /connected|connecté|✔|✓/i.test(etat) ? 'connected' : 'inconnu';
    serveurs.push({ nom, url: /^https?:\/\//i.test(cible) ? cible.split(/\s+/)[0] : '', statut });
  }
  return serveurs;
}
/** Dans la liste du CLI : Tassyir par son adresse (sinon son nom), Meta Ads par son adresse (sinon son nom). */
export function choisirDansListe(serveurs) {
  const pick = (parUrl, parNom) => {
    const a = serveurs.filter(s => parUrl.test(s.url)); const b = a.length ? a : serveurs.filter(s => !s.url && parNom.test(s.nom));
    return b.find(s => s.statut === 'connected') || b[0] || null;
  };
  return { tassyir: pick(/tass?yir/i, /tass?yir|تسيير/i), meta: pick(/mcp\.facebook\.com\/ads/i, /meta|facebook|fcb/i) };
}
function listeMcp(dureeMaxMs) {
  return new Promise((ok, ko) => {
    fs.mkdirSync(DOSSIER_TOURS, { recursive: true });
    const bin = trouverClaude(); let sortie = '', p;
    try {
      p = bin.startsWith('node:') ? spawn(process.execPath, [bin.slice(5), 'mcp', 'list'], { cwd: DOSSIER_TOURS, env: envEnfant(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        : spawn(bin, ['mcp', 'list'], { cwd: DOSSIER_TOURS, env: envEnfant(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) { return ko(e); }
    const m = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} ko(new Error(`claude mcp list : plus de ${Math.round(dureeMaxMs / 1000)} s`)); }, dureeMaxMs);
    p.stdout.on('data', d => { sortie += d; }); p.stderr.on('data', d => { sortie += d; });
    p.on('error', e => { clearTimeout(m); ko(e); });
    p.on('close', () => { clearTimeout(m); ok(sortie); });
  });
}
/**
 * La sonde : 1) `claude mcp list` (le CLI se connecte à chaque serveur, claude.ai compris : l'état est sûr) ;
 * 2) l'événement init (ses outils prouvent les signatures). Un connecteur n'est retenu que BRANCHÉ.
 * Rend { serveurs, tassyir: préfixe|null, meta: préfixe|null, manque, source, erreurs }.
 */
export async function sonderConnecteurs({ dureeMaxMs = 90000 } = {}) {
  const erreurs = [];
  let liste = [];
  try { liste = lireListeMcp(await listeMcp(dureeMaxMs)); } catch (e) { erreurs.push('mcp list : ' + e.message); }
  let init = { connecteurs: [], outilsVus: [] };
  try { init = await tour({ message: 'OK', systeme: 'Sonde des connecteurs.', dureeMaxMs, arretApresInit: true, modele: 'haiku' }); } catch (e) { erreurs.push('init : ' + e.message); }
  const parInit = lireConnecteurs(init.connecteurs, init.outilsVus);
  const parListe = choisirDansListe(liste);
  const res = { serveurs: [], tassyir: null, meta: null, manque: [], source: {}, erreurs };
  const vus = new Map();
  for (const s of parInit.serveurs) vus.set(s.nom, { nom: s.nom, statut: s.statut, prefixe: s.prefixe, outils: s.outils, url: '' });
  for (const s of liste) { const v = vus.get(s.nom) || { nom: s.nom, prefixe: `mcp__${nomServeur(s.nom)}__`, outils: [] }; vus.set(s.nom, { ...v, url: s.url, statut: s.statut === 'inconnu' ? (v.statut || 'inconnu') : s.statut }); }
  res.serveurs = [...vus.values()];
  for (const cle of ['tassyir', 'meta']) {
    const viaInit = parInit[cle] ? res.serveurs.find(s => s.prefixe === parInit[cle]) : null;
    const viaListe = parListe[cle] ? res.serveurs.find(s => s.nom === parListe[cle].nom) : null;
    const choisi = (viaInit && viaInit.outils.length && viaInit.statut === 'connected') ? viaInit : (viaListe || viaInit);
    if (!choisi) { res.manque.push(cle); continue; }
    if (choisi.statut !== 'connected') { res.manque.push(`${cle} (${choisi.statut})`); continue; }
    res[cle] = choisi.prefixe; res.source[cle] = choisi === viaInit && viaInit.outils.length ? 'outils' : 'liste';
  }
  return res;
}

/** La liste blanche d'une étape : des noms logiques (« tassyir.list_orders ») deviennent des noms Claude Code. */
export function outilsEtape(liste, prefixes) {
  const out = [];
  for (const x of liste || []) {
    const [cle, outil] = String(x).split('.');
    const p = prefixes && prefixes[cle];
    if (p && outil && !JAMAIS.includes(outil)) out.push(p + outil);
  }
  return out;
}
