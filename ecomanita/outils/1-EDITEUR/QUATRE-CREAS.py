#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QUATRE-CREAS — le mode « تيست » du robot : QUATRE creas par modele, a partir
des videos DEJA faites qui sont dans le dossier du modele.

  29/10/2026 — la regle du vendeur.
  ---------------------------------
  Le test d'un modele = QUATRE creas.
    - quatre videos ou plus dans le dossier : les quatre premieres (ordre des
      noms), TELLES QUELLES ;
    - moins de quatre : chaque video originale part telle quelle, puis des
      COPIES ou SEULE LA MUSIQUE CHANGE completent jusqu'a quatre (une seule
      video = l'originale + trois copies, chacune avec une autre musique).
  L'image n'est jamais touchee : la piste video est COPIEE (-c:v copy), seule
  la piste son est remplacee. La copie garde la longueur de l'originale (la
  musique est coupee a la fin, avec un fondu de 0,8 s, jamais repetee).

  Les videos viennent du marchand lui-meme, ou d'un profil qui lui a dit oui :
  le bouton du robot le dit au client avant ce mode. Cet outil ne cherche pas
  a cacher d'ou vient une video : il n'ajoute rien d'autre que la musique.

  Sortie : <sortie>/variante_01.mp4 ... variante_04.mp4 + _rapport.json
  (fichier, sorte « originale » ou « copie_musique », origine, musique, duree).
  Le controle du bureau relit ensuite chaque video comme apres un montage
  (plus de 10 s, du son, une image).

  Code original « ecom manita » — 29/10/2026.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

CREAS = 4
EXT_VIDEO = (".mp4", ".mov", ".m4v", ".avi", ".mkv")
EXT_MUSIQUE = (".mp3", ".m4a", ".wav", ".aac", ".ogg")
MUSIQUE_MIN_S = 12.0   # la meme loi que MONTER-10 : 12 s ou moins = ecartee
FONDU_MUSIQUE = 0.8


def lancer(cmd, timeout=600):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def sonder(f):
    """(duree, a_une_image, a_du_son) lus par ffprobe ; (0, False, False) si illisible."""
    try:
        r = lancer(["ffprobe", "-v", "error", "-show_entries",
                    "format=duration:stream=codec_type", "-of", "json", f], 60)
        j = json.loads(r.stdout or "{}")
    except Exception:
        return 0.0, False, False
    types = [s.get("codec_type") for s in j.get("streams", [])]
    try:
        d = float((j.get("format") or {}).get("duration") or 0)
    except ValueError:
        d = 0.0
    return d, "video" in types, "audio" in types


def videos_du_dossier(dossier):
    out = []
    for racine, dirs, fichiers in os.walk(dossier):
        dirs[:] = sorted(x for x in dirs if not x.startswith((".", "_")))
        for f in sorted(fichiers):
            if f.startswith(".") or not f.lower().endswith(EXT_VIDEO):
                continue
            out.append(os.path.join(racine, f))
    return out


def musiques_du_dossier(dossier):
    if not dossier or not os.path.isdir(dossier):
        return [], []
    gardees, courtes = [], []
    for f in sorted(os.listdir(dossier)):
        p = os.path.join(dossier, f)
        if f.startswith(".") or not f.lower().endswith(EXT_MUSIQUE) or not os.path.isfile(p):
            continue
        d, _, son = sonder(p)
        (gardees if (son and d > MUSIQUE_MIN_S) else courtes).append(p)
    return gardees, courtes


def garder_originale(src, dest):
    """L'originale TELLE QUELLE : un .mp4 est copie octet pour octet ; un autre
    conteneur est remis en .mp4 sans re-encoder (pistes copiees)."""
    if src.lower().endswith(".mp4"):
        shutil.copy2(src, dest)
        return True
    r = lancer(["ffmpeg", "-v", "error", "-i", src, "-map", "0:v:0", "-map", "0:a?",
                "-c", "copy", "-movflags", "+faststart", dest, "-y"])
    return r.returncode == 0 and os.path.isfile(dest)


def copie_musique(src, musique, duree, dest):
    """La MEME image (piste video copiee), une autre musique, la meme longueur."""
    st = max(0.0, duree - FONDU_MUSIQUE)
    r = lancer(["ffmpeg", "-v", "error", "-i", src, "-i", musique,
                "-map", "0:v:0", "-map", "1:a:0",
                "-af", "apad,atrim=0:%.3f,afade=t=out:st=%.3f:d=%.2f" % (duree, st, FONDU_MUSIQUE),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                "-t", "%.3f" % duree, "-movflags", "+faststart", dest, "-y"])
    return r.returncode == 0 and os.path.isfile(dest)


def plan_des_creas(n_videos, n_musiques, combien=CREAS):
    """Le plan, sans rien ecrire : [(sorte, rang de l'originale, rang de la musique ou None)].
    Quatre videos ou plus : les quatre premieres. Moins : toutes, puis des copies
    (originales prises a tour de role, une musique differente par copie, tant qu'il
    y a des musiques)."""
    if n_videos <= 0:
        return []
    if n_videos >= combien:
        return [("originale", i, None) for i in range(combien)]
    plan = [("originale", i, None) for i in range(n_videos)]
    for k in range(min(combien - n_videos, n_musiques)):
        plan.append(("copie_musique", k % n_videos, k))
    return plan


def fabriquer(rushes, sortie, dossier_musiques=None, combien=CREAS):
    os.makedirs(sortie, exist_ok=True)
    for f in os.listdir(sortie):
        if f.startswith("variante_") and f.endswith(".mp4"):
            os.remove(os.path.join(sortie, f))
    videos = []
    for v in videos_du_dossier(rushes):
        d, image, son = sonder(v)
        if image and d > 0:
            videos.append((v, d, son))
        else:
            print("   [ECARTEE] %s : illisible ou sans image" % os.path.basename(v))
    musiques, courtes = musiques_du_dossier(dossier_musiques)
    if courtes:
        print("   [A SAVOIR] %d musique(s) de %d s ou moins (ou sans son) ecartee(s)"
              % (len(courtes), int(MUSIQUE_MIN_S)))
    plan = plan_des_creas(len(videos), len(musiques), combien)
    if not plan:
        print("REFUS : aucune video lisible dans %s" % rushes)
        return 1, []
    if len(plan) < combien:
        print("   [A SAVOIR] %d crea(s) sur %d : %d video(s) et %d musique(s) pour les copies"
              % (len(plan), combien, len(videos), len(musiques)))
    rapport = []
    for i, (sorte, rv, rm) in enumerate(plan, 1):
        src, d, son = videos[rv]
        nom = "variante_%02d.mp4" % i
        dest = os.path.join(sortie, nom)
        if sorte == "originale":
            ok = garder_originale(src, dest)
            mus = None
        else:
            mus = musiques[rm]
            ok = copie_musique(src, mus, d, dest)
        if not ok:
            print("   [ECHEC] %s (%s de %s)" % (nom, sorte, os.path.basename(src)))
            continue
        rapport.append({"fichier": nom, "sorte": sorte, "origine": os.path.basename(src),
                        "musique": os.path.basename(mus) if mus else None,
                        "duree": round(sonder(dest)[0], 2), "son_origine": bool(son)})
        print("   %s : %s%s" % (nom, sorte, (" — " + os.path.basename(mus)) if mus else ""))
    with open(os.path.join(sortie, "_rapport.json"), "w", encoding="utf-8") as fh:
        json.dump(rapport, fh, ensure_ascii=False, indent=1)
    print("%d crea(s) ecrite(s) dans %s" % (len(rapport), sortie))
    return (0 if rapport else 1), rapport


# ---------------------------------------------------------------------------
# L'epreuve : de vraies petites videos fabriquees par ffmpeg, jamais un client
# ---------------------------------------------------------------------------

def _video(dest, secondes, couleur, son=True):
    cmd = ["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
           "color=c=%s:s=180x320:d=%.1f:r=25" % (couleur, secondes)]
    if son:
        cmd += ["-f", "lavfi", "-i", "sine=f=330:d=%.1f" % secondes]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"] + (["-c:a", "aac", "-shortest"] if son else []) + [dest, "-y"]
    lancer(cmd)


def _musique(dest, secondes, f):
    lancer(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=f=%d:d=%.1f" % (f, secondes), dest, "-y"])


def _hash_image(f):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-map", "0:v:0", "-f", "md5", "-"],
                       capture_output=True, text=True)
    return r.stdout.strip()


def _hash_son(f):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-map", "0:a:0", "-f", "md5", "-"],
                       capture_output=True, text=True)
    return r.stdout.strip()


def verifier():
    ok = True

    def essai(nom, cond, detail=""):
        nonlocal ok
        print(("[OK]   " if cond else "[FAUX] ") + nom + ("" if cond else "  " + str(detail)))
        ok &= bool(cond)

    essai("plan : une video = originale + 3 copies", plan_des_creas(1, 5) ==
          [("originale", 0, None), ("copie_musique", 0, 0), ("copie_musique", 0, 1), ("copie_musique", 0, 2)])
    essai("plan : deux videos = 2 originales + 2 copies a tour de role", plan_des_creas(2, 5) ==
          [("originale", 0, None), ("originale", 1, None), ("copie_musique", 0, 0), ("copie_musique", 1, 1)])
    essai("plan : six videos = les quatre premieres, aucune copie", plan_des_creas(6, 5) ==
          [("originale", i, None) for i in range(4)])
    essai("plan : sans musique, aucune copie", plan_des_creas(1, 0) == [("originale", 0, None)])
    essai("plan : aucune video, rien", plan_des_creas(0, 5) == [])
    t = tempfile.mkdtemp(prefix="quatre-creas-")
    try:
        r, m, s = os.path.join(t, "rushes"), os.path.join(t, "musiques"), os.path.join(t, "creas")
        os.makedirs(r); os.makedirs(m)
        _video(os.path.join(r, "post-1.mp4"), 12.0, "red")
        _musique(os.path.join(m, "a.wav"), 20, 440)
        _musique(os.path.join(m, "b.wav"), 20, 550)
        _musique(os.path.join(m, "c.wav"), 20, 660)
        _musique(os.path.join(m, "courte.wav"), 8, 770)
        code, rap = fabriquer(r, s, m)
        essai("une video : quatre creas ecrites", code == 0 and len(rap) == 4, rap)
        fichiers = sorted(f for f in os.listdir(s) if f.startswith("variante_"))
        essai("noms variante_01..04", fichiers == ["variante_%02d.mp4" % i for i in range(1, 5)], fichiers)
        src = os.path.join(r, "post-1.mp4")
        essai("l'originale est la video TELLE QUELLE (octets identiques)",
              open(src, "rb").read() == open(os.path.join(s, "variante_01.mp4"), "rb").read())
        h0 = _hash_image(src)
        essai("les trois copies ont la MEME image que l'originale",
              all(_hash_image(os.path.join(s, f)) == h0 for f in fichiers[1:]))
        sons = [_hash_son(os.path.join(s, f)) for f in fichiers]
        essai("quatre sons differents (seule la musique change)", len(set(sons)) == 4, sons)
        essai("la musique courte (8 s) n'est jamais prise",
              all(x["musique"] != "courte.wav" for x in rap), rap)
        essai("chaque copie garde la longueur de l'originale (a 0,2 s)",
              all(abs(x["duree"] - 12.0) <= 0.2 for x in rap), [x["duree"] for x in rap])
        lu = json.load(open(os.path.join(s, "_rapport.json"), encoding="utf-8"))
        essai("_rapport.json : 1 originale + 3 copie_musique",
              [x["sorte"] for x in lu] == ["originale"] + ["copie_musique"] * 3, lu)
        for i in range(2, 7):
            _video(os.path.join(r, "post-%d.mp4" % i), 11.0, "blue")
        code, rap = fabriquer(r, s, m)
        essai("six videos : les quatre premieres, aucune copie",
              code == 0 and [x["sorte"] for x in rap] == ["originale"] * 4
              and [x["origine"] for x in rap] == ["post-%d.mp4" % i for i in range(1, 5)], rap)
        vide = os.path.join(t, "vide"); os.makedirs(vide)
        code, rap = fabriquer(vide, os.path.join(t, "creas2"), m)
        essai("dossier sans video : refus (code 1)", code == 1 and rap == [])
    finally:
        shutil.rmtree(t, ignore_errors=True)
    print("\n" + ("QUATRE-CREAS : TOUT PASSE" if ok else "QUATRE-CREAS : UN CONTROLE ECHOUE"))
    return 0 if ok else 1


def main():
    p = argparse.ArgumentParser(description="Quatre creas par modele (mode tester)")
    p.add_argument("--rushes", help="le dossier des videos du modele")
    p.add_argument("--sortie", help="ou ecrire variante_01..04.mp4")
    p.add_argument("--musiques", default="", help="le dossier des musiques (pour les copies)")
    p.add_argument("--combien", type=int, default=CREAS)
    p.add_argument("--verifier", action="store_true")
    a = p.parse_args()
    if a.verifier:
        return verifier()
    if not a.rushes or not a.sortie:
        print("Il manque --rushes ou --sortie")
        return 2
    if not (1 <= a.combien <= CREAS):
        print("--combien va de 1 a %d" % CREAS)
        return 2
    code, _ = fabriquer(a.rushes, a.sortie, a.musiques or None, a.combien)
    return code


if __name__ == "__main__":
    sys.exit(main())
