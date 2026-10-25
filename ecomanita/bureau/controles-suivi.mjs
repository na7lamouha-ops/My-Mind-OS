// ecomanita 0.4.2 (25/10/2026) — LES QUATRE CONTRÔLES AVANT LE VERDICT (وكيل التقارير).
// Avant de juger une vidéo, le bureau vérifie que les chiffres se TIENNENT entre Meta et Tassyir :
//   1. une annonce qui dépense et n'apporte AUCUNE visite dans Tassyir  → le lien caché manque (rouge, pas de verdict)
//   2. trop de commandes SANS TICKET (« زيارات عضوية » / (not set)) > 10 % → chiffres incomplets (jaune, verdict sur les liées)
//   3. la dépense de Meta ≠ la dépense que Tassyir relie (> 5 %)          → on attend (rouge)
//   4. achats Meta ≠ commandes Tassyir par annonce (double comptage ou pixel qui rate) → jamais juger au pixel (jaune)
//   +  le lien n'a pas été remplacé ({{campaign.id}} écrit tel quel, un nom écrit à la main) → rouge
// On ne juge JAMAIS au pixel : le verdict se fait sur les CONFIRMÉES de Tassyir. Ces contrôles disent seulement si
// ces chiffres-là sont complets. Fonctions PURES : aucune lecture, aucune écriture ; l'épreuve les teste.
// Code original « ecom manita ».

export const SEUIL_SANS_TICKET = 0.10;      // au-dessus : « الأرقام ناقصة »
export const ECART_DEPENSE = 0.05;          // au-dessus : la dépense ne se tient pas
export const DEPENSE_MINI_USD = 1;          // en dessous, une annonce sans visite n'est pas encore un signal
const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

/** Une valeur de utm_campaign / utm_content lue dans Tassyir est-elle un VRAI numéro de Meta ? */
export function estNumeroMeta(v) { return /^\d{6,}$/.test(String(v ?? '').trim()); }

/**
 * @param {object} e
 *  - annonces : [{ id, nom, depense_usd, achats_meta, commandes_tassyir, visites_tassyir }]
 *  - commandesLiees, commandesSansTicket : sur la période, dans Tassyir (source → campagne → contenu, et « (not set) »)
 *  - depenseMetaUsd, depenseTassyirUsd : la dépense totale lue dans Meta, et celle que Tassyir relie (null = « gated »)
 *  - valeursUtm : les valeurs utm_campaign / utm_content lues dans Tassyir pour ces annonces
 * @returns {{ verdictPermis: boolean, alertes: Array<{id, niveau, ar, detail}>, partSansTicket: number|null }}
 */
export function controlesSuivi(e = {}) {
  const A = [];
  const add = (id, niveau, ar, detail) => A.push({ id, niveau, ar, detail });
  const annonces = Array.isArray(e.annonces) ? e.annonces : [];

  // 1. une annonce qui dépense sans aucune visite dans Tassyir : le lien caché n'est pas dans cette annonce
  const muettes = annonces.filter(a => n(a.depense_usd) >= DEPENSE_MINI_USD && n(a.visites_tassyir) === 0 && n(a.commandes_tassyir) === 0);
  if (muettes.length) add('lien_absent', 'stop', 'فيديو صرف وما جاب حتى زيارة', muettes.map(a => `${a.nom || a.id} : ${n(a.depense_usd).toFixed(2)} $ sans visite dans Tassyir`).join(' · '));

  // + le lien non remplacé : une valeur qui n'est pas un numéro de Meta ({{campaign.id}}, CAMPAIGN_NAME, un nom)
  const fausses = (Array.isArray(e.valeursUtm) ? e.valeursUtm : []).filter(v => String(v ?? '').trim() && !estNumeroMeta(v));
  if (fausses.length) add('lien_non_remplace', 'stop', 'الرابط مكتوب غالط', `valeurs lues dans Tassyir : ${[...new Set(fausses.map(String))].slice(0, 4).join(', ')}`);

  // 2. trop de commandes sans ticket
  const liees = n(e.commandesLiees, NaN), sans = n(e.commandesSansTicket, NaN);
  let part = null;
  if (Number.isFinite(liees) && Number.isFinite(sans) && liees + sans > 0) {
    part = sans / (liees + sans);
    if (part > SEUIL_SANS_TICKET) add('sans_ticket', 'warn', 'بزاف طلبيات بلا تذكرة', `${Math.round(part * 100)} % des commandes sans lien (${sans} sur ${liees + sans}) : on juge seulement les commandes liées`);
  }

  // 3. la dépense : Meta contre ce que Tassyir relie (non disponible = « gated » : pas de contrôle, on le dit)
  const dm = n(e.depenseMetaUsd, NaN), dt = e.depenseTassyirUsd === null || e.depenseTassyirUsd === undefined ? NaN : n(e.depenseTassyirUsd, NaN);
  if (Number.isFinite(dm) && dm > 0 && Number.isFinite(dt)) {
    const ecart = Math.abs(dm - dt) / dm;
    if (ecart > ECART_DEPENSE) add('depense_ecart', 'stop', 'الصرف ما يتطابقش', `Meta ${dm.toFixed(2)} $ · Tassyir ${dt.toFixed(2)} $ (${Math.round(ecart * 100)} %)`);
  }

  // 4. achats du pixel contre commandes de Tassyir, annonce par annonce (le verdict reste sur Tassyir)
  for (const a of annonces) {
    const am = n(a.achats_meta), ct = n(a.commandes_tassyir);
    if (am >= 2 * Math.max(1, ct) && am - ct >= 3) add('pixel_double', 'warn', 'البيكسل يحسب مرتين', `${a.nom || a.id} : Meta ${am} achats · Tassyir ${ct} commandes`);
    else if (ct >= 2 * Math.max(1, am) && ct - am >= 3) add('pixel_rate', 'warn', 'البيكسل ما يحسبش كلش', `${a.nom || a.id} : Meta ${am} achats · Tassyir ${ct} commandes`);
  }
  return { verdictPermis: !A.some(x => x.niveau === 'stop'), alertes: A, partSansTicket: part };
}

/** Le message Telegram des contrôles (loi de forme : darija, 36 caractères, aucun chiffre dans une ligne arabe). */
export function messageControles(r) {
  if (!r || !r.alertes || !r.alertes.length) return null;
  const L = ['قبل ما نحكم على الفيديوهات :'];
  for (const a of r.alertes) L.push(`${a.niveau === 'stop' ? '🔴' : '🟡'} ${a.ar}`);
  L.push(r.verdictPermis ? 'نحكمو غير على الطلبيات المربوطة' : 'ما نحكموش على الفيديوهات اليوم');
  if (r.alertes.some(a => a.id === 'lien_absent' || a.id === 'lien_non_remplace')) L.push('صلّح الرابط في الإعلان وعاود');
  return L.join('\n');
}
