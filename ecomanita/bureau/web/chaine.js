'use strict';
/* ecom manita — LA CHAÎNE DANS LA PAGE (v0.3) : l'onglet « الموديلات » (chaque modèle, du lien Drive à la
   publicité qui tourne) et l'onglet « التحضير » (la liste à cocher de l'installation et les réglages de la
   chaîne). Code original, sans bibliothèque. Darija pour le texte, latin pour les chiffres.
   v0.3.8 : les LOTS (un lien, plusieurs modèles) en cours de descente ou de séparation, et le numéro du modèle
   (« Modele 1 / 3 ») sur chaque mission née d'un lot ; une étape sautée compte comme faite. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  function el(tag, attrs = {}, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of enfants.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  async function api(chemin, { method = 'GET', body = null } = {}) {
    const o = { method, cache: 'no-store', headers: { 'x-manita': '1' } };
    if (body !== null) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(body); }
    const r = await fetch(chemin, o); let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error((j && j.erreur) || `${r.status} ${r.statusText}`);
    return j;
  }
  function toast(texte, erreur = false, brut = '') {
    const t = el('div', { class: 'toast' + (erreur ? ' erreur' : '') }, texte, brut ? el('span', { class: 'brut', text: brut }) : null);
    ($('#toasts') || document.body).append(t); setTimeout(() => t.remove(), erreur ? 9000 : 4000);
  }
  const visible = id => { const v = $('#vue-' + id); return v && !v.hidden; };
  const ETATS = { encours: 'راهي تخدم', attente: 'تستنى ردّك', bloquee: 'محبوسة', suivi: 'البوب تخدم', finie: 'كملات', arretee: 'حبسناها', quota: 'الكوطا تاع كلود، نستناو', connecteur: 'الكونيكتور لازم يتعاود يتربط' };
  const ATTENTES = { couleurs: 'سمّي اللونات في تيليغرام', 'page-ok': 'شوف الصفحة واضغط في تيليغرام', porte: 'الحساب يقول خسارة : جاوب في تيليغرام', lance: 'البوب واجدة : اضغط لانسي في تيليغرام', monte: 'نطلّعو البودجي ؟ جاوب في تيليغرام', perte: 'خسارة كبيرة : جاوب في تيليغرام' };
  const ouvertes = new Set();
  // 08/10/2026 : plus de repli « un lien par modèle » — « vide » (aucun groupe pur, le seul arrêt), « seul » (N = 1 vérifié : sa mission est partie)
  const ETATS_LOT = { quota: 'الكوطا تاع كلود، نستناو', connecteur: 'الكونيكتور لازم يتعاود يتربط', encours: 'نفرزو الموديلات', pret: 'أكّد الموديلات في تيليغرام', vide: 'ما لقيناش موديل واضح', seul: 'موديل واحد : الخدمة خرجت', echec: 'صرا مشكل', annule: 'حبسناه', missions: 'الموديلات خرجو' };
  const ETAPES_LOT = { descente: 'تحميل الفيديوات', candidats: 'الفرز بالبيكسل', lecture: 'القراية بالعين', construction: 'دوسي لكل موديل' };
  const classeEtat = e => (e === 'saute' ? 'fini saute' : e); // une étape sautée (la séparation d'une mission seule) compte comme faite

  /* ===================== الموديلات ===================== */
  async function majMissions() {
    const liste = await api('/api/missions');
    const n = liste.filter(m => m.attente || m.etat === 'bloquee').length;
    const c = $('#compte-missions'); if (c) { c.hidden = !n; c.textContent = n; }
    if (!visible('missions')) return;
    // les lots sont lus AVANT de vider la liste : deux rafraîchissements qui se croisent ne doublent pas les cartes
    let lots = []; try { lots = (await api('/api/lots')).filter(l => ['encours', 'pret', 'quota', 'connecteur'].includes(l.etat) || (['vide', 'echec'].includes(l.etat) && Date.now() - Date.parse(l.creeLe) < 86400000)); } catch {}
    const L = $('#liste-missions'); L.innerHTML = '';
    for (const l of lots) L.append(carteLot(l));
    if (!liste.length && !lots.length) { L.append(el('p', { class: 'vide', text: 'مازال حتى موديل — ابعث لينك الدرايف للروبو تاعك في تيليغرام' })); return; }
    for (const m of liste) L.append(carteMission(m));
    for (const id of ouvertes) { const z = L.querySelector(`[data-id="${id}"] .mission-detail`); if (z) remplirDetail(id, z); }
  }
  function carteLot(l) {
    const frise = el('div', { class: 'frise', 'aria-label': 'المراحل' });
    for (const [id, e] of Object.entries(l.etapes || {})) frise.append(el('i', { class: classeEtat(e.etat), title: `${ETAPES_LOT[id] || id} — ${e.etat}${e.erreur ? ' : ' + e.erreur : ''}` }));
    const etape = l.etat === 'encours' ? (ETAPES_LOT[l.etape] || l.etape) : '';
    return el('article', { class: 'mission', 'data-etat': l.etat === 'encours' ? 'encours' : l.etat === 'pret' ? 'attente' : 'bloquee', 'data-attente': l.etat === 'pret' ? 'true' : 'false' },
      el('div', { class: 'mission-tete' }, el('strong', { class: 'latin', dir: 'ltr', text: `LOT ${l.id} · ${l.n} annonce(s)${l.trouves ? ` · ${l.trouves} trouve(s)` : ''}${l.misDeCote ? ` · ${l.misDeCote} video(s) de cote` : ''}${l.retires ? ` · ${l.retires} retire(s), sans troncon sain` : ''}${l.lectureSeule ? ' · une seule lecture verifiee' : ''}` }), el('span', { class: 'badge ' + (l.etat === 'encours' ? 'encours' : l.etat === 'pret' ? 'attente' : 'echec'), text: ETATS_LOT[l.etat] || l.etat })),
      frise,
      etape ? el('p', { class: 'mission-aide', text: 'المرحلة : ' + etape }) : null,
      // AVANT la lecture des planches, le nombre des pixels n'est qu'une ESTIMATION (« تقريبا ») : jamais un compte sûr
      Array.isArray(l.estimation) && !l.trouves ? el('p', { class: 'mission-aide', 'data-estimation': 'true', text: l.estimation.join(' — ') }) : null,
      l.raison ? el('p', { class: 'mission-aide latin', dir: 'ltr', text: l.raison }) : null,
      (l.modeles || []).length ? el('p', { class: 'mission-aide latin', dir: 'ltr', text: l.modeles.map(md => `${md.rang}. ${md.nom} (${(md.couleurs || []).join(', ') || '?'})`).join(' · ') }) : null,
      // [desc-bilan] le BILAN DU LOT (le même compte que le message au client) : pages sorties avec leur lien, modèles sans page et pourquoi
      l.bilan && l.etat === 'missions' ? el('p', { class: 'mission-aide latin', dir: 'ltr', 'data-bilan': 'true', text: `BILAN : ${l.bilan.trouves} trouve(s) · ${l.bilan.pages.length} page(s) sortie(s)${l.bilan.pages.length ? ' : ' + l.bilan.pages.map(p => `${p.nom} ${p.url || '(sans lien)'}`).join(' · ') : ''}${l.bilan.sans.length ? ' · sans page : ' + l.bilan.sans.map(x => `${x.nom} (${x.raison})`).join(' · ') : ''}${l.bilan.enRoute ? ` · ${l.bilan.enRoute} en route` : ''}${l.bilan.envoyeLe ? '' : ' · pas encore envoye'}` }) : null);
  }
  function carteMission(m) {
    const art = el('article', { class: 'mission', 'data-id': m.id, 'data-etat': m.etat, 'data-attente': m.attente ? 'true' : 'false' });
    const frise = el('div', { class: 'frise', 'aria-label': 'المراحل' });
    for (const [id, e] of Object.entries(m.etapes)) frise.append(el('i', { class: classeEtat(e.etat), title: `${e.ar} — ${e.etat}${e.erreur ? ' : ' + e.erreur : ''}` }));
    const actions = el('div', { class: 'barre-ligne' });
    if (m.etat === 'bloquee' || m.etat === 'connecteur') actions.append(el('button', { type: 'button', class: 'bouton principal', text: 'عاود', onclick: () => agir(m.id, 'reprendre') }));
    if (m.etat === 'suivi') actions.append(el('button', { type: 'button', class: 'bouton', text: 'اقرا اليوم دروك', onclick: () => agir(m.id, 'suivre') }));
    if (!['arretee', 'finie'].includes(m.etat)) actions.append(el('button', { type: 'button', class: 'bouton rouge', text: 'حبس', onclick: () => { if (confirm('نحبسو هاذ الموديل ؟ إذا البوب تخدم، تتحبس هي تاني.')) agir(m.id, 'arreter'); } }));
    if (m.produit) actions.append(el('a', { class: 'bouton discret', href: m.produit, target: '_blank', rel: 'noopener', text: 'الصفحة' }));
    const detail = el('div', { class: 'mission-detail', hidden: !ouvertes.has(m.id) });
    art.append(
      el('div', { class: 'mission-tete' }, el('strong', { class: 'latin', dir: 'ltr', text: m.lot ? `${m.code} · Modele ${m.lot.rang} / ${m.lot.total}` : m.code }), el('span', { dir: 'auto', text: m.nom && m.nom !== 'auto' ? m.nom : '' }), el('span', { class: 'badge ' + (m.etat === 'bloquee' ? 'echec' : m.attente ? 'attente' : 'encours'), text: ETATS[m.etat] || m.etat })),
      frise,
      m.attente ? el('p', { class: 'mission-aide', text: ATTENTES[m.attente] || 'تستنى ردّك في تيليغرام' }) : (m.etapes[m.etape] ? el('p', { class: 'mission-aide', text: 'المرحلة : ' + m.etapes[m.etape].ar }) : null),
      actions,
      el('button', { type: 'button', class: 'bouton-mini', text: ouvertes.has(m.id) ? 'خبّي التفاصيل' : 'التفاصيل', onclick: e => { if (ouvertes.has(m.id)) { ouvertes.delete(m.id); detail.hidden = true; e.target.textContent = 'التفاصيل'; } else { ouvertes.add(m.id); detail.hidden = false; e.target.textContent = 'خبّي التفاصيل'; remplirDetail(m.id, detail); } } }),
      detail);
    return art;
  }
  async function remplirDetail(id, z) {
    let m; try { m = await api('/api/missions/' + id); } catch (e) { z.textContent = e.message; return; }
    z.innerHTML = '';
    for (const [eid, st] of Object.entries(m.etapes || {})) z.append(el('div', { class: 'ligne-etape' }, el('span', { class: 'badge ' + (st.etat === 'fini' || st.etat === 'saute' ? 'fini' : st.etat === 'echec' ? 'echec' : st.etat === 'attente' ? 'attente' : 'encours'), text: st.etat }), el('span', { class: 'latin', dir: 'ltr', text: eid }), st.erreur ? el('span', { class: 'erreur latin', dir: 'ltr', text: st.erreur }) : null));
    const planches = (m.d && m.d.creas || []).slice(0, 10).map(c => c.fichier.replace(/\\/g, '/').split('/').pop().replace(/^variante_(\d+)\.mp4$/i, '_planche_variante_$1.png'));
    if (planches.length) { const g = el('div', { class: 'planches' }); for (const p of planches) g.append(el('img', { src: `/api/missions/${id}/fichier?chemin=${encodeURIComponent('creas/' + p)}`, alt: p, loading: 'lazy' })); z.append(el('strong', { text: 'الفيديوات' }), g); }
    const nums = [];
    if (m.d && m.d.be) nums.push(`break even / commande : ${Math.round(m.d.be.par_commande)} DA`);
    if (m.d && m.d.budget) nums.push(`budget : ${m.d.budget.total_usd} $ / jour · ${m.d.budget.ad_sets} ad set(s)`);
    if (m.d && m.d.noms) nums.push(`clé du test : ${m.d.noms.cle}`);
    if (m.d && m.d.suivi && m.d.suivi.jours && m.d.suivi.jours.length) { const j = m.d.suivi.jours[m.d.suivi.jours.length - 1]; nums.push(`jour ${j.jour} : ${j.commandes} commandes · ${j.confirmees} confirmées · ${j.livrees} livrées · ${j.depense_da} DA · ${j.decision}`); }
    if (nums.length) z.append(el('pre', { text: nums.join('\n') }));
    for (const j of (m.journal || []).slice(-3)) z.append(el('details', {}, el('summary', { class: 'latin', dir: 'ltr', text: j.fichier }), el('pre', { text: j.fin })));
  }
  async function agir(id, quoi) {
    try { await api(`/api/missions/${id}/${quoi}`, { method: 'POST', body: {} }); toast('وصلني'); await majMissions(); }
    catch (e) { toast('ما خدمش', true, e.message); }
  }

  /* ===================== التحضير ===================== */
  let reglagesCharges = false;
  // ce que le formulaire montrait au chargement : un champ que le client n'a pas touché garde la valeur ACTUELLE du bureau
  // (sinon un onglet resté ouvert renverrait de vieilles valeurs et écraserait ce que Claude a enregistré entre-temps par l'API)
  let vus = {};
  const CHAMPS = ['#ch-taux', '#ch-plafond', '#ch-cod', '#ch-code', '#ch-heure', '#ch-reappro', '#ch-musiques', '#ch-python', '#ch-ffmpeg', '#ch-cloudflared', '#ch-r2-compte', '#ch-r2-bucket', '#ch-r2-id', '#ch-r2-base'];
  const typeDepot = () => (document.querySelector('input[name="ch-depot"]:checked') || {}).value || 'tunnel';
  async function majInstallation(complet = false) {
    const r = complet ? await api('/api/installation/verifier', { method: 'POST', body: {} }) : await api('/api/installation');
    const l = complet ? r.controles : (r.verifieLe && r.controles.length ? r.controles : r.rapide);
    // [relecture] 10/10/2026 : sans jeton (cas permis : le connecteur), les deux lignes du jeton Meta restent NON_VERIFIABLE — elles
    // ne comptent pas dans le badge (il ne revenait jamais à zéro)
    const manque = l.filter(x => x.verdict !== 'PASSE' && !(x.verdict === 'NON_VERIFIABLE' && ['meta-jeton', 'meta-ecriture'].includes(x.cle))).length;
    const c = $('#compte-installation'); if (c) { c.hidden = !manque; c.textContent = manque; }
    if (!visible('installation')) return;
    const U = $('#liste-installation'); U.innerHTML = '';
    for (const x of l) U.append(el('li', { 'data-v': x.verdict }, el('span', { class: 'marque', text: x.verdict === 'PASSE' ? '✓' : x.verdict === 'ECHEC' ? '✗' : '?' }), el('div', {}, el('span', { text: x.ar }), el('small', { text: x.detail || '' }))));
    $('#ins-date').textContent = r.verifieLe ? 'آخر فحص كامل : ' : '';
    if (r.verifieLe) $('#ins-date').append(el('span', { class: 'latin', dir: 'ltr', text: new Date(r.verifieLe).toLocaleString('fr-FR') }));
    if (!reglagesCharges) { reglagesCharges = true; await chargerReglages(); }
  }
  async function chargerReglages() {
    const r = await api('/api/reglages');
    $('#ch-taux').value = r.taux ?? ''; $('#ch-plafond').value = r.plafondJourDA ?? ''; $('#ch-cod').value = (r.couts && r.couts.fraisCod) ?? 0;
    $('#ch-code').value = r.codeBoutique || ''; $('#ch-heure').value = r.heureRapport || '20:30'; $('#ch-reappro').value = r.joursReappro ?? 7;
    $('#ch-musiques').value = r.musiques || ''; $('#ch-python').value = r.python || ''; $('#ch-ffmpeg').value = r.ffmpegDossier || ''; $('#ch-cloudflared').value = r.cloudflared || '';
    for (const b of document.querySelectorAll('input[name="ch-depot"]')) b.checked = b.value === (r.depot && r.depot.type || 'tunnel');
    const r2 = (r.depot && r.depot.r2) || {}; $('#ch-r2-compte').value = r2.compte || ''; $('#ch-r2-bucket').value = r2.bucket || ''; $('#ch-r2-id').value = r2.cleId || ''; $('#ch-r2-secret').value = ''; $('#ch-r2-secret').placeholder = r2.cleSecrete || ''; $('#ch-r2-base').value = r2.basePublique || '';
    $('#ch-r2').hidden = !(r.depot && r.depot.type === 'r2');
    $('#ch-tg-token').value = ''; $('#ch-tg-token').placeholder = r.telegram.token || ''; $('#ch-tg-etat').textContent = r.telegram.chat_id ? 'chat_id ' + r.telegram.chat_id : '';
    $('#ch-meta-jeton').value = ''; $('#ch-meta-jeton').placeholder = (r.meta && r.meta.jeton) || ''; afficherSondeMeta(r.meta && r.meta.sonde);
    const p = r.connecteurs || {}; $('#ins-sonde').textContent = `tassyir ${p.tassyir ? '✓' : '✗'} · meta ${p.meta ? '✓' : '✗'}`;
    afficherComptes(r); afficherWilayas(r.ciblage);
    const sel = $('#ch-meta-compte'); if (sel) { const avant = sel.value; sel.innerHTML = ''; for (const c of r.comptes || []) sel.append(el('option', { value: String(c.id).replace(/^act_/, ''), text: `${c.nom} (${c.devise || '?'})` })); if (avant) sel.value = avant; sel.hidden = (r.comptes || []).length < 2; }
    vus = {}; for (const id of CHAMPS) vus[id] = $(id).value; vus.depot = typeDepot();
    try { afficherEssaiMeta(await api('/api/depot/essai-meta')); } catch {}
  }
  /** La sonde du jeton Meta : le texte darija du serveur (ok, ou lequel des trois refus), jamais le jeton. */
  function afficherSondeMeta(r) { const z = $('#ch-meta-jeton-etat'); if (z) z.textContent = r ? (r.ok ? '✓ ' : '✗ ') + (r.texte || '') : ''; }
  function afficherEssaiMeta(r) {
    const z = $('#ch-meta-etat'); if (!z || !r || r.etat === 'jamais') return;
    z.textContent = r.etat === 'encours' ? '…' : r.etat === 'refuse' ? '✗ ' + r.detail : (r.verdict === 'PASSE' ? '✓ ' : '✗ ') + (r.video_id ? 'video_id ' + r.video_id + ' · ' : '') + (r.detail || '');
  }
  function afficherWilayas(cb) {
    const z = $('#ins-wilayas-etat'); if (!z) return;
    const n = cb && Array.isArray(cb.regions) ? cb.regions.length : 0;
    z.textContent = !cb ? 'مازال' : (cb.confirme ? 'مأكّدين : ' : 'لازم تأكّدهم في الإعدادات : '); if (cb) z.append(el('span', { class: 'latin', dir: 'ltr', text: `${n} / 25` }));
  }
  function afficherComptes(r) {
    const z = $('#ins-comptes-liste'); z.innerHTML = '';
    if ((r.comptes || []).length) z.append(el('div', {}, el('strong', { text: 'الكونتات تاع البوب : ' }), ...r.comptes.map(c => el('span', { class: 'latin', dir: 'ltr', text: ` ${c.nom} (${c.devise})${c.mcp_ok === false ? ' ✗ MCP' : ''} ` }))));
    if ((r.pages || []).length) z.append(el('div', {}, el('strong', { text: 'الصفحات : ' }), ...r.pages.map(c => el('span', { dir: 'auto', text: ` ${c.nom} ` }))));
    const bout = r.boutiques || [];
    if (bout.length) {
      z.append(el('strong', { text: 'البوتيك تاع تسيير :' }));
      for (const b of bout) z.append(el('label', {}, el('input', { type: 'radio', name: 'ch-magasin', value: b.id, checked: r.magasin && r.magasin.id === b.id ? true : null }), el('span', { dir: 'auto', text: `${b.nom}${b.actif === false ? ' (مسكّرة)' : ''}` })));
    }
  }
  async function sauver(e) {
    e.preventDefault(); const b = $('#ch-sauver'); b.disabled = true;
    const num = id => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
    try {
      const actuel = await api('/api/reglages');
      const touche = id => $(id).value !== vus[id];
      const ou = (id, valeur, deja) => touche(id) ? valeur : deja;
      const a2 = (actuel.depot && actuel.depot.r2) || {};
      const corps = { taux: ou('#ch-taux', num('#ch-taux'), actuel.taux ?? null), plafondJourDA: ou('#ch-plafond', num('#ch-plafond'), actuel.plafondJourDA ?? null),
        codeBoutique: ou('#ch-code', $('#ch-code').value.trim().toUpperCase(), actuel.codeBoutique || ''), heureRapport: ou('#ch-heure', $('#ch-heure').value || '20:30', actuel.heureRapport || '20:30'), joursReappro: ou('#ch-reappro', num('#ch-reappro') || 7, actuel.joursReappro ?? 7),
        musiques: ou('#ch-musiques', $('#ch-musiques').value.trim(), actuel.musiques || ''), python: ou('#ch-python', $('#ch-python').value.trim(), actuel.python || ''), ffmpegDossier: ou('#ch-ffmpeg', $('#ch-ffmpeg').value.trim(), actuel.ffmpegDossier || ''), cloudflared: ou('#ch-cloudflared', $('#ch-cloudflared').value.trim(), actuel.cloudflared || ''),
        couts: { ...(actuel.couts || {}), fraisCod: ou('#ch-cod', num('#ch-cod') || 0, (actuel.couts && actuel.couts.fraisCod) ?? 0) },
        depot: { type: typeDepot() !== vus.depot ? typeDepot() : ((actuel.depot && actuel.depot.type) || 'tunnel'),
          r2: { compte: ou('#ch-r2-compte', $('#ch-r2-compte').value, a2.compte || ''), bucket: ou('#ch-r2-bucket', $('#ch-r2-bucket').value, a2.bucket || ''), cleId: ou('#ch-r2-id', $('#ch-r2-id').value, a2.cleId || ''), cleSecrete: $('#ch-r2-secret').value, basePublique: ou('#ch-r2-base', $('#ch-r2-base').value, a2.basePublique || '') } } };
      const m = document.querySelector('input[name="ch-magasin"]:checked');
      if (m) { const bt = (actuel.boutiques || []).find(x => x.id === m.value); if (bt) corps.magasin = bt; }
      const tok = $('#ch-tg-token').value.trim(); if (tok) corps.telegram = { token: tok };
      const jm = $('#ch-meta-jeton').value.trim(); if (jm) corps.meta = { jeton: jm };
      await api('/api/reglages', { method: 'POST', body: corps });
      toast('تسجّل'); await chargerReglages(); await majInstallation();
    } catch (x) { toast('ما تسجّلش', true, x.message); } finally { b.disabled = false; }
  }
  async function bouton(btn, fn) { btn.disabled = true; const t = btn.textContent; btn.textContent = 'استنى…'; try { await fn(); } catch (x) { toast('ما خدمش', true, x.message); } finally { btn.disabled = false; btn.textContent = t; } }

  /* ===================== branchements ===================== */
  document.addEventListener('DOMContentLoaded', () => {
    $('#formulaire-chaine').addEventListener('submit', sauver);
    for (const r of document.querySelectorAll('input[name="ch-depot"]')) r.addEventListener('change', () => { $('#ch-r2').hidden = r.value !== 'r2' || !r.checked; });
    $('#ins-tout').addEventListener('click', e => bouton(e.currentTarget, () => majInstallation(true)));
    $('#ins-sonder').addEventListener('click', e => bouton(e.currentTarget, async () => { const r = await api('/api/connecteurs/sonder', { method: 'POST', body: {} }); $('#ins-sonde').textContent = `tassyir ${r.tassyir ? '✓' : '✗'} · meta ${r.meta ? '✓' : '✗'}`; toast(r.manque.length ? 'ناقص : ' + r.manque.join(', ') : 'لقيت الزوج'); await majInstallation(); }));
    $('#ins-comptes').addEventListener('click', e => bouton(e.currentTarget, async () => { const r = await api('/api/reglages/comptes', { method: 'POST', body: {} }); afficherComptes({ ...r, magasin: null }); await chargerReglages(); toast('جبت الكونتات'); await majInstallation(); }));
    // les 25 wilayas du vendeur : les clés de région lues chez Meta (recoupées par le bureau), à confirmer dans « الإعدادات »
    $('#ins-wilayas').addEventListener('click', e => bouton(e.currentTarget, async () => { const r = await api('/api/reglages/wilayas', { method: 'POST', body: {} }); afficherWilayas(r); toast(r.confirme ? 'جبت الولايات : نفس الليستة، باقيين مأكّدين' : 'جبت الولايات، أكّدهم في الإعدادات'); await majInstallation(); }));
    $('#ch-tg-chat').addEventListener('click', e => bouton(e.currentTarget, async () => { const tok = $('#ch-tg-token').value.trim(); if (tok) await api('/api/reglages', { method: 'POST', body: { telegram: { token: tok } } }); const r = await api('/api/telegram/chat', { method: 'POST', body: {} }); $('#ch-tg-etat').textContent = 'chat_id ' + r.telegram.chat_id; toast('لقيت الحساب تاعك'); await majInstallation(); }));
    $('#ch-meta-sonder').addEventListener('click', e => bouton(e.currentTarget, async () => { const jm = $('#ch-meta-jeton').value.trim(); if (jm) { await api('/api/reglages', { method: 'POST', body: { meta: { jeton: jm } } }); $('#ch-meta-jeton').value = ''; } const cs = ($('#ch-meta-compte') || {}).value; const r = await api('/api/meta/sonder', { method: 'POST', body: cs ? { compte: cs } : {} }); afficherSondeMeta(r); toast(r.texte || '', !r.ok); await chargerReglages(); await majInstallation(); }));
    $('#ch-tg-essai').addEventListener('click', e => bouton(e.currentTarget, async () => { const r = await api('/api/telegram/essai', { method: 'POST', body: {} }); toast(r.envoye ? 'راحت — شوف تيليغرام' : 'ما راحتش', !r.envoye); }));
    // le dépôt à l'épreuve : un vrai aller-retour par l'adresse publique, puis une vraie vidéo d'essai chez Meta
    $('#ch-depot-epreuve').addEventListener('click', e => bouton(e.currentTarget, async () => {
      $('#ch-depot-etat').textContent = '…';
      const r = await api('/api/depot/epreuve', { method: 'POST', body: {} });
      $('#ch-depot-etat').textContent = (r.verdict === 'PASSE' ? '✓ ' : '✗ ') + r.detail;
      toast(r.verdict === 'PASSE' ? 'الدوبو يخدم' : 'الدوبو ما خدمش', r.verdict !== 'PASSE');
    }));
    $('#ch-depot-meta').addEventListener('click', e => bouton(e.currentTarget, async () => {
      const compte = $('#ch-meta-compte').value;
      let r = await api('/api/depot/essai-meta', { method: 'POST', body: compte ? { compte } : {} });
      if (r.etat === 'refuse') throw new Error(r.detail);
      afficherEssaiMeta(r);
      const fin = Date.now() + 15 * 60000;
      while (r.etat === 'encours' && Date.now() < fin) { await new Promise(x => setTimeout(x, 3000)); r = await api('/api/depot/essai-meta'); }
      afficherEssaiMeta(r);
      toast(r.verdict === 'PASSE' ? 'ميتا خذات الفيديو والدوبو تسكّر' : 'ما خدمش', r.verdict !== 'PASSE', r.verdict === 'PASSE' ? '' : (r.detail || ''));
    }));
    const tick = async () => { try { await majMissions(); if (visible('installation')) await majInstallation(); } catch {} };
    tick(); setInterval(tick, 4000);
    for (const b of document.querySelectorAll('.onglet[data-onglet="missions"], .onglet[data-onglet="installation"]')) b.addEventListener('click', () => { if (b.dataset.onglet === 'installation') reglagesCharges = false; setTimeout(tick, 50); });
  });
})();
