// ecom manita — LE CARNET : la mémoire du client. Des notes Markdown avec [[liens]], les fiches
// produit et les mesures du jour (JSON), et un graphe reconstruit à la lecture. Rien n'en sort.
import fs from 'node:fs';
import path from 'node:path';

export function ouvrirCarnet(maison) {
  const notes = path.join(maison, 'notes');
  const carnet = path.join(maison, 'carnet');
  fs.mkdirSync(notes, { recursive: true });
  fs.mkdirSync(carnet, { recursive: true });
  return { maison, notes, carnet };
}

const SECRETS = /(mot de passe|password|token|jeton|api[_ -]?key|cl[eé]\s+(api|secr)|secret\s*[:=]|\b\d{16}\b|bearer\s+[a-z0-9]{20,}|\bEAA[A-Za-z0-9]{20,})/i; // [relecture] 10/10/2026 : un jeton Meta brut (« EAA… ») aussi
const COORDONNEES_CLIENTE = /(\b0[5-7]\d{8}\b|\+213\d{9}|@[a-z0-9.-]+\.[a-z]{2,})/i;

/** Refus automatique : aucun secret, aucune coordonnée de cliente n'entre dans le carnet. */
export function refusDeContenu(texte) {
  if (SECRETS.test(texte)) return 'refusé : ce texte ressemble à un secret (mot de passe, clé, jeton, carte)';
  if (COORDONNEES_CLIENTE.test(texte)) return 'refusé : ce texte contient un numéro ou un mail de cliente';
  return null;
}

export function slug(t) { return String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'note'; }

/** Écrit un livrable comme note datée. Rend le chemin relatif. */
export function ecrireNote(c, { titre, dept, poste, agent, texte, sources = [], outils = [], modele = '', controles = null, tacheId = '' }) {
  const refus = refusDeContenu(texte);
  if (refus) throw new Error(refus);
  const date = new Date();
  const jour = date.toISOString().slice(0, 10);
  let nom = `${jour}-${dept}-${slug(titre)}.md`;
  let chemin = path.join(c.notes, nom);
  let n = 2;
  while (fs.existsSync(chemin)) { nom = `${jour}-${dept}-${slug(titre)}-${n++}.md`; chemin = path.join(c.notes, nom); } // jamais d'écrasement
  const entete = ['---', `titre: ${JSON.stringify(titre)}`, `date: ${date.toISOString()}`, `departement: ${dept}`, `poste: ${poste || ''}`, `agent: ${agent || ''}`,
    `tache: ${tacheId}`, `modele: ${modele}`, `outils: ${JSON.stringify(outils)}`, `controles: ${JSON.stringify(controles || {})}`, '---', ''].join('\n');
  const pied = sources.length ? `\n\nLu : ${sources.map(s => `[[${s}]]`).join(' · ')}\n` : '\n';
  fs.writeFileSync(chemin, entete + texte.trim() + pied);
  return path.relative(c.maison, chemin);
}

function lireEntete(contenu) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(contenu);
  const e = {};
  if (m) for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim(); try { v = JSON.parse(v); } catch {} e[k] = v; } }
  return { entete: e, corps: m ? contenu.slice(m[0].length) : contenu };
}

/** Toutes les notes : titre, chemin, date, département, liens [[…]], mots (pour le choix des notes). */
export function listerNotes(c) {
  const out = [];
  const marcher = dir => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { marcher(p); continue; }
      if (!f.name.endsWith('.md')) continue;
      let contenu = ''; try { contenu = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const { entete, corps } = lireEntete(contenu);
      const liens = [...corps.matchAll(/\[\[([^\]|#]+)/g)].map(x => x[1].trim());
      const titre = entete.titre || f.name.replace(/\.md$/, '');
      out.push({ titre, nom: f.name.replace(/\.md$/, ''), chemin: path.relative(c.maison, p), date: entete.date || '', departement: entete.departement || '', poste: entete.poste || '', liens, taille: contenu.length, apercu: corps.trim().slice(0, 160) });
    }
  };
  marcher(c.notes);
  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return out;
}

export function lireNote(c, chemin) {
  const p = path.resolve(c.maison, chemin);
  if (!p.startsWith(path.resolve(c.maison) + path.sep)) throw new Error('chemin hors du carnet');
  return fs.readFileSync(p, 'utf8');
}

/** Le graphe : un nœud par note, un lien par [[nom]] qui existe. */
export function graphe(c) {
  const notes = listerNotes(c);
  const parNom = new Map(notes.map(n => [n.nom.toLowerCase(), n]));
  const liens = [];
  for (const n of notes) for (const l of n.liens) { const cible = parNom.get(l.toLowerCase()); if (cible && cible !== n) liens.push({ de: n.nom, vers: cible.nom }); }
  return { noeuds: notes.map(n => ({ id: n.nom, titre: n.titre, departement: n.departement, date: n.date })), liens };
}

/** Les fiches produit et mesures du carnet (JSON écrits par manita-carnet.py ou par l'office). */
export function produits(c) {
  const out = [];
  for (const f of fs.readdirSync(c.carnet)) {
    if (!f.endsWith('.json')) continue;
    try { const j = JSON.parse(fs.readFileSync(path.join(c.carnet, f), 'utf8')); out.push({ fichier: f, ...resume(j) }); } catch { out.push({ fichier: f, erreur: 'JSON illisible' }); }
  }
  return out;
}
function resume(j) {
  const mesures = Array.isArray(j.mesures) ? j.mesures : [];
  const somme = k => mesures.reduce((s, m) => s + (+m[k] || 0), 0);
  const commandes = somme('commandes'), confirmees = somme('confirmees'), expediees = somme('expediees'), livrees = somme('livrees'), depense = somme('depense');
  return { produit: j.produit || j.nom || '', jours: mesures.length, commandes, confirmees, expediees, livrees, depense,
    confirmation: commandes ? +(confirmees / commandes).toFixed(3) : null, livraison: expediees ? +(livrees / expediees).toFixed(3) : null, declare: j.declare || null };
}

/** Choix des notes pour une tâche : recouvrement de mots entre la tâche et le titre/aperçu, plus les notes du département. Déterministe. */
export function notesPourTache(c, texte, dept, max = 6, tailleMax = 6000) {
  const mots = new Set(String(texte).toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(w => w.length > 3));
  const notes = listerNotes(c).map(n => {
    const corpus = (n.titre + ' ' + n.apercu).toLowerCase();
    let score = 0; for (const w of mots) if (corpus.includes(w)) score++;
    if (n.departement === dept) score += 1;
    return { n, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || (b.n.date || '').localeCompare(a.n.date || '')).slice(0, max);
  const morceaux = []; let total = 0;
  for (const { n } of notes) {
    let contenu = ''; try { contenu = lireEntete(lireNote(c, n.chemin)).corps.trim(); } catch { continue; }
    const morceau = contenu.slice(0, Math.max(400, Math.floor(tailleMax / Math.max(1, notes.length))));
    total += morceau.length; if (total > tailleMax) break;
    morceaux.push({ nom: n.nom, titre: n.titre, texte: morceau });
  }
  return morceaux;
}
