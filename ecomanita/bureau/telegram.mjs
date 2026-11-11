// ecom manita — TELEGRAM : l'entrée et la sortie du client. Le robot est celui du CLIENT (BotFather),
// sa clé vit dans config.local.json sur SA machine, jamais dans le code ni dans le carnet.
// Chaque message passe le contrôle de forme AVANT de partir : darija pour le texte, français pour les chiffres.
// Un seul clic par question : le silence n'est jamais un oui.
// v0.3 (03/10/2026) : boutons sur plusieurs lignes, photos, vidéos et albums (envoi du fichier local),
// écoute générique (le serveur route les boutons et les textes), position de lecture gardée sur le disque.
// v0.3.8 : la photo à boutons (sendPhoto en multipart : FormData + Blob de Node, type MIME posé) sert à faire
// confirmer chaque modèle d'un lot ; une photo absente du disque est refusée AVANT l'appel.
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as attendre } from 'node:timers/promises';
import { ressembleJeton } from './meta-mcp.mjs';

const API = () => process.env.MANITA_TELEGRAM_API || 'https://api.telegram.org';
/** Le JETON Meta collé dans le chat (10/10/2026, « casse ») : le guide dit « jamais dans le chat », un client le fait quand
 *  même. Le message est effacé du chat, il ne va NI à l'accueil (qui l'aurait pris pour un nom de modèle, gardé sur le disque
 *  et envoyé à Claude), NI au journal ; le client lit où le coller. */
export const TEXTE_JETON_DANS_CHAT = ['ما تبعثش التوكن تاع ميتا هنا', 'مسحتو من الشات وما خبيتوش', 'لصقو في التحضير في المكتب', 'في الخانة : توكن ميتا'].join('\n');
const TYPES_FICHIER = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };

/** Le contrôle de forme (les six lois) — rend [] si tout va bien, sinon la liste des fautes. */
export function fautesDeForme(texte, { minArabe = 3 } = {}) {
  const lignes = String(texte || '').split('\n');
  const fautes = [];
  const arabe = l => /[؀-ۿ]/.test(l);
  const chiffre = l => /\d/.test(l);
  // une ligne qui n'est QU'UNE adresse (09/10/2026) est TECHNIQUE : ni darija ni chiffres à juger. Le slug d'une page
  // Tassyir est souvent en arabe (« …/product/عباية-مثال-2 ») : la ligne ne se lit pas comme une phrase, elle se touche.
  // Elle ne compte pas non plus comme une ligne de darija (ni au-dessus d'un chiffre, ni à la fin, ni dans le minimum).
  const lien = l => /^https?:\/\/\S+$/.test(l.trim());
  const darija = l => arabe(l) && !lien(l);
  const nArabe = lignes.filter(darija).length;
  lignes.forEach((l, i) => {
    if (lien(l)) return;
    if (arabe(l) && chiffre(l)) fautes.push(`ligne ${i + 1} : un chiffre dans une ligne arabe`);
    // un LIEN ne se coupe pas : une ligne qui n'est qu'une adresse a déjà échappé (plus haut) à la limite de longueur
    if (l.length > 36) fautes.push(`ligne ${i + 1} : plus de 36 caractères (${l.length})`);
    // « دج » seulement comme MOT (« البودجي » contient les lettres د ج : ce n'est pas un montant)
    if (/\bDA\b|(^|[\s\d\u00A0])دج($|[\s.,:;!?؟])/.test(l) && !/\$|USD/.test(l)) fautes.push(`ligne ${i + 1} : dinars sans l'équivalent en dollars`);
    if (chiffre(l) && !arabe(l) && l.trim()) {
      const avant = lignes.slice(Math.max(0, i - 3), i);
      if (!avant.some(darija)) fautes.push(`ligne ${i + 1} : paquet de chiffres sans ligne darija au-dessus`);
    }
  });
  if (nArabe < minArabe) fautes.push(`moins de ${['zéro', 'une', 'deux', 'trois'][minArabe] || minArabe} lignes de darija (${nArabe})`);
  const derniere = [...lignes].reverse().find(l => l.trim());
  if (derniere && !darija(derniere)) fautes.push('la dernière ligne n\'est pas en darija');
  return [...new Set(fautes)];
}

/** Un clavier inline : [[{texte, data}], …] → reply_markup Telegram. data ≤ 64 octets. */
export function clavier(lignes) {
  const rows = (lignes || []).map(r => (Array.isArray(r) ? r : [r]).map(b => {
    const d = String(b.data || '');
    if (Buffer.byteLength(d, 'utf8') > 64) throw new Error(`bouton trop long (${d.slice(0, 20)}…)`);
    return { text: String(b.texte || b.text || '?'), callback_data: d };
  }));
  return { inline_keyboard: rows };
}

export function creerTelegram(reglage, journal = () => {}, { fichierPosition = null } = {}) {
  const token = reglage?.token || '';
  const chatId = reglage?.chat_id || reglage?.chatId || '';
  const etat = { configure: !!(token && chatId), dernierEnvoi: null, dernierRetour: null, erreurs: [], questionsOuvertes: {}, ecoute: false, offset: 0 };
  if (fichierPosition) { try { etat.offset = JSON.parse(fs.readFileSync(fichierPosition, 'utf8')).offset || 0; } catch {} }
  const garderPosition = () => { if (fichierPosition) { try { fs.writeFileSync(fichierPosition, JSON.stringify({ offset: etat.offset })); } catch {} } };
  const masquer = s => String(s || '').split(token || '\u0000').join('***');
  const appel = async (methode, corps, { delai = 40000 } = {}) => {
    const r = await fetch(`${API()}/bot${token}/${methode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps || {}), signal: AbortSignal.timeout(delai) });
    const j = await r.json().catch(() => ({ ok: false, description: `réponse non JSON (${r.status})` }));
    if (!j.ok) throw new Error(`Telegram a répondu : ${j.description || r.status}`);
    return j.result;
  };
  const appelFichier = async (methode, champs, fichiers, { delai = 180000 } = {}) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(champs)) if (v !== undefined && v !== null) f.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    for (const [k, chemin] of Object.entries(fichiers)) f.append(k, new Blob([fs.readFileSync(chemin)], { type: TYPES_FICHIER[path.extname(chemin).toLowerCase()] || 'application/octet-stream' }), path.basename(chemin));
    const r = await fetch(`${API()}/bot${token}/${methode}`, { method: 'POST', body: f, signal: AbortSignal.timeout(delai) });
    const j = await r.json().catch(() => ({ ok: false, description: `réponse non JSON (${r.status})` }));
    if (!j.ok) throw new Error(`Telegram a répondu : ${j.description || r.status}`);
    return j.result;
  };
  const journaliserErreur = e => { const d = masquer(e.message || e); etat.erreurs.push({ quand: new Date().toISOString(), detail: d }); etat.erreurs = etat.erreurs.slice(-20); journal('telegram : ' + d); };
  const pasConfigure = () => ({ envoye: false, fautes: ['telegram non configuré (token et chat_id dans الإعدادات)'] });
  const essai = async (fn) => { try { const r = await fn(); etat.dernierEnvoi = new Date().toISOString(); return { envoye: true, message_id: r.message_id ?? (Array.isArray(r) ? r[0]?.message_id : undefined), resultat: r }; } catch (e) { journaliserErreur(e); return { envoye: false, fautes: [masquer(e.message)] }; } };

  const api = {
    etat: () => ({ configure: etat.configure, dernierEnvoi: etat.dernierEnvoi, dernierRetour: etat.dernierRetour, erreurs: etat.erreurs.slice(-5), questionsOuvertes: Object.keys(etat.questionsOuvertes).length, ecoute: etat.ecoute }),
    fautesDeForme,
    /** Envoie un texte (avec boutons si demandé). Refuse SANS envoyer si la forme est fausse. */
    // html (23/10/2026, le SPY) : les lignes de spy_calc.py (lien de la page, gras) partent en HTML, telles que spy_calc les écrit
    async envoyer(texte, { boutons = null, controle = true, html = false } = {}) {
      if (!etat.configure) return pasConfigure();
      const fautes = controle ? fautesDeForme(texte) : [];
      if (fautes.length) return { envoye: false, fautes };
      return essai(() => appel('sendMessage', { chat_id: chatId, text: texte, ...(html ? { parse_mode: 'HTML', link_preview_options: { is_disabled: true } } : {}), ...(boutons ? { reply_markup: clavier(boutons) } : {}) }));
    },
    /** Une photo du disque, avec sa légende (même contrôle de forme) et des boutons facultatifs. */
    async envoyerPhoto(fichier, legende = '', { boutons = null, minArabe = 1 } = {}) {
      if (!etat.configure) return pasConfigure();
      const fautes = legende ? fautesDeForme(legende, { minArabe }) : [];
      if (fautes.length) return { envoye: false, fautes };
      if (!fichier || !fs.existsSync(fichier)) return { envoye: false, fautes: ['photo introuvable sur le disque'] };
      return essai(() => appelFichier('sendPhoto', { chat_id: chatId, caption: legende || undefined, reply_markup: boutons ? clavier(boutons) : undefined }, { photo: fichier }));
    },
    /** Une vidéo du disque (≤ 50 Mo : limite de Telegram pour un robot). */
    async envoyerVideo(fichier, legende = '', { minArabe = 1 } = {}) {
      if (!etat.configure) return pasConfigure();
      const fautes = legende ? fautesDeForme(legende, { minArabe }) : [];
      if (fautes.length) return { envoye: false, fautes };
      const taille = fs.statSync(fichier).size;
      if (taille > 49 * 1024 * 1024) return { envoye: false, fautes: [`vidéo trop lourde pour Telegram (${Math.round(taille / 1048576)} Mo)`] };
      return essai(() => appelFichier('sendVideo', { chat_id: chatId, caption: legende || undefined, supports_streaming: true }, { video: fichier }));
    },
    /** Un album de 2 à 10 photos (la légende va sur la première). */
    async envoyerAlbum(fichiers, legende = '', { minArabe = 1 } = {}) {
      if (!etat.configure) return pasConfigure();
      const liste = (fichiers || []).slice(0, 10);
      if (liste.length < 2) return liste.length ? api.envoyerPhoto(liste[0], legende, { minArabe }) : { envoye: false, fautes: ['album vide'] };
      const fautes = legende ? fautesDeForme(legende, { minArabe }) : [];
      if (fautes.length) return { envoye: false, fautes };
      const media = liste.map((f, i) => ({ type: 'photo', media: `attach://p${i}`, ...(i === 0 && legende ? { caption: legende } : {}) }));
      const fichiersAttaches = Object.fromEntries(liste.map((f, i) => [`p${i}`, f]));
      return essai(() => appelFichier('sendMediaGroup', { chat_id: chatId, media }, fichiersAttaches));
    },
    async repondreBouton(id, texte = '') { try { await appel('answerCallbackQuery', { callback_query_id: id, text: texte }); } catch {} },
    async retirerBoutons(messageId) { if (!messageId) return; try { await appel('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }); } catch {} },
    /** Compatibilité v0.2 : une question oui / non sur une tâche. Un seul clic compte. */
    async demander({ id, question, oui = 'واه', non = 'لا' }) {
      const r = await api.envoyer(question, { boutons: [[{ texte: oui, data: `ok:${id}` }, { texte: non, data: `non:${id}` }]] });
      if (r.envoye) etat.questionsOuvertes[id] = { message_id: r.message_id, quand: Date.now() };
      return r;
    },
    questionOuverte: id => !!etat.questionsOuvertes[id],
    fermer(id) { delete etat.questionsOuvertes[id]; },
    /** Lit le dernier chat qui a écrit au robot (pour trouver le chat_id pendant l'installation). */
    async dernierChat() {
      const maj = await appel('getUpdates', { offset: -10, timeout: 0, allowed_updates: ['message'] });
      const m = [...maj].reverse().find(u => u.message && u.message.chat);
      return m ? { chat_id: String(m.message.chat.id), prenom: m.message.chat.first_name || m.message.chat.title || '' } : null;
    },
    /**
     * Écoute (long polling). surBouton({data, id, messageId, de}) ; surTexte({texte, messageId, de}).
     * Seul le chat du client est écouté : un autre compte qui écrit au robot est ignoré.
     */
    async ecouter({ surBouton, surTexte }) {
      if (!etat.configure || etat.ecoute) return;
      etat.ecoute = true;
      while (etat.ecoute) {
        try {
          const maj = await appel('getUpdates', { offset: etat.offset, timeout: 25, allowed_updates: ['callback_query', 'message'] });
          for (const u of maj) {
            etat.offset = u.update_id + 1; garderPosition();
            if (u.callback_query) {
              const q = u.callback_query;
              const deBonChat = String(q.message?.chat?.id) === String(chatId);
              if (!deBonChat) { await api.repondreBouton(q.id, 'ماشي حسابك'); continue; }
              etat.dernierRetour = new Date().toISOString();
              try { await surBouton({ data: q.data || '', id: q.id, messageId: q.message?.message_id, de: q.from?.id }); } catch (e) { journaliserErreur(e); }
            } else if (u.message && String(u.message.chat?.id) === String(chatId) && typeof u.message.text === 'string' && ressembleJeton(u.message.text)) {
              etat.dernierRetour = new Date().toISOString();
              try { await appel('deleteMessage', { chat_id: chatId, message_id: u.message.message_id }); } catch {}
              journal('telegram : un jeton Meta collé dans le chat — effacé, jamais lu ni gardé (التحضير)');
              await api.envoyer(TEXTE_JETON_DANS_CHAT);
            } else if (u.message && String(u.message.chat?.id) === String(chatId) && typeof u.message.text === 'string' && surTexte) {
              etat.dernierRetour = new Date().toISOString();
              try { await surTexte({ texte: u.message.text, messageId: u.message.message_id, de: u.message.from?.id }); } catch (e) { journaliserErreur(e); }
            }
          }
        } catch (e) { journaliserErreur(e); if (etat.ecoute) await attendre(5000); }
      }
    },
    arreter() { etat.ecoute = false; }
  };
  return api;
}
