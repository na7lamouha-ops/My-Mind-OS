// Test hors ligne du worker : fausse KV, faux Telegram. Aucun appel réel.
import W from "../worker.js";
let appels = [];
globalThis.fetch = async (url, o) => {
  const corps = JSON.parse(o.body);
  appels.push({ methode: url.split("/").pop(), corps });
  return { json: async () => ({ ok: true, result: { message_id: appels.length } }) };
};
const store = new Map();
const env = {
  BOT_TOKEN: "TEST", SECRET_WEBHOOK: "s3cret", CLE_AGENTS: "cle-test", CHATS_AUTORISES: "111,222",
  SPY: {
    put: async (k, v) => store.set(k, v), get: async (k) => store.get(k) ?? null,
    delete: async (k) => store.delete(k),
    list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
  },
};
const req = (m, p, b, h = {}) => new Request("https://w.example" + p, {
  method: m, headers: { "content-type": "application/json", ...h }, body: b ? JSON.stringify(b) : undefined });
const tgH = { "X-Telegram-Bot-Api-Secret-Token": "s3cret" };
let ok = true;
const check = (n, c) => { console.log((c ? "PASSE " : "ÉCHEC ") + n); ok &&= c; };

let r = await W.fetch(req("POST", "/telegram", { message: { chat: { id: 111 }, text: "spy" } }, tgH), env);
check("« spy » affiche 5 boutons", appels.at(-1).corps.reply_markup.inline_keyboard.flat().length === 5);

await W.fetch(req("POST", "/telegram", { message: { chat: { id: 111 }, text: "spy morocco" } }, tgH), env);
check("« spy morocco » enregistre MA", [...store.values()].some((v) => JSON.parse(v).pays === "MA"));

await W.fetch(req("POST", "/telegram", { callback_query: { id: "q1", data: "spy:IQ", message: { chat: { id: 222 } } } }, tgH), env);
check("bouton Irak enregistre IQ", [...store.values()].some((v) => JSON.parse(v).pays === "IQ"));

const avant = store.size;
await W.fetch(req("POST", "/telegram", { message: { chat: { id: 999 }, text: "spy dz" } }, tgH), env);
check("PIÈGE : chat inconnu ignoré", store.size === avant);

r = await W.fetch(req("POST", "/telegram", { message: { chat: { id: 111 }, text: "spy dz" } }, { "X-Telegram-Bot-Api-Secret-Token": "faux" }), env);
check("PIÈGE : mauvais secret webhook refusé", r.status === 403);

r = await W.fetch(req("GET", "/spy/demandes", null, { "X-Cle": "faux" }), env);
check("PIÈGE : mauvaise clé agent refusée", r.status === 403);

r = await W.fetch(req("GET", "/spy/demandes", null, { "X-Cle": "cle-test" }), env);
const liste = await r.json();
check("l'agent lit 2 demandes", liste.length === 2);

r = await W.fetch(req("POST", "/spy/reponse", { key: liste[0].key, chat_id: liste[0].chat_id, messages: ["x".repeat(5000)] }, { "X-Cle": "cle-test" }), env);
check("PIÈGE : message de plus de 4096 refusé", r.status === 422);

appels = [];
r = await W.fetch(req("POST", "/spy/reponse", { key: liste[0].key, chat_id: liste[0].chat_id, messages: ["<b>SPY</b> 1", "suite"] }, { "X-Cle": "cle-test" }), env);
const j = await r.json();
check("réponse envoyée en 2 messages HTML", j.ok && appels.length === 2 && appels[0].corps.parse_mode === "HTML");
check("demande effacée après envoi", !store.has(liste[0].key) && store.size === 1);

console.log("\nRÉSULTAT GLOBAL :", ok ? "PASSE" : "ÉCHEC");
process.exit(ok ? 0 : 1);
