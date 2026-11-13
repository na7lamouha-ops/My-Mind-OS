/* Le stade en fond de tout le bureau ecom manita.
   - Tous les onglets : stade.html en fond de tout l'écran, FLOU et assombri, derrière la scène (les gens qui marchent) ;
   - Onglet « الستاد » : le même stade net, l'affiche centrée dans la place libre à côté du panneau, le commentaire en bas. */
(function () {
  const bureau = document.getElementById('bureau'), panneau = document.getElementById('panneau');
  if (!bureau) return;
  let cadre = null, actif = false;
  // le générique du match dans le panneau (sous le bouton « افتح الستاد في صفحة كاملة »), lignes envoyées par la page du stade
  const vue = document.getElementById('vue-stade');
  let genBoite = null, genListe = null, genY = 0, tips = [], tipIdx = 0, derniereImage = 0;
  function ligne(html, type) { if (!genListe) return; const d = document.createElement('div'); d.className = 'gen-ligne ' + (type || 'astuce'); d.innerHTML = html; genListe.appendChild(d); }
  function creerGenerique() {
    if (!vue || genBoite) return;
    genBoite = document.createElement('div'); genBoite.id = 'generique-bureau'; genBoite.setAttribute('dir', 'rtl');
    genListe = document.createElement('div'); genListe.className = 'gen-liste'; genBoite.appendChild(genListe);
    vue.appendChild(genBoite);
  }
  function prefill() { if (tips.length && genListe && !genListe.childElementCount) { for (let i = 0; i < 5; i++) ligne('💡 ' + tips[tipIdx++ % tips.length], 'astuce'); genY = Math.round((genBoite ? genBoite.clientHeight : 300) * 0.75); } }
  function tailleGenerique() { if (!genBoite || !vue) return; const r = vue.getBoundingClientRect(), t = genBoite.getBoundingClientRect(); genBoite.style.height = Math.max(120, Math.round(r.bottom - t.top - 10)) + 'px'; }
  function animer(now) {
    if (!actif || !genBoite) { derniereImage = 0; return; }
    const dt = derniereImage ? Math.min(0.05, (now - derniereImage) / 1000) : 0; derniereImage = now;
    const H = genBoite.clientHeight; if (!genListe.childElementCount) genY = 0; else genY += 18 * dt;
    while (genListe.firstChild && (genListe.firstChild.offsetTop + genListe.firstChild.offsetHeight) < genY - H - 8) { const h = genListe.firstChild.offsetHeight + 14; genListe.removeChild(genListe.firstChild); genY -= h; }
    let garde = 0; while (tips.length && genListe.offsetHeight - genY < 60 && garde++ < 6) ligne('💡 ' + tips[tipIdx++ % tips.length], 'astuce');
    genListe.style.transform = 'translateY(' + (-genY) + 'px)';
    requestAnimationFrame(animer);
  }
  addEventListener('message', function (e) {
    if (!cadre || e.source !== cadre.contentWindow || !e.data) return;
    if (Array.isArray(e.data.tips)) { tips = e.data.tips; prefill(); }
    if (typeof e.data.ligne === 'string') ligne(e.data.ligne, e.data.type);
  });
  function largeurPanneau() { return panneau ? Math.round(panneau.getBoundingClientRect().width) : 0; }
  function hauteurBandeau() { const h = document.getElementById('haut'); return h ? Math.round(h.getBoundingClientRect().height) : 0; }
  function etat() { const a = document.querySelector('.onglet.actif'); return !!(a && a.dataset.onglet === 'stade'); }
  function envoyer() { if (cadre && cadre.contentWindow) cadre.contentWindow.postMessage({ gauche: largeurPanneau(), haut: hauteurBandeau(), flou: !actif }, '*'); }
  function creer() {
    cadre = document.createElement('iframe');
    cadre.id = 'cadre-stade';
    cadre.src = '/stade.html?gauche=' + largeurPanneau() + '&haut=' + hauteurBandeau() + (etat() ? '' : '&flou=1');
    cadre.title = 'الستاد';
    cadre.setAttribute('loading', 'eager');
    cadre.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#050608;z-index:0;display:block';
    cadre.addEventListener('load', envoyer);
    document.body.insertBefore(cadre, document.body.firstChild);
    document.body.classList.add('fond-stade');
  }
  function appliquer(stade) {
    actif = stade;
    document.body.classList.toggle('stade-actif', stade);
    bureau.style.visibility = stade ? 'hidden' : '';
    envoyer();
    if (stade) { creerGenerique(); setTimeout(function () { tailleGenerique(); prefill(); derniereImage = 0; requestAnimationFrame(animer); }, 50); }
  }
  actif = etat();
  creer();
  appliquer(actif);
  addEventListener('resize', function () { envoyer(); tailleGenerique(); });
  document.addEventListener('click', function (e) {
    const b = e.target && e.target.closest ? e.target.closest('[data-onglet]') : null;
    if (!b) return;
    appliquer(b.dataset.onglet === 'stade');
  }, true);
  const pe = document.getElementById('stade-plein-ecran');
  if (pe) pe.addEventListener('click', function () { window.open('/stade.html', '_blank'); });
})();
