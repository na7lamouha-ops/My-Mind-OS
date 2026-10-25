// lecture_navigateur.js — à exécuter (javascript_tool) dans la page web de la Ad Library d'UNE page,
// ouverte par le lien du rapport. Elle clique « Voir plus » jusqu'au bout (chargement de la liste, rien d'autre),
// puis rend toutes les pubs affichées : [id, date de début AAAA-MM-JJ, pubs groupées sous la carte, début du texte].
// Le résultat se colle tel quel dans navigateur-<page_id>.json, puis : python3 fusion_navigateur.py entree.json <page_id> navigateur-<page_id>.json
await (async () => {
  const cartes = () => document.body.innerText.split(/ID dans la bibliothèque|Library ID/).length - 1;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  await attendre(4000);
  for (let i = 0, avant = -1; i < 30 && cartes() !== avant; i++) {
    avant = cartes();
    const b = [...document.querySelectorAll('div[role="button"],a[role="button"],button')]
      .filter(e => /^(Voir plus|See more)$/.test(e.innerText.trim())).pop();
    if (!b) break;
    b.click(); await attendre(3500);
    window.scrollTo(0, document.documentElement.scrollHeight); await attendre(1500);
  }
  const MOIS = {janv:1,'févr':2,mars:3,avr:4,mai:5,juin:6,juil:7,'août':8,sept:9,sep:9,oct:10,nov:11,'déc':12,
                jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,dec:12};
  const t = document.body.innerText, pubs = [];
  for (const bloc of t.split(/ID dans la bibliothèque|Library ID/).slice(1)) {
    const id = (bloc.match(/\d{12,20}/) || [])[0];
    const fr = bloc.match(/le (\d{1,2}) ([a-zéû]+)\.? (\d{4})/i), en = bloc.match(/on ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/);
    let jour = null;
    if (fr && MOIS[fr[2].toLowerCase()]) jour = `${fr[3]}-${String(MOIS[fr[2].toLowerCase()]).padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
    else if (en && MOIS[en[1].toLowerCase()]) jour = `${en[3]}-${String(MOIS[en[1].toLowerCase()]).padStart(2, '0')}-${en[2].padStart(2, '0')}`;
    const g = bloc.match(/(\d+) (?:publicités utilisent|ads use)/);
    const texte = ((bloc.split(/Sponsorisé|Sponsored/)[1]) || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (id) pubs.push([id, jour, g ? +g[1] : 1, texte]);
  }
  const total = +((t.match(/([\d\s]+) (?:résultats?|results?)/) || [0, '0'])[1].replace(/\s/g, ''));
  return JSON.stringify({ total, pubs });
})()
