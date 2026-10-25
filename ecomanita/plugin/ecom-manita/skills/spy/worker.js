// worker.js — robot Telegram « spy » (Cloudflare Worker, module ES).
// Il NE fait PAS l'analyse : il reçoit la demande, la range dans KV,
// et renvoie au client les messages que l'agent Claude lui donne.
//
// Variables (Cloudflare > Worker > Settings > Variables, cocher « Secret ») :
//   BOT_TOKEN        jeton du robot Telegram (BotFather)
//   SECRET_WEBHOOK   phrase secrète du webhook Telegram
//   CLE_AGENTS       clé que l'agent Claude envoie dans l'en-tête X-Cle
//   CHATS_AUTORISES  identifiants Telegram autorisés, séparés par des virgules
// Stockage KV lié sous le nom : SPY

const PAYS = {
  dz: "DZ", algerie: "DZ", "algérie": "DZ",
  morocco: "MA", maroc: "MA", ma: "MA",
  egypte: "EG", egypt: "EG", eg: "EG",
  iraq: "IQ", irak: "IQ", iq: "IQ",
  tunis: "TN", tunisie: "TN", tn: "TN",
};
const BOUTONS = [
  [{ text: "🇩🇿 spy dz", callback_data: "spy:DZ" }, { text: "🇲🇦 spy morocco", callback_data: "spy:MA" }],
  [{ text: "🇪🇬 spy egypte", callback_data: "spy:EG" }, { text: "🇮🇶 spy iraq", callback_data: "spy:IQ" }],
  [{ text: "🇹🇳 spy tunis", callback_data: "spy:TN" }],
];

async function tg(env, methode, corps) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${methode}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps),
  });
  return r.json();
}

function autorise(env, chatId) {
  const liste = (env.CHATS_AUTORISES || "").split(",").map((s) => s.trim()).filter(Boolean);
  return liste.includes(String(chatId));
}

async function enregistrer(env, chatId, code) {
  const cle = `spy:demande:${Date.now()}:${chatId}`;
  await env.SPY.put(cle, JSON.stringify({ pays: code, chat_id: chatId, ts: Date.now() }));
  await tg(env, "sendMessage", { chat_id: chatId, text: `راني نخدم على SPY ${code}\nنبعثلك التحليل كي يكمل` });
  return cle;
}

async function webhook(req, env) {
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.SECRET_WEBHOOK)
    return new Response("interdit", { status: 403 });
  const u = await req.json();
  if (u.callback_query) {
    const q = u.callback_query, chatId = q.message.chat.id;
    await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
    if (!autorise(env, chatId)) return new Response("ok");
    const m = /^spy:(DZ|MA|EG|IQ|TN)$/.exec(q.data || "");
    if (m) await enregistrer(env, chatId, m[1]);
    return new Response("ok");
  }
  const msg = u.message;
  if (!msg || !msg.text) return new Response("ok");
  const chatId = msg.chat.id;
  if (!autorise(env, chatId)) return new Response("ok");
  const t = msg.text.trim().toLowerCase();
  if (t === "spy" || t === "/spy") {
    await tg(env, "sendMessage", {
      chat_id: chatId, text: "اختار البلاد", reply_markup: { inline_keyboard: BOUTONS },
    });
  } else {
    const m = /^\/?spy\s+([a-zé]+)$/.exec(t);
    if (m && PAYS[m[1]]) await enregistrer(env, chatId, PAYS[m[1]]);
  }
  return new Response("ok");
}

async function demandes(req, env) {
  if (req.headers.get("X-Cle") !== env.CLE_AGENTS) return new Response("interdit", { status: 403 });
  const l = await env.SPY.list({ prefix: "spy:demande:" });
  const out = [];
  for (const k of l.keys) {
    const v = await env.SPY.get(k.name);
    if (v) out.push({ key: k.name, ...JSON.parse(v) });
  }
  return Response.json(out);
}

async function reponse(req, env) {
  if (req.headers.get("X-Cle") !== env.CLE_AGENTS) return new Response("interdit", { status: 403 });
  const b = await req.json();
  if (!b.key || !b.chat_id || !Array.isArray(b.messages) || !b.messages.length)
    return new Response("corps incomplet", { status: 400 });
  if (!autorise(env, b.chat_id)) return new Response("chat non autorisé", { status: 403 });
  if (b.messages.some((m) => typeof m !== "string" || m.length > 4096))
    return new Response("message trop long", { status: 422 });
  const envoyes = [];
  for (const texte of b.messages) {
    const r = await tg(env, "sendMessage", {
      chat_id: b.chat_id, text: texte, parse_mode: "HTML", disable_web_page_preview: true,
    });
    if (!r.ok) return Response.json({ ok: false, envoyes, erreur: r.description }, { status: 502 });
    envoyes.push(r.result.message_id);
  }
  await env.SPY.delete(b.key);
  return Response.json({ ok: true, envoyes });
}

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    if (req.method === "POST" && p === "/telegram") return webhook(req, env);
    if (req.method === "GET" && p === "/spy/demandes") return demandes(req, env);
    if (req.method === "POST" && p === "/spy/reponse") return reponse(req, env);
    return new Response("introuvable", { status: 404 });
  },
};
