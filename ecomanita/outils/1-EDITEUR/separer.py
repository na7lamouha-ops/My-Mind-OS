# -*- coding: utf-8 -*-
"""
MANITA — SEPARER LES MODELES D'UN LIEN DRIVE (un lien = plusieurs modeles).

  python3 separer.py --candidats --rushes <dossier> --sortie <lot> --modeles N [--fin]
  python3 separer.py --planches  --plan <plan.json> --sortie <dossier>
  python3 separer.py --construire --plan <plan.json> --sortie <lot>/modeles
  python3 separer.py --verifier          l'auto-test, sur des videos fabriquees ici

CET OUTIL PROPOSE, IL NE DECIDE PAS. Les pixels savent dire OU une video
change de tenue. Ils ne savent pas dire que deux videos montrent le MEME
vetement : la meme couleur ne fait pas le meme modele (deux abayas noires),
et un modele se montre en plusieurs couleurs. Ce qui decide : la lecture des
planches (Claude), puis la confirmation du client sur Telegram.

1. --candidats : chaque video (sous-dossiers compris) est lue sur TOUTE sa
   duree, une image toutes les 0,4 s sur un clip court (au plus 3 s sur une
   longue prise). Elle est coupee en TRONCONS de tenue : la couleur du buste
   saute ET reste changee. Rien n'est jete en silence : un morceau trop court
   est recolle a son voisin ; un plan sans personne ou une image noire est
   ECARTE, nomme, et montre sur sa planche.
   Un GROUPE CANDIDAT = une video ; ou un morceau de video quand sa STRUCTURE
   (forme, coupe, motif — jamais la couleur) change pour de bon ; ou tout un
   sous-dossier (un sous-dossier qui contient des videos = indice fort d'un
   modele). Deux videos ne sont JAMAIS collees sur la seule couleur.
   Pour la cible N, une PROPOSITION de fusion est donnee a part : a verifier.
   « estimes » (08/10/2026) : le nombre de modeles que la STRUCTURE distingue
   (jamais la couleur ; deux sous-dossiers ne se rejoignent jamais). Le
   bureau le lit aussi pour N = 1 : un seul -> une mission ; plus -> lot.
   --fin : relance plus fine (avant la 2e lecture, si un groupe est douteux).
   La cible N reste dans candidats.json : elle n'est JAMAIS ecrite sur une
   planche (celui qui lit les planches ne doit pas se caler sur N).
   Ecrit <lot>/candidats.json et <lot>/planches/*.jpg (G1.jpg, G2.jpg ...).
2. --planches : une planche par modele d'un plan (la photo de confirmation).
3. --construire : un dossier PLAT par modele (modele-1, modele-2 ...).
   Fichier entier -> lien dur (sinon copie) ; troncon -> coupe REENCODEE
   H.264/AAC, l'image garde son sens. Chaque fichier ecrit est RELU. Un plan
   qui donne le meme instant d'un rush a deux modeles est REFUSE, rien n'est
   ecrit. Ecrit aussi index.json et plan-modeles.json (lisible par MONTER-10).

Avec MANITA_JSON=1, une ligne « MANITA_JSON {...} » pour le bureau.
"""
import argparse
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata

VERSION = "1.0"
BARRE = "=" * 62
EXTENSIONS = (".mp4", ".mov", ".m4v", ".avi", ".mkv")   # ce que compte le bureau
EXT_MONTAGE = (".mp4", ".mov", ".m4v")                  # ce que lisent captures.py et MONTER-10
MOITIES = ("videos", "video", "photos", "photo", "images", "image", "clips", "rushes")
MARQUE = "separer-construire"   # un dossier qui porte notre index.json n'est pas un rush
TEMOIN = ".separer-construire"  # pose AVANT la premiere ecriture : une sortie coupee en route reste la notre

# ------------------------------------------------------------------ lecture
PAS_MINI = 0.4          # un clip court : une image toutes les 0,4 s
PAS_MAX = 3.0           # une longue prise : au plus 3 s entre deux images
IMAGES_VISEES = 150     # pas = duree / 150, borne entre les deux
LARGEUR = 200           # l'apercu sur lequel on mesure
BATTEMENT_S = 60        # pendant une longue lecture, une ligne par minute (le bureau arrete un outil muet)
LECTURE_MAX_S = 3600    # une seule video lue plus d'une heure : abandonnee (dite illisible)

# --------------------------------------------- couleur (mesure buste / fond)
PLANCHER = 60.0         # sous cette lumiere, on ne divise plus (un sombre n'affole pas la teinte)
POIDS_CHAUD = 3.0       # poids de la teinte a cote de la lumiere
SAUT_TENUE = 0.75       # au-dela, c'est une autre couleur de tenue
CONFIRME = 2            # deux images de suite pour croire a un changement
RAYON_COULEUR = 0.75    # deux morceaux voisins sous ce rayon : la meme couleur
RAYON_MEME = 0.20       # « exactement la meme couleur » d'une video a l'autre
SEUIL_SUJET = 0.25      # le buste doit differer d'au moins un cote de l'image, sinon personne
PLAT_MINI = 6.0         # une image plate (noir, fondu) ne mesure rien
TRONCON_MINI_S = 1.2    # un morceau plus court est recolle a son voisin

# ------------------------------------------------ structure (sans couleur)
POIDS_SENS = 4.0        # le sens des bords (vertical, horizontal, oblique)
POIDS_DESSIN = 0.35     # ou sont les bords (grille 6 x 12)
SECTION_MINI_S = 3.0    # une video n'est coupee en deux modeles que si
SECTION_MINI_IMAGES = 4  # chaque cote dure au moins 3 s et 4 images
VOISINS_S = 1.0         # deux images a moins d'1 s sont presque la meme : on ne les compare pas
SEUIL_SCISSION = 2.0    # ecart croise / dispersion ordinaire au-dela duquel c'est un autre modele.
                        # Bas expres : une coupe ratee melange deux modeles, une coupe de trop
                        # ne coute qu'une planche de plus.
IMAGES_GROUPE = 80      # images par groupe pour la proposition
POINTS_STRUCTURE = 200  # au plus 200 images par video pour chercher ou elle change de modele
FACTEUR_COULEUR = 0.85  # une couleur exactement partagee rapproche un peu, jamais seule
PENALITE_DOSSIER = 10.0  # deux sous-dossiers differents ne fusionnent qu'en dernier
SEUIL_ESTIME = 1.5      # ESTIMER (08/10/2026) : deux groupes dont l'ecart de STRUCTURE (forme,
                        # coupe — jamais la couleur) reste sous ce seuil sont comptes comme UN
                        # modele ; deux sous-dossiers ne se rejoignent jamais. C'est le nombre de
                        # modeles que les pixels distinguent : le bureau ne croit plus « N = 1 »
                        # sur parole (un seul -> le chemin d'un modele ; plus -> lecture des planches)
# --fin (08/10/2026) : relance PLUS FINE quand un groupe est douteux (le bureau, avant la 2e lecture
# des planches) : une video se coupe plus facilement en deux modeles
FIN_SEUIL_SCISSION = 1.5
FIN_SECTION_MINI_S = 2.0
FIN_SECTION_MINI_IMAGES = 3

# ------------------------------------------------------------------ planches
HAUT_VIGNETTE = 360
COLONNES = 3
CARTES_PAR_PAGE = 12
CARTES_CLIENT = 9       # la planche d'un modele pour le client : une seule image
FILM = 12               # la video entiere, en douze images, sur la planche de son groupe
TRONCON_LONG_S = 10.0   # IMPURETES (09/10/2026) : un troncon plus long a AUSSI son film de douze images
                        # (chaque image avec sa seconde) : son debut et sa fin se jugent (piscine, fin floue)

# --------------------------------------------------------------- construction
TOL_ENTIER = 0.25       # un segment a moins de 0,25 s des deux bouts = le fichier entier
TOL_FIN = 1.0           # une fin qui depasse la video de moins d'1 s est ramenee a la fin
CHEVAUCHE_TOLERE = 0.35  # deux modeles qui se disputent au plus 0,35 s (le bureau en tolere 0,3) : retire aux deux
SEGMENT_MINI = 0.5      # un segment plus court n'est pas coupe (et c'est dit)
ECART_RELU_MAX = 24.0   # image relue contre sa source (sur 255)


# ======================================================================
# 0. OUTILS
# ======================================================================

def lancer(cmd, minuteur=900, binaire=False):
    texte = {} if binaire else {"text": True, "encoding": "utf-8", "errors": "replace"}
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          stdin=subprocess.DEVNULL, timeout=minuteur, **texte)


def erreur(r):
    e = r.stderr if isinstance(r.stderr, str) else (r.stderr or b"").decode("utf-8", "replace")
    return " ".join((e or "").split())[:200]


def sortie_json(quoi, donnees):
    """Pour le bureau : quand MANITA_JSON vaut 1, une ligne « MANITA_JSON {...} ».
    En ASCII (\\uXXXX) : une console Windows non UTF-8 ne la casse pas, et le JSON relu est le meme."""
    if os.environ.get("MANITA_JSON") != "1":
        return
    d = dict(donnees)
    d["quoi"] = quoi
    print("MANITA_JSON " + json.dumps(d, ensure_ascii=True, default=float))


def ecrire_json(chemin, donnees):
    """Ecrit d'un coup (fichier temporaire puis renommage) : un PC coupe ne laisse jamais un JSON a moitie."""
    tmp = chemin + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        f.write(json.dumps(donnees, ensure_ascii=False, indent=1))
    os.replace(tmp, chemin)
    return chemin


def sonde(f):
    """duree, image, son — par ffprobe, jamais devine."""
    r = lancer(["ffprobe", "-v", "error", "-show_entries",
                "stream=codec_type,codec_name,width,height,avg_frame_rate:format=duration",
                "-of", "json", f], 120)
    if r.returncode != 0:
        return None
    try:
        d = json.loads(r.stdout or "{}")
    except ValueError:
        return None
    flux = d.get("streams") or []
    v = next((s for s in flux if s.get("codec_type") == "video"), None)
    a = next((s for s in flux if s.get("codec_type") == "audio"), None)
    if not v:
        return None
    try:
        duree = float((d.get("format") or {}).get("duration") or 0)
    except ValueError:
        duree = 0.0
    fps = 25.0
    try:
        n, q = (v.get("avg_frame_rate") or "0/1").split("/")
        fps = float(n) / float(q) if float(q) else 25.0
    except (ValueError, ZeroDivisionError):
        pass
    if not (0 < fps <= 240):
        fps = 25.0
    return {"duree": duree, "largeur": int(v.get("width") or 0), "hauteur": int(v.get("height") or 0),
            "codec": v.get("codec_name"), "audio": a.get("codec_name") if a else None, "fps": fps}


def image_decodee(f, t, couche=False, hauteur=0):
    """Une image DECODEE (donc deja tournee si la camera l'a dit), en memoire."""
    from PIL import Image
    vf = (["transpose=2"] if couche else []) + (["scale=-2:%d" % hauteur] if hauteur else [])
    for essai in (t, t - 0.4, t - 1.5):
        cmd = ["ffmpeg", "-v", "error", "-ss", "%.3f" % max(0.0, essai), "-i", f, "-frames:v", "1"]
        if vf:
            cmd += ["-vf", ",".join(vf)]
        r = lancer(cmd + ["-f", "image2pipe", "-vcodec", "png", "-"], 300, binaire=True)
        if r.returncode == 0 and r.stdout:
            try:
                return Image.open(io.BytesIO(r.stdout)).convert("RGB")
            except Exception:
                pass
        if essai <= 0:
            break
    return None


def latin(s):
    """Lettres latines seulement : les planches et les noms de fichier restent lisibles partout."""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return " ".join(s.split())


def nom_sur(rel):
    base = os.path.splitext(str(rel).replace("\\", "/"))[0].replace("/", "-")
    s = re.sub(r"[^A-Za-z0-9-]+", "-", latin(base))
    return re.sub(r"-+", "-", s).strip("-_.")[:60] or "rush"


def est_sortie(d):
    """Un dossier ecrit par --construire (son index.json porte la marque, ou son temoin)."""
    if os.path.isfile(os.path.join(d, TEMOIN)):
        return True
    p = os.path.join(d, "index.json")
    if not os.path.isfile(p):
        return False
    try:
        return json.load(io.open(p, encoding="utf-8")).get("quoi") == MARQUE
    except Exception:
        return False


def lister_videos(racine):
    """Les videos, sous-dossiers compris — memes regles que le bureau : un nom
    qui commence par . ou _ est ignore. Nos propres sorties ne sont pas des rushes."""
    out = []
    racine = os.path.abspath(racine)
    for d, sous, fichiers in os.walk(racine):
        sous[:] = sorted(x for x in sous
                         if not x.startswith((".", "_")) and not est_sortie(os.path.join(d, x)))
        for n in sorted(fichiers):
            if n.startswith((".", "_")) or not n.lower().endswith(EXTENSIONS):
                continue
            out.append(os.path.relpath(os.path.join(d, n), racine).replace(os.sep, "/"))
    return sorted(out)


def dossier_modele(rel):
    """Le sous-dossier qui porte la video ; « Videos » / « Photos » sont deux moities du meme."""
    parts = rel.split("/")[:-1]
    while parts and latin(parts[-1]).strip().lower() in MOITIES:
        parts.pop()
    return "/".join(parts)


def dossiers_modeles(rels):
    """{rel: sous-dossier}. Un dossier qui enveloppe TOUTES les videos (« Shooting octobre/ »)
    ne dit rien des modeles : on l'enleve, sinon tout le lien ferait un seul groupe."""
    ds = {r: dossier_modele(r) for r in rels}
    parts = [d.split("/") if d else [] for d in ds.values()]
    commun = 0
    while parts and all(len(p) > commun and p[commun] == parts[0][commun] for p in parts):
        commun += 1
    return {r: "/".join(d.split("/")[commun:]) if d else "" for r, d in ds.items()}


def mediane(valeurs):
    v = sorted(valeurs)
    n = len(v)
    if not n:
        return 0.0
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2.0


def mediane_couleur(couleurs):
    if not couleurs:
        return (0.0, 0.0, 0.0)
    return tuple(mediane([c[i] for c in couleurs]) for i in range(3))


def vecteur(couleur):
    """La lumiere en LOGARITHME (deux eclairages du meme noir se rapprochent),
    la teinte divisee par un PLANCHER (un sombre ne l'affole pas)."""
    r, g, b = couleur
    L = (float(r) + float(g) + float(b)) / 3.0
    d = max(L, PLANCHER)
    return (math.log(max(L, 1.0)),
            POIDS_CHAUD * (float(r) - float(g)) / d,
            POIDS_CHAUD * (float(g) - float(b)) / d)


def ecart(c1, c2):
    return math.dist(vecteur(c1), vecteur(c2))


# ======================================================================
# 1. LES MESURES — une image : la couleur du buste, le sujet, la structure
# ======================================================================

def forme(g):
    """La STRUCTURE du vetement, sans sa couleur : ou sont les bords
    (silhouette, cassure, rayures, boutons) et dans quel sens ils vont. Les
    bords sont ramenes a leur propre echelle : le meme vetement en noir et en
    beige donne le meme dessin."""
    import numpy as np
    gy, gx = np.gradient(g)
    mag = np.hypot(gx, gy)
    m = np.minimum(mag / (float(np.percentile(mag, 90)) + 1e-6), 1.0)
    sens = (np.mod(np.arctan2(gy, gx), np.pi) / np.pi * 8).astype(int) % 8
    hh, ww = g.shape
    v = []
    for z in range(3):                       # haut, milieu, bas
        sl = slice(int(z * hh / 3), int((z + 1) * hh / 3))
        b = np.bincount(sens[sl].ravel(), weights=m[sl].ravel(), minlength=8)
        v.extend(b / (b.sum() + 1e-6) * POIDS_SENS)
    ys = np.linspace(0, hh, 13).astype(int)
    xs = np.linspace(0, ww, 7).astype(int)
    grille = np.array([[m[ys[i]:ys[i + 1], xs[j]:xs[j + 1]].mean() for j in range(6)] for i in range(12)])
    v.extend((grille / (grille.mean() + 1e-6)).ravel() * POIDS_DESSIN)
    return np.array(v, dtype=np.float32)


def mesurer(a):
    import numpy as np
    a = a.astype(np.float32)
    h, w, _ = a.shape
    # le vetement : le buste et la jupe, jamais la tete ni le sol
    corps = a[int(h * .35):int(h * .90), int(w * .30):int(w * .70)]
    couleur = tuple(float(x) for x in np.median(corps.reshape(-1, 3), axis=0))
    bord = np.concatenate([a[:int(h * .08)].reshape(-1, 3), a[int(h * .92):].reshape(-1, 3),
                           a[:, :int(w * .08)].reshape(-1, 3), a[:, int(w * .92):].reshape(-1, 3)])
    fond = tuple(float(x) for x in np.median(bord, axis=0))
    # Y A-T-IL QUELQU'UN ? A hauteur du corps, le buste doit differer d'au
    # moins UN cote : une piscine, un mur, un paysage ont la meme couleur au
    # centre et sur les deux cotes ; une femme decalee a droite, non. Le fond
    # entier ne suffit pas (les arbres du haut le rendent different d'une eau vide).
    y0, y1 = int(h * .35), int(h * .90)
    gauche = tuple(np.median(a[y0:y1, :max(1, int(w * .12))].reshape(-1, 3), axis=0))
    droite = tuple(np.median(a[y0:y1, int(w * .88):].reshape(-1, 3), axis=0))
    gris = a.mean(axis=2)
    return {"couleur": couleur, "contraste": ecart(couleur, fond),
            "cotes": max(ecart(couleur, gauche), ecart(couleur, droite)),
            "plat": float(gris.std()) < PLAT_MINI,
            "forme": forme(gris[int(h * .18):int(h * .95), int(w * .20):int(w * .80)])}


def a_un_sujet(m):
    return m["cotes"] >= SEUIL_SUJET


def lire_serie(f, pas, couche, travail, film=None):
    """UNE SEULE passe ffmpeg pour toute la video. Pas de -vsync (l'option a
    disparu des ffmpeg recents) : le filtre fps suffit. `film` (une liste)
    recoit FILM images reparties de la premiere a la derniere, pour la planche."""
    from PIL import Image
    import numpy as np
    rep = tempfile.mkdtemp(prefix="im_", dir=travail)
    vf = ("transpose=2," if couche else "") + "fps=1/%.4f,scale=%d:-2" % (pas, LARGEUR)
    cmd = ["ffmpeg", "-v", "error", "-i", f, "-vf", vf, os.path.join(rep, "%05d.png")]
    # une longue prise 4K sur un PC lent : on dit ou on en est chaque minute (le bureau arrete
    # un outil muet trop longtemps), et on abandonne apres une heure
    debut, journal = time.time(), rep + ".txt"
    with open(journal, "wb") as fe:
        p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=fe, stdin=subprocess.DEVNULL)
        while True:
            try:
                p.wait(timeout=BATTEMENT_S)
                break
            except subprocess.TimeoutExpired:
                if time.time() - debut > LECTURE_MAX_S:
                    p.kill()
                    p.wait()
                    raise subprocess.TimeoutExpired(cmd, LECTURE_MAX_S)
                print("      ... lecture en cours : %d image(s) en %.0f s" % (len(os.listdir(rep)), time.time() - debut))
    with open(journal, "rb") as fe:
        r = subprocess.CompletedProcess(cmd, p.returncode, b"", fe.read())
    noms = sorted(os.listdir(rep))
    garder = set(np.linspace(0, len(noms) - 1, min(FILM, len(noms))).round().astype(int).tolist()) if noms else set()
    serie = []
    for i, n in enumerate(noms):
        try:
            im = Image.open(os.path.join(rep, n)).convert("RGB")
            a = np.asarray(im)
        except Exception:
            continue
        if a.shape[0] < 40 or a.shape[1] < 30:
            continue
        m = mesurer(a)
        m["t"] = round(i * pas, 3)
        serie.append(m)
        if film is not None and i in garder:
            film.append((m["t"], im))
    shutil.rmtree(rep, ignore_errors=True)
    if not serie and r.returncode != 0:
        raise RuntimeError("ffmpeg : %s" % erreur(r))
    return serie


def mosaique(film, hauteur=HAUT_VIGNETTE):
    """La video ENTIERE en deux rangs de six images, chacune avec sa seconde."""
    from PIL import Image, ImageDraw
    if not film:
        return vide(hauteur)
    h = (hauteur - 6) // 2
    ims = [im.resize((max(1, int(im.size[0] * h / float(im.size[1]))), h)) for _t, im in film]
    w = max(im.size[0] for im in ims)
    col = (len(ims) + 1) // 2
    M = Image.new("RGB", (col * w + (col - 1) * 6, hauteur), (255, 255, 255))
    d = ImageDraw.Draw(M)
    P = police(15)
    for k, ((t, _), im) in enumerate(zip(film, ims)):
        x, y = (k % col) * (w + 6), (k // col) * (h + 6)
        M.paste(im, (x, y))
        lab = "%.1f s" % t
        d.rectangle([x, y, x + d.textlength(lab, font=P) + 6, y + 18], fill=(255, 255, 255))
        d.text((x + 3, y + 1), lab, fill=(0, 0, 0), font=P)
    return M


# ======================================================================
# 2. LE DECOUPAGE — ou la video change de modele, puis de couleur
# ======================================================================

def distances(X):
    import numpy as np
    X = np.asarray(X, dtype=np.float64)
    sq = (X * X).sum(1)
    return np.sqrt(np.maximum(sq[:, None] + sq[None, :] - 2.0 * X @ X.T, 0.0))


def sections(serie, pas):
    """OU UNE VIDEO CHANGE DE MODELE. Coupe binaire sur la STRUCTURE seule :
    a chaque endroit possible, on compare l'ecart croise (chaque image d'un
    cote contre la plus proche de l'autre cote) a la dispersion ordinaire de
    chaque cote. Le meme vetement dans une autre couleur ou une autre pose
    retrouve son voisin : l'indice reste pres de 1. Un autre vetement non.
    Rend (indices de coupe dans la serie, [(indice, valeur)] des coupes refusees)."""
    import numpy as np
    bons = [i for i, m in enumerate(serie) if m["bon"]]
    pas_vu = pas
    if len(bons) > POINTS_STRUCTURE:              # une tres longue prise : une image sur k suffit
        k = int(math.ceil(len(bons) / float(POINTS_STRUCTURE)))
        bons, pas_vu = bons[::k], pas * k
    mini = max(SECTION_MINI_IMAGES, int(math.ceil(SECTION_MINI_S / pas_vu - 1e-9)))
    if len(bons) < 2 * mini:
        return [], []
    D = distances([serie[i]["forme"] for i in bons])
    ts = np.array([serie[i]["t"] for i in bons])
    D = np.where(np.abs(ts[:, None] - ts[None, :]) <= VOISINS_S + 1e-6, np.inf, D)
    nn = D.min(axis=1)
    nn = nn[np.isfinite(nn)]
    plancher = 0.5 * float(np.median(nn)) if len(nn) else 1e-6

    def indice(lo, b, hi):
        L, R = np.arange(lo, b), np.arange(b, hi)
        w = np.concatenate([D[np.ix_(L, L)].min(1), D[np.ix_(R, R)].min(1)])
        x1, x2 = D[np.ix_(L, R)].min(1), D[np.ix_(R, L)].min(1)
        w, x1, x2 = w[np.isfinite(w)], x1[np.isfinite(x1)], x2[np.isfinite(x2)]
        if not (len(w) and len(x1) and len(x2)):
            return 0.0
        return 0.5 * (float(np.median(x1)) + float(np.median(x2))) / max(float(np.median(w)), plancher, 1e-6)

    coupes, refusees = [], []

    def couper(lo, hi):
        if hi - lo < 2 * mini:
            return
        best, bb = 0.0, None
        for b in range(lo + mini, hi - mini + 1):
            d = indice(lo, b, hi)
            if d > best:
                best, bb = d, b
        if bb is None:
            return
        if best >= SEUIL_SCISSION:
            coupes.append(bb)
            couper(lo, bb)
            couper(bb, hi)
        else:
            refusees.append((bons[bb], round(best, 2)))

    couper(0, len(bons))
    return sorted(bons[b] for b in coupes), refusees


def couper_couleur(serie, idx, mini=3):
    """La OU LA COULEUR CHANGE : il faut CONFIRME images de suite loin de la
    mediane du morceau en cours (un sac qui passe ne fait pas une tenue). Une
    image plate (noir entre deux coloris) ne coupe rien : elle suit. Une LONGUE
    suite d'images plates (un noir d'ouverture) fait un morceau a part."""
    suites, cur = [], []
    for i in idx:
        if cur and serie[i]["plat"] != serie[cur[-1]]["plat"]:
            suites.append(cur)
            cur = []
        cur.append(i)
    if cur:
        suites.append(cur)
    blocs = []
    for su in suites:
        if serie[su[0]]["plat"] and len(su) >= mini:
            blocs.append((su, True))
        elif blocs and not blocs[-1][1]:
            blocs[-1][0].extend(su)
        else:
            blocs.append((list(su), False))
    morceaux = []
    for su, plat in blocs:
        morceaux.extend([su] if plat else couper_simple(serie, su))
    return morceaux


def couper_simple(serie, idx):
    morceaux, courant, suspects = [], [], []
    for i in idx:
        m = serie[i]
        if m["plat"]:
            (suspects if suspects else courant).append(i)
            continue
        couleurs = [serie[j]["couleur"] for j in courant if not serie[j]["plat"]]
        if not couleurs or ecart(m["couleur"], mediane_couleur(couleurs)) <= SAUT_TENUE:
            courant.extend(suspects)
            suspects = []
            courant.append(i)
            continue
        suspects.append(i)
        if sum(1 for j in suspects if not serie[j]["plat"]) >= CONFIRME:
            morceaux.append(courant)
            courant, suspects = suspects, []
    courant.extend(suspects)
    if courant:
        morceaux.append(courant)
    return [m for m in morceaux if m]


def couleur_de(serie, morceau):
    cs = [serie[i]["couleur"] for i in morceau if not serie[i]["plat"]]
    return mediane_couleur(cs) if cs else None


def recoller_courts(serie, morceaux, mini):
    """Un morceau trop court n'est PAS jete : il rejoint le voisin de couleur la
    plus proche. Seul un morceau long et entierement plat reste a part."""
    morceaux = [list(m) for m in morceaux]
    while len(morceaux) > 1:
        k = min(range(len(morceaux)), key=lambda i: len(morceaux[i]))
        if len(morceaux[k]) >= mini:
            break
        c = couleur_de(serie, morceaux[k])
        voisins = [j for j in (k - 1, k + 1) if 0 <= j < len(morceaux)]

        def loin(j):
            cj = couleur_de(serie, morceaux[j])
            return ecart(c, cj) if (c and cj) else 99.0
        j = min(voisins, key=loin)
        morceaux[j] = morceaux[j] + morceaux[k] if j < k else morceaux[k] + morceaux[j]
        del morceaux[k]
    return morceaux


def sujet_de(serie, morceau):
    vus = [serie[i] for i in morceau if not serie[i]["plat"]]
    if not vus:
        return "plat"
    return "oui" if sum(1 for m in vus if a_un_sujet(m)) * 2 >= len(vus) else "non"


def recoller(serie, morceaux):
    """Deux morceaux voisins de la meme couleur (meme rayon) et du meme sujet :
    la meme tenue sous deux lumieres."""
    out = []
    for m in morceaux:
        if out:
            a, b = couleur_de(serie, out[-1]), couleur_de(serie, m)
            if a and b and sujet_de(serie, out[-1]) == sujet_de(serie, m) and ecart(a, b) <= RAYON_COULEUR:
                out[-1] = out[-1] + m
                continue
        out.append(m)
    return out


def decouper_rush(serie, pas, duree):
    """Rend [section] ; une section = [(morceau, sujet)] ; et les bornes de temps.
    Chaque image couvre jusqu'a mi-chemin de ses voisines : les morceaux se
    touchent, la premiere seconde et la derniere ne sont jamais perdues."""
    ts = [m["t"] for m in serie]
    deb = [0.0] + [(ts[i - 1] + ts[i]) / 2.0 for i in range(1, len(ts))]
    fin = deb[1:] + [max(duree, ts[-1])]
    for m in serie:
        m["bon"] = (not m["plat"]) and a_un_sujet(m)
    coupes, refusees = sections(serie, pas)
    mini = max(2, int(math.ceil(TRONCON_MINI_S / pas - 1e-9)))
    limites = [0] + coupes + [len(serie)]
    out = []
    for s in range(len(limites) - 1):
        idx = list(range(limites[s], limites[s + 1]))
        ms = recoller(serie, recoller_courts(serie, couper_couleur(serie, idx, mini), mini))
        out.append([(m, sujet_de(serie, m)) for m in ms])
    return out, deb, fin, coupes, refusees


# ======================================================================
# 3. LES GROUPES CANDIDATS ET LA PROPOSITION
# ======================================================================

def dispersion(F, cles):
    """Pour chaque image, l'ecart a la plus proche du MEME groupe (hors ses
    voisines dans le temps)."""
    import numpy as np
    D = distances(F)
    rush = np.array([c[0] for c in cles])
    ts = np.array([c[1] for c in cles])
    proche = (rush[:, None] == rush[None, :]) & (np.abs(ts[:, None] - ts[None, :]) <= VOISINS_S + 1e-6)
    D = np.where(proche, np.inf, D)
    nn = D.min(axis=1)
    return nn[np.isfinite(nn)]


def indice_groupes(A, B, plancher):
    import numpy as np
    FA, FB = np.asarray(A["F"], dtype=np.float64), np.asarray(B["F"], dtype=np.float64)
    sa, sb = (FA * FA).sum(1), (FB * FB).sum(1)
    D = np.sqrt(np.maximum(sa[:, None] + sb[None, :] - 2.0 * FA @ FB.T, 0.0))
    croise = 0.5 * (float(np.median(D.min(1))) + float(np.median(D.min(0))))
    w = np.concatenate([A["disp"], B["disp"]])
    return croise / max(float(np.median(w)) if len(w) else 0.0, plancher, 1e-6)


def proposer(groupes, n):
    """Fusionne les groupes les plus proches (lien moyen) jusqu'a n. C'est une
    PROPOSITION : chaque fusion porte son indice et reste a verifier."""
    import numpy as np
    k = len(groupes)
    disp = [g["disp"] for g in groupes if len(g["disp"])]
    plancher = 0.5 * float(np.median(np.concatenate(disp))) if disp else 1e-6
    M = np.zeros((k, k))
    meme = np.zeros((k, k), dtype=bool)
    for i in range(k):
        for j in range(i + 1, k):
            d = indice_groupes(groupes[i], groupes[j], plancher) if (len(groupes[i]["F"]) and len(groupes[j]["F"])) else 50.0
            meme[i, j] = meme[j, i] = any(ecart(a, b) <= RAYON_MEME for a in groupes[i]["couleurs_t"] for b in groupes[j]["couleurs_t"])
            if meme[i, j]:
                d *= FACTEUR_COULEUR
            di, dj = groupes[i]["dossier"], groupes[j]["dossier"]
            if di and dj and di != dj:
                d += PENALITE_DOSSIER
            M[i, j] = M[j, i] = d
    amas = [[i] for i in range(k)]
    liens = []
    while n and len(amas) > max(1, n):
        best, ou = None, None
        for x in range(len(amas)):
            for y in range(x + 1, len(amas)):
                d = float(np.mean([M[i, j] for i in amas[x] for j in amas[y]]))
                if best is None or d < best:
                    best, ou = d, (x, y)
        x, y = ou
        liens.append({"fusion": [[groupes[i]["id"] for i in amas[x]], [groupes[j]["id"] for j in amas[y]]],
                      "indice": round(best, 2),
                      "meme_couleur": bool(any(meme[i, j] for i in amas[x] for j in amas[y])),
                      "a_verifier": True})
        amas[x] = sorted(amas[x] + amas[y])
        del amas[y]
    amas.sort(key=lambda a: a[0])
    return [[groupes[i]["id"] for i in a] for a in amas], liens, M


def estimer(groupes):
    """COMBIEN DE MODELES LES PIXELS DISTINGUENT (08/10/2026). Les groupes sont
    rejoints (lien moyen) tant que leur ecart de STRUCTURE reste sous
    SEUIL_ESTIME ; la couleur ne rapproche jamais rien (un modele en trois
    couleurs fait trois groupes, mais une seule structure) ; deux sous-dossiers
    differents ne se rejoignent jamais. Rend (nombre, amas en ids, ecarts)."""
    import numpy as np
    k = len(groupes)
    if k <= 1:
        return k, [[g["id"]] for g in groupes], []
    disp = [g["disp"] for g in groupes if len(g["disp"])]
    plancher = 0.5 * float(np.median(np.concatenate(disp))) if disp else 1e-6
    M = np.zeros((k, k))
    for i in range(k):
        for j in range(i + 1, k):
            d = indice_groupes(groupes[i], groupes[j], plancher) if (len(groupes[i]["F"]) and len(groupes[j]["F"])) else 50.0
            di, dj = groupes[i]["dossier"], groupes[j]["dossier"]
            if di and dj and di != dj:
                d = float("inf")
            M[i, j] = M[j, i] = d
    amas = [[i] for i in range(k)]
    ecarts = []
    while len(amas) > 1:
        best, ou = None, None
        for x in range(len(amas)):
            for y in range(x + 1, len(amas)):
                d = float(np.mean([M[i, j] for i in amas[x] for j in amas[y]]))
                if best is None or d < best:
                    best, ou = d, (x, y)
        if best is None or not best <= SEUIL_ESTIME:
            if best is not None and math.isfinite(best):
                ecarts.append(round(best, 2))
            break
        ecarts.append(round(best, 2))
        x, y = ou
        amas[x] = sorted(amas[x] + amas[y])
        del amas[y]
    amas.sort(key=lambda a: a[0])
    return len(amas), [[groupes[i]["id"] for i in a] for a in amas], ecarts


def familles_couleur(troncons):
    """Les couleurs d'un groupe (lien complet au rayon de couleur), pour la lecture."""
    fams = []
    for t in sorted(troncons, key=lambda t: -(t["a"] - t["de"])):
        for f in fams:
            if all(ecart(t["couleur"], o["couleur"]) <= RAYON_COULEUR for o in f):
                f.append(t)
                break
        else:
            fams.append([t])
    out = [{"rgb": [round(x) for x in mediane_couleur([t["couleur"] for t in f])],
            "secondes": round(sum(t["a"] - t["de"] for t in f), 1)} for f in fams]
    return sorted(out, key=lambda c: -c["secondes"])


# ======================================================================
# 4. LES PLANCHES — on regarde, on ne se contente pas de mesurer
# ======================================================================

def police(taille):
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size=taille)
    except Exception:
        pass
    for n in ("DejaVuSans.ttf", "Arial.ttf", "arial.ttf", "Helvetica.ttc"):
        try:
            return ImageFont.truetype(n, taille)
        except Exception:
            pass
    return ImageFont.load_default()


def vide(hauteur):
    from PIL import Image
    return Image.new("RGB", (int(hauteur * 9 / 16), hauteur), (200, 200, 200))


def etiqueter(im, t):
    """La seconde de l'image, ecrite dans son coin (Claude resserre un segment sur ce qu'il voit)."""
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    P = police(17)
    lab = "%.1f s" % t
    d.rectangle([0, 0, d.textlength(lab, font=P) + 8, 22], fill=(255, 255, 255))
    d.text((4, 2), lab, fill=(0, 0, 0), font=P)
    return im


BORD_PAS_S = 1.5        # les bords d'un troncon long : quatre images toutes les 1,5 s au debut et a la fin
BORD_IMAGES = 4         # (une fin floue de deux secondes, une transition, ne passent plus entre deux images)


def instants_film(de, a, n=FILM):
    """Les secondes du film d'un troncon : BORD_IMAGES serrees au debut, autant a la fin, le reste reparti au milieu."""
    b = BORD_IMAGES if a - de >= 2 * BORD_IMAGES * BORD_PAS_S + 2 else 0
    debut = [de + 0.2 + k * BORD_PAS_S for k in range(b)]
    fin = [a - 0.2 - k * BORD_PAS_S for k in range(b)][::-1]
    lo, hi, m = (debut[-1], fin[0], n - 2 * b) if b else (de + 0.2, a - 0.2, n)
    milieu = [lo + (hi - lo) * (k + (1 if b else 0)) / float(max(1, m + (1 if b else -1))) for k in range(m)]
    return debut + milieu + fin


def film_troncon(f, de, a, couche, n=FILM, hauteur=HAUT_VIGNETTE):
    """Le troncon en n images de son debut a sa fin, ses BORDS serres (instants_film), chacune avec sa seconde."""
    h = (hauteur - 6) // 2
    film = []
    for t in instants_film(de, a, n):
        im = image_decodee(f, t, couche, h)
        if im:
            film.append((round(t, 1), im))
    return film


def vignettes(f, de, a, couche, zoom=True, hauteur=HAUT_VIGNETTE, secondes=False):
    """Deux images (a 25 % et 75 % du troncon) et un ZOOM sur le vetement (a 50 %). secondes : chaque image
    porte sa seconde (les planches de Claude ; jamais la planche du client)."""
    L = a - de
    ims = [image_decodee(f, de + p * L, couche, hauteur) or vide(hauteur) for p in (0.25, 0.75)]
    if secondes:
        ims = [etiqueter(im, de + p * L) for im, p in zip(ims, (0.25, 0.75))]
    if zoom:
        im = image_decodee(f, de + 0.5 * L, couche, hauteur * 2)
        if im:
            w, h = im.size
            im = im.crop((int(w * .18), int(h * .20), int(w * .82), int(h * .95)))
            im = im.resize((max(1, int(im.size[0] * hauteur / float(im.size[1]))), hauteur))
            if secondes:
                im = etiqueter(im, de + 0.5 * L)
        ims.append(im or vide(hauteur))
    return ims


def couper_texte(d, texte, police_, largeur):
    t = texte
    while t and d.textlength(t, font=police_) > largeur:
        t = t[:-1]
    return t


def planche(cartes, titre, sous_titre, dest, colonnes=COLONNES):
    """Une image : un bandeau (titre latin lisible), puis une carte par troncon :
    deux lignes d'etiquette, une pastille de la couleur mesuree, les images."""
    from PIL import Image, ImageDraw
    PT, PS, PC = police(46), police(24), police(19)
    marge, entre, leg = 14, 6, 50
    larg = max([sum(im.size[0] for im in c["images"]) + entre * (len(c["images"]) - 1) for c in cartes] + [320])
    haut = max([im.size[1] for c in cartes for im in c["images"]] + [10])
    col = max(1, min(colonnes, len(cartes)))
    rangs = (len(cartes) + col - 1) // col
    W = marge + col * (larg + marge)
    H = 96 + rangs * (leg + haut + marge) + marge
    S = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(S)
    d.rectangle([0, 0, W, 84], fill=(20, 20, 20))
    d.text((marge, 14), titre, fill=(255, 255, 255), font=PT)
    x0 = marge + d.textlength(titre, font=PT) + 28
    d.text((x0, 30), couper_texte(d, sous_titre, PS, W - x0 - marge), fill=(230, 230, 230), font=PS)
    for k, c in enumerate(cartes):
        x = marge + (k % col) * (larg + marge)
        y = 96 + (k // col) * (leg + haut + marge)
        place = larg - (48 if c.get("pastille") else 0)
        d.text((x, y), couper_texte(d, c["lignes"][0], PC, place), fill=(0, 0, 0), font=PC)
        d.text((x, y + 23), couper_texte(d, c["lignes"][1], PC, place), fill=(70, 70, 70), font=PC)
        if c.get("pastille"):
            d.rectangle([x + larg - 40, y + 4, x + larg - 4, y + 40],
                        fill=tuple(int(v) for v in c["pastille"]), outline=(0, 0, 0))
        xx = x
        for im in c["images"]:
            S.paste(im, (xx, y + leg))
            xx += im.size[0] + entre
    S.save(dest, "JPEG", quality=85)
    return dest


def planches_pages(cartes, titre, sous_titre, base, colonnes=COLONNES):
    """Au plus CARTES_PAR_PAGE cartes par image : G1.jpg, G1-2.jpg ..."""
    pages = [cartes[i:i + CARTES_PAR_PAGE] for i in range(0, len(cartes), CARTES_PAR_PAGE)] or [[]]
    out = []
    for p, cs in enumerate(pages, 1):
        t = titre if len(pages) == 1 else "%s (%d/%d)" % (titre, p, len(pages))
        dest = base + (".jpg" if p == 1 else "-%d.jpg" % p)
        if cs:
            out.append(planche(cs, t, sous_titre, dest, colonnes))
    return out


# ======================================================================
# 5. --candidats
# ======================================================================

def analyser(rushes, sortie):
    """Lit chaque video ; rend videos, troncons, ecartes, unites (sections), illisibles."""
    rels = lister_videos(rushes)
    dossiers = dossiers_modeles(rels)
    videos, troncons, ecartes, unites, illisibles = [], [], [], [], []
    # les images de travail vivent dans le lot (un PC coupe en pleine lecture : le reste est efface au tour suivant)
    for x in os.listdir(sortie):
        if x.startswith("_travail-separer"):
            shutil.rmtree(os.path.join(sortie, x), ignore_errors=True)
    travail = tempfile.mkdtemp(prefix="_travail-separer-", dir=sortie)
    try:
        for k, rel in enumerate(rels, 1):
            f = os.path.join(rushes, rel)
            rid = "R%d" % k
            s = sonde(f)
            ap = image_decodee(f, min(1.0, s["duree"] / 2.0), False, 160) if (s and s["duree"] > 0) else None
            if not ap:
                illisibles.append({"rush": rel, "video": rid, "pourquoi": "illisible (ffprobe ou ffmpeg)"})
                print("   [ecarte] %s : illisible" % rel)
                continue
            couche = ap.size[0] > ap.size[1]
            pas = min(PAS_MAX, max(PAS_MINI, s["duree"] / float(IMAGES_VISEES)))
            film = []
            try:
                serie = lire_serie(f, pas, couche, travail, film)
            except (RuntimeError, subprocess.TimeoutExpired) as e:
                serie, pourquoi = [], str(e)[:200]
            else:
                pourquoi = "aucune image lue"
            if not serie:
                illisibles.append({"rush": rel, "video": rid, "pourquoi": pourquoi})
                print("   [ecarte] %s : %s" % (rel, pourquoi))
                continue
            secs, deb, fin, coupes, refusees = decouper_rush(serie, pas, s["duree"])
            dossier = dossiers[rel]
            # personne vu NULLE PART dans la video (une abaya de la couleur du mur ?) : elle n'est pas
            # jetee, ses morceaux restent des troncons « incertains » — le bureau ne montre que les groupes
            incertain = not any(sujet == "oui" for ms in secs for _m, sujet in ms)
            videos.append({"id": rid, "rush": rel, "dossier": dossier, "duree": round(s["duree"], 2),
                           "pas": round(pas, 3), "images": len(serie), "couche": couche,
                           "coupes_structure": [round(deb[i], 2) for i in coupes], "_film": film})
            for si, morceaux in enumerate(secs):
                u = {"rush": rel, "video": rid, "dossier": dossier, "troncons": [], "F": [], "cles": [],
                     "incertain": incertain,
                     "coupe_a": round(deb[morceaux[0][0][0]], 2) if si else None,
                     "refusees": [(round(deb[i], 2), v) for i, v in refusees
                                  if deb[morceaux[0][0][0]] <= deb[i] < fin[morceaux[-1][0][-1]]]}
                for m, sujet in morceaux:
                    c = couleur_de(serie, m)
                    de, a = round(deb[m[0]], 2), round(fin[m[-1]], 2)
                    if not (sujet == "oui" or (incertain and sujet == "non")):
                        ecartes.append({"rush": rel, "video": rid, "de": de, "a": a, "images": len(m),
                                        "couleur": [round(x) for x in c] if c else None,
                                        "pourquoi": "image plate (noir ou fondu)" if sujet == "plat"
                                        else "personne dans l'image (le centre a la couleur des cotes)"})
                        continue
                    t = {"id": "T%d" % (len(troncons) + 1), "rush": rel, "video": rid, "de": de, "a": a,
                         "images": len(m), "couleur": [round(x, 1) for x in c]}
                    if sujet != "oui":
                        t["sujet"] = "incertain"
                    troncons.append(t)
                    u["troncons"].append(t)
                    for i in m:
                        if serie[i]["bon"] or (incertain and not serie[i]["plat"]):
                            u["F"].append(serie[i]["forme"])
                            u["cles"].append((rel, serie[i]["t"]))
                if u["troncons"]:
                    unites.append(u)
            print("   %-28s %6.1f s  %3d image(s) toutes les %.1f s -> %d troncon(s)%s"
                  % (latin(rel)[-28:], s["duree"], len(serie), pas,
                     sum(1 for t in troncons if t["video"] == rid),
                     ("  [structure coupee a %s s]" % ", ".join("%.1f" % deb[i] for i in coupes)) if coupes else ""))
    finally:
        shutil.rmtree(travail, ignore_errors=True)
    return videos, troncons, ecartes, unites, illisibles


def former_groupes(unites):
    """Un groupe = une section de video ; tout un sous-dossier = un seul groupe."""
    import numpy as np
    groupes, par_dossier = [], {}
    for u in unites:
        if u["dossier"] and u["dossier"] in par_dossier:
            g = par_dossier[u["dossier"]]
        else:
            g = {"unites": [], "dossier": u["dossier"]}
            groupes.append(g)
            if u["dossier"]:
                par_dossier[u["dossier"]] = g
        g["unites"].append(u)
    for k, g in enumerate(groupes, 1):
        g["id"] = "G%d" % k
        us = g["unites"]
        g["troncons"] = [t for u in us for t in u["troncons"]]
        for t in g["troncons"]:
            t["groupe"] = g["id"]
        F = [x for u in us for x in u["F"]]
        cles = [x for u in us for x in u["cles"]]
        if len(F) > IMAGES_GROUPE:
            pris = np.linspace(0, len(F) - 1, IMAGES_GROUPE).round().astype(int)
            F, cles = [F[i] for i in pris], [cles[i] for i in pris]
        g["F"], g["cles"] = F, cles
        g["disp"] = dispersion(F, cles) if len(F) > 1 else np.zeros(0)
        g["couleurs_t"] = [t["couleur"] for t in g["troncons"]]
        rushes = sorted(set(u["rush"] for u in us))
        if g["dossier"]:
            g["raison"] = "meme sous-dossier : %s" % g["dossier"]
        elif us[0]["coupe_a"] is not None or any(v["rush"] == us[0]["rush"] and v is not us[0] for v in unites):
            g["raison"] = "une partie de video (la structure change)"
        else:
            g["raison"] = "une video"
        g["doutes"] = ["personne repere dans %s (vetement de la couleur du fond ?) : a regarder" % r
                       for r in sorted(set(u["rush"] for u in us if u["incertain"]))]
        if g["dossier"]:
            for u in us:
                if u["coupe_a"] is not None:
                    g["doutes"].append("dans %s la structure change a %.1f s : deux modeles dans ce dossier ?" % (u["rush"], u["coupe_a"]))
        g["rushes"] = rushes
    return groupes


def ecrire_planches(rushes, sortie, videos, groupes, ecartes):
    """Les planches que Claude lit. Le nombre de modeles annonce par le client n'y est JAMAIS ecrit
    (06/10/2026 : le vrai Claude s'est cale sur la « cible » du bandeau, il a coupe un vetement en deux
    et oublie un petit modele pour tomber sur N). La cible reste dans candidats.json, pour le bureau."""
    pl = os.path.join(sortie, "planches")
    os.makedirs(pl, exist_ok=True)
    for n in os.listdir(pl):       # nos anciennes planches seulement
        if re.match(r"^(G\d+(-\d+)?|apercu(-\d+)?|ecartes(-\d+)?)\.jpg$", n):
            os.remove(os.path.join(pl, n))
    par_id = {v["id"]: v for v in videos}

    def carte(t, zoom=True, raison=""):
        v = par_id[t["video"]]
        ims = vignettes(os.path.join(rushes, t["rush"]), t["de"], t["a"], v["couche"], zoom, secondes=True)
        nom = latin(os.path.basename(t["rush"]))
        tete = "%s  %s %s" % (t.get("id", ""), t["video"], nom) if t.get("id") else "%s %s" % (t["video"], nom)
        bas = "%.1f - %.1f s  (%.1f s)%s" % (t["de"], t["a"], t["a"] - t["de"], ("  " + raison) if raison else "")
        return {"images": ims, "lignes": [tete, bas], "pastille": t.get("couleur")}

    for g in groupes:
        cartes = []
        for t in sorted(g["troncons"], key=lambda t: (t["rush"], t["de"])):
            cartes.append(carte(t))
            # un troncon LONG : son film, pour juger ses bords (piscine, transition, fin floue a exclure)
            if t["a"] - t["de"] >= TRONCON_LONG_S:
                ft = film_troncon(os.path.join(rushes, t["rush"]), t["de"], t["a"], par_id[t["video"]]["couche"])
                cartes.append({"images": [mosaique(ft)],
                               "lignes": ["%s  %s : le troncon en %d images (ses bords)" % (t.get("id", ""), t["video"], len(ft)),
                                          "de %.1f a %.1f s - chaque image porte sa seconde" % (t["de"], t["a"])]})
        for vid in sorted(set(t["video"] for t in g["troncons"]), key=lambda x: int(x[1:])):
            v = par_id[vid]
            film = v.get("_film") or []
            cartes.append({"images": [mosaique(film)],
                           "lignes": ["%s %s : la video entiere" % (vid, latin(os.path.basename(v["rush"]))),
                                      "%d images de %.1f a %.1f s" % (len(film), film[0][0] if film else 0, film[-1][0] if film else 0)]})
        sous = "%d troncon(s) - %d video(s) - %.0f s" % (
            len(g["troncons"]), len(g["rushes"]), sum(t["a"] - t["de"] for t in g["troncons"]))
        g["planches"] = planches_pages(cartes, g["id"], sous, os.path.join(pl, g["id"]))
        print("   planche %s : %d carte(s)" % (g["id"], len(cartes)))
    # l'apercu : tous les groupes cote a cote, pour voir lesquels se ressemblent
    cartes = []
    for g in groupes:
        longs = sorted(g["troncons"], key=lambda t: -(t["a"] - t["de"]))[:3]
        ims = []
        for t in longs:
            v = par_id[t["video"]]
            ims.append(image_decodee(os.path.join(rushes, t["rush"]), (t["de"] + t["a"]) / 2.0, v["couche"], 300) or vide(300))
        t = longs[0]
        ims += vignettes(os.path.join(rushes, t["rush"]), t["de"], t["a"], par_id[t["video"]]["couche"], True, 300)[2:]
        cartes.append({"images": ims, "lignes": ["%s  %s" % (g["id"], ", ".join(sorted(set(x["video"] for x in g["troncons"])))),
                                                 "%d troncon(s) - %.0f s" % (len(g["troncons"]), sum(x["a"] - x["de"] for x in g["troncons"]))]})
    apercu = planches_pages(cartes, "GROUPES", "%d groupe(s) candidat(s) - tous cote a cote" % len(groupes),
                            os.path.join(pl, "apercu"), colonnes=2)
    # ce qui a ete ecarte, montre (rien n'est jete en silence)
    ec = []
    if ecartes:
        cartes = [carte(e, zoom=False, raison="plat" if e["pourquoi"].startswith("image plate") else "sans sujet")
                  for e in ecartes]
        ec = planches_pages(cartes, "ECARTES", "%d morceau(x) mis de cote - a regarder" % len(ecartes),
                            os.path.join(pl, "ecartes"))
        for e in ecartes:
            e["planche"] = ec[0]
    return apercu, ec


FIN_ACTIVE = False


def regler_fin():
    """--fin : la relance plus fine (une video se coupe plus facilement en deux)."""
    global SEUIL_SCISSION, SECTION_MINI_S, SECTION_MINI_IMAGES, FIN_ACTIVE
    SEUIL_SCISSION, SECTION_MINI_S, SECTION_MINI_IMAGES = FIN_SEUIL_SCISSION, FIN_SECTION_MINI_S, FIN_SECTION_MINI_IMAGES
    FIN_ACTIVE = True


def candidats(rushes, sortie, n_modeles=0):
    debut = time.time()
    rushes, sortie = os.path.abspath(rushes), os.path.abspath(sortie)
    os.makedirs(sortie, exist_ok=True)
    print("1. je lis chaque video sur TOUTE sa duree (sous-dossiers compris) ...")
    videos, troncons, ecartes, unites, illisibles = analyser(rushes, sortie)
    groupes = former_groupes(unites)
    proposition, liens = [[g["id"]] for g in groupes], []
    if groupes and n_modeles and len(groupes) > n_modeles:
        proposition, liens, _ = proposer(groupes, n_modeles)
    # le nombre de modeles que les pixels distinguent (le bureau ne croit plus N = 1 sur parole)
    estimes, amas_estimes, ecarts_estimes = estimer(groupes)
    # l'arborescence
    dossiers = {}
    for v in videos:
        if v["dossier"]:
            dossiers.setdefault(v["dossier"], []).append(v["id"])
    racine = sum(1 for v in videos if not v["dossier"])
    if dossiers and not racine and (not n_modeles or len(dossiers) == n_modeles):
        indice = "fort"
    elif dossiers:
        indice = "partiel"
    else:
        indice = "aucun"
    print("2. j'ecris les planches ...")
    apercu, ec = ecrire_planches(rushes, sortie, videos, groupes, ecartes) if groupes else ([], [])
    scissions = sorted(({"groupe": g["id"], "rush": u["rush"], "a": t, "indice": v}
                        for g in groupes for u in g["unites"] for t, v in u["refusees"]),
                       key=lambda x: -x["indice"])[:6]
    r = {"version": VERSION, "quoi": "separer-candidats", "rushes": rushes, "cible": n_modeles or None,
         "trouves": len(groupes), "accord": bool(n_modeles) and len(groupes) == n_modeles,
         "estimes": estimes, "estimes_amas": amas_estimes, "estimes_ecarts": ecarts_estimes,
         "seuil_estime": SEUIL_ESTIME, "fin": bool(FIN_ACTIVE),
         "arborescence": {"indice": indice, "racine": racine,
                          "dossiers": [{"dossier": d, "videos": ids,
                                        "groupes": [g["id"] for g in groupes if g["dossier"] == d]}
                                       for d, ids in sorted(dossiers.items())]},
         "videos": [{x: v[x] for x in v if not x.startswith("_")} for v in videos], "troncons": troncons,
         "groupes": [{"id": g["id"], "raison": g["raison"], "troncons": [t["id"] for t in g["troncons"]],
                      "rushes": g["rushes"], "videos": sorted(set(t["video"] for t in g["troncons"])),
                      "dossier": g["dossier"] or None,
                      "secondes": round(sum(t["a"] - t["de"] for t in g["troncons"]), 1),
                      "couleurs": familles_couleur(g["troncons"]), "planches": g.get("planches", []),
                      "doutes": g["doutes"]} for g in groupes],
         "proposition": proposition, "liens": liens,
         "note": "la proposition ne regarde que des pixels : elle se trompe souvent sur de vraies videos ; "
                 "seule la lecture des planches tranche, puis le client confirme",
         "scissions_possibles": scissions,
         "ecartes": ecartes, "illisibles": illisibles,
         "planches": {"apercu": apercu, "ecartes": ec},
         "secondes": round(time.time() - debut, 1)}
    chemin = ecrire_json(os.path.join(sortie, "candidats.json"), r)
    r["fichier"] = chemin
    return r


def vue(r):
    L = ["", "  %d video(s) -> %d troncon(s) -> %d groupe(s) candidat(s), cible %s, modeles estimes %s%s"
         % (len(r["videos"]), len(r["troncons"]), r["trouves"], r["cible"] or "?", r.get("estimes", "?"),
            " (relance fine)" if r.get("fin") else ""),
         "  arborescence : indice %s" % r["arborescence"]["indice"], ""]
    for g in r["groupes"]:
        L.append("  %-4s %2d troncon(s) %3d video(s) %6.0f s  [%s]  %s"
                 % (g["id"], len(g["troncons"]), len(g["videos"]), g["secondes"],
                    latin(", ".join(g["rushes"]))[:60], g["raison"]))
        L.append("       couleurs : %s" % "  ".join("(%d,%d,%d) %.0f s" % (tuple(c["rgb"]) + (c["secondes"],)) for c in g["couleurs"][:6]))
        for d in g["doutes"]:
            L.append("       DOUTE : %s" % latin(d))
    if r["liens"]:
        L.append("")
        L.append("  PROPOSITION pour %d modele(s) — A VERIFIER sur les planches :" % r["cible"])
        L.append("     " + " | ".join("+".join(p) for p in r["proposition"]))
        for l in r["liens"]:
            L.append("     fusion %s + %s : indice %.2f%s" % ("+".join(l["fusion"][0]), "+".join(l["fusion"][1]),
                                                           l["indice"], " (meme couleur)" if l["meme_couleur"] else ""))
    elif r["cible"] and r["trouves"] < r["cible"]:
        L.append("")
        L.append("  MOINS de groupes que la cible : regarder les scissions possibles :")
        for s in r["scissions_possibles"][:3]:
            L.append("     %s : %s a %.1f s (indice %.2f)" % (s["groupe"], latin(s["rush"]), s["a"], s["indice"]))
    for e in r["ecartes"]:
        L.append("  [ecarte] %s de %.1f a %.1f s : %s" % (latin(e["rush"]), e["de"], e["a"], e["pourquoi"]))
    for e in r["illisibles"]:
        L.append("  [illisible] %s : %s" % (latin(e["rush"]), e["pourquoi"]))
    L.append("  %.1f s" % r["secondes"])
    return "\n".join(L)


# ======================================================================
# 6. LE PLAN — au format que lit MONTER-10 --plan
# ======================================================================

def cle_fichier(f):
    """Le MEME fichier, quel que soit le nom qui le donne : casse (disque Mac ou Windows),
    accent compose ou non, lien dur. Par son numero sur le disque, sinon par son chemin."""
    try:
        st = os.stat(f)
        if st.st_ino:
            return "%d:%d" % (st.st_dev, st.st_ino)
    except OSError:
        pass
    return unicodedata.normalize("NFC", os.path.normcase(os.path.realpath(f)))


def soustraire(s, trous):
    """Les morceaux d'un segment qui restent hors des `trous` [(de, a)]."""
    morceaux = [(s["de"], s["a"])]
    for lo, hi in trous:
        reste = []
        for de, a in morceaux:
            if hi <= de + 1e-3 or lo >= a - 1e-3:
                reste.append((de, a))
                continue
            if lo > de + 1e-3:
                reste.append((de, lo))
            if hi < a - 1e-3:
                reste.append((hi, a))
        morceaux = reste
    return [dict(s, de=round(de, 3), a=round(a, 3)) for de, a in morceaux]


def lire_plan(chemin):
    """{rushes, modeles:[{nom, couleurs, segments:[{rush, de, a, coloris}]}], exclusions}.
    Rend (plan, refus). Un plan refuse n'ecrit RIEN. Jamais un instant a deux modeles :
    au-dela de CHEVAUCHE_TOLERE c'est refuse ; en deca (le bureau laisse passer 0,3 s),
    l'instant dispute est retire aux DEUX. Un instant exclu est retire du modele qui l'avait."""
    try:
        p = json.load(io.open(chemin, encoding="utf-8"))
    except Exception as e:
        return None, ["plan illisible : %s" % e]
    mods = p.get("modeles") if isinstance(p, dict) else None
    if not isinstance(mods, list) or not mods:
        return None, ["plan sans modeles"]
    # le dossier des rushes suit le plan : le chemin ecrit, sinon le meme nom a cote du plan
    r = str(p.get("rushes") or "")
    if not os.path.isdir(r):
        cote = os.path.join(os.path.dirname(os.path.abspath(chemin)), os.path.basename(r.rstrip("/\\")))
        if r and os.path.isdir(cote):
            r = cote
    if not r or not os.path.isdir(r):
        return None, ["dossier des rushes introuvable : %s" % p.get("rushes")]
    r = os.path.abspath(r)
    vrai = os.path.realpath(r)
    refus, avert, durees, noms, propre = [], [], {}, {}, []

    def segment(s, quoi, strict=True):
        """Un segment de modele (strict : un defaut = refus) ou une exclusion (un defaut = avertissement,
        les bornes ramenees dans la video : une exclusion n'ecrit rien, elle ne fait que retirer)."""
        dire = refus.append if strict else (lambda x: avert.append(x + " (exclusion ignoree)"))
        if not isinstance(s, dict):
            dire("%s : segment illisible" % quoi)
            return None
        donne = str(s.get("rush") or "").replace("\\", "/")
        try:
            de, a = float(s.get("de")), float(s.get("a"))
        except (TypeError, ValueError):
            de = a = float("nan")
        if math.isnan(de) or math.isnan(a):
            dire("%s : %s sans debut ou fin" % (quoi, donne))
            return None
        if not donne or os.path.isabs(donne):
            dire("%s : rush hors du dossier : %s" % (quoi, donne))
            return None
        # un accent s'ecrit de deux facons (Mac / Windows) : on essaie les deux
        rush = next((x for x in (donne, unicodedata.normalize("NFC", donne), unicodedata.normalize("NFD", donne))
                     if os.path.isfile(os.path.join(r, x))), donne)
        f = os.path.realpath(os.path.join(r, rush))
        if not f.startswith(vrai + os.sep):
            dire("%s : rush hors du dossier : %s" % (quoi, donne))
            return None
        if not os.path.isfile(f):
            dire("%s : rush introuvable : %s" % (quoi, donne))
            return None
        if rush not in durees:
            sd = sonde(f)
            durees[rush] = sd["duree"] if sd else 0.0
        D = durees[rush]
        if D <= 0:
            dire("%s : rush illisible : %s" % (quoi, rush))
            return None
        if not strict:
            de, a = max(0.0, de), min(a, D)
        if not (0 <= de < a):
            dire("%s : %s de %.2f a %.2f s n'est pas un intervalle" % (quoi, rush, de, a))
            return None
        if a > D + TOL_FIN:
            dire("%s : %s de %.2f a %.2f s depasse la video (%.2f s)" % (quoi, rush, de, a, D))
            return None
        return {"rush": rush, "cle": cle_fichier(f), "de": round(de, 3), "a": round(min(a, D), 3)}

    for k, m in enumerate(mods, 1):
        if not isinstance(m, dict):
            refus.append("modele %d illisible" % k)
            continue
        nom = str(m.get("nom") or "").strip()
        if not nom:
            refus.append("modele %d sans nom" % k)
            continue
        if nom.casefold() in noms:
            refus.append("deux modeles portent le meme nom : %s" % nom)
        noms[nom.casefold()] = k
        segs = []
        donnes = m.get("segments") if isinstance(m.get("segments"), list) else []
        for s in donnes:
            x = segment(s, nom)
            if x:
                x["coloris"] = str(s.get("coloris") or "")
                segs.append(x)
        if not donnes:
            refus.append("modele « %s » sans segment" % nom)
        couleurs = m.get("couleurs")
        if not isinstance(couleurs, list) or not couleurs:
            couleurs = []
            for s in segs:
                if s["coloris"] and s["coloris"] not in couleurs:
                    couleurs.append(s["coloris"])
        propre.append({"nom": nom, "couleurs": [str(c) for c in couleurs], "segments": segs,
                       "groupes": m.get("groupes")})
    exclusions = []
    for e in (p.get("exclusions") if isinstance(p.get("exclusions"), list) else []):
        x = segment(e, "exclusion", strict=False)
        if x:
            x["pourquoi"] = str((e or {}).get("pourquoi") or "")
            exclusions.append(x)
    # un modele : ses segments qui se chevauchent sont fusionnes (et c'est dit)
    for m in propre:
        out = []
        for s in sorted(m["segments"], key=lambda s: (s["cle"], s["de"])):
            if out and out[-1]["cle"] == s["cle"] and s["de"] < out[-1]["a"] - 1e-3:
                avert.append("%s : deux segments de %s se chevauchent (%.2f-%.2f s), fusionnes"
                             % (s["rush"], m["nom"], s["de"], min(s["a"], out[-1]["a"])))
                out[-1]["a"] = max(out[-1]["a"], s["a"])
                if s["coloris"] and s["coloris"] not in out[-1]["coloris"].split("/"):
                    out[-1]["coloris"] = (out[-1]["coloris"] + "/" + s["coloris"]).strip("/")
            else:
                out.append(dict(s))
        m["segments"] = out
    # LE MEME INSTANT A DEUX MODELES : refuse, jamais tranche en silence ; un bord dispute
    # (le bureau tolere 0,3 s) est retire aux deux modeles : il ne va a PERSONNE
    trous = {}
    for i in range(len(propre)):
        for j in range(i + 1, len(propre)):
            for a in propre[i]["segments"]:
                for b in propre[j]["segments"]:
                    lo, hi = max(a["de"], b["de"]), min(a["a"], b["a"])
                    if a["cle"] != b["cle"] or hi - lo <= 1e-3:
                        continue
                    if hi - lo > CHEVAUCHE_TOLERE + 1e-6:
                        refus.append("%s : de %.2f a %.2f s donne a deux modeles (%s et %s)"
                                     % (a["rush"], lo, hi, propre[i]["nom"], propre[j]["nom"]))
                    else:
                        trous.setdefault(a["cle"], []).append((lo, hi))
                        avert.append("%s : %.2f-%.2f s dispute entre %s et %s, retire aux deux"
                                     % (a["rush"], lo, hi, propre[i]["nom"], propre[j]["nom"]))
    for e in exclusions:
        trous.setdefault(e["cle"], []).append((e["de"], e["a"]))
    occupe = {}                                   # qui touche a chaque fichier (pour le lien du fichier entier)
    for k, m in enumerate(propre):
        for s in m["segments"]:
            occupe.setdefault(s["cle"], set()).add(k)
    for m in propre:
        reste = []
        for s in m["segments"]:
            t = trous.get(s["cle"], [])
            morceaux = soustraire(s, t)
            perdu = (s["a"] - s["de"]) - sum(x["a"] - x["de"] for x in morceaux)
            if perdu > 1e-3 and any(min(s["a"], e["a"]) - max(s["de"], e["de"]) > 1e-3
                                    for e in exclusions if e["cle"] == s["cle"]):
                avert.append("%s : %.2f s exclues retirees de %s (%.2f-%.2f s)" % (s["rush"], perdu, m["nom"], s["de"], s["a"]))
            for x in morceaux:
                # seul sur ce fichier, sans trou : le fichier entier peut etre un lien (sinon il emporterait un bord)
                x["seul"] = len(occupe.get(s["cle"], ())) == 1 and not t
                reste.append(x)
        if m["segments"] and not reste:
            refus.append("modele « %s » : tout ce qui lui est donne est exclu ou dispute" % m["nom"])
        m["segments"] = reste
    plan = {"rushes": r, "cible": p.get("cible"), "modeles": propre, "exclusions": exclusions,
            "durees": durees, "avertissements": avert}
    return plan, refus


# ======================================================================
# 7. --planches — une photo par modele, pour la confirmation du client
# ======================================================================

def planches_plan(chemin_plan, sortie):
    plan, refus = lire_plan(chemin_plan)
    if refus or not plan:
        sortie_json("separer-planches", {"refus": refus})
        for x in refus:
            print("   REFUS : %s" % latin(x))
        return 2
    sortie = os.path.abspath(sortie)
    os.makedirs(sortie, exist_ok=True)
    nettoyer(sortie, r"^modele-\d+\.jpg$")      # la photo d'un modele d'un ancien plan ne doit pas rester
    couche = {}
    total = len(plan["modeles"])
    faits = []
    for k, m in enumerate(plan["modeles"], 1):
        # une seule image : d'abord le plus long segment de chaque couleur, puis les plus longs
        segs = sorted(m["segments"], key=lambda s: -(s["a"] - s["de"]))
        vus, choix = set(), []
        for s in segs:
            if s["coloris"] not in vus:
                vus.add(s["coloris"])
                choix.append(s)
        choix += [s for s in segs if s not in choix]
        choix = sorted(choix[:CARTES_CLIENT], key=lambda s: (s["rush"], s["de"]))
        cartes = []
        for s in choix:
            f = os.path.join(plan["rushes"], s["rush"])
            if f not in couche:
                ap = image_decodee(f, 0.5, False, 160)
                couche[f] = bool(ap and ap.size[0] > ap.size[1])
            cartes.append({"images": vignettes(f, s["de"], s["a"], couche[f]),
                           "lignes": [latin(os.path.basename(s["rush"])) or "rush",
                                      "%.1f - %.1f s  %s" % (s["de"], s["a"], latin(s["coloris"]))]})
        sous = latin(m["nom"]) or "modele"
        noms = [latin(c) for c in m["couleurs"] if latin(c)]
        if noms:
            sous += " - " + ", ".join(noms)
        dest = planche(cartes, "Modele %d/%d" % (k, total), sous, os.path.join(sortie, "modele-%d.jpg" % k))
        faits.append({"rang": k, "nom": m["nom"], "planche": dest, "segments": len(m["segments"]),
                      "segments_montres": len(choix)})
        print("   %s  <- %s (%d segment(s), %d montre(s))" % (dest, latin(m["nom"]), len(m["segments"]), len(choix)))
    sortie_json("separer-planches", {"planches": faits})
    return 0


# ======================================================================
# 8. --construire — un dossier plat par modele
# ======================================================================

_ENC = None


def encodeur_h264():
    """Le premier encodeur H.264 que ce ffmpeg connait."""
    global _ENC
    if _ENC is not None:
        return _ENC
    r = lancer(["ffmpeg", "-hide_banner", "-encoders"], 60)
    t = r.stdout or ""
    for nom, opts in (("libx264", ["-preset", "veryfast", "-crf", "18"]),
                      ("libopenh264", ["-b:v", "8M"]), ("h264_videotoolbox", ["-b:v", "8M"]),
                      ("h264_mf", ["-b:v", "8M"]), ("h264_qsv", ["-b:v", "8M"]), ("h264_nvenc", ["-b:v", "8M"])):
        if re.search(r"\s%s\s" % nom, t):
            _ENC = ["-c:v", nom] + opts
            return _ENC
    _ENC = []
    return _ENC


def couper_video(src, de, L, dst, enc, son=True):
    """Coupe REENCODEE (une copie -c copy tombe sur les images cles). ffmpeg
    tourne l'image selon l'etiquette de la camera : le fichier ecrit se voit
    dans le meme sens que sa source."""
    r = lancer(["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % de, "-i", src, "-t", "%.3f" % L,
                "-map", "0:v:0"] + (["-map", "0:a:0?"] if son else ["-an"])
               + ["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"]
               + enc + ["-pix_fmt", "yuv420p"] + (["-c:a", "aac", "-b:a", "192k"] if son else [])
               + ["-movflags", "+faststart", "-avoid_negative_ts", "make_zero", dst], 7200)
    return (r.returncode == 0 and os.path.isfile(dst) and os.path.getsize(dst) > 0), erreur(r)


def ecart_images(a, b):
    import numpy as np
    taille = (48, 85) if a.size[0] <= a.size[1] else (85, 48)
    x = np.asarray(a.convert("L").resize(taille), dtype=np.float32)
    y = np.asarray(b.convert("L").resize(taille), dtype=np.float32)
    return float(np.abs(x - y).mean())


def relire(src, dst, de, L, comment, audio_source):
    """Le fichier ecrit est RELU : duree, codec, sens de l'image, et l'image du
    milieu comparee a la source au meme instant (puis a 30 % et 70 %)."""
    if comment == "lien":
        return {"ok": os.path.samefile(src, dst), "duree": round(L, 2)}
    if comment == "copie":
        return {"ok": os.path.getsize(src) == os.path.getsize(dst), "duree": round(L, 2)}
    s = sonde(dst)
    if not s:
        return {"ok": False, "raison": "le fichier ecrit ne se relit pas"}
    if s["codec"] != "h264":
        return {"ok": False, "raison": "codec %s au lieu de h264" % s["codec"]}
    if audio_source and s["audio"] != "aac":
        return {"ok": False, "raison": "le son a disparu"}
    if abs(s["duree"] - L) > max(0.3, 2.5 / s["fps"]):
        return {"ok": False, "raison": "duree %.2f s au lieu de %.2f s" % (s["duree"], L)}
    meilleur = None
    for p in (0.5, 0.3, 0.7):
        a, b = image_decodee(src, de + p * L), image_decodee(dst, p * L)
        if not (a and b):
            continue
        if (a.size[0] > a.size[1]) != (b.size[0] > b.size[1]) or abs(a.size[0] - b.size[0]) > 1 or abs(a.size[1] - b.size[1]) > 1:
            return {"ok": False, "raison": "le sens ou la taille de l'image a change (%dx%d -> %dx%d)" % (a.size + b.size)}
        e = ecart_images(a, b)
        meilleur = e if meilleur is None else min(meilleur, e)
        if e <= ECART_RELU_MAX:
            break
    if meilleur is None or meilleur > ECART_RELU_MAX:
        return {"ok": False, "raison": "l'image ecrite ne ressemble pas a sa source (ecart %s)" % meilleur}
    return {"ok": True, "duree": round(s["duree"], 2), "ecart": round(meilleur, 1), "taille": [b.size[0], b.size[1]]}


def renommer(a, b, essais=5):
    """Un renommage ; sous Windows un antivirus ou l'indexation tient parfois un fichier neuf
    une seconde : on reessaie un peu avant d'abandonner."""
    for k in range(essais):
        try:
            return os.rename(a, b)
        except OSError:
            if k == essais - 1:
                raise
            time.sleep(0.5)


def nettoyer(d, motif):
    """Efface nos restes (dossiers ou fichiers dont le nom suit le motif), rien d'autre."""
    for x in os.listdir(d):
        if re.match(motif, x):
            f = os.path.join(d, x)
            if os.path.isdir(f):
                shutil.rmtree(f, ignore_errors=True)
            else:
                try:
                    os.remove(f)
                except OSError:
                    pass


def construire(chemin_plan, sortie):
    debut = time.time()
    plan, refus = lire_plan(chemin_plan)
    sortie = os.path.abspath(sortie)
    if plan:
        rr, ss = os.path.realpath(plan["rushes"]), os.path.realpath(sortie)
        if ss == rr or ss.startswith(rr + os.sep):
            refus.append("la sortie est dans le dossier des rushes : %s" % sortie)
        elif rr.startswith(ss + os.sep):
            refus.append("les rushes sont dans la sortie : %s" % sortie)
        if os.path.exists(sortie) and not os.path.isdir(sortie):
            refus.append("la sortie est un fichier : %s" % sortie)
        elif os.path.isdir(sortie) and not est_sortie(sortie) and any(re.match(r"^modele-\d+$", x) for x in os.listdir(sortie)):
            refus.append("la sortie contient deja des dossiers modele-* qui ne viennent pas de cet outil")
    enc = encodeur_h264() if not refus else []
    if not refus and not enc:
        refus.append("ce ffmpeg n'a aucun encodeur H.264")
    if refus or not plan:
        sortie_json(MARQUE, {"refus": refus})
        print("   PLAN REFUSE — rien n'est ecrit :")       # en dernier : le bureau montre les dernieres lignes
        for x in refus:
            print("   - %s" % latin(x))
        return 2
    os.makedirs(sortie, exist_ok=True)
    io.open(os.path.join(sortie, TEMOIN), "w").close()    # une coupure en route : la sortie reste reconnue
    # les restes d'un essai interrompu (une coupure en pleine bascule laisse la sortie SANS index.json : rien de valide)
    nettoyer(sortie, r"^(_en-cours-modele-\d+|_ancien-modele-\d+|index\.json\.ancien|(index|plan-modeles)\.json\.tmp)$")
    avert = list(plan["avertissements"])
    modeles = []

    def echec(e):
        nettoyer(sortie, r"^_en-cours-modele-\d+$")
        sortie_json(MARQUE, {"echec": str(e)})
        print("   ECHEC — rien n'est livre, l'ancienne livraison reste : %s" % latin(str(e)))
        return 1
    try:
        for k, m in enumerate(plan["modeles"], 1):
            tmp = os.path.join(sortie, "_en-cours-modele-%d" % k)
            os.makedirs(tmp)
            pris, fichiers = set(), []
            for s in m["segments"]:
                src = os.path.join(plan["rushes"], s["rush"])
                D = plan["durees"][s["rush"]]
                L = s["a"] - s["de"]
                if L < SEGMENT_MINI:
                    avert.append("%s : %s de %.2f a %.2f s trop court (moins de %.1f s), pas coupe"
                                 % (m["nom"], s["rush"], s["de"], s["a"], SEGMENT_MINI))
                    continue
                ext = os.path.splitext(src)[1].lower()
                # le fichier entier seulement si personne d'autre n'y touche : a 0,25 s pres, un lien
                # emporterait le bord d'un autre modele ou un instant exclu
                entier = bool(s.get("seul")) and s["de"] <= TOL_ENTIER and s["a"] >= D - TOL_ENTIER and ext in EXT_MONTAGE
                base = nom_sur(s["rush"]) + (ext if entier else "--t%.2f-%.2f.mp4" % (s["de"], s["a"]))
                nom, n = base, 2
                while nom.lower() in pris:
                    nom = re.sub(r"(\.[A-Za-z0-9]+)$", r"-%d\1" % n, base)
                    n += 1
                pris.add(nom.lower())
                dst = os.path.join(tmp, nom)
                sd = sonde(src)
                son = bool(sd and sd["audio"])
                if entier:
                    try:
                        os.link(src, dst)
                        comment = "lien"
                    except OSError:
                        shutil.copy2(src, dst)
                        comment = "copie"
                    de, L = 0.0, D
                else:
                    ok, msg = couper_video(src, s["de"], L, dst, enc)
                    if not ok and son:
                        # un son que ce ffmpeg ne sait pas lire (certains telephones) : le montage n'en a pas besoin
                        ok, _m = couper_video(src, s["de"], L, dst, enc, son=False)
                        if ok:
                            son = False
                            avert.append("%s : %s de %.2f a %.2f s coupe SANS son (son illisible : %s)"
                                         % (m["nom"], s["rush"], s["de"], s["a"], msg[:80]))
                    if not ok:
                        raise RuntimeError("coupe ratee : %s de %.2f a %.2f s — %s" % (s["rush"], s["de"], s["a"], msg))
                    comment, de = "coupe", s["de"]
                rl = relire(src, dst, de, L, comment, son)
                if not rl["ok"]:
                    raise RuntimeError("relecture ratee : %s (%s)" % (nom, rl.get("raison")))
                fichiers.append({"fichier": nom, "rush": s["rush"], "de": s["de"], "a": s["a"],
                                 "coloris": s["coloris"], "comment": comment, "duree": rl["duree"],
                                 "relu": {x: rl[x] for x in ("ecart", "taille") if x in rl}})
                print("   modele-%d/%s  <- %s %.2f-%.2f s (%s, relu)" % (k, latin(nom), latin(s["rush"]), s["de"], s["a"], comment))
            if not fichiers:
                raise RuntimeError("le modele %s n'a aucun segment utilisable" % m["nom"])
            modeles.append({"rang": k, "nom": m["nom"], "couleurs": m["couleurs"], "groupes": m.get("groupes"),
                            "dossier": os.path.join(sortie, "modele-%d" % k), "videos": len(fichiers),
                            "secondes": round(sum(f["duree"] for f in fichiers), 2), "fichiers": fichiers})
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as e:
        return echec(e)
    # tout est relu : on remplace l'ancienne livraison d'un coup. L'ancienne est d'abord mise de
    # cote par renommage : si une bascule echoue (Windows : un fichier ouvert ailleurs), tout revient.
    index_f = os.path.join(sortie, "index.json")
    anciens = sorted(x for x in os.listdir(sortie) if re.match(r"^modele-\d+$", x))
    de_cote, poses = [], []
    try:
        if os.path.isfile(index_f):
            os.replace(index_f, index_f + ".ancien")
        for x in anciens:
            renommer(os.path.join(sortie, x), os.path.join(sortie, "_ancien-" + x))
            de_cote.append(x)
        for m in modeles:
            renommer(os.path.join(sortie, "_en-cours-modele-%d" % m["rang"]), m["dossier"])
            poses.append(m)
    except OSError as e:
        for m in poses:
            try:
                renommer(m["dossier"], os.path.join(sortie, "_en-cours-modele-%d" % m["rang"]))
            except OSError:
                pass
        for x in de_cote:
            try:
                renommer(os.path.join(sortie, "_ancien-" + x), os.path.join(sortie, x))
            except OSError:
                pass
        if os.path.isfile(index_f + ".ancien") and not os.path.exists(index_f):
            os.replace(index_f + ".ancien", index_f)
        return echec("bascule impossible : %s" % e)
    nettoyer(sortie, r"^_ancien-modele-\d+$")
    # le plan des dossiers plats, pour MONTER-10 --plan (controle « un seul modele » compris)
    plan_modeles = {"rushes": sortie, "modeles": [
        {"nom": m["nom"], "couleurs": m["couleurs"],
         "segments": [{"rush": "modele-%d/%s" % (m["rang"], f["fichier"]), "de": 0.0, "a": f["duree"],
                       "coloris": f["coloris"]} for f in m["fichiers"]]} for m in modeles], "exclusions": []}
    chemin_pm = ecrire_json(os.path.join(sortie, "plan-modeles.json"), plan_modeles)
    index = {"version": VERSION, "quoi": MARQUE, "plan": os.path.abspath(chemin_plan), "rushes": plan["rushes"],
             "sortie": sortie, "modeles": modeles, "avertissements": avert,
             "exclusions": [{x: e[x] for x in ("rush", "de", "a", "pourquoi")} for e in plan["exclusions"]],
             "plan_modeles": chemin_pm, "secondes": round(time.time() - debut, 1)}
    ecrire_json(index_f, index)
    nettoyer(sortie, r"^index\.json\.ancien$")
    for a in avert:
        print("   ATTENTION : %s" % latin(a))
    print("   %d modele(s) -> %s  (%.1f s)" % (len(modeles), sortie, time.time() - debut))
    sortie_json(MARQUE, {"index": index_f, "plan_modeles": chemin_pm,
                         "modeles": [{x: m[x] for x in ("rang", "nom", "dossier", "videos", "secondes", "couleurs")}
                                     for m in modeles], "avertissements": avert})
    return 0


# ======================================================================
# 9. L'AUTO-TEST — des videos fabriquees ici, dont on CONNAIT la reponse
# ======================================================================

def _essai(nom, cond, detail=""):
    print("  [%s] %s%s" % ("OK  " if cond else "FAUX", nom, ("  -> " + str(detail)[:220]) if not cond else ""))
    return bool(cond)


NOIR, BEIGE, ROUGE, BLEU, VERT, JAUNE = (35, 35, 40), (196, 168, 128), (175, 40, 45), (40, 60, 160), (60, 140, 70), (215, 185, 45)


def _image_essai(W, H, t, modele, couleur, phase, rng):
    """Un mur, un sol, une « tete », et un vetement dont la FORME dit le modele :
    X = abaya unie a parementure claire ; Y = veste a revers et boutons sur
    une jupe droite ; Z = manteau a panneaux verticaux bicolores."""
    import numpy as np
    a = np.empty((H, W, 3), np.float32)
    a[:] = (205, 200, 192)
    a[int(H * .80):] = (125, 115, 105)
    a[:int(H * .80), int(W * .06):int(W * .08)] = (160, 155, 150)
    yy, xx = np.mgrid[0:H, 0:W]
    cx = W * 0.5 + W * 0.05 * math.sin(1.3 * t + phase)
    ech = 1.0 + 0.03 * math.sin(0.7 * t + phase)
    c = np.array(couleur, np.float32)
    clair = np.minimum(c + 80, 255)

    def bande(y0, y1):
        return (yy >= H * y0) & (yy < H * y1)
    if modele == "X":
        hw = W * (0.14 + 0.09 * (yy - H * 0.22) / (H * 0.70)) * ech
        m = bande(0.22, 0.92) & (np.abs(xx - cx) <= hw)
        a[m] = c
        a[m & (np.abs(xx - cx) <= 1.5)] = clair
    elif modele == "Y":
        veste = bande(0.22, 0.52) & (np.abs(xx - cx) <= W * 0.21 * ech)
        a[veste] = c
        a[veste & (yy < H * 0.38) & (np.abs(xx - cx) < (yy - H * 0.22) * 0.45)] = c * 0.55
        for yb in (0.40, 0.46):
            a[np.hypot(xx - cx, yy - H * yb) <= 3] = clair
        a[bande(0.52, 0.54) & (np.abs(xx - cx) <= W * 0.21 * ech)] = c * 0.35
        a[bande(0.54, 0.92) & (np.abs(xx - cx) <= W * 0.12 * ech)] = c
    else:
        hw = W * 0.19 * ech
        m = bande(0.22, 0.92) & (np.abs(xx - cx) <= hw)
        k = np.floor((xx - (cx - hw)) / (W * 0.065)).astype(int)
        c2 = c * 0.45 if c.mean() > 100 else c + (255 - c) * 0.5
        a[m & (k % 2 == 0)] = c
        a[m & (k % 2 == 1)] = c2
    a[(((xx - cx) / (W * .075)) ** 2 + ((yy - H * .14) / (H * .055)) ** 2) <= 1] = (60, 50, 50)
    a += rng.normal(0, 3.0, a.shape)
    return np.clip(a, 0, 255).astype(np.uint8)


def _video_essai(dest, morceaux, son=False, rotation=False, noir_debut=0.0, graine=0, W=216, H=384, fps=10):
    """morceaux = [(secondes, modele, couleur)]. rotation : rangee couchee AVEC
    l'etiquette de rotation (ffmpeg la sort droite toute seule)."""
    import numpy as np
    rng = np.random.default_rng(graine)
    enc = encodeur_h264() or ["-c:v", "mpeg4", "-q:v", "3"]
    total = noir_debut + sum(m[0] for m in morceaux)
    ww, hh = (H, W) if rotation else (W, H)
    brut = dest + ".brut.mp4" if rotation else dest
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (ww, hh),
           "-r", str(fps), "-i", "-"]
    if son:
        cmd += ["-f", "lavfi", "-i", "sine=frequency=440:duration=%.2f" % total]
    cmd += enc + ["-pix_fmt", "yuv420p"] + (["-c:a", "aac", "-shortest"] if son else []) + [brut]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    phase = graine * 0.9
    for i in range(int(round(total * fps))):
        t = i / float(fps)
        if t < noir_debut:
            img = np.zeros((H, W, 3), np.uint8)
        else:
            x, mod = t - noir_debut, morceaux[-1]
            for m in morceaux:
                if x < m[0]:
                    mod = m
                    break
                x -= m[0]
            img = _image_essai(W, H, t, mod[1], mod[2], phase, rng)
        if rotation:
            img = np.ascontiguousarray(np.rot90(img, k=-1))
        try:
            p.stdin.write(img.tobytes())
        except BrokenPipeError:
            break
    p.stdin.close()
    p.wait()
    if rotation:
        r = lancer(["ffmpeg", "-v", "error", "-y", "-display_rotation", "90", "-i", brut, "-c", "copy", dest], 300)
        try:
            os.remove(brut)
        except OSError:
            pass
        return r.returncode == 0 and os.path.isfile(dest)
    return p.returncode == 0 and os.path.isfile(dest)


def _verite(rush, t, verite):
    for de, a, mod in verite.get(rush, []):
        if de <= t < a:
            return mod
    return None


def _purete(r, verite):
    """Pour chaque groupe : la part (en secondes) de son modele principal."""
    out = {}
    for g in r["groupes"]:
        par = {}
        for tid in g["troncons"]:
            t = next(x for x in r["troncons"] if x["id"] == tid)
            x = t["de"]
            while x < t["a"] - 1e-6:
                y = min(t["a"], x + 0.1)
                mod = _verite(t["rush"], (x + y) / 2.0, verite)
                par[mod] = par.get(mod, 0.0) + (y - x)
                x = y
        tot = sum(par.values()) or 1.0
        out[g["id"]] = (max(par, key=par.get), max(par.values()) / tot)
    return out


def verifier():
    import numpy as np
    print(BARRE)
    print("  CONTROLES DE LA SEPARATION — version %s" % VERSION)
    print(BARRE)
    ok = True
    tmp = tempfile.mkdtemp(prefix="separer-essai-")
    try:
        # --- ffmpeg de cette machine : on ne suppose rien
        ok &= _essai("ffmpeg et ffprobe repondent",
                     lancer(["ffmpeg", "-version"], 60).returncode == 0 and lancer(["ffprobe", "-version"], 60).returncode == 0)
        enc = encodeur_h264()
        ok &= _essai("ce ffmpeg a un encodeur H.264", bool(enc), enc)
        v = os.path.join(tmp, "mire.mp4")
        r = lancer(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=6:size=320x240:rate=10",
                    "-pix_fmt", "yuv420p", v], 300)
        ok &= _essai("ffmpeg de cette machine fabrique une video", os.path.isfile(v), erreur(r))
        serie = lire_serie(v, 1.0, False, tmp) if os.path.isfile(v) else []
        ok &= _essai("et la VRAIE lecture en tire des images mesurees",
                     len(serie) >= 4 and all(k in serie[0] for k in ("couleur", "cotes", "forme", "plat")), len(serie))

        # --- le decoupage couleur, sur des series dont on connait la reponse
        def fm(c, plat=False):
            return {"couleur": c, "plat": plat}
        s3 = [fm((40, 40, 42))] * 10 + [fm((150, 150, 152))] * 10 + [fm((110, 70, 45))] * 10
        ok &= _essai("trois couleurs de suite -> trois morceaux", len(couper_couleur(s3, range(30))) == 3)
        s1 = [fm((40, 40, 42))] * 10 + [fm((240, 10, 10))] + [fm((40, 40, 42))] * 10
        ok &= _essai("une image intruse ne coupe pas", len(couper_couleur(s1, range(21))) == 1)
        sn = [fm((40, 40, 42))] * 6 + [fm((0, 0, 0), True)] + [fm((40, 40, 42))] * 6
        ok &= _essai("une image noire entre deux ne coupe pas", len(couper_couleur(sn, range(13))) == 1)
        court = recoller_courts(s3, [[0, 1], list(range(2, 12)), list(range(12, 30))], 3)
        ok &= _essai("un morceau trop court est recolle, pas jete",
                     sorted(i for m in court for i in m) == list(range(30)) and len(court) == 2, court)

        # --- LOT A : a plat. Deux modeles de la MEME couleur dans deux videos,
        # un modele en deux couleurs, deux modeles dans UNE video, un modele qui
        # change de couleur toutes les 1,6 s apres une seconde de noir.
        A = os.path.join(tmp, "lot-a")
        os.makedirs(A)
        fab = [("a-1.mp4", [(8, "X", NOIR)], {}), ("a-2.mp4", [(8, "Y", NOIR)], {}),
               ("a-3.mp4", [(5, "X", BEIGE), (5, "X", ROUGE)], {}),
               ("a-4.mp4", [(6, "Y", ROUGE), (6, "Z", BLEU)], {"son": True}),
               ("a-5.mp4", [(1.6, "X", ROUGE), (1.6, "X", BLEU), (1.6, "X", JAUNE), (1.6, "X", VERT)], {"noir_debut": 1.0})]
        for g, (n, ms, opt) in enumerate(fab):
            ok &= _essai("video fabriquee %s" % n, _video_essai(os.path.join(A, n), ms, graine=g, **opt))
        verite = {"a-1.mp4": [(0, 8, "X")], "a-2.mp4": [(0, 8, "Y")], "a-3.mp4": [(0, 10, "X")],
                  "a-4.mp4": [(0, 6, "Y"), (6, 12, "Z")], "a-5.mp4": [(1.0, 7.4, "X")]}
        lotA = os.path.join(tmp, "sortie-a")
        # les bandeaux de TOUTES les planches sont notes au passage : le nombre annonce ne doit y etre nulle part
        bandeaux, _planche = [], globals()["planche"]

        def _noter(cartes, titre, sous_titre, dest, colonnes=COLONNES):
            bandeaux.append("%s | %s" % (titre, sous_titre))
            return _planche(cartes, titre, sous_titre, dest, colonnes)
        globals()["planche"] = _noter
        try:
            r = candidats(A, lotA, 3)
        finally:
            globals()["planche"] = _planche
        print(vue(r))
        ok &= _essai("le nombre annonce par le client n'est ecrit sur AUCUNE planche (Claude ne s'y cale pas)",
                     bandeaux and not any(re.search(r"cible|modele", b, re.I) for b in bandeaux), bandeaux)
        pur = _purete(r, verite)
        ok &= _essai("chaque groupe ne porte QU'UN modele (purete 100 %)",
                     all(p >= 0.93 for _m, p in pur.values()), pur)
        gid = {t["rush"]: set() for t in r["troncons"]}
        for t in r["troncons"]:
            gid[t["rush"]].add(t["groupe"])
        ok &= _essai("deux modeles de la meme couleur (noir) dans deux videos : jamais le meme groupe",
                     not (gid["a-1.mp4"] & gid["a-2.mp4"]), gid)
        ok &= _essai("un modele en deux couleurs dans une video : un seul groupe", len(gid["a-3.mp4"]) == 1, gid["a-3.mp4"])
        ok &= _essai("deux modeles dans une video : deux groupes", len(gid["a-4.mp4"]) == 2, gid["a-4.mp4"])
        v4 = next(x for x in r["videos"] if x["rush"] == "a-4.mp4")
        ok &= _essai("la video coupee pres de 6 s (la ou le modele change)",
                     len(v4["coupes_structure"]) == 1 and abs(v4["coupes_structure"][0] - 6.0) <= 0.8, v4["coupes_structure"])
        ok &= _essai("aucune autre video n'est coupee par la structure",
                     all(not x["coupes_structure"] for x in r["videos"] if x["rush"] != "a-4.mp4"),
                     [(x["rush"], x["coupes_structure"]) for x in r["videos"]])
        g5 = next(g for g in r["groupes"] if "a-5.mp4" in g["rushes"])
        ok &= _essai("le modele qui change de couleur toutes les 1,6 s : au moins trois couleurs vues",
                     len(g5["couleurs"]) >= 3, g5["couleurs"])
        couvre = True
        for x in r["videos"]:
            iv = sorted([(t["de"], t["a"]) for t in r["troncons"] if t["rush"] == x["rush"]]
                        + [(e["de"], e["a"]) for e in r["ecartes"] if e["rush"] == x["rush"]])
            couvre &= iv[0][0] == 0.0 and abs(iv[-1][1] - x["duree"]) < 0.05 and all(abs(iv[i][1] - iv[i + 1][0]) < 1e-6 for i in range(len(iv) - 1))
        ok &= _essai("rien n'est jete en silence : troncons + ecartes couvrent chaque video de 0 a la fin", couvre)
        e5 = [e for e in r["ecartes"] if e["rush"] == "a-5.mp4"]
        ok &= _essai("la seconde de noir est ECARTEE et nommee (pas perdue)",
                     len(e5) == 1 and e5[0]["de"] == 0.0 and abs(e5[0]["a"] - 1.0) <= 0.45 and "plate" in e5[0]["pourquoi"], e5)
        prop = sorted(sorted(set(_verite(t["rush"], (t["de"] + t["a"]) / 2, verite) for gg in p
                                 for t in r["troncons"] if t["groupe"] == gg)) for p in r["proposition"])
        ok &= _essai("la proposition pour trois modeles retrouve X, Y et Z", prop == [["X"], ["Y"], ["Z"]], (r["proposition"], prop))
        # ESTIMER (08/10/2026) : la structure seule compte trois modeles (X, Y, Z), quelles que soient leurs couleurs
        ok &= _essai("estimes : la structure distingue trois modeles (X, Y, Z), jamais la couleur",
                     r.get("estimes") == 3, (r.get("estimes"), r.get("estimes_amas"), r.get("estimes_ecarts")))
        ok &= _essai("chaque fusion proposee est marquee a verifier", r["liens"] and all(l["a_verifier"] for l in r["liens"]))
        from PIL import Image
        pl = [p for g in r["groupes"] for p in g["planches"]] + r["planches"]["apercu"] + r["planches"]["ecartes"]
        ok &= _essai("une planche JPG par groupe + l'apercu + les ecartes, qui s'ouvrent",
                     all(g["planches"] for g in r["groupes"]) and all(min(Image.open(p).size) >= 300 for p in pl), [(os.path.basename(p), Image.open(p).size) for p in pl])
        relu = json.load(io.open(os.path.join(lotA, "candidats.json"), encoding="utf-8"))
        ok &= _essai("candidats.json relisible, avec groupes, troncons, proposition et ecartes",
                     all(k in relu for k in ("groupes", "troncons", "proposition", "ecartes", "videos", "cible")) and relu["cible"] == 3)

        # --- LOT B : des sous-dossiers. Le modele a en deux couleurs (dont une
        # moitie « Videos »), le modele b de la MEME couleur que l'une d'elles.
        B = os.path.join(tmp, "lot-b")
        for d in ("modele-a/Videos", "modele-b", "_brouillon"):
            os.makedirs(os.path.join(B, d))
        ok &= _essai("lot B fabrique",
                     _video_essai(os.path.join(B, "modele-a/Videos/b-1.mp4"), [(6, "X", ROUGE)], graine=7)
                     and _video_essai(os.path.join(B, "modele-a/b-2.mp4"), [(6, "X", VERT)], graine=8)
                     and _video_essai(os.path.join(B, "modele-b/b-3.mp4"), [(6, "Y", ROUGE)], graine=9)
                     and _video_essai(os.path.join(B, "_brouillon/b-9.mp4"), [(4, "Z", BLEU)], graine=10))
        env = dict(os.environ, MANITA_JSON="1")
        rb = subprocess.run([sys.executable, os.path.abspath(__file__), "--candidats", "--rushes", B,
                             "--sortie", os.path.join(tmp, "sortie-b"), "--modeles", "2"],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env, timeout=900)
        lignes = [l for l in rb.stdout.splitlines() if l.startswith("MANITA_JSON ")]
        jb = json.loads(lignes[-1][12:]) if lignes else {}
        ok &= _essai("la ligne MANITA_JSON est imprimee (code 0)", rb.returncode == 0 and jb.get("quoi") == "separer-candidats",
                     (rb.returncode, rb.stderr[-300:]))
        cb = json.load(io.open(os.path.join(tmp, "sortie-b", "candidats.json"), encoding="utf-8")) if jb else {}
        grp = sorted(sorted(g["rushes"]) for g in cb.get("groupes", []))
        ok &= _essai("sous-dossiers : deux groupes, un par dossier (les deux couleurs du modele a ensemble)",
                     grp == [["modele-a/Videos/b-1.mp4", "modele-a/b-2.mp4"], ["modele-b/b-3.mp4"]], grp)
        ok &= _essai("estimes : deux sous-dossiers ne se rejoignent jamais (2), dit dans la ligne MANITA_JSON",
                     cb.get("estimes") == 2 and jb.get("estimes") == 2 and jb.get("fin") is False, (cb.get("estimes"), jb.get("estimes")))
        ok &= _essai("l'indice d'arborescence est fort, le dossier _brouillon est ignore",
                     cb.get("arborescence", {}).get("indice") == "fort" and not any("_brouillon" in v["rush"] for v in cb.get("videos", [])),
                     cb.get("arborescence"))
        env = dossiers_modeles(["Lot/a/Videos/1.mp4", "Lot/a/2.mp4", "Lot/b/3.mp4"]), dossiers_modeles(["Lot/1.mp4", "Lot/2.mp4"]), \
            dossiers_modeles(["1.mp4", "a/2.mp4"])
        ok &= _essai("un dossier qui enveloppe TOUT le lien ne dit rien des modeles (sinon un seul groupe pour tout)",
                     env == ({"Lot/a/Videos/1.mp4": "a", "Lot/a/2.mp4": "a", "Lot/b/3.mp4": "b"}, {"Lot/1.mp4": "", "Lot/2.mp4": ""},
                             {"1.mp4": "", "a/2.mp4": "a"}), env)

        # --- une abaya de la couleur du mur : personne n'est repere, la video n'est pas jetee pour autant
        C = os.path.join(tmp, "lot-c")
        os.makedirs(C)
        ok &= _essai("lot C fabrique", _video_essai(os.path.join(C, "mur.mp4"), [(6, "X", (207, 201, 193))], graine=12)
                     and _video_essai(os.path.join(C, "c-2.mp4"), [(6, "Y", NOIR)], graine=13))
        rc = candidats(C, os.path.join(tmp, "sortie-c"), 2)
        gm = [g for g in rc["groupes"] if "mur.mp4" in g["rushes"]]
        ok &= _essai("une video ou personne n'est repere reste un groupe (marque « incertain », avec un doute)",
                     len(gm) == 1 and gm[0]["doutes"] and all(t.get("sujet") == "incertain" for t in rc["troncons"] if t["rush"] == "mur.mp4"),
                     [(g["id"], g["rushes"], g["doutes"]) for g in rc["groupes"]])

        # --- --construire sur le lot A
        plan = {"rushes": A, "cible": 3, "modeles": [
            {"nom": "Modele X", "couleurs": ["noir", "beige", "rouge"], "segments": [
                {"rush": "a-1.mp4", "de": 0.0, "a": 8.0, "coloris": "noir"},
                {"rush": "a-3.mp4", "de": 0.0, "a": 5.0, "coloris": "beige"},
                {"rush": "a-3.mp4", "de": 5.0, "a": 10.0, "coloris": "rouge"}]},
            {"nom": "Modele Y", "couleurs": ["noir", "rouge"], "segments": [
                {"rush": "a-2.mp4", "de": 0.0, "a": 8.0, "coloris": "noir"},
                {"rush": "a-4.mp4", "de": 0.0, "a": 6.0, "coloris": "rouge"}]},
            {"nom": "Modele Z", "couleurs": ["bleu"], "segments": [
                {"rush": "a-4.mp4", "de": 6.0, "a": 12.0, "coloris": "bleu"}]}],
            "exclusions": [{"rush": "a-5.mp4", "de": 0.0, "a": 1.0, "pourquoi": "noir du debut"}]}

        def ecrire_plan(p, nom):
            c = os.path.join(tmp, nom)
            with io.open(c, "w", encoding="utf-8") as f:
                f.write(json.dumps(p, ensure_ascii=False))
            return c
        mods = os.path.join(tmp, "lot-a-sortie", "modeles")
        code = construire(ecrire_plan(plan, "plan.json"), mods)
        ok &= _essai("--construire rend 0", code == 0, code)
        idx = json.load(io.open(os.path.join(mods, "index.json"), encoding="utf-8")) if code == 0 else {"modeles": []}
        ok &= _essai("trois dossiers PLATS modele-1, modele-2, modele-3",
                     sorted(x for x in os.listdir(mods) if os.path.isdir(os.path.join(mods, x))) == ["modele-1", "modele-2", "modele-3"]
                     and all(not os.path.isdir(os.path.join(mods, d, x)) for d in ("modele-1", "modele-2", "modele-3")
                             for x in os.listdir(os.path.join(mods, d))))
        f1 = {f["rush"] + "@%g" % f["de"]: f for m in idx["modeles"] for f in m["fichiers"]}
        ok &= _essai("le fichier entier est un LIEN DUR (meme fichier, aucune copie)",
                     f1.get("a-1.mp4@0", {}).get("comment") == "lien"
                     and os.path.samefile(os.path.join(A, "a-1.mp4"), os.path.join(mods, "modele-1", f1["a-1.mp4@0"]["fichier"])), f1.get("a-1.mp4@0"))
        coupes = [f for m in idx["modeles"] for f in m["fichiers"] if f["comment"] == "coupe"]
        sondes = {f["fichier"]: sonde(os.path.join(m["dossier"], f["fichier"])) for m in idx["modeles"] for f in m["fichiers"] if f["comment"] == "coupe"}
        ok &= _essai("chaque troncon partiel est COUPE, reencode en H.264, a la bonne duree",
                     len(coupes) == 4 and all(sondes[f["fichier"]]["codec"] == "h264" and abs(sondes[f["fichier"]]["duree"] - (f["a"] - f["de"])) <= 0.3 for f in coupes),
                     [(f["fichier"], sondes[f["fichier"]]) for f in coupes])
        ok &= _essai("le son de la video qui en a un est garde (AAC)",
                     all(sondes[f["fichier"]]["audio"] == "aac" for f in coupes if f["rush"] == "a-4.mp4"))
        ok &= _essai("chaque fichier ecrit a ete RELU contre sa source", all("relu" in f for m in idx["modeles"] for f in m["fichiers"]))
        # jamais deux modeles : chaque fichier vient d'un instant de SON modele
        # (verite des videos fabriquees), et la coupe a 6 s ne deborde pas :
        # aucune image rouge dans le Z, aucune bleue dans le Y de a-4.
        attendu = {"Modele X": "X", "Modele Y": "Y", "Modele Z": "Z"}
        bon_modele = all(_verite(f["rush"], f["de"] + 0.01, verite) == attendu[m["nom"]] == _verite(f["rush"], f["a"] - 0.01, verite)
                         for m in idx["modeles"] for f in m["fichiers"])
        for m in idx["modeles"]:
            for f in m["fichiers"]:
                if f["rush"] != "a-4.mp4":
                    continue
                interdit = ROUGE if m["nom"] == "Modele Z" else BLEU
                for p in (0.02, 0.25, 0.5, 0.75, 0.98):
                    im = image_decodee(os.path.join(m["dossier"], f["fichier"]), p * f["duree"])
                    bon_modele &= im is not None and ecart(mesurer(np.asarray(im))["couleur"], interdit) > SAUT_TENUE
        ok &= _essai("jamais deux modeles : chaque fichier vient de SON modele, la coupe ne deborde pas", bon_modele)
        try:
            import importlib.util
            sys.dont_write_bytecode = True      # aucun __pycache__ laisse dans le paquet
            sp = importlib.util.spec_from_file_location("monter10", os.path.join(os.path.dirname(os.path.abspath(__file__)), "MONTER-10.py"))
            M10 = importlib.util.module_from_spec(sp)
            sp.loader.exec_module(M10)
            p1 = M10.lire_plan(os.path.join(tmp, "plan.json"))
            p2 = M10.lire_plan(os.path.join(mods, "plan-modeles.json"))
            lisible = len(p1["modeles"]) == 3 and len(p2["modeles"]) == 3 and all(
                os.path.isfile(os.path.join(p2["rushes"], s["rush"])) for m in p2["modeles"] for s in m["segments"])
            ok &= _essai("le plan et plan-modeles.json se lisent par lire_plan de MONTER-10", lisible)
        except Exception as e:
            ok &= _essai("le plan et plan-modeles.json se lisent par lire_plan de MONTER-10", False, e)
        avant = sorted(os.listdir(os.path.join(mods, "modele-2")))
        ok &= _essai("relancer --construire redonne la meme chose, sans reste",
                     construire(os.path.join(tmp, "plan.json"), mods) == 0 and sorted(os.listdir(os.path.join(mods, "modele-2"))) == avant
                     and not any(x.startswith("_en-cours") for x in os.listdir(mods)))
        # les refus : rien n'est ecrit
        mauvais = json.loads(json.dumps(plan))
        mauvais["modeles"][1]["segments"][1]["a"] = 7.5           # Y deborde sur Z (6-12 s)
        neuf = os.path.join(tmp, "refus", "modeles")
        ok &= _essai("un plan qui donne le meme instant a deux modeles est REFUSE, rien n'est ecrit",
                     construire(ecrire_plan(mauvais, "chevauche.json"), neuf) == 2 and not os.path.exists(neuf))
        # le bureau laisse passer 0,3 s entre deux modeles : ce bord ne va a PERSONNE (jamais un lot rate pour ca)
        bord = json.loads(json.dumps(plan))
        bord["modeles"][1]["segments"][1]["a"] = 6.2               # Y : 0-6,2 s
        bord["modeles"][2]["segments"][0]["de"] = 5.9              # Z : 5,9-12 s
        sb = os.path.join(tmp, "bord", "modeles")
        fb = {}
        if construire(ecrire_plan(bord, "bord.json"), sb) == 0:
            fb = {m["nom"]: f for m in json.load(io.open(os.path.join(sb, "index.json"), encoding="utf-8"))["modeles"]
                  for f in m["fichiers"] if f["rush"] == "a-4.mp4"}
        ok &= _essai("0,3 s disputees entre deux modeles : retirees aux DEUX (Y finit a 5,9 s, Z commence a 6,2 s)",
                     fb.get("Modele Y", {}).get("a") == 5.9 and fb.get("Modele Z", {}).get("de") == 6.2, fb)
        # un instant exclu donne a un modele : il est RETIRE, jamais livre (une exclusion ne fait que retirer)
        exclu = json.loads(json.dumps(plan))
        exclu["modeles"][0]["segments"].append({"rush": "a-5.mp4", "de": 0.0, "a": 4.0, "coloris": "rouge"})
        exclu["exclusions"].append({"rush": "inconnu.mp4", "de": 0, "a": 1})          # illisible : ignoree, pas fatale
        se = os.path.join(tmp, "exclu", "modeles")
        fe = []
        if construire(ecrire_plan(exclu, "exclu.json"), se) == 0:
            fe = [f for m in json.load(io.open(os.path.join(se, "index.json"), encoding="utf-8"))["modeles"]
                  for f in m["fichiers"] if f["rush"] == "a-5.mp4"]
        ok &= _essai("un instant EXCLU donne a un modele est retire (a-5 livre de 1 a 4 s seulement)",
                     len(fe) == 1 and fe[0]["de"] == 1.0 and fe[0]["a"] == 4.0 and fe[0]["comment"] == "coupe", fe)
        exclu = json.loads(json.dumps(plan))
        exclu["exclusions"].append({"rush": "a-2.mp4", "de": 0, "a": 8})
        garde = construire(ecrire_plan(exclu, "exclu2.json"), os.path.join(tmp, "exclu2")) == 0
        exclu["exclusions"].append({"rush": "a-4.mp4", "de": 0, "a": 6})
        ok &= _essai("un segment tout exclu est retire, le modele garde le reste ; un modele TOUT exclu -> refuse",
                     garde and construire(ecrire_plan(exclu, "exclu3.json"), os.path.join(tmp, "exclu3")) == 2)
        # un fichier entier a 0,25 s pres n'est un lien QUE si personne d'autre n'y touche
        bout = json.loads(json.dumps(plan))
        bout["modeles"][0]["segments"][0]["de"] = 0.2
        bout["exclusions"].append({"rush": "a-1.mp4", "de": 0.0, "a": 0.2, "pourquoi": "noir"})
        sl = os.path.join(tmp, "bout", "modeles")
        fl = []
        if construire(ecrire_plan(bout, "bout.json"), sl) == 0:
            fl = [f for m in json.load(io.open(os.path.join(sl, "index.json"), encoding="utf-8"))["modeles"]
                  for f in m["fichiers"] if f["rush"] == "a-1.mp4"]
        ok &= _essai("segment 0,2-8 s avec 0-0,2 s exclu : COUPE, pas un lien qui livrerait l'instant exclu",
                     len(fl) == 1 and fl[0]["comment"] == "coupe", fl)
        # le MEME fichier sous deux noms (lien dur, ou la casse sur un disque Mac / Windows) : le meme instant
        os.link(os.path.join(A, "a-2.mp4"), os.path.join(A, "a-2-bis.mp4"))
        mauvais = json.loads(json.dumps(plan))
        mauvais["modeles"][0]["segments"].append({"rush": "a-2-bis.mp4", "de": 0.0, "a": 4.0})
        ok &= _essai("le meme fichier sous deux noms donne a deux modeles : refuse",
                     construire(ecrire_plan(mauvais, "deuxnoms.json"), neuf) == 2 and not os.path.exists(neuf))
        os.remove(os.path.join(A, "a-2-bis.mp4"))
        # le meme rush ecrit avec ses accents de deux facons (Mac / Windows) reste le meme rush
        shutil.copy(os.path.join(A, "a-1.mp4"), os.path.join(A, unicodedata.normalize("NFC", "vid\u00e9o-\u00e9t\u00e9.mp4")))
        mauvais = json.loads(json.dumps(plan))
        mauvais["modeles"][0]["segments"].append({"rush": unicodedata.normalize("NFC", "vid\u00e9o-\u00e9t\u00e9.mp4"), "de": 0.0, "a": 4.0})
        mauvais["modeles"][1]["segments"].append({"rush": unicodedata.normalize("NFD", "vid\u00e9o-\u00e9t\u00e9.mp4"), "de": 3.0, "a": 6.0})
        ok &= _essai("le meme rush ecrit avec deux accents differents dans deux modeles : refuse",
                     construire(ecrire_plan(mauvais, "accents.json"), neuf) == 2 and not os.path.exists(neuf))
        os.remove(os.path.join(A, unicodedata.normalize("NFC", "vid\u00e9o-\u00e9t\u00e9.mp4")))
        mauvais = json.loads(json.dumps(plan))
        mauvais["modeles"][2]["nom"] = "modele x"
        ok &= _essai("deux modeles du meme nom sont refuses", construire(ecrire_plan(mauvais, "nom.json"), neuf) == 2)
        mauvais = json.loads(json.dumps(plan))
        mauvais["modeles"][2]["segments"][0]["rush"] = "../plan.json"
        ok &= _essai("un rush hors du dossier est refuse", construire(ecrire_plan(mauvais, "hors.json"), neuf) == 2)
        ok &= _essai("une sortie dans le dossier des rushes est refusee",
                     construire(os.path.join(tmp, "plan.json"), os.path.join(A, "modeles")) == 2 and not os.path.exists(os.path.join(A, "modeles")))

        # --- le sens de l'image : une video rangee couchee avec l'etiquette de rotation
        R = os.path.join(tmp, "lot-r")
        os.makedirs(R)
        ok &= _essai("video couchee AVEC etiquette de rotation fabriquee",
                     _video_essai(os.path.join(R, "r.mp4"), [(8, "Z", JAUNE)], son=True, rotation=True, graine=11))
        src_im = image_decodee(os.path.join(R, "r.mp4"), 4.0)
        tete = np.asarray(src_im)[int(384 * .10):int(384 * .18), int(216 * .35):int(216 * .65)].mean(axis=2).min() if src_im else 255
        ok &= _essai("ffmpeg la sort droite (portrait, la tete en haut)", src_im is not None and src_im.size == (216, 384) and tete < 90,
                     (src_im.size if src_im else None, tete))
        pr = ecrire_plan({"rushes": R, "modeles": [{"nom": "R", "segments": [{"rush": "r.mp4", "de": 2.0, "a": 6.0, "coloris": "jaune"}]}]}, "plan-r.json")
        mr = os.path.join(tmp, "lot-r-sortie")
        ok &= _essai("la coupe d'une video tournee rend 0", construire(pr, mr) == 0)
        fr = [x for x in os.listdir(os.path.join(mr, "modele-1"))] if os.path.isdir(os.path.join(mr, "modele-1")) else []
        im = image_decodee(os.path.join(mr, "modele-1", fr[0]), 2.0) if fr else None
        ok &= _essai("la coupe garde le sens : meme image droite que la source, au meme instant",
                     im is not None and im.size == src_im.size and ecart_images(im, image_decodee(os.path.join(R, "r.mp4"), 4.0)) <= ECART_RELU_MAX,
                     (im.size if im else None))

        # --- --planches : une photo par modele
        dp = os.path.join(tmp, "planches-modeles")
        ok &= _essai("--planches ecrit une image par modele",
                     planches_plan(os.path.join(tmp, "plan.json"), dp) == 0
                     and sorted(os.listdir(dp)) == ["modele-1.jpg", "modele-2.jpg", "modele-3.jpg"]
                     and all(Image.open(os.path.join(dp, x)).size[0] >= 600 for x in os.listdir(dp)))
    except Exception as e:
        import traceback
        traceback.print_exc()
        ok &= _essai("l'auto-test tourne jusqu'au bout", False, e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(BARRE)
    print("  TOUT EST BON." if ok else "  IL Y A UNE FAUTE — on ne livre pas.")
    print(BARRE)
    return 0 if ok else 1


# ======================================================================

def main():
    p = argparse.ArgumentParser(description="separer les modeles d'un lien Drive (candidats, planches, construction)")
    p.add_argument("--candidats", action="store_true", help="troncons, groupes candidats et planches")
    p.add_argument("--planches", action="store_true", help="une planche par modele d'un plan")
    p.add_argument("--construire", action="store_true", help="un dossier plat par modele")
    p.add_argument("--verifier", action="store_true", help="l'auto-test")
    p.add_argument("--rushes", help="le dossier des videos (sous-dossiers compris)")
    p.add_argument("--sortie", help="le dossier du lot (candidats) ou des modeles (construire)")
    p.add_argument("--modeles", type=int, default=0, help="combien de modeles le client annonce")
    p.add_argument("--plan", help="le plan.json (format MONTER-10 --plan)")
    p.add_argument("--fin", action="store_true", help="(--candidats) relance plus fine : un groupe douteux")
    a = p.parse_args()
    for flux in (sys.stdout, sys.stderr):
        try:   # le bureau surveille la sortie : rien ne dort dans un tampon ; une console Windows non UTF-8 ne plante pas
            flux.reconfigure(line_buffering=True, errors="replace")
        except Exception:
            pass
    if a.verifier:
        return verifier()
    if a.candidats:
        if not (a.rushes and a.sortie):
            print("--candidats demande --rushes et --sortie")
            return 2
        if not os.path.isdir(a.rushes):
            print("dossier introuvable : %s" % a.rushes)
            return 2
        if not (0 <= a.modeles <= 20):
            print("--modeles : entre 1 et 20")
            return 2
        if os.path.exists(a.sortie) and not os.path.isdir(a.sortie):
            print("la sortie est un fichier : %s" % a.sortie)
            return 2
        if a.fin:
            regler_fin()
        r = candidats(a.rushes, a.sortie, a.modeles)
        print(vue(r))
        print("--groupes-trouves %d" % r["trouves"])
        print("--candidats %s" % r["fichier"])
        sortie_json("separer-candidats", {
            "candidats": r["fichier"], "cible": r["cible"], "trouves": r["trouves"], "accord": r["accord"],
            "estimes": r["estimes"], "fin": r["fin"],
            "arborescence": r["arborescence"]["indice"], "proposition": r["proposition"],
            "groupes": [{x: g[x] for x in ("id", "videos", "secondes", "planches", "couleurs")} for g in r["groupes"]],
            "apercu": r["planches"]["apercu"], "ecartes": len(r["ecartes"]), "illisibles": len(r["illisibles"])})
        if not r["trouves"]:   # en dernier : c'est la ligne que le bureau montre au client
            print("AUCUN groupe : %d video(s) lue(s), %d illisible(s), %d morceau(x) ecarte(s)"
                  % (len(r["videos"]), len(r["illisibles"]), len(r["ecartes"])))
            return 1
        return 0
    if a.planches or a.construire:
        if not (a.plan and a.sortie):
            print("--plan et --sortie sont demandes")
            return 2
        return construire(a.plan, a.sortie) if a.construire else planches_plan(a.plan, a.sortie)
    p.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
