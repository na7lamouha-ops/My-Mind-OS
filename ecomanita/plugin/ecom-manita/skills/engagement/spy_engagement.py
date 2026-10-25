#!/usr/bin/env python3
"""Spy ENGAGEMENT : les vidéos vêtement de plus de 200 000 vues sur Instagram,
lues avec l'API officielle de Meta (Business Discovery), en LECTURE SEULE.
Rien n'est publié, aucun compte n'est touché. Python 3.8+ standard, rien à installer.

    python3 spy_engagement.py preparer [dossier de travail]
    python3 spy_engagement.py cle      [--travail DOSSIER]
    python3 spy_engagement.py lire     [profils.txt] [dossier du run] [--periode mois|3mois|saison] [--relire-erreurs]
    python3 spy_engagement.py trier    [dossier du run] [--json resultat.json] [--min-videos N] [--periode ...]
    python3 spy_engagement.py livrer   [dossier du run] [--min-videos N] [--periode ...]
    python3 spy_engagement.py verifier [dossier du run]
    python3 spy_engagement.py tout     [--travail DOSSIER] [--periode ...]
    python3 spy_engagement.py mentions [dossier du run] [nouveaux.txt]

Sur Windows, remplacer « python3 » par « py » (ou « python »).

Dossier de travail par défaut : « ecom-manita-engagement » dans le dossier personnel
(le même sur Mac et Windows ; « --travail DOSSIER » pour en choisir un autre).
Il contient :
  ig-spy.json   la clé du client {"ig_user_id": "...", "jeton": "..."} ; remplie par le
                client lui-même ; jamais affichée, jamais copiée ailleurs.
                (Variable IG_SPY_JSON = autre chemin pour ce fichier.)
  profils.txt   un profil Instagram par ligne (nom, @nom ou lien du profil).
  run-mois/     brut/ (réponses Meta), images/ (couvertures), puis la livraison :
                videos-200k.txt, modeles.html, resultat.json.

preparer : crée le dossier de travail, ig-spy.json à remplir et profils.txt (n'écrase rien).
cle      : un seul appel pour vérifier que la clé marche ; affiche le compte relié, jamais le jeton.
lire     : pour chaque profil, lit ses publications de la période et garde la réponse BRUTE.
           Reprise : un profil déjà lu (depuis moins de FRAIS_JOURS jours) n'est pas relu ;
           un profil en erreur définitive (compte perso, nom faux) non plus, sauf --relire-erreurs.
           Rythme : 10 à 15 s entre deux profils ; si le compteur de Meta (en-têtes X-App-Usage
           et X-Business-Use-Case-Usage) DÉPASSE 75 %, pause de 15 min puis reprise.
           Erreurs de limite Meta #4 / #17 / #32 / #613 (et #80002) : attente puis nouvel essai,
           ESSAIS_LIMITE fois, puis ARRÊT PROPRE (code 3) : relancer la même commande plus tard.
           Jeton mort (#190) : arrêt tout de suite (code 2).
trier    : relit le brut seulement. Garde les vidéos (Reels) de plus de 200 000 vues publiées
           dans la période ; une vidéo dont les vues sont absentes n'est JAMAIS comptée.
           Garde les profils qui en ont au moins MIN_VIDEOS (1 par défaut), classés par nombre
           de vidéos puis total de vues. view_count de Meta MÉLANGE vues payantes et organiques.
livrer   : trier + écrit videos-200k.txt (vues · date · lien), modeles.html (page cliquable,
           groupée par profil dans l'ordre du classement) et resultat.json.
verifier : deuxième méthode : recompte directement le brut, sans passer par trier, et compare
           avec resultat.json, le .txt et la page HTML. PASSE seulement si tout concorde.
tout     : lire puis livrer puis verifier, avec les chemins par défaut du dossier de travail.
mentions : relit le brut et écrit les @profils cités dans les légendes, pas encore lus.
--periode : mois = 30 derniers jours (défaut) ; 3mois = 90 jours ; saison = la même saison
           l'an passé (J-365 à J-275) : bien plus d'appels Meta.
"""
import html
import json
import os
import random
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ICI = Path(__file__).resolve().parent
TRAVAIL_DEFAUT = Path.home() / "ecom-manita-engagement"

SEUIL_VUES = 200_000
PERIODES = {"mois": (30, 0), "3mois": (90, 0), "saison": (365, 275)}  # (jours en arrière, jours de fin)
JOURS = 30
MIN_VIDEOS = 1             # tout ce qui dépasse le seuil, même une seule vidéo par profil
VERSION = "v21.0"          # remplaçable par "version_api" dans ig-spy.json
PAUSE_COMPTE = (10, 15)    # secondes entre deux profils (tirées au hasard dans l'intervalle)
SEUIL_USAGE = 75           # % du compteur Meta au-delà duquel on fait la pause longue
PAUSE_USAGE = 15 * 60      # secondes
PAUSE_LIMITE = 20 * 60     # secondes après un blocage Meta
ESSAIS_LIMITE = 2          # nouveaux essais du même profil avant l'arrêt propre
FRAIS_JOURS = 3            # un brut plus vieux est relu
MAX_PAGES = 40             # pages de 50 publications au plus par profil
CODES_LIMITE = (4, 17, 32, 613, 80002)
CODES_JETON = (190,)
ENTETES_USAGE = ("x-app-usage", "x-business-use-case-usage")
CLES_USAGE = ("call_count", "total_cputime", "total_time")
JETON_VIDE = "COLLE-TON-JETON-ICI"
ID_VIDE = "COLLE-TON-ID-ICI"
CHAMPS_MEDIA = ("id,caption,media_type,media_product_type,timestamp,permalink,"
                "like_count,comments_count,view_count,thumbnail_url")  # la couverture, jamais la vidéo
NOM_IG = re.compile(r"^[a-z0-9._]{1,30}$")
LIEN_IG = re.compile(r"instagram\.com/([A-Za-z0-9._]{1,30})/?", re.I)
LIEN_REEL = re.compile(r"^https://(www\.)?instagram\.com/(reel|reels|p)/[A-Za-z0-9_\-]+/?(\?[^\s\"'<>]*)?$")
LIGNE_VIDEO = re.compile(r"^\d[\d ]* · \d{4}-\d\d-\d\d · ")
USAGE = {"pct": 0}
CTX = ssl.create_default_context()


# ---------- petits outils (remplaçables dans les essais) ----------

def dire(texte):
    print(texte, flush=True)


def echec(raison, code=1):
    dire(f"ÉCHEC · {raison}")
    raise SystemExit(code)


def dormir(secondes):
    time.sleep(secondes)


def horloge():
    return datetime.now(timezone.utc)


def ouvrir(url):
    """(code HTTP, en-têtes, octets). Seul point qui parle au réseau pour Meta."""
    try:
        with urllib.request.urlopen(url, context=CTX, timeout=60) as r:
            return r.status, dict(r.headers.items()), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict((e.headers or {}).items()), e.read()


def telecharger(url):
    with urllib.request.urlopen(url, context=CTX, timeout=30) as r:
        return r.read(5_000_001)


def date(ts):
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S%z")  # Meta : 2026-10-01T12:00:00+0000


def fenetre(maintenant, periode="mois"):
    debut, fin = PERIODES[periode]
    return maintenant - timedelta(days=debut), maintenant - timedelta(days=fin)


def masquer(texte, jeton=None):
    texte = re.sub(r"access_token=[^&\s\"']+", "access_token=***", str(texte))
    return texte.replace(jeton, "***") if jeton else texte


def chemin_brut(run, nom):
    return Path(run) / "brut" / f"ig_{nom}.json"  # préfixe : « con », « nul »… sont interdits sur Windows


def lire_json(chemin):
    return json.loads(Path(chemin).read_text(encoding="utf-8"))


def ecrire_json(chemin, donnees):
    Path(chemin).write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")


# ---------- clé du client ----------

def chemin_cle(travail):
    return Path(os.environ.get("IG_SPY_JSON") or Path(travail) / "ig-spy.json")


def config(travail):
    chemin = chemin_cle(travail)
    try:
        c = lire_json(chemin)
    except (OSError, ValueError):
        echec(f"clé illisible : {chemin} · lancer « preparer » puis remplir ce fichier", 2)
    jeton = str(c.get("jeton") or "").strip()
    ig = str(c.get("ig_user_id") or "").strip()
    if not jeton or jeton == JETON_VIDE or not ig.isdigit():
        echec(f"clé pas encore remplie dans {chemin} (ig_user_id en chiffres + jeton)", 2)
    return {"ig": ig, "jeton": jeton, "version": str(c.get("version_api") or VERSION)}


# ---------- appels Meta ----------

def pourcents(v):
    if isinstance(v, dict):
        for k, x in v.items():
            if k in CLES_USAGE and isinstance(x, (int, float)):
                yield x
            else:
                yield from pourcents(x)
    elif isinstance(v, list):
        for x in v:
            yield from pourcents(x)


def noter_usage(entetes):
    """X-App-Usage {"call_count": %, ...} et X-Business-Use-Case-Usage {"id": [{...}]} : garde le plus haut."""
    vus = []
    for nom in ENTETES_USAGE:
        brut = entetes.get(nom)
        if brut:
            try:
                vus += list(pourcents(json.loads(brut)))
            except ValueError:
                pass
    if vus:
        USAGE["pct"] = max(vus)


def souffler():
    """Pause longue si le compteur Meta DÉPASSE le seuil ; rend True si on a attendu."""
    if USAGE["pct"] > SEUIL_USAGE:
        dire(f"compteur Meta à {USAGE['pct']} % (plus de {SEUIL_USAGE} %) · pause {PAUSE_USAGE // 60} min puis reprise")
        dormir(PAUSE_USAGE)
        USAGE["pct"] = 0
        return True
    return False


def appel(url, jeton=None):
    try:
        code, entetes, corps = ouvrir(url)
    except (urllib.error.URLError, OSError, ValueError) as e:
        return {"erreur": masquer(f"réseau : {e}", jeton), "reseau": True}
    noter_usage({str(k).lower(): v for k, v in entetes.items()})
    try:
        rep = json.loads(corps.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, AttributeError):
        rep = None
    if code == 200 and isinstance(rep, dict) and "error" not in rep:
        return rep
    err = rep.get("error", {}) if isinstance(rep, dict) else {}
    num, msg = err.get("code"), str(err.get("message") or "")
    marque = f"(#{num}) " if num is not None and f"(#{num})" not in msg else ""
    return {"erreur": masquer(f"HTTP {code} {marque}{msg}".strip(), jeton), "code": num}


def code_de(b):
    if isinstance(b.get("code"), int):
        return b["code"]
    m = re.search(r"\(#(\d+)\)", b.get("erreur", ""))
    return int(m.group(1)) if m else None


def limite_meta(b):
    return "erreur" in b and code_de(b) in CODES_LIMITE


def jeton_mort(b):
    return "erreur" in b and code_de(b) in CODES_JETON


def url_graph(cle, champs):
    return (f"https://graph.facebook.com/{cle['version']}/{cle['ig']}?"
            + urllib.parse.urlencode({"fields": champs, "access_token": cle["jeton"]}))


def lire_compte(nom, cle, maintenant, jours=JOURS):
    """Pages de 50 publications jusqu'à dépasser [jours] jours. Rend le brut (jamais le jeton)."""
    limite = maintenant - timedelta(days=jours)
    medias, curseur, profil = [], None, {}
    for _ in range(MAX_PAGES):
        if curseur:
            souffler()  # entre deux pages du même profil ; entre deux profils, c'est lire() qui s'en charge
        bloc = f"media.after({curseur}).limit(50){{{CHAMPS_MEDIA}}}" if curseur else f"media.limit(50){{{CHAMPS_MEDIA}}}"
        champs = f"business_discovery.username({nom}){{username,followers_count,media_count,biography,website,{bloc}}}"
        rep = appel(url_graph(cle, champs), cle["jeton"])
        if "erreur" in rep:
            definitive = not (limite_meta(rep) or jeton_mort(rep) or rep.get("reseau")) and rep.get("code") is not None
            return {"username": nom, "erreur": rep["erreur"], "code": rep.get("code"),
                    "definitive": definitive, "lu_le": maintenant.isoformat()}
        bd = rep.get("business_discovery", {})
        profil.update({k: bd[k] for k in ("username", "followers_count", "media_count", "biography", "website") if k in bd})
        page = bd.get("media", {})
        data = page.get("data", [])
        medias += data
        curseur = page.get("paging", {}).get("cursors", {}).get("after")
        vieux = any("timestamp" in m and date(m["timestamp"]) < limite for m in data)
        if not data or vieux or not curseur:
            break
    return {**profil, "username": str(profil.get("username", nom)).lower(), "lu_le": maintenant.isoformat(),
            "jours_lus": jours, "medias": medias}


def deja_lu(chemin, jours, maintenant, relire_erreurs=False):
    try:
        b = lire_json(chemin)
        frais = maintenant - datetime.fromisoformat(b["lu_le"]) < timedelta(days=FRAIS_JOURS)
    except (OSError, ValueError, KeyError, TypeError):
        return False
    if "erreur" in b:
        return frais and b.get("definitive") is True and not relire_erreurs
    return frais and b.get("jours_lus", JOURS) >= jours


def ecrire_brut(chemin, b):
    """Une lecture en erreur n'écrase jamais un brut bon. Rend False quand l'ancien est gardé."""
    if "erreur" in b and Path(chemin).exists():
        try:
            if "erreur" not in lire_json(chemin):
                return False
        except ValueError:
            pass
    ecrire_json(chemin, b)
    return True


def est_video(m):
    return m.get("media_product_type") == "REELS" or m.get("media_type") == "VIDEO"


def garder_images(b, run):
    """Copie la couverture des reels au-dessus du seuil (le lien Meta expire). Une image ratée ne bloque rien."""
    dossier = Path(run) / "images"
    dossier.mkdir(parents=True, exist_ok=True)
    n = 0
    for m in b.get("medias", []):
        url, ident = m.get("thumbnail_url"), str(m.get("id") or "")
        if not (url and ident.isdigit() and est_video(m) and isinstance(m.get("view_count"), int)
                and m["view_count"] > SEUIL_VUES):
            continue
        chemin = dossier / f"{ident}.jpg"
        if chemin.exists():
            continue
        try:
            octets = telecharger(url)
        except (urllib.error.URLError, OSError, ValueError):
            continue
        if octets[:3] == b"\xff\xd8\xff" and len(octets) <= 5_000_000:
            chemin.write_bytes(octets)
            n += 1
    return n


def lire_profils(chemin):
    noms, refuses = [], []
    for ligne in Path(chemin).read_text(encoding="utf-8-sig").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#"):
            continue
        m = LIEN_IG.search(ligne)
        nom = (m.group(1) if m else ligne).lstrip("@").strip().lower()
        if NOM_IG.match(nom):
            if nom not in noms:
                noms.append(nom)
        else:
            refuses.append(ligne)
    return noms, refuses


def lire(profils, run, cle, periode="mois", relire_erreurs=False):
    """Rend 0 (fini), 1 (rien lu), 2 (jeton mort), 3 (limite Meta : relancer plus tard)."""
    maintenant = horloge()
    jours = PERIODES[periode][0]
    noms, refuses = lire_profils(profils)
    for r in refuses:
        dire(f"ligne ignorée (pas un nom Instagram) : {r[:60]}")
    if not noms:
        echec(f"aucun profil dans {profils}")
    (Path(run) / "brut").mkdir(parents=True, exist_ok=True)
    ok = deja = 0
    for i, nom in enumerate(noms):
        chemin = chemin_brut(run, nom)
        if deja_lu(chemin, jours, maintenant, relire_erreurs):
            deja += 1
            ok += 1
            continue
        for essai in range(ESSAIS_LIMITE + 1):
            b = lire_compte(nom, cle, maintenant, jours)
            if not limite_meta(b) or essai == ESSAIS_LIMITE:
                break
            dire(f"limite Meta à @{nom} · attente {PAUSE_LIMITE // 60} min (essai {essai + 1}/{ESSAIS_LIMITE})")
            dormir(PAUSE_LIMITE)
            USAGE["pct"] = 0
        if jeton_mort(b):
            dire(f"JETON REFUSÉ · arrêt à @{nom} ({b['erreur']}) · refaire le jeton dans ig-spy.json puis relancer")
            return 2
        if limite_meta(b):
            dire(f"LIMITE META · arrêt propre à @{nom} ({b['erreur']}) · {ok} lus, {len(noms) - i} restent : "
                 "relancer la même commande plus tard (les profils lus ne seront pas relus)")
            return 3
        if not ecrire_brut(chemin, b):
            dire(f"@{nom} : {b['erreur']} · brut précédent gardé")
        ok += "erreur" not in b
        images = 0 if "erreur" in b else garder_images(b, run)
        etat = b.get("erreur") or f"{len(b['medias'])} publication(s)"
        dire(f"@{nom} : {etat} · {images} image(s) · compteur Meta {USAGE['pct']} %")
        if i < len(noms) - 1 and not souffler():
            dormir(random.uniform(*PAUSE_COMPTE))
    dire(f"{'PASSE' if ok else 'ÉCHEC'} · {ok}/{len(noms)} profil(s) lus (dont {deja} déjà lus avant, pas relus)")
    return 0 if ok else 1


# ---------- tri, sans réseau ----------

DZ_FORT = re.compile(
    r"\+?213|\.dz\b|alg[eé]rie|algeria|dzair|58\s*wilaya|alger\b|oran\b|s[eé]tif|constantine|annaba|blida|"
    r"tizi|bejaia|béjaïa|الجزائر|جزائر|وهران|قسنطينة|سطيف|عنابة|البليدة", re.I)
SIGNES_PAYS = (
    ("DZ", DZ_FORT),
    ("MA", re.compile(r"\+?212|maroc|morocco|casablanca|rabat|marrakech|tanger|agadir|المغرب", re.I)),
    ("TN", re.compile(r"\+?216|tunisie|tunisia|\btunis\b|sfax|sousse|تونس", re.I)),
    ("EG", re.compile(r"\+20\s?1\d|egypt|[eé]gypte|cairo|le caire|alexandria|مصر|القاهرة|الاسكندرية", re.I)),
    ("IQ", re.compile(r"\+?964|iraq|irak|baghdad|bagdad|erbil|basra|العراق|بغداد|اربيل", re.I)),
    ("TR", re.compile(r"\+90\s?5\d|t[uü]rkiye|turkey|istanbul|ankara|izmir|toptan", re.I)),
)
MENTION = re.compile(r"(?<![\w.])@([A-Za-z0-9._]{1,30})")


def pays_lu(b):
    """Pays ÉCRIT dans la bio ou le site (indicatif, nom, ville) et le mot qui l'a montré ; jamais deviné."""
    for code, rx in SIGNES_PAYS:
        for ou, nom in (("biography", "la bio"), ("website", "le site")):
            trouve = rx.search(str(b.get(ou) or ""))
            if trouve:
                return code, f"« {trouve.group(0)} » dans {nom}"
    return None, None


def entier(v):
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def charger_bruts(run):
    dossier = Path(run) / "brut"
    if not dossier.is_dir():
        echec(f"brut/ absent dans {run} : lancer d'abord « lire »")
    return [lire_json(f) for f in sorted(dossier.glob("*.json"))]


def trier(bruts, maintenant, periode="mois", min_videos=MIN_VIDEOS):
    debut, fin = fenetre(maintenant, periode)
    comptes, erreurs, sans_vues = [], [], []
    for b in bruts:
        if "erreur" in b:
            erreurs.append({"username": b.get("username"), "erreur": b["erreur"]})
            continue
        bonnes, vues_absentes = [], 0
        for m in b.get("medias", []):
            if not est_video(m) or "timestamp" not in m or not debut <= date(m["timestamp"]) < fin:
                continue
            v = entier(m.get("view_count"))
            if v is None:
                vues_absentes += 1
                continue
            if v > SEUIL_VUES:
                bonnes.append({"vues": v, "date": m["timestamp"], "lien": m.get("permalink"), "id": str(m.get("id")),
                               "texte": (m.get("caption") or "")[:140], "jaime": entier(m.get("like_count")),
                               "commentaires": entier(m.get("comments_count"))})
        if vues_absentes:
            sans_vues.append({"username": b["username"], "videos_sans_vues": vues_absentes})
        if bonnes and len(bonnes) >= min_videos:
            bonnes.sort(key=lambda x: -x["vues"])
            code, signe = pays_lu(b)
            comptes.append({"username": b["username"], "abonnes": entier(b.get("followers_count")),
                            "pays_lu": code, "pays_signe": signe, "videos": len(bonnes),
                            "vues_total": sum(x["vues"] for x in bonnes), "liste": bonnes})
    comptes.sort(key=lambda c: (-c["videos"], -c["vues_total"], c["username"]))
    for i, c in enumerate(comptes, 1):
        c["rang"] = i
    return {"now": maintenant.isoformat(), "debut": debut.isoformat(), "fin": fin.isoformat(),
            "du": debut.isoformat()[:10], "au": fin.isoformat()[:10], "periode": periode,
            "seuil_vues": SEUIL_VUES, "min_videos": min_videos, "profils_lus": len(bruts) - len(erreurs),
            "note": "view_count de Meta = vues payantes + organiques mélangées",
            "comptes": comptes, "erreurs": erreurs, "vues_non_lues": sans_vues}


def mentions(bruts):
    lus = {str(b.get("username", "")).lower() for b in bruts}
    vus = []
    for b in bruts:
        for m in b.get("medias", []):
            for n in MENTION.findall(m.get("caption") or ""):
                n = n.rstrip(".").lower()
                if n and n not in lus and n not in vus:
                    vus.append(n)
    return vus


# ---------- livraison ----------

def nombre(n):
    return f"{n:,}".replace(",", " ")


def texte_livraison(res):
    lignes = [f"# Spy engagement · vidéos de plus de {nombre(res['seuil_vues'])} vues · du {res['du']} au {res['au']}",
              f"# {len(res['comptes'])} profil(s) · {sum(c['videos'] for c in res['comptes'])} vidéo(s) · "
              f"{res['profils_lus']} profil(s) lus",
              "# Attention : les vues de Meta mélangent pub et organique."]
    for c in res["comptes"]:
        pays = f" · {c['pays_lu']}" if c.get("pays_lu") else ""
        lignes.append(f"\n== {c['rang']}. @{c['username']} · {c['videos']} vidéo(s) · {nombre(c['vues_total'])} vues{pays} ==")
        for v in c["liste"]:
            lignes.append(f"{nombre(v['vues'])} · {v['date'][:10]} · {v.get('lien') or 'lien ?'}")
    return "\n".join(lignes) + "\n"


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spy engagement</title>
<style>
:root{--fond:#f6f5f2;--carte:#fff;--texte:#1d1d1f;--doux:#6b6b70;--bord:#e4e2dc;--accent:#b4532a}
@media (prefers-color-scheme:dark){:root{--fond:#16161a;--carte:#222228;--texte:#f2f2f4;--doux:#a0a0a8;--bord:#33333b;--accent:#e9875c}}
body{margin:0;background:var(--fond);color:var(--texte);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:28px 0 10px}
.note{color:var(--doux);margin:0 0 6px}
.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.video{background:var(--carte);border:1px solid var(--bord);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:block}
.video img,.vide{width:100%;aspect-ratio:9/16;object-fit:cover;display:block;background:var(--bord)}
.vide{display:flex;align-items:center;justify-content:center;color:var(--doux)}
.info{padding:8px 10px}.vues{font-weight:600;color:var(--accent)}.date{color:var(--doux);font-size:13px}
</style></head><body><main>
"""


def page_livraison(res, run):
    morceaux = [PAGE,
                f"<h1>Vidéos de plus de {nombre(res['seuil_vues'])} vues</h1>",
                f"<p class=\"note\">Du {res['du']} au {res['au']} · {len(res['comptes'])} profil(s) · "
                f"{sum(c['videos'] for c in res['comptes'])} vidéo(s) · {res['profils_lus']} profil(s) lus.</p>",
                "<p class=\"note\">Les vues de Meta mélangent pub et organique : ce sont des signes d'intérêt, "
                "pas des ventes. Cliquer une vidéo l'ouvre sur Instagram.</p>"]
    if not res["comptes"]:
        morceaux.append("<p>Aucune vidéo au-dessus du seuil sur cette période.</p>")
    for c in res["comptes"]:
        nom = html.escape(c["username"])
        pays = f" · {html.escape(c['pays_lu'])}" if c.get("pays_lu") else ""
        morceaux.append(f"<h2>{c['rang']}. <a href=\"https://www.instagram.com/{nom}/\" target=\"_blank\" "
                        f"rel=\"noopener\">@{nom}</a> · {c['videos']} vidéo(s) · {nombre(c['vues_total'])} vues{pays}</h2>")
        morceaux.append("<div class=\"grille\">")
        for v in c["liste"]:
            lien = v.get("lien") or ""
            href = html.escape(lien, quote=True) if LIEN_REEL.match(lien) else "#"
            image = Path(run) / "images" / f"{v['id']}.jpg"
            visuel = (f"<img src=\"images/{html.escape(v['id'])}.jpg\" alt=\"\" loading=\"lazy\">" if image.is_file()
                      else "<div class=\"vide\">pas d'image</div>")
            morceaux.append(f"<a class=\"video\" href=\"{href}\" target=\"_blank\" rel=\"noopener\">{visuel}"
                            f"<div class=\"info\"><div class=\"vues\">{nombre(v['vues'])} vues</div>"
                            f"<div class=\"date\">{v['date'][:10]}</div></div></a>")
        morceaux.append("</div>")
    morceaux.append("</main></body></html>\n")
    return "\n".join(morceaux)


def livrer(run, periode="mois", min_videos=MIN_VIDEOS):
    res = trier(charger_bruts(run), horloge(), periode, min_videos)
    ecrire_json(Path(run) / "resultat.json", res)
    (Path(run) / "videos-200k.txt").write_text(texte_livraison(res), encoding="utf-8")
    (Path(run) / "modeles.html").write_text(page_livraison(res, run), encoding="utf-8")
    return res


# ---------- deuxième méthode ----------

def recompter(bruts, debut, fin, seuil, min_videos):
    """Recalcul DIRECT du brut, écrit à part de trier() : ids des vidéos gardées, par profil."""
    par_profil = {}
    for b in bruts:
        if b.get("erreur"):
            continue
        ids = []
        for m in b.get("medias") or []:
            vues = m.get("view_count")
            if type(vues) is not int or vues <= seuil:
                continue
            if m.get("media_product_type") != "REELS" and m.get("media_type") != "VIDEO":
                continue
            quand = m.get("timestamp")
            if quand and debut <= datetime.strptime(quand, "%Y-%m-%dT%H:%M:%S%z") < fin:
                ids.append(str(m.get("id")))
        if ids and len(ids) >= min_videos:
            par_profil[b["username"]] = ids
    return par_profil


def verifier(run):
    run = Path(run)
    try:
        res = lire_json(run / "resultat.json")
        txt = (run / "videos-200k.txt").read_text(encoding="utf-8")
        page = (run / "modeles.html").read_text(encoding="utf-8")
    except (OSError, ValueError):
        echec(f"livraison absente dans {run} : lancer d'abord « livrer »")
    direct = recompter(charger_bruts(run), datetime.fromisoformat(res["debut"]), datetime.fromisoformat(res["fin"]),
                       res["seuil_vues"], res["min_videos"])
    ids_direct = sorted(i for ids in direct.values() for i in ids)
    ids_tri = sorted(v["id"] for c in res["comptes"] for v in c["liste"])
    lignes_txt = sum(1 for l in txt.splitlines() if LIGNE_VIDEO.match(l))
    cartes = page.count("<a class=\"video\"")
    controles = [
        ("profils : tri du script = recalcul direct", len(res["comptes"]), len(direct)),
        ("vidéos : tri du script = recalcul direct", len(ids_tri), len(ids_direct)),
        ("mêmes vidéos (ids) des deux côtés", ids_tri == ids_direct, True),
        ("lignes du .txt = vidéos", lignes_txt, len(ids_direct)),
        ("cartes de la page HTML = vidéos", cartes, len(ids_direct)),
    ]
    bon = True
    for nom, a, b in controles:
        dire(f"{'PASSE' if a == b else 'ÉCHEC'} · {nom} ({a} / {b})")
        bon &= a == b
    dire(f"{'PASSE' if bon else 'ÉCHEC'} · vérification à deux méthodes · {len(direct)} profil(s), "
         f"{len(ids_direct)} vidéo(s) de plus de {nombre(res['seuil_vues'])} vues")
    return 0 if bon else 1


# ---------- préparation et clé ----------

MODELE_PROFILS = """# Un profil Instagram par ligne : nom, @nom ou lien du profil.
# Seuls les comptes PROFESSIONNELS (Business ou Créateur) sont lisibles.
# Les lignes qui commencent par # sont ignorées. Exemple :
# @exemple.boutique
"""


def preparer(travail):
    travail = Path(travail)
    travail.mkdir(parents=True, exist_ok=True)
    cle = travail / "ig-spy.json"
    if not cle.exists():
        ecrire_json(cle, {"ig_user_id": ID_VIDE, "jeton": JETON_VIDE})
        try:
            os.chmod(cle, 0o600)  # sans effet sur Windows : rien de grave
        except OSError:
            pass
        dire(f"créé : {cle} (à remplir par le client, jamais dans le chat)")
    else:
        dire(f"déjà là, pas touché : {cle}")
    profils = travail / "profils.txt"
    if not profils.exists():
        profils.write_text(MODELE_PROFILS, encoding="utf-8")
        dire(f"créé : {profils}")
    else:
        dire(f"déjà là, pas touché : {profils}")
    dire(f"PASSE · dossier de travail prêt : {travail}")
    return 0


def tester_cle(cle):
    rep = appel(url_graph(cle, "username,followers_count"), cle["jeton"])
    if "erreur" in rep:
        dire(f"ÉCHEC · la clé ne marche pas : {rep['erreur']}")
        return 2 if jeton_mort(rep) else 1
    dire(f"PASSE · clé valide · compte relié @{rep.get('username', '?')} · compteur Meta {USAGE['pct']} %")
    return 0


# ---------- ligne de commande ----------

def options(argv):
    pos, opt, i = [], {}, 0
    while i < len(argv):
        a = argv[i]
        if a == "--relire-erreurs":
            opt[a] = True
            i += 1
        elif a.startswith("--"):
            opt[a] = argv[i + 1] if i + 1 < len(argv) else ""
            i += 2
        else:
            pos.append(a)
            i += 1
    return pos, opt


def main(argv):
    try:
        sys.stdout.reconfigure(errors="replace")  # console Windows : jamais de plantage sur un accent
    except (AttributeError, ValueError):
        pass
    if not argv:
        dire(__doc__)
        return 2
    cmd, (pos, opt) = argv[0], options(argv[1:])
    travail = Path(opt.get("--travail") or TRAVAIL_DEFAUT)
    periode = opt.get("--periode", "mois")
    if periode not in PERIODES:
        echec(f"période inconnue « {periode} » : {', '.join(PERIODES)}")
    run_defaut = travail / f"run-{periode}"
    try:
        min_videos = int(opt.get("--min-videos", MIN_VIDEOS))
    except ValueError:
        echec("--min-videos attend un nombre")
    if cmd == "preparer":
        return preparer(pos[0] if pos else travail)
    if cmd == "cle":
        return tester_cle(config(travail))
    if cmd == "lire":
        profils = pos[0] if pos else travail / "profils.txt"
        run = pos[1] if len(pos) > 1 else run_defaut
        return lire(profils, run, config(travail), periode, opt.get("--relire-erreurs", False))
    if cmd == "trier":
        run = pos[0] if pos else run_defaut
        res = trier(charger_bruts(run), horloge(), periode, min_videos)
        if "--json" in opt:
            ecrire_json(opt["--json"], res)
        for c in res["comptes"]:
            dire(f"{c['rang']}. @{c['username']} · {c['videos']} vidéo(s) · {nombre(c['vues_total'])} vues")
        dire(f"PASSE · {len(res['comptes'])} profil(s) · {sum(c['videos'] for c in res['comptes'])} vidéo(s) · "
             f"{len(res['erreurs'])} erreur(s) · du {res['du']} au {res['au']}")
        return 0
    if cmd == "livrer":
        run = Path(pos[0] if pos else run_defaut)
        res = livrer(run, periode, min_videos)
        dire(f"PASSE · {len(res['comptes'])} profil(s) · {sum(c['videos'] for c in res['comptes'])} vidéo(s) → "
             f"{run / 'videos-200k.txt'} et {run / 'modeles.html'}")
        return 0
    if cmd == "verifier":
        return verifier(pos[0] if pos else run_defaut)
    if cmd == "tout":
        code = lire(travail / "profils.txt", run_defaut, config(travail), periode, opt.get("--relire-erreurs", False))
        if code == 2 or not any((run_defaut / "brut").glob("*.json")):
            return code or 1
        livrer(run_defaut, periode, min_videos)
        bon = verifier(run_defaut)
        if code == 3:
            dire("LIVRAISON PARTIELLE · la limite Meta a arrêté la lecture : relancer « tout » plus tard pour la suite")
        return code or bon
    if cmd == "mentions":
        run = pos[0] if pos else run_defaut
        sortie = Path(pos[1] if len(pos) > 1 else travail / "nouveaux-profils.txt")
        noms = mentions(charger_bruts(run))
        sortie.write_text("".join(n + "\n" for n in noms), encoding="utf-8")
        dire(f"PASSE · {len(noms)} profil(s) cité(s) pas encore lu(s) → {sortie}")
        return 0
    dire(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
