'use strict';
/* ecom manita — LA STATION (méthode 2). Une station spatiale en pixel-art où l'équipage (les postes du bureau)
   travaille. Tout se construit depuis /api/bureau ; les états, les XP, les chronos viennent de /api/taches et
   /api/equipage. Code original, sans aucune bibliothèque : les sprites sont dessinés pixel par pixel ici même.
   Darija algérienne pour le texte, latin pour les chiffres et les noms techniques. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const ARABE = /[؀-ۿ]/;
  const LIEN_DRIVE = /https?:\/\/(drive|docs)\.google\.com\/\S+/i;

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
  const nombre = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }).replace(/[\s ]/g, ' ');
  const secondes = ms => nombre(Math.round((+ms || 0) / 1000)) + ' s';
  const heureDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const dateDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const chrono = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return [160, 150, 140]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const melanger = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); };
  const etroit = () => matchMedia('(max-width: 1230px)').matches;
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
    if (!r.ok) throw new Error((j && j.erreur) || `${r.status} ${r.statusText}`);
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
    bureau: null, sante: null, taches: [], equipage: null, onglet: memo.lire('station.onglet', 'pont'),
    cartes: new Map(), deplies: new Set(), brouillons: new Map(), controleOuvert: new Map(),
    empreintes: {}, enLigne: true, coachOccupe: false, mode: null, largeur: 0, z: 2, decalageHeure: 0,
    depuis: memo.lire('station.vu', null), noeuds: null, surligne: null, reglages: null, reglagesCharges: false
  };
  const ETIQ = { afaire: 'في الطابور', encours: 'راهي تخدم', attente: 'تستنى كلمتك', fini: 'كملات', echec: 'ما كملاتش' };
  const ORIGINES = { bureau: 'الجسر', telegram: 'تيليغرام', routine: 'روتين', 'routine (en retard)': 'روتين متأخر', 'routine (à la demande)': 'روتين دروك' };
  const CONTROLES = [['outil', 'الأداة'], ['source', 'المصدر'], ['auditeur', 'المدقق']];
  const NOMS_MODULES = { editeur: 'ورشة المونتاج', page: 'المخبر', testing: 'غرفة التيست', scaling: 'المفاعل', coach: 'قمرة القيادة' };
  const dept = id => (etat.bureau?.departements || []).find(d => d.id === id) || null;
  const nomDept = id => id === 'manager' ? etat.bureau?.centre?.nomAr || id : (dept(id)?.nomAr || id || 'يختار المانجر');
  const nomPoste = (d, p) => (dept(d)?.postes || []).find(x => x.id === p)?.nomAr || p || '';
  const classeVerdict = v => v === 'PASSE' ? 'passe' : v === 'ECHEC' ? 'echec' : '';
  const departementsTries = () => [...(etat.bureau?.departements || [])].sort((a, b) => a.ordre - b.ordre);

  /* ===================== les sprites (dessinés ici, pixel par pixel) ===================== */
  // O contour · H/h casque · V/v visière · K peau · S/s/L combinaison (couleur du département) · B sombre · W blanc · G or · C casquette · D barbe
  const CASQUES = [
    ['....OOOOOOOO....', '...OHHHHHHHHO...', '..OHHHHHHHHHHO..', '..OHhOOOOOOhHO..', '..OHOVvvvvVOHO..', '..OHOVvVVVVOHO..', '..OHOVVVVVVOHO..', '..OHhOOOOOOhHO..', '...OHhhhhhhHO...', '....OOOOOOOO....'],
    ['....CCCCCCCC....', '...OCCCCCCCCO...', '..OCCCCCCCCCCO..', '..OOOOOOOOOOOO..', '...OKKKKKKKKO...', '...OKOKKKKOKO...', '...OKKKKKKKKO...', '...OKKOOOOKKO...', '....OKKKKKKO....', '.....OOOOOO.....'],
    ['................', '....OOOOOOOO....', '...OhhhhhhhhO...', '..OhhhhhhhhhhO..', '.OBOvvvvvvvvOBO.', '.OBOKKKKKKKKOBO.', '..OOKOKKKKOKOO..', '...OKKKKKKKKO...', '....OKKOOKKO....', '.....OOOOOO.....'],
    ['....OOOOOOOO....', '...OBBBBBBBBO...', '..OBBBBBBBBBBO..', '..OBBOOOOOOBBO..', '..OBOKKKKKKOBO..', '..OBOKOKKOKOBO..', '..OBOKKKKKKOBO..', '..OBOKKOOKKOBO..', '...OBOKKKKOBO...', '....OOOOOOOO....'],
    ['....OOOOOOOO..W.', '...OHHHHHHHHO.O.', '..OHHHHHHHHHHOO.', '..OHHOOOOOOHHO..', '..OHOVVVVVVOHO..', '..OHOVWvVVVOHO..', '..OHOVVVVVVOHO..', '..OHHOOOOOOHHO..', '...OHHHHHHHHO...', '....OOOOOOOO....'],
    ['....OOOOOOOO....', '...OBvvOOvvBO...', '..OBBBBBBBBBBO..', '..OKKKKKKKKKKO..', '..OKKKKKKKKKKO..', '..OKOKKKKKKOKO..', '..OKKKKKKKKKKO..', '...OKKKOOKKKO...', '....OKKKKKKO....', '.....OOOOOO.....']
  ];
  const TENUES = [
    ['...OSSSSSSSSO...', '..OSLSSSSSSSSO..', '.OSOLSSSBBSSSOSO', '.OSOLSSSBBSSSOSO', '.OSOLSSSSSSSSOSO', '.OKOLSSSSSSSSOKO', '..O.OssssssssO.O', '....OBBBBBBBBO..'],
    ['...OSSSSSSSSO...', '..OSLSSSSSSSSO..', '.OSOLWWWWWWWWOSO', '.OSOLSSSSSSSSOSO', '.OSOLSSSSSSSSOSO', '.OKOLSSSSSSSSOKO', '..O.OssssssssO.O', '....OBBBBBBBBO..'],
    ['...OSSSSSSSSO...', '..OSLSSSSSSSSO..', '.OSOLSSSSSSSSOSO', '.OSOLSSSSSSSSOSO', '.OSOLSBBSSBBSOSO', '.OKOLSBBSSBBSOKO', '..O.OssssssssO.O', '....OBBBBBBBBO..'],
    ['...OWWWWWWWWO...', '..OSWWWWWWWWSO..', '.OSOWWWWWWWWWOSO', '.OSOWWWWWWWWWOSO', '.OSOWWWWWWWWWOSO', '.OKOWWWWWWWWWOKO', '..O.OWWWWWWWWO.O', '....OBBBBBBBBO..'],
    ['...OLLSSSSLLO...', '..OLLSSSSSSLLO..', '.OSOLSSSSSSSSOSO', '.OSOLSSSSSSSSOSO', '.OSOLSSSSSSSSOSO', '.OKOLSSSSSSSSOKO', '..O.OssssssssO.O', '....OBBBGGBBBO..'],
    ['...OSLLSSLLSO...', '..OSSLSBBSLSSO..', '.OSOLSSSBSSSSOSO', '.OSOLSSSBSSSSOSO', '.OSOLSSSBSSSSOSO', '.OKOLSSSBSSSSOKO', '..O.OssssssssO.O', '....OBBBBBBBBO..']
  ];
  const JAMBES = ['....OssOOOssO...', '....OssO.OssO...', '....OssO.OssO...', '....OssO.OssO...', '...OBBBO.OBBBO..', '...OOOOO.OOOOO..'];
  const MANAGER = ['......OOOOOO......', '.....OCCCCCCO.....', '....OCCCGGCCCO....', '....OCCCCCCCCO....', '...OOOOOOOOOOOO...', '....OKKKKKKKKO....', '....OKOKKKKOKO....', '....OKKKKKKKKO....', '....OKKKOOKKKO....', '....OKDDDDDDKO....', '.....OODDDDOO.....', '....OSSSOOSSSO....', '...OGGSSSSSSGGO...', '..OSOSSSGSSSSOSO..', '..OSOSSSSSSSSOSO..', '..OSOSSSGSSSSOSO..', '..OSOSSSSSSSSOSO..', '..OKOSSSGSSSSOKO..', '....OssssssssO....', '....OBBBBGBBBO....', '....OssOOOOssO....', '....OssO..OssO....', '....OssO..OssO....', '....OssO..OssO....', '....OssO..OssO....', '...OBBBO..OBBBO...', '...OOOOO..OOOOO...'];
  const ICONES = {
    editeur: ['AAAAAAAA', 'AWAWAWAW', 'AAAAAAAA', 'AAAAAAAA', 'A......A', 'A......A', 'A......A', 'AAAAAAAA'],
    page: ['...WW...', '...WW...', '...WW...', '..W..W..', '..W..W..', '.W.AA.W.', '.WAAAAW.', '.WWWWWW.'],
    testing: ['..WWWW..', '.W....W.', 'W..W...W', 'W...W..W', 'W...A..W', 'W..AA..W', '.W....W.', '..WWWW..'],
    scaling: ['....AA..', '...AA...', '..AA....', '.AAAAAA.', '....AA..', '...AA...', '..AA....', '.AA.....'],
    coach: ['.WWWWWW.', 'W......W', 'W.WWWW.W', 'W.W..W.W', 'WWW..WWW', '..W..W..', '..W..W..', '..WWWW..'],
    manager: ['...WW...', '.W.WW.W.', '..WWWW..', 'WWWAAWWW', 'WWWAAWWW', '..WWWW..', '.W.WW.W.', '...WW...'],
    telegram: ['........', '.WWWWWWW', '..WWWWW.', '...WWWW.', '....WWW.', '..W..WW.', '.W....W.', '........']
  };
  const PEAUX = ['#e9c9a8', '#c99a6e', '#8d5a3c'];
  function paletteDe(couleur, peau) {
    return { O: '#0d0f16', H: '#dfe4ec', h: '#a9b2c1', V: '#1b2a4a', v: '#7fe3ff', K: peau, B: '#2a2d3a', W: '#f4f6fb', G: '#f5c542', D: '#5b3d2a',
      S: couleur, s: melanger(couleur, '#000000', .38), L: melanger(couleur, '#ffffff', .35), C: melanger(couleur, '#000000', .2) };
  }
  /** Lignes de caractères → rectangles (une rangée de même couleur = un rect), en cellules. */
  function rectsDe(lignes, palette) {
    const out = [];
    lignes.forEach((l, y) => {
      let x = 0;
      while (x < l.length) {
        const c = l[x]; if (c === '.' || !palette[c]) { x++; continue; }
        let w = 1; while (l[x + w] === c) w++;
        out.push({ x, y, w, c: palette[c] }); x += w;
      }
    });
    return out;
  }
  function groupeSprite(rects, x0, y0, z, classe = 'sprite', classes = null) {
    const g = svg('g', { class: classe });
    for (const r of rects) g.append(svg('rect', { x: (x0 + r.x) * z, y: (y0 + r.y) * z, width: r.w * z, height: z, fill: r.c, class: classes ? classes[r.c] : null }));
    return g;
  }
  // le réacteur (le carnet) : un octogone de quatre anneaux qui pulsent l'un après l'autre
  const REACTEUR = ['........OOOOOOOO........', '......OOAAAAAAAAOO......', '.....OAAAAAAAAAAAAO.....', '....OAAAAAAAAAAAAAAO....', '...OAAAABBBBBBBBAAAAO...', '..OAAABBBBBBBBBBBBAAAO..', '..OAABBBBBBBBBBBBBBAAO..', '.OAAABBBBCCCCCCBBBBAAAO.', '.OAABBBBCCCCCCCCBBBBAAO.', '.OAABBBCCCCWWCCCCBBBAAO.', '.OAABBBCCCWWWWCCCBBBAAO.', '.OAABBBCCCWWWWCCCBBBAAO.', '.OAABBBCCCWWWWCCCBBBAAO.', '.OAABBBCCCWWWWCCCBBBAAO.', '.OAABBBCCCCWWCCCCBBBAAO.', '.OAABBBBCCCCCCCCBBBBAAO.', '.OAAABBBBCCCCCCBBBBAAAO.', '..OAABBBBBBBBBBBBBBAAO..', '..OAAABBBBBBBBBBBBAAAO..', '...OAAAABBBBBBBBAAAAO...', '....OAAAAAAAAAAAAAAO....', '.....OAAAAAAAAAAAAO.....', '......OOAAAAAAAAOO......', '........OOOOOOOO........'];
  const PALETTE_REACTEUR = { O: '#0d1120', A: '#1e3a8a', B: '#2563eb', C: '#60a5fa', W: '#e0f2fe' };
  const CLASSES_REACTEUR = { '#1e3a8a': 'anneau a1', '#2563eb': 'anneau a2', '#60a5fa': 'anneau a3', '#e0f2fe': 'coeur' };
  const spriteEquipier = (indice, couleur) => rectsDe([...CASQUES[indice % 6], ...TENUES[(Math.floor(indice / 6) * 2 + indice) % 6], ...JAMBES], paletteDe(couleur, PEAUX[indice % 3]));
  const spriteManager = () => rectsDe(MANAGER, paletteDe('#2f3a5c', PEAUX[0]));
  const icone = (nom, couleurA) => rectsDe(ICONES[nom] || ICONES.manager, { W: '#f4f7fc', A: couleurA });

  /* ===================== la disposition (en cellules) ===================== */
  const HM = 64, HP = 92, WP = 104, WS = 96, HS = 34, MARGE = 4, GAP = 14;
  /** Anneau : testing en haut, page/éditeur à droite, coach/scaling à gauche, le pont au centre, le sas en bas. */
  function dispositionAnneau(Ac, depts) {
    const wm = Math.min(4 * 38 + 8, Math.floor((Ac - WP - 2 * GAP - 2 * MARGE) / 2));
    const cx = Math.floor(Ac / 2);
    const ordre = ['editeur', 'page', 'testing', 'coach', 'scaling'];
    const y1 = MARGE, y2 = MARGE + HM + GAP, y3 = MARGE + 2 * HM + 2 * GAP;
    const pos = {
      testing: { x: cx - Math.floor(wm / 2), y: y1, w: wm, h: HM },
      page: { x: cx + Math.floor(WP / 2) + GAP, y: y2, w: wm, h: HM },
      editeur: { x: cx + Math.floor(WP / 2) + GAP, y: y3, w: wm, h: HM },
      coach: { x: cx - Math.floor(WP / 2) - GAP - wm, y: y2, w: wm, h: HM },
      scaling: { x: cx - Math.floor(WP / 2) - GAP - wm, y: y3, w: wm, h: HM }
    };
    // un département inconnu de la liste (bureau.json changé) prend une place libre à la suite
    let libre = 0; const places = ['testing', 'page', 'editeur', 'coach', 'scaling'];
    const modules = {};
    for (const d of depts) modules[d.id] = pos[d.id] || pos[places[libre++ % places.length]];
    const pont = { x: cx - Math.floor(WP / 2), y: y2 + Math.floor((2 * HM + GAP - HP) / 2), w: WP, h: HP };
    const sas = { x: cx - Math.floor(WS / 2), y: MARGE + 3 * HM + 3 * GAP, w: WS, h: HS };
    const Hc = sas.y + HS + MARGE;
    const centre = r => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
    const couloirs = [];
    const chaine = ['sas', ...ordre].map(id => id === 'sas' ? sas : modules[id]).filter(Boolean);
    for (let i = 0; i + 1 < chaine.length; i++) couloirs.push({ de: centre(chaine[i]), vers: centre(chaine[i + 1]), type: 'chaine', epaisseur: 6 });
    for (const d of depts) couloirs.push({ de: centre(modules[d.id]), vers: centre(pont), type: 'rayon', dept: d.id, epaisseur: 4 });
    couloirs.push({ de: centre(sas), vers: centre(pont), type: 'rayon', dept: 'telegram', epaisseur: 4 });
    return { mode: 'anneau', Ac, Hc, modules, pont, sas, couloirs, pitch: Math.floor((wm - 8) / 4) };
  }
  /** Colonne (téléphone) : scaling, coach, le pont, testing, page, éditeur, le sas — deux épines : le pont à gauche, la chaîne à droite. */
  function dispositionColonne(Ac, depts) {
    const EP = 6, wm = Math.min(Ac - 2 * MARGE - 2 * (EP + 4), 4 * 46 + 8), x0 = Math.floor((Ac - wm) / 2), gap = 10;
    const ordreColonne = ['scaling', 'coach', 'pont', 'testing', 'page', 'editeur'];
    const restants = depts.map(d => d.id).filter(id => !ordreColonne.includes(id));
    const suite = [...ordreColonne, ...restants].filter(id => id === 'pont' || depts.some(d => d.id === id));
    const modules = {}; let y = MARGE; let pont = null; const hp = 70;
    for (const id of suite) {
      if (id === 'pont') { pont = { x: x0, y, w: wm, h: hp }; y += hp + gap; }
      else { modules[id] = { x: x0, y, w: wm, h: HM }; y += HM + gap; }
    }
    const sas = { x: x0, y, w: wm, h: HS };
    const Hc = y + HS + MARGE;
    const couloirs = [];
    const milieu = r => r.y + Math.floor(r.h / 2);
    // l'épine de gauche : le pont ↔ chaque module ; l'épine de droite : la chaîne sas → éditeur → page → testing → coach → scaling
    const xg = MARGE + 3, xd = Ac - MARGE - 3;
    const tous = [...Object.values(modules), sas];
    const yMin = Math.min(...tous.map(milieu), milieu(pont)), yMax = Math.max(...tous.map(milieu), milieu(pont));
    couloirs.push({ de: [xg, yMin], vers: [xg, yMax], type: 'rayon', epaisseur: 4 });
    for (const d of depts) couloirs.push({ de: [xg, milieu(modules[d.id])], vers: [x0 + 10, milieu(modules[d.id])], type: 'rayon', dept: d.id, epaisseur: 4 });
    couloirs.push({ de: [xg, milieu(sas)], vers: [x0 + 10, milieu(sas)], type: 'rayon', dept: 'telegram', epaisseur: 4 });
    couloirs.push({ de: [xg, milieu(pont)], vers: [x0 + 10, milieu(pont)], type: 'rayon', epaisseur: 4 });
    const chaine = ['sas', 'editeur', 'page', 'testing', 'coach', 'scaling'].map(id => id === 'sas' ? sas : modules[id]).filter(Boolean);
    couloirs.push({ de: [xd, Math.min(...chaine.map(milieu))], vers: [xd, Math.max(...chaine.map(milieu))], type: 'chaine', epaisseur: 6 });
    for (const r of chaine) couloirs.push({ de: [x0 + wm - 10, milieu(r)], vers: [xd, milieu(r)], type: 'chaine', epaisseur: 6 });
    return { mode: 'colonne', Ac, Hc, modules, pont, sas, couloirs, pitch: Math.floor((wm - 8) / 4) };
  }

  /* ===================== la scène ===================== */
  const texteLatin = (x, y, texte, classe, attrs = {}) => svg('text', { x, y, class: classe + ' latin', 'text-anchor': 'middle', direction: 'ltr', text: texte, ...attrs });
  const texteArabe = (x, y, texte, classe, attrs = {}) => svg('text', { x, y, class: classe, 'text-anchor': 'middle', direction: 'rtl', text: texte, ...attrs });
  function couperMots(texte, max, taille) {
    const largeur = s => s.length * taille * 0.62;
    const lignes = []; let cour = '';
    for (const m of String(texte).split(/\s+/)) { const essai = cour ? cour + ' ' + m : m; if (largeur(essai) <= max || !cour) cour = essai; else { lignes.push(cour); cour = m; } }
    if (cour) lignes.push(cour);
    // pas d'orphelin (« SURVEILLANCE 72 / H ») : le dernier mot de la ligne d'avant descend avec lui
    if (lignes.length === 2 && lignes[1].length <= 2 && lignes[0].includes(' ')) { const mots = lignes[0].split(' '); lignes[1] = mots.pop() + ' ' + lignes[1]; lignes[0] = mots.join(' '); }
    if (lignes.length > 2) { lignes.length = 2; lignes[1] = lignes[1].slice(0, Math.max(3, Math.floor(max / (taille * 0.62)) - 1)) + '…'; }
    return lignes;
  }
  /** Après insertion : les textes marqués data-max qui dépassent sont serrés (textLength). */
  function serrerTextes(racine) {
    for (const t of racine.querySelectorAll('text[data-max]')) {
      const max = +t.dataset.max; let l = 0; try { l = t.getComputedTextLength(); } catch {}
      if (!l) return; // pas affiché (station pliée) : on laisse
      if (l > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    }
  }
  /** Un couloir : les cellules à moins de e/2 du segment, contour compris, en rangées fusionnées. */
  function couloir(c, z) {
    const [x1, y1] = c.de, [x2, y2] = c.vers; const e = c.epaisseur;
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    const dist = (x, y) => { let t = ((x - x1) * dx + (y - y1) * dy) / L2; t = Math.max(0, Math.min(1, t)); const px = x1 + t * dx - x, py = y1 + t * dy - y; return Math.sqrt(px * px + py * py); };
    const g = svg('g', { class: 'couloir ' + c.type, 'data-dept': c.dept || null });
    const minX = Math.floor(Math.min(x1, x2) - e), maxX = Math.ceil(Math.max(x1, x2) + e), minY = Math.floor(Math.min(y1, y2) - e), maxY = Math.ceil(Math.max(y1, y2) + e);
    const contour = c.type === 'chaine' ? '#1c2235' : '#151c2c', interieur = c.type === 'chaine' ? '#3d4661' : '#2c3650';
    const rangees = (seuil, couleur) => {
      for (let y = minY; y <= maxY; y++) {
        let x = minX;
        while (x <= maxX) {
          if (dist(x + .5, y + .5) > seuil) { x++; continue; }
          let w = 1; while (x + w <= maxX && dist(x + w + .5, y + .5) <= seuil) w++;
          g.append(svg('rect', { x: x * z, y: y * z, width: w * z, height: z, fill: couleur })); x += w;
        }
      }
    };
    rangees(e / 2 + 1, contour); rangees(e / 2, interieur);
    // les lumières le long du couloir, une toutes les huit cellules
    const L = Math.sqrt(L2); const n = Math.floor(L / 8);
    for (let i = 1; i < n; i++) { const t = i / n; const x = Math.round(x1 + t * dx), y = Math.round(y1 + t * dy); g.append(svg('rect', { class: 'lumiere', x: x * z, y: y * z, width: z, height: z, style: `animation-delay: ${(i * 0.12).toFixed(2)}s` })); }
    return g;
  }
  /** La coque d'un module : bord métal, coque teintée, sol, bandeau. */
  function coque(r, couleur, z, { bandeau = 11 } = {}) {
    const bord = melanger(couleur, '#ffffff', .25), coqueFill = melanger(couleur, '#2a3142', .68), sol = '#141a28', strip = melanger(couleur, '#000000', .45);
    return [
      svg('rect', { class: 'coque', x: r.x * z, y: r.y * z, width: r.w * z, height: r.h * z, fill: bord }),
      svg('rect', { x: (r.x + 1) * z, y: (r.y + 1) * z, width: (r.w - 2) * z, height: (r.h - 2) * z, fill: coqueFill }),
      svg('rect', { x: (r.x + 2) * z, y: (r.y + 2 + bandeau + 1) * z, width: (r.w - 4) * z, height: (r.h - bandeau - 5) * z, fill: sol }),
      svg('rect', { x: (r.x + 2) * z, y: (r.y + 2) * z, width: (r.w - 4) * z, height: bandeau * z, fill: strip }),
      // quatre rivets
      ...[[2, 2], [r.w - 3, 2], [2, r.h - 3], [r.w - 3, r.h - 3]].map(([a, b]) => svg('rect', { x: (r.x + a) * z, y: (r.y + b) * z, width: z, height: z, fill: '#cfd6e4' }))
    ];
  }
  /** Le poste de travail d'un membre : sprite, bureau, moniteur (écran = l'état), étiquettes, XP, chrono. */
  function equipier({ x0, y0, z, indice, couleur, poste, deptId, manager = false, pitch = 36 }) {
    const gp = svg('g', { class: 'equipier' + (manager ? ' manager' : ''), 'data-dept': deptId, 'data-poste': poste.id, 'data-etat': 'libre', tabindex: 0, role: 'button', 'aria-label': poste.nomAr + ' — ' + poste.nom });
    gp.append(svg('title', { text: poste.nom + ' — ' + poste.nomAr + ' : ' + (poste.role || '') }));
    const H = manager ? 27 : 24, W = manager ? 18 : 16, bloc = W + 2 + 10 + 2; // sprite + écart + moniteur + marge
    gp.append(svg('rect', { class: 'socle', x: (x0 - 1) * z, y: (y0 - 1) * z, width: (bloc + 2) * z, height: (H + 2) * z }));
    gp.append(groupeSprite(manager ? spriteManager() : spriteEquipier(indice, couleur), x0, y0, z));
    // le bureau couvre les jambes : le membre est assis derrière
    const yb = y0 + H - 7;
    gp.append(svg('rect', { x: (x0 - 1) * z, y: yb * z, width: (bloc + 1) * z, height: z, fill: '#5a6580' }));
    gp.append(svg('rect', { x: (x0 - 1) * z, y: (yb + 1) * z, width: (bloc + 1) * z, height: 6 * z, fill: '#2f3748' }));
    gp.append(svg('rect', { x: (x0 - 1) * z, y: (yb + 1) * z, width: z, height: 6 * z, fill: '#0d0f16' }), svg('rect', { x: (x0 + bloc - 1) * z, y: (yb + 1) * z, width: z, height: 6 * z, fill: '#0d0f16' }));
    // le moniteur, posé sur le bureau
    const mx = x0 + W + 2, my = yb - 9;
    gp.append(svg('rect', { x: mx * z, y: my * z, width: 10 * z, height: 8 * z, fill: '#0d0f16' }));
    gp.append(svg('rect', { class: 'ecran', 'data-etat': 'libre', x: (mx + 1) * z, y: (my + 1) * z, width: 8 * z, height: 6 * z }));
    gp.append(svg('rect', { x: (mx + 4) * z, y: (my + 8) * z, width: 2 * z, height: z, fill: '#0d0f16' }));
    // le panneau au-dessus du moniteur : « ? » qui clignote (attente) ou « ! » (échec) ; le chrono (encours) s'affiche sur le devant du bureau
    const pan = svg('g', { class: 'panneau-etat', visibility: 'hidden' }, svg('rect', { x: (mx + 1) * z, y: (my - 9) * z, width: 8 * z, height: 8 * z }), texteLatin((mx + 5) * z, (my - 3) * z, '?', 'panneau-txt', { 'font-size': 4.5 * z }));
    gp.append(pan);
    gp.append(svg('text', { class: 'chrono latin', x: (x0 - 1 + Math.floor((bloc + 1) / 2)) * z, y: (yb + 5.6) * z, 'text-anchor': 'middle', direction: 'ltr', 'font-size': 3.6 * z, visibility: 'hidden', text: 'RUN 00:00' }));
    // les étiquettes : nom arabe, NOM latin (deux lignes au plus), Lv + barre d'XP
    // l'étiquette ne dépasse jamais le pas entre deux membres : les noms voisins ne se touchent pas
    const cx = x0 + Math.floor(bloc / 2), maxPx = (Math.min(pitch, bloc + 6) - 2) * z;
    gp.append(texteArabe(cx * z, (y0 + H + 6) * z, poste.nomAr, 'eq-ar', { 'font-size': 5 * z, 'data-max': maxPx }));
    couperMots(poste.nom, maxPx, 3.5 * z).forEach((l, i) => gp.append(texteLatin(cx * z, (y0 + H + 11 + i * 4) * z, l, 'eq-lat', { 'font-size': 3.5 * z, 'data-max': maxPx })));
    const yx = y0 + H + 18;
    gp.append(svg('text', { class: 'niveau latin', x: (x0 - 1) * z, y: (yx + 3) * z, 'text-anchor': 'start', direction: 'ltr', 'font-size': 4 * z, text: 'Lv 1' }));
    gp.append(svg('rect', { class: 'xp-fond', x: (x0 + 11) * z, y: yx * z, width: (bloc - 11) * z, height: 3 * z }));
    gp.append(svg('rect', { class: 'xp-barre', x: (x0 + 11) * z, y: yx * z, width: 0, height: 3 * z }));
    gp.addEventListener('click', e => { e.stopPropagation(); ouvrirEquipage(deptId, poste.id); });
    gp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); ouvrirEquipage(deptId, poste.id); } });
    return gp;
  }
  function moduleDepartement(d, r, z, pitch, indiceDepart) {
    const g = svg('g', { class: 'module', 'data-dept': d.id, tabindex: 0, role: 'button', 'aria-label': (NOMS_MODULES[d.id] || d.nomAr) + ' — ' + d.nom });
    g.append(svg('title', { text: d.role || '' }));
    g.append(...coque(r, d.couleur, z));
    // le bandeau : icône + numéro d'ordre à gauche, les compteurs au milieu, les noms à droite (sens de lecture)
    g.append(groupeSprite(icone(d.id, d.couleur), r.x + 4, r.y + 3, z, 'icone'));
    g.append(svg('rect', { x: (r.x + 14) * z, y: (r.y + 4) * z, width: 6 * z, height: 7 * z, fill: '#ffb347' }), texteLatin((r.x + 17) * z, (r.y + 9.6) * z, String(d.ordre), 'ordre-txt', { 'font-size': 4 * z }));
    const enc = texteLatin((r.x + 27) * z, (r.y + 9.5) * z, '0', 'compteur-txt encours', { 'font-size': 4 * z }); enc.dataset.cle = 'encours';
    const fin = texteLatin((r.x + 39) * z, (r.y + 9.5) * z, '0', 'compteur-txt', { 'font-size': 4 * z }); fin.dataset.cle = 'fini';
    g.append(svg('rect', { x: (r.x + 23) * z, y: (r.y + 6) * z, width: 2 * z, height: 2 * z, fill: '#4ade80' }), enc, svg('rect', { x: (r.x + 35) * z, y: (r.y + 6) * z, width: 2 * z, height: 2 * z, fill: '#aab5cb' }), fin,
      svg('title', { text: 'راهي تخدم · كملات' }));
    g.append(svg('text', { class: 'mod-ar', x: (r.x + r.w - 4) * z, y: (r.y + 7.5) * z, 'text-anchor': 'start', direction: 'rtl', 'font-size': 5.5 * z, text: NOMS_MODULES[d.id] || d.nomAr }));
    g.append(svg('text', { class: 'mod-lat latin', x: (r.x + r.w - 4) * z, y: (r.y + 12) * z, 'text-anchor': 'end', direction: 'ltr', 'font-size': 3.5 * z, 'data-max': (r.w - 46) * z, text: d.nom + ' · ' + d.nomAr }));
    // l'équipage, de droite à gauche (le premier poste à droite)
    const postes = d.postes || []; const n = postes.length; const bloc = 30;
    const total = n * pitch - (pitch - bloc); const debut = r.x + Math.floor((r.w - total) / 2);
    postes.forEach((p, i) => {
      const x0 = debut + (n - 1 - i) * pitch, y0 = r.y + 15;
      const gp = equipier({ x0, y0, z, indice: indiceDepart + i, couleur: d.couleur, poste: p, deptId: d.id, pitch });
      g.append(gp); etat.noeuds.postes.set(d.id + '/' + p.id, gp);
    });
    etat.noeuds.compteurs.set(d.id, { encours: enc, fini: fin });
    return g;
  }
  function reacteur(x, y, z) {
    const g = svg('g', { class: 'reacteur', tabindex: 0, role: 'button', 'aria-label': etat.bureau.cerveau.nomAr });
    g.append(svg('title', { text: etat.bureau.cerveau.role }));
    g.append(groupeSprite(rectsDe(REACTEUR, PALETTE_REACTEUR), x, y, z, 'coeur-reacteur', CLASSES_REACTEUR));
    // les quatre conduits
    g.append(svg('rect', { x: (x + 11) * z, y: (y - 3) * z, width: 2 * z, height: 3 * z, fill: '#8b95ab' }), svg('rect', { x: (x + 11) * z, y: (y + 24) * z, width: 2 * z, height: 3 * z, fill: '#8b95ab' }),
      svg('rect', { x: (x - 3) * z, y: (y + 11) * z, width: 3 * z, height: 2 * z, fill: '#8b95ab' }), svg('rect', { x: (x + 24) * z, y: (y + 11) * z, width: 3 * z, height: 2 * z, fill: '#8b95ab' }));
    g.addEventListener('click', e => { e.stopPropagation(); ouvrirOnglet('outbox', { defiler: true }); });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); ouvrirOnglet('outbox', { defiler: true }); } });
    return g;
  }
  function modulePont(r, z, mode) {
    const B = etat.bureau;
    const g = svg('g', { class: 'module pont', 'data-dept': 'manager', tabindex: 0, role: 'button', 'aria-label': 'الجسر — ' + B.centre.nomAr });
    g.append(svg('title', { text: B.centre.role }));
    g.append(...coque(r, '#8b95ab', z));
    g.append(groupeSprite(icone('manager', '#ffb347'), r.x + 4, r.y + 3, z, 'icone'));
    g.append(svg('text', { class: 'mod-ar', x: (r.x + r.w - 4) * z, y: (r.y + 7.5) * z, 'text-anchor': 'start', direction: 'rtl', 'font-size': 5.5 * z, text: 'الجسر' }));
    g.append(svg('text', { class: 'mod-lat latin', x: (r.x + r.w - 4) * z, y: (r.y + 12) * z, 'text-anchor': 'end', direction: 'ltr', 'font-size': 3.5 * z, text: 'LE PONT · ' + B.centre.nom }));
    // le réacteur = le carnet, à gauche ; le manager à droite
    const rx = r.x + 8, ry = r.y + 19;
    g.append(reacteur(rx, ry, z));
    g.append(texteArabe((rx + 12) * z, (ry + 32) * z, B.cerveau.nomAr, 'mod-ar', { 'font-size': 5 * z }), texteLatin((rx + 12) * z, (ry + 37) * z, B.cerveau.nom, 'mod-lat', { 'font-size': 3.5 * z }));
    const compteur = (x, y, cle, mot) => { const n = texteLatin(x * z, y * z, '0', 'plaque-nombre', { 'font-size': 5 * z, 'text-anchor': 'end' }); n.dataset.cle = cle; return [n, svg('text', { class: 'plaque-txt', x: (x + 2) * z, y: y * z, 'text-anchor': 'end', direction: 'rtl', 'font-size': 4 * z, text: mot })]; };
    const yc = mode === 'anneau' ? r.y + r.h - 8 : r.y + r.h - 6;
    g.append(...compteur(r.x + 12, yc, 'notes', 'النوطات'), ...compteur(r.x + 36, yc, 'produits', 'المنتوجات'));
    const x0 = r.x + r.w - 4 - 32, y0 = r.y + 14;
    const gm = equipier({ x0, y0, z, indice: 0, couleur: '#2f3a5c', poste: { id: 'manager', nom: B.centre.nom, nomAr: B.centre.nomAr, role: B.centre.role }, deptId: 'manager', manager: true });
    g.append(gm); etat.noeuds.postes.set('manager/manager', gm);
    // le compte des missions distribuées : le nombre collé au bord droit, le mot s'étend vers la gauche
    const rout = texteLatin((r.x + r.w - 4) * z, (r.y + r.h - 4) * z, '0', 'plaque-nombre', { 'font-size': 4.5 * z, 'text-anchor': 'end' }); rout.dataset.cle = 'routees';
    g.append(rout, svg('text', { class: 'plaque-txt', x: (r.x + r.w - 13) * z, y: (r.y + r.h - 4) * z, 'text-anchor': 'start', direction: 'rtl', 'font-size': 4 * z, text: 'مهمة وزّعها' }));
    return g;
  }
  function moduleSas(r, z) {
    const R = etat.bureau.reception;
    const g = svg('g', { class: 'module sas', 'data-dept': 'telegram', tabindex: 0, role: 'button', 'aria-label': 'السّاس تاع تيليغرام' });
    g.append(svg('title', { text: R.role }));
    g.append(...coque(r, '#2f8fcf', z, { bandeau: 0 }));
    // la porte du sas : deux battants avec un hublot chacun
    const px = r.x + 4, py = r.y + 5;
    g.append(svg('rect', { x: px * z, y: py * z, width: 22 * z, height: (r.h - 10) * z, fill: '#0d0f16' }));
    for (const dx of [1, 12]) { g.append(svg('rect', { x: (px + dx) * z, y: (py + 1) * z, width: 9 * z, height: (r.h - 12) * z, fill: '#6b7488' }), svg('rect', { x: (px + dx + 3) * z, y: (py + 4) * z, width: 3 * z, height: 3 * z, fill: '#bcd8ff' })); }
    g.append(groupeSprite(icone('telegram', '#fff'), r.x + 30, r.y + 5, z, 'icone'));
    g.append(svg('rect', { class: 'led', x: (r.x + 31) * z, y: (r.y + r.h - 10) * z, width: 4 * z, height: 4 * z }));
    const q = texteLatin((r.x + 46) * z, (r.y + r.h - 6) * z, '0', 'plaque-nombre', { 'font-size': 5 * z, 'text-anchor': 'end' }); q.dataset.cle = 'questions';
    g.append(q, svg('text', { class: 'plaque-txt', x: (r.x + 48) * z, y: (r.y + r.h - 6) * z, 'text-anchor': 'end', direction: 'rtl', 'font-size': 4 * z, 'data-max': (r.w - 56) * z, text: 'أسئلة مفتوحة' }));
    g.append(svg('text', { class: 'mod-ar', x: (r.x + r.w - 4) * z, y: (r.y + 10) * z, 'text-anchor': 'start', direction: 'rtl', 'font-size': 5.5 * z, 'data-max': (r.w - 44) * z, text: 'السّاس تاع تيليغرام' }));
    g.append(svg('text', { class: 'mod-lat latin', x: (r.x + r.w - 4) * z, y: (r.y + 15) * z, 'text-anchor': 'end', direction: 'ltr', 'font-size': 3.5 * z, text: R.nom + ' · ' + R.nomAr }));
    etat.noeuds.telegram = { led: g.querySelector('.led'), questions: q };
    return g;
  }
  function etoiles(Ac, Hc, z, graine) {
    const g = svg('g', { class: 'etoiles' });
    let s = graine >>> 0 || 7; const alea = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = Math.round(Ac * Hc / 700);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(alea() * Ac), y = Math.floor(alea() * Hc), t = alea();
      const grande = t > .92;
      g.append(svg('rect', { class: 'etoile' + (t < .3 ? ' bleue' : t > .8 ? ' jaune' : ''), x: x * z, y: y * z, width: (grande ? 2 : 1) * z, height: (grande ? 2 : 1) * z, style: `--duree: ${(3 + alea() * 5).toFixed(1)}s; animation-delay: -${(alea() * 6).toFixed(1)}s` }));
    }
    return g;
  }
  /** Le zoom des pixels : trois quand la largeur ET la hauteur de l'écran le permettent, sinon deux. */
  function choisirZ(dispo) { return dispo >= 1300 && innerHeight >= 3 * 276 + 130 ? 3 : 2; }
  function construireStation() {
    const scene = $('#scene'); const B = etat.bureau;
    const dispo = Math.max(240, scene.clientWidth || 900);
    const z = choisirZ(dispo);
    const Ac = Math.floor(dispo / z);
    const depts = departementsTries();
    const minAnneau = WP + 2 * GAP + 2 * MARGE + 2 * (4 * 32 + 8); // l’anneau exige un pas d’au moins 32 cellules par membre
    const d = Ac >= minAnneau ? dispositionAnneau(Ac, depts) : dispositionColonne(Ac, depts);
    etat.mode = d.mode; etat.largeur = Ac * z; etat.z = z;
    etat.noeuds = { postes: new Map(), compteurs: new Map(), couloirs: new Map(), telegram: null };
    const W = Ac * z, H = d.Hc * z;
    const s = svg('svg', { class: 'scene ' + d.mode, width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: `width:${W}px;height:${H}px`, 'aria-label': 'المحطة', 'data-mode': d.mode, 'data-z': z });
    s.append(svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#070a12' }));
    s.append(etoiles(Ac, d.Hc, z, Ac * 31 + d.Hc));
    for (const c of d.couloirs) { const g = couloir(c, z); s.append(g); if (c.dept) { const liste = etat.noeuds.couloirs.get(c.dept) || []; liste.push(g); etat.noeuds.couloirs.set(c.dept, liste); } }
    let indice = 0;
    for (const dep of depts) { s.append(moduleDepartement(dep, d.modules[dep.id], z, d.pitch, indice)); indice += (dep.postes || []).length; }
    s.append(modulePont(d.pont, z, d.mode));
    s.append(moduleSas(d.sas, z));
    scene.innerHTML = ''; scene.append(s);
    serrerTextes(s);
    s.addEventListener('click', e => {
      const m = e.target.closest('.module'); if (!m) return;
      const id = m.dataset.dept;
      if (id === 'telegram') ouvrirTelegram();
      else if (id === 'manager') ouvrirOnglet('pont', { defiler: true });
      else if (dept(id)?.voix) ouvrirOnglet('coach', { defiler: true });
      else ouvrirEquipage(id, null);
    });
    s.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const m = e.target.closest('.module'); if (!m || e.target !== m) return;
      e.preventDefault(); m.click();
    });
    majStation();
  }
  /** L'état visuel : écrans, panneaux, chronos, XP, compteurs, couloirs. Ne touche que ce qui change. */
  function majStation() {
    if (!etat.bureau || !etat.noeuds) return;
    const E = etat.equipage; const parPoste = new Map();
    for (const p of E?.postes || []) parPoste.set(p.departement + '/' + p.poste, p);
    const encoursDe = (d, p) => etat.taches.find(t => t.etat === 'encours' && t.departement === d && t.poste === p);
    // chaque écriture est gardée par une comparaison : rien ne bouge dans le DOM si rien n'a changé
    const attr = (e, nom, valeur) => { if (e.getAttribute(nom) !== String(valeur)) e.setAttribute(nom, valeur); };
    const donnee = (e, nom, valeur) => { if (e.dataset[nom] !== String(valeur)) e.dataset[nom] = valeur; };
    const pose = (g, v) => { if (g.dataset.etat !== v) { g.dataset.etat = v; g.querySelector('.ecran').dataset.etat = v; } };
    const panneau = (g, v) => {
      const pan = g.querySelector('.panneau-etat'); const t = pan.querySelector('text');
      const visible = v === 'attente' || v === 'echec';
      attr(pan, 'visibility', visible ? 'visible' : 'hidden'); attr(pan, 'class', 'panneau-etat ' + (visible ? v : ''));
      const txt = v === 'attente' ? '?' : '!'; if (t.textContent !== txt) t.textContent = txt;
      attr(g.querySelector('.chrono'), 'visibility', v === 'encours' ? 'visible' : 'hidden');
    };
    const xp = (g, x, niveau, prochain) => {
      const lv = g.querySelector('.niveau'); const txt = 'Lv ' + niveau; if (lv.textContent !== txt) lv.textContent = txt;
      const debut = 10 * (2 ** (niveau - 1) - 1); const ratio = prochain > debut ? Math.max(0, Math.min(1, (x - debut) / (prochain - debut))) : 0;
      const fond = g.querySelector('.xp-fond'), barre = g.querySelector('.xp-barre');
      const w = Math.round(+fond.getAttribute('width') * ratio / etat.z) * etat.z; attr(barre, 'width', w);
      donnee(barre, 'xp', x); donnee(barre, 'prochain', prochain);
    };
    for (const [k, g] of etat.noeuds.postes) {
      if (k === 'manager/manager') continue;
      const [d, p] = k.split('/'); const info = parPoste.get(k);
      const v = info?.etat || 'libre';
      pose(g, v); panneau(g, v);
      const t = v === 'encours' ? encoursDe(d, p) : null; donnee(g, 'debut', t ? (t.majLe || t.creeLe) : '');
      if (info) xp(g, info.xp, info.niveau, info.prochain);
    }
    const gm = etat.noeuds.postes.get('manager/manager');
    if (gm) {
      const routage = etat.taches.find(t => t.etat === 'encours' && !t.poste);
      const v = routage ? 'encours' : 'libre'; pose(gm, v); panneau(gm, v); donnee(gm, 'debut', routage ? (routage.majLe || routage.creeLe) : '');
      if (E?.manager) { xp(gm, E.manager.xp, E.manager.niveau, Math.ceil(10 * (2 ** E.manager.niveau - 1))); const r = $('[data-cle="routees"]'); if (r && r.textContent !== nombre(E.manager.routees)) r.textContent = nombre(E.manager.routees); }
    }
    for (const [id, c] of etat.noeuds.compteurs) {
      const enc = etat.taches.filter(t => t.departement === id && t.etat === 'encours').length;
      const fin = etat.taches.filter(t => t.departement === id && t.etat === 'fini').length;
      if (c.encours.textContent !== String(enc)) c.encours.textContent = String(enc);
      if (c.fini.textContent !== String(fin)) c.fini.textContent = String(fin);
      for (const g of etat.noeuds.couloirs.get(id) || []) g.classList.toggle('actif', enc > 0);
    }
    const s = etat.sante;
    if (s) {
      const n = $('[data-cle="notes"]'), p = $('[data-cle="produits"]');
      if (n && n.textContent !== nombre(s.notes)) n.textContent = nombre(s.notes);
      if (p && p.textContent !== nombre(s.produits)) p.textContent = nombre(s.produits);
      const tg = etat.noeuds.telegram;
      if (tg) {
        tg.led.classList.toggle('vert', !!(s.telegram?.configure && s.telegram?.ecoute));
        const q = s.telegram?.questionsOuvertes ? String(s.telegram.questionsOuvertes) : '0';
        if (tg.questions.textContent !== q) tg.questions.textContent = q;
        for (const g of etat.noeuds.couloirs.get('telegram') || []) g.classList.toggle('actif', q !== '0');
      }
    }
    tictac();
  }
  /** Chaque seconde : les chronos « RUN mm:ss » des postes en cours et l'heure du HUD. */
  function tictac() {
    const maintenant = Date.now();
    if (etat.noeuds) for (const g of etat.noeuds.postes.values()) {
      if (g.dataset.etat !== 'encours' || !g.dataset.debut) continue;
      const c = g.querySelector('.chrono'); const txt = 'RUN ' + chrono(maintenant - Date.parse(g.dataset.debut));
      if (c.textContent !== txt) c.textContent = txt;
    }
    const h = heureDe(new Date(maintenant + etat.decalageHeure).toISOString()) || '--:--';
    const eh = $('#heure'); if (eh.textContent !== h) eh.textContent = h;
  }

  /* ===================== le HUD ===================== */
  function majHaut(s) {
    const serveur = Date.parse(s.heure); if (!isNaN(serveur)) etat.decalageHeure = serveur - Date.now();
    const fp = JSON.stringify([s.connecteurs, s.usage, s.telegram?.configure, s.telegram?.ecoute]);
    if (etat.empreintes.haut === fp) return;
    etat.empreintes.haut = fp;
    const c = $('#connecteurs'); c.innerHTML = '';
    if (!s.connecteurs?.length) c.append(el('span', { class: 'pastille-vide', text: 'والو مازال' }));
    for (const k of s.connecteurs || []) {
      const ok = /^(connected|configur)/i.test(k.statut || '');
      c.append(el('span', { class: 'pastille-connecteur' + (ok ? ' ok' : ''), title: k.statut }, el('i', { class: 'point' }), el('span', { text: k.id }), el('small', { text: '· ' + (k.statut || '?') })));
    }
    $('#usage-fenetre').textContent = nombre(s.usage?.fenetre?.tokens);
    $('#usage-total').textContent = nombre(s.usage?.total?.tokens);
    $('#telegram-point').classList.toggle('vert', !!(s.telegram?.configure && s.telegram?.ecoute));
  }

  /* ===================== les onglets ===================== */
  function ouvrirOnglet(nom, { defiler = false } = {}) {
    if (nom === 'reglages' && etat.onglet !== 'reglages') etat.reglagesCharges = false; // à chaque ouverture, on relit les réglages
    etat.onglet = nom; memo.ecrire('station.onglet', nom);
    for (const b of document.querySelectorAll('.onglet')) { const actif = b.dataset.onglet === nom; b.classList.toggle('actif', actif); b.setAttribute('aria-selected', actif); }
    for (const v of document.querySelectorAll('.vue')) { const actif = v.id === 'vue-' + nom; v.hidden = !actif; v.classList.toggle('actif', actif); }
    if (defiler && etroit()) $('#panneau').scrollIntoView({ behavior: 'smooth', block: 'start' });
    rafraichirOnglet().catch(() => {});
  }
  function ouvrirEquipage(deptId, posteId) {
    etat.surligne = deptId ? { dept: deptId, poste: posteId } : null;
    etat.empreintes.equipage = null;
    if (etat.equipage) majEquipage(etat.equipage); // le tableau se redessine tout de suite avec la ligne surlignée
    ouvrirOnglet('equipage', { defiler: true });
    setTimeout(() => { const r = $('#table-equipage tr.surligne') || $(`#table-equipage tr[data-dept="${deptId}"]`); if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60);
  }

  /* ===================== la barre d'ordres et la fiche de mission ===================== */
  function ficheVisible() { return LIEN_DRIVE.test($('#ordre-texte').value); }
  function majFiche() { const f = $('#fiche-mission'); const v = ficheVisible(); if (f.hidden === v) { f.hidden = !v; if (!v) erreurFiche(''); } }
  function erreurFiche(msg) {
    const e = $('#fm-erreur'); e.hidden = !msg; e.textContent = msg || '';
    if (msg) { const f = $('#fiche-mission'); f.classList.remove('secouer'); void f.offsetWidth; f.classList.add('secouer'); }
  }
  /** Rend le texte final de la tâche, ou null si la fiche refuse (et affiche pourquoi, en darija). */
  function composerOrdre(texte) {
    if (!ficheVisible()) return texte;
    const gros = Number($('#fm-gros').value), detail = Number($('#fm-detail').value);
    if (!(gros > 0) || !(detail > 0)) { erreurFiche('لازم سعر الجملة وسعر البيع قبل ما تبعث'); ($('#fm-gros').value ? $('#fm-detail') : $('#fm-gros')).focus(); return null; }
    if (detail <= gros) { erreurFiche('سعر البيع لازم يكون أكبر من سعر الجملة — عاود صحّحو'); $('#fm-detail').focus(); return null; }
    erreurFiche('');
    const lien = (LIEN_DRIVE.exec(texte) || [''])[0];
    const val = id => $(id).value.trim();
    const fiche = ['FICHE DE MISSION', `lien: ${lien}`, `prix de gros: ${nombre(gros)} DA`, `prix de detail: ${nombre(detail)} DA`, `test ou stock: ${val('#fm-stock')}`,
      `compte publicitaire: ${val('#fm-compte') || 'a preciser'}`, `page: ${val('#fm-page') || 'a preciser'}`, `mode: ${val('#fm-mode')}`, `placements: ${val('#fm-placements')}`];
    return texte + '\n\n' + fiche.join('\n');
  }
  function viderFiche() { for (const id of ['#fm-gros', '#fm-detail', '#fm-compte', '#fm-page']) $(id).value = ''; $('#fm-stock').value = 'test'; $('#fm-mode').value = 'message'; $('#fm-placements').value = 'story+reels'; erreurFiche(''); }

  /* ===================== les missions ===================== */
  function carteMission(t) {
    const art = el('article', { class: 'mission', 'data-id': t.id, 'data-etat': t.etat });
    const meta = el('div', { class: 'mission-meta' },
      el('span', { class: 'badge ' + t.etat, text: ETIQ[t.etat] || t.etat }),
      el('span', { text: nomDept(t.departement) + (t.poste ? ' · ' + nomPoste(t.departement, t.poste) : '') }),
      el('span', { class: 'origine', text: ORIGINES[t.origine] || t.origine || '' }),
      t.dureeMs ? el('span', { class: 'chiffre', dir: 'ltr', text: secondes(t.dureeMs) }) : null,
      t.usage ? el('span', { class: 'chiffre', dir: 'ltr', text: nombre(t.usage) + ' tokens' }) : null,
      t.modele ? el('span', { class: 'chiffre', dir: 'ltr', text: t.modeleUtilise || t.modele }) : null
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
    const tete = el('header', { class: 'mission-tete' }, el('div', { class: 'mission-titre', dir: 'auto', text: t.titre || t.texte.slice(0, 60) }), meta, controles);
    const actions = el('div', { class: 'mission-actions' });
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
        bouton('امسح', 'rouge discret', async () => { if (!confirm('نمسح هاذ المهمة ؟')) return; await api(`/api/taches/${t.id}`, { method: 'DELETE' }); etat.deplies.delete(t.id); }),
        note
      );
    }
    const corps = el('div', { class: 'mission-corps', hidden: !etat.deplies.has(t.id) });
    const infos = el('div', { class: 'infos' }, el('span', { text: 'زادت' }), el('span', { class: 'chiffre', dir: 'ltr', text: dateDe(t.creeLe) }));
    if (t.phase) infos.append(el('span', { class: 'latin', dir: 'ltr', text: 'phase : ' + t.phase }));
    if (t.approbation?.reponse) infos.append(el('span', { class: 'latin', dir: 'ltr', text: 'réponse : ' + t.approbation.reponse + ' (' + (t.approbation.par || '') + ')' }));
    corps.append(infos);
    if (t.pourquoi) corps.append(el('div', { class: 'sous-titre', text: 'علاش هاذ القسم' }), blocTexte(t.pourquoi, 'texte-livrable'));
    if (t.etat === 'attente' && t.approbation) corps.append(el('div', { class: 'sous-titre', text: t.approbation.telegram?.envoye ? 'السؤال راح لتيليغرام' : 'السؤال ما راحش لتيليغرام' }), t.approbation.telegram?.fautes?.length ? blocTexte(t.approbation.telegram.fautes.join('\n'), 'texte-livrable') : null);
    corps.append(el('div', { class: 'sous-titre', text: 'المهمة المطلوبة' }), blocTexte(t.texte));
    if (t.erreur) corps.append(el('div', { class: 'erreur-cadre', dir: 'auto', text: t.erreur }));
    if (t.resultat) corps.append(el('div', { class: 'sous-titre', text: 'اللي رجع' }), blocTexte(t.resultat));
    else if (!t.erreur) corps.append(el('p', { class: 'vide', text: t.etat === 'encours' ? 'راهي تخدم — استنى' : 'مازال ما رجع والو' }));
    if (t.outilsUtilises?.length) corps.append(el('div', { class: 'infos' }, el('span', { text: 'الأدوات اللي خدم بيهم' }), el('span', { class: 'latin', dir: 'ltr', text: t.outilsUtilises.join(', ') })));
    if (t.note) { const b = el('button', { type: 'button', class: 'lien-note', text: 'الملف في الصندوق' }); b.addEventListener('click', e => { e.stopPropagation(); ouvrirNote(t.note, t.titre); }); corps.append(el('div', { class: 'infos' }, b, el('span', { class: 'latin chemin', dir: 'ltr', text: t.note }))); }
    tete.addEventListener('click', () => { const ouvert = corps.hidden; corps.hidden = !ouvert; if (ouvert) etat.deplies.add(t.id); else etat.deplies.delete(t.id); });
    art.append(tete, detailControle, actions, corps);
    if (etat.controleOuvert.get(t.id)) { const cle = etat.controleOuvert.get(t.id); const c = t.controles?.[cle]; remplirDetail(detailControle, cle, CONTROLES.find(x => x[0] === cle)?.[1] || cle, c); detailControle.hidden = false; controles.querySelector(`[data-controle="${cle}"]`)?.classList.add('ouverte'); }
    return art;
  }
  function remplirDetail(boite, cle, mot, c) {
    boite.innerHTML = '';
    if (!c) { boite.append(el('b', { text: mot }), ' — ', 'مازال ما تراقبش'); return; }
    boite.append(el('b', { text: mot }), ' ', el('span', { class: 'latin', dir: 'ltr', text: c.verdict }), el('div', { dir: 'auto', text: c.detail || '' }));
    const fautes = (c.fautes || []).filter(f => !(c.detail || '').includes(f));
    if (fautes.length) boite.append(el('ul', {}, fautes.map(f => el('li', { dir: 'auto', text: f }))));
    if (c.aCorriger) boite.append(el('div', { dir: 'auto' }, el('b', { text: 'واش يتصحّح : ' }), c.aCorriger));
  }
  function majMissions(liste) {
    etat.taches = liste;
    const conteneur = $('#liste-missions');
    const vide = conteneur.querySelector(':scope > .vide'); // seulement le message « liste vide », jamais un « استنى » à l'intérieur d'une carte
    if (!liste.length) { if (!vide) { conteneur.innerHTML = ''; conteneur.append(el('p', { class: 'vide', text: 'ما كاين حتى مهمة مازال' })); } etat.cartes.clear(); }
    else {
      if (vide) vide.remove();
      const vus = new Set(); let precedent = null;
      for (const t of liste) {
        vus.add(t.id);
        const fp = JSON.stringify(t);
        let c = etat.cartes.get(t.id);
        if (!c || c.fp !== fp) { const neuf = carteMission(t); if (c) c.el.replaceWith(neuf); else conteneur.append(neuf); c = { fp, el: neuf }; etat.cartes.set(t.id, c); }
        const attendu = precedent ? precedent.nextElementSibling : conteneur.firstElementChild;
        if (attendu !== c.el) conteneur.insertBefore(c.el, precedent ? precedent.nextElementSibling : conteneur.firstElementChild);
        precedent = c.el;
      }
      for (const [id, c] of etat.cartes) if (!vus.has(id)) { c.el.remove(); etat.cartes.delete(id); }
    }
    const comptes = {}; for (const t of liste) comptes[t.etat] = (comptes[t.etat] || 0) + 1;
    const fp = JSON.stringify(comptes);
    if (etat.empreintes.puces !== fp) {
      etat.empreintes.puces = fp;
      const p = $('#puces-etats'); p.innerHTML = '';
      for (const k of ['encours', 'attente', 'fini', 'echec', 'afaire']) if (comptes[k] || k !== 'afaire') p.append(el('span', { class: 'puce ' + k }, el('span', { text: ETIQ[k] }), el('b', { dir: 'ltr', text: String(comptes[k] || 0) })));
      const badge = $('#compte-attente'); badge.hidden = !comptes.attente; badge.textContent = String(comptes.attente || 0);
    }
  }

  /* ===================== l'équipage (le tableau) ===================== */
  function majEquipage(E) {
    etat.equipage = E;
    const fp = JSON.stringify([E, etat.surligne]);
    if (etat.empreintes.equipage === fp) return;
    etat.empreintes.equipage = fp;
    const B = etat.bureau;
    const M = $('#manager-carte'); M.innerHTML = '';
    if (E?.manager) M.append(
      el('span', { class: 'nom', text: B.centre.nomAr }), el('span', { class: 'latin', dir: 'ltr', text: 'Lv ' + E.manager.niveau }), el('span', { class: 'titre-eq', text: E.manager.titre }),
      el('span', { text: 'وزّع' }), el('span', { class: 'latin', dir: 'ltr', text: nombre(E.manager.routees) }),
      el('span', { text: 'XP تاع المحطة' }), el('span', { class: 'latin', dir: 'ltr', text: nombre(E.totalXp) })
    );
    const T = $('#table-equipage'); T.innerHTML = '';
    if (!E?.postes?.length) { T.append(el('p', { class: 'vide', text: 'الطاقم فارغ' })); return; }
    // sept colonnes étroites : l'état est le point à côté du nom (le mot en survol), l'XP une jauge
    const tete = ['البوسط', 'Lv', 'XP', 'المهام', 'كملات', 'مراقَبة', 'فشل'];
    const table = el('table', { class: 'etroite equipage' }, el('thead', {}, el('tr', {}, tete.map(h => el('th', { class: /^[A-Z]/.test(h) ? 'latin' : '', text: h })))));
    const corps = el('tbody');
    for (const d of departementsTries()) {
      corps.append(el('tr', { class: 'dept-tete', 'data-dept': d.id }, el('td', { colspan: 7 }, el('span', { text: (NOMS_MODULES[d.id] || d.nomAr) + ' — ' + d.nomAr }), ' ', el('span', { class: 'latin', dir: 'ltr', text: d.nom }))));
      for (const p of E.postes.filter(x => x.departement === d.id)) {
        const debut = 10 * (2 ** (p.niveau - 1) - 1); const ratio = p.prochain > debut ? Math.max(0, Math.min(1, (p.xp - debut) / (p.prochain - debut))) : 0;
        const surligne = etat.surligne && etat.surligne.dept === d.id && (!etat.surligne.poste || etat.surligne.poste === p.poste);
        const motEtat = p.etat === 'libre' ? 'فارغ' : (ETIQ[p.etat] || p.etat);
        corps.append(el('tr', { class: surligne ? 'surligne' : '', 'data-dept': d.id, 'data-poste': p.poste, 'data-etat': p.etat },
          el('td', { class: 'nom' }, el('i', { class: 'p-etat ' + p.etat, title: motEtat }), ' ', el('span', { text: p.nomAr, title: motEtat }), el('small', { text: p.nom })),
          el('td', { class: 'nombre lv', text: String(p.niveau), title: p.titre }),
          el('td', { class: 'nombre', title: 'XP ' + nombre(p.xp) + ' / ' + nombre(p.prochain) }, el('span', { class: 'jauge' }, el('i', { style: `width:${Math.round(ratio * 100)}%` })), el('small', { class: 'xp-txt', text: nombre(p.xp) + '/' + nombre(p.prochain) })),
          el('td', { class: 'nombre', text: nombre(p.taches) }), el('td', { class: 'nombre', text: nombre(p.finies) }), el('td', { class: 'nombre', text: nombre(p.passes) }), el('td', { class: 'nombre', text: nombre(p.echecs) })
        ));
      }
    }
    table.append(corps); T.append(table);
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

  /* ===================== l'outbox (les fichiers du carnet) ===================== */
  const ICONE_FICHIER = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 13' shape-rendering='crispEdges'><path d='M0 0h7v1h1v1h1v1h1v1h1v9H0z' fill='#dfe4ec'/><path d='M7 0h1v1h1v1h1v1h1v1H7z' fill='#8b95ab'/><path d='M2 6h7v1H2zM2 8h7v1H2zM2 10h5v1H2z' fill='#3d4661'/></svg>");
  function majCarnet(c) {
    const fp = JSON.stringify(c);
    if (etat.empreintes.carnet === fp) return;
    etat.empreintes.carnet = fp;
    const F = $('#outbox-fichiers'); F.innerHTML = '';
    if (!c.notes?.length) F.append(el('p', { class: 'vide', text: 'الصندوق فارغ مازال' }));
    for (const n of c.notes || []) {
      const b = el('button', { type: 'button', class: 'fichier', title: n.chemin },
        el('img', { class: 'icone', src: ICONE_FICHIER, alt: '' }),
        el('span', { class: 't', dir: 'auto', text: n.titre }),
        el('span', { class: 'd', text: [dateDe(n.date), n.departement, n.poste, Math.max(1, Math.round((n.taille || 0) / 1024)) + ' Ko'].filter(Boolean).join(' · ') }));
      b.addEventListener('click', () => ouvrirNote(n.chemin, n.titre));
      F.append(b);
    }
    const P = $('#outbox-produits'); P.innerHTML = '';
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
  }
  async function ouvrirNote(chemin, titre) {
    ouvrirOnglet('outbox');
    const v = $('#volet-note'); v.hidden = false;
    $('#volet-titre').textContent = titre || chemin;
    const contenu = $('#volet-contenu'); contenu.innerHTML = ''; contenu.append(el('p', { class: 'vide', text: 'راني نقرا' }));
    try {
      const r = await api('/api/carnet/note?chemin=' + encodeURIComponent(chemin));
      const m = /^---\n([\s\S]*?)\n---\n?/.exec(r.contenu || ''); const corps = m ? r.contenu.slice(m[0].length) : (r.contenu || '');
      contenu.innerHTML = '';
      if (m) {
        const e = {}; for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) { let val = l.slice(i + 1).trim(); try { val = JSON.parse(val); } catch {} e[l.slice(0, i).trim()] = val; } }
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

  /* ===================== le quart de nuit : l'absence et les routines ===================== */
  function majAbsence(a) {
    const fp = JSON.stringify(a);
    if (etat.empreintes.absence === fp) return;
    etat.empreintes.absence = fp;
    $('#absence-depuis').textContent = a.depuis ? dateDe(a.depuis) : '—';
    const C = $('#absence-comptes'); C.innerHTML = '';
    const compte = (classe, n, mot) => el('div', { class: 'compte-nuit ' + classe }, el('b', { dir: 'ltr', text: String(n) }), el('span', { text: mot }));
    C.append(compte('fini', a.finies?.length || 0, 'كملات'), compte('attente', a.attente?.length || 0, 'تستنى كلمتك'), compte('echec', a.echecs?.length || 0, 'ما كملاتش'), compte('encours', a.encours?.length || 0, 'راهي تخدم'), compte('', a.routinesParties || 0, 'روتينات راحت'), compte('', a.notes || 0, 'ملفات تكتبو'));
    const L = $('#absence-listes'); L.innerHTML = '';
    const liste = (titre, taches) => { if (!taches?.length) return; L.append(el('h3', { text: titre }), el('ul', {}, taches.map(t => el('li', { dir: 'auto' }, el('span', { text: t.titre }), ' ', el('span', { class: 'etiquette', text: '— ' + nomDept(t.departement) + (t.poste ? ' · ' + nomPoste(t.departement, t.poste) : '') }))))); };
    liste('اللي كملات', a.finies); liste('اللي تستنى كلمتك', a.attente); liste('اللي ما كملاتش', a.echecs);
    if (!(a.finies?.length || a.attente?.length || a.echecs?.length)) L.append(el('p', { class: 'vide', text: a.depuis ? 'والو ما صرا من وقت ما شفت' : 'اضغط « شفت » باش نبداو نحسبو من دروك' }));
  }
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
    pre.textContent = texte || '(السجل فارغ)';
    if (enBas) pre.scrollTop = pre.scrollHeight;
  }

  /* ===================== les réglages : chaque client règle le bureau comme il veut ===================== */
  const ERREURS_REGLAGES = { 'modèle inconnu': 'الموديل ما نعرفوهش — اختار sonnet ولا opus ولا fable', 'nom vide': 'اسم البيزنس لازم ما يكونش فارغ', 'créas par modèle : 1, 2, 3 ou 4': 'الكريات : واحد، زوج، ثلاثة ولا أربعة برك' };
  const nombreOuNul = v => { const s = String(v ?? '').trim(); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  /** Remplit le formulaire depuis GET /api/reglages. Le champ du mot de passe reste vide : le masque « ••••xxxx » n'est qu'un placeholder. */
  function majReglages(r) {
    etat.reglages = r;
    $('#rg-nom').value = r.nom || '';
    const m = $('#rg-modele'); if ([...m.options].some(o => o.value === r.modele)) m.value = r.modele;
    $('#rg-port').textContent = String(r.port || '—'); $('#rg-maison').textContent = r.maison || '—';
    const tok = $('#rg-token'); tok.value = ''; tok.placeholder = r.telegram?.token || '';
    $('#rg-chat').value = r.telegram?.chat_id || '';
    const tg = $('#rg-tg-etat'); tg.textContent = r.telegram?.configure ? 'تيليغرام مركّب — المفتاح مخبّي' : 'تيليغرام ماشي مركّب مازال'; tg.classList.toggle('ok', !!r.telegram?.configure);
    $('#rg-essai').disabled = !r.telegram?.configure;
    $('#rg-effacer').hidden = !(r.telegram?.token || r.telegram?.chat_id);
    for (const [id, v] of [['#rg-emballage', r.couts?.emballage], ['#rg-retour', r.couts?.retour], ['#rg-livraison', r.couts?.livraison], ['#rg-confirmation', r.declare?.confirmation], ['#rg-livraison-pct', r.declare?.livraison]]) $(id).value = v == null ? '' : String(v);
    $('#rg-wilayas').value = r.wilayas || ''; autoGrandir($('#rg-wilayas'));
    $('#rg-creas').value = String([1, 2, 3, 4].includes(+r.creasParModele) ? +r.creasParModele : 4);
    $('#rg-atelier').value = r.atelier || '';
    erreurReglages(''); $('#rg-statut').textContent = ''; etat.reglagesCharges = true;
  }
  function erreurReglages(msg) { const e = $('#rg-erreur'); e.hidden = !msg; e.textContent = msg || ''; }
  /** Compose le corps du POST ; rend null (et montre pourquoi) si un champ est faux. Le mot de passe ne part que s'il a été tapé. */
  function composerReglages() {
    const nom = $('#rg-nom').value.trim();
    if (!nom) { erreurReglages('اسم البيزنس لازم ما يكونش فارغ'); $('#rg-nom').focus(); return null; }
    const couts = { emballage: nombreOuNul($('#rg-emballage').value), retour: nombreOuNul($('#rg-retour').value), livraison: nombreOuNul($('#rg-livraison').value) };
    const declare = { confirmation: nombreOuNul($('#rg-confirmation').value), livraison: nombreOuNul($('#rg-livraison-pct').value) };
    for (const [k, v] of Object.entries(couts)) if (v != null && v < 0) { erreurReglages('التكاليف ما تكونش تحت الصفر'); $('#rg-' + k).focus(); return null; }
    for (const [k, v] of Object.entries(declare)) if (v != null && (v < 0 || v > 100)) { erreurReglages('النسبة لازم تكون بين الصفر والمية'); $(k === 'confirmation' ? '#rg-confirmation' : '#rg-livraison-pct').focus(); return null; }
    const corps = { nom, modele: $('#rg-modele').value, atelier: $('#rg-atelier').value.trim(), creasParModele: Number($('#rg-creas').value), couts, declare, wilayas: $('#rg-wilayas').value.trim(), telegram: { chat_id: $('#rg-chat').value.trim() } };
    const token = $('#rg-token').value.trim();
    if (token && !token.startsWith('••••')) corps.telegram.token = token;
    return corps;
  }
  async function enregistrerReglages(corps) {
    const b = $('#rg-sauver'); b.disabled = true; $('#rg-statut').textContent = 'راني نسجّل';
    try {
      await api('/api/reglages', { method: 'POST', body: corps });
      majReglages(await api('/api/reglages')); // relu à la source : ce qui s'affiche est ce que le serveur a gardé
      $('#rg-statut').textContent = 'تسجّل — كلش في الجهاز تاعك'; toast('تسجّل');
      await rafraichir();
    } catch (e) { const msg = ERREURS_REGLAGES[e.message]; erreurReglages(msg || 'ما تسجّلش'); $('#rg-statut').textContent = ''; toast(msg || 'ما تسجّلش', { erreur: true, brut: msg ? '' : e.message }); }
    finally { b.disabled = false; }
  }

  /* ===================== le sas Telegram ===================== */
  async function ouvrirTelegram() {
    const corps = $('#telegram-corps'); corps.innerHTML = ''; corps.append(el('p', { class: 'vide', text: 'راني نقرا' }));
    $('#fiche-telegram').showModal();
    let t; try { t = await api('/api/telegram'); } catch (e) { corps.innerHTML = ''; corps.append(el('div', { class: 'erreur-cadre', text: e.message })); return; }
    corps.innerHTML = '';
    const ligne = (mot, valeur) => el('div', { class: 'tg-ligne' }, el('span', { text: mot }), el('span', { class: 'v', text: valeur }));
    corps.append(ligne('مركّب', t.configure ? 'واه' : 'لا'), ligne('راه يسمع', t.ecoute ? 'واه' : 'لا'), ligne('آخر إرسال', t.dernierEnvoi ? dateDe(t.dernierEnvoi) : '—'), ligne('آخر رد', t.dernierRetour ? dateDe(t.dernierRetour) : '—'), ligne('أسئلة مفتوحة', String(t.questionsOuvertes || 0)));
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
      case 'outbox': majCarnet(await api('/api/carnet')); break;
      case 'nuit': { const [r, a] = await Promise.all([api('/api/routines'), api('/api/absence' + (etat.depuis ? '?depuis=' + encodeURIComponent(etat.depuis) : ''))]); majRoutines(r); majAbsence(a); break; }
      case 'journal': majJournal(await api('/api/journal')); break;
      case 'reglages': if (!etat.reglagesCharges) majReglages(await api('/api/reglages')); break; // jamais réécrit pendant que le client tape
    }
  }
  let enCours = false;
  async function rafraichir() {
    if (enCours) return; enCours = true;
    try {
      const [s, t, e] = await Promise.all([api('/api/sante'), api('/api/taches'), api('/api/equipage')]);
      etat.sante = s; majHaut(s); majMissions(Array.isArray(t) ? t : []); majEquipage(e);
      const xt = $('#xp-total'); if (xt.textContent !== nombre(e?.totalXp)) xt.textContent = nombre(e?.totalXp);
      majStation();
      horsLigne(false);
      await rafraichirOnglet();
    } catch (e) { horsLigne(true, e.message); }
    finally { enCours = false; }
  }

  /* ===================== branchements ===================== */
  function remplirSelects() {
    for (const id of ['#ordre-departement', '#routine-departement']) { const s = $(id); for (const d of departementsTries()) s.append(el('option', { value: d.id, text: (NOMS_MODULES[d.id] || d.nomAr) + ' — ' + d.nomAr, title: d.nom })); }
    const m = $('#ordre-modele'); if (etat.bureau.modele && [...m.options].some(o => o.value === etat.bureau.modele)) m.value = etat.bureau.modele;
  }
  function brancher() {
    for (const b of document.querySelectorAll('.onglet')) b.addEventListener('click', () => ouvrirOnglet(b.dataset.onglet));
    for (const ta of document.querySelectorAll('textarea')) { ta.addEventListener('input', () => autoGrandir(ta)); autoGrandir(ta); }
    $('#ordre-texte').addEventListener('input', majFiche);
    $('#formulaire-ordre').addEventListener('submit', async e => {
      e.preventDefault();
      const brut = $('#ordre-texte').value.trim(); if (!brut) return;
      const texte = composerOrdre(brut); if (texte === null) return;
      const b = $('#bouton-envoyer'); b.disabled = true;
      try {
        await api('/api/taches', { method: 'POST', body: { texte, departement: $('#ordre-departement').value || undefined, modele: $('#ordre-modele').value, besoinOk: $('#ordre-besoin-ok').checked } });
        $('#ordre-texte').value = ''; autoGrandir($('#ordre-texte')); viderFiche(); majFiche(); toast('راحت للمانجر — المحطة بدات تخدم');
        await rafraichir();
      } catch (err) { toast('ما راحتش', { erreur: true, brut: err.message }); }
      finally { b.disabled = false; }
    });
    $('#ordre-texte').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#formulaire-ordre').requestSubmit(); } });
    $('#formulaire-coach').addEventListener('submit', async e => {
      e.preventDefault();
      const ta = $('#coach-texte'); const texte = ta.value.trim(); if (!texte || etat.coachOccupe) return;
      etat.coachOccupe = true; $('#bouton-ab3ath').disabled = true; $('#coach-ecrit').hidden = false;
      ta.value = ''; autoGrandir(ta);
      try { await api('/api/chat/coach', { method: 'POST', body: { texte } }); majCoach(await api('/api/chat/coach')); }
      catch (err) { toast('الكوتش ما جاوبش', { erreur: true, brut: err.message }); }
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
    $('#formulaire-reglages').addEventListener('submit', async e => { e.preventDefault(); const corps = composerReglages(); if (corps) await enregistrerReglages(corps); });
    $('#rg-essai').addEventListener('click', async e => {
      const b = e.currentTarget; b.disabled = true;
      try { const r = await api('/api/telegram/essai', { method: 'POST' }); toast(r.envoye ? 'راحت الرسالة — شوف تيليغرام تاعك' : 'ما راحتش', { erreur: !r.envoye, brut: (r.fautes || []).join(' ; ') }); }
      catch (err) { toast('ما راحتش', { erreur: true, brut: err.message }); }
      finally { b.disabled = !etat.reglages?.telegram?.configure; }
    });
    $('#rg-effacer').addEventListener('click', async () => { if (!confirm('نمسح المفتاح تاع تيليغرام و chat_id ؟')) return; await enregistrerReglages({ telegram: { effacer: true } }); });
    $('#bouton-vu').addEventListener('click', async () => { etat.depuis = new Date().toISOString(); memo.ecrire('station.vu', etat.depuis); etat.empreintes.absence = null; toast('مليح — نحسبو من دروك'); await rafraichirOnglet(); });
    addEventListener('pagehide', () => memo.ecrire('station.vu', new Date().toISOString()));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') memo.ecrire('station.vu', new Date().toISOString()); });
    $('#volet-fermer').addEventListener('click', () => { $('#volet-note').hidden = true; });
    $('#hud-telegram').addEventListener('click', ouvrirTelegram);
    $('#bouton-plier').addEventListener('click', e => { const b = $('#station'); const plie = b.classList.toggle('plie'); e.currentTarget.textContent = plie ? 'حلّ المحطة' : 'اطوي المحطة'; e.currentTarget.setAttribute('aria-expanded', String(!plie)); if (!plie) serrerTextes($('#scene')); });
    for (const d of document.querySelectorAll('dialog')) d.addEventListener('click', e => { if (e.target === d) d.close(); });
    let minuteur = null;
    addEventListener('resize', () => { clearTimeout(minuteur); minuteur = setTimeout(() => { const dispo = Math.max(240, $('#scene').clientWidth || 900); const z = choisirZ(dispo); if (Math.floor(dispo / z) * z !== etat.largeur || z !== etat.z) construireStation(); }, 150); });
    setInterval(tictac, 1000);
  }

  async function demarrer() {
    try { etat.bureau = await api('/api/bureau'); }
    catch (e) { $('#station-chargement').textContent = 'ما قدرتش نقرا /api/bureau : ' + e.message; horsLigne(true, e.message); setTimeout(demarrer, 3000); return; }
    remplirSelects(); brancher(); construireStation();
    ouvrirOnglet(['pont', 'equipage', 'outbox', 'nuit', 'coach', 'journal', 'reglages'].includes(etat.onglet) ? etat.onglet : 'pont');
    await rafraichir();
    setInterval(rafraichir, 3000);
  }
  demarrer();
})();
