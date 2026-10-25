#!/usr/bin/env python3
"""spy_envoi.py — envoie le rapport SPY d'une demande au robot Telegram (worker.js, POST /spy/reponse).
L'adresse et la clé sont lues dans les variables d'environnement WORKER_URL et CLE_AGENTS, jamais affichées.
usage : spy_envoi.py <key> <chat_id> <messages.txt>

Modèles : si modeles.json est à côté de messages.txt, les deux modèles de chaque boutique partent
avec leur photo (message { texte, photos }).
Ordre : boutique par boutique, la PHOTO d'abord, puis les résultats de la boutique (vagues, trous,
en ligne, prix) et ses pubs actives, puis la boutique suivante. Les lignes sont celles de
spy_calc.py (même fonction, rien recalculé ici) ; l'ordre des verdicts ne change pas.
Sans resultat.json ou modeles.json à côté : envoi de messages.txt (et modeles.txt), inchangé.
Une photo manquante, illisible ou trop lourde ne bloque jamais le rapport : la boutique part sans photo.
Si le robot refuse les photos sans rien envoyer (400, 413, 415, 422), le rapport repart en texte seul, même ordre.
Le worker.js fourni n'accepte que du texte : il refuse les photos (422) et le rapport part donc en texte seul.
conclusion.txt part toujours en dernier."""
import json, os, sys, urllib.request, urllib.error, base64, html
import ssl
CTX = ssl.create_default_context()
SKILL = os.path.dirname(os.path.abspath(__file__))
ici = "."

# Sous la photo, seulement les résultats (vagues, trous…). "1" = ajouter aussi le nom des modèles.
MODELES_SOUS_PHOTO = os.environ.get("SPY_MODELES_SOUS_PHOTO") == "1"
MAX_PHOTOS, MAX_OCTETS, MAX_LEGENDE, MAX_TEXTE = 30, 5 * 1024 * 1024, 1024, 3800
def photo_ok(octets):
    return (len(octets) <= MAX_OCTETS and (octets[:3] == b"\xff\xd8\xff" or octets[:8] == b"\x89PNG\r\n\x1a\n"
            or (octets[:4] == b"RIFF" and octets[8:12] == b"WEBP")))

def lire_photo(x):
    if not x.get("capture"):
        return b""
    try:
        o = open(os.path.join(ici, x["capture"]), "rb").read()
        return o if photo_ok(o) else b""
    except OSError:
        return b""

def ancien_envoi(chemin):
    """Sans resultat.json : rapport, bloc Modèles, une photo par boutique."""
    msgs = [m.strip() for m in open(chemin, encoding="utf-8").read().split("\n===\n") if m.strip()]
    _mt, _mj = os.path.join(ici, "modeles.txt"), os.path.join(ici, "modeles.json")
    if os.path.isfile(_mt):
        msgs += [m.strip() for m in open(_mt, encoding="utf-8").read().split("\n===\n") if m.strip()]
    n = 0
    if os.path.isfile(_mj):
        for b in json.load(open(_mj, encoding="utf-8")):
            lignes, photos = [f"<b>{html.escape(b['page'])}</b>"], []
            for i, x in enumerate(b.get("modeles", []), 1):
                o = lire_photo(x)
                if o and n + len(photos) < MAX_PHOTOS:
                    photos.append(base64.b64encode(o).decode()); etat = f"photo {len(photos)}"
                else:
                    etat = "vidéo seulement" if x.get("video_seulement") else "pas de photo"
                lignes.append(f"{i}. {html.escape(x['modele'])} ({x['pubs']} pubs) · {etat}")
            if photos:
                msgs.append({"texte": "\n".join(lignes)[:MAX_LEGENDE], "photos": photos}); n += len(photos)
    return msgs

def par_boutique():
    """Boutique par boutique : la photo d'abord, puis ses résultats et ses pubs actives."""
    _r, _mj = os.path.join(ici, "resultat.json"), os.path.join(ici, "modeles.json")
    if not (os.path.isfile(_r) and os.path.isfile(_mj)):
        return None
    sys.path.insert(0, SKILL)
    import spy_calc                                   # mêmes lignes, mêmes verdicts que messages.txt
    res = json.load(open(_r, encoding="utf-8"))
    mods = {m["page_id"]: m for m in json.load(open(_mj, encoding="utf-8"))}
    # le nombre de pubs actives vient de spy_calc.py (champs « actives », « actives_lues »)
    def actives(row):
        if "actives" not in row:
            return ""
        t, l = row["actives"], row["actives_lues"]
        return f"Pubs actives : {t} ({l} lues)" if t > l else f"Pubs actives : {t}"
    m = spy_calc.PAYS[res["pays"]]
    out, buf, n = [], [], 0
    def pousser_texte(t):
        nonlocal buf
        if buf and len("\n\n".join(buf + [t])) > MAX_TEXTE:
            out.append("\n\n".join(buf)); buf = []
        buf.append(t)
    def vider():
        nonlocal buf
        if buf: out.append("\n\n".join(buf)); buf = []
    pousser_texte(f"{m['drapeau']} <b>SPY {res['pays']}</b>\nهاذا هو التحليل تاع الشهر\n"
                  f"Fenêtre : {res['fenetre']} · {res['nb_pages']} pages")
    for rang, titre_fr, phrase_ar in spy_calc.GROUPES:
        rows = [x for x in res["pages"] if x["rang"] == rang]
        if not rows:
            continue
        pousser_texte(f"<b>{titre_fr}</b> — {len(rows)}\n{phrase_ar}")
        for row in rows:
            ligne = spy_calc.ligne(row, res["pays"])
            mo = mods.get(row["page_id"], {"modeles": [], "etat": "textes non lus"})
            photos, lignes_m = [], []
            for i, x in enumerate(mo["modeles"], 1):
                o = lire_photo(x)
                if o and n + len(photos) < MAX_PHOTOS:
                    photos.append(base64.b64encode(o).decode()); etat = f"photo {len(photos)}"
                elif o:
                    etat = "photo non envoyée (limite de 30 photos)"
                else:
                    etat = "vidéo seulement" if x.get("video_seulement") else "pas de photo"
                lignes_m.append(f"{i}. {html.escape(x['modele'])} ({x['pubs']} pubs) · {etat}")
            if mo.get("etat") == "egalite" and lignes_m:
                lignes_m.append("égalité au 2e rang : tous gardés")
            act = actives(row)
            if act:
                ligne = ligne + "\n" + act
            bloc = ligne + ("\n" + "\n".join(lignes_m) if MODELES_SOUS_PHOTO and lignes_m else "")
            if photos:
                vider()
                if len(bloc) <= MAX_LEGENDE:
                    out.append({"texte": bloc, "photos": photos})
                else:                                   # légende trop longue : photo d'abord, résultats juste après
                    out.append({"texte": f"<b>{html.escape(row['page'])}</b>", "photos": photos}); out.append(bloc)
                n += len(photos)
            else:
                pousser_texte(bloc)
    jet = [x for x in res["pages"] if x["rang"] >= 8]
    if jet:
        pousser_texte(f"<b>Écartées</b> — {len(jet)}\nغير بائعين بالجملة ولا صفحات واقفة\n"
                      + ", ".join(spy_calc.esc(x["page"]) for x in jet))
    vider()
    return out

def sans_photos(liste):
    """Même ordre, photos retirées : chaque message photo redevient du texte."""
    out = []
    for x in liste:
        t = x if isinstance(x, str) else x["texte"]
        if out and isinstance(out[-1], str) and len(out[-1]) + len(t) + 2 <= MAX_TEXTE:
            out[-1] += "\n\n" + t
        else:
            out.append(t)
    return out

def preparer(chemin):
    """Les messages à envoyer, dans l'ordre (conclusion.txt en dernier). Aucun appel réseau."""
    global ici
    ici = os.path.dirname(os.path.abspath(chemin))
    try:
        msgs = par_boutique()
    except Exception as e:                              # l'ordre par boutique ne doit jamais bloquer le rapport
        print("ordre par boutique impossible (" + str(e)[:80] + ") · envoi d'avant")
        msgs = None
    if msgs is None:
        msgs = ancien_envoi(chemin)
    # la conclusion en darija (conclusion.txt, à côté de messages.txt) part en dernier message
    _concl = os.path.join(ici, "conclusion.txt")
    fin = []
    if os.path.isfile(_concl):
        t = open(_concl, encoding="utf-8").read().strip()
        if t: fin.append(html.escape(t)[:4000])
    return msgs, fin

def envoyer(url, cle, cle_demande, chat_id, liste):
    corps = json.dumps({"key": cle_demande, "chat_id": chat_id, "messages": liste}).encode()
    req = urllib.request.Request(url.rstrip("/") + "/spy/reponse", data=corps, method="POST",
          headers={"content-type": "application/json", "user-agent": "spy/1.0", "X-Cle": cle})
    try:
        return 200, json.loads(urllib.request.urlopen(req, timeout=180, context=CTX).read())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}

if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage : spy_envoi.py <key> <chat_id> <messages.txt>")
    cle_demande, chat_id, chemin = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    url, cle = os.environ.get("WORKER_URL", ""), os.environ.get("CLE_AGENTS", "")
    if not url or not cle:
        raise SystemExit("ÉCHEC · variables WORKER_URL et CLE_AGENTS absentes")
    msgs, fin = preparer(chemin)
    tout = msgs + fin
    try:
        code, d = envoyer(url, cle, cle_demande, chat_id, tout)
        if any(isinstance(x, dict) for x in tout) and code in (400, 413, 415, 422):   # refusé avant tout envoi
            print(f"photos refusées par le robot ({code}) · rapport renvoyé en texte seul")
            tout = sans_photos(msgs) + fin; code, d = envoyer(url, cle, cle_demande, chat_id, tout)
    except Exception as e:
        print("ÉCHEC · " + str(e).replace(cle, "***").replace(url, "***")[:200]); sys.exit(1)
    ok = d.get("ok") is True and len(d.get("envoyes", [])) == len(tout)
    n_ph = sum(len(m["photos"]) for m in tout if isinstance(m, dict))
    print(("PASSE · %d message(s) envoyé(s) dont %d photo(s)" % (len(tout), n_ph)) if ok else "ÉCHEC · " + json.dumps(d)[:200])
    sys.exit(0 if ok else 1)
