/* ecom manita — la boussole du marchand : LE calcul.
 *
 * C'est la MÊME formule que les outils de la maison (testing, coach, scaling, carnet) :
 *     ppl     = prix - achat - emballage - livraison - frais COD      (profit d'une pièce livrée, avant la pub)
 *     tl      = confirmation x livraison                              (part livrée d'une commande reçue)
 *     tr      = confirmation x (1 - livraison)                        (part rendue)
 *     sommet  = tl x ppl - tr x retour                                (le cout maximum d'une commande Meta)
 * `verifier.mjs` compare ce fichier aux outils Python sur des cas fixes : si l'un bouge, la barrière tombe.
 *
 * Trois corrections par rapport à la première boussole :
 *   1. retours = confirmées - livrées (au lieu d'arrondir les trois lignes séparément) ;
 *   2. l'emballage est retiré aussi dans la récupération du capital ;
 *   3. deux ROI, chacun avec son étiquette : sur le capital du début, et sur le capital total.
 * Et quand le produit perd, la boussole ne se tait plus : elle donne les chemins de sortie, chiffrés.
 *
 * Script classique (pas de module) : il marche dans la page, ouverte par le bureau ou en fichier, et dans Node (vm).
 */
(function (racine) {
  'use strict';

  var EPS = 1e-9;
  var plafond = function (x) { return Math.ceil(x - EPS); };

  /* Lire un nombre tapé par un humain : « 2300 », « 2 300 », « 2.300 », « 2,300 DA », « 65 % », « 1,20 $ ».
     entier : un montant en dinars (un point ou une virgule suivis de trois chiffres = séparateur de milliers). */
  function lireNombre(texte, entier) {
    if (typeof texte === 'number') return isFinite(texte) ? texte : null;
    var s = String(texte == null ? '' : texte).replace(/[\s  ]/g, '').replace(/(DA|DZD|دج|\$|USD|%)/gi, '');
    if (!s) return null;
    if (!/^-?[0-9.,]+$/.test(s)) return null;
    if (entier && /^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
    else if (s.indexOf('.') >= 0 && s.indexOf(',') >= 0) {
      var dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
      s = s.split(dec === '.' ? ',' : '.').join('').replace(',', '.');
    } else s = s.replace(',', '.');
    if ((s.match(/\./g) || []).length > 1) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  /* Ce qui manque ou ce qui est faux, en clair. Aucune exception : la page affiche la liste. */
  function fautes(e) {
    var f = [];
    var montant = function (cle, nom, strict) {
      var v = e[cle];
      if (v == null || !isFinite(v)) f.push(nom + ' : vide');
      else if (v < 0 || (strict && v === 0)) f.push(nom + (strict ? ' : doit être plus grand que zéro' : ' : négatif'));
    };
    var taux = function (cle, nom) {
      var v = e[cle];
      if (v == null || !isFinite(v)) f.push(nom + ' : vide');
      else if (!(v > 0 && v <= 1)) f.push(nom + ' : entre 1 et 100 %');
    };
    montant('objectif', 'objectif', true);
    montant('prix', 'prix de vente', true);
    montant('achat', "prix d'achat", false);
    montant('emballage', 'emballage', false);
    montant('livraison', 'livraison', false);
    montant('fraisCod', 'frais COD', false);
    montant('retour', 'retour', false);
    montant('cpl', 'cout de la commande', false);
    taux('confirmation', 'confirmation');
    taux('tauxLivraison', 'livraison (taux)');
    if (e.surplus == null || !isFinite(e.surplus) || e.surplus < 0 || e.surplus > 2) f.push('surplus : entre 0 et 200 %');
    return f;
  }

  /* LE calcul. e = { objectif, prix, achat, emballage, livraison, fraisCod, retour, confirmation (0-1), tauxLivraison (0-1), cpl, surplus (0-2) } */
  function calculer(e) {
    var f = fautes(e);
    if (f.length) return { ok: false, fautes: f };

    var conf = e.confirmation, liv = e.tauxLivraison;
    var charges = e.achat + e.emballage + e.livraison + e.fraisCod;
    var ppl = e.prix - charges;
    var tl = conf * liv, tr = conf * (1 - liv);
    var sommet = tl * ppl - tr * e.retour;              // = break even par commande reçue (coach, testing)
    var retoursParLivree = (1 - liv) / liv;
    var marge = ppl - retoursParLivree * e.retour;      // = break even par livrée = sommet / tl
    var netLead = sommet - e.cpl;

    var r = {
      ok: true, gagne: netLead > 0,
      ppl: ppl, tl: tl, tr: tr, charges: charges,
      sommet: sommet, parConfirmee: sommet / conf, marge: marge,
      retoursParLivree: retoursParLivree, netLead: netLead,
      netLivreeApresPub: marge - e.cpl / tl,
      // les plafonds SANS publicité (les mêmes que manita-testing.py : prix_minimum, livraison_minimum)
      prixPlancher: charges + e.retour * (1 - liv) / liv,
      livraisonPlancher: (ppl + e.retour) > 0 ? e.retour / (ppl + e.retour) : null
    };

    if (!r.gagne) {
      // les chemins de sortie, AU MÊME cout de commande : un seul suffit
      var livMin = (ppl + e.retour) > 0 ? (e.cpl + conf * e.retour) / (conf * (ppl + e.retour)) : null;
      var denConf = liv * ppl - (1 - liv) * e.retour;
      var confMin = denConf > 0 ? e.cpl / denConf : null;
      r.diagnostic = {
        manqueParLead: -netLead,
        cplMax: sommet > 0 ? sommet : null,                         // null : même une pub gratuite ne suffit pas
        livraisonMin: livMin != null && livMin > 0 && livMin <= 1 ? livMin : null,
        confirmationMin: confMin != null && confMin > 0 && confMin <= 1 ? confMin : null,
        prixMin: charges + (e.cpl + tr * e.retour) / tl
      };
      return r;
    }

    var leads = plafond(e.objectif / netLead);
    var confirmees = plafond(leads * conf);
    var livrees = plafond(leads * tl);
    var retours = confirmees - livrees;                                 // correction 1
    var stock = plafond(livrees * (1 + e.surplus));
    var pub = leads * e.cpl;
    var achatStock = stock * e.achat;
    var capitalTotal = achatStock + pub;
    var capitalDebut = achatStock + pub / 3;                            // la pub se paie au fil des jours : un tiers sort au début
    var benefice = livrees * ppl - retours * e.retour - pub;
    var netCommande = e.prix - e.livraison - e.fraisCod - e.emballage - retoursParLivree * e.retour;   // correction 2

    r.leads = leads; r.confirmees = confirmees; r.livrees = livrees; r.retours = retours;
    r.stock = stock; r.surplusPieces = stock - livrees;
    r.pub = pub; r.achatStock = achatStock;
    r.capitalTotal = capitalTotal; r.capitalDebut = capitalDebut;
    r.benefice = benefice;
    r.roiTotal = capitalTotal > 0 ? benefice / capitalTotal : null;     // correction 3 : les deux, étiquetés
    r.roiDebut = capitalDebut > 0 ? benefice / capitalDebut : null;
    r.netCommande = netCommande;
    r.recuperation = netCommande > 0 ? plafond(capitalDebut / netCommande) : null;
    // le contrôle intégré (le même que celui du manager) : il doit toujours tomber juste
    r.controle = (r.confirmees - r.livrees === r.retours) && (r.roiTotal == null || Math.abs(r.benefice / r.capitalTotal - r.roiTotal) < 1e-12);
    return r;
  }

  /* L'affichage à la française : 310 417 · 1 217,32 · 85,2 % */
  function nombre(x, decimales) {
    if (x == null || !isFinite(x)) return '—';
    var d = decimales == null ? 0 : decimales;
    var neg = x < 0, v = Math.abs(x);
    var t = v.toFixed(d).split('.');
    var ent = t[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg && Number(t.join('')) !== 0 ? '-' : '') + ent + (d > 0 ? ',' + t[1] : '');
  }
  function dinars(x) { return nombre(Math.round(x)) + ' DA'; }
  function dollars(x, taux) { return taux > 0 ? nombre(x / taux, 2) + ' $' : '—'; }
  function pourcent(x, decimales) { return x == null ? '—' : nombre(x * 100, decimales == null ? 1 : decimales) + ' %'; }

  var Boussole = { lireNombre: lireNombre, fautes: fautes, calculer: calculer, nombre: nombre, dinars: dinars, dollars: dollars, pourcent: pourcent, version: '1.0' };
  racine.Boussole = Boussole;
})(typeof globalThis !== 'undefined' ? globalThis : this);
