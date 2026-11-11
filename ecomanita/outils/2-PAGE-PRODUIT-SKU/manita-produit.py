#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
manita-produit.py — l'outil PAGE PRODUIT + SKU de « ecom manita ».

UN SEUL FICHIER. AUCUNE BIBLIOTHEQUE A INSTALLER : tout est dans Python.

Ce que cet outil FAIT :
  - il range les tailles (12 configurations)
  - il fabrique les SKU (4 modes) et refuse un SKU qui ne tient pas debout
  - il classe les photos pour que DEUX PHOTOS DE LA MEME COULEUR
    NE SE SUIVENT JAMAIS
  - il ecrit la description en alternance photo / texte
  - il tient le stock REEL taille par taille dans un fichier
  - il prepare le paquet exact a donner a Tassyir (create_product)

Ce que cet outil NE FAIT PAS, et ne fera jamais :
  - il ne se connecte a RIEN. Aucun compte, aucune cle, aucun mot de passe.
    C'est Claude, avec TA propre connexion Tassyir, qui envoie le paquet.
  - il n'invente aucun texte de vente. Les textes viennent de TES angles.
  - il ne publie rien tout seul.
"""

import argparse
import json
import os
import re
import sys
import unicodedata

VERSION = "1.0"

# ----------------------------------------------------------------------------
# PARTIE 1 — LES BORNES, TOUTES AU MEME ENDROIT
# ----------------------------------------------------------------------------

PRIX_MINI = 1500
PRIX_MAXI = 59000

PRIX_LISTE = [2900, 3500, 3900, 4500, 4900, 5500, 5900, 6500, 6900,
              7500, 7900, 8500, 8900, 9500, 9900, 10500, 10900,
              11500, 11900, 12500, 12900]

PHOTOS_MINI = 6
PHOTOS_MAXI = 15
PHOTOS_DESCRIPTION = 5       # minimum de photos DANS la description (le chiffre du vendeur, 09/10/2026 : cinq couples photo/texte)
BLOCS_MINI_DESCRIPTION = 3   # en dessous, refus (l'ancien minimum, garde) ; entre 3 et 5 blocs : moins de cinq couples, et on le DIT
GALERIE_MAXI_TASSYIR = 20    # limite de la plateforme, lue dans sa fiche

# Le seuil a partir duquel un prix arabe recoit sa lecture parlee.
SEUIL_LECTURE_PARLEE = 10000

PLACE_BOUTIQUE = "A_REMPLIR_PAR_CLAUDE_AVEC_list_stores"

# ----------------------------------------------------------------------------
# LA QUESTION OBLIGATOIRE
# ----------------------------------------------------------------------------
# Elle se pose AVANT chaque fabrication de SKU, a CHAQUE produit, sans
# exception. Ce n'est pas une politesse : deux clients ne rangent pas leurs
# tailles pareil, et l'agent n'a AUCUN moyen de deviner lequel il a en face.
# C'est pour ca qu'il n'y a plus de valeur par defaut : sans reponse,
# l'outil REFUSE. Un defaut, c'est l'agent qui choisit a la place du client.

QUESTION = """
================================================================
  A LIRE AU CLIENT, MOT POUR MOT, AVANT CHAQUE PRODUIT
================================================================

  IL EST PEUT-ETRE DEBUTANT. Tu EXPLIQUES, tu ne te contentes pas
  de poser la question. Tu lui montres les exemples tels quels.

  ----------------------------------------------------------------

  قبل ما نصنعو الأكواد تاع السلعة، لازم تجاوبني على زوج حوايج.
  ما نقدرش نختار بلاصتك — كل تاجر عندو طريقتو، وأنا ما نعرفش
  كيفاش راك تخدم انت.

  ================================================================
  QUESTION 1 — tes tailles, elles ont quelle FORME ?
  ================================================================

  التايات تاعك، كيفاش تكتبهم ؟ كاين ثلاثة طرقان.

       بالحروف
           S   M   L   XL   2XL   3XL

       بالأرقام
           36  38  40  42  44  46  48  50  52  54  56  58

       بالبلوكات — تاية وحدة تغطي زوج ولا ثلاثة قياسات
           Taille 1 (S-M)     Taille 2 (L-XL)     Taille 3 (2XL-3XL)

  البلوكات كثير ياخدوها لي يخدمو مع الأتولييه : بدل اثناش تاية،
  تلاتة برك. أقل سطوك، وأقل غلط في القياس.

  ما تخلطش بيناتهم في نفس الصفحة : الزبونة ما تعرفش واش تختار،
  تكتبلك تسقسي، والكوموند يطيح.

  ET FAIS ATTENTION A UNE CHOSE : « par les chiffres » ne veut PAS
  dire trente-six a cinquante-huit automatiquement. Beaucoup de
  vendeurs numerotent des BLOCS : un, deux, trois. Redemande-lui
  toujours COMBIEN il en a et LESQUELS, et ne remplis jamais douze
  tailles parce qu'il a dit « chiffres ».

  ================================================================
  QUESTION 2 — un CODE par taille, ou un CODE pour deux tailles ?
  ================================================================

  الكود — نسمّيوه SKU — هو اسم داخلي تعرف بيه كل قطعة في المخزن
  وعلى البون تاع التوصيل. الزبونة عمرها ما تشوفو.

  تحبو كود لكل تاي، ولا كود يخدم على زوج تايات ؟

       كود لكل تاي — كل وحدة وحدها
           SHOP-M05-NOI-S       (le S noir)
           SHOP-M05-NOI-M       (le M noir)

       كود على زوج تايات — الزوج يشاركو نفس الكود
           SHOP-M05-NOI-SM      (le S ET le M noirs)

  واش يبدّل عندك ؟

       كود لكل تاي    ->  أكواد أكثر، بصح قراءة أدق
       كود على زوج    ->  أكواد أقل، أسهل مع الخياط

  وفي الزوج حالات، الستوك يبقى محسوب تاي بتاي. الزبونة تختار التاي
  لي تحب، وكي تشري وحدة ما ينقصش من الأخرى.

================================================================
  CE QUE TU FAIS DE SA REPONSE
================================================================

  bel horouf   (lettres)  ->  --tailles lettres-complete
  bel arqam    (chiffres)  ->  --tailles chiffres-complete
  bel bloukate (blocs)     ->  --tailles bandes-2  ou bandes-3  ou bandes-4
                               SELON LE NOMBRE DE BLOCS QU'IL T'A DIT.
                               Deux blocs -> bandes-2. Trois -> bandes-3.
                               Quatre -> bandes-4. Tu ne choisis pas a sa
                               place, tu comptes ce qu'il a dit.

  puis, sur la deuxieme question :
  mefrouqin  (un code par taille)  ->  --mode par-taille
  mejmou3in  (un code pour deux)   ->  --mode groupe2

  ATTENTION : avec les BLOCS, un bloc EST deja une taille. On ne le
  regroupe pas une deuxieme fois : bandes-2/3/4 vont avec --mode
  par-taille. Si tu mets groupe2 par-dessus, tu regroupes des groupes.

  S'il veut une bande de tailles plus courte, --tailles-liste montre
  toutes les configurations. S'il veut composer ses groupes lui-meme :
  --mode perso --groupes "S+M, L+XL, 2XL+3XL"

  S'IL NE COMPREND PAS, tu reexpliques avec SES mots a lui : son
  modele, sa couleur, ses tailles. Tu ne passes pas a la suite tant
  qu'il n'a pas repondu, et tu ne repond JAMAIS A SA PLACE. Meme s'il
  a repondu la semaine derniere, meme si c'est son dixieme produit :
  tu redemandes.
"""


# ----------------------------------------------------------------------------
# LE REGLAGE DU CLIENT
# ----------------------------------------------------------------------------
# Un client qui range TOUJOURS ses tailles de la meme facon n'a pas a repondre
# a la meme question dix fois. Il l'ecrit UNE fois dans reglage.txt, et
# l'outil s'en sert.
#
# CE QUI NE CHANGE PAS : le choix reste le SIEN. Le reglage n'est pas un
# defaut que l'outil aurait invente — c'est sa decision, ecrite de sa main.
# Et l'outil ANNONCE a chaque fois quel reglage il applique, avec la ligne
# pour le changer. Un reglage silencieux redeviendrait un defaut.

FICHIER_REGLAGE = "reglage.txt"

MODELE_REGLAGE = """# REGLAGE DE L'AGENT — ta facon de ranger les tailles.
# Tu l'ecris UNE fois. L'agent l'applique et te le rappelle a chaque produit.
# Efface une ligne pour que l'agent te repose la question.

# tailles : lettres-complete, lettres-courte, chiffres-complete,
#           chiffres-44, chiffres-46, chiffres-48, chiffres-52,
#           chiffres-56, chiffres-58, chiffres-46-58,
#           bandes-2, bandes-3, bandes-4, perso, sans
#           (la liste complete : python3 manita-produit.py --tailles-liste)
tailles = %s

# mode : par-taille, groupe2, groupe2-affiche, perso, unique
mode = %s

# orphelin : ce qu'on fait d'une taille restee seule.
#   seul     -> elle recoit son propre SKU, sans redemander
#   demande  -> l'agent s'arrete et te pose la question (par defaut)
orphelin = %s
"""


def lis_reglage(dossier=None):
    """Lit reglage.txt s'il existe. Rend un dictionnaire, vide sinon.

    On ne cherche qu'a DEUX endroits, et on le dit : le dossier courant,
    puis le dossier de l'outil. Pas de recherche magique dans tout le disque.
    """
    for base in [dossier or os.getcwd(),
                 os.path.dirname(os.path.abspath(__file__))]:
        chemin = os.path.join(base, FICHIER_REGLAGE)
        if not os.path.exists(chemin):
            continue
        reglage = {"_fichier": chemin}
        with open(chemin, "r", encoding="utf-8") as f:
            for ligne in f:
                ligne = ligne.split("#", 1)[0].strip()
                if "=" not in ligne:
                    continue
                cle, val = ligne.split("=", 1)
                cle, val = cle.strip().lower(), val.strip()
                if cle in ("tailles", "mode", "orphelin") and val:
                    reglage[cle] = val
        return reglage
    return {}


def ecris_reglage(dossier, tailles, mode, orphelin):
    chemin = os.path.join(dossier or os.getcwd(), FICHIER_REGLAGE)
    with open(chemin, "w", encoding="utf-8") as f:
        f.write(MODELE_REGLAGE % (tailles, mode, orphelin or "demande"))
    return chemin


# ----------------------------------------------------------------------------
# PARTIE 2 — LES CONFIGURATIONS DE TAILLES
# Le nombre n'est ecrit NULLE PART en toutes lettres : il se compte sur
# ce dictionnaire. Une configuration ajoutee ici s'affiche toute seule.
# ----------------------------------------------------------------------------

LETTRES = ["S", "M", "L", "XL", "2XL", "3XL"]
CHIFFRES = [str(n) for n in range(36, 59, 2)]   # 36 38 ... 58

TAILLES = {
    "lettres-complete":  ("Lettres standard complete", ["S", "M", "L", "XL", "2XL", "3XL"]),
    "lettres-courte":    ("Lettres standard courte",   ["S", "M", "L", "XL"]),
    "chiffres-complete": ("Chiffres standard complete", CHIFFRES[:]),
    "chiffres-44":       ("Chiffres jusqu'a 44", ["36", "38", "40", "42", "44"]),
    "chiffres-46":       ("Chiffres jusqu'a 46", ["36", "38", "40", "42", "44", "46"]),
    "chiffres-48":       ("Chiffres jusqu'a 48", ["36", "38", "40", "42", "44", "46", "48"]),
    "chiffres-52":       ("Chiffres jusqu'a 52", ["36", "38", "40", "42", "44", "46", "48", "50", "52"]),
    "chiffres-56":       ("Chiffres jusqu'a 56", ["36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56"]),
    "chiffres-58":       ("Chiffres jusqu'a 58", CHIFFRES[:]),
    "chiffres-46-58":    ("Chiffres de 46 a 58", ["46", "48", "50", "52", "54", "56", "58"]),
    # LES BANDES : une taille couvre deux ou trois mesures. C'est ce que font
    # les vendeurs qui produisent en atelier, et rien ne les couvrait.
    "bandes-2":          ("Deux bandes", ["1", "2"]),
    "bandes-3":          ("Trois bandes", ["1", "2", "3"]),
    "bandes-4":          ("Quatre bandes", ["1", "2", "3", "4"]),
    "perso":             ("Personnalise (tu donnes tes tailles)", None),
    "sans":              ("Sans tailles", []),
}


def familles_tailles(liste):
    """Dit si une liste de tailles est en LETTRES, en CHIFFRES, ou melangee.

    On ne melange jamais les deux dans une meme page : la cliente ne sait plus
    laquelle choisir, elle ecrit pour demander, et c'est une commande perdue.
    """
    lettre = any(t.upper() in [x.upper() for x in LETTRES] for t in liste)
    chiffre = any(t.isdigit() for t in liste)
    if lettre and chiffre:
        return "melange"
    if chiffre:
        return "chiffres"
    if lettre:
        return "lettres"
    return "autre"


# ----------------------------------------------------------------------------
# PARTIE 3 — LES CODES COULEUR SUR TROIS LETTRES
# ----------------------------------------------------------------------------

# Sa table d'origine, elargie. Le code fait TOUJOURS trois lettres.
CODES_COULEUR = {
    "noir": "NOI", "blanc": "BLA", "beige": "BEI", "rouge": "ROU",
    "chocolat": "CHO", "ecru": "ECR", "gris": "GRI", "vert": "VER",
    "bleu": "BLE", "rose": "ROS", "marron": "MAR", "jaune": "JAU",
    "orange": "ORA", "violet": "VIO", "marine": "MRN", "camel": "CAM",
    "kaki": "KAK", "fuchsia": "FUC", "turquoise": "TUR", "bordeaux": "BOR",
    "dore": "DOR", "argent": "ARG", "creme": "CRM", "moutarde": "MOU",
    "saumon": "SAU", "corail": "COR", "lilas": "LIL", "ciel": "CIE",
    "taupe": "TAU", "mauve": "MAU", "peche": "PEC", "olive": "OLI",
    # les memes en arabe, parce qu'il les ecrit souvent comme ca
    "اسود": "NOI", "أسود": "NOI", "ابيض": "BLA", "أبيض": "BLA",
    "بيج": "BEI", "احمر": "ROU", "أحمر": "ROU", "رمادي": "GRI",
    "اخضر": "VER", "أخضر": "VER", "ازرق": "BLE", "أزرق": "BLE",
    "وردي": "ROS", "بني": "MAR", "اصفر": "JAU", "أصفر": "JAU",
}



# ----------------------------------------------------------------------------
# LA DOC QUI NE PEUT PAS MENTIR
# ----------------------------------------------------------------------------
# LES-SKU.md se presentait comme « genere par l'outil » alors qu'il etait
# ecrit a la main. Il avait derive : sa question n'etait plus celle que
# --question pose, et son tableau de stock donnait neuf valeurs pour un mode
# qui en a douze. Une doc qui se dit generee et qui ne l'est pas est pire
# qu'une doc datee : on la croit.
# Maintenant elle est vraiment ecrite par le code, a partir des memes tables.

def doc_sku():
    L = []
    A = L.append
    A("# LES SKU — comment ils se fabriquent")
    A("")
    A("Fichier ECRIT PAR L'OUTIL : `python3 manita-produit.py --doc-sku`.")
    A("Il sort des memes tables que le code, donc il ne peut pas raconter")
    A("autre chose que ce que l'outil fait vraiment. Ne le modifie pas a la")
    A("main : relance la commande.")
    A("")
    A("## 1. LA FORME")
    A("")
    A("```")
    A("SHOP  -  M05  -  NOI  -  SM")
    A(" |       |      |       |")
    A(" |       |      |       +--  le groupe de tailles")
    A(" |       |      +----------  la couleur, trois lettres")
    A(" |       +-----------------  le modele")
    A(" +-------------------------  la boutique")
    A("```")
    A("")
    A("Jamais d'espace, jamais d'accent, jamais le prix dedans.")
    A("")
    A("## 2. LES CODES COULEUR")
    A("")
    A("Les couleurs connues de l'outil, et leur code :")
    A("")
    vus, lignes = set(), []
    for nom, code in CODES_COULEUR.items():
        if code in vus:
            continue
        vus.add(code)
        lignes.append("%s -> %s" % (nom, code))
    A("```")
    for i in range(0, len(lignes), 4):
        A("  " + "   ".join("%-18s" % x for x in lignes[i:i + 4]).rstrip())
    A("```")
    A("")
    A("Une couleur hors de cette table prend ses trois premieres lettres, et")
    A("l'outil PREVIENT : deux couleurs differentes peuvent tomber sur le")
    A("meme code.")
    A("")
    A("## 3. LES MODES DE SKU")
    A("")
    for cle, txt in MODES_SKU.items():
        A("- `%s` : %s" % (cle, txt))
    A("")
    A("## 4. LES CONFIGURATIONS DE TAILLES")
    A("")
    A("```")
    for cle, (titre, liste) in TAILLES.items():
        if liste is None:
            detail = "tu donnes tes tailles avec --tailles-perso"
        elif not liste:
            detail = "aucune taille"
        else:
            detail = "%d : %s" % (len(liste), "  ".join(liste))
        A("  %-18s %s" % (cle, detail))
        A("  %-18s %s" % ("", titre))
        A("")
    A("```")
    A("")
    A("**Attention.** « Par les chiffres » ne veut PAS dire trente-six a")
    A("cinquante-huit. Beaucoup de vendeurs numerotent des BANDES : un, deux,")
    A("trois. Demande toujours combien il en a et lesquelles.")
    A("")
    A("## 5. LE STOCK, ET LE PIEGE DES COULEURS")
    A("")
    A("Deux ecritures :")
    A("")
    A("```")
    A("  Noir/1:20, Beige/1:20, ...   couleur par couleur. Aucune ambiguite.")
    A("  1:40, 2:50, 3:30             la taille SANS la couleur.")
    A("```")
    A("")
    A("La deuxieme est AMBIGUE des qu'il y a plus d'une couleur : quarante")
    A("pieces en taille un, est-ce quarante en tout, ou quarante par couleur ?")
    A("L'outil REFUSE de choisir et montre les deux totaux. Si c'est bien par")
    A("couleur, tu le dis avec `--stock-par-couleur`. Sinon tu redemandes le")
    A("detail. Ce stock-la descend jusqu'a la porte du scaling : double, il")
    A("ouvre une porte sur un entrepot a moitie vide.")
    A("")
    A("## 6. LA QUESTION OBLIGATOIRE")
    A("")
    A("Elle se lit avec `python3 manita-produit.py --question`, mot pour mot,")
    A("avant CHAQUE produit. La voici telle que l'outil la pose :")
    A("")
    A("```")
    for ligne in QUESTION.rstrip().split("\n"):
        A(ligne)
    A("```")
    return "\n".join(L) + "\n"


def _sans_accent(txt):
    """Enleve les accents. « Écru » et « ecru » doivent donner le meme code."""
    n = unicodedata.normalize("NFD", txt)
    return "".join(c for c in n if unicodedata.category(c) != "Mn")


def code_couleur(nom):
    """Rend le code de trois lettres d'une couleur.

    Si la couleur n'est pas dans la table, on prend ses trois premieres
    lettres — et on PREVIENT, parce que deux couleurs differentes peuvent
    alors tomber sur le meme code.

    CE « ON PREVIENT » A UN ENDROIT PRECIS : avertissements_couleurs() le
    redige, dis_avertissements_couleurs() l'AFFICHE, et --produit l'appelle.
    Avant, le drapeau « inconnue » etait bien rendu, mais aucun appelant ne
    l'affichait : la promesse n'etait tenue nulle part.
    """
    cle = _sans_accent(nom).strip().lower()
    if cle in CODES_COULEUR:
        return CODES_COULEUR[cle], True
    # LE NOMMAGE SANS FUSION (09/10/2026, recette du vendeur) : deux familles qui tombent sur le meme nom de
    # palette deviennent « Noir » et « Noir clair » (ou « Noir fonce »). Sans ceci, « Noir clair » prenait
    # « NOI » comme « Noir » : deux SKU identiques, refuses comme un faux doublon. La teinte claire ou foncee
    # ajoute une lettre au code de sa couleur : NOIC, NOIF.
    morceaux = cle.rsplit(" ", 1)
    if len(morceaux) == 2 and morceaux[1] in ("clair", "fonce") and morceaux[0].strip() in CODES_COULEUR:
        return CODES_COULEUR[morceaux[0].strip()] + ("C" if morceaux[1] == "clair" else "F"), True
    brut = re.sub(r"[^A-Za-z؀-ۿ]", "", _sans_accent(nom))
    if not brut:
        return "XXX", False
    return brut[:3].upper(), False


# ----------------------------------------------------------------------------
# PARTIE 4 — LES SKU
# ----------------------------------------------------------------------------

MODES_SKU = {
    "par-taille": "un SKU par taille — la lecture la plus fine",
    "groupe2": "tailles visibles une par une, SKU partage par deux",
    "groupe2-affiche": "les GROUPES sont visibles (Taille 1 (S-M)...)",
    "perso": "tu composes tes groupes toi-meme",
    "unique": "un seul SKU pour tout le produit",
}

SKU_INTERDIT = re.compile(r"[^A-Z0-9\-]")


def nettoie_sku(txt):
    """Un SKU ne contient QUE des majuscules, des chiffres et des tirets.

    POURQUOI C'EST DUR : une espace dans un SKU casse la moitie des exports
    et des bons de livraison. Un accent aussi. On ne « corrige » pas en
    silence : on nettoie ET on le dit.
    """
    t = _sans_accent(str(txt)).upper().replace(" ", "-").replace("_", "-")
    t = SKU_INTERDIT.sub("", t)
    t = re.sub(r"-{2,}", "-", t).strip("-")
    return t


def code_couleur_sku(nom):
    """Le code d'une couleur TEL QU'IL SURVIVRA dans le SKU.

    Rend (code, connu, probleme). « probleme » n'est pas None quand il ne
    reste RIEN du code une fois le SKU nettoye.

    CE QUI SE PASSAIT SANS CE CONTROLE : code_couleur laisse passer les
    lettres arabes, nettoie_sku les retire juste apres. Une couleur arabe
    hors table sortait donc du SKU EN SILENCE — « ZHR-K38-S », la couleur
    effacee. Et avec deux couleurs pareilles, les deux SKU devenaient
    identiques : l'outil refusait en annoncant « un vrai doublon », un
    diagnostic FAUX que l'agent etait tenu de relayer au client.
    """
    code, connu = code_couleur(nom)
    propre = nettoie_sku(code)
    if propre:
        return propre, connu, None
    return "", connu, (
        "la couleur « %s » ne laisse aucune lettre utilisable dans un SKU "
        "(un SKU ne prend que A-Z, 0-9 et le tiret : les lettres arabes en "
        "sont retirees).\n"
        "        Ce n'est PAS un doublon. Ecris-la en lettres latines "
        "(« Turquoise »), ou ajoute-la\n"
        "        a la table des couleurs de l'outil." % nom)


def _departage(couleurs):
    """Rend (codes, departages) : codes = nom -> code DISTINCT ; departages = [(nom, code, code_de_depart, autre)].

    LOI DU VENDEUR (10/10/2026) : deux familles DISTINCTES dont les codes de depart se percutent
    (« Gris perle » et « Gris anthracite » -> GRI, ou un nom hors table qui retombe sur le code d'un
    autre) ne font JAMAIS tomber la page : la premiere garde son code, les suivantes prennent une lettre
    de plus (initiale de leurs autres mots, puis lettres suivantes du nom, puis A-Z), sans jamais prendre
    un code de depart d'une autre couleur. Deterministe (meme liste, memes codes). Le meme NOM ecrit deux
    fois n'est pas departage : c'est un vrai doublon (stock double), controle_matrice le refuse.
    """
    depart = []
    for c in couleurs:
        cc, _, souci = code_couleur_sku(c["nom"])
        depart.append((c["nom"], cc, souci))
    cle = lambda n: _sans_accent(n).strip().lower()
    reserves = set(cc for _, cc, s in depart if cc and not s)
    codes, pris, premier, deps = {}, set(), {}, []
    for nom, cc, souci in depart:
        if souci or not cc:
            codes[nom] = cc
            continue
        if cle(nom) in premier:          # meme nom : pas de departage (vrai doublon)
            codes[nom] = codes[premier[cle(nom)]]
            continue
        premier[cle(nom)] = nom
        if cc not in pris:
            codes[nom] = cc
            pris.add(cc)
            continue
        mots = [re.sub(r"[^A-Z]", "", w) for w in _sans_accent(nom).upper().split()]
        lettres = [w[0] for w in mots[1:] if w] + list("".join(mots)[3:]) + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        neuf = None
        for L in lettres:
            essai = cc + L
            if essai not in pris and essai not in reserves:
                neuf = essai
                break
        n = 2
        while neuf is None:
            essai = "%s%d" % (cc, n)
            if essai not in pris and essai not in reserves:
                neuf = essai
            n += 1
        autre = next((k for k, v in codes.items() if v == cc), "")
        codes[nom] = neuf
        pris.add(neuf)
        deps.append((nom, neuf, cc, autre))
    return codes, deps


def codes_couleurs(couleurs):
    """nom -> code DISTINCT de chaque couleur (voir _departage)."""
    return _departage(couleurs)[0]


def avertissements_couleurs(couleurs):
    """Les couleurs hors table : leur code est improvise, on le DIT. Et chaque code DEPARTAGE."""
    out = []
    for nom, neuf, cc, autre in _departage(couleurs)[1]:
        out.append(
            "ATTENTION : « %s » prend le code %s (%s est deja a « %s ») : "
            "couleur gardee, code departage." % (nom, neuf, cc, autre))
    distincts, deps = _departage(couleurs)
    deja_dits = set(d[0] for d in deps)
    for c in couleurs:
        code, connu = code_couleur(c["nom"])
        code = distincts.get(c["nom"]) or code
        if not connu and c["nom"] not in deja_dits:
            out.append(
                "ATTENTION : « %s » n'est pas dans la table des couleurs. "
                "Son code %s est pris\n             sur ses trois premieres "
                "lettres : verifie qu'aucune autre couleur\n             ne "
                "lui ressemble." % (c["nom"], code))
    return out


def dis_avertissements_couleurs(couleurs):
    """Les AFFICHE. Rend ce qui a ete affiche, pour qu'on puisse le lire."""
    lignes = avertissements_couleurs(couleurs)
    for l in lignes:
        print("  %s" % l)
    return lignes


# LES PAIRES FIXES — recopiees de la specification, pas inventees.
# Elles ne changent pas selon ce que le client choisit : c'est la facon
# dont l'atelier coupe. Si le client ne prend qu'une taille d'une paire,
# cette taille reste SEULE, et on lui DEMANDE quoi en faire.
PAIRES_LETTRES = [["S", "M"], ["L", "XL"], ["2XL", "3XL"]]
PAIRES_CHIFFRES = [["36", "38"], ["40", "42"], ["44", "46"],
                   ["48", "50"], ["52", "54"], ["56", "58"]]


def etiquette_groupe(groupe, famille):
    """Le bout de SKU qui designe le groupe, exactement comme la spec l'ecrit.

    Lettres : colles     -> S + M        donne  SM
                            2XL + 3XL    donne  2XL3XL
    Chiffres : separes   -> 36 + 38      donne  36-38
    Pourquoi la difference : « 3638 » ne se lit pas.
    """
    if famille == "lettres":
        return "".join(groupe)
    return "-".join(groupe)


def groupes_par_deux(tailles):
    """Range les tailles deux par deux SELON LES PAIRES FIXES de la spec.

    Rend (groupes, orphelins). Un orphelin est une taille dont la paire
    n'est pas complete parce que l'autre moitie n'a pas ete choisie.
    On ne decide JAMAIS a la place du client : on le lui demande.
    """
    fam = familles_tailles(tailles)
    if fam == "lettres":
        table = PAIRES_LETTRES
    elif fam == "chiffres":
        table = PAIRES_CHIFFRES
    else:
        # tailles maison, hors des deux tables : on apparie dans l'ordre donne
        table = [tailles[i:i + 2] for i in range(0, len(tailles), 2)]

    restants = list(tailles)
    groupes, orphelins = [], []
    for paire in table:
        pris = [t for t in paire if t in restants]
        if len(pris) == 2:
            groupes.append(pris)
            for t in pris:
                restants.remove(t)
        elif len(pris) == 1:
            orphelins.append(pris[0])
            restants.remove(pris[0])
    orphelins.extend(restants)
    return groupes, orphelins


def lis_groupes_perso(txt, tailles):
    """Lit des groupes ecrits a la main : « S+M, L+XL, 2XL+3XL ».

    Controles imposes : chaque taille dans UN SEUL groupe, aucun groupe vide,
    aucune taille oubliee, aucune taille inventee.
    """
    groupes = []
    for bloc in txt.split(","):
        bloc = bloc.strip()
        if not bloc:
            continue
        membres = [m.strip() for m in bloc.split("+") if m.strip()]
        if not membres:
            raise ValueError("un groupe est vide dans : %s" % txt)
        groupes.append(membres)

    vus = []
    for g in groupes:
        for t in g:
            if t not in tailles:
                raise ValueError(
                    "la taille « %s » n'est pas dans les tailles choisies (%s)"
                    % (t, ", ".join(tailles)))
            if t in vus:
                raise ValueError(
                    "la taille « %s » est dans DEUX groupes. Une taille "
                    "n'appartient qu'a un seul groupe." % t)
            vus.append(t)

    oublies = [t for t in tailles if t not in vus]
    if oublies:
        raise ValueError(
            "ces tailles n'ont aucun groupe : %s" % ", ".join(oublies))
    return groupes


def fabrique_matrice(boutique, modele, couleurs, tailles, mode,
                     groupes_txt=None, orphelin_seul=False):
    """Fabrique la liste des variantes : une par combinaison couleur x taille.

    Rend une liste de dictionnaires :
      { couleur, taille, taille_visible, sku, groupe }

    « taille_visible » est ce que la cliente CHOISIT sur la page.
    « taille » est la taille REELLE derriere — c'est elle qui porte le stock.
    """
    boutique = nettoie_sku(boutique)
    modele = nettoie_sku(modele)
    if not boutique:
        raise ValueError("le code boutique est vide")
    if not modele:
        raise ValueError("le code modele est vide")

    lignes = []

    # --- produit sans tailles ------------------------------------------
    if not tailles:
        distincts = codes_couleurs(couleurs)
        for c in couleurs:
            cc, _, souci = code_couleur_sku(c["nom"])
            if souci:
                raise ValueError(souci)
            cc = distincts[c["nom"]]
            sku = "%s-%s-%s" % (boutique, modele, cc) if couleurs else "%s-%s" % (boutique, modele)
            lignes.append({"couleur": c["nom"], "taille": None,
                           "taille_visible": None, "sku": nettoie_sku(sku),
                           "groupe": None})
        if not couleurs:
            lignes.append({"couleur": None, "taille": None,
                           "taille_visible": None,
                           "sku": nettoie_sku("%s-%s" % (boutique, modele)),
                           "groupe": None})
        return lignes

    # --- on prepare les groupes selon le mode --------------------------
    if mode == "par-taille":
        groupes = [[t] for t in tailles]
    elif mode in ("groupe2", "groupe2-affiche"):
        groupes, orphelins = groupes_par_deux(tailles)
        if orphelins:
            if orphelin_seul:
                for t in orphelins:
                    groupes.append([t])
                groupes.sort(key=lambda g: tailles.index(g[0]))
            else:
                raise ValueError(
                    "ces tailles restent SEULES, leur paire n'est pas "
                    "complete : %s.\n"
                    "        Deux reponses possibles, c'est au client de "
                    "choisir :\n"
                    "          - lui faire son propre SKU  -> ajoute "
                    "--orphelin seul\n"
                    "          - la mettre dans un groupe a lui -> "
                    "--mode perso --groupes \"...\""
                    % ", ".join(orphelins))
    elif mode == "perso":
        if not groupes_txt:
            raise ValueError("le mode perso demande --groupes \"S+M, L+XL\"")
        groupes = lis_groupes_perso(groupes_txt, tailles)
    elif mode == "unique":
        groupes = [list(tailles)]
    else:
        raise ValueError("mode SKU inconnu : %s" % mode)

    # --- le nom du groupe ----------------------------------------------
    # Sa forme reelle en production : T1, T2, T3. Courte sur un bon de
    # livraison, et elle marche aussi bien pour des tailles en chiffres.
    for numero, g in enumerate(groupes, start=1):
        if mode == "par-taille":
            etiquette_sku = nettoie_sku(g[0])
            visible = g[0]
        elif mode == "unique":
            etiquette_sku = ""
            visible = None
        else:
            etiquette_sku = etiquette_groupe(g, familles_tailles(tailles))
            visible = "Taille %d (%s)" % (numero, "-".join(g))

        for c in (couleurs if couleurs else [None]):
            if c is None:
                cc = ""
            else:
                cc, _, souci = code_couleur_sku(c["nom"])
                if souci:
                    raise ValueError(souci)
                cc = codes_couleurs(couleurs)[c["nom"]]

            morceaux = [boutique, modele]
            if cc:
                morceaux.append(cc)
            if etiquette_sku:
                morceaux.append(etiquette_sku)
            sku = nettoie_sku("-".join(morceaux))

            if mode == "groupe2-affiche" or mode == "unique":
                # UNE seule variante pour tout le groupe : la cliente choisit
                # le GROUPE. On ne saura donc pas si c'est le S ou le M
                # qui est parti.
                lignes.append({
                    "couleur": c["nom"] if c else None,
                    "taille": "+".join(g),
                    "taille_visible": visible if visible else None,
                    "sku": sku, "groupe": g,
                })
            else:
                # UNE variante par taille REELLE, meme si le SKU est partage.
                # C'est ce qui permet de savoir quelle taille a ete commandee.
                for t in g:
                    lignes.append({
                        "couleur": c["nom"] if c else None,
                        "taille": t,
                        "taille_visible": t,
                        "sku": sku, "groupe": g,
                    })
    return lignes


def controle_matrice(lignes, couleurs, tailles, mode):
    """Cherche les fautes dans la matrice. Rend une liste de problemes.

    LA REGLE QUI N'EST PAS CELLE QU'ON CROIT : « aucun SKU en double » est
    FAUSSE en mode groupe. En production un SKU groupe porte bien DEUX
    tailles, c'est voulu. La vraie regle est : aucun SKU en double pour un
    MEME couple couleur x groupe.
    """
    pb = []

    # 0. UNE COULEUR DONT LE CODE NE SURVIT PAS AU NETTOYAGE DU SKU.
    #    Ce controle passe AVANT les autres et rend SEUL son resultat : les
    #    autres fautes n'en sont que la consequence. Sans lui, deux couleurs
    #    arabes hors table faisaient annoncer « c'est un vrai doublon ».
    perdues = [souci for souci in
               (code_couleur_sku(c["nom"])[2] for c in couleurs) if souci]
    if perdues:
        return perdues

    # 1. aucun trou : il faut une variante par combinaison attendue
    if tailles and mode not in ("groupe2-affiche", "unique"):
        attendu = max(1, len(couleurs)) * len(tailles)
        if len(lignes) != attendu:
            pb.append("il manque des variantes : %d attendues, %d fabriquees"
                      % (attendu, len(lignes)))

    # 2. un SKU ne doit pas etre partage par deux GROUPES differents
    par_sku = {}
    for l in lignes:
        cle = l["sku"]
        signature = (l["couleur"], tuple(l["groupe"]) if l["groupe"] else None)
        par_sku.setdefault(cle, set()).add(signature)
    for sku, sigs in par_sku.items():
        if len(sigs) > 1:
            pb.append("le SKU %s est porte par %d couples couleur/groupe "
                      "differents — c'est un vrai doublon" % (sku, len(sigs)))

    # 3. forme du SKU
    for l in lignes:
        if not l["sku"]:
            pb.append("une variante n'a pas de SKU")
        elif SKU_INTERDIT.search(l["sku"]):
            pb.append("le SKU %s contient un caractere interdit" % l["sku"])
        elif len(l["sku"]) > 60:
            pb.append("le SKU %s est trop long (plus de 60 caracteres)" % l["sku"])

    # 4. deux couleurs qui tombent sur le meme code, ET deux couleurs qui
    #    portent le MEME NOM. Le second cas passait : la collision n'etait
    #    signalee que si les NOMS differaient. « Corail, Corail » fabriquait
    #    donc deux fois les memes variantes et DOUBLAIT le stock.
    codes, noms_vus = {}, set()
    for c in couleurs:
        cle_nom = _sans_accent(c["nom"]).strip().lower()
        if cle_nom in noms_vus:
            pb.append("la couleur « %s » est ecrite DEUX fois — deux "
                      "couleurs du meme nom fabriquent les memes variantes "
                      "et DOUBLENT le stock" % c["nom"])
        noms_vus.add(cle_nom)
        # deux NOMS differents : leurs codes sont DEPARTAGES (_departage, loi du 10/10/2026) ; s'ils se
        # percutent encore, c'est une faute de l'outil, jamais un « renomme » demande au client
        cc = codes_couleurs(couleurs).get(c["nom"])
        if cc in codes and _sans_accent(codes[cc]).strip().lower() != cle_nom:
            pb.append("les couleurs « %s » et « %s » donnent encore le MEME code %s "
                      "apres departage — faute de l'outil" % (codes[cc], c["nom"], cc))
        codes[cc] = c["nom"]

    # 5. melange lettres / chiffres
    if tailles and familles_tailles(tailles) == "melange":
        pb.append("tes tailles melangent des lettres et des chiffres — "
                  "une page ne doit pas melanger les deux")

    return pb


# ----------------------------------------------------------------------------
# PARTIE 5 — LE STOCK REEL, TAILLE PAR TAILLE
# ----------------------------------------------------------------------------

def lis_stock(txt, couleurs, tailles, par_couleur_assume=False):
    """Lit le stock ecrit a la main.

    Deux ecritures acceptees :
      « Noir/S:8, Beige/S:5, ... »   -> couleur par couleur. Aucune ambiguite.
      « Olive:20, Lilas:14 »         -> sur un produit SANS TAILLES, la cle
                                        est la COULEUR. Aucune ambiguite.
      « S:8, M:12 »                  -> la taille SANS la couleur. Ambigu des
                                        qu'il y a plus d'une couleur, et c'est
                                        REFUSE, sauf si on dit explicitement
                                        que ce nombre vaut pour CHAQUE couleur.

    LE PIEGE QUI ETAIT ICI, ET CE QU'IL COUTAIT :
    quand le client ecrivait « 1:40, 2:50, 3:30 » sur deux couleurs, la
    fonction donnait quarante pieces au Noir ET quarante au Beige. Il avait
    declare cent vingt pieces, le fichier en ecrivait deux cent quarante.
    Ce stock-la descend jusqu'a la porte du scaling : il ouvre une porte sur
    un entrepot a moitie vide, et il fait monter un budget sur des pieces qui
    n'existent pas. Personne ne voyait rien.
    Maintenant la question se pose une fois, en clair, au lieu d'etre
    tranchee en silence.

    POURQUOI LE STOCK EST ICI ET PAS DANS TASSYIR : mesure faite sur un vrai
    compte — create_product n'a AUCUN champ quantite, get_inventory rend un
    total d'entreprise sans identifiant, et adjust_inventory reclame un
    identifiant que get_inventory ne donne jamais. La plateforme ne sait pas
    tenir un stock par taille. Ce fichier le tient a sa place.
    """
    brut = {}
    for bloc in txt.split(","):
        bloc = bloc.strip()
        if not bloc:
            continue
        if ":" not in bloc:
            raise ValueError("stock mal ecrit : « %s » (il faut TAILLE:NOMBRE)" % bloc)
        cle, val = bloc.rsplit(":", 1)
        cle = cle.strip()
        val = val.strip()
        if not re.fullmatch(r"\d+", val):
            raise ValueError("le stock de « %s » n'est pas un nombre entier : %s"
                             % (cle, val))
        brut[cle] = int(val)

    noms = [c["nom"] for c in couleurs] if couleurs else [None]

    # LES CLES QUE CE PRODUIT ATTEND, ecrites une seule fois.
    attendues, longues, courtes = [], set(), set()
    for coul in noms:
        for t in (tailles if tailles else [None]):
            cle_longue = "%s/%s" % (coul, t) if coul and t else (t or coul or "unique")
            cle_courte = t or "unique"
            attendues.append((cle_longue, cle_courte))
            longues.add(cle_longue)
            courtes.add(cle_courte)

    # AUCUN MORCEAU DE STOCK NE DISPARAIT EN SILENCE.
    # Ce qui ne tombait sur aucune cle attendue etait simplement ignore :
    # « ..., Olive/XXL:40, Olive/2XL:25 » sur un produit qui n'a pas ces
    # tailles, et soixante-cinq pieces s'evaporaient pendant que l'ecran
    # annoncait « stock renseigne ... OK ». On REFUSE, en nommant la cle.
    inconnues = [c for c in brut if c not in longues and c not in courtes]
    if inconnues:
        liste = sorted(longues)
        raise ValueError(
            "ces morceaux de stock ne correspondent a RIEN dans ce produit : "
            "%s.\n"
            "        %d pieces partiraient en silence. Verifie l'orthographe "
            "de la couleur et de la taille.\n"
            "        Ce produit attend : %s"
            % (", ".join("« %s »" % c for c in inconnues),
               sum(brut[c] for c in inconnues),
               ", ".join(liste[:12]) + (" ..." if len(liste) > 12 else "")))

    # L'AMBIGUITE SE TRANCHE ICI, UNE FOIS, ET PAS EN SILENCE.
    # SANS TAILLES, une cle sans « / » est une cle-COULEUR, point : elle
    # nomme deja sa couleur, il n'y a rien a trancher. Le garde-fou les
    # prenait pour des cles-taille et rendait un correctif IMPOSSIBLE a
    # suivre (« ecris Noir/1:20 » sur un produit qui n'a aucune taille).
    if len(noms) > 1 and not par_couleur_assume:
        sans_couleur = [c for c in brut
                        if "/" not in c and (tailles or c not in longues)]
        if sans_couleur:
            total_ecrit = sum(brut[c] for c in sans_couleur)
            if tailles:
                exemple = ", ".join("%s/%s:20" % (n, tailles[0])
                                    for n in noms[:2]) + ", ..."
            else:
                exemple = ", ".join("%s:20" % n for n in noms[:2]) + ", ..."
            raise ValueError(
                "STOCK AMBIGU. Tu as ecrit les tailles sans les couleurs, et il "
                "y a %d couleurs.\n"
                "Ces deux lectures sont possibles, et elles ne donnent pas le "
                "meme nombre de pieces :\n"
                "   A. ce nombre est le TOTAL de la taille, toutes couleurs "
                "confondues  ->  %d pieces en tout\n"
                "   B. ce nombre vaut pour CHAQUE couleur                       "
                "      ->  %d pieces en tout\n"
                "Je ne choisis pas a sa place : ce stock sert a decider de "
                "monter un budget.\n"
                "   si c'est B  : relance avec --stock-par-couleur\n"
                "   si c'est A  : redemande-lui le detail, couleur par "
                "couleur, et ecris\n"
                "                 « %s »"
                % (len(noms), total_ecrit, total_ecrit * len(noms), exemple))

    stock = {}
    for cle_longue, cle_courte in attendues:
        if cle_longue in brut:
            stock[cle_longue] = brut[cle_longue]
        elif cle_courte in brut:
            stock[cle_longue] = brut[cle_courte]
        else:
            raise ValueError(
                "il manque le stock de « %s ». Ecris-le, meme si c'est zero."
                % cle_longue)
    return stock


# ----------------------------------------------------------------------------
# PARTIE 5 bis — LE STOCK QUI SE RECOMPTE TOUT SEUL
# ----------------------------------------------------------------------------
# Tassyir ne tient pas le stock par taille (mesure : create_product n'a aucun
# champ quantite, adjust_inventory reclame un identifiant que get_inventory
# ne rend jamais). C'est donc stock.json qui le tient.
#
# Pour qu'il ne prenne pas de retard, on le recompte depuis les COMMANDES.
# Claude lit list_orders + list_order_tracking + list_returns et ecrit ce
# qu'il a lu dans un fichier ; Python fait les soustractions. Python ne
# parle pas a Tassyir, Claude ne fait pas les comptes : chacun son travail.

# CE QUI SORT VRAIMENT DE L'ETAGERE, ET CE QUI N'EN SORT PAS.
# En COD algerien une commande PASSEE n'est pas une vente : une grosse part
# n'est jamais confirmee. On ne deduit que ce qui est parti pour de vrai.
STATUTS_SORTIS = ["confirmed", "scheduled", "dispatched", "in_transit",
                  "delivered", "confirmee", "expediee", "livree"]
STATUTS_RESERVES = ["pending", "en_attente"]
STATUTS_RETOURS = ["returned", "retour", "retournee"]
STATUTS_RIEN = ["canceled", "cancelled", "abandoned", "annulee", "abandonnee"]


def lis_commandes(chemin):
    """Lit ce que Claude a releve dans Tassyir.

    Forme attendue : {"lignes": [{variantId, quantity, statut}, ...]}
    ou directement la liste. On accepte les deux, on ne devine rien d'autre.
    """
    with open(chemin, "r", encoding="utf-8") as f:
        brut = json.load(f)
    lignes = brut.get("lignes", brut) if isinstance(brut, dict) else brut
    if not isinstance(lignes, list):
        raise ValueError("le fichier des commandes doit contenir une liste "
                         "de lignes {variantId, quantity, statut}")
    propres = []
    for i, l in enumerate(lignes, start=1):
        if not isinstance(l, dict):
            raise ValueError("ligne %d : ce n'est pas une ligne de commande" % i)
        vid = str(l.get("variantId") or l.get("variant_id") or "").strip()
        if not vid:
            raise ValueError("ligne %d : il manque le variantId" % i)
        try:
            q = int(l.get("quantity", l.get("quantite", 1)))
        except (TypeError, ValueError):
            raise ValueError("ligne %d : la quantite n'est pas un nombre" % i)
        if q < 0:
            raise ValueError("ligne %d : quantite negative" % i)
        st = str(l.get("statut") or l.get("status") or "").strip().lower()
        propres.append({"variantId": vid, "quantity": q, "statut": st})
    return propres


def classe_commande(statut):
    """Range un statut dans une des quatre familles. Un statut inconnu
    n'est JAMAIS deduit en silence : il est rendu comme inconnu."""
    st = (statut or "").strip().lower()
    if st in STATUTS_SORTIS:
        return "sorti"
    if st in STATUTS_RESERVES:
        return "reserve"
    if st in STATUTS_RETOURS:
        return "retour"
    if st in STATUTS_RIEN:
        return "rien"
    return "inconnu"


def recompte(fiche, commandes):
    """Recalcule le stock restant, ligne par ligne.

    restant = depart - sorti + retours
    Les commandes en attente sont COMPTEES A PART : leur argent n'est pas
    rentre et, en COD, une bonne part ne se confirmera jamais.
    """
    par_variante = {}
    for c in commandes:
        fam = classe_commande(c["statut"])
        d = par_variante.setdefault(c["variantId"],
                                    {"sorti": 0, "reserve": 0,
                                     "retour": 0, "inconnu": 0})
        if fam in ("sorti", "reserve", "retour", "inconnu"):
            d[fam] += c["quantity"]

    vues = set()
    for l in fiche["lignes"]:
        vid = l.get("variantId")
        d = par_variante.get(vid, {"sorti": 0, "reserve": 0,
                                   "retour": 0, "inconnu": 0}) if vid else             {"sorti": 0, "reserve": 0, "retour": 0, "inconnu": 0}
        if vid:
            vues.add(vid)
        depart = l.get("stock_depart") or 0
        l["sorti"] = d["sorti"]
        l["reserve"] = d["reserve"]
        l["retour"] = d["retour"]
        l["inconnu"] = d["inconnu"]
        l["stock_restant"] = depart - d["sorti"] + d["retour"]

    orphelines = [v for v in par_variante if v not in vues]
    return fiche, orphelines


def branche_variantes(fiche, produit):
    """Colle les identifiants de variantes de Tassyir sur les lignes du stock.

    Sans ce lien, on ne peut pas savoir quelle taille a ete commandee. On
    apparie sur le COUPLE couleur + taille, jamais sur le SKU : en mode
    groupe un SKU porte deux tailles, il ne suffit pas a identifier.
    """
    variantes = produit.get("variants", produit) if isinstance(produit, dict) else produit
    index = {}
    for v in variantes:
        so = {o["name"]: o["value"] for o in v.get("selectedOptions", [])}
        cle = (so.get("Couleur"), so.get("Taille"))
        index[cle] = v.get("id")

    branchees, manquantes = 0, []
    for l in fiche["lignes"]:
        cle = (l.get("couleur"), l.get("taille_visible"))
        if cle in index and index[cle]:
            l["variantId"] = index[cle]
            branchees += 1
        else:
            manquantes.append("%s / %s" % (cle[0] or "-", cle[1] or "-"))
    return branchees, manquantes


# ----------------------------------------------------------------------------
# PARTIE 6 — LES PHOTOS ET L'ALTERNANCE DES COULEURS
# ----------------------------------------------------------------------------

def lis_photos(valeur):
    """Lit les photos. Soit un fichier (une par ligne), soit en ligne.

    Chaque ligne : « Couleur | https://... »  ou juste « https://... »
    """
    if os.path.exists(valeur):
        with open(valeur, "r", encoding="utf-8") as f:
            lignes = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    else:
        lignes = [l.strip() for l in valeur.split(",") if l.strip()]

    photos = []
    for l in lignes:
        if "|" in l:
            c, u = l.split("|", 1)
            photos.append({"couleur": c.strip() or None, "url": u.strip()})
        elif l.count(":") >= 2 and not l.lower().startswith("http"):
            c, u = l.split(":", 1)
            photos.append({"couleur": c.strip() or None, "url": u.strip()})
        else:
            photos.append({"couleur": None, "url": l})
    return photos


def _longueur_alternee(comptes, interdit, maxi):
    """La plus longue suite sans deux fois la meme couleur a la suite (la plus
    fournie d'abord, jamais « interdit » en premier) : l'oracle de la
    rotation, pour qu'elle ne pose jamais moins de photos que l'ancien ordre."""
    c = dict(comptes)
    avant, n = interdit, 0
    while n < maxi:
        pris = None
        for nom, k in c.items():
            if k > 0 and nom != avant and (pris is None or k > c[pris]):
                pris = nom
        if pris is None:
            break
        c[pris] -= 1
        avant = pris
        n += 1
    return n


def rotation_couleurs(photos, ordre):
    """L'ORDRE DONNE PAR LE BUREAU (--ordre-couleurs), respecte tel quel : les
    couleurs tour a tour dans cet ordre (noir, beige, rouge, bleu, noir,
    beige...). Une couleur epuisee est sautee, la rotation continue sur les
    restantes, JAMAIS deux fois la meme a la suite ; une couleur n'est sautee
    que si la poser ferait tomber la suite sous la longueur que l'ancien
    ordre atteignait. Meme methode que photosAlternees (missions.mjs).
    Rend (ordre, reste) comme alterne_couleurs."""
    par_couleur = {}
    for p in photos:
        par_couleur.setdefault(p["couleur"], []).append(p)
    noms = [n for n in ordre if n in par_couleur]
    noms += [n for n in par_couleur if n not in noms]
    comptes = dict((n, len(par_couleur[n])) for n in noms)
    cible = _longueur_alternee(comptes, "\x00", len(photos))
    sortie, avant, pos = [], "\x00", -1
    while len(sortie) < cible:
        choisi = -1
        for k in range(1, len(noms) + 1):
            j = (pos + k) % len(noms)
            nom = noms[j]
            if nom == avant or comptes[nom] <= 0:
                continue
            comptes[nom] -= 1
            if len(sortie) + 1 + _longueur_alternee(
                    comptes, nom, cible - len(sortie) - 1) >= cible:
                choisi = j
                break
            comptes[nom] += 1
        if choisi < 0:
            break
        nom = noms[choisi]
        sortie.append(par_couleur[nom].pop(0))
        avant, pos = nom, choisi
    reste = []
    for n in noms:
        reste.extend(par_couleur[n])
    return sortie, reste


def lis_ordre_couleurs(texte):
    """« Noir, Beige, Rouge » -> ["Noir", "Beige", "Rouge"] (vide : aucun
    ordre donne, l'ancien comportement « la plus fournie d'abord »)."""
    return [c.strip() for c in (texte or "").split(",") if c.strip()]


# « --ordre-couleurs foncees » : DU FONCE AU CLAIR (decision du vendeur du
# 10/10/2026, le defaut du bureau : ORDRE_COULEURS = 'foncees' dans
# missions.mjs). Pour le mode manuel, qui n'a pas les centres des familles.
MOTS_FONCEES = ("foncees", "foncee", "fonce", "foncés", "foncées", "foncé")


def demande_foncees(texte):
    """Vrai quand --ordre-couleurs demande l'ordre du fonce au clair."""
    return (texte or "").strip().lower() in MOTS_FONCEES


def luminance_hex(hexa):
    """La SOMME R+G+B d'un code #RRGGBB (la mesure de captures.py et du
    bureau, missions.mjs luminanceCentre) ; None sans code lisible."""
    if not hexa or not re.fullmatch(r"#[0-9A-Fa-f]{6}", hexa):
        return None
    return sum(int(hexa[i:i + 2], 16) for i in (1, 3, 5))


def ordre_fonce_clair(couleurs):
    """Les couleurs de --couleurs (lis_couleurs) rangees DU FONCE AU CLAIR
    par la luminance de leur hex. Une couleur SANS hex reste a sa place
    relative (les autres sont rangees sur les places qu'elles occupent), et
    c'est DIT. Rend (noms, dit) — « dit » vide quand toutes ont un hex."""
    avec = sorted([(luminance_hex(c["hex"]), i, c) for i, c in enumerate(couleurs)
                   if luminance_hex(c.get("hex")) is not None],
                  key=lambda x: (x[0], x[1]))
    it = iter(avec)
    noms = [next(it)[2]["nom"] if luminance_hex(c.get("hex")) is not None
            else c["nom"] for c in couleurs]
    sans = ["« %s » (n° %d)" % (c["nom"], i + 1)
            for i, c in enumerate(couleurs) if luminance_hex(c.get("hex")) is None]
    dit = ""
    if sans:
        dit = ("ORDRE DU FONCE AU CLAIR : %s sans code couleur (#hex) : gardee a "
               "sa place ; les autres sont rangees du fonce au clair autour."
               % ", ".join(sans))
    return noms, dit


def alterne_couleurs(photos, ordre=None):
    """Classe les photos pour que DEUX PHOTOS DE LA MEME COULEUR NE SE
    SUIVENT JAMAIS.

    C'est sa regle la plus importante, et la raison est commerciale : trois
    photos blanches d'affilee font croire a la cliente qu'il n'y a qu'une
    seule couleur. Elle ecrit pour demander — et une question, c'est une
    commande qui n'est pas passee.

    METHODE : a chaque tour on prend la couleur qui a le PLUS de photos
    restantes, en interdisant celle qu'on vient de poser. C'est la seule
    facon d'eviter de se retrouver coince a la fin avec trois blanches.

    Rend (ordre, reste) : « reste » n'est pas vide quand c'est
    mathematiquement IMPOSSIBLE (une couleur depasse la moitie des photos).
    On ne ment pas dans ce cas : on le dit.
    """
    # UN ORDRE DONNE (--ordre-couleurs, le reglage du bureau) : respecte, la
    # rotation dans cet ordre ; jamais reclasse « la plus fournie d'abord ».
    if ordre:
        return rotation_couleurs(photos, ordre)
    par_couleur = {}
    for p in photos:
        par_couleur.setdefault(p["couleur"], []).append(p)

    ordre = []
    precedente = "\x00"        # une valeur qui n'est jamais une couleur
    while True:
        dispo = [(c, v) for c, v in par_couleur.items() if v and c != precedente]
        if not dispo:
            break
        dispo.sort(key=lambda cv: (-len(cv[1]), str(cv[0])))
        couleur, pile = dispo[0]
        ordre.append(pile.pop(0))
        precedente = couleur

    reste = []
    for v in par_couleur.values():
        reste.extend(v)
    return ordre, reste


def rien_a_alterner(photos):
    """Vrai quand TOUTES les photos portent la meme couleur (ou aucune).

    UN PRODUIT D'UNE SEULE COULEUR NE PEUT PAS ALTERNER, et ce n'est pas
    une faute : il n'y a rien a corriger. Six photos et une couleur
    annoncaient pourtant « deux photos de la meme couleur se suivent : 5
    fois », avec le conseil « ajoute des photos des autres couleurs » —
    impossible a suivre quand il n'y a pas d'autre couleur. Une fausse
    alarme a chaque produit monochrome apprend a l'agent a ignorer
    l'alarme, et le jour ou elle est vraie elle ne sert plus a rien.
    Donc ici : on se tait.
    """
    return len(set(p["couleur"] for p in photos)) <= 1


def conseil_alternance(photos):
    """Dit QUOI FAIRE quand l'alternance est impossible.

    Un refus qui ne dit pas quoi faire n'est qu'un mur. On nomme donc la
    couleur qui deborde et le nombre EXACT de photos a ajouter.

    L'alternance tient tant qu'aucune couleur ne depasse la moitie
    (arrondie au-dessus) du nombre de photos. Cinq blanches sur six : il
    en faut trois d'autres couleurs — ou trois blanches en moins.
    """
    if rien_a_alterner(photos):
        return []
    compte = {}
    for p in photos:
        if p["couleur"]:
            compte[p["couleur"]] = compte.get(p["couleur"], 0) + 1
    if not compte:
        return []
    couleur, gros = max(compte.items(), key=lambda cv: (cv[1], str(cv[0])))
    n = len(photos)
    manque = 2 * gros - 1 - n
    if manque <= 0:
        return []
    s = "s" if manque > 1 else ""
    return ["la couleur « %s » occupe %d photos sur %d."
            % (couleur, gros, n),
            "Ajoute au moins %d photo%s d'UNE AUTRE couleur, ou retire %d "
            "photo%s « %s »." % (manque, s, manque, s, couleur)]


def controle_alternance(ordre):
    """Relit l'ordre final et rend les endroits ou deux couleurs se suivent.

    C'est la DEUXIEME methode : le classement dit qu'il a reussi, ce controle
    le relit sans rien savoir de la facon dont il a ete fabrique.
    """
    fautes = []
    for i in range(1, len(ordre)):
        a, b = ordre[i - 1]["couleur"], ordre[i]["couleur"]
        if a is not None and a == b:
            fautes.append((i, a))
    return fautes


# ----------------------------------------------------------------------------
# PARTIE 7 — LA DESCRIPTION
# ----------------------------------------------------------------------------

# LA CASSE NE COMPTE PAS. Le filtre passait par « in », donc « COD » etait
# refuse et « Cod » passait : la meme faute selon la touche majuscule.
MOTS_INTERDITS = [
    "تحوّس", "تحوس", "الكاس", "الصوردي",     # marocain / mauvais mot
    "COD",                                     # ne s'ecrit jamais dans une pub
    "مضمون", "تربح", "مليونير",               # promesse de gain
]


def mots_interdits_dans(txt):
    """Rend les mots interdits d'un texte, SANS regarder la casse.

    LES DEUX PORTES QUI N'ETAIENT PAS GARDEES : le filtre ne servait que
    sur les blocs d'angles. Le NOM du produit et la ligne de LIVRAISON
    n'etaient jamais filtres — « Jupe ZHR COD » et « COD 600 DA »
    passaient, et le mot atterrissait dans le TITRE de la page ET sur la
    DERNIERE ligne de la description. Les deux passent ici maintenant.
    """
    bas = (txt or "").lower()
    return [m for m in MOTS_INTERDITS if m.lower() in bas]


def prix_arabe(prix):
    """Ecrit le prix comme il doit s'ecrire dans un texte arabe.

    Regle : point comme separateur, sigle en arabe. A partir de dix mille
    dinars, on ajoute la lecture parlee en millions de centimes, parce que
    c'est comme ca que la cliente lit un prix en Algerie.

    ET UN CHIFFRE NE SE COLLE JAMAIS A UNE LETTRE ARABE : chez lui, un
    chiffre colle a de l'arabe s'affiche a l'envers. « et 150 mille » a
    donc une espace apres le « و ». Six des prix recommandes etaient
    fautifs, et toute la plage de dix mille a cinquante-neuf mille.
    """
    txt = "{:,}".format(int(prix)).replace(",", ".")
    sortie = "%s دج" % txt
    if prix >= SEUIL_LECTURE_PARLEE:
        centimes = int(prix) * 100
        millions = centimes // 1000000
        reste_alf = (centimes % 1000000) // 1000
        if millions and reste_alf:
            sortie += "، يعني %d مليون و %d ألف" % (millions, reste_alf)
        elif millions:
            sortie += "، يعني %d مليون" % millions
    return sortie


def lis_textes(valeur):
    """Lit les blocs de texte des angles. Fichier ou texte separe par « --- »."""
    if os.path.exists(valeur):
        with open(valeur, "r", encoding="utf-8") as f:
            brut = f.read()
    else:
        brut = valeur
    blocs = [b.strip() for b in re.split(r"\n\s*---+\s*\n|\n\s*\n", brut) if b.strip()]
    return blocs


def controle_textes(blocs):
    """Cherche dans les textes ce qui n'a pas le droit d'y etre."""
    pb = []
    for i, b in enumerate(blocs, start=1):
        for mot in mots_interdits_dans(b):
            pb.append("le texte %d contient « %s » — interdit" % (i, mot))
        if len(b.splitlines()) > 6:
            pb.append("le texte %d fait plus de six lignes — c'est un pave" % i)
    return pb


def couples_description(ordre_photos, blocs):
    """Le nombre de couples photo/texte que la description portera, et la
    phrase qui le DIT quand le minimum (PHOTOS_DESCRIPTION) est impossible
    (pas assez de blocs ou de photos). Rend (couples, phrase ou "")."""
    couples = min(len(ordre_photos), len(blocs))
    if couples >= PHOTOS_DESCRIPTION:
        return couples, ""
    manque = "blocs de texte" if len(blocs) < PHOTOS_DESCRIPTION else "photos"
    return couples, ("ATTENTION : %d couples photo/texte dans la description au "
                     "lieu de %d (pas assez de %s : %d blocs, %d photos) — "
                     "l'alternance est gardee, rien n'est colle."
                     % (couples, PHOTOS_DESCRIPTION, manque, len(blocs),
                        len(ordre_photos)))


def bati_description(ordre_photos, blocs, prix, livraison=None):
    """Ecrit la description en alternance photo / texte.

    On ne reinvente aucun texte : les blocs viennent des angles. Si les
    angles ne sont pas fournis, on ne fabrique PAS de faux texte — l'outil
    refuse, plus haut.

    CE QUI CASSAIT L'ALTERNANCE : au-dela du nombre de photos, seul le
    texte etait ajoute. Sept blocs et six photos — le minimum autorise —
    donnaient DEUX TEXTES DE SUITE, et le rapport annoncait « OK (7
    blocs) ». Une alternance photo/texte demande au moins autant de photos
    que de blocs : sinon on le DIT, on ne colle pas les textes.
    """
    if len(blocs) > len(ordre_photos):
        raise ValueError(
            "il y a %d blocs de texte pour %d photos : l'alternance "
            "photo/texte est IMPOSSIBLE,\n        deux textes se suivraient. "
            "Ajoute %d photo%s, ou garde %d blocs."
            % (len(blocs), len(ordre_photos),
               len(blocs) - len(ordre_photos),
               "s" if len(blocs) - len(ordre_photos) > 1 else "",
               len(ordre_photos)))
    lignes = []
    # L'ALTERNANCE NE CASSE JAMAIS (09/10/2026) : au plus une photo de plus
    # que de blocs (photo, texte, ..., photo). Moins de PHOTOS_DESCRIPTION
    # blocs : moins de cinq couples — couples_description() le dit.
    n = min(len(ordre_photos), max(len(blocs), PHOTOS_DESCRIPTION), len(blocs) + 1)
    for i in range(n):
        if i < len(ordre_photos):
            lignes.append('<img src="%s" alt="" />' % ordre_photos[i]["url"])
        if i < len(blocs):
            lignes.append("")
            lignes.append(blocs[i])
            lignes.append("")

    fin = "السعر: %s · التوصيل لكل الولايات · الخلاص عند الاستلام" % prix_arabe(prix)
    if livraison:
        fin = "السعر: %s · %s · الخلاص عند الاستلام" % (prix_arabe(prix), livraison)
    lignes.append(fin)
    return "\n".join(lignes)


# ----------------------------------------------------------------------------
# PARTIE 8 — LE PAQUET POUR TASSYIR
# ----------------------------------------------------------------------------

def bati_paquet(nom, prix, couleurs, tailles, lignes, ordre_photos,
                description, boutique_id=None, cache=True):
    """Fabrique le dictionnaire exact que create_product attend.

    POINT IMPORTANT, MESURE SUR LA VRAIE FICHE DE L'OUTIL : create_product
    n'a NI isActive NI isVisible. Le produit nait donc visible. En revanche
    CHAQUE VARIANTE accepte isHidden. On les cree donc toutes cachees :
    pendant les quelques secondes ou le produit existe avant d'etre masque,
    aucune taille n'est achetable.
    """
    options = []
    position = 0
    if couleurs:
        options.append({
            "name": "Couleur",
            "position": position,
            "value": [{"value": c["nom"], "color": c.get("hex")} for c in couleurs],
        })
        position += 1

    visibles = []
    for l in lignes:
        v = l["taille_visible"]
        if v and v not in visibles:
            visibles.append(v)
    if visibles:
        options.append({
            "name": "Taille",
            "position": position,
            "value": [{"value": v} for v in visibles],
        })

    # une photo par couleur, pour la pastille de la variante
    photo_de = {}
    for p in ordre_photos:
        if p["couleur"] and p["couleur"] not in photo_de:
            photo_de[p["couleur"]] = p["url"]

    variantes = []
    for l in lignes:
        so = []
        if l["couleur"]:
            so.append({"name": "Couleur", "value": l["couleur"]})
        if l["taille_visible"]:
            so.append({"name": "Taille", "value": l["taille_visible"]})
        v = {"sku": l["sku"], "price": int(prix), "selectedOptions": so}
        if cache:
            v["isHidden"] = True
        if l["couleur"] and l["couleur"] in photo_de:
            v["image"] = photo_de[l["couleur"]]
        variantes.append(v)

    urls = [p["url"] for p in ordre_photos]
    paquet = {
        "name": nom,
        "storeId": boutique_id or PLACE_BOUTIQUE,
        "price": int(prix),
        "image": urls[0] if urls else None,
        "gallery": urls[1:GALERIE_MAXI_TASSYIR + 1],
        "description": description,
        "options": options,
        "variants": variantes,
    }
    return paquet


# ----------------------------------------------------------------------------
# PARTIE 9 — OU SONT LES FICHIERS
# ----------------------------------------------------------------------------

def dire_ou_sont_les_fichiers(dossier, fichiers):
    print("")
    print("=" * 62)
    print("OU SONT TES FICHIERS")
    print("=" * 62)
    print("  dossier : %s" % os.path.abspath(dossier))
    for f in fichiers:
        chemin = os.path.join(dossier, f)
        if os.path.exists(chemin):
            print("    %-28s %6d octets" % (f, os.path.getsize(chemin)))
    print("=" * 62)


# ----------------------------------------------------------------------------
# PARTIE 10 — L'AUTO-TEST
# ----------------------------------------------------------------------------

def _essai(nom, condition, detail=""):
    etat = "OK  " if condition else "RATE"
    print("  [%s] %s%s" % (etat, nom, ("  -> " + detail) if detail and not condition else ""))
    return bool(condition)


def verifier():
    print("")
    print("AUTO-TEST DE manita-produit.py v%s" % VERSION)
    print("-" * 62)
    ok = True

    # --- les tables ----------------------------------------------------
    ok &= _essai("les 15 configurations de tailles sont la",
                 len(TAILLES) == 15, "il y en a %d" % len(TAILLES))
    ok &= _essai("les trois formes de bandes sont la",
                 TAILLES["bandes-3"][1] == ["1", "2", "3"]
                 and TAILLES["bandes-2"][1] == ["1", "2"]
                 and TAILLES["bandes-4"][1] == ["1", "2", "3", "4"])
    ok &= _essai("la question obligatoire propose bien les TROIS formes",
                 all(m in QUESTION for m in
                     ("بالحروف", "بالأرقام", "بالبلوكات")))
    ok &= _essai("et elle previent que « chiffres » n'est pas douze tailles",
                 "ne remplis jamais douze" in QUESTION)
    ok &= _essai("lettres complete = six tailles",
                 TAILLES["lettres-complete"][1] == ["S", "M", "L", "XL", "2XL", "3XL"])
    ok &= _essai("chiffres complete = douze tailles de 36 a 58",
                 TAILLES["chiffres-complete"][1] == [str(n) for n in range(36, 59, 2)]
                 and len(TAILLES["chiffres-complete"][1]) == 12)
    ok &= _essai("les 4 modes SKU de base sont la",
                 all(m in MODES_SKU for m in
                     ["par-taille", "groupe2", "perso", "unique"]))

    # --- les codes couleur ---------------------------------------------
    ok &= _essai("Noir donne NOI", code_couleur("Noir")[0] == "NOI")
    ok &= _essai("Noir clair donne NOIC, Noir fonce NOIF (le nommage sans fusion : jamais le code de Noir)",
                 code_couleur("Noir clair") == ("NOIC", True) and code_couleur("Noir fonce") == ("NOIF", True)
                 and code_couleur("Beige foncé")[0] == "BEIF")
    ok &= _essai("Ecru accentue donne ECR", code_couleur("Écru")[0] == "ECR")
    ok &= _essai("l'arabe اسود donne NOI", code_couleur("اسود")[0] == "NOI")
    ok &= _essai("Blanc et Bleu ne donnent pas le meme code",
                 code_couleur("Blanc")[0] != code_couleur("Bleu")[0])
    ok &= _essai("une couleur inconnue est signalee comme inconnue",
                 code_couleur("Zzzz")[1] is False)
    # ET LE MESSAGE DOIT ARRIVER A L'ECRAN. Le drapeau « inconnue » etait
    # bien rendu, mais aucun appelant ne l'affichait : le controle ne
    # regardait que la valeur de retour, donc il ne voyait pas le silence.
    import io as _io
    import contextlib as _ct
    tampon = _io.StringIO()
    with _ct.redirect_stdout(tampon):
        dis_avertissements_couleurs([{"nom": "Zzzz"}])
    vu = tampon.getvalue()
    ok &= _essai("une couleur inconnue est VRAIMENT ecrite a l'ecran",
                 "Zzzz" in vu and "ATTENTION" in vu, repr(vu))
    tampon = _io.StringIO()
    with _ct.redirect_stdout(tampon):
        dis_avertissements_couleurs([{"nom": "Noir"}, {"nom": "Beige"}])
    ok &= _essai("une couleur connue ne declenche aucune fausse alarme",
                 tampon.getvalue() == "", repr(tampon.getvalue()))

    # --- le nettoyage des SKU ------------------------------------------
    ok &= _essai("une ESPACE est retiree du SKU",
                 nettoie_sku("FMC BRN TAIL 1") == "FMC-BRN-TAIL-1")
    ok &= _essai("un accent est retire du SKU",
                 nettoie_sku("ECRÜ") == "ECRU")
    ok &= _essai("les minuscules deviennent majuscules",
                 nettoie_sku("shop-m01") == "SHOP-M01")

    # --- la matrice ----------------------------------------------------
    coul2 = [{"nom": "Noir", "hex": "#141414"}, {"nom": "Beige", "hex": "#C9BC94"}]
    t6 = TAILLES["lettres-complete"][1]

    m = fabrique_matrice("SHOP", "M05", coul2, t6, "par-taille")
    ok &= _essai("par-taille : 2 couleurs x 6 tailles = 12 variantes",
                 len(m) == 12, "%d" % len(m))
    ok &= _essai("par-taille : 12 SKU tous differents",
                 len(set(x["sku"] for x in m)) == 12)
    ok &= _essai("par-taille : le SKU a la bonne forme",
                 m[0]["sku"] == "SHOP-M05-NOI-S", m[0]["sku"])

    m = fabrique_matrice("SHOP", "M05", coul2, t6, "groupe2")
    ok &= _essai("groupe2 : toujours 12 variantes (une par taille reelle)",
                 len(m) == 12, "%d" % len(m))
    ok &= _essai("groupe2 : seulement 6 SKU (partages deux par deux)",
                 len(set(x["sku"] for x in m)) == 6,
                 "%d" % len(set(x["sku"] for x in m)))
    ok &= _essai("groupe2 : S et M partagent le meme SKU",
                 [x for x in m if x["couleur"] == "Noir" and x["taille"] == "S"][0]["sku"]
                 == [x for x in m if x["couleur"] == "Noir" and x["taille"] == "M"][0]["sku"])
    ok &= _essai("groupe2 : Noir et Beige NE partagent PAS le SKU",
                 [x for x in m if x["couleur"] == "Noir" and x["taille"] == "S"][0]["sku"]
                 != [x for x in m if x["couleur"] == "Beige" and x["taille"] == "S"][0]["sku"])
    ok &= _essai("groupe2 : chaque taille reste visible une par une",
                 sorted(set(x["taille_visible"] for x in m)) == sorted(set(t6)))
    ok &= _essai("groupe2 : la matrice ne signale aucun probleme",
                 controle_matrice(m, coul2, t6, "groupe2") == [],
                 str(controle_matrice(m, coul2, t6, "groupe2")))

    m = fabrique_matrice("SHOP", "M05", coul2, t6, "groupe2-affiche")
    ok &= _essai("groupe2-affiche : 2 couleurs x 3 groupes = 6 variantes",
                 len(m) == 6, "%d" % len(m))
    ok &= _essai("groupe2-affiche : la taille visible est le groupe",
                 m[0]["taille_visible"] == "Taille 1 (S-M)", str(m[0]["taille_visible"]))

    # LES SKU DE LA SPEC, recopies a la lettre depuis son fichier
    m = fabrique_matrice("SHOP", "M05", [{"nom": "Noir"}], t6, "groupe2")
    skus = []
    for x in m:
        if x["sku"] not in skus:
            skus.append(x["sku"])
    ok &= _essai("spec lettres : SM / LXL / 2XL3XL",
                 skus == ["SHOP-M05-NOI-SM", "SHOP-M05-NOI-LXL",
                          "SHOP-M05-NOI-2XL3XL"], str(skus))
    t12 = TAILLES["chiffres-complete"][1]
    m = fabrique_matrice("SHOP", "M06", [{"nom": "Noir"}], t12, "groupe2")
    skus = []
    for x in m:
        if x["sku"] not in skus:
            skus.append(x["sku"])
    ok &= _essai("spec chiffres : 36-38 / 40-42 / ... / 56-58",
                 skus == ["SHOP-M06-NOI-36-38", "SHOP-M06-NOI-40-42",
                          "SHOP-M06-NOI-44-46", "SHOP-M06-NOI-48-50",
                          "SHOP-M06-NOI-52-54", "SHOP-M06-NOI-56-58"], str(skus))

    # une taille restee SEULE : la spec dit DEMANDER, pas decider
    refuse = False
    try:
        fabrique_matrice("SHOP", "M07", [{"nom": "Noir"}],
                         TAILLES["chiffres-46-58"][1], "groupe2")
    except ValueError as e:
        refuse = "restent SEULES" in str(e)
    ok &= _essai("une taille seule ARRETE l'outil et fait poser la question",
                 refuse)

    # et avec la reponse « fais-lui son propre SKU », ca passe
    m = fabrique_matrice("SHOP", "M07", [{"nom": "Noir"}],
                         TAILLES["chiffres-46-58"][1], "groupe2",
                         orphelin_seul=True)
    skus = []
    for x in m:
        if x["sku"] not in skus:
            skus.append(x["sku"])
    ok &= _essai("reponse « SKU seul » : 46 toute seule, puis les paires",
                 skus == ["SHOP-M07-NOI-46", "SHOP-M07-NOI-48-50",
                          "SHOP-M07-NOI-52-54", "SHOP-M07-NOI-56-58"], str(skus))

    # les paires fixes ne bougent pas quand la liste est incomplete
    m = fabrique_matrice("SHOP", "M08", [{"nom": "Noir"}],
                         TAILLES["chiffres-44"][1], "groupe2",
                         orphelin_seul=True)
    skus = []
    for x in m:
        if x["sku"] not in skus:
            skus.append(x["sku"])
    ok &= _essai("36-44 : les paires restent 36-38 / 40-42, et 44 seule",
                 skus == ["SHOP-M08-NOI-36-38", "SHOP-M08-NOI-40-42",
                          "SHOP-M08-NOI-44"], str(skus))

    m = fabrique_matrice("SHOP", "M05", coul2, t6, "unique")
    ok &= _essai("unique : un SKU par couleur seulement",
                 len(set(x["sku"] for x in m)) == 2, "%d" % len(set(x["sku"] for x in m)))

    m = fabrique_matrice("SHOP", "M05", coul2, t6, "perso", "S+M, L+XL, 2XL+3XL")
    ok &= _essai("perso : 12 variantes, 6 SKU",
                 len(m) == 12 and len(set(x["sku"] for x in m)) == 6)

    # --- les refus de la matrice ---------------------------------------
    refuse = False
    try:
        lis_groupes_perso("S+M, M+L", t6)
    except ValueError as e:
        refuse = "DEUX groupes" in str(e)
    ok &= _essai("perso : une taille dans DEUX groupes est refusee", refuse)

    refuse = False
    try:
        lis_groupes_perso("S+M", t6)
    except ValueError as e:
        refuse = "aucun groupe" in str(e)
    ok &= _essai("perso : une taille oubliee est refusee", refuse)

    refuse = False
    try:
        lis_groupes_perso("S+M, L+XL, 2XL+ZZ", t6)
    except ValueError as e:
        refuse = "n'est pas dans les tailles" in str(e)
    ok &= _essai("perso : une taille inventee est refusee", refuse)

    # LE CONTROLE DU CONTROLE, deuxieme fois : on ENLEVE une variante de la
    # matrice et on verifie que le trou est vu. Un controle qui ne trouve
    # jamais rien n'est pas un controle.
    troue = fabrique_matrice("SHOP", "M05", coul2, t6, "par-taille")[:-1]
    pb_trou = controle_matrice(troue, coul2, t6, "par-taille")
    ok &= _essai("une variante manquante est VRAIMENT attrapee",
                 any("il manque des variantes" in p for p in pb_trou), str(pb_trou))

    melange = controle_matrice(
        fabrique_matrice("SHOP", "M05", coul2, ["S", "38"], "par-taille"),
        coul2, ["S", "38"], "par-taille")
    ok &= _essai("lettres + chiffres melangees sont signalees",
                 any("melangent" in p for p in melange), str(melange))

    # Le vrai piege du terrain : « Bleu » et « Bleu ciel » donnent tous les
    # deux BLE, donc le MEME SKU pour deux couleurs differentes.
    deux_bleus = [{"nom": "Bleu"}, {"nom": "Bleu ciel"}]
    doublon = controle_matrice(
        fabrique_matrice("SHOP", "M05", deux_bleus, ["S"], "par-taille"),
        deux_bleus, ["S"], "par-taille")
    # LOI DU VENDEUR (10/10/2026) : deux familles DISTINCTES ne font jamais tomber la page. Sur son vrai
    # lot, « Marron »/« Marron clair » et « Gris »/« Gris clair » retombaient sur le meme code : trois pages
    # sur quatre perdues. Leurs codes sont DEPARTAGES (une lettre de plus), et c'est DIT.
    ok &= _essai("deux couleurs au meme code de depart : aucune faute, deux SKU distincts",
                 doublon == [] and len({l["sku"] for l in fabrique_matrice(
                     "SHOP", "M05", deux_bleus, ["S"], "par-taille")}) == 2, str(doublon))
    ok &= _essai("et le departage est DIT (couleur gardee, code distinct)",
                 any("departage" in l and "Bleu ciel" in l
                     for l in avertissements_couleurs(deux_bleus)),
                 str(avertissements_couleurs(deux_bleus))[:120])
    # Des noms TAPES A LA MAIN (hors table, par le vendeur ou le client) qui se percutent.
    tapes = [[{"nom": "Gris perle"}, {"nom": "Gris anthracite"}],
             [{"nom": "Marron"}, {"nom": "Marron glace"}, {"nom": "Marron chocolat"}],
             [{"nom": "Rose poudre"}, {"nom": "Rose fuchsia"}, {"nom": "Rose"}, {"nom": "Rosee"}],
             [{"nom": "Noir"}, {"nom": "Noir chic"}, {"nom": "Noir clair"}],
             [{"nom": "Grenat"}, {"nom": "Gris"}, {"nom": "Gris clair"}, {"nom": "Gr"}]]
    fautes_tapes = []
    for cs in tapes:
        for mode_t, tl in (("par-taille", ["S", "M"]), ("groupe2", ["S", "M"]), ("par-taille", [])):
            try:
                mt = fabrique_matrice("SHOP", "M05", cs, tl, mode_t)
                pbt = controle_matrice(mt, cs, tl, mode_t)
                sku_par_couleur = {}
                for l in mt:
                    sku_par_couleur.setdefault(l["sku"], set()).add(l["couleur"])
                if pbt or any(len(v) > 1 for v in sku_par_couleur.values()):
                    fautes_tapes.append("%s/%s : %s" % ([c["nom"] for c in cs], mode_t, pbt[:1]))
            except ValueError as e:
                fautes_tapes.append("%s/%s : REFUS %s" % ([c["nom"] for c in cs], mode_t, e))
    ok &= _essai("noms tapes a la main qui se percutent : chaque famille gardee, codes distincts",
                 fautes_tapes == [], "; ".join(fautes_tapes)[:160])
    ok &= _essai("le departage est deterministe (meme entree, memes codes)",
                 codes_couleurs(tapes[2]) == codes_couleurs([dict(c) for c in tapes[2]]))
    ok &= _essai("le premier nom garde son code de depart (Gris reste GRI)",
                 codes_couleurs(tapes[4])["Gris"] == "GRI"
                 and codes_couleurs(tapes[4])["Gris clair"] == "GRIC")

    # L'AUTRE PIEGE, CELUI QUI PASSAIT : le MEME nom ecrit deux fois avec
    # deux hexadecimaux. Quatre variantes au lieu de deux, et le stock double.
    # UNE COULEUR QUI NE LAISSE AUCUNE LETTRE DANS UN SKU.
    ok &= _essai("une couleur arabe DE LA TABLE garde son code",
                 code_couleur_sku("اسود")[0] == "NOI")
    ok &= _essai("une couleur arabe HORS table ne laisse rien dans le SKU",
                 code_couleur_sku("فيروزي")[0] == ""
                 and code_couleur_sku("فيروزي")[2] is not None)
    refuse = ""
    try:
        fabrique_matrice("ZHR", "K38", [{"nom": "فيروزي"}], ["S"],
                         "par-taille")
    except ValueError as e:
        refuse = str(e)
    ok &= _essai("la couleur effacee ARRETE l'outil au lieu de sortir du SKU",
                 "ne laisse aucune lettre utilisable" in refuse, refuse[:70])
    deux_ar = [{"nom": "فيروزي"}, {"nom": "بنفسجي"}]
    pb_ar = controle_matrice([], deux_ar, ["S"], "par-taille")
    ok &= _essai("et le diagnostic NOMME la cause, pas un faux doublon",
                 len(pb_ar) == 2
                 and all("ne laisse aucune lettre" in p for p in pb_ar)
                 and not any("c'est un vrai doublon" in p for p in pb_ar),
                 str(pb_ar)[:80])

    deux_corail = [{"nom": "Corail", "hex": "#F26B5E"},
                   {"nom": "Corail", "hex": "#E0574A"}]
    pb_corail = controle_matrice(
        fabrique_matrice("SHOP", "M05", deux_corail, ["S"], "par-taille"),
        deux_corail, ["S"], "par-taille")
    ok &= _essai("deux couleurs du MEME NOM sont signalees",
                 any("DEUX fois" in p for p in pb_corail), str(pb_corail))
    refuse = False
    try:
        lis_couleurs("Corail:#F26B5E, Corail:#E0574A")
    except ValueError as e:
        refuse = "DEUX fois" in str(e)
    ok &= _essai("et la lecture des couleurs les refuse tout de suite", refuse)
    ok &= _essai("deux couleurs de noms differents passent toujours",
                 len(lis_couleurs("Noir:#141414, Beige:#C9BC94")) == 2)

    # --- le stock ------------------------------------------------------
    st = lis_stock("S:8,M:12,L:10,XL:7,2XL:5,3XL:4", coul2, t6, True)
    ok &= _essai("stock court : chaque couleur x taille est remplie",
                 len(st) == 12 and st["Noir/S"] == 8 and st["Beige/S"] == 8)
    st = lis_stock("Noir/S:8,Noir/M:12,Noir/L:1,Noir/XL:1,Noir/2XL:1,Noir/3XL:1,"
                   "Beige/S:4,Beige/M:2,Beige/L:1,Beige/XL:1,Beige/2XL:1,Beige/3XL:1",
                   coul2, t6)
    ok &= _essai("stock long : les couleurs ont des valeurs differentes",
                 st["Noir/S"] == 8 and st["Beige/S"] == 4)
    refuse = False
    try:
        lis_stock("S:8", coul2, t6, True)
    except ValueError as e:
        refuse = "il manque le stock" in str(e)
    ok &= _essai("un stock manquant est refuse", refuse)
    refuse = False
    try:
        lis_stock("S:huit,M:1,L:1,XL:1,2XL:1,3XL:1", coul2, t6, True)
    except ValueError as e:
        refuse = "pas un nombre entier" in str(e)
    ok &= _essai("un stock qui n'est pas un nombre est refuse", refuse)
    st = lis_stock("S:0,M:1,L:1,XL:1,2XL:1,3XL:1", coul2, t6, True)
    ok &= _essai("un stock a zero est accepte", st["Noir/S"] == 0)

    # AUCUN MORCEAU DE STOCK NE PART EN SILENCE. Une taille qui n'est pas
    # dans la configuration etait ignoree sans un mot, et l'ecran disait
    # quand meme « stock renseigne ... OK ».
    refuse = ""
    try:
        lis_stock("Noir/S:8,Noir/M:1,Noir/L:1,Noir/XL:1,Noir/2XL:1,"
                  "Noir/3XL:1,Beige/S:4,Beige/M:1,Beige/L:1,Beige/XL:1,"
                  "Beige/2XL:1,Beige/3XL:1,Noir/XXL:40", coul2, t6)
    except ValueError as e:
        refuse = str(e)
    ok &= _essai("une cle de stock hors configuration est REFUSEE et NOMMEE",
                 "Noir/XXL" in refuse and "40 pieces" in refuse, refuse[:90])

    # UN PRODUIT SANS TAILLE declare son stock par COULEUR. Le garde-fou
    # prenait ces cles-couleur pour des cles-taille : il refusait, et son
    # correctif (« ecris Noir/1:20 ») etait impossible a suivre.
    deux = [{"nom": "Olive"}, {"nom": "Lilas"}]
    st = lis_stock("Olive:20,Lilas:14", deux, [])
    ok &= _essai("sans tailles : une cle sans « / » est une cle-COULEUR",
                 st == {"Olive": 20, "Lilas": 14}, str(st))
    refuse = ""
    try:
        lis_stock("unique:20", deux, [])
    except ValueError as e:
        refuse = str(e)
    ok &= _essai("sans tailles : un nombre qui ne nomme pas sa couleur reste "
                 "AMBIGU", "AMBIGU" in refuse, refuse[:70])
    ok &= _essai("et le correctif propose est ECRIVABLE (pas de taille "
                 "inventee)", "Olive:20" in refuse and "/" not in refuse,
                 refuse[-70:])
    # LA CLE DU STOCK DOIT ETRE CELLE QUE PORTE LA LIGNE, DANS TOUS LES
    # MODES. C'est le controle qui manquait : en mode « unique » la ligne
    # porte « S+M+L+XL+2XL+3XL » et la cle cherchee etait « couleur/S ».
    for mode_essai in ("par-taille", "groupe2", "groupe2-affiche", "unique"):
        mm = fabrique_matrice("SHOP", "M05", coul2, t6, mode_essai)
        base_essai = [x for x in sorted(set(l["taille"] for l in mm)) if x]
        stk = lis_stock(",".join("%s/%s:3" % (c["nom"], b)
                                 for c in coul2 for b in base_essai),
                        coul2, base_essai)
        perdues = [l for l in mm
                   if stk.get("%s/%s" % (l["couleur"], l["taille"])) is None]
        ok &= _essai("mode %s : chaque ligne retrouve son stock" % mode_essai,
                     perdues == [], "%d lignes sur %d sans stock"
                     % (len(perdues), len(mm)))

    refuse = ""
    try:
        lis_stock("Olive:20,Turquoise:14", deux, [])
    except ValueError as e:
        refuse = str(e)
    ok &= _essai("sans tailles : une couleur etrangere au produit est "
                 "refusee", "Turquoise" in refuse, refuse[:70])

    # --- l'alternance des couleurs, LE controle central ----------------
    photos = ([{"couleur": "Blanc", "url": "b%d" % i} for i in range(4)] +
              [{"couleur": "Rouge", "url": "r%d" % i} for i in range(3)] +
              [{"couleur": "Noir", "url": "n%d" % i} for i in range(3)])
    ordre, reste = alterne_couleurs(photos)
    ok &= _essai("alternance : toutes les photos sont classees",
                 len(ordre) == 10 and reste == [], "reste %d" % len(reste))
    ok &= _essai("alternance : AUCUNE couleur ne se suit",
                 controle_alternance(ordre) == [], str(controle_alternance(ordre)))

    # le cas ou c'est mathematiquement impossible : 5 blanches sur 6
    impossible = ([{"couleur": "Blanc", "url": "b%d" % i} for i in range(5)] +
                  [{"couleur": "Noir", "url": "n0"}])
    ordre2, reste2 = alterne_couleurs(impossible)
    ok &= _essai("alternance : l'impossible est DIT, pas cache",
                 len(reste2) > 0, "reste %d" % len(reste2))

    # deux couleurs a egalite : A B A B
    pair = ([{"couleur": "A", "url": "a%d" % i} for i in range(3)] +
            [{"couleur": "B", "url": "b%d" % i} for i in range(3)])
    ordre3, reste3 = alterne_couleurs(pair)
    ok &= _essai("alternance : deux couleurs a egalite donnent A B A B",
                 reste3 == [] and controle_alternance(ordre3) == [])

    # une seule couleur : rien a alterner, et on ne doit pas boucler
    seule = [{"couleur": "A", "url": "a%d" % i} for i in range(3)]
    o4, r4 = alterne_couleurs(seule)
    ok &= _essai("alternance : une seule couleur ne fait pas boucler l'outil",
                 len(o4) + len(r4) == 3)

    # photos sans couleur connue : on ne bloque pas
    sanscoul = [{"couleur": None, "url": "x%d" % i} for i in range(5)]
    o5, r5 = alterne_couleurs(sanscoul)
    ok &= _essai("alternance : des photos sans couleur passent quand meme",
                 len(o5) + len(r5) == 5 and controle_alternance(o5 + r5) == [])

    # LE CONTROLE DU CONTROLE : on lui donne un ordre VOLONTAIREMENT faux.
    # S'il ne le voit pas, c'est qu'il dit OK sans rien regarder.
    faux = [{"couleur": "A", "url": "1"}, {"couleur": "A", "url": "2"},
            {"couleur": "B", "url": "3"}, {"couleur": "B", "url": "4"}]
    trouve = controle_alternance(faux)
    ok &= _essai("alternance : un ordre faux est VRAIMENT attrape",
                 len(trouve) == 2 and trouve[0][1] == "A" and trouve[1][1] == "B",
                 str(trouve))

    # UNE SEULE COULEUR : RIEN A ALTERNER, DONC AUCUNE ALARME.
    ok &= _essai("une seule couleur : il n'y a rien a alterner",
                 rien_a_alterner(seule) is True)
    ok &= _essai("deux couleurs : il y a bien quelque chose a alterner",
                 rien_a_alterner(pair) is False)
    ok &= _essai("des photos sans couleur : rien a alterner non plus",
                 rien_a_alterner(sanscoul) is True)
    ok &= _essai("une seule couleur ne recoit aucun conseil a suivre",
                 conseil_alternance(seule) == [], str(conseil_alternance(seule)))
    conseil = conseil_alternance(impossible)
    ok &= _essai("l'impossible dit QUELLE couleur deborde et COMBIEN il "
                 "en manque",
                 any("Blanc" in l for l in conseil)
                 and any("3 photos" in l for l in conseil), str(conseil))
    ok &= _essai("un lot qui alterne deja ne recoit aucun conseil",
                 conseil_alternance(photos) == [],
                 str(conseil_alternance(photos)))

    # --- le prix -------------------------------------------------------
    ok &= _essai("prix sous dix mille : pas de lecture parlee",
                 prix_arabe(5900) == "5.900 دج", prix_arabe(5900))
    ok &= _essai("prix rond de cinquante mille : cinq millions",
                 "5 مليون" in prix_arabe(50000), prix_arabe(50000))
    ok &= _essai("prix de douze mille neuf cents : million et 290 mille",
                 "1 مليون و 290 ألف" in prix_arabe(12900), prix_arabe(12900))
    # SA LOI D'AFFICHAGE, appliquee aux PRIX et plus seulement a la question.
    # Elle n'etait controlee que sur le texte de la question : six des
    # vingt-et-un prix recommandes collaient leur chiffre a la lettre « و ».
    colles = [p for p in PRIX_LISTE + list(range(PRIX_MINI, PRIX_MAXI + 1, 100))
              if re.search(r"[\u0600-\u06ff]\d|\d[\u0600-\u06ff]", prix_arabe(p))]
    ok &= _essai("aucun chiffre colle a une lettre arabe dans un prix",
                 colles == [], "%d prix fautifs, dont %s" % (len(colles), colles[:3]))

    # --- les textes ----------------------------------------------------
    pb = controle_textes(["نص عادي", "هنا كلمة تحوّس"])
    ok &= _essai("un mot marocain dans un texte est attrape",
                 any("تحوّس" in p for p in pb), str(pb))
    pb = controle_textes(["الربح مضمون"])
    ok &= _essai("une promesse de gain est attrapee",
                 any("مضمون" in p for p in pb), str(pb))
    pb = controle_textes(["on paye en COD"])
    ok &= _essai("le mot COD est attrape",
                 any("COD" in p for p in pb), str(pb))
    pb = controle_textes(["on paye en Cod", "CoD a la livraison"])
    ok &= _essai("« Cod » et « CoD » sont attrapes comme « COD »",
                 len(pb) == 2, str(pb))
    ok &= _essai("le mot interdit est vu dans le NOM du produit",
                 mots_interdits_dans("Jupe ZHR COD") == ["COD"],
                 str(mots_interdits_dans("Jupe ZHR COD")))
    ok &= _essai("le mot interdit est vu dans la LIGNE DE LIVRAISON",
                 mots_interdits_dans("Cod 600 DA") == ["COD"],
                 str(mots_interdits_dans("Cod 600 DA")))
    ok &= _essai("un nom propre ne declenche aucune fausse alarme",
                 mots_interdits_dans("Jupe plissee ZHR") == [])
    pb = controle_textes(["a\nb\nc\nd\ne\nf\ng"])
    ok &= _essai("un pave de plus de six lignes est attrape",
                 any("pave" in p for p in pb), str(pb))

    # --- la description ------------------------------------------------
    d = bati_description(ordre, ["un", "deux", "trois"], 5900)
    # 09/10/2026 : le minimum passe a PHOTOS_DESCRIPTION (5) couples ; avec
    # trois blocs seulement, l'alternance garde au plus une photo de plus
    # que de blocs (quatre), et couples_description le DIT.
    ok &= _essai("description : trois blocs -> quatre photos, jamais deux photos de suite",
                 d.count("<img") == 4, "%d" % d.count("<img"))
    d5 = bati_description(ordre, ["un", "deux", "trois", "quatre", "cinq"], 5900)
    ok &= _essai("description : cinq blocs -> CINQ couples photo/texte (le minimum du vendeur)",
                 d5.count("<img") == PHOTOS_DESCRIPTION == 5
                 and couples_description(ordre, ["a"] * 5) == (5, ""),
                 "%d" % d5.count("<img"))
    c3, dit3 = couples_description(ordre, ["a", "b", "c"])
    ok &= _essai("description : moins de cinq couples est DIT",
                 c3 == 3 and "au lieu de 5" in dit3, dit3[:60])
    # l'ordre DONNE (--ordre-couleurs) est respecte : rotation dans cet ordre
    rot = ([{"couleur": "Noir", "url": "n%d" % i} for i in range(2)] +
           [{"couleur": "Beige", "url": "b%d" % i} for i in range(2)] +
           [{"couleur": "Rouge", "url": "r%d" % i} for i in range(2)] +
           [{"couleur": "Bleu", "url": "u%d" % i} for i in range(4)])
    o_rot, r_rot = alterne_couleurs(rot, ["Noir", "Beige", "Rouge", "Bleu"])
    ok &= _essai("ordre donne : noir, beige, rouge, bleu, puis ca repart, jamais deux fois la meme",
                 [p["couleur"] for p in o_rot][:5] == ["Noir", "Beige", "Rouge", "Bleu", "Noir"]
                 and controle_alternance(o_rot + r_rot) == [] and not r_rot,
                 ",".join(p["couleur"] for p in o_rot))
    o_old, _ = alterne_couleurs(rot)
    ok &= _essai("sans ordre : l'ancien comportement (la plus fournie d'abord) reste",
                 o_old[0]["couleur"] == "Bleu", o_old[0]["couleur"])
    # « --ordre-couleurs foncees » (decision du vendeur, 10/10/2026) : du
    # fonce au clair par la luminance (somme R+G+B) du hex, nommees a l'envers
    cf = lis_couleurs("Beige:#C9BC94, Bleu:#1F2A55, Noir:#141414")
    nf, df = ordre_fonce_clair(cf)
    ok &= _essai("ordre foncees : nommees Beige, Bleu, Noir -> Noir, Bleu, Beige",
                 nf == ["Noir", "Bleu", "Beige"] and df == "" and demande_foncees(" Foncees ")
                 and not demande_foncees("Noir,Beige"), ",".join(nf))
    ok &= _essai("ordre foncees : somme R+G+B (bleu roi #0000FF avant gris #646464)",
                 ordre_fonce_clair(lis_couleurs("Gris:#646464, Bleu roi:#0000FF"))[0]
                 == ["Bleu roi", "Gris"])
    ns, ds = ordre_fonce_clair(lis_couleurs("Beige:#C9BC94, Rouge, Noir:#141414"))
    ok &= _essai("ordre foncees : une couleur sans hex garde sa place, et c'est DIT",
                 ns == ["Noir", "Rouge", "Beige"] and "Rouge" in ds and "place" in ds,
                 ",".join(ns) + " / " + ds[:60])
    phf = ([{"couleur": "Beige", "url": "b%d" % i} for i in range(3)] +
           [{"couleur": "Noir", "url": "n%d" % i} for i in range(3)] +
           [{"couleur": "Bleu", "url": "u%d" % i} for i in range(2)])
    of, rf = alterne_couleurs(phf, nf)
    ok &= _essai("ordre foncees : la rotation (noir, bleu, beige, noir...), jamais deux fois la meme",
                 [p["couleur"] for p in of][:4] == ["Noir", "Bleu", "Beige", "Noir"]
                 and controle_alternance(of + rf) == [] and not rf and len(of) == 8,
                 ",".join(p["couleur"] for p in of))
    ok &= _essai("description : photo puis texte, en alternance",
                 d.index("<img") < d.index("un"))

    # LE CONTROLE DU CONTROLE : on relit la description finie sans rien
    # savoir de la facon dont elle a ete fabriquee, et on verifie qu'aucun
    # texte ne suit un texte (la derniere ligne, le prix, ne compte pas).
    def _forme_description(txt):
        vraies = [l for l in txt.split("\n") if l.strip()][:-1]
        return ["IMG" if l.startswith("<img") else "TXT" for l in vraies]
    forme = _forme_description(
        bati_description(ordre[:6], ["a", "b", "c", "d", "e", "f"], 5900))
    ok &= _essai("description : jamais DEUX textes de suite",
                 not any(forme[i] == "TXT" == forme[i - 1]
                         for i in range(1, len(forme))), " ".join(forme))
    refuse = False
    try:
        bati_description(ordre[:6], ["a", "b", "c", "d", "e", "f", "g"], 5900)
    except ValueError as e:
        refuse = "IMPOSSIBLE" in str(e)
    ok &= _essai("sept blocs pour six photos : REFUSE, au lieu de coller "
                 "deux textes", refuse)
    ok &= _essai("description : la ligne prix + livraison + paiement est la",
                 "الخلاص عند الاستلام" in d and "التوصيل" in d)

    # --- le paquet Tassyir ---------------------------------------------
    m = fabrique_matrice("SHOP", "M05", coul2, t6, "groupe2")
    ph = [{"couleur": "Noir", "url": "https://x/n1"},
          {"couleur": "Beige", "url": "https://x/b1"},
          {"couleur": "Noir", "url": "https://x/n2"}]
    pq = bati_paquet("robe", 5900, coul2, t6, m, ph, d)
    ok &= _essai("paquet : deux options, Couleur puis Taille",
                 [o["name"] for o in pq["options"]] == ["Couleur", "Taille"])
    ok &= _essai("paquet : la pastille couleur porte son hexadecimal",
                 pq["options"][0]["value"][0]["color"] == "#141414")
    ok &= _essai("paquet : une variante par combinaison",
                 len(pq["variants"]) == 12, "%d" % len(pq["variants"]))
    ok &= _essai("paquet : chaque variante a un prix",
                 all(v["price"] == 5900 for v in pq["variants"]))
    ok &= _essai("paquet : chaque variante a ses deux selectedOptions",
                 all(len(v["selectedOptions"]) == 2 for v in pq["variants"]))
    ok &= _essai("paquet : TOUTES les variantes naissent cachees",
                 all(v.get("isHidden") is True for v in pq["variants"]))
    ok &= _essai("paquet : la variante Noir porte la photo Noir",
                 [v for v in pq["variants"]
                  if v["selectedOptions"][0]["value"] == "Noir"][0]["image"] == "https://x/n1")
    ok &= _essai("paquet : la boutique est un trou a remplir, pas une invention",
                 pq["storeId"] == PLACE_BOUTIQUE)
    ok &= _essai("paquet : la galerie ne depasse pas la limite de Tassyir",
                 len(pq["gallery"]) <= GALERIE_MAXI_TASSYIR)
    ok &= _essai("paquet : il se transforme bien en JSON",
                 isinstance(json.dumps(pq, ensure_ascii=False), str))

    # produit sans couleur et sans taille : le cas le plus simple
    m0 = fabrique_matrice("SHOP", "M09", [], [], "unique")
    pq0 = bati_paquet("simple", 3900, [], [], m0, ph, "x")
    ok &= _essai("produit sans couleur ni taille : une seule variante",
                 len(pq0["variants"]) == 1 and pq0["options"] == [])

    # --- LA QUESTION OBLIGATOIRE ---------------------------------------
    ok &= _essai("la question EXPLIQUE ce qu'est un code, au debutant",
                 "DEBUTANT" in QUESTION and "SKU" in QUESTION)
    ok &= _essai("la question montre les DEUX facons de coder",
                 "كود لكل تاي" in QUESTION and "كود على زوج تايات" in QUESTION)
    ok &= _essai("la question montre un VRAI exemple de chaque",
                 "SHOP-M05-NOI-S " in QUESTION
                 and "SHOP-M05-NOI-SM " in QUESTION)
    ok &= _essai("la question dit ce que chaque choix CHANGE pour lui",
                 "قراءة أدق" in QUESTION and "أسهل مع الخياط" in QUESTION)
    ok &= _essai("la question promet que le stock reste taille par taille",
                 "محسوب تاي بتاي" in QUESTION)
    ok &= _essai("la question dit de REEXPLIQUER s'il ne comprend pas",
                 "reexpliques" in QUESTION)
    ok &= _essai("la question montre les DEUX familles de tailles",
                 "S   M   L   XL   2XL   3XL" in QUESTION
                 and "36  38  40  42  44  46  48  50  52  54  56  58" in QUESTION)
    ok &= _essai("la question dit de NE JAMAIS repondre a la place du client",
                 "JAMAIS A SA PLACE" in QUESTION.upper())
    ok &= _essai("la question dit de REDEMANDER a chaque produit",
                 "redemandes" in QUESTION)
    # SA LOI D'AFFICHAGE : un chiffre au milieu d'une ligne arabe s'affiche
    # a l'envers chez lui. Les chiffres vont sur des lignes a eux, en
    # francais. Ce controle a deja attrape une faute reelle.
    fautives = [l for l in QUESTION.splitlines()
                if any("\u0600" <= c <= "\u06ff" for c in l)
                and any(c.isdigit() for c in l)]
    ok &= _essai("aucun chiffre colle dans une ligne arabe de la question",
                 fautives == [], str(fautives))

    # --- LE STOCK QUI SE RECOMPTE --------------------------------------
    ok &= _essai("confirmee = sortie de l'etagere",
                 classe_commande("confirmed") == "sorti")
    ok &= _essai("livree = sortie", classe_commande("delivered") == "sorti")
    ok &= _essai("en attente = RESERVEE, pas deduite",
                 classe_commande("pending") == "reserve")
    ok &= _essai("annulee = rien", classe_commande("canceled") == "rien")
    ok &= _essai("retour = revient en stock",
                 classe_commande("returned") == "retour")
    ok &= _essai("un statut INCONNU n'est jamais deduit en silence",
                 classe_commande("bidule") == "inconnu")
    ok &= _essai("un statut vide n'est jamais deduit non plus",
                 classe_commande("") == "inconnu")

    fiche = {"produit": "essai", "lignes": [
        {"couleur": "Noir", "taille": "S", "taille_visible": "S",
         "sku": "X-NOI-SM", "stock_depart": 8, "variantId": "V1"},
        {"couleur": "Noir", "taille": "M", "taille_visible": "M",
         "sku": "X-NOI-SM", "stock_depart": 12, "variantId": "V2"},
        {"couleur": "Beige", "taille": "S", "taille_visible": "S",
         "sku": "X-BEI-SM", "stock_depart": 4, "variantId": "V3"}]}
    cmds = [{"variantId": "V1", "quantity": 3, "statut": "confirmed"},
            {"variantId": "V1", "quantity": 5, "statut": "pending"},
            {"variantId": "V1", "quantity": 1, "statut": "returned"},
            {"variantId": "V2", "quantity": 2, "statut": "canceled"},
            {"variantId": "V3", "quantity": 1, "statut": "bidule"},
            {"variantId": "V9", "quantity": 7, "statut": "delivered"}]
    f2, orph = recompte(json.loads(json.dumps(fiche)), cmds)
    L = {l["variantId"]: l for l in f2["lignes"]}
    ok &= _essai("le S noir : 8 moins 3 vendus plus 1 retour = 6",
                 L["V1"]["stock_restant"] == 6, L["V1"]["stock_restant"])
    ok &= _essai("les 5 en attente ne sont PAS deduites",
                 L["V1"]["reserve"] == 5 and L["V1"]["sorti"] == 3)
    ok &= _essai("une commande ANNULEE ne touche pas le stock",
                 L["V2"]["stock_restant"] == 12)
    ok &= _essai("un statut inconnu ne touche pas le stock",
                 L["V3"]["stock_restant"] == 4 and L["V3"]["inconnu"] == 1)
    ok &= _essai("LE COEUR : commander le S ne baisse PAS le M",
                 L["V1"]["stock_restant"] == 6 and L["V2"]["stock_restant"] == 12)
    ok &= _essai("une variante commandee hors fiche est SIGNALEE",
                 orph == ["V9"], str(orph))

    # le branchement des identifiants
    produit = {"variants": [
        {"id": "T1", "selectedOptions": [{"name": "Couleur", "value": "Noir"},
                                         {"name": "Taille", "value": "S"}]},
        {"id": "T2", "selectedOptions": [{"name": "Couleur", "value": "Noir"},
                                         {"name": "Taille", "value": "M"}]},
        {"id": "T3", "selectedOptions": [{"name": "Couleur", "value": "Beige"},
                                         {"name": "Taille", "value": "S"}]}]}
    f3 = json.loads(json.dumps(fiche))
    for l in f3["lignes"]:
        l.pop("variantId")
    n_ok, manq = branche_variantes(f3, produit)
    ok &= _essai("les 3 lignes se branchent sur les vraies variantes",
                 n_ok == 3 and manq == [], str(manq))
    ok &= _essai("le branchement se fait sur couleur + taille, pas sur le SKU",
                 f3["lignes"][0]["variantId"] == "T1"
                 and f3["lignes"][1]["variantId"] == "T2")
    f4 = json.loads(json.dumps(fiche))
    for l in f4["lignes"]:
        l.pop("variantId")
    f4["lignes"].append({"couleur": "Rouge", "taille": "S",
                         "taille_visible": "S", "sku": "X-ROU-SM",
                         "stock_depart": 2})
    n_ok, manq = branche_variantes(f4, produit)
    ok &= _essai("une ligne qui ne trouve pas sa variante est SIGNALEE",
                 len(manq) == 1 and "Rouge" in manq[0], str(manq))

    # la lecture des commandes refuse ce qui est abime
    import tempfile as _tf
    with _tf.TemporaryDirectory() as t2:
        c = os.path.join(t2, "c.json")
        with open(c, "w", encoding="utf-8") as f:
            json.dump({"lignes": [{"variantId": "V1", "quantity": 2,
                                   "statut": "confirmed"}]}, f)
        ok &= _essai("les commandes se lisent", len(lis_commandes(c)) == 1)
        with open(c, "w", encoding="utf-8") as f:
            json.dump([{"quantity": 2, "statut": "confirmed"}], f)
        refuse = False
        try:
            lis_commandes(c)
        except ValueError as e:
            refuse = "variantId" in str(e)
        ok &= _essai("une ligne sans variantId est refusee", refuse)
        with open(c, "w", encoding="utf-8") as f:
            json.dump([{"variantId": "V1", "quantity": -3}], f)
        refuse = False
        try:
            lis_commandes(c)
        except ValueError as e:
            refuse = "negative" in str(e)
        ok &= _essai("une quantite negative est refusee", refuse)

    # --- LE REGLAGE DU CLIENT ------------------------------------------
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        ok &= _essai("sans fichier, aucun reglage", lis_reglage(tmp) == {})
        chemin = ecris_reglage(tmp, "chiffres-52", "groupe2", "seul")
        ok &= _essai("le reglage s'ecrit la ou on le demande",
                     os.path.exists(chemin))
        r = lis_reglage(tmp)
        ok &= _essai("le reglage se relit tel qu'il a ete ecrit",
                     r.get("tailles") == "chiffres-52"
                     and r.get("mode") == "groupe2"
                     and r.get("orphelin") == "seul", str(r))
        ok &= _essai("le reglage dit OU il est range",
                     r.get("_fichier") == chemin)
        # une ligne effacee = la question revient pour CETTE ligne
        with open(chemin, "r", encoding="utf-8") as f:
            texte = f.read()
        with open(chemin, "w", encoding="utf-8") as f:
            f.write("\n".join(l for l in texte.splitlines()
                              if not l.strip().startswith("mode")))
        r = lis_reglage(tmp)
        ok &= _essai("une ligne effacee disparait vraiment du reglage",
                     "mode" not in r and r.get("tailles") == "chiffres-52",
                     str(r))
        ok &= _essai("le fichier de reglage explique comment le changer",
                     "repose la question" in texte)
        ok &= _essai("le fichier de reglage liste les valeurs possibles",
                     "groupe2" in texte and "par-taille" in texte
                     and "chiffres-complete" in texte)
        # un reglage a moitie ecrit ne doit pas faire tomber l'outil
        with open(chemin, "w", encoding="utf-8") as f:
            f.write("tailles=\nmode = \n# rien\nnimporte quoi\n")
        ok &= _essai("un reglage abime ne fait pas tomber l'outil",
                     lis_reglage(tmp).get("tailles") is None)

    # --- LE VRAI PARCOURS, DE BOUT EN BOUT ------------------------------
    # Tout ce qui precede regarde des fonctions, une par une. Ici on lance
    # la VRAIE commande --produit et on lit ce qui sort A L'ECRAN et sur le
    # disque. C'est le seul controle qui voit la difference entre une regle
    # qui REFUSE et une regle qui se contente d'etre imprimee — la faute
    # qui laissait partir une page avec trois photos blanches d'affilee.
    import io as _io3
    import contextlib as _ct3
    import tempfile as _tf3

    def _lance_produit(**reglages):
        """Lance --produit pour de vrai. Rend (code de sortie, ecran, fichiers)."""
        with _tf3.TemporaryDirectory() as d:
            champs = dict(nom="Robe d'essai", boutique="SHOP", boutique_id=None,
                          modele="M99", prix=5900, couleurs="Noir:#141414",
                          tailles="lettres-courte", tailles_perso="",
                          mode="par-taille", groupes=None, orphelin="",
                          stock="", stock_par_couleur=False, photos="",
                          textes="un\n\ndeux\n\ntrois", livraison=None,
                          sortie=d, json=False)
            champs.update(reglages)
            tampon = _io3.StringIO()
            with _ct3.redirect_stdout(tampon):
                code = commande_produit(argparse.Namespace(**champs))
            fichiers = {}
            for f in ("stock.json", "description.txt"):
                chemin = os.path.join(d, f)
                if os.path.exists(chemin):
                    with open(chemin, "r", encoding="utf-8") as fh:
                        fichiers[f] = fh.read()
            return code, tampon.getvalue(), fichiers

    six_olive = ",".join("Olive|https://x/o%d" % i for i in range(6))
    cinq_blanc = ",".join("Blanc|https://x/w%d" % i for i in range(5)) \
        + ",Noir|https://x/n0"
    deux_coul = ",".join(("Noir|https://x/n%d" % i) if i % 2 == 0
                         else ("Prune|https://x/p%d" % i) for i in range(6))

    code, ecran, _ = _lance_produit(photos=six_olive, couleurs="Olive:#6B7A3A")
    ok &= _essai("bout en bout : un produit d'UNE SEULE couleur passe",
                 code == 0, "code %d" % code)
    ok &= _essai("bout en bout : et sans la moindre fausse alarme",
                 "se suivent" not in ecran and "IMPOSSIBLE" not in ecran,
                 ecran[-160:])

    code, ecran, _ = _lance_produit(photos=cinq_blanc,
                                    couleurs="Blanc:#FFFFFF, Noir:#141414")
    ok &= _essai("bout en bout : une alternance impossible REFUSE (code 2)",
                 code == 2, "code %d" % code)
    ok &= _essai("et le refus dit QUELLE couleur et COMBIEN de photos ajouter",
                 "Blanc" in ecran and "3 photos" in ecran, ecran[-200:])

    code, ecran, _ = _lance_produit(
        photos=deux_coul, couleurs="Noir:#141414, Prune:#7B3F61",
        stock="Noir/S:1,Noir/M:1,Noir/L:1,Noir/XL:1,"
              "Prune/S:1,Prune/M:1,Prune/L:1,Prune/XL:1")
    ok &= _essai("bout en bout : l'avertissement « couleur hors table » "
                 "ARRIVE a l'ecran",
                 code == 0 and "Prune" in ecran and "ATTENTION" in ecran,
                 "code %d" % code)

    code, ecran, fichiers = _lance_produit(
        photos=deux_coul, couleurs="Noir:#141414, Beige:#C9BC94",
        mode="unique", stock="Noir/S+M+L+XL:28,Beige/S+M+L+XL:10")
    ok &= _essai("bout en bout : en mode unique le stock ARRIVE dans "
                 "stock.json",
                 code == 0
                 and '"stock_depart": 28' in fichiers.get("stock.json", "")
                 and '"stock_depart": null' not in fichiers.get("stock.json", ""),
                 "code %d" % code)
    ok &= _essai("bout en bout : et l'ecran annonce le VRAI total",
                 "38 pieces en tout" in ecran, ecran[-200:])

    code, ecran, _ = _lance_produit(photos=six_olive, couleurs="Olive:#6B7A3A",
                                    nom="Jupe SHOP Cod", livraison="Cod 600 DA")
    ok &= _essai("bout en bout : « Cod » dans le nom ET dans la livraison "
                 "REFUSE",
                 code == 2 and ecran.count("interdit") == 2, "code %d" % code)

    code, ecran, _ = _lance_produit(
        photos=six_olive, couleurs="Olive:#6B7A3A",
        stock="Olive/S:4,Olive/M:6,Olive/L:8,Olive/XL:10,Olive/XXL:40")
    ok &= _essai("bout en bout : une taille de stock hors configuration "
                 "REFUSE",
                 code == 2 and "Olive/XXL" in ecran, "code %d" % code)

    print("-" * 62)
    if ok:
        print("TOUT EST BON.")
    else:
        print("UN CONTROLE A RATE. Ne te sers pas de l'outil avant de me le dire.")
    print("")
    return 0 if ok else 1


# ----------------------------------------------------------------------------
# PARTIE 11 — LA COMMANDE
# ----------------------------------------------------------------------------

def lis_couleurs(txt):
    """« Noir:#141414, Beige:#C9BC94 »  ou  « Noir, Beige »."""
    if not txt:
        return []
    out = []
    for bloc in txt.split(","):
        bloc = bloc.strip()
        if not bloc:
            continue
        if ":" in bloc:
            nom, hexa = bloc.split(":", 1)
            hexa = hexa.strip()
            if not re.fullmatch(r"#[0-9A-Fa-f]{6}", hexa):
                raise ValueError("le code couleur de « %s » doit ressembler a "
                                 "#141414, pas a « %s »" % (nom.strip(), hexa))
            out.append({"nom": nom.strip(), "hex": hexa})
        else:
            out.append({"nom": bloc, "hex": None})

    # DEUX COULEURS DU MEME NOM NE SONT PAS DEUX COULEURS.
    vus = set()
    for c in out:
        cle = _sans_accent(c["nom"]).strip().lower()
        if cle in vus:
            raise ValueError(
                "la couleur « %s » est ecrite DEUX fois. Elles fabriquent "
                "les memes variantes, le meme SKU, et DOUBLENT le stock.\n"
                "        Donne-leur des noms differents (« Corail clair », "
                "« Corail fonce »), ou n'en garde qu'une." % c["nom"])
        vus.add(cle)
    return out


def commande_produit(a):
    erreurs = []

    # --- le nom --------------------------------------------------------
    nom = (a.nom or "").strip()
    if not (3 <= len(nom) <= 80):
        erreurs.append("le nom du produit doit faire entre 3 et 80 caracteres")
    for mot in mots_interdits_dans(nom):
        erreurs.append("le nom du produit contient « %s » — interdit. Ce mot "
                       "part dans le TITRE de la page." % mot)

    # --- la ligne de livraison -----------------------------------------
    # Elle finit en DERNIERE ligne de la description : elle se filtre
    # comme un texte d'angle, ni plus ni moins.
    for mot in mots_interdits_dans(a.livraison):
        erreurs.append("--livraison contient « %s » — interdit. Cette ligne "
                       "est la DERNIERE de la description." % mot)

    # --- le prix -------------------------------------------------------
    if a.prix < PRIX_MINI or a.prix > PRIX_MAXI:
        erreurs.append("le prix doit etre entre %d et %d DA (tu as mis %d)"
                       % (PRIX_MINI, PRIX_MAXI, a.prix))

    # --- les couleurs --------------------------------------------------
    try:
        couleurs = lis_couleurs(a.couleurs)
    except ValueError as e:
        erreurs.append(str(e))
        couleurs = []

    # --- LE REGLAGE DU CLIENT, s'il en a ecrit un ----------------------
    # Il remplace la question — mais JAMAIS en silence : on annonce ce
    # qu'on applique et on rappelle comment le changer.
    reglage = lis_reglage(a.sortie)
    venu_du_reglage = []
    if reglage:
        if not a.tailles and reglage.get("tailles"):
            a.tailles = reglage["tailles"]
            venu_du_reglage.append("tailles = %s" % a.tailles)
        if not a.mode and reglage.get("mode"):
            a.mode = reglage["mode"]
            venu_du_reglage.append("mode = %s" % a.mode)
        if not a.orphelin and reglage.get("orphelin") == "seul":
            a.orphelin = "seul"
            venu_du_reglage.append("orphelin = seul")
    if venu_du_reglage:
        print("")
        print("+" + "-" * 60 + "+")
        print("|  J'APPLIQUE TON REGLAGE, PAS UN CHOIX A MOI" + " " * 17 + "|")
        print("+" + "-" * 60 + "+")
        for l in venu_du_reglage:
            print("   %s" % l)
        print("   fichier : %s" % reglage["_fichier"])
        print("   Pour changer : ouvre ce fichier, ou efface la ligne et")
        print("   l'agent te reposera la question.")
        print("")

    # --- LA QUESTION OBLIGATOIRE ---------------------------------------
    # Sans reponse du client ET sans reglage ecrit de sa main, on ne
    # fabrique RIEN. C'est le seul endroit ou l'outil refuse en affichant
    # la question plutot qu'un motif.
    if not a.tailles or not a.mode:
        manque = []
        if not a.tailles:
            manque.append("--tailles")
        if not a.mode:
            manque.append("--mode")
        print("REFUS : tu n'as pas pose la question au client (%s manque)."
              % " et ".join(manque))
        print(QUESTION)
        return 2

    # --- les tailles ---------------------------------------------------
    if a.tailles not in TAILLES:
        erreurs.append("configuration de tailles inconnue : %s "
                       "(lance --tailles pour voir la liste)" % a.tailles)
        tailles = []
    elif a.tailles == "perso":
        if not a.tailles_perso:
            erreurs.append("le mode perso demande --tailles-perso \"S,M,L\"")
            tailles = []
        else:
            tailles = [t.strip() for t in a.tailles_perso.split(",") if t.strip()]
            if not tailles:
                erreurs.append("--tailles-perso est vide")
    else:
        tailles = list(TAILLES[a.tailles][1])

    if erreurs:
        for e in erreurs:
            print("REFUS : %s" % e)
        return 2

    # --- la matrice ----------------------------------------------------
    try:
        lignes = fabrique_matrice(a.boutique, a.modele, couleurs, tailles,
                                  a.mode, a.groupes,
                                  a.orphelin == "seul")
    except ValueError as e:
        print("REFUS : %s" % e)
        return 2

    pb = controle_matrice(lignes, couleurs, tailles, a.mode)
    if pb:
        for p in pb:
            print("REFUS : %s" % p)
        return 2

    # L'AVERTISSEMENT PROMIS PAR code_couleur ET PAR LES-SKU.md.
    # Il n'etait affiche nulle part : la doc promettait, personne ne tenait.
    dis_avertissements_couleurs(couleurs)

    # --- le stock ------------------------------------------------------
    stock = {}
    if a.stock:
        try:
            # LA CLE DU STOCK EST CELLE QUE PORTE LA LIGNE.
            # En mode « unique » la ligne porte « S+M+L+XL », pas « S » :
            # la cle « couleur/taille » cherchee plus bas ne tombait sur
            # rien, .get() rendait None, et TOUT le stock declare sortait
            # vide — avec « stock renseigne ... OK » a l'ecran, puis un
            # --stock-recompter qui repartait de zero. Le mode
            # « groupe2-affiche » faisait deja juste : on l'aligne dessus.
            if a.mode in ("groupe2-affiche", "unique"):
                base = [x for x in sorted(set(l["taille"] for l in lignes))
                        if x]
            else:
                base = tailles
            stock = lis_stock(a.stock, couleurs, base,
                              a.stock_par_couleur)
        except ValueError as e:
            print("REFUS : %s" % e)
            return 2
    else:
        print("ATTENTION : aucun stock donne (--stock). La page peut etre")
        print("            preparee, mais tu ne sauras pas ce qu'il te reste.")

    # --- les photos ----------------------------------------------------
    photos = lis_photos(a.photos) if a.photos else []
    if len(photos) < PHOTOS_MINI:
        print("REFUS : il faut au moins %d photos, tu en as %d."
              % (PHOTOS_MINI, len(photos)))
        return 2
    if len(photos) > PHOTOS_MAXI:
        print("REFUS : %d photos, c'est plus que le maximum de %d. Garde les "
              "meilleures." % (len(photos), PHOTOS_MAXI))
        return 2

    non_https = [p["url"] for p in photos if not p["url"].lower().startswith("https://")]
    if non_https:
        print("REFUS : ces photos ne sont pas des adresses https, Tassyir les")
        print("        refusera dans la galerie :")
        for u in non_https[:5]:
            print("          %s" % u)
        return 2

    texte_ordre = getattr(a, "ordre_couleurs", "") or ""
    if demande_foncees(texte_ordre):
        # DU FONCE AU CLAIR (le defaut du vendeur) : l'ordre vient des hex de
        # --couleurs, puis la MEME rotation que pour un ordre donne
        noms_ordre, dit_ordre = ordre_fonce_clair(couleurs)
        print("ORDRE DES COULEURS : du fonce au clair -> %s" % ", ".join(noms_ordre))
        if dit_ordre:
            print(dit_ordre)
    else:
        noms_ordre = lis_ordre_couleurs(texte_ordre)
    ordre, reste = alterne_couleurs(photos, noms_ordre)
    ordre = ordre + reste
    une_seule_couleur = rien_a_alterner(photos)

    # LA REGLE PHARE S'APPLIQUE ICI, OU NULLE PART.
    # Avant : le reste etait recolle a la fin, le controle etait seulement
    # IMPRIME dans le rapport, et la fabrication continuait avec EXIT=0.
    # Une regle qu'on imprime n'est pas une regle, c'est une remarque : la
    # page partait quand meme avec trois photos blanches d'affilee.
    # EXCEPTION : un produit d'une seule couleur ne peut pas alterner. Il
    # ne doit ni alarmer ni refuser (voir rien_a_alterner).
    fautes = [] if une_seule_couleur else controle_alternance(ordre)
    if fautes:
        print("REFUS : deux photos de la meme couleur se suivent, %d fois."
              % len(fautes))
        for i, c in fautes:
            print("          position %d : %s" % (i + 1, c))
        print("        Trois photos de la meme couleur d'affilee font croire "
              "a la cliente")
        print("        qu'il n'y a qu'une seule couleur. Elle ecrit pour "
              "demander, et une")
        print("        question est une commande qui n'est pas passee.")
        for l in conseil_alternance(photos):
            print("        %s" % l)
        return 2

    # --- les textes ----------------------------------------------------
    blocs = []
    if a.textes:
        blocs = lis_textes(a.textes)
        pbt = controle_textes(blocs)
        if pbt:
            for p in pbt:
                print("REFUS : %s" % p)
            return 2
        if len(blocs) < BLOCS_MINI_DESCRIPTION:
            print("REFUS : il faut au moins %d blocs de texte (un par angle), "
                  "tu en as %d." % (BLOCS_MINI_DESCRIPTION, len(blocs)))
            return 2
    else:
        print("REFUS : il manque les textes (--textes). La description ne")
        print("        s'invente pas : elle est reprise de tes angles.")
        print("        Ecris-les dans un fichier, un bloc par angle,")
        print("        separes par une ligne vide.")
        return 2

    try:
        description = bati_description(ordre, blocs, a.prix, a.livraison)
    except ValueError as e:
        print("REFUS : %s" % e)
        return 2
    couples, phrase_couples = couples_description(ordre, blocs)
    if phrase_couples:
        print(phrase_couples)
    print("MANITA_JSON " + json.dumps({"quoi": "description", "couples": couples,
                                       "minimum": PHOTOS_DESCRIPTION,
                                       "photos": description.count("<img"),
                                       "dit": phrase_couples}, ensure_ascii=False))
    paquet = bati_paquet(nom, a.prix, couleurs, tailles, lignes, ordre,
                         description, a.boutique_id)

    # --- on ecrit ------------------------------------------------------
    dossier = a.sortie or os.path.join(os.getcwd(), "produit-" + nettoie_sku(a.modele).lower())
    os.makedirs(dossier, exist_ok=True)

    with open(os.path.join(dossier, "paquet-create_product.json"), "w",
              encoding="utf-8") as f:
        json.dump(paquet, f, ensure_ascii=False, indent=2)

    fiche_stock = {
        "produit": nom,
        "boutique": a.boutique,
        "modele": a.modele,
        "mode_sku": a.mode,
        "prix": int(a.prix),
        "lignes": [
            {"couleur": l["couleur"], "taille": l["taille"],
             "taille_visible": l["taille_visible"], "sku": l["sku"],
             "stock_depart": stock.get(
                 "%s/%s" % (l["couleur"], l["taille"]) if l["couleur"] and l["taille"]
                 else (l["taille"] or l["couleur"] or "unique"))}
            for l in lignes
        ],
        "note": ("Tassyir ne sait pas tenir un stock par taille : "
                 "create_product n'a aucun champ quantite et adjust_inventory "
                 "reclame un identifiant que get_inventory ne rend jamais. "
                 "Ce fichier est la source de verite. Pour le recompter, lire "
                 "list_orders (orderItems porte variantId et quantity), puis "
                 "list_order_tracking et list_returns."),
    }
    with open(os.path.join(dossier, "stock.json"), "w", encoding="utf-8") as f:
        json.dump(fiche_stock, f, ensure_ascii=False, indent=2)

    with open(os.path.join(dossier, "description.txt"), "w", encoding="utf-8") as f:
        f.write(description)

    with open(os.path.join(dossier, "ordre-des-photos.txt"), "w", encoding="utf-8") as f:
        for i, p in enumerate(ordre, start=1):
            f.write("%2d  %-12s %s\n" % (i, p["couleur"] or "?", p["url"]))

    # --- le rapport ----------------------------------------------------
    print("")
    print("=" * 62)
    print("CE QUI A ETE PREPARE")
    print("=" * 62)
    print("  produit ............ %s" % nom)
    print("  prix ............... %d DA" % a.prix)
    print("  couleurs ........... %s" % (", ".join(c["nom"] for c in couleurs) or "aucune"))
    print("  tailles visibles ... %s" % (", ".join(
        sorted(set(str(l["taille_visible"]) for l in lignes if l["taille_visible"]),
               key=lambda x: [str(l["taille_visible"]) for l in lignes].index(x)))
        or "aucune"))
    print("  mode SKU ........... %s" % a.mode)
    print("  variantes .......... %d" % len(lignes))
    print("  SKU differents ..... %d" % len(set(l["sku"] for l in lignes)))
    print("  photos ............. %d" % len(ordre))
    print("")
    print("  LES SKU :")
    deja = []
    for l in lignes:
        if l["sku"] not in deja:
            deja.append(l["sku"])
            portees = [x["taille"] for x in lignes if x["sku"] == l["sku"]]
            print("    %-26s %s" % (l["sku"], ", ".join(str(p) for p in portees)))

    print("")
    print("  LES CONTROLES :")
    print("    prix entre %d et %d DA ................ OK" % (PRIX_MINI, PRIX_MAXI))
    print("    nombre de photos entre %d et %d ........ OK" % (PHOTOS_MINI, PHOTOS_MAXI))
    print("    toutes les photos sont en https ........ OK")
    print("    aucun SKU en double par couleur/groupe . OK")
    print("    aucune taille sans SKU ................. OK")
    if stock:
        vides = [k for k, v in stock.items() if v == 0]
        print("    stock renseigne pour chaque taille ..... OK  (%d pieces "
              "en tout)" % sum(stock.values()))
        if vides:
            print("       a zero : %s" % ", ".join(vides))
    if une_seule_couleur:
        print("    une seule couleur : rien a alterner .... OK")
    else:
        print("    aucune couleur ne se suit sur deux photos  OK")
    print("    textes repris de tes angles ............ OK  (%d blocs)" % len(blocs))
    print("    aucun mot interdit dans les textes ..... OK")

    print("")
    print("  CE QU'IL RESTE A FAIRE, ET QUE CET OUTIL NE FAIT PAS :")
    print("    1. Claude remplace « %s »" % PLACE_BOUTIQUE)
    print("       par le vrai storeId, lu avec list_stores (boutiques ACTIVES)")
    print("    2. Claude appelle create_product avec le paquet")
    print("    3. Claude cache le produit le temps de la relecture :")
    print("       update_product  isActive:false  isVisible:false")
    print("    4. Claude envoie la DESCRIPTION SEULE (update_product productId +")
    print("       description), puis get_product la relit telle qu'elle est stockee")
    print("    5. Claude fabrique l'apercu : render_preview storeId + productId")
    print("    6. la page prete et relue est PUBLIEE tout de suite (regle du")
    print("       vendeur, sans attendre de oui) : isActive:true, isVisible:true,")
    print("       et les variantes du paquet isHidden:false")
    print("       (chaque variante avec son id, son price et ses selectedOptions lus par get_product)")

    dire_ou_sont_les_fichiers(dossier, [
        "paquet-create_product.json", "stock.json",
        "description.txt", "ordre-des-photos.txt"])

    if a.json:
        print(json.dumps(paquet, ensure_ascii=False))
    return 0


def montre_tailles():
    print("")
    print("LES %d CONFIGURATIONS DE TAILLES" % len(TAILLES))
    print("-" * 62)
    for cle, (titre, liste) in TAILLES.items():
        if liste is None:
            detail = "tu donnes les tiennes avec --tailles-perso"
        elif not liste:
            detail = "produit sans variante de taille"
        else:
            detail = ", ".join(liste)
        print("  %-18s %s" % (cle, titre))
        print("  %-18s   %s" % ("", detail))
    print("")
    print("LES 4 MODES DE SKU (+ 1 variante d'affichage)")
    print("-" * 62)
    for cle, txt in MODES_SKU.items():
        print("  %-18s %s" % (cle, txt))
    print("")
    print("LA DIFFERENCE QUI COMPTE entre groupe2 et groupe2-affiche :")
    print("  groupe2          la cliente choisit S, M, L... chaque taille a sa")
    print("                   propre variante, donc TU SAIS quelle taille est")
    print("                   partie. Le SKU, lui, est partage par deux.")
    print("  groupe2-affiche  la cliente choisit « Taille 1 (S-M) ». Plus")
    print("                   simple pour elle, mais TU NE SAURAS JAMAIS si")
    print("                   c'est le S ou le M qui s'est vendu.")
    print("")
    return 0


def montre_couleurs():
    print("")
    print("LES CODES COULEUR (trois lettres, comme dans tes SKU)")
    print("-" * 62)
    vus = []
    for nom, code in CODES_COULEUR.items():
        if code in vus:
            continue
        vus.append(code)
        print("  %-4s  %s" % (code, nom))
    print("")
    print("  Une couleur absente de cette liste prend ses trois premieres")
    print("  lettres. L'outil previent, et il REFUSE si deux couleurs")
    print("  differentes tombent sur le meme code.")
    print("")
    return 0


def installer():
    print("")
    print("INSTALLATION DE manita-produit.py v%s" % VERSION)
    print("-" * 62)
    v = sys.version_info
    print("  Python %d.%d.%d" % (v.major, v.minor, v.micro))
    if v < (3, 6):
        print("  RATE : il faut Python 3.6 ou plus recent.")
        return 1
    print("  [OK  ] version de Python suffisante")
    for mod in ["json", "re", "os", "unicodedata", "argparse"]:
        __import__(mod)
        print("  [OK  ] %s" % mod)
    print("-" * 62)
    print("  RIEN A INSTALLER. Cet outil n'utilise que ce que Python apporte")
    print("  deja. Aucune bibliotheque, aucun telechargement, aucun mot de")
    print("  passe administrateur.")
    print("")
    print("  Etape suivante : python3 manita-produit.py --verifier")
    print("")
    return 0


def main():
    p = argparse.ArgumentParser(
        prog="manita-produit.py",
        description="Page produit + SKU pour Tassyir. Ne se connecte a rien.")
    p.add_argument("--installer", action="store_true")
    p.add_argument("--verifier", action="store_true")
    p.add_argument("--tailles-liste", action="store_true",
                   help="montre les 12 configurations et les modes SKU")
    p.add_argument("--couleurs-liste", action="store_true",
                   help="montre les codes couleur")
    p.add_argument("--question", action="store_true",
                   help="affiche la question obligatoire a poser au client")
    p.add_argument("--reglage-ecrire", action="store_true",
                   help="ecrit la reponse du client dans reglage.txt")
    p.add_argument("--reglage-voir", action="store_true",
                   help="montre le reglage en place")
    p.add_argument("--stock-brancher", action="store_true",
                   help="colle les identifiants de variantes Tassyir sur le stock")
    p.add_argument("--stock-recompter", action="store_true",
                   help="recalcule le stock restant depuis les commandes")
    p.add_argument("--stock-fichier", default="", help="chemin de stock.json")
    p.add_argument("--produit-json", default="",
                   help="la reponse de create_product, enregistree")
    p.add_argument("--commandes", default="",
                   help="les commandes relevees par Claude")

    p.add_argument("--produit", action="store_true", help="prepare un produit")
    p.add_argument("--nom", default="")
    p.add_argument("--boutique", default="", help="code court de la boutique, ex SHOP")
    p.add_argument("--boutique-id", default=None, help="storeId Tassyir si tu l'as deja")
    p.add_argument("--modele", default="", help="code du modele, ex M05")
    p.add_argument("--prix", type=int, default=0)
    p.add_argument("--couleurs", default="", help="\"Noir:#141414, Beige:#C9BC94\"")
    p.add_argument("--tailles", default="",
                   help="AUCUN defaut : c'est la reponse du client")
    p.add_argument("--tailles-perso", default="")
    p.add_argument("--mode", default="",
                   choices=[""] + list(MODES_SKU.keys()),
                   help="AUCUN defaut : c'est la reponse du client")
    p.add_argument("--groupes", default=None, help="mode perso : \"S+M, L+XL\"")
    p.add_argument("--orphelin", default="", choices=["", "seul"],
                   help="une taille restee seule recoit son propre SKU")
    p.add_argument("--stock", default="", help="\"S:8,M:12\" ou \"Noir/S:8,...\"")
    p.add_argument("--doc-sku", action="store_true",
                   help="reecrit LES-SKU.md a partir du code lui-meme")
    p.add_argument("--stock-par-couleur", action="store_true",
                   help="le nombre ecrit vaut pour CHAQUE couleur, "
                        "pas pour la taille toutes couleurs confondues")
    p.add_argument("--photos", default="", help="fichier, ou \"Couleur|url, ...\"")
    p.add_argument("--textes", default="", help="fichier des blocs d'angles")
    p.add_argument("--ordre-couleurs", default="",
                   help="\"foncees\" : du fonce au clair par les hex de --couleurs (le defaut du vendeur) ; ou \"Noir,Beige,Rouge\" : cet ordre de rotation (le reglage du bureau) ; vide = la plus fournie d'abord")
    p.add_argument("--livraison", default=None)
    p.add_argument("--sortie", default=None)
    p.add_argument("--json", action="store_true", help="affiche aussi le paquet brut")

    a = p.parse_args()

    if a.installer:
        return installer()
    if a.verifier:
        return verifier()
    if a.tailles_liste:
        return montre_tailles()
    if a.couleurs_liste:
        return montre_couleurs()
    if a.doc_sku:
        chemin = os.path.join(os.getcwd(), "LES-SKU.md")
        try:
            with open(chemin, "w", encoding="utf-8") as f:
                f.write(doc_sku())
        except OSError as e:
            print("REFUS : impossible d'ecrire %s : %s" % (chemin, e))
            return 2
        print("Ecrit : %s" % chemin)
        print("Il sort des tables du code. Si un jour il te parait faux,")
        print("c'est le code qui a change : relance cette commande.")
        return 0

    if a.question:
        print(QUESTION)
        return 0
    if a.reglage_ecrire:
        if not a.tailles or not a.mode:
            print("REFUS : pour ecrire un reglage il faut la reponse du")
            print("        client sur les DEUX points.")
            print(QUESTION)
            return 2
        if a.tailles not in TAILLES:
            print("REFUS : configuration de tailles inconnue : %s" % a.tailles)
            return 2
        chemin = ecris_reglage(a.sortie, a.tailles, a.mode, a.orphelin)
        print("")
        print("REGLAGE ECRIT : %s" % chemin)
        print("   tailles  = %s" % a.tailles)
        print("   mode     = %s" % a.mode)
        print("   orphelin = %s" % (a.orphelin or "demande"))
        print("")
        print("A partir de maintenant l'agent l'applique tout seul, et il te")
        print("le rappelle a chaque produit. Efface une ligne du fichier pour")
        print("qu'il te repose la question.")
        print("")
        return 0
    if a.stock_brancher:
        if not a.stock_fichier or not a.produit_json:
            print("REFUS : il faut --stock-fichier et --produit-json")
            return 2
        with open(a.stock_fichier, "r", encoding="utf-8") as f:
            fiche = json.load(f)
        with open(a.produit_json, "r", encoding="utf-8") as f:
            produit = json.load(f)
        n_ok, manq = branche_variantes(fiche, produit)
        with open(a.stock_fichier, "w", encoding="utf-8") as f:
            json.dump(fiche, f, ensure_ascii=False, indent=2)
        print("")
        print("BRANCHEMENT DU STOCK SUR TASSYIR")
        print("  lignes branchees ... %d sur %d" % (n_ok, len(fiche["lignes"])))
        if manq:
            print("  PAS TROUVEES dans le produit Tassyir :")
            for m in manq:
                print("     %s" % m)
            print("  Tant qu'une ligne n'est pas branchee, son stock ne")
            print("  pourra pas etre recompte. Ne dis pas que c'est bon.")
            return 2
        print("  fichier ............ %s" % os.path.abspath(a.stock_fichier))
        print("")
        return 0

    if a.stock_recompter:
        if not a.stock_fichier or not a.commandes:
            print("REFUS : il faut --stock-fichier et --commandes")
            return 2
        with open(a.stock_fichier, "r", encoding="utf-8") as f:
            fiche = json.load(f)
        try:
            cmds = lis_commandes(a.commandes)
        except (ValueError, json.JSONDecodeError) as e:
            print("REFUS : %s" % e)
            return 2
        non_branchees = [l for l in fiche["lignes"] if not l.get("variantId")]
        if non_branchees:
            print("REFUS : %d lignes de stock n'ont pas d'identifiant de"
                  % len(non_branchees))
            print("        variante. Lance d'abord --stock-brancher.")
            return 2
        fiche, orphelines = recompte(fiche, cmds)
        with open(a.stock_fichier, "w", encoding="utf-8") as f:
            json.dump(fiche, f, ensure_ascii=False, indent=2)

        print("")
        print("=" * 62)
        print("STOCK RECOMPTE  —  %s" % fiche.get("produit", ""))
        print("=" * 62)
        print("  %-10s %-6s %7s %6s %7s %8s" %
              ("couleur", "taille", "depart", "sorti", "retour", "RESTANT"))
        for l in fiche["lignes"]:
            print("  %-10s %-6s %7d %6d %7d %8d" %
                  ((l.get("couleur") or "-")[:10],
                   str(l.get("taille") or "-")[:6],
                   l.get("stock_depart") or 0, l.get("sorti", 0),
                   l.get("retour", 0), l.get("stock_restant", 0)))
        reserve = sum(l.get("reserve", 0) for l in fiche["lignes"])
        inconnu = sum(l.get("inconnu", 0) for l in fiche["lignes"])
        vides = [l for l in fiche["lignes"] if l.get("stock_restant", 0) <= 0]
        print("")
        print("  EN ATTENTE DE CONFIRMATION : %d pieces" % reserve)
        print("     Elles ne sont PAS deduites. En paiement a la livraison,")
        print("     une bonne part ne se confirmera jamais.")
        if inconnu:
            print("")
            print("  STATUT INCONNU : %d pieces — NON deduites." % inconnu)
            print("     Je ne devine pas un statut que je ne connais pas.")
        if vides:
            print("")
            print("  A ZERO OU EN DESSOUS :")
            for l in vides:
                print("     %s / %s  ->  %d"
                      % (l.get("couleur") or "-", l.get("taille") or "-",
                         l.get("stock_restant", 0)))
            print("     Rappel : ta boutique accepte quand meme la commande")
            print("     (allowOutOfStockOrders), et aucun outil ne peut")
            print("     changer ce reglage.")
        if orphelines:
            print("")
            print("  %d variantes commandees ne sont PAS dans ce fichier :"
                  % len(orphelines))
            for v in orphelines[:8]:
                print("     %s" % v)
            print("     Ce sont d'autres produits, ou ce fichier est incomplet.")
        print("")
        print("  fichier : %s" % os.path.abspath(a.stock_fichier))
        print("")
        return 0

    if a.reglage_voir:
        r = lis_reglage(a.sortie)
        if not r:
            print("")
            print("Aucun reglage ecrit. L'agent posera la question a chaque")
            print("produit — c'est le comportement normal.")
            print(QUESTION)
        else:
            print("")
            print("TON REGLAGE : %s" % r["_fichier"])
            for cle in ("tailles", "mode", "orphelin"):
                print("   %-9s = %s" % (cle, r.get(cle, "(pas ecrit)")))
            print("")
        return 0
    if a.produit:
        return commande_produit(a)

    p.print_help()
    print("")
    print("Commence par :  python3 manita-produit.py --installer")
    return 0


if __name__ == "__main__":
    sys.exit(main())
