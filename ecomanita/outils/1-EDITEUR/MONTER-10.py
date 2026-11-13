#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MONTER-10 — un modele, une mannequin, quatre couleurs.

  22/09/2026 — CE QUI A RATE LE 21, ET CE QUI LE REPARE.
  ------------------------------------------------------
  Un lot portait SEPT modeles differents. Cet outil, lui, avait ete
  ecrit pour UN SEUL modele en plusieurs coloris : il regroupait les rushes
  PAR COULEUR DE VETEMENT (voir `familles`) sans jamais lire le decoupage en
  modeles. Resultat : chaque variante melangeait de quatre a sept modeles, et
  la verification — qui ne testait que la couleur — ne pouvait pas le voir.
  Elle declarait les dix videos « conforme ».

  Trois reparations :
    A. MODE « UN SEUL MODELE » (--plan / --modele). L'outil lit un PLAN qui
       dit, modele par modele, quels SEGMENTS de quels rushes lui
       appartiennent. Une variante ne prend ses secondes que la-dedans.
    B. LE CONTROLE QUI MANQUAIT (`controler_un_seul_modele`). Il REFUSE une
       video des qu'un seul de ses blocs ne vient pas du modele annonce. Il
       ne croit pas le plan : il RELIT la video ecrite avec ffmpeg, une image
       par bloc, et compare chaque image a sa source declaree ET a une image
       de CHAQUE AUTRE modele. Si un bloc ressemble davantage a un autre
       modele qu'a sa source, c'est ECHEC.
    C. STYLE « natif » (defaut) : AUCUN floutage, AUCUNE barre, AUCUN
       recadrage. La video garde sa propre definition. Regle de la maison :
       « ne pas mettre ce genre de video avec floutage, les laisser a leur
       propre forme ». `bande` (fond floute) et `plein` (barres noires)
       restent disponibles mais ne sont plus le defaut.
       v0.3.8 (06/10/2026) : c'est AUSSI le style du bureau. Quand les rushes
       d'un modele n'ont pas tous la meme taille (un telephone en 720x1280,
       un autre en 1080x1920), chaque bloc est ramene a la taille
       MAJORITAIRE du modele en REMPLISSANT l'image (mise a l'echelle puis
       recadrage centre) — jamais de flou, jamais de barres. Un bloc qui a
       la bonne taille n'est pas touche. Les blocs remplis sont ecrits dans
       _rapport.json (« rempli ») et la relecture leur applique le meme
       recadrage avant de comparer.

  La plaque POV noire a coins arrondis ne bouge pas : elle vient de
  manita.py (`bruler_pov`, `POV_PLAQUE`), qu'on ne touche jamais.

Ce que l'editeur n'a pas su faire et que celui-ci fait :
  1. il REDRESSE les rushes filmes couches (la camera n'a pas toujours ecrit
     le sens ; on ne se fie donc pas a l'etiquette, on regarde l'image) ;
  2. il ne coupe pas le shooting en lots par heure de prise de vue : une
     mannequin et un modele, c'est UN SEUL lot ;
  3. il LIT la couleur du vetement sur chaque rush, en fait des familles, et
     les fait ALTERNER dans chaque variante — jamais deux blocs de la meme
     couleur a la suite ;
  4. il JETTE les rushes ou le vetement n'est pas la (un plan de decor) ;
  5. il ne zoome pas : l'image entiere est posee, un peu plus petite, en bas ;
     la bande du haut recoit l'accroche, donc le texte ne tombe jamais sur le
     visage ;
  6. il ecrit une PLANCHE CONTACT par variante — on regarde, on ne se contente
     pas de mesurer.

  LE RYTHME (v0.3.8, regle du vendeur), le meme dans les deux modes :
    plusieurs couleurs -> les premiers blocs, UN PAR COULEUR, durent 1,6 s,
                          puis tous les autres 3 s ;
    une seule couleur  -> 3 s partout.
  Jamais de dernier bloc « flash » (moins de 1 s). Les longueurs sont ecrites
  dans _rapport.json et RELUES sur la video ecrite (`mesurer_rythme`).
  06/10/2026 : en --plan, un modele d'UNE couleur filme en UNE SEULE longue
  prise sortait « 1,6 s partout » (il fallait deux morceaux de 3 s). Une
  prise qui porte 3 s suffit : ses coupes se suivent, ELOIGNEES dans le temps
  pour que la coupe se voie (`_suite_une_prise`). Le bloc court ne reste que
  si AUCUN morceau du modele ne porte 3 s, et l'outil le dit.
  06/10/2026, relecture sur de VRAIS rushes : beaucoup sont deja de petits
  montages (une prise de 6,8 s coupee a 3,57 s, une autre coupee huit fois).
  Les blocs de 3 s poses a cheval montraient deux plans : dix variantes sur
  dix « coupes en trop ». L'outil trouve maintenant ces coupes avec le meme
  instrument que la relecture (`coupes_du_rush`) et n'y pose plus de bloc a
  cheval ; « porter 3 s » veut dire porter 3 s ENTRE deux coupes. Et dans
  une prise courte, un bloc ne revoit plus ce que le bloc d'avant vient de
  montrer (`REVU_MAXI`).

  07/10/2026, QUATRE DEFAUTS VUS SUR LE VRAI LOT :
    A. --plan : les familles de couleur viennent du « coloris » de chaque
       segment du plan (confirme par le client), plus de la distance des
       pixels (cinq « familles » pour quatre coloris : le marron manquait a
       trois ouvertures sur quatre). L'ouverture montre chaque coloris UNE
       fois, dans l'ordre le plus contraste (`ordre_ouverture`). Sans coloris
       dans le plan : les pixels, comme avant.
    B. --rushes : un bloc n'est plus jamais pose a cheval sur une coupe deja
       presente dans le rush (`plages_propres`, le meme instrument que
       --plan) ; un rush sans place propre cede au suivant de sa couleur. La
       premiere image n'est plus le flash d'un autre plan.
    C. --plan : les EXCLUSIONS du plan et les bords disputes entre deux
       modeles sont retires (`_nettoyer_plan`, comme separer.lire_plan) ; le
       controle refuse un bloc qui les touche.
    D. natif : la plaque POV RESTE EN HAUT (decision du vendeur). On mesure
       si le visage est dessous (`visage_dans`, la peau dans le haut de
       l'image), on prefere les blocs ou la tete est plus bas que la plaque,
       et sinon le bloc est marque « plaque sur le visage » : verdict
       A REGARDER au rapport, jamais « conforme » en silence.
    Casse de ces corrections (meme jour) : en --rushes, une couleur dont tous
    les rushes sont coupes partout n'est plus perdue (secours marque, le bloc
    commence juste apres une coupe, jamais en vignette) ; en --plan, la
    recherche d'un bloc sans visage ne relache plus le « deja vu » (le meme
    film revenait deux fois dans une video) ; les exclusions suivent le
    FICHIER, pas le nom ecrit, et un segment illisible d'un autre modele ne
    bloque plus le plan ; le choix lit deux images au lieu de trois quand
    elles suffisent a dire « plaque sur le visage ».

  07/10/2026, DEUXIEME RELECTURE DU VRAI LOT, CINQ DEFAUTS :
    E. LA TETE (natif) : « aucun visage trouve » valait « plaque hors du
       visage » — des gros plans de la poitrine, tete hors du cadre, passaient
       EN PREMIER, et une MAIN passait pour le visage. Le detecteur est strict
       (`tete_dans` : la tache la plus haute de la silhouette, jamais une main
       sous une autre tache de peau, ni un hijab beige colle au visage) ; une
       tete non vue est « non vue » ou « hors du cadre », jamais 0. En niche
       hijab la tete DANS LE CADRE passe avant la plaque (`rang_tete`), et un
       bloc a la tete non vue est MARQUE (la vignette des un seul instant).
    F. LE FILM DISTINCT (--plan) : le nombre de blocs suit les blocs
       DIFFERENTS que la matiere porte (`film_distinct`), plus le nombre de
       « coupes » espacees de 0,25 s ; un bloc qui remontre plus de REVU_MAXI
       d'un bloc precedent est « film revu » (A REGARDER, jamais conforme).
    G. LES FAMILLES NOMMEES (N = 1) : --rushes --familles (captures.py ou le
       client) monte un plan d'UN modele aux fichiers entiers, comme --plan ;
       sans familles, la couleur d'un rush est mesuree comme captures.py (sur
       tout le rush, la teinte avant la lumiere). Moins de quatre rushes, ou
       de longues prises : le meme plan d'un modele, plus de manita.py.
    H. LA MUSIQUE COURTE (--plan) : jamais plus de blocs que la musique n'en
       porte ; une musique trop courte pour une pub cede a la suivante ; une
       video plus courte que ses blocs dit « musique trop courte », jamais
       « deux modeles ».
    I. LA LOI DES DIX SECONDES (08/10/2026, decision du vendeur) : CHAQUE
       video livree depasse strictement 10 s, dans tous les modes (--plan,
       --rushes, --familles). Une musique qui ne le permet pas cede a une
       autre ; une variante de 10 s ou moins sort « trop_courte » (A REVOIR,
       jamais conforme) ; --verifier la refuse (ECHEC, code 1).

  UN SEUL MODELE (a utiliser des qu'un lot porte plusieurs modeles) :
    python3 MONTER-10.py --plan PLAN.json --modele "Modele 1"
                         --musiques <dossier> --sortie <dossier> --preparer
    python3 MONTER-10.py --plan PLAN.json --modele "Modele 1"
                         --musiques <dossier> --sortie <dossier> --de 1 --a 5
    python3 MONTER-10.py --verifier <dossier>      # relit TOUT avec ffmpeg

  UN SEUL MODELE EN PLUSIEURS COLORIS (le mode du bureau, une mission seule) :
    python3 MONTER-10.py --rushes <dossier> --musiques <dossier> --sortie <dossier>
                         [--pov etudiante] [--combien 10] [--style natif]
                         [--couleurs N]      # N = 1 : une seule couleur, 3 s partout
                         [--familles F]      # les familles NOMMEES (le _rapport.json
                                             # de captures.py, ou {"familles":
                                             # [{"nom", "rushes"}]}) : monte comme
                                             # --plan, un modele aux fichiers entiers
  UN MODELE D'UN LOT (le mode du bureau, une mission nee d'un lot) :
    python3 MONTER-10.py --plan <lot>/plan.json --modele "<nom du plan>"
                         --style natif [--musiques <dossier>] --sortie <dossier>
    (sans musique : videos muettes de 18 s au plus, comme en --rushes)

  L'AUTO-TEST (videos fabriquees ici, montees, puis relues) :
    python3 MONTER-10.py --auto-test           # ou --verifier sans dossier
"""

import argparse, itertools, json, math, os, shutil, subprocess, sys, tempfile

# ------------------------------------------------------------------ reglages
# LE RYTHME (v0.3.8). Avant : tous les blocs a 2,2 s, et le dernier raccourci
# jusqu'a 0,2 s (un flash). Maintenant la regle du vendeur, la meme en
# --rushes et en --plan (`longueurs_blocs`) :
#   plusieurs couleurs -> un bloc de 1,6 s PAR COULEUR en ouverture, puis 3 s ;
#   une seule couleur  -> 3 s partout.
BLOC_COULEURS = 1.6     # les blocs d'ouverture, un par couleur
BLOC_1COULEUR = 3.0     # tous les autres (et tous, s'il n'y a qu'une couleur)
FLASH_MAXI    = 1.0     # un dernier bloc plus court est un flash : absorbe
REGLE_CACHE   = "1.6-par-couleur-puis-3.0;une-prise-3.0;coupes-du-rush;coloris-du-plan;exclusions;film-distinct"
                        # marque de _segments-couleur.json : un cache plus
                        # ancien (une prise -> 1,6 s ; blocs a cheval sur une
                        # coupe du rush ; couleurs comptees aux pixels au lieu
                        # du « coloris » du plan ; exclusions ignorees) est refait
ECART_MEME_PRISE = 2.0  # deux blocs voisins tires de la MEME prise : au moins
                        # 2 s de film sautees entre la fin de l'un et le debut
                        # de l'autre, sinon la coupe ne se voit pas
DUREE_MINI_LIVREE = 10.0  # LOI DU VENDEUR (08/10/2026) : CHAQUE video livree depasse
                          # STRICTEMENT dix secondes. Une musique qui ne le permet pas
                          # cede a une autre ; une variante de 10 s ou moins est
                          # « trop_courte » (A REVOIR, jamais conforme) et --verifier
                          # la refuse. Le bureau la jette aussi a son controle.
DUREE_LIVREE_VISEE = 10.2  # les blocs entiers visent au moins 10,2 s (l'image pres)
DUREE_MINI_PUB = 6.0    # une pub de moins de 6 s ne se monte pas (le bureau
                        # refuse sous 5 s) : on ne descend pas en dessous, ni en
                        # coupant la musique, ni en retirant un film revu
REVU_MAXI     = 0.30    # ... et jamais plus de 0,3 s de film en commun : au-
                        # dela, on REVOIT ce qu'on vient de voir (un retour
                        # en arriere de 2 s dans la meme prise, vu le 06/10)
MARGE_COUPE   = 0.10    # un bloc reste a 0,1 s au moins d'une coupe DEJA
                        # PRESENTE dans le rush (`coupes_du_rush`)
IPS           = 30      # images par seconde des blocs : une longueur est un
                        # nombre ENTIER d'images, sinon les frontieres derivent
# LA MUSIQUE COMMANDE LA DUREE. On ne la repete JAMAIS : une musique de neuf
# secondes fait une video de neuf secondes. Le dernier bloc finit exactement
# avec elle.
BLOCS_MAXI    = 20
DUREE_SANS_MUSIQUE = 18.0
# LA RELECTURE DU RYTHME, sur le fichier ecrit. Une COUPE est un saut net
# d'une image a la suivante ; chaque frontiere voulue doit avoir la sienne,
# et aucune autre coupe ne doit exister (sinon un bloc montre deux plans).
TOL_FRONTIERE = 0.10    # une frontiere relue a plus de 0,1 s de sa place : faux
SEUIL_COUPE   = 6.0     # saut moyen (sur 255) au-dessus duquel il y a coupe
FACTEUR_COUPE = 3.0     # ... et au moins trois fois le mouvement ordinaire
LARGEUR       = 1080
HAUTEUR       = 1920
IMG_L         = 821     # l'image posee : cadrage COMPLET, jamais recadre
IMG_H         = 1459
MARGE_BAS     = 20
FLOU          = 22
ECART_FAMILLE = 34      # deux rushes de la meme couleur restent sous cet ecart
MINI_FAMILLE  = 1       # 09/10/2026 (recette du vendeur) : une famille d'un seul rush est GARDEE et dite (une couleur
                        # filmee une fois est une couleur) ; avant : 2, et le rush seul partait en « [JETE] »
# DEUX PLANS QUI SE SUIVENT NE DOIVENT PAS SE RESSEMBLER. Les familles ne
# suffisent pas : des couleurs peu saturees ne different que par la clarte,
# et deux familles voisines se ressemblent a l'ecran. On compare donc la
# couleur REELLE du plan precedent, et a la fin on RELIT la video ecrite pour
# verifier — jamais « par construction ».
SEUIL_VOISIN  = 30    # 21/09/2026 : le CONTROLE refuse en dessous de 22, et
                      # il ne mesure pas au meme endroit que le plan (video
                      # finie, recadree, texte brule). A 26 la marge etait de
                      # 4 points : trop mince, deux blocs passaient. On vise
                      # 30. Le plan devient plus exigeant, JAMAIS le controle.
# LA VIGNETTE DOIT MONTRER LE MODELE EN ENTIER (regle du 17/09/2026).
# On mesure « est-ce que le sujet touche deja le bord du haut ? » en comparant
# la bande du haut aux QUATRE COINS de l'image — pas au vetement : sinon un
# ensemble beige devant un mur clair serait pris pour un gros plan.
#   petit  = il n'y a que du decor en haut -> plan ENTIER
#   grand  = le sujet est deja au bord      -> GROS PLAN
# Verifie sur un vrai lot : les gros plans sortent au-dessus de 80, les plans
# entiers en dessous.
SEUIL_CADRAGE = 80
SEUIL_RELU    = 22    # sous cet ecart, la RELECTURE d'une image ne sait plus
                      # dire que deux couleurs sont differentes
# Les deux controles qui dependent de cette relecture. Quand deux familles
# sont plus proches que SEUIL_RELU, l'instrument est AVEUGLE : ces deux
# lignes sont alors montrees, pas comptees. Les autres bloquent toujours.
COULEUR_DEPEND = ("aucune couleur repetee a la suite",
                  "chaque couleur ouvre au moins une video")
LOI_COUPES = "aucun bloc a cheval sur une coupe"
LOI_PLAQUE = "la plaque POV hors du visage"
T_APERCU      = 3.0

# ------------------------------------------------ mode « un seul modele »
# Meme regle qu'en --rushes (BLOC_COULEURS puis BLOC_1COULEUR, plus haut) ;
# une seule couleur : l'alternance se fait alors entre les SCENES.
PAS_COULEUR_MIN = 0.35   # pas d'echantillonnage d'un segment court
PAS_COULEUR_MAX = 5.0    # ... et d'un segment de plusieurs minutes
POINTS_SEGMENT  = 40     # combien d'images on lit par segment, au plus
SAUT_COULEUR    = 26.0   # au-dela, le vetement a change de coloris
ECART_DEPART    = 0.25   # deux coupes dans le meme sous-segment restent
                         # au moins a cet ecart : sinon c'est la meme image
PLANS_PAR_SEG   = 12     # on ne tire pas cent coupes du meme sous-segment
PLANS_UNE_PRISE = 30     # ... sauf quand il est TOUT le modele (une seule
                         # prise) : douze places sur une prise de quatre
                         # minutes, c'etait 36 s de film pour dix variantes,
                         # et deux variantes aux memes blocs (06/10/2026)
FONDU_MUSIQUE   = 0.8    # fondu de sortie, impose par la skill
# LE CONTROLE « UN SEUL MODELE ». On relit la video ECRITE, une image au
# milieu de chaque bloc, et on la compare :
#   - a l'image de SA SOURCE declaree (meme rush, meme instant) ;
#   - a une image de CHAQUE AUTRE modele du plan (les leurres).
# Un bloc est accepte quand il ressemble plus a sa source qu'a n'importe
# quel leurre, avec cette marge. C'est un test d'IDENTITE, il se calibre
# tout seul : il ne depend ni du codec ni de la definition.
MARGE_LEURRE    = 1.15   # la source doit etre au moins 15 % plus proche
ECART_SOURCE_MAX = 26.0  # et rester sous cet ecart absolu (sur 255)
PLAT_MINI       = 6.0    # un bloc dont l'image est plate (noir, fondu)
# ON NE JUGE PAS UN BLOC SUR UNE SEULE IMAGE. 22/09/2026 : certains rushes
# enchainent les coloris avec UNE IMAGE NOIRE entre deux. Le
# controle, qui lisait le milieu du bloc, est tombe pile dessus et a refuse un
# montage juste. On lit donc le milieu ; si ca coince, on relit a 30 % et a
# 70 %. Un bloc venu d'un AUTRE modele rate les trois : le controle ne perd
# rien de sa force, il cesse seulement de dependre d'une seule image.
POINTS_BLOC     = (0.5, 0.3, 0.7)
MESURES_PAR_BLOC = 40    # on ne relit pas cinq cents images pour UN bloc
# LA DUREE D'UNE PUB. Vingt blocs de 1,6 s font trente-deux secondes : trop
# long pour du COD. On vise de six a vingt secondes.
BLOCS_MINI_MODELE = 4
BLOCS_MAXI_MODELE = 12
# LE PLAN DIT CE QUI EST EXCLU (07/10/2026). Comme separer.lire_plan : un
# instant exclu est retire du segment du meme rush, et un bord dispute entre
# deux modeles (0,35 s au plus) est retire aux DEUX. Au-dela, le meme instant
# est donne a deux modeles : le plan est refuse, jamais tranche en silence.
CHEVAUCHE_TOLERE = 0.35

# LA PLAQUE POV RESTE EN HAUT (decision du vendeur). Ce qu'on mesure, c'est
# si le VISAGE est dessous (07/10/2026 : sur de vrais rushes en gros plan, la
# plaque couvrait le front ou les yeux, et le rapport disait « conforme »).
# La mesure est simple : la peau (regles RVB + YCbCr) dans le haut de l'image,
# la tache la plus « visage » (ni collee aux bords, ni plus large que haute,
# ni plate), et la part de sa hauteur que la boite de la plaque couvre.
# On lit le RUSH (la plaque assombrit la video ecrite), tel que le bloc le
# montre (redresse, rempli), a trois instants du bloc.
PLAQUE_NOMINALE = (0.08, 0.048, 0.92, 0.20)   # x1, y1, x2, y2 (part de l'image)
POINTS_VISAGE   = (0.15, 0.5, 0.85)           # ou on regarde dans le bloc
COUVRE_VISAGE   = 0.25   # la plaque couvre le quart du visage : elle atteint
                         # les yeux (sous un hijab, la peau visible commence
                         # aux sourcils)
VISAGE_MAXI     = 2      # plaque sur le visage a 2 des 3 instants : marque
VISAGES_PAR_BLOC = 12    # la tete vue sous la plaque : cherchee parmi les
                         # douze premiers blocs sans visage sous la plaque
LARGEUR_VISAGE  = 108    # l'image ou l'on cherche la peau (9:16 -> 108x192)


def lancer(cmd, minuteur=300):
    return subprocess.run(cmd, capture_output=True, text=True,
                          stdin=subprocess.DEVNULL, timeout=minuteur)


def duree(f):
    r = lancer(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "csv=p=0", f], 60)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def duree_image(f):
    """La duree de l'IMAGE (le flux video), pas celle du fichier. Un telephone
    ecrit un son plus long que l'image (0,1 s sur de vrais rushes) : un bloc
    coupe jusqu'a la « fin du fichier » manquait d'images et la variante
    tombait. Sans duree de flux (certains conteneurs) : celle du fichier."""
    r = lancer(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                "stream=duration", "-of", "csv=p=0", f], 60)
    try:
        # « 4.004000, » : un flux avec etiquette de rotation ajoute un champ
        v = float((r.stdout or "").strip().splitlines()[0].split(",")[0])
    except (ValueError, IndexError):
        v = 0.0
    d = duree(f)
    return min(v, d) if (v > 0 and d > 0) else (v or d)


def apercu(f, dest, t=T_APERCU):
    """Une image du rush, DECODEE — donc deja tournee si la camera l'a dit.
    C'est sa forme qui nous apprend si le plan est couche."""
    lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % t, "-i", f,
            "-frames:v", "1", "-vf", "scale=160:-1", dest, "-y"], 90)
    return os.path.isfile(dest)


_COULEURS = {}


def couleur_a(fichier, t, couche, travail):
    """La couleur du vetement A CET INSTANT de la video.
    FAUTE DU 17/09/2026 : on comparait la couleur mesuree a 3 s alors que le
    bloc est coupe ailleurs. On mesure maintenant LA OU ON COUPE."""
    from PIL import Image
    import numpy as np
    cle = (fichier, round(float(t), 1))
    if cle in _COULEURS:
        return _COULEURS[cle]
    p = os.path.join(travail, "cc_%d.png" % (abs(hash(cle)) % 10 ** 9))
    vf = "transpose=2,scale=160:-1" if couche else "scale=160:-1"
    lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % max(0.0, float(t)),
            "-i", fichier, "-frames:v", "1", "-vf", vf, p, "-y"], 90)
    if not os.path.isfile(p):
        return None
    a = np.asarray(Image.open(p).convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape
    c = a[int(h * 0.40):int(h * 0.82), int(w * 0.34):int(w * 0.66)]
    v = tuple(float(x) for x in c.reshape(-1, 3).mean(axis=0))
    _COULEURS[cle] = v
    try:
        os.remove(p)
    except OSError:
        pass
    return v


_CADRAGES = {}


def sujet_en_haut(fichier, t, couche, travail):
    """Petit = le haut de l'image est du decor, donc le modele est en entier.
    Grand = le sujet touche le bord du haut, donc c'est un gros plan."""
    from PIL import Image
    import numpy as np
    cle = (fichier, round(float(t), 1))
    if cle in _CADRAGES:
        return _CADRAGES[cle]
    p = os.path.join(travail, "cad_%d.png" % (abs(hash(cle)) % 10 ** 9))
    vf = "transpose=2,scale=200:-1" if couche else "scale=200:-1"
    lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % max(0.0, float(t)),
            "-i", fichier, "-frames:v", "1", "-vf", vf, p, "-y"], 90)
    if not os.path.isfile(p):
        return 999.0
    a = np.asarray(Image.open(p).convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape

    def moy(y0, y1, x0, x1):
        return a[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] \
                .reshape(-1, 3).mean(axis=0)

    coins = (moy(0, .12, 0, .14) + moy(0, .12, .86, 1)
             + moy(.88, 1, 0, .14) + moy(.88, 1, .86, 1)) / 4.0
    v = float(math.dist(moy(0, .10, .32, .68), coins))
    _CADRAGES[cle] = v
    try:
        os.remove(p)
    except OSError:
        pass
    return v


# ------------------------------------------- le visage sous la plaque POV
_POULS = [0.0]


def pouls(texte):
    """UNE LIGNE AU PLUS PAR MINUTE pendant le choix des blocs (07/10/2026,
    casse) : le juge de la tete lit maintenant deux ou trois images par bloc
    candidat, et une variante de vingt blocs restait 16 minutes sans rien
    ecrire sur une machine chargee. Le bureau arrete un outil muet depuis
    30 minutes (« fige ») : sur un PC plus lent, le montage serait tue."""
    import time
    t = time.time()
    if t - _POULS[0] >= 60.0:
        _POULS[0] = t
        print(texte, flush=True)


_VISAGES = {}


def _peau(a):
    """Les points couleur de peau d'une image (tableau RVB en flottants) :
    regles RVB classiques ET bornes YCbCr resserrees — un beige de tissu ou un
    mur creme (Cr ~ 137) reste dehors, la peau (Cr ~ 150-160) dedans. Et le
    BOIS : une porte ou une boiserie chaude a la teinte de la peau mais bien
    moins de bleu ((R-B)/R ~ 0,46-0,50 contre ~ 0,24-0,35 pour un visage, mesure
    sur de vrais rushes) ; sans cette borne, le visage se collait a la porte
    derriere lui, la tache touchait le bord et le visage n'etait plus vu."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    return ((r > 95) & (g > 40) & (b > 20) & (r > g) & (r > b) & (r - g >= 12)
            & (mx - mn >= 20) & (cr >= 138) & (cr <= 178) & (cb >= 77) & (cb <= 127)
            & (r - b <= 0.42 * r) & (y >= 60))


def _taches(m):
    """Les taches (4-connexes) d'un masque : [{n, y0, y1, x0, x1}]."""
    h, w = m.shape
    vu = [[False] * w for _ in range(h)]
    mm = m.tolist()
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if not mm[y0][x0] or vu[y0][x0]:
                continue
            pile, n = [(y0, x0)], 0
            vu[y0][x0] = True
            ya, yb, xa, xb = y0, y0, x0, x0
            while pile:
                y, x = pile.pop()
                n += 1
                ya, yb, xa, xb = min(ya, y), max(yb, y), min(xa, x), max(xb, x)
                for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= yy < h and 0 <= xx < w and mm[yy][xx] and not vu[yy][xx]:
                        vu[yy][xx] = True
                        pile.append((yy, xx))
            out.append({"n": n, "y0": ya, "y1": yb + 1, "x0": xa, "x1": xb + 1})
    return out


def _cadrage_haut(a):
    """`sujet_en_haut` sur un tableau deja lu : la bande du haut (0-10 %, au
    milieu) comparee aux QUATRE COINS. Petit = decor en haut, le sujet est
    entier (sa tete est dans le cadre) ; grand = le sujet touche le haut."""
    import numpy as np
    h, w = a.shape[0], a.shape[1]

    def moy(y0, y1, x0, x1):
        z = a[int(y0 * h):max(int(y0 * h) + 1, int(y1 * h)),
              int(x0 * w):max(int(x0 * w) + 1, int(x1 * w))]
        return np.asarray(z, dtype=np.float32).reshape(-1, 3).mean(axis=0)

    coins = (moy(0, .12, 0, .14) + moy(0, .12, .86, 1)
             + moy(.88, 1, 0, .14) + moy(.88, 1, .86, 1)) / 4.0
    return float(np.linalg.norm(moy(0, .10, .32, .68) - coins))


# LE DETECTEUR PLUS STRICT (07/10/2026, relecture sur le vrai lot). L'ancien
# prenait la PLUS GRANDE tache de peau du haut de l'image : une MAIN sur la
# poitrine (le visage, lui, colle a un hijab beige, formait une tache trop
# grande et etait ecarte) passait pour « le visage, plus bas que la plaque ».
# Et « aucune tache » valait 0 : « plaque hors du visage » — un gros plan de la
# poitrine, tete hors du cadre, etait PREFERE. Maintenant :
#   - le visage est la tache LA PLUS HAUTE du sujet : une tache qui a une
#     autre tache de peau (un visage, un hijab beige) au-dessus d'elle, dans
#     son voisinage, est une main — refusee ;
#   - le sujet touche le haut de l'image (gros plan) : le visage est juste
#     sous le bord (le hijab entre les deux) ; une tache plus bas est une main ;
#   - une tache qui touche un bord, plus large que haute, peu pleine, ou dont
#     le haut est bien plus clair (ou bien plus sombre) que le milieu (un hijab
#     beige ou marron colle au visage) est refusee ;
#   - DANS LE DOUTE, « inconnu », jamais « pas de visage sous la plaque ».
VISAGE_HAUT_MAXI = 0.40    # le milieu du visage est dans les 40 % du haut
VISAGE_FORME = (0.8, 2.6)  # hauteur / largeur d'un visage sous un hijab
VISAGE_PLEIN = 0.40        # part de la boite couverte de peau
VISAGE_VOISIN = 0.30       # une autre tache de peau AU-DESSUS, a moins de 30 %
                           # de la largeur de l'image : la tache n'est pas le visage
HIJAB_COLLE = 22.0         # ecart de clarte haut / milieu de la tache (sur 255)
HAUT_COMME_CORPS = 40.0    # la bande du haut a la couleur du vetement : le sujet
                           # touche le haut (un gros plan sombre, mesure : un peu
                           # moins de 40)


def tete_dans(a):
    """LA TETE d'une image (tableau H x L x 3) : {"visage": (y0, y1, x0, x1)
    en part de l'image ou None, "estime": le visage est deduit d'une tache
    « tete + hijab clair », "doute": pourquoi la meilleure tache a ete refusee
    (ou None), "cadrage": la bande du haut contre les coins, "touche_haut":
    le sujet touche le haut de l'image}.
    Le visage n'est rendu que s'il est SUR : la tache de peau la plus haute du
    sujet, au haut de la silhouette, qui a la forme d'un visage. Un hijab
    BEIGE colle au visage fait une seule tache « tete » : elle est refusee
    comme visage, mais si elle est au haut de la silhouette et a la taille
    d'une tete, le visage est estime dans son milieu (marque « estime »)."""
    import numpy as np
    a = np.asarray(a, dtype=np.float32)
    h, w = a.shape[0], a.shape[1]
    cadrage = _cadrage_haut(a)
    # LE SUJET TOUCHE-T-IL LE HAUT ? la bande du haut differe du decor des
    # coins (gros plan) — ou elle a la couleur du vetement (un gros plan dont
    # les coins sont, eux aussi, le vetement : la mesure des coins ne le voit pas)
    haut = a[:max(1, int(h * 0.10)), int(w * 0.32):max(int(w * 0.32) + 1, int(w * 0.68))] \
        .reshape(-1, 3).mean(axis=0)
    corps = a[int(h * 0.40):int(h * 0.82), int(w * 0.34):int(w * 0.66)].reshape(-1, 3).mean(axis=0)
    touche_haut = bool(cadrage > SEUIL_CADRAGE
                       or float(np.linalg.norm(haut - corps)) < HAUT_COMME_CORPS)
    m = _peau(a)
    limite = int(h * 0.45)
    m[int(h * 0.55):, :] = False       # une tache qui DESCEND sous 45 % est un vetement
    y = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    taches = [c for c in _taches(m) if c["n"] >= 6]

    def place(c):
        """Ce qui interdit a la tache c d'etre la tete : sa PLACE (bords,
        hauteur, ce qu'il y a au-dessus). None si elle peut l'etre."""
        lw, lh = c["x1"] - c["x0"], c["y1"] - c["y0"]
        cx, cy = (c["x0"] + c["x1"]) / 2.0 / w, (c["y0"] + c["y1"]) / 2.0 / h
        if c["x0"] <= 0 or c["x1"] >= w:
            return "colle a un bord (decor)"
        if c["y0"] <= 0:
            return "touche le haut de l'image (tete coupee)"
        if c["y1"] > limite:
            return "descend trop bas (un vetement, un bras)"
        if not (0.15 <= cx <= 0.85) or cy > VISAGE_HAUT_MAXI:
            return "trop bas ou trop au bord"
        # AU HAUT DE LA SILHOUETTE : aucune autre tache de peau qui commence
        # plus haut, dans son voisinage (un visage au-dessus d'une main, un
        # visage colle a un hijab beige a cote d'une main), hors du decor
        for b in taches:
            if b is c or b["n"] < max(8, 0.4 * c["n"]) or b["x0"] <= 0 or b["x1"] >= w:
                continue
            bx = (b["x0"] + b["x1"]) / 2.0 / w
            trou = max(b["x0"] - c["x1"], c["x0"] - b["x1"], 0) / float(w)
            if b["y0"] < c["y0"] - 0.5 * lh and (abs(bx - cx) <= VISAGE_VOISIN
                                                or trou <= VISAGE_VOISIN / 2.0):
                return "une autre tache de peau au-dessus (une main sous le visage)"
        if touche_haut and c["y0"] > 1.3 * lh + 0.02 * h:
            # le sujet touche le haut (gros plan) : le haut de la silhouette
            # est au bord, le visage juste dessous ; plus bas, c'est une main
            return "le sujet touche le haut et la tache est loin du bord (une main)"
        return None

    def forme(c):
        """Ce qui interdit a la tache c d'etre un VISAGE (seul) : sa forme."""
        lw, lh = c["x1"] - c["x0"], c["y1"] - c["y0"]
        if lw < 5 or lh < 5 or c["n"] < 20:
            return "trop petite (un reflet, un motif)"
        if lw > 0.40 * w or lh > 0.25 * h:
            return "trop grande (un hijab clair ou un vetement colle a la peau)"
        if not (VISAGE_FORME[0] * lw <= lh <= VISAGE_FORME[1] * lw):
            return "pas la forme d'un visage"
        if c["n"] < VISAGE_PLEIN * lw * lh:
            return "trop creuse (des doigts, un motif)"
        if lh >= 6:
            # un hijab beige ou marron COLLE au visage : le haut de la tache
            # (le hijab) n'a pas la clarte du milieu (la peau)
            t3 = max(1, lh // 3)
            z = m[c["y0"]:c["y1"], c["x0"]:c["x1"]]
            yy = y[c["y0"]:c["y1"], c["x0"]:c["x1"]]
            hh, mi = yy[:t3][z[:t3]], yy[t3:2 * t3][z[t3:2 * t3]]
            if len(hh) >= 3 and len(mi) >= 3 \
                    and abs(float(hh.mean()) - float(mi.mean())) > HIJAB_COLLE:
                return "un hijab clair ou marron colle au visage"
        return None

    refus, bons, tetes = [], [], []
    for c in taches:
        if c["n"] < 12 or c["y0"] >= limite:
            continue
        pl = place(c)
        fo = None if pl else forme(c)
        if pl is None and fo is None:
            bons.append(c)
            continue
        refus.append((c, pl or fo))
        lw, lh = c["x1"] - c["x0"], c["y1"] - c["y0"]
        if pl is None and fo in ("trop grande (un hijab clair ou un vetement colle a la peau)",
                                 "un hijab clair ou marron colle au visage") \
                and lw <= 0.50 * w and lh <= 0.30 * h and 0.8 * lw <= lh <= 2.6 * lw \
                and c["n"] >= VISAGE_PLEIN * lw * lh:
            tetes.append(c)            # une tete au hijab clair, a sa place
    res = {"visage": None, "estime": False, "doute": None,
           "cadrage": round(cadrage, 1), "touche_haut": touche_haut}
    if bons:
        c = min(bons, key=lambda x: (x["y0"], -x["n"]))
        res["visage"] = (c["y0"] / float(h), c["y1"] / float(h),
                         c["x0"] / float(w), c["x1"] / float(w))
        return res
    if tetes:
        # le visage est au milieu de la tache « tete + hijab » : le hijab
        # couvre le haut du crane et tombe sous le menton
        c = min(tetes, key=lambda x: (x["y0"], -x["n"]))
        lh = c["y1"] - c["y0"]
        res.update({"visage": ((c["y0"] + 0.30 * lh) / float(h), (c["y0"] + 0.85 * lh) / float(h),
                               c["x0"] / float(w), c["x1"] / float(w)),
                    "tete": (c["y0"] / float(h), c["y1"] / float(h),
                             c["x0"] / float(w), c["x1"] / float(w)),
                    "estime": True,
                    "doute": "visage estime dans une tache « tete + hijab clair »"})
        return res
    if refus:
        res["doute"] = max(refus, key=lambda x: x[0]["n"])[1]
    return res


def visage_dans(a):
    """LE VISAGE d'une image (tableau H x L x 3), ou None : celui de
    `tete_dans` (le detecteur strict). None veut dire « visage non vu » —
    JAMAIS « la plaque ne le couvre pas »."""
    return tete_dans(a)["visage"]


def couverture_visage(v, boite):
    """La part de la hauteur du visage v que la boite de la plaque couvre
    (0 si pas de visage, ou s'il est a cote de la plaque)."""
    if not v or not boite:
        return 0.0
    y0, y1, x0, x1 = v
    bx1, by1, bx2, by2 = boite
    if min(x1, bx2) - max(x0, bx1) < 0.5 * (x1 - x0):
        return 0.0
    return max(0.0, min(y1, by2) - max(y0, by1)) / max(1e-6, y1 - y0)


def tete_a(fichier, t, couche=False, cible=None):
    """La tete du RUSH a l'instant t (`tete_dans`), telle que le bloc la
    montre : redresse s'il est couche, REMPLI comme le bloc si sa taille n'est
    pas la cible (natif). En cache : un plan revient d'une variante a l'autre.
    Une image illisible rend « rien vu » (visage None, ni haut ni cadre)."""
    import io
    from PIL import Image
    import numpy as np
    cle = (fichier, round(float(t), 2), bool(couche), tuple(cible) if cible else None)
    if cle in _VISAGES:
        return _VISAGES[cle]
    vf = "transpose=2," if couche else ""
    if cible and taille_redressee(fichier, couche) != tuple(cible):
        vf += crop_rempli(cible) + ","
    vf += "scale=%d:-2" % LARGEUR_VISAGE
    res = {"visage": None, "estime": False, "doute": "image illisible",
           "cadrage": None, "touche_haut": False}
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", "%.3f" % max(0.0, float(t)),
                            "-i", fichier, "-frames:v", "1", "-vf", vf, "-f", "image2pipe",
                            "-vcodec", "png", "-"], capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=120)
        if r.returncode == 0 and r.stdout:
            a = np.asarray(Image.open(io.BytesIO(r.stdout)).convert("RGB"), dtype=np.float32)
            res = tete_dans(a)
    except Exception:
        pass
    _VISAGES[cle] = res
    return res


def visage_a(fichier, t, couche=False, cible=None):
    """Le visage du rush a l'instant t, ou None (« non vu », jamais « hors de
    la plaque »)."""
    return tete_a(fichier, t, couche, cible)["visage"]


# L'ETAT DE LA TETE A UN INSTANT (07/10/2026). « Aucun visage trouve » n'est
# plus jamais « la plaque ne couvre pas le visage » :
#   dessous     le visage est vu, plus bas que la plaque          (bien)
#   sous_plaque le visage est vu, la plaque en couvre le quart    (plaque sur le visage)
#   non_vue     la tete est dans le cadre (decor en haut), le visage n'est
#               pas vu : de dos, cache, ou le detecteur doute      (inconnu)
#   hors_cadre  aucun visage et le sujet touche le haut : la tete est coupee,
#               un gros plan de la poitrine                       (la tete ne se voit pas)
ETATS_TETE = ("dessous", "sous_plaque", "non_vue", "hors_cadre")


def etat_tete(t, boite):
    """(etat, couverture ou None) d'une tete `tete_dans` sous la plaque `boite`.
    Un visage ESTIME (hijab clair colle au visage) ne dit « dessous » que si
    toute la tache tete + hijab est sous la plaque ; sinon le doute reste."""
    v = t.get("visage")
    if v:
        cv = round(couverture_visage(v, boite), 2)
        if cv >= COUVRE_VISAGE:
            return "sous_plaque", cv
        if not t.get("estime"):
            return "dessous", cv
        tete = t.get("tete") or v
        if boite and tete[0] >= boite[3] - 0.005:
            return "dessous", cv
        return "non_vue", None
    return ("hors_cadre" if t.get("touche_haut") else "non_vue"), None


def rang_tete(etats, hijab):
    """LE RANG d'un bloc pour le CHOIX (plus petit = meilleur), suivi de sa
    sous-cle. En niche hijab, LA TETE DANS LE CADRE passe AVANT la plaque (le
    produit, c'est le hijab : un gros plan de la poitrine ne le montre pas) :
      0 le visage vu sous la plaque a chaque instant ;
      1 un seul instant douteux ;
      2 la tete dans le cadre, mais la plaque sur le visage ou le visage non
        vu a deux instants ou plus (le bloc sera MARQUE) ;
      3 la tete hors du cadre a deux instants ou plus.
    Dans les autres niches (le produit, c'est la tenue) :
      0 le visage vu sous la plaque partout ; 1 au plus un instant plaque sur
      le visage, la tete dans le cadre (visage non vu admis) ; 2 la tete hors
      du cadre ; 3 la plaque sur le visage a deux instants ou plus (MARQUE)."""
    n_d = etats.count("dessous")
    n_s = etats.count("sous_plaque")
    n_nv = etats.count("non_vue")
    n_h = etats.count("hors_cadre")
    if hijab:
        mauvais = n_s + n_nv + n_h
        r = 0 if mauvais == 0 else 1 if mauvais == 1 else 2 if n_h <= 1 else 3
        return (r, n_h, n_nv, n_s)
    if n_s >= VISAGE_MAXI:
        r = 3
    elif n_h:
        r = 2
    elif n_d == len(etats):
        r = 0
    else:
        r = 1
    return (r, n_s, n_h, n_nv)


def tete_du_bloc(fichier, couche, debut, longueur, cible, boite, hijab=True, choix=False):
    """LA TETE A TROIS INSTANTS DU BLOC (POINTS_VISAGE). Rend {"etats",
    "couvertures" (None si le visage n'est pas vu), "rang"}.
    Pour le CHOIX (choix=True), on s'arrete des que le rang ne peut plus
    changer (casse du 07/10/2026 : un modele filme la tete haute faisait lire
    plus de mille images a la premiere variante). Le marquage final lit
    toujours les trois instants."""
    etats, cs = [], []
    for k, p in enumerate(POINTS_VISAGE):
        e, cv = etat_tete(tete_a(fichier, debut + longueur * p, couche, cible), boite)
        etats.append(e)
        cs.append(cv)
        reste = len(POINTS_VISAGE) - k - 1
        if choix and reste and len({rang_tete(etats + list(x), hijab)[0] for x in
                                    itertools.product(ETATS_TETE, repeat=reste)}) == 1:
            break
    return {"etats": etats, "couvertures": cs, "rang": rang_tete(etats, hijab)}


def marque_tete(etats, hijab, vignette=False):
    """Ce que le bloc porte au rapport : (plaque sur le visage, tete non vue).
    La plaque sur le visage : a VISAGE_MAXI instants (toutes niches). La tete
    non vue (niche hijab) : deux instants douteux ou plus (visage non vu, tete
    hors du cadre) — et pour la VIGNETTE, un seul suffit."""
    n_s = etats.count("sous_plaque")
    doute = etats.count("non_vue") + etats.count("hors_cadre")
    sur = n_s >= VISAGE_MAXI
    non_vue = bool(hijab and not sur and (n_s + doute >= VISAGE_MAXI
                                          or (vignette and doute >= 1)))
    return sur, non_vue


def plaque_sur_visage(fichier, couche, debut, longueur, cible, boite, vus=False):
    """(compatibilite) A combien des POINTS_VISAGE du bloc la plaque couvre le
    visage. Rend (nombre, [couvertures]) — une couverture None : visage non
    vu ; avec vus=True, (nombre, [couvertures], instants ou le visage est vu
    plus bas que la plaque), en s'arretant des que VISAGE_MAXI instants ont
    le visage sous la plaque."""
    cs, n, vus_ = [], 0, 0
    for p in POINTS_VISAGE:
        e, cv = etat_tete(tete_a(fichier, debut + longueur * p, couche, cible), boite)
        cs.append(cv)
        n += e == "sous_plaque"
        vus_ += e == "dessous"
        if vus and n >= VISAGE_MAXI:
            break
    if vus:
        return n, cs, vus_
    return n, cs


def _nv(v):
    """Le RANG d'un juge (0 a 3) : un tuple `rang_tete`, ou un nombre."""
    if isinstance(v, (tuple, list)):
        return int(v[0] or 0)
    return int(v or 0)


def boite_plaque(M, texte, taille, travail):
    """La boite de la plaque POV (x1, y1, x2, y2, en part de l'image) que
    manita.py dessinera pour CE texte sur une video de CETTE taille — avant
    de choisir les blocs. Faute de la calculer : la boite la plus basse
    mesuree (deux lignes)."""
    if M is not None and taille and hasattr(M, "image_pov"):
        png = os.path.join(travail, "plaque_essai.png")
        try:
            info = M.image_pov(texte, int(taille[0]), int(taille[1]), png)
            b = (info.get("plaque") or {}).get("boite")
            if b:
                return boite_relative(b, taille)
        except Exception:
            pass
        finally:
            _retirer(png)
    return PLAQUE_NOMINALE


def boite_relative(b, taille):
    l, h = float(taille[0]), float(taille[1])
    return (round(b[0] / l, 4), round(b[1] / h, 4), round(b[2] / l, 4), round(b[3] / h, 4))


def lire_rushes(dossier, travail):
    from PIL import Image
    import numpy as np
    fiches = []
    noms = sorted(x for x in os.listdir(dossier)
                  if x.lower().endswith((".mp4", ".mov", ".m4v")) and not x.startswith("."))
    for k, n in enumerate(noms):
        f = os.path.join(dossier, n)
        if not os.path.isfile(f):
            continue                      # un sous-dossier au nom en .mp4
        p = os.path.join(travail, "apercu_%d.png" % k)
        d = duree_image(f)
        # un rush plus court qu'un bloc ne porte rien ; un rush court (moins
        # de 3,5 s) est lu en son milieu : l'image a 3 s n'existe pas toujours
        if d <= 0:
            print("   [ecarte] %s : illisible" % n); continue
        if d < BLOC_COULEURS + 0.1:
            print("   [ecarte] %s : trop court (%.1f s) pour un bloc" % (n, d)); continue
        if not apercu(f, p, T_APERCU if d >= T_APERCU + 0.5 else d / 2.0):
            print("   [ecarte] %s : illisible" % n); continue
        im = Image.open(p).convert("RGB")
        w, h = im.size
        a = np.asarray(im, dtype=np.int16)
        # fenetre sur le CORPS : on evite le mur et le sol du studio
        c = a[int(h * 0.40):int(h * 0.82), int(w * 0.34):int(w * 0.66)]
        moy = tuple(int(x) for x in c.reshape(-1, 3).mean(axis=0).round(0))
        # 07/10/2026 : la couleur du RUSH, mesuree comme captures.py — des
        # echantillons sur TOUT le rush, leur mediane (une main, un sac, un
        # hijab qui passe devant le corps ne change pas la tenue). Une seule
        # image a 3 s mettait le noir et le marron dans la meme famille.
        moy = couleur_du_rush(f, w > h, d) or moy
        # 07/10/2026 : les COUPES DEJA DANS LE RUSH (beaucoup de « rushes »
        # sont deja de petits montages), avec le meme instrument que le mode
        # --plan et que la relecture : aucun bloc ne sera pose a cheval
        coupes = coupes_du_rush(f, 0.0, d)
        fiche = {"fichier": f, "nom": n, "couche": w > h,
                 "couleur": moy, "duree": d, "apercu": p, "coupes": coupes}
        fiche["propre_max"] = max([b - a_ for a_, b in _plages(fiche)] or [0.0])
        fiches.append(fiche)
        print("   %-24s %-10s %s%s" % (n[:24], "COUCHE" if w > h else "droit", moy,
                                       ("  %d coupe(s) deja dedans, plus longue prise %.1f s"
                                        % (len(coupes), fiche["propre_max"])) if coupes else ""))
    return fiches


def _plages(c):
    """Les morceaux de film continu du rush c (entre ses coupes, a MARGE_COUPE
    de chacune, et jamais apres la fin de l'image) : [(debut, fin)]."""
    fin = c["duree"] - 0.05
    bornes = [0.0] + [x for x in (c.get("coupes") or []) if 0.0 < x < fin] + [fin]
    out = []
    for k in range(len(bornes) - 1):
        i0 = bornes[k] + (MARGE_COUPE if k > 0 else 0.0)
        i1 = bornes[k + 1] - (MARGE_COUPE if k + 2 < len(bornes) else 0.0)
        if i1 > i0:
            out.append((round(i0, 3), round(i1, 3)))
    return out


def plages_propres(c, long_bloc):
    """Ou un bloc de long_bloc peut COMMENCER dans le rush c sans traverser
    une coupe deja presente : [(debut_min, debut_max)] (`_intervalles_propres`
    du mode --plan, sur le rush entier)."""
    return [(i0, round(i1 - long_bloc, 3)) for i0, i1 in _plages(c)
            if i1 - i0 >= long_bloc - 1e-6]


def departs_propres(c, long_bloc, n=7):
    """Quelques departs repartis dans les places propres du rush, la ou on
    juge la vignette ou le visage. Rend [] si aucune place n'est propre."""
    pl = plages_propres(c, long_bloc)
    if not pl:
        return []
    out = set()
    for a_, b in pl:
        # on evite la premiere seconde quand la place le permet (comme avant)
        a2 = min(max(a_, 1.0), b) if b - a_ > 1.0 else a_
        for q in [x / float(max(1, n - 1)) for x in range(n)]:
            out.add(round(a2 + (b - a2) * q, 2))
    return sorted(x for x in out if any(a_ - 1e-6 <= x <= b + 1e-6 for a_, b in pl))


def familles(fiches):
    """Regroupe les rushes par couleur de vetement. 09/10/2026 (recette du
    vendeur, la loi du comptage de captures.py) : un rush qui ne ressemble a
    aucun autre est une couleur filmee UNE fois — sa famille est GARDEE
    (marquee « seul ») et dite, plus jamais « [JETE] ». Rend (familles, [])."""
    grp = []
    for f in sorted(fiches, key=lambda x: sum(x["couleur"])):
        pose = False
        for g in grp:
            d = math.dist(f["couleur"], g["centre"])
            if d <= ECART_FAMILLE:
                g["rushes"].append(f)
                n = len(g["rushes"])
                g["centre"] = tuple((g["centre"][k] * (n - 1) + f["couleur"][k]) / n
                                    for k in range(3))
                pose = True; break
        if not pose:
            grp.append({"centre": f["couleur"], "rushes": [f]})
    for g in grp:
        g["seul"] = len(g["rushes"]) == 1
    gardees = [g for g in grp if len(g["rushes"]) >= MINI_FAMILLE]
    jetes = [f for g in grp if len(g["rushes"]) < MINI_FAMILLE for f in g["rushes"]]
    return gardees, jetes


def vecteur_couleur(c):
    """La couleur pour les distances ENTRE FAMILLES, comme captures.py : la
    lumiere (moyenne sur cent) compte une fois, la TEINTE (part de rouge, part
    de bleu dans la somme) vingt fois. En RVB brut, la lumiere du lieu pese
    plus que le vetement : le marron d'interieur tombe dans le noir."""
    r, g, b = [float(x) for x in c]
    somme = r + g + b + 1e-6
    return ((r + g + b) / 300.0, 20.0 * r / somme, 20.0 * b / somme)


def ecart_couleur(c1, c2):
    return math.dist(vecteur_couleur(c1), vecteur_couleur(c2))


def couleur_du_rush(f, couche, d, echantillons=15):
    """LA COULEUR DU VETEMENT SUR TOUT LE RUSH (07/10/2026, la mesure de
    captures.py) : `echantillons` images reparties sur le rush (en UNE
    lecture), la fenetre du corps de chacune, et la MEDIANE (par la clarte).
    Rend (r, v, b) en entiers, ou None si rien ne se lit."""
    import numpy as np
    if d <= 0:
        return None
    l, h = 40, 72
    vf = ("transpose=2," if couche else "") + "fps=%.4f,scale=%d:%d" % (
        min(2.0, echantillons / max(0.5, d)), l, h)
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", vf, "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=1800)
        brut = r.stdout or b""
    except Exception:
        return None
    n = len(brut) // (l * h * 3)
    if n < 1:
        return None
    ims = np.frombuffer(brut[:n * l * h * 3], dtype=np.uint8).reshape(n, h, l, 3).astype("float32")
    # ni la toute premiere seconde ni la derniere : la camera demarre, la main passe
    if n > 4:
        ims = ims[1:-1]
    cs = ims[:, int(h * 0.40):int(h * 0.82), int(l * 0.34):int(l * 0.66)].reshape(len(ims), -1, 3).mean(axis=1)
    cs = sorted(cs.tolist(), key=sum)
    return tuple(int(round(x)) for x in cs[len(cs) // 2])


def familles_n(fiches, n):
    """Force EXACTEMENT n couleurs. On ne devine plus leur nombre : le produit
    le connait (quatre couleurs = quatre familles). Un seuil de distance
    faisait fondre le noir dans le marron et coupait le beige en deux — c'est
    pour ca qu'aucune des dix variantes du 17/09 n'ouvrait sur le noir.
    07/10/2026 : la distance est celle de captures.py (`ecart_couleur` : la
    teinte pese vingt fois la lumiere) et le depart « du plus eloigne » (le
    plus sombre, puis chaque fois le rush le plus loin des centres poses) :
    des centres a intervalles reguliers en RVB mettaient le noir et le marron
    ensemble et coupaient le gris en deux sur un vrai tournage."""
    pts = sorted(fiches, key=lambda x: sum(x["couleur"]))
    if n <= 1:
        return familles(fiches)
    if n >= len(pts):
        # autant de couleurs (ou plus) que de rushes : un rush PAR couleur.
        # Avant, on retombait sur le seuil, qui jette les familles d'un seul
        # rush : quatre coloris filmes une fois chacun = « aucune couleur ».
        return [{"centre": tuple(float(x) for x in f["couleur"]), "rushes": [f]}
                for f in pts], []
    centres = [[float(x) for x in pts[0]["couleur"]]]
    while len(centres) < n:
        loin = max(pts, key=lambda f: min(ecart_couleur(f["couleur"], c) for c in centres))
        centres.append([float(x) for x in loin["couleur"]])
    grp = [[] for _ in range(n)]
    for _ in range(40):
        grp = [[] for _ in range(n)]
        for f in pts:
            j = min(range(n), key=lambda j: ecart_couleur(f["couleur"], centres[j]))
            grp[j].append(f)
        neufs = []
        for j in range(n):
            if grp[j]:
                neufs.append([sum(f["couleur"][c] for f in grp[j]) / float(len(grp[j]))
                              for c in range(3)])
            else:
                neufs.append(centres[j])
        fini = all(ecart_couleur(a, b) < 0.002 for a, b in zip(centres, neufs))
        centres = neufs
        if fini:
            break
    fams = [{"centre": tuple(centres[j]), "rushes": grp[j]}
            for j in range(n) if grp[j]]
    fams.sort(key=lambda g: sum(g["centre"]))
    return fams, []


def _q(x):
    """Une longueur en nombre ENTIER d'images : c'est ce que ffmpeg ecrit."""
    return round(round(float(x) * IPS) / float(IPS), 4)


def longueurs_blocs(d, nb_couleurs, maxi=BLOCS_MAXI, entiers=False, mini=1,
                    suite=BLOC_1COULEUR, plus_long=None):
    """LA REGLE DU VENDEUR, en une liste de longueurs (secondes).
      nb_couleurs >= 2 : un bloc de 1,6 s par couleur, puis `suite` (3 s) ;
      nb_couleurs <= 1 : `suite` partout.
    entiers=False (--rushes) : on couvre d EXACTEMENT. Ce qui reste a la fin
      devient le dernier bloc s'il dure 1 s ou plus ; sinon il est absorbe
      par le bloc d'avant — si un rush porte ce bloc allonge (plus_long) ;
      sinon le bloc d'avant cede ce qu'il faut pour que le dernier dure 1 s.
      Jamais de flash. Trop de blocs : on garde les ouvertures et on ALLONGE
      la suite (la fin de la musique a son image).
    entiers=True (--plan) : des blocs entiers seulement, entre mini et maxi ;
      la musique est coupee avec un fondu a la fin du dernier."""
    ouv = nb_couleurs if nb_couleurs >= 2 else 0

    def nominale(k):
        return BLOC_COULEURS if k < ouv else suite

    longs, total = [], 0.0
    while total + nominale(len(longs)) <= d + 0.01:
        longs.append(nominale(len(longs)))
        total += longs[-1]
    if entiers:
        # JAMAIS PLUS LONG QUE LA MUSIQUE (07/10/2026) : avant, `mini` ajoutait
        # des blocs au-dela (quatre blocs de 3 s sur une musique de 7,9 s : la
        # video sortait tronquee a 7,8 s, le bloc 4 n'existait pas, et le
        # controle accusait « deux modeles »). `mini` ne sert plus qu'au
        # choix de la musique (`musiques_des_variantes`).
        return [_q(x) for x in longs[:maxi]]
    reste = d - total
    if reste >= FLASH_MAXI or (not longs and reste > 0.04):
        longs.append(reste)
    elif reste > 0.04:
        if plus_long is None or longs[-1] + reste <= plus_long:
            longs[-1] += reste
        elif longs[-1] - (FLASH_MAXI - reste) >= FLASH_MAXI - 1e-6:
            longs[-1] -= FLASH_MAXI - reste
            longs.append(FLASH_MAXI)
        elif reste > 0.3:
            longs[-1] += reste      # matiere trop courte : mieux qu'un flash
        # sinon le reste (0,3 s au plus) tombe : la video finit avec la musique
    if len(longs) > maxi:
        # trop de blocs : on garde les ouvertures et on ALLONGE la suite, les
        # images reparties a une pres. Jamais plus long que ce que deux rushes
        # portent (plus_long) : sinon on garde plus de blocs.
        o = min(ouv, maxi - 1)
        n = maxi - o
        base, plus = divmod(int(round((d - o * BLOC_COULEURS) * IPS)), n)
        if plus_long is None or (base + (1 if plus else 0)) / float(IPS) <= plus_long + 1e-6:
            longs = [BLOC_COULEURS] * o + [(base + (1 if j < plus else 0)) / float(IPS)
                                           for j in range(n)]
    longs = [_q(x) for x in longs]
    return [x for x in longs if x > 0]


def regle_texte(nb_couleurs, suite=BLOC_1COULEUR):
    if nb_couleurs >= 2:
        return "%d x %.1f s puis %.1f s" % (nb_couleurs, BLOC_COULEURS, suite)
    return "%.1f s partout (une couleur)" % suite


def depart(choix, long_bloc, i, k):
    """Ou commence la coupe dans le rush. Calcule AVANT de mesurer la couleur,
    pour que la couleur mesuree soit celle qu'on va vraiment montrer.
    Le bloc reste DANS le rush : un bloc coupe par la fin du rush decalerait
    toutes les frontieres suivantes."""
    marge = max(0.0, choix["duree"] - long_bloc - 1.0)
    deb = 1.0 + (marge * ((i * 0.37 + k * 0.11) % 1.0))
    if deb + long_bloc > choix["duree"] - 0.05:
        deb = max(0.0, choix["duree"] - long_bloc - 0.05)
    # 07/10/2026 : JAMAIS A CHEVAL SUR UNE COUPE DEJA DANS LE RUSH. Le depart
    # tombe dans une coupe : on prend la place propre la plus proche. Le rush
    # n'en a aucune pour ce bloc : `choisir_plan` passe au rush suivant de la
    # meme couleur (ce depart-ci n'est garde qu'en dernier recours, marque).
    pl = plages_propres(choix, long_bloc)
    if pl and not any(a_ - 1e-6 <= deb <= b + 1e-6 for a_, b in pl):
        deb = min((min(max(deb, a_), b) for a_, b in pl), key=lambda x: abs(x - deb))
    elif not pl and choix.get("coupes"):
        # casse du 07/10/2026 : AUCUNE place propre (un rush coupe toutes les
        # 1,5 s) et c'est le seul de sa couleur : le bloc passe a cheval (il
        # est MARQUE), mais il COMMENCE juste apres une coupe — sa premiere
        # image n'est jamais le flash du plan d'avant
        apres = [x + MARGE_COUPE for x in choix["coupes"]
                 if x + MARGE_COUPE + long_bloc <= choix["duree"] - 0.05]
        if apres:
            deb = min(apres, key=lambda x: abs(x - deb))
    return round(deb, 2)       # un arrondi de 5 ms reste dans MARGE_COUPE


def _libre(c, deb, long_bloc, deja):
    """Le bloc [deb, deb + long_bloc] du rush c ne remontre pas plus de
    REVU_MAXI d'un bloc deja pose dans la video (`deja` : nom -> [(debut, fin)])."""
    for a_, b_ in (deja or {}).get(c["nom"], []):
        if min(b_, deb + long_bloc) - max(a_, deb) > REVU_MAXI:
            return False
    return True


def depart_libre(c, long_bloc, deb, deja):
    """Le depart le plus proche de `deb`, dans une place PROPRE, qui ne
    remontre pas le film d'un bloc deja pose (07/10/2026 : en --rushes, un
    rush repris tombait sur le meme film). None si le rush n'en a plus."""
    if _libre(c, deb, long_bloc, deja):
        return deb
    libres = [x for x in departs_propres(c, long_bloc, 15) if _libre(c, x, long_bloc, deja)]
    return min(libres, key=lambda x: abs(x - deb)) if libres else None


def depart_sans_visage(choix, long_bloc, deb, juge, deja=None):
    """Le meme rush, un autre depart PROPRE ou la tete est la mieux placee
    (`rang_tete` : la tete dans le cadre, le visage vu sous la plaque), le plus
    pres possible de `deb` (07/10/2026), sans remontrer un film deja pose.
    Sans juge : `deb`. Rend (debut, rang 0 a 3) — un visage NON VU n'est
    jamais un rang 0."""
    if juge is None:
        return deb, 0
    c0 = _nv(juge(choix, deb))
    if c0 == 0:
        return deb, 0
    meilleur = (c0, 0.0, deb)
    for x in sorted((x for x in departs_propres(choix, long_bloc)
                     if _libre(choix, x, long_bloc, deja)), key=lambda x: abs(x - deb))[:6]:
        c = _nv(juge(choix, x))
        if (c, abs(x - deb)) < meilleur[:2]:
            meilleur = (c, abs(x - deb), x)
        if c == 0:
            break
    return meilleur[2], meilleur[0]


# 22/09/2026 — LE DEFAUT EST « natif ». Regle de la maison : « ne pas mettre ce genre de
# video avec floutage, les laisser a leur propre forme ».
NICHE = ""        # la sous-niche (--pov) : « hijab » change le choix des blocs
                  # (la tete dans le cadre avant la plaque) et le marquage
STYLE = "natif"   # "natif" : la video garde SA definition. Aucun flou, aucune
                  #           barre, aucun recadrage, aucune mise a l'echelle.
                  # "bande" : image entiere posee en bas, fond floute, le
                  #           texte a sa place au-dessus, jamais sur le visage
                  # "plein" : l'image remplit l'ecran, le texte passe dessus


# LE NATIF QUAND LES TAILLES DIFFERENT (06/10/2026). Un lot reel melange des
# rushes 720x1280 et 1080x1920 : concat -c copy ne recolle pas deux tailles.
# On garde la taille MAJORITAIRE du modele (a egalite : la plus grande, on ne
# perd pas de definition) et on y ramene les autres blocs en REMPLISSANT.
_TAILLES = {}


def taille_redressee(f, couche):
    """(largeur, hauteur) du rush TEL QUE LE BLOC LE MONTRE : a l'affichage,
    puis tourne d'un quart si le plan est couche (transpose)."""
    cle = (f, bool(couche))
    if cle not in _TAILLES:
        l, h = dimensions(f)
        _TAILLES[cle] = (h, l) if couche else (l, h)
    return _TAILLES[cle]


def taille_majoritaire(tailles):
    """La taille la plus frequente (un rush = une voix) ; a egalite, la plus
    grande. Paire : x264 en yuv420p refuse une largeur ou une hauteur impaire."""
    from collections import Counter
    t = [x for x in tailles if x and x[0] > 0 and x[1] > 0]
    if not t:
        return None
    l, h = max(Counter(t).items(), key=lambda kv: (kv[1], kv[0][0] * kv[0][1]))[0]
    return (l - l % 2, h - h % 2)


def filtre_remplir(cible):
    """Ramene un bloc a la taille cible en REMPLISSANT : mise a l'echelle par
    le haut puis recadrage centre. Ni flou ni barres."""
    return ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d"
            % (cible[0], cible[1], cible[0], cible[1]))


def crop_rempli(cible):
    """Le meme recadrage, exprime sur la SOURCE (pour la relecture) : on garde
    le centre a la forme de la cible, avant de reduire l'image."""
    return ("crop='min(iw,ih*%d/%d)':'min(ih,iw*%d/%d)'"
            % (cible[0], cible[1], cible[1], cible[0]))


def _taille_txt(t):
    return "%dx%d" % tuple(t) if t else ""


def _lire_taille(txt):
    try:
        l, h = [int(x) for x in str(txt).split("x")]
        return (l, h)
    except (ValueError, TypeError):
        return None


def pov_conforme(info, avec_musique):
    """Les controles du POV brule (manita.py). Sans musique la video est
    MUETTE par construction : le controle « son garde » n'a pas d'objet, les
    autres (le blanc, la plaque, la duree, le format) comptent toujours."""
    ctrl = info.get("controles") or []
    if avec_musique or not ctrl:
        return bool(info.get("conforme"))
    return all(c["ok"] for c in ctrl if c.get("controle") != "son garde")


def choisir_plan(fams, i, k, pris, dernier_nom, derniere_couleur,
                 long_bloc, travail, forcer=None, permises=None, juge=None, deja=None):
    """Le plan suivant. Deux changements du 17/09/2026 :
       - la couleur comparee est celle DU POINT DE COUPE, pas celle de 3 s ;
       - au premier bloc on peut FORCER la famille, pour que chaque variante
         ouvre sur une couleur connue d'avance.
    v0.3.8 : `permises` = les familles encore a montrer pendant l'ouverture
    (un bloc de 1,6 s PAR couleur). L'ordre de rotation ne change pas : on
    saute seulement les couleurs deja montrees.
    07/10/2026 : (1) un rush ne « porte » un bloc que s'il a une place SANS
    COUPE assez longue (`plages_propres`) : un bloc n'est jamais pose a
    cheval sur une coupe deja dans le rush, et la vignette n'est jamais le
    flash d'un autre plan ; un rush sans place propre cede au rush suivant de
    la meme couleur. (2) `juge(rush, debut)` : a combien des trois instants
    du bloc la plaque POV couvre le visage ; a regles egales, on prend un
    depart ou le visage est dessous.
    Rend (le rush, ou commencer, la couleur reelle a cet endroit)."""
    def assez_long(c):
        return c["duree"] >= long_bloc + 0.1 and bool(plages_propres(c, long_bloc))

    # UN RUSH TROP COURT NE PORTE PAS LE BLOC : il n'est pris que si AUCUN
    # rush du dossier ne le porte (une couleur aux rushes courts cede sa
    # place, au lieu de casser).
    porteurs = any(assez_long(c) for g in fams for c in g["rushes"])

    def a_cheval(c):
        """Un rush assez long, mais coupe partout : il ne porte ce bloc qu'a
        cheval sur une coupe."""
        return porteurs and not assez_long(c)

    def utilisables(g):
        # Casse du 07/10/2026 : une couleur dont AUCUN rush n'a de place
        # propre (des rushes deja montes, coupes toutes les 1,5 s) etait
        # PERDUE — l'ouverture la sautait et remontrait une autre couleur
        # deux fois de suite. Ses rushes restent alors utilisables, mais en
        # SECOURS seulement (`a_cheval`, plus bas) : le bloc est marque, comme
        # en --plan (« un bloc de 1,6 s ne passe a cheval que si sa COULEUR
        # n'a aucune place sans coupe »).
        if porteurs:
            return ([c for c in g["rushes"] if assez_long(c)]
                    or [c for c in g["rushes"] if c["duree"] >= long_bloc + 0.1])
        return [c for c in g["rushes"] if c["duree"] >= long_bloc + 0.1] or list(g["rushes"])

    # la VIGNETTE (premier bloc) n'est jamais posee a cheval : une couleur
    # sans place propre n'ouvre pas la variante, elle vient plus loin
    if forcer is not None and (not utilisables(fams[forcer])
                               or any(a_cheval(c) for c in utilisables(fams[forcer]))):
        forcer = None

    def classe(c, deb):
        """Le rang de la tete (`rang_tete`) : 0 a 3, plus petit = mieux."""
        return 0 if juge is None else _nv(juge(c, deb))

    # PREMIER BLOC : c'est lui qui donne la VIGNETTE. Parmi les rushes de la
    # couleur imposee, on prend celui ou le MODELE EST LE PLUS ENTIER dans le
    # cadre — jamais le premier venu.
    if forcer is not None:
        g = fams[forcer]
        cands = []
        longs_ok = utilisables(g)
        # LES DEUX FAUTES DU 21/09/2026, toutes les deux « on ne juge pas la
        # ou on controle » :
        #  1. on mesurait le MILIEU du bloc alors que la vignette, c'est la
        #     PREMIERE image de la video. Entre les deux, le modele a bouge ;
        #  2. une famille qui n'a qu'UN SEUL rush n'avait qu'UN SEUL depart :
        #     aucun choix, la vignette etait tiree au sort. On essaie
        #     maintenant plusieurs instants DANS le meme rush.
        # 07/10/2026 : ces instants sont pris dans les places SANS COUPE.
        for rang, c in enumerate(longs_ok):
            if c["nom"] == dernier_nom:
                continue
            departs = departs_propres(c, long_bloc)
            if not departs:
                marge = max(0.0, c["duree"] - long_bloc - 1.0)
                departs = sorted(set(min(round(1.0 + marge * p, 2),
                                         max(0.0, round(c["duree"] - long_bloc - 0.05, 2)))
                                     for p in (0.0, 0.15, 0.30, 0.45, 0.60, 0.75, 0.90)))
            if not departs:
                departs = [depart(c, long_bloc, i, k)]
            for deb in departs:
                cad = sujet_en_haut(c["fichier"], deb + 0.15,
                                    c["couche"], travail)
                cands.append((cad, len(cands), rang, c, deb))
        if cands:
            cands.sort(key=lambda x: (x[0], x[1]))   # jamais de dict compare
            # la tete : parmi les huit vignettes les plus entieres, celle ou
            # la tete est la mieux placee (dans le cadre, le visage VU sous la
            # plaque ; un visage non vu n'est jamais « hors de la plaque »)
            tete = cands[:8]
            choix_v = min(tete, key=lambda x: (classe(x[3], x[4]), x[1])) if juge else None
            cad, _n, _r, c, deb = choix_v or cands[0]
            return c, deb, (couleur_a(c["fichier"], deb + long_bloc / 2.0,
                                      c["couche"], travail) or c["couleur"])

    ordre = [forcer] if forcer is not None else list(range(len(fams)))
    if permises is not None and forcer is None:
        permises = [j for j in permises if 0 <= j < len(fams)] or None
    secours, ecart_max = None, -1.0
    sur_visage = None                     # passe l'ecart, mais la tete est mal placee
    cheval = None                         # passe l'ecart, mais a cheval sur une coupe
    revu = None                           # le rush n'a plus de place sans film revu
    for tour in range(2):                 # 1er tour sans reprise, 2e avec
        for jj in range(len(ordre)):
            fj = ordre[(i + k + jj) % len(ordre)]
            if permises is not None and forcer is None and fj not in permises:
                continue
            g = fams[fj]
            longs_ok = utilisables(g)
            for essai in range(len(longs_ok)):
                c = longs_ok[(i + k + essai) % len(longs_ok)]
                if c["nom"] == dernier_nom:
                    continue
                if tour == 0 and c["nom"] in pris:
                    continue
                if a_cheval(c):
                    # une couleur sans place propre : en secours seulement
                    # (avant une couleur repetee, apres tout bloc propre)
                    if cheval is None:
                        deb = depart(c, long_bloc, i, k)
                        vraie = couleur_a(c["fichier"], deb + long_bloc / 2.0,
                                          c["couche"], travail) or c["couleur"]
                        if derniere_couleur is None or \
                                math.dist(vraie, derniere_couleur) >= SEUIL_VOISIN:
                            cheval = (c, deb, vraie)
                    continue
                d0_ = depart(c, long_bloc, i, k)
                libre = depart_libre(c, long_bloc, d0_, deja)
                if libre is None:
                    # 07/10/2026 : plus aucune place de ce rush sans remontrer
                    # un film deja pose : en dernier recours seulement (MARQUE
                    # « film revu » au rapport)
                    if revu is None:
                        revu = (c, d0_, couleur_a(c["fichier"], d0_ + long_bloc / 2.0,
                                                  c["couche"], travail) or c["couleur"])
                    continue
                deb, cl = depart_sans_visage(c, long_bloc, libre, juge, deja)
                vraie = couleur_a(c["fichier"], deb + long_bloc / 2.0,
                                  c["couche"], travail) or c["couleur"]
                d = 999.0 if derniere_couleur is None else math.dist(
                    vraie, derniere_couleur)
                if d >= SEUIL_VOISIN:
                    if cl <= 1:
                        return c, deb, vraie
                    # la tete mal placee (plaque sur le visage, visage non
                    # vu, tete hors du cadre) : le moins mauvais est garde
                    if sur_visage is None or cl < sur_visage[3]:
                        sur_visage = (c, deb, vraie, cl)
                    continue
                if d > ecart_max:
                    secours, ecart_max = (c, deb, vraie), d
        if secours is not None and tour == 0 and ecart_max >= SEUIL_VOISIN:
            return secours
    if sur_visage is not None:
        return sur_visage[:3]
    if cheval is not None:
        return cheval
    if secours is not None and (revu is None or ecart_max >= SEUIL_RELU + 4):
        return secours
    if revu is not None:
        return revu
    if secours is not None:
        return secours
    # dernier recours : un rush qui PORTE le bloc, d'abord dans les couleurs
    # permises, autre que le precedent si possible
    fj = permises[0] if (permises is not None and forcer is None) \
        else ordre[(i + k) % len(ordre)]
    tous = sorted((c for g in fams for c in utilisables(g)), key=a_cheval) \
        or fams[fj]["rushes"]                 # les rushes propres d'abord
    ici = [c for c in utilisables(fams[fj]) if c["nom"] != dernier_nom]
    c = (ici or [x for x in tous if x["nom"] != dernier_nom] or tous)[0]
    deb = depart(c, long_bloc, i, k)
    return c, deb, (couleur_a(c["fichier"], deb + long_bloc / 2.0,
                              c["couche"], travail) or c["couleur"])


def traverse_une_coupe(c, debut, long_bloc):
    """Le bloc [debut, debut + long_bloc] du rush c passe-t-il sur une coupe
    deja presente dans le rush ?"""
    return any(debut - 1e-6 < x < debut + long_bloc + 1e-6 for x in (c.get("coupes") or []))


def controler_couleurs(video, longueurs):
    """On RELIT la couleur dans la video ECRITE, un point au MILIEU DE CHAQUE
    BLOC — pas a intervalles egaux : le dernier bloc est raccourci pour finir
    avec la musique, et un echantillonnage regulier tomberait a cote."""
    from PIL import Image
    import numpy as np
    d = duree(video)
    if d <= 0 or len(longueurs) < 2:
        return []
    bornes, cumul = [], 0.0
    for L in longueurs:
        bornes.append(cumul + L / 2.0)
        cumul += L
    rep = tempfile.mkdtemp(prefix="coul_")
    try:
        cs = []
        for k, t in enumerate(bornes):
            t = min(t, max(0.0, d - 0.05))
            p = os.path.join(rep, "c%d.png" % k)
            lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % t, "-i", video,
                    "-frames:v", "1", "-vf", "scale=120:-1", p, "-y"], 90)
            if not os.path.isfile(p):
                return []
            im = np.asarray(Image.open(p).convert("RGB"), dtype=np.int16)
            h, w, _ = im.shape
            c = im[int(h * 0.45):int(h * 0.80), int(w * 0.32):int(w * 0.68)]
            cs.append(tuple(float(x) for x in c.reshape(-1, 3).mean(axis=0)))
        return [k + 1 for k in range(1, len(cs))
                if math.dist(cs[k], cs[k - 1]) < SEUIL_RELU]
    finally:
        shutil.rmtree(rep, ignore_errors=True)


def _images_video(video, l=36, h=64):
    """TOUTES les images de la video, toutes petites, en nombres."""
    import numpy as np
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf",
                            "fps=%d,scale=%d:%d" % (IPS, l, h), "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=600)
    except Exception:
        return None
    taille = l * h * 3
    n = len(r.stdout or b"") // taille
    if r.returncode != 0 or n < 3:
        return None
    return np.frombuffer(r.stdout[:n * taille], dtype=np.uint8) \
             .reshape(n, h, l, 3).astype("float32")


def _coupes_des_sauts(sauts):
    """Les COUPES d'une suite d'images, a partir du saut de chacune a la
    suivante (sauts[0] = 0). Une coupe est un pic au-dessus de SEUIL_COUPE,
    de trois fois le mouvement ordinaire ET de trois fois le mouvement juste
    autour de lui. Rend (indices des images qui ouvrent un plan, seuil,
    mouvement). Sert a la relecture d'une video ecrite (`mesurer_rythme`) et,
    depuis le 06/10/2026, aux coupes deja presentes dans un rush
    (`coupes_du_rush`) : le MEME instrument des deux cotes."""
    import numpy as np
    mouvement = float(np.median(sauts[1:])) if len(sauts) > 1 else 0.0
    seuil = max(SEUIL_COUPE, FACTEUR_COUPE * mouvement)

    def fond(k):
        # le mouvement AUTOUR de l'image (sans elle ni ses deux voisines) :
        # un plan qui bouge vite fait des sauts de 6 ou 7 a la suite, une
        # coupe fait UN saut, isole, bien au-dessus (vu sur de vrais rushes)
        autour = np.concatenate([sauts[max(1, k - 6):max(1, k - 1)],
                                 sauts[k + 2:k + 7]])
        return float(np.median(autour)) if len(autour) else 0.0

    pics = [k for k in range(1, len(sauts))
            if sauts[k] >= seuil and sauts[k] >= sauts[k - 1]
            and (k + 1 >= len(sauts) or sauts[k] >= sauts[k + 1])
            and sauts[k] >= FACTEUR_COUPE * fond(k)]
    coupes = []                        # deux pics colles = une seule coupe
    for k in pics:
        if coupes and k - coupes[-1] <= 2:
            if sauts[k] > sauts[coupes[-1]]:
                coupes[-1] = k
            continue
        coupes.append(k)
    return coupes, seuil, mouvement


def mesurer_rythme(video, longueurs):
    """LA REGLE RELUE SUR LE FICHIER ECRIT, jamais « par construction ».
    On decode toutes les images et on mesure le saut de chacune a la suivante.
    Une COUPE est un saut net : un pic au-dessus de SEUIL_COUPE, de trois
    fois le mouvement ordinaire de la video ET de trois fois le mouvement
    juste autour de lui (un plan qui bouge vite n'est pas une coupe). Il faut :
      - une coupe a chaque frontiere voulue, a TOL_FRONTIERE pres ;
      - AUCUNE autre coupe : une coupe au milieu d'un bloc veut dire que ce
        bloc montre deux plans (deux couleurs, ou deux modeles) ;
      - un dernier bloc d'au moins FLASH_MAXI.
    LIMITE : deux plans voisins presque identiques (meme decor, meme pose)
    font une coupe invisible ; la frontiere est alors « non relue »."""
    import numpy as np
    voulues, c = [], 0.0
    for L in longueurs[:-1]:
        c += L
        voulues.append(round(c, 3))
    rep = {"lu": False, "ok": False, "frontieres_voulues": voulues,
           "frontieres_relues": [], "coupes_en_trop": [], "ecart_max": None,
           "duree_lue": None, "dernier_bloc": None}
    ims = _images_video(video)
    if ims is None:
        return rep
    sauts = np.zeros(len(ims))
    sauts[1:] = np.abs(ims[1:] - ims[:-1]).mean(axis=(1, 2, 3))
    coupes, seuil, mouvement = _coupes_des_sauts(sauts)
    temps = [k / float(IPS) for k in coupes]
    relues, prises = [], set()
    for t in voulues:
        proches = [x for x in temps if abs(x - t) <= TOL_FRONTIERE + 1e-6]
        if proches:
            x = min(proches, key=lambda x: abs(x - t))
            relues.append(round(x, 3)); prises.add(x)
        else:
            relues.append(None)
    en_trop = [round(x, 3) for x in temps
               if x not in prises and all(abs(x - t) > TOL_FRONTIERE + 1e-6
                                          for t in voulues)]
    duree_lue = len(ims) / float(IPS)
    derniere = relues[-1] if relues and relues[-1] is not None else \
        (voulues[-1] if voulues else 0.0)
    ecarts = [abs(r - v) for r, v in zip(relues, voulues) if r is not None]
    rep.update({"lu": True, "seuil": round(seuil, 1),
                "mouvement": round(mouvement, 2),
                "frontieres_relues": relues, "coupes_en_trop": en_trop,
                "ecart_max": round(max(ecarts), 3) if ecarts else 0.0,
                "duree_lue": round(duree_lue, 3),
                "dernier_bloc": round(duree_lue - derniere, 3)})
    rep["ok"] = bool(all(r is not None for r in relues) and not en_trop
                     and rep["dernier_bloc"] >= FLASH_MAXI - 0.5 / IPS)
    return rep


def regle_respectee(longueurs, nb_couleurs, suite=BLOC_1COULEUR):
    """Les longueurs ECRITES suivent-elles la regle ? (ouvertures a 1,6 s,
    une par couleur, puis `suite` ; le dernier bloc peut differer, jamais un
    flash). Rend la liste des fautes."""
    fautes = []
    ouv = nb_couleurs if nb_couleurs >= 2 else 0
    n = len(longueurs)
    # le bloc d'avant a pu ceder pour que le dernier dure juste une seconde
    cede = n >= 2 and abs(longueurs[-1] - FLASH_MAXI) <= 0.5 / IPS
    for k, L in enumerate(longueurs[:-1]):
        attendu = BLOC_COULEURS if k < ouv else suite
        if k == n - 2 and cede and L < attendu:
            continue
        if abs(L - attendu) > 0.5 / IPS and not (len(longueurs) >= BLOCS_MAXI
                                                  and k >= ouv and L > suite):
            fautes.append("bloc %d : %.2f s au lieu de %.1f s" % (k + 1, L, attendu))
    if longueurs and longueurs[-1] < FLASH_MAXI - 0.5 / IPS and len(longueurs) > 1:
        fautes.append("dernier bloc : %.2f s, un flash" % longueurs[-1])
    return fautes


def _rythme_court(r):
    """Le rythme relu, en une ligne."""
    if not r.get("lu"):
        return "video illisible"
    rel = r["frontieres_relues"]
    txt = "frontieres relues %d/%d" % (sum(1 for x in rel if x is not None), len(rel))
    manque = [v for v, x in zip(r["frontieres_voulues"], rel) if x is None]
    if manque:
        txt += ", non vues a %s s" % ", ".join("%.2f" % v for v in manque[:4])
    if r["coupes_en_trop"]:
        txt += ", coupes en trop a %s s" % ", ".join("%.2f" % v for v in r["coupes_en_trop"][:4])
    txt += ", dernier bloc %.2f s" % (r["dernier_bloc"] or 0.0)
    return txt


def bloc(f, couche, debut, dest, longueur=BLOC_1COULEUR, cible=None):
    """UN bloc : redresse si besoin, puis mis au format de la pub.
    v0.3.8 : le bloc a EXACTEMENT round(longueur x 30) images et commence a
    zero (setpts). Avec `-t`, ffmpeg perdait une image par bloc des que la
    coupe tombait entre deux images du rush : les frontieres derivaient.
    cible (natif) : la taille majoritaire du modele ; un rush d'une autre
    taille est ramene a elle en REMPLISSANT (jamais de flou ni de barres)."""
    rot = "transpose=2," if couche else ""
    images = max(1, int(round(float(longueur) * IPS)))
    if STYLE == "natif":
        # AUCUN pad, AUCUN boxblur : la video sort dans la definition du rush.
        # `fps` et `setsar` sont la UNIQUEMENT pour que les blocs se recollent
        # (concat refuse des cadences ou des pixels differents). Seul un rush
        # d'une AUTRE taille que la majorite est mis a l'echelle et recadre.
        remplir = ""
        if cible and taille_redressee(f, couche) != tuple(cible):
            remplir = filtre_remplir(cible) + ","
        filtre = ["-vf", "setpts=PTS-STARTPTS,%s%ssetsar=1,fps=%d" % (rot, remplir, IPS)]
    elif STYLE == "plein":
        filtre = ["-vf", "setpts=PTS-STARTPTS,%sscale=%d:%d:force_original_aspect_ratio=decrease,"
                  "pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=%d"
                  % (rot, LARGEUR, HAUTEUR, LARGEUR, HAUTEUR, IPS)]
    else:
        fc = ("[0:v]setpts=PTS-STARTPTS,%ssplit[bg][s];"
              "[s]scale=%d:%d:force_original_aspect_ratio=decrease[f];"
              "[bg]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
              "boxblur=%d:2[b];"
              "[b][f]overlay=(W-w)/2:H-h-%d,setsar=1,fps=%d[v]"
              % (rot, IMG_L, IMG_H, LARGEUR, HAUTEUR, LARGEUR, HAUTEUR, FLOU,
                 MARGE_BAS, IPS))
        filtre = ["-filter_complex", fc, "-map", "[v]"]
    r = lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % debut, "-i", f]
               + filtre + ["-frames:v", str(images), "-an",
                           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                           "-pix_fmt", "yuv420p", dest, "-y"], 300)
    if r.returncode != 0 or not os.path.isfile(dest):
        raise RuntimeError(r.stderr.strip()[:200] or "bloc refuse")
    # un rush trop court donne un bloc trop court, et TOUTES les frontieres
    # suivantes glissent : on refuse plutot que de livrer un rythme faux
    if duree(dest) < images / float(IPS) - 0.5 / IPS:
        raise RuntimeError("%s ne porte pas un bloc de %.2f s a %.2f s"
                           % (os.path.basename(f), longueur, debut))
    return dest


def planche(video, dest, titre):
    """La preuve qu'on REGARDE : huit images de la variante, cote a cote."""
    from PIL import Image, ImageDraw
    d = duree(video)
    rep = tempfile.mkdtemp(prefix="planche_")
    ims = []
    try:
        for k in range(8):
            t = d * (k + 0.5) / 8.0
            p = os.path.join(rep, "f%d.png" % k)
            lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % t, "-i", video,
                    "-frames:v", "1", "-vf", "scale=150:-1", p, "-y"], 90)
            if not os.path.isfile(p):
                continue
            im = Image.open(p).convert("RGB")
            dr = ImageDraw.Draw(im)
            dr.rectangle([0, 0, im.size[0], 14], fill=(0, 0, 0))
            dr.text((3, 2), "%.1f s" % t, fill=(255, 255, 0))
            ims.append(im)
        if not ims:
            return None
        w, h = ims[0].size
        pl = Image.new("RGB", (4 * (w + 4), 2 * (h + 4) + 18), (20, 20, 20))
        dr = ImageDraw.Draw(pl); dr.text((4, 4), titre, fill=(255, 255, 0))
        for i, im in enumerate(ims):
            pl.paste(im, ((i % 4) * (w + 4) + 2, 18 + (i // 4) * (h + 4) + 2))
        pl.save(dest)
        return dest
    finally:
        shutil.rmtree(rep, ignore_errors=True)


MUSIQUE_MIN_S = 12.0     # une musique de 12 s OU MOINS est ecartee AVANT le
                         # montage (08/10/2026) : elle faisait une video trop
                         # courte pour une pub


def musiques(dossier):
    if not dossier or not os.path.isdir(dossier):
        return []
    # les memes extensions que le bureau compte (.ogg compris) : sinon il
    # passait --musiques et les videos sortaient sans son
    tous = sorted(os.path.join(dossier, f) for f in os.listdir(dossier)
                  if f.lower().endswith((".mp3", ".m4a", ".wav", ".aac", ".ogg"))
                  and not f.startswith(".") and os.path.isfile(os.path.join(dossier, f)))
    # LES MUSIQUES COURTES SONT ECARTEES, ET DITES : chaque fichier est mesure ;
    # un fichier illisible (duree 0) est ecarte lui aussi
    gardees, courtes = [], []
    for f in tous:
        try:
            d = duree(f)
        except Exception:
            d = 0.0
        (gardees if d > MUSIQUE_MIN_S else courtes).append((f, d))
    if courtes:
        print("   [A SAVOIR] %d musique(s) de %d s ou moins ecartee(s) (ou "
              "illisible(s)) : %s" % (len(courtes), int(MUSIQUE_MIN_S),
                                      ", ".join("%s (%.1f s)" % (os.path.basename(f), d)
                                                for f, d in courtes[:8])))
        if not gardees:
            print("   [A SAVOIR] aucune musique de plus de %d s : les videos "
                  "sortent sans musique" % int(MUSIQUE_MIN_S))
    return [f for f, _ in gardees]


# ====================================================================
#            MODE « UN SEUL MODELE » — ajoute le 22/09/2026
# ====================================================================
# Tout ce qui suit sert a ne JAMAIS remettre deux modeles dans une video.


def dimensions(f):
    """(largeur, hauteur) A L'AFFICHAGE. Un telephone ecrit souvent l'image
    couchee avec une etiquette de rotation ; ffmpeg la redresse en decodant.
    Sans compter l'etiquette, un rush droit passait pour « couche » et sortait
    tourne une deuxieme fois (mode --plan)."""
    r = lancer(["ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_streams", "-of", "json", f], 60)
    try:
        s = json.loads(r.stdout or "{}")["streams"][0]
        l, h = int(s["width"]), int(s["height"])
    except Exception:
        return 0, 0
    rot = 0.0
    try:
        rot = float((s.get("tags") or {}).get("rotate", 0) or 0)
    except (TypeError, ValueError):
        pass
    for sd in s.get("side_data_list") or []:
        try:
            if "rotation" in sd:
                rot = float(sd["rotation"])
        except (TypeError, ValueError):
            pass
    if int(round(abs(rot))) % 180 == 90:
        l, h = h, l
    return l, h


def lire_plan(chemin):
    """Le PLAN dit quel SEGMENT de quel rush appartient a quel MODELE.
    C'est la seule chose qui sait qu'un lot porte plusieurs modeles ;
    l'outil ne le devine pas, et ne le devinera jamais a partir de la
    couleur du vetement — c'est exactement la faute du 21/09/2026."""
    p = _lire_json(chemin)
    if "modeles" not in p or not p["modeles"]:
        raise RuntimeError("plan sans modeles")
    for m in p["modeles"]:
        if not m.get("segments"):
            raise RuntimeError("modele « %s » sans segment" % m.get("nom"))
    # LE CHEMIN DES RUSHES SUIT LE PLAN. Une machine voit
    # /Users/<nom>/Movies/... ; une autre machine voit le meme dossier
    # ailleurs. On cherche donc le dossier des rushes A COTE DU PLAN avant
    # de croire le chemin ecrit dedans : sinon l'outil ne tourne que sur une
    # seule machine, et c'est justement ce qu'on ne veut pas.
    base = os.path.dirname(os.path.abspath(chemin))
    r = p.get("rushes") or ""
    # v0.3.8 (06/10/2026) : le plan d'un LOT du bureau vit dans
    # <lot>/separation/plan.json et ses rushes dans <lot>/rushes — un etage
    # plus haut. Une maison deplacee (autre dossier, autre PC) les retrouve
    # aussi. Le nom est lu en / ET en \ : un plan ecrit sous Windows.
    import re
    nom_r =re.split(r"[/\\]", r.rstrip("/\\"))[-1] if r else ""
    for cote in (os.path.join(base, nom_r), os.path.join(os.path.dirname(base), nom_r)):
        if os.path.isdir(r) or not nom_r:
            break
        if os.path.isdir(cote):
            r = cote
    if not os.path.isdir(r):
        raise RuntimeError("dossier des rushes introuvable : %s" % (p.get("rushes"),))
    p["rushes"] = os.path.abspath(r)
    _nettoyer_plan(p)
    return p


def _nom_rush(x):
    """Le nom d'un rush tel qu'on le compare : un accent s'ecrit de deux
    facons (Mac / Windows), et un plan ecrit sous Windows met des « \\ »."""
    import unicodedata
    return unicodedata.normalize("NFC", str(x or "").replace("\\", "/"))


def _cle_rush(dossier, nom, memo=None):
    """LE MEME FICHIER, quel que soit le nom qui le donne (casse du
    07/10/2026, la meme regle que separer.cle_fichier) : « Video.MP4 » et
    « video.mp4 » sur un disque Mac ou Windows, « ./video.mp4 », un accent
    compose ou non, un lien. Par son numero sur le disque ; un rush absent
    garde son nom (compare tel quel). Rend (cle, trouve)."""
    import unicodedata
    n = _nom_rush(nom)
    if memo is not None and n in memo:
        return memo[n]
    res = (n, False)
    for x in (n, unicodedata.normalize("NFD", n)):
        try:
            st = os.stat(os.path.join(dossier or "", x))
        except (OSError, ValueError):
            continue
        res = (("%d:%d" % (st.st_dev, st.st_ino)) if st.st_ino else
               unicodedata.normalize("NFC", os.path.normcase(os.path.realpath(
                   os.path.join(dossier or "", x)))), True)
        break
    if memo is not None:
        memo[n] = res
    return res


def _bornes(s):
    """(de, a) d'un segment, ou None s'il est illisible (il sera refuse
    plus loin, s'il appartient au modele qu'on monte)."""
    try:
        de, a = float(s["de"]), float(s["a"])
    except (TypeError, ValueError, KeyError):
        return None
    return (de, a) if a > de else None


def soustraire(s, trous):
    """Les morceaux d'un segment {de, a} qui restent hors des `trous` [(de, a)]
    (la meme regle que separer.soustraire)."""
    morceaux = [(float(s["de"]), float(s["a"]))]
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


def _nettoyer_plan(p):
    """LES EXCLUSIONS ET LES BORDS DISPUTES (07/10/2026), comme
    separer.lire_plan. Avant, ce lire_plan ne lisait jamais « exclusions » :
    un tronçon exclu (« deux modeles a la fois ») entrait dans le montage, et
    le controle, qui compare un bloc a sa source declaree, l'acceptait.
      - un instant exclu est RETIRE du segment du meme rush ;
      - un bord dispute entre deux modeles (CHEVAUCHE_TOLERE au plus) est
        retire aux DEUX : il ne va a personne ;
      - au-dela, le meme instant est donne a deux modeles : REFUS.
    Le meme rush, c'est le meme FICHIER (`_cle_rush`), pas le meme nom ecrit
    (casse du 07/10/2026 : « Clip 3.MP4 » dans les exclusions et
    « clip 3.mp4 » dans le segment, l'exclusion etait ignoree sans un
    mot). Une exclusion qui nomme un rush absent est DITE, pas tue.
    Ecrit dans le plan : exclusions (lues), disputes, avertissements."""
    memo = {}

    def cle(nom):
        return _cle_rush(p.get("rushes"), nom, memo)[0]

    trous, disputes, refus, avert = {}, [], [], []
    exclusions = []
    for e in (p.get("exclusions") if isinstance(p.get("exclusions"), list) else []):
        if not isinstance(e, dict) or not e.get("rush") or not _bornes(e):
            avert.append("exclusion illisible, ignoree : %s" % (e,))
            continue
        de, a = _bornes(e)
        if not _cle_rush(p.get("rushes"), e["rush"], memo)[1]:
            avert.append("exclusion ignoree : %s n'est pas dans le dossier des rushes"
                         % e["rush"])
        exclusions.append({"rush": str(e["rush"]), "de": round(de, 3), "a": round(a, 3),
                           "pourquoi": str(e.get("pourquoi") or "")})
    mods = p["modeles"]
    for i in range(len(mods)):
        for j in range(i + 1, len(mods)):
            for sa in mods[i]["segments"]:
                for sb in mods[j]["segments"]:
                    ba, bb = _bornes(sa), _bornes(sb)
                    if not ba or not bb or cle(sa.get("rush")) != cle(sb.get("rush")):
                        continue
                    lo, hi = max(ba[0], bb[0]), min(ba[1], bb[1])
                    if hi - lo <= 1e-3:
                        continue
                    if hi - lo > CHEVAUCHE_TOLERE + 1e-6:
                        refus.append("%s : de %.2f a %.2f s donne a deux modeles (%s et %s)"
                                     % (sa["rush"], lo, hi, mods[i].get("nom"), mods[j].get("nom")))
                    else:
                        trous.setdefault(cle(sa["rush"]), []).append((lo, hi))
                        disputes.append({"rush": str(sa["rush"]), "de": round(lo, 3),
                                         "a": round(hi, 3),
                                         "entre": [mods[i].get("nom"), mods[j].get("nom")]})
                        avert.append("%s : %.2f-%.2f s dispute entre %s et %s, retire aux deux"
                                     % (sa["rush"], lo, hi, mods[i].get("nom"), mods[j].get("nom")))
    if refus:
        raise RuntimeError("plan refuse (jamais un instant a deux modeles) : "
                           + " ; ".join(refus[:4]))
    for e in exclusions:
        trous.setdefault(cle(e["rush"]), []).append((e["de"], e["a"]))
    for m in mods:
        reste = []
        for s in m["segments"]:
            bs = _bornes(s)
            if not bs:
                reste.append(s)       # illisible : refuse au montage de CE modele
                continue
            k = cle(s.get("rush"))
            morceaux = soustraire(s, trous.get(k, []))
            perdu = (bs[1] - bs[0]) - sum(x["a"] - x["de"] for x in morceaux)
            if perdu > 1e-3 and any(cle(e["rush"]) == k
                                    and min(bs[1], e["a"]) - max(bs[0], e["de"]) > 1e-3
                                    for e in exclusions):
                avert.append("%s : %.2f s exclues retirees de %s (%.2f-%.2f s)"
                             % (s["rush"], perdu, m.get("nom"), bs[0], bs[1]))
            reste += [x for x in morceaux if x["a"] - x["de"] > 1e-3]
        if m["segments"] and not reste:
            avert.append("modele « %s » : tout ce qui lui est donne est exclu ou dispute"
                         % m.get("nom"))
        m["segments"] = reste
    p["exclusions"] = exclusions
    p["disputes"] = disputes
    p["avertissements"] = avert
    return p


def zones_interdites(plan, rush):
    """Les exclusions et les bords disputes du plan sur CE rush (le meme
    FICHIER, `_cle_rush`) : [(de, a, pourquoi)]."""
    memo = {}
    n = _cle_rush(plan.get("rushes"), rush, memo)[0]
    z = [(e["de"], e["a"], "exclusion du plan%s" % (" (%s)" % e["pourquoi"] if e.get("pourquoi") else ""))
         for e in plan.get("exclusions") or []
         if _cle_rush(plan.get("rushes"), e.get("rush"), memo)[0] == n]
    z += [(d["de"], d["a"], "bord dispute entre %s" % " et ".join(str(x) for x in d.get("entre") or []))
          for d in plan.get("disputes") or []
          if _cle_rush(plan.get("rushes"), d.get("rush"), memo)[0] == n]
    return z


def trouver_plan(ecrit, dossier):
    """Retrouve le plan meme si le rapport a ete ecrit sur une autre machine :
    on essaie le chemin ecrit, puis le meme NOM a cote du dossier livre."""
    if ecrit and os.path.isfile(ecrit):
        return ecrit
    nom = os.path.basename(ecrit or "")
    d = os.path.abspath(dossier)
    for _ in range(4):
        c = os.path.join(d, nom)
        if nom and os.path.isfile(c):
            return c
        d = os.path.dirname(d)
    raise RuntimeError("plan introuvable : %s" % ecrit)


_COUPES_RUSH = {}


def coupes_du_rush(f, de, a):
    """LES COUPES DEJA PRESENTES DANS LE RUSH, entre de et a (06/10/2026).
    Beaucoup de « rushes » d'un vendeur sont deja des petits montages : une
    prise de 6,8 s y porte une coupe a 3,57 s, une autre en porte huit. Un
    bloc de 3 s pose a cheval montre DEUX plans (dont un flash de quelques
    dixiemes), et la relecture du rythme le voit (« coupes en trop »). On les
    trouve ici avec le MEME instrument que la relecture (`_coupes_des_sauts`,
    images toutes petites, 30 par seconde) : les blocs les evitent ensuite.
    Rend les instants (secondes du rush), a MARGE_COUPE des bords."""
    import numpy as np
    cle = (f, round(float(de), 2), round(float(a), 2))
    if cle in _COUPES_RUSH:
        return _COUPES_RUSH[cle]
    l, h = 36, 64
    taille = l * h * 3
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", "%.3f" % de, "-i", f,
                            "-t", "%.3f" % (a - de), "-vf",
                            "fps=%d,scale=%d:%d" % (IPS, l, h), "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=1800)
        brut = r.stdout or b""
    except Exception:
        brut = b""
    n = len(brut) // taille
    if n < 3:
        _COUPES_RUSH[cle] = []
        return []
    ims = np.frombuffer(brut[:n * taille], dtype=np.uint8).reshape(n, taille)
    sauts = np.zeros(n)
    for k0 in range(1, n, 2000):       # par paquets : un rush de dix minutes
        k1 = min(n, k0 + 2000)         # ne remplit pas la memoire
        sauts[k0:k1] = np.abs(ims[k0:k1].astype(np.int16)
                              - ims[k0 - 1:k1 - 1].astype(np.int16)).mean(axis=1)
    coupes, _s, _m = _coupes_des_sauts(sauts)
    t = [round(de + k / float(IPS), 3) for k in coupes]
    t = [x for x in t if de + MARGE_COUPE < x < a - MARGE_COUPE]
    _COUPES_RUSH[cle] = t
    return t


def _morceaux(de, a, coupes, bloc_mini):
    """Le segment [de, a] coupe aux COUPES DU RUSH, a MARGE_COUPE de chacune.
    Un morceau trop court pour porter un bloc est RECOLLE a son voisin (sa
    matiere reste, comme un groupe de couleur trop court) : sa coupe devient
    INTERNE au morceau, et les blocs l'evitent s'ils le peuvent
    (`_intervalles_propres`). Rend [[debut, fin, [coupes internes]]]."""
    bornes = [de] + list(coupes) + [a]
    ms = []
    for k in range(len(bornes) - 1):
        ms.append([bornes[k] + (MARGE_COUPE if k > 0 else 0.0),
                   bornes[k + 1] - (MARGE_COUPE if k + 2 < len(bornes) else 0.0),
                   [], bornes[k]])
    fusion = []
    for m in ms:
        if fusion and (m[1] - m[0]) < bloc_mini:
            fusion[-1][2] = fusion[-1][2] + [m[3]] + m[2]
            fusion[-1][1] = m[1]
        else:
            fusion.append(m)
    while len(fusion) > 1 and (fusion[0][1] - fusion[0][0]) < bloc_mini:
        fusion[1][2] = fusion[0][2] + [fusion[1][3]] + fusion[1][2]
        fusion[1][0], fusion[1][3] = fusion[0][0], fusion[0][3]
        fusion.pop(0)
    return [[m0, m1, internes] for m0, m1, internes, _b in fusion]


def sous_segments(segments, dossier, travail, bloc_mini, rapport=None):
    """Coupe les segments du modele en SOUS-SEGMENTS DE COULEUR.
    On ne sort JAMAIS des segments donnes par le plan : on ne fait que les
    subdiviser. Le decoupage d'origine etiquette les couleurs a gros pas
    (jusqu'a 3 s) et se trompe sur les rushes rapides ; on relit donc la
    couleur nous-memes, la ou on va vraiment couper.
    06/10/2026 : d'abord aux COUPES DEJA DANS LE RUSH (`coupes_du_rush`) — un
    sous-segment ne traverse plus une coupe, sauf un morceau trop court
    recolle a son voisin (sa coupe est alors notee dans « coupes »). Chaque
    sous-segment porte sa « prise » : le morceau de film continu d'ou il
    vient. rapport (dict) : recoit les coupes trouvees, [(rush, instant)]."""
    out = []
    for si, seg in enumerate(segments):
        f = os.path.join(dossier, seg["rush"])
        if not os.path.isfile(f):
            raise RuntimeError("rush introuvable : %s" % seg["rush"])
        l, h = dimensions(f)
        couche = bool(l and h and l > h)
        de, a = float(seg["de"]), float(seg["a"])
        # le plan peut dire « jusqu'a la fin du fichier » : on s'arrete a la
        # fin de l'IMAGE (le son d'un telephone dure plus longtemps)
        di = duree_image(f)
        if di > 0:
            a = min(a, di - 0.05)
        L = a - de
        if L < bloc_mini:
            continue
        pas = min(PAS_COULEUR_MAX, max(PAS_COULEUR_MIN, L / float(POINTS_SEGMENT)))
        coupes = coupes_du_rush(f, de, a)
        if rapport is not None:
            rapport.setdefault("coupes", []).extend((seg["rush"], x) for x in coupes)
        for mi, (m0, m1, internes) in enumerate(_morceaux(de, a, coupes, bloc_mini)):
            for t0, t1, g in _groupes_couleur(f, couche, m0, m1, pas, bloc_mini, travail):
                moy = tuple(sum(p[1][k] for p in g) / float(len(g)) for k in range(3))
                out.append({"fichier": f, "rush": seg["rush"], "nom": seg["rush"],
                            "couche": couche, "segment": si,
                            # 07/10/2026 : le coloris que le PLAN donne au
                            # segment (confirme par le client) ; c'est lui qui
                            # fait les familles, plus la distance des pixels
                            "coloris": _coloris(seg.get("coloris")),
                            "t0": round(t0, 2), "a": round(t1, 2),
                            "duree": round(t1 - t0, 2), "couleur": moy,
                            "largeur": l, "hauteur": h,
                            "prise": "%d.%d" % (si, mi),
                            "coupes": [round(x, 3) for x in internes
                                       if t0 + 0.01 < x < t1 - 0.01]})
    return out


def _groupes_couleur(f, couche, de, a, pas, bloc_mini, travail):
    """Les groupes de couleur d'un morceau de film continu [de, a] : on lit
    la couleur tous les `pas`, un saut de SAUT_COULEUR ouvre un groupe.
    Rend [(t0, t1, points)], chaque groupe portant au moins bloc_mini."""
    pts, t = [], de
    while t < a - 0.05:
        c = couleur_a(f, t, couche, travail)
        if c:
            pts.append((t, c))
        t += pas
    if not pts:
        return []
    grs, cur = [], [pts[0]]
    for t, c in pts[1:]:
        if math.dist(c, cur[-1][1]) > SAUT_COULEUR:
            grs.append(cur); cur = [(t, c)]
        else:
            cur.append((t, c))
    grs.append(cur)
    # un groupe trop court pour porter un bloc est RECOLLE au precedent :
    # mieux vaut un bloc qui traverse un changement de couleur qu'un bloc
    # qui deborde du segment et donc, peut-etre, du modele.
    bruts = []
    for g in grs:
        t0 = g[0][0]
        t1 = min(a, g[-1][0] + pas)
        bruts.append([t0, t1, g])
    fusion = []
    for b in bruts:
        if fusion and (b[1] - b[0]) < bloc_mini:
            fusion[-1][1] = b[1]; fusion[-1][2] = fusion[-1][2] + b[2]
        else:
            fusion.append(b)
    while len(fusion) > 1 and (fusion[0][1] - fusion[0][0]) < bloc_mini:
        fusion[1][0] = fusion[0][0]; fusion[1][2] = fusion[0][2] + fusion[1][2]
        fusion.pop(0)
    return [(t0, t1, g) for t0, t1, g in fusion if (t1 - t0) >= bloc_mini]


def _coloris(x):
    """Le nom d'un coloris du plan, tel qu'on le compare : « Noir », « noir »
    et « noir » (avec un espace) sont la meme couleur.
    07/10/2026 (casse de --familles) : les ACCENTS tombent (« Ecru » = « ecru »),
    mais une lettre qui n'est pas latine RESTE. Avant, tout ce qui n'etait pas
    ASCII disparaissait : un nom en arabe (« كحل ») devenait vide, deux familles
    nommees en arabe se fondaient en une (`lire_familles`) et le plan perdait
    ses coloris (retour aux pixels, le noir et le marron ensemble)."""
    import unicodedata
    t = unicodedata.normalize("NFKD", str(x or ""))
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return " ".join(t.lower().split())


def familles_couleur(cands):
    """Regroupe les SOUS-SEGMENTS par coloris. Ici, contrairement a
    `familles`, un groupe d'un seul sous-segment est LEGITIME : un coloris
    peut n'avoir ete filme qu'une fois.
    07/10/2026 — LES COULEURS DU PLAN. Sur un vrai lot, la distance des pixels
    faisait CINQ familles d'un modele en QUATRE coloris (la lumiere coupait le
    beige en deux, le noir et le marron fondaient ensemble) : l'ouverture « un
    bloc de 1,6 s par couleur » oubliait le marron trois fois sur quatre et
    montrait deux fois le beige de suite. Le plan, lui, donne le « coloris »
    de chaque segment, et le client l'a confirme : quand TOUS les
    sous-segments en portent un, les familles sont ces coloris, un par nom.
    Sans coloris (un plan ancien ou fait a la main), la distance des pixels
    reste, comme avant."""
    if cands and all(c.get("coloris") for c in cands):
        par_nom = {}
        for c in cands:
            par_nom.setdefault(c["coloris"], []).append(c)
        grp = []
        for nom, cs in par_nom.items():
            poids = [max(0.01, float(c.get("duree") or 0.0)) for c in cs]
            centre = tuple(sum(c["couleur"][k] * w for c, w in zip(cs, poids)) / sum(poids)
                           for k in range(3))
            grp.append({"centre": centre, "rushes": cs, "coloris": nom})
        grp.sort(key=lambda g: (sum(g["centre"]), g["coloris"]))
        for j, g in enumerate(grp):
            for c in g["rushes"]:
                c["famille"] = j
        return grp
    grp = []
    for c in sorted(cands, key=lambda x: sum(x["couleur"])):
        pose = False
        for g in grp:
            if math.dist(c["couleur"], g["centre"]) <= ECART_FAMILLE:
                g["rushes"].append(c)
                n = len(g["rushes"])
                g["centre"] = tuple((g["centre"][k] * (n - 1) + c["couleur"][k]) / n
                                    for k in range(3))
                pose = True; break
        if not pose:
            grp.append({"centre": tuple(c["couleur"]), "rushes": [c]})
    grp.sort(key=lambda g: sum(g["centre"]))
    for j, g in enumerate(grp):
        for c in g["rushes"]:
            c["famille"] = j
    return grp


def _intervalles_propres(c, bloc_long):
    """Ou un bloc de `bloc_long` tient dans le sous-segment c SANS traverser
    une coupe du rush (c["coupes"], a MARGE_COUPE pres). Rend [(debut,
    longueur)]."""
    coupes = c.get("coupes") or []
    if not coupes:
        return [(c["t0"], c["duree"])] if c["duree"] >= bloc_long - 0.01 else []
    bornes = [c["t0"]] + list(coupes) + [c["a"]]
    iv = []
    for k in range(len(bornes) - 1):
        i0 = bornes[k] + (MARGE_COUPE if k > 0 else 0.0)
        i1 = bornes[k + 1] - (MARGE_COUPE if k + 2 < len(bornes) else 0.0)
        if i1 - i0 >= bloc_long - 0.01:
            iv.append((i0, i1 - i0))
    return iv


def plans_possibles(cands, bloc_long, propres=False, par_seg=PLANS_PAR_SEG):
    """Toutes les COUPES distinctes qu'on peut tirer du materiel du modele.
    Un plan = (sous-segment, instant de depart). Deux coupes du meme
    sous-segment restent a ECART_DEPART l'une de l'autre, sinon ce serait
    deux fois la meme image. Un sous-segment plus court que le bloc n'en
    donne aucune : le bloc deborderait du segment, donc peut-etre du modele.
    06/10/2026 : un bloc ne traverse plus une coupe deja presente dans le
    rush quand il peut l'eviter. Un sous-segment ou AUCUNE place n'evite la
    coupe (des plans plus courts que le bloc) garde ses coupes a cheval,
    marquees « traverse_une_coupe », SEULEMENT si sa couleur n'a aucun bloc
    propre ailleurs (sinon elle serait perdue) — et jamais avec propres=True
    (la suite a 3 s n'est faite que de blocs propres)."""
    plans = []
    propres_par_fam = {c.get("famille") for c in cands
                       if c["duree"] >= bloc_long - 0.01 and _intervalles_propres(c, bloc_long)}
    for ci, c in enumerate(cands):
        if c["duree"] < bloc_long - 0.01:
            continue
        ivs = _intervalles_propres(c, bloc_long)
        traverse = not ivs
        if traverse:
            if propres or c.get("famille") in propres_par_fam:
                continue
            ivs = [(c["t0"], c["duree"])]
        marges = [max(0.0, li - bloc_long) for _i0, li in ivs]
        poids = sum(m + bloc_long for m in marges)
        for (i0, _li), marge in zip(ivs, marges):
            n = 1 + int(marge / ECART_DEPART)
            # PLANS_PAR_SEG coupes au plus par sous-segment, reparties entre
            # ses morceaux propres selon leur longueur
            part = par_seg if len(ivs) == 1 else \
                max(1, int(round(par_seg * (marge + bloc_long) / poids)))
            n = max(1, min(n, part))
            for k in range(n):
                deb = i0 + (marge * k / float(n - 1) if n > 1 else 0.0)
                p = {"cand": ci, "famille": c["famille"], "seg": c["segment"],
                     "sous": ci, "rush": c["rush"], "fichier": c["fichier"],
                     "couche": c["couche"], "debut": round(deb, 2),
                     "fin": round(deb + bloc_long, 2),
                     "longueur": bloc_long,
                     "couleur": c["couleur"]}
                if c.get("prise") is not None:
                    p["prise"] = c["prise"]
                if traverse:
                    p["traverse_une_coupe"] = True
                plans.append(p)
    return plans


def film_distinct(plans, longueur=None):
    """COMBIEN DE BLOCS DIFFERENTS (07/10/2026) : le plus grand nombre de
    blocs (de cette longueur) qu'on peut tirer des plans sans que deux d'entre
    eux partagent plus de REVU_MAXI de film. Par rush, le choix glouton par la
    fin (il est optimal pour des intervalles). Sert a fixer le nombre de blocs
    d'une variante AVANT de les choisir : le nombre de « coupes » (espacees
    de 0,25 s, qui se chevauchent presque entierement) ne le dit pas."""
    par_rush = {}
    for p in plans:
        L = p.get("longueur", longueur or 0.0)
        if longueur is not None and abs(L - longueur) > 0.01:
            continue
        par_rush.setdefault(p["rush"], []).append((p["debut"] + L, p["debut"]))
    n = 0
    for iv in par_rush.values():
        fin_der = -1e9
        for fin, deb in sorted(iv):
            if deb >= fin_der - REVU_MAXI - 1e-6:
                n += 1
                fin_der = fin
    return n


def films_revus(blocs):
    """Les blocs (numeros, depuis 1) qui partagent plus de REVU_MAXI de film
    avec un bloc PRECEDENT de la meme video (meme rush, temps qui se
    chevauchent). Un film revu n'est jamais « conforme »."""
    out = []
    for k in range(1, len(blocs)):
        if any(_film_commun(blocs[k], blocs[j]) > REVU_MAXI for j in range(k)):
            out.append(k + 1)
    return out


def ordre_ouverture(plans, nb_fams, premiere):
    """L'ORDRE DES COULEURS DE L'OUVERTURE (07/10/2026). Un bloc de 1,6 s par
    couleur, chaque couleur UNE fois, la premiere imposee (la variante i ouvre
    sur la famille i). Les autres sont rangees pour que deux couleurs voisines
    soient les plus DIFFERENTES possible (le noir ne suit pas le marron) : on
    garde l'ordre dont le plus petit ecart entre voisines est le plus grand.
    Rend la liste des familles, dans l'ordre."""
    import itertools
    centres = {}
    for p in plans:
        centres.setdefault(p["famille"], []).append(p["couleur"])
    centres = {f: tuple(sum(c[k] for c in cs) / float(len(cs)) for k in range(3))
               for f, cs in centres.items()}
    autres = [f for f in range(nb_fams) if f != premiere and f in centres]
    tete = [premiere] if premiere in centres else []
    if len(autres) > 6:                       # 720 ordres au plus : sinon tel quel
        return tete + autres
    meilleur, note_max = tete + autres, None
    for perm in itertools.permutations(autres):
        o = tete + list(perm)
        ecarts = [math.dist(centres[o[j]], centres[o[j - 1]]) for j in range(1, len(o))]
        note = (min(ecarts) if ecarts else 0.0, sum(ecarts))
        if note_max is None or note > note_max:
            meilleur, note_max = o, note
    return meilleur


def suite_de_plans(plans, nb_fams, i, longs, mesurer=None, visage=None):
    """La suite de plans de la variante i. `longs` = la longueur de chaque
    bloc (la regle 1,6 / 3 s) : le bloc k ne prend qu'une coupe de sa
    longueur. Contraintes, dans l'ordre :
       - la variante i OUVRE sur la famille i % nb_fams ;
       - (07/10/2026) L'OUVERTURE montre CHAQUE couleur UNE fois, dans
         l'ordre de `ordre_ouverture` : la famille d'un bloc d'ouverture est
         IMPOSEE (avant, faute d'un ecart de couleur assez grand, on prenait
         une couleur deja montree et une autre manquait) ;
       - jamais deux blocs de suite dans la meme famille de couleur ;
       - jamais deux blocs de suite dans le meme sous-segment ;
       - (06/10/2026) jamais deux blocs de suite VOISINS DANS LE MEME FILM
         (`_film_voisin`) : deux sous-segments d'une meme prise, coupes par
         un changement de lumiere, se touchent — un bloc qui finit a 10,0 s
         suivi d'un bloc qui commence a 10,0 s fait une coupe invisible ;
       - la couleur RELUE AU POINT DE COUPE change vraiment d'un bloc au
         suivant. 22/09/2026 : la moyenne d'un sous-segment ne suffit pas.
         Devant un decor beige, quand la fenetre de mesure glisse du
         vetement vers le mur, un bloc gris se lit beige. On mesure donc la ou
         le controle mesure. LE PLAN DEVIENT PLUS EXIGEANT, JAMAIS LE CONTROLE.
       - (07/10/2026) `visage(p)` : a combien des trois instants du bloc la
         plaque POV couvre le visage. A regles egales, un bloc ou le visage
         est SOUS la plaque passe apres ceux ou il est dessous (la plaque
         reste en haut : c'est le bloc qu'on choisit) ;
       - toutes les familles montrees le plus tot possible ;
       - une suite differente par variante."""
    n = len(plans)
    if n == 0:
        return []
    nb = len(longs)
    # DEUX VARIANTES NE PARCOURENT PAS LES COUPES DANS LE MEME ORDRE.
    # Une simple rotation ne suffit pas : le choix glouton retombe souvent sur
    # la meme suite. On parcourt donc par PAS, un pas premier avec le nombre de
    # coupes — chaque variante balaie le materiel autrement.
    dec = (i * 7 + 3) % n
    pas = 1 + (i * 3) % max(1, n - 1) if n > 1 else 1
    while n > 1 and math.gcd(pas, n) != 1:
        pas = pas % (n - 1) + 1
    ordre = [(dec + j * pas) % n for j in range(n)]
    if n > 1 and len({p["sous"] for p in plans}) == 1:
        return _suite_une_prise(plans, ordre, longs, visage)
    # l'ouverture : les blocs de 1,6 s du debut, une couleur chacun
    ouv = []
    if nb_fams >= 2:
        ouv = ordre_ouverture(plans, nb_fams, i % nb_fams)
        ouv = ouv[:sum(1 for L in longs[:len(ouv)] if abs(L - BLOC_COULEURS) <= 0.01)]
    _cl = {}

    def juge(j):
        """(rang, sous-cle) de la tete du plan j (`rang_tete`) ; (0,) sans juge."""
        if j not in _cl:
            v = (0,) if visage is None else visage(plans[j])
            _cl[j] = tuple(v) if isinstance(v, (tuple, list)) else (int(v or 0),)
        return _cl[j]

    def classe(j):
        """Le rang de la tete (07/10/2026) : 0 le visage VU sous la plaque a
        chaque instant ; 1 un instant douteux ; 2 et 3 la tete mal placee (le
        bloc sera MARQUE). Un visage NON VU n'est jamais un rang 0 : avant, il
        valait « plaque hors du visage », et des gros plans de la poitrine,
        tete hors du cadre, passaient en premier."""
        return _nv(juge(j))

    def premier(js, c):
        """Le premier de js (dans l'ordre) de rang <= c. Sans aucun, toute la
        liste est lue : sur un vrai lot, une mannequin filmee la tete haute
        avait ses douze meilleurs plans noirs avec le visage sous la plaque,
        et le treizieme non."""
        for j in js:
            if classe(j) <= c:
                return j
        return None

    def moins_mauvais(js):
        """Le plan de js ou la tete est la MIEUX placee (rang, puis sous-cle :
        en niche hijab la tete dans le cadre avant la plaque, la plaque sur le
        front avant le visage non vu), a egalite le premier dans l'ordre."""
        return min(js, key=lambda j: (juge(j), js.index(j))) if js else None

    choisis, vus = [], set()
    der_fam, der_sous, der_coul, der_p = None, None, None, None
    fams_vues = set()
    par_rush = {}
    for j, p in enumerate(plans):
        par_rush.setdefault((p["rush"], round(p.get("longueur", 0.0), 2)), []).append(p)

    def perte(j, k):
        """LE FILM DISTINCT QU'UN CHOIX GACHE (07/10/2026) : pour chaque
        longueur qui reste a poser dans la variante (1,6 s, 3 s), combien de
        blocs differents le rush porte encore, moins ce qu'il porte avec ce
        plan pose (lui-meme non compte). 0 : le plan est cale contre ce qui est
        deja pris ; plus : il coupe une place en morceaux trop courts (un bloc
        de 1,6 s pose au milieu d'une prise de 6 s : plus aucun bloc de 3 s
        n'y tient)."""
        p = plans[j]
        tot = 0
        for L in {round(x, 2) for x in longs[k:]}:
            libres = [q for q in par_rush.get((p["rush"], L), [])
                      if all(_film_commun(q, c) <= REVU_MAXI for c in choisis)]
            avant = film_distinct(libres)
            apres = film_distinct([q for q in libres if _film_commun(q, p) <= REVU_MAXI])
            lui = 1 if abs(L - p.get("longueur", 0.0)) <= 0.01 else 0
            tot += max(0, avant - apres - lui)
        return tot
    for k in range(nb):
        strict = k < len(ouv)
        if strict:
            cible = ouv[k]
        elif k == 0:
            cible = i % nb_fams
        else:
            manquantes = [x for x in range(nb_fams)
                          if x not in fams_vues and x != der_fam]
            cible = manquantes[0] if manquantes else (i + k) % nb_fams
        pris, secours, ecart_max = None, None, -1.0
        # LE SECOURS PAR ETAGE (07/10/2026) : le moins mauvais ecart de couleur
        # d'un tour qui garde le « deja vu » passe AVANT celui d'un tour qui le
        # relache. Avant, un seul secours pour tous les tours : en une couleur
        # (aucun ecart ne passe jamais), un bloc qui REMONTRAIT le film d'un
        # bloc deja pose gagnait des qu'il etait un peu plus « different ».
        secours_etage = {}
        pris_visage = None    # passe toutes les regles, mais la tete est mal placee
        # LES TOURS (06/10/2026). 0, 1, 2 : les regles d'avant, et « deja vu »
        # veut dire le meme plan OU un plan qui remontre plus de REVU_MAXI d'un
        # bloc deja pose (trois places d'un morceau de 2 s, 17,0 / 17,25 /
        # 17,5 s, passaient pour trois plans neufs dans la meme variante).
        # 10, 11, 12 : les memes regles avec l'ancien « deja vu » (le meme plan
        # seulement) — une matiere trop courte remontre alors un plan DECALE
        # plutot que le meme a l'identique. 3 : un plan deja pris. Jusque-la,
        # jamais un bloc VOISIN du precedent dans le meme film. 4 : l'ancien
        # dernier recours, seulement si rien n'est sorti.
        # Pendant l'OUVERTURE, la famille reste imposee a tous les tours sauf
        # au dernier recours. Un bloc qui respecte tout SAUF le visage (sous
        # la plaque) est garde de cote : on cherche encore, au tour SUIVANT
        # seulement s'il garde toutes ses regles (1 apres 0, 11 apres 10 : la
        # famille visee seule s'elargit), un bloc sans visage sous la plaque ;
        # sinon c'est lui. Casse du 07/10/2026 : la recherche du visage
        # descendait aux tours 10 et 11, qui relachent le « deja vu » — sur le
        # vrai lot, une variante sur dix remontrait DEUX FOIS le meme film
        # (10,31-11,91 s puis 10,0-13,0 s) pour eviter un visage. Le visage
        # passe apres TOUTES les regles, jamais avant une seule.
        tour_visage = None
        for tour in (0, 1, 2, 10, 11, 12, 3, 4):
            if tour == 4 and (pris is not None or secours is not None):
                break
            t = tour % 10
            if pris_visage is not None and not (t == 1 and tour == tour_visage + 1):
                continue
            lus = 0
            cands = []            # [(j, ecart de couleur au bloc d'avant)]
            for j in ordre:
                p = plans[j]
                if abs(p.get("longueur", longs[k]) - longs[k]) > 0.01:
                    continue
                if t <= 2 and j in vus:
                    continue
                if tour <= 2 and any(_film_commun(p, c) > REVU_MAXI for c in choisis):
                    continue
                if (t == 0 or (strict and tour != 4)) and p["famille"] != cible:
                    continue
                if t <= 1 and nb_fams > 1 and p["famille"] == der_fam:
                    continue
                if t <= 2 and n > 1 and p["sous"] == der_sous:
                    continue
                if t >= 3 and n > 1 and p["sous"] == der_sous:
                    continue
                if tour != 4 and der_p is not None and _film_voisin(p, der_p):
                    continue
                if der_coul is None or mesurer is None or nb_fams <= 1:
                    # une seule couleur : l'ecart de couleur n'a pas d'objet
                    # (l'alternance se fait entre les scenes)
                    cands.append((j, None))
                    if len(cands) >= MESURES_PAR_BLOC:
                        break
                    continue
                if lus >= MESURES_PAR_BLOC:
                    continue
                lus += 1
                cands.append((j, math.dist(mesurer(p), der_coul)))
            if not cands:
                continue
            # ON NE PREND PAS LE PREMIER QUI PASSE : on garde le plus
            # DIFFERENT. Et si aucun ne passe, on garde quand meme le
            # moins mauvais au lieu d'en tirer un au hasard — c'est ce
            # que faisait deja `choisir_plan` depuis le 17/09/2026.
            # une seule couleur : l'ORDRE DE LA VARIANTE decide (07/10/2026 : trie
            # par un ecart de couleur sans objet, les six variantes d'un modele
            # d'une couleur prenaient les memes cinq blocs)
            par_ecart = sorted(cands, key=lambda x: -(x[1] if x[1] is not None else 0.0)) \
                if nb_fams > 1 else list(cands)
            # a regles egales, le plan qui ne gache pas de film distinct passe
            # d'abord (tri stable : l'ordre des ecarts de couleur reste dedans)
            rang = sorted(par_ecart, key=lambda x: perte(x[0], k))
            # LE SECOURS (quand rien ne passe l'ecart) reste le plus grand ecart
            # de couleur (07/10/2026, casse) : trie d'abord par le film gache,
            # il devenait un bloc a 8 d'ecart quand un autre a 28 existait — deux
            # blocs « colles », la variante A REVOIR. Le film gache ne departage
            # que des ecarts que la relecture sait encore lire.
            if nb_fams > 1 and par_ecart[0][1] is not None:
                relus = [x for x in rang if x[1] is not None and x[1] >= SEUIL_RELU + 4]
                j0, d0 = relus[0] if relus else par_ecart[0]
            else:
                j0, d0 = rang[0]
            if d0 is not None and d0 > ecart_max:
                secours, ecart_max = j0, d0
            elif d0 is None and secours is None:
                secours = j0
            etage = 0 if tour <= 2 else 1 if tour < 10 + 3 and tour >= 10 else 2
            der_s = secours_etage.get(etage)
            if der_s is None or (d0 is not None and (der_s[1] is None or d0 > der_s[1])):
                secours_etage[etage] = (j0, d0)
            haut = rang                # MESURES_PAR_BLOC au plus (40)
            passe = [j for j, d in haut if d is None or d >= SEUIL_VOISIN]
            # 1. un bloc qui passe l'ecart de couleur, le visage hors de la
            #    plaque (a aucun instant, puis a un seul)
            for c in (0, 1):
                pris = premier(passe, c)
                if pris is not None:
                    break
            # 2. l'ouverture : la couleur imposee, le moins mauvais ecart
            #    sans visage sous la plaque, sinon le moins mauvais tout court
            if pris is None and strict:
                for c in (0, 1):
                    pris = premier([j for j, _d in haut], c)
                    if pris is not None:
                        break
                if pris is None:
                    mm = moins_mauvais([j for j, _d in haut])
                    if pris_visage is None or juge(mm) < juge(pris_visage):
                        pris_visage = mm
                    if tour_visage is None:
                        tour_visage = tour
            # 3. la suite, quand tous ceux qui passent l'ecart ont le visage
            #    sous la plaque : sans visage, un ecart que le controle sait
            #    encore relire ; sinon le visage sous la plaque plutot qu'une
            #    couleur repetee (il sera MARQUE). Aucun ne passe l'ecart :
            #    le tour suivant, comme avant.
            if pris is None and passe:
                pris = premier([j for j, d in haut if d is not None
                                and d >= SEUIL_RELU + 4], 1)
                if pris is None:
                    mm = moins_mauvais(passe)
                    if pris_visage is None or juge(mm) < juge(pris_visage):
                        pris_visage = mm
                    if tour_visage is None:
                        tour_visage = tour
            if pris is not None:
                break
        if pris is None and pris_visage is not None:
            pris = pris_visage
        if pris is None:
            meme = [j for j in ordre
                    if abs(plans[j].get("longueur", longs[k]) - longs[k]) <= 0.01]
            etage = min(secours_etage) if secours_etage else None
            if etage is None:
                pris = meme[k % len(meme)] if meme else ordre[k % n]
            else:
                # plusieurs couleurs : un ecart que la relecture ne voit pas
                # (deux blocs « colles ») est pire qu'un film revu, qui est
                # MARQUE ; une couleur : l'ecart n'a pas d'objet
                j_e, d_e = secours_etage[etage]
                pris = j_e if (nb_fams <= 1 or d_e is None or d_e >= SEUIL_RELU + 4
                               or secours is None) else secours
        p = plans[pris]
        vus.add(pris); choisis.append(p)
        pouls("      ... bloc %d / %d choisi (variante %d)" % (k + 1, nb, i + 1))
        der_fam, der_sous, der_p = p["famille"], p["sous"], p
        der_coul = mesurer(p) if mesurer is not None else p["couleur"]
        fams_vues.add(p["famille"])
    return choisis


def _film_commun(p, q):
    """Les secondes de film que deux blocs partagent (0 si deux rushes)."""
    if p["rush"] != q["rush"]:
        return 0.0
    return max(0.0, min(p["debut"] + p.get("longueur", 0.0), q["debut"] + q.get("longueur", 0.0))
               - max(p["debut"], q["debut"]))


def _film_voisin(p, q):
    """p pose JUSTE APRES q : la coupe entre eux se voit-elle ? Non quand les
    deux blocs viennent du meme film continu (meme rush, aucune coupe du rush
    entre eux) et qu'ils partagent plus de REVU_MAXI de film, ou que le saut
    de la fin de q au debut de p fait moins de ECART_MEME_PRISE. Deux prises
    du meme segment separees par une coupe du rush (`coupes_du_rush`) : la
    coupe se voit. Deux segments du meme rush : on ne sait pas, on se mefie."""
    if p["rush"] != q["rush"]:
        return False
    if (p.get("seg") == q.get("seg") and p.get("prise") is not None
            and q.get("prise") is not None and p["prise"] != q["prise"]):
        return False
    if _film_commun(p, q) > REVU_MAXI:
        return True
    return abs(p["debut"] - (q["debut"] + q.get("longueur", 0.0))) < ECART_MEME_PRISE - 1e-6


def _suite_une_prise(plans, ordre, longs, visage=None):
    """UNE SEULE PRISE (06/10/2026) : toutes les coupes viennent du MEME
    sous-segment — un modele d'une couleur filme en une longue prise. La
    regle « jamais deux blocs de suite dans le meme sous-segment » n'y
    laisserait que des repetitions : elle devient « jamais deux blocs
    VOISINS DANS LE TEMPS ». `ordre` varie avec la variante.
    CASSE DU 06/10/2026 (vraie prise de 6,8 s) : la premiere version voulait
    a tout prix sauter 2 s de film, et pour ca REVENAIT EN ARRIERE dans le
    bloc qu'on venait de voir (0-3 s puis 0,7-3,7 puis 1,4-4,4 : 2,3 s
    revues a chaque coupe), sans jamais montrer la fin de la prise. Et un
    bloc qui partageait 0,1 s avec un autre n'etait plus « neuf » : elle
    remontrait alors un bloc ENTIER deja vu. L'ordre du choix est donc :
      1. ne jamais revoir le bloc d'avant (plus de REVU_MAXI en commun) ;
      2. un saut d'au moins ECART_MEME_PRISE, pour que la coupe se voie (a
         defaut, au moins un quart de cet ecart : 3,0 s suivi de 3,1 s est
         une coupe INVISIBLE, la relecture ne la trouve pas) ;
      3. le moins deja vu dans la video (a la demi-seconde) ;
      4. a defaut d'un saut de ECART_MEME_PRISE, le plus grand saut ;
      5. l'ordre de la variante.
    07/10/2026 : apres le saut (2.), un bloc ou la plaque POV ne couvre pas
    le visage (`visage`, 0 a 3 instants) passe avant les autres.
    Quand tout chevauche le bloc d'avant (une prise plus courte que deux
    blocs), le moins de film en commun avec lui passe en premier."""
    _cl = {}

    def classe(j):
        """(rang, sous-cle) de la tete (`rang_tete`) ; (0,) sans juge."""
        if visage is None:
            return (0,)
        if j not in _cl:
            v = visage(plans[j])
            _cl[j] = tuple(v) if isinstance(v, (tuple, list)) else (int(v or 0),)
        return _cl[j]

    choisis = []
    for k, L in enumerate(longs):
        meme = [j for j in ordre if abs(plans[j].get("longueur", L) - L) <= 0.01] \
            or list(ordre)
        if not choisis:
            pris = min(meme[:VISAGES_PAR_BLOC], key=lambda j: (classe(j), meme.index(j)))
        else:
            der = choisis[-1]

            def note(j):
                p = dict(plans[j], longueur=L)
                avec_der = _film_commun(p, der)
                deja = sum(_film_commun(p, c) for c in choisis)
                saut = abs(p["debut"] - (der["debut"] + der.get("longueur", longs[k - 1])))
                loin = saut >= ECART_MEME_PRISE - 1e-6
                return (round(avec_der, 1) if avec_der > REVU_MAXI else 0.0,
                        0 if loin else (1 if saut >= ECART_MEME_PRISE / 4.0 else 2),
                        classe(j),
                        int(round(deja / 0.5)),
                        0.0 if loin else -round(saut, 2),
                        meme.index(j))
            pris = min(meme, key=note)
        choisis.append(plans[pris])
        pouls("      ... bloc %d / %d choisi (une seule prise)" % (k + 1, len(longs)))
    return choisis


def _pcm(f, debut=0.0, duree=None):
    """La musique en nombres, pour trouver son passage le plus fort.
    `-f s16le` existe dans toutes les versions de ffmpeg : rien d'exotique
    ici, l'outil doit tourner sur la machine du client (ffmpeg recent) comme
    ailleurs."""
    import numpy as np
    cmd = ["ffmpeg", "-v", "error", "-ss", "%.2f" % debut, "-i", f]
    if duree:
        cmd += ["-t", "%.2f" % duree]
    cmd += ["-ac", "1", "-ar", "8000", "-f", "s16le", "-"]
    r = subprocess.run(cmd, capture_output=True, stdin=subprocess.DEVNULL,
                       timeout=180)
    if r.returncode != 0 or not r.stdout:
        return None
    return np.frombuffer(r.stdout, dtype="<i2").astype("float32")


def musique_forte(f, duree_voulue):
    """Ou commencer la musique : sur son passage le PLUS FORT, comme la
    skill l'impose. On mesure l'energie par fenetres d'une seconde."""
    try:
        a = _pcm(f)
    except Exception:
        return 0.0
    if a is None or len(a) < 8000:
        return 0.0
    import numpy as np
    sr = 8000
    n = int(duree_voulue * sr)
    if n >= len(a):
        return 0.0
    bloc = sr
    nb = len(a) // bloc
    if nb < 2:
        return 0.0
    e = np.array([float((a[k * bloc:(k + 1) * bloc] ** 2).mean())
                  for k in range(nb)])
    large = max(1, int(round(duree_voulue)))
    if large >= nb:
        return 0.0
    cum = np.cumsum(np.concatenate([[0.0], e]))
    somme = cum[large:] - cum[:-large]
    k = int(somme.argmax())
    return float(min(k, max(0, (len(a) - n) / float(sr))))


def poser_musique(muet, mus, debut, duree_cible, dest):
    """La musique posee sur la video muette, avec le fondu de sortie de 0,8 s.
    LA VIDEO GARDE SA LONGUEUR (corrige le 07-08/10/2026) : plus de
    -shortest, qui coupait la video des que la musique finissait (un depart
    au milieu du titre la raccourcissait). Le depart est ramene pour que la
    musique COUVRE la video ; ce qui manquerait encore est du silence (apad),
    et la musique est coupee a la fin de la video avec son fondu. On ne la
    repete jamais."""
    try:
        d_mus = duree(mus)
    except Exception:
        d_mus = 0.0
    if d_mus > 0:
        debut = max(0.0, min(float(debut), d_mus - duree_cible))
    else:
        debut = max(0.0, float(debut))
    st = max(0.0, duree_cible - FONDU_MUSIQUE)
    r = lancer(["ffmpeg", "-v", "error", "-i", muet,
                "-ss", "%.2f" % debut, "-i", mus,
                "-map", "0:v", "-map", "1:a",
                "-af", "apad,atrim=0:%.3f,afade=t=out:st=%.3f:d=%.2f"
                % (duree_cible, st, FONDU_MUSIQUE),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                "-t", "%.3f" % duree_cible,
                "-movflags", "+faststart", dest, "-y"], 300)
    return r.returncode == 0 and os.path.isfile(dest)


def _vignette(video_ou_rush, t, dest, couche=False, taille=120, crop=None):
    vf = ("transpose=2," if couche else "") + (crop + "," if crop else "") \
        + "scale=%d:-1" % taille
    lancer(["ffmpeg", "-v", "error", "-ss", "%.2f" % max(0.0, t),
            "-i", video_ou_rush, "-frames:v", "1", "-vf", vf, dest, "-y"], 120)
    return os.path.isfile(dest)


# EN STYLE bande OU plein, LE RUSH N'EST QU'UNE PARTIE DE L'IMAGE. On compare
# donc la ZONE ou il est pose (un peu en retrait des bords, ou l'arrondi de
# ffmpeg joue d'un pixel) au rush coupe du meme retrait. En natif : tout.
ENCART = 0.03
CROP_ENCART = "crop=iw*%.2f:ih*%.2f:iw*%.2f:ih*%.2f" % (1 - 2 * ENCART, 1 - 2 * ENCART,
                                                         ENCART, ENCART)


def zone_video(style, forme):
    """(x, y, l, h) de l'image du rush dans la video finie, d'apres le style
    et la forme du rush redresse (largeur / hauteur). None en natif."""
    if style not in ("bande", "plein") or not forme:
        return None
    bl, bh = (LARGEUR, HAUTEUR) if style == "plein" else (IMG_L, IMG_H)
    if forme < bl / float(bh):
        h, l = float(bh), bh * forme
    else:
        l, h = float(bl), bl / forme
    x = (LARGEUR - l) / 2.0
    y = (HAUTEUR - h) / 2.0 if style == "plein" else HAUTEUR - h - MARGE_BAS
    return (int(x + l * ENCART), int(y + h * ENCART),
            int(l * (1 - 2 * ENCART)), int(h * (1 - 2 * ENCART)))


def crop_zone(z):
    return "crop=%d:%d:%d:%d" % (z[2], z[3], z[0], z[1]) if z else None


def _forme(png):
    from PIL import Image
    w, h = Image.open(png).size
    return w / float(h) if h else 0.0


def _signature(chemin):
    """L'image reduite, sans la bande du haut (c'est la que la plaque POV est
    brulee : elle est la meme sur toutes les videos, elle ne doit pas entrer
    dans la comparaison)."""
    from PIL import Image
    import numpy as np
    im = Image.open(chemin).convert("RGB").resize((48, 85))
    a = np.asarray(im, dtype="float32")
    return a[int(85 * 0.28):, :, :]


def _ecart(s1, s2):
    import numpy as np
    return float(np.abs(s1 - s2).mean())


def _relire_bloc(video, b, src, cumul, leurres, travail, k, style):
    """UN bloc de la video ECRITE contre sa source declaree (meme rush, meme
    instant) et contre les leurres (images d'AUTRES modeles). Lu au milieu,
    puis a 30 % et a 70 % si ca coince. Rend (bon, essais, meilleur)."""
    import numpy as np
    essais, bon, meilleur = [], False, None
    pose = style in ("bande", "plein")
    # natif : un bloc REMPLI (rush d'une autre taille que la majorite) est
    # compare a sa source recadree pareil — sinon on comparerait deux cadrages
    rempli = None if pose else _lire_taille(b.get("rempli") or "")
    for p in POINTS_BLOC:
        tv = cumul + b["longueur"] * p
        ts = b["debut"] + b["longueur"] * p
        pv = os.path.join(travail, "ctrl_v%d.png" % k)
        ps = os.path.join(travail, "ctrl_s%d.png" % k)
        if not _vignette(src, ts, ps, b.get("couche", False),
                         crop=CROP_ENCART if pose else (crop_rempli(rempli) if rempli else None)):
            continue
        zone = zone_video(style, _forme(ps)) if pose else None
        if not _vignette(video, tv, pv, crop=crop_zone(zone)):
            continue
        sv, ss = _signature(pv), _signature(ps)
        d_src = _ecart(sv, ss)
        plat = float(np.asarray(sv).std())
        pires = [(nom, _ecart(sv, sg)) for nom, sg in leurres]
        d_autre = min([d for _n, d in pires], default=999.0)
        qui = min(pires, key=lambda x: x[1])[0] if pires else None
        essais.append({"point": p, "d_src": d_src, "d_autre": d_autre,
                       "qui": qui, "plat": plat})
        if plat >= PLAT_MINI and d_src <= ECART_SOURCE_MAX \
                and d_autre >= d_src * MARGE_LEURRE:
            bon, meilleur = True, essais[-1]
            break
        for x in (pv, ps):
            try:
                os.remove(x)
            except OSError:
                pass
    return bon, essais, meilleur


def _juger_bloc(k, b, bon, essais, meilleur, fautes, detail):
    """Le verdict d'un bloc relu, ecrit pareil dans les deux modes."""
    if not essais:
        fautes.append("bloc %d : la video ou sa source ne se relit pas" % k)
        return
    if meilleur is None:
        meilleur = min(essais, key=lambda x: x["d_src"])
    plat_partout = all(x["plat"] < PLAT_MINI for x in essais)
    if plat_partout:
        fautes.append("bloc %d : image plate (noir ou fondu) sur les %d "
                      "points lus" % (k, len(essais)))
    elif not bon and meilleur["qui"]:
        fautes.append("bloc %d : sur %d point(s) lus, l'image de la video "
                      "ressemble a « %s » (%.1f) autant qu'a sa source "
                      "%s (%.1f)" % (k, len(essais), meilleur["qui"],
                                     meilleur["d_autre"], b["rush"],
                                     meilleur["d_src"]))
    elif not bon:
        fautes.append("bloc %d : l'image de la video n'est pas celle de sa "
                      "source %s a %.2f s (ecart %.1f)"
                      % (k, b["rush"], b["debut"], meilleur["d_src"]))
    detail.append({"bloc": k, "rush": b["rush"],
                   "de": b["debut"], "a": b["fin"],
                   "points_lus": len(essais),
                   "lu_a": meilleur["point"],
                   "ecart_a_sa_source": round(meilleur["d_src"], 2),
                   "ecart_au_plus_proche_autre_modele": round(meilleur["d_autre"], 2),
                   "autre_modele_le_plus_proche": meilleur["qui"],
                   "ecart_type_image": round(meilleur["plat"], 1),
                   "transition_dans_le_bloc": bool(bon and meilleur["point"] != 0.5),
                   "ok": bool(bon)})


def controler_sources(video, blocs, dossier, travail, style=None):
    """MODE --rushes : pas de plan, LE DOSSIER EST LE MODELE. On prouve sur
    la video ECRITE que chaque bloc est l'image de son rush declare, pris
    dans ce dossier : aucun bloc ne vient d'ailleurs. On compare a l'instant
    declare ; dans un plan presque fixe, un autre instant du MEME rush passe
    aussi (c'est le rush qu'on prouve, pas la seconde). Rend (fautes, detail)."""
    style = style or STYLE
    fautes, detail = [], []
    cumul = 0.0
    for k, b in enumerate(blocs, 1):
        src = os.path.join(dossier, b["rush"])
        if os.path.dirname(os.path.normpath(b["rush"])) or not os.path.isfile(src):
            fautes.append("bloc %d : %s n'est pas un rush du dossier du modele"
                          % (k, b["rush"]))
        else:
            bon, essais, meilleur = _relire_bloc(video, b, src, cumul, [],
                                                 travail, k, style)
            _juger_bloc(k, b, bon, essais, meilleur, fautes, detail)
        cumul += b["longueur"]
    return fautes, detail


def controler_un_seul_modele(video, blocs, plan, nom_modele, travail, style=None):
    """LE CONTROLE QUI MANQUAIT LE 21/09/2026.

    Deux lectures, pas une :
      1. LE PLAN — chaque bloc doit tomber DANS un segment du modele annonce,
         et dans aucun segment d'un autre modele ;
      2. LA VIDEO ECRITE — on en RELIT une image par bloc avec ffmpeg, et on
         la compare a l'image de sa source declaree ET a une image de chaque
         AUTRE modele du plan. Un bloc qui ressemble plus a un autre modele
         qu'a sa source est refuse. Le test se calibre tout seul : il ne
         suppose ni codec, ni definition, ni version de ffmpeg.

    Rend (liste des fautes, detail par bloc)."""
    fautes, detail = [], []

    # ---- 1. le plan
    segs = {}
    for m in plan["modeles"]:
        for s in m["segments"]:
            segs.setdefault(m["nom"], []).append(
                (s["rush"], float(s["de"]), float(s["a"])))

    def modeles_de(rush, d, f):
        dedans = []
        for nom, ss in segs.items():
            for r, t0, t1 in ss:
                if r == rush and d >= t0 - 0.05 and f <= t1 + 0.05:
                    dedans.append(nom); break
        return dedans

    for k, b in enumerate(blocs, 1):
        dedans = modeles_de(b["rush"], b["debut"], b["fin"])
        if nom_modele not in dedans:
            fautes.append("bloc %d : %s %.2f-%.2f s n'est dans AUCUN segment "
                          "de « %s »" % (k, b["rush"], b["debut"], b["fin"],
                                         nom_modele))
        autres = [x for x in dedans if x != nom_modele]
        if autres:
            fautes.append("bloc %d : %s %.2f-%.2f s appartient aussi a %s"
                          % (k, b["rush"], b["debut"], b["fin"], ", ".join(autres)))
        # 07/10/2026 : un bloc qui TOUCHE une exclusion du plan (ou un bord
        # dispute entre deux modeles) est refuse, meme s'il est l'image de sa
        # source : c'est justement l'instant que le plan retire
        for z0, z1, pourquoi in zones_interdites(plan, b["rush"]):
            if min(float(b["fin"]), z1) - max(float(b["debut"]), z0) > 0.005:
                fautes.append("bloc %d : %s %.2f-%.2f s touche %s %.2f-%.2f s"
                              % (k, b["rush"], b["debut"], b["fin"], pourquoi, z0, z1))
                break

    # ---- 2. la video ecrite, relue image par image
    style = style or STYLE
    pose = style in ("bande", "plein")
    leurres = []
    for mi, m in enumerate(plan["modeles"]):
        if m["nom"] == nom_modele:
            continue
        # plusieurs leurres par modele : un modele filme dans trois decors
        # ne se resume pas a une seule image.
        for si, s in enumerate(m["segments"][:3]):
            f = os.path.join(plan["rushes"], s["rush"])
            de, a = float(s["de"]), float(s["a"])
            t = de + min(2.0, (a - de) / 2.0)
            p = os.path.join(travail, "leurre_%d_%d.png" % (mi, si))
            lf, hf = dimensions(f) if os.path.isfile(f) else (0, 0)
            if os.path.isfile(f) and _vignette(f, t, p, bool(lf and hf and lf > hf),
                                               crop=CROP_ENCART if pose else None):
                leurres.append((m["nom"], _signature(p)))

    cumul = 0.0
    for k, b in enumerate(blocs, 1):
        src = os.path.join(plan["rushes"], b["rush"])
        bon, essais, meilleur = _relire_bloc(video, b, src, cumul, leurres,
                                             travail, k, style)
        cumul += b["longueur"]
        _juger_bloc(k, b, bon, essais, meilleur, fautes, detail)
    return fautes, detail


def _lire_json(f):
    with open(f, encoding="utf-8") as fh:
        return json.load(fh)


def _ecrire_json(f, obj):
    """En UTF-8 (Windows sans -X utf8 ecrirait en cp1252), et d'un coup : une
    coupure du PC en pleine ecriture laissait un JSON tronque, donc illisible."""
    tmp = f + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)
    for essai in range(6):
        try:
            os.replace(tmp, f)
            return
        except OSError:
            # Windows : un antivirus ou un lecteur tient le fichier un instant
            import time
            time.sleep(0.3)
    with open(f, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)
    _retirer(tmp)


def _rapport_charger(dossier):
    f = os.path.join(dossier, "_rapport.json")
    if not os.path.isfile(f):
        return []
    try:
        r = _lire_json(f)
        return [x for x in r if isinstance(x, dict)] if isinstance(r, list) else []
    except Exception:
        return []


def _retirer(f):
    try:
        os.remove(f)
    except OSError:
        pass


def _vider(travail, motif=r"^(v\d+_b\d+\.mp4|[lma]\d+\.(txt|mp4))$"):
    """Les blocs et les videos intermediaires d'une variante finie."""
    import re
    for x in os.listdir(travail):
        if re.match(motif, x):
            _retirer(os.path.join(travail, x))


def _nettoyer_sortie(sortie):
    """Les livrables d'un montage d'avant (videos, planches, rapports), a la
    racine de la sortie seulement. Rend combien de fichiers sont partis."""
    import re
    n = 0
    for x in os.listdir(sortie):
        if re.match(r"^(variante_\d+\.mp4|_planche_variante_\d+\.png|_rapport\.json|"
                    r"_verification\.json)$", x, re.I) and os.path.isfile(os.path.join(sortie, x)):
            _retirer(os.path.join(sortie, x)); n += 1
    return n


def _rapport_ecrire(dossier, faits):
    """Le rapport reste une LISTE : le bureau la lit comme ca (rapprochee par
    le nom du fichier). On ne casse pas ce qui marche."""
    faits = sorted(faits, key=lambda x: x.get("variante", 0))
    _ecrire_json(os.path.join(dossier, "_rapport.json"), faits)


def preparer_modele(plan, mod, sortie, travail, refaire=False):
    """Les sous-segments de couleur du modele, calcules UNE FOIS et gardes
    sur le disque : le montage se fait par paquets de variantes, il ne faut
    pas relire quatre cent secondes de rush a chaque paquet."""
    cache = os.path.join(sortie, "_segments-couleur.json")
    # LE CACHE NE SERT QUE POUR LE MEME MODELE, LES MEMES SEGMENTS, LES MEMES
    # RUSHES. Deux modeles montes dans la meme sortie : le second reprenait
    # les coupes du premier.
    source = json.dumps({"rushes": plan["rushes"], "modele": mod["nom"],
                         "segments": mod["segments"]}, sort_keys=True, ensure_ascii=False)
    if os.path.isfile(cache) and not refaire:
        try:
            d = _lire_json(cache)
            # un cache d'avant la regle 1,6 / 3 s n'a qu'UNE longueur de
            # coupe : on le refait
            if d.get("regle") == REGLE_CACHE and d.get("source") == source:
                return d
        except Exception:
            pass
    vu = {}
    court3 = None          # une couleur : film distinct de 3 s trop court pour une pub
    cands = sous_segments(mod["segments"], plan["rushes"], travail, BLOC_COULEURS, vu)
    if len(familles_couleur(cands)) < 2:
        # UNE SEULE COULEUR : la regle de la maison dit bloc de 3 s, et
        # l'alternance se fait alors entre les SCENES, pas entre les coloris.
        long3 = sous_segments(mod["segments"], plan["rushes"], travail,
                              BLOC_1COULEUR)
        # 06/10/2026 : UN morceau qui porte 3 s suffit. Avant, il en fallait
        # DEUX : un modele filme en une seule longue prise (le cas courant
        # d'un lot) sortait « 1,6 s partout » alors que sa matiere portait
        # des blocs de 3 s. Ses coupes se suivent alors dans la MEME prise,
        # eloignees dans le temps (`_suite_une_prise`). Le bloc court ne
        # reste que si AUCUN morceau ne porte 3 s — et on le DIT.
        # Casse du 06/10/2026 : « porter 3 s », c'est porter un bloc de 3 s
        # SANS traverser une coupe deja presente dans le rush. Une vraie
        # prise de 6,8 s coupee a 3,57 s donnait dix variantes sur dix « A
        # REGARDER » (coupes en trop) : chaque bloc y montrait deux plans.
        # 07/10/2026 : et porter 3 s, c'est porter assez de film DISTINCT pour
        # une pub (DUREE_MINI_PUB) : une prise deja coupee toutes les 2 s ne
        # portait qu'UNE fenetre de 3 s (12,9-16,8 s, en quatre « coupes »
        # decalees de 0,3 s) et les dix variantes remontraient le meme demi-
        # tour quatre fois. Sinon : 1,6 s sur toutes ses prises, et on le DIT.
        if any(_intervalles_propres(c, BLOC_1COULEUR) for c in long3):
            familles_couleur(long3)            # chaque sous-segment recoit sa famille
            par3 = PLANS_UNE_PRISE if len(long3) == 1 else PLANS_PAR_SEG
            d3 = film_distinct(plans_possibles(long3, BLOC_1COULEUR, propres=True,
                                               par_seg=par3), BLOC_1COULEUR)
            if d3 * BLOC_1COULEUR >= DUREE_MINI_PUB - 1e-6:
                cands = long3
            else:
                court3 = d3
    fams = familles_couleur(cands)
    if not cands:
        raise RuntimeError("aucun sous-segment utilisable pour « %s » : "
                           "les segments du plan sont tous plus courts qu'un "
                           "bloc" % mod["nom"])
    # LES COUPES : 1,6 s pour l'ouverture (une par couleur), 3 s pour la
    # suite, tirees seulement des sous-segments qui portent 3 s.
    #   plusieurs couleurs : la suite alterne entre au moins DEUX
    #     sous-segments de 3 s, sinon elle reste a 1,6 s (et on le dit) ;
    #   une couleur : 3 s partout des qu'UN sous-segment les porte.
    # Les blocs de 3 s sont PROPRES (aucun a cheval sur une coupe du rush) ;
    # un bloc de 1,6 s ne passe a cheval que si sa COULEUR n'a aucune place
    # sans coupe (sinon elle serait perdue), et on le DIT.
    # une seule prise (un sous-segment, une couleur) : plus de places
    par_seg = PLANS_UNE_PRISE if len(cands) == 1 and len(fams) == 1 else PLANS_PAR_SEG
    plans3 = plans_possibles(cands, BLOC_1COULEUR, propres=True, par_seg=par_seg)
    if len(fams) >= 2:
        bloc_suite = BLOC_1COULEUR if len({p["sous"] for p in plans3}) >= 2 \
            and film_distinct(plans3, BLOC_1COULEUR) >= 2 else BLOC_COULEURS
    else:
        bloc_suite = BLOC_1COULEUR if plans3 and \
            film_distinct(plans3, BLOC_1COULEUR) * BLOC_1COULEUR >= DUREE_MINI_PUB - 1e-6 \
            else BLOC_COULEURS
    plans = []
    if len(fams) >= 2 or bloc_suite == BLOC_COULEURS:
        plans += plans_possibles(cands, BLOC_COULEURS, par_seg=par_seg)
    if bloc_suite == BLOC_1COULEUR:
        plans += plans3
    # LE FILM DISTINCT (07/10/2026) : combien de blocs on peut poser SANS
    # remontrer plus de REVU_MAXI du meme film. Les « coupes » sont espacees
    # de 0,25 s : leur nombre ne dit PAS combien de blocs differents existent.
    ouv_n = len(fams) if len(fams) >= 2 else 0
    distinct_suite = film_distinct(plans, bloc_suite)
    distinct = (ouv_n + distinct_suite) if bloc_suite == BLOC_1COULEUR and ouv_n \
        else film_distinct(plans, bloc_suite)
    d = {"regle": REGLE_CACHE, "source": source, "modele": mod["nom"],
         "bloc_ouverture": BLOC_COULEURS if len(fams) >= 2 else None,
         "bloc_suite": bloc_suite, "bloc": bloc_suite,
         "une_seule_prise": len({p["sous"] for p in plans}) == 1,
         "coupes_du_rush": [[r, t] for r, t in vu.get("coupes", [])],
         "coupes_a_cheval": sum(1 for p in plans if p.get("traverse_une_coupe")),
         "couleurs": len(fams),
         # d'ou viennent les familles : les coloris du PLAN (confirmes par le
         # client) ou, sans coloris, la distance des pixels
         "familles_de": "plan" if all(g.get("coloris") for g in fams) and fams else "pixels",
         "coloris": [g.get("coloris") or "" for g in fams],
         "coloris_sans_matiere": sorted({_coloris(s.get("coloris")) for s in mod["segments"]
                                         if _coloris(s.get("coloris"))}
                                        - {g.get("coloris") for g in fams})
         if all(g.get("coloris") for g in fams) else [],
         "centres": [[round(x, 1) for x in g["centre"]] for g in fams],
         "secondes_de_matiere": round(sum(c["duree"] for c in cands), 2),
         # au plus ce nombre de blocs sans film revu (ouvertures comprises)
         "blocs_distincts": distinct,
         "film_distinct_3s_trop_court": court3,
         "sous_segments": cands, "plans": plans}
    os.makedirs(sortie, exist_ok=True)
    _ecrire_json(cache, d)
    return d


def juge_plaque(M, texte, cible, rushes, travail):
    """Le juge du CHOIX des blocs : p -> a combien de ses trois instants la
    plaque POV couvre le visage. Seulement en natif (en « bande », la plaque
    est sur le fond, au-dessus de l'image ; en « plein », hors sujet ici).
    `rushes` : de quoi connaitre la taille si la cible manque."""
    if STYLE != "natif":
        return None
    taille = cible
    if not taille:
        for c in rushes:
            t = taille_redressee(c["fichier"], c["couche"])
            if t and t[0] > 0:
                taille = t
                break
    if not taille:
        return None
    boite = boite_plaque(M, texte, taille, travail)
    hijab = niche_hijab()

    def juge(p):
        """(rang, sous-cle) de la tete du bloc (`rang_tete`)."""
        return tete_du_bloc(p["fichier"], p["couche"], p["debut"],
                            p.get("longueur", BLOC_1COULEUR), cible, boite,
                            hijab, choix=True)["rang"]
    return juge


def niche_hijab(pov=None):
    """La niche est-elle le hijab ? (le produit, c'est alors aussi la tete :
    la tete dans le cadre passe avant la plaque, et une tete non vue est
    MARQUEE)."""
    return "hijab" in str(NICHE if pov is None else pov or "").lower()


def juger_plaque(blocs, dossier, info, taille, cible, pov=None):
    """LA PLAQUE ET LA TETE, bloc par bloc, avec la boite VRAIMENT brulee
    (manita.py la rend dans info["plaque"]). On lit le RUSH (la plaque
    assombrit la video) tel que le bloc le montre. Un bloc est marque « plaque
    sur le visage » quand la plaque couvre le visage a VISAGE_MAXI de ses
    trois instants ; en niche hijab, « tete non vue » quand la tete n'est pas
    vue (hors du cadre, de dos, cachee) a deux instants — un seul pour la
    VIGNETTE (07/10/2026 : un visage non vu valait « plaque hors du visage »).
    Ecrit dans chaque bloc ses couvertures (None : visage non vu) et l'etat de
    la tete ; rend {plaque, sur_le_visage, tete_non_vue}."""
    b = (info or {}).get("plaque") or {}
    boite = boite_relative(b["boite"], taille) if b.get("boite") and taille and taille[0] else None
    hijab = niche_hijab(pov)
    res = {"plaque": {"boite": list(boite) if boite else None,
                      "mesuree": bool(boite and STYLE == "natif"),
                      "niche_hijab": hijab},
           "sur_le_visage": [], "tete_non_vue": []}
    if not res["plaque"]["mesuree"]:
        return res
    for k, bl in enumerate(blocs, 1):
        t = tete_du_bloc(os.path.join(dossier, bl["rush"]), bl.get("couche", False),
                         bl["debut"], bl["longueur"], cible, boite, hijab)
        bl["plaque_couvre_le_visage"] = t["couvertures"]
        bl["tete"] = t["etats"]
        sur, non_vue = marque_tete(t["etats"], hijab, vignette=(k == 1))
        if sur:
            bl["plaque_sur_le_visage"] = True
            res["sur_le_visage"].append(k)
        if non_vue:
            bl["tete_non_vue"] = True
            res["tete_non_vue"].append(k)
    return res


def a_regarder(plaque, rythme, regle):
    """Ce qu'un humain doit REGARDER avant de publier (la planche tranche)."""
    out = []
    if plaque["sur_le_visage"]:
        out.append("plaque sur le visage : bloc(s) %s (la plaque reste en haut, "
                   "decision du vendeur ; regarde la planche)"
                   % ", ".join(str(x) for x in plaque["sur_le_visage"]))
    if plaque.get("tete_non_vue"):
        out.append("tete non vue : bloc(s) %s (hors du cadre, de dos ou cachee : le "
                   "hijab ne se voit pas, ou le visage est peut-etre sous la plaque%s ; "
                   "regarde la planche)"
                   % (", ".join(str(x) for x in plaque["tete_non_vue"]),
                      " ; le bloc 1 fait la VIGNETTE" if 1 in plaque["tete_non_vue"] else ""))
    if rythme is not None and not rythme.get("ok"):
        out.append("rythme %s non relu tel quel dans la video (%s)" % (regle, _rythme_court(rythme)))
    return out


def colles_aveugles(colles, blocs, centres):
    """LES COULEURS DU PLAN QUE L'INSTRUMENT NE SAIT PAS SEPARER (07/10/2026).
    `controler_couleurs` rend les blocs relus de la meme couleur que le
    precedent. Quand les deux blocs sont de deux coloris DIFFERENTS du plan
    (confirmes par le client) dont les centres mesures sont plus proches que
    SEUIL_RELU (un « clair » et un « marine » qui ne different que par le
    hijab), la relecture est AVEUGLE : la paire est montree, pas comptee —
    comme `couleurs_aveugles` en --rushes. Deux blocs du MEME coloris, ou de
    deux coloris bien separes, comptent toujours. Rend (comptent, aveugles)."""
    comptent, aveugles = [], []
    for x in colles or []:
        k = x - 1                                # le second bloc de la paire (0..)
        try:
            fa, fb = blocs[k - 1]["coloris"] - 1, blocs[k]["coloris"] - 1
            proche = fa != fb and math.dist(centres[fa], centres[fb]) < SEUIL_RELU
        except (IndexError, KeyError, TypeError):
            proche = False
        (aveugles if proche else comptent).append(x)
    return comptent, aveugles


def verdict(base_ok, plaque, regarder):
    """« conforme », « A REGARDER » (rien de casse, mais la plaque couvre un
    visage ou le rythme n'est pas relu) ou « A REVOIR »."""
    if not base_ok:
        return "A REVOIR"
    return "A REGARDER" if (regarder or plaque["sur_le_visage"]
                            or plaque.get("tete_non_vue")) else "conforme"


def musiques_des_variantes(mus, n_variantes, nb_fams, suite):
    """LA MUSIQUE DE CHAQUE VARIANTE (07/10/2026). La variante i prend la
    musique i ; une musique trop courte pour une pub (moins de DUREE_LIVREE_VISEE
    de blocs entiers — la loi des dix secondes du 08/10/2026 —, ou moins de
    deux blocs) cede a la SUIVANTE qui n'a pas
    encore servi (puis a la suivante tout court). Calcule pour toutes les
    variantes d'un coup : des paquets --de / --a donnent le meme choix.
    Rend ({variante (0..): musique}, {musique: duree}, {musiques trop courtes})."""
    durees = {m: duree(m) for m in mus}

    def assez(m):
        # LOI DES DIX SECONDES (08/10/2026) : les blocs entiers que la musique
        # porte doivent DEPASSER 10 s (visee 10,2 s), sinon elle cede
        L = longueurs_blocs(durees[m], nb_fams, entiers=True, maxi=BLOCS_MAXI_MODELE, suite=suite)
        return len(L) >= 2 and sum(L) >= DUREE_LIVREE_VISEE - 1e-6

    choix, servies = {}, set()
    courtes = {m for m in mus if not assez(m)}
    for i in range(n_variantes):
        ordre = [mus[(i + k) % len(mus)] for k in range(len(mus))]
        bonnes = [m for m in ordre if m not in courtes]
        m = next((x for x in bonnes if x not in servies), None) or (bonnes[0] if bonnes else ordre[0])
        choix[i] = m
        servies.add(m)
    return choix, durees, courtes


def blocs_presents(longs, d_video):
    """Combien des blocs (longueurs) sont dans une video de d_video secondes,
    avec la tolerance de « finit avec la musique » (0,45 s)."""
    n, cumul = 0, 0.0
    for L in longs:
        cumul += L
        if cumul > d_video + 0.45:
            break
        n += 1
    return n


def monter_un_modele(a, M, accroches, travail):
    """Le montage MODELE PAR MODELE. Une variante ne prend ses secondes que
    dans les segments que le plan attribue a CE modele. C'est ce qui manquait
    le 21/09/2026."""
    plan = lire_plan(a.plan)
    mod = None
    for m in plan["modeles"]:
        if m["nom"] == a.modele:
            mod = m; break
    if mod is None:
        print("modele inconnu : %s (%s)" % (a.modele,
              ", ".join(m["nom"] for m in plan["modeles"])), file=sys.stderr)
        return 2
    os.makedirs(a.sortie, exist_ok=True)

    print("1. je lis les segments de « %s » ..." % mod["nom"])
    # les exclusions et les bords disputes du plan, retires (07/10/2026)
    for x in plan.get("avertissements") or []:
        print("   [PLAN] %s" % x)
    prep = preparer_modele(plan, mod, a.sortie, travail, a.preparer)
    cands, plans = prep["sous_segments"], prep["plans"]
    bloc_suite = prep["bloc_suite"]
    nb_fams = prep["couleurs"]
    print("   %d segment(s) du plan -> %d sous-segment(s), %d coloris, "
          "%.1f s de matiere, rythme %s"
          % (len(mod["segments"]), len(cands), nb_fams,
             prep["secondes_de_matiere"], regle_texte(nb_fams, bloc_suite)))
    noms_coul = prep.get("coloris") or [""] * len(prep["centres"])
    print("   les coloris viennent %s"
          % ("du PLAN (confirmes par le client), un par nom"
             if prep.get("familles_de") == "plan"
             else "des pixels (le plan ne donne pas de coloris a chaque segment)"))
    for j, c in enumerate(prep["centres"]):
        n = sum(1 for x in cands if x["famille"] == j)
        print("   coloris %d : %-12s %-18s %d sous-segment(s)"
              % (j + 1, (noms_coul[j] if j < len(noms_coul) else "") or "-",
                 tuple(int(v) for v in c), n))
    if prep.get("coloris_sans_matiere"):
        print("   [A SAVOIR] coloris du plan sans assez de matiere pour un bloc : %s"
              % ", ".join(prep["coloris_sans_matiere"]))
    print("   %d coupe(s) possibles, %d bloc(s) DIFFERENTS au plus (sans remontrer "
          "le meme film)" % (len(plans), prep.get("blocs_distincts") or 0))
    if prep.get("film_distinct_3s_trop_court") is not None:
        print("   [A SAVOIR] une couleur, mais le film DISTINCT ne porte que %d bloc(s) de "
              "%.1f s (moins de %.0f s) : la suite passe a %.1f s sur toutes les prises"
              % (prep["film_distinct_3s_trop_court"], BLOC_1COULEUR, DUREE_MINI_PUB,
                 BLOC_COULEURS))
    cr = prep.get("coupes_du_rush") or []
    if cr:
        print("   %d coupe(s) deja presente(s) dans les rushes (%s) : %s"
              % (len(cr), ", ".join("%s %.2f s" % (r, t) for r, t in cr[:4])
                 + (" ..." if len(cr) > 4 else ""),
                 "%d coupe(s) de 1,6 s y restent a cheval (plans plus courts "
                 "que le bloc)" % prep["coupes_a_cheval"]
                 if prep.get("coupes_a_cheval") else "aucun bloc ne les traverse"))
    if bloc_suite != BLOC_1COULEUR and prep.get("film_distinct_3s_trop_court") is None:
        print("   [A SAVOIR] la matiere ne porte pas de bloc de %.1f s%s : "
              "la suite reste a %.1f s" % (BLOC_1COULEUR,
                                          " entre deux coupes du rush" if cr else "",
                                          bloc_suite))
    if prep.get("une_seule_prise"):
        print("   une seule prise : deux blocs voisins y partagent le moins de film "
              "possible (%.1f s au plus si la prise le permet) et sont pris a %.1f s "
              "l'un de l'autre quand elle le permet" % (REVU_MAXI, ECART_MEME_PRISE))
    if a.preparer:
        return 0

    mus = musiques(a.musiques)
    if a.musiques and not mus:
        print("   [A SAVOIR] aucune musique lisible dans %s : videos SANS son"
              % a.musiques)
    # LE NATIF QUAND LES TAILLES DIFFERENT : la taille majoritaire des rushes
    # du modele (un rush = une voix), les autres blocs y sont REMPLIS
    cible = None
    if STYLE == "natif":
        vus = {}
        for c in cands:
            vus.setdefault(c["rush"], taille_redressee(c["fichier"], c["couche"]))
        cible = taille_majoritaire(vus.values())
        autres = sorted(r for r, t in vus.items() if t != cible)
        if cible and autres:
            print("   tailles differentes : %d rush(es) hors de %s, REMPLIS (ni flou "
                  "ni barres) : %s" % (len(autres), _taille_txt(cible),
                                        ", ".join("%s %s" % (r, _taille_txt(vus[r]))
                                                  for r in autres[:6])))
    faits = _rapport_charger(a.sortie)
    # UNE SORTIE = UN MODELE. Ce qu'un autre modele (ou un autre plan) a laisse
    # ici part, video et planche comprises : sinon deux modeles se cotoient
    # dans le meme dossier livre. Un plan seulement deplace (son ancien chemin
    # n'existe plus) n'est pas un autre plan.
    def autre(f):
        ecrit = f.get("plan") or ""
        return (f.get("modele") != mod["nom"] or not ecrit
                or (os.path.isfile(ecrit) and os.path.realpath(ecrit) != os.path.realpath(a.plan)))
    partis = [f for f in faits if autre(f)]
    for f in partis:
        num = f.get("variante")
        if isinstance(num, int):
            _retirer(os.path.join(a.sortie, "variante_%02d.mp4" % num))
            _retirer(os.path.join(a.sortie, "_planche_variante_%02d.png" % num))
    if partis:
        print("   %d variante(s) d'un autre modele retiree(s) de la sortie" % len(partis))
    faits = [f for f in faits if not autre(f) and not (a.de <= f.get("variante", 0) <= a.a)]

    _coul = {}

    def mesurer(p):
        """La couleur DU POINT DE COUPE, avec le meme instrument que le
        controle. Mise en cache : le meme plan revient d'une variante a
        l'autre."""
        cle = (p["rush"], round(p["debut"], 2), p.get("longueur"))
        if cle not in _coul:
            _coul[cle] = (couleur_a(p["fichier"],
                                    p["debut"] + p.get("longueur", bloc_suite) / 2.0,
                                    p["couche"], travail) or p["couleur"])
        return _coul[cle]

    # LA MUSIQUE DE CHAQUE VARIANTE : une musique trop courte pour une pub
    # cede a la suivante (07/10/2026), calcule pour toutes les variantes d'un
    # coup (les paquets --de / --a donnent le meme choix)
    choix_mus, durees_mus, courtes_mus = musiques_des_variantes(
        mus, max(a.a, 10), nb_fams, bloc_suite) if mus else ({}, {}, set())
    # LE NOMBRE DE BLOCS : jamais plus que de blocs DIFFERENTS (le film
    # distinct), sauf pour atteindre une pub de DUREE_MINI_PUB — et alors le
    # film revu est MARQUE
    distincts = int(prep.get("blocs_distincts") or len(plans))
    mini_pub = BLOCS_MAXI_MODELE         # les blocs qu'il faut pour DEPASSER 10 s
    for n_ in range(1, BLOCS_MAXI_MODELE + 1):
        if sum(longueurs_blocs(99.0, nb_fams, entiers=True, maxi=n_,
                               suite=bloc_suite)) >= DUREE_LIVREE_VISEE - 1e-6:
            mini_pub = n_
            break
    maxi_blocs = min(BLOCS_MAXI_MODELE, max(distincts, mini_pub))
    if distincts < mini_pub:
        print("   [A SAVOIR] la matiere ne porte que %d bloc(s) differents : une pub de plus de %.0f s "
              "remontrera du film deja vu (MARQUE « film revu », A REGARDER)"
              % (distincts, DUREE_MINI_LIVREE))

    print("")
    print("2. je monte les variantes %d a %d, style %s, modele « %s »"
          % (a.de, a.a, STYLE, mod["nom"]))
    for i in range(a.de - 1, a.a):
        num = i + 1
        dest = os.path.join(a.sortie, "variante_%02d.mp4" % num)
        pl_dest = os.path.join(a.sortie, "_planche_variante_%02d.png" % num)
        # une variante refaite : l'ancienne video n'a plus de ligne au rapport,
        # elle ne doit pas rester si celle-ci tombe
        _retirer(dest); _retirer(pl_dest)
        mus_i = choix_mus.get(i) if mus else None
        d_mus = durees_mus.get(mus_i, 0.0) if mus_i else DUREE_SANS_MUSIQUE
        a_savoir, a_revoir = [], []
        if mus_i and mus_i != mus[i % len(mus)]:
            # 07/10/2026 (casse) : la musique i n'est pas toujours TROP COURTE —
            # elle peut avoir deja servi a une variante precedente, dont la
            # musique trop courte lui a cede la place (le dire juste)
            orig = mus[i % len(mus)]
            if orig in courtes_mus:
                a_savoir.append("musique %s (%.1f s) trop courte pour une pub : %s a la place"
                                % (os.path.basename(orig), durees_mus.get(orig, 0.0),
                                   os.path.basename(mus_i)))
            else:
                a_savoir.append("musique %s deja prise par une variante precedente (une "
                                "musique trop courte lui a cede la place) : %s a la place"
                                % (os.path.basename(orig), os.path.basename(mus_i)))
        # LA REGLE : des blocs entiers (1,6 s par couleur, puis 3 s), jamais
        # plus longs que la musique, jamais plus que de blocs DIFFERENTS
        tiennent = longueurs_blocs(d_mus, nb_fams, entiers=True, maxi=BLOCS_MAXI_MODELE,
                                   suite=bloc_suite)
        longs = tiennent[:maxi_blocs]
        if len(longs) < len(tiennent) and distincts < len(tiennent):
            a_savoir.append("film distinct : %d bloc(s) differents au plus (la musique en "
                            "portait %d) : video de %.1f s, musique coupee avec un fondu"
                            % (len(longs), len(tiennent), sum(longs)))
        if sum(longs) < DUREE_MINI_PUB - 1e-6 and longs:
            a_savoir.append("musique courte (%.1f s) : %d bloc(s) seulement" % (d_mus, len(longs)))
        angle, texte = accroches[i % len(accroches)]
        # LA PLAQUE RESTE EN HAUT (decision du vendeur) : on choisit des blocs
        # ou la tete est dans le cadre et le visage DESSOUS. La boite est celle
        # que manita.py dessinera pour CE texte, a CETTE taille (07/10/2026).
        juge = juge_plaque(M, texte, cible, cands, travail)
        blocs, morceaux = [], []
        try:
            if not longs:
                raise RuntimeError("musique trop courte (%.2f s) pour un bloc de %.1f s"
                                   % (d_mus, BLOC_COULEURS if nb_fams >= 2 else bloc_suite))
            suite = suite_de_plans(plans, max(1, nb_fams), i, longs, mesurer, juge)
            # LE FILM REVU (07/10/2026) : un bloc qui remontre plus de
            # REVU_MAXI d'un bloc precedent. La video s'arrete avant lui tant
            # qu'elle garde DUREE_MINI_PUB ; sinon il reste, MARQUE.
            revus = films_revus([dict(pl, longueur=L) for pl, L in zip(suite, longs)])
            if revus:
                r0 = revus[0] - 1
                if r0 >= 2 and sum(longs[:r0]) >= DUREE_LIVREE_VISEE - 1e-6:
                    a_savoir.append("bloc(s) %s remontraient un film deja vu : la video "
                                    "s'arrete au bloc %d (%.1f s)"
                                    % (", ".join(str(x) for x in revus), r0, sum(longs[:r0])))
                    suite, longs = suite[:r0], longs[:r0]
                    revus = []
            duree_cible = round(sum(longs), 3)
            for k, pl in enumerate(suite):
                L = longs[k]
                b = os.path.join(travail, "v%02d_b%d.mp4" % (num, k))
                bloc(pl["fichier"], pl["couche"], pl["debut"], b, L, cible)
                morceaux.append(b)
                fam = prep["coloris"][pl["famille"]] if pl["famille"] < len(prep.get("coloris") or []) else ""
                blocs.append({"rush": pl["rush"], "debut": pl["debut"],
                              "fin": round(pl["debut"] + L, 2),
                              "longueur": L, "couche": pl["couche"],
                              "coloris": pl["famille"] + 1,
                              "sous_segment": pl["sous"]})
                if fam:
                    blocs[-1]["coloris_du_plan"] = fam
                if pl.get("traverse_une_coupe"):
                    blocs[-1]["traverse_une_coupe"] = True
                t_rush = taille_redressee(pl["fichier"], pl["couche"])
                if cible and t_rush != cible:
                    blocs[-1]["rempli"] = _taille_txt(cible)
                    blocs[-1]["taille_du_rush"] = _taille_txt(t_rush)
            liste = os.path.join(travail, "l%02d.txt" % num)
            with open(liste, "w", encoding="utf-8") as fh:
                for m2 in morceaux:
                    fh.write("file '%s'\n" % os.path.abspath(m2).replace("'", "'\\''"))
            muet = os.path.join(travail, "m%02d.mp4" % num)
            r = lancer(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
                        "-i", liste, "-c", "copy", muet, "-y"], 300)
            if r.returncode != 0:
                raise RuntimeError(r.stderr.strip()[:200])
            avec = os.path.join(travail, "a%02d.mp4" % num)
            if mus_i:
                deb_mus = musique_forte(mus_i, duree_cible)
                nom_mus = "%s (a %.1f s)" % (os.path.basename(mus_i), deb_mus)
                if not poser_musique(muet, mus_i, deb_mus, duree_cible, avec):
                    shutil.copy(muet, avec); nom_mus = "AUCUNE (musique refusee)"
            else:
                # pas de musique (le client n'en a pas donne) : la video sort
                # muette, a la duree des blocs
                shutil.copy(muet, avec); nom_mus = "AUCUNE (pas de musique)"
            info = M.bruler_pov(avec, texte, dest)

            pov_ok = pov_conforme(info, bool(mus_i))
            d_fin = duree(dest)
            avec_mus = abs(d_fin - duree_cible) <= 0.45
            # UNE VIDEO PLUS COURTE QUE SES BLOCS (une musique plus courte que
            # prevu) : les blocs absents ne sont pas relus — « musique trop
            # courte », jamais « deux modeles » (07/10/2026)
            n_lus = blocs_presents(longs, d_fin)
            if n_lus < len(blocs):
                a_revoir.append("musique trop courte : la video fait %.2f s pour %.2f s de "
                                "blocs, bloc(s) %s absent(s)"
                                % (d_fin, duree_cible,
                                   ", ".join(str(x) for x in range(n_lus + 1, len(blocs) + 1))))
            elif not avec_mus:
                a_revoir.append("la video fait %.2f s au lieu de %.2f s" % (d_fin, duree_cible))
            # LOI DES DIX SECONDES (08/10/2026) : jamais livree comme bonne
            trop_courte = d_fin <= DUREE_MINI_LIVREE + 1e-6
            if trop_courte:
                a_revoir.append("trop_courte : %.2f s, une video livree depasse %.0f s"
                                % (d_fin, DUREE_MINI_LIVREE))
            fautes, det = controler_un_seul_modele(dest, blocs[:n_lus], plan,
                                                   mod["nom"], travail)
            # une seule couleur : deux blocs voisins ont la meme couleur par
            # definition (l'alternance se fait entre les scenes)
            colles = controler_couleurs(dest, longs[:n_lus]) if nb_fams >= 2 else []
            colles, aveugles = colles_aveugles(colles, blocs, prep["centres"]) \
                if prep.get("familles_de") == "plan" else (colles, [])
            rythme = mesurer_rythme(dest, longs[:n_lus])
            l, h = dimensions(dest)
            # la definition attendue : la taille majoritaire du modele (le
            # premier rush ne suffit pas : il peut etre couche, ou minoritaire)
            ls, hs = cible or taille_redressee(os.path.join(plan["rushes"], blocs[0]["rush"]),
                                               blocs[0]["couche"])
            natif = (STYLE != "natif") or (l == ls and h == hs)
            pc = planche(dest, os.path.join(a.sortie,
                         "_planche_variante_%02d.png" % num),
                         "%s — variante %02d  %s  %s"
                         % (mod["nom"], num, angle, nom_mus))
            if fautes:
                for x in fautes[:6]:
                    print("   [ECHEC] variante_%02d : %s" % (num, x))
            if not natif:
                print("   [ECHEC] variante_%02d : %dx%d au lieu de %dx%d "
                      "(la taille majoritaire du modele)" % (num, l, h, ls, hs))
            # LA PLAQUE SUR LE VISAGE, mesuree bloc par bloc avec la VRAIE boite
            # brulee : jamais « conforme » en silence
            plaque = juger_plaque(blocs, plan["rushes"], info, (l, h), cible)
            base_ok = bool(pov_ok and not fautes and natif and not colles and avec_mus
                           and not trop_courte)
            regarder = a_regarder(plaque, rythme, regle_texte(nb_fams, bloc_suite))
            if revus:
                regarder.append("film revu : bloc(s) %s remontrent plus de %.1f s d'un bloc "
                                "precedent (la matiere ne porte que %d bloc(s) differents ; "
                                "regarde la planche)"
                                % (", ".join(str(x) for x in revus), REVU_MAXI, distincts))
            if aveugles:
                regarder.append("blocs %s relus de la meme couleur que le precedent, mais "
                                "de deux coloris du plan que la mesure ne separe pas : "
                                "mesure aveugle, regarde la planche"
                                % ", ".join(str(x) for x in aveugles))
            faits.append({
                "variante": num, "fichier": dest, "modele": mod["nom"],
                "plan": os.path.abspath(a.plan), "style": STYLE,
                "angle": angle, "accroche": texte, "musique": nom_mus,
                "duree": round(d_fin, 2), "duree_visee": round(duree_cible, 2),
                "trop_courte": bool(trop_courte),
                "definition": "%dx%d" % (l, h),
                "definition_du_rush": "%dx%d" % (ls, hs),
                "definition_cible": _taille_txt(cible) if cible else None,
                "blocs_remplis": sum(1 for b in blocs if b.get("rempli")),
                # 06/10/2026 : blocs poses a cheval sur une coupe DEJA dans le
                # rush (seulement quand leur couleur n'a aucune place propre)
                "blocs_a_cheval": sum(1 for b in blocs if b.get("traverse_une_coupe")),
                "reste_dans_sa_definition": bool(natif),
                "nb_couleurs": nb_fams, "regle": regle_texte(nb_fams, bloc_suite),
                "bloc_suite": bloc_suite, "longueurs": longs,
                "rythme_relu": rythme,
                "blocs": blocs, "blocs_colles": colles,
                "blocs_colles_aveugles": aveugles,
                "centres_coloris": prep["centres"],
                "modeles_dans_la_video": 1 if not fautes else 2,
                "un_seul_modele": not fautes,
                "fautes_de_modele": fautes,
                "controle_bloc_par_bloc": det,
                "finit_avec_la_musique": avec_mus,
                "suite": ["%s@%.2f" % (b["rush"], b["debut"]) for b in blocs],
                "coloris_du_plan": prep.get("coloris") if prep.get("familles_de") == "plan" else None,
                "pov": NICHE,
                "plaque": plaque["plaque"],
                "plaque_sur_le_visage": plaque["sur_le_visage"],
                "tete_non_vue": plaque["tete_non_vue"],
                # 07/10/2026 : un bloc qui remontre plus de REVU_MAXI d'un bloc
                # precedent (jamais « conforme »), et le film distinct du modele
                "film_revu": revus,
                "blocs_distincts": distincts,
                "a_savoir": a_savoir,
                "a_revoir": a_revoir + fautes[:4],
                "a_regarder": regarder,
                "conforme": bool(base_ok and verdict(base_ok, plaque, regarder) == "conforme"),
                "verdict": verdict(base_ok, plaque, regarder),
                "pov_conforme": bool(pov_ok),
                "planche": pc})
            if colles:
                print("   [ECHEC] variante_%02d : blocs %s de la meme couleur "
                      "que le precedent" % (num, ", ".join(str(x) for x in colles)))
            for x in a_revoir:
                print("   [ECHEC] variante_%02d : %s" % (num, x))
            for x in a_savoir:
                print("   [A SAVOIR] variante_%02d : %s" % (num, x))
            for x in regarder:
                print("   [A REGARDER] variante_%02d : %s" % (num, x))
            print("   [%s] variante_%02d  %2d blocs  %5.1f s  %s  %-30s %s"
                  % ({"conforme": "OK"}.get(faits[-1]["verdict"], faits[-1]["verdict"]),
                     num, len(blocs), d_fin, "%dx%d" % (l, h),
                     (os.path.basename(mus_i) if mus_i else "sans musique")[:30], angle))
        except Exception as e:
            print("   [ECHEC] variante_%02d : %s" % (num, str(e)[:200]))
            _retirer(dest); _retirer(pl_dest)
        _rapport_ecrire(a.sortie, faits)
        _vider(travail)
    _rapport_ecrire(a.sortie, faits)
    print("")
    print("%d variante(s) dans %s" % (len(faits), a.sortie))
    return 0


def _retrouver(ecrit, dossier):
    """Un dossier ecrit dans le rapport, retrouve meme sur une autre machine :
    le chemin ecrit, sinon le meme NOM a cote du dossier livre."""
    if ecrit and os.path.isdir(ecrit):
        return ecrit
    nom = os.path.basename((ecrit or "").rstrip("/\\"))
    d = os.path.abspath(dossier)
    for _ in range(4):
        c = os.path.join(d, nom)
        if nom and os.path.isdir(c):
            return c
        d = os.path.dirname(d)
    return None


def _video_du_rapport(f, dossier):
    v = f.get("fichier") or ""
    if not os.path.isfile(v):
        v = os.path.join(dossier, os.path.basename(v))
    return v


def verifier_dossier(dossier, travail):
    """LE VERIFICATEUR. Il ne croit pas le rapport : il RE-APPELLE ffmpeg sur
    chaque video livree et sur chaque rush source. A lancer sur la machine du
    client : le bac a sable tourne ailleurs, avec un autre ffmpeg.
    Deux sortes de sortie :
      --plan   : chaque bloc dans un segment du modele, et l'image relue
                 ressemble a sa source plus qu'a tout autre modele ;
      --rushes : le dossier EST le modele ; chaque bloc relu doit etre
                 l'image de son rush, a l'instant ecrit.
    Dans les deux : la regle 1,6 / 3 s des longueurs ecrites, et le rythme
    relu sur la video (A REGARDER s'il n'est pas relu tel quel)."""
    faits = _rapport_charger(dossier)
    if not faits:
        print("pas de _rapport.json lisible dans %s" % dossier, file=sys.stderr)
        return 2
    r = lancer(["ffmpeg", "-version"], 60)
    print("ffmpeg de CETTE machine : %s"
          % ((r.stdout or r.stderr or "?").splitlines() or ["?"])[0][:70])
    print("")
    try:
        if any(f.get("plan") for f in faits):
            return _verifier_plan(dossier, faits, travail)
        return _verifier_rushes(dossier, faits, travail)
    except (RuntimeError, KeyError, ValueError, TypeError, OSError) as e:
        # un rapport abime ou incomplet : on le dit, sans trace Python
        print("verification impossible : %s %s" % (type(e).__name__, e), file=sys.stderr)
        return 2


def _rythme_et_regle(v, f, longs):
    """Le rythme relu et les fautes de regle d'une variante (rapport v0.3.8 ;
    un rapport plus ancien n'a pas de regle a tenir)."""
    rythme = mesurer_rythme(v, longs)
    regle = []
    if "nb_couleurs" in f:
        regle = regle_respectee(longs, f["nb_couleurs"],
                                f.get("bloc_suite", BLOC_1COULEUR))
    return rythme, regle


def remesurer_plaque(f, dossier_rushes):
    """LA PLAQUE ET LA TETE, RE-MESUREES par le verificateur (il ne croit
    pas le rapport) : la boite ecrite au rapport, les rushes relus ici, la
    niche ecrite au rapport (« pov »). Rend {"sur_le_visage": [blocs],
    "tete_non_vue": [blocs]}, ou None si rien a mesurer."""
    pl = f.get("plaque") or {}
    if not pl.get("mesuree") or not pl.get("boite") or not dossier_rushes:
        return None
    cible = _lire_taille(f.get("definition_cible") or "")
    hijab = niche_hijab(f.get("pov") if "pov" in f else (pl.get("niche_hijab") and "hijab"))
    res = {"sur_le_visage": [], "tete_non_vue": []}
    for k, b in enumerate(f.get("blocs") or [], 1):
        src = os.path.join(dossier_rushes, b["rush"])
        if not os.path.isfile(src):
            continue
        t = tete_du_bloc(src, b.get("couche", False), b["debut"], b["longueur"],
                         cible, tuple(pl["boite"]), hijab)
        sur, non_vue = marque_tete(t["etats"], hijab, vignette=(k == 1))
        if sur:
            res["sur_le_visage"].append(k)
        if non_vue:
            res["tete_non_vue"].append(k)
    return res


def _dire_tete(visage):
    """Les lignes A REGARDER de la tete re-mesuree par le verificateur."""
    out = []
    if visage and visage.get("sur_le_visage"):
        out.append("A REGARDER : plaque sur le visage, bloc(s) %s"
                   % ", ".join(str(x) for x in visage["sur_le_visage"]))
    if visage and visage.get("tete_non_vue"):
        out.append("A REGARDER : tete non vue (hors du cadre, de dos ou cachee), bloc(s) %s"
                   % ", ".join(str(x) for x in visage["tete_non_vue"]))
    return out


def _verifier_plan(dossier, faits, travail):
    plan = lire_plan(trouver_plan(faits[0].get("plan"), dossier))
    print("mode       : --plan (un modele pris dans un plan)")
    print("plan       : %s" % plan.get("lot"))
    print("rushes     : %s" % plan["rushes"])
    print("")
    ok_tout = True
    lignes = []
    for f in faits:
        v = _video_du_rapport(f, dossier)
        if not os.path.isfile(v) or os.path.getsize(v) == 0:
            print("[ECHEC] %s : absente ou vide" % os.path.basename(v))
            ok_tout = False; continue
        d = duree(v)
        longs = f.get("longueurs") or [b["longueur"] for b in f["blocs"]]
        # une video plus courte que ses blocs : les blocs absents ne sont pas
        # relus — « musique trop courte », jamais « deux modeles » (07/10/2026)
        n_lus = blocs_presents(longs, d)
        courte = []
        # LOI DES DIX SECONDES (08/10/2026) : relue sur le fichier
        if d <= DUREE_MINI_LIVREE + 1e-6:
            courte.append("trop_courte : %.2f s, une video livree depasse %.0f s" % (d, DUREE_MINI_LIVREE))
        if n_lus < len(f["blocs"]):
            courte += ["musique trop courte : video de %.2f s pour %.2f s de blocs, bloc(s) "
                      "%s absent(s)" % (d, sum(longs), ", ".join(
                          str(x) for x in range(n_lus + 1, len(f["blocs"]) + 1)))]
        fautes, det = controler_un_seul_modele(v, f["blocs"][:n_lus], plan,
                                               f["modele"], travail,
                                               f.get("style"))
        l, h = dimensions(v)
        ls, hs = [int(x) for x in f["definition_du_rush"].split("x")]
        natif = (f.get("style") != "natif") or (l == ls and h == hs)
        colles = controler_couleurs(v, longs[:n_lus]) if f.get("nb_couleurs", 2) >= 2 else []
        if f.get("coloris_du_plan") and f.get("centres_coloris"):
            colles, _aveugles = colles_aveugles(colles, f["blocs"], f["centres_coloris"])
        rythme, regle = _rythme_et_regle(v, f, longs[:n_lus])
        bon = (not fautes) and natif and not colles and not regle and not courte
        ok_tout = ok_tout and bon
        visage = remesurer_plaque(f, plan["rushes"])
        # le film revu, recompte sur les blocs ecrits (07/10/2026)
        revus = films_revus(f["blocs"])
        lignes.append({"variante": f["variante"], "mode": "plan",
                       "duree": round(d, 2), "definition": "%dx%d" % (l, h),
                       "modeles_detectes": 1 if not fautes else 2,
                       "longueurs": longs, "regle_fautes": regle,
                       "rythme_ok": rythme["ok"], "rythme": _rythme_court(rythme),
                       "plaque_sur_le_visage": (visage or {}).get("sur_le_visage") if visage else None,
                       "tete_non_vue": (visage or {}).get("tete_non_vue") if visage else None,
                       "film_revu": revus,
                       "a_regarder": bool(_dire_tete(visage) or revus or not rythme["ok"]),
                       "ok": bon, "fautes": (courte + fautes + regle)[:4]})
        print("[%-6s] variante_%02d  %5.1f s  %-9s  modeles dedans : %d  "
              "coupes relues : %d  rythme : %s"
              % ("OK" if bon else "ECHEC", f["variante"], d, "%dx%d" % (l, h),
                 1 if not fautes else 2, len(det),
                 "OK" if rythme["ok"] else "A REGARDER (%s)" % _rythme_court(rythme)))
        for x in (courte + fautes + regle)[:4]:
            print("          %s" % x)
        for x in _dire_tete(visage):
            print("          %s" % x)
        if revus:
            print("          A REGARDER : film revu, bloc(s) %s (plus de %.1f s d'un bloc "
                  "precedent)" % (", ".join(str(x) for x in revus), REVU_MAXI))
    print("")
    # 07/10/2026 : une video A REGARDER (plaque ou tete, film revu, rythme non
    # relu) n'est jamais comptee « conforme » ; le code de sortie ne suit que
    # les lois dures (un modele, la regle, les couleurs, la musique)
    print("%d video(s) relues, %d conforme(s), %d a regarder, %d en echec"
          % (len(lignes), sum(1 for x in lignes if x["ok"] and not x.get("a_regarder")),
             sum(1 for x in lignes if x["ok"] and x.get("a_regarder")),
             sum(1 for x in lignes if not x["ok"])))
    _ecrire_json(os.path.join(dossier, "_verification.json"), lignes)
    return 0 if ok_tout else 1


def _verifier_rushes(dossier, faits, travail):
    rushes = _retrouver(faits[0].get("rushes"), dossier)
    print("mode       : --rushes (le dossier des rushes EST le modele)")
    print("rushes     : %s" % (rushes or ("INTROUVABLE (%s)" % faits[0].get("rushes")
                                          if faits[0].get("rushes") else
                                          "non ecrit (rapport d'avant v0.3.8)")))
    print("")
    # sans rushes, un bloc ecrit ne peut pas etre relu contre sa source :
    # chaque variante qui a des blocs le dit dans ses fautes
    ok_tout = True
    lignes = []
    for n, f in enumerate(faits, 1):
        v = _video_du_rapport(f, dossier)
        num = f.get("variante") or n
        if not os.path.isfile(v) or os.path.getsize(v) == 0:
            print("[ECHEC] %s : absente ou vide" % os.path.basename(v))
            ok_tout = False; continue
        d = duree(v)
        l, h = dimensions(v)
        mus = f.get("duree_musique")
        finit = (not mus) or abs(d - mus) <= 0.35
        # LOI DES DIX SECONDES (08/10/2026) : relue sur le fichier
        longue = d > DUREE_MINI_LIVREE + 1e-6
        # natif : la video relue doit etre a la taille majoritaire du modele
        cible = _lire_taille(f.get("definition_cible") or "")
        taille_ok = (not cible) or (l, h) == cible
        blocs = f.get("blocs")
        if not blocs:
            # un rapport d'avant v0.3.8 n'ecrivait ni blocs ni longueurs
            bon = finit and longue
            ok_tout = ok_tout and bon
            lignes.append({"variante": num, "mode": "rushes", "duree": round(d, 2),
                           "definition": "%dx%d" % (l, h), "ok": bon,
                           "fautes": ([] if finit else ["ne finit pas avec sa musique"])
                           + ([] if longue else ["trop_courte : %.2f s" % d]),
                           "blocs_relus": 0})
            print("[%-6s] variante_%02d  %5.1f s  %-9s  rapport d'avant v0.3.8 : "
                  "blocs non ecrits, seules la presence et la duree sont relues"
                  % ("OK" if bon else "ECHEC", num, d, "%dx%d" % (l, h)))
            continue
        longs = f.get("longueurs") or [b["longueur"] for b in blocs]
        if rushes:
            fautes, det = controler_sources(v, blocs, rushes, travail,
                                            f.get("style"))
        else:
            fautes, det = ["rushes introuvables : blocs non relus contre leur rush"], []
        colles = controler_couleurs(v, longs) if f.get("nb_couleurs", 2) >= 2 else []
        colles_comptent = bool(colles) and not f.get("couleurs_aveugles")
        rythme, regle = _rythme_et_regle(v, f, longs)
        bon = not fautes and not regle and not colles_comptent and finit and taille_ok and longue
        ok_tout = ok_tout and bon
        visage = remesurer_plaque(f, rushes)
        revus = films_revus(blocs)
        autres = list(regle)
        if not longue:
            autres.append("trop_courte : %.2f s, une video livree depasse %.0f s" % (d, DUREE_MINI_LIVREE))
        if not taille_ok:
            autres.append("video %dx%d au lieu de %s (taille majoritaire du modele)"
                          % (l, h, f.get("definition_cible")))
        if colles_comptent:
            autres.append("blocs %s de la meme couleur que le precedent"
                          % ", ".join(str(x) for x in colles))
        if not finit:
            autres.append("video %.2f s pour une musique de %.2f s" % (d, mus))
        lignes.append({"variante": num, "mode": "rushes", "duree": round(d, 2),
                       "definition": "%dx%d" % (l, h),
                       "blocs_relus": sum(1 for x in det if x["ok"]),
                       "blocs": len(blocs), "longueurs": longs,
                       "regle_fautes": regle, "blocs_colles": colles,
                       "rythme_ok": rythme["ok"], "rythme": _rythme_court(rythme),
                       "plaque_sur_le_visage": (visage or {}).get("sur_le_visage") if visage else None,
                       "tete_non_vue": (visage or {}).get("tete_non_vue") if visage else None,
                       "film_revu": revus,
                       "a_regarder": bool(_dire_tete(visage) or revus or not rythme["ok"]),
                       "ok": bon, "fautes": (fautes + autres)[:4]})
        print("[%-6s] variante_%02d  %5.1f s  %-9s  blocs relus contre leur rush : "
              "%d/%d  rythme : %s"
              % ("OK" if bon else "ECHEC", num, d, "%dx%d" % (l, h),
                 sum(1 for x in det if x["ok"]), len(blocs),
                 "OK" if rythme["ok"] else "A REGARDER (%s)" % _rythme_court(rythme)))
        for x in (fautes + autres)[:4]:
            print("          %s" % x)
        for x in _dire_tete(visage):
            print("          %s" % x)
        if revus:
            print("          A REGARDER : film revu, bloc(s) %s (plus de %.1f s d'un bloc "
                  "precedent)" % (", ".join(str(x) for x in revus), REVU_MAXI))
    print("")
    # 07/10/2026 : une video A REGARDER (plaque ou tete, film revu, rythme non
    # relu) n'est jamais comptee « conforme » ; le code de sortie ne suit que
    # les lois dures (un modele, la regle, les couleurs, la musique)
    print("%d video(s) relues, %d conforme(s), %d a regarder, %d en echec"
          % (len(lignes), sum(1 for x in lignes if x["ok"] and not x.get("a_regarder")),
             sum(1 for x in lignes if x["ok"] and x.get("a_regarder")),
             sum(1 for x in lignes if not x["ok"])))
    _ecrire_json(os.path.join(dossier, "_verification.json"), lignes)
    return 0 if ok_tout else 1


# ====================================================================
#            L'AUTO-TEST — ajoute en v0.3.8
# ====================================================================
# Des videos FABRIQUEES ici (comme dans captures.py), montees par la vraie
# ligne de commande (celle du bureau), puis RELUES sur le fichier ecrit :
# frontieres a 1,6 / 3 s, aucun flash, une couleur par bloc d'ouverture,
# chaque bloc = son rush, et jamais deux modeles (meme de la meme couleur).
BARRE = "=" * 66
# les bandes laterales d'une scene : une teinte par rush, pour voir les coupes
BANDES_ESSAI = ("0x101010", "0xf0f0f0", "0x20a040", "0xa020a0", "0x2080e0",
                "0xe08020", "0x60c0c0", "0x806020", "0xc0c020", "0x404080")
ROUGE, BLEU, JAUNE = "0xc02020", "0x2040c0", "0xd0b020"


def _essai(nom, cond, detail=""):
    print("  [%s] %s%s" % ("OK  " if cond else "FAUX", nom,
                           ("  — " + str(detail)[:300]) if (detail and not cond) else ""))
    return bool(cond)


def _video_essai(dest, tenues, bandes, duree=10, phase=0.0, l=540, h=960,
                 rampe=False, visage=None, mains=(), hijab=None, haut_plein=None):
    """Un mur gris, une tete sombre, un « vetement » qui BOUGE un peu en bas
    (plan entier : le haut est du decor), et deux BANDES laterales propres a
    la scene, hors des fenetres de mesure (couleur, cadrage) : elles rendent
    chaque coupe visible. tenues = [{"c", "etroit", "raye", "de", "a"}] :
    plusieurs tenues = un rush qui change de MODELE en cours de route.
    rampe=True : UNE LONGUE PRISE dont la lumiere du mur monte lentement
    d'un bout a l'autre — aucune coupe dedans, mais deux instants eloignes
    ne se ressemblent pas (une coupe entre eux se voit).
    visage (07/10/2026) : un VISAGE couleur de peau, a cette hauteur (part de
    l'image), ou (hauteur avant, hauteur apres, instant de la bascule) : la
    mannequin baisse ou leve la tete au milieu de la prise.
    mains : des MAINS couleur de peau [(x, y, largeur, hauteur)] (parts de
    l'image) ; hijab : la couleur d'un hijab autour du visage, ou (couleur,
    largeur, hauteur) (beige : il colle au visage dans la mesure de la peau) ; haut_plein : la couleur d'un
    vetement qui remplit l'image jusqu'en HAUT (un gros plan, tete hors du
    cadre)."""
    entrees = ["-f", "lavfi", "-i", "color=c=0x8a8a8a:s=%dx%d:d=%s:r=10" % (l, h, duree),
               "-f", "lavfi", "-i", "color=c=0x303030:s=%dx%d:d=%s:r=10"
               % (int(l * .16), int(h * .10), duree),
               "-f", "lavfi", "-i", "color=c=%s:s=%dx%d:d=%s:r=10"
               % (bandes, int(l * .15), int(h * .55), duree)]
    mur = "[0]"
    if rampe:
        mur = "[0]eq=brightness='-0.35+0.7*t/%s':eval=frame[mur];[mur]" % duree
    if haut_plein:
        mur = ("[0]drawbox=x=iw*0.12:y=0:w=iw*0.76:h=ih*0.97:color=%s:t=fill[plein];[plein]"
               % haut_plein)
    chaine = ("[2]split[bg][bd];" + mur + "[1]overlay=x=W*0.42:y=H*0.12[s0];"
              "[s0][bg]overlay=x=W*0.01:y=H*0.30[s1];"
              "[s1][bd]overlay=x=W*0.84:y=H*0.30[s2]")
    cur = "s2"
    for j, t in enumerate(tenues):
        cw, ch = int(l * (0.20 if t.get("etroit") else 0.32)), int(h * 0.55)
        entrees += ["-f", "lavfi", "-i", "color=c=%s:s=%dx%d:d=%s:r=10"
                    % (t["c"], cw, ch, duree)]
        src = "[%d]" % (3 + j)
        if t.get("raye"):
            chaine += (";%sdrawbox=x=0:y=ih*0.15:w=iw:h=ih*0.10:color=0x101010:t=fill,"
                       "drawbox=x=0:y=ih*0.55:w=iw:h=ih*0.10:color=0x101010:t=fill[r%d]"
                       % (src, j))
            src = "[r%d]" % j
        chaine += (";[%s]%soverlay=x='W*0.34+W*0.05*sin(t+%s)':y=H*0.40:"
                   "enable='gte(t,%s)*lt(t,%s)'[t%d]"
                   % (cur, src, phase, t.get("de", 0), t.get("a", duree + 1), j))
        cur = "t%d" % j
    n_in = 3 + len(tenues)
    if visage is not None:
        if isinstance(visage, (tuple, list)):
            y = "H*if(lt(t,%s),%s,%s)" % (visage[2], visage[0], visage[1])
            yh = "H*(if(lt(t,%s),%s,%s)-0.035)" % (visage[2], visage[0], visage[1])
        else:
            y = "H*%s" % visage
            yh = "H*%s" % (visage - 0.035)
        if hijab:
            hc, hw, hh = (hijab, 0.22, 0.14) if isinstance(hijab, str) else hijab
            entrees += ["-f", "lavfi", "-i", "color=c=%s:s=%dx%d:d=%s:r=10"
                        % (hc, int(l * hw), int(h * hh), duree)]
            chaine += ";[%s][%d]overlay=x=W*%s:y='%s'[hij]" % (cur, n_in, 0.5 - hw / 2.0, yh)
            cur, n_in = "hij", n_in + 1
        entrees += ["-f", "lavfi", "-i", "color=c=0xe0aa90:s=%dx%d:d=%s:r=10"
                    % (int(l * .14), int(h * .08), duree)]
        chaine += ";[%s][%d]overlay=x=W*0.43:y='%s'[vis]" % (cur, n_in, y)
        cur, n_in = "vis", n_in + 1
    for j, (mx, my, mw, mh) in enumerate(mains):
        entrees += ["-f", "lavfi", "-i", "color=c=0xd99a80:s=%dx%d:d=%s:r=10"
                    % (int(l * mw), int(h * mh), duree)]
        chaine += ";[%s][%d]overlay=x=W*%s:y=H*%s[main%d]" % (cur, n_in, mx, my, j)
        cur, n_in = "main%d" % j, n_in + 1
    r = lancer(["ffmpeg", "-v", "error"] + entrees
               + ["-filter_complex", chaine, "-map", "[%s]" % cur, "-t", str(duree),
                  "-pix_fmt", "yuv420p", dest, "-y"], 300)
    if r.returncode != 0:
        print("   ffmpeg : %s" % " ".join((r.stderr or "").split())[:300])
        return False
    return os.path.isfile(dest)


def _rush_telephone(dest, couleur, bandes, duree, phase=0.0, etiquette=False):
    """Un rush comme un TELEPHONE : 29,97 images/s, un son PLUS LONG que
    l'image (0,12 s), et au choix l'image stockee couchee avec une etiquette
    de rotation (le lecteur l'affiche droite)."""
    scene = dest + ".scene.mp4"
    if not _video_essai(scene, [{"c": couleur}], bandes, duree=duree, phase=phase):
        return False
    brut = dest + ".brut.mp4" if etiquette else dest
    r = lancer(["ffmpeg", "-v", "error", "-i", scene, "-f", "lavfi", "-i",
                "sine=frequency=500:duration=%.2f" % (duree + 0.12),
                "-vf", ("transpose=1," if etiquette else "") + "fps=30000/1001",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", brut, "-y"], 300)
    _retirer(scene)
    if r.returncode == 0 and etiquette:
        r = lancer(["ffmpeg", "-v", "error", "-display_rotation", "90", "-i", brut,
                    "-c", "copy", dest, "-y"], 120)
        _retirer(brut)
    return r.returncode == 0 and os.path.isfile(dest)


def _musique_essai(dest, secondes, frequence=440):
    r = lancer(["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                "sine=frequency=%d:duration=%s" % (frequence, secondes),
                "-ar", "44100", "-ac", "2", dest, "-y"], 120)
    return r.returncode == 0 and os.path.isfile(dest)


def _couleur_lue(video, t, zone, travail):
    """La couleur du vetement relue dans la video ECRITE, dans la zone ou le
    rush est pose, avec la fenetre de `lire_rushes`."""
    from PIL import Image
    import numpy as np
    p = os.path.join(travail, "cl_%d.png" % int(t * 1000))
    if not _vignette(video, t, p, crop=crop_zone(zone), taille=160):
        return None
    a = np.asarray(Image.open(p).convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape
    c = a[int(h * 0.40):int(h * 0.82), int(w * 0.34):int(w * 0.66)]
    return tuple(float(x) for x in c.reshape(-1, 3).mean(axis=0))


def _hex(c):
    return tuple(int(c[k:k + 2], 16) for k in (2, 4, 6))


def _comme_le_bureau(sortie):
    """Ce que le bureau (missions.mjs, etapes montage et controle) lit dans
    la sortie : les videos trouvees en descendant les dossiers (noms qui ne
    commencent ni par « . » ni par « _ »), filtrees sur variante_NN.mp4 ;
    _rapport.json en LISTE, rapproche par le NOM du fichier ; les planches
    _planche_variante_NN.png a la racine."""
    import re
    vues = []
    for racine, dossiers, fichiers in os.walk(sortie):
        dossiers[:] = [d for d in dossiers if not d.startswith((".", "_"))]
        for f in fichiers:
            if f.startswith((".", "_")):
                continue
            if os.path.splitext(f)[1].lower() in (".mp4", ".mov", ".m4v", ".avi", ".mkv"):
                vues.append(os.path.join(racine, f))
    variantes = sorted(v for v in vues if re.search(r"variante_\d+\.mp4$", v, re.I))
    try:
        rap = _lire_json(os.path.join(sortie, "_rapport.json"))
    except Exception:
        rap = None
    par_nom = {os.path.basename(f.get("fichier") or ""): f
               for f in rap} if isinstance(rap, list) else {}
    planches = sorted(f for f in os.listdir(sortie)
                      if re.match(r"^_planche_variante_\d+\.png$", f, re.I))
    return {"videos": vues, "variantes": variantes, "rapport": rap,
            "par_nom": par_nom, "planches": planches}


def _lancer_moi(args, minuteur=1800):
    """La VRAIE ligne de commande, comme le bureau la lance."""
    r = subprocess.run([sys.executable, os.path.abspath(__file__)] + args,
                       capture_output=True, text=True, stdin=subprocess.DEVNULL,
                       timeout=minuteur)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def _derniere_ligne(texte, motif):
    lignes = [x for x in (texte or "").splitlines() if motif in x]
    return lignes[-1].strip() if lignes else ""


def auto_test():
    global STYLE
    print(BARRE); print("  AUTO-TEST DE MONTER-10 — le rythme 1,6 / 3 s et un seul modele")
    print(BARRE)
    ok = True
    tmp = tempfile.mkdtemp(prefix="monter10-essai-")
    travail = os.path.join(tmp, "travail"); os.makedirs(travail)
    style_avant = STYLE
    try:
        ok &= _essai("ffmpeg et ffprobe repondent",
                     lancer(["ffmpeg", "-version"], 60).returncode == 0
                     and lancer(["ffprobe", "-version"], 60).returncode == 0)

        # ---------------------------------------------- 1. la regle, a plat
        print("  -- 1. la regle des longueurs")
        cas = [((17.6, 4), [1.6, 1.6, 1.6, 1.6, 3.0, 3.0, 3.0, 2.2]),
               ((8.3, 3), [1.6, 1.6, 1.6, 3.5]),          # 0,5 s absorbes
               ((11.0, 3), [1.6, 1.6, 1.6, 3.0, 3.2]),
               ((9.9, 3), [1.6, 1.6, 1.6, 3.0, 2.1]),
               ((9.0, 2), [1.6, 1.6, 3.0, 2.8]),
               ((12.0, 1), [3.0, 3.0, 3.0, 3.0]),
               ((9.5, 1), [3.0, 3.0, 3.5]),
               ((7.4, 1), [3.0, 3.0, 1.4])]
        for (d, n), attendu in cas:
            ok &= _essai("%.1f s, %d couleur(s) -> %s" % (d, n, attendu),
                         longueurs_blocs(d, n) == attendu, longueurs_blocs(d, n))
        flash = []
        for n in (1, 2, 3, 4, 5):
            for c in range(40, 900):
                d = c / 10.0
                L = longueurs_blocs(d, n)
                ouv = n if n >= 2 else 0
                bon = (abs(sum(L) - d) <= 0.02 and (len(L) <= 1 or L[-1] >= FLASH_MAXI)
                       and not regle_respectee(L, n)
                       and all(abs(x - BLOC_COULEURS) < 1e-6 for x in L[:min(ouv, len(L) - 1)]))
                if not bon:
                    flash.append((d, n, L))
        ok &= _essai("de 4 a 90 s, 1 a 5 couleurs : la musique est couverte, aucun "
                     "flash, ouvertures a 1,6 s, suite a 3 s", not flash, flash[:3])
        L = longueurs_blocs(9.9, 2, plus_long=3.4)
        ok &= _essai("rushes de 3,5 s : le reste ne tient pas dans le dernier bloc, "
                     "le bloc d'avant cede -> 1,6 1,6 3 2,7 1", L == [1.6, 1.6, 3.0, 2.7, 1.0]
                     and not regle_respectee(L, 2), L)
        L = longueurs_blocs(100.0, 2)
        ok &= _essai("musique de 100 s : 20 blocs au plus, ouvertures gardees, suite allongee",
                     len(L) == BLOCS_MAXI and L[:2] == [1.6, 1.6]
                     and min(L[2:]) >= BLOC_1COULEUR and abs(sum(L) - 100.0) < 0.02, L)
        ok &= _essai("--plan, blocs entiers : 12 s, 2 couleurs -> 1,6 1,6 3 3",
                     longueurs_blocs(12.0, 2, entiers=True, mini=4, maxi=12)
                     == [1.6, 1.6, 3.0, 3.0])
        # 07/10/2026 : avant, « quatre blocs de 3 s au moins » — 12 s de blocs sur une
        # musique de 7 s : la video sortait tronquee et le controle accusait « deux modeles »
        ok &= _essai("--plan, une couleur, musique de 7,9 s : jamais plus long que la musique "
                     "(3 3, et non plus 3 3 3 3)",
                     longueurs_blocs(7.9, 1, entiers=True, mini=4, maxi=12) == [3.0, 3.0]
                     and longueurs_blocs(7.0, 1, entiers=True, mini=4, maxi=12) == [3.0, 3.0],
                     longueurs_blocs(7.9, 1, entiers=True, mini=4, maxi=12))

        # ---------------------------------------------- 2. le mode du bureau
        print("  -- 2. --rushes --style natif --couleurs 3 (la commande du bureau)")
        rushes = os.path.join(tmp, "rushes-3-couleurs"); os.makedirs(rushes)
        couleurs = [ROUGE, BLEU, JAUNE]
        fab = True
        for k in range(6):
            fab &= _video_essai(os.path.join(rushes, "r%d.mp4" % (k + 1)),
                                [{"c": couleurs[k % 3]}], BANDES_ESSAI[k],
                                duree=10, phase=k * 1.1)
        ok &= _essai("six rushes fabriques : rouge, bleu, jaune, deux fois", fab)
        mus = os.path.join(tmp, "musiques-3"); os.makedirs(mus)
        # 09/10/2026 : les LOIS DU VENDEUR (08/10/2026) — une musique de 12 s ou moins
        # est ecartee avant le montage, chaque video livree depasse 10 s. Les musiques
        # d'essai durent donc PLUS de 12 s (avant : 8,3 / 11 / 9,9 s, toutes ecartees,
        # et les videos sortaient muettes a 18 s) ; la quatrieme, de 9 s, prouve le filtre.
        attendus = [("a.wav", 14.3, [1.6, 1.6, 1.6, 3.0, 3.0, 3.5]),          # 0,5 s absorbes
                    ("b.wav", 16.0, [1.6, 1.6, 1.6, 3.0, 3.0, 3.0, 2.2]),
                    ("c.wav", 13.3, [1.6, 1.6, 1.6, 3.0, 3.0, 2.5])]
        for k, (nom, d, _l) in enumerate(attendus):
            ok &= _musique_essai(os.path.join(mus, nom), d, 330 + 110 * k)
        ok &= _musique_essai(os.path.join(mus, "d-courte.wav"), 9.0, 770)
        sortie = os.path.join(tmp, "creas-3")
        code, txt = _lancer_moi(["--rushes", rushes, "--sortie", sortie, "--pov",
                                 "etudiante", "--combien", "3", "--style", "natif",
                                 "--couleurs", "3", "--musiques", mus])
        ok &= _essai("le montage tourne et toutes ses lois passent (code 0)",
                     code == 0, "code %s : %s" % (code, " | ".join(
                         x.strip() for x in txt.splitlines()
                         if "ECHEC" in x or "A REGARDER" in x or "Error" in x)[:300]))
        vu = _comme_le_bureau(sortie)
        ok &= _essai("LOI DES 12 s : la musique de 9 s est ECARTEE avant le montage, et dite ; "
                     "aucune variante ne la porte",
                     "1 musique(s) de 12 s ou moins ecartee(s)" in txt and "d-courte.wav (9.0 s)" in txt
                     and isinstance(vu["rapport"], list)
                     and not any("d-courte" in str(f.get("musique")) for f in vu["rapport"]),
                     (_derniere_ligne(txt, "ecartee"), [f.get("musique") for f in vu["rapport"] or []]))
        ok &= _essai("LOI DES 10 s : chaque video livree depasse 10 s (relue), aucune trop_courte",
                     isinstance(vu["rapport"], list) and len(vu["variantes"]) == 3
                     and all(duree(v) > DUREE_MINI_LIVREE for v in vu["variantes"])
                     and not any(f.get("trop_courte") for f in vu["rapport"]),
                     [round(duree(v), 2) for v in vu["variantes"]])
        ok &= _essai("le bureau trouve variante_01..03.mp4, et rien d'autre de video",
                     [os.path.basename(v) for v in vu["variantes"]]
                     == ["variante_01.mp4", "variante_02.mp4", "variante_03.mp4"]
                     and len(vu["videos"]) == 3, vu["videos"])
        ok &= _essai("_rapport.json est une LISTE, chaque video y est par son nom",
                     isinstance(vu["rapport"], list)
                     and all(os.path.basename(v) in vu["par_nom"] for v in vu["variantes"]),
                     list(vu["par_nom"]))
        ok &= _essai("les trois planches _planche_variante_NN.png sont la",
                     vu["planches"] == ["_planche_variante_%02d.png" % k for k in (1, 2, 3)],
                     vu["planches"])
        STYLE = "natif"
        zone = zone_video("natif", 540 / 960.0)    # None : l'image entiere
        refs = [_hex(c) for c in couleurs]
        for nom_mus, d, longs_att in attendus:
            k = attendus.index((nom_mus, d, longs_att)) + 1
            f = vu["par_nom"].get("variante_%02d.mp4" % k) or {}
            v = os.path.join(sortie, "variante_%02d.mp4" % k)
            longs = f.get("longueurs") or []
            ok &= _essai("variante_%02d (musique %.1f s) : longueurs ecrites %s"
                         % (k, d, longs_att), longs == longs_att
                         and [b["longueur"] for b in f.get("blocs", [])] == longs_att, longs)
            if not os.path.isfile(v) or not longs:
                ok = False; continue
            r = mesurer_rythme(v, longs)
            cumul = [round(sum(longs_att[:j + 1]), 2) for j in range(len(longs_att) - 1)]
            ok &= _essai("variante_%02d : frontieres RELUES dans le fichier a %s s"
                         % (k, ", ".join("%.1f" % x for x in cumul)),
                         r["ok"] and r["ecart_max"] <= TOL_FRONTIERE, _rythme_court(r))
            ok &= _essai("variante_%02d : dernier bloc relu %.2f s (attendu %.1f), pas un flash"
                         % (k, r.get("dernier_bloc") or 0, longs_att[-1]),
                         r["lu"] and r["dernier_bloc"] >= FLASH_MAXI
                         and abs(r["dernier_bloc"] - longs_att[-1]) <= 0.15, r)
            lues = []
            t0 = 0.0
            for L in longs[:3]:
                c = _couleur_lue(v, t0 + L / 2.0, zone, travail)
                lues.append(min(range(3), key=lambda j: math.dist(c, refs[j])) if c else None)
                t0 += L
            ok &= _essai("variante_%02d : les 3 blocs de 1,6 s montrent 3 couleurs "
                         "differentes (relu), la 1re = la couleur %d"
                         % (k, ((k - 1) % 3) + 1),
                         None not in lues and len(set(lues)) == 3, lues)
            fautes, det = controler_sources(v, f["blocs"], rushes, travail, "natif")
            ok &= _essai("variante_%02d : chaque bloc relu = l'image de SON rush "
                         "(du dossier du modele)" % k,
                         not fautes and len(det) == len(longs), fautes[:2])
            ok &= _essai("variante_%02d : natif, dans la definition des rushes (540x960), "
                         "aucun bloc rempli" % k,
                         f.get("definition") == "540x960" and f.get("definition_cible") == "540x960"
                         and f.get("blocs_remplis") == 0 and f.get("style") == "natif",
                         (f.get("definition"), f.get("definition_cible"), f.get("blocs_remplis")))
        code, txt = _lancer_moi(["--verifier", sortie], 900)
        ok &= _essai("--verifier sur cette sortie --rushes : relit tout, code 0",
                     code == 0, _derniere_ligne(txt, "conforme") or txt[-300:])

        # ---------------------------------------------- 3. une seule couleur
        print("  -- 3. --rushes --couleurs 1 : 3 s partout")
        rushes1 = os.path.join(tmp, "rushes-1-couleur"); os.makedirs(rushes1)
        fab = True
        for k in range(4):
            fab &= _video_essai(os.path.join(rushes1, "u%d.mp4" % (k + 1)),
                                [{"c": ROUGE}], BANDES_ESSAI[k + 4], duree=10,
                                phase=k * 1.6)
        ok &= _essai("quatre rushes rouges fabriques, quatre scenes", fab)
        mus1 = os.path.join(tmp, "musiques-1"); os.makedirs(mus1)
        # plus de 12 s (loi du 08/10/2026 ; avant : 9,5 et 7,4 s, ecartees)
        ok &= _musique_essai(os.path.join(mus1, "a.wav"), 15.5) \
            and _musique_essai(os.path.join(mus1, "b.wav"), 13.4, 550)
        sortie1 = os.path.join(tmp, "creas-1")
        code, txt = _lancer_moi(["--rushes", rushes1, "--sortie", sortie1, "--pov",
                                 "etudiante", "--combien", "2", "--style", "bande",
                                 "--couleurs", "1", "--musiques", mus1])
        ok &= _essai("le montage une couleur tourne (code 0)", code == 0,
                     "code %s : %s" % (code, txt[-300:]))
        rap1 = _comme_le_bureau(sortie1)["par_nom"]
        for k, att in ((1, [3.0, 3.0, 3.0, 3.0, 3.5]), (2, [3.0, 3.0, 3.0, 3.0, 1.4])):
            f = rap1.get("variante_%02d.mp4" % k) or {}
            v = os.path.join(sortie1, "variante_%02d.mp4" % k)
            ok &= _essai("variante_%02d : longueurs ecrites %s" % (k, att),
                         f.get("longueurs") == att, f.get("longueurs"))
            if not os.path.isfile(v):
                ok = False; continue
            r = mesurer_rythme(v, att)
            ok &= _essai("variante_%02d : frontieres RELUES a 3, 6, 9 et 12 s, rien d'autre"
                         % k, r["ok"], _rythme_court(r))
            fautes, _d = controler_sources(v, f.get("blocs") or [], rushes1, travail, "bande")
            ok &= _essai("variante_%02d : chaque bloc = son rush" % k,
                         not fautes and f.get("blocs"), fautes[:2])

        # ---------------------------------------------- 4. l'instrument
        print("  -- 4. l'instrument : il voit un rythme FAUX")
        STYLE = "natif"
        morceaux = []
        for j in range(4):
            b = os.path.join(travail, "faux_%d.mp4" % j)
            bloc(os.path.join(rushes, "r%d.mp4" % (j + 1)), False, 1.0 + j * 0.5, b, 2.2)
            morceaux.append(b)
        faux = os.path.join(tmp, "faux-2s2.mp4")
        liste = os.path.join(travail, "faux.txt")
        with open(liste, "w", encoding="utf-8") as fh:
            for m in morceaux:
                fh.write("file '%s'\n" % m.replace("'", "'\\''"))
        lancer(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", liste,
                "-c", "copy", faux, "-y"], 300)
        r_vrai = mesurer_rythme(faux, [2.2, 2.2, 2.2, 2.2])
        r_faux = mesurer_rythme(faux, [1.6, 1.6, 1.6, 4.0])
        ok &= _essai("une video a blocs de 2,2 s : relue a 2,2 / 4,4 / 6,6 s",
                     r_vrai["ok"], _rythme_court(r_vrai))
        ok &= _essai("la meme, jugee contre 1,6 / 3 s : REFUSEE (frontieres absentes, "
                     "coupes en trop)", not r_faux["ok"] and r_faux["coupes_en_trop"]
                     and None in r_faux["frontieres_relues"], _rythme_court(r_faux))

        # ---------------------------------------------- 5. jamais deux modeles
        print("  -- 5. --plan : deux modeles, dont deux de la MEME couleur")
        rushesp = os.path.join(tmp, "rushes-plan"); os.makedirs(rushesp)
        fab = _video_essai(os.path.join(rushesp, "a-rouge.mp4"), [{"c": ROUGE}],
                           BANDES_ESSAI[0], duree=10)
        fab &= _video_essai(os.path.join(rushesp, "a-bleu.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[1], duree=10, phase=1.0)
        fab &= _video_essai(os.path.join(rushesp, "b-rouge.mp4"),
                            [{"c": ROUGE, "etroit": True, "raye": True}],
                            BANDES_ESSAI[2], duree=10, phase=2.0)
        fab &= _video_essai(os.path.join(rushesp, "ab-melange.mp4"),
                            [{"c": ROUGE, "de": 0, "a": 6},
                             {"c": ROUGE, "etroit": True, "raye": True, "de": 6, "a": 13}],
                            BANDES_ESSAI[3], duree=12, phase=0.5)
        ok &= _essai("modele A rouge et bleu, modele B rouge (autre coupe, raye), et un "
                     "rush qui passe de A a B a 6 s", fab)
        plan = {"lot": "essai", "rushes": rushesp,
                "modeles": [{"nom": "Modele A", "couleurs": ["rouge", "bleu"],
                             "segments": [{"rush": "a-rouge.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                                          {"rush": "a-bleu.mp4", "de": 0, "a": 10, "coloris": "bleu"},
                                          {"rush": "ab-melange.mp4", "de": 0, "a": 6, "coloris": "rouge"}]},
                            {"nom": "Modele B", "couleurs": ["rouge"],
                             "segments": [{"rush": "b-rouge.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                                          {"rush": "ab-melange.mp4", "de": 6, "a": 12, "coloris": "rouge"}]}],
                "exclusions": []}
        fplan = os.path.join(tmp, "plan.json")
        json.dump(plan, open(fplan, "w"), indent=1)
        musp = os.path.join(tmp, "musiques-plan"); os.makedirs(musp)
        # plus de 12 s (loi du 08/10/2026 ; avant : 12,0 s, ecartee, et 15,5 s)
        ok &= _musique_essai(os.path.join(musp, "a.wav"), 13.0) \
            and _musique_essai(os.path.join(musp, "b.wav"), 15.5, 550)
        attendus_plan = {"Modele A": ([1.6, 1.6, 3.0, 3.0, 3.0], [1.6, 1.6, 3.0, 3.0, 3.0, 3.0]),
                         "Modele B": ([3.0, 3.0, 3.0, 3.0], [3.0, 3.0, 3.0, 3.0, 3.0])}
        sorties_plan = {}
        for nom, att in attendus_plan.items():
            so = os.path.join(tmp, "plan-" + nom.split()[-1])
            sorties_plan[nom] = so
            code, txt = _lancer_moi(["--plan", fplan, "--modele", nom, "--musiques", musp,
                                     "--sortie", so, "--de", "1", "--a", "2"])
            rap = _comme_le_bureau(so)
            ok &= _essai("%s : deux variantes montees (code %s)" % (nom, code),
                         code == 0 and len(rap["variantes"]) == 2, txt[-300:])
            for k in (1, 2):
                f = rap["par_nom"].get("variante_%02d.mp4" % k) or {}
                v = os.path.join(so, "variante_%02d.mp4" % k)
                ok &= _essai("%s variante_%02d : longueurs %s, un seul modele, conforme"
                             % (nom, k, att[k - 1]),
                             f.get("longueurs") == att[k - 1] and f.get("un_seul_modele")
                             and f.get("conforme"),
                             (f.get("longueurs"), f.get("fautes_de_modele"), f.get("blocs_colles")))
                if not os.path.isfile(v):
                    ok = False; continue
                r = mesurer_rythme(v, att[k - 1])
                ok &= _essai("%s variante_%02d : frontieres RELUES a leur place, aucune "
                             "coupe dans un bloc" % (nom, k), r["ok"], _rythme_court(r))
                hors = [b for b in f.get("blocs", []) if b["rush"] == "ab-melange.mp4"
                        and ((nom == "Modele A" and b["fin"] > 6.05)
                             or (nom == "Modele B" and b["debut"] < 5.95))]
                ok &= _essai("%s variante_%02d : rien pris dans la partie de l'autre "
                             "modele du rush melange" % (nom, k), not hors, hors)
            code, txt = _lancer_moi(["--verifier", so], 900)
            ok &= _essai("%s : --verifier relit tout, code 0" % nom, code == 0,
                         _derniere_ligne(txt, "conforme") or txt[-300:])
        # la preuve que le controle VOIT un melange, meme de la meme couleur
        pl = lire_plan(fplan)
        fa = (_comme_le_bureau(sorties_plan["Modele A"])["par_nom"]
              .get("variante_01.mp4") or {})
        va = os.path.join(sorties_plan["Modele A"], "variante_01.mp4")
        if os.path.isfile(va) and fa.get("blocs"):
            fautes, _d = controler_un_seul_modele(va, fa["blocs"], pl, "Modele B", travail)
            ok &= _essai("une video du modele A annoncee comme B : REFUSEE", bool(fautes))
        else:
            ok = False
        declares = [{"rush": "a-rouge.mp4", "debut": 1.0, "fin": 2.6, "longueur": 1.6},
                    {"rush": "a-bleu.mp4", "debut": 1.0, "fin": 2.6, "longueur": 1.6},
                    {"rush": "ab-melange.mp4", "debut": 1.0, "fin": 4.0, "longueur": 3.0}]
        vrais = [("a-rouge.mp4", 1.0), ("a-bleu.mp4", 1.0), ("ab-melange.mp4", 7.0)]
        morceaux = []
        for j, (rush, deb) in enumerate(vrais):
            b = os.path.join(travail, "ment_%d.mp4" % j)
            bloc(os.path.join(rushesp, rush), False, deb, b, declares[j]["longueur"])
            morceaux.append(b)
        menteuse = os.path.join(tmp, "menteuse.mp4")
        with open(liste, "w", encoding="utf-8") as fh:
            for m in morceaux:
                fh.write("file '%s'\n" % m.replace("'", "'\\''"))
        lancer(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", liste,
                "-c", "copy", menteuse, "-y"], 300)
        fautes, _d = controler_un_seul_modele(menteuse, declares, pl, "Modele A", travail)
        ok &= _essai("un rapport qui MENT (bloc 3 pris chez B, meme rouge, meme rush, "
                     "annonce chez A) : la relecture de l'image le REFUSE",
                     any(x.startswith("bloc 3") for x in fautes)
                     and not any(x.startswith("bloc 1") or x.startswith("bloc 2")
                                 for x in fautes), fautes)
        # deux modeles montes dans la MEME sortie : le cache de A ne sert pas a B
        mod_b = [m for m in pl["modeles"] if m["nom"] == "Modele B"][0]
        prep = preparer_modele(pl, mod_b, sorties_plan["Modele A"], travail)
        ok &= _essai("la sortie de A, puis B dans la meme sortie : B ne reprend pas les "
                     "coupes de A (cache)", prep.get("modele") == "Modele B"
                     and {p["rush"] for p in prep["plans"]} <= {"b-rouge.mp4", "ab-melange.mp4"},
                     sorted({p["rush"] for p in prep["plans"]}))

        # ---------------------------------------------- 6. les rushes de telephone
        print("  -- 6. rushes de telephone : son plus long que l'image, etiquette de "
              "rotation, noms avec espaces et accents")
        L = longueurs_blocs(70.0, 2, plus_long=3.4)
        ok &= _essai("musique de 70 s, rushes de 3,5 s : aucun bloc plus long que ce "
                     "qu'ils portent", max(L) <= 3.4 and abs(sum(L) - 70.0) < 0.02
                     and not regle_respectee(L, 2), (len(L), max(L)))
        L = longueurs_blocs(70.0, 2)
        ok &= _essai("musique de 70 s, rushes longs : 20 blocs, la suite allongee a une "
                     "image pres", len(L) == BLOCS_MAXI and max(L[2:]) - min(L[2:]) <= 1.01 / IPS
                     and abs(sum(L) - 70.0) < 0.02, L)
        rt = os.path.join(tmp, "rushes telephone"); os.makedirs(rt)
        # 09/10/2026 : des prises assez longues pour une video de plus de 10 s (loi du
        # 08/10/2026 ; avant : 4,1 / 4,0 / 3,6 / 3,7 s)
        specs = [("robe d'été 1.mp4", ROUGE, 7.1, False), ("Robe (2).mp4", BLEU, 7.0, True),
                 ("robe 3.MP4", ROUGE, 6.6, False), ("robe 4.mov", BLEU, 6.7, False)]
        fab = True
        for k, (nom, c, d, eti) in enumerate(specs):
            fab &= _rush_telephone(os.path.join(rt, nom), c, BANDES_ESSAI[k + 2], d,
                                   phase=k * 0.7, etiquette=eti)
        f0 = os.path.join(rt, specs[0][0])
        ok &= _essai("quatre rushes de telephone fabriques (fichier %.2f s, image %.2f s)"
                     % (duree(f0), duree_image(f0)), fab and duree_image(f0) < duree(f0) - 0.05)
        ok &= _essai("le rush a etiquette est vu DROIT (dimensions a l'affichage)",
                     dimensions(os.path.join(rt, specs[1][0])) == (540, 960),
                     dimensions(os.path.join(rt, specs[1][0])))
        fiches4 = [{"nom": str(j), "couleur": (40 * j, 50, 60)} for j in range(4)]
        ok &= _essai("--couleurs 4 avec 4 rushes : 4 couleurs, aucune jetee",
                     len(familles_n(fiches4, 4)[0]) == 4)
        mt = os.path.join(tmp, "musiques telephone"); os.makedirs(mt)
        ok &= _musique_essai(os.path.join(mt, "a.wav"), 13.0) \
            and _musique_essai(os.path.join(mt, "b.wav"), 14.5, 550)
        st = os.path.join(tmp, "creas telephone"); os.makedirs(st)
        for vieux in ("variante_07.mp4", "_planche_variante_07.png"):
            shutil.copy(f0, os.path.join(st, vieux))
        code, txt = _lancer_moi(["--rushes", rt, "--sortie", st, "--pov", "etudiante",
                                 "--combien", "2", "--style", "natif", "--couleurs", "2",
                                 "--musiques", mt])
        ok &= _essai("la commande du bureau sur ces rushes : code 0, aucune variante "
                     "perdue", code == 0, " | ".join(x.strip() for x in txt.splitlines()
                                                     if "ECHEC" in x)[:300] or txt[-300:])
        vt = _comme_le_bureau(st)
        ok &= _essai("rien d'un montage d'avant ne reste (variante_07 et sa planche)",
                     [os.path.basename(v) for v in vt["variantes"]]
                     == ["variante_01.mp4", "variante_02.mp4"]
                     and vt["planches"] == ["_planche_variante_01.png", "_planche_variante_02.png"],
                     (vt["variantes"], vt["planches"]))
        hors, couches = [], []
        for f in vt["rapport"] or []:
            for b in f.get("blocs", []):
                if b["debut"] + b["longueur"] > duree_image(os.path.join(rt, b["rush"])) + 1e-6:
                    hors.append((b["rush"], b["debut"], b["longueur"]))
                if b.get("couche"):
                    couches.append(b["rush"])
        ok &= _essai("aucun bloc ne depasse l'IMAGE de son rush, aucun rush redresse a tort",
                     vt["rapport"] and not hors and not couches, (hors, couches))
        code, txt = _lancer_moi(["--verifier", st], 900)
        ok &= _essai("--verifier sur cette sortie : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])

        # ---------------------------------------------- 7. natif, tailles melangees
        print("  -- 7. natif avec des rushes de TAILLES DIFFERENTES : la taille "
              "majoritaire, les autres REMPLIS (ni flou ni barres)")
        ok &= _essai("taille majoritaire : 3 x 540x960 contre 360x640 et 600x960 -> 540x960",
                     taille_majoritaire([(540, 960)] * 3 + [(360, 640), (600, 960)]) == (540, 960))
        ok &= _essai("a egalite (720x1280 / 1080x1920) : la plus grande, rien n'est perdu",
                     taille_majoritaire([(720, 1280), (1080, 1920)]) == (1080, 1920))
        ok &= _essai("une taille impaire est ramenee a une taille paire (x264)",
                     taille_majoritaire([(541, 961)]) == (540, 960))
        rm = os.path.join(tmp, "rushes-tailles"); os.makedirs(rm)
        fab = True
        for k in range(3):
            fab &= _video_essai(os.path.join(rm, "rouge%d.mp4" % (k + 1)), [{"c": ROUGE}],
                                BANDES_ESSAI[k], duree=10, phase=k * 1.3)
        fab &= _video_essai(os.path.join(rm, "bleu-petit.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[5], duree=10, phase=0.4, l=360, h=640)
        fab &= _video_essai(os.path.join(rm, "bleu-large.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[6], duree=10, phase=2.2, l=600, h=960)
        ok &= _essai("cinq rushes : trois rouges 540x960, un bleu 360x640, un bleu 600x960", fab)
        mm = os.path.join(tmp, "musiques-tailles"); os.makedirs(mm)
        ok &= _musique_essai(os.path.join(mm, "a.wav"), 13.0) \
            and _musique_essai(os.path.join(mm, "b.wav"), 15.0, 550)
        sm = os.path.join(tmp, "creas-tailles")
        code, txt = _lancer_moi(["--rushes", rm, "--sortie", sm, "--pov", "etudiante",
                                 "--combien", "2", "--style", "natif", "--couleurs", "2",
                                 "--musiques", mm])
        ok &= _essai("la commande du bureau sur ces rushes melanges : code 0", code == 0,
                     " | ".join(x.strip() for x in txt.splitlines()
                                if "ECHEC" in x or "Error" in x)[:300] or txt[-300:])
        ok &= _essai("l'outil DIT qu'il remplit deux rushes hors de 540x960",
                     "2 rush(es) hors de 540x960" in txt, _derniere_ligne(txt, "tailles"))
        rapm = _comme_le_bureau(sm)["par_nom"]
        remplis = set()
        for k in (1, 2):
            f = rapm.get("variante_%02d.mp4" % k) or {}
            v = os.path.join(sm, "variante_%02d.mp4" % k)
            if not os.path.isfile(v):
                ok = _essai("variante_%02d ecrite" % k, False); continue
            ok &= _essai("variante_%02d : relue en 540x960, la taille majoritaire" % k,
                         dimensions(v) == (540, 960) and f.get("definition_cible") == "540x960"
                         and f.get("reste_dans_sa_definition"), (dimensions(v), f.get("definition_cible")))
            for b in f.get("blocs", []):
                if b.get("rempli"):
                    remplis.add(b["rush"])
            bleus = [b for b in f.get("blocs", []) if b["rush"].startswith("bleu")]
            ok &= _essai("variante_%02d : chaque bloc bleu est marque REMPLI, aucun rouge"
                         % k, bleus and all(b.get("rempli") == "540x960" for b in bleus)
                         and not any(b.get("rempli") for b in f.get("blocs", [])
                                     if b["rush"].startswith("rouge")), f.get("blocs"))
            fautes, det = controler_sources(v, f.get("blocs") or [], rm, travail, "natif")
            ok &= _essai("variante_%02d : chaque bloc relu = son rush, recadre pareil s'il "
                         "a ete rempli" % k, not fautes and len(det) == len(f.get("blocs") or []),
                         fautes[:2])
            r = mesurer_rythme(v, f.get("longueurs") or [])
            ok &= _essai("variante_%02d : le rythme 1,6 / 3 s relu" % k, r["ok"], _rythme_court(r))
            # NI BARRES NI FLOU : sur un bloc rempli, les bords de l'image sont
            # ceux du rush (mur gris + bande de couleur), pas du noir uni
            for j, b in enumerate(f.get("blocs") or []):
                if not b.get("rempli"):
                    continue
                t = sum(x["longueur"] for x in f["blocs"][:j]) + b["longueur"] / 2.0
                pv = os.path.join(travail, "bord_%d_%d.png" % (k, j))
                if _vignette(v, t, pv, taille=270):
                    from PIL import Image
                    import numpy as np
                    a_ = np.asarray(Image.open(pv).convert("RGB"), dtype=np.int16)
                    bords = [a_[int(a_.shape[0] * 0.5):, :3].mean(), a_[int(a_.shape[0] * 0.5):, -3:].mean(),
                             a_[-3:, :].mean()]
                    ok &= _essai("variante_%02d bloc %d (%s) : aucun bord noir (pas de barre)"
                                 % (k, j + 1, b["rush"]), min(bords) > 40,
                                 ["%.0f" % x for x in bords])
                break
        ok &= _essai("les deux tailles minoritaires ont servi et ont ete remplies",
                     remplis == {"bleu-petit.mp4", "bleu-large.mp4"}, sorted(remplis))
        code, txt = _lancer_moi(["--verifier", sm], 900)
        ok &= _essai("--verifier relit la sortie aux tailles melangees : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])

        # ---------------------------------------------- 8. --plan natif, tailles melangees, sans musique
        print("  -- 8. --plan --style natif (un modele de lot) : tailles melangees, "
              "SANS musique")
        planm = {"lot": "essai-tailles", "rushes": rm,
                 "modeles": [{"nom": "Modele R", "couleurs": ["rouge", "bleu"],
                              "segments": [{"rush": "rouge1.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                                           {"rush": "rouge2.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                                           {"rush": "bleu-petit.mp4", "de": 0, "a": 10, "coloris": "bleu"}]},
                             {"nom": "Modele L", "couleurs": ["bleu"],
                              "segments": [{"rush": "bleu-large.mp4", "de": 0, "a": 10, "coloris": "bleu"},
                                           {"rush": "rouge3.mp4", "de": 0, "a": 10, "coloris": "rouge"}]}],
                 "exclusions": []}
        fpm = os.path.join(tmp, "plan-tailles.json")
        json.dump(planm, open(fpm, "w"), indent=1)
        spm = os.path.join(tmp, "plan-tailles-R")
        code, txt = _lancer_moi(["--plan", fpm, "--modele", "Modele R", "--style", "natif",
                                 "--pov", "etudiante", "--sortie", spm, "--de", "1", "--a", "2"])
        rp = _comme_le_bureau(spm)
        ok &= _essai("--plan sans --musiques : deux variantes montees (code %s)" % code,
                     code == 0 and len(rp["variantes"]) == 2, txt[-300:])
        for k in (1, 2):
            f = rp["par_nom"].get("variante_%02d.mp4" % k) or {}
            v = os.path.join(spm, "variante_%02d.mp4" % k)
            if not os.path.isfile(v):
                ok = False; continue
            bleus = [b for b in f.get("blocs", []) if b["rush"] == "bleu-petit.mp4"]
            ok &= _essai("Modele R variante_%02d : 540x960, un seul modele, conforme, blocs "
                         "360x640 remplis" % k,
                         dimensions(v) == (540, 960) and f.get("un_seul_modele") and f.get("conforme")
                         and bleus and all(b.get("rempli") == "540x960" for b in bleus),
                         (dimensions(v), f.get("conforme"), f.get("fautes_de_modele"), bleus))
            ok &= _essai("Modele R variante_%02d : muette, et a la duree de ses blocs" % k,
                         "pas de musique" in str(f.get("musique")) and f.get("finit_avec_la_musique"),
                         (f.get("musique"), f.get("duree"), f.get("duree_visee")))
        code, txt = _lancer_moi(["--verifier", spm], 900)
        ok &= _essai("--verifier relit le --plan natif aux tailles melangees : code 0",
                     code == 0, _derniere_ligne(txt, "conforme") or txt[-300:])

        # ---------------------------------------------- 9. une seule couleur en natif (la commande du bureau)
        # v0.3.8 (06/10/2026) : une mission seule d'UNE couleur part ici (plus chez
        # manita.py, qui remplissait alors le 9:16 d'un fond floute) : --couleurs 1, natif,
        # et un rush d'une autre taille est REMPLI
        print("  -- 9. --rushes --couleurs 1 --style natif : une seule couleur, tailles melangees")
        r9 = os.path.join(tmp, "rushes-1-natif"); os.makedirs(r9)
        for k in range(4):
            shutil.copy(os.path.join(rushes1, "u%d.mp4" % (k + 1)), r9)
        fab = _video_essai(os.path.join(r9, "u5-petit.mp4"), [{"c": ROUGE}], BANDES_ESSAI[2],
                           duree=10, phase=0.7, l=360, h=640)
        ok &= _essai("cinq rushes rouges : quatre 540x960, un 360x640", fab)
        s9 = os.path.join(tmp, "creas-1-natif")
        code, txt = _lancer_moi(["--rushes", r9, "--sortie", s9, "--pov", "etudiante",
                                 "--combien", "2", "--style", "natif", "--couleurs", "1",
                                 "--musiques", mus1])
        ok &= _essai("la commande du bureau pour une couleur, en natif : code 0, et l'outil DIT "
                     "qu'il remplit le rush 360x640", code == 0 and "1 rush(es) hors de 540x960" in txt,
                     "code %s : %s" % (code, txt[-300:]))
        rap9 = _comme_le_bureau(s9)["par_nom"]
        for k, att in ((1, [3.0, 3.0, 3.0, 3.0, 3.5]), (2, [3.0, 3.0, 3.0, 3.0, 1.4])):
            f = rap9.get("variante_%02d.mp4" % k) or {}
            v = os.path.join(s9, "variante_%02d.mp4" % k)
            if not os.path.isfile(v):
                ok = _essai("variante_%02d ecrite" % k, False); continue
            petits = [b for b in f.get("blocs", []) if b["rush"] == "u5-petit.mp4"]
            ok &= _essai("variante_%02d : 540x960, natif, 3 s partout %s, le 360x640 REMPLI s'il sert"
                         % (k, att), dimensions(v) == (540, 960) and f.get("style") == "natif"
                         and f.get("definition_cible") == "540x960" and f.get("longueurs") == att
                         and all(b.get("rempli") == "540x960" for b in petits),
                         (dimensions(v), f.get("longueurs"), petits))
            fautes, _d = controler_sources(v, f.get("blocs") or [], r9, travail, "natif")
            ok &= _essai("variante_%02d : chaque bloc relu = son rush (recadre pareil s'il a ete rempli)"
                         % k, not fautes and f.get("blocs"), fautes[:2])
        code, txt = _lancer_moi(["--verifier", s9], 900)
        ok &= _essai("--verifier relit la sortie une couleur natif : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])

        # ---------------------------------------------- 10. le plan d'un lot, maison deplacee
        print("  -- 10. le plan d'un lot du bureau retrouve ses rushes apres un deplacement")
        lot = os.path.join(tmp, "maison-deplacee", "lots", "abc123")
        os.makedirs(os.path.join(lot, "separation")); os.makedirs(os.path.join(lot, "rushes"))
        for ecrit in ("/Users/ancien/maison/lots/abc123/rushes",
                      "C:\\Users\\ancien\\maison\\lots\\abc123\\rushes"):
            fp = os.path.join(lot, "separation", "plan.json")
            _ecrire_json(fp, {"rushes": ecrit, "modeles": [{"nom": "M", "segments": [
                {"rush": "a.mp4", "de": 0, "a": 4}]}], "exclusions": []})
            try:
                lu = lire_plan(fp)["rushes"]
            except Exception as e:
                lu = "REFUS : %s" % e
            ok &= _essai("rushes ecrits « %s » -> <lot>/rushes (un etage au-dessus du plan)"
                         % ecrit[:24], os.path.realpath(str(lu)) == os.path.realpath(os.path.join(lot, "rushes")), lu)

        # ---------------------------------------------- 11. --plan, une couleur, UNE seule prise
        # 06/10/2026 : un modele d'une couleur fait d'UNE longue prise sortait
        # « 1,6 s partout ». La regle du vendeur : une couleur -> 3 s partout.
        print("  -- 11. --plan : un modele d'UNE couleur filme en UNE seule longue prise "
              "-> 3 s partout (relu sur le fichier ecrit)")
        r11 = os.path.join(tmp, "rushes-une-prise"); os.makedirs(r11)
        fab = _video_essai(os.path.join(r11, "prise-longue.mp4"), [{"c": ROUGE}],
                           BANDES_ESSAI[2], duree=24, phase=0.3, rampe=True)
        fab &= _video_essai(os.path.join(r11, "autre-bleu.mp4"), [{"c": BLEU, "etroit": True}],
                            BANDES_ESSAI[5], duree=10, phase=1.0)
        ok &= _essai("une prise rouge de 24 s (la lumiere monte lentement, aucune coupe) et un "
                     "autre modele, bleu", fab)
        fp11 = os.path.join(tmp, "plan-une-prise.json")
        _ecrire_json(fp11, {"lot": "essai-une-prise", "rushes": r11, "exclusions": [],
                            "modeles": [{"nom": "Modele P", "couleurs": ["rouge"], "segments": [
                                {"rush": "prise-longue.mp4", "de": 0, "a": 24, "coloris": "rouge"}]},
                                {"nom": "Modele Q", "couleurs": ["bleu"], "segments": [
                                    {"rush": "autre-bleu.mp4", "de": 0, "a": 10, "coloris": "bleu"}]}]})
        pl11 = lire_plan(fp11)
        prep = preparer_modele(pl11, pl11["modeles"][0], os.path.join(tmp, "prep-11"), travail)
        ok &= _essai("preparer : une couleur, une seule prise, toutes les coupes a 3 s "
                     "(avant : 1,6 s partout)",
                     prep["couleurs"] == 1 and prep.get("une_seule_prise")
                     and prep["bloc_suite"] == BLOC_1COULEUR and prep["plans"]
                     and all(abs(p["longueur"] - BLOC_1COULEUR) < 0.01 for p in prep["plans"]),
                     (prep["couleurs"], prep.get("une_seule_prise"), prep["bloc_suite"],
                      len(prep["plans"])))
        s11 = os.path.join(tmp, "plan-une-prise-P")
        code, txt = _lancer_moi(["--plan", fp11, "--modele", "Modele P", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s11,
                                 "--de", "1", "--a", "2"])
        rp11 = _comme_le_bureau(s11)
        ok &= _essai("Modele P : deux variantes (code %s), rythme annonce « 3.0 s partout », "
                     "rien « a savoir »" % code,
                     code == 0 and len(rp11["variantes"]) == 2
                     and "rythme 3.0 s partout" in txt and "A SAVOIR" not in txt, txt[-300:])
        for k, att in ((1, [3.0] * 4), (2, [3.0] * 5)):
            f = rp11["par_nom"].get("variante_%02d.mp4" % k) or {}
            v = os.path.join(s11, "variante_%02d.mp4" % k)
            if not os.path.isfile(v):
                ok = _essai("Modele P variante_%02d ecrite" % k, False); continue
            ok &= _essai("Modele P variante_%02d : longueurs ecrites %s, suite a 3 s, un seul "
                         "modele, conforme" % (k, att),
                         f.get("longueurs") == att
                         and [b["longueur"] for b in f.get("blocs", [])] == att
                         and f.get("bloc_suite") == BLOC_1COULEUR and f.get("un_seul_modele")
                         and f.get("conforme"),
                         (f.get("longueurs"), f.get("bloc_suite"), f.get("fautes_de_modele")))
            r = mesurer_rythme(v, att)
            ok &= _essai("Modele P variante_%02d : frontieres RELUES a %s s, aucune autre coupe"
                         % (k, ", ".join("%.0f" % (3 * (j + 1)) for j in range(len(att) - 1))),
                         r["ok"] and r["ecart_max"] <= TOL_FRONTIERE, _rythme_court(r))
            # les durees des blocs, MESUREES entre deux coupes relues du fichier
            fr = [0.0] + [x for x in r["frontieres_relues"] if x is not None] \
                + [r["duree_lue"] or 0.0]
            durees = [round(fr[j + 1] - fr[j], 2) for j in range(len(fr) - 1)]
            ok &= _essai("Modele P variante_%02d : durees relues %s s, aucune a 1,6 s"
                         % (k, durees), len(durees) == len(att)
                         and all(abs(x - BLOC_1COULEUR) <= 0.15 for x in durees), durees)
            blocs = f.get("blocs") or []
            sauts = [round(abs(blocs[j]["debut"] - blocs[j - 1]["fin"]), 2)
                     for j in range(1, len(blocs))]
            ok &= _essai("Modele P variante_%02d : tout dans la MEME prise, deux blocs voisins "
                         "a %.0f s de film au moins (%s)" % (k, ECART_MEME_PRISE, sauts),
                         blocs and {b["rush"] for b in blocs} == {"prise-longue.mp4"}
                         and min(sauts) >= ECART_MEME_PRISE - 0.01, sauts)
            r16 = mesurer_rythme(v, [BLOC_COULEURS] * int(round(sum(att) / BLOC_COULEURS)))
            ok &= _essai("Modele P variante_%02d : jugee contre « 1,6 s partout » : REFUSEE" % k,
                         r16["lu"] and not r16["ok"], _rythme_court(r16))
        code, txt = _lancer_moi(["--verifier", s11], 900)
        ok &= _essai("--verifier relit le modele d'une seule prise : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])
        # le repli reste, et seulement lui : une prise qui ne porte pas 3 s
        fc11 = os.path.join(tmp, "plan-prise-courte.json")
        _ecrire_json(fc11, {"rushes": r11, "exclusions": [], "modeles": [
            {"nom": "Court", "segments": [{"rush": "prise-longue.mp4", "de": 2.0, "a": 4.6}]}]})
        plc = lire_plan(fc11)
        pc = preparer_modele(plc, plc["modeles"][0], os.path.join(tmp, "prep-11c"), travail)
        ok &= _essai("une prise de 2,6 s (elle ne porte pas 3 s) : la suite reste a 1,6 s "
                     "(le seul repli, annonce)", pc["bloc_suite"] == BLOC_COULEURS, pc["bloc_suite"])

        # ---------------------------------------------- 12. un rush DEJA MONTE, une prise courte
        # CASSE DU 06/10/2026, sur de vrais rushes de vendeur : une prise de 6,8 s
        # portait DEJA une coupe (a 3,57 s) -> dix variantes sur dix « coupes en
        # trop » : chaque bloc de 3 s pose a cheval montrait deux plans. Et une
        # prise courte SANS coupe revenait en arriere de 2,3 s a chaque bloc
        # (0-3 s, puis 0,7-3,7, puis 1,4-4,4), sans jamais montrer sa fin.
        print("  -- 12. --plan : un rush DEJA MONTE (une coupe dedans) et une prise courte : "
              "aucun bloc a cheval, aucun retour en arriere")
        r12 = os.path.join(tmp, "rushes-deja-montes"); os.makedirs(r12)
        pa, pb = os.path.join(travail, "plan-a.mp4"), os.path.join(travail, "plan-b.mp4")
        # 09/10/2026 : deux plans de 7 s (avant : 3,6 s) — assez de film DISTINCT pour une
        # video de plus de 10 s (loi du 08/10/2026), sans remontrer le meme film
        fab = (_video_essai(pa, [{"c": ROUGE}], BANDES_ESSAI[3], duree=7.0, phase=0.2)
               and _video_essai(pb, [{"c": ROUGE}], BANDES_ESSAI[8], duree=7.0, phase=2.4))
        monte = os.path.join(r12, "deja-monte.mp4")
        if fab:
            r = lancer(["ffmpeg", "-v", "error", "-i", pa, "-i", pb, "-filter_complex",
                        "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]",
                        "-pix_fmt", "yuv420p", monte, "-y"], 300)
            fab = r.returncode == 0 and os.path.isfile(monte)
        courte = os.path.join(r12, "courte.mp4")
        fab = fab and _video_essai(courte, [{"c": BLEU}], BANDES_ESSAI[6], duree=6.8,
                                   phase=0.7, rampe=True)
        ok &= _essai("un rush rouge de 14 s fait de DEUX plans (coupe a 7 s) et une prise "
                     "bleue de 6,8 s sans coupe", fab)
        cr = coupes_du_rush(monte, 0.0, 13.95)
        ok &= _essai("la coupe deja dans le rush est trouvee (%s s), aucune autre" % cr,
                     len(cr) == 1 and abs(cr[0] - 7.0) <= 0.1, cr)
        cr2 = coupes_du_rush(courte, 0.0, 6.75)
        ok &= _essai("la prise qui s'eclaire lentement n'en porte aucune", not cr2, cr2)
        coupe = cr[0] if cr else 7.0
        fp12 = os.path.join(tmp, "plan-deja-monte.json")
        _ecrire_json(fp12, {"lot": "essai-deja-monte", "rushes": r12, "exclusions": [],
                            "modeles": [{"nom": "Modele M", "couleurs": ["rouge"], "segments": [
                                {"rush": "deja-monte.mp4", "de": 0, "a": 14.0, "coloris": "rouge"}]},
                                {"nom": "Modele C", "couleurs": ["bleu"], "segments": [
                                    {"rush": "courte.mp4", "de": 0, "a": 6.8, "coloris": "bleu"}]}]})
        pl12 = lire_plan(fp12)
        prep = preparer_modele(pl12, pl12["modeles"][0], os.path.join(tmp, "prep-12"), travail)

        def a_cheval(debut, fin):
            return debut < coupe - 0.05 and fin > coupe + 0.05
        cheval = [(p["debut"], p["fin"]) for p in prep["plans"] if a_cheval(p["debut"], p["fin"])]
        ok &= _essai("preparer : une couleur, 3 s partout, deux prises (une de chaque cote de la "
                     "coupe), aucune coupe a cheval",
                     prep["bloc_suite"] == BLOC_1COULEUR and len(prep["sous_segments"]) == 2
                     and prep["plans"] and not cheval and prep.get("coupes_a_cheval") == 0,
                     (prep["bloc_suite"], len(prep["sous_segments"]), cheval))
        s12 = os.path.join(tmp, "plan-deja-monte-M")
        code, txt = _lancer_moi(["--plan", fp12, "--modele", "Modele M", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s12,
                                 "--de", "1", "--a", "2"])
        rp12 = _comme_le_bureau(s12)
        ok &= _essai("Modele M : deux variantes (code %s), l'outil DIT la coupe trouvee et "
                     "qu'aucun bloc ne la traverse" % code,
                     code == 0 and len(rp12["variantes"]) == 2
                     and "deja presente(s) dans les rushes" in txt
                     and "aucun bloc ne les traverse" in txt, txt[-300:])
        # 07/10/2026 : le nombre de blocs suit le film DISTINCT (avant : des blocs
        # identiques remontres, « conforme »). 09/10/2026 : 14 s de film en deux prises
        # portent QUATRE blocs de 3 s differents (12 s, plus de 10 s) ; la musique de
        # 15,5 s de la variante 2 en portait cinq : la video s'arrete a quatre, la
        # musique est coupee avec un fondu, et la VIDEO n'est pas coupee.
        for k, att in ((1, [3.0] * 4), (2, [3.0] * 4)):
            f = rp12["par_nom"].get("variante_%02d.mp4" % k) or {}
            v = os.path.join(s12, "variante_%02d.mp4" % k)
            if not os.path.isfile(v):
                ok = _essai("Modele M variante_%02d ecrite" % k, False); continue
            cheval = [(b["debut"], b["fin"]) for b in f.get("blocs", []) if a_cheval(b["debut"], b["fin"])]
            ok &= _essai("Modele M variante_%02d : longueurs %s (le film DISTINCT), conforme, aucun "
                         "film revu, aucun bloc a cheval sur la coupe du rush" % (k, att),
                         f.get("longueurs") == att and f.get("conforme") and f.get("blocs")
                         and not cheval and f.get("film_revu") == [] and not films_revus(f["blocs"])
                         and f.get("blocs_distincts") == 4 and not f.get("trop_courte"),
                         (f.get("longueurs"), f.get("conforme"), cheval, f.get("film_revu"),
                          f.get("blocs_distincts")))
            r = mesurer_rythme(v, att)
            ok &= _essai("Modele M variante_%02d : frontieres relues, AUCUNE coupe en trop "
                         "(avant : des blocs a deux plans)" % k, r["ok"], _rythme_court(r))
            if k == 2:
                # LA MUSIQUE PLUS LONGUE QUE LA VIDEO NE COUPE PAS LA VIDEO : 15,5 s de
                # musique, 12 s de blocs -> l'image ET le son font 12 s
                ok &= _essai("Modele M variante_02 : musique de 15,5 s sur 12 s de blocs -> la video "
                             "garde ses 12 s (image %.2f s, fichier %.2f s), la musique s'arrete avec "
                             "elle" % (duree_image(v), duree(v)),
                             "b.wav" in str(f.get("musique")) and f.get("finit_avec_la_musique")
                             and abs(duree_image(v) - sum(att)) <= 0.15
                             and abs(duree(v) - sum(att)) <= 0.15,
                             (f.get("musique"), duree_image(v), duree(v), f.get("duree_visee")))
        code, txt = _lancer_moi(["--verifier", s12], 900)
        ok &= _essai("--verifier relit le rush deja monte : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])
        # controle negatif : l'instrument VOIT un bloc pose a cheval
        STYLE = "natif"
        m0, m1 = os.path.join(travail, "cheval_0.mp4"), os.path.join(travail, "cheval_1.mp4")
        bloc(courte, False, 0.5, m0, BLOC_1COULEUR)
        bloc(monte, False, coupe - 1.6, m1, BLOC_1COULEUR)
        vch = os.path.join(tmp, "a-cheval.mp4")
        with open(liste, "w", encoding="utf-8") as fh:
            for m in (m0, m1):
                fh.write("file '%s'\n" % m.replace("'", "'\\''"))
        lancer(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", liste,
                "-c", "copy", vch, "-y"], 300)
        rch = mesurer_rythme(vch, [BLOC_1COULEUR, BLOC_1COULEUR])
        ok &= _essai("controle negatif : un bloc pose a cheval sur la coupe du rush est VU "
                     "(coupe en trop vers 4,6 s)", rch["lu"] and not rch["ok"]
                     and any(abs(x - 4.6) <= 0.15 for x in rch["coupes_en_trop"]),
                     _rythme_court(rch))
        # la prise courte sans coupe : dix variantes, logique seule
        prc = preparer_modele(pl12, pl12["modeles"][1], os.path.join(tmp, "prep-12c"), travail)
        revus, fins = [], []
        for i in range(10):
            s_ = suite_de_plans(prc["plans"], 1, i, [BLOC_1COULEUR] * (4 + i % 2))
            revus.append(max(_film_commun(s_[j], s_[j - 1]) for j in range(1, len(s_))))
            fins.append(round(max(p["debut"] + p["longueur"] for p in s_), 2))
        ok &= _essai("prise courte de 6,8 s, dix variantes : jamais plus de 1 s du bloc d'avant "
                     "revue (avant : 2,3 s a chaque coupe), et la fin de la prise sert",
                     prc.get("une_seule_prise") and max(revus) <= 1.0 and min(fins) >= 6.5,
                     (["%.2f" % x for x in revus], fins))
        # deux sous-segments d'une meme prise qui se TOUCHENT (logique seule)
        base = {"fichier": "x.mp4", "rush": "x.mp4", "nom": "x.mp4", "couche": False,
                "segment": 0, "prise": "0.0", "coupes": [], "famille": 0}
        touche = [dict(base, t0=0.0, a=6.0, duree=6.0, couleur=(150.0, 40.0, 40.0)),
                  dict(base, t0=6.0, a=12.0, duree=6.0, couleur=(172.0, 52.0, 40.0))]
        pv = plans_possibles(touche, BLOC_1COULEUR)
        voisins = []
        for i in range(10):
            s_ = suite_de_plans(pv, 1, i, [BLOC_1COULEUR] * 4)
            voisins += [(i + 1, j + 1, s_[j - 1]["fin"], s_[j]["debut"])
                        for j in range(1, len(s_)) if _film_voisin(s_[j], s_[j - 1])]
        ok &= _essai("deux sous-segments qui se touchent dans la MEME prise (0-6 s et 6-12 s) : "
                     "jamais deux blocs voisins dans le film, dix variantes (avant : trois "
                     "coupes invisibles, 2,7 s puis 6,8 s...)", not voisins, voisins[:4])
        # une longue prise : dix variantes, dix jeux de blocs
        pl_ = plans_possibles([dict(base, t0=0.0, a=246.0, duree=246.0, couleur=(150.0, 40.0, 40.0))],
                              BLOC_1COULEUR, par_seg=PLANS_UNE_PRISE)
        jeux = set()
        for i in range(10):
            s_ = suite_de_plans(pl_, 1, i, [BLOC_1COULEUR] * (4 + i % 2))
            jeux.add(tuple(sorted(p["debut"] for p in s_)))
        ok &= _essai("une prise de 246 s : dix variantes, dix jeux de blocs differents (avant : "
                     "douze places, deux variantes faites des memes blocs)", len(jeux) == 10,
                     len(jeux))
        # ---------------------------------------------- 13. --rushes : les coupes deja dans les rushes
        # 07/10/2026, sur de vrais rushes deja montes par le vendeur (huit coupes dans
        # une video de 20 s) : en --rushes, 17 blocs sur 24 passaient a cheval sur une
        # coupe, et deux variantes s'ouvraient sur 0,13 s d'un AUTRE plan (la vignette).
        print("  -- 13. --rushes : des rushes DEJA MONTES (coupes dedans) -> aucun bloc a "
              "cheval, jamais une premiere image « flash »")
        r13 = os.path.join(tmp, "rushes-deja-montes-2"); os.makedirs(r13)

        def rush_monte(dest, couleur, bandes, durees, phase=0.0):
            parts = []
            for j, (bd, du) in enumerate(zip(bandes, durees)):
                pj = os.path.join(travail, "monte_%d_%s" % (j, os.path.basename(dest)))
                if not _video_essai(pj, [{"c": couleur}], bd, duree=du, phase=phase + j * 1.7):
                    return False
                parts.append(pj)
            entrees = []
            for pj in parts:
                entrees += ["-i", pj]
            r = lancer(["ffmpeg", "-v", "error"] + entrees + [
                "-filter_complex", "".join("[%d:v]" % j for j in range(len(parts)))
                + "concat=n=%d:v=1:a=0[v]" % len(parts), "-map", "[v]",
                "-pix_fmt", "yuv420p", dest, "-y"], 300)
            for pj in parts:
                _retirer(pj)
            return r.returncode == 0 and os.path.isfile(dest)
        fab = rush_monte(os.path.join(r13, "rouge-monte.mp4"), ROUGE, BANDES_ESSAI[0:4],
                         [2.5, 2.5, 2.5, 2.5])
        fab &= rush_monte(os.path.join(r13, "bleu-monte.mp4"), BLEU, BANDES_ESSAI[4:7],
                          [3.4, 3.4, 3.4], phase=0.6)
        fab &= _video_essai(os.path.join(r13, "rouge-long.mp4"), [{"c": ROUGE}], BANDES_ESSAI[7],
                            duree=10, phase=0.9)
        fab &= _video_essai(os.path.join(r13, "bleu-long.mp4"), [{"c": BLEU}], BANDES_ESSAI[8],
                            duree=10, phase=2.1)
        ok &= _essai("quatre rushes : un rouge coupe toutes les 2,5 s, un bleu toutes les 3,4 s, "
                     "un rouge et un bleu d'une seule prise", fab)
        coupes13 = {n_: coupes_du_rush(os.path.join(r13, n_), 0.0, duree_image(os.path.join(r13, n_)))
                    for n_ in sorted(os.listdir(r13))}
        ok &= _essai("les coupes deja dans les rushes sont trouvees (2,5 / 5 / 7,5 et 3,4 / 6,8 s)",
                     len(coupes13["rouge-monte.mp4"]) == 3 and len(coupes13["bleu-monte.mp4"]) == 2
                     and not coupes13["rouge-long.mp4"] and not coupes13["bleu-long.mp4"], coupes13)
        s13 = os.path.join(tmp, "creas-deja-montes")
        code, txt = _lancer_moi(["--rushes", r13, "--sortie", s13, "--pov", "etudiante",
                                 "--combien", "3", "--style", "natif", "--couleurs", "2",
                                 "--musiques", mus])
        rap13 = _comme_le_bureau(s13)
        ok &= _essai("la commande du bureau sur ces rushes : trois variantes (code %s)" % code,
                     len(rap13["variantes"]) == 3, txt[-300:])
        cheval, rythmes, flashs, servis = [], [], [], set()
        for f in rap13["rapport"] or []:
            for b in f.get("blocs", []):
                servis.add(b["rush"])
                for x in coupes13.get(b["rush"], []):
                    if b["debut"] - 0.05 < x < b["debut"] + b["longueur"] + 0.05:
                        cheval.append((f["variante"], b["rush"], b["debut"], b["longueur"], x))
            v = os.path.join(s13, os.path.basename(f.get("fichier") or ""))
            r = mesurer_rythme(v, f.get("longueurs") or [])
            rythmes.append(r["ok"])
            flashs += [(f["variante"], x) for x in r.get("coupes_en_trop") or [] if x < 0.5]
            if not r["ok"]:
                rythmes.append(_rythme_court(r))
        ok &= _essai("les rushes deja montes servent (on ne les fuit pas, on evite leurs coupes)",
                     {"rouge-monte.mp4", "bleu-monte.mp4"} & servis, sorted(servis))
        ok &= _essai("AUCUN bloc a cheval sur une coupe deja dans le rush (avant : la plupart)",
                     not cheval and all(not f.get("blocs_a_cheval") for f in rap13["rapport"] or []),
                     cheval[:4])
        ok &= _essai("rythme RELU sur les trois videos : aucune coupe en trop, et jamais un flash "
                     "d'un autre plan sur la premiere image", all(x is True for x in rythmes)
                     and not flashs, (rythmes, flashs))
        code, txt = _lancer_moi(["--verifier", s13], 900)
        ok &= _essai("--verifier relit les rushes deja montes : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])
        # logique seule : un rush coupe partout cede au rush suivant de la meme couleur
        fiche = {"nom": "x", "duree": 10.0, "coupes": [2.0, 4.0, 6.0, 8.0]}
        ok &= _essai("un rush coupe toutes les 2 s ne porte pas un bloc de 3 s, il porte 1,6 s",
                     not plages_propres(fiche, BLOC_1COULEUR) and plages_propres(fiche, BLOC_COULEURS)
                     and all(not traverse_une_coupe(fiche, depart(fiche, BLOC_COULEURS, i_, k_),
                                                    BLOC_COULEURS)
                             for i_ in range(10) for k_ in range(6)),
                     plages_propres(fiche, BLOC_COULEURS))

        # ---------------------------------------------- 14. --plan : les exclusions du plan
        # 07/10/2026 : lire_plan ne lisait pas « exclusions ». Un tronçon exclu
        # (« deux modeles a la fois ») entrait dans le montage, et le controle (qui
        # compare un bloc a sa source declaree) l'acceptait.
        print("  -- 14. --plan : les EXCLUSIONS et les bords disputes du plan sont retires, "
              "et le controle refuse un bloc qui les touche")
        r14 = os.path.join(tmp, "rushes-exclusions"); os.makedirs(r14)
        # 09/10/2026 : un rouge de 16 s et un bleu de 14 s (avant : 12 et 10 s) — hors de
        # l'exclusion et du bord dispute, assez de film DISTINCT pour une video de plus de
        # 10 s (loi du 08/10/2026) sans remontrer le meme film
        fab = _video_essai(os.path.join(r14, "ex.mp4"), [{"c": ROUGE}], BANDES_ESSAI[1],
                           duree=16, phase=0.4, rampe=True)
        # le bleu partage : la tenue de A jusqu'a 9,1 s, celle de B ensuite
        fab &= _video_essai(os.path.join(r14, "ex-bleu.mp4"),
                            [{"c": BLEU, "de": 0, "a": 9.1},
                             {"c": BLEU, "etroit": True, "raye": True, "de": 9.1, "a": 15}],
                            BANDES_ESSAI[3], duree=14, phase=1.2)
        fab &= _video_essai(os.path.join(r14, "autre.mp4"), [{"c": JAUNE, "etroit": True}],
                            BANDES_ESSAI[5], duree=10, phase=2.0)
        ok &= _essai("trois rushes fabriques (un rouge de 16 s, un bleu partage, un jaune)", fab)
        plan14 = {"lot": "essai-exclusions", "rushes": r14,
                  "modeles": [{"nom": "Modele A", "couleurs": ["rouge", "bleu"], "segments": [
                      {"rush": "ex.mp4", "de": 0, "a": 16, "coloris": "rouge"},
                      {"rush": "ex-bleu.mp4", "de": 0, "a": 9.2, "coloris": "bleu"}]},
                      {"nom": "Modele B", "couleurs": ["jaune", "bleu"], "segments": [
                          {"rush": "autre.mp4", "de": 0, "a": 10, "coloris": "jaune"},
                          {"rush": "ex-bleu.mp4", "de": 9.0, "a": 14, "coloris": "bleu"}]}],
                  "exclusions": [{"rush": "ex.mp4", "de": 4.0, "a": 8.0,
                                  "pourquoi": "deux modeles a la fois"}]}
        fp14 = os.path.join(tmp, "plan-exclusions.json")
        _ecrire_json(fp14, plan14)
        pl14 = lire_plan(fp14)
        segA = [(s["rush"], s["de"], s["a"]) for s in pl14["modeles"][0]["segments"]]
        segB = [(s["rush"], s["de"], s["a"]) for s in pl14["modeles"][1]["segments"]]
        ok &= _essai("lire_plan : A garde ex 0-4 et 8-16 (4-8 exclu), ex-bleu 0-9 ; B ex-bleu "
                     "9,2-14 (le bord dispute de 0,2 s retire aux DEUX)",
                     segA == [("ex.mp4", 0.0, 4.0), ("ex.mp4", 8.0, 16.0), ("ex-bleu.mp4", 0.0, 9.0)]
                     and segB == [("autre.mp4", 0.0, 10.0), ("ex-bleu.mp4", 9.2, 14.0)]
                     and len(pl14["disputes"]) == 1, (segA, segB, pl14.get("avertissements")))
        prep14 = preparer_modele(pl14, pl14["modeles"][0], os.path.join(tmp, "prep-14"), travail)

        def touche14(rush, de, a):
            return any(rush == r_ and min(a, z1) - max(de, z0) > 0.005
                       for r_, z0, z1 in (("ex.mp4", 4.0, 8.0), ("ex-bleu.mp4", 9.0, 9.2)))
        dedans = [(p["rush"], p["debut"], p["fin"]) for p in prep14["plans"]
                  if touche14(p["rush"], p["debut"], p["fin"])]
        ok &= _essai("preparer A : aucune coupe tiree de l'exclusion ni du bord dispute (avant : "
                     "des coupes 5,8-7,4 s dans l'exclusion)", prep14["plans"] and not dedans, dedans[:4])
        s14 = os.path.join(tmp, "plan-exclusions-A")
        code, txt = _lancer_moi(["--plan", fp14, "--modele", "Modele A", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s14,
                                 "--de", "1", "--a", "2"])
        rp14 = _comme_le_bureau(s14)
        ok &= _essai("Modele A : deux variantes (code %s), l'outil DIT ce qu'il retire du plan" % code,
                     code == 0 and len(rp14["variantes"]) == 2 and "exclues retirees" in txt
                     and "retire aux deux" in txt, txt[-300:])
        for f in rp14["rapport"] or []:
            dedans = [(b["rush"], b["debut"], b["fin"]) for b in f.get("blocs", [])
                      if touche14(b["rush"], b["debut"], b["fin"])]
            ok &= _essai("Modele A variante_%02d : un seul modele, conforme, aucun bloc dans "
                         "l'exclusion" % f["variante"], f.get("un_seul_modele") and f.get("conforme")
                         and not dedans, (f.get("fautes_de_modele"), dedans))
        code, txt = _lancer_moi(["--verifier", s14], 900)
        ok &= _essai("--verifier relit le modele aux exclusions : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])
        # le controle : un bloc DANS l'exclusion, annonce chez A, est refuse (meme si
        # c'est bien l'image de sa source)
        dec14 = [{"rush": "ex.mp4", "debut": 1.0, "fin": 2.6, "longueur": 1.6},
                 {"rush": "ex-bleu.mp4", "debut": 1.0, "fin": 2.6, "longueur": 1.6},
                 {"rush": "ex.mp4", "debut": 4.5, "fin": 7.5, "longueur": 3.0}]
        morceaux = []
        for j, b in enumerate(dec14):
            mj = os.path.join(travail, "excl_%d.mp4" % j)
            bloc(os.path.join(r14, b["rush"]), False, b["debut"], mj, b["longueur"])
            morceaux.append(mj)
        v14 = os.path.join(tmp, "dans-l-exclusion.mp4")
        with open(liste, "w", encoding="utf-8") as fh:
            for m in morceaux:
                fh.write("file '%s'\n" % m.replace("'", "'\\''"))
        lancer(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", liste,
                "-c", "copy", v14, "-y"], 300)
        fautes, _d = controler_un_seul_modele(v14, dec14, pl14, "Modele A", travail)
        ok &= _essai("controle negatif : un bloc pris DANS l'exclusion (ex 4,5-7,5 s) est REFUSE, "
                     "les deux autres passent", any(x.startswith("bloc 3") and "exclusion" in x
                                                     for x in fautes)
                     and not any(x.startswith("bloc 1") or x.startswith("bloc 2") for x in fautes),
                     fautes)
        trop = json.loads(json.dumps(plan14))
        trop["modeles"][0]["segments"][1]["a"] = 10.0         # 1 s donnee aux deux modeles
        fp14b = os.path.join(tmp, "plan-chevauche.json")
        _ecrire_json(fp14b, trop)
        try:
            lire_plan(fp14b); refus = ""
        except RuntimeError as e:
            refus = str(e)
        ok &= _essai("un instant donne a DEUX modeles (1 s) : le plan est refuse, jamais tranche "
                     "en silence", "deux modeles" in refus, refus or "accepte")

        # ---------------------------------------------- 15. natif : la plaque POV et le visage
        # 07/10/2026, vrais rushes en gros plan : la plaque POV (en HAUT, decision du
        # vendeur) couvrait le front ou les yeux dans la plupart des blocs, et le rapport
        # disait « conforme ». On prefere les instants ou la tete est SOUS la plaque, et
        # sinon on le MARQUE.
        print("  -- 15. natif : la plaque POV reste en haut ; on prefere les instants ou le "
              "visage est dessous, sinon « plaque sur le visage », A REGARDER")
        r15 = os.path.join(tmp, "rushes-visage"); os.makedirs(r15)
        # 09/10/2026 : des prises de 18 s, la bascule a 9 s (avant : 10 s, a 5 s) — la
        # matiere SANS visage sous la plaque (rouge 9-18 s, bleu 0-9 s) couvre une video de
        # plus de 10 s (loi du 08/10/2026)
        fab = _video_essai(os.path.join(r15, "rouge-haut-bas.mp4"), [{"c": ROUGE}],
                           BANDES_ESSAI[2], duree=18, phase=0.3, visage=(0.08, 0.30, 9))
        fab &= _video_essai(os.path.join(r15, "bleu-bas-haut.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[6], duree=18, phase=1.4, visage=(0.30, 0.08, 9))
        fab &= _video_essai(os.path.join(r15, "jaune-haut.mp4"), [{"c": JAUNE}],
                            BANDES_ESSAI[4], duree=14, phase=2.2, visage=0.08)
        ok &= _essai("trois rushes avec un visage : rouge (sous la plaque puis dessous a 9 s), "
                     "bleu (l'inverse), jaune (toujours sous la plaque)", fab)
        fr = os.path.join(r15, "rouge-haut-bas.mp4")
        cv_haut = couverture_visage(visage_a(fr, 2.0), PLAQUE_NOMINALE)
        cv_bas = couverture_visage(visage_a(fr, 13.5), PLAQUE_NOMINALE)
        sans = [visage_a(os.path.join(rushes, "r%d.mp4" % j), 3.0) for j in (1, 2, 3)]
        ok &= _essai("la mesure : visage sous la plaque a 2 s (%.2f), dessous a 13,5 s (%.2f) ; "
                     "aucun visage vu dans les rushes sans peau des essais 2 a 12" % (cv_haut, cv_bas),
                     cv_haut >= 0.9 and cv_bas == 0.0 and sans == [None, None, None], sans)
        plan15 = {"lot": "essai-visage", "rushes": r15, "exclusions": [],
                  "modeles": [{"nom": "Modele V", "couleurs": ["rouge", "bleu"], "segments": [
                      {"rush": "rouge-haut-bas.mp4", "de": 0, "a": 18, "coloris": "rouge"},
                      {"rush": "bleu-bas-haut.mp4", "de": 0, "a": 18, "coloris": "bleu"}]},
                      {"nom": "Modele H", "couleurs": ["jaune"], "segments": [
                          {"rush": "jaune-haut.mp4", "de": 0, "a": 14, "coloris": "jaune"}]}]}
        fp15 = os.path.join(tmp, "plan-visage.json")
        _ecrire_json(fp15, plan15)
        s15 = os.path.join(tmp, "plan-visage-V")
        code, txt = _lancer_moi(["--plan", fp15, "--modele", "Modele V", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s15,
                                 "--de", "1", "--a", "2"])
        rp15 = _comme_le_bureau(s15)
        ok &= _essai("Modele V : deux variantes (code %s)" % code,
                     code == 0 and len(rp15["variantes"]) == 2, txt[-300:])
        # Casse du 07/10/2026 : quand la matiere SANS visage sous la plaque ne suffit pas,
        # l'ancienne attente « conforme » n'etait tenue qu'en remontrant cinq fois le meme
        # film dans la meme video (jusqu'a 2,4 s), sans un mot. Le visage passe apres le
        # « deja vu » : un bloc sous la plaque est alors MARQUE (A REGARDER), jamais cache.
        # 09/10/2026 : la matiere sans visage fait 18 s (rouge 9-18 s, bleu 0-9 s) ; elle
        # couvre la variante 1 (12,2 s, musique de 13 s) ; la variante 2 (15,2 s) est jugee
        # sur la meme regle : chaque bloc au visage sous la plaque est marque.
        for f in rp15["rapport"] or []:
            bl15 = f.get("blocs", [])
            mal = [k_ + 1 for k_, b in enumerate(bl15)
                   if (b["rush"].startswith("rouge") and b["debut"] + b["longueur"] / 2.0 < 9.0)
                   or (b["rush"].startswith("bleu") and b["debut"] + b["longueur"] / 2.0 > 9.0)]
            revus = [round(min(bl15[x]["fin"], bl15[y]["fin"]) - max(bl15[x]["debut"], bl15[y]["debut"]), 2)
                     for x in range(len(bl15)) for y in range(x + 1, len(bl15))
                     if bl15[x]["rush"] == bl15[y]["rush"]
                     and min(bl15[x]["fin"], bl15[y]["fin"]) - max(bl15[x]["debut"], bl15[y]["debut"]) > REVU_MAXI]
            marques = f.get("plaque_sur_le_visage") or []
            ok &= _essai("Modele V variante_%02d : %s ; plaque mesuree, toujours en haut ; jamais le "
                         "meme film remontre pour eviter un visage (%s)"
                         % (f["variante"], "chaque bloc pris quand le visage est plus BAS que la "
                            "plaque, verdict conforme" if f["variante"] == 1 else
                            "chaque bloc au visage sous la plaque est MARQUE (A REGARDER)", revus or "aucun"),
                         set(mal) <= set(marques) and set(marques) <= set(mal)
                         and (f.get("verdict") == "conforme") == (not marques)
                         and bool(f.get("conforme")) == (not marques)
                         and (f["variante"] != 1 or not mal)
                         and len(revus) <= 1 and max(revus or [0.0]) < 1.0
                         and (f.get("plaque") or {}).get("mesuree") and f["plaque"]["boite"][1] < 0.1,
                         (mal, marques, revus, f.get("verdict"), f.get("plaque")))
        s15h = os.path.join(tmp, "plan-visage-H")
        code, txt = _lancer_moi(["--plan", fp15, "--modele", "Modele H", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s15h,
                                 "--de", "1", "--a", "1"])
        fh15 = (_comme_le_bureau(s15h)["par_nom"].get("variante_01.mp4") or {})
        ok &= _essai("Modele H (le visage TOUJOURS sous la plaque) : la video sort, MARQUEE « plaque "
                     "sur le visage », verdict A REGARDER, jamais conforme en silence",
                     code == 0 and fh15.get("plaque_sur_le_visage") and fh15.get("verdict") == "A REGARDER"
                     and fh15.get("conforme") is False and fh15.get("un_seul_modele")
                     and "plaque sur le visage" in txt
                     and any("plaque sur le visage" in x for x in fh15.get("a_regarder") or []),
                     (fh15.get("plaque_sur_le_visage"), fh15.get("verdict"), txt[-300:]))
        code, txt = _lancer_moi(["--verifier", s15h], 900)
        ok &= _essai("--verifier RE-MESURE la plaque sur le visage (A REGARDER), sans casser le "
                     "reste (code 0)", code == 0 and "plaque sur le visage" in txt, txt[-300:])

        # ---------------------------------------------- 16. --plan : les couleurs viennent du plan
        # 07/10/2026, vrai lot : quatre coloris au plan, cinq « familles » aux pixels
        # (la lumiere coupait le beige en deux) -> « 5 x 1,6 s » et le marron absent de
        # trois ouvertures sur quatre.
        print("  -- 16. --plan : les familles de couleur sont les COLORIS du plan (un rouge "
              "filme sous deux lumieres reste UNE couleur)")
        c16 = [{"coloris": "noir", "couleur": (28.0, 28.0, 28.0), "duree": 5.0},
               {"coloris": "marron", "couleur": (52.0, 40.0, 32.0), "duree": 5.0},
               {"coloris": "noir", "couleur": (40.0, 36.0, 34.0), "duree": 5.0}]
        g16 = familles_couleur([dict(x) for x in c16])
        g16p = familles_couleur([dict(x, coloris="") for x in c16])
        ok &= _essai("noir et marron proches aux pixels (ecart 27) : deux familles par le plan, "
                     "une seule aux pixels (sans coloris : l'ancien comportement)",
                     sorted(g["coloris"] for g in g16) == ["marron", "noir"] and len(g16p) == 1,
                     ([g.get("coloris") for g in g16], len(g16p)))
        r16 = os.path.join(tmp, "rushes-coloris"); os.makedirs(r16)
        fab = _video_essai(os.path.join(r16, "rouge-ombre.mp4"), [{"c": ROUGE}], BANDES_ESSAI[0],
                           duree=10, phase=0.2)
        fab &= _video_essai(os.path.join(r16, "rouge-soleil.mp4"), [{"c": "0xf06868"}],
                            BANDES_ESSAI[1], duree=10, phase=1.1)
        fab &= _video_essai(os.path.join(r16, "bleu.mp4"), [{"c": BLEU}], BANDES_ESSAI[3],
                            duree=10, phase=2.3)
        fab &= _video_essai(os.path.join(r16, "jaune.mp4"), [{"c": JAUNE}], BANDES_ESSAI[6],
                            duree=10, phase=0.8)
        fab &= _video_essai(os.path.join(r16, "autre.mp4"), [{"c": "0x20a040", "etroit": True}],
                            BANDES_ESSAI[9], duree=10, phase=1.9)
        ok &= _essai("un rouge sous deux lumieres, un bleu, un jaune (et un autre modele vert)", fab)
        plan16 = {"lot": "essai-coloris", "rushes": r16, "exclusions": [],
                  "modeles": [{"nom": "Modele K", "couleurs": ["rouge", "bleu", "jaune"], "segments": [
                      {"rush": "rouge-ombre.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                      {"rush": "rouge-soleil.mp4", "de": 0, "a": 10, "coloris": "Rouge "},
                      {"rush": "bleu.mp4", "de": 0, "a": 10, "coloris": "bleu"},
                      {"rush": "jaune.mp4", "de": 0, "a": 10, "coloris": "jaune"}]},
                      {"nom": "Modele Z", "couleurs": ["vert"], "segments": [
                          {"rush": "autre.mp4", "de": 0, "a": 10, "coloris": "vert"}]}]}
        fp16 = os.path.join(tmp, "plan-coloris.json")
        _ecrire_json(fp16, plan16)
        pl16 = lire_plan(fp16)
        prep16 = preparer_modele(pl16, pl16["modeles"][0], os.path.join(tmp, "prep-16"), travail)
        ok &= _essai("preparer : 3 coloris (ceux du plan), pas 4 (les pixels coupaient le rouge)",
                     prep16["couleurs"] == 3 and prep16.get("familles_de") == "plan"
                     and sorted(prep16["coloris"]) == ["bleu", "jaune", "rouge"],
                     (prep16["couleurs"], prep16.get("coloris"), prep16.get("centres")))
        s16 = os.path.join(tmp, "plan-coloris-K")
        code, txt = _lancer_moi(["--plan", fp16, "--modele", "Modele K", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s16,
                                 "--de", "1", "--a", "3"])
        rp16 = _comme_le_bureau(s16)
        ok &= _essai("Modele K : trois variantes (code %s), rythme « 3 x 1.6 s puis 3.0 s »" % code,
                     code == 0 and len(rp16["variantes"]) == 3 and "3 x 1.6 s puis 3.0 s" in txt,
                     txt[-300:])
        refs16 = {"rouge": [_hex(ROUGE), _hex("0xf06868")], "bleu": [_hex(BLEU)], "jaune": [_hex(JAUNE)]}
        ouvertures = set()
        for f in rp16["rapport"] or []:
            v = os.path.join(s16, os.path.basename(f.get("fichier") or ""))
            noms = [b.get("coloris_du_plan") for b in f.get("blocs", [])]
            lus, t0 = [], 0.0
            for b in f.get("blocs", []):
                c = _couleur_lue(v, t0 + b["longueur"] / 2.0, None, travail)
                lus.append(min(refs16, key=lambda n_: min(math.dist(c, x) for x in refs16[n_]))
                           if c else None)
                t0 += b["longueur"]
            ouvertures.add(noms[0] if noms else None)
            ok &= _essai("Modele K variante_%02d : longueurs %s, l'ouverture montre les 3 coloris une "
                         "fois chacun (ecrit %s, RELU %s), jamais deux fois la meme couleur de suite, "
                         "conforme" % (f["variante"], f.get("longueurs"), noms[:3], lus[:3]),
                         (f.get("longueurs") or [])[:3] == [1.6, 1.6, 1.6]
                         and len(f["longueurs"]) >= 5 and set(f["longueurs"][3:]) == {3.0}
                         and sorted(noms[:3]) == sorted(refs16)
                         and lus == noms and all(lus[j] != lus[j - 1] for j in range(1, len(lus)))
                         and f.get("conforme"), (noms, lus, f.get("blocs_colles"), f.get("fautes_de_modele")))
        ok &= _essai("les trois variantes ouvrent chacune sur une couleur differente",
                     len(ouvertures) == 3, ouvertures)
        code, txt = _lancer_moi(["--verifier", s16], 900)
        ok &= _essai("--verifier relit le modele aux coloris du plan : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])

        # ---------------------------------------------- 17. casse des corrections du 07/10/2026
        print("  -- 17. casse des corrections : une couleur coupee partout n'est pas perdue ; les "
              "exclusions suivent le FICHIER ; un plan abime ailleurs ne bloque pas ; la plaque "
              "se juge en deux images")

        def fiche17(nom, coul, coupes, d=10.0):
            c_ = {"fichier": os.path.join(tmp, "absent", nom), "nom": nom, "couche": False,
                  "couleur": coul, "duree": d, "coupes": coupes}
            c_["propre_max"] = max([b - a_ for a_, b in _plages(c_)] or [0.0])
            return c_
        dense = [x * 1.5 for x in range(1, 7)]           # une coupe toutes les 1,5 s
        fams17 = [{"centre": (200, 30, 30), "rushes": [fiche17("r1", (200, 30, 30), []),
                                                       fiche17("r2", (205, 35, 30), [])]},
                  {"centre": (30, 30, 200), "rushes": [fiche17("b1", (30, 30, 200), dense),
                                                       fiche17("b2", (35, 30, 205), dense)]},
                  {"centre": (220, 220, 30), "rushes": [fiche17("y1", (220, 220, 30), []),
                                                        fiche17("y2", (215, 225, 35), [])]}]

        def suite17(fams_, n_blocs, n_ouv):
            out = []
            for i_ in range(len(fams_)):
                pris_, suite_, coul_, montrees_, blocs_ = set(), [], [], set(), []
                for k_ in range(n_blocs):
                    c_, deb_, v_ = choisir_plan(
                        fams_, i_, k_, pris_, suite_[-1] if suite_ else None,
                        coul_[-1] if coul_ else None, BLOC_COULEURS, travail,
                        (i_ % len(fams_)) if k_ == 0 else None,
                        [j for j in range(len(fams_)) if j not in montrees_] if 0 < k_ < n_ouv else None)
                    montrees_.add([n_ for n_, g in enumerate(fams_) if c_ in g["rushes"]][0])
                    pris_.add(c_["nom"]); suite_.append(c_["nom"]); coul_.append(v_)
                    blocs_.append((c_, deb_))
                out.append(blocs_)
            return out
        ouv17, flash17, vign17 = [], [], []
        for blocs_ in suite17(fams17, 3, 3):
            ouv17.append("".join(sorted({c_["nom"][0] for c_, _d in blocs_})))
            for k_, (c_, deb_) in enumerate(blocs_):
                if traverse_une_coupe(c_, deb_, BLOC_COULEURS):
                    if k_ == 0:
                        vign17.append(c_["nom"])
                    if not any(abs(deb_ - (x + MARGE_COUPE)) < 0.011 for x in c_["coupes"]):
                        flash17.append((c_["nom"], deb_))
        ok &= _essai("--rushes : une couleur dont TOUS les rushes sont coupes toutes les 1,5 s reste "
                     "dans chaque ouverture (a cheval, marquee, le bloc commence juste apres une "
                     "coupe), la vignette n'est jamais a cheval (avant : la couleur perdue et une "
                     "autre montree deux fois de suite)",
                     ouv17 == ["bry"] * 3 and not flash17 and not vign17, (ouv17, flash17, vign17))
        alt17 = ["".join(c_["nom"][0] for c_, _d in b_) for b_ in suite17(fams17[:2], 7, 2)]
        ok &= _essai("--rushes, suite a 1,6 s : une seule couleur a des places propres, on alterne "
                     "quand meme (avant : sept blocs rouges de suite)",
                     all(all(x != y for x, y in zip(a_, a_[1:])) and "b" in a_ for a_ in alt17), alt17)
        # les exclusions : le meme FICHIER, quel que soit le nom ecrit
        noms17 = ["./ex.mp4"]
        if os.path.exists(os.path.join(r14, "EX.MP4")):          # disque Mac / Windows
            noms17.append("EX.MP4")
        segs17 = []
        for nom17 in noms17:
            p17 = json.loads(json.dumps(plan14))
            p17["exclusions"][0]["rush"] = nom17
            fp17 = os.path.join(tmp, "plan-exclusion-nom.json")
            _ecrire_json(fp17, p17)
            segs17.append([(s_["rush"], s_["de"], s_["a"]) for s_ in lire_plan(fp17)["modeles"][0]["segments"]])
        ok &= _essai("une exclusion ecrite « %s » retire bien ex 4-8 s (le meme fichier ; avant : "
                     "ignoree sans un mot)" % " / ".join(noms17),
                     all(x == segA for x in segs17), segs17)
        p17 = json.loads(json.dumps(plan14))
        p17["exclusions"].append({"rush": "absent.mp4", "de": 0, "a": 3})
        p17["modeles"][1]["segments"].append({"rush": "autre.mp4", "de": "?"})
        _ecrire_json(fp17, p17)
        try:
            pl17 = lire_plan(fp17); err17 = ""
        except Exception as e:
            pl17, err17 = None, "%s %s" % (type(e).__name__, e)
        ok &= _essai("une exclusion sur un rush absent est DITE ; un segment illisible chez le "
                     "modele B ne bloque pas le montage de A (avant : ValueError)",
                     pl17 is not None and any("absent.mp4" in x for x in pl17["avertissements"])
                     and [(s_["rush"], s_["de"], s_["a"]) for s_ in pl17["modeles"][0]["segments"]] == segA,
                     err17 or (pl17 or {}).get("avertissements"))
        # le visage passe APRES le « deja vu » : jamais deux fois le meme film pour eviter un visage
        plans17 = []
        for fam_, (rush_, coul_) in enumerate([("r.mp4", (200, 40, 40)), ("b.mp4", (40, 40, 200))]):
            for si_, t0_ in enumerate((0.0, 100.0, 200.0)):
                sous_ = fam_ * 3 + si_
                for L_ in (BLOC_COULEURS, BLOC_1COULEUR):
                    d_ = t0_
                    while d_ + L_ <= t0_ + 60:
                        plans17.append({"cand": sous_, "famille": fam_, "seg": sous_, "sous": sous_,
                                        "rush": rush_, "fichier": rush_, "couche": False,
                                        "debut": round(d_, 2), "fin": round(d_ + L_, 2),
                                        "longueur": L_, "couleur": coul_, "prise": "%d.0" % sous_})
                        d_ += 0.5

        def visage17(p_):
            # le visage n'est hors de la plaque que sur deux secondes de chaque prise
            return (0, 3) if any(z <= p_["debut"] <= z + 2.0 for z in (10.0, 110.0, 210.0)) else (3, 0)
        rep17 = 0
        for i_ in range(6):
            s_ = suite_de_plans(plans17, 2, i_, [1.6, 1.6, 3.0, 3.0, 3.0, 3.0],
                                lambda p_: tuple(p_["couleur"]), visage17)
            rep17 += sum(1 for x in range(len(s_)) for y in range(x + 1, len(s_))
                         if _film_commun(s_[x], s_[y]) > REVU_MAXI)
        ok &= _essai("--plan : la recherche d'un bloc sans visage ne relache jamais le « deja vu » "
                     "(avant : douze fois le meme film remontre dans la meme video ; vu sur le vrai "
                     "lot, 10,31-11,91 s puis 10,0-13,0 s)", rep17 == 0, rep17)
        # la plaque : pour le CHOIX, deux images suffisent quand le visage est sous la plaque
        lus17 = []
        vrai_tete_a = tete_a
        try:
            def compte(*x, **y):
                lus17.append(x[1])
                return vrai_tete_a(*x, **y)
            tete_du_bloc.__globals__["tete_a"] = compte
            fj = os.path.join(r15, "jaune-haut.mp4")
            t_choix = tete_du_bloc(fj, False, 1.0, 3.0, None, PLAQUE_NOMINALE, False, choix=True)
            lus_choix = len(lus17)
            t_marque = tete_du_bloc(fj, False, 1.0, 3.0, None, PLAQUE_NOMINALE, False)
            t_hijab = tete_du_bloc(fj, False, 1.0, 3.0, None, PLAQUE_NOMINALE, True, choix=True)
        finally:
            tete_du_bloc.__globals__["tete_a"] = vrai_tete_a
        n_marque = t_marque["etats"].count("sous_plaque")
        ok &= _essai("visage toujours sous la plaque : le choix s'arrete des que le rang est sur "
                     "(%d images lues), le marquage final en lit trois (%d sur 3 couvertes)"
                     % (lus_choix, n_marque),
                     t_choix["rang"][0] == 3 and lus_choix == VISAGE_MAXI and n_marque == 3
                     and t_hijab["rang"][0] == 2 and len(t_hijab["etats"]) == VISAGE_MAXI
                     and len(lus17) == lus_choix + 3 + VISAGE_MAXI,
                     (t_choix, lus17, t_marque["etats"], t_hijab))
        # ---------------------------------------------- 18. la tete : main, hijab beige, gros plan
        # 07/10/2026, vrai lot : une MAIN passait pour « le visage, plus bas que la plaque »
        # (le vrai visage colle a un hijab beige, ou plus petit que la main) ; un gros plan
        # de la poitrine (tete hors du cadre) valait « plaque hors du visage » et passait
        # EN PREMIER ; tout sortait « conforme ».
        print("  -- 18. la tete : une main en haut de l'image, un hijab beige, un gros plan "
              "sans tete ; en niche hijab, la tete dans le cadre passe avant la plaque")
        r18 = os.path.join(tmp, "rushes-tete"); os.makedirs(r18)
        fab = _video_essai(os.path.join(r18, "main-haut.mp4"), [{"c": ROUGE}], BANDES_ESSAI[2],
                           duree=10, phase=0.3, visage=0.06, mains=[(0.60, 0.30, 0.20, 0.11)])
        fab &= _video_essai(os.path.join(r18, "hijab-beige-main.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[3], duree=10, phase=1.2, visage=0.08,
                            hijab=("0xe2c4b4", 0.30, 0.27), mains=[(0.62, 0.36, 0.18, 0.09)])
        fab &= _video_essai(os.path.join(r18, "rouge-gros-plan.mp4"), [{"c": ROUGE}],
                            BANDES_ESSAI[4], duree=10, phase=0.7, haut_plein=ROUGE)
        fab &= _video_essai(os.path.join(r18, "bleu-gros-plan.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[5], duree=10, phase=1.9, haut_plein=BLEU)
        fab &= _video_essai(os.path.join(r18, "rouge-tete-haute.mp4"), [{"c": ROUGE}],
                            BANDES_ESSAI[6], duree=10, phase=2.4, visage=0.07)
        fab &= _video_essai(os.path.join(r18, "bleu-tete-haute.mp4"), [{"c": BLEU}],
                            BANDES_ESSAI[7], duree=10, phase=0.1, visage=0.07)
        fab &= _video_essai(os.path.join(r18, "jaune-dessous.mp4"), [{"c": JAUNE, "etroit": True}],
                            BANDES_ESSAI[8], duree=10, phase=1.5, visage=0.30)
        ok &= _essai("rushes fabriques : une main plus grande que le visage, un visage colle a un "
                     "hijab beige avec une main dessous, deux gros plans sans tete, deux plans "
                     "entiers la tete sous la plaque, un plan entier le visage dessous", fab)
        et18 = {n_: etat_tete(tete_a(os.path.join(r18, n_ + ".mp4"), 4.0), PLAQUE_NOMINALE)[0]
                for n_ in ("main-haut", "hijab-beige-main", "rouge-gros-plan", "jaune-dessous",
                           "rouge-tete-haute")}
        ok &= _essai("la main n'est jamais « le visage plus bas que la plaque » : main en haut -> "
                     "plaque sur le visage, hijab beige + main -> plaque sur le visage (avant : "
                     "« dessous », la main) ; gros plan sans tete -> tete HORS du cadre (avant : "
                     "« plaque hors du visage ») ; plan entier -> dessous",
                     et18 == {"main-haut": "sous_plaque", "hijab-beige-main": "sous_plaque",
                              "rouge-gros-plan": "hors_cadre", "jaune-dessous": "dessous",
                              "rouge-tete-haute": "sous_plaque"}, et18)
        ok &= _essai("aucun visage trouve n'est jamais rang 0 : en niche hijab le gros plan sans "
                     "tete passe APRES la tete dans le cadre sous la plaque",
                     rang_tete(["hors_cadre"] * 3, True)[0] == 3
                     and rang_tete(["sous_plaque"] * 3, True)[0] == 2
                     and rang_tete(["non_vue"] * 3, True)[0] == 2
                     and rang_tete(["sous_plaque"] * 3, True) < rang_tete(["non_vue"] * 3, True)
                     and rang_tete(["dessous"] * 3, True)[0] == 0
                     and rang_tete(["dessous", "dessous", "non_vue"], False)[0] == 1
                     and marque_tete(["non_vue", "dessous", "dessous"], True, vignette=True)[1]
                     and not marque_tete(["non_vue", "dessous", "dessous"], True)[1])
        plan18 = {"lot": "essai-tete", "rushes": r18, "exclusions": [],
                  "modeles": [{"nom": "Modele T", "couleurs": ["rouge", "bleu"], "segments": [
                      {"rush": "rouge-gros-plan.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                      {"rush": "rouge-tete-haute.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                      {"rush": "bleu-gros-plan.mp4", "de": 0, "a": 10, "coloris": "bleu"},
                      {"rush": "bleu-tete-haute.mp4", "de": 0, "a": 10, "coloris": "bleu"}]},
                      {"nom": "Modele G", "couleurs": ["rouge", "bleu"], "segments": [
                          {"rush": "main-haut.mp4", "de": 0, "a": 10, "coloris": "rouge"},
                          {"rush": "hijab-beige-main.mp4", "de": 0, "a": 10, "coloris": "bleu"}]},
                      {"nom": "Modele Y", "couleurs": ["jaune"], "segments": [
                          {"rush": "jaune-dessous.mp4", "de": 0, "a": 10, "coloris": "jaune"}]}]}
        fp18 = os.path.join(tmp, "plan-tete.json")
        _ecrire_json(fp18, plan18)
        s18 = os.path.join(tmp, "plan-tete-T")
        code, txt = _lancer_moi(["--plan", fp18, "--modele", "Modele T", "--style", "natif",
                                 "--pov", "hijab", "--musiques", musp, "--sortie", s18,
                                 "--de", "1", "--a", "2"])
        rp18 = _comme_le_bureau(s18)
        ok &= _essai("Modele T (niche hijab) : deux variantes (code %s)" % code,
                     code == 0 and len(rp18["variantes"]) == 2, txt[-300:])
        for f in rp18["rapport"] or []:
            gros = [b["rush"] for b in f.get("blocs", []) if "gros-plan" in b["rush"]]
            ok &= _essai("Modele T variante_%02d : aucun gros plan sans tete (avant : choisis EN "
                         "PREMIER), chaque bloc la tete dans le cadre et MARQUE « plaque sur le "
                         "visage », verdict A REGARDER, jamais conforme" % f["variante"],
                         f.get("blocs") and not gros
                         and f.get("plaque_sur_le_visage") == list(range(1, len(f["blocs"]) + 1))
                         and f.get("verdict") == "A REGARDER" and f.get("conforme") is False
                         and all(b.get("tete") == ["sous_plaque"] * 3 for b in f["blocs"]),
                         (gros, f.get("plaque_sur_le_visage"), f.get("verdict"),
                          [b.get("tete") for b in f.get("blocs", [])]))
        # sans tete du tout (seulement les gros plans) : la video sort, marquee « tete non
        # vue », la VIGNETTE comprise
        plan18g = json.loads(json.dumps(plan18))
        plan18g["modeles"][0]["segments"] = [x for x in plan18g["modeles"][0]["segments"]
                                             if "gros-plan" in x["rush"]]
        fp18g = os.path.join(tmp, "plan-tete-gros.json")
        _ecrire_json(fp18g, plan18g)
        s18g = os.path.join(tmp, "plan-tete-gros-T")
        code, txt = _lancer_moi(["--plan", fp18g, "--modele", "Modele T", "--style", "natif",
                                 "--pov", "hijab", "--musiques", musp, "--sortie", s18g,
                                 "--de", "1", "--a", "1"])
        fg = _comme_le_bureau(s18g)["par_nom"].get("variante_01.mp4") or {}
        ok &= _essai("seulement des gros plans sans tete (niche hijab) : la video sort, chaque bloc "
                     "MARQUE « tete non vue » (la vignette comprise), A REGARDER, jamais conforme",
                     code == 0 and fg.get("blocs")
                     and fg.get("tete_non_vue") == list(range(1, len(fg["blocs"]) + 1))
                     and fg.get("verdict") == "A REGARDER" and fg.get("conforme") is False
                     and "tete non vue" in txt and "VIGNETTE" in txt,
                     (fg.get("tete_non_vue"), fg.get("verdict"), txt[-300:]))
        code, txt = _lancer_moi(["--verifier", s18g], 900)
        ok &= _essai("--verifier RE-MESURE la tete non vue (A REGARDER)", "tete non vue" in txt,
                     txt[-300:])
        # le meme plan hors de la niche hijab : le gros plan n'est pas marque « tete non vue »
        s18e = os.path.join(tmp, "plan-tete-gros-E")
        code, txt = _lancer_moi(["--plan", fp18g, "--modele", "Modele T", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s18e,
                                 "--de", "1", "--a", "1"])
        fe = _comme_le_bureau(s18e)["par_nom"].get("variante_01.mp4") or {}
        ok &= _essai("hors de la niche hijab, un gros plan sans tete n'est pas marque (la tenue se "
                     "voit) : verdict conforme",
                     code == 0 and fe.get("blocs") and not fe.get("tete_non_vue")
                     and fe.get("verdict") == "conforme", (fe.get("tete_non_vue"), fe.get("verdict")))

        # ---------------------------------------------- 19. le film distinct, le film revu
        # 07/10/2026, vrai lot : une prise deja coupee toutes les 2 s ne portait qu'UNE
        # fenetre de 3 s ; les blocs 1 et 3, 2 et 4 etaient le meme film, « conforme ».
        print("  -- 19. --plan : le nombre de blocs suit le film DISTINCT ; un film revu est "
              "A REGARDER, jamais conforme")
        b19 = [{"rush": "r", "debut": 0.0, "longueur": 3.0}, {"rush": "s", "debut": 0.0, "longueur": 1.6},
               {"rush": "r", "debut": 0.3, "longueur": 3.0}, {"rush": "r", "debut": 3.1, "longueur": 3.0}]
        p19 = [{"rush": "r", "debut": round(0.25 * k, 2), "longueur": 3.0} for k in range(4)]
        ok &= _essai("films_revus : le bloc 3 remontre 2,7 s du bloc 1 ; quatre « coupes » a 0,25 s "
                     "d'ecart ne font qu'UN bloc distinct",
                     films_revus(b19) == [3] and film_distinct(p19, 3.0) == 1, films_revus(b19))
        # 07/10/2026 (casse) : le tri par le film GACHE ne doit pas changer le SECOURS.
        # Rien ne passe l'ecart de 30 : avant ce tri, le secours etait le plus grand
        # ecart (28, relisible) ; trie d'abord par le film gache, il devenait un bloc a
        # 8 d'ecart (deux blocs « colles », la variante A REVOIR).
        def _p19(rush, fam, sous, deb, L):
            return {"rush": rush, "famille": fam, "sous": sous, "seg": sous, "debut": deb,
                    "longueur": L, "fin": round(deb + L, 2), "fichier": rush, "couche": False}
        s19p = [_p19("A", 0, 0, round(1.5 * k, 2), L) for L in (3.0, 1.6) for k in range(12)]
        s19p += [_p19("B1", 1, 1, round(0.25 * k, 2), 3.0) for k in range(14) if 0.25 * k <= 3.4]
        s19p += [_p19("B2", 1, 2, round(0.05 * k, 2), 3.0) for k in range(4)]
        s19p += [_p19("B1", 1, 1, 0.0, 1.6), _p19("B2", 1, 2, 0.0, 1.6)]

        def _mes19(p):
            if p["famille"] == 0:
                return (40, 40, 40)
            if p["rush"] == "B1":
                return (68, 40, 40) if (0.8 <= p["debut"] <= 2.6 and p["longueur"] == 3.0) \
                    else (48, 40, 40)
            return (46, 40, 40)
        for p in s19p:
            p["couleur"] = _mes19(p)
        su19 = suite_de_plans(s19p, 2, 3, [1.6, 1.6, 3.0, 3.0], _mes19, None)
        ec19 = [round(math.dist(_mes19(su19[k]), _mes19(su19[k - 1])), 1) for k in range(1, len(su19))]
        ok &= _essai("le secours (rien ne passe l'ecart) reste le plus grand ecart relisible, meme "
                     "trie par le film gache : bloc 3 a 28 d'ecart, pas a 8",
                     len(ec19) == 3 and ec19[1] >= SEUIL_RELU + 4, ec19)
        r19 = os.path.join(tmp, "rushes-film-distinct"); os.makedirs(r19)
        # 09/10/2026 : sept prises (avant : cinq, 11,9 s) — le film distinct a 1,6 s porte
        # une video de plus de 10 s (loi du 08/10/2026) sans remontrer le meme film
        fab = rush_monte(os.path.join(r19, "monte-2s.mp4"), ROUGE, BANDES_ESSAI[0:7],
                         [2.0, 3.9, 2.0, 2.0, 2.0, 2.0, 2.0])
        fab &= _video_essai(os.path.join(r19, "court-rouge.mp4"), [{"c": ROUGE}], BANDES_ESSAI[6],
                            duree=2.4, phase=0.4)
        fab &= _video_essai(os.path.join(r19, "court-bleu.mp4"), [{"c": BLEU}], BANDES_ESSAI[7],
                            duree=2.4, phase=1.1)
        fab &= _video_essai(os.path.join(r19, "autre.mp4"), [{"c": JAUNE, "etroit": True}],
                            BANDES_ESSAI[9], duree=10, phase=0.6)
        ok &= _essai("un rush rouge coupe toutes les 2 s (une seule prise de 3,9 s), deux prises "
                     "de 2,4 s (rouge, bleu), un autre modele", fab)
        plan19 = {"lot": "essai-distinct", "rushes": r19, "exclusions": [],
                  "modeles": [{"nom": "Modele D", "couleurs": ["rouge"], "segments": [
                      {"rush": "monte-2s.mp4", "de": 0, "a": 15.9, "coloris": "rouge"}]},
                      {"nom": "Modele K", "couleurs": ["rouge", "bleu"], "segments": [
                          {"rush": "court-rouge.mp4", "de": 0, "a": 2.4, "coloris": "rouge"},
                          {"rush": "court-bleu.mp4", "de": 0, "a": 2.4, "coloris": "bleu"}]},
                      {"nom": "Modele Z", "couleurs": ["jaune"], "segments": [
                          {"rush": "autre.mp4", "de": 0, "a": 10, "coloris": "jaune"}]}]}
        fp19 = os.path.join(tmp, "plan-distinct.json")
        _ecrire_json(fp19, plan19)
        s19 = os.path.join(tmp, "plan-distinct-D")
        code, txt = _lancer_moi(["--plan", fp19, "--modele", "Modele D", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s19,
                                 "--de", "1", "--a", "2"])
        rp19 = _comme_le_bureau(s19)
        ok &= _essai("Modele D : deux variantes (code %s), l'outil DIT que le film distinct ne "
                     "porte qu'un bloc de 3 s et passe a 1,6 s" % code,
                     code == 0 and len(rp19["variantes"]) == 2 and "film DISTINCT" in txt,
                     txt[-300:])
        for f in rp19["rapport"] or []:
            bl = f.get("blocs") or []
            ok &= _essai("Modele D variante_%02d : 1,6 s partout (avant : quatre blocs de 3 s, deux "
                         "fois le meme film), aucun film revu, conforme" % f["variante"],
                         bl and set(f.get("longueurs") or []) == {BLOC_COULEURS}
                         and not films_revus(bl) and f.get("film_revu") == [] and f.get("conforme"),
                         (f.get("longueurs"), f.get("film_revu"), f.get("verdict"), f.get("suite")))
        s19k = os.path.join(tmp, "plan-distinct-K")
        code, txt = _lancer_moi(["--plan", fp19, "--modele", "Modele K", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", musp, "--sortie", s19k,
                                 "--de", "1", "--a", "1"])
        fk = _comme_le_bureau(s19k)["par_nom"].get("variante_01.mp4") or {}
        ok &= _essai("Modele K (4,8 s de film, deux blocs differents) : la pub de plus de 10 s "
                     "remontre du film, MARQUE « film revu », A REGARDER, jamais conforme",
                     code == 0 and fk.get("film_revu") and fk.get("verdict") == "A REGARDER"
                     and fk.get("conforme") is False and "film revu" in txt
                     and fk.get("film_revu") == films_revus(fk.get("blocs") or []),
                     (fk.get("film_revu"), fk.get("verdict"), fk.get("longueurs"), txt[-200:]))
        code, txt = _lancer_moi(["--verifier", s19k], 900)
        ok &= _essai("--verifier recompte le film revu (A REGARDER)", "film revu" in txt, txt[-300:])

        # ---------------------------------------------- 20. les lois de la musique et des 10 s
        # 07/10/2026 : une couleur, une musique de 7,9 s : quatre blocs de 3 s (12 s), la video
        # tronquee a 7,8 s, et le controle accusait « deux modeles ».
        # 09/10/2026 : LES LOIS DU VENDEUR (08/10/2026). Une musique de 12 s OU MOINS est
        # ecartee AVANT le montage (avant cette loi, l'essai attendait une video de 6 s sur une
        # musique de 7,9 s, « conforme ») ; chaque video livree DEPASSE 10 s, sinon elle sort
        # « trop_courte », jamais conforme ; une musique plus longue que la video ne la coupe pas.
        print("  -- 20. les lois de la musique : 12 s ou moins ecartee, une video de 10 s ou moins "
              "trop_courte, une musique plus longue ne coupe pas la video, jamais « deux modeles »")
        m20 = os.path.join(tmp, "musiques-courtes"); os.makedirs(m20)
        ok &= _musique_essai(os.path.join(m20, "a-courte.wav"), 9.0) \
            and _musique_essai(os.path.join(m20, "b-limite.wav"), 12.0, 550) \
            and _musique_essai(os.path.join(m20, "c-longue.wav"), 16.5, 660)
        s20 = os.path.join(tmp, "plan-musique-courte")
        code, txt = _lancer_moi(["--plan", fp11, "--modele", "Modele P", "--style", "natif",
                                 "--pov", "etudiante", "--musiques", m20, "--sortie", s20,
                                 "--de", "1", "--a", "2"])
        rp20 = _comme_le_bureau(s20)["par_nom"]
        f1, f2 = rp20.get("variante_01.mp4") or {}, rp20.get("variante_02.mp4") or {}
        ok &= _essai("LOI DES 12 s : les musiques de 9 s et de 12 s pile sont ECARTEES avant le "
                     "montage, et dites ; aucune variante ne les porte",
                     code == 0 and "2 musique(s) de 12 s ou moins ecartee(s)" in txt
                     and "a-courte.wav (9.0 s)" in txt and "b-limite.wav (12.0 s)" in txt
                     and "c-longue.wav" in str(f1.get("musique"))
                     and "c-longue.wav" in str(f2.get("musique")),
                     (code, _derniere_ligne(txt, "ecartee"), f1.get("musique"), f2.get("musique")))
        for k, f in ((1, f1), (2, f2)):
            v = os.path.join(s20, "variante_%02d.mp4" % k)
            if not os.path.isfile(v):
                ok = _essai("variante_%02d ecrite" % k, False); continue
            bl = sum(f.get("longueurs") or [0.0])
            ok &= _essai("variante_%02d : musique de 16,5 s, %.1f s de blocs -> la video n'est PAS "
                         "coupee (image %.2f s, fichier %.2f s), elle depasse 10 s, un seul modele, "
                         "conforme" % (k, bl, duree_image(v), duree(v)),
                         bl > DUREE_MINI_LIVREE and bl <= 16.5 - 1.0
                         and abs(duree_image(v) - bl) <= 0.15 and abs(duree(v) - bl) <= 0.15
                         and f.get("finit_avec_la_musique") and not f.get("trop_courte")
                         and f.get("un_seul_modele") and f.get("conforme"),
                         (f.get("longueurs"), duree_image(v), duree(v), f.get("verdict"),
                          f.get("a_revoir")))
        # une musique qui PASSE le filtre (12,1 s) mais ne porte, pour deux couleurs, que
        # 1,6 1,6 3 3 = 9,2 s de blocs : sans autre musique, la video sort trop_courte
        m20b = os.path.join(tmp, "musique-juste"); os.makedirs(m20b)
        ok &= _musique_essai(os.path.join(m20b, "d-juste.wav"), 12.1, 440)
        s20t = os.path.join(tmp, "plan-trop-courte")
        code, txt = _lancer_moi(["--plan", fplan, "--modele", "Modele A", "--musiques", m20b,
                                 "--sortie", s20t, "--de", "1", "--a", "1"])
        ft = _comme_le_bureau(s20t)["par_nom"].get("variante_01.mp4") or {}
        ok &= _essai("LOI DES 10 s : deux couleurs, seule musique de 12,1 s -> 1,6 1,6 3 3 (9,2 s) : "
                     "la video sort MARQUEE trop_courte (A REVOIR), jamais conforme, et l'outil le DIT",
                     ft.get("longueurs") == [1.6, 1.6, 3.0, 3.0] and ft.get("trop_courte") is True
                     and ft.get("conforme") is False and ft.get("verdict") != "conforme"
                     and abs((ft.get("duree") or 0) - 9.2) <= 0.2
                     and any("trop_courte" in x for x in ft.get("a_revoir") or [])
                     and "trop_courte" in txt,
                     (code, ft.get("longueurs"), ft.get("duree"), ft.get("trop_courte"),
                      ft.get("verdict"), txt[-300:]))
        code, txt = _lancer_moi(["--verifier", s20t], 900)
        ok &= _essai("--verifier relit cette video de 9,2 s : trop_courte, ECHEC (code 1)",
                     code == 1 and "trop_courte" in txt, txt[-300:])
        # une video plus courte que ses blocs (relue par le verificateur) : « musique trop
        # courte » (et trop_courte), jamais « deux modeles »
        s20c = os.path.join(tmp, "plan-musique-tronquee"); os.makedirs(s20c)
        v20 = os.path.join(s20, "variante_01.mp4")
        r = lancer(["ffmpeg", "-v", "error", "-i", v20, "-t", "4.0", "-c", "copy",
                    os.path.join(s20c, "variante_01.mp4"), "-y"], 120)
        rap20 = [dict(f1, fichier=os.path.join(s20c, "variante_01.mp4"))]
        _ecrire_json(os.path.join(s20c, "_rapport.json"), rap20)
        code, txt = _lancer_moi(["--verifier", s20c], 900)
        ok &= _essai("--verifier sur une video coupee a 4 s : « musique trop courte » et "
                     "trop_courte, un seul modele dedans (avant : « modeles dedans : 2 »)",
                     r.returncode == 0 and code == 1 and "musique trop courte" in txt
                     and "trop_courte" in txt
                     and "modeles dedans : 1" in txt and "modeles dedans : 2" not in txt, txt[-400:])

        # ---------------------------------------------- 21. N = 1 : les familles nommees
        # 07/10/2026 : en --rushes, les familles etaient refaites sur UNE image par rush, en
        # RVB : le noir et le marron ensemble, des couleurs absentes de l'ouverture.
        print("  -- 21. --rushes --familles (N = 1) : les familles de captures.py / du client, "
              "et une mesure de couleur comme captures.py")
        # un noir clair est plus pres du marron que du noir sombre EN RVB : l'ancienne
        # regle (RVB, centres a intervalles reguliers) faisait {noir clair, marron, marron}
        # et {noir sombre}
        f21 = [{"nom": "n1", "couleur": (54, 57, 60)}, {"nom": "n2", "couleur": (36, 39, 43)},
               {"nom": "m1", "couleur": (58, 44, 41)}, {"nom": "m2", "couleur": (64, 51, 48)},
               {"nom": "g1", "couleur": (100, 104, 110)}, {"nom": "g2", "couleur": (110, 112, 116)},
               {"nom": "b1", "couleur": (184, 176, 168)}, {"nom": "b2", "couleur": (170, 158, 150)}]
        g21 = sorted("".join(sorted(x["nom"][0] for x in g["rushes"])) for g in familles_n(f21, 4)[0])
        ok &= _essai("familles_n, quatre couleurs dont un noir et un marron sombres (proches en "
                     "RVB) : noir / marron / gris / beige, deux rushes chacune",
                     g21 == ["bb", "gg", "mm", "nn"], g21)
        r21 = os.path.join(tmp, "rushes-familles"); os.makedirs(r21)
        teintes = {"noir": "0x30343a", "marron": "0x4a3530", "gris": "0x6c6e72", "beige": "0xb8aca2"}
        fab, fam21 = True, {}
        for j, (nom_c, c_) in enumerate(teintes.items()):
            for q in (1, 2):
                n_ = "clip-%d%d.mp4" % (j, q)
                fab &= _video_essai(os.path.join(r21, n_), [{"c": c_}], BANDES_ESSAI[(2 * j + q) % 10],
                                    duree=10, phase=0.7 * j + 0.4 * q)
                fam21.setdefault(nom_c, []).append(n_)
        ok &= _essai("huit rushes : noir, marron, gris, beige, deux fois", fab)
        ff21 = os.path.join(tmp, "familles.json")
        _ecrire_json(ff21, {"familles": [{"nom": k_, "rushes": v_} for k_, v_ in fam21.items()]})
        # 07/10/2026 (casse) : des noms en ARABE. `_coloris` gardait seulement l'ASCII :
        # les quatre noms devenaient vides et `lire_familles` en faisait UNE famille
        ar21 = {"noir": "كحل", "marron": "ماروني", "gris": "رمادي", "beige": "بيج"}
        ffa21 = os.path.join(tmp, "familles-arabe.json")
        _ecrire_json(ffa21, {"familles": [{"nom": ar21[k_], "rushes": v_} for k_, v_ in fam21.items()]})
        lf21 = lire_familles(ffa21, r21)[0]
        ok &= _essai("--familles aux noms ARABES : quatre familles, deux rushes chacune (avant : une "
                     "seule, les noms vides) ; « Noir » = « noir », « Ecru » accentue = « ecru »",
                     sorted(len(r_) for _n, r_ in lf21) == [2, 2, 2, 2]
                     and _coloris(" Noir ") == "noir" and _coloris("\u00c9cru") == "ecru"
                     and _coloris("كحل") and _coloris("كحل") != _coloris("بيج"),
                     [(n_, len(r_)) for n_, r_ in lf21])
        s21 = os.path.join(tmp, "creas-familles")
        code, txt = _lancer_moi(["--rushes", r21, "--familles", ff21, "--sortie", s21, "--pov",
                                 "etudiante", "--combien", "2", "--style", "natif", "--couleurs", "4",
                                 "--musiques", musp])
        rp21 = _comme_le_bureau(s21)
        ok &= _essai("la commande --rushes --familles : deux variantes (code %s), montees comme "
                     "--plan sur un plan d'UN modele aux fichiers entiers" % code,
                     code == 0 and len(rp21["variantes"]) == 2
                     and os.path.isfile(os.path.join(s21, PLAN_UN_MODELE)) and "fichiers entiers" in txt,
                     txt[-300:])
        for f in rp21["rapport"] or []:
            noms = [b.get("coloris_du_plan") for b in f.get("blocs", [])]
            justes = all(b["rush"] in fam21.get(b.get("coloris_du_plan"), []) for b in f.get("blocs", []))
            ok &= _essai("variante_%02d : l'ouverture montre les 4 familles NOMMEES une fois chacune "
                         "(%s), chaque bloc dans sa famille, conforme" % (f["variante"], noms[:4]),
                         (f.get("longueurs") or [])[:4] == [1.6] * 4 and sorted(noms[:4]) == sorted(teintes)
                         and justes and f.get("un_seul_modele") and f.get("conforme"),
                         (noms, f.get("longueurs"), f.get("verdict")))
        code, txt = _lancer_moi(["--verifier", s21], 900)
        ok &= _essai("--verifier relit la sortie --familles : code 0", code == 0,
                     _derniere_ligne(txt, "conforme") or txt[-300:])
        # 07/10/2026 (casse) : les MEMES huit rushes en --rushes (sans --familles), la
        # commande du bureau. Le noir et le marron sont maintenant deux familles : choisie
        # une a une, la derniere couleur de l'ouverture tombait juste apres sa jumelle
        # (variantes 3 et 7 sur 8 : gris, beige, noir, marron). L'ordre est planifie.
        s21r = os.path.join(tmp, "creas-rushes-4")
        code, txt = _lancer_moi(["--rushes", r21, "--sortie", s21r, "--pov", "etudiante",
                                 "--combien", "4", "--style", "natif", "--couleurs", "4",
                                 "--musiques", musp])
        coul21 = {n_: k_ for k_, v_ in fam21.items() for n_ in v_}
        ouv21 = [[coul21.get(b["rush"]) for b in f.get("blocs", [])[:4]]
                 for f in _comme_le_bureau(s21r)["rapport"] or []]
        # (le code de sortie suit aussi « musiques differentes » : quatre variantes sur
        # les musiques de l'essai le font tomber, ce n'est pas l'objet ici)
        ok &= _essai("--rushes, quatre couleurs dont le noir et le marron : dans chaque ouverture, "
                     "les quatre couleurs une fois et JAMAIS le noir a cote du marron",
                     len(ouv21) == 4
                     and all(sorted(o) == sorted(teintes) for o in ouv21)
                     and not any({o[k_], o[k_ - 1]} == {"noir", "marron"}
                                 for o in ouv21 for k_ in range(1, 4)), (code, ouv21))

        # ---------------------------------------------- 22. N = 1, moins de quatre rushes
        # 07/10/2026 : moins de quatre rushes partaient chez manita.py (aucun rythme, des
        # flashs). MONTER-10 les monte maintenant : un plan d'un modele aux fichiers entiers.
        print("  -- 22. --rushes avec TROIS rushes : monte comme --plan (fichiers entiers), le "
              "rythme 1,6 / 3 s, aucun flash")
        r22 = os.path.join(tmp, "rushes-trois"); os.makedirs(r22)
        for k in range(3):
            shutil.copy(os.path.join(rushes, "r%d.mp4" % (k + 1)), r22)
        s22 = os.path.join(tmp, "creas-trois")
        code, txt = _lancer_moi(["--rushes", r22, "--sortie", s22, "--pov", "etudiante",
                                 "--combien", "2", "--style", "natif", "--couleurs", "3",
                                 "--musiques", musp])
        rp22 = _comme_le_bureau(s22)
        ok &= _essai("trois rushes : deux variantes (code %s ; avant : « pas assez de rushes », "
                     "code 1)" % code, code == 0 and len(rp22["variantes"]) == 2, txt[-300:])
        for f in rp22["rapport"] or []:
            v = os.path.join(s22, os.path.basename(f.get("fichier") or ""))
            r = mesurer_rythme(v, f.get("longueurs") or [])
            ok &= _essai("variante_%02d : 3 x 1,6 s puis 3 s, aucun bloc de moins d'une seconde, "
                         "rythme RELU, conforme" % f["variante"],
                         (f.get("longueurs") or [])[:3] == [1.6] * 3
                         and min(f.get("longueurs") or [0]) >= FLASH_MAXI and r["ok"]
                         and f.get("conforme"), (f.get("longueurs"), _rythme_court(r), f.get("verdict")))
    except Exception as e:
        import traceback
        traceback.print_exc()
        ok = _essai("l'auto-test va jusqu'au bout", False, e)
    finally:
        STYLE = style_avant
        if ok:
            shutil.rmtree(tmp, ignore_errors=True)
        else:
            print("  (dossier d'essai garde pour regarder : %s)" % tmp)
    print(BARRE); print("  TOUT EST BON." if ok else "  IL Y A UNE FAUTE — on ne livre pas.")
    print(BARRE)
    return 0 if ok else 1


# ====================================================================
#   UN MODELE DONT LES RUSHES SONT LES FICHIERS ENTIERS (07/10/2026)
# ====================================================================
# Une mission seule (N = 1) se montait ainsi : --rushes refaisait ses propres
# familles de couleur sur UNE image par rush (le noir et le marron ensemble,
# des couleurs absentes de l'ouverture, d'autres deux fois de suite), et sous
# quatre rushes le bureau passait a manita.py (aucun rythme 1,6 / 3 s, des
# flashs de 0,1 s). Maintenant :
#   --familles FICHIER   les familles que captures.py a MESUREES sur tout le
#                        rush (son _rapport.json) ou que le client a NOMMEES
#                        ({"familles": [{"nom", "rushes"}]}) : elles font le
#                        « coloris » de chaque fichier ;
#   le montage passe par le mode --plan (un plan d'UN modele, fichiers
#   entiers, ecrit dans la sortie : _plan-un-modele.json) : il suit les
#   coloris, accepte une ou deux longues prises, tient le rythme 1,6 / 3 s,
#   evite les coupes des rushes, compte le film distinct et mesure la plaque.
#   Sans --familles, il sert aussi quand il y a moins de quatre rushes (ou de
#   longues prises) : les coloris viennent alors de la mesure de captures.py
#   (--couleurs N), ou des pixels.
PLAN_UN_MODELE = "_plan-un-modele.json"


def lire_familles(chemin, dossier):
    """Les familles de --familles : [(nom, [rushes])]. Lit le _rapport.json de
    captures.py ({"familles": [{"rushes": [...]}], ...}, sans nom : « couleur-1 »,
    « couleur-2 »...), ou {"familles": [{"nom": "noir", "rushes": [...]}]}, ou
    la liste seule. Deux familles du MEME nom (le client les a fusionnees) n'en
    font qu'une. Un rush se donne par son nom (un chemin est ramene a son nom).
    Rend aussi les avertissements (rush absent du dossier, rush dans deux
    familles)."""
    d = _lire_json(chemin)
    fams = d.get("familles") if isinstance(d, dict) else d
    if not isinstance(fams, list) or not fams:
        raise RuntimeError("--familles : aucune famille lisible dans %s" % chemin)
    memo, out, avert, deja = {}, [], [], {}
    for k, g in enumerate(fams, 1):
        if not isinstance(g, dict):
            continue
        if g.get("exclue"):
            continue
        nom = str(g.get("nom") or g.get("coloris") or g.get("couleur") or "couleur-%d" % k)
        rushes = []
        for r in g.get("rushes") or []:
            n = os.path.basename(str(r).replace("\\", "/"))
            cle, trouve = _cle_rush(dossier, n, memo)
            if not trouve:
                avert.append("%s (famille %s) n'est pas dans le dossier des rushes" % (n, nom))
                continue
            if cle in deja and deja[cle] != nom:
                avert.append("%s est dans deux familles (%s et %s) : gardee dans %s"
                             % (n, deja[cle], nom, deja[cle]))
                continue
            deja[cle] = nom
            rushes.append(n)
        if rushes:
            for x in out:
                if _coloris(x[0]) == _coloris(nom):
                    x[1].extend(r for r in rushes if r not in x[1])
                    break
            else:
                out.append((nom, rushes))
    if not out:
        raise RuntimeError("--familles : aucune famille ne nomme un rush du dossier")
    return out, avert


def plan_un_modele(dossier, sortie, nom, familles=None, couleurs=0, travail=None):
    """LE PLAN D'UN SEUL MODELE, fichiers entiers (07/10/2026). Chaque rush
    est un segment [0, fin de l'image] ; son « coloris » vient de `familles`
    ([(nom, [rushes])], captures.py ou le client) ; sans familles, de la
    mesure de captures.py sur tout le rush (`couleur_du_rush`, `familles_n`)
    quand le client a dit combien de couleurs (et qu'il y a au moins autant
    de rushes) ; sinon pas de coloris (les pixels, comme un plan sans coloris).
    Un rush que les familles ne nomment pas (captures.py l'a ecarte : un plan
    sans le vetement) n'entre pas. Ecrit <sortie>/_plan-un-modele.json et rend
    (chemin, {"avertissements", "coloris_de"})."""
    noms = sorted(x for x in os.listdir(dossier)
                  if x.lower().endswith((".mp4", ".mov", ".m4v")) and not x.startswith(".")
                  and os.path.isfile(os.path.join(dossier, x)))
    memo, de_fam = {}, {}
    for fam, rushes in familles or []:
        for r in rushes:
            de_fam[_cle_rush(dossier, r, memo)[0]] = fam
    segments, avert, mesures = [], [], []
    for n in noms:
        f = os.path.join(dossier, n)
        d = duree_image(f)
        if d < BLOC_COULEURS + 0.1:
            avert.append("%s ecarte : %s" % (n, "illisible" if d <= 0 else "trop court (%.1f s)" % d))
            continue
        cle = _cle_rush(dossier, n, memo)[0]
        if familles is not None and cle not in de_fam:
            avert.append("%s ecarte : aucune famille ne le nomme (pas de vetement dedans ?)" % n)
            continue
        segments.append({"rush": n, "de": 0.0, "a": round(d, 3),
                         "coloris": de_fam.get(cle, "")})
        mesures.append((n, f, d))
    coloris_de = "familles" if familles is not None else "aucun"
    if familles is None and couleurs and couleurs >= 1 and len(segments) >= couleurs:
        if couleurs == 1:
            for sg in segments:
                sg["coloris"] = "couleur-1"
        else:
            fiches = []
            for (n, f, d), sg in zip(mesures, segments):
                l_, h_ = dimensions(f)
                c = couleur_du_rush(f, bool(l_ and h_ and l_ > h_), d)
                if c:
                    fiches.append({"nom": n, "couleur": c, "seg": sg})
            if len(fiches) == len(segments):
                fams, _j = familles_n(fiches, couleurs)
                for j, g in enumerate(fams, 1):
                    for x in g["rushes"]:
                        x["seg"]["coloris"] = "couleur-%d" % j
        coloris_de = "mesure"
    if not segments:
        raise RuntimeError("aucun rush utilisable dans %s" % dossier)
    plan = {"lot": "un-modele", "rushes": os.path.abspath(dossier),
            "fait_par": "MONTER-10 --rushes : un seul modele, les fichiers entiers",
            "coloris_de": coloris_de,
            "modeles": [{"nom": nom, "couleurs": sorted({s_["coloris"] for s_ in segments
                                                        if s_["coloris"]}),
                         "segments": segments}],
            "exclusions": []}
    os.makedirs(sortie, exist_ok=True)
    chemin = os.path.join(sortie, PLAN_UN_MODELE)
    _ecrire_json(chemin, plan)
    return chemin, {"avertissements": avert, "coloris_de": coloris_de}


def _peu_de_rushes(dossier):
    """Moins de quatre rushes lisibles, ou de LONGUES PRISES (quatre fichiers
    au plus, mediane de deux minutes ou plus) : le mode --rushes n'y tient
    pas le rythme (il lui faut quatre rushes), le plan d'un modele oui."""
    try:
        noms = [x for x in os.listdir(dossier)
                if x.lower().endswith((".mp4", ".mov", ".m4v")) and not x.startswith(".")
                and os.path.isfile(os.path.join(dossier, x))]
    except OSError:
        return False
    durees = sorted(duree_image(os.path.join(dossier, x)) for x in noms)
    lisibles = [d for d in durees if d >= BLOC_COULEURS + 0.1]
    if not lisibles:
        return False
    med = lisibles[len(lisibles) // 2]
    return len(lisibles) < 4 or (len(lisibles) <= 4 and med >= 120.0)


def monter_fichiers_entiers(a, M, accroches, travail):
    """--rushes avec --familles (ou peu de rushes) : le plan d'UN modele aux
    fichiers entiers, monte par `monter_un_modele` (le mode --plan)."""
    familles, avert = None, []
    if a.familles:
        familles, avert = lire_familles(a.familles, a.rushes)
    nom = os.path.basename(os.path.normpath(a.rushes)) or "modele"
    chemin, info = plan_un_modele(a.rushes, a.sortie, nom, familles,
                                  a.couleurs if not familles else 0, travail)
    print("0. un seul modele, les fichiers entiers (%s) : %s"
          % ({"familles": "familles NOMMEES de --familles",
              "mesure": "%d couleur(s), mesurees sur tout le rush comme captures.py" % a.couleurs,
              "aucun": "couleurs aux pixels"}[info["coloris_de"]], chemin))
    if familles:
        for fam, rushes in familles:
            print("   famille %-12s %s" % (fam, ", ".join(rushes)))
    for x in avert + info["avertissements"]:
        print("   [A SAVOIR] %s" % x)
    # la sortie ne garde rien d'un montage d'avant (un autre moteur)
    retires = _nettoyer_sortie(a.sortie)
    if retires:
        print("   %d fichier(s) d'un montage d'avant retires de la sortie" % retires)
    a.plan, a.modele, a.de, a.a = chemin, nom, 1, a.combien
    return monter_un_modele(a, M, accroches, travail)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rushes")
    p.add_argument("--musiques")
    p.add_argument("--sortie")
    p.add_argument("--pov", default="etudiante")
    p.add_argument("--combien", type=int, default=10)
    p.add_argument("--style", choices=["natif", "bande", "plein"],
                   default="natif",
                   help="natif (DEFAUT) = la video garde sa definition, sans "
                        "flou, sans barre, sans recadrage ; "
                        "bande = fond floute et texte au-dessus ; "
                        "plein = l'image remplit l'ecran (barres noires)")
    # ---- mode « un seul modele » (22/09/2026)
    p.add_argument("--plan", help="le PLAN des modeles : quel segment de quel "
                                  "rush appartient a quel modele")
    p.add_argument("--modele", help="le modele a monter, tel qu'il est nomme "
                                    "dans le plan")
    p.add_argument("--de", type=int, default=1, help="premiere variante")
    p.add_argument("--a", type=int, default=10, help="derniere variante")
    p.add_argument("--preparer", action="store_true",
                   help="relit les segments, ecrit _segments-couleur.json "
                        "et s'arrete")
    p.add_argument("--verifier", nargs="?", const="",
                   help="relit un dossier deja monte en RE-APPELANT ffmpeg, et "
                        "rend 1 si une seule video porte plus d'un modele ou "
                        "sort de la regle. Sans dossier : l'auto-test.")
    p.add_argument("--auto-test", action="store_true",
                   help="fabrique des videos, les monte (--rushes et --plan) "
                        "et MESURE le rythme et l'unicite du modele")
    p.add_argument("--couleurs", type=int, default=0,
                   help="nombre de couleurs du modele (4 pour un modele en "
                        "quatre coloris ; 1 = une seule couleur, blocs de 3 s). "
                        "0 = on laisse l'outil deviner, ce qui fait fondre le "
                        "noir dans le marron.")
    p.add_argument("--familles",
                   help="(--rushes) les familles de couleur NOMMEES : le _rapport.json de "
                        "captures.py, ou {\"familles\": [{\"nom\", \"rushes\"}]}. Le "
                        "montage suit alors ces familles (un plan d'un modele, fichiers "
                        "entiers, monte comme --plan)")
    p.add_argument("--plan-seulement", action="store_true",
                   help="lit les rushes, montre les couleurs et quelle "
                        "variante ouvrira sur quoi, puis s'arrete. Aucun rendu.")
    p.add_argument("--outil", default=os.path.join(os.path.dirname(
        os.path.abspath(__file__)), "manita.py"))
    a = p.parse_args()
    global STYLE, NICHE
    STYLE = a.style
    NICHE = a.pov or ""

    if a.auto_test or a.verifier == "":
        return auto_test()
    if a.verifier:
        travail = tempfile.mkdtemp(prefix="monter10_v_")
        try:
            return verifier_dossier(a.verifier, travail)
        finally:
            shutil.rmtree(travail, ignore_errors=True)
    if not a.sortie:
        print("--sortie est obligatoire", file=sys.stderr); return 2
    if a.plan and not a.modele:
        print("--plan demande --modele", file=sys.stderr); return 2
    if not a.plan and not a.rushes:
        print("il faut --plan (un lot a plusieurs modeles) ou --rushes "
              "(un seul modele en plusieurs coloris)", file=sys.stderr); return 2

    if not os.path.isfile(a.outil):
        print("manita.py introuvable a cote : %s" % a.outil, file=sys.stderr); return 2
    import importlib.util
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("manita", a.outil)
    M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
    if a.pov not in M.POV:
        print("sous-niche inconnue : %s (%s)" % (a.pov, ", ".join(M.POV)),
              file=sys.stderr); return 2
    accroches = M.POV[a.pov]

    os.makedirs(a.sortie, exist_ok=True)
    travail = tempfile.mkdtemp(prefix="monter10_")
    try:
        if a.plan:
            # LE MODE QUI REPARE LE 21/09 : un modele, et rien que lui.
            return monter_un_modele(a, M, accroches, travail)
        # UN MODELE AUX FICHIERS ENTIERS (07/10/2026) : avec les familles
        # nommees (--familles), avec moins de quatre rushes, ou de longues
        # prises (quatre fichiers au plus, mediane de deux minutes ou plus),
        # le montage passe par le mode --plan sur un plan d'un seul modele
        if not a.plan_seulement and (a.familles or _peu_de_rushes(a.rushes)):
            return monter_fichiers_entiers(a, M, accroches, travail)
        print("1. je regarde chaque rush ...")
        fiches = lire_rushes(a.rushes, travail)
        if len(fiches) < 4:
            print("pas assez de rushes lisibles : %d (il en faut 4 de %.1f s au moins)"
                  % (len(fiches), BLOC_COULEURS + 0.1), file=sys.stderr); return 1
        couches = [f["nom"] for f in fiches if f["couche"]]
        print("   %d rush(es) filmes couches, je les redresse : %s"
              % (len(couches), ", ".join(couches[:6]) or "aucun"))

        print("")
        print("2. je regroupe par couleur ...")
        if a.couleurs and a.couleurs > 1:
            fams, jetes = familles_n(fiches, a.couleurs)
        else:
            fams, jetes = familles(fiches)
        if a.couleurs == 1 and fams:
            # UNE SEULE COULEUR, DITE PAR LE CLIENT : deux familles de lumiere
            # restent une couleur (09/10/2026 : un rush seul n'est plus jete, il
            # entre dans cette couleur).
            tous = [f for g in fams for f in g["rushes"]]
            fams = [{"centre": tuple(sum(f["couleur"][c] for f in tous) / float(len(tous))
                                     for c in range(3)), "rushes": tous}]
        for i, g in enumerate(fams, 1):
            print("   couleur %d : %d rush(es)  centre %s%s"
                  % (i, len(g["rushes"]), tuple(int(x) for x in g["centre"]),
                     "  [SEUL, GARDE] une couleur filmee une seule fois (%s)" % g["rushes"][0]["nom"]
                     if len(g["rushes"]) == 1 else ""))
        for f in jetes:
            print("   [JETE] %s : ne ressemble a aucune couleur du modele "
                  "(pas de vetement dedans ?)" % f["nom"])
        if not fams:
            print("aucun rush ne ressemble a un autre : pas de couleur commune",
                  file=sys.stderr); return 1
        if len(fams) < 2 and a.couleurs != 1:
            print("une seule couleur trouvee : l'alternance n'a pas de sens",
                  file=sys.stderr); return 1
        nb_couleurs = len(fams)
        n_ouv = nb_couleurs if nb_couleurs >= 2 else 0
        fam_de = {f["nom"]: j for j, g in enumerate(fams) for f in g["rushes"]}
        # LA SUITE A 3 s DEMANDE DES RUSHES QUI LES PORTENT, dans DEUX couleurs
        # au moins (une seule couleur : deux rushes). Une seule couleur aux
        # rushes longs mettait deux blocs de 3 s de la meme couleur a la suite.
        # Sinon la suite reste a 1,6 s, et on le DIT.
        # 07/10/2026 : ce qu'un rush PORTE, c'est sa plus longue prise SANS
        # COUPE (un rush deja monte de 10 s coupe toutes les 2,5 s ne porte
        # pas un bloc de 3 s)
        if nb_couleurs >= 2:
            maxis = sorted((max(f.get("propre_max", f["duree"]) for f in g["rushes"])
                            for g in fams), reverse=True)
        else:
            maxis = sorted((f.get("propre_max", f["duree"]) for g in fams for f in g["rushes"]),
                           reverse=True)
        # (propre_max s'arrete deja 0,05 s avant la fin : le meme seuil qu'avant,
        # une prise de 3,1 s au moins)
        suite_bloc = BLOC_1COULEUR if sum(1 for x in maxis if x >= BLOC_1COULEUR + 0.05) >= 2 \
            else BLOC_COULEURS
        regle = regle_texte(nb_couleurs, suite_bloc)
        # le plus long bloc que DEUX couleurs (une couleur : deux rushes)
        # portent : le dernier bloc allonge peut ainsi changer de couleur
        plus_long = maxis[min(1, len(maxis) - 1)] - 0.05
        print("   rythme : %s" % regle)
        if suite_bloc != BLOC_1COULEUR:
            print("   [A SAVOIR] moins de deux %s portent un bloc de %.1f s : "
                  "la suite reste a %.1f s" % ("couleurs" if nb_couleurs >= 2 else "rushes",
                                               BLOC_1COULEUR, suite_bloc))

        if a.plan_seulement:
            print("")
            print("PLAN (aucun rendu) — quelle variante ouvre sur quelle couleur")
            for i in range(a.combien):
                g = fams[i % len(fams)]
                print("   variante_%02d  ->  couleur %d  %s  (%d rush(es))"
                      % (i + 1, (i % len(fams)) + 1,
                         tuple(int(x) for x in g["centre"]), len(g["rushes"])))
            print("")
            print("   couleurs distinctes en ouverture : %d"
                  % len(set(i % len(fams) for i in range(a.combien))))
            return 0

        # 21/09/2026. LA LIMITE DE L'INSTRUMENT, MESUREE, PAS SUPPOSEE.
        # La relecture refuse deux blocs a moins de SEUIL_RELU l'un de
        # l'autre. Si DEUX FAMILLES sont, elles aussi, plus proches que ca,
        # la machine ne sait pas les distinguer sur une seule image : elle ne
        # peut NI prouver NI infirmer la variete des couleurs. On le dit en
        # clair et on ne condamne pas dix videos sur une mesure aveugle.
        # Tout ce qui prouve que la VIDEO est saine continue de bloquer.
        proches = []
        for x in range(len(fams)):
            for y in range(x + 1, len(fams)):
                ec = math.dist(fams[x]["centre"], fams[y]["centre"])
                if ec < SEUIL_RELU:
                    proches.append("%d et %d (ecart %.1f)" % (x + 1, y + 1, ec))

        # LE NATIF QUAND LES TAILLES DIFFERENT : la taille majoritaire des
        # rushes gardes (un rush = une voix) ; les autres blocs y sont REMPLIS
        # (mise a l'echelle + recadrage centre), jamais floutes ni barres.
        cible = None
        if STYLE == "natif":
            tailles = {f["nom"]: taille_redressee(f["fichier"], f["couche"])
                       for g in fams for f in g["rushes"]}
            cible = taille_majoritaire(tailles.values())
            autres = sorted(n for n, t in tailles.items() if t != cible)
            if cible and autres:
                print("   tailles differentes : %d rush(es) hors de %s, REMPLIS (ni "
                      "flou ni barres) : %s" % (len(autres), _taille_txt(cible),
                                                 ", ".join("%s %s" % (n, _taille_txt(tailles[n]))
                                                           for n in autres[:6])))

        mus = musiques(a.musiques)
        # LA SORTIE NE GARDE RIEN D'UN MONTAGE D'AVANT : une variante qui
        # tombe cette fois laissait l'ancienne video (un autre lot, ou une
        # video coupee par une panne), et le bureau l'aurait livree.
        retires = _nettoyer_sortie(a.sortie)
        if retires:
            print("   %d fichier(s) d'un montage d'avant retires de la sortie" % retires)
        if a.musiques and not mus:
            print("   [A SAVOIR] aucune musique lisible dans %s : videos SANS son" % a.musiques)
        print("")
        print("3. je monte %d variante(s), style %s, rythme %s — la MUSIQUE "
              "fixe la duree, jamais de boucle ..."
              % (a.combien, STYLE, regle))
        faits = []
        # LOI DES DIX SECONDES (08/10/2026) : une musique qui ne permet pas une
        # video de plus de 10 s cede a la suivante (celles qui n'ont pas encore
        # servi d'abord) ; sans aucune musique assez longue, la variante garde
        # la sienne et sort « trop_courte » (A REVOIR)
        durees_r = {m: duree(m) for m in mus} if mus else {}
        longues_r = [m for m in mus if durees_r.get(m, 0.0) >= DUREE_LIVREE_VISEE - 1e-6] if mus else []
        for m in (mus or []):
            if m not in longues_r:
                print("   [A SAVOIR] musique %s (%.1f s) : pas assez pour une video de plus de %.0f s, "
                      "elle cede a une autre" % (os.path.basename(m), durees_r.get(m, 0.0), DUREE_MINI_LIVREE))
        servies_r = set()
        for i in range(a.combien):
            dest = os.path.join(a.sortie, "variante_%02d.mp4" % (i + 1))
            mus_i = mus[i % len(mus)] if mus else None
            if mus_i and mus_i not in longues_r and longues_r:
                ordre_r = [mus[(i + k) % len(mus)] for k in range(len(mus))]
                bonnes_r = [m for m in ordre_r if m in longues_r]
                mus_i = next((m for m in bonnes_r if m not in servies_r), bonnes_r[0])
            if mus_i:
                servies_r.add(mus_i)
            d_mus = durees_r.get(mus_i, 0.0) if mus_i else DUREE_SANS_MUSIQUE
            # LA REGLE DU VENDEUR : un bloc de 1,6 s par couleur, puis 3 s ;
            # il faut COUVRIR la musique, et le dernier bloc n'est jamais un
            # flash (le reste de moins d'une seconde passe au bloc d'avant).
            longs = longueurs_blocs(d_mus, nb_couleurs, suite=suite_bloc,
                                    plus_long=plus_long)
            morceaux, pris, suite, coul, blocs = [], set(), [], [], []
            montrees = set()      # les couleurs deja ouvertes dans la variante
            premier = None        # le rush et l'instant qui font la vignette
            angle, texte = accroches[i % len(accroches)]
            # LA PLAQUE RESTE EN HAUT (decision du vendeur) : on prefere les
            # departs ou le visage est dessous (07/10/2026)
            juge = None
            jp = juge_plaque(M, texte, cible, [f for g in fams for f in g["rushes"]], travail)
            long_courant = [BLOC_1COULEUR]     # la longueur du bloc qu'on choisit
            if jp is not None:
                def juge(c, deb):
                    return jp({"fichier": c["fichier"], "couche": c["couche"],
                               "debut": deb, "longueur": long_courant[0]})
            try:
                if not longs:
                    raise RuntimeError("musique trop courte (%.2f s)" % d_mus)
                for k, long_bloc in enumerate(longs):
                    # LE PREMIER BLOC EST FORCE : la variante i ouvre sur la
                    # famille i. Sur quatre couleurs, quatre variantes de
                    # suite ouvrent chacune sur une couleur differente.
                    forcer = (i % len(fams)) if k == 0 else None
                    # L'OUVERTURE MONTRE CHAQUE COULEUR UNE FOIS (1,6 s).
                    permises = [j for j in range(len(fams)) if j not in montrees] \
                        if 0 < k < n_ouv else None
                    # L'ORDRE DE L'OUVERTURE EST PLANIFIE (07/10/2026, casse),
                    # comme en --plan (`ordre_ouverture`) : avec les vraies
                    # familles, le noir et le marron (12 d'ecart, la relecture
                    # ne les separe pas) sont deux couleurs ; choisies une a une,
                    # la derniere restante tombait juste apres sa jumelle (une
                    # variante sur dix, « blocs 4 de la meme couleur »). La
                    # couleur suivante est celle de l'ordre qui ecarte le plus
                    # deux couleurs voisines, parmi celles pas encore montrees.
                    der_f = fam_de.get(suite[-1], -1) if suite else -1
                    if permises and len(permises) >= 2 and der_f >= 0:
                        o_ = ordre_ouverture([{"famille": x, "couleur": fams[x]["centre"]}
                                              for x in permises + [der_f]], len(fams), der_f)
                        if len(o_) > 1 and any(c["duree"] >= long_bloc + 0.1
                                               for c in fams[o_[1]]["rushes"]):
                            permises = [o_[1]]
                    long_courant[0] = long_bloc
                    deja = {}
                    for b_ in blocs:
                        deja.setdefault(b_["rush"], []).append((b_["debut"], b_["fin"]))
                    choix, debut, vraie = choisir_plan(
                        fams, i, k, pris,
                        suite[-1] if suite else None,
                        coul[-1] if coul else None,
                        long_bloc, travail, forcer, permises, juge, deja)
                    debut = round(debut, 2)
                    pouls("      ... bloc %d / %d choisi (variante %d)" % (k + 1, len(longs), i + 1))
                    if k == 0:
                        premier = (choix["fichier"], choix["couche"], debut)
                    j = fam_de.get(choix["nom"], -1)
                    montrees.add(j)
                    pris.add(choix["nom"])
                    coul.append(vraie)
                    b = os.path.join(travail, "v%02d_b%d.mp4" % (i + 1, k))
                    bloc(choix["fichier"], choix["couche"], debut, b, long_bloc, cible)
                    morceaux.append(b)
                    suite.append(choix["nom"])
                    blocs.append({"rush": choix["nom"], "debut": debut,
                                  "fin": round(debut + long_bloc, 2),
                                  "longueur": long_bloc, "couche": choix["couche"],
                                  "couleur": j + 1})
                    if traverse_une_coupe(choix, debut, long_bloc):
                        # aucun rush du dossier n'avait de place propre : on
                        # le DIT (la relecture du rythme le verra aussi)
                        blocs[-1]["traverse_une_coupe"] = True
                    t_rush = taille_redressee(choix["fichier"], choix["couche"])
                    if cible and t_rush != cible:
                        blocs[-1]["rempli"] = _taille_txt(cible)
                        blocs[-1]["taille_du_rush"] = _taille_txt(t_rush)
                liste = os.path.join(travail, "l%02d.txt" % (i + 1))
                with open(liste, "w", encoding="utf-8") as fh:
                    for m in morceaux:
                        fh.write("file '%s'\n" % os.path.abspath(m).replace("'", "'\\''"))
                muet = os.path.join(travail, "m%02d.mp4" % (i + 1))
                r = lancer(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
                            "-i", liste, "-c", "copy", muet, "-y"], 300)
                if r.returncode != 0:
                    raise RuntimeError(r.stderr.strip()[:200])
                avec = os.path.join(travail, "a%02d.mp4" % (i + 1))
                nom_mus = "son d'origine"
                # LA DUREE REELLE de la video muette (les blocs a l'image pres
                # ne tombent jamais pile sur la musique : 57,50 s de video pour
                # 57,94 s de musique, vu le 07/10/2026)
                d_muet = duree(muet)
                if mus_i:
                    nom_mus = "%s (%.1f s)" % (os.path.basename(mus_i), d_mus)
                    # PAS DE BOUCLE, PAS DE -shortest : la musique est posee
                    # sur la duree reelle de la video et finit avec elle, avec
                    # son fondu (corrige le 07-08/10/2026)
                    if not poser_musique(muet, mus_i, 0.0, d_muet, avec):
                        shutil.copy(muet, avec); nom_mus = "AUCUNE (musique refusee)"
                else:
                    shutil.copy(muet, avec)
                info = M.bruler_pov(avec, texte, dest)
                pov_ok = pov_conforme(info, bool(mus_i))
                pc = planche(dest, os.path.join(a.sortie,
                             "_planche_variante_%02d.png" % (i + 1)),
                             "variante %02d  %s  %s" % (i + 1, angle, nom_mus))
                # FAUTE DU 21/09/2026, VUE A L'OEIL SUR LES IMAGES.
                # « sujet_en_haut » compare le haut de l'image aux quatre
                # coins. Sur un rush ca dit « gros plan ou modele entier ».
                # Sur la video FINIE en style bande, le haut est le PAVE DE
                # TEXTE et le bas est la photo : la mesure ne parlait plus du
                # cadrage mais de la clarte du sol. Une vignette parfaitement
                # cadree etait refusee a cause d'un trottoir blanc.
                # On mesure donc LE RUSH, a l'instant exact qui devient la
                # vignette. La couleur d'ouverture, elle, reste relue sur la
                # video ecrite : elle, elle survit au recadrage.
                cadrage = (sujet_en_haut(premier[0], premier[2] + 0.15,
                                         premier[1], travail)
                           if premier else sujet_en_haut(dest, 0.15, False, travail))
                if cadrage > SEUIL_CADRAGE:
                    print("   [A SAVOIR] variante_%02d : la vignette ne montre "
                          "pas le modele en entier" % (i + 1))
                ouvre = couleur_a(dest, 0.15, False, travail)
                ouvre_sur = None
                if ouvre is not None:
                    ouvre_sur = min(range(len(fams)),
                                    key=lambda j: math.dist(ouvre, fams[j]["centre"]))
                attendu = i % len(fams)
                if ouvre_sur is not None and ouvre_sur != attendu:
                    print("   [A SAVOIR] variante_%02d ouvre sur la couleur %d "
                          "et non %d" % (i + 1, ouvre_sur + 1, attendu + 1))
                # une seule couleur : deux blocs voisins ont la meme couleur
                # par definition, la loi est sans objet
                colles = controler_couleurs(dest, longs) if nb_couleurs >= 2 else []
                if colles:
                    print("   [ECHEC] variante_%02d : blocs %s de la meme "
                          "couleur que le precedent"
                          % (i + 1, ", ".join(str(x) for x in colles)))
                rythme = mesurer_rythme(dest, longs)
                if not rythme["ok"]:
                    print("   [A REGARDER] variante_%02d : rythme %s non relu tel "
                          "quel dans la video (%s)"
                          % (i + 1, regle, _rythme_court(rythme)))
                d_fin = duree(dest)
                # la video doit finir avec SA musique, posee sur sa duree
                # reelle (d_muet) : on compare a la video muette, plus au
                # fichier de musique (un ecart de 0,44 s tombait en ECHEC)
                colle = (not mus_i) or abs(d_fin - d_muet) <= 0.35
                if not colle:
                    print("   [ECHEC] variante_%02d : video %.2f s pour %.2f s "
                          "de blocs (la musique n'a pas ete posee sur toute "
                          "la video)" % (i + 1, d_fin, d_muet))
                elif mus_i and abs(d_muet - d_mus) > 0.5:
                    print("   [A SAVOIR] variante_%02d : video %.2f s, musique "
                          "de %.2f s : musique coupee a la fin de la video, "
                          "avec un fondu" % (i + 1, d_muet, d_mus))
                # LOI DES DIX SECONDES (08/10/2026)
                trop_courte = d_fin <= DUREE_MINI_LIVREE + 1e-6
                if trop_courte:
                    print("   [ECHEC] variante_%02d : trop_courte (%.2f s) — une video "
                          "livree depasse %.0f s" % (i + 1, d_fin, DUREE_MINI_LIVREE))
                l, h = dimensions(dest)
                dans_cible = (not cible) or (l, h) == tuple(cible)
                if not dans_cible:
                    print("   [ECHEC] variante_%02d : %dx%d au lieu de %s (la taille "
                          "majoritaire du modele)" % (i + 1, l, h, _taille_txt(cible)))
                # LA PLAQUE SUR LE VISAGE, avec la vraie boite brulee (07/10/2026)
                plaque = juger_plaque(blocs, a.rushes, info, (l, h), cible)
                regarder = a_regarder(plaque, rythme, regle)
                a_cheval = [n_ + 1 for n_, b in enumerate(blocs) if b.get("traverse_une_coupe")]
                if a_cheval:
                    regarder.append("bloc(s) %s a cheval sur une coupe deja dans le rush "
                                    "(aucune place propre)" % ", ".join(str(x) for x in a_cheval))
                # le film revu (07/10/2026) : un bloc qui remontre plus de
                # REVU_MAXI d'un bloc precedent n'est jamais « conforme »
                revus = films_revus(blocs)
                if revus:
                    regarder.append("film revu : bloc(s) %s remontrent plus de %.1f s d'un "
                                    "bloc precedent (regarde la planche)"
                                    % (", ".join(str(x) for x in revus), REVU_MAXI))
                for x in regarder:
                    if not x.startswith("rythme"):      # le rythme est deja dit plus haut
                        print("   [A REGARDER] variante_%02d : %s" % (i + 1, x))
                faits.append({"variante": i + 1, "fichier": dest, "mode": "rushes",
                              "rushes": os.path.abspath(a.rushes), "style": STYLE,
                              "angle": angle, "musique": nom_mus,
                              "duree": round(d_fin, 2),
                              "trop_courte": bool(trop_courte),
                              # --verifier compare la video a duree_musique :
                              # c'est la duree sur laquelle la musique a ete
                              # POSEE (la video muette), le fichier est a cote
                              "duree_musique": round(d_muet, 2),
                              "duree_musique_fichier": round(d_mus, 2) if mus_i else None,
                              "definition": "%dx%d" % (l, h),
                              "definition_cible": _taille_txt(cible) if cible else None,
                              "blocs_remplis": sum(1 for b in blocs if b.get("rempli")),
                              "reste_dans_sa_definition": bool(dans_cible),
                              "nb_couleurs": nb_couleurs, "regle": regle,
                              "bloc_suite": suite_bloc,
                              "longueurs": longs, "blocs": blocs,
                              "rythme_relu": rythme,
                              "blocs_colles": colles,
                              "couleurs_aveugles": bool(proches),
                              "vignette_modele_entier": bool(cadrage <= SEUIL_CADRAGE),
                              "vignette_mesure": round(cadrage, 1),
                              "ouvre_sur_couleur": (ouvre_sur + 1) if ouvre_sur is not None else None,
                              "couleur_attendue": attendu + 1,
                              "finit_avec_la_musique": colle,
                              "suite": suite,
                              "blocs_a_cheval": len(a_cheval),
                              "pov": NICHE,
                              "plaque": plaque["plaque"],
                              "plaque_sur_le_visage": plaque["sur_le_visage"],
                              "tete_non_vue": plaque["tete_non_vue"],
                              "film_revu": revus,
                              "a_regarder": regarder,
                              "conforme": bool(pov_ok and dans_cible and not trop_courte and verdict(
                                  bool(pov_ok and dans_cible and not trop_courte), plaque, regarder) == "conforme"),
                              "verdict": verdict(bool(pov_ok and dans_cible and not trop_courte), plaque, regarder),
                              "pov_conforme": bool(pov_ok),
                              "planche": pc})
                print("   [%s] variante_%02d  %-9s  %-28s  %s"
                      % ({"conforme": "OK"}.get(faits[-1]["verdict"], faits[-1]["verdict"]),
                         i + 1, angle,
                         nom_mus[:28], " ".join("%s:%.1f" % (s.split("_")[-1][:5], L)
                                                for s, L in zip(suite, longs))))
            except Exception as e:
                print("   [ECHEC] variante_%02d : %s" % (i + 1, str(e)[:160]))
                _retirer(dest)
                _retirer(os.path.join(a.sortie, "_planche_variante_%02d.png" % (i + 1)))
            # le rapport a jour apres CHAQUE variante (une coupure garde ce
            # qui est fait), et les blocs de travail effaces (place disque)
            _rapport_ecrire(a.sortie, faits)
            _vider(travail)

        print("")
        print("4. les trois lois du lot")
        ok = True
        n = len(faits)
        suites = [tuple(f["suite"]) for f in faits]
        c1 = len(set(suites)) == n
        mm = [f["musique"] for f in faits]
        c2 = len(set(mm)) == n
        aa = [f["angle"] for f in faits]
        c3 = len(set(aa)) == min(n, len(set(x[0] for x in accroches)))
        if proches:
            print("   couleurs que la machine ne sait pas distinguer : %s"
                  % "; ".join(proches))
            print("   il faut au moins %d d'ecart pour les relire une par une"
                  % SEUIL_RELU)
        loi_rythme = "le rythme %s, relu" % regle
        for nom, v, det in (("enchainements differents", c1, "%d / %d" % (len(set(suites)), n)),
                            ("musiques differentes", c2, "%d / %d" % (len(set(mm)), n)),
                            ("angles couverts", c3, "%d" % len(set(aa))),
                            ("aucune couleur repetee a la suite",
                             all(not f.get("blocs_colles") for f in faits),
                             ("sans objet : une seule couleur" if nb_couleurs < 2 else
                              "%d paire(s) collee(s), RELUES dans les videos"
                              % sum(len(f.get("blocs_colles") or []) for f in faits))),
                            ("la vignette montre le modele en entier",
                             all(f.get("vignette_modele_entier") for f in faits),
                             "%d / %d, RELUES sur la premiere image"
                             % (sum(1 for f in faits if f.get("vignette_modele_entier")), n)),
                            ("chaque couleur ouvre au moins une video",
                             len(set(f.get("ouvre_sur_couleur") for f in faits
                                     if f.get("ouvre_sur_couleur"))) >= min(n, len(fams)),
                             "%d couleur(s) d'ouverture sur %d"
                             % (len(set(f.get("ouvre_sur_couleur") for f in faits
                                        if f.get("ouvre_sur_couleur"))), len(fams))),
                            ("chaque video depasse %.0f s" % DUREE_MINI_LIVREE,
                             all(not f.get("trop_courte") for f in faits),
                             "%d / %d" % (sum(1 for f in faits if not f.get("trop_courte")), n)),
                            ("chaque video finit avec sa musique",
                             all(f.get("finit_avec_la_musique") for f in faits),
                             "%d / %d" % (sum(1 for f in faits if f.get("finit_avec_la_musique")), n)),
                            (loi_rythme,
                             all(f["rythme_relu"]["ok"] for f in faits),
                             "%d / %d, frontieres RELUES dans les videos"
                             % (sum(1 for f in faits if f["rythme_relu"]["ok"]), n)),
                            (LOI_COUPES,
                             all(not f.get("blocs_a_cheval") for f in faits),
                             "%d bloc(s) a cheval sur une coupe deja dans un rush"
                             % sum(f.get("blocs_a_cheval") or 0 for f in faits)),
                            (LOI_PLAQUE,
                             all(not f.get("plaque_sur_le_visage") and not f.get("tete_non_vue")
                                 for f in faits),
                             ("%d / %d videos sans visage sous la plaque ni tete non vue, MESURE "
                              "sur les rushes"
                              % (sum(1 for f in faits if not f.get("plaque_sur_le_visage")
                                     and not f.get("tete_non_vue")), n))
                             if any((f.get("plaque") or {}).get("mesuree") for f in faits)
                             else "non mesure (style %s)" % STYLE)):
            aveugle = bool(proches) and nom in COULEUR_DEPEND
            # le rythme relu peut etre aveugle sur de vrais rushes (deux plans
            # voisins presque identiques) : on le MONTRE, la planche tranche.
            # La plaque sur un visage et un bloc a cheval aussi : A REGARDER.
            regarder = aveugle or nom in (loi_rythme, LOI_COUPES, LOI_PLAQUE)
            print("   [%s] %-34s %s%s"
                  % ("OK" if v else ("A REGARDER" if regarder else "ECHEC"),
                     nom, det,
                     " — mesure aveugle, voir plus haut" if aveugle and not v else ""))
            if not regarder:
                ok = ok and v
        _rapport_ecrire(a.sortie, faits)
        print("")
        print("%d variante(s) dans %s" % (n, a.sortie))
        print("REGARDE LES PLANCHES _planche_variante_XX.png avant de publier.")
        return 0 if (ok and n == a.combien) else 1
    finally:
        shutil.rmtree(travail, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
