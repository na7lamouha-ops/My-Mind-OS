'use strict';
/* ecom manita — LE BUREAU (page). Tout se construit depuis /api/bureau ; rien n'est codé en dur.
   Code original, sans aucune bibliothèque. Darija pour le texte, latin pour les chiffres. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const ARABE = /[؀-ۿ]/;
  const UN_JOUR = 24 * 3600 * 1000;

  /* ===================== outils ===================== */
  function el(tag, attrs = {}, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of enfants.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  function svg(tag, attrs = {}, ...enfants) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of enfants.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  const nombre = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }).replace(/[\s ]/g, ' ');
  const secondes = ms => nombre(Math.round((+ms || 0) / 1000)) + ' s';
  const heureDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const dateDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return [160, 150, 140]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const melanger = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',') + ')'; };
  const sombre = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const telephone = () => matchMedia('(max-width: 900px)').matches;
  const memo = { lire(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, ecrire(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  function toast(texte, { erreur = false, brut = '' } = {}) {
    const t = el('div', { class: 'toast' + (erreur ? ' erreur' : '') }, texte, brut ? el('span', { class: 'brut', text: brut }) : null);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), erreur ? 9000 : 4000);
  }
  async function api(chemin, { method = 'GET', body = null } = {}) {
    const options = { method, cache: 'no-store', headers: { 'x-manita': '1' } };
    if (body !== null) { options.headers['content-type'] = 'application/json'; options.body = JSON.stringify(body); }
    const r = await fetch(chemin, options);
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error((j && (j.erreur || (Array.isArray(j.fautes) && j.fautes.join(' ; ')))) || `${r.status} ${r.statusText}`); // la réponse brute du serveur, jamais une cause devinée
    return j;
  }
  /** Un texte multi-lignes : chaque ligne garde sa direction (arabe → rtl, latin → ltr). */
  function blocTexte(texte, classe = 'texte-livrable') {
    const b = el('div', { class: classe });
    for (const l of String(texte || '').split('\n')) b.append(el('div', { class: 'ligne' + (ARABE.test(l) ? '' : ' latin'), dir: 'auto', text: l }));
    return b;
  }
  function autoGrandir(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; }

  /* ===================== l'état de la page ===================== */
  const etat = {
    bureau: null, sante: null, taches: [], outils: null, reglages: null, reglagesACharger: false, onglet: memo.lire('manita.onglet', 'taches'),
    cartes: new Map(), deplies: new Set(), brouillons: new Map(), controleOuvert: new Map(),
    empreintes: {}, enLigne: true, coachOccupe: false, mode: null, noeuds: { postes: new Map(), plaques: new Map(), fils: new Map() }
  };
  // Par défaut, le bureau montre SEULEMENT les travailleurs : ils travaillent, marchent vers leur poste, et l'état réel des tâches se voit.
  // Les scènes pour rire (la hadra entre agents, ريم et les cœurs, شيكم et ses complots, les disputes, le Boss qui a faim, crie ou écoute le rapport)
  // restent éteintes tant que le client ne les rallume pas avec le petit bouton (gardé dans ce navigateur).
  const vie = { sociale: memo.lire('manita.vieSociale', '0') === '1' };
  const ETIQ = { afaire: 'في الطابور', encours: 'راهي تخدم', attente: 'تستنى كلمتك', fini: 'كملات', echec: 'ما كملاتش' };
  const ORIGINES = { bureau: 'المكتب', telegram: 'تيليغرام', routine: 'روتين', 'routine (en retard)': 'روتين متأخر', 'routine (à la demande)': 'روتين دروك' };
  const CONTROLES = [['outil', 'الأداة'], ['source', 'المصدر'], ['auditeur', 'المدقق']];
  const dept = id => (etat.bureau?.departements || []).find(d => d.id === id) || null;
  const nomDept = id => id === 'manager' ? etat.bureau?.centre?.nomAr || id : (dept(id)?.nomAr || id || 'يختار القائد');
  const nomPoste = (d, p) => (dept(d)?.postes || []).find(x => x.id === p)?.nomAr || p || '';
  const classeVerdict = v => v === 'PASSE' ? 'passe' : v === 'ECHEC' ? 'echec' : '';

  /* ===================== le bureau en SVG ===================== */
  // projection isométrique 2:1 : (u, v) au sol → écran (u − v, (u + v) / 2)
  const iso = (cx, cy, u, v, h = 0) => [cx + u - v, cy + (u + v) / 2 - h];
  function losange(cx, cy, s, h = 0) { return [iso(cx, cy, -s, -s, h), iso(cx, cy, s, -s, h), iso(cx, cy, s, s, h), iso(cx, cy, -s, s, h)]; }
  const points = pts => pts.map(p => p.map(n => Math.round(n * 10) / 10).join(',')).join(' ');
  function couleurs(c) {
    const d = sombre();
    return { dessus: d ? melanger(c, '#1d1a17', 0.42) : melanger(c, '#ffffff', 0.45), cote1: d ? melanger(c, '#000000', 0.62) : melanger(c, '#000000', 0.22), cote2: d ? melanger(c, '#000000', 0.72) : melanger(c, '#000000', 0.38), bord: d ? melanger(c, '#ffffff', 0.15) : melanger(c, '#000000', 0.1) };
  }
  /** Un bloc isométrique : deux côtés + le dessus. */
  function bloc(cx, cy, s, epaisseur, col, classeDessus) {
    const haut = losange(cx, cy, s, epaisseur), bas = losange(cx, cy, s, 0);
    return [
      svg('polygon', { points: points([haut[3], haut[2], bas[2], bas[3]]), fill: col.cote1 }),
      svg('polygon', { points: points([haut[2], haut[1], bas[1], bas[2]]), fill: col.cote2 }),
      svg('polygon', { points: points(haut), fill: col.dessus, stroke: col.bord, 'stroke-width': 1, class: classeDessus })
    ];
  }
  function couperMots(texte, max, taille) {
    const largeur = s => s.length * taille * 0.66;
    const lignes = []; let cour = '';
    for (const m of String(texte).split(/\s+/)) { const essai = cour ? cour + ' ' + m : m; if (largeur(essai) <= max || !cour) cour = essai; else { lignes.push(cour); cour = m; } }
    if (cour) lignes.push(cour);
    if (lignes.length > 2) { lignes.length = 2; lignes[1] = lignes[1].slice(0, Math.max(3, Math.floor(max / (taille * 0.66)) - 1)) + '…'; }
    return lignes;
  }
  // Le texte latin porte toujours direction=ltr : le SVG hérite du rtl de la page, sinon « 72 H » s'écrit « H 72 ».
  const texteLatin = (x, y, texte, classe, attrs = {}) => svg('text', { x, y, class: classe, 'text-anchor': 'middle', direction: 'ltr', text: texte, ...attrs });
  const texteArabe = (x, y, texte, classe, attrs = {}) => svg('text', { x, y, class: classe, 'text-anchor': 'middle', direction: 'rtl', text: texte, ...attrs });
  /** L'étiquette d'un poste : une plaque claire + le nom arabe + le nom latin (une ou deux lignes). La largeur réelle se mesure après insertion. */
  function etiquettePoste(x, y, p, max) {
    const g = svg('g', { class: 'etiquette', 'data-max': max });
    const plaque = svg('rect', { class: 'etiquette-fond', x: x - max / 2, y: y - 3, width: max, height: 10, rx: 4 });
    const lignes = couperMots(p.nom, max - 6, 10.5);
    const textes = [texteArabe(x, y + 11, p.nomAr, 'poste-ar'), ...lignes.map((l, i) => texteLatin(x, y + 25 + i * 11, l, 'poste-lat'))];
    plaque.setAttribute('height', 20 + lignes.length * 11);
    g.append(plaque, ...textes);
    return g;
  }
  /** Après insertion dans le DOM : mesure chaque texte, serre ceux qui dépassent, ajuste la plaque à la largeur réelle. */
  function ajusterEtiquettes(racine) {
    for (const g of racine.querySelectorAll('.etiquette')) {
      const max = +g.dataset.max; const fond = g.querySelector('.etiquette-fond'); let large = 0;
      for (const t of g.querySelectorAll('text')) {
        let l = 0; try { l = t.getComputedTextLength(); } catch {}
        if (!l) return; // pas encore affiché (bureau plié) : on laisse la plaque à sa largeur maximale
        if (l > max - 6) { t.setAttribute('textLength', max - 6); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); l = max - 6; }
        large = Math.max(large, l);
      }
      const w = Math.min(max, Math.round(large + 10)); const x = +g.querySelector('text').getAttribute('x');
      fond.setAttribute('width', w); fond.setAttribute('x', x - w / 2);
    }
  }
  /** Une table avec son personnage (tête ronde + corps). tx, ty = centre au sol de la table. */
  // Chaque poste a SON agent : un prénom algérien, et la même tête assis ou en marche.
  const HOMMES = ['أمين', 'ياسين', 'رياض', 'كريم', 'سفيان', 'وليد', 'بلال', 'نسيم', 'فاروق', 'هشام'];
  const FEMMES = ['سارة', 'أمينة', 'ليندة', 'نسرين', 'ياسمين', 'مريم', 'إيمان', 'سميرة', 'كنزة', 'وردة'];
  const NOMS_FIXES = { 'manager/manager': { nom: 'Yanis le manager', femme: false, latin: true }, telegram: { nom: 'Zino le télégrameur', femme: false, latin: true } };
  const identites = new Map(); let rangH = 0, rangF = 0;
  let embauches = {}; try { embauches = JSON.parse(localStorage.getItem('manita.embauches') || '{}') || {}; } catch {}
  const sauverEmbauches = () => { try { localStorage.setItem('manita.embauches', JSON.stringify(embauches)); } catch {} };
  function identite(cle) {
    if (cle === 'rim') return BELLE; // Rim assise à son bureau est la même que Rim qui se promène
    if (identites.has(cle)) return identites.get(cle);
    const fixe = NOMS_FIXES[cle];
    const femme = fixe ? fixe.femme : identites.size % 2 === 1;
    const nom = fixe ? fixe.nom : femme ? FEMMES[rangF++ % FEMMES.length] : HOMMES[rangH++ % HOMMES.length]; // le rang avance même si le poste a un embauché
    if (embauches[cle]) { identites.set(cle, embauches[cle]); return embauches[cle]; }
    const id = { nom, femme, latin: !!fixe?.latin, peau: hasard(PEAUX), cheveux: hasard(CHEVEUX), pantalon: hasard(PANTALONS) };
    identites.set(cle, id); return id;
  }
  const etiquetteNom = (x, y, id) => svg('text', { x, y, class: 'nom-agent', 'text-anchor': 'middle', direction: id.latin ? 'ltr' : 'rtl', text: id.nom });
  const hacher = t => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  /** Deux objets par bureau, toujours les mêmes pour un poste : une plante, une tasse, une pile de papiers. */
  function accessoires(tx, ty, taille, elev, cle) {
    const h = hacher(cle || tx + ',' + ty), gx = tx - taille * 1.25, dx = tx + taille * 1.2, y = ty - elev;
    const plante = svg('g', { class: 'deco' }, svg('path', { d: `M${gx - 2.6},${y - 4} h5.2 l-.8,4.4 h-3.6 z`, class: 'deco-pot' }),
      svg('circle', { cx: gx - 1.6, cy: y - 6.4, r: 2.4, class: 'deco-feuille' }), svg('circle', { cx: gx + 1.8, cy: y - 6.8, r: 2.2, class: 'deco-feuille' }), svg('circle', { cx: gx, cy: y - 8.8, r: 2.3, class: 'deco-feuille-2' }));
    const tasse = svg('g', { class: 'deco' }, svg('rect', { x: dx - 2, y: y - 4.4, width: 4, height: 4.2, rx: .9, class: 'deco-tasse' }), svg('path', { d: `M${dx + 2},${y - 3.6} q2,0 2,1.4 q0,1.4 -2,1.4`, class: 'deco-anse' }), svg('ellipse', { cx: dx, cy: y - 4.3, rx: 1.7, ry: .5, class: 'deco-cafe' }));
    const papiers = svg('g', { class: 'deco' }, svg('polygon', { points: points(losange(dx - 1, ty + 2, 3.2, elev + .6)), class: 'deco-papier' }), svg('polygon', { points: points(losange(dx - .4, ty + 1.6, 3.2, elev + 1.5)), class: 'deco-papier' }));
    return [[plante, tasse], [papiers, tasse], [plante, papiers]][h % 3];
  }
  function tableEtPersonnage(tx, ty, taille = 11, { manager = false, cle = null } = {}) {
    const elev = manager ? 17 : 14;
    // le personnage est assis DERRIÈRE la table (plus loin au sol = plus haut à l'écran) : la tête et les épaules dépassent du plateau
    const base = ty - taille - 3, l = manager ? 12 : 10, hc = manager ? 18 : 16, rt = manager ? 8.5 : 7.5;
    // le même humain que les marcheurs, vu de face : cheveux, yeux, cou, chemise (sa couleur dit l'état du poste), bras posés sur la table
    const id = identite(cle || ('anonyme/' + Math.random())), { peau, cheveux, femme } = id;
    const ty0 = base - hc - l - rt + 3; // centre de la tête
    const perso = svg('g', { class: 'personnage' },
      svg('circle', { class: 'halo', cx: tx, cy: base - hc - 6, r: 19 }),
      femme ? svg('path', { d: `M${tx - rt - .8},${ty0 - 1} q0,-${rt + 2} ${rt + .8},-${rt + 1.6} q${rt + .8},-.4 ${rt + .8},${rt + 1.6} l.8,${rt + 6} h-${2 * rt + 3.2} z`, fill: cheveux }) : null,
      svg('path', { class: 'corps', d: `M${tx - l - 2},${base} v-${hc - 5} q0,-5 5,-5 h${2 * l - 6} q5,0 5,5 v${hc - 5} z` }),
      svg('path', { d: `M${tx - 3},${base - hc} l3,3.4 l3,-3.4 z`, fill: 'rgba(255,255,255,.55)' }), // le col
      manager ? svg('path', { d: `M${tx - 1.6},${base - hc + 3} l1.6,2 l1.6,-2 l-1.6,10 z`, fill: '#3d405b' }) : null,
      svg('rect', { x: tx - 2, y: ty0 + rt - 2, width: 4, height: 4, fill: peau }), // le cou
      svg('circle', { class: 'tete', cx: tx, cy: ty0, r: rt, style: `fill:${peau}` }),
      svg('path', { d: femme ? `M${tx - rt - .4},${ty0 - .5} q-.2,-${rt + 1.2} ${rt + .4},-${rt + 1.2} q${rt + .6},0 ${rt + .4},${rt + .7} q-${rt * .6},-${rt * .5} -${rt + .6},-${rt * .2} z`
                                : `M${tx - rt - .2},${ty0 - .6} q0,-${rt + 1} ${rt + .2},-${rt + 1} q${rt + .4},0 ${rt + .2},${rt + .4} q-${rt * .9},-${rt * .55} -${2 * rt + .4},${.6} z`, fill: cheveux }),
      svg('circle', { cx: tx - rt * .38, cy: ty0 + .6, r: .85, fill: '#222' }), svg('circle', { cx: tx + rt * .38, cy: ty0 + .6, r: .85, fill: '#222' }),
      svg('path', { d: `M${tx - 1.6},${ty0 + rt * .5} q1.6,1.2 3.2,0`, stroke: '#8a4b3a', 'stroke-width': .7, fill: 'none' }),
      svg('g', { class: 'main-levee' }, svg('line', { x1: tx + l, y1: base - hc + 2, x2: tx + l + 7, y2: base - hc - 15 }), svg('circle', { cx: tx + l + 7.5, cy: base - hc - 16.5, r: 2.8, fill: peau, stroke: 'none' })),
      cle ? etiquetteNom(tx, ty0 - rt - 4, id) : null
    );
    const col = { dessus: null, cote1: null, cote2: null, bord: 'rgba(0,0,0,.12)' };
    const haut = losange(tx, ty, taille, elev), bas = losange(tx, ty, taille, 0);
    const table = svg('g', { class: 'table' },
      svg('polygon', { points: points([haut[3], haut[2], bas[2], bas[3]]), class: 'table-cote' }),
      svg('polygon', { points: points([haut[2], haut[1], bas[1], bas[2]]), class: 'table-cote-2' }),
      svg('polygon', { points: points(haut), class: 'table-dessus', stroke: col.bord, 'stroke-width': .8 }),
      // le portable : le clavier posé côté agent, l'écran ouvert vers lui ; on voit le dos argenté et son logo, qui prend la couleur de l'état
      svg('polygon', { points: points(losange(tx, ty - 1 - taille * .48, taille * .48, elev + .5)), class: 'portable-clavier' }),
      svg('path', { class: 'ecran', d: `M${tx - 7.5},${ty - elev - 1.5} L${tx + 7.5},${ty - elev - 1.5} L${tx + 6.6},${ty - elev - 13} L${tx - 6.6},${ty - elev - 13} Z` }),
      svg('circle', { class: 'ecran-lueur', cx: tx, cy: ty - elev - 7.4, r: 1.9 }),
      ...accessoires(tx, ty, taille, elev, cle)
    );
    return [perso, table];
  }
  function statAr(x, y, valeur, mot, classeNombre, cle) {
    const n = texteLatin(x, y, valeur, 'plaque-nombre ' + classeNombre);
    const m = texteArabe(x, y + 11, mot, 'plaque-mot');
    if (cle) n.dataset.cle = cle;
    return [n, m];
  }
  function ilotDepartement(d, x, y, s) {
    const col = couleurs(d.couleur);
    const g = svg('g', { class: 'ilot', 'data-dept': d.id, tabindex: 0, role: 'button', 'aria-label': d.nomAr + ' — ' + d.nom });
    g.append(svg('title', { text: d.role }));
    g.append(...bloc(x, y, s, 14, col, 'ilot-dessus'));
    // le titre au-dessus de l'îlot
    g.append(texteLatin(x, y - s - 27, d.nom, 'titre-lat'), texteArabe(x, y - s - 8, d.nomAr, 'titre-ar'));
    // les postes : une rangée le long de l'axe horizontal de l'îlot
    const postes = d.postes || [];
    const pas = postes.length >= 4 ? 84 : 100;
    const x0 = x - (postes.length - 1) * pas / 2;
    postes.forEach((p, i) => {
      const px = x0 + i * pas, py = y - 4;
      const gp = svg('g', { class: 'poste', 'data-dept': d.id, 'data-poste': p.id, 'data-etat': 'libre' });
      gp.append(svg('title', { text: p.nom + ' — ' + p.nomAr + ' : ' + p.role }));
      gp.append(...tableEtPersonnage(px, py, 11, { cle: d.id + '/' + p.id }));
      gp.append(etiquettePoste(px, py + 15, p, pas - 4));
      g.append(gp);
      etat.noeuds.postes.set(d.id + '/' + p.id, gp);
      etat.noeuds.coords.set(d.id + '/' + p.id, { x: px, y: py + 6 });
    });
    // la plaque des comptes, accrochée au coin du bas
    const largeur = 186, hauteur = 34, px = x - largeur / 2, py = y + s - 6;
    g.append(svg('rect', { class: 'plaque', x: px, y: py, width: largeur, height: hauteur, rx: 8 }));
    g.append(svg('rect', { x: px, y: py, width: 6, height: hauteur, rx: 3, fill: d.couleur }));
    const c = x, dx = 56;
    const nPostes = statAr(c + dx, py + 15, String(postes.length), 'البوسط', 'postes');
    const nEncours = statAr(c, py + 15, '0', 'راهي تخدم', 'encours', 'encours');
    const nFini = statAr(c - dx, py + 15, '0', 'كملات', 'fini', 'fini');
    g.append(...nPostes, ...nEncours, ...nFini);
    etat.noeuds.plaques.set(d.id, { encours: nEncours[0], fini: nFini[0] });
    return g;
  }
  function ilotCentre(x, y, s) {
    const B = etat.bureau, col = couleurs('#b8a48c');
    const g = svg('g', { class: 'ilot centre', 'data-dept': 'manager' });
    g.append(...bloc(x, y, s, 14, col, 'ilot-dessus'));
    // le carnet : un grand cahier ouvert, collé au manager (à sa gauche sur l'écran)
    const cx = x - 46, cy = y + 4, U = 46, V = 28, h = 4;
    const page = (u1, u2) => points([iso(cx, cy, u1, -V, h), iso(cx, cy, u2, -V, h), iso(cx, cy, u2, V, h), iso(cx, cy, u1, V, h)]);
    const carnet = svg('g', { class: 'carnet', tabindex: 0, role: 'button', 'aria-label': B.cerveau.nomAr });
    carnet.append(svg('title', { text: B.cerveau.role }));
    carnet.append(svg('polygon', { points: points([iso(cx, cy, -U, -V, 0), iso(cx, cy, U, -V, 0), iso(cx, cy, U, V, 0), iso(cx, cy, -U, V, 0)]), class: 'carnet-dos' }));
    carnet.append(svg('polygon', { points: page(-U, 0), class: 'carnet-page' }));
    carnet.append(svg('polygon', { points: page(0, U), class: 'carnet-page' }));
    for (let i = -V + 6; i < V; i += 6) {
      const a = iso(cx, cy, -U + 5, i, h), b = iso(cx, cy, -5, i, h), c2 = iso(cx, cy, 5, i, h), d2 = iso(cx, cy, U - 5, i, h);
      carnet.append(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'carnet-ligne' }), svg('line', { x1: c2[0], y1: c2[1], x2: d2[0], y2: d2[1], class: 'carnet-ligne' }));
    }
    const r1 = iso(cx, cy, U - 8, -V, h), r2 = iso(cx, cy, U - 8, V + 10, h);
    carnet.append(svg('line', { x1: r1[0], y1: r1[1], x2: r2[0], y2: r2[1], class: 'carnet-ruban', stroke: 'currentColor', 'stroke-width': 3, style: 'color: var(--rouge)' }));
    const basDuLivre = iso(cx, cy, U, V, 0); // le point le plus bas du cahier à l'écran
    carnet.append(texteArabe(cx - 18, basDuLivre[1] + 15, B.cerveau.nomAr, 'titre-ar'), texteLatin(cx - 18, basDuLivre[1] + 27, B.cerveau.nom, 'titre-lat'));
    const haut = iso(cx, cy, -U, -V, h); // le point le plus haut du cahier
    carnet.append(...statAr(cx + 6, haut[1] - 14, '0', 'النوطات', '', 'notes'), ...statAr(cx - 50, haut[1] - 14, '0', 'المنتوجات', '', 'produits'));
    carnet.addEventListener('click', e => { e.stopPropagation(); ouvrirOnglet('carnet', { defiler: true }); });
    carnet.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); ouvrirOnglet('carnet', { defiler: true }); } });
    // le manager
    const mx = x + 30, my = y + 50; // le manager devant, pour laisser la place au bureau de Rim à côté du Boss
    const manager = svg('g', { class: 'manager poste', 'data-dept': 'manager', 'data-poste': 'manager', 'data-etat': 'libre', tabindex: 0, role: 'button', 'aria-label': B.centre.nomAr });
    manager.append(svg('title', { text: B.centre.role }));
    manager.append(...tableEtPersonnage(mx, my, 15, { manager: true, cle: 'manager/manager' }));
    manager.append(texteArabe(mx + 62, my - 40, B.centre.nomAr, 'titre-ar'), texteLatin(mx + 62, my - 28, B.centre.nom, 'titre-lat')); // sur le dessus, à sa droite
    manager.addEventListener('click', e => { e.stopPropagation(); ouvrirFiche('manager'); });
    manager.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); ouvrirFiche('manager'); } });
    // le Boss : gros, costume noir, lunettes noires, dans son fauteuil de PDG, juste derrière le manager
    const bx = x + 18, by = y - 44;
    const boss = tableBoss(bx, by);
    etat.noeuds.bossPersonne = boss.querySelector('.boss-personne');
    etat.noeuds.coords.set('boss', { x: bx, y: by + 6 });
    // le bureau de Rim, à droite du Boss, derrière le manager : sa chaise est vide tant qu'elle se promène
    const rx = x + 82, ry = y - 28;
    const gRim = svg('g', { class: 'poste poste-rim', 'data-dept': 'rim', 'data-poste': 'rim', 'data-etat': 'libre' });
    gRim.append(...tableEtPersonnage(rx, ry, 11, { cle: 'rim' }));
    gRim.querySelector('.personnage').style.opacity = belle.mode === 'assise' ? '' : '0';
    etat.noeuds.postes.set('rim', gRim); etat.noeuds.coords.set('rim', { x: rx, y: ry + 6 });
    g.append(carnet, boss, gRim, manager);
    etat.noeuds.postes.set('manager/manager', manager);
    etat.noeuds.coords.set('manager/manager', { x: mx - 22, y: my + 12 });
    etat.noeuds.coords.set('carnet', { x: cx, y: cy + 30 });
    return g;
  }
  function ilotTelegram(x, y, s) {
    const R = etat.bureau.reception, col = couleurs('#4f9cc9');
    const g = svg('g', { class: 'ilot telegram', 'data-dept': 'telegram', tabindex: 0, role: 'button', 'aria-label': R.nomAr });
    g.append(svg('title', { text: R.role }));
    g.append(...bloc(x, y, s, 12, col, 'ilot-dessus'));
    // le comptoir de la réception : un long bloc le long de l'axe u, décalé à gauche pour laisser la place au compteur
    const cU = 34, cV = 9, e = 16, kx = x - 18, ky = y - 2;
    // le réceptionniste, assis derrière le comptoir (dessiné avant le comptoir pour être caché par lui) ; il lève la main quand une question attend
    const recep = svg('g', { class: 'poste receptionniste', 'data-dept': 'telegram', 'data-poste': 'telegram', 'data-etat': 'libre' });
    recep.append(tableEtPersonnage(kx + 8, ky - 8, 9, { cle: 'telegram' })[0]);
    g.append(recep);
    const hautC = [iso(kx, ky, -cU, -cV, e), iso(kx, ky, cU, -cV, e), iso(kx, ky, cU, cV, e), iso(kx, ky, -cU, cV, e)];
    const basC = [iso(kx, ky, -cU, -cV, 0), iso(kx, ky, cU, -cV, 0), iso(kx, ky, cU, cV, 0), iso(kx, ky, -cU, cV, 0)];
    g.append(svg('polygon', { points: points([hautC[3], hautC[2], basC[2], basC[3]]), class: 'table-cote' }), svg('polygon', { points: points([hautC[2], hautC[1], basC[1], basC[2]]), class: 'table-cote-2' }), svg('polygon', { points: points(hautC), class: 'table-dessus' }));
    // l'avion en papier sur un disque, posé à gauche du comptoir ; le point d'état à côté
    const ax = x - 66, ay = y + 4;
    g.append(svg('circle', { cx: ax, cy: ay, r: 13, fill: '#2f8fcf' }), svg('path', { class: 'avion', d: `M${ax - 7},${ay - 1} l14,-5 l-5,13 l-3,-5 z M${ax - 1},${ay + 2} l3,5 l-3,-1 z` }));
    g.append(svg('circle', { class: 'telegram-point', cx: ax + 15, cy: ay - 11, r: 4.5 }));
    g.append(texteArabe(x, y + s + 24, R.nomAr, 'titre-ar'), texteLatin(x, y + s + 37, R.nom, 'titre-lat'));
    const q = texteLatin(x + 58, y + 8, '0', 'plaque-nombre'); q.dataset.cle = 'questions';
    g.append(q, texteArabe(x + 58, y + 19, 'أسئلة مفتوحة', 'plaque-mot'));
    etat.noeuds.coords.set('telegram', { x: x + 20, y: y - 4 });
    etat.noeuds.telegram = { point: g.querySelector('.telegram-point'), questions: q, recep };
    return g;
  }
  function porteSortie(x, y) {
    return svg('g', { class: 'porte', 'pointer-events': 'none' },
      svg('rect', { x: x - 17, y: y - 78, width: 34, height: 78, rx: 2, class: 'porte-cadre' }),
      svg('rect', { x: x - 14, y: y - 74, width: 28, height: 74, class: 'porte-bois' }),
      svg('circle', { cx: x + 8, cy: y - 36, r: 2, class: 'porte-poignee' }),
      svg('rect', { x: x - 20, y: y - 98, width: 40, height: 12, rx: 2, class: 'porte-panneau' }),
      svg('text', { x, y: y - 89.5, class: 'porte-texte', 'text-anchor': 'middle', direction: 'rtl', text: 'خروج' }));
  }
  function coinCafe(x, y) {
    const g = svg('g', { class: 'coin-cafe', 'pointer-events': 'none' });
    const haut = losange(x, y, 15, 15), bas = losange(x, y, 15, 0);
    g.append(svg('polygon', { points: points([haut[3], haut[2], bas[2], bas[3]]), class: 'table-cote' }),
      svg('polygon', { points: points([haut[2], haut[1], bas[1], bas[2]]), class: 'table-cote-2' }),
      svg('polygon', { points: points(haut), class: 'table-dessus' }),
      svg('rect', { x: x - 9, y: y - 37, width: 13, height: 17, rx: 2, class: 'cafe-machine' }),   // la machine à café
      svg('rect', { x: x - 6.5, y: y - 34, width: 8, height: 4, rx: 1, class: 'cafe-ecran' }),
      svg('rect', { x: x - 4.5, y: y - 24, width: 4, height: 4, rx: .8, class: 'cafe-tasse' }),
      svg('ellipse', { cx: x + 10, cy: y - 18, rx: 6, ry: 2.4, class: 'cafe-assiette' }),          // l'assiette des gâteaux
      svg('circle', { cx: x + 8, cy: y - 19.5, r: 1.8, class: 'cafe-gateau' }), svg('circle', { cx: x + 12, cy: y - 19.5, r: 1.8, class: 'cafe-gateau' }),
      texteArabe(x, y + 26, 'القهوة', 'titre-ar petit'));
    return g;
  }
  function camera(x, y, angle) {
    return svg('g', { class: 'camera', transform: `translate(${x},${y})`, 'pointer-events': 'none' },
      svg('circle', { r: 6, class: 'camera-support' }),
      svg('g', { transform: `rotate(${angle.toFixed(1)})` },
        svg('g', { class: 'camera-balayage' },
          svg('path', { d: 'M34,0 L230,-62 Q246,0 230,62 Z', class: 'camera-cone' }),
          svg('rect', { x: 0, y: -2, width: 10, height: 4, class: 'camera-bras' }),
          svg('rect', { x: 8, y: -7, width: 24, height: 14, rx: 3, class: 'camera-corps' }),
          svg('rect', { x: 30, y: -5, width: 5, height: 10, rx: 1.5, class: 'camera-objectif' }),
          svg('circle', { cx: 13, cy: -3, r: 1.8, class: 'camera-led' }))),
      svg('text', { x: 0, y: 20, class: 'camera-rec', 'text-anchor': 'middle', direction: 'ltr', text: '● REC' }));
  }
  function tableBoss(bx, by) {
    const peau = '#e2b38a', costume = '#151515', taille = 16, elev = 16;
    const base = by - taille - 11, l = 18, hc = 18, rt = 11; // assis plus haut que les autres : on voit son ventre au-dessus du bureau
    const ty0 = base - hc - rt + 5; // centre de la tête
    const g = svg('g', { class: 'boss', 'aria-label': 'Le Boss' });
    g.append(svg('title', { text: 'Le Boss — le manager et Shikem Pro Max viennent lui rendre compte' }));
    // le fauteuil de PDG : un grand dossier de cuir capitonné qui dépasse derrière lui
    g.append(svg('rect', { x: bx - 21, y: ty0 - 22, width: 42, height: 54, rx: 11, class: 'boss-fauteuil' }));
    for (const [dx, dy] of [[-10, -12], [0, -12], [10, -12], [-10, -2], [10, -2]]) g.append(svg('circle', { cx: bx + dx, cy: ty0 + dy, r: 1.3, class: 'boss-capiton' }));
    const personne = svg('g', { class: 'boss-personne' }); g.append(personne);
    // le corps : large (il est gros), veste noire, chemise blanche, cravate rouge, bras posés
    personne.append(svg('path', { d: `M${bx - l - 6},${base} q-2,-${hc} 8,-${hc + 3} h${2 * l - 4} q10,3 8,${hc + 3} z`, fill: costume }));
    personne.append(svg('ellipse', { cx: bx, cy: base - 2, rx: l + 5, ry: 9, fill: costume }));            // le gros ventre
    personne.append(svg('path', { d: `M${bx - 3},${base - 10} q3,8 6,0 v-${hc - 9} h-6 z`, fill: '#f4f4f4' })); // la chemise tendue sur le ventre
    personne.append(svg('path', { d: `M${bx - 5},${base - hc - 2} l5,9 l5,-9 z`, fill: '#ffffff' }));
    personne.append(svg('path', { d: `M${bx - 1.6},${base - hc + 1} h3.2 l1,11 l-2.6,3 l-2.6,-3 z`, fill: '#c0182a' }));
    personne.append(svg('rect', { x: bx - 3, y: ty0 + rt - 3, width: 6, height: 5, fill: peau }));
    // la tête : ronde et large, joues, peu de cheveux, lunettes noires, moustache
    personne.append(svg('ellipse', { cx: bx, cy: ty0 + rt - 1.5, rx: rt - 1, ry: 4, fill: '#cf9d74' })); // le double menton
    personne.append(svg('ellipse', { cx: bx, cy: ty0, rx: rt + 2, ry: rt, fill: peau }));
    personne.append(svg('path', { d: `M${bx - rt - 1},${ty0 - 2} q1,-${rt - 1} ${rt + 1},-${rt - .5} q${rt},.5 ${rt + 1},${rt - 1} q-2,-4 -5,-5 q-4,-2 -${rt + 3},0 q-3,1.5 -4,5 z`, fill: '#2a2a2a' }));
    personne.append(svg('rect', { x: bx - 9, y: ty0 - 2.5, width: 7.5, height: 4.6, rx: 1.6, fill: '#0b0b0b' }), svg('rect', { x: bx + 1.5, y: ty0 - 2.5, width: 7.5, height: 4.6, rx: 1.6, fill: '#0b0b0b' }), svg('line', { x1: bx - 1.5, y1: ty0 - 1.2, x2: bx + 1.5, y2: ty0 - 1.2, stroke: '#0b0b0b', 'stroke-width': 1 }));
    personne.append(svg('path', { d: `M${bx - 4.5},${ty0 + 4.4} q4.5,-2.4 9,0 q-4.5,1.2 -9,0 z`, fill: '#3a2a20' }));
    // le bureau, plus grand que les autres, avec la plaque dorée
    const haut = losange(bx, by, taille, elev), bas = losange(bx, by, taille, 0);
    g.append(svg('polygon', { points: points([haut[3], haut[2], bas[2], bas[3]]), class: 'boss-bureau-cote' }),
      svg('polygon', { points: points([haut[2], haut[1], bas[1], bas[2]]), class: 'boss-bureau-cote-2' }),
      svg('polygon', { points: points(haut), class: 'boss-bureau-dessus' }),
      svg('rect', { x: bx - 12, y: by - elev - 4, width: 24, height: 8, rx: 2, class: 'boss-plaque' }),
      svg('text', { x: bx, y: by - elev + 2.3, class: 'boss-plaque-texte', 'text-anchor': 'middle', direction: 'ltr', text: 'BOSS' }));
    const nom = etiquetteNom(bx, ty0 - rt - 3, { nom: 'Le Boss', latin: true }); nom.classList.add('nom-boss');
    personne.append(nom);
    return g;
  }
  /** 0 = la mise en page d'origine, 1 = la plus haute. Même borne que le max-height CSS du SVG ; en téléphone la scène suit son contenu : on n'agrandit pas. */
  function grandeurVoulue(sc) {
    if (telephone()) return 0;
    const hautH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--haut-h')) || 56;
    const h = Math.min(sc.clientHeight || 0, innerHeight - hautH - 70);
    return Math.max(0, Math.min(1, (1240 * h / (sc.clientWidth || 900) - 796) / (1160 - 796)));
  }
  function construireBureau() {
    const scene = $('#scene');
    const largeurScene = scene.clientWidth || 900;
    const anneau = largeurScene >= 640;
    etat.mode = anneau ? 'anneau' : 'colonne';
    etat.noeuds = { postes: new Map(), plaques: new Map(), fils: new Map(), coords: new Map() };
    const B = etat.bureau;
    const depts = [...B.departements].sort((a, b) => a.ordre - b.ordre);
    let S = 100, ST = 60;
    const pos = {}; let W, H;
    if (anneau) {
      // Le bureau prend toute la hauteur libre : plus la zone est haute par rapport à sa largeur, plus les îlots grandissent et s'écartent
      // (k = 0 : la mise en page d'origine 1240 × 796 ; k = 1 : 1240 × 1160, îlots un quart plus grands).
      const k = grandeurVoulue(scene);
      etat.grandeur = Math.round(k * 10);
      W = 1240; H = Math.round(796 + (1160 - 796) * k); S = 100 + 24 * k; ST = 60 + 10 * k;
      const cx = 620, cy = 425 + 160 * k, rx = 400, ry = 280 + 130 * k;
      // 1 en bas à droite, puis dans le sens de la lecture arabe (droite → gauche), 5 en bas à gauche
      // 0.4.0 : six îlots (l'inspecteur à gauche, côté porte) → un hexagone ; cinq îlots : l'anneau d'origine
      const angles = depts.length > 5 ? [60, 0, -60, -120, 120, 180] : [30, -30, -90, -150, 150];
      depts.forEach((d, i) => { const a = angles[i % angles.length] * Math.PI / 180; pos[d.id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });
      pos.centre = { x: cx, y: cy }; pos.telegram = { x: cx, y: cy + 255 + 150 * k };
      // 0.4.0 : avec six îlots, les deux du bas descendent : Telegram passe dessous, la scène s'allonge
      if (depts.length > 5) { pos.telegram = { x: cx, y: cy + ry + 100 }; H += 120; }
    } else {
      W = 440;
      const pas = 282;
      pos.centre = { x: 220, y: 176 };
      depts.forEach((d, i) => { pos[d.id] = { x: 220 + (i % 2 ? -16 : 16), y: 176 + pas * (i + 1) }; });
      pos.telegram = { x: 220, y: 176 + pas * depts.length + 230 };
      H = pos.telegram.y + ST + 60;
    }
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: anneau ? 'svg-anneau' : 'svg-colonne', 'aria-label': 'المكتب' });
    const defs = svg('defs', {}, svg('pattern', { id: 'grille', width: 40, height: 20, patternUnits: 'userSpaceOnUse' }, svg('path', { d: 'M0,0 L40,20 M0,20 L40,0', class: 'sol-grille', fill: 'none' })));
    s.append(defs);
    s.append(svg('rect', { x: 6, y: 6, width: W - 12, height: H - 12, rx: 28, class: 'sol' }), svg('rect', { x: 6, y: 6, width: W - 12, height: H - 12, rx: 28, fill: 'url(#grille)', opacity: .55 }));
    // les fils : de chaque îlot vers le carnet
    const carnetX = pos.centre.x - 46, carnetY = pos.centre.y + 4;
    for (const d of depts) {
      const p = pos[d.id];
      const mx = (p.x + carnetX) / 2 + (p.y - carnetY) * 0.18, my = (p.y + carnetY) / 2 - (p.x - carnetX) * 0.18;
      const fil = svg('path', { class: 'fil', 'data-dept': d.id, d: `M${p.x},${p.y} Q${mx},${my} ${carnetX},${carnetY}` });
      s.append(fil); etat.noeuds.fils.set(d.id, fil);
    }
    s.append(svg('path', { class: 'fil', d: `M${pos.telegram.x},${pos.telegram.y} L${pos.centre.x + 30},${pos.centre.y + 50}` }));
    // l'ordre de dessin : du fond vers l'avant (y croissant), pour que l'îlot devant recouvre celui de derrière
    const ilots = [];
    for (const d of depts) ilots.push({ y: pos[d.id].y, g: ilotDepartement(d, pos[d.id].x, pos[d.id].y, S) });
    ilots.push({ y: pos.centre.y, g: ilotCentre(pos.centre.x, pos.centre.y, S) });
    ilots.push({ y: pos.telegram.y, g: ilotTelegram(pos.telegram.x, pos.telegram.y, ST) });
    ilots.sort((a, b) => a.y - b.y);
    for (const i of ilots) s.append(i.g);
    // les caméras de surveillance, une à chaque coin, tournées vers le centre ; elles balaient lentement et la lumière rouge clignote
    for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) {
      const ty = y < H / 2 ? Math.min(H / 2, y + W / 2 - 34) : Math.max(H / 2, y - (W / 2 - 34)); // en colonne, viser pas plus loin que la largeur
      s.append(camera(x, y, Math.atan2(ty - y, W / 2 - x) * 180 / Math.PI));
    }
    if (anneau) { const kx = pos.telegram.x + 230, ky = pos.telegram.y + 40; s.append(coinCafe(kx, ky)); etat.noeuds.coords.set('cuisine', { x: kx, y: ky + 6 }); }
    if (anneau) { const px = 46, py = pos.centre.y + 6; s.append(porteSortie(px, py)); etat.noeuds.coords.set('sortie', { x: px, y: py - 2 }); } // la porte : ceux qui sont renvoyés sortent par là, les nouveaux entrent par là
    etat.noeuds.badges = svg('g', { class: 'badges', 'pointer-events': 'none' }); s.append(etat.noeuds.badges);
    etat.noeuds.marcheurs = svg('g', { class: 'marcheurs', 'pointer-events': 'none' }); s.append(etat.noeuds.marcheurs);
    dessinerAvertissements();
    scene.innerHTML = ''; scene.append(s);
    ajusterEtiquettes(s);
    // clics
    s.addEventListener('click', e => {
      const ilot = e.target.closest('.ilot'); if (!ilot) return;
      const id = ilot.dataset.dept;
      if (id === 'telegram') ouvrirTelegram();
      else if (id === 'manager') ouvrirFiche('manager');
      else if (dept(id)?.voix) ouvrirOnglet('coach', { defiler: true });
      else ouvrirFiche(id);
    });
    s.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const ilot = e.target.closest('.ilot'); if (!ilot || e.target !== ilot) return;
      e.preventDefault(); ilot.click();
    });
    majBureau();
  }
  /* ===================== les agents qui marchent ===================== */
  // Chaque changement d'état d'une vraie tâche fait marcher un petit agent entre deux points du bureau :
  // nouvelle tâche → le manager porte le dossier au poste ; attente → le poste va à Telegram ; fini/échec → le poste dépose au carnet.
  const MOUVEMENT_REDUIT = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const etatsVus = new Map(); let premierPassage = true;
  const enMarche = new Set();
  const hasard = l => l[Math.floor(Math.random() * l.length)];
  // Un humain vu de profil, qui regarde vers +x : cheveux, visage, cou, chemise, bras et jambes articulés (hanche, genou, épaule, coude), chaussures.
  // Chaque articulation est un groupe placé au bon endroit, et c'est le groupe intérieur qui tourne autour de (0,0) : l'animation ne dépend d'aucune origine CSS.
  const PEAUX = ['#f1c9a5', '#e0ac7e', '#c68b5c', '#a8714a', '#8a5a3a'], CHEVEUX = ['#2b1d14', '#4a3020', '#1b1b1b', '#6b4a2b', '#3a2a22'], PANTALONS = ['#2f3b52', '#3b3b3b', '#4a4036', '#24324a', '#5a4a3a'];
  function humain(chemise, dossier, id = identite('anonyme/' + Math.random())) {
    const { peau, cheveux, pantalon, femme, belle: tenueRose, boss: gros } = id;
    const art = (x, y, classe, ...enfants) => svg('g', { transform: `translate(${x},${y})` }, svg('g', { class: classe }, ...enfants));
    const jambe = (cote) => art(0, -19, 'cuisse ' + cote,
      svg('path', { d: tenueRose ? 'M-2,0 h4 l-.4,9.6 h-3.2 z' : 'M-2.4,0 h4.8 l-.4,9.6 h-4 z', fill: tenueRose ? peau : pantalon }),
      art(0, 9.4, 'tibia ' + cote,
        svg('path', { d: tenueRose ? 'M-1.6,0 h3.2 l-.3,8.6 h-2.6 z' : 'M-2,0 h4 l-.3,8.6 h-3.4 z', fill: tenueRose ? peau : pantalon }),
        tenueRose ? svg('path', { d: 'M-1.6,8.2 h3.4 q2.8,0 2.8,1.9 h-4.4 v1.4 h-1 v-1.4 h-.8 z', fill: '#ff3d8b' }) // l'escarpin rose
                  : svg('path', { d: 'M-2.2,8.2 h4.4 q3.6,0 3.6,2.2 h-8 z', fill: '#1d1d1d' })));
    const bras = (cote) => art(0, -32.5, 'epaule ' + cote,
      svg('path', { d: 'M-1.9,0 h3.8 l-.3,7.4 h-3.2 z', fill: chemise }),
      art(0, 7, 'coude ' + cote,
        svg('path', { d: 'M-1.5,0 h3 l-.2,6 h-2.6 z', fill: peau }),
        svg('circle', { cx: 0, cy: 6.6, r: 1.7, fill: peau }),
        id.halab && cote === 'devant' ? svg('rect', { x: -1.8, y: 3.8, width: 3.6, height: 1.6, rx: .5, fill: '#d4af37', stroke: '#6b5310', 'stroke-width': .3 }) : null)); // la montre
    const tete = svg('g', { class: 'tete-humain' },
      svg('rect', { x: -1.6, y: -37.5, width: 3.2, height: 3.5, fill: peau }),
      svg('ellipse', { cx: .4, cy: -42, rx: 5, ry: 5.6, fill: peau }),
      svg('path', { d: 'M5.2,-42.6 l1.6,1.6 l-1.5,.5 z', fill: peau }), // le nez
      svg('circle', { cx: 2.9, cy: -43, r: .7, fill: '#222' }),           // l'œil
      svg('path', { d: femme ? 'M-5.2,-41 q-1,-7.5 5.4,-7 q4.6,.3 5,3.6 q-3.4,-1.6 -6.6,0 l-1.2,4 q-.6,5 -2.8,10 q-1.6,-5 .2,-10.6 z' : 'M-5,-42 q-.4,-6.6 5.4,-6.4 q4.2,.2 4.8,3.4 q-3.6,-1.2 -6.8,.4 l-1.4,3.4 z', fill: cheveux }),
      tenueRose ? svg('path', { d: 'M-5.2,-39 q-1.4,7 -.6,13 q2,-1.2 2.6,-5 q.2,-4 -.4,-8 z', fill: cheveux }) : null,                        // les cheveux longs dans le dos
      tenueRose ? svg('path', { d: 'M2.2,-44.2 l1.8,-.7 M2.6,-43.8 l1.6,.1', stroke: '#222', 'stroke-width': .5, fill: 'none' }) : null, // les cils
      tenueRose ? svg('ellipse', { cx: 4.3, cy: -39.4, rx: 1, ry: .55, fill: '#e2245e' }) : null,
      id.halab ? svg('g', {}, svg('rect', { x: 1, y: -44.6, width: 5.6, height: 2.8, rx: 1.1, fill: 'rgba(226,27,60,.85)', stroke: '#9e0f26', 'stroke-width': .4 }), svg('line', { x1: -3.6, y1: -43.6, x2: 1.2, y2: -43.4, stroke: '#e21b3c', 'stroke-width': .7 })) : null, // les lunettes rouges
      gros ? svg('g', {}, svg('rect', { x: 1.2, y: -44.4, width: 5.2, height: 2.6, rx: 1, fill: '#0d0d0d' }), svg('line', { x1: -3.6, y1: -43.4, x2: 1.4, y2: -43.2, stroke: '#0d0d0d', 'stroke-width': .7 }), svg('path', { d: 'M2.4,-40.4 q1.6,-1 3.2,0 q-1.6,.6 -3.2,0 z', fill: '#3a2a20' }), svg('ellipse', { cx: .6, cy: -37.6, rx: 3.6, ry: 1.4, fill: '#cf9d74' })) : null, // lunettes, moustache, double menton
      id.espion ? svg('g', {}, svg('rect', { x: 1.2, y: -44.4, width: 5.2, height: 2.6, rx: 1, fill: '#0d0d0d' }), svg('line', { x1: -3.6, y1: -43.4, x2: 1.4, y2: -43.2, stroke: '#0d0d0d', 'stroke-width': .7 }),
        svg('path', { d: 'M1,-40.4 h3.6 q-.2,2.6 -1.9,2.6 q-1.6,0 -1.7,-2.6 z', fill: '#3a0d0d' }),  // la bouche ouverte
        svg('rect', { x: 1.3, y: -40.4, width: 1, height: 1.4, fill: '#fff8e6' }),                     // une dent entière
        svg('rect', { x: 3.3, y: -40.4, width: .9, height: .7, fill: '#fff8e6' })) : null); // une dent cassée et le trou noir entre les deux ; les lunettes noires
    const torse = gros ? svg('path', { d: 'M-5.8,-34.6 q5.8,-2 11.6,0 l1.8,7.2 q1.8,6 -1.2,8.6 h-12.8 q-3,-2.6 -1.2,-8.6 z', fill: chemise }) : svg('path', { d: tenueRose ? 'M-3.8,-34.5 q3.8,-1.6 7.6,0 l-.6,8 q.4,4 -.2,7.8 h-6.4 q-.6,-3.8 -.2,-7.8 z' : 'M-4.2,-34.5 q4.2,-1.8 8.4,0 l-.4,15.8 h-7.6 z', fill: chemise });
    const ceinture = gros
      ? svg('g', {}, svg('path', { d: 'M-1.8,-34.7 l1.8,4 l1.8,-4 z', fill: '#ffffff' }), svg('path', { d: 'M-.6,-33.4 h1.2 l.6,5.2 l-1.2,1.4 l-1.2,-1.4 z', fill: '#c0182a' }), svg('rect', { x: -6, y: -20.6, width: 12, height: 1.6, fill: '#000' }))
      : tenueRose
      ? svg('g', {}, svg('path', { d: 'M.6,-34.6 l2.2,4.6 l1.2,-4.4 z', fill: peau }),        // le décolleté
                     svg('path', { d: 'M-3.9,-21.2 h7.8 l2.6,7.6 h-13 z', fill: '#ff3d8b' })) // la mini-jupe
      : svg('rect', { x: -3.8, y: -20.4, width: 7.6, height: 1.6, fill: '#1f1f1f' });
    const doc = dossier ? art(0, -32.5, 'epaule devant porte', svg('path', { d: 'M-1.9,0 h3.8 l2.4,6.4 h-3.4 z', fill: chemise }), svg('rect', { class: 'dossier', x: 1.5, y: 3, width: 8, height: 10.5, rx: 1 })) : bras('devant');
    // le groupe extérieur reçoit le scale(±1.5) (taille et sens) ; le groupe .humain garde l'animation de rebond : les deux ne s'écrasent plus
    return svg('g', {}, svg('g', { class: 'humain' },
      svg('ellipse', { class: 'ombre', cx: 0, cy: 0, rx: 9, ry: 3 }),
      svg('g', { class: 'derriere' }, bras('derriere'), jambe('derriere')),
      svg('g', { class: 'buste' }, jambe('devant'), torse, ceinture, tete, doc)));
  }
  function marcher(de, vers, { couleur = 'var(--vert)', dossier = true, retour = false, pause = 0, decalage = null, arrive = null, repart = null, qui: quiForce = null, assis: assisForce = null } = {}) {
    const C = etat.noeuds.coords, couche = etat.noeuds.marcheurs;
    const a = C.get(de), b0 = C.get(vers);
    if (!a || !b0 || !couche || MOUVEMENT_REDUIT || enMarche.has(de)) return false;
    const b = decalage ? { x: b0.x + decalage.x, y: b0.y + decalage.y } : b0; // s'arrêter À CÔTÉ de quelqu'un, pas sur sa table
    // il se lève : sa chaise reste vide jusqu'à son retour
    const assis = assisForce || etat.noeuds.postes.get(de)?.querySelector('.personnage');
    enMarche.add(de); if (assis) assis.style.opacity = '0';
    const rasseoir = () => { enMarche.delete(de); if (assis) assis.style.opacity = ''; };
    const g = svg('g', { class: 'marcheur' });
    const qui = quiForce || identite(de === 'carnet' ? 'anonyme/' + Math.random() : de);
    const corpsMarcheur = humain(couleur, dossier, qui);
    const etiq = etiquetteNom(0, -78, qui); if (qui.boss) etiq.classList.add('nom-boss');
    g.append(corpsMarcheur, etiq); // le nom flotte au-dessus de sa tête et ne se retourne pas
    couche.append(g);
    const dist = Math.hypot(b.x - a.x, b.y - a.y), duree = Math.max(3200, dist * 24);
    const demi = duree / 2, total = retour ? duree + pause : duree;
    let t0 = null, arreteVu = false, repartiVu = false;
    const pas = now => {
      if (t0 === null) t0 = now;
      const t = now - t0;
      let kk, versLaFin; // kk = position sur le trajet (0 = départ, 1 = arrivée) ; versLaFin = il marche vers b
      if (!retour) { kk = Math.min(1, t / duree); versLaFin = true; }
      else if (t < demi) { kk = t / demi; versLaFin = true; }
      else if (t < demi + pause) { kk = 1; versLaFin = true; }
      else { kk = Math.max(0, 1 - (t - demi - pause) / demi); versLaFin = false; }
      const immobile = retour && pause && t >= demi && t < demi + pause;
      if (immobile && !arreteVu) { arreteVu = true; g.classList.add('arret'); arrive && arrive(g, b); }
      if (!immobile && arreteVu && !repartiVu) { repartiVu = true; g.classList.remove('arret'); repart && repart(); }
      const x = a.x + (b.x - a.x) * kk, y = a.y + (b.y - a.y) * kk;
      g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      // il regarde là où il va ; arrêté, il regarde son collègue
      const versLaGauche = versLaFin ? b.x < a.x : b.x > a.x;
      corpsMarcheur.setAttribute('transform', `scale(${(immobile ? b0.x < b.x : versLaGauche) ? -1.5 : 1.5},1.5)`);
      if (t < total && g.isConnected) requestAnimationFrame(pas); else { g.remove(); rasseoir(); if (!repartiVu) repart && repart(); }
    };
    requestAnimationFrame(pas);
    return true;
  }
  /* ===================== deux collègues qui discutent ===================== */
  // Toujours une discussion en cours : un agent va voir un collègue assis, ils parlent 30 s (bulles qui alternent), puis il revient.
  const REPLIQUES = ['شفت الكومندات تاع البارح ؟', 'الكارني راهو معمّر', 'نزيدو زاوية جديدة ؟', 'التيست راهو يمشي مليح', 'الصور واجدين للمونتاج', 'القائد قال نستناو شوية', 'واش قال القائد ؟', 'الليفريزون تاع وهران تأخرات', 'نشوفو الروتور مع بعض', 'صحّا، نكمّلو', 'الوصف لازم يتصحّح', 'الجمهور هذا خدم مليح', 'نستناو الكلمة تاعو قبل', 'الستوك باقي ولا كمل ؟', 'هاذي فكرة مليحة', 'إيه، صح', 'لا لا، نعاودو نشوفو', 'خلّيني نكمّل هذي ونجيك'];
  const DUREE_DISCUSSION = 30000;
  /* ----- le vrai travail : chaque agent dit ce qu'il a fait et ce qu'il lui faut, depuis les vraies tâches du bureau ----- */
  // Par défaut, le métier du poste (sa skill) ; dès qu'une vraie tâche existe, c'est elle qui parle (titre, état, contrôles).
  const TRAVAIL = {
    'editeur/trieur': { fait: 'نرتّب الرشز على حساب الموديل والمانكان واللون', besoin: 'اللينك تاع Drive تاع الشوتينغ' },
    'editeur/monteur': { fait: 'نمونتي الفيديوهات لكل مانكان، كل وحدة بموسيقى وحدها', besoin: 'الرشز مرتبين من عند الترتيب' },
    'editeur/photographe': { fait: 'نخرّج التصاور تاع الويب لكل لون', besoin: 'الصور الخام تاع الشوتينغ' },
    'editeur/verif-editeur': { fait: 'نعاود نشوف كل فيديو وكل تصويرة قبل ما نقول كملت', besoin: 'الفيديوهات من عند المونتور' },
    'page/sku': { fait: 'نحضّر SKU لكل لون ولكل مقاس', besoin: 'الألوان والمقاسات والستوك تاع كل مقاس' },
    'page/redacteur': { fait: 'نكتب الوصف بالزوايا، صورة ونص بالتناوب', besoin: 'الفيشة تاع المنتوج في الكارني' },
    'page/brouillon': { fait: 'نحط الصفحة في تاسيير وننشرها كي تكون واجدة', besoin: 'التصاور و الوصف' },
    'testing/porte': { fait: 'نحسب الباب تاع الربح قبل ما نصرفو حتى دورو', besoin: 'البوصلة باش نحسب الدراهم' },
    'testing/campagne': { fait: 'نحضّر الكامباني في ميتا وهي واقفة', besoin: 'الفيديوهات والنصوص تاع الزوايا' },
    'testing/textes': { fait: 'نجيب النصوص من الزوايا تاع الصفحة', besoin: 'الوصف من عند الصفحة' },
    'testing/surveillance': { fait: 'نتبع المصروف والكومندات المأكدة', besoin: 'الأرقام تاع ميتا وتاسيير' },
    'scaling/classement': { fait: 'نرتّب الزوايا على حساب الربح في كل كولي', besoin: 'الكوليات اللي تلفرو بالصح' },
    'scaling/audiences': { fait: 'نحضّر الجماهير، اللي ندخلوهم واللي نخرجوهم', besoin: 'الليستات تاع الكليان من تاسيير' },
    'scaling/budget': { fait: 'نحسب الميزانية على حساب الستوك', besoin: 'الستوك الحقيقي من تاسيير' },
    'coach/rapport': { fait: 'نكتب التقرير تاع اليوم للكليان', besoin: 'الأرقام تاع البارح من تاسيير' },
    'coach/porte-scaling': { fait: 'نشوف الشروط قبل ما نفتحو السكايل', besoin: 'التأكيد والليفريزون الحقيقيين' },
    'coach/questions': { fait: 'نجاوب الكليان على اللبسة بالميطود', besoin: 'السؤال تاع الكليان' },
    'coach/decisions': { fait: 'نكتب في الكارني واش قرر الكليان', besoin: 'الجواب تاع الكليان في تيليغرام' }
  };
  const court = t => { // jamais de chiffre dans une phrase arabe ; le titre est isolé (FSI…PDI) pour que « … » reste à sa place dans la bulle
    const x = String(t || '').replace(/[0-9٠-٩]+/g, '').replace(/\s+/g, ' ').trim();
    return '\u2068' + ((x.length > 34 ? x.slice(0, 33).trimEnd() + '…' : x) || 'خدمة') + '\u2069';
  };
  const duJour = t => Date.now() - Date.parse(t.majLe || t.creeLe || 0) < UN_JOUR;
  const recent = (x, y) => Date.parse(y.majLe || y.creeLe || 0) - Date.parse(x.majLe || x.creeLe || 0);
  function connecteurActif(id) {
    if (etat.sante?.prefixes?.[id]) return true; // v0.3 : la sonde a trouvé le préfixe de ce connecteur chez le client
    return (etat.sante?.connecteurs || []).some(c => (c.id === id || String(c.id).replace(/^claude\.ai\s+/, '').replace(/\s+/g, '_') === id) && /^(connected|configur)/i.test(c.statut || ''));
  }
  function raisonEchec(t) {
    const c = t.controles || {};
    if (t.erreur) return 'الأداة طاحت';
    if (c.outil?.verdict === 'ECHEC') return 'الأداة لقات غلطة في الشكل';
    if (c.auditeur?.verdict === 'ECHEC') return 'المدقق لقى غلطة';
    if (c.source?.verdict === 'ECHEC') return 'ما كاين حتى مصدر';
    return 'كاين مشكل';
  }
  function travailDe(k) {
    const dept = k.split('/')[0], base = TRAVAIL[k] || { fait: 'نوزّع الخدمة على البلاطوات', besoin: 'خدمة ولا لينك من عند الكليان' };
    const d = (etat.bureau?.departements || []).find(x => x.id === dept);
    let fait = base.fait, besoin = 'يلزمني ' + base.besoin, objet = base.besoin;
    const manque = etat.sante && (d?.connecteurs || []).find(c => !connecteurActif(c));
    if (manque) { besoin = `يلزمني الكونيكتور ${manque} يتربط`; objet = `الكونيكتور ${manque}`; }
    const t = etat.taches.filter(x => x.departement + '/' + x.poste === k).sort(recent)[0];
    if (t) {
      const titre = court(t.titre);
      if (t.etat === 'encours') { fait = `راني نخدم على «${titre}»`; besoin = 'يلزمني غير شوية وقت، راني نقرا ونكتب'; objet = null; }
      else if (t.etat === 'attente') { fait = `كمّلت «${titre}» ${t.verdict === 'PASSE' ? 'وعدّات على الكونترولات' : 'بصح ما تأكدتش كامل'}`; besoin = t.approbation?.telegram?.envoye ? 'نستنى الكلمة تاع الكليان، السؤال راح في تيليغرام' : 'نستنى الكلمة تاع الكليان في الصفحة'; objet = null; }
      else if (t.etat === 'fini' && duJour(t)) { const refuse = t.approbation?.reponse === 'non' && !(t.approbation.note || '').trim(); fait = refuse ? `الكليان قال لا على «${titre}»` : t.note ? `كمّلت «${titre}» وراهي في الكارني` : `كمّلت «${titre}» بصح الكارني ما قبلهاش`; }
      else if (t.etat === 'echec' && duJour(t)) { fait = `«${titre}» ما عدّاتش : ${raisonEchec(t)}`; besoin = 'يلزمني الكليان يكتب «صحّح» ولا نعاودها'; objet = null; }
      else if (t.etat === 'afaire') { fait = `جاتني «${titre}»، راهي في الطابور`; }
    } else {
      // pas de tâche à ce poste : il attend peut-être un collègue de son îlot
      const td = etat.taches.filter(x => x.departement === dept && (x.etat === 'encours' || x.etat === 'attente') && x.poste).sort(recent)[0];
      if (td) {
        const coll = identite(td.departement + '/' + td.poste);
        besoin = td.etat === 'encours' ? `نستنى ${coll.nom} ${coll.femme ? 'تكمّل' : 'يكمّل'} «${court(td.titre)}» باش نبدا` : `نستناو الكلمة تاع الكليان على «${court(td.titre)}»`; objet = null;
      }
    }
    return { fait, besoin, objet };
  }
  function faitsGeneraux() {
    const sa = etat.sante || {}, T = etat.taches, l = [];
    if (T.some(t => t.etat === 'attente')) l.push('كاين خدمة تستنى كلمة الكليان');
    if (T.some(t => t.etat === 'echec' && duJour(t))) l.push('كاين خدمة ما عدّاتش الكونترولات، لازم تتصحّح');
    if (T.some(t => t.etat === 'encours')) l.push('كاين اللي راهو يخدم دروك، ما نقلقوهش');
    if (sa.telegram?.questionsOuvertes) l.push('كاين سؤال يستنى الجواب في تيليغرام');
    if (sa.telegram && !sa.telegram.configure) l.push('تيليغرام مازال ما تربطش');
    if (sa.notes) l.push('الكارني فيه نوطات، نقراوهم قبل ما نبداو');
    if (sa.produits === 0) l.push('ما كاين حتى فيشة منتوج في الكارني مازال');
    if (!sa.atelier) l.push('الأدوات تاع الأتيلي مازالت ما تربطتش');
    l.push('البوصلة هي اللي تحسب الدراهم، ما نحسبو حتى دورو بالراس');
    return l;
  }
  function dialogueTravail(de, vers) {
    const A = identite(de), B = identite(vers), ta = travailDe(de), tb = travailDe(vers);
    const l = [
      [0, `واش ${B.femme ? 'راكي دايرة' : 'راك داير'} ${B.nom} ؟`],
      [1, tb.fait],
      [0, `واش يلزمك باش ${B.femme ? 'تكمّلي' : 'تكمّل'} ؟`],
      [1, tb.besoin],
      [1, A.femme ? 'وانتي، واش راكي دايرة ؟' : 'وانت، واش راك داير ؟'],
      [0, ta.fait],
      [0, ta.besoin]
    ];
    const extra = faitsGeneraux();
    for (let i = 0; i < 2 && extra.length; i++) l.push([i % 2, extra.splice(Math.floor(Math.random() * extra.length), 1)[0]]);
    l.push([1, hasard(['نقولها للمانجر باش يجيبهالك', 'نكتبها في الكارني باش ما تضيعش', 'صحّا، كل واحد يكمّل خدمتو'])]);
    l.push([0, hasard(['يعطيك الصحة', 'صحّا، نرجع لبلاصتي', 'مليح، نتلاقاو من بعد'])]);
    return l;
  }
  /** Un sac mélangé : on tire tout avant de répéter quoi que ce soit. */
  function sac(liste) { let reste = []; return () => { if (!reste.length) reste = [...liste].sort(() => Math.random() - .5); return reste.pop(); }; }
  /* ----- tout ce qui se dit dans le bureau est enregistré (onglet الجورنال, fichier bavardages.jsonl de la maison) ----- */
  // Plusieurs onglets ouverts sur le bureau = plusieurs bureaux animés : un seul onglet (le « greffier ») enregistre, les autres se taisent.
  const aEnvoyer = [], MOI = Math.random().toString(36).slice(2);
  function greffier() { // un onglet visible reprend la main sur un onglet caché
    try {
      const vis = document.visibilityState !== 'hidden', foc = document.hasFocus();
      const v = JSON.parse(localStorage.getItem('manita.greffier') || 'null'), t = Date.now();
      if (!v || v.id === MOI || t - v.t > 6000 || (vis && !v.vis) || (foc && !v.foc)) { localStorage.setItem('manita.greffier', JSON.stringify({ id: MOI, t, vis, foc })); return true; }
      return false;
    } catch { return true; } // stockage bloqué : on enregistre quand même
  }
  function consigner(qui, texte, sorte, a = '') { if (texte) aEnvoyer.push({ qui, a, texte, sorte, quand: new Date().toISOString() }); }
  setInterval(() => { // à chaque tick (même sans ligne) : c'est aussi le battement qui garde le bail, ici et côté serveur
    const moi = greffier();
    if (!moi || document.visibilityState === 'hidden') { aEnvoyer.length = 0; return; }
    const lignes = aEnvoyer.splice(0, 50);
    fetch('/api/bavardages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-manita': '1' }, body: JSON.stringify({ onglet: MOI, focus: document.hasFocus(), lignes }) })
      .then(r => r.json()).then(j => { if (!j?.ok) throw 0; }).catch(() => aEnvoyer.unshift(...lignes.slice(0, Math.max(0, 500 - aEnvoyer.length)))); // pas perdu : on réessaie
  }, 4000);
  // en partant (onglet caché ou fermé) : un fetch « keepalive » porte l'en-tête x-manita, ce que sendBeacon ne sait pas faire
  const envoyerEnPartant = () => { try { fetch('/api/bavardages', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', 'x-manita': '1' }, body: JSON.stringify({ onglet: MOI, lignes: aEnvoyer.splice(0, 50) }) }).catch(() => {}); } catch {} };
  addEventListener('visibilitychange', () => { // il passe en caché : ce qui a été dit pendant qu'il était visible part tout de suite
    if (document.visibilityState !== 'hidden') return;
    try { const v = JSON.parse(localStorage.getItem('manita.greffier') || 'null'); if (v && v.id !== MOI) return; localStorage.setItem('manita.greffier', JSON.stringify({ id: MOI, t: Date.now(), vis: false })); } catch {}
    if (aEnvoyer.length) envoyerEnPartant();
  });
  addEventListener('pagehide', () => {
    try {
      const v = JSON.parse(localStorage.getItem('manita.greffier') || 'null');
      if (v && v.id !== MOI) return;
      if (aEnvoyer.length) envoyerEnPartant();
      localStorage.removeItem('manita.greffier');
    } catch {}
  });
  // Le couple du bureau : un garçon va voir une fille, ils parlent 30 s et des cœurs s'envolent pendant qu'ils parlent.
  const REPLIQUES_AMOUR = ['كي راكي اليوم ؟', 'نجيبلك قهوة ؟', 'شابة اليوم', 'نتغداو مع بعض ؟', 'هههه بلا ما تبالغ', 'رجعت غير باش نشوفك', 'ارواح نكملو الخدمة', 'كي تكمّل الخدمة نهدرو', 'والله ما نعرف واش نقولك', 'يعطيك الصحة'];
  const discussions = { travail: null, amour: null };
  function bulle(x, y, texte) {
    const g = svg('g', { class: 'bulle' });
    const t = svg('text', { x, y: y - 6, class: 'bulle-texte', 'text-anchor': 'middle', direction: 'rtl', text: texte });
    const w = Math.max(40, texte.length * 5.6 + 14);
    g.append(svg('rect', { x: x - w / 2, y: y - 19, width: w, height: 19, rx: 9, class: 'bulle-fond' }), svg('path', { d: `M${x - 4},${y} l4,6 l4,-6 z`, class: 'bulle-fond' }), t);
    return g;
  }
  function coeur(x, y) {
    const dx = (Math.random() - .5) * 26, taille = 1.1 + Math.random() * .7;
    const g = svg('g', { class: 'coeur', transform: `translate(${(x + dx).toFixed(1)},${y.toFixed(1)}) scale(${taille.toFixed(2)})` },
      svg('path', { d: 'M0,4 C-7,-2 -5,-9 0,-5 C5,-9 7,-2 0,4 z', fill: hasard(['#e63950', '#ff5c8a', '#ff2d55']) }));
    etat.noeuds.marcheurs.append(g);
    setTimeout(() => g.remove(), 2200);
  }
  function lancerDiscussion(sorte) {
    if (!vie.sociale || discussions[sorte] || !etat.noeuds.marcheurs) return;
    const amour = sorte === 'amour';
    const libres = [...etat.noeuds.coords.keys()].filter(k => k.includes('/') && k !== 'manager/manager' && !enMarche.has(k));
    const garcons = libres.filter(k => !identite(k).femme), filles = libres.filter(k => identite(k).femme);
    let de, vers;
    if (amour) { if (!garcons.length || !filles.length) return; de = hasard(garcons); vers = hasard(filles); }
    else {
      const occupes = postesOccupes(), ilotCommerage = commerage ? commerage.a.split('/')[0] : null;
      const ilotEspion = (espion.etape === 'approche' || espion.etape === 'ecoute' || espion.etape === 'fitna') && espion.victime ? espion.victime.split('/')[0] : null;
      const cibles = libres.filter(k => !occupes.has(k) && k.split('/')[0] !== ilotCommerage && k.split('/')[0] !== ilotEspion && k.split('/')[0] !== scene?.k?.split('/')[0] && !ilotsDispute.has(k.split('/')[0]) && k.split('/')[0] !== halab.avec?.split('/')[0]);
      if (libres.length < 2 || !cibles.length) return;
      vers = hasard(cibles); de = hasard(libres.filter(k => k !== vers));
      if (!de) return;
    }
    const pos = etat.noeuds.coords.get(vers);
    const d = discussions[sorte] = { minuteur: null, coeurs: null, bulles: [], vers };
    enMarche.add(vers); // celui (celle) qu'on vient voir reste à sa table pendant la discussion
    const fin = () => { if (discussions[sorte] !== d) return; clearInterval(d.minuteur); clearInterval(d.coeurs); d.bulles.forEach(x => x.remove()); enMarche.delete(vers); discussions[sorte] = null; };
    const ok = marcher(de, vers, {
      couleur: amour ? '#c0392b' : 'var(--gris)', dossier: false, retour: true, pause: DUREE_DISCUSSION, decalage: { x: -24, y: 10 },
      arrive: (g) => {
        let tour = 0;
        const script = amour ? null : dialogueTravail(de, vers), A = identite(de), B = identite(vers);
        const parle = () => {
          d.bulles.forEach(x => x.remove());
          let qui, texte;
          if (script) { if (tour >= script.length) { d.bulles = []; return; } [qui, texte] = script[tour]; }
          else { qui = tour % 2; texte = hasard(REPLIQUES_AMOUR); }
          const b = qui === 0 ? bulle(0, -88, texte) : bulle(pos.x, pos.y - 70, texte);
          if (qui === 0) g.append(b); else etat.noeuds.marcheurs.append(b);
          consigner(qui === 0 ? A.nom : B.nom, texte, amour ? 'amour' : 'travail', qui === 0 ? B.nom : A.nom);
          d.bulles = [b]; tour++;
        };
        parle(); d.minuteur = setInterval(parle, 2600);
        if (amour) d.coeurs = setInterval(() => coeur(pos.x - 12, pos.y - 50), 450); // les cœurs montent entre les deux
      },
      repart: fin
    });
    if (!ok) { enMarche.delete(vers); discussions[sorte] = null; }
  }
  setInterval(() => { if (vie.sociale && document.visibilityState !== 'hidden') lancerDiscussion('travail'); }, 1000);
  let marchesEnRetard = false; // une vraie marche n'a pas pu partir (l'agent marchait déjà) : elle part dès qu'il est libre, avant toute promenade
  function marchesDesTaches() {
    if (!etat.sante) return; // rien n'est encore lu : le premier passage se fait sur la vraie liste, les tâches d'avant ne défilent pas au chargement
    marchesEnRetard = false;
    for (const t of etat.taches) {
      const k = t.departement && t.poste ? t.departement + '/' + t.poste : null;
      const avant = etatsVus.get(t.id), maintenant = (t.etat || '') + '|' + (k || '');
      if (avant === maintenant) continue;
      etatsVus.set(t.id, maintenant);
      if (premierPassage || !k) continue;
      const [eAvant, kAvant] = (avant || '|').split('|');
      const de = t.etat === 'encours' ? 'manager/manager' : k;
      let parti = true;
      if (t.etat === 'encours' && (!kAvant || eAvant !== 'encours')) parti = marcher('manager/manager', k, { couleur: 'var(--vert)' });
      else if (t.etat === 'attente') parti = marcher(k, 'telegram', { couleur: 'var(--orange)', retour: true });
      else if (t.etat === 'fini') parti = marcher(k, 'carnet', { couleur: 'var(--vert)', retour: true });
      else if (t.etat === 'echec') parti = marcher(k, 'carnet', { couleur: 'var(--rouge)', retour: true });
      if (!parti && enMarche.has(de)) { if (avant === undefined) etatsVus.delete(t.id); else etatsVus.set(t.id, avant); marchesEnRetard = true; } // il était debout : la marche du vrai travail ne se perd pas
    }
    premierPassage = false;
  }
  // la vie du bureau : les agents se lèvent et vont voir un collègue (même îlot ou autre), le manager fait sa ronde,
  // et quand une tâche tourne, son agent va plus souvent au carnet. Toujours dix marcheurs à la fois : dès qu'un se rassoit, un autre se lève.
  /* ===================== l'espion du manager ===================== */
  // Shikem Pro Max, tout en rouge et lunettes noires : il se glisse à côté d'un collègue, écoute ce qu'il prépare contre le manager,
  // puis va le raconter à Yanis. Le manager répond, et l'espion repart écouter quelqu'un d'autre.
  const ESPION = { nom: 'شيكم Pro Max', femme: false, latin: true, peau: '#d9a57a', cheveux: '#111111', pantalon: '#7a0d12', espion: true };
  const COMPLOTS = [ // ce que la victime prépare, et comment l'espion le raconte (accordé au féminin si c'est une collègue)
    ['نديرو إضراب غدوة ؟', (n, f) => `${n} ${f ? 'راهي تحضّر' : 'راهو يحضّر'} إضراب`],
    ['القائد ما يعرف والو', (n, f) => `${n} ${f ? 'قالت' : 'قال'} بلي القائد ما يعرف والو`],
    ['نطلبو زيادة في الخلصة', (n, f) => `${n} ${f ? 'حابة' : 'حاب'} زيادة في الخلصة`],
    ['نقلبو عليه الطاولة', (n, f, chez) => `${n} ${f ? 'راهي تحضّر' : 'راهو يحضّر'} انقلاب ${chez === 'boss' ? 'على القائد' : 'عليك'}`],
    ['نخبّيو الكارني عليه', (n, f) => `${n} ${f ? 'حابة تخبّي' : 'حاب يخبّي'} الكارني`]
  ];
  const MODELES_ESPION = [
    ...COMPLOTS.map(([dit, rapport]) => (v, id) => ({ dit, grave: dit, rapport: chez => rapport(id.nom, id.femme, chez) })), // grave : le Boss viendra régler ça
    (v, id) => { const t = travailDe(v); return { dit: t.objet ? `يلزمني ${t.objet}، وحتى واحد ما عطاني والو` : t.besoin, rapport: () => `${id.nom} ${id.femme ? 'تشكي' : 'يشكي'} : ${t.besoin}` }; },
    (v, id) => { const t = travailDe(v); return { dit: t.fait, rapport: () => `${id.nom} ${id.femme ? 'قالت' : 'قال'} : ${t.fait}` }; },
    (v, id) => ({ dit: 'ريم شابة بزاف اليوم', rapport: () => `${id.nom} ${id.femme ? 'تحكي' : 'يحكي'} على ريم في وسط الخدمة` }),
    (v, id) => ({ dit: 'البوس ما يخرج حتى من البيرو تاعو', rapport: chez => chez === 'boss' ? `${id.nom} ${id.femme ? 'قالت' : 'قال'} بلي ما تخرجش من البيرو` : `${id.nom} ${id.femme ? 'تحكي' : 'يحكي'} على البوس` }),
    (v, id) => ({ dit: 'الكاميرات هاذو يشوفونا ولا لا ؟', rapport: () => `${id.nom} ${id.femme ? 'تقلّب' : 'يقلّب'} على الكاميرات` }),
    (v, id) => ({ dit: 'شيكم هاذا يتجسس علينا', rapport: () => `${id.nom} ${id.femme ? 'فاقت' : 'فاق'} بيا، لازم نبدّل الطريقة` }),
    (v, id) => ({ dit: 'نخرجو بكري اليوم ؟', rapport: () => `${id.nom} ${id.femme ? 'حابة تخرج' : 'حاب يخرج'} بكري` }),
    (v, id) => ({ dit: 'الحلّاب ما خدم حتى حاجة، غير يتبع ريم', rapport: () => 'الحلّاب ما خدم حتى حاجة اليوم، غير يتبع ريم', femme: false }),
    (v, id) => ({ dit: 'الكارني هذا شكون يقراه ؟', rapport: () => `${id.nom} ${id.femme ? 'تسقسي' : 'يسقسي'} شكون يقرا الكارني` })
  ];
  const sacEspion = sac(MODELES_ESPION);
  // [ce que Shikem dit à A (A homme), (A femme), ce que A répète à B]
  const INSULTES = [
    ['بلي ما تخدم والو', 'بلي ما تخدمي والو', 'بلي ما نخدم والو'],
    ['بلي ترقد في الخدمة', 'بلي ترقدي في الخدمة', 'بلي نرقد في الخدمة'],
    ['بلي تخبّي الكارني', 'بلي تخبّي الكارني', 'بلي نخبّي الكارني'],
    ['بلي القائد ما يحبكش', 'بلي القائد ما يحبكش', 'بلي القائد ما يحبنيش'],
    ['بلي تحكي على البوس', 'بلي تحكي على البوس', 'بلي نحكي على البوس'],
    ['بلي راك تقلّب على خدمة أخرى', 'بلي راكي تقلّبي على خدمة أخرى', 'بلي راني نقلّب على خدمة أخرى']
  ];
  const sacInsultes = sac(INSULTES), sacEgo = sac(['أنا وحدي اللي نخدم هنا', 'الزيادة تاعي أنا، ماشي تاعهم', 'هههه، خليهم يتقاتلو', 'كلش يتعلّم مني', 'البوس يحبني أنا برك']);
  /** A va voir B, furieux, à cause de ce que Shikem lui a raconté ; ils finissent par comprendre que c'est Shikem. */
  const ilotsDispute = new Set();
  function lancerDispute(a, b, ins) {
    const C = etat.noeuds.coords;
    if (!vie.sociale || enMarche.has(a) || enMarche.has(b) || !C.get(a) || !C.get(b) || postesOccupes().has(b) || b.split('/')[0] === halab.avec?.split('/')[0]) return false;
    const ile = b.split('/')[0];
    const A = identite(a), B = identite(b), pos = C.get(b);
    const script = [
      [0, `${B.femme ? 'علاش قلتي' : 'علاش قلت'} عليّا ${ins[2]} ؟`],
      [1, 'أنا ؟ والله ما قلت والو !'],
      [0, 'شيكم قالي'],
      [1, 'شيكم كذّاب، يحب يفرّقنا باش يبان هو'],
      [0, B.femme ? 'صح… سمحيلي' : 'صح… سمحلي'],
      [1, 'ماشي مشكل، نردّو بالنا منو']
    ];
    enMarche.add(b);
    const d = { bulles: [], minuteurs: [], g: null }, vider = () => { d.bulles.forEach(x => x.remove()); d.bulles = []; };
    const ok = marcher(a, b, {
      couleur: 'var(--gris)', dossier: false, retour: true, pause: script.length * 2500 + 500, decalage: { x: -24, y: 10 },
      arrive: (g) => {
        d.g = g; g.classList.add('colere'); g.append(svg('text', { x: 10, y: -66, direction: 'ltr', 'text-anchor': 'start', class: 'colere-signe', text: '💢' }));
        let tour = 0;
        const dire = () => {
          if (tour >= script.length || !g.isConnected) return;
          vider();
          const [qui, texte] = script[tour++];
          if (tour === 3) { g.classList.remove('colere'); g.querySelector('.colere-signe')?.remove(); } // il se calme
          const bl = qui === 0 ? bulle(0, -88, texte) : bulle(pos.x, pos.y - 70, texte);
          bl.classList.add('bulle-dispute');
          if (qui === 0) g.append(bl); else etat.noeuds.marcheurs.insertBefore(bl, g);
          d.bulles.push(bl); consigner(qui === 0 ? A.nom : B.nom, texte, 'fitna', qui === 0 ? B.nom : A.nom);
          if (tour < script.length) d.minuteurs.push(setTimeout(dire, 2500));
        };
        dire();
      },
      repart: () => { vider(); d.minuteurs.forEach(clearTimeout); d.g?.classList.remove('colere'); d.g?.querySelector('.colere-signe')?.remove(); enMarche.delete(b); ilotsDispute.delete(ile); }
    });
    if (ok) ilotsDispute.add(ile); else enMarche.delete(b);
    return ok;
  }
  // ce que le Boss commande, comment Shikem le prépare et le sert, et ce qu'il porte
  // posés sur la main du bras tendu (épaule à -50°, coude à -40° : la main arrive vers x 12, y -28)
  const tasse = () => svg('g', { class: 'plateau' }, svg('rect', { x: 10, y: -33, width: 4.2, height: 4.4, rx: .8, fill: '#ffffff' }), svg('rect', { x: 10.2, y: -33, width: 3.8, height: 1.2, fill: '#5a3420' }), svg('path', { d: 'M11,-34.5 q.8,-1.4 0,-2.8 M13,-34.5 q.8,-1.4 0,-2.8', stroke: 'rgba(255,255,255,.7)', 'stroke-width': .5, fill: 'none' }));
  const assiette = (couleur) => svg('g', { class: 'plateau' }, svg('ellipse', { cx: 12.5, cy: -28.6, rx: 5, ry: 1.6, fill: '#ffffff' }), svg('rect', { x: 9.5, y: -31.6, width: 6, height: 2.8, rx: 1.2, fill: couleur }));
  const COMMANDES_BOSS = [
    { demande: 'شيكم ! جيبلي قهوة', prepare: 'قهوة للبوس، كحلة وبلا سكر', sert: 'تفضّل يا البوس، القهوة', objet: tasse },
    { demande: 'شيكم ! راني جيعان، جيبلي كسكروت', prepare: 'كسكروت للبوس، بالحرور', sert: 'تفضّل يا البوس، الكسكروت', objet: () => assiette('#d9a35b') },
    { demande: 'شيكم ! جيبلي قهوة وحلوة', prepare: 'قهوة وزلابية للبوس', sert: 'تفضّل يا البوس، القهوة والحلوة', objet: tasse },
    { demande: 'شيكم ! جيبلي غرايف وعسل', prepare: 'غرايف بالعسل للبوس', sert: 'تفضّل يا البوس، الغرايف', objet: () => assiette('#e7c36a') },
    { demande: 'شيكم ! جيبلي شوية ما', prepare: 'ما بارد للبوس', sert: 'تفضّل يا البوس، الما', objet: tasse },
    { demande: 'شيكم ! جيبلي مقروط', prepare: 'مقروط للبوس، من الطبسي', sert: 'تفضّل يا البوس، المقروط', objet: () => assiette('#c98b3a') }
  ];
  const MERCI_PAR_OBJET = { tasse: ['ساخنة بزاف، ولكن مليحة', 'خلّيها هنا وروح راقبهم', 'هذا هو شيكم تاعي'], assiette: ['بنين، خلّيه هنا', 'مليح، ودروك واش سمعت ؟', 'يعطيك الصحة، روح خدم'], eau: ['بارد، يعطيك الصحة', 'هذا هو شيكم تاعي'] };
  const merciPour = c => hasard(c.sert.includes('الما') ? MERCI_PAR_OBJET.eau : c.objet === tasse ? MERCI_PAR_OBJET.tasse : MERCI_PAR_OBJET.assiette);
  const sacCommandes = sac(COMMANDES_BOSS), sacMerci = sac(['يعطيك الصحة، روح خدم', 'ساخنة بزاف، ولكن مليحة', 'هذا هو شيكم تاعي', 'مليح، ودروك واش سمعت ؟', 'خلّيها هنا وروح راقبهم']);
  setInterval(() => { // de temps en temps, le Boss a faim ou soif
    if (!vie.sociale || document.visibilityState === 'hidden' || espion.commande || !espion.g?.isConnected || bossOccupe() || scene || espionChezBoss()) return;
    const p = etat.noeuds.coords.get('boss'); if (!p || !etat.noeuds.coords.get('cuisine') || Math.random() > .3) return;
    espion.commande = sacCommandes();
    appelerShikem();
  }, 15000);
  const REPONSES_BOSS = [f => f ? 'جيبلي سميتها كاملة' : 'جيبلي سميتو كاملة', f => f ? 'مليح، ما تعرفش بلي نعرف' : 'مليح، ما يعرفش بلي نعرف', f => f ? 'نشوف معاها أنا' : 'نشوف معاه أنا', () => 'كمّل راقب، شيكم', () => 'هههه، ما يقدر لي حتى واحد'];
  const REPONSES_MANAGER = ['خلّيهم تحت العين', 'مليح شيكم، كمّل', 'نشوف معاهم من بعد', 'هههه ما يقدروش', 'راقبهم كامل', 'جيبلي واش يلزمهم ونجيبهولهم', 'نكتبها في الكارني'];
  const sacBoss = sac(REPONSES_BOSS), sacManager = sac(REPONSES_MANAGER);
  const espion = { g: null, corps: null, pos: null, sens: 1, etape: 'choisir', cible: null, victime: null, complot: null, jusqua: 0, bulles: [], minuteur: null, managerReserve: false };
  function espionBulles() { espion.bulles.forEach(x => x.remove()); espion.bulles = []; }
  function espionLibere() {
    clearInterval(espion.minuteur); espion.minuteur = null; espionBulles();
    if (espion.victime) { enMarche.delete(espion.victime); espion.victime = null; }
    if (espion.managerReserve) { enMarche.delete('manager/manager'); espion.managerReserve = false; }
    if (espion.fitna) { enMarche.delete(espion.fitna.b); espion.fitna = null; }
  }
  function creerEspion() {
    const dep = etat.noeuds.coords.get('telegram') || etat.noeuds.coords.get('manager/manager'); if (!dep) return;
    espionLibere(); espion.commande = null; espion.plateau = null; // la demande du Boss a disparu avec l'ancien dessin
    espion.g = svg('g', { class: 'marcheur special espion' });
    espion.corps = humain('#d62828', false, ESPION);
    const nom = etiquetteNom(0, -78, ESPION); nom.classList.add('nom-espion');
    espion.g.append(espion.corps, nom);
    etat.noeuds.marcheurs.append(espion.g);
    espion.pos = { x: dep.x - 40, y: dep.y - 20 }; espion.etape = 'choisir';
  }
  /** « شيكم ! أرواح لهنا ! » au-dessus du Boss ; la bulle part quand le Boss passe à la commande (ou au bout de trois secondes). */
  function appelerShikem() {
    const p = etat.noeuds.coords.get('boss'), couche = etat.noeuds.marcheurs, appel = 'شيكم ! أرواح لهنا !';
    espion.appelBulle?.remove(); espion.appelBulle = null;
    if (p && couche?.isConnected) { const b = bulle(p.x, p.y - 90, appel); b.classList.add('bulle-boss'); couche.append(b); espion.appelBulle = b; setTimeout(() => { b.remove(); if (espion.appelBulle === b) espion.appelBulle = null; }, 3000); }
    bossParleJusqua = performance.now() + 3000;
    consigner('Le Boss', appel, 'boss', ESPION.nom);
  }
  const espionChezBoss = () => ['vers-appel', 'appel'].includes(espion.etape) || (['vers-service', 'service'].includes(espion.etape) && !espion.commande?.pour) || (espion.chez === 'boss' && (espion.etape === 'vers-manager' || espion.etape === 'rapport'));
  function espionDit(texte, chez) { // chez = null : au-dessus de l'espion ; sinon au-dessus de la table de ce poste
    espionBulles();
    const p = chez ? etat.noeuds.coords.get(chez) : null;
    const devantBoss = espion.etape === 'appel' || (espion.etape === 'rapport' && espion.chez === 'boss');
    const b = !p ? bulle(0, devantBoss ? -130 : espion.etape === 'rapport' && espion.chez === 'manager/manager' ? -94 : -88, texte)
      : chez === 'manager/manager' ? bulle(p.x + 22, p.y - 92, texte) : chez === 'rim' ? bulle(p.x + 40, p.y - 70, texte) : bulle(p.x, p.y - (chez === 'boss' ? 90 : 70), texte);
    b.classList.add(chez === null ? 'bulle-espion' : chez === 'boss' ? 'bulle-boss' : 'bulle-complot');
    if (texte !== '...') consigner(chez === null ? ESPION.nom : chez === 'boss' ? 'Le Boss' : identite(chez).nom, texte, 'شيكم');
    const sousEspion = p && chez !== 'boss' && chez !== 'manager/manager' && espion.g?.parentNode === etat.noeuds.marcheurs;
    if (sousEspion) etat.noeuds.marcheurs.insertBefore(b, espion.g); else (p ? etat.noeuds.marcheurs : espion.g).append(b);
    espion.bulles.push(b);
  }
  function bougerEspion(dt, now) {
    if (!espion.g || !espion.g.isConnected) creerEspion();
    if (!espion.g) return;
    const C = etat.noeuds.coords;
    if (espion.commande && (espion.etape === 'choisir' || espion.etape === 'pause' || espion.etape === 'approche') && C.get('cuisine') && C.get('boss')) {
      // le Boss l'appelle : Shikem lâche tout et accourt devant son bureau
      espionLibere(); espion.etape = 'vers-appel'; espion.cible = { x: C.get('boss').x + 30, y: C.get('boss').y + 44 };
    }
    espion.g.classList.toggle('court', espion.etape === 'vers-appel' || espion.etape === 'vers-cuisine' || espion.etape === 'vers-service');
    if (espion.etape === 'vers-appel') {
      const r = avancer(espion, espion.cible, .1, dt); placer(espion, r.dx, !r.arrive);
      if (!r.arrive) return;
      if (bossOccupe() || scene) { const b = C.get('boss'); placer(espion, b ? b.x - espion.pos.x : 0, false); return; } // le Boss parle à quelqu'un d'autre : il attend
      espion.etape = 'appel'; espion.appelBulle?.remove(); espion.appelBulle = null; bossParleJusqua = 0;
      const quoi = espion.commande.demande.replace(/^شيكم ! /, '');
      const suite = [() => espionDit(`${quoi}، وبالزربة !`, 'boss'), () => espionDit('حاضر يا البوس، دقيقة وراني هنا', null)];
      let tour = 0; suite[tour++]();
      espion.minuteur = setInterval(() => {
        if (tour < suite.length) { suite[tour++](); return; }
        espionLibere(); espion.etape = 'vers-cuisine'; espion.cible = { x: C.get('cuisine').x - 56, y: C.get('cuisine').y + 8 }; // il court au café
      }, 2300);
      return;
    }
    if (espion.etape === 'appel') { const b = C.get('boss'); placer(espion, b ? b.x - espion.pos.x : 0, false); return; }
    if (espion.etape === 'vers-cuisine' || espion.etape === 'vers-service') {
      const r = avancer(espion, espion.cible, .11, dt); placer(espion, r.dx, !r.arrive); // il court
      if (!r.arrive) return;
      if (espion.etape === 'vers-cuisine') {
        espion.etape = 'cuisine'; espion.jusqua = now + 2600;
        espionDit(espion.commande.prepare, null);
      } else {
        const pourRim = espion.commande.pour === 'rim';
        if (!pourRim && bossOccupe()) { const b = C.get('boss'); placer(espion, b ? b.x - espion.pos.x : 0, false); return; } // Yanis est chez le Boss, ou le Boss est debout : il attend avec le plateau
        espion.etape = 'service';
        const suite = !pourRim ? [() => espionDit(espion.commande.sert, null), () => espionDit(merciPour(espion.commande), 'boss')]
          : belle.mode === 'assise' ? [() => espionDit(espion.commande.sert, null), () => espionDit('يعطيك الصحة يا شيكم', 'rim')]
          : [() => espionDit('ريم راحت… نشربها أنا، هههه', null)];
        let tour = 0; suite[tour++]();
        espion.minuteur = setInterval(() => {
          if (tour < suite.length) { suite[tour++](); return; }
          espion.plateau?.remove(); espion.plateau = null; espion.commande = null; espion.g.classList.remove('porte-plateau');
          espionLibere(); espion.etape = 'pause'; espion.jusqua = performance.now() + 1200;
        }, 2400);
      }
      return;
    }
    if (espion.etape === 'cuisine') {
      placer(espion, 1, false);
      if (now < espion.jusqua) return;
      espionBulles();
      espion.plateau = espion.commande.objet(); espion.corps.querySelector('.buste').append(espion.plateau); espion.g.classList.add('porte-plateau'); // dans sa main, bras tendu
      const pourRim = espion.commande.pour === 'rim' && C.get('rim'), b = pourRim ? C.get('rim') : C.get('boss');
      espion.cible = pourRim ? { x: b.x + 30, y: b.y + 12 } : { x: b.x + 116, y: b.y + 16 }; espion.etape = 'vers-service';
      return;
    }
    if (espion.etape === 'service') { const b = C.get(espion.commande?.pour === 'rim' ? 'rim' : 'boss'); placer(espion, b ? b.x - espion.pos.x : 0, false); return; }
    if (espion.etape === 'choisir') {
      if (!etat.sante) { placer(espion, 0, false); return; } // pas encore de données du bureau
      const occupes = postesOccupes();
      const ilotsPris = [discussions.travail?.vers?.split('/')[0], commerage?.a.split('/')[0], scene?.k?.split('/')[0], halab.avec?.split('/')[0], ...ilotsDispute];
      const libres = [...C.keys()].filter(k => k.includes('/') && k !== 'manager/manager' && !enMarche.has(k) && !occupes.has(k) && !ilotsPris.includes(k.split('/')[0]));
      if (!libres.length) { placer(espion, 0, false); return; }
      libres.sort((x, y) => ecart(C.get(x), espion.pos) - ecart(C.get(y), espion.pos));
      espion.victime = hasard(libres.slice(0, 6)); enMarche.add(espion.victime); // la victime reste assise : il vient l'écouter
      // une fois sur trois, au lieu d'écouter, il va monter un collègue contre un autre (de préférence du même îlot)
      const autres = libres.filter(k => k !== espion.victime), voisins = autres.filter(k => k.split('/')[0] === espion.victime.split('/')[0]);
      espion.fitna = autres.length && Math.random() < .33 ? { b: hasard(voisins.length ? voisins : autres), insulte: sacInsultes() } : null;
      if (espion.fitna) enMarche.add(espion.fitna.b); // B reste assis : c'est lui qu'on va accuser
      const v = C.get(espion.victime); espion.cible = { x: v.x + 26, y: v.y + 10 }; espion.complot = sacEspion()(espion.victime, identite(espion.victime));
      espion.etape = 'approche';
    }
    if (espion.etape === 'approche' || espion.etape === 'vers-manager') {
      const r = avancer(espion, espion.cible, .065, dt);
      placer(espion, r.dx, !r.arrive);
      if (!r.arrive) return;
      if (espion.etape === 'approche' && espion.fitna) { // il sème la zizanie
        espion.etape = 'fitna';
        const a = espion.victime, A = identite(a), B = identite(espion.fitna.b), ins = espion.fitna.insulte;
        espionDit(`سمعت ${B.nom} ${B.femme ? 'تقول' : 'يقول'} عليك ${A.femme ? ins[1] : ins[0]}`, null);
        let tour = 0;
        espion.minuteur = setInterval(() => {
          tour++;
          if (tour === 1) { espionDit(`صح ؟! نروح نهدر ${B.femme ? 'معاها' : 'معاه'}`, a); return; }
          const b = espion.fitna.b; espionLibere(); // libère A et B : A part se disputer avec B
          if (lancerDispute(a, b, ins) && !espion.commande) espionDit(sacEgo(), null);
          espion.etape = 'pause'; espion.jusqua = performance.now() + 2600;
        }, 2600);
        return;
      }
      if (espion.etape === 'approche') { // il écoute en douce
        espion.etape = 'ecoute'; espion.jusqua = now + 5200;
        espionDit(espion.complot.dit, espion.victime);
        setTimeout(() => { if (espion.etape === 'ecoute') { const b = bulle(0, -104, '...'); b.classList.add('bulle-espion'); espion.g.append(b); espion.bulles.push(b); } }, 1800);
      } else { // il raconte au manager (ou au Boss)
        if (espion.chez !== 'boss' && !espion.managerReserve) {
          if (enMarche.has('manager/manager')) { const m = C.get('manager/manager'); placer(espion, m ? m.x - espion.pos.x : 0, false); return; } // Yanis est debout : il l'attend
          enMarche.add('manager/manager'); espion.managerReserve = true;
        }
        if (espion.chez === 'boss' && bossOccupe()) { const b = C.get('boss'); placer(espion, b ? b.x - espion.pos.x : 0, false); return; } // Yanis lui parle déjà, ou le Boss est debout : il attend
        espion.etape = 'rapport';
        const secret = espion.complot.rapport(espion.chez);
        let tour = 0;
        const auBoss = espion.chez === 'boss';
        const suite = [() => espionDit(auBoss ? 'يا البوس، عندي خبر' : 'باطرون، عندي خبر', null), () => espionDit(secret, null), () => espionDit(auBoss ? sacBoss()(espion.complot.femme ?? identite(espion.rapportSur).femme) : sacManager(), espion.chez)];
        suite[tour++]();
        espion.minuteur = setInterval(() => {
          if (tour < suite.length) { suite[tour++](); return; }
          if (espion.chez === 'boss' && espion.complot?.grave && espion.rapportSur) plaintes.push({ k: espion.rapportSur, nom: identite(espion.rapportSur).nom, motif: espion.complot.grave, quand: Date.now() }); // le Boss ira lui crier dessus
          espionLibere(); if (!espion.commande && Math.random() < .35) espionDit(sacEgo(), null); // et il se vante
          espion.etape = 'pause'; espion.jusqua = performance.now() + 1500;
        }, 2300);
      }
      return;
    }
    if (espion.etape === 'ecoute') {
      const v = C.get(espion.victime); placer(espion, v ? v.x - espion.pos.x : 0, false); // il la regarde sans bouger
      if (now < espion.jusqua) return;
      espionBulles(); espion.rapportSur = espion.victime; enMarche.delete(espion.victime); espion.victime = null;
      espion.chez = C.get('boss') ? 'boss' : 'manager/manager'; // il rapporte tout au Boss, jamais au manager
      const m = C.get(espion.chez); espion.cible = espion.chez === 'boss' ? { x: m.x + 30, y: m.y + 44 } : { x: m.x + 60, y: m.y + 6 }; espion.etape = 'vers-manager'; // devant le bureau du Boss
      return;
    }
    if (espion.etape === 'rapport') { const m = C.get(espion.chez || 'manager/manager'); placer(espion, m ? m.x - espion.pos.x : 0, false); return; }
    if (espion.etape === 'fitna') { const v = C.get(espion.victime); placer(espion, v ? v.x - espion.pos.x : 0, false); return; }
    if (espion.etape === 'pause') { placer(espion, 0, false); if (now >= espion.jusqua) { espionBulles(); espion.etape = 'choisir'; } }
  }

  /* ===================== le manager rend compte au Boss ===================== */
  function rapportManager() {
    const T = [...etat.taches].sort(recent), l = ['باطرون، هاذا التقرير تاع اليوم'];
    const enc = T.find(t => t.etat === 'encours'), att = T.find(t => t.etat === 'attente'), ech = T.find(t => t.etat === 'echec' && duJour(t));
    const fin = T.find(t => t.etat === 'fini' && duJour(t) && t.note && !(t.approbation?.reponse === 'non' && !(t.approbation.note || '').trim()));
    // dans l'ordre où le Boss y répond : ce qui décide sa réponse n'est jamais coupé
    if (ech) l.push(`«${court(ech.titre)}» ما عدّاتش، لازم تتصحّح`);
    if (att) l.push(`«${court(att.titre)}» تستنى كلمة الكليان`);
    if (enc) l.push(`${nomDept(enc.departement)} راهم يخدمو على «${court(enc.titre)}»`);
    if (fin) l.push(`«${court(fin.titre)}» كملات وراهي في الكارني`);
    if (l.length === 1) l.push('ما كاين حتى خدمة اليوم، نستناو الكليان');
    const reponse = ech ? 'قولهم يصلحوها اليوم' : att ? (att.approbation?.telegram?.envoye ? 'قولو للكليان يجاوب في تيليغرام' : 'قولو للكليان يجاوب في الصفحة') : enc ? 'مليح، خليهم يخدمو' : fin ? 'مليح، زيدو' : 'نستناو الكليان، وحضّرو روحكم';
    return { lignes: l.slice(0, 3), reponse };
  }
  let prochainRapport = 0, managerChezBoss = false, rimAvecBoss = false, halabAvecBoss = false, bossParleJusqua = 0;
  const bossOccupe = () => managerChezBoss || rimAvecBoss || halabAvecBoss || enMarche.has('boss') || performance.now() < bossParleJusqua; // quelqu'un lui parle déjà, ou il est debout
  setInterval(() => {
    if (!vie.sociale || document.visibilityState === 'hidden' || !etat.noeuds.coords?.get('boss')) return;
    const t = performance.now(); if (t < prochainRapport) return;
    const shikemChezBoss = espionChezBoss();
    if (shikemChezBoss || bossOccupe()) { prochainRapport = t + 5000; return; }
    const bulles = [];
    let arreter = () => {};
    const vider = () => { bulles.forEach(x => x.remove()); bulles.length = 0; };
    const ok = marcher('manager/manager', 'boss', {
      couleur: '#3d405b', dossier: true, retour: true, pause: 11000, decalage: { x: 6, y: 40 },
      arrive: (g) => {
        const { lignes, reponse } = rapportManager(), couche = etat.noeuds.marcheurs;
        const suite = [...lignes.map(t => [0, t]), [1, reponse]];
        let tour = 0, fini = false;
        const dire = () => {
          if (fini || tour >= suite.length) return;
          vider();
          const [qui, texte] = suite[tour++], p = etat.noeuds.coords.get('boss');
          if (qui === 1 && (!p || !couche.isConnected)) return;
          const b = qui === 0 ? bulle(0, -130, texte) : bulle(p.x, p.y - 90, texte); // Yanis parle au-dessus du Boss, sans lui cacher le visage
          if (qui === 1) b.classList.add('bulle-boss');
          (qui === 0 ? g : couche).append(b); bulles.push(b);
          consigner(qui === 0 ? identite('manager/manager').nom : 'Le Boss', texte, 'boss', qui === 0 ? 'Le Boss' : identite('manager/manager').nom);
          if (tour < suite.length) setTimeout(dire, 2600);
        };
        dire();
        arreter = () => { fini = true; };
      },
      repart: () => { arreter(); vider(); managerChezBoss = false; }
    });
    if (ok) managerChezBoss = true;
    prochainRapport = t + (ok ? 40000 + Math.random() * 20000 : 5000); // occupé (Shikem lui parle, une tâche…) : on réessaie un peu plus tard
  }, 2000);

  /* ===================== la colère du Boss ===================== */
  // Quand une vraie tâche d'un poste a échoué, le Boss se lève, va crier sur l'agent (bras en l'air), l'agent supplie,
  // et il repart en lui laissant un avertissement (⚠ à côté de son bureau). Au troisième, il le renvoie : l'agent sort par la porte
  // avec son carton, un nouveau entre et prend sa place. Les fautes d'avant son arrivée ne comptent pas pour le nouveau.
  const BOSS_ID = { nom: 'Le Boss', latin: true, femme: false, peau: '#e2b38a', cheveux: '#2a2a2a', pantalon: '#151515', boss: true };
  const NOUVEAUX_H = ['عادل', 'زكرياء', 'مهدي', 'رضا', 'يونس', 'سليم', 'خالد', 'أنيس'], NOUVEAUX_F = ['هاجر', 'خديجة', 'نوال', 'شيماء', 'دنيا', 'لينا', 'صبرينة', 'إكرام'];
  let avert = {}; try { avert = JSON.parse(localStorage.getItem('manita.avertissements') || '{}') || {}; } catch {}
  const sauverAvert = () => { try { localStorage.setItem('manita.avertissements', JSON.stringify(avert)); } catch {} };
  let scene = null, derniereScene = 0;
  function dessinerAvertissements() {
    const couche = etat.noeuds.badges; if (!couche) return;
    couche.innerHTML = '';
    if (!vie.sociale || MOUVEMENT_REDUIT) return; // les ⚠ du Boss font partie des scènes : cachés tant qu'elles sont éteintes (ou que la machine coupe les animations : aucune scène ne peut jouer)
    for (const [k, v] of Object.entries(avert)) {
      const p = etat.noeuds.coords.get(k); if (!p || !v?.n) continue;
      couche.append(svg('g', { class: 'avertissement' }, svg('rect', { x: p.x + 12, y: p.y - 36, width: 7 + v.n * 9, height: 12, rx: 6, class: 'avert-fond' }),
        svg('text', { x: p.x + 15.5, y: p.y - 27, class: 'avert-texte', direction: 'ltr', text: '⚠'.repeat(v.n) })));
    }
  }
  const RAPPEL_FAUTE = 10 * 60000; // une faute toujours pas corrigée vaut un nouvel avertissement au bout de dix minutes
  /** Les fautes de ce poste qui méritent un avertissement maintenant : échouées depuis moins d'un jour et depuis l'arrivée de l'agent, pas reprochées récemment. La plus ancienne d'abord. */
  function fautesDe(k) {
    const depuis = Math.max(avert[k]?.depuis || 0, Date.now() - UN_JOUR), vues = avert[k]?.vues || {};
    return etat.taches.filter(t => t.departement + '/' + t.poste === k && t.etat === 'echec' && Date.parse(t.majLe || t.creeLe || 0) > depuis && (!vues[t.id] || Date.now() - vues[t.id] > RAPPEL_FAUTE)).sort(recent).reverse();
  }
  const relireColere = () => { // plusieurs onglets ouverts : on relit avant de compter ou d'écrire
    try { avert = JSON.parse(localStorage.getItem('manita.avertissements') || '{}') || {}; } catch {}
    try { embauches = JSON.parse(localStorage.getItem('manita.embauches') || '{}') || {}; } catch {}
  };
  function remplacerAssis(k) {
    const gp = etat.noeuds.postes.get(k), c = etat.noeuds.coords.get(k); if (!gp || !c) return null;
    const [perso] = tableEtPersonnage(c.x, c.y - 6, 11, { cle: k });
    const ancien = gp.querySelector('.personnage'); if (ancien) ancien.replaceWith(perso); else gp.prepend(perso);
    return perso;
  }
  addEventListener('storage', e => {
    if (e.key !== 'manita.embauches' && e.key !== 'manita.avertissements') return;
    relireColere();
    for (const [k, id] of Object.entries(embauches)) if (identites.get(k)?.nom !== id.nom) { identites.set(k, id); if (!enMarche.has(k)) remplacerAssis(k); }
    dessinerAvertissements();
  });
  function bulleBreve(k, texte, classe, ms = 3500) {
    const p = etat.noeuds.coords.get(k); if (!p || !etat.noeuds.marcheurs) return;
    const b = bulle(p.x, p.y - 70, texte); b.classList.add(classe); etat.noeuds.marcheurs.append(b); setTimeout(() => b.remove(), ms);
  }
  function licencier(k) {
    const C = etat.noeuds.coords; if (!C.get(k)) return;
    relireColere();
    const ancien = identite(k), pris = new Set([...identites.values()].map(x => x.nom));
    const femme = Math.random() < .5, noms = (femme ? NOUVEAUX_F : NOUVEAUX_H).filter(n => !pris.has(n));
    const nouveau = { nom: hasard(noms.length ? noms : (femme ? NOUVEAUX_F : NOUVEAUX_H)), femme, latin: false, peau: hasard(PEAUX), cheveux: hasard(CHEVEUX), pantalon: hasard(PANTALONS) };
    identites.set(k, nouveau); embauches[k] = nouveau; sauverEmbauches();
    avert[k] = { n: 0, depuis: Date.now() }; sauverAvert(); dessinerAvertissements();
    const assisNeuf = remplacerAssis(k); if (assisNeuf) assisNeuf.style.opacity = '0'; // la chaise reste vide jusqu'à l'arrivée du nouveau
    const factice = svg('g'), montrer = () => { if (assisNeuf) assisNeuf.style.opacity = ''; };
    const salut = `السلام عليكم، أنا ${nouveau.nom}، ${nouveau.femme ? 'الجديدة' : 'الجديد'}`;
    if (!C.get('sortie')) { montrer(); bulleBreve(k, salut, 'bulle-embauche', 4000); consigner(nouveau.nom, salut, 'embauche'); return; } // pas de porte (mise en page en colonne) : remplacé sur place
    bulleBreve(k, 'الله غالب… نجمع حوايجي ونروح', 'bulle-supplie');
    consigner(ancien.nom, 'الله غالب… نجمع حوايجي ونروح', 'licenciement', 'Le Boss');
    const okSortie = marcher(k, 'sortie', { qui: ancien, assis: factice, couleur: '#7a7a7a', dossier: true, retour: false,
      repart: () => { // il est sorti : le nouveau entre par la même porte
        if (!vie.sociale) { montrer(); return; } // les scènes ont été éteintes entre-temps : le nouveau est déjà assis, sans bulle
        enMarche.add(k);
        const siege = etat.noeuds.postes.get(k)?.querySelector('.personnage') || factice; // la chaise d'aujourd'hui (le bureau a pu être redessiné)
        const okEntree = marcher('sortie', k, { qui: nouveau, assis: siege, couleur: hasard(['#3e7cb1', '#2f9e6e', '#d07a2a', '#8e5cc2']), dossier: true, retour: false,
          repart: () => { montrer(); enMarche.delete(k); if (vie.sociale) { bulleBreve(k, salut, 'bulle-embauche', 4000); consigner(nouveau.nom, salut, 'embauche'); } } });
        if (!okEntree) { montrer(); enMarche.delete(k); }
      } });
    if (!okSortie) montrer();
  }
  // ce que le Boss reproche quand Shikem lui a rapporté un complot (accordé au féminin si c'est une collègue)
  const ACCUSATIONS = {
    'نديرو إضراب غدوة ؟': f => `سمعت بلي ${f ? 'راكي تحضّري' : 'راك تحضّر'} إضراب !`,
    'القائد ما يعرف والو': f => `سمعت بلي ${f ? 'تقولي' : 'تقول'} القائد ما يعرف والو !`,
    'نطلبو زيادة في الخلصة': f => `سمعت بلي ${f ? 'حابة' : 'حاب'} زيادة ! الخدمة قبل الدراهم !`,
    'نقلبو عليه الطاولة': f => `سمعت بلي ${f ? 'راكي تحضّري' : 'راك تحضّر'} انقلاب !`,
    'نخبّيو الكارني عليه': f => `سمعت بلي ${f ? 'راكي حابة تخبّي' : 'راك حاب تخبّي'} الكارني !`
  };
  const plaintes = []; // { k, motif, quand } : les complots rapportés par Shikem, réglés par le Boss
  function colereDuBoss(k, plainte = null) {
    relireColere();
    const V = identite(k), t = plainte ? null : fautesDe(k)[0], n = Math.min(3, (avert[k]?.n || 0) + 1), gp = etat.noeuds.postes.get(k);
    if (!t && !plainte) return;
    const f = V.femme, rappel = !!(t && avert[k]?.vues?.[t.id]);
    const reproche = plainte ? `${V.nom} ! ${(ACCUSATIONS[plainte.motif] || (g => `سمعت بلي ${g ? 'راكي تحضّري' : 'راك تحضّر'} حاجة !`))(f)}`
      : rappel ? `${V.nom} ! «${court(t.titre)}» مازالت ما تصلّحتش !` : `${V.nom} ! «${court(t.titre)}» ما عدّاتش !`;
    const script = [
      [0, reproche],
      [0, `إذا ما ${f ? 'تحبّيش تخدمي' : 'تحبّش تخدم'}، ${f ? 'روحي' : 'روح'} ! كاين اللي يخدم في بلاصتك`],
      [1, 'سامحني يا البوس، عندي ولادي نوكّلهم'],
      [0, `ما يهمنيش ولادك ! يا ${f ? 'تخدمي نيشان يا تخرجي' : 'تخدم نيشان يا تخرج'}`],
      [0, n === 1 ? 'هاذا أول إنذار' : n === 2 ? `هاذا ثاني إنذار، المرة الجاية ${f ? 'تخرجي' : 'تخرج'}` : `هاذا ثالث إنذار… ${f ? 'روحي، راكي مطرودة' : 'روح، راك مطرود'} !`],
      [1, n < 3 ? 'صافي يا البوس، ما نعاودش' : 'لا لا يا البوس، الله يخليك…']
    ];
    enMarche.add(k); // il reste assis à se faire crier dessus
    const d = scene = { k, bulles: [], minuteurs: [], g: null }, vider = () => { d.bulles.forEach(x => x.remove()); d.bulles = []; };
    const ok = marcher('boss', k, {
      qui: BOSS_ID, assis: etat.noeuds.bossPersonne, couleur: '#151515', dossier: false, retour: true, pause: script.length * 2600 + 600, decalage: { x: -34, y: 12 }, // à gauche : la main levée et le ⚠ restent visibles
      arrive: (g) => {
        d.g = g; g.classList.add('colere'); g.append(svg('text', { x: 11, y: -60, direction: 'ltr', 'text-anchor': 'start', class: 'colere-signe', text: '💢' }));
        let tour = 0;
        const dire = () => {
          if (scene !== d || tour >= script.length || !g.isConnected) return;
          if (postesOccupes().has(k) || (t && !etat.taches.some(x => x.id === t.id && x.etat === 'echec'))) { vider(); gp?.classList.remove('supplie'); d.annule = true; d.g?.remove(); return; } // faute relancée ou poste au travail : le Boss se tait et se rassoit
          vider();
          const [qui, texte] = script[tour++], p = etat.noeuds.coords.get(k); if (!p) return;
          const b = qui === 0 ? bulle(0, -96, texte) : bulle(p.x, p.y - 70, texte);
          b.classList.add(qui === 0 ? 'bulle-boss' : 'bulle-supplie');
          if (qui === 0) g.append(b); else etat.noeuds.marcheurs.insertBefore(b, g);
          d.bulles.push(b);
          gp?.classList.toggle('supplie', qui === 1); // il lève les mains pour supplier
          consigner(qui === 0 ? 'Le Boss' : V.nom, texte, 'colère', qui === 0 ? V.nom : 'Le Boss');
          if (tour === 5 && plainte) { const j = plaintes.indexOf(plainte); if (j >= 0) plaintes.splice(j, 1); }
          if (tour === 5) { relireColere(); avert[k] = { n, depuis: avert[k]?.depuis || 0, vues: t ? { ...(avert[k]?.vues || {}), [t.id]: Date.now() } : (avert[k]?.vues || {}) }; sauverAvert(); dessinerAvertissements(); } // l'avertissement est donné (pour cette faute, ou pour ce complot)
          if (tour < script.length) d.minuteurs.push(setTimeout(dire, 2600));
        };
        dire();
      },
      repart: () => {
        vider(); d.minuteurs.forEach(clearTimeout); gp?.classList.remove('supplie');
        d.g?.classList.remove('colere'); d.g?.querySelector('.colere-signe')?.remove();
        enMarche.delete(k); if (scene === d) scene = null; derniereScene = performance.now();
        if (vie.sociale && !d.annule && n >= 3 && (avert[k]?.n || 0) >= 3 && !postesOccupes().has(k)) licencier(k);
      }
    });
    if (!ok) { enMarche.delete(k); if (scene === d) scene = null; }
  }
  setInterval(() => { // le Boss regarde les fautes : la première tout de suite, puis au plus une scène toutes les quatre-vingt-dix secondes
    if (!vie.sociale || document.visibilityState === 'hidden' || !greffier() || scene || bossOccupe() || espion.commande || !etat.noeuds.bossPersonne?.isConnected) return; // un seul onglet joue la colère : le greffier (l'onglet regardé le devient)
    if (derniereScene && performance.now() - derniereScene < 90000) return;
    if (managerChezBoss || espionChezBoss()) return;
    const occupes = postesOccupes();
    relireColere();
    const ilotsPris = [discussions.travail?.vers?.split('/')[0], commerage?.a.split('/')[0], espion.victime?.split('/')[0], halab.avec?.split('/')[0], ...ilotsDispute];
    const fautifs = [...etat.noeuds.coords.keys()].filter(k => k.includes('/') && k !== 'manager/manager' && !enMarche.has(k) && !occupes.has(k) && !ilotsPris.includes(k.split('/')[0]) && fautesDe(k).length);
    if (fautifs.length) { colereDuBoss(hasard(fautifs)); return; }
    while (plaintes.length && Date.now() - plaintes[0].quand > 10 * 60000) plaintes.shift(); // une plainte trop vieille est oubliée
    for (let j = plaintes.length - 1; j >= 0; j--) if (plaintes[j].quand <= (avert[plaintes[j].k]?.depuis || 0) || identite(plaintes[j].k).nom !== plaintes[j].nom) plaintes.splice(j, 1); // l'agent visé a été renvoyé entre-temps
    const i = plaintes.findIndex(pl => etat.noeuds.coords.get(pl.k) && !enMarche.has(pl.k) && !occupes.has(pl.k) && !ilotsPris.includes(pl.k.split('/')[0]));
    if (i >= 0) colereDuBoss(plaintes[i].k, plaintes[i]); // 2. retirée de la file seulement quand l'avertissement est donné
  }, 5000);

  /* ===================== la belle du bureau ===================== */
  // Rim, en tenue rose, se promène sans arrêt d'une table à l'autre. Deux ou trois garçons sont tombés amoureux :
  // ils quittent leur table, la suivent en file et des cœurs sortent au-dessus d'eux ; chacun finit par rentrer et un autre prend sa place.
  // Quand elle passe près d'un îlot, deux collègues assis parlent d'elle, puis se remettent au travail.
  const BELLE = { nom: 'ريم la classe', femme: true, latin: true, peau: '#f3cfb0', cheveux: '#5b3622', pantalon: '#f3cfb0', belle: true };
  const ROSE = '#ff5fa2';
  const DIALOGUES_BELLE = [
    ['شفت ريم ؟', 'إيه، شابة بزاف اليوم', 'اللبسة الروز لايقتلها', 'صحّا، نرجعو للخدمة'],
    ['هاديك ريم فاتت', 'ما شاء الله عليها', 'والحلّاب ديما موراها', 'هههه ركّز في الكارني'],
    ['ريم شابة بزاف', 'حتى أنا قلتها', 'ما نقدرش نركّز كي تفوت', 'يا خو كمّل الخدمة'],
    ['شفت الحلّاب يتبع فيها ؟', 'باين طاح فيها', 'معاه الحق، شابة', 'كمّلو قبل ما يجي القائد'],
    ['الحلّاب ما خدم حتى حاجة اليوم', 'غير يتبع ريم', 'القائد ما شافوش ؟', 'شيكم شافو، أكيد']
  ];
  const ecart = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  // un poste qui travaille vraiment (ou attend la parole du client) garde son agent assis : sa couleur et ses marches de tâche restent visibles
  const postesOccupes = () => new Set(etat.taches.filter(t => t.poste && (t.etat === 'encours' || t.etat === 'attente')).map(t => t.departement + '/' + t.poste));
  const belle = { g: null, corps: null, pos: null, cible: null, attente: 0, sens: 1, mode: MOUVEMENT_REDUIT || !vie.sociale ? 'assise' : 'promenade', finPromenade: 0, finAssise: 0 }; // scènes éteintes : Rim travaille à son bureau
  const admirateurs = [];
  let cibleAdmirateurs = 0, dernierRecrutement = 0, commerage = null, dernierCommerage = 0, dernierT = null;
  function nouvelleCibleBelle() {
    const pts = [...etat.noeuds.coords.entries()].filter(([k]) => !['carnet', 'boss', 'cuisine', 'sortie', 'rim'].includes(k)).map(([, p]) => p);
    const p = hasard(pts);
    return { x: p.x - 28 + (Math.random() - .5) * 10, y: p.y + 8 + Math.random() * 6 }; // elle passe à côté des tables
  }
  function creerBelle() {
    const dep = etat.noeuds.coords.get('manager/manager'); if (!dep) return;
    belle.g = svg('g', { class: 'marcheur special belle' });
    belle.corps = humain(ROSE, false, BELLE);
    const nom = etiquetteNom(0, -78, BELLE); nom.classList.add('nom-belle');
    belle.g.append(belle.corps, nom);
    etat.noeuds.marcheurs.append(belle.g);
    belle.pos = { x: dep.x - 30, y: dep.y + 10 }; belle.cible = nouvelleCibleBelle(); belle.attente = 0;
    if (belle.mode === 'assise') { belle.g.style.display = 'none'; const r = etat.noeuds.coords.get('rim'); if (r) belle.pos = { x: r.x - 24, y: r.y + 10 }; }
    else if (belle.mode === 'vers-bureau') belle.mode = 'promenade';
    if (!belle.finPromenade) belle.finPromenade = performance.now() + 25000 + Math.random() * 20000;
  }
  const PAROLES_BOSS_RIM = [
    [0, 'ريم ! ديري واش تحبي، راكي في دارك'],
    [0, 'إذا تحبي ترتاحي، ارتاحي'],
    [0, 'وإذا ما تحبيش تجي غدوة، ما تجيش'],
    [0, 'وإذا يلزمك الدراهم، أنا هنا'],
    [1, 'يعطيك الصحة يا البوس'],
    [0, 'يا الحلّاب Ultra Pro Max ! أرواح لهنا !']
  ];
  function asseoirRim(now) {
    const gRim = etat.noeuds.postes.get('rim'), assise = gRim?.querySelector('.personnage');
    // cinquante secondes : le temps des paroles du Boss, du sermon de الحلّاب et du café
    belle.mode = 'assise'; belle.finAssise = now + 50000; belle.g.style.display = 'none'; if (assise) assise.style.opacity = '';
    if (bossOccupe() || scene || espionChezBoss()) return; // le Boss est pris : elle s'assoit, c'est tout
    rimAvecBoss = true;
    const couche = etat.noeuds.marcheurs, bulles = [];
    let tour = 0;
    const dire = () => {
      bulles.forEach(x => x.remove()); bulles.length = 0;
      if (tour >= PAROLES_BOSS_RIM.length || !couche.isConnected || belle.mode !== 'assise') {
        rimAvecBoss = false;
        if (tour >= PAROLES_BOSS_RIM.length && belle.mode === 'assise' && couche.isConnected) chasserHalab(); // la dernière bulle est déjà retirée
        return;
      }
      const [qui, texte] = PAROLES_BOSS_RIM[tour++], p = etat.noeuds.coords.get(qui === 0 ? 'boss' : 'rim');
      if (p) { const b = bulle(qui === 0 ? p.x : p.x + 40, p.y - (qui === 0 ? 90 : 70), texte); b.classList.add(qui === 0 ? 'bulle-boss' : 'bulle-rim'); couche.append(b); bulles.push(b); }
      consigner(qui === 0 ? 'Le Boss' : BELLE.nom, texte, 'ريم', qui === 0 ? BELLE.nom : 'Le Boss');
      setTimeout(dire, 2600);
    };
    dire();
  }
  function leverRim(now) {
    const gRim = etat.noeuds.postes.get('rim'), assise = gRim?.querySelector('.personnage'), r = etat.noeuds.coords.get('rim');
    if (assise) assise.style.opacity = '0';
    belle.g.style.display = ''; if (r) belle.pos = { x: r.x - 24, y: r.y + 10 };
    belle.mode = 'promenade'; belle.finPromenade = now + 40000 + Math.random() * 20000; belle.cible = nouvelleCibleBelle(); belle.attente = 0;
  }
  /** Avance obj.pos vers cible ; rend { arrive, dx }. */
  function avancer(obj, cible, vitesse, dt) {
    const dx = cible.x - obj.pos.x, dy = cible.y - obj.pos.y, d = Math.hypot(dx, dy), pas = vitesse * dt;
    if (d <= pas) { obj.pos.x = cible.x; obj.pos.y = cible.y; return { arrive: true, dx }; }
    obj.pos.x += dx / d * pas; obj.pos.y += dy / d * pas; return { arrive: false, dx };
  }
  function placer(obj, dx, marche) {
    obj.g.setAttribute('transform', `translate(${obj.pos.x.toFixed(1)},${obj.pos.y.toFixed(1)})`);
    if (Math.abs(dx) > .5) obj.sens = dx < 0 ? -1 : 1;
    obj.corps.setAttribute('transform', `scale(${1.5 * obj.sens},1.5)`);
    obj.g.classList.toggle('arret', !marche);
  }
  function recruter(now) {
    if (now - dernierRecrutement < 1500) return;
    const C = etat.noeuds.coords;
    const occupes = postesOccupes();
    const libres = [...C.keys()].filter(k => k.includes('/') && k !== 'manager/manager' && !enMarche.has(k) && !occupes.has(k) && !identite(k).femme);
    if (!libres.length) return;
    dernierRecrutement = now;
    libres.sort((x, y) => ecart(C.get(x), belle.pos) - ecart(C.get(y), belle.pos)); // un des plus proches d'elle se lève
    const cle = hasard(libres.slice(0, 4)), siege = C.get(cle), id = identite(cle);
    const assis = etat.noeuds.postes.get(cle)?.querySelector('.personnage');
    enMarche.add(cle); if (assis) assis.style.opacity = '0';
    const g = svg('g', { class: 'marcheur special admirateur' });
    const corps = humain(hasard(['#3e7cb1', '#2f9e6e', '#8e5cc2', '#d07a2a']), false, id);
    g.append(corps, etiquetteNom(0, -78, id));
    etat.noeuds.marcheurs.append(g);
    admirateurs.push({ cle, g, corps, assis, pos: { x: siege.x, y: siege.y }, siege: { x: siege.x, y: siege.y }, retour: false, rang: 0, reste: 35000 + Math.random() * 25000, dernierCoeur: 0, sens: 1 });
  }
  function bougerAdmirateurs(dt, now) {
    for (let i = admirateurs.length - 1; i >= 0; i--) if (!admirateurs[i].g.isConnected) { enMarche.delete(admirateurs[i].cle); admirateurs.splice(i, 1); } // bureau redessiné
    const suiveurs = admirateurs.filter(a => !a.retour);
    if (suiveurs.length < cibleAdmirateurs) recruter(now);
    suiveurs.forEach((a, i) => { a.rang = i; });
    const occupes = postesOccupes();
    for (const a of [...admirateurs]) {
      if (!a.retour && occupes.has(a.cle)) a.retour = true; // une vraie tâche arrive à son poste : il rentre travailler
      // 5. en file derrière elle ; s'il se trouve du côté où elle va (demi-tour), il descend sous elle pour la laisser passer au lieu de la traverser
      const devant = !a.retour && Math.sign(a.pos.x - belle.pos.x) === belle.sens;
      const cible = a.retour ? a.siege
        : devant ? { x: belle.pos.x, y: belle.pos.y + 30 + a.rang * 7 }
        : { x: belle.pos.x - belle.sens * (34 + a.rang * 30), y: belle.pos.y + 6 + a.rang * 7 };
      const d = ecart(cible, a.pos);
      const r = d > 3 ? avancer(a, cible, a.retour ? .07 : Math.min(.085, .02 + d * .0009), dt) : { arrive: true, dx: 0 };
      placer(a, d > 3 ? r.dx : belle.pos.x - a.pos.x, d > 3); // arrêté, il la regarde
      if (!a.retour && now - a.dernierCoeur > 650) { a.dernierCoeur = now; coeur(a.pos.x, a.pos.y - 84); }
      if (!a.retour && (a.reste -= dt) <= 0) a.retour = true;
      if (a.retour && r.arrive) { a.g.remove(); if (a.assis) a.assis.style.opacity = ''; enMarche.delete(a.cle); admirateurs.splice(admirateurs.indexOf(a), 1); }
    }
  }
  // الحلّاب : il suit Rim partout, des cœurs au-dessus de la tête ; quand elle tourne, il passe sous elle au lieu de la traverser
  const HALAB = { nom: 'الحلّاب Ultra Pro Max', femme: false, latin: true, peau: '#d8a47c', cheveux: '#1d1d1d', pantalon: '#3b3b3b', halab: true };
  const halab = { g: null, corps: null, pos: null, sens: 1, dernierCoeur: 0, etape: 'suivre', cible: null, avec: null, script: null, tour: 0, prochain: 0, filles: 0, bulles: [], minuteur: null, prochaineDrague: 0 };
  const PLAINTES_HALAB = [ // chez un ami, après s'être fait chasser
    [0, 'شفت البوس ؟ يقولي روح تخدم'],
    [1, 'هههه، وانت واش كنت دير ؟'],
    [0, 'هو اللي حلّاب، ماشي أنا !'],
    [1, 'ما تقولهاش قدامو، يطردك'],
    [0, 'كي ريم تقعد حداه، يولي يتبسّم'],
    [1, 'صحّا، روح تخدم قبل ما يشوفك']
  ];
  const sacDrague = sac(['صباح الخير يا الزينة', 'واش راكي ؟ شابة كيما العادة', 'نجيبلك قهوة ؟', 'عندك نمرة تيليفون ؟', 'نتغداو مع بعض اليوم ؟', 'الشابة هاذي، مخطوبة ولا ؟']);
  const sacRefus = sac(['روح من هنا، أنا مخطوبة !', 'أنا مزوّجة، احشم على روحك !', 'يا الحلّاب، ما تحشمش ؟', 'عندي راجل، روح تخدم !', 'لا لا، روح لريم تاعك', 'نقولها للبوس، روح !']);
  const sacEnchaine = sac(['عادي، نشوف وحدة أخرى', 'ماشي مشكل، الصبر مفتاح الفرج', 'غدوة نعاود نسقسيك', 'صافي، فهمت… نرجع نخدم', 'خسارة، شابة']);
  function halabBulles() { halab.bulles.forEach(x => x.remove()); halab.bulles = []; }
  function halabLibere() { clearTimeout(halab.minuteur); halab.minuteur = null; halabBulles(); if (halab.avec) { enMarche.delete(halab.avec); halab.avec = null; } }
  const SERMON_HALAB = [
    [0, 'خلّي ريم في التالي ! هاذي مرا محترمة'],
    [1, 'حاضر يا البوس… والله غير كنت نسلّم عليها'],
    [0, 'روح تخدم ! ونشوفك حداها مرة أخرى، تخرج !']
  ];
  function chasserHalab() { // le Boss l'appelle : il accourt devant son bureau
    const b = etat.noeuds.coords.get('boss');
    if (!halab.g?.isConnected || !b) return;
    halabAvecBoss = true; // le Boss l'attend : personne d'autre ne lui parle entre-temps
    if (halab.etape === 'drague' || halab.etape === 'ami') { halab.appele = true; return; } // il finit sa visite, puis accourt
    halabLibere(); halab.etape = 'appele'; halab.cible = { x: b.x - 40, y: b.y + 30 };
  }
  function sermonHalab() {
    halab.etape = 'sermon';
    const couche = etat.noeuds.marcheurs;
    let tour = 0;
    const dire = () => {
      halabBulles();
      if (tour >= SERMON_HALAB.length || !halab.g?.isConnected) { // fini : il file se plaindre, et le Boss fait servir un café à Rim
        halabAvecBoss = false; halab.etape = 'chasse';
        if (belle.mode === 'assise' && !espion.commande && espion.g?.isConnected && etat.noeuds.coords.get('cuisine')) {
          espion.commande = { pour: 'rim', demande: 'جيب لريم قهوة', prepare: 'قهوة لريم، بالحليب', sert: 'تفضّلي يا ريم، القهوة', objet: tasse };
          appelerShikem();
        }
        return;
      }
      const [qui, texte] = SERMON_HALAB[tour++], p = etat.noeuds.coords.get('boss');
      const b = qui === 0 ? (p ? bulle(p.x, p.y - 90, texte) : null) : bulle(0, -120, texte);
      if (b) { b.classList.add(qui === 0 ? 'bulle-boss' : 'bulle-halab'); (qui === 0 ? couche : halab.g).append(b); halab.bulles.push(b); }
      consigner(qui === 0 ? 'Le Boss' : HALAB.nom, texte, 'حلّاب-البوس', qui === 0 ? HALAB.nom : 'Le Boss');
      halab.minuteur = setTimeout(dire, 2500);
    };
    dire();
  }
  /** Choisit un collègue assis et libre (garçon pour se plaindre, fille pour draguer), le réserve et va le voir. */
  function halabVaVoir(femme, etape, script) {
    const C = etat.noeuds.coords, occupes = postesOccupes();
    const ilotsPris = [discussions.travail?.vers?.split('/')[0], commerage?.a.split('/')[0], espion.victime?.split('/')[0], scene?.k?.split('/')[0], espion.fitna?.b?.split('/')[0], ...ilotsDispute];
    const choix = [...C.keys()].filter(k => k.includes('/') && k !== 'manager/manager' && !enMarche.has(k) && !occupes.has(k) && !!identite(k).femme === femme && !ilotsPris.includes(k.split('/')[0]));
    if (!choix.length) return false;
    choix.sort((x, y) => ecart(C.get(x), halab.pos) - ecart(C.get(y), halab.pos));
    const k = hasard(choix.slice(0, 5)), p = C.get(k);
    halab.avec = k; enMarche.add(k); halab.etape = etape; halab.cible = { x: p.x - 24, y: p.y + 10 }; halab.script = script; halab.tour = 0;
    return true;
  }
  function halabParle() { // une réplique, puis la suivante 2,4 s plus tard
    halabBulles();
    const p = etat.noeuds.coords.get(halab.avec);
    if (!p || halab.tour >= halab.script.length || !halab.g?.isConnected) { halabFinVisite(); return; }
    const [qui, texte] = halab.script[halab.tour++], autre = identite(halab.avec);
    const b = qui === 0 ? bulle(0, -88, texte) : bulle(p.x, p.y - 70, texte);
    b.classList.add(qui === 0 ? 'bulle-halab' : halab.etape === 'drague' ? 'bulle-dispute' : 'bulle-complot');
    if (qui === 0) halab.g.append(b); else etat.noeuds.marcheurs.insertBefore(b, halab.g);
    halab.bulles.push(b);
    consigner(qui === 0 ? HALAB.nom : autre.nom, texte, halab.etape === 'drague' ? 'حلّاب' : 'حلّاب-البوس', qui === 0 ? autre.nom : HALAB.nom);
    halab.minuteur = setTimeout(halabParle, 2400);
  }
  function halabFinVisite() {
    const etaitDrague = halab.etape === 'drague';
    halabLibere();
    if (halab.appele) { halab.appele = false; const b = etat.noeuds.coords.get('boss'); if (b) { halab.etape = 'appele'; halab.cible = { x: b.x - 40, y: b.y + 30 }; return; } halabAvecBoss = false; }
    // Rim est encore assise près du Boss : il va draguer une autre fille (deux au plus) ; sinon il retourne la suivre
    if (belle.mode === 'assise' && halab.filles < 2 && halabVaVoir(true, 'vers-fille', null)) { halab.filles++; halab.script = [[0, sacDrague()], [1, sacRefus()], [0, sacEnchaine()]]; return; }
    halab.etape = 'suivre'; halab.filles = 0; if (etaitDrague) halab.prochaineDrague = performance.now() + 45000 + Math.random() * 25000;
  }
  function bougerHalab(dt, now) {
    if (!belle.g?.isConnected) return;
    if (!halab.g || !halab.g.isConnected) {
      halabLibere(); halab.etape = 'suivre'; halabAvecBoss = false; halab.appele = false;
      halab.g = svg('g', { class: 'marcheur special halab' });
      halab.corps = humain('#8e5cc2', false, HALAB);
      const nom = etiquetteNom(0, -78, HALAB); nom.classList.add('nom-halab');
      halab.g.append(halab.corps, nom);
      etat.noeuds.marcheurs.insertBefore(halab.g, belle.g); // dessiné sous elle
      halab.pos = { x: belle.pos.x - 60, y: belle.pos.y + 10 };
      halab.prochaineDrague = now + 30000 + Math.random() * 20000;
    }
    halab.g.classList.toggle('court', halab.etape === 'appele');
    if (halab.etape === 'appele') { // il court jusqu'au bureau du Boss
      const r = avancer(halab, halab.cible, .1, dt); placer(halab, r.dx, !r.arrive);
      if (r.arrive && !rimAvecBoss && !enMarche.has('boss') && !scene) sermonHalab(); // il attend que le Boss ait fini avec Rim
      return;
    }
    if (halab.etape === 'sermon') { const b = etat.noeuds.coords.get('boss'); placer(halab, b ? b.x - halab.pos.x : 0, false); return; }
    if (halab.etape === 'chasse') { // le Boss l'a chassé : il file chez un ami se plaindre du Boss
      if (!halabVaVoir(false, 'vers-ami', PLAINTES_HALAB)) halab.etape = 'suivre';
    }
    if (halab.etape === 'suivre' && now > halab.prochaineDrague && belle.mode !== 'assise') { // de temps en temps, il lâche Rim pour draguer une autre
      if (halabVaVoir(true, 'vers-fille', null)) { halab.filles = 1; halab.script = [[0, sacDrague()], [1, sacRefus()], [0, sacEnchaine()]]; } else halab.prochaineDrague = now + 10000;
    }
    if (halab.etape === 'vers-ami' || halab.etape === 'vers-fille') {
      const r = avancer(halab, halab.cible, .075, dt); placer(halab, r.dx, !r.arrive);
      if (r.arrive) { halab.etape = halab.etape === 'vers-ami' ? 'ami' : 'drague'; halabParle(); }
      return;
    }
    if (halab.etape === 'ami' || halab.etape === 'drague') {
      const p = etat.noeuds.coords.get(halab.avec); placer(halab, p ? p.x - halab.pos.x : 0, false);
      if (halab.etape === 'drague' && now - halab.dernierCoeur > 700) { halab.dernierCoeur = now; coeur(halab.pos.x, halab.pos.y - 84); }
      return;
    }
    // il suit Rim (même assise : il reste planté à côté de son bureau, jusqu'à ce que le Boss le chasse)
    const devant = Math.sign(halab.pos.x - belle.pos.x) === belle.sens;
    const rr = belle.mode === 'assise' && etat.noeuds.coords.get('rim');
    const cible = rr ? { x: rr.x + 70, y: rr.y + 50 } : devant ? { x: belle.pos.x, y: belle.pos.y + 30 } : { x: belle.pos.x - belle.sens * 80, y: belle.pos.y + 6 };
    const d = ecart(cible, halab.pos);
    const r = d > 3 ? avancer(halab, cible, Math.min(.085, .02 + d * .0009), dt) : { arrive: true, dx: 0 };
    placer(halab, d > 3 ? r.dx : belle.pos.x - halab.pos.x, d > 3); // arrêté, il la regarde
    if (now - halab.dernierCoeur > 550) { halab.dernierCoeur = now; coeur(halab.pos.x, halab.pos.y - 84); }
  }
  function finCommerage() {
    if (!commerage) return;
    clearInterval(commerage.minuteur); commerage.bulles.forEach(x => x.remove());
    enMarche.delete(commerage.a); enMarche.delete(commerage.b);
    commerage = null; dernierCommerage = performance.now();
  }
  function verifierCommerage(now) {
    if (commerage || now - dernierCommerage < 8000) return;
    const proches = {}, occupes = postesOccupes();
    for (const [k, p] of etat.noeuds.coords) {
      if (!k.includes('/') || k === 'manager/manager' || enMarche.has(k) || occupes.has(k) || ecart(p, belle.pos) > 120) continue;
      if (k.split('/')[0] === discussions.travail?.vers?.split('/')[0]) continue; // pas dans l'îlot où deux collègues discutent déjà
      if ((espion.etape === 'approche' || espion.etape === 'ecoute' || espion.etape === 'fitna') && k.split('/')[0] === espion.victime?.split('/')[0]) continue; // ni là où Shikem écoute
      if (k.split('/')[0] === scene?.k?.split('/')[0] || ilotsDispute.has(k.split('/')[0]) || k.split('/')[0] === halab.avec?.split('/')[0]) continue; // ni là où le Boss crie, où l'on se dispute, où الحلّاب drague
      const d = k.split('/')[0]; (proches[d] = proches[d] || []).push(k);
    }
    const ilots = Object.values(proches).filter(l => l.length >= 2);
    if (!ilots.length) return;
    const [a, b] = hasard(ilots).sort((x, y) => identite(x).femme - identite(y).femme); // les garçons d'abord
    const dialogue = hasard(DIALOGUES_BELLE), C = etat.noeuds.coords, couche = etat.noeuds.marcheurs;
    enMarche.add(a); enMarche.add(b); // ils restent assis le temps de parler
    const c = commerage = { a, b, bulles: [], tour: 0, minuteur: null };
    const parle = () => {
      c.bulles.forEach(x => x.remove()); c.bulles = [];
      if (commerage !== c) return;
      if (c.tour >= dialogue.length || !couche.isConnected) { finCommerage(); return; } // bureau redessiné : on arrête
      const p = C.get(c.tour % 2 === 0 ? a : b);
      const bl = bulle(p.x, p.y - 70, dialogue[c.tour]); bl.classList.add('bulle-commerage');
      consigner(identite(c.tour % 2 === 0 ? a : b).nom, dialogue[c.tour], 'ريم', identite(c.tour % 2 === 0 ? b : a).nom);
      couche.insertBefore(bl, belle.g?.parentNode === couche ? belle.g : null); c.bulles.push(bl); c.tour++;
    };
    parle(); c.minuteur = setInterval(parle, 2200);
  }
  function bougerBelle(dt, now) {
    if (belle.mode === 'assise') { if (now >= belle.finAssise && !rimAvecBoss) leverRim(now); return; }
    const r0 = etat.noeuds.coords.get('rim');
    if (belle.mode === 'promenade' && r0 && now >= belle.finPromenade) { belle.mode = 'vers-bureau'; belle.cible = { x: r0.x - 24, y: r0.y + 10 }; belle.attente = 0; }
    if (belle.attente > now) { placer(belle, 0, false); return; }
    const r = avancer(belle, belle.cible, .055, dt);
    placer(belle, r.dx, !r.arrive);
    if (r.arrive) {
      if (belle.mode === 'vers-bureau') { asseoirRim(now); return; }
      belle.attente = now + 800 + Math.random() * 2200; belle.cible = nouvelleCibleBelle();
    }
    verifierCommerage(now);
  }
  function vieDuBureau(now) {
    requestAnimationFrame(vieDuBureau);
    const dt = dernierT === null ? 16 : Math.min(64, now - dernierT); dernierT = now;
    if (!etat.noeuds.marcheurs || MOUVEMENT_REDUIT || !vie.sociale) return; // scènes éteintes : ni ريم qui se promène, ni الحلّاب, ni شيكم
    if (!belle.g || !belle.g.isConnected) creerBelle();
    if (!belle.g) return;
    bougerBelle(dt, now);
    bougerAdmirateurs(dt, now);
    bougerHalab(dt, now);
    bougerEspion(dt, now);
  }
  requestAnimationFrame(vieDuBureau);

  /* ===================== le bouton des scènes pour rire ===================== */
  function majBoutonVie() {
    $('#bureau')?.classList.toggle('vie-sociale', vie.sociale);
    const b = $('#bouton-vie'); if (b) b.textContent = vie.sociale ? 'خبّي الهدرة والضحك' : 'ورّي الهدرة والضحك'; // le texte dit ce que fait le clic, comme « اطوي المكتب »
  }
  /** Allume ou éteint les scènes. Éteintes : leurs minuteurs s'arrêtent, chacun se rassoit, et le bureau est redessiné sans elles. */
  function appliquerVie(sociale, { garder = true } = {}) {
    vie.sociale = sociale;
    if (garder) memo.ecrire('manita.vieSociale', sociale ? '1' : '0');
    majBoutonVie();
    if (sociale) { if (belle.mode === 'assise' && !MOUVEMENT_REDUIT) belle.finAssise = 0; dessinerAvertissements(); return; } // Rim se lève tout de suite, les ⚠ reviennent
    for (const s of Object.keys(discussions)) { const d = discussions[s]; if (!d) continue; clearInterval(d.minuteur); clearInterval(d.coeurs); d.bulles.forEach(x => x.remove()); enMarche.delete(d.vers); discussions[s] = null; }
    espionLibere(); espion.commande = null; espion.etape = 'choisir'; espion.appelBulle?.remove(); espion.appelBulle = null;
    halabLibere(); halab.appele = false; halabAvecBoss = false;
    finCommerage();
    for (const a of admirateurs.splice(0)) { a.g.remove(); enMarche.delete(a.cle); }
    belle.mode = 'assise'; rimAvecBoss = false; plaintes.length = 0;
    if (etat.bureau && etat.noeuds.marcheurs) construireBureau(); // les marcheurs des scènes partent avec l'ancien dessin (leur fin rassoit chacun)
  }
  addEventListener('storage', e => { if (e.key === 'manita.vieSociale' && (e.newValue === '1') !== vie.sociale) appliquerVie(e.newValue === '1', { garder: false }); }); // un autre onglet a appuyé
  majBoutonVie(); $('#bouton-vie')?.addEventListener('click', () => appliquerVie(!vie.sociale)); // branché tout de suite : il répond même si le serveur tarde (coupure, redémarrage)

  const MARCHEURS = 10; // scènes allumées : toujours dix agents en marche, le bureau montre que le travail tourne
  const MARCHEURS_CALME = 4; // seulement les travailleurs : la plupart sont assis à leur poste, quatre circulent avec un dossier
  let prochainCarnet = 0; // seulement les travailleurs : une course au carnet toutes les trente secondes au plus, celui qui travaille reste surtout à son poste (son halo dit « راهي تخدم »)
  function unMarcheur() {
    const postes = [...etat.noeuds.coords.keys()].filter(k => k.includes('/') && k !== 'manager/manager');
    if (postes.length < 2) return false;
    const actifs = etat.taches.filter(t => t.etat === 'encours' && t.poste).map(t => t.departement + '/' + t.poste);
    const r = Math.random();
    if (actifs.length && r < .35) {
      if (!vie.sociale && performance.now() < prochainCarnet) return false;
      const ok = marcher(hasard(actifs), 'carnet', { dossier: true, retour: true }); if (ok) prochainCarnet = performance.now() + 30000;
      return ok;
    }
    if (r < .45) return marcher('manager/manager', hasard(postes), { couleur: '#3d405b', dossier: false, retour: true });
    const occupes = postesOccupes(); // un poste qui travaille ou attend la parole du client garde son agent assis : il ne se lève que pour sa vraie tâche
    const de = hasard(postes.filter(k => !occupes.has(k))); if (!de) return false;
    const memeIlot = postes.filter(k => k !== de && k.split('/')[0] === de.split('/')[0]);
    const vers = Math.random() < .55 && memeIlot.length ? hasard(memeIlot) : hasard(postes.filter(k => k !== de));
    return marcher(de, vers, { couleur: 'var(--gris)', dossier: !vie.sociale || Math.random() < .5, retour: true });
  }
  setInterval(() => {
    if (document.visibilityState === 'hidden' || !etat.noeuds.marcheurs) return;
    if (marchesEnRetard) marchesDesTaches(); // les marches des vraies tâches passent avant les promenades
    // on complète dès qu'un marcheur se rassoit (quelques essais : un agent déjà debout ne repart pas)
    const voulus = vie.sociale ? MARCHEURS : MARCHEURS_CALME;
    for (let essai = 0; essai < 12 && etat.noeuds.marcheurs.querySelectorAll('.marcheur:not(.special)').length < voulus; essai++) unMarcheur();
  }, 250);

  /** L'état visuel des postes et des compteurs, depuis les vraies tâches. Ne touche que ce qui change. */
  function majBureau() {
    if (!etat.bureau) return;
    marchesDesTaches();
    const maintenant = Date.now();
    const parPoste = new Map();
    for (const t of etat.taches) {
      if (!t.departement || !t.poste) continue;
      const k = t.departement + '/' + t.poste;
      const e = parPoste.get(k) || { encours: false, attente: false, echecRecent: false };
      if (t.etat === 'encours') e.encours = true;
      if (t.etat === 'attente') e.attente = true;
      if (t.etat === 'echec' && maintenant - Date.parse(t.majLe || t.creeLe) < UN_JOUR) e.echecRecent = true;
      parPoste.set(k, e);
    }
    for (const [k, g] of etat.noeuds.postes) {
      const e = parPoste.get(k);
      const v = !e ? 'libre' : e.encours ? 'encours' : e.attente ? 'attente' : e.echecRecent ? 'echec' : 'libre';
      if (g.dataset.etat !== v) g.dataset.etat = v;
    }
    // le manager « travaille » quand une tâche est en routage (encours sans poste encore)
    const routage = etat.taches.some(t => t.etat === 'encours' && !t.poste);
    const gm = etat.noeuds.postes.get('manager/manager');
    if (gm && !parPoste.get('manager/manager')) { const v = routage ? 'encours' : 'libre'; if (gm.dataset.etat !== v) gm.dataset.etat = v; }
    for (const [id, pl] of etat.noeuds.plaques) {
      const enc = etat.taches.filter(t => t.departement === id && t.etat === 'encours').length;
      const fin = etat.taches.filter(t => t.departement === id && t.etat === 'fini').length;
      if (pl.encours.textContent !== String(enc)) pl.encours.textContent = String(enc);
      if (pl.fini.textContent !== String(fin)) pl.fini.textContent = String(fin);
      const fil = etat.noeuds.fils.get(id); if (fil) fil.classList.toggle('actif', enc > 0);
    }
    const s = etat.sante;
    if (s) {
      const n = $('[data-cle="notes"]'), p = $('[data-cle="produits"]');
      if (n && n.textContent !== nombre(s.notes)) n.textContent = nombre(s.notes);
      if (p && p.textContent !== nombre(s.produits)) p.textContent = nombre(s.produits);
      const tg = etat.noeuds.telegram;
      if (tg) {
        tg.point.classList.toggle('vert', !!(s.telegram?.configure && s.telegram?.ecoute));
        const q = s.telegram?.questionsOuvertes ? String(s.telegram.questionsOuvertes) : '0';
        if (tg.questions.textContent !== q) tg.questions.textContent = q;
        const v = q !== '0' ? 'attente' : (s.telegram?.configure && s.telegram?.ecoute ? 'encours' : 'libre');
        if (tg.recep && tg.recep.dataset.etat !== v) tg.recep.dataset.etat = v;
      }
    }
  }

  /* ===================== la barre du haut ===================== */
  function majHaut(s) {
    const fp = JSON.stringify([s.connecteurs, s.usage, s.telegram?.configure, s.telegram?.ecoute, s.version]);
    $('#heure').textContent = heureDe(s.heure) || '--:--';
    if (etat.empreintes.haut === fp) return;
    etat.empreintes.haut = fp;
    $('#version').textContent = s.version ? 'v' + s.version : '';
    const c = $('#connecteurs'); c.innerHTML = '';
    // seulement les connecteurs actifs (connectés ou configurés) : les « pending » et « needs-auth » ne s'affichent pas
    const actifs = (s.connecteurs || []).filter(k => /^(connected|configur)/i.test(k.statut || ''));
    if (!actifs.length) c.append(el('span', { class: 'pastille-vide', text: 'والو مازال' }));
    for (const k of actifs) {
      const ok = true;
      c.append(el('span', { class: 'pastille-connecteur' + (ok ? ' ok' : ''), title: k.statut }, el('i', { class: 'point' }), el('span', { text: k.id }), el('small', { text: '· ' + (k.statut || '?') })));
    }
    $('#usage-fenetre').textContent = nombre(s.usage?.fenetre?.tokens);
    $('#usage-total').textContent = nombre(s.usage?.total?.tokens);
    $('#telegram-point').classList.toggle('vert', !!(s.telegram?.configure && s.telegram?.ecoute));
  }

  /* ===================== les onglets ===================== */
  function ouvrirOnglet(nom, { defiler = false } = {}) {
    etat.onglet = nom; memo.ecrire('manita.onglet', nom);
    for (const b of document.querySelectorAll('.onglet')) { const actif = b.dataset.onglet === nom; b.classList.toggle('actif', actif); b.setAttribute('aria-selected', actif); }
    for (const v of document.querySelectorAll('.vue')) { const actif = v.id === 'vue-' + nom; v.hidden = !actif; v.classList.toggle('actif', actif); }
    if (defiler && telephone()) $('#panneau').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (nom === 'reglages') etat.reglagesACharger = true;
    rafraichirOnglet().catch(e => { if (nom === 'reglages') toast('ما قدرتش نقرا الإعدادات', { erreur: true, brut: e.message }); });
  }

  /* ===================== les tâches ===================== */
  function carteTache(t) {
    const art = el('article', { class: 'tache', 'data-id': t.id, 'data-etat': t.etat });
    const meta = el('div', { class: 'tache-meta' },
      el('span', { class: 'badge ' + t.etat, text: ETIQ[t.etat] || t.etat }),
      el('span', { text: nomDept(t.departement) + (t.poste ? ' · ' + nomPoste(t.departement, t.poste) : '') }),
      el('span', { class: 'origine', text: ORIGINES[t.origine] || t.origine || '' }),
      t.dureeMs ? el('span', { class: 'chiffre', dir: 'ltr', text: secondes(t.dureeMs) }) : null,
      t.usage ? el('span', { class: 'chiffre', dir: 'ltr', text: nombre(t.usage) + ' tokens' }) : null,
      t.modele ? el('span', { class: 'chiffre latin', dir: 'ltr', text: t.modeleUtilise || t.modele }) : null
    );
    const controles = el('div', { class: 'controles' });
    const detailControle = el('div', { class: 'controle-detail', hidden: true });
    for (const [cle, mot] of CONTROLES) {
      const c = t.controles?.[cle];
      const b = el('button', { type: 'button', class: 'pastille ' + classeVerdict(c?.verdict), title: c ? `${c.verdict} — ${c.detail || ''}` : 'مازال ما تراقبش', 'data-controle': cle, text: mot });
      b.addEventListener('click', e => {
        e.stopPropagation();
        const ouvert = etat.controleOuvert.get(t.id) === cle;
        etat.controleOuvert.set(t.id, ouvert ? null : cle);
        for (const x of controles.children) x.classList.toggle('ouverte', !ouvert && x.dataset.controle === cle);
        detailControle.hidden = ouvert;
        if (!ouvert) remplirDetail(detailControle, cle, mot, c);
      });
      controles.append(b);
    }
    if (t.controles?.carnet) controles.append(el('span', { class: 'pastille ' + classeVerdict(t.controles.carnet.verdict), title: t.controles.carnet.detail || '', text: 'الكارني' }));
    const tete = el('header', { class: 'tache-tete' }, el('div', { class: 'tache-titre', dir: 'auto', text: t.titre || t.texte.slice(0, 60) }), meta, controles);
    // les actions
    const actions = el('div', { class: 'tache-actions' });
    const note = el('input', { type: 'text', class: 'note', placeholder: t.etat === 'attente' ? 'نوطة (اختياري)' : 'نوطة التصحيح — لازمة باش تصحّح', value: etat.brouillons.get(t.id) || '' });
    note.addEventListener('input', () => etat.brouillons.set(t.id, note.value));
    note.addEventListener('click', e => e.stopPropagation());
    const bouton = (texte, classe, action) => {
      const b = el('button', { type: 'button', class: 'bouton ' + classe, text: texte });
      b.addEventListener('click', async e => {
        e.stopPropagation(); b.disabled = true;
        try { await action(); etat.brouillons.delete(t.id); await rafraichir(); }
        catch (err) { toast('ما مشاتش', { erreur: true, brut: err.message }); }
        finally { b.disabled = false; }
      });
      return b;
    };
    if (t.etat === 'attente') {
      actions.append(
        bouton('لانسي', 'gros vert', () => api(`/api/taches/${t.id}/approuver`, { method: 'POST' })),
        bouton('لا', 'gros rouge', () => api(`/api/taches/${t.id}/refuser`, { method: 'POST', body: { note: note.value.trim() } })),
        note
      );
    } else if (t.etat === 'fini' || t.etat === 'echec') {
      actions.append(
        bouton('صحّح', 'principal', async () => {
          if (!note.value.trim()) { note.classList.remove('secouer'); void note.offsetWidth; note.classList.add('secouer'); note.focus(); throw new Error('اكتب نوطة التصحيح قبل'); }
          await api(`/api/taches/${t.id}/reviser`, { method: 'POST', body: { note: note.value.trim() } });
        }),
        bouton('عاود', '', () => api(`/api/taches/${t.id}/relancer`, { method: 'POST' })),
        bouton('امسح', 'rouge discret', async () => { if (!confirm('نمسح هاذ الخدمة ؟')) return; await api(`/api/taches/${t.id}`, { method: 'DELETE' }); etat.deplies.delete(t.id); }),
        note
      );
    }
    // le livrable, déplié au clic
    const corps = el('div', { class: 'tache-corps', hidden: !etat.deplies.has(t.id) });
    const infos = el('div', { class: 'infos' }, el('span', { text: 'زادت' }), el('span', { class: 'chiffre', dir: 'ltr', text: dateDe(t.creeLe) }));
    if (t.phase) infos.append(el('span', { class: 'latin', dir: 'ltr', text: 'phase : ' + t.phase }));
    if (t.approbation?.reponse) infos.append(el('span', { class: 'latin', dir: 'ltr', text: 'réponse : ' + t.approbation.reponse + ' (' + (t.approbation.par || '') + ')' }));
    corps.append(infos);
    if (t.pourquoi) corps.append(el('div', { class: 'sous-titre', text: 'علاش هاذ القسم' }), blocTexte(t.pourquoi, 'texte-livrable'));
    if (t.etat === 'attente' && t.approbation) corps.append(el('div', { class: 'sous-titre', text: t.approbation.telegram?.envoye ? 'السؤال راح لتيليغرام' : 'السؤال ما راحش لتيليغرام' }), t.approbation.telegram?.fautes?.length ? blocTexte(t.approbation.telegram.fautes.join('\n'), 'texte-livrable') : null);
    corps.append(el('div', { class: 'sous-titre', text: 'الخدمة المطلوبة' }), blocTexte(t.texte));
    if (t.erreur) corps.append(el('div', { class: 'erreur-cadre', dir: 'auto', text: t.erreur }));
    if (t.resultat) corps.append(el('div', { class: 'sous-titre', text: 'اللي رجع' }), blocTexte(t.resultat));
    else if (!t.erreur) corps.append(el('p', { class: 'vide', text: t.etat === 'encours' ? 'راهي تخدم — استنى' : 'مازال ما رجع والو' }));
    if (t.outilsUtilises?.length) corps.append(el('div', { class: 'infos' }, el('span', { text: 'الأدوات اللي خدم بيهم' }), el('span', { class: 'latin', dir: 'ltr', text: t.outilsUtilises.join(', ') })));
    if (t.note) { const b = el('button', { type: 'button', class: 'lien-note', text: 'النوطة في الكارني' }); b.addEventListener('click', e => { e.stopPropagation(); ouvrirNote(t.note, t.titre); }); corps.append(el('div', { class: 'infos' }, b, el('span', { class: 'latin chemin', dir: 'ltr', text: t.note }))); }
    tete.addEventListener('click', () => { const ouvert = corps.hidden; corps.hidden = !ouvert; if (ouvert) etat.deplies.add(t.id); else etat.deplies.delete(t.id); });
    art.append(tete, detailControle, actions, corps);
    if (etat.controleOuvert.get(t.id)) { const cle = etat.controleOuvert.get(t.id); const c = t.controles?.[cle]; remplirDetail(detailControle, cle, CONTROLES.find(x => x[0] === cle)?.[1] || cle, c); detailControle.hidden = false; controles.querySelector(`[data-controle="${cle}"]`)?.classList.add('ouverte'); }
    return art;
  }
  function remplirDetail(boite, cle, mot, c) {
    boite.innerHTML = '';
    if (!c) { boite.append(el('b', { text: mot }), ' — ', 'مازال ما تراقبش'); return; }
    boite.append(el('b', { text: mot }), ' ', el('span', { class: 'latin', dir: 'ltr', text: c.verdict }), el('div', { dir: 'auto', text: c.detail || '' }));
    const fautes = (c.fautes || []).filter(f => !(c.detail || '').includes(f)); // le détail du serveur reprend déjà les fautes : on n'affiche que ce qui manque
    if (fautes.length) boite.append(el('ul', {}, fautes.map(f => el('li', { dir: 'auto', text: f }))));
    if (c.aCorriger) boite.append(el('div', { dir: 'auto' }, el('b', { text: 'واش يتصحّح : ' }), c.aCorriger));
  }
  function majTaches(liste) {
    etat.taches = liste;
    const conteneur = $('#liste-taches');
    const vide = conteneur.querySelector(':scope > .vide');
    if (!liste.length) { if (!vide) { conteneur.innerHTML = ''; conteneur.append(el('p', { class: 'vide', text: 'ما كاين حتى خدمة مازال' })); } etat.cartes.clear(); }
    else {
      if (vide) vide.remove();
      const vus = new Set(); let precedent = null;
      for (const t of liste) {
        vus.add(t.id);
        const fp = JSON.stringify(t);
        let c = etat.cartes.get(t.id);
        if (!c || c.fp !== fp) { const neuf = carteTache(t); if (c) c.el.replaceWith(neuf); else conteneur.append(neuf); c = { fp, el: neuf }; etat.cartes.set(t.id, c); }
        const attendu = precedent ? precedent.nextElementSibling : conteneur.firstElementChild;
        if (attendu !== c.el) conteneur.insertBefore(c.el, precedent ? precedent.nextElementSibling : conteneur.firstElementChild);
        precedent = c.el;
      }
      for (const [id, c] of etat.cartes) if (!vus.has(id)) { c.el.remove(); etat.cartes.delete(id); }
    }
    // les puces
    const comptes = {}; for (const t of liste) comptes[t.etat] = (comptes[t.etat] || 0) + 1;
    const fp = JSON.stringify(comptes);
    if (etat.empreintes.puces !== fp) {
      etat.empreintes.puces = fp;
      const p = $('#puces-etats'); p.innerHTML = '';
      for (const k of ['encours', 'attente', 'fini', 'echec', 'afaire']) if (comptes[k] || k !== 'afaire') p.append(el('span', { class: 'puce ' + k }, el('span', { text: ETIQ[k] }), el('b', { dir: 'ltr', text: String(comptes[k] || 0) })));
      const badge = $('#compte-attente'); badge.hidden = !comptes.attente; badge.textContent = String(comptes.attente || 0);
    }
    majBureau();
  }

  /* ===================== le coach ===================== */
  function majCoach(messages) {
    const fp = JSON.stringify(messages);
    if (etat.empreintes.coach === fp) return;
    etat.empreintes.coach = fp;
    const c = $('#conversation'); c.innerHTML = '';
    if (!messages.length) c.append(el('p', { class: 'vide', text: 'مازال ما هدرتوش' }));
    for (const m of messages) {
      const b = blocTexte(m.texte, 'bulle ' + (m.de === 'client' ? 'client' : 'coach'));
      b.append(el('time', { text: heureDe(m.quand) }));
      c.append(b);
    }
    c.scrollTop = c.scrollHeight;
  }

  /* ===================== le carnet ===================== */
  function majCarnet(c) {
    const fp = JSON.stringify(c);
    if (etat.empreintes.carnet === fp) return;
    etat.empreintes.carnet = fp;
    const P = $('#carnet-produits'); P.innerHTML = '';
    if (!c.produits?.length) P.append(el('p', { class: 'vide', text: 'ما كاين حتى منتوج في الكارني' }));
    else {
      const tete = ['المنتوج', 'الأيام', 'الطلبيات', 'المؤكدة', 'الموصلة', 'المصروف'];
      const table = el('table', { class: 'etroite' }, el('thead', {}, el('tr', {}, tete.map(h => el('th', { text: h })))));
      const corps = el('tbody');
      for (const p of c.produits) corps.append(el('tr', {},
        el('td', { class: 'nom', title: p.fichier, text: p.produit || p.fichier }),
        ...(p.erreur ? [el('td', { colspan: 5, class: 'latin', text: p.erreur })] : [p.jours, p.commandes, p.confirmees, p.livrees, p.depense].map(v => el('td', { class: 'nombre', text: nombre(v) })))
      ));
      table.append(corps); P.append(table);
    }
    const N = $('#carnet-notes'); N.innerHTML = '';
    if (!c.notes?.length) N.append(el('p', { class: 'vide', text: 'الكارني فارغ مازال' }));
    for (const n of c.notes || []) {
      const b = el('button', { type: 'button', class: 'note-ligne' }, el('span', { class: 't', dir: 'auto', text: n.titre }), el('span', { class: 'd', text: dateDe(n.date) + (n.departement ? ' · ' + n.departement : '') }), n.apercu ? el('span', { class: 'q', dir: 'auto', text: n.apercu.slice(0, 110) }) : null);
      b.addEventListener('click', () => ouvrirNote(n.chemin, n.titre));
      N.append(b);
    }
    const G = $('#carnet-graphe'); G.innerHTML = '';
    const noeuds = c.graphe?.noeuds || [];
    if (!noeuds.length) G.append(el('p', { class: 'vide', text: 'ما كاين حتى نوطة' }));
    else {
      const W = 420, H = Math.max(240, Math.min(420, 120 + noeuds.length * 14)), cx = W / 2, cy = H / 2, rx = W / 2 - (noeuds.length <= 30 ? 125 : 30), ry = H / 2 - 30;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}` });
      const place = new Map();
      noeuds.forEach((n, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / noeuds.length; place.set(n.id, [cx + rx * Math.cos(a), cy + ry * Math.sin(a), a]); });
      for (const l of c.graphe.liens || []) { const a = place.get(l.de), b = place.get(l.vers); if (a && b) s.append(svg('line', { class: 'graphe-lien', x1: a[0], y1: a[1], x2: b[0], y2: b[1] })); }
      for (const n of noeuds) {
        const [x, y, a] = place.get(n.id); const d = dept(n.departement);
        const g = svg('g', { class: 'graphe-noeud', 'data-id': n.id }, svg('title', { text: n.titre }), svg('circle', { cx: x, cy: y, r: noeuds.length > 30 ? 4 : 6, fill: d?.couleur || '#b8a48c', stroke: 'rgba(0,0,0,.2)' }));
        if (noeuds.length <= 30) { const droite = Math.cos(a) >= 0; g.append(svg('text', { x: x + (droite ? 9 : -9), y: y + 3, 'text-anchor': droite ? 'start' : 'end', direction: ARABE.test(n.titre) ? 'rtl' : 'ltr', text: String(n.titre).slice(0, 22) })); }
        g.addEventListener('click', () => { const note = (c.notes || []).find(x => x.nom === n.id); if (note) ouvrirNote(note.chemin, note.titre); });
        s.append(g);
      }
      G.append(s);
    }
    const L = $('#carnet-lecons'); L.innerHTML = '';
    for (const d of etat.bureau.departements) {
      const liste = c.lecons?.[d.id] || [];
      L.append(el('details', {}, el('summary', {}, el('span', { text: d.nomAr }), el('span', { class: 'chiffre', dir: 'ltr', text: String(liste.length) })), liste.length ? el('ul', {}, liste.map(x => el('li', { dir: 'auto', text: x }))) : el('p', { class: 'vide', text: 'ما كاين حتى درس' })));
    }
  }
  async function ouvrirNote(chemin, titre) {
    ouvrirOnglet('carnet');
    const v = $('#volet-note'); v.hidden = false;
    $('#volet-titre').textContent = titre || chemin;
    const contenu = $('#volet-contenu'); contenu.innerHTML = ''; contenu.append(el('p', { class: 'vide', text: 'راني نقرا' }));
    try {
      const r = await api('/api/carnet/note?chemin=' + encodeURIComponent(chemin));
      // l'en-tête YAML de la note (--- … ---) devient une ligne d'infos ; le corps garde ses retours à la ligne
      const m = /^---\n([\s\S]*?)\n---\n?/.exec(r.contenu || ''); const corps = m ? r.contenu.slice(m[0].length) : (r.contenu || '');
      contenu.innerHTML = '';
      if (m) {
        const e = {}; for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) { let v = l.slice(i + 1).trim(); try { v = JSON.parse(v); } catch {} e[l.slice(0, i).trim()] = v; } }
        const infos = el('div', { class: 'infos note-infos' });
        if (e.date) infos.append(el('span', { class: 'chiffre', dir: 'ltr', text: dateDe(e.date) }));
        if (e.departement) infos.append(el('span', { text: nomDept(e.departement) + (e.poste ? ' · ' + nomPoste(e.departement, e.poste) : '') }));
        if (e.modele) infos.append(el('span', { class: 'latin', dir: 'ltr', text: e.modele }));
        if (e.controles && typeof e.controles === 'object') for (const [cle, mot] of CONTROLES) if (e.controles[cle]) infos.append(el('span', { class: 'pastille ' + classeVerdict(e.controles[cle]), text: mot }));
        contenu.append(infos);
      }
      contenu.append(...blocTexte(corps.trim()).children);
    }
    catch (e) { contenu.innerHTML = ''; contenu.append(el('div', { class: 'erreur-cadre', text: e.message })); }
    v.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ===================== les routines ===================== */
  function majRoutines(liste) {
    const fp = JSON.stringify(liste);
    if (etat.empreintes.routines === fp) return;
    etat.empreintes.routines = fp;
    const L = $('#liste-routines'); L.innerHTML = '';
    if (!liste.length) L.append(el('p', { class: 'vide', text: 'ما كاين حتى روتين' }));
    for (const r of liste) {
      const action = (texte, classe, fn) => { const b = el('button', { type: 'button', class: 'bouton-mini ' + classe, text: texte }); b.addEventListener('click', async () => { b.disabled = true; try { await fn(); etat.empreintes.routines = null; await rafraichirOnglet(); } catch (e) { toast('ما مشاتش', { erreur: true, brut: e.message }); } finally { b.disabled = false; } }); return b; };
      L.append(el('div', { class: 'routine' + (r.enPause ? ' pause' : '') },
        el('div', { class: 'r-texte', dir: 'auto', text: r.texte }),
        el('div', { class: 'r-meta' },
          el('span', { text: nomDept(r.departement) }),
          el('span', { class: 'chiffre', dir: 'ltr', text: r.heure }),
          el('span', { text: r.jours === 'semaine' ? 'أيام الخدمة برك' : 'كل يوم' }),
          el('span', { text: r.besoinOk ? 'لازم كلمتك قبل' : 'تمشي وحدها' }),
          el('span', { text: r.enPause ? 'موقّفة' : 'الجاية' }), r.enPause ? null : el('span', { class: 'chiffre', dir: 'ltr', text: r.prochaineA ? dateDe(r.prochaineA) : '—' }),
          r.derniere ? el('span', { text: 'الأخيرة' }) : null, r.derniere ? el('span', { class: 'chiffre', dir: 'ltr', text: dateDe(r.derniere) }) : null
        ),
        el('div', { class: 'r-actions' },
          r.enPause ? action('كمّل', '', () => api(`/api/routines/${r.id}/reprendre`, { method: 'POST' })) : action('وقّف', '', () => api(`/api/routines/${r.id}/pause`, { method: 'POST' })),
          action('دروك', '', async () => { if (!confirm('نلانسي هاذ الروتين دروك ؟ (تستهلك من الكوطا)')) return; await api(`/api/routines/${r.id}/maintenant`, { method: 'POST' }); toast('راحت للطابور'); }),
          action('امسح', '', async () => { if (!confirm('نمسح هاذ الروتين ؟')) return; await api(`/api/routines/${r.id}`, { method: 'DELETE' }); })
        )
      ));
    }
  }

  /* ===================== le journal ===================== */
  function majJournal(j) {
    const texte = (j.lignes || []).join('\n');
    if (etat.empreintes.journal === texte) return;
    etat.empreintes.journal = texte;
    const pre = $('#journal');
    const enBas = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
    pre.textContent = texte || '(الجورنال فارغ)';
    if (enBas) pre.scrollTop = pre.scrollHeight;
  }

  function majBavardages(j) {
    const lignes = (j.lignes || []).slice(-150);
    const fp = lignes.length + '|' + (lignes[lignes.length - 1]?.quand || '');
    if (etat.empreintes.bavardages === fp) return;
    etat.empreintes.bavardages = fp;
    const boite = $('#bavardages'); if (!boite) return;
    const enBas = boite.scrollHeight - boite.scrollTop - boite.clientHeight < 40;
    boite.innerHTML = '';
    if (!lignes.length) boite.append(el('p', { class: 'vide', text: 'حتى واحد ما هدر مازال' }));
    for (const l of lignes) {
      const h = new Date(l.quand); const heure = isNaN(h) ? '' : h.toTimeString().slice(0, 5);
      boite.append(el('div', { class: 'bavardage', dir: 'rtl' },
        el('span', { class: 'bavardage-heure latin', dir: 'ltr', text: heure }),
        el('b', { dir: 'auto', text: l.qui }), l.a ? el('span', { class: 'bavardage-a', dir: 'auto', text: ' ← ' + l.a }) : null,
        el('span', { dir: 'auto', text: ' : ' + l.texte })));
    }
    if (enBas) boite.scrollTop = boite.scrollHeight;
  }

  /* ===================== les réglages (config.local.json du client) ===================== */
  const ERREURS_REGLAGES = { 'modèle inconnu': 'الموديل ماشي معروف', 'nom vide': 'اسم البيزنس فارغ', 'JSON invalide': 'الفورم ما تقراش', 'créas par modèle : 1, 2, 3 ou 4': 'الكريات : واحد، زوج، ثلاثة ولا أربعة برك' };
  const nombreOuNul = v => { const s = String(v ?? '').trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const champNombre = (id, v) => { $(id).value = v === null || v === undefined || v === '' ? '' : String(v); };
  /** Remplit le formulaire depuis GET /api/reglages. Le champ du mot de passe reste toujours vide : seul le masque « ••••1234 » sert de placeholder. */
  function majReglages(r) {
    etat.reglages = r;
    $('#reg-nom').value = r.nom || '';
    const m = $('#reg-modele'); if ([...m.options].some(o => o.value === r.modele)) m.value = r.modele;
    $('#reg-port').textContent = r.port ? String(r.port) : '—';
    $('#reg-maison').textContent = r.maison || '—';
    const token = $('#reg-tg-token'); token.value = ''; token.placeholder = r.telegram?.token || 'من BotFather';
    $('#reg-tg-chat').value = r.telegram?.chat_id || '';
    $('#reg-tg-essai').disabled = !r.telegram?.configure;
    $('#reg-tg-effacer').hidden = !(r.telegram?.token || r.telegram?.chat_id);
    $('#reg-tg-etat').textContent = r.telegram?.configure ? 'مركّب' : 'ماشي مركّب';
    champNombre('#reg-emballage', r.couts?.emballage); champNombre('#reg-retour', r.couts?.retour); champNombre('#reg-livraison', r.couts?.livraison);
    champNombre('#reg-confirmation', r.declare?.confirmation); champNombre('#reg-livraison-pct', r.declare?.livraison);
    majWilayas(r);
    $('#reg-creas').value = String([1, 2, 3, 4].includes(+r.creasParModele) ? +r.creasParModele : 4); // les créas du test, 1 à 4 (défaut quatre)
    { const e = $('#reg-ecart-meta'); if (e) { const v = Number.isInteger(+r.ecartMetaHeures) ? +r.ecartMetaHeures : 2; if (![...e.options].some(o => +o.value === v)) e.add(new Option(String(v), String(v))); e.value = String(v); } } // [porte-groupee] écart entre les heures de début (0 à 12, défaut 2)
    $('#reg-atelier').value = r.atelier || '';
  }
  /* les 25 wilayas du vendeur : les clés lues chez Meta (التحضير, « جيب الولايات »), une case par wilaya ; le client
     décoche celles où il ne livre pas, en ajoute une à la main (sa clé Meta), et CONFIRME — sans confirmation, rien ne part */
  let wilayasAjout = [], wilayasVues = [];
  function majWilayas(r) {
    const cb = r.ciblage && r.ciblage.type === 'regions' && Array.isArray(r.ciblage.regions) ? r.ciblage : null;
    wilayasAjout = []; wilayasVues = cb ? cb.regions.map(x => String(x.key)) : [];
    const z = $('#reg-wilayas-liste'); z.innerHTML = '';
    if (!cb || !cb.regions.length) z.append(el('p', { class: 'vide', text: 'مازال ما جبناش الولايات : التحضير، « جيب الولايات »' }));
    for (const x of cb ? cb.regions : []) z.append(caseWilaya(x.key, x.wilaya || x.nom, x.source === 'client', x.wilaya));
    const nord = r.wilayasNord || [], manquent = nord.filter(w => !(cb ? cb.regions : []).some(x => x.wilaya === w));
    const m = $('#reg-wilayas-manquent'); m.hidden = !(cb && manquent.length); m.textContent = '';
    if (cb && manquent.length) m.append('ما لقيناش الكود تاع : ', el('span', { class: 'latin', dir: 'ltr', text: manquent.join(' · ') }));
    const sel = $('#reg-wilaya-ajout'); sel.innerHTML = ''; for (const w of nord) sel.append(el('option', { value: w, text: w }));
    if (manquent.length) sel.value = manquent[0];
    $('#reg-wilayas-ok').checked = !!(cb && cb.confirme === true);
  }
  function caseWilaya(key, nom, main, wilaya = '') {
    return el('label', {}, el('input', { type: 'checkbox', checked: true, dataset: { cle: String(key), wilaya: wilaya || '' } }), el('span', { class: 'latin', dir: 'ltr', text: `${nom} · ${key}` }), main ? el('small', { text: 'يدوي' }) : null);
  }
  function ajouterWilaya() {
    const key = $('#reg-wilaya-cle').value.trim(), wilaya = $('#reg-wilaya-ajout').value;
    if (!/^\d{1,12}$/.test(key) || !wilaya) { toast('الكود تاع ميتا أرقام برك', { erreur: true }); return; }
    wilayasAjout = wilayasAjout.filter(x => x.key !== key && x.wilaya !== wilaya).concat([{ key, wilaya }]);
    const z = $('#reg-wilayas-liste'); const vide = z.querySelector('.vide'); if (vide) vide.remove();
    // une clé ajoutée remplace celle de sa wilaya (le serveur fait pareil) : une seule case par wilaya
    for (const c of z.querySelectorAll('input[data-cle]')) if (c.dataset.cle === key || c.dataset.wilaya === wilaya) c.closest('label').remove();
    z.append(caseWilaya(key, wilaya, true, wilaya)); $('#reg-wilaya-cle').value = '';
    $('#reg-wilayas-ok').checked = false; // une liste changée se confirme de nouveau
  }
  /** Ce que le serveur fusionne (ciblageDuClient) : rien si aucune wilaya n'a jamais été lue ni ajoutée. */
  function corpsWilayas() {
    const coches = [...document.querySelectorAll('#reg-wilayas-liste input[data-cle]')].filter(c => c.checked).map(c => c.dataset.cle);
    if (!wilayasVues.length && !wilayasAjout.length) return undefined;
    return { vus: wilayasVues, garder: coches.filter(k => wilayasVues.includes(k)), ajouter: wilayasAjout.filter(x => coches.includes(x.key)), confirme: $('#reg-wilayas-ok').checked };
  }
  async function chargerReglages() { majReglages(await api('/api/reglages')); }
  async function sauverReglages() {
    const b = $('#reg-sauver'); const etatTexte = $('#reg-etat');
    const nom = $('#reg-nom').value.trim();
    if (!nom) { $('#reg-nom').focus(); toast('اسم البيزنس فارغ', { erreur: true }); return; }
    const corps = {
      nom, modele: $('#reg-modele').value, atelier: $('#reg-atelier').value.trim(), ciblage: corpsWilayas(), creasParModele: Number($('#reg-creas').value), ...($('#reg-ecart-meta') ? { ecartMetaHeures: Number($('#reg-ecart-meta').value) } : {}),
      couts: { emballage: nombreOuNul($('#reg-emballage').value), retour: nombreOuNul($('#reg-retour').value), livraison: nombreOuNul($('#reg-livraison').value) },
      declare: { confirmation: nombreOuNul($('#reg-confirmation').value), livraison: nombreOuNul($('#reg-livraison-pct').value) },
      telegram: { chat_id: $('#reg-tg-chat').value.trim() }
    };
    const token = $('#reg-tg-token').value.trim();
    if (token) corps.telegram.token = token; // jamais renvoyé sinon : le serveur garde celui qu'il a
    b.disabled = true; etatTexte.textContent = 'راني نسجّل';
    try {
      const r = await api('/api/reglages', { method: 'POST', body: corps });
      majReglages(r); etatTexte.textContent = '';
      // « نأكّد » coché mais pas confirmé : une wilaya a été lue pendant que la page était ouverte (le serveur ne confirme
      // jamais une clé que la page n'a pas montrée) — elle est maintenant dans la liste, à regarder puis à confirmer
      const cb = corps.ciblage, jdad = cb && r.ciblage && Array.isArray(r.ciblage.regions) ? r.ciblage.regions.filter(x => !cb.vus.includes(String(x.key)) && !cb.ajouter.some(a => a.key === String(x.key))) : [];
      if (cb && cb.confirme && !r.ciblage?.confirme && jdad.length) toast('تسجّل، بصح كاين ولايات جداد : شوفهم وأكّد مرة أخرى', { erreur: true });
      else toast('تسجّل');
      await rafraichir();
    } catch (e) { etatTexte.textContent = ''; toast(ERREURS_REGLAGES[e.message] || 'ما تسجّلش', { erreur: true, brut: e.message }); }
    finally { b.disabled = false; }
  }
  async function essayerTelegram(bouton) {
    bouton.disabled = true;
    try { const r = await api('/api/telegram/essai', { method: 'POST' }); toast(r.envoye ? 'راحت الرسالة — شوف تيليغرام تاعك' : 'ما راحتش', { erreur: !r.envoye, brut: (r.fautes || []).join(' ; ') }); }
    catch (e) { toast('ما راحتش', { erreur: true, brut: e.message }); }
    finally { bouton.disabled = false; }
  }
  async function effacerTelegram() {
    if (!confirm('نمسح المفتاح و chat_id تاع تيليغرام ؟')) return;
    try { majReglages(await api('/api/reglages', { method: 'POST', body: { telegram: { effacer: true } } })); toast('تمسح'); await rafraichir(); }
    catch (e) { toast('ما تمسحش', { erreur: true, brut: e.message }); }
  }

  /* ===================== les fiches ===================== */
  async function ouvrirFiche(id) {
    const B = etat.bureau; const d = id === 'manager' ? { ...B.centre, postes: [], connecteurs: [] } : dept(id);
    if (!d) return;
    $('#fiche-nomAr').textContent = d.nomAr; $('#fiche-nom').textContent = d.nom; $('#fiche-role').textContent = d.role || '';
    const nT = etat.taches.filter(t => t.departement === id);
    $('#fiche-compte').textContent = `${nT.length} · ${nT.filter(t => t.etat === 'encours').length} en cours · ${nT.filter(t => t.etat === 'attente').length} en attente · ${nT.filter(t => t.etat === 'fini').length} finies · ${nT.filter(t => t.etat === 'echec').length} échecs`;
    const U = $('#fiche-postes'); U.innerHTML = '';
    for (const p of d.postes || []) { const g = etat.noeuds.postes.get(id + '/' + p.id); U.append(el('li', {}, el('span', { class: 'p-ar' }, el('i', { class: 'p-etat ' + (g?.dataset.etat || 'libre') }), p.nomAr), el('span', { class: 'p-lat', text: p.nom }), el('span', { class: 'p-role', dir: 'auto', text: p.role }))); }
    if (!(d.postes || []).length) U.append(el('li', {}, el('span', { class: 'p-role', text: 'ما عندو حتى بوسط : هو اللي يقسم الخدمة' })));
    $('#fiche-skill').textContent = d.skill || '—';
    $('#fiche-outil').textContent = d.outilPython || '—';
    const o = etat.outils?.outils?.find(x => x.departement === id);
    $('#fiche-outil-present').textContent = !d.outilPython ? 'هاذ القسم ما عندوش أداة Python' : !etat.outils?.atelier ? 'الأتيلي ماشي مركّب (config.local.json)' : o?.present ? 'الأداة موجودة' : 'الأداة ناقصة';
    const bv = $('#fiche-verifier'); bv.hidden = !d.outilPython; bv.disabled = false; bv.dataset.dept = id;
    const V = $('#fiche-verdict'); V.hidden = true; V.className = 'verdict-cadre';
    const C = $('#fiche-connecteurs'); C.innerHTML = '';
    if (!(d.connecteurs || []).length) C.append(el('span', { class: 'pastille-vide', text: 'حتى واحد' }));
    for (const k of d.connecteurs || []) { const vu = etat.sante?.connecteurs?.find(x => x.id === k); const ok = !!etat.sante?.prefixes?.[k] || (vu && /^(connected|configur)/i.test(vu.statut || '')); C.append(el('span', { class: 'pastille-connecteur' + (ok ? ' ok' : ''), title: vu?.statut || 'ما شفناهش مازال' }, el('i', { class: 'point' }), el('span', { text: k }))); }
    $('#fiche-chat').hidden = !d.voix;
    $('#fiche-dept').showModal();
  }
  async function verifierOutil(id) {
    const b = $('#fiche-verifier'), V = $('#fiche-verdict');
    b.disabled = true; V.hidden = false; V.className = 'verdict-cadre'; V.textContent = 'راني نتحقّق — تقدر تطول';
    try { const r = await api(`/api/outils/${id}/verifier`, { method: 'POST' }); V.className = 'verdict-cadre ' + classeVerdict(r.verdict); V.innerHTML = ''; V.append(el('span', { text: r.verdict === 'PASSE' ? 'الأداة تخدم مليح' : r.verdict === 'ECHEC' ? 'الأداة ما خدمتش' : 'ما قدرناش نتحققو' }), el('span', { class: 'detail', text: (r.verdict || '') + ' — ' + (r.detail || '') })); }
    catch (e) { V.className = 'verdict-cadre echec'; V.textContent = e.message; }
    finally { b.disabled = false; }
  }
  async function ouvrirTelegram() {
    const corps = $('#telegram-corps'); corps.innerHTML = ''; corps.append(el('p', { class: 'vide', text: 'راني نقرا' }));
    $('#fiche-telegram').showModal();
    let t; try { t = await api('/api/telegram'); } catch (e) { corps.innerHTML = ''; corps.append(el('div', { class: 'erreur-cadre', text: e.message })); return; }
    corps.innerHTML = '';
    const ligne = (mot, valeur) => el('div', { class: 'tg-ligne' }, el('span', { text: mot }), el('span', { class: 'v', text: valeur }));
    corps.append(
      ligne('مركّب', t.configure ? 'واه' : 'لا'),
      ligne('راه يسمع', t.ecoute ? 'واه' : 'لا'),
      ligne('آخر إرسال', t.dernierEnvoi ? dateDe(t.dernierEnvoi) : '—'),
      ligne('آخر رد', t.dernierRetour ? dateDe(t.dernierRetour) : '—'),
      ligne('أسئلة مفتوحة', String(t.questionsOuvertes || 0))
    );
    if (!t.configure) corps.append(el('p', { class: 'vide', text: 'باش يخدم : token و chat_id في config.local.json' }));
    if (t.erreurs?.length) corps.append(el('h3', { text: 'آخر الأخطاء' }), el('pre', { class: 'tg-erreurs', text: t.erreurs.map(e => `${e.quand} ${e.detail}`).join('\n') }));
    const b = el('button', { type: 'button', class: 'bouton', text: 'ابعث رسالة تجريب' });
    b.disabled = !t.configure;
    b.addEventListener('click', async () => { b.disabled = true; try { const r = await api('/api/telegram/essai', { method: 'POST' }); toast(r.envoye ? 'راحت الرسالة' : 'ما راحتش', { erreur: !r.envoye, brut: (r.fautes || []).join(' ; ') }); } catch (e) { toast('ما راحتش', { erreur: true, brut: e.message }); } finally { b.disabled = false; } });
    corps.append(el('div', {}, b));
  }

  /* ===================== rafraîchissement ===================== */
  function horsLigne(oui, message) {
    if (etat.enLigne === !oui) return;
    etat.enLigne = !oui; const l = $('#lien-etat'); l.hidden = !oui; if (oui) l.title = message || '';
  }
  async function rafraichirOnglet() {
    switch (etat.onglet) {
      case 'coach': majCoach(await api('/api/chat/coach')); break;
      case 'carnet': majCarnet(await api('/api/carnet')); break;
      case 'routines': majRoutines(await api('/api/routines')); break;
      case 'journal': majJournal(await api('/api/journal')); majBavardages(await api('/api/bavardages')); break;
      case 'reglages': if (etat.reglagesACharger) { etat.reglagesACharger = false; await chargerReglages(); } break; // une fois à l'ouverture : on n'écrase pas ce que le client est en train de taper
    }
  }
  let enCours = false;
  async function rafraichir() {
    if (enCours) return; enCours = true;
    try {
      const [s, t] = await Promise.all([api('/api/sante'), api('/api/taches')]);
      etat.sante = s; majHaut(s); majTaches(Array.isArray(t) ? t : []);
      horsLigne(false);
      await rafraichirOnglet();
    } catch (e) { horsLigne(true, e.message); }
    finally { enCours = false; }
  }

  /* ===================== branchements ===================== */
  function remplirSelects() {
    const depts = [...etat.bureau.departements].sort((a, b) => a.ordre - b.ordre);
    for (const id of ['#tache-departement', '#routine-departement']) { const s = $(id); for (const d of depts) s.append(el('option', { value: d.id, text: d.nomAr, title: d.nom })); }
    const m = $('#tache-modele'); if (etat.bureau.modele && [...m.options].some(o => o.value === etat.bureau.modele)) m.value = etat.bureau.modele;
  }
  function brancher() {
    for (const b of document.querySelectorAll('.onglet')) b.addEventListener('click', () => ouvrirOnglet(b.dataset.onglet));
    for (const ta of document.querySelectorAll('textarea')) { ta.addEventListener('input', () => autoGrandir(ta)); autoGrandir(ta); }
    $('#formulaire-tache').addEventListener('submit', async e => {
      e.preventDefault();
      const texte = $('#tache-texte').value.trim(); if (!texte) return;
      const b = $('#bouton-zid'); b.disabled = true;
      try {
        await api('/api/taches', { method: 'POST', body: { texte, departement: $('#tache-departement').value || undefined, modele: $('#tache-modele').value, besoinOk: $('#tache-besoin-ok').checked } });
        $('#tache-texte').value = ''; autoGrandir($('#tache-texte')); toast('زادت الخدمة — المكتب بدا');
        await rafraichir();
      } catch (err) { toast('ما زادتش', { erreur: true, brut: err.message }); }
      finally { b.disabled = false; }
    });
    $('#tache-texte').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#formulaire-tache').requestSubmit(); } });
    $('#formulaire-coach').addEventListener('submit', async e => {
      e.preventDefault();
      const ta = $('#coach-texte'); const texte = ta.value.trim(); if (!texte || etat.coachOccupe) return;
      etat.coachOccupe = true; $('#bouton-ab3ath').disabled = true; $('#coach-ecrit').hidden = false;
      ta.value = ''; autoGrandir(ta);
      try { await api('/api/chat/coach', { method: 'POST', body: { texte } }); majCoach(await api('/api/chat/coach')); }
      catch (err) { toast('القائد ما جاوبش', { erreur: true, brut: err.message }); }
      finally { etat.coachOccupe = false; $('#bouton-ab3ath').disabled = false; $('#coach-ecrit').hidden = true; }
    });
    $('#coach-texte').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#formulaire-coach').requestSubmit(); } });
    $('#formulaire-routine').addEventListener('submit', async e => {
      e.preventDefault();
      const corps = { departement: $('#routine-departement').value, texte: $('#routine-texte').value.trim(), heure: $('#routine-heure').value, jours: $('#routine-jours').value, besoinOk: $('#routine-besoin-ok').checked };
      if (!corps.texte || !corps.departement) return;
      try { await api('/api/routines', { method: 'POST', body: corps }); $('#routine-texte').value = ''; autoGrandir($('#routine-texte')); toast('زاد الروتين'); etat.empreintes.routines = null; await rafraichirOnglet(); }
      catch (err) { toast('ما زادش', { erreur: true, brut: err.message }); }
    });
    $('#formulaire-reglages').addEventListener('submit', e => { e.preventDefault(); sauverReglages(); });
    $('#reg-tg-essai').addEventListener('click', e => essayerTelegram(e.currentTarget));
    $('#reg-tg-effacer').addEventListener('click', effacerTelegram);
    $('#reg-wilaya-zid').addEventListener('click', ajouterWilaya);
    // une wilaya cochée ou décochée : la liste a changé, elle se confirme de nouveau (comme un ajout)
    $('#reg-wilayas-liste').addEventListener('change', e => { if (e.target.matches('input[data-cle]')) $('#reg-wilayas-ok').checked = false; });
    $('#volet-fermer').addEventListener('click', () => { $('#volet-note').hidden = true; });
    $('#fiche-verifier').addEventListener('click', e => verifierOutil(e.currentTarget.dataset.dept));
    $('#fiche-ouvrir-chat').addEventListener('click', () => { $('#fiche-dept').close(); ouvrirOnglet('coach'); });
    $('#haut-telegram').addEventListener('click', ouvrirTelegram);
    $('#bouton-plier').addEventListener('click', e => { const b = $('#bureau'); const plie = b.classList.toggle('plie'); e.currentTarget.textContent = plie ? 'حلّ المكتب' : 'اطوي المكتب'; e.currentTarget.setAttribute('aria-expanded', String(!plie)); });
    for (const d of document.querySelectorAll('dialog')) d.addEventListener('click', e => { if (e.target === d) d.close(); });
    let minuteur = null;
    addEventListener('resize', () => { clearTimeout(minuteur); minuteur = setTimeout(() => { const sc = $('#scene'), anneau = sc.clientWidth >= 640;
      if ((anneau ? 'anneau' : 'colonne') !== etat.mode) return construireBureau();
      if (anneau && Math.round(grandeurVoulue(sc) * 10) !== etat.grandeur) construireBureau();
    }, 150); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => construireBureau());
  }

  async function demarrer() {
    try { etat.bureau = await api('/api/bureau'); }
    catch (e) { $('#bureau-chargement').textContent = 'ما قدرتش نقرا /api/bureau : ' + e.message; horsLigne(true, e.message); setTimeout(demarrer, 3000); return; }
    remplirSelects(); brancher(); construireBureau();
    ouvrirOnglet(['taches', 'coach', 'carnet', 'routines', 'journal', 'reglages', 'missions', 'installation'].includes(etat.onglet) ? etat.onglet : 'taches');
    try { etat.outils = await api('/api/outils'); } catch {}
    await rafraichir();
    setInterval(rafraichir, 3000);
  }
  demarrer();
})();
