# -*- coding: utf-8 -*-
"""
MANITA — LES CAPTURES : quand le Drive n'a QUE des videos, on tire des PHOTOS
des videos — quatre par couleur — pour la page produit (mode site).
Regle du 20/09/2026.

  python3 captures.py --rushes <dossier> --sortie <dossier> [--couleurs 4] [--combien 4] [--pas 2] [--ecart 6]
  python3 captures.py --verifier          l'auto-test, sur des videos fabriquees ici

  --ecart : l'ecart minimum (secondes) entre deux photos du MEME rush (6 par
  defaut). Un modele filme en prises courtes (une prise de 14 s par couleur)
  ne donne que deux photos par prise a 6 s : le bureau relance alors avec un
  ecart plus court (2 s, puis 1 s) avant de dire que la page n'aura pas ses
  six photos (07/10/2026).

Ce qu'on garde, dans l'ordre :
  1. le modele EN ENTIER — la mesure du cadrage de MONTER-10 : la bande du
     haut comparee aux quatre coins ; petit = decor en haut = plan entier
     (seuil 80). Un gros plan ne fait pas une photo de page produit.
  2. la couleur TYPIQUE de sa famille — la plus proche du centre de la famille
  3. des instants eloignes et des rushes differents — quatre photos qui se
     ressemblent ne valent qu'une.

Les couleurs ne sont pas devinees : --couleurs dit combien il y en a (le
produit le sait), comme dans MONTER-10.

VERIFIE, PAS SUPPOSE : chaque photo ecrite est RELUE — elle s'ouvre, elle a la
bonne taille, et sa couleur (mesuree sur le fichier ecrit, pas sur l'apercu)
retombe dans sa famille. Une photo qui rate est retiree ET nommee dans le
rapport. Deuxieme methode, pas la meme repetee.

LA LOI DU COMPTAGE (09/10/2026, recette du vendeur) : un rush = une tenue ;
les familles se font avec le NOMBRE DIT par le client (--couleurs N ; « auto »
seulement s'il n'a rien dit) ; AUCUN rush et AUCUNE famille ne sont jetes
(une couleur filmee une fois est une famille a elle seule) ; moins de
familles que le nombre dit -> une DEUXIEME passe par instant (troncons de
couleur d'au moins 4 s, les courts fondus dans le voisin), retenue seulement
si elle s'approche du nombre dit sans le depasser ; une famille sans capture
cadree RESTE, marquee « sans_capture » (avec un apercu) ; l'INVARIANT
(familles brutes = avec photo + sans photo, chaque capture une seule fois,
somme par couleur = total, zero orpheline, zero double, chaque rush dans une
famille) et l'ECART au nombre dit sont ecrits dans _rapport.json.

Rien n'est publie : les photos sortent dans un dossier, la page reste une
decision. Aucun nom de couleur n'est invente : le rapport donne le centre RGB,
c'est le client (par le coach) qui nomme.
"""
import argparse
import io
import json
import math
import os
import shutil
import subprocess
import sys
import re
import tempfile
import time

VERSION = "2.5"            # 12/10/2026 : deuxieme mesure (lumiere) quand le nombre de couleurs est dit
BARRE = "=" * 62
SEUIL_CADRAGE = 80.0      # la meme mesure et le meme seuil que MONTER-10
SEUIL_DECOR = 25.0        # le haut de l'image doit etre du decor, pas le vetement (gros plan de tissu)
SEUIL_TETE = 25.0         # le haut de l'image doit differer de la bande de la tete (sinon la tete est coupee)
POIDS_TEINTE = 20.0       # la TEINTE (part de rouge, part de bleu) pese vingt fois la lumiere (sur cent)


def vecteur(couleur):
    """Une couleur pour les distances : la lumiere (moyenne sur cent) compte
    une fois, la teinte (part de rouge, part de bleu dans la somme) compte
    vingt fois. Fautes vues le 20/09/2026 sur vingt-cinq rushes : en RGB brut
    le marron d'interieur tombait dans le noir et le beige d'interieur dans
    le gris (la lumiere du lieu pesait plus que le vetement) ; avec un ecart
    de chaleur R-B, le beige se coupait en deux selon la lumiere. La teinte
    en PART de la somme, elle, ne bouge presque pas avec la lumiere."""
    r, g, b = couleur
    somme = float(r + g + b) + 1e-6
    return ((r + g + b) / 300.0, POIDS_TEINTE * r / somme, POIDS_TEINTE * b / somme)


def ecart(c1, c2):
    return math.dist(vecteur(c1), vecteur(c2))


# 12/10/2026 : avec la teinte a vingt fois la lumiere, un noir bleute et un noir neutre sont plus loin l'un de
# l'autre qu'un noir neutre et un beige : sur un produit noir et beige (« 2 » dit), des rushes noirs tombaient
# dans la famille du beige. Deuxieme mesure, la LUMIERE pesant quatre fois : quand le client a DIT le nombre,
# les familles se font avec les deux mesures et on garde celle qui separe le mieux (silhouette). Le chemin
# « auto » ne change pas.
POIDS_LUMIERE = 4.0


def vecteur_lumiere(couleur):
    r, g, b = couleur
    somme = float(r + g + b) + 1e-6
    return (POIDS_LUMIERE * (r + g + b) / 300.0, POIDS_TEINTE * r / somme, POIDS_TEINTE * b / somme)


def silhouette(fams, metrique):
    """La qualite d'une partition : pour chaque element, (b - a) / max(a, b), a = distance moyenne aux siens,
    b = la plus petite distance moyenne a une autre famille ; moyenne sur tous. 0 si une seule famille."""
    if len(fams) < 2:
        return 0.0
    def d(x, y):
        return math.dist(metrique(x["couleur"]), metrique(y["couleur"]))
    total, n = 0.0, 0
    for i, g in enumerate(fams):
        for p in g["membres"]:
            autres = [q for q in g["membres"] if q is not p]
            a = sum(d(p, q) for q in autres) / len(autres) if autres else 0.0
            b = min(sum(d(p, q) for q in h["membres"]) / len(h["membres"]) for j, h in enumerate(fams) if j != i)
            total += (b - a) / max(a, b) if max(a, b) > 0 else 0.0
            n += 1
    return total / n if n else 0.0
ECART_MINI_S = 6.0        # deux captures du meme rush : au moins six secondes d'ecart
LARGEUR_MESURE = 200      # l'apercu sur lequel on mesure (comme MONTER-10)
COTE_MINI = 720           # une photo de page produit : au moins 720 px sur le petit cote
EXTENSIONS = (".mp4", ".mov", ".m4v")


def lancer(cmd, minuteur=600):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=minuteur,
                          stdin=subprocess.DEVNULL)


def sonde(fichier):
    """largeur, hauteur, duree — par ffprobe, jamais devine."""
    r = lancer(["ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height:format=duration",
                "-of", "json", fichier], 120)
    if r.returncode != 0:
        return None
    d = json.loads(r.stdout or "{}")
    st = (d.get("streams") or [{}])[0]
    try:
        return int(st["width"]), int(st["height"]), float(d["format"]["duration"])
    except (KeyError, TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# 1. LES MESURES — les memes fenetres que MONTER-10, sur une seule image
# ---------------------------------------------------------------------------

def mesures(png):
    """Rend (couleur du vetement, cadrage). Couleur = fenetre sur le CORPS
    (on evite le mur et le sol). Cadrage = bande du haut contre quatre coins."""
    from PIL import Image
    import numpy as np
    a = np.asarray(Image.open(png).convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape

    def moy(y0, y1, x0, x1):
        return a[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)].reshape(-1, 3).mean(axis=0)

    couleur = tuple(float(x) for x in moy(0.40, 0.82, 0.34, 0.66))
    coins = (moy(0, .12, 0, .14) + moy(0, .12, .86, 1) + moy(.88, 1, 0, .14) + moy(.88, 1, .86, 1)) / 4.0
    haut = moy(0, .10, .32, .68)
    cadrage = float(math.dist(haut, coins))
    # un gros plan de TISSU remplit tout : haut = coins = vetement, et la mesure
    # dirait « entier ». Le haut doit etre du DECOR : different du vetement.
    decor = float(math.dist(haut, couleur))
    # un hijab clair devant un mur clair : haut = coins, et la tete est coupee.
    # Le haut doit aussi differer de la bande de la tete.
    tete = float(math.dist(haut, moy(0.12, 0.22, 0.40, 0.60)))
    # un plan rapproche remplit la LARGEUR : a hauteur du corps, les deux bords
    # doivent etre du decor, pas le vetement (C1-4 et C2-2 de l'essai 7).
    # CHAQUE bord, pas leur moyenne : un mur clair a droite ne rachete pas une
    # manche qui touche le bord gauche (C1-4 et C2-2 de l'essai 8).
    cotes = min(float(math.dist(moy(0.40, 0.82, 0.0, 0.12), couleur)),
                float(math.dist(moy(0.40, 0.82, 0.88, 1.0), couleur)))
    return couleur, cadrage, min(decor, tete, cotes)


def echantillonner(fichier, couche, pas, travail, prefixe):
    """Une image toutes les `pas` secondes, en UNE lecture de la video
    (pas cent seeks). Rend [(t, png)]."""
    vf = ("transpose=2," if couche else "") + "fps=1/%s,scale=%d:-1" % (("%.3f" % pas).rstrip("0").rstrip("."), LARGEUR_MESURE)
    motif = os.path.join(travail, prefixe + "_%05d.png")
    # pas de -vsync : l'option a disparu des ffmpeg recents (le Mac a repondu
    # « Unrecognized option 'vsync' » le 20/09/2026) ; le filtre fps suffit
    r = lancer(["ffmpeg", "-v", "error", "-i", fichier, "-vf", vf, motif, "-y"], 1800)
    if r.returncode != 0:
        print("   [ecarte] %s : ffmpeg a repondu %s" % (os.path.basename(fichier), " ".join((r.stderr or "").split())[:200]))
        return []
    noms = sorted(n for n in os.listdir(travail) if n.startswith(prefixe + "_") and n.endswith(".png"))
    return [((k) * pas, os.path.join(travail, n)) for k, n in enumerate(noms)]


def apercu(fichier, dest, t):
    r = lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % max(0.0, t), "-i", fichier,
                "-frames:v", "1", "-vf", "scale=%d:-1" % LARGEUR_MESURE, dest, "-y"], 120)
    return r.returncode == 0 and os.path.isfile(dest) and os.path.getsize(dest) > 0


def lire_rushes(dossier, travail=None):
    """L'orientation se lit sur une image DECODEE, jamais sur les metadonnees :
    une video rangee en 1920x1080 avec une etiquette de rotation sort DROITE
    de ffmpeg (autorotate), et la tourner encore la couche (faute du
    20/09/2026 : sept captures sur quinze etaient sur le cote)."""
    from PIL import Image
    travail = travail or tempfile.mkdtemp(prefix="captures-lecture-")
    os.makedirs(travail, exist_ok=True)
    noms = sorted(x for x in os.listdir(dossier)
                  if x.lower().endswith(EXTENSIONS) and not x.startswith("."))
    fiches = []
    for i, n in enumerate(noms):
        f = os.path.join(dossier, n)
        s = sonde(f)
        if not s:
            print("   [ecarte] %s : illisible" % n)
            continue
        w, h, d = s
        p = os.path.join(travail, "ap_%03d.png" % i)
        if not apercu(f, p, min(1.0, d / 2.0)):
            print("   [ecarte] %s : aucune image ne sort" % n)
            continue
        dw, dh = Image.open(p).size
        try:
            os.remove(p)
        except OSError:
            pass
        fiches.append({"fichier": f, "nom": n, "couche": dw > dh, "largeur": w, "hauteur": h, "duree": d,
                       "etiquette_rotation": (w > h) != (dw > dh)})
    return fiches


# ---------------------------------------------------------------------------
# 2. LES FAMILLES — exactement n couleurs, comme familles_n de MONTER-10
# ---------------------------------------------------------------------------

def familles_n(elements, n, metrique=None):
    """Exactement n couleurs, comme familles_n de MONTER-10 : le produit sait
    combien il en a. Les elements portent une « couleur » (r, g, b).
    12/10/2026 : la mesure de distance se choisit (teinte par defaut, ou lumiere)."""
    metrique = metrique or vecteur
    def ecart(c1, c2):
        return math.dist(metrique(c1), metrique(c2))
    pts = sorted(elements, key=lambda x: metrique(x["couleur"]))
    if not pts:
        return []
    n = max(1, min(n, len(pts)))
    if n == 1:
        c = [sum(p["couleur"][k] for p in pts) / float(len(pts)) for k in range(3)]
        return [{"centre": tuple(c), "membres": pts}]
    # depart « du plus eloigne » : le premier centre est le plus sombre, puis
    # chaque centre suivant est le point le plus loin de tous les centres deja
    # poses. Un depart « a intervalles reguliers » (20/09/2026) posait deux
    # centres dans le beige et un seul pour le noir ET le gris : le beige se
    # coupait en deux selon la lumiere, le noir et le gris fondaient ensemble.
    centres = [[float(x) for x in pts[0]["couleur"]]]
    while len(centres) < n:
        loin = max(pts, key=lambda p: min(ecart(p["couleur"], c) for c in centres))
        centres.append([float(x) for x in loin["couleur"]])
    grp = [[] for _ in range(n)]
    for _ in range(40):
        grp = [[] for _ in range(n)]
        for p in pts:
            j = min(range(n), key=lambda j: ecart(p["couleur"], centres[j]))
            grp[j].append(p)
        neufs = [[sum(p["couleur"][c] for p in grp[j]) / float(len(grp[j])) for c in range(3)]
                 if grp[j] else centres[j] for j in range(n)]
        fini = all(ecart(a, b) < 0.002 for a, b in zip(centres, neufs))
        centres = neufs
        if fini:
            break
    fams = [{"centre": tuple(centres[j]), "membres": grp[j]} for j in range(n) if grp[j]]
    fams.sort(key=lambda g: sum(g["centre"]))
    return fams


RAYON_FAMILLE = 0.36       # un rush est a moins de 0,36 du CENTRE de sa couleur (beige d'interieur / d'exterieur :
                            # 0,21 chacun) ; deux couleurs differentes se tiennent a plus de 0,90 l'une de l'autre
                            # (noir / marron : 0,96, noir / beige : 1,09), donc a plus de 0,45 de leur centre commun


def compter_couleurs(rushes, maxi=8):
    """Quand le produit ne dit pas combien il a de couleurs : le plus petit n
    pour lequel chaque famille est serree (aucun rush a plus de
    RAYON_FAMILLE de son centre). 09/10/2026 : plus aucun rush n'est ecarte
    avant (une couleur filmee une fois compte pour une couleur)."""
    if len(rushes) <= 1:
        return len(rushes)
    for n in range(1, min(maxi, len(rushes)) + 1):
        fams = familles_n(rushes, n)
        if all(ecart(r["couleur"], g["centre"]) <= RAYON_FAMILLE for g in fams for r in g["membres"]):
            return n
    return min(maxi, len(rushes))


def familles_par_rush(points, fiches, n):
    """UN RUSH = UNE TENUE. La couleur d'un rush est la mediane de ses
    echantillons (un hijab noir qui passe devant la robe ne change pas la
    tenue). Les familles se font sur les rushes, puis chaque famille recoit
    tous les echantillons de ses rushes. C'est ce qui a marche le 17/09/2026
    sur vingt-cinq rushes (sept, six, cinq, sept — aucun jete) ; faire les
    familles sur les images coupait le gris en deux selon la lumiere.

    09/10/2026 (recette du vendeur, LE COMPTAGE) : n est le NOMBRE DIT par le
    client (0 : l'outil compte). AUCUN rush et AUCUNE famille ne sont jetes :
    une couleur filmee une seule fois est une famille a elle seule. Avant, une
    famille d'un seul rush etait ecartee (« plan sans le vetement ») des que
    les rushes etaient au moins deux fois plus nombreux que les couleurs : sur
    un vrai lot, la couleur filmee une fois disparaissait du compte et de la
    page. Les plans sans vetement sont l'affaire de la separation (regle des
    impuretes), plus de ce comptage. Rend (familles, []) : la liste des rushes
    ecartes reste dans le rapport, toujours vide."""
    par_rush = {}
    for p in points:
        par_rush.setdefault(p["rush"], []).append(p)
    rushes = []
    for nom, pts in par_rush.items():
        cs = sorted(pts, key=lambda p: sum(p["couleur"]))
        med = cs[len(cs) // 2]["couleur"]
        rushes.append({"rush": nom, "couleur": med, "points": pts})
    dit = n > 0
    if n == 0:
        n = compter_couleurs(rushes)
    fams = familles_n(rushes, n)
    mesure = "teinte"
    if dit and n >= 2:
        # 12/10/2026 : les deux mesures, la mieux separee gagne (egalite : la teinte, comme avant)
        fams2 = familles_n(rushes, n, vecteur_lumiere)
        s1, s2 = silhouette(fams, vecteur), silhouette(fams2, vecteur_lumiere)
        if s2 > s1 + 1e-9:
            fams, mesure = fams2, "lumiere"
        print("   mesures : teinte %.3f / lumiere %.3f -> %s" % (s1, s2, mesure))
    for g in fams:
        g["rushes"] = [r["rush"] for r in g["membres"]]
        g["points"] = [p for r in g["membres"] for p in r["points"]]
        g["mesure"] = mesure
    return fams, []


TRONCON_MINI_S = 4.0       # deuxieme passe : un troncon de couleur dure au moins quatre secondes
SAUT_NET = 1.5             # deuxieme passe : deux troncons voisins sont deux tenues si leur saut depasse 1,5 fois leur etendue


def _mediane(pts):
    cs = sorted(pts, key=lambda p: sum(p["couleur"]))
    return cs[len(cs) // 2]["couleur"]


def familles_par_instant(points, n, pas, mini_s=TRONCON_MINI_S):
    """LA DEUXIEME PASSE (09/10/2026, recette du vendeur) — seulement quand la
    premiere (un rush = une tenue) trouve MOINS de familles que le nombre dit :
    un rush peut porter deux tenues l'une apres l'autre. Chaque echantillon
    recoit sa couleur (n couleurs sur les instants), chaque rush est coupe en
    TRONCONS de la meme couleur, un troncon de moins de `mini_s` secondes est
    FONDU dans son voisin le plus proche en couleur (jamais jete), puis les
    familles se font sur les troncons. Rien n'est jete : chaque echantillon
    reste dans exactement une famille. Une famille garde ses troncons
    (« segments ») ; ses « rushes » sont ceux dont elle porte la plus grande
    part ; une famille qui ne porte la plus grande part d'aucun rush garde les
    rushes de ses troncons (MONTER-10 --familles laisse alors ce rush a la
    premiere famille et le dit)."""
    if not points or n < 1:
        return []
    lab = familles_n(points, n)
    etiq = {}
    for j, g in enumerate(lab):
        for p in g["membres"]:
            etiq[id(p)] = j
    centres = [g["centre"] for g in lab]
    par_rush = {}
    for p in points:
        par_rush.setdefault(p["rush"], []).append(p)
    unites = []
    for rush, pts in par_rush.items():
        pts = sorted(pts, key=lambda p: p["t"])
        runs = []
        for p in pts:
            e = etiq.get(id(p), 0)
            if runs and runs[-1]["e"] == e:
                runs[-1]["pts"].append(p)
            else:
                runs.append({"e": e, "pts": [p]})

        def duree(r):
            return r["pts"][-1]["t"] - r["pts"][0]["t"] + pas
        while len(runs) > 1:
            courts = [i for i, r in enumerate(runs) if duree(r) < mini_s - 1e-6]
            if not courts:
                break
            i = min(courts, key=lambda i: duree(runs[i]))
            voisins = [k for k in (i - 1, i + 1) if 0 <= k < len(runs)]
            k = min(voisins, key=lambda k: ecart(_mediane(runs[i]["pts"]), centres[runs[k]["e"]]))
            runs[k]["pts"] = sorted(runs[k]["pts"] + runs[i]["pts"], key=lambda p: p["t"])
            del runs[i]
            fus = []
            for r in runs:                      # deux voisins de la meme couleur n'en font qu'un
                if fus and fus[-1]["e"] == r["e"]:
                    fus[-1]["pts"] = sorted(fus[-1]["pts"] + r["pts"], key=lambda p: p["t"])
                else:
                    fus.append(r)
            runs = fus
        # UN CHANGEMENT DE TENUE EST NET (10/10/2026, passe « casser ») : deux troncons voisins ne sont deux tenues que si le
        # saut entre leurs couleurs depasse nettement ce que chaque troncon bouge en lui-meme (une seule tenue rouge qui
        # passe devant le decor bouge de 4,7 d'un instant a l'autre ; un rouge qui devient bleu saute de 7 a 8). Sinon :
        # la meme tenue, les deux troncons n'en font qu'un (rien n'est jete, ils sont reunis).
        def etendue(r):
            m = _mediane(r["pts"])
            return max(ecart(p["couleur"], m) for p in r["pts"])
        change = True
        while change and len(runs) > 1:
            change = False
            for i in range(len(runs) - 1):
                a, b = runs[i], runs[i + 1]
                saut = ecart(_mediane(a["pts"]), _mediane(b["pts"]))
                if saut <= max(2 * RAYON_FAMILLE, SAUT_NET * max(etendue(a), etendue(b))):
                    garde = a if len(a["pts"]) >= len(b["pts"]) else b
                    runs[i:i + 2] = [{"e": garde["e"], "pts": sorted(a["pts"] + b["pts"], key=lambda p: p["t"])}]
                    change = True
                    break
        for r in runs:
            unites.append({"rush": rush, "couleur": _mediane(r["pts"]), "points": r["pts"],
                           "de": round(r["pts"][0]["t"], 2), "a": round(r["pts"][-1]["t"] + pas, 2)})
    # JAMAIS UNE COULEUR INVENTEE (10/10/2026, passe « casser ») : une seule tenue rouge de 12 s, la lumiere qui tourne, quatre
    # couleurs dites pour trois filmees -> ses deux troncons (2-6 s, 6-12 s, la meme tenue) devenaient deux familles et la
    # passe etait « retenue ». Les troncons sont comptes comme des rushes (compter_couleurs : chaque famille serree) : la
    # deuxieme passe ne fait jamais plus de familles que de vraies couleurs dans ses troncons, ni plus que le nombre dit.
    n = max(1, min(n, compter_couleurs(unites)))
    fams = familles_n(unites, n)
    part = {}
    for j, g in enumerate(fams):
        for u in g["membres"]:
            part.setdefault(u["rush"], {}).setdefault(j, 0)
            part[u["rush"]][j] += len(u["points"])
    chef = {r: max(d, key=lambda j: (d[j], -j)) for r, d in part.items()}
    for j, g in enumerate(fams):
        g["points"] = [p for u in g["membres"] for p in u["points"]]
        g["segments"] = [{"rush": u["rush"], "de": u["de"], "a": u["a"]} for u in g["membres"]]
        g["rushes"] = sorted(r for r, c in chef.items() if c == j) or sorted({u["rush"] for u in g["membres"]})
    return fams


def invariant(rapport, sortie, rushes_lus):
    """L'INVARIANT ECRIT APRES CHAQUE PASSE (09/10/2026, recette du vendeur) :
    familles brutes = familles avec photo + familles sans photo ; chaque
    capture rattachee a UNE seule famille ; la somme par couleur = le total ;
    zero photo orpheline sur le disque (dans un dossier couleur-k sans etre
    dans le rapport), zero double ; chaque rush lu est dans une famille.
    Compte relu SUR LE DISQUE, pas repris des listes : une deuxieme methode."""
    fams = rapport["familles"]
    refs = [c["fichier"] for f in fams for c in f["captures"]]
    disque = []
    for d in sorted(os.listdir(sortie)) if os.path.isdir(sortie) else []:
        dd = os.path.join(sortie, d)
        if d.startswith("couleur-") and os.path.isdir(dd):
            disque += [os.path.join(dd, x) for x in sorted(os.listdir(dd)) if x.startswith("capture-")]
    norm = lambda x: os.path.normcase(os.path.abspath(x))
    vus, doubles = set(), []
    for r in refs:
        (doubles.append(r) if norm(r) in vus else vus.add(norm(r)))
    orphelines = [x for x in disque if norm(x) not in vus]
    absentes = [r for r in refs if not os.path.isfile(r)]
    rattaches = set(r for f in fams for r in f.get("rushes", [])) | set(s["rush"] for f in fams for s in f.get("segments", []))
    hors = [r for r in rushes_lus if r not in rattaches]
    avec = sum(1 for f in fams if f["captures"])
    sans = sum(1 for f in fams if not f["captures"])
    par_couleur = [len(f["captures"]) for f in fams]
    inv = {"familles_brutes": len(fams), "avec_photo": avec, "sans_photo": sans,
           "captures": len(refs), "par_couleur": par_couleur, "somme_par_couleur": sum(par_couleur),
           "sur_le_disque": len(disque), "orphelines": orphelines, "doubles": doubles, "absentes": absentes,
           "rushes_lus": len(rushes_lus), "rushes_hors_famille": hors}
    inv["ok"] = (len(fams) == avec + sans and sum(par_couleur) == len(refs) == len(disque)
                 and not orphelines and not doubles and not absentes and not hors)
    return inv


def vu_par_l_outil(points):
    """Ce que l'outil compterait SEUL (compter_couleurs sur les rushes, sans le
    nombre dit) : la deuxieme lecture qui nomme l'ecart dans les deux sens
    (10/10/2026, passe « casser » : 4 couleurs filmees, 3 dites -> 3 familles
    dont une melee, et le rapport disait « le nombre dit est trouve »)."""
    par_rush = {}
    for p in points:
        par_rush.setdefault(p["rush"], []).append(p)
    return compter_couleurs([{"rush": r, "couleur": _mediane(pts)} for r, pts in par_rush.items()])


def ecart_au_nombre_dit(dit, trouve, vu=None):
    """L'ecart avec le nombre dit, NOMME dans les deux sens (jamais bloquant).
    vu : ce que l'outil compte seul ; quand il differe du nombre dit, c'est dit
    aussi (des couleurs melees dans une famille, ou une couleur coupee en deux
    par la lumiere) — les familles restent faites avec le nombre dit."""
    if not dit:
        return {"dit": None, "trouve": trouve, "ecart": 0, "vu_par_l_outil": vu, "texte": "nombre de couleurs non dit : compte de l'outil (%d)" % trouve}
    if trouve < dit:
        t = "il manque %d couleur(s) : %d dite(s), %d trouvee(s) — on continue sur ce qui est la" % (dit - trouve, dit, trouve)
    elif trouve > dit:
        t = "%d couleur(s) de plus que dit : %d dite(s), %d trouvee(s) — on continue sur ce qui est la" % (trouve - dit, dit, trouve)
    else:
        t = "le nombre dit est trouve : %d" % dit
    if vu and vu != trouve:
        t += (" ; l'outil seul en voit %d (%s) — les familles restent faites avec le nombre dit, a verifier sur les photos"
              % (vu, "des couleurs peuvent etre melees dans une famille" if vu > trouve else "une couleur peut etre coupee en deux par la lumiere"))
    return {"dit": dit, "trouve": trouve, "ecart": trouve - dit, "vu_par_l_outil": vu, "texte": t}


# ---------------------------------------------------------------------------
# 3. LE CHOIX — entier d'abord, typique ensuite, eloigne toujours
# ---------------------------------------------------------------------------

def candidats(famille, seuil=SEUIL_CADRAGE):
    """Les echantillons d'une famille, du meilleur au moins bon : entier
    d'abord, puis le plus typique de sa couleur (et le mieux cadre)."""
    centre = famille["centre"]
    return sorted(famille["points"],
                  key=lambda p: (0 if p["cadrage"] <= seuil else 1,
                                 ecart(p["couleur"], centre) + 0.25 * p["cadrage"]))


def loin_de(p, pris, ecart_s=ECART_MINI_S):
    return all(q["rush"] != p["rush"] or abs(q["t"] - p["t"]) >= ecart_s for q in pris)


SEUIL_PAGE = 40.0      # pour une page produit on veut MIEUX qu'entier-limite : le decor bien au-dessus de la tete


def choisir(famille, combien, seuil=SEUIL_CADRAGE, garder=None, ecart_s=ECART_MINI_S):
    """Prend `combien` echantillons ; `garder(p)` dit si la photo tiree de p est
    bonne (extraction + relecture). Quand une photo est retiree, on passe a la
    candidate suivante au lieu de laisser un trou. Les passes descendent :
    (1) bien entier, un rush different a chaque fois ; (2) bien entier, meme
    rush a ecart_s secondes (six par defaut) ; (3) entier-limite, rush different ; (4) entier-
    limite, meme rush ; (5) ce qui reste. Au plus quatre essais par photo."""
    cands = candidats(famille, seuil)
    pris, essayes, essais = [], set(), 0
    rates, doublons = set(), set()     # rushes deja tombes dans une passe « rush neuf » ; rushes qui sont des copies
    for rush_neuf, plafond in ((True, SEUIL_PAGE), (False, SEUIL_PAGE), (True, seuil), (False, seuil), (False, 1e9)):
        for p in cands:
            if len(pris) >= combien or essais >= combien * 4:
                break
            if id(p) in essayes or p["cadrage"] > plafond or not loin_de(p, pris, ecart_s) or p["rush"] in doublons:
                continue
            if rush_neuf and (any(q["rush"] == p["rush"] for q in pris) or p["rush"] in rates):
                continue
            essayes.add(id(p)); essais += 1
            verdict = True if garder is None else garder(p)
            if verdict is True:
                pris.append(p)
            else:
                rates.add(p["rush"])
                if "doublon" in str(verdict):
                    doublons.add(p["rush"])      # un clip copie deux fois : inutile d'y revenir
    return pris


# ---------------------------------------------------------------------------
# 4. L'EXTRACTION ET LA RELECTURE — la photo ecrite est relue, pas supposee
# ---------------------------------------------------------------------------

def extraire(rush, t, couche, dest):
    vf = ["-vf", "transpose=2"] if couche else []
    r = lancer(["ffmpeg", "-v", "error", "-ss", "%.3f" % max(0.0, t), "-i", rush["fichier"],
                "-frames:v", "1"] + vf + ["-q:v", "2", dest, "-y"], 300)
    return r.returncode == 0 and os.path.isfile(dest) and os.path.getsize(dest) > 0


SEUIL_DOUBLON = 0.005     # moins d'un demi pour cent des points qui bougent : c'est la meme photo


def relire(dest, centres, mienne, travail, deja=None):
    """La photo s'ouvre ? assez grande ? sa couleur, mesuree SUR LE FICHIER
    ECRIT, retombe-t-elle dans sa famille ? n'est-elle pas le DOUBLON d'une
    photo deja gardee (le meme clip copie deux fois sous deux noms, essai 7 :
    deux fichiers identiques a l'octet) ?"""
    from PIL import Image
    import numpy as np
    try:
        im = Image.open(dest)
        im.load()
        w, h = im.size
    except Exception as e:
        return False, "ne s'ouvre pas (%s)" % type(e).__name__, None, None
    if min(w, h) < COTE_MINI:
        return False, "trop petite : %dx%d" % (w, h), None, None
    p = os.path.join(travail, "relu_%d.png" % (abs(hash(dest)) % 10 ** 9))
    petit = im.convert("RGB").resize((LARGEUR_MESURE, max(1, int(h * LARGEUR_MESURE / float(w)))))
    petit.save(p)
    couleur, cadrage, decor = mesures(p)
    try:
        os.remove(p)
    except OSError:
        pass
    empreinte = np.asarray(petit.resize((64, 112)), dtype=np.int16)
    for e in (deja or []):
        # la PART des points qui ont bouge : deux photos du meme clip copie
        # deux fois n'ont aucun point qui bouge ; deux instants d'un vrai rush
        # en ont des centaines (la mannequin bouge)
        if e.shape == empreinte.shape and float((np.abs(e - empreinte).max(axis=2) > 12).mean()) < SEUIL_DOUBLON:
            return False, "doublon d'une photo deja gardee", couleur, None
    plus_proche = min(range(len(centres)), key=lambda j: ecart(couleur, centres[j]))
    if plus_proche != mienne:
        return False, "sa couleur relue tombe dans une autre famille", couleur, None
    return True, "%dx%d" % (w, h), couleur, empreinte


def capturer(rushes_dossier, sortie, couleurs=4, combien=4, pas=2.0, travail=None, ecart_s=ECART_MINI_S):
    debut = time.time()
    travail = travail or tempfile.mkdtemp(prefix="captures-")
    os.makedirs(travail, exist_ok=True)
    fiches = lire_rushes(rushes_dossier, travail)
    if not fiches:
        print("   AUCUNE video lisible dans %s" % rushes_dossier)
    else:
        print("   %d rush(es), un echantillon toutes les %.1f s" % (len(fiches), pas))
    points = []
    for i, f in enumerate(fiches):
        for t, png in echantillonner(f["fichier"], f["couche"], pas, travail, "e%02d" % i):
            # ni la toute premiere seconde ni la derniere : la camera demarre, la main passe
            if f["duree"] > 4 and (t < 1.0 or t > f["duree"] - 1.0):
                continue
            try:
                couleur, cadrage, decor = mesures(png)
            except Exception:
                continue
            # cadrage « de page » : un haut qui n'est pas du decor vaut un gros plan
            points.append({"rush": f["nom"], "fiche": f, "t": t, "couleur": couleur, "decor": decor,
                           "cadrage_brut": cadrage, "cadrage": cadrage if decor >= SEUIL_DECOR else 999.0})
    print("   %d echantillons mesures" % len(points))
    fams, ecartes = familles_par_rush(points, fiches, couleurs)
    # LA DEUXIEME PASSE (recette du vendeur) : moins de familles que le nombre DIT -> par instant, en troncons de couleur
    # d'au moins quatre secondes ; retenue seulement si elle s'approche du nombre dit SANS le depasser (un recours,
    # jamais le reglage de depart)
    deuxieme = None
    if couleurs and len(fams) < couleurs:
        f2 = familles_par_instant(points, couleurs, pas)
        retenue = len(fams) < len(f2) <= couleurs
        deuxieme = {"tentee": True, "retenue": retenue, "familles_avant": len(fams), "familles_apres": len(f2), "troncon_mini_s": TRONCON_MINI_S}
        print("   DEUXIEME PASSE (par instant, troncons >= %.0f s) : %d famille(s) au lieu de %d — %s"
              % (TRONCON_MINI_S, len(f2), len(fams), "retenue" if retenue else "pas retenue (ne s'approche pas du nombre dit)"))
        if retenue:
            fams = f2
    centres = [g["centre"] for g in fams]
    os.makedirs(sortie, exist_ok=True)
    # UNE SORTIE PROPRE (10/10/2026, passe « casser ») : les dossiers couleur-k et le rapport d'une passe d'avant dans la meme
    # sortie (« عاود », un autre nombre dit) restaient sur le disque — une capture-2.jpg d'avant devenait une ORPHELINE et
    # l'invariant tombait FAUX. Seul ce que l'outil ecrit lui-meme est retire.
    for x in os.listdir(sortie):
        if re.match(r"^couleur-\d+$", x) and os.path.isdir(os.path.join(sortie, x)):
            shutil.rmtree(os.path.join(sortie, x), ignore_errors=True)
        elif x in ("_rapport.json", "_rapport.txt"):
            try:
                os.remove(os.path.join(sortie, x))
            except OSError:
                pass
    rapport = {"version": VERSION, "rushes": rushes_dossier, "couleurs_demandees": couleurs or "auto",
               "couleurs_trouvees": len(fams),
               "photos_par_couleur": combien, "pas_secondes": pas, "ecart_secondes": ecart_s, "familles": [], "retirees": [],
               "rushes_ecartes": ecartes, "deuxieme_passe": deuxieme or {"tentee": False},
               "mesure": (fams[0].get("mesure") if fams else None),     # 12/10/2026 : la mesure retenue (teinte / lumiere)
               # un fichier video que ffmpeg ne lit pas n'est pas une tenue, mais il est NOMME (10/10/2026, passe « casser » :
               # il disparaissait du rapport, seul le terminal le disait)
               "rushes_illisibles": sorted(x for x in os.listdir(rushes_dossier) if x.lower().endswith(EXTENSIONS) and not x.startswith(".")
                                           and x not in {f["nom"] for f in fiches}) if os.path.isdir(rushes_dossier) else [],
               # un rush lu dont aucun echantillon n'a ete mesure n'entre dans aucune famille : l'invariant le compte « hors famille »
               "rushes_sans_mesure": sorted({f["nom"] for f in fiches} - {p["rush"] for p in points})}
    for j, g in enumerate(fams):
        d = os.path.join(sortie, "couleur-%d" % (j + 1))
        os.makedirs(d, exist_ok=True)
        fam = {"dossier": d, "centre_rgb": [round(x) for x in g["centre"]], "rushes": g["rushes"],
               "echantillons": len(g["points"]),
               "entiers": sum(1 for p in g["points"] if p["cadrage"] <= SEUIL_CADRAGE),
               "bien_entiers": sum(1 for p in g["points"] if p["cadrage"] <= SEUIL_PAGE), "captures": []}
        if g.get("segments"):
            fam["segments"] = g["segments"]
        empreintes = []

        def garder(p, j=j, d=d, fam=fam, empreintes=empreintes):
            """La photo est tiree, puis RELUE ; si elle ne tient pas, elle est
            retiree et nommee, et on passe a la candidate suivante."""
            dest = os.path.join(d, "capture-%d.jpg" % (len(fam["captures"]) + 1))   # numerotee seulement si gardee
            if not extraire(p["fiche"], p["t"], p["fiche"]["couche"], dest):
                rapport["retirees"].append({"famille": j + 1, "rush": p["rush"], "t": p["t"], "raison": "ffmpeg n'a rien ecrit"})
                return "ffmpeg n'a rien ecrit"
            ok, detail, relue, empreinte = relire(dest, centres, j, travail, empreintes)
            if ok:
                empreintes.append(empreinte)
            if not ok:
                rapport["retirees"].append({"famille": j + 1, "rush": p["rush"], "t": p["t"], "raison": detail})
                try:
                    os.remove(dest)
                except OSError:
                    pass
                return detail
            fam["captures"].append({"fichier": dest, "rush": p["rush"], "t": round(p["t"], 2),
                                    "cadrage": round(p["cadrage_brut"], 1), "decor_en_haut": round(p["decor"], 1),
                                    "entier": p["cadrage"] <= SEUIL_CADRAGE,
                                    "taille": detail, "couleur_relue_rgb": [round(x) for x in relue]})
            return True
        choisir(g, combien, garder=garder, ecart_s=ecart_s)
        rapport["familles"].append(fam)
    # UNE FAMILLE SANS CAPTURE CADREE RESTE UNE COULEUR (09/10/2026, recette du vendeur). Avant, elle etait retiree du
    # compte (20/09/2026 : deux videos de la meme tenue coupees en deux par la lumiere) — sur un vrai lot, une vraie
    # couleur sans plan entier disparaissait en silence. Elle reste, marquee « sans_capture », avec un APERCU (une image
    # de son echantillon le plus typique, cadree ou non : jamais une photo de page) pour que le client la reconnaisse,
    # et c'est dit (rapport, historique, client).
    for j, (g, f) in enumerate(zip(fams, rapport["familles"])):
        if f["captures"]:
            continue
        f["sans_capture"] = True
        meilleur = min(g["points"], key=lambda p: ecart(p["couleur"], g["centre"])) if g["points"] else None
        dest = os.path.join(f["dossier"], "apercu.jpg")
        if meilleur and extraire(meilleur["fiche"], meilleur["t"], meilleur["fiche"]["couche"], dest):
            f["apercu"] = dest
        print("   COULEUR %d SANS CAPTURE CADREE : gardee dans le compte (%d rush(es))" % (j + 1, len(f["rushes"])))
    rapport["familles_sans_capture"] = [i + 1 for i, f in enumerate(rapport["familles"]) if not f["captures"]]
    rapport["couleurs_trouvees"] = len(rapport["familles"])
    rapport["invariant"] = invariant(rapport, sortie, [f["nom"] for f in fiches])
    rapport["ecart_nombre_dit"] = ecart_au_nombre_dit(couleurs, len(rapport["familles"]), vu_par_l_outil(points) if couleurs and points else None)
    print("   INVARIANT : %d famille(s) = %d avec photo + %d sans photo · %d capture(s) = somme par couleur %s · %d orpheline(s) · %d double(s) · %d rush(es) hors famille — %s"
          % (rapport["invariant"]["familles_brutes"], rapport["invariant"]["avec_photo"], rapport["invariant"]["sans_photo"],
             rapport["invariant"]["captures"], rapport["invariant"]["par_couleur"], len(rapport["invariant"]["orphelines"]),
             len(rapport["invariant"]["doubles"]), len(rapport["invariant"]["rushes_hors_famille"]), "OK" if rapport["invariant"]["ok"] else "FAUX"))
    print("   ECART AU NOMBRE DIT : %s" % rapport["ecart_nombre_dit"]["texte"])
    rapport["secondes"] = round(time.time() - debut, 1)
    rapport["manque"] = [{"famille": i + 1, "voulues": combien, "obtenues": len(f["captures"])}
                         for i, f in enumerate(rapport["familles"]) if len(f["captures"]) < combien]
    if not fams:
        # zero echantillon n'est pas un succes : on le dit, en clair
        rapport["manque"] = [{"famille": k + 1, "voulues": combien, "obtenues": 0} for k in range(couleurs or 1)]
    with io.open(os.path.join(sortie, "_rapport.json"), "w", encoding="utf-8") as f:
        f.write(json.dumps(rapport, ensure_ascii=False, indent=1))
    shutil.rmtree(travail, ignore_errors=True)
    return rapport


def vue(rapport):
    L = [BARRE, "  LES CAPTURES — %d couleur(s), %d photo(s) voulue(s) par couleur" % (len(rapport["familles"]), rapport["photos_par_couleur"]), BARRE,
         "  | couleur | centre RGB | rushes | echantillons | entiers | bien entiers | photos |",
         "  |---|---|---|---|---|---|---|"]
    for i, f in enumerate(rapport["familles"]):
        L.append("  | %d | %s | %d | %d | %d | %d | %d |" % (i + 1, " ".join(str(x) for x in f["centre_rgb"]), len(f["rushes"]), f["echantillons"], f["entiers"], f["bien_entiers"], len(f["captures"])))
    for f in rapport["familles"]:
        for c in f["captures"]:
            L.append("  %s  <- %s a %.1f s, cadrage %.0f%s" % (os.path.relpath(c["fichier"], os.path.dirname(f["dossier"])), c["rush"], c["t"], c["cadrage"], "" if c["entier"] else " (PAS entier)"))
    for r in rapport.get("rushes_ecartes", []):
        L.append("  RUSH ECARTE : %s — il ne ressemble a aucun autre (plan sans le vetement)" % r)
    for k in rapport.get("familles_sans_capture", []):
        L.append("  SANS CAPTURE : couleur %d — gardee dans le compte, aucune photo cadree" % k)
    if rapport.get("deuxieme_passe", {}).get("tentee"):
        d2 = rapport["deuxieme_passe"]
        L.append("  DEUXIEME PASSE : %d -> %d famille(s), %s" % (d2["familles_avant"], d2["familles_apres"], "retenue" if d2["retenue"] else "pas retenue"))
    if rapport.get("invariant"):
        L.append("  INVARIANT : %s" % ("OK" if rapport["invariant"]["ok"] else "FAUX " + json.dumps(rapport["invariant"], ensure_ascii=False)[:300]))
    if rapport.get("ecart_nombre_dit"):
        L.append("  ECART AU NOMBRE DIT : %s" % rapport["ecart_nombre_dit"]["texte"])
    for r in rapport.get("rushes_illisibles", []):
        L.append("  RUSH ILLISIBLE : %s — ffmpeg ne le lit pas, aucune famille" % r)
    for r in rapport.get("rushes_sans_mesure", []):
        L.append("  RUSH SANS MESURE : %s — lu, mais aucun echantillon mesure : hors famille" % r)
    for r in rapport["retirees"]:
        L.append("  RETIREE : couleur %d, %s a %.1f s — %s" % (r["famille"], r["rush"], r["t"], r["raison"]))
    for m in rapport["manque"]:
        L.append("  MANQUE : couleur %d, %d voulue(s), %d obtenue(s)" % (m["famille"], m["voulues"], m["obtenues"]))
    L.append("  %.1f s" % rapport["secondes"])
    L.append(BARRE)
    return "\n".join(L)


# ---------------------------------------------------------------------------
# 5. L'AUTO-TEST — deux videos fabriquees ici : un mur gris, un vetement
#    de couleur en entier, puis un gros plan qui ne doit PAS etre choisi
# ---------------------------------------------------------------------------

def _essai(nom, cond, detail=""):
    print("  [%s] %s%s" % ("OK  " if cond else "FAUX", nom, ("  — " + str(detail)[:140]) if (detail and not cond) else ""))
    return bool(cond)


def _video_essai(dest, couleur_hex, gros_plan_a=None, duree=12, couche=False, etiquette=False, phase=0.0, taille=1.0):
    """Un mur gris, un « vetement » colore EN BAS de l'image droite (plan
    entier : le haut est du decor) et une « tete » sombre au-dessus ; a partir
    de gros_plan_a, le vetement remplit tout (gros plan). Le vetement BOUGE
    avec le temps (par overlay : drawbox n'anime pas ses expressions), sinon
    chaque image serait le doublon de la precedente. couche : la video est
    rangee en 1920x1080 et doit etre redressee par transpose=2 (le corps est
    donc A GAUCHE du cadre range). etiquette : rangee couchee MAIS avec
    l'etiquette de rotation — ffmpeg la sort droite tout seul."""
    w, h = (1920, 1080) if (couche or etiquette) else (1080, 1920)
    if couche or etiquette:
        # range couche : une fois redressee (transpose=2), la DROITE du cadre devient le HAUT
        cw, ch = int(w * 0.55), int(h * 0.32 * taille)
        corps = "overlay=x=W*0.05:y='H*0.34+H*0.15*sin(t+%s)'" % phase
        tw, th = int(w * 0.10), int(h * 0.16)
        tete = "overlay=x=W*0.78:y=H*0.42"
    else:
        cw, ch = int(w * 0.32 * taille), int(h * 0.55)
        corps = "overlay=x='W*0.34+W*0.15*sin(t+%s)':y=H*0.40" % phase
        tw, th = int(w * 0.16), int(h * 0.10)
        tete = "overlay=x=W*0.42:y=H*0.12"
    entrees = ["-f", "lavfi", "-i", "color=c=0x8a8a8a:s=%dx%d:d=%d:r=10" % (w, h, duree),
               "-f", "lavfi", "-i", "color=c=%s:s=%dx%d:d=%d:r=10" % (couleur_hex, cw, ch, duree),
               "-f", "lavfi", "-i", "color=c=0x303030:s=%dx%d:d=%d:r=10" % (tw, th, duree)]
    chaine = "[0][1]%s[a];[a][2]%s[b]" % (corps, tete)
    sortie_finale = "[b]"
    if gros_plan_a is not None:
        entrees += ["-f", "lavfi", "-i", "color=c=%s:s=%dx%d:d=%d:r=10" % (couleur_hex, w, h, duree)]
        chaine += ";[b][3]overlay=x=0:y=0:enable='gte(t,%s)'[c]" % gros_plan_a
        sortie_finale = "[c]"
    brut = dest + ".brut.mp4" if etiquette else dest
    r = lancer(["ffmpeg", "-v", "error"] + entrees + ["-filter_complex", chaine, "-map", sortie_finale,
                "-t", str(duree), "-pix_fmt", "yuv420p", brut, "-y"], 300)
    if r.returncode != 0:
        print("   ffmpeg : %s" % " ".join((r.stderr or "").split())[:300])
        return False
    if etiquette:
        r = lancer(["ffmpeg", "-v", "error", "-display_rotation", "90", "-i", brut, "-c", "copy", dest, "-y"], 300)
        try:
            os.remove(brut)
        except OSError:
            pass
        return r.returncode == 0 and os.path.isfile(dest)
    return os.path.isfile(dest)


def _droite(fichier):
    """Une photo est DROITE quand le haut est du mur gris et le bas est le
    vetement colore ; sur le cote, le vetement toucherait un bord lateral."""
    from PIL import Image
    import numpy as np
    a = np.asarray(Image.open(fichier).convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape
    haut = a[:int(h * 0.10), int(w * 0.3):int(w * 0.7)].reshape(-1, 3).mean(axis=0)
    bas = a[int(h * 0.88):, :].reshape(-1, 3)
    gris = abs(haut[0] - haut[1]) < 12 and abs(haut[1] - haut[2]) < 12
    saturation = bas.max(axis=1) - bas.min(axis=1)
    colore = float(np.percentile(saturation, 90)) > 60      # le vetement (qui bouge) est quelque part en bas
    return (w, h) == (1080, 1920) and gris and colore


def verifier():
    print(BARRE); print("  CONTROLES DES CAPTURES — version %s" % VERSION); print(BARRE)
    ok = True
    tmp = tempfile.mkdtemp(prefix="captures-essai-")
    try:
        rushes = os.path.join(tmp, "rushes"); os.makedirs(rushes)
        ok &= _essai("ffmpeg et ffprobe repondent", lancer(["ffmpeg", "-version"], 60).returncode == 0 and lancer(["ffprobe", "-version"], 60).returncode == 0)
        ok &= _essai("video rouge droite, plan entier puis gros plan", _video_essai(os.path.join(rushes, "a-rouge.mp4"), "0xc02020", gros_plan_a=5))
        ok &= _essai("video bleue couchee, plan entier", _video_essai(os.path.join(rushes, "b-bleu.mp4"), "0x2040c0", couche=True, duree=22))
        ok &= _essai("deuxieme video rouge, pour l'ecart entre rushes", _video_essai(os.path.join(rushes, "c-rouge2.mp4"), "0xc02020", phase=2.0, taille=0.85))
        ok &= _essai("video bleue rangee couchee AVEC l'etiquette de rotation", _video_essai(os.path.join(rushes, "d-bleu-etiquette.mp4"), "0x2040c0", etiquette=True, duree=14, phase=1.3, taille=0.85))
        shutil.copy(os.path.join(rushes, "c-rouge2.mp4"), os.path.join(rushes, "e-rouge2-copie.mp4"))   # le meme clip sous deux noms
        fiches = {f["nom"]: f for f in lire_rushes(rushes, os.path.join(tmp, "lecture"))}
        ok &= _essai("l'orientation se lit sur l'image decodee : la video etiquetee n'est PAS a redresser, la couchee l'est",
                     fiches["d-bleu-etiquette.mp4"]["couche"] is False and fiches["d-bleu-etiquette.mp4"]["etiquette_rotation"]
                     and fiches["b-bleu.mp4"]["couche"] is True, {k: (v["couche"], v["etiquette_rotation"]) for k, v in fiches.items()})
        sortie = os.path.join(tmp, "sortie")
        r = capturer(rushes, sortie, couleurs=2, combien=3, pas=1.0, travail=os.path.join(tmp, "travail"))
        print(vue(r))
        ok &= _essai("deux familles trouvees", len(r["familles"]) == 2, len(r["familles"]))
        rouge = max(r["familles"], key=lambda f: f["centre_rgb"][0]); bleu = min(r["familles"], key=lambda f: f["centre_rgb"][0])
        ok &= _essai("la famille rouge est rouge, la bleue est bleue",
                     rouge["centre_rgb"][0] > rouge["centre_rgb"][2] and bleu["centre_rgb"][2] > bleu["centre_rgb"][0], (rouge["centre_rgb"], bleu["centre_rgb"]))
        ok &= _essai("trois photos par couleur", all(len(f["captures"]) == 3 for f in r["familles"]), [len(f["captures"]) for f in r["familles"]])
        ok &= _essai("aucun gros plan choisi : toutes les photos sont entieres",
                     all(c["entier"] for f in r["familles"] for c in f["captures"]))
        ok &= _essai("un gros plan de tissu (le haut n'est pas du decor) n'est jamais pris",
                     all(c["decor_en_haut"] >= SEUIL_DECOR for f in r["familles"] for c in f["captures"])
                     and not any(c["rush"] == "a-rouge.mp4" and c["t"] >= 5.0 for f in r["familles"] for c in f["captures"]),
                     [(c["rush"], c["t"], c["decor_en_haut"]) for f in r["familles"] for c in f["captures"]])
        ok &= _essai("ni la premiere ni la derniere seconde d'un rush",
                     all(1.0 <= c["t"] for f in r["familles"] for c in f["captures"]))
        ok &= _essai("les photos rouges viennent des DEUX rushes rouges",
                     len({c["rush"] for c in rouge["captures"]}) == 2, {c["rush"] for c in rouge["captures"]})
        import hashlib
        empreintes_fichiers = [hashlib.md5(open(c["fichier"], "rb").read()).hexdigest() for f in r["familles"] for c in f["captures"]]
        ok &= _essai("le clip copie deux fois ne donne jamais deux fois la meme photo (doublon retire et nomme)",
                     len(set(empreintes_fichiers)) == len(empreintes_fichiers) and any("doublon" in x["raison"] for x in r["retirees"]),
                     (len(set(empreintes_fichiers)), len(empreintes_fichiers), r["retirees"]))
        # 12/10/2026 : un produit NOIR et BEIGE filme sous des lumieres differentes — un noir bleute, six noirs neutres
        # plus ou moins eclaires, trois beiges — « 2 » dit : la famille claire ne contient QUE les beiges (avant, avec la
        # teinte seule, les noirs neutres tombaient avec le beige)
        r2 = os.path.join(tmp, "rushes-nb"); os.makedirs(r2)
        NB = (("a-noir-bleute.mp4", "0x1c1f2f"), ("b-noir.mp4", "0x3d3a41"), ("c-noir.mp4", "0x464244"), ("d-noir.mp4", "0x4a4648"),
              ("e-noir.mp4", "0x4e4a4c"), ("f-noir.mp4", "0x524e50"), ("g-noir-eclaire.mp4", "0x635e5a"),
              ("h-beige.mp4", "0xaca688"), ("i-beige.mp4", "0xa49e88"), ("j-beige-sombre.mp4", "0x988e88"))
        for nom, hexa in NB:
            ok &= _essai("video %s" % nom, _video_essai(os.path.join(r2, nom), hexa))
        rb = capturer(r2, os.path.join(tmp, "sortie-nb"), couleurs=2, combien=2, pas=1.0, travail=os.path.join(tmp, "travail-nb"))
        claire = max(rb["familles"], key=lambda f_: sum(f_["centre_rgb"])) if rb["familles"] else {"rushes": []}
        ok &= _essai("noir et beige, deux dits : la famille claire ne contient que les beiges",
                     len(rb["familles"]) == 2 and set(claire["rushes"]) == {"h-beige.mp4", "i-beige.mp4", "j-beige-sombre.mp4"}, [sorted(f_["rushes"]) for f_ in rb["familles"]])
        ok &= _essai("les photos bleues viennent de la couchee ET de l'etiquetee",
                     {c["rush"] for c in bleu["captures"]} == {"b-bleu.mp4", "d-bleu-etiquette.mp4"}, {c["rush"] for c in bleu["captures"]})
        ok &= _essai("CHAQUE photo ecrite est DROITE (mur en haut, vetement en bas), l'etiquetee comprise",
                     all(_droite(c["fichier"]) for f in r["familles"] for c in f["captures"]),
                     [(c["rush"], _droite(c["fichier"])) for f in r["familles"] for c in f["captures"]])
        ok &= _essai("deux photos du meme rush sont a six secondes au moins, ou de rushes differents",
                     all(a["rush"] != b["rush"] or abs(a["t"] - b["t"]) >= ECART_MINI_S
                         for f in r["familles"] for a in f["captures"] for b in f["captures"] if a is not b))
        from PIL import Image
        tailles = [Image.open(c["fichier"]).size for f in r["familles"] for c in f["captures"]]
        ok &= _essai("chaque photo ecrite s'ouvre et est DROITE en pleine taille (1080x1920), la couchee comprise",
                     tailles and all(t == (1080, 1920) for t in tailles), tailles)
        ok &= _essai("le rapport est ecrit et relisible", os.path.isfile(os.path.join(sortie, "_rapport.json"))
                     and json.load(io.open(os.path.join(sortie, "_rapport.json"), encoding="utf-8"))["familles"])
        ok &= _essai("rien qui manque, et rien de retire hors le doublon", not r["manque"] and all("doublon" in x["raison"] for x in r["retirees"]), (r["retirees"], r["manque"]))
        # une video illisible est ecartee et nommee, pas plantee
        with io.open(os.path.join(rushes, "d-casse.mp4"), "w") as f:
            f.write("pas une video")
        ok &= _essai("une video illisible est ecartee, le reste continue",
                     len(lire_rushes(rushes, os.path.join(tmp, "lecture2"))) == 5)
        vide = os.path.join(tmp, "vide"); os.makedirs(vide)
        with io.open(os.path.join(vide, "x.mp4"), "w") as f:
            f.write("rien")
        rv = capturer(vide, os.path.join(tmp, "sortie-vide"), couleurs=2, combien=2, pas=1.0, travail=os.path.join(tmp, "t2"))
        ok &= _essai("zero echantillon n'est jamais un succes : le manque est nomme", not rv["familles"] and len(rv["manque"]) == 2)
        # les couleurs du 20/09 : noir, marron sombre, gris froid, beige — chacune sa famille
        mesurees = [("noir-a", (48, 43, 43)), ("noir-b", (52, 47, 46)), ("marron-int", (62, 50, 45)),
                    ("marron-ext", (76, 62, 56)), ("gris-a", (110, 121, 122)), ("gris-b", (95, 99, 101)),
                    ("beige-int", (128, 118, 110)), ("beige-ext", (176, 162, 150)), ("piscine", (89, 154, 166))]
        pts = [{"rush": nom, "t": 1.0, "couleur": c, "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0} for nom, c in mesurees]
        fq, ecartes = familles_par_rush(pts, None, 5)
        groupes = sorted(sorted(m["rush"].split("-")[0] for m in g["membres"]) for g in fq)
        ok &= _essai("noir / marron / gris / beige + une couleur filmee UNE fois : cinq familles dites, la lumiere du lieu ne les melange pas, "
                     "la couleur filmee une fois est une famille a elle seule (rien d'ecarte)",
                     groupes == [["beige", "beige"], ["gris", "gris"], ["marron", "marron"], ["noir", "noir"], ["piscine"]] and ecartes == [], (groupes, ecartes))
        fq4, ecartes4 = familles_par_rush(pts, None, 4)
        ok &= _essai("quatre dites pour cinq filmees : quatre familles, AUCUN rush jete (les neuf sont dans une famille)",
                     len(fq4) == 4 and sum(len(g["membres"]) for g in fq4) == 9 and ecartes4 == [], (len(fq4), ecartes4))
        # le cas reel du 20/09 (essai 6) : quatre noirs, six marrons, cinq gris, six beiges d'interieur, trois d'exterieur
        reel = ([("noir-%d" % i, c) for i, c in enumerate([(48, 43, 43), (52, 47, 46), (45, 42, 42), (50, 44, 44)])]
                + [("marron-%d" % i, c) for i, c in enumerate([(56, 45, 41), (60, 48, 43), (62, 50, 45), (58, 47, 42), (70, 57, 51), (76, 62, 56)])]
                + [("gris-%d" % i, c) for i, c in enumerate([(110, 121, 122), (95, 99, 101), (105, 112, 114), (100, 106, 108), (118, 126, 128)])]
                + [("beige-%d" % i, c) for i, c in enumerate([(162, 152, 141), (158, 148, 137), (165, 155, 144), (160, 150, 139), (170, 158, 146), (166, 156, 145)])]
                + [("beige-x%d" % i, c) for i, c in enumerate([(193, 172, 156), (190, 170, 154), (196, 175, 158)])]
                + [("piscine", (89, 154, 166))])
        pts = [{"rush": nom, "t": 1.0, "couleur": c, "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0} for nom, c in reel]
        fq, ecartes = familles_par_rush(pts, None, 5)
        tailles = sorted((sorted({m["rush"].split("-")[0] for m in g["membres"]}), len(g["membres"])) for g in fq)
        ok &= _essai("le cas reel : quatre, six, cinq et neuf rushes — le beige entier, le noir et le gris separes, le rush seul garde",
                     tailles == [(["beige"], 9), (["gris"], 5), (["marron"], 6), (["noir"], 4), (["piscine"], 1)] and ecartes == [], (tailles, ecartes))
        fq0, ecartes0 = familles_par_rush(pts, None, 0)
        ok &= _essai("sans le nombre de couleurs, l'outil compte CINQ (le rush seul compte pour une couleur, rien d'ecarte)",
                     len(fq0) == 5 and ecartes0 == [], (len(fq0), ecartes0))
        deux = [{"rush": nom, "t": 1.0, "couleur": c, "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0}
                for nom, c in [("n1", (48, 43, 43)), ("n2", (52, 47, 46)), ("b1", (162, 152, 141)), ("b2", (176, 162, 150))]]
        ok &= _essai("deux couleurs seulement : il en compte deux", len(familles_par_rush(deux, None, 0)[0]) == 2)
        # LA DEUXIEME PASSE (09/10/2026) : trois rushes, quatre couleurs DITES — le rush X porte le rouge puis le bleu (six
        # secondes chacun), Y le vert avec un eclair blanc de deux secondes (fondu, jamais jete), Z le jaune
        def pt(r, t, c):
            return {"rush": r, "t": float(t), "couleur": c, "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0}
        inst = ([pt("X", t, (192, 32, 32)) for t in range(0, 6)] + [pt("X", t, (32, 64, 192)) for t in range(6, 12)]
                + [pt("Y", t, (240, 240, 240) if t in (5, 6) else (40, 140, 60)) for t in range(0, 12)]
                + [pt("Z", t, (220, 190, 40)) for t in range(0, 12)])
        f1, _ = familles_par_rush(inst, None, 4)
        f2 = familles_par_instant(inst, 4, 1.0)
        ok &= _essai("deuxieme passe : 3 familles par rush pour 4 dites -> 4 par instant (rouge et bleu du meme rush separes, l'eclair "
                     "de 2 s fondu dans le vert), chaque echantillon dans UNE famille, chaque famille a ses rushes et ses troncons",
                     len(f1) == 3 and len(f2) == 4 and sum(len(g["points"]) for g in f2) == len(inst)
                     and len({id(p) for g in f2 for p in g["points"]}) == len(inst)
                     and sorted(len(g["points"]) for g in f2) == [6, 6, 12, 12]
                     and all(g["rushes"] and g["segments"] for g in f2),
                     (len(f1), len(f2), [(len(g["points"]), g["rushes"], g["segments"]) for g in f2]))
        # le cas du 20/09 : une famille dont TOUTES les photos sont retirees n'est pas une couleur
        rushes2 = os.path.join(tmp, "rushes-meme-tenue"); os.makedirs(rushes2)
        ok &= _essai("deux videos de la MEME tenue (rouge), lumiere differente",
                     _video_essai(os.path.join(rushes2, "a.mp4"), "0xc02020", duree=10)
                     and _video_essai(os.path.join(rushes2, "b.mp4"), "0xd83030", duree=10, phase=2.0, taille=0.85))
        rs = capturer(rushes2, os.path.join(tmp, "sortie-meme-tenue"), couleurs=2, combien=3, pas=1.0, travail=os.path.join(tmp, "t3"))
        ok &= _essai("en forcant deux couleurs sur une seule tenue : une famille sans photo RESTE dans le compte, marquee "
                     "« sans_capture » (09/10/2026), l'invariant tient (brutes = avec photo + sans photo, zero orpheline, zero double)",
                     rs["couleurs_trouvees"] == len(rs["familles"]) == 2 and all(bool(f["captures"]) != bool(f.get("sans_capture")) for f in rs["familles"])
                     and rs["invariant"]["ok"] and rs["invariant"]["familles_brutes"] == rs["invariant"]["avec_photo"] + rs["invariant"]["sans_photo"]
                     and sorted(x for x in os.listdir(os.path.join(tmp, "sortie-meme-tenue")) if x.startswith("couleur-")) == ["couleur-1", "couleur-2"],
                     (rs["couleurs_trouvees"], [len(f["captures"]) for f in rs["familles"]], rs.get("familles_sans_capture"), rs["invariant"]))
        # une candidate retiree est remplacee par la suivante, jamais un trou
        fam = {"centre": (0, 0, 0), "points": [{"rush": "r%d" % i, "t": 1.0, "couleur": (i, 0, 0), "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0} for i in range(6)]}
        vus = []
        pris = choisir(fam, 3, garder=lambda p: (vus.append(p["rush"]) or (True if p["rush"] != "r1" else "couleur")))
        ok &= _essai("une photo retiree est remplacee par la candidate suivante",
                     [p["rush"] for p in pris] == ["r0", "r2", "r3"] and vus == ["r0", "r1", "r2", "r3"], ([p["rush"] for p in pris], vus))
        ok &= _essai("les essais s'arretent : au plus quatre par photo voulue",
                     len(choisir({"centre": (0, 0, 0), "points": [{"rush": "r%d" % i, "t": 1.0, "couleur": (0, 0, 0), "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0} for i in range(40)]},
                                 2, garder=lambda p: "couleur")) == 0)
        # un clip copie deux fois : apres UN doublon, on ne revient plus sur ce rush
        vus = []
        fam2 = {"centre": (0, 0, 0), "points": [{"rush": "orig", "t": float(t), "couleur": (0, 0, 0), "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0} for t in range(1, 30, 2)]
                                              + [{"rush": "copie", "t": float(t), "couleur": (0, 0, 0), "cadrage": 0.0, "cadrage_brut": 0.0, "decor": 99.0} for t in range(1, 30, 2)]}
        pris = choisir(fam2, 3, garder=lambda p: (vus.append(p["rush"]) or (True if p["rush"] == "orig" else "doublon d'une photo deja gardee")))
        ok &= _essai("un clip copie deux fois : un seul essai sur la copie, puis on n'y revient plus",
                     [p["rush"] for p in pris] == ["orig"] * 3 and vus.count("copie") == 1, ([p["rush"] for p in pris], vus))
        # une prise COURTE (14 s, une couleur) : a six secondes d'ecart, deux photos au plus ; --ecart 2 en donne plus,
        # toujours a deux secondes au moins l'une de l'autre (07/10/2026 : un modele de lot en prises courtes)
        rushes3 = os.path.join(tmp, "rushes-courts"); os.makedirs(rushes3)
        ok &= _essai("une prise courte de 14 s", _video_essai(os.path.join(rushes3, "court.mp4"), "0x2040c0", duree=14, phase=0.7))
        r6 = capturer(rushes3, os.path.join(tmp, "sortie-court-6"), couleurs=1, combien=8, pas=1.0, travail=os.path.join(tmp, "t4"))
        r2 = capturer(rushes3, os.path.join(tmp, "sortie-court-2"), couleurs=1, combien=8, pas=1.0, travail=os.path.join(tmp, "t5"), ecart_s=2.0)
        n6 = sum(len(f["captures"]) for f in r6["familles"]); n2 = sum(len(f["captures"]) for f in r2["familles"])
        ok &= _essai("prise de 14 s : deux photos au plus a six secondes, quatre au moins avec --ecart 2 (ecart tenu, ecrit au rapport)",
                     n6 <= 2 and n2 >= 4 and r2["ecart_secondes"] == 2.0 and r6["ecart_secondes"] == ECART_MINI_S
                     and all(abs(a["t"] - b["t"]) >= 2.0 for f in r2["familles"] for a in f["captures"] for b in f["captures"] if a is not b),
                     (n6, n2, [c["t"] for f in r2["familles"] for c in f["captures"]]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(BARRE); print("  TOUT EST BON." if ok else "  IL Y A UNE FAUTE — on ne livre pas."); print(BARRE)
    return 0 if ok else 1


def main():
    p = argparse.ArgumentParser(description="des photos tirees des videos, quatre par couleur")
    p.add_argument("--rushes", help="le dossier des videos")
    p.add_argument("--sortie", help="ou ecrire les photos")
    p.add_argument("--couleurs", default="auto", help="combien de couleurs a le produit (le NOMBRE DIT par le client) ; « auto » (defaut, rien de dit) : l'outil compte")
    p.add_argument("--combien", type=int, default=4, help="photos par couleur (defaut 4)")
    p.add_argument("--pas", type=float, default=2.0, help="secondes entre deux echantillons (defaut 2)")
    p.add_argument("--ecart", type=float, default=ECART_MINI_S, help="secondes au moins entre deux photos du meme rush (defaut 6)")
    p.add_argument("--verifier", action="store_true")
    a = p.parse_args()
    if a.verifier:
        return verifier()
    if not (a.rushes and a.sortie):
        p.print_help(); return 2
    if not os.path.isdir(a.rushes):
        print("dossier introuvable : %s" % a.rushes); return 2
    couleurs = 0 if str(a.couleurs).strip().lower() in ("auto", "0") else int(a.couleurs)
    if not (0 <= couleurs <= 8 and 1 <= a.combien <= 8 and 0.5 <= a.pas <= 30 and 0.5 <= a.ecart <= 30):
        print("bornes : couleurs 1-8 ou auto, combien 1-8, pas 0.5-30, ecart 0.5-30"); return 2
    r = capturer(a.rushes, a.sortie, couleurs, a.combien, a.pas, ecart_s=a.ecart)
    print("--couleurs-trouvees %d" % r["couleurs_trouvees"])
    print(vue(r))
    # PARTIEL n'est PAS un echec : des qu'une couleur a des photos, c'est un
    # livrable ; ce qui manque ou a ete retire est NOMME dans _rapport.json et
    # c'est le manager qui decide (accepter 3 sur 4, ou completer). On ne rend
    # non-zero que si RIEN n'est sorti (aucune couleur) : la vraie panne.
    return 0 if r["couleurs_trouvees"] else 1


if __name__ == "__main__":
    sys.exit(main())
