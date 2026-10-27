// ecomanita 0.5.0 — LE CHARGEMENT DES AGENTS : un dossier par agent (agents/<id>/agent.json + agent.mjs + prompt.md).
// Un contrat faux n'est jamais chargé : il est rendu dans « refuses » avec ses fautes (la page et l'épreuve le montrent).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validerContrat } from '../boucle.mjs';

export const DOSSIER_AGENTS = path.dirname(fileURLToPath(import.meta.url));
/** L'ordre de construction (section 6 du chantier) : le القائد d'abord. */
export const ORDRE = ['qaid', 'mofattich', 'boussala', 'jasous', 'montage', 'safha', 'media_buyer', 'hares', 'taakid', 'tawsil', 'darahem', 'mohallil'];

export async function chargerAgents(dossier = DOSSIER_AGENTS) {
  const agents = [], refuses = [];
  const ids = fs.readdirSync(dossier, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    .sort((a, b) => (ORDRE.indexOf(a) + 1 || 99) - (ORDRE.indexOf(b) + 1 || 99));
  for (const id of ids) {
    const d = path.join(dossier, id);
    let contrat;
    try { contrat = JSON.parse(fs.readFileSync(path.join(d, 'agent.json'), 'utf8')); } catch (e) { refuses.push({ id, fautes: ['agent.json illisible : ' + e.message] }); continue; }
    const fautes = validerContrat(contrat);
    if (contrat.id !== id) fautes.push('id ≠ dossier');
    if (!fs.existsSync(path.join(d, 'prompt.md'))) fautes.push('prompt.md absent');
    if (fautes.length) { refuses.push({ id, fautes }); continue; }
    const module = await import(pathToFileURL(path.join(d, 'agent.mjs')).href);
    if (typeof module.executer !== 'function') { refuses.push({ id, fautes: ['executer() absent'] }); continue; }
    agents.push({ contrat, module, prompt: fs.readFileSync(path.join(d, 'prompt.md'), 'utf8') });
  }
  return { agents, refuses };
}
