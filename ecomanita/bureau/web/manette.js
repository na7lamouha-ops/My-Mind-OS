/* ecom manita — thème « manette » : le bureau est toujours sombre, quel que soit le réglage du Mac.
   bureau.js lit prefers-color-scheme pour dessiner la scène (sombre()) ; on lui répond « sombre » et rien d'autre ne change.
   À charger AVANT bureau.js. */
(function () {
  if (!window.matchMedia) return;
  var original = window.matchMedia.bind(window);
  window.matchMedia = function (requete) {
    var r = original(requete);
    if (!/prefers-color-scheme\s*:\s*dark/.test(String(requete))) return r;
    return { matches: true, media: r.media, onchange: null,
      addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {},
      dispatchEvent: function () { return false; } };
  };
})();
