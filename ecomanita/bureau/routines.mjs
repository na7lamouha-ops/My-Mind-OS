// ecom manita — LES ROUTINES : l'horloge est côté serveur. Une routine = une tâche à une heure fixe,
// tous les jours ou en semaine ; un seul rattrapage si le bureau était éteint, marqué EN RETARD.
import fs from 'node:fs';
import path from 'node:path';

const JOURS = { tous: [0, 1, 2, 3, 4, 5, 6], semaine: [1, 2, 3, 4, 5] };

export function ouvrirRoutines(fichierDefinitions, fichierEtat) {
  const lire = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const ecrire = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); };
  const definitions = () => (lire(fichierDefinitions) || { routines: [] }).routines || [];
  const etat = () => lire(fichierEtat) || {};

  function prochaine(r, depuis = Date.now()) {
    const [h, m] = String(r.heure || '18:00').split(':').map(Number);
    const jours = JOURS[r.jours] || JOURS.tous;
    for (let i = 0; i < 8; i++) {
      const d = new Date(depuis); d.setDate(d.getDate() + i); d.setHours(h, m || 0, 0, 0);
      if (d.getTime() > depuis && jours.includes(d.getDay())) return d.getTime();
    }
    return null;
  }

  return {
    lister() {
      const e = etat();
      return definitions().map(r => ({ ...r, prochaineA: e[r.id]?.prochaineA || prochaine(r), derniere: e[r.id]?.derniere || null, enPause: !!r.enPause }));
    },
    ajouter(r) {
      const d = definitions();
      const id = r.id || ('r' + Date.now().toString(36));
      const n = { id, departement: r.departement, texte: r.texte, heure: r.heure || '18:00', jours: JOURS[r.jours] ? r.jours : 'tous', besoinOk: r.besoinOk !== false, enPause: false };
      d.push(n); ecrire(fichierDefinitions, { routines: d });
      const e = etat(); e[id] = { prochaineA: prochaine(n) }; ecrire(fichierEtat, e);
      return n;
    },
    supprimer(id) { ecrire(fichierDefinitions, { routines: definitions().filter(r => r.id !== id) }); const e = etat(); delete e[id]; ecrire(fichierEtat, e); },
    pause(id, valeur) { ecrire(fichierDefinitions, { routines: definitions().map(r => r.id === id ? { ...r, enPause: !!valeur } : r) }); },
    /** Ce qui est dû maintenant : rend [{routine, enRetard}] et avance l'horloge (un seul rattrapage). */
    dues(maintenant = Date.now()) {
      const e = etat(); const out = [];
      for (const r of definitions()) {
        if (r.enPause) continue;
        const p = e[r.id]?.prochaineA || prochaine(r, maintenant - 86400000);
        if (p && p <= maintenant) {
          out.push({ routine: r, enRetard: maintenant - p > 120000 });
          e[r.id] = { prochaineA: prochaine(r, maintenant), derniere: new Date(maintenant).toISOString() };
        } else if (!e[r.id]) e[r.id] = { prochaineA: p };
      }
      ecrire(fichierEtat, e);
      return out;
    },
    prochaine
  };
}
