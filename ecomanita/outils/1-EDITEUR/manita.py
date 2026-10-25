#!/usr/bin/env python3
"""
manita.py — EDITEUR ecom manita, en un seul fichier.

UN fichier. Rien d'autre a telecharger.
Il installe lui-meme ce qui lui manque, puis il travaille.

    python3 manita.py --installer     installe ce qui manque
    python3 manita.py --verifier      se teste tout seul et le prouve
    python3 manita.py video.mp4       lit les couleurs et les coupes
    python3 manita.py --dossier .     traite toutes les videos du dossier
    python3 manita.py v.mp4 --pov hijab --numero 3      ecrit le POV sur la video
    python3 manita.py --dossier D --pov hijab   un POV DIFFERENT par video du dossier
                                                (chaque variante garde SA musique)
    python3 manita.py --pov-liste     affiche toutes les accroches pretes

Aucun reseau vers l'exterieur, aucun jeton, aucun mot de passe, aucun compte.
Tout se passe sur cette machine.
"""

import argparse, json, math, os, platform, shutil, subprocess, sys, tempfile, time
import atexit as _atexit

# ---------------------------------------------- MENAGE DES DOSSIERS DE TRAVAIL
# Les scenes decoupees et les images de texte partaient dans des dossiers
# temporaires qui n'etaient JAMAIS effaces. Au bout de quelques montages le
# disque est plein et ffmpeg n'a plus la place d'ecrire une seule image :
# il echoue sans rien dire. On garde la liste et on la vide en sortant.
_MANITA_TEMPS = []


def _temp(prefix="manita_"):
    d = tempfile.mkdtemp(prefix=prefix)
    _MANITA_TEMPS.append(d)
    # on signe le dossier : un autre montage lance en meme temps saura qu'il
    # est VIVANT et ne viendra pas effacer les scenes sous ses pieds
    try:
        with open(os.path.join(d, ".manita-pid"), "w") as f:
            f.write(str(os.getpid()))
    except OSError:
        pass
    return d


def _travail_vivant(d):
    """Le dossier appartient-il a un montage encore en train de tourner ?"""
    try:
        with open(os.path.join(d, ".manita-pid")) as f:
            pid = int(f.read().strip())
    except Exception:
        return False
    if pid == os.getpid():
        return True
    return _pid_vivant(pid)


def _pid_vivant(pid):
    """Le processus pid tourne-t-il encore ? Sous Windows, os.kill(pid, 0)
    n'est PAS un test : 0 y vaut CTRL_C_EVENT, et l'appel echoue pour un
    processus bien vivant d'une autre console. Le dossier d'un montage vivant
    (une autre discussion) etait alors pris pour mort et efface. On demande
    donc a Windows lui-meme ; dans le doute, on dit « vivant » (on ne
    supprime jamais un dossier dont on n'est pas sur)."""
    if os.name == "nt":
        try:
            import ctypes
            from ctypes import wintypes
            k = ctypes.WinDLL("kernel32", use_last_error=True)
            k.OpenProcess.restype = wintypes.HANDLE
            k.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
            h = k.OpenProcess(0x1000, False, pid)   # PROCESS_QUERY_LIMITED_INFORMATION
            if not h:
                return ctypes.get_last_error() != 87   # 87 = parametre invalide : ce pid n'existe pas
            try:
                code = wintypes.DWORD()
                if not k.GetExitCodeProcess(h, ctypes.byref(code)):
                    return True
                return code.value == 259                # STILL_ACTIVE
            finally:
                k.CloseHandle(h)
        except Exception:
            return True
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except OSError:
        return False


def _menage_temps():
    for d in _MANITA_TEMPS:
        shutil.rmtree(d, ignore_errors=True)
    del _MANITA_TEMPS[:]


_atexit.register(_menage_temps)


# ------------------------------------------ TOUT ffmpeg PASSE PAR ICI
# Deux choses qu'on oublie une fois sur deux, et qui ne se voient jamais :
#
#  1. STDIN FERME. ffmpeg lit le clavier. Lance en tache de fond depuis un
#     terminal, il essaie de lire ce terminal, le systeme l'ARRETE (SIGTTIN)
#     et il ne repart jamais. Il ne meurt pas, il n'ecrit rien, il ne dit
#     rien : le montage reste plante pour toujours sur la meme variante.
#     C'est la panne la plus silencieuse de tout l'outil.
#  2. UN DELAI MAXIMUM. Sans lui, un ffmpeg qui tourne sans fin bloque le lot
#     entier. Avec lui, il echoue, il le DIT, et les autres variantes passent.
DELAI_FFMPEG = 1800          # trente minutes : large, mais jamais l'infini


def _lancer(*a, **k):
    k.setdefault("stdin", subprocess.DEVNULL)
    k.setdefault("timeout", DELAI_FFMPEG)
    return subprocess.run(*a, **k)
# ---------------------------------------------------------------------
# -----------------------------------------------------------------------------


# =================================================================
#  PARTIE 1 — IL S'INSTALLE TOUT SEUL
# =================================================================

def _pip(paquets):
    """Installe des paquets python, avec le repli des systemes proteges."""
    base = [sys.executable, "-m", "pip", "install", "--quiet",
            "--disable-pip-version-check", "--no-input"]
    # Quatre facons d'installer, de la plus propre a la plus insistante.
    # Sur un Mac d'origine, python3 refuse d'ecrire dans le systeme : c'est
    # "--user" qui passe. Sur un Linux recent c'est "--break-system-packages".
    # On les essaie toutes plutot que de laisser le client bloque.
    essais = [base + paquets,
              base + ["--user"] + paquets,
              base + ["--break-system-packages"] + paquets,
              base + ["--user", "--break-system-packages"] + paquets]
    dernier = ""
    for essai in essais:
        r = _lancer(essai, stdin=subprocess.DEVNULL,
                           capture_output=True, text=True)
        if r.returncode == 0:
            return True
        dernier = (r.stderr or r.stdout or "").strip()
    _pip.derniere_erreur = dernier[-400:]
    return False


def _essayer_ffmpeg():
    """Tente d'installer ffmpeg avec le gestionnaire de la machine."""
    sys_nom = platform.system()
    essais = []
    if sys_nom == "Darwin":
        essais = [["brew", "install", "ffmpeg"]]
    elif sys_nom == "Windows":
        essais = [["winget", "install", "--id", "Gyan.FFmpeg",
                   "--accept-package-agreements", "--accept-source-agreements"]]
    else:
        essais = [["apt-get", "install", "-y", "ffmpeg"],
                  ["sudo", "apt-get", "install", "-y", "ffmpeg"]]
    for cmd in essais:
        if shutil.which(cmd[0]) is None:
            continue
        print("   installation de ffmpeg avec %s ..." % cmd[0])
        if _lancer(cmd, stdin=subprocess.DEVNULL).returncode == 0:
            return True
    return False


def installer(silencieux=False):
    """Verifie et installe. Rend la liste de ce qui manque encore."""
    def dire(x):
        if not silencieux:
            print(x)

    dire("INSTALLATION")
    manque = []

    dire("  python        %s" % platform.python_version())

    # les deux bibliotheques
    for mod, paquet in (("numpy", "numpy"), ("PIL", "pillow")):
        try:
            __import__(mod)
            dire("  %-13s deja la" % paquet)
        except ImportError:
            dire("  %-13s absent, installation ..." % paquet)
            if _pip([paquet]):
                try:
                    __import__(mod)
                    dire("  %-13s installe" % paquet)
                except ImportError:
                    manque.append(paquet)
            else:
                manque.append(paquet)

    # de quoi aller chercher un dossier Drive PUBLIC (aucun compte, aucun jeton)
    try:
        import gdown  # noqa
        dire("  drive         deja la")
    except ImportError:
        dire("  drive         absent, installation ...")
        if _pip(["gdown"]):
            try:
                import gdown  # noqa
                dire("  drive         installe")
            except ImportError:
                manque.append("gdown")
        else:
            manque.append("gdown")

    # de quoi ECRIRE L'ARABE lie. Pillow le fait tout seul quand il a "raqm" ;
    # sinon on installe les deux petits paquets qui lient les lettres a la main.
    try:
        from PIL import features as _f
        raqm = bool(_f.check("raqm"))
    except Exception:
        raqm = False
    if raqm:
        dire("  arabe         Pillow lie les lettres tout seul")
    else:
        try:
            import arabic_reshaper, bidi  # noqa
            dire("  arabe         deja la")
        except ImportError:
            dire("  arabe         absent, installation ...")
            if _pip(["arabic-reshaper", "python-bidi"]):
                try:
                    import arabic_reshaper, bidi  # noqa
                    dire("  arabe         installe")
                except ImportError:
                    manque.append("arabic-reshaper")
            else:
                manque.append("arabic-reshaper")

    # ffmpeg — LE SEUL point qui peut demander un mot de passe
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        dire("  ffmpeg        deja la")
    else:
        dire("")
        dire("  ffmpeg        ABSENT.")
        dire("  ATTENTION : c'est la SEULE etape qui peut demander le mot de")
        dire("  passe administrateur de la machine. Tout le reste s'installe")
        dire("  sans aucun droit particulier.")
        dire("  Si tu ne veux pas taper de mot de passe maintenant, installe")
        dire("  ffmpeg a part, puis relance. Sinon, continue.")
        dire("")
        dire("  ffmpeg        installation ...")
        if _essayer_ffmpeg() and shutil.which("ffmpeg"):
            dire("  ffmpeg        installe")
        else:
            manque.append("ffmpeg")

    # une police qui sait ecrire l'arabe (Mac et Windows en ont une d'origine)
    if "pillow" not in manque:
        try:
            pa = police_arabe(40)
        except Exception:
            pa = None
        if pa is not None:
            dire("  police arabe  %s" % os.path.basename(pa.path))
        else:
            dire("  police arabe  ABSENTE")
            manque.append("police arabe")

    if manque:
        dire("")
        dire("  IL MANQUE ENCORE : %s" % ", ".join(manque))
        # on montre la VRAIE reponse de pip, jamais une cause devinee
        if getattr(_pip, "derniere_erreur", ""):
            dire("  ce que pip a repondu :")
            for l in _pip.derniere_erreur.splitlines()[-4:]:
                dire("     " + l)
        sys_nom = platform.system()
        if "ffmpeg" in manque:
            if sys_nom == "Darwin":
                dire("  -> colle ceci puis relance :")
                dire('     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com'
                     '/Homebrew/install/HEAD/install.sh)" && brew install ffmpeg')
            elif sys_nom == "Windows":
                dire("  -> colle ceci puis relance :")
                dire("     winget install Gyan.FFmpeg")
        if "police arabe" in manque:
            dire("  -> installe une police arabe puis relance :")
            if sys_nom == "Darwin":
                dire("     brew install --cask font-noto-naskh-arabic")
            elif sys_nom == "Windows":
                dire("     Arial est fournie avec Windows : verifie C:/Windows/Fonts")
            else:
                dire("     sudo apt-get install -y fonts-noto-core")
    else:
        dire("")
        dire("  TOUT EST EN PLACE.")
    return manque



# =================================================================
#  PARTIE 2 — IL LIT LA COULEUR DU VETEMENT
# =================================================================

PAS_SONDE      = 0.2    # une image toutes les 0,2 s
FENETRE_MEDIAN = 3      # filtre median : tue une lecture isolee aberrante
LARGEUR_SONDE  = 160    # largeur d'analyse : assez pour la couleur, rapide
FENETRE_X      = (0.34, 0.66)   # fenetre corps : evite le mur du studio
FENETRE_Y      = (0.40, 0.82)
ETROITE_X      = (0.44, 0.56)   # 2e fenetre, plus serree : methode independante
ETROITE_Y      = (0.46, 0.70)
PART_MIN_COUL  = 0.15   # une couleur doit couvrir 15 % de la video pour compter
BLOC_MULTI     = 1.6
BLOC_MONO      = 3.0
MIN_SEGMENT    = 0.8    # un segment plus court est absorbe par ses voisins
SEUIL_REPETITION = 6    # ecart de STRUCTURE maximum entre deux memes scenes
SEUIL_COULEUR    = 18   # ecart de COULEUR maximum, en niveaux sur 255


# ---------------------------------------------------------------- couleurs

def _hsv(r, g, b):
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    mx, mn = max(r, g, b), min(r, g, b)
    v = mx
    d = mx - mn
    s = 0.0 if mx == 0 else d / mx
    if d == 0:
        h = 0.0
    elif mx == r:
        h = (60 * ((g - b) / d)) % 360
    elif mx == g:
        h = 60 * ((b - r) / d) + 120
    else:
        h = 60 * ((r - g) / d) + 240
    return h, s, v


def famille(rgb):
    """Rend le nom de famille de couleur. Les nuances proches sont fusionnees."""
    r, g, b = [int(x) for x in rgb]
    h, s, v = _hsv(r, g, b)

    # dans un pixel tres sombre la teinte n'a plus de sens : c'est du noir.
    # (c'est ce qui faisait lire "marron" sur un vetement noir compresse)
    if v < 0.25:
        return "noir"

    # beige : peu sature mais chaud et clair — se teste AVANT les gris
    if 0.10 <= s < 0.34 and 18 <= h <= 55 and v >= 0.52:
        return "beige"

    if s < 0.18:                       # achromatique
        # la frontiere blanc/gris ne peut pas etre haute : un vetement BLANC
        # filme dans une piece, pas en studio, retombe souvent sous 0.78 et
        # etait lu "gris" une image sur deux. Mesure faite sur de vraies
        # videos de sa niche : la coupure juste est autour de 0.62.
        if v < 0.62:  return "gris"
        return "blanc"

    # zone rouge/rose : au bord du cercle des teintes, la teinte seule est
    # instable (un rose clair oscille autour de 345 deg et change de nom d'une
    # image a l'autre). On tranche sur la clarte et la saturation, qui elles
    # sont stables : un rose est CLAIR et PEU sature, un rouge est l'inverse.
    if h >= 330 or h < 12:
        if v >= 0.70 and s <= 0.55:    return "rose"
        return "bordeaux" if v < 0.45 else "rouge"
    if h < 40:                         return "marron"   if v < 0.52 else "orange"
    if h < 66:                         return "jaune"
    if h < 160:                        return "vert"
    if h < 200:                        return "turquoise"
    if h < 255:                        return "marine"   if v < 0.38 else "bleu"
    if h < 292:                        return "violet"
    return "bordeaux" if v < 0.45 else "rose"


# ---------------------------------------------------------------- k-means

def amas_dominant(pixels, k=3, tours=12, graine=7):
    """k-means minimal en numpy. Rend le centre du plus gros amas."""
    import numpy as np
    p = pixels.astype(np.float32)
    if len(p) <= k:
        return p.mean(axis=0)
    rng = np.random.default_rng(graine)
    centres = p[rng.choice(len(p), k, replace=False)]
    etiquettes = np.zeros(len(p), dtype=np.int32)
    for _ in range(tours):
        d = ((p[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2)
        nouv = d.argmin(axis=1)
        if np.array_equal(nouv, etiquettes):
            break
        etiquettes = nouv
        for i in range(k):
            m = etiquettes == i
            if m.any():
                centres[i] = p[m].mean(axis=0)
    comptes = np.bincount(etiquettes, minlength=k)
    i = int(comptes.argmax())
    return centres[i]


# ---------------------------------------------------------------- lecture

def _cadence():
    """Comment demander « une image par intervalle, sans doublon ».
    ffmpeg a CHANGE de nom d'option : `-vsync` a disparu des versions
    recentes, remplace par `-fps_mode`. On ne devine pas : on demande a
    ffmpeg lui-meme ce qu'il connait, une seule fois."""
    if getattr(_cadence, "choix", None) is None:
        r = _lancer(["ffmpeg", "-hide_banner", "-h", "full"],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=1800)
        aide = (r.stdout or "") + (r.stderr or "")
        if "fps_mode" in aide:
            _cadence.choix = ["-fps_mode", "passthrough"]
        elif "vsync" in aide:
            _cadence.choix = ["-vsync", "0"]
        else:
            _cadence.choix = []      # le filtre fps suffit
    return _cadence.choix


def sonder(video, dossier):
    """Decode depuis le debut (jamais de -ss avant -i) et sort les images sondes."""
    motif = os.path.join(dossier, "s%05d.png")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", video,
           "-vf", "fps=%.6f,scale=%d:-2" % (1.0 / PAS_SONDE, LARGEUR_SONDE)]
    cmd += _cadence() + [motif]
    r = _lancer(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        # deuxieme essai SANS l'option de cadence : le filtre fps fait deja
        # le travail, on ne bloque pas le client pour un nom d'option
        cmd2 = ["ffmpeg", "-y", "-loglevel", "error", "-i", video,
                "-vf", "fps=%.6f,scale=%d:-2" % (1.0 / PAS_SONDE, LARGEUR_SONDE),
                motif]
        r2 = _lancer(cmd2, capture_output=True, text=True,
                            stdin=subprocess.DEVNULL)
        if r2.returncode != 0:
            raise RuntimeError("ffmpeg a refuse la video : "
                               + (r.stderr.strip() or r2.stderr.strip() or "sans message"))
        _cadence.choix = []
    return sorted(os.listdir(dossier))


def duree(video):
    r = _lancer(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", video],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0 or not r.stdout.strip():
        raise RuntimeError("ffprobe n'a pas rendu la duree : " + (r.stderr.strip() or "sans message"))
    return float(r.stdout.strip())


def classer_image(chemin):
    """Rend les deux lectures de la meme image, par deux methodes differentes."""
    import numpy as np
    from PIL import Image
    im = np.asarray(Image.open(chemin).convert("RGB"))
    h, w, _ = im.shape
    x0, x1 = int(w * FENETRE_X[0]), int(w * FENETRE_X[1])
    y0, y1 = int(h * FENETRE_Y[0]), int(h * FENETRE_Y[1])
    fen = im[y0:y1, x0:x1].reshape(-1, 3)
    if len(fen) == 0:
        return None, None
    # methode 1 : amas dominant sur la fenetre large
    centre = amas_dominant(fen)
    # methode 2 : pixel median sur une fenetre PLUS SERREE. Les deux methodes
    # ne lisent donc pas les memes pixels : si le vetement sort du cadre, ou si
    # le mur mange la fenetre large, les deux ne disent plus la meme chose.
    a0, a1 = int(w * ETROITE_X[0]), int(w * ETROITE_X[1])
    b0, b1 = int(h * ETROITE_Y[0]), int(h * ETROITE_Y[1])
    etr = im[b0:b1, a0:a1].reshape(-1, 3)
    if len(etr) == 0:
        etr = fen
    median = np.median(etr, axis=0)
    return famille(centre), famille(median)


def empreinte(chemin):
    """Empreinte visuelle d'une image : la STRUCTURE (dHash 64 bits) et la
    COULEUR (moyenne RGB d'une grille 3x3). Il faut les deux : sur un aplat,
    la structure seule confond un beige et un blanc."""
    import numpy as np
    from PIL import Image
    im = Image.open(chemin).convert("RGB")
    g = np.asarray(im.convert("L").resize((9, 8)), dtype=np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    v = 0
    for b in bits:
        v = (v << 1) | int(b)
    w, h = im.size
    corps = im.crop((int(w * FENETRE_X[0]), int(h * FENETRE_Y[0]),
                     int(w * FENETRE_X[1]), int(h * FENETRE_Y[1])))
    grille = np.asarray(corps.resize((3, 3)), dtype=np.int16).reshape(-1)
    return (v, grille)


def distance(e1, e2):
    """Rend (ecart de structure sur 64, ecart de couleur en niveaux)."""
    import numpy as np
    struct = bin(e1[0] ^ e2[0]).count("1")
    coul = float(np.abs(e1[1] - e2[1]).mean())
    return struct, coul


# ---------------------------------------------------------------- segments

def lisser(familles, fenetre=FENETRE_MEDIAN):
    """Remplace chaque lecture par la valeur la plus frequente de son voisinage.
    Une image isolee mal lue ne peut plus couper un segment en deux."""
    n = len(familles)
    if n < 3:
        return list(familles)
    d = fenetre // 2
    out = []
    for i in range(n):
        fen = [f for f in familles[max(0, i - d):min(n, i + d + 1)] if f]
        if not fen:
            out.append(familles[i])
            continue
        gagnant = max(set(fen), key=lambda c: (fen.count(c), c == familles[i]))
        out.append(gagnant)
    return out


def refusionner(segs):
    """Colle les segments voisins qui portent la meme couleur."""
    i = 0
    while i + 1 < len(segs):
        if segs[i]["couleur"] == segs[i + 1]["couleur"]:
            segs[i]["fin"] = segs[i + 1]["fin"]
            segs[i]["images"] += segs[i + 1]["images"]
            segs[i]["accords"] += segs[i + 1]["accords"]
            segs.pop(i + 1)
        else:
            i += 1
    return segs


def construire_segments(lectures, pas, duree_video):
    """lectures = [(famille|None, accord_bool)] -> segments fusionnes."""
    familles = lisser([f for f, _ in lectures])
    lectures = [(familles[i], lectures[i][1]) for i in range(len(lectures))]
    segs = []
    for i, (fam, accord) in enumerate(lectures):
        t = i * pas
        if segs and segs[-1]["couleur"] == fam:
            segs[-1]["fin"] = t + pas
            segs[-1]["images"] += 1
            segs[-1]["accords"] += 1 if accord else 0
        else:
            # l'image sondee a l'instant t porte deja la nouvelle couleur :
            # la coupe se pose donc sur t, pas avant.
            if segs:
                segs[-1]["fin"] = t
            segs.append({"couleur": fam, "debut": t, "fin": t + pas,
                         "images": 1, "accords": 1 if accord else 0})

    refusionner(segs)

    # absorber les segments trop courts dans le voisin le plus long
    change = True
    while change and len(segs) > 1:
        change = False
        for i, s in enumerate(segs):
            if s["fin"] - s["debut"] < MIN_SEGMENT:
                g = segs[i - 1] if i > 0 else None
                d = segs[i + 1] if i + 1 < len(segs) else None
                cible = g if (d is None or (g is not None and
                        (g["fin"] - g["debut"]) >= (d["fin"] - d["debut"]))) else d
                if cible is None:
                    break
                cible["debut"] = min(cible["debut"], s["debut"])
                cible["fin"] = max(cible["fin"], s["fin"])
                cible["images"] += s["images"]
                cible["accords"] += s["accords"]
                segs.pop(i)
                refusionner(segs)
                change = True
                break

    refusionner(segs)
    if segs:
        segs[-1]["fin"] = round(duree_video, 3)
    for s in segs:
        s["debut"] = round(s["debut"], 2)
        s["fin"] = round(s["fin"], 2)
        s["duree"] = round(s["fin"] - s["debut"], 2)
        s["confiance"] = round(s["accords"] / s["images"], 3) if s["images"] else 0.0
        del s["accords"]
    return segs


def analyser(video):
    d = duree(video)
    with tempfile.TemporaryDirectory() as tmp:
        images = sonder(video, tmp)
        if not images:
            raise RuntimeError("aucune image sondee : video illisible ou vide")
        lectures, incertaines, desaccords = [], 0, 0
        empreintes = []
        for nom in images:
            empreintes.append(empreinte(os.path.join(tmp, nom)))
            f1, f2 = classer_image(os.path.join(tmp, nom))
            sur = f1 is not None
            accord = sur and (f1 == f2)
            if not sur:
                incertaines += 1
            elif not accord:
                desaccords += 1
            lectures.append((f1 if sur else None, accord))

    segments = construire_segments(lectures, PAS_SONDE, d)

    # empreinte de chaque segment = celle de son image du milieu
    for sg in segments:
        i = min(len(empreintes) - 1,
                max(0, int(((sg["debut"] + sg["fin"]) / 2) / PAS_SONDE)))
        sg["_e"] = empreintes[i]

    # scenes repetees DANS LA MEME VIDEO : deux segments qui se ressemblent trop
    repetees = []
    for i in range(len(segments)):
        for j in range(i + 1, len(segments)):
            st, co = distance(segments[i]["_e"], segments[j]["_e"])
            if st <= SEUIL_REPETITION and co <= SEUIL_COULEUR:
                repetees.append({"segment_1": segments[i]["debut"],
                                 "segment_2": segments[j]["debut"],
                                 "ecart": st, "ecart_couleur": round(co, 1)})
    for sg in segments:
        del sg["_e"]

    # parts de couleur sur la duree totale
    parts = {}
    for s in segments:
        if s["couleur"]:
            parts[s["couleur"]] = parts.get(s["couleur"], 0.0) + s["duree"]
    parts = {k: round(v / d, 3) for k, v in sorted(parts.items(), key=lambda x: -x[1])}
    retenues = [c for c, p in parts.items() if p >= PART_MIN_COUL]

    multi = len(retenues) >= 2
    fiche = {
        "video": os.path.basename(video),
        "duree": round(d, 2),
        "images_sondees": len(lectures),
        "images_incertaines": incertaines,
        "images_en_desaccord": desaccords,
        "couleurs": parts,
        "couleurs_retenues": retenues,
        "mode": "multi" if multi else "mono",
        "bloc": BLOC_MULTI if multi else BLOC_MONO,
        "segments": segments,
        "scenes_repetees": repetees,
        "controles": [],
        "conforme": True,
    }

    # --------- controles integres : rien n'est valide en silence
    def ctrl(nom, ok, detail=""):
        fiche["controles"].append({"controle": nom, "ok": bool(ok), "detail": detail})
        if not ok:
            fiche["conforme"] = False

    couverture = sum(s["duree"] for s in segments)
    ctrl("duree couverte", abs(couverture - d) <= PAS_SONDE + 0.05,
         "couvert %.2f s sur %.2f s" % (couverture, d))
    ctrl("aucun segment vide", all(s["duree"] > 0 for s in segments))
    ctrl("segments continus",
         all(abs(segments[i]["fin"] - segments[i + 1]["debut"]) < 0.01
             for i in range(len(segments) - 1)))
    ctrl("au moins une couleur lue", len(retenues) >= 1,
         "aucune couleur ne depasse le seuil" if not retenues else "")

    part_sure = 1 - (incertaines + desaccords) / max(1, len(lectures))
    # information, PAS un refus : un telephone dans la main ou un miroir font
    # baisser l'accord alors que la video est parfaitement utilisable.
    fiche["controles"].append({
        "controle": "accord des deux methodes", "ok": True,
        "detail": "%.0f %% des images lues pareil (information, pas un refus)"
                  % (part_sure * 100)})
    ctrl("aucune scene repetee", not repetees,
         "" if not repetees else
         "%d repetition(s) : %s" % (len(repetees),
            ", ".join("%.1fs = %.1fs" % (r["segment_1"], r["segment_2"])
                      for r in repetees[:4])))

    inconnues = [s for s in segments if not s["couleur"]]
    ctrl("pas de couleur inconnue", not inconnues,
         "%d segment(s) non classe(s)" % len(inconnues) if inconnues else "")
    fiche["accord_deux_methodes"] = round(part_sure, 3)
    return fiche


def rapport(f):
    l = []
    l.append("VIDEO      : %s" % f["video"])
    l.append("DUREE      : %.2f s" % f["duree"])
    l.append("MODE       : %s  ->  bloc de %.1f s" % (f["mode"], f["bloc"]))
    l.append("COULEURS   : %s" % ", ".join("%s %.0f%%" % (c, p * 100)
                                           for c, p in f["couleurs"].items()))
    l.append("ACCORD     : %.0f %% des images lues pareil par les deux methodes"
             % (f["accord_deux_methodes"] * 100))
    l.append("")
    l.append("SEGMENTS")
    for s in f["segments"]:
        l.append("  %6.2f -> %6.2f  %-10s  %4.2f s  confiance %.0f%%"
                 % (s["debut"], s["fin"], s["couleur"] or "inconnue", s["duree"],
                    s["confiance"] * 100))
    if f["scenes_repetees"]:
        l.append("")
        l.append("SCENES REPETEES DANS CETTE VIDEO")
        for r in f["scenes_repetees"]:
            l.append("  %6.2f s  et  %6.2f s  se ressemblent "
                     "(structure %d/64, couleur %.0f)"
                     % (r["segment_1"], r["segment_2"], r["ecart"],
                        r["ecart_couleur"]))
    l.append("")
    l.append("CONTROLES")
    for c in f["controles"]:
        l.append("  [%s] %-26s %s" % ("OK" if c["ok"] else "ECHEC",
                                      c["controle"], c["detail"]))
    l.append("")
    l.append("VERDICT    : %s" % ("CONFORME" if f["conforme"]
                                  else "NON CONFORME — ne pas monter cette video telle quelle"))
    return "\n".join(l)




# =================================================================
#  PARTIE 3 — IL BRULE LE POV SUR LA VIDEO
#  blanc epais, entoure de noir, en haut, au-dessus de l'interface
# =================================================================

# Les 5 ANGLES du script maison. Les dix POV d'une sous-niche sont RANGES
# par angle et alternes : si le client n'en prend que cinq, il a les cinq
# angles differents, pas cinq fois la meme idee.
ANGLES = ["douleur", "image", "preuve", "objection", "occasion"]

POV = {
 "mariage": [
  ("douleur",   "POV: عرس صاحبتي غدوة وأنا مازال ما لقيت واش نلبس 😩"),
  ("image",     "POV: لبسة وحدة تخليك نتي الموضوع، ماشي العروسة برك 💗"),
  ("preuve",    "POV: كي تدخلي للعرس وكل وحدة تسقسي وين شريتيه ✨"),
  ("objection", "POV: ما تلبسيش لبسة تقعدي تشدّي فيها الليل كامل"),
  ("occasion",  "POV: كي تلقاي اللبسة لي تروح مع كل الأعراس هاذ الصيف"),
  ("douleur",   "POV: عندك ثلاث أعراس فشهر واحد، وميزانية وحدة"),
  ("image",     "POV: الصور تاع العرس تبقى، واللبسة لي فيهم تبقى معاها"),
  ("preuve",    "POV: حماتك تشوفك وتقولك « شكون خيّطلك هاذي ؟ »"),
  ("objection", "POV: ما تحبيش تلبسي كيما كامل النساء فالعرس"),
  ("occasion",  "POV: موسم الأعراس بدا، وخير تكوني واجدة من دروك"),
 ],
 "hijab": [
  ("douleur",   "POV: تقلّبي على لبسة واسعة وما تلقايش، حتى اليوم"),
  ("image",     "POV: كي تلقاي لبسة ساترة وفنفس الوقت شيك 🤍"),
  ("preuve",    "POV: صاحباتك يسقسوك وين لقيتي لبسة ساترة وشيك"),
  ("objection", "POV: ساترة ما معناهاش واسعة وخلاص ✨"),
  ("occasion",  "POV: اللبسة لي تلبسيها للخدمة، للخرجة، وللضيافة"),
  ("douleur",   "POV: ما تحبيش تشدّي فالقماش كل ما تحركتي"),
  ("image",     "POV: لبسة تلبسيها قدام الناس وانتي مطمّنة على روحك"),
  ("preuve",    "POV: وحدة تشوفك وتقولك « هاذي لي راني نقلّب عليها »"),
  ("objection", "POV: القماش ما يبيّنش واش تحتو، وهاذي وحدها تكفي"),
  ("occasion",  "POV: تقلّبي على لون يروح مع كل الخمارات لي عندك"),
 ],
 "soiree": [
  ("douleur",   "POV: سهرة الليلة وما عندكش واش تلبسي 🌙"),
  ("image",     "POV: تحبي حاجة تتصوري فيها وتخرج مليحة فالضوء"),
  ("preuve",    "POV: كي تدخلي وكل وحدة تدير عينيها عليك"),
  ("objection", "POV: القماش لي يلمع غير كي يجيه الضوء، ماشي أكثر"),
  ("occasion",  "POV: سهرة عائلية، وتحبي تكوني أنيقة بلا ما تبالغي"),
  ("douleur",   "POV: ما تحبيش تلبسي حاجة تعيّيك بعد ساعة"),
  ("image",     "POV: كي تلقاي لبسة تخليك مرتاحة وشيك فنفس الوقت 💗"),
  ("preuve",    "POV: تخرجي فالصور تاع السهرة وكل وحدة تسقسي"),
  ("objection", "POV: كي يكون القص هو لي يخدم، ماشي اللون برك ✨"),
  ("occasion",  "POV: لبسة تخرجك من الدار للسهرة بلا ما تبدّلي"),
 ],
 "sortie": [
  ("douleur",   "POV: خرجة مع صاحباتك وما عندكش واش تلبسي 😩"),
  ("image",     "POV: لبسة تخرجي بيها وتحسي روحك فبلاصتك"),
  ("preuve",    "POV: تلقاي صاحبتك تقولك « وين شريتي هاذي ؟ » ✨"),
  ("objection", "POV: لبسة للخرجة ما لازمش تعيّيك فالمشي"),
  ("occasion",  "POV: من القهوة للضيافة، نفس اللبسة وتكفي"),
  ("douleur",   "POV: تقلّبي فالخزانة ساعة وتخرجي بنفس اللبسة"),
  ("image",     "POV: كي تكوني مرتاحة وشيك وانتي غير خارجة تقضي 🤍"),
  ("preuve",    "POV: صاحبتك تصوّرك وتحطها فالستوري بلا ما تسقسيك"),
  ("objection", "POV: القماش ما يتكرمشش كي تقعدي فالطاكسي"),
  ("occasion",  "POV: لبسة تروح مع السبّاط لي تلبسيه كل نهار"),
 ],
 "etudiante": [
  ("douleur",   "POV: كل نهار تقلّبي واش تلبسي للجامعة 😩"),
  ("image",     "POV: تدخلي للأمفي وانتي مرتاحة وشيكة 🤍"),
  ("preuve",    "POV: صاحباتك فالجامعة يسقسوك وين شريتيها"),
  ("objection", "POV: ما تحبيش تقعدي تعدّلي فيها طول النهار"),
  ("occasion",  "POV: من الجامعة للمكتبة للخرجة، نفس اللبسة"),
  ("douleur",   "POV: لبسة وحدة للأسبوع كامل وراكي عيّيتي منها"),
  ("image",     "POV: لبسة تخليك مرتبة حتى كي تقومي متأخرة"),
  ("preuve",    "POV: وحدة من القسم تصوّرك وتقولك « هاذي وين ؟ »"),
  ("objection", "POV: ما تتكرمشش كي تقعدي ساعات فالقسم"),
  ("occasion",  "POV: الدخول الجامعي قرب، وجّدي روحك من دروك"),
 ],
 "travail": [
  ("douleur",   "POV: كل صباح تقلّبي واش تلبسي للخدمة 😩"),
  ("image",     "POV: لبسة تخليك جدّية وشيكة فنفس الوقت"),
  ("preuve",    "POV: زميلتك تسقسيك وين شريتي هاذ اللبسة ✨"),
  ("objection", "POV: لبسة الخدمة ما لازمش تكون ثقيلة ولا ضيّقة"),
  ("occasion",  "POV: من الخدمة للقهوة بلا ما تبدّلي"),
  ("douleur",   "POV: تخدمي نهار كامل واللبسة تعيّيك من البكري"),
  ("image",     "POV: تحسي روحك محترمة قدام الزملاء والزبائن"),
  ("preuve",    "POV: المديرة روحها تقولك « هاذي تروحلك » 💗"),
  ("objection", "POV: تلبسيها الصباح وتبقى مرتبة حتى للعشية"),
  ("occasion",  "POV: خمسة أيام خدمة، ولبسة وحدة ما تكفيش"),
 ],
 "maison": [
  ("douleur",   "POV: ما تحبيش تلبسي حاجة تقعدي تعدّليها كل شوية"),
  ("image",     "POV: مرتاحة فالدار بصح مازلتي مرتبة"),
  ("preuve",    "POV: كي يجيوك ضياف على غفلة وانتي لابسة مليح"),
  ("objection", "POV: تغسليها بزاف وتبقى كيما هي"),
  ("occasion",  "POV: تنظفي، تطيبي، وتقعدي مرتاحة فنفس اللبسة"),
  ("douleur",   "POV: لبسة الدار ما لازمش تكون قديمة ومهترية ✨"),
  ("image",     "POV: كي تحسي روحك مليحة فالدار، ماشي غير برا"),
  ("preuve",    "POV: لبسة الدار لي تقدري تفتحي بيها الباب 🏠"),
  ("objection", "POV: القماش لي ما يسخنش فالصيف وما يبردش فالشتا"),
  ("occasion",  "POV: راحة الدار بصح بلون يفرّحك كي تشوفي روحك 🤍"),
 ],
}

HAUT_TEXTE   = 0.040   # 10/10/2026 (decision du vendeur, « plus petit, plus haut ») : 0.065 -> 0.040.
                       # Avant : le bloc commence plus haut (regle le 17/09/2026,
                       # sur la photo validee : la plaque monte, le visage
                       # du mannequin reste degage)
LARGEUR_MAX  = 0.86    # il ne depasse jamais 86 % de la largeur
TAILLE_DEP   = 0.050   # 10/10/2026 (decision du vendeur, « plus petit ») : 0.097 -> 0.050 ; 0.073 ne
                       # changeait rien (la reduction au pas de 0,92 y ramenait deja). Avant :
                       # taille de depart, en part de la LARGEUR : la
                       # contrainte est de tenir en largeur, donc une photo
                       # 4:5 et une video 9:16 gardent le meme texte relatif
LIGNES_MAX   = 2
CONTOUR      = 0.14    # epaisseur du noir, en part de la taille du texte
# L'ENCODAGE — decide le 17/09/2026 APRES MESURE, pas au feeling.
# La source est a 16,8 Mbit/s et les variantes sortaient a 6,7. La resolution
# etait intacte (1080x1920, 25 i/s) : ce qui partait, c'etait la FINESSE, parce
# que l'image etait reencodee TROIS fois en preset « veryfast », le plus
# destructeur de tous. Deux corrections : un preset lent avec des reglages
# propres, et le POV brule PENDANT l'assemblage — une generation en moins.
ENC_PRESET      = "slow"
ENC_CRF_SCENE   = "14"     # coupe de scene : quasi sans perte
ENC_CRF_MONTAGE = "15"     # assemblage, POV compris
ENC_CRF_POV     = "17"     # seulement si le POV est brule a part (auto-test)
ENC_AUDIO       = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]

# LA PLAQUE DU POV — style demande le 17/09/2026 : une plaque noire ARRONDIE
# derriere le texte, un peu transparente pour qu'on VOIE la video derriere.
# Le texte n'a plus besoin de contour : c'est la plaque qui fait le contraste.
POV_PLAQUE       = True
POV_LARGEUR_MAX  = 0.78    # avec la plaque, le texte est plus etroit : la
                           # plaque garde une marge de chaque cote, comme
                           # dans le modele demande
POV_PLAQUE_ALPHA = 200     # sur 255 — assez noir pour lire, assez clair pour voir
POV_MARGE_X      = 0.55    # marge laterale, en part de la taille du texte
POV_MARGE_Y      = 0.40    # marge haut et bas, en part de la taille du texte
POV_COIN         = 0.45    # rayon des coins, en part de la hauteur d'une ligne

# polices qui savent ecrire l'arabe, par systeme. On ne CROIT pas le nom :
# on fait un essai de dessin sur chacune avant de la retenir.
POLICES_AR = [
    # macOS
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/GeezaPro.ttc",
    "/System/Library/Fonts/Supplemental/Baghdad.ttc",
    "/System/Library/Fonts/Supplemental/DecoTypeNaskh.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    # Windows
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/tahomabd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/trado.ttf",
    # Linux
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabicUI-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
POLICES_LAT = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]
POLICES_EMOJI = [
    "/System/Library/Fonts/Apple Color Emoji.ttc",
    "C:/Windows/Fonts/seguiemj.ttf",
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
]


def _raqm():
    """Vrai si Pillow sait lier les lettres arabes tout seul."""
    try:
        from PIL import features
        return bool(features.check("raqm"))
    except Exception:
        return False


def _mise_en_forme(texte):
    """Rend le texte pret a dessiner.
    Avec raqm : on ne touche a rien, Pillow lie les lettres.
    Sans raqm : on lie les lettres a la main (arabic_reshaper + bidi)."""
    if _raqm():
        return texte
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(texte))
    except Exception:
        return texte


def _encre(police, ch):
    """Dessine UN caractere et rend l'image brute. Sert a savoir si la
    police connait vraiment ce signe, au lieu de se fier a son nom."""
    from PIL import Image, ImageDraw
    t = max(police.size * 3, 30)
    im = Image.new("L", (t, t), 0)
    try:
        ImageDraw.Draw(im).text((t // 6, t // 6), ch, fill=255, font=police)
    except Exception:
        return None
    return im.tobytes()


def _sait_ecrire(police, ch):
    """La police dessine-t-elle CE caractere, ou un carre de remplacement ?"""
    a = _encre(police, ch)
    if not a or max(a) == 0:
        return False
    # U+E0FF est dans la zone privee : presque aucune police ne la dessine.
    # Si notre caractere sort pareil, c'est le meme carre de remplacement.
    b = _encre(police, "\ue0ff")
    return b is None or a != b


def police_arabe(taille):
    """Trouve sur CETTE machine une police qui ecrit l'arabe. Rend None sinon."""
    from PIL import ImageFont
    essais = list(POLICES_AR)
    # en renfort : tout fichier de police dont le nom evoque l'arabe
    for rep in ("/usr/share/fonts", "/Library/Fonts",
                os.path.expanduser("~/Library/Fonts"), "C:/Windows/Fonts"):
        if not os.path.isdir(rep):
            continue
        for racine, _, fichiers in os.walk(rep):
            for f in fichiers:
                bas = f.lower()
                if (bas.endswith((".ttf", ".otf", ".ttc"))
                        and any(m in bas for m in
                                ("arab", "naskh", "kufi", "geeza", "amiri", "cairo"))):
                    essais.append(os.path.join(racine, f))
    vus = set()
    for chemin in essais:
        if chemin in vus or not os.path.isfile(chemin):
            continue
        vus.add(chemin)
        for index in (0, 1):
            try:
                p = ImageFont.truetype(chemin, taille, index=index)
            except Exception:
                continue
            if _sait_ecrire(p, "م"):
                # elle sait aussi ecrire "POV" ? on la garde pour tout le texte.
                p.manita_latin = _sait_ecrire(p, "P") and _sait_ecrire(p, "V")
                return p
    return None


def police_latine(taille):
    """Police pour le "POV:" quand la police arabe ne sait pas ecrire le latin."""
    from PIL import ImageFont
    for chemin in POLICES_LAT:
        if not os.path.isfile(chemin):
            continue
        for index in (0, 1):
            try:
                p = ImageFont.truetype(chemin, taille, index=index)
            except Exception:
                continue
            if _sait_ecrire(p, "P") and _sait_ecrire(p, "V"):
                return p
    return None


def image_emoji(car, hauteur_voulue):
    """Fabrique l'emoji comme une petite image, a la hauteur du texte.
    Les polices emoji couleur sont des IMAGES figees (109 px chez Apple et
    Noto) : on ne peut pas leur demander une autre taille, il faut dessiner
    puis reduire. Rend None si la machine n'a pas de police couleur."""
    from PIL import Image, ImageDraw, ImageFont
    for chemin in POLICES_EMOJI:
        if not os.path.isfile(chemin):
            continue
        for t in (109, 137, 160, 96, 64, 48, max(8, hauteur_voulue)):
            try:
                p = ImageFont.truetype(chemin, t)
                im = Image.new("RGBA", (t * 3, t * 3), (0, 0, 0, 0))
                ImageDraw.Draw(im).text((t // 2, t // 2), car, font=p,
                                        embedded_color=True)
                bb = im.getbbox()
                if not bb:
                    continue
                im = im.crop(bb)
                if im.height < 4:
                    continue
                r = hauteur_voulue / float(im.height)
                return im.resize((max(1, int(im.width * r)),
                                  max(1, int(im.height * r))), Image.LANCZOS)
            except Exception:
                continue
    return None


def _est_emoji(c):
    n = ord(c)
    return (n >= 0x1F000 or 0x2600 <= n <= 0x27BF
            or 0x2B00 <= n <= 0x2BFF or n in (0xFE0F, 0x200D, 0x2764))


def couper_emoji(texte):
    """Separe le texte de l'emoji de fin (ils ne se dessinent pas pareil)."""
    fin = len(texte)
    while fin > 0 and (_est_emoji(texte[fin - 1]) or texte[fin - 1] == " "):
        fin -= 1
    return texte[:fin].strip(), texte[fin:].strip()


def couper_prefixe(texte):
    """Separe le "POV:" latin du corps arabe : les deux ne se dessinent pas
    avec la meme police sur toutes les machines."""
    for i, c in enumerate(texte):
        if 0x0600 <= ord(c) <= 0x06FF or 0xFB50 <= ord(c) <= 0xFEFF:
            return texte[:i].strip(), texte[i:].strip()
    return texte.strip(), ""


def _largeur(dessin, txt, police, contour):
    b = dessin.textbbox((0, 0), txt, font=police, stroke_width=contour)
    return b[2] - b[0], b[3] - b[1]


def decouper_lignes(dessin, texte, police, contour, largeurs):
    """Coupe le texte en lignes. `largeurs` donne la place dispo ligne par ligne
    (la 1re est plus courte : le "POV:" lui prend le debut).
    On coupe sur le texte D'ORIGINE et on mesure la forme FINALE : couper
    apres mise en forme inverserait l'ordre des deux lignes.
    Rend None si ca ne tient pas en LIGNES_MAX."""
    def place(i):
        return largeurs[i] if i < len(largeurs) else largeurs[-1]
    mots, lignes, courante = texte.split(), [], ""
    for m in mots:
        essai = (courante + " " + m).strip()
        if _largeur(dessin, _mise_en_forme(essai), police, contour)[0] <= place(len(lignes)) or not courante:
            courante = essai
        else:
            lignes.append(courante)
            courante = m
        if len(lignes) > LIGNES_MAX:
            return None
    if courante:
        lignes.append(courante)
    if len(lignes) > LIGNES_MAX:
        return None
    for i, l in enumerate(lignes):
        if _largeur(dessin, _mise_en_forme(l), police, contour)[0] > place(i):
            return None
    return lignes


def image_pov(texte, largeur, hauteur, sortie):
    """Fabrique l'image transparente du POV, a la taille exacte de la video.
    On passe par une IMAGE parce que ffmpeg ne sait pas lier les lettres arabes.
    Le "POV:" et l'arabe sont dessines avec DEUX polices quand il le faut :
    beaucoup de polices arabes n'ont aucune lettre latine, et on obtiendrait
    trois carres vides a la place de "POV"."""
    from PIL import Image, ImageDraw
    corps, emoji = couper_emoji(texte)
    prefixe, arabe = couper_prefixe(corps)
    if not arabe:                      # texte entierement latin
        prefixe, arabe = "", corps

    im = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    largeur_max = int(largeur * (POV_LARGEUR_MAX if POV_PLAQUE else LARGEUR_MAX))

    taille = int(largeur * TAILLE_DEP)
    choix = None
    while taille > 12:
        par = police_arabe(taille)
        if par is None:
            raise RuntimeError(
                "aucune police arabe sur cette machine.\n"
                "   Mac     : brew install --cask font-noto-naskh-arabic\n"
                "   Windows : deja incluse, verifie C:/Windows/Fonts/arialbd.ttf\n"
                "   Linux   : sudo apt-get install -y fonts-noto-core")
        plat = par if getattr(par, "manita_latin", False) else police_latine(taille)
        if prefixe and plat is None:
            raise RuntimeError("aucune police latine pour ecrire \"%s\"" % prefixe)
        contour = max(2, int(taille * CONTOUR))
        espace = int(taille * 0.30)
        wp = (_largeur(d, prefixe, plat, contour)[0] + espace) if prefixe else 0
        # on RESERVE la place de l'emoji avant de couper : sinon le texte
        # remplit toute la largeur et l'emoji se fait jeter a la fin
        reserve = int(taille * 1.45) if emoji else 0
        lignes = decouper_lignes(d, arabe, par, contour,
                                 [largeur_max - wp - reserve,
                                  largeur_max - reserve])
        if lignes:
            choix = (par, plat, contour, espace, wp, lignes)
            break
        taille = int(taille * 0.92)
    if not choix:
        raise RuntimeError("texte trop long pour %d lignes : %s" % (LIGNES_MAX, corps))
    par, plat, contour, espace, wp, lignes = choix

    monte, descend = par.getmetrics()
    interligne = int((monte + descend) * 1.12)
    y0 = int(hauteur * HAUT_TEXTE) + monte          # y = la LIGNE DE BASE
    blanc, noir = (255, 255, 255, 255), (0, 0, 0, 255)

    # l'emoji se pose au BOUT du texte : une ligne arabe se lit de droite a
    # gauche, donc son bout est a GAUCHE. Et seulement si la machine a une
    # police couleur : on ne pose jamais un carre vide a la place.
    vignette = image_emoji(emoji, int(taille * 0.92)) if emoji else None
    we, emoji_pose = 0, False
    if vignette is not None:
        we = vignette.width + int(taille * 0.25)
        derniere_l = _mise_en_forme(lignes[-1])
        if _largeur(d, derniere_l, par, contour)[0] + we <= largeur_max:
            emoji_pose = True
        else:
            we = 0

    # PREMIER PASSAGE : on MESURE sans rien dessiner. Sans ca, on ne sait pas
    # quelle place la plaque doit couvrir, et une plaque trop courte laisse
    # une lettre dehors.
    mesures, y = [], y0
    for i, brute in enumerate(lignes):
        l = _mise_en_forme(brute)
        derniere = (i == len(lignes) - 1)
        wl = _largeur(d, l, par, contour)[0]
        total = wl + (wp if i == 0 else 0) + (we if derniere and emoji_pose else 0)
        mesures.append({"texte": l, "derniere": derniere, "wl": wl,
                        "total": total, "depart": (largeur - total) // 2, "y": y})
        y += interligne

    plaque = None
    if POV_PLAQUE:
        mx = max(int(taille * POV_MARGE_X), 6)
        my = max(int(taille * POV_MARGE_Y), 5)
        x1 = max(0, min(m["depart"] for m in mesures) - mx)
        x2 = min(largeur, max(m["depart"] + m["total"] for m in mesures) + mx)
        y1 = max(0, y0 - monte - my)
        y2 = min(hauteur, mesures[-1]["y"] + descend + my)
        rayon = max(4, int(min((y2 - y1) / 2.0, (monte + descend) * POV_COIN)))
        fond = (0, 0, 0, POV_PLAQUE_ALPHA)
        try:
            d.rounded_rectangle([x1, y1, x2, y2], radius=rayon, fill=fond)
        except (AttributeError, TypeError):
            d.rectangle([x1, y1, x2, y2], fill=fond)
        plaque = {"boite": [x1, y1, x2, y2], "rayon": rayon,
                  "alpha": POV_PLAQUE_ALPHA}

    # le texte : blanc plein. Avec la plaque, plus de contour noir — c'est
    # elle qui donne le contraste, et un contour dessus fait sale.
    trait = 0 if POV_PLAQUE else contour
    for i, m in enumerate(mesures):
        l, derniere, wl = m["texte"], m["derniere"], m["wl"]
        depart, y = m["depart"], m["y"]
        pose_prefixe = None
        if i == 0 and prefixe:
            if arabe:
                pose_prefixe = depart + (we if derniere and emoji_pose else 0) + wl
            else:
                d.text((depart, y), prefixe, font=plat, fill=blanc, anchor="ls",
                       stroke_width=trait, stroke_fill=noir)
                depart += wp
        if derniere and emoji_pose:
            im.alpha_composite(vignette,
                               (depart, y - vignette.height + int(taille * 0.10)))
            depart += we
        d.text((depart, y), l, font=par, fill=blanc, anchor="ls",
               stroke_width=trait, stroke_fill=noir)
        if pose_prefixe is not None:
            d.text((pose_prefixe + int(taille * 0.30), y), prefixe, font=plat,
                   fill=blanc, anchor="ls", stroke_width=trait, stroke_fill=noir)

    im.save(sortie)
    return {"taille": taille, "lignes": lignes, "contour": contour,
            "plaque": plaque,
            "prefixe": prefixe, "emoji": emoji, "emoji_pose": emoji_pose,
            "police_arabe": os.path.basename(par.path),
            "police_latine": os.path.basename(plat.path) if plat else "",
            "raqm": _raqm()}


def dimensions(video):
    """Largeur, hauteur et duree de la video, lues par ffprobe."""
    r = _lancer(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height",
                        "-show_entries", "format=duration",
                        "-of", "json", video],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError("ffprobe: %s" % r.stderr.strip())
    j = json.loads(r.stdout)
    s = j["streams"][0]
    return int(s["width"]), int(s["height"]), float(j["format"]["duration"])


def a_du_son(video):
    r = _lancer(["ffprobe", "-v", "error", "-select_streams", "a",
                        "-show_entries", "stream=index", "-of", "csv=p=0", video],
                       capture_output=True, text=True, timeout=120)
    return bool(r.stdout.strip())


# LES SONS QUE LE CONTENEUR MP4 SAIT PORTER.
# Une camera Sony ou Canon enregistre souvent en PCM. Le MP4 ne sait pas le
# porter : recopier ce flux tel quel fait echouer ffmpeg avec
# « Could not find tag for codec pcm_s16be ». Sur un shooting entier, ca
# veut dire zero video montee.
AUDIO_PORTABLE_MP4 = ("aac", "mp3", "ac3", "eac3", "alac", "mp4a")


def codec_audio(video):
    r = _lancer(["ffprobe", "-v", "error", "-select_streams", "a:0",
                        "-show_entries", "stream=codec_name", "-of",
                        "csv=p=0", video],
                       capture_output=True, text=True, timeout=120)
    return (r.stdout or "").strip().lower()


def son_a_reencoder(video):
    c = codec_audio(video)
    return bool(c) and c not in AUDIO_PORTABLE_MP4


def duree_audio(video):
    r = _lancer(["ffprobe", "-v", "error", "-select_streams", "a:0",
                        "-show_entries", "stream=duration", "-of", "csv=p=0",
                        video], capture_output=True, text=True, timeout=120)
    try:
        return float((r.stdout or "0").strip() or 0)
    except ValueError:
        return 0.0


def empreinte_audio(video):
    """Empreinte du flux SON, sans le reencoder. Sert a prouver deux choses :
    que la musique d'une video n'a pas bouge, et que deux videos n'ont pas
    la MEME musique."""
    r = _lancer(["ffmpeg", "-v", "error", "-i", video, "-map", "0:a",
                        "-f", "md5", "-"], capture_output=True, text=True)
    t = (r.stdout or "").strip()
    return t.split("=")[-1] if "=" in t else ""


def bruler_pov(video, texte, sortie):
    """Ecrit le POV sur la video. La musique de la video est gardee telle quelle."""
    l, h, _ = dimensions(video)
    rep = _temp(prefix="manita_pov_")
    png = os.path.join(rep, "texte.png")
    info = image_pov(texte, l, h, png)

    cmd = ["ffmpeg", "-y", "-v", "error", "-i", video, "-i", png,
           "-filter_complex", "[0][1]overlay=0:0:format=auto",
           "-c:v", "libx264", "-preset", ENC_PRESET, "-crf", ENC_CRF_POV,
           "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    # LE SON : recopie quand le MP4 sait le porter, reencode quand il ne
    # sait pas, au lieu d'echouer. On le NOTE : un son reencode n'a plus la
    # meme empreinte, et les controles du lot doivent le savoir.
    reencode = False
    if a_du_son(video):
        if son_a_reencoder(video):
            cmd += ["-c:a", "aac", "-b:a", "192k"]
            reencode = True
        else:
            cmd += ["-c:a", "copy"]
    else:
        cmd += ["-an"]
    cmd += [sortie]
    r = _lancer(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg: %s" % r.stderr.strip()[:400])
    info["png"] = png
    info["son_reencode"] = reencode
    info["controles"] = controler_brulage(video, sortie, png)
    info["conforme"] = all(c["ok"] for c in info["controles"])
    return info


# ------------------------------------------------- la preuve que c'est ecrit

def _image_a(video, t, l, h):
    """Sort UNE image de la video, a la taille exacte, en tableau de nombres."""
    from PIL import Image
    import numpy as np
    rep = _temp(prefix="manita_img_")
    f = os.path.join(rep, "i.png")
    _lancer(["ffmpeg", "-y", "-v", "error", "-i", video,
                    "-vf", "select=gte(t\\,%f)" % t, "-frames:v", "1",
                    "-s", "%dx%d" % (l, h), f],
                   capture_output=True, text=True)
    if not os.path.isfile(f):
        return None
    return np.asarray(Image.open(f).convert("RGB"), dtype=np.int16)


def controles_masque(image, rgba):
    """Controles qui lisent l'IMAGE DE TEXTE (autre source que la video) et
    la comparent au resultat : la ou l'image dit blanc plein, le resultat doit
    etre clair ; la ou elle dit noir plein, il doit etre sombre. Sert pour une
    video comme pour une photo."""
    import numpy as np
    ctrl = []

    def c(nom, ok, detail):
        ctrl.append({"controle": nom, "ok": bool(ok), "detail": detail})

    opaque = rgba[:, :, 3] > 250
    blanc = opaque & (rgba[:, :, 0] > 240) & (rgba[:, :, 1] > 240) & (rgba[:, :, 2] > 240)
    noir = opaque & (rgba[:, :, 0] < 15) & (rgba[:, :, 1] < 15) & (rgba[:, :, 2] < 15)
    # LA PLAQUE : sombre et SEMI-transparente, donc son alpha n'est ni 0 ni 255.
    # Faute du 17/09/2026 : les controles cherchaient un contour noir OPAQUE
    # autour des lettres. Avec la plaque il n'y en a plus, et les dix variantes
    # etaient declarees « a revoir » alors qu'elles etaient justes.
    plaque = ((rgba[:, :, 3] >= 120) & (rgba[:, :, 3] <= 250)
              & (rgba[:, :, 0] < 40) & (rgba[:, :, 1] < 40) & (rgba[:, :, 2] < 40))
    gris = image.mean(axis=2)
    if blanc.sum() >= 100:
        c("methode 2 : le blanc est blanc", gris[blanc].mean() >= 200,
          "clarte %.0f / 255 sur %d points" % (gris[blanc].mean(), int(blanc.sum())))
    else:
        c("methode 2 : le blanc est blanc", False, "pas de blanc plein dans l'image")
    # une VRAIE plaque est plus grande que le texte qu'elle porte ; les
    # bords adoucis d'un contour noir, eux, sont bien plus petits.
    if plaque.sum() >= max(5000, int(blanc.sum())):
        c("la plaque est sombre", gris[plaque].mean() <= 110,
          "clarte %.0f / 255 sur %d points" % (gris[plaque].mean(), int(plaque.sum())))
        c("la plaque couvre le texte", plaque.sum() >= blanc.sum() * 2.0,
          "%d points de plaque pour %d blancs" % (int(plaque.sum()), int(blanc.sum())))
    else:
        c("le contour noir est noir",
          noir.sum() >= 100 and gris[noir].mean() <= 70,
          "clarte %.0f / 255 sur %d points" % (
              gris[noir].mean() if noir.sum() else 255, int(noir.sum())))
        c("contour sur tout le texte", noir.sum() >= blanc.sum() * 0.8,
          "%d points noirs pour %d blancs" % (int(noir.sum()), int(blanc.sum())))
    cols = np.where(opaque.any(axis=0))[0]
    large = rgba.shape[1]
    if len(cols):
        g, dr = int(cols[0]), int(cols[-1])
        milieu = (g + dr) / 2.0
        c("texte centre", abs(milieu - large / 2.0) <= large * 0.08,
          "milieu a %d px, image %d px" % (int(milieu), large))
        c("texte dans les bords", g >= large * 0.02 and dr <= large * 0.98,
          "de %d a %d px" % (g, dr))
    else:
        c("texte centre", False, "aucun texte dans l'image")
    return ctrl


def controler_brulage_direct(final, png, reference=None):
    """Le POV est brule PENDANT l'assemblage : il n'existe donc PAS de version
    « avant » du montage a comparer. On verifie quand meme par DEUX lectures
    qui ne viennent pas de la meme source :
      1. la bande du texte est PLUS SOMBRE dans le montage que la meme bande
         dans la scene d'origine — c'est la plaque qui l'assombrit ;
      2. le blanc pose est EXACTEMENT la ou le masque de l'image de texte le
         dit (lecture de l'image de texte, pas de la video).
    Plus la duree, le son, et le texte dans les bords."""
    from PIL import Image
    import numpy as np
    ctrl = []

    def c(nom, ok, detail):
        ctrl.append({"controle": nom, "ok": bool(ok), "detail": detail})

    l, h, d = dimensions(final)
    c("video ecrite et lisible", l > 0 and h > 0 and d > 1.0,
      "%dx%d, %.2f s" % (l, h, d))
    son = a_du_son(final)
    c("son present", son, "oui" if son else "AUCUN")

    rgba = np.asarray(Image.open(png).convert("RGBA"), dtype=np.int16)
    masque = rgba[:, :, 3]
    dedans = masque > 200
    if dedans.sum() < 200:
        c("du texte a dessiner", False, "masque vide")
        return ctrl

    t = min(1.0, max(0.3, d / 2.0))
    b = _image_a(final, t, l, h)
    if b is None:
        c("image lisible", False, "impossible de sortir une image du montage")
        return ctrl

    a_ref = _image_a(reference, 0.5, l, h) if reference else None
    if a_ref is None:
        c("methode 1 : la bande a change", False, "aucune scene de reference")
    else:
        gris_b = b.mean(axis=2)
        gris_a = a_ref.mean(axis=2)
        # MA FAUTE, corrigee tout de suite : je comparais la zone du TEXTE
        # (alpha au-dessus de 200), qui devient BLANCHE, et j'attendais
        # qu'elle s'assombrisse. Ce qu'il faut mesurer, c'est que toute la
        # zone du POV — plaque COMPRISE — a CHANGE par rapport a la scene
        # d'origine, qui n'a jamais porte de texte.
        zone = masque >= 120
        ecart = float(np.abs(gris_b - gris_a)[zone].mean())
        c("methode 1 : la zone du POV a change", ecart >= 12,
          "ecart moyen %.0f / 255 (scene %.0f, montage %.0f)"
          % (ecart, gris_a[zone].mean(), gris_b[zone].mean()))

    ctrl.extend(controles_masque(b, rgba))
    return ctrl


def controler_brulage(avant, apres, png):
    """DEUX methodes qui ne lisent PAS la meme chose :
    1. la bande de texte a-t-elle CHANGE par rapport a la video d'origine ?
    2. le blanc pose est-il EXACTEMENT la ou le masque de l'image le dit ?
    Plus les controles de duree et de son."""
    from PIL import Image
    import numpy as np
    ctrl = []

    def c(nom, ok, detail):
        ctrl.append({"controle": nom, "ok": bool(ok), "detail": detail})

    l1, h1, d1 = dimensions(avant)
    l2, h2, d2 = dimensions(apres)
    c("meme format", (l1, h1) == (l2, h2), "%dx%d -> %dx%d" % (l1, h1, l2, h2))
    c("meme duree", abs(d1 - d2) <= 0.25, "%.2f s -> %.2f s" % (d1, d2))
    son_avant, son_apres = a_du_son(avant), a_du_son(apres)
    c("son garde", son_avant == son_apres and son_avant,
      "avant %s / apres %s" % ("oui" if son_avant else "AUCUN",
                               "oui" if son_apres else "AUCUN"))

    rgba = np.asarray(Image.open(png).convert("RGBA"), dtype=np.int16)
    masque = rgba[:, :, 3]
    t = min(1.0, max(0.2, d2 / 2))
    a = _image_a(avant, t, l1, h1)
    b = _image_a(apres, t, l1, h1)
    if a is None or b is None:
        c("image lisible", False, "impossible de sortir une image")
        return ctrl

    dedans = masque > 200
    dehors = masque == 0
    if dedans.sum() < 200:
        c("du texte a dessiner", False, "masque vide")
        return ctrl

    # methode 1 : la bande de texte a CHANGE par rapport a la video d'origine
    ecart = float(np.abs(b - a)[dedans].mean())
    c("methode 1 : la bande a change", ecart >= 12, "ecart moyen %.1f / 255" % ecart)

    # methode 2 et les suivants : lus sur l'IMAGE DE TEXTE, autre source
    ctrl.extend(controles_masque(b, rgba))

    # le reste de l'image n'a pas ete abime
    if dehors.sum() > 1000:
        reste = float(np.abs(b - a)[dehors].mean())
        c("le reste de l'image intact", reste <= 6.0, "ecart moyen %.1f / 255" % reste)
    return ctrl


MOTS_INTERDITS = ["تحوّس", "تحوس", "الكاس", "الصوردي", "COD", "مضمون", "تربح"]


def preuve_pov():
    """Controle la bibliotheque de POV elle-meme. Le client a le droit de la
    modifier : ce controle lui dit tout de suite s'il a casse une regle."""
    fautes = []
    tous = []
    for niche, liste in POV.items():
        if len(liste) != 10:
            fautes.append("%s : %d POV au lieu de 10" % (niche, len(liste)))
        compte = {}
        for a, _ in liste:
            compte[a] = compte.get(a, 0) + 1
        if sorted(compte) != sorted(ANGLES) or set(compte.values()) != {2}:
            fautes.append("%s : angles mal repartis (%s)" % (niche, compte))
        if [a for a, _ in liste[:5]] != ANGLES:
            fautes.append("%s : les 5 premieres ne donnent pas les 5 angles" % niche)
        for i, (_, t) in enumerate(liste, 1):
            tous.append(t)
            corps = t[4:] if t.startswith("POV:") else t
            for m in MOTS_INTERDITS:
                if m in t:
                    fautes.append("%s %d : mot interdit \"%s\"" % (niche, i, m))
            if any(c.isdigit() for c in corps):
                fautes.append("%s %d : un chiffre dans le texte" % (niche, i))
            emo = [c for c in t if _est_emoji(c) and c != "\ufe0f"]
            if len(emo) > 1:
                fautes.append("%s %d : %d emoji" % (niche, i, len(emo)))
            if emo and not _est_emoji(t.rstrip()[-1]):
                fautes.append("%s %d : l'emoji n'est pas a la fin" % (niche, i))
            if len(t) > 62:
                fautes.append("%s %d : %d caracteres" % (niche, i, len(t)))
    if len(set(tous)) != len(tous):
        fautes.append("deux POV identiques dans la bibliotheque")
    return {"ok": not fautes, "fautes": fautes,
            "detail": "%d POV, %d sous-niches, %d angles"
                      % (len(tous), len(POV), len(ANGLES))}


def preuve_liaison():
    """Prouve, SUR CETTE MACHINE, que les lettres arabes sont bien LIEES.
    C'est LE piege : ffmpeg ecrit l'arabe lettre par lettre, detache, et
    personne ne s'en apercoit avant de voir la video finie.
    La reference est la MEME phrase dessinee lettre par lettre : une lettre
    seule sort toujours dans sa forme isolee, quel que soit le moteur.
    DEUX methodes qui ne mesurent pas la meme chose :
      1. la LARGEUR   : des lettres liees prennent moins de place
      2. les COUPURES : des lettres liees forment un seul trait continu"""
    from PIL import Image, ImageDraw
    import numpy as np

    mot = "لبسة"
    police = police_arabe(80)
    if police is None:
        return {"ok": False, "detail": "aucune police arabe sur cette machine"}

    def dessiner(txt):
        im = Image.new("L", (1600, 220), 0)
        ImageDraw.Draw(im).text((40, 40), txt, fill=255, font=police)
        colonnes = np.asarray(im).max(axis=0) > 40
        if not colonnes.any():
            return 0, 0
        i = int(np.argmax(colonnes))
        j = int(len(colonnes) - np.argmax(colonnes[::-1]))
        bande = colonnes[i:j]
        coupures = int(np.sum(bande[:-1] & ~bande[1:]))   # fins de trait
        return j - i, coupures

    lie, coupures = dessiner(_mise_en_forme(mot))
    isolees = sum(dessiner(c)[0] for c in mot)   # chaque lettre seule = forme isolee

    m1 = lie > 0 and isolees > 0 and lie < isolees * 0.85
    m2 = lie > 0 and coupures < len(mot) - 1
    return {"ok": bool(m1 and m2), "m1": bool(m1), "m2": bool(m2),
            "methode1_largeur": "%d px lie / %d px lettre par lettre" % (lie, isolees),
            "methode2_coupures": "%d coupure(s) / %d si detache" % (coupures, len(mot) - 1),
            "moteur": "Pillow raqm" if _raqm() else "arabic_reshaper + bidi"}


# =================================================================
#  PARTIE 4 — IL CHOISIT LES MEILLEURES PHOTOS ET LES PREPARE POUR LA PUB
# =================================================================

PHOTO_MINI_KO   = 150    # regle maison : une photo de pub pese entre
PHOTO_MAXI_KO   = 300    # 150 et 300 Ko, jamais plus
PHOTO_LARGEUR   = 1080   # format STATIQUE de la pub Meta : 1080 x 1350
PHOTO_RATIO     = 4.0 / 5.0     # largeur / hauteur
PHOTO_PAR_LOT   = 5      # les CINQ meilleures, par couleur
PHOTO_MIN_LOT   = 4      # et JAMAIS moins de quatre : une pub statique se
                         # teste avec quatre a cinq visuels, pas deux
ECART_PHOTOS    = 18     # mesure sur 24 vraies photos : les quasi-jumelles
                         # sont sous 15, la mediane du lot est a 27
NOTE_LARGEUR    = 480    # largeur d'analyse : comparable d'une photo a l'autre

# poids des trois criteres. Une photo floue ne se rattrape pas : la nettete
# pese le plus lourd.
POIDS = {"nettete": 0.50, "exposition": 0.30, "vetement": 0.20}

# Une photo FLOUE ne se rattrape pas avec une belle lumiere : sous cette part
# de la nettete mediane du lot, elle est ecartee, point. C'est ainsi qu'un
# oeil humain trie, et ca evite qu'un flou bien expose passe devant une
# photo nette un peu bruitee.
FLOU_MINI = 0.45


def _gris(chemin, largeur=NOTE_LARGEUR):
    from PIL import Image
    import numpy as np
    im = Image.open(chemin).convert("RGB")
    h = max(1, int(im.height * largeur / im.width))
    p = im.resize((largeur, h))
    return np.asarray(p.convert("L"), dtype=np.float64), p


def nettete(g):
    """Variance du laplacien : c'est la mesure du FLOU. Une photo nette a
    des bords francs, donc un laplacien qui varie beaucoup."""
    lap = (g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
           - 4.0 * g[1:-1, 1:-1])
    return float(lap.var())


def exposition(g):
    """Rend une note entre 0 et 1. On punit le noir bouche, le blanc crame,
    et une image globalement trop sombre ou trop claire."""
    import numpy as np
    n = g.size
    bouche = float((g < 8).sum()) / n
    crame = float((g > 247).sum()) / n
    moyenne = float(g.mean()) / 255.0
    ecart = abs(moyenne - 0.55)
    return max(0.0, 1.0 - (bouche * 4 + crame * 6 + ecart * 2))


def part_vetement(p):
    """Part de la fenetre du corps occupee par LA couleur dominante.
    Si le vetement remplit bien le cadre, cette part est haute ; si la photo
    est prise de loin ou de travers, le mur prend la place et la part chute."""
    import numpy as np
    a = np.asarray(p, dtype=np.float64)
    h, w = a.shape[:2]
    corps = a[int(h * FENETRE_Y[0]):int(h * FENETRE_Y[1]),
              int(w * FENETRE_X[0]):int(w * FENETRE_X[1])].reshape(-1, 3)
    if len(corps) < 30:
        return 0.0
    centre = amas_dominant(corps)
    ecart = np.sqrt(((corps - centre) ** 2).sum(axis=1))
    return float((ecart < 40).mean())


def note_photos(chemins):
    """Note chaque photo, puis CLASSE. On note par RANG et pas par seuil :
    un seuil absolu depend de l'appareil et du studio, un rang compare
    les photos entre elles, ce qui est le vrai besoin."""
    fiches = []
    for c in chemins:
        try:
            g, p = _gris(c)
            c1, c2 = classer_image(c)      # les DEUX lectures de couleur
            f = {"fichier": c, "nettete": nettete(g), "exposition": exposition(g),
                 "vetement": part_vetement(p), "couleur": c1,
                 "accord_couleur": bool(c1 and c1 == c2),
                 "empreinte": empreinte(c)}
        except Exception as e:
            f = {"fichier": c, "erreur": str(e), "nettete": 0.0,
                 "exposition": 0.0, "vetement": 0.0, "couleur": None,
                 "empreinte": None}
        fiches.append(f)

    n = len(fiches)
    for critere in ("nettete", "exposition", "vetement"):
        ordre = sorted(range(n), key=lambda i: fiches[i][critere])
        for rang, i in enumerate(ordre):
            fiches[i]["rang_" + critere] = rang / max(1, n - 1)
    net = sorted(f["nettete"] for f in fiches)
    mediane = net[len(net) // 2] if len(net) % 2 else (
        (net[len(net) // 2 - 1] + net[len(net) // 2]) / 2.0) if net else 0.0
    for f in fiches:
        f["note"] = sum(POIDS[c] * f["rang_" + c]
                        for c in ("nettete", "exposition", "vetement"))
        f["mediane_nettete"] = mediane
        f["floue"] = bool(mediane and f["nettete"] < mediane * FLOU_MINI)
    return fiches


def choisir_photos(fiches, combien=PHOTO_PAR_LOT, ecart=ECART_PHOTOS):
    """Les MEILLEURES, mais pas cinq fois la meme pose : on refuse une photo
    trop proche d'une deja retenue (meme empreinte que pour les scenes
    repetees d'une video)."""
    retenues, refusees = [], []
    for f in sorted(fiches, key=lambda x: -x["note"]):
        if f.get("empreinte") is None:
            refusees.append((f, "illisible")); continue
        if f.get("floue"):
            refusees.append((f, "floue (%.0f contre %.0f de mediane)"
                             % (f["nettete"], f.get("mediane_nettete", 0)))); continue
        if len(retenues) >= combien:
            refusees.append((f, "hors des %d" % combien)); continue
        trop_proche = None
        for r in retenues:
            ds, dc = distance(f["empreinte"], r["empreinte"])
            if ds <= ecart and dc <= SEUIL_COULEUR:
                trop_proche = os.path.basename(r["fichier"]); break
        if trop_proche:
            refusees.append((f, "trop proche de %s" % trop_proche))
        else:
            retenues.append(f)
    return retenues, refusees


def _hsv_dominante(f):
    """Teinte, saturation et clarte de la couleur dominante du vetement."""
    from PIL import Image
    import numpy as np
    im = np.asarray(Image.open(f["fichier"]).convert("RGB").resize((240, 320)),
                    dtype=np.float64)
    h, w = im.shape[:2]
    corps = im[int(h * FENETRE_Y[0]):int(h * FENETRE_Y[1]),
               int(w * FENETRE_X[0]):int(w * FENETRE_X[1])].reshape(-1, 3)
    if len(corps) < 30:
        return (0.0, 0.0, 0.0)
    r, g, b = amas_dominant(corps)
    return _hsv(r, g, b)


def _meme_couleur(a, b):
    """Deux photos montrent-elles la MEME couleur de vetement ?
    On ne compare PAS les noms : un blanc creme sous une lampe chaude est lu
    tantot blanc tantot beige, et le lot se couperait en deux pour rien.
    On compare la TEINTE et la SATURATION, qui ne bougent pas avec l'ombre."""
    h1, s1, v1 = a
    h2, s2, v2 = b
    if v1 < 0.25 or v2 < 0.25:            # du noir : la teinte n'a plus de sens
        return (v1 < 0.25) == (v2 < 0.25)
    if s1 < 0.10 and s2 < 0.10:           # deux gris/blancs sans couleur
        return True
    dh = abs(h1 - h2)
    dh = min(dh, 360 - dh)
    return dh <= 25 and abs(s1 - s2) <= 0.15


def par_couleur(fiches):
    """Range les photos par couleur de vetement : quatre couleurs = quatre
    lots. On part des noms, puis on RECOLLE les lots que l'eclairage avait
    separes a tort."""
    groupes = []     # [(hsv de reference, nom, [fiches])]
    for f in sorted(fiches, key=lambda x: -x.get("note", 0)):
        hsv = _hsv_dominante(f)
        place = None
        for g in groupes:
            if _meme_couleur(hsv, g[0]):
                place = g; break
        if place:
            place[2].append(f)
        else:
            groupes.append((hsv, f.get("couleur") or "inconnue", [f]))
    lots, vus = {}, {}
    for _, nom, liste in groupes:
        vus[nom] = vus.get(nom, 0) + 1
        cle = nom if vus[nom] == 1 else "%s %d" % (nom, vus[nom])
        lots[cle] = liste
    return lots


# ---------------------------------------------------------- poids du fichier

def cadrer_pub(im):
    """Met la photo au format STATIQUE de la pub : 1080 x 1350.
    On coupe le moins possible, et on coupe par le BAS plutot que par le
    haut : la tete du mannequin doit rester dans le cadre."""
    l, h = im.size
    vise = PHOTO_RATIO
    if abs(l / float(h) - vise) > 0.005:
        if l / float(h) < vise:          # trop haute : on coupe en hauteur
            nh = int(round(l / vise))
            y0 = int((h - nh) * 0.25)    # un quart en haut, trois quarts en bas
            im = im.crop((0, y0, l, y0 + nh))
        else:                            # trop large : on coupe au centre
            nl = int(round(h * vise))
            x0 = (l - nl) // 2
            im = im.crop((x0, 0, x0 + nl, h))
    return im.resize((PHOTO_LARGEUR, int(round(PHOTO_LARGEUR / vise))))


def compresser_photo(src_image, dest, mini=PHOTO_MINI_KO, maxi=PHOTO_MAXI_KO,
                     largeur=PHOTO_LARGEUR):
    """Ecrit la photo entre 150 et 300 Ko, au format de la pub statique.
    On cherche la qualite par dichotomie au lieu de deviner : on VERIFIE
    le poids obtenu."""
    im = cadrer_pub(src_image.convert("RGB"))
    bas, haut, meilleur = 40, 95, None
    for _ in range(9):
        q = (bas + haut) // 2
        im.save(dest, "JPEG", quality=q, optimize=True, progressive=True)
        ko = os.path.getsize(dest) / 1024.0
        meilleur = (q, ko)
        if ko > maxi:
            haut = q - 1
        elif ko < mini:
            bas = q + 1
        else:
            return {"qualite": q, "ko": round(ko, 1), "dans_la_cible": True,
                    "largeur": im.width}
        if bas > haut:
            break
    # on n'a pas pu tomber dans la fourchette : on le DIT, on ne ment pas
    q, ko = meilleur
    im.save(dest, "JPEG", quality=q, optimize=True, progressive=True)
    return {"qualite": q, "ko": round(os.path.getsize(dest) / 1024.0, 1),
            "dans_la_cible": mini <= os.path.getsize(dest) / 1024.0 <= maxi,
            "largeur": im.width}


def photo_pub(source, texte, dest):
    """Ecrit le POV sur la photo, puis la met au bon poids pour la pub."""
    from PIL import Image
    import numpy as np
    base = cadrer_pub(Image.open(source).convert("RGB"))
    rep = _temp(prefix="manita_ph_")
    png = os.path.join(rep, "texte.png")
    info = image_pov(texte, base.width, base.height, png)
    calque = Image.open(png).convert("RGBA")
    fond = base.convert("RGBA")
    fond.alpha_composite(calque)
    poids = compresser_photo(fond, dest)
    info.update(poids)

    # on RELIT le fichier ecrit : la seule preuve qui vaut
    relu = np.asarray(Image.open(dest).convert("RGB"), dtype=np.int16)
    info["controles"] = controles_masque(relu, np.asarray(calque, dtype=np.int16))
    info["controles"].append({
        "controle": "poids entre 150 et 300 Ko", "ok": bool(poids["dans_la_cible"]),
        "detail": "%.0f Ko (qualite %d)" % (poids["ko"], poids["qualite"])})
    info["conforme"] = all(c["ok"] for c in info["controles"])
    return info


# =================================================================
#  PARTIE 5 — IL VA CHERCHER LE DOSSIER ET IL LE RANGE
# =================================================================

EXT_VIDEO = (".mp4", ".mov", ".m4v", ".avi", ".mkv")
EXT_PHOTO = (".jpg", ".jpeg", ".png", ".webp", ".heic")
ECART_SEANCE = 10 * 60      # au-dela de 10 min sans prise, c'est une autre seance
COU_COUVERT  = 0.22         # sous cette part de peau au cou, le cou est couvert


def telecharger_drive(lien, dossier):
    """Telecharge un dossier Drive PUBLIC. Aucun compte, aucun mot de passe,
    aucun jeton : seulement le lien de partage. Si le lien n'est pas public,
    on le dit au lieu de demander un identifiant."""
    try:
        import gdown
    except ImportError:
        raise RuntimeError("gdown n'est pas installe. Lance : "
                           "python3 manita.py --installer")
    os.makedirs(dossier, exist_ok=True)
    try:
        r = gdown.download_folder(url=lien, output=dossier, quiet=False,
                                  use_cookies=False)
    except Exception as e:
        raise RuntimeError(
            "le dossier Drive n'a pas pu etre lu.\n"
            "   Verifie que le lien est en partage PUBLIC "
            "(« Tous les utilisateurs disposant du lien »).\n"
            "   Reponse exacte : %s" % str(e)[:300])
    if not r:
        raise RuntimeError("le dossier Drive est vide ou n'est pas public")
    return dossier


def _instant(chemin):
    """Instant de la prise de vue. On cherche la vraie date dans le fichier
    (EXIF pour une photo, metadonnee pour une video) avant de se rabattre sur
    la date du fichier, qu'une copie peut avoir changee."""
    bas = chemin.lower()
    if bas.endswith(EXT_PHOTO):
        try:
            from PIL import Image
            e = Image.open(chemin).getexif()
            t = e.get(36867) or e.get(36868) or e.get(306)
            if t:
                import time as _t
                return _t.mktime(_t.strptime(str(t)[:19], "%Y:%m:%d %H:%M:%S"))
        except Exception:
            pass
    elif bas.endswith(EXT_VIDEO):
        try:
            r = _lancer(["ffprobe", "-v", "error", "-show_entries",
                                "format_tags=creation_time", "-of", "csv=p=0",
                                chemin], capture_output=True, text=True, timeout=120)
            t = (r.stdout or "").strip()
            if t:
                import datetime as _d
                return _d.datetime.fromisoformat(
                    t.replace("Z", "+00:00")).timestamp()
        except Exception:
            pass
    try:
        return os.path.getmtime(chemin)
    except Exception:
        return 0.0


def grouper_par_temps(fichiers, ecart=ECART_SEANCE):
    """Un tournage se fait mannequin par mannequin : les prises d'un meme
    mannequin se suivent dans le temps. Un trou = on change de mannequin.
    C'est bien plus sur que de deviner la personne sur l'image."""
    if not fichiers:
        return []
    dates = sorted(((_instant(f), f) for f in fichiers), key=lambda x: x[0])
    if dates[0][0] <= 0 or dates[-1][0] - dates[0][0] <= 0:
        return [[f for _, f in dates]]        # pas de date fiable : un seul lot
    lots, courant, precedent = [], [dates[0][1]], dates[0][0]
    for t, f in dates[1:]:
        if t - precedent > ecart:
            lots.append(courant); courant = []
        courant.append(f); precedent = t
    if courant:
        lots.append(courant)
    return lots


def _peau_au_cou(chemin):
    """Part de peau visible au niveau du cou et des epaules."""
    from PIL import Image
    import numpy as np
    im = np.asarray(Image.open(chemin).convert("RGB").resize((300, 400)),
                    dtype=np.float64)
    h, w = im.shape[:2]
    cou = im[int(h * 0.28):int(h * 0.42), int(w * 0.38):int(w * 0.62)].reshape(-1, 3)
    if len(cou) == 0:
        return 0.0
    n = 0
    ech = cou[::7]
    for r, g, b in ech:
        teinte, s, v = _hsv(r, g, b)
        if (teinte <= 45 or teinte >= 350) and 0.15 <= s <= 0.68 and v >= 0.35:
            n += 1
    return n / max(1, len(ech))


def etiquette_cou(photos):
    """Dit si le cou est COUVERT dans ce lot, sur la MEDIANE du groupe.

    CE QUE CETTE MESURE NE FAIT PAS : elle ne reconnait PAS le hijab.
    Verifie a l'oeil sur ses vrais lots : une robe a col ferme, cheveux
    decouverts, donne exactement la meme mesure qu'un hijab. Un foulard noir
    et des cheveux noirs sont indiscernables a ce niveau. Donc on nomme ce
    qu'on mesure vraiment — le cou couvert — et le hijab se lit sur le NOM
    du dossier du fournisseur, qui, lui, ne se trompe pas.
    Photo par photo les deux cas se chevauchent ; au niveau du groupe ils se
    separent nettement (mesure sur 7 lots reels : 0,03 a 0,10 contre 0,25 a 0,38)."""
    vals = []
    for p in photos[:12]:
        try:
            vals.append(_peau_au_cou(p))
        except Exception:
            pass
    if not vals:
        return None, 0.0
    vals.sort()
    med = vals[len(vals) // 2] if len(vals) % 2 else (
        (vals[len(vals) // 2 - 1] + vals[len(vals) // 2]) / 2.0)
    return (med < COU_COUVERT), med


def inventaire(racine):
    """Range ce qu'on a telecharge. Trois methodes, de la plus SURE a la
    moins sure, et on dit toujours laquelle a servi :
      1. l'arborescence du Drive (le fournisseur range deja par mannequin)
      2. l'heure de prise de vue (les prises d'un mannequin se suivent)
      3. un seul lot, et on le DIT — on ne devine pas la personne sur l'image
         (mesure faite : ce genre de tri ne tombe juste que 4 fois sur 5)"""
    # Un mannequin est souvent range en deux sous-dossiers « Videos » et
    # « Photos ». Ce sont DEUX moities du MEME lot : on les recolle sur le
    # dossier du mannequin, sinon on livrerait des videos sans photos.
    MOITIES = ("videos", "video", "videos ", "vidéos", "vidéo",
               "photos", "photo", "images", "image", "pics")
    par_lot = {}
    for dossier, sous, fichiers in os.walk(racine):
        # on ignore tout ce qui est DANS un dossier de travail ou de livraison :
        # sinon un deuxieme passage remonterait nos propres videos et ecrirait
        # un deuxieme texte par-dessus le premier
        # On ne juge QUE ce qui est SOUS la racine. Le nom de la racine
        # elle-meme ne doit jamais disqualifier le dossier : un client peut
        # tres bien appeler son dossier Drive « _shooting », et tout
        # disparaissait alors en silence avec « aucune video ni photo ».
        # (faute trouvee le 17/09/2026 au soir, sur un dossier racine nomme ainsi)
        rel = os.path.relpath(dossier, racine).replace(os.sep, "/")
        parts = [] if rel in (".", "") else rel.split("/")
        if any(p.startswith(("_", ".")) or p.endswith("_livraison")
               for p in parts):
            continue
        vids = sorted(os.path.join(dossier, f) for f in fichiers
                      if f.lower().endswith(EXT_VIDEO) and not f.startswith("."))
        phts = sorted(os.path.join(dossier, f) for f in fichiers
                      if f.lower().endswith(EXT_PHOTO) and not f.startswith("."))
        if not (vids or phts):
            continue
        cle = dossier
        if os.path.basename(dossier).strip().lower() in MOITIES:
            cle = os.path.dirname(dossier)
        lot = par_lot.setdefault(cle, {"dossier": cle, "videos": [], "photos": [],
                                       "methode": "arborescence"})
        lot["videos"] += vids
        lot["photos"] += phts
    groupes = [par_lot[k] for k in sorted(par_lot)]

    # un seul dossier a plat : on coupe par heure de prise de vue
    if len(groupes) == 1 and (len(groupes[0]["videos"]) > 12
                              or len(groupes[0]["photos"]) > 30):
        g = groupes[0]
        lots_v = grouper_par_temps(g["videos"])
        lots_p = grouper_par_temps(g["photos"])
        if len(lots_v) > 1 or len(lots_p) > 1:
            groupes = []
            for k in range(max(len(lots_v), len(lots_p))):
                groupes.append({
                    "dossier": os.path.join(g["dossier"], "seance %d" % (k + 1)),
                    "videos": lots_v[k] if k < len(lots_v) else [],
                    "photos": lots_p[k] if k < len(lots_p) else [],
                    "methode": "heure de prise de vue"})
        else:
            g["methode"] = "un seul lot (aucune date exploitable)"

    for g in groupes:
        couvert, mesure = etiquette_cou(g["photos"]) if g["photos"] else (None, 0.0)
        g["cou_couvert"] = couvert
        g["peau_cou"] = mesure
        g["nom"] = _nom_groupe(g["dossier"], racine)
        # le hijab ne se devine pas sur l'image : il se lit sur le nom du
        # dossier quand le fournisseur l'a ecrit, sinon on repond « ? »
        bas = g["nom"].lower()
        g["hijab"] = True if ("hijab" in bas or "voil" in bas or "حجاب" in bas) else None
    return groupes


def _nom_groupe(dossier, racine):
    """Nom du lot, TOUJOURS sur, jamais « . » ni « .. » : sinon le dossier de
    livraison se replie sur le dossier source et on ecrit chez le client."""
    try:
        rel = os.path.relpath(os.path.abspath(dossier), os.path.abspath(racine))
    except Exception:
        rel = ""
    parts = [p for p in rel.replace("\\", "/").split("/")
             if p not in ("", ".", "..")]
    if not parts:
        return os.path.basename(os.path.abspath(dossier)) or "lot"
    return "/".join(parts)


# =================================================================
#  PARTIE 6 — IL DECOUPE LES SCENES ET MONTE LES 10 VARIANTES
# =================================================================

SEUIL_COUPE   = 12     # mesure sur ses vraies videos : a l'interieur d'une
                       # scene les images voisines s'ecartent de 4 environ,
                       # une coupe fait 20 a 25. Le 12 est au milieu du trou.
SCENE_MINI    = 1.0    # une scene plus courte est recollee a sa voisine
SCENES_PAR_VARIANTE = 9
VARIANTES     = 10

# ---------------------------------------------- LE FORMAT ET LA DUREE DE LA PUB
# La regle de la maison : une creative COD se regarde sur un telephone, en
# 9:16, entre quinze et vingt-cinq secondes.
# 06/10/2026 — AUCUN FLOU (regle du vendeur). Avant, ce qui ne remplissait
# pas le 9:16 etait comble par le meme plan agrandi et FLOUTE. Maintenant on
# fait comme le style natif de MONTER-10 :
#   - des rushes deja au format gardent LEUR definition (un 720x1280 sort en
#     720x1280 : il n'est plus gonfle a 1080x1920) ;
#   - sinon on REMPLIT : mise a l'echelle par le haut puis recadrage centre
#     en largeur, a la definition du rush (un 1920x1080 donne 608x1080) ; un
#     rush plus HAUT que le format garde son haut (la plaque POV reste
#     au-dessus de la tete, voir `filtre_remplir`) ;
#   - des scenes de tailles differentes : la taille MAJORITAIRE (une video
#     source = une voix ; a egalite, celle deja au format, puis la plus
#     grande), les autres scenes y sont REMPLIES une fois, avant le collage.
# Jamais de flou, jamais de barres. La plaque POV ne bouge pas : `image_pov`
# la dessine a la taille de la video, aux memes proportions.
FORMAT_COD      = (1080, 1920)
FORMAT_CARRE    = (1080, 1350)
FORMAT_SORTIE   = "9:16"      # "9:16" | "4:5" | "source"
SCENE_MAX       = 3.0         # une scene ne tient jamais plus longtemps
IPS_SCENE       = 30          # 06/10/2026 : TOUTES les scenes a 30 images/s
                              # (comme les blocs de MONTER-10). Une camera a
                              # 25 i/s collee a un telephone a 30 : le collage
                              # rejouait le telephone au ralenti (40 ms par
                              # image) apres un gel de 0,5 s, et la video
                              # durait 6 s au lieu de 5
DUREE_CIBLE_MIN = 15.0
DUREE_MINI_LIVREE = 10.0   # LOI DU VENDEUR (08/10/2026) : chaque video livree DEPASSE
                           # strictement 10 s. On ajoute des scenes jusqu'a 10,2 s au
                           # moins ; sinon la variante est « trop_courte » (A REVOIR,
                           # jamais conforme) et le bureau la jette a son controle
DUREE_LIVREE_VISEE = 10.2
DUREE_CIBLE_MAX = 25.0
TOLERANCE_FORMAT = 0.01       # a 1 % pres, un rush est deja au format


def format_demande():
    if FORMAT_SORTIE == "9:16":
        return FORMAT_COD
    if FORMAT_SORTIE == "4:5":
        return FORMAT_CARRE
    return None


def taille_majoritaire(tailles):
    """La taille la plus frequente (une video source = une voix) ; a egalite,
    la plus grande. Paire : x264 en yuv420p refuse une taille impaire.
    (Meme regle que MONTER-10.)"""
    from collections import Counter
    t = [tuple(x) for x in tailles if x and x[0] > 0 and x[1] > 0]
    if not t:
        return None
    l, h = max(Counter(t).items(), key=lambda kv: (kv[1], kv[0][0] * kv[0][1]))[0]
    return (l - l % 2, h - h % 2)


def taille_de_sortie(tailles, vise):
    """La taille des variantes. tailles : (largeur, hauteur) des videos
    sources ; vise : le format demande ((1080, 1920) = 9:16, (1080, 1350) =
    4:5) ou None (« source »). Seule la FORME de `vise` compte : on garde la
    definition du rush, on ne la gonfle pas.
    06/10/2026 (relecture) : a EGALITE de voix, une taille deja au format
    demande passe avant une plus grande qui ne l'est pas. Un 1080x1920 et un
    1920x1080 (meme surface) : c'etait l'ORDRE DES FICHIERS qui decidait, et
    le premier en paysage donnait 608x1080 (le 9:16 natif reduit, le paysage
    rogne aux deux tiers)."""
    if not vise:
        return taille_majoritaire(tailles)
    from collections import Counter
    r = vise[0] / float(vise[1])
    t = [tuple(x) for x in tailles if x and x[0] > 0 and x[1] > 0]
    if not t:
        return None

    def au_format(x):
        return abs(x[0] / float(x[1]) - r) <= TOLERANCE_FORMAT * r
    l, h = max(Counter(t).items(), key=lambda kv: (kv[1], au_format(kv[0]),
                                                    kv[0][0] * kv[0][1]))[0]
    t = (l - l % 2, h - h % 2)
    l, h = t
    if au_format(t):
        return t                         # deja au format : on n'y touche pas
    if l / float(h) > r:                 # trop large : on garde la hauteur
        l = 2 * int(round(h * r / 2.0))
    else:                                # trop haute : on garde la largeur
        h = 2 * int(round(l / r / 2.0))
    return (l, h)


def filtre_remplir(largeur, hauteur):
    """REMPLIR le cadre : mise a l'echelle par le haut puis recadrage. Ni flou
    ni barres. Sur une image deja a la bonne taille, il ne fait rien.
    Le recadrage est CENTRE en largeur, mais il garde le HAUT de l'image
    quand le rush est plus haut que le format (06/10/2026, relecture sur de
    vrais rushes 9:16 montes en 4:5) : recadre au centre, le haut perdait
    14 % de la hauteur, la tete du mannequin montait sous la plaque POV, et
    la plaque tombait SUR LE VISAGE quatre fois sur quatre. En gardant le
    haut, la plaque reste ou elle est sur le rush natif (au-dessus de la
    tete) ; c'est le bas (les pieds) qui part."""
    return ("scale=%d:%d:force_original_aspect_ratio=increase,"
            "crop=%d:%d:(iw-ow)/2:0,setsar=1" % (largeur, hauteur, largeur, hauteur))


EXT_MUSIQUE   = (".mp3", ".m4a", ".aac", ".wav", ".ogg")


# LES COUPES A L'IMAGE PRES (07/10/2026). L'ancien decoupage regardait une
# image toutes les 0,2 s : la coupe etait posee jusqu'a 0,2 s APRES la vraie,
# chaque scene finissait sur un bout du plan suivant, et les coupes plus
# douces que le seuil restaient DANS les scenes — sur de vrais rushes, des
# flashs de 0,07 a 0,3 s d'une autre abaya. Maintenant : toutes les images
# (30 par seconde, toutes petites), le saut de chacune a la suivante, et une
# coupe est un pic net (le meme instrument que MONTER-10 : au-dessus de 6,
# trois fois le mouvement ordinaire et trois fois le mouvement autour). Une
# scene reste a 0,1 s de chaque coupe, et une scene de moins d'une seconde
# est REFUSEE (la recoller a sa voisine, c'etait garder le flash dedans).
COUPE_FINE_SEUIL   = 6.0
COUPE_FINE_FACTEUR = 3.0
COUPE_MARGE        = 0.10
RYTHME_VENDEUR = ("rythme du vendeur non applique (manita.py, dernier recours) : "
                  "les blocs de 1,6 s par couleur puis 3 s sont faits par MONTER-10")


def coupes_fines(video, ips=30):
    """Les instants (secondes) des coupes deja presentes dans la video, a
    l'image pres. None si la video ne se decode pas."""
    import numpy as np
    l, h = 36, 64
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf",
                            "fps=%d,scale=%d:%d" % (ips, l, h), "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=3600)
    except Exception:
        return None
    taille = l * h * 3
    n = len(r.stdout or b"") // taille
    if r.returncode != 0 or n < 3:
        return None
    ims = np.frombuffer(r.stdout[:n * taille], dtype=np.uint8).reshape(n, taille)
    sauts = np.zeros(n)
    for k0 in range(1, n, 2000):
        k1 = min(n, k0 + 2000)
        sauts[k0:k1] = np.abs(ims[k0:k1].astype(np.int16)
                              - ims[k0 - 1:k1 - 1].astype(np.int16)).mean(axis=1)
    mouvement = float(np.median(sauts[1:])) if n > 1 else 0.0
    seuil = max(COUPE_FINE_SEUIL, COUPE_FINE_FACTEUR * mouvement)

    def fond(k):
        autour = np.concatenate([sauts[max(1, k - 6):max(1, k - 1)], sauts[k + 2:k + 7]])
        return float(np.median(autour)) if len(autour) else 0.0

    pics = [k for k in range(1, n)
            if sauts[k] >= seuil and sauts[k] >= sauts[k - 1]
            and (k + 1 >= n or sauts[k] >= sauts[k + 1])
            and sauts[k] >= COUPE_FINE_FACTEUR * fond(k)]
    coupes = []
    for k in pics:                       # deux pics colles = une seule coupe
        if coupes and k - coupes[-1] <= 2:
            if sauts[k] > sauts[coupes[-1]]:
                coupes[-1] = k
            continue
        coupes.append(k)
    return [round(k / float(ips), 3) for k in coupes]


def scenes(video):
    """Rend les scenes de la video : [(debut, fin), ...], chacune entre deux
    coupes (a COUPE_MARGE de chacune), jamais plus courte que SCENE_MINI.
    Sans decodage fin possible : l'ancienne sonde (une image toutes les
    0,2 s), avec les memes marges et le meme refus des miettes."""
    fin = duree(video)
    coupes = coupes_fines(video)
    if coupes is None:
        with tempfile.TemporaryDirectory() as tmp:
            images = sonder(video, tmp)
            if len(images) < 2:
                return [(0.0, fin)] if fin >= SCENE_MINI else []
            emp = [empreinte(os.path.join(tmp, x)) for x in images]
            coupes = []
            for k in range(len(emp) - 1):
                if distance(emp[k], emp[k + 1])[0] >= SEUIL_COUPE:
                    # la vraie coupe est entre les deux sondes : on laisse
                    # une sonde de chaque cote
                    coupes.append(round((k + 0.5) * PAS_SONDE, 3))
        marge = COUPE_MARGE + PAS_SONDE / 2.0
    else:
        marge = COUPE_MARGE
    bornes = [0.0] + [c for c in coupes if 0.0 < c < fin] + [fin]
    segs = []
    for k in range(len(bornes) - 1):
        a = bornes[k] + (marge if k > 0 else 0.0)
        b = bornes[k + 1] - (marge if k + 2 < len(bornes) else 0.05)
        if b - a >= SCENE_MINI:          # une miette (un flash) est REFUSEE
            segs.append((round(a, 3), round(b, 3)))
    return decouper_longues(segs)


# LES LONGUES SCENES (07/10/2026, casse des coupes a l'image pres). Une prise
# CONTINUE — une video de telephone, aucune coupe dedans — ne donnait plus
# qu'UNE scene, donc un seul plan de 3 s : l'ancienne sonde voyait une
# « coupe » a chaque mouvement et en tirait des dizaines. Trois prises de
# 30 s sans coupe donnaient trois scenes, un seul enchainement possible, et la
# mission tombait (« pas assez de videos saines »). Une scene longue est donc
# decoupee en MORCEAUX : chacun donne un plan de 3 s, et deux plans voisins de
# la meme prise sont separes de 3 s de film au moins (la coupe se voit). Les
# morceaux restent entre les memes coupes : aucun flash n'y entre.
PAS_LONGUE_SCENE = 2 * SCENE_MAX   # 6 s : 3 s gardees, 3 s sautees
MORCEAUX_MAXI    = 20              # par video ; au-dela, le pas s'allonge (une
                                   # prise de huit minutes ne fait pas 80 plans)


def decouper_longues(segs, pas=PAS_LONGUE_SCENE, maxi=MORCEAUX_MAXI):
    """Les scenes [(debut, fin)], les longues coupees en morceaux de `pas`
    secondes (le dernier garde la fin de la scene). Une scene qui ne porte
    pas deux plans de 3 s espaces de 3 s reste entiere."""
    def combien(a, b, p):
        return int((b - a - SCENE_MAX) // p) + 1 if b - a >= p + SCENE_MAX else 1
    total = sum(combien(a, b, pas) for a, b in segs)
    if total > maxi:
        pas = pas * total / float(maxi)
    out = []
    for a, b in segs:
        n = combien(a, b, pas)
        for k in range(n):
            a_k = a + k * pas
            out.append((round(a_k, 3), round(b if k == n - 1 else a_k + pas, 3)))
    return out


def longueur_scene(a, b):
    """La longueur gardee d'une scene, au plus pres du rythme du vendeur :
    3 s si elle les porte, sinon 1,6 s, sinon ce qu'elle a (une seconde au
    moins : `scenes` refuse les miettes)."""
    d = b - a
    if d >= SCENE_MAX:
        return SCENE_MAX
    if d >= BLOC_MULTI:
        return BLOC_MULTI
    return d


def extraire_scene(video, debut, fin, dest):
    """Coupe une scene. On decode depuis le debut (jamais -ss avant -i) et on
    reencode : une coupe a la copie tomberait sur l'image cle la plus proche
    et deraperait de plusieurs dixiemes. Toutes les scenes sortent au MEME
    format d'image et de son (IPS_SCENE, AAC 48 kHz stereo) : sinon le
    collage de rushes de telephone et de camera se casse (06/10/2026)."""
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", video,
           "-ss", "%.3f" % debut, "-to", "%.3f" % fin,
           "-vf", "fps=%d" % IPS_SCENE,
           "-c:v", "libx264", "-preset", ENC_PRESET, "-crf", ENC_CRF_SCENE,
           "-pix_fmt", "yuv420p"]
    # LE SON DU MILIEU (06/10/2026, relecture sur de vrais rushes) : il est
    # REENCODE, toujours au MEME format (AAC 48 kHz stereo). Avant, on le
    # recopiait : des scenes de telephone (HE-AAC 44,1 kHz) collees a des
    # scenes de camera (AAC 48 kHz) faisaient echouer le collage (« Number of
    # scalefactor bands in group (48) exceeds limit (47) » : une variante sur
    # trois perdue) ou laissaient la moitie de la video sans son (2,5 s de
    # son pour 6 s d'image). Sans musique, c'est ce son-la qui reste.
    # Trois secondes de son a reencoder : rien a payer.
    if a_du_son(video):
        cmd += ENC_AUDIO + ["-ac", "2"]
    else:
        cmd += ["-an"]
    cmd += [dest]
    r = _lancer(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        raise RuntimeError("coupe refusee : " + (r.stderr.strip()[:200] or "?"))
    return dest


def remplir_scene(scene, largeur, hauteur):
    """Ramene UNE scene a la taille des variantes en la REMPLISSANT (mise a
    l'echelle puis recadrage centre) — jamais de flou ni de barres. Fait une
    seule fois par scene, avant le collage : toutes les scenes d'une variante
    ont alors la meme taille, et le collage ne change jamais de taille en
    route. Le son de la scene (deja au format commun : `extraire_scene`) est
    recopie."""
    dest = "%s_%dx%d.mp4" % (os.path.splitext(scene)[0], largeur, hauteur)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", scene,
           "-vf", filtre_remplir(largeur, hauteur),
           "-c:v", "libx264", "-preset", ENC_PRESET, "-crf", ENC_CRF_SCENE,
           "-pix_fmt", "yuv420p"]
    cmd += (["-c:a", "copy"] if a_du_son(scene) else ["-an"]) + [dest]
    r = _lancer(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0 or not os.path.isfile(dest):
        raise RuntimeError("scene non remplie : " + (r.stderr.strip()[:200] or "?"))
    return dest


VARIATION_MUSIQUE = 0.70   # au-dessus, on entend clairement quelqu'un parler
DUREE_MUSIQUE_MAX = 600    # au-dela de dix minutes, c'est un cours, pas un titre
MUSIQUE_MIN_S = 12.0       # 12 s OU MOINS : ecartee avant le montage (08/10/2026),
                           # la video serait trop courte pour une pub


def est_musique(chemin):
    """Ce fichier est-il une MUSIQUE, ou quelqu'un qui PARLE ?
    On ne se fie pas au dossier ni au nom : on ECOUTE.
    Une voix s'arrete entre les mots, donc son niveau monte et descend sans
    arret ; une musique tient un niveau regulier. On mesure cette variation.
    CE QUE CE CONTROLE NE FAIT PAS, et il faut le savoir : il n'est pas
    capable de trancher a coup sur. Mesure faite sur de vrais fichiers :
    musiques 0,24 a 0,59 ; lecons 0,64 a 1,13 ; vocal WhatsApp 1,08. Les deux
    familles se touchent presque. Le seuil est donc regle pour ne JAMAIS
    refuser une vraie musique (c'est le refus qui enerve) et pour attraper la
    voix franche. Le vrai garde-fou est ailleurs : le dossier de musiques ne
    doit contenir QUE des musiques, et l'outil AFFICHE le nom du fichier
    utilise sur chaque variante — une voix qui passe se voit tout de suite."""
    import numpy as np
    try:
        r = _lancer(["ffmpeg", "-v", "error", "-i", chemin, "-t", "60",
                            "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                           capture_output=True, stdin=subprocess.DEVNULL,
                           timeout=180)
        a = np.frombuffer(r.stdout, dtype=np.int16).astype(np.float64)
    except Exception as e:
        return False, "illisible (%s)" % str(e)[:60]
    if len(a) < 8000:
        return False, "trop court pour etre juge"
    n = 400                                    # fenetres de 50 ms
    a = a[:len(a) // n * n].reshape(-1, n)
    rms = np.sqrt((a ** 2).mean(axis=1)) + 1e-9
    med = float(np.median(rms))
    if med < 20:
        return False, "quasi silencieux"
    variation = float(rms.std() / med)
    try:
        d = duree(chemin)
    except Exception:
        d = 0
    if variation > VARIATION_MUSIQUE:
        return False, ("on entend quelqu'un PARLER (variation %.2f, "
                       "une musique reste sous %.2f)" % (variation, VARIATION_MUSIQUE))
    if d <= 0:
        return False, "duree illisible — je ne le prends pas"
    if d > DUREE_MUSIQUE_MAX:
        return False, ("%d minutes : c'est un enregistrement, pas un titre"
                       % int(d / 60))
    return True, "variation %.2f, %d s" % (variation, int(d))


def musiques_du_dossier(dossier, bavard=True):
    """Rend seulement les VRAIES musiques du dossier. Tout fichier ou l'on
    entend une voix est ecarte, NOMME et explique : on ne colle jamais un
    cours ou un vocal sur une video de pub."""
    if not dossier or not os.path.isdir(dossier):
        return []
    fichiers = sorted(os.path.join(dossier, f) for f in os.listdir(dossier)
                      if f.lower().endswith(EXT_MUSIQUE) and not f.startswith("."))
    gardees, refusees, courtes = [], [], []
    for f in fichiers:
        # LA DUREE D'ABORD : 12 s ou moins (ou illisible) = ecartee, et dite
        try:
            d = duree(f)
        except Exception:
            d = 0.0
        if d <= MUSIQUE_MIN_S:
            courtes.append((f, d))
            continue
        ok, pourquoi = est_musique(f)
        (gardees if ok else refusees).append((f, pourquoi))
    if courtes and bavard:
        print("   [A SAVOIR] %d musique(s) de %d s ou moins ecartee(s) (ou "
              "illisible(s)) : %s" % (len(courtes), int(MUSIQUE_MIN_S),
                                      ", ".join("%s (%.1f s)" % (os.path.basename(f), d)
                                                for f, d in courtes[:8])))
        if not gardees and not refusees:
            print("   [A SAVOIR] aucune musique de plus de %d s : les videos "
                  "sortent sans musique" % int(MUSIQUE_MIN_S))
    if refusees and bavard:
        print("   %d fichier(s) ecarte(s) — on y entend une voix :"
              % len(refusees))
        for f, pourquoi in refusees[:8]:
            print("      %-28s %s" % (os.path.basename(f)[:28], pourquoi))
    if gardees and bavard:
        print("   %d musique(s) retenue(s) — REGARDE CETTE LISTE, si une voix"
              " s'y trouve, retire le fichier :" % len(gardees))
        for f, pourquoi in gardees[:12]:
            print("      %-28s %s" % (os.path.basename(f)[:28], pourquoi))
    return [f for f, _ in gardees]


def assembler(morceaux, musique, dest, largeur=None, hauteur=None,
              pov_png=None):
    """Colle les scenes bout a bout et pose la musique.
    Toutes les scenes sont remises au MEME format, sinon le collage echoue
    des qu'une prise a ete filmee autrement."""
    rep = os.path.dirname(dest)
    liste = os.path.join(rep, "_liste_%s.txt" % os.path.basename(dest))
    with open(liste, "w") as f:
        for m in morceaux:
            f.write("file '%s'\n" % os.path.abspath(m).replace("'", "'\\''"))
    muet = os.path.join(rep, "_muet_%s" % os.path.basename(dest))
    # 06/10/2026 — AUCUN FLOU. Avant, l'image etait posee en entier et ce
    # qui restait autour etait le MEME plan agrandi et FLOUTE : interdit par
    # le vendeur. Les scenes arrivent ici deja a la taille des variantes
    # (`remplir_scene`) : le filtre ne fait alors rien. Une scene qui ne
    # l'est pas est REMPLIE (mise a l'echelle puis recadrage centre), jamais
    # floutee ni bordee de barres.
    # LE POV EST BRULE ICI, dans la MEME passe que le collage : avant, il
    # fallait un troisieme reencodage juste pour poser le texte, et chaque
    # reencodage mange de la finesse.
    entrees = ["-f", "concat", "-safe", "0", "-i", liste]
    if pov_png:
        entrees += ["-i", pov_png]
    if largeur:
        fc = "[0:v]%s[v]" % filtre_remplir(largeur, hauteur)
        if pov_png:
            fc += ";[v][1:v]overlay=0:0:format=auto[vp]"
            ech = ["-filter_complex", fc, "-map", "[vp]", "-map", "0:a?"]
        else:
            ech = ["-filter_complex", fc, "-map", "[v]", "-map", "0:a?"]
    elif pov_png:
        ech = ["-filter_complex", "[0:v][1:v]overlay=0:0:format=auto[vp]",
               "-map", "[vp]", "-map", "0:a?"]
    else:
        ech = []
    r = _lancer(["ffmpeg", "-y", "-v", "error"] + entrees + ech +
                       ["-c:v", "libx264", "-preset", ENC_PRESET,
                        "-crf", ENC_CRF_MONTAGE, "-pix_fmt", "yuv420p"]
                       + ENC_AUDIO + [muet],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=3600)
    os.remove(liste)
    if r.returncode != 0:
        raise RuntimeError("collage refuse : " + (r.stderr.strip()[:250] or "?"))

    if not musique:
        # pas de musique fournie : on GARDE le son d'origine des scenes,
        # on ne rend jamais une video muette sans le dire
        os.replace(muet, dest)
        return {"musique": "son d'origine"}
    r = _lancer(["ffmpeg", "-y", "-v", "error", "-i", muet,
                        "-stream_loop", "-1", "-i", musique,
                        "-map", "0:v", "-map", "1:a", "-shortest",
                        "-c:v", "copy"] + ENC_AUDIO + [
                        "-movflags", "+faststart", dest],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=1800)
    if r.returncode != 0:
        os.replace(muet, dest)
        return {"musique": None, "erreur_musique": r.stderr.strip()[:200]}
    os.remove(muet)
    return {"musique": os.path.basename(musique)}


def empreinte_a(video, t):
    """Empreinte d'UNE image de la video, prise a l'instant t.
    On evite ainsi de redecoder toute la scene juste pour la reconnaitre."""
    rep = _temp(prefix="manita_emp_")
    f = os.path.join(rep, "i.png")
    _lancer(["ffmpeg", "-y", "-v", "error", "-i", video,
                    "-vf", "select=gte(t\\,%f),scale=%d:-2" % (t, LARGEUR_SONDE),
                    "-frames:v", "1", f],
                   capture_output=True, text=True, stdin=subprocess.DEVNULL,
                   timeout=180)
    if not os.path.isfile(f):
        return None
    return empreinte(f)


def banque_de_scenes(videos, travail):
    """Decoupe TOUTES les videos du mannequin et rend une banque de scenes
    SANS doublon : deux prises qui se ressemblent ne comptent que pour une,
    sinon deux variantes se retrouveraient avec la meme image."""
    banque = []
    # LA PHASE LA PLUS LONGUE DOIT PARLER. Elle ne disait rien : on ne savait
    # pas si elle avancait ou si elle etait morte (soiree du 17/09/2026).
    # Et un echec ne disparait plus en silence : il s'affiche.
    for n_v, v in enumerate(videos, 1):
        print("      video %d sur %d : %s — je cherche les scenes ..."
              % (n_v, len(videos), os.path.basename(v)[:40]), flush=True)
        t0 = time.time()
        try:
            decoupe = scenes(v)
        except Exception as e:
            print("      ATTENTION : %s n'a pas pu etre decoupee — %s"
                  % (os.path.basename(v)[:40], str(e)[:160]), flush=True)
            continue
        print("      %d scene(s) reperee(s) en %.0f s"
              % (len(decoupe), time.time() - t0), flush=True)
        gardees, ratees = 0, 0
        for k, (a, b) in enumerate(decoupe):
            # la coupe respire, elle ne traine pas : 3 s, sinon 1,6 s
            # (07/10/2026 : avant, n'importe quelle longueur sous 3 s)
            b = a + longueur_scene(a, b)
            nom = "%s_s%02d.mp4" % (os.path.splitext(os.path.basename(v))[0], k + 1)
            chemin = os.path.join(travail, nom)
            try:
                extraire_scene(v, a, b, chemin)
            except Exception as e:
                ratees += 1
                print("      scene %d non extraite — %s" % (k + 1, str(e)[:120]),
                      flush=True)
                continue
            try:
                emp = empreinte_a(v, (a + b) / 2.0)   # une seule image, pas tout
                if emp is None:
                    ratees += 1
                    continue
            except Exception as e:
                ratees += 1
                print("      scene %d sans empreinte — %s" % (k + 1, str(e)[:120]),
                      flush=True)
                continue
            gardees += 1
            if gardees % 5 == 0:
                print("      %d scene(s) extraite(s) ..." % gardees, flush=True)
            jumelle = False
            for x in banque:
                ds, dc = distance(emp, x["empreinte"])
                if ds <= SEUIL_REPETITION and dc <= SEUIL_COULEUR:
                    jumelle = True; break
            if not jumelle:
                banque.append({"fichier": chemin, "empreinte": emp,
                               "duree": round(b - a, 2), "source": v})
    return banque


def fabriquer_variantes(videos, style, dossier_musiques, dest,
                        combien=VARIANTES, par_variante=SCENES_PAR_VARIANTE):
    """Le coeur du montage : des scenes differentes, une musique differente
    et un POV different sur CHACUNE des dix variantes."""
    liste_pov = POV[style]
    musiques = musiques_du_dossier(dossier_musiques)
    os.makedirs(dest, exist_ok=True)
    # les scenes decoupees sont des dechets de travail : elles vont dans un
    # dossier temporaire du systeme, JAMAIS chez le client
    travail = _temp(prefix="manita_scenes_")

    print("   je decoupe les scenes ...")
    banque = banque_de_scenes(videos, travail)
    print("   %d scene(s) differente(s) trouvee(s)" % len(banque))
    if len(banque) < 2:
        raise RuntimeError("pas assez de scenes differentes pour monter "
                           "des variantes (%d trouvee(s))" % len(banque))
    par_variante = min(par_variante, len(banque))
    # LA TAILLE DES VARIANTES (06/10/2026) : celle des rushes quand ils sont
    # deja au format demande, sinon le format REMPLI a leur definition — plus
    # jamais un 1080x1920 impose avec un fond floute autour (`taille_de_sortie`)
    for b in banque:
        b["taille"] = tuple(dimensions(b["fichier"])[:2])
    voix = {}
    for b in banque:                     # une video source = une voix
        voix.setdefault(b["source"], b["taille"])
    l, h = taille_de_sortie(list(voix.values()), format_demande())
    # les scenes d'une autre taille sont REMPLIES une fois, avant le collage
    remplies, gardees = [], []
    for b in banque:
        if b["taille"] != (l, h):
            try:
                b["fichier"] = remplir_scene(b["fichier"], l, h)
            except Exception as e:
                # une scene qu'on ne sait pas remplir est ECARTEE, et on le
                # dit : jamais posee telle quelle (le collage changerait de
                # taille en route)
                print("      scene ecartee (%s) — %s"
                      % (os.path.basename(b["source"])[:40], str(e)[:120]))
                continue
            b["remplie"] = True
            remplies.append("%s %dx%d" % (os.path.basename(b["source"])[:28],
                                          b["taille"][0], b["taille"][1]))
        gardees.append(b)
    banque[:] = gardees
    if len(banque) < 2:
        raise RuntimeError("pas assez de scenes au format %dx%d pour monter "
                           "des variantes (%d)" % (l, h, len(banque)))
    par_variante = min(par_variante, len(banque))
    print("   variantes en %dx%d (%s) : %s" % (
        l, h, FORMAT_SORTIE,
        "%d scene(s) REMPLIE(S), ni flou ni barres — %s"
        % (len(remplies), ", ".join(sorted(set(remplies))[:4]))
        if remplies else "la definition des rushes, rien n'est retouche"))

    faits = []
    vus = set()
    for i in range(combien):
        # rotation : chaque variante part d'un autre endroit de la banque,
        # donc aucune ne repete le meme enchainement
        # on cherche un enchainement JAMAIS SORTI. Un simple decalage ne
        # suffit pas : avec peu de scenes il retombe sur le meme groupe.
        idx, cle = None, None
        for essai in range(len(banque) * 3):
            pas = 1 + (essai % max(1, len(banque) - 1))
            depart = (i * par_variante + essai) % len(banque)
            cand = []
            for j in range(par_variante):
                x = (depart + j * pas) % len(banque)
                if x not in cand:
                    cand.append(x)
            if len(cand) < par_variante:
                continue
            # on ne garde que ce qu'il faut pour tenir dans la fenetre :
            # une pub trop longue se fait couper par la cliente elle-meme
            garde, total = [], 0.0
            for x in cand:
                if total >= DUREE_CIBLE_MIN:
                    break
                garde.append(x); total += banque[x]["duree"]
            # le minimum de trois scenes ne doit pas depasser ce qu'on a
            # demande : sinon un montage a deux scenes est IMPOSSIBLE et
            # l'outil repond « plus assez de scenes » sans raison.
            # LOI DES DIX SECONDES (08/10/2026) : trop peu de film, on AJOUTE
            # des scenes de la banque (jamais une scene deux fois) jusqu'a
            # depasser 10 s ; s'il n'y en a plus, la variante sera trop_courte
            if total < DUREE_LIVREE_VISEE - 1e-6:
                for k_ in range(len(banque)):
                    x = (depart + k_) % len(banque)
                    if x in garde:
                        continue
                    garde.append(x); total += banque[x]["duree"]
                    if total >= DUREE_LIVREE_VISEE - 1e-6:
                        break
            if len(garde) < min(3, par_variante):
                continue
            if tuple(sorted(garde)) not in vus:
                idx, cle = garde, tuple(sorted(garde)); break
        if idx is None:
            print("   [ATTENTION] plus assez de scenes pour un %de enchainement"
                  " different — il en faudrait davantage" % (i + 1))
            break
        vus.add(cle)
        morceaux = [banque[x]["fichier"] for x in idx]
        musique = musiques[i % len(musiques)] if musiques else None
        angle, texte = liste_pov[i % len(liste_pov)]

        final = os.path.join(dest, "variante_%02d.mp4" % (i + 1))
        # LE POV EST BRULE PENDANT L'ASSEMBLAGE (17/09/2026). Avant, il
        # fallait une troisieme passe d'encodage rien que pour poser le
        # texte : la source est a 16,8 Mbit/s et les variantes sortaient a
        # 6,7. Une generation en moins, c'est de la finesse gardee.
        rep_png = _temp(prefix="manita_pov_")
        png = os.path.join(rep_png, "texte_v%02d.png" % (i + 1))
        try:
            info = image_pov(texte, l, h, png)
            info_a = assembler(morceaux, musique, final, l, h, pov_png=png)
        except Exception as e:
            print("   [ECHEC] variante %02d : %s" % (i + 1, e)); continue
        info["png"] = png
        info["son_reencode"] = False
        info["controles"] = controler_brulage_direct(final, png, morceaux[0])
        info["conforme"] = all(c["ok"] for c in info["controles"])
        info.update(info_a)
        info["angle"] = angle
        info["scenes"] = idx
        info["fichier"] = final
        info["definition"] = "%dx%d" % (l, h)
        info["scenes_remplies"] = sum(1 for x in idx if banque[x].get("remplie"))
        info["flou"] = False
        info["longueurs"] = [banque[x]["duree"] for x in idx]
        # LOI DES DIX SECONDES (08/10/2026), relue sur le fichier ecrit
        try:
            d_fin = duree(final)
        except Exception:
            d_fin = 0.0
        info["duree"] = round(d_fin, 2)
        info["trop_courte"] = d_fin <= DUREE_MINI_LIVREE + 1e-6
        # 07/10/2026 : ce montage n'applique PAS le rythme du vendeur (un bloc
        # de 1,6 s par couleur, puis 3 s) : c'est dit, jamais « conforme » en
        # silence. Le bureau doit lui preferer MONTER-10.
        info["moteur"] = "manita.py"
        info["rythme_du_vendeur"] = False
        info["a_regarder"] = [RYTHME_VENDEUR]
        if info["trop_courte"]:
            info["conforme"] = False
            info["a_revoir"] = ["trop_courte : %.2f s, une video livree depasse %.0f s"
                                % (d_fin, DUREE_MINI_LIVREE)]
            print("   [ECHEC] variante %02d : trop_courte (%.2f s, il faut plus de %.0f s)"
                  % (i + 1, d_fin, DUREE_MINI_LIVREE))
        info["verdict"] = "A REGARDER" if info["conforme"] else "A REVOIR"
        faits.append(info)
        print("   [%s] variante_%02d  %d scenes  %-9s  musique %s"
              % ("A REGARDER" if info["conforme"] else "ECHEC", i + 1, len(idx), angle,
                 info.get("musique") or "aucune"))
    if faits:
        print("   [A REGARDER] %s" % RYTHME_VENDEUR)
    return faits, banque


def ecrire_rapport_montage(sortie, faits):
    """Le _rapport.json de la sortie, une LISTE comme celui de MONTER-10 (le
    bureau la lit par le nom du fichier) : chaque variante porte « A REGARDER :
    rythme du vendeur non applique » (07/10/2026)."""
    f = os.path.join(sortie, "_rapport.json")
    lignes = []
    try:
        anc = json.load(open(f, encoding="utf-8"))
        lignes = [x for x in anc if isinstance(x, dict) and x.get("moteur") == "manita.py"
                  and os.path.isfile(x.get("fichier") or "")
                  and x.get("fichier") not in {y.get("fichier") for y in faits}]
    except Exception:
        lignes = []
    for x in faits:
        lignes.append({"fichier": x.get("fichier"), "moteur": "manita.py",
                       "angle": x.get("angle"), "musique": x.get("musique"),
                       "longueurs": x.get("longueurs"), "definition": x.get("definition"),
                       "rythme_du_vendeur": False, "a_regarder": x.get("a_regarder"),
                       "duree": x.get("duree"), "trop_courte": bool(x.get("trop_courte")),
                       "conforme": False, "verdict": x.get("verdict")})
    try:
        os.makedirs(sortie, exist_ok=True)
        with open(f + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(lignes, fh, indent=1, ensure_ascii=False)
    except OSError:
        return
    # Windows : un antivirus ou un lecteur tient le fichier un instant (le
    # meme repli que MONTER-10) ; jamais un .tmp laisse dans la livraison
    for _essai in range(6):
        try:
            os.replace(f + ".tmp", f)
            return
        except OSError:
            time.sleep(0.3)
    try:
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(lignes, fh, indent=1, ensure_ascii=False)
    except OSError:
        pass
    try:
        os.remove(f + ".tmp")
    except OSError:
        pass


def controler_variantes(faits):
    """Les trois lois du lot, verifiees sur les fichiers ECRITS :
    des scenes differentes, des musiques differentes, des POV differents."""
    ctrl = []

    def c(nom, ok, detail):
        ctrl.append({"controle": nom, "ok": bool(ok), "detail": detail})

    n = len(faits)
    muettes = [os.path.basename(f["fichier"]) for f in faits
               if not a_du_son(f["fichier"])]
    c("toutes les variantes ont du son", not muettes,
      "%d muette(s)%s" % (len(muettes),
                          "" if not muettes else " : " + ", ".join(muettes[:3])))
    sons = [empreinte_audio(f["fichier"]) for f in faits]
    avec_musique = any(f.get("musique") and f["musique"] != "son d'origine"
                       for f in faits)
    mot = "musiques" if avec_musique else "pistes son (aucune musique fournie)"
    c("%s differentes" % mot, len(set(x for x in sons if x)) == n,
      "%d pour %d variante(s)" % (len(set(x for x in sons if x)), n))
    lots = [tuple(sorted(f["scenes"])) for f in faits]
    c("enchainements differents", len(set(lots)) == n,
      "%d enchainement(s) pour %d variante(s)" % (len(set(lots)), n))
    angles = [f["angle"] for f in faits]
    c("angles couverts", len(set(angles)) == min(n, len(ANGLES)),
      "%d angle(s) sur %d" % (len(set(angles)), len(ANGLES)))
    courtes = [os.path.basename(f["fichier"]) for f in faits if f.get("trop_courte")]
    c("chaque video depasse %.0f s" % DUREE_MINI_LIVREE, not courtes,
      "%d trop courte(s)%s" % (len(courtes), "" if not courtes else " : " + ", ".join(courtes[:3])))
    manques = [f["fichier"] for f in faits if not f["conforme"]]
    c("aucune scene repetee dans une variante", not manques,
      "%d variante(s) a revoir" % len(manques))
    return ctrl


# =================================================================
#  PARTIE 7 — IL SE TESTE TOUT SEUL
# =================================================================

FLOU_ANCIEN = 20   # le rayon du fond floute d'avant le 06/10/2026 : il ne sert
                   # plus qu'a la preuve, pour montrer que l'instrument le VOIT


def _rush_damier(dest, l, h, couleur, duree=3.2):
    """Un rush d'essai sur un DAMIER net (cases de 6 px : un flou l'efface
    tout de suite), un « vetement » de couleur qui bouge un peu au milieu,
    et du son. Rend True s'il est ecrit."""
    import numpy as np
    from PIL import Image
    y, x = np.mgrid[0:h, 0:l]
    a = np.where(((x // 6) + (y // 6)) % 2 == 0, 70, 190).astype(np.uint8)
    fond = dest + ".png"
    Image.fromarray(np.stack([a, a, a], axis=2)).save(fond)
    r = _lancer(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", "12",
                 "-i", fond, "-f", "lavfi", "-i", "color=c=%s:s=%dx%d:d=%s:r=12"
                 % (couleur, l * 3 // 10, h * 4 // 10, duree),
                 "-f", "lavfi", "-i", "sine=frequency=300:duration=%s" % duree,
                 "-filter_complex", "[0][1]overlay=x='W*0.35+W*0.03*sin(2*t)':"
                 "y=H*0.35,format=yuv420p[v]", "-map", "[v]", "-map", "2:a",
                 "-t", str(duree), "-c:v", "libx264", "-crf", "12", "-c:a", "aac",
                 dest], capture_output=True, text=True, timeout=600)
    os.remove(fond)
    return r.returncode == 0 and os.path.isfile(dest)


def preuve_sans_flou():
    """06/10/2026 — LA PREUVE QU'IL N'Y A PLUS DE FLOU (regle du vendeur).
    Des rushes fabriques ici, montes par le VRAI chemin (`fabriquer_variantes`,
    celui de --projet que le bureau appelle), puis la variante est RELUE :
      - sa taille : le 9:16 a la definition des rushes, jamais gonfle ;
      - son image = le rush REMPLI (recadre au centre, ou agrandi s'il est
        plus petit) : comparaison au RUSH, pas a nous-memes ;
      - la nettete du fond, la ou l'ancien montage posait son flou (bandes
        du bas), est celle du rush — et l'instrument VOIT un flou : la meme
        scene montee a l'ancienne est refusee ;
      - aucun bord noir (pas de barres) ;
      - la plaque POV : au meme endroit (en proportion) qu'en 1080x1920, et
        lisible (les controles de l'image de texte passent).
    Rend [(nom, ok, detail)]."""
    import numpy as np
    from PIL import Image
    ctrl = []

    def c(nom, ok, detail=""):
        ctrl.append((nom, bool(ok), detail))
        print("  [%s] %-26s %s" % ("OK" if ok else "ECHEC", nom, detail))

    # ---- 1. la regle, a plat
    cas = [(([(720, 1280)] * 2 + [(1080, 1920)], FORMAT_COD), (720, 1280)),
           (([(1080, 1920)], FORMAT_COD), (1080, 1920)),
           (([(1920, 1080)], FORMAT_COD), (608, 1080)),
           (([(640, 640)] * 2 + [(270, 480)], FORMAT_COD), (360, 640)),
           (([(1080, 1920)], FORMAT_CARRE), (1080, 1350)),
           (([(721, 1281)], None), (720, 1280)),
           # a egalite de voix, le rush DEJA au format passe devant (avant :
           # l'ordre des fichiers, et un paysage en tete donnait 608x1080)
           (([(1920, 1080), (1080, 1920)], FORMAT_COD), (1080, 1920)),
           (([(1080, 1920), (1920, 1080)], FORMAT_COD), (1080, 1920))]
    faux = [(t[0][:1], v, taille_de_sortie(*t)) for t, v in cas
            if taille_de_sortie(*t) != v]
    c("taille de sortie", not faux, "%d cas : la definition gardee, le format "
      "rempli%s" % (len(cas), (" ; FAUX %s" % faux[:2]) if faux else ""))
    fr = filtre_remplir(360, 640)
    c("ni flou ni barres", "blur" not in fr and "pad" not in fr
      and "force_original_aspect_ratio=increase" in fr, fr)

    def bande_bas(a):
        # la bande du bas : sur un rush carre pose a l'ancienne, c'etait le
        # fond FLOUTE ; ici, le damier du rush
        h = a.shape[0]
        return a[int(h * 0.80):int(h * 0.98)].mean(axis=2)

    texte = POV["hijab"][0][1]
    with tempfile.TemporaryDirectory() as tmp:
        # ---- 2. deux montages par le vrai chemin
        #   A : trois rushes CARRES (la majorite) et un 9:16 plus petit
        #       (un 3e carre depuis la loi des dix secondes du 08/10/2026 : une
        #       scene est gardee a 3 s, trois rushes ne faisaient que 9 s)
        #   B : deux rushes 9:16 (la majorite), un carre, et un rush PLUS
        #       HAUT que le 9:16 (300x640) : son HAUT doit rester en haut
        essais = {"A": [("carre_a.mp4", 640, 640, "0xc02020"),
                        ("carre_b.mp4", 640, 640, "0x2040c0"),
                        ("petit_c.mp4", 270, 480, "0x20a040"),
                        ("carre_d.mp4", 640, 640, "0xc0a020")],
                  "B": [("haut_a.mp4", 360, 640, "0xc02020"),
                        ("haut_b.mp4", 360, 640, "0x2040c0"),
                        ("carre_c.mp4", 640, 640, "0x20a040"),
                        ("etroit_d.mp4", 300, 640, "0xc0a020")]}
        for nom_essai, specs in sorted(essais.items()):
            rushes = []
            for nom, l, h, coul in specs:
                f = os.path.join(tmp, nom_essai + "_" + nom)
                if _rush_damier(f, l, h, coul):
                    rushes.append(f)
            if len(rushes) != len(specs):
                c("essai %s : rushes fabriques" % nom_essai, False, "ffmpeg")
                continue
            sortie = os.path.join(tmp, "creas_" + nom_essai)
            try:
                faits, banque = fabriquer_variantes(rushes, "hijab", None, sortie,
                                                    combien=1)
            except Exception as e:
                c("essai %s : montage" % nom_essai, False, str(e)[:160])
                continue
            if not faits:
                c("essai %s : montage" % nom_essai, False, "aucune variante")
                continue
            f = faits[0]
            final = f["fichier"]
            l, h, _d = dimensions(final)
            c("essai %s : 360x640" % nom_essai, (l, h) == (360, 640)
              and f.get("definition") == "360x640",
              "%dx%d (avant : 1080x1920 et un fond floute)" % (l, h))
            # chaque scene relue contre SON rush rempli, a la meme seconde
            t0, t_carre, carre = 0.0, None, None
            for x in f["scenes"]:
                b = banque[x]
                src = b["source"]
                ls, hs, _ = dimensions(src)
                tv = t0 + 1.0
                if carre is None and ls == hs:
                    t_carre, carre = tv, src
                a_v = _image_a(final, tv, l, h)
                # le rush REMPLI, calcule ici (PIL), pas par l'outil
                p = os.path.join(tmp, "src.png")
                _lancer(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf",
                         "select=gte(t\\,1.0)", "-frames:v", "1", p],
                        capture_output=True, text=True)
                if a_v is None or not os.path.isfile(p):
                    c("essai %s : %s relu" % (nom_essai, os.path.basename(src)),
                      False, "image illisible")
                    t0 += b["duree"]; continue
                im = Image.open(p).convert("RGB")
                k = max(l / float(ls), h / float(hs))
                im = im.resize((int(round(ls * k)), int(round(hs * k))), Image.BICUBIC)
                # centre en largeur, le HAUT garde en hauteur (`filtre_remplir`)
                x0, y0 = (im.width - l) // 2, 0
                ref = np.asarray(im.crop((x0, y0, x0 + l, y0 + h)), dtype=np.int16)
                yc = (im.height - h) // 2
                centre = np.asarray(im.crop((x0, yc, x0 + l, yc + h)), dtype=np.int16)
                os.remove(p)
                bas = slice(int(h * 0.30), h)          # sous la plaque POV
                ecart = float(np.abs(a_v[bas] - ref[bas]).mean())
                if yc > 0:
                    # un rush plus haut que le format : la variante est son
                    # HAUT, pas son centre (la plaque reste au-dessus de la
                    # tete, comme sur le rush natif)
                    ec_c = float(np.abs(a_v[bas] - centre[bas]).mean())
                    c("essai %s : le haut est garde" % nom_essai,
                      ecart <= 12 and ec_c > ecart + 10,
                      "%dx%d : ecart %.1f au haut du rush, %.1f a son centre"
                      % (ls, hs, ecart, ec_c))
                n_v, n_r = nettete(bande_bas(a_v)), nettete(bande_bas(ref))
                bords = [a_v[:, :3].mean(), a_v[:, -3:].mean(), a_v[-3:, :].mean()]
                quoi = "%s %dx%d%s" % (os.path.splitext(os.path.basename(src))[0]
                                       .split("_", 1)[1], ls, hs,
                                       " rempli" if b.get("remplie") else "")
                c("essai %s : %s = le rush" % (nom_essai, quoi), ecart <= 12,
                  "ecart moyen %.1f / 255 au rush rempli" % ecart)
                c("essai %s : fond net" % nom_essai, n_v >= 0.5 * n_r,
                  "nettete du bas %.0f, rush %.0f (%s)" % (n_v, n_r, quoi))
                c("essai %s : aucune barre" % nom_essai, min(bords) > 40,
                  "bords %s" % "/".join("%.0f" % v for v in bords))
                t0 += b["duree"]
            # l'instrument VOIT le flou : la meme scene montee a l'ancienne
            if carre is None:
                c("essai %s : le flou se voit" % nom_essai, False, "aucun rush carre monte")
                continue
            vieux = os.path.join(tmp, "ancien_%s.mp4" % nom_essai)
            _lancer(["ffmpeg", "-y", "-v", "error", "-i", carre,
                     "-filter_complex",
                     "[0:v]split[bg][fg];[bg]scale=%d:%d:force_original_aspect_ratio="
                     "increase,crop=%d:%d,boxblur=luma_radius=%d:luma_power=2[b];"
                     "[fg]scale=%d:%d:force_original_aspect_ratio=decrease[f];"
                     "[b][f]overlay=(W-w)/2:(H-h)/2,setsar=1[v]"
                     % (l, h, l, h, FLOU_ANCIEN, l, h), "-map", "[v]", "-an",
                     "-c:v", "libx264", "-crf", "12", vieux],
                    capture_output=True, text=True, timeout=600)
            a_old = _image_a(vieux, 1.0, l, h) if os.path.isfile(vieux) else None
            a_new = _image_a(final, t_carre, l, h)
            if a_old is None or a_new is None:
                c("essai %s : le flou se voit" % nom_essai, False, "image illisible")
            else:
                n_old, n_new = nettete(bande_bas(a_old)), nettete(bande_bas(a_new))
                c("essai %s : le flou se voit" % nom_essai, n_old < 0.2 * n_new,
                  "ancien montage (fond floute) %.0f contre %.0f : refuse"
                  % (n_old, n_new))
            # la plaque POV : au meme endroit, en proportion, qu'en 1080x1920
            if f.get("plaque"):
                ref_png = os.path.join(tmp, "pov_1080.png")
                grand = image_pov(texte, 1080, 1920, ref_png)
                bx = [v / float(d) for v, d in zip(f["plaque"]["boite"], (l, h, l, h))]
                bg = [v / float(d) for v, d in zip(grand["plaque"]["boite"],
                                                   (1080, 1920, 1080, 1920))]
                dmax = max(abs(p - q) for p, q in zip(bx, bg))
                c("essai %s : plaque POV en place" % nom_essai,
                  dmax <= 0.02 and bx[3] <= 0.30,
                  "boite %s contre %s en 1080x1920 (ecart %.3f), haut de l'image"
                  % ("/".join("%.2f" % v for v in bx), "/".join("%.2f" % v for v in bg),
                     dmax))
                lisible = [x for x in f["controles"] if x["controle"].startswith(
                    ("methode 2", "la plaque", "texte"))]
                c("essai %s : POV lisible" % nom_essai,
                  lisible and all(x["ok"] for x in lisible)
                  and abs(f["taille"] / float(l) - grand["taille"] / 1080.0) <= 0.01,
                  "%d controles de l'image de texte, lettres a %.3f de la largeur "
                  "(1080x1920 : %.3f)" % (len(lisible), f["taille"] / float(l),
                                          grand["taille"] / 1080.0))
            else:
                c("essai %s : plaque POV en place" % nom_essai, False, "pas de plaque")
            c("essai %s : variante conforme" % nom_essai, f.get("conforme"),
              ", ".join(x["controle"] for x in f["controles"] if not x["ok"])[:120])
            c("essai %s : la video depasse %.0f s" % (nom_essai, DUREE_MINI_LIVREE),
              not f.get("trop_courte") and f.get("duree", 0) > DUREE_MINI_LIVREE, "%.2f s" % f.get("duree", 0))
        # ---- 3. LA LOI DES DIX SECONDES (08/10/2026) : deux rushes de 3,2 s
        #   ne font que 6,4 s de film — la variante sort, MARQUEE trop_courte
        #   (A REVOIR, jamais conforme), et le controle du lot le dit
        rc = []
        for k, coul in enumerate(("0xc02020", "0x2040c0")):
            f = os.path.join(tmp, "C_court_%d.mp4" % k)
            if _rush_damier(f, 360, 640, coul):
                rc.append(f)
        try:
            fc, _b = fabriquer_variantes(rc, "hijab", None, os.path.join(tmp, "creas_C"), combien=1) \
                if len(rc) == 2 else ([], [])
        except Exception as e:
            fc = []
            c("essai C : montage", False, str(e)[:160])
        x = fc[0] if fc else {}
        lois = {y["controle"]: y["ok"] for y in controler_variantes(fc)} if fc else {}
        c("essai C : 6,4 s de film -> trop_courte, A REVOIR, jamais conforme",
          bool(x) and x.get("trop_courte") is True and x.get("conforme") is False
          and x.get("verdict") == "A REVOIR" and lois.get("chaque video depasse %.0f s" % DUREE_MINI_LIVREE) is False,
          "%s s, %s, %s" % (x.get("duree"), x.get("verdict"), lois))
    return ctrl


def preuve_coupes():
    """07/10/2026 — LA PREUVE QU'AUCUN FLASH NE PASSE. Un rush deja monte,
    fabrique ici : un plan de 2,5 s, TROIS images (0,1 s) d'un autre plan,
    un plan de 3,5 s, puis un dernier plan de 2 s (le meme vetement).
    Avant : une sonde toutes les 0,2 s, la coupe posee apres la vraie, les
    miettes recollees — le flash restait dans une scene. Maintenant les
    scenes sont relues A L'IMAGE : aucune ne traverse une coupe, aucune ne
    dure moins d'une seconde, et chaque scene gardee dure 3 s ou 1,6 s
    (le flash n'est dans aucune). Rend [(nom, ok, detail)]."""
    import numpy as np
    from PIL import Image
    ctrl = []

    def c(nom, ok, detail=""):
        ctrl.append((nom, bool(ok), detail))
        print("  [%s] %-26s %s" % ("OK" if ok else "ECHEC", nom, detail))

    with tempfile.TemporaryDirectory() as tmp:
        d = os.path.join(tmp, "im"); os.makedirs(d)
        n = 0
        # ... puis (07/10/2026, casse) une PRISE CONTINUE de 20 s, sans coupe : elle
        # doit donner plusieurs plans (avant la casse : un seul, la mission tombait)
        plans = [((120, 60, 50), 75), ((40, 160, 70), 3), ((110, 50, 140), 105),
                 ((112, 52, 142), 60), ((150, 120, 40), 600)]
        for k, (coul, nb) in enumerate(plans):
            rng = np.random.default_rng(k)
            fond = rng.integers(60, 200, (8, 6, 3)).astype(np.uint8)
            fond = np.asarray(Image.fromarray(fond).resize((180, 320), Image.NEAREST))
            for j in range(nb):
                a = fond.copy()
                x = 60 + int(10 * math.sin(j / 6.0))
                a[110:260, x:x + 60] = coul
                Image.fromarray(a).save(os.path.join(d, "%05d.png" % n)); n += 1
        rush = os.path.join(tmp, "monte.mp4")
        r = _lancer(["ffmpeg", "-y", "-v", "error", "-framerate", "30", "-i",
                     os.path.join(d, "%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                     rush], capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            c("coupes sans flash", False, "rush d'essai non fabrique")
            return ctrl
        vraies = [2.5, 2.6, 6.1, 8.1]
        cf = coupes_fines(rush) or []
        c("coupes a l'image pres", len(cf) >= 3 and all(any(abs(x - v) <= 0.04 for x in cf)
                                                         for v in vraies),
          "trouvees %s, vraies %s" % (cf, vraies))
        sc = scenes(rush)
        dedans = [(a, b) for a, b in sc for v in vraies if a - 0.01 < v < b + 0.01]
        courtes = [(a, b) for a, b in sc if b - a < SCENE_MINI]
        c("aucune scene a cheval, aucun flash", sc and not dedans and not courtes,
          "%s" % sc)
        gardees = [longueur_scene(a, b) for a, b in sc]
        c("scenes gardees a 3 s ou 1,6 s", gardees and all(x in (SCENE_MAX, BLOC_MULTI)
                                                         or x >= SCENE_MINI for x in gardees)
          and min(gardees) >= SCENE_MINI, "%s" % gardees)
        # la prise continue de 20 s (8,1 - 28,1 s) : plusieurs plans de 3 s, chacun a
        # 3 s de film au moins du suivant (la coupe se voit)
        longue = [(a, b) for a, b in sc if a >= 8.1]
        debuts = [a for a, _b in longue]
        c("prise continue : plusieurs plans", len(longue) >= 3
          and all(longueur_scene(a, b) == SCENE_MAX for a, b in longue)
          and all(y - x >= SCENE_MAX * 2 - 0.01 for x, y in zip(debuts, debuts[1:])),
          "%s" % longue)
    return ctrl


def preuve_collage():
    """06/10/2026 — DES SCENES DE TELEPHONE ET DE CAMERA COLLEES (relecture
    sur un vrai lot : telephones en 30 images/s et son HE-AAC 44,1 kHz,
    camera en 25 images/s et son AAC 48 kHz). Deux sources fabriquees ici
    avec ces differences (30 i/s + AAC 44,1 kHz mono, 25 i/s + AAC 48 kHz
    stereo), coupees par `extraire_scene`, collees par `assembler`, dans les
    DEUX ordres. Avant : un ordre durait 5,5 s au lieu de 5, l'autre 6 s avec
    un son de 4,6 s (sur les vrais rushes : collage refuse, ou la moitie de la
    video sans son, et le telephone rejoue au ralenti apres un gel de 0,5 s).
    Rend [(nom, ok, detail)]."""
    ctrl = []

    def c(nom, ok, detail=""):
        ctrl.append((nom, bool(ok), detail))
        print("  [%s] %-26s %s" % ("OK" if ok else "ECHEC", nom, detail))

    with tempfile.TemporaryDirectory() as tmp:
        srcs = []
        for nom, ar, ac, coul, ips in (("telephone", 44100, 1, "0x803030", 30),
                                       ("camera", 48000, 2, "0x305080", 25)):
            f = os.path.join(tmp, nom + ".mp4")
            r = _lancer(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                         "color=c=%s:s=360x640:d=3:r=%d" % (coul, ips), "-f", "lavfi",
                         "-i", "sine=frequency=440:duration=3:sample_rate=%d" % ar,
                         "-ac", str(ac), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                         "-c:a", "aac", "-shortest", f],
                        capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=600)
            if r.returncode != 0 or not os.path.isfile(f):
                c("collage telephone/camera", False, "sources non fabriquees")
                return ctrl
            srcs.append((nom, f))
        for ordre in ((0, 1), (1, 0)):
            quoi = "collage %s puis %s" % (srcs[ordre[0]][0][:3], srcs[ordre[1]][0][:3])
            ms = []
            try:
                for k in ordre:
                    d = os.path.join(tmp, "s%d_%d.mp4" % (ordre[0], k))
                    extraire_scene(srcs[k][1], 0.2, 2.7, d)
                    ms.append(d)
                dest = os.path.join(tmp, "v%d.mp4" % ordre[0])
                assembler(ms, None, dest, 360, 640)
            except Exception as e:
                c(quoi, False, str(e)[:140])
                continue
            d_img, d_son = dimensions(dest)[2], duree_audio(dest)
            r = _lancer(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
                         "packet=pts_time", "-of", "csv=p=0", dest],
                        capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=120)
            pts = sorted(float(x) for x in (r.stdout or "").split() if x.strip())
            trou = max([pts[k + 1] - pts[k] for k in range(len(pts) - 1)] or [9.9])
            c(quoi, abs(d_img - 5.0) <= 0.1 and abs(d_son - 5.0) <= 0.1 and trou <= 0.1,
              "image %.2f s, son %.2f s (attendu 5,0), plus long gel %.2f s"
              % (d_img, d_son, trou))
    return ctrl


def verifier():
    """Fabrique une video dont il CONNAIT la reponse, l'analyse, et compare.
    C'est la preuve que l'installation marche, montrable a l'ecran."""
    import numpy as np
    from PIL import Image

    print("AUTO-TEST")
    print("  je fabrique une video dont je connais deja la reponse ...")
    plan = [("noir", 1.6), ("beige", 1.6), ("blanc", 1.6), ("rouge", 1.6)]
    coul = {"noir": (24, 22, 20), "beige": (214, 190, 152),
            "blanc": (240, 238, 232), "rouge": (168, 42, 32)}
    mur = (138, 128, 115)
    W, H, FPS = 240, 426, 12

    with tempfile.TemporaryDirectory() as tmp:
        d = os.path.join(tmp, "f"); os.makedirs(d)
        n = 0
        for c, duree in plan:
            for _ in range(int(round(duree * FPS))):
                a = np.zeros((H, W, 3), np.uint8); a[:, :] = mur
                a[int(H*0.35):int(H*0.85), int(W*0.30):int(W*0.70)] = coul[c]
                rng = np.random.default_rng(n)
                a = np.clip(a.astype(np.int16) + rng.integers(-8, 9, a.shape),
                            0, 255).astype(np.uint8)
                Image.fromarray(a).save(os.path.join(d, "%05d.png" % n)); n += 1
        mp4 = os.path.join(tmp, "test.mp4")
        r = _lancer(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                            "-i", os.path.join(d, "%05d.png"), "-c:v", "libx264",
                            "-pix_fmt", "yuv420p", "-crf", "20", mp4],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL)
        if r.returncode != 0:
            print("  ECHEC : ffmpeg n'a pas pu fabriquer la video de test")
            print("  " + (r.stderr.strip()[:200] or "sans message"))
            return 1

        print("  je l'analyse ...")
        f = analyser(mp4)

    attendu = [c for c, _ in plan]
    lu = [s["couleur"] for s in f["segments"]]
    controles = [
        ("les 4 couleurs sont lues", sorted(set(lu)) == sorted(set(attendu)),
         "%s" % ", ".join(lu)),
        ("dans le bon ordre", lu == attendu, "%s" % " > ".join(lu)),
        ("mode multi detecte", f["mode"] == "multi", f["mode"]),
        ("bloc de 1.6 s", abs(f["bloc"] - 1.6) < 0.01, "%.1f s" % f["bloc"]),
        ("controles internes", f["conforme"], ""),
    ]
    print("")
    for nom, ok, detail in controles:
        print("  [%s] %-26s %s" % ("OK" if ok else "ECHEC", nom, detail))

    # ---------- musique ou voix : on ne colle jamais un cours sur une pub
    print("")
    print("  je verifie que je sais distinguer une musique d'une voix ...")
    with tempfile.TemporaryDirectory() as tmp:
        regulier = os.path.join(tmp, "regulier.wav")
        hache = os.path.join(tmp, "hache.wav")
        _lancer(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                        "sine=frequency=440:duration=12", regulier],
                       capture_output=True, stdin=subprocess.DEVNULL, timeout=120)
        # un son qui BAISSE et remonte, comme quelqu'un qui parle. Il ne
        # tombe pas a zero : un silence numerique parfait donnerait une
        # variation enorme et le test passerait sans rien prouver.
        # Regle a 0,92 de variation, soit exactement une vraie voix.
        _lancer(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                        "aevalsrc=sin(2*PI*300*t)*"
                        r"(0.35+0.65*lt(mod(t\,1)\,0.45)):d=12", hache],
                       capture_output=True, stdin=subprocess.DEVNULL, timeout=120)
        ok1, d1 = est_musique(regulier) if os.path.isfile(regulier) else (False, "absent")
        ok2, d2 = est_musique(hache) if os.path.isfile(hache) else (True, "absent")
        bon = ok1 and not ok2
        print("  [%s] %-26s son regulier : %s | son hache : %s"
              % ("OK" if bon else "ECHEC", "musique contre voix",
                 "musique" if ok1 else "refuse", "musique" if ok2 else "refuse"))
        controles.append(("musique contre voix", bon, ""))

    # ---------- le choix des photos : une photo FLOUE doit etre ecartee
    print("")
    print("  je verifie le choix des photos ...")
    with tempfile.TemporaryDirectory() as tmp:
        from PIL import ImageFilter
        chemins = []
        # nette_a et sa JUMELLE sont la meme prise : l'outil doit en garder
        # UNE seule, sinon on livre cinq fois la meme photo.
        # nette_b est un peu MOLLE (au-dessus du plancher de flou) : elle doit
        # passer APRES les nettes, sinon la nettete ne pese rien dans la note.
        for nom, coul, flou, graine, lum in (
                ("nette_a", (210, 60, 55), 0, 3, 1.0),
                ("jumelle_a", (210, 60, 55), 0, 4, 1.0),   # la MEME prise
                ("sombre_b", (60, 120, 200), 0, 5, 0.80),  # autre scene, moins bien
                ("floue_a", (210, 60, 55), 4, 6, 1.0)):    # franchement floue
            a = np.zeros((400, 300, 3), np.uint8); a[:, :] = (138, 128, 115)
            a[140:330, 90:210] = coul
            rng = np.random.default_rng(graine)
            a = np.clip((a.astype(np.float64) * lum)
                        + rng.integers(-14, 15, a.shape), 0, 255).astype(np.uint8)
            im = Image.fromarray(a)
            if flou:
                im = im.filter(ImageFilter.GaussianBlur(flou))
            c = os.path.join(tmp, nom + ".jpg"); im.save(c, quality=92)
            chemins.append(c)
        fiches = note_photos(chemins)
        # on en DEMANDE trois : il ne doit en rendre que DEUX, parce que la
        # jumelle et la floue sont ecartees. C'est la preuve du filtre.
        gardees, _ = choisir_photos(fiches, 3)
        ordre = [os.path.basename(f["fichier"]) for f in gardees]
        noms = sorted(ordre)
        ok_choix = (len(ordre) == 2                   # 3 demandees, 2 rendues
                    and "floue_a.jpg" not in ordre      # la floue est dehors
                    and "sombre_b.jpg" in ordre         # l'autre scene est dedans
                    and not ("nette_a.jpg" in ordre and "jumelle_a.jpg" in ordre))
        print("  [%s] %-26s gardees : %s"
              % ("OK" if ok_choix else "ECHEC",
                 "floue et jumelle ecartees", ", ".join(ordre)))
        controles.append(("floue et jumelle ecartees", ok_choix, ""))

    # ---------- le POV : lettres liees, puis vraiment ecrit sur la video
    print("")
    pp = preuve_pov()
    print("  [%s] %-26s %s" % ("OK" if pp["ok"] else "ECHEC",
                               "bibliotheque de POV", pp["detail"]))
    for x in pp["fautes"][:6]:
        print("        %s" % x)
    controles.append(("bibliotheque de POV", pp["ok"], ""))

    print("  je verifie l'ecriture arabe ...")
    pl = preuve_liaison()
    print("  [%s] %-26s %s" % ("OK" if pl["ok"] else "ECHEC",
                               "lettres arabes liees",
                               pl.get("detail") or "%s | %s | %s" % (
                                   pl.get("moteur", ""), pl.get("methode1_largeur", ""),
                                   pl.get("methode2_coupures", ""))))
    controles.append(("lettres arabes liees", pl["ok"], ""))

    if pl["ok"]:
        print("  je brule un POV sur une video et je relis le resultat ...")
        with tempfile.TemporaryDirectory() as tmp:
            clip = os.path.join(tmp, "clip.mp4")
            sortie = os.path.join(tmp, "clip_pov.mp4")
            r = _lancer(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
                                "-i", "color=c=0x556677:s=360x640:d=2:r=12",
                                "-f", "lavfi", "-i",
                                "sine=frequency=330:duration=2",
                                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                                "-c:a", "aac", "-shortest", clip],
                               capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=1800)
            if r.returncode != 0:
                controles.append(("POV brule sur la video", False, "ffmpeg"))
            else:
                try:
                    info = bruler_pov(clip, POV["hijab"][5][1], sortie)
                    for c in info["controles"]:
                        print("  [%s] %-26s %s" % ("OK" if c["ok"] else "ECHEC",
                                                   c["controle"], c["detail"]))
                    controles.append(("POV brule sur la video", info["conforme"], ""))
                except Exception as e:
                    print("  [ECHEC] POV brule sur la video   %s" % e)
                    controles.append(("POV brule sur la video", False, str(e)))

        # ---------- le 9:16 SANS FLOU (06/10/2026, regle du vendeur)
        print("")
        print("  je monte des rushes qui ne sont pas en 9:16 et je cherche le flou ...")
        try:
            controles.extend(preuve_sans_flou())
        except Exception as e:
            print("  [ECHEC] le 9:16 sans flou        %s" % e)
            controles.append(("le 9:16 sans flou", False, str(e)))

    # ---------- des scenes de telephone et de camera collees (06/10/2026)
    print("")
    print("  je colle des scenes de telephone et de camera (cadence et son differents) ...")
    try:
        controles.extend(preuve_collage())
    except Exception as e:
        print("  [ECHEC] collage telephone/camera  %s" % e)
        controles.append(("collage telephone/camera", False, str(e)))

    # ---------- les coupes a l'image pres, aucun flash (07/10/2026)
    print("")
    print("  je decoupe un rush deja monte qui porte un FLASH de 0,1 s ...")
    try:
        controles.extend(preuve_coupes())
    except Exception as e:
        print("  [ECHEC] coupes sans flash          %s" % e)
        controles.append(("coupes sans flash", False, str(e)))

    tout = all(c[1] for c in controles)
    print("")
    print("  %s" % ("TOUT EST BON — l'editeur est pret." if tout
                    else "UN CONTROLE A ECHOUE — ne pas utiliser en l'etat."))
    return 0 if tout else 1


# =================================================================
#  PARTIE 8 — LA COMMANDE
# =================================================================

def traiter_dossier(dossier):
    vids = sorted(f for f in os.listdir(dossier)
                  if f.lower().endswith((".mp4", ".mov", ".m4v", ".avi", ".mkv")))
    if not vids:
        print("aucune video dans %s" % dossier)
        return 1
    lignes, defauts = [], 0
    for v in vids:
        try:
            f = analyser(os.path.join(dossier, v))
        except Exception as e:
            print("%-34s ECHEC : %s" % (v[:34], e)); defauts += 1; continue
        if not f["conforme"]:
            defauts += 1
        lignes.append(f)
        print("%-34s %-5s bloc %.1fs  %-28s %s"
              % (v[:34], f["mode"], f["bloc"],
                 ", ".join(f["couleurs"])[:28],
                 "OK" if f["conforme"] else "A REVOIR"))
    print("")
    print("%d video(s) traitee(s), %d a revoir" % (len(lignes), defauts))
    return 0 if defauts == 0 else 1


def lister_pov():
    for niche, liste in POV.items():
        print("")
        print("== %s ==   (%d POV, %d angles)" % (niche.upper(), len(liste),
                                                  len(set(a for a, _ in liste))))
        for i, (angle, t) in enumerate(liste, 1):
            print(" %2d. %-10s %s" % (i, angle, t))
    print("")
    print("Les 5 angles : %s" % ", ".join(ANGLES))
    print("Ranges en alternance : les 5 premieres = les 5 angles.")
    print("")
    print("Usage :  python3 manita.py --dossier D --pov hijab")
    print("         python3 manita.py video.mp4 --pov hijab --numero 3")
    return 0


def commande_pov(video, choix, numero, variantes, sortie):
    """Brule le POV sur la video. `choix` est soit un nom de sous-niche,
    soit le texte exact a ecrire."""
    if not os.path.isfile(video):
        print("fichier introuvable : %s" % video, file=sys.stderr); return 2

    cle = choix.strip().lower()
    if cle in POV:
        liste = POV[cle]
        textes = ([t for _, t in liste] if variantes
                  else [liste[(numero - 1) % len(liste)][1]])
        etiquette = cle
    else:
        textes = [choix]
        etiquette = "pov"

    base, ext = os.path.splitext(video)
    ext = ext or ".mp4"
    total, bons = 0, 0
    for i, t in enumerate(textes, 1):
        if sortie and len(textes) == 1:
            dest = sortie
        else:
            dest = "%s_%s%d%s" % (base, etiquette, (i if variantes else numero), ext)
        total += 1
        try:
            info = bruler_pov(video, t, dest)
        except Exception as e:
            print("[ECHEC] %s\n        %s" % (os.path.basename(dest), e))
            continue
        etat = "OK" if info["conforme"] else "ECHEC"
        print("[%s] %s" % (etat, os.path.basename(dest)))
        print("     %s" % t)
        print("     texte %d px sur %d ligne(s), contour %d px%s"
              % (info["taille"], len(info["lignes"]), info["contour"],
                 "" if not info["emoji"] else
                 (", emoji pose" if info["emoji_pose"] else
                  ", emoji retire (pas de police couleur ici)")))
        for c in info["controles"]:
            if not c["ok"]:
                print("     [ECHEC] %-28s %s" % (c["controle"], c["detail"]))
        bons += 1 if info["conforme"] else 0
    print("")
    print("POV ecrits : %d / %d" % (bons, total))
    return 0 if bons == total else 1


def commande_pov_dossier(dossier, choix, sortie):
    """Un POV DIFFERENT par video du dossier.
    LA REGLE : dix variantes = dix scenes differentes ET dix musiques
    differentes ET dix accroches differentes. Coller les dix accroches sur
    UNE SEULE video donne dix fois la meme musique — c'est faux."""
    if not os.path.isdir(dossier):
        print("dossier introuvable : %s" % dossier, file=sys.stderr); return 2
    _, bloque = avant_de_commencer(dossier, None, sortie)
    if bloque:
        return 2
    vids = sorted(f for f in os.listdir(dossier)
                  if f.lower().endswith((".mp4", ".mov", ".m4v", ".avi", ".mkv"))
                  and not f.startswith("."))
    if not vids:
        print("aucune video dans %s" % dossier); return 1

    cle = choix.strip().lower()
    if cle not in POV:
        print("sous-niche inconnue : %s (%s)" % (choix, ", ".join(POV)),
              file=sys.stderr); return 2
    liste = POV[cle]
    angles = []
    dest_rep = sortie or os.path.join(dossier, "_pov")
    os.makedirs(dest_rep, exist_ok=True)

    sons_src, sons_out, textes, bons = [], [], [], 0
    reencodes, durees = [], []
    for i, v in enumerate(vids):
        src = os.path.join(dossier, v)
        angle, texte = liste[i % len(liste)]
        angles.append(angle)
        base, ext = os.path.splitext(v)
        dest = os.path.join(dest_rep, "%s_pov%s" % (base, ext or ".mp4"))
        textes.append(texte)
        sons_src.append(empreinte_audio(src))
        try:
            info = bruler_pov(src, texte, dest)
        except Exception as e:
            print("[ECHEC] %-34s %s" % (v[:34], e))
            sons_out.append(""); reencodes.append(False); durees.append((0, 0))
            continue
        sons_out.append(empreinte_audio(dest))
        reencodes.append(bool(info.get("son_reencode")))
        durees.append((duree_audio(src), duree_audio(dest)))
        bons += 1 if info["conforme"] else 0
        print("[%s] %-30s %-10s %s"
              % ("OK" if info["conforme"] else "ECHEC", v[:30], angle, texte))
        for c in info["controles"]:
            if not c["ok"]:
                print("        [ECHEC] %-26s %s" % (c["controle"], c["detail"]))

    # controles du LOT, integres a l'outil : c'est ici que se voit la faute
    # "une seule musique sur toutes les videos".
    print("")
    n = len(vids)
    mus = len(set(x for x in sons_src if x))
    pov_diff = len(set(textes))
    # UN SON REENCODE N'A PLUS LA MEME EMPREINTE, et c'est normal : on le
    # compare alors sur sa DUREE. Comparer des empreintes apres un
    # reencodage ferait crier l'outil sur une chose juste qu'il vient de
    # faire lui-meme.
    garde = True
    for i, (aa, bb) in enumerate(zip(sons_src, sons_out)):
        if not bb:
            continue
        if i < len(reencodes) and reencodes[i]:
            ds, dd = durees[i] if i < len(durees) else (0.0, 0.0)
            if not (ds and dd and abs(ds - dd) <= 0.30):
                garde = False
        elif aa != bb:
            garde = False
    combien_reencodes = sum(1 for x in reencodes if x)
    for nom, ok, detail in [
        ("chaque video garde sa musique", garde,
         "%d son(s) compare(s)%s"
         % (n, "" if not combien_reencodes
            else " — %d reencode(s), compares sur la duree"
            % combien_reencodes)),
        ("les musiques sont differentes", mus == n,
         "%d musique(s) pour %d video(s)" % (mus, n)),
        ("les POV sont differents", pov_diff == n or n > len(liste),
         "%d POV pour %d video(s)" % (pov_diff, n)),
        ("les angles sont couverts",
         len(set(angles)) == min(n, len(ANGLES)),
         "%d angle(s) sur %d" % (len(set(angles)), len(ANGLES))),
    ]:
        print("[%s] %-32s %s" % ("OK" if ok else "ATTENTION", nom, detail))
    if mus != n:
        print("")
        print("  ATTENTION : plusieurs variantes ont la MEME musique.")
        print("  Une variante = une scene differente ET une musique differente.")
    print("")
    print("POV ecrits : %d / %d" % (bons, n))
    dire_ou_sont_les_fichiers(dest_rep)
    return 0 if (bons == n and garde) else 1


def commande_photos(dossier, choix, sortie, combien=PHOTO_PAR_LOT):
    """Choisit les MEILLEURES photos, une serie par couleur, y ecrit un POV
    et les met au poids de la pub. Tout est verifie et affiche."""
    if not os.path.isdir(dossier):
        print("dossier introuvable : %s" % dossier, file=sys.stderr); return 2
    photos = sorted(os.path.join(dossier, f) for f in os.listdir(dossier)
                    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
                    and not f.startswith("."))
    if not photos:
        print("aucune photo dans %s" % dossier); return 1

    liste = POV.get((choix or "").strip().lower()) if choix else None
    if choix and liste is None:
        print("sous-niche inconnue : %s (%s)" % (choix, ", ".join(POV)),
              file=sys.stderr); return 2

    print("je note %d photo(s) ..." % len(photos))
    fiches = note_photos(photos)
    lots = par_couleur(fiches)
    dest_rep = sortie or os.path.join(dossier, "_pub")
    os.makedirs(dest_rep, exist_ok=True)

    total, bons = 0, 0
    toutes_retenues, toutes_refusees = [], []
    for couleur in sorted(lots):
        retenues, refusees = choisir_photos(lots[couleur], combien)
        # une pub statique se teste avec 4 a 5 visuels. Si le filtre des
        # jumelles en a trop enleve, on le desserre par paliers plutot que
        # de livrer un lot trop maigre — et on le DIT.
        ecart, desserre = ECART_PHOTOS, 0
        while (len(retenues) < min(PHOTO_MIN_LOT, len(lots[couleur]))
               and ecart > 4):
            ecart -= 4; desserre += 1
            retenues, refusees = choisir_photos(lots[couleur], combien, ecart)
        k = 0
        toutes_retenues += retenues
        toutes_refusees += [f for f, _ in refusees]
        print("")
        print("== couleur %s : %d photo(s), on garde %d ==%s"
              % (couleur, len(lots[couleur]), len(retenues),
                 "" if not desserre else
                 "  (filtre des jumelles desserre a %d pour atteindre %d)"
                 % (ecart, PHOTO_MIN_LOT)))
        for f in retenues:
            nom = os.path.basename(f["fichier"])
            base = os.path.splitext(nom)[0]
            dest = os.path.join(dest_rep, "%s_pub.jpg" % base)
            total += 1
            if liste is None:
                try:
                    from PIL import Image as _Im
                    p = compresser_photo(_Im.open(f["fichier"]), dest)
                    ok = p["dans_la_cible"]
                    print("[%s] %-30s note %.2f  %.0f Ko"
                          % ("OK" if ok else "ECHEC", nom[:30], f["note"], p["ko"]))
                except Exception as e:
                    print("[ECHEC] %-30s %s" % (nom[:30], e)); continue
                bons += 1 if ok else 0
                continue
            angle, texte = liste[k % len(liste)]; k += 1
            try:
                info = photo_pub(f["fichier"], texte, dest)
            except Exception as e:
                print("[ECHEC] %-30s %s" % (nom[:30], e)); continue
            bons += 1 if info["conforme"] else 0
            print("[%s] %-28s %-9s note %.2f  %.0f Ko"
                  % ("OK" if info["conforme"] else "ECHEC", nom[:28], angle,
                     f["note"], info["ko"]))
            for c in info["controles"]:
                if not c["ok"]:
                    print("        [ECHEC] %-26s %s" % (c["controle"], c["detail"]))
        for f, raison in refusees:
            print("     ecartee : %-26s %s" % (os.path.basename(f["fichier"])[:26], raison))

    # PREUVE que le choix n'est pas au hasard : les retenues sont plus NETTES
    # que les ecartees. On compare les medianes, pas une seule photo.
    print("")
    if toutes_retenues and toutes_refusees:
        def med(xs):
            xs = sorted(xs); n = len(xs)
            return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2.0
        nr = med([f["nettete"] for f in toutes_retenues])
        ne = med([f["nettete"] for f in toutes_refusees])
        print("[%s] %-32s %.0f contre %.0f"
              % ("OK" if nr > ne else "ATTENTION",
                 "les gardees sont plus nettes", nr, ne))
    print("[%s] %-32s %d photo(s)"
          % ("OK" if (total and bons == total) else "ECHEC",
             "photos de pub ecrites", total))
    print("")
    print("%d / %d photo(s) de pub ecrite(s)" % (bons, total))
    dire_ou_sont_les_fichiers(dest_rep)
    return 0 if bons == total and total else 1


def demander_style():
    """LA seule question posee au client. Une fois, au debut, pas a chaque
    fichier."""
    noms = list(POV)
    print("")
    print("Quel style d'accroche (POV) pour ce lot ?")
    for i, n in enumerate(noms, 1):
        print("  %d. %s" % (i, n))
    try:
        rep = input("Ton choix (1 a %d, ou le nom) : " % len(noms)).strip().lower()
    except EOFError:
        return None
    if rep.isdigit() and 1 <= int(rep) <= len(noms):
        return noms[int(rep) - 1]
    return rep if rep in POV else None


def dire_ou_sont_les_fichiers(base):
    """On termine TOUJOURS en disant ou sont les fichiers, en clair, avec le
    chemin complet et le nombre. Un client ne doit jamais avoir a chercher."""
    if not base or not os.path.isdir(base):
        return
    print("")
    print("=" * 62)
    print("OU SONT TES FICHIERS")
    print("=" * 62)
    total_v = total_p = 0
    for dossier, _, fichiers in os.walk(base):
        if os.path.basename(dossier) == "_scenes":
            continue
        vids = [f for f in fichiers if f.lower().endswith(EXT_VIDEO)]
        phts = [f for f in fichiers if f.lower().endswith(EXT_PHOTO)]
        if not (vids or phts):
            continue
        quoi = []
        if vids:
            quoi.append("%d video(s)" % len(vids)); total_v += len(vids)
        if phts:
            quoi.append("%d photo(s)" % len(phts)); total_p += len(phts)
        print("  %-16s %s" % (" + ".join(quoi), os.path.abspath(dossier)))
    print("")
    print("  TOTAL : %d video(s) et %d photo(s)" % (total_v, total_p))
    print("  Ouvre ce dossier :  %s" % os.path.abspath(base))
    print("=" * 62)


def commande_tout(lien, projet, style, sortie, musiques=None):
    """UNE commande, du lien Drive jusqu'aux fichiers prets a poster."""
    racine = os.path.abspath(projet) if projet else None
    if lien:
        racine = racine or os.path.join(os.getcwd(), "manita_travail")
        print("je vais chercher le dossier (aucun compte, aucun mot de passe) ...")
        telecharger_drive(lien, racine)
    if not racine or not os.path.isdir(racine):
        print("donne un lien Drive (--drive) ou un dossier (--projet)",
              file=sys.stderr); return 2

    _, bloque = avant_de_commencer(racine, musiques, sortie)
    if bloque:
        return 2

    print("")
    print("je range ce que j'ai trouve ...")
    groupes = inventaire(racine)
    if not groupes:
        # ON NE DIT PAS « il n'y a rien » SANS AVOIR RECOMPTE. Si des
        # fichiers existent mais ont tous ete ecartes, on le dit, avec le
        # dossier fautif : un message faux coute une soiree.
        brut, ecartes = 0, []
        for d, _s, fs in os.walk(racine):
            n_ici = sum(1 for f in fs
                        if f.lower().endswith(EXT_VIDEO + EXT_PHOTO)
                        and not f.startswith("."))
            if n_ici:
                brut += n_ici
                rel = os.path.relpath(d, racine).replace(os.sep, "/")
                parts = [] if rel in (".", "") else rel.split("/")
                if any(p.startswith(("_", ".")) or p.endswith("_livraison")
                       for p in parts):
                    ecartes.append("%s (%d fichier(s))" % (rel, n_ici))
        if brut and ecartes:
            print("%d fichier(s) trouves mais TOUS ecartes : un dossier qui "
                  "commence par « _ » ou « . », ou qui finit par "
                  "« _livraison », est considere comme un dossier de travail."
                  % brut)
            for x in ecartes[:6]:
                print("   ecarte : %s" % x)
            print("Renomme ce dossier, ou range les rushes dans un "
                  "sous-dossier au nom du mannequin.")
        elif brut:
            print("%d fichier(s) trouves mais aucun lot n'a pu etre forme "
                  "dans %s" % (brut, racine))
        else:
            print("aucune video ni photo dans %s" % racine)
        return 1

    print("")
    print("%-32s %6s %6s %-9s %-7s %s"
          % ("LOT", "VIDEOS", "PHOTOS", "COU", "HIJAB", "RANGE PAR"))
    for g in groupes:
        cou = ("?" if g["cou_couvert"] is None
               else ("couvert" if g["cou_couvert"] else "decouvert"))
        hij = "oui" if g["hijab"] else "?"
        print("%-32s %6d %6d %-9s %-7s %s"
              % (g["nom"][:32], len(g["videos"]), len(g["photos"]), cou, hij,
                 g["methode"]))
    print("   « hijab » vient du NOM du dossier, pas de l'image : sur une photo,")
    print("   un col ferme et un foulard se ressemblent trop pour trancher.")

    if style is None:
        style = demander_style()
    if style not in POV:
        print("style inconnu ou pas donne.", file=sys.stderr)
        print("Relance en ajoutant --pov suivi de l'une de ces sous-niches :",
              file=sys.stderr)
        print("   %s" % ", ".join(POV), file=sys.stderr)
        print("Exemple :  python3 manita.py --projet <dossier> --pov hijab",
              file=sys.stderr)
        return 2
    liste = POV[style]

    # une accroche « hijab » sur un lot au cou decouvert, c'est un decalage
    # commercial, pas un detail. On le dit AVANT de fabriquer.
    if style == "hijab":
        decouverts = [g["nom"] for g in groupes
                      if g.get("cou_couvert") is False]
        if decouverts:
            print("")
            print("ATTENTION : tu as choisi les accroches « hijab », mais sur")
            print("ces lots le cou est DECOUVERT sur les photos :")
            for x in decouverts[:6]:
                print("   - %s" % x)
            print("Les accroches ne colleront pas a l'image. Relance avec un")
            print("autre style si ce n'est pas voulu.")

    if musiques and not musiques_du_dossier(musiques):
        print("")
        print("ATTENTION : aucune musique dans %s — les variantes sortiront"
              " sans son." % musiques)
    elif not musiques:
        print("")
        print("ATTENTION : aucun dossier de musiques (--musiques). Les dix"
              " variantes sortiront SANS musique.")

    base_sortie = os.path.abspath(sortie or os.path.join(
        os.path.dirname(racine.rstrip(os.sep)),
        os.path.basename(racine.rstrip(os.sep)) + "_livraison"))
    total_v, bons_v, total_p, bons_p = 0, 0, 0, 0
    for g in groupes:
        propre = g["nom"].replace("/", " - ").replace(os.sep, " - ").strip(" .")
        dest = os.path.abspath(os.path.join(base_sortie, propre or "lot"))
        # garde-fou : on n'ecrit JAMAIS ailleurs que sous le dossier de livraison
        if not dest.startswith(base_sortie + os.sep) and dest != base_sortie:
            print("   [ECHEC] chemin de sortie refuse : %s" % dest); continue
        os.makedirs(dest, exist_ok=True)
        print("")
        print("== %s ==" % g["nom"])

        # --- les videos : DIX variantes montees, scenes / musiques / POV
        #     tous differents
        if g["videos"]:
            rep_v = os.path.join(dest, "videos")
            try:
                faits, banque = fabriquer_variantes(g["videos"], style,
                                                    musiques, rep_v)
                ecrire_rapport_montage(base_sortie, faits)
                total_v += VARIANTES
                bons_v += sum(1 for f in faits if f["conforme"])
                for c in controler_variantes(faits):
                    print("   [%s] %-32s %s"
                          % ("OK" if c["ok"] else "ATTENTION", c["controle"],
                             c["detail"]))
            except Exception as e:
                print("   [ECHEC] montage : %s" % e)
                total_v += VARIANTES

        # --- les photos : les meilleures, par couleur, pretes pour la pub
        if g["photos"]:
            rep_ph = os.path.join(dest, "photos")
            r = commande_photos(os.path.dirname(g["photos"][0]), style, rep_ph)
            total_p += 1; bons_p += 1 if r == 0 else 0

    print("")
    print("videos : %d / %d   photos : %d lot(s) sur %d"
          % (bons_v, total_v, bons_p, total_p))
    dire_ou_sont_les_fichiers(base_sortie)
    return 0 if (bons_v == total_v and bons_p == total_p) else 1


# ============================================================================
#                          AVANT DE COMMENCER
# Les controles qui empechent un montage de mourir en route. Ils tournent
# TOUT SEULS avant chaque montage : on ne demande pas au client d'y penser.
# Chacun a coute une soiree perdue au moins une fois.
# ============================================================================

PLACE_TRAVAIL   = 1.30            # les decoupes pesent plus que les sources
PLACE_SORTIE    = 0.40            # les variantes pesent moins
PLACE_RESERVE   = 1024 ** 3       # on ne descend jamais sous un Go libre
MUSIQUE_LONGUE  = 180             # au-dela : un cours ou un vocal, pas un titre
SOURCES_MINIMUM = 2               # une seule video ne fait pas des variantes


def _poids(chemin):
    """Le poids d'un dossier, en octets."""
    if os.path.isfile(chemin):
        return os.path.getsize(chemin)
    t = 0
    for r, _, fs in os.walk(chemin):
        for f in fs:
            try:
                t += os.path.getsize(os.path.join(r, f))
            except OSError:
                pass
    return t


def _joli(n):
    """Un poids que l'on lit d'un coup d'oeil."""
    for unite, seuil in (("To", 1024 ** 4), ("Go", 1024 ** 3),
                         ("Mo", 1024 ** 2), ("Ko", 1024)):
        if abs(n) >= seuil:
            return "%.1f %s" % (n / float(seuil), unite)
    return "%d o" % n


def _dossier_existant(chemin):
    """Remonte jusqu'au premier dossier qui existe : on mesure la place du
    disque qui portera le fichier, meme si le dossier n'est pas encore cree."""
    c = os.path.abspath(chemin)
    while c and not os.path.isdir(c):
        parent = os.path.dirname(c)
        if parent == c:
            break
        c = parent
    return c or os.path.abspath(os.sep)


def _libre(chemin):
    try:
        return shutil.disk_usage(_dossier_existant(chemin)).free
    except Exception:
        return None


def _meme_disque(a, b):
    try:
        return os.stat(_dossier_existant(a)).st_dev == \
               os.stat(_dossier_existant(b)).st_dev
    except Exception:
        return False


def vider_les_travaux_anciens():
    """Un montage tue en route laisse ses decoupes derriere lui, et le disque
    se remplit sans que personne ne le voie. On les compte, on dit leur poids,
    et on les efface : ce sont les notres, jamais les fichiers du client."""
    base = tempfile.gettempdir()
    vieux, poids = [], 0
    try:
        noms = os.listdir(base)
    except OSError:
        return 0, 0
    for n in noms:
        if not n.startswith("manita_"):
            continue
        d = os.path.join(base, n)
        if os.path.isdir(d) and d not in _MANITA_TEMPS \
                and not _travail_vivant(d):
            vieux.append(d)
            poids += _poids(d)
    for d in vieux:
        shutil.rmtree(d, ignore_errors=True)
    return len(vieux), poids


def _videos_du_dossier(dossier):
    """Toutes les videos, y compris dans les sous-dossiers : un shooting
    arrive presque toujours range par seance."""
    out = []
    for r, ds, fs in os.walk(dossier):
        ds[:] = [d for d in ds if not d.startswith(".")]
        for f in sorted(fs):
            if f.lower().endswith(EXT_VIDEO) and not f.startswith("."):
                out.append(os.path.join(r, f))
    return out


def _deja_produit(nom):
    """Reconnait un fichier SORTI d'un montage precedent. Laisse dans le
    dossier source, il repart dans le montage suivant : la meme scene revient
    deux fois, avec un POV deja ecrit dessus."""
    import re
    base = os.path.basename(nom)
    tige = os.path.splitext(base)[0]
    if base.startswith(("_brut_", "_muet_", "_liste_", "variante_")):
        return True
    return bool(re.search(r"_(%s|pov)\d*$" % "|".join(POV), tige, re.I))


def avant_de_commencer(source, musiques=None, sortie=None, variantes=10,
                       bavard=True):
    """Tout ce qui doit etre vrai AVANT de lancer un montage.
    Rend (la liste des controles, est-ce que ca bloque)."""
    ctrl = []

    def c(nom, etat, detail):
        # etat : True = passe, False = BLOQUE, None = a savoir, sans bloquer
        ctrl.append({"controle": nom, "etat": etat, "detail": detail})

    # 1. les outils
    manque = installer(silencieux=True)
    c("ffmpeg, ffprobe et le reste", not manque,
      "rien ne manque" if not manque
      else "il manque %s — lance d'abord : python3 manita.py --installer"
           % ", ".join(manque))

    # 2. la police arabe : sans elle, le POV sort en carres vides
    try:
        par = police_arabe(60)
    except Exception:
        par = None
    c("une police arabe sur la machine", par is not None,
      "trouvee" if par is not None
      else "aucune — Mac : brew install --cask font-noto-naskh-arabic")

    # 3. le dossier source
    vids = []
    if not source or not os.path.isdir(source):
        c("le dossier des rushes", False, "dossier introuvable : %s" % source)
    else:
        vids = _videos_du_dossier(source)
        c("le dossier des rushes", len(vids) >= SOURCES_MINIMUM,
          "%d video(s) trouvee(s)" % len(vids) if len(vids) >= SOURCES_MINIMUM
          else "%d video(s) : il en faut au moins %d" % (len(vids), SOURCES_MINIMUM))

    # 4. aucune video vide ou illisible — une seule suffit a tuer le montage
    vides, casses, sans_son, a_reencoder = [], [], [], []
    for v in vids:
        try:
            if os.path.getsize(v) == 0:
                vides.append(v); continue
        except OSError:
            casses.append(v); continue
        try:
            l, h, d = dimensions(v)
            if not l or not h or d <= 0:
                casses.append(v); continue
        except Exception:
            casses.append(v); continue
        try:
            if not a_du_son(v):
                sans_son.append(v)
            elif son_a_reencoder(v):
                a_reencoder.append(v)
        except Exception:
            pass
    mauvaises = vides + casses
    c("aucune video vide ni illisible", not mauvaises,
      "toutes lisibles" if not mauvaises
      else "%d a revoir : %s" % (len(mauvaises),
                                 ", ".join(os.path.basename(x)
                                           for x in mauvaises[:4])))

    # 5. rien de DEJA PRODUIT qui traine dans les rushes
    restes = [v for v in vids if _deja_produit(v)]
    c("aucun fichier deja monte dans les rushes", not restes,
      "propre" if not restes
      else "%d a sortir du dossier : %s" % (len(restes),
                                            ", ".join(os.path.basename(x)
                                                      for x in restes[:4])))

    # 6. le menage des montages tues en route
    n_vieux, poids_vieux = vider_les_travaux_anciens()
    c("dossiers de travail des anciens montages", None,
      "rien a jeter" if not n_vieux
      else "%d efface(s), %s repris sur le disque" % (n_vieux, _joli(poids_vieux)))

    # 7. LA PLACE SUR LE DISQUE — la panne qui ne dit pas son nom :
    #    ffmpeg n'a plus la place d'ecrire, il s'arrete, et rien ne l'explique.
    if vids:
        poids = sum(_poids(v) for v in vids)
        dest = sortie or os.path.join(source, "_sortie")
        besoin_t = int(poids * PLACE_TRAVAIL) + PLACE_RESERVE
        besoin_s = int(poids * PLACE_SORTIE) + PLACE_RESERVE
        tmp = tempfile.gettempdir()
        if _meme_disque(tmp, dest):
            besoin = besoin_t + besoin_s - PLACE_RESERVE
            libre = _libre(tmp)
            detail = "il faut %s, il y a %s" % (_joli(besoin),
                                                _joli(libre) if libre is not None else "?")
            c("assez de place sur le disque",
              libre is None or libre >= besoin, detail)
        else:
            for quoi, ou, besoin in (("le travail", tmp, besoin_t),
                                     ("la sortie", dest, besoin_s)):
                libre = _libre(ou)
                c("assez de place pour %s" % quoi,
                  libre is None or libre >= besoin,
                  "il faut %s, il y a %s" % (_joli(besoin),
                                             _joli(libre) if libre is not None else "?"))

    # 8. LES MUSIQUES — le dossier des cours et le dossier des musiques se
    #    ressemblent de loin. Coller une lecon sous une pub tue la pub.
    if musiques:
        if not os.path.isdir(musiques):
            c("le dossier des musiques", False, "dossier introuvable : %s" % musiques)
        else:
            tous = [f for f in os.listdir(musiques)
                    if f.lower().endswith(EXT_MUSIQUE) and not f.startswith(".")]
            gardees = musiques_du_dossier(musiques, bavard=False)
            jetees = len(tous) - len(gardees)
            c("le dossier contient de la MUSIQUE, pas des voix",
              bool(gardees) and jetees <= len(tous) / 2.0,
              "%d garde(s) sur %d" % (len(gardees), len(tous))
              if gardees else "aucune musique : tout ressemble a de la voix")
            # une musique de pub dure quelques secondes. Un fichier de
            # plusieurs minutes qui passe le filtre est presque toujours un
            # cours enregistre a voix calme.
            longues = []
            for f in gardees:
                try:
                    d = duree_audio(f)
                except Exception:
                    d = 0
                if d and d > MUSIQUE_LONGUE:
                    longues.append((os.path.basename(f), int(d)))
            if gardees:
                # il suffit que la MOITIE soient longues pour que le dossier
                # soit un dossier de cours : une pub ne dure pas cinq minutes.
                c("les musiques ont une duree de musique",
                  len(longues) * 2 < len(gardees),
                  "toutes courtes" if not longues
                  else "%d de plus de %d s : %s"
                       % (len(longues), MUSIQUE_LONGUE,
                          ", ".join("%s (%d s)" % x for x in longues[:3])))
                c("assez de musiques differentes", None,
                  "%d pour %d variante(s)%s"
                  % (len(gardees), variantes,
                     "" if len(gardees) >= variantes
                     else " — la meme musique reviendra"))

    # 9. le son des rushes : on previent, on ne bloque pas
    if vids:
        if a_reencoder:
            c("le son des rushes", None,
              "%d video(s) en son non portable : il sera reencode" % len(a_reencoder))
        elif sans_son:
            c("le son des rushes", None,
              "%d video(s) sans son" % len(sans_son))

    # 10. pouvoir ecrire la sortie
    if sortie:
        dest = os.path.abspath(sortie)
        try:
            os.makedirs(dest, exist_ok=True)
            essai = os.path.join(dest, ".manita_essai")
            with open(essai, "w") as f:
                f.write("x")
            os.remove(essai)
            ok, pourquoi = True, "ecriture possible"
        except Exception as e:
            ok, pourquoi = False, str(e)[:120]
        c("le dossier de sortie accepte l'ecriture", ok, pourquoi)
        if ok and os.path.isdir(dest):
            deja = [f for f in os.listdir(dest) if not f.startswith(".")]
            if deja:
                c("le dossier de sortie est vide", None,
                  "%d element(s) deja dedans : ils seront ecrases" % len(deja))

    bloque = any(x["etat"] is False for x in ctrl)
    if bavard:
        print("")
        print("AVANT DE COMMENCER")
        for x in ctrl:
            marque = "OK" if x["etat"] else ("STOP" if x["etat"] is False else "A SAVOIR")
            print("  [%-8s] %-42s %s" % (marque, x["controle"], x["detail"]))
        print("")
        if bloque:
            print("  JE NE DEMARRE PAS. Repare les lignes STOP et relance.")
        else:
            print("  Tout est en place — le montage peut commencer.")
        print("")
    return ctrl, bloque


def main():
    global FORMAT_SORTIE
    p = argparse.ArgumentParser(description="Editeur ecom manita, en un seul fichier.")
    p.add_argument("video", nargs="?", help="la video a lire")
    p.add_argument("--installer", action="store_true", help="installe ce qui manque")
    p.add_argument("--verifier", action="store_true", help="se teste tout seul")
    p.add_argument("--dossier", help="traite toutes les videos d'un dossier")
    p.add_argument("--json", help="ecrit la fiche dans ce fichier")
    p.add_argument("--pov", help="brule un POV : nom de sous-niche (mariage, "
                                 "hijab, soiree, sortie, maison) ou texte exact")
    p.add_argument("--numero", type=int, default=1, help="quel POV de la liste (1 a 10)")
    p.add_argument("--variantes", action="store_true",
                   help="fabrique les 10 variantes de la sous-niche")
    p.add_argument("--sortie", help="nom du fichier de sortie")
    p.add_argument("--drive", help="lien d'un dossier Drive PUBLIC a traiter "
                                   "de bout en bout")
    p.add_argument("--projet", help="dossier deja telecharge a traiter "
                                    "de bout en bout")
    p.add_argument("--musiques", help="dossier de musiques : une par variante")
    p.add_argument("--photos", help="choisit les meilleures photos d'un dossier "
                                    "et les prepare pour la pub")
    p.add_argument("--combien", type=int, default=PHOTO_PAR_LOT,
                   help="combien de photos par couleur (defaut 5)")
    p.add_argument("--format", dest="format", default="9:16",
                   choices=["9:16", "4:5", "source"],
                   help="format des variantes (defaut 9:16, le format de la pub)")
    p.add_argument("--avant-de-commencer", action="store_true", dest="avant",
                   help="les controles a passer AVANT un montage")
    p.add_argument("--pov-liste", action="store_true", dest="pov_liste",
                   help="affiche toutes les accroches, par sous-niche")
    a = p.parse_args()
    FORMAT_SORTIE = a.format

    if a.installer:
        return 1 if installer() else 0
    if a.pov_liste:
        return lister_pov()
    if a.avant:
        _, bloque = avant_de_commencer(a.projet or a.dossier or a.photos,
                                       a.musiques, a.sortie)
        return 2 if bloque else 0

    # avant tout travail, il verifie qu'il peut travailler
    if a.verifier or a.video or a.dossier:
        manque = installer(silencieux=True)
        if manque:
            print("Il manque : %s" % ", ".join(manque))
            print("Lance d'abord :  python3 manita.py --installer")
            return 2

    if a.verifier:
        return verifier()
    if a.drive or a.projet:
        return commande_tout(a.drive, a.projet, a.pov, a.sortie, a.musiques)
    if a.photos:
        return commande_photos(a.photos, a.pov, a.sortie, a.combien)
    if a.pov and a.dossier:
        return commande_pov_dossier(a.dossier, a.pov, a.sortie)
    if a.pov:
        if not a.video:
            print("il manque la video :  python3 manita.py video.mp4 --pov hijab\n"
                  "ou tout un dossier  :  python3 manita.py --dossier D --pov hijab",
                  file=sys.stderr); return 2
        return commande_pov(a.video, a.pov, a.numero, a.variantes, a.sortie)
    if a.dossier:
        return traiter_dossier(a.dossier)
    if a.video:
        if not os.path.isfile(a.video):
            print("fichier introuvable : %s" % a.video, file=sys.stderr); return 2
        try:
            f = analyser(a.video)
        except Exception as e:
            print("ECHEC : %s" % e, file=sys.stderr); return 3
        if a.json:
            json.dump(f, open(a.json, "w"), indent=1, ensure_ascii=False)
        print(rapport(f))
        return 0 if f["conforme"] else 1

    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
